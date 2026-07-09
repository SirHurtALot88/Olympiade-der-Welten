# Season-Flow Playtest-Protokoll

Manuelles Gate für Leertaste-Gameflow, Transferfenster-Regeln und optionale Gebäude.

## Voraussetzungen

- Lokaler Dev-Server (`npm run dev`)
- SQLite-Save mit human-controlled Team
- Browser: Foundation Shell, aktives Manager-Team

## Preseason (Transferfenster offen)

1. **Sell** — Leertaste führt zu Spieler verkaufen / Transfer-Kader
2. **Buy** — Leertaste führt zum Transfermarkt
3. **Facilities (optional)** — Schritt erscheint bei affordable Upgrade; Leertaste überspringbar
4. **Training** — Trainingsplan setzen
5. **Season-Start** — `prepare_season` / Spieltag 1

**Gate:** Kein Mid-Season-Transfer-Schritt in dieser Phase außerhalb des Fensters.

## Mid-Season (Spieltag 2–N)

Pro Spieltag nach Arena-Ergebnis:

1. `review_matchday_results`
2. `open_season_standings`
3. `matchday_facilities` (optional, überspringbar)
4. `advance_to_next_matchday`

**Gate:** Kein `matchday_sell_players` / `matchday_buy_players` in Flow-Panel oder Leertaste.

## Season-Ende

1. Player Development / Rewards bestätigen
2. Preseason-Schritte erneut (Sell → Buy → Facilities skip → Training)
3. Nächste Season starten

## Inbox-Regeln

- `transfer_buy_candidate` und `transfer_candidate` nur bei offenem Transferfenster
- `captain_missing` wenn Kader voll, Lineup komplett, kein Captain

## Automatische Contracts

```bash
npm test -- tests/foundation-gesamtkonzept-contract.test.ts tests/resolve-game-flow-action-step.test.ts tests/foundation-save-resilience.test.ts
```
