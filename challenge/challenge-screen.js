// 90-dagen challenge — tabblad voor Rate My Day.
// Dit bestand is de leesbare bron van de module die `challenge/inject.mjs` in de
// gebouwde Expo-bundel zet. Beschikbaar in de module-scope: r (require), d (deps), _e (exports).
// Deps (zie inject.mjs): 0 react, 1 StyleSheet, 2 Text, 3 View, 4 ScrollView,
// 5 @react-navigation/native, 6 TextInput, 7 TouchableOpacity, 8 AsyncStorage,
// 9 entries-storage, 10 date-utils, 11 scoreColor, 12 SafeAreaView
"use strict";
Object.defineProperty(_e, '__esModule', { value: true });
Object.defineProperty(_e, 'default', { enumerable: true, get: function () { return ChallengeScreen; } });
Object.defineProperty(_e, 'ChallengeButton', { enumerable: true, get: function () { return ChallengeButton; } });

const def = (x) => (x && x.__esModule ? x.default : x);
const React = r(d[0]);
const StyleSheet = def(r(d[1]));
const Text = def(r(d[2]));
const View = def(r(d[3]));
const ScrollView = def(r(d[4]));
const nav = r(d[5]);
const TextInput = def(r(d[6]));
const Touchable = def(r(d[7]));
const AsyncStorage = def(r(d[8]));
const entryStore = r(d[9]);
const dates = r(d[10]);
const colors = r(d[11]);
const SafeArea = def(r(d[12]));
const h = React.createElement;
const Input = (props) => h(TextInput, Object.assign({ placeholderTextColor: '#9CA3AF' }, props));
const { useState, useRef, useCallback, useMemo } = React;

// ---------------------------------------------------------------------------
// Opslag
// ---------------------------------------------------------------------------
const KEY = 'rate-my-day:challenge';
const TOTAL_DAYS = 90;
const TOTAL_WEEKS = 13;
const STEPS_GOAL = 12500;

function emptyChallenge() {
  return { version: 1, startDate: null, bedStart: '23:00', days: {}, weeks: {}, milestones: {}, exceptions: [], lastAnalysisWeek: 0 };
}
async function loadChallenge() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? Object.assign(emptyChallenge(), JSON.parse(raw)) : emptyChallenge();
  } catch (err) {
    return emptyChallenge();
  }
}
async function saveChallenge(c) {
  await AsyncStorage.setItem(KEY, JSON.stringify(c));
}

// ---------------------------------------------------------------------------
// Datums
// ---------------------------------------------------------------------------
const pk = (k) => { const [y, m, dd] = k.split('-').map(Number); return new Date(y, m - 1, dd); };
const addDays = (k, n) => { const x = pk(k); x.setDate(x.getDate() + n); return dates.toDateKey(x); };
const diffDays = (a, b) => {
  const A = pk(a), B = pk(b);
  return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate()) - Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 864e5);
};
const dow = (k) => pk(k).getDay();
const isWorkday = (k) => { const w = dow(k); return w >= 1 && w <= 5; };
const mondayOf = (k) => addDays(k, -((dow(k) + 6) % 7));
const validKey = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && dates.toDateKey(pk(k)) === k;
const shortDay = (k) => pk(k).toLocaleDateString('nl-NL', { weekday: 'short' }).replace('.', '');
const longDay = (k) => pk(k).toLocaleDateString('nl-NL', { weekday: 'long' });
const dayMonth = (k) => pk(k).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const fmt = (n, dec = 1) => (n == null || isNaN(n) ? '–' : n.toFixed(dec).replace('.', ','));
const signed = (n, dec = 1) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n), dec);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (x) => Math.round(x * 100) + '%';

// ---------------------------------------------------------------------------
// Challenge-logica
// ---------------------------------------------------------------------------
function dayNo(c, k) { return diffDays(c.startDate, k) + 1; }
function weekNo(c, k) { return Math.floor((dayNo(c, k) - 1) / 7) + 1; }
function weekDays(c, n) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const k = addDays(c.startDate, (n - 1) * 7 + i);
    if (dayNo(c, k) <= TOTAL_DAYS) out.push(k);
  }
  return out;
}
function lastDay(c) { return addDays(c.startDate, TOTAL_DAYS - 1); }
function currentWeek(c, today) {
  const n = weekNo(c, today);
  return Math.max(1, Math.min(TOTAL_WEEKS, n));
}

