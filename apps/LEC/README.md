# LEC Cockpit

Shop-Analytics fuer **Lord Enterich Cards** (Yu-Gi-Oh!-Kartenhandel). Eigenstaendige
Next.js-App im Oly-Repo (`apps/LEC/`), komplett getrennt von der Olympiade — eigenes
`package.json`, eigenes `Dockerfile`, eigene SQLite-DB, eigener Zugangsschutz.

Das fachliche Konzept (Datenmodell, Ingestion, Matching, Preis-Engine, KI-Klassifikation,
Roadmap) steht in [`docs/enterich-cards/KONZEPT.md`](../../docs/enterich-cards/KONZEPT.md).
Der abgenommene visuelle Referenz-Mockup liegt in [`design-reference.html`](./design-reference.html).

## Setup

```bash
cd apps/LEC
npm install
cp .env.example .env      # lokale Defaults, Login bleibt in Dev standardmaessig aus
npm run db:push           # SQLite-Schema anlegen (alternativ: npm run db:migrate)
npm run dev                # http://localhost:3000
```

Tests / Build:

```bash
npm test        # Vitest (Unit-Tests, keine echten Geschaeftsdaten)
npm run build   # next build
```

## Tech-Stack

- Next.js (App Router) + TypeScript
- Prisma + SQLite (`prisma/schema.prisma`, siehe KONZEPT §5.4)
- Vitest fuer Unit-Tests
- `exceljs` fuer Billbee-.xlsx-Importe, `csv-parse` fuer den eBay-CSV-Export

## Umgebungsvariablen (`LEC_`-Prefix)

Siehe [`.env.example`](./.env.example) fuer die vollstaendige Liste inkl. Kommentare:

- `LEC_SQLITE_PATH` — Pfad zur SQLite-Datei zur Laufzeit.
- `LEC_DOMAIN` — produktive Domain (`leccards.duckdns.org`), nur informativ.
- `LEC_AUTH_ENABLED`, `LEC_PASSWORD`, `LEC_AUTH_SECRET` — Zugangsschutz (siehe unten).

**Wichtig:** `DATABASE_URL` (nur fuer die Prisma-CLI) und `LEC_SQLITE_PATH` (App-Runtime)
muessen auf dieselbe Datei zeigen. Die `db:*`-npm-Skripte laufen deshalb ueber
`scripts/with-db-env.ts`, das `DATABASE_URL` immer konsistent (absoluter Pfad) aus
`LEC_SQLITE_PATH` ableitet — Prisma wuerde eine relative `file:`-URL sonst relativ zum
`prisma/`-Ordner statt zum Arbeitsverzeichnis aufloesen.

## Zugangsschutz

Single-User-Login ("Chris"), kein OAuth/Nutzerverwaltung — analog zum `OLY_AUTH`-Muster
der Oly:

- In Produktion (`NODE_ENV=production`) ist der Login **immer an**.
- In Dev/Test standardmaessig **aus**, testweise aktivierbar mit `LEC_AUTH_ENABLED=1`.
- Ist der Login an, aber `LEC_PASSWORD`/`LEC_AUTH_SECRET` fehlen, sperrt sich die App
  komplett (503, fail closed) — kein unsicherer Default.
- Session: signiertes, `HttpOnly`-Cookie (`lec_session`, HMAC-SHA256 via Web Crypto,
  7 Tage gueltig). Middleware (`src/middleware.ts`) schuetzt alle Seiten (Redirect zu
  `/login`) und alle API-Routen (401 JSON) ausser `/login`, `/api/auth/login`,
  `/api/health`.
- Die App setzt zusaetzlich `X-Robots-Tag: noindex, nofollow` (Header + `public/robots.txt`),
  damit die Subdomain nicht indexiert wird.

## Datenimport (Billbee + eBay)

- `src/lib/importers/billbee.ts` — Billbee "Verkaeufe nach Artikel" (.xlsx), Vorspann
  ueberspringen, Fenster **immer** aus dem `Zeitraum`-Feld lesen (nie aus dem Dateinamen).
- `src/lib/importers/ebay.ts` — eBay "Listings Sales Report" (.csv), Gebuehren-Felder je
  Angebot.
- `src/lib/matching/engine.ts` — Matching ueber den normalisierten Artikelnamen (primaer),
  Set-Code (sekundaer), gelernte Aliasse.
- `src/lib/pipeline/importPlan.ts` — reine Planungslogik (Artikel-Katalog, Fenster-
  Snapshots inkl. DB I/II, Review-Liste); `persist.ts` schreibt das Ergebnis nach Prisma.
- `scripts/import-local-fixtures.ts` — **nur lokal**: importiert die echten Dateien aus
  `.local-fixtures/` (gitignored, echte Geschaeftsdaten) zur manuellen Verifikation:
  `npx tsx scripts/import-local-fixtures.ts`. Laeuft nicht in CI/Tests.

Alle Tests laufen gegen kleine synthetische Fixtures (frei erfunden), niemals gegen
echte Geschaeftsdaten.

## Deploy (Hetzner, siehe KONZEPT §4.2)

`Dockerfile` baut ein produktionsfertiges Image (Node 22, Prisma-Migrationen laufen
beim Start via `scripts/start-hosted.sh` gegen `LEC_SQLITE_PATH`). `/api/health` liefert
`200 {"status":"ok"}` fuer Monitoring/Healthcheck. Das Caddy-/`docker-compose`-Wiring fuer
die Subdomain (`LEC_DOMAIN=leccards.duckdns.org`) folgt in `deploy/hetzner/`.

## Status / offene Punkte

**Fertig (Phase 0/1, getestet):**
- Next.js+TS+Prisma/SQLite-Gerüst, Dockerfile, Zugangsschutz, `/api/health`.
- Zahlen-/Datums-Parser, Set-Code-Extraktor, Namens-Normalisierer, Privatverkauf-Filter.
- Billbee-/eBay-Importer, Matching-Engine (≈99% exakte Treffer an den echten Fixtures),
  Preis-Engine (HK/eBay-Gebuehren/VK-Korridor), Import-Pipeline mit DB I/II-Neuberechnung.

**Noch offen (Phase 2/3, siehe KONZEPT §10):**
- Dashboard-UI (Port von `design-reference.html` auf echte importierte Daten).
- Upload-UI fuer Billbee/eBay-Dateien + Review-Liste-UI fuer Ungematchtes.
- Cardmarket-`MarketPriceProvider`-Interface (Provider B, manuelle Preiseingabe).
- Regelbasiertes KI-Scoring (§8 Stufe 1) + LLM-Empfehlungs-Layer (Stufe 2).
- Alt-Migrations-Importer aus `Yu Gi Oh Verkäufe.xlsx`.
- Bekannte Vereinfachung: eBay-Gebuehren werden pro Artikel als Gebuehr/Stueck aus dem
  eBay-Report ermittelt und per Stueckzahl auf die Billbee-Fenster verteilt (die
  Berichtszeitraeume sind nicht exakt deckungsgleich) — siehe Kommentar in
  `src/lib/pipeline/importPlan.ts`.
