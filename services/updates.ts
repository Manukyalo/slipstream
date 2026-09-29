import * as Updates from 'expo-updates';
import { Alert, AppState, type AppStateStatus } from 'react-native';

export interface UpdateCheckResult {
  isAvailable: boolean;
  isRollBackToEmbedded: boolean;
}

/**
 * Checks if a newer Over-The-Air (OTA) bundle is available on EAS Update.
 * Returns false silently in development/Expo Go environments where OTA updates
 * are not active.
 */
export async function checkForAppUpdate(): Promise<boolean> {
  if (__DEV__) {
    return false;
  }

  try {
    const check = await Updates.checkForUpdateAsync();
    return check.isAvailable;
  } catch (error) {
    console.warn('[UpdatesService] Check for OTA update failed:', error);
    return false;
  }
}

/**
 * Downloads the latest bundle from EAS Update and prompts the user to apply it.
 */
export async function fetchAndApplyUpdate(): Promise<boolean> {
  if (__DEV__) {
    return false;
  }

  try {
    const fetchResult = await Updates.fetchUpdateAsync();
    if (fetchResult.isNew) {
      Alert.alert(
        'Update Ready',
        'A new version of Slipstream has been downloaded over-the-air. Restart now to apply?',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Restart',
            style: 'default',
            onPress: () => {
              Updates.reloadAsync().catch((err) => {
                console.error('[UpdatesService] Reload error:', err);
              });
            },
          },
        ],
      );
      return true;
    }
  } catch (error) {
    console.warn('[UpdatesService] Failed to fetch OTA update bundle:', error);
  }

  return false;
}

/**
 * Automatically checks and applies updates on app startup or when resuming from background.
 */
export function setupAutoUpdateListener(): () => void {
  if (__DEV__) {
    return () => {};
  }

  // Initial check on load
  checkForAppUpdate().then((available) => {
    if (available) {
      fetchAndApplyUpdate();
    }
  });

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      checkForAppUpdate().then((available) => {
        if (available) {
          fetchAndApplyUpdate();
        }
      });
    }
  };

  const subscription = AppState.addEventListener('change', handleAppStateChange);
  return () => {
    subscription.remove();
  };
}
