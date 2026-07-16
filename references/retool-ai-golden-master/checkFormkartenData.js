// term: formkarten_v2
// id: checkFormkartenData
// type: datasource
// subtype: SqlQueryUnified
// page: Saisonstand
// folder: Spielerbilder
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
-- Pr\u00fcft Formkarten-Verteilung in formkarten_v2
SELECT 
  COUNT(*) as total_cards,
  COUNT(DISTINCT team_code) as teams_with_cards,
  COUNT(DISTINCT season) as seasons,
  MIN(season) as min_season,
  MAX(season) as max_season
FROM formkarten_v2
WHERE card_value != 0
