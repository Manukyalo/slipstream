import React from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useVehicleContext } from '@/contexts/VehicleContext';

interface VehicleSwitcherSheetProps {
  visible: boolean;
  onClose: () => void;
  onAddCar?: () => void;
}

export function VehicleSwitcherSheet({
  visible,
  onClose,
  onAddCar,
}: VehicleSwitcherSheetProps) {
  const { vehicles, primaryVehicle, switchPrimary } = useVehicleContext();

  const handleSelect = async (vehicleId: string) => {
    try {
      await switchPrimary(vehicleId);
      onClose();
    } catch (err) {
      console.error('[VehicleSwitcherSheet] Failed to switch vehicle:', err);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text variant="heading" color={Colors.text.primary}>
                Active Vehicle
              </Text>
              <Text variant="label" color={Colors.text.tertiary}>
                Select vehicle for telemetry recording & gauge
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Icon name="close" size={20} color={Colors.text.secondary} />
            </Pressable>
          </View>

          {/* Vehicle List */}
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {vehicles.map((v) => {
              const isSelected = v.id === primaryVehicle?.id;
              return (
                <Pressable
                  key={v.id}
                  style={[styles.vehicleRow, isSelected && styles.vehicleRowSelected]}
                  onPress={() => handleSelect(v.id)}
                >
                  {/* Photo thumbnail */}
                  <View style={styles.thumbWrap}>
                    {v.photo_url ? (
                      <Image source={{ uri: v.photo_url }} style={styles.thumbImage} resizeMode="cover" />
                    ) : (
                      <Icon name="car" size={20} color={Colors.accent.cyan} />
                    )}
                  </View>

                  {/* Vehicle details */}
                  <View style={styles.vehicleDetails}>
                    <Text variant="label" color={Colors.text.primary} numberOfLines={1}>
                      {v.year} {v.make} {v.model}
                    </Text>
                    {v.nickname && (
                      <Text variant="overline" color={Colors.text.tertiary}>
                        &quot;{v.nickname}&quot;
                      </Text>
                    )}
                  </View>

                  {/* Active Indicator */}
                  {isSelected ? (
                    <View style={styles.activePill}>
                      <Icon name="check" size={14} color={Colors.text.inverse} weight="bold" />
                      <Text variant="overline" color={Colors.text.inverse} style={styles.activePillText}>
                        ACTIVE
                      </Text>
                    </View>
                  ) : (
                    <Icon name="caret-right" size={16} color={Colors.text.tertiary} />
                  )}
                </Pressable>
              );
            })}

            {onAddCar && (
              <Button
                variant="secondary"
                onPress={() => {
                  onClose();
                  onAddCar();
                }}
                iconLeft={<Icon name="plus" size={16} color={Colors.accent.cyan} />}
                style={styles.addBtn}
              >
                Add Another Car
              </Button>
            )}
          </ScrollView>
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
    backgroundColor: Colors.surface['1'],
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderWidth: 1,
    borderColor: Colors.hairline,
    maxHeight: '75%',
    padding: Spacing.screen,
    gap: Spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing[1],
  },
  closeBtn: {
    padding: Spacing[2],
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.iconChip,
  },
  listContent: {
    gap: Spacing[2],
    paddingBottom: Platform.OS === 'ios' ? Spacing.section : Spacing[3],
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface['2'],
    padding: Spacing[3],
    borderRadius: Radius.card,
    gap: Spacing[3],
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  vehicleRowSelected: {
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.surface['3'],
  },
  thumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface['1'],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  vehicleDetails: {
    flex: 1,
    gap: 2,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent.cyan,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  addBtn: {
    marginTop: Spacing[2],
  },
});
