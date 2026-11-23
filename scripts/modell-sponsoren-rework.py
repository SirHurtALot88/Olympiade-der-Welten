#!/usr/bin/env python3
"""MODELLRECHNUNG ZUM SPONSOREN-REWORK (22.11., docs/design/sponsoren-rework-22-11.md).

Reine Messhilfe, kein App-Code: rechnet den Vorschlag "Liga-Topf + Saisonfaktor" auf den Einzelwerten eines Laufs von
`scripts/miss-teamfinanzen-saison.ts` nach und stellt ihn neben das heutige System.

    python3 scripts/modell-sponsoren-rework.py [--F 1.0] [--kappa 0|1] [--band 0.15] [--kref 62] [--v] [--md] <lauf.json> [...]

Je Lauf und Saison vier Szenarien der operativen GuV je Team:
    heute, gespielt                  Ist-Zahlung des heutigen Sponsors beim gespielten Endrang
    heute, alle auf Erwartungsrang   der eingefrorene Vertragsanker statt der Ist-Zahlung, ohne Wuerfel-Ereignisse
    NEU, alle auf Erwartungsrang     Grundbetrag, Leistungsteil 0
    NEU, gespielt                    Grundbetrag + Leistungsteil beim gespielten Endrang
Mit --kappa 1 kommt ab Saison 2 der Kader-Ersatz (10 % des Kaderwerts) in den Topf; zwei weitere Zeilen ziehen ihn je Team
kalkulatorisch wieder ab ("nach Kader-Ersatz").

Grenzen: das Verhalten der Teams ist festgehalten (gleiche Kader, Gehaelter, Raenge). Farb-Partner und Ziele sind nicht je
Team verteilt (Summe fest), sie stecken im Grundbetrag. Erwartungsrang = Staerkerang (Top 6) am Saisonstart, ab Saison 2
gemittelt mit dem Ligarang der Vorsaison.
"""
import json
import statistics as st
import sys

args = sys.argv[1:]


def opt(name, default):
    if name in args:
        i = args.index(name)
        v = args[i + 1]
        del args[i:i + 2]
        return v
    return default


def schalter(name):
    if name in args:
        args.remove(name)
        return True
    return False


# ---- Stellschrauben des Vorschlags (Startwerte, Konzept Abschnitt 4) ----
F = float(opt('--F', '1.0'))                     # Saisonfaktor
KAPPA = float(opt('--kappa', '0'))               # Kader-Ersatz im Topf: 0 = reine Betriebsrechnung, 1 = Geldmenge konstant
BAND = float(opt('--band', '0.15'))              # Betriebsteil hoechstens so weit vom Vorjahr weg
K_REF = float(opt('--kref', '62'))               # Richtwert Saison 1, C je Team
ERSATZ = 0.10                                    # Kader-Ersatz je Saison als Anteil des Kaderwerts (gemessen 5 bis 17 %)
LIGA_ANTEIL = {'liga1': 1.11, 'liga2': 0.89}     # Niveau des Grundbetrags je Liga (Verhaeltnis 1,25)
STEIGUNG = {'liga1': float(opt('--st1', '1.2')), 'liga2': float(opt('--st2', '1.0'))}   # C je Erwartungsrang
STEIG_ERSATZ = float(opt('--ste', '1.0'))        # zusaetzliche Steigung, wenn der Kader-Ersatz im Topf ist
PRAEMIE = {'liga1': 3.0, 'liga2': 2.5}           # C je Platz ueber oder unter Erwartung
S1_SATZ = 0.5                                    # Leistungssatz in Saison 1
MARKT = 0.8                                      # C je Beliebtheitspunkt ueber oder unter Liga-Mittel
PLAN_UEBRIG = 4.5                                # Planwert der uebrigen Einnahmen je Team (heute: Vorstandsziele)
HEBEL = schalter('--hebel')                      # Vertragsart nach KI-Regel (Erwartung >= 11 Praemie, <= 4 Fest)
VERBOSE = schalter('--v')
MD = schalter('--md')
OUT = opt('--json', None)
files = args

