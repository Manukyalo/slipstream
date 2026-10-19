/**
 * SlipstreamMap — Full-Bleed Dark Telemetry Map
 *
 * WebView-hosted MapLibre GL JS. Supports:
 *  - Live breadcrumb route (solid cyan)
 *  - Speed-coloured recap route (cyan → blue → amber → red per segment)
 *  - Start marker (flag, cyan pin)
 *  - End marker (chequered flag, surface pin)
 *  - Pit stop markers (pause icon, amber pin)
 *  - Dashed gap segments (movement during a paused pit stop)
 *  - FIT_BOUNDS command (zooms to fit entire route with padding)
 *  - CAPTURE_SNAPSHOT command (triggers react-native-view-shot via ref)
 *
 * Bridge protocol (RN → WebView via injectJavaScript):
 *   UPDATE_POSITION  { lon, lat, heading, follow, zoom }
 *   UPDATE_ROUTE     { geoJson }
 *   ADD_MARKER       { markerId, type: 'start'|'end'|'pitstop', lon, lat }
 *   CLEAR_MARKERS    {}
 *   ADD_DASHED_SEG   { id, fromLon, fromLat, toLon, toLat }
 *   UPDATE_RECAP     { speedGeoJson }   — speed-coloured FeatureCollection
 *   FIT_BOUNDS       { points: [lon,lat][] }
 */

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { captureRef } from 'react-native-view-shot';
import type { FeatureCollection, LineString } from 'geojson';
import { Colors } from '@/constants/theme';

export const OPENFREEMAP_DARK_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
export const DEFAULT_DARK_STYLE_URL = OPENFREEMAP_DARK_STYLE_URL;

export interface PitStopMarker {
  lon: number;
  lat: number;
  id: string;
}

export interface DashedSegment {
  id: string;
  fromLon: number;
  fromLat: number;
  toLon: number;
  toLat: number;
}

interface MapViewProps {
  styleUrl?: string;
  children?: React.ReactNode;
  centerCoordinate?: [number, number] | null;
  zoomLevel?: number;
  routeGeoJson?: FeatureCollection<LineString>;
  followUser?: boolean;
  heading?: number | null;
  /** Drop the cyan start flag at this coordinate */
  startCoord?: [number, number] | null;
  /** Drop the chequered-flag end marker at this coordinate */
  endCoord?: [number, number] | null;
  /** Amber pit stop markers */
  pitStopMarkers?: PitStopMarker[];
  /** Dashed gap lines (car moved while paused) */
  dashedSegments?: DashedSegment[];
  /** Speed-coloured FeatureCollection for recap view */
  recapGeoJson?: FeatureCollection<LineString> | null;
}

/** Methods exposed to parent via ref */
export interface SlipstreamMapRef {
  fitBounds: (points: [number, number][]) => void;
  captureSnapshot: () => Promise<string | null>;
}

