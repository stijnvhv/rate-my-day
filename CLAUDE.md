# Rate My Day

Persoonlijke dag-rater van Stijn (Expo / React Native Web). Live: https://stijnvhv.github.io/rate-my-day/

- Bron staat op tak `bron`, de gebouwde site op `main` (GitHub Pages, root).
- Bouwen: `./build.sh` → `dist/`. Uitrollen: inhoud van `dist/` naar een clone van `main` kopiëren (behalve `.git`, plus `.nojekyll`), committen en `git sync`.
- Data staat in localStorage van de browser: `rate-my-day:entries`, `rate-my-day:settings`, `rate-my-day:challenge`. Sleutels en origin nooit wijzigen, anders is Stijns geschiedenis weg.
- 90-dagen challenge: `src/challenge/challengeModule.js` (vroeger in de bundel geïnjecteerd; nu gewone module via `src/challenge/index.ts`).
- Kleuren en schaal: `src/theme/index.ts`.

## Online opslag en weekanalyse (sinds 22 nov 2026)
- Firebase-project `stijn-ratemyday` (privé, los van STILT). Regels: `firebase/firestore.rules` (uitrollen: `cd firebase && npx firebase-tools deploy --only firestore:rules`).
- Document `rmd/{koppelcode}` met velden `entries`, `challenge`, `inzichten` (JSON-tekst); subcollectie `gezondheid/{JJJJ-MM-DD}` (iPhone-opdracht: stappen, wandelminuten, workouts).
- App: `src/storage/sync.ts` (REST, samenvoegen per dag op `updatedAt`; challenge op `_bijgewerkt`). Koppelcode staat alleen op het apparaat (Instellingen → Online bewaard).
- Weekanalyse: `analyse/weekanalyse.py` (cijfers en patronen in code, Claude schrijft alleen de tekst), LaunchAgent `nl.stijn.ratemyday-weekanalyse` op de mini, zondag 19:00. Proef: `--droog`. Testcodes in `analyse/uitsluiten.txt`.