# Beliebtheit aus der Team-Identitaet (TeamIdentity.popularity, Live-Abbild 22.11.)
BELIEBTHEIT = {'A-A': 2.84, 'B-B': 5.96, 'B-P': 7.88, 'C-C': 6.94, 'C-S': 6.88, 'D-L': 3.82, 'D-P': 8.3, 'G-G': 6.5, 'H-R': 6.9, 'L-K': 6.07,
               'L-R': 4.04, 'M-M': 7.08, 'M-S': 8.29, 'N-N': 2.96, 'N-W': 6.14, 'P-C': 7.28, 'P-S': 4.03, 'R-C': 7.42, 'R-L': 4.94, 'R-R': 7.04,
               'S-C': 6.53, 'S-S': 5.43, 'T-C': 6.92, 'T-G': 3.24, 'T-T': 5.77, 'U-A': 4.0, 'V-D': 5.8, 'V-V': 4.76, 'V-W': 7.23, 'W-L': 4.66,
               'W-W': 2.9, 'Z-H': 4.06}


def rang(werte):
    """dict id -> wert  =>  dict id -> rang 1..n (1 = hoechster Wert)"""
    ids = sorted(werte, key=lambda k: (-werte[k], k))
    return {k: i + 1 for i, k in enumerate(ids)}


def mean(a):
    return sum(a) / len(a) if a else 0.0


def r1(v):
    return round(v, 1)


def saison(j, n, vor_rang, vor_topf):
    ph = j['phasen']
    s02, s03, s04 = ph.get(f's{n}_02_saisonstart'), ph.get(f's{n}_03_nach_spieltagen'), ph.get(f's{n}_04_nach_abschluss')
    if not (s02 and s03 and s04):
        return None, vor_rang, vor_topf
    start, ende, guv = s02['snap'], s03['snap'], s04['guv']
    rows = {}
    for liga in ('liga1', 'liga2'):
        ids = [t for t in start if ende[t]['liga'] == liga]
        assert len(ids) == 16, (liga, len(ids))
        sr = rang({t: start[t]['staerke'] for t in ids})
        if vor_rang:
            # Vorjahresrang ligauebergreifend (Liga 1: 1..16, Liga 2: 17..32), innerhalb der neuen Liga gereiht; Summe bleibt 136
            vr = rang({t: -vor_rang[t] for t in ids})
            erw = {t: (sr[t] + vr[t]) / 2 for t in ids}
        else:
            erw = {t: float(sr[t]) for t in ids}
        pop = {t: BELIEBTHEIT.get(t, 5.0) for t in ids}
        pop_m = mean(list(pop.values()))
        for t in ids:
            p, e, s = guv[t]['parts'], ende[t], start[t]
            rows[t] = dict(
                id=t, liga=liga, E=erw[t], R=e['rank'], budget=s['budget'], pop=pop[t], popM=pop_m, mw=s.get('marktwert') or 0,
                kostStichtag=s['gehaltIst'] + s.get('gebaeudeUnterhalt', 0) + s.get('kreditZins', 0),
                gehalt=p['salaryTotal'], unterhalt=p['facilityUpkeep'], zins=p['loanInterest'],
                sponsorAlt=p['sponsorCash'], ereignisAlt=p['sponsorEventCash'], board=p['objectiveCashDelta'], gebEin=p['facilityIncome'],
                apron=p['apronNetto'], anker=s.get('sponsorAnker') or 0, faktorAlt=p.get('apronSalaryFactor'),
                kasseEnde=s04['snap'][t]['cash'])
    alle = list(rows.values())
    n_teams = len(alle)
    # ---- Liga-Topf ----
    kap = KAPPA if n >= 2 else 0.0                       # Saison 1 zahlt der Draft aus dem Startbudget
    ersatz_summe = kap * ERSATZ * sum(r['mw'] for r in alle)
    plan = sum(PLAN_UEBRIG + r['gebEin'] for r in alle)  # Gebaeude-Einnahme ist am Stichtag bekannt
    k_ist = sum(r['kostStichtag'] for r in alle) - plan
    basis = vor_topf if vor_topf else K_REF * n_teams
    k_b = min(max(k_ist, basis * (1 - BAND)), basis * (1 + BAND))
    topf = F * (k_b + ersatz_summe)
    je_team = topf / n_teams
    norm = sum(LIGA_ANTEIL[r['liga']] for r in alle) / n_teams
    satz = S1_SATZ if n == 1 else 1.0
    for r in alle:
        L = r['liga']
        r['grund'] = je_team * LIGA_ANTEIL[L] / norm + F * (STEIGUNG[L] + (STEIG_ERSATZ if kap else 0)) * (8.5 - r['E']) + MARKT * (r['pop'] - r['popM'])
        r['h'] = (1.5 if r['E'] >= 11 else 0.5 if r['E'] <= 4 else 1.0) if HEBEL else 1.0
        r['leistung'] = F * satz * PRAEMIE[L] * r['h'] * (r['E'] - r['R'])
    for L in ('liga1', 'liga2'):                         # Liga-Ausgleich: Summe je Liga exakt 0
        rr = [r for r in alle if r['liga'] == L]
        korr = mean([r['leistung'] for r in rr])
        for r in rr:
            r['leistung'] -= korr
    for r in alle:
        uebrig = r['board'] + r['gebEin'] + r['apron']
        kosten = r['gehalt'] + r['unterhalt'] + r['zins']
        ers = kap * ERSATZ * r['mw']
        r['sponsorNeu'] = r['grund'] + r['leistung']
        r['guvAlt'] = r['sponsorAlt'] + r['ereignisAlt'] + uebrig - kosten
        r['guvAltErw'] = r['anker'] + uebrig - kosten
        r['guvNeuErw'] = r['grund'] + uebrig - kosten
        r['guvNeu'] = r['sponsorNeu'] + uebrig - kosten
        r['guvNeuErwNachErsatz'] = r['guvNeuErw'] - ers
        r['guvNeuNachErsatz'] = r['guvNeu'] - ers
    naechster = {r['id']: r['R'] + (0 if r['liga'] == 'liga1' else 16) for r in alle}
    return dict(topf=topf, jeTeam=je_team, kIst=k_ist / n_teams, kB=k_b / n_teams, ersatz=ersatz_summe / n_teams, rows=alle, faktorAlt=alle[0]['faktorAlt']), naechster, k_b


