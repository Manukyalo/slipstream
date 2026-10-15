/**
 * Payment Tier Catalog — Source of truth for pricing and supporter badges.
 *
 * Rules:
 *  - Amounts in integer cents only (no floating point currency).
 *  - Currency explicitly tied to tier and region.
 */

import type { PaymentTier, Currency } from './types';

export const KENYA_TIERS: PaymentTier[] = [
  {
    id: 'enthusiast',
    name: 'Enthusiast',
    tagline: 'Fuel the Engine',
    description: 'Keep map tiles fast and telemetry servers running independent of corporate ads.',
    amountCents: 50000, // 500 KES (50,000 cents)
    displayPrice: 'KES 500',
    currency: 'KES',
    badge: 'Enthusiast',
    perks: ['Supporter profile badge', 'High-res story cards', 'Support indie telemetry development'],
  },
  {
    id: 'legend',
    name: 'Legend',
    tagline: 'Trackside Patron',
    description: 'Full season support with high-octane golden badge and custom leaderboards tribute.',
    amountCents: 150000, // 1500 KES (150,000 cents)
    displayPrice: 'KES 1,500',
    currency: 'KES',
    badge: 'Legend',
    perks: [
      'Golden Legend badge',
      'Early access to circuit telemetry',
      'Permanent tribute in app credits',
      'All Enthusiast perks',
    ],
  },
];

export const GLOBAL_TIERS: PaymentTier[] = [
  {
    id: 'enthusiast',
    name: 'Enthusiast',
    tagline: 'Fuel the Engine',
    description: 'Keep map tiles fast and telemetry servers running independent of corporate ads.',
    amountCents: 500, // $5.00 (500 cents)
    displayPrice: '$5',
    currency: 'USD',
    badge: 'Enthusiast',
    perks: ['Supporter profile badge', 'High-res story cards', 'Support indie telemetry development'],
  },
  {
    id: 'legend',
    name: 'Legend',
    tagline: 'Trackside Patron',
    description: 'Full season support with high-octane golden badge and custom leaderboards tribute.',
    amountCents: 1500, // $15.00 (1500 cents)
    displayPrice: '$15',
    currency: 'USD',
    badge: 'Legend',
    perks: [
      'Golden Legend badge',
      'Early access to circuit telemetry',
      'Permanent tribute in app credits',
      'All Enthusiast perks',
    ],
  },
];

export function getTiersForCurrency(currency: Currency): PaymentTier[] {
  return currency === 'KES' ? KENYA_TIERS : GLOBAL_TIERS;
}