function parseTime(s) {
  const m = /^\s*(\d{1,2})\s*[:.hu]?\s*(\d{2})\s*$/.exec(s || '');
  if (!m) return null;
  const hh = Number(m[1]), mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  let v = hh * 60 + mm;
  if (v < 12 * 60) v += 24 * 60; // na middernacht telt als dezelfde avond
  return v;
}
const timeStr = (v) => { v = v % (24 * 60); return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0'); };
function bedWindow(c) {
  const s = parseTime(c.bedStart) ?? parseTime('23:00');
  return [s, s + 30];
}
function bedOk(c, rec) {
  if (!rec || !rec.bed) return null;
  const v = parseTime(rec.bed);
  if (v == null) return null;
  const [a, b] = bedWindow(c);
  return v >= a && v <= b;
}
const isPlannedException = (c, k) => (c.exceptions || []).some((x) => x.date === k);
const recOf = (c, k) => c.days[k] || null;

const SPORTS = [
  { id: 'gym', label: '🏋️ Gym' },
  { id: 'run', label: '🏃 Hardlopen' },
  { id: 'box', label: '🥊 Boksen' },
  { id: 'other', label: '➕ Anders' },
];
const SUGAR = [
  { id: 'none', label: 'Geen' },
  { id: 'little', label: 'Beetje' },
  { id: 'much', label: 'Veel' },
];
const YESNO = [
  { id: false, label: 'Nee' },
  { id: true, label: 'Ja' },
];
const SUNDAY = [
  { id: 'review', label: 'Gewoonten en Rate My Day teruggekeken' },
  { id: 'adjust', label: 'Bepaald wat goed ging en waar ik bijstuur' },
  { id: 'plan', label: '4 trainingen, meditatie en focusblokken ingepland' },
  { id: 'choose', label: '1 uitgestelde klus + 3 resultaten voor komende week gekozen' },
];
const MILESTONES = [
  { id: 'coach1', group: 'Nieuwe coach', title: 'Bepaald wat ik zoek in een coach', week: 2 },
  { id: 'coach2', group: 'Nieuwe coach', title: 'Kennismakingsgesprekken gevoerd', week: 4 },
  { id: 'coach3', group: 'Nieuwe coach', title: 'Coach gekozen', week: 6 },
  { id: 'strat1', group: 'Strategie & Scaling Up', title: 'Strategie op één pagina aangescherpt', week: 2 },
  { id: 'strat2', group: 'Strategie & Scaling Up', title: 'Max. 3 bedrijfsprioriteiten gekozen voor deze 90 dagen', week: 2 },
  { id: 'strat3', group: 'Strategie & Scaling Up', title: 'Per prioriteit: verantwoordelijke, meetbaar resultaat en deadline', week: 4 },
  { id: 'strat4', group: 'Strategie & Scaling Up', title: 'Besproken met de betrokken medewerkers', week: 4 },
  { id: 'strat5', group: 'Strategie & Scaling Up', title: 'Vast weekritme loopt: voortgang, cijfers, knelpunten, afspraken', week: 8 },
  { id: 'strat6', group: 'Strategie & Scaling Up', title: 'Geëvalueerd, bijgestuurd en prioriteiten voor de volgende 90 dagen bepaald', week: 13 },
  { id: 'biz1', group: 'Zakelijk', title: 'AI-implementatieplan met concrete doelen (besparingen)', week: 13 },
  { id: 'biz2', group: 'Zakelijk', title: 'Scaling Up fase 1 omarmd en gedragen door het MT', week: 13 },
];
function strategyPhase(n) {
  if (n <= 2) return { title: 'Week 1–2: richting bepalen', text: 'Strategie op één pagina aanscherpen en maximaal drie bedrijfsprioriteiten kiezen.' };
  if (n <= 4) return { title: 'Week 3–4: vertalen naar uitvoering', text: 'Per prioriteit een verantwoordelijke, meetbaar resultaat en deadline. Bespreken met de betrokken medewerkers.' };
  if (n <= 8) return { title: 'Week 5–8: vast ritme invoeren', text: 'Wekelijks kort voortgang, cijfers en knelpunten bespreken. Afspraken vastleggen en opvolgen.' };
  return { title: 'Week 9–13: verbeteren en borgen', text: 'Evalueren wat werkt, bijsturen en de prioriteiten voor de volgende 90 dagen bepalen.' };
}
const ADVICE = {
  sport: 'Plan zondag je 4 trainingen met dag én tijd in je agenda, zoals een afspraak.',
  ice: 'Koppel het ijsbad aan een vaste trigger, bijvoorbeeld direct na het sporten.',
  steps: 'Plan een vaste wandeling: na de lunch of een belafspraak lopend doen.',
  meditate: 'Mediteer direct na het opstaan, vóór je je telefoon pakt.',
  bed: 'Zet een wekker 45 minuten voor je bedtijd als start van het afsluiten.',
  flex: 'Meer dan één flexavond: bepaal zondag welke avond je flexavond wordt.',
  phone: 'Leg je telefoon standaard aan de lader buiten de slaapkamer.',
  alcohol: 'Meer dan één drinkmoment. Kies vooraf welk moment het wordt; niet-gebruikte momenten spaar je niet op.',
  drugs: 'Ongepland gebruik valt buiten je afspraak. Schrijf op wat de trigger was en hervat direct.',
  goals: 'Schrijf je 3 doelen de avond ervoor al op, zodat je de dag er direct mee begint.',
  rmd: 'Maak Rate My Day het vaste laatste punt van je avondritueel.',
  scaling: 'Blok op maandag 2 focusblokken voor Scaling Up in je agenda.',
  klus: 'Maak de uitgestelde klus kleiner of plan er meteen op maandag een vast blok voor.',
  sunday: 'Zet je zondagse voortgangsmoment als terugkerende afspraak in je agenda.',
};

function weekStats(c, n, entries, today) {
  const days = weekDays(c, n);
  const wk = c.weeks[n] || {};
  const complete = days.length > 0 && days[days.length - 1] < today;
  const started = days.length > 0 && days[0] <= today;
  const recs = days.map((k) => recOf(c, k));
  // Vandaag telt pas als gemist wanneer de dag voorbij is.
  const perDay = (fn) => days.map((k, i) => { if (k > today) return null; const v = fn(recs[i] || {}, k); return k === today && v === false ? null : v; });
  const count = (arr) => arr.filter((x) => x === true).length;
  const workdays = days.filter(isWorkday);

  const rows = [];
  const add = (row) => {
    const { count: cnt, target, type = 'min' } = row;
    let status;
    if (!started) status = 'future';
    else if (type === 'max') status = cnt > target ? 'fail' : complete ? 'ok' : 'pending';
    else status = cnt >= target ? 'ok' : complete ? 'fail' : 'pending';
    rows.push(Object.assign({ type, status }, row));
  };
  add({ id: 'sport', emoji: '🏋️', label: 'Sporten', count: recs.reduce((s, x) => s + ((x && x.sport) || []).length, 0), target: 4, dots: perDay((x) => (x.sport || []).length > 0) });
  add({ id: 'ice', emoji: '🧊', label: 'IJsbad', count: count(perDay((x) => !!x.ice)), target: 3, dots: perDay((x) => !!x.ice) });
  const stepsDots = perDay((x) => (x.steps == null ? null : x.steps >= STEPS_GOAL));
  add({ id: 'steps', emoji: '👟', label: '12.500 stappen', count: count(stepsDots), target: days.length, dots: stepsDots });
  add({ id: 'meditate', emoji: '🧘', label: 'Mediteren', count: count(perDay((x) => !!x.meditate)), target: Math.min(6, days.length), dots: perDay((x) => !!x.meditate) });
  const bedDots = perDay((x) => bedOk(c, x));
  add({ id: 'bed', emoji: '🛏️', label: 'Op tijd naar bed', count: count(bedDots), target: Math.min(6, days.length), dots: bedDots });
  add({ id: 'flex', emoji: '🎉', label: 'Flexavonden', count: count(perDay((x) => !!x.flex)), target: 1, type: 'max', dots: perDay((x) => (x.flex ? 'warn' : null)) });
  add({ id: 'phone', emoji: '📵', label: 'Telefoon weg in bed', count: count(perDay((x) => !!x.phone)), target: days.length, dots: perDay((x) => !!x.phone) });
  const sugarDots = perDay((x) => (x.sugar ? x.sugar === 'none' : null));
  add({ id: 'sugar', emoji: '🍬', label: 'Geen toegevoegd suiker', count: count(sugarDots), target: days.length, soft: true, dots: sugarDots });
  add({ id: 'alcohol', emoji: '🍷', label: 'Drinkmomenten', count: count(perDay((x) => x.alcohol === true)), target: 1, type: 'max', dots: perDay((x) => (x.alcohol === true ? 'warn' : x.alcohol === false ? true : null)) });
  const unplanned = perDay((x, k) => x.drugs === true && !isPlannedException(c, k));
  add({ id: 'drugs', emoji: '💊', label: 'Ongepland drugsgebruik', count: count(unplanned), target: 0, type: 'max', dots: perDay((x, k) => (x.drugs === true ? (isPlannedException(c, k) ? 'warn' : false) : x.drugs === false ? true : null)) });
  const goalDots = days.map((k, i) => (k > today || !isWorkday(k) || (k === today && !(recs[i] && recs[i].goalsSet)) ? null : !!(recs[i] && recs[i].goalsSet)));
  add({ id: 'goals', emoji: '🎯', label: '3 doelen op werkdagen', count: count(goalDots), target: workdays.length, dots: goalDots });
  const rmdDots = perDay((x, k) => !!entries[k]);
  add({ id: 'rmd', emoji: '⭐', label: 'Rate My Day ingevuld', count: count(rmdDots), target: days.length, dots: rmdDots });
  add({ id: 'scaling', emoji: '📈', label: 'Focusblokken Scaling Up', count: recs.reduce((s, x) => s + ((x && x.scaling) || 0), 0), target: 2 });
  add({ id: 'klus', emoji: '🧹', label: 'Uitgestelde klus afgerond', count: wk.klusDone ? 1 : 0, target: 1 });
  add({ id: 'sunday', emoji: '🗓️', label: 'Zondags voortgangsmoment', count: SUNDAY.every((s) => wk.sunday && wk.sunday[s.id]) ? 1 : 0, target: 1 });

  const judged = rows.filter((x) => !x.soft && (x.status === 'ok' || x.status === 'fail'));
  const done = judged.filter((x) => x.status === 'ok').length;
  const consistency = judged.length ? done / judged.length : null;

  const resultsDone = (wk.results || []).filter((x) => x && x.done).length;
  const goalsPlanned = workdays.filter((k) => k <= today).length * 3;
  const goalsDone = workdays.reduce((s, k) => s + (((recOf(c, k) || {}).goals || []).filter((g) => g && g.done).length), 0);
  const resParts = [resultsDone / 3, wk.klusDone ? 1 : 0];
  if (goalsPlanned) resParts.push(Math.min(1, goalsDone / goalsPlanned));
  const results = started ? avg(resParts) : null;

  const scores = days.filter((k) => entries[k]).map((k) => ({ k, e: entries[k] }));
  return { n, days, rows, complete, started, consistency, results, resultsDone, goalsDone, goalsPlanned, scores, wk };
}

// ---------------------------------------------------------------------------
// Analyse: verbanden tussen gewoonten en hoe je je voelt
// ---------------------------------------------------------------------------
const METRICS = [
  { id: 'score', label: 'cijfer', get: (e) => e.score, range: 9 },
  { id: 'energy', label: 'energie', get: (e) => e.energy, range: 4 },
  { id: 'mood', label: 'stemming', get: (e) => ({ happy: 3, neutral: 2, sad: 1 })[e.mood], range: 2 },
  { id: 'productivity', label: 'productiviteit', get: (e) => e.productivity, range: 4 },
  { id: 'sleep', label: 'slaapuren', get: (e) => e.sleepHours, range: 4 },
];
function factors(c) {
  return [
    { id: 'alcohol', when: 'Alcohol gedronken', substance: true, test: (x) => x.alcohol === true, known: (x) => x.alcohol != null, lags: [0, 1, 2, 3] },
    { id: 'drugs', when: 'Drugs gebruikt', substance: true, test: (x) => x.drugs === true, known: (x) => x.drugs != null, lags: [0, 1, 2, 3] },
    { id: 'sport', when: 'Gesport', test: (x) => (x.sport || []).length > 0, lags: [0, 1] },
    { id: 'ice', when: 'IJsbad genomen', test: (x) => !!x.ice, lags: [0, 1] },
    { id: 'steps', when: '12.500+ stappen', test: (x) => x.steps >= STEPS_GOAL, known: (x) => x.steps != null, lags: [0, 1] },
    { id: 'meditate', when: 'Gemediteerd', test: (x) => !!x.meditate, lags: [0, 1] },
    { id: 'bed', when: 'Op tijd naar bed', test: (x) => bedOk(c, x) === true, known: (x) => bedOk(c, x) != null, lags: [1] },
    { id: 'phone', when: 'Telefoon weg in bed', test: (x) => !!x.phone, lags: [1] },
    { id: 'sugar', when: 'Geen toegevoegd suiker', test: (x) => x.sugar === 'none', known: (x) => !!x.sugar, lags: [0, 1] },
    { id: 'goals', when: 'Dag gestart met 3 doelen', test: (x) => !!x.goalsSet, known: (_x, k) => isWorkday(k), lags: [0] },
  ];
}
const LAG = ['dezelfde dag', 'de dag erna', '2 dagen erna', '3 dagen erna'];

function analyse(c, entries, today, until) {
  const end = until && until < today ? until : today;
  const allDays = [];
  for (let k = c.startDate; k <= end && dayNo(c, k) <= TOTAL_DAYS; k = addDays(k, 1)) allDays.push(k);
  const used = (k) => { const x = recOf(c, k); return !!x && (x.alcohol === true || x.drugs === true); };
  const clean = (k) => [0, 1, 2, 3].every((i) => !used(addDays(k, -i)));

  const results = [];
  const curves = {};
  for (const f of factors(c)) {
    const known = f.known || (() => true);
    for (const m of METRICS) {
      for (const L of f.lags) {
        const withV = [], withoutV = [];
        for (const k of allDays) {
          const e = entries[k];
          if (!e) continue;
          const v = m.get(e);
          if (v == null || isNaN(v)) continue;
          const src = addDays(k, -L);
          if (src < c.startDate) continue;
          const rec = recOf(c, src);
          if (!rec) continue;
          if (f.substance) {
            if (f.test(rec)) withV.push(v);
            else if (clean(k)) withoutV.push(v);
          } else {
            if (!known(rec, src)) continue;
            (f.test(rec) ? withV : withoutV).push(v);
          }
        }
        const a = avg(withV), b = avg(withoutV);
        const res = { f, m, L, withMean: a, withoutMean: b, nWith: withV.length, nWithout: withoutV.length };
        if (a != null && b != null) { res.diff = a - b; res.norm = res.diff / m.range; }
        if (f.substance) (curves[f.id + ':' + m.id] = curves[f.id + ':' + m.id] || []).push(res);
        results.push(res);
      }
    }
  }
  const solid = results.filter((x) => x.diff != null && x.nWith >= 2 && x.nWithout >= 2);
  const top = solid
    .filter((x) => Math.abs(x.norm) >= 0.08)
    .sort((x, y) => Math.abs(y.norm) - Math.abs(x.norm));
  // per factor alleen de sterkste combinatie in de toplijst, anders domineert één factor
  const seen = new Set();
  const highlights = [];
  for (const x of top) {
    const key = x.f.id + ':' + x.m.id;
    if (seen.has(key)) continue;
    seen.add(key);
    highlights.push(x);
    if (highlights.length >= 8) break;
  }
  return { results, solid, highlights, curves, daysCount: allDays.length, entryDays: allDays.filter((k) => entries[k]).length };
}

function insightText(x) {
  const better = x.diff > 0;
  const m = x.m.label;
  const lag = x.L === 0 ? '' : ' ' + LAG[x.L];
  const when = x.f.substance
    ? (x.L === 0 ? `Op dagen dat je ${x.f.id === 'alcohol' ? 'drinkt' : 'drugs gebruikt'}` : `${x.f.id === 'alcohol' ? 'Na alcohol' : 'Na drugs'}`)
    : x.L === 1 ? `${x.f.when}` : `${x.f.when}`;
  const dir = better ? 'hoger' : 'lager';
  const base = x.f.substance ? 'dagen zonder alcohol/drugs in de 3 dagen ervoor' : 'dagen zonder';
  return {
    title: `${when}: ${m}${lag} ${dir}`,
    body: `${fmt(x.withMean)} tegenover ${fmt(x.withoutMean)} op ${base} (${signed(x.diff)}). Gemeten: ${x.nWith}× tegenover ${x.nWithout}×.`,
    good: better,
  };
}

// ---------------------------------------------------------------------------
// Kleine UI-bouwstenen
// ---------------------------------------------------------------------------
function Card({ title, emoji, right, children, tone }) {
  return h(View, { style: [S.card, tone === 'accent' && S.cardAccent, tone === 'warn' && S.cardWarn] },
    title ? h(View, { style: S.cardHead },
      h(Text, { style: S.cardTitle }, (emoji ? emoji + '  ' : '') + title),
      right ? h(Text, { style: S.cardRight }, right) : null) : null,
    children);
}
function Check({ label, sub, value, onChange }) {
  return h(Touchable, { style: S.checkRow, onPress: () => onChange(!value), activeOpacity: 0.7 },
    h(View, { style: [S.box, value && S.boxOn] }, value ? h(Text, { style: S.boxMark }, '✓') : null),
    h(View, { style: { flex: 1 } },
      h(Text, { style: [S.checkLabel, value && S.checkLabelOn] }, label),
      sub ? h(Text, { style: S.checkSub }, sub) : null));
}
function Chips({ options, value, onChange, multi }) {
  const isOn = (id) => (multi ? (value || []).includes(id) : value === id);
  return h(View, { style: S.chips }, options.map((o) =>
    h(Touchable, {
      key: String(o.id), style: [S.chip, isOn(o.id) && S.chipOn],
      onPress: () => {
        if (multi) { const cur = value || []; onChange(isOn(o.id) ? cur.filter((x) => x !== o.id) : cur.concat(o.id)); }
        else onChange(isOn(o.id) ? null : o.id);
      },
    }, h(Text, { style: [S.chipText, isOn(o.id) && S.chipTextOn] }, o.label))));
}
function Stepper({ value, onChange, min = 0, max = 20 }) {
  const v = value || 0;
  return h(View, { style: S.stepper },
    h(Touchable, { style: S.stepBtn, onPress: () => onChange(Math.max(min, v - 1)) }, h(Text, { style: S.stepBtnText }, '−')),
    h(Text, { style: S.stepVal }, String(v)),
    h(Touchable, { style: S.stepBtn, onPress: () => onChange(Math.min(max, v + 1)) }, h(Text, { style: S.stepBtnText }, '+')));
}
function Field({ label, children, hint }) {
  return h(View, { style: S.field },
    h(Text, { style: S.fieldLabel }, label),
    children,
    hint ? h(Text, { style: S.fieldHint }, hint) : null);
}
function Bar({ value, color }) {
  const w = Math.max(0, Math.min(1, value || 0));
  return h(View, { style: S.bar }, h(View, { style: [S.barFill, { width: pct(w), backgroundColor: color || '#4F46E5' }] }));
}
function Btn({ label, onPress, kind }) {
  return h(Touchable, { style: [S.btn, kind === 'ghost' && S.btnGhost, kind === 'danger' && S.btnDanger], onPress },
    h(Text, { style: [S.btnText, kind === 'ghost' && S.btnGhostText] }, label));
}
function Nav({ label, sub, onPrev, onNext }) {
  return h(View, { style: S.navRow },
    h(Touchable, { style: [S.navBtn, !onPrev && S.navBtnOff], onPress: onPrev || undefined, disabled: !onPrev }, h(Text, { style: S.navBtnText }, '‹')),
    h(View, { style: { flex: 1, alignItems: 'center' } },
      h(Text, { style: S.navTitle }, label),
      sub ? h(Text, { style: S.navSub }, sub) : null),
    h(Touchable, { style: [S.navBtn, !onNext && S.navBtnOff], onPress: onNext || undefined, disabled: !onNext }, h(Text, { style: S.navBtnText }, '›')));
}
const STATUS_COLOR = { ok: '#10B981', fail: '#EF4444', pending: '#9CA3AF', future: '#D1D5DB' };
const STATUS_ICON = { ok: '✅', fail: '❌', pending: '⏳', future: '·' };
function Dots({ dots }) {
  return h(View, { style: S.dots }, (dots || []).map((x, i) =>
    h(View, { key: i, style: [S.dot, { backgroundColor: x === true ? '#10B981' : x === false ? '#FCA5A5' : x === 'warn' ? '#F59E0B' : '#E5E7EB' }] })));
}
function copyText(text, onFallback) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => window.alert('Gekopieerd! Plak het in een gesprek met Claude.'), () => onFallback(text));
      return;
    }
  } catch (err) { /* val terug */ }
  onFallback(text);
}

