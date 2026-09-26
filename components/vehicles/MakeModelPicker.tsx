import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { Skeleton } from '@/components/ui/Skeleton';
import { fetchMakes, fetchModels } from '@/services/vehicles';
import type { VehicleMake, VehicleModel } from '@/types/database';

interface MakeModelPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (make: string, model: string) => void;
}

export function MakeModelPicker({ visible, onClose, onSelect }: MakeModelPickerProps) {
  const [step, setStep] = useState<'make' | 'model'>('make');
  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [selectedMake, setSelectedMake] = useState<VehicleMake | null>(null);

  const [loadingMakes, setLoadingMakes] = useState<boolean>(true);
  const [loadingModels, setLoadingModels] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Load makes on initial mount
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
    setStep('make');
    setSelectedMake(null);
    setSearchQuery('');
    onClose();
  };

  // Load models when a make is chosen
  const handleSelectMake = (make: VehicleMake) => {
    setSelectedMake(make);
    setSearchQuery('');
    setStep('model');
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {step === 'model' && (
                <Pressable
                  style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
                  onPress={() => {
                    setStep('make');
                    setSearchQuery('');
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.backBtnText}>← Makes</Text>
                </Pressable>
              )}
              <Text style={styles.headerTitle}>
                {step === 'make' ? 'Select Make' : `${selectedMake?.name} Models`}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              onPress={handleClose}
              hitSlop={8}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Search Box */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={step === 'make' ? 'Search makes (e.g. Porsche)...' : 'Search models (e.g. 911)...'}
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          {/* Body Content */}
          {step === 'make' ? (
            loadingMakes ? (
              <View style={styles.skeletonContainer}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <View key={i} style={styles.skeletonRow}>
                    <Skeleton width="100%" height={48} borderRadius={Radius.md} />
                  </View>
                ))}
              </View>
            ) : (
              <FlatList
                data={filteredMakes}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [
                      styles.listItem,
                      pressed && styles.listItemPressed,
                    ]}
                    onPress={() => handleSelectMake(item)}
                  >
                    <Text style={styles.listItemText}>{item.name}</Text>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No matching makes found.</Text>
                  </View>
                }
              />
            )
          ) : loadingModels ? (
            <View style={styles.skeletonContainer}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <View key={i} style={styles.skeletonRow}>
                  <Skeleton width="100%" height={48} borderRadius={Radius.md} />
                </View>
              ))}
            </View>
          ) : (
            <FlatList
              data={filteredModels}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.listItem,
                    pressed && styles.listItemPressed,
                  ]}
                  onPress={() => handleSelectModel(item)}
                >
                  <Text style={styles.listItemText}>{item.name}</Text>
                  <Text style={styles.chevron}>✓</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No matching models found.</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '80%',
    backgroundColor: Colors.bgSurface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingTop: Spacing.base,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h2,
    color: Colors.textPrimary,
  },
  backBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.accentCyan,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: FontFamily.bold,
  },
  pressed: {
    opacity: 0.7,
  },
  searchContainer: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  searchInput: {
    height: 44,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing['3xl'],
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  listItemPressed: {
    borderColor: Colors.accentCyan,
    backgroundColor: Colors.bgSurface,
  },
  listItemText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  chevron: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: Colors.accentCyan,
  },
  skeletonContainer: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  skeletonRow: {
    marginBottom: Spacing.xs,
  },
  emptyState: {
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textMuted,
  },
});
