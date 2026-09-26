import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/design';

// ---------------------------------------------------------------------------
// SplashGate
//
// Shown full-screen while the auth status is 'loading'.
// Replaces the native splash screen after fonts + session check start.
//
// Design: deep background, centered wordmark, animated cyan accent line.
// ---------------------------------------------------------------------------

export function SplashGate() {
  // useState gives a stable reference to the Animated.Value that is safe to
  // read in render and pass to Animated components without triggering
  // react-hooks/refs — the initializer runs exactly once.
  const [pulseAnim] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      {/* Wordmark */}
      <View style={styles.wordmark}>
        <Text style={styles.title}>Slipstream</Text>

        {/* Animated cyan underscore accent */}
        <Animated.View style={[styles.accent, { opacity: pulseAnim }]} />
      </View>

      {/* Tag line */}
      <Text style={styles.tagline}>Your drive. Your data.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  wordmark: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 36,
    letterSpacing: -0.5,
    color: Colors.textPrimary,
  },
  accent: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.accentCyan,
  },
  tagline: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.label,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
});
