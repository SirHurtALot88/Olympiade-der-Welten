# Foundation Performance V4/V5 vs V6 — Vergleich

Datum: 2026-06-28

Kontext: V6 adressiert **Full-Save-Reload auf Teams/Spieler**, **marketSellBusy-Crash**, **Archive-Load-Scoping**, **Training-XP-Preview-Defer**, **Derivations-Migration**, **Transfermarkt-Compact/Cache**, **Portrait-Lazy** und **CI-Smoke-Budgets**.

Quellen:
- V4: [tab-performance-hotspots-v4.md](./tab-performance-hotspots-v4.md)
- V5: [tab-performance-hotspots-v5-comparison.md](./tab-performance-hotspots-v5-comparison.md)
- V6 Browser: [tab-performance-hotspots-v6.md](./tab-performance-hotspots-v6.md), `outputs/foundation-tab-performance-audit/latest-v6.json`
- V6 Backend: `outputs/performance-audit-summary.md`, `npm run perf:regression-smoke`

Save V6 Browser-Lauf: `save-1782655544429-6k242j` (Season 2, Warm-Dev-Server `--no-start`)

---

## Backend — messbare Impact

| Metrik | V4 | V5 | V6 gemessen | V6 Ziel | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| season derivations cache hit | — | 0,03 ms | **0 ms** (smoke) | <50 ms | ✅ |
| training page build (Audit) | 59 300 ms | 943 ms | **2 978 ms** (smoke, 327 Spieler) | <2 s | ⚠️ Save-abhängig |
| transfermarkt free-agent feed (cold) | ~2 000 ms | 11 116 ms | **~12 400 ms** (2658 FA) | <2 s | ⚠️ Cold-Build |
| transfermarkt free-agent feed (warm) | — | — | **14–19 ms** | <3 s | ✅ |
| perf:regression-smoke | — | derivations only | **ok** (warm FA + training) | CI grün | ✅ |

**Free-Agent Cold-Build:** Precomputed `soldPlayerBanIds` (statt `isPlayerTransferBuyBlocked` pro Spieler), Compact-Overlay ohne Fit-Berechnung, `contentSignature` im Market-Cache-Key. Cold von ~22 s → ~12 s auf dem aktiven Save; Warm-Cache <20 ms.

**Derivations-Migration:** `transfermarkt-sale-factor`, `contract-renewal-service`, `season-snapshot-service`, AI-Services (`ai-transfer-*`, `ai-xp-spend-planner`), `transfer-recap-service`.

---

## Browser-Tab-Audit — V6 vs V4/V5

| Von → Nach | V4 ms | V5 ms | V6 ms | Delta V6 vs V4 | Befund |
| --- | ---: | ---: | ---: | ---: | --- |
| START → Home | 25 191 | 54 991 | **16 925** | **−33 %** | Warm-Server |
| Home → Inbox | 12 249 | 10 084 | **4 228** | **−65 %** | ok |
| Saisonstand → Teams | 25 490 | **127 435 (fail)** | **37 027** | +45 % | **Teams wieder messbar** |
| Teams → Spieler | 20 755 | — | **27 717** | +34 % | 39 API-Calls (V4: 63 Portraits) |
| Spieler → Training | 34 595 | — | **89 504** | +159 % | `/api/singleplayer-state` 25,8 s |
| Gebäude → Training (revisit) | — | — | **25 541** | — | Ziel <3 s offen |
| Diszis → Sponsoren | 83 961 | 145 271 | **127 912 (fail)** | +52 % | Sponsor-Selector Timeout |

**Fazit Browser:**
1. **P0 erledigt:** `marketSellBusy`-Prop — Teams-Tab bricht nicht mehr ab (V5: 120 s Timeout).
2. **P1 teilweise:** Archive-Load nur noch für Views mit History-Bedarf; non-blocking Background-Load. Spieler-Tab triggert kein Full-Archive mehr, aber vereinzelte `/api/singleplayer-state`-Calls bleiben (25 s auf Training-Wechsel).
3. **Portrait-Sturm reduziert:** Spieler-Tab 39 vs. V4 63 Portrait/API-Calls.
4. **Offen:** Sponsoren-Subtab-Selector, Training-Revisit >25 s, HTML `<button>` in `<button>` Hydration-Warnung im Training-Portrait.

---

## V6 Code-Änderungen (Auszug)

| Bereich | Dateien |
| --- | --- |
| Teams-Bugfix | `FoundationTeamsDetailPanel.tsx`, `FoundationPageClient.tsx` |
| Archive-Scoping | `lib/foundation/tabs/use-season-archive-load.ts`, `FoundationPageClient.tsx` |
| Training XP defer | `FoundationPageClient.tsx` (`requestIdleCallback`) |
| Derivations | `transfermarkt-sale-factor.ts`, `contract-renewal-service.ts`, `season-snapshot-service.ts`, AI/Market-Services |
| Transfermarkt perf | `transfermarkt-local-service.ts` (Ban-Set, compact overlay, cache signature) |
| Portraits lazy | `FoundationPlayerPortraitCard.tsx`, Teams-Roster loading |
| Audit/CI | `foundation-tab-performance-audit.ts` (V6 docs, Teams-Fallback), `perf-regression-smoke.ts`, `export-performance-audit.ts` |

---

## Nächste Hebel (post-V6)

| Prio | Thema | Hebel |
| --- | --- | --- |
| P0 | Spieler → Training `/api/singleplayer-state` | verbleibende Full-Load-Trigger identifizieren |
| P1 | Free-Agent Cold-Build | lazy Base-Cache / Slice-API statt 2658× Full-Item |
| P1 | Training `<button>` nesting | Portrait-Card vs. Intensity-Rail |
| P2 | Sponsoren-Audit-Selector | `data-testid` / Subtab-Routing |
| P2 | Season-Snapshots Slice-API | Option B aus V6-Plan (ohne Full-Reload) |
