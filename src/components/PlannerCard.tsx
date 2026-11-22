import React, { useCallback, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchDoc, getCode, onSynced, patchDoc } from '../storage/sync';
import { todayKey } from '../utils/date';
import { C, shadow } from '../theme';

const KEY = 'rate-my-day:planner';

/** Vanaf 15:00: is de dagplanner voor morgen in Structured gemaakt? De Mac mini stopt met melden zodra dit is afgevinkt. */
export default function PlannerCard() {
  const [klaar, setKlaar] = useState<boolean | null>(null);
  const [bezig, setBezig] = useState(false);
  const toon = new Date().getHours() >= 15;

  const load = useCallback(async () => {
    try {
      const local = JSON.parse((await AsyncStorage.getItem(KEY)) || '{}');
      setKlaar(!!local[todayKey()]);
      const doc = await fetchDoc(await getCode());
      const remote = doc?.planner || {};
      const merged = { ...remote, ...local };
      await AsyncStorage.setItem(KEY, JSON.stringify(merged));
      setKlaar(!!merged[todayKey()]);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!toon) return;
      load();
      return onSynced(load);
    }, [load, toon])
  );

  if (!toon || klaar === null) return null;

  if (klaar) {
    return (
      <View style={[styles.card, styles.done]}>
        <Text style={styles.doneText}>✓ Dagplanner voor morgen staat</Text>
      </View>
    );
  }

  const markeer = async () => {
    setBezig(true);
    try {
      const local = JSON.parse((await AsyncStorage.getItem(KEY)) || '{}');
      local[todayKey()] = new Date().toISOString();
      await AsyncStorage.setItem(KEY, JSON.stringify(local));
      setKlaar(true);
      const code = await getCode();
      const doc = (await fetchDoc(code)) || {};
      await patchDoc(code, { planner: { ...(doc.planner || {}), ...local } });
    } finally {
      setBezig(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🗓️ Dagplanner voor morgen</Text>
      <Text style={styles.sub}>Zet je dag van morgen in Structured. De meldingen stoppen zodra je hier afvinkt.</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btnLight} onPress={() => Linking.openURL('structured://').catch(() => {})}>
          <Text style={styles.btnLightText}>Open Structured</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={markeer} disabled={bezig}>
          <Text style={styles.btnText}>{bezig ? '…' : 'Gemaakt ✓'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 14, ...shadow },
  title: { fontSize: 16, fontWeight: '800', color: C.ink },
  sub: { fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, backgroundColor: C.green, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  btnLight: { flex: 1, backgroundColor: C.primarySoft, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  btnLightText: { color: C.primary, fontWeight: '800', fontSize: 15 },
  done: { paddingVertical: 12, backgroundColor: '#E6F8F1', borderColor: '#94DDC4' },
  doneText: { color: '#0F8A67', fontWeight: '800', fontSize: 14 },
});
