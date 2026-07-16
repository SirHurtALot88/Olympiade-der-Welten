// term: formkarten_v2
// id: executeSeasonEnd
// type: script
// subtype: JavascriptQuery
// page: Saisonstand
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
-- Preview deletions for Season-Ende (season-independent).
-- Preview how many rows would be deleted by season-end cleanup without performing deletes
SELECT 'lineup' AS table_name, COUNT(*) AS records_to_delete
FROM lineup
UNION ALL
SELECT 'formkarten_v2' AS table_name, COUNT(*) AS records_to_delete
FROM formkarten_v2;
