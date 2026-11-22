export type Mood = 'happy' | 'neutral' | 'sad';
export type Alcohol = 'none' | 'some' | 'much';

export interface DayEntry {
  date: string; // YYYY-MM-DD, unique key
  score: number; // 1-10
  mood: Mood;
  energy: number; // 1-5
  sleepHours: number; // hours of sleep
  exerciseScore: number; // 1-5
  productivity: number; // 1-5
  note: string;
  /** Sinds nov 2026; oudere dagen hebben deze velden niet. */
  alcohol?: Alcohol;
  walked?: boolean;
  social?: boolean;
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

export const ALCOHOL_LABEL: Record<Alcohol, string> = {
  none: 'Niet gedronken',
  some: '1-2 drankjes',
  much: 'Meer',
};
