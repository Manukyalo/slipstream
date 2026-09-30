import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Gauge, Route, Flag, Zap, Trophy, BarChart3, Settings } from 'lucide-react-native';
import { Theme } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Theme.colors.signalCyan,
        tabBarInactiveTintColor: Theme.colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="track"
        options={{
          title: 'Track',
          tabBarIcon: ({ color }) => <Gauge size={18} strokeWidth={1.5} color={color} />,
        }}
      />
      <Tabs.Screen
        name="roads"
        options={{
          title: 'Roads',
          tabBarIcon: ({ color }) => <Route size={18} strokeWidth={1.5} color={color} />,
        }}
      />
      <Tabs.Screen
        name="track-day"
        options={{
          title: 'Circuit',
          tabBarIcon: ({ color }) => <Flag size={18} strokeWidth={1.5} color={color} />,
        }}
      />
      <Tabs.Screen
        name="drag-race"
        options={{
          title: 'Drag',
          tabBarIcon: ({ color }) => <Zap size={18} strokeWidth={1.5} color={color} />,
        }}
      />
      <Tabs.Screen
        name="rankings"
        options={{
          title: 'Rankings',
          tabBarIcon: ({ color }) => <Trophy size={18} strokeWidth={1.5} color={color} />,
        }}
      />
      <Tabs.Screen
        name="recap"
        options={{
          title: 'Recap',
          tabBarIcon: ({ color }) => <BarChart3 size={18} strokeWidth={1.5} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Settings size={18} strokeWidth={1.5} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Theme.colors.surface,
    borderTopColor: Theme.colors.hairline,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabLabel: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
