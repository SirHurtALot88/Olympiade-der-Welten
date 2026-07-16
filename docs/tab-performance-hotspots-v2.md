# Foundation Performance Hotspots V2

Datum: 2026-06-19

## Kurzfazit

V2 reduziert die groessten Hotspots ohne neuen Gameplay-Scope:

- Teams startet jetzt leicht: Kader-/Board-Fokus bleibt sofort nutzbar, Vergleich, History und grosse Tabellen werden erst nach Klick gebaut.
- Arena zeigt Grundlayout und Score-Race frueher; Resolve- und Standings-Preview laufen separat im Hintergrund.
- Markt-, Historie-, Recap-, Resolve- und Standings-Fetches bekommen AbortController und ignorieren Abort sauber.
- Version-Polling laeuft nicht mehr alle 4s, sondern alle 25s und pausiert hidden Tabs.

Browser-Konsole im Kurzcheck: keine neuen Warnungen oder Errors.

## Messwerte V2

| Von | Nach | V1 | V2 | Status | Befund |
| --- | --- | ---: | ---: | --- | --- |
| START | Home | 8000 ms | ca. 1500 ms bis Home sichtbar | improved | Start feuert weiterhin keine Markt-/History-/XP-Feeds. |
| Einsatzliste | Arena | 6619 ms | 12286 ms kalt | mixed | Dev-Cold-Run blieb schwer, Arena blockiert aber nicht mehr auf Detail-Preview. |
| History | Arena | 6619 ms Referenz | 5966 ms warm | improved | Grundlayout sichtbar, Detailpreview zeigt "Preview laedt". |
| Arena | Teams | 22005 ms | 10357 ms | improved | Teams laedt jetzt als leichter Fokus statt sofortiger Vollvergleich. |
| Training | Transfermarkt | 13230 ms | 12430 ms | slightly-improved | Markt-Feed selbst bleibt groesster Anteil. |
| Transfermarkt | Transferhistorie | 9600 ms | 10428 ms | needs-follow-up | History mit 3177 Transfers bleibt tabellarisch schwer. Abort verhindert UI-Nachlauf, nicht zwingend Serverarbeit. |

CSV: `docs/tab-performance-hotspots-v2.csv`

## Direkt Verbessert

- Teams: `showTeamsComparison` startet aus. Dadurch werden Disziplin-Ranks, History-Rank-Maps, grosse Vergleichstabellen und History-Details erst gebaut, wenn der Nutzer den Vergleich explizit einblendet.
- Teams: Leerer Vergleichszustand ist ein normaler Schnellstart-Hinweis statt leerer Flaeche.
- Arena: Basisdaten und Score-Feed werden getrennt von Resolve/Standings-Details geladen.
- Arena: Details zeigen einen ruhigen "Preview laedt im Hintergrund"-Hinweis statt den Tab zu blockieren.
- Arena: alte Basis- und Detailrequests werden bei neuem Load/Unmount abgebrochen.
- Foundation Feeds: Transfermarkt Free Agents, Transferhistorie, Transfer-Recap, Resolve Preview und Standings Preview sind abortable.
- Version-Check: 4s Polling wurde auf 25s entschaerft; hidden Tabs pingen nicht.

## Request-Audit

Start im QA-Tab:

- `GET /foundation`
- `GET /api/singleplayer-state?...compact=foundation-initial`
- Home-relevante Feeds: `season/standings-overview`, `season/management-overview`
- keine fruehen Markt-/History-/XP-Preview-Feeds
- keine Browser-Warnungen

Beobachtung:

- Dev/React kann in der lokalen QA doppelte Mount-Requests zeigen. Die UI ignoriert/abortet alte Antworten, aber Serverlogs koennen bereits gestartete Requests trotzdem noch als 200 ausgeben.
- Besonders `resolve/legacy-matchday-preview` kann serverseitig noch sehr lange fertiglaufen (im QA-Log einmal 25,1s), obwohl die UI nicht mehr darauf blockiert.
- Transferhistorie ist fachlich korrekt, aber durch mehrere tausend Zeilen weiterhin der naechste grosse UI-Hotspot.

## Naechste Prioritaeten

1. Transferhistorie: echte Pagination/Windowing statt 3177 Zeilen im DOM.
2. Arena: `lab-context` und `matchday-mvp-score` cachen oder als kompakter Arena-Endpoint buendeln.
3. Teams: beim Vergleich nur Top-N initial rendern und History-Tabelle erst beim `details`-Oeffnen mounten.
4. Markt: Free-Agents limitierter initial laden und Detailanalyse erst nach Auswahl.
5. Version-/Save-Refresh: nach User-Aktion triggern und Polling weiter in Richtung idle/action-based schieben.
