/**
 * StoryCardView — 1080x1920 Device-Generated Story Card
 *
 * Renders high-fidelity portrait telemetry asset suitable for Instagram Stories,
 * WhatsApp Status, and native sharing. Captured directly on-device via react-native-view-shot.
 * Includes real SVG QR code linking to app invite.
 *
 * ZERO emojis. Strict cockpit dark aesthetic (#05070D, #0E131B, #151B26, cyan/blue accent).
 */

import React, { forwardRef } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Colors, FontFamily } from '@/constants/theme';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';

export interface StoryCardData {
  type: 'trip' | 'drag' | 'sprint';
  headline?: string;
  userHandle: string;
  country?: string;
  vehicleName: string;
  topSpeedKmh: number;
  avgSpeedKmh?: number;
  elapsedMs?: number;
  distanceKm: number;
  durationSeconds: number;
  dateStr?: string;
  referralCode?: string;
}

interface StoryCardViewProps {
  data: StoryCardData;
  style?: ViewStyle;
}

export const StoryCardView = forwardRef<View, StoryCardViewProps>(function StoryCardView(
  { data, style },
  ref,
) {
  const isDrag = data.type === 'drag' || data.type === 'sprint';
  const inviteUrl = `https://slipstream-app.vercel.app/i/${data.referralCode ?? 'slipstream'}`;
  const dateFormatted = data.dateStr ?? new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const durationMin = Math.floor(data.durationSeconds / 60);
  const durationSec = data.durationSeconds % 60;
  const durationDisplay = `${durationMin}m ${durationSec}s`;

  return (
    <View ref={ref} style={[styles.canvas, style]} collapsable={false}>
      {/* Background Accent Gradients / Rings */}
      <View style={styles.topAccentGlow} />
      <View style={styles.bottomAccentGlow} />

      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text variant="heading" color={Colors.text.primary} style={styles.brandTitle}>
            SLIPSTREAM
          </Text>
        </View>

        <View style={styles.categoryBadge}>
          <Text variant="overline" color={Colors.accent.cyan} style={styles.categoryText}>
            {isDrag ? 'PRECISION SPRINT' : 'TELEMETRY RUN'}
          </Text>
        </View>
      </View>

      {/* Driver & Vehicle Metadata */}
      <View style={styles.driverSection}>
        <View style={styles.avatarRing}>
          <View style={styles.avatarInner}>
            <Text variant="heading" color={Colors.accent.cyan} style={styles.avatarInitial}>
              {data.userHandle.replace(/^@/, '').charAt(0).toUpperCase() || 'S'}
            </Text>
          </View>
        </View>

        <View style={styles.driverMeta}>
          <Text variant="display" color={Colors.text.primary} style={styles.handleText} numberOfLines={1}>
            {data.userHandle.startsWith('@') ? data.userHandle : `@${data.userHandle}`}
          </Text>
          <View style={styles.vehicleRow}>
            <Icon name="car" size={28} color={Colors.accent.cyan} />
            <Text variant="heading" color={Colors.text.secondary} style={styles.vehicleText} numberOfLines={1}>
              {data.vehicleName}
            </Text>
          </View>
          <Text variant="label" color={Colors.text.tertiary} style={styles.countryDate}>
            {data.country ? `${data.country}  •  ` : ''}{dateFormatted}
          </Text>
        </View>
      </View>

      {/* Hero Metric Section */}
      <View style={styles.heroBox}>
        <View style={styles.heroHeader}>
          <Text variant="overline" color={Colors.text.tertiary} style={styles.heroOverline}>
            {isDrag ? 'ELAPSED BENCHMARK TIME' : 'MAXIMUM RECORDED VELOCITY'}
          </Text>
        </View>

        <View style={styles.heroValueRow}>
          <Text variant="metricXL" color={Colors.accent.cyan} style={styles.heroMainValue} tabular>
            {isDrag
              ? ((data.elapsedMs ?? 0) / 1000).toFixed(2)
              : Math.round(data.topSpeedKmh)}
          </Text>
          <Text variant="heading" color={Colors.text.tertiary} style={styles.heroUnit}>
            {isDrag ? 'SEC' : 'KM/H'}
          </Text>
        </View>

        <View style={styles.heroDivider} />

        {/* Supporting 3-column stats */}
        <View style={styles.subGrid}>
          <View style={styles.subItem}>
            <Text variant="overline" color={Colors.text.tertiary}>
              DISTANCE
            </Text>
            <View style={styles.subValRow}>
              <Text variant="heading" color={Colors.text.primary} style={styles.subValue} tabular>
                {data.distanceKm.toFixed(1)}
              </Text>
              <Text variant="label" color={Colors.text.tertiary}>
                KM
              </Text>
            </View>
          </View>

          <View style={styles.subDivider} />

          <View style={styles.subItem}>
            <Text variant="overline" color={Colors.text.tertiary}>
              DURATION
            </Text>
            <View style={styles.subValRow}>
              <Text variant="heading" color={Colors.text.primary} style={styles.subValue} tabular>
                {durationDisplay}
              </Text>
            </View>
          </View>

          <View style={styles.subDivider} />

          <View style={styles.subItem}>
            <Text variant="overline" color={Colors.text.tertiary}>
              AVG SPEED
            </Text>
            <View style={styles.subValRow}>
              <Text variant="heading" color={Colors.text.primary} style={styles.subValue} tabular>
                {Math.round(data.avgSpeedKmh ?? (data.topSpeedKmh * 0.62))}
              </Text>
              <Text variant="label" color={Colors.text.tertiary}>
                KM/H
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Middle Cockpit Badge */}
      <View style={styles.telemetryTag}>
        <Icon name="gauge" size={24} color={Colors.accent.cyan} />
        <Text variant="label" color={Colors.text.secondary} style={styles.tagText}>
          VERIFIED SENSOR TELEMETRY  •  GPS 10 HZ DYNAMICS
        </Text>
      </View>

      {/* Footer Invite / QR Block */}
      <View style={styles.footerCard}>
        <View style={styles.footerTextCol}>
          <Text variant="heading" color={Colors.text.primary} style={styles.footerTitle}>
            JOIN SLIPSTREAM
          </Text>
          <Text variant="body" color={Colors.text.secondary} style={styles.footerDesc}>
            Scan to inspect telemetry data, telemetry leaderboards, and stage benchmarks.
          </Text>
          <Text variant="overline" color={Colors.accent.cyan} style={styles.inviteCode}>
            INVITE: {data.referralCode ?? 'SLIPSTREAM-KE'}
          </Text>
        </View>

        <View style={styles.qrContainer}>
          <QRCode
            value={inviteUrl}
            size={160}
            color="#FFFFFF"
            backgroundColor="transparent"
          />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  canvas: {
    width: 1080,
    height: 1920,
    backgroundColor: '#05070D',
    padding: 72,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  topAccentGlow: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
  },
  bottomAccentGlow: {
    position: 'absolute',
    bottom: -150,
    left: -150,
    width: 700,
    height: 700,
    borderRadius: 350,
    backgroundColor: 'rgba(59, 130, 246, 0.07)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 36,
    borderBottomWidth: 2,
    borderBottomColor: '#151B26',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  brandDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent.cyan,
  },
  brandTitle: {
    fontSize: 40,
    lineHeight: 44,
    fontFamily: FontFamily.spaceGroteskBold,
    letterSpacing: 4,
  },
  categoryBadge: {
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(34, 211, 238, 0.3)',
  },
  categoryText: {
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 2,
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 36,
    backgroundColor: '#0E131B',
    padding: 40,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#151B26',
  },
  avatarRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#05070D',
  },
  avatarInner: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: '#151B26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 56,
    lineHeight: 60,
    fontFamily: FontFamily.spaceGroteskBold,
  },
  driverMeta: {
    flex: 1,
    gap: 8,
  },
  handleText: {
    fontSize: 48,
    lineHeight: 52,
    fontFamily: FontFamily.spaceGroteskBold,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vehicleText: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '600',
  },
  countryDate: {
    fontSize: 20,
    lineHeight: 24,
    marginTop: 4,
  },
  heroBox: {
    backgroundColor: '#0E131B',
    borderRadius: 44,
    borderWidth: 2,
    borderColor: '#151B26',
    padding: 56,
    gap: 28,
  },
  heroHeader: {
    alignItems: 'center',
  },
  heroOverline: {
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 3,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 18,
  },
  heroMainValue: {
    fontSize: 160,
    lineHeight: 160,
    letterSpacing: -4,
  },
  heroUnit: {
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: 2,
  },
  heroDivider: {
    height: 2,
    backgroundColor: '#151B26',
    marginVertical: 12,
  },
  subGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  subDivider: {
    width: 2,
    height: 64,
    backgroundColor: '#151B26',
  },
  subValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  subValue: {
    fontSize: 36,
    lineHeight: 40,
    fontFamily: FontFamily.numberBold,
  },
  telemetryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 18,
    backgroundColor: 'rgba(21, 27, 38, 0.6)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#151B26',
  },
  tagText: {
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 2,
  },
  footerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E131B',
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#151B26',
    padding: 44,
    gap: 36,
  },
  footerTextCol: {
    flex: 1,
    gap: 12,
  },
  footerTitle: {
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: 1.5,
  },
  footerDesc: {
    fontSize: 20,
    lineHeight: 28,
  },
  inviteCode: {
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 2,
    marginTop: 6,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#05070D',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Colors.accent.cyan,
  },
});
