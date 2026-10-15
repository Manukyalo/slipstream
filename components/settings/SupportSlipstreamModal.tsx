/**
 * SupportSlipstreamModal — Regional supporter tiers with payment provider integration
 *
 * Implements:
 *  - PaymentProvider interface (Daraja M-Pesa for Kenya, Stripe Cards for Global)
 *  - Two premium tiers: Enthusiast and Legend
 *  - Supporter badge awarded on confirmed payment
 *  - Polling / verification status handling
 *  - Theme tokens only, Phosphor icons, no emojis
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPaymentProviderForRegion,
  generatePaymentIdempotencyKey,
  type PaymentTier,
  type PaymentStatus,
} from '@/services/payments';

interface SupportSlipstreamModalProps {
  visible: boolean;
  onClose: () => void;
  country?: string | null;
}

export function SupportSlipstreamModal({
  visible,
  onClose,
  country = 'Kenya',
}: SupportSlipstreamModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const provider = getPaymentProviderForRegion(country);
  const tiers = provider.getTiers(country);

  const [selectedTier, setSelectedTier] = useState<PaymentTier | null>(null);
  const [phone, setPhone] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isMpesa = provider.id === 'mpesa_daraja';

  const handleSelectTier = (tier: PaymentTier) => {
    setSelectedTier(tier);
    setStatusMessage(null);
    setPaymentStatus(null);
  };

  const handleInitiate = async () => {
    if (!selectedTier || !user) return;

    if (isMpesa && !phone.trim()) {
      Alert.alert('Phone Number Required', 'Please enter your Safaricom M-Pesa phone number.');
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const idempotencyKey = generatePaymentIdempotencyKey(user.id, selectedTier.id);

      const res = await provider.initiatePayment({
        tierId: selectedTier.id,
        userId: user.id,
        userPhone: phone.trim(),
        userEmail: user.email,
        idempotencyKey,
      });

      setStatusMessage(res.message);
      setPaymentStatus(res.status);

      if (res.paymentId) {
        // Poll status for 45 seconds or until resolved
        let elapsed = 0;
        const interval = setInterval(async () => {
          elapsed += 3;
          const check = await provider.pollStatus(res.paymentId);
          if (check.status === 'succeeded') {
            clearInterval(interval);
            setPaymentStatus('succeeded');
            setStatusMessage('Support contribution confirmed! Supporter badge activated.');
            setIsProcessing(false);
            await refreshProfile();
          } else if (check.status === 'failed') {
            clearInterval(interval);
            setPaymentStatus('failed');
            setStatusMessage(check.message ?? 'Payment failed or was cancelled.');
            setIsProcessing(false);
          } else if (elapsed > 45) {
            clearInterval(interval);
            setIsProcessing(false);
            setStatusMessage('Waiting for provider callback. Your badge will update automatically once verified.');
          }
        }, 3000);
      } else {
        setIsProcessing(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initiate payment.';
      setStatusMessage(msg);
      setPaymentStatus('failed');
      setIsProcessing(false);
    }
  };

  const currentBadge = profile?.supporter_badge;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text variant="heading" color={Colors.text.primary}>
                Support Slipstream
              </Text>
              <Text variant="label" color={Colors.text.tertiary}>
                Independent Telemetry & Track Engine
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Icon name="close" size={20} color={Colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Active Supporter Badge Banner */}
            {currentBadge && (
              <View style={styles.activeBadgeBanner}>
                <Icon name="seal-check" size={20} color={Colors.accent.cyan} weight="fill" />
                <Text variant="body" color={Colors.text.primary}>
                  Active Supporter: <Text variant="body" color={Colors.accent.cyan}>{currentBadge}</Text>
                </Text>
              </View>
            )}

            <Text variant="body" color={Colors.text.secondary} style={styles.introDesc}>
              Slipstream is built for pure driving without corporate ads or track-day paywalls.
              Voluntary contributions keep MapTiler tiles rendered and telemetry servers screaming fast.
            </Text>

            {/* Two Support Tier Cards */}
            <View style={styles.tiersContainer}>
              {tiers.map((tier) => {
                const isSelected = selectedTier?.id === tier.id;
                const isLegend = tier.id === 'legend';
                return (
                  <Pressable
                    key={tier.id}
                    onPress={() => handleSelectTier(tier)}
                    style={[
                      styles.tierCard,
                      isSelected && styles.tierCardSelected,
                      isLegend && styles.legendTierCard,
                    ]}
                  >
                    <View style={styles.tierHeader}>
                      <View style={styles.tierTitleWrap}>
                        <View style={styles.tierIconBadge}>
                          <Icon
                            name={isLegend ? 'trophy' : 'lightning'}
                            size={18}
                            color={isLegend ? Colors.semantic.warning : Colors.accent.cyan}
                            weight="fill"
                          />
                        </View>
                        <View>
                          <Text variant="title" color={Colors.text.primary}>
                            {tier.name}
                          </Text>
                          <Text variant="label" color={Colors.text.tertiary}>
                            {tier.tagline}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.priceBox}>
                        <Text
                          variant="heading"
                          color={isLegend ? Colors.semantic.warning : Colors.accent.cyan}
                          style={styles.priceText}
                        >
                          {tier.displayPrice}
                        </Text>
                      </View>
                    </View>

                    <Text variant="body" color={Colors.text.secondary} style={styles.tierDescription}>
                      {tier.description}
                    </Text>

                    <View style={styles.perksList}>
                      {tier.perks.map((perk, idx) => (
                        <View key={idx} style={styles.perkRow}>
                          <Icon name="check" size={14} color={Colors.semantic.success} />
                          <Text variant="label" color={Colors.text.primary}>
                            {perk}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Provider and Phone Details */}
            {selectedTier && (
              <View style={styles.paymentSection}>
                <View style={styles.providerInfoRow}>
                  <Icon name={provider.iconName} size={18} color={Colors.accent.cyan} />
                  <Text variant="label" color={Colors.text.secondary}>
                    Payment via {provider.displayName}
                  </Text>
                </View>

                {isMpesa && (
                  <View style={styles.phoneInputBox}>
                    <Text variant="label" color={Colors.text.tertiary}>
                      SAFARICOM M-PESA NUMBER
                    </Text>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="e.g. 0712345678"
                      placeholderTextColor={Colors.text.tertiary}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                )}

                {/* Status Message */}
                {statusMessage && (
                  <View
                    style={[
                      styles.statusBox,
                      paymentStatus === 'succeeded' && styles.statusSuccess,
                      paymentStatus === 'failed' && styles.statusFailed,
                    ]}
                  >
                    {isProcessing && <ActivityIndicator size="small" color={Colors.accent.cyan} />}
                    <Text
                      variant="label"
                      color={
                        paymentStatus === 'succeeded'
                          ? Colors.semantic.success
                          : paymentStatus === 'failed'
                          ? Colors.semantic.danger
                          : Colors.text.primary
                      }
                      style={styles.statusText}
                    >
                      {statusMessage}
                    </Text>
                  </View>
                )}

                {/* Confirm Action Button */}
                <Button
                  variant="primary"
                  onPress={handleInitiate}
                  loading={isProcessing}
                  style={styles.confirmBtn}
                >
                  {isMpesa
                    ? `Send M-Pesa STK (${selectedTier.displayPrice})`
                    : `Proceed to Card Payment (${selectedTier.displayPrice})`}
                </Button>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 13, 0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: Colors.surface['1'],
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  closeBtn: {
    padding: Spacing[2],
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.iconChip,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.screen,
    gap: Spacing[4],
  },
  activeBadgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    padding: Spacing[3],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
  },
  introDesc: {
    lineHeight: 22,
  },
  tiersContainer: {
    gap: Spacing[3],
  },
  tierCard: {
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.card,
    padding: Spacing.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    gap: Spacing[3],
  },
  tierCardSelected: {
    borderColor: Colors.accent.cyan,
    backgroundColor: 'rgba(34, 211, 238, 0.05)',
  },
  legendTierCard: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  tierIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface['3'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceBox: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontFamily: FontFamily.numberBold,
    fontSize: 20,
  },
  tierDescription: {
    lineHeight: 20,
    fontSize: 14,
  },
  perksList: {
    gap: Spacing[1],
    paddingTop: Spacing[1],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  paymentSection: {
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.card,
    padding: Spacing.card,
    gap: Spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    marginTop: Spacing[2],
  },
  providerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  phoneInputBox: {
    gap: Spacing[2],
  },
  phoneInput: {
    height: 50,
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.button,
    paddingHorizontal: Spacing[4],
    color: Colors.text.primary,
    fontFamily: FontFamily.numberRegular,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.surface['1'],
    padding: Spacing[3],
    borderRadius: Radius.card,
  },
  statusSuccess: {
    borderColor: Colors.semantic.success,
    borderWidth: 1,
  },
  statusFailed: {
    borderColor: Colors.semantic.danger,
    borderWidth: 1,
  },
  statusText: {
    flex: 1,
    lineHeight: 18,
  },
  confirmBtn: {
    marginTop: Spacing[1],
  },
});
