// term: seasonPlannerEngine
// id: seasonPlannerEngineInput
// type: state
// subtype: State
// page: Einsatzliste
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Documentation:
//   seasonPlannerEngineV7
//
//   Goals:
//   - dynamic team identity from DB row input.teamRatingsRow (power/speed/mental/social)
//   - strong team-color logic from the 4 team areas
//   - stronger captain opportunity logic with strategy bias
//   - positive cards with strong color-match priority (existing logic mostly preserved)
//   - negative cards by minimal expected damage, with MUCH stronger punishments for:
//       * color-match negatives
//       * core-color negatives
//       * strong / important disciplines
//     and better parking on:
//       * low AVG
//       * bad proxy rank
//       * off-focus disciplines
//   - HARD RULES:
//       * max 2 cards per discipline
//       * max 1 negative card per discipline
//       * formkarte_id_2 may NEVER be negative
//       * if a negative card exists in a discipline, it must sit in slot 1
//   - finalized slots first, then captain/cards
//   - reservation logic so enough empty slot-1 disciplines remain for negatives
//   - final sweep over input.cards (DB-backed formkarten_v2 rows passed in) so no legal cards remain unplaced
//   - seeded near-tie variety for captain / cards without heavy randomness
//
// Expected additional input:
//   input.teamRatingsRow = {
//     name: "Dire Legion",
//     power: 10,
//     speed: 0,
//     mental: 0,
//     social: 10,
//     ...
//   }
//
// Returns:
//   {
//     ok: boolean,
//     meta?: { team?: string, season?: number },
//     spieltage?: Array<...>,
//     notes: string[],
//     allocationSummary?: {
//       placedCardIds: number[],
//       unplacedPositiveCardIds: number[],
//       unplacedNegativeCardIds: number[]
//     }
//   }

const t0 = Date.now();
const input = seasonPlannerEngineInput.value || {};

const s = (v) => String(v ?? '').trim();
const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const team = s(input.team || '');
const season = n(input.season || 0);

const config = input.config || {};
const CAP_UNIQUE = clamp(n(config.capUniquePlayers || 12), 1, 50);
const CAPTAIN_SLOTS = clamp(n(config.captainSlots || 3), 0, 10);
const PRESERVE_HORIZON = clamp(n(config.preserveHorizon || 3), 0, 10);
const PRESERVE_PREVENTIVE_W = clamp(n(config.preservePreventiveW ?? 0.18), 0, 1);
const PRESERVE_SCALE = n(config.preserveScale ?? 2.8);

const HYBRID_AVG_W = clamp(n(config.hybridAvgW ?? 0.70), 0, 1);
const HYBRID_SUMSCALED_W = clamp(n(config.hybridSumScaledW ?? 0.30), 0, 1);

const TEAM_BIAS_PICK_W = n(config.teamBiasPickW ?? 1.45);
const TEAM_BIAS_PLAYER_W = n(config.teamBiasPlayerW ?? 0.16);

const PICKORDER_DIFF_THR = n(config.pickOrderDiffThreshold ?? 0.2);
const PICKORDER_OPP_THR = n(config.pickOrderOppThreshold ?? 0.25);

// Positive-card knobs
const POS_SECOND_MARGIN = n(config.posSecondMargin ?? 2.0);
const POS_BASE_COLOR_MATCH_MULT = n(config.posBaseColorMatchMult ?? 2.00);
const POS_BASE_COLOR_MISMATCH_MULT = n(config.posBaseColorMismatchMult ?? 0.72);
const POS_TEAM_FOCUS_W = n(config.posTeamFocusW ?? 3.25);
const POS_BIG_DISZI_W = n(config.posBigDisziW ?? 1.35);
const POS_AVG_QUALITY_W = n(config.posAvgQualityW ?? 1.75);
const POS_COLOR_KEEP_W = n(config.posColorKeepW ?? 2.10);
const POS_OFFFOCUS_WASTE_PENALTY = n(config.posOfffocusWastePenalty ?? 9.5);
const POS_LOWAVG_WASTE_PENALTY = n(config.posLowavgWastePenalty ?? 6.0);
const POS_BIG_CORE_KEEP_BONUS = n(config.posBigCoreKeepBonus ?? 8.5);
const POS_VALUE_ON_CORE_W = n(config.posValueOnCoreW ?? 1.15);
const POS_MEGA_CORE_MATCH_BONUS = n(config.posMegaCoreMatchBonus ?? 12.0);

// Negative placement knobs
const NEG_BOTTOM_QUARTER_FACTOR = n(config.negBottomQuarterFactor ?? 0.82);
const NEG_MATCH_COLOR_FACTOR = n(config.negMatchColorFactor ?? 1.65);
const NEG_MISMATCH_COLOR_FACTOR = n(config.negMismatchColorFactor ?? 0.80);
const NEG_CORE_DISZI_FACTOR = n(config.negCoreDisziFactor ?? 1.48);
const NEG_MEGA_CORE_DISZI_FACTOR = n(config.negMegaCoreDisziFactor ?? 1.72);
const NEG_BIG_DISZI_FACTOR = n(config.negBigDisziFactor ?? 1.10);
const NEG_STRONG_AVG_FACTOR = n(config.negStrongAvgFactor ?? 1.18);
const NEG_WEAK_AVG_BONUS = n(config.negWeakAvgBonus ?? 0.78);
const NEG_WEAK_RANK_BONUS = n(config.negWeakRankBonus ?? 0.78);
const NEG_WEAK_COMBO_BONUS = n(config.negWeakComboBonus ?? 0.64);

// Captain strategy knobs
const CAP_CORE_BONUS = n(config.capCoreBonus ?? 10.0);
const CAP_MEGA_CORE_BONUS = n(config.capMegaCoreBonus ?? 18.0);
const CAP_OFFCOLOR_PENALTY = n(config.capOffcolorPenalty ?? 10.0);
const CAP_SECOND_OFFCOLOR_PENALTY = n(config.capSecondOffcolorPenalty ?? 24.0);
const CAP_NO_FORM_CORE_BONUS = n(config.capNoFormCoreBonus ?? 10.0);
const CAP_BIG_CORE_BONUS = n(config.capBigCoreBonus ?? 5.0);
const CAP_NEG_FORM_PENALTY = n(config.capNegFormPenalty ?? 42.0);
const CAP_NEG_FORM_HARD_PENALTY = n(config.capNegFormHardPenalty ?? 999.0);
const CAP_SMALL_OFFCOLOR_PENALTY = n(config.capSmallOffcolorPenalty ?? 5.0);

// Small seeded variety for near-ties
const TIE_BAND_POS = n(config.tieBandPos ?? 3.0);
const TIE_BAND_NEG = n(config.tieBandNeg ?? 1.4);
const TIE_BAND_CAP = n(config.tieBandCap ?? 5.0);
const TIE_JITTER_POS = n(config.tieJitterPos ?? 0.55);
const TIE_JITTER_NEG = n(config.tieJitterNeg ?? 0.35);
const TIE_JITTER_CAP = n(config.tieJitterCap ?? 0.65);

const notes = [];

// --------------------------------------------------
// Validation / required inputs
// --------------------------------------------------
const roster = Array.isArray(input.roster) ? input.roster.filter((p) => !!p && s(p.name)) : [];
const schedule = Array.isArray(input.schedule) ? input.schedule : [];
const ptsRows = Array.isArray(input.punktetabelleRows) ? input.punktetabelleRows : [];
const cardsIn = Array.isArray(input.cards) ? input.cards : [];
const colorMap = input.disziColorMapping && typeof input.disziColorMapping === 'object' ? input.disziColorMapping : {};
const proxyTeams = input.proxyTeams && typeof input.proxyTeams === 'object' ? input.proxyTeams : null;
const teamBiasByDiszi = input.teamBiasByDiszi && typeof input.teamBiasByDiszi === 'object' ? input.teamBiasByDiszi : {};
const captainUsedCount = clamp(n(input.captainUsedCount || 0), 0, CAPTAIN_SLOTS);
const teamRatingsRow = input.teamRatingsRow && typeof input.teamRatingsRow === 'object' ? input.teamRatingsRow : null;

