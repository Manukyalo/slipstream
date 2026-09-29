import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'slipstream_biometrics_enabled_v1';

export interface BiometricCapabilities {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
}

export async function checkBiometricCapabilities(): Promise<BiometricCapabilities> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return { hasHardware, isEnrolled, supportedTypes };
  } catch (err) {
    console.warn('[Biometrics] Error checking biometric hardware:', err);
    return { hasHardware: false, isEnrolled: false, supportedTypes: [] };
  }
}

export async function isBiometricLockEnabled(): Promise<boolean> {
  try {
    const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return enabled === 'true';
  } catch {
    return false;
  }
}

export async function setBiometricLockEnabled(enabled: boolean): Promise<boolean> {
  try {
    if (enabled) {
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
    } else {
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    }
    return true;
  } catch (err) {
    console.warn('[Biometrics] Error toggling biometric setting:', err);
    return false;
  }
}

export async function authenticateWithBiometrics(promptMessage: string = 'Unlock Slipstream'): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use Passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch (err) {
    console.warn('[Biometrics] Authentication error:', err);
    return false;
  }
}
