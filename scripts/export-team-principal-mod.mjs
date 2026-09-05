// ===================================================================================
// OLY -> "Team Principal" (2026er-Mod) Exporteur.
//
// KORREKTUR 05.09.: Wir nutzen fuer die Olympiade die **2026er-Mod** von "Team Principal",
// NICHT die 1999er (die frueheren Versionen dieses Skripts liehen sich Chassis-Physik von
// den 1999er-Basisteams -- das war falsch). Referenzdaten liegen jetzt unter
// references/team-principal-mod/2026-*.json (von Chris hochgeladene Mod-Exporte: alle 77
// Teams -- 11 aktive reale 2026er-Konstrukteure + 66 noch inaktive -- und 322 Fahrer, zur
// Kontrolle des tatsaechlichen Schemas, s. unten).
//
// Entscheidung mit Chris (05.09.): 16 von ihm benannte Oly-Teams ersetzen das reale 2026er-
// Grid komplett und bilden das F1-Feld, in GENAU der Staerke-Reihenfolge, die er vorgegeben
// hat (Index 0 = staerkstes Team). Die uebrigen 16 Oly-Teams landen als "active: false" in
// teams.json (koennen spaeter dazustossen -- exakt das Muster, das die reale 2026er-
// Referenz selbst fuer ihre 66 inaktiven Teams nutzt: active:false + first_active_season).
//
// ORGANISCH, NICHT VOLLGESPAMMT (Chris, 05.09.: "es soll sich organisch entwickeln und
// nicht fix dazu kommen, manche Teams haben vielleicht Probleme, hoeren auf oder werden
// aufgekauft"): first_active_season wird NICHT als sauberer Kalender (2 Teams pro Saison)
// vergeben, sondern gestreut -- staerkere inaktive Teams eher frueh moeglich, schwaechere
// erst sehr spaet, ein paar sogar praktisch nie (Saison 90+). Das spiegelt die reale
// 2026er-Referenz: deren first_active_season-Werte liegen wild verteilt zwischen 1 und 100
// (u.a. mehrere bewusste 98/99/100 fuer "praktisch nie ohne manuelles Eingreifen"), keine
// gleichmaessige Kadenz. Ob so ein Team dann WIRKLICH kommt (Pleite eines aktiven Teams,
// Aufkauf etc.) entscheidet ohnehin die Mod-Simulation selbst, nicht diese Datei -- wir
// setzen nur, ab wann es ueberhaupt in Frage kaeme.
//
// Woher die Zahlen kommen:
//
//   Fahrer-Skill/Talent: gewichtete Kombination aus ALLEN 12 Oly-Attributen (0-99), dann
//   PERZENTIL-skaliert -- nicht linear /99*20 (die gewichteten Rohwerte kommen selten in
//   die Naehe von 99). Ein Perzentil-Ranking innerhalb der tatsaechlich exportierten
//   Population garantiert echte Sternfahrer (~90er) UND echte Hinterbaenkler (<10),
//   unabhaengig davon, wie gestaucht die Roh-Attribute sind -- dieselbe Idee wie die
//   rho-Abnahme, mit der dieses Projekt seine Disziplinen misst (s. CLAUDE.md): nicht der
//   Rohwert zaehlt, sondern die Position in der Verteilung.
//
//     cornering    = 0.5*dexterity + 0.5*awareness
//     braking      = 0.5*awareness + 0.5*determination
//     consistency  = 0.4*will + 0.3*stamina + 0.3*(99-torment)
//     smoothness   = 0.5*intelligence + 0.5*dexterity
//     control      = 0.4*power + 0.3*speed + 0.3*health
//     balance_preference  (roh) = 0.6*dexterity + 0.4*charisma
//     traction_preference (roh) = 0.6*torment + 0.4*(99-spirit)
//     talent (roh) = (Summe der 5 Skill-Rohwerte) * (potential/rating) -- nutzt Olys
//                    eigenes Potenzial/Rating-Verhaeltnis als Wachstums-Headroom
//   "speed" taucht bewusst nur EINMAL auf (in control), damit nicht nur schnelle Spieler
//   ueberall vorne liegen -- alle 12 Attribute fliessen ein, keins dominiert.
//
//   Team-Prestige      = aus den Oly-Team-Ratings (ambition/boardConfidence -> heritage,
//                        harmony/cooperation -> form), unabhaengig von der Grid-Reihenfolge.
//   budget_m           = Olys eigenes budget-Feld (liegt ueber alle 32 Teams zwischen 170
//                        und 325 -- praktisch dieselbe Groessenordnung wie die realen
//                        2026er budget_m-Werte, 60-490).
//   starting_balance_m = Olys eigenes cash-Feld (laufende Kriegskasse, anderer Wert als
//                        budget_m -- die 2026er-Referenz fuehrt fuer JEDES Team, aktiv wie
//                        inaktiv, beide Felder gleichzeitig und unterschiedlich).
//   Farben/Logo        = ECHTE Oly-Farben (lib/foundation/team-colors.ts, HSL->RGB) und
//                        -Logos (public/team-logos/<shortCode>.jpg, als PNG exportiert).
//   Chassis-Physik     = KEIN Oly-Aequivalent vorhanden. Deshalb geliehen: alle 32 Oly-
//                        Teams werden -- F1-Teams in Chris' vorgegebener Reihenfolge, die
//                        16 inaktiven untereinander nach Olys eigener Prestige -- per
//                        Perzentil auf eine nach team_pace sortierte Physik-Kurve aus ALLEN
//                        77 echten 2026er-Team-Templates (aktiv + inaktiv, s. Referenzdatei)
//                        gemappt. Nur Chassis-Zahlen/Reifen-/Motor-Vertrag kommen von dort,
//                        Farbe/Name/Prestige/Budget/Historie sind komplett Oly.
//
// Fahrer-Schema an der echten 2026er-Referenz kalibriert (322 Fahrer geprueft):
//   - Freie Agenten haben "team": null (NICHT den String "Free Agent" wie in der 1999er-
//     Mod) und einen minimalen Vertrag {status, priority}.
//   - Kein "number"-Feld (in 322 echten Eintraegen genau EINMAL vorhanden -- faktisch
//     unbenutzt, hier komplett weggelassen).
//   - Kein "career_stage"-Feld (existiert im 2026er-Schema nicht, das war 1999er-spezifisch).
//   - "personality" (Einzahl, IMMER vorhanden) zusaetzlich zu "personalities" (Mehrzahl,
//     in ~65% der echten Eintraege vorhanden) -- wir liefern beides.
//   - Reserve-Fahrer bekommen zusaetzlich zu contract.role ein Top-Level "role": "reserve"
//     (Hauptfahrer nicht -- genau das Muster der echten Daten).
//
// Das ist ein Entwurf -- KEINE endgueltige Balance-Aussage. Alle Annahmen (age-Heuristik,
// nationality="international", Trait-Lookup, first_active_season-Streuung) sind markiert
// und sollen von Chris im Spiel gegengeprueft werden, bevor final importiert wird.
//
// Junior-Teams steigen in dieser Mod nicht als Team in die F1 auf (nachgeprueft an der
// 1999er-Datenbank: "Driver Development [config.json]" kennt nur individuelle Wachstums-
// Multiplikatoren je Serie fuer FAHRER, keine Team-Beforderung; die 2026er-Referenz kennt
// gar keine Junior-Serien-Struktur, nur active/inactive-Teams) -- deshalb keine
// Access-Series-Aufteilung, sondern direkt Oly-Teams als F1-Feld plus inaktive Kandidaten.
//
//   node scripts/export-team-principal-mod.mjs [--save <saveId>] [--out <dir>]
//
// Save-Quelle: OLY_APP_SQLITE_PATH (Default data/persistence/oly-app.sqlite), s. CLAUDE.md
// "An die Spielstaende kommen". Ohne --save wird der zuletzt aktualisierte Save genommen.
// ===================================================================================

