// term: formkarten_v2
// id: getTeamFormkartenSum
// type: datasource
// subtype: SqlQueryUnified
// page: Einsatzliste
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
-- Sum of form card values per team across all seasons (season-independent)
SELECT team_code, SUM(card_value)::numeric AS form_sum
FROM formkarten_v2
GROUP BY team_code
ORDER BY team_code;
