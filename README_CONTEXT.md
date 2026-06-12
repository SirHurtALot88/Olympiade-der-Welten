# Olympiade der Welten

Dieser Ordner ist der zentrale Bezugspunkt fuer zukuenftige Chats zum Projekt.

## Kanonische Projektbasis

- App-Projekt:
  `/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp`
- Foundation-URL:
  `http://localhost:3000/foundation`
- Zielarchitektur:
  eigene Web-App, Supabase/Postgres als Ziel-DB, Prisma als ORM

## Inhalt dieses Ordners

- `docs/`
  - aktuelle DB-Dokumentation
  - offene DB-Fragen
  - Retool-Systemreferenz
  - Golden-Master-Porting-, Dependency- und Testfall-Dokus
- `data/source/`
  - manuelle Kernquellen fuer Teams, Team-Identities, Player-Team-Mapping
- `data/generated/`
  - generierte Spielerdaten und Mapping-Dateien
- `data/persistence/`
  - lokaler SQLite-Uebergangsstand als Referenz
- `references/code/`
  - wichtige Referenzdateien fuer Seed, Datentypen, Persistenz und GameState-Bootstrap
- `references/retool-ai-golden-master/`
  - extrahierte Retool-AI-/Needs-/Planner-/Fatigue-Referenzdateien aus dem JSON-Export
- `prisma/`
  - Schema, Seed und Migrationen des neuen Supabase/Postgres-Fundaments
- `scripts/`
  - Pruef-, Extraktions-, Smoke- und Vergleichsskripte
- `lib/ai/golden-master/`
  - unveraenderte TypeScript-Referenzconfigs aus dem Retool-Golden-Master
- `lib/lineups/`
  - Legacy-Lineup-Kernlogik
- `lib/resolve/`
  - Resolve-Preview-Kernlogik
- `app/foundation/legacy-lineup-lab/`
  - getrennte Legacy-Lineup-Lab-UI als Testwerkbank
- `app/api/lineups/legacy/`
  - Legacy-Lineup-API-Routen
- `tests/`
  - relevante Testfaelle fuer DB-, Legacy-Lineup-, Resolve- und Golden-Master-Arbeit

## Externe Asset-Quellen

- Spielerbilder:
  `/Users/chrisfalk/Library/CloudStorage/Dropbox/Chris/Olympiade der Welten/Mark VI Cardgame/Spieler`
- Teamlogos:
  `/Users/chrisfalk/Library/CloudStorage/Dropbox/Chris/Olympiade der Welten/Logos/Logos`

## Wichtige Projektregeln

- Retool ist nur Referenz und Dokumentationsquelle
- keine historischen Retool-Werte importieren
- keine neue Zukunftslogik auf SQLite aufbauen
- SQLite bleibt nur Uebergang/Fallback
- Battle Mode und Draft Mode vorerst ignorieren

## Empfohlene Einstiegsdateien fuer neue Chats

1. `docs/DATABASE.md`
2. `docs/DATABASE_OPEN_QUESTIONS.md`
3. `docs/README_RETOOL_SYSTEM.md`
4. `data/source/teams.json`
5. `data/source/team-identities.json`
6. `data/source/player-team-mapping.json`
7. `data/generated/oly-player-stats.json`

## Hinweis

Dieser Ordner ist ab jetzt der kanonische Sammelordner fuer alles, was zu diesem Projekt als Kontext, Referenz, Doku und Kernlogik gehoert.
Neue projektrelevante Dokus, Extrakte und Referenzdateien sollen immer auch hier landen.

Die laufende App wird technisch weiterhin aus dem Projektroot gestartet, aber der inhaltliche Projektbezug fuer zukuenftige Chats liegt in diesem Ordner.
