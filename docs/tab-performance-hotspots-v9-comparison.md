# Foundation Tab Performance — V8 vs V9

Datum: 2026-07-03

## Sequenzielle Chain (V8-vergleichbar)

| Von | Nach | V8 ms | V9 ms | Δ | Status V9 |
| --- | --- | ---: | ---: | ---: | --- |
| START | Home | 680 | **11986** | +11306 | slow |
| Home | Inbox | 180079 | **1074** | -179005 | ok |
| Inbox | Einsatzliste | 2953 | **1135** | -1818 | ok |
| Einsatzliste | Einsatzliste v2 | — | **890** | — | ok |
| Einsatzliste v2 | Arena | — | **1455** | — | ok |
| Arena | Saisonstand | 5375 | **1870** | -3505 | ok |
| Saisonstand | Teams | 10703 | **1359** | -9344 | ok |
| Teams | Teams (revisit) | 2960 | **891** | -2069 | ok |
| Teams | Spieler | 2950 | **1385** | -1565 | ok |
| Spieler | Training | 5564 | **3638** | -1926 | ok |
| Training | Gebäude | 5552 | **1144** | -4408 | ok |
| Gebäude | Training (revisit) | 4267 | **1387** | -2880 | ok |
| Gebäude | Transfermarkt | 12300 | **1277** | -11023 | ok |
| Transfermarkt | Scouting | 4360 | **1537** | -2823 | ok |
| Scouting | Historie | 4294 | **1133** | -3161 | ok |
| Historie | Ranks | 6565 | **1927** | -4638 | ok |
| Ranks | Diszis | 4760 | **1063** | -3697 | ok |
| Diszis | Sponsoren | 12153 | **2051** | -10102 | ok |
| Sponsoren | Lexikon | 5429 | **1166** | -4263 | ok |
| Lexikon | Cockpit | — | **1694** | — | ok |
| Cockpit | Generator | — | **1156** | — | ok |
| Generator | Settings | — | **1360** | — | ok |
| Settings | Admin | — | **1005** | — | ok |

## Neue V9-Abdeckung

- **Home-direct cold/warm** pro Nav-Tab (20 Tabs)
- **Drilldowns:** Spielerprofil cold/warm, 6 Untertabs, Teamprofil cold/warm, 3 Teams-Untertabs, Deep-Link
- **Admin-Gruppe:** Cockpit, Generator, Settings, Admin

## Optimierungs-Backlog (Hypothesen → im Lauf verifiziert)

Siehe Abschnitt Top-5 in [tab-performance-hotspots-v9.md](./tab-performance-hotspots-v9.md).

