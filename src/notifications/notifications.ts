import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_IDENTIFIER = 'rate-my-day-daily-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

const ANDROID_CHANNEL_ID = 'daily-reminder';

export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await cancelDailyReminder();

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Dagelijkse herinnering',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_IDENTIFIER,
    content: {
      title: 'Hoe was je dag?',
      body: 'Geef je dag een cijfer en zet er een notitie bij.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_IDENTIFIER).catch(() => {});
}

export async function sendTestNotification(): Promise<void> {
  if (Platform.OS === 'web') {
    const granted = await requestNotificationPermission();
    if (!granted) return;
    // expo-notifications has no scheduler backend on web; use the browser API directly.
    new window.Notification('Testmelding', { body: 'Zo ziet je dagelijkse herinnering eruit!' });
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Testmelding',
      body: 'Zo ziet je dagelijkse herinnering eruit!',
    },
    trigger: null,
  });
}
