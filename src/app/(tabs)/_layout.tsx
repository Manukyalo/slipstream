import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
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
        }}
      />
      <Tabs.Screen
        name="recap"
        options={{
          title: 'Recap',
        }}
      />
      <Tabs.Screen
        name="rankings"
        options={{
          title: 'Rankings',
        }}
      />
      <Tabs.Screen
        name="drag-race"
        options={{
          title: 'Drag Race',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
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
});
