// term: playerExhaustionMap
// id: aiPickMatchdayPlan
// type: datasource
// subtype: JavascriptQuery
// page: Einsatzliste
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
-- Load Punktetabelle (points by rank for 2-6 player disciplines) for PP-aware captain importance.
SELECT 
  "Rank",
  "2_Players",
  "3_players",
  "4_players",
  "5_players",
  "6_players"
FROM "Puntktetabelle"
ORDER BY "Rank" ASC
