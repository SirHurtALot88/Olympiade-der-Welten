# Fixture: eine durchgespielte Saison 1

Diese vier Dateien sind **eine** gelaufene Saison. Sie bedienen zwei Suiten, die vorher auf jeder
Maschine ausser einer stumm übersprungen wurden:

| Datei | wer sie liest |
|---|---|
| `season1-simulation-summary.json` | `tests/season-points-prize-regression.test.ts` |
| `season1-matchday-results.csv` | dieselbe |
| `season1-standings-final-points-parity.csv` | dieselbe |
| `arena-season1-save.json.gz` | `tests/discipline-stage-arena-canonical-ovr.test.ts` |

## Wie sie entstanden ist

```sh
npx tsx scripts/season1-autoprep-topup.ts --write
npx tsx scripts/season1-autoprep.ts --write
npx tsx scripts/season1-simulation-run.ts --write
```

**Ohne `--write` tut jeder dieser drei Schritte nichts und meldet trotzdem Erfolg (Exit 0).** Der
Simulationslauf exportiert dann sogar eine vollständig aussehende Zusammenfassung — `matchdays: 10`,
`resolvedTeams: 32` je Spieltag — während alle 320 Aufstellungen auf `status: "draft"` stehen
bleiben, kein Spieltag gewertet wird und jedes Team bei 0 Punkten landet. Genau daran wäre ein
Fixture entstanden, das eine Saison behauptet, die nie gespielt wurde.

## Was drin steht

- `season_completed`, Meister **R-L (Raging Lunatics)** mit 168,5 Punkten
- 10 gewertete Spieltage, 640 Disziplin-Ergebnisse, 2.549 Spieler-Leistungen, 398 Kaderzeilen
- Endstand ohne Gleichstände (Ränge 1–32 je genau einmal)
- 5 der 20 Wertungsgruppen haben einen Gleichstand — siehe unten, das ist kein Mangel, sondern der
  Grund für eine Korrektur an der Prüfung

## Warum der Spielstand gekürzt ist

`arena-season1-save.json.gz` trägt nur die **Kaderspieler** (398 statt 2.984) und **keinen**
`persistedSeasonDerivations`-Block. Letzterer ist ein Cache von 5,9 MB, den die Suite ohnehin frisch
rechnet. Damit bleiben 1,55 MB gepackt statt 2,8 MB.

## Neu erzeugen

Die Kette oben laufen lassen, dann die vier Dateien ersetzen. Zwei Werte sind an **diese** Ausleitung
gebunden und ziehen mit: der Meister (`R-L`) im Preisgeld-Test und die Spalte `playerCount` in
`season1-matchday-results.csv` (sie wird aus dem `disciplineSchedule` des simulierten Spielstands
ergänzt, siehe `resolveParticipantCount` in `lib/season/season-points-prize-regression.ts`).