if (!roster.length) {
  return { ok: false, meta: { team, season }, spieltage: [], notes: ['no_roster'] };
}
if (!schedule.length) {
  return { ok: false, meta: { team, season }, spieltage: [], notes: ['no_schedule'] };
}
if (!ptsRows.length) {
  return { ok: false, meta: { team, season }, spieltage: [], notes: ['no_punktetabelleRows'] };
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------
const hash01 = (str) => {
  let h = 2166136261;
  const ss = String(str);
  for (let i = 0; i < ss.length; i++) {
    h ^= ss.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
};

const tieJitter = (tag, magnitude = 0.5) => {
  return ((hash01(`${team}|${season}|${tag}`) - 0.5) * 2) * magnitude;
};

const chooseBetterCandidate = (current, next, band, jitterMagnitude, tagPrefix) => {
  if (!current) return next;
  if (!next) return current;

  if (next.score > current.score + band) return next;
  if (current.score > next.score + band) return current;

  const curTie = current.score + tieJitter(`${tagPrefix}|${current.sl.spieltag}|${current.sl.disziplinNr}`, jitterMagnitude);
  const nxtTie = next.score + tieJitter(`${tagPrefix}|${next.sl.spieltag}|${next.sl.disziplinNr}`, jitterMagnitude);
  return nxtTie > curTie ? next : current;
};

const normTeam = (x) => s(x).toUpperCase().replace(/\s*-\s*/g, '-');
const teamNorm = normTeam(team);

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
    eiskunstlauf: 'eiskunst'
  };
  return (map[k] || k).replace(/\s+/g, '_').replace(/-/g, '_');
};

const ptsByRank = {};
for (const r of ptsRows) {
  const rk = n(r?.Rank);
  if (!rk) continue;
  ptsByRank[rk] = {
    2: n(r?.['2_Players']),
    3: n(r?.['3_players']),
    4: n(r?.['4_players']),
    5: n(r?.['5_players']),
    6: n(r?.['6_players'])
  };
}

const pointsFor = (rank, pc) => {
  const row = ptsByRank[clamp(Math.round(n(rank)), 1, 128)];
  if (!row) return 0;
  return n(row[clamp(Math.round(n(pc)), 2, 6)]);
};
const maxPP = (pc) => pointsFor(1, pc);
const maxPP6 = Math.max(0.01, maxPP(6));

const mkExplain = () => ({ tags: [], comments: [] });
const playersRequiredNorm = (cnt) => clamp(Math.round(n(cnt)), 2, 6);

// --------------------------------------------------
// Dynamic team identity from Team Ratings row
// --------------------------------------------------
const COLOR_TO_AXIS = {
  red: 'power',
  green: 'speed',
  blue: 'mental',
  yellow: 'social',
  rot: 'power',
  gruen: 'speed',
  grün: 'speed',
  blau: 'mental',
  gelb: 'social'
};

const normColor = (c) => s(c).toLowerCase();

const getTeamAxisRating = (axis) => {
  if (!teamRatingsRow) return 5;
  return clamp(n(teamRatingsRow?.[axis]), 0, 20);
};

const getAxisForDiszi = (disziName) => {
  const color = normColor(colorMap?.[disziName]);
  return COLOR_TO_AXIS[color] || null;
};

const dynamicColorFocusForDiszi = (disziName) => {
  const axis = getAxisForDiszi(disziName);
  if (!axis) return 0;

  const raw = getTeamAxisRating(axis);

  if (raw <= 5) return clamp((raw - 5) / 5, -1.0, 0);
  if (raw <= 10) return (raw - 5) / 5;
  return clamp(1 + ((raw - 10) / 10) * 0.9, 1, 1.9);
};

const getDynamicFocusReason = (disziName) => {
  const axis = getAxisForDiszi(disziName);
  if (!axis) return 'dynamic_focus:none';
  return `dynamic_focus:${axis}=${getTeamAxisRating(axis)}`;
};

// --------------------------------------------------
// Cards module
// --------------------------------------------------
const buildCardsModule = (params) => {
  const cardsInLocal = Array.isArray(params?.cardsIn) ? params.cardsIn : [];
  const colorMapLocal = params?.colorMap && typeof params.colorMap === 'object' ? params.colorMap : {};

  const allCards = cardsInLocal
    .map((c) => ({
      id: n(c?.id),
      v: n(c?.v),
      c: s(c?.c),
      used: !!c?.used
    }))
    .filter((c) => c.id && c.v !== 0);

  const cardById = new Map();
  for (const c of allCards) cardById.set(c.id, c);

  const posUnused = allCards.filter((c) => !c.used && c.v > 0).sort((a, b) => b.v - a.v);
  const negUnused = allCards.filter((c) => !c.used && c.v < 0).sort((a, b) => a.v - b.v);

  const posByColor = {};
  for (const c of posUnused) {
    const cc = s(c.c);
    if (!posByColor[cc]) posByColor[cc] = [];
    posByColor[cc].push(c);
  }

  const cardOpportunityForDiszi = (disziName) => {
    const disziColor = colorMapLocal?.[disziName] || null;

    const posMatch = disziColor ? posUnused.filter((c) => c.c === disziColor) : [];
    const posMatchTop = posMatch.slice(0, 2).reduce((a, c) => a + Math.abs(c.v), 0);

    const negMismatch = disziColor ? negUnused.filter((c) => c.c && c.c !== disziColor) : negUnused;
    const negMismatchTop = negMismatch.slice(0, 2).reduce((a, c) => a + Math.abs(c.v), 0);

    const score =
      0.65 * posMatchTop +
      0.20 * Math.min(10, negMismatchTop) +
      0.15 * Math.min(6, posMatch.length);

    const reasons = [];
    if (disziColor && posMatchTop > 0) reasons.push(`+ Pos. Karten (Match ${disziColor}): ~${posMatchTop.toFixed(0)}`);
    if (negMismatchTop > 0) reasons.push(`+ Negativ-Parking möglich: ~${negMismatchTop.toFixed(0)}`);
    if (!reasons.length) reasons.push('± Keine klaren Karten-Synergien');

    return { score: Math.round(score * 100) / 100, reasons, disziColor };
  };

  return {
    allCards,
    cardById,
    posUnused,
    negUnused,
    posByColor,
    cardOpportunityForDiszi
  };
};

const cardsModule = buildCardsModule({ cardsIn, colorMap });
const cardById = cardsModule.cardById;
const posUnused = cardsModule.posUnused;
const negUnused = cardsModule.negUnused;
const posByColor = cardsModule.posByColor;
const cardOpportunityForDiszi = cardsModule.cardOpportunityForDiszi;

// --------------------------------------------------
// Fatigue / preserve
// --------------------------------------------------
const fatigue = {};
for (const p of roster) fatigue[String(p.name)] = 0;

const fatigueMult = (count) =>
  count >= 4 ? 0.80 :
  count >= 3 ? 0.85 :
  count >= 2 ? 0.90 :
  count >= 1 ? 0.95 : 1.0;

const base = (p, disziName) => n(p?.[colForName(disziName)]);
const cur = (p, disziName) => base(p, disziName) * fatigueMult(n(fatigue[String(p?.name)] || 0));

