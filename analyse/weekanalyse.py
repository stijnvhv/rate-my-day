#!/usr/bin/env python3
from __future__ import annotations
"""Weekanalyse Rate My Day: patronen uitrekenen (gewone code) en Claude laat er besefmomenten bij schrijven.

Leest alle documenten rmd/{code} in Firestore (project stijn-ratemyday) met Stijns gcloud-login
(eigenaar, dus buiten de toegangsregels om), en zet per document het veld `inzichten` terug.
De app toont dat in het tabblad Inzichten.

Gebruik:
  weekanalyse.py               # analyse van de huidige week (ma t/m zo), wegschrijven
  weekanalyse.py --droog       # alleen tonen, niets wegschrijven
  weekanalyse.py --week 2026-11-16   # week die op die maandag begint
"""
import argparse
import datetime as dt
import json
import re
import statistics
import subprocess
import sys
import urllib.request
from pathlib import Path

PROJECT = "stijn-ratemyday"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
CLAUDE_BIN = str(Path.home() / ".local" / "bin" / "claude")
MODEL = "claude-sonnet-5-5"
MIN_N = 3  # minimaal aantal dagen aan beide kanten voor een patroon
UITSLUITEN = Path(__file__).with_name("uitsluiten.txt")  # testcodes


def token() -> str:
    return subprocess.run(["/opt/homebrew/bin/gcloud", "auth", "print-access-token"], capture_output=True, text=True, check=True).stdout.strip()


