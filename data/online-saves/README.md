# Online-Saves

Gzip-JSON-Snapshots der Spielstände, versioniert im Repo → überall verfügbar (jeder Clone,
jedes Deploy, jede Claude-Session). So kann z. B. ein Bug in einem aktiven Save reproduziert und
gefixt werden, weil der exakte Stand hier liegt.

## Dateien
- `<saveId>.json.gz` – ein kompletter Spielstand (gzip-komprimiertes `PersistedSaveGame`-JSON).
- `manifest.json` – Liste aller Saves + welcher aktiv ist. Wird nur bei echten Änderungen neu geschrieben.

## Befehle
- `npm run saves:export` – lokale SQLite-Saves hierher schreiben (Gegenstück: Import).
- `npm run saves:import` – diese Saves in den lokalen SQLite-Store laden (Upsert, legt fehlende neu an).

## Automatik
Der laufende Server spiegelt Saves automatisch hierher (`lib/persistence/online-save-auto-export.ts`,
Env `OLY_AUTO_EXPORT_SAVES`, Default an). Mit `OLY_AUTO_EXPORT_PUSH=1` werden geänderte Saves zusätzlich
automatisch nach GitHub committet + gepusht (nur reine Save-Commits, nie unfertiger Code).
