// term: AI2_RunNeeds
// id: ai2AutoBuyButton
// type: widget
// subtype: ButtonWidget2
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Documentation:
//   Canonical AI2 market candidate pool (Transfermarkt)
//   - Joins cleanedOlympiadeData (market rows) with Attribute table.
//   - Computes:
//     - team_fit / fit using the same matrix logic as UI
//     - pow / spe / men / soc for PickScoreEngine
//     - diszi_attr_scores[field] using disciplineRecipesGlobal
//
// Output shape is what AI2_07_PickScoreEngine expects:
//   name / player_name
//   klasse
//   price / marktwert / mw
//   salary / gehalt
//   team_fit / fit
//   pow / spe / men / soc
//   diszi_attr_scores

const toRows = (data) => {
  if (Array.isArray(data)) return data;
  if (typeof formatDataAsArray === 'function') {
    try {
      return formatDataAsArray(data) || [];
    } catch (e) {
      return [];
    }
  }
  if (data && typeof data === 'object') return Object.values(data);
  return [];
};

const marketRows = Array.isArray(cleanedOlympiadeData.value)
  ? cleanedOlympiadeData.value
  : [];

const attrs = toRows(getPlayerAttributesForAI.data).filter(Boolean);

const recipes =
  disciplineRecipesGlobal.value && typeof disciplineRecipesGlobal.value === 'object'
    ? disciplineRecipesGlobal.value
    : {};

const team = String(filterTeam.value || '').trim();

const rassen = toRows(getTeamRassenMatrix.data).filter(Boolean);
const subclasses = toRows(getTeamSubclassesMatrix.data).filter(Boolean);
const traits = toRows(getTeamTraitsMatrix.data).filter(Boolean);
const alignment = toRows(getTeamAlignmentMatrix.data).filter(Boolean);

const teamRassen = rassen.find((r) => String(r.team || '').trim() === team) || null;
const teamSubclass = subclasses.find((r) => String(r.team || '').trim() === team) || null;
const teamTraits = traits.find((r) => String(r.team || '').trim() === team) || null;
const teamAlignment = alignment.find((r) => String(r.team || '').trim() === team) || null;

const n = (v, fb = 0) => {
  if (v === null || v === undefined || v === '') return Number(fb) || 0;

  const raw = String(v).trim();

  // Handles decimal comma like "20,45".
  const normalized = raw.replace(',', '.');

  const x = Number(normalized);
  return Number.isFinite(x) ? x : Number(fb) || 0;
};

const s = (v) => String(v ?? '').trim();
const lower = (v) => s(v).toLowerCase();

const normalize = (str) => {
  if (!str) return '';
  const strValue = String(str);
  const spacesFixed = strValue.replace(/[\s-]/g, '_');
  const withUnderscores = spacesFixed.replace(/([A-Z])/g, '_$1').toLowerCase();
  return withUnderscores.replace(/^_/, '').replace(/__+/g, '_');
};

const normalizeDisziKey = (str) => {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/__+/g, '_');
};

const firstValue = (obj, keys, fb = null) => {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj?.[key] !== null && String(obj[key]).trim() !== '') {
      return obj[key];
    }
  }
  return fb;
};

// Attribute lookup by player name
const attrsByName = new Map();

for (const a of attrs) {
  const key = lower(a?.name || a?.player_name || a?.Name);
  if (key) attrsByName.set(key, a);
}

const computeTeamFit = (row) => {
  if (!team) return null;

  let fit_rasse_raw = 0;
  let fit_subclasses_raw = 0;
  let fit_traits_raw = 0;
  let fit_alignment_raw = 0;

  if (teamRassen && row?.rasse) {
    const key = normalize(row.rasse);
    fit_rasse_raw += n(teamRassen?.[key]);
  }

  if (teamSubclass) {
    [row?.subclass_1, row?.subclass_2, row?.subclass_3].forEach((sub) => {
      if (!sub || sub === '-') return;
      const key = normalize(sub);
      fit_subclasses_raw += n(teamSubclass?.[key]);
    });
  }

  if (teamTraits) {
    [
      row?.trait_pos_1,
      row?.trait_pos_2,
      row?.trait_pos_3,
      row?.trait_neg_1,
      row?.trait_neg_2,
      row?.trait_neg_3
    ].forEach((t) => {
      if (!t || t === '-') return;
      const key = normalize(t);
      fit_traits_raw += n(teamTraits?.[key]);
    });
  }

  if (teamAlignment && row?.alignment) {
    const key = normalize(row.alignment);
    fit_alignment_raw += n(teamAlignment?.[key]);
  }

  // weights: race*3 + alignment*2 + subclasses*1 + traits*0.8
  return fit_rasse_raw * 3 + fit_alignment_raw * 2 + fit_subclasses_raw * 1 + fit_traits_raw * 0.8;
};

