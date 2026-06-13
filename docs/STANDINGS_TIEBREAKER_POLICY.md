# Standings Tiebreaker Policy

## Aktive Online-Version

- globales Gesamtscoring aller Teams
- kein Fame
- keine Draws
- keine Allianzen
- keine Paarungen

Tie-Breaker duerfen sich in dieser App deshalb nur auf die globale Rangliste beziehen.

## Optionen

### Option A — Blockierend

- Bei echtem Gleichstand bleibt Apply blockiert.
- Preview darf den Gleichstand anzeigen.
- Keine fachliche Entscheidung ohne bestaetigte Regel.
- Code-Modus: `block_on_tie`
- aktueller Default: **ja**

### Option B — Shared Rank

- Gleiche `projectedPoints` teilen sich denselben Rang.
- Danach muesste explizit definiert werden, ob Folgeplaetze geskippt werden oder nicht.
- Ohne bestaetigte Regel nicht aktivieren.
- Code-Modus: `shared_rank`
- vorbereitet, aber nicht aktiv
- moegliche Rangstile:
  - competition ranking: `1, 2, 2, 4`
  - dense ranking: `1, 2, 2, 3`

### Option C — Deterministische technische Sortierung

- nur fuer stabile UI-Anzeige
- moegliche Reihenfolge:
  - `projectedPoints desc`
  - `totalScore desc`
  - `matchdayRank asc`
  - `currentRank asc`
  - `teamName asc`
- das darf ohne Fachfreigabe nicht als offizieller Saisonstand gelten
- Code-Modus: `deterministic_sort`
- vorbereitet, aber nicht aktiv

## Aktuelle App-Entscheidung

- Es gibt keine bestaetigte offizielle Retool-/Sheet-Regel fuer Saisonstand-Ties.
- Fuer diese App gilt deshalb jetzt bewusst:
  - `projectedPoints desc`
  - bei gleichen `projectedPoints`: `matchdayScore/totalScore desc`
  - nur wenn `projectedPoints` **und** `matchdayScore/totalScore` gleich sind, bleibt der Tie blockierend
- kein TeamCode-Tiebreaker
- kein `shared_rank`
- keine Cash-/Prize-Auswirkungen in diesem Block

## Konsequenz

- Preview und Apply duerfen bei gleichem `projectedPoints`, aber unterschiedlichem `matchdayScore`, normal weiterlaufen.
- Preview und Apply bleiben blockiert bei echtem Doppel-Gleichstand:
  - gleicher `projectedPoints`
  - gleicher `matchdayScore/totalScore`
- Smoke-Skripte duerfen diesen Restblocker nicht mit kuenstlichen Punkt- oder Score-Mutationen umgehen.
- Wenn ein lokaler End-to-End-Smoke an einem echten Doppel-Gleichstand haengen bleibt, muss er das als erwarteten Policy-Blocker ausgeben.

## Zentraler Konfigurationspunkt

- `lib/standings/standings-tiebreaker-policy.ts`
- exports:
  - `StandingsTieBreakerMode`
  - `DEFAULT_STANDINGS_TIEBREAKER_MODE`
  - `resolveProjectedRankWithTiePolicy(...)`
  - `detectStandingTieGroups(...)`

Preview und Apply muessen dieselbe Policy nutzen.
