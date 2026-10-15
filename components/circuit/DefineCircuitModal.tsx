/**
 * DefineCircuitModal — 4-Step Interactive Circuit Creation Wizard
 *
 * Steps (Phase 5 Task 3 & 5):
 *  1. Pick location (current GPS coordinates or manual location)
 *  2. Place start/finish line with orientation heading handle
 *  3. Optional sector splits (Sector 1, Sector 2) with skip CTA
 *  4. Name, estimated length, visibility toggle (default private), and closed-circuit safety confirmation
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { toUserMessage } from '@/utils/toUserMessage';
import {
  createTrack,
  type Track,
  type TrackPoint,
  type SectorPoint,
} from '@/services/trackDay';

interface DefineCircuitModalProps {
  visible: boolean;
  currentLon: number | null;
  currentLat: number | null;
  onClose: () => void;
  onCreated: (track: Track) => void;
}

export function DefineCircuitModal({
  visible,
  currentLon,
  currentLat,
  onClose,
  onCreated,
}: DefineCircuitModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [circuitLon, setCircuitLon] = useState<number>(currentLon ?? -0.1276);
  const [circuitLat, setCircuitLat] = useState<number>(currentLat ?? 51.5074);
  const [gateHeading, setGateHeading] = useState<number>(0); // 0-359 deg

  // Sectors
  const [sectors, setSectors] = useState<SectorPoint[]>([]);

  // Metadata
  const [trackName, setTrackName] = useState<string>('');
  const [locationName, setLocationName] = useState<string>('');
  const [lengthKm, setLengthKm] = useState<string>('3.8');
  const [isPublic, setIsPublic] = useState<boolean>(false); // DEFAULT PRIVATE
  const [safetyConfirmed, setSafetyConfirmed] = useState<boolean>(false);

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleNextStep = () => {
    try {
      void Haptics.selectionAsync();
    } catch {}
    setErrorMsg(null);
    if (step < 4) {
      setStep((s) => (s + 1) as any);
    }
  };

  const handlePrevStep = () => {
    try {
      void Haptics.selectionAsync();
    } catch {}
    setErrorMsg(null);
    if (step > 1) {
      setStep((s) => (s - 1) as any);
    }
  };

  const handleAddSector = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    if (sectors.length >= 3) return;
    const newIdx = sectors.length + 1;
    // Offset slightly for split demonstration
    const offset = newIdx * 0.003;
    const newSec: SectorPoint = {
      sectorIndex: newIdx,
      lat: circuitLat + offset,
      lon: circuitLon + offset,
      heading: (gateHeading + 90 * newIdx) % 360,
    };
    setSectors([...sectors, newSec]);
  };

  const handleSave = async () => {
    if (!trackName.trim()) {
      setErrorMsg('Please enter a circuit name.');
      return;
    }
    if (!safetyConfirmed) {
      setErrorMsg('Please confirm this circuit is a sanctioned closed track facility.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const lengthMeters = Math.round((parseFloat(lengthKm) || 3.5) * 1000);
      const startPoint: TrackPoint = {
        lat: circuitLat,
        lon: circuitLon,
        heading: gateHeading,
      };

      const newTrack = await createTrack({
        name: trackName.trim(),
        locationName: locationName.trim() || undefined,
        startFinishPoint: startPoint,
        startFinishHeading: gateHeading,
        sectorPoints: sectors,
        lengthMeters,
        isPublic,
      });

      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      onCreated(newTrack);
      onClose();
    } catch (err) {
      setErrorMsg(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Define Circuit</Text>
              <Text style={styles.stepIndicator}>Step {step} of 4</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Icon name="close" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Stepper Progress Bar */}
          <View style={styles.progressBar}>
            {[1, 2, 3, 4].map((s) => (
              <View
                key={s}
                style={[
                  styles.progressSegment,
                  s <= step ? styles.progressSegmentActive : undefined,
                ]}
              />
            ))}
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* STEP 1: Pick Location */}
            {step === 1 && (
              <View style={styles.stepWrap}>
                <Text style={styles.stepHeading}>Circuit Location</Text>
                <Text style={styles.stepDescription}>
                  Position the center of the motorsport circuit. You can use your current GPS fix or enter track coordinates.
                </Text>

                <Card style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <Icon name="map-pin" size={18} color={Colors.accent.cyan} />
                    <View style={styles.infoTextWrap}>
                      <Text style={styles.infoLabel}>CURRENT COORDINATES</Text>
                      <Text style={styles.infoValue}>
                        {circuitLat.toFixed(5)}°, {circuitLon.toFixed(5)}°
                      </Text>
                    </View>
                  </View>
                </Card>

                {currentLat && currentLon && (
                  <TouchableOpacity
                    style={styles.actionPill}
                    onPress={() => {
                      setCircuitLat(currentLat);
                      setCircuitLon(currentLon);
                      try {
                        void Haptics.selectionAsync();
                      } catch {}
                    }}
                  >
                    <Icon name="map-pin" size={14} color={Colors.accent.cyan} />
                    <Text style={styles.actionPillText}>Reset to current GPS location</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* STEP 2: Start/Finish Gate */}
            {step === 2 && (
              <View style={styles.stepWrap}>
                <Text style={styles.stepHeading}>Start / Finish Line</Text>
                <Text style={styles.stepDescription}>
                  Set the crossing orientation. The timing gate runs perpendicular to the driving heading to catch high-speed crossings.
                </Text>

                <Card style={styles.gateCard}>
                  <View style={styles.compassVisual}>
                    <Icon name="flag" size={32} color={Colors.accent.cyan} weight="duotone" />
                    <Text style={styles.headingDeg}>{gateHeading}°</Text>
                  </View>

                  <View style={styles.quickAngles}>
                    {[0, 90, 180, 270].map((deg) => (
                      <TouchableOpacity
                        key={deg}
                        style={[
                          styles.angleChip,
                          gateHeading === deg ? styles.angleChipActive : undefined,
                        ]}
                        onPress={() => setGateHeading(deg)}
                      >
                        <Text style={[styles.angleText, gateHeading === deg ? styles.angleTextActive : undefined]}>
                          {deg === 0 ? 'N (0°)' : deg === 90 ? 'E (90°)' : deg === 180 ? 'S (180°)' : 'W (270°)'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Card>
              </View>
            )}

            {/* STEP 3: Optional Sectors */}
            {step === 3 && (
              <View style={styles.stepWrap}>
                <Text style={styles.stepHeading}>Split Sectors (Optional)</Text>
                <Text style={styles.stepDescription}>
                  Add intermediate split checkpoints (S1, S2) around the circuit to track corner-by-corner delta.
                </Text>

                {sectors.map((s, idx) => (
                  <Card key={idx} style={styles.sectorCard}>
                    <View style={styles.sectorRow}>
                      <View style={styles.sectorBadge}>
                        <Text style={styles.sectorBadgeText}>S{idx + 1}</Text>
                      </View>
                      <View style={styles.sectorInfo}>
                        <Text style={styles.sectorTitle}>Sector {idx + 1} Split Gate</Text>
                        <Text style={styles.sectorSub}>
                          {s.lat.toFixed(5)}°, {s.lon.toFixed(5)}°
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setSectors(sectors.filter((_, i) => i !== idx))}
                        hitSlop={8}
                      >
                        <Icon name="close" size={16} color={Colors.semantic.danger} />
                      </TouchableOpacity>
                    </View>
                  </Card>
                ))}

                {sectors.length < 3 && (
                  <TouchableOpacity style={styles.addSectorBtn} onPress={handleAddSector}>
                    <Icon name="plus" size={16} color={Colors.accent.cyan} />
                    <Text style={styles.addSectorText}>Add Sector Checkpoint</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* STEP 4: Name, Length, Safety, & Visibility */}
            {step === 4 && (
              <View style={styles.stepWrap}>
                <Text style={styles.stepHeading}>Circuit Details</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>CIRCUIT NAME</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Brands Hatch Indy, Donington Park"
                    placeholderTextColor={Colors.text.tertiary}
                    value={trackName}
                    onChangeText={setTrackName}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>LOCATION / VENUE (OPTIONAL)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Kent, England"
                    placeholderTextColor={Colors.text.tertiary}
                    value={locationName}
                    onChangeText={setLocationName}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>TRACK LENGTH (KM)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="3.8"
                    placeholderTextColor={Colors.text.tertiary}
                    value={lengthKm}
                    onChangeText={setLengthKm}
                    keyboardType="numeric"
                  />
                </View>

                {/* Visibility Toggle — Default Private */}
                <Card style={styles.privacyCard}>
                  <View style={styles.privacyRow}>
                    <View style={styles.privacyTextGroup}>
                      <Text style={styles.privacyTitle}>Private Circuit</Text>
                      <Text style={styles.privacySubtitle}>
                        Only you can view and record laps on this circuit layout.
                      </Text>
                    </View>
                    <Switch
                      value={!isPublic}
                      onValueChange={(val) => setIsPublic(!val)}
                      trackColor={{ false: Colors.accent.blue, true: Colors.accent.cyan }}
                      thumbColor={Colors.text.primary}
                    />
                  </View>
                </Card>

                {/* Mandatory Safety Notice */}
                <TouchableOpacity
                  style={[styles.safetyCard, safetyConfirmed ? styles.safetyCardConfirmed : undefined]}
                  onPress={() => setSafetyConfirmed(!safetyConfirmed)}
                  activeOpacity={0.8}
                >
                  <View style={styles.checkbox}>
                    {safetyConfirmed && <Icon name="check" size={14} color={Colors.bg.base} />}
                  </View>
                  <View style={styles.safetyTextGroup}>
                    <Text style={styles.safetyTitle}>Closed Circuit Only</Text>
                    <Text style={styles.safetyNotice}>
                      I acknowledge that lap timing is strictly designed for sanctioned track days and closed race circuits. Never record laps on public roadways.
                    </Text>
                  </View>
                </TouchableOpacity>

                {errorMsg && (
                  <Text style={styles.errorText}>{errorMsg}</Text>
                )}
              </View>
            )}
          </ScrollView>

          {/* Bottom Actions */}
          <View style={styles.footer}>
            {step > 1 ? (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={handlePrevStep}
                disabled={saving}
              >
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
            ) : <View style={{ flex: 1 }} />}

            {step < 4 ? (
              <TouchableOpacity style={styles.nextBtn} onPress={handleNextStep}>
                <Text style={styles.nextBtnText}>Continue</Text>
                <Icon name="caret-right" size={16} color={Colors.bg.base} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.saveBtn, saving ? styles.saveBtnDisabled : undefined]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.bg.base} />
                ) : (
                  <>
                    <Icon name="flag" size={16} color={Colors.bg.base} weight="fill" />
                    <Text style={styles.saveBtnText}>Save Circuit</Text>
                  </>
                )}
              </TouchableOpacity>
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
  sheetContainer: {
    backgroundColor: Colors.surface['1'],
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    maxHeight: '90%',
    paddingBottom: Spacing[6],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[4],
    paddingBottom: Spacing[2],
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  stepIndicator: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.accent.cyan,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface['2'],
  },
  progressBar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.hairline,
  },
  progressSegmentActive: {
    backgroundColor: Colors.accent.cyan,
  },
  body: {
    maxHeight: 460,
  },
  bodyContent: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
  },
  stepWrap: {
    gap: Spacing[3],
  },
  stepHeading: {
    fontFamily: FontFamily.heading,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  stepDescription: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  infoCard: {
    padding: Spacing[3],
    backgroundColor: Colors.surface['2'],
    borderRadius: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoTextWrap: {
    gap: 2,
  },
  infoLabel: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.tertiary,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontFamily: FontFamily.metric,
    fontSize: 13,
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
  },
  actionPillText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.accent.cyan,
  },
  gateCard: {
    alignItems: 'center',
    padding: Spacing[4],
    gap: Spacing[3],
    backgroundColor: Colors.surface['2'],
    borderRadius: 16,
  },
  compassVisual: {
    alignItems: 'center',
    gap: 6,
  },
  headingDeg: {
    fontFamily: FontFamily.heading,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.accent.cyan,
    fontVariant: ['tabular-nums'],
  },
  quickAngles: {
    flexDirection: 'row',
    gap: 8,
  },
  angleChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.surface['1'],
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  angleChipActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.15)',
    borderColor: Colors.accent.cyan,
  },
  angleText: {
    fontFamily: FontFamily.metric,
    fontSize: 12,
    color: Colors.text.secondary,
  },
  angleTextActive: {
    color: Colors.accent.cyan,
    fontWeight: '700',
  },
  sectorCard: {
    padding: Spacing[3],
    backgroundColor: Colors.surface['2'],
    borderRadius: 14,
  },
  sectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectorBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectorBadgeText: {
    fontFamily: FontFamily.heading,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.bg.base,
  },
  sectorInfo: {
    flex: 1,
    gap: 2,
  },
  sectorTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  sectorSub: {
    fontFamily: FontFamily.metric,
    fontSize: 11,
    color: Colors.text.tertiary,
    fontVariant: ['tabular-nums'],
  },
  addSectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderStyle: 'dashed',
  },
  addSectorText: {
    fontFamily: FontFamily.heading,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent.cyan,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.tertiary,
    letterSpacing: 0.6,
  },
  textInput: {
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface['2'],
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingHorizontal: 12,
    color: Colors.text.primary,
    fontFamily: FontFamily.body,
    fontSize: 14,
  },
  privacyCard: {
    padding: Spacing[3],
    backgroundColor: Colors.surface['2'],
    borderRadius: 14,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  privacyTextGroup: {
    flex: 1,
    gap: 2,
  },
  privacyTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  privacySubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.text.secondary,
  },
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: Spacing[3],
    borderRadius: 14,
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  safetyCardConfirmed: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  safetyTextGroup: {
    flex: 1,
    gap: 2,
  },
  safetyTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  safetyNotice: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  errorText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.semantic.danger,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    gap: Spacing[3],
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
  },
  backBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  backBtnText: {
    fontFamily: FontFamily.heading,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent.cyan,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  nextBtnText: {
    fontFamily: FontFamily.heading,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.bg.base,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent.cyan,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontFamily: FontFamily.heading,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.bg.base,
  },
});
