/**
 * AddMaintenanceModal — Log a new vehicle service entry (Phase 12)
 *
 * Requirements:
 *  - ScreenContainer header clearing status bar on iOS/Android
 *  - 3-column self-sizing service type grid with real Phosphor icons and theme tokens
 *  - Native date pickers for service date and next due date
 *  - Cost label dynamically reflecting active currency setting (e.g. COST (KES))
 *  - Optional Next Due Odometer (km) field beside next due date
 *  - Save button disabled until required fields are valid, with inline errors
 *  - Strictly theme tokens (#05070D, #0E131B, #151B26, cyan, blue, warning, danger)
 */

import React, { useMemo, useState } from 'react';
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
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Colors, FontFamily, Radius, Spacing, Typography } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { usePreferences } from '@/contexts/PreferencesContext';
import {
  createMaintenanceLog,
  MAINTENANCE_TYPE_ICONS,
  MAINTENANCE_TYPE_LABELS,
  type CreateMaintenanceLogInput,
  type MaintenanceType,
} from '@/services/maintenance';

let cachedNativePicker: React.ComponentType<any> | null = null;
let hasAttemptedNativePicker = false;

function getNativeDateTimePicker(): React.ComponentType<any> | null {
  if (hasAttemptedNativePicker) {
    return cachedNativePicker;
  }
  hasAttemptedNativePicker = true;
  try {
    // Lazily require so TurboModuleRegistry.getEnforcing('RNCDatePicker') doesn't throw
    // at top-level module load time on installed builds lacking the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-community/datetimepicker');
    cachedNativePicker = (mod && mod.default) ? mod.default : (mod || null);
  } catch (err) {
    console.warn('[AddMaintenanceModal] Native DateTimePicker not available in binary:', err);
    cachedNativePicker = null;
  }
  return cachedNativePicker;
}

function NativeDateTimePicker(props: any) {
  const comp = getNativeDateTimePicker();
  if (!comp) return null;
  return React.createElement(comp, props);
}

function isNativePickerAvailable(): boolean {
  return getNativeDateTimePicker() !== null;
}

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

function formatDateDisplay(iso: string | null): string {
  if (!iso) return 'Select date';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  serviceDate: string; // YYYY-MM-DD
  nextDueDate: string; // YYYY-MM-DD
  nextDueOdometer: string;
}

const INITIAL_FORM: FormState = {
  type: 'oil_change',
  description: '',
  odometer: '',
  cost: '',
  serviceDate: todayISO(),
  nextDueDate: '',
  nextDueOdometer: '',
};

