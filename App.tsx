import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { getSettings } from './src/storage/settingsStorage';
import { startAutoSync } from './src/storage/sync';
import { refreshPush } from './src/notifications/webpush';
import { requestNotificationPermission, scheduleDailyReminder } from './src/notifications/notifications';

export default function App() {
  useEffect(() => {
    startAutoSync();
    if (Platform.OS === 'web') refreshPush();
    (async () => {
      const settings = await getSettings();
      if (Platform.OS !== 'web' && settings.reminderEnabled) {
        const granted = await requestNotificationPermission();
        if (granted) {
          await scheduleDailyReminder(settings.reminderHour, settings.reminderMinute);
        }
      }
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
