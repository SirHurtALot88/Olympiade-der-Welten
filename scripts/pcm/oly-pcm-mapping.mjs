// Fachlogik fuer Oly -> Pro Cycling Manager 2026 (rein, keine I/O ausser dem kleinen
// Farbladen-Helfer unten). Alle Zahlen/Formeln sind aus plan.md (Fable-Plan, 05.09.2026)
// uebernommen -- s. dort fuer die empirische Herleitung. Nichts hier rundet auf 99; PCMs
// harte Obergrenze ist 85.

import { readFileSync } from 'node:fs';

export const PCM_MIN = 50;
export const PCM_MAX = 85;

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// ---- 1.1 Rohformeln (12 Oly-Attribute -> 14 PCM-Disziplinen) ------------------------
// UEBERARBEITET 05.09., zweite Runde (Chris, per Chat): "mach es so dass alle 12 attribute
// ihren sinn haben, social sind dann eher supportive stats und spielen ein wenig ueberall
// mit rein". Oly selbst kennt eine 4-Achsen-Einteilung der 12 Attribute (POW/SPE/MEN/SOC,
// s. lib/ai/ai-needs-engine.ts `mapAttributeToAxis` und docs/PLAYER_GENERATOR_PLAN.md):
// SOC = charisma + spirit + torment. Die erste ueberarbeitete Fassung (per IPF auf gleiche
// Spaltensummen getrimmt) hatte genau das Gegenteil produziert -- weil charisma/spirit/
// torment nur in wenigen Zeilen auftauchten, musste der Ausgleich sie DORT ueberproportional
// aufblasen, sodass torment/charisma in einzelnen Zeilen sogar zur groessten Kraft wurden
// (z.B. torment=24 in acceleration, noch vor power). Das ist die Umkehrung von "social =
// Support": ein einzelnes SOC-Attribut wurde zum Haupttreiber EINER Disziplin, statt in
// ALLEN ein bisschen mitzuzaehlen.
//
// Die Tabelle unten ist deshalb ein Handentwurf statt eines Ausgleichsalgorithmus (Quelle/
// Pruefung: scripts/pcm/design-discipline-weights.mjs), der zwei Invarianten direkt
// durchsetzt: (1) jedes der 9 physischen/mentalen Attribute (power/health/determination/
// stamina/speed/dexterity/awareness/intelligence/will) fuehrt oder co-fuehrt mindestens eine
// Disziplin klar erkennbar; (2) charisma/spirit/torment tauchen in JEDER der 13 Zeilen mit
// spuerbarem Gewicht auf (4-22, nie nur Alibi-1), sind aber in KEINER Zeile die groesste
// Kraft. Chris' fruehere Einzelvorgaben bleiben erhalten: mountain/hill/acceleration klar
// power-gefuehrt, sprint/plain/prologue klar speed-gefuehrt.
export const DISCIPLINE_WEIGHTS = {
  mountain: { power: 30, stamina: 18, determination: 13, torment: 7, health: 6, spirit: 6, will: 5, awareness: 5, charisma: 4, dexterity: 3, intelligence: 3 },
  timetrial: { dexterity: 26, intelligence: 21, awareness: 14, speed: 10, stamina: 6, torment: 6, spirit: 5, charisma: 4, power: 2, determination: 2, health: 2, will: 2 },
  sprint: { speed: 30, power: 16, determination: 14, torment: 12, dexterity: 7, spirit: 5, awareness: 4, charisma: 4, health: 4, will: 2, intelligence: 2 },
  hill: { power: 29, determination: 17, speed: 13, torment: 7, will: 6, awareness: 5, spirit: 5, charisma: 4, health: 4, stamina: 4, dexterity: 3, intelligence: 3 },
  plain: { speed: 29, stamina: 15, power: 14, awareness: 8, torment: 7, health: 5, spirit: 5, intelligence: 4, charisma: 4, determination: 4, dexterity: 3, will: 2 },
  prologue: { speed: 30, dexterity: 15, power: 13, torment: 10, intelligence: 8, charisma: 5, spirit: 5, awareness: 4, determination: 4, health: 4, stamina: 2 },
  acceleration: { power: 30, speed: 17, torment: 12, determination: 10, dexterity: 5, spirit: 5, charisma: 4, health: 4, stamina: 4, awareness: 3, intelligence: 3, will: 3 },
  endurance: { stamina: 28, health: 15, will: 13, spirit: 12, determination: 6, torment: 6, intelligence: 5, charisma: 4, dexterity: 4, power: 3, speed: 2, awareness: 2 },
  resistance: { will: 27, stamina: 15, health: 13, spirit: 13, determination: 7, torment: 6, intelligence: 4, charisma: 4, power: 3, awareness: 3, dexterity: 3, speed: 2 },
  recuperation: { health: 27, spirit: 22, stamina: 10, intelligence: 10, will: 6, torment: 6, determination: 4, charisma: 4, power: 3, dexterity: 3, awareness: 3, speed: 2 },
  cobble: { health: 26, power: 15, dexterity: 14, torment: 10, will: 6, awareness: 6, spirit: 5, determination: 4, charisma: 4, stamina: 4, speed: 3, intelligence: 3 },
  downhilling: { dexterity: 25, awareness: 22, torment: 14, speed: 9, intelligence: 6, spirit: 5, charisma: 4, determination: 3, power: 3, health: 3, will: 3, stamina: 3 },
  baroudeur: { determination: 24, will: 15, torment: 13, charisma: 12, stamina: 10, spirit: 8, intelligence: 5, power: 3, health: 3, awareness: 3, dexterity: 2, speed: 2 },
  // medium_mountain wird nicht direkt gewichtet, s. computeRaw() -- Mittel aus mountain+hill,
  // beide power-gefuehrt mit demselben SOC-Sockel, also bleibt medium_mountain konsistent.
};

