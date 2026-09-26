import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { MakeModelPicker } from '@/components/vehicles/MakeModelPicker';

interface AddVehicleModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    make: string;
    model: string;
    year: number;
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

  const [make, setMake] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [year, setYear] = useState<string>(String(currentYear));
  const [nickname, setNickname] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState<boolean>(isFirstVehicle);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [pickerVisible, setPickerVisible] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resetForm = () => {
    setMake('');
    setModel('');
    setYear(String(currentYear));
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
        aspect: [4, 3],
        quality: 0.9,
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

    const parsedYear = parseInt(year, 10);
    if (isNaN(parsedYear) || parsedYear < 1900 || parsedYear > currentYear + 2) {
      setErrorMsg(`Please enter a valid year between 1900 and ${currentYear + 2}.`);
      return;
    }

    setErrorMsg(null);
    setIsSaving(true);

    try {
      await onSave({
        make,
        model,
        year: parsedYear,
        nickname: nickname.trim() || null,
        isPrimary: isFirstVehicle || isPrimary,
        localPhotoUri: photoUri,
      });
      resetForm();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save vehicle';
      setErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add Vehicle to Garage</Text>
            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              onPress={handleClose}
              disabled={isSaving}
              hitSlop={8}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Photo Picker */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>VEHICLE PHOTO (OPTIONAL)</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.photoUploadBox,
                  pressed && styles.pressed,
                ]}
                onPress={handlePickImage}
              >
                {photoUri ? (
                  <View style={styles.photoPreviewWrapper}>
                    <Image
                      source={{ uri: photoUri }}
                      style={styles.photoPreview}
                      resizeMode="cover"
                    />
                    <View style={styles.photoOverlayBadge}>
                      <Text style={styles.photoOverlayText}>Tap to Change</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.photoUploadPlaceholder}>
                    <Text style={styles.photoUploadIcon}>📸</Text>
                    <Text style={styles.photoUploadTitle}>Upload Vehicle Photo</Text>
                    <Text style={styles.photoUploadSubtitle}>
                      Automatically resized and saved to your profile
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Make & Model Picker Button */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>MAKE & MODEL *</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.pickerButton,
                  pressed && styles.pressed,
                  make ? styles.pickerButtonSelected : undefined,
                ]}
                onPress={() => setPickerVisible(true)}
              >
                <View>
                  {make ? (
                    <Text style={styles.pickerSelectedText}>
                      {make} {model}
                    </Text>
                  ) : (
                    <Text style={styles.pickerPlaceholderText}>
                      Select from global database...
                    </Text>
                  )}
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </View>

            {/* Year Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>YEAR *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 2024"
                placeholderTextColor={Colors.textMuted}
                value={year}
                onChangeText={setYear}
                keyboardType="numeric"
                maxLength={4}
              />
            </View>

            {/* Nickname Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>NICKNAME (OPTIONAL)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Daily Driver, GT3 RS, Project 86"
                placeholderTextColor={Colors.textMuted}
                value={nickname}
                onChangeText={setNickname}
                maxLength={40}
              />
            </View>

            {/* Primary Toggle */}
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchTitle}>Set as Primary Vehicle</Text>
                <Text style={styles.switchSubtitle}>
                  Used as the default vehicle for trip tracking and runs
                </Text>
              </View>
              <Switch
                value={isFirstVehicle ? true : isPrimary}
                onValueChange={(val) => {
                  if (!isFirstVehicle) setIsPrimary(val);
                }}
                disabled={isFirstVehicle}
                trackColor={{
                  false: Colors.bgElevated,
                  true: Colors.accentCyan,
                }}
                thumbColor={Colors.textPrimary}
              />
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && styles.pressed,
              ]}
              onPress={handleClose}
              disabled={isSaving}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                (!make || isSaving) && styles.saveBtnDisabled,
                pressed && styles.pressed,
              ]}
              onPress={handleSave}
              disabled={!make || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Vehicle</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Nested Make/Model Picker Modal */}
        <MakeModelPicker
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          onSelect={(selectedMake, selectedModel) => {
            setMake(selectedMake);
            setModel(selectedModel);
            setErrorMsg(null);
          }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: Colors.bgSurface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingTop: Spacing.base,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h2,
    color: Colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: FontFamily.bold,
  },
  scrollBody: {
    paddingHorizontal: Spacing.base,
  },
  scrollContent: {
    paddingTop: Spacing.base,
    paddingBottom: Spacing.xl,
    gap: Spacing.base,
  },
  errorBox: {
    backgroundColor: Colors.accentRedDim,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accentRed,
  },
  errorText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.label,
    color: Colors.accentRed,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  photoUploadBox: {
    height: 140,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  photoPreviewWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoOverlayBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Colors.overlay,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  photoOverlayText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textPrimary,
  },
  photoUploadPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.base,
  },
  photoUploadIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  photoUploadTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.accentCyan,
  },
  photoUploadSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
  },
  pickerButtonSelected: {
    borderColor: Colors.accentCyan,
  },
  pickerSelectedText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  pickerPlaceholderText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
  },
  chevron: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: Colors.textSecondary,
  },
  textInput: {
    height: 48,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginTop: Spacing.xs,
  },
  switchInfo: {
    flex: 1,
    marginRight: Spacing.base,
  },
  switchTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  switchSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.bgSurface,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textInverse,
  },
  pressed: {
    opacity: 0.7,
  },
});
