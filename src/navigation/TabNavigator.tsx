import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import TodayScreen from '../screens/TodayScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { TabParamList } from './types';
import { C } from '../theme';

const Tab = createBottomTabNavigator<TabParamList>();

function Icon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={[styles.icon, focused && styles.iconOn]}>
      <Text style={[styles.emoji, !focused && styles.dim]}>{emoji}</Text>
    </View>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: C.line, height: 68, paddingTop: 6, paddingBottom: 8 },
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{ title: 'Vandaag', tabBarIcon: ({ focused }) => <Icon emoji="⭐" focused={focused} /> }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: 'Overzicht', tabBarIcon: ({ focused }) => <Icon emoji="📊" focused={focused} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Instellingen', tabBarIcon: ({ focused }) => <Icon emoji="⚙️" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  icon: { width: 44, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: C.primarySoft },
  emoji: { fontSize: 18 },
  dim: { opacity: 0.55 },
});
