// term: aiPickSeasonPlan
// id: 1d8c80a2
// type: script
// subtype: ButtonWidget2
// page: Einsatzliste
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Documentation:
//   Runs AI Season planning and saves ST1-10 lineups.
//   IMPORTANT SEASON BEHAVIOR (per app convention):
//   - Lineups are always persisted as season = 1.
//     This matches the manual lineup flow (which always writes season=1) so that saving
//     a lineup always overwrites the same slots and we never end up with parallel seasons
//     in the lineup table.
//
//   Performance:
//   - No global fatigue refresh here. (AI Season should be fast.)
//     Fatigue refresh is done only when explicitly requested (e.g. Base Score D1 flow).
//
//   Formkarten:
//   - We intentionally ignore formkarten_v2.is_used flags when feeding cards into the season planner,
//     because those flags can be out-of-sync and would cause "no cards assigned".
//
//   Engine inputs (patch):
//   - teamRatings: fetched and passed as soft bias (same as Preview)
//   - captainUsedCount: passed as hard remaining captain budget
//   - teamBiasByDiszi: precomputed via teamBiasForDiszi helper query
// Returns:
//   { ok: boolean, team: string, season: number, dryRun: boolean, savedSlots?: number, notes: string[] }
;

const t0 = Date.now();
const notes = [];

const s = (v) => String(v ?? '').trim();
const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const normTeam = (x) => s(x).toUpperCase().replace(/\s*-\s*/g, '-');

const team = s(selectTeamEinsatzliste.value);

// 🔒 Force season=1 for lineup persistence.
const season = 1;
const dryRun = !!aiSeasonDryRun.value;

if (!team) {
  utils.showNotification({
    title: 'AI Season: Team fehlt',
    description: 'Bitte zuerst ein Team auswählen.',
    notificationType: 'warning' });

  return { ok: false, team, season, dryRun, notes: ['missing_team'] };
}

// Prefetch (extended with ratings + captain usage)
try {
  await Promise.all([
  getDiszireihenfolgeEinsatz.trigger(),
  getPunktetabelleQueryEinsatzliste.trigger(),
  getFormkartenPoolAllTeams.trigger(),
  getAllPlayersFromDB.trigger(),
  getTeamRatingsForSelectedTeam.trigger(),
  getTeamRatingsForSelectedTeam_viaSaisonstand.trigger(),
  getAllTeamCaptainUsage.trigger()]);

} catch (e) {
  console.warn('[aiPickSeasonPlan] prefetch failed', e);
  notes.push('prefetch_failed_some_inputs');
}

// Schedule
const disziRows = (formatDataAsArray(getDiszireihenfolgeEinsatz.data) || []).
map((r) => ({ name: s(r.disziplin), order: n(r.reihenfolge), players: clamp(n(r.player), 0, 12) })).
filter((r) => r.name && r.order > 0).
sort((a, b) => a.order - b.order);

const schedule = [...Array(10)].map((_, i) => {
  const st = i + 1;
  return {
    st,
    d1: disziRows[i * 2] ? { name: disziRows[i * 2].name, players: disziRows[i * 2].players } : null,
    d2: disziRows[i * 2 + 1] ? { name: disziRows[i * 2 + 1].name, players: disziRows[i * 2 + 1].players } : null };

});

if (schedule.some((r) => !r.d1 || !r.d2)) {
  utils.showNotification({
    title: 'AI Season: Disziplin-Schedule unvollständig',
    description: 'Für ST1–10 fehlen D1/D2 Disziplinen.',
    notificationType: 'error',
    duration: 6 });

  return { ok: false, team, season, dryRun, notes: [...notes, 'schedule_incomplete'] };
}