// ---------------------------------------------------------------------------
// Scherm
// ---------------------------------------------------------------------------
function ChallengeScreen() {
  const navigation = nav.useNavigation();
  const today = dates.todayKey();
  const [c, setC] = useState(null);
  const ref = useRef(null);
  const [entries, setEntries] = useState({});
  const [tab, setTab] = useState('dag');
  const [day, setDay] = useState(today);
  const [week, setWeek] = useState(null);
  const [aWeek, setAWeek] = useState(null);
  const [banner, setBanner] = useState(null);
  const [textModal, setTextModal] = useState(null);

  nav.useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      const [ch, all] = await Promise.all([loadChallenge(), entryStore.getAllEntries()]);
      if (!alive) return;
      const map = {};
      all.forEach((e) => { map[e.date] = e; });
      setEntries(map);
      if (ch.startDate) {
        const t = dates.todayKey();
        const cw = currentWeek(ch, t);
        // Begin van een nieuwe week: automatisch de analyse van de afgelopen week tonen.
        if (t >= ch.startDate && cw > 1 && (ch.lastAnalysisWeek || 0) < cw - 1) {
          ch.lastAnalysisWeek = cw - 1;
          await saveChallenge(ch);
          setTab('analyse');
          setAWeek(cw - 1);
          setBanner(`Nieuwe week! Hier is je analyse van week ${cw - 1}.`);
        }
        const inRange = t >= ch.startDate && t <= lastDay(ch);
        setDay((cur) => (cur && cur >= ch.startDate && cur <= lastDay(ch) ? cur : inRange ? t : t < ch.startDate ? ch.startDate : lastDay(ch)));
      }
      ref.current = ch;
      setC(ch);
    })();
    return () => { alive = false; };
  }, []));

  const update = useCallback((fn) => {
    const next = JSON.parse(JSON.stringify(ref.current));
    fn(next);
    ref.current = next;
    setC(next);
    saveChallenge(next);
  }, []);

  if (!c) return h(SafeArea, { style: S.flex });
  if (!c.startDate) return h(SafeArea, { style: S.flex }, h(Setup, { c, update, today }));

  const cw = currentWeek(c, today);
  const selWeek = week || cw;
  const selAWeek = aWeek || Math.max(1, today > c.startDate && dow(today) === 1 ? cw - 1 : cw);

  const TABS = [
    { id: 'dag', label: 'Dag' },
    { id: 'week', label: 'Week' },
    { id: 'plan', label: '90 dagen' },
    { id: 'analyse', label: 'Analyse' },
  ];

  let body;
  if (tab === 'dag') body = h(DayView, { c, update, entries, k: day, setDay, today, navigation, goWeek: (n) => { setWeek(n); setTab('week'); } });
  else if (tab === 'week') body = h(WeekView, { c, update, entries, n: selWeek, setN: setWeek, today });
  else if (tab === 'plan') body = h(PlanView, { c, update, entries, today, setTextModal });
  else body = h(AnalyseView, { c, entries, n: selAWeek, setN: setAWeek, today, banner, setTextModal });

  return h(SafeArea, { style: S.flex },
    h(View, { style: S.seg }, TABS.map((t) =>
      h(Touchable, { key: t.id, style: [S.segBtn, tab === t.id && S.segBtnOn], onPress: () => { setTab(t.id); if (t.id !== 'analyse') setBanner(null); } },
        h(Text, { style: [S.segText, tab === t.id && S.segTextOn] }, t.label)))),
    h(ScrollView, { style: S.flex, contentContainerStyle: S.content, keyboardShouldPersistTaps: 'handled' }, body),
    textModal ? h(View, { style: S.overlay },
      h(View, { style: S.overlayCard },
        h(Text, { style: S.cardTitle }, textModal.title),
        h(Text, { style: S.muted }, textModal.hint),
        h(Input, { style: S.bigText, multiline: true, value: textModal.text, onChangeText: textModal.onChange || (() => {}), editable: !!textModal.onChange, selectTextOnFocus: !textModal.onChange }),
        textModal.onSubmit ? h(Btn, { label: textModal.submitLabel || 'Opslaan', onPress: textModal.onSubmit }) : null,
        h(Btn, { label: 'Sluiten', kind: 'ghost', onPress: () => setTextModal(null) }))) : null);
}

