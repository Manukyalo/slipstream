import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
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
              <Icon name={cfg.icon} size={20} color={cfg.color} weight="fill" />
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
            accessibilityRole="button"
            accessibilityLabel="Confirm hazard is still active"
          >
            <View style={styles.btnRow}>
              <Icon name="check" size={14} color={Colors.semantic.success} weight="bold" />
              <Text style={styles.confirmText}>Still Active</Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.dismissBtn, pressed && styles.pressed]}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss hazard alert"
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
    paddingHorizontal: Spacing.screen,
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    zIndex: 99,
  },
  banner: {
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1.5,
    padding: Spacing.gap,
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
    marginBottom: Spacing[2],
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
    marginRight: Spacing.gap,
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
    gap: Spacing[1],
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    backgroundColor: Colors.surface['2'],
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  verifiedText: {
    fontFamily: FontFamily.display,
    fontSize: 8,
    color: Colors.accent.cyan,
    letterSpacing: 0.5,
  },
  distanceText: {
    fontFamily: FontFamily.label,
    fontSize: 12,
    color: Colors.text.primary,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingTop: Spacing[1],
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: Colors.tint.cyan,
    borderColor: Colors.accent.cyan,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: Spacing[1],
    alignItems: 'center',
  },
  confirmText: {
    fontFamily: FontFamily.heading,
    fontSize: 12,
    color: Colors.accent.cyan,
  },
  dismissBtn: {
    flex: 1,
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.sm,
    paddingVertical: Spacing[1],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  dismissText: {
    fontFamily: FontFamily.label,
    fontSize: 12,
    color: Colors.text.secondary,
  },
  pressed: {
    opacity: 0.7,
  },
});