// Roster (robust name join)
const teamEsc = team.replace(/'/g, "''");
const rosterSql = `
  SELECT 
    ap.name,
    ap.team,
    p.klasse,
    p.pow, p.spe, p.men, p.soc,
    p.tdm, p.mini_dm, p.gewichtheben, p.hockey, p.breaking,
    p.staffel, p.time_trial, p.spurt, p.climbing, p.fechten,
    p.speed_schach as schach,
    p.takeshis_castle as takeshi,
    p.tennis,
    p.i_spy,
    p.wettessen,
    p.basketball,
    p.football,
    p.battlefield,
    p.eiskunstlauf as eiskunst,
    p.showcase
  FROM active_players ap
  LEFT JOIN "Player" p 
    ON regexp_replace(lower(trim(p.name)), '[^a-z0-9]', '', 'g')
     = regexp_replace(lower(trim(ap.name)), '[^a-z0-9]', '', 'g')
  WHERE ap.team IS NOT NULL
    AND regexp_replace(upper(trim(ap.team)), '[^A-Z0-9]', '', 'g')
        = regexp_replace(upper(trim('${teamEsc}')), '[^A-Z0-9]', '', 'g')
  ORDER BY ap.name;
`;

let roster = [];
try {
  dynamicSqlToExecute.setValue(rosterSql);
  await executeDynamicSql.trigger();
  roster = (formatDataAsArray(executeDynamicSql.data) || []).filter((p) => !!p?.name);
} catch (e) {
  utils.showNotification({
    title: 'AI Season: Kader-Fehler',
    description: String(e?.message || e),
    notificationType: 'error',
    duration: 6 });

  return { ok: false, team, season, dryRun, notes: [...notes, 'roster_sql_failed'] };
}

if (!roster.length) {
  utils.showNotification({
    title: 'AI Season: Kein Kader',
    description: `Für Team ${team} wurden keine active_players gefunden.`,
    notificationType: 'error',
    duration: 7 });

  return { ok: false, team, season, dryRun, notes: [...notes, 'no_roster_active_players'] };
}

// Cards
const colorMap = disziplinColorMapping.value || {};
const teamNorm = normTeam(team);

// IMPORTANT: ignore is_used by forcing used=false
const cards = (formatDataAsArray(getFormkartenPoolAllTeams.data) || []).
filter((r) => normTeam(r.team_code) === teamNorm).
map((r) => ({ id: n(r.id), v: n(r.card_value), c: s(r.card_color), used: false })).
filter((c) => c.id && c.v !== 0);

// Proxy teams
const globalPlayers = formatDataAsArray(getAllPlayersFromDB.data) || [];
const proxyTeams = {};
for (const p of globalPlayers) {
  const t = normTeam(p?.team);
  if (!t) continue;
  (proxyTeams[t] ||= []).push(p);
}

// --- Team Ratings (soft bias) ---
const ratingsDirect = (formatDataAsArray(getTeamRatingsForSelectedTeam.data) || [])[0] || null;
const ratingsVia = (formatDataAsArray(getTeamRatingsForSelectedTeam_viaSaisonstand.data) || [])[0] || null;
const ratingsRow = ratingsDirect || ratingsVia || null;

const teamRatings = ratingsRow ? {
  name: s(ratingsRow.name),
  power: n(ratingsRow.power),
  speed: n(ratingsRow.speed),
  mental: n(ratingsRow.mental),
  social: n(ratingsRow.social),
  ambition: n(ratingsRow.ambition),
  finances: n(ratingsRow.finances),
  board_confidence: n(ratingsRow.board_confidence),
  harmony: n(ratingsRow.harmony),
  manners: n(ratingsRow.manners),
  popularity: n(ratingsRow.popularity),
  cooperation: n(ratingsRow.cooperation) } :
null;

if (!teamRatings) notes.push('team_ratings_missing');

// --- Captain hard cap ---
// captainUsedCount = how many captains this team has ALREADY committed this season
const captainUsedCount = n(teamCaptainCount.value || 0);

// --- Precompute teamBiasByDiszi (do NOT trigger inside engine) ---
let teamBiasByDiszi = {};
try {
  if (teamRatings) {
    const disziNames = Array.from(new Set(
    schedule.flatMap((r) => [r?.d1?.name, r?.d2?.name]).filter(Boolean).map(String)));


    const biasResults = await Promise.all(
    disziNames.map(async (diszi) => {
      const disziColor = colorMap?.[diszi] || null;
      const res = await teamBiasForDiszi.trigger({
        additionalScope: { teamRatings, disziName: diszi, disziColor } });

      return [diszi, res];
    }));


    teamBiasByDiszi = Object.fromEntries(
    biasResults.
    filter(([name, val]) => !!name && val && typeof val === 'object').
    map(([name, val]) => [name, { bias: n(val.bias), reasons: Array.isArray(val.reasons) ? val.reasons : [] }]));

  }
} catch (e) {
  console.warn('[aiPickSeasonPlan] teamBiasByDiszi precompute failed', e);
  notes.push('team_bias_by_diszi_failed');
  teamBiasByDiszi = {};
}

// Engine
seasonPlannerEngineInput.setValue({
  team,
  season, // informational; persistence is still season=1
  roster,
  schedule,
  punktetabelleRows: formatDataAsArray(getPunktetabelleQueryEinsatzliste.data) || [],
  cards,
  disziColorMapping: colorMap,
  proxyTeams,
  teamRatings,
  captainUsedCount,
  teamBiasByDiszi });


let plan;
try {
  plan = await seasonPlannerEngine.trigger();
} catch (e) {
  utils.showNotification({
    title: 'AI Season: Engine Fehler',
    description: String(e?.message || e),
    notificationType: 'error',
    duration: 6 });

  return { ok: false, team, season, dryRun, notes: [...notes, 'engine_trigger_failed'] };
}

if (!plan?.ok || !Array.isArray(plan?.spieltage)) {
  utils.showNotification({
    title: 'AI Season: Plan ungültig',
    description: 'Engine lieferte kein gültiges Ergebnis.',
    notificationType: 'error',
    duration: 6 });

  return { ok: false, team, season, dryRun, notes: [...notes, 'engine_result_invalid'] };
}

seasonPlannerLastPlan.setValue(plan);
if (dryRun) {
  utils.showNotification({
    title: 'AI Season (Dry-Run)',
    description: `${team} · season=1 · Plan generiert`,
    notificationType: 'info',
    duration: 5 });

  notes.push(`runtime_ms:${Date.now() - t0}`);
  return { ok: true, team, season, dryRun: true, notes };
}

// ---- Score helpers (base + internal fatigue simulation) ----
// Note: This is only used to populate base/current/captain in the written lineup rows.
const fatigue = {};
for (const p of roster) fatigue[String(p.name)] = 0;

const fatigueMult = (count) =>
count >= 4 ? 0.8 :
count >= 3 ? 0.85 :
count >= 2 ? 0.9 :
count >= 1 ? 0.95 : 1.0;

const colForName = (name) => {
  const k = s(name).toLowerCase();
  const map = {
    'mini dm': 'mini_dm',
    mini_dm: 'mini_dm',
    'time trial': 'time_trial',
    time_trial: 'time_trial',
    'speed schach': 'schach',
    "takeshi's castle": 'takeshi',
    'takeshis castle': 'takeshi',
    takeshi: 'takeshi',
    'i spy': 'i_spy',
    i_spy: 'i_spy',
    eiskunstlauf: 'eiskunst' };

  return (map[k] || k).replace(/\s+/g, '_').replace(/-/g, '_');
};

const baseVal = (playerName, disziName) => {
  const p = roster.find((x) => String(x.name) === String(playerName));
  return p ? n(p?.[colForName(disziName)]) : 0;
};
const curVal = (playerName, disziName) =>
baseVal(playerName, disziName) * fatigueMult(n(fatigue[String(playerName)] || 0));

const sum = (arr, fn) => (Array.isArray(arr) ? arr : []).reduce((a, x) => a + fn(x), 0);
const best = (arr, fn) => {
  let b = 0;
  for (const x of Array.isArray(arr) ? arr : []) b = Math.max(b, fn(x));
  return b;
};

const escSql = (str) => String(str ?? '').replace(/'/g, "''");
const toCsv = (arr) => Array.isArray(arr) ? arr.map(String).join(', ') : '';
const toIntOrNull = (v) => {
  const x = Number(v);
  return Number.isFinite(x) && x !== 0 ? Math.trunc(x) : null;
};

const rows = [];
for (const st of plan.spieltage) {
  const spieltag = n(st?.spieltag);
  if (!spieltag) continue;

  const d1 = st?.d1;
  const d2 = st?.d2;

  const d1Diszi = s(d1?.disziplin);
  const d2Diszi = s(d2?.disziplin);

  const d1Players = d1?.playersPicked || [];
  const d2Players = d2?.playersPicked || [];

  const d1BaseX10 = Math.round(sum(d1Players, (nm) => baseVal(nm, d1Diszi)) * 10);
  const d2BaseX10 = Math.round(sum(d2Players, (nm) => baseVal(nm, d2Diszi)) * 10);

  const d1CurX10 = Math.round(sum(d1Players, (nm) => curVal(nm, d1Diszi)) * 10);
  const d2CurX10 = Math.round(sum(d2Players, (nm) => curVal(nm, d2Diszi)) * 10);

  const d1CapX10 = d1?.captain ? Math.round(best(d1Players, (nm) => curVal(nm, d1Diszi)) * 0.5 * 10) : 0;
  const d2CapX10 = d2?.captain ? Math.round(best(d2Players, (nm) => curVal(nm, d2Diszi)) * 0.5 * 10) : 0;

  rows.push({
    spieltag,
    disziplin_nr: 1,
    disziplin_name: d1Diszi,
    disziplin_color: s(d1?.disziplinColor) || null,
    players_csv: toCsv(d1Players),
    formkarte_1: toIntOrNull(d1?.formkarten?.[0] ?? null),
    formkarte_2: toIntOrNull(d1?.formkarten?.[1] ?? null),
    is_captain: !!d1?.captain,
    captain_boost_x10: d1CapX10,
    base_score_x_10: d1BaseX10,
    current_score_x10: d1CurX10,
    total_score_x_10: d1CurX10 + d1CapX10 });


  rows.push({
    spieltag,
    disziplin_nr: 2,
    disziplin_name: d2Diszi,
    disziplin_color: s(d2?.disziplinColor) || null,
    players_csv: toCsv(d2Players),
    formkarte_1: toIntOrNull(d2?.formkarten?.[0] ?? null),
    formkarte_2: toIntOrNull(d2?.formkarten?.[1] ?? null),
    is_captain: !!d2?.captain,
    captain_boost_x10: d2CapX10,
    base_score_x_10: d2BaseX10,
    current_score_x10: d2CurX10,
    total_score_x_10: d2CurX10 + d2CapX10 });


  // update fatigue for next spieltag
  const played = new Set([...d1Players, ...d2Players].map(String));
  for (const p of roster) {
    const nm = String(p.name);
    fatigue[nm] = played.has(nm) ? n(fatigue[nm] || 0) + 1 : 0;
  }
}

if (!rows.length) return { ok: false, team, season, dryRun, notes: [...notes, 'no_rows_to_save'] };

const valuesSql = rows.map((r) => {
  const diszColor = r.disziplin_color ? `'${escSql(r.disziplin_color)}'` : 'NULL';
  const fk1 = r.formkarte_1 == null ? 'NULL' : String(r.formkarte_1);
  const fk2 = r.formkarte_2 == null ? 'NULL' : String(r.formkarte_2);
  const cap = r.is_captain ? 'TRUE' : 'FALSE';
  return `(${season}, ${r.spieltag}, ${r.disziplin_nr}, '${escSql(r.disziplin_name)}', ${diszColor}, '${escSql(team)}', '${escSql(r.players_csv)}', ${fk1}, ${fk2}, ${cap}, ${Math.trunc(r.captain_boost_x10 || 0)}, ${Math.trunc(r.base_score_x_10 || 0)}, ${Math.trunc(r.current_score_x10 || 0)}, 0, 0, ${Math.trunc(r.total_score_x_10 || 0)}, NOW())`;
}).join(',\n');

const saveSql = `
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS lineup_unique_team_slot
  ON lineup (season, team_code, spieltag, disziplin_nr);

DELETE FROM lineup l
USING lineup l2
WHERE l.season = l2.season
  AND l.team_code = l2.team_code
  AND l.spieltag = l2.spieltag
  AND l.disziplin_nr = l2.disziplin_nr
  AND l.id < l2.id
  AND l.team_code = '${escSql(team)}'
  AND l.season = ${season}
  AND l.spieltag BETWEEN 1 AND 10
  AND l.disziplin_nr IN (1,2);

DELETE FROM lineup
WHERE team_code = '${escSql(team)}'
  AND season = ${season}
  AND spieltag BETWEEN 1 AND 10
  AND disziplin_nr IN (1,2);

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
  base_score_x_10,
  current_score_x10,
  form_points_x_10,
  trait_points_x_10,
  total_score_x_10,
  updated_at
) VALUES
${valuesSql}
ON CONFLICT (season, team_code, spieltag, disziplin_nr)
DO UPDATE SET
  disziplin_name = EXCLUDED.disziplin_name,
  disziplin_color = EXCLUDED.disziplin_color,
  player_names_csv = EXCLUDED.player_names_csv,
  formkarte_id = EXCLUDED.formkarte_id,
  formkarte_id_2 = EXCLUDED.formkarte_id_2,
  is_captain = EXCLUDED.is_captain,
  captain_boost_x10 = EXCLUDED.captain_boost_x10,
  base_score_x_10 = EXCLUDED.base_score_x_10,
  current_score_x10 = EXCLUDED.current_score_x10,
  form_points_x_10 = EXCLUDED.form_points_x_10,
  trait_points_x_10 = EXCLUDED.trait_points_x_10,
  total_score_x_10 = EXCLUDED.total_score_x_10,
  updated_at = NOW();

COMMIT;
`;

try {
  dynamicSqlToExecute.setValue(saveSql);
  await executeDynamicSql.trigger();
} catch (e) {
  utils.showNotification({
    title: '❌ AI Season: Speichern fehlgeschlagen',
    description: String(e?.message || e),
    notificationType: 'error',
    duration: 8 });

  return { ok: false, team, season, dryRun, notes: [...notes, 'save_sql_failed'] };
}

// NO recalculateAllExhaustion here (perf). Just refresh.
try {
  await Promise.all([
  getAllTeamLineupsEinsatz.trigger(),
  getFormkartenPoolEinsatz.trigger(),
  getAllTeamCaptainUsage.trigger(),
  getTeamPlayersEinsatz.trigger(),
  simpleLineupCheck.trigger(),
  getScoringD1New.trigger(),
  getScoringD2New.trigger(),
  getSpieltagTeamRanking.trigger()]);

} catch (e) {
  notes.push('refresh_after_save_failed');
}

utils.showNotification({
  title: '✅ AI Season gespeichert',
  description: `${team} · season=1 · 10 Spieltage geplant`,
  notificationType: 'success',
  duration: 5 });

notes.push(`runtime_ms:${Date.now() - t0}`);
return { ok: true, team, season, dryRun: false, savedSlots: rows.length, notes };
