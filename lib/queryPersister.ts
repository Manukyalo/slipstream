/**
 * TanStack Query persisted cache
 *
 * Caches query results to AsyncStorage so the app shows
 * stale data instantly on relaunch, even while revalidating.
 *
 * Max age: 24 hours. Serialized as JSON.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

export const asyncStoragePersister = createAsyncStoragePersister({
  storage:    AsyncStorage,
  key:        'slipstream-query-cache',
  throttleTime: 1000, // Max one write per second to avoid thrashing storage
});
