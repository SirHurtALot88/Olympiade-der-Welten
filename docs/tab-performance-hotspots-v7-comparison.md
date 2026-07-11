# Foundation Tab Performance — V6.1 vs V7

Datum: 2026-06-30

## Delta (Browser-Audit)

| Metrik | V6.1 | V7 (Phase 0–3, Verify-Lauf) | Δ |
| --- | ---: | ---: | ---: |
| Initial Home | 110 286 ms | **1 735 ms** | **−98 %** |
| Failed Steps | 3 / 16 | **0 / 16** | alle navigierbar |
| OK Steps (<8 s) | 0 | **1** (Home → Inbox **391 ms**) | — |
| Langsamster Wechsel | Saisonstand 195 178 ms (fail) | Sponsoren 48 550 ms | **−75 %** |
| Arena → Saisonstand | 195 178 ms (fail) | **20 640 ms** | **−89 %** |
| Einsatzliste → Arena | 95 417 ms (`preview` ~52 s) | **8 965 ms** | **−91 %** |
| Teams → Spieler | 100 185 ms (99 API) | **11 751 ms** (0 API) | **−88 %** |
| Spieler → Training | 113 680 ms (`singleplayer-state` ~41 s) | **17 496 ms** | **−85 %** |
| Ranks → Diszis | 120 008 ms (fail, Briefing) | **36 255 ms** | **−70 %** |

## Status vs Ziel (<5 s warm)

15 von 16 Schritten noch **slow** (≥8 s), aber alle unter 50 s und ohne Timeout. Skeleton-Ready-Signale + Slice-Prefetch liefern sofort sichtbare Views; Restlast ist überwiegend Hintergrund-Slices und schwere Panels (Diszis/Sponsoren).

## Umgesetzte Maßnahmen

### Phase 1 (querliegend)
- Season-Briefing-Dismiss bei Sidebar-Nav
- Hydration-Fix Team-Selector (Save-Team vor localStorage)
- Kein Full-Save-Reload auf Tab-Wechsel; Auto-Persist-Pause 4 s

### Phase 2 (Tab-spezifisch)
- Saisonstand: Lightweight-Rows, Idle-Prefetch, Sync-Derivations nur bei Slice-Fehler
- Spieler: Directory-Slice-Cache + Bootstrap-Prefetch
- Training/Gebäude: Deferred Render, Ratings-Cache, erweitertes Prefetch
- Arena/Einsatzliste: Standings-Preview deferiert
- Teams: Archive-Load deferiert

### Phase 3 (Rest-Hotspots)
- `lib/foundation/foundation-navigation.ts` — Navigation aus Monolith extrahiert
- Dynamic-Panel-Skeletons mit Audit-`testId`/`id` für sofortiges Ready-Signal
- `seasonV2PanelActive`-Gating schwerer `useMemo`-Blöcke
- `BudgetedMediaImage` für Team-Logos im Saisonstand

### Phase 3 — zurückgestellt
- Delta-Persist PATCH (Server-Support vorhanden, Client noch Compact-PUT)
- SSR Slim Bootstrap (Page nur Metadata + compact initial)
- Vollständiger FoundationPageClient-Split (Shell / Router / Persist)

## Tests & Audits

- `npm run perf:regression-smoke` — ok
- `npm run perf:foundation-tabs -- --no-start --timeout-ms 60000` — ok, 16 Schritte
- Vitest: `foundation-performance-architecture`, `use-player-directory-slice-cache`

Rohdaten: [tab-performance-hotspots-v7.md](./tab-performance-hotspots-v7.md) · V6.1: [tab-performance-hotspots-v6.1-comparison.md](./tab-performance-hotspots-v6.1-comparison.md)
