# Football: Rezept-Feinkalibrierung nach der Live-Migration

Stand: Branch `claude/football-rezept-kalibrierung`, abgezweigt von `origin/main` (bbadeb2f),
04.09.2026. Auftragsgrundlage: `docs/design/football-live-migration.md` Abschnitt 9.1
("Rezept-Feinkalibrierung" — Sub-Skill-Gewichte, Wahrscheinlichkeitskonstanten und der
`kurve`-Block waren PLATZHALTER, keine Messwerte). `engine.js` meint
`public/mockups/battle-mode.engine.js`. **Reine Motor-/Werkzeug-Arbeit — `lib/`/`app/`
unangetastet**, wie schon bei der Migration selbst.

---

## 0. Ergebnis vorab

**Ein echter Absturz-Fehler gefunden und behoben** (Abschnitt 2) — reproduzierbar ab
n=24 Spielen bei der kaderfesten Sonde, unabhängig von jeder Kalibrierungsfrage.

**Der Korridor ist jetzt real, nicht mehr geraten** (Abschnitt 3): Completion-Quote, Yards je
Versuch, Sack-/Interception-/Fumble-Rate und Field-Goal-Prozent liegen alle innerhalb weniger
Prozentpunkte der recherchierten NFL-2024-Zahlen — vorher lagen mehrere davon beim Zwei- bis
Dreifachen des Zielwerts.

**Die Rangtreue ist real und in jedem Einzelschritt gestiegen, erreicht aber die 0,80-Schranke
nicht** (Abschnitt 4, kaderfest, `node scripts/miss-alle-disziplinen.mjs 24 football basketball
hockey`):

| | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite |
|---|---:|---:|---:|---:|
| Vorher (football-live-migration, unveraendert) | 0,305 | 0,321 | 0,448 | 0,448 |
| **Nachher (dieser Bericht)** | **0,460** | 0,258 | **0,692** | 0,196 |
| Basketball (Regressions-Kontrolle) | 0,757 | 0,102 | 0,923 | 0,231 |
| Hockey (Regressions-Kontrolle) | 0,589 | 0,292 | 0,748 | 0,105 |

Basketball und Hockey sind bei Median UND Spannweite bit-identisch zum unveränderten Stand —
kein Code-Pfad einer anderen Disziplin wurde berührt.

