/**
 * Icon — curated Phosphor icon wrapper
 *
 * RULE: No screen or component imports from `phosphor-react-native` directly.
 *       Everything goes through this wrapper. To add an icon, add it to the
 *       MAP below and nowhere else.
 *
 * Icon weights used:
 *   'duotone' → content icons inside IconChips (decorative, visual weight)
 *   'regular' → inactive tab bar icons
 *   'fill'    → active tab bar icon
 *
 * Usage:
 *   <Icon name="gauge" weight="duotone" size={24} color={Colors.accent.cyan} />
 */

import React from 'react';
import {
  // Navigation
  Gauge,
  MapPin,
  Flag,
  Lightning,
  Trophy,
  ChartBar,
  UserCircle,
  // Actions
  Play,
  Stop,
  Pause,
  ArrowLeft,
  ArrowRight,
  ArrowClockwise,
  Plus,
  Minus,
  X,
  Check,
  CaretRight,
  CaretDown,
  DotsThreeVertical,
  // Status / telemetry
  Warning,
  Info,
  CheckCircle,
  XCircle,
  Spinner,
  WifiHigh,
  WifiSlash,
  // Driving / motorsport
  Car,
  RoadHorizon,
  Timer,
  Speedometer,
  // Settings / profile
  Gear,
  Bell,
  Lock,
  Shield,
  SignOut,
  User,
  Camera,
  Pencil,
  Trash,
  // Misc
  ShareNetwork,
  Link,
  Globe,
  SealCheck,
  BookmarkSimple,
  MagnifyingGlass,
  Wrench,
} from 'phosphor-react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Type definitions
// ─────────────────────────────────────────────────────────────────────────────

export type IconName = keyof typeof ICON_MAP;
export type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  weight?: IconWeight;
  /** Pass style prop for margin/position overrides — not for colour/size */
  style?: object;
}

// ─────────────────────────────────────────────────────────────────────────────
// Curated icon map — ~42 icons
// Only import what you need. Adding here is the only change required to
// support a new icon anywhere in the app.
// ─────────────────────────────────────────────────────────────────────────────

const ICON_MAP = {
  // Navigation
  gauge:          Gauge,
  'map-pin':      MapPin,
  flag:           Flag,
  lightning:      Lightning,
  trophy:         Trophy,
  'chart-bar':    ChartBar,
  'user-circle':  UserCircle,
  // Actions
  play:           Play,
  stop:           Stop,
  pause:          Pause,
  'arrow-left':   ArrowLeft,
  'arrow-right':  ArrowRight,
  refresh:        ArrowClockwise,
  plus:           Plus,
  minus:          Minus,
  close:          X,
  check:          Check,
  'caret-right':  CaretRight,
  'caret-down':   CaretDown,
  'more-vertical': DotsThreeVertical,
  // Status
  warning:        Warning,
  info:           Info,
  'check-circle': CheckCircle,
  'x-circle':     XCircle,
  spinner:        Spinner,
  wifi:           WifiHigh,
  'wifi-off':     WifiSlash,
  // Driving
  car:            Car,
  path:           RoadHorizon,
  timer:          Timer,
  speedometer:    Speedometer,
  // Settings / profile
  gear:           Gear,
  bell:           Bell,
  lock:           Lock,
  shield:         Shield,
  'sign-out':     SignOut,
  user:           User,
  camera:         Camera,
  pencil:         Pencil,
  trash:          Trash,
  // Misc
  share:          ShareNetwork,
  link:           Link,
  globe:          Globe,
  'seal-check':   SealCheck,
  bookmark:       BookmarkSimple,
  search:         MagnifyingGlass,
  wrench:         Wrench,
} as const satisfies Record<string, React.ComponentType<{ size?: number; color?: string; weight?: IconWeight; style?: object }>>;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function Icon({ name, size = 24, color, weight = 'regular', style }: IconProps) {
  const PhosphorIcon = ICON_MAP[name];
  if (!PhosphorIcon) {
    if (__DEV__) {
      console.warn(`[Icon] Unknown icon name: "${name}". Add it to ICON_MAP in components/ui/Icon.tsx`);
    }
    return null;
  }
  return <PhosphorIcon size={size} color={color} weight={weight} style={style} />;
}
