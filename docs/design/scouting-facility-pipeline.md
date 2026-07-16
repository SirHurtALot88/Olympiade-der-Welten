# Scouting Facility Pipeline

Scouting Office ersetzt Scout-Anstellung. Kapazität und Tick-Geschwindigkeit kommen aus der Facility; Spieler werden über Watchlist, Wishlist-Mirror oder passive Bedarfs-Scouts beobachtet.

## Kernloop

- `seasonState.scoutIntelByTeamId` speichert `certainty` 0–100 pro Team/Spieler
- `effectiveScoutingLevel = min(5, facilityLevel + floor(certainty / 25))`
- Tick nach jedem Matchday-Advance und einmal in Pre-Season

## Slot-Kapazität

| Scouting L | Slots | Intel/Tick | Passive Scouts |
|---|---|---|---|
| 1 | 2 | +8 | 0 |
| 3 | 5 | +12 | 2 |
| 5 | 8 | +18 | 4 |

## Priorität

1. Watchlist (manuell)
2. Wishlist-Mirror
3. Passive Bedarfs-Scouts (Markt-Fit)

Kein Hire-UI.
