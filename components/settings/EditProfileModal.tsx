/**
 * EditProfileModal — Update driver handle & display preferences
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useVehicleContext, type AvatarSource } from '@/contexts/VehicleContext';
import { supabase } from '@/lib/supabase';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

const HANDLE_REGEX = /^[a-z0-9._]+$/;

export function EditProfileModal({ visible, onClose }: EditProfileModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { primaryVehicle, avatarSource, setAvatarSource } = useVehicleContext();

  const [handle, setHandle] = useState<string>('');
  const [selectedAvatarSource, setSelectedAvatarSource] = useState<AvatarSource>('car');
  const [customAvatarUri, setCustomAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible && profile) {
      queueMicrotask(() => {
        setHandle(profile.display_name ?? '');
        setSelectedAvatarSource(avatarSource);
        setCustomAvatarUri(profile.avatar_url ?? null);
        setErrorMsg(null);
      });
    }
  }, [visible, profile, avatarSource]);

  const handlePickCustomAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo Library Access Required',
          'Please allow photo library access to upload your avatar.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri && user) {
        const localUri = result.assets[0].uri;
        setUploadingAvatar(true);

        // Resize avatar to 256x256
        const manipulated = await manipulateAsync(
          localUri,
          [{ resize: { width: 256, height: 256 } }],
          { compress: 0.85, format: SaveFormat.JPEG },
        );

        const response = await fetch(manipulated.uri);
        const buffer = await response.arrayBuffer();

        const storagePath = `${user.id}/avatar.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('vehicle-photos')
          .upload(storagePath, buffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from('vehicle-photos')
          .getPublicUrl(storagePath);

        const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
        setCustomAvatarUri(avatarUrl);
        setSelectedAvatarSource('custom');
      }
    } catch (err) {
      console.error('[EditProfileModal] Avatar upload error:', err);
      Alert.alert('Upload Failed', 'Could not upload your photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    const cleanHandle = handle.trim().replace(/^@/, '').toLowerCase();
    if (cleanHandle.length < 3 || cleanHandle.length > 20) {
      setErrorMsg('Handle must be between 3 and 20 characters.');
      return;
    }

    if (!HANDLE_REGEX.test(cleanHandle)) {
      setErrorMsg('Handle can only contain lowercase letters, numbers, underscores, and dots.');
      return;
    }

    if (!user) return;
    setSaving(true);
    setErrorMsg(null);

    try {
      const updates: { display_name: string; avatar_url?: string | null } = {
        display_name: cleanHandle,
      };

      if (customAvatarUri && selectedAvatarSource === 'custom') {
        updates.avatar_url = customAvatarUri;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      await setAvatarSource(selectedAvatarSource);
      await refreshProfile();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text variant="heading" color={Colors.text.primary}>
              Edit Driver Profile
            </Text>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Icon name="close" size={20} color={Colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {errorMsg && (
              <View style={styles.errorBox}>
                <Text variant="label" color={Colors.semantic.danger}>
                  {errorMsg}
                </Text>
              </View>
            )}

            {/* Handle Field */}
            <View style={styles.fieldGroup}>
              <Text variant="label" color={Colors.text.tertiary}>
                DRIVER HANDLE
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="pilot_apex"
                placeholderTextColor={Colors.text.tertiary}
                value={handle}
                onChangeText={(val) => {
                  setHandle(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text variant="overline" color={Colors.text.tertiary} style={styles.helperText}>
                Letters, numbers, dots, and underscores only (3-20 chars).
              </Text>
            </View>

            {/* Avatar Source Selector */}
            <View style={styles.fieldGroup}>
              <Text variant="label" color={Colors.text.tertiary}>
                PROFILE AVATAR SOURCE
              </Text>

              {/* Option 1: Active car photo */}
              <Pressable
                style={[
                  styles.avatarOptionCard,
                  selectedAvatarSource === 'car' && styles.avatarOptionSelected,
                ]}
                onPress={() => setSelectedAvatarSource('car')}
              >
                <View style={styles.avatarPreviewWrap}>
                  {primaryVehicle?.photo_url ? (
                    <Image
                      source={{ uri: primaryVehicle.photo_url }}
                      style={styles.avatarThumb}
                    />
                  ) : (
                    <Icon name="car" size={18} color={Colors.accent.cyan} />
                  )}
                </View>
                <View style={styles.optionTextGroup}>
                  <Text variant="label" color={Colors.text.primary}>
                    Use Active Car Photo (Default)
                  </Text>
                  <Text variant="overline" color={Colors.text.tertiary}>
                    {primaryVehicle
                      ? `${primaryVehicle.make} ${primaryVehicle.model}`
                      : 'Uses primary vehicle photo'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    selectedAvatarSource === 'car' && styles.radioCircleActive,
                  ]}
                >
                  {selectedAvatarSource === 'car' && <View style={styles.radioDot} />}
                </View>
              </Pressable>

              {/* Option 2: Upload custom photo */}
              <Pressable
                style={[
                  styles.avatarOptionCard,
                  selectedAvatarSource === 'custom' && styles.avatarOptionSelected,
                ]}
                onPress={() => {
                  setSelectedAvatarSource('custom');
                  if (!customAvatarUri) {
                    handlePickCustomAvatar();
                  }
                }}
              >
                <View style={styles.avatarPreviewWrap}>
                  {customAvatarUri ? (
                    <Image source={{ uri: customAvatarUri }} style={styles.avatarThumb} />
                  ) : (
                    <Icon name="user" size={18} color={Colors.text.secondary} />
                  )}
                </View>
                <View style={styles.optionTextGroup}>
                  <Text variant="label" color={Colors.text.primary}>
                    Upload My Own Photo
                  </Text>
                  <Pressable onPress={handlePickCustomAvatar} hitSlop={6}>
                    <Text variant="overline" color={Colors.accent.cyan}>
                      {uploadingAvatar ? 'Uploading...' : 'Tap to choose photo'}
                    </Text>
                  </Pressable>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    selectedAvatarSource === 'custom' && styles.radioCircleActive,
                  ]}
                >
                  {selectedAvatarSource === 'custom' && <View style={styles.radioDot} />}
                </View>
              </Pressable>

              {/* Option 3: Initial */}
              <Pressable
                style={[
                  styles.avatarOptionCard,
                  selectedAvatarSource === 'initial' && styles.avatarOptionSelected,
                ]}
                onPress={() => setSelectedAvatarSource('initial')}
              >
                <View style={styles.avatarPreviewWrap}>
                  <Text variant="label" color={Colors.text.primary}>
                    {(handle || 'D').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.optionTextGroup}>
                  <Text variant="label" color={Colors.text.primary}>
                    Use Letter Initial
                  </Text>
                  <Text variant="overline" color={Colors.text.tertiary}>
                    Monogram from driver handle
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    selectedAvatarSource === 'initial' && styles.radioCircleActive,
                  ]}
                >
                  {selectedAvatarSource === 'initial' && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            </View>

            <Button variant="primary" onPress={handleSave} loading={saving}>
              Save Profile
            </Button>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: Colors.surface['1'],
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderWidth: 1,
    borderColor: Colors.hairline,
    maxHeight: '90%',
    padding: Spacing.screen,
    gap: Spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing[1],
  },
  closeBtn: {
    padding: Spacing[2],
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.iconChip,
  },
  scrollContent: {
    gap: Spacing[4],
    paddingBottom: Platform.OS === 'ios' ? Spacing.section : Spacing[4],
  },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    padding: Spacing[3],
    borderRadius: Radius.card,
  },
  fieldGroup: {
    gap: Spacing[2],
  },
  textInput: {
    height: 52,
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.button,
    paddingHorizontal: Spacing[4],
    color: Colors.text.primary,
    fontSize: 16,
    fontFamily: FontFamily.body,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  helperText: {
    marginTop: 2,
    fontSize: 10,
  },
  avatarOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface['2'],
    padding: Spacing[3],
    borderRadius: Radius.card,
    gap: Spacing[3],
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  avatarOptionSelected: {
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.surface['3'],
  },
  avatarPreviewWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface['1'],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  avatarThumb: {
    width: '100%',
    height: '100%',
  },
  optionTextGroup: {
    flex: 1,
    gap: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.text.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: Colors.accent.cyan,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent.cyan,
  },
});
