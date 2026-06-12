// term: aiTeamNeeds
// id: syncAiTeamNeedsSnapshotFromFunction
// type: script
// subtype: JavascriptQuery
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
return (() => {
  try {
    const VERSION = 'aiSequentialNeedsPreview.v19_11_preview_autosteps_slotplan_rebuild';

    const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
    const s = (v) => String(v ?? '').trim();
    const lower = (v) => String(v ?? '').trim().toLowerCase();
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    const safeJson = (v) => {
      if (v && typeof v === 'object') return v;
      try { return JSON.parse(String(v || '{}')); } catch (e) { return {}; }
    };

    const hashStr = (input) => {
      const str = String(input ?? '');
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
      }
      return h >>> 0;
    };

    const rand01FromKey = (key) => {
      const h = hashStr(key);
      return (h % 1000000) / 1000000;
    };

    const maybeFormatDataAsArray = (src) => {
      try {
        if (typeof formatDataAsArray === 'function') {
          const out = formatDataAsArray(src);
          if (Array.isArray(out)) return out;
        }
      } catch (e) {}
      return null;
    };

    const objectColumnsToRows = (src) => {
      if (!src || typeof src !== 'object' || Array.isArray(src)) return [];
      const keys = Object.keys(src);
      if (!keys.length) return [];
      const arrayKeys = keys.filter((k) => Array.isArray(src[k]));
      if (!arrayKeys.length) return [];
      const len = Math.max(...arrayKeys.map((k) => src[k].length));
      if (!(len > 0)) return [];

      const rows = [];
      for (let i = 0; i < len; i++) {
        const row = {};
        for (const k of arrayKeys) row[k] = src[k][i];
        rows.push(row);
      }
      return rows;
    };

    const coerceRows = (src) => {
      if (Array.isArray(src)) return src.filter(Boolean);
      if (typeof src === 'string') return coerceRows(safeJson(src));
      if (Array.isArray(src?.data)) return src.data.filter(Boolean);
      if (Array.isArray(src?.rows)) return src.rows.filter(Boolean);
      if (Array.isArray(src?.needs)) return src.needs.filter(Boolean);
      if (Array.isArray(src?.picks)) return src.picks.filter(Boolean);

      const viaFDA = maybeFormatDataAsArray(src);
      if (Array.isArray(viaFDA) && viaFDA.length) return viaFDA.filter(Boolean);

      const viaCols = objectColumnsToRows(src);
      if (Array.isArray(viaCols) && viaCols.length) return viaCols.filter(Boolean);

      return [];
    };

    const quantile = (arr, q) => {
      const xs = [...arr]
        .map((x) => n(x))
        .filter((x) => Number.isFinite(x))
        .sort((a, b) => a - b);

      if (!xs.length) return 0;
      if (xs.length === 1) return xs[0];

      const pos = (xs.length - 1) * clamp(q, 0, 1);
      const base = Math.floor(pos);
      const rest = pos - base;

      if (xs[base + 1] == null) return xs[base];
      return xs[base] + rest * (xs[base + 1] - xs[base]);
    };

    const teamFieldValues = (row) => [
      row?.team_code, row?.teamCode, row?.team, row?.team_name, row?.teamName,
      row?.name, row?.Name, row?.Team
    ].filter(Boolean);

    const normalizeTeamToken = (v) => lower(v).replace(/[^a-z0-9]+/g, '');
    const initialsToken = (v) => {
      const parts = lower(v).split(/[^a-z0-9]+/).filter(Boolean);
      if (!parts.length) return '';
      return parts.map((p) => p[0]).join('');
    };
    const teamTokens = (v) => {
      const raw = s(v);
      if (!raw) return [];
      const norm = normalizeTeamToken(raw);
      const init = initialsToken(raw);
      const out = [norm];
      if (init && init !== norm) out.push(init);
      return [...new Set(out)].filter(Boolean);
    };

    const matchTeamRow = (row, code) => {
      const wanted = new Set(teamTokens(code));
      if (!wanted.size) return false;
      const rowTokens = teamFieldValues(row).flatMap(teamTokens);
      return rowTokens.some((tok) => wanted.has(tok));
    };

    const rowsHaveTeamFields = (rows) =>
      Array.isArray(rows) && rows.some((r) => teamFieldValues(r).length > 0);

    const team =
      s((typeof filterTeam !== 'undefined' && filterTeam?.value) || '') ||
      s((typeof localStorage !== 'undefined' && localStorage?.values?.selectedTeamCode) || '');

    if (!team) return { version: VERSION, ok: false, reason: 'missing_team' };

    const activePlayersRaw =
      typeof getActivePlayersByTeam !== 'undefined' ? getActivePlayersByTeam.data : [];
    const teamRatingsRaw =
      typeof getTeamRatingsTransfermarkt !== 'undefined' ? getTeamRatingsTransfermarkt.data : [];
    const candidatePoolRaw =
      typeof aiTransferCandidatePool !== 'undefined' ? aiTransferCandidatePool.value : [];
    const plan =
      typeof aiTeamPlan !== 'undefined' ? (aiTeamPlan.value || {}) : {};
    const slotPlanObj =
      typeof aiTeamSlotPlan !== 'undefined' ? (aiTeamSlotPlan.value || {}) : {};
    const budgetLogic =
      typeof transfermarktSalaryBudgetLogic !== 'undefined' ? (transfermarktSalaryBudgetLogic.value || {}) : {};
    const rankingsRaw =
      typeof teamDisciplineRankings !== 'undefined' ? teamDisciplineRankings.value : [];
    const recipes =
      typeof disciplineRecipesGlobal !== 'undefined' ? (disciplineRecipesGlobal.value || {}) : {};
    const overrides =
      typeof teamIdentityOverrides !== 'undefined' ? (teamIdentityOverrides.value || {}) : {};
    const varianceCfg =
      typeof aiVarianceConfig !== 'undefined' ? (aiVarianceConfig.value || {}) : {};
    const bracketCfg =
      typeof bracketConfig !== 'undefined' ? (bracketConfig.value || {}) : {};
    const snapshotNeedsRaw =
      typeof aiTeamNeedsSnapshot !== 'undefined' ? aiTeamNeedsSnapshot.value : [];
    const queryNeedsRaw =
      typeof aiTeamNeedsQuery !== 'undefined' ? aiTeamNeedsQuery.data : [];
    const cashRow =
      typeof getCashFromSaisonstand !== 'undefined' ? getCashFromSaisonstand.value : {};

    const rosterAll = coerceRows(activePlayersRaw);
    const trAll = coerceRows(teamRatingsRaw);
    const rankingsAll = coerceRows(rankingsRaw);
    const snapshotNeeds = coerceRows(snapshotNeedsRaw);
    const queryNeeds = coerceRows(queryNeedsRaw);
    const candidatePool = coerceRows(candidatePoolRaw);

    const rosterHasTeamFields = rowsHaveTeamFields(rosterAll);
    const trHasTeamFields = rowsHaveTeamFields(trAll);
    const rankingsHaveTeamFields = rowsHaveTeamFields(rankingsAll);

    const rosterFiltered = rosterHasTeamFields ? rosterAll.filter((row) => matchTeamRow(row, team)) : rosterAll;
    const trFiltered = trHasTeamFields ? trAll.filter((row) => matchTeamRow(row, team)) : trAll;
    const rankingsFiltered = rankingsHaveTeamFields ? rankingsAll.filter((row) => matchTeamRow(row, team)) : rankingsAll;

    const roster = rosterFiltered;
    const tr = trFiltered[0] || {};
    const rankingsRow = rankingsFiltered[0] || null;

    const strict_team_match = trFiltered.length > 0;
    const strict_roster_match = !rosterHasTeamFields || rosterFiltered.length > 0;
    const strict_rankings_match = !rankingsHaveTeamFields || rankingsFiltered.length > 0;

    const cash = n(cashRow?.cash || 0);
    const harmony = clamp(n(tr?.harmony) || 4, 1, 10);
    const ambition = clamp(n(tr?.ambition) || 5, 1, 10);
    const finances = clamp(n(tr?.finances) || 5, 1, 10);

    const axisPriorityAbs = {
      pow: clamp(n(tr?.power) || 0, 0, 20),
      spe: clamp(n(tr?.speed) || 0, 0, 20),
      men: clamp(n(tr?.mental) || 0, 0, 20),
      soc: clamp(n(tr?.social) || 0, 0, 20)
    };

    const axisPrioritySum =
      n(axisPriorityAbs.pow) + n(axisPriorityAbs.spe) + n(axisPriorityAbs.men) + n(axisPriorityAbs.soc);

    if (!strict_team_match) return { version: VERSION, ok: false, reason: 'team_ratings_not_matched', team };
    if (!strict_roster_match) return { version: VERSION, ok: false, reason: 'roster_not_matched_to_selected_team', team };
    if (roster.length > 20) return { version: VERSION, ok: false, reason: 'roster_suspiciously_large', team, roster_count: roster.length };
    if (axisPrioritySum <= 0) return { version: VERSION, ok: false, reason: 'team_ratings_zero_or_missing', team, debug: { axisPriorityAbs } };
    if (!candidatePool.length) return { version: VERSION, ok: false, reason: 'empty_candidate_pool', team };

    const classToColor = {
      Berserker: 'red', Warlord: 'red', Tank: 'red',
      Sprinter: 'green', Rogue: 'green', Charger: 'green',
      Mage: 'blue', Overseer: 'blue', Templar: 'blue',
      Bard: 'yellow', Hero: 'yellow', Badass: 'yellow', Tactician: 'yellow'
    };

    const classToAxis = {
      Berserker: 'pow', Warlord: 'pow', Tank: 'pow',
      Sprinter: 'spe', Rogue: 'spe', Charger: 'spe',
      Mage: 'men', Overseer: 'men', Templar: 'men',
      Bard: 'soc', Hero: 'soc', Badass: 'soc', Tactician: 'men'
    };

    const axisToColor = { pow: 'red', spe: 'green', men: 'blue', soc: 'yellow' };
    const colorToAxis = { red: 'pow', green: 'spe', blue: 'men', yellow: 'soc' };

    const classToColorLower = Object.fromEntries(
      Object.entries(classToColor).map(([k, v]) => [lower(k), v])
    );
    const classToAxisLower = Object.fromEntries(
      Object.entries(classToAxis).map(([k, v]) => [lower(k), v])
    );

    const ATTR_TO_AXIS = {
      power: 'pow', health: 'pow', stamina: 'pow', determination: 'pow',
      speed: 'spe', dexterity: 'spe',
      intelligence: 'men', awareness: 'men', will: 'men',
      charisma: 'soc', spirit: 'soc', torment: 'soc'
    };

    const DISCIPLINES = [
      { field: 'tdm', label: 'TDM', color: 'red' },
      { field: 'mini_dm', label: 'Mini DM', color: 'red' },
      { field: 'gewichtheben', label: 'Gewichtheben', color: 'red' },
      { field: 'hockey', label: 'Hockey', color: 'red' },
      { field: 'breaking', label: 'Breaking', color: 'red' },
      { field: 'staffel', label: 'Staffel', color: 'green' },
      { field: 'time_trial', label: 'Time Trial', color: 'green' },
      { field: 'spurt', label: 'Spurt', color: 'green' },
      { field: 'climbing', label: 'Climbing', color: 'green' },
      { field: 'fechten', label: 'Fechten', color: 'green' },
      { field: 'schach', label: 'Schach', color: 'blue' },
      { field: 'takeshi', label: 'Takeshi', color: 'blue' },
      { field: 'tennis', label: 'Tennis', color: 'blue' },
      { field: 'i_spy', label: 'I Spy', color: 'blue' },
      { field: 'wettessen', label: 'Wettessen', color: 'blue' },
      { field: 'basketball', label: 'Basketball', color: 'yellow' },
      { field: 'football', label: 'Football', color: 'yellow' },
      { field: 'battlefield', label: 'Battlefield', color: 'yellow' },
      { field: 'eiskunst', label: 'Eiskunst', color: 'yellow' },
      { field: 'showcase', label: 'Showcase', color: 'yellow' }
    ];

    const DISCIPLINE_BY_FIELD = Object.fromEntries(DISCIPLINES.map((d) => [d.field, d]));
    const totalTeams = Math.max(1, rankingsAll.length || 0);

    const getColor = (row) => {
      const k = s(row?.klasse || row?.Klasse || row?.class || '');
      return classToColor[k] || classToColorLower[lower(k)] || '';
    };

    const getPrimaryAxisByClass = (row) => {
      const k = s(row?.klasse || row?.Klasse || row?.class || '');
      return classToAxis[k] || classToAxisLower[lower(k)] || '';
    };

    const axisValue = (row, axis) => {
      if (axis === 'pow') return n(row?.pow || row?.attr_power || row?.power || 0);
      if (axis === 'spe') return n(row?.spe || row?.attr_speed || row?.speed || 0);
      if (axis === 'men') return n(row?.men || row?.attr_intelligence || row?.mental || 0);
      if (axis === 'soc') return n(row?.soc || row?.attr_charisma || row?.social || 0);
      return 0;
    };

    const priceOf = (row) => n(row?.marktwert || row?.market_value || row?.mw || row?.MW || 0);
    const fitOf = (row) => n(row?.team_fit || row?.fit || row?.teamFit || 0);
    const playerNameOf = (row) => s(row?.name || row?.player_name || row?.Name || '');

    const coreOf = (row) =>
      (axisValue(row, 'pow') + axisValue(row, 'spe') + axisValue(row, 'men') + axisValue(row, 'soc')) / 4;

    const getAttr = (row, attr) => {
      const direct = n(row?.[attr]);
      if (direct > 0) return direct;
      const ax = ATTR_TO_AXIS[String(attr || '').toLowerCase()];
      return ax ? axisValue(row, ax) : 0;
    };

    const weightedAttrScore = (row, weights) => {
      const entries = Object.entries(weights || {}).filter(([, w]) => n(w) > 0);
      if (!entries.length) return 0;
      const sumW = entries.reduce((a, [, w]) => a + n(w), 0) || 1;
      const raw = entries.reduce((acc, [attr, w]) => acc + getAttr(row, attr) * n(w), 0);
      return raw / sumW;
    };

    const getProxyDisziScore = (row, field, weights, fallbackAxis) => {
      const entries = Object.entries(weights || {}).filter(([, w]) => n(w) > 0);
      if (entries.length) {
        const weighted = weightedAttrScore(row, weights);
        if (weighted > 0) return weighted;
      }
      const fallback = fallbackAxis || colorToAxis[DISCIPLINE_BY_FIELD[field]?.color || 'red'] || 'pow';
      return axisValue(row, fallback) * 0.88;
    };

    const getBestProxyDisziScore = (row) => {
      let bestField = '';
      let bestScore = 0;
      for (const d of DISCIPLINES) {
        const weights = recipes[d.field] || {};
        const score = getProxyDisziScore(row, d.field, weights, colorToAxis[d.color] || 'pow');
        if (score > bestScore) { bestScore = score; bestField = d.field; }
      }
      return { field: bestField, score: bestScore };
    };

    const getPeakScore = (row) => {
      const vals = DISCIPLINES
        .map((d) => getProxyDisziScore(row, d.field, recipes[d.field] || {}, colorToAxis[d.color] || 'pow'))
        .filter((x) => x > 0)
        .sort((a, b) => b - a);

      if (!vals.length) return 0;
      const best = vals[0] || 0;
      const gt68 = vals.filter((x) => x >= 68).length;
      const gt76 = vals.filter((x) => x >= 76).length;
      return best * 0.42 + gt68 * 6 + gt76 * 8;
    };

    const getBreadthScore = (row) => {
      const vals = DISCIPLINES
        .map((d) => getProxyDisziScore(row, d.field, recipes[d.field] || {}, colorToAxis[d.color] || 'pow'))
        .filter((x) => x > 0)
        .sort((a, b) => b - a);

      if (!vals.length) return 0;
      const top3 = vals.slice(0, 3);
      const avgTop3 = top3.reduce((a, b) => a + b, 0) / Math.max(1, top3.length);
      const gt58 = vals.filter((x) => x >= 58).length;
      return avgTop3 * 0.60 + gt58 * 4;
    };

    const getCandidateValidity = (row) => {
      const name = playerNameOf(row);
      const price = priceOf(row);
      const fit = fitOf(row);
      const klasse = s(row?.klasse || row?.Klasse || row?.class || '');
      const color = getColor(row);
      const axis = getPrimaryAxisByClass(row);
      const core = coreOf(row);
      const peak = getPeakScore(row);
      const breadth = getBreadthScore(row);

      if (!name) return { ok: false, reason: 'missing_name' };
      if (!(price > 0) || !Number.isFinite(price)) return { ok: false, reason: 'bad_price' };
      if (!Number.isFinite(fit)) return { ok: false, reason: 'bad_fit' };
      if (!klasse) return { ok: false, reason: 'missing_klasse' };
      if (!color && !axis) return { ok: false, reason: 'missing_color_axis' };
      if (!(core > 0 || peak > 0 || breadth > 0)) return { ok: false, reason: 'no_usable_scores' };

      return { ok: true, reason: 'ok', name, price, fit, klasse, color, axis };
    };

    const sortedAxisPriority = Object.entries(axisPriorityAbs).sort((a, b) => n(b[1]) - n(a[1]));
    const topPriorityAxis = sortedAxisPriority[0]?.[0] || 'pow';
    const secondPriorityAxis = sortedAxisPriority[1]?.[0] || 'pow';
    const thirdPriorityAxis = sortedAxisPriority[2]?.[0] || '';
    const topPriorityColor = axisToColor[topPriorityAxis] || 'red';
    const secondPriorityColor = axisToColor[secondPriorityAxis] || 'red';
    const thirdPriorityColor = axisToColor[thirdPriorityAxis] || '';

    const topPriorityAbs = sortedAxisPriority[0]?.[1] || 0;
    const secondPriorityAbs = sortedAxisPriority[1]?.[1] || 0;
    const topPriorityLead01 = clamp((n(topPriorityAbs) - n(secondPriorityAbs)) / 10, 0, 1);

    const totalPriorityAbs = ['pow', 'spe', 'men', 'soc']
      .reduce((acc, ax) => acc + n(axisPriorityAbs[ax] || 0), 0);

    const desiredShare = (axis) => totalPriorityAbs <= 0 ? 0 : clamp(n(axisPriorityAbs[axis] || 0) / totalPriorityAbs, 0, 1);
    const topPriorityShare = desiredShare(topPriorityAxis);

    const focus_rigidity_01 = clamp(
      0.65 * clamp((topPriorityLead01 - 0.25) / 0.75, 0, 1) +
      0.35 * clamp((topPriorityShare - 0.45) / 0.45, 0, 1),
      0, 1
    );

    const extreme_focus_01 = clamp(
      0.55 * clamp((topPriorityLead01 - 0.70) / 0.30, 0, 1) +
      0.45 * clamp((topPriorityShare - 0.75) / 0.20, 0, 1),
      0, 1
    );

    const priorityFitFromWeights01 = (weights, fallbackAxis) => {
      const entries = Object.entries(weights || {}).filter((x) => n(x[1]) > 0);
      if (!entries.length) return desiredShare(fallbackAxis);

      let sumW = 0;
      let blended = 0;
      for (const [attr, wRaw] of entries) {
        const w = n(wRaw);
        const ax = ATTR_TO_AXIS[String(attr || '').toLowerCase()] || fallbackAxis;
        sumW += w;
        blended += desiredShare(ax) * w;
      }

      if (sumW <= 0) return desiredShare(fallbackAxis);
      return clamp(blended / sumW, 0, 1);
    };

    const player_min = clamp(
      Math.round(
        n(
          budgetLogic?.player_min ||
          tr?.player_min || tr?.playerMin ||
          tr?.min_players || tr?.minPlayers ||
          tr?.min_player || tr?.minPlayer || 0
        ) || (finances >= 7 ? 10 : 9)
      ),
      7, 12
    );

    const targetRosterSize = clamp(
      Math.round(
        n(
          budgetLogic?.optimum ||
          plan?.optimum ||
          tr?.optimum ||
          tr?.player_optimum ||
          tr?.playerOptimum ||
          tr?.optimal_players ||
          tr?.target_players ||
          overrides?.[team]?.roster?.target || 10
        ) || 10
      ),
      player_min, 12
    );

    const rosterCount = roster.length;
    const missing_to_min = Math.max(0, player_min - rosterCount);
    const missing_to_optimum = Math.max(0, targetRosterSize - rosterCount);

    const preview_fill_target = rosterCount < targetRosterSize;
    const upstream_planned_steps = Math.max(0, Math.round(n(plan?.planned_buys_now) || 0));
    const preview_steps_target =
      preview_fill_target
        ? missing_to_optimum
        : Math.max(1, upstream_planned_steps || 1);

    const planned_steps = clamp(
      Math.round(preview_steps_target),
      0,
      Math.max(0, 12 - rosterCount)
    );

    const initial_budget = Number(
      (
        n(budgetLogic?.allowed_budget_for_search) ||
        n(plan?.allowed_budget_for_search) ||
        cash
      ).toFixed(2)
    );

    const getFoundationTargets = () => {
      if (topPriorityLead01 >= 0.80) return { primaryCount: 5, strongCount: 4, strongAxisFloor: 60 };
      if (topPriorityLead01 >= 0.35) return { primaryCount: 4, strongCount: 3, strongAxisFloor: 56 };
      return { primaryCount: 4, strongCount: 3, strongAxisFloor: 54 };
    };

    const getFoundationState = (players) => {
      const cfg = getFoundationTargets();
      const arr = Array.isArray(players) ? players : [];

      const primaryTarget = cfg.primaryCount;
      const strongTarget = cfg.strongCount;
      const strongAxisFloor = cfg.strongAxisFloor;

      const primaryCount = arr.filter((p) => getColor(p) === topPriorityColor).length;
      const strongCount = arr.filter(
        (p) => getColor(p) === topPriorityColor && axisValue(p, topPriorityAxis) >= strongAxisFloor
      ).length;

      const ready = primaryCount >= primaryTarget && strongCount >= strongTarget;

      const pivotExtraPrimary =
        topPriorityLead01 >= 0.75 ? 1 :
        topPriorityLead01 >= 0.35 ? 3 : 2;

      const pivotExtraStrong =
        topPriorityLead01 >= 0.75 ? 1 :
        topPriorityLead01 >= 0.35 ? 2 : 1;

      const pivotPrimaryTarget = primaryTarget + pivotExtraPrimary;
      const pivotStrongTarget = strongTarget + pivotExtraStrong;

      const pivotReady =
        primaryCount >= pivotPrimaryTarget &&
        strongCount >= pivotStrongTarget;

      const countNeed01 = clamp((primaryTarget - primaryCount) / Math.max(1, primaryTarget), 0, 1);
      const strongNeed01 = clamp((strongTarget - strongCount) / Math.max(1, strongTarget), 0, 1);
      const pivotCountNeed01 = clamp((pivotPrimaryTarget - primaryCount) / Math.max(1, pivotPrimaryTarget), 0, 1);
      const pivotStrongNeed01 = clamp((pivotStrongTarget - strongCount) / Math.max(1, pivotStrongTarget), 0, 1);

      return {
        primaryTarget,
        strongTarget,
        pivotPrimaryTarget,
        pivotStrongTarget,
        strongAxisFloor,
        primaryCount,
        strongCount,
        ready,
        pivotReady,
        need01: clamp(0.55 * countNeed01 + 0.45 * strongNeed01, 0, 1),
        pivotNeed01: clamp(0.55 * pivotCountNeed01 + 0.45 * pivotStrongNeed01, 0, 1)
      };
    };

    const getTopNProxyDisziSum = (players, field, weights, topN = 6) => {
      const fallbackAxis = colorToAxis[DISCIPLINE_BY_FIELD[field]?.color || 'red'] || 'pow';
      const arr = (Array.isArray(players) ? players : [])
        .map((p) => getProxyDisziScore(p, field, weights || {}, fallbackAxis))
        .filter((x) => x > 0)
        .sort((a, b) => b - a);

      return arr.slice(0, topN).reduce((a, b) => a + b, 0);
    };

    const baseProxyTop6ByField = Object.fromEntries(
      DISCIPLINES.map((d) => [d.field, getTopNProxyDisziSum(roster, d.field, recipes[d.field] || {}, 6)])
    );

    const getEstimatedTeamDisziSum = (players, field, weights) => {
      const baseActual = n(rankingsRow?.[field + '_sum'] || 0);
      const currentProxy = getTopNProxyDisziSum(players, field, weights, 6);
      const baseProxy = n(baseProxyTop6ByField[field] || 0);
      const proxyDelta = currentProxy - baseProxy;
      return Math.max(0, baseActual + proxyDelta);
    };

    const getMarginalDisziGainInfo = (players, candidate, field, weights, topN = 6) => {
      const fallbackAxis = colorToAxis[DISCIPLINE_BY_FIELD[field]?.color || 'red'] || 'pow';

      const currentScores = (Array.isArray(players) ? players : [])
        .map((p) => getProxyDisziScore(p, field, weights || {}, fallbackAxis))
        .filter((x) => x > 0)
        .sort((a, b) => b - a);

      const beforeSumProxy = currentScores.slice(0, topN).reduce((a, b) => a + b, 0);
      const afterSumProxy = getTopNProxyDisziSum([...(players || []), candidate], field, weights, topN);
      const rawGain = Math.max(0, afterSumProxy - beforeSumProxy);

      const candScore = getProxyDisziScore(candidate, field, weights || {}, fallbackAxis);
      const earlyFillMode = currentScores.length < topN;

      const usefulFloor =
        fallbackAxis === topPriorityAxis ? 60 :
        fallbackAxis === secondPriorityAxis ? 62 : 65;

      const beforeCut = earlyFillMode ? usefulFloor : n(currentScores[topN - 1] || usefulFloor);
      const overCut = Math.max(0, candScore - beforeCut);
      const fillStrength01 = clamp((candScore - usefulFloor) / 16, 0, 1);

      const gain01 = earlyFillMode ? fillStrength01 : clamp(rawGain / 10, 0, 1);
      const overCut01 = earlyFillMode ? fillStrength01 : clamp(overCut / 12, 0, 1);

      return {
        beforeSum: beforeSumProxy,
        afterSum: afterSumProxy,
        gain: rawGain,
        overCut,
        gain01,
        overCut01,
        candScore,
        earlyFillMode,
        usefulFloor
      };
    };

    const getLeagueSumsForField = (field) => {
      return rankingsAll
        .map((r) => n(r?.[field + '_sum']))
        .filter((x) => x > 0)
        .sort((a, b) => b - a);
    };

    const getRankTargetSum = (leagueSumsDesc, rankTarget) => {
      if (!leagueSumsDesc.length) return 0;
      const idx = clamp(Math.round(rankTarget) - 1, 0, leagueSumsDesc.length - 1);
      return n(leagueSumsDesc[idx] || 0);
    };

    const estimateRankFromSum = (leagueSumsDesc, ownSum) => {
      if (!leagueSumsDesc.length) return totalTeams;
      const cntBetter = leagueSumsDesc.filter((x) => x > ownSum + 1e-9).length;
      return clamp(cntBetter + 1, 1, Math.max(1, leagueSumsDesc.length));
    };

    const getLeagueGapStats = (leagueSumsDesc, ownSum, axis) => {
      if (!leagueSumsDesc.length) {
        return {
          currentRankEst: totalTeams,
          nextGap: 999,
          gapTo12: 999,
          gapTo8: 999,
          gapTo5: 999,
          attackability01: 0,
          hopeless01: 1,
          scale: 10
        };
      }

      const currentRankEst = estimateRankFromSum(leagueSumsDesc, ownSum);
      const nextHigher = currentRankEst > 1 ? n(leagueSumsDesc[currentRankEst - 2] || ownSum) : ownSum;
      const nextGap = Math.max(0, nextHigher - ownSum);

      const q25 = quantile(leagueSumsDesc, 0.25);
      const q75 = quantile(leagueSumsDesc, 0.75);
      const scale = Math.max(
        8,
        q75 - q25,
        (n(leagueSumsDesc[0]) - n(leagueSumsDesc[leagueSumsDesc.length - 1])) / 4
      );

      const rankTargetSoft = axis === topPriorityAxis ? 8 : axis === secondPriorityAxis ? 10 : 12;
      const rankTargetMid = axis === topPriorityAxis ? 5 : axis === secondPriorityAxis ? 8 : 10;

      const sum12 = getRankTargetSum(leagueSumsDesc, rankTargetSoft);
      const sum8 = getRankTargetSum(leagueSumsDesc, rankTargetMid);
      const sum5 = getRankTargetSum(leagueSumsDesc, 5);

      const gapTo12 = Math.max(0, sum12 - ownSum);
      const gapTo8 = Math.max(0, sum8 - ownSum);
      const gapTo5 = Math.max(0, sum5 - ownSum);

      const nextGain01 = clamp(1 - nextGap / Math.max(8, scale * 0.95), 0, 1);
      const softTargetGain01 = clamp(1 - gapTo12 / Math.max(10, scale * 2.0), 0, 1);
      const midTargetGain01 = clamp(1 - gapTo8 / Math.max(12, scale * 2.8), 0, 1);

      const attackability01 = clamp(
        0.48 * nextGain01 +
        0.34 * softTargetGain01 +
        0.18 * midTargetGain01,
        0, 1
      );

      const bottomBad01 = clamp((currentRankEst - Math.min(totalTeams, 22)) / Math.max(1, totalTeams - 22), 0, 1);
      const targetHopelessGap01 = clamp(gapTo12 / Math.max(10, scale * 4.5), 0, 1);
      const hopeless01 = clamp(
        0.55 * bottomBad01 + 0.45 * targetHopelessGap01,
        0, 1
      ) * (1 - attackability01);

      return {
        currentRankEst,
        nextGap,
        gapTo12,
        gapTo8,
        gapTo5,
        attackability01,
        hopeless01,
        scale
      };
    };

    const getCandidateDisziRankingInfo = (row, targetField, targetWeights) => {
      const scored = DISCIPLINES
        .map((d) => ({
          field: d.field,
          proxyScore: getProxyDisziScore(row, d.field, recipes[d.field] || {}, colorToAxis[d.color] || 'pow')
        }))
        .sort((a, b) => n(b.proxyScore) - n(a.proxyScore));

      const rank = Math.max(1, scored.findIndex((x) => x.field === targetField) + 1);
      const targetProxyScore = getProxyDisziScore(
        row,
        targetField,
        targetWeights || {},
        colorToAxis[DISCIPLINE_BY_FIELD[targetField]?.color || 'red'] || 'pow'
      );

      return { rank, top3: rank <= 3, top5: rank <= 5, targetProxyScore };
    };

    const getAbsoluteRankBonus01 = (rankInfo, disziScore, threshold) => {
      if (rankInfo?.top3 && disziScore >= threshold - 2) return 1;
      if (rankInfo?.top5 && disziScore >= threshold + 2) return 0.55;
      return 0;
    };

    const getDisziCompatibilityFactor = ({
      candColor, candAxisByClass, needAxis, needColor, disziScore, threshold, gainInfo
    }) => {
      const axisMatch = !!candAxisByClass && candAxisByClass === needAxis;
      const colorMatch = !!candColor && candColor === needColor;

      const proxyStrong01 = clamp((disziScore - threshold) / 16, 0, 1);
      const delta01 = clamp(0.55 * n(gainInfo?.gain01) + 0.45 * n(gainInfo?.overCut01), 0, 1);

      if (axisMatch && colorMatch) return 1.0;
      if (axisMatch) return clamp(0.93 + 0.07 * proxyStrong01, 0, 1);
      if (colorMatch) return clamp(0.88 + 0.08 * proxyStrong01 + 0.04 * delta01, 0, 1);

      if (proxyStrong01 >= 0.90 && delta01 >= 0.45) return 0.78;
      if (proxyStrong01 >= 0.75) return 0.66;
      if (delta01 >= 0.65) return 0.62;
      if (n(gainInfo?.earlyFillMode) && proxyStrong01 >= 0.45) return 0.56;
      if (proxyStrong01 >= 0.35) return 0.48;
      if (proxyStrong01 >= 0.20 || delta01 >= 0.20) return 0.34;

      return 0.24;
    };

    const getNeedClusterKey = (need) => {
      if (need.family === 'diszi' || need.family === 'specialist') {
        const axis = need.axis || 'misc';
        const color = need.color || axisToColor[axis] || '';
        return `focus_cluster:${axis}:${color}`;
      }
      if (need.family === 'card') return `card:${need.color || ''}`;
      if (need.family === 'axis') return `axis:${need.axis || ''}`;
      return `${need.family || 'misc'}:${need.label || ''}`;
    };

    const getNeedClusterMultiplier = (clusterKey, seenCount) => {
      const cnt = n(seenCount || 0);
      if (!String(clusterKey || '').startsWith('focus_cluster:')) return 1;
      if (cnt <= 0) return 1.00;
      if (cnt === 1) return 0.68;
      if (cnt === 2) return 0.38;
      return 0.18;
    };

    const isWeakFallbackCandidate = (pick, plannedRole) => {
      if (!pick?.sc) return true;
      const sc = pick.sc;
      const role = lower(plannedRole || 'depth');

      const minScore =
        role === 'core' ? 10 :
        role === 'depth' ? 6 :
        role === 'reserve' ? 2 : 4;

      if (n(sc.score) < 0) return true;
      if (n(sc.score) < minScore) return true;

      const noRealMatch =
        n(sc.matchedNeedCount) <= 0 &&
        n(sc.effectiveMatchedNeedScore) < 0.7 &&
        n(sc.focus_specialist_relief_01) < 0.22;

      const weakSupport =
        n(sc.top_axis_support_01) < 0.42 &&
        n(sc.secondary_coverage_bonus) <= 0;

      return noRealMatch && weakSupport;
    };

    const chosenFailsUtilityFloor = (pick, plannedRole, fillToMinActive) => {
      if (!pick?.sc) return true;
      const sc = pick.sc;
      const role = lower(plannedRole || 'depth');

      const rescuedByHelpfulCard =
        !!sc.is_cheap_pick &&
        !!sc.card_color_rescue_ok &&
        n(sc.team_color_help_01) >= n(sc.card_color_rescue_threshold || 0) &&
        (
          n(sc.bestDisziScore) >= 26 ||
          n(sc.secondary_coverage_bonus) >= 4 ||
          n(sc.fit) >= 12 ||
          n(sc.top_axis_support_01) >= 0.45
        );

      const zeroUtility =
        n(sc.matchedNeedCount) <= 0 &&
        n(sc.effectiveMatchedNeedScore) < 0.8 &&
        n(sc.secondary_coverage_bonus) < 8 &&
        n(sc.cross_color_focus_specialist_bonus) < 2 &&
        n(sc.focus_specialist_relief_01) < 0.20 &&
        n(sc.bestDisziScore) < 58;

      const weakUtility =
        n(sc.matchedNeedCount) <= 0 &&
        n(sc.effectiveMatchedNeedScore) < 1.0 &&
        n(sc.secondary_coverage_bonus) < 8 &&
        n(sc.cross_color_focus_specialist_bonus) < 2.5 &&
        n(sc.focus_specialist_relief_01) < 0.24 &&
        n(sc.bestDisziScore) < 62;

      if (n(sc.score) < -1) return true;
      if (zeroUtility && !rescuedByHelpfulCard) return true;

      if (role === 'core' && weakUtility && !rescuedByHelpfulCard && n(sc.score) < 18) return true;
      if (role === 'depth' && !fillToMinActive && weakUtility && !rescuedByHelpfulCard && n(sc.score) < 12) return true;
      if (role === 'reserve' && weakUtility && !rescuedByHelpfulCard && n(sc.score) < 8) return true;

      return false;
    };

    const bracketStarts =
      Array.isArray(bracketCfg?.starts) && bracketCfg.starts.length
        ? bracketCfg.starts
        : [0, 12.5, 17.5, 22.5, 30, 37.5, 45, 55, 70];

    const getBracket = (marktwert) => {
      const mw = n(marktwert);
      if (mw < bracketStarts[1]) return 1;
      if (mw < bracketStarts[2]) return 2;
      if (mw < bracketStarts[3]) return 3;
      if (mw < bracketStarts[4]) return 4;
      if (mw < bracketStarts[5]) return 5;
      if (mw < bracketStarts[6]) return 6;
      if (mw < bracketStarts[7]) return 7;
      if (mw < bracketStarts[8]) return 8;
      return 9;
    };

    const maxPriceForBracket = (br) => {
      const b = Math.round(n(br));
      if (b <= 0) return 0;
      if (b >= bracketStarts.length) return 999999;
      return n(bracketStarts[b] || 999999) - 0.01;
    };

    const roleWindows = {
      reserve: { min: 1, max: 3, fallbackMin: 1, fallbackMax: 4 },
      depth:   { min: 2, max: 5, fallbackMin: 1, fallbackMax: 6 },
      core:    { min: 4, max: 7, fallbackMin: 3, fallbackMax: 8 },
      star:    { min: 6, max: 9, fallbackMin: 5, fallbackMax: 9 },
      diszi:   { min: 3, max: 6, fallbackMin: 2, fallbackMax: 7 }
    };

    const coerceSlotPlan = (src, srcPlan) => {
      if (Array.isArray(src)) return src.map((x) => String(x));
      if (Array.isArray(src?.slot_plan)) return src.slot_plan.map((x) => String(x));
      if (Array.isArray(src?.data)) return src.data.map((x) => String(x));

      if (src && typeof src === 'object') {
        const numericKeys = Object.keys(src)
          .filter((k) => /^\d+$/.test(String(k)))
          .map((k) => Number(k))
          .sort((a, b) => a - b);

        if (numericKeys.length) return numericKeys.map((k) => String(src[k]));
      }

      const arr = [];
      const pushMany = (role, count) => {
        const c = Math.max(0, Math.round(n(count)));
        for (let i = 0; i < c; i++) arr.push(String(role));
      };

      pushMany('star', srcPlan?.star_slots_remaining || srcPlan?.star);
      pushMany('core', srcPlan?.core_slots_remaining || srcPlan?.core);
      pushMany('diszi', srcPlan?.diszi_slots_remaining || srcPlan?.diszi);
      pushMany('depth', srcPlan?.depth_slots_remaining || srcPlan?.depth);
      pushMany('reserve', srcPlan?.reserve_slots_remaining || srcPlan?.reserve);

      while (arr.length < planned_steps) arr.push('depth');
      return arr.slice(0, planned_steps);
    };

    const buildAutoSlotPlan = (stepsCnt, rosterCntNow, budgetNow) => {
      const arr = [];
      if (stepsCnt <= 0) return arr;

      const avgStepBudget = budgetNow / Math.max(1, stepsCnt);
      const wantsSecondCore = stepsCnt >= 5 && avgStepBudget >= 26;

      let secondCorePlaced = false;

      for (let i = 0; i < stepsCnt; i++) {
        const rosterBefore = rosterCntNow + i;
        const stillBelowMin = rosterBefore < player_min;
        const picksLeftAfter = stepsCnt - i - 1;
        const rosterAfterThis = rosterBefore + 1;
        const wouldBeAtOrAboveMin = rosterAfterThis >= player_min;
        const nearEnd = i >= stepsCnt - 2;

        if (i === 0) {
          arr.push('core');
          continue;
        }

        if (
          wantsSecondCore &&
          !secondCorePlaced &&
          i >= 2 &&
          (nearEnd || (wouldBeAtOrAboveMin && picksLeftAfter >= 1))
        ) {
          arr.push('core');
          secondCorePlaced = true;
          continue;
        }

        if (!stillBelowMin) {
          if (nearEnd) {
            arr.push('reserve');
          } else {
            arr.push('depth');
          }
          continue;
        }

        if (wouldBeAtOrAboveMin && nearEnd) {
          arr.push('depth');
        } else {
          arr.push('depth');
        }
      }

      return arr.slice(0, stepsCnt);
    };

    const sanitizeSlotPlanForThinRoster = (rawPlan) => {
      const arr = [...(Array.isArray(rawPlan) ? rawPlan : [])].map((x) => lower(x || 'depth'));
      if (!arr.length) return arr;

      const out = [...arr];

      const findNextPreferredRole = (startIdx) => {
        const preferredOrder = ['core', 'diszi', 'depth', 'star'];
        for (const wanted of preferredOrder) {
          const idx = out.findIndex((r, i) => i > startIdx && lower(r) === wanted);
          if (idx > startIdx) return idx;
        }
        return -1;
      };

      for (let i = 0; i < out.length; i++) {
        const rosterBefore = rosterCount + i;
        const belowMin = rosterBefore < player_min;
        if (!belowMin) continue;

        if (out[i] === 'reserve') {
          const swapIdx = findNextPreferredRole(i);
          if (swapIdx > i) {
            const tmp = out[i];
            out[i] = lower(out[swapIdx]);
            out[swapIdx] = tmp;
          } else {
            out[i] = (rosterBefore + 1 >= player_min) ? 'core' : 'depth';
          }
        }
      }

      const firstReserve = out.findIndex((r) => lower(r) === 'reserve');
      const firstCore = out.findIndex((r) => lower(r) === 'core');

      if (firstReserve >= 0 && firstCore > firstReserve && rosterCount + firstReserve < player_min) {
        const tmp = out[firstReserve];
        out[firstReserve] = out[firstCore];
        out[firstCore] = tmp;
      }

      while (out.length < planned_steps) out.push('depth');
      return out.slice(0, planned_steps);
    };

    const upstreamSlotPlanRaw = coerceSlotPlan(slotPlanObj, plan);
    const upstreamSlotPlanTooShort = upstreamSlotPlanRaw.length < planned_steps;
    const auto_step_planner_active = preview_fill_target;
    const slot_plan_source =
      auto_step_planner_active || upstreamSlotPlanTooShort
        ? 'preview_autobuild'
        : 'upstream';

    const slotPlanRaw =
      slot_plan_source === 'preview_autobuild'
        ? buildAutoSlotPlan(planned_steps, rosterCount, initial_budget)
        : upstreamSlotPlanRaw.slice(0, planned_steps);

    const slotPlan = sanitizeSlotPlanForThinRoster(slotPlanRaw);

    const slotCountByRole = slotPlan.reduce((acc, role) => {
      const r = lower(role);
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, { star: 0, core: 0, depth: 0, reserve: 0, diszi: 0 });

    const rawBudgetTracks = safeJson(plan?.budget_tracks || {});
    const fallbackBudgetTracks = (() => {
      const out = { star: 0, core: 0, depth: 0, reserve: 0, diszi: 0 };
      const total = Math.max(0, initial_budget);
      const cnt = Math.max(1, planned_steps);
      if (cnt <= 0 || total <= 0) return out;

      const weights = {
        star: slotCountByRole.star * 1.8,
        core: slotCountByRole.core * 1.35,
        depth: slotCountByRole.depth * 1.0,
        reserve: slotCountByRole.reserve * 0.7,
        diszi: slotCountByRole.diszi * 1.15
      };

      const sumW = Object.values(weights).reduce((a, b) => a + n(b), 0) || 1;
      for (const k of Object.keys(out)) {
        out[k] = Number(((n(weights[k]) / sumW) * total).toFixed(2));
      }
      return out;
    })();

    const budget_tracks_source =
      auto_step_planner_active ||
      upstreamSlotPlanTooShort ||
      (preview_fill_target && upstream_planned_steps !== planned_steps)
        ? 'autobuild_from_slot_plan'
        : 'upstream_or_fallback';

    const budgetTracks = {
      star: n(budget_tracks_source === 'autobuild_from_slot_plan' ? fallbackBudgetTracks.star : (rawBudgetTracks?.star || fallbackBudgetTracks.star || 0)),
      core: n(budget_tracks_source === 'autobuild_from_slot_plan' ? fallbackBudgetTracks.core : (rawBudgetTracks?.core || fallbackBudgetTracks.core || 0)),
      depth: n(budget_tracks_source === 'autobuild_from_slot_plan' ? fallbackBudgetTracks.depth : (rawBudgetTracks?.depth || fallbackBudgetTracks.depth || 0)),
      reserve: n(budget_tracks_source === 'autobuild_from_slot_plan' ? fallbackBudgetTracks.reserve : (rawBudgetTracks?.reserve || fallbackBudgetTracks.reserve || 0)),
      diszi: n(budget_tracks_source === 'autobuild_from_slot_plan' ? fallbackBudgetTracks.diszi : (rawBudgetTracks?.diszi || fallbackBudgetTracks.diszi || 0))
    };

    const futureRoleFloor = (role) => {
      const r = lower(role || 'depth');
      if (r === 'reserve') return 10;
      if (r === 'depth') return 14;
      if (r === 'core') return 20;
      if (r === 'star') return 28;
      if (r === 'diszi') return 16;
      return 12;
    };

    const fitMinSoft = n(varianceCfg?.fitMinSoft?.sampled || 0);
    const fitHard =
      harmony >= 10 ? 12 :
      harmony >= 9 ? 10 :
      harmony >= 8 ? 8 :
      harmony >= 7 ? 6 : 0;

    const universal_low_fit_hard = 2;
    const fit25Bonus =
      harmony >= 10 ? 10 :
      harmony >= 9 ? 8 :
      harmony >= 8 ? 6 :
      harmony >= 7 ? 3 : 0;

    const team_variation_factor = Number(n(varianceCfg?.team_variation_factor || 0).toFixed(3));

    const evaluateManagerPivot = (players) => {
      const arr = Array.isArray(players) ? players : [];
      const foundation = getFoundationState(arr);

      const primaryColorCount = arr.filter((p) => getColor(p) === topPriorityColor).length;
      const topAxisPlayers = arr.filter((p) => getPrimaryAxisByClass(p) === topPriorityAxis);
      const topAxisAvg = topAxisPlayers.length
        ? topAxisPlayers.reduce((acc, p) => acc + axisValue(p, topPriorityAxis), 0) / topAxisPlayers.length
        : 0;

      const strongPrimaryCount = topAxisPlayers.filter((p) => axisValue(p, topPriorityAxis) >= foundation.strongAxisFloor).length;

      const focus_strength_01 = topPriorityLead01;

      const comfort_count_target =
        focus_strength_01 >= 0.85 ? 5 :
        focus_strength_01 >= 0.55 ? 4 : 4;

      const avg_comfort_target =
        focus_strength_01 >= 0.85 ? 64 :
        focus_strength_01 >= 0.55 ? 60 : 56;

      const countComfort01 = clamp(primaryColorCount / Math.max(1, comfort_count_target), 0, 1);
      const avgComfort01 = clamp((topAxisAvg - 46) / Math.max(8, avg_comfort_target - 46), 0, 1);
      const strongComfort01 = clamp(strongPrimaryCount / Math.max(1, comfort_count_target - 1), 0, 1);

      const primary_comfort_01 = clamp(
        0.38 * countComfort01 +
        0.32 * avgComfort01 +
        0.30 * strongComfort01,
        0, 1
      );

      const pivot_threshold =
        focus_strength_01 >= 0.80 ? 0.95 :
        focus_strength_01 >= 0.55 ? 0.90 :
        0.86;

      const canPivot =
        foundation.ready &&
        foundation.pivotReady &&
        primary_comfort_01 >= pivot_threshold;

      const launchReady =
        foundation.ready &&
        !foundation.pivotReady &&
        primary_comfort_01 >= Math.max(0.82, pivot_threshold - 0.08);

      const excessPrimary01 = clamp((primaryColorCount - foundation.pivotPrimaryTarget) / 3, 0, 1);
      const excessStrong01 = clamp((strongPrimaryCount - foundation.pivotStrongTarget) / 3, 0, 1);

      const launchPivot01 = launchReady
        ? clamp(0.10 + 0.16 * (1 - foundation.pivotNeed01), 0, 0.24)
        : 0;

      const diversify_pivot_01 = canPivot
        ? clamp(
            0.52 * clamp((primary_comfort_01 - pivot_threshold) / Math.max(0.001, 1 - pivot_threshold), 0, 1) +
            0.28 * excessPrimary01 +
            0.20 * excessStrong01,
            0, 1
          )
        : launchPivot01;

      const active = canPivot && diversify_pivot_01 >= 0.10;

      const dominantColorEntry = Object.entries(
        arr.reduce((acc, p) => {
          const c = getColor(p);
          if (c) acc[c] = (acc[c] || 0) + 1;
          return acc;
        }, { red: 0, green: 0, blue: 0, yellow: 0 })
      ).sort((a, b) => n(b[1]) - n(a[1]))[0] || ['red', 0];

      const dominant_color = dominantColorEntry[0];
      const dominant_color_count = n(dominantColorEntry[1]);

      return {
        focus_strength_01: Number(focus_strength_01.toFixed(3)),
        focus_rigidity_01: Number(focus_rigidity_01.toFixed(3)),
        extreme_focus_01: Number(extreme_focus_01.toFixed(3)),
        primary_color_count: primaryColorCount,
        top_axis_avg: Number(topAxisAvg.toFixed(2)),
        strong_primary_count: strongPrimaryCount,
        comfort_count_target,
        avg_comfort_target,
        primary_comfort_01: Number(primary_comfort_01.toFixed(3)),
        min_primary_count_for_pivot: foundation.pivotPrimaryTarget,
        min_strong_primary_for_pivot: foundation.pivotStrongTarget,
        strong_axis_floor_for_pivot: foundation.strongAxisFloor,
        foundation_ready: foundation.ready,
        foundation_need_01: Number(foundation.need01.toFixed(3)),
        pivot_ready: foundation.pivotReady,
        pivot_need_01: Number(foundation.pivotNeed01.toFixed(3)),
        launch_ready: launchReady,
        pivot_threshold: Number(pivot_threshold.toFixed(3)),
        diversify_pivot_01: Number(diversify_pivot_01.toFixed(3)),
        active,
        dominant_color,
        dominant_color_count,
        top_axis_color_count: primaryColorCount
      };
    };

    const getTopColorSoftCap = (focusLead01, color) => {
      if (!color) return 4;

      if (color === topPriorityColor) {
        if (focusLead01 >= 0.95) return 8;
        if (focusLead01 >= 0.75) return 7;
        if (focusLead01 >= 0.55) return 6;
        return 5;
      }

      if (color === secondPriorityColor) {
        if (focusLead01 >= 0.85) return 6;
        return 5;
      }

      return 4;
    };

    const getColorNeedPressure01 = (color, needsNow) => {
      if (!color) return 0;
      let score = 0;

      (Array.isArray(needsNow) ? needsNow : []).slice(0, 6).forEach((need, idx) => {
        const w =
          idx === 0 ? 1.00 :
          idx === 1 ? 0.78 :
          idx === 2 ? 0.58 :
          idx === 3 ? 0.42 :
          idx === 4 ? 0.28 : 0.18;

        const colorMatch = s(need?.color) === color;
        const axisMatch = axisToColor[s(need?.axis)] === color;

        if (colorMatch || axisMatch) score += w;
      });

      return clamp(score / 2.15, 0, 1);
    };

    const getTeamColorHelp01 = ({ candColor, playersNow, needsNow, managerPivotNow, foundationState }) => {
      if (!candColor) return 0;

      const axis = colorToAxis[candColor] || '';
      const count = (Array.isArray(playersNow) ? playersNow : []).filter((p) => getColor(p) === candColor).length;
      const needPressure01 = getColorNeedPressure01(candColor, needsNow);
      const softCap = getTopColorSoftCap(topPriorityLead01, candColor);
      const saturation01 = clamp((count - softCap) / Math.max(1, softCap), 0, 1);
      const scarcity01 = clamp((3 - count) / 3, 0, 1);

      let priorityBase = 0;
      if (candColor === topPriorityColor) {
        priorityBase = 0.96;
      } else if (candColor === secondPriorityColor) {
        priorityBase = 0.68 + 0.18 * desiredShare(axis);
      } else if (candColor === thirdPriorityColor) {
        priorityBase =
          foundationState.ready && managerPivotNow.active
            ? 0.40 + 0.22 * desiredShare(axis)
            : 0.10 + 0.10 * desiredShare(axis);
      } else {
        priorityBase = 0.05 + 0.08 * desiredShare(axis);
      }

      if (managerPivotNow.launch_ready && !managerPivotNow.pivot_ready && candColor === secondPriorityColor) {
        priorityBase += 0.04 * (1 - 0.55 * extreme_focus_01);
      }
      if (managerPivotNow.active && candColor === thirdPriorityColor) priorityBase += 0.06;

      let help =
        0.58 * priorityBase +
        0.27 * needPressure01 +
        0.15 * scarcity01;

      if (candColor !== topPriorityColor && !managerPivotNow.active) {
        const rigidityPenalty =
          candColor === secondPriorityColor
            ? 0.12 * focus_rigidity_01 + 0.08 * extreme_focus_01
            : candColor === thirdPriorityColor
              ? 0.28 * focus_rigidity_01 + 0.45 * extreme_focus_01
              : 0.22 * focus_rigidity_01 + 0.30 * extreme_focus_01;

        help *= (1 - rigidityPenalty);
      }

      const satPenalty =
        candColor === topPriorityColor
          ? 0.10 * saturation01
          : candColor === secondPriorityColor
            ? 0.18 * saturation01
            : 0.24 * saturation01;

      help -= satPenalty;

      return clamp(help, 0, 1);
    };

    const getCheapPickThreshold = (role, roleCtx) => {
      const target = n(roleCtx?.roleTargetBudget || 0);
      if (role === 'reserve') return Math.max(12, Math.min(24, target * 1.05 + 4));
      if (role === 'depth') return Math.max(14, Math.min(22, target * 0.85 + 3));
      if (role === 'core') return Math.max(18, Math.min(28, target * 0.80 + 5));
      if (role === 'diszi') return Math.max(16, Math.min(24, target * 0.90 + 3));
      return Math.max(14, Math.min(24, target * 0.90 + 3));
    };

    const getCheapCardRescueMeta = ({
      price, role, roleCtx, candColor, teamColorHelp01, bestDisziScore, fit,
      secondary_coverage_bonus, top_axis_support_01, managerPivotNow, foundationState
    }) => {
      const cheapPickThreshold = getCheapPickThreshold(role, roleCtx);
      const isCheap = price <= cheapPickThreshold + 1e-9;

      const isThirdExpansion =
        candColor === thirdPriorityColor &&
        foundationState.ready &&
        !!managerPivotNow.active;

      const rescueThreshold =
        candColor === topPriorityColor ? 0.58 :
        candColor === secondPriorityColor ? 0.68 :
        isThirdExpansion ? 0.76 : 0.86;

      const rescueOk =
        isCheap &&
        teamColorHelp01 >= rescueThreshold &&
        (
          bestDisziScore >= 26 ||
          secondary_coverage_bonus >= 4 ||
          fit >= 12 ||
          top_axis_support_01 >= 0.45
        );

      const tier =
        candColor === topPriorityColor ? 'top' :
        candColor === secondPriorityColor ? 'second' :
        isThirdExpansion ? 'third_active' :
        candColor === thirdPriorityColor ? 'third_blocked' : 'other';

      return {
        isCheap,
        cheapPickThreshold: Number(cheapPickThreshold.toFixed(2)),
        rescueThreshold: Number(rescueThreshold.toFixed(3)),
        rescueOk,
        tier
      };
    };

    const buildDynamicNeeds = (players) => {
      const rosterNow = Array.isArray(players) ? players : [];
      const rosterCountNow = rosterNow.length;
      const thinRosterNow = rosterCountNow < Math.max(7, targetRosterSize - 2);

      const managerPivot = evaluateManagerPivot(rosterNow);
      const foundation = getFoundationState(rosterNow);

      const avgAxis = (axis) =>
        rosterCountNow
          ? rosterNow.reduce((acc, p) => acc + axisValue(p, axis), 0) / rosterNow.length
          : 0;

      const teamCoreNow = {
        pow: avgAxis('pow'),
        spe: avgAxis('spe'),
        men: avgAxis('men'),
        soc: avgAxis('soc')
      };

      const axisMass = {
        pow: rosterNow.reduce((acc, r) => acc + axisValue(r, 'pow'), 0),
        spe: rosterNow.reduce((acc, r) => acc + axisValue(r, 'spe'), 0),
        men: rosterNow.reduce((acc, r) => acc + axisValue(r, 'men'), 0),
        soc: rosterNow.reduce((acc, r) => acc + axisValue(r, 'soc'), 0)
      };

      const totalMass = n(axisMass.pow) + n(axisMass.spe) + n(axisMass.men) + n(axisMass.soc);

      const actualShare = (axis) =>
        totalMass <= 0 ? 0 : clamp(n(axisMass[axis] || 0) / totalMass, 0, 1);

      const coreVals = Object.values(teamCoreNow);
      const coreMax = coreVals.length ? Math.max(...coreVals) : 0;
      const coreMin = coreVals.length ? Math.min(...coreVals) : 0;
      const coreRange = coreMax - coreMin || 1;

      const weakness01 = (axis) => clamp((coreMax - n(teamCoreNow[axis])) / coreRange, 0, 1);
      const coverageGap = (axis) => clamp(Math.max(0, desiredShare(axis) - actualShare(axis)), 0, 1);

      const rosterColorCounts = rosterNow.reduce(
        (acc, r) => {
          const c = getColor(r);
          if (!c) return acc;
          acc[c] = (acc[c] || 0) + 1;
          return acc;
        },
        { red: 0, green: 0, blue: 0, yellow: 0 }
      );

      const colorShare01 = (color) =>
        clamp(n(rosterColorCounts[color] || 0) / Math.max(1, rosterCountNow || 1), 0, 1);

      const primaryColors = Object.entries(rosterColorCounts)
        .sort((a, b) => n(b[1]) - n(a[1]))
        .slice(0, 2)
        .map((x) => x[0]);

      const needs = [];

      const axisRows = ['soc', 'pow', 'spe', 'men']
        .map((axis) => {
          const dSh = desiredShare(axis);
          const gap = coverageGap(axis);
          const weak = weakness01(axis);

          const isTop = axis === topPriorityAxis ? 1 : 0;
          const isSecond = axis === secondPriorityAxis ? 1 : 0;

          const topAxisSoftener = managerPivot.active && isTop
            ? (1 - 0.34 * n(managerPivot.diversify_pivot_01))
            : 1;

          const secondAxisBooster = managerPivot.active && isSecond
            ? (1 + 0.34 * n(managerPivot.diversify_pivot_01))
            : 1;

          const otherAxisBooster = managerPivot.active && !isTop && !isSecond
            ? (1 + 0.20 * n(managerPivot.diversify_pivot_01))
            : 1;

          const foundationTopAxisBoost =
            !foundation.ready && axis === topPriorityAxis ? 0.12 * n(foundation.need01) : 0;

          const prePivotTopAxisHold =
            foundation.ready && !managerPivot.pivot_ready && axis === topPriorityAxis
              ? (0.05 + 0.05 * (1 - n(foundation.pivotNeed01)) + 0.06 * focus_rigidity_01 + 0.10 * extreme_focus_01)
              : 0;

          const launchSecondBoost =
            managerPivot.launch_ready && !managerPivot.pivot_ready && axis === secondPriorityAxis
              ? 0.02 + 0.04 * n(managerPivot.diversify_pivot_01) * (1 - 0.55 * extreme_focus_01)
              : 0;

          const baseScore = thinRosterNow
            ? clamp(
                0.52 * dSh +
                0.28 * gap +
                0.12 * weak +
                0.05 * isTop +
                0.03 * topPriorityLead01 +
                foundationTopAxisBoost +
                prePivotTopAxisHold +
                launchSecondBoost,
                0, 1
              )
            : clamp(
                0.72 * dSh +
                0.18 * weak +
                0.07 * isTop +
                0.03 * topPriorityLead01 +
                foundationTopAxisBoost +
                prePivotTopAxisHold +
                launchSecondBoost,
                0, 1
              );

          const score = clamp(baseScore * topAxisSoftener * secondAxisBooster * otherAxisBooster, 0, 1);

          return {
            family: 'axis',
            type: 'axis_upgrade',
            axis,
            label:
              axis === 'pow' ? 'Power (POW) Upgrade' :
              axis === 'spe' ? 'Speed (SPE) Upgrade' :
              axis === 'men' ? 'Mental (MEN) Upgrade' :
              'Social (SOC) Upgrade',
            score,
            importance: thinRosterNow
              ? clamp(54 + score * 36, 0, 100)
              : clamp(34 + score * 50, 0, 100)
          };
        })
        .filter((x) => n(axisPriorityAbs[x.axis]) > 0)
        .sort((a, b) => n(b.importance) - n(a.importance));

      axisRows.forEach((x) => needs.push(x));

      const colorRows = ['red', 'green', 'blue', 'yellow']
        .map((c) => {
          const axis = colorToAxis[c];
          const sh = colorShare01(c);
          const scarcity = sh <= 0.15 ? (0.15 - sh) / 0.15 : 0;
          const mildSaturationPenalty = sh >= 0.42 ? (sh - 0.42) / 0.58 : 0;
          const focusBonus =
            c === topPriorityColor ? 0.08 :
            c === secondPriorityColor ? 0.04 : 0;

          const foundationColorBoost =
            !foundation.ready && c === topPriorityColor ? 0.10 * n(foundation.need01) : 0;

          const pivotReduction =
            managerPivot.active && c === topPriorityColor
              ? 0.16 * n(managerPivot.diversify_pivot_01)
              : 0;

          const launchSecondColorBoost =
            managerPivot.launch_ready && !managerPivot.pivot_ready && c === secondPriorityColor
              ? (0.04 + 0.04 * n(managerPivot.diversify_pivot_01)) * (1 - 0.55 * extreme_focus_01)
              : 0;

          const v =
            0.70 * desiredShare(axis) +
            0.18 * scarcity +
            focusBonus +
            foundationColorBoost +
            launchSecondColorBoost -
            0.40 * mildSaturationPenalty -
            pivotReduction;

          return {
            family: 'card',
            type: 'color_economy',
            color: c,
            axis,
            label: 'Klassenfarbe: ' + c + ' (' + String(axis).toUpperCase() + ')',
            importance: clamp(22 + v * 56, 0, 92)
          };
        })
        .sort((a, b) => n(b.importance) - n(a.importance));

      if (colorRows[0] && n(colorRows[0].importance) > 26) needs.push(colorRows[0]);

      if (totalTeams > 1) {
        const disziRows = DISCIPLINES
          .map((d) => {
            const weights = recipes[d.field] || {};
            const fallbackAxis = colorToAxis[d.color] || 'pow';
            const priorityFit = priorityFitFromWeights01(weights, fallbackAxis);

            const estimatedDynamicSum = getEstimatedTeamDisziSum(rosterNow, d.field, weights);
            const leagueSums = getLeagueSumsForField(d.field);
            const gapStats = getLeagueGapStats(leagueSums, estimatedDynamicSum, fallbackAxis);

            const holeSeverity = clamp((gapStats.currentRankEst - 1) / Math.max(1, totalTeams - 1), 0, 1);
            const share = colorShare01(d.color);
            const relevance = primaryColors.includes(d.color) ? 1 : share > 0 ? 0.65 : 0.35;

            const baseHoleScore =
              holeSeverity *
              (0.34 + 0.66 * priorityFit) *
              relevance;

            const lowFitPenalty01 = priorityFit < 0.35 ? 0.50 : priorityFit < 0.50 ? 0.24 : 0;
            const gated = baseHoleScore * (thinRosterNow ? 0.18 + 0.82 * n(varianceCfg?.holeGate01?.sampled || 1) : 1);
            const holeScore = gated * (1 - lowFitPenalty01);

            const topAxisBonusPts =
              fallbackAxis === topPriorityAxis
                ? (
                    8 +
                    priorityFit * 6 +
                    topPriorityLead01 * 5 +
                    (!foundation.ready ? 5 * foundation.need01 : 0) +
                    (foundation.ready && !managerPivot.pivot_ready
                      ? 4 + 4 * (1 - n(foundation.pivotNeed01)) + 4 * focus_rigidity_01 + 7 * extreme_focus_01
                      : 0)
                  )
                : fallbackAxis === secondPriorityAxis
                  ? (
                      4 +
                      priorityFit * 4 +
                      (managerPivot.launch_ready && !managerPivot.pivot_ready
                        ? (2.5 + 3.0 * n(managerPivot.diversify_pivot_01)) * (1 - 0.55 * extreme_focus_01)
                        : 0)
                    )
                  : 0;

            const pivotCrossAxisBonusPts =
              managerPivot.active && fallbackAxis !== topPriorityAxis
                ? 10 * n(managerPivot.diversify_pivot_01)
                : 0;

            const baseImp =
              thinRosterNow
                ? Math.min(46, clamp(24 + holeScore * 54, 0, 96))
                : clamp(26 + holeScore * 54, 0, 96);

            const importance = clamp(
              baseImp +
              gapStats.attackability01 * 34 +
              topAxisBonusPts +
              pivotCrossAxisBonusPts -
              gapStats.hopeless01 * 28,
              0, 100
            );

            return {
              family: 'diszi',
              type: 'discipline_hole',
              diszi: d.field,
              discipline_weights: weights,
              color: d.color,
              axis: fallbackAxis,
              label: 'Loch stopfen: ' + d.label,
              holeSeverity,
              attackability01: Number(n(gapStats.attackability01).toFixed(3)),
              hopeless01: Number(n(gapStats.hopeless01).toFixed(3)),
              importance: Number(n(importance).toFixed(2))
            };
          })
          .filter(Boolean)
          .sort((a, b) => n(b.importance) - n(a.importance));

        disziRows.slice(0, 5).forEach((x) => {
          if (n(x.holeSeverity) >= 0.20 || n(x.attackability01) >= 0.45) needs.push(x);
        });

        const specialistRows = DISCIPLINES
          .map((d) => {
            const weights = recipes[d.field] || {};
            if (!weights || !Object.keys(weights).length) return null;

            const fallbackAxis = colorToAxis[d.color] || 'pow';
            const priorityFit = priorityFitFromWeights01(weights, fallbackAxis);

            const strictScores = rosterNow
              .map((r) => getProxyDisziScore(r, d.field, weights, fallbackAxis))
              .filter((x) => x > 0);

            const rosterAvg = strictScores.length
              ? strictScores.reduce((a, b) => a + b, 0) / strictScores.length
              : 0;

            const rosterTop = strictScores.length ? Math.max(...strictScores) : 0;
            const coverageCount = strictScores.filter((x) => x >= 68).length;
            const realness01 = strictScores.length
              ? clamp(coverageCount / Math.max(1, Math.min(3, strictScores.length)), 0, 1)
              : 0;

            const estimatedDynamicSum = getEstimatedTeamDisziSum(rosterNow, d.field, weights);
            const leagueSums = getLeagueSumsForField(d.field);
            const gapStats = getLeagueGapStats(leagueSums, estimatedDynamicSum, fallbackAxis);

            const rankStrength01 = clamp((totalTeams - gapStats.currentRankEst) / Math.max(1, totalTeams - 1), 0, 1);
            const avgStrength01 = clamp((rosterAvg - 62) / 16, 0, 1);
            const topStrength01 = clamp((rosterTop - 74) / 12, 0, 1);

            const axisFocusBoost =
              fallbackAxis === topPriorityAxis ? 0.10 :
              fallbackAxis === secondPriorityAxis
                ? (0.05 + (managerPivot.launch_ready && !managerPivot.pivot_ready ? 0.02 * (1 - 0.55 * extreme_focus_01) : 0))
                : 0;

            const specialistScore =
              0.28 * priorityFit +
              0.18 * avgStrength01 +
              0.14 * topStrength01 +
              0.14 * rankStrength01 +
              0.16 * realness01 +
              0.10 * gapStats.attackability01 +
              axisFocusBoost;

            const importance = clamp(
              18 + specialistScore * 40 + gapStats.attackability01 * 10 - gapStats.hopeless01 * 8 + (ambition >= 6 ? 4 : 0),
              0, 92
            );

            return {
              family: 'specialist',
              type: 'specialist_push',
              diszi: d.field,
              discipline_weights: weights,
              color: d.color,
              axis: fallbackAxis,
              label: 'Specialist: ' + d.label + ' (Peak)',
              attackability01: gapStats.attackability01,
              realness01,
              importance
            };
          })
          .filter(Boolean)
          .sort((a, b) => n(b.importance) - n(a.importance));

        if (
          specialistRows[0] &&
          n(specialistRows[0].importance) >= 50 &&
          n(specialistRows[0].realness01) >= 0.40 &&
          n(specialistRows[0].attackability01) >= 0.35
        ) {
          needs.push(specialistRows[0]);
        }
      }

      needs.push({
        family: 'breadth',
        type: 'historical_breadth_opportunity',
        label: 'Scouting: Historical Breadth',
        importance: clamp(18 + (ambition <= 6 ? 10 : 4), 0, 70)
      });

      needs.push({
        family: 'peak',
        type: 'historical_peak_opportunity',
        label: 'Scouting: Historical Peak',
        importance: clamp(20 + (ambition >= 6 ? 10 : 4), 0, 72)
      });

      return {
        needs: needs.sort((a, b) => n(b.importance) - n(a.importance)).slice(0, 10),
        managerPivot,
        foundation
      };
    };

    const simRoster = [...roster];
    const picked = new Set();
    const steps = [];
    let remaining_budget = initial_budget;
    const laneSpent = { star: 0, core: 0, depth: 0, reserve: 0, diszi: 0 };

    const getRoleBudgetContext = (stepIdx, role) => {
      const r = lower(role || 'depth');
      const total = n(budgetTracks[r] || 0);
      const spent = n(laneSpent[r] || 0);
      const remaining = Math.max(0, total - spent);

      const remainingCount = Math.max(
        1,
        slotPlan.slice(stepIdx).filter((x) => lower(x) === r).length
      );

      const roleTargetBudget = remaining / remainingCount;
      const futureRoles = slotPlan.slice(stepIdx + 1);
      const futureMinBudget = futureRoles.reduce((acc, rr) => acc + futureRoleFloor(rr), 0);
      const maxSafeByFutureFloors = Math.max(0, remaining_budget - futureMinBudget);

      const win = roleWindows[r] || roleWindows.depth;
      const strictCapByBracket = maxPriceForBracket(win.max);
      const fallbackCapByBracket = maxPriceForBracket(win.fallbackMax);

      const cap = Math.max(
        0,
        Math.min(
          remaining_budget,
          remaining,
          strictCapByBracket,
          maxSafeByFutureFloors > 0 ? maxSafeByFutureFloors : remaining_budget
        )
      );

      const fallbackCap = Math.max(
        0,
        Math.min(
          remaining_budget,
          remaining,
          fallbackCapByBracket,
          maxSafeByFutureFloors > 0 ? maxSafeByFutureFloors : remaining_budget
        )
      );

      return {
        role: r,
        roleBudgetTotal: Number(total.toFixed(2)),
        roleBudgetRemaining: Number(remaining.toFixed(2)),
        roleRemainingCount: remainingCount,
        roleTargetBudget: Number(roleTargetBudget.toFixed(2)),
        futureMinBudget: Number(futureMinBudget.toFixed(2)),
        maxSafeByFutureFloors: Number(maxSafeByFutureFloors.toFixed(2)),
        minBracket: win.min,
        maxBracket: win.max,
        fallbackMinBracket: win.fallbackMin,
        fallbackMaxBracket: win.fallbackMax,
        cap: Number(cap.toFixed(2)),
        fallbackCap: Number(fallbackCap.toFixed(2))
      };
    };

    const buildCorrelatedFocusRelief = (playersNow, cand, focusNeeds, plannedRole) => {
      const qualified = [];

      focusNeeds.forEach((need) => {
        const disziScore = getProxyDisziScore(
          cand,
          need.diszi,
          need.discipline_weights || {},
          need.axis || colorToAxis[need.color || 'red'] || 'pow'
        );

        const rankInfo = getCandidateDisziRankingInfo(cand, need.diszi, need.discipline_weights || {});
        const gainInfo = getMarginalDisziGainInfo(playersNow, cand, need.diszi, need.discipline_weights || {}, 6);

        const threshold =
          need.axis === topPriorityAxis ? 64 :
          need.axis === secondPriorityAxis ? 67 : 70;

        const proxyStrong01 = clamp((disziScore - threshold) / 14, 0, 1);
        const rank01 = getAbsoluteRankBonus01(rankInfo, disziScore, threshold);
        const top3Self01 = rank01 >= 1 ? clamp((disziScore - threshold + 2) / 18, 0.15, 1) : 0;
        const delta01 = clamp(0.65 * gainInfo.gain01 + 0.35 * gainInfo.overCut01, 0, 1);

        const compatibility01 = getDisziCompatibilityFactor({
          candColor: getColor(cand),
          candAxisByClass: getPrimaryAxisByClass(cand),
          needAxis: need.axis || colorToAxis[need.color || 'red'] || 'pow',
          needColor: need.color || axisToColor[need.axis || 'pow'] || '',
          disziScore,
          threshold,
          gainInfo
        });

        const qualifies =
          disziScore >= threshold &&
          compatibility01 >= 0.58 &&
          (proxyStrong01 >= 0.30 || rank01 > 0 || delta01 >= 0.22);

        if (!qualifies) return;

        const axisFactor =
          need.axis === topPriorityAxis ? 1.0 :
          need.axis === secondPriorityAxis ? 0.78 : 0.58;

        const attackabilityFactor = 0.65 + 0.35 * n(need.attackability01 || 0.5);

        const blendedStrength = clamp(
          (0.45 * proxyStrong01 + 0.15 * top3Self01 + 0.40 * delta01) * compatibility01,
          0, 1
        );

        qualified.push({
          label: need.label,
          diszi: need.diszi,
          axis: need.axis,
          score: axisFactor * attackabilityFactor * blendedStrength
        });
      });

      qualified.sort((a, b) => n(b.score) - n(a.score));

      const axisSeen = {};
      let reliefSum = 0;
      const used = [];

      for (const item of qualified) {
        const axisKey = item.axis || 'misc';
        const idx = n(axisSeen[axisKey] || 0);
        const damping = idx === 0 ? 1.0 : idx === 1 ? 0.60 : idx === 2 ? 0.30 : 0.10;

        reliefSum += item.score * damping;
        axisSeen[axisKey] = idx + 1;
        used.push(item.label);
      }

      const relief01 = clamp(reliefSum / 1.8, 0, 1);
      let bonus = (used.length > 0 ? 2 : 0) + 7 * relief01;
      if (lower(plannedRole || '') === 'reserve' && relief01 < 0.45) bonus *= 0.75;

      return {
        focus_specialist_relief_01: Number(relief01.toFixed(3)),
        focus_specialist_relief_bonus: Number(bonus.toFixed(2)),
        focus_specialist_relief_hits: used.length,
        focus_specialist_relief_labels: used
      };
    };

    const getStreakPenalty = (stepsSoFar, candColor, candAxis, relief01, topSupport01, managerPivotActive) => {
      const recent = (stepsSoFar || []).slice(-3).reverse();

      let sameColorStreak = 0;
      for (const st of recent) {
        if (!candColor || lower(st?.color) !== lower(candColor)) break;
        sameColorStreak += 1;
      }

      let sameAxisStreak = 0;
      for (const st of recent) {
        const prevAxis = lower(st?.top_axis_before_pick || '');
        if (!candAxis || prevAxis !== lower(candAxis)) break;
        sameAxisStreak += 1;
      }

      let penalty = 0;
      if (sameColorStreak >= 1) penalty += (candColor === topPriorityColor ? 1.1 : 1.8) * sameColorStreak;
      if (sameAxisStreak >= 1) penalty += (candAxis === topPriorityAxis ? 0.9 : 1.4) * sameAxisStreak;
      if (managerPivotActive && candColor === topPriorityColor) penalty += 1.2 * sameColorStreak;

      penalty *= (1 - 0.70 * relief01);
      penalty *= (1 - 0.35 * topSupport01);

      return {
        sameColorStreak,
        sameAxisStreak,
        streak_penalty: Number(Math.max(0, penalty).toFixed(2))
      };
    };

    const scoreCandidate = (playersNow, cand, needsNow, managerPivotNow, stepIdx, plannedRole, roleCtx) => {
      const validity = getCandidateValidity(cand);
      if (!validity.ok) return { score: -Infinity, invalid_reason: validity.reason, baseScore: -Infinity };

      const foundationState = getFoundationState(playersNow);
      const fill_to_min_mode = playersNow.length < player_min;

      const price = priceOf(cand);
      if (!(price > 0)) return { score: -Infinity, invalid_reason: 'bad_price', baseScore: -Infinity };

      const fit = fitOf(cand);
      if (fit < universal_low_fit_hard) return { score: -Infinity, invalid_reason: 'fit_hard_fail', baseScore: -Infinity };

      const candColor = getColor(cand);
      const candAxisByClass = getPrimaryAxisByClass(cand);
      const playerBracket = getBracket(price);
      const coreScore = coreOf(cand);
      const peakScore = getPeakScore(cand);
      const breadthScore = getBreadthScore(cand);
      const bestDiszi = getBestProxyDisziScore(cand);

      const colorCountsBefore = playersNow.reduce((acc, p) => {
        const c = getColor(p);
        if (c) acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, { red: 0, green: 0, blue: 0, yellow: 0 });

      const currentColorCountBeforePick = n(colorCountsBefore[candColor] || 0);
      const dominantColorEntry = Object.entries(colorCountsBefore).sort((a, b) => n(b[1]) - n(a[1]))[0] || ['red', 0];
      const dominantColorBeforePick = dominantColorEntry[0];
      const dominantColorCountBeforePick = n(dominantColorEntry[1]);

      const strictRoleMatch =
        playerBracket >= n(roleCtx.minBracket) &&
        playerBracket <= n(roleCtx.maxBracket) &&
        price <= n(roleCtx.cap);

      const fallbackRoleMatch =
        playerBracket >= n(roleCtx.fallbackMinBracket) &&
        playerBracket <= n(roleCtx.fallbackMaxBracket) &&
        price <= n(roleCtx.fallbackCap);

      if (!strictRoleMatch && !fallbackRoleMatch) {
        return { score: -Infinity, invalid_reason: 'role_window_fail', baseScore: -Infinity };
      }

      const pass_used = strictRoleMatch ? 'strict' : 'fallback';

      const targetBudget = Math.max(1, n(roleCtx.roleTargetBudget || 0));
      const budgetFitScore = clamp(
        1 - Math.abs(price - targetBudget) / Math.max(10, targetBudget),
        -1, 1
      ) * 10;

      let fitScore = 0;
      if (fitHard > 0 && fit < fitHard) {
        fitScore -= 18 + (fitHard - fit) * 1.6;
      } else if (fitMinSoft > 0 && fit < fitMinSoft) {
        fitScore -= 6 + (fitMinSoft - fit) * 0.8;
      } else {
        fitScore += fit * 0.18;
      }
      if (fit >= 25) fitScore += fit25Bonus;

      const matchedNeedLabels = [];
      const matchedNeedMeta = [];
      let needScore = 0;
      let cross_color_focus_specialist_bonus = 0;
      const needClusterSeen = {};

      const focusDisziNeeds = needsNow
        .filter((x) => (x.family === 'diszi' || x.family === 'specialist') && (x.axis === topPriorityAxis || x.axis === secondPriorityAxis))
        .slice(0, 5);

      needsNow.slice(0, 6).forEach((need, idx) => {
        const weight =
          idx === 0 ? 1.00 :
          idx === 1 ? 0.72 :
          idx === 2 ? 0.50 :
          idx === 3 ? 0.34 :
          idx === 4 ? 0.22 : 0.14;

        if (need.family === 'axis') {
          const axVal = axisValue(cand, need.axis);
          const axisMatchBonus = candAxisByClass === need.axis ? 5.2 * weight : 0;
          const topAxisExtra =
            need.axis === topPriorityAxis
              ? axVal * 0.05 * weight + 3.2 * topPriorityLead01 * weight
              : 0;
          const secondAxisExtra =
            need.axis === secondPriorityAxis
              ? (
                  axVal * 0.03 * weight +
                  (managerPivotNow.launch_ready && !managerPivotNow.pivot_ready ? 1.0 * weight * (1 - 0.55 * extreme_focus_01) : 0) +
                  (managerPivotNow.active ? 2.5 * weight : 0)
                )
              : 0;

          needScore += axVal * 0.23 * weight + axisMatchBonus + topAxisExtra + secondAxisExtra;

          const threshold =
            need.axis === topPriorityAxis ? 48 :
            need.axis === secondPriorityAxis ? 54 : 58;

          if (axVal >= threshold) {
            matchedNeedLabels.push(need.label);
            matchedNeedMeta.push({ family: 'axis', axis: need.axis });
          }
        }

        else if (need.family === 'card') {
          const colorMatch = candColor === need.color ? 1 : 0;
          needScore += colorMatch * (13.5 * weight);
          needScore += axisValue(cand, need.axis) * 0.06 * weight;

          if (colorMatch) {
            matchedNeedLabels.push(need.label);
            matchedNeedMeta.push({ family: 'card', axis: need.axis });
          }
        }

        else if (need.family === 'diszi' || need.family === 'specialist') {
          const disziScore = getProxyDisziScore(
            cand,
            need.diszi,
            need.discipline_weights || {},
            need.axis || colorToAxis[need.color || 'red'] || 'pow'
          );

          const gainInfo = getMarginalDisziGainInfo(playersNow, cand, need.diszi, need.discipline_weights || {}, 6);
          const rankInfo = getCandidateDisziRankingInfo(cand, need.diszi, need.discipline_weights || {});

          const threshold =
            need.axis === topPriorityAxis ? (need.family === 'specialist' ? 64 : 60) :
            need.axis === secondPriorityAxis ? (need.family === 'specialist' ? 67 : 63) :
            (need.family === 'specialist' ? 70 : 66);

          const proxyStrong01 = clamp((disziScore - threshold) / (need.family === 'specialist' ? 16 : 18), 0, 1);
          const delta01 = clamp(0.55 * gainInfo.gain01 + 0.45 * gainInfo.overCut01, 0, 1);
          const rank01 = getAbsoluteRankBonus01(rankInfo, disziScore, threshold);

          const compatibility01 = getDisziCompatibilityFactor({
            candColor,
            candAxisByClass,
            needAxis: need.axis || colorToAxis[need.color || 'red'] || 'pow',
            needColor: need.color || axisToColor[need.axis || 'pow'] || '',
            disziScore,
            threshold,
            gainInfo
          });

          const proxyWeight =
            need.family === 'specialist'
              ? (gainInfo.earlyFillMode ? 0.55 : 0.45)
              : (gainInfo.earlyFillMode ? 0.65 : 0.50);

          const deltaWeight =
            need.family === 'specialist'
              ? (gainInfo.earlyFillMode ? 0.25 : 0.35)
              : (gainInfo.earlyFillMode ? 0.20 : 0.35);

          const rankWeight = need.family === 'specialist' ? 0.20 : 0.15;

          const rawCandidateNeedFit01 = clamp(
            proxyWeight * proxyStrong01 +
            deltaWeight * delta01 +
            rankWeight * rank01,
            0, 1
          );

          const candidateNeedFit01 = clamp(rawCandidateNeedFit01 * compatibility01, 0, 1);

          const teamPressure01 = clamp(n(need.importance) / 100, 0, 1);
          const attack01 = clamp(n(need.attackability01 || 0.5), 0, 1);

          const needPts =
            candidateNeedFit01 *
            (
              need.family === 'specialist'
                ? (12 + 8 * attack01 + peakScore * 0.04 + disziScore * 0.05)
                : (10 + 10 * teamPressure01 + 8 * attack01 + disziScore * 0.04)
            );

          const focusAxisMult =
            need.axis === topPriorityAxis ? 1.10 :
            need.axis === secondPriorityAxis
              ? (
                  1.04 +
                  (managerPivotNow.launch_ready && !managerPivotNow.pivot_ready ? 0.04 * (1 - 0.55 * extreme_focus_01) : 0) +
                  (managerPivotNow.active ? 0.10 : 0)
                )
              : 1.0;

          const clusterKey = getNeedClusterKey(need);
          const clusterMult = getNeedClusterMultiplier(clusterKey, needClusterSeen[clusterKey] || 0);

          needScore += needPts * weight * focusAxisMult * clusterMult;

          if (candidateNeedFit01 >= 0.24 || compatibility01 >= 0.70) {
            needClusterSeen[clusterKey] = n(needClusterSeen[clusterKey] || 0) + 1;
          }

          const uniqueSpecialistCase =
            bestDiszi.field === need.diszi &&
            (rank01 > 0 || disziScore >= threshold + 4 || candidateNeedFit01 >= (need.family === 'specialist' ? 0.52 : 0.48));

          if (
            foundationState.ready &&
            (managerPivotNow.launch_ready || managerPivotNow.active) &&
            need.axis === topPriorityAxis &&
            candColor &&
            candColor !== topPriorityColor &&
            compatibility01 >= (need.family === 'specialist' ? 0.64 : 0.60) &&
            candidateNeedFit01 >= (need.family === 'specialist' ? 0.42 : 0.38) &&
            uniqueSpecialistCase &&
            (candAxisByClass === secondPriorityAxis || disziScore >= threshold + 5)
          ) {
            const uniqueDiszi01 = bestDiszi.field === need.diszi ? 1 : (need.family === 'specialist' ? 0.55 : 0.45);
            cross_color_focus_specialist_bonus +=
              (
                need.family === 'specialist'
                  ? (1.5 + 2.4 * uniqueDiszi01 + 1.6 * candidateNeedFit01)
                  : (1.2 + 1.8 * uniqueDiszi01 + 1.4 * candidateNeedFit01)
              ) * weight;
          }

          if (
            candidateNeedFit01 >= (need.family === 'specialist' ? 0.40 : 0.33) &&
            (compatibility01 >= 0.62 || proxyStrong01 >= 0.42 || rank01 > 0)
          ) {
            matchedNeedLabels.push(need.label);
            matchedNeedMeta.push({ family: need.family, axis: need.axis || 'misc' });
          }
        }

        else if (need.family === 'peak') {
          needScore += peakScore * 0.10 * weight;
          if (peakScore >= 42) {
            matchedNeedLabels.push(need.label);
            matchedNeedMeta.push({ family: 'peak', axis: 'misc' });
          }
        }

        else if (need.family === 'breadth') {
          needScore += breadthScore * 0.08 * weight;
          if (breadthScore >= 42) {
            matchedNeedLabels.push(need.label);
            matchedNeedMeta.push({ family: 'breadth', axis: 'misc' });
          }
        }
      });

      let effectiveMatchedNeedScore = 0;
      const correlatedByAxis = {};

      matchedNeedMeta.forEach((m) => {
        if (m.family === 'diszi' || m.family === 'specialist') {
          const ax = m.axis || 'misc';
          correlatedByAxis[ax] = (correlatedByAxis[ax] || 0) + 1;
        } else {
          effectiveMatchedNeedScore += 1;
        }
      });

      Object.values(correlatedByAxis).forEach((cntRaw) => {
        const cnt = n(cntRaw);
        const damped =
          (cnt >= 1 ? 1.00 : 0) +
          (cnt >= 2 ? 0.55 : 0) +
          (cnt >= 3 ? 0.25 : 0) +
          (cnt >= 4 ? 0.10 : 0);
        effectiveMatchedNeedScore += damped;
      });

      const reliefPack = buildCorrelatedFocusRelief(playersNow, cand, focusDisziNeeds, plannedRole);

      const multi_need_bonus =
        effectiveMatchedNeedScore >= 3.4 ? 18 :
        effectiveMatchedNeedScore >= 2.2 ? 8 :
        effectiveMatchedNeedScore >= 1.4 ? 3 :
        effectiveMatchedNeedScore >= 0.7 ? 1 : 0;

      const role = lower(plannedRole || 'depth');
      let roleScore = 0;
      if (role === 'star') {
        roleScore += peakScore * 0.18 + coreScore * 0.09;
        roleScore += playerBracket >= 7 ? 8 : -8;
      } else if (role === 'core') {
        roleScore += coreScore * 0.14 + peakScore * 0.07;
        roleScore += playerBracket >= 4 ? 4.5 : -4;
      } else if (role === 'depth') {
        roleScore += coreScore * 0.08 + breadthScore * 0.03;
      } else if (role === 'reserve') {
        roleScore += breadthScore * 0.08 + peakScore * 0.02;
      } else if (role === 'diszi') {
        roleScore += bestDiszi.score * 0.18 + peakScore * 0.04;
      }

      const star_upside_bonus =
        (role === 'core' || role === 'star') &&
        playerBracket >= 7 &&
        (effectiveMatchedNeedScore >= 2.2 || reliefPack.focus_specialist_relief_01 >= 0.45)
          ? 7 + peakScore * 0.06 + coreScore * 0.03
          : 0;

      let secondary_coverage_bonus = 0;
      if (candAxisByClass === secondPriorityAxis) secondary_coverage_bonus += 4;
      if (candColor === secondPriorityColor) secondary_coverage_bonus += 4;

      const secondAxisDisziHits = focusDisziNeeds
        .filter((x) => x.axis === secondPriorityAxis)
        .map((x) =>
          getProxyDisziScore(
            cand,
            x.diszi,
            x.discipline_weights || {},
            x.axis || colorToAxis[x.color || 'red'] || 'pow'
          )
        )
        .filter((x) => x >= 64).length;

      secondary_coverage_bonus += Math.min(2, secondAxisDisziHits) * 4;

      const topAxisSupportFromAxis = clamp(axisValue(cand, topPriorityAxis) / 100, 0, 1);
      const topAxisSupportFromColor = candColor === topPriorityColor ? 0.72 : 0;
      const topAxisFocusHoleSupport = focusDisziNeeds
        .filter((x) => x.axis === topPriorityAxis)
        .map((x) =>
          clamp(
            getProxyDisziScore(
              cand,
              x.diszi,
              x.discipline_weights || {},
              x.axis || colorToAxis[x.color || 'red'] || 'pow'
            ) / 100,
            0, 1
          )
        )
        .sort((a, b) => b - a)[0] || 0;

      const top_axis_support_01 = Math.max(
        topAxisSupportFromAxis,
        topAxisSupportFromColor,
        topAxisFocusHoleSupport
      );

      const top_axis_closure_bonus = top_axis_support_01 * (managerPivotNow.active ? 2.8 : 4.6);

      let foundation_focus_bonus = 0;
      let foundation_diversion_penalty = 0;

      const isTopFoundationCandidate =
        candColor === topPriorityColor &&
        (candAxisByClass === topPriorityAxis || axisValue(cand, topPriorityAxis) >= foundationState.strongAxisFloor);

      if (!foundationState.ready) {
        if (isTopFoundationCandidate) {
          foundation_focus_bonus +=
            6.5 * foundationState.need01 +
            2.0 * clamp((axisValue(cand, topPriorityAxis) - foundationState.strongAxisFloor) / 10, 0, 1);
        } else {
          const lacksSpecialistEscape =
            cross_color_focus_specialist_bonus < 2.5 &&
            reliefPack.focus_specialist_relief_01 < 0.26 &&
            secondary_coverage_bonus < 8;

          if (candColor !== topPriorityColor && lacksSpecialistEscape) {
            foundation_diversion_penalty +=
              (candColor === secondPriorityColor ? 5.5 : 7.0) *
              (0.75 + 0.50 * foundationState.need01 + 0.35 * focus_rigidity_01);

            const weakEarlyOffcolor =
              effectiveMatchedNeedScore < 2.2 &&
              reliefPack.focus_specialist_relief_01 < 0.30 &&
              cross_color_focus_specialist_bonus < 3.0 &&
              n(bestDiszi.score) < 62;

            if (weakEarlyOffcolor) {
              foundation_diversion_penalty +=
                (candColor === secondPriorityColor ? 4.5 : 6.0) *
                (1 + 0.45 * foundationState.need01 + 0.30 * focus_rigidity_01);
            }
          }
        }
      }

      let identity_gate_penalty = 0;
      if (topPriorityLead01 >= 0.35) {
        const weakOffFocus =
          candAxisByClass &&
          candAxisByClass !== topPriorityAxis &&
          candAxisByClass !== secondPriorityAxis &&
          axisValue(cand, candAxisByClass) < 48;

        if (weakOffFocus) identity_gate_penalty += 5;
      }
      identity_gate_penalty *= (1 - 0.55 * reliefPack.focus_specialist_relief_01);

      let role_budget_penalty = 0;
      if (price > n(roleCtx.roleTargetBudget) * 1.18 && role !== 'core' && role !== 'star') {
        const over = (price - n(roleCtx.roleTargetBudget) * 1.18) / Math.max(1, n(roleCtx.roleTargetBudget));
        role_budget_penalty += clamp(over, 0, 1) * 7;
      }
      role_budget_penalty *= (1 - 0.45 * reliefPack.focus_specialist_relief_01);

      let reserve_specialist_stretch_penalty = 0;
      if (role === 'reserve') {
        const expensiveReserve = price > Math.max(18, n(roleCtx.roleTargetBudget) * 1.10);
        const veryExpensiveReserve = price > Math.max(23, n(roleCtx.roleTargetBudget) * 1.30);
        const weakRelief = reliefPack.focus_specialist_relief_01 < 0.40;
        const weakNeedHit = effectiveMatchedNeedScore < 1.4;

        if (expensiveReserve) {
          reserve_specialist_stretch_penalty += 2;
          if (playerBracket >= 4) reserve_specialist_stretch_penalty += 1.5;
          if (fit < 18) reserve_specialist_stretch_penalty += 1.5;
          if (weakRelief) reserve_specialist_stretch_penalty += 2.5;
          if (weakNeedHit) reserve_specialist_stretch_penalty += 2;
          if (veryExpensiveReserve) reserve_specialist_stretch_penalty += 4;
        }

        if (candColor === topPriorityColor && currentColorCountBeforePick >= 4 && price > 20 && weakRelief) {
          reserve_specialist_stretch_penalty += 2.5;
        }
      }
      reserve_specialist_stretch_penalty *= (1 - 0.35 * reliefPack.focus_specialist_relief_01);

      const softCap = getTopColorSoftCap(topPriorityLead01, candColor);
      let color_saturation_penalty = 0;
      if (currentColorCountBeforePick >= softCap) {
        const extra = currentColorCountBeforePick - softCap + 1;
        const base =
          extra === 1 ? 1.4 :
          extra === 2 ? 3.0 :
          extra === 3 ? 5.2 :
          extra === 4 ? 8.0 :
          10.0 + (extra - 4) * 2.25;

        const balancedTeamMultiplier =
          candColor === topPriorityColor && topPriorityLead01 < 0.55 ? 1.18 : 1.0;

        color_saturation_penalty = base * balancedTeamMultiplier;
      }

      const cheap_reserve_card_exception =
        role === 'reserve' &&
        currentColorCountBeforePick >= 5 &&
        candColor === topPriorityColor &&
        price <= 18;

      if (cheap_reserve_card_exception) color_saturation_penalty *= 0.60;
      if (fill_to_min_mode && candColor === topPriorityColor) color_saturation_penalty *= 0.75;
      if (reliefPack.focus_specialist_relief_01 > 0) color_saturation_penalty *= (1 - 0.65 * reliefPack.focus_specialist_relief_01);

      let redundancy_penalty = 0;
      const redundantTopColor =
        candColor === dominantColorBeforePick &&
        currentColorCountBeforePick >= 6 &&
        effectiveMatchedNeedScore <= 1.2 &&
        reliefPack.focus_specialist_relief_01 < 0.25;

      if (redundantTopColor) redundancy_penalty += 4 + (currentColorCountBeforePick - 5) * 1.6;
      redundancy_penalty *= (1 - 0.70 * reliefPack.focus_specialist_relief_01);

      let off_focus_color_pressure_penalty = 0;
      if (candColor && candColor !== topPriorityColor && topPriorityLead01 >= 0.30) {
        const weakTopSupport = top_axis_support_01 < 0.60;
        const noMeaningfulRelief = reliefPack.focus_specialist_relief_01 < 0.28;
        const weakNeedHit = effectiveMatchedNeedScore < 1.2;

        if (weakTopSupport && noMeaningfulRelief && weakNeedHit) {
          const base = candColor === secondPriorityColor ? 6.75 : 3.25;
          const countFactor = currentColorCountBeforePick >= 2 ? 1 + 0.30 * (currentColorCountBeforePick - 1) : 1;
          off_focus_color_pressure_penalty =
            base * countFactor * (0.8 + 0.7 * topPriorityLead01);
        }
      }
      if (fill_to_min_mode) off_focus_color_pressure_penalty *= 0.45;
      off_focus_color_pressure_penalty *= (1 - 0.45 * reliefPack.focus_specialist_relief_01);

      let offcolor_overlap_penalty = 0;
      if (foundationState.ready && managerPivotNow.active && candColor && candColor !== topPriorityColor) {
        const overlapish =
          top_axis_support_01 >= 0.58 &&
          cross_color_focus_specialist_bonus < 3.5 &&
          n(bestDiszi.score) < 70 &&
          secondary_coverage_bonus < 8 &&
          reliefPack.focus_specialist_relief_01 < 0.30;

        if (overlapish) {
          offcolor_overlap_penalty =
            (3.5 + 7.0 * clamp((top_axis_support_01 - 0.58) / 0.42, 0, 1)) *
            (candColor === secondPriorityColor ? 0.90 : 1.05);
        }
      }
      if (fill_to_min_mode) offcolor_overlap_penalty *= 0.35;

      const offcolorNeedsRealSpecialist =
        n(cross_color_focus_specialist_bonus) >= 2.5 ||
        n(reliefPack.focus_specialist_relief_01) >= 0.32 ||
        n(secondary_coverage_bonus) >= 8;

      let offcolor_generic_penalty = 0;
      if (foundationState.ready && managerPivotNow.active && candColor && candColor !== topPriorityColor) {
        const weakOffcolorCase =
          effectiveMatchedNeedScore < 1.4 &&
          !offcolorNeedsRealSpecialist &&
          n(bestDiszi.score) < 66;

        if (weakOffcolorCase) {
          offcolor_generic_penalty +=
            (candColor === secondPriorityColor ? 7.5 : 5.5) +
            (fit < 10 ? 7 : fit < 14 ? 3.5 : 0);
        }
      }
      if (fill_to_min_mode) {
        if (effectiveMatchedNeedScore >= 1 || secondary_coverage_bonus >= 8 || n(bestDiszi.score) >= 60) {
          offcolor_generic_penalty *= 0.25;
        } else {
          offcolor_generic_penalty *= 0.55;
        }
      }

      let prepivot_offcolor_penalty = 0;
      if (
        foundationState.ready &&
        !managerPivotNow.pivot_ready &&
        candColor &&
        candColor !== topPriorityColor
      ) {
        const weakLaunchCase =
          effectiveMatchedNeedScore < 1.6 &&
          secondary_coverage_bonus < 8 &&
          cross_color_focus_specialist_bonus < 2.5 &&
          reliefPack.focus_specialist_relief_01 < 0.30 &&
          n(bestDiszi.score) < 64;

        if (weakLaunchCase) {
          const base = candColor === secondPriorityColor ? 4.5 : 5.5;
          const countTax = Math.max(0, currentColorCountBeforePick - 1) * (1 + 0.85 * focus_rigidity_01);
          const strictnessMult = 1 + 1.2 * focus_rigidity_01 + 1.4 * extreme_focus_01;
          const launchSoftener = managerPivotNow.launch_ready ? 0.75 : 1.0;

          prepivot_offcolor_penalty += (base * strictnessMult + countTax) * launchSoftener;

          if (extreme_focus_01 >= 0.65 && candColor === secondPriorityColor) {
            prepivot_offcolor_penalty += 4.5 * launchSoftener;
          }
        }
      }

      let generic_proxy_only_penalty = 0;
      if (effectiveMatchedNeedScore < 0.7 && reliefPack.focus_specialist_relief_01 < 0.18) {
        generic_proxy_only_penalty = role === 'reserve' ? 7 : role === 'depth' ? 5 : 3;
      }

      const streakPack = getStreakPenalty(
        steps,
        candColor,
        candAxisByClass,
        reliefPack.focus_specialist_relief_01,
        top_axis_support_01,
        !!managerPivotNow.active
      );

      const fill_usefulness01 = clamp(
        0.34 * clamp(effectiveMatchedNeedScore / 2.2, 0, 1) +
        0.16 * clamp(bestDiszi.score / 68, 0, 1) +
        0.14 * clamp(coreScore / 48, 0, 1) +
        0.12 * (candAxisByClass === secondPriorityAxis ? 1 : 0) +
        0.08 * (candColor === secondPriorityColor ? 1 : 0) +
        0.08 * clamp(fit / 18, 0, 1) +
        0.08 * clamp(secondary_coverage_bonus / 8, 0, 1),
        0, 1
      );

      const roster_fill_pressure_bonus = fill_to_min_mode
        ? (3 + 10 * fill_usefulness01 + 4 * clamp((player_min - playersNow.length) / Math.max(1, player_min), 0, 1))
        : 0;

      const pivot_launch_bonus =
        fill_to_min_mode &&
        foundationState.ready &&
        managerPivotNow.launch_ready &&
        candColor &&
        candColor !== topPriorityColor &&
        (secondary_coverage_bonus > 0 || effectiveMatchedNeedScore >= 1.4 || cross_color_focus_specialist_bonus >= 2.5)
          ? (
              managerPivotNow.pivot_ready
                ? (4 + 4 * clamp(secondary_coverage_bonus / 8, 0, 1) + 3 * clamp(effectiveMatchedNeedScore / 2.2, 0, 1))
                : (1.5 + 2.5 * clamp(secondary_coverage_bonus / 8, 0, 1) + 1.5 * clamp(effectiveMatchedNeedScore / 2.2, 0, 1)) * (1 - 0.55 * extreme_focus_01)
            )
          : 0;

      const team_color_help_01 = getTeamColorHelp01({
        candColor,
        playersNow,
        needsNow,
        managerPivotNow,
        foundationState
      });

      const utility_signal_01 = clamp(
        0.28 * clamp(effectiveMatchedNeedScore / 2.2, 0, 1) +
        0.18 * clamp(bestDiszi.score / 68, 0, 1) +
        0.15 * clamp(secondary_coverage_bonus / 8, 0, 1) +
        0.14 * clamp(reliefPack.focus_specialist_relief_01 / 0.45, 0, 1) +
        0.10 * clamp(top_axis_support_01 / 0.70, 0, 1) +
        0.08 * clamp(coreScore / 48, 0, 1) +
        0.07 * clamp(team_color_help_01, 0, 1),
        0, 1
      );

      const cheapMeta = getCheapCardRescueMeta({
        price,
        role,
        roleCtx,
        candColor,
        teamColorHelp01: team_color_help_01,
        bestDisziScore: bestDiszi.score,
        fit,
        secondary_coverage_bonus,
        top_axis_support_01,
        managerPivotNow,
        foundationState
      });

      let cheap_card_rescue_bonus = 0;
      let bad_card_color_penalty = 0;

      if (cheapMeta.isCheap && utility_signal_01 < 0.38) {
        if (cheapMeta.rescueOk) {
          cheap_card_rescue_bonus =
            1.8 +
            5.2 * team_color_help_01 +
            (cheapMeta.tier === 'top' ? 0.8 : cheapMeta.tier === 'second' ? 0.5 : 0);
        } else {
          bad_card_color_penalty =
            2.5 +
            8 * clamp(0.72 - team_color_help_01, 0, 1) +
            (candColor !== topPriorityColor ? 1.5 * focus_rigidity_01 + 3 * extreme_focus_01 : 0);
        }
      }

      if (
        cheapMeta.isCheap &&
        utility_signal_01 < 0.25 &&
        n(bestDiszi.score) < 25 &&
        n(secondary_coverage_bonus) < 4 &&
        n(effectiveMatchedNeedScore) < 0.7
      ) {
        bad_card_color_penalty += 4;
      }

      const baseScore =
        needScore +
        fitScore +
        budgetFitScore +
        roleScore +
        foundation_focus_bonus +
        roster_fill_pressure_bonus +
        pivot_launch_bonus +
        cheap_card_rescue_bonus +
        multi_need_bonus +
        reliefPack.focus_specialist_relief_bonus +
        cross_color_focus_specialist_bonus +
        star_upside_bonus +
        secondary_coverage_bonus +
        top_axis_closure_bonus -
        foundation_diversion_penalty -
        bad_card_color_penalty -
        offcolor_generic_penalty -
        prepivot_offcolor_penalty -
        role_budget_penalty -
        reserve_specialist_stretch_penalty -
        identity_gate_penalty -
        color_saturation_penalty -
        redundancy_penalty -
        off_focus_color_pressure_penalty -
        offcolor_overlap_penalty -
        generic_proxy_only_penalty -
        streakPack.streak_penalty;

      return {
        score: baseScore,
        baseScore,
        pass_used,
        fit,
        budgetFitScore,
        roleScore,
        foundation_focus_bonus,
        foundation_diversion_penalty,
        foundation_ready_now: foundationState.ready,
        foundation_need_01_now: Number(n(foundationState.need01).toFixed(3)),
        role_budget_penalty,
        reserve_specialist_stretch_penalty,
        identity_gate_penalty,
        top_axis_closure_bonus,
        top_axis_support_01,
        color_saturation_penalty,
        redundancy_penalty,
        off_focus_color_pressure_penalty,
        offcolor_overlap_penalty,
        offcolor_generic_penalty,
        prepivot_offcolor_penalty,
        generic_proxy_only_penalty,
        cheap_card_rescue_bonus,
        bad_card_color_penalty,
        team_color_help_01: Number(n(team_color_help_01).toFixed(3)),
        utility_signal_01: Number(n(utility_signal_01).toFixed(3)),
        is_cheap_pick: !!cheapMeta.isCheap,
        cheap_pick_threshold: cheapMeta.cheapPickThreshold,
        card_color_rescue_ok: !!cheapMeta.rescueOk,
        card_color_rescue_threshold: cheapMeta.rescueThreshold,
        card_color_help_tier: cheapMeta.tier,
        secondary_coverage_bonus,
        cross_color_focus_specialist_bonus,
        cheap_reserve_card_exception,
        needScore,
        peakScore,
        breadthScore,
        coreScore,
        matchedNeedCount: matchedNeedLabels.length,
        matchedNeedLabels,
        effectiveMatchedNeedScore,
        multi_need_bonus,
        focus_specialist_relief_01: reliefPack.focus_specialist_relief_01,
        focus_specialist_relief_bonus: reliefPack.focus_specialist_relief_bonus,
        focus_specialist_relief_hits: reliefPack.focus_specialist_relief_hits,
        focus_specialist_relief_labels: reliefPack.focus_specialist_relief_labels,
        star_upside_bonus,
        score_jitter: 0,
        playerBracket,
        bestDisziField: bestDiszi.field,
        bestDisziScore: bestDiszi.score,
        candColor,
        currentColorCountBeforePick,
        dominantColorBeforePick,
        dominantColorCountBeforePick,
        sameColorStreak: streakPack.sameColorStreak,
        sameAxisStreak: streakPack.sameAxisStreak,
        streak_penalty: streakPack.streak_penalty,
        fill_to_min_mode,
        roster_fill_pressure_bonus,
        pivot_launch_bonus,
        invalid_reason: 'ok'
      };
    };

    const initialPack = buildDynamicNeeds(simRoster);
    const initialDynamicNeeds = initialPack.needs;

    for (let stepIdx = 0; stepIdx < planned_steps; stepIdx++) {
      if (remaining_budget <= 0.01) break;

      const plannedRole = slotPlan[stepIdx] || 'depth';
      const roleCtx = getRoleBudgetContext(stepIdx, plannedRole);
      const dynamicPack = buildDynamicNeeds(simRoster);
      const needsNow = dynamicPack.needs;
      const managerPivotNow = dynamicPack.managerPivot;

      const topAxisBeforePick =
        needsNow.find((x) => x.family === 'axis')?.axis || topPriorityAxis;

      const scoredCandidates = [];

      for (const cand of candidatePool) {
        const name = lower(playerNameOf(cand));
        if (!name || picked.has(name)) continue;

        const sc = scoreCandidate(simRoster, cand, needsNow, managerPivotNow, stepIdx, plannedRole, roleCtx);
        if (Number.isFinite(n(sc.baseScore)) && n(sc.baseScore) > -Infinity) {
          scoredCandidates.push({ cand, sc });
        }
      }

      if (!scoredCandidates.length) break;

      const bestBase = Math.max(...scoredCandidates.map((x) => n(x.sc.baseScore)));
      const tieMargin = 3.0;

      const resolved = scoredCandidates.map((entry) => {
        const tieEligible = bestBase - n(entry.sc.baseScore) <= tieMargin;
        const tie_jitter = tieEligible
          ? (rand01FromKey([VERSION, team, stepIdx + 1, playerNameOf(entry.cand), plannedRole, 'tie'].join('|')) - 0.5) * (0.55 + team_variation_factor * 1.2)
          : 0;

        return {
          cand: entry.cand,
          sc: {
            ...entry.sc,
            score_jitter: Number(n(tie_jitter).toFixed(3)),
            score: n(entry.sc.baseScore) + tie_jitter
          }
        };
      });

      const strictPool = resolved
        .filter((x) => x.sc.pass_used === 'strict')
        .sort((a, b) => n(b.sc.score) - n(a.sc.score));

      const fallbackPool = resolved
        .filter((x) => x.sc.pass_used === 'fallback')
        .sort((a, b) => n(b.sc.score) - n(a.sc.score));

      let chosen = null;

      if (strictPool.length) {
        const bestStrict = strictPool[0];
        const bestFallback = fallbackPool[0] || null;

        if (!bestFallback || isWeakFallbackCandidate(bestFallback, plannedRole)) {
          chosen = bestStrict;
        } else {
          const fallbackGapReq =
            lower(plannedRole) === 'reserve' ? 10 :
            lower(plannedRole) === 'depth' ? 8 : 5;

          const fallbackHasRealEdge =
            n(bestFallback.sc.score) >= n(bestStrict.sc.score) + fallbackGapReq;

          const fallbackHasSubstance =
            n(bestFallback.sc.focus_specialist_relief_01) >= 0.32 ||
            n(bestFallback.sc.effectiveMatchedNeedScore) >= 2.2 ||
            n(bestFallback.sc.star_upside_bonus) >= 8 ||
            n(bestFallback.sc.cross_color_focus_specialist_bonus) >= 3.5 ||
            n(bestFallback.sc.pivot_launch_bonus) >= 4 ||
            (lower(plannedRole) === 'depth' && n(bestFallback.sc.matchedNeedCount) >= 3);

          chosen = fallbackHasRealEdge && fallbackHasSubstance ? bestFallback : bestStrict;
        }
      } else {
        const bestFallback = fallbackPool[0] || null;
        chosen = isWeakFallbackCandidate(bestFallback, plannedRole) ? null : bestFallback;
      }

      const fillToMinActive = simRoster.length < player_min;
      if (chosenFailsUtilityFloor(chosen, plannedRole, fillToMinActive)) chosen = null;

      const bestCandidate = chosen?.cand || null;
      const bestExplain = chosen?.sc || null;

      const finalValidity = bestCandidate ? getCandidateValidity(bestCandidate) : { ok: false, reason: 'no_candidate' };

      if (
        !bestCandidate ||
        !bestExplain ||
        !Number.isFinite(n(bestExplain.score)) ||
        !finalValidity.ok ||
        !['strict', 'fallback'].includes(s(bestExplain.pass_used)) ||
        !(priceOf(bestCandidate) > 0) ||
        !Number.isFinite(bestExplain.playerBracket) ||
        !Number.isFinite(n(bestExplain.matchedNeedCount)) ||
        fitOf(bestCandidate) < universal_low_fit_hard
      ) {
        break;
      }

      const price = priceOf(bestCandidate);
      if (price > remaining_budget + 0.001) break;

      picked.add(lower(playerNameOf(bestCandidate)));
      remaining_budget = Number((remaining_budget - price).toFixed(2));
      simRoster.push(bestCandidate);

      const roleKey = lower(plannedRole || 'depth');
      laneSpent[roleKey] = Number((n(laneSpent[roleKey]) + price).toFixed(2));

      const postPack = buildDynamicNeeds(simRoster);
      const postNeeds = postPack.needs;
      const topAxisAfterPick =
        postNeeds.find((x) => x.family === 'axis')?.axis || topAxisBeforePick;

      steps.push({
        step: stepIdx + 1,
        slot_role_planned: plannedRole,
        pass_used: bestExplain.pass_used,
        picked_player: playerNameOf(bestCandidate),
        klasse: s(bestCandidate?.klasse || ''),
        color: bestExplain.candColor || '',
        price: Number(price.toFixed(2)),
        fit: Number(n(bestExplain.fit).toFixed(2)),
        score: Number(n(bestExplain.score).toFixed(2)),
        top_axis_before_pick: topAxisBeforePick,
        top_axis_after_pick: topAxisAfterPick,
        top_needs_before_pick: needsNow.slice(0, 6).map((x) => ({
          family: x.family,
          label: x.label,
          importance: Number(n(x.importance).toFixed(2))
        })),
        matched_need_count: bestExplain.matchedNeedCount,
        matched_need_labels: bestExplain.matchedNeedLabels,
        effective_matched_need_score: Number(n(bestExplain.effectiveMatchedNeedScore).toFixed(2)),
        multi_need_bonus: Number(n(bestExplain.multi_need_bonus).toFixed(2)),
        focus_specialist_relief_01: Number(n(bestExplain.focus_specialist_relief_01).toFixed(3)),
        focus_specialist_relief_bonus: Number(n(bestExplain.focus_specialist_relief_bonus).toFixed(2)),
        focus_specialist_relief_hits: bestExplain.focus_specialist_relief_hits,
        focus_specialist_relief_labels: bestExplain.focus_specialist_relief_labels,
        star_upside_bonus: Number(n(bestExplain.star_upside_bonus).toFixed(2)),
        best_diszi_field: bestExplain.bestDisziField || '',
        best_diszi_score: Number(n(bestExplain.bestDisziScore).toFixed(2)),
        peak_score: Number(n(bestExplain.peakScore).toFixed(2)),
        breadth_score: Number(n(bestExplain.breadthScore).toFixed(2)),
        core_score: Number(n(bestExplain.coreScore).toFixed(2)),
        budget_fit_score: Number(n(bestExplain.budgetFitScore).toFixed(2)),
        role_score: Number(n(bestExplain.roleScore).toFixed(2)),
        foundation_focus_bonus: Number(n(bestExplain.foundation_focus_bonus).toFixed(2)),
        foundation_diversion_penalty: Number(n(bestExplain.foundation_diversion_penalty).toFixed(2)),
        foundation_ready_now: !!bestExplain.foundation_ready_now,
        foundation_need_01_now: Number(n(bestExplain.foundation_need_01_now).toFixed(3)),
        role_budget_penalty: Number(n(bestExplain.role_budget_penalty).toFixed(2)),
        reserve_specialist_stretch_penalty: Number(n(bestExplain.reserve_specialist_stretch_penalty).toFixed(2)),
        identity_gate_penalty: Number(n(bestExplain.identity_gate_penalty).toFixed(2)),
        top_axis_closure_bonus: Number(n(bestExplain.top_axis_closure_bonus).toFixed(2)),
        top_axis_support_01: Number(n(bestExplain.top_axis_support_01).toFixed(3)),
        color_saturation_penalty: Number(n(bestExplain.color_saturation_penalty).toFixed(2)),
        redundancy_penalty: Number(n(bestExplain.redundancy_penalty).toFixed(2)),
        off_focus_color_pressure_penalty: Number(n(bestExplain.off_focus_color_pressure_penalty).toFixed(2)),
        offcolor_overlap_penalty: Number(n(bestExplain.offcolor_overlap_penalty).toFixed(2)),
        offcolor_generic_penalty: Number(n(bestExplain.offcolor_generic_penalty).toFixed(2)),
        prepivot_offcolor_penalty: Number(n(bestExplain.prepivot_offcolor_penalty).toFixed(2)),
        generic_proxy_only_penalty: Number(n(bestExplain.generic_proxy_only_penalty).toFixed(2)),
        cheap_card_rescue_bonus: Number(n(bestExplain.cheap_card_rescue_bonus).toFixed(2)),
        bad_card_color_penalty: Number(n(bestExplain.bad_card_color_penalty).toFixed(2)),
        team_color_help_01: Number(n(bestExplain.team_color_help_01).toFixed(3)),
        utility_signal_01: Number(n(bestExplain.utility_signal_01).toFixed(3)),
        is_cheap_pick: !!bestExplain.is_cheap_pick,
        cheap_pick_threshold: Number(n(bestExplain.cheap_pick_threshold).toFixed(2)),
        card_color_rescue_ok: !!bestExplain.card_color_rescue_ok,
        card_color_rescue_threshold: Number(n(bestExplain.card_color_rescue_threshold).toFixed(3)),
        card_color_help_tier: s(bestExplain.card_color_help_tier),
        streak_penalty: Number(n(bestExplain.streak_penalty).toFixed(2)),
        same_color_streak: bestExplain.sameColorStreak,
        same_axis_streak: bestExplain.sameAxisStreak,
        secondary_coverage_bonus: Number(n(bestExplain.secondary_coverage_bonus).toFixed(2)),
        cross_color_focus_specialist_bonus: Number(n(bestExplain.cross_color_focus_specialist_bonus).toFixed(2)),
        fill_to_min_mode: !!bestExplain.fill_to_min_mode,
        roster_fill_pressure_bonus: Number(n(bestExplain.roster_fill_pressure_bonus).toFixed(2)),
        pivot_launch_bonus: Number(n(bestExplain.pivot_launch_bonus).toFixed(2)),
        cheap_reserve_card_exception: !!bestExplain.cheap_reserve_card_exception,
        current_color_count_before_pick: bestExplain.currentColorCountBeforePick,
        dominant_color_before_pick: bestExplain.dominantColorBeforePick,
        dominant_color_count_before_pick: bestExplain.dominantColorCountBeforePick,
        need_score: Number(n(bestExplain.needScore).toFixed(2)),
        score_jitter: Number(n(bestExplain.score_jitter).toFixed(3)),
        player_bracket: bestExplain.playerBracket,
        role: roleCtx.role,
        roleBudgetTotal: roleCtx.roleBudgetTotal,
        roleBudgetRemaining: roleCtx.roleBudgetRemaining,
        roleRemainingCount: roleCtx.roleRemainingCount,
        roleTargetBudget: roleCtx.roleTargetBudget,
        futureMinBudget: roleCtx.futureMinBudget,
        maxSafeByFutureFloors: roleCtx.maxSafeByFutureFloors,
        minBracket: roleCtx.minBracket,
        maxBracket: roleCtx.maxBracket,
        fallbackMinBracket: roleCtx.fallbackMinBracket,
        fallbackMaxBracket: roleCtx.fallbackMaxBracket,
        cap: roleCtx.cap,
        fallbackCap: roleCtx.fallbackCap,
        manager_pivot_active_before_pick: !!managerPivotNow.active,
        manager_pivot_launch_before_pick: !!managerPivotNow.launch_ready,
        manager_pivot_ready_before_pick: !!managerPivotNow.pivot_ready,
        primary_comfort_01_before_pick: Number(n(managerPivotNow.primary_comfort_01).toFixed(3)),
        diversify_pivot_01_before_pick: Number(n(managerPivotNow.diversify_pivot_01).toFixed(3)),
        budget_after: Number(Math.max(0, remaining_budget).toFixed(2))
      });
    }

    const finalPack = buildDynamicNeeds(simRoster);
    const finalDynamicNeeds = finalPack.needs;
    const finalManagerPivot = finalPack.managerPivot;

    return {
      version: VERSION,
      ok: true,
      team,
      reason: 'page_scoped_full_sequential_preview_with_candidate_gate',
      planned_steps,
      simulated_steps: steps.length,
      initial_budget: Number(initial_budget.toFixed(2)),
      remaining_budget: Number(Math.max(0, remaining_budget).toFixed(2)),
      candidate_pool_count: candidatePool.length,
      roster_count: rosterCount,
      player_min,
      target_roster_size: targetRosterSize,
      preview_fill_target,
      upstream_planned_steps,
      top_axis: topPriorityAxis,
      second_axis: secondPriorityAxis,
      top_priority_color: topPriorityColor,
      second_priority_color: secondPriorityColor,
      third_axis: thirdPriorityAxis,
      third_priority_color: thirdPriorityColor,
      pow: axisPriorityAbs.pow,
      spe: axisPriorityAbs.spe,
      men: axisPriorityAbs.men,
      soc: axisPriorityAbs.soc,
      top_priority_lead_01: Number(topPriorityLead01.toFixed(3)),
      focus_rigidity_01: Number(focus_rigidity_01.toFixed(3)),
      extreme_focus_01: Number(extreme_focus_01.toFixed(3)),
      team_variation_factor,
      variation_applied: true,
      budget_source:
        n(budgetLogic?.allowed_budget_for_search) > 0
          ? 'transfermarktSalaryBudgetLogic'
          : n(plan?.allowed_budget_for_search) > 0
            ? 'aiTeamPlan'
            : 'cash_fallback',
      needs_source:
        snapshotNeeds.length || queryNeeds.length
          ? 'dynamic_rebuild_uses_page_context'
          : 'dynamic_only',
      initial_dynamic_needs: initialDynamicNeeds.slice(0, 6).map((x) => ({
        family: x.family,
        type: x.type,
        axis: x.axis || '',
        color: x.color || '',
        diszi: x.diszi || '',
        label: x.label,
        importance: Number(n(x.importance).toFixed(2))
      })),
      final_dynamic_needs: finalDynamicNeeds.slice(0, 6).map((x) => ({
        family: x.family,
        type: x.type,
        axis: x.axis || '',
        color: x.color || '',
        diszi: x.diszi || '',
        label: x.label,
        importance: Number(n(x.importance).toFixed(2))
      })),
      slot_plan_source,
      slot_plan_raw: slotPlanRaw.slice(0, planned_steps),
      slot_plan_used: slotPlan.slice(0, planned_steps),
      role_windows: roleWindows,
      budget_tracks_source,
      budget_tracks: {
        star: Number(n(budgetTracks.star).toFixed(2)),
        core: Number(n(budgetTracks.core).toFixed(2)),
        depth: Number(n(budgetTracks.depth).toFixed(2)),
        reserve: Number(n(budgetTracks.reserve).toFixed(2)),
        diszi: Number(n(budgetTracks.diszi).toFixed(2))
      },
      manager_pivot: finalManagerPivot,
      steps,
      debug: {
        matched_team_row:
          s(
            tr?.team || tr?.team_name || tr?.teamCode || tr?.team_code || tr?.name || ''
          ),
        harmony,
        ambition,
        finances,
        fit_min_soft: Number(n(fitMinSoft).toFixed(2)),
        fit_min_hard: fitHard,
        universal_low_fit_hard,
        fit25_bonus: fit25Bonus,
        snapshot_needs_count: snapshotNeeds.length,
        query_needs_count: queryNeeds.length,
        rankings_found: !!rankingsRow,
        strict_team_match,
        strict_roster_match,
        strict_rankings_match,
        auto_step_planner_active,
        upstream_slot_plan_too_short: upstreamSlotPlanTooShort,
        slot_plan_was_sanitized:
          JSON.stringify(slotPlanRaw.slice(0, planned_steps)) !== JSON.stringify(slotPlan.slice(0, planned_steps))
      }
    };
  } catch (err) {
    return {
      version: 'aiSequentialNeedsPreview.v19_11_preview_autosteps_slotplan_rebuild',
      ok: false,
      reason: 'runtime_error',
      error: String(err?.message || err),
      stack: String(err?.stack || '')
    };
  }
})();
