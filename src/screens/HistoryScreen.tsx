import React, { useCallback, useState } from 'react';
import { FlatList, Modal, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { getAllEntries, calculateStreak } from '../storage/entriesStorage';
import { DayEntry, MOOD_EMOJI } from '../types/entry';
import { formatDateShortNL, formatDateNL, toDateKey, todayKey } from '../utils/date';
import { scoreColor } from '../utils/score';
import { RootStackParamList } from '../navigation/types';
import { C, shadow } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HistoryScreen() {
  const navigation = useNavigation<Nav>();
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [streak, setStreak] = useState(0);
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d; };
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(yesterday);
  const [webDateInput, setWebDateInput] = useState(() => toDateKey(yesterday()));

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const all = await getAllEntries();
        setEntries(all);
        setStreak(calculateStreak(all, todayKey()));
      })();
    }, [])
  );

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: pickerDate,
        mode: 'date',
        maximumDate: new Date(),
        onChange: (_e, date) => {
          if (date) navigation.navigate('EntryDetail', { date: toDateKey(date) });
        },
      });
    } else {
      setShowPicker(true);
    }
  };

  const average =
    entries.length > 0 ? (entries.reduce((sum, e) => sum + e.score, 0) / entries.length).toFixed(1).replace('.', ',') : '–';

  // Laatste 14 dagen als staafjes (lege dag = grijs streepje).
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = toDateKey(d);
    return { key, entry: byDate.get(key), label: d.toLocaleDateString('nl-NL', { weekday: 'narrow' }) };
  });
  const recent = last14.filter((x) => x.entry).map((x) => x.entry!.score);
  const recentAvg = recent.length ? (recent.reduce((a, b) => a + b, 0) / recent.length).toFixed(1).replace('.', ',') : '–';

  const header = (
    <View>
      <Text style={styles.pageTitle}>Overzicht</Text>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{entries.length}</Text>
          <Text style={styles.summaryLabel}>dagen ingevuld</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{average}</Text>
          <Text style={styles.summaryLabel}>gemiddeld cijfer</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>🔥 {streak}</Text>
          <Text style={styles.summaryLabel}>dagen op rij</Text>
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHead}>
          <Text style={styles.chartTitle}>Afgelopen 14 dagen</Text>
          <Text style={styles.chartAvg}>gem. {recentAvg}</Text>
        </View>
        <View style={styles.chart}>
          {last14.map(({ key, entry, label }) => (
            <TouchableOpacity
              key={key}
              style={styles.barCol}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('EntryDetail', { date: key })}
            >
              <View style={styles.barTrack}>
                {entry ? (
                  <View style={[styles.bar, { height: `${entry.score * 10}%`, backgroundColor: scoreColor(entry.score) }]} />
                ) : (
                  <View style={styles.barEmpty} />
                )}
              </View>
              <Text style={[styles.barLabel, key === todayKey() && styles.barLabelToday]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.addButton} onPress={openPicker} activeOpacity={0.8}>
        <Text style={styles.addButtonText}>＋  Gemiste dag invullen</Text>
      </TouchableOpacity>
      {entries.length > 0 && <Text style={styles.listTitle}>Alle dagen</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.flex}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.date}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nog geen dagen ingevuld. Begin vandaag op het tabblad Vandaag.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('EntryDetail', { date: item.date })}
          >
            <View style={[styles.scoreBadge, { backgroundColor: scoreColor(item.score) }]}>
              <Text style={styles.scoreBadgeText}>{item.score}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowDate}>{formatDateShortNL(item.date)}</Text>
              <Text style={styles.rowMeta}>
                ⚡ {item.energy}/5 · 😴 {String(item.sleepHours).replace('.', ',')} u · 🏃 {item.exerciseScore}/5 · 📈 {item.productivity}/5
              </Text>
              {item.note ? (
                <Text style={styles.rowNote} numberOfLines={1}>
                  {item.note}
                </Text>
              ) : null}
            </View>
            <Text style={styles.rowEmoji}>{MOOD_EMOJI[item.mood]}</Text>
          </TouchableOpacity>
        )}
      />

      {showPicker && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Welke dag wil je invullen?</Text>

              {Platform.OS === 'ios' && (
                <DateTimePicker
                  value={pickerDate}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  locale="nl-NL"
                  onChange={(_e, date) => { if (date) setPickerDate(date); }}
                />
              )}

              {Platform.OS === 'web' && (
                <TextInput
                  style={styles.webDateInput}
                  value={webDateInput}
                  onChangeText={setWebDateInput}
                  placeholder="JJJJ-MM-DD"
                  maxLength={10}
                />
              )}

              <Text style={styles.modalPreview}>
                {Platform.OS === 'web'
                  ? webDateInput
                  : formatDateNL(toDateKey(pickerDate))}
              </Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPicker(false)}>
                  <Text style={styles.modalCancelText}>Annuleren</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirm}
                  onPress={() => {
                    const key = Platform.OS === 'web' ? webDateInput : toDateKey(pickerDate);
                    setShowPicker(false);
                    navigation.navigate('EntryDetail', { date: key });
                  }}
                >
                  <Text style={styles.modalConfirmText}>Ga naar deze dag</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const card = {
  backgroundColor: C.card,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: C.line,
  ...shadow,
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  listContent: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 560, alignSelf: 'center' },
  pageTitle: { fontSize: 30, fontWeight: '800', color: C.ink, letterSpacing: -0.5, marginTop: 8, marginBottom: 14 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryCard: { ...card, flex: 1, paddingVertical: 14, alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '800', color: C.ink },
  summaryLabel: { fontSize: 12, color: C.muted, marginTop: 2, textAlign: 'center' },
  chartCard: { ...card, padding: 16, marginBottom: 12 },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  chartTitle: { fontSize: 16, fontWeight: '700', color: C.ink },
  chartAvg: { fontSize: 13, fontWeight: '700', color: C.primary },
  chart: { flexDirection: 'row', gap: 5, height: 120 },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', backgroundColor: '#F6F4FC', borderRadius: 8, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 8 },
  barEmpty: { height: 4, marginHorizontal: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 4 },
  barLabel: { fontSize: 11, color: C.muted, marginTop: 6, textTransform: 'uppercase' },
  barLabelToday: { color: C.primary, fontWeight: '800' },
  addButton: {
    backgroundColor: C.primarySoft,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCD4FD',
    marginBottom: 18,
  },
  addButtonText: { color: C.primary, fontWeight: '800', fontSize: 15 },
  listTitle: { fontSize: 13, fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  emptyText: { textAlign: 'center', color: C.muted, marginTop: 30, paddingHorizontal: 20, fontSize: 15 },
  row: { ...card, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 10 },
  scoreBadge: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  scoreBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 19 },
  rowBody: { flex: 1 },
  rowDate: { fontSize: 15, fontWeight: '700', color: C.ink },
  rowMeta: { fontSize: 12, color: C.muted, marginTop: 3 },
  rowNote: { fontSize: 13, color: C.text, marginTop: 3 },
  rowEmoji: { fontSize: 26, marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(23,20,43,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 16, textAlign: 'center' },
  modalPreview: { fontSize: 14, color: C.muted, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  webDateInput: {
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: 14,
    padding: 14,
    fontSize: 18,
    textAlign: 'center',
    color: C.ink,
    marginBottom: 4,
  },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalCancel: { flex: 1, borderWidth: 1.5, borderColor: C.line, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  modalCancelText: { color: C.muted, fontWeight: '700' },
  modalConfirm: { flex: 2, backgroundColor: C.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  modalConfirmText: { color: '#FFFFFF', fontWeight: '800' },
});
