# Performance-Anteil im Trainings-Forecast steht auf +0 — Befund

**Gemeldet von Chris** (Seite „Team · Training", zwei Meldungen):

> „performance ist hier gar nicht mehr mit drin, bitte wieder ergänzen!"

> „wenn ich die klasse wechsel geht performance auf 0, obwohl die ja immer bleibt und sich auf die
> stats der diszi verteilt wo die punkte angefallen sind, bitte prüfe und fixe das"

Auf seinem Screenshot: „+ Performance-Anteil **+0**", daneben im selben Tooltip „Zum Vergleich:
Saison-PPs 1,2 · MVS 4". Ein Spieler mit Einsätzen und Punkten, dessen Spielpraxis im Forecast mit
null zu Buche schlägt.

**Status: ERLEDIGT (11.08.).** Nicht auf dem unten vorgeschlagenen Weg — der Anteil kam über den
Saisonziel-Fix (#496) zurück, der die Spieltags-Verzeichniszeilen vollständig zum Browser
mitschickt. Das ist genau der „billige Fix", den dieser Befund verworfen hatte; sein Schaden am
Saison-Ledger ist inzwischen getrennt repariert. Details unten unter „Auflösung". Der serverseitige
Deltas-Weg wurde daraufhin **nicht** gebaut — er wäre unnötige Arbeit geworden.

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

---

## Auflösung (11.08.)

Der Befund empfahl, `buildPerformanceDeltas` serverseitig zu rechnen und die Deltas mitzuschicken.
Vor dem Bauen wurde nachgemessen — und der Anteil war schon zurück.

`getPerformanceIndex` (`organic-season-progression.ts:627`) siebt die Leistungszeilen über die
Spieltags-Ids aus `seasonState.matchdayResults`. Genau diese Liste fährt seit dem Saisonziel-Fix
(#496) vollständig mit, weil die Vorstandsziele sonst nur den aktiven Spieltag zählten. Damit füllt
sich derselbe Index, der hier leer war.

Gemessen am Live-Abbild (`new-game-1785823388048-1hf25q`, Saison 2, 10 gewertete Spieltage), fünf
Spieler des eigenen Kaders, `buildOrganicSeasonProgression` auf beiden Ständen:

| Spieler | voller Save | kompakter Payload |
|---|---|---|
| Malarik | 3,26 | **3,26** |
| Vega | 2,92 | **2,92** |
| Highpriestess Caladriel | 4,60 | **4,60** |
| Dralak | 4,09 | **4,09** |
| Spineshard | 4,33 | **4,33** |

Nicht „nah dran" — identisch. Der Grund ist derselbe, den dieser Befund oben schon belegt hat: die
Performance-Verteilung ist klassenunabhängig und braucht nur die Leistungszeilen, und die fuhren
immer schon mit. Es fehlte allein die Id-Liste, an der sie hängen.

### Der vorhergesagte Schaden trat ein — und ist repariert

Dieser Befund hatte den billigen Fix mit einer konkreten Messung verworfen: der clientseitige
Saison-Ledger fange dann an, Disziplin-PPs ohne Grundlage zu rechnen — **33,3 statt 4,9**, weil ihm
die beschnittenen `disciplineResults` fehlen und er auf den Rohbeitrag zurückfällt. Genau das ist
mit #496 eingetreten und war kurzzeitig live.

Repariert über eine Grenze im Ledger selbst: ein Spieltag, zu dem **kein einziges**
Disziplin-Ergebnis vorliegt, wird nicht gebucht. Das ist keine Notlösung für den kompakten Payload,
sondern die ehrliche Regel — ohne Disziplin-Ergebnisse ist ein Spieltag nicht gewertet. Auf dem
vollen Save ändert sie nachweislich nichts (335 Spieler, Punktsumme 3126,30, mit und ohne Änderung
identisch). Der Test `tests/foundation-players-discipline-pps-source.test.ts` hält beide Seiten fest.

### Was offen bleibt

Der Forecast bleibt eine Prognose. Dass die Browser-Zahl dem Saisonende-Apply exakt entspricht, ist
damit **nicht** gezeigt — dafür müssten auch Potenzialsatz und Sterne nachweislich aus derselben
Quelle kommen. Ungemessen.