import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SQLITE_PATH = process.env.OLY_APP_SQLITE_PATH || 'data/persistence/oly-app.sqlite';
const TEAM_COLORS_TS_PATH = 'lib/foundation/team-colors.ts';
const TEAM_LOGOS_DIR = 'public/team-logos';
const PLAYER_PORTRAITS_DIR = 'public/portraits';
const CHASSIS_REFERENCE_PATH = 'references/team-principal-mod/2026-teams-reference.json';

function parseArgs(argv) {
  const out = { save: null, outDir: 'data/generated/team-principal-mod' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--save') out.save = argv[++i];
    else if (argv[i] === '--out') out.outDir = argv[++i];
  }
  return out;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// ---- Echte Oly-Team-Farben statt geliehener Mod-Farben -----------------------------
// Liest lib/foundation/team-colors.ts direkt (statt die Farben hier zu duplizieren), damit
// Aenderungen an TEAM_COLOR automatisch uebernommen werden. Kein TS-Compiler noetig -- wir
// brauchen nur das Objektliteral, keine Typen.
function loadTeamColorMap() {
  const src = readFileSync(TEAM_COLORS_TS_PATH, 'utf8');
  const marker = 'export const TEAM_COLOR: Record<string, TeamColor> = ';
  const start = src.indexOf(marker);
  if (start === -1) {
    throw new Error(`TEAM_COLOR nicht gefunden in ${TEAM_COLORS_TS_PATH} -- Datei umbenannt/verschoben?`);
  }
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
  // eslint-disable-next-line no-new-func -- eigener Repo-Quelltext, kein externer Input.
  return new Function(`return (${objText});`)();
}

function hslStringToRgb(hslStr) {
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

function resolveTeamColors(colorMap, shortCode) {
  const entry = colorMap[shortCode];
  if (!entry) {
    // Deterministischer Fallback, analog zur fallbackColor()-Funktion in team-colors.ts.
    const hue = Math.round((hashString(shortCode) * 137.508) % 360);
    return { primary: hslStringToRgb(`hsl(${hue} 58% 55%)`), secondary: null };
  }
  return {
    primary: hslStringToRgb(entry.primary),
    secondary: entry.secondary ? hslStringToRgb(entry.secondary) : null,
  };
}

// ---- Chassis-Referenzkurve aus der ECHTEN 2026er-Mod-Datenbank -------------------------
// Alle 77 Team-Templates (11 aktive reale Konstrukteure + 66 inaktive Kandidaten), nur die
// Felder ohne Oly-Aequivalent. "active" in dieser Referenzdatei hat NICHTS mit unserer
// eigenen Oly->F1-Zuordnung zu tun. NUR die 11 echten AKTIVEN Konstrukteure -- die 66
// inaktiven Kandidaten der Referenz mischen erkennbare Spass-/Easter-Egg-Eintraege unter
// echte Automarken (u.a. "Brawn GP" mit team_pace 100 als Anspielung auf die reale
// 2009er-Dominanz, "Dinoco" ist eine reine Pixar-"Cars"-Referenz) -- als Physik-Stichprobe
// wuerden die unser staerkstes Oly-Team unrealistisch ueberdrehen (Perzentil 0 haette sonst
// woertlich Brawn-GP-Werte bekommen).
function loadChassisReferenceCurve() {
  const raw = JSON.parse(readFileSync(CHASSIS_REFERENCE_PATH, 'utf8'));
  return raw
    .filter((t) => t.active === true)
    .map((t) => ({
      name: t.name,
      car_mass_kg: t.car_mass_kg,
      braking: t.braking,
      acceleration: t.acceleration,
      team_pace: t.team_pace,
      attr: t.attr,
      tyre_management: t.tyre_management,
      dirty_air_sensitivity: t.dirty_air_sensitivity,
      chassis_reliability: t.chassis_reliability,
      aero_efficiency: t.aero_efficiency,
      chassis_starting_potential: t.chassis_starting_potential,
      tyre_contract: t.tyre_contract,
      engine: t.engine,
      engine_supplier: t.engine_supplier,
      engine_contract_type: t.engine_contract_type,
      engine_contract: t.engine_contract,
      engine_contract_seasons: t.engine_contract_seasons,
      engine_units_per_season: t.engine_units_per_season,
      engine_contract_bonus: t.engine_contract_bonus,
      driver_aids: t.driver_aids,
      driver_focus: t.driver_focus,
    }))
    .filter((t) => typeof t.team_pace === 'number')
    .sort((a, b) => b.team_pace - a.team_pace);
}

// Chris' vorgegebene Reihenfolge (05.09.): Index 0 ist das staerkste Team, letzter Index
// das schwaechste. Steuert NUR die geliehene Chassis-Physik-Kurve, nicht Prestige/Budget.
const F1_TEAM_NAMES = [
  'Mayhem Mavericks', 'Zero Heroes', 'Cold Steel', 'Golden Gladiators', 'Last Ride',
  'Project Suicide', 'Raging Lunatics', 'Wrecking Legionnaires', 'Hell Raisers',
  'Silver Soldiers', 'Black Panthers', 'Nunchuck Ninjas', 'Natures Wrath', 'Death Peaches',
  'Wicked Wizards', 'Vicious & Delicious',
];

// Interpoliert an Perzentil p (0 = staerkstes Team, 1 = schwaechstes) linear zwischen den
// beiden naechstliegenden Punkten der Referenzkurve. Numerische Felder werden geblendet,
// alles andere (Motor-/Reifendeal, Name) kommt vom naeher liegenden Referenzpunkt -- ein
// "halber" Motorvertrag ergibt ja keinen Sinn.
function interpolateChassis(curve, percentile) {
  const pos = clamp(percentile, 0, 1) * (curve.length - 1);
  const i0 = Math.floor(pos);
  const i1 = Math.min(i0 + 1, curve.length - 1);
  const frac = pos - i0;
  const a = curve[i0];
  const b = curve[i1];
  const nearer = frac < 0.5 ? a : b;
  const blendNum2 = (x, y, f) => x + (y - x) * f;
  const blendNum = (key) => blendNum2(a[key], b[key], frac);
  const blendObj = (key) => {
    const out = {};
    for (const k of Object.keys(a[key])) out[k] = blendNum2(a[key][k], b[key][k], frac);
    return out;
  };
  return {
    ...nearer,
    car_mass_kg: blendNum('car_mass_kg'),
    braking: blendNum('braking'),
    acceleration: blendNum('acceleration'),
    team_pace: blendNum('team_pace'),
    attr: blendObj('attr'),
    tyre_management: blendNum('tyre_management'),
    dirty_air_sensitivity: blendNum('dirty_air_sensitivity'),
    chassis_reliability: blendNum('chassis_reliability'),
    aero_efficiency: blendNum('aero_efficiency'),
    chassis_starting_potential: blendObj('chassis_starting_potential'),
  };
}

// ---- Trait-/Persoenlichkeits-Lookup: Olys Fantasy-Traits -> feste Mod-Vokabeln. -------
// Vokabular an der echten 2026er-Referenz geprueft (322 Fahrer): racing traits
// bottlejob/cautious/clean_air_merchant/crash_happy/hotlapper/mechanic/nervous/
// overtake_artist/pay_driver/rainmaster/tyre_abuser/tyre_whisperer; personality-Vokabular
// deckt sich fast 1:1 mit unseren drei Achsen unten. Unvollstaendig by design -- alles
// ausserhalb dieser Liste faellt auf einen neutralen Default.
const RACING_TRAIT_POSITIVE = {
  motivated: 'hotlapper', fair: 'mechanic', disciplined: 'mechanic', calm: 'tyre_whisperer',
  brave: 'overtake_artist', charismatic: 'clean_air_merchant', loyal: 'mechanic', clutch: 'rainmaster',
  focused: 'tyre_whisperer', resilient: 'rainmaster',
};
const RACING_TRAIT_NEGATIVE = {
  gambler: 'crash_happy', cheater: 'bottlejob', feisty: 'nervous', reckless: 'crash_happy',
  arrogant: 'tyre_abuser', fragile: 'nervous', greedy: 'bottlejob', lazy: 'cautious',
  volatile: 'nervous', unstable: 'crash_happy',
};
const PERSONALITY_LOYALTY = {
  motivated: 'ambitious', fair: 'loyal', loyal: 'loyal', disciplined: 'loyal',
  gambler: 'short_termist', cheater: 'short_termist', greedy: 'short_termist',
};
const PERSONALITY_MOTIVATION = {
  motivated: 'ambitious', fair: 'team_player', disciplined: 'team_player', calm: 'team_player',
  charismatic: 'prestigious', gambler: 'mercenary', cheater: 'mercenary', greedy: 'mercenary',
};
const PERSONALITY_FLAVOUR = {
  motivated: 'glory_hunter', fair: 'quiet_professional', charismatic: 'media_darling',
  cheater: 'prima_donna', feisty: 'fragile_ego', gambler: 'hot_streaker',
  disciplined: 'quiet_professional', calm: 'quiet_professional',
};

function pickTrait(traitsPositive, traitsNegative, table, fallback) {
  for (const t of traitsPositive || []) {
    const hit = table[String(t).toLowerCase()];
    if (hit) return hit;
  }
  for (const t of traitsNegative || []) {
    const hit = table[String(t).toLowerCase()];
    if (hit) return hit;
  }
  return fallback;
}

// Wie pickTrait, aber verhindert, dass zwei Achsen auf denselben Tag landen, wenn beide
// Lookup-Tabellen fuer denselben Oly-Trait denselben Wert vorschlagen. Faellt dafuer auf
// die uebrige feste Vokabel-Liste der Achse zurueck.
function pickDistinctTrait(traitsPositive, traitsNegative, table, axisVocabulary, used) {
  const preferred = pickTrait(traitsPositive, traitsNegative, table, null);
  if (preferred && !used.has(preferred)) {
    used.add(preferred);
    return preferred;
  }
  const free = axisVocabulary.find((v) => !used.has(v));
  const pick = free || axisVocabulary[0];
  used.add(pick);
  return pick;
}

const LOYALTY_VOCAB = ['loyal', 'short_termist', 'security_seeker'];
const MOTIVATION_VOCAB = ['ambitious', 'team_player', 'mentor', 'mercenary', 'prestigious'];
const FLAVOUR_VOCAB = ['company_man', 'quiet_professional', 'glory_hunter', 'hot_streaker', 'fragile_ego', 'comeback_artist', 'media_darling', 'prima_donna', 'impatient'];

// Deterministischer, aber inhaltlich beliebiger Platzhalter: Oly fuehrt kein Alter.
function hashAge(playerId) {
  return 19 + (hashString(playerId) % 24);
}

// ---- Rohwerte aus ALLEN 12 Attributen -- bewusst so verteilt, dass jedes Attribut in
// mindestens einer Formel steckt und keins (insbesondere "speed") mehrfach dominiert.
function computeRawMetrics(player) {
  const a = player.attributeSheetStats || {};
  const get = (k) => Number(a[k] ?? 0);

  const cornering = 0.5 * get('dexterity') + 0.5 * get('awareness');
  const braking = 0.5 * get('awareness') + 0.5 * get('determination');
  const consistency = 0.4 * get('will') + 0.3 * get('stamina') + 0.3 * (99 - get('torment'));
  const smoothness = 0.5 * get('intelligence') + 0.5 * get('dexterity');
  const control = 0.4 * get('power') + 0.3 * get('speed') + 0.3 * get('health');
  const balance = 0.6 * get('dexterity') + 0.4 * get('charisma');
  const traction = 0.6 * get('torment') + 0.4 * (99 - get('spirit'));

  const rating = Number(player.rating) || 1;
  const potential = Number(player.potential) || rating;
  const overallRaw = cornering + braking + consistency + smoothness + control;
  const talentRaw = overallRaw * (potential / rating);

  return { cornering, braking, consistency, smoothness, control, balance, traction, talentRaw, rating, potential };
}

// ---- Perzentil-Skalierung: jede Roh-Groesse wird gegen ihre eigene Verteilung ueber die
// GESAMTE exportierte Fahrer-Population gerankt, nicht linear /99 umgerechnet -- damit
// bleibt die volle Ziel-Bandbreite (1-20 bzw. 1-99) ausgenutzt, auch wenn die gewichteten
// Roh-Werte selbst nie in die Naehe von 99 kommen.
function buildPercentileMapper(values) {
  const sorted = [...values].sort((x, y) => x - y);
  const n = sorted.length;
  return (raw) => {
    if (n <= 1) return 0.5;
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sorted[mid] < raw) lo = mid + 1;
      else hi = mid;
    }
    return lo / (n - 1);
  };
}