const preservePenalty = (p, stNow, disziNow) => {
  const name = String(p?.name ?? '');
  if (!name) return 0;

  const seasonProgress = clamp(stNow / 10, 0, 1);
  const earlyW = 1 - seasonProgress;

  const bNow = base(p, disziNow);
  const starW = clamp((bNow - 10) / 25, 0, 1);

  let futureBest = 0;
  for (let st = stNow + 1; st <= Math.min(10, stNow + PRESERVE_HORIZON); st++) {
    const row = schedule.find((x) => n(x?.st) === st);
    if (row?.d1?.name) futureBest = Math.max(futureBest, base(p, row.d1.name));
    if (row?.d2?.name) futureBest = Math.max(futureBest, base(p, row.d2.name));
  }
  const futureW = clamp((futureBest - 10) / 25, 0, 1);

  const relevance = 0.50 * starW + 0.50 * futureW;
  return PRESERVE_SCALE * PRESERVE_PREVENTIVE_W * (0.60 * earlyW + 0.40) * relevance;
};

// --------------------------------------------------
// Proxy rank eval
// --------------------------------------------------
const buildProxyRankEvalModule = (params) => {
  const proxyTeamsLocal = params?.proxyTeams && typeof params.proxyTeams === 'object' ? params.proxyTeams : null;
  const teamNormLocal = String(params?.teamNorm || '');
  const colForNameLocal = params?.colForName;
  const normTeamLocal = params?.normTeam;
  const clampLocal = params?.clamp;
  const nLocal = params?.n;

  const proxyRankEval = (disziName, pc, addBoostToOurSum) => {
    if (!proxyTeamsLocal) return { ok: false };

    const col = colForNameLocal(disziName);
    const strengths = Object.entries(proxyTeamsLocal)
      .map(([t, plist]) => {
        const vals = (Array.isArray(plist) ? plist : [])
          .map((x) => nLocal(x?.[col]))
          .filter((v) => v > 0)
          .sort((a, b) => b - a)
          .slice(0, pc);
        return { team: normTeamLocal(t), sum: vals.reduce((a, b) => a + b, 0) };
      })
      .filter((r) => r.sum > 0)
      .sort((a, b) => b.sum - a.sum);

    const i0 = strengths.findIndex((r) => r.team === teamNormLocal);
    if (i0 < 0) return { ok: false };

    const beforeRank = i0 + 1;
    const projected = strengths[i0].sum + nLocal(addBoostToOurSum);

    const after = strengths
      .map((r) => r.team === teamNormLocal ? { ...r, sum: projected } : r)
      .sort((a, b) => b.sum - a.sum);

    const i1 = after.findIndex((r) => r.team === teamNormLocal);
    const afterRank = i1 + 1;

    const marginToNext = i1 > 0 ? Math.max(0, after[i1 - 1].sum - projected) : null;
    const marginToBelow = i1 < after.length - 1 ? Math.max(0, projected - after[i1 + 1].sum) : null;

    const closeness = marginToNext == null ? 0 : 1 / (1 + marginToNext);
    const defenseRisk = marginToBelow == null ? 0 : 1 / (1 + marginToBelow);

    const realism = clampLocal(1 - (beforeRank - 1) / 12, 0, 1);
    const swing = clampLocal(0.55 * closeness + 0.45 * Math.min(1, Math.max(0, beforeRank - afterRank) / 2), 0, 1);

    return { ok: true, beforeRank, afterRank, closeness, defenseRisk, realism, swing };
  };

  return { proxyRankEval };
};

const { proxyRankEval } = buildProxyRankEvalModule({
  proxyTeams,
  teamNorm,
  colForName,
  normTeam,
  clamp,
  n
});

// --------------------------------------------------
// Team bias helpers
// --------------------------------------------------
const getTeamBiasForDiszi = (disziName) => {
  const entry = teamBiasByDiszi?.[disziName];
  return {
    bias: n(entry?.bias),
    reasons: Array.isArray(entry?.reasons) ? entry.reasons : []
  };
};

const normalizedTeamBias = (disziName) => {
  const manualBias = clamp(getTeamBiasForDiszi(disziName).bias / 10, -1.25, 1.25);
  const dynamicBias = dynamicColorFocusForDiszi(disziName);
  return clamp(dynamicBias * 0.90 + manualBias * 0.10, -1.25, 1.95);
};

const focusLevelForDiszi = (disziName) => {
  const nb = normalizedTeamBias(disziName);
  if (nb >= 1.2) return 'mega-core';
  if (nb >= 0.75) return 'core';
  if (nb >= 0.25) return 'good';
  if (nb <= -0.35) return 'off';
  return 'neutral';
};

// --------------------------------------------------
// Slot / lineup helpers
// --------------------------------------------------
const avgSumLineup = (disziName, names, valueFn) => {
  const set = new Set((names || []).map(String));
  const vals = roster
    .filter((p) => set.has(String(p.name)))
    .map((p) => valueFn(p, disziName))
    .filter((v) => Number.isFinite(v));
  const sum = vals.reduce((a, b) => a + b, 0);
  return { sum, avg: vals.length ? sum / vals.length : 0, count: vals.length };
};

const bestInLineup = (disziName, names, valueFn) => {
  const set = new Set((names || []).map(String));
  let best = 0;
  for (const p of roster) {
    if (!set.has(String(p.name))) continue;
    best = Math.max(best, valueFn(p, disziName));
  }
  return best;
};

const hybridSlotScore = (avg, sum, pc, realism, swing) => {
  const pcClamped = clamp(pc, 2, 6);
  const sumScaled = sum / 6;
  const strength = HYBRID_AVG_W * avg + HYBRID_SUMSCALED_W * sumScaled;

  const ppCeil = Math.max(0.01, maxPP(pcClamped));
  const volumeW = 0.55 + 0.45 * (ppCeil / maxPP6);
  const realismW = 0.25 + 0.75 * clamp(realism ?? 0.5, 0, 1);
  const swingW = 0.65 + 0.70 * clamp(swing ?? 0.25, 0, 1);

  return { score: strength * volumeW * realismW * swingW, strength, ppCeil };
};

const enforceCapUnique = (d1cfg, d2cfg, d1Picked, d2Picked) => {
  const combined = () => [
    ...d1Picked.map((name) => ({ disz: 1, name })),
    ...d2Picked.map((name) => ({ disz: 2, name }))
  ];
  const uniq = () => Array.from(new Set(combined().map((x) => x.name)));

  while (uniq().length > CAP_UNIQUE) {
    let worst = null;
    for (const item of combined()) {
      const disziName = item.disz === 1 ? d1cfg.name : d2cfg.name;
      const p = roster.find((x) => String(x.name) === String(item.name));
      const v = cur(p, disziName);
      if (!worst || v < worst.v) worst = { ...item, v };
    }
    if (!worst) break;
    const arr = worst.disz === 1 ? d1Picked : d2Picked;
    const idx = arr.findIndex((x) => String(x) === String(worst.name));
    if (idx >= 0) arr.splice(idx, 1);
  }
  return { d1Picked, d2Picked };
};

const evalSlot = (disziName, picked) => {
  const as = avgSumLineup(disziName, picked, cur);
  const pc = clamp(as.count, 2, 6);

  const pr = proxyRankEval(disziName, pc, 0);
  const hybrid = hybridSlotScore(as.avg, as.sum, pc, pr.ok ? pr.realism : 0.5, pr.ok ? pr.swing : 0.25);
  const opp = cardOpportunityForDiszi(disziName);

  const dynTeamBias = normalizedTeamBias(disziName);
  const cardsBias = n(opp.score) * 0.25 * pc;
  const teamBias = dynTeamBias * TEAM_BIAS_PICK_W * 10;
  const fatigueSum = (picked || []).reduce((acc, name) => acc + n(fatigue[String(name)] || 0), 0);

  return {
    as,
    pc,
    pr,
    hybrid,
    opp,
    cardsBias,
    teamBias,
    teamBiasReasons: getTeamBiasForDiszi(disziName).reasons,
    dynTeamBias,
    fatigueSum,
    score: hybrid.score + cardsBias + teamBias
  };
};

