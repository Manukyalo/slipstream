/**
 * DeleteAccountSheet — Destructive action confirmation requiring typed confirmation
 *
 * Requirements:
 *  - Destructive action is quiet until confirmed
 *  - Requires explicitly typing 'DELETE' into input
 *  - Calls deleteUserAccount and signs out
 */

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';

interface DeleteAccountSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirmDelete: () => Promise<void>;
}

const CONFIRM_PHRASE = 'DELETE';

export function DeleteAccountSheet({
  visible,
  onClose,
  onConfirmDelete,
}: DeleteAccountSheetProps) {
  const [typedText, setTypedText] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isConfirmed = typedText.trim().toUpperCase() === CONFIRM_PHRASE;

  const handleClose = () => {
    if (isDeleting) return;
    setTypedText('');
    setErrorMessage(null);
    onClose();
  };

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await onConfirmDelete();
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete account. Please try again.';
      setErrorMessage(msg);
      setIsDeleting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.dragHandle} />

          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Icon name="warning" size={24} color={Colors.semantic.danger} />
            </View>
            <Text variant="heading" color={Colors.semantic.danger} style={styles.title}>
              Delete Account
            </Text>
            <Text variant="body" color={Colors.text.secondary} style={styles.desc}>
              This action is permanent and immediate. All your recorded trips, drag runs, vehicle
              garage records, and leaderboard rankings will be permanently wiped.
            </Text>
          </View>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Text variant="label" color={Colors.semantic.danger}>
                {errorMessage}
              </Text>
            </View>
          )}

          <View style={styles.inputSection}>
            <Text variant="label" color={Colors.text.tertiary}>
              TYPE <Text variant="label" color={Colors.semantic.danger}>{CONFIRM_PHRASE}</Text> TO CONFIRM:
            </Text>
            <TextInput
              style={styles.input}
              placeholder={CONFIRM_PHRASE}
              placeholderTextColor={Colors.text.tertiary}
              value={typedText}
              onChangeText={setTypedText}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isDeleting}
            />
          </View>

          <View style={styles.actionRow}>
            <Button
              variant="secondary"
              onPress={handleClose}
              disabled={isDeleting}
              style={styles.cancelBtn}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onPress={handleDelete}
              disabled={!isConfirmed || isDeleting}
              loading={isDeleting}
              style={styles.deleteBtn}
            >
              Delete Forever
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
    borderColor: 'rgba(244, 63, 94, 0.3)',
    padding: Spacing.screen,
    gap: Spacing[4],
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surface['3'],
    alignSelf: 'center',
    marginBottom: Spacing[2],
  },
  header: {
    alignItems: 'center',
    gap: Spacing[2],
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  desc: {
    textAlign: 'center',
    lineHeight: 22,
  },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    padding: Spacing[3],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.semantic.danger,
  },
  inputSection: {
    gap: Spacing[2],
  },
  input: {
    height: 52,
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.button,
    paddingHorizontal: Spacing[4],
    color: Colors.semantic.danger,
    fontFamily: FontFamily.numberBold,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    letterSpacing: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing[3],
    marginTop: Spacing[2],
    paddingBottom: Platform.OS === 'ios' ? Spacing[4] : Spacing[2],
  },
  cancelBtn: {
    flex: 1,
  },
  deleteBtn: {
    flex: 1,
  },
});
