# Transferfenster / Market Timing Policy V1

## Ziel
Transfers bleiben ein eigener lokaler Schritt und laufen nicht versteckt im Spieltags-Flow mit.

## V1-Regel
- AI-Market-Apply laeuft nie automatisch im Matchday Auto-Run.
- Transfers sind von Result Apply, Standings Apply und Cash Apply getrennt.
- AI-Market-Apply braucht zwei explizite Freigaben:
  - Confirm-Token
  - `transferPhase=manual_transfer_window`
- `source=prisma` bleibt read-only.

## Timing
- Matchday Auto-Run:
  - AI-Lineups
  - Resolve Preview
  - Result Apply
  - Standings Preview/Apply
  - Prize Preview
  - Cash Apply
  - Matchday Advance
- Transferphase:
  - manuelle Buy/Sell-Aktionen
  - AI Market DryRun
  - AI Market Execute nur mit expliziter Transferphase

## Historie
- Jede lokale Transferhistorie behaelt:
  - `seasonId`
  - optional `matchdayId`
  - optional `phase`
- In V1 wird lokal `phase=manual_transfer_window` geschrieben.

## Nicht Teil von V1
- keine Auto-Kaeufe waehrend Matchday Auto-Run
- keine Auto-Verkaeufe waehrend Matchday Auto-Run
- keine neuen Preisformeln
- keine Prisma-Writes
