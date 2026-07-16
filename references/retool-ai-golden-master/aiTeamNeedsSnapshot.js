// term: aiTeamNeeds
// id: aiTeamNeedsSnapshot
// type: script
// subtype: ButtonWidget2
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Documentation:
//   Runs the AI search on demand.
//   Adds a stable deterministic per-run seed (team + runId).
//   - aiRunSeedState: full seed metadata
//   - aiVariationSeed: numeric seedInt for deterministic jitter in reactive transformers
//
// PATCH (Teamwechsel-Fix):
//   - Team ALWAYS read from filterTeam.value (canonical source), never from aiRunTeamContext.
//   - aiRunTeamContext is only the frozen copy for the running run.
//   - If filterTeam.value !== aiLastTeamSelected.value → hard-reset AI state first.
//   - After reset: immediately set aiRunTeamContext = filterTeam.value AND aiLastTeamSelected = filterTeam.value.
//
// PATCH (Needs source-of-truth):
//   - `aiTeamNeeds` (Function) is the authoritative, current Needs logic.
//   - We therefore populate `aiTeamNeedsSnapshot` from `aiTeamNeeds`, NOT from aiTeamNeedsQuery.
//     (aiTeamNeedsQuery remains available for debugging/regression comparison.)
//
// Returns:
//   {
//     runId: number,
//     team: string,
//     needsCount: number,
//     picksCount: number,
//     packagesCount: number,
//     packagesOk: boolean,
//     packagesError?: string,
//     aiWishlistWritten: number,
//     aiWishlistRemoved: number,
//     finalPickCount: number,
//     seedInt: number,
//     seedStr: string,
//     baseWait: {
//       waitedMs: number,
//       baseLen: number,
//       baseRunKeyOk: boolean,
//       expectedBaseRunKey: string,
//       lastSeenBaseRunKey: string
//     }
//   }

const s = (v) => String(v ?? '').trim();
const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const normName = (v) => s(v).toLowerCase();

// ── Team resolution: ALWAYS from filterTeam.value (canonical UI source) ──
const team = s(filterTeam.value);

// ── Team-change guard: if team differs from last selected run, hard-reset first ──
const last = s(aiLastTeamSelected.value);
if (team && last && team !== last) {
  try {
    await resetAiOnTeamChange.trigger();
  } catch (e) {
    console.warn('[runAiSearch] resetAiOnTeamChange failed (continuing):', e);
  }
}

// ── Freeze run context immediately after optional reset ──
// From here on, the run uses this frozen team — unaffected by reactive filterTeam changes.
aiRunTeamContext.setValue(team || null);
aiLastTeamSelected.setValue(team || null);

if (!team) {
  return {
    runId: Number(aiSearchRunId.value || 0),
    team: '',
    needsCount: 0,
    picksCount: 0,
    packagesCount: 0,
    packagesOk: false,
    packagesError: 'no team',
    aiWishlistWritten: 0,
    aiWishlistRemoved: 0,
    finalPickCount: 0,
    seedInt: 0,
    seedStr: '',
    baseWait: {
      waitedMs: 0,
      baseLen: 0,
      baseRunKeyOk: false,
      expectedBaseRunKey: '',
      lastSeenBaseRunKey: String(aiTransferPicksBaseRunKey?.value?.key || '') } };


}

// Deterministic seed helpers (no external libs)
const xfnv1a = (str) => {
  let h = 2166136261;
  const txt = String(str || '');
  for (let i = 0; i < txt.length; i++) {
    h ^= txt.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (predicate, { timeoutMs = 900, intervalMs = 35 } = {}) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    let ok = false;
    try {
      ok = Boolean(predicate());
    } catch (e) {
      ok = false;
    }
    if (ok) return { ok: true, waitedMs: Date.now() - started };
    await sleep(intervalMs);
  }
  return { ok: false, waitedMs: Date.now() - started };
};

const buildFinalPickRows = (rows) => {
  const src = Array.isArray(rows) ? rows : [];
  const valid = src.filter((r) => r && s(r.player_name || r.player));

  const byPlayer = new Map();

  for (const r of valid) {
    const key = normName(r.player_name || r.player);
    if (!key) continue;

    const existing = byPlayer.get(key);
    if (!existing) {
      byPlayer.set(key, r);
      continue;
    }

    const currScore = n(r.final_total_score ?? r.shortlist_score ?? r.score_total);
    const prevScore = n(existing.final_total_score ?? existing.shortlist_score ?? existing.score_total);
    const currFit = n(r.fit ?? r.team_fit);
    const prevFit = n(existing.fit ?? existing.team_fit);
    const currMw = n(r.market_value ?? r.mw ?? r.MW ?? r.marktwert);
    const prevMw = n(existing.market_value ?? existing.mw ?? existing.MW ?? existing.marktwert);

    const isBetter =
    currScore > prevScore ||
    currScore === prevScore && currFit > prevFit ||
    currScore === prevScore && currFit === prevFit && currMw < prevMw;

    if (isBetter) byPlayer.set(key, r);
  }

  const deduped = [...byPlayer.values()].map((r) => {
    const finalTotal = n(r.final_total_score ?? r.shortlist_score ?? r.score_total);
    const mw = n(r.market_value ?? r.mw ?? r.MW ?? r.marktwert);
    const sal = n(r.salary ?? r.gehalt);
    const fit = n(r.fit ?? r.team_fit);
    const remainingCash = n(r.remaining_cash_after_pick);

    return {
      ...r,
      player_name: s(r.player_name || r.player),
      primary_need: s(r.primary_need || r.need_label || r.primary_need_type || ''),
      market_value: mw,
      salary: sal,
      fit,
      final_total_score: finalTotal,
      remaining_cash_after_pick: remainingCash };

  });

  deduped.sort((a, b) => {
    const d1 = n(b.final_total_score) - n(a.final_total_score);
    if (d1 !== 0) return d1;
    const d2 = n(b.fit) - n(a.fit);
    if (d2 !== 0) return d2;
    return n(a.market_value) - n(b.market_value);
  });

  return deduped.map((r, idx) => ({ ...r, rank: idx + 1 }));
};