// --------------------------------------------------
// Player pick logic
// --------------------------------------------------
const pickFor = (st, diszi, excluded) => {
  const rawNeed = n(diszi.players);
  const need = rawNeed === 2 ? 2 : rawNeed === 4 ? 4 : clamp(rawNeed, 0, CAP_UNIQUE);

  const disziBias = normalizedTeamBias(diszi.name);

  const scored = roster
    .filter((p) => !excluded.has(String(p.name)))
    .map((p) => {
      const b = base(p, diszi.name);
      const c = cur(p, diszi.name);

      const amp = Math.max(0.25, Math.min(1.25, b * 0.015));
      const noise = (hash01(`seasonv7|${teamNorm}|${season}|${st}|${diszi.name}|${p.name}`) - 0.5) * amp;

      const teamBiasPlayer = disziBias * TEAM_BIAS_PLAYER_W * Math.max(6, b);
      const score = c + noise + teamBiasPlayer - preservePenalty(p, st, diszi.name);

      return { name: String(p.name), score };
    })
    .sort((a, b) => b.score - a.score);

  const picked = scored.slice(0, need).map((r) => r.name);
  picked.forEach((nm) => excluded.add(nm));
  return picked;
};

// --------------------------------------------------
// Main slot planning
// --------------------------------------------------
const spieltage = [];

for (const row of schedule) {
  const st = n(row?.st);
  const d1cfg = row?.d1;
  const d2cfg = row?.d2;

  if (!st || !d1cfg?.name || !d2cfg?.name) {
    notes.push(`invalid_schedule_row:${JSON.stringify({ st: row?.st, d1: row?.d1?.name, d2: row?.d2?.name })}`);
    continue;
  }

  const simulate = (first) => {
    const excluded = new Set();
    const firstDiszi = first === 1 ? d1cfg : d2cfg;
    const secondDiszi = first === 1 ? d2cfg : d1cfg;

    const p1 = pickFor(st, firstDiszi, excluded);
    const p2 = pickFor(st, secondDiszi, excluded);

    let d1Picked = first === 1 ? p1 : p2;
    let d2Picked = first === 1 ? p2 : p1;

    const capRes = enforceCapUnique(d1cfg, d2cfg, [...d1Picked], [...d2Picked]);
    d1Picked = capRes.d1Picked;
    d2Picked = capRes.d2Picked;

    const d1Eval = evalSlot(d1cfg.name, d1Picked);
    const d2Eval = evalSlot(d2cfg.name, d2Picked);

    return { first, d1Picked, d2Picked, d1Eval, d2Eval, total: n(d1Eval.score) + n(d2Eval.score) };
  };

  const simD1First = simulate(1);
  const simD2First = simulate(2);

  const diff = n(simD2First.total) - n(simD1First.total);
  let chosen = simD1First;
  let chosenReason = 'hybrid_total';

  if (diff > PICKORDER_DIFF_THR) chosen = simD2First;

  let oppDelta = 0;
  let tieBreakApplied = false;

  if (Math.abs(diff) <= PICKORDER_DIFF_THR) {
    oppDelta = n(simD2First.d2Eval.opp?.score) - n(simD1First.d1Eval.opp?.score);

    if (oppDelta > PICKORDER_OPP_THR) {
      chosen = simD2First;
      chosenReason = 'cards_opportunity_tiebreak';
      tieBreakApplied = true;
    }
    if (oppDelta < -PICKORDER_OPP_THR) {
      chosen = simD1First;
      chosenReason = 'cards_opportunity_tiebreak';
      tieBreakApplied = true;
    }

    notes.push(`pickorder_close_tie:st${st}:diff=${diff.toFixed(2)}:oppDelta=${oppDelta.toFixed(2)}`);
  }

  const d1Picked = [...chosen.d1Picked];
  const d2Picked = [...chosen.d2Picked];

  const d1EvalFinal = evalSlot(d1cfg.name, d1Picked);
  const d2EvalFinal = evalSlot(d2cfg.name, d2Picked);

  const d1Opp = cardOpportunityForDiszi(d1cfg.name);
  const d2Opp = cardOpportunityForDiszi(d2cfg.name);
  const pickOrderText = chosen.first === 1 ? 'D1 zuerst' : 'D2 zuerst';

  const mkBullets = (label, ev, disziName) => [
    `Pick-Priority: ${pickOrderText}`,
    `Skill: Ø ${ev.as.avg.toFixed(2)} (Σ ${ev.as.sum.toFixed(1)}) · Players ${ev.as.count}`,
    `Hybrid: ${ev.hybrid.score.toFixed(2)} · KartenBias ${n(ev.opp?.score).toFixed(2)} · TeamBias ${ev.teamBias.toFixed(2)}`,
    `${label}: PP ceiling ${maxPP(ev.pc).toFixed(1)} (pc=${ev.pc}) · FatigueSum ${ev.fatigueSum}`,
    `Team focus: ${getDynamicFocusReason(disziName)} | level=${focusLevelForDiszi(disziName)} | manual: ${getTeamBiasForDiszi(disziName).reasons.join(' | ') || 'none'}`
  ];

  const explain = mkExplain();
  explain.tags.push('pick_order');
  explain.tags.push(`pick_order:${chosen.first === 1 ? 'd1_first' : 'd2_first'}`);
  explain.tags.push(`reason:${chosenReason}`);

  explain.comments.push(
    `Spieltag ${st}: ${pickOrderText} gewählt. Δ(total)=${diff.toFixed(2)} (thr=${PICKORDER_DIFF_THR.toFixed(2)}).`
  );

  if (tieBreakApplied) {
    explain.tags.push('tiebreak_cards');
    explain.comments.push(
      `Tie-break via Kartenpotenzial: oppDelta=${oppDelta.toFixed(2)} (thr=${PICKORDER_OPP_THR.toFixed(2)}).`
    );
  }

  spieltage.push({
    spieltag: st,
    d1: {
      disziplin: d1cfg.name,
      disziplinColor: d1Opp.disziColor,
      playersRequired: n(d1cfg.players),
      playersPicked: d1Picked,
      cardOpportunity: { score: d1Opp.score, reasons: d1Opp.reasons, disziColor: d1Opp.disziColor },
      decisionBullets: mkBullets('D1', d1EvalFinal, d1cfg.name),
      explain: { tags: [...explain.tags], comments: [...explain.comments] },
      formkarten: [],
      captain: false
    },
    d2: {
      disziplin: d2cfg.name,
      disziplinColor: d2Opp.disziColor,
      playersRequired: n(d2cfg.players),
      playersPicked: d2Picked,
      cardOpportunity: { score: d2Opp.score, reasons: d2Opp.reasons, disziColor: d2Opp.disziColor },
      decisionBullets: mkBullets('D2', d2EvalFinal, d2cfg.name),
      explain: { tags: [...explain.tags], comments: [...explain.comments] },
      formkarten: [],
      captain: false
    }
  });

  const played = new Set([...d1Picked, ...d2Picked].map(String));
  for (const p of roster) {
    const nm = String(p.name);
    fatigue[nm] = played.has(nm) ? n(fatigue[nm] || 0) + 1 : 0;
  }
}

// --------------------------------------------------
// Allocation phase
// --------------------------------------------------
const baseVal = (p, disziName) => base(p, disziName);

