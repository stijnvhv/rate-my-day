import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'rate-my-day:settings';

export interface Settings {
  reminderEnabled: boolean;
  reminderHour: number; // 0-23
  reminderMinute: number; // 0-59
}

export const DEFAULT_SETTINGS: Settings = {
  reminderEnabled: true,
  reminderHour: 20,
  reminderMinute: 30,
};

export async function getSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
