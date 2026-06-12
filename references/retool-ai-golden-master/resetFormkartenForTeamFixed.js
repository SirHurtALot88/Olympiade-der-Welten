// term: formkarten_v2
// id: resetFormkartenForTeamFixed
// type: datasource
// subtype: JavascriptQuery
// page: Einsatzliste
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// RESET ALL FORMKARTEN is_used status based on actual lineup data
// SEASON-AGNOSTIC: Formkarten werden als "used" markiert wenn ihre ID in IRGENDEINEM Lineup vorkommt
// (Season-Filter wird NICHT angewendet, da Formkarten/Lineups am Saisonende eh gelöscht werden)

console.log('🔄 Hard-Resync ALL formkarten is_used status (SEASON-AGNOSTIC)');

// KEINE Season-Filter! Nur ID-Matching über alle Seasons hinweg
const sql = `
-- 1) Erst ALLE Formkarten auf false setzen (über alle Seasons)
UPDATE formkarten_v2
SET is_used = false;

-- 2) Dann alle, die in IRGENDEINEM Lineup-Slot vorkommen, auf true setzen (Season egal!)
UPDATE formkarten_v2 f
SET is_used = true
WHERE EXISTS (
  SELECT 1
  FROM lineup l
  WHERE (l.formkarte_id = f.id OR l.formkarte_id_2 = f.id)
);
`;

try {
  dynamicSqlToExecute.setValue(sql);
  await executeDynamicSql.trigger();

  console.log('✅ ALL formkarten is_used status hard-resynced (season-agnostic)');

  // Refresh the formkarten pool to show the changes
  await getFormkartenPoolEinsatz.trigger();

  utils.showNotification({
    title: 'Formkarten synchronisiert',
    description: 'is_used wurde mit allen Lineups abgeglichen (season-agnostic).',
    notificationType: 'success',
    duration: 4 });


  return { ok: true, message: 'All formkarten hard-synchronized (season-agnostic)' };
} catch (e) {
  console.error('❌ resetAllFormkarten failed:', e);
  utils.showNotification({
    title: 'Fehler',
    description: 'Formkarten-Synchronisation fehlgeschlagen: ' + String(e),
    notificationType: 'error' });


  return { ok: false, error: String(e) };
}
