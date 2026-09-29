import React, { useState, useEffect } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Text,
  View,
  Share,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useAuth } from '@/contexts/AuthContext';
import { useVehicles } from '@/hooks/useVehicles';
import { useReferral } from '@/hooks/useReferral';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { VehicleCard } from '@/components/vehicles/VehicleCard';
import { AddVehicleModal } from '@/components/vehicles/AddVehicleModal';
import { MaintenanceLogScreen } from '@/components/maintenance/MaintenanceLogScreen';
import { exportUserData, deleteUserAccount } from '@/services/compliance';
import {
  isBiometricLockEnabled,
  setBiometricLockEnabled,
  checkBiometricCapabilities,
  authenticateWithBiometrics,
} from '@/services/biometrics';

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
  const [maintenanceVehicle, setMaintenanceVehicle] = useState<{ id: string; name: string } | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(false);
  const [biometricSupported, setBiometricSupported] = useState<boolean>(false);
  const [exportingData, setExportingData] = useState<boolean>(false);
  const [deletingAccount, setDeletingAccount] = useState<boolean>(false);

  useEffect(() => {
    async function loadSecuritySettings() {
      const caps = await checkBiometricCapabilities();
      setBiometricSupported(caps.hasHardware && caps.isEnrolled);
      const enabled = await isBiometricLockEnabled();
      setBiometricEnabled(enabled);
    }
    loadSecuritySettings();
  }, []);

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      const success = await authenticateWithBiometrics('Confirm identity to enable biometric lock');
      if (!success) return;
    }
    const saved = await setBiometricLockEnabled(value);
    if (saved) setBiometricEnabled(value);
  };

  const handleExportData = async () => {
    setExportingData(true);
    try {
      const { data, error } = await exportUserData();
      if (error || !data) {
        Alert.alert('Export Failed', error ?? 'Unable to export your data. Please try again.');
        return;
      }
      await Share.share({
        title: 'Slipstream Data Export',
        message: JSON.stringify(data, null, 2),
      });
    } catch {
      Alert.alert('Export Failed', 'An unexpected error occurred.');
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, all trip telemetry, vehicles, and performance records. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              const { success, error } = await deleteUserAccount();
              if (!success) {
                Alert.alert('Deletion Failed', error ?? 'Unable to delete account. Please contact support.');
              }
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
  };

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

  const handleMaintenancePress = (vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return;
    const name = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
    setMaintenanceVehicle({ id: vehicleId, name });
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
                onMaintenancePress={handleMaintenancePress}
              />
            ))}
          </View>
        )}
      </View>

      {/* Privacy & Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy & Security</Text>

        {biometricSupported && (
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Biometric App Lock</Text>
              <Text style={styles.settingDesc}>Require Face ID / fingerprint to open Slipstream</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleToggleBiometric}
              trackColor={{ false: Colors.bgElevated, true: Colors.accentCyanDim }}
              thumbColor={biometricEnabled ? Colors.accentCyan : Colors.textMuted}
            />
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.settingActionBtn, pressed && styles.btnPressed]}
          onPress={handleExportData}
          disabled={exportingData}
        >
          {exportingData ? (
            <ActivityIndicator size="small" color={Colors.accentCyan} />
          ) : (
            <Text style={styles.settingActionText}>Export My Data (GDPR)</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.dangerBtn, pressed && styles.btnPressed]}
          onPress={handleDeleteAccount}
          disabled={deletingAccount}
        >
          {deletingAccount ? (
            <ActivityIndicator size="small" color={Colors.accentRed} />
          ) : (
            <Text style={styles.dangerText}>Delete Account & All Data</Text>
          )}
        </Pressable>
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

      {maintenanceVehicle && (
        <MaintenanceLogScreen
          visible={!!maintenanceVehicle}
          vehicleId={maintenanceVehicle.id}
          vehicleName={maintenanceVehicle.name}
          onClose={() => setMaintenanceVehicle(null)}
        />
      )}
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  settingLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  settingDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  settingActionBtn: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.accentCyan,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  settingActionText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.accentCyan,
  },
  dangerBtn: {
    backgroundColor: Colors.accentRedDim,
    borderColor: Colors.accentRed,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  dangerText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.accentRed,
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