// ---- Knop op het Vandaag-scherm --------------------------------------------
// Optionele ingang naar de challenge; het Rate My Day-formulier zelf blijft ongewijzigd.
function ChallengeButton() {
  const navigation = nav.useNavigation();
  const [sub, setSub] = useState('Optioneel · gewoonten afvinken en weekanalyse');
  nav.useFocusEffect(useCallback(() => {
    loadChallenge().then((ch) => {
      if (!ch.startDate) return;
      const t = dates.todayKey();
      if (t < ch.startDate) setSub(`Start ${dates.formatDateShortNL(ch.startDate)}`);
      else if (t > lastDay(ch)) setSub('Afgerond · bekijk je resultaten');
      else {
        const rec = ch.days[t];
        setSub(`Dag ${dayNo(ch, t)} van ${TOTAL_DAYS}${rec && Object.keys(rec).length ? ' · vandaag bijgewerkt' : ''}`);
      }
    });
  }, []));
  return h(Touchable, { style: S.entry, onPress: () => navigation.navigate('Challenge'), activeOpacity: 0.7 },
    h(Text, { style: S.entryIcon }, '🎯'),
    h(View, { style: { flex: 1 } },
      h(Text, { style: S.entryTitle }, '90 dagen challenge'),
      h(Text, { style: S.entrySub }, sub)),
    h(Text, { style: S.entryArrow }, '›'));
}

// ---- Eerste keer: challenge instellen -------------------------------------
function Setup({ c, update, today }) {
  const [start, setStart] = useState(mondayOf(today));
  const [bed, setBed] = useState(c.bedStart || '23:00');
  const ok = validKey(start) && parseTime(bed) != null;
  return h(ScrollView, { contentContainerStyle: S.content },
    h(Text, { style: S.h1 }, 'Mijn 90 dagen challenge'),
    h(Text, { style: S.lead }, 'Meer rust, discipline en focus. Bewuster leven en gestructureerd werken aan de groei van mezelf, mijn bedrijf en relaties.'),
    h(Card, { title: 'Instellen', emoji: '🚀' },
      h(Field, { label: 'Startdatum (dag 1)', hint: validKey(start) ? `Loopt t/m ${dates.formatDateNL(addDays(start, TOTAL_DAYS - 1))}` : 'Gebruik JJJJ-MM-DD' },
        h(Input, { style: S.input, value: start, onChangeText: setStart, maxLength: 10, placeholder: 'JJJJ-MM-DD' })),
      h(Field, { label: 'Mijn bedtijd-tijdvak begint om', hint: parseTime(bed) != null ? `Op tijd = tussen ${timeStr(parseTime(bed))} en ${timeStr(parseTime(bed) + 30)}` : 'Gebruik UU:MM, bijv. 23:00' },
        h(Input, { style: S.input, value: bed, onChangeText: setBed, maxLength: 5, placeholder: '23:00' })),
      h(Btn, { label: 'Start de challenge', onPress: () => { if (!ok) return window.alert('Controleer de startdatum en bedtijd.'); update((x) => { x.startDate = start; x.bedStart = bed; x.lastAnalysisWeek = Math.max(0, currentWeek(Object.assign({}, x, { startDate: start }), today) - 1); }); } })),
    h(Text, { style: S.muted }, 'Je kunt deze instellingen later nog aanpassen onder "90 dagen".'));
}

// ---- Dag ------------------------------------------------------------------
function DayView({ c, update, entries, k, setDay, today, navigation, goWeek }) {
  const rec = recOf(c, k) || {};
  const set = (field, value) => update((x) => { x.days[k] = Object.assign({}, x.days[k] || {}, { [field]: value }); });
  const n = weekNo(c, k);
  const ws = weekStats(c, n, entries, today);
  const row = (id) => ws.rows.find((x) => x.id === id);
  const entry = entries[k];
  const workday = isWorkday(k);
  const goals = rec.goals || [{}, {}, {}];
  const setGoal = (i, patch) => update((x) => {
    const r0 = x.days[k] = x.days[k] || {};
    const g = (r0.goals || [{}, {}, {}]).map((y) => Object.assign({}, y));
    g[i] = Object.assign({}, g[i], patch);
    r0.goals = g;
  });
  const bed = bedOk(c, rec);
  const [ws0, ws1] = bedWindow(c);
  const planned = isPlannedException(c, k);

  const checks = [
    rec.steps >= STEPS_GOAL, !!rec.meditate, bed === true || !!rec.flex, !!rec.phone, rec.sugar === 'none',
    rec.alcohol === false, rec.drugs === false, !!entry,
  ];
  if (workday) checks.push(!!rec.goalsSet);
  const doneCount = checks.filter(Boolean).length;

  const prev = k > c.startDate ? () => setDay(addDays(k, -1)) : null;
  const next = k < today && k < lastDay(c) ? () => setDay(addDays(k, 1)) : null;
  const beforeStart = today < c.startDate;

  return h(View, null,
    h(Nav, { label: (k === today ? 'Vandaag · ' : '') + cap(dates.formatDateNL(k)), sub: `Dag ${dayNo(c, k)} van ${TOTAL_DAYS} · week ${n}`, onPrev: prev, onNext: next }),
    beforeStart ? h(Text, { style: S.muted }, `De challenge start op ${dates.formatDateNL(c.startDate)}. Je kunt alvast rondkijken.`) : null,
    h(View, { style: S.progressWrap },
      h(Text, { style: S.progressText }, `${doneCount} van ${checks.length} dagdoelen afgevinkt`),
      h(Bar, { value: doneCount / checks.length, color: doneCount === checks.length ? '#10B981' : '#4F46E5' })),

    h(Card, { title: 'Lichaam en rust', emoji: '💪' },
      h(Field, { label: 'Sport vandaag', hint: `Deze week: ${row('sport').count}/4 trainingen` },
        h(Chips, { options: SPORTS, value: rec.sport, onChange: (v) => set('sport', v), multi: true })),
      h(Check, { label: '🧊 IJsbad', sub: `Deze week: ${row('ice').count}/3`, value: !!rec.ice, onChange: (v) => set('ice', v) }),
      h(Field, { label: '👟 Stappen', hint: rec.steps == null ? `Richtlijn: minimaal ${STEPS_GOAL.toLocaleString('nl-NL')}` : rec.steps >= STEPS_GOAL ? '✅ Richtlijn gehaald' : `Nog ${(STEPS_GOAL - rec.steps).toLocaleString('nl-NL')} te gaan` },
        h(Input, { style: S.input, keyboardType: 'number-pad', placeholder: 'bijv. 13200', value: rec.steps == null ? '' : String(rec.steps), onChangeText: (t) => { const v = t.replace(/\D/g, ''); set('steps', v === '' ? null : Number(v)); } })),
      h(Field, { label: '🍬 Toegevoegd suiker' }, h(Chips, { options: SUGAR, value: rec.sugar || null, onChange: (v) => set('sugar', v) })),
      h(Check, { label: '🧘 Gemediteerd', sub: `Deze week: ${row('meditate').count}/${row('meditate').target}`, value: !!rec.meditate, onChange: (v) => set('meditate', v) })),

    h(Card, { title: 'Slaap (deze avond)', emoji: '🌙' },
      h(Field, { label: '🛏️ Naar bed om', hint: bed == null ? `Tijdvak: ${timeStr(ws0)}–${timeStr(ws1)}` : bed ? `✅ Binnen je tijdvak (${timeStr(ws0)}–${timeStr(ws1)})` : `Buiten je tijdvak (${timeStr(ws0)}–${timeStr(ws1)})` },
        h(Input, { style: S.input, placeholder: 'UU:MM', maxLength: 5, value: rec.bed || '', onChangeText: (t) => set('bed', t) })),
      h(Check, { label: '🎉 Dit is mijn flexavond', sub: `Deze week gebruikt: ${row('flex').count}/1`, value: !!rec.flex, onChange: (v) => set('flex', v) }),
      h(Check, { label: '📵 Telefoon weggelegd, buiten handbereik', value: !!rec.phone, onChange: (v) => set('phone', v) })),

    h(Card, { title: 'Middelen', emoji: '🧭' },
      h(Field, { label: '🍷 Alcohol', hint: `Drinkmomenten deze week: ${row('alcohol').count}/1 max` },
        h(Chips, { options: YESNO, value: rec.alcohol == null ? null : rec.alcohol, onChange: (v) => set('alcohol', v) })),
      rec.alcohol === true ? h(Field, { label: 'Aantal glazen' }, h(Stepper, { value: rec.glasses, onChange: (v) => set('glasses', v), min: 0, max: 30 })) : null,
      rec.alcohol === true && row('alcohol').count > 1 ? h(Text, { style: S.warnText }, 'Let op: dit is meer dan één drinkmoment deze week.') : null,
      h(Field, { label: '💊 Drugs' }, h(Chips, { options: YESNO, value: rec.drugs == null ? null : rec.drugs, onChange: (v) => set('drugs', v) })),
      rec.drugs === true ? h(Text, { style: planned ? S.muted : S.warnText }, planned ? 'Dit is een vooraf vastgelegd uitzonderingsmoment.' : 'Dit moment was niet vooraf vastgelegd en telt als ongepland.') : null),

    h(Card, { title: workday ? 'Focus (werkdag)' : 'Focus (weekend, optioneel)', emoji: '🎯' },
      h(Check, { label: '3 doelen opgeschreven en de dag ermee begonnen', value: !!rec.goalsSet, onChange: (v) => set('goalsSet', v) }),
      [0, 1, 2].map((i) => h(View, { key: i, style: S.goalRow },
        h(Touchable, { style: [S.box, goals[i] && goals[i].done && S.boxOn], onPress: () => setGoal(i, { done: !(goals[i] && goals[i].done) }) },
          goals[i] && goals[i].done ? h(Text, { style: S.boxMark }, '✓') : null),
        h(Input, { style: [S.input, { flex: 1 }], placeholder: `Doel ${i + 1}: concreet resultaat`, value: (goals[i] && goals[i].t) || '', onChangeText: (t) => setGoal(i, { t }) }))),
      h(Field, { label: '📈 Focusblokken voor Scaling Up', hint: `Deze week: ${row('scaling').count}/2` },
        h(Stepper, { value: rec.scaling, onChange: (v) => set('scaling', v), max: 6 }))),

    h(Card, { title: 'Rate My Day', emoji: '⭐' },
      entry
        ? h(View, { style: S.rmdRow },
            h(View, { style: [S.scoreBadge, { backgroundColor: colors.scoreColor(entry.score) }] }, h(Text, { style: S.scoreBadgeText }, String(entry.score))),
            h(Text, { style: [S.muted, { flex: 1 }] }, `Ingevuld · energie ${entry.energy}/5 · ${fmt(entry.sleepHours)} u slaap`),
            h(Btn, { label: 'Bekijk', kind: 'ghost', onPress: () => navigation.navigate('EntryDetail', { date: k }) }))
        : h(Btn, { label: 'Rate My Day invullen', onPress: () => navigation.navigate('EntryDetail', { date: k }) })),

    dow(k) === 0 ? h(Card, { title: 'Mijn zondagse voortgangsmoment', emoji: '🗓️', tone: 'accent' },
      SUNDAY.map((s) => h(Check, {
        key: s.id, label: s.label, value: !!((c.weeks[n] || {}).sunday || {})[s.id],
        onChange: (v) => update((x) => { const w = x.weeks[n] = x.weeks[n] || {}; w.sunday = Object.assign({}, w.sunday || {}, { [s.id]: v }); }),
      })),
      n < TOTAL_WEEKS ? h(Btn, { label: `Plan week ${n + 1} (klus + 3 resultaten) →`, onPress: () => goWeek(n + 1) }) : null) : null);
}

