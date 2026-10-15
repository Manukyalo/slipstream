/**
 * Slipstream Design System — Token Layer
 *
 * Pure data. No JSX, no StyleSheet, no React imports.
 * Every colour, size and duration in the app traces back to this file.
 * Changing a value here propagates everywhere.
 *
 * Conventions
 * ─────────────────────────────────────────────────────────────────────────────
 *  Colors      : nested object — Colors.bg.base, Colors.text.primary, etc.
 *  Spacing     : flat 4-pt grid — Spacing[4], Spacing.screen, Spacing.gap
 *  Radius      : named semantically — Radius.card, Radius.button, Radius.pill
 *  Typography  : variant objects — Typography.display, Typography.body, etc.
 *  Depth       : shadow/glow definitions — Depth.L1, Depth.L2, Depth.heroGlow
 *  Motion      : duration + easing — Motion.fast, Motion.normal
 *  Gradient    : accent gradient colours + angle
 */

// ─────────────────────────────────────────────────────────────────────────────
// Colors
// ─────────────────────────────────────────────────────────────────────────────

export const Colors = {
  bg: {
    base: '#05070D',    // Deepest void — app background
    void: '#05070D',    // Alias for clarity in hero contexts
  },
  surface: {
    '0': '#05070D',     // Alias for bg.base, used in composites
    '1': '#0E131B',     // Primary card / tab bar surface
    '2': '#151B26',     // Elevated sheet / modal surface
    '3': '#1A2133',     // Higher elevated panes / dividers
  },
  hairline: 'rgba(255,255,255,0.06)', // 1-px dividers & card borders

  text: {
    primary:   '#F4F7FB',  // High-contrast readouts & headings
    secondary: '#9AA4B2',  // Supporting labels
    tertiary:  '#5E6877',  // Muted captions, inactive tab labels
    inverse:   '#05070D',  // Text on accent fills
  },

  accent: {
    cyan:     '#22D3EE',  // Primary live-data accent (speed, active state)
    blue:     '#3B82F6',  // Gradient endpoint / secondary accent
    cyanGlow: 'rgba(34,211,238,0.08)',  // Subtle glow fill for badges
    // Combined as the primary gradient: cyan → blue at 135°
    // Use Gradient.accent below for LinearGradient
  },

  semantic: {
    success: '#22C55E',
    warning: '#F59E0B',
    danger:  '#F43F5E',
    violet:  '#8B5CF6',
  },

  // Tint variants (16% opacity) — for IconChip backgrounds and FilterChip fills
  tint: {
    cyan:    'rgba(34,211,238,0.16)',
    blue:    'rgba(59,130,246,0.16)',
    success: 'rgba(34,197,94,0.16)',
    warning: 'rgba(245,158,11,0.16)',
    danger:  'rgba(244,63,94,0.16)',
    violet:  'rgba(139,92,246,0.16)',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Gradient
// ─────────────────────────────────────────────────────────────────────────────

export const Gradient = {
  /** Primary accent — cyan → blue, 135°.
   *  Pass `colors` to LinearGradient and use `start`/`end` for 135° angle. */
  accent: {
    colors: ['#22D3EE', '#3B82F6'] as [string, string],
    start:  { x: 0, y: 1 },  // 135° approximation for LinearGradient
    end:    { x: 1, y: 0 },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Spacing  —  4-pt grid
// ─────────────────────────────────────────────────────────────────────────────

export const Spacing = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,

  // Semantic aliases
  screen:  20,  // Horizontal page padding
  card:    20,  // Inner card padding
  gap:     12,  // Grid / row gap between siblings
  section: 32,  // Vertical gap between distinct sections
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Radius
// ─────────────────────────────────────────────────────────────────────────────

export const Radius = {
  card:     24,
  sheet:    28,
  iconChip: 12,
  button:   18,
  pill:     999,
  sm:       8,   // Small elements (tags, badges)
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Typography
//
// Font families map directly to the expo-font plugin baked names.
// Every variant is a StyleSheet-ready object (no fontVariant — add per-use
// where numeric content requires tabular-nums).
// ─────────────────────────────────────────────────────────────────────────────

export const FontFamily = {
  // Space Grotesk — headlines, metrics, numeric readouts
  display:         'SpaceGrotesk_700Bold',
  heading:         'SpaceGrotesk_600SemiBold',
  metric:          'SpaceGrotesk_600SemiBold',
  // Aliases used by Phase 8 components
  numberBold:      'SpaceGrotesk_700Bold',
  numberRegular:   'SpaceGrotesk_400Regular',
  spaceGroteskBold:'SpaceGrotesk_700Bold',

  // Inter — UI chrome, body, labels
  body:     'Inter_400Regular',
  label:    'Inter_500Medium',
  overline: 'Inter_600SemiBold',
} as const;

/** Reusable text style objects. Pair with `Colors.text.*` for colour. */
export const Typography = {
  /** Space Grotesk 700 · 44/48 */
  display: {
    fontFamily: FontFamily.display,
    fontSize:   44,
    lineHeight: 48,
    letterSpacing: -0.5,
  },
  /** Space Grotesk 700 · 28/34 */
  title: {
    fontFamily: FontFamily.display,
    fontSize:   28,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  /** Space Grotesk 600 · 20/26 */
  heading: {
    fontFamily: FontFamily.heading,
    fontSize:   20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  /** Space Grotesk 600 · 72/72 — hero numeric readout (speed, timer) */
  metricXL: {
    fontFamily:  FontFamily.metric,
    fontSize:    72,
    lineHeight:  72,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  /** Space Grotesk 600 · 32/36 — secondary numeric readout */
  metricL: {
    fontFamily:  FontFamily.metric,
    fontSize:    32,
    lineHeight:  36,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  /** Inter 400 · 16/24 */
  body: {
    fontFamily: FontFamily.body,
    fontSize:   16,
    lineHeight: 24,
  },
  /** Inter 500 · 13/18 */
  label: {
    fontFamily: FontFamily.label,
    fontSize:   13,
    lineHeight: 18,
  },
  /** Inter 600 · 12/16 — ALL CAPS, 8% letter-spacing */
  overline: {
    fontFamily:    FontFamily.overline,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: 0.96,   // 12 * 0.08 = 0.96
    textTransform: 'uppercase' as const,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Depth  —  shadow & glow definitions
// ─────────────────────────────────────────────────────────────────────────────

/** React Native shadow props for iOS. Android uses elevation. */
export const Depth = {
  /** L1 — card: hairline border only, no shadow */
  L1: {
    borderWidth:  1,
    borderColor:  Colors.hairline,
  },
  /** L2 — sheet: hairline border + soft drop shadow */
  L2: {
    borderWidth:  1,
    borderColor:  Colors.hairline,
    shadowColor:  '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius:  16,
    elevation:     8,
  },
  /** Hero glow — cyan aura around the primary metric readout */
  heroGlow: {
    shadowColor:   Colors.accent.cyan,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius:  24,
    elevation:     0, // Android doesn't support coloured shadows — skip
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Motion
// ─────────────────────────────────────────────────────────────────────────────

export const Motion = {
  fast:   200,  // Micro-interactions: toggle, chip select
  normal: 300,  // Standard transitions: sheet open, tab switch
  easing: 'ease-out' as const,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Convenience re-export as a single Theme object
// ─────────────────────────────────────────────────────────────────────────────

export const Theme = {
  // Structured token sets
  Colors,
  Gradient,
  Spacing,
  Radius,
  FontFamily,
  Typography,
  Depth,
  Motion,

  // Legacy flat / lowercase aliases for backwards compatibility
  colors: {
    bgVoid: '#0B0E11',           // Graphite void, never pure black
    surface: '#151A20',          // Pit-wall surface
    surfaceRaised: '#1D242C',    // Elevated telemetry pane
    surfaceBorder: '#232C36',    // 1px hairline border
    hairline: '#1D242C',         // Divider lines

    // Intent-driven functional accents
    signalCyan: '#34E5F0',       // Live-data ONLY (current speed, ready states, active telemetry)
    ignitionAmber: '#FF7A1A',    // Performance/drag ONLY (elapsed times, launch, g-force, stage)
    flagRed: '#FF3B4E',          // Hazard / warning / radar alert ONLY

    // Typography contrast
    textPrimary: '#EDEFF3',      // Primary readout
    textSecondary: '#A2ACB9',    // Secondary labels
    textMuted: '#7B8493',        // Captions, units, inactive states
    textInverse: '#0B0E11',      // On top of signal/amber fills
  },

  fonts: {
    numberRegular: 'SpaceGrotesk_400Regular',
    numberMedium: 'SpaceGrotesk_500Medium',
    numberSemiBold: 'SpaceGrotesk_600SemiBold',
    numberBold: 'SpaceGrotesk_700Bold',

    bodyRegular: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemiBold: 'Inter_600SemiBold',
    bodyBold: 'Inter_700Bold',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
    '4xl': 64,
  },

  radius: {
    xs: 4,
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 9999,
  },
} as const;

export type ThemeType = typeof Theme;

export { HeroStat } from '@/components/ui/HeroStat';
export { StatRow } from '@/components/ui/StatRow';

