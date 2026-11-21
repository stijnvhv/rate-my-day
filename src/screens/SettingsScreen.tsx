import React, { useCallback, useState } from 'react';
import { Alert, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { DEFAULT_SETTINGS, getSettings, saveSettings, Settings } from '../storage/settingsStorage';
import {
  cancelDailyReminder,
  requestNotificationPermission,
  scheduleDailyReminder,
  sendTestNotification,
} from '../notifications/notifications';

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function timeToDate(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

const ENTRIES_KEY = 'rate-my-day:entries';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [importText, setImportText] = useState('');

  useFocusEffect(
    useCallback(() => {
      getSettings().then(setSettings);
    }, [])
  );

  const applyReminder = async (next: Settings) => {
    if (next.reminderEnabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        notify(
          'Geen toestemming',
          'Zet notificaties aan voor deze app in je telefooninstellingen om de herinnering te ontvangen.'
        );
        return;
      }
      await scheduleDailyReminder(next.reminderHour, next.reminderMinute);
    } else {
      await cancelDailyReminder();
    }
  };

  const updateSettings = async (next: Settings) => {
    setSettings(next);
    setSaving(true);
    try {
      await saveSettings(next);
      await applyReminder(next);
    } finally {
      setSaving(false);
    }
  };

  const onTimePicked = (hour: number, minute: number) => {
    updateSettings({ ...settings, reminderHour: hour, reminderMinute: minute });
  };

  const openAndroidPicker = () => {
    DateTimePickerAndroid.open({
      value: timeToDate(settings.reminderHour, settings.reminderMinute),
      mode: 'time',
      is24Hour: true,
      onChange: (_event, date) => {
        if (date) onTimePicked(date.getHours(), date.getMinutes());
      },
    });
  };

  const timeLabel = `${String(settings.reminderHour).padStart(2, '0')}:${String(settings.reminderMinute).padStart(
    2,
    '0'
  )}`;

  const handleExport = async () => {
    const raw = await AsyncStorage.getItem(ENTRIES_KEY);
    setExportJson(raw ?? '{}');
  };

  const handleImport = async () => {
    try {
      const parsed = JSON.parse(importText);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(parsed));
      setImportText('');
      notify('Geïmporteerd', 'Je geschiedenis is overgezet. Ga naar het tabblad Overzicht om het te bekijken.');
    } catch {
      notify('Ongeldige data', 'Controleer of je de volledige JSON hebt geplakt.');
    }
  };

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.content}>
        <Text style={styles.heading}>Instellingen</Text>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Dagelijkse herinnering</Text>
            <Text style={styles.rowSubtitle}>
              {Platform.OS === 'web'
                ? 'In de webversie komt de herinnering via Structured en je Mac, niet uit deze app.'
                : 'Krijg elke dag een melding om je dag te beoordelen.'}
            </Text>
          </View>
          <Switch
            value={settings.reminderEnabled}
            onValueChange={(value) => updateSettings({ ...settings, reminderEnabled: value })}
            disabled={saving}
          />
        </View>

        {settings.reminderEnabled && (
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Tijdstip</Text>
              <Text style={styles.rowSubtitle}>Wanneer wil je de melding ontvangen?</Text>
            </View>
            {Platform.OS === 'android' && (
              <TouchableOpacity style={styles.timeButton} onPress={openAndroidPicker} disabled={saving}>
                <Text style={styles.timeButtonText}>{timeLabel}</Text>
              </TouchableOpacity>
            )}
            {Platform.OS === 'ios' && (
              <DateTimePicker
                value={timeToDate(settings.reminderHour, settings.reminderMinute)}
                mode="time"
                display="compact"
                onChange={(_event, date) => {
                  if (date) onTimePicked(date.getHours(), date.getMinutes());
                }}
              />
            )}
            {Platform.OS === 'web' && (
              <View style={styles.webTimeRow}>
                <TextInput
                  style={styles.webTimeInput}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={String(settings.reminderHour).padStart(2, '0')}
                  onChangeText={(text) => {
                    const hour = Math.min(23, Math.max(0, parseInt(text, 10) || 0));
                    onTimePicked(hour, settings.reminderMinute);
                  }}
                />
                <Text style={styles.webTimeColon}>:</Text>
                <TextInput
                  style={styles.webTimeInput}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={String(settings.reminderMinute).padStart(2, '0')}
                  onChangeText={(text) => {
                    const minute = Math.min(59, Math.max(0, parseInt(text, 10) || 0));
                    onTimePicked(settings.reminderHour, minute);
                  }}
                />
              </View>
            )}
          </View>
        )}

        {Platform.OS !== 'web' && (
        <TouchableOpacity style={styles.testButton} onPress={sendTestNotification}>
          <Text style={styles.testButtonText}>Stuur testmelding</Text>
        </TouchableOpacity>
        )}

        <Text style={styles.sectionHeading}>Data overzetten</Text>

        <TouchableOpacity style={styles.transferButton} onPress={handleExport}>
          <Text style={styles.transferButtonText}>Exporteer mijn data</Text>
        </TouchableOpacity>

        <Text style={styles.importLabel}>Plak geëxporteerde data hier om te importeren:</Text>
        <TextInput
          style={styles.importInput}
          multiline
          placeholder='{"2026-06-24": {...}, ...}'
          placeholderTextColor="#9CA3AF"
          value={importText}
          onChangeText={setImportText}
        />
        {importText.length > 0 && (
          <TouchableOpacity style={styles.importButton} onPress={handleImport}>
            <Text style={styles.importButtonText}>Importeer</Text>
          </TouchableOpacity>
        )}
      </View>

      {exportJson !== null && (
        <Modal animationType="slide" onRequestClose={() => setExportJson(null)}>
          <SafeAreaView style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Jouw data</Text>
            <Text style={styles.modalHint}>Selecteer alles en kopieer → plak in de webapp onder Instellingen → Importeer.</Text>
            <ScrollView style={styles.modalScroll}>
              <TextInput
                style={styles.modalInput}
                multiline
                value={exportJson}
                editable={false}
                selectTextOnFocus
              />
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setExportJson(null)}>
              <Text style={styles.modalCloseText}>Sluiten</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F4F2FA' },
  content: {
    padding: 16,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  heading: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 8,
    color: '#17142B',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ECE8F7',
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#17142B',
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#7A7592',
    marginTop: 2,
  },
  timeButton: {
    backgroundColor: '#EEEAFE',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  timeButtonText: {
    color: '#6C4CF5',
    fontWeight: '700',
    fontSize: 15,
  },
  webTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  webTimeInput: {
    width: 40,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#ECE8F7',
    borderRadius: 6,
    paddingVertical: 6,
    fontSize: 15,
    fontWeight: '600',
    color: '#17142B',
  },
  webTimeColon: {
    marginHorizontal: 4,
    fontSize: 15,
    fontWeight: '600',
    color: '#17142B',
  },
  testButton: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 12,
  },
  testButtonText: {
    color: '#6C4CF5',
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7A7592',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 24,
    marginBottom: 10,
  },
  transferButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ECE8F7',
    marginBottom: 16,
  },
  transferButtonText: {
    color: '#3B3755',
    fontWeight: '600',
    fontSize: 15,
  },
  importLabel: {
    fontSize: 13,
    color: '#7A7592',
    marginBottom: 8,
  },
  importInput: {
    borderWidth: 1,
    borderColor: '#ECE8F7',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#17142B',
    backgroundColor: '#FFFFFF',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  importButton: {
    backgroundColor: '#6C4CF5',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  importButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F4F2FA',
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#17142B',
    marginBottom: 8,
  },
  modalHint: {
    fontSize: 13,
    color: '#7A7592',
    marginBottom: 16,
    lineHeight: 18,
  },
  modalScroll: {
    flex: 1,
  },
  modalInput: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#17142B',
    lineHeight: 16,
  },
  modalClose: {
    backgroundColor: '#17142B',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
