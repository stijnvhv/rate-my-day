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

// 2. Eerdere versie met een eigen tabblad terugdraaien: de tab-navigator (module 452) blijft origineel.
const TAB_DEPS_ORIG = '},452,[36,266,453,500,518,530,147]);';
const TAB_DEPS_PATCHED = `},452,[36,266,453,500,518,530,147,${MODULE_ID}]);`;
const TAB = '(0,s.jsx)(u.Screen,{name:"Challenge",component:e(r(d[7])).default,options:{title:\'90 dagen\',tabBarIcon:({color:e})=>(0,s.jsx)(t.default,{style:{fontSize:20,color:e},children:"\\ud83c\\udfaf"})}}),';
src = src.replace(TAB, '').replace(TAB_DEPS_PATCHED, TAB_DEPS_ORIG);

// 3. Challenge als los scherm in de root-stack (module 313), naast EntryDetail; met terugknop in de header.
const STACK_DEPS_OLD = '},313,[36,314,452,675,517,147]);';
const STACK_DEPS_NEW = `},313,[36,314,452,675,517,147,${MODULE_ID}]);`;
if (!src.includes(STACK_DEPS_NEW)) {
  const END_STACK = ']})}},313,[';
  if (!src.includes(STACK_DEPS_OLD) || src.split(END_STACK).length !== 2) throw new Error('Root-stack (module 313) niet gevonden');
  const SCREEN = `,(0,c.jsx)(s.Screen,{name:"Challenge",component:e(r(d[6])).default,options:{title:'90 dagen challenge'}})`;
  src = src.replace(END_STACK, SCREEN + END_STACK).replace(STACK_DEPS_OLD, STACK_DEPS_NEW);
}

// 4. Knop bovenaan het Vandaag-scherm (module 500); het formulier eronder blijft ongewijzigd.
const TODAY_OLD = 'function f(){return(0,l.jsx)(t.default,{style:o.flex,children:(0,l.jsx)(n.default,{})})}const o=u.default.create({flex:{flex:1,backgroundColor:\'#F9FAFB\'}})},500,[36,501,44,502,147]);';
const TODAY_NEW = `function f(){return(0,l.jsxs)(t.default,{style:o.flex,children:[(0,l.jsx)(r(d[5]).ChallengeButton,{}),(0,l.jsx)(n.default,{})]})}const o=u.default.create({flex:{flex:1,backgroundColor:'#F9FAFB'}})},500,[36,501,44,502,147,${MODULE_ID}]);`;
if (!src.includes(TODAY_NEW)) {
  if (!src.includes(TODAY_OLD)) throw new Error('Vandaag-scherm (module 500) niet gevonden');
  src = src.replace(TODAY_OLD, TODAY_NEW);
}

// 5. Wegschrijven onder een nieuwe hash-naam en index.html bijwerken (cache-busting).
const hash = createHash('md5').update(src).digest('hex');
const newName = `index-${hash}.js`;
writeFileSync(join(jsDir, newName), src);
if (newName !== oldName) unlinkSync(join(jsDir, oldName));
const htmlPath = join(root, 'index.html');
const html = readFileSync(htmlPath, 'utf8');
if (!html.includes(oldName)) throw new Error('Bundelnaam niet gevonden in index.html');
writeFileSync(htmlPath, html.replace(oldName, newName));
console.log(`Klaar: ${oldName} -> ${newName}`);
