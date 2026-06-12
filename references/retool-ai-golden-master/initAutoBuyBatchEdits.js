// term: AI2_06_SimulatePicks
// id: initAutoBuyBatchEdits
// type: datasource
// subtype: JavascriptQuery
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Documentation:
//   Initializes the auto-buy modal edit state from the CURRENT AI2_06_SimulatePicks.data.
//
//   v4_current_06_sync:
//   - Canonical source is AI2_06_SimulatePicks.data.planned_picks.
//   - Prevents stale modal state from showing old picks after a newer AI2_06 run.
//   - Hard-skip-only: does NOT infer skips from rationale/why/debug text.
//   - Stores simSeed/simVersion per row so stale-state bugs are visible.
//
// Required flow:
//   AI2_04_Planner -> AI2_06_SimulatePicks -> initAutoBuyBatchEdits -> open modal

const hasValue = (v) =>
  v !== undefined &&
  v !== null &&
  String(v).trim() !== '';

const n = (v, fb = 0) => {
  if (!hasValue(v)) return fb;
  const x = Number(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : fb;
};

const s = (v) => String(v ?? '').trim();
const boolTrue = (v) =>
  v === true ||
  String(v ?? '').trim().toLowerCase() === 'true' ||
  String(v ?? '').trim() === '1';

const readAny = (obj, keys, fb = undefined) => {
  if (!obj || typeof obj !== 'object') return fb;

  for (const k of keys) {
    const v = obj[k];
    if (hasValue(v)) return v;
  }

  const lowered = {};
  for (const k of Object.keys(obj)) lowered[String(k).toLowerCase()] = obj[k];

  for (const k of keys) {
    const v = lowered[String(k).toLowerCase()];
    if (hasValue(v)) return v;
  }

  return fb;
};

const sim = AI2_06_SimulatePicks?.data || {};
const rowsRaw = Array.isArray(sim?.planned_picks) ? sim.planned_picks : [];

const rows = rowsRaw.filter((row) => {
  const name = s(readAny(row, ['player_name', 'name', 'Name']));
  const hardStop = boolTrue(readAny(row, ['skip', 'skipped', 'rowSkip'], false)) && !name;
  return name && !hardStop;
});

if (!rows.length) {
  const msg = 'Keine aktuellen AI2_06 Picks gefunden. Bitte erst AI2_06_SimulatePicks ausführen.';

  try {
    utils.showNotification({
      title: 'Batch nicht initialisiert',
      description: msg,
      notificationType: 'warning',
      duration: 6
    });
  } catch (e) {}

  return {
    ok: false,
    reason: 'no_current_ai2_06_picks',
    simVersion: sim?.version,
    simSeed: sim?.simSeed,
    team: sim?.team,
    rowsRaw: rowsRaw.length,
    message: msg
  };
}

const getPickNr = (row, idx) => {
  const raw = readAny(row, ['pick_nr', 'pick', 'pickNr'], idx + 1);
  const val = Math.max(1, Math.round(n(raw, idx + 1)));
  return val;
};

const getName = (row) => s(readAny(row, ['player_name', 'name', 'Name'], ''));

const getContractYears = (row) => {
  const direct = n(readAny(row, ['contract_years', 'contractYears'], null), null);
  const ai = n(readAny(row, ['ai_suggested_years', 'aiSuggestedYears'], null), null);
  const max = n(readAny(row, ['max_contract_years', 'maxContractYears'], 1), 1);
  const base = direct ?? ai ?? 1;
  return Math.max(1, Math.min(Math.max(1, max), Math.round(base)));
};

const isHardSkip = (row) => {
  const rowSkip =
    boolTrue(readAny(row, ['skip', 'skipped', 'rowSkip'], false)) ||
    boolTrue(readAny(row, ['skip_recommended', 'skipRecommended'], false));

  const qualityGateBad = readAny(row, ['quality_gate_ok', 'qualityGateOk'], true) === false;
  const errorReason = s(readAny(row, ['error_reason', 'errorReason'], ''));

  const hardError = [
    'budget_exhausted',
    'no_affordable_candidate',
    'empty_ranked_candidates',
    'pick_engine_failed',
    'no_candidate_in_planned_lane'
  ].includes(errorReason);

  return rowSkip || qualityGateBad || hardError;
};

const edits = {};
let active = 0;
let skipped = 0;

rows.forEach((row, idx) => {
  const pickNr = getPickNr(row, idx);
  const hardSkip = isHardSkip(row);

  if (hardSkip) skipped += 1;
  else active += 1;

  const skipReason = s(
    readAny(row, ['skip_reason', 'skipReason', 'error_reason', 'errorReason'], '')
  );

  const years = getContractYears(row);

  edits[String(pickNr)] = {
    pick_nr: pickNr,
    player_name: getName(row),

    skip: hardSkip,
    skipped: hardSkip,
    rowSkip: hardSkip,

    skip_recommended: boolTrue(readAny(row, ['skip_recommended', 'skipRecommended'], false)),
    skipRecommended: boolTrue(readAny(row, ['skip_recommended', 'skipRecommended'], false)),

    quality_gate_ok: readAny(row, ['quality_gate_ok', 'qualityGateOk'], true) !== false,
    qualityGateOk: readAny(row, ['quality_gate_ok', 'qualityGateOk'], true) !== false,

    skip_reason: skipReason,
    skipReason,

    contract_years: years,
    contractYears: years,
    ai_suggested_years: n(readAny(row, ['ai_suggested_years', 'aiSuggestedYears', 'contract_years'], years), years),
    max_contract_years: Math.max(1, Math.round(n(readAny(row, ['max_contract_years', 'maxContractYears'], years), years))),

    price: n(readAny(row, ['price', 'marktwert', 'mw', 'MW'], 0), 0),
    salary: n(readAny(row, ['salary', 'gehalt', 'Gehalt'], 0), 0),

    pow: n(readAny(row, ['sim_added_pow', 'pow', 'POW', 'Power'], null), null),
    spe: n(readAny(row, ['sim_added_spe', 'spe', 'SPE', 'Speed'], null), null),
    men: n(readAny(row, ['sim_added_men', 'men', 'MEN', 'Mental'], null), null),
    soc: n(readAny(row, ['sim_added_soc', 'soc', 'SOC', 'Social'], null), null),

    klasse: s(readAny(row, ['klasse', 'class', 'Class'], '')),
    class_color: s(readAny(row, ['class_color', 'cardColor', 'card_color'], '')),
    score: n(readAny(row, ['score', 'score_100_final'], null), null),

    simSeed: sim?.simSeed,
    simVersion: sim?.version,
    team: sim?.team,
    initialized_at: Date.now(),
    source: 'initAutoBuyBatchEdits.v4_current_06_sync'
  };
});

await autoBuyBatchEdits.setValue(edits);

try {
  await autoBuyBatchSelectedPick.setValue(null);
} catch (e) {}

try {
  await autoBuyBatchRunState.setValue({
    ...(autoBuyBatchRunState.value || {}),
    inProgress: false,
    initializedAt: Date.now(),
    status: 'ready',
    message: `Batch initialisiert aus aktuellem AI2_06: ${active} aktiv, ${skipped} Skip`,
    perPick: {},
    lastInitRunId: sim?.simSeed || Date.now(),
    simSeed: sim?.simSeed,
    simVersion: sim?.version,
    team: sim?.team
  });
} catch (e) {}

try {
  utils.showNotification({
    title: 'Batch vorbereitet',
    description: `${active} aktive Picks · ${skipped} übersprungen · ${sim?.team || ''}`,
    notificationType: 'success',
    duration: 5
  });
} catch (e) {}

return {
  ok: true,
  simVersion: sim?.version,
  simSeed: sim?.simSeed,
  team: sim?.team,
  count: rows.length,
  active,
  skipped,
  edits,
  preview: Object.values(edits).map((e) => ({
    pick: e.pick_nr,
    name: e.player_name,
    klasse: e.klasse,
    color: e.class_color,
    score: e.score,
    skip: e.skip,
    skipReason: e.skipReason,
    source: e.source
  }))
};

