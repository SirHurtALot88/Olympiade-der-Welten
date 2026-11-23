# Ergebnisskala E1: ein vergleichbares Team-Ergebnis je Disziplin (18.11.)

Auftrag, Chris am 18.11., wörtlich: „denk dran, das muss auch für die Ergebnisse der Diszis passieren.
Top-Ergebnis ist quasi ein 10–0, wo der Gegner plattgemacht wurde, kann aber auch 2–3 oder so sein,
wenn beide Teams schwach performen. Bekommst du das hin? Damit das Punkteverhältnis, das die Teams
holen, vergleichbar ist und nicht durch eine Diszi kaputtgerissen wird, weil man 4000 Punkte in
Takeshi oder so holt.“

Gehört zusammen mit der PP-Skala C2 (`docs/design/pp-skala-18-11.md` Abschnitt 8): beide hängen am
selben Saison-Stempel (`seasonState.wertungsSkalen`) und werden zum Saisonwechsel scharf.

---

## 0. Kurzfassung

1. **Die Roh-Zahlen landen heute nirgends in Tabelle oder Verhältnis.** Tabelle = 2/1/0 je Duell
   (Pod 2-1-0-0), „Verh.“ = Summe eines auf 0..10 begrenzten Abstands D je Begegnung. 4000
   Takeshi-Punkte können das Verhältnis also nicht sprengen. **Das Problem steckt in den Ankern**
   (Abschnitt 1.3): sechs Arena-Disziplinen haben keine Marge-Referenz (jeder Sieg ±5, egal ob knapp oder
   Kantersieg), bei Breaking und Tennis liegt die Referenz bei 1 (jeder Sieg ±10), das Niveau einer
   Arena-Disziplin kommt aus der Aufstellungsstärke (PPS-Score), nicht aus der Leistung im Spiel.
   Gemessen verteilt sich das Verhältnis deshalb sehr ungleich auf die Disziplinen (Abschnitt 4).
2. **E1 behält die Form vom 19.10.** (Abstand D aus der Marge, Niveau aus der Stärke beider Seiten,
   `V = c − D/2`, `W = V + D`) und legt beide Größen auf **gemessene Anker je Disziplin und
   Feldgröße**:
   - **D** aus der Lage der Siegmarge in der gemessenen Verteilung, für alle Disziplinen dieselbe
     Kurve: Median-Sieg → 3, oberste 2,5 % → 10, knappster Sieg → 1, Remis 0.
   - **Niveau** aus der **mittleren Spieler-PP beider Seiten** (Skala C2, also schon über alle
     Disziplinen geeicht): die absolute Leistung im Spiel, nicht die Aufstellung.
   - Ergebnis: Kantersieg 10:0, Median-Sieg zweier mittlerer Teams 7:4, knapper Sieg zweier
     schwacher Teams 3:2, Remis zweier starker Teams 8:8.
