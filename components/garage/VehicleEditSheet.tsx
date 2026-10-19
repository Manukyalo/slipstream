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
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useVehicleContext } from '@/contexts/VehicleContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import type { Vehicle } from '@/types/database';

interface VehicleEditSheetProps {
  visible: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
}

export function VehicleEditSheet({ visible, vehicle, onClose }: VehicleEditSheetProps) {
  const {
    vehicles,
    updateVehicleDetails,
    uploadPhoto,
    switchPrimary,
    moveTrips,
  } = useVehicleContext();
  const { speedUnit } = usePreferences();

  const [nickname, setNickname] = useState('');
  const [odometer, setOdometer] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [selectedMoveTargetId, setSelectedMoveTargetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [movingTrips, setMovingTrips] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (vehicle) {
      queueMicrotask(() => {
        setNickname(vehicle.nickname ?? '');
        setOdometer(vehicle.odometer ? String(vehicle.odometer) : '');
        setIsPrimary(vehicle.is_primary ?? false);
        setPhotoUri(vehicle.photo_url ?? null);
        setSelectedMoveTargetId(null);
        setErrorMsg(null);
      });
    }
  }, [vehicle]);

  if (!vehicle) return null;

  const otherVehicles = vehicles.filter((v) => v.id !== vehicle.id);

  const handlePickPhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Photo Library Access Required',
          'Please allow photo library access to update vehicle photo.',
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
        const localUri = result.assets[0].uri;
        setPhotoUri(localUri);
        await uploadPhoto(vehicle.id, localUri);
      }
    } catch (err) {
      console.error('[VehicleEditSheet] Photo pick failed:', err);
      Alert.alert('Upload Error', 'Could not update vehicle photo.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      const odoNum = odometer.trim() ? parseInt(odometer.trim(), 10) : 0;
      await updateVehicleDetails(vehicle.id, {
        nickname: nickname.trim() || null,
        odometer: isNaN(odoNum) ? 0 : odoNum,
      });

      if (isPrimary && !vehicle.is_primary) {
        await switchPrimary(vehicle.id);
      }

      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update vehicle';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleMoveTrips = async () => {
    if (!selectedMoveTargetId) return;
    const targetVehicle = otherVehicles.find((v) => v.id === selectedMoveTargetId);
    if (!targetVehicle) return;

    Alert.alert(
      'Confirm Move Drives',
      `Move all drives from ${vehicle.make} ${vehicle.model} to ${targetVehicle.make} ${targetVehicle.model}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move Drives',
          style: 'destructive',
          onPress: async () => {
            setMovingTrips(true);
            try {
              const movedCount = await moveTrips(vehicle.id, selectedMoveTargetId);
              Alert.alert('Drives Moved', `Successfully transferred ${movedCount} drives.`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Could not transfer drives';
              Alert.alert('Transfer Error', msg);
            } finally {
              setMovingTrips(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text variant="heading" color={Colors.text.primary}>
                Edit Vehicle
              </Text>
              <Text variant="label" color={Colors.text.tertiary}>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Icon name="close" size={20} color={Colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {errorMsg && (
              <View style={styles.errorBox}>
                <Text variant="label" color={Colors.semantic.danger}>
                  {errorMsg}
                </Text>
              </View>
            )}

            {/* Photo hero */}
            <Pressable style={styles.photoContainer} onPress={handlePickPhoto}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoImage} resizeMode="cover" />
              ) : (
                <View style={styles.photoFallback}>
                  <Icon name="camera" size={32} color={Colors.accent.cyan} />
                  <Text variant="label" color={Colors.text.secondary}>
                    Tap to add vehicle photo
                  </Text>
                </View>
              )}
              <View style={styles.photoOverlayBadge}>
                <Icon name="camera" size={14} color={Colors.text.primary} />
                <Text variant="overline" color={Colors.text.primary}>
                  CHANGE PHOTO
                </Text>
              </View>
            </Pressable>

            {/* Nickname Field */}
            <View style={styles.fieldGroup}>
              <Text variant="label" color={Colors.text.tertiary}>
                VEHICLE NICKNAME (OPTIONAL)
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Daily Driver, Track Weapon"
                placeholderTextColor={Colors.text.tertiary}
                value={nickname}
                onChangeText={setNickname}
                autoCorrect={false}
              />
            </View>

            {/* Odometer Field */}
            <View style={styles.fieldGroup}>
              <Text variant="label" color={Colors.text.tertiary}>
                ODOMETER ({speedUnit === 'mph' ? 'MILES' : 'KM'})
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="0"
                placeholderTextColor={Colors.text.tertiary}
                value={odometer}
                onChangeText={setOdometer}
                keyboardType="numeric"
              />
            </View>

            {/* Primary Vehicle Toggle */}
            <Pressable
              style={[styles.primaryToggleCard, isPrimary && styles.primaryToggleActive]}
              onPress={() => setIsPrimary((prev) => !prev)}
            >
              <View style={styles.toggleLeft}>
                <Icon
                  name="seal-check"
                  size={20}
                  color={isPrimary ? Colors.accent.cyan : Colors.text.tertiary}
                  weight={isPrimary ? 'fill' : 'regular'}
                />
                <View>
                  <Text variant="label" color={Colors.text.primary}>
                    Primary Active Vehicle
                  </Text>
                  <Text variant="overline" color={Colors.text.tertiary}>
                    Telemetry & gauge cluster link to this car
                  </Text>
                </View>
              </View>
              <View style={[styles.checkbox, isPrimary && styles.checkboxActive]}>
                {isPrimary && <Icon name="check" size={14} color={Colors.text.inverse} weight="bold" />}
              </View>
            </Pressable>

            {/* Move Drives Section (if user has other vehicles) */}
            {otherVehicles.length > 0 && (
              <Card style={styles.moveDrivesCard}>
                <View style={styles.moveDrivesHeader}>
                  <Icon name="path" size={18} color={Colors.accent.cyan} />
                  <Text variant="label" color={Colors.text.primary}>
                    Move Drives to Another Car
                  </Text>
                </View>
                <Text variant="body" color={Colors.text.secondary} style={styles.moveDrivesDesc}>
                  Transfer all recorded telemetry drives from this car to another vehicle in your garage.
                </Text>
                <View style={styles.targetVehiclesList}>
                  {otherVehicles.map((target) => {
                    const isSelected = selectedMoveTargetId === target.id;
                    return (
                      <Pressable
                        key={target.id}
                        style={[styles.targetVehicleChip, isSelected && styles.targetVehicleChipSelected]}
                        onPress={() => setSelectedMoveTargetId(target.id)}
                      >
                        <Text
                          variant="label"
                          color={isSelected ? Colors.accent.cyan : Colors.text.secondary}
                        >
                          {target.year} {target.make} {target.model}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {selectedMoveTargetId && (
                  <Button
                    variant="secondary"
                    onPress={handleMoveTrips}
                    loading={movingTrips}
                    iconLeft={<Icon name="arrow-right" size={16} color={Colors.accent.cyan} />}
                  >
                    Transfer Drives Now
                  </Button>
                )}
              </Card>
            )}
          </ScrollView>

          {/* Pinned Bottom Action */}
          <View style={styles.footer}>
            <Button variant="primary" onPress={handleSave} loading={saving}>
              Save Vehicle Changes
            </Button>
          </View>
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
    maxHeight: '92%',
    height: '90%',
    backgroundColor: Colors.surface['1'],
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderWidth: 1,
    borderColor: Colors.hairline,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing[4],
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  closeBtn: {
    padding: Spacing[2],
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.iconChip,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.screen,
    gap: Spacing[4],
    paddingBottom: Spacing[4],
  },
  footer: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing[3],
    paddingBottom: Platform.OS === 'ios' ? Spacing.screen : Spacing[4],
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
    backgroundColor: Colors.surface['1'],
  },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    padding: Spacing[3],
    borderRadius: Radius.card,
  },
  photoContainer: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.card,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
  },
  photoOverlayBadge: {
    position: 'absolute',
    bottom: Spacing[3],
    right: Spacing[3],
    backgroundColor: 'rgba(5, 7, 13, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
    paddingVertical: 6,
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.hairline,
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
    fontSize: 15,
    fontFamily: FontFamily.body,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  primaryToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface['2'],
    padding: Spacing[4],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  primaryToggleActive: {
    borderColor: Colors.accent.cyan,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: Colors.text.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.accent.cyan,
    borderColor: Colors.accent.cyan,
  },
  moveDrivesCard: {
    padding: Spacing[4],
    gap: Spacing[3],
    backgroundColor: Colors.surface['2'],
  },
  moveDrivesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  moveDrivesDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  targetVehiclesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },
  targetVehicleChip: {
    backgroundColor: Colors.surface['3'],
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  targetVehicleChipSelected: {
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.accent.cyanGlow,
  },
  actionButtons: {
    marginTop: Spacing[2],
  },
});
