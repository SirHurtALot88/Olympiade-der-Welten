// term: formkarten_v2
// id: debugFormkartenData
// type: datasource
// subtype: SqlQueryUnified
// page: Saisonstand
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
-- Debug query to check formkarten_v2 data
SELECT team_code, card_value, season, is_used
FROM formkarten_v2
LIMIT 50;