3. **Vierergruppen und FFA** (Mini-DM, Battlefield, Takeshi's Castle, Staffel, Bahn-Pods): Regel
   „Leiter“. Die Spanne Platz 1 bis 4 kommt aus der gemessenen Verteilung der Pod-Spannen (Median
   → 7, oberste 2,5 % → 10), jede Lücke mindestens 1 (ein besserer Platz liegt **immer** höher),
   Verhältnis = eigener Wert minus Mittel der drei Gegner („drei virtuelle Duelle, gemittelt“),
   Summe je Pod 0.
4. **Garantien**: wer im Motor gewinnt, gewinnt auf der Skala; ein Remis bleibt ein Remis; ein
   besserer Pod-Platz hat den höheren Wert. Geprüft an allen gemessenen Begegnungen (0 Verstöße)
   und im Test über alle Leitern 0..10.
5. **Motor unberührt**: Wertungs-Fingerabdruck GESAMT `ce8fcef66028` (75 Einträge). Rangtreue und
   Pp-Abweichung sind Motor-Größen und bleiben, was `data/generated/disziplin-abnahme.json` sagt.
6. **Gezeigt = gebucht**: dieselben Funktionen (`lib/resolve/ergebnis-skala.ts`) schreiben
   `ergebnisNormiert`, `verhaeltnis` und `miniDmPod.wert`; Tabelle, Saisonstand, Startseite, Nach dem
   Spieltag und die Arena lesen die gebuchten Werte. Die Arena zeigt ihre native Zahl **und** die
   Skala: „87 : 79 → 7 : 4“.
7. **Übergang**: Schalter `OLY_ERGEBNIS_SKALA`, Standard AN ab der nächsten Saison (Abschnitt 6).

Messwerte: Abschnitt 4.

---

## 1. Ist-Stand

### 1.1 Wie ein Disziplin-Ergebnis je Team entsteht

| Format | Disziplinen | Wer gewinnt | Rohzahl (`duellSeiten` / Pod) | Datei |
|---|---|---|---|---|
| Arena-Duell | die arena-aufgelösten Zweier-Disziplinen (Feldspiel, Bühne, Bahn, Kampf) | Motor-Seitenstand (`ArenaFixtureResult.seiten`), Tiebreak (Gewichtheben kg) als `outcome` | Punkte (Basketball 87:79), Treffer (Fechten), gewonnene Runden (TDM 3:1), Überlebende (Breaking), Sätze (Tennis), Platzpunkte (Climbing/Staffel), Sieg 1:0 (Zeitfahren), Auftrittssummen (Showcase, Eiskunstlauf, Wettessen bis ~1.300) | `battle-mode-arena-team-points.ts:1112` |
| PPS-Duell-Brücke | jede Disziplin ohne gezähltes Arena-Ergebnis | PPS-Team-Score beider Seiten | PPS-Score (~50..400) | `battle-mode-pps-duell.ts:220` |
| Vierergruppe (Pod) | Mini-DM (FFA), Battlefield (Gefecht je Ort), Takeshi's Castle und Staffel (Vier-Team-Rennen) | Platz im Pod | FFA-Wert `v_t`, Kampfrichterwertung, Burgpunkte, Zielzeit bzw. PPS-Score | `mini-dm-pod-resolve.ts`, `bahn-pod-resolve.ts`, `battlefield-pod-matchday.ts` |

Gebucht wird je Team-Zeile (`DisciplineResultRecord`): `teamPoints` (2/1/0 bzw. 2-1-0-0), `marge`
(Rohabstand zum Gegner bzw. zum nächstbesseren Platz), `verhaeltnis` (±D), `margeM90`,
`duellSeiten`, `ergebnisNormiert` (0..10 je Seite) bzw. `miniDmPod.wert` (0..10 je Team).

### 1.2 Wohin die Zahlen fließen

| Abnehmer | liest | Datei |
|---|---|---|
| Tabelle „Punkte“, S-U-N | `teamPoints` (2/1/0) | `season-points-ledger.ts` (`tableGroupContributions`), `standings-bilanz.ts` |
| „Verh.“ (Tiebreaker nach Punkten) | Σ `verhaeltnis` der gebuchten Zeilen der Saison | `standings-verhaeltnis.ts`, `standings-tiebreaker-policy.ts` |
| Verh. je Bereich (POW/SPE/MEN/SOC) | dieselbe Summe je Bereich | `summiereSaisonVerhaeltnisProBereich` |
| Saisonstand (Matrix, Paarungen) | `ergebnisNormiert`, sonst `duellSeiten`; Pods Platz | `saisonstand-modern-logik.ts:316`, `SeasonStandingsModern.tsx:813`, `SeasonStandingsNewLook.tsx:3222` |
| Startseite | `ergebnisNormiert`, `verhaeltnis` | `startseite-modern.ts:233/279` |
| Nach dem Spieltag | Ausgang, bisher `duellSeiten` roh | `nach-dem-spieltag.ts:132` |
| Arena („Gewertet: …“), Live-Panel | Ausgang, bisher `duellSeiten` roh, 2/1/0 | `arena-spieltag-ansicht.ts:189`, `arena-live-panels.ts:166` |
| Sponsor- und Vorstandsziele | Tabellenrang, Punkte, Disziplin-Rang nach Score | `sponsor-objective-evaluator.ts`, `team-season-objectives-service.ts` (kein `verhaeltnis`) |
| All-Time / ewige Tabelle | Liga-Punkte aus dem Saison-Archiv (`SeasonSnapshotTeamRecord.points`) | `all-time-table.ts:21` (kein `verhaeltnis`) |
| Saisonwechsel, Auf-/Abstieg | Rang (Punkte → Verh. → …) | `league-movement-service.ts`, `season-review-service.ts` |

**Die Rohzahl selbst wird nirgends summiert.** Sie steht nur als Anzeige im Saisonstand (Rückfall, wenn
`ergebnisNormiert` fehlt), in der Arena-Zeile und in „Nach dem Spieltag“.

### 1.3 Was an der Skala vom 19.10. schief ist

`D = max(1, round(10 · min(1, m / M90)))`, `M90` = 90. Perzentil der Marge aus
`data/generated/verhaeltnis-referenz.json` (gezogen am 16.–19.10.):

- **Keine Arena-Referenz** für Basketball, TDM, Football, I-Spy, Zeitfahren und Staffel im Duell:
  dort ist **jeder** Sieg D = 5 (`VERHAELTNIS_RUECKFALL_D`), ein 81:45 zählt wie ein 55:54.
- **M90 = 1** bei Breaking (Feldgröße 2–4) und Tennis (Feldgröße 2): **jeder** Sieg ist D = 10.
- **Niveau** für Arena-Disziplinen ohne Arena-Niveau-Referenz (alle) aus dem PPS-Team-Score, also
  der Stärke der Aufstellung, nicht der Leistung im Spiel. „Beide Teams performen schwach“ sieht die
  Skala nur, wenn beide schwach aufgestellt waren.
- Pods: Verhältnis = Abweichung vom Pod-Mittel, höchstens ±5 bis ±7, also halb so schwer wie ein Duell.

Die Folge (gemessen, Abschnitt 4): Breaking, Tennis und die Rückfall-Disziplinen tragen einen
übergroßen bzw. starren Teil des Saison-Verhältnisses, der Abstand im Spiel spielt dort keine Rolle.

---

## 2. Die Regel E1 (`lib/resolve/ergebnis-skala.ts`)

### 2.1 Duell

```
m  = nativer Abstand im Motor (|Seitenstand-Differenz|; Margen-Quelle "leistung": L_Sieger − L_Verlierer)
u  = Lage von m in der gemessenen Verteilung der Siegmargen (Knoten an 2,5/5/10/20/…/90/95/97,5 %;
     bei ganzzahligen Margen die Mitte der Stufe)
D  = 0 bei Remis, sonst clamp(round(f(u)), 1, 10),  f(0) = 1, f(0,5) = 3, f(≥ 0,975) = 10, dazwischen linear
L  = mittlere Spieler-PP der Seite (Skala C2)
F  = Niveau, stückweise linear durch die gemessenen p5/p50/p95 von L  -> 0,05 / 0,5 / 0,95
mu = (F(L_eigen) + F(L_gegner)) / 2,   c = 10 · mu
V  = round(clamp(c − D/2, 0, 10 − D)),   W = V + D,   Remis: W = V = round(c)
```

- **Kein Normieren auf den Spieltag**: alle Anker sind fest (Messung, Abschnitt 3), ein Ergebnis
  hängt nur von dieser einen Begegnung ab.
- **Keine bloße Differenz**: zwei schwache Teams spielen 3:2, zwei starke 8:7, ein Kantersieg
  10:0 bzw. 9:1, wenn der Verlierer stark war.
- **Margen-Quelle „leistung“**: liefert der Motor im Duell weniger als drei verschiedene Siegmargen
  (Zeitfahren meldet 1:0, Climbing/Staffel Platzpunkte), zählt statt der Marge der Leistungsabstand
  beider Seiten (mittlere C2-PP), ebenfalls aus dem Motor-Boxscore. Wer gewinnt, bleibt beim Motor.

### 2.2 Vierergruppe / FFA („Leiter“)

```
T     = Spanne Platz 1..4: g(u_Spanne), g(0) = 3, g(0,5) = 7, g(≥ 0,975) = 10   (u aus den Pod-Spannen)
Lücken = T auf die drei Abstände verteilt, anteilig zum rohen Abstand, jede mindestens 1
Werte = Leiter von unten, um 10 · mu_Pod zentriert (mu_Pod = Mittel der vier Niveaus)
Verh. = eigener Wert − Mittel der drei Gegner, ganzzahlig, Summe je Pod 0
```

Ein 10/2/1/0-Pod gibt dem Sieger +9 (wie ein 10:1-Duellsieg) und dem Letzten −4. Die Ordnung ist
streng (Test über alle 330 streng fallenden Leitern 0..10). Begründung für „Mittel der drei Gegner“:
ein Pod ist für jedes Team drei Begegnungen auf einmal; gemittelt wiegt ein Pod-Spieltag genau so viel
wie ein Duell-Spieltag, sonst trügen Pod-Disziplinen dreifach (Summe der Paarungen) oder halb so viel
(Abweichung vom Pod-Mittel, Stand 19.10.).

### 2.3 Wo es läuft

- Engine: `legacy-matchday-resolve-engine.ts` ruft nach Ausgang, Pod-Platz und Spieler-PP
  `wendeErgebnisSkalaE1An()` (`lib/resolve/ergebnis-skala-anwenden.ts`) auf, **nur** wenn die Saison
  mit `ergebnis: "e1"` gestempelt ist. Geändert werden nur `verhaeltnis`, `ergebnisNormiert`,
  `miniDmPod.wert`, `margeM90` (die verwendete Bezugsgröße) und der neue Vermerk `ergebnisSkala: "e1"`
  an der Zeile; nie `teamPoints`, `rank`, Pod-Platz oder Spieler-PP.
- Anzeige: `ergebnisMitSkalaText()` („87 : 79 → 7 : 4“) in der Arena-Zeile („Gewertet: …“) und in
  „Nach dem Spieltag“; Pod-Zeilen zeigen „Platz 2 von 4 → 6“. Das Live-Panel der Arena zeigt das
  0–10-Ergebnis statt der 2/1/0. Saisonstand, Startseite und Tabelle lasen schon die gebuchten Felder.

---

## 3. Anker (`data/generated/ergebnis-skala-kalibrierung.json`)

Gezogen aus drei frischen Battle-Saves (32 KI-Teams, je 20 Spieltage, Modus `roh` der PP-Sonde,
Saves `new-game-1795011793384-p2zt62`, `new-game-1795012121998-eyyjbp`, `new-game-1795012815966-z97iaz`):
1.536 Duelle, 192 Vierergruppen. Je Disziplin und Format liegen 13 Knoten der Margen-Verteilung im
JSON; die Tabelle zeigt den Median (→ 3 bzw. Pod-Spanne 7) und die Lage 97,5 % (→ 10). Eigene Anker je
Feldgröße ab 24 Siegen bzw. 12 Pods, sonst Disziplin-weit.

| Disziplin | Format | Marge aus | Median-Sieg bzw. -Spanne (→ 3 bzw. 7) | Lage 97,5 % (→ 10) | Leistung p5 / p50 / p95 (C2-PP) | eigene Feldgrößen | n |
|---|---|---|---:|---:|---|---|---:|
| basketball | Duell | Motor-Marge | 21 | 79,925 | 0,406 / 1,377 / 2,604 | 2, 3, 6 | 96 |
| battlefield | Pod | Pod-Spanne | 96 | 152 | 0,268 / 1,71 / 2,993 | 2, 3, 4, 5 | 48 |
| breaking | Duell | Leistungsabstand | 0,422 | 1,669 | 0,661 / 1,411 / 2,476 | 2, 4, 6 | 96 |
| climbing | Duell | relativ |a−b|/(a+b) | 0,143 | 0,4 | 0,743 / 1,856 / 2,803 | 2, 3, 4, 5, 6 | 89 |
| eiskunstlauf | Duell | Motor-Marge | 527 | 3447,875 | 0,311 / 1,467 / 3,162 | 2, 3, 4, 6 | 96 |
| fechten | Duell | Motor-Marge | 5 | 17,8 | 0,544 / 1,393 / 2,792 | 2, 3, 4, 5, 6 | 89 |
| football | Duell | Motor-Marge | 16,5 | 45,675 | 0,405 / 1,425 / 2,888 | 2, 4, 5 | 94 |
| gewichtheben | Duell | Motor-Marge | 2 | 6 | 0,297 / 1,542 / 2,937 | 2, 3, 5, 6 | 96 |
| hockey | Duell | Motor-Marge | 4 | 24,7 | 0,472 / 1,416 / 3,187 | 2, 3, 5, 6 | 87 |
| i-spy | Duell | Motor-Marge | 273,5 | 1129,875 | 0,605 / 1,504 / 2,456 | 2, 4, 5 | 96 |
| mini-dm | Pod | Pod-Spanne | 6 | 14,826 | 0,213 / 1,516 / 3,478 | 2, 4, 6 | 48 |
| showcase | Duell | Motor-Marge | 391 | 1255,375 | 0,476 / 1,445 / 2,4 | 4, 5, 6 | 96 |
| speed-schach | Duell | Motor-Marge | 2 | 5 | 0,395 / 1,539 / 2,501 | 3, 5, 6 | 78 |
| spurt | Duell | relativ |a−b|/(a+b) | 0,203 | 0,452 | 0,27 / 1,61 / 2,863 | 2, 3, 4, 5, 6 | 92 |
| staffel | Pod | Pod-Spanne | 3,808 | 9,579 | 0,281 / 1,617 / 3,092 | 2, 4, 6 | 48 |
| takeshis-castle | Pod | Pod-Spanne | 31,4 | 74,052 | 0,264 / 1,571 / 2,841 | 2, 3, 4, 5 | 48 |
| tdm | Duell | Motor-Marge | 3 | 5 | 0,438 / 1,542 / 2,512 | 3, 4, 5 | 83 |
| tennis | Duell | Motor-Marge | 2 | 5 | 0,382 / 1,437 / 2,626 | 3, 4, 6 | 79 |
| time-trial | Duell | Leistungsabstand | 1,41 | 3,099 | 0,466 / 1,726 / 3,353 | 2, 3, 4, 5 | 96 |
| wettessen | Duell | relativ |a−b|/(a+b) | 0,079 | 0,279 | 0,599 / 1,528 / 2,788 | 2, 4, 5, 6 | 96 |

**Margen-Quelle** (automatisch bei der Kalibrierung gewählt):
- *Motor-Marge* `|a − b|` für die meisten Disziplinen.
- *relativ* `|a − b| / (a + b)` für Wettessen, Climbing und Spurt: deren Seitenstand ist eine Summe, deren
  Größenordnung je Spieltag stark wechselt (Variationskoeffizient der Seitensumme > 0,5; Wettessen bei
  derselben Feldgröße einmal Median-Abstand 109, im nächsten Save 400). Gemessen am Ende-zu-Ende-Save
  (Abschnitt 4.6) war Wettessen mit der nativen Marge die größte Disziplin (10 %), mit der relativen 6 %.
- *Leistungsabstand* für Breaking und Zeitfahren: Breaking meldet als Seitenstand die Überlebenden (fast
  immer 1 oder 2), Zeitfahren im Duell nur 1:0.

Kalibrieren: `npx tsx scripts/werte-ergebnisskala-aus.ts --schreibe-kalibrierung <abzug.json> ...`
(Abzüge von `scripts/miss-pp-skala.ts`, das seit diesem PR je Team-Zeile `teamZeilen` mitschreibt).
**Reihenfolge:** zuerst die PP-Anker (`werte-pp-skala-aus.mjs --schreibe-kalibrierung`), dann E1, weil
das Niveau auf C2-PP steht.

---

## 4. Messung

Sonde `scripts/werte-ergebnisskala-aus.ts` über dieselben drei Saves. **Vorher** = die Skala vom
19.10., aus denselben gebuchten Zeilen nachgerechnet (`berechneDuellVerhaeltnis()` bzw. die Pod-Leiter
mit Pod-Referenz), **nachher** = E1 mit den committeten Ankern.

### 4.1 Garantien

Sieger, Remis und Pod-Reihenfolge an allen 1.536 Duellen und 192 Pods: **0 Verstöße** (wer im Motor
gewinnt, hat auf der Skala mehr; Remis gleich; besserer Platz höher; Pod-Verhältnis Summe 0).

### 4.2 Verteilung je Disziplin

|D| je Team-Zeile; bei Pods vorher Abweichung vom Pod-Mittel, nachher Wert minus Mittel der Gegner.
„Anteil 5“ vorher = der Rückfall ohne Referenz, „Anteil 10“ = Kantersieg.

| Disziplin | Format | Begegnungen | vorher: Median |D| | vorher: Anteil 10 | vorher: Anteil 5 | nachher: Median |D| | nachher: Anteil 10 | haeufigste Ergebnisse nachher | 10:0 | Remis |
|---|---|---:|---:|---:|---:|---:|---:|---|---:|---:|
| basketball | Duell | 96 | 5,0 | 1 % | 85 % | 3,0 | 7 % | 7:5 (9), 10:0 (7), 7:3 (6) | 7 | 0 |
| battlefield | Pod | 48 | 3,0 | 0 % | 7 % | 3,0 | 0 % | 7-5-4-3 (3), 10-2-1-0 (3), 9-3-1-0 (3) | 0 | 0 |
| breaking | Duell | 96 | 10,0 | 70 % | 30 % | 3,0 | 7 % | 10:0 (7), 3:1 (6), 5:3 (5) | 7 | 0 |
| climbing | Duell | 96 | 3,0 | 11 % | 15 % | 2,0 | 6 % | 6:4 (17), 7:5 (12), 10:1 (9) | 6 | 7 |
| eiskunstlauf | Duell | 96 | 7,0 | 38 % | 7 % | 3,0 | 7 % | 10:0 (7), 9:0 (5), 6:3 (5) | 7 | 0 |
| fechten | Duell | 96 | 3,0 | 10 % | 7 % | 3,0 | 6 % | 4:2 (7), 10:0 (6), 10:1 (5) | 6 | 7 |
| football | Duell | 96 | 5,0 | 0 % | 98 % | 3,0 | 6 % | 6:4 (10), 4:3 (6), 5:2 (6) | 6 | 2 |
| gewichtheben | Duell | 96 | 4,0 | 29 % | 0 % | 2,0 | 1 % | 8:6 (9), 10:2 (8), 4:2 (7) | 1 | 0 |
| hockey | Duell | 96 | 5,0 | 26 % | 11 % | 3,0 | 6 % | 6:4 (11), 6:3 (7), 7:3 (7) | 6 | 9 |
| i-spy | Duell | 96 | 5,0 | 0 % | 100 % | 3,0 | 7 % | 10:0 (7), 7:5 (6), 8:6 (6) | 7 | 0 |
| mini-dm | Pod | 48 | 4,0 | 0 % | 26 % | 3,0 | 0 % | 9-7-5-3 (3), 8-6-4-3 (3), 7-6-2-1 (2) | 0 | 0 |
| showcase | Duell | 96 | 9,0 | 45 % | 4 % | 3,0 | 7 % | 10:0 (7), 7:4 (5), 5:3 (5) | 7 | 0 |
| speed-schach | Duell | 96 | 4,0 | 26 % | 19 % | 3,0 | 4 % | 7:4 (6), 10:2 (5), 6:6 (4) | 4 | 18 |
| spurt | Duell | 96 | 6,0 | 39 % | 11 % | 3,0 | 6 % | 5:4 (12), 7:5 (9), 8:1 (7) | 6 | 4 |
| staffel | Pod | 48 | 3,5 | 0 % | 20 % | 3,0 | 0 % | 7-6-5-4 (3), 7-6-4-3 (2), 8-7-4-1 (2) | 0 | 0 |
| takeshis-castle | Pod | 48 | 3,0 | 0 % | 19 % | 3,0 | 0 % | 7-6-5-4 (3), 9-5-4-0 (2), 8-4-2-1 (2) | 0 | 0 |
| tdm | Duell | 96 | 5,0 | 0 % | 86 % | 2,0 | 2 % | 9:2 (19), 6:4 (18), 5:5 (11) | 2 | 13 |
| tennis | Duell | 96 | 10,0 | 56 % | 1 % | 3,0 | 0 % | 9:0 (7), 7:4 (7), 6:4 (6) | 0 | 17 |
| time-trial | Duell | 96 | 5,0 | 0 % | 100 % | 3,0 | 7 % | 6:4 (17), 7:4 (8), 7:3 (7) | 7 | 0 |
| wettessen | Duell | 96 | 5,0 | 16 % | 10 % | 3,0 | 6 % | 10:0 (6), 5:3 (5), 10:1 (5) | 6 | 0 |

Lesart: vorher war in Basketball, Football, I-Spy, TDM und Zeitfahren fast **jeder** Sieg ±5 (keine
Referenz), in Breaking 70 % und in Tennis 56 % der Siege ±10 (Referenz 1); Showcase und Eiskunstlauf
lagen mit Median 9 bzw. 7 weit über dem Rest. Nachher liegt der Median-Abstand überall bei 2 bis 3,
Kantersiege 0 bis 7 % je Disziplin. Remis gibt es nur, wo der Motor sie liefert (Speed-Schach, Tennis,
TDM, Hockey). Pods spielen 7-5-4-3 bis 10-2-1-0.

### 4.3 Punkteverhältnis über eine Saison (je Liga, 16 Teams, 20 Spieltage)

| Lauf | Liga | vorher: Spannweite (min..max) | vorher: Std | nachher: Spannweite | nachher: Std | vorher: groesste Disziplin (Anteil an Σ|Verh.|) | nachher: groesste Disziplin |
|---|---|---|---:|---|---:|---|---|
| 1 (p2zt62) | liga1 | 153 (-63..90) | 43,8 | 119 (-49..70) | 33,1 | eiskunstlauf 8 % | basketball 7 % |
| 1 (p2zt62) | liga2 | 208 (-133..75) | 50,4 | 159 (-95..64) | 43,5 | breaking 8 % | i-spy 7 % |
| 2 (eyyjbp) | liga1 | 170 (-79..91) | 55,6 | 141 (-59..82) | 44,5 | breaking 11 % | time-trial 7 % |
| 2 (eyyjbp) | liga2 | 168 (-55..113) | 40,8 | 168 (-65..103) | 36,7 | breaking 10 % | gewichtheben 7 % |
| 3 (z97iaz) | liga1 | 144 (-52..92) | 34,2 | 118 (-29..89) | 28,1 | breaking 7 % | gewichtheben 6 % |
| 3 (z97iaz) | liga2 | 173 (-75..98) | 51,5 | 135 (-67..68) | 41,0 | breaking 7 % | wettessen 6 % |

Die Spannweite des Saison-Verhältnisses sinkt in fünf von sechs Ligen, im Mittel 169 → 140, weil die
starren ±10 aus Breaking/Tennis und die überzogenen Abstände aus Showcase/Eiskunstlauf wegfallen. Die
Rangfolge innerhalb einer Liga hängt weiterhin an den Punkten (2/1/0), das Verhältnis entscheidet nur bei
Punktgleichheit.

### 4.4 Anteil der Disziplinen am Punkteverhältnis

Anteil je Disziplin an Σ|Verh.| über alle drei Saves (20 Disziplinen, gleich verteilt wären 5 %):

| Disziplin | vorher | nachher |
|---|---:|---:|
| basketball | 5 % | 6 % |
| battlefield | 3 % | 4 % |
| breaking | 8 % | 6 % |
| climbing | 4 % | 5 % |
| eiskunstlauf | 6 % | 6 % |
| fechten | 4 % | 5 % |
| football | 5 % | 5 % |
| gewichtheben | 5 % | 6 % |
| hockey | 5 % | 5 % |
| i-spy | 5 % | 6 % |
| mini-dm | 3 % | 4 % |
| showcase | 7 % | 6 % |
| speed-schach | 5 % | 4 % |
| spurt | 6 % | 5 % |
| staffel | 3 % | 4 % |
| takeshis-castle | 3 % | 4 % |
| tdm | 4 % | 5 % |
| tennis | 6 % | 4 % |
| time-trial | 5 % | 6 % |
| wettessen | 5 % | 6 % |

Größter Anteil einer Disziplin: vorher 8 %, nachher 6 %; kleinster: vorher 3 %, nachher 4 %.
Je Team: Anteil der größten Disziplin an seinem Σ|Verh.|, Median vorher 10 %, nachher 10 %; Maximum vorher 13 %, nachher 15 %.

### 4.5 Außerhalb der Stichprobe

Anker nur aus den Saves 1 und 2 gezogen, gemessen am dritten Save:

| Lauf | Liga | vorher: Spannweite (min..max) | vorher: Std | nachher: Spannweite | nachher: Std | vorher: groesste Disziplin (Anteil an Σ|Verh.|) | nachher: groesste Disziplin |
|---|---|---|---:|---|---:|---|---|
| 1 (z97iaz) | liga1 | 144 (-52..92) | 34,2 | 113 (-30..83) | 27,1 | breaking 7 % | tdm 7 % |
| 1 (z97iaz) | liga2 | 173 (-75..98) | 51,5 | 131 (-64..67) | 39,9 | breaking 7 % | wettessen 7 % |

Größter Anteil einer Disziplin: vorher 7 %, nachher 6 %; kleinster: vorher 3 %, nachher 2 %.
Je Team: Anteil der größten Disziplin an seinem Σ|Verh.|, Median vorher 10 %, nachher 10 %; Maximum vorher 12 %, nachher 13 %.

Auch außerhalb der Stichprobe sinkt die Spannweite und der größte Anteil einer Disziplin. Je Team bleibt
der Anteil seiner größten Disziplin im Median bei 10 % (gleich verteilt wären 5 %); das
Maximum steigt leicht (13 → 15 %), weil ein einzelner Kantersieg jetzt in jeder Disziplin 10 wert sein
kann statt nur in Breaking/Tennis.

### 4.6 Ende zu Ende (Skala an, ganz außerhalb der Stichprobe)

Vierter frischer Save `new-game-1795016924359-od23h7` mit `OLY_PP_SKALA=an` (Stempel C2 + E1 beim Anlegen),
20 Spieltage, über den echten Produktionsweg (`runLocalMatchdayAutoRun`, Arena per Node-Motor):

- **1.280 von 1.280** Team-Zeilen tragen `ergebnisSkala: "e1"`; Sieger/Remis/Pod-Reihenfolge: 0 Verstöße
  (512 Duelle, 64 Pods).
- **Gezeigt = gebucht:** alle 768 gebuchten E1-Zeilen gegen eine Neurechnung aus denselben gebuchten
  Eingaben (Marge, Seitenstand, Spieler-PP aus dem Ledger): **0 Abweichungen**.
- PP: 4.918 Zeilen, kein Einsatz über 5; Tagesbester je Zelle im Median 5,00, in 69 von 80 Zellen
  zwischen 4 und 5; Median-Einsatz 1,06.
- Gebucht wurde mit dem Ankerstand vor der letzten Nachschärfung (native Marge für Wettessen). Mit den
  committeten Ankern nachgerechnet:

| Lauf | Liga | vorher: Spannweite (min..max) | vorher: Std | nachher: Spannweite | nachher: Std | vorher: groesste Disziplin (Anteil an Σ|Verh.|) | nachher: groesste Disziplin |
|---|---|---|---:|---|---:|---|---|
| 1 (od23h7) | liga1 | 99 (-54..45) | 28,1 | 81 (-41..40) | 25,5 | showcase 7 % | time-trial 7 % |
| 1 (od23h7) | liga2 | 154 (-85..69) | 46,9 | 120 (-62..58) | 36,4 | eiskunstlauf 7 % | tdm 7 % |

Größter Anteil einer Disziplin: vorher 7 %, nachher 7 %; kleinster: vorher 3 %, nachher 3 %.
Je Team: Anteil der größten Disziplin an seinem Σ|Verh.|, Median vorher 9 %, nachher 11 %; Maximum vorher 11 %, nachher 13 %.

---

## 5. Rangtreue, Pp, Fingerabdruck

- E1 sitzt hinter dem Motor in TypeScript. Der Motor (`public/mockups/battle-mode.engine.js`) ist
  nicht angefasst: `node scripts/pruefe-wertung-fingerabdruck.mjs` → **GESAMT ce8fcef66028 (75
  Einträge)**, wie auf `main`.
- Rangtreue (rho je Spiel) und Pp-Abweichung werden am Motor gemessen (`miss-alle-disziplinen.mjs`,
  `messe-arena-einfluss.mjs`); keine dieser Sonden liest `verhaeltnis`, `ergebnisNormiert` oder
  Spieler-PP. Sie bleiben, was `data/generated/disziplin-abnahme.json` sagt.
- Wer gewinnt, ändert sich nicht: `teamPoints`, Tabelle und Pod-Platz kommen unverändert aus Motor
  bzw. Brücke (Test `tests/battle-mode-pps-duell.test.ts`, „Ergebnisskala E1 + PP-Skala C2 in der
  Engine“). Der Tiebreaker „Verh.“ kann zwei punktgleiche Teams anders ordnen als vorher, das ist
  gewollt.

---

## 6. Übergang und bestehende Saves

Siehe `docs/design/pp-skala-18-11.md` Abschnitt 8.1 (gleicher Mechanismus):

| Fall | PP-Skala | Ergebnisskala |
|---|---|---|
| neues Spiel ab heute | C2 ab Saison 1 | E1 ab Saison 1 |
| bestehender Battle-Save, laufende Saison bis Spieltag 3 | C2 ab dem nächsten Spieltag (PP-Dokument 8.4) | alt bis Saisonende |
| bestehender Save, laufende Saison später | alt bis Saisonende | alt bis Saisonende |
| bestehender Save, nächste Saison | C2 | E1 |
| `OLY_ERGEBNIS_SKALA=aus` | – | neue Saisons alt, gestempelte Saisons rechnen weiter wie gestempelt |
| `OLY_ERGEBNIS_SKALA=aus-sofort` | – | Notbremse: alle Saisons alt, auch mitten in der Saison |

Gebuchte Zeilen einer alten Saison behalten ihre Werte (sie werden nicht neu gerechnet). Das
Saison-Archiv trägt den Stempel mit (`SeasonSnapshotRecord.wertungsSkalen`).

---

## 7. Offene Fragen

1. **Stichprobe**: drei Saves, je Disziplin und Feldgröße 16 bis 48 Duelle. Die Anker sind belastbar für
   die Form (Median 3, Kantersieg 10), einzelne Feldgrößen fallen auf die Disziplin-weiten Anker zurück.
   Nachkalibrieren mit weiteren Saves ist ein Befehl (Abschnitt 3).
2. **Tiebreaker-Verschiebung**: punktgleiche Teams können nach E1 anders geordnet sein als nach der
   alten Skala. Für eine laufende Saison passiert das nicht (Stempel), ab der nächsten gewollt.
3. **Pod-Gewicht**: mit Median-Spanne 7 liegt der Median-|Verh.| im Pod bei 3 wie im Duell; Staffel
   (enge Zielzeiten) bleibt mit 2 etwas leichter. Stellschraube `ERGEBNIS_POD_SPANNE_MITTE`.
4. **Strukturelle Gleichstände** (Climbing/Zeitfahren/Staffel im Duell, PP-Dokument 2.2) betreffen E1 nicht:
   wer gewinnt, entscheidet der Motor; der Abstand kommt dort aus der Leistung.
5. **Anzeige**: Saisonstand und Startseite zeigen die Skala schon; „Nach dem Spieltag“ und die Arena zeigen
   „native Zahl → Skala“. Ob Chris in den Paarungen des Saisonstands zusätzlich die native Zahl sehen will,
   ist eine Geschmacksfrage (heute nur im Tooltip-Text der Arena).

---

## 23.11. Anker nachgezogen (Ergebnisskala E1, Welle 6)

Warum: seit dem 18.11. haben sich Climbing (Canyon), Breaking (Tag-Team), Battlefield (Fünf Punkte), Hockey (Torwart-Regel), Basketball (Puste) und TDM (Gefecht) geändert; die Anker standen auf dem alten Motor (Median-Abstand 2 bis 9 statt ~3, Climbing 30 % 10:0).

**Messung.** Drei frische Battle-Saves (32 KI-Teams von Anfang an, je 20 Spieltage, `OLY_PP_SKALA=roh`,
Arena über den Node-Motor `quick-sim`, `scripts/miss-pp-skala.ts 20`), dazu ein vierter Save im Standardmodus (C2 + Tagesanker +
E1, ungesehen) als Kontrolle außerhalb der Stichprobe. Aus den Kalibrierläufen sind die Spieltage mit `aufloesung: pps_duell`
herausgenommen (drei Disziplin-Spieltage: Hockey, Basketball, Wettessen; die Arena lief dort nicht, die PP stammen aus der
Ersatzrechnung und verzerren die Spitze). Reihenfolge wie im Dokument: erst `node scripts/werte-pp-skala-aus.mjs
--schreibe-kalibrierung`, dann `npx tsx scripts/werte-ergebnisskala-aus.ts --schreibe-kalibrierung` (E1 liest die C2-Niveaus). Die
Rückweg-Anker (`basketballPusteAlt`, `breakingGauntletAlt`, `hockeyAlt`, `battlefieldOrte3`, `duellPusteAlt`, `duellGauntletAlt`,
`duellTorwartAlt`, `podOrte3`) wurden vom Schreibpfad unverändert übernommen (Diff geprüft).

**Vorher/nachher je Disziplin** (Spalten 3-4: dieselben drei Kalibrier-Saves, alte gegen neue Anker, nur Arena-Spieltage; „Anteil 10:0“ =
Kantersiege je Duell; Pods haben kein 10:0, dort steht die Spanne; Spalte 6: Median der Tagesbesten je Disziplin und Spieltag mit Tagesanker,
alte gegen neue Anker auf denselben Rohdaten gerechnet; Kontrolllauf = vierter Save mit den neuen Ankern, nur Arena-Spieltage, 1 bis 2
Spieltage je Disziplin, deshalb grob):

| Disziplin | Format | Median-Abstand D alt -> neu | Anteil 10:0 alt -> neu | Kontrolllauf: D / 10:0 | PP-Tagesbester alt -> neu | PP-Tagesbester Kontrolllauf |
|---|---|---|---|---|---|---|
| basketball | Duell | 5,5 -> 3,0 | 18 % -> 8 % | 2,5 / 9 % | 4,88 -> 4,90 | 4,90 |
| battlefield | Pod | 3,0 -> 3,0 | 0 % -> 0 % | 2,0 / 0 % | 4,87 -> 4,86 | 4,80 |
| breaking | Duell | 3,0 -> 4,0 | 0 % -> 0 % | 4,0 / 0 % | 4,93 -> 4,91 | 4,85 |
| climbing | Duell | 9,0 -> 3,0 | 30 % -> 8 % | 4,0 / 0 % | 4,78 -> 4,78 | 4,78 |
| eiskunstlauf | Duell | 4,5 -> 3,0 | 14 % -> 6 % | 4,0 / 0 % | 4,92 -> 4,92 | 4,83 |
| fechten | Duell | 6,0 -> 3,0 | 19 % -> 5 % | 3,0 / 3 % | 4,86 -> 4,85 | 4,85 |
| football | Duell | 5,0 -> 3,0 | 17 % -> 7 % | 2,0 / 0 % | 4,83 -> 4,83 | 4,80 |
| gewichtheben | Duell | 2,0 -> 2,0 | 1 % -> 1 % | 7,0 / 22 % | 4,88 -> 4,88 | 4,87 |
| hockey | Duell | 5,0 -> 3,0 | 16 % -> 9 % | 2,0 / 6 % | 4,86 -> 4,85 | 4,85 |
| i-spy | Duell | 7,0 -> 3,0 | 33 % -> 8 % | 2,5 / 0 % | 4,85 -> 4,85 | 4,84 |
| mini-dm | Pod | 3,0 -> 2,5 | 0 % -> 0 % | 3,0 / 0 % | 4,83 -> 4,82 | 4,80 |
| showcase | Duell | 2,0 -> 3,0 | 10 % -> 8 % | 3,0 / 13 % | 4,97 -> 4,96 | 4,83 |
| speed-schach | Duell | 3,0 -> 3,0 | 4 % -> 0 % | 2,0 / 0 % | 4,91 -> 4,91 | 4,81 |
| spurt | Duell | 4,0 -> 4,0 | 5 % -> 5 % | 4,0 / 25 % | 4,82 -> 4,81 | 4,79 |
| staffel | Pod | 3,0 -> 2,5 | 0 % -> 0 % | 2,0 / 0 % | 4,78 -> 4,78 | 4,78 |
| takeshis-castle | Pod | 3,0 -> 2,0 | 0 % -> 0 % | 3,0 / 0 % | 4,88 -> 4,86 | 4,81 |
| tdm | Duell | 5,0 -> 3,0 | 17 % -> 3 % | 2,5 / 0 % | 4,83 -> 4,82 | 4,81 |
| tennis | Duell | 2,0 -> 3,0 | 15 % -> 0 % | 3,0 / 9 % | 4,83 -> 4,83 | 4,88 |
| time-trial | Duell | 3,0 -> 3,0 | 10 % -> 8 % | 3,0 / 3 % | 4,78 -> 4,78 | 4,78 |
| wettessen | Duell | 5,0 -> 3,0 | 16 % -> 8 % | 3,0 / 19 % | 4,90 -> 4,88 | 4,93 |

**Lesart.** E1: Median-Abstand liegt jetzt in 18 von 20 Disziplinen bei 2,5 bis 4 (Ziel ~3; Breaking 4,0 und Spurt 4,0 sind die Ausreißer nach oben,
Gewichtheben und Takeshi's Castle mit 2,0 nach unten; Gewichtheben gibt im Motor nur ganzzahlige Margen 0 bis 5), der Anteil 10:0 ist in allen 20 Disziplinen ≤ 9 % (vorher in 10
Disziplinen über 10 %, Climbing 30 %, I-Spy 33 %, Basketball 18 %, Fechten 19 %, Hockey 16 %, TDM 17 %, Football 17 %, Wettessen 16 %). Der Wert
von Hockey (9 %) ist die Spitze. Kontrolllauf: 16 Disziplinen im Ziel; über 10 % liegen Gewichtheben (22 %, ein Spieltag mit großem Feld, die
Margen sind dort ganzzahlig und stufig), Spurt (25 %, Feldgröße 6 ist nicht kalibriert, fällt auf den Disziplin-weiten Anker) und Wettessen (19 %);
Showcase 13 % (2 von 16 Duellen). Das sind Einzelspieltage eines Saves (stark korreliert), kein Beleg gegen die Anker, aber ein Auftrag für die
nächste, größere Ziehung (Spurt Feld 6 braucht eigene Anker, Gewichtheben ebenfalls). PP: der Tagesbeste liegt wie vorher je Disziplin
bei 4,78 bis 4,97 (Median 4,85); der Tagesanker fängt die Anker-Drift selbst ab, deshalb ändert die Neuziehung die Spitze kaum. Climbing,
Staffel und Zeitfahren bleiben bei 4,78 (16 Laufsieger gleichauf, Abschnitt 6 des Tagesanker-Dokuments). Keine Disziplin liegt systematisch
über 5,0. Der Nutzen der neuen PP-Anker ist die Skala unterhalb der Spitze: Mittel der Einsätze (R_med) und das Niveau, das E1 liest.

**Anker-Stempel und laufende Spielstände.** Die Anker sind NICHT je Stempel versioniert: `seasonState.wertungsSkalen` sagt nur „C2 / E1 / Tagesanker an
oder aus“, die Zahlen liegen je Disziplin in einer Datei und gelten für jeden Rechenweg, der sie zur Laufzeit liest. Folgen, soweit nachgeprüft:
(1) Gebuchte Arena-/Pod-Zeilen (Spieler-PP, `ergebnisNormiert`, `verhaeltnis`, `teamPoints`) liegen im Spielstand und werden nie neu gerechnet; ein
laufender Spielstand behält also alles, was bis zum Deploy gebucht ist. (2) Neue Spieltage jedes Spielstands mit Stempel C2/E1 rechnen ab dem
Deploy mit den neuen Ankern (kein neuer Stempel nötig, derselbe Mechanismus wie bei den Anker-Nachzügen vom 22.11.). (3) Rückweg-Regeln und -Formate haben
ihre eigenen Schlüssel und blieben unberührt: ein Spieltag, der mit der alten Torwart-/Puste-Regel, dem Gauntlet-Format oder Battlefield-Orte3
gebucht wurde, rechnet mit den alten Ankern weiter. (4) Eine Ausnahme bleibt: Zeilen mit `aufloesung: pps_duell` (Ersatzrechnung ohne Arena) rechnet der
Ledger beim Lesen aus dem gespeicherten Rohwert neu (`ppAusKurveSkaliert`, `lib/foundation/season-points-ledger.ts`). Deren Spieler-PP in einer
laufenden C2-Saison ändern sich mit dem Deploy um den Faktor der Tabelle „PP-Anker“ (Faktor alt/neu bei R_top; zum Beispiel Tennis 0,73, Hockey 0,75,
Eiskunstlauf 0,79, Breaking 0,81, Wettessen 0,86, Basketball 1,08), nur diese Zeilen, nur die laufende Saison. Eine echte Versionierung der Anker je
Stempel wäre eine neue Mechanik und ist hier bewusst nicht gebaut; sie ist der Folgeauftrag, falls Chris die Verschiebung dieser Ersatzzeilen stört.
Der Arena-Eingabe-Hash enthält keine Anker, ein vorgerechneter Vorlauf wird also nicht ungültig.

**Anker-Tabelle (PP, Disziplin-weit):**

| Disziplin | R_top alt -> neu | R_med alt -> neu | Faktor alt/neu bei R_top |
|---|---|---|---|
| basketball | 6,08 -> 5,61 | 1,317 -> 1,38 | 1,08 |
| battlefield | 5,54 -> 5,9 | 1,25 -> 1,195 | 0,94 |
| breaking | 4,9 -> 6,02 | 1,3 -> 0,97 | 0,81 |
| climbing | 5,5 -> 5,5 | 1,15 -> 1,1 | 1,00 |
| eiskunstlauf | 5,88 -> 7,47 | 1,06 -> 1,38 | 0,79 |
| fechten | 4,93 -> 4,72 | 0,99 -> 0,81 | 1,04 |
| football | 5,44 -> 5,2 | 1,425 -> 1,475 | 1,05 |
| gewichtheben | 4,47 -> 4,41 | 1,07 -> 0,74 | 1,01 |
| hockey | 5,51 -> 7,35 | 1,36 -> 1,39 | 0,75 |
| i-spy | 5,47 -> 6,16 | 1,3 -> 1,23 | 0,89 |
| mini-dm | 5,31 -> 5,51 | 1,12 -> 1,02 | 0,96 |
| showcase | 4,77 -> 5 | 1,18 -> 1,02 | 0,95 |
| speed-schach | 5,12 -> 5,69 | 1,17 -> 1,17 | 0,90 |
| spurt | 3,15 -> 3,25 | 1,37 -> 1,28 | 0,97 |
| staffel | 5,5 -> 5,5 | 1,49 -> 1,2 | 1,00 |
| takeshis-castle | 4,77 -> 4,91 | 1,01 -> 0,935 | 0,97 |
| tdm | 6,32 -> 6,24 | 1,28 -> 1,32 | 1,01 |
| tennis | 4,27 -> 5,84 | 0,84 -> 0,665 | 0,73 |
| time-trial | 5,5 -> 5,5 | 1,32 -> 1,34 | 1,00 |
| wettessen | 4,28 -> 4,99 | 1,32 -> 1,15 | 0,86 |

**Zwei Befunde nebenbei.** (a) Die automatische Wahl `marge`/`relativ` kippte bei der Neuziehung (Spurt, Wettessen von relativ auf marge, Hockey
von marge auf relativ), weil sie am Variationskoeffizienten der Seitensumme hängt. Die Summe wächst dort mit der Feldgröße (Spurt 21 bei 3 Spielern,
55 bei 5, 90 bei 6), eine absolute Marge ist nicht vergleichbar. `scripts/werte-ergebnisskala-aus.ts` hat dafür jetzt `FESTE_QUELLE`:
Climbing, Spurt, Wettessen immer relativ (Stand 18.11.), Hockey immer nativ (Stand 22.11.). (b) Spieltage mit `aufloesung: pps_duell` (im Kontrolllauf Football,
TDM, Showcase, Climbing an einem Tag; Fallback ohne Arena) bekommen weder den Tagesanker noch passende E1-Anker: Football-Tagesbester 3,46, 10:0 in
31 bis 47 % der Duelle, weil die Anker auf der Arena-Marge stehen und die PPS-Skala eine andere ist. Das ist nicht neu und nicht Teil dieser Kalibrierung;
offen ist, warum der Vorlauf an solchen Tagen nicht läuft (Probe: `quick-sim`).

**Fingerabdruck:** `GESAMT fe1dc086d68d` unverändert (Anker liegen auf der Buchungsseite, die Engine ist nicht angefasst).

