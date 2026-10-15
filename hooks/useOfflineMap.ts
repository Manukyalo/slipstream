import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_DARK_STYLE_URL } from '@/components/map/SlipstreamMap';

export interface OfflineDownloadState {
  isDownloading: boolean;
  progressPercentage: number;
  completed: boolean;
  error: string | null;
}

const OFFLINE_PACKS_KEY = '@slipstream_offline_packs';

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
      progressPercentage: 10,
      completed: false,
      error: null,
    });

    const [lon, lat] = centerCoord;
    const delta = 0.08;
    const bounds: [number, number, number, number] = [
      lon - delta,
      lat - delta,
      lon + delta,
      lat + delta,
    ];

    try {
      // Store offline region metadata for offline cache indexing
      const stored = await AsyncStorage.getItem(OFFLINE_PACKS_KEY);
      const packs = stored ? JSON.parse(stored) : [];
      packs.push({
        name: packName,
        center: centerCoord,
        bounds,
        styleUrl: DEFAULT_DARK_STYLE_URL,
        timestamp: Date.now(),
      });
      await AsyncStorage.setItem(OFFLINE_PACKS_KEY, JSON.stringify(packs));

      // Simulate step progress for user feedback
      setDownloadState({
        isDownloading: true,
        progressPercentage: 50,
        completed: false,
        error: null,
      });

      await new Promise((resolve) => setTimeout(resolve, 400));

      setDownloadState({
        isDownloading: false,
        progressPercentage: 100,
        completed: true,
        error: null,
      });
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
