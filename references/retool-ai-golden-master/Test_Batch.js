// term: AI2_06_SimulatePicks
// id: Test_Batch
// type: datasource
// subtype: JavascriptQuery
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
const n = (v, fb = null) => {
  const x = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(x) ? x : fb;
};

const sim = AI2_06_SimulatePicks.data || {};
const picks = Array.isArray(sim.planned_picks) ? sim.planned_picks : [];

const edits = {};

for (let i = 0; i < picks.length; i++) {
  const p = picks[i];
  const pickNr = n(p?.pick_nr, i + 1);
  const name = String(p?.player_name || p?.name || '').trim();

  if (!name) continue;

  const hardSkip = p?.skip === true || p?.skipped === true;

  edits[pickNr] = {
    pick_nr: pickNr,
    player_name: name,

    skip: hardSkip,
    skipped: hardSkip,
    rowSkip: hardSkip,

    skip_recommended: p?.skip_recommended === true,
    skipRecommended: p?.skip_recommended === true,

    quality_gate_ok: p?.quality_gate_ok !== false,
    qualityGateOk: p?.quality_gate_ok !== false,

    skip_reason: String(p?.skip_reason || ''),
    skipReason: String(p?.skip_reason || ''),

    contract_years: p?.contract_years ?? p?.ai_suggested_years ?? 1,
    contractYears: p?.contract_years ?? p?.ai_suggested_years ?? 1,
    ai_suggested_years: p?.ai_suggested_years ?? p?.contract_years ?? 1,
    max_contract_years: p?.max_contract_years ?? 1,

    price: n(p?.price, 0),
    salary: n(p?.salary ?? p?.gehalt, 0),

    pow: n(p?.sim_added_pow ?? p?.pow, null),
    spe: n(p?.sim_added_spe ?? p?.spe, null),
    men: n(p?.sim_added_men ?? p?.men, null),
    soc: n(p?.sim_added_soc ?? p?.soc, null),

    klasse: p?.klasse,
    score: n(p?.score, null),

    simSeed: sim?.simSeed,
    simVersion: sim?.version,
    initialized_at: Date.now(),
    source: 'SYNC_CURRENT_06_TO_MODAL_EDITS.v1'
  };
}

if (typeof autoBuyBatchEdits !== 'undefined') {
  await autoBuyBatchEdits.setValue(edits);
}

if (typeof autoBuyBatchRunState !== 'undefined') {
  await autoBuyBatchRunState.setValue({
    ...(autoBuyBatchRunState.value || {}),
    status: 'ready',
    message: `Modal synced from current AI2_06: ${Object.keys(edits).length} picks`,
    lastInitRunId: sim?.simSeed || Date.now()
  });
}

return {
  ok: true,
  simVersion: sim?.version,
  simSeed: sim?.simSeed,
  team: sim?.team,
  syncedPicks: Object.values(edits).map((x) => ({
    pick: x.pick_nr,
    name: x.player_name,
    klasse: x.klasse,
    score: x.score,
    source: x.source
  }))
};