function makeScaler(values, lo, hi) {
  const mapper = buildPercentileMapper(values);
  return (raw) => clamp(Math.round(lo + mapper(raw) * (hi - lo)), lo, hi);
}

function buildScalers(rawList) {
  return {
    cornering: makeScaler(rawList.map((r) => r.cornering), 1, 20),
    braking: makeScaler(rawList.map((r) => r.braking), 1, 20),
    consistency: makeScaler(rawList.map((r) => r.consistency), 1, 20),
    smoothness: makeScaler(rawList.map((r) => r.smoothness), 1, 20),
    control: makeScaler(rawList.map((r) => r.control), 1, 20),
    balance: makeScaler(rawList.map((r) => r.balance), 1, 100),
    traction: makeScaler(rawList.map((r) => r.traction), 1, 100),
    talent: makeScaler(rawList.map((r) => r.talentRaw), 1, 99),
  };
}

// roleInfo: {contractLength, salary, role: 'main'|'reserve', status} oder null fuer einen
// Free Agent. Schema an der echten 2026er-Referenz kalibriert: team:null (nicht der String
// "Free Agent") + minimaler Vertrag fuer Free Agents, kein "number", kein "career_stage",
// Reserve-Fahrer bekommen zusaetzlich ein Top-Level "role": "reserve".
function mapPlayerToDriver(player, raw, scalers, teamNameForContract, roleInfo) {
  const cornering = scalers.cornering(raw.cornering);
  const braking = scalers.braking(raw.braking);
  const consistency = scalers.consistency(raw.consistency);
  const smoothness = scalers.smoothness(raw.smoothness);
  const control = scalers.control(raw.control);
  const talent = scalers.talent(raw.talentRaw);
  const balance_preference = scalers.balance(raw.balance);
  const traction_preference = scalers.traction(raw.traction);

  const racingTraitPos = pickTrait(player.traitsPositive, player.traitsNegative, RACING_TRAIT_POSITIVE, 'mechanic');
  const racingTraitNeg = pickTrait(player.traitsNegative, player.traitsPositive, RACING_TRAIT_NEGATIVE, 'cautious');
  const usedPersonalityTags = new Set();
  const loyalty = pickDistinctTrait(player.traitsPositive, player.traitsNegative, PERSONALITY_LOYALTY, LOYALTY_VOCAB, usedPersonalityTags);
  const motivation = pickDistinctTrait(player.traitsPositive, player.traitsNegative, PERSONALITY_MOTIVATION, MOTIVATION_VOCAB, usedPersonalityTags);
  const flavour = pickDistinctTrait(player.traitsPositive, player.traitsNegative, PERSONALITY_FLAVOUR, FLAVOUR_VOCAB, usedPersonalityTags);

  const entry = {
    name: player.name,
    team: teamNameForContract, // null fuer Free Agents
    cornering,
    braking,
    consistency,
    smoothness,
    control,
    balance_preference,
    traction_preference,
    age: hashAge(player.id),
    history: { seasons: 0, championships: 0, wins: 0, podiums: 0, poles: 0 },
    talent,
    traits: [racingTraitPos, racingTraitNeg],
    personality: motivation,
    personalities: [loyalty, motivation, flavour],
    nationality: 'international',
    _oly: { playerId: player.id, sourceRating: raw.rating, sourcePotential: raw.potential, className: player.className, race: player.race },
  };

  if (roleInfo) {
    entry.contract = {
      status: roleInfo.status,
      priority: roleInfo.status,
      team: teamNameForContract,
      length_weeks: roleInfo.contractLength * 52,
      salary_m: roleInfo.salary,
      start_week: 1,
      role: roleInfo.role,
    };
    if (roleInfo.role === 'reserve') entry.role = 'reserve';
  } else {
    entry.contract = { status: 'equal', priority: 'equal' };
  }

  return entry;
}