const slots = [];
for (const st of spieltage) {
  slots.push({ spieltag: st.spieltag, disziplinNr: 1, disziName: st.d1.disziplin, color: st.d1.disziplinColor, picked: st.d1.playersPicked, playersRequired: st.d1.playersRequired });
  slots.push({ spieltag: st.spieltag, disziplinNr: 2, disziName: st.d2.disziplin, color: st.d2.disziplinColor, picked: st.d2.playersPicked, playersRequired: st.d2.playersRequired });
}

const slotStrength = slots.map((sl) => {
  const as = avgSumLineup(sl.disziName, sl.picked, baseVal);
  const pc = playersRequiredNorm(sl.playersRequired || as.count || 2);
  const pr = proxyRankEval(sl.disziName, pc, 0);
  const hs = hybridSlotScore(as.avg, as.sum, pc, pr.ok ? pr.realism : 0.5, pr.ok ? pr.swing : 0.25);
  return { ...sl, as, pc, pr, hs, focusN: normalizedTeamBias(sl.disziName), focusLevel: focusLevelForDiszi(sl.disziName) };
});

const slotCards = new Map();
const slotKey = (sl) => `${sl.spieltag}|${sl.disziplinNr}`;

const getCardIdsForSlot = (sl) => slotCards.get(slotKey(sl)) || [];

const slotAssignedFormSum = (sl) => {
  const ids = getCardIdsForSlot(sl);
  return ids.reduce((acc, id) => acc + n(cardById.get(id)?.v), 0);
};

const slotAssignedPosCount = (sl) => {
  const ids = getCardIdsForSlot(sl);
  return ids.reduce((acc, id) => acc + (n(cardById.get(id)?.v) > 0 ? 1 : 0), 0);
};

const slotAssignedNegCount = (sl) => {
  const ids = getCardIdsForSlot(sl);
  return ids.reduce((acc, id) => acc + (n(cardById.get(id)?.v) < 0 ? 1 : 0), 0);
};

const isEmptyDisziSlot = (sl) => getCardIdsForSlot(sl).length === 0;

const addCardToSlotValidated = (sl, cardId) => {
  const card = cardById.get(cardId);
  if (!card) return false;

  const ids = [...getCardIdsForSlot(sl)];
  if (ids.length >= 2) return false;

  const existingNegCount = ids.reduce((acc, id) => acc + (n(cardById.get(id)?.v) < 0 ? 1 : 0), 0);
  const newIsNeg = n(card.v) < 0;

  if (newIsNeg && ids.length >= 1) return false;
  if (newIsNeg && existingNegCount >= 1) return false;

  ids.push(cardId);
  slotCards.set(slotKey(sl), ids);
  return true;
};

const getPlacedCardIdSet = () => new Set(Array.from(slotCards.values()).flat().map(n));
const getUnplacedPosCards = () => {
  const placed = getPlacedCardIdSet();
  return posUnused.filter((c) => !placed.has(c.id));
};
const getUnplacedNegCards = () => {
  const placed = getPlacedCardIdSet();
  return negUnused.filter((c) => !placed.has(c.id));
};

const countEmptyDiszis = () => slotStrength.reduce((acc, sl) => acc + (isEmptyDisziSlot(sl) ? 1 : 0), 0);

// --------------------------------------------------
// Captain allocation
// --------------------------------------------------
const formBoostForSlot = (sl) => {
  const ids = getCardIdsForSlot(sl);
  const pc = clamp(sl.pc, 2, 6);
  const total = ids.reduce((acc, id) => acc + n(cardById.get(id)?.v), 0);
  const capped = clamp(total, -6, 6);
  return capped * pc * 0.75;
};

const slotHasNegativeForm = (sl) => {
  const ids = getCardIdsForSlot(sl);
  return ids.some((id) => n(cardById.get(id)?.v) < 0);
};

const getUnusedPositiveValuesForColor = (color) => {
  const arr = color ? (posByColor[color] || []) : [];
  return arr.map((c) => Math.abs(n(c.v))).sort((a, b) => b - a);
};

const estimateColorSupportForSlot = (sl) => {
  const vals = getUnusedPositiveValuesForColor(s(sl.color));
  const top1 = vals[0] || 0;
  const top2 = vals[1] || 0;
  return { top1, top2, totalTop2: top1 + top2 };
};

const isOffColorCaptainCandidate = (sl) => sl.focusN <= -0.35;
const isCoreCaptainCandidate = (sl) => sl.focusN >= 0.75;
const isMegaCoreCaptainCandidate = (sl) => sl.focusN >= 1.20;

const captainScoreForSlot = (sl) => {
  const pc = clamp(sl.pc, 2, 6);

  const boostCaptain = bestInLineup(sl.disziName, sl.picked, baseVal) * 0.5;
  const boostForm = formBoostForSlot(sl);

  const pr0 = sl.pr && sl.pr.ok
    ? sl.pr
    : { ok: false, beforeRank: null, afterRank: null, closeness: 0, defenseRisk: 0 };

  const pr1 = proxyRankEval(sl.disziName, pc, boostCaptain + boostForm);
  if (!pr1.ok || !pr0.ok) return { ok: false, score: 0 };

  const ppDelta = pointsFor(pr1.afterRank, pc) - pointsFor(pr0.beforeRank, pc);
  const rankGain = Math.max(0, n(pr0.beforeRank) - n(pr1.afterRank));

  const smallDisziLeverage =
    pc <= 2 ? 1.24 :
    pc === 3 ? 1.13 :
    pc === 4 ? 1.03 :
    0.95;

  const ceilingW = 0.75 + 0.55 * (Math.max(0.01, maxPP(pc)) / maxPP6);

  const focusN = sl.focusN;
  const teamFocusCaptainMult = 1 + Math.max(-0.10, Math.min(0.34, focusN * 0.20));

  const support = estimateColorSupportForSlot(sl);
  const lackingGoodFormSignal = Math.max(0, 1 - Math.min(1, support.top1 / 8));
  const havingGoodFormSignal = Math.min(1, support.top1 / 8);

  const cardScarcityBonus =
    Math.max(0, focusN) *
    lackingGoodFormSignal *
    (pc >= 5 ? 10.5 : pc === 4 ? 8.5 : 5.8);

  const stackWithProjectedGoodCards =
    Math.max(0, focusN) *
    havingGoodFormSignal *
    (pc >= 5 ? 2.4 : pc === 4 ? 1.7 : 0.8);

  const bigCoreCeilingBonus =
    Math.max(0, focusN) *
    (pc >= 5 ? CAP_BIG_CORE_BONUS : pc === 4 ? CAP_BIG_CORE_BONUS * 0.5 : 0);

  const strategicColorBias =
    (isMegaCoreCaptainCandidate(sl) ? CAP_MEGA_CORE_BONUS : 0) +
    (isCoreCaptainCandidate(sl) ? CAP_CORE_BONUS : 0) +
    (isCoreCaptainCandidate(sl) && lackingGoodFormSignal > 0.45 ? CAP_NO_FORM_CORE_BONUS : 0) +
    (isOffColorCaptainCandidate(sl) ? -CAP_OFFCOLOR_PENALTY : 0) +
    (isOffColorCaptainCandidate(sl) && pc <= 3 ? -CAP_SMALL_OFFCOLOR_PENALTY : 0);

  const negFormPenalty =
    slotHasNegativeForm(sl)
      ? (isCoreCaptainCandidate(sl) ? CAP_NEG_FORM_PENALTY * 1.25 : CAP_NEG_FORM_PENALTY)
      : 0;

  const raw =
    24 * ppDelta +
    12 * rankGain +
    11 * clamp(pr1.closeness, 0, 1) +
    (pr0.beforeRank <= 3 ? 7.5 * clamp(pr1.defenseRisk, 0, 1) : 0) +
    0.42 * boostCaptain +
    cardScarcityBonus +
    stackWithProjectedGoodCards +
    bigCoreCeilingBonus +
    strategicColorBias -
    negFormPenalty;

  // practically ban captain on negative-form slot unless no better options exist
  const hardPenalty = slotHasNegativeForm(sl) ? CAP_NEG_FORM_HARD_PENALTY : 0;

  return {
    ok: true,
    score: (raw * ceilingW * smallDisziLeverage * teamFocusCaptainMult) - hardPenalty
  };
};

