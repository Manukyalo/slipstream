import { StyleSheet, View } from 'react-native';
import { Map, Camera } from '@maplibre/maplibre-react-native';
import { Colors } from '@/constants/design';

// Recommended vector tile base (MapTiler dark theme or Carto dark tiles)
const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';
export const DEFAULT_DARK_STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`
  : 'https://demotiles.maplibre.org/style.json';

interface MapViewProps {
  styleUrl?: string;
  children?: React.ReactNode;
  centerCoordinate?: [number, number];
  zoomLevel?: number;
}

export function SlipstreamMap({
  styleUrl = DEFAULT_DARK_STYLE_URL,
  children,
  centerCoordinate,
  zoomLevel = 14,
}: MapViewProps) {
  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={styleUrl}
        logoPosition={{ bottom: -100, left: -100 }}
        attributionPosition={{ bottom: -100, right: -100 }}
      >
        <Camera
          initialViewState={{
            ...(centerCoordinate ? { center: centerCoordinate } : {}),
            zoom: zoomLevel,
          }}
        />
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
