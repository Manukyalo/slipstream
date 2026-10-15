/**
 * BottomSheet — modal sheet that slides up from the bottom
 *
 * - Blurred/dimmed backdrop
 * - Drag handle
 * - radius=28 top corners
 * - Keyboard-avoiding (shifts up when keyboard opens)
 * - Dismissable by tapping backdrop or dragging down
 *
 * Usage:
 *   <BottomSheet visible={open} onDismiss={() => setOpen(false)} title="Options">
 *     <ListRow ... />
 *   </BottomSheet>
 */

import React, { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Text } from './Text';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface BottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  /** Extra style for the sheet container */
  sheetStyle?: ViewStyle;
  children: React.ReactNode;
}

export function BottomSheet({
  visible,
  onDismiss,
  title,
  sheetStyle,
  children,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [slideAnim] = useState(() => new Animated.Value(SCREEN_HEIGHT));
  const [backdropAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue:         0,
          useNativeDriver: true,
          tension:         80,
          friction:        12,
        }),
        Animated.timing(backdropAnim, {
          toValue:         1,
          duration:        250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue:         SCREEN_HEIGHT,
          duration:        220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue:         0,
          duration:        200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Backdrop */}
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + Spacing[5],
              transform:     [{ translateY: slideAnim }],
            },
            sheetStyle,
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Optional title */}
          {title && (
            <View style={styles.titleRow}>
              <Text variant="heading">{title}</Text>
            </View>
          )}

          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:           1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    backgroundColor:  Colors.surface['2'],
    borderTopLeftRadius:  Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderWidth:      1,
    borderColor:      Colors.hairline,
    paddingTop:       Spacing[2],
    paddingHorizontal: Spacing.screen,
    // iOS shadow
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius:  20,
    elevation:     16,
  },
  handle: {
    width:           40,
    height:          4,
    borderRadius:    Radius.pill,
    backgroundColor: Colors.hairline,
    alignSelf:       'center',
    marginBottom:    Spacing[4],
  },
  titleRow: {
    marginBottom: Spacing[4],
  },
});
