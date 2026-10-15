/**
 * MakeModelPicker — 2-step searchable catalogue picker + custom car entry
 *
 * Requirements:
 *  - Step 1: Searchable vehicle makes (from vehicle_makes)
 *  - Step 2: Searchable vehicle models (from vehicle_models)
 *  - "Can't find your car? Add it yourself" custom entry
 *  - Fuzzy duplicate check against catalogue with confirmation step
 *  - Theme tokens only, Phosphor icons, no emojis
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import {
  fetchMakes,
  fetchModels,
  checkVehicleDuplicate,
  type DuplicateCheckResult,
} from '@/services/vehicles';
import type { VehicleMake, VehicleModel } from '@/types/database';

interface MakeModelPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (make: string, model: string) => void;
}

type PickerMode = 'make' | 'model' | 'custom';

export function MakeModelPicker({ visible, onClose, onSelect }: MakeModelPickerProps) {
  const [mode, setMode] = useState<PickerMode>('make');
  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [selectedMake, setSelectedMake] = useState<VehicleMake | null>(null);

  const [loadingMakes, setLoadingMakes] = useState<boolean>(true);
  const [loadingModels, setLoadingModels] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Custom vehicle addition state
  const [customMake, setCustomMake] = useState<string>('');
  const [customModel, setCustomModel] = useState<string>('');
  const [checkingDuplicate, setCheckingDuplicate] = useState<boolean>(false);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateCheckResult | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchMakes()
      .then((data) => {
        if (isMounted) setMakes(data);
      })
      .catch((err) => console.error('[MakeModelPicker] Failed to fetch makes:', err))
      .finally(() => {
        if (isMounted) setLoadingMakes(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleClose = () => {
    setMode('make');
    setSelectedMake(null);
    setSearchQuery('');
    setCustomMake('');
    setCustomModel('');
    setDuplicateMatch(null);
    setCheckingDuplicate(false);
    onClose();
  };

  const handleSelectMake = (make: VehicleMake) => {
    setSelectedMake(make);
    setSearchQuery('');
    setMode('model');
    setLoadingModels(true);
    fetchModels(make.id)
      .then((data) => setModels(data))
      .catch((err) => console.error('[MakeModelPicker] Failed to fetch models:', err))
      .finally(() => setLoadingModels(false));
  };

  const handleSelectModel = (model: VehicleModel) => {
    if (!selectedMake) return;
    onSelect(selectedMake.name, model.name);
    handleClose();
  };

  const handleSwitchToCustom = () => {
    setMode('custom');
    if (selectedMake) {
      setCustomMake(selectedMake.name);
    }
  };

  const handleReviewCustomCar = async () => {
    const cleanMake = customMake.trim();
    const cleanModel = customModel.trim();

    if (!cleanMake || !cleanModel) {
      Alert.alert('Incomplete Car Details', 'Please specify both make and model name.');
      return;
    }

    setCheckingDuplicate(true);
    try {
      const result = await checkVehicleDuplicate(cleanMake, cleanModel);
      if (result.isDuplicate && result.match) {
        setDuplicateMatch(result);
      } else {
        // No match found -> accept custom entry directly
        onSelect(cleanMake, cleanModel);
        handleClose();
      }
    } catch {
      onSelect(cleanMake, cleanModel);
      handleClose();
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const filteredMakes = useMemo(() => {
    if (!searchQuery.trim()) return makes;
    const q = searchQuery.toLowerCase().trim();
    return makes.filter((m) => m.name.toLowerCase().includes(q));
  }, [makes, searchQuery]);

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    const q = searchQuery.toLowerCase().trim();
    return models.filter((m) => m.name.toLowerCase().includes(q));
  }, [models, searchQuery]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {mode === 'model' && (
                <Pressable
                  style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
                  onPress={() => {
                    setMode('make');
                    setSearchQuery('');
                  }}
                  hitSlop={8}
                >
                  <Icon name="arrow-left" size={18} color={Colors.text.primary} />
                </Pressable>
              )}
              {mode === 'custom' && (
                <Pressable
                  style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
                  onPress={() => {
                    setMode(selectedMake ? 'model' : 'make');
                    setDuplicateMatch(null);
                  }}
                  hitSlop={8}
                >
                  <Icon name="arrow-left" size={18} color={Colors.text.primary} />
                </Pressable>
              )}
              <Text variant="heading" color={Colors.text.primary}>
                {mode === 'make'
                  ? 'Select Make'
                  : mode === 'model'
                  ? `${selectedMake?.name} Models`
                  : 'Add Custom Vehicle'}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.btnPressed]}
              onPress={handleClose}
              hitSlop={8}
            >
              <Icon name="close" size={20} color={Colors.text.secondary} />
            </Pressable>
          </View>

          {/* Custom Mode Body */}
          {mode === 'custom' ? (
            <View style={styles.customContainer}>
              {duplicateMatch?.match ? (
                // Duplicate confirmation step
                <View style={styles.duplicateBox}>
                  <View style={styles.duplicateHeader}>
                    <Icon name="info" size={22} color={Colors.semantic.warning} />
                    <Text variant="title" color={Colors.text.primary} style={styles.duplicateTitle}>
                      Catalogue Match Found
                    </Text>
                  </View>
                  <Text variant="body" color={Colors.text.secondary} style={styles.duplicateDesc}>
                    We found an official match in our catalogue:
                  </Text>
                  <View style={styles.matchCard}>
                    <Text variant="heading" color={Colors.accent.cyan}>
                      {duplicateMatch.match.make} {duplicateMatch.match.model}
                    </Text>
                    <Text variant="label" color={Colors.text.tertiary}>
                      {duplicateMatch.match.confidence}% match confidence
                    </Text>
                  </View>

                  <View style={styles.duplicateActions}>
                    <Button
                      variant="primary"
                      onPress={() => {
                        if (duplicateMatch.match) {
                          onSelect(duplicateMatch.match.make, duplicateMatch.match.model);
                          handleClose();
                        }
                      }}
                    >
                      Use {duplicateMatch.match.make} {duplicateMatch.match.model}
                    </Button>
                    <Button
                      variant="secondary"
                      onPress={() => {
                        onSelect(customMake.trim(), customModel.trim());
                        handleClose();
                      }}
                      style={styles.secondaryBtn}
                    >
                      Keep My Custom Entry ({customMake.trim()})
                    </Button>
                  </View>
                </View>
              ) : (
                // Custom input form
                <View style={styles.customForm}>
                  <Text variant="body" color={Colors.text.secondary} style={styles.customIntro}>
                    Cannot find your car in the catalogue? Enter the manufacturer and model below.
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text variant="label" color={Colors.text.tertiary}>
                      MAKE / MANUFACTURER
                    </Text>
                    <TextInput
                      style={styles.customInput}
                      placeholder="e.g. Nissan"
                      placeholderTextColor={Colors.text.tertiary}
                      value={customMake}
                      onChangeText={setCustomMake}
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text variant="label" color={Colors.text.tertiary}>
                      MODEL
                    </Text>
                    <TextInput
                      style={styles.customInput}
                      placeholder="e.g. Skyline GT-R R34"
                      placeholderTextColor={Colors.text.tertiary}
                      value={customModel}
                      onChangeText={setCustomModel}
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                  </View>

                  <Button
                    variant="primary"
                    onPress={handleReviewCustomCar}
                    loading={checkingDuplicate}
                    style={styles.submitCustomBtn}
                  >
                    Confirm Custom Car
                  </Button>
                </View>
              )}
            </View>
          ) : (
            // Catalogue List Mode (Make or Model)
            <>
              {/* Search Box */}
              <View style={styles.searchContainer}>
                <Icon name="search" size={18} color={Colors.text.tertiary} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={
                    mode === 'make'
                      ? 'Search makes (e.g. Porsche)...'
                      : 'Search models (e.g. 911)...'
                  }
                  placeholderTextColor={Colors.text.tertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
              </View>

              {/* List Content */}
              {mode === 'make' ? (
                loadingMakes ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={Colors.accent.cyan} />
                  </View>
                ) : (
                  <FlatList
                    data={filteredMakes}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <Pressable
                        style={({ pressed }) => [styles.listItem, pressed && styles.itemPressed]}
                        onPress={() => handleSelectMake(item)}
                      >
                        <Text variant="body" color={Colors.text.primary} style={styles.itemText}>
                          {item.name}
                        </Text>
                        <Icon name="caret-right" size={16} color={Colors.text.tertiary} />
                      </Pressable>
                    )}
                    ListEmptyComponent={
                      <View style={styles.emptyState}>
                        <Text variant="body" color={Colors.text.secondary}>
                          No matching makes found.
                        </Text>
                      </View>
                    }
                    ListFooterComponent={
                      <Pressable
                        style={({ pressed }) => [styles.customCtaRow, pressed && styles.itemPressed]}
                        onPress={handleSwitchToCustom}
                      >
                        <View style={styles.customCtaContent}>
                          <Icon name="plus" size={18} color={Colors.accent.cyan} />
                          <Text variant="body" color={Colors.accent.cyan}>
                            Can&apos;t find your car? Add it yourself
                          </Text>
                        </View>
                      </Pressable>
                    }
                  />
                )
              ) : loadingModels ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={Colors.accent.cyan} />
                </View>
              ) : (
                <FlatList
                  data={filteredModels}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <Pressable
                      style={({ pressed }) => [styles.listItem, pressed && styles.itemPressed]}
                      onPress={() => handleSelectModel(item)}
                    >
                      <Text variant="body" color={Colors.text.primary} style={styles.itemText}>
                        {item.name}
                      </Text>
                      <Icon name="check" size={16} color={Colors.accent.cyan} />
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <Text variant="body" color={Colors.text.secondary}>
                        No matching models found for {selectedMake?.name}.
                      </Text>
                    </View>
                  }
                  ListFooterComponent={
                    <Pressable
                      style={({ pressed }) => [styles.customCtaRow, pressed && styles.itemPressed]}
                      onPress={handleSwitchToCustom}
                    >
                      <View style={styles.customCtaContent}>
                        <Icon name="plus" size={18} color={Colors.accent.cyan} />
                        <Text variant="body" color={Colors.accent.cyan}>
                          Can&apos;t find this model? Add it yourself
                        </Text>
                      </View>
                    </Pressable>
                  }
                />
              )}
            </>
          )}
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
    height: '84%',
    backgroundColor: Colors.surface['1'],
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    paddingTop: Spacing.card,
    overflow: 'hidden',
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  backBtn: {
    padding: Spacing[2],
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.iconChip,
  },
  closeBtn: {
    padding: Spacing[2],
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.iconChip,
  },
  btnPressed: {
    opacity: 0.7,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.button,
    marginHorizontal: Spacing.screen,
    marginTop: Spacing[4],
    marginBottom: Spacing[2],
    paddingHorizontal: Spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  searchIcon: {
    marginRight: Spacing[2],
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.text.primary,
  },
  listContent: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.section,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  itemText: {
    fontSize: 16,
  },
  itemPressed: {
    backgroundColor: Colors.surface['2'],
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: Spacing.section,
    alignItems: 'center',
  },
  customCtaRow: {
    paddingVertical: Spacing[4],
    marginTop: Spacing[3],
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  customCtaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  customContainer: {
    padding: Spacing.screen,
    flex: 1,
  },
  customForm: {
    gap: Spacing[4],
  },
  customIntro: {
    lineHeight: 22,
  },
  inputGroup: {
    gap: Spacing[2],
  },
  customInput: {
    height: 52,
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.button,
    paddingHorizontal: Spacing[4],
    color: Colors.text.primary,
    fontFamily: FontFamily.body,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  submitCustomBtn: {
    marginTop: Spacing[3],
  },
  duplicateBox: {
    gap: Spacing[4],
  },
  duplicateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  duplicateTitle: {
    fontSize: 18,
  },
  duplicateDesc: {
    lineHeight: 22,
  },
  matchCard: {
    backgroundColor: Colors.surface['2'],
    padding: Spacing.card,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
    gap: Spacing[1],
  },
  duplicateActions: {
    gap: Spacing[3],
    marginTop: Spacing[3],
  },
  secondaryBtn: {
    marginTop: Spacing[1],
  },
});
