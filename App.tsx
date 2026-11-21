import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { getSettings } from './src/storage/settingsStorage';
import { requestNotificationPermission, scheduleDailyReminder } from './src/notifications/notifications';

export default function App() {
  useEffect(() => {
    (async () => {
      const settings = await getSettings();
      if (settings.reminderEnabled) {
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
