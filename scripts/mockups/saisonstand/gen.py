"""Erzeugt die Daten fuer public/mockups/saisonstand-modern-17-11.html.
ECHT (aus dem Live-Abbild, Save new-game-1793476611202-0dwpok): Teams, Ligen, Startplaetze, Spielplan (320 Paarungen),
Disziplin-Plan (20 Spieltage x 2), Kader, Spieler, Disziplinwerte, Marktwert, Gehalt, Cash.
ERFUNDEN: alle Ergebnisse (Simulation aus Kaderstaerke + Rauschen), damit Punkte, Bilanz, Verhaeltnis, Form, Matchwinner.
"""
import sqlite3, json, os, re, random, sys, statistics
S = os.path.dirname(os.path.abspath(__file__))
REPO = sys.argv[1]
c = sqlite3.connect(S + '/abbild.sqlite'); sid = 'new-game-1793476611202-0dwpok'
def one(t): return json.loads(c.execute(f"select payload_json from {t} where save_id=?", (sid,)).fetchone()[0])
def many(t): return [json.loads(r[0]) for r in c.execute(f"select payload_json from {t} where save_id=?", (sid,))]
ss = one('season_states'); teams = {t['teamId']: t for t in many('teams')}
players = {p['player']['id']: p['player'] for p in many('players')}
rosters = many('rosters')
portraits = set(os.listdir(REPO + '/public/portraits'))
def slug(n):
    s = re.sub(r'[^a-z0-9]+', '-', n.lower()).strip('-')
    return s if s + '.jpg' in portraits else None

# Disziplinen in Standardreihenfolge der App (season-discipline-area-groups.ts)
DIS = [("tdm","TDM","TDM","pow"),("mini-dm","MIN","Mini DM","pow"),("gewichtheben","GEW","Gewichtheben","pow"),("hockey","HOC","Hockey","pow"),("breaking","BRE","Breaking","pow"),
       ("staffel","STA","Staffel","spe"),("time-trial","TIT","Time Trial","spe"),("spurt","SPU","Spurt","spe"),("climbing","CLI","Climbing","spe"),("fechten","FEC","Fechten","spe"),
       ("speed-schach","SCH","Speed-Schach","men"),("takeshis-castle","TAK","Takeshi's Castle","men"),("tennis","TEN","Tennis","men"),("i-spy","ISP","I-Spy","men"),("wettessen","WET","Wettessen","men"),
       ("basketball","BAS","Basketball","soc"),("football","FOO","Football","soc"),("battlefield","BAT","Battlefield","soc"),("eiskunstlauf","EIS","Eiskunstlauf","soc"),("showcase","SHO","Showcase","soc")]
DIX = {d[0]: i for i, d in enumerate(DIS)}
POD = {"mini-dm", "battlefield", "takeshis-castle", "staffel"}
STYLE = {"basketball": ("int", 74, 14, 1.6), "hockey": ("int", 4, 2, .28), "football": ("int", 24, 9, .9), "tdm": ("int", 30, 6, .8),
         "fechten": ("cap", 15, 0, .7), "tennis": ("sets", 0, 0, 0), "speed-schach": ("halb", 0, 0, 0)}

# Finanzspalten aus dem Bild docs/design/fable-uiux-screenshots-14-11/04-saisonstand-dichte-tabelle.png (derselbe Save): Sponsoren, GuV in Mio
FIN = {"M-M":(108.3,4.2),"Z-H":(98.6,-10.9),"C-S":(112.3,30.9),"G-G":(135.6,60.5),"L-R":(94.5,3.7),"P-S":(89.4,13.7),"R-L":(96.5,21.8),"W-L":(79.7,3.9),
       "H-R":(76.5,-4.8),"S-S":(64.7,-2.0),"B-P":(69.3,1.4),"N-N":(50.7,-15.4),"N-W":(53.1,-19.3),"T-T":(52.1,-17.7),"W-W":(43.4,-17.8),"V-D":(39.3,-23.9),
       "M-S":(101.6,42.7),"D-P":(89.7,29.4),"V-V":(71.3,4.8),"T-G":(66.1,0.7),"L-K":(73.7,5.6),"R-C":(77.3,25.1),"C-C":(54.2,-7.7),"T-C":(65.7,27.7),
       "S-C":(49.3,-11.0),"P-C":(68.5,20.7),"D-L":(50.4,-0.6),"U-A":(60.2,5.7),"B-B":(57.8,7.3),"V-W":(43.3,-2.5),"A-A":(54.7,-3.0),"R-R":(48.0,4.2)}

