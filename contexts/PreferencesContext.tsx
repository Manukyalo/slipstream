/**
 * PreferencesContext — Global driving unit & display preferences
 *
 * Requirements:
 *  - Metric (km/h, km) vs Imperial (mph, mi)
 *  - Persisted to AsyncStorage and synced to Supabase user metadata
 *  - Reactive formatters that propagate unit changes everywhere
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type SpeedUnit = 'kmh' | 'mph';
export type DistanceUnit = 'km' | 'mi';

const STORAGE_KEY = '@slipstream/units';
const KM_TO_MILES = 0.621371192;
const MILES_TO_KM = 1.609344;

interface PreferencesContextValue {
  speedUnit: SpeedUnit;
  distanceUnit: DistanceUnit;
  speedUnitLabel: string;
  distanceUnitLabel: string;
  setSpeedUnit: (unit: SpeedUnit) => Promise<void>;
  /** Convert km/h into active speed unit value */
  convertSpeed: (kmh: number) => number;
  /** Convert kilometres into active distance unit value */
  convertDistanceKm: (km: number) => number;
  /** Convert metres into active distance unit value (in km or mi) */
  convertMetersToDistance: (meters: number) => number;
  /** Format a speed value with or without unit suffix */
  formatSpeed: (kmh: number, withUnit?: boolean) => string;
  /** Format a distance from metres (or kilometres) */
  formatDistance: (
    value: number,
    options?: { isMeters?: boolean; withUnit?: boolean; decimals?: number },
  ) => string;
  /** Format vehicle odometer reading */
  formatOdometer: (odometerKm: number) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [speedUnit, setSpeedUnitState] = useState<SpeedUnit>('kmh');
  const [loaded, setLoaded] = useState<boolean>(false);

  // Load initial unit preference from storage / user metadata
  useEffect(() => {
    let active = true;
    async function loadPreference() {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'kmh' || stored === 'mph') {
          if (active) setSpeedUnitState(stored);
        } else if (user?.user_metadata?.speed_unit) {
          const metaUnit = user.user_metadata.speed_unit;
          if (metaUnit === 'kmh' || metaUnit === 'mph') {
            if (active) setSpeedUnitState(metaUnit);
            await AsyncStorage.setItem(STORAGE_KEY, metaUnit);
          }
        }
      } catch (err) {
        console.warn('[Preferences] Failed to load units:', err);
      } finally {
        if (active) setLoaded(true);
      }
    }
    loadPreference();
    return () => {
      active = false;
    };
  }, [user]);

  const setSpeedUnit = useCallback(
    async (newUnit: SpeedUnit) => {
      setSpeedUnitState(newUnit);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, newUnit);
        if (user) {
          await supabase.auth.updateUser({
            data: { speed_unit: newUnit },
          });
        }
      } catch (err) {
        console.warn('[Preferences] Failed to persist units:', err);
      }
    },
    [user],
  );

  const distanceUnit: DistanceUnit = speedUnit === 'mph' ? 'mi' : 'km';
  const speedUnitLabel = speedUnit === 'mph' ? 'mph' : 'km/h';
  const distanceUnitLabel = distanceUnit === 'mi' ? 'mi' : 'km';

  const convertSpeed = useCallback(
    (kmh: number): number => {
      if (!Number.isFinite(kmh)) return 0;
      return speedUnit === 'mph' ? kmh * KM_TO_MILES : kmh;
    },
    [speedUnit],
  );

  const convertDistanceKm = useCallback(
    (km: number): number => {
      if (!Number.isFinite(km)) return 0;
      return distanceUnit === 'mi' ? km * KM_TO_MILES : km;
    },
    [distanceUnit],
  );

  const convertMetersToDistance = useCallback(
    (meters: number): number => {
      if (!Number.isFinite(meters)) return 0;
      const km = meters / 1000;
      return convertDistanceKm(km);
    },
    [convertDistanceKm],
  );

  const formatSpeed = useCallback(
    (kmh: number, withUnit = true): string => {
      if (!Number.isFinite(kmh)) return withUnit ? `— ${speedUnitLabel}` : '—';
      const converted = Math.round(convertSpeed(kmh));
      return withUnit ? `${converted} ${speedUnitLabel}` : `${converted}`;
    },
    [convertSpeed, speedUnitLabel],
  );

  const formatDistance = useCallback(
    (
      value: number,
      options?: { isMeters?: boolean; withUnit?: boolean; decimals?: number },
    ): string => {
      const isMeters = options?.isMeters ?? false;
      const withUnit = options?.withUnit ?? true;
      const decimals = options?.decimals ?? 1;

      if (!Number.isFinite(value)) return withUnit ? `— ${distanceUnitLabel}` : '—';

      const km = isMeters ? value / 1000 : value;
      const converted = convertDistanceKm(km);
      const formatted = converted.toFixed(decimals);

      return withUnit ? `${formatted} ${distanceUnitLabel}` : formatted;
    },
    [convertDistanceKm, distanceUnitLabel],
  );

  const formatOdometer = useCallback(
    (odometerKm: number): string => {
      if (!Number.isFinite(odometerKm) || odometerKm <= 0) return '—';
      const converted = Math.round(convertDistanceKm(odometerKm));
      return `${converted.toLocaleString()} ${distanceUnitLabel}`;
    },
    [convertDistanceKm, distanceUnitLabel],
  );

  const value = useMemo(
    () => ({
      speedUnit,
      distanceUnit,
      speedUnitLabel,
      distanceUnitLabel,
      setSpeedUnit,
      convertSpeed,
      convertDistanceKm,
      convertMetersToDistance,
      formatSpeed,
      formatDistance,
      formatOdometer,
    }),
    [
      speedUnit,
      distanceUnit,
      speedUnitLabel,
      distanceUnitLabel,
      setSpeedUnit,
      convertSpeed,
      convertDistanceKm,
      convertMetersToDistance,
      formatSpeed,
      formatDistance,
      formatOdometer,
    ],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
