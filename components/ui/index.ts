/**
 * components/ui/index.ts — barrel export
 *
 * Import from '@/components/ui' instead of individual files.
 * Example: import { Button, Card, Icon } from '@/components/ui';
 */

export { Icon } from './Icon';
export type { IconName, IconWeight } from './Icon';

export { Text } from './Text';
export type { TextVariant } from './Text';

export { IconChip } from './IconChip';
export type { IconChipColor } from './IconChip';

export { ScreenContainer } from './ScreenContainer';
export { Card } from './Card';
export { StatCard } from './StatCard';
export { Button } from './Button';
export type { ButtonVariant } from './Button';

export { Segmented } from './Segmented';
export { FilterChip } from './FilterChip';
export { ListRow } from './ListRow';

export { Skeleton, SkeletonCard, SkeletonMetric } from './Skeleton';
export { EmptyState } from './EmptyState';
export { ErrorState } from './ErrorState';
export { ToastProvider, useToast } from './Toast';
export type { ToastVariant } from './Toast';
export { BottomSheet } from './BottomSheet';

export { OtaUpdateBanner } from './OtaUpdateBanner';
export { OfflineSyncBanner } from './OfflineSyncBanner';
export { SplashGate } from './SplashGate';
export { ClusterGauge } from './ClusterGauge';
export type { ClusterGaugeMode, ClusterGaugeProps } from './ClusterGauge';