def api(method: str, url: str, tok: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(url, method=method, headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
                                 data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b"{}")


def waarde(v: dict):
    for k in ("stringValue", "integerValue", "doubleValue", "booleanValue"):
        if k in v:
            x = v[k]
            return int(x) if k == "integerValue" else x
    return None


def lees_docs(tok: str) -> list[tuple[str, dict, dict]]:
    uit = []
    data = api("GET", f"{BASE}/rmd?pageSize=50", tok)
    for d in data.get("documents", []):
        code = d["name"].split("/")[-1]
        velden = {}
        for k, v in d.get("fields", {}).items():
            x = waarde(v)
            try:
                velden[k] = json.loads(x) if isinstance(x, str) else x
            except json.JSONDecodeError:
                velden[k] = x
        gz = api("GET", f"{BASE}/rmd/{code}/gezondheid?pageSize=400", tok)
        gezondheid = {g["name"].split("/")[-1]: {k: waarde(v) for k, v in g.get("fields", {}).items()} for g in gz.get("documents", [])}
        uit.append((code, velden, gezondheid))
    return uit


def num(x):
    t = re.sub(r"\s+", "", str(x))
    if re.fullmatch(r"\d{1,3}([.,]\d{3})+", t):
        t = re.sub(r"[.,]", "", t)
    try:
        return float(t.replace(",", "."))
    except (TypeError, ValueError):
        return None


def dagrijen(velden: dict, gezondheid: dict) -> dict[str, dict]:
    """Per datum alle kenmerken naast elkaar: dagcijfer, slaap, drinken, sport, wandelen, challenge-gewoonten."""
    entries = velden.get("entries") or {}
    ch_days = ((velden.get("challenge") or {}).get("days")) or {}
    rijen = {}
    for dag in sorted(set(entries) | set(ch_days) | set(gezondheid)):
        e, c, g = entries.get(dag) or {}, ch_days.get(dag) or {}, gezondheid.get(dag) or {}
        r = {"dag": dag, "weekdag": dt.date.fromisoformat(dag).isoweekday()}
        if e:
            r.update(score=e.get("score"), energie=e.get("energy"), slaap=num(e.get("sleepHours")), sport_cijfer=e.get("exerciseScore"),
                     productiviteit=e.get("productivity"), stemming={"happy": 3, "neutral": 2, "sad": 1}.get(e.get("mood")),
                     notitie=(e.get("note") or "")[:200])
        # drinken: dagformulier, anders challenge
        if e.get("alcohol"):
            r["gedronken"] = e["alcohol"] != "none"
        elif isinstance(c.get("alcohol"), bool):
            r["gedronken"] = c["alcohol"]
        stappen = g.get("stappen") if g.get("stappen") not in (None, "") else c.get("steps")
        if stappen is not None:
            r["stappen"] = num(stappen)
        if g.get("wandelminuten") is not None:
            r["wandelminuten"] = num(g["wandelminuten"])
        if g.get("workoutminuten") is not None:
            r["workoutminuten"] = num(g["workoutminuten"])
        if g.get("workouts"):
            r["workouts"] = g["workouts"]
        gewandeld = e.get("walked")
        if gewandeld is None and r.get("wandelminuten") is not None:
            gewandeld = r["wandelminuten"] >= 20
        if gewandeld is not None:
            r["gewandeld"] = bool(gewandeld)
        if e.get("social") is not None:
            r["mensen_gezien"] = bool(e["social"])
        if isinstance(c.get("sport"), list):
            r["gesport_challenge"] = len(c["sport"]) > 0
        for k_in, k_uit in (("meditate", "gemediteerd"), ("ice", "ijsbad"), ("phone", "telefoon_weg_in_bed"), ("flex", "flexavond"), ("drugs", "drugs")):
            if isinstance(c.get(k_in), bool):
                r[k_uit] = c[k_in]
        if c.get("sugar") in ("none", "little", "much"):
            r["geen_suiker"] = c["sugar"] == "none"
        rijen[dag] = r
    return rijen


KENMERKEN = [  # (label, functie op rij -> True/False/None)
    ("Niet gedronken", lambda r: None if r.get("gedronken") is None else not r["gedronken"]),
    ("Gesport (sportcijfer 3 of hoger)", lambda r: None if r.get("sport_cijfer") is None else r["sport_cijfer"] >= 3),
    ("Gesport (challenge)", lambda r: r.get("gesport_challenge")),
    ("Gewandeld", lambda r: r.get("gewandeld")),
    ("10.000+ stappen", lambda r: None if r.get("stappen") is None else r["stappen"] >= 10000),
    ("Mensen gezien", lambda r: r.get("mensen_gezien")),
    ("7+ uur geslapen", lambda r: None if r.get("slaap") is None else r["slaap"] >= 7),
    ("Productief (4 of 5)", lambda r: None if r.get("productiviteit") is None else r["productiviteit"] >= 4),
    ("Gemediteerd", lambda r: r.get("gemediteerd")),
    ("IJsbad", lambda r: r.get("ijsbad")),
    ("Telefoon weg in bed", lambda r: r.get("telefoon_weg_in_bed")),
    ("Geen suiker", lambda r: r.get("geen_suiker")),
    ("Flexavond", lambda r: r.get("flexavond")),
    ("Werkdag (ma-vr)", lambda r: r["weekdag"] <= 5),
]


def gem(xs):
    xs = [x for x in xs if x is not None]
    return round(statistics.mean(xs), 1) if xs else None


def patronen(rijen: list[dict]) -> list[dict]:
    uit = []
    met_score = [r for r in rijen if r.get("score") is not None]
    for label, f in KENMERKEN:
        wel = [r["score"] for r in met_score if f(r) is True]
        niet = [r["score"] for r in met_score if f(r) is False]
        if len(wel) >= MIN_N and len(niet) >= MIN_N:
            uit.append({"label": label, "met": gem(wel), "zonder": gem(niet), "nMet": len(wel), "nZonder": len(niet)})
    uit.sort(key=lambda p: -abs(p["met"] - p["zonder"]))
    return uit


def combinaties(rijen: list[dict]) -> list[dict]:
    """Twee gewoonten samen: alleen de opvallendste, met genoeg dagen."""
    met_score = [r for r in rijen if r.get("score") is not None]
    uit = []
    for i, (la, fa) in enumerate(KENMERKEN[:8]):
        for lb, fb in KENMERKEN[i + 1:8]:
            beide = [r["score"] for r in met_score if fa(r) is True and fb(r) is True]
            geen = [r["score"] for r in met_score if fa(r) is False and fb(r) is False]
            if len(beide) >= MIN_N and len(geen) >= MIN_N:
                uit.append({"combinatie": f"{la} + {lb}", "beide": gem(beide), "geen_van_beide": gem(niet := geen), "nBeide": len(beide), "nGeen": len(niet)})
    uit.sort(key=lambda c: -abs(c["beide"] - c["geen_van_beide"]))
    return uit[:4]


def weekdagen(rijen: list[dict]) -> dict:
    namen = ["ma", "di", "wo", "do", "vr", "za", "zo"]
    return {namen[d - 1]: gem([r.get("score") for r in rijen if r["weekdag"] == d]) for d in range(1, 8)}


def maak_cijfers(rijen: dict, maandag: dt.date) -> dict:
    zondag = maandag + dt.timedelta(days=6)
    deze = [r for d, r in rijen.items() if maandag.isoformat() <= d <= zondag.isoformat()]
    vorige = [r for d, r in rijen.items() if (maandag - dt.timedelta(7)).isoformat() <= d < maandag.isoformat()]
    alle = list(rijen.values())
    tot_nu = [r for r in alle if r["dag"] <= zondag.isoformat()]
    return {
        "week": {"van": maandag.isoformat(), "tot": zondag.isoformat(),
                 "dagen_ingevuld": sum(1 for r in deze if r.get("score") is not None),
                 "gemiddeld_cijfer": gem([r.get("score") for r in deze]), "vorige_week_gemiddeld": gem([r.get("score") for r in vorige]),
                 "gem_slaap": gem([r.get("slaap") for r in deze]), "gem_energie": gem([r.get("energie") for r in deze]),
                 "dagen_gedronken": sum(1 for r in deze if r.get("gedronken") is True),
                 "dagen_niet_gedronken": sum(1 for r in deze if r.get("gedronken") is False),
                 "gem_stappen": gem([r.get("stappen") for r in deze]),
                 "dagen": [{k: v for k, v in r.items() if k != "weekdag"} for r in deze]},
        "alle_tijd": {"dagen_met_cijfer": sum(1 for r in tot_nu if r.get("score") is not None), "gemiddeld_cijfer": gem([r.get("score") for r in tot_nu]),
                      "patronen": patronen(tot_nu), "combinaties": combinaties(tot_nu), "per_weekdag": weekdagen(tot_nu)},
        "deze_week_patronen": patronen(deze) if len(deze) >= 6 else [],
    }


SYSTEEM = """Je bent de persoonlijke coach in Stijns dag-rater-app. Elke zondag krijg je de uitgerekende cijfers van zijn week en
patronen over alle dagen (gemiddeld dagcijfer 1-10 met en zonder een gewoonte, met aantallen dagen). Stijn wil besefmomenten:
patronen die hij zelf niet ziet, en een spiegel bij wat hij al vermoedt (sporten, gefocust werken en niet drinken lijken hem
hogere cijfers te geven).

Regels:
- Gebruik alleen getallen die in de invoer staan; reken niets nieuws uit en verzin niets. Noem bij een patroon altijd het aantal dagen.
- Bij weinig dagen (minder dan 5 aan een kant) zeg je dat het een eerste aanwijzing is, geen conclusie. Samenhang is geen oorzaak; zeg dat kort als het ertoe doet.
- Getallen met één decimaal en een komma (6,6), zoals in de invoer.
- Nederlands, je-vorm, direct en warm, geen preek, geen emoji's in de tekst. Korte zinnen.
- Notities van Stijn mag je gebruiken om een dag te duiden, nooit letterlijk citeren als het privé klinkt.

Antwoord met alleen JSON:
{"kop": "max 8 woorden, de kern van de week",
 "samenvatting": "2-3 zinnen over hoe de week ging, met het weekgemiddelde en vergelijking met vorige week als die er is",
 "besefmomenten": [{"titel": "max 6 woorden", "tekst": "2-3 zinnen met de getallen"}],   // 2 tot 4 stuks, sterkste eerst
 "tip": "één concrete, kleine actie voor komende week die volgt uit de patronen"}"""


def schrijf_tekst(cijfers: dict) -> dict:
    proc = subprocess.run([CLAUDE_BIN, "-p", "--output-format", "json", "--model", MODEL, "--tools", "", "--system-prompt", SYSTEEM,
                           "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}'],
                          input="Cijfers en patronen:\n" + json.dumps(cijfers, ensure_ascii=False), capture_output=True, text=True, timeout=600,
                          cwd=str(Path(__file__).parent))
    res = json.loads(proc.stdout or "{}")
    if proc.returncode or res.get("is_error"):
        raise RuntimeError(f"Claude-fout: {(res.get('result') or proc.stderr)[:300]}")
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", (res.get("result") or "").strip(), flags=re.S)
    m = re.search(r"\{.*\}", t, flags=re.S)
    return json.loads(m.group(0) if m else t)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--droog", action="store_true")
    ap.add_argument("--week", help="maandag van de week (JJJJ-MM-DD); standaard de huidige week")
    a = ap.parse_args()
    vandaag = dt.date.today()
    maandag = dt.date.fromisoformat(a.week) if a.week else vandaag - dt.timedelta(days=vandaag.weekday())
    uitsluiten = set(UITSLUITEN.read_text().split()) if UITSLUITEN.exists() else set()
    tok = token()
    for code, velden, gezondheid in lees_docs(tok):
        if code in uitsluiten:
            continue
        rijen = dagrijen(velden, gezondheid)
        if not any(r.get("score") is not None for r in rijen.values()):
            continue
        cijfers = maak_cijfers(rijen, maandag)
        tekst = schrijf_tekst(cijfers)
        jaar, wk, _ = maandag.isocalendar()
        week = {"week": f"{jaar}-W{wk:02d}", "van": cijfers["week"]["van"], "tot": cijfers["week"]["tot"],
                "gemaakt": dt.datetime.now().astimezone().isoformat(timespec="minutes"),
                "kop": tekst.get("kop", ""), "samenvatting": tekst.get("samenvatting", ""),
                "besefmomenten": tekst.get("besefmomenten", [])[:4], "tip": tekst.get("tip", ""),
                "cijfers": {"gem": cijfers["week"]["gemiddeld_cijfer"], "vorigeWeek": cijfers["week"]["vorige_week_gemiddeld"],
                            "dagen": cijfers["week"]["dagen_ingevuld"]},
                "patronen": cijfers["alle_tijd"]["patronen"][:6]}
        print(json.dumps(week, ensure_ascii=False, indent=2))
        if a.droog:
            continue
        oud = velden.get("inzichten") or {}
        weken = [w for w in oud.get("weken", []) if w.get("week") != week["week"]] + [week]
        weken = sorted(weken, key=lambda w: w["week"])[-52:]
        api("PATCH", f"{BASE}/rmd/{code}?updateMask.fieldPaths=inzichten",
            tok, {"fields": {"inzichten": {"stringValue": json.dumps({"weken": weken}, ensure_ascii=False)}}})
        print(f"weggeschreven voor {code[:6]}…", file=sys.stderr)


if __name__ == "__main__":
    main()
