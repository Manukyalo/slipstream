/**
 * Dev Tokens — Visual QA Screen
 *
 * Long-press the version row in Settings/Profile to open this.
 * Shows every design token and component for visual verification.
 *
 * Gated: only accessible in __DEV__ or non-production builds.
 * Production: long-press silently does nothing.
 */

import React, { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import {
  Colors,
  Spacing,
  Radius,
} from '@/constants/theme';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { IconChip } from '@/components/ui/IconChip';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Segmented } from '@/components/ui/Segmented';
import { FilterChip } from '@/components/ui/FilterChip';
import { ListRow } from '@/components/ui/ListRow';
import { SkeletonCard, SkeletonMetric } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

// ─────────────────────────────────────────────────────────────────────────────
// Guard — production builds cannot reach this screen
// ─────────────────────────────────────────────────────────────────────────────
const releaseChannel = Constants.expoConfig?.extra?.releaseChannel as string | undefined;
const isProduction = !__DEV__ && releaseChannel === 'production';

// Section header helper
function Section({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="overline" color={Colors.text.secondary}>{title}</Text>
    </View>
  );
}

// Colour swatch
function Swatch({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.swatchRow}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text variant="label" color={Colors.text.secondary}>{label}</Text>
      <Text variant="label" color={Colors.text.tertiary}>{color}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function DevTokensScreen() {
  const insets = useSafeAreaInsets();
  const [segmented, setSegmented] = useState(0);
  const [chip, setChip] = useState('All');

  if (isProduction) {
    // Should never render — tab layout won't navigate here in prod
    return null;
  }

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      {/* Back */}
      <View style={styles.topBar}>
        <Button variant="ghost" onPress={() => router.back()} compact>
          ← Back
        </Button>
        <Text variant="heading">Design Tokens QA</Text>
      </View>

      {/* ── Colors ── */}
      <Section title="Colors — Background" />
      <Swatch label="bg.base"   color={Colors.bg.base} />
      <Swatch label="surface.1" color={Colors.surface['1']} />
      <Swatch label="surface.2" color={Colors.surface['2']} />
      <Swatch label="hairline"  color="rgba(255,255,255,0.06)" />

      <Section title="Colors — Text" />
      <Swatch label="text.primary"   color={Colors.text.primary} />
      <Swatch label="text.secondary" color={Colors.text.secondary} />
      <Swatch label="text.tertiary"  color={Colors.text.tertiary} />

      <Section title="Colors — Accent" />
      <Swatch label="accent.cyan" color={Colors.accent.cyan} />
      <Swatch label="accent.blue" color={Colors.accent.blue} />

      <Section title="Colors — Semantic" />
      <Swatch label="success" color={Colors.semantic.success} />
      <Swatch label="warning" color={Colors.semantic.warning} />
      <Swatch label="danger"  color={Colors.semantic.danger} />
      <Swatch label="violet"  color={Colors.semantic.violet} />

      {/* ── Typography ── */}
      <Section title="Typography" />
      <Text variant="display"   color={Colors.text.primary}>Display 44/48</Text>
      <Text variant="title"     color={Colors.text.primary}>Title 28/34</Text>
      <Text variant="heading"   color={Colors.text.primary}>Heading 20/26</Text>
      <Text variant="metricXL"  color={Colors.accent.cyan} tabular>237.4</Text>
      <Text variant="metricL"   color={Colors.text.primary} tabular>1:23.456</Text>
      <Text variant="body"      color={Colors.text.primary}>Body 16/24 — Inter Regular</Text>
      <Text variant="label"     color={Colors.text.secondary}>Label 13/18 — Inter Medium</Text>
      <Text variant="overline"  color={Colors.text.tertiary}>Overline 12/16 — Uppercase</Text>

      {/* ── Icons ── */}
      <Section title="Icons — All weights" />
      <View style={styles.iconRow}>
        {(['gauge','flag','lightning','trophy','chart-bar','user-circle','map-pin','gear'] as const).map((name) => (
          <View key={name} style={styles.iconItem}>
            <Icon name={name} size={24} color={Colors.text.secondary} weight="regular" />
            <Icon name={name} size={24} color={Colors.accent.cyan}    weight="fill" />
            <Icon name={name} size={24} color={Colors.text.primary}   weight="duotone" />
          </View>
        ))}
      </View>

      {/* ── IconChips ── */}
      <Section title="IconChips" />
      <View style={styles.chipRow}>
        {(['cyan','blue','success','warning','danger','violet','default'] as const).map((color) => (
          <IconChip key={color} name="gauge" color={color} />
        ))}
      </View>

      {/* ── Buttons ── */}
      <Section title="Buttons" />
      <Button variant="primary"   onPress={() => {}}>Primary Gradient</Button>
      <Button variant="secondary" onPress={() => {}}>Secondary</Button>
      <Button variant="ghost"     onPress={() => {}}>Ghost</Button>
      <Button variant="danger"    onPress={() => {}}>Danger</Button>
      <Button variant="primary"   loading onPress={() => {}}>Loading</Button>
      <Button variant="primary"   disabled onPress={() => {}}>Disabled</Button>

      {/* ── Cards ── */}
      <Section title="Cards" />
      <Card>
        <Text variant="heading">L1 Card</Text>
        <Text variant="body" color={Colors.text.secondary}>Hairline border, surface.1 bg</Text>
      </Card>
      <Card elevated>
        <Text variant="heading">L2 Elevated</Text>
        <Text variant="body" color={Colors.text.secondary}>Soft shadow, surface.2 bg</Text>
      </Card>
      <Card glow>
        <Text variant="metricXL" color={Colors.accent.cyan} tabular>237</Text>
        <Text variant="label" color={Colors.text.tertiary}>km/h  — with glow</Text>
      </Card>

      {/* ── StatCards ── */}
      <Section title="StatCards" />
      <View style={styles.statGrid}>
        <StatCard icon="gauge"     iconColor="cyan"    label="Top Speed"  value="237"      unit="km/h" live style={styles.statCard} />
        <StatCard icon="timer"     iconColor="warning" label="Best Lap"   value="1:23.4"   unit="s"       style={styles.statCard} />
        <StatCard icon="lightning" iconColor="danger"  label="Peak G"     value="1.22"     unit="G"       style={styles.statCard} />
        <StatCard icon="path"      iconColor="blue"    label="Distance"   value="142.3"    unit="km"      style={styles.statCard} />
      </View>

      {/* ── Controls ── */}
      <Section title="Segmented Control" />
      <Segmented options={['Drag','Circuit','Rankings']} selected={segmented} onChange={setSegmented} />

      <Section title="FilterChips" />
      <View style={styles.chipRow}>
        {['All','Today','This Week','This Month'].map((label) => (
          <FilterChip
            key={label}
            label={label}
            active={chip === label}
            onPress={() => setChip(label)}
          />
        ))}
      </View>

      {/* ── List Rows ── */}
      <Section title="ListRow" />
      <Card>
        <ListRow icon="gear"    iconColor="default" label="Notifications"    sublabel="Push alerts" chevron onPress={() => {}} />
        <ListRow icon="lock"    iconColor="default" label="Biometric Lock"   rightValue="On"                onPress={() => {}} />
        <ListRow icon="bell"    iconColor="warning" label="Radar Alerts"     sublabel="Speed cameras"       onPress={() => {}} />
        <ListRow icon="trash"   iconColor="danger"  label="Delete Account"                         destructive isLast onPress={() => {}} />
      </Card>

      {/* ── Skeleton ── */}
      <Section title="Skeletons" />
      <SkeletonCard />
      <SkeletonCard />
      <View style={styles.skeletonMetricRow}>
        <SkeletonMetric />
        <SkeletonMetric />
        <SkeletonMetric />
      </View>

      {/* ── Empty / Error states ── */}
      <Section title="EmptyState" />
      <Card>
        <EmptyState
          icon="path"
          iconColor="cyan"
          title="No trips yet"
          description="Complete your first drive to see your history here."
          action={{ label: 'Start a trip', onPress: () => {} }}
        />
      </Card>

      <Section title="ErrorState" />
      <Card>
        <ErrorState
          message="Check your connection and try again."
          onRetry={() => {}}
        />
      </Card>

      {/* Spacing at bottom */}
      <View style={{ height: insets.bottom + Spacing.section }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.bg.base,
  },
  content: {
    paddingHorizontal: Spacing.screen,
    gap:               Spacing[4],
  },
  topBar: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            Spacing[4],
    paddingVertical: Spacing[4],
  },
  sectionHeader: {
    marginTop:    Spacing[4],
    marginBottom: Spacing[1],
  },
  swatchRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            Spacing[3],
  },
  swatch: {
    width:        32,
    height:       32,
    borderRadius: Radius.sm,
    borderWidth:  1,
    borderColor:  Colors.hairline,
  },
  iconRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing[4],
  },
  iconItem: {
    flexDirection: 'row',
    gap:           Spacing[2],
    alignItems:    'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing[2],
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing.gap,
  },
  statCard: {
    flex:     1,
    minWidth: 140,
  },
  skeletonMetricRow: {
    flexDirection: 'row',
    gap:           Spacing[4],
    justifyContent: 'space-around',
  },
});
