/**
 * SlipstreamMap — Full-Bleed Dark Telemetry Map
 *
 * Powered by MapLibre GL JS (https://github.com/maplibre/maplibre-gl-js)
 * Rendered via high-performance hardware-accelerated WebView across iOS, Android, and Web.
 * Configured with OpenFreeMap Dark style, live breadcrumb route polyline,
 * directional vehicle heading puck, and cyan glowing aura.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { FeatureCollection, LineString } from 'geojson';
import { Colors } from '@/constants/theme';

export const OPENFREEMAP_DARK_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
export const DEFAULT_DARK_STYLE_URL = OPENFREEMAP_DARK_STYLE_URL;

interface MapViewProps {
  styleUrl?: string;
  children?: React.ReactNode;
  centerCoordinate?: [number, number] | null;
  zoomLevel?: number;
  routeGeoJson?: FeatureCollection<LineString>;
  followUser?: boolean;
  heading?: number | null;
}

/**
 * Generate self-contained HTML running MapLibre GL JS with Slipstream cockpit styling
 */
function buildMapHtml(styleUrl: string, initialCenter: [number, number], initialZoom: number): string {
  const [initLon, initLat] = initialCenter;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Slipstream Map</title>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body { width: 100%; height: 100%; overflow: hidden; background-color: #05070D; }
    #map { width: 100%; height: 100%; position: absolute; top: 0; left: 0; background-color: #05070D; }
    .maplibregl-control-container { display: none !important; }

    /* Custom glowing telemetry vehicle puck */
    .user-puck-container {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      pointer-events: none;
    }
    .user-puck-halo {
      position: absolute;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(34, 211, 238, 0.45) 0%, rgba(34, 211, 238, 0) 70%);
      animation: puckPulse 2s ease-out infinite;
    }
    .user-puck-dot {
      position: relative;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #22D3EE;
      border: 3px solid #05070D;
      box-shadow: 0 0 12px rgba(34, 211, 238, 0.9);
      transition: transform 0.25s linear;
    }
    .user-puck-heading {
      position: absolute;
      top: -6px;
      left: 5px;
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-bottom: 7px solid #22D3EE;
    }
    @keyframes puckPulse {
      0% { transform: scale(0.7); opacity: 0.9; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    let map = null;
    let marker = null;
    let puckEl = null;
    let headingEl = null;
    let isMapLoaded = false;
    let pendingRoute = null;

    try {
      map = new maplibregl.Map({
        container: 'map',
        style: '${styleUrl}',
        center: [${initLon}, ${initLat}],
        zoom: ${initialZoom},
        attributionControl: false,
        fadeDuration: 0,
        dragRotate: false,
        pitchWithRotate: false
      });

      // Build custom telemetry vehicle marker element
      puckEl = document.createElement('div');
      puckEl.className = 'user-puck-container';
      puckEl.innerHTML = '<div class="user-puck-halo"></div><div class="user-puck-dot"><div class="user-puck-heading" id="headingCone"></div></div>';
      headingEl = puckEl.querySelector('#headingCone');

      marker = new maplibregl.Marker({
        element: puckEl,
        rotationAlignment: 'map',
        pitchAlignment: 'map'
      })
      .setLngLat([${initLon}, ${initLat}])
      .addTo(map);

      map.on('load', () => {
        isMapLoaded = true;

        // Register live route polyline source
        map.addSource('liveRouteSource', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        // Outer cyan bloom glow
        map.addLayer({
          id: 'liveRouteGlow',
          type: 'line',
          source: 'liveRouteSource',
          paint: {
            'line-color': '#22D3EE',
            'line-width': 10,
            'line-opacity': 0.45,
            'line-blur': 3
          },
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          }
        });

        // Core crisp telemetry line
        map.addLayer({
          id: 'liveRouteLine',
          type: 'line',
          source: 'liveRouteSource',
          paint: {
            'line-color': '#22D3EE',
            'line-width': 3.5,
            'line-opacity': 1.0
          },
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          }
        });

        if (pendingRoute) {
          map.getSource('liveRouteSource').setData(pendingRoute);
          pendingRoute = null;
        }

        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
        }
      });
    } catch (e) {
      console.error('[MapLibreGL] Initialization error:', e);
    }

    // Telemetry dispatch handlers
    window.updatePosition = function(lon, lat, heading, follow, zoom) {
      if (!map) return;
      if (marker) {
        marker.setLngLat([lon, lat]);
      }
      if (heading != null && !isNaN(heading) && headingEl) {
        puckEl.querySelector('.user-puck-dot').style.transform = 'rotate(' + heading + 'deg)';
      }
      if (follow) {
        map.easeTo({
          center: [lon, lat],
          zoom: zoom || map.getZoom(),
          duration: 500,
          easing: function(t) { return t; }
        });
      }
    };

    window.updateRouteData = function(geoJson) {
      if (!map) return;
      if (!isMapLoaded) {
        pendingRoute = geoJson;
        return;
      }
      const source = map.getSource('liveRouteSource');
      if (source) {
        source.setData(geoJson);
      }
    };

    // Generic bridge message receiver
    function handleBridgeMessage(event) {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'UPDATE_POSITION') {
          window.updatePosition(payload.lon, payload.lat, payload.heading, payload.follow, payload.zoom);
        } else if (payload.type === 'UPDATE_ROUTE') {
          window.updateRouteData(payload.geoJson);
        }
      } catch (err) {}
    }

    window.addEventListener('message', handleBridgeMessage);
    document.addEventListener('message', handleBridgeMessage);
  </script>
</body>
</html>`;
}

export function SlipstreamMap({
  styleUrl = DEFAULT_DARK_STYLE_URL,
  children,
  centerCoordinate,
  zoomLevel = 16,
  routeGeoJson,
  followUser = true,
  heading = null,
}: MapViewProps) {
  const webViewRef = useRef<WebView>(null);

  // Fallback origin (Nairobi: [36.8219, -1.2921]) if center coordinate not yet streamed
  const initialCenter: [number, number] = useMemo(() => {
    return centerCoordinate ?? [36.8219, -1.2921];
  }, [centerCoordinate]);

  const mapHtml = useMemo(() => {
    return buildMapHtml(styleUrl, initialCenter, zoomLevel);
  }, [styleUrl, initialCenter, zoomLevel]);

  // Push position/heading updates to the MapLibre GL JS engine via bridge
  useEffect(() => {
    if (!centerCoordinate || !webViewRef.current) return;
    const [lon, lat] = centerCoordinate;

    const script = `
      if (window.updatePosition) {
        window.updatePosition(${lon}, ${lat}, ${heading !== null ? heading : 'null'}, ${followUser}, ${zoomLevel});
      }
    `;
    webViewRef.current.injectJavaScript(script);
  }, [centerCoordinate, heading, followUser, zoomLevel]);

  // Push route polyline updates to the MapLibre GL JS engine via bridge
  useEffect(() => {
    if (!webViewRef.current || !routeGeoJson) return;

    const dataStr = JSON.stringify(routeGeoJson);
    const script = `
      if (window.updateRouteData) {
        window.updateRouteData(${dataStr});
      }
    `;
    webViewRef.current.injectJavaScript(script);
  }, [routeGeoJson]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={styles.webView}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        androidLayerType="hardware"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.bg.base,
    overflow: 'hidden',
  },
  webView: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.bg.base,
  },
});
