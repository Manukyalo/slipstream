/**
 * SettingsScreen — Settings & Vehicle Garage (Phase 9)
 *
 * Rules:
 *  - Title: "Settings" (sitting inside ScreenContainer)
 *  - Theme tokens only (#05070D, #0E131B, #151B26, Space Grotesk, Inter, Radius 24, etc.)
 *  - Only ONE primary-styled action per screen
 *  - Destructive actions are quiet until confirmed
 *  - Phosphor icons only, no emojis, tabular numbers
 *  - Units setting changes speed and distance everywhere
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors, FontFamily, Gradient, Radius, Spacing } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Button } from '@/components/ui/Button';
import { GoogleLogo } from '@/components/ui/GoogleLogo';

import { useAuth } from '@/contexts/AuthContext';
import { useVehicles } from '@/hooks/useVehicles';
import { useReferral } from '@/hooks/useReferral';
import { usePreferences, type SpeedUnit } from '@/contexts/PreferencesContext';
import { APP_DOMAIN } from '@/services/referrals';
import { exportUserData, deleteUserAccount } from '@/services/compliance';
import { toUserMessage } from '@/utils/toUserMessage';
import {
  isBiometricLockEnabled,
  setBiometricLockEnabled,
  checkBiometricCapabilities,
  authenticateWithBiometrics,
} from '@/services/biometrics';
import { useOtaUpdates } from '@/lib/updates';

import { GarageCarousel } from '@/components/garage/GarageCarousel';
import { AttachDrivesModal } from '@/components/garage/AttachDrivesModal';
import { AddVehicleModal } from '@/components/vehicles/AddVehicleModal';
import { SupportSlipstreamModal } from '@/components/settings/SupportSlipstreamModal';
import { DeleteAccountSheet } from '@/components/settings/DeleteAccountSheet';
import { EditProfileModal } from '@/components/settings/EditProfileModal';
import { MaintenanceLogScreen } from '@/components/maintenance/MaintenanceLogScreen';
import type { Vehicle } from '@/types/database';

export default function SettingsScreen() {
  const { user, profile, signOut, signInWithGoogle, signInWithApple, status } = useAuth();
  const {
    vehicles,
    isLoading: isLoadingGarage,
    addVehicle,
    setPrimary,
    removeVehicle,
    uploadPhoto,
    attachDrives,
  } = useVehicles();
  const { referralCode, totalReferrals, shareInvite, isLoading: isLoadingReferral } = useReferral();
  const { speedUnit, setSpeedUnit } = usePreferences();
  const { diagnostics, checkForUpdate, isChecking } = useOtaUpdates();

  // Modals state
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editProfileVisible, setEditProfileVisible] = useState<boolean>(false);
  const [supportModalVisible, setSupportModalVisible] = useState<boolean>(false);
  const [deleteSheetVisible, setDeleteSheetVisible] = useState<boolean>(false);
  const [attachVehicle, setAttachVehicle] = useState<Vehicle | null>(null);
  const [maintenanceVehicle, setMaintenanceVehicle] = useState<{ id: string; name: string } | null>(null);

  // Security & Toggles
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(false);
  const [biometricSupported, setBiometricSupported] = useState<boolean>(false);
  const [radarAlerts, setRadarAlerts] = useState<boolean>(true);
  const [hazardAlerts, setHazardAlerts] = useState<boolean>(true);
  const [audioChimes, setAudioChimes] = useState<boolean>(true);
  const [exportingData, setExportingData] = useState<boolean>(false);

  // Auth button loaders
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [appleLoading, setAppleLoading] = useState<boolean>(false);
  const [appleAvailable, setAppleAvailable] = useState<boolean>(false);

  // Diagnostics card
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    async function loadSecuritySettings() {
      const caps = await checkBiometricCapabilities();
      if (active) setBiometricSupported(caps.hasHardware && caps.isEnrolled);
      const enabled = await isBiometricLockEnabled();
      if (active) setBiometricEnabled(enabled);

      if (Platform.OS === 'ios') {
        const isAppleOk = await AppleAuthentication.isAvailableAsync().catch(() => false);
        if (active) setAppleAvailable(isAppleOk);
      }
    }
    loadSecuritySettings();
    return () => {
      active = false;
    };
  }, []);

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      const success = await authenticateWithBiometrics('Confirm identity to enable biometric lock');
      if (!success) return;
    }
    const saved = await setBiometricLockEnabled(value);
    if (saved) setBiometricEnabled(value);
  };

  const handleToggleUnits = async () => {
    const nextUnit: SpeedUnit = speedUnit === 'kmh' ? 'mph' : 'kmh';
    await setSpeedUnit(nextUnit);
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
        title: 'Slipstream Driver Telemetry Export',
        message: JSON.stringify(data, null, 2),
      });
    } catch {
      Alert.alert('Export Failed', 'An unexpected error occurred while exporting.');
    } finally {
      setExportingData(false);
    }
  };

  const handlePhotoPress = async (vehicleId: string) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Photo Library Access Required',
          'Please allow photo library access to update vehicle photo.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
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

  const handleConfirmDeleteAccount = async () => {
    const { success, error } = await deleteUserAccount();
    if (!success) {
      throw new Error(error ?? 'Unable to delete account. Please try again.');
    }
    await signOut();
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    const error = await signInWithApple();
    setAppleLoading(false);
    if (error) Alert.alert('Sign-In', toUserMessage(error));
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const error = await signInWithGoogle();
    setGoogleLoading(false);
    if (error) Alert.alert('Sign-In', toUserMessage(error));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Unauthenticated State
  // ─────────────────────────────────────────────────────────────────────────────
  if (status !== 'authenticated') {
    return (
      <ScreenContainer title="Settings" scrollable contentStyle={styles.container}>
        <Card style={styles.authCard}>
          <Text variant="heading" color={Colors.text.primary} style={styles.authTitle}>
            Join the Grid
          </Text>
          <Text variant="body" color={Colors.text.secondary} style={styles.authSub}>
            Sign in to sync your vehicle garage, record high-precision track telemetry, and compete on
            leaderboards across devices.
          </Text>

          <View style={styles.authActions}>
            {appleAvailable && (
              <Button
                variant="secondary"
                onPress={handleAppleSignIn}
                loading={appleLoading}
                iconLeft={<Icon name="user" size={18} color={Colors.text.primary} />}
              >
                Continue with Apple
              </Button>
            )}

            <Button
              variant="secondary"
              onPress={handleGoogleSignIn}
              loading={googleLoading}
              iconLeft={<GoogleLogo size={18} />}
            >
              Continue with Google
            </Button>

            <Button
              variant="ghost"
              onPress={() => router.push('/(auth)/login')}
            >
              Continue with Email
            </Button>
          </View>
        </Card>
      </ScreenContainer>
    );
  }

  const driverHandle = profile?.display_name || user?.email?.split('@')[0] || 'driver';
  const supporterBadge = profile?.supporter_badge;

  return (
    <ScreenContainer title="Settings" scrollable contentStyle={styles.container}>
      {/* 1. Profile Header (Avatar with gradient ring, handle, edit) */}
      <Card style={styles.profileHeaderCard}>
        <View style={styles.profileHeaderLeft}>
          <LinearGradient
            colors={Gradient.accent.colors as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}
          >
            <View style={styles.avatarInner}>
              <Text variant="heading" color={Colors.text.primary} style={styles.avatarInitial}>
                {driverHandle.charAt(0).toUpperCase()}
              </Text>
            </View>
          </LinearGradient>

          <View style={styles.profileTextGroup}>
            <View style={styles.handleBadgeRow}>
              <Text variant="title" color={Colors.text.primary} numberOfLines={1}>
                @{driverHandle}
              </Text>
              {supporterBadge && (
                <View style={styles.supporterBadgeChip}>
                  <Icon name="seal-check" size={12} color={Colors.accent.cyan} weight="fill" />
                  <Text variant="overline" color={Colors.accent.cyan} style={styles.supporterText}>
                    {supporterBadge}
                  </Text>
                </View>
              )}
            </View>
            <Text variant="label" color={Colors.text.tertiary} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.editProfileBtn, pressed && styles.btnPressed]}
          onPress={() => setEditProfileVisible(true)}
          hitSlop={8}
        >
          <Icon name="pencil" size={16} color={Colors.text.secondary} />
          <Text variant="label" color={Colors.text.secondary}>
            Edit
          </Text>
        </Pressable>
      </Card>

      {/* Garage Carousel Section */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text variant="title" color={Colors.text.primary}>
            My Garage
          </Text>
          <Text variant="label" color={Colors.text.tertiary}>
            {vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'} registered
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.addCarHeaderBtn, pressed && styles.btnPressed]}
          onPress={() => setAddModalVisible(true)}
          hitSlop={8}
        >
          <Icon name="plus" size={16} color={Colors.accent.cyan} />
          <Text variant="label" color={Colors.accent.cyan} style={styles.addCarText}>
            Add Car
          </Text>
        </Pressable>
      </View>

      <GarageCarousel
        vehicles={vehicles}
        isLoading={isLoadingGarage}
        onAddCar={() => setAddModalVisible(true)}
        onAttachDrives={(vehicle) => setAttachVehicle(vehicle)}
        onSetPrimary={setPrimary}
        onPhotoPress={handlePhotoPress}
        onMaintenancePress={handleMaintenancePress}
        onDeleteCar={removeVehicle}
      />

      {/* 2. Inset Group: Account */}
      <View style={styles.groupWrapper}>
        <Text variant="label" color={Colors.text.tertiary} style={styles.groupTitle}>
          ACCOUNT
        </Text>
        <Card style={styles.groupCard}>
          <ListRow
            icon="user"
            iconColor="cyan"
            label="Driver Handle"
            rightValue={`@${driverHandle}`}
            chevron
            onPress={() => setEditProfileVisible(true)}
          />
          <ListRow
            icon="link"
            iconColor="blue"
            label="Driver Referral"
            sublabel={`${totalReferrals} referred`}
            rightValue={isLoadingReferral ? '••••••' : (referralCode ?? 'DRIVE1')}
            chevron
            onPress={() => shareInvite()}
          />
          <ListRow
            icon="globe"
            iconColor="default"
            label="Referral Portal"
            sublabel={`${APP_DOMAIN}/i/${referralCode ?? 'DRIVE1'}`}
            isLast
          />
        </Card>
      </View>

      {/* 3. Inset Group: Units and Display */}
      <View style={styles.groupWrapper}>
        <Text variant="label" color={Colors.text.tertiary} style={styles.groupTitle}>
          UNITS AND DISPLAY
        </Text>
        <Card style={styles.groupCard}>
          <ListRow
            icon="speedometer"
            iconColor="cyan"
            label="Speed & Distance"
            sublabel={
              speedUnit === 'kmh'
                ? 'Metric units (km/h, kilometres)'
                : 'Imperial units (mph, miles)'
            }
            rightValue={speedUnit === 'kmh' ? 'km/h' : 'mph'}
            chevron
            onPress={handleToggleUnits}
            isLast
          />
        </Card>
      </View>

      {/* 4. Inset Group: Alerts */}
      <View style={styles.groupWrapper}>
        <Text variant="label" color={Colors.text.tertiary} style={styles.groupTitle}>
          ALERTS
        </Text>
        <Card style={styles.groupCard}>
          <ListRow
            icon="bell"
            iconColor="warning"
            label="Speed Radar Alerts"
            sublabel="Audible alert on approaching verified radar"
            rightSlot={
              <Switch
                value={radarAlerts}
                onValueChange={setRadarAlerts}
                trackColor={{ false: Colors.surface['3'], true: Colors.accent.cyan }}
                thumbColor={radarAlerts ? '#05070D' : Colors.text.tertiary}
              />
            }
          />
          <ListRow
            icon="warning"
            iconColor="danger"
            label="Hazard Proximity"
            sublabel="Potholes, debris, and animal warnings"
            rightSlot={
              <Switch
                value={hazardAlerts}
                onValueChange={setHazardAlerts}
                trackColor={{ false: Colors.surface['3'], true: Colors.accent.cyan }}
                thumbColor={hazardAlerts ? '#05070D' : Colors.text.tertiary}
              />
            }
          />
          <ListRow
            icon="lightning"
            iconColor="cyan"
            label="Telemetry Audio Chimes"
            sublabel="Launch, split-time, and top speed chime"
            isLast
            rightSlot={
              <Switch
                value={audioChimes}
                onValueChange={setAudioChimes}
                trackColor={{ false: Colors.surface['3'], true: Colors.accent.cyan }}
                thumbColor={audioChimes ? '#05070D' : Colors.text.tertiary}
              />
            }
          />
        </Card>
      </View>

      {/* 5. Inset Group: Privacy and Security */}
      <View style={styles.groupWrapper}>
        <Text variant="label" color={Colors.text.tertiary} style={styles.groupTitle}>
          PRIVACY AND SECURITY
        </Text>
        <Card style={styles.groupCard}>
          {biometricSupported && (
            <ListRow
              icon="lock"
              iconColor="cyan"
              label="Biometric App Lock"
              sublabel="Require biometric sensor to open Slipstream"
              rightSlot={
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: Colors.surface['3'], true: Colors.accent.cyan }}
                  thumbColor={biometricEnabled ? '#05070D' : Colors.text.tertiary}
                />
              }
            />
          )}
          <ListRow
            icon="shield"
            iconColor="default"
            label="Export My Data (GDPR)"
            sublabel="Download personal telemetry and garage history"
            rightValue={exportingData ? 'Exporting…' : undefined}
            chevron
            onPress={handleExportData}
            isLast
          />
        </Card>
      </View>

      {/* 6. Inset Group: Support Slipstream */}
      <View style={styles.groupWrapper}>
        <Text variant="label" color={Colors.text.tertiary} style={styles.groupTitle}>
          SUPPORT SLIPSTREAM
        </Text>
        <Card style={styles.groupCard}>
          <ListRow
            icon="lightning"
            iconColor="cyan"
            label="Support Independent Development"
            sublabel={
              supporterBadge
                ? `Active Supporter: ${supporterBadge}`
                : 'Voluntary patron tiers for servers & map tiles'
            }
            rightValue={supporterBadge ?? 'View Tiers'}
            chevron
            onPress={() => setSupportModalVisible(true)}
            isLast
          />
        </Card>
      </View>

      {/* 7. Inset Group: Legal */}
      <View style={styles.groupWrapper}>
        <Text variant="label" color={Colors.text.tertiary} style={styles.groupTitle}>
          LEGAL
        </Text>
        <Card style={styles.groupCard}>
          <ListRow
            icon="seal-check"
            iconColor="default"
            label="Terms of Service"
            chevron
            onPress={() => Linking.openURL('https://slipstream.io/terms').catch(() => {})}
          />
          <ListRow
            icon="shield"
            iconColor="default"
            label="Privacy Policy"
            chevron
            isLast
            onPress={() => Linking.openURL('https://slipstream.io/privacy').catch(() => {})}
          />
        </Card>
      </View>

      {/* 8. Inset Group: About (Long-press triggers diagnostics & Phase 0 dev screen) */}
      <View style={styles.groupWrapper}>
        <Text variant="label" color={Colors.text.tertiary} style={styles.groupTitle}>
          ABOUT
        </Text>
        <Card style={styles.groupCard}>
          <Pressable
            onLongPress={() => {
              if (__DEV__) {
                router.push('/dev-tokens');
              } else {
                setShowDiagnostics((prev) => !prev);
              }
            }}
            delayLongPress={600}
          >
            <ListRow
              icon="gear"
              iconColor="default"
              label="Slipstream"
              sublabel={__DEV__ ? 'Hold for Design Dev screen' : 'Hold for Update Diagnostics'}
              rightValue="v1.0.0 (Build 1)"
              isLast
            />
          </Pressable>
        </Card>

        {/* Update Diagnostics Card (revealed on long-press) */}
        {showDiagnostics && (
          <Card style={styles.diagnosticsCard}>
            <View style={styles.diagHeader}>
              <View>
                <Text variant="heading" color={Colors.text.primary} style={styles.diagTitle}>
                  OTA Update Diagnostics
                </Text>
                <Text variant="label" color={Colors.text.tertiary}>
                  Runtime & Channel Verification
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.diagCheckBtn, pressed && styles.btnPressed]}
                onPress={checkForUpdate}
                disabled={isChecking}
              >
                <Text variant="label" color={Colors.accent.cyan} style={styles.diagCheckBtnText}>
                  {isChecking ? 'Checking…' : 'Check now'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.diagRows}>
              <View style={styles.diagRow}>
                <Text variant="label" color={Colors.text.tertiary}>Channel</Text>
                <Text variant="label" color={Colors.text.primary} tabular>
                  {diagnostics.channel ?? 'None'}
                </Text>
              </View>
              <View style={styles.diagRow}>
                <Text variant="label" color={Colors.text.tertiary}>Runtime</Text>
                <Text variant="label" color={Colors.text.primary} tabular>
                  {diagnostics.runtimeVersion ?? 'Embedded'}
                </Text>
              </View>
              <View style={styles.diagRow}>
                <Text variant="label" color={Colors.text.tertiary}>Update ID</Text>
                <Text variant="label" color={Colors.text.primary} numberOfLines={1} tabular>
                  {diagnostics.updateId ?? 'Embedded Launch'}
                </Text>
              </View>
              <View style={styles.diagRow}>
                <Text variant="label" color={Colors.text.tertiary}>Status</Text>
                <Text variant="label" color={Colors.accent.cyan}>
                  {diagnostics.lastStatus}
                </Text>
              </View>
            </View>

            <Button
              variant="secondary"
              onPress={() => router.push('/dev-tokens')}
              style={styles.devTokensBtn}
            >
              Open Phase 0 Design Dev Screen
            </Button>
          </Card>
        )}
      </View>

      {/* 9. Danger Zone at the Very Bottom */}
      <View style={styles.groupWrapper}>
        <Text variant="label" color={Colors.text.tertiary} style={styles.groupTitle}>
          SESSION & SECURITY
        </Text>
        <Card style={styles.groupCard}>
          {/* Sign Out as a neutral row */}
          <ListRow
            icon="sign-out"
            iconColor="default"
            label="Sign Out"
            sublabel="Sign out of your active driver session"
            onPress={() => signOut()}
          />
          {/* Delete Account as quiet red destructive row */}
          <ListRow
            icon="trash"
            iconColor="danger"
            label="Delete Account & Data"
            sublabel="Permanently wipe driver account and telemetry"
            destructive
            isLast
            onPress={() => setDeleteSheetVisible(true)}
          />
        </Card>
      </View>

      {/* Modals & Sheets */}
      <AddVehicleModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSave={async (data) => {
          await addVehicle(data);
        }}
        isFirstVehicle={vehicles.length === 0}
      />

      <EditProfileModal
        visible={editProfileVisible}
        onClose={() => setEditProfileVisible(false)}
      />

      <SupportSlipstreamModal
        visible={supportModalVisible}
        onClose={() => setSupportModalVisible(false)}
        country="Kenya"
      />

      <DeleteAccountSheet
        visible={deleteSheetVisible}
        onClose={() => setDeleteSheetVisible(false)}
        onConfirmDelete={handleConfirmDeleteAccount}
      />

      <AttachDrivesModal
        visible={!!attachVehicle}
        vehicle={attachVehicle}
        onClose={() => setAttachVehicle(null)}
        onAttach={attachDrives}
      />

      {maintenanceVehicle && (
        <MaintenanceLogScreen
          visible={!!maintenanceVehicle}
          vehicleId={maintenanceVehicle.id}
          vehicleName={maintenanceVehicle.name}
          onClose={() => setMaintenanceVehicle(null)}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.section * 2,
    gap: Spacing.gap,
  },
  authCard: {
    padding: Spacing.section,
    gap: Spacing[4],
    alignItems: 'center',
    marginTop: Spacing.section,
  },
  authTitle: {
    textAlign: 'center',
  },
  authSub: {
    textAlign: 'center',
    lineHeight: 22,
  },
  authActions: {
    width: '100%',
    gap: Spacing[3],
    marginTop: Spacing[2],
  },
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing[4],
  },
  profileHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    flex: 1,
  },
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
    backgroundColor: Colors.surface['1'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: FontFamily.numberBold,
    fontSize: 22,
  },
  profileTextGroup: {
    flex: 1,
    gap: 2,
  },
  handleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  supporterBadgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: Radius.pill,
  },
  supporterText: {
    fontSize: 9,
    fontWeight: '700',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
    backgroundColor: Colors.surface['2'],
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.button,
  },
  btnPressed: {
    opacity: 0.7,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing[3],
    paddingBottom: Spacing[1],
  },
  addCarHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
    padding: Spacing[1],
  },
  addCarText: {
    fontWeight: '600',
  },
  groupWrapper: {
    gap: Spacing[2],
    paddingTop: Spacing[2],
  },
  groupTitle: {
    letterSpacing: 0.5,
    paddingLeft: Spacing[2],
  },
  groupCard: {
    padding: 0,
    overflow: 'hidden',
  },
  diagnosticsCard: {
    marginTop: Spacing[2],
    gap: Spacing[3],
    backgroundColor: Colors.surface['2'],
  },
  diagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  diagTitle: {
    fontSize: 16,
  },
  diagCheckBtn: {
    paddingVertical: Spacing[1],
    paddingHorizontal: Spacing[2],
  },
  diagCheckBtnText: {
    fontWeight: '600',
  },
  diagRows: {
    gap: Spacing[2],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    paddingVertical: Spacing[2],
  },
  diagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  devTokensBtn: {
    marginTop: Spacing[1],
  },
});
