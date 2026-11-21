import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import NumberPicker from './NumberPicker';
import MoodPicker from './MoodPicker';
import FormSection from './FormSection';
import { DayEntry, Mood } from '../types/entry';
import { calculateStreak, getAllEntries, getEntry, saveEntry } from '../storage/entriesStorage';
import { formatDateNL, toDateKey, todayKey } from '../utils/date';
import { C, HERO, scaleColor } from '../theme';

interface DayEntryFormProps {
  date?: string;
  onSaved?: (entry: DayEntry) => void;
  /** Extra blok tussen de kop en het formulier (bv. de challenge-knop). */
  top?: ReactNode;
  /** Grote kop met begroeting en streak (Vandaag-scherm). */
  hero?: boolean;
}

const SCORE_WORD = ['', 'Rampdag', 'Zwaar', 'Matig', 'Mwah', 'Oké', 'Prima', 'Goed', 'Heel goed', 'Top', 'Perfect'];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Goedenacht';
  if (h < 12) return 'Goedemorgen';
  if (h < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateKey(d);
}

export default function DayEntryForm({ date: dateProp, onSaved, top, hero }: DayEntryFormProps) {
  const navigation = useNavigation<any>();
  const date = dateProp ?? todayKey();
  const isToday = date === todayKey();
  const [score, setScore] = useState<number | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleepHours, setSleepHours] = useState('');
  const [exerciseScore, setExerciseScore] = useState<number | null>(null);
  const [productivity, setProductivity] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<DayEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [streak, setStreak] = useState(0);
  const [missingYesterday, setMissingYesterday] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  const load = useCallback(async () => {
    const entry = await getEntry(date);
    setError(null);
    if (entry) {
      setExisting(entry);
      setScore(entry.score);
      setMood(entry.mood);
      setEnergy(entry.energy);
      setSleepHours(String(entry.sleepHours).replace('.', ','));
      setExerciseScore(entry.exerciseScore);
      setProductivity(entry.productivity);
      setNote(entry.note);
    } else {
      setExisting(null);
      setScore(null);
      setMood(null);
      setEnergy(null);
      setSleepHours('');
      setExerciseScore(null);
      setProductivity(null);
      setNote('');
    }
    await loadStats();
  }, [date, hero]);

  async function loadStats() {
    if (!hero) return;
    const all = await getAllEntries();
    const base = all.some((e) => e.date === todayKey()) ? todayKey() : yesterdayKey();
    setStreak(calculateStreak(all, base));
    setMissingYesterday(!all.some((e) => e.date === yesterdayKey()));
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const parsedSleep = parseFloat(sleepHours.replace(',', '.'));
  const bumpSleep = (delta: number) => {
    const base = isNaN(parsedSleep) ? 7 : parsedSleep;
    const next = Math.min(24, Math.max(0, Math.round((base + delta) * 2) / 2));
    setSleepHours(String(next).replace('.', ','));
  };

  const filledCount = [score, mood, energy, isNaN(parsedSleep) ? null : 1, exerciseScore, productivity].filter(
    (v) => v !== null
  ).length;

  const fail = (msg: string) => {
    setError(msg);
    setSaved(false);
  };

  const handleSave = async () => {
    if (score === null) return fail('Geef je dag eerst een cijfer van 1 t/m 10.');
    if (mood === null) return fail('Kies hoe je je voelde.');
    if (energy === null) return fail('Kies je energieniveau.');
    if (sleepHours.trim() === '' || isNaN(parsedSleep) || parsedSleep < 0 || parsedSleep > 24)
      return fail('Vul een geldig aantal slaapuren in (0 tot 24).');
    if (exerciseScore === null) return fail('Geef een cijfer voor sport.');
    if (productivity === null) return fail('Kies je productiviteit.');

    setError(null);
    setSaving(true);
    try {
      const entry = await saveEntry({
        date,
        score,
        mood,
        energy,
        sleepHours: parsedSleep,
        exerciseScore,
        productivity,
        note: note.trim(),
      });
      setExisting(entry);
      setSaved(true);
      loadStats();
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => {
        setSaved(false);
        onSaved?.(entry);
      }, onSaved ? 900 : 4000);
    } finally {
      setSaving(false);
    }
  };

  const scoreTint = score ? scaleColor(score) : 'rgba(255,255,255,0.25)';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <LinearGradient colors={HERO} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, !hero && styles.heroSmall]}>
            <View style={styles.heroText}>
              {hero && <Text style={styles.greet}>{greeting()}, Stijn</Text>}
              <Text style={styles.heroTitle}>{isToday ? 'Hoe was je dag?' : 'Dag bijwerken'}</Text>
              <Text style={styles.heroDate}>{formatDateNL(date)}</Text>
              <View style={styles.chips}>
                {hero && streak > 0 && <Text style={styles.chip}>🔥 {streak} {streak === 1 ? 'dag' : 'dagen'} op rij</Text>}
                {existing && <Text style={styles.chip}>✓ Ingevuld</Text>}
                {!existing && <Text style={styles.chip}>{filledCount}/6 ingevuld</Text>}
              </View>
            </View>
            <View style={[styles.bigScore, { backgroundColor: scoreTint }]}>
              <Text style={styles.bigScoreNum}>{score ?? '?'}</Text>
              <Text style={styles.bigScoreWord}>{score ? SCORE_WORD[score] : 'cijfer'}</Text>
            </View>
          </LinearGradient>

          {hero && isToday && missingYesterday && (
            <TouchableOpacity
              style={styles.missing}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('EntryDetail', { date: yesterdayKey() })}
            >
              <Text style={styles.missingText}>Gisteren nog niet ingevuld</Text>
              <Text style={styles.missingLink}>Invullen ›</Text>
            </TouchableOpacity>
          )}

          {top}

          <FormSection emoji="⭐" title="Cijfer voor je dag" hint="1 = rampdag, 10 = perfect">
            <NumberPicker min={1} max={10} value={score} onChange={(v) => { setScore(v); setError(null); }} />
          </FormSection>

          <FormSection emoji="🙂" title="Stemming">
            <MoodPicker value={mood} onChange={(v) => { setMood(v); setError(null); }} />
          </FormSection>

          <FormSection emoji="⚡" title="Energie">
            <NumberPicker min={1} max={5} value={energy} onChange={setEnergy} activeColor={C.amber} lowLabel="Leeg" highLabel="Vol energie" />
          </FormSection>

          <FormSection emoji="😴" title="Slaap afgelopen nacht" hint="in uren">
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => bumpSleep(-0.5)}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.sleepInput}
                placeholder="7,5"
                placeholderTextColor={C.faint}
                keyboardType="decimal-pad"
                value={sleepHours}
                onChangeText={setSleepHours}
              />
              <TouchableOpacity style={styles.stepBtn} onPress={() => bumpSleep(0.5)}>
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </FormSection>

          <FormSection emoji="🏃" title="Sport en beweging">
            <NumberPicker min={1} max={5} value={exerciseScore} onChange={setExerciseScore} activeColor={C.coral} lowLabel="Niks" highLabel="Flink bewogen" />
          </FormSection>

          <FormSection emoji="📈" title="Productiviteit" hint="werk of studie">
            <NumberPicker min={1} max={5} value={productivity} onChange={setProductivity} activeColor={C.green} lowLabel="Weinig gedaan" highLabel="Super productief" />
          </FormSection>

          <FormSection emoji="📝" title="Notitie" hint="optioneel">
            <TextInput
              style={styles.noteInput}
              placeholder={score ? `Waarom was deze dag een ${score}?` : 'Wat maakte deze dag zoals hij was?'}
              placeholderTextColor={C.faint}
              multiline
              numberOfLines={4}
              value={note}
              onChangeText={setNote}
            />
          </FormSection>
        </View>
      </ScrollView>

      <View style={styles.footer} pointerEvents="box-none">
        <View style={styles.inner}>
          {error && <Text style={styles.error}>{error}</Text>}
          {saved ? (
            <View style={[styles.saveButton, styles.savedButton]}>
              <Text style={styles.saveButtonText}>✓ {isToday ? 'Opgeslagen. Tot morgen!' : 'Bijgewerkt'}</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              <LinearGradient colors={HERO} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>{saving ? 'Opslaan…' : existing ? 'Wijzigingen opslaan' : 'Dag opslaan'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 130 },
  inner: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  hero: {
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroSmall: { paddingVertical: 18 },
  heroText: { flex: 1, paddingRight: 12 },
  greet: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  heroTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  heroDate: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  bigScore: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  bigScoreNum: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', lineHeight: 36 },
  bigScoreWord: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', opacity: 0.95 },
  missing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF4E8',
    borderColor: '#FBD5A8',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  missingText: { color: '#9A4B00', fontWeight: '600', fontSize: 14 },
  missingLink: { color: '#9A4B00', fontWeight: '800', fontSize: 14 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: C.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 26, color: C.primary, fontWeight: '700', lineHeight: 28 },
  sleepInput: {
    flex: 1,
    height: 50,
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: 16,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: C.ink,
    backgroundColor: '#FAF9FE',
  },
  noteInput: {
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: C.ink,
    backgroundColor: '#FAF9FE',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: 'rgba(244,242,250,0.92)',
  },
  error: {
    color: '#B42318',
    backgroundColor: '#FEECEB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    overflow: 'hidden',
  },
  saveButton: {
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
  },
  savedButton: { backgroundColor: C.green },
  saveButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
});
