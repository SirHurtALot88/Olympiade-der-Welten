# Die alten Team-Power-Daten verlassen die Spielstände

**Angeordnet** 23.08.2026 von Chris: *„die alten teamPowers können raus."*

Anschluss an #652, wo gemessen und festgehalten wurde, dass die Mechanik nicht mehr in die Wertung
fließt — die **Daten** lagen aber weiter in den Spielständen.

**Status: gebaut.**

## Ausgangslage, gemessen

`scripts/messe-team-power-im-scoring.ts` am Live-Abbild vom 23.08.:

```
7 Spielstaende · 2131 gespeicherte teamPowers · 13 von 1342 Entwuerfen tragen eine teamPowerId
```

Wirkungslos, aber vorhanden — und nicht bloß Ballast. In `LegacyLineupLabClient.tsx:3901` steht
eine Klammer, die es **genau deswegen** gibt: ohne sie meldete das Speichern „1 Power" für etwas,
das nirgends wählbar ist und nicht wirkt. Solche Klammern braucht es an jeder Stelle, die die Daten
anfasst, solange sie da sind.

## Der eigentliche Fund: der Generator, nicht das Löschen

**Ein Ladeweg-Nachzug allein wäre eine Tretmühle gewesen.**
`ensureLocalTeamPowersForSeason` (`lib/lineups/team-powers.ts`) lief bis heute **unabhängig vom
Schalter** und steht auf drei heißen Pfaden:

| Pfad | Stelle |
|---|---|
| Aufstellung laden | `legacy-lineup-local-service.ts:384` |
| KI-Stapellauf | `ai-legacy-lineup-batch-apply-service.ts:1798` |
| Spieltagsabschluss | `matchday-mvp-scoring-service.ts:435` |

Der Kommentar im Quelltext sagte es selbst: *„Das Power-System ist ausserdem derzeit ganz
abgeschaltet (`TEAM_POWERS_ENABLED`), der Generator laeuft davon unabhaengig weiter."*

Geräumt hätte also jeder Ladevorgang, und jeder Aufstellungsklick hätte es rückgängig gemacht —
und weil die Aufrufer aus einer neuen Referenz auf „geändert" schließen, jedes Mal mit einem
**vollen Schreibvorgang** (am Live-Save rund 1,2 s).

## Was gebaut ist

1. **`raeumeAbgeschalteteTeamPowers`** entfernt `seasonState.teamPowers` (über **alle** Saisons,
   nicht nur die laufende — der Bestand war über mehrere gewachsen) und nimmt den Entwürfen ihre
   `teamPowerId`. Formkarten, Intensität und Kapitän bleiben unangetastet: hier wird geräumt, nicht
   aufgeräumt.
2. **Der Generator respektiert den Schalter.** Steht er aus, räumt
   `ensureLocalTeamPowersForSeason` statt nachzuerzeugen.
3. **Persistenz an beiden Enden** — Ladeweg und Schreibweg, wie beim Trainingsmodus.

**Gibt dieselbe Referenz zurück, wenn nichts zu räumen ist.** Das ist keine Kosmetik, sondern der
Grund, warum die Räumung auf den heißen Pfaden nichts kostet.

### Der Preis, und er gehört genannt

Legt jemand den Schalter je zurück, baut der Generator die Powers neu auf — die früher getroffene
**Auswahl** (`selectedForSeason`) ist dann weg. Der Kill-Pfad-Kommentar sagte bis heute „es gibt
nichts zu migrieren"; das gilt ab jetzt nicht mehr, und es steht dort jetzt anders.

## Gemessen nach dem Umbau

`scripts/messe-team-power-raeumung.ts`, gegen die Basis mit `git stash` verglichen:

| | vorher | nachher |
|---|---|---|
| gespeicherte `teamPowers` | 2131 | **0** |
| Entwürfe mit `teamPowerId` | 13 | **0** |
| Entwürfe insgesamt | 1342 | 1342 |
| zweiter Lauf gibt dieselbe Referenz | — | **7 von 7** |

## Geprüft

`tests/alte-team-powers-werden-geraeumt.test.ts`, 9 Fälle.

**Gegenproben, einzeln gefahren:**

- Schalter im Test eingeschaltet → der Generator erzeugt sehr wohl wieder. Ohne diesen Fall wären
  alle Nullen bedeutungslos.
- Ladeweg neutralisiert → Fall bleibt grün. **Schreibweg neutralisiert → Fall fällt.** Der
  Persistenz-Fall belegt also den SCHREIBWEG (der Sitzungs-Cache hält den Rückgabewert von
  `saveGameState`), nicht den Ladeweg. Das steht so im Test, statt beides zu behaupten. Der Ladeweg
  ist am Live-Abbild belegt, auf einer frischen Kopie, die dieser Prozess nie geschrieben hat.

Das erste Fixture ließ `shortCode` und `teamIdentities` weg; die Gegenprobe fiel dann mit einem
`TypeError` statt mit einer Aussage — ein Generator, der wirft, belegt nicht, dass der Schalter ihn
hält. Ergänzt und im Test begründet.

**Bestehende Suiten:** alle sieben Team-Power-Suiten grün (39 Fälle), `ai-legacy-lineup-batch-apply`
und `trainingsmodus-heilt-beim-laden` grün (25).

`tsc` leer · `ci:import-exists` (2343) · `ci:client-bundle-lint` · `ci:flow-smoke` (205) ·
Quelltext-Wächter (1998, 139 Dateien) · Render-Wächter (217) · Persistenz-Suiten (1384) ·
`ci:quittungen` ok · `NODE_ENV=production npx tsx server.ts` meldet „Oly Room laeuft".

changelog: 2026-08-23-alte-team-powers-raeumen.json
