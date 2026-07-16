# Commit-Vorbereitung — Foundation Nav-UX Abschluss

**Branch-Stand:** ~115 geänderte/untracked Dateien · **nicht committed** (auf Anfrage committen)

## Empfohlene Commits (2 logische Blöcke)

### Commit 1 — Navigation & Economy UI

```bash
git add \
  app/foundation/FoundationPageClient.tsx \
  app/foundation/globals.css app/globals.css \
  app/foundation/shell/FoundationSidebar.tsx \
  app/foundation/season-v2/SeasonStandingsV2Client.tsx \
  app/foundation/transfer-history-v2/TransferHistoryV2Client.tsx \
  app/foundation/matchday-arena-v2/MatchdayArenaV2Client.tsx \
  app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx \
  app/foundation/player-profile/ app/foundation/team-profile/ \
  app/foundation/home-v2/ app/foundation/inbox-v2/ \
  app/foundation/scouting-center-v2/ app/foundation/facilities-overview-v2/ \
  lib/foundation/foundation-sidebar-order.ts \
  lib/foundation/foundation-navigation-history.ts \
  lib/foundation/use-foundation-keyboard-navigation.ts \
  lib/foundation/foundation-view-routing.ts \
  tests/foundation-sidebar-order.test.ts \
  tests/foundation-page-surfaces-contract.test.ts \
  tests/foundation-v2-only-ui-contract.test.ts \
  tests/game-inbox-ui-contract.test.ts \
  docs/pm-briefings/SPIELBAR-STATUS.md

git commit -m "$(cat <<'EOF'
feat(foundation): sidebar order, economy stack, intuitive entity navigation

Single-click player/team profiles, keyboard back via navigation history,
sidebar drag-order persistence, and stacked MW/salary deltas across roster surfaces.
EOF
)"
```

### Commit 2 — V2-only Härtung & Cleanup

```bash
git add \
  app/foundation/FoundationPageClient.tsx \
  app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx \
  lib/foundation/foundation-nav-config.ts \
  tests/foundation-v2-only-ui-contract.test.ts

# Duplicate entfernt:
git add -u "lib/ai/ai-legacy-lineup-engine 2.ts"

git commit -m "$(cat <<'EOF'
refactor(foundation): remove classic home/season panels and dead cross-nav props

Classic home and season UIs removed; legacy view URLs redirect to V2.
Unused onOpenClassic* / onOpenHomeV2 props dropped from V2 clients.
EOF
)"
```

### Restlicher Branch (separater Commit/PR empfohlen)

Game-Logic, AI, Transfermarkt-Services, Training, Tests außerhalb Foundation-UI — z. B.:

- `lib/ai/*`, `lib/market/*`, `lib/training/*`, `lib/foundation/gm-story.ts`
- `tests/organic-season-progression.test.ts`, `tests/transfermarkt-*.test.ts`, …

## QA-Status

| Check | Ergebnis |
|-------|----------|
| Foundation contract tests (6 Dateien) | ✅ 17 Tests grün |
| `npm run build` | ⚠️ TS-Fehler in `lib/sponsor/sponsor-commercial-rating-service.ts` (pre-existing, nicht Foundation-UI) |
| Manueller 15-Min-Smoke | Dokumentiert in SPIELBAR-STATUS.md |

## PR-Summary (Vorschlag)

**Title:** `feat(foundation): V2-only navigation UX — single-click profiles, classic panels removed`

**Summary:**
- Sidebar links reorderable per group (localStorage)
- Player/team names open profile pages on single click across Foundation, Season V2, History, Arena, Lineup
- Classic home and classic season panels removed; `home`/`season` URLs redirect to V2
- Dead cross-nav props removed; Escape/Backspace uses navigation history
- MW/salary deltas stacked under values in team roster

**Test plan:**
- [ ] Sidebar reorder persists after reload
- [ ] Home → player name → profile → Escape back
- [ ] Teams roster → MW/Gehalt delta under value
- [ ] Season V2 → team name → team profile; row click still shows roster
- [ ] Full solo loop: Training → Lineup → Arena → advance
