# Nachgeprüft: zeigt der Marktwert-Hover (Punkt 6) wirklich etwas?

**Gefragt** 24.08.2026 von Chris: *„kannst du 6 nochmal prüfen ob der hover wirklich angezeigt
wird."*

**Antwort: ja — und die Frage hat eine echte Lücke aufgedeckt.**

## Was die bisherige Abdeckung NICHT beantwortet hat

`tests/marktwert-hover-kommt-vom-server.test.ts` liest **Quelltext**: es belegt, dass die
Zuweisungen dastehen. Genau so eine Kette war bei den Saisonstand-Hovers schon einmal vollständig
„richtig" und im Spiel trotzdem leer (`hoverKader` hing am nirgends gerenderten Modell) — `tsc`
zufrieden, jede Ableitung einzeln geprüft, und aufgefallen wäre es niemandem.

**Nachgezählt: kein einziger Test hat `FoundationPlayersTableNewLook` je gerendert.** Zehn Suiten
erwähnen die Komponente, alle zehn lesen nur den Quelltext.

## Die Kette, von hinten geprüft

| Glied | Befund |
|---|---|
| API-Route `player-directory-slice` | reicht den ganzen Payload durch, das Feld fällt nicht raus |
| Shell → Zeilenbauer | das komplette Hook-Objekt wird übergeben, nicht handverlesene Felder |
| Zeile → Zelle | belegt durch den Quelltext-Wächter |
| **Zelle → Markup** | **war ungeprüft — jetzt gerendert** |

## Am Live-Abbild gemessen

`scripts/pruefe-marktwert-hover-am-abbild.ts` fährt genau den Weg der Seite: Slice bauen,
Fog-of-War-Maskierung wie in der Route, dann zählen, für wie viele der **angezeigten** Zeilen eine
Zerlegung übrig bleibt.

```
DEBUG_FORCE_PLAYER_VISIBILITY = true

swnjlk (V-W)  Zerlegungen 328 · nach Fog 328 · Zeilen „Aktive" 328, mit Hover 328 (100 %)
              eigener Kader 11, mit Hover 11 · Rechnung geht auf: 11/11
```

Über alle sieben Spielstände: **100 % der Zeilen tragen eine Zerlegung**, und die gezeigten Zahlen
ergeben in jedem geprüften Fall exakt die Summe darunter.

### Ein Vorbehalt, den man kennen muss

Die 100 % sind **nicht** das Verdienst der Maskierungsregel: `DEBUG_FORCE_PLAYER_VISIBILITY` steht
auf `true` (der Fog of War ist absichtlich abgeschaltet, „damit in Ruhe Stats und Spieler geprüft
werden können"). Mit scharfem Fog gemessen:

```
DEBUG_FORCE_PLAYER_VISIBILITY = false

swnjlk (V-W)  Zerlegungen 328 · nach Fog 11 · Zeilen 328, mit Hover 11 (3 %)
```

Dann zeigt der Hover nur noch beim **eigenen Kader**. Das ist die Entscheidung, die beim Bauen
getroffen wurde (der Rang je Disziplin IST die Disziplinstärke, und die ist fog-gated), und sie ist
**konsistent mit dem Rest**: `maskRatingsRowForVisibility` nullt für dieselben Spieler ohnehin OVR,
MVS, PPs **und** `marketValue`. Der Hover ist also nicht strenger als die Spalten daneben.

## Was gebaut ist

`tests/marktwert-hover-wird-wirklich-gerendert.test.tsx` — die Tabelle wird **gerendert**
(`renderToStaticMarkup`, damit `scripts/fahre-render-waechter.ts` sie einsammelt: 24 → 25 Dateien),
mit einer Zeile aus einem echten Generator-Spielstand.

Fünf Fälle: Panel steht im Markup · Disziplin mit **Katalognamen** statt ID · Sammelzeile und
Ergebniszeile da · `hidden` gesetzt (sonst stünde es dauerhaft offen) · ohne Zerlegung **kein**
leeres Panel · die MW-Zahl bleibt in beiden Fällen stehen.

**Gegenprobe:** `herleitung: row.marketValueBreakdown` auf `null` → drei Fälle fallen.

Beim Bauen fiel der erste Anlauf mit `Cannot read properties of undefined` — mein Handfixture für
die Heat-Pools ließ die Achsen-Pools weg. Jetzt über `createEmptyLeaguePlayerHeatPools` gebaut.

**Nichts an der Funktion geändert.** Dazugekommen ist nur der Nachweis.

## Geprüft

`tsc` leer · `ci:import-exists` (2356) · `ci:client-bundle-lint` · `ci:flow-smoke` (205) ·
Quelltext-Wächter (1998) · Render-Wächter (222, 25 Dateien) · `ci:quittungen` ok.

changelog: 2026-08-24-marktwert-hover-nachgeprueft.json