function computeTeamPrestige(identity) {
  const heritage = clamp(Math.round(((identity.ambition / 10) * 0.5 + (identity.boardConfidence / 9) * 0.5) * 100), 10, 95);
  const form = clamp(Math.round(((identity.harmony / 10) * 0.5 + (identity.cooperation / 9.73) * 0.5) * 100), 10, 95);
  const base = Math.round((heritage + form) / 2);
  return { heritage, form, base };
}

function sameLevelHeadquarters(identity) {
  const level = clamp(Math.round((identity.finances / 10) * 6), 0, 6);
  return {
    hospitality_pr_center: level,
    wind_tunnel: level,
    engine_plant: 0,
    test_track: clamp(Math.round((identity.ambition / 10) * 6), 0, 6),
    driver_centre: level,
    factory: level,
    cfd_center: level,
    recon_centre: level,
  };
}

function buildTeamCore(oly, percentile, curve, colors) {
  const template = interpolateChassis(curve, percentile);
  const prestige = computeTeamPrestige(oly.identity);
  return {
    name: oly.team.name,
    color_rgb: colors.primary,
    secondary_color_rgb: colors.secondary || colors.primary,
    heritage_prestige: prestige.heritage,
    form_prestige: prestige.form,
    prestige_base: prestige.base,
    // Beide Felder, wie in der echten 2026er-Referenz fuer JEDES Team (aktiv wie
    // inaktiv): budget_m (Olys "budget", Groessenordnung 170-325 ueber alle 32 Teams,
    // passt fast 1:1 zur realen Spanne 60-490) und starting_balance_m (Olys "cash", die
    // laufende Kriegskasse -- ein anderer Wert mit anderer Bedeutung).
    budget_m: oly.team.budget,
    starting_balance_m: Math.round(oly.team.cash * 10) / 10,
    headquarters: sameLevelHeadquarters(oly.identity),
    negotiation_points: 0,
    performance_scale: 'rating_100',
    car_mass_kg: template.car_mass_kg,
    braking: template.braking,
    acceleration: template.acceleration,
    team_pace: template.team_pace,
    attr: template.attr,
    tyre_management: template.tyre_management,
    dirty_air_sensitivity: template.dirty_air_sensitivity,
    chassis_reliability: template.chassis_reliability,
    aero_efficiency: template.aero_efficiency,
    chassis_starting_potential: template.chassis_starting_potential,
    tyre_contract: template.tyre_contract,
    engine: template.engine,
    engine_supplier: template.engine_supplier,
    engine_contract_type: template.engine_contract_type,
    engine_contract: template.engine_contract,
    ...(template.engine_contract_seasons != null ? { engine_contract_seasons: template.engine_contract_seasons } : {}),
    ...(template.engine_units_per_season != null ? { engine_units_per_season: template.engine_units_per_season } : {}),
    ...(template.engine_contract_bonus != null ? { engine_contract_bonus: template.engine_contract_bonus } : {}),
    driver_aids: template.driver_aids,
    driver_focus: template.driver_focus,
    history: { seasons: 0, championships: 0, wins: 0, podiums: 0, poles: 0 },
    difficulty: percentile < 0.25 ? 'easy' : percentile < 0.65 ? 'medium' : 'hard',
    nationality: 'international',
    _oly: { teamId: oly.team.teamId, budget: oly.team.budget, chassisTemplateBorrowedFrom: template.name },
  };
}

