/**
 * AddVehicleModal — Add a vehicle to garage with catalogue picker & odometer
 *
 * Requirements:
 *  - Year is required and has NO prefilled value.
 *  - Searchable 2-step catalogue picker + custom addition.
 *  - Odometer input respects user units.
 *  - Exactly one primary-styled action ("Add to Garage").
 *  - Theme tokens only, Phosphor icons, no emojis.
 */

import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { MakeModelPicker } from '@/components/vehicles/MakeModelPicker';
import { usePreferences } from '@/contexts/PreferencesContext';

interface AddVehicleModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    make: string;
    model: string;
    year: number;
    odometer?: number;
    nickname?: string | null;
    isPrimary: boolean;
    localPhotoUri?: string | null;
  }) => Promise<void>;
  isFirstVehicle?: boolean;
}

export function AddVehicleModal({
  visible,
  onClose,
  onSave,
  isFirstVehicle = false,
}: AddVehicleModalProps) {
  const currentYear = new Date().getFullYear();
  const { distanceUnitLabel } = usePreferences();

  const [make, setMake] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [year, setYear] = useState<string>(''); // Required, NO prefilled value
  const [odometer, setOdometer] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState<boolean>(isFirstVehicle);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [pickerVisible, setPickerVisible] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resetForm = () => {
    setMake('');
    setModel('');
    setYear('');
    setOdometer('');
    setNickname('');
    setIsPrimary(isFirstVehicle);
    setPhotoUri(null);
    setErrorMsg(null);
    setIsSaving(false);
  };

  const handleClose = () => {
    if (isSaving) return;
    resetForm();
    onClose();
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Photo Library Access Required',
          'Please allow photo library access to upload a picture of your vehicle.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('[AddVehicleModal] Error picking image:', err);
      Alert.alert('Error', 'Unable to pick vehicle image. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!make || !model) {
      setErrorMsg('Please select a vehicle make and model.');
      return;
    }

    if (!year.trim()) {
      setErrorMsg('Year is required.');
      return;
    }

    const parsedYear = parseInt(year.trim(), 10);
    if (isNaN(parsedYear) || parsedYear < 1900 || parsedYear > currentYear + 2) {
      setErrorMsg(`Please enter a valid 4-digit year between 1900 and ${currentYear + 2}.`);
      return;
    }

    const parsedOdometer = odometer.trim() ? Math.max(0, parseInt(odometer.replace(/\D/g, ''), 10)) : 0;

    setIsSaving(true);
    setErrorMsg(null);

    try {
      await onSave({
        make,
        model,
        year: parsedYear,
        odometer: parsedOdometer,
        nickname: nickname.trim() || null,
        isPrimary,
        localPhotoUri: photoUri,
      });

      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add vehicle.';
      setErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="heading" color={Colors.text.primary}>
              Add Vehicle
            </Text>
            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.btnPressed]}
              onPress={handleClose}
              hitSlop={8}
            >
              <Icon name="close" size={20} color={Colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Error Message */}
            {errorMsg && (
              <View style={styles.errorBox}>
                <Icon name="warning" size={18} color={Colors.semantic.danger} />
                <Text variant="label" color={Colors.semantic.danger} style={styles.errorText}>
                  {errorMsg}
                </Text>
              </View>
            )}

            {/* Photo Upload Area */}
            <Pressable
              style={({ pressed }) => [styles.photoContainer, pressed && styles.photoPressed]}
              onPress={handlePickImage}
            >
              {photoUri ? (
                <View style={styles.photoWrapper}>
                  <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
                  <View style={styles.photoOverlay}>
                    <Icon name="camera" size={20} color="#FFFFFF" />
                    <Text variant="label" color="#FFFFFF" style={styles.changePhotoText}>
                      Change Photo
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <View style={styles.photoIconCircle}>
                    <Icon name="camera" size={24} color={Colors.accent.cyan} />
                  </View>
                  <Text variant="body" color={Colors.text.primary} style={styles.photoUploadPrompt}>
                    Upload Vehicle Photo
                  </Text>
                  <Text variant="label" color={Colors.text.tertiary}>
                    Optional · JPG or PNG
                  </Text>
                </View>
              )}
            </Pressable>

            {/* Make & Model Selector */}
            <View style={styles.fieldGroup}>
              <Text variant="label" color={Colors.text.tertiary}>
                MAKE & MODEL *
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.selectorBtn,
                  pressed && styles.fieldPressed,
                  (!make || !model) && styles.selectorPlaceholder,
                ]}
                onPress={() => setPickerVisible(true)}
              >
                <View style={styles.selectorLeft}>
                  <Icon name="car" size={18} color={make ? Colors.accent.cyan : Colors.text.tertiary} />
                  <Text
                    variant="body"
                    color={make && model ? Colors.text.primary : Colors.text.tertiary}
                    style={styles.selectorText}
                  >
                    {make && model ? `${make} ${model}` : 'Select from catalogue...'}
                  </Text>
                </View>
                <Icon name="caret-right" size={16} color={Colors.text.tertiary} />
              </Pressable>
            </View>

            {/* Year Input (Required, no prefill) */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text variant="label" color={Colors.text.tertiary}>
                  YEAR *
                </Text>
                <Text variant="label" color={Colors.semantic.warning}>
                  Required
                </Text>
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 2021"
                placeholderTextColor={Colors.text.tertiary}
                value={year}
                onChangeText={(val) => {
                  setYear(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                keyboardType="numeric"
                maxLength={4}
              />
            </View>

            {/* Odometer Input */}
            <View style={styles.fieldGroup}>
              <Text variant="label" color={Colors.text.tertiary}>
                ODOMETER READING ({distanceUnitLabel.toUpperCase()})
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder={`e.g. 45000 ${distanceUnitLabel}`}
                placeholderTextColor={Colors.text.tertiary}
                value={odometer}
                onChangeText={setOdometer}
                keyboardType="numeric"
              />
            </View>

            {/* Nickname Input */}
            <View style={styles.fieldGroup}>
              <Text variant="label" color={Colors.text.tertiary}>
                NICKNAME (OPTIONAL)
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Daily Missile"
                placeholderTextColor={Colors.text.tertiary}
                value={nickname}
                onChangeText={setNickname}
                maxLength={30}
              />
            </View>

            {/* Primary Vehicle Switch */}
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text variant="body" color={Colors.text.primary}>
                  Set as Primary Vehicle
                </Text>
                <Text variant="label" color={Colors.text.tertiary}>
                  Default for tracking and performance benchmarks
                </Text>
              </View>
              <Switch
                value={isPrimary}
                onValueChange={setIsPrimary}
                trackColor={{ false: Colors.surface['2'], true: Colors.accent.cyan }}
                thumbColor={isPrimary ? '#05070D' : Colors.text.tertiary}
              />
            </View>
          </ScrollView>

          {/* Footer Action (Exactly ONE primary-styled action) */}
          <View style={styles.footer}>
            <Button variant="primary" onPress={handleSave} loading={isSaving}>
              Add to Garage
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* 2-Step Make/Model Picker Modal */}
      <MakeModelPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={(selectedMake, selectedModel) => {
          setMake(selectedMake);
          setModel(selectedModel);
          if (errorMsg) setErrorMsg(null);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 13, 0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '92%',
    backgroundColor: Colors.surface['1'],
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  closeBtn: {
    padding: Spacing[2],
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.iconChip,
  },
  btnPressed: {
    opacity: 0.7,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.screen,
    gap: Spacing[4],
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderRadius: Radius.card,
    padding: Spacing[3],
    borderWidth: 1,
    borderColor: Colors.semantic.danger,
  },
  errorText: {
    flex: 1,
  },
  photoContainer: {
    borderRadius: Radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    backgroundColor: Colors.surface['2'],
  },
  photoPressed: {
    opacity: 0.85,
  },
  photoWrapper: {
    width: '100%',
    height: 160,
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 7, 13, 0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
  },
  changePhotoText: {
    fontWeight: '600',
  },
  photoPlaceholder: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[1],
  },
  photoIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[1],
  },
  photoUploadPrompt: {
    fontWeight: '600',
  },
  fieldGroup: {
    gap: Spacing[2],
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.button,
    paddingHorizontal: Spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  selectorPlaceholder: {
    borderStyle: 'dashed',
  },
  fieldPressed: {
    backgroundColor: Colors.surface['3'],
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  selectorText: {
    fontSize: 15,
  },
  textInput: {
    height: 52,
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.button,
    paddingHorizontal: Spacing[4],
    color: Colors.text.primary,
    fontFamily: FontFamily.numberRegular,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface['2'],
    padding: Spacing[4],
    borderRadius: Radius.card,
    marginTop: Spacing[2],
  },
  switchInfo: {
    flex: 1,
    gap: Spacing[1],
    paddingRight: Spacing[3],
  },
  footer: {
    padding: Spacing.screen,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    backgroundColor: Colors.surface['1'],
  },
});