const findCandidateByName = (pool, playerName) => {
  const key = normName(playerName);
  if (!key) return null;
  const exact = pool.find((c) => normName(c?.player_name || c?.name) === key);
  if (exact) return exact;
  const includesA = pool.find((c) => normName(c?.player_name || c?.name).includes(key));
  if (includesA) return includesA;
  const includesB = pool.find((c) => key.includes(normName(c?.player_name || c?.name)));
  if (includesB) return includesB;
  return null;
};

// ------------------------------------------------------------
// Stable Run ID + Seed
// ------------------------------------------------------------
const runId = Number(aiSearchRunId.value || 0) + 1;
aiSearchRunId.setValue(runId);

const seedStr = `aiSearchSeed.v1::${team}::${runId}`;
const seedInt = xfnv1a(seedStr);

aiRunSeedState.setValue({
  runId,
  team,
  seedInt,
  seedStr,
  createdAt: new Date().toISOString() });


aiVariationSeed.setValue(seedInt);

// 0) Reliability prefetch — player data + matrices
try {
  await getOlympiadeData.trigger();
  await Promise.all([
  getAllActivePlayers.trigger(),
  getSoldPlayersCurrentSeason.trigger(),
  getPlayerAttributesForAI.trigger(),
  getTeamRassenMatrix.trigger(),
  getTeamSubclassesMatrix.trigger(),
  getTeamTraitsMatrix.trigger(),
  getTeamAlignmentMatrix.trigger(),
  getTransfersFromDB.trigger(),
  getActivePlayersByTeam.trigger(),
  getTeamRatingsTransfermarkt.trigger()]);

} catch (e) {
  console.warn('[runAiSearch] prefetch failed (continuing):', e);
}

// 0a) Cash prefetch
try {
  await getSaisonstandFromDB.trigger();
} catch (e) {
  console.warn('[runAiSearch] getSaisonstandFromDB prefetch failed (continuing):', e);
}

// 0b) Load discipline schedule
try {
  dynamicSqlToExecute.setValue(
  'SELECT disziplin, reihenfolge, player FROM "Diszireihenfolge" ORDER BY reihenfolge ASC;');


  await executeDynamicSql.trigger();
} catch (e) {
  console.warn('[runAiSearch] discipline schedule prefetch failed (continuing):', e);
}

// 1) Needs (AUTHORITATIVE: aiTeamNeeds Function)
let needs = [];
try {
  // Ensure base context is fresh before reading the Function (best-effort)
  await refreshTeamContextBase.trigger();
} catch (e) {
  console.warn('[runAiSearch] refreshTeamContextBase failed before needs (continuing):', e);
}

try {
  const v = aiTeamNeeds.value ?? aiTeamNeeds;
  needs = Array.isArray(v) ? v : [];
} catch (e) {
  console.warn('[runAiSearch] could not read aiTeamNeeds.value:', e);
  needs = [];
}

aiTeamNeedsSnapshot.setValue(needs);

// 1b) Wait for reactive base picks to recompute (freshness-guarded)
const expectedBaseRunKey = String(aiTransferPicksBaseRunKey?.value?.key || '');
let lastSeenBaseRunKey = expectedBaseRunKey;

const baseWaitRes = await waitFor(
() => {
  const base = aiTransferPicksBase.value;
  const baseLen = Array.isArray(base) ? base.length : 0;

  lastSeenBaseRunKey = String(aiTransferPicksBaseRunKey?.value?.key || '');

  const baseIsNonEmpty = baseLen > 0;
  const baseIsFreshForRun = Boolean(expectedBaseRunKey) && lastSeenBaseRunKey === expectedBaseRunKey;

  return baseIsNonEmpty && baseIsFreshForRun;
},
{ timeoutMs: 1100, intervalMs: 35 });