// ---- Week -----------------------------------------------------------------
function WeekView({ c, update, entries, n, setN, today }) {
  const ws = weekStats(c, n, entries, today);
  const wk = c.weeks[n] || {};
  const setW = (patch) => update((x) => { x.weeks[n] = Object.assign({}, x.weeks[n] || {}, patch); });
  const results = wk.results || [{}, {}, {}];
  const setRes = (i, patch) => { const r2 = results.map((y) => Object.assign({}, y)); r2[i] = Object.assign({}, r2[i], patch); setW({ results: r2 }); };
  const phase = strategyPhase(n);
  const range = ws.days.length ? `${dayMonth(ws.days[0])} – ${dayMonth(ws.days[ws.days.length - 1])}` : '';
  const scoreAvg = avg(ws.scores.map((x) => x.e.score));

  return h(View, null,
    h(Nav, { label: `Week ${n} van ${TOTAL_WEEKS}`, sub: range + (ws.complete ? ' · afgerond' : ws.started ? ' · bezig' : ' · nog niet begonnen'), onPrev: n > 1 ? () => setN(n - 1) : null, onNext: n < TOTAL_WEEKS ? () => setN(n + 1) : null }),
    h(View, { style: S.scoreRow },
      h(View, { style: S.scoreCard }, h(Text, { style: S.scoreVal }, ws.consistency == null ? '–' : pct(ws.consistency)), h(Text, { style: S.scoreLbl }, 'consequent gehandeld')),
      h(View, { style: S.scoreCard }, h(Text, { style: S.scoreVal }, ws.results == null ? '–' : pct(ws.results)), h(Text, { style: S.scoreLbl }, 'resultaten behaald')),
      h(View, { style: S.scoreCard }, h(Text, { style: S.scoreVal }, fmt(scoreAvg)), h(Text, { style: S.scoreLbl }, 'gem. Rate My Day'))),

    h(Card, { title: 'Weekdoelen', emoji: '✅' },
      h(View, { style: S.dayHeader }, h(Text, { style: [S.rowLabel, { flex: 1 }] }, ''), h(View, { style: S.dots }, ws.days.map((k) => h(Text, { key: k, style: S.dayHeaderText }, shortDay(k).slice(0, 1)))), h(Text, { style: S.rowCount }, '')),
      ws.rows.map((x) => h(View, { key: x.id, style: S.targetRow },
        h(Text, { style: [S.rowLabel, { flex: 1 }] }, `${x.emoji} ${x.label}`),
        x.dots ? h(Dots, { dots: x.dots }) : h(View, { style: S.dots }),
        h(Text, { style: [S.rowCount, { color: x.soft ? '#6B7280' : STATUS_COLOR[x.status] }] }, `${x.count}/${x.type === 'max' ? '≤' + x.target : x.target}`)))),

    h(Card, { title: 'Uitgestelde klus van deze week', emoji: '🧹' },
      h(View, { style: S.goalRow },
        h(Touchable, { style: [S.box, wk.klusDone && S.boxOn], onPress: () => setW({ klusDone: !wk.klusDone }) }, wk.klusDone ? h(Text, { style: S.boxMark }, '✓') : null),
        h(Input, { style: [S.input, { flex: 1 }], placeholder: 'Kies op zondag één klus en maak hem volledig af', value: wk.klus || '', onChangeText: (t) => setW({ klus: t }) }))),

    h(Card, { title: '3 belangrijkste resultaten', emoji: '🏆' },
      [0, 1, 2].map((i) => h(View, { key: i, style: S.goalRow },
        h(Touchable, { style: [S.box, results[i] && results[i].done && S.boxOn], onPress: () => setRes(i, { done: !(results[i] && results[i].done) }) },
          results[i] && results[i].done ? h(Text, { style: S.boxMark }, '✓') : null),
        h(Input, { style: [S.input, { flex: 1 }], placeholder: `Resultaat ${i + 1}`, value: (results[i] && results[i].t) || '', onChangeText: (t) => setRes(i, { t }) })))),

    h(Card, { title: 'Strategie & Scaling Up', emoji: '🧩' },
      h(Text, { style: S.phaseTitle }, phase.title),
      h(Text, { style: S.muted }, phase.text),
      h(Text, { style: [S.muted, { marginTop: 6 }] }, `Focusblokken Scaling Up deze week: ${ws.rows.find((x) => x.id === 'scaling').count}/2`),
      n >= 5 ? h(Check, { label: 'Weekoverleg gehouden: voortgang, cijfers, knelpunten', sub: 'Afspraken vastgelegd en opgevolgd', value: !!wk.meeting, onChange: (v) => setW({ meeting: v }) }) : null,
      h(Check, { label: 'AI-plan: voortgang en besparingen bijgewerkt', value: !!wk.ai, onChange: (v) => setW({ ai: v }) }),
      h(Input, { style: [S.input, S.multi], multiline: true, placeholder: 'Notities (cijfers, besparingen, afspraken…)', value: wk.bizNote || '', onChangeText: (t) => setW({ bizNote: t }) })),

    h(Card, { title: 'Zondags voortgangsmoment', emoji: '🗓️' },
      SUNDAY.map((s) => h(Check, { key: s.id, label: s.label, value: !!(wk.sunday || {})[s.id], onChange: (v) => setW({ sunday: Object.assign({}, wk.sunday || {}, { [s.id]: v }) }) })),
      h(Field, { label: 'Wat ging goed?' }, h(Input, { style: [S.input, S.multi], multiline: true, value: wk.good || '', onChangeText: (t) => setW({ good: t }) })),
      h(Field, { label: 'Waar stuur ik bij?' }, h(Input, { style: [S.input, S.multi], multiline: true, value: wk.adjust || '', onChangeText: (t) => setW({ adjust: t }) }))));
}

