import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';

import { useAuth } from '@/contexts/AuthContext';
import {
  confirmHazard,
  fetchNearbyHazards,
  HAZARD_CONFIG,
  reportHazard,
  type HazardType,
  type NearbyHazard,
} from '@/services/hazards';

// Configure foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface UseHazardAlertsOptions {
  currentCoords: [number, number] | null; // [lon, lat]
  isTracking: boolean;
}

export interface UseHazardAlertsResult {
  activeAlert: NearbyHazard | null;
  nearbyHazards: NearbyHazard[];
  dismissAlert: () => void;
  confirmCurrentHazard: () => Promise<void>;
  reportPin: (type: HazardType) => Promise<void>;
}

const ALERT_DISTANCE_THRESHOLD_METERS = 800; // Trigger alert within 800m
const MIN_CONFIRMATIONS_FOR_ALERT = 2; // Require 2+ confirmations to alert other users

export function useHazardAlerts({
  currentCoords,
  isTracking,
}: UseHazardAlertsOptions): UseHazardAlertsResult {
  const { user } = useAuth();
  const [nearbyHazards, setNearbyHazards] = useState<NearbyHazard[]>([]);
  const [activeAlert, setActiveAlert] = useState<NearbyHazard | null>(null);

  // Set of hazard IDs that have already triggered a notification during this session
  const alertedHazardsRef = useRef<Set<string>>(new Set());

  // Request notifications permission on mount
  useEffect(() => {
    Notifications.requestPermissionsAsync().catch((err) => {
      console.warn('[useHazardAlerts] Notification permissions warning:', err);
    });
  }, []);

  // Poll for nearby hazards while tracking
  useEffect(() => {
    if (!isTracking || !currentCoords) return;

    const [lon, lat] = currentCoords;
    let isCancelled = false;

    async function checkHazards() {
      try {
        const hazards = await fetchNearbyHazards(lon, lat, 2500);
        if (isCancelled) return;
        setNearbyHazards(hazards);

        // Find closest qualified hazard
        // A hazard qualifies if it has >= 2 confirmations OR was reported by the current user
        const qualified = hazards.filter(
          (h) =>
            (h.confirmations >= MIN_CONFIRMATIONS_FOR_ALERT || (user && h.user_id === user.id)) &&
            h.distance_meters <= ALERT_DISTANCE_THRESHOLD_METERS,
        );

        if (qualified.length > 0) {
          const closest = qualified[0];
          setActiveAlert(closest);

          // Fire local notification if not already notified for this hazard
          if (!alertedHazardsRef.current.has(closest.id)) {
            alertedHazardsRef.current.add(closest.id);
            const cfg = HAZARD_CONFIG[closest.type];
            Notifications.scheduleNotificationAsync({
              content: {
                title: `⚠️ ${cfg.label} Ahead`,
                body: `${Math.round(closest.distance_meters)}m away · ${closest.confirmations} driver confirmations`,
                sound: true,
              },
              trigger: null, // Send immediately
            }).catch((notifErr) => {
              console.warn('[useHazardAlerts] Failed to send notification:', notifErr);
            });
          }
        }
      } catch (err) {
        console.error('[useHazardAlerts] Error scanning hazards:', err);
      }
    }

    checkHazards();
    const interval = setInterval(checkHazards, 8000); // Check every 8 seconds while driving

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [isTracking, currentCoords, user]);

  const dismissAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  const confirmCurrentHazard = useCallback(async () => {
    if (!activeAlert) return;
    try {
      const updatedCount = await confirmHazard(activeAlert.id);
      setActiveAlert((prev) => (prev ? { ...prev, confirmations: updatedCount } : null));
      setNearbyHazards((prev) =>
        prev.map((h) => (h.id === activeAlert.id ? { ...h, confirmations: updatedCount } : h)),
      );
    } catch (err) {
      console.error('[useHazardAlerts] Failed to confirm alert:', err);
    }
  }, [activeAlert]);

  const reportPin = useCallback(
    async (type: HazardType) => {
      if (!currentCoords) {
        throw new Error('Current GPS position unavailable to drop pin');
      }
      const [lon, lat] = currentCoords;
      await reportHazard(type, lon, lat);
      // Immediately refresh nearby list
      const updated = await fetchNearbyHazards(lon, lat, 2500);
      setNearbyHazards(updated);
    },
    [currentCoords],
  );

  return {
    activeAlert,
    nearbyHazards,
    dismissAlert,
    confirmCurrentHazard,
    reportPin,
  };
}
