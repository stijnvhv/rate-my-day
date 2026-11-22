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


def dagrijen(velden: dict, gezondheid: dict, labels: dict | None = None) -> dict[str, dict]:
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
        if labels is not None and (e.get("note") or "").strip():
            r["labels"] = (labels.get(dag) or {}).get("labels", [])
        rijen[dag] = r
    return rijen


LABELS = {  # sleutel: omschrijving voor Claude
    "gedronken": "alcohol gedronken (bier, wijn, borrel, feest met drank)",
    "kater": "kater of brak door drank/uitgaan van de avond ervoor",
    "gesport": "gesport of getraind (gym, hardlopen, boksen, kickboksen, padel, enz.)",
    "gewandeld": "gewandeld of flink gelopen",
    "mensen_gezien": "tijd met vrienden, familie of date doorgebracht (sociaal, niet alleen werkcontact)",
    "kinderen": "tijd met zijn kinderen",
    "gefocust_gewerkt": "gefocust of productief gewerkt, diep werk, veel afgekregen",
    "lang_gewerkt": "heel lang of tot laat gewerkt",
    "slecht_geslapen": "slecht of te kort geslapen, moe",
    "ziek": "ziek of lichamelijk niet fit",
    "gedoe_werk": "stress, gedoe of tegenslag op het werk",
}

LABEL_SYSTEEM = """Je labelt dagboeknotities van Stijn. Geef per datum de lijst met labels die duidelijk in de notitie staan.
Alleen labelen wat er echt staat (of zeer duidelijk bedoeld is); bij twijfel niet. Labels:
""" + "\n".join(f"- {k}: {v}" for k, v in LABELS.items()) + """
Antwoord met alleen JSON: {"JJJJ-MM-DD": ["label", ...], ...} voor elke gegeven datum (lege lijst als niets past)."""


def label_notities(velden: dict) -> tuple[dict, bool]:
    """Labels per dag uit de notities; alleen nieuwe of gewijzigde notities gaan naar Claude. Geeft (labels, gewijzigd)."""
    entries = velden.get("entries") or {}
    cache = velden.get("notitieLabels") or {}
    nieuw = {d: e["note"] for d, e in entries.items()
             if (e.get("note") or "").strip() and (cache.get(d) or {}).get("bij") != e.get("updatedAt")}
    gewijzigd = False
    items = sorted(nieuw.items())
    for i in range(0, len(items), 40):
        blok = dict(items[i:i + 40])
        uit = claude_json(LABEL_SYSTEEM, "Notities:\n" + json.dumps(blok, ensure_ascii=False), model="claude-haiku-5-5")
        for d in blok:
            cache[d] = {"labels": [l for l in (uit.get(d) or []) if l in LABELS], "bij": entries[d].get("updatedAt")}
            gewijzigd = True
    return cache, gewijzigd


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
] + [
    (f"{naam} (volgens notitie)", (lambda k: lambda r: None if r.get("labels") is None else k in r["labels"])(k))
    for k, naam in (("gedronken", "Gedronken"), ("kater", "Kater"), ("gesport", "Gesport"), ("gewandeld", "Gewandeld"),
                    ("mensen_gezien", "Mensen gezien"), ("kinderen", "Tijd met kinderen"), ("gefocust_gewerkt", "Gefocust gewerkt"),
                    ("lang_gewerkt", "Lang gewerkt"), ("slecht_geslapen", "Slecht geslapen"), ("ziek", "Ziek"), ("gedoe_werk", "Gedoe op werk"))
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
    # sterkste verschil eerst, maar patronen met weinig dagen aan één kant zakken
    uit.sort(key=lambda p: -abs(p["met"] - p["zonder"]) * min(1.0, min(p["nMet"], p["nZonder"]) / 6))
    return uit


def combinaties(rijen: list[dict]) -> list[dict]:
    """Twee gewoonten samen: alleen de opvallendste, met genoeg dagen."""
    met_score = [r for r in rijen if r.get("score") is not None]
    uit = []
    sterk = [k for k in KENMERKEN if k[0] in {p["label"] for p in patronen(rijen)[:8]}]
    for i, (la, fa) in enumerate(sterk):
        for lb, fb in sterk[i + 1:]:
            beide = [r["score"] for r in met_score if fa(r) is True and fb(r) is True]
            geen = [r["score"] for r in met_score if fa(r) is False and fb(r) is False]
            if len(beide) >= MIN_N and len(geen) >= MIN_N:
                uit.append({"combinatie": f"{la} + {lb}", "beide": gem(beide), "geen_van_beide": gem(niet := geen), "nBeide": len(beide), "nGeen": len(niet)})
    uit.sort(key=lambda c: -abs(c["beide"] - c["geen_van_beide"]))
    return uit[:4]


def weekdagen(rijen: list[dict]) -> dict:
    namen = ["ma", "di", "wo", "do", "vr", "za", "zo"]
    return {namen[d - 1]: gem([r.get("score") for r in rijen if r["weekdag"] == d]) for d in range(1, 8)}


def per_maand(rijen: list[dict]) -> dict:
    maanden = sorted({r["dag"][:7] for r in rijen if r.get("score") is not None})
    return {m: {"gem": gem([r.get("score") for r in rijen if r["dag"].startswith(m)]),
                "dagen": sum(1 for r in rijen if r["dag"].startswith(m) and r.get("score") is not None)} for m in maanden}


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
                      "patronen": patronen(tot_nu), "combinaties": combinaties(tot_nu), "per_weekdag": weekdagen(tot_nu),
                      "per_maand": per_maand(tot_nu),
                      "beste_dagen": [{"dag": r["dag"], "score": r["score"], "labels": r.get("labels")} for r in sorted(tot_nu, key=lambda r: -(r.get("score") or 0))[:5]],
                      "slechtste_dagen": [{"dag": r["dag"], "score": r["score"], "labels": r.get("labels")} for r in sorted(tot_nu, key=lambda r: (r.get("score") or 99))[:5]]},
        "deze_week_patronen": patronen(deze) if len(deze) >= 6 else [],
    }


