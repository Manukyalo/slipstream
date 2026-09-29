import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Colors, FontFamily, FontSize } from '@/constants/design';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.accentCyan,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="track"
        options={{
          title: 'Track',
          tabBarIcon: () => <Text style={styles.tabIcon}>🚗</Text>,
        }}
      />
      <Tabs.Screen
        name="roads"
        options={{
          title: 'Roads',
          tabBarIcon: () => <Text style={styles.tabIcon}>🛣️</Text>,
        }}
      />
      <Tabs.Screen
        name="track-day"
        options={{
          title: 'Circuit',
          tabBarIcon: () => <Text style={styles.tabIcon}>🏁</Text>,
        }}
      />
      <Tabs.Screen
        name="drag-race"
        options={{
          title: 'Drag',
          tabBarIcon: () => <Text style={styles.tabIcon}>⚡</Text>,
        }}
      />
      <Tabs.Screen
        name="rankings"
        options={{
          title: 'Rankings',
          tabBarIcon: () => <Text style={styles.tabIcon}>🏆</Text>,
        }}
      />
      <Tabs.Screen
        name="recap"
        options={{
          title: 'Recap',
          tabBarIcon: () => <Text style={styles.tabIcon}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: () => <Text style={styles.tabIcon}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.bgSurface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.label,
  },
  tabIcon: {
    fontSize: 16,
  },
});
