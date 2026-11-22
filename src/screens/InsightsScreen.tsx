import React, { useCallback, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { INSIGHTS_KEY, onSynced, syncNow } from '../storage/sync';
import { C, HERO, scaleColor, shadow } from '../theme';

interface Patroon {
  label: string;
  met: number;
  zonder: number;
  nMet: number;
  nZonder: number;
}
interface Combi {
  combinatie: string;
  beide: number;
  geen_van_beide: number;
  nBeide: number;
  nGeen: number;
}
interface Week {
  week: string;
  soort?: 'week' | 'totaal';
  combinaties?: Combi[];
  van: string;
  tot: string;
  gemaakt: string;
  kop: string;
  samenvatting: string;
  cijfers: { gem: number | null; vorigeWeek: number | null; dagen: number };
  besefmomenten: { titel: string; tekst: string }[];
  patronen: Patroon[];
  tip: string;
}

const fmt = (n: number | null | undefined) => (n == null ? '–' : n.toFixed(1).replace('.', ','));
const kort = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
};

function PatroonBalk({ p, labels = ['wel', 'niet'] }: { p: Patroon; labels?: [string, string] | string[] }) {
  const verschil = p.met - p.zonder;
  return (
    <View style={styles.pat}>
      <View style={styles.patHead}>
        <Text style={styles.patLabel}>{p.label}</Text>
        <Text style={[styles.patDelta, { color: verschil >= 0 ? C.green : C.red }]}>
          {verschil >= 0 ? '+' : '−'}
          {fmt(Math.abs(verschil))}
        </Text>
      </View>
      {[
        { t: labels[0], v: p.met, n: p.nMet },
        { t: labels[1], v: p.zonder, n: p.nZonder },
      ].map((r) => (
        <View key={r.t} style={styles.patRow}>
          <Text style={styles.patSide}>{r.t}</Text>
          <View style={styles.patTrack}>
            <View style={[styles.patFill, { width: `${Math.max(4, r.v * 10)}%`, backgroundColor: scaleColor(Math.round(r.v)) }]} />
          </View>
          <Text style={styles.patVal}>
            {fmt(r.v)} <Text style={styles.patN}>({r.n}d)</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

function WeekKaart({ w }: { w: Week }) {
  const delta = w.cijfers.gem != null && w.cijfers.vorigeWeek != null ? w.cijfers.gem - w.cijfers.vorigeWeek : null;
  return (
    <View>
      <LinearGradient colors={HERO} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.heroSmall}>
            {w.soort === 'totaal'
              ? `Totaalbeeld · ${kort(w.van)} t/m ${kort(w.tot)} · ${w.cijfers.dagen} dagen`
              : `Week ${w.week.split('-W')[1]} · ${kort(w.van)} t/m ${kort(w.tot)}`}
          </Text>
          <Text style={styles.heroTitle}>{w.kop}</Text>
        </View>
        <View style={styles.heroScore}>
          <Text style={styles.heroNum}>{fmt(w.cijfers.gem)}</Text>
          <Text style={styles.heroSub}>
            {delta == null ? `${w.cijfers.dagen} dagen` : `${delta >= 0 ? '▲' : '▼'} ${fmt(Math.abs(delta))}`}
          </Text>
        </View>
      </LinearGradient>

      {w.samenvatting ? <Text style={styles.samen}>{w.samenvatting}</Text> : null}

      {w.besefmomenten.map((b, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.cardTitle}>💡 {b.titel}</Text>
          <Text style={styles.cardText}>{b.tekst}</Text>
        </View>
      ))}

      {w.patronen.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Je dagcijfer: wel of niet</Text>
          <Text style={styles.cardHint}>Over al je dagen sinds het begin. 'Volgens notitie' = stond in je dagnotitie (benadering).</Text>
          {w.patronen.map((p) => (
            <PatroonBalk key={p.label} p={p} />
          ))}
        </View>
      )}

      {w.combinaties && w.combinaties.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔗 Combinaties</Text>
          <Text style={styles.cardHint}>Twee dingen samen tegenover geen van beide.</Text>
          {w.combinaties.map((c) => (
            <PatroonBalk
              key={c.combinatie}
              p={{ label: c.combinatie, met: c.beide, zonder: c.geen_van_beide, nMet: c.nBeide, nZonder: c.nGeen }}
              labels={['beide', 'geen']}
            />
          ))}
        </View>
      )}

      {w.tip ? (
        <View style={[styles.card, styles.tip]}>
          <Text style={styles.cardTitle}>🎯 Voor komende week</Text>
          <Text style={styles.cardText}>{w.tip}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function InsightsScreen() {
  const [weken, setWeken] = useState<Week[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [laden, setLaden] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = JSON.parse((await AsyncStorage.getItem(INSIGHTS_KEY)) || '{}');
      const lijst: Week[] = (data.weken || []).slice().sort((a: Week, b: Week) => (a.week < b.week ? 1 : -1));
      setWeken(lijst);
    } catch {
      setWeken([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return onSynced(load);
    }, [load])
  );

  const [laatste, ...ouder] = weken;

  return (
    <SafeAreaView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.inner}>
          <Text style={styles.pageTitle}>Inzichten</Text>
          {!laatste ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Nog geen weekanalyse</Text>
              <Text style={styles.cardText}>
                Elke zondagavond bekijkt je assistent je dagen van die week, naast drinken, sport, wandelen, slaap en je
                challenge-gewoonten. De besefmomenten verschijnen hier.
              </Text>
              <TouchableOpacity
                style={styles.btn}
                onPress={async () => {
                  setLaden(true);
                  await syncNow();
                  await load();
                  setLaden(false);
                }}
              >
                <Text style={styles.btnText}>{laden ? 'Bezig…' : 'Opnieuw ophalen'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <WeekKaart w={laatste} />
          )}

          {ouder.length > 0 && <Text style={styles.listTitle}>Eerdere weken</Text>}
          {ouder.map((w) => (
            <View key={w.week}>
              <TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={() => setOpen(open === w.week ? null : w.week)}>
                <View style={[styles.badge, { backgroundColor: w.cijfers.gem != null ? scaleColor(Math.round(w.cijfers.gem)) : C.faint }]}>
                  <Text style={styles.badgeText}>{fmt(w.cijfers.gem)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {w.soort === 'totaal' ? `Totaalbeeld t/m ${kort(w.tot)}` : `Week ${w.week.split('-W')[1]} · ${kort(w.van)}`}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {w.kop}
                  </Text>
                </View>
                <Text style={styles.chev}>{open === w.week ? '˄' : '˅'}</Text>
              </TouchableOpacity>
              {open === w.week && <WeekKaart w={w} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const card = { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, ...shadow };

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  inner: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  pageTitle: { fontSize: 30, fontWeight: '800', color: C.ink, letterSpacing: -0.5, marginTop: 8, marginBottom: 14 },
  hero: { borderRadius: 26, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  heroSmall: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
  heroTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '800', marginTop: 4, letterSpacing: -0.3 },
  heroScore: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroNum: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  heroSub: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  samen: { fontSize: 16, lineHeight: 23, color: C.text, marginBottom: 12, paddingHorizontal: 4 },
  card: { ...card, padding: 16, marginBottom: 12 },
  tip: { backgroundColor: C.primarySoft, borderColor: '#DCD4FD' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 6 },
  cardHint: { fontSize: 12, color: C.muted, marginBottom: 8 },
  cardText: { fontSize: 15, lineHeight: 22, color: C.text },
  pat: { marginTop: 12 },
  patHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  patLabel: { fontSize: 14, fontWeight: '700', color: C.ink, flex: 1 },
  patDelta: { fontSize: 14, fontWeight: '800' },
  patRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  patSide: { width: 42, fontSize: 12, color: C.muted },
  patTrack: { flex: 1, height: 12, borderRadius: 6, backgroundColor: '#F2EFFA', overflow: 'hidden' },
  patFill: { height: 12, borderRadius: 6 },
  patVal: { width: 70, textAlign: 'right', fontSize: 13, fontWeight: '700', color: C.ink },
  patN: { fontSize: 11, color: C.muted, fontWeight: '400' },
  btn: { marginTop: 14, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '800' },
  listTitle: { fontSize: 13, fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 12, marginBottom: 10 },
  row: { ...card, flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 10 },
  badge: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  badgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: C.ink },
  rowSub: { fontSize: 13, color: C.muted, marginTop: 2 },
  chev: { fontSize: 18, color: C.muted, marginLeft: 8 },
});