// ---- 90 dagen -------------------------------------------------------------
function PlanView({ c, update, entries, today, setTextModal }) {
  const dn = Math.max(0, Math.min(TOTAL_DAYS, dayNo(c, today)));
  const cw = currentWeek(c, today);
  const [exDate, setExDate] = useState('');
  const [exNote, setExNote] = useState('');
  const [start, setStart] = useState(c.startDate);
  const [bed, setBed] = useState(c.bedStart);
  const groups = [];
  MILESTONES.forEach((m) => { let g = groups.find((x) => x.name === m.group); if (!g) groups.push(g = { name: m.group, items: [] }); g.items.push(m); });

  const allDays = Object.keys(c.days).filter((k) => k >= c.startDate && k <= today);
  const drinkDays = allDays.filter((k) => c.days[k].alcohol === true);
  const glasses = drinkDays.reduce((s, k) => s + (c.days[k].glasses || 0), 0);
  const drugDays = allDays.filter((k) => c.days[k].drugs === true);
  const unplanned = drugDays.filter((k) => !isPlannedException(c, k));

  const weeks = [];
  for (let n = 1; n <= cw; n++) weeks.push(weekStats(c, n, entries, today));
  const judgedWeeks = weeks.filter((w) => w.complete);
  const habitIds = ['sport', 'ice', 'steps', 'meditate', 'bed', 'phone', 'alcohol', 'goals', 'rmd', 'scaling', 'klus', 'sunday'];

  const addException = () => {
    if (!validKey(exDate)) return window.alert('Vul een geldige datum in (JJJJ-MM-DD).');
    if (exDate <= today) return window.alert('Uitzonderingen leg je vooraf vast: kies een datum na vandaag.');
    if ((c.exceptions || []).length >= 2) return window.alert('Je hebt al twee uitzonderingsmomenten vastgelegd. Twee is het maximum.');
    update((x) => { x.exceptions = (x.exceptions || []).concat({ date: exDate, note: exNote.trim(), plannedAt: today }); });
    setExDate(''); setExNote('');
  };

  const exportAll = () => {
    AsyncStorage.getItem('rate-my-day:entries').then((raw) => {
      const data = { challenge: c, entries: raw ? JSON.parse(raw) : {} };
      setTextModal({ title: 'Back-up', hint: 'Selecteer alles en kopieer. Bewaar dit ergens veilig, of plak het op een ander apparaat onder "Back-up terugzetten".', text: JSON.stringify(data) });
    });
  };
  const importAll = () => {
    let draft = '';
    const modal = {
      title: 'Back-up terugzetten', hint: 'Plak hier een eerder gemaakte back-up. Dit overschrijft je huidige challenge en Rate My Day-data.', text: '',
      submitLabel: 'Terugzetten',
    };
    modal.onChange = (t) => { draft = t; setTextModal(Object.assign({}, modal, { text: t })); };
    modal.onSubmit = async () => {
      try {
        const data = JSON.parse(draft);
        if (!data || typeof data !== 'object' || !data.challenge) throw new Error('geen challenge');
        if (!window.confirm('Weet je het zeker? Je huidige data wordt overschreven.')) return;
        await AsyncStorage.setItem('rate-my-day:entries', JSON.stringify(data.entries || {}));
        update((x) => { Object.keys(x).forEach((key) => delete x[key]); Object.assign(x, emptyChallenge(), data.challenge); });
        setTextModal(null);
        window.alert('Back-up teruggezet.');
      } catch (err) {
        window.alert('Ongeldige back-up. Controleer of je de volledige tekst hebt geplakt.');
      }
    };
    setTextModal(modal);
  };

  return h(View, null,
    h(Card, { title: 'Mijn doel', emoji: '🧭', tone: 'accent' },
      h(Text, { style: S.quote }, 'Meer rust, discipline en focus. Bewuster leven en gestructureerd werken aan de groei van mezelf, mijn bedrijf en relaties.'),
      h(Text, { style: [S.muted, { marginTop: 10 }] }, `Dag ${Math.max(dn, 0)} van ${TOTAL_DAYS} · week ${cw} van ${TOTAL_WEEKS}`),
      h(Bar, { value: dn / TOTAL_DAYS })),

    h(Card, { title: 'Gewoonten per week', emoji: '📊', right: judgedWeeks.length ? `${judgedWeeks.length} ${judgedWeeks.length === 1 ? 'week' : 'weken'} afgerond` : 'nog geen afgeronde week' },
      judgedWeeks.length === 0 ? h(Text, { style: S.muted }, 'Na je eerste volledige week zie je hier per gewoonte in hoeveel weken je je afspraak hebt gehaald.') :
      habitIds.map((id) => {
        const rowsFor = judgedWeeks.map((w) => w.rows.find((x) => x.id === id));
        const ok = rowsFor.filter((x) => x.status === 'ok').length;
        return h(View, { key: id, style: S.targetRow },
          h(Text, { style: [S.rowLabel, { flex: 1 }] }, `${rowsFor[0].emoji} ${rowsFor[0].label}`),
          h(View, { style: S.dots }, rowsFor.map((x, i) => h(View, { key: i, style: [S.dot, { backgroundColor: x.status === 'ok' ? '#10B981' : '#FCA5A5' }] }))),
          h(Text, { style: S.rowCount }, `${ok}/${rowsFor.length}`));
      })),

    groups.map((g) => h(Card, { key: g.name, title: g.name, emoji: g.name === 'Nieuwe coach' ? '🤝' : g.name === 'Zakelijk' ? '💼' : '🧩' },
      g.items.map((m) => {
        const st = c.milestones[m.id] || {};
        const late = !st.done && cw > m.week && m.week < TOTAL_WEEKS;
        const dueNow = !st.done && cw === m.week;
        return h(View, { key: m.id, style: S.milestone },
          h(Check, {
            label: m.title, sub: st.done ? `Afgerond${st.doneOn ? ' op ' + dayMonth(st.doneOn) : ''}` : late ? `⚠️ Deadline was week ${m.week}` : dueNow ? `⏳ Deadline: deze week (week ${m.week})` : m.week === TOTAL_WEEKS ? 'Uiterlijk einde van de 90 dagen' : `Deadline: week ${m.week}`,
            value: !!st.done, onChange: (v) => update((x) => { x.milestones[m.id] = Object.assign({}, x.milestones[m.id] || {}, { done: v, doneOn: v ? today : null }); }),
          }),
          h(Input, { style: [S.input, S.small], placeholder: 'Notitie (optioneel)', value: st.note || '', onChangeText: (t) => update((x) => { x.milestones[m.id] = Object.assign({}, x.milestones[m.id] || {}, { note: t }); }) }));
      }))),

    h(Card, { title: 'Middelen over 90 dagen', emoji: '🧭' },
      h(Text, { style: S.phaseTitle }, 'Drugs: uitzonderingsmomenten (max. 2, vooraf vastgelegd)'),
      (c.exceptions || []).length === 0 ? h(Text, { style: S.muted }, 'Nog geen uitzonderingen vastgelegd. Twee is een maximum, geen doel.') : null,
      (c.exceptions || []).map((x, i) => h(View, { key: i, style: S.exRow },
        h(Text, { style: [S.rowLabel, { flex: 1 }] }, `${dates.formatDateShortNL(x.date)}${x.note ? ' · ' + x.note : ''}${x.date < today ? (drugDays.includes(x.date) ? ' · gebruikt' : ' · niet gebruikt') : ''}`),
        x.date > today ? h(Touchable, { onPress: () => { if (window.confirm('Dit uitzonderingsmoment verwijderen?')) update((y) => { y.exceptions = y.exceptions.filter((_z, j) => j !== i); }); } }, h(Text, { style: S.link }, 'verwijder')) : null)),
      (c.exceptions || []).length < 2 ? h(View, null,
        h(View, { style: S.exForm },
          h(Input, { style: [S.input, { flex: 1, minWidth: 0 }], placeholder: 'JJJJ-MM-DD', maxLength: 10, value: exDate, onChangeText: setExDate }),
          h(Input, { style: [S.input, { flex: 1, minWidth: 0 }], placeholder: 'Gelegenheid', value: exNote, onChangeText: setExNote })),
        h(Btn, { label: 'Uitzondering vooraf vastleggen', kind: 'ghost', onPress: addException })) : null,
      h(Text, { style: [S.muted, { marginTop: 10 }] }, `Drugs gebruikt: ${drugDays.length}× · waarvan ongepland: ${unplanned.length}×`),
      h(Text, { style: S.muted }, `Alcohol: ${drinkDays.length} drinkmomenten · ${glasses} glazen in totaal${drinkDays.length ? ' · gem. ' + fmt(glasses / drinkDays.length) + ' per keer' : ''}`),
      h(Text, { style: S.muted }, `Weken met meer dan één drinkmoment: ${weeks.filter((w) => w.rows.find((x) => x.id === 'alcohol').count > 1).length}`)),

    h(Card, { title: 'Instellingen challenge', emoji: '⚙️' },
      h(Field, { label: 'Startdatum (dag 1)' }, h(Input, { style: S.input, value: start, onChangeText: setStart, maxLength: 10 })),
      h(Field, { label: 'Bedtijd-tijdvak begint om', hint: parseTime(bed) != null ? `Op tijd = ${timeStr(parseTime(bed))}–${timeStr(parseTime(bed) + 30)}` : 'Gebruik UU:MM' },
        h(Input, { style: S.input, value: bed, onChangeText: setBed, maxLength: 5 })),
      h(Btn, { label: 'Opslaan', kind: 'ghost', onPress: () => { if (!validKey(start) || parseTime(bed) == null) return window.alert('Controleer de datum en tijd.'); update((x) => { x.startDate = start; x.bedStart = bed; }); window.alert('Opgeslagen.'); } })),

    h(Card, { title: 'Back-up', emoji: '💾' },
      h(Text, { style: S.muted }, 'Je data staat alleen in deze browser. Maak af en toe een back-up, bijvoorbeeld op zondag.'),
      h(View, { style: S.btnRow },
        h(View, { style: { flex: 1 } }, h(Btn, { label: 'Back-up maken', kind: 'ghost', onPress: exportAll })),
        h(View, { style: { flex: 1 } }, h(Btn, { label: 'Terugzetten', kind: 'ghost', onPress: importAll })))),

    h(Card, { title: 'Mijn uitgangspunt', emoji: '🤝' },
      h(Text, { style: S.quote }, 'Ik houd mijn voortgang eerlijk bij. Een gemiste afspraak is aanleiding om bij te sturen en direct te hervatten. Ik beoordeel mezelf op consequent handelen én op de resultaten die ik bereik.')));
}

