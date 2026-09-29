import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { supabase } from '@/lib/supabase';

export interface GenerateRecapCardParams {
  type: 'trip' | 'drag' | 'sprint';
  id?: string;
  headline?: string;
  vehicleName?: string;
  topSpeedKmh?: number;
  elapsedMs?: number;
  distanceMeters?: number;
  durationSeconds?: number;
  referralCode?: string;
  routePoints?: [number, number][];
}

export interface ShareCardResult {
  success: boolean;
  error?: string;
  fileUri?: string;
}

/**
 * Invokes the server-side generate-recap-card edge function, saves the 1080x1920
 * story card SVG to the local file system, and triggers the native OS Share sheet.
 */
export async function generateAndShareRecapCard(
  params: GenerateRecapCardParams,
): Promise<ShareCardResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      return { success: false, error: 'User is not authenticated' };
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-recap-card`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Server error');
      throw new Error(`Failed to generate story card (${response.status}): ${errText}`);
    }

    const svgContent = await response.text();
    if (!svgContent || !svgContent.includes('<svg')) {
      throw new Error('Invalid SVG response received from server');
    }

    // Save SVG file to local cache
    const filename = `slipstream_recap_${Date.now()}.svg`;
    const targetUri = `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(targetUri, svgContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(targetUri, {
        mimeType: 'image/svg+xml',
        dialogTitle: 'Share Slipstream Recap Card',
        UTI: 'public.svg-image',
      });
      return { success: true, fileUri: targetUri };
    }

    return {
      success: true,
      fileUri: targetUri,
      error: 'Direct native file sharing not available on this device',
    };
  } catch (err: unknown) {
    console.error('[ShareCard] Generation or sharing failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown share card error';
    return { success: false, error: message };
  }
}
