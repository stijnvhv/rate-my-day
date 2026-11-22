#!/usr/bin/env python3
"""Herinneringen Rate My Day: pushmelding naar Stijns telefoon tot hij heeft ingevuld.

- Vanaf 08:30: is gisteren nog niet ingevuld, dan elk kwartier een melding.
- Vanaf 17:00: is de dagplanner voor morgen (kaart op Vandaag, veld `planner`) nog niet afgevinkt, dan elk kwartier een melding.
- Na 23:00 en voor 08:30: stil.
Draait elke 5 minuten via LaunchAgent nl.stijn.ratemyday-herinneringen.  Proef: herinneringen.py --droog [--nu 17:20]
"""
import argparse
import datetime as dt
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import weekanalyse as wa  # noqa: E402  (token, api, BASE, waarde)
from pywebpush import WebPushException, webpush  # noqa: E402

CONF = Path.home() / ".config" / "ratemyday"
STATE = CONF / "herinnering-state.json"
VAPID_PRIVATE = CONF / "vapid_private.pem"
INTERVAL_MIN = 15
STIL_NA = dt.time(23, 0)


def lees(tok: str) -> list[tuple[str, dict]]:
    data = wa.api("GET", f"{wa.BASE}/rmd?pageSize=50", tok)
    uit = []
    for d in data.get("documents", []):
        velden = {}
        for k, v in d.get("fields", {}).items():
            x = wa.waarde(v)
            try:
                velden[k] = json.loads(x) if isinstance(x, str) else x
            except json.JSONDecodeError:
                velden[k] = x
        uit.append((d["name"].split("/")[-1], velden))
    return uit


def stuur(sub: dict, payload: dict) -> str:
    try:
        webpush(subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]}, data=json.dumps(payload),
                vapid_private_key=str(VAPID_PRIVATE), vapid_claims={"sub": "https://stijnvhv.github.io/rate-my-day/"}, ttl=900)
        return "ok"
    except WebPushException as e:
        status = getattr(e.response, "status_code", None)
        return "weg" if status in (404, 410) else f"fout {status}: {str(e)[:120]}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--droog", action="store_true")
    ap.add_argument("--nu", help="doe alsof het deze tijd is (UU:MM), voor testen")
    ap.add_argument("--test", action="store_true", help="stuur direct een testmelding naar alle apparaten")
    a = ap.parse_args()
    nu = dt.datetime.now()
    if a.nu:
        u, m = map(int, a.nu.split(":"))
        nu = nu.replace(hour=u, minute=m)
    vandaag = nu.date()
    gisteren = vandaag - dt.timedelta(days=1)
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    uitsluiten = set(wa.UITSLUITEN.read_text().split()) if wa.UITSLUITEN.exists() else set()
    tok = wa.token()

    for code, v in lees(tok):
        if code in uitsluiten or not v.get("push"):
            continue
        meldingen = []
        if a.test:
            meldingen.append(("test", {"title": "Rate My Day", "body": "Testmelding van je Mac mini. Zo komen je herinneringen binnen.", "tag": "test"}))
        elif nu.time() < STIL_NA:
            entries = v.get("entries") or {}
            if nu.time() >= dt.time(8, 30) and gisteren.isoformat() not in entries:
                meldingen.append(("rmd", {"title": "⭐ Rate My Day", "tag": "rmd", "url": "/rate-my-day/",
                                          "body": "Gisteren heb je nog niet beoordeeld. Eén minuut, dan stoppen deze meldingen."}))
            if nu.time() >= dt.time(17, 0) and vandaag.isoformat() not in (v.get("planner") or {}):
                meldingen.append(("planner", {"title": "🗓️ Dagplanner voor morgen", "tag": "planner", "url": "/rate-my-day/",
                                              "body": "Zet morgen in Structured en vink het af in Rate My Day. Tot dan blijft deze melding komen."}))
        st = state.setdefault(code[:12], {})
        for soort, payload in meldingen:
            sleutel = f"{soort}:{vandaag.isoformat()}"
            vorige = st.get(sleutel, {})
            laatst = dt.datetime.fromisoformat(vorige["laatst"]) if vorige.get("laatst") else None
            if soort != "test" and laatst and (nu - laatst) < dt.timedelta(minutes=INTERVAL_MIN - 1):
                continue
            n = vorige.get("n", 0) + 1
            if n >= 3 and soort != "test":
                payload = {**payload, "body": f"({n}e keer) " + payload["body"]}
            if a.droog:
                print(f"[droog] {soort} → {len(v['push'])} apparaat/apparaten: {payload['body']}")
                continue
            weg = []
            for sid, sub in (v.get("push") or {}).items():
                uitkomst = stuur(sub, payload)
                print(f"{nu:%H:%M} {soort} {sid[-6:]}: {uitkomst}")
                if uitkomst == "weg":
                    weg.append(sid)
            if weg:
                push = {k: s for k, s in v["push"].items() if k not in weg}
                wa.api("PATCH", f"{wa.BASE}/rmd/{code}?updateMask.fieldPaths=push", tok,
                       {"fields": {"push": {"stringValue": json.dumps(push)}}})
            st[sleutel] = {"laatst": nu.isoformat(timespec="seconds"), "n": n}
        # oude dagen opruimen
        for k in list(st):
            if not k.endswith(vandaag.isoformat()):
                del st[k]
    if not a.droog:
        STATE.write_text(json.dumps(state, indent=1))


if __name__ == "__main__":
    main()