export const DISCIPLINES = [...Object.keys(DISCIPLINE_WEIGHTS), 'medium_mountain'];

function weightedRaw(attrs, weights) {
  let sum = 0;
  let wsum = 0;
  for (const [attr, w] of Object.entries(weights)) {
    sum += (Number(attrs[attr]) || 0) * w;
    wsum += w;
  }
  return sum / wsum;
}

// { d: raw je Disziplin (0..99-Skala, wie Olys Attribute), levelRaw: Mittel ueber alle 14 }
export function computeRaw(player) {
  const attrs = player.attributeSheetStats || {};
  const raw = {};
  for (const [disc, weights] of Object.entries(DISCIPLINE_WEIGHTS)) {
    raw[disc] = weightedRaw(attrs, weights);
  }
  raw.medium_mountain = 0.5 * raw.mountain + 0.5 * raw.hill;
  const levelRaw = DISCIPLINES.reduce((s, d) => s + raw[d], 0) / DISCIPLINES.length;
  return { raw, levelRaw };
}

// Ankerpruefung (plan.md 1.1): unsere mountain/timetrial/sprint-Rohformeln sollen stark mit
// Olys eigenen offiziellen climbing/time-trial/spurt-Werten korrelieren.
export function pearsonCorrelation(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

// ---- 1.2 "Level + Profil"-Skalierung gegen die echte Zielpopulation -----------------

// Ordnet jedem Eintrag (nach levelRaw sortiert, Tie-Break Hash) den Wert an derselben
// relativen Position in `referenceValues` (aufsteigend sortiert) zu -- Multiset-Zuweisung,
// keine Formel. `referenceValues` = die echten mittleren charac-Werte der 919 zu
// ersetzenden PCM-Zeilen.
export function buildLevelTargets(entries, referenceValues) {
  const refSorted = [...referenceValues].sort((a, b) => a - b);
  const order = entries
    .map((e, i) => ({ i, levelRaw: e.levelRaw, tie: hashString(String(e.id ?? i)) }))
    .sort((a, b) => a.levelRaw - b.levelRaw || a.tie - b.tie);
  const targets = new Array(entries.length);
  const n = entries.length;
  order.forEach((o, rank) => {
    const refIdx = n <= 1 ? 0 : Math.round((rank / (n - 1)) * (refSorted.length - 1));
    targets[o.i] = refSorted[refIdx];
  });
  return targets;
}

// UEBERARBEITET 05.09., sechste Runde: Chris fand einen "Superman" (Kelektros: sprint UND
// mountain beide nahe 85) -- die vorherige unabhaengige Z-Skalierung pro Disziplin ignoriert
// jede Kopplung zwischen Disziplinen komplett. In der echten Population (WT+PT, 919 Zeilen)
// kommt sprint>=80 UND mountain>=80 aber NULL mal vor (corr sprint/mountain = -0.51 --
// Sprinter und Kletterer sind gegensaetzliche Koerpertypen). Statt jede Disziplin unabhaengig
// zu skalieren, wird deshalb pro Charakter der STAT-AEHNLICHSTE echte Fahrer gesucht (Pearson-
// Korrelation der 14 Rohwerte gegen dessen 14 charac_i_*-Werte -- skalen-/lageinvariant,
// vergleicht also die FORM des Profils, nicht das Niveau) und dessen echte Abweichung vom
// eigenen Mittel uebernommen. Jede in der Realitaet vorkommende Kombination ist damit erlaubt,
// jede nicht vorkommende automatisch ausgeschlossen (sie waere nie der best passende Fund).
// Als Nebeneffekt bekommt man den "closest real rider comp" geschenkt, den Chris explizit
// sehen wollte.
export function matchShapeTemplate(raw, templates) {
  let best = null;
  let bestScore = -Infinity;
  const xs = DISCIPLINES.map((d) => raw[d]);
  for (const t of templates) {
    const ys = DISCIPLINES.map((d) => t.charac[d]);
    const score = pearsonCorrelation(xs, ys);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return { template: best, similarity: bestScore };
}

// Ein geliehenes Profil kann trotzdem noch "Supermann"-Kombinationen zeigen: ein
// Oly-Charakter mit gleichzeitig sehr hohen Roh-Werten in mehreren Disziplinen (z.B. power
// UND speed UND determination alle nahe Maximum) destabilisiert die Form-Suche selbst -- der
// best passende echte Fahrer ist dann oft ein "flacher" Generalist ohne ausgepraegtes Profil
// (kleine Abweichungen ueberall), dessen Muster auf einem hohen Zielmittel trotzdem ueberall
// hohe Werte ergibt. mountain/sprint ist die einzige STARK gegenlaeufige Achse unter den 14
// Disziplinen (corr=-0.51 an den 919 echten WT+PT-Zeilen, alle anderen Paare nicht-negativ,
// s. scripts/pcm/analyze-correlations in der Session-Historie) -- deshalb eine direkte,
// aus genau dieser echten Population per linearer Regression kalibrierte Nachkorrektur:
// die schwaechere der beiden Spezialisierungen (laut Rohwerten, nicht laut Zielwert) wird auf
// das reale Band (Regressionswert +1 SD) gedeckelt, die staerkere bleibt unangetastet.
const MOUNTAIN_SPRINT_REGRESSION = {
  sprintGivenMountain: { a: 92.71, b: -0.366, sd: 3.79 },
  mountainGivenSprint: { a: 115.92, b: -0.713, sd: 5.30 },
};

export function enforceMountainSprintTradeoff(charac, raw) {
  const out = { ...charac };
  if (raw.mountain >= raw.sprint) {
    const { a, b, sd } = MOUNTAIN_SPRINT_REGRESSION.sprintGivenMountain;
    const cap = Math.round(a + b * out.mountain + sd);
    if (out.sprint > cap) out.sprint = Math.max(PCM_MIN, cap);
  } else {
    const { a, b, sd } = MOUNTAIN_SPRINT_REGRESSION.mountainGivenSprint;
    const cap = Math.round(a + b * out.sprint + sd);
    if (out.mountain > cap) out.mountain = Math.max(PCM_MIN, cap);
  }
  return out;
}

// UEBERARBEITET 05.09., siebte Runde: Chris ("hoffe dass du auch wirklich starke
// Spezialisten drin hast und nicht nur Allrounder ... social als support oder teils mental
// soll dann nicht nur was drauf schlagen sondern zieht ja auch Punkte ab, weil es dann den
// Schnitt deutlich schlechter macht, und das wird dann auf die Punkte bis 85 verteilt").
// Die reine Form-Zuordnung oben leiht IMMER die Streuung des gefundenen echten Fahrers --
// und echte WT/PT-Fahrer sind selbst schon eher flach (Median-Innerhalb-SD nur 3.64 von 35
// moeglichen Punkten). Ein Oly-Charakter mit hart einseitigen Attributen (z.B. Speed/Power
// exzellent, aber charisma/spirit/torment mies -- die in praktisch jeder Disziplin als
// kleiner Abzugsposten mitzaehlen, s. DISCIPLINE_WEIGHTS) hat in seinen ROHWERTEN oft eine
// VIEL groessere Eigen-Streuung als der beste Formtreffer -- lieh man bisher trotzdem dessen
// (kleinere) Streuung, wurden echte Spezialisten unnoetig geglaettet. Jetzt wird die
// geliehene FORM (Richtung, auf Einheitsstreuung normiert) mit der EIGENEN Streuung des
// Charakters skaliert, relativ zum Populations-Median: schwache soziale/mentale Attribute
// druecken mehrere Rohwerte gleichzeitig, vergroessern also die Eigen-Streuung -- das
// Budget, das die Disziplin mit sozialem Abzug verliert, taucht als groesserer Ausschlag bei
// den unterstuetzten Disziplinen wieder auf (naeher an 85), statt gleichmaessig zu verwaschen.
export function buildShapeMatchedProfiler(templates, rawList, targetWithinSdMedian) {
  function ownSpread(raw) {
    const vals = DISCIPLINES.map((d) => raw[d]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    return Math.sqrt(variance);
  }
  const spreads = rawList.map(ownSpread).sort((a, b) => a - b);
  const spreadMedian = spreads[Math.floor(spreads.length / 2)] || 1;

  return {
    apply(raw, targetMean) {
      const { template, similarity } = matchShapeTemplate(raw, templates);
      const tVals = DISCIPLINES.map((d) => template.charac[d]);
      const tMean = tVals.reduce((a, b) => a + b, 0) / tVals.length;
      const tSd = Math.sqrt(DISCIPLINES.reduce((s, d) => s + (template.charac[d] - tMean) ** 2, 0) / DISCIPLINES.length) || 1;

      const specializationFactor = spreadMedian > 0 ? ownSpread(raw) / spreadMedian : 1;

      let charac = {};
      for (const d of DISCIPLINES) {
        const shape = (template.charac[d] - tMean) / tSd; // Richtung, Einheitsstreuung
        charac[d] = clamp(Math.round(targetMean + targetWithinSdMedian * specializationFactor * shape), PCM_MIN, PCM_MAX);
      }
      charac = enforceMountainSprintTradeoff(charac, raw);
      return { charac, matchedName: template.name, similarity, specializationFactor };
    },
  };
}

// ---- Multiset-Zuweisung fuer diskrete Felder (potentiel, tour, classic) ------------

// Weist jedem Eintrag (sortiert nach `rankKey`, aufsteigend) den Wert an derselben
// relativen Position in der sortierten Referenzliste zu -- garantiert exakt dieselbe
// Verteilung wie das Original.
export function multisetAssign(entries, rankKeyFn, referenceValues) {
  const refSorted = [...referenceValues].sort((a, b) => a - b);
  const order = entries
    .map((e, i) => ({ i, key: rankKeyFn(e), tie: hashString(String(e.id ?? i)) }))
    .sort((a, b) => a.key - b.key || a.tie - b.tie);
  const out = new Array(entries.length);
  const n = entries.length;
  order.forEach((o, rank) => {
    const refIdx = n <= 1 ? 0 : Math.round((rank / (n - 1)) * (refSorted.length - 1));
    out[o.i] = refSorted[refIdx];
  });
  return out;
}

// ---- 1.3 Abgeleitete Fahrerfelder ---------------------------------------------------

// headroom(age, potentiel): Wachstumsspielraum fuer Fahrer <= 27 (plan.md 1.3).
export function headroom(age, potentiel) {
  if (age >= 28) return 0;
  const base = age <= 21 ? 5 : age <= 24 ? 3 : 1;
  return Math.max(0, base + Math.round(0.5 * (potentiel - 3)));
}

// limitsFor(charac, age, potentiel) -> { [discipline]: limit } (0 wenn age>=28).
export function limitsFor(charac, age, potentiel) {
  const limits = {};
  const hr = headroom(age, potentiel);
  for (const d of DISCIPLINES) {
    limits[d] = age >= 28 ? 0 : clamp(charac[d] + hr, charac[d], PCM_MAX);
  }
  return limits;
}

// charac_i_tour / charac_i_classic: Mittel bestimmter Disziplinen, per Multiset gegen die
// echte 1..5-Verteilung zugewiesen (an der Aufrufstelle, hier nur die Indexformel).
export function tourIndexRaw(charac) {
  return (charac.mountain + charac.recuperation + charac.resistance + charac.timetrial) / 4;
}
export function classicIndexRaw(charac) {
  return (charac.cobble + charac.hill + charac.baroudeur + charac.plain) / 4;
}

// ---- 1.4 Namen -----------------------------------------------------------------------

export function splitName(fullName, firstnameFallback = '') {
  const trimmed = (fullName || '').trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    const lastname = parts[0] || firstnameFallback || '-';
    return { firstname: firstnameFallback, lastname, firstlastname: lastname };
  }
  const firstname = parts[0];
  const lastname = parts.slice(1).join(' ');
  const initial = firstname.slice(0, 1).toUpperCase();
  return { firstname, lastname, firstlastname: `${lastname} ${initial}.` };
}

// ---- Loyalitaet aus Oly-Traits (plan.md 1.3) ------------------------------------------
const FIDELITY_HIGH = new Set(['Loyal']);
const FIDELITY_MID = new Set(['Fair', 'Altruistic', 'Caring', 'Disciplined']);
const FIDELITY_LOW = new Set(['Mercenary', 'Renegade', 'Gambler']);

export function fidelityFromTraits(player) {
  const pos = player.traitsPositive || [];
  const neg = player.traitsNegative || [];
  if (pos.some((t) => FIDELITY_HIGH.has(t))) return 5;
  if (neg.some((t) => FIDELITY_LOW.has(t))) return 0;
  if (pos.some((t) => FIDELITY_MID.has(t))) return 3;
  return 0;
}

// ---- Gehaltsvorstellung aus Oly-Traits (Chris, 05.09., fuenfte Runde: "ob sie im
// Verhaeltnis etwas mehr oder weniger wollen") -- selbstbezogene/geldgetriebene Traits
// wollen mehr, teamorientierte/bescheidene weniger. Beide Listen sind echte Vokabel aus
// Olys 36-Wort-Trait-Set (s. export-team-principal-mod.mjs Kopfkommentar).
const WAGE_DEMAND_HIGH = new Set(['Mercenary', 'Gambler', 'Renegade', 'Egomaniac', 'Diva', 'Vindictive', 'Scandalous']);
const WAGE_DEMAND_LOW = new Set(['Loyal', 'Fair', 'Altruistic', 'Caring', 'Disciplined', 'Relaxed']);

export function wageDemandMultiplier(player) {
  const pos = player.traitsPositive || [];
  const neg = player.traitsNegative || [];
  if (neg.some((t) => WAGE_DEMAND_HIGH.has(t))) return 1.25;
  if (pos.some((t) => WAGE_DEMAND_LOW.has(t))) return 0.85;
  return 1;
}

// ---- 2. Team-Zuordnung ----------------------------------------------------------------

// Chris' F1-Reihenfolge (staerkstes zuerst), s. export-team-principal-mod.mjs F1_TEAM_NAMES.
export const F1_TEAM_NAMES = [
  'Mayhem Mavericks', 'Zero Heroes', 'Cold Steel', 'Golden Gladiators', 'Last Ride',
  'Project Suicide', 'Raging Lunatics', 'Wrecking Legionnaires', 'Hell Raisers',
  'Silver Soldiers', 'Black Panthers', 'Nunchuck Ninjas', 'Natures Wrath', 'Death Peaches',
  'Wicked Wizards', 'Vicious & Delicious',
];
// plan.md 2.1: die Menge "Top 18 nach Budget" ist identisch mit "F1-16 + Terrible Teachers +
// Mortal Sin"; Default-Reihenfolge haengt die beiden hinten an.
export const WORLD_TOUR_ORDER_OVERRIDE = [...F1_TEAM_NAMES, 'Terrible Teachers', 'Mortal Sin'];

export function computeTeamPrestige(identity) {
  const heritage = clamp(Math.round(((identity.ambition / 10) * 0.5 + (identity.boardConfidence / 9) * 0.5) * 100), 10, 95);
  const form = clamp(Math.round(((identity.harmony / 10) * 0.5 + (identity.cooperation / 9.73) * 0.5) * 100), 10, 95);
  return { heritage, form, base: Math.round((heritage + form) / 2) };
}

// teams: [{teamId, name, budget}], identities: Map(teamId -> identity). orderMode:
// 'f1' (Default, WORLD_TOUR_ORDER_OVERRIDE) oder 'budget' (reine Budget-Reihenfolge).
export function rankOlyTeams(teams, identities, orderMode = 'f1') {
  const sorted = [...teams].sort((a, b) => b.budget - a.budget);
  const top18 = sorted.slice(0, 18);
  const rest = sorted.slice(18);

  let worldTour;
  if (orderMode === 'f1') {
    const byName = new Map(top18.map((t) => [t.name, t]));
    worldTour = WORLD_TOUR_ORDER_OVERRIDE.map((name) => byName.get(name)).filter(Boolean);
    if (worldTour.length !== 18) {
      throw new Error(
        `WORLD_TOUR_ORDER_OVERRIDE (${WORLD_TOUR_ORDER_OVERRIDE.length} Namen) trifft nicht auf die Top-18-Teams nach Budget zu (${worldTour.length} gefunden) -- Team umbenannt/Budget veraendert?`,
      );
    }
  } else {
    worldTour = top18;
  }

  const proTeams = [...rest].sort((a, b) => b.budget - a.budget).slice(0, 14);
  return { worldTour, proTeams };
}

// Real-Staerke der Slots (Mittel der 8 besten "max charac"), absteigend -- plan.md 0.3.
export const WT_SLOT_STRENGTH_ORDER = [
  'Lidl-Trek', 'UAE', 'Visma', 'Red Bull', 'INEOS', 'Bahrain', 'Quick-Step', 'Jayco',
  'Decathlon', 'Lotto', 'EF', 'Uno-X', 'NSN', 'Alpecin', 'Movistar', 'Astana',
  'Groupama', 'Picnic',
];
export const PT_SLOT_STRENGTH_ORDER = [
  'Tudor', 'Polti', 'Pinarello', 'TotalEnergies', 'Cofidis', 'Unibet', 'Bardiani',
  'Caja Rural', 'Flanders', 'Kern Pharma', 'NIPPO', 'MBH', 'Burgos', 'Euskaltel',
];

// slotTeamsByName: Map(kurzer Markenname -> Team-Chunk-Zeilenindex), aus dem echten PCM-
// Team-Namen aufgeloest (Substring-Match, da die echten Namen laenger/anders geschrieben
// sind, z.B. "Lidl - Trek"). rankKey(name) -> Zeilenindex.
export function matchSlotOrder(strengthOrder, realTeamNames) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return strengthOrder.map((brand) => {
    const target = norm(brand);
    const idx = realTeamNames.findIndex((n) => norm(n).includes(target));
    if (idx === -1) throw new Error(`Slot-Marke "${brand}" nicht unter den echten PCM-Teamnamen gefunden`);
    return idx;
  });
}

// ---- 3.2 Snake-Draft fuer Top-up-Fahrer ------------------------------------------------

// teamsInOrder: Array von Team-Objekten in Oly-Staerkereihenfolge (staerkstes zuerst).
// freePlayers: Array, absteigend nach rating vorsortiert erwartet.
// slotCounts: Map(teamId -> Anzahl benoetigter Top-ups).
// Gibt Map(teamId -> Array von Top-up-Spielern) zurueck.
export function draftTopUps(teamsInOrder, freePlayers, slotCounts) {
  const drafted = new Map(teamsInOrder.map((t) => [t.teamId, []]));
  let cursor = 0;
  let forward = true;
  let remaining = teamsInOrder.filter((t) => (slotCounts.get(t.teamId) || 0) > drafted.get(t.teamId).length);
  while (remaining.length > 0 && cursor < freePlayers.length) {
    const order = forward ? teamsInOrder : [...teamsInOrder].reverse();
    for (const team of order) {
      const need = slotCounts.get(team.teamId) || 0;
      if (drafted.get(team.teamId).length >= need) continue;
      if (cursor >= freePlayers.length) break;
      drafted.get(team.teamId).push(freePlayers[cursor]);
      cursor++;
    }
    forward = !forward;
    remaining = teamsInOrder.filter((t) => (slotCounts.get(t.teamId) || 0) > drafted.get(t.teamId).length);
  }
  return drafted;
}

// ---- 3.3 Slot-Zuordnung innerhalb eines Teams (Prime-Alter-Regel) ---------------------

// slotRows: [{rowIndex, birthYear}] eines Teams (aus der echten PCM-Zeile). players:
// [{..., levelRaw}] in beliebiger Reihenfolge, bereits (gerostert zuerst, dann Top-ups)
// konkateniert. Gibt Array [{rowIndex, player}] zurueck, laengengleich zu slotRows.
export function assignSlotsWithinTeam(slotRows, players, currentSeasonYear) {
  function primeClass(age) {
    if (age >= 24 && age <= 30) return 0;
    if ((age >= 22 && age <= 23) || (age >= 31 && age <= 32)) return 1;
    return 2;
  }
  const slots = slotRows.map((s) => ({ ...s, age: currentSeasonYear - s.birthYear }));
  slots.sort((a, b) => primeClass(a.age) - primeClass(b.age) || a.age - b.age);
  const sortedPlayers = [...players].sort((a, b) => (b.levelRaw ?? 0) - (a.levelRaw ?? 0));
  return slots.map((slot, i) => ({ rowIndex: slot.rowIndex, age: slot.age, player: sortedPlayers[i] }));
}

// ---- Team-Abkuerzung -------------------------------------------------------------------

// ---- Teamfarben (dupliziert aus export-team-principal-mod.mjs -- dort nicht exportiert,
// und dieses Skript soll die bereits gepruefte TP-Datei nicht anfassen) --------------------

export function loadTeamColorMap(teamColorsTsPath) {
  const src = readFileSync(teamColorsTsPath, 'utf8');
  const marker = 'export const TEAM_COLOR: Record<string, TeamColor> = ';
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`TEAM_COLOR nicht gefunden in ${teamColorsTsPath}`);
  const objStart = src.indexOf('{', start);
  let depth = 0;
  let i = objStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  const objText = src.slice(objStart, i);
  return new Function(`return (${objText});`)();
}

