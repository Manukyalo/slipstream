import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
} from 'react-native';
import { Colors } from '@/constants/theme';

interface SplashGateProps {
  isReady: boolean;
  onFinish: () => void;
}

export function SplashGate({ isReady, onFinish }: SplashGateProps) {
  const [fadeAnim] = useState(() => new Animated.Value(1));
  const [glowScale] = useState(() => new Animated.Value(0.85));
  const [glowOpacity] = useState(() => new Animated.Value(0.2));
  const [pulseDone, setPulseDone] = useState(false);

  // Single glow pulse on launch
  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue:         1.18,
          duration:        550,
          easing:          Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue:         1.0,
          duration:        400,
          easing:          Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue:         0.85,
          duration:        550,
          easing:          Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue:         0.35,
          duration:        400,
          easing:          Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setPulseDone(true);
    });
  }, [glowScale, glowOpacity]);

  // Once ready and pulse is completed (or 1.2s timeout fallback), fade out smoothly in 400ms
  useEffect(() => {
    if (!isReady || !pulseDone) return;

    Animated.timing(fadeAnim, {
      toValue:         0,
      duration:        400,
      easing:          Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      onFinish();
    });
  }, [isReady, pulseDone, fadeAnim, onFinish]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.centerWrapper}>
        {/* Neon cyan aura behind the mark */}
        <Animated.View
          style={[
            styles.glowAura,
            {
              opacity:   glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />
        {/* Bare S-gauge mark matching native splash screen position and scale */}
        <Image
          source={require('../../assets/splash-mark.png')}
          style={styles.mark}
          resizeMode="contain"
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    bottom:          0,
    backgroundColor: Colors.bg.base,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          999,
  },
  centerWrapper: {
    width:           180,
    height:          180,
    alignItems:      'center',
    justifyContent:  'center',
  },
  glowAura: {
    position:        'absolute',
    width:           190,
    height:          190,
    borderRadius:    95,
    backgroundColor: Colors.accent.cyan,
    // Soft blur/glow on iOS
    shadowColor:     Colors.accent.cyan,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.8,
    shadowRadius:    32,
    elevation:       12,
  },
  mark: {
    width:  180,
    height: 180,
  },
});