SYSTEEM = """Je bent de persoonlijke coach in Stijns dag-rater-app. Elke zondag krijg je de uitgerekende cijfers van zijn week en
patronen over alle dagen (gemiddeld dagcijfer 1-10 met en zonder een gewoonte, met aantallen dagen). Stijn wil besefmomenten:
patronen die hij zelf niet ziet (ook in labels uit zijn notities: 'volgens notitie' betekent dat het in zijn
dagnotitie stond; niet genoemd telt als 'niet', dus dat is een benadering), en een spiegel bij wat hij al vermoedt (sporten, gefocust werken en niet drinken lijken hem
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


def claude_json(systeem: str, invoer: str, model: str = MODEL) -> dict:
    proc = subprocess.run([CLAUDE_BIN, "-p", "--output-format", "json", "--model", model, "--tools", "", "--system-prompt", systeem,
                           "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}'],
                          input=invoer, capture_output=True, text=True, timeout=600, cwd=str(Path(__file__).parent))
    res = json.loads(proc.stdout or "{}")
    if proc.returncode or res.get("is_error"):
        raise RuntimeError(f"Claude-fout: {(res.get('result') or proc.stderr)[:300]}")
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", (res.get("result") or "").strip(), flags=re.S)
    m = re.search(r"\{.*\}", t, flags=re.S)
    return json.loads(m.group(0) if m else t)


def schrijf_tekst(cijfers: dict, eerste: bool) -> dict:
    extra = ("Dit is de EERSTE analyse: de besefmomenten gaan vooral over de patronen over alle dagen sinds het begin "
             "(alle_tijd), niet over deze week. De kop en samenvatting gaan over het totaalbeeld sinds de eerste dag "
             "(gemiddelde over alle dagen, verloop per maand); noem het aantal dagen van deze week niet. Mag 4 besefmomenten hebben.\n") if eerste else ""
    return claude_json(SYSTEEM, extra + "Cijfers en patronen:\n" + json.dumps(cijfers, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--droog", action="store_true")
    ap.add_argument("--totaal", action="store_true", help="totaalanalyse over alle dagen (opnieuw) maken")
    ap.add_argument("--week", help="maandag van de week (JJJJ-MM-DD); standaard de huidige week")
    a = ap.parse_args()
    vandaag = dt.date.today()
    maandag = dt.date.fromisoformat(a.week) if a.week else vandaag - dt.timedelta(days=vandaag.weekday())
    uitsluiten = set(UITSLUITEN.read_text().split()) if UITSLUITEN.exists() else set()
    tok = token()
    for code, velden, gezondheid in lees_docs(tok):
        if code in uitsluiten:
            continue
        labels, gewijzigd = label_notities(velden)
        if gewijzigd and not a.droog:
            api("PATCH", f"{BASE}/rmd/{code}?updateMask.fieldPaths=notitieLabels",
                tok, {"fields": {"notitieLabels": {"stringValue": json.dumps(labels, ensure_ascii=False)}}})
        rijen = dagrijen(velden, gezondheid, labels)
        if not any(r.get("score") is not None for r in rijen.values()):
            continue
        cijfers = maak_cijfers(rijen, maandag)
        eerste = a.totaal or not ((velden.get("inzichten") or {}).get("weken"))
        tekst = schrijf_tekst(cijfers, eerste)
        jaar, wk, _ = maandag.isocalendar()
        alle = cijfers["alle_tijd"]
        eerste_dag = min(r["dag"] for r in rijen.values() if r.get("score") is not None)
        week = {"week": f"{jaar}-W{wk:02d}" + ("-totaal" if eerste else ""), "soort": "totaal" if eerste else "week",
                "van": eerste_dag if eerste else cijfers["week"]["van"], "tot": cijfers["week"]["tot"],
                "gemaakt": dt.datetime.now().astimezone().isoformat(timespec="minutes"),
                "kop": tekst.get("kop", ""), "samenvatting": tekst.get("samenvatting", ""),
                "besefmomenten": tekst.get("besefmomenten", [])[:4], "tip": tekst.get("tip", ""),
                "cijfers": ({"gem": alle["gemiddeld_cijfer"], "vorigeWeek": None, "dagen": alle["dagen_met_cijfer"]} if eerste else
                            {"gem": cijfers["week"]["gemiddeld_cijfer"], "vorigeWeek": cijfers["week"]["vorige_week_gemiddeld"],
                             "dagen": cijfers["week"]["dagen_ingevuld"]}),
                "combinaties": alle["combinaties"][:3],
                "patronen": cijfers["alle_tijd"]["patronen"][:8]}
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
