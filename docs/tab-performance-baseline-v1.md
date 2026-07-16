# Foundation Tab Performance Baseline V1

Datum: 2026-06-19

## Kurzfazit

Browser-QA lief ueber Home, Einsatzliste, Arena, Teams, Training, Transfermarkt, Transferhistorie, Saisonstand, Ranks und Diszis.

Alle geprueften Tabs wurden sichtbar geladen und hatten im frischen QA-Tab keine neuen Browser-Errors. Die groessten Performance-Probleme sind nicht mehr der Start, sondern schwere Tabwechsel und nachlaufende Requests.

## Direkt Verbessert

- Initial-Save-Load wiederhergestellt: Home bleibt nicht mehr im `Foundation laedt` Platzhalter haengen.
- `loading-team` wird nicht mehr in URL/local storage synchronisiert.
- XP-Preview laedt erst im Training, nicht mehr auf Home.
- Einsatzlisten-Kontext bekommt Inflight-Dedupe und Abort; eingebettete Nutzung laedt nicht mehr doppelt ueber Mount + Prop-Sync.
- Einsatzlisten-Preview bekommt Inflight-Dedupe fuer identische Preview-Payloads.
- Live-Save-Refresh laedt schwere Feeds nur noch fuer den aktiven Tab statt pauschal Saisonstand, Standings, Preisgeld und Management.

## Start-Audit

Start nach Fix:

- `GET /foundation`
- `GET /api/singleplayer-state?...compact=foundation-initial`
- echte Home-Daten: `season/standings-overview`, `season/management-overview`
- keine fruehen `loading`-IDs fuer Markt, XP, History, Standings oder Saisonstand
- kein XP-Preview auf Home
- kein Markt-/History-Feed auf Home
- keine Browser-Warnungen im frischen QA-Tab

Hinweis: Version-Polling laeuft weiter im Hintergrund. Mehrere offene Browser-QA-Tabs vervielfachen diese Polls, daher wurden offene QA-Tabs nach der Messung geschlossen.

## Messwerte

| Von | Nach | Zeit | Status | Befund |
| --- | --- | ---: | --- | --- |
| START | Home | 8000 ms | ok | echter Save geladen, keine falschen Loading-API-Calls |
| Home | Einsatzliste | 6645 ms | fixed | doppelte Lineup-Requests im Baseline-Run gefunden und dedupliziert |
| Einsatzliste | Arena | 6619 ms | needs-follow-up | Arena wartet sichtbar auf Kontext; lange Arena-Preview kann nachlaufen |
| Arena | Teams | 22005 ms | needs-follow-up | langsamster Wechsel; Resolve/Standings liefen 11-12s |
| Teams | Training | 12482 ms | ok | Training zeigt Rueckschritt-Risiko korrekt, aber Renderflaeche schwer |
| Training | Transfermarkt | 13230 ms | fixed | pauschaler Live-Refresh-Burst gefunden und tab-sensitiv gemacht |
| Transfermarkt | Transferhistorie | 9600 ms | needs-follow-up | Markt-Free-Agents lief nach Tabwechsel noch fertig |
| Transferhistorie | Saisonstand | 10482 ms | ok-heavy | viele Tabellenzeilen und Teamlogos |
| Saisonstand | Ranks | 7516 ms | fixed | Live-Refresh-Burst gefunden und tab-sensitiv gemacht |
| Ranks | Diszis | 7120 ms | ok | stabil, aber weiterhin tabellarisch |

CSV: `docs/tab-performance-baseline-v1.csv`

## Prioritaeten Danach

1. Teams weiter entlasten: Tabellen-Vollrender und History-Block nur bei Bedarf sichtbar/rendern.
2. Arena-Preview beschleunigen oder entkoppeln: 11-12s Resolve/Standings darf nicht den Flow blockieren.
3. Fetch-Abbruch fuer Markt/History/Preview-Feeds, damit alte Tabrequests nicht nach dem Wechsel weiterlaufen.
4. Saisonstand Logos/Bilder weiter lazy halten und Tabellenabschnitte begrenzen.
5. Version-Polling von 4s auf groesseren Idle-Takt oder sichtbarkeits-/aktionsbasierten Takt pruefen.
