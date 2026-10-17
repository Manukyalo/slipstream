import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import type { MaintenanceLog, MaintenanceLogInsert } from '@/types/database';

export type MaintenanceType =
  | 'oil_change'
  | 'tires'
  | 'brakes'
  | 'battery'
  | 'inspection'
  | 'other';

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  oil_change: 'Oil & Filter',
  tires: 'Tires & Alignment',
  brakes: 'Brakes & Rotors',
  battery: 'Battery & Electrical',
  inspection: 'Inspection / Tune-up',
  other: 'General Repair / Other',
};

import type { IconName } from '@/components/ui/Icon';

export const MAINTENANCE_TYPE_ICONS: Record<MaintenanceType, IconName> = {
  oil_change: 'drop',
  tires: 'circle-notch',
  brakes: 'disc',
  battery: 'battery-high',
  inspection: 'clipboard-text',
  other: 'wrench',
};

export interface CreateMaintenanceLogInput {
  vehicleId: string;
  type: MaintenanceType;
  description: string;
  odometer: number;
  cost: number;
  serviceDate: string; // YYYY-MM-DD
  nextDueDate?: string | null; // YYYY-MM-DD
  nextDueOdometer?: number | null;
  currency?: string;
  vehicleName?: string;
}

export interface VehicleMaintenanceSummary {
  totalLogs: number;
  totalCost: number;
  currency?: string;
  latestOdometer: number;
  latestServiceDate: string | null;
  nextDueDate: string | null;
  nextDueOdometer?: number | null;
  upcomingServiceType: MaintenanceType | null;
}

/**
 * Fetch all maintenance logs for a vehicle in chronological order (most recent first).
 */
