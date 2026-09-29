import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Switch,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/design';
import { saveRoad, formatRoadLength, type SavedRoad } from '@/services/savedRoads';

interface SaveRoadModalProps {
  visible: boolean;
  onClose: () => void;
  routeWkt: string | null;
  distanceMeters: number;
  onSaved?: (road: SavedRoad) => void;
}

export function SaveRoadModal({
  visible,
  onClose,
  routeWkt,
  distanceMeters,
  onSaved,
}: SaveRoadModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      Alert.alert('Name Required', 'Please enter a road name of at least 2 characters.');
      return;
    }

    if (!routeWkt) {
      Alert.alert('No Route Data', 'Unable to find GPS coordinates for this route.');
      return;
    }

    setIsSaving(true);
    try {
      const road = await saveRoad({
        name: trimmedName,
        description: description.trim() || undefined,
        routeWkt,
        isPublic,
      });

      Alert.alert('Road Saved', `"${road.name}" added to your favorite roads!`);
      setName('');
      setDescription('');
      onSaved?.(road);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Save Failed', msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Save Favorite Road</Text>
              <Text style={styles.sub}>
                {formatRoadLength(distanceMeters)} · GPS route captured
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              hitSlop={12}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>ROAD NAME *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Angeles Crest Highway"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
              maxLength={100}
              autoFocus
            />

            <Text style={[styles.label, { marginTop: Spacing.md }]}>
              NOTES / DESCRIPTION (OPTIONAL)
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. High elevation, smooth tarmac, best at sunrise"
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              maxLength={500}
              multiline
              numberOfLines={3}
            />

            {/* Public toggle */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Share with Community</Text>
                <Text style={styles.toggleSub}>
                  {isPublic
                    ? 'Visible to nearby drivers on Slipstream'
                    : 'Private only to you'}
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: Colors.border, true: Colors.accentCyan }}
                thumbColor={Colors.textPrimary}
              />
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
              onPress={onClose}
              disabled={isSaving}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={Colors.textInverse} />
              ) : (
                <Text style={styles.saveBtnText}>Save Road</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgSurface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h2,
    color: Colors.textPrimary,
  },
  sub: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.accentCyan,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  form: {
    marginVertical: Spacing.sm,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.bgBase,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
  },
  textArea: {
    height: 72,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  toggleTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  toggleSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? Spacing.lg : Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: Colors.accentCyan,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textInverse,
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.75,
  },
});
