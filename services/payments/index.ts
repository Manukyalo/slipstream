/**
 * Payment Provider Registry
 *
 * Directs users to the appropriate payment provider based on country / region.
 * Never hard-codes a provider.
 */

import { darajaProvider } from './darajaProvider';
import { stripeProvider } from './stripeProvider';
import type { PaymentProvider, PaymentTier } from './types';

export * from './types';
export * from './catalog';

export const ALL_PAYMENT_PROVIDERS: PaymentProvider[] = [darajaProvider, stripeProvider];

export function getPaymentProviderForRegion(countryOrRegion?: string | null): PaymentProvider {
  if (darajaProvider.isAvailableForRegion(countryOrRegion)) {
    return darajaProvider;
  }
  return stripeProvider;
}

export function getAvailableTiersForRegion(countryOrRegion?: string | null): PaymentTier[] {
  const provider = getPaymentProviderForRegion(countryOrRegion);
  return provider.getTiers(countryOrRegion);
}

/**
 * Generate a cryptographically random RFC4122 v4 UUID idempotency key.
 */
export function generatePaymentIdempotencyKey(userId: string, tierId: string): string {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `pay_${userId.slice(0, 8)}_${tierId}_${timestamp}_${randomPart}`;
}
