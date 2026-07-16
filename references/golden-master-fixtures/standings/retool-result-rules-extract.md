# Retool Result Rules Extract

## Current app version only
- Diese App nutzt **globales Gesamtscoring aller Teams**.
- Alle Teams werden pro Matchday gemeinsam nach `totalScore` gerankt.
- `base_score_x_10`, `form_points_x_10`, `trait_points_x_10`, `captain_boost_x10`, `current_score_x10` und `total_score_x_10` sind als echte Score-Spuren bestaetigt.

## Confirmed
- `total_score_x_10` ist die relevante Matchday-Gesamtscore-Spur.
- Saisonstand-/Punktetabellen duerfen direkt aus Sheet-/Retool-Exporten gemappt werden.
- Die aktuelle Preview darf nur confirmed globale Score-Daten anzeigen.

## offline_legacy_only
- `alliance_matchups`
- `alliance_team_scores`
- Fame in `points`
- Draws
- Paarungen / Matchups

Diese Spuren gehoeren nicht zur aktiven Online-App-Version und duerfen fuer die aktuelle Saisonstand-Preview nicht mehr verwendet werden.

## Still missing for apply-safe standings
- Rang-zu-Punkte-Tabelle
- confirmed Tie-Breaker bei gleichem `totalScore`
- Before/after-Saisonstand-Snapshots fuer Matchday 1