export function AddMaintenanceModal({
  visible,
  vehicleId,
  vehicleName,
  onClose,
  onSaved,
}: AddMaintenanceModalProps) {
  const { currency } = usePreferences();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Active date picker state
  const [activePickerField, setActivePickerField] = useState<'serviceDate' | 'nextDueDate' | null>(null);
  const [pickerDate, setPickerDate] = useState<Date>(new Date());
  const [fallbackDateText, setFallbackDateText] = useState<string>('');

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function markTouched(key: string) {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }

  // Validation
  const errors = useMemo(() => {
    const errs: Record<string, string> = {};

    if (!form.description.trim()) {
      errs.description = 'Description is required';
    }

    const odoNum = Number(form.odometer);
    if (!form.odometer.trim()) {
      errs.odometer = 'Odometer reading is required';
    } else if (isNaN(odoNum) || odoNum < 0) {
      errs.odometer = 'Enter a valid odometer reading (km)';
    }

    if (form.cost.trim()) {
      const costNum = Number(form.cost);
      if (isNaN(costNum) || costNum < 0) {
        errs.cost = 'Enter a valid non-negative cost';
      }
    }

    if (form.nextDueOdometer.trim()) {
      const nextOdoNum = Number(form.nextDueOdometer);
      if (isNaN(nextOdoNum) || nextOdoNum < 0) {
        errs.nextDueOdometer = 'Enter a valid odometer reading';
      }
    }

    return errs;
  }, [form]);

  const isFormValid = Object.keys(errors).length === 0;

  // Date picker handlers
  const openDatePicker = (field: 'serviceDate' | 'nextDueDate') => {
    const currentVal = form[field];
    const initialDate = currentVal ? new Date(currentVal + 'T00:00:00') : new Date();
    setPickerDate(isNaN(initialDate.getTime()) ? new Date() : initialDate);
    setFallbackDateText(currentVal || todayISO());
    setActivePickerField(field);
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setActivePickerField(null);
    }
    if (event.type === 'set' && selectedDate) {
      const iso = selectedDate.toISOString().split('T')[0];
      if (activePickerField) {
        updateField(activePickerField, iso);
      }
    }
    if (Platform.OS === 'ios' && event.type === 'dismissed') {
      setActivePickerField(null);
    }
  };

  const confirmIosDate = () => {
    if (activePickerField) {
      const iso = pickerDate.toISOString().split('T')[0];
      updateField(activePickerField, iso);
    }
    setActivePickerField(null);
  };

  const handleSave = async () => {
    if (!isFormValid) {
      setTouched({
        description: true,
        odometer: true,
        cost: true,
        nextDueOdometer: true,
      });
      return;
    }

    const payload: CreateMaintenanceLogInput = {
      vehicleId,
      vehicleName,
      type: form.type,
      description: form.description.trim(),
      odometer: Math.round(Number(form.odometer)),
      cost: form.cost === '' ? 0 : Number(form.cost),
      serviceDate: form.serviceDate,
      nextDueDate: form.nextDueDate || null,
      nextDueOdometer: form.nextDueOdometer.trim() ? Math.round(Number(form.nextDueOdometer)) : null,
      currency,
    };

    setIsSaving(true);
    try {
      await createMaintenanceLog(payload);
      setForm(INITIAL_FORM);
      setTouched({});
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
    setTouched({});
    setActivePickerField(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <ScreenContainer
        title="Log Service"
        subtitle={vehicleName}
        headerLeft={
          <Pressable
            style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
            onPress={handleClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        }
        headerRight={
          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && styles.pressed,
              (!isFormValid || isSaving) && styles.saveBtnDisabled,
            ]}
            onPress={handleSave}
            disabled={!isFormValid || isSaving}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Save service record"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.text.inverse} />
            ) : (
              <Text
                style={[
                  styles.saveText,
                  (!isFormValid || isSaving) && styles.saveTextDisabled,
                ]}
              >
                Save
              </Text>
            )}
          </Pressable>
        }
      >
        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── 1. SERVICE TYPE (3-COL FLEX-WRAP GRID WITH REAL PHOSPHOR ICONS) ── */}
            <View style={styles.fieldGroup}>
              <Text variant="overline" color={Colors.text.tertiary} style={styles.fieldLabel}>
                SERVICE TYPE
              </Text>
              <View style={styles.typePicker}>
                {MAINTENANCE_TYPES.map((t) => {
                  const isActive = form.type === t;
                  return (
                    <Pressable
                      key={t}
                      style={({ pressed }) => [
                        styles.typeChip,
                        isActive && styles.typeChipActive,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => updateField('type', t)}
                      accessibilityRole="button"
                      accessibilityLabel={MAINTENANCE_TYPE_LABELS[t]}
                    >
                      <View
                        style={[
                          styles.typeIconBox,
                          isActive && styles.typeIconBoxActive,
                        ]}
                      >
                        <Icon
                          name={MAINTENANCE_TYPE_ICONS[t]}
                          size={20}
                          color={isActive ? Colors.accent.cyan : Colors.text.secondary}
                          weight={isActive ? 'fill' : 'regular'}
                        />
                      </View>
                      <Text
                        variant="label"
                        color={isActive ? Colors.accent.cyan : Colors.text.secondary}
                        style={[
                          styles.typeChipText,
                          isActive && styles.typeChipTextActive,
                        ]}
                        numberOfLines={2}
                      >
                        {MAINTENANCE_TYPE_LABELS[t]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* ── 2. DESCRIPTION ── */}
            <View style={styles.fieldGroup}>
              <Text variant="overline" color={Colors.text.tertiary} style={styles.fieldLabel}>
                DESCRIPTION *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  touched.description && errors.description && styles.inputError,
                ]}
                value={form.description}
                onChangeText={(v) => updateField('description', v)}
                onBlur={() => markTouched('description')}
                placeholder="e.g. Fully synthetic 5W-30 oil & OEM filter"
                placeholderTextColor={Colors.text.tertiary}
                returnKeyType="next"
                maxLength={200}
              />
              {touched.description && errors.description && (
                <Text variant="overline" color={Colors.semantic.danger} style={styles.errorText}>
                  {errors.description}
                </Text>
              )}
            </View>

            {/* ── 3. ODOMETER & COST ROW ── */}
            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, styles.halfField]}>
                <Text variant="overline" color={Colors.text.tertiary} style={styles.fieldLabel}>
                  ODOMETER (km) *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    touched.odometer && errors.odometer && styles.inputError,
                  ]}
                  value={form.odometer}
                  onChangeText={(v) => updateField('odometer', v.replace(/[^0-9]/g, ''))}
                  onBlur={() => markTouched('odometer')}
                  placeholder="e.g. 45000"
                  placeholderTextColor={Colors.text.tertiary}
                  keyboardType="numeric"
                  returnKeyType="next"
                  maxLength={9}
                />
                {touched.odometer && errors.odometer && (
                  <Text variant="overline" color={Colors.semantic.danger} style={styles.errorText}>
                    {errors.odometer}
                  </Text>
                )}
              </View>

              <View style={[styles.fieldGroup, styles.halfField]}>
                <Text variant="overline" color={Colors.text.tertiary} style={styles.fieldLabel}>
                  COST ({currency})
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    touched.cost && errors.cost && styles.inputError,
                  ]}
                  value={form.cost}
                  onChangeText={(v) => {
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
                  onBlur={() => markTouched('cost')}
                  placeholder="0.00"
                  placeholderTextColor={Colors.text.tertiary}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                  maxLength={9}
                />
                {touched.cost && errors.cost && (
                  <Text variant="overline" color={Colors.semantic.danger} style={styles.errorText}>
                    {errors.cost}
                  </Text>
                )}
              </View>
            </View>

            {/* ── 4. SERVICE DATE (NATIVE PICKER) ── */}
            <View style={styles.fieldGroup}>
              <Text variant="overline" color={Colors.text.tertiary} style={styles.fieldLabel}>
                SERVICE DATE *
              </Text>
              <Pressable
                style={styles.datePickerChip}
                onPress={() => openDatePicker('serviceDate')}
                accessibilityRole="button"
                accessibilityLabel="Choose service date"
              >
                <Icon name="timer" size={16} color={Colors.accent.cyan} />
                <Text variant="label" color={Colors.text.primary} style={styles.dateValueText}>
                  {formatDateDisplay(form.serviceDate)}
                </Text>
                <View style={styles.dateRight}>
                  <Text variant="overline" color={Colors.text.tertiary}>
                    {form.serviceDate}
                  </Text>
                  <Icon name="caret-down" size={14} color={Colors.text.tertiary} />
                </View>
              </Pressable>
            </View>

            {/* ── 5. NEXT DUE DATE & OPTIONAL NEXT DUE ODOMETER ── */}
            <View style={styles.rowFields}>
              {/* Next Due Date */}
              <View style={[styles.fieldGroup, styles.halfField]}>
                <View style={styles.labelWithClear}>
                  <Text variant="overline" color={Colors.text.tertiary} style={styles.fieldLabel}>
                    NEXT DUE DATE
                  </Text>
                  {form.nextDueDate ? (
                    <Pressable
                      onPress={() => updateField('nextDueDate', '')}
                      hitSlop={8}
                    >
                      <Text variant="overline" color={Colors.accent.cyan} style={styles.clearBtnText}>
                        Clear
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                <Pressable
                  style={styles.datePickerChip}
                  onPress={() => openDatePicker('nextDueDate')}
                  accessibilityRole="button"
                  accessibilityLabel="Choose next due date"
                >
                  <Icon name="flag" size={16} color={Colors.text.secondary} />
                  <Text
                    variant="label"
                    color={form.nextDueDate ? Colors.text.primary : Colors.text.tertiary}
                    style={styles.dateValueText}
                    numberOfLines={1}
                  >
                    {form.nextDueDate ? formatDateDisplay(form.nextDueDate) : 'Optional'}
                  </Text>
                </Pressable>
              </View>

              {/* Next Due Odometer (km) */}
              <View style={[styles.fieldGroup, styles.halfField]}>
                <Text variant="overline" color={Colors.text.tertiary} style={styles.fieldLabel}>
                  NEXT DUE ODO (km)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    touched.nextDueOdometer && errors.nextDueOdometer && styles.inputError,
                  ]}
                  value={form.nextDueOdometer}
                  onChangeText={(v) => updateField('nextDueOdometer', v.replace(/[^0-9]/g, ''))}
                  onBlur={() => markTouched('nextDueOdometer')}
                  placeholder="e.g. 55000"
                  placeholderTextColor={Colors.text.tertiary}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                  maxLength={9}
                />
                {touched.nextDueOdometer && errors.nextDueOdometer && (
                  <Text variant="overline" color={Colors.semantic.danger} style={styles.errorText}>
                    {errors.nextDueOdometer}
                  </Text>
                )}
              </View>
            </View>

            <Text variant="overline" color={Colors.text.tertiary} style={styles.hint}>
              Reminders will trigger when approaching either the scheduled date or mileage threshold.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── NATIVE DATE PICKER OVERLAY (iOS / Android) ── */}
        {activePickerField && isNativePickerAvailable() && Platform.OS === 'ios' && (
          <Modal
            transparent
            animationType="fade"
            visible={Boolean(activePickerField)}
            onRequestClose={() => setActivePickerField(null)}
          >
            <View style={styles.iosPickerOverlay}>
              <Pressable style={styles.iosPickerBackdrop} onPress={() => setActivePickerField(null)} />
              <View style={styles.iosPickerCard}>
                <View style={styles.iosPickerHeader}>
                  <Pressable onPress={() => setActivePickerField(null)} hitSlop={12}>
                    <Text variant="label" color={Colors.text.tertiary}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Text variant="heading" color={Colors.text.primary} style={styles.iosPickerTitle}>
                    {activePickerField === 'serviceDate' ? 'Service Date' : 'Next Due Date'}
                  </Text>
                  <Pressable onPress={confirmIosDate} hitSlop={12}>
                    <Text variant="heading" color={Colors.accent.cyan}>
                      Done
                    </Text>
                  </Pressable>
                </View>

                <NativeDateTimePicker
                  value={pickerDate}
                  mode="date"
                  display="spinner"
                  themeVariant="dark"
                  onChange={(e: any, date: Date | undefined) => date && setPickerDate(date)}
                  style={styles.iosPickerSpinner}
                />
              </View>
            </View>
          </Modal>
        )}

        {activePickerField && isNativePickerAvailable() && Platform.OS === 'android' && (
          <NativeDateTimePicker
            value={pickerDate}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}

        {/* ── FALLBACK DATE PICKER MODAL (When native module is absent) ── */}
        {activePickerField && !isNativePickerAvailable() && (
          <Modal
            transparent
            animationType="fade"
            visible={Boolean(activePickerField)}
            onRequestClose={() => setActivePickerField(null)}
          >
            <View style={styles.iosPickerOverlay}>
              <Pressable style={styles.iosPickerBackdrop} onPress={() => setActivePickerField(null)} />
              <View style={styles.fallbackModalCard}>
                <View style={styles.fallbackModalHeader}>
                  <Text variant="title" color={Colors.text.primary}>
                    {activePickerField === 'serviceDate' ? 'Service Date' : 'Next Due Date'}
                  </Text>
                  <Text variant="label" color={Colors.text.tertiary}>
                    Enter date in YYYY-MM-DD format
                  </Text>
                </View>

                <View style={styles.presetChipRow}>
                  <Pressable
                    style={styles.presetChip}
                    onPress={() => setFallbackDateText(todayISO())}
                  >
                    <Text variant="label" color={Colors.text.primary}>Today</Text>
                  </Pressable>
                  <Pressable
                    style={styles.presetChip}
                    onPress={() => {
                      const d = new Date();
                      d.setMonth(d.getMonth() + 3);
                      setFallbackDateText(d.toISOString().split('T')[0]);
                    }}
                  >
                    <Text variant="label" color={Colors.text.primary}>+3 Mo</Text>
                  </Pressable>
                  <Pressable
                    style={styles.presetChip}
                    onPress={() => {
                      const d = new Date();
                      d.setMonth(d.getMonth() + 6);
                      setFallbackDateText(d.toISOString().split('T')[0]);
                    }}
                  >
                    <Text variant="label" color={Colors.text.primary}>+6 Mo</Text>
                  </Pressable>
                  <Pressable
                    style={styles.presetChip}
                    onPress={() => {
                      const d = new Date();
                      d.setFullYear(d.getFullYear() + 1);
                      setFallbackDateText(d.toISOString().split('T')[0]);
                    }}
                  >
                    <Text variant="label" color={Colors.text.primary}>+1 Yr</Text>
                  </Pressable>
                </View>

                <TextInput
                  style={styles.fallbackDateInput}
                  value={fallbackDateText}
                  onChangeText={setFallbackDateText}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.text.tertiary}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />

                <View style={styles.fallbackActionRow}>
                  <Button
                    variant="ghost"
                    onPress={() => setActivePickerField(null)}
                    style={styles.fallbackBtn}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onPress={() => {
                      if (activePickerField && fallbackDateText.trim()) {
                        updateField(activePickerField, fallbackDateText.trim());
                      }
                      setActivePickerField(null);
                    }}
                    style={styles.fallbackBtn}
                  >
                    Set Date
                  </Button>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </ScreenContainer>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerBtn: {
    paddingVertical: Spacing[1],
    paddingHorizontal: Spacing[2],
  },
  cancelText: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  saveBtn: {
    backgroundColor: Colors.accent.cyan,
    borderRadius: Radius.button,
    paddingVertical: 7,
    paddingHorizontal: Spacing[4],
    minWidth: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: Colors.surface['3'],
    opacity: 0.5,
  },
  saveText: {
    ...Typography.heading,
    fontSize: 14,
    lineHeight: 18,
    color: Colors.text.inverse,
  },
  saveTextDisabled: {
    color: Colors.text.tertiary,
  },
  keyboardWrap: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.screen,
    paddingBottom: 60,
    gap: Spacing[5],
  },
  fieldGroup: {
    gap: Spacing[2],
  },
  fieldLabel: {
    letterSpacing: 0.8,
  },
  labelWithClear: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearBtnText: {
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface['1'],
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.iconChip,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.text.primary,
  },
  inputError: {
    borderColor: Colors.semantic.danger,
  },
  errorText: {
    fontSize: 11,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  rowFields: {
    flexDirection: 'row',
    gap: Spacing.gap,
  },
  halfField: {
    flex: 1,
  },
  // ── 3-column Service Type Grid ──
  typePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
    justifyContent: 'space-between',
  },
  typeChip: {
    width: '31.5%',
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface['1'],
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.iconChip,
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[1],
    gap: Spacing[1],
  },
  typeChipActive: {
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.tint.cyan,
  },
  typeIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface['2'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconBoxActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.2)',
  },
  typeChipText: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  typeChipTextActive: {
    fontFamily: FontFamily.heading,
  },
  // ── Date Picker Chip ──
  datePickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface['1'],
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.iconChip,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    gap: Spacing[2],
    minHeight: 48,
  },
  dateValueText: {
    flex: 1,
    fontSize: 14,
  },
  dateRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hint: {
    fontSize: 11,
    letterSpacing: 0.4,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: Spacing[2],
  },
  pressed: {
    opacity: 0.75,
  },
  // ── iOS Native Date Picker Sheet ──
  iosPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(5, 7, 13, 0.75)',
  },
  iosPickerBackdrop: {
    flex: 1,
  },
  iosPickerCard: {
    backgroundColor: Colors.surface['2'],
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  iosPickerTitle: {
    fontSize: 16,
  },
  iosPickerSpinner: {
    height: 200,
  },
  // ── Fallback Date Picker (No Native Module) ──
  fallbackModalCard: {
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.card,
    marginHorizontal: Spacing[4],
    marginBottom: Spacing.section,
    padding: Spacing[4],
    gap: Spacing[3],
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  fallbackModalHeader: {
    gap: 4,
  },
  presetChipRow: {
    flexDirection: 'row',
    gap: Spacing[2],
  },
  presetChip: {
    flex: 1,
    backgroundColor: Colors.surface['3'],
    paddingVertical: Spacing[2],
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  fallbackDateInput: {
    height: 48,
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.hairline,
    color: Colors.text.primary,
    fontFamily: FontFamily.body,
    fontSize: 16,
    paddingHorizontal: Spacing[3],
    letterSpacing: 1,
  },
  fallbackActionRow: {
    flexDirection: 'row',
    gap: Spacing[2],
    marginTop: Spacing[1],
  },
  fallbackBtn: {
    flex: 1,
  },
});
