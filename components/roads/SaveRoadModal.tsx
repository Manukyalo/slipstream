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
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { saveRoad, formatRoadLength, type SavedRoad } from '@/services/savedRoads';
import { Icon } from '@/components/ui/Icon';
import { toUserMessage } from '@/utils/toUserMessage';

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
  // Task 5: Default private
  const [isPublic, setIsPublic] = useState(false);
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

      Alert.alert(
        'Road Saved',
        `"${road.name}" added to your saved roads${isPublic ? ' and shared with community' : ' (private)'}!`,
      );
      setName('');
      setDescription('');
      onSaved?.(road);
      onClose();
    } catch (err) {
      const msg = toUserMessage(err);
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
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Icon name="close" size={18} color={Colors.text.secondary} />
            </Pressable>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>ROAD NAME *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Angeles Crest Highway"
              placeholderTextColor={Colors.text.tertiary}
              value={name}
              onChangeText={setName}
              maxLength={100}
              autoFocus
            />

            <Text style={[styles.label, { marginTop: Spacing[4] }]}>
              NOTES / DESCRIPTION (OPTIONAL)
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. High elevation, smooth tarmac, best at sunrise"
              placeholderTextColor={Colors.text.tertiary}
              value={description}
              onChangeText={setDescription}
              maxLength={500}
              multiline
              numberOfLines={3}
            />

            {/* Public toggle (default private) */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.toggleTitleRow}>
                  <Text style={styles.toggleTitle}>Share with Community</Text>
                  <View style={[styles.badge, isPublic ? styles.publicBadge : styles.privateBadge]}>
                    <Text style={[styles.badgeText, isPublic ? styles.publicBadgeText : styles.privateBadgeText]}>
                      {isPublic ? 'PUBLIC' : 'PRIVATE'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.toggleSub}>
                  {isPublic
                    ? 'Visible to nearby drivers on Slipstream.'
                    : 'Private only to you. Hidden from nearby explorer.'}
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: Colors.hairline, true: Colors.accent.cyan }}
                thumbColor={isPublic ? '#05070D' : Colors.text.secondary}
              />
            </View>

            {/* Server-side privacy guarantee callout */}
            {isPublic && (
              <View style={styles.privacyNotice}>
                <Icon name="shield" size={16} color={Colors.accent.cyan} weight="duotone" />
                <Text style={styles.privacyNoticeText}>
                  Privacy Protected: Slipstream automatically trims the first & last 300 m on the server to prevent exposing home addresses.
                </Text>
              </View>
            )}
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
                <ActivityIndicator size="small" color="#05070D" />
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
    backgroundColor: 'rgba(5, 7, 13, 0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface[1], // #0E131B
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
    fontVariant: ['tabular-nums'],
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface[2],
  },
  form: {
    marginBottom: Spacing.section,
  },
  label: {
    fontFamily: FontFamily.overline,
    fontSize: 11,
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
    marginBottom: Spacing[2],
  },
  input: {
    backgroundColor: Colors.surface[2],
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.hairline,
    color: Colors.text.primary,
    fontFamily: FontFamily.body,
    fontSize: 15,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface[2],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing[4],
    marginTop: Spacing[4],
    gap: Spacing.gap,
  },
  toggleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 14,
    color: Colors.text.primary,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  publicBadge: {
    backgroundColor: Colors.tint.cyan,
  },
  privateBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  badgeText: {
    fontFamily: FontFamily.heading,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  publicBadgeText: {
    color: Colors.accent.cyan,
  },
  privateBadgeText: {
    color: Colors.text.secondary,
  },
  toggleSub: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 3,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.tint.cyan,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.25)',
    borderRadius: Radius.card,
    padding: Spacing[3],
    marginTop: Spacing[3],
  },
  privacyNoticeText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.accent.cyan,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.gap,
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
  saveBtn: {
    flex: 1.6,
    paddingVertical: 14,
    borderRadius: Radius.button,
    backgroundColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontFamily: FontFamily.heading,
    fontSize: 15,
    color: '#05070D',
  },
  pressed: {
    opacity: 0.75,
  },
});
