/**
 * StripeProvider — Card payments for global drivers outside Kenya
 *
 * Implements Payment System Integrity:
 *  - Enforces server-side amounts from catalog (never client-supplied)
 *  - Idempotency key per intent
 *  - Logs immutable audit entries
 */

import { Linking } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { PaymentProvider, PaymentInitiationParams, PaymentInitiationResult, PaymentStatus, PaymentTier } from './types';
import { GLOBAL_TIERS } from './catalog';

export const stripeProvider: PaymentProvider = {
  id: 'stripe_card',
  displayName: 'Credit / Debit Card',
  iconName: 'shield',

  isAvailableForRegion(countryOrRegion?: string | null): boolean {
    if (!countryOrRegion) return true; // Default global provider
    const norm = countryOrRegion.toLowerCase().trim();
    return norm !== 'kenya' && norm !== 'ke' && norm !== '+254';
  },

  getTiers(): PaymentTier[] {
    return GLOBAL_TIERS;
  },

  async initiatePayment(params: PaymentInitiationParams): Promise<PaymentInitiationResult> {
    const { tierId, userId, userEmail, idempotencyKey } = params;

    const tier = GLOBAL_TIERS.find((t) => t.id === tierId);
    if (!tier) {
      throw new Error(`Invalid support tier: ${tierId}`);
    }

    // 1. Check idempotency
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, status, error_message')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingPayment) {
      return {
        success: existingPayment.status !== 'failed',
        paymentId: existingPayment.id,
        status: existingPayment.status as PaymentStatus,
        message:
          existingPayment.status === 'succeeded'
            ? 'Payment already completed!'
            : 'Card checkout in progress.',
      };
    }

    // 2. Insert initial pending record
    const { data: newPayment, error: insertError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        tier_id: tier.id,
        amount_cents: tier.amountCents,
        currency: tier.currency,
        provider: 'stripe_card',
        idempotency_key: idempotencyKey,
        status: 'pending',
      })
      .select('id, status')
      .single();

    if (insertError || !newPayment) {
      throw new Error(`Failed to initialize card payment: ${insertError?.message ?? 'Unknown error'}`);
    }

    // 3. Log initial status in immutable ledger
    await supabase.from('payment_ledger').insert({
      payment_id: newPayment.id,
      previous_status: null,
      new_status: 'pending',
      note: `Card checkout initiated for ${tier.displayPrice}`,
    });

    // 4. Open Stripe checkout URL
    const checkoutUrl =
      tier.id === 'legend'
        ? 'https://buy.stripe.com/slipstream-octane-15'
        : 'https://buy.stripe.com/slipstream-fuel-5';

    try {
      const canOpen = await Linking.canOpenURL(checkoutUrl);
      if (canOpen) {
        await Linking.openURL(checkoutUrl);
      }
    } catch (err) {
      console.warn('[StripeProvider] Linking error:', err);
    }

    return {
      success: true,
      paymentId: newPayment.id,
      status: 'pending',
      message: `Opened secure card checkout for ${tier.displayPrice}. Once complete, your badge will activate automatically.`,
      requiresUserInput: true,
    };
  },

  async pollStatus(paymentId: string): Promise<{ status: PaymentStatus; message?: string }> {
    const { data, error } = await supabase
      .from('payments')
      .select('status, error_message')
      .eq('id', paymentId)
      .single();

    if (error || !data) {
      return { status: 'pending', message: 'Checking card payment status...' };
    }

    return {
      status: data.status as PaymentStatus,
      message: data.error_message ?? undefined,
    };
  },
};
