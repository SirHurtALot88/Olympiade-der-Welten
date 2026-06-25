# PM-Dashboard — Sync 2026-06-25 (nach Playtest)

## Git

| Item | Status |
|------|--------|
| Remote | `main` @ `57fdd71` (gepusht) |
| Working tree | **Dirty** — Gameplay + UI parallel (Phase 1 + Transfermarkt) |
| PM-Docs | `docs/pm-briefings/` untracked |

## Playtest-Ergebnis (User H-R)

| # | Thema | Ergebnis |
|---|-------|----------|
| 1 | TM Buy | OK classic/V2; Wishlist untestbar (Kader voll) |
| 2 | Ownership | **P0 BUG** — Buy bei fremden Teams |
| 3 | Verhandlung | **P0 BUG** — kein Malus/Banner, TM reload, langsam |
| 4 | Arena | **P0 BLOCKER** — Lineup+Formkarten, keine Arena |
| 5 | GM/Hot Seat | Design: Gehaltsdruck 45% zu hart S1; Hot Seat = Online only |
| 6 | V2 Previews | Offen (Playtest abgebrochen) |

**Triage:** [playtest-triage-2026-06-25.md](./playtest-triage-2026-06-25.md)

## Tab-Routing (aktualisiert)

| Tab | Auftrag | Priorität |
|-----|---------|-----------|
| **UI Fixes** | TM Ownership + Verhandlung UX | P0 |
| **Gameplay** | Arena-Flow + Board Gehaltsdruck S1 | P0 / P1 |
| **Balancing** | Audit nach Arena grün | P2 |
| **Zocken** | Re-Test 2–4 nach Fixes | — |
| **Extern** | Deploy gestoppt | Gate offen |

## Tests (letzter Lauf)

- Kern vor WIP: 39/39 grün
- Mit dirty tree: 6 fails (game-flow-controller WIP erwartet)

## Nächste Entscheidungen (User)

1. UI Fixes zuerst (TM) **oder** Gameplay zuerst (Arena)?
2. Gehaltsdruck-Ziel S1 lockern — ja/nein / Zielwert?
3. Commit PM-Briefings + `.cursor/rules/` — auf Wunsch

## Briefings

- [UI Fixes P0](./briefing-ui-fixes-next.md)
- [Gameplay P0 Arena](./briefing-gameplay-phase1.md)
- [Playtest-Checkliste](./playtest-checklist.md)
