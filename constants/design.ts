/**
 * Slipstream Design — Backward-Compatibility Layer
 *
 * Re-exports from the new canonical theme.ts so existing screens
 * continue to compile while they are migrated.
 *
 * DO NOT add new tokens here. Add them to theme.ts.
 * This file will be deleted once all imports are migrated.
 */

import {
  Colors as _C,
  Spacing as _S,
  FontFamily as _FF,
  Radius as _R,
  Gradient,
  Typography,
  Depth,
  Motion,
  Theme,
} from './theme';

// ─────────────────────────────────────────────────────────────────────────────
// Colors — extends new tokens with old flat aliases
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Migrate to Colors from @/constants/theme */
export const Colors = {
  // ── New structured tokens (still available) ──
  ..._C,

  // ── Old flat aliases ──
  bgBase:         _C.bg.base,
  bgVoid:         _C.bg.void,
  bgSurface:      _C.surface['1'],
  bgElevated:     _C.surface['2'],
  textPrimary:    _C.text.primary,
  textSecondary:  _C.text.secondary,
  textMuted:      _C.text.tertiary,
  textInverse:    '#05070D',
  accentCyan:     _C.accent.cyan,
  accentBlue:     _C.accent.blue,
  accentCyanDim:  _C.tint.cyan,
  accentOrange:   _C.semantic.warning,
  accentOrangeDim: 'rgba(245,158,11,0.16)',
  accentRed:      _C.semantic.danger,
  accentRedDim:   'rgba(244,63,94,0.16)',
  accentGreen:    _C.semantic.success,
  accentGreenDim: _C.tint.success,
  flagRed:        _C.semantic.danger,
  border:         _C.hairline,
  borderSubtle:   'rgba(255,255,255,0.04)',
  overlay:        'rgba(5,7,13,0.8)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Spacing — extends new tokens with old named aliases
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Migrate to Spacing from @/constants/theme */
export const Spacing = {
  // ── New numeric tokens ──
  ..._S,

  // ── Old named aliases ──
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 64,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// FontFamily — extends new tokens with old named aliases
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Migrate to FontFamily from @/constants/theme */
export const FontFamily = {
  ..._FF,

  // Old aliases
  regular:   _FF.body,
  medium:    _FF.label,
  semiBold:  _FF.heading,
  bold:      _FF.display,
  number:    _FF.metric,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Radius — extends new tokens with old named aliases
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Migrate to Radius from @/constants/theme */
export const Radius = {
  ..._R,

  // Old aliases
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  full: 999,
  pill: 999,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// FontSize (old) — kept verbatim
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated */
export const FontSize = {
  hero:    72,
  display: 44,
  h1:      28,
  h2:      20,
  body:    16,
  caption: 13,
  label:   12,
} as const;

/** @deprecated */
export const Duration = {
  fast:    200,
  normal:  300,
  slow:    400,
  shimmer: 1200,
  reveal:  300,
} as const;

/** @deprecated */
export const LineHeight = {
  tight:   1.2,
  normal:  1.4,
  relaxed: 1.6,
  h1:      34,
  h2:      26,
  body:    24,
  caption: 18,
  label:   16,
} as const;

// Re-export unchanged
export { Gradient, Typography, Depth, Motion, Theme };
