/**
 * AttachDrivesModal — Link recorded telemetry drives to a specific vehicle
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUnassignedTrips } from '@/services/vehicles';
import type { Vehicle } from '@/types/database';

interface AttachDrivesModalProps {
  visible: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
  onAttach: (vehicleId: string, tripIds?: string[]) => Promise<number>;
}

export function AttachDrivesModal({
  visible,
  vehicle,
  onClose,
  onAttach,
}: AttachDrivesModalProps) {
  const { user } = useAuth();
  const { formatDistance } = usePreferences();
  const [unassignedTrips, setUnassignedTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [attaching, setAttaching] = useState<boolean>(false);
  const [attachedCount, setAttachedCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!visible || !user?.id) return;
      if (active) {
        setLoading(true);
        setAttachedCount(null);
      }
      try {
        const trips = await fetchUnassignedTrips(user.id);
        if (active) setUnassignedTrips(trips);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [visible, user?.id]);

  if (!vehicle) return null;

  const handleAttachAll = async () => {
    setAttaching(true);
    try {
      const count = await onAttach(vehicle.id);
      setAttachedCount(count);
      setTimeout(() => {
        onClose();
      }, 1500);
    } finally {
      setAttaching(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text variant="heading" color={Colors.text.primary}>
                Attach Drives
              </Text>
              <Text variant="label" color={Colors.text.tertiary}>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Icon name="close" size={20} color={Colors.text.secondary} />
            </Pressable>
          </View>

          <View style={styles.body}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={Colors.accent.cyan} />
              </View>
            ) : attachedCount !== null ? (
              <View style={styles.successBox}>
                <Icon name="check-circle" size={48} color={Colors.semantic.success} weight="fill" />
                <Text variant="title" color={Colors.text.primary}>
                  {attachedCount} {attachedCount === 1 ? 'Drive' : 'Drives'} Attached!
                </Text>
                <Text variant="body" color={Colors.text.secondary}>
                  Trips are now linked to your {vehicle.make} {vehicle.model}.
                </Text>
              </View>
            ) : unassignedTrips.length === 0 ? (
              <View style={styles.emptyBox}>
                <Icon name="check-circle" size={40} color={Colors.accent.cyan} />
                <Text variant="heading" color={Colors.text.primary}>
                  All Drives Assigned
                </Text>
                <Text variant="body" color={Colors.text.secondary} style={styles.emptyDesc}>
                  You have no orphan trips without a vehicle assigned.
                </Text>
              </View>
            ) : (
              <>
                <Text variant="body" color={Colors.text.secondary} style={styles.introText}>
                  Found {unassignedTrips.length} unassigned {unassignedTrips.length === 1 ? 'trip' : 'trips'} in your driving history.
                </Text>

                <ScrollView style={styles.tripsList} contentContainerStyle={styles.tripsContent}>
                  {unassignedTrips.slice(0, 10).map((t) => (
                    <View key={t.id} style={styles.tripRow}>
                      <View style={styles.tripLeft}>
                        <Icon name="path" size={16} color={Colors.accent.cyan} />
                        <Text variant="body" color={Colors.text.primary}>
                          {new Date(t.started_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                      <Text variant="label" color={Colors.text.tertiary} tabular>
                        {formatDistance(t.distance_m ?? 0, { isMeters: true })}
                      </Text>
                    </View>
                  ))}
                  {unassignedTrips.length > 10 && (
                    <Text variant="label" color={Colors.text.tertiary} style={styles.moreText}>
                      + {unassignedTrips.length - 10} more unassigned trips
                    </Text>
                  )}
                </ScrollView>

                <Button
                  variant="primary"
                  onPress={handleAttachAll}
                  loading={attaching}
                  style={styles.attachBtn}
                >
                  Attach All {unassignedTrips.length} Drives to Car
                </Button>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 13, 0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '75%',
    backgroundColor: Colors.surface['1'],
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    paddingTop: Spacing.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  closeBtn: {
    padding: Spacing[2],
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.iconChip,
  },
  body: {
    padding: Spacing.screen,
    gap: Spacing[4],
  },
  loadingBox: {
    paddingVertical: Spacing.section,
    alignItems: 'center',
  },
  successBox: {
    paddingVertical: Spacing.section,
    alignItems: 'center',
    gap: Spacing[2],
  },
  emptyBox: {
    paddingVertical: Spacing.section,
    alignItems: 'center',
    gap: Spacing[2],
  },
  emptyDesc: {
    textAlign: 'center',
    lineHeight: 20,
  },
  introText: {
    lineHeight: 22,
  },
  tripsList: {
    maxHeight: 200,
  },
  tripsContent: {
    gap: Spacing[2],
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface['2'],
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    borderRadius: Radius.card,
  },
  tripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  moreText: {
    textAlign: 'center',
    paddingTop: Spacing[2],
  },
  attachBtn: {
    marginTop: Spacing[2],
  },
});