const effectiveCaptainSlots = Math.max(0, CAPTAIN_SLOTS - captainUsedCount);
const capCandidates = slotStrength
  .map((sl) => ({ ...sl, cap: captainScoreForSlot(sl) }))
  .filter((sl) => sl.cap?.ok);

const chosenCaps = [];
const chosenCapKeys = new Set();
let offColorCaptainCount = 0;

while (chosenCaps.length < effectiveCaptainSlots) {
  let best = null;

  for (const cand of capCandidates) {
    const k = `${cand.spieltag}|${cand.disziplinNr}`;
    if (chosenCapKeys.has(k)) continue;

    let adjusted = cand.cap.score;

    if (slotHasNegativeForm(cand)) {
      adjusted -= CAP_NEG_FORM_PENALTY;
    }

    if (isOffColorCaptainCandidate(cand)) {
      adjusted -= offColorCaptainCount >= 1 ? CAP_SECOND_OFFCOLOR_PENALTY : 0;
    }

    const jitter = tieJitter(`cap|${cand.spieltag}|${cand.disziplinNr}|${cand.disziName}`, TIE_JITTER_CAP);
    const score = adjusted;

    const enriched = { ...cand, score: adjusted, tieScore: score + jitter };

    if (!best) {
      best = enriched;
      continue;
    }

    if (score > best.score + TIE_BAND_CAP) {
      best = enriched;
      continue;
    }
    if (best.score > score + TIE_BAND_CAP) {
      continue;
    }
    if (enriched.tieScore > best.tieScore) {
      best = enriched;
    }
  }

  if (!best) break;

  chosenCaps.push(best);
  chosenCapKeys.add(`${best.spieltag}|${best.disziplinNr}`);
  if (isOffColorCaptainCandidate(best)) offColorCaptainCount += 1;
}

const capSet = new Set(chosenCaps.map((sl) => `${sl.spieltag}|${sl.disziplinNr}`));

// --------------------------------------------------
// Positive cards allocation
// --------------------------------------------------
const getTopUnusedPositiveOfColor = (color, excludeCardId) => {
  const arr = color ? (posByColor[color] || []) : [];
  for (const c of arr) {
    if (c.id !== excludeCardId) return c;
  }
  return null;
};

const deltaFormBoostForAddingCard = (sl, cardV) => {
  const pc = clamp(sl.pc, 2, 6);
  const curRaw = slotAssignedFormSum(sl);
  const curCapped = clamp(curRaw, -6, 6);
  const nextRaw = curRaw + n(cardV);
  const nextCapped = clamp(nextRaw, -6, 6);
  const deltaCapped = nextCapped - curCapped;
  return deltaCapped * pc * 0.75;
};

const wouldConsumeReservedNegativeCapacity = (sl) => {
  if (!isEmptyDisziSlot(sl)) return false;
  const remainingNegCount = getUnplacedNegCards().length;
  const currentEmpty = countEmptyDiszis();
  const emptyAfterUsingThis = currentEmpty - 1;
  return emptyAfterUsingThis < remainingNegCount;
};

const scoreSlotForPositiveCard = (sl, card) => {
  const pc = clamp(sl.pc, 2, 6);
  const existingIds = getCardIdsForSlot(sl);
  if (existingIds.length >= 2) return { ok: false, score: -Infinity };

  if (wouldConsumeReservedNegativeCapacity(sl)) {
    return { ok: false, score: -Infinity };
  }

  const deltaBoost = deltaFormBoostForAddingCard(sl, card.v);
  const pr0 = sl.pr && sl.pr.ok ? sl.pr : { ok: false, beforeRank: null, afterRank: null, closeness: 0, defenseRisk: 0 };
  const pr1 = proxyRankEval(sl.disziName, pc, deltaBoost);
  if (!pr0.ok || !pr1.ok) return { ok: false, score: -Infinity };

  const ppBefore = pointsFor(pr0.beforeRank, pc);
  const ppAfter = pointsFor(pr1.afterRank, pc);
  const ppDelta = ppAfter - ppBefore;
  const rankGain = Math.max(0, n(pr0.beforeRank) - n(pr1.afterRank));

  const upside = Math.max(0, ppDelta) * (0.85 + 0.45 * clamp(pr1.closeness ?? 0, 0, 1)) + rankGain * 1.25;
  const defense = (pr0.beforeRank <= 3 ? 1.0 : pr0.beforeRank <= 6 ? 0.6 : 0.35) * 10 * clamp(pr1.defenseRisk ?? 0, 0, 1);

  const hasColors = !!(sl.color && card?.c);
  const colorMatch = hasColors ? sl.color === card.c : false;
  const colorMult = colorMatch ? POS_BASE_COLOR_MATCH_MULT : (hasColors ? POS_BASE_COLOR_MISMATCH_MULT : 1.0);

  const posAlready = slotAssignedPosCount(sl);
  let secondPosPenalty = 0;
  if (posAlready >= 1) {
    const pcPenalty =
      pc <= 2 ? 4.7 :
      pc === 3 ? 3.3 :
      pc === 4 ? 2.2 :
      1.5;
    secondPosPenalty = pcPenalty * Math.min(6, Math.abs(n(card.v)));
  }

  const focusN = sl.focusN;
  const focusPositive = Math.max(0, focusN);

  const teamFocusScore = focusPositive * POS_TEAM_FOCUS_W * Math.abs(n(card.v));

  const sizeScore =
    pc >= 5 ? POS_BIG_DISZI_W * 1.22 :
    pc === 4 ? POS_BIG_DISZI_W * 0.82 :
    pc === 3 ? POS_BIG_DISZI_W * 0.38 :
    0;

  const avgQualityScore = clamp((n(sl.as?.avg) - 45) / 20, -1.2, 2.4) * POS_AVG_QUALITY_W * Math.abs(n(card.v));
  const explicitColorKeepScore = colorMatch ? POS_COLOR_KEEP_W * Math.abs(n(card.v)) : 0;
  const valueOnCoreScore = focusPositive * Math.max(0, n(sl.as?.avg) - 50) * 0.08 * POS_VALUE_ON_CORE_W;

  const colorValueApprox = colorMatch
    ? Math.abs(n(card.v)) * 2 * pc
    : Math.abs(n(card.v)) * 0.55 * pc;

  const directColorLeverage = colorMatch ? colorValueApprox : 0;

  const isOffFocus = focusN <= -0.10;
  const isWeakAvg = n(sl.as?.avg) < 50;
  const offFocusWastePenalty = isOffFocus ? POS_OFFFOCUS_WASTE_PENALTY * Math.max(0, Math.abs(n(card.v)) - 4) : 0;
  const lowAvgWastePenalty = isWeakAvg ? POS_LOWAVG_WASTE_PENALTY * Math.max(0, (52 - n(sl.as?.avg)) / 10) * Math.max(0, Math.abs(n(card.v)) - 3) : 0;

  let keepBestColorBonus = 0;
  if (colorMatch && focusN > 0.30) {
    const topAltSameColor = getTopUnusedPositiveOfColor(card.c, card.id);
    const altVal = Math.abs(n(topAltSameColor?.v));
    const curVal = Math.abs(n(card.v));
    const scarcity = altVal > 0 ? clamp((curVal - altVal) / 6, 0, 1) : clamp(curVal / 8, 0, 1);
    keepBestColorBonus += POS_BIG_CORE_KEEP_BONUS * scarcity * (pc >= 4 ? 1.18 : 0.92);
  }

  const megaCoreBonus =
    focusN >= 1.2
      ? (colorMatch ? POS_MEGA_CORE_MATCH_BONUS : 0) * Math.max(0, Math.abs(n(card.v)) - 2)
      : 0;

  const strongOffColorPenalty =
    !colorMatch && focusN >= 0.75 && Math.abs(n(card.v)) >= 6
      ? 18 + 2.5 * pc
      : 0;

  const smallPcBias = pc <= 2 ? 0.9 : pc === 3 ? 0.45 : 0;

  const raw =
    (0.70 * upside + 0.30 * defense) * colorMult +
    teamFocusScore +
    sizeScore +
    avgQualityScore +
    explicitColorKeepScore +
    valueOnCoreScore +
    directColorLeverage +
    keepBestColorBonus +
    megaCoreBonus -
    secondPosPenalty -
    smallPcBias -
    offFocusWastePenalty -
    lowAvgWastePenalty -
    strongOffColorPenalty;

  return {
    ok: true,
    score: raw,
    meta: {
      ppDelta,
      beforeRank: pr0.beforeRank,
      afterRank: pr1.afterRank,
      posAlready,
      pc,
      colorMatch,
      focusN
    }
  };
};

