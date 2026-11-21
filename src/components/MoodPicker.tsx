import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Mood, MOOD_EMOJI, MOOD_LABEL } from '../types/entry';
import { C } from '../theme';

interface MoodPickerProps {
  value: Mood | null;
  onChange: (mood: Mood) => void;
}

const MOODS: Mood[] = ['sad', 'neutral', 'happy'];
const TINT: Record<Mood, { bg: string; line: string; text: string }> = {
  sad: { bg: '#FDECEC', line: '#F7B4B4', text: '#C53030' },
  neutral: { bg: '#FEF5E4', line: '#F7D58F', text: '#B7791F' },
  happy: { bg: '#E6F8F1', line: '#94DDC4', text: '#0F8A67' },
};

export default function MoodPicker({ value, onChange }: MoodPickerProps) {
  return (
    <View style={styles.row}>
      {MOODS.map((mood) => {
        const selected = value === mood;
        const t = TINT[mood];
        return (
          <TouchableOpacity
            key={mood}
            activeOpacity={0.85}
            style={[styles.cell, selected && { backgroundColor: t.bg, borderColor: t.line }]}
            onPress={() => onChange(mood)}
          >
            <Text style={[styles.emoji, !selected && value !== null && styles.dim]}>{MOOD_EMOJI[mood]}</Text>
            <Text style={[styles.label, selected && { color: t.text, fontWeight: '700' }]}>{MOOD_LABEL[mood]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: '#FAF9FE',
  },
  emoji: { fontSize: 34 },
  dim: { opacity: 0.45 },
  label: { marginTop: 6, fontSize: 13, color: C.muted, fontWeight: '600' },
});
