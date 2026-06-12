// term: formkarten_v2
// id: checkFormkartenForCurrentSeason
// type: datasource
// subtype: SqlQueryUnified
// page: Saisonstand
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
-- Check if ANY formkarten rows exist before Season-Ende cleanup (season-independent).
-- Check if ANY formkarten rows exist
SELECT COUNT(*) as formkarten_count
FROM formkarten_v2;