def kennzahlen(rows, key):
    v = [r[key] for r in rows]
    l1 = [r[key] for r in rows if r['liga'] == 'liga1']
    l2 = [r[key] for r in rows if r['liga'] == 'liga2']
    q = sorted(rows, key=lambda r: -r['budget'])
    q1, q4 = mean([r[key] for r in q[:8]]), mean([r[key] for r in q[24:]])
    return dict(mittel=r1(mean(v)), l1=r1(mean(l1)), l2=r1(mean(l2)), ge0=sum(1 for x in v if x >= 0), ge0l1=sum(1 for x in l1 if x >= 0),
                ge0l2=sum(1 for x in l2 if x >= 0), mn=r1(min(v)), md=r1(st.median(v)), mx=r1(max(v)), sd=r1(st.pstdev(v)), q1q4=r1(q1 - q4))


SZENARIEN = [('guvAlt', 'heute, gespielt'), ('guvAltErw', 'heute, alle auf Erwartungsrang'), ('guvNeuErw', 'NEU, alle auf Erwartungsrang'), ('guvNeu', 'NEU, gespielt')]
if KAPPA:
    SZENARIEN += [('guvNeuErwNachErsatz', 'NEU Erwartung, nach Kader-Ersatz'), ('guvNeuNachErsatz', 'NEU gespielt, nach Kader-Ersatz')]

