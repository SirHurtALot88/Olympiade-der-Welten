// term: formkarten_v2
// id: debugFormkartenSeasons
// type: datasource
// subtype: SqlQueryUnified
// page: Saisonstand
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
-- Check which seasons exist in formkarten_v2
SELECT DISTINCT season, COUNT(*) as count
FROM formkarten_v2
GROUP BY season
ORDER BY season;
