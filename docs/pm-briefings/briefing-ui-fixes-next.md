# Tab-Briefing: UI Fixes — Playtest P0 (Transfermarkt)

**Projekt:** Olympiade der Welten  
**Tab:** UI Fixes  
**Priorität:** **P0** — vor Top-100 #35–39  
**Quelle:** [playtest-triage-2026-06-25.md](./playtest-triage-2026-06-25.md)

## Kontext

User (H-R) Playtest: Kaufdialog öffnet bei **fremden Teams**; Verhandlung Tentacle — kein Malus/Banner, TM reload beim Schließen, langsames Gehalts-Preview, Reopen ohne „angefressen".

## Scope

### 1. Ownership-Gate Classic Market

| Problem | Fix |
|---------|-----|
| Buy-Button enabled sobald `marketTeamId` gesetzt | `disabled` wenn `!canManageTeamId(marketTeamId)` |
| Modal öffnet trotzdem | `openMarketBuyModal`: Gate **vor** `setMarketBuyModalOpen(true)` — Fehlerbanner, kein Modal |

**Dateien:** `FoundationPageClient.tsx` (~7446–7473, ~31696)

### 2. Verhandlung UX

| Problem | Fix |
|---------|-----|
| Abbrechen → keine Meldung | Malus-Banner sichtbar halten; `setMarketBuyError` / inline callout im TM, nicht nur nach close |
| TM lädt komplett neu | `closeMarketBuyModal` / market reload entkoppeln — kein `reloadMarketFeed` on close |
| Reopen ohne „angefressen" | Beim Preview-Load negotiation history lesen → Banner wie V2 `previous_rejected_offer_reduces_trust` |

**Dateien:** `FoundationPageClient.tsx` (~7480–7498), `TransfermarktV2Client.tsx` (~2249–2274), `contract-negotiation-preview.ts`

### 3. Preview-Performance

- Loading state während `requestTransfermarktBuyPreview`
- Kein leeres Modal ohne Skeleton

## Akzeptanz

- [ ] Fremdes Team: kein Modal, Meldung „gehört nicht zu deinen steuerbaren Teams"
- [ ] Tentacle-Flow: Abbrechen → sichtbare Meldung; Reopen → „angefressen" wenn Malus aktiv
- [ ] Modal schließen → kein Full-Page TM-Reload
- [ ] `npx vitest run tests/foundation-transfermarkt-ui-contract.test.ts` grün

## Danach (P1)

Top-100 #35–39 Einsatzliste — **erst nach Arena-P0 grün**

## Nicht anfassen

- `game-flow-controller.ts`, Arena-API (Gameplay Tab)
- Board-Ziel Gehaltsdruck 45% (Gameplay/Balancing)
