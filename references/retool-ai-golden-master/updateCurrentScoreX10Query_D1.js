// term: captain_boost_x10
// id: updateCurrentScoreX10Query_D1
// type: datasource
// subtype: JavascriptQuery
// page: Einsatzliste
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Documentation:
//   Recomputes current_score_x10 for D2 ONLY (disziplin_nr=2) for the selected spieltag.
//   - Fatigue is computed season-agnostic (looks at last 4 spieltage across ALL lineup rows)
//   - Updates are applied only to lineup.season = 1 (app convention)
//   - Also recomputes total_score_x_10 for the updated D2 rows to keep DB consistent.
// Returns:
//   boolean
;

const season = 1;
const spieltag = Number(selectSpieltag.value);
if (!spieltag) {
  utils.showNotification({ title: 'Fehlender Spieltag', description: 'Bitte Spieltag wählen.', notificationType: 'warning' });
  return false;
}

const sql = `WITH params AS (
  SELECT ${season}::int AS season,
         ${spieltag}::int AS spieltag
),
current_rows AS (
  SELECT l.id, l.season, l.spieltag, l.disziplin_nr, l.team_code, l.player_names_csv, l.disziplin_name,
         COALESCE(l.form_points_x_10,0) AS form_points_x_10,
         COALESCE(l.captain_boost_x10,0) AS captain_boost_x10,
         COALESCE(l.trait_points_x_10,0) AS trait_points_x_10
  FROM lineup l, params p
  WHERE l.season = p.season
    AND l.spieltag = p.spieltag
    AND l.team_code IS NOT NULL AND TRIM(l.team_code) <> ''
    AND l.disziplin_nr = 2
),
players_expanded AS (
  SELECT cr.id,
         cr.team_code,
         cr.disziplin_nr,
         cr.spieltag,
         cr.disziplin_name,
         cr.form_points_x_10,
         cr.captain_boost_x10,
         cr.trait_points_x_10,
         regexp_replace(lower(trim(unnest(string_to_array(COALESCE(cr.player_names_csv,''), ',')))), '[^a-z0-9]', '', 'g') AS player_key
  FROM current_rows cr
),
current_players AS (
  SELECT pe.id,
         pe.team_code,
         pe.disziplin_nr,
         pe.spieltag,
         pe.player_key,
         pe.disziplin_name,
         pe.form_points_x_10,
         pe.captain_boost_x10,
         pe.trait_points_x_10,
         CASE 
           WHEN pe.disziplin_name ILIKE 'TDM' THEN COALESCE(p.tdm, 0)
           WHEN pe.disziplin_name ILIKE 'Battlefield' THEN COALESCE(p.battlefield, 0)
           WHEN pe.disziplin_name ILIKE 'Basketball' THEN COALESCE(p.basketball, 0)
           WHEN pe.disziplin_name ILIKE 'Breaking' THEN COALESCE(p.breaking, 0)
           WHEN pe.disziplin_name ILIKE 'Climbing' THEN COALESCE(p.climbing, 0)
           WHEN pe.disziplin_name ILIKE 'Eiskunst%' THEN COALESCE(p.eiskunstlauf, 0)
           WHEN pe.disziplin_name ILIKE 'Fechten' THEN COALESCE(p.fechten, 0)
           WHEN pe.disziplin_name ILIKE 'Football' THEN COALESCE(p.football, 0)
           WHEN pe.disziplin_name ILIKE 'Gewichtheben' THEN COALESCE(p.gewichtheben, 0)
           WHEN pe.disziplin_name ILIKE 'Hockey' THEN COALESCE(p.hockey, 0)
           WHEN pe.disziplin_name ILIKE 'I Spy' THEN COALESCE(p.i_spy, 0)
           WHEN pe.disziplin_name ILIKE 'Mini%DM' OR pe.disziplin_name ILIKE 'Mini DM' THEN COALESCE(p.mini_dm, 0)
           WHEN pe.disziplin_name ILIKE 'Schach' THEN COALESCE(p.speed_schach, 0)
           WHEN pe.disziplin_name ILIKE 'Showcase' THEN COALESCE(p.showcase, 0)
           WHEN pe.disziplin_name ILIKE 'Spurt' THEN COALESCE(p.spurt, 0)
           WHEN pe.disziplin_name ILIKE 'Staffel' THEN COALESCE(p.staffel, 0)
           WHEN pe.disziplin_name ILIKE 'Takeshi%' THEN COALESCE(p.takeshis_castle, 0)
           WHEN pe.disziplin_name ILIKE 'Tennis' THEN COALESCE(p.tennis, 0)
           WHEN pe.disziplin_name ILIKE 'Time%Trial' THEN COALESCE(p.time_trial, 0)
           WHEN pe.disziplin_name ILIKE 'Wettessen' THEN COALESCE(p.wettessen, 0)
           ELSE 0
         END * 10 AS player_score_x10
  FROM players_expanded pe
  JOIN "Player" p 
    ON regexp_replace(lower(trim(p.name)), '[^a-z0-9]', '', 'g') = pe.player_key
),
last4_appearances AS (
  SELECT l.team_code,
         regexp_replace(lower(trim(unnest(string_to_array(COALESCE(l.player_names_csv,''), ',')))), '[^a-z0-9]', '', 'g') AS player_key,
         l.spieltag
  FROM lineup l, params p
  WHERE l.spieltag BETWEEN (p.spieltag - 4) AND (p.spieltag - 1)
    AND l.team_code IS NOT NULL AND TRIM(l.team_code) <> ''
    AND l.disziplin_nr IN (1,2)
),
flags AS (
  SELECT cp.id, cp.player_key, cp.team_code,
         MAX(CASE WHEN la.spieltag = cp.spieltag - 1 THEN 1 ELSE 0 END) AS p1,
         MAX(CASE WHEN la.spieltag = cp.spieltag - 2 THEN 1 ELSE 0 END) AS p2,
         MAX(CASE WHEN la.spieltag = cp.spieltag - 3 THEN 1 ELSE 0 END) AS p3,
         MAX(CASE WHEN la.spieltag = cp.spieltag - 4 THEN 1 ELSE 0 END) AS p4
  FROM current_players cp
  LEFT JOIN last4_appearances la
    ON la.team_code = cp.team_code
   AND la.player_key = cp.player_key
  GROUP BY cp.id, cp.player_key, cp.team_code
),
consecutive AS (
  SELECT f.id, f.player_key,
         (p1) + (p1*p2) + (p1*p2*p3) + (p1*p2*p3*p4) AS consec
  FROM flags f
),
multiplier AS (
  SELECT c.id, c.player_key,
         CASE WHEN c.consec >= 4 THEN 0.80
              WHEN c.consec = 3 THEN 0.85
              WHEN c.consec = 2 THEN 0.90
              WHEN c.consec = 1 THEN 0.95
              ELSE 1.00 END AS mult
  FROM consecutive c
),
player_adjusted AS (
  SELECT cp.id,
         MAX(cp.form_points_x_10) AS form_points_x_10,
         MAX(cp.captain_boost_x10) AS captain_boost_x10,
         MAX(cp.trait_points_x_10) AS trait_points_x_10,
         SUM(cp.player_score_x10 * COALESCE(m.mult,1.0)) AS team_current_score_x10
  FROM current_players cp
  LEFT JOIN multiplier m ON m.id = cp.id AND m.player_key = cp.player_key
  GROUP BY cp.id
)
UPDATE lineup l
SET current_score_x10 = pa.team_current_score_x10::int,
    total_score_x_10 = (pa.team_current_score_x10::int + pa.form_points_x_10 + pa.captain_boost_x10 + pa.trait_points_x_10)::int,
    updated_at = NOW()
FROM player_adjusted pa
WHERE pa.id = l.id;`;

dynamicSqlToExecute.setValue(sql);
await executeDynamicSql.trigger();

return true;
