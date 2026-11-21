#!/bin/zsh
# Bouwt de webversie naar dist/ (voor GitHub Pages: stijnvhv.github.io/rate-my-day).
set -e
cd "$(dirname "$0")"
rm -rf dist
npx expo export -p web --output-dir dist
cp public/* dist/
python3 - <<'PY'
p='dist/index.html'
s=open(p).read()
s=s.replace('<html lang="en">','<html lang="nl">').replace('<title>rate-my-day</title>','<title>Rate My Day</title>')
s=s.replace('content="width=device-width, initial-scale=1, shrink-to-fit=no"','content="width=device-width, initial-scale=1, viewport-fit=cover"')
s=s.replace('</head>','''<meta name="theme-color" content="#6C4CF5" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Rate My Day" />
    <link rel="apple-touch-icon" href="/rate-my-day/apple-touch-icon.png" />
    <style>body{background:#F4F2FA}</style>
  </head>''',1)
open(p,'w').write(s)
PY
echo "klaar: dist/"
