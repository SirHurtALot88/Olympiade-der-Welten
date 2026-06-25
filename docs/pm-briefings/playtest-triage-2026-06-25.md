# Playtest-Triage — 2026-06-25 (Team H-R)

Quelle: Zocken-Tab Stichpunkte → TOTAL Sync

## Prioritäten

| P | Bug | Tab | Dateien (Start) |
|---|-----|-----|-----------------|
| **P0** | Buy-Modal öffnet bei fremdem Team | **UI Fixes** | `FoundationPageClient.tsx` (~31696 Buy-Button), `TransfermarktV2Client.tsx` (~2220) |
| **P0** | Abort-Verhandlung: keine Meldung, TM reload, kein „angefressen" beim Reopen | **UI Fixes** | `closeMarketBuyModal`, `closeBuyModal`, Preview-Refresh ohne Persist-Read |
| **P0** | Gehalts-Preview langsam | **UI Fixes** | `requestTransfermarktBuyPreview`, loading state |
| **P0** | Arena blockiert trotz Lineup + Formkarten | **Gameplay** | `game-flow-controller.ts`, Arena API, Lineup-Status `submitted` |
| **P1** | Gehaltsdruck 45% Board-Ziel zu hart S1 | **Gameplay/Balancing** | `team-season-objectives-service.ts` (~246) |
| **P2** | Wishlist-Kauf untestbar (voller Kader) | **QA/Script** | `scripts/prove-transfermarkt-ui-buy.ts`, frischer Draft-Save |
| **—** | Hot Seat nur Online-Multiplayer | **Design** | Checkliste SP anpassen; GM-Story optional |

---

## UI Fixes — Sofort-Auftrag

Copy-Paste in **UI Fixes** Tab:

```
Playtest P0 — Transfermarkt Ownership + Verhandlung (Team H-R, Tentacle)

1. Classic market: Buy-Button disabled wenn marketTeamId !== activeManagerTeamId 
   ODER !canManageTeamId(marketTeamId). Kein Modal öffnen — stattdessen 
   showTeamManagementLockedNotice + setMarketBuyError.

2. closeMarketBuyModal / V2 closeBuyModal:
   - Kein full marketFeed reload beim Schließen (nur Preview-State resetten)
   - Abort-Malus: Banner IM Modal vor Schließen oder persistierter Fehler 
     der beim Reopen aus negotiation history gelesen wird
   - Reopen: „Spieler ist noch angefressen" / Vertrauensbruch aus 
     contract-negotiation-preview anzeigen wenn previous_rejected_offer

3. Gehalts-Preview: Spinner/skeleton während requestTransfermarktBuyPreview; 
   keine leere Modal-Phase

Tests: foundation-transfermarkt-ui-contract.test.ts erweitern
Nicht anfassen: lib/resolve, form-card-flow (Gameplay)
```

---

## Gameplay — Sofort-Auftrag

Copy-Paste in **Gameplay** Tab:

```
Playtest P0 — Arena nicht erreichbar (H-R, Lineup 9/9 + Formkarten)

1. Diagnose: Welcher Blocker? 
   - game-flow-controller confirm_lineup vs open_arena
   - activeLineup.status !== submitted/locked?
   - trainingComplete blockiert set_lineup?
   - Arena scoreFeed status blocked + missing_lineups?

2. Fix: Wenn hasLineup + hasFormCards → open_arena ready + sichtbare CTA 
   mit klarem Blocker-Text wenn API noch blockiert

3. UX: Flow-Coach „Arena starten" muss Grund nennen wenn blocked

Optional P1: Gehaltsdruck-Board-Ziel S1 — targetRatio 0.45 zu hart für 
aggressive Teams; Season-1-Variante lockern oder objective skippen.

Tests: game-flow-controller.test.ts, legacy-matchday-resolve.test.ts
```

---

## Balancing (nach Gameplay-P0)

- 5-Run Audit wenn Arena-Flow grün
- Board-Ziel Gehaltsdruck: S1-Schwellen reviewen

## Extern / Deploy

**Gestoppt** bis P0 Playtest grün (Arena + TM Ownership + Verhandlung)

## Nächster Playtest (User)

Nach Fixes: Punkte 2, 3, 4 erneut + Punkt 6 (V2 Previews)
