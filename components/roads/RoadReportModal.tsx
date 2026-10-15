import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { reportRoad, type SavedRoad } from '@/services/savedRoads';
import { toUserMessage } from '@/utils/toUserMessage';

interface RoadReportModalProps {
  visible: boolean;
  road: SavedRoad | null;
  onClose: () => void;
}

const REPORT_REASONS = [
  { id: 'private_property', label: 'Private Property / Gated' },
  { id: 'dangerous', label: 'Hazardous / Impassable' },
  { id: 'inaccurate', label: 'Inaccurate Trace / Mapping' },
  { id: 'offensive', label: 'Inappropriate Name or Content' },
  { id: 'other', label: 'Other Concern' },
];

export function RoadReportModal({ visible, road, onClose }: RoadReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('private_property');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!road) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await reportRoad(road.id, selectedReason, details);
      Alert.alert('Report Submitted', 'Thank you for keeping the Slipstream road library safe and compliant.');
      setDetails('');
      onClose();
    } catch (err) {
      const msg = toUserMessage(err);
      Alert.alert('Submission Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Report Road</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {road.name}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              hitSlop={12}
            >
              <Icon name="close" size={18} color={Colors.text.secondary} />
            </Pressable>
          </View>

          <Text style={styles.label}>SELECT REASON</Text>
          <View style={styles.reasonsList}>
            {REPORT_REASONS.map((reason) => {
              const active = selectedReason === reason.id;
              return (
                <Pressable
                  key={reason.id}
                  style={[styles.reasonItem, active && styles.reasonItemActive]}
                  onPress={() => setSelectedReason(reason.id)}
                >
                  <Icon
                    name={active ? 'check-circle' : 'info'}
                    size={16}
                    color={active ? Colors.accent.cyan : Colors.text.tertiary}
                    weight={active ? 'fill' : 'regular'}
                  />
                  <Text style={[styles.reasonText, active && styles.reasonTextActive]}>
                    {reason.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: Spacing[4] }]}>ADDITIONAL DETAILS (OPTIONAL)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Help our moderators evaluate this report..."
            placeholderTextColor={Colors.text.tertiary}
            value={details}
            onChangeText={setDetails}
            multiline
            numberOfLines={3}
            maxLength={500}
          />

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#05070D" />
              ) : (
                <Text style={styles.submitText}>Submit Report</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 13, 0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface[1],
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    padding: Spacing.screen,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing[4],
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: 20,
    color: Colors.text.primary,
  },
  sub: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface[2],
  },
  label: {
    fontFamily: FontFamily.overline,
    fontSize: 11,
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
    marginBottom: Spacing[2],
  },
  reasonsList: {
    gap: 8,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface[2],
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  reasonItemActive: {
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.tint.cyan,
  },
  reasonText: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.text.secondary,
  },
  reasonTextActive: {
    color: Colors.text.primary,
    fontFamily: FontFamily.label,
  },
  textArea: {
    backgroundColor: Colors.surface[2],
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.hairline,
    color: Colors.text.primary,
    fontFamily: FontFamily.body,
    fontSize: 14,
    padding: Spacing[3],
    height: 70,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.gap,
    marginTop: Spacing[4],
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.button,
    backgroundColor: Colors.surface[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  cancelText: {
    fontFamily: FontFamily.label,
    fontSize: 15,
    color: Colors.text.secondary,
  },
  submitBtn: {
    flex: 1.6,
    paddingVertical: 14,
    borderRadius: Radius.button,
    backgroundColor: Colors.semantic.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontFamily: FontFamily.heading,
    fontSize: 15,
    color: '#F4F7FB',
  },
  pressed: {
    opacity: 0.8,
  },
});
