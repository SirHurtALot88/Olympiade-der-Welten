// ===================================================================================
// OLY -> "Team Principal" (99er-Mod) Exporteur.
//
// Chris will seine Olympiade-Teams/Charaktere in der 1999er-Mod von "Team Principal"
// spielen. Entscheidung mit Chris (05.09.): die 32 Oly-Teams ERSETZEN das reale
// 1999er-Grid komplett; die staerksten ~11 werden die Formula-1-Konstrukteure, der Rest
// verteilt sich auf die drei nativen Access-Series-Nachwuchs-Tiers der Mod (siehe deren
// Datenbank-Sheet "Access Series [junior_series.json]": Tier 2/3/4).
//
// Woher die Zahlen kommen (12-Attribute-Skala 0-99, Team-Ratings aus prisma/schema.prisma
// bzw. den Tabellen `teams`/`team_identities` im Save):
//
//   Fahrer-Skill (0-20)   = gewichtete Attribut-Kombination, /99*20 skaliert
//     cornering    = 0.6*speed + 0.4*dexterity
//     braking      = 0.6*awareness + 0.4*dexterity
//     consistency  = 0.5*will + 0.3*stamina + 0.2*(99-torment)
//     smoothness   = 0.6*intelligence + 0.4*dexterity
//     control      = 0.5*determination + 0.3*speed + 0.2*health
//   talent (0-100)        = overall(=Summe der 5 Skills) * (potential/rating) -- nutzt Olys
//                           eigenes Potenzial/Rating-Verhaeltnis als Wachstums-Headroom
//   balance_preference    = dexterity/99*100  (geschickte Fahrer vertragen ein
//                           aggressiveres/nervoeseres Auto)
//   traction_preference   = torment/99*100    (hohe innere Anspannung -> will ein
//                           verzeihenderes, traktionsstarkes Auto)
//   Team-Prestige          = aus ambition/boardConfidence (heritage) und
//                           harmony/cooperation (form), je auf 100 skaliert
//   Team-Chassis-Physik    = KEIN Oly-Aequivalent vorhanden. Deshalb geliehen: die 11
//                           Formula-1-Teams werden nach Prestige sortiert und 1:1 auf die
//                           nach team_pace sortierte Physik-Kurve der echten 11 Basisteams
//                           (aus der hochgeladenen teams.json) gemapped -- Rang 1 bekommt
//                           die Physik von Rang 1 (McLaren-Niveau), Rang 11 die von Rang 11
//                           (Minardi-Niveau). Farbe/Reifen/Motor-Deal werden vom selben
//                           Rang mit uebernommen, nur Name/Prestige/Budget/Historie sind Oly.
//
// Das ist ein erster, nachvollziehbarer Entwurf -- KEINE endgueltige Balance-Aussage. Alle
// Annahmen (age-Heuristik, nationality="international", Trait-Lookup) sind unten markiert
// und sollen von Chris im Spiel gegengeprueft werden, bevor final importiert wird.
//
//   node scripts/export-team-principal-mod.mjs [--save <saveId>] [--out <dir>]
//
// Save-Quelle: OLY_APP_SQLITE_PATH (Default data/persistence/oly-app.sqlite), s. CLAUDE.md
// "An die Spielstaende kommen". Ohne --save wird der zuletzt aktualisierte Save genommen.
// ===================================================================================

import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SQLITE_PATH = process.env.OLY_APP_SQLITE_PATH || 'data/persistence/oly-app.sqlite';

function parseArgs(argv) {
  const out = { save: null, outDir: 'data/generated/team-principal-mod' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--save') out.save = argv[++i];
    else if (argv[i] === '--out') out.outDir = argv[++i];
  }
  return out;
}

