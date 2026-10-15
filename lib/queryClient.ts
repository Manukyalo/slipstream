/**
 * TanStack Query client configuration
 *
 * - staleTime: 60s — data considered fresh for 1 minute
 * - gcTime: 10min — unused cache cleared after 10 minutes
 * - retry: up to 2 times, only on network errors (not 4xx)
 * - throwOnError: false — callers handle errors with isError state
 */

import { QueryClient } from '@tanstack/react-query';

function shouldRetry(failureCount: number, error: unknown): boolean {
  // Never retry client errors (4xx) — retrying won't help
  if (error instanceof Error && 'status' in error) {
    const status = (error as Error & { status: number }).status;
    if (status >= 400 && status < 500) return false;
  }
  // Retry up to twice on network/server errors
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:    60 * 1000,      // 1 minute
      gcTime:       10 * 60 * 1000, // 10 minutes
      retry:        shouldRetry,
      throwOnError: false,
    },
    mutations: {
      retry:        false, // Never auto-retry mutations — could cause duplicates
      throwOnError: false,
    },
  },
});
