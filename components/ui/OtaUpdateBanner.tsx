import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

interface OtaUpdateBannerProps {
  onRestart: () => void;
}

export function OtaUpdateBanner({ onRestart }: OtaUpdateBannerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.contentRow}>
          <View style={styles.iconWrap}>
            <Icon name="sparkle" size={16} color={Colors.accent.cyan} weight="duotone" />
          </View>
          <View style={styles.textGroup}>
            <Text style={styles.title} numberOfLines={1}>
              Update Ready
            </Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              New telemetry updates downloaded
            </Text>
          </View>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onRestart}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Restart to apply update"
          >
            <Icon name="refresh" size={13} color={Colors.text.inverse} weight="bold" />
            <Text style={styles.btnText}>Restart</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 54,
    left: Spacing.screen,
    right: Spacing.screen,
    zIndex: 9999,
    shadowColor: Colors.bg.base,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  inner: {
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[3],
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent.cyanGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: 13,
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 2,
    lineHeight: 15,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
    backgroundColor: Colors.accent.cyan,
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.button,
  },
  btnText: {
    fontFamily: FontFamily.heading,
    fontSize: 12,
    color: Colors.text.inverse,
  },
});
