/**
 * OnboardingScreen — First-Run Flow (Phase 2)
 *
 * Requirements:
 *  1. Choose a unique handle with live debounce uniqueness check.
 *  2. Add a car (uses MakeModelPicker).
 *  3. Pick units (default km/h).
 *  4. Permission primers that explain why before each system prompt (location first, then notifications).
 *  5. Finish with a "Your profile is ready" summary: avatar, handle, car, and stat tiles that show dashes with a hint until real data exists.
 *  6. Pinned CTA "Start driving".
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Colors, FontFamily, Radius, Spacing, Typography } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { IconChip } from '@/components/ui/IconChip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { MakeModelPicker } from '@/components/vehicles/MakeModelPicker';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toUserMessage } from '@/utils/toUserMessage';

type Step = 'handle' | 'car' | 'units' | 'permission_location' | 'permission_notifications' | 'summary';

const HANDLE_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, profile, completeOnboarding } = useAuth();

  const [step, setStep] = useState<Step>('handle');

  // Step 1: Handle state
  const [handle, setHandle] = useState<string>(() =>
    profile?.display_name ? profile.display_name.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) : '',
  );
  const [handleChecking, setHandleChecking] = useState<boolean>(false);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [handleError, setHandleError] = useState<string | null>(null);

  // Step 2: Car state
  const [make, setMake] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [pickerVisible, setPickerVisible] = useState<boolean>(false);

  // Step 3: Units state
  const [speedUnit, setSpeedUnit] = useState<'kmh' | 'mph'>('kmh');

  // Step 4 & 5: Completion state
  const [saving, setSaving] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced uniqueness check against Supabase profiles
  const checkHandleAvailability = useCallback(async (candidate: string) => {
    const clean = candidate.trim().replace(/^@/, '');
    if (!HANDLE_REGEX.test(clean)) {
      setHandleAvailable(null);
      setHandleError('Handle must be 3–20 characters (letters, numbers, underscores).');
      setHandleChecking(false);
      return;
    }

    setHandleChecking(true);
    setHandleError(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .ilike('display_name', clean)
        .neq('id', user?.id ?? '')
        .maybeSingle();

      if (error) {
        setHandleError('Unable to verify handle availability. Please try again.');
        setHandleAvailable(null);
      } else if (data) {
        setHandleAvailable(false);
        setHandleError('Handle is already taken. Try another.');
      } else {
        setHandleAvailable(true);
        setHandleError(null);
      }
    } catch (e) {
      setHandleError(toUserMessage(e));
      setHandleAvailable(null);
    } finally {
      setHandleChecking(false);
    }
  }, [user]);

  const handleTextChange = (text: string) => {
    const clean = text.replace(/^@/, '');
    setHandle(clean);
    setHandleAvailable(null);
    setHandleError(null);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (clean.length >= 3) {
      setHandleChecking(true);
      debounceTimer.current = setTimeout(() => {
        checkHandleAvailability(clean);
      }, 400);
    } else {
      setHandleChecking(false);
    }
  };

  // Permission 1: Location
  const handleRequestLocation = async () => {
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch (e) {
      console.warn('[Onboarding] Location permission request error:', e);
    } finally {
      setStep('permission_notifications');
    }
  };

  // Permission 2: Notifications & finalize onboarding data
  const handleRequestNotificationsAndFinish = async () => {
    try {
      await Notifications.requestPermissionsAsync();
    } catch (e) {
      console.warn('[Onboarding] Notifications permission request error:', e);
    } finally {
      await saveAndProceedToSummary();
    }
  };

  const handleSkipNotificationsAndFinish = async () => {
    await saveAndProceedToSummary();
  };

  const saveAndProceedToSummary = async () => {
    setSaving(true);
    setGeneralError(null);
    try {
      const vehiclePayload =
        make && model
          ? {
              make,
              model,
              year: parseInt(year, 10) || new Date().getFullYear(),
            }
          : null;

      const result = await completeOnboarding({
        handle: handle.trim().replace(/^@/, ''),
        vehicle: vehiclePayload,
        speedUnit,
      });

      if (!result.success) {
        setGeneralError(result.error ?? 'Could not finalize profile.');
      } else {
        setStep('summary');
      }
    } catch (err) {
      setGeneralError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleStartDriving = () => {
    router.replace('/(tabs)/track');
  };

  // Avatar resolution
  const avatarUrl = user?.user_metadata?.avatar_url || profile?.avatar_url;
  const initial = (handle || user?.email || 'D').slice(0, 1).toUpperCase();

  return (
    <ScreenContainer scrollable contentStyle={styles.container}>
      {/* ── Progress Indicators (for setup steps) ── */}
      {step !== 'summary' && (
        <View style={styles.stepProgressBar}>
          <View
            style={[
              styles.stepIndicator,
              (step === 'handle' || step === 'car' || step === 'units' || step === 'permission_location' || step === 'permission_notifications') &&
                styles.stepIndicatorActive,
            ]}
          />
          <View
            style={[
              styles.stepIndicator,
              (step === 'car' || step === 'units' || step === 'permission_location' || step === 'permission_notifications') &&
                styles.stepIndicatorActive,
            ]}
          />
          <View
            style={[
              styles.stepIndicator,
              (step === 'units' || step === 'permission_location' || step === 'permission_notifications') &&
                styles.stepIndicatorActive,
            ]}
          />
          <View
            style={[
              styles.stepIndicator,
              (step === 'permission_location' || step === 'permission_notifications') &&
                styles.stepIndicatorActive,
            ]}
          />
        </View>
      )}

      {/* ── Error Banner ── */}
      {generalError ? (
        <View style={styles.errorBanner}>
          <Icon name="warning" size={18} color={Colors.semantic.danger} weight="bold" />
          <Text style={styles.errorBannerText}>{generalError}</Text>
        </View>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════════
          STEP 1: HANDLE
          ══════════════════════════════════════════════════════════════════ */}
      {step === 'handle' && (
        <View style={styles.stepContent}>
          <View style={styles.stepHeader}>
            <IconChip name="user" color="cyan" size={24} chipSize={48} />
            <Text style={styles.stepTitle}>Choose your handle</Text>
            <Text style={styles.stepSubtitle}>
              Your driver call-sign on community leaderboards, telemetry replays, and the grid.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.inputLabel}>Driver handle</Text>
            <View style={styles.handleInputContainer}>
              <Text style={styles.handlePrefix}>@</Text>
              <TextInput
                style={styles.handleTextInput}
                placeholder="apex_hunter"
                placeholderTextColor={Colors.text.tertiary}
                value={handle}
                onChangeText={handleTextChange}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="done"
              />
              {handleChecking ? (
                <ActivityIndicator size="small" color={Colors.accent.cyan} />
              ) : handleAvailable === true ? (
                <Icon name="check-circle" size={20} color={Colors.semantic.success} weight="fill" />
              ) : handleAvailable === false ? (
                <Icon name="x-circle" size={20} color={Colors.semantic.danger} weight="fill" />
              ) : null}
            </View>

            {handleError ? (
              <Text style={styles.fieldErrorText}>{handleError}</Text>
            ) : handleAvailable === true ? (
              <Text style={styles.fieldSuccessText}>@{handle} is available!</Text>
            ) : (
              <Text style={styles.fieldHelperText}>3–20 characters. Letters, numbers, and underscores.</Text>
            )}
          </View>

          <Button
            variant="primary"
            disabled={!handle || handleChecking || handleAvailable !== true}
            onPress={() => setStep('car')}
            style={styles.continueButton}
          >
            Continue
          </Button>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STEP 2: ADD A CAR
          ══════════════════════════════════════════════════════════════════ */}
      {step === 'car' && (
        <View style={styles.stepContent}>
          <View style={styles.stepHeader}>
            <IconChip name="car" color="cyan" size={24} chipSize={48} />
            <Text style={styles.stepTitle}>Build your garage</Text>
            <Text style={styles.stepSubtitle}>
              Add your primary vehicle to compare lap times and drag sprints against matching specs.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.inputLabel}>Primary vehicle</Text>

            <TouchableOpacity
              style={styles.vehicleSelector}
              onPress={() => setPickerVisible(true)}
              activeOpacity={0.8}
            >
              <View style={styles.vehicleSelectorLeft}>
                <Icon name="car" size={20} color={make ? Colors.accent.cyan : Colors.text.tertiary} />
                <Text style={make ? styles.vehicleSelectedText : styles.vehiclePlaceholderText}>
                  {make && model ? `${make} ${model}` : 'Select make & model'}
                </Text>
              </View>
              <Icon name="caret-right" size={18} color={Colors.text.tertiary} />
            </TouchableOpacity>

            {make && model ? (
              <View style={styles.yearRow}>
                <Text style={styles.inputLabel}>Model year</Text>
                <TextInput
                  style={styles.yearInput}
                  placeholder="2024"
                  placeholderTextColor={Colors.text.tertiary}
                  value={year}
                  onChangeText={(val) => setYear(val.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
            ) : null}
          </View>

          <MakeModelPicker
            visible={pickerVisible}
            onClose={() => setPickerVisible(false)}
            onSelect={(selectedMake, selectedModel) => {
              setMake(selectedMake);
              setModel(selectedModel);
            }}
          />

          <Button
            variant="primary"
            disabled={!make || !model}
            onPress={() => setStep('units')}
            style={styles.continueButton}
          >
            Continue
          </Button>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => {
              setMake('');
              setModel('');
              setStep('units');
            }}
          >
            <Text style={styles.skipButtonText}>I&apos;ll add a car later</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STEP 3: PICK UNITS
          ══════════════════════════════════════════════════════════════════ */}
      {step === 'units' && (
        <View style={styles.stepContent}>
          <View style={styles.stepHeader}>
            <IconChip name="speedometer" color="cyan" size={24} chipSize={48} />
            <Text style={styles.stepTitle}>Telemetry units</Text>
            <Text style={styles.stepSubtitle}>
              Select your preferred speed and distance standard.
            </Text>
          </View>

          <View style={styles.unitsGrid}>
            <TouchableOpacity
              style={[
                styles.unitCard,
                speedUnit === 'kmh' && styles.unitCardActive,
              ]}
              onPress={() => setSpeedUnit('kmh')}
              activeOpacity={0.85}
            >
              <View style={styles.unitCardTop}>
                <IconChip
                  name="speedometer"
                  color={speedUnit === 'kmh' ? 'cyan' : 'default'}
                  size={20}
                  chipSize={40}
                />
                {speedUnit === 'kmh' && (
                  <Icon name="check-circle" size={22} color={Colors.accent.cyan} weight="fill" />
                )}
              </View>
              <Text style={styles.unitCardTitle}>Metric (km/h)</Text>
              <Text style={styles.unitCardDesc}>
                Speed in kilometres per hour (km/h), distance in metres and kilometres.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.unitCard,
                speedUnit === 'mph' && styles.unitCardActive,
              ]}
              onPress={() => setSpeedUnit('mph')}
              activeOpacity={0.85}
            >
              <View style={styles.unitCardTop}>
                <IconChip
                  name="gauge"
                  color={speedUnit === 'mph' ? 'blue' : 'default'}
                  size={20}
                  chipSize={40}
                />
                {speedUnit === 'mph' && (
                  <Icon name="check-circle" size={22} color={Colors.accent.cyan} weight="fill" />
                )}
              </View>
              <Text style={styles.unitCardTitle}>Imperial (mph)</Text>
              <Text style={styles.unitCardDesc}>
                Speed in miles per hour (mph), distance in feet and miles.
              </Text>
            </TouchableOpacity>
          </View>

          <Button
            variant="primary"
            onPress={() => setStep('permission_location')}
            style={styles.continueButton}
          >
            Continue
          </Button>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STEP 4: PERMISSION PRIMER — LOCATION
          ══════════════════════════════════════════════════════════════════ */}
      {step === 'permission_location' && (
        <View style={styles.stepContent}>
          <View style={styles.primerCard}>
            <IconChip name="map-pin" color="cyan" size={32} chipSize={64} />
            <Text style={styles.primerTitle}>High-Precision Location</Text>
            <Text style={styles.primerExplanation}>
              Slipstream uses high-frequency GPS to calculate accurate speed, 0–100 trap splits, g-force telemetry, and circuit lap times.
            </Text>
            <View style={styles.primerBullet}>
              <Icon name="shield" size={16} color={Colors.accent.cyan} />
              <Text style={styles.primerBulletText}>
                Your coordinates are encrypted and never sold or shared.
              </Text>
            </View>
          </View>

          <Button
            variant="primary"
            onPress={handleRequestLocation}
            style={styles.continueButton}
          >
            Enable Location
          </Button>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => setStep('permission_notifications')}
          >
            <Text style={styles.skipButtonText}>Not now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STEP 5: PERMISSION PRIMER — NOTIFICATIONS
          ══════════════════════════════════════════════════════════════════ */}
      {step === 'permission_notifications' && (
        <View style={styles.stepContent}>
          <View style={styles.primerCard}>
            <IconChip name="bell" color="warning" size={32} chipSize={64} />
            <Text style={styles.primerTitle}>Live Alerts & Standings</Text>
            <Text style={styles.primerExplanation}>
              Get real-time community radar alerts, notifications when you are overtaken on a leaderboard, and scheduled service intervals for your garage.
            </Text>
            <View style={styles.primerBullet}>
              <Icon name="shield" size={16} color={Colors.semantic.warning} />
              <Text style={styles.primerBulletText}>
                Only critical driver and vehicle updates. No marketing spam.
              </Text>
            </View>
          </View>

          <Button
            variant="primary"
            loading={saving}
            onPress={handleRequestNotificationsAndFinish}
            style={styles.continueButton}
          >
            Enable Notifications
          </Button>

          <TouchableOpacity
            style={styles.skipButton}
            disabled={saving}
            onPress={handleSkipNotificationsAndFinish}
          >
            <Text style={styles.skipButtonText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STEP 6: SUMMARY — "YOUR PROFILE IS READY"
          ══════════════════════════════════════════════════════════════════ */}
      {step === 'summary' && (
        <View style={styles.summaryContent}>
          <View style={styles.summaryHeader}>
            <IconChip name="seal-check" color="success" size={28} chipSize={56} />
            <Text style={styles.summaryTitle}>Your profile is ready</Text>
            <Text style={styles.summarySubtitle}>
              Your driver credentials and baseline telemetry are locked in.
            </Text>
          </View>

          {/* Profile Identity Card */}
          <View style={styles.identityCard}>
            <View style={styles.identityRow}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}
              <View style={styles.identityDetails}>
                <Text style={styles.identityHandle}>@{handle}</Text>
                <View style={styles.identityMetaRow}>
                  <Icon name="car" size={14} color={Colors.accent.cyan} />
                  <Text style={styles.identityCarText}>
                    {make && model ? `${year} ${make} ${model}` : 'Unassigned Garage'}
                  </Text>
                </View>
              </View>
              <View style={styles.unitsPill}>
                <Text style={styles.unitsPillText}>{speedUnit.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {/* Stat Tiles: dashes with hint until real data exists */}
          <View style={styles.statTilesGrid}>
            {/* Tile 1: Top Speed */}
            <View style={styles.statTile}>
              <Text style={styles.statTileOverline}>TOP SPEED</Text>
              <View style={styles.statTileValueRow}>
                <Text style={styles.statTileDashes}>--</Text>
                <Text style={styles.statTileUnit}>{speedUnit}</Text>
              </View>
              <Text style={styles.statTileHint}>Log your speed on a track or open run</Text>
            </View>

            {/* Tile 2: 0-100 / 0-60 sprint */}
            <View style={styles.statTile}>
              <Text style={styles.statTileOverline}>
                {speedUnit === 'kmh' ? '0–100 SPRINT' : '0–60 SPRINT'}
              </Text>
              <View style={styles.statTileValueRow}>
                <Text style={styles.statTileDashes}>--</Text>
                <Text style={styles.statTileUnit}>s</Text>
              </View>
              <Text style={styles.statTileHint}>Launch in Drag mode to set benchmark</Text>
            </View>

            {/* Tile 3: Total Distance */}
            <View style={styles.statTile}>
              <Text style={styles.statTileOverline}>TOTAL DISTANCE</Text>
              <View style={styles.statTileValueRow}>
                <Text style={styles.statTileDashes}>--</Text>
                <Text style={styles.statTileUnit}>{speedUnit === 'kmh' ? 'km' : 'mi'}</Text>
              </View>
              <Text style={styles.statTileHint}>Record your first drive to start telemetry</Text>
            </View>

            {/* Tile 4: Circuit Laps */}
            <View style={styles.statTile}>
              <Text style={styles.statTileOverline}>LAPS RECORDED</Text>
              <View style={styles.statTileValueRow}>
                <Text style={styles.statTileDashes}>--</Text>
                <Text style={styles.statTileUnit}>laps</Text>
              </View>
              <Text style={styles.statTileHint}>Hit the track to log sector splits</Text>
            </View>
          </View>

          {/* Pinned CTA: Start Driving */}
          <View style={styles.ctaPinnedContainer}>
            <Button
              variant="primary"
              onPress={handleStartDriving}
              style={styles.startDrivingButton}
            >
              Start driving
            </Button>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing[4],
    paddingBottom: Spacing[10],
  },
  stepProgressBar: {
    flexDirection: 'row',
    gap: Spacing[2],
    marginBottom: Spacing[6],
  },
  stepIndicator: {
    flex: 1,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  stepIndicatorActive: {
    backgroundColor: Colors.accent.cyan,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tint.danger,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.3)',
    borderRadius: Radius.sm,
    padding: Spacing[3],
    marginBottom: Spacing[4],
    gap: Spacing[2],
  },
  errorBannerText: {
    ...Typography.label,
    color: Colors.semantic.danger,
    flex: 1,
  },
  stepContent: {
    flex: 1,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: Spacing[6],
    gap: Spacing[2],
  },
  stepTitle: {
    ...Typography.title,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  stepSubtitle: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text.secondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  card: {
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.card,
    marginBottom: Spacing[6],
    gap: Spacing[3],
  },
  inputLabel: {
    ...Typography.overline,
    color: Colors.text.tertiary,
  },
  handleInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingHorizontal: Spacing[4],
  },
  handlePrefix: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: Colors.accent.cyan,
    marginRight: 4,
  },
  handleTextInput: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 16,
    color: Colors.text.primary,
  },
  fieldErrorText: {
    ...Typography.label,
    fontSize: 12,
    color: Colors.semantic.danger,
  },
  fieldSuccessText: {
    ...Typography.label,
    fontSize: 12,
    color: Colors.semantic.success,
  },
  fieldHelperText: {
    ...Typography.label,
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  continueButton: {
    marginTop: Spacing[2],
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing[4],
  },
  skipButtonText: {
    ...Typography.label,
    color: Colors.text.tertiary,
  },
  vehicleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 54,
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingHorizontal: Spacing[4],
  },
  vehicleSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  vehicleSelectedText: {
    fontFamily: FontFamily.heading,
    fontSize: 15,
    color: Colors.text.primary,
  },
  vehiclePlaceholderText: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.text.tertiary,
  },
  yearRow: {
    marginTop: Spacing[2],
    gap: Spacing[2],
  },
  yearInput: {
    height: 50,
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingHorizontal: Spacing[4],
    fontFamily: FontFamily.metric,
    fontSize: 16,
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  unitsGrid: {
    gap: Spacing[4],
    marginBottom: Spacing[6],
  },
  unitCard: {
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.card,
  },
  unitCardActive: {
    borderColor: Colors.accent.cyan,
    backgroundColor: 'rgba(34,211,238,0.06)',
  },
  unitCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[3],
  },
  unitCardTitle: {
    ...Typography.heading,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  unitCardDesc: {
    ...Typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.text.secondary,
  },
  primerCard: {
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing[6],
    alignItems: 'center',
    marginBottom: Spacing[6],
    gap: Spacing[3],
  },
  primerTitle: {
    ...Typography.title,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  primerExplanation: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  primerBullet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    marginTop: Spacing[2],
  },
  primerBulletText: {
    ...Typography.label,
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  // Summary Styles
  summaryContent: {
    flex: 1,
  },
  summaryHeader: {
    alignItems: 'center',
    marginBottom: Spacing[6],
    gap: Spacing[2],
  },
  summaryTitle: {
    ...Typography.title,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  summarySubtitle: {
    ...Typography.body,
    fontSize: 15,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  identityCard: {
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.card,
    marginBottom: Spacing[6],
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: Colors.accent.cyan,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.tint.cyan,
    borderWidth: 2,
    borderColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    color: Colors.accent.cyan,
  },
  identityDetails: {
    flex: 1,
    marginLeft: Spacing[3],
  },
  identityHandle: {
    ...Typography.heading,
    color: Colors.text.primary,
  },
  identityMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  identityCarText: {
    ...Typography.label,
    fontSize: 13,
    color: Colors.text.secondary,
  },
  unitsPill: {
    backgroundColor: Colors.surface['2'],
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[3],
    paddingVertical: 4,
  },
  unitsPillText: {
    ...Typography.overline,
    color: Colors.accent.cyan,
  },
  statTilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.gap,
    marginBottom: Spacing[8],
  },
  statTile: {
    width: '48%',
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.card,
  },
  statTileOverline: {
    ...Typography.overline,
    fontSize: 11,
    color: Colors.text.tertiary,
    marginBottom: Spacing[2],
  },
  statTileValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 6,
  },
  statTileDashes: {
    ...Typography.metricL,
    fontSize: 28,
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  statTileUnit: {
    ...Typography.label,
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  statTileHint: {
    ...Typography.label,
    fontSize: 11,
    lineHeight: 15,
    color: Colors.text.tertiary,
  },
  ctaPinnedContainer: {
    paddingVertical: Spacing[2],
  },
  startDrivingButton: {
    width: '100%',
  },
});