function buildF1Team(oly, rank, fieldSize, curve, colors) {
  const percentile = fieldSize > 1 ? rank / (fieldSize - 1) : 0;
  return {
    ...buildTeamCore(oly, percentile, curve, colors),
    active: true,
    previous_constructor_position: rank + 1,
  };
}

// Die uebrigen 16 Oly-Teams (Chris, 05.09.: alle 32 sollen rein, aber die 16 nicht
// ausgewaehlten als inaktiv -- koennen spaeter organisch dazustossen). Chris hat fuer diese
// 16 keine Reihenfolge vorgegeben, daher hier die einzige Stelle, an der wieder Olys eigene
// Prestige-Formel ueber die Chassis-Staerke entscheidet -- unter sich selbst gerankt.
function buildInactiveTeam(oly, rank, fieldSize, curve, colors, firstActiveSeason) {
  const percentile = fieldSize > 1 ? rank / (fieldSize - 1) : 0;
  return {
    ...buildTeamCore(oly, percentile, curve, colors),
    active: false,
    first_active_season: firstActiveSeason,
    previous_constructor_position: null,
  };
}

// "Organisch, nicht vollgespammt": keine gleichmaessige Kadenz, sondern eine Streuung, die
// der echten 2026er-Referenz nachempfunden ist (deren first_active_season-Werte liegen
// wild zwischen 1 und 100). Staerkere inaktive Teams koennen frueher kommen, schwaechere
// erst sehr spaet; die drei schwaechsten landen bewusst bei "praktisch nie" (Saison 90+,
// wie die 98/99/100-Eintraege im Original) -- ob sie tatsaechlich je kommen, entscheidet
// ohnehin die Mod-Simulation selbst (Pleite/Aufkauf eines aktiven Teams o.ae.), nicht wir.
function organicFirstActiveSeason(oly, rank, fieldSize) {
  if (rank >= fieldSize - 3) {
    return 90 + (hashString(oly.team.teamId) % 10);
  }
  const p = fieldSize > 1 ? rank / (fieldSize - 1) : 0;
  const jitter = (hashString(oly.team.teamId) % 5) - 2;
  return clamp(Math.round(2 + Math.pow(p, 2) * 30) + jitter, 1, 89);
}

