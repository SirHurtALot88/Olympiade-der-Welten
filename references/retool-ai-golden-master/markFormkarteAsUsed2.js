// term: formkarten_v2
// id: markFormkarteAsUsed2
// type: datasource
// subtype: SqlQueryUnified
// page: Einsatzliste
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: formkarteId.value
// extractionStatus: complete_or_primary_match
UPDATE formkarten_v2 
SET is_used = true 
WHERE id = {{ formkarteId.value }}
