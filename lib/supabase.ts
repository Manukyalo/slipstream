import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import type { Database } from '@/types/database';

// ---------------------------------------------------------------------------
// SecureStore adapter for Supabase session persistence
// SecureStore is the only compliant option on both iOS and Android —
// AsyncStorage is unencrypted and violates App Store security guidelines
// for auth tokens.
// ---------------------------------------------------------------------------

const SECURE_STORE_KEY_PREFIX = 'slipstream_supabase_';

const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(SECURE_STORE_KEY_PREFIX + key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(SECURE_STORE_KEY_PREFIX + key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY_PREFIX + key);
  },
};

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[DriveTrack] Missing Supabase env vars. ' +
      'Copy .env.example → .env.local and fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // React Native — no URL detection
  },
});
