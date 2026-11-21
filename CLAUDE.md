# Rate My Day

Persoonlijke dag-rater van Stijn (Expo / React Native Web). Live: https://stijnvhv.github.io/rate-my-day/

- Bron staat op tak `bron`, de gebouwde site op `main` (GitHub Pages, root).
- Bouwen: `./build.sh` → `dist/`. Uitrollen: inhoud van `dist/` naar een clone van `main` kopiëren (behalve `.git`, plus `.nojekyll`), committen en `git sync`.
- Data staat in localStorage van de browser: `rate-my-day:entries`, `rate-my-day:settings`, `rate-my-day:challenge`. Sleutels en origin nooit wijzigen, anders is Stijns geschiedenis weg.
- 90-dagen challenge: `src/challenge/challengeModule.js` (vroeger in de bundel geïnjecteerd; nu gewone module via `src/challenge/index.ts`).
- Kleuren en schaal: `src/theme/index.ts`.