async function exportLogos(allTeams, outDir) {
  const logosDir = path.join(outDir, 'logos');
  mkdirSync(logosDir, { recursive: true });
  const results = [];
  for (const oly of allTeams) {
    const src = path.join(TEAM_LOGOS_DIR, `${oly.team.shortCode}.jpg`);
    const dest = path.join(logosDir, `${oly.team.name}.png`);
    try {
      await sharp(src).png({ quality: 80, palette: true }).toFile(dest);
      results.push({ team: oly.team.name, logo: dest, ok: true });
    } catch (err) {
      results.push({ team: oly.team.name, logo: null, ok: false, error: String(err.message || err) });
    }
  }
  return results;
}

// Oly-Portraits liegen unter public/portraits/<slug>.jpg, wobei <slug> der Teil der
// playerId nach "player-<nummer>-" ist (z.B. "player-1413-ser-camelot" -> "ser-camelot").
async function exportPortraits(entries, outDir) {
  const dir = path.join(outDir, 'portraits');
  mkdirSync(dir, { recursive: true });
  const usedNames = new Set();
  let ok = 0;
  let missing = 0;
  for (const e of entries) {
    const m = /^player-\d+-(.+)$/.exec(e.player.id);
    const slug = m ? m[1] : null;
    const src = slug ? path.join(PLAYER_PORTRAITS_DIR, `${slug}.jpg`) : null;
    if (!src) {
      missing++;
      continue;
    }
    let filename = `${e.player.name}.png`;
    let suffix = 2;
    while (usedNames.has(filename)) {
      filename = `${e.player.name} (${suffix}).png`;
      suffix++;
    }
    try {
      await sharp(src).png({ quality: 80, palette: true }).toFile(path.join(dir, filename));
      usedNames.add(filename);
      ok++;
    } catch {
      missing++;
    }
  }
  return { ok, missing, total: entries.length };
}

