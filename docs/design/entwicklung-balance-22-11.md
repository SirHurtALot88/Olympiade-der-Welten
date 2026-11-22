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

Stand: Regel **„neu“** gebaut, geeicht und über fünf Saisons gemessen. Gilt per Spielstand-Stempel (`seasonState.entwicklungsRegel`),
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

## 3. Was die Regel „neu“ tut

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
2. **Abbau hängt an der Leistung.** Grundabbau je Attribut 0,48 statt 0,3 (alt), mal `1 + 1,0 × (0,5 − Leistungsrang)`: wer unter der
   Liga-Mitte spielt, baut bis zu 50 % mehr ab, wer darüber spielt, bis zu 50 % weniger. Dazu 0,25 Verfall (Summe) je
   Verletzungs-Ausfalltag (Verletzte trainieren nicht, Regel vom 18.11. bleibt). Der Marktwertdruck und die Decken-Dämpfung des
   Abbaus bleiben.
3. **Leistungskanal gedrosselt** auf 60 % (`leistungsSkala`), damit die PP nicht doppelt zählen (sie wirken schon über den Faktor).
4. **Abnehmende Erträge, stetig.** `ertragsFaktor(h)` mit h = Decke − Wert: ab 10 Punkten Abstand voller Satz, bei 1 Punkt 0,05,
   dazwischen linear (bei 5 Punkten ≈ 0,47, bisher Stufe 0,45). Gilt für das Training je Spieltag (nur Stempel „neu“), den Nachlegen-Anteil
   und den Leistungskanal (nie unter 0,3, wie der alte weiche Auslauf).
5. **Entwicklungskurve** auf die Gesamtsumme eines Spielers: `G(x) = sign(x) · 3 · (|x| / 4)^2,6`, höchstens ±18. Kleine Summen
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

## 4. Stellschrauben (`ENTWICKLUNGS_PARAMETER_STANDARD`)

| Schraube | Wert | Wirkung |
|---|---:|---|
| `faktorMin` / `faktorMax` | 0,6 / 1,4 | Spanne des Leistungsfaktors auf das gebuchte Training |
| `einsatzVoll` | 10 | Einsätze, ab denen der Leistungsfaktor voll zählt |
| `fokusStaerke` | 0,5 | Spanne des Fokusfaktors (1 ± 0,5) |
| `abbauBasis` | 0,48 | Grundabbau je Attribut und Saison (alt 0,3); **die** Schraube für das Liga-Mittel: ±0,1 verschiebt es um ≈ ∓1 |
| `abbauLeistungsKopplung` | 1,0 | Abbau × (1 + k × (0,5 − Rang)) |
| `verfallJeAusfalltag` | 0,25 | Zusatzabbau je Verletzungstag (Summe) |
| `leistungsSkala` | 0,6 | Leistungskanal |
| `kurveA` / `kurveSigma` / `kurveK` / `kurveMax` | 3 / 4 / 2,6 / 18 | Entwicklungskurve: Form der Verteilung (Anteil stark / kaum) |
| `schubOhneVerdienstMax` / `schubRangMin` / `schubFokusMin` / `schubZielTageMin` / `schubRampe` | 7,5 / 0,5 / 0,6 / 12 / 0,15 | Schub-Deckel ohne PP und Fokus |
| Drift: Verschiebung je Ausblick | ±0,12 / ±0,06 / 0 | `ENTWICKLUNG_NEU_DRIFT_VERSCHIEBUNG`, Liga-Schnitt wird abgezogen |

Faustregel: Liga-Mittel zu hoch → `abbauBasis` hoch; zu viele Stark-Besser/Schlechter → `kurveA` oder `kurveK` runter; zu wenige →
rauf. `OLY_ENT_PARAMS` (JSON) überschreibt einzelne Werte **nur für Messläufe** (`scripts/miss-entwicklung.ts`), im Spiel nie gesetzt.

## 5. Messung

Werkzeug: `scripts/miss-entwicklung.ts` (Wegwerf-SQLite, **32 KI-Teams von Anfang an**, Liga-Draft der Pick-Engine, echte
Arena-Spieltage, danach Saisonabschluss + Saisonende-Kette + nächste Saison). Je Saison werden die Kennzahlen und alle Zeilen
(Spieler, Netto, Training, PP, Einsätze, Fokus, Decken) ausgegeben. Optionen: `--saisons N`, `--nur-abschluss` mit
`--start-json` und `--regel neu|alt` (Saisonende auf einem gespeicherten Stand mit anderem Stempel wiederholen, dafür
`--stop-vor-abschluss`), `--erst-naechste-saison`. Ablauf der Eichung: Rohsummen mit Identitätskurve messen, die Kurve offline an die
Zielanteile anpassen, einen vollen Lauf zur Kontrolle.

TABELLE_1

TABELLE_2

TABELLE_3

TABELLE_4

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

## 7. Offen

- Die Zahlen sind an einer Liga (KI-Teams, Pick-Engine-Draft) geeicht; ein Spielstand mit menschlichen Teams (Bank, anderes Training)
  verschiebt Leistungsrang und Fokus. Die Anteile stark/kaum sind weich (±2 Punkte je Saison durch Stichprobe von ~300 Spielern),
  das Liga-Mittel ist durch den Abbau nachziehbar (`abbauBasis`).
- „PP aus On-top-Effekten zählen nicht doppelt“ (Konzept 22.11., Abschnitt 21): der Leistungsrang nimmt die PP aus dem Punktebuch
  und trennt Ausrüstung/Form noch nicht heraus; erst sinnvoll, wenn die Ausrüstung gebaut ist.
- Prognosen mitten in der Saison (Trainingshistorie, Profil) wenden die Kurve auf die bisherige Teilsumme an; sie zeigen, was ein
  sofortiges Saisonende ergäbe, nicht die Hochrechnung.
- Auslöser für die Potentialdrift (Spielzeit, Verletzung, ungenutztes Attribut): bewusst nicht gebaut (s. o.).
- Kein Alterungsmodell (bleibt: Laufbahnen enden über sinkendes Potential und den Abschied, nicht über Jahre).
