# Performance-Anteil im Trainings-Forecast steht auf +0 — Befund

**Gemeldet von Chris** (Seite „Team · Training", zwei Meldungen):

> „performance ist hier gar nicht mehr mit drin, bitte wieder ergänzen!"

> „wenn ich die klasse wechsel geht performance auf 0, obwohl die ja immer bleibt und sich auf die
> stats der diszi verteilt wo die punkte angefallen sind, bitte prüfe und fixe das"

Auf seinem Screenshot: „+ Performance-Anteil **+0**", daneben im selben Tooltip „Zum Vergleich:
Saison-PPs 1,2 · MVS 4". Ein Spieler mit Einsätzen und Punkten, dessen Spielpraxis im Forecast mit
null zu Buche schlägt.

**Status: Ursache belegt, Fix bewusst nicht gebaut.** Der naheliegende Fix macht es schlimmer
(Abschnitt „Was der billige Fix kaputt macht"). Der tragfähige Weg steht unten.

---

## Chris hat in beidem recht

Die Performance-Verteilung **ist** klassenunabhängig. `buildPerformanceDeltas`
(`lib/training/organic-season-progression.ts:718`) verteilt das Performance-Budget über
`getDisciplineWeightDistribution(record.disciplineId)` — also genau auf die Stats der Disziplin, in
der die Punkte angefallen sind. Die Klasse kommt darin nicht vor.

Nachgemessen am gemeldeten Spielstand (`new-game-1785823388048-1hf25q`, Saison 1, MD7), Forecast
einmal je Trainingsklasse gerechnet:

| Spieler | Performance-Anteil über alle 13 Klassen |
|---|---|
| Gronn | 7,31 — dreizehnmal identisch |
| Amystheta | 5,56 — dreizehnmal identisch |
| Crowthar | 5,47 — dreizehnmal identisch |

Der Motor tut also genau das, was Chris beschreibt. Der Wert war nur nicht **da**.

## Die Ursache

Der Trainings-Forecast läuft im **Browser** — `useTrainingPanelDerivations`
(`lib/foundation/tabs/use-training-panel-derivations.ts:87`) ruft `buildOrganicSeasonProgression` in
einem `useMemo` auf dem Client-GameState auf.

Der Client hält den kompakten Payload (`compactFoundationInitialGameState`), und der beschneidet
`seasonState.matchdayResults` auf den **aktiven** Spieltag
(`lib/persistence/foundation-initial-compact-state.ts:131`).

`getPerformanceIndex` (`lib/training/organic-season-progression.ts:627-645`) akzeptiert eine
Performance-Zeile aber nur, wenn ihr `matchdayResultId` in genau dieser Liste steht. In der
Planungsphase hat der aktive Spieltag noch kein Ergebnis — die Liste ist leer, und **jede** der
1.573 mitgelieferten Performance-Zeilen fällt durch das Sieb.

Gemessen, derselbe Spielstand, dieselben drei Spieler:

| Datenstand | matchdayResults | Performance-Anteil |
|---|---|---|
| voller Save (Server) | 6 | 7,31 · 5,56 · 5,47 |
| kompakter Payload (Browser) | 0 | **0,00 · 0,00 · 0,00** |

Warum es Chris beim Klassenwechsel auffiel: die Zeile wird dabei neu gerechnet, und der Sprung auf
null ist in dem Moment sichtbar. Der Wert ist in dieser Ansicht aber durchgehend 0, nicht erst
danach.

Dieselbe Falle wie beim VK-Wert (#397): 1.573 Performance-Zeilen mitschicken und sie mangels einer
2,7 kB großen Id-Liste allesamt wegwerfen.

## Was der billige Fix kaputt macht

Naheliegend wäre, dem kompakten Payload die `matchdayResults` der Saison zurückzugeben — reine
Metadaten, 2,7 kB bei 9,7 MB Gesamt-Payload. Gebaut, gemessen, **wieder verworfen**:

- Der Performance-Anteil kommt damit zurück (7,60 / 6,13 / 6,14 statt 0,00 — nah am Server, nicht
  identisch, weil dem Client weitere Ableitungen fehlen).
- Aber der **clientseitige Saison-Ledger** fängt damit an, Disziplin-PPs auszurechnen, für die ihm
  die Grundlage fehlt: die schweren `disciplineResults` bleiben beschnitten. Im Testfall liefert er
  dann **33,3 PPs, wo der volle Save 4,9 sagt** — er nimmt den Rohbeitrag statt der gewerteten
  Punkte.
- Dieser Ledger ist in zwei Ansichten weiterhin die Rückfallebene, wenn der Directory-Slice fehlt
  oder noch lädt (`use-foundation-cross-tab-player-directory.ts:375`,
  `use-foundation-cross-tab-teams-roster.ts`). Heute steht dort in dem Fall „—". Danach stünde dort
  eine plausible falsche Zahl.

Ein sichtbar leeres Feld ist reparierbar, eine falsche Zahl wird geglaubt. Deshalb nicht gebaut.

## Der tragfähige Weg

Derselbe wie beim VK-Wert und bei den Disziplin-PPs: **serverseitig rechnen, Ergebnis mitschicken.**

Der Zuschnitt ist hier sogar besonders günstig, weil die Messung oben zeigt, dass
`performance.deltas` klassenunabhängig ist:

1. Server rechnet `buildPerformanceDeltas` je Spieler des **eigenen** Kaders (~12 Spieler, 12 Zahlen
   pro Spieler) auf dem vollständigen Save.
2. Diese Deltas gehen als Feld in den Trainings-Payload.
3. `buildOrganicSeasonProgression` nimmt sie als Eingabe, statt sie aus dem (beschnittenen)
   GameState zu rekonstruieren — analog zu den bestehenden Overrides
   `accumulatedBaseTrainingBudget` und `performanceWeightMultiplier`, die genau aus diesem Grund
   schon existieren.
4. Die klassenabhängigen Multiplikatoren bleiben im Client — der Klassenwechsel bleibt sofort
   sichtbar, ohne Server-Runde.

Punkt 3 ist der Grund, warum das sauber geht: die Funktion nimmt bereits Overrides für genau solche
Fälle entgegen. Es kommt einer dazu, es wird nichts umgebaut.

**Was dagegen spricht.** Es ist mehr als eine Zeile: Payload-Feld, Server-Aufruf, Override-Parameter
und ein Test, der ohne den Fix rot ist. Und der Forecast bleibt eine Prognose — die Zahl im Browser
wird dem Saisonende-Apply nur dann exakt entsprechen, wenn auch die übrigen Eingaben (Potenzialsatz,
Sterne) aus derselben Quelle kommen. Beides ist Arbeit, aber keine Unsicherheit.

## Belege

- Klassenunabhängigkeit: Forecast je Klasse für drei Spieler, oben tabelliert.
- Voll vs. kompakt: `buildOrganicSeasonProgression` auf beiden Ständen, oben tabelliert.
- Falscher Ledger nach dem billigen Fix: `tests/foundation-players-discipline-pps-source.test.ts`
  meldet beim Gegenprobe-Lauf `mini-dm: 33,3` statt der erwarteten 4,9.