async function main() {
  const { save: saveArg, outDir } = parseArgs(process.argv.slice(2));
  const db = new Database(SQLITE_PATH, { readonly: true });

  const saveId = saveArg || db.prepare('select save_id from saves order by updated_at desc limit 1').get().save_id;
  const saveRow = db.prepare('select name, updated_at from saves where save_id = ?').get(saveId);
  console.log(`Save: ${saveId} ("${saveRow?.name}", zuletzt aktualisiert ${saveRow?.updated_at})`);

  const teamRows = db.prepare('select team_id, payload_json from teams where save_id = ?').all(saveId);
  const identityRows = db.prepare('select team_id, payload_json from team_identities where save_id = ?').all(saveId);
  const rosterRows = db.prepare('select payload_json from rosters where save_id = ?').all(saveId);

  const identityByTeam = new Map(identityRows.map((r) => [r.team_id, JSON.parse(r.payload_json)]));
  const teams = teamRows
    .map((r) => JSON.parse(r.payload_json))
    .filter((t) => identityByTeam.has(t.teamId))
    .map((t) => ({ team: t, identity: identityByTeam.get(t.teamId) }));
  const teamsByName = new Map(teams.map((t) => [t.team.name, t]));

  const rosters = rosterRows.map((r) => JSON.parse(r.payload_json));
  const rostersByTeam = new Map();
  for (const r of rosters) {
    if (!rostersByTeam.has(r.teamId)) rostersByTeam.set(r.teamId, []);
    rostersByTeam.get(r.teamId).push(r);
  }

  const playerIdStmt = db.prepare('select payload_json from players where save_id = ? and player_id = ?');
  function loadPlayer(playerId) {
    const row = playerIdStmt.get(saveId, playerId);
    if (!row) return null;
    return JSON.parse(row.payload_json).player;
  }

  const missingNames = F1_TEAM_NAMES.filter((name) => !teamsByName.has(name));
  if (missingNames.length > 0) {
    console.warn(`WARNUNG: nicht im Save gefunden, wird uebersprungen: ${missingNames.join(', ')}`);
  }
  const f1Teams = F1_TEAM_NAMES.map((name) => teamsByName.get(name)).filter(Boolean);

  console.log(`Formula 1 (${f1Teams.length} Teams, in Chris' vorgegebener Staerke-Reihenfolge): ${f1Teams.map((t) => t.team.name).join(', ')}`);
  const inactiveTeams = teams
    .filter((t) => !F1_TEAM_NAMES.includes(t.team.name))
    .map((t) => ({ ...t, prestige: computeTeamPrestige(t.identity) }))
    .sort((a, b) => b.prestige.base - a.prestige.base);
  console.log(`Inaktiv, koennen organisch spaeter dazustossen (${inactiveTeams.length}): ${inactiveTeams.map((t) => t.team.name).join(', ')}`);

  // Chris will ALLE im Save eingesetzten (gerosterten) Charaktere sehen, nicht nur
  // vorbelegte Cockpits -- also erst der GESAMTE Pool ueber alle 32 Teams, danach je Team
  // die Zuordnung main/reserve/Free-Agent.
  const allEntries = [];
  for (const t of teams) {
    for (const r of rostersByTeam.get(t.team.teamId) || []) {
      const player = loadPlayer(r.playerId);
      if (!player) continue;
      allEntries.push({ teamId: t.team.teamId, roster: r, player, raw: computeRawMetrics(player) });
    }
  }
  console.log(`Spieler-Population fuer Perzentil-Skalierung: ${allEntries.length}`);

  const scalers = buildScalers(allEntries.map((e) => e.raw));
  const chassisCurve = loadChassisReferenceCurve();
  console.log(`Chassis-Referenzkurve: ${chassisCurve.length} echte 2026er-Team-Templates (team_pace ${chassisCurve[chassisCurve.length - 1].team_pace}-${chassisCurve[0].team_pace})`);

  const colorMap = loadTeamColorMap();
  const teamsJson = [];
  const driversJson = [];
  const assignedPlayerIds = new Set();

  f1Teams.forEach((oly, rank) => {
    const colors = resolveTeamColors(colorMap, oly.team.shortCode);
    teamsJson.push(buildF1Team(oly, rank, f1Teams.length, chassisCurve, colors));

    const roster = allEntries
      .filter((e) => e.teamId === oly.team.teamId)
      .sort((a, b) => scalers.talent(b.raw.talentRaw) - scalers.talent(a.raw.talentRaw));

    const carSlots = roster.slice(0, 2);
    const reserveSlots = roster.slice(2, 3);

    carSlots.forEach((slot, i) => {
      assignedPlayerIds.add(slot.player.id);
      const gap = carSlots.length > 1 ? Math.abs(scalers.talent(carSlots[0].raw.talentRaw) - scalers.talent(carSlots[1].raw.talentRaw)) : 0;
      const status = gap < 3 ? 'equal' : i === 0 ? 'first' : 'second';
      driversJson.push(
        mapPlayerToDriver(slot.player, slot.raw, scalers, oly.team.name, {
          contractLength: slot.roster.contractLength || 1,
          salary: slot.player.salaryDemand || 1,
          role: 'main',
          status,
        })
      );
    });
    reserveSlots.forEach((slot) => {
      assignedPlayerIds.add(slot.player.id);
      driversJson.push(
        mapPlayerToDriver(slot.player, slot.raw, scalers, oly.team.name, {
          contractLength: slot.roster.contractLength || 1,
          salary: slot.player.salaryDemand || 1,
          role: 'reserve',
          status: 'equal',
        })
      );
    });
  });

  inactiveTeams.forEach((oly, rank) => {
    const colors = resolveTeamColors(colorMap, oly.team.shortCode);
    const firstActiveSeason = organicFirstActiveSeason(oly, rank, inactiveTeams.length);
    teamsJson.push(buildInactiveTeam(oly, rank, inactiveTeams.length, chassisCurve, colors, firstActiveSeason));
    // Kein Kader: ein inaktives Team hat noch keine Fahrer unter Vertrag. Die Spieler
    // dieser Teams bleiben Free Agents.
  });

  for (const entry of allEntries) {
    if (assignedPlayerIds.has(entry.player.id)) continue;
    driversJson.push(mapPlayerToDriver(entry.player, entry.raw, scalers, null, null));
  }

  const talents = driversJson.map((d) => d.talent).sort((a, b) => a - b);
  console.log(`Talent-Spanne: ${talents[0]} - ${talents[talents.length - 1]} (Median ${talents[Math.floor(talents.length / 2)]})`);
  const seasons = teamsJson.filter((t) => !t.active).map((t) => t.first_active_season).sort((a, b) => a - b);
  console.log(`first_active_season der 16 inaktiven Teams: ${seasons.join(', ')}`);

  const logoResults = await exportLogos([...f1Teams, ...inactiveTeams], outDir);
  const failedLogos = logoResults.filter((r) => !r.ok);
  if (failedLogos.length > 0) {
    console.warn(`WARNUNG: Logo-Konvertierung fehlgeschlagen fuer: ${failedLogos.map((r) => `${r.team} (${r.error})`).join(', ')}`);
  }

  const portraitResults = await exportPortraits(allEntries, outDir);

  // "_oly" ist nur eine Rueckverfolgungs-Spur (welcher Save-Datensatz steckt dahinter) --
  // gehoert nicht in die Dateien, die die Mod tatsaechlich einliest.
  const stripTrace = (list) => list.map(({ _oly, ...rest }) => rest);
  const traceOf = (list) => list.map((x) => x._oly);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'teams.json'), JSON.stringify(stripTrace(teamsJson), null, '\t'));
  writeFileSync(path.join(outDir, 'drivers.json'), JSON.stringify(stripTrace(driversJson), null, '\t'));
  writeFileSync(
    path.join(outDir, 'oly-mapping-trace.json'),
    JSON.stringify({ saveId, generatedAt: new Date().toISOString(), teams: traceOf(teamsJson), drivers: traceOf(driversJson) }, null, '\t')
  );

  console.log(`\n${teamsJson.length} Teams -> ${path.join(outDir, 'teams.json')}`);
  console.log(`${driversJson.length} Fahrer (main+reserve+free_agent) -> ${path.join(outDir, 'drivers.json')}`);
  console.log(`${logoResults.filter((r) => r.ok).length}/${f1Teams.length + inactiveTeams.length} Logos -> ${path.join(outDir, 'logos')}/*.png (Car-PNG-Slot bleibt leer, kein Oly-Aequivalent)`);
  console.log(`${portraitResults.ok}/${portraitResults.total} Fahrer-Portraits -> ${path.join(outDir, 'portraits')}/*.png (${portraitResults.missing} ohne Bild in ${PLAYER_PORTRAITS_DIR})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
