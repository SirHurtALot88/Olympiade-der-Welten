// term: captain_boost_x10
// id: calculatePlayersD2
// type: datasource
// subtype: SqlQueryUnified
// page: Einsatzliste
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Documentation:
//   Calculate Form for ALL teams at once for D1 and persist to lineup.
//   Fixes:
//   1) Ensures required data queries are triggered (lineups + formkarten) before reading.
//   2) Persists form_points_x_10 AND recomputes total_score_x_10 INCLUDING captain + exhaustion:
//        total_score_x_10 = COALESCE(current_score_x10, base_score_x_10)
//                           + captain_boost_x10
//                           + form_points_x_10
//                           + trait_points_x_10
//   3) Keeps color normalization for x2 matching.
// Returns:
//   { processed: number, skipped: number, persisted: number }

const spieltag = Number(selectSpieltag.value);
if (!spieltag) {
  utils.showNotification({ title: 'Fehler', description: 'Bitte Spieltag auswählen', notificationType: 'error' });
  return;
}

// Ensure required inputs are fresh
try {
  await Promise.all([
  getDiszireihenfolgeEinsatz.trigger(),
  getAllLineupsForSpieltagD1.trigger(),
  getFormkartenPoolAllTeams.trigger()]);

} catch (e) {
  console.warn('[calculateAllTeamsFormD1] prefetch failed', e);
}

// Get discipline info
const diszOrder = formatDataAsArray(getDiszireihenfolgeEinsatz.data) || [];
const idx1 = (spieltag - 1) * 2;
const d1Info = diszOrder[idx1];
const disziplinName = (d1Info?.disziplin || '').trim();

// Get discipline color (expected EN)
const colorMap = disziplinColorMapping.value || {};
const disziplinColor = String(colorMap[disziplinName] || '').trim().toLowerCase();

// Normalize any color input (DE/EN variants) -> EN
function normalizeColor(raw) {
  const s = String(raw || '').trim().toLowerCase();
  const map = {
    red: 'red',
    green: 'green',
    blue: 'blue',
    yellow: 'yellow',
    rot: 'red',
    'grün': 'green',
    gruen: 'green',
    blau: 'blue',
    gelb: 'yellow' };


  return map[s] || s;
}

// Get all lineups for D1 via dedicated spieltag query
const d1Lineups = formatDataAsArray(getAllLineupsForSpieltagD1.data) || [];

// Get all form cards for ALL teams
const formCards = formatDataAsArray(getFormkartenPoolAllTeams.data) || [];

function getCardById(id) {
  if (!id) return null;
  const c = formCards.find((fc) => String(fc.id) === String(id));
  if (!c) return null;
  const rawCardColor = String(c.card_color || '');
  const cardColor = normalizeColor(rawCardColor);
  const cardValue = Number(c.card_value || 0);
  return { id: c.id, cardValue, cardColor, rawCardColor };
}

let processed = 0;
let skipped = 0;
const updates = [];

for (const lineup of d1Lineups) {
  const teamCode = String(lineup.team_code || '').trim();

  const formkarteId1 = lineup.formkarte_id;
  const formkarteId2 = lineup.formkarte_id_2;

  if (!formkarteId1 && !formkarteId2) {
    skipped++;
    continue;
  }

  const card1 = getCardById(formkarteId1);
  const card2 = getCardById(formkarteId2);

  if (!card1 && !card2) {
    skipped++;
    continue;
  }

  const players = String(lineup.player_names_csv || '').
  split(',').
  map((s) => s.trim()).
  filter(Boolean);
  const playerCount = players.length;
  if (playerCount === 0) {
    skipped++;
    continue;
  }

  const v1 = card1?.cardValue || 0;
  const v2 = card2?.cardValue || 0;

  const match1 = !!(card1 && disziplinColor && normalizeColor(card1.cardColor) === normalizeColor(disziplinColor));
  const match2 = !!(card2 && disziplinColor && normalizeColor(card2.cardColor) === normalizeColor(disziplinColor));

  const v1_effective = v1 * (match1 ? 2 : 1);
  const v2_effective = v2 * (match2 ? 2 : 1);
  const sumValueEffective = v1_effective + v2_effective;

  const formX10 = Math.round(sumValueEffective * playerCount * 10);

  const baseX10 = Number(lineup.base_score_x_10 || 0);
  const currentX10 = Number(lineup.current_score_x10 ?? baseX10);
  const capX10 = Number(lineup.captain_boost_x10 || 0);
  const traitX10 = Number(lineup.trait_points_x_10 || 0);

  // IMPORTANT: total must include exhaustion + captain + form + trait
  const totalX10 = currentX10 + capX10 + formX10 + traitX10;

  updates.push({ teamCode, formX10, totalX10 });
  processed++;
}

if (!updates.length) {
  utils.showNotification({
    title: 'Keine Updates',
    description: `Keine gültigen Formkarten/Spieler für D1 gefunden (Spieltag ${spieltag})`,
    notificationType: 'warning',
    duration: 8000 });


  return { processed, skipped, persisted: 0 };
}

const valuesSql = updates.
map((u) => `('${spieltag}', '1', '${u.teamCode.replace(/'/g, "''")}', ${u.formX10}, ${u.totalX10})`).
join(',\n');

const sql = `UPDATE lineup l SET\n  form_points_x_10 = u.form_points_x_10,\n  total_score_x_10 = u.total_score_x_10,\n  updated_at = NOW()\nFROM (VALUES\n${valuesSql}\n) AS u(spieltag, disziplin_nr, team_code, form_points_x_10, total_score_x_10)\nWHERE l.spieltag = CAST(u.spieltag AS INTEGER)\n  AND l.disziplin_nr = CAST(u.disziplin_nr AS INTEGER)\n  AND l.team_code = u.team_code;`;

dynamicSqlToExecute.setValue(sql);
await executeDynamicSql.trigger();

await Promise.all([
getScoringD1New.trigger(),
getTop10PlayersD1.trigger(),
getSpieltagTeamRanking.trigger()]);


utils.showNotification({
  title: 'Form (D1) für alle Teams gespeichert',
  description: `${processed} Teams aktualisiert, ${skipped} übersprungen`,
  notificationType: 'success' });


return { processed, skipped, persisted: updates.length };
