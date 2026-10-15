/**
 * EditProfileModal — Update driver handle & display preferences
 */

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export function EditProfileModal({ visible, onClose }: EditProfileModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [handle, setHandle] = useState<string>(profile?.display_name ?? '');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async () => {
    const cleanHandle = handle.trim().replace(/^@/, '');
    if (cleanHandle.length < 3 || cleanHandle.length > 20) {
      setErrorMsg('Handle must be between 3 and 20 characters.');
      return;
    }

    if (!user) return;
    setSaving(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: cleanHandle })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update handle.';
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

          <View style={styles.body}>
            {errorMsg && (
              <View style={styles.errorBox}>
                <Text variant="label" color={Colors.semantic.danger}>
                  {errorMsg}
                </Text>
              </View>
            )}

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
            </View>

            <Button variant="primary" onPress={handleSave} loading={saving}>
              Save Profile
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
    backgroundColor: Colors.surface['1'],
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    padding: Spacing.screen,
    gap: Spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing[2],
  },
  closeBtn: {
    padding: Spacing[2],
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.iconChip,
  },
  body: {
    gap: Spacing[4],
    paddingBottom: Platform.OS === 'ios' ? Spacing[4] : Spacing[2],
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
});