// ---- Analyse --------------------------------------------------------------
function AnalyseView({ c, entries, n, setN, today, banner, setTextModal }) {
  const [showAll, setShowAll] = useState(false);
  const cw = currentWeek(c, today);
  const ws = weekStats(c, n, entries, today);
  const prev = n > 1 ? weekStats(c, n - 1, entries, today) : null;
  const weekEnd = ws.days[ws.days.length - 1];
  const A = useMemo(() => analyse(c, entries, today, weekEnd), [c, entries, today, weekEnd]);

  const sAvg = avg(ws.scores.map((x) => x.e.score));
  const pAvg = prev ? avg(prev.scores.map((x) => x.e.score)) : null;
  const eAvg = avg(ws.scores.map((x) => x.e.energy));
  const slAvg = avg(ws.scores.map((x) => x.e.sleepHours).filter((x) => x != null));
  const best = ws.scores.slice().sort((a, b) => b.e.score - a.e.score)[0];
  const worst = ws.scores.slice().sort((a, b) => a.e.score - b.e.score)[0];

  const missed = ws.rows.filter((x) => x.status === 'fail' && !x.soft);
  const sugarRow = ws.rows.find((x) => x.id === 'sugar');
  const hit = ws.rows.filter((x) => x.status === 'ok' && !x.soft);
  const pending = ws.rows.filter((x) => x.status === 'pending' && !x.soft);
  const lateMs = MILESTONES.filter((m) => !(c.milestones[m.id] || {}).done && m.week <= n && m.week < TOTAL_WEEKS);
  const nextMs = MILESTONES.filter((m) => !(c.milestones[m.id] || {}).done && m.week === n + 1);

  // Wat gebeurt er in de dagen na alcohol / drugs?
  const curve = (fid) => {
    const res = A.curves[fid + ':score'] || [];
    const e = A.curves[fid + ':energy'] || [];
    if (!res.some((x) => x.nWith > 0)) return null;
    const base = res.find((x) => x.withoutMean != null);
    return { score: res, energy: e, base: base ? base.withoutMean : null, baseE: (e.find((x) => x.withoutMean != null) || {}).withoutMean, n: res[0] ? res[0].nWith : 0 };
  };
  const curves = [{ id: 'alcohol', label: '🍷 Na alcohol' }, { id: 'drugs', label: '💊 Na drugs' }].map((x) => Object.assign(x, { data: curve(x.id) })).filter((x) => x.data);

  const buildClaudeText = () => {
    const lines = [];
    lines.push('Hieronder staat de data van mijn 90-dagen challenge (Rate My Day + gewoonten).');
    lines.push(`Analyseer week ${n} en de trend tot nu toe: wat valt op, welke verbanden zie je (vooral: hoe voel ik me in de dagen na alcohol of drugs, en wat doen sport, slaap, meditatie en telefoon met mijn cijfer/energie), waar haal ik mijn afspraken wel en niet, en waar moet ik concreet bijsturen voor komende week? Wees eerlijk en direct.`);
    lines.push('');
    lines.push('MIJN PLAN: meer rust, discipline en focus. Afspraken: 4x/week sporten (gym, hardlopen, boksen) + 3x ijsbad; dagelijks wandelen min. 12.500 stappen; zo min mogelijk toegevoegd suiker; min. 6x/week mediteren; 6 avonden/week binnen een tijdvak van 30 min naar bed (1 flexavond); geen telefoon in bed; geen drugs behalve max. 2 vooraf vastgelegde uitzonderingen in 90 dagen; max. 1x/week gedoseerd alcohol (niet opsparen); elke werkdag de dag beginnen met 3 doelen; elke week 1 uitgestelde klus afronden; dagelijks Rate My Day; nieuwe coach (wk2 wat zoek ik, wk4 kennismakingen, wk6 gekozen); Scaling Up (wk1-2 richting, wk3-4 vertalen, wk5-8 ritme, wk9-13 borgen, 2 focusblokken/week); AI-implementatieplan met besparingen.');
    lines.push(`Bedtijd-tijdvak: ${timeStr(bedWindow(c)[0])}–${timeStr(bedWindow(c)[1])}. Start: ${c.startDate}.`);
    lines.push('');
    lines.push('WEEKOVERZICHT:');
    for (let i = 1; i <= Math.min(cw, TOTAL_WEEKS); i++) {
      const w = weekStats(c, i, entries, today);
      lines.push(`Week ${i}${w.complete ? '' : ' (bezig)'}: consequent ${w.consistency == null ? '-' : pct(w.consistency)}, resultaten ${w.results == null ? '-' : pct(w.results)}, gem. cijfer ${fmt(avg(w.scores.map((x) => x.e.score)))} | ` + w.rows.map((x) => `${x.label} ${x.count}/${x.type === 'max' ? '≤' : ''}${x.target}`).join(', '));
    }
    lines.push('');
    lines.push('DATA (JSON, per dag: Rate My Day-entry en challenge-afvinklijst):');
    const days = {};
    for (let k = c.startDate; k <= today && dayNo(c, k) <= TOTAL_DAYS; k = addDays(k, 1)) {
      const e = entries[k];
      days[k] = { rmd: e ? { score: e.score, mood: e.mood, energy: e.energy, sleepHours: e.sleepHours, sport: e.exerciseScore, productivity: e.productivity, note: e.note || undefined } : null, challenge: c.days[k] || null };
    }
    lines.push(JSON.stringify({ days, weeks: c.weeks, milestones: c.milestones, drugExceptions: c.exceptions }));
    return lines.join('\n');
  };

  return h(View, null,
    banner ? h(View, { style: S.banner }, h(Text, { style: S.bannerText }, '👋 ' + banner)) : null,
    h(Nav, { label: `Analyse week ${n}`, sub: ws.complete ? 'afgeronde week' : ws.started ? 'week is nog bezig' : 'nog niet begonnen', onPrev: n > 1 ? () => setN(n - 1) : null, onNext: n < cw ? () => setN(n + 1) : null }),

    h(Card, { title: 'In het kort', emoji: '📝' },
      h(View, { style: S.scoreRow },
        h(View, { style: S.scoreCard }, h(Text, { style: S.scoreVal }, ws.consistency == null ? '–' : pct(ws.consistency)), h(Text, { style: S.scoreLbl }, 'consequent'), prev && prev.consistency != null && ws.consistency != null ? h(Text, { style: S.delta }, signed((ws.consistency - prev.consistency) * 100, 0) + '%') : null),
        h(View, { style: S.scoreCard }, h(Text, { style: S.scoreVal }, ws.results == null ? '–' : pct(ws.results)), h(Text, { style: S.scoreLbl }, 'resultaten'), prev && prev.results != null && ws.results != null ? h(Text, { style: S.delta }, signed((ws.results - prev.results) * 100, 0) + '%') : null),
        h(View, { style: S.scoreCard }, h(Text, { style: S.scoreVal }, fmt(sAvg)), h(Text, { style: S.scoreLbl }, 'gem. cijfer'), pAvg != null && sAvg != null ? h(Text, { style: S.delta }, signed(sAvg - pAvg)) : null)),
      ws.scores.length === 0 ? h(Text, { style: S.muted }, 'Nog geen Rate My Day-scores in deze week.') :
      h(Text, { style: S.para }, [
        `Je vulde Rate My Day ${ws.scores.length} van ${ws.days.filter((k) => k <= today).length} dagen in, gemiddeld een ${fmt(sAvg)}`,
        pAvg != null ? ` (vorige week ${fmt(pAvg)})` : '',
        `. Energie gemiddeld ${fmt(eAvg)}/5`,
        slAvg != null ? `, slaap ${fmt(slAvg)} uur per nacht` : '',
        '. ',
        best && worst && best.k !== worst.k ? `Beste dag: ${longDay(best.k)} (${best.e.score}). Zwaarste dag: ${longDay(worst.k)} (${worst.e.score}).` : '',
      ].join('')),
      h(Text, { style: S.para }, `Weekresultaten: ${ws.resultsDone}/3 resultaten gehaald, uitgestelde klus ${ws.wk.klusDone ? 'afgerond' : 'niet afgerond'}, ${ws.goalsDone} van ${ws.goalsPlanned} dagdoelen gehaald.`)),

    h(Card, { title: 'Afspraken', emoji: '✅' },
      hit.length ? h(Text, { style: S.okText }, 'Gehaald: ' + hit.map((x) => `${x.label.toLowerCase()} (${x.count})`).join(', ') + '.') : null,
      missed.length ? h(Text, { style: S.failText }, 'Niet gehaald: ' + missed.map((x) => `${x.label.toLowerCase()} (${x.count}/${x.type === 'max' ? '≤' : ''}${x.target})`).join(', ') + '.') : h(Text, { style: S.okText }, ws.complete ? 'Alle afspraken gehaald. Sterk!' : 'Nog niets gemist deze week.'),
      sugarRow.status !== 'future' ? h(Text, { style: S.muted }, `Dagen zonder toegevoegd suiker: ${sugarRow.count} van ${ws.days.filter((k) => k <= today).length}.`) : null,
      pending.length && !ws.complete ? h(Text, { style: S.muted }, 'Nog open: ' + pending.map((x) => `${x.label.toLowerCase()} (${x.count}/${x.target})`).join(', ') + '.') : null),

    missed.length || lateMs.length ? h(Card, { title: 'Bijsturen voor komende week', emoji: '🔧', tone: 'warn' },
      missed.map((x) => h(Text, { key: x.id, style: S.bullet }, `• ${x.emoji} ${ADVICE[x.id] || ''}`)),
      lateMs.map((m) => h(Text, { key: m.id, style: S.bullet }, `• ⚠️ Mijlpaal over de deadline (week ${m.week}): ${m.title}.`))) : null,
    nextMs.length ? h(Card, { title: 'Volgende week op de planning', emoji: '📌' },
      nextMs.map((m) => h(Text, { key: m.id, style: S.bullet }, `• ${m.title} (${m.group})`))) : null,

    h(Card, { title: 'Alcohol en drugs: de dagen erna', emoji: '🔍' },
      curves.length === 0 ? h(Text, { style: S.muted }, 'Nog geen alcohol of drugs geregistreerd in de challenge. Zodra dat wel zo is, zie je hier hoe je cijfer en energie zich de dagen erna ontwikkelen, vergeleken met "schone" dagen.') :
      curves.map((cv) => h(View, { key: cv.id, style: { marginBottom: 12 } },
        h(Text, { style: S.phaseTitle }, `${cv.label} (${cv.data.n}× gemeten)`),
        h(View, { style: S.curve },
          cv.data.score.map((x) => h(View, { key: x.L, style: S.curveCol },
            h(Text, { style: S.curveLbl }, x.L === 0 ? 'die dag' : `+${x.L} dag`),
            h(Text, { style: [S.curveVal, x.withMean != null && cv.data.base != null && { color: x.withMean < cv.data.base - 0.3 ? '#EF4444' : x.withMean > cv.data.base + 0.3 ? '#10B981' : '#111827' }] }, fmt(x.withMean)),
            h(Text, { style: S.curveSub }, `energie ${fmt((cv.data.energy.find((y) => y.L === x.L) || {}).withMean)}`))),
          h(View, { style: [S.curveCol, S.curveBase] },
            h(Text, { style: S.curveLbl }, 'normaal'),
            h(Text, { style: S.curveVal }, fmt(cv.data.base)),
            h(Text, { style: S.curveSub }, `energie ${fmt(cv.data.baseE)}`))),
        cv.data.n < 3 ? h(Text, { style: S.muted }, 'Nog weinig metingen, dus nog indicatief.') : null))),

    h(Card, { title: 'Wat opvalt', emoji: '💡', right: `${A.entryDays} dagen data` },
      A.highlights.length === 0 ? h(Text, { style: S.muted }, 'Nog te weinig data voor betrouwbare verbanden. Na één à twee weken consequent afvinken én Rate My Day invullen verschijnen hier de patronen.') :
      A.highlights.map((x, i) => { const t = insightText(x); return h(View, { key: i, style: S.insight },
        h(Text, { style: [S.insightTitle, { color: t.good ? '#047857' : '#B91C1C' }] }, (t.good ? '▲ ' : '▼ ') + t.title),
        h(Text, { style: S.muted }, t.body)); }),
      A.solid.length ? h(Touchable, { onPress: () => setShowAll(!showAll) }, h(Text, { style: [S.link, { marginTop: 8 }] }, showAll ? 'Verberg alle verbanden' : `Toon alle ${A.solid.length} gemeten verbanden`)) : null,
      showAll ? A.solid.slice().sort((a, b) => Math.abs(b.norm) - Math.abs(a.norm)).map((x, i) => h(Text, { key: i, style: S.allRow },
        `${x.f.when} → ${x.m.label} ${LAG[x.L]}: ${fmt(x.withMean)} vs ${fmt(x.withoutMean)} (${signed(x.diff)}; ${x.nWith}× / ${x.nWithout}×)`)) : null),

    h(Card, { title: 'Trend', emoji: '📈' },
      Array.from({ length: cw }, (_x, i) => i + 1).map((i) => {
        const w = weekStats(c, i, entries, today);
        const s = avg(w.scores.map((x) => x.e.score));
        return h(View, { key: i, style: S.trendRow },
          h(Text, { style: S.trendLbl }, `Wk ${i}`),
          h(View, { style: { flex: 1 } },
            h(Bar, { value: s == null ? 0 : s / 10, color: s == null ? '#E5E7EB' : colors.scoreColor(s) }),
            h(Bar, { value: w.consistency || 0, color: '#4F46E5' })),
          h(Text, { style: S.trendVal }, `${fmt(s)} · ${w.consistency == null ? '–' : pct(w.consistency)}`));
      }),
      h(Text, { style: S.muted }, 'Bovenste balk: gemiddeld cijfer. Onderste balk: consequent gehandeld.')),

    h(Card, { title: 'Diepere analyse door Claude', emoji: '🤖' },
      h(Text, { style: S.muted }, 'Kopieer al je data met je plan en een analysevraag, en plak het in een gesprek met Claude voor een uitgebreide analyse.'),
      h(Btn, { label: 'Kopieer voor Claude', onPress: () => copyText(buildClaudeText(), (text) => setTextModal({ title: 'Kopieer deze tekst', hint: 'Kopiëren lukte niet automatisch. Selecteer alles en kopieer handmatig.', text })) })));
}

