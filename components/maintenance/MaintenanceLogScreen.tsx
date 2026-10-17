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
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { usePreferences } from '@/contexts/PreferencesContext';
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

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatOdometer(odo: number): string {
  return odo.toLocaleString('en-US') + ' km';
}

// ─── Summary Strip ──────────────────────────────────────────────────────────

interface SummaryStripProps {
  summary: VehicleMaintenanceSummary;
  formatCurrency: (amount: number, override?: string) => string;
}

function SummaryStrip({ summary, formatCurrency }: SummaryStripProps) {
  const hasDue = !!summary.nextDueDate;

  return (
    <View style={styles.summaryStrip}>
      {/* Column 1: Total spend */}
      <View style={styles.summaryCell}>
        <Text style={styles.summaryCellValue}>
          {formatCurrency(summary.totalCost, summary.currency)}
        </Text>
        <Text style={styles.summaryCellLabel}>Total Spend</Text>
      </View>

      <View style={styles.summarySep} />

      {/* Column 2: Total service records */}
      <View style={styles.summaryCell}>
        <Text style={styles.summaryCellValue}>{summary.totalLogs}</Text>
        <Text style={styles.summaryCellLabel}>Service Records</Text>
      </View>

      <View style={styles.summarySep} />

      {/* Column 3: Next Service */}
      <View style={styles.summaryCell}>
        <Text style={styles.summaryCellValue} numberOfLines={1}>
          {hasDue ? formatDate(summary.nextDueDate) : 'None'}
        </Text>
        <Text style={styles.summaryCellLabel}>Next Service</Text>
      </View>
    </View>
  );
}

// ─── Log Row ─────────────────────────────────────────────────────────────────

interface LogRowProps {
  log: MaintenanceLog;
  onDelete: (id: string) => void;
  formatCurrency: (amount: number, override?: string) => string;
}

function LogRow({ log, onDelete, formatCurrency }: LogRowProps) {
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

  const logCurrency = (log as unknown as { currency?: string }).currency;

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
          <Text style={styles.logCost}>{formatCurrency(Number(log.cost), logCurrency)}</Text>
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
  const { formatCurrency } = usePreferences();
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
      <ScreenContainer
        title="Maintenance Log"
        subtitle={vehicleName}
        headerLeft={
          <Pressable
            style={({ pressed }) => [styles.headerBackBtn, pressed && styles.pressed]}
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Icon name="arrow-left" size={20} color={Colors.text.primary} />
          </Pressable>
        }
        headerRight={
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
            onPress={() => setAddModalVisible(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Log service"
          >
            <Text style={styles.addBtnText}>+ Log</Text>
          </Pressable>
        }
      >
        {/* Summary strip */}
        {summary && !isLoading && (
          <SummaryStrip summary={summary} formatCurrency={formatCurrency} />
        )}

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
              label: 'Log first service',
              onPress: () => setAddModalVisible(true),
              variant: 'primary',
              fullWidth: true,
            }}
          />
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <LogRow log={item} onDelete={handleDelete} formatCurrency={formatCurrency} />
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
      </ScreenContainer>
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
  headerBackBtn: {
    padding: Spacing[1],
    justifyContent: 'center',
    alignItems: 'center',
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
    alignItems: 'center',
    backgroundColor: Colors.surface['1'],
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing.gap,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  summaryCellValue: {
    fontFamily: FontFamily.display,
    fontSize: 16,
    lineHeight: 20,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  summaryCellLabel: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  summarySep: {
    width: 1,
    height: 32,
    backgroundColor: Colors.hairline,
    marginVertical: 4,
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

