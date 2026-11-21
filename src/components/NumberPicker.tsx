import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C, scaleColor } from '../theme';

interface NumberPickerProps {
  min: number;
  max: number;
  value: number | null;
  onChange: (value: number) => void;
  /** Vaste kleur; zonder kleur loopt de schaal van rood naar groen. */
  activeColor?: string;
  lowLabel?: string;
  highLabel?: string;
}

export default function NumberPicker({ min, max, value, onChange, activeColor, lowLabel, highLabel }: NumberPickerProps) {
  const numbers: number[] = [];
  for (let i = min; i <= max; i++) numbers.push(i);
  const big = max - min < 6;

  return (
    <View>
      <View style={styles.row}>
        {numbers.map((n) => {
          const selected = value === n;
          const color = activeColor ?? scaleColor(n - min + 1, max - min + 1);
          const filled = activeColor ? value !== null && n <= value : selected;
          return (
            <TouchableOpacity
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`${n}`}
              activeOpacity={0.8}
              style={[
                styles.cell,
                big ? styles.cellBig : styles.cellSmall,
                filled && { backgroundColor: color, borderColor: color },
                selected && styles.cellSelected,
              ]}
              onPress={() => onChange(n)}
            >
              <Text style={[styles.cellText, big && styles.cellTextBig, filled && styles.cellTextOn]}>{n}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {(lowLabel || highLabel) && (
        <View style={styles.labels}>
          <Text style={styles.label}>{lowLabel}</Text>
          <Text style={styles.label}>{highLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF9FE',
  },
  cellSmall: { height: 44 },
  cellBig: { height: 50, borderRadius: 14 },
  cellSelected: { transform: [{ scale: 1.08 }] },
  cellText: { fontSize: 16, fontWeight: '700', color: C.text },
  cellTextBig: { fontSize: 18 },
  cellTextOn: { color: '#FFFFFF' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  label: { fontSize: 12, color: C.muted },
});