const placePositiveCardsPass = (cardsList, passTag) => {
  for (const card of cardsList) {
    const alreadyPlaced = getPlacedCardIdSet().has(card.id);
    if (alreadyPlaced) continue;

    let bestAny = null;
    let bestFresh = null;

    for (const sl of slotStrength) {
      const res = scoreSlotForPositiveCard(sl, card);
      if (!res.ok) continue;

      const candidate = { sl, ...res };

      bestAny = chooseBetterCandidate(
        bestAny,
        candidate,
        TIE_BAND_POS,
        TIE_JITTER_POS,
        `posAny|${card.id}`
      );

      const posAlready = slotAssignedPosCount(sl);
      if (posAlready === 0) {
        bestFresh = chooseBetterCandidate(
          bestFresh,
          candidate,
          TIE_BAND_POS,
          TIE_JITTER_POS,
          `posFresh|${card.id}`
        );
      }
    }

    if (!bestAny) {
      notes.push(`formkarte_not_placed_pos_${passTag}:${card.id}`);
      continue;
    }

    const bestAnyPosAlready = slotAssignedPosCount(bestAny.sl);
    if (bestAnyPosAlready >= 1 && bestFresh) {
      const margin = bestAny.score - bestFresh.score;
      if (margin < POS_SECOND_MARGIN) {
        const placedFresh = addCardToSlotValidated(bestFresh.sl, card.id);
        if (!placedFresh) notes.push(`formkarte_not_placed_pos_${passTag}:${card.id}`);
        continue;
      }
    }

    const placed = addCardToSlotValidated(bestAny.sl, card.id);
    if (!placed) notes.push(`formkarte_not_placed_pos_${passTag}:${card.id}`);
  }
};

// --------------------------------------------------
// Negative cards allocation
// --------------------------------------------------
const weakestFirst = [...slotStrength].sort((a, b) => (a.hs.score || 0) - (b.hs.score || 0));
const slotsCount = slotStrength.length || 1;
const bottomQuarterSize = Math.max(1, Math.ceil(slotsCount * 0.25));
const bottomQuarterKeys = new Set(
  weakestFirst.slice(0, bottomQuarterSize).map((sl) => `${sl.spieltag}|${sl.disziplinNr}`)
);

const isBottomQuarterSlot = (sl) => bottomQuarterKeys.has(`${sl.spieltag}|${sl.disziplinNr}`);

const damageScoreForSlot = (sl, card) => {
  const pc = clamp(sl.pc, 2, 6);

  const currentIds = getCardIdsForSlot(sl);
  if (currentIds.length > 0) return Number.POSITIVE_INFINITY;

  const pr = sl.pr && sl.pr.ok ? sl.pr : { ok: false, beforeRank: 16, defenseRisk: 0, closeness: 0 };
  const beforeRank = pr.ok ? n(pr.beforeRank) : 16;

  const defenseRisk = clamp(n(pr.defenseRisk), 0, 1);
  const closeness = clamp(n(pr.closeness), 0, 1);
  const risk = 0.60 * defenseRisk + 0.40 * closeness;

  const hasColors = !!(sl.color && card?.c);
  const mismatch = hasColors ? sl.color !== card.c : false;
  const match = hasColors ? sl.color === card.c : false;
  const colorFactor = match ? NEG_MATCH_COLOR_FACTOR : mismatch ? NEG_MISMATCH_COLOR_FACTOR : 1.0;

  const focusN = sl.focusN;
  const coreFactor =
    focusN >= 1.2 ? NEG_MEGA_CORE_DISZI_FACTOR :
    focusN >= 0.75 ? NEG_CORE_DISZI_FACTOR :
    focusN >= 0.25 ? 1.12 :
    focusN <= -0.35 ? 0.86 :
    1.0;

  const sizeFactor =
    pc >= 5 ? NEG_BIG_DISZI_FACTOR :
    pc === 4 ? 1.05 :
    pc === 3 ? 0.98 :
    0.94;

  const avg = n(sl.as?.avg);
  const avgFactor =
    avg >= 70 ? 1.22 :
    avg >= 60 ? NEG_STRONG_AVG_FACTOR :
    avg >= 50 ? 1.04 :
    avg >= 40 ? 0.94 :
    avg >= 35 ? 0.86 :
    avg >= 30 ? NEG_WEAK_AVG_BONUS :
    0.70;

  const rankFactor =
    beforeRank <= 4 ? 1.22 :
    beforeRank <= 8 ? 1.10 :
    beforeRank <= 14 ? 1.00 :
    beforeRank <= 20 ? 0.88 :
    beforeRank <= 26 ? NEG_WEAK_RANK_BONUS :
    0.70;

  const weakComboFactor =
    avg < 35 && beforeRank >= 18
      ? NEG_WEAK_COMBO_BONUS
      : 1.0;

  const parkingFactor = isBottomQuarterSlot(sl) ? NEG_BOTTOM_QUARTER_FACTOR : 1.0;
  const ppCeilFactor = clamp(Math.max(0.01, maxPP(pc)) / maxPP6, 0.35, 1.0);
  const mag = Math.max(0.01, Math.abs(n(card?.v)));

  return (
    mag *
    (0.30 + risk) *
    colorFactor *
    coreFactor *
    sizeFactor *
    avgFactor *
    rankFactor *
    weakComboFactor *
    parkingFactor *
    ppCeilFactor
  );
};

