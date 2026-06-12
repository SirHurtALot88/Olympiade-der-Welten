// term: formkarten_v2
// id: clearFormkartenForSeason
// type: script
// subtype: SqlQueryUnified
// page: Saisonstand
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
-- Season-Ende cleanup: delete ALL formkarten rows (not season-bound).
-- Delete ALL formkarten (season-independent)
DELETE FROM formkarten_v2;
