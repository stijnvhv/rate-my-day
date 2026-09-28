# 90-dagen challenge

Extra tabblad "90 dagen" in Rate My Day. Deze repo bevat alleen de gebouwde Expo-webexport,
daarom wordt de module direct in de bundel gezet.

- `challenge-screen.js` – leesbare bron van het scherm (Dag, Week, 90 dagen, Analyse)
- `inject.mjs` – zet de module in `_expo/static/js/web/index-*.js`, voegt de tab toe,
  hernoemt de bundel naar een nieuwe hash en werkt `index.html` bij

Na een wijziging in `challenge-screen.js`: `node challenge/inject.mjs` (kan herhaald worden).

Data staat in de browser (`localStorage`) onder `rate-my-day:challenge`; Rate My Day-entries
blijven onder `rate-my-day:entries`.
