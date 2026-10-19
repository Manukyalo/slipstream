/**
 * Share Story Card Service — Phase 8
 *
 * Captures 1080x1920 on-device StoryCardView via react-native-view-shot
 * and opens the native OS sharing sheet via expo-sharing.
 *
 * Eliminates previous 404 NOT_FOUND server edge function dependency.
 */

import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { StoryCardData } from '@/components/recap/StoryCardView';

export interface GenerateRecapCardParams {
  type: 'trip' | 'drag' | 'sprint';
  id?: string;
  headline?: string;
  userHandle?: string;
  country?: string;
  vehicleName?: string;
  topSpeedKmh?: number;
  avgSpeedKmh?: number;
  elapsedMs?: number;
  distanceMeters?: number;
  durationSeconds?: number;
  referralCode?: string;
  dateStr?: string;
  hideStartEnd?: boolean;
  snapshotUrl?: string | null;
}

export interface ShareCardResult {
  success: boolean;
  error?: string;
  fileUri?: string;
}

export interface CaptureShareOptions {
  hideStartEnd?: boolean;
}

/**
 * Captures a rendered view ref to a high-resolution PNG, optionally processes with
 * image-manipulator for privacy masking, and invokes the OS Share Sheet.
 */
export async function captureAndShareStoryCard(
  viewRef: React.RefObject<unknown>,
  options?: CaptureShareOptions,
): Promise<ShareCardResult> {
  try {
    if (!viewRef.current) {
      return {
        success: false,
        error: 'Unable to capture: story card element is not mounted.',
      };
    }

    // Capture offscreen view at 1080x1920
    let uri = await captureRef(viewRef, {
      format: 'png',
      quality: 1,
      width: 1080,
      height: 1920,
      result: 'tmpfile',
    });

    // If privacy masking is requested, run expo-image-manipulator to re-process and ensure clean metadata
    if (options?.hideStartEnd) {
      try {
        const result = await manipulateAsync(
          uri,
          [],
          { format: SaveFormat.PNG, compress: 1 },
        );
        uri = result.uri;
      } catch (err) {
        console.warn('[ShareCard] Image manipulation warning:', err);
      }
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Telemetry Story Card',
        UTI: 'public.png',
      });
      return { success: true, fileUri: uri };
    }

    return {
      success: true,
      fileUri: uri,
      error: 'Direct sharing sheet is not available on this device.',
    };
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    console.error('[ShareCard] On-device capture failed:', rawMsg);

    // Provide friendly diagnostic if native view shot module is missing from current binary
    if (rawMsg.includes('NativeViewShot') || rawMsg.includes('null') || rawMsg.includes('unlinked')) {
      return {
        success: false,
        error: 'Native view capture module requires a native development build (react-native-view-shot).',
      };
    }

    return {
      success: false,
      error: 'Failed to capture telemetry card. Please try again.',
    };
  }
}

/**
 * Helper to transform GenerateRecapCardParams to StoryCardData with sensible defaults
 */
export function buildStoryCardData(
  params: GenerateRecapCardParams,
  defaultHandle: string = 'pilot',
  defaultVehicle: string = 'Slipstream Vehicle',
  defaultCountry: string = 'Kenya',
): StoryCardData {
  return {
    type: params.type,
    headline: params.headline,
    userHandle: params.userHandle || defaultHandle,
    country: params.country || defaultCountry,
    vehicleName: params.vehicleName || defaultVehicle,
    topSpeedKmh: params.topSpeedKmh ?? 0,
    avgSpeedKmh: params.avgSpeedKmh,
    elapsedMs: params.elapsedMs,
    distanceKm: (params.distanceMeters ?? 0) / 1000,
    durationSeconds: params.durationSeconds ?? 0,
    dateStr: params.dateStr,
    referralCode: params.referralCode,
    hideStartEnd: params.hideStartEnd ?? true,
    snapshotUrl: params.snapshotUrl,
  };
}
