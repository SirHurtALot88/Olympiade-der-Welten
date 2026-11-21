# Belastung und Resistenz v2: Härtetest und Einsatzliste mit Lastvorschau (Fable, 21.11.)

Mockup: `belastung-resistenz-v2-21-11.html` (für `public/mockups/`; Pfade `../portraits`, `../class-icons`, `../race-icons`, `../fonts`).
Bilder: `v2-01-einsatzliste-1920.png`, `v2-02-kandidat-auf-hartem-platz-1920.png`, `v2-03-zu-schwach-1920.png`, `v2-04-gesetzt-1920.png`,
`v2-05-pause-1920.png`, `v2-06-haertetest-1920.png`, `v2-07-heute-1920.png`, `v2-08-basketball-1920.png`.
Rechenskripte: `_build/prep.ts` (liest den Spielstand), `_build/sim.mjs`, `_build/run.mjs`, `_build/run2.mjs`; Daten `_build/save.json`.
Nichts im Repo ist angefasst. **Mechanik-Vorschlag, wertungsrelevant.**

## Chris' Vorgaben, so umgesetzt

- Resistenz = Wert des Spielers im Belastungs-Attribut des Platzes.
- Resistenz wirkt **nur auf die Erschöpfung**. Das Risiko kommt unverändert aus der Kurve (0 % bis 25, 3 % bei 50, 25 % bei 80, 33 % bei 100).
  Die Risikofaktoren aus v1 sind gestrichen.
- Pause nach Spieltag 10 = ein spielfreier Spieltag für jeden, mit der heutigen Bank-Regel aus `calculatePlayerRecovery`:
  **(28 + Reha-Zentrum-Bonus) × Trainingsmodus** (leicht ×1,2 = 33,6; mittel 28; hart ×0,75 = 21). Reha-Bonus je Stufe 4 / 8 / 13 / 18 / 24.
  Verletzte bekommen dasselbe (`INJURY_RECOVERY_FACTOR` 1,0). Die Trainingsschicht bleibt stehen.

## Härtetest

**Daten:** Spielstand `new-game-1795114260527-nzr0z9` vom Abbild `live-save` (Spieltag 12, 32 Teams, 376 Spieler, kein Team hat ein Reha-Zentrum).
**Modell:** Last, aktive Erholung 4,5, Bank-Erholung, Trainingsschicht, Trainingsmodus je Spieltag aus der Historie, ein Spieltag Sperre, Risikokurve.
**Prüfung des Modells:** Auf den 352 echten Einsatzlisten (Spieltag 1 bis 11) trifft es die im Spielstand gespeicherte Wurf-Erschöpfung
von 2766 Würfen im Mittel auf 0,33 Punkte; erwartet 87,5 Verletzungen, gespielt wurden 92.

### A. Echte Einsatzlisten, Spieltag 1 bis 11 (Aufstellungen unverändert)

| Rechnung | Ø Last | erwartete Verletzungen | Last niedrig / mittel / hoch | Last schwach / mittel / stark |
|---|---:|---:|---|---|
| heute | 16,8 | 87,5 | 16,9 / 17,0 / 16,6 | 16,1 / 16,1 / 16,0 |
| mild (45/60/75, +4) | 16,9 | 92,3 | 13,5 / 17,1 / 20,3 | 19,0 / 15,5 / 13,0 |
| hart, v1 (45/60/75, +6) | 16,4 | 81,5 | 11,9 / 16,6 / 20,8 | 20,0 / 14,7 / 10,8 |
| 40/55/70, +4 | 15,9 | 64,4 | 12,2 / 16,0 / 19,4 | 18,6 / 14,4 / 11,1 |
| mild, dieselben Spieler nach Last verteilt | 15,6 | 56,4 | | |
| hart, dieselben Spieler nach Last verteilt | 14,3 | 35,4 | | |

Schwach / stark = Resistenz mehr als 10 unter bzw. über der Schwelle (1190 / 848 von 2766 Einsätzen; Last auf Einsatz „Normal“ normiert).

### B. Ganze Saison, 20 Spieltage, alle 32 Teams

Die KI wählt nach Disziplinwert und Frische und besetzt die Plätze nach Platzwert (Slot-Profil), ohne die Resistenz zu kennen. Einsatz „Normal“.
10 bis 24 Saisons je Zeile. Korridor laut `tests/injury-basisfall-korridor.test.ts`: 150 bis 200, Untergrenze 140.