export function hslStringToRgb(hslStr) {
  const m = /hsl\(\s*(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/.exec(hslStr || '');
  if (!m) return [128, 128, 128];
  const h = ((Number(m[1]) % 360) + 360) % 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m2 = l - c / 2;
  const [r0, g0, b0] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r0, g0, b0].map((v) => Math.round((v + m2) * 255));
}

export function rgbToHex([r, g, b]) {
  return [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}

function relativeLuminance([r, g, b]) {
  const chan = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}
export function contrastRatio(rgbA, rgbB) {
  const a = relativeLuminance(rgbA);
  const b = relativeLuminance(rgbB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const MIN_TEXT_CONTRAST = 3.0;
export function ensureReadableSecondary(primary, candidateSecondary) {
  if (candidateSecondary && contrastRatio(primary, candidateSecondary) >= MIN_TEXT_CONTRAST) {
    return candidateSecondary;
  }
  const white = [255, 255, 255];
  const black = [17, 17, 17];
  return contrastRatio(primary, white) >= contrastRatio(primary, black) ? white : black;
}

export function resolveTeamColors(colorMap, shortCode) {
  const entry = colorMap[shortCode];
  let primary;
  let secondaryCandidate = null;
  if (!entry) {
    const hue = Math.round((hashString(shortCode) * 137.508) % 360);
    primary = hslStringToRgb(`hsl(${hue} 58% 55%)`);
  } else {
    primary = hslStringToRgb(entry.primary);
    secondaryCandidate = entry.secondary ? hslStringToRgb(entry.secondary) : null;
  }
  return { primary, secondary: ensureReadableSecondary(primary, secondaryCandidate) };
}

export function teamAbbreviation(name, used) {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '');
  const candidates = [];
  if (letters.length >= 3) {
    candidates.push(letters.slice(0, 3));
    // Konsonanten-Fallback: Anfangsbuchstaben der Woerter, dann Konsonanten auffuellen.
    const words = name.toUpperCase().split(/\s+/).filter(Boolean);
    const initials = words.map((w) => w[0]).join('').replace(/[^A-Z]/g, '');
    if (initials.length >= 2) candidates.push((initials + letters).slice(0, 3));
    for (let i = 1; i < letters.length - 1; i++) {
      candidates.push((letters[0] + letters.slice(i)).slice(0, 3));
    }
  }
  candidates.push(letters.padEnd(3, 'X').slice(0, 3));
  for (const c of candidates) {
    if (c.length === 3 && !used.has(c)) return c;
  }
  // Letzter Ausweg: Zahl anhaengen bis eindeutig.
  let n = 0;
  let fallback;
  do {
    fallback = (letters.slice(0, 2) || 'XX') + String(n % 10);
    n++;
  } while (used.has(fallback));
  return fallback;
}