// ---------------------------------------------------------------------------
const S = StyleSheet.create({
  entry: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 14, marginBottom: 2, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#EEF2FF', borderRadius: 12, borderWidth: 1, borderColor: '#C7D2FE' },
  entryIcon: { fontSize: 20, marginRight: 10 },
  entryTitle: { fontSize: 15, fontWeight: '700', color: '#312E81' },
  entrySub: { fontSize: 12, color: '#6366F1', marginTop: 1 },
  entryArrow: { fontSize: 24, color: '#4F46E5', fontWeight: '700', marginLeft: 8 },
  flex: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 60 },
  h1: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 6 },
  lead: { fontSize: 15, color: '#374151', lineHeight: 21, marginBottom: 16 },
  seg: { flexDirection: 'row', margin: 12, marginBottom: 0, backgroundColor: '#EEF2FF', borderRadius: 10, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segBtnOn: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  segText: { fontSize: 13, fontWeight: '600', color: '#6366F1' },
  segTextOn: { color: '#312E81' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardAccent: { borderColor: '#C7D2FE', backgroundColor: '#F5F7FF' },
  cardWarn: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827' },
  cardRight: { fontSize: 12, color: '#6B7280' },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: '#C7D2FE', alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: '#FFFFFF' },
  boxOn: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  boxMark: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  checkLabel: { fontSize: 15, color: '#111827' },
  checkLabelOn: { color: '#312E81', fontWeight: '600' },
  checkSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' },
  chipOn: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  chipText: { fontSize: 14, color: '#374151' },
  chipTextOn: { color: '#FFFFFF', fontWeight: '600' },
  field: { paddingVertical: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  fieldHint: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, backgroundColor: '#FFFFFF', color: '#111827' },
  multi: { minHeight: 64, textAlignVertical: 'top', marginTop: 8 },
  small: { fontSize: 13, paddingVertical: 6, marginLeft: 38, marginBottom: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, color: '#4F46E5', fontWeight: '700' },
  stepVal: { minWidth: 40, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#111827' },
  goalRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 5 },
  bar: { height: 8, borderRadius: 4, backgroundColor: '#EEF2FF', overflow: 'hidden', marginVertical: 3 },
  barFill: { height: 8, borderRadius: 4 },
  progressWrap: { marginBottom: 12, paddingHorizontal: 4 },
  progressText: { fontSize: 13, color: '#4B5563', marginBottom: 4 },
  btn: { backgroundColor: '#4F46E5', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center', marginTop: 8 },
  btnGhost: { backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE' },
  btnDanger: { backgroundColor: '#EF4444' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  btnGhostText: { color: '#4F46E5' },
  btnRow: { flexDirection: 'row', gap: 10 },
  navRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  navBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  navBtnOff: { opacity: 0.3 },
  navBtnText: { fontSize: 22, color: '#4F46E5', fontWeight: '700', marginTop: -2 },
  navTitle: { fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center' },
  navSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  muted: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  para: { fontSize: 14, color: '#374151', lineHeight: 20, marginTop: 8 },
  warnText: { fontSize: 13, color: '#B45309', marginTop: 4 },
  okText: { fontSize: 14, color: '#047857', lineHeight: 20, marginBottom: 6 },
  failText: { fontSize: 14, color: '#B91C1C', lineHeight: 20, marginBottom: 6 },
  bullet: { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 6 },
  link: { color: '#4F46E5', fontWeight: '600', fontSize: 13 },
  quote: { fontSize: 14, color: '#312E81', lineHeight: 20, fontStyle: 'italic' },
  phaseTitle: { fontSize: 14, fontWeight: '700', color: '#312E81', marginBottom: 4 },
  rmdRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  scoreBadgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  scoreRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  scoreCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  scoreVal: { fontSize: 19, fontWeight: '700', color: '#111827' },
  scoreLbl: { fontSize: 11, color: '#6B7280', marginTop: 2, textAlign: 'center' },
  delta: { fontSize: 11, color: '#4F46E5', marginTop: 2, fontWeight: '600' },
  targetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowLabel: { fontSize: 13, color: '#111827' },
  rowCount: { width: 44, textAlign: 'right', fontSize: 13, fontWeight: '700' },
  dayHeader: { flexDirection: 'row', alignItems: 'center' },
  dayHeaderText: { width: 10, fontSize: 9, color: '#9CA3AF', textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 4, marginHorizontal: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  milestone: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 4 },
  exRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  exForm: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 6 },
  banner: { backgroundColor: '#4F46E5', borderRadius: 12, padding: 12, marginBottom: 12 },
  bannerText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  curve: { flexDirection: 'row', gap: 6, marginVertical: 6 },
  curveCol: { flex: 1, alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 8, paddingVertical: 8 },
  curveBase: { backgroundColor: '#EEF2FF' },
  curveLbl: { fontSize: 11, color: '#6B7280' },
  curveVal: { fontSize: 17, fontWeight: '700', color: '#111827', marginVertical: 2 },
  curveSub: { fontSize: 10, color: '#6B7280' },
  insight: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  insightTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  allRow: { fontSize: 12, color: '#374151', paddingVertical: 3 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  trendLbl: { width: 40, fontSize: 12, color: '#6B7280' },
  trendVal: { width: 78, fontSize: 12, color: '#374151', textAlign: 'right' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  overlayCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, maxHeight: '90%' },
  bigText: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 11, fontFamily: 'monospace', height: 260, marginTop: 10, color: '#111827' },
});
