# Cash Prize Apply Plan

## Status

Cash-/Preisgeld-Apply ist bewusst noch **nicht** implementiert.

Die Preisgeld-Vorschau ist read-only und bleibt getrennt von Standings Apply.

## Trennung

- Standings Apply aktualisiert spaeter nur Standings-Zielfelder.
- Cash Apply aktualisiert spaeter nur Cash-/Preisgeld-Zielfelder.
- Transfermarkt-Cash bleibt ein eigener sofortiger Economy-Pfad.

## Inputs

- Prize Money Preview
- `currentCash`
- `projectedCash`
- `projectedRank`
- Scope Keys:
  - `saveId`
  - `seasonId`
- optional:
  - `applyKey`
  - spaeter `seasonEnd` oder fachlich definierter Endstand-Scope
- optional spaeter:
  - Season-End-Kennung oder Apply-Laufkennung

## Erlaubte spaetere Writes

- Zieltabelle:
  - `TeamSeasonState`
- erlaubtes Feld:
  - `cash`
- Scope:
  - nur Datensaetze fuer genau ein `saveId + seasonId`
- Audit:
  - eigenes `CashPrizeApplyLog` oder gleichwertiger Auditpfad empfohlen
  - ohne eigenes Auditmodell bleibt Execute weiter blockiert oder nur nach spaeterer expliziter Freigabe moeglich

## Nicht erlaubt

- keine Aenderung an Standings-Raengen
- keine Aenderung an Standings-Punkten
- keine Transferhistorie-Aenderung
- keine `ActivePlayer`-Aenderung
- keine Matchday-Result-Writes
- keine SQLite-Writes
- keine AI-Writes

## Gates

Cash Apply darf spaeter erst freigeschaltet werden, wenn alle Punkte erfuellt sind:

- normalisierte Preisgeldtabelle gueltig
- `projectedCash` fuer alle Teams berechenbar
- Standings `projectedRank` stabil
- kein Tie-Breaker-Blocker offen
- keine ambigen Team-Mappings
- keine doppelten Preisgeld-Raenge
- dry-run Preview vorhanden und plausibel
- Standings Apply bereits durchgefuehrt oder fachlich nicht noetig

## Idempotenz

- Season-End-Cash-Apply nur einmal pro `saveId + seasonId`
- `forceReplace` nur explizit
- spaeter nur Ersatz desselben Season-End-Scopes, nie fremder Saves oder Seasons

## API-Contract spaeter

Geplant:

- `POST /api/season/cash-prize-apply`
- `dryRun: true` als Default
- `dryRun: false` erst nach gruener Gate-Pruefung

## Aktueller Skeleton-Stand

- `lib/season/cash-prize-apply-service.ts`
- `POST /api/season/cash-prize-apply`
- `scripts/smoke-cash-prize-apply.ts`

Aktuell weiterhin hart blockiert bei:

- `global_score_tie_breaker_missing`
- fehlendem `projectedCash`
- ambigen Team-Mappings
- noch nicht freigegebener Execute-Phase

## Wichtig

- aktuell kein Execute
- kein stiller Write
- keine Heuristik
