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
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import {
  createMaintenanceLog,
  MAINTENANCE_TYPE_ICONS,
  MAINTENANCE_TYPE_LABELS,
  type CreateMaintenanceLogInput,
  type MaintenanceType,
} from '@/services/maintenance';

const MAINTENANCE_TYPES: MaintenanceType[] = [
  'oil_change',
  'tires',
  'brakes',
  'battery',
  'inspection',
  'other',
];

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** Validate a YYYY-MM-DD string */
function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

interface AddMaintenanceModalProps {
  visible: boolean;
  vehicleId: string;
  vehicleName?: string;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  type: MaintenanceType;
  description: string;
  odometer: string;
  cost: string;
  serviceDate: string;
  nextDueDate: string;
}

const INITIAL_FORM: FormState = {
  type: 'oil_change',
  description: '',
  odometer: '',
  cost: '',
  serviceDate: todayISO(),
  nextDueDate: '',
};

export function AddMaintenanceModal({
  visible,
  vehicleId,
  vehicleName,
  onClose,
  onSaved,
}: AddMaintenanceModalProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const handleSave = async () => {
    // Client-side validation
    if (!form.description.trim()) {
      Alert.alert('Missing Info', 'Please enter a description for the service.');
      return;
    }
    const odo = Number(form.odometer);
    if (!form.odometer || isNaN(odo) || odo < 0) {
      Alert.alert('Invalid Odometer', 'Enter a valid odometer reading (km/miles).');
      return;
    }
    const cost = Number(form.cost);
    if (form.cost !== '' && (isNaN(cost) || cost < 0)) {
      Alert.alert('Invalid Cost', 'Enter a valid service cost (or leave blank for $0).');
      return;
    }
    if (!isValidDate(form.serviceDate)) {
      Alert.alert('Invalid Date', 'Service date must be in YYYY-MM-DD format.');
      return;
    }
    if (form.nextDueDate && !isValidDate(form.nextDueDate)) {
      Alert.alert('Invalid Date', 'Next due date must be in YYYY-MM-DD format.');
      return;
    }

    const payload: CreateMaintenanceLogInput = {
      vehicleId,
      vehicleName,
      type: form.type,
      description: form.description.trim(),
      odometer: odo,
      cost: form.cost === '' ? 0 : cost,
      serviceDate: form.serviceDate,
      nextDueDate: form.nextDueDate || null,
    };

    setIsSaving(true);
    try {
      await createMaintenanceLog(payload);
      setForm(INITIAL_FORM);
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      Alert.alert('Save Failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setForm(INITIAL_FORM);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            onPress={handleClose}
            hitSlop={8}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Log Service</Text>
          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed, isSaving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Service Type Picker */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>SERVICE TYPE</Text>
            <View style={styles.typePicker}>
              {MAINTENANCE_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={({ pressed }) => [
                    styles.typeChip,
                    form.type === t && styles.typeChipActive,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => updateField('type', t)}
                >
                  <Text style={styles.typeChipIcon}>{MAINTENANCE_TYPE_ICONS[t]}</Text>
                  <Text
                    style={[
                      styles.typeChipText,
                      form.type === t && styles.typeChipTextActive,
                    ]}
                    numberOfLines={2}
                  >
                    {MAINTENANCE_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>DESCRIPTION *</Text>
            <TextInput
              style={styles.input}
              value={form.description}
              onChangeText={(v) => updateField('description', v)}
              placeholder="e.g. Synthetic 5W-30 oil change + filter"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="next"
              maxLength={200}
            />
          </View>

          {/* Odometer + Cost row */}
          <View style={styles.rowFields}>
            <View style={[styles.fieldGroup, styles.halfField]}>
              <Text style={styles.fieldLabel}>ODOMETER (km) *</Text>
              <TextInput
                style={styles.input}
                value={form.odometer}
                onChangeText={(v) => updateField('odometer', v.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 42500"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                returnKeyType="next"
                maxLength={9}
              />
            </View>

            <View style={[styles.fieldGroup, styles.halfField]}>
              <Text style={styles.fieldLabel}>COST ($)</Text>
              <TextInput
                style={styles.input}
                value={form.cost}
                onChangeText={(v) => {
                  // Allow decimals up to 2dp
                  const cleaned = v.replace(/[^0-9.]/g, '');
                  const parts = cleaned.split('.');
                  const sanitized =
                    parts.length > 2
                      ? `${parts[0]}.${parts.slice(1).join('')}`
                      : parts[1]?.length > 2
                        ? `${parts[0]}.${parts[1].slice(0, 2)}`
                        : cleaned;
                  updateField('cost', sanitized);
                }}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                returnKeyType="next"
                maxLength={9}
              />
            </View>
          </View>

          {/* Service Date + Next Due Date row */}
          <View style={styles.rowFields}>
            <View style={[styles.fieldGroup, styles.halfField]}>
              <Text style={styles.fieldLabel}>SERVICE DATE *</Text>
              <TextInput
                style={styles.input}
                value={form.serviceDate}
                onChangeText={(v) => updateField('serviceDate', v)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numbers-and-punctuation"
                returnKeyType="next"
                maxLength={10}
              />
            </View>

            <View style={[styles.fieldGroup, styles.halfField]}>
              <Text style={styles.fieldLabel}>NEXT DUE DATE</Text>
              <TextInput
                style={styles.input}
                value={form.nextDueDate}
                onChangeText={(v) => updateField('nextDueDate', v)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                onSubmitEditing={handleSave}
                maxLength={10}
              />
            </View>
          </View>

          <Text style={styles.hint}>
            A reminder notification will be sent 7 days before the next due date.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgBase,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: Spacing.base,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  cancelBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  cancelText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  saveBtn: {
    backgroundColor: Colors.accentCyan,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textInverse,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing['4xl'],
    gap: Spacing.lg,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  rowFields: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  halfField: {
    flex: 1,
  },
  typePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  typeChip: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minWidth: '30%',
    flex: 1,
    gap: Spacing.xs,
  },
  typeChipActive: {
    borderColor: Colors.accentCyan,
    backgroundColor: Colors.accentCyanDim,
  },
  typeChipIcon: {
    fontSize: 20,
  },
  typeChipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  typeChipTextActive: {
    color: Colors.accentCyan,
  },
  hint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: Spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
});
