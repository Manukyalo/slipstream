import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { HAZARD_CONFIG, type HazardType } from '@/services/hazards';

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
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>DROP HAZARD PIN</Text>
            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              onPress={onClose}
              disabled={submittingType !== null}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.subtitle}>
            Warn fellow drivers of road enforcement. Reports expire automatically in 3 hours.
          </Text>

          <View style={styles.optionsList}>
            {types.map((t) => {
              const cfg = HAZARD_CONFIG[t];
              const isSubmitting = submittingType === t;

              return (
                <Pressable
                  key={t}
                  style={({ pressed }) => [
                    styles.optionItem,
                    pressed && styles.optionItemPressed,
                  ]}
                  onPress={() => handleSelect(t)}
                  disabled={submittingType !== null}
                >
                  <View style={styles.iconWrap}>
                    <Text style={styles.icon}>{cfg.icon}</Text>
                  </View>

                  <View style={styles.optionDetails}>
                    <Text style={styles.optionLabel}>{cfg.label}</Text>
                    <Text style={styles.optionDesc}>{cfg.description}</Text>
                  </View>

                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={Colors.accentCyan} />
                  ) : (
                    <Text style={styles.chevron}>›</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.base,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    lineHeight: 16,
    marginBottom: Spacing.base,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeBtnText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: FontFamily.bold,
  },
  optionsList: {
    gap: Spacing.sm,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  optionItemPressed: {
    borderColor: Colors.accentCyan,
    backgroundColor: Colors.bgSurface,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  icon: {
    fontSize: 22,
  },
  optionDetails: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  optionDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: Colors.textMuted,
  },
  pressed: {
    opacity: 0.7,
  },
});
