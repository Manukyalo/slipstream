import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Colors, Theme } from '@/constants/theme';
import { Spacing } from '@/constants/design';
import { HAZARD_CONFIG, type HazardType } from '@/services/hazards';

// Map hazard types to Phosphor icon names
const HAZARD_ICONS: Record<HazardType, IconName> = {
  speed_trap: 'lightning',
  camera: 'camera',
  police: 'shield',
};

// Accent colors per type (amber, cyan, danger)
const HAZARD_ACCENT_COLORS: Record<HazardType, string> = {
  speed_trap: Colors.semantic.warning,
  camera: Colors.accent.cyan,
  police: Colors.semantic.danger,
};

interface HazardReportModalProps {
  visible: boolean;
  onClose: () => void;
  onReport: (type: HazardType) => Promise<void>;
}

export function HazardReportModal({
  visible,
  onClose,
  onReport,
}: HazardReportModalProps) {
  const [submittingType, setSubmittingType] = useState<HazardType | null>(null);

  const handleSelect = async (type: HazardType) => {
    setSubmittingType(type);
    try {
      await onReport(type);
      onClose();
    } catch (err) {
      console.error('[HazardReportModal] Failed to submit report:', err);
    } finally {
      setSubmittingType(null);
    }
  };

  const types: HazardType[] = ['speed_trap', 'camera', 'police'];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* Stop propagation so tapping inside the sheet doesn't close it */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Drop hazard pin</Text>
              <Text style={styles.subtitle}>
                Warn fellow drivers. Reports expire in 3 hours.
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              onPress={onClose}
              disabled={submittingType !== null}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Icon name="close" size={16} color={Colors.text.secondary} />
            </Pressable>
          </View>

          {/* Options — flat hairline list */}
          <View style={styles.optionsList}>
            {types.map((t, idx) => {
              const cfg = HAZARD_CONFIG[t];
              const iconName = HAZARD_ICONS[t];
              const accent = HAZARD_ACCENT_COLORS[t];
              const isSubmitting = submittingType === t;
              const isLast = idx === types.length - 1;

              return (
                <Pressable
                  key={t}
                  style={({ pressed }) => [
                    styles.optionItem,
                    !isLast && styles.optionDivider,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => handleSelect(t)}
                  disabled={submittingType !== null}
                  accessibilityRole="button"
                  accessibilityLabel={cfg.label}
                >
                  {/* Icon container */}
                  <View style={[styles.iconWrap, { backgroundColor: accent + '18' }]}>
                    <Icon name={iconName} size={18} color={accent} weight="duotone" />
                  </View>

                  {/* Text */}
                  <View style={styles.optionDetails}>
                    <Text style={styles.optionLabel}>{cfg.label}</Text>
                    <Text style={styles.optionDesc}>{cfg.description}</Text>
                  </View>

                  {/* Right — spinner or chevron */}
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={accent} />
                  ) : (
                    <Icon name="caret-right" size={16} color={Colors.text.secondary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11,14,17,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Theme.colors.surfaceBorder,
    paddingBottom: Spacing['2xl'],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.colors.surfaceBorder,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.lg,
  },
  title: {
    fontFamily: Theme.fonts.bodySemiBold,
    fontSize: 17,
    color: Theme.colors.textPrimary,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: Theme.fonts.bodyRegular,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 3,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceBorder,
    marginTop: 2,
  },
  optionsList: {
    paddingHorizontal: Spacing.base,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: Theme.spacing.md,
  },
  optionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.hairline,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionDetails: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: Theme.fonts.bodySemiBold,
    fontSize: 14,
    color: Theme.colors.textPrimary,
  },
  optionDesc: {
    fontFamily: Theme.fonts.bodyRegular,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.65,
  },
});
