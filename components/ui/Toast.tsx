/**
 * Toast — transient notification overlay
 *
 * Slides up from the bottom, auto-dismisses after 3 s.
 * Haptic on show. Four variants: success, warning, error, info.
 *
 * Architecture: managed via ToastContext — call showToast() from anywhere,
 * render <ToastHost /> once at the root of the app.
 *
 * Usage:
 *   // In a component:
 *   const { showToast } = useToast();
 *   showToast({ variant: 'success', message: 'Session saved.' });
 *
 *   // In _layout.tsx:
 *   <ToastHost />
 */

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Icon } from './Icon';
import { Text } from './Text';
import type { IconName } from './Icon';
import { useReduceMotion } from '@/hooks/useReduceMotion';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

interface ToastConfig {
  variant: ToastVariant;
  message: string;
  /** Auto-dismiss after this many ms (default 3000) */
  duration?: number;
}

interface ToastContextValue {
  showToast: (config: ToastConfig) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant config
// ─────────────────────────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<ToastVariant, { icon: IconName; color: string; bg: string }> = {
  success: {
    icon:  'check-circle',
    color: Colors.semantic.success,
    bg:    'rgba(34,197,94,0.12)',
  },
  warning: {
    icon:  'warning',
    color: Colors.semantic.warning,
    bg:    'rgba(245,158,11,0.12)',
  },
  error: {
    icon:  'x-circle',
    color: Colors.semantic.danger,
    bg:    'rgba(244,63,94,0.12)',
  },
  info: {
    icon:  'info',
    color: Colors.accent.cyan,
    bg:    Colors.tint.cyan,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider + Host
// ─────────────────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<ToastConfig | null>(null);
  const [slideAnim] = useState(() => new Animated.Value(100));
  const [opacityAnim] = useState(() => new Animated.Value(0));
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const dismiss = useCallback(() => {
    if (reduceMotion) {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => setCurrent(null));
      return;
    }
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue:         100,
        duration:        200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue:         0,
        duration:        200,
        useNativeDriver: true,
      }),
    ]).start(() => setCurrent(null));
  }, [slideAnim, opacityAnim, reduceMotion]);

  const showToast = useCallback(
    (config: ToastConfig) => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);

      setCurrent(config);

      // Haptic
      const haptic =
        config.variant === 'error' || config.variant === 'warning'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      haptic.catch(() => {});

      if (reduceMotion) {
        slideAnim.setValue(0);
        opacityAnim.setValue(0);
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      } else {
        // Slide in
        slideAnim.setValue(100);
        opacityAnim.setValue(0);
        Animated.parallel([
          Animated.spring(slideAnim, {
            toValue:         0,
            useNativeDriver: true,
            tension:         120,
            friction:        10,
          }),
          Animated.timing(opacityAnim, {
            toValue:         1,
            duration:        200,
            useNativeDriver: true,
          }),
        ]).start();
      }

      // Auto-dismiss
      dismissTimer.current = setTimeout(dismiss, config.duration ?? 3000);
    },
    [slideAnim, opacityAnim, dismiss, reduceMotion],
  );

  const config = current ? VARIANT_CONFIG[current.variant] : null;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {current && config && (
        <Animated.View
          style={[
            styles.toast,
            {
              backgroundColor: config.bg,
              borderColor:     config.color,
              bottom:          insets.bottom + Spacing[5],
              transform:       [{ translateY: slideAnim }],
              opacity:         opacityAnim,
            },
          ]}
        >
          <Icon name={config.icon} size={20} color={config.color} weight="fill" />
          <View style={styles.textBlock}>
            <Text variant="label" color={Colors.text.primary} style={styles.message}>
              {current.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  toast: {
    position:         'absolute',
    left:             Spacing.screen,
    right:            Spacing.screen,
    flexDirection:    'row',
    alignItems:       'center',
    gap:              Spacing[3],
    paddingVertical:  Spacing[3],
    paddingHorizontal: Spacing[4],
    borderRadius:     Radius.button,
    borderWidth:      1,
    // Elevation for Android
    elevation: 8,
    // Shadow for iOS
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.3,
    shadowRadius:   12,
  },
  textBlock: {
    flex: 1,
  },
  message: {
    fontWeight:  '500',
    lineHeight:  20,
  },
});
