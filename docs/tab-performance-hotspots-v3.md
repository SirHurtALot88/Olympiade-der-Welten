# Foundation Performance Hotspots V3

Datum: 2026-06-19

## Kurzfazit

V3 nimmt den naechsten Tabellen-Hotspot spuerbar runter:

- Transferhistorie laedt jetzt seitenweise mit echtem `limit`/`offset` statt sofort tausende Eintraege aufzubauen.
- Markt-Free-Agents starten API-seitig mit `limit=48&offset=0`; "Mehr laden" holt die naechste Seite nach.
- Transfer-Recap ist im Markt eingeklappt und laedt erst beim Oeffnen; der Historie-Tab feuert keine unnoetige Recap-API mehr.
- Browser-QA ueber Home, Arena, Teams, Training, Transfermarkt, Transferhistorie, Saisonstand, Ranks und Diszis blieb ohne neue Browser-Errors.

## Messwerte V3

| Von | Nach | V2 | V3 | Status | Befund |
| --- | --- | ---: | ---: | --- | --- |
| START | Home | ca. 1500 ms | ca. 10765 ms frischer Dev-Reload | mixed | Request-Set bleibt sauber, aber ein frischer Dev-Full-Reload ist weiter schwer und HMR-lastig. |
| Arena | Teams | 10357 ms | 5150 ms | improved | Teams bleibt schneller erreichbar; Arena blockiert den Wechsel nicht mehr sichtbar. |
| Training | Transfermarkt | 12430 ms | 7568 ms | improved | Markt startet kleiner mit `limit=48`; der Feed bleibt noch der groesste Einzelblock. |
| Transfermarkt | Transferhistorie | 10428 ms | 8573 ms | improved | Historie laedt nur noch 100 Transfers zuerst; die unnoetige Recap-API beim Historienwechsel ist weg. |

Zusatzchecks:

- Transferhistorie "Mehr laden": `offset=100`, ca. `740 ms`, danach `200 von 3177 Transfers`.
- Transfermarkt "Mehr laden": `offset=48`, ca. `1003 ms`, geladener Feed steigt ohne Voll-Neuladen.

CSV: `docs/tab-performance-hotspots-v3.csv`

## Direkt Verbessert

- `app/api/transfermarkt/history/route.ts`
  - liest jetzt `offset`
  - gibt Paging-Metadaten zurueck
- `lib/market/transfer-history-read-service.ts`
  - Prisma-Historie unterstuetzt `skip/take`
  - liefert `total`, `offset`, `limit`, `returned`, `hasMore`
- `lib/market/transfermarkt-local-service.ts`
  - lokale Historie und lokaler Markt unterstuetzen `offset`
  - Marktseiten koennen nachgeladen werden, ohne den ganzen Pool neu ins DOM zu legen
- `lib/market/transfermarkt-read-service.ts`
  - Free-Agent-Feed sliced schon im Service statt erst im UI
- `app/foundation/FoundationPageClient.tsx`
  - Markt startet mit kleiner API-Seite statt "alles holen"
  - Historie startet mit 100 Transfers und klarer Fenster-Anzeige
  - beide Bereiche haben echtes "Mehr laden"
  - Markt-Recap ist einklappbar und nur bei Bedarf aktiv
  - Historie feuert keine Recap-API mehr im Hintergrund

## Request-Audit

Frischer Home-Start:

- `GET /foundation`
- `GET /api/singleplayer-state?compact=foundation-initial`
- `GET /api/season/standings-overview`
- `GET /api/season/management-overview`
- Version-Polling weiter separat
- keine fruehen Markt-/History-/XP-Feeds

Transfermarkt:

- Initial: `GET /api/transfermarkt/free-agents?...limit=48&offset=0&teamId=A-A`
- Nachladen: `GET /api/transfermarkt/free-agents?...limit=48&offset=48&teamId=A-A`

Transferhistorie:

- Initial: `GET /api/transfermarkt/history?...limit=100&offset=0`
- Nachladen: `GET /api/transfermarkt/history?...limit=100&offset=100`
- kein `transfermarkt/recap` mehr beim Wechsel nur in die Historie

## Browser-QA V3

Geprueft:

- Home
- Arena
- Teams
- Training
- Transfermarkt
- Transferhistorie
- Saisonstand
- Ranks
- Diszis

Ergebnis:

- alle Tabs oeffnen sichtbar
- keine neuen Browser-Errors im finalen QA-Tab
- Load-more-UI in Markt und Historie reagiert
- leere States bleiben mit Hinweis statt stiller Leerflaeche

## Rest-Hotspots

1. Frischer Dev-Reload auf Home bleibt spuerbar langsam, obwohl der Request-Scope sauber ist.
2. Arena beendet alte `resolve/legacy-matchday-preview`- und `standings/preview`-Arbeit serverseitig noch, auch wenn der Tab schon gewechselt ist.
3. Markt-Free-Agents liegen trotz Limit weiter oft bei rund 1-2.2s und brauchen spaeter wohl einen kompakteren Feed oder Cache.
4. Einige Tabellen feuern beim ersten Oeffnen weiter viele Bild-Requests (Portraits/Logos), auch wenn der Datenblock selbst schon kleiner ist.

## Naechste Prioritaeten

1. Arena-Preview serverseitig kompakter machen oder cachen, damit alte Long-Running-Preview-Arbeit gar nicht erst so teuer startet.
2. Home-Start weiter staffeln: Management-/Standings-Bloecke spaeter oder kleiner nachziehen.
3. Marktfilter staerker serverseitig spiegeln, damit "sichtbar" und "geladen" bei grossen Pools enger zusammenlaufen.
4. Grosse Saison-/Rank-Tabellen weiter in Top-Karten plus paginierte Details aufteilen.