const computeMainAxes = (attrRow) => {
  const source = attrRow || {};

  const power = n(firstValue(source, ['power', 'Power', 'POWER']));
  const health = n(firstValue(source, ['health', 'Health', 'HEALTH']));
  const stamina = n(firstValue(source, ['stamina', 'Stamina', 'STAMINA']));
  const determination = n(firstValue(source, ['determination', 'Determination', 'DETERMINATION']));

  const speed = n(firstValue(source, ['speed', 'Speed', 'SPEED']));
  const dexterity = n(firstValue(source, ['dexterity', 'Dexterity', 'DEXTERITY']));
  const awareness = n(firstValue(source, ['awareness', 'Awareness', 'AWARENESS']));

  const will = n(firstValue(source, ['will', 'Will', 'WILL']));
  const intelligence = n(firstValue(source, ['intelligence', 'Intelligence', 'INTELLIGENCE']));
  const charisma = n(firstValue(source, ['charisma', 'Charisma', 'CHARISMA']));

  const spirit = n(firstValue(source, ['spirit', 'Spirit', 'SPIRIT']));
  const torment = n(firstValue(source, ['torment', 'Torment', 'TORMENT']));

  const existingPow = firstValue(source, ['pow', 'POW'], null);
  const existingSpe = firstValue(source, ['spe', 'SPE'], null);
  const existingMen = firstValue(source, ['men', 'MEN'], null);
  const existingSoc = firstValue(source, ['soc', 'SOC'], null);

  const pow = existingPow !== null
    ? n(existingPow)
    : (power + health + 0.5 * stamina + 0.5 * determination) / 3;

  const spe = existingSpe !== null
    ? n(existingSpe)
    : (speed + dexterity + 0.5 * stamina + 0.5 * awareness) / 3;

  const men = existingMen !== null
    ? n(existingMen)
    : (will + intelligence + 0.5 * determination + 0.5 * charisma) / 3;

  const soc = existingSoc !== null
    ? n(existingSoc)
    : (spirit + torment + 0.5 * awareness + 0.5 * charisma) / 3;

  return {
    pow: Number(n(pow, 0).toFixed(2)),
    spe: Number(n(spe, 0).toFixed(2)),
    men: Number(n(men, 0).toFixed(2)),
    soc: Number(n(soc, 0).toFixed(2))
  };
};

const computeDisziScores = (attrRow) => {
  const out = {};
  if (!attrRow || typeof attrRow !== 'object') return out;

  for (const [diszi, weights] of Object.entries(recipes || {})) {
    if (!weights || typeof weights !== 'object') continue;

    let score = 0;
    let wSum = 0;

    for (const [attr, w] of Object.entries(weights)) {
      const ww = n(w, 0);
      if (!(ww > 0)) continue;

      wSum += ww;
      score += ww * n(attrRow?.[attr], 0);
    }

    const normScore = wSum > 0 ? score / wSum : 0;
    const key = normalizeDisziKey(diszi);

    if (key) {
      out[key] = Number(n(normScore, 0).toFixed(2));
    }
  }

  return out;
};

const result = (marketRows || [])
  .map((r) => {
    const name = s(r?.name || r?.player_name || r?.Name);
    const key = lower(name);
    const a = key ? attrsByName.get(key) || null : null;
    const source = a || r || {};

    const price = n(
      r?.marktwert ??
      r?.mw_neu ??
      r?.mw ??
      r?.MW ??
      r?.market_value ??
      r?.price,
      0
    );

    const salary = n(
      r?.gehalt ??
      r?.gehalt_rechnung ??
      r?.Gehalt ??
      r?.salary,
      0
    );

    const team_fit = r?.team_fit != null ? n(r.team_fit) : computeTeamFit(r);
    const diszi_attr_scores = computeDisziScores(source);
    const axes = computeMainAxes(source);

    return {
      ...r,

      name,
      player_name: name,

      klasse: s(r?.klasse || r?.Klasse || r?.class || ''),

      // canonical finance fields used by AI2_07
      price: Number(price.toFixed(2)),
      marktwert: Number(price.toFixed(2)),
      mw: Number(price.toFixed(2)),

      gehalt: Number(salary.toFixed(2)),
      salary: Number(salary.toFixed(2)),

      // canonical fit fields used by AI2_07
      team_fit: team_fit == null ? null : Number(n(team_fit, 0).toFixed(2)),
      fit: team_fit == null ? null : Number(n(team_fit, 0).toFixed(2)),

      // canonical main axes used by AI2_07
      pow: axes.pow,
      spe: axes.spe,
      men: axes.men,
      soc: axes.soc,

      // discipline scores needed for AI2_03 + AI2_07
      diszi_attr_scores,

      // raw attributes for audits/debug
      power: n(firstValue(source, ['power', 'Power', 'POWER']), null),
      health: n(firstValue(source, ['health', 'Health', 'HEALTH']), null),
      stamina: n(firstValue(source, ['stamina', 'Stamina', 'STAMINA']), null),
      determination: n(firstValue(source, ['determination', 'Determination', 'DETERMINATION']), null),

      speed: n(firstValue(source, ['speed', 'Speed', 'SPEED']), null),
      dexterity: n(firstValue(source, ['dexterity', 'Dexterity', 'DEXTERITY']), null),

      intelligence: n(firstValue(source, ['intelligence', 'Intelligence', 'INTELLIGENCE']), null),
      awareness: n(firstValue(source, ['awareness', 'Awareness', 'AWARENESS']), null),
      will: n(firstValue(source, ['will', 'Will', 'WILL']), null),
      charisma: n(firstValue(source, ['charisma', 'Charisma', 'CHARISMA']), null),

      spirit: n(firstValue(source, ['spirit', 'Spirit', 'SPIRIT']), null),
      torment: n(firstValue(source, ['torment', 'Torment', 'TORMENT']), null)
    };
  })
  .filter((r) => {
    return (
      s(r?.name) &&
      s(r?.klasse) &&
      n(r?.marktwert, 0) > 0
    );
  });

return result;
