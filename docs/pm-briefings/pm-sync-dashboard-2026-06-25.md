# PM-Dashboard — Sync 2026-06-25 (nach Ship-WIP)

## Git

| Item | Status |
|------|--------|
| Remote `main` | @ `57fdd71` — V2 previews + TM stabilizations |
| Feature-WIP | **Committed & gepusht** auf Feature-Branches (kein dirty Gameplay/UI-Blocker mehr lokal) |
| PM-Docs | Branch `pr/pm-sync-update-2026-06-25` / PR [#1](https://github.com/SirHurtALot88/Olympiade-der-Welten/pull/1) |

## PR-Stand (4 offene PRs — noch nicht gemerged)

| PR | Titel | Branch | Merge |
|----|-------|--------|-------|
| [#1](https://github.com/SirHurtALot88/Olympiade-der-Welten/pull/1) | docs: PM hub briefings and playtest triage | `pr/pm-briefings-sync` | **OPEN** |
| [#2](https://github.com/SirHurtALot88/Olympiade-der-Welten/pull/2) | fix: transfermarkt negotiation and team sync (playtest P0) | `pr/ui-fixes-transfermarkt-negotiation` | **OPEN** |
| [#3](https://github.com/SirHurtALot88/Olympiade-der-Welten/pull/3) | feat: Gameplay Phase 1 — form cards, modifier sources, resolve v2 | `pr/gameplay-formcards-resolve-v2` | **OPEN** |
| [#4](https://github.com/SirHurtALot88/Olympiade-der-Welten/pull/4) | feat: slot-role scoring bridge, board reward apply, transfer window policy | `pr/gameplay-slotroles-board-season` | **OPEN** |

**Ship-Notiz:** Playtest-P0-Fixes und Gameplay Phase 1 liegen als saubere Commits auf den Branches (`99c0858`, `c177d16` / `fa48bf4`, `341d139`); Merge-Reihenfolge: **#2 → #3 → #4** (UI vor Arena-Flow), **#1** Docs jederzeit.

## Re-Playtest (User — noch offen)

Nach Merge von **#2–#4** erneut durchspielen — Checkliste: [playtest-checklist.md § Re-Test nach Merge](./playtest-checklist.md#re-test-nach-merge).

| Punkte | Thema | Status |
|--------|-------|--------|
| 2–4 | Ownership, Verhandlung, Arena | **Offen für User** (Fixes nur auf PR-Branches) |
| 6 | V2 Previews / Saisonende | **Offen** (Playtest bei Arena-Blocker abgebrochen) |

Triage unverändert: [playtest-triage-2026-06-25.md](./playtest-triage-2026-06-25.md)

## Tab-Routing (aktualisiert)

| Tab | Auftrag | Priorität |
|-----|---------|-----------|
| **UI Fixes** | PR #2 mergen → User Re-Test 2–3 | P0 |
| **Gameplay** | PR #3/#4 mergen → User Re-Test 4 | P0 |
| **UI Top-100** | **#35–39 Einsatzliste** — **in progress** (nach Arena-P0 grün, siehe [briefing-ui-fixes-next.md](./briefing-ui-fixes-next.md)) | P1 |
| **Balancing** | Audit nach Arena grün | P2 |
| **Zocken** | Re-Test 2–4 + 6 nach Merge | — |
| **Extern** | **Deploy-Gate geschlossen** | Gate offen |

## Deploy-Gate

Per [docs/EXTERN_DEPLOY_READINESS.md](../EXTERN_DEPLOY_READINESS.md):

1. Zocken-Checkliste grün (inkl. Re-Test nach Merge)
2. Balancing Block 1+2 ohne RED
3. PRs #2–#4 gemerged + `main` gepusht
4. Docker-Build + gehosteter Hard-Reload

**Status:** Deploy **gestoppt** bis Re-Playtest + Merge auf `main`.

## Tests (Referenz)

- Kern auf `main`: grün (Stand vor Feature-PRs)
- Feature-Branches: gezielte Vitest-Läufe in PR-Bodies (#2 UI contract, Gameplay-Tests in #3/#4)

## Nächste Entscheidungen (User)

1. PR #2–#4 reviewen/mergen — Reihenfolge OK?
2. Nach Merge: **Re-Test nach Merge** in [playtest-checklist.md](./playtest-checklist.md) abhaken
3. Top-100 **#35–39** starten sobald Punkt 4 grün

## Briefings

- [UI Fixes P0](./briefing-ui-fixes-next.md)
- [Gameplay P0 Arena](./briefing-gameplay-phase1.md)
- [Playtest-Checkliste](./playtest-checklist.md)
