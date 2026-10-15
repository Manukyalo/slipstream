import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  deleteMaintenanceLog,
  fetchMaintenanceLogs,
  fetchMaintenanceSummary,
  MAINTENANCE_TYPE_ICONS,
  MAINTENANCE_TYPE_LABELS,
  type MaintenanceType,
  type VehicleMaintenanceSummary,
} from '@/services/maintenance';
import type { MaintenanceLog } from '@/types/database';
import { AddMaintenanceModal } from './AddMaintenanceModal';

interface MaintenanceLogScreenProps {
  visible: boolean;
  vehicleId: string;
  vehicleName: string;
  onClose: () => void;
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatOdometer(odo: number): string {
  return odo.toLocaleString('en-US') + ' km';
}

function daysUntil(iso: string): number {
  const due = new Date(iso + 'T00:00:00').getTime();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((due - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Summary Strip ──────────────────────────────────────────────────────────

interface SummaryStripProps {
  summary: VehicleMaintenanceSummary;
}

function SummaryStrip({ summary }: SummaryStripProps) {
  const hasDue = !!summary.nextDueDate;
  const days = hasDue ? daysUntil(summary.nextDueDate!) : null;
  const isOverdue = days !== null && days < 0;
  const isDueSoon = days !== null && days >= 0 && days <= 14;

  let dueColor: string = Colors.text.secondary;
  let dueBg: string = Colors.surface['2'];
  let dueBorder: string = Colors.hairline;
  if (isOverdue) {
    dueColor = Colors.semantic.danger;
    dueBg = Colors.tint.danger;
    dueBorder = Colors.semantic.danger;
  } else if (isDueSoon) {
    dueColor = Colors.semantic.warning;
    dueBg = Colors.tint.warning;
    dueBorder = Colors.semantic.warning;
  }

  const dueLabel = hasDue
    ? isOverdue
      ? `${Math.abs(days!)}d overdue`
      : days === 0
        ? 'Due today'
        : `Due in ${days}d`
    : 'No upcoming service';

  return (
    <View style={styles.summaryStrip}>
      {/* Total spend */}
      <View style={styles.summaryCell}>
        <Text style={styles.summaryCellValue}>{formatCurrency(summary.totalCost)}</Text>
        <Text style={styles.summaryCellLabel}>Total Spend</Text>
      </View>

      <View style={styles.summarySep} />

      {/* Total logs */}
      <View style={styles.summaryCell}>
        <Text style={styles.summaryCellValue}>{summary.totalLogs}</Text>
        <Text style={styles.summaryCellLabel}>Service Records</Text>
      </View>

      <View style={styles.summarySep} />

      {/* Next due */}
      <View style={styles.summaryCell}>
        <View style={[styles.dueBadge, { backgroundColor: dueBg, borderColor: dueBorder }]}>
          <Text style={[styles.dueBadgeText, { color: dueColor }]}>
            {hasDue
              ? `${MAINTENANCE_TYPE_ICONS[summary.upcomingServiceType ?? 'other']} ${dueLabel}`
              : dueLabel}
          </Text>
        </View>
        <Text style={styles.summaryCellLabel}>
          {hasDue ? formatDate(summary.nextDueDate) : 'Next Service'}
        </Text>
      </View>
    </View>
  );
}

// ─── Log Row ─────────────────────────────────────────────────────────────────

interface LogRowProps {
  log: MaintenanceLog;
  onDelete: (id: string) => void;
}

function LogRow({ log, onDelete }: LogRowProps) {
  const type = log.type as MaintenanceType;

  const handleDelete = () => {
    Alert.alert(
      'Remove Record',
      `Delete this ${MAINTENANCE_TYPE_LABELS[type] ?? 'service'} record?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(log.id) },
      ],
    );
  };

  return (
    <View style={styles.logRow}>
      <View style={styles.logIconBox}>
        <Icon name={MAINTENANCE_TYPE_ICONS[type] ?? 'wrench'} size={18} color={Colors.accent.cyan} />
      </View>

      <View style={styles.logContent}>
        <View style={styles.logTopRow}>
          <Text style={styles.logType} numberOfLines={1}>
            {MAINTENANCE_TYPE_LABELS[type] ?? 'Service'}
          </Text>
          <Text style={styles.logCost}>{formatCurrency(Number(log.cost))}</Text>
        </View>

        <Text style={styles.logDesc} numberOfLines={2}>
          {log.description}
        </Text>

        <View style={styles.logMeta}>
          <Text style={styles.logMetaText}>{formatDate(log.service_date)}</Text>
          <Text style={styles.logMetaDot}>·</Text>
          <Text style={styles.logMetaText}>{formatOdometer(log.odometer)}</Text>
          {log.next_due_date && (
            <>
              <Text style={styles.logMetaDot}>·</Text>
              <Text style={styles.logNextDue}>
                Next: {formatDate(log.next_due_date)}
              </Text>
            </>
          )}
        </View>
      </View>

      <Pressable
        onPress={handleDelete}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Delete service record"
        style={({ pressed }) => [styles.deleteLogBtn, pressed && styles.pressed]}
      >
        <Icon name="trash" size={14} color={Colors.text.tertiary} />
      </Pressable>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function MaintenanceLogScreen({
  visible,
  vehicleId,
  vehicleName,
  onClose,
}: MaintenanceLogScreenProps) {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [summary, setSummary] = useState<VehicleMaintenanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  // Load data when modal becomes visible or refreshKey increments
  useEffect(() => {
    if (!visible || !vehicleId) return;
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const [fetchedLogs, fetchedSummary] = await Promise.all([
          fetchMaintenanceLogs(vehicleId),
          fetchMaintenanceSummary(vehicleId),
        ]);
        if (!cancelled) { setLogs(fetchedLogs); setSummary(fetchedSummary); }
      } catch (err) {
        console.error('[MaintenanceLogScreen] Load failed:', err);
        if (!cancelled) setHasError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [visible, vehicleId, refreshKey]);

  const loadData = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleDelete = async (logId: string) => {
    try {
      await deleteMaintenanceLog(logId);
      loadData(); // refresh to recompute summary
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not delete record.';
      Alert.alert('Error', msg);
    }
  };

  const handleSaved = () => {
    setAddModalVisible(false);
    loadData();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            onPress={onClose}
            hitSlop={8}
          >
            <Text style={styles.closeBtnText}>‹ Back</Text>
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Maintenance Log</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {vehicleName}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
            onPress={() => setAddModalVisible(true)}
          >
            <Text style={styles.addBtnText}>+ Log</Text>
          </Pressable>
        </View>

        {/* Summary strip */}
        {summary && !isLoading && <SummaryStrip summary={summary} />}

        {/* Content */}
        {isLoading ? (
          <View style={styles.skeletonWrap}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : hasError ? (
          <ErrorState
            message="Couldn't load service records. Please check your connection."
            onRetry={loadData}
          />
        ) : logs.length === 0 ? (
          <EmptyState
            icon="wrench"
            iconColor="cyan"
            title="No service records yet"
            description="Log your first maintenance entry to track costs and schedule reminders."
            action={{
              label: 'Log First Service',
              onPress: () => setAddModalVisible(true),
            }}
          />
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <LogRow log={item} onDelete={handleDelete} />
            )}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Add entry modal */}
        <AddMaintenanceModal
          visible={addModalVisible}
          vehicleId={vehicleId}
          vehicleName={vehicleName}
          onClose={() => setAddModalVisible(false)}
          onSaved={handleSaved}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: Spacing[4],
    paddingHorizontal: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: Spacing[2],
  },
  headerTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 16,
    color: Colors.text.primary,
  },
  headerSub: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  closeBtn: {
    paddingVertical: Spacing[1],
    paddingRight: Spacing[2],
    minWidth: 60,
  },
  closeBtnText: {
    fontFamily: FontFamily.heading,
    fontSize: 16,
    color: Colors.accent.cyan,
  },
  addBtn: {
    backgroundColor: Colors.tint.cyan,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
    borderRadius: Radius.sm,
    paddingVertical: Spacing[1],
    paddingHorizontal: Spacing.gap,
    minWidth: 60,
    alignItems: 'center',
  },
  addBtnText: {
    fontFamily: FontFamily.display,
    fontSize: 12,
    color: Colors.accent.cyan,
  },
  // Summary strip
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.surface['1'],
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing.gap,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryCellValue: {
    fontFamily: FontFamily.display,
    fontSize: 16,
    color: Colors.text.primary,
  },
  summaryCellLabel: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  summarySep: {
    width: 1,
    backgroundColor: Colors.hairline,
    marginVertical: 4,
  },
  dueBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
  },
  dueBadgeText: {
    fontFamily: FontFamily.heading,
    fontSize: 12,
  },
  // Log list
  listContent: {
    padding: Spacing[4],
    paddingBottom: 80,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.hairline,
    marginVertical: 2,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.gap,
    gap: Spacing.gap,
  },
  logIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.surface['2'],
    borderWidth: 1,
    borderColor: Colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logIcon: {
    fontSize: 20,
  },
  logContent: {
    flex: 1,
    gap: 3,
  },
  logTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logType: {
    fontFamily: FontFamily.heading,
    fontSize: 13,
    color: Colors.text.primary,
    flex: 1,
  },
  logCost: {
    fontFamily: FontFamily.display,
    fontSize: 13,
    color: Colors.accent.cyan,
    marginLeft: Spacing[2],
  },
  logDesc: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  logMetaText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  logMetaDot: {
    color: Colors.text.tertiary,
    fontSize: 12,
  },
  logNextDue: {
    fontFamily: FontFamily.label,
    fontSize: 12,
    color: Colors.semantic.warning,
  },
  deleteLogBtn: {
    padding: Spacing[1],
    marginTop: 2,
  },
  deleteLogIcon: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  // States
  skeletonWrap: {
    padding: Spacing.screen,
    gap: Spacing.gap,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[6],
    gap: Spacing.gap,
  },
  loadingText: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.text.tertiary,
  },
  errorIcon: {
    fontSize: 36,
  },
  errorTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  retryBtn: {
    backgroundColor: Colors.surface['2'],
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
    borderRadius: 10,
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[6],
  },
  retryBtnText: {
    fontFamily: FontFamily.heading,
    fontSize: 13,
    color: Colors.accent.cyan,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontFamily: FontFamily.display,
    fontSize: 16,
    color: Colors.text.primary,
  },
  emptySubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.text.tertiary,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 17,
  },
  emptyAddBtn: {
    backgroundColor: Colors.accent.cyan,
    borderRadius: 10,
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[6],
    marginTop: Spacing[2],
  },
  emptyAddBtnText: {
    fontFamily: FontFamily.display,
    fontSize: 13,
    color: Colors.text.inverse,
  },
  pressed: {
    opacity: 0.7,
  },
});

