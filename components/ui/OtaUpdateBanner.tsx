import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RefreshCw, Sparkles } from 'lucide-react-native';
import { Theme } from '@/constants/theme';

interface OtaUpdateBannerProps {
  onRestart: () => void;
}

export function OtaUpdateBanner({ onRestart }: OtaUpdateBannerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.left}>
          <View style={styles.iconWrap}>
            <Sparkles size={14} color={Theme.colors.signalCyan} strokeWidth={2} />
          </View>
          <View>
            <Text style={styles.title}>Update Ready</Text>
            <Text style={styles.subtitle}>New telemetry updates are downloaded</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onRestart}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Restart to apply update"
        >
          <RefreshCw size={13} color={Theme.colors.textInverse} strokeWidth={2.5} />
          <Text style={styles.btnText}>Restart</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surfaceRaised,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.signalCyan,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: Theme.radius.full,
    backgroundColor: 'rgba(52, 229, 240, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Theme.fonts.bodySemiBold,
    fontSize: 13,
    color: Theme.colors.textPrimary,
  },
  subtitle: {
    fontFamily: Theme.fonts.bodyRegular,
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginTop: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.signalCyan,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: Theme.radius.sm,
  },
  btnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.textInverse,
  },
});