export async function fetchMaintenanceLogs(vehicleId: string): Promise<MaintenanceLog[]> {
  const { data, error } = await supabase
    .from('maintenance_logs')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('service_date', { ascending: false });

  if (error) {
    console.error('[Maintenance] Error fetching logs:', error.message);
    throw new Error(`Failed to load maintenance logs: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Insert a new maintenance log record with server-side and client validation.
 */
export async function createMaintenanceLog(
  input: CreateMaintenanceLogInput,
): Promise<MaintenanceLog> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required to log maintenance');

  // Input validation
  const odo = Math.round(Number(input.odometer));
  if (isNaN(odo) || odo < 0) {
    throw new Error('Odometer reading must be a positive number');
  }

  const cost = Number(Number(input.cost).toFixed(2));
  if (isNaN(cost) || cost < 0) {
    throw new Error('Cost must be a positive number');
  }

  const desc = input.description.trim();
  if (!desc) {
    throw new Error('Description is required');
  }

  if (!input.serviceDate) {
    throw new Error('Service date is required');
  }

  const basePayload: Record<string, unknown> = {
    vehicle_id: input.vehicleId,
    user_id: user.id,
    type: input.type,
    description: desc,
    odometer: odo,
    cost,
    service_date: input.serviceDate,
    next_due_date: input.nextDueDate || null,
  };

  if (input.currency) {
    basePayload.currency = input.currency;
  }
  if (input.nextDueOdometer !== undefined && input.nextDueOdometer !== null) {
    basePayload.next_due_odometer = input.nextDueOdometer;
  }

  let data: MaintenanceLog | null = null;
  let insertError: { message: string } | null = null;

  // Try insert with new fields first
  const res = await supabase
    .from('maintenance_logs')
    .insert(basePayload as unknown as MaintenanceLogInsert)
    .select()
    .single();

  if (res.error) {
    // If column doesn't exist yet on remote schema, retry with baseline columns
    if (res.error.message.includes('currency') || res.error.message.includes('next_due_odometer')) {
      const fallbackPayload: MaintenanceLogInsert = {
        vehicle_id: input.vehicleId,
        user_id: user.id,
        type: input.type,
        description: desc,
        odometer: odo,
        cost,
        service_date: input.serviceDate,
        next_due_date: input.nextDueDate || null,
      };
      const fallbackRes = await supabase
        .from('maintenance_logs')
        .insert(fallbackPayload)
        .select()
        .single();
      data = fallbackRes.data as MaintenanceLog | null;
      insertError = fallbackRes.error;
    } else {
      insertError = res.error;
    }
  } else {
    data = res.data as MaintenanceLog | null;
  }

  if (insertError || !data) {
    console.error('[Maintenance] Insert error:', insertError?.message);
    throw new Error(`Failed to save maintenance record: ${insertError?.message ?? 'Unknown error'}`);
  }

  // Schedule notification if next_due_date is provided
  if (data.next_due_date) {
    scheduleNextServiceNotification(data, input.vehicleName).catch((notifErr) => {
      console.warn('[Maintenance] Could not schedule notification:', notifErr);
    });
  }

  return data;
}

/**
 * Delete a maintenance log record.
 */
export async function deleteMaintenanceLog(logId: string): Promise<boolean> {
  const { error } = await supabase
    .from('maintenance_logs')
    .delete()
    .eq('id', logId);

  if (error) {
    console.error('[Maintenance] Delete error:', error.message);
    throw new Error(`Failed to delete record: ${error.message}`);
  }

  return true;
}

/**
 * Fetch maintenance summary (total spend, next service due) for a vehicle.
 */
export async function fetchMaintenanceSummary(
  vehicleId: string,
): Promise<VehicleMaintenanceSummary> {
  const { data, error } = await supabase.rpc('get_vehicle_maintenance_summary', {
    p_vehicle_id: vehicleId,
  });

  if (error || !data) {
    console.warn('[Maintenance] Summary RPC error, computing fallback:', error?.message);
    // Safe client fallback
    const logs = await fetchMaintenanceLogs(vehicleId).catch(() => []);
    const totalCost = logs.reduce((sum, item) => sum + Number(item.cost), 0);
    const now = new Date().toISOString().split('T')[0];
    const upcoming = logs
      .filter((l) => l.next_due_date && l.next_due_date >= now)
      .sort((a, b) => (a.next_due_date! > b.next_due_date! ? 1 : -1))[0];

    return {
      totalLogs: logs.length,
      totalCost,
      latestOdometer: logs[0]?.odometer ?? 0,
      latestServiceDate: logs[0]?.service_date ?? null,
      nextDueDate: upcoming?.next_due_date ?? null,
      upcomingServiceType: (upcoming?.type as MaintenanceType) ?? null,
    };
  }

  const summary = data as {
    total_logs: number;
    total_cost: number;
    latest_odometer: number;
    latest_service_date: string | null;
    next_due_date: string | null;
    upcoming_service_type: string | null;
  };

  return {
    totalLogs: Number(summary.total_logs) || 0,
    totalCost: Number(summary.total_cost) || 0,
    latestOdometer: Number(summary.latest_odometer) || 0,
    latestServiceDate: summary.latest_service_date,
    nextDueDate: summary.next_due_date,
    upcomingServiceType: summary.upcoming_service_type as MaintenanceType | null,
  };
}

/**
 * Schedules a local device notification 7 days before next_due_date.
 */
async function scheduleNextServiceNotification(
  log: MaintenanceLog,
  vehicleName?: string,
): Promise<void> {
  if (!log.next_due_date) return;

  const dueDate = new Date(log.next_due_date);
  if (isNaN(dueDate.getTime())) return;

  // 7 days before due date at 09:00 AM
  const notifyDate = new Date(dueDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  notifyDate.setHours(9, 0, 0, 0);

  const now = new Date();
  if (notifyDate.getTime() <= now.getTime()) {
    // If due within next 7 days, notify tomorrow morning
    notifyDate.setTime(now.getTime() + 24 * 60 * 60 * 1000);
    notifyDate.setHours(9, 0, 0, 0);
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const { status: reqStatus } = await Notifications.requestPermissionsAsync();
    if (reqStatus !== 'granted') return;
  }

  const carLabel = vehicleName ? `for ${vehicleName}` : 'for your vehicle';
  const typeLabel = MAINTENANCE_TYPE_LABELS[log.type as MaintenanceType] ?? 'Service';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Upcoming Service Reminder: ${typeLabel}`,
      body: `${typeLabel} ${carLabel} is due on ${log.next_due_date}. Keep your machine track-ready.`,
      sound: true,
      data: { vehicleId: log.vehicle_id, logId: log.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: notifyDate,
    },
  });
}
