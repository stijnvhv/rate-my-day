// Zet het 90-dagen-challenge-tabblad in de gebouwde Expo-bundel.
// Gebruik: node challenge/inject.mjs   (idempotent: kan na elke wijziging opnieuw draaien)
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsDir = join(root, '_expo/static/js/web');
const bundles = readdirSync(jsDir).filter((f) => /^index-[0-9a-f]+\.js$/.test(f));
if (bundles.length !== 1) throw new Error(`Verwacht precies één bundel, gevonden: ${bundles.join(', ')}`);
const oldName = bundles[0];
let src = readFileSync(join(jsDir, oldName), 'utf8');

const MODULE_ID = 676;
const START = '/*challenge-module:start*/';
const END = '/*challenge-module:end*/';
// react, StyleSheet, Text, View, ScrollView, @react-navigation/native, TextInput,
// TouchableOpacity, AsyncStorage, entries-storage, date-utils, scoreColor, SafeAreaView
const DEPS = [36, 44, 266, 309, 335, 150, 437, 505, 511, 510, 517, 529, 501];

// 1. Eventuele oude versie van de module verwijderen en de nieuwe toevoegen vóór de entry-calls.
let lines = src.split('\n');
const s0 = lines.findIndex((l) => l.includes(START));
if (s0 >= 0) {
  const s1 = lines.findIndex((l, i) => i >= s0 && l.includes(END));
  if (s1 < 0) throw new Error('Eindmarkering van de challenge-module ontbreekt');
  lines.splice(s0, s1 - s0 + 1);
}
if (lines.some((l) => l.includes(`},${MODULE_ID},[`))) throw new Error(`Module-id ${MODULE_ID} is al in gebruik`);
const body = readFileSync(join(root, 'challenge/challenge-screen.js'), 'utf8');
const moduleSrc = `__d(function(g,r,i,a,m,_e,d){${START}\n${body}\n},${MODULE_ID},${JSON.stringify(DEPS)});${END}`;
const firstRun = lines.findIndex((l) => l.startsWith('__r('));
if (firstRun < 0) throw new Error('Geen __r( entry gevonden');
lines.splice(firstRun, 0, ...moduleSrc.split('\n'));
src = lines.join('\n');

// 2. Tab toevoegen aan de tab-navigator (module 452).
const TAB_DEPS_OLD = '},452,[36,266,453,500,518,530,147]);';
const TAB_DEPS_NEW = `},452,[36,266,453,500,518,530,147,${MODULE_ID}]);`;
if (!src.includes(TAB_DEPS_NEW)) {
  if (!src.includes(TAB_DEPS_OLD)) throw new Error('Tab-navigator (module 452) niet gevonden');
  const SETTINGS = '(0,s.jsx)(u.Screen,{name:"Settings"';
  const TAB = '(0,s.jsx)(u.Screen,{name:"Challenge",component:e(r(d[7])).default,options:{title:\'90 dagen\',tabBarIcon:({color:e})=>(0,s.jsx)(t.default,{style:{fontSize:20,color:e},children:"\\ud83c\\udfaf"})}}),';
  const idx = src.indexOf(SETTINGS);
  if (idx < 0) throw new Error('Settings-tab niet gevonden');
  src = src.slice(0, idx) + TAB + src.slice(idx);
  src = src.replace(TAB_DEPS_OLD, TAB_DEPS_NEW);
}

// 3. Wegschrijven onder een nieuwe hash-naam en index.html bijwerken (cache-busting).
const hash = createHash('md5').update(src).digest('hex');
const newName = `index-${hash}.js`;
writeFileSync(join(jsDir, newName), src);
if (newName !== oldName) unlinkSync(join(jsDir, oldName));
const htmlPath = join(root, 'index.html');
const html = readFileSync(htmlPath, 'utf8');
if (!html.includes(oldName)) throw new Error('Bundelnaam niet gevonden in index.html');
writeFileSync(htmlPath, html.replace(oldName, newName));
console.log(`Klaar: ${oldName} -> ${newName}`);
