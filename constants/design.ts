/**
 * Slipstream Design Tokens & Compatibility Layer
 *
 * Mapped to the motorsport telemetry design system in theme.ts.
 */

import { Theme } from './theme';

export * from './theme';

export const Colors = {
  // Backgrounds
  bgBase: Theme.colors.bgVoid,
  bgSurface: Theme.colors.surface,
  bgElevated: Theme.colors.surfaceRaised,

  // Borders
  border: Theme.colors.surfaceBorder,
  borderSubtle: Theme.colors.hairline,

  // Accents
  accentCyan: Theme.colors.signalCyan,
  accentCyanDim: 'rgba(52, 229, 240, 0.12)',
  accentOrange: Theme.colors.ignitionAmber,
  accentOrangeDim: 'rgba(255, 122, 26, 0.12)',
  accentGreen: '#22C55E',
  accentGreenDim: 'rgba(34, 197, 94, 0.12)',
  accentRed: Theme.colors.flagRed,
  accentRedDim: 'rgba(255, 59, 78, 0.14)',

  // Text
  textPrimary: Theme.colors.textPrimary,
  textSecondary: Theme.colors.textSecondary,
  textMuted: Theme.colors.textMuted,
  textInverse: Theme.colors.textInverse,

  // Overlay
  overlay: 'rgba(11, 14, 17, 0.85)',
} as const;

export const Spacing = Theme.spacing;
export const Radius = Theme.radius;

export const FontFamily = {
  // Space Grotesk for numbers/readouts
  number: 'SpaceGrotesk_700Bold',
  numberMedium: 'SpaceGrotesk_500Medium',
  bold: 'SpaceGrotesk_700Bold',
  semiBold: 'SpaceGrotesk_600SemiBold',

  // Inter for UI chrome and body
  medium: 'Inter_500Medium',
  regular: 'Inter_400Regular',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

export const FontSize = {
  hero: 56,
  display: 40,
  h1: 28,
  h2: 20,
  body: 15,
  caption: 13,
  label: 11,
} as const;

export const Duration = {
  fast: 150,
  normal: 250,
  slow: 350,
  shimmer: 1200,
  reveal: 250,
} as const;

export const LineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
  hero: 64,
  h1: 34,
  h2: 26,
} as const;