kader = {t: [] for t in teams}
for r in rosters:
    if r['teamId'] in kader and r['playerId'] in players: kader[r['teamId']].append((players[r['playerId']], r))
P = []; PIX = {}
def pidx(p):
    if p['id'] not in PIX:
        PIX[p['id']] = len(P); P.append([p['name'], slug(p['name']), p['className'], p['race'], round(p['rating'], 1)])
    return PIX[p['id']]
T = {}; strength = {}; best = {}
for code, t in teams.items():
    k = kader[code]
    st = []; bb = []
    for d in DIS:
        vals = sorted(k, key=lambda x: -x[0]['disciplineRatings'].get(d[0], 0))
        top = vals[:4]
        st.append(round(statistics.mean(x[0]['disciplineRatings'].get(d[0], 0) for x in top), 1))
        bb.append([pidx(x[0]) for x in vals[:3]])
    strength[code] = st; best[code] = bb
    stars = sorted(k, key=lambda x: -x[0]['rating'])[:4]
    T[code] = {"n": t['name'], "l": 1 if ss['leagueByTeamId'][code] == 'liga1' else 2, "sp": ss['standings'][code]['startplatz'],
               "mw": round(sum(x[1]['currentValue'] for x in k), 1), "geh": round(sum(x[1]['salary'] for x in k), 1), "cash": round(t['cash'], 1),
               "spo": FIN[code][0], "guv": FIN[code][1], "k": len(k), "st": st, "stars": [pidx(x[0]) for x in stars],
               "ovr": round(statistics.mean(x[0]['rating'] for x in sorted(k, key=lambda x: -x[0]['rating'])[:8]), 1)}
MD = []
for e in sorted(ss['disciplineSchedule'], key=lambda e: e['matchdayIndex']):
    MD.append([DIX[e['discipline1']['disciplineId']], DIX[e['discipline2']['disciplineId']]])
mdids = one('seasons')['matchdayIds']
FX = {1: [[] for _ in mdids], 2: [[] for _ in mdids]}
for f in ss['schedule']:
    FX[1 if f['leagueTier'] == 'liga1' else 2][mdids.index(f['matchdayId'])].append([f['homeTeamId'], f['awayTeamId']])

