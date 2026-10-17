/**
 * Tab layout — 5 tabs: Track, Roads, Compete, Recap, Profile
 *
 * The original 7 route files (drag-race, track-day, rankings, settings) are
 * preserved but hidden from the tab bar. Compete tab hosts all three via
 * a Segmented control in compete.tsx. Settings is accessible from Profile.
 *
 * Active tab:   filled Phosphor icon + accent.cyan label + 4px indicator pill
 * Inactive tab: regular Phosphor icon + text.tertiary label
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontFamily } from '@/constants/theme';
import { Icon, type IconName } from '@/components/ui/Icon';

// ─────────────────────────────────────────────────────────────────────────────
// Tab icon component
// ─────────────────────────────────────────────────────────────────────────────

function TabIcon({
  name,
  focused,
}: {
  name: IconName;
  focused: boolean;
}) {
  return (
    <View style={styles.iconWrapper}>
      <Icon
        name={name}
        size={22}
        color={focused ? Colors.accent.cyan : Colors.text.tertiary}
        weight={focused ? 'fill' : 'regular'}
      />
      {focused && <View style={styles.indicator} />}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown:          false,
        tabBarStyle:          [styles.tabBar, { paddingBottom: insets.bottom, height: 64 + insets.bottom }],
        tabBarActiveTintColor:   Colors.accent.cyan,
        tabBarInactiveTintColor: Colors.text.tertiary,
        tabBarLabelStyle:     styles.tabLabel,
        tabBarItemStyle:      styles.tabItem,
        sceneStyle:           { backgroundColor: Colors.bg.base },
      }}
    >
      {/* ── Visible tabs ── */}
      <Tabs.Screen
        name="track"
        options={{
          title: 'Track',
          tabBarIcon: ({ focused }) => <TabIcon name="gauge" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="roads"
        options={{
          title: 'Roads',
          tabBarIcon: ({ focused }) => <TabIcon name="map-pin" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="compete"
        options={{
          title: 'Compete',
          tabBarIcon: ({ focused }) => <TabIcon name="flag" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="recap"
        options={{
          title: 'Recap',
          tabBarIcon: ({ focused }) => <TabIcon name="chart-bar" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="user-circle" focused={focused} />,
        }}
      />

      {/* ── Hidden routes — preserved so deep links + navigation still work ── */}
      <Tabs.Screen name="drag-race"  options={{ href: null }} />
      <Tabs.Screen name="track-day"  options={{ href: null }} />
      <Tabs.Screen name="rankings"   options={{ href: null }} />
      <Tabs.Screen name="settings"   options={{ href: null }} />
    </Tabs>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface['1'],
    borderTopWidth:  1,
    borderTopColor:  Colors.hairline,
    paddingTop:      8,
  },
  tabItem: {
    paddingTop: 4,
  },
  tabLabel: {
    fontFamily:   FontFamily.label,
    fontSize:     10,
    letterSpacing: 0.2,
    marginTop:    2,
  },
  iconWrapper: {
    alignItems: 'center',
    gap:        3,
  },
  indicator: {
    width:           16,
    height:          3,
    borderRadius:    999,
    backgroundColor: Colors.accent.cyan,
  },
});