const baseLenNow = Array.isArray(aiTransferPicksBase.value) ? aiTransferPicksBase.value.length : 0;
const baseRunKeyOk =
Boolean(expectedBaseRunKey) && String(aiTransferPicksBaseRunKey?.value?.key || '') === expectedBaseRunKey;

// 2) Picks
const picksRaw = await aiTransferPicksQuery.trigger();
const picks = Array.isArray(picksRaw) ?
picksRaw :
Array.isArray(aiTransferPicksQuery.data) ?
aiTransferPicksQuery.data :
[];
aiTransferPicksSnapshot.setValue(picks);

// 3) Packages (DISABLED)
const packagesOk = true;
const packagesError = undefined;
const packages = [];
aiTransferPackagesSnapshot.setValue([]);

// 4) Final Picks -> Wishlist (FULLY ENRICHED)
const AI_WISHLIST_MARKER = 'ai_top10';
const finalRows = buildFinalPickRows(picks);

const candidatePool = Array.isArray(aiTransferCandidatePool.value) ? aiTransferCandidatePool.value : [];
const nowIso = new Date().toISOString();

const aiWishlistEntries = finalRows.map((r) => {
  const playerName = s(r.player_name || r.player);
  const candidate = findCandidateByName(candidatePool, playerName) || {};

  const mw = n(
  r.market_value ?? r.mw ?? r.MW ?? r.marktwert ??
  candidate.marktwert ?? candidate.market_value ?? candidate.mw_neu);


  const sal = n(
  r.salary ?? r.gehalt ?? candidate.gehalt ?? candidate.salary ?? candidate.gehalt_rechnung);


  const fit = n(r.fit ?? r.team_fit ?? candidate.team_fit);

  return {
    name: playerName,
    player_name: playerName,
    team,
    target_team: team,
    current_team: s(r.current_team || candidate.team || r.team || ''),
    wishlist_type: AI_WISHLIST_MARKER,
    source: 'ai_transfer_search',
    ai_run_id: runId,
    ai_run_seed: seedInt,
    created_at: nowIso,
    rank: n(r.rank),
    final_total_score: n(r.final_total_score),
    primary_need: s(r.primary_need || r.need_label || ''),
    marktwert: mw,
    market_value: mw,
    gehalt: sal,
    salary: sal,
    team_fit: fit,
    fit,
    pow: n(candidate.pow),
    spe: n(candidate.spe),
    men: n(candidate.men),
    soc: n(candidate.soc),
    klasse: s(candidate.klasse),
    rasse: s(candidate.rasse ?? candidate.race),
    subclass1: s(candidate.subclass1),
    subclass2: s(candidate.subclass2),
    subclass3: s(candidate.subclass3),
    count_gt20: n(candidate.count_gt20 ?? candidate.gt20 ?? candidate['20']),
    count_gt40: n(candidate.count_gt40 ?? candidate.gt40 ?? candidate['40']),
    count_gt60: n(candidate.count_gt60 ?? candidate.gt60 ?? candidate['60']),
    count_gt80: n(candidate.count_gt80 ?? candidate.gt80 ?? candidate['80']),
    image: s(candidate.image ?? candidate.bild ?? candidate.img ?? ''),
    bild: s(candidate.bild ?? candidate.image ?? candidate.img ?? ''),
    health: n(candidate.health),
    stamina: n(candidate.stamina),
    intelligence: n(candidate.intelligence),
    awareness: n(candidate.awareness),
    determination: n(candidate.determination),
    dexterity: n(candidate.dexterity),
    charisma: n(candidate.charisma),
    will: n(candidate.will),
    spirit: n(candidate.spirit),
    torment: n(candidate.torment) };

});

const currentWishlist = Array.isArray(pickedPlayers.value) ? pickedPlayers.value : [];
const removedAiCount = currentWishlist.filter((p) => s(p?.wishlist_type) === AI_WISHLIST_MARKER).length;
const keepManual = currentWishlist.filter((p) => s(p?.wishlist_type) !== AI_WISHLIST_MARKER);
const manualNames = new Set(keepManual.map((p) => normName(p?.name || p?.player_name)).filter(Boolean));

const aiFiltered = aiWishlistEntries.filter((p) => !manualNames.has(normName(p?.name || p?.player_name)));

const seen = new Set();
const aiDeduped = [];
for (const p of aiFiltered) {
  const key = normName(p?.name || p?.player_name);
  if (!key || seen.has(key)) continue;
  seen.add(key);
  aiDeduped.push(p);
}

pickedPlayers.setValue([...keepManual, ...aiDeduped]);

return {
  runId,
  team,
  needsCount: needs.length,
  picksCount: picks.length,
  packagesCount: packages.length,
  packagesOk,
  packagesError,
  aiWishlistWritten: aiDeduped.length,
  aiWishlistRemoved: removedAiCount,
  finalPickCount: finalRows.length,
  seedInt,
  seedStr,
  baseWait: {
    waitedMs: baseWaitRes.waitedMs,
    baseLen: baseLenNow,
    baseRunKeyOk,
    expectedBaseRunKey,
    lastSeenBaseRunKey } };
