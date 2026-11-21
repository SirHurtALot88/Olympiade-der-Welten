# Belastung und Resistenz in der Einsatzliste (Fable, 21.11.)

Mockup: `belastung-resistenz-21-11.html` (Doppelklick; Platz, Spieler und Einsatz sind klickbar, alle Zahlen rechnen
mit; oben schaltet „Heute ↔ Vorschlag“ die Rechnung um). Bilder: `belastung-01-vorschlag-1920.png`,
`-02-heute-1920.png`, `-03-stark-vollgas-1920.png`, `-04-vorschlag-2560.png`. Alle Stellschrauben stehen im Skript
oben im Objekt `REGEL`. Nichts im Repo ist angefasst. **Das ist ein Mechanik-Vorschlag, nicht nur Optik.**

## Befund: warum die Resistenz heute nichts bringt

- Gebucht wird in `getPlayerMatchdayFatigueLoad` (`lib/fatigue/fatigue-injury-service.ts`):
  `16 × Trait (±6 %) × Einsatz (0,75 / 1,0 / 1,4)`. Der Platz und das Attribut kommen darin nicht vor.
- Die Stufe des Platzes (`fatigueProfile` low/medium/high) und sein Belastungs-Attribut (`strainAttribute`) aus
  `lib/lineups/matchday-slot-roles.ts` fließen nur in eine Vorschaurechnung (`resolveAdditionalFatigueFromRisk`)
  und in einen Punkt Rollenabzug bei Werten bis 50. In die Buchung und in den Verletzungswurf gehen sie nicht ein.
