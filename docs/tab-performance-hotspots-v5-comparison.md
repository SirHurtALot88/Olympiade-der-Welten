# Foundation Performance V4 vs V5 — Vergleich

Datum: 2026-06-28

Kontext: V5 führt **Season-Derivations-Cache** (Ledger + Ratings + Performance), **Training-Roster-Scope**, Hook-Fix (`contentSignature` statt `gameState`-Referenz) und erweiterte Audit-Phasen ein.

Quellen:
- V4 Baseline: [tab-performance-hotspots-v4.md](./tab-performance-hotspots-v4.md)
- V5 Browser-Rohdaten: [tab-performance-hotspots-v5.md](./tab-performance-hotspots-v5.md), `outputs/foundation-tab-performance-audit/latest.json`
- V5 Backend: [outputs/performance-audit-summary.md](../outputs/performance-audit-summary.md), `outputs/performance-audit.json`

---

## Backend-Audit — messbarer Impact (Cache + Roster-Scope)

| Metrik | V4 Baseline | V5 gemessen | Delta | Severity V5 |
| --- | ---: | ---: | ---: | --- |
| training page build (Team-Roster) | 59 300 ms (333 Spieler) | **943 ms** | **−98,4 %** | beobachten |
| season derivations cold build | — (neu) | **5,6 ms** | neu | ok |
| season derivations cache hit | — (neu) | **0,03 ms** | neu | ok |
| perf:regression-smoke derivationsHitMs | — | **0 ms** | Budget <50 ms | ok |
| transfermarkt free-agent feed | ~2 000 ms (V4 Schätzung) | 11 116 ms | Save-abhängig | kritisch |
| AI market preview | 2 500 ms | 2 690 ms | +8 % | langsam |

**Fazit Backend:** Der Season-Derivations-Cache funktioniert wie designed — Cache-Hit ist praktisch kostenlos (<1 ms). Der Training-Audit-Pfad ist von league-wide (333) auf Team-Roster umgestellt: **~59 s → <1 s** auf dem aktiven Audit-Save.

Hinweis: `season derivations cold build` ist auf dem aktuellen Save (wenig Matchday-Historie) sehr schnell. Auf Saves mit vielen `matchdayResults`/`disciplineResults` wird Cold deutlich teurer — dann lohnt der Cache-Hit erst recht.

---

## Browser-Tab-Audit — teilweise, mit Einschränkungen

V5-Lauf (`fresh-season-1-1782648840550`, Dev-Server frisch gestartet, 2026-06-28):

| Von → Nach | V4 ms | V5 ms | Delta | Status V5 |
| --- | ---: | ---: | ---: | --- |
| START → Home | 25 191 | 54 991 | +119 % | slow (Cold-Compile) |
| Home → Inbox | 12 249 | 10 084 | **−18 %** | slow |
| Inbox → Einsatzliste | 9 541 | 34 339 | +260 % | slow |
| Einsatzliste → Arena | 12 676 | 13 586 | +7 % | slow |
| Arena → Saisonstand | 28 093 | **11 312** | **−60 %** | slow |
| Saisonstand → Teams | 25 490 | 127 435 | timeout | **failed** |
| Teams → Spieler | 20 755 | — | — | failed (Kaskade) |
| Spieler → Training | 34 595 | — | — | failed (Kaskade) |
| Training → Gebäude | 52 095 | — | — | failed (Kaskade) |
| Gebäude → Training (revisit) | — | — | — | failed (Kaskade) |
| Ranks → Diszis | 38 685 | 159 655 | +313 % | slow |
| Diszis → Sponsoren | 83 961 | 145 271 | +73 % | failed |

**Fazit Browser:** Der V5-Lauf ist **nicht 1:1 vergleichbar** mit V4:
1. Anderer Save (`fresh-season-1` vs. V4-Lauf), Dev-Server Cold-Start (+25 s Compile).
2. **Teams-Tab hing 120 s** (`foundation-teams-view` nicht sichtbar) — danach Kaskaden-Timeouts.
3. Laufzeitfehler: `marketSellBusy is not defined` (JS-Error im Client).

Erkennbare Wins trotzdem: **Arena → Saisonstand −60 %**, **Home → Inbox −18 %**.

---

## Was V5 geliefert hat (Code)

| Änderung | Datei |
| --- | --- |
| In-Process-Cache + Facade | `lib/foundation/season-derivations-cache.ts`, `get-season-derivations.ts` |
| Client-Hook (Signature-Deps) | `lib/foundation/use-season-derivations.ts` |
| Foundation Wiring | `FoundationPageClient.tsx` |
| Invalidation bei Persist | `lib/persistence/save-repository.ts` |
| Audit-Phasen cold/hot | `scripts/export-performance-audit.ts` |
| CI Smoke Budget | `scripts/perf-regression-smoke.ts` |
| Training-Revisit Messung | `scripts/foundation-tab-performance-audit.ts` |
| Call-Site-Migration | `transfermarkt-local-service.ts`, `player-economy-compare-service.ts` |
| `playerIds`-Filter Ratings | `player-rating-contract.ts` |

---

## Nächste Hebel (priorisiert)

### P0 — Audit stabilisieren
- Teams-Tab-Timeout fixen (`data-testid="foundation-teams-view"` / Render-Blocker)
- `marketSellBusy is not defined` beheben (bricht Client-Runtime)
- Tab-Audit mit **gleichem Save** wie V4 wiederholen, Warm-Server (`--no-start`)

### P1 — Größter verbleibender CPU/API-Hebel
- `/api/singleplayer-state` Full-Reload bei Tab-Wechsel reduzieren (V4: 6–8 s pro Training/Gebäude)
- Restliche ~15 Call-Sites auf `getSeasonDerivations()` migrieren
- `buildPlayerRatingContractMap` mit `playerIds` bei gezielten Rebuilds nutzen

### P2 — Browser-Latenz
- Portrait/Logo-Requests deduplizieren (V4: 63 Calls auf Spieler-Tab)
- `standings-overview` Cache-Hit-Rate prüfen (V4: 10,8 s auf Diszis)
- Transfermarkt Free-Agent Feed (V5 Audit: 11 s — jetzt Top-Hotspot)

### P3 — Architektur
- `FoundationPageClient` weiter splitten (~29k Zeilen)
- Optional: Ledger-Snapshot bei Matchday-Apply persistieren

---

## Befehle zum Reproduzieren

```bash
npm run perf:audit                    # Backend (outputs/performance-audit-summary.md)
npm run perf:regression-smoke         # Cache-Hit Budget <50 ms
npm run dev                           # dann in zweitem Terminal:
npm run perf:foundation-tabs -- --no-start --timeout-ms 120000
```