function buildMapHtml(styleUrl: string, initLon: number, initLat: number, initZoom: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
    html,body { width:100%; height:100%; overflow:hidden; background:#05070D; }
    #map { position:absolute; inset:0; background:#05070D; }
    .maplibregl-control-container { display:none !important; }

    /* Vehicle puck */
    .puck-wrap { width:44px; height:44px; display:flex; align-items:center; justify-content:center; position:relative; pointer-events:none; }
    .puck-halo { position:absolute; width:40px; height:40px; border-radius:50%; background:radial-gradient(circle,rgba(34,211,238,.45) 0%,rgba(34,211,238,0) 70%); animation:pp 2s ease-out infinite; }
    .puck-dot  { position:relative; width:16px; height:16px; border-radius:50%; background:#22D3EE; border:3px solid #05070D; box-shadow:0 0 12px rgba(34,211,238,.9); transition:transform .25s linear; }
    .puck-cone { position:absolute; top:-6px; left:5px; width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-bottom:7px solid #22D3EE; }
    @keyframes pp { 0%{transform:scale(.7);opacity:.9;} 100%{transform:scale(1.6);opacity:0;} }

    /* Start / end / pitstop markers */
    .marker-pin { display:flex; flex-direction:column; align-items:center; cursor:default; pointer-events:none; }
    .marker-circle { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid rgba(255,255,255,.15); }
    .marker-circle.start   { background:#22D3EE; box-shadow:0 0 10px rgba(34,211,238,.6); }
    .marker-circle.end     { background:#0E131B; border-color:#22D3EE; }
    .marker-circle.pitstop { background:#F59E0B; box-shadow:0 0 10px rgba(245,158,11,.5); }
    .marker-tail { width:2px; height:8px; }
    .marker-tail.start   { background:#22D3EE; }
    .marker-tail.end     { background:#22D3EE; }
    .marker-tail.pitstop { background:#F59E0B; }
    .marker-icon { font-size:16px; line-height:1; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    let map = null, puckEl = null, headingEl = null, isLoaded = false, pendingRoute = null;
    const customMarkers = {};

    try {
      map = new maplibregl.Map({
        container:'map', style:'${styleUrl}',
        center:[${initLon},${initLat}], zoom:${initZoom},
        attributionControl:false, fadeDuration:0, dragRotate:false, pitchWithRotate:false
      });

      puckEl = document.createElement('div');
      puckEl.className = 'puck-wrap';
      puckEl.innerHTML = '<div class="puck-halo"></div><div class="puck-dot"><div class="puck-cone" id="cone"></div></div>';
      headingEl = puckEl.querySelector('#cone');
      new maplibregl.Marker({ element:puckEl, rotationAlignment:'map', pitchAlignment:'map' })
        .setLngLat([${initLon},${initLat}]).addTo(map);

      map.on('load', () => {
        isLoaded = true;

        // ── Live route ──────────────────────────────────────────────────────
        map.addSource('liveRoute', { type:'geojson', data:{type:'FeatureCollection',features:[]} });
        map.addLayer({ id:'liveRouteGlow', type:'line', source:'liveRoute',
          paint:{'line-color':'#22D3EE','line-width':10,'line-opacity':.45,'line-blur':3},
          layout:{'line-cap':'round','line-join':'round'} });
        map.addLayer({ id:'liveRouteLine', type:'line', source:'liveRoute',
          paint:{'line-color':'#22D3EE','line-width':3.5,'line-opacity':1},
          layout:{'line-cap':'round','line-join':'round'} });

        // ── Speed-coloured recap route ───────────────────────────────────────
        map.addSource('recapRoute', { type:'geojson', data:{type:'FeatureCollection',features:[]} });
        map.addLayer({ id:'recapGlow', type:'line', source:'recapRoute',
          paint:{'line-color':['get','color'],'line-width':10,'line-opacity':.35,'line-blur':4},
          layout:{'line-cap':'round','line-join':'round'} });
        map.addLayer({ id:'recapLine', type:'line', source:'recapRoute',
          paint:{'line-color':['get','color'],'line-width':4,'line-opacity':1},
          layout:{'line-cap':'round','line-join':'round'} });

        // ── Dashed gap segments ──────────────────────────────────────────────
        map.addSource('gapLines', { type:'geojson', data:{type:'FeatureCollection',features:[]} });
        map.addLayer({ id:'gapLine', type:'line', source:'gapLines',
          paint:{'line-color':'#F59E0B','line-width':2,'line-opacity':.7,'line-dasharray':[4,4]},
          layout:{'line-cap':'butt','line-join':'round'} });

        if (pendingRoute) {
          map.getSource('liveRoute').setData(pendingRoute);
          pendingRoute = null;
        }
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'MAP_READY'}));
        }
      });
    } catch(e) { console.error('[MapLibre] init error:', e); }

    // ── Bridge handlers ──────────────────────────────────────────────────────

    window.updatePosition = function(lon, lat, hdg, follow, zoom) {
      if (!map) return;
      if (puckEl) new maplibregl.Marker({element:puckEl}).setLngLat([lon,lat]).addTo(map);
      if (headingEl && hdg != null && !isNaN(hdg)) {
        puckEl.querySelector('.puck-dot').style.transform = 'rotate('+hdg+'deg)';
      }
      if (follow) map.easeTo({center:[lon,lat], zoom:zoom||map.getZoom(), duration:500});
    };

    window.updateRouteData = function(geoJson) {
      if (!map) return;
      if (!isLoaded) { pendingRoute = geoJson; return; }
      map.getSource('liveRoute').setData(geoJson);
    };

    window.updateRecapRoute = function(geoJson) {
      if (!map || !isLoaded) return;
      map.getSource('recapRoute').setData(geoJson);
      // Hide live route when showing recap
      map.setLayoutProperty('liveRouteLine','visibility','none');
      map.setLayoutProperty('liveRouteGlow','visibility','none');
    };

    window.addMarker = function(markerId, type, lon, lat) {
      if (!map) return;
      if (customMarkers[markerId]) { customMarkers[markerId].remove(); }
      const el = document.createElement('div');
      el.className = 'marker-pin';
      const icons = { start:'\\u2691', end:'\\u26F3', pitstop:'\\u23F8' };
      el.innerHTML = '<div class="marker-circle '+type+'"><span class="marker-icon">'+(icons[type]||'\\u25CF')+'</span></div><div class="marker-tail '+type+'"></div>';
      customMarkers[markerId] = new maplibregl.Marker({element:el, anchor:'bottom'})
        .setLngLat([lon,lat]).addTo(map);
    };

    window.clearMarkers = function() {
      Object.values(customMarkers).forEach(m => m.remove());
      Object.keys(customMarkers).forEach(k => delete customMarkers[k]);
    };

    window.addDashedSegment = function(id, fromLon, fromLat, toLon, toLat) {
      if (!map || !isLoaded) return;
      const src = map.getSource('gapLines');
      if (!src) return;
      const data = src._data || {type:'FeatureCollection',features:[]};
      data.features = data.features.filter(f => f.properties.id !== id);
      data.features.push({type:'Feature',properties:{id},
        geometry:{type:'LineString',coordinates:[[fromLon,fromLat],[toLon,toLat]]}});
      src.setData(data);
    };

    window.fitBounds = function(pointsJson) {
      if (!map) return;
      const pts = JSON.parse(pointsJson);
      if (!pts || pts.length < 2) return;
      let minLon=pts[0][0],maxLon=pts[0][0],minLat=pts[0][1],maxLat=pts[0][1];
      pts.forEach(([lon,lat]) => {
        if (lon<minLon)minLon=lon; if (lon>maxLon)maxLon=lon;
        if (lat<minLat)minLat=lat; if (lat>maxLat)maxLat=lat;
      });
      const pad = Math.max(0.002, (maxLon-minLon)*0.15);
      const padLat = Math.max(0.002, (maxLat-minLat)*0.15);
      map.fitBounds([[minLon-pad,minLat-padLat],[maxLon+pad,maxLat+padLat]], {
        duration:600, maxZoom:15
      });
    };

    function handleBridge(event) {
      try {
        const p = JSON.parse(event.data);
        if (p.type === 'UPDATE_POSITION') window.updatePosition(p.lon,p.lat,p.heading,p.follow,p.zoom);
        else if (p.type === 'UPDATE_ROUTE')    window.updateRouteData(p.geoJson);
        else if (p.type === 'UPDATE_RECAP')    window.updateRecapRoute(p.geoJson);
        else if (p.type === 'ADD_MARKER')      window.addMarker(p.markerId,p.type_,p.lon,p.lat);
        else if (p.type === 'CLEAR_MARKERS')   window.clearMarkers();
        else if (p.type === 'ADD_DASHED_SEG')  window.addDashedSegment(p.id,p.fromLon,p.fromLat,p.toLon,p.toLat);
        else if (p.type === 'FIT_BOUNDS')      window.fitBounds(p.pointsJson);
      } catch(e) {}
    }
    window.addEventListener('message', handleBridge);
    document.addEventListener('message', handleBridge);
  </script>
</body>
</html>`;
}

export const SlipstreamMap = forwardRef<SlipstreamMapRef, MapViewProps>(
  function SlipstreamMap(
    {
      styleUrl = OPENFREEMAP_DARK_STYLE_URL,
      children,
      centerCoordinate,
      zoomLevel = 16,
      routeGeoJson,
      followUser = true,
      heading = null,
      startCoord,
      endCoord,
      pitStopMarkers = [],
      dashedSegments = [],
      recapGeoJson,
    },
    ref,
  ) {
    const webViewRef = useRef<WebView>(null);

    const initialCenter: [number, number] = useMemo(
      () => centerCoordinate ?? [36.8219, -1.2921],
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    const mapHtml = useMemo(
      () => buildMapHtml(styleUrl, initialCenter[0], initialCenter[1], zoomLevel),
      // Only rebuild HTML if style or initial centre changes — not on every zoom update
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [styleUrl, initialCenter[0], initialCenter[1]],
    );

    function inject(script: string) {
      webViewRef.current?.injectJavaScript(`(function(){${script}})();`);
    }

    // ── Imperative handle ───────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      fitBounds: (points: [number, number][]) => {
        inject(`window.fitBounds(${JSON.stringify(JSON.stringify(points))});`);
      },
      captureSnapshot: async (): Promise<string | null> => {
        if (!webViewRef.current) return null;
        try {
          // Give tiles 800 ms to settle after fitBounds
          await new Promise<void>((r) => setTimeout(r, 800));
          const uri = await captureRef(webViewRef, {
            format: 'jpg',
            quality: 0.9,
            result: 'tmpfile',
          });
          return uri;
        } catch (err) {
          console.warn('[SlipstreamMap] Snapshot capture failed:', err);
          return null;
        }
      },
    }));

    // ── Position bridge ─────────────────────────────────────────────────────
    useEffect(() => {
      if (!centerCoordinate) return;
      const [lon, lat] = centerCoordinate;
      inject(
        `window.updatePosition(${lon},${lat},${heading !== null ? heading : 'null'},${followUser},${zoomLevel});`,
      );
    }, [centerCoordinate, heading, followUser, zoomLevel]);

    // ── Live route bridge ───────────────────────────────────────────────────
    useEffect(() => {
      if (!routeGeoJson) return;
      inject(`window.updateRouteData(${JSON.stringify(routeGeoJson)});`);
    }, [routeGeoJson]);

    // ── Recap speed-coloured route ──────────────────────────────────────────
    useEffect(() => {
      if (!recapGeoJson) return;
      inject(`window.updateRecapRoute(${JSON.stringify(recapGeoJson)});`);
    }, [recapGeoJson]);

    // ── Start marker ────────────────────────────────────────────────────────
    useEffect(() => {
      if (!startCoord) return;
      inject(
        `window.addMarker('start','start',${startCoord[0]},${startCoord[1]});`,
      );
    }, [startCoord]);

    // ── End marker ──────────────────────────────────────────────────────────
    useEffect(() => {
      if (!endCoord) return;
      inject(
        `window.addMarker('end','end',${endCoord[0]},${endCoord[1]});`,
      );
    }, [endCoord]);

    // ── Pit stop markers ────────────────────────────────────────────────────
    useEffect(() => {
      pitStopMarkers.forEach((m) => {
        inject(`window.addMarker('ps_${m.id}','pitstop',${m.lon},${m.lat});`);
      });
    }, [pitStopMarkers]);

    // ── Dashed gap segments ─────────────────────────────────────────────────
    useEffect(() => {
      dashedSegments.forEach((seg) => {
        inject(
          `window.addDashedSegment('${seg.id}',${seg.fromLon},${seg.fromLat},${seg.toLon},${seg.toLat});`,
        );
      });
    }, [dashedSegments]);

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
  },
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    inset: 0,
    backgroundColor: Colors.bg.base,
    overflow: 'hidden',
  },
  webView: {
    position: 'absolute',
    inset: 0,
    backgroundColor: Colors.bg.base,
  },
});
