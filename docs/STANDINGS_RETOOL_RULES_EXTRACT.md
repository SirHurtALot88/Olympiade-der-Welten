# Standings Retool Rules Extract

## Zielversion
- aktuelle Online-App
- kein Fame
- keine Draws
- keine Allianzen
- keine Paarungen als Saisonstandsgrundlage
- globales Gesamtscoring aller Teams

## Confirmed

### 1. Matchday score path
- Quelle: Retool-Referenzen / Extrakte
- Query/State: `updateCurrentScoreX10Query` und zugehoerige Score-Spuren
- Regel: confirmed
- Apply-relevant: yes
- Paraphrase:
  - `base_score_x_10`
  - `form_points_x_10`
  - `trait_points_x_10`
  - `captain_boost_x10`
  - `current_score_x10`
  - `total_score_x_10`
  sind echte produktive Score-Bausteine.

### 2. Global ranking basis
- Quelle: fachliche Klarstellung des Users plus aktuelle Preview-Architektur
- Query/State: MatchdayResult / DisciplineResult + globale Sortierung
- Regel: confirmed
- Apply-relevant: yes
- Paraphrase:
  - Alle Teams spielen gleichzeitig gegeneinander.
  - `totalScore desc` ist die globale Ranking-Basis pro Matchday.

### 3. Saisonstand-/Punktetabelle darf aus Sheets kommen
- Quelle: User-Kontext + Sheet-Audit-Pfad
- Query/State: `season-standings.csv` / `season-standings.json`
- Regel: confirmed
- Apply-relevant: yes
- Paraphrase:
  - Punkte, Rang und Cash duerfen direkt aus einem belastbaren Saisonstand-/Sheet-Export gelesen werden.

## Likely but not yet confirmed enough

### 4. Rank-to-points mapping
- Quelle: Sheet-/Retool-Hinweise
- Regel: likely
- Apply-relevant: yes
- Paraphrase:
  - Es gibt sehr wahrscheinlich eine Rang-zu-Punkte-Tabelle.
  - Sie ist lokal aber noch nicht als belastbarer Export vorhanden.

## Unclear / blocked

### 5. Tie-breaker bei gleichem totalScore
- Quelle: noch kein belastbarer Export
- Regel: unclear
- Apply-relevant: yes
- Paraphrase:
  - Wenn zwei Teams denselben `totalScore` haben, fehlt noch die bestaetigte Reihenfolge fuer den Tie-Breaker.

### 6. Before/after standings snapshots
- Quelle: noch kein belastbarer Export
- Regel: unclear
- Apply-relevant: yes
- Paraphrase:
  - Vorher-/Nachher-Saisonstand fuer Matchday 1 fehlt als echter Retool-/Sheet-Snapshot.

## offline_legacy_only
- Fame
- Draws
- wins/losses aus Paarungslogik
- `alliance_matchups`
- `alliance_team_scores`
- Pairings / Matchups
- `points_for`
- `points_against`

Diese Begriffe duerfen in der aktuellen Standings Preview nicht mehr aktiv als produktive Regel genutzt werden.
