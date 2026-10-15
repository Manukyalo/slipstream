/**
 * Payment System Types & Interface
 *
 * Implements Google L6 / Payment Integrity standard:
 *  - State machine: pending -> processing -> succeeded | failed | refunded
 *  - Idempotency everywhere: unique client idempotency keys
 *  - All money in integer cents (lowest currency denomination)
 *  - Provider agnostic interface
 */

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

export type PaymentTierId = 'enthusiast' | 'legend';

export type Currency = 'KES' | 'USD';

export type PaymentProviderId = 'mpesa_daraja' | 'stripe_card';

export interface PaymentTier {
  id: PaymentTierId;
  name: string;
  tagline: string;
  description: string;
  amountCents: number;
  displayPrice: string;
  currency: Currency;
  badge: string;
  perks: string[];
}

export interface PaymentInitiationParams {
  tierId: PaymentTierId;
  userId: string;
  userPhone?: string;
  idempotencyKey: string;
  userEmail?: string;
}

export interface PaymentInitiationResult {
  success: boolean;
  paymentId: string;
  status: PaymentStatus;
  providerTxId?: string;
  message: string;
  requiresUserInput?: boolean;
}

export interface PaymentProvider {
  id: PaymentProviderId;
  displayName: string;
  iconName: 'lightning' | 'shield';
  isAvailableForRegion: (countryOrRegion?: string | null) => boolean;
  getTiers: (countryOrRegion?: string | null) => PaymentTier[];
  initiatePayment: (params: PaymentInitiationParams) => Promise<PaymentInitiationResult>;
  pollStatus: (paymentId: string) => Promise<{ status: PaymentStatus; message?: string }>;
}
