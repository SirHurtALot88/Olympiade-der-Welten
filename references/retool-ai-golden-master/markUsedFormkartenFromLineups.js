// term: formkarten_v2
// id: markUsedFormkartenFromLineups
// type: datasource
// subtype: SqlQueryUnified
// page: Einsatzliste
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
UPDATE formkarten_v2
SET is_used = true
WHERE id IN (
  SELECT DISTINCT formkarte_id 
  FROM lineup 
  WHERE formkarte_id IS NOT NULL 
    AND season = 1
)
AND season = 1;