| Variante | aktive Erholung | Ø Last | Verletzungen / Saison | je Team | Einsätze über 25 | Ø Erschöpfung Saison / nach ST 10 / ST 20 |
|---|---:|---:|---:|---:|---:|---|
| heute, ohne Pause | 4,5 | 16,1 | **191** (174–208) | 6,0 | 66 % | 29,6 / 33,8 / 45,4 |
| heute + Pause | 4,5 | 16,1 | **137** | 4,3 | 61 % | 25,6 / 12,2 / 43,6 |
| heute + Pause | 4,0 | 16,1 | 155 | 4,8 | 67 % | 26,7 / 12,9 / 45,5 |
| heute + Pause | 3,5 | 16,1 | 177 | 5,5 | 69 % | 27,7 / 13,9 / 46,9 |
| mild, ohne Pause | 4,5 | 16,6 | 216 | 6,8 | 71 % | 30,9 / 35,3 / 47,1 |
| mild + Pause | 4,5 | 16,6 | 154 | 4,8 | 66 % | 26,5 / 13,1 / 45,0 |
| **mild + Pause (Empfehlung)** | **4,0** | 16,6 | **168** (145–178) | 5,2 | 68 % | 27,6 / 13,9 / 46,8 |
| hart (v1) + Pause | 4,0 | 16,3 | 159 | 5,0 | 66 % | 26,9 / 13,4 / 46,1 |
| 40/55/70, +4 + Pause | 4,0 | 15,7 | 138 | 4,3 | 64 % | 25,8 / 12,7 / 43,9 |
| 45/60/75, +8 + Pause | 4,0 | 16,9 | 178 | 5,6 | 68 % | 28,0 / 14,5 / 47,8 |

### C. Lohnt es, resistente Spieler auf harte Plätze zu setzen?

Ein Team (Death Peaches) verteilt dieselben Spieler nach Last statt nach Platzwert, alle anderen bleiben bei der KI. Pause, aktive Erholung 4,0.

| Variante | Last je Einsatz | Summe Last / Saison | Ø Erschöpfung beim Einsatz | erwartete Verletzungen des Teams | Platzwert |
|---|---|---|---|---|---|
| mild | 16,6 → 15,1 | 2543 → 2342 (−8 %) | 51,7 → 42,4 | 13,8 → 7,6 (−45 %) | 55,9 → 54,1 |
| hart (v1) | 16,6 → 14,1 | 2533 → 2187 (−14 %) | 50,3 → 39,6 | 12,9 → 6,2 (−52 %) | 56,0 → 54,2 |
| 40/55/70, +4 | 15,8 → 13,8 | 2432 → 2136 (−12 %) | 46,9 → 39,3 | 10,7 → 6,0 (−44 %) | 56,2 → 54,4 |
| 45/60/75, +8 | 17,1 → 14,3 | 2598 → 2216 (−15 %) | 52,3 → 41,1 | 14,4 → 6,8 (−53 %) | 56,1 → 54,2 |

Würden **alle 32 Teams** rein nach Last besetzen: mild 114, hart 86, 40/55/70 rund 83, +8 rund 92 Verletzungen je Saison (alle unter dem Korridor).

## Empfehlung: „mild“ plus Pause, aktive Erholung 4,0

| Stufe | Schwelle | Grundlast | darunter | darüber |
|---|---:|---:|---|---|
| niedrig | 45 | 12,5 | +0,15 je Punkt, höchstens +4 | −0,05 je Punkt, höchstens −2 |
| mittel | 60 | 15,0 | ebenso | ebenso |
| hoch | 75 | 17,5 | ebenso | ebenso |

- **Macht es Sinn?** Ja. Die Vorschau zeigt je Platz 10,5 bis 21,5 statt immer 16; schwach gegen stark sind im Schnitt 19,0 gegen 12,8.
  Wer passend setzt, halbiert seine Verletzungen fast und bezahlt mit rund 2 Punkten Platzwert je Spieler. Das ist eine echte Abwägung.
- **Schwellen 45/60/75 passen.** Mit 40/55/70 wird die ganze Liga leichter (138, unter dem Korridor).
- **Deckel +6 (v1) und +8 sind für die Liga verträglich, aber der Hebel für den Menschen wird zu groß** (−52 % bzw. −53 % Verletzungen, Liga 86 bis 92,
  falls alle so spielen). „mild“ hält denselben sichtbaren Effekt bei kleinerem Hebel.
- **Die Pause ist der größere Eingriff als die Resistenz:** sie allein nimmt 54 Verletzungen (191 → 137) und unterschreitet die Untergrenze 140.
  Ausgleich über `OLY_FATIGUE_ACTIVE_RECOVERY_VALUE` 4,5 → 4,0. Ohne diesen Schritt liegt „mild + Pause“ bei 154, am unteren Rand.

**Grenzen der Messung:** Die KI im Test ist eine Nachbildung, nicht `ai-legacy-lineup-engine.ts`. Der Einsatz ist überall „Normal“. Die Trainingsmodi
ab Spieltag 12 sind die von heute. Das Basisfall-Werkzeug des Repos (`scripts/messe-erholungskorridor.ts`, synthetische Kader ohne Attribute) kann die
Resistenz nicht abbilden; vor dem Einschalten muss es Attribute bekommen und mit zwei Saatstämmen neu laufen.

