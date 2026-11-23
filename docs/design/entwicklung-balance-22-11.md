# Spielerentwicklung balancieren (22.11.)

Auftrag von Chris, 22.11., wörtlich:

- „Training und Entwicklung musst du bedenken, dass es ja gewünscht ist, dass nur wenige sich stark verbessern und stark
  verschlechtern, die Masse dürfte nur kaum besser oder schlechter werden.“
- „Wichtig ist, dass ein gesundes Verhältnis der SP bei Training und Leistung in PP besteht.“
- „Wenn wir es so machen, dass Potentiale sich ein bisschen anpassen können pro Attribut nach oben oder unten pro Season, und
  wir es schaffen, dass Training und Regression so laufen, dass über alle Ligen die Spieler nicht zu viel im SCHNITT zulegen,
  passt es.“
- „Nicht jeder Spieler nähert sich zwangsweise dem Peak, weil es immer schwerer wird, je stärker ein Spieler wird.“
- „Das Liga-Mittel soll weiterhin −1 bis +1 sein!“

**Stand 22.11. (Runde 2, Review von PR #1696): Training, Leistung und Abbau werden je Spieltag gebucht (60/40, Diligent 75/25), das Saisonende nimmt nichts
zurück — siehe Abschnitt 8. Die Abschnitte 3 bis 5 beschreiben die Runde 1 (Saisonend-Rechnung) und gelten nur noch als Vorgeschichte.**

Stand Runde 1: Regel **„neu“** gebaut, geeicht und über fünf Saisons gemessen (Tabelle 1). Gilt per Spielstand-Stempel (`seasonState.entwicklungsRegel`),
Rückweg `OLY_ENTWICKLUNG=alt`. Wertungs-Fingerabdruck unverändert (`GESAMT fe1dc086d68d`, Entwicklung ist keine Arena-Wertung).

## 1. Abnahme und Schwellen

Gemessen wird die **Netto-Summe aller zwölf Attribute je Spieler und Saison** (Wert am Saisonende minus Wert am Saisonstart, also
je Spieltag gebuchtes Training + Saisonend-Rechnung), über alle Kaderspieler der 32 Teams.

| Größe | Soll | Schwelle |
|---|---|---|
| Liga-Mittel | −1 bis +1 | Summe der zwölf Attribute |
| stark besser | 5–8 % der Spieler | Summe **≥ +8** (im Schnitt gut 0,67 je Attribut) |
| stark schlechter | 5–8 % | Summe **≤ −8** |
| kaum verändert | 50–60 % | Summe **|x| ≤ 2** (unter 0,2 je Attribut, also im Spiel nicht spürbar) |
| abnehmende Erträge | Zuwachs fällt zur Decke | Mittel der Attribut-Änderung nach Abstand zur Decke (Tabelle 3) |
| verdient | ≥ 80 % der stark Besseren | PP je Einsatz über dem Liga-Median **und** Trainingsziel gehalten |

Begründung der Schwellen: +8 ist die Grenze, ab der ein Spieler sichtbar „in ein anderes Fach“ rutscht (die Matrix-Eignung einer
Disziplin ändert sich um 1–3 Punkte, die Kaderstärke der besten sechs je Disziplin um etwa einen halben Punkt). ±2 ist der Bereich
unterhalb der Rundungs- und Formschwankung. „Trainingsziel gehalten“ heißt: an mindestens zwölf Trainingstagen ein Ziel gesetzt
und davon mindestens 60 % dasselbe (Anteil des meistgewählten Ziels, `dominanz` im Messlauf).

## 2. Befund vorher (Regel alt, am vollen Spiel gemessen)

Die „+6,8 im Konzept“ stimmt: gemessen +6,7 in Saison 1, danach +7,4 bis +7,6 (Tabelle 1). Zusammensetzung in Saison 1:

| Kanal | Mittel je Spieler |
|---|---:|
| Training, je Spieltag gebucht | +6,0 (P5 2,0 / Median 5,8 / P95 12,0) |
| Leistung (PP-Kanal am Saisonende) | +5,7 |
| Abbau (Grundabbau 0,3 je Attribut + Marktwertdruck) | −5,1 |
| Netto | +6,7 |

Dazu zwei Eigenheiten des Bestands:

- **Jeder Kaderspieler spielt.** Median 13 Einsätze je Saison, kleinster Wert 3. Es gibt keine Bank, an der man „kaum Einsätze →
  Abbau“ festmachen könnte; die Unterschiede entstehen aus Training, Leistung und Fokus.
- **Die Potentialdrift hebt die Decken im Schnitt um +13,4** (Summe der zwölf Attribut-Decken je Spieler und Saison, danach
  weiter +12 bis +13): `breakout` erzwingt +2, `regression_risk` erzwingt −2, die Mehrheit der Liga hat einen Aufwärts-Ausblick.
  Die Drift ist also nicht neutral, sondern ein zweiter Inflationskanal.

## 3. Was die Regel „neu“ tat (Runde 1, ersetzt durch Abschnitt 8)

Alles in `lib/training/organic-season-progression.ts` (Saisonend-Rechnung `buildOrganicSeasonProgression`, nur mit Stempel „neu“
und nur dort, nie im Tageszuwachs), Bausteine in `lib/training/entwicklung-neu.ts`.

1. **PP bestimmen, wie viel Training ankommt** (Chris: „SP bestimmen, wohin; PP, wie viel“). Das je Spieltag gebuchte Training
   bleibt auf den Attributen; am Saisonende wird es je Attribut um `(Faktor − 1) × gebucht` korrigiert (Faktor < 1 nimmt zurück,
   Faktor > 1 legt nach und folgt der Ertragskurve). Faktor = `(0,6 + 0,8 × Einsatzanteil × Leistungsrang) × Fokusfaktor`:
   - **Leistungsrang** (0 bis 1) = Anteil der Liga-Spieler mit weniger PP je Einsatz (aus dem Punktebuch der Saison,
     `buildSeasonPointsLedger`; ohne Disziplin-Ergebnisse im Spielstand fällt es auf das Leistungssignal des Leistungskanals zurück).
   - **Einsatzanteil** = Einsätze / 10 (höchstens 1): ohne Einsätze kommt gut die Hälfte (0,6) des Trainings an.
   - **Fokusfaktor** = 0,5 bis 1,5 nach dem Anteil des meistgewählten Trainingsziels (≤ 40 % → 0,5, 100 % → 1,5): wer sein Ziel
     hält, behält mehr von seinem Training als jemand, der dauernd wechselt. Das ist die „SP“-Seite des „verdient“.
2. **Abbau hängt an der Leistung.** Grundabbau je Attribut 0,51 statt 0,3 (alt), mal `1 + 1,0 × (0,5 − Leistungsrang)`: wer unter der
   Liga-Mitte spielt, baut bis zu 50 % mehr ab, wer darüber spielt, bis zu 50 % weniger. Dazu 0,25 Verfall (Summe) je
   Verletzungs-Ausfalltag (Verletzte trainieren nicht, Regel vom 18.11. bleibt). Der Marktwertdruck und die Decken-Dämpfung des
   Abbaus bleiben.
3. **Leistungskanal gedrosselt** auf 60 % (`leistungsSkala`), damit die PP nicht doppelt zählen (sie wirken schon über den Faktor).
4. **Abnehmende Erträge, stetig.** `ertragsFaktor(h)` mit h = Decke − Wert: ab 10 Punkten Abstand voller Satz, bei 1 Punkt 0,05,
   dazwischen linear (bei 5 Punkten ≈ 0,47, bisher Stufe 0,45). Gilt für das Training je Spieltag (nur Stempel „neu“), den Nachlegen-Anteil
   und den Leistungskanal (nie unter 0,3, wie der alte weiche Auslauf).
5. **Entwicklungskurve** auf die Gesamtsumme eines Spielers: `G(x) = sign(x) · 2,5 · (|x| / 4)^2,6`, höchstens ±18. Kleine Summen
   werden gedämpft (die Masse bleibt „kaum verändert“), große verstärkt (wenige Schübe und Einbrüche). Alle Attribut-Deltas des
   Spielers werden mit `G(x)/x` multipliziert (Vorzeichen und Verteilung auf die Attribute bleiben); danach Decke und Rundung. Das schon
   gebuchte Training wird dabei nur als Differenz nachgebucht.
6. **Ein Schub will verdient sein.** Ohne Leistung über dem Liga-Median **und** gehaltenes Trainingsziel (≥ 12 Tage mit Ziel, Anteil
   ≥ 60 %) wird die positive Summe bei +7,5 gedeckelt; der Deckel steigt über je 15 Prozentpunkte Rang und Fokus weich auf 18.
   Damit ist „stark besser ohne PP und Fokus“ ausgeschlossen, nicht nur unwahrscheinlich.
7. **Potentialdrift mittelwertneutral.** Die Drift der Attribut-Decken bleibt (−2 / 0 / +2 aus der Saat). Neu: der Ausblick
   (`breakout` … `regression_risk`) verschiebt nur die Wahrscheinlichkeit von +2 gegen −2 (gegengleich, ±0,12 / ±0,06), und der
   Liga-Schnitt dieser Verschiebung wird je Saison abgezogen (`applySeasonEndPotentialUpdates`). Gemessen: Decken-Drift im Mittel
   um 0 statt +13.

Nicht gebaut (Chris: „optional, erst die Kernabnahme“): Auslöser für die Drift (Spielzeit, Verletzung, ungenutztes Attribut). Die
Messung zeigt, dass jeder Spieler spielt; ein Spielzeit-Auslöser hätte heute nichts zu unterscheiden.

## 4. Stellschrauben der Runde 1 (ersetzt, aktuelle Werte in 8.6)

| Schraube | Wert | Wirkung |
|---|---:|---|
| `faktorMin` / `faktorMax` | 0,6 / 1,4 | Spanne des Leistungsfaktors auf das gebuchte Training |
| `einsatzVoll` | 10 | Einsätze, ab denen der Leistungsfaktor voll zählt |
| `fokusStaerke` | 0,5 | Spanne des Fokusfaktors (1 ± 0,5) |
| `abbauBasis` | 0,51 | Grundabbau je Attribut und Saison (alt 0,3); **die** Schraube für das Liga-Mittel: ±0,1 verschiebt es um ≈ ∓1 |
| `abbauLeistungsKopplung` | 1,0 | Abbau × (1 + k × (0,5 − Rang)) |
| `verfallJeAusfalltag` | 0,25 | Zusatzabbau je Verletzungstag (Summe) |
| `leistungsSkala` | 0,6 | Leistungskanal |
| `kurveA` / `kurveSigma` / `kurveK` / `kurveMax` | 2,5 / 4 / 2,6 / 18 | Entwicklungskurve: Form der Verteilung (Anteil stark / kaum) |
| `schubOhneVerdienstMax` / `schubRangMin` / `schubFokusMin` / `schubZielTageMin` / `schubRampe` | 7,5 / 0,5 / 0,6 / 12 / 0,15 | Schub-Deckel ohne PP und Fokus |
| Drift: Verschiebung je Ausblick | ±0,12 / ±0,06 / 0 | `ENTWICKLUNG_NEU_DRIFT_VERSCHIEBUNG`, Liga-Schnitt wird abgezogen |

Faustregel: Liga-Mittel zu hoch → `abbauBasis` hoch; zu viele Stark-Besser/Schlechter → `kurveA` oder `kurveK` runter; zu wenige →
rauf. `OLY_ENT_PARAMS` (JSON) überschreibt einzelne Werte **nur im Messskript** `scripts/miss-entwicklung.ts` (es ruft `setzeEntwicklungsParameterFuerMessung`); das Spiel liest die Variable nie (8.8, Fund 9).

## 5. Messung der Runde 1 (Zahlen überholt, Werkzeug und Verfahren gelten weiter)

Werkzeug: `scripts/miss-entwicklung.ts` (Wegwerf-SQLite, **32 KI-Teams von Anfang an**, Liga-Draft der Pick-Engine, echte
Arena-Spieltage, danach Saisonabschluss + Saisonende-Kette + nächste Saison). Je Saison werden die Kennzahlen und alle Zeilen
(Spieler, Netto, Training, PP, Einsätze, Fokus, Decken) ausgegeben. Optionen: `--saisons N`, `--nur-abschluss` mit
`--start-json` und `--regel neu|alt` (Saisonende auf einem gespeicherten Stand mit anderem Stempel wiederholen, dafür
`--stop-vor-abschluss`), `--erst-naechste-saison`. Ablauf der Eichung: Rohsummen mit Identitätskurve messen, die Kurve offline an die
Zielanteile anpassen, einen vollen Lauf zur Kontrolle.

**Tabelle 1: Vorher (Regel alt) und Nachher (Regel neu), je Saison, 32 KI-Teams von Anfang an.**

Vorher (alt):
| Saison | Spieler | Liga-Mittel | Median | stark besser % | stark schlechter % | kaum % | verdient % (n stark besser) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 310 | +6.73 | +6.7 | 36.5 | 0.0 | 13.2 | 31 (113) |
| 2 | 296 | +7.38 | +7.1 | 43.2 | 0.0 | 9.1 | 34 (128) |
| 3 | 290 | +7.56 | +7.1 | 41.4 | 0.0 | 6.9 | 20 (120) |
| 4 | 276 | +7.63 | +7.5 | 46.4 | 0.0 | 5.8 | 24 (128) |
| 5 | 268 | +7.64 | +7.2 | 42.9 | 0.0 | 6.3 | 23 (115) |
| Mittel | | +7.39 | | 42.1 | 0.0 | 8.3 | |

Nachher (neu, Endstand der Eichung):
| Saison | Spieler | Liga-Mittel | Median | stark besser % | stark schlechter % | kaum % | verdient % (n stark besser) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 312 | -0.20 | +0.0 | 6.1 | 6.4 | 61.2 | 95 (19) |
| 2 | 290 | +0.31 | +0.0 | 6.9 | 4.5 | 58.3 | 100 (20) |
| 3 | 285 | -0.01 | +0.0 | 5.6 | 4.2 | 61.0 | 100 (16) |
| 4 | 276 | +0.18 | +0.0 | 6.2 | 6.2 | 56.2 | 100 (17) |
| 5 | 266 | +0.42 | +0.0 | 6.8 | 4.5 | 59.8 | 100 (18) |
| Mittel | | +0.14 | | 6.3 | 5.2 | 59.3 | |



**Tabelle 2: Abnahme gegen Soll** — Liga-Mittel in jeder Saison zwischen −0,2 und +0,4 (Soll −1..+1); stark besser 5,6–6,9 % (Soll 5–8); stark schlechter 4,2–6,4 % (Soll 5–8; drei Saisons knapp darunter: 4,5 / 4,2 / 4,5); kaum verändert 56–61 % (Soll 50–60; zwei Saisons knapp darüber); verdient 95–100 %.

**Tabelle 3: abnehmende Erträge** (Mittel der Änderung je Attribut und Saison, nach Abstand zur Decke zu Saisonbeginn; Mittel über die Saisons)

| Abstand zur Decke | alt | neu |
|---|---:|---:|
| ≤ 2 | +0,34 | −0,19 |
| 2–5 | +0,55 | −0,13 |
| 5–10 | +0,80 | −0,04 |
| 10–20 | +0,69 | +0,10 |
| > 20 | +0,64 | +0,11 |

Neu: je näher an der Decke, desto schlechter die Bilanz; am Rand bleibt nur Abbau. Alt: auch am Rand noch Zuwachs.

**Tabelle 4: Potentialdrift** (Mittel der Änderung der Summe der zwölf Attribut-Decken je Spieler durch die Drift allein)

| Saison | alt (S4, S5) | neu (S1–S5) |
|---|---:|---|
| Drift | +12,6 / +12,1 | −0,4 / −0,2 / +0,2 / −0,2 / +0,4 |

**Eichung (Verlauf):** erste Läufe mit Abbau 0,6 / Kurve 2,5·(x/4,5)^2,2 trafen auf der eingefrorenen Saison, am vollen Lauf mit
stetiger Ertragskurve im Training sank das Training aber auf Mittel 5,4 (alt 6,0) und der Schub-Anteil auf 3,5 %. Zwischenstand
Abbau 0,48 / A 3,0 über fünf Saisons: Liga-Mittel +0,39 bis +1,48 (Aufwärtstrend durch wachsenden Decken-Spielraum, Anteil stark
besser 7–10 %). Endstand Abbau 0,51 / A 2,5: Tabelle 1. Verdient (Tabelle 1, letzte Spalte) liegt über 95 % — der Schub-Deckel ist
die Ursache: ohne PP über dem Median und gehaltenes Ziel kommt niemand über +8.

## 6. Regelwechsel, Mehrspieler, Rückweg

- **Stempel:** `seasonState.entwicklungsRegel = { seasonId, regel: "alt" | "neu" }` (`lib/resolve/entwicklung-regel.ts`, Muster
  `formkarten-regel.ts`). Gesetzt beim Anlegen eines Spiels (`new-game-setup-service.ts`) und beim Saisonwechsel
  (`preseason-workflow-service.ts`); die Lade-Migration (`save-repository.ts`) schreibt für die laufende Saison eines bestehenden
  Spielstands „alt“ fest. Neues Spiel: „neu“ ab Saison 1; bestehender Spielstand: ab dem nächsten Saisonwechsel; Manager-Modus bekommt keinen
  Stempel. Jeder Rechenweg fragt `entwicklungNeuFuer(gameState)`, nie die Variable. Training je Spieltag (Ertragskurve), Saisonende,
  Potentialdrift und alle Prognosen lesen denselben Stempel, die Regel kann in einer Saison nicht halb gelten.
- **Rückweg:** `OLY_ENTWICKLUNG=alt` in `deploy/hetzner/.env` (compose reicht ihn an den Container, kein Build-Arg), Container neu
  starten: neue Saisons bekommen „alt“, gestempelte Saisons rechnen zu Ende wie gestempelt.
- **Mehrspieler:** nichts hängt an einem Team oder Besitzer; Leistungsrang und Mittelwerte sind ligaweit, Training/Fokus je Spieler.
- **Unverändert:** Matrix (gesperrt), Wertungs-Fingerabdruck (`GESAMT fe1dc086d68d`), Verletzte trainieren nicht, Training wirkt je
  Spieltag (nur die Kurve der Erträge ist stetig geworden).

## 7. Offen (Stand Runde 1, ersetzt durch 8.7)

- Die Zahlen sind an einer Liga (KI-Teams, Pick-Engine-Draft) geeicht; ein Spielstand mit menschlichen Teams (Bank, anderes Training)
  verschiebt Leistungsrang und Fokus. Die Anteile stark/kaum sind weich (±2 Punkte je Saison durch Stichprobe von ~300 Spielern),
  das Liga-Mittel ist durch den Abbau nachziehbar (`abbauBasis`).
- „PP aus On-top-Effekten zählen nicht doppelt“ (Konzept 22.11., Abschnitt 21): der Leistungsrang nimmt die PP aus dem Punktebuch
  und trennt Ausrüstung/Form noch nicht heraus; erst sinnvoll, wenn die Ausrüstung gebaut ist.
- Prognosen mitten in der Saison (Trainingshistorie, Profil) wenden die Kurve auf die bisherige Teilsumme an; sie zeigen, was ein
  sofortiges Saisonende ergäbe, nicht die Hochrechnung.
- Auslöser für die Potentialdrift (Spielzeit, Verletzung, ungenutztes Attribut): bewusst nicht gebaut (s. o.).
- Kein Alterungsmodell (bleibt: Laufbahnen enden über sinkendes Potential und den Abschied, nicht über Jahre).

## 8. Runde 2: je Spieltag, 60/40 (22.11., Review von PR #1696)

Anlass: das unabhängige Review fand zwei Muss-Funde und fünf Sollte-Funde zur Runde 1 (Abschnitte 3 bis 5). Chris dazu, wörtlich: „trainingsleistung soll
60% ausmachen und spielperformance 40% so dass auch schwächere die noch nicht so gute performance ingame bringen besser durch training aufsteigen — darauf
könnte auch sowas wie diligent wirken dass die spieler sich mehr auf training als ingame performance konzentrieren und die quote da 75% durch training ist
dafür nur 25% durch ingame performance“. **Die Saisonend-Rechnung der Runde 1 (Leistungsrang-Faktor auf das gebuchte Training, Verfall, Entwicklungskurve,
Schub-Deckel) ist ersetzt**; die Abschnitte 3 bis 5 beschreiben sie nur noch als Vorgeschichte (ihre Zahlen gelten nicht mehr). Es bleibt bei: Stempel
`entwicklungsRegel`, Rückweg `OLY_ENTWICKLUNG=alt` (bit-gleich), Potentialdrift mittelwertneutral, Matrix nur gelesen, Wertungs-Fingerabdruck
`GESAMT fe1dc086d68d`.

**Stand nach dem Review der Runde 2 (23.11.): Abschnitt 8.8.** Dort stehen die Korrekturen (L je Einsatz, gedeckelter negativer Schwung, Rückweg nur über den Stempel,
forceReplace, Erwartung aus der Vorsaison, offene Spieltage) und die **gültigen Zahlen**. Die Zahlen in 8.2 (Prognose zu Saisonbeginn), den Tabellen 5 bis 8, 8.4 und
8.5 sind **überholt** (Stand vor den Review-Fixes, markiert „überholt“); die Regelbeschreibung in 8.1 ist dort nachgezogen, wo sie sich geändert hat.

### 8.1 Die Regel: ein Delta je Spieltag und Attribut

    Delta = T (Training) + L (Leistung, mit Vorzeichen) − A (Abbau)

Alles wird je Spieltag **gebucht und im Trainingsverlauf gezeigt** (`z` = T, `p` = L mit Vorzeichen, `a` = A, `f` = Ligafaktor des Abbaus; Netto auf dem Attribut =
z + p − a, drei Stellen, gezeigt = gebucht). Das Saisonende bucht keine Entwicklung mehr nach und nimmt nichts zurück; es bleibt die Potentialdrift (und, wie
immer, die Decken-Klemme, wenn die Drift eine Decke unter einen Wert senkt).

| Teil | Quelle | Regel |
|---|---|---|
| **T** | bestehende Tages-Setpoints (`TRAINING_SETPOINTS_JE_SPIELTAG`) | Budget × Ertragskurve zur Decke (stetig) × **Fokusfaktor** (0,5 bis 1,5 nach dem Anteil des meistgewählten Ziels, erst ab fünf Trainingstagen) × Gewicht Training × Eichung `trainingsSkala` |
| **L** | **je Einsatz**: die PP des Spielers in einer Disziplin an diesem Spieltag gegen den **Median derselben Liga und derselben Disziplin** (nur wer in ihr antrat) | Einheit = PP-Abstand / `ppEinheit` (3), darüber `z^1,35`, darunter `−1,65·|z|`, auf drei Einheiten begrenzt; die Einheiten der Einsätze eines Tages werden summiert, jede nach dem Matrixgewicht **ihrer** Disziplin auf die Attribute verteilt, positiver Teil mal Ertragskurve. **Ohne Einsatz L = 0, keine Zusatzstrafe.** × Gewicht Leistung × Eichung × **Schwung**, negativer Teil mit Saisongrenze (8.8) |
| **A** | Grundabbau (0,031 je Attribut und Saison) + Marktwertdruck × 1,437, durch die Saisonlänge geteilt, mal die Decken-Dämpfung, mal der **Ligafaktor** | **Verletzte: kein T, kein L und auch kein A** — keine Mehrfachstrafe mehr |
| Gewichte | 60 % Training / 40 % Leistung; **Trait Diligent 75 % / 25 %** (`traitsPositive`, Name „Diligent“) | Training × (Gewicht/0,6), Leistung × (Gewicht/0,4): bei 60/40 der Zuwächse bleibt die Summe gleich, nur der Anteil verschiebt sich |
| **Schwung** | je Spieltag statt Kurve am Saisonende | geht die Saison bisher in die Richtung der heutigen Leistung (Netto bisher und L gleiches Vorzeichen), zählt L mit `1 + 3,3 · min(Obergrenze, (|Netto bisher| / 3,8)^2,75)`, Obergrenze positiv 3, **negativ 0,8** (8.8); wer kaum Netto hat, wird kaum verstärkt. Daraus entstehen die wenigen starken Schübe und Einbrüche, die Masse bleibt kaum verändert |
| **Ligafaktor** | `ligaAbbauFaktor`, ligaweit, trifft alle Teams gleich | stellt den Abbau je Spieltag so, dass die Abbau-Summe der ganzen Saison die Zuwächse der Liga (Training + positive Leistung − negative Leistung) trifft: Gleichgewicht der bisherigen Spieltage, hochgerechnet auf die Saison, der Rest wird nachgeholt; 0,6 bis 1,6, bis zum dritten Spieltag 1, **je Spieltag um höchstens ±0,1 gegenüber dem zuletzt gebuchten Faktor** (8.8). Er steht im Verlauf (`f`), Vorschau und Prognose rechnen mit demselben |

Dateien: `lib/training/entwicklung-neu.ts` (Parameter, Formeln), `lib/training/entwicklung-tag.ts` (PP-Index, Leistung, Ligafaktor, Zusammenführung mit Decke und
Boden), `lib/training/matchday-training-accumulator.ts` (Buchung, Rückbau bei Neubuchung, Abschluss nach halbem Spieltag), `lib/training/spieltag-training.ts`
(`berechneSpieltagsZuwachs` liefert T und A, Vorschau = Buchung), `lib/training/organic-season-progression.ts` (Prognose/Saisonende).
Halber Spieltag (Arena-Teilbuchung): T und A stehen seit D1 fest (`o`), die Leistung des ganzen Spieltags kommt mit dem Abschluss-Commit dazu.

### 8.2 Prognosen und Saisonende (M1, S5)

`buildOrganicSeasonProgression` (Trainingsseite, Spielerprofil, Bestenliste, Saisonende-Apply) rechnet mit Stempel „neu“ nur noch den **noch nicht gebuchten
Rest** mit derselben Formel: Training aus dem Budget der offenen Spieltage, Abbau × offene Spieltage × Ligafaktor, Leistung = bisheriger Schnitt der gebuchten
Spieltage (ohne Einsätze: 0, also der Liga-Median). Zu Saisonbeginn ist das die ganze Saison, am Saisonende nichts. Die frühere Saisonend-Strafe (Rang 0,25 ohne
Einsätze, voller Abbau, verstärkende Kurve, bis −18) kommt in keiner Prognose mehr vor.

- **Prognose zu Saisonbeginn (überholt, siehe 8.8 Fund 5)** (383 Kaderspieler, frisch angelegter Spielstand, Prognose-Aufruf wie die Trainingsseite): Mittel −0,5, p5 −4,6, Median −0,5, p95 +2,6,
  kleinster Wert −9,1, größter +6,1 (Runde 1: bis −18). Beispiele: Jasper Kane Training +1,1 / Abbau −10,2 = −9,1 (sehr teurer Spieler an der Decke),
  Gravemind Atoll +2,8 / −3,3 = −0,5, Colonys Sting +8,1 / −2,5 = +6,1. Die Prognose kennt noch keine Leistung (L = 0), deshalb liegt die Spanne eng um das Mittel.
- **Rückweg: nur noch `OLY_ENTWICKLUNG=alt`** (8.8 Fund 3). Der „Rutsch am Saisonende“ der ersten Fassung (`OLY_TRAINING_JE_SPIELTAG=aus` bei Stempel „neu“) ist
  entfernt: Eine Prozessvariable ohne Stempel kennt der Browser nicht und konnte mitten in der Saison Training doppelt buchen. Mit dem Stempel „neu“ wird immer je
  Spieltag gebucht; `OLY_TRAINING_JE_SPIELTAG=aus` setzt nur noch beim Saisonwechsel den Stempel „alt“ (wenn `OLY_ENTWICKLUNG` nicht gesetzt ist).
- `buildPlayerSeasonTrainingForecast` (Trainingshistorie) summiert mit „neu“ genau die Verlaufseinträge (Training, Leistung, Abbau), ohne je Spieler einen
  abgeschnittenen Spielstand zu bauen.

### 8.3 PP-Index (S3, S4)

`ppTagesIndex(gameState)` baut **einmal je Ergebnisbestand** (`WeakMap` am `seasonState`) aus dem Punktebuch die PP je Spieler und Spieltag und den **Median je
Liga** (`leagueByTeamId`, ohne Split eine Liga „all“). Der Rang gilt damit je Liga, nicht ligaübergreifend („Reiche werden reicher“ durch eine Liga-1-Skala fällt
weg: Liga 2 misst sich an Liga 2). Der alte Leistungsrang-Index je Spieler-`truncatedGameState` (688 → 1213 ms für zehn Spieler) ist entfernt.

### 8.4 Eichung und Messung

Werkzeug unverändert `scripts/miss-entwicklung.ts` (32 KI-Teams von Anfang an, derselbe Ausgangsstand für alle Läufe), neu `--tage` (je Spieler und Spieltag
Training, Abbau und PP-Abstand im Ergebnis — damit lässt sich die Eichung offline durchspielen), `--bank K --bank-teams N` (N Teams bekommen K Zusatzspieler aus
den Freien, nach Stärke knapp unter dem eigenen Kader). Vorgehen: Lauf mit Zwischenwerten, danach die Parameter an den je Tag gespeicherten Rohdaten offline
gesucht (Ziel: Mittel −1..+1, 5–8 % ≥ +8, 5–8 % ≤ −8, 50–60 % kaum, 60 % Trainingsanteil, Korrelation Startstärke↔Netto ≤ 0,15), im vollen Lauf bestätigt.

Was die Läufe gelehrt haben (Tabelle 5, Vorgeschichte; die gültigen Zahlen stehen in 8.8):

1. Die Leistung korreliert mit der Startstärke (0,51), der Marktwertdruck im Abbau mit 0,94 gleicht das aus: deshalb ist der Abbau vom flachen Grundabbau
   (0,51 → 0,031) zum Marktwertdruck (× 1,437) verschoben.
2. Rein linear bleibt die Verteilung eine Glocke (kaum 54 %, aber nur 2 % ≥ +8). Die Ränder entstehen erst durch den Schwung.
3. Die Korrelation Start↔Netto stieg ohne Gegenmaßnahme über die Saisons (0,05 → 0,23 → 0,38: die Liga sortiert sich, Starke bleiben vorn): stärkerer Marktwertdruck
   im Abbau (Zeile „B“).
4. Das Liga-Mittel lief ohne Regler über die Saisons weg (+0,08 → −1,0 → −2,1: die Ertragskurve schließt sich zur Decke, die positiven Teile schrumpfen, der
   negative Teil der Leistung wird vom Schwung voll verstärkt, der Abbau bleibt): der **Ligafaktor** (Zeile „C“).

**Tabelle 5: Eichung** (Regel neu, Saison 1 bzw. Saisons 1–3, Trainingsanteil = Training / (Training + positive Leistung))

| Lauf | Saison | Mittel | stark besser % | stark schlechter % | kaum % | Trainingsanteil % | Korr. Start↔Netto |
|---|---:|---:|---:|---:|---:|---:|---:|
| Probe 1: Skalen 1/1/1, flacher Abbau 0,51, kein Schwung | 1 | +2,16 | 16,3 | 2,2 | 32,5 | 56,7 | +0,27 |
| Probe 2: Training 0,6, Leistung 0,5, Marktwert 2,5, kein Schwung | 1 | −1,89 | 1,2 | 2,1 | 34,8 | 59,1 | −0,38 |
| A: Schwung (2,64), Marktwert 0,96 | 1 / 2 / 3 | −0,11 / −0,12 / −0,72 | 6,5 / 10,4 / 5,7 | 4,6 / 8,8 / 8,7 | 51,4 / 47,1 / 52,3 | 61 / 52 / 61 | +0,05 / +0,23 / +0,38 |
| B: Marktwert 1,44, Schwung 3,3 | 1 / 2 / 3 | +0,08 / −1,00 / −2,06 | 8,2 / 9,5 / 4,7 | 5,3 / 11,8 / 12,8 | 49,1 / 43,3 / 51,5 | 60 / 53 / 66 | −0,11 / +0,16 / +0,12 |
| **C (Endstand): + Ligafaktor, Schwung 3** | siehe Tabelle 6 | | | | | | |

**Tabelle 6 (überholt, Stand vor den Review-Fixes; gültig ist 8.8): Endstand über drei Saisons** (32 KI-Teams, je Saison etwa 300 Spieler; Wiederholung mit derselben Saat ergibt bit-gleiche Werte)

| Saison | Spieler | Liga-Mittel | Median | stark besser % | stark schlechter % | kaum % | Trainingsanteil % | Korr. Start↔Netto | PP über Median bei stark Besseren % |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 321 | -0.53 | -0.7 | 6.5 | 5.9 | 48.9 | 63.3 | -0.21 | 86 (n 21) |
| 2 | 308 | -0.80 | -0.5 | 5.8 | 9.1 | 46.1 | 56.5 | +0.01 | 94 (n 18) |
| 3 | 299 | -0.57 | -0.3 | 6.0 | 8.0 | 54.5 | 61.7 | +0.10 | 89 (n 18) |
| Mittel | | -0.63 | | 6.1 | 7.7 | 49.8 | 60.5 | -0.03 | |

Soll gegen Ist: Liga-Mittel in allen drei Saisons zwischen −0,8 und −0,5 (Soll −1..+1, leichter Abwärtszug, Stellschraube `abbauBasis`); stark besser 5,8–6,5 % (Soll
5–8); stark schlechter 5,9–9,1 % (Soll 5–8, Saison 2 drüber); kaum verändert 46–55 % (Soll 50–60, Saison 1 und 2 knapp darunter); Trainingsanteil im Mittel 60,5 %;
Korrelation Start↔Netto −0,21 / +0,01 / +0,10 (Soll ≤ 0,15, nicht steigend: erfüllt).

**Tabelle 7 (überholt, s. 8.8): Gruppen, Saison 1 des Endstands** (Netto = Summe der zwölf Attribute; Training Z, Leistung P, Abbau A je Saison)

| Gruppe | Spieler | Netto Mittel | Training Z | Leistung P | Abbau A | ≥ +8 / ≤ −8 % | Einsätze |
|---|---:|---:|---:|---:|---:|---:|---:|
| alle | 321 | -0.53 | 3.76 | -0.54 | 3.65 | 6.5 / 5.9 | 13.4 |
| Einsätze ≤ 8 (Bank) | 8 | +0.79 | 4.63 | -1.08 | 2.76 | 0.0 / 0.0 | 7.8 |
| Einsätze 9–14 | 188 | +0.53 | 3.93 | -0.55 | 2.74 | 8.0 / 3.7 | 11.8 |
| Einsätze ≥ 15 | 125 | -2.21 | 3.45 | -0.48 | 5.08 | 4.8 / 9.6 | 16.1 |
| verletzt (≥ 1 Ausfalltag) | 75 | -1.62 | 3.77 | -0.74 | 4.53 | 6.7 / 8.0 | 14.7 |
| nie verletzt | 246 | -0.20 | 3.75 | -0.47 | 3.39 | 6.5 / 5.3 | 13.0 |
| Diligent | 45 | +3.07 | 5.75 | +0.73 | 3.34 | 17.8 / 2.2 | 13.3 |
| nicht Diligent | 276 | -1.12 | 3.43 | -0.74 | 3.70 | 4.7 / 6.5 | 13.4 |
| Start unteres Drittel | 107 | +1.16 | 3.72 | -0.04 | 2.45 | 8.4 / 0.9 | 11.9 |
| Start mittleres Drittel | 107 | -0.96 | 3.98 | -1.95 | 2.88 | 5.6 / 10.3 | 12.4 |
| Start oberes Drittel | 107 | -1.79 | 3.57 | +0.38 | 5.63 | 5.6 / 6.5 | 15.9 |

**Tabelle 8 (überholt, s. 8.8): Bank** (eigener Lauf, 8 Teams mit je drei Zusatzspielern, Saison 1, 338 Spieler; dort Liga-Mittel −0,64)

| Gruppe | Spieler | Netto Mittel | Training Z | Leistung P | Abbau A | ≥ +8 / ≤ −8 % | Einsätze |
|---|---:|---:|---:|---:|---:|---:|---:|
| Bank-Messfall: 18 Zusatzspieler bei 8 Teams | 18 | +0,91 | 3,48 | ±0,00 | 2,51 | 5,6 / 0,0 | 10,5 |
| übrige Kader dieses Laufs | 320 | −0,73 | 3,77 | −0,96 | 3,46 | 5,6 / 8,8 | 12,8 |
| Einsätze ≤ 8 in diesem Lauf | 31 | +2,84 | 4,93 | +0,49 | 2,53 | 12,9 / 0,0 | 7,0 |

Zu lesen:

- **Bank:** wer kaum eingesetzt wird, fällt nicht zurück. Die Zusatzspieler (im Mittel 10,5 Einsätze) liegen bei +0,9, die mit höchstens 8 Einsätzen bei +2,8 (Training
  4,9 gegen Abbau 2,5, Leistung ±0). Training hält sie, wie vorgegeben „ohne Einsatz, aber mit gehaltenem Training: nicht zurückfallen“.
- **Verletzte:** −1,6 gegen −0,2 der nie Verletzten. Der Unterschied ist zum Teil Auswahl (Verletzte spielen mehr, sind teurer: Abbau 4,5 gegen 3,4) und zum Teil
  die verlorenen Trainingstage; eine Zusatzstrafe gibt es nicht (Test: kein T, L, A an Ausfalltagen).
- **Stärke:** unteres Drittel +1,2, oberes −1,8. Chris: „schwächere ... besser durch training aufsteigen“ — das trifft ein; die Tendenz zur Mitte ist etwas stärker als
  nötig. Hebel: `abbauMarktwertSkala`.
- **Diligent (überholt, siehe 8.8):** +3,1 gegen −1,1 (Training 5,8 gegen 3,4) in der ersten Fassung. Die Erklärung dort („75/25 ist summenneutral“) war falsch, siehe 8.8.
- **Verdient:** 86–94 % der Stark-Besseren haben PP je Einsatz über dem Median (Tabelle 6); ihr Trainingsanteil an den Zuwächsen liegt bei rund 40 %, sie gewinnen über die
  Leistung, der Liga-Anteil bei 60 %.

### 8.5 Die Review-Funde und wie sie behoben sind

| Fund | Behebung |
|---|---|
| **M1** Prognosen zu Saisonbeginn bis −18 | Prognose = Rest-Rechnung mit der Je-Spieltag-Formel (8.2); zu Saisonbeginn Mittel −0,5, kleinster Wert −9,1 |
| **M2** Saisonende nimmt gebuchtes Training zurück (Herkunft „Training“ im Mittel −2,3) | Das Saisonende bucht keine Entwicklung mehr nach: im Messlauf sind Training, Nebenwirkung, Leistung und Abbau im Saisonend-Ereignis alle 0 (kein Eintrag mehr). Die Attribute behalten die drei Nachkommastellen der Buchung (früher Rundung auf eine Stelle am Saisonende) |
| **S1** Mehrfachstrafe bei Verletzung | Verletzte: kein T, kein L, kein A; kein Verfall, keine Rang-Strafe, keine Kurve (Test) |
| **S2** Bank ungemessen | `--bank`, Tabelle 8 |
| **S3** Rang ligaübergreifend | Median je Liga am selben Spieltag (8.3) |
| **S4** Rang-Index je Spieler neu gebaut | ein Index je Ergebnisbestand (8.3); die Historie baut keinen abgeschnittenen Spielstand mehr |
| **S5** Rückweg ließ Leistungsfaktor wirkungslos | der Rutsch rechnet dieselbe Formel am Saisonende (8.2) |

### 8.5a Überholt

Die Zahlen der Tabellen 5 bis 8 und die Prognosezahlen in 8.2 stammen aus der Fassung vor dem Review (L aus der Tagessumme gegen den Median der Tagessummen, ungedeckelter
Schwung, Ligafaktor ohne Schritt, Prognose ohne Erwartung). Es gelten die Zahlen in 8.8.

### 8.6 Stellschrauben (`ENTWICKLUNGS_PARAMETER_STANDARD`, Runde 2)

| Schraube | Wert | Wirkung |
|---|---:|---|
| `gewichtTraining` / `gewichtLeistung` | 0,6 / 0,4 | Chris: 60 % Training, 40 % Leistung |
| `gewichtTrainingDiligent` / `gewichtLeistungDiligent` | 0,75 / 0,25 | Trait Diligent |
| `trainingsSkala` / `leistungsSkala` | 0,6 / 0,9 | Eichung der Teile (Verhältnis der Zuwächse 60 : 40) |
| `abbauBasis` / `abbauMarktwertSkala` | 0,031 / 1,437 | Grundabbau (Liga-Mittel: ±0,01 ≈ ∓0,1) und Stärke-Neutralität |
| `ppEinheit`, `zMax`, `gamma`, `beta`, `betaExponent` | 3, 3, 1,35, 1,65, 1 | Form der Leistung |
| `schwungStaerke`, `schwungSumme`, `schwungExponent`, `schwungMax` | 3,3, 3,8, 2,75, 3 | Ränder der Verteilung (die „verstärkende Kurve“, je Spieltag) |
| `schwungMaxNegativ`, `negativSaisonGrenze` | 0,8, 10 | Obergrenze des negativen Schwungs, Saisongrenze für die negative Leistung (8.8) |
| `ligaFaktorSchritt`, `erwartungGewichtTage` | 0,1, 4 | Schritt des Ligafaktors je Spieltag, Gewicht der Vorsaison-Erwartung in der Prognose (8.8) |
| `fokusStaerke`, `fokusMinTage` | 0,5, 5 | Fokusfaktor auf das Training |

Faustregel: Liga-Mittel zu hoch/niedrig → `abbauBasis`; zu wenige/zu viele Ränder → `schwungStaerke`; Starke gewinnen/verlieren zu viel → `abbauMarktwertSkala`.
`OLY_ENT_PARAMS` (JSON) überschreibt Werte nur im Messskript (`scripts/miss-entwicklung.ts`), nie im Spiel.

### 8.7 Offen

- **Diligent:** entschieden (PM, 23.11.), siehe 8.8: keine KI-Neigung zum Modus „hart“ mehr, 75/25 bleibt.
- Die Eichung stammt aus einer reinen KI-Liga (Kader von 9 bis 14). Mit Menschen (andere Aufstellungen, später Ausrüstung) nachmessen; Liga-Mittel −0,5 bis −0,8 ist
  der untere Rand, `abbauBasis` leicht senken, wenn es weiter absinkt.
- Der Rückweg ist seit 8.8 allein `OLY_ENTWICKLUNG=alt` (bit-gleich zum Stand davor); der Rutsch ist entfernt.
- Verdient (Runde-1-Maß „PP über Median **und** Ziel gehalten“) liegt nur bei etwa 50 %, weil das Ziel nur als Faktor 0,5–1,5 auf das Training eingeht, nicht als Bedingung.
- Die Decken-Summe je Spieler und Saison steigt im Messlauf um etwa +4 (Drift +0,5 bis +0,8, der Rest sind Decken, die ein Attribut über der Decke anhebt); nicht Teil dieser Änderung, nicht neu bewertet.

### 8.8 Review-Fixes (23.11., Review von PR #1696 Runde 2)

Ein unabhängiges Review fand fünf wichtige bis mittlere und vier kleine Punkte; dazu kommt die PM-Entscheidung zu Diligent. Alle Punkte sind umgesetzt; die Zahlen unten
**ersetzen** die der Tabellen 6 bis 8 (Messlauf neu, zwei Saaten). Die Matrix ist unberührt, der Wertungs-Fingerabdruck bleibt `GESAMT fe1dc086d68d`.

| # | Fund | Behebung (Datei) |
|---|---|---|
| 1 | L ungerecht bei Rotation: PP wurden über D1 + D2 eines Tages summiert und mit dem Median der **Tagessummen** verglichen; wer nur eine Disziplin spielt, wurde bestraft, Disziplinen mit anderer PP-Streuung mischten sich | Median und Vergleich **je (Liga, Disziplin, Spieltag)**, Einheit z **je Einsatz**, dann summiert; jede Einheit nach dem Matrixgewicht **ihrer** Disziplin verteilt (`ppTagesIndex`, `leistungsEinheitFuerTag`, `verteileLeistung` in `entwicklung-tag.ts`). Neu geeicht (8.8.2) |
| 2 | Negativer Schwung ungedeckelt (ab Netto −5,7 durchgehend ×10; wer konstant 0,75 PP unter dem Median lag, kam rechnerisch auf −47 je Saison) | Eigene Obergrenze **`schwungMaxNegativ` 0,8** (statt 3; `schwungFaktor` in `entwicklung-neu.ts`) und eine **Saisongrenze `negativSaisonGrenze` 10** für den negativen Teil von L (`leistungFuerTag`, `negativeLeistungBisher` in `entwicklung-tag.ts`); was die Saison an negativer Leistung schon gebucht hat, zählt von der Grenze ab |
| 3 | `OLY_TRAINING_JE_SPIELTAG=aus` ohne Stempel; Umschalten mitten in der Saison buchte T doppelt | Mit dem Stempel „neu“ wird **immer** je Spieltag gebucht (`trainingJeSpieltagFuer(gameState)` in `training-je-spieltag-schalter.ts`); die Variable setzt nur beim Saisonwechsel den Stempel „alt“ (`entwicklungsRegelSchalter` in `entwicklung-regel.ts`, `OLY_ENTWICKLUNG` hat Vorrang). Der „Rutsch“ am Saisonende ist entfernt (`bestimmeEntwicklungsRest` in `organic-season-progression.ts`), damit gibt es auch kein doppeltes T mehr. Alle Rechenwege fragen den Spielstand (Akkumulator, Saisonende-Apply, Historie, Überlastung, Spieltags-Apply) |
| 4 | `forceReplace` mit gleichem Modus behielt ein veraltetes L | Der Verlaufseintrag trägt einen PP-Fingerabdruck `h` (`ppHashFuerTag`: je Disziplin PP und Median); weicht er beim erneuten Buchen ab, wird zurückgenommen und neu gerechnet (`leistungVeraltet` in `matchday-training-accumulator.ts`); der Abschluss-Commit nach halbem Spieltag setzt ihn ebenfalls |
| 5 | Prognose zu Saisonbeginn setzte L = 0 (Stars an der Decke bis −9) | **Erwartung aus der Vorsaison**: Der Eintrag trägt `y` (Einheit je Einsatz-Disziplin), beim Saisonwechsel entsteht daraus `player.leistungsErwartung` (`baueLeistungsErwartung`, `preseason-workflow-service.ts`, beide Reset-Pfade). Die Prognose rechnet L = mittleres z je Einsatz × Einsatzquote × Leistungsfaktor, nach Matrix verteilt, in der Saison mit den gebuchten Tagen gemischt (`erwartungGewichtTage` 4, `restLeistung`). Ohne Vorsaison 0. Die Anzeige nennt die Spalte **„Leistung (Erwartung)“** (`TrainingModern.tsx`, Tooltip in `TrainingCompactNewLook.tsx`); T, A und L stehen getrennt (`training`, `regression`, `performance` im Breakdown), die Netto-Summe bleibt. Gebuchtes (Verlauf) und Prognose bleiben getrennt. Kein Screenshot-Abgleich in dieser Runde (reine Beschriftung) |
| 6 | Ligafaktor sprang je Spieltag | Änderung gegenüber dem zuletzt gebuchten Faktor auf **±0,1 je Spieltag** begrenzt (`ligaAbbauFaktor`, `letzterLigaFaktor`, `ligaFaktorSchritt`) |
| 7 | Offene Einträge (`o`) uneinheitlich | Historie: nur unter „offen“ (netto z − a), nicht in Training/Abbau (`baueNeuHistorie` in `player-matchday-training-history.ts`); Prognose: z − a des offenen Tages zählt zum Rest, sein L als Erwartung (`offenerAnteil`, `restLeistung`) |
| 8 | `driftZentrum` mittelte über alle Spieler | nur über Spieler mit Attribut-Decken (`applySeasonEndPotentialUpdates` in `player-potential-service.ts`) |
| 9 | `OLY_ENT_PARAMS` im Spiel auswertbar | Das Spiel liest sie nicht mehr; `setzeEntwicklungsParameterFuerMessung` ruft nur `scripts/miss-entwicklung.ts` auf (liest dort `OLY_ENT_PARAMS`) |
| PM | Diligent | KI-Neigung zu „hart“ für Diligent entfernt (`HART_BIAS_TRAITS` in `training-mode-demand-service.ts`): die KI wählt den Modus für alle nach denselben Regeln (Belastung, Form). 75/25 bleibt |

#### 8.8.1 Diligent: 75/25 ist nicht summenneutral

Die Aussage „75/25 ist summenneutral“ (frühere Fassung dieser Doku) stimmt nicht: T ist im Mittel positiv, L im Mittel negativ (die Beträge sind asymmetrisch, `beta` 1,65 gegen
`gamma` 1,35). Wer 15 Punkte von 40 auf 25 % Leistung senkt und sie dem Training gibt, tauscht einen im Mittel negativen gegen einen positiven Teil und gewinnt etwa **+1** Netto je Saison.
Das bleibt so stehen (PM-Entscheidung). Dazu kommt das Trainingsbudget des Traits selbst. Gemessen nach den Fixes (Netto-Mittel Diligent minus Rest, Saison 1 / 2 / 3):
**Saat 1 +1,22 / +2,95 / +2,53, Saat 2 +1,33 / +1,68 / +2,54** (je rund 42 Diligent-Spieler). Die KI-Neigung zu „hart“ ist dabei weg; der verbliebene Vorsprung kommt aus 75/25 und dem Trait-Budget.

#### 8.8.2 Messung nach den Fixes

Werkzeug unverändert `scripts/miss-entwicklung.ts`, 32 KI-Teams von Anfang an, drei Saisons, zwei Saaten (zwei getrennt angelegte Spiele). Eichung in zwei Zwischenläufen auf Saat 1
(Parameter über `OLY_ENT_PARAMS`, nur im Skript): (a) Grenze 8 / negativer Schwung 0,6 / `schwungStaerke` 3: negative Ränder in Saison 2 und 3 zu dünn (1,3 % und 1,0 %);
(b) Grenze 12 / 1,0 / 3,3: Minimum −15,6, ≤ −8 in Saison 1 bei 9,3 %; Endstand Grenze 10 / 0,8 / 3,3.

**Tabelle 9: Endstand, je Saison** (Netto = Summe der zwölf Attribute je Spieler; Trainingsanteil = T / (T + positives L); „L“ = Mittel der gebuchten Leistung je Spieler)

| Saat | Saison | Spieler | Mittel | p1 | p99 | Min | Max | ≥ +8 % | ≤ −8 % | kaum % | Trainingsanteil % | Korr. Start↔Netto | L bei ≤ 8 Einsätzen (n) | L bei > 8 Einsätzen | Netto ≤ 8 / > 8 Einsätze | Diligent-Vorsprung (n) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 312 | −0,29 | −11,46 | 30,97 | −13,73 | 35,52 | 4,81 | 8,33 | 46,15 | 60,69 | −0,20 | −1,33 (39) | −0,24 | +0,74 / −0,44 | +1,22 (43) |
| 1 | 2 | 305 | −0,43 | −10,57 | 18,71 | −12,54 | 28,15 | 4,26 | 5,90 | 53,77 | 64,07 | −0,04 | −1,62 (19) | −0,63 | +0,36 / −0,48 | +2,95 (43) |
| 1 | 3 | 296 | −0,34 | −10,05 | 20,74 | −12,10 | 32,47 | 4,39 | 4,05 | 52,70 | 64,81 | +0,08 | −2,10 (16) | −0,64 | +0,47 / −0,38 | +2,53 (42) |
| 2 | 1 | 321 | −0,24 | −10,97 | 21,56 | −12,70 | 31,64 | 5,61 | 4,36 | 48,60 | 60,63 | −0,17 | −0,58 (33) | −0,44 | +1,37 / −0,42 | +1,33 (44) |
| 2 | 2 | 317 | −0,15 | −10,51 | 23,52 | −12,65 | 49,48 | 5,99 | 6,62 | 54,57 | 59,03 | +0,06 | −1,50 (23) | −0,26 | +0,84 / −0,23 | +1,68 (43) |
| 2 | 3 | 307 | −0,11 | −10,64 | 18,77 | −11,71 | 22,58 | 6,84 | 6,19 | 54,72 | 63,60 | +0,08 | −1,14 (23) | −0,63 | +0,73 / −0,18 | +2,54 (41) |

Soll gegen Ist:

- **Mittel** −0,11 bis −0,43: im Soll (±1).
- **Untergrenze:** kleinster Wert in allen sechs Saisons −11,7 bis −13,7, p1 −10,0 bis −11,5: **kein Spieler unter −15** (ohne Deckel rechnerisch bis −47).
- **Ränder:** ≥ +8 liegt bei 4,3 bis 6,8 % (Saat 1 mit 4,3 bis 4,8 % knapp unter 5), ≤ −8 bei 4,1 bis 8,3 % (Saat 1 Saison 3 mit 4,05 und Saat 2 Saison 1 mit 4,4 knapp unter 5). Die Streuung
  zwischen den Saaten (±1 Punkt) ist so groß wie der Abstand zur Soll-Marke; mehr Schärfe verlangte mehr Messläufe.
- **kaum** 46 bis 55 % (Soll ≈ 50), **Trainingsanteil** 59 bis 65 % (Soll 60), **Korrelation Start↔Netto** −0,20 bis +0,08 (Soll ≤ 0,15, nicht steigend).
- **L je Einsatz-Gruppe:** wer höchstens 8-mal antrat, hat im Mittel L −0,6 bis −2,1 (Rest −0,2 bis −0,6); sein **Netto bleibt trotzdem positiv** (+0,4 bis +1,4 gegen −0,2 bis −0,5 beim
  Rest), weil Training und kleinerer Abbau ihn halten.
- Ausreißer: Saat 2 Saison 2 hat einen Spieler mit Netto +49,5 (Schwung, Attribute weit unter der Decke); die positiven Ränder sind nicht gedeckelt (die Vorgabe nennt nur die negative Grenze).

**Prognose zu Saisonbeginn** (Saat 2, Aufruf wie die Trainingsseite, Netto der Kaderspieler):

| Saison | Spieler (mit Erwartung) | Mittel | p1 | p99 | Min | Max | T | L (Erwartung) | A |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 (keine Vorsaison, L = 0) | 365 (0) | −1,00 | −8,53 | +3,69 | −8,98 | +4,51 | +2,79 | 0 | −3,83 |
| 2 | 321 (321) | −1,34 | −7,43 | +3,70 | −8,78 | +3,94 | +2,93 | −0,34 | −3,98 |
| 3 | 317 (317) | −1,34 | −6,08 | +3,25 | −7,64 | +3,81 | +3,04 | −0,43 | −4,03 |

Die Erwartung ändert das Minimum der Prognose nur wenig (−9,0 gegen −8,8 und −7,6): Der Tiefstwert kommt aus dem Abbau (A) teurer Spieler an der Decke gegen kleines T, nicht aus L. Gebucht wurde
im selben Lauf bis −12,7; die Prognose bleibt eine ruhige Erwartung, keine Hochrechnung der Ränder.

**Nicht gemessen:** keine Rotation von Menschen und kein Bank-Messfall (`--bank`) nach den Fixes (Tabelle 8 ist überholt, die Gruppe „höchstens 8 Einsätze“ oben ist der Ersatz);
`OLY_TRAINING_JE_SPIELTAG=aus` ist nur im Test geprüft (`tests/entwicklung-review-22-11.test.ts`), nicht über Saisons gemessen.

Tests: `tests/entwicklung-review-22-11.test.ts` (Fix 1 bis 5, 7, 9, Diligent-Neigung), ergänzt `tests/entwicklung-je-spieltag.test.ts` (negativer Schwung, Ligafaktor mit Schritt, `verteileLeistung` je Einsatz).