const placeNegativeCardsPass = (cardsList, passTag) => {
  let negIdx = 0;

  for (const card of cardsList) {
    const alreadyPlaced = getPlacedCardIdSet().has(card.id);
    if (alreadyPlaced) continue;

    let best = null;

    const candidates = slotStrength
      .map((sl, i) => {
        const arr = getCardIdsForSlot(sl);

        if (arr.length > 0) return null;
        if (slotAssignedNegCount(sl) >= 1) return null;

        const dmg = damageScoreForSlot(sl, card);
        if (!Number.isFinite(dmg)) return null;

        const rr = (i - (negIdx % slotsCount) + slotsCount) % slotsCount;
        const jitter = tieJitter(`neg|${card.id}|${sl.spieltag}|${sl.disziplinNr}|${sl.disziName}`, TIE_JITTER_NEG);
        return { sl, score: dmg, rr, tieScore: dmg + jitter };
      })
      .filter(Boolean);

    for (const cand of candidates) {
      if (!best) {
        best = cand;
        continue;
      }

      if (cand.score < best.score - TIE_BAND_NEG) {
        best = cand;
        continue;
      }
      if (best.score < cand.score - TIE_BAND_NEG) {
        continue;
      }

      if (cand.tieScore < best.tieScore) {
        best = cand;
      } else if (cand.tieScore === best.tieScore && cand.rr < best.rr) {
        best = cand;
      }
    }

    let placed = false;
    if (best) {
      placed = addCardToSlotValidated(best.sl, card.id);
      if (placed) negIdx = (negIdx + 1) % slotsCount;
    }

    if (!placed) notes.push(`formkarte_not_placed_neg_${passTag}:${card.id}`);
  }
};

// --------------------------------------------------
// Allocation order
// --------------------------------------------------
placePositiveCardsPass(posUnused, 'pass1');
placeNegativeCardsPass(negUnused, 'pass1');
placePositiveCardsPass(getUnplacedPosCards(), 'pass2');

// IMPORTANT: recompute captain now that cards are known
const effectiveCaptainSlots = Math.max(0, CAPTAIN_SLOTS - captainUsedCount);
const capCandidates = slotStrength
  .map((sl) => ({ ...sl, cap: captainScoreForSlot(sl) }))
  .filter((sl) => sl.cap?.ok);

const chosenCaps = [];
const chosenCapKeys = new Set();
let offColorCaptainCount = 0;

while (chosenCaps.length < effectiveCaptainSlots) {
  let best = null;

  for (const cand of capCandidates) {
    const k = `${cand.spieltag}|${cand.disziplinNr}`;
    if (chosenCapKeys.has(k)) continue;

    let adjusted = cand.cap.score;

    if (slotHasNegativeForm(cand)) {
      adjusted -= CAP_NEG_FORM_PENALTY;
    }

    if (isOffColorCaptainCandidate(cand)) {
      adjusted -= offColorCaptainCount >= 1 ? CAP_SECOND_OFFCOLOR_PENALTY : 0;
    }

    const jitter = tieJitter(`capFinal|${cand.spieltag}|${cand.disziplinNr}|${cand.disziName}`, TIE_JITTER_CAP);
    const score = adjusted;

    const enriched = { ...cand, score: adjusted, tieScore: score + jitter };

    if (!best) {
      best = enriched;
      continue;
    }

    if (score > best.score + TIE_BAND_CAP) {
      best = enriched;
      continue;
    }
    if (best.score > score + TIE_BAND_CAP) {
      continue;
    }
    if (enriched.tieScore > best.tieScore) {
      best = enriched;
    }
  }

  if (!best) break;

  chosenCaps.push(best);
  chosenCapKeys.add(`${best.spieltag}|${best.disziplinNr}`);
  if (isOffColorCaptainCandidate(best)) offColorCaptainCount += 1;
}

const capSet = new Set(chosenCaps.map((sl) => `${sl.spieltag}|${sl.disziplinNr}`));

for (const st of spieltage) {
  st.d1.captain = capSet.has(`${st.spieltag}|1`);
  st.d2.captain = capSet.has(`${st.spieltag}|2`);
}

// --------------------------------------------------
// Final DB-backed sweep
// --------------------------------------------------
const dbRemainingPos = getUnplacedPosCards();
const dbRemainingNeg = getUnplacedNegCards();

if (dbRemainingNeg.length) {
  notes.push(`db_sweep_neg_candidates:${dbRemainingNeg.map((c) => c.id).join(',')}`);
  placeNegativeCardsPass(dbRemainingNeg, 'dbsweep');
}

if (dbRemainingPos.length) {
  notes.push(`db_sweep_pos_candidates:${dbRemainingPos.map((c) => c.id).join(',')}`);
  placePositiveCardsPass(dbRemainingPos, 'dbsweep');
}

const dbRemainingNeg2 = getUnplacedNegCards();
if (dbRemainingNeg2.length) {
  notes.push(`db_sweep_neg_candidates_2:${dbRemainingNeg2.map((c) => c.id).join(',')}`);
  placeNegativeCardsPass(dbRemainingNeg2, 'dbsweep2');
}

// --------------------------------------------------
// Final validation / repair
// --------------------------------------------------
const normalizeFormkartenForWriteback = (formkartenIds) => {
  const ids = Array.isArray(formkartenIds) ? [...formkartenIds] : [];
  if (!ids.length) return [];

  const valid = ids
    .map((id) => n(id))
    .filter((id) => cardById.has(id))
    .slice(0, 2);

  const negs = valid.filter((id) => n(cardById.get(id)?.v) < 0);
  const poss = valid.filter((id) => n(cardById.get(id)?.v) > 0);

  if (negs.length > 1) {
    notes.push(`illegal_multi_neg_repaired:${negs.join(',')}`);
  }

  if (negs.length >= 1) {
    const negId = negs[0];
    const posId = poss.length ? poss.sort((a, b) => n(cardById.get(b)?.v) - n(cardById.get(a)?.v))[0] : null;
    return posId ? [negId, posId] : [negId];
  }

  const sortedPos = poss.sort((a, b) => n(cardById.get(b)?.v) - n(cardById.get(a)?.v));
  return sortedPos.slice(0, 2);
};

// --------------------------------------------------
// Write cards back to output
// --------------------------------------------------
for (const st of spieltage) {
  const sl1 = slotStrength.find((x) => x.spieltag === st.spieltag && x.disziplinNr === 1);
  const sl2 = slotStrength.find((x) => x.spieltag === st.spieltag && x.disziplinNr === 2);

  st.d1.formkarten = normalizeFormkartenForWriteback(getCardIdsForSlot(sl1));
  st.d2.formkarten = normalizeFormkartenForWriteback(getCardIdsForSlot(sl2));
}

// --------------------------------------------------
// Final placed / unplaced audit
// --------------------------------------------------
const placedCardIds = Array.from(new Set(
  spieltage.flatMap((st) => [...(st.d1.formkarten || []), ...(st.d2.formkarten || [])]).map(n)
));
const placedCardIdSet = new Set(placedCardIds);

const unplacedPositiveCardIds = posUnused.filter((c) => !placedCardIdSet.has(c.id)).map((c) => c.id);
const unplacedNegativeCardIds = negUnused.filter((c) => !placedCardIdSet.has(c.id)).map((c) => c.id);

const totalDiszis = slotStrength.length;
const maxNegativeCapacity = totalDiszis;
if (negUnused.length > maxNegativeCapacity) {
  notes.push(`negative_capacity_impossible:${negUnused.length}>${maxNegativeCapacity}`);
}

if (unplacedPositiveCardIds.length) {
  notes.push(`final_unplaced_positive:${unplacedPositiveCardIds.join(',')}`);
}
if (unplacedNegativeCardIds.length) {
  notes.push(`final_unplaced_negative:${unplacedNegativeCardIds.join(',')}`);
}

notes.push(`placed_cards_count:${placedCardIds.length}`);
notes.push(`unplaced_pos_count:${unplacedPositiveCardIds.length}`);
notes.push(`unplaced_neg_count:${unplacedNegativeCardIds.length}`);
notes.push(`runtime_ms:${Date.now() - t0}`);

return {
  ok: true,
  meta: { team: team || undefined, season: season || undefined },
  spieltage,
  notes,
  allocationSummary: {
    placedCardIds,
    unplacedPositiveCardIds,
    unplacedNegativeCardIds
  }
};