## Mockup v2: was zu sehen ist

Echter Kader der Death Peaches am Spieltag 12 (Mini DM 5 Plätze, Basketball 3), echte Erschöpfung, Trainingsmodi, Sperre. Erfunden ist nur die Startaufstellung.

- **Platz-Karte:** Stufe und Schwelle, Belastungs-Attribut des Spielers mit „fehlen 11“ oder „+5“, Last groß und farbig, Erschöpfung vorher → nachher, Risiko.
- **Kader:** Spalten „Resistenz“ (das Attribut des gewählten Platzes) und „Last hier“, sortierbar; daneben Erschöpfung → danach für die aktuelle Besetzung.
- **Vorschau beim Überfahren:** Leiste über dem Feld „Zyra auf Iron Guard · Last hier 19,1 → 17,3 · Last gesamt −1,6 · erwartete Verletzungen“,
  dazu die Zeile in der Platz-Karte und der gestrichelte Marker auf der Skala rechts. Bei Queen Loriana (Torment 7): 19,1 → 21,5, rot, „Deckel“.
- **Klick setzt** und tauscht mit dem bisherigen Platz des Spielers; alle Summen rechnen mit.
- **Kopfzeile:** Last beider Disziplinen gegen die alte Rechnung, „durch Tauschen noch drin“, Team-Erschöpfung danach, Spieler über 25.
  Knopf „Plätze nach Last tauschen“.
- **Reiter Pause:** individuelle Erholung je Spieler (33,6 / 28 / 21, gesperrte Zynara, Beispielzeile Reha-Zentrum Stufe 2).
- **Reiter Härtetest:** die Kernzahlen. Oben schaltet „Heute / mild / hart“ die Rechnung um.
- Designregeln vom 21.11.: Klassen farbig (Chip mit Klassen-Icon, Portraitrahmen), Rassen-Icon, Attribute nur als Zahl ohne Notenstufe, Tabellen sortierbar.

## Was im Code berührt würde

1. `getPlayerMatchdayFatigueLoad` / `getPlayerMatchdayFatigueDelta` (`lib/fatigue/fatigue-injury-service.ts`) brauchen Platz (Stufe, Belastungs-Attribut) und
   den Attributwert. `collectMatchdayUses` muss den Platz je Einsatz mitliefern. Roll-Map, Apply und Replay-Rücknahme müssen dieselbe Zahl sehen.
2. `projectMatchdayInjuryRisk` und die Einsatzliste (`EinsatzlisteModern.tsx`) rechnen über dieselbe Funktion; `resolveAdditionalFatigueFromRisk` entfällt als Anzeigequelle.
3. Pause: neuer Buchungsschritt zwischen Spieltag 10 und 11 (Erholungsschleife ohne Einsätze), idempotent, mit Eintrag im Verlauf.
4. `MATCHDAY_ACTIVE_RECOVERY` 4,5 → 4,0; Korridor-Wächter (`tests/injury-korridor-20-spieltage.test.ts`, `tests/injury-basisfall-korridor.test.ts`,
   `tests/fatigue-last-drei-stufen.test.ts`, `tests/fatigue-aktive-erholung.test.ts`) neu eichen.
5. KI (`ai-legacy-lineup-engine.ts`, `ai-lineup-freshness.ts`, `fatigue-rest-propensity.ts`): Resistenz höchstens leicht gewichten, sonst fällt die Liga unter den Korridor.
6. Wertung: Erschöpfung ändert den Leistungsabzug (bis 25 %) und damit Ergebnisse und Tabellen. Der Arena-Fingerabdruck läuft mit festen Eingaben und sollte
   stehen bleiben; das ist zu prüfen. Die Eignungsmatrix bleibt unangetastet. rho- und Pp-Messungen laufen ohne Erschöpfung.
7. Alles hinter einem Schalter am Spielstand (Muster `isFatigueActiveRecoveryEnabled`), damit die laufende Saison unverändert bleibt. Unabhängiges Review (Opus).

## Offene Fragen an Chris

1. „mild“ (schwach +4, stark −2) oder doch „hart“ (+6 / −3)? Bei „hart“ ist der Vorteil für den, der gut setzt, noch größer.
2. Darf die aktive Erholung von 4,5 auf 4,0 sinken, damit die Pause den Korridor 150 bis 200 nicht unterschreitet? Sonst rund 137 bis 154 Verletzungen.
3. Soll die KI die Resistenz mitrechnen? Vorschlag: nur als kleiner Zuschlag zum Platzwert.
4. Zählt die Pause als Spieltag für eine Sperre (wer an Spieltag 10 verletzt wird, wäre an Spieltag 11 wieder da) und für die Trainingsschicht? Im Test: beides nein.
5. Gilt die neue Rechnung erst ab der nächsten Saison oder schon in der laufenden?
