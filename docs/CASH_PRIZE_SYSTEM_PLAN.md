# Cash Prize System Plan

## Trennung der Systeme
- Transfermarkt-Cash
- Matchday-/Saisonstand-Punkte
- Season-End-Preisgeld

Diese drei Bereiche duerfen nicht vermischt werden.

## Confirmed
- Buy reduziert Cash
- Sell erhoeht Cash
- Preisgeld laeuft jetzt als eigener read-only Preview-Pfad ueber `prize-money-table`
- `projectedCash = currentCash + prizeMoney + bonus - malus`, wenn die Tabelle diese Felder liefert
- die gemischte Preisgeldquelle wird jetzt zuerst analysiert und auf einen eindeutigen Rang-/Preisgeldblock normalisiert
- der Parser bevorzugt:
  - `prize-money-table.normalized.json/csv`
  - faellt sonst auf den Roh-Export zurueck
  - blockiert bei Mehrdeutigkeit weiter sauber

## Read-only Preview
- Quelle:
  - `references/sheets/prize-money-table.csv`
  - `references/sheets/prize-money-table.json`
  - `references/sheets/prize-money-table.normalized.csv`
  - `references/sheets/prize-money-table.normalized.json`
- read-only API:
  - `/api/season/prize-preview`
- UI:
  - Tab `Preisgeld`
- Bonus/Malus:
  - wenn Spalten fehlen, werden sie als `0` behandelt
  - das wird als globale Warning dokumentiert, nicht 32-fach pro Team
  - einzelne Teams bekommen nur noch team-spezifische Warnings wie fehlendes Preisgeld fuer einen Rang oder unsicheren Rang wegen offenem Tie-Breaker

## Noch blockiert
- Preisgeld-Apply
- Season-End-Cash-Write
- before/after Season-End-Cash-Snapshots
- vollstaendige Golden-Master-Verifikation fuer echte Season-End-Auszahlung
- Tie-Breaker-abhaengige Endplatzierung, solange die Standings Preview selbst noch blockiert ist

## Wichtig
- Transfermarkt-Cash bleibt sofortiger Economy-Pfad.
- Prize Money bleibt Season-End-/Placement-Pfad.
- Standings Apply und Cash Apply bleiben getrennt.

## offline_legacy_only
- Fame-gekoppelte Economy-Annahmen
- Allianz-/Paarungsabhaengige Preislogik
