// term: captain_boost_x10
// id: calculatePlayersD1
// type: datasource
// subtype: SqlQueryUnified
// page: Einsatzliste
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: selectSpieltag.value | (typeof mutatorDiszi2Trait1.value === "string" ? mutatorDiszi2Trait1.value : (mutatorDiszi2Trait1.value?.trait || "")) | (typeof mutatorDiszi2Trait2.value === "string" ? mutatorDiszi2Trait2.value : (mutatorDiszi2Trait2.value?.trait || ""))
// extractionStatus: complete_or_primary_match
-- Calculate player scores for D2 with mutator_bonus as DECIMAL 0.3 per hit; team-level mutator derived downstream from player_season_scores.trait_points.
-- Calculate player scores and PPs for D2 with captain boost included in ranking
-- Ground Truth: per trait hit = 0.3 DECIMAL at player level; team mutator will be SUM(trait_points) * 20 downstream
WITH l AS (
  SELECT team_code, base_score_x_10, form_points_x_10, total_score_x_10, captain_boost_x10, player_names_csv, disziplin_name
  FROM lineup
  WHERE spieltag = {{ selectSpieltag.value }} AND disziplin_nr = 2
    AND team_code IS NOT NULL AND TRIM(team_code) != ''
    AND team_code NOT IN ('NAT','KH','nat','kh')
), with_calculated_base AS (
  SELECT 
    l.team_code,
    l.disziplin_name,
    l.player_names_csv,
    CASE WHEN COALESCE(l.base_score_x_10, 0) = 0 THEN (
      SELECT SUM(
        CASE 
          WHEN l.disziplin_name ILIKE 'TDM' THEN COALESCE(p.tdm, 0)
          WHEN l.disziplin_name ILIKE 'Battlefield' THEN COALESCE(p.battlefield, 0)
          WHEN l.disziplin_name ILIKE 'Basketball' THEN COALESCE(p.basketball, 0)
          WHEN l.disziplin_name ILIKE 'Breaking' THEN COALESCE(p.breaking, 0)
          WHEN l.disziplin_name ILIKE 'Climbing' THEN COALESCE(p.climbing, 0)
          WHEN l.disziplin_name ILIKE 'Eiskunst' THEN COALESCE(p.eiskunstlauf, 0)
          WHEN l.disziplin_name ILIKE 'Fechten' THEN COALESCE(p.fechten, 0)
          WHEN l.disziplin_name ILIKE 'Football' THEN COALESCE(p.football, 0)
          WHEN l.disziplin_name ILIKE 'Gewichtheben' THEN COALESCE(p.gewichtheben, 0)
          WHEN l.disziplin_name ILIKE 'Hockey' THEN COALESCE(p.hockey, 0)
          WHEN l.disziplin_name ILIKE 'I Spy' THEN COALESCE(p.i_spy, 0)
          WHEN l.disziplin_name ILIKE 'Mini%DM' OR l.disziplin_name ILIKE 'Mini DM' THEN COALESCE(p.mini_dm, 0)
          WHEN l.disziplin_name ILIKE 'Schach' THEN COALESCE(p.speed_schach, 0)
          WHEN l.disziplin_name ILIKE 'Showcase' THEN COALESCE(p.showcase, 0)
          WHEN l.disziplin_name ILIKE 'Spurt' THEN COALESCE(p.spurt, 0)
          WHEN l.disziplin_name ILIKE 'Staffel' THEN COALESCE(p.staffel, 0)
          WHEN l.disziplin_name ILIKE 'Takeshi%' THEN COALESCE(p.takeshis_castle, 0)
          WHEN l.disziplin_name ILIKE 'Tennis' THEN COALESCE(p.tennis, 0)
          WHEN l.disziplin_name ILIKE 'Time%Trial' THEN COALESCE(p.time_trial, 0)
          WHEN l.disziplin_name ILIKE 'Wettessen' THEN COALESCE(p.wettessen, 0)
          ELSE 0 END
      ) * 10
      FROM unnest(string_to_array(l.player_names_csv, ',')) AS player_name
      JOIN "Player" p ON TRIM(LOWER(p.name)) = TRIM(LOWER(player_name))
    ) ELSE l.base_score_x_10 END AS base_score_x_10,
    COALESCE(l.form_points_x_10, 0) AS form_points_x_10,
    COALESCE(l.total_score_x_10, 0) AS total_score_x_10,
    COALESCE(l.captain_boost_x10, 0) AS captain_boost_x10
  FROM l
), expanded AS (
  SELECT w.team_code, w.disziplin_name, TRIM(unnest(string_to_array(w.player_names_csv, ','))) AS player_name,
         w.base_score_x_10, w.form_points_x_10, w.total_score_x_10, w.captain_boost_x10
  FROM with_calculated_base w
), player_traits AS (
  SELECT e.team_code, e.disziplin_name, e.player_name, e.base_score_x_10, e.form_points_x_10, e.total_score_x_10, e.captain_boost_x10,
         p.trait_pos_1, p.trait_pos_2, p.trait_pos_3, p.trait_neg_1, p.trait_neg_2, p.trait_neg_3
  FROM expanded e
  JOIN "Player" p ON TRIM(LOWER(p.name)) = TRIM(LOWER(e.player_name))
), selected_traits AS (
  SELECT 
    LOWER(TRIM(COALESCE('{{ (typeof mutatorDiszi2Trait1.value === "string" ? mutatorDiszi2Trait1.value : (mutatorDiszi2Trait1.value?.trait || "")) }}',''))) AS t1,
    LOWER(TRIM(COALESCE('{{ (typeof mutatorDiszi2Trait2.value === "string" ? mutatorDiszi2Trait2.value : (mutatorDiszi2Trait2.value?.trait || "")) }}',''))) AS t2
), selected_nonempty AS (
  SELECT t1, t2, (CASE WHEN t1 IS NOT NULL AND t1 <> '' THEN 1 ELSE 0 END) AS has_t1,
               (CASE WHEN t2 IS NOT NULL AND t2 <> '' THEN 1 ELSE 0 END) AS has_t2
  FROM selected_traits
), team_agg AS (
  SELECT pt.team_code,
         MAX(pt.disziplin_name) AS disziplin_name,
         MAX(pt.base_score_x_10) AS base_score_x_10,
         MAX(pt.form_points_x_10) AS form_points_x_10,
         MAX(pt.total_score_x_10) AS total_score_x_10,
         MAX(pt.captain_boost_x10) AS captain_boost_x10,
         -- Ground Truth on player level: mutator_bonus per hit = 0.3
         SUM(
           (CASE WHEN LOWER(TRIM(pt.trait_pos_1)) <> '' AND ((SELECT has_t1 FROM selected_nonempty)=1 OR (SELECT has_t2 FROM selected_nonempty)=1) AND LOWER(TRIM(pt.trait_pos_1)) IN ((SELECT t1 FROM selected_nonempty), (SELECT t2 FROM selected_nonempty)) THEN 1 ELSE 0 END) +
           (CASE WHEN LOWER(TRIM(pt.trait_pos_2)) <> '' AND ((SELECT has_t1 FROM selected_nonempty)=1 OR (SELECT has_t2 FROM selected_nonempty)=1) AND LOWER(TRIM(pt.trait_pos_2)) IN ((SELECT t1 FROM selected_nonempty), (SELECT t2 FROM selected_nonempty)) THEN 1 ELSE 0 END) +
           (CASE WHEN LOWER(TRIM(pt.trait_pos_3)) <> '' AND ((SELECT has_t1 FROM selected_nonempty)=1 OR (SELECT has_t2 FROM selected_nonempty)=1) AND LOWER(TRIM(pt.trait_pos_3)) IN ((SELECT t1 FROM selected_nonempty), (SELECT t2 FROM selected_nonempty)) THEN 1 ELSE 0 END) +
           (CASE WHEN LOWER(TRIM(pt.trait_neg_1)) <> '' AND ((SELECT has_t1 FROM selected_nonempty)=1 OR (SELECT has_t2 FROM selected_nonempty)=1) AND LOWER(TRIM(pt.trait_neg_1)) IN ((SELECT t1 FROM selected_nonempty), (SELECT t2 FROM selected_nonempty)) THEN 1 ELSE 0 END) +
           (CASE WHEN LOWER(TRIM(pt.trait_neg_2)) <> '' AND ((SELECT has_t1 FROM selected_nonempty)=1 OR (SELECT has_t2 FROM selected_nonempty)=1) AND LOWER(TRIM(pt.trait_neg_2)) IN ((SELECT t1 FROM selected_nonempty), (SELECT t2 FROM selected_nonempty)) THEN 1 ELSE 0 END) +
           (CASE WHEN LOWER(TRIM(pt.trait_neg_3)) <> '' AND ((SELECT has_t1 FROM selected_nonempty)=1 OR (SELECT has_t2 FROM selected_nonempty)=1) AND LOWER(TRIM(pt.trait_neg_3)) IN ((SELECT t1 FROM selected_nonempty), (SELECT t2 FROM selected_nonempty)) THEN 1 ELSE 0 END)
         ) * 0.3 AS trait_points
  FROM player_traits pt
  GROUP BY pt.team_code
), ranked AS (
  SELECT 
    t.team_code,
    t.disziplin_name,
    t.base_score_x_10,
    t.form_points_x_10,
    t.total_score_x_10,
    t.captain_boost_x10,
    -- trait_points here is SUM over team in DECIMAL, but player_season_scores.trait_points is set downstream via saveAllPlayerScoresD२
    t.trait_points,
    RANK() OVER (ORDER BY (t.base_score_x_10 + t.form_points_x_10 + t.captain_boost_x10) / 10.0 + t.trait_points DESC) AS rank_total,
    cardinality(ARRAY_REMOVE(string_to_array(COALESCE(w.player_names_csv,''), ','), '')) AS player_count
  FROM team_agg t
  JOIN with_calculated_base w ON w.team_code = t.team_code
), team_with_pps AS (
  SELECT r.team_code, r.disziplin_name, r.base_score_x_10, r.form_points_x_10, r.total_score_x_10, r.captain_boost_x10, r.trait_points, r.rank_total, r.player_count,
         CASE r.player_count
           WHEN 2 THEN COALESCE(pt."2_Players", 0)
           WHEN 3 THEN COALESCE(pt."3_players", 0)
           WHEN 4 THEN COALESCE(pt."4_players", 0)
           WHEN 5 THEN COALESCE(pt."5_players", 0)
           WHEN 6 THEN COALESCE(pt."6_players", 0)
           ELSE 0
         END AS team_pps_base
  FROM ranked r
  LEFT JOIN "Puntktetabelle" pt ON pt."Rank" = r.rank_total
), expanded_players AS (
  SELECT 
    t.team_code,
    TRIM(unnest(string_to_array(w.player_names_csv, ','))) AS player_name,
    w.disziplin_name,
    t.team_pps_base,
    w.base_score_x_10
  FROM team_with_pps t
  JOIN with_calculated_base w ON w.team_code = t.team_code
), with_player_base AS (
  SELECT 
    e.*,
    CASE
      WHEN e.disziplin_name ILIKE 'TDM' THEN COALESCE(p.tdm, 0)
      WHEN e.disziplin_name ILIKE 'Battlefield' THEN COALESCE(p.battlefield, 0)
      WHEN e.disziplin_name ILIKE 'Basketball' THEN COALESCE(p.basketball, 0)
      WHEN e.disziplin_name ILIKE 'Breaking' THEN COALESCE(p.breaking, 0)
      WHEN e.disziplin_name ILIKE 'Climbing' THEN COALESCE(p.climbing, 0)
      WHEN e.disziplin_name ILIKE 'Eiskunst' THEN COALESCE(p.eiskunstlauf, 0)
      WHEN e.disziplin_name ILIKE 'Fechten' THEN COALESCE(p.fechten, 0)
      WHEN e.disziplin_name ILIKE 'Football' THEN COALESCE(p.football, 0)
      WHEN e.disziplin_name ILIKE 'Gewichtheben' THEN COALESCE(p.gewichtheben, 0)
      WHEN e.disziplin_name ILIKE 'Hockey' THEN COALESCE(p.hockey, 0)
      WHEN e.disziplin_name ILIKE 'I Spy' THEN COALESCE(p.i_spy, 0)
      WHEN e.disziplin_name ILIKE 'Mini%DM' OR e.disziplin_name ILIKE 'Mini DM' THEN COALESCE(p.mini_dm, 0)
      WHEN e.disziplin_name ILIKE 'Schach' THEN COALESCE(p.speed_schach, 0)
      WHEN e.disziplin_name ILIKE 'Showcase' THEN COALESCE(p.showcase, 0)
      WHEN e.disziplin_name ILIKE 'Spurt' THEN COALESCE(p.spurt, 0)
      WHEN e.disziplin_name ILIKE 'Staffel' THEN COALESCE(p.staffel, 0)
      WHEN e.disziplin_name ILIKE 'Takeshi%' THEN COALESCE(p.takeshis_castle, 0)
      WHEN e.disziplin_name ILIKE 'Tennis' THEN COALESCE(p.tennis, 0)
      WHEN e.disziplin_name ILIKE 'Time%Trial' THEN COALESCE(p.time_trial, 0)
      WHEN e.disziplin_name ILIKE 'Wettessen' THEN COALESCE(p.wettessen, 0)
      ELSE 0
    END AS player_base_score
  FROM expanded_players e
  JOIN "Player" p ON TRIM(LOWER(p.name)) = TRIM(LOWER(e.player_name))
), team_totals AS (
  SELECT team_code, SUM(player_base_score)::numeric AS total_base_score
  FROM with_player_base
  GROUP BY team_code
), per_player_mutator AS (
  SELECT 
    wpb.team_code,
    wpb.player_name,
    wpb.player_base_score,
    wpb.team_pps_base,
    tt.total_base_score,
    -- Ground Truth: mutator_bonus per hit = 0.3 DECIMAL
    (
      (CASE WHEN LOWER(TRIM(p.trait_pos_1)) <> '' AND ((SELECT has_t1 FROM selected_nonempty)=1 OR (SELECT has_t2 FROM selected_nonempty)=1) AND LOWER(TRIM(p.trait_pos_1)) IN ((SELECT t1 FROM selected_nonempty), (SELECT t2 FROM selected_nonempty)) THEN 1 ELSE 0 END) +
      (CASE WHEN LOWER(TRIM(p.trait_pos_2)) <> '' AND ((SELECT has_t1 FROM selected_nonempty)=1 OR (SELECT has_t2 FROM selected_nonempty)=1) AND LOWER(TRIM(p.trait_pos_2)) IN ((SELECT t1 FROM selected_nonempty), (SELECT t2 FROM selected_nonempty)) THEN 1 ELSE 0 END) +
      (CASE WHEN LOWER(TRIM(p.trait_pos_3)) <> '' AND ((SELECT has_t1 FROM selected_nonempty)=1 OR (SELECT has_t2 FROM selected_nonempty)=1) AND LOWER(TRIM(p.trait_pos_3)) IN ((SELECT t1 FROM selected_nonempty), (SELECT t2 FROM selected_nonempty)) THEN 1 ELSE 0 END) +
      (CASE WHEN LOWER(TRIM(p.trait_neg_1)) <> '' AND ((SELECT has_t1 FROM selected_nonempty)=1 OR (SELECT has_t2 FROM selected_nonempty)=1) AND LOWER(TRIM(p.trait_neg_1)) IN ((SELECT t1 FROM selected_nonempty), (SELECT t2 FROM selected_nonempty)) THEN 1 ELSE 0 END) +
      (CASE WHEN LOWER(TRIM(p.trait_neg_2)) <> '' AND ((SELECT has_t1 FROM selected_nonempty)=1 OR (SELECT has_t2 FROM selected_nonempty)=1) AND LOWER(TRIM(p.trait_neg_2)) IN ((SELECT t1 FROM selected_nonempty), (SELECT t2 FROM selected_nonempty)) THEN 1 ELSE 0 END) +
      (CASE WHEN LOWER(TRIM(p.trait_neg_3)) <> '' AND ((SELECT has_t1 FROM selected_nonempty)=1 OR (SELECT has_t2 FROM selected_nonempty)=1) AND LOWER(TRIM(p.trait_neg_3)) IN ((SELECT t1 FROM selected_nonempty), (SELECT t2 FROM selected_nonempty)) THEN 1 ELSE 0 END)
    ) * 0.3 AS mutator_bonus
  FROM with_player_base wpb
  JOIN "Player" p ON TRIM(LOWER(p.name)) = TRIM(LOWER(wpb.player_name))
  JOIN team_totals tt ON tt.team_code = wpb.team_code
)
SELECT 
  ap.team AS team,
  ppm.team_code,
  ap.name AS name,
  ppm.player_base_score AS base_score,
  ppm.mutator_bonus,
  (CASE WHEN ppm.total_base_score > 0 THEN (ppm.player_base_score::numeric / ppm.total_base_score) * ppm.team_pps_base ELSE 0 END) AS base_pps,
  ((CASE WHEN ppm.total_base_score > 0 THEN (ppm.player_base_score::numeric / ppm.total_base_score) * ppm.team_pps_base ELSE 0 END) + ppm.mutator_bonus) AS pps,
  ppm.team_pps_base AS team_pps_total,
  ppm.total_base_score AS team_base_total
FROM per_player_mutator ppm
JOIN active_players ap ON TRIM(ap.name) = ppm.player_name
ORDER BY ppm.team_code, ap.name ASC;
