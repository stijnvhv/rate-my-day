import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C, shadow } from '../theme';

interface FormSectionProps {
  emoji: string;
  title: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
}

export default function FormSection({ emoji, title, hint, right, children }: FormSectionProps) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.line,
    ...shadow,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: { fontSize: 18 },
  title: { fontSize: 16, fontWeight: '700', color: C.ink },
  hint: { fontSize: 13, color: C.muted, marginTop: 1 },
});
