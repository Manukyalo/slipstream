import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { Colors } from '@/constants/design';

// OpenFreeMap: Free, open-source vector tile service based on OpenStreetMap & MapLibre (no API key required)
export const OPENFREEMAP_DARK_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
export const OPENFREEMAP_LIBERTY_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const DEFAULT_DARK_STYLE_URL = OPENFREEMAP_DARK_STYLE_URL;

interface MapViewProps {
  styleUrl?: string;
  children?: React.ReactNode;
  centerCoordinate?: [number, number];
  zoomLevel?: number;
  routeGeoJson?: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  followUser?: boolean;
}

export function SlipstreamMap({
  styleUrl = DEFAULT_DARK_STYLE_URL,
  children,
  centerCoordinate,
  zoomLevel = 15,
  routeGeoJson,
  followUser = false,
}: MapViewProps) {
  const cameraRef = useRef<CameraRef>(null);

  // Smoothly center on user as GPS samples stream in
  useEffect(() => {
    if (centerCoordinate && followUser && cameraRef.current) {
      cameraRef.current.easeTo({
        center: centerCoordinate,
        zoom: zoomLevel,
        duration: 800,
      });
    }
  }, [centerCoordinate, followUser, zoomLevel]);

  // Current user position as GeoJSON Point
  const currentPosGeoJson: GeoJSON.FeatureCollection<GeoJSON.Point> | null = centerCoordinate
    ? {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: centerCoordinate,
            },
          },
        ],
      }
    : null;

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={styleUrl}
        logoPosition={{ bottom: -100, left: -100 }}
        attributionPosition={{ bottom: -100, right: -100 }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            ...(centerCoordinate ? { center: centerCoordinate } : {}),
            zoom: zoomLevel,
          }}
        />

        {/* Live breadcrumb route layer */}
        {routeGeoJson && routeGeoJson.features.length > 0 ? (
          <GeoJSONSource id="liveRouteSource" data={routeGeoJson}>
            {/* Outer cyan glow line */}
            <Layer
              id="liveRouteGlow"
              type="line"
              paint={{
                'line-color': Colors.accentCyanDim,
                'line-width': 10,
              }}
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
            />
            {/* Core crisp route line */}
            <Layer
              id="liveRouteLine"
              type="line"
              paint={{
                'line-color': Colors.accentCyan,
                'line-width': 4,
              }}
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
            />
          </GeoJSONSource>
        ) : null}

        {/* Current user marker */}
        {currentPosGeoJson ? (
          <GeoJSONSource id="currentPosSource" data={currentPosGeoJson}>
            {/* Halo pulse */}
            <Layer
              id="currentPosHalo"
              type="circle"
              paint={{
                'circle-radius': 14,
                'circle-color': Colors.accentCyanDim,
                'circle-opacity': 0.8,
              }}
            />
            {/* Inner dot */}
            <Layer
              id="currentPosDot"
              type="circle"
              paint={{
                'circle-radius': 6,
                'circle-color': Colors.accentCyan,
                'circle-stroke-width': 2,
                'circle-stroke-color': Colors.textPrimary,
              }}
            />
          </GeoJSONSource>
        ) : null}

        {children}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgBase,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
});
