// term: captain_boost_x10
// id: insertLineupD2new
// type: script
// subtype: SqlQueryUnified
// page: Einsatzliste
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: selectSpieltag.value | escapeSqlString.value.run(currentSpieltagDisziplinen.value.d2.name) | escapeSqlString.value.run(currentSpieltagDisziplinen.value.d2.color) | escapeSqlString.value.run(selectTeamEinsatzliste.value) | escapeSqlString.value.run((selectPlayersDisziplin2.value || []).join(', ')) | selectFormkarteDiszi2.value || 'NULL' | selectFormkarteDiszi2Second.value || 'NULL' | captainCheckboxDiszi2.value ? 'true' : 'false' | (() => { if (!captainCheckboxDiszi2.value) return 0; const d2Name = currentSpieltagDisziplinen.value?.d2?.name; if (!d2Name) return 0; const players = formatDataAsArray(getTeamPlayersEinsatz.data) || []; const selected = players.filter(p => (selectPlayersDisziplin2.value || []).includes(p.name)); const d2Field = d2Name.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_'); const ex = playerExhaustionMap.value || {}; let maxCurrent = 0; selected.forEach(p => { const base = Number(p[d2Field] || 0); const mult = Number(ex[p.name]?.multiplier || 1); const current = base * mult; if (current > maxCurrent) maxCurrent = current; }); return Math.round(maxCurrent * 10 * 0.5); })() | (mutatorDiszi2Trait1.value && mutatorDiszi2Trait1.value.trait) ? "'" + escapeSqlString.value.run(mutatorDiszi2Trait1.value.trait) + "'" : 'NULL' | (mutatorDiszi2Trait2.value && mutatorDiszi2Trait2.value.trait) ? "'" + escapeSqlString.value.run(mutatorDiszi2Trait2.value.trait) + "'" : 'NULL'
// extractionStatus: complete_or_primary_match
INSERT INTO lineup (
  season,
  spieltag,
  disziplin_nr,
  disziplin_name,
  disziplin_color,
  team_code,
  player_names_csv,
  formkarte_id,
  formkarte_id_2,
  is_captain,
  captain_boost_x10,
  mutator_trait_1,
  mutator_trait_2,
  updated_at
) VALUES (
  1,
  {{ selectSpieltag.value }},
  2,
  '{{ escapeSqlString.value.run(currentSpieltagDisziplinen.value.d2.name) }}',
  '{{ escapeSqlString.value.run(currentSpieltagDisziplinen.value.d2.color) }}',
  '{{ escapeSqlString.value.run(selectTeamEinsatzliste.value) }}',
  '{{ escapeSqlString.value.run((selectPlayersDisziplin2.value || []).join(', ')) }}',
  {{ selectFormkarteDiszi2.value || 'NULL' }},
  {{ selectFormkarteDiszi2Second.value || 'NULL' }},
  {{ captainCheckboxDiszi2.value ? 'true' : 'false' }},
  {{ (() => { if (!captainCheckboxDiszi2.value) return 0; const d2Name = currentSpieltagDisziplinen.value?.d2?.name; if (!d2Name) return 0; const players = formatDataAsArray(getTeamPlayersEinsatz.data) || []; const selected = players.filter(p => (selectPlayersDisziplin2.value || []).includes(p.name)); const d2Field = d2Name.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_'); const ex = playerExhaustionMap.value || {}; let maxCurrent = 0; selected.forEach(p => { const base = Number(p[d2Field] || 0); const mult = Number(ex[p.name]?.multiplier || 1); const current = base * mult; if (current > maxCurrent) maxCurrent = current; }); return Math.round(maxCurrent * 10 * 0.5); })() }},
  {{ (mutatorDiszi2Trait1.value && mutatorDiszi2Trait1.value.trait) ? "'" + escapeSqlString.value.run(mutatorDiszi2Trait1.value.trait) + "'" : 'NULL' }},
  {{ (mutatorDiszi2Trait2.value && mutatorDiszi2Trait2.value.trait) ? "'" + escapeSqlString.value.run(mutatorDiszi2Trait2.value.trait) + "'" : 'NULL' }},
  NOW()
)
ON CONFLICT (season, team_code, spieltag, disziplin_nr)
DO UPDATE SET
  disziplin_name = EXCLUDED.disziplin_name,
  disziplin_color = EXCLUDED.disziplin_color,
  player_names_csv = EXCLUDED.player_names_csv,
  formkarte_id = EXCLUDED.formkarte_id,
  formkarte_id_2 = EXCLUDED.formkarte_id_2,
  is_captain = EXCLUDED.is_captain,
  captain_boost_x10 = EXCLUDED.captain_boost_x10,
  mutator_trait_1 = EXCLUDED.mutator_trait_1,
  mutator_trait_2 = EXCLUDED.mutator_trait_2,
  updated_at = NOW();