def fmt(x): return ('%.1f' % x).replace('.', ',')
def sim(seed):
    rnd = random.Random(seed)
    res = {1: [], 2: []}
    for lg in (1, 2):
        for mi, fl in enumerate(FX[lg]):
            day = {"f": [], "p": {}}
            vals = {}
            for side, di in enumerate(MD[mi]):
                for a, b in fl:
                    for tcode in (a, b): vals[(side, tcode)] = strength[tcode][di] + rnd.gauss(0, 6.5)
            for fi, (a, b) in enumerate(fl):
                row = [a, b]
                for side, di in enumerate(MD[mi]):
                    did = DIS[di][0]
                    if did in POD: row.append(None); continue
                    va, vb = vals[(side, a)], vals[(side, b)]; d = va - vb
                    draw = abs(d) < 0.7
                    st = STYLE.get(did)
                    if st and st[0] == "int":
                        base = max(0, round(st[1] + rnd.uniform(-1, 1) * st[2])); m = 0 if draw else max(1, round(abs(d) * st[3]))
                        hi, lo = base + (m + 1) // 2, max(0, base - m // 2)
                        if not draw and hi == lo: hi += 1
                        sa, sb = (hi, lo) if d > 0 else (lo, hi)
                        if draw: sa = sb = base
                        sa, sb = str(sa), str(sb)
                    elif st and st[0] == "cap":
                        lo = max(3, min(14, round(15 - abs(d) * st[3] - rnd.uniform(0, 2))))
                        if draw: sa = sb = "14"
                        else: sa, sb = ("15", str(lo)) if d > 0 else (str(lo), "15")
                    elif st and st[0] == "sets":
                        if draw: sa = sb = "1"
                        else:
                            lo = "0" if abs(d) > 5 else "1"; sa, sb = ("2", lo) if d > 0 else (lo, "2")
                    elif st and st[0] == "halb":
                        if draw: sa = sb = "1"
                        else:
                            w, l = ("2", "0") if abs(d) > 7 else ("1,5", "0,5"); sa, sb = (w, l) if d > 0 else (l, w)
                    else:
                        if draw: vb = va
                        sa, sb = fmt(va), fmt(vb)
                    pa, pb = (1, 1) if draw else ((2, 0) if d > 0 else (0, 2))
                    win = a if d > 0 else b
                    mv = -1 if draw else rnd.choices(best[win][di], weights=[5, 3, 2][:len(best[win][di])])[0]
                    row.append([pa, pb, sa, sb, 0 if draw else round(d, 1), mv])
                day["f"].append(row)
            for side, di in enumerate(MD[mi]):
                if DIS[di][0] not in POD: continue
                pods = []
                for i in range(0, len(fl), 2):
                    four = [fl[i][0], fl[i][1], fl[i + 1][0], fl[i + 1][1]]
                    order = sorted(four, key=lambda tc: -vals[(side, tc)])
                    mv = rnd.choices(best[order[0]][di], weights=[5, 3, 2][:len(best[order[0]][di])])[0]
                    pods.append([[tc, fmt(vals[(side, tc)])] for tc in order] + [mv])
                day["p"][str(side)] = pods
            res[lg].append(day)
    return res
def table(res, lg, n):
    pts = {t: 0 for t in T if T[t]['l'] == lg}; vh = dict.fromkeys(pts, 0.0)
    for mi in range(n):
        day = res[lg][mi]
        for row in day['f']:
            for r in row[2:]:
                if r: pts[row[0]] += r[0]; pts[row[1]] += r[1]; vh[row[0]] += r[4]; vh[row[1]] -= r[4]
        for pods in day['p'].values():
            for pod in pods: pts[pod[0][0]] += 2; pts[pod[1][0]] += 1
    order = sorted(pts, key=lambda t: (-pts[t], -vh[t], T[t]['sp']))
    return order, pts
want = sys.argv[2] if len(sys.argv) > 2 else None
pick = None
for seed in range(1, 4000):
    res = sim(seed)
    o2, p2 = table(res, 2, 12); o1, p1 = table(res, 1, 12)
    r = o2.index('V-W')
    f2, pf2 = table(res, 2, 20)
    if r == 3 and p2[o2[2]] - p2['V-W'] == 1 and p2[o2[0]] - p2['V-W'] <= 5 and 10 <= o1.index('N-N') <= 13 and p1[o1[0]] - p1[o1[1]] <= 2 and f2.index('V-W') <= 2:
        pick = seed; break
print('seed', pick, file=sys.stderr)
res = sim(pick)
for lg in (1, 2):
    o, p = table(res, lg, 12); print(lg, [(t, p[t]) for t in o], file=sys.stderr)
    o, p = table(res, lg, 20); print(lg, 'final', [(t, p[t]) for t in o], file=sys.stderr)
out = {"T": T, "P": P, "DIS": [[d[0], d[1], d[2], d[3], 1 if d[0] in POD else 0] for d in DIS], "MD": MD, "R": res}
js = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
open(S + '/data.json', 'w').write(js)
print(len(js), len(P), file=sys.stderr)
print({t: (T[t]['mw'], T[t]['geh'], T[t]['cash'], T[t]['k']) for t in ('M-M', 'N-N', 'V-W')}, file=sys.stderr)
print([P[i] for i in T['V-W']['stars']], [P[i] for i in T['N-N']['stars']], file=sys.stderr)
print(sum(1 for p in P if not p[1]), 'ohne Portrait', file=sys.stderr)
