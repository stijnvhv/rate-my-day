import AsyncStorage from '@react-native-async-storage/async-storage';
import { DayEntry } from '../types/entry';
import { toDateKey } from '../utils/date';

const ENTRIES_KEY = 'rate-my-day:entries';

type EntriesMap = Record<string, DayEntry>;

async function readAll(): Promise<EntriesMap> {
  const raw = await AsyncStorage.getItem(ENTRIES_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function writeAll(entries: EntriesMap): Promise<void> {
  await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

export async function getAllEntries(): Promise<DayEntry[]> {
  const entries = await readAll();
  return Object.values(entries).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getEntry(date: string): Promise<DayEntry | undefined> {
  const entries = await readAll();
  return entries[date];
}

export async function saveEntry(entry: Omit<DayEntry, 'createdAt' | 'updatedAt'>): Promise<DayEntry> {
  const entries = await readAll();
  const existing = entries[entry.date];
  const now = new Date().toISOString();
  const fullEntry: DayEntry = {
    ...entry,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  entries[entry.date] = fullEntry;
  await writeAll(entries);
  return fullEntry;
}

export async function deleteEntry(date: string): Promise<void> {
  const entries = await readAll();
  delete entries[date];
  await writeAll(entries);
}

export function calculateStreak(entries: DayEntry[], fromDateKey: string): number {
  const dates = new Set(entries.map((e) => e.date));
  let streak = 0;
  const [year, month, day] = fromDateKey.split('-').map(Number);
  const cursor = new Date(year, month - 1, day);
  while (true) {
    const key = toDateKey(cursor);
    if (dates.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
