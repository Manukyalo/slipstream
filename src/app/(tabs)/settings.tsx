import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useAuth } from '@/contexts/AuthContext';
import { useVehicles } from '@/hooks/useVehicles';
import { useReferral } from '@/hooks/useReferral';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { VehicleCard } from '@/components/vehicles/VehicleCard';
import { AddVehicleModal } from '@/components/vehicles/AddVehicleModal';

export default function SettingsScreen() {
  const { user, profile, signOut } = useAuth();
  const {
    vehicles,
    isLoading: isLoadingGarage,
    addVehicle,
    setPrimary,
    removeVehicle,
    uploadPhoto,
  } = useVehicles();
  const {
    referralCode,
    totalReferrals,
    shareInvite,
    isLoading: isLoadingReferral,
  } = useReferral();

  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);

  const handlePhotoPress = async (vehicleId: string) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Photo library access is needed to update your vehicle photo.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadPhoto(vehicleId, result.assets[0].uri);
      }
    } catch (err) {
      console.error('[Settings] Photo update failed:', err);
      Alert.alert('Upload Error', 'Could not upload vehicle photo.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Garage & Driver Profile</Text>
      </View>

      {/* Driver Profile Section */}
      <View style={styles.profileSection}>
        {profile ? (
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(profile.display_name ?? user?.email ?? 'U')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.displayName}>
                {profile.display_name ?? 'Driver'}
              </Text>
              <Text style={styles.email}>{user?.email}</Text>
            </View>
          </View>
        ) : (
          <SkeletonCard />
        )}
      </View>

      {/* Driver Referral / Invite Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Driver Referral</Text>
            <Text style={styles.sectionSub}>Invite drivers & track your network</Text>
          </View>
        </View>

        <View style={styles.inviteCard}>
          <View style={styles.inviteCardTop}>
            <View style={styles.inviteCodeBadge}>
              <Text style={styles.inviteCodeLabel}>YOUR INVITE CODE</Text>
              <Text style={styles.inviteCodeValue}>
                {isLoadingReferral ? '••••••' : (referralCode ?? 'DRIVE1')}
              </Text>
            </View>

            <View style={styles.referralStatsBadge}>
              <Text style={styles.referralStatsCount}>{totalReferrals}</Text>
              <Text style={styles.referralStatsLabel}>Referred</Text>
            </View>
          </View>

          <Text style={styles.inviteLinkPreview}>
            drivetrack.app/i/{referralCode ?? 'DRIVE1'}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && styles.btnPressed]}
            onPress={() => shareInvite()}
          >
            <Text style={styles.shareBtnText}>Share Driver Invite Link</Text>
          </Pressable>
        </View>
      </View>

      {/* Garage / Vehicles Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>My Garage</Text>
            <Text style={styles.sectionSub}>
              {vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'} registered
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.addVehicleBtn, pressed && styles.btnPressed]}
            onPress={() => setAddModalVisible(true)}
          >
            <Text style={styles.addVehicleBtnText}>+ Add Car</Text>
          </Pressable>
        </View>

        {isLoadingGarage ? (
          <View style={styles.garageLoading}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : vehicles.length === 0 ? (
          <View style={styles.emptyGarageCard}>
            <Text style={styles.emptyGarageIcon}>🏎️</Text>
            <Text style={styles.emptyGarageTitle}>No vehicles in garage</Text>
            <Text style={styles.emptyGarageSubtitle}>
              Add your car to track performance benchmarks and attach drives to your build.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.emptyAddBtn, pressed && styles.btnPressed]}
              onPress={() => setAddModalVisible(true)}
            >
              <Text style={styles.emptyAddBtnText}>Add Your First Car</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.vehicleList}>
            {vehicles.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                onSetPrimary={setPrimary}
                onDelete={removeVehicle}
                onPhotoPress={handlePhotoPress}
              />
            ))}
          </View>
        )}
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && styles.btnPressed]}
          onPress={() => signOut()}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>

      {/* Add Vehicle Modal */}
      <AddVehicleModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSave={async (data) => {
          await addVehicle(data);
        }}
        isFirstVehicle={vehicles.length === 0}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgBase,
  },
  contentContainer: {
    paddingTop: 60,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing['4xl'],
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h1,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  profileSection: {
    marginBottom: Spacing.xl,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    padding: Spacing.base,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accentCyanDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accentCyan,
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: Colors.accentCyan,
  },
  profileInfo: {
    flex: 1,
  },
  displayName: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  email: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  addVehicleBtn: {
    backgroundColor: Colors.accentCyanDim,
    borderColor: Colors.accentCyan,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  addVehicleBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: Colors.accentCyan,
  },
  garageLoading: {
    gap: Spacing.md,
  },
  emptyGarageCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyGarageIcon: {
    fontSize: 36,
  },
  emptyGarageTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  emptyGarageSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
  emptyAddBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.accentCyan,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  emptyAddBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: Colors.textInverse,
  },
  vehicleList: {
    gap: Spacing.xs,
  },
  signOutBtn: {
    backgroundColor: Colors.accentRedDim,
    borderColor: Colors.accentRed,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnPressed: {
    opacity: 0.8,
  },
  signOutText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.accentRed,
  },
  inviteCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  inviteCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteCodeBadge: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  inviteCodeLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  inviteCodeValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h2,
    color: Colors.accentCyan,
    letterSpacing: 2,
    marginTop: 2,
  },
  referralStatsBadge: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.accentCyanDim,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accentCyan,
  },
  referralStatsCount: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h2,
    color: Colors.accentCyan,
  },
  referralStatsLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  inviteLinkPreview: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
  },
  shareBtn: {
    backgroundColor: Colors.accentCyan,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  shareBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.label,
    color: Colors.textInverse,
  },
});
