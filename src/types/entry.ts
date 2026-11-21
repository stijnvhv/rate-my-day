export type Mood = 'happy' | 'neutral' | 'sad';

export interface DayEntry {
  date: string; // YYYY-MM-DD, unique key
  score: number; // 1-10
  mood: Mood;
  energy: number; // 1-5
  sleepHours: number; // hours of sleep
  exerciseScore: number; // 1-5
  productivity: number; // 1-5
  note: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export const MOOD_EMOJI: Record<Mood, string> = {
  happy: '😊',
  neutral: '😐',
  sad: '😞',
};

export const MOOD_LABEL: Record<Mood, string> = {
  happy: 'Goed',
  neutral: 'Neutraal',
  sad: 'Slecht',
};