res = {}
for f in files:
    j = json.load(open(f))
    vor, vt = None, None
    lab = j.get('label') or f
    if not MD:
        print(f'\n===== {f} (Label {lab}), Saisonfaktor neu {F}, kappa {KAPPA} =====')
    for n in (1, 2, 3):
        s, vor, vt = saison(j, n, vor, vt)
        if not s:
            break
        rows = s['rows']
        out = {key: kennzahlen(rows, key) for key, _ in SZENARIEN}
        l1 = [r for r in rows if r['liga'] == 'liga1']
        l2 = [r for r in rows if r['liga'] == 'liga2']
        sa, sn = [r['sponsorAlt'] for r in rows], [r['sponsorNeu'] for r in rows]
        q = sorted(rows, key=lambda r: -r['budget'])
        ka = [r['kasseEnde'] for r in q]
        kn = [r['kasseEnde'] + r['sponsorNeu'] - r['sponsorAlt'] - r['ereignisAlt'] for r in q]   # Verhalten festgehalten
        sp = dict(sumAlt=r1(sum(sa)), sumNeu=r1(sum(sn)), gehalt=r1(mean([r['gehalt'] for r in rows])),
                  l1l2Alt=round(mean([r['sponsorAlt'] for r in l1]) / mean([r['sponsorAlt'] for r in l2]), 2),
                  l1l2Neu=round(mean([r['sponsorNeu'] for r in l1]) / mean([r['sponsorNeu'] for r in l2]), 2),
                  l1l2Gehalt=round(mean([r['gehalt'] for r in l1]) / mean([r['gehalt'] for r in l2]), 2),
                  maxMinAlt=round(max(sa) / min(sa), 2), maxMinNeu=round(max(sn) / min(sn), 2),
                  kasseQ1Alt=r1(mean(ka[:8])), kasseQ4Alt=r1(mean(ka[24:])), kasseQ1Neu=r1(mean(kn[:8])), kasseQ4Neu=r1(mean(kn[24:])),
                  minusAlt=sum(1 for x in ka if x < 0), minusNeu=sum(1 for x in kn if x < 0))
        res[f'{lab}:s{n}'] = dict(faktorAlt=s['faktorAlt'], topf=r1(s['topf']), jeTeam=r1(s['jeTeam']), kIst=r1(s['kIst']), kB=r1(s['kB']), ersatz=r1(s['ersatz']), kenn=out, sponsor=sp)
        if MD:
            for key, name in SZENARIEN:
                k = out[key]
                print(f"| {lab} | {n} | {name} | {k['mittel']:+} | {k['l1']:+} | {k['l2']:+} | {k['ge0']} ({k['ge0l1']} / {k['ge0l2']}) | {k['mn']:+} / {k['md']:+} / {k['mx']:+} | {k['sd']} | {k['q1q4']:+} |".replace('.', ','))
            continue
        print(f"\n-- Saison {n}: Faktor heute {s['faktorAlt']}; Topf neu {r1(s['topf'])} C = {r1(s['jeTeam'])} je Team (Betriebsteil {r1(s['kB'])}, ungebremst {r1(s['kIst'])}, Kader-Ersatz {r1(s['ersatz'])})")
        print('   Szenario                         | Mittel |   L1  |   L2  | >=0 (L1/L2) | min / med / max         |  sd  | Q1-Q4')
        for key, name in SZENARIEN:
            k = out[key]
            print(f"   {name:32s} | {k['mittel']:6} | {k['l1']:5} | {k['l2']:5} | {k['ge0']:2} ({k['ge0l1']}/{k['ge0l2']})   | {k['mn']:6} / {k['md']:5} / {k['mx']:5} | {k['sd']:4} | {k['q1q4']:5}")
        print('   Sponsor', sp)
        for L, rr in (('liga1', l1), ('liga2', l2)):
            xs = [r['E'] for r in rr]
            mx = mean(xs)

            def steig(werte):
                my = mean(werte)
                return sum((x - mx) * (y - my) for x, y in zip(xs, werte)) / sum((x - mx) ** 2 for x in xs)
            print(f"   {L}: Endrang je Erwartungsrang {steig([r['R'] for r in rr]):.2f}; Kosten je Erwartungsrang {-steig([r['kostStichtag'] for r in rr]):.2f} C;"
                  f" Kosten + 10 % Kaderwert je Erwartungsrang {-steig([r['kostStichtag'] + 0.1 * r['mw'] for r in rr]):.2f} C; Kosten Mittel {mean([r['kostStichtag'] for r in rr]):.1f}")
        if VERBOSE:
            for r in sorted(rows, key=lambda r: (r['liga'], r['E'])):
                print(f"     {r['id']} {r['liga']} E{r['E']:4} R{r['R']:2} Budget{r['budget']} Kosten{r['kostStichtag']:5.1f} | heute {r['sponsorAlt']:5.1f} Anker {r['anker']:5.1f} GuV {r['guvAlt']:6.1f}"
                      f" | neu Grund {r['grund']:5.1f} Leistung {r['leistung']:6.1f} GuV Erw {r['guvNeuErw']:6.1f} GuV {r['guvNeu']:6.1f}")
if OUT:
    json.dump(res, open(OUT, 'w'), ensure_ascii=False, indent=1)
