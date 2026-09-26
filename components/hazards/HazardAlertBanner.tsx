import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { HAZARD_CONFIG, type NearbyHazard } from '@/services/hazards';

interface HazardAlertBannerProps {
  hazard: NearbyHazard;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function HazardAlertBanner({
  hazard,
  onConfirm,
  onDismiss,
}: HazardAlertBannerProps) {
  const cfg = HAZARD_CONFIG[hazard.type];
  const distanceFormatted =
    hazard.distance_meters < 1000
      ? `${Math.round(hazard.distance_meters)}m`
      : `${(hazard.distance_meters / 1000).toFixed(1)}km`;

  return (
    <View style={styles.bannerWrapper}>
      <View style={[styles.banner, { borderColor: cfg.color }]}>
        <View style={styles.topRow}>
          <View style={styles.leftInfo}>
            <View style={[styles.iconBox, { backgroundColor: `${cfg.color}25` }]}>
              <Text style={styles.icon}>{cfg.icon}</Text>
            </View>

            <View style={styles.textCol}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: cfg.color }]}>
                  {cfg.label.toUpperCase()}
                </Text>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>
                    {hazard.confirmations} VERIFIED
                  </Text>
                </View>
              </View>

              <Text style={styles.distanceText}>
                {distanceFormatted} ahead on your route
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [styles.confirmBtn, pressed && styles.pressed]}
            onPress={onConfirm}
          >
            <Text style={styles.confirmText}>✓ Still Active</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.dismissBtn, pressed && styles.pressed]}
            onPress={onDismiss}
          >
            <Text style={styles.dismissText}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerWrapper: {
    paddingHorizontal: Spacing.base,
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    zIndex: 99,
  },
  banner: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  leftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  icon: {
    fontSize: 20,
  },
  textCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.label,
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  verifiedText: {
    fontFamily: FontFamily.bold,
    fontSize: 8,
    color: Colors.accentCyan,
    letterSpacing: 0.5,
  },
  distanceText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: Colors.accentCyanDim,
    borderColor: Colors.accentCyan,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
  },
  confirmText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: Colors.accentCyan,
  },
  dismissBtn: {
    flex: 1,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dismissText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
