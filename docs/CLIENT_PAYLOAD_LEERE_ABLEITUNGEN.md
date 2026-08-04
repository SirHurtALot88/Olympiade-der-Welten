# Der kompakte Client-Payload leert abgeleitete Zahlen — ein Muster, drei Fundstellen

Innerhalb eines Tages sind drei Meldungen von Chris auf **dieselbe** Ursache zurückgegangen. Sie
sahen völlig verschieden aus, und jede wurde zunächst als eigenes Problem untersucht. Dieses
Dokument hält das Muster fest, damit die vierte Meldung dieser Art nicht wieder bei null anfängt.

## Das Muster

Der Foundation-Client hält nicht den vollen Spielstand, sondern
`compactFoundationInitialGameState` (`lib/persistence/foundation-initial-compact-state.ts`). Der
Payload streicht bewusst:

- `seasonState.matchdayResults` → nur der **aktive** Spieltag
- `seasonState.disciplineResults` → nur der aktive Spieltag
- `seasonState.seasonSnapshots` → ganz weg
- `seasonState.persistedSeasonDerivations` → ganz weg

Das ist richtig so — die Alternative wären Megabytes. Der Fallstrick ist ein anderer: **alles, was
im Browser aus diesen Quellen abgeleitet wird, ergibt still eine 0 oder ein `null`** — keinen
Fehler, keine Warnung. Und eine 0 sieht aus wie ein Messwert.

Besonders tückisch ist der aktive Spieltag: Solange er in Planung ist, hat er noch kein Ergebnis.
`matchdayResults` ist dann **leer**, nicht etwa „einer statt sechs". Jede Filterung über diese
Liste wirft dann restlos alles weg.

## Die drei Fundstellen

| Meldung | Was der Spieler sah | Wo es abgeleitet wurde | Behoben in |
|---|---|---|---|
| „warum haben die spieler keinen +/- im verkaufswert" | VK-Wert == Marktwert in **jeder** Zeile, jedes Bracket | `hasCurrentSeasonSaleFactorRanking` prüft `matchdayResults` → kein Ranking → Faktor 1,0 | #397 — Wert kommt aus dem Server-Slice |
| „performance ist hier gar nicht mehr mit drin" | Performance-Anteil **+0** im Trainings-Forecast | `getPerformanceIndex` lässt Performance-Zeilen nur durch, wenn ihr `matchdayResultId` in `matchdayResults` steht | offen, Befund in `TRAINING_PERFORMANCE_ANTEIL_BEFUND.md` |
| „Top Disziplinen … da fehlt jeweils auch der Rank" | PP-Zahlen richtig, **Ränge fehlen** | `buildDisciplineGlobalRankMaps` rankt über den Saison-Ledger und die Snapshots — beide im Browser leer | offen, s. u. |

Gemessen, jeweils am selben Spielstand (`new-game-1785823388048-1hf25q`, Saison 1, MD7):

- VK-Wert: voller Save 328 von 339 Kaderspielern mit Verkaufsfaktor ≠ 1, kompakter Payload **0 von 339**.
- Performance-Anteil: voller Save 7,31 / 5,56 / 5,47 SP, kompakter Payload **0,00 / 0,00 / 0,00**.
- Top-Disziplinen (Spieler Gronn): voller Save 6 Zeilen mit Saison-Rang und 6 mit All-Time-Rang,
  kompakter Payload **0 und 0** — bei identischen PP-Zahlen (Mini DM 5,5 in beiden Ständen).

Der letzte Fall zeigt das Muster am schärfsten: Die **Zahl** stimmt, weil sie aus der
Spieler-Performance kommt, die im Payload steckt. Nur der **Rang** fehlt, weil er einen Vergleich
über alle Spieler braucht — und der läuft über den Ledger.

## Woran man es erkennt

Steht im Browser eine 0, ein „—" oder ein fehlender Rang, wo eine Zahl stehen müsste, dann prüfe
zuerst:

1. Wird der Wert im Browser gerechnet oder auf dem Server? (`useMemo` in einem Hook = Browser.)
2. Hängt die Rechnung an `matchdayResults`, `disciplineResults`, `seasonSnapshots` oder
   `persistedSeasonDerivations`?
3. Miss es: denselben Aufruf einmal auf dem vollen Save und einmal auf
   `compactFoundationInitialGameState(...)`. Weichen die Zahlen ab, ist es dieser Fall.

Das kostet zehn Minuten und erspart die Suche im falschen Modul — bei allen drei Meldungen war die
eigentliche Rechnung korrekt.

## Was NICHT hilft

Die gestrichenen Felder einfach zurückzugeben. Für die `matchdayResults` wurde es gebaut und
gemessen (2,7 kB, nichts):

- Der Performance-Anteil kommt damit zurück.
- Aber der clientseitige Saison-Ledger fängt an, Disziplin-PPs zu rechnen, für die ihm die
  weiterhin gestrichenen `disciplineResults` fehlen — **33,3 PPs, wo der volle Save 4,9 sagt**.
- Beim Verkaufsfaktor dasselbe Bild: mit zurückgegebenen `matchdayResults` weichen 292 von 339
  Zeilen vom Server-Wert ab, statt vorher 328 von 339 auf dem Marktwert festzustehen.

Aus einem sichtbar leeren Feld wird so eine plausible falsche Zahl. Das ist die schlechtere Hälfte
des Tauschs: ein leeres Feld wird gemeldet, eine falsche Zahl wird geglaubt.

## Was hilft

**Serverseitig rechnen, Ergebnis mitschicken** — das Muster, das im Repo schon zweimal steht:
`disciplinePointsByPlayerId` und (seit #397) `sellValueByPlayerId` im Player-Directory-Slice
(`lib/foundation/player-directory-slice.ts`). Beide existieren aus exakt diesem Grund, beide sind
im Feldkommentar begründet.

Für die noch offenen zwei Fälle:

- **Performance-Anteil**: Die Deltas sind klassenunabhängig (nachgemessen über alle 13
  Trainingsklassen). Sie lassen sich serverseitig für den eigenen Kader rechnen und als Override
  durchreichen — `buildOrganicSeasonProgression` nimmt für genau solche Fälle bereits
  `accumulatedBaseTrainingBudget` und `performanceWeightMultiplier` entgegen. Details in
  `TRAINING_PERFORMANCE_ANTEIL_BEFUND.md`.
- **Top-Disziplinen-Ränge**: Der Rang braucht die Saison-PPs **aller** Spieler je Disziplin. Genau
  das steht bereits als `disciplinePointsByPlayerId` im Directory-Slice. Zwei Wege stehen offen,
  und die Wahl ist zu belegen, nicht zu raten:
  1. Aus dem vorhandenen Slice-Feld clientseitig ranken (`buildSharedRankMap`) — kein neues
     Payload-Feld, aber zu prüfen ist, ob der Slice im Spielerprofil-Pfad überhaupt geladen ist
     (er wird heute für die Spielerliste angefordert).
  2. Die fertigen Rangkarten serverseitig mitliefern — mehr Payload, dafür unabhängig davon, welche
     Ansicht gerade offen ist.
  Für die Spalte „−1 PPs" gibt es zusätzlich gar keinen Rang im Code (`PlayerDetailDrawer.tsx`
  übergibt dort hart `null`); in Saison 1 fehlt ohnehin die Vorsaison, der Wert ist dort ehrlich leer.

## Die stille Verwandte

Derselbe Payload streicht auch `attributeSheetStats`/`attributeSheetRatings` — mit derselben Folge
(„die organische Progression fällt auf lauter Nullen zusammen"). Das war schon einmal ein Fehler und
ist im Code oben bereits als Ausnahme geregelt: der eigene Kader behält seine Blätter. Der Kommentar
dort steht seit damals; er beschreibt dieses Dokument in klein.
