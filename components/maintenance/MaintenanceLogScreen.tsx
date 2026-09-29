import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
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

  let dueColor: string = Colors.textSecondary;
  let dueBg: string = Colors.bgElevated;
  let dueBorder: string = Colors.border;
  if (isOverdue) {
    dueColor = Colors.accentRed;
    dueBg = Colors.accentRedDim;
    dueBorder = Colors.accentRed;
  } else if (isDueSoon) {
    dueColor = Colors.accentOrange;
    dueBg = Colors.accentOrangeDim;
    dueBorder = Colors.accentOrange;
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
        <Text style={styles.logIcon}>{MAINTENANCE_TYPE_ICONS[type] ?? '🔧'}</Text>
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
        hitSlop={8}
        style={({ pressed }) => [styles.deleteLogBtn, pressed && styles.pressed]}
      >
        <Text style={styles.deleteLogIcon}>✕</Text>
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
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.accentCyan} />
            <Text style={styles.loadingText}>Loading service history…</Text>
          </View>
        ) : hasError ? (
          <View style={styles.centered}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Couldn&apos;t load records</Text>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
              onPress={loadData}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyIcon}>🔧</Text>
            <Text style={styles.emptyTitle}>No service records yet</Text>
            <Text style={styles.emptySubtitle}>
              Log your first maintenance entry to track costs and schedule reminders.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.emptyAddBtn, pressed && styles.pressed]}
              onPress={() => setAddModalVisible(true)}
            >
              <Text style={styles.emptyAddBtnText}>Log First Service</Text>
            </Pressable>
          </View>
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
    backgroundColor: Colors.bgBase,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: Spacing.base,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  headerSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.sm,
    minWidth: 60,
  },
  closeBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.accentCyan,
  },
  addBtn: {
    backgroundColor: Colors.accentCyanDim,
    borderWidth: 1,
    borderColor: Colors.accentCyan,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    minWidth: 60,
    alignItems: 'center',
  },
  addBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: Colors.accentCyan,
  },
  // Summary strip
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.md,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryCellValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  summaryCellLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
  },
  summarySep: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  dueBadge: {
    borderWidth: 1,
    borderRadius: Radius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  dueBadgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
  },
  // Log list
  listContent: {
    padding: Spacing.base,
    paddingBottom: Spacing['4xl'],
  },
  separator: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginVertical: 2,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  logIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
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
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.label,
    color: Colors.textPrimary,
    flex: 1,
  },
  logCost: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.label,
    color: Colors.accentCyan,
    marginLeft: Spacing.sm,
  },
  logDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
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
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
  },
  logMetaDot: {
    color: Colors.textMuted,
    fontSize: FontSize.caption,
  },
  logNextDue: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.accentOrange,
  },
  deleteLogBtn: {
    padding: Spacing.xs,
    marginTop: 2,
  },
  deleteLogIcon: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  // States
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  loadingText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textMuted,
  },
  errorIcon: {
    fontSize: 36,
  },
  errorTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  retryBtn: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.accentCyan,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  retryBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.label,
    color: Colors.accentCyan,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 17,
  },
  emptyAddBtn: {
    backgroundColor: Colors.accentCyan,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
  },
  emptyAddBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.label,
    color: Colors.textInverse,
  },
  pressed: {
    opacity: 0.7,
  },
});