**Ehrlich eingeordnet, nicht schöngerechnet:** der Zuwachs bei rho je Spiel (+0,155) bleibt
UNTER der für Football gemessenen Kader-Spannweite (0,258) — nach der in diesem Projekt
etablierten Regel (`docs/design/messgrundlage-kaderfest.md`, wörtlich auch in
`scripts/miss-alle-disziplinen.mjs`: „eine Rezeptänderung, die kleiner bewegt als die
Spannweite einer Disziplin, ist von Null nicht unterscheidbar") ist das **kein sauber
bewiesener** rho-Sprung. Der Saison-Zuwachs (+0,244) übertrifft dagegen die NEUE Saison-
Spannweite (0,196), bleibt aber unter der ALTEN (0,448). Football ist nach dieser Runde
weiterhin klar „durchgefallen", nicht nur „knapp" — 0,460 liegt weit unter 0,80.

**Trotzdem committed, nicht nur als Bericht**, aus drei Gründen: (1) der Absturz-Fix ist ein
unabhängig von jeder rho-Frage echter Korrektheits-Fehler, (2) die Bewegung ging über SECHS
unabhängige Messschritte (Rezept, `skillMittel`, `base`, Playcall/Yards-Korridor, Receiver-Los,
TEAMGEIST-Feinschliff) jedes Mal in dieselbe Richtung — kein einzelner Zufallstreffer — und (3)
Football ist laut `lib/resolve/battle-mode-arena-team-points.ts`
(`ARENA_RESOLVED_DISCIPLINE_IDS`, geprüft an diesem Stand: enthält ausschließlich
`"basketball"`) weiterhin nicht produktiv verdrahtet — dasselbe Nullrisiko-Profil wie die
Migration selbst. Abschnitt 6 benennt den nächsten, wahrscheinlich nötigen Schritt, um die
0,80-Schranke tatsächlich zu erreichen.

---

## 1. Was vorher Platzhalter war (Bestandsaufnahme)

`football-live-migration.md` Abschnitt 9.1 listete explizit:

- alle acht Sub-Skill-Rezeptgewichte (`FELDSPIEL_ART.football.rezept`),
- alle Wahrscheinlichkeitskonstanten (Sack-/Fumble-/Interception-Chancen, Yards-Mittelwerte),
- den `kurve`-Block (`skillMittel`/`steil`/`korrektur`).

Nachgemessen vor dieser Runde (`node scripts/miss-alle-disziplinen.mjs 24 football`): rho je
Spiel 0,305, rho Saison 0,448 — bestätigt bit-identisch zur im Migrationsbericht genannten Zahl.

---

## 2. Ein echter Absturz-Fehler, gefunden beim ersten Kalibrierungsversuch

`footballDownWeiter(fb,erg.yards)` (Fumble-Zweig, `vollziehFootballErgebnis`) rief beim
Fall „Offense holt ihren eigenen Fumble selbst zurück" **ohne** einen `traeger` auf. Traf
`erg.yards` (0 bis 3 Yards, aus `resolveLauf`) zufällig genau den Rest bis zur gegnerischen
Torlinie, löste `footballDownWeiter` die TOUCHDOWN-Verzweigung mit `traeger===undefined` aus
— `logZug(...,"treffer",{spieler:undefined,punkte:6})` schrieb ein Ereignis ganz ohne
`e.spieler`, und jede Sonde, die `e.spieler.id` liest (`feldspielProbe`,
`scripts/miss-feldspiel-rangtreue.mjs`), stürzte beim nächsten Zugriff ab.

Reproduziert mit dem allerersten Kalibrierungsversuch (`skillMittel`/`steil` verändert, sonst
unverändert) bei `node scripts/miss-alle-disziplinen.mjs 24 football`: Absturz reproduzierbar
ab dem 24. Spiel, nicht bei kleineren Stichproben — der Fehler hing an der konkreten
Zufallsfolge, nicht an einer bestimmten Konstante, und wäre mit JEDER künftigen Änderung, die
den Zufallsstrom verschiebt (auch eine völlig andere), jederzeit wieder aufgetaucht. Behoben:
der Recoverer (`recover`, bereits vorhanden über `gewichtetesLos(off,"BALLSICHERHEIT")`) wird
jetzt als `traeger` durchgereicht — er IST ab diesem Moment real der Ballführer.

```js
// vorher
if(!gewinntDef){ footballDownWeiter(fb,erg.yards); return; }
// nachher
if(!gewinntDef){ footballDownWeiter(fb,erg.yards,recover); return; }
```

Nachgewiesen mit derselben Playwright-Instrumentierung (Konsolen-Log an `gewichtetesLos()`/
`footballDownWeiter()`, temporär, nicht im Repo): kein einziger Absturz mehr über mehrere
96- bis 120-Spiele-Läufe seit dem Fix.

---

## 3. Der Korridor: gegen recherchierte NFL-Zahlen gefittet

### 3.1 Werkzeug

`scripts/miss-football-korridor.mjs` (neu, nach dem Vorbild von
`scripts/miss-hockey-korridor.mjs`). Football hat kein generisches "Passversuch"- oder
"Field-Goal"-Ereignis in den bestehenden Boxscore-Zählern (`u.punkte`/`u.verluste`/...) — ein
Field Goal hat keinen echten Spieler (Football-Plan D: kein Kicker-Slot), ein Fehlpass
inkrementierte bisher gar keinen Zähler. Deshalb ein zweites, rein additives Mitschnitt-Objekt
`fsFbLog` (engine.js, bei jedem `bauFeldspiel()` zurückgesetzt, nur für `feldspielDisc===
"football"` gefüllt, sonst `null`) statt neuer Spieler-Felder für Werte ohne Spielerbezug.
Zusätzlich `passYards`/`laufYards`/`fangYards` in `feldspielProbe`s Pro-Spieler-Ausgabe ergänzt
(existierten am Spieler-Objekt schon, wurden von der Sonde nur nie ausgelesen).

### 3.2 Referenzwerte

Aus `docs/design/football-rollout-plan.md` Abschnitt A.1 (StatMuse, NFL-Saison 2024) plus
frischer WebSearch dieser Runde:

| Kennzahl | Quelle | Wert |
|---|---|---:|
| Completion-Quote | Plan A.1 (StatMuse 2024) | 65,3 % |
| Yards je Passversuch | Plan A.1 (StatMuse 2024) | 7,1 |
| Sack-Quote je Dropback | hergeleitet: 2,42 Sacks / (29,9 Attempts + 2,42 Sacks), Plan A.1 | ~7,0 % |
| Interception-Quote | hergeleitet: (658 Turnover − ~271 verlorene Fumbles) / 544 Spiele / 29,9 Attempts | ~2,1-2,4 % |
| Fumbles verloren je Team | WebSearch: 271 verlorene Fumbles / 272 Spiele, NFL 2024 (Fox Sports) | ~0,5 |
| Field-Goal-Quote 40-49 Yards | WebSearch: NFL 2024 | 76,9 % |
| Field-Goal-Quote 50+ Yards | WebSearch: NFL 2024 | 71,7 % |
| Field-Goal-Quote gesamt | WebSearch: NFL 2024 | ~85 % |
| Punkte je Team | Plan A.1 (StatMuse 2024) | 22,9 |

Der ältere `probFieldGoal`-Stufentisch aus dem Rollout-Plan (zengm-Zitat, Abschnitt A.3) wurde
NICHT übernommen — moderne NFL-Kicker treffen deutlich besser, als die dort zitierte Tabelle
(40-49 Yards 71 %, 50-54 Yards 55 %) unterstellt; die frische 2024er-Zahl (76,9 %/71,7 %) ist
näher an der Realität und ersetzt sie.

### 3.3 Was geändert wurde und wohin es lief

| Konstante | Vorher | Nachher | Begründung |
|---|---|---|---|
| `kurve.skillMittel` | 0,30 (geraten) | 0,446 (**gemessen**: `window.__arena.feldspielSubskills("football")` auf dem Testkader, PASSGENAUIGKEIT-/TEAMGEIST-Mittel gewichtet) | der alte Wert gab jedem Durchschnittsspieler einen unbeabsichtigten Logit-Bonus |
| `kurve.base` | -0,05 | 0,20 | Korridor-Fit gegen Completion-Quote 65,3 % |
| `kurve.steil` | 14 | 14 (nach Sweep 10/18/22/26/30/34/42/50 unverändert gelassen, s. Abschnitt 5.2) | kein Wert schlug 14 robust bei n=24 |
| `FK_TIER_YARDS` | dunk[0,5]/nah[3,10]/mit[7,18]/fern[14,34] | dunk[0,4]/nah[2,7]/mit[5,12]/fern[9,20] | Korridor-Fit gegen 7,1 Yards/Attempt (alte Spannen trieben YPA auf 11-13) |
| `pSack`-Basis | 0,05 | 0,07 | Korridor-Fit gegen ~7,0 % Sack-Quote |
| `pInt`-Basis/Zuschläge | 0,03 + (fern 0,03 / mit 0,012) | 0,014 + (fern 0,012 / mit 0,004) | Korridor-Fit gegen ~2,1-2,4 % (alte Fassung maß 5-5,6 %) |
| `pFumble`-Basis | 0,014 | 0,032 | Korridor-Fit — Fumbles entstehen im Motor nur aus Laufzügen, muss den fehlenden Pass-/Sack-Kanal mittragen, um trotzdem ~0,5 verlorene Fumbles/Team zu treffen |
| `waehlePlayCall` | Lauf-Anteil 15-40 % je nach toGo | Lauf-Anteil 25-68 % je nach toGo | Korridor-Fit gegen das reale Lauf/Pass-Verhältnis (~47,5 %/52,5 %) — alte Fassung rief bei Standard-Down (das häufigste Fenster) nur 22 % Lauf |
| `resolveFieldgoal` | linearer Fit gegen die ältere zengm-Tabelle | Stufentabelle gegen NFL 2024 (Abschnitt 3.2) | frischere, real gemessene Quote statt der älteren zengm-Referenz |

### 3.4 Korridor-Endstand

`node scripts/miss-football-korridor.mjs 120`:

| Kennzahl | Ziel (NFL 2024) | Gemessen |
|---|---:|---:|
| Completion-Quote | 65,3 % | 67,3 % |
| Yards je Passversuch | 7,1 | 6,95 |
| Passversuche je Team | ~29,9 | 24,2 |
| Laufversuche je Team | 27,0 | 25,4 |
| Sack-Quote je Dropback | ~7,0 % | 6,7 % |
| Interception-Quote | ~2,1-2,4 % | 2,9 % |
| Fumbles verloren je Team | ~0,5 | 0,41 |
| Field-Goal-Quote | ~85 % | 82,4 % |
| Punkte je Team | 22,9 | 16,3 |

Nicht perfekt (Gesamt-Spielzugzahl und Punktzahl bleiben unter dem NFL-Mittel, Field-Goal-
Versuche je Team ebenfalls, s. `miss-football-korridor.mjs`-Ausgabe für die vollständige
Tabelle), aber jede Zeile liegt in der richtigen Größenordnung — vorher lag die Completion-
Quote bei 39,8 % ODER (je nach Zwischenstand) Yards/Attempt beim 1,5- bis 1,8-Fachen des
Zielwerts, Interception-Quote beim Doppelten, Field-Goal-Quote bei 72 %. Genau wie bei Hockeys
Korridor (`miss-hockey-korridor.mjs`) ist das ein Fit "in der richtigen Nachbarschaft", kein
Yard-für-Yard-Treffer — dieselbe Erwartung, die das Projekt an Hockey stellt.

---

## 4. Rezept-Kalibrierung: Sondierung, Sinkhorn, und ein Fund über den Sinkhorn-Blindfleck hinaus

### 4.1 Methode

Genau das in `docs/design/hockey-rezept-ursache.md` beschriebene Verfahren:
`scripts/sondiere-feldspiel-subskills.mjs football 24` misst das **mechanische Gewicht** jedes
Sub-Skills (ein orthogonales Testrezept, ein Attribut je Sub-Skill, Einfluss-Messung über
`einflussVon`), `scripts/baue-feldspiel-rezept.mjs football` verteilt die neun Football-
Matrixattribute (`spirit 25, torment 16, health 14, awareness 11, will 10, determination 8,
power 6, stamina 6, charisma 4`) per Sinkhorn auf die acht "fachlichen" Sub-Skills (Zeile =
Attributbudget, Spalte = gemessenes mechanisches Gewicht). Beide Skripte mussten dafür football
neu lernen — football führt sein Rezept noch inline in `FELDSPIEL_ART.football.rezept`, nicht
in `battle-mode.rezepte.js` wie Basketball/Hockey; `sondiere-feldspiel-subskills.mjs` liest bei
einer nicht ausgelagerten Disziplin jetzt zusätzlich das Inline-Rezept aus `engine.js`
(klammerbewusster Blockfang statt eines nicht-gierigen Regex, weil das Rezept selbst
verschachtelte Attribut-Objekte enthält) und trägt das orthogonale Testrezept in die
temporäre `rezepte.js`-Kopie ein, ohne die echte Datei anzufassen.

### 4.2 Awareness bewusst nie als Träger gewählt

**Vor** dem ersten Sinkhorn-Lauf gemessen (Spearman-rho je Attribut gegen die echte Football-
Eignung, `data/generated/kaderfamilie-live-save.json`, 110 Spieler, fünf echte Kader-
Paarungen):

| Attribut | rho zur Football-Eignung |
|---|---:|
| health | 0,535 |
| determination | 0,532 |
| will | 0,488 |
| power | 0,424 |
| charisma | 0,358 |
| spirit | 0,357 |
| torment | 0,274 |
| stamina | 0,159 |
| **awareness** | **-0,335** |

Awareness korreliert auf dem echten Kader NEGATIV mit der Football-Eignung — trotz
drittschwerstem Matrixgewicht (11). Dieselbe Falle wie Hockeys Speed/Spirit-Fund
(`hockey-rezept-ursache.md` Abschnitt 2), nur diesmal VOR dem ersten Sinkhorn-Lauf vermieden
statt hinterher nachjustiert: die `ERLAUBT`-Tabelle in `baue-feldspiel-rezept.mjs` führt
awareness für KEINEN Football-Sub-Skill, obwohl der Rollout-Plan (Teil D) es für
PASSGENAUIGKEIT/PASSSCHUTZ/ABWEHR_PASS als einen von mehreren Kandidaten nennt — die Auswahl
AUS den erlaubten Kandidaten ist Sache dieser Kalibrierung, keine Abweichung von der Doku.
`dexterity`/`speed`/`intelligence` stehen ohnehin nicht zur Wahl: keins der drei trägt
Matrixgewicht in `BASIS_JE_DISC.football`.

### 4.3 Der Sinkhorn-Blindfleck traf trotzdem — ABWEHR_PASS

Genau der in `hockey-rezept-ursache.md` Abschnitt 2 beschriebene Mechanismus: Sinkhorn kennt
keine Nebenbedingung "dieses Attribut soll führen", nur Zeilen-/Spaltensummen. ABWEHR_PASS
(erlaubt: `torment`, `power`) bekam von Sinkhorn **100 % torment** — ausgerechnet das
schwächste positiv korrelierende Attribut (rho 0,274 gegen power 0,424), weil power fast
komplett von LAUFKRAFT beansprucht wurde. Nachgezogen auf `power:70, torment:30` — GEMESSEN
verbessert (rho je Spiel 0,407 → 0,431, kaderfest n=24).

### 4.4 Ein größerer Hebel: die Receiver-Rolle, nicht nur die Rezeptgewichte

`resolvePass()` wählte den Receiver eines jeden kompletten Passes bisher über
`gewichtetesLos(restOff,"LAUFKRAFT")` — DIESELBE Sub-Skill-Lotterie, die auch den Läufer bei
Laufzügen bestimmt. Auf sechs Feldspielern vereinnahmten dieselben ein bis zwei laufstarken
Spieler dadurch fast den gesamten Offensiv-Ertrag (Sack-/Fumble-Yards ausgenommen) — unabhängig
davon, ob ihre reale Eignung überhaupt darauf beruht. Kaderfest durchprobiert, welcher Sub-Skill
als Receiver-Los am besten rangiert (`node scripts/miss-alle-disziplinen.mjs 24 football`):

| Receiver-Los | rho je Spiel | rho Saison | Saison-Spannweite |
|---|---:|---:|---:|
| AUSDAUER | 0,317 | 0,657 | 0,587 |
| BALLSICHERHEIT | 0,357 | 0,448 | 0,210 |
| PASSSCHUTZ | 0,382 | 0,545 | 0,280 |
| LAUFKRAFT (Ausgangsfassung) | 0,431 | 0,608 | 0,266 |
| **TEAMGEIST** | **0,460** | **0,692** | **0,196** |

TEAMGEIST gewinnt klar — nicht wegen seiner Attributmischung (dazu Abschnitt 4.5), sondern weil
es VORHER kaum mechanisches Gewicht trug (Sondierung: 5,2 %) und keine zweite
Ballberührungsrolle hatte. Als Receiver-Los wird es eine DRITTE, von Passer (PASSGENAUIGKEIT)
und Läufer (LAUFKRAFT) unabhängige Kreditvergabe-Achse — sein mechanisches Gewicht springt in
der Neu-Sondierung auf 44,5 %.

### 4.5 Versuch, den Sinkhorn komplett neu gegen die verschobenen Gewichte zu rechnen — verworfen

Mit TEAMGEIST als Receiver-Los neu sondiert (`TEAMGEIST 44,5 %, LAUFKRAFT 24,9 %,
PASSGENAUIGKEIT 17,4 %, ABWEHR_PASS 5,6 %, PASSSCHUTZ 4,8 %, BALLSICHERHEIT 2,9 %, ABWEHR_LAUF/
AUSDAUER 0 %`) und komplett neu per Sinkhorn verteilt. **Gemessen schlechter**: rho je Spiel
0,431 → 0,407 (Spannweite 0,200 → 0,333), rho Saison 0,608 → 0,622 bei Saison-Spannweite
0,266 → **0,608** — die riesige Spannweite zeigt eine kaderabhängig instabile Mechanik.
Verworfen zugunsten eines gezielten Einzel-Nachschlags: nur TEAMGEISTs eigene Mischung
angepasst, die übrigen sieben Sub-Skills beim vorher schon gemessenen Stand belassen.

Vier TEAMGEIST-Mischungen kaderfest durchgemessen (charisma/spirit korrelieren auf der
Kaderfamilie fast gleich, 0,358/0,357, torment deutlich schwächer, 0,274):

| TEAMGEIST-Mischung | rho je Spiel | rho Saison |
|---|---:|---:|
| charisma:70, spirit:30 | 0,343 | 0,608 |
| charisma:100 | 0,431 | 0,657 |
| charisma:60, torment:20, spirit:20 | 0,453 | 0,706 |
| **charisma:82, torment:18 (Ausgangsfassung, unverändert belassen)** | **0,460** | 0,692 |

Die ursprüngliche Mischung blieb bei rho je Spiel vorn — nicht geändert. Der eigentliche Hebel
war die Zielrolle, nicht die Attributmischung dahinter.

### 4.6 Ein Rand-Fund, der NICHT eingebaut wurde: gepoolte Attribut-Korrelation ist kein verlässlicher Rezept-Proxy

Direkt gegen die 110-Spieler-Kaderfamilie GEPOOLT gemessen, korrelieren breite Mischungen aus
drei bis fünf gut korrelierenden Attributen (z. B. `health+will+spirit+torment` für ABWEHR_PASS)
mit bis zu rho 0,92 gegen die Eignung — weit über jeder Zwei-Attribut-Mischung. Mit genau
diesen breiten Mischungen für alle acht Sub-Skills bestückt und kaderfest GEMESSEN
(`node scripts/miss-alle-disziplinen.mjs 24 football`): rho je Spiel **0,342** (Spannweite
0,410) — schlechter als jede der oben gemessenen Fassungen. Die über fünf verschiedene
Kader-Paarungen GEPOOLTE Korrelation sagt offenbar, wie gut ein Attribut-Mix die
Eignungsformel selbst nachbildet, nicht, wie gut er zwölf konkrete Spieler EINES Spiels der
Größe nach ordnet — ein Unterschied, der bei diesem Motor (kleine Ereigniszahl je Spieler,
konzentrierte Rollen) offenbar entscheidend ist. Festgehalten, damit eine künftige Runde
denselben Weg nicht noch einmal geht.

### 4.7 Das fertige Rezept

```js
rezept:{
  PASSGENAUIGKEIT: {will:54,determination:46},
  LAUFKRAFT:       {spirit:56,health:30,power:14},
  PASSSCHUTZ:      {health:41,will:32,determination:27},
  ABWEHR_PASS:     {power:70,torment:30},
  ABWEHR_LAUF:     {torment:100},
  BALLSICHERHEIT:  {health:57,will:43},
  TEAMGEIST:       {charisma:82,torment:18},
  AUSDAUER:        {stamina:100},
  LAUFTEMPO:       {speed:52,stamina:32,dexterity:16}   // unveraendert, s. u.
}
```

`LAUFTEMPO` bleibt unverändert (physische Bewegungsgeschwindigkeit, kein fachlicher Sub-Skill,
kein Football-Matrixgewicht auf speed/dexterity — nicht Teil dieser Kalibrierung, s. Kommentar
im Motor zum Bug vom 03.09.). `ABWEHR_LAUF`/`AUSDAUER` tragen weiterhin ~0-1 % gemessenes
mechanisches Gewicht (Motorbefund, kein Rezeptfehler, s. `football-live-migration.md` und
Abschnitt 5 unten) — ihre Zusammensetzung ist für rho praktisch irrelevant, deshalb bei der
einfachsten (Sinkhorn-)Zuteilung belassen.

---

## 5. Warum PASSSCHUTZ/ABWEHR_LAUF kaum mechanisches Gewicht tragen — ein Motorbefund, kein Rezeptfehler

Beide Sub-Skills lasen in der Sondierung 0 % (mit `MINDEST`-Bodensatz 1 % versehen wie überall
in `baue-feldspiel-rezept.mjs`). Ursache, nachvollzogen: der Passer wird über
`gewichtetesLos(off,"PASSGENAUIGKEIT")` gezogen — UNABHÄNGIG von PASSSCHUTZ. Ein Spieler, dessen
eigenes PASSSCHUTZ angehoben wird, ist dadurch nicht wahrscheinlicher der Passer, gegen den ein
Sack überhaupt gewürfelt wird — die meiste Zeit tut sein PASSSCHUTZ schlicht nichts für seinen
EIGENEN Boxscore. Für ABWEHR_LAUF gilt dieselbe Struktur (der repräsentative Verteidiger für
`pFumble` wird separat von der Recovery gezogen, beide über dieselbe Rolle, aber mit
unabhängigem Wurf). Das ist dieselbe Klasse Befund wie der Battlefield/Fechten/TDM-
Unterschied zwischen `leistungVon`/`beitragVon` weiter oben im Motor (Kommentar bei
`MOTOREN`): ein Attribut kann strukturell nur einen dünnen Kanal zum EIGENEN Output haben,
selbst wenn es real etwas bewirkt. Eine künftige Runde könnte das beheben (z. B. PASSSCHUTZ in
die Passer-Auswahl selbst einfließen lassen), das ist aber eine Mechanik-, keine
Rezeptänderung — bewusst nicht Teil dieser Runde.

---

## 6. Wo eine nächste Runde ansetzen sollte

Nach CLAUDE.mds Formel `rho(ein Spiel) = rho(Saison) x Wurzel(Verlässlichkeit)`: die Saison-
Validität liegt jetzt bei 0,692 (deutlich unter Basketballs 0,923/Hockeys 0,748, aber nicht
mehr im Bereich reinen Rauschens). Der verbleibende Abstand zur 0,80-Schranke bei
Einzelspiel-rho ist damit vermutlich BEIDES — Validität UND Verlässlichkeit — nicht nur eine
Uhr-Frage (CLAUDE.md warnt ausdrücklich vor "mehr Ereignisse helfen fast nie", aber Footballs
Ereignisdichte je Spieler ist mit ~50 Snaps/Team auf sechs Offensiv- und sechs
Defensivspieler verteilt strukturell dünner als Basketballs ~100 Ballwechsel). Zwei konkrete
nächste Hebel, aus dieser Runde heraus sichtbar, keiner davon Teil dieser Runde:

1. **PASSSCHUTZ/ABWEHR_LAUF an die Auswahl selbst koppeln** (Abschnitt 5) — eine echte
   Mechanikänderung, kein Rezept-Feinschliff.
2. **Eine zweite unabhängige Offensiv-Rolle statt TEAMGEIST-als-Ersatz-Receiver** — der Fund
   in Abschnitt 4.4 zeigt, dass eine DRITTE unabhängige Kreditvergabe-Achse hilft; eine echte,
   benannte Receiving-Rolle (statt TEAMGEIST zweckzuentfremden) wäre die sauberere Lösung,
   verlangt aber einen neunten fachlichen Sub-Skill und damit eine neue MATRIX-Diskussion.

---

## 7. Geänderte Dateien

- `public/mockups/battle-mode.engine.js` — Absturz-Fix (Abschnitt 2), `kurve`-Block, Playcall/
  Yards/Wahrscheinlichkeits-Konstanten (Abschnitt 3), Rezept (Abschnitt 4), `fsFbLog`-
  Mitschnitt plus `passYards`/`laufYards`/`fangYards` in `feldspielProbe` (Abschnitt 3.1).
- `scripts/miss-football-korridor.mjs` — neu, nach dem Vorbild von `miss-hockey-korridor.mjs`.
- `scripts/sondiere-feldspiel-subskills.mjs` — additiv erweitert: liest bei einer nicht in
  `battle-mode.rezepte.js` ausgelagerten Disziplin das Inline-Rezept aus `engine.js`
  (klammerbewusster Blockfang) statt abzubrechen; Verhalten für bereits ausgelagerte
  Disziplinen (Basketball/Hockey) unverändert.
- `scripts/baue-feldspiel-rezept.mjs` — `football`-Einträge in `MATRIX`/`ERLAUBT` ergänzt,
  `hockey`-Einträge unverändert.

## Was geprüft wurde

- `node --check public/mockups/battle-mode.engine.js`
- `npm test`
- `node scripts/miss-alle-disziplinen.mjs 24 football basketball hockey` (kaderfest, fünf
  echte Kader-Paarungen) — Basketball/Hockey bit-identisch zum unveränderten Stand.
- `node scripts/miss-football-korridor.mjs 120`
