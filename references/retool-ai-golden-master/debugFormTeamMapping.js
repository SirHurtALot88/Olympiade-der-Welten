// term: formkarten_v2
// id: debugFormTeamMapping
// type: datasource
// subtype: SqlQueryUnified
// page: Saisonstand
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
-- Test form card sum with team code mapping
SELECT 
  f.team_code,
  SUM(f.card_value)::numeric as form_sum,
  COUNT(*) as card_count
FROM formkarten_v2 f
GROUP BY f.team_code
ORDER BY form_sum DESC
LIMIT 10;
