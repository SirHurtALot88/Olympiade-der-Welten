// term: formkarten_v2
// id: resetFormkartenForTeam
// type: datasource
// subtype: SqlQueryUnified
// page: Einsatzliste
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: selectTeamEinsatzliste.value | localStorage.values.globalCurrentSeason || 1
// extractionStatus: complete_or_primary_match
UPDATE formkarten_v2 f
SET is_used = EXISTS (
  SELECT 1
  FROM lineup l
  WHERE l.formkarte_id = f.id
)
WHERE f.team_code = '{{ selectTeamEinsatzliste.value }}'
  AND f.season = {{ localStorage.values.globalCurrentSeason || 1 }};