- Das Risiko hängt allein an der Erschöpfung nach dem Einsatz (`fatigue-calibration.ts`: 0 % bis 25, 3 % bei 50,
  25 % bei 80, 33 % bei 100). Emilia mit Dexterity 73 und ein Spieler mit Dexterity 20 bekommen dieselbe Zeile.
  (Chris' Beispiel zeigte 0 → 18 statt 0 → 16; die 2 Punkte sind vermutlich der Trainingsanteil, nicht nachgemessen.)

## Vorschlag in Zahlen

Resistenz = Wert des Spielers im Belastungs-Attribut des Platzes (das, was die Einsatzliste heute schon anzeigt).

| Stufe | Schwelle | Grundlast (heute 16) | Lage der Schwelle im Bestand |
|---|---:|---:|---|
| niedrig | 45 | 11 | rund 41 % aller Attributwerte liegen darunter |
| mittel | 60 | 14 | rund 60 % |
| hoch | 75 | 17 | rund 82 % |

- **Unter der Schwelle:** +0,25 Erschöpfung je fehlendem Punkt, höchstens +6. Risiko × (1 + 0,02 je Punkt), höchstens × 1,5.
- **Über der Schwelle:** −0,10 je Punkt, höchstens −3. Risiko × (1 − 0,015 je Punkt), mindestens × 0,7.
- Einsatz (× 0,75 / 1,0 / 1,4) und Trait multiplizieren wie bisher die ganze Last.
- **Bleibt unverändert:** 0 % Risiko bis Erschöpfung 25, Deckel 33 %, Bank −28, Leistungsabzug bis 25 % bei Erschöpfung 80.

Beispielspieler, Einsatz Normal, aus dem Stand (Last je Einsatz / Erschöpfung nach 3 Einsätzen in Folge / Risiko im dritten):

| Resistenz | niedrig | mittel | hoch |
|---|---|---|---|
| schwach 40 | 12,3 / 36,8 / 1,6 % | 19,0 / 57,0 / 11,4 % | 23,0 / 69,0 / 25,4 % |
| mittel 60 | 9,5 / 28,5 / 0,3 % | 14,0 / 42,0 / 2,0 % | 20,8 / 62,3 / 15,6 % |
| stark 80 | 8,0 / 24,0 / 0,0 % | 12,0 / 36,0 / 0,9 % | 16,5 / 49,5 / 2,7 % |
| heute, alle | 16,0 / 48,0 / 2,8 % | 16,0 / 48,0 / 2,8 % | 16,0 / 48,0 / 2,8 % |

Liga-Mittel: Mit den echten Attributwerten aller 2984 Spieler und der echten Stufenverteilung der Plätze (31 niedrig,
56 mittel, 33 hoch) ergibt eine zufällige Besetzung im Schnitt 16,2 je Einsatz (heute 16,0). Wer passend aufstellt,
liegt darunter, wer blind aufstellt, darüber. Das ist eine Überschlagsrechnung, keine Saisonmessung.

## Pause nach Spieltag 10

Im Kopfband steht dauerhaft „Pause nach Spieltag 10: alle regenerieren“ mit Spieltagsleiste und Pausenmarke; im
Diagramm „Saisonverlauf“ ist die Pause als blaues Band mit dem Abfall um 28 sichtbar. Angenommen ist: jeder Spieler
bekommt einmal die Bank-Erholung (28, mit Gebäuden mehr), auch wer an Spieltag 10 gespielt hat.

## Was in der Wertung berührt würde

1. **Buchung:** `getPlayerMatchdayFatigueLoad` / `getPlayerMatchdayFatigueDelta` brauchen Platz und Attributwert.
   Roll-Map, Apply und Replay-Rücknahme lesen dieselbe Funktion; das muss so bleiben.
2. **Verletzungswurf:** `getInjuryRiskPercent` bekommt den Faktor; die Schutzzone bis 25 bleibt.
3. **Verletzungskorridor 150 bis 200 je Saison** (`tests/injury-basisfall-korridor.test.ts`,
   `scripts/messe-erholungskorridor.ts`, `tests/fatigue-last-drei-stufen.test.ts`): neu messen, Grundlasten danach
   nachziehen. Die Kurve ist oberhalb 50 steil, kleine Lastverschiebungen wirken stark.
4. **Spielergebnisse:** mehr oder weniger Erschöpfung ändert den Leistungsabzug und damit Punkte und Tabellen. Der
   Arena-Fingerabdruck (`pruefe-wertung-fingerabdruck.mjs`) läuft mit festen Eingaben und sollte gleich bleiben; das ist
   zu prüfen, nicht angenommen. rho- und Pp-Messungen laufen ohne Erschöpfung.
5. **KI:** `ai-lineup-freshness.ts`, `fatigue-rest-propensity.ts`, `ai-legacy-lineup-engine.ts` kennen die Resistenz
   nicht. Ohne Anpassung stellt die KI blind auf und verletzt sich häufiger als der Mensch.
6. **Anzeige = Buchung:** `resolveAdditionalFatigueFromRisk` und die Zeile „Belastung“ in `EinsatzlisteModern.tsx`
   werden durch dieselbe Rechnung ersetzt.
7. **Eignungsmatrix:** bleibt unangetastet. Die Resistenz ist ein zweiter Kanal neben der Eignung; ein Attribut wie
   Stamina wird dadurch auf Stamina-Plätzen indirekt wertvoller. Das sollte Chris bewusst entscheiden.
8. **Pause:** neuer Buchungsschritt zwischen Spieltag 10 und 11; verschiebt den Korridor ebenfalls.

Wegen Punkt 1 bis 5 gehört der Bau unter ein unabhängiges Review (Opus), mit Schalter und Messung vor dem Einschalten.

## Bauaufwand (grob)

- Mechanik hinter Schalter, Tests, Korridormessung mit zwei Saatstämmen: 2 bis 3 Tage.
- KI-Aufstellung berücksichtigt Resistenz: 1 bis 2 Tage.
- Einsatzliste (Rollenkarte mit Skala und Rechenweg, Spalten Resistenz/Last/Risiko, Pausenband): 1 bis 1,5 Tage.
- Pause als Buchungsschritt: 0,5 bis 1 Tag. Zusammen rund 5 bis 7 Tage. 0 PixelLab-Generationen.

## Offene Fragen an Chris

1. **Welcher Wert ist die Resistenz?** Vorschlag: das Belastungs-Attribut des Platzes (je Platz ein anderes, viele Wege
   zum Erfolg). Alternative: immer Stamina, oder eine Mischung aus beidem.
2. **Härte:** Passen 45 / 60 / 75 und der Deckel +6? Ein schwacher Spieler auf einem hohen Platz landet nach drei
   Einsätzen in Folge bei 25 % Risiko.
3. **Soll Resistenz auch das Risiko senken** (Faktor 0,7 bis 1,5) oder nur die Erschöpfung?
4. **Pause:** volle Bank-Erholung 28 für alle, mit Gebäudebonus? Und gilt sie auch in einer Saison mit 10 Spieltagen
   (dann am Saisonende wirkungslos)?
5. Soll die KI die Resistenz von Anfang an mitrechnen, oder erst der Mensch testen?

## Antworten Chris (21.11.)

- Resistenz = Belastungs-Attribut des Platzes: korrekt.
- Resistenz wirkt **nur auf die Erschöpfung**, nicht auf das Verletzungsrisiko.
- Härte 45/60/75 / Deckel +6: erst mit einem Härtetest über eine Saison belegen.
- Pause nach Spieltag 10: jeder Spieler regeneriert **einen Spieltag**, individuell (Verletzung, Gebäudestand …), nicht pauschal −28.
- Kernwunsch: Die Last in der Einsatzlisten-Vorschau soll sich ändern, wenn man einen Spieler mit hoher Resistenz auf den Platz setzt → Vorschlag v2 als Mockup.
