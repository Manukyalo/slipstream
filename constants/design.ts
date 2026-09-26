/**
 * Slipstream Design Tokens
 *
 * Single source of truth for all colors, spacing, typography, and radii.
 * Import from here; never hardcode a color or magic number in a component.
 */

export const Colors = {
  // Backgrounds
  bgBase: '#080B14',
  bgSurface: '#0F1421',
  bgElevated: '#181E2E',

  // Borders
  border: '#273147',
  borderSubtle: '#1C2535',

  // Accents
  accentCyan: '#00D4FF',
  accentCyanDim: 'rgba(0, 212, 255, 0.15)',
  accentOrange: '#FF6B35',
  accentOrangeDim: 'rgba(255, 107, 53, 0.15)',
  accentGreen: '#22C55E',
  accentGreenDim: 'rgba(34, 197, 94, 0.15)',
  accentRed: '#EF4444',
  accentRedDim: 'rgba(239, 68, 68, 0.15)',

  // Text
  textPrimary: '#EDF1FB',
  textSecondary: '#8B96B0',
  textMuted: '#4B5470',
  textInverse: '#080B14',

  // Overlay
  overlay: 'rgba(8, 11, 20, 0.75)',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const FontFamily = {
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semiBold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
} as const;

export const FontSize = {
  display: 32,
  h1: 24,
  h2: 20,
  body: 15,
  label: 13,
  caption: 11,
  mono: 14,
} as const;

export const LineHeight = {
  display: 37,
  h1: 29,
  h2: 26,
  body: 22,
  label: 18,
  caption: 15,
  mono: 17,
} as const;

export const Duration = {
  micro: 150,
  standard: 250,
  reveal: 400,
  shimmer: 1400,
} as const;

export type ColorKey = keyof typeof Colors;
