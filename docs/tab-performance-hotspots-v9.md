# Foundation Performance Hotspots V9

Datum: 2026-07-03

## Kurzfazit

- Initialer Home-Load: **11986 ms**
- Mess-Schritte gesamt: **76** (Chain + Home-direct + Drilldowns)
- Slow (>=8s): 3 · Failed: 0 · Main-Thread-Hinweise: 1
- Save: `fresh-season-1-1783097218467`, Team: `A-A`
- Langsamster Schritt: **Teamprofil (warm)** (122710 ms, Modus drilldown)
- Browser-Errors: keine

## Messwerte V9

| Modus | Von | Nach | ms | API | Langsamste API | Main-Thread | Status | Befund |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| chain | START | Home | 11986 | 0 | — | ja | slow | initial_load; Tabwechsel >5s; main_thread_heavy |
| chain | Home | Inbox | 1074 | 0 | — | nein | ok | — |
| chain | Inbox | Einsatzliste | 1135 | 2 | /api/lineups/legacy/ai-preview 13ms | nein | ok | — |
| chain | Einsatzliste | Einsatzliste v2 | 890 | 5 | /api/lineups/legacy/ai-preview 26ms | nein | ok | — |
| chain | Einsatzliste v2 | Arena | 1455 | 1 | /api/media/team-logo/A-A 4ms | nein | ok | — |
| chain | Arena | Saisonstand | 1870 | 5 | /api/media/team-logo/W-L 6ms | nein | ok | — |
| chain | Saisonstand | Teams | 1359 | 0 | — | nein | ok | — |
| chain | Teams | Teams (revisit) | 891 | 0 | — | nein | ok | — |
| chain | Teams | Spieler | 1385 | 0 | — | nein | ok | — |
| chain | Spieler | Training | 3638 | 2 | /api/media/player-portrait/player-1223-emissary-corwan 1325ms | nein | ok | — |
| chain | Training | Gebäude | 1144 | 0 | — | nein | ok | — |
| chain | Gebäude | Training (revisit) | 1387 | 0 | — | nein | ok | — |
| chain | Gebäude | Transfermarkt | 1277 | 3 | /api/transfermarkt/history 163ms | nein | ok | — |
| chain | Transfermarkt | Scouting | 1537 | 2 | /api/transfermarkt/buy 292ms | nein | ok | — |
| chain | Scouting | Historie | 1133 | 1 | /api/transfermarkt/history 306ms | nein | ok | — |
| chain | Historie | Ranks | 1927 | 0 | — | nein | ok | — |
| chain | Ranks | Diszis | 1063 | 0 | — | nein | ok | — |
| chain | Diszis | Sponsoren | 2051 | 1 | /api/season/prize-preview 525ms | nein | ok | — |
| chain | Sponsoren | Lexikon | 1166 | 0 | — | nein | ok | — |
| chain | Lexikon | Cockpit | 1694 | 2 | /api/season/prize-preview 480ms | nein | ok | — |
| chain | Cockpit | Generator | 1156 | 2 | /api/season/management-overview 844ms | nein | ok | — |
| chain | Generator | Settings | 1360 | 0 | — | nein | ok | — |
| chain | Settings | Admin | 1005 | 0 | — | nein | ok | — |
| home_direct | Home | Inbox (cold) | 1038 | 0 | — | nein | ok | — |
| home_direct | Home | Inbox (warm) | 1168 | 0 | — | nein | ok | — |
| home_direct | Home | Einsatzliste (cold) | 1096 | 2 | /api/lineups/legacy/lab-context 235ms | nein | ok | — |
| home_direct | Home | Einsatzliste (warm) | 1012 | 2 | /api/lineups/legacy/lab-context 217ms | nein | ok | — |
| home_direct | Home | Einsatzliste v2 (cold) | 1119 | 5 | /api/lineups/legacy/lab-context 239ms | nein | ok | — |
| home_direct | Home | Einsatzliste v2 (warm) | 1052 | 2 | /api/lineups/legacy/lab-context 226ms | nein | ok | — |
| home_direct | Home | Arena (cold) | 1109 | 1 | /api/media/team-logo/A-A 234ms | nein | ok | — |
| home_direct | Home | Arena (warm) | 1143 | 1 | /api/media/team-logo/A-A 245ms | nein | ok | — |
| home_direct | Home | Saisonstand (cold) | 1076 | 18 | /api/media/team-logo/D-P 290ms | nein | ok | — |
| home_direct | Home | Saisonstand (warm) | 1143 | 0 | — | nein | ok | — |
| home_direct | Home | Teams (cold) | 1097 | 0 | — | nein | ok | — |
| home_direct | Home | Teams (warm) | 1158 | 0 | — | nein | ok | — |
| home_direct | Home | Spieler (cold) | 1194 | 0 | — | nein | ok | — |
| home_direct | Home | Spieler (warm) | 1259 | 0 | — | nein | ok | — |
| home_direct | Home | Training (cold) | 1311 | 5 | /api/media/team-logo/A-A 106ms | nein | ok | — |
| home_direct | Home | Training (warm) | 1104 | 0 | — | nein | ok | — |
| home_direct | Home | Gebäude (cold) | 983 | 0 | — | nein | ok | — |
| home_direct | Home | Gebäude (warm) | 992 | 0 | — | nein | ok | — |
| home_direct | Home | Transfermarkt (cold) | 1206 | 12 | /api/media/player-portrait/player-0577-tarakor 227ms | nein | ok | — |
| home_direct | Home | Transfermarkt (warm) | 1433 | 7 | /api/transfermarkt/free-agents 340ms | nein | ok | — |
| home_direct | Home | Scouting (cold) | 1038 | 0 | — | nein | ok | — |
| home_direct | Home | Scouting (warm) | 1139 | 0 | — | nein | ok | — |
| home_direct | Home | Historie (cold) | 1061 | 1 | /api/transfermarkt/history 251ms | nein | ok | — |
| home_direct | Home | Historie (warm) | 1040 | 1 | /api/transfermarkt/history 240ms | nein | ok | — |
| home_direct | Home | Ranks (cold) | 902 | 0 | — | nein | ok | — |
| home_direct | Home | Ranks (warm) | 1084 | 0 | — | nein | ok | — |
| home_direct | Home | Diszis (cold) | 959 | 0 | — | nein | ok | — |
| home_direct | Home | Diszis (warm) | 946 | 0 | — | nein | ok | — |
| home_direct | Home | Sponsoren (cold) | 1722 | 1 | /api/season/prize-preview 324ms | nein | ok | — |
| home_direct | Home | Sponsoren (warm) | 1662 | 1 | /api/season/prize-preview 255ms | nein | ok | — |
| home_direct | Home | Lexikon (cold) | 1105 | 0 | — | nein | ok | — |
| home_direct | Home | Lexikon (warm) | 1007 | 0 | — | nein | ok | — |
| home_direct | Home | Cockpit (cold) | 1280 | 3 | /api/season/prize-preview 221ms | nein | ok | — |
| home_direct | Home | Cockpit (warm) | 1335 | 3 | /api/season/prize-preview 333ms | nein | ok | — |
| home_direct | Home | Generator (cold) | 1068 | 0 | — | nein | ok | — |
| home_direct | Home | Generator (warm) | 1089 | 0 | — | nein | ok | — |
| home_direct | Home | Settings (cold) | 1038 | 0 | — | nein | ok | — |
| home_direct | Home | Settings (warm) | 1013 | 0 | — | nein | ok | — |
| home_direct | Home | Admin (cold) | 1005 | 0 | — | nein | ok | — |
| home_direct | Home | Admin (warm) | 1018 | 0 | — | nein | ok | — |
| drilldown | Spieler | Spielerprofil (cold) | 3721 | 7 | /api/media/player-portrait/player-1223-emissary-corwan 1378ms | nein | ok | — |
| drilldown | Spielerprofil | Spielerprofil (warm) | 13223 | 79 | /api/media/player-portrait/player-1423-eisenherz 2802ms | nein | slow | Tabwechsel >5s |
| drilldown | Spielerprofil | Spieler-Tab overview | 364 | 0 | — | nein | ok | — |
| drilldown | Spielerprofil | Spieler-Tab details | 653 | 0 | — | nein | ok | — |
| drilldown | Spielerprofil | Spieler-Tab contract | 1876 | 0 | — | nein | ok | — |
| drilldown | Spielerprofil | Spieler-Tab training | 1528 | 0 | — | nein | ok | — |
| drilldown | Spielerprofil | Spieler-Tab report | 1536 | 0 | — | nein | ok | — |
| drilldown | Spielerprofil | Spieler-Tab career | 787 | 0 | — | nein | ok | — |
| drilldown | Teams | Teamprofil (cold) | 1108 | 14 | /api/media/team-logo/B-P 726ms | nein | ok | — |
| drilldown | Teamprofil | Teamprofil (warm) | 122710 | 40 | /api/media/team-logo/M-M 34ms | nein | slow | Tabwechsel >5s |
| drilldown | Teams | Teams-Tab Portraits | 922 | 0 | — | nein | ok | — |
| drilldown | Teams | Teams-Tab Kader | 1309 | 31 | /api/media/team-logo/Z-H 36ms | nein | ok | — |
| drilldown | Teams | Teams-Tab Verträge | 687 | 0 | — | nein | ok | — |

## Top-5 Hotspots

1. **Teamprofil (warm)** (drilldown): 122710 ms — /api/media/team-logo/M-M
2. **Spielerprofil (warm)** (drilldown): 13223 ms — /api/media/player-portrait/player-1423-eisenherz
3. **Home** (chain): 11986 ms — Main-Thread
4. **Spielerprofil (cold)** (drilldown): 3721 ms — /api/media/player-portrait/player-1223-emissary-corwan
5. **Training** (chain): 3638 ms — /api/media/player-portrait/player-1223-emissary-corwan

CSV: [tab-performance-hotspots-v9.csv](./tab-performance-hotspots-v9.csv)

V8-Vergleich: [tab-performance-hotspots-v9-comparison.md](./tab-performance-hotspots-v9-comparison.md)

