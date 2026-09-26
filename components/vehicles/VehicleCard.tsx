import React from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { Vehicle } from '@/types/database';

interface VehicleCardProps {
  vehicle: Vehicle;
  onSetPrimary: (vehicleId: string) => void;
  onDelete: (vehicleId: string) => void;
  onPhotoPress?: (vehicleId: string) => void;
}

export function VehicleCard({
  vehicle,
  onSetPrimary,
  onDelete,
  onPhotoPress,
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
              <Text style={styles.photoPlaceholderIcon}>🏎️</Text>
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

        <Pressable
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
          onPress={handleDelete}
          hitSlop={8}
        >
          <Text style={styles.deleteBtnText}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    marginBottom: Spacing.md,
  },
  cardPrimary: {
    borderColor: Colors.accentCyan,
    shadowColor: Colors.accentCyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  photoContainer: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xs,
  },
  photoPlaceholderIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  photoPlaceholderText: {
    fontFamily: FontFamily.medium,
    fontSize: 9,
    color: Colors.accentCyan,
    textTransform: 'uppercase',
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
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
  },
  primaryBadge: {
    backgroundColor: Colors.accentCyanDim,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: Colors.accentCyan,
  },
  primaryBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.accentCyan,
    letterSpacing: 0.5,
  },
  makeModelText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h2,
    color: Colors.textPrimary,
  },
  nicknameText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  primaryBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  primaryBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textPrimary,
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accentCyan,
  },
  activeText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.accentCyan,
  },
  deleteBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  deleteBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.accentRed,
  },
  pressed: {
    opacity: 0.7,
  },
});
