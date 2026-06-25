# Tab-Briefing: Gameplay — Playtest P0 Arena + Board-Ziele

**Projekt:** Olympiade der Welten  
**Tab:** Gameplay  
**Priorität:** **P0 Arena** · P1 Board-Ziele  
**Quelle:** [playtest-triage-2026-06-25.md](./playtest-triage-2026-06-25.md)

## P0 — Arena blockiert (H-R)

**Symptom:** 9/9 Slots + Formkarten gesetzt → Arena nicht erreichbar.

### Diagnose-Checkliste

1. `activeLineup.status` — braucht `submitted`/`locked` für `confirm_lineup`?
2. `trainingComplete` — blockiert `set_lineup` noch?
3. `assign_formcards` — falscher Blocker trotz `hasFormCards`?
4. Arena API: `scoreFeed.status === "blocked"` + `missing_lineups`?

### Fix-Richtung

| Datei | Aufgabe |
|-------|---------|
| `lib/foundation/game-flow-controller.ts` | `open_arena`: wenn `hasLineup && hasFormCards`, Status `ready`; Blocker-Array mit Grund exportieren |
| `app/foundation/FoundationPageClient.tsx` | Flow-Coach zeigt Blocker-Text; Arena-CTA nicht verstecken ohne Grund |
| `app/foundation/matchday-arena/*` | Blockier-Meldung user-facing statt generisch |

**Akzeptanz:** H-R Save → nach Lineup+Formkarten → Arena öffnet oder zeigt **konkreten** Blocker.

---

## P1 — Board-Ziel Gehaltsdruck S1

**User-Feedback:** „Gehaltsdruck auf 45% senken" zu hart in Season 1, besonders H-R (aggressiv, wenig Puffer).

| Datei | Option |
|-------|--------|
| `lib/board/team-season-objectives-service.ts` (~222–255) | S1: höheres targetRatio (z.B. 0.55) oder Objective nur ab S2 |
| Tests | `team-season-objectives-service.test.ts` anpassen |

**Design:** Hot Seat / GM-Druck — Singleplayer vorerst ohne Hot-Seat-Gate; Online später.

---

## Weiter Phase 1.2 (nach P0)

Formkarten-Hauptfluss — siehe Roadmap Phase 1.2 wenn Arena grün.

## Nicht anfassen

- Transfermarkt Modal/Ownership (UI Fixes)
- Einsatzliste Mikro-UX #35–39 (UI Fixes)