// ---- Referenz-Physik der 11 echten 1999er-Basisteams (aus der hochgeladenen teams.json),
// hier nur die Felder, die kein Oly-Aequivalent haben. Wird zur Laufzeit nach team_pace
// absteigend sortiert, damit die Reihenfolge in der Quelldatei keine Rolle spielt.
const REFERENCE_CHASSIS_CURVE = [
  { name: 'McLaren', color_rgb: [117, 124, 128], secondary_color_rgb: [255, 255, 255], car_mass_kg: 645.0, braking: 53.0, acceleration: 52.0, team_pace: 54.0, attr: { slow: 52.5, med: 52.0, high: 52.5, straight: 54.0 }, tyre_management: 55.0, dirty_air_sensitivity: 55.4, chassis_reliability: 65.5, aero_efficiency: 1.05, chassis_starting_potential: { braking: 56.0, acceleration: 55.0, team_pace: 67.0, slow: 65.5, med: 65.0, high: 65.5, straight: 69.0, tyre_management: 58.0, dirty_air_sensitivity: 58.4, chassis_reliability: 75.5 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Mercedes', engine_supplier: 'Mercedes', engine_contract_type: 'partner', engine_contract_seasons: 3, engine_contract_bonus: 'bonus2', driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Ferrari', color_rgb: [200, 0, 0], secondary_color_rgb: [255, 255, 0], car_mass_kg: 643.0, braking: 57.0, acceleration: 53.0, team_pace: 50.0, attr: { slow: 52.4, med: 50.3, high: 50.4, straight: 49.8 }, tyre_management: 55.0, dirty_air_sensitivity: 55.4, chassis_reliability: 68.4, aero_efficiency: 1.025, chassis_starting_potential: { braking: 60.0, acceleration: 56.0, team_pace: 63.0, slow: 67.4, med: 63.3, high: 63.4, straight: 62.8, tyre_management: 58.0, dirty_air_sensitivity: 58.4, chassis_reliability: 78.4 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Ferrari', engine_contract_type: 'works', driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Winfield Williams', color_rgb: [220, 0, 0], secondary_color_rgb: [255, 255, 255], car_mass_kg: 649.0, braking: 50.0, acceleration: 50.0, team_pace: 39.3, attr: { slow: 44.1, med: 43.6, high: 44.2, straight: 47.1 }, tyre_management: 50.0, dirty_air_sensitivity: 51.9, chassis_reliability: 64.1, aero_efficiency: 1.010, chassis_starting_potential: { braking: 55.0, acceleration: 55.0, team_pace: 54.3, slow: 59.1, med: 58.6, high: 59.2, straight: 64.1, tyre_management: 55.0, dirty_air_sensitivity: 56.9, chassis_reliability: 74.1 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Supertec', engine_supplier: 'Mecachrome', engine_contract_type: 'customer', engine_contract_seasons: 1, driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Jordan', color_rgb: [241, 252, 28], secondary_color_rgb: [0, 0, 0], car_mass_kg: 646.0, braking: 51.0, acceleration: 52.0, team_pace: 44.7, attr: { slow: 47.9, med: 46.4, high: 47.2, straight: 49.7 }, tyre_management: 50.0, dirty_air_sensitivity: 54.7, chassis_reliability: 65.5, aero_efficiency: 1.035, chassis_starting_potential: { braking: 56.0, acceleration: 57.0, team_pace: 59.7, slow: 62.9, med: 61.4, high: 62.2, straight: 66.7, tyre_management: 55.0, dirty_air_sensitivity: 59.7, chassis_reliability: 75.5 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Mugen Honda', engine_supplier: 'Mugen Honda', engine_contract_type: 'partner', engine_contract_seasons: 2, engine_contract_bonus: 'bonus2', driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Benetton', color_rgb: [4, 171, 252], secondary_color_rgb: [255, 255, 255], car_mass_kg: 645.0, braking: 49.0, acceleration: 50.0, team_pace: 39.3, attr: { slow: 48.6, med: 44.9, high: 40.2, straight: 45.6 }, tyre_management: 50.0, dirty_air_sensitivity: 55.4, chassis_reliability: 68.4, aero_efficiency: 1.015, chassis_starting_potential: { braking: 54.0, acceleration: 55.0, team_pace: 54.3, slow: 65.6, med: 59.9, high: 55.2, straight: 60.6, tyre_management: 55.0, dirty_air_sensitivity: 60.4, chassis_reliability: 78.4 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Supertec', engine_supplier: 'Mecachrome', engine_contract_type: 'customer', engine_contract_seasons: 3, driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Sauber', color_rgb: [4, 110, 176], secondary_color_rgb: [255, 215, 0], car_mass_kg: 644.0, braking: 49.0, acceleration: 49.0, team_pace: 36.0, attr: { slow: 44.8, med: 43.0, high: 41.0, straight: 43.2 }, tyre_management: 47.5, dirty_air_sensitivity: 51.9, chassis_reliability: 55.4, aero_efficiency: 1.020, chassis_starting_potential: { braking: 54.0, acceleration: 54.0, team_pace: 51.0, slow: 61.8, med: 58.0, high: 56.0, straight: 58.2, tyre_management: 52.5, dirty_air_sensitivity: 56.9, chassis_reliability: 65.4 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Ferrari', engine_supplier: 'Ferrari', engine_contract_type: 'customer', engine_contract_seasons: 2, driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Repsol Arrows', color_rgb: [240, 163, 19], secondary_color_rgb: [255, 255, 255], car_mass_kg: 650.0, braking: 47.0, acceleration: 47.0, team_pace: 24.8, attr: { slow: 36.9, med: 36.3, high: 35.5, straight: 38.3 }, tyre_management: 45.0, dirty_air_sensitivity: 48.3, chassis_reliability: 44.3, aero_efficiency: 1.000, chassis_starting_potential: { braking: 52.0, acceleration: 52.0, team_pace: 39.8, slow: 51.9, med: 51.3, high: 50.5, straight: 55.3, tyre_management: 50.0, dirty_air_sensitivity: 53.3, chassis_reliability: 54.3 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Hart', engine_supplier: 'Hart', engine_contract_type: 'customer', engine_contract_seasons: 1, driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Stewart', color_rgb: [255, 255, 255], secondary_color_rgb: [0, 120, 0], car_mass_kg: 646.0, braking: 50.0, acceleration: 51.0, team_pace: 41.8, attr: { slow: 47.2, med: 46.4, high: 44.3, straight: 46.8 }, tyre_management: 47.5, dirty_air_sensitivity: 56.8, chassis_reliability: 62.6, aero_efficiency: 1.010, chassis_starting_potential: { braking: 55.0, acceleration: 56.0, team_pace: 56.8, slow: 64.2, med: 61.4, high: 59.3, straight: 61.8, tyre_management: 52.5, dirty_air_sensitivity: 61.8, chassis_reliability: 72.6 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Ford Cosworth', engine_supplier: 'Ford', engine_contract_type: 'partner', engine_contract_seasons: 3, engine_contract_bonus: 'bonus2', driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Prost', color_rgb: [32, 0, 100], secondary_color_rgb: [255, 255, 255], car_mass_kg: 647.0, braking: 49.0, acceleration: 49.0, team_pace: 38.1, attr: { slow: 44.7, med: 43.3, high: 42.0, straight: 46.5 }, tyre_management: 47.5, dirty_air_sensitivity: 54.0, chassis_reliability: 56.1, aero_efficiency: 0.950, chassis_starting_potential: { braking: 54.0, acceleration: 54.0, team_pace: 53.1, slow: 59.7, med: 58.3, high: 57.0, straight: 63.5, tyre_management: 52.5, dirty_air_sensitivity: 59.0, chassis_reliability: 66.1 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Peugeot', engine_supplier: 'Peugeot', engine_contract_type: 'partner', engine_contract_seasons: 2, engine_contract_bonus: 'bonus2', driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Minardi', color_rgb: [214, 219, 114], secondary_color_rgb: [255, 255, 255], car_mass_kg: 652.0, braking: 45.0, acceleration: 45.0, team_pace: 22.8, attr: { slow: 35.7, med: 33.2, high: 33.3, straight: 40.4 }, tyre_management: 45.0, dirty_air_sensitivity: 49.8, chassis_reliability: 47.4, aero_efficiency: 0.950, chassis_starting_potential: { braking: 52.0, acceleration: 51.0, team_pace: 37.8, slow: 50.7, med: 48.2, high: 48.3, straight: 57.4, tyre_management: 50.0, dirty_air_sensitivity: 54.8, chassis_reliability: 57.4 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Ford Cosworth', engine_supplier: 'Ford', engine_contract_type: 'customer', engine_contract_seasons: 2, driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'British American Racing', color_rgb: [59, 75, 152], secondary_color_rgb: [255, 255, 0], car_mass_kg: 646.0, braking: 49.0, acceleration: 50.0, team_pace: 37.1, attr: { slow: 45.7, med: 42.3, high: 41.8, straight: 44.6 }, tyre_management: 40.0, dirty_air_sensitivity: 55.4, chassis_reliability: 35.0, aero_efficiency: 1.020, chassis_starting_potential: { braking: 54.0, acceleration: 55.0, team_pace: 52.1, slow: 62.7, med: 57.3, high: 56.8, straight: 59.6, tyre_management: 45.0, dirty_air_sensitivity: 60.4, chassis_reliability: 46.8 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Supertec', engine_supplier: 'Mecachrome', engine_contract_type: 'customer', engine_contract_seasons: 1, driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  // Die folgenden vier sind in der Mod erst spaeter aktiv (first_active_season), liefern
  // aber vollstaendige Chassis-Templates und werden hier mitgenutzt, damit die Kurve auch
  // 16 statt nur 11 Faelle sauber abdeckt (s. Entscheidung 05.09.: 16 Oly-Teams direkt in
  // die F1, keine Access-Series-Aufteilung mehr).
  { name: 'Porsche', color_rgb: [0, 0, 0], secondary_color_rgb: [192, 0, 0], car_mass_kg: 645.0, braking: 50.0, acceleration: 50.0, team_pace: 45.0, attr: { slow: 49.0, med: 49.0, high: 49.0, straight: 49.0 }, tyre_management: 45.0, dirty_air_sensitivity: 51.9, chassis_reliability: 60.9, aero_efficiency: 1.025, chassis_starting_potential: { braking: 55.0, acceleration: 50.0, team_pace: 60.0, slow: 60.0, med: 60.0, high: 60.0, straight: 60.0, tyre_management: 50.0, dirty_air_sensitivity: 56.9, chassis_reliability: 70.9 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer' }, engine: 'Porsche', engine_contract_type: 'works', driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Toyota', color_rgb: [255, 255, 255], secondary_color_rgb: [255, 0, 0], car_mass_kg: 645.0, braking: 50.0, acceleration: 50.0, team_pace: 42.5, attr: { slow: 48.0, med: 48.0, high: 48.0, straight: 48.0 }, tyre_management: 40.0, dirty_air_sensitivity: 51.9, chassis_reliability: 64.1, aero_efficiency: 1.015, chassis_starting_potential: { braking: 55.0, acceleration: 55.0, team_pace: 57.5, slow: 59.0, med: 59.0, high: 59.0, straight: 59.0, tyre_management: 45.0, dirty_air_sensitivity: 56.9, chassis_reliability: 74.1 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer' }, engine: 'Toyota', engine_contract_type: 'works', driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Lotus', color_rgb: [156, 153, 17], secondary_color_rgb: [255, 255, 255], car_mass_kg: 650.0, braking: 50.0, acceleration: 50.0, team_pace: 40.0, attr: { slow: 47.0, med: 47.0, high: 47.0, straight: 47.0 }, tyre_management: 40.0, dirty_air_sensitivity: 51.9, chassis_reliability: 59.3, aero_efficiency: 1.025, chassis_starting_potential: { braking: 55.0, acceleration: 55.0, team_pace: 55.0, slow: 58.0, med: 58.0, high: 58.0, straight: 58.0, tyre_management: 45.0, dirty_air_sensitivity: 56.9, chassis_reliability: 69.3 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer' }, engine: 'Ford Cosworth', engine_supplier: 'Ford', engine_contract_type: 'customer', engine_contract_seasons: 1, driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Super Aguri', color_rgb: [255, 0, 0], secondary_color_rgb: [255, 255, 255], car_mass_kg: 650.0, braking: 50.0, acceleration: 50.0, team_pace: 37.5, attr: { slow: 46.0, med: 46.0, high: 46.0, straight: 46.0 }, tyre_management: 40.0, dirty_air_sensitivity: 51.9, chassis_reliability: 59.3, aero_efficiency: 0.95, chassis_starting_potential: { braking: 55.0, acceleration: 55.0, team_pace: 52.5, slow: 57.0, med: 57.0, high: 57.0, straight: 57.0, tyre_management: 45.0, dirty_air_sensitivity: 56.9, chassis_reliability: 69.3 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer' }, engine: 'Honda', engine_supplier: 'Honda', engine_contract_type: 'customer', engine_contract_seasons: 2, driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
].sort((a, b) => b.team_pace - a.team_pace);

// Entscheidung mit Chris (05.09.): keine Auto-Auswahl "staerkste zuerst" mehr, sondern
// genau diese 16 von ihm benannten Oly-Teams bilden das komplette F1-Feld. Alle anderen 16
// Oly-Teams bleiben aussen vor (Junior-Teams steigen in dieser Mod ohnehin nicht auf --
// dort wuerden nur ihre Fahrer verheizt werden, ohne dass der Teamname je in der F1
// auftaucht, s. Notiz unten zu Access Series).
const F1_TEAM_NAMES = [
  'Mayhem Mavericks', 'Zero Heroes', 'Cold Steel', 'Golden Gladiators', 'Last Ride',
  'Project Suicide', 'Raging Lunatics', 'Wrecking Legionnaires', 'Hell Raisers',
  'Silver Soldiers', 'Black Panthers', 'Nunchuck Ninjas', 'Natures Wrath', 'Death Peaches',
  'Wicked Wizards', 'Vicious & Delicious',
];

// Interpoliert an Perzentil p (0 = staerkstes Team, 1 = schwaechstes) linear zwischen den
// beiden naechstliegenden Punkten der (nach team_pace sortierten) Referenzkurve. Numerische
// Felder werden geblendet, alles andere (Farbe, Motor-/Reifendeal, Name) kommt vom naeher
// liegenden der beiden Referenzpunkte -- eine Mischfarbe oder ein "halber" Motor ergeben ja
// keinen Sinn.
function interpolateChassis(percentile) {
  const curve = REFERENCE_CHASSIS_CURVE;
  const pos = clamp(percentile, 0, 1) * (curve.length - 1);
  const i0 = Math.floor(pos);
  const i1 = Math.min(i0 + 1, curve.length - 1);
  const frac = pos - i0;
  const a = curve[i0];
  const b = curve[i1];
  const nearer = frac < 0.5 ? a : b;
  const blendNum = (key) => a[key] + (b[key] - a[key]) * frac;
  const blendObj = (key) => {
    const out = {};
    for (const k of Object.keys(a[key])) out[k] = blendNum2(a[key][k], b[key][k], frac);
    return out;
  };
  const blendNum2 = (x, y, f) => x + (y - x) * f;
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

// ---- Trait-/Persoenlichkeits-Lookup: Olys Fantasy-Traits -> feste Mod-Vokabeln.
// Unvollstaendig by design -- alles ausserhalb dieser Liste faellt auf einen neutralen
// Default. Chris kennt die volle Trait-Liste aus references/ besser als ich; diese Tabelle
// ist ein erster Vorschlag zum Gegenlesen, keine Wahrheit.
const RACING_TRAIT_POSITIVE = {
  motivated: 'hotlapper', fair: 'mechanic', disciplined: 'mechanic', calm: 'tyre_whisperer',
  brave: 'hotlapper', charismatic: 'clean_air_merchant', loyal: 'mechanic', clutch: 'rainmaster',
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

// Wie pickTrait, aber verhindert, dass zwei Achsen (z.B. Loyalitaet und Motivation) auf
// denselben Tag landen, wenn beide Lookup-Tabellen fuer denselben Oly-Trait denselben Wert
// vorschlagen. Faellt dafuer auf die uebrige feste Vokabel-Liste der Achse zurueck.
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

// Deterministischer, aber inhaltlich beliebiger Platzhalter: Oly fuehrt kein Alter. Ein
// Versuch, das Alter aus der Potential/Rating-Luecke abzuleiten, ist in diesem Save fast
// ueberall auf denselben Wert entartet (nur 3 verschiedene Luecken ueber 328 Spieler), war
// also Scheingenauigkeit. Hash sorgt wenigstens fuer Streuung 19-42 statt eines Konstanten.
function hashAge(playerId) {
  let h = 0;
  for (let i = 0; i < playerId.length; i++) h = (h * 31 + playerId.charCodeAt(i)) >>> 0;
  return 19 + (h % 24);
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function scale0to20(raw) {
  return clamp(Math.round((raw / 99) * 20), 1, 20);
}

function scale0to100(raw) {
  return clamp(Math.round((raw / 99) * 100), 1, 100);
}

// roleInfo: {number, contractLength, salary, role: 'main'|'reserve', status}. Alle Fahrer
// in diesem Export sind F1-Kader (die 16 anderen Oly-Teams fallen raus, s. main()), daher
// hier immer gesetzt.
function mapPlayerToDriver(player, teamNameForContract, roleInfo) {
  const a = player.attributeSheetStats || {};
  const get = (k) => Number(a[k] ?? 0);

  const cornering = scale0to20(0.6 * get('speed') + 0.4 * get('dexterity'));
  const braking = scale0to20(0.6 * get('awareness') + 0.4 * get('dexterity'));
  const consistency = scale0to20(0.5 * get('will') + 0.3 * get('stamina') + 0.2 * (99 - get('torment')));
  const smoothness = scale0to20(0.6 * get('intelligence') + 0.4 * get('dexterity'));
  const control = scale0to20(0.5 * get('determination') + 0.3 * get('speed') + 0.2 * get('health'));
  const overall = cornering + braking + consistency + smoothness + control;

  const rating = Number(player.rating) || 1;
  const potential = Number(player.potential) || rating;
  const talent = clamp(Math.round(overall * (potential / rating)), overall, 99);

  const balance_preference = scale0to100(get('dexterity'));
  const traction_preference = scale0to100(get('torment'));

  const racingTraitPos = pickTrait(player.traitsPositive, player.traitsNegative, RACING_TRAIT_POSITIVE, 'mechanic');
  const racingTraitNeg = pickTrait(player.traitsNegative, player.traitsPositive, RACING_TRAIT_NEGATIVE, 'cautious');
  const usedPersonalityTags = new Set();
  const loyalty = pickDistinctTrait(player.traitsPositive, player.traitsNegative, PERSONALITY_LOYALTY, LOYALTY_VOCAB, usedPersonalityTags);
  const motivation = pickDistinctTrait(player.traitsPositive, player.traitsNegative, PERSONALITY_MOTIVATION, MOTIVATION_VOCAB, usedPersonalityTags);
  const flavour = pickDistinctTrait(player.traitsPositive, player.traitsNegative, PERSONALITY_FLAVOUR, FLAVOUR_VOCAB, usedPersonalityTags);

  const age = hashAge(player.id);

  const entry = {
    name: player.name,
    team: teamNameForContract,
    cornering,
    braking,
    consistency,
    smoothness,
    control,
    balance_preference,
    traction_preference,
    age,
    history: { seasons: 0, championships: 0, wins: 0, podiums: 0, poles: 0 },
    talent,
    traits: [racingTraitPos, racingTraitNeg],
    personalities: [loyalty, motivation, flavour],
    // Bewusst grob: die feine Karrierestufen-Vokabel der Mod ("top_veteran",
    // "legendary_veteran" etc.) laesst sich ohne eine Alters-/Historiengrundlage aus Oly
    // nicht seriaes treffen. Talent 15-79 in diesem Save bleibt durchgaengig unter dem
    // realen 1999er-Feld (60-99) -- "top_racer" o.ae. waere hier Scheingenauigkeit.
    career_stage: roleInfo.role === 'reserve' ? 'reserve_driver' : 'racer',
    nationality: 'international',
    number: roleInfo.number,
    contract: {
      team: teamNameForContract,
      length_weeks: roleInfo.contractLength * 52,
      salary_m: roleInfo.salary,
      start_week: 1,
      role: roleInfo.role,
      status: roleInfo.status,
      priority: roleInfo.status,
    },
    _oly: { playerId: player.id, sourceRating: rating, sourcePotential: potential, className: player.className, race: player.race },
  };

  return entry;
}

function computeTeamPrestige(identity) {
  const heritage = clamp(Math.round(((identity.ambition / 10) * 0.5 + (identity.boardConfidence / 9) * 0.5) * 100), 10, 95);
  const form = clamp(Math.round(((identity.harmony / 10) * 0.5 + (identity.cooperation / 9.73) * 0.5) * 100), 10, 95);
  const base = Math.round((heritage + form) / 2);
  return { heritage, form, base };
}

function buildF1Team(oly, rank, fieldSize) {
  const percentile = fieldSize > 1 ? rank / (fieldSize - 1) : 0;
  const template = interpolateChassis(percentile);
  const prestige = computeTeamPrestige(oly.identity);
  return {
    name: oly.team.name,
    active: true,
    color_rgb: template.color_rgb,
    secondary_color_rgb: template.secondary_color_rgb,
    heritage_prestige: prestige.heritage,
    form_prestige: prestige.form,
    prestige_base: prestige.base,
    starting_balance_m: Math.round(oly.team.cash * 10) / 10,
    headquarters: sameLevelHeadquarters(oly.identity),
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
    engine_contract_seasons: template.engine_contract_seasons,
    engine_contract_bonus: template.engine_contract_bonus,
    driver_aids: template.driver_aids,
    driver_focus: template.driver_focus,
    history: { seasons: 0, championships: 0, wins: 0, podiums: 0, poles: 0 },
    difficulty: percentile < 0.25 ? 'easy' : percentile < 0.65 ? 'medium' : 'hard',
    nationality: 'international',
    previous_constructor_position: rank + 1,
    _oly: { teamId: oly.team.teamId, budget: oly.team.budget, chassisTemplateBorrowedFrom: template.name },
  };
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

function main() {
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

  const missingNames = F1_TEAM_NAMES.filter((name) => !teams.some((t) => t.team.name === name));
  if (missingNames.length > 0) {
    console.warn(`WARNUNG: nicht im Save gefunden, wird uebersprungen: ${missingNames.join(', ')}`);
  }

  // Innerhalb der von Chris fest vorgegebenen 16 Teams trotzdem nach Prestige ranken --
  // das steuert nur, welches der 16 die staerkste/schwaechste Chassis-Kurve bekommt, nicht
  // ob ein Team ueberhaupt dabei ist.
  const f1Teams = teams
    .filter((t) => F1_TEAM_NAMES.includes(t.team.name))
    .map((t) => ({ ...t, prestige: computeTeamPrestige(t.identity) }))
    .sort((a, b) => b.prestige.base - a.prestige.base);

  console.log(`Formula 1 (${f1Teams.length} Teams): ${f1Teams.map((t) => t.team.name).join(', ')}`);
  console.log(`Nicht uebersetzt (bleiben aussen vor): ${teams.filter((t) => !F1_TEAM_NAMES.includes(t.team.name)).map((t) => t.team.name).join(', ')}`);

  const teamsJson = [];
  const driversJson = [];

  f1Teams.forEach((oly, rank) => {
    teamsJson.push(buildF1Team(oly, rank, f1Teams.length));

    const roster = (rostersByTeam.get(oly.team.teamId) || [])
      .map((r) => ({ roster: r, player: loadPlayer(r.playerId) }))
      .filter((x) => x.player)
      .sort((a, b) => (b.player.rating || 0) - (a.player.rating || 0));

    const carSlots = roster.slice(0, 2);
    const reserveSlots = roster.slice(2, 3);

    carSlots.forEach((slot, i) => {
      const gap = carSlots.length > 1 ? Math.abs((carSlots[0].player.rating || 0) - (carSlots[1].player.rating || 0)) : 0;
      const status = gap < 3 ? 'equal' : i === 0 ? 'first' : 'second';
      driversJson.push(
        mapPlayerToDriver(slot.player, oly.team.name, {
          number: rank * 2 + i + 1,
          contractLength: slot.roster.contractLength || 1,
          salary: slot.player.salaryDemand || 1,
          role: 'main',
          status,
        })
      );
    });
    reserveSlots.forEach((slot) => {
      driversJson.push(
        mapPlayerToDriver(slot.player, oly.team.name, {
          number: null,
          contractLength: slot.roster.contractLength || 1,
          salary: slot.player.salaryDemand || 1,
          role: 'reserve',
          status: 'equal',
        })
      );
    });
  });

  // Entscheidung mit Chris (05.09.): die uebrigen 16 Oly-Teams (und ihre Kader) fallen fuer
  // diesen ersten Wurf komplett raus -- Junior-Teams steigen in dieser Mod ohnehin nicht
  // als Team auf (nur einzelne Fahrer werden befoerdert, s. Skript-Kopfkommentar), es gibt
  // also keinen Access-Series-Bucket mehr zu befuellen.

  // "_oly" ist nur eine Rueckverfolgungs-Spur (welcher Save-Datensatz steckt dahinter) --
  // gehoert nicht in die Dateien, die die Mod tatsaechlich einliest.
  const stripTrace = (list) =>
    list.map(({ _oly, ...rest }) => rest);
  const traceOf = (list) => list.map((x) => x._oly);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'teams.json'), JSON.stringify(stripTrace(teamsJson), null, '\t'));
  writeFileSync(path.join(outDir, 'drivers.json'), JSON.stringify(stripTrace(driversJson), null, '\t'));
  writeFileSync(
    path.join(outDir, 'oly-mapping-trace.json'),
    JSON.stringify({ saveId, generatedAt: new Date().toISOString(), teams: traceOf(teamsJson), drivers: traceOf(driversJson) }, null, '\t')
  );

  console.log(`\n${teamsJson.length} Teams -> ${path.join(outDir, 'teams.json')}`);
  console.log(`${driversJson.length} Fahrer (main+reserve) -> ${path.join(outDir, 'drivers.json')}`);
}

main();
