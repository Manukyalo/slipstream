import { useState } from 'react';
import { OfflineManager } from '@maplibre/maplibre-react-native';
import { DEFAULT_DARK_STYLE_URL } from '@/components/map/SlipstreamMap';

export interface OfflineDownloadState {
  isDownloading: boolean;
  progressPercentage: number;
  completed: boolean;
  error: string | null;
}

export function useOfflineMap() {
  const [downloadState, setDownloadState] = useState<OfflineDownloadState>({
    isDownloading: false,
    progressPercentage: 0,
    completed: false,
    error: null,
  });

  const downloadCurrentArea = async (
    centerCoord: [number, number],
    packName = 'Area Offline Pack'
  ) => {
    if (downloadState.isDownloading) return;

    setDownloadState({
      isDownloading: true,
      progressPercentage: 0,
      completed: false,
      error: null,
    });

    const [lon, lat] = centerCoord;
    // Bounding box ~5-10km surrounding current location
    const delta = 0.08;
    const bounds: [number, number, number, number] = [
      lon - delta, // west
      lat - delta, // south
      lon + delta, // east
      lat + delta, // north
    ];

    try {
      await OfflineManager.createPack(
        {
          mapStyle: DEFAULT_DARK_STYLE_URL,
          bounds,
          minZoom: 10,
          maxZoom: 16,
          metadata: { name: packName, timestamp: Date.now() },
        },
        (_pack, status) => {
          setDownloadState((prev) => ({
            ...prev,
            progressPercentage: Math.round(status.percentage),
            completed: status.state === 'complete',
            isDownloading: status.state !== 'complete',
          }));
        },
        (_pack, err) => {
          setDownloadState((prev) => ({
            ...prev,
            isDownloading: false,
            error: err.message,
          }));
        }
      );
    } catch (e: unknown) {
      setDownloadState({
        isDownloading: false,
        progressPercentage: 0,
        completed: false,
        error: e instanceof Error ? e.message : 'Download failed',
      });
    }
  };

  return {
    downloadState,
    downloadCurrentArea,
  };
}
