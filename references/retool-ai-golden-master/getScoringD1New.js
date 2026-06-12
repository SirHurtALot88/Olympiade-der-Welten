// term: captain_boost_x10
// id: getScoringD1New
// type: datasource
// subtype: SqlQueryUnified
// page: Einsatzliste
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: selectSpieltag.value
// extractionStatus: complete_or_primary_match
-- D2 Team Scoring - Basis PPs + Bonus (Mutator/200) with corrected aliasing
-- D2 Team Scoring - Basis PPs + Bonus PPs (Mutator/200)
WITH lineup_data AS (
  SELECT 
    team_code,
    base_score_x_10,
    form_points_x_10,
    current_score_x10,
    captain_boost_x10,
    COALESCE(trait_points_x_10, 0) AS trait_points_x_10,
    player_names_csv,
    disziplin_name
  FROM lineup
  WHERE spieltag = {{ selectSpieltag.value }}
    AND disziplin_nr = 2
    AND team_code IS NOT NULL
    AND TRIM(team_code) != ''
    AND team_code NOT IN ('NAT','KH','nat','kh')
),
ranked AS (
  SELECT 
    ld.team_code,
    ld.disziplin_name,
    ld.base_score_x_10,
    ld.current_score_x10,
    ld.captain_boost_x10,
    ld.form_points_x_10,
    ld.trait_points_x_10,
    RANK() OVER (ORDER BY ld.base_score_x_10 DESC) AS rank_base,
    RANK() OVER (
      ORDER BY (
        COALESCE(ld.current_score_x10, ld.base_score_x_10)
        + ld.form_points_x_10
        + ld.captain_boost_x10
        + ld.trait_points_x_10
      ) / 10.0 DESC
    ) AS rank_total,
    cardinality(ARRAY_REMOVE(string_to_array(ld.player_names_csv, ','), '')) AS player_count
  FROM lineup_data ld
)
SELECT 
  COALESCE(tn.team_name, r.team_code) AS team_name,
  r.team_code,
  r.base_score_x_10 / 10.0 AS base_score,
  COALESCE(r.current_score_x10, r.base_score_x_10) / 10.0 AS current_score,
  (COALESCE(r.current_score_x10, r.base_score_x_10) - r.base_score_x_10) / 10.0 AS loss,
  r.captain_boost_x10 / 10.0 AS captain_bonus,
  r.form_points_x_10 / 10.0 AS form,
  r.trait_points_x_10 / 10.0 AS mutator,
  (COALESCE(r.current_score_x10, r.base_score_x_10) + r.form_points_x_10 + r.captain_boost_x10 + r.trait_points_x_10) / 10.0 AS total,
  r.rank_base,
  r.rank_total,
  (r.rank_base - r.rank_total) AS rank_diff,
  r.player_count,
  CASE r.player_count
    WHEN 2 THEN COALESCE(pt."2_Players", 0)
    WHEN 3 THEN COALESCE(pt."3_players", 0)
    WHEN 4 THEN COALESCE(pt."4_players", 0)
    WHEN 5 THEN COALESCE(pt."5_players", 0)
    WHEN 6 THEN COALESCE(pt."6_players", 0)
    ELSE 0
  END AS team_pps_base,
  ROUND((r.trait_points_x_10 / 200.0)::numeric, 2) AS bonus_pps,
  (
    CASE r.player_count
      WHEN 2 THEN COALESCE(pt."2_Players", 0)
      WHEN 3 THEN COALESCE(pt."3_players", 0)
      WHEN 4 THEN COALESCE(pt."4_players", 0)
      WHEN 5 THEN COALESCE(pt."5_players", 0)
      WHEN 6 THEN COALESCE(pt."6_players", 0)
      ELSE 0
    END
    + (r.trait_points_x_10 / 200.0)
  ) AS pps
FROM ranked r
LEFT JOIN (
  SELECT DISTINCT kurzel AS team_code, mannschaft AS team_name
  FROM "Saisonstand"
  WHERE mannschaft IS NOT NULL
) tn ON tn.team_code = r.team_code
LEFT JOIN "Puntktetabelle" pt ON pt."Rank" = r.rank_total
ORDER BY r.rank_total ASC;
