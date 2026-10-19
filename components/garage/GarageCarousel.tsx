/**
 * GarageCarousel — Horizontal vehicle gallery
 *
 * Requirements:
 *  - Photo, Make, Model, Year, Odometer
 *  - Full-width hero photo with bottom gradient overlay
 *  - Fallback showing make & model on surface.2 (never an empty box)
 *  - "Make primary", "Edit", "Attach drives", and "Logbook" (wrench icon)
 *  - Tabular figures for numbers, Space Grotesk headings, theme tokens
 */

import React, { useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Icon } from '@/components/ui/Icon';
import { IconChip } from '@/components/ui/IconChip';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { usePreferences } from '@/contexts/PreferencesContext';
import type { Vehicle } from '@/types/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - Spacing.screen * 2;

interface GarageCarouselProps {
  vehicles: Vehicle[];
  isLoading?: boolean;
  onAddCar: () => void;
  onAttachDrives: (vehicle: Vehicle) => void;
  onSetPrimary: (vehicleId: string) => void;
  onPhotoPress: (vehicleId: string) => void;
  onEditCar?: (vehicle: Vehicle) => void;
  onMaintenancePress: (vehicleId: string) => void;
  onDeleteCar?: (vehicleId: string) => void;
}

export function GarageCarousel({
  vehicles,
  isLoading = false,
  onAddCar,
  onAttachDrives,
  onSetPrimary,
  onPhotoPress,
  onEditCar,
  onMaintenancePress,
  onDeleteCar,
}: GarageCarouselProps) {
  const { formatOdometer } = usePreferences();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + Spacing.gap));
    setActiveIndex(index);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Card style={styles.loadingCard}>
          <SkeletonCard />
        </Card>
      </View>
    );
  }

  if (vehicles.length === 0) {
    return (
      <Card style={styles.emptyCard}>
        <View style={styles.emptyContent}>
          <IconChip name="car" color="cyan" chipSize={48} size={24} />
          <View style={styles.emptyTextGroup}>
            <Text variant="heading" color={Colors.text.primary} style={styles.emptyTitle}>
              No vehicles in garage
            </Text>
            <Text variant="body" color={Colors.text.secondary} style={styles.emptySubtitle}>
              Add your car to track performance benchmarks and attach drives to your build.
            </Text>
          </View>
          <Button
            variant="secondary"
            onPress={onAddCar}
            iconLeft={<Icon name="plus" size={18} color={Colors.accent.cyan} />}
          >
            Add your first car
          </Button>
        </View>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + Spacing.gap}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        {vehicles.map((v) => {
          const odometerDisplay = formatOdometer(v.odometer ?? 0);
          return (
            <Card key={v.id} style={[styles.vehicleCard, { width: CARD_WIDTH }]}>
              {/* Photo Area Hero */}
              <Pressable
                style={styles.photoContainer}
                onPress={() => (onEditCar ? onEditCar(v) : onPhotoPress(v.id))}
              >
                {v.photo_url ? (
                  <Image source={{ uri: v.photo_url }} style={styles.vehicleImage} resizeMode="cover" />
                ) : (
                  <View style={styles.photoFallback}>
                    <Icon name="car" size={44} color={Colors.accent.cyan} weight="duotone" />
                    <Text variant="heading" color={Colors.text.primary} style={styles.fallbackCarName}>
                      {v.year ? `${v.year} ` : ''}{v.make} {v.model}
                    </Text>
                    <Text variant="label" color={Colors.text.tertiary}>
                      Tap to add photo
                    </Text>
                  </View>
                )}

                {/* Bottom gradient overlay */}
                <LinearGradient
                  colors={['transparent', 'rgba(14, 19, 27, 0.4)', Colors.surface['1']] as [string, string, string]}
                  style={styles.photoGradientOverlay}
                />

                {/* Primary Badge or Make Primary Button */}
                {v.is_primary ? (
                  <View style={styles.primaryBadge}>
                    <Icon name="seal-check" size={14} color={Colors.text.inverse} weight="fill" />
                    <Text variant="overline" color={Colors.text.inverse} style={styles.primaryBadgeText}>
                      PRIMARY
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    style={styles.setPrimaryChip}
                    onPress={() => onSetPrimary(v.id)}
                    hitSlop={8}
                  >
                    <Icon name="seal-check" size={13} color={Colors.accent.cyan} />
                    <Text variant="label" color={Colors.text.primary} style={styles.setPrimaryText}>
                      Make primary
                    </Text>
                  </Pressable>
                )}
              </Pressable>

              {/* Vehicle Specs Header */}
              <View style={styles.detailsHeader}>
                <View style={styles.titleBlock}>
                  <Text variant="heading" color={Colors.text.primary} numberOfLines={1}>
                    {v.year} {v.make} {v.model}
                  </Text>
                  {v.nickname && (
                    <Text variant="label" color={Colors.text.tertiary}>
                      &quot;{v.nickname}&quot;
                    </Text>
                  )}
                </View>

                {/* Odometer Tile */}
                <View style={styles.odometerBox}>
                  <Text variant="label" color={Colors.text.tertiary} style={styles.odometerLabel}>
                    ODOMETER
                  </Text>
                  <Text variant="body" color={Colors.text.primary} tabular style={styles.odometerValue}>
                    {odometerDisplay}
                  </Text>
                </View>
              </View>

              {/* Action Buttons Row */}
              <View style={styles.actionRow}>
                {onEditCar && (
                  <Pressable
                    style={({ pressed }) => [styles.actionPill, pressed && styles.pillPressed]}
                    onPress={() => onEditCar(v)}
                  >
                    <Icon name="pencil" size={15} color={Colors.text.secondary} />
                    <Text variant="label" color={Colors.text.primary} style={styles.actionPillText}>
                      Edit
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  style={({ pressed }) => [styles.actionPill, pressed && styles.pillPressed]}
                  onPress={() => onAttachDrives(v)}
                >
                  <Icon name="path" size={15} color={Colors.accent.cyan} />
                  <Text variant="label" color={Colors.text.primary} style={styles.actionPillText}>
                    Attach drives
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.actionPill, pressed && styles.pillPressed]}
                  onPress={() => onMaintenancePress(v.id)}
                >
                  <Icon name="wrench" size={15} color={Colors.text.secondary} />
                  <Text variant="label" color={Colors.text.secondary} style={styles.actionPillText}>
                    Logbook
                  </Text>
                </Pressable>

                {onDeleteCar && vehicles.length > 1 && (
                  <Pressable
                    style={({ pressed }) => [styles.deletePill, pressed && styles.pillPressed]}
                    onPress={() => onDeleteCar(v.id)}
                    hitSlop={8}
                  >
                    <Icon name="trash" size={15} color={Colors.semantic.danger} />
                  </Pressable>
                )}
              </View>
            </Card>
          );
        })}
      </ScrollView>

      {/* Pagination dots if multiple vehicles */}
      {vehicles.length > 1 && (
        <View style={styles.dotsContainer}>
          {vehicles.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex ? styles.activeDot : styles.inactiveDot]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing[2],
  },
  scrollContent: {
    gap: Spacing.gap,
  },
  loadingCard: {
    padding: Spacing.section,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    padding: Spacing.card,
  },
  emptyContent: {
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[2],
  },
  emptyTextGroup: {
    alignItems: 'center',
    gap: Spacing[1],
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  vehicleCard: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: Colors.surface['1'],
  },
  photoContainer: {
    width: '100%',
    height: 220,
    backgroundColor: Colors.surface['2'],
    position: 'relative',
    overflow: 'hidden',
  },
  vehicleImage: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[1],
    paddingHorizontal: Spacing.screen,
  },
  fallbackCarName: {
    textAlign: 'center',
    marginTop: Spacing[1],
  },
  photoGradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
  },
  primaryBadge: {
    position: 'absolute',
    top: Spacing[3],
    left: Spacing[3],
    backgroundColor: Colors.accent.cyan,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
  },
  primaryBadgeText: {
    fontFamily: FontFamily.heading,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  setPrimaryChip: {
    position: 'absolute',
    top: Spacing[3],
    left: Spacing[3],
    backgroundColor: 'rgba(5, 7, 13, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  setPrimaryText: {
    fontSize: 12,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[2],
  },
  titleBlock: {
    flex: 1,
    gap: 2,
    paddingRight: Spacing[2],
  },
  odometerBox: {
    alignItems: 'flex-end',
    gap: 2,
  },
  odometerLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  odometerValue: {
    fontFamily: FontFamily.numberBold,
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[4],
    gap: Spacing[2],
  },
  actionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[1],
    backgroundColor: Colors.surface['2'],
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[2],
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  deletePill: {
    padding: Spacing[2],
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.2)',
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pillPressed: {
    opacity: 0.7,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing[1],
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 20,
    backgroundColor: Colors.accent.cyan,
  },
  inactiveDot: {
    width: 6,
    backgroundColor: Colors.surface['3'],
  },
});
