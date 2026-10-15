import React from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import type { Vehicle } from '@/types/database';

interface VehicleCardProps {
  vehicle: Vehicle;
  onSetPrimary: (vehicleId: string) => void;
  onDelete: (vehicleId: string) => void;
  onPhotoPress?: (vehicleId: string) => void;
  onMaintenancePress?: (vehicleId: string) => void;
}

export function VehicleCard({
  vehicle,
  onSetPrimary,
  onDelete,
  onPhotoPress,
  onMaintenancePress,
}: VehicleCardProps) {
  const handleDelete = () => {
    Alert.alert(
      'Remove Vehicle',
      `Are you sure you want to remove ${vehicle.year} ${vehicle.make} ${vehicle.model} from your garage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onDelete(vehicle.id),
        },
      ],
    );
  };

  return (
    <View style={[styles.card, vehicle.is_primary && styles.cardPrimary]}>
      {/* Top Banner / Image Section */}
      <View style={styles.headerRow}>
        <Pressable
          style={({ pressed }) => [styles.photoContainer, pressed && styles.pressed]}
          onPress={() => onPhotoPress?.(vehicle.id)}
        >
          {vehicle.photo_url ? (
            <Image
              source={{ uri: vehicle.photo_url }}
              style={styles.photo}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Icon name="car" size={24} color={Colors.text.tertiary} />
              <Text style={styles.photoPlaceholderText}>Add Photo</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.infoCol}>
          <View style={styles.titleRow}>
            <Text style={styles.yearText}>{vehicle.year}</Text>
            {vehicle.is_primary && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryBadgeText}>PRIMARY</Text>
              </View>
            )}
          </View>

          <Text style={styles.makeModelText} numberOfLines={1}>
            {vehicle.make} {vehicle.model}
          </Text>

          {vehicle.nickname ? (
            <Text style={styles.nicknameText} numberOfLines={1}>
              &ldquo;{vehicle.nickname}&rdquo;
            </Text>
          ) : null}
        </View>
      </View>

      {/* Card Actions */}
      <View style={styles.actionsRow}>
        {!vehicle.is_primary ? (
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={() => onSetPrimary(vehicle.id)}
          >
            <Text style={styles.primaryBtnText}>Set as Primary</Text>
          </Pressable>
        ) : (
          <View style={styles.activeIndicator}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Active Drive Vehicle</Text>
          </View>
        )}

        <View style={styles.rightActions}>
          <Pressable
            style={({ pressed }) => [styles.maintenanceBtn, pressed && styles.pressed]}
            onPress={() => onMaintenancePress?.(vehicle.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="View service log"
          >
            <View style={styles.btnInnerRow}>
              <Icon name="wrench" size={12} color={Colors.accent.cyan} />
              <Text style={styles.maintenanceBtnText}>Service Log</Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
            onPress={handleDelete}
            hitSlop={8}
          >
            <Text style={styles.deleteBtnText}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing[4],
    marginBottom: Spacing[3],
  },
  cardPrimary: {
    borderColor: Colors.accent.cyan,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
  },
  photoContainer: {
    width: 72,
    height: 72,
    borderRadius: Radius.card / 2,
    overflow: 'hidden',
    backgroundColor: Colors.surface['2'],
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[2],
    gap: 4,
  },
  photoPlaceholderText: {
    fontFamily: FontFamily.label,
    fontSize: 10,
    color: Colors.accent.cyan,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  yearText: {
    fontFamily: FontFamily.heading,
    fontSize: 12,
    color: Colors.text.secondary,
  },
  primaryBadge: {
    backgroundColor: Colors.tint.cyan,
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
  },
  primaryBadgeText: {
    fontFamily: FontFamily.display,
    fontSize: 9,
    color: Colors.accent.cyan,
    letterSpacing: 0.5,
  },
  makeModelText: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: Colors.text.primary,
  },
  nicknameText: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing[3],
    paddingTop: Spacing[3],
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  maintenanceBtn: {
    paddingVertical: Spacing[1],
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface['2'],
    borderWidth: 1,
    borderColor: Colors.hairline,
    minHeight: 36,
    justifyContent: 'center',
  },
  btnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  maintenanceBtnText: {
    fontFamily: FontFamily.label,
    fontSize: 13,
    color: Colors.text.secondary,
  },
  primaryBtn: {
    paddingVertical: Spacing[1],
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface['2'],
    borderWidth: 1,
    borderColor: Colors.hairline,
    minHeight: 36,
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: FontFamily.label,
    fontSize: 13,
    color: Colors.text.primary,
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
  },
  activeText: {
    fontFamily: FontFamily.label,
    fontSize: 12,
    color: Colors.accent.cyan,
  },
  deleteBtn: {
    paddingVertical: Spacing[1],
    paddingHorizontal: Spacing[2],
    minHeight: 36,
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontFamily: FontFamily.label,
    fontSize: 13,
    color: Colors.semantic.danger,
  },
  pressed: {
    opacity: 0.7,
  },
});
