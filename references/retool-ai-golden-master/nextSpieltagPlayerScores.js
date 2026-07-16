// term: playerExhaustionMap
// id: nextSpieltagPlayerScores
// type: function
// subtype: Function
// page: Saisonstand
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Entfernt eine Formkarte aus BEIDEN Slots (formkarte_id UND formkarte_id_2)
// in allen Lineups AUSSER dem aktuell ausgewählten Team/Spieltag
// Damit wird sichergestellt, dass jede Formkarte maximal 1x in allen 40 Slots vorkommt

const fkId = formkarteId.value;
const team = selectTeamEinsatzliste.value;
const spieltag = Number(selectSpieltag.value);

if (!fkId || !team || !spieltag) {
  console.warn('[removeFormkarteFromAllSlots] Missing required values:', { fkId, team, spieltag });
  return { ok: false, reason: 'missing_params' };
}

try {
  // SQL um die Formkarte aus BEIDEN Slots zu entfernen
  const sql = `
    UPDATE lineup
    SET 
      formkarte_id = CASE WHEN formkarte_id = ${fkId} THEN NULL ELSE formkarte_id END,
      formkarte_id_2 = CASE WHEN formkarte_id_2 = ${fkId} THEN NULL ELSE formkarte_id_2 END
    WHERE (formkarte_id = ${fkId} OR formkarte_id_2 = ${fkId})
      AND NOT (team_code = '${team}' AND spieltag = ${spieltag})
  `;

  dynamicSqlToExecute.setValue(sql);
  await executeDynamicSql.trigger();

  const result = executeDynamicSql.data || {};
  console.log(`✅ Removed formkarte ${fkId} from ALL slots in other lineups`);

  return {
    ok: true,
    formkarteId: fkId,
    rowsAffected: result.rowsAffected || 0,
    message: `Formkarte ${fkId} aus allen anderen Lineups entfernt` };

} catch (e) {
  console.error('[removeFormkarteFromAllSlots] ERROR:', e);
  return {
    ok: false,
    error: String(e.message || e),
    formkarteId: fkId };

}
