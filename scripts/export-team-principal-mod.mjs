// ===================================================================================
// OLY -> "Team Principal" (99er-Mod) Exporteur.
//
// Chris will seine Olympiade-Teams/Charaktere in der 1999er-Mod von "Team Principal"
// spielen. Entscheidung mit Chris (05.09.): 16 von ihm benannte Oly-Teams ersetzen das
// reale 1999er-Grid komplett und bilden das F1-Feld, in GENAU der Staerke-Reihenfolge, die
// er vorgegeben hat (Index 0 = staerkstes Team). ALLE 32 Oly-Teams landen in teams.json --
// die uebrigen 16 als "active: false" mit first_active_season (koennen laut Chris spaeter
// dazustossen, genau das Muster, das die Mod selbst fuer Porsche/Toyota/Lotus/Super Aguri im
// echten 1999er-Feld nutzt). Sie haben noch keinen eigenen Kader (Junior-Teams steigen in
// dieser Mod nicht als Team auf, s. unten) -- ALLE ihre Spieler kommen trotzdem als Free
// Agents mit rein, Chris wollte zum Testen die komplette Save-Besetzung sehen, nicht nur 48
// vorbelegte Cockpits.
//
// Woher die Zahlen kommen:
//
//   Fahrer-Skill/Talent: gewichtete Kombination aus ALLEN 12 Oly-Attributen (0-99), dann
//   PERZENTIL-skaliert -- nicht linear /99*20. Grund: die gewichteten Rohwerte erreichen in
//   diesem Save selten die Naehe von 99 (siehe erster Entwurf: talent blieb durchgaengig
//   unter 80). Ein Perzentil-Ranking innerhalb der tatsaechlich exportierten Population
//   garantiert echte Sternfahrer (~90er) UND echte Hinterbaenkler (<10), unabhaengig davon,
//   wie gestaucht die Roh-Attribute sind -- das ist dieselbe Idee wie die rho-Abnahme, mit
//   der dieses Projekt seine Disziplinen misst (s. CLAUDE.md): nicht der Rohwert zaehlt,
//   sondern die Position in der Verteilung.
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
//   Jede der acht Roh-Groessen wird EINZELN ueber die komplette exportierte Fahrer-Population
//   perzentil-skaliert (cornering/braking/consistency/smoothness/control -> 1-20,
//   balance/traction -> 1-100, talent -> 1-99). Alle 12 Attribute fliessen mit ein --
//   "speed" taucht bewusst nur EINMAL auf (in control), damit nicht nur schnelle Spieler
//   ueberall vorne liegen.
//
//   Team-Prestige      = aus den Oly-Team-Ratings (ambition/boardConfidence -> heritage,
//                        harmony/cooperation -> form), unabhaengig von der Grid-Reihenfolge.
//   starting_balance_m = Olys eigenes cash-Feld (Save-Wirtschaft, keine Umrechnung).
//   Farben             = ECHTE Oly-Team-Farben aus lib/foundation/team-colors.ts (HSL ->
//                        RGB konvertiert) -- keine geliehenen 1999er-Farben mehr.
//   Team-Logo          = ECHTE Oly-Logos aus public/team-logos/<shortCode>.jpg, als PNG
//                        neben teams.json/drivers.json abgelegt (die Mod importiert Bilder
//                        nicht ueber die JSON-Dateien, sondern ueber den Roster-Editor "Team
//                        Logo"-Upload-Slot -- s. Notiz am Ende von main()). Fuer den "Car
//                        PNG"-Slot (2:1, Wagen-Lackierung) gibt es kein Oly-Aequivalent.
//   Chassis-Physik     = KEIN Oly-Aequivalent vorhanden. Deshalb geliehen: die 16 F1-Teams
//                        werden -- in der von Chris vorgegebenen Reihenfolge, NICHT nach
//                        Oly-Prestige neu sortiert -- per Perzentil auf eine nach team_pace
//                        sortierte Physik-Kurve aus 15 echten 1999er-Team-Templates gemappt.
//                        Nur Chassis-Zahlen/Reifen-/Motor-Deal kommen von dort, Farbe/Name/
//                        Prestige/Budget/Historie sind komplett Oly.
//
// Das ist ein Entwurf -- KEINE endgueltige Balance-Aussage. Alle Annahmen (age-Heuristik,
// nationality="international", Trait-Lookup, Free-Agent-Schema unten) sind markiert und
// sollen von Chris im Spiel gegengeprueft werden, bevor final importiert wird.
//
// Junior-Teams steigen in dieser Mod nicht als Team in die F1 auf (nachgeprueft in der
// Mod-Datenbank: "Driver Development [config.json]" kennt nur individuelle Wachstums-
// Multiplikatoren je Serie fuer FAHRER, keine Team-Beforderung) -- deshalb keine
// Access-Series-Aufteilung mehr, sondern direkt 16 Oly-Teams als komplettes F1-Feld.
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

// ---- Echte Oly-Team-Farben statt geliehener 1999er-Farben -----------------------------
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
    let h = 0;
    for (let i = 0; i < shortCode.length; i++) h = (h * 31 + shortCode.charCodeAt(i)) & 0xffff;
    const hue = Math.round((h * 137.508) % 360);
    return { primary: hslStringToRgb(`hsl(${hue} 58% 55%)`), secondary: null };
  }
  return {
    primary: hslStringToRgb(entry.primary),
    secondary: entry.secondary ? hslStringToRgb(entry.secondary) : null,
  };
}

// ---- Referenz-Physik von 15 echten 1999er-Team-Templates (11 Basisteams + 4 spaeter
// aktive Werksteams aus derselben Mod-Datenbank), nur die Felder ohne Oly-Aequivalent.
// Wird nach team_pace absteigend sortiert, damit die Reihenfolge unten keine Rolle spielt.
const REFERENCE_CHASSIS_CURVE = [
  { name: 'McLaren', car_mass_kg: 645.0, braking: 53.0, acceleration: 52.0, team_pace: 54.0, attr: { slow: 52.5, med: 52.0, high: 52.5, straight: 54.0 }, tyre_management: 55.0, dirty_air_sensitivity: 55.4, chassis_reliability: 65.5, aero_efficiency: 1.05, chassis_starting_potential: { braking: 56.0, acceleration: 55.0, team_pace: 67.0, slow: 65.5, med: 65.0, high: 65.5, straight: 69.0, tyre_management: 58.0, dirty_air_sensitivity: 58.4, chassis_reliability: 75.5 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Mercedes', engine_supplier: 'Mercedes', engine_contract_type: 'partner', engine_contract_seasons: 3, engine_contract_bonus: 'bonus2', driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Ferrari', car_mass_kg: 643.0, braking: 57.0, acceleration: 53.0, team_pace: 50.0, attr: { slow: 52.4, med: 50.3, high: 50.4, straight: 49.8 }, tyre_management: 55.0, dirty_air_sensitivity: 55.4, chassis_reliability: 68.4, aero_efficiency: 1.025, chassis_starting_potential: { braking: 60.0, acceleration: 56.0, team_pace: 63.0, slow: 67.4, med: 63.3, high: 63.4, straight: 62.8, tyre_management: 58.0, dirty_air_sensitivity: 58.4, chassis_reliability: 78.4 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Ferrari', engine_contract_type: 'works', driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Winfield Williams', car_mass_kg: 649.0, braking: 50.0, acceleration: 50.0, team_pace: 39.3, attr: { slow: 44.1, med: 43.6, high: 44.2, straight: 47.1 }, tyre_management: 50.0, dirty_air_sensitivity: 51.9, chassis_reliability: 64.1, aero_efficiency: 1.010, chassis_starting_potential: { braking: 55.0, acceleration: 55.0, team_pace: 54.3, slow: 59.1, med: 58.6, high: 59.2, straight: 64.1, tyre_management: 55.0, dirty_air_sensitivity: 56.9, chassis_reliability: 74.1 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Supertec', engine_supplier: 'Mecachrome', engine_contract_type: 'customer', engine_contract_seasons: 1, driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Jordan', car_mass_kg: 646.0, braking: 51.0, acceleration: 52.0, team_pace: 44.7, attr: { slow: 47.9, med: 46.4, high: 47.2, straight: 49.7 }, tyre_management: 50.0, dirty_air_sensitivity: 54.7, chassis_reliability: 65.5, aero_efficiency: 1.035, chassis_starting_potential: { braking: 56.0, acceleration: 57.0, team_pace: 59.7, slow: 62.9, med: 61.4, high: 62.2, straight: 66.7, tyre_management: 55.0, dirty_air_sensitivity: 59.7, chassis_reliability: 75.5 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Mugen Honda', engine_supplier: 'Mugen Honda', engine_contract_type: 'partner', engine_contract_seasons: 2, engine_contract_bonus: 'bonus2', driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Benetton', car_mass_kg: 645.0, braking: 49.0, acceleration: 50.0, team_pace: 39.3, attr: { slow: 48.6, med: 44.9, high: 40.2, straight: 45.6 }, tyre_management: 50.0, dirty_air_sensitivity: 55.4, chassis_reliability: 68.4, aero_efficiency: 1.015, chassis_starting_potential: { braking: 54.0, acceleration: 55.0, team_pace: 54.3, slow: 65.6, med: 59.9, high: 55.2, straight: 60.6, tyre_management: 55.0, dirty_air_sensitivity: 60.4, chassis_reliability: 78.4 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Supertec', engine_supplier: 'Mecachrome', engine_contract_type: 'customer', engine_contract_seasons: 3, driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Sauber', car_mass_kg: 644.0, braking: 49.0, acceleration: 49.0, team_pace: 36.0, attr: { slow: 44.8, med: 43.0, high: 41.0, straight: 43.2 }, tyre_management: 47.5, dirty_air_sensitivity: 51.9, chassis_reliability: 55.4, aero_efficiency: 1.020, chassis_starting_potential: { braking: 54.0, acceleration: 54.0, team_pace: 51.0, slow: 61.8, med: 58.0, high: 56.0, straight: 58.2, tyre_management: 52.5, dirty_air_sensitivity: 56.9, chassis_reliability: 65.4 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Ferrari', engine_supplier: 'Ferrari', engine_contract_type: 'customer', engine_contract_seasons: 2, driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Repsol Arrows', car_mass_kg: 650.0, braking: 47.0, acceleration: 47.0, team_pace: 24.8, attr: { slow: 36.9, med: 36.3, high: 35.5, straight: 38.3 }, tyre_management: 45.0, dirty_air_sensitivity: 48.3, chassis_reliability: 44.3, aero_efficiency: 1.000, chassis_starting_potential: { braking: 52.0, acceleration: 52.0, team_pace: 39.8, slow: 51.9, med: 51.3, high: 50.5, straight: 55.3, tyre_management: 50.0, dirty_air_sensitivity: 53.3, chassis_reliability: 54.3 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Hart', engine_supplier: 'Hart', engine_contract_type: 'customer', engine_contract_seasons: 1, driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Stewart', car_mass_kg: 646.0, braking: 50.0, acceleration: 51.0, team_pace: 41.8, attr: { slow: 47.2, med: 46.4, high: 44.3, straight: 46.8 }, tyre_management: 47.5, dirty_air_sensitivity: 56.8, chassis_reliability: 62.6, aero_efficiency: 1.010, chassis_starting_potential: { braking: 55.0, acceleration: 56.0, team_pace: 56.8, slow: 64.2, med: 61.4, high: 59.3, straight: 61.8, tyre_management: 52.5, dirty_air_sensitivity: 61.8, chassis_reliability: 72.6 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Ford Cosworth', engine_supplier: 'Ford', engine_contract_type: 'partner', engine_contract_seasons: 3, engine_contract_bonus: 'bonus2', driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Prost', car_mass_kg: 647.0, braking: 49.0, acceleration: 49.0, team_pace: 38.1, attr: { slow: 44.7, med: 43.3, high: 42.0, straight: 46.5 }, tyre_management: 47.5, dirty_air_sensitivity: 54.0, chassis_reliability: 56.1, aero_efficiency: 0.950, chassis_starting_potential: { braking: 54.0, acceleration: 54.0, team_pace: 53.1, slow: 59.7, med: 58.3, high: 57.0, straight: 63.5, tyre_management: 52.5, dirty_air_sensitivity: 59.0, chassis_reliability: 66.1 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Peugeot', engine_supplier: 'Peugeot', engine_contract_type: 'partner', engine_contract_seasons: 2, engine_contract_bonus: 'bonus2', driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Minardi', car_mass_kg: 652.0, braking: 45.0, acceleration: 45.0, team_pace: 22.8, attr: { slow: 35.7, med: 33.2, high: 33.3, straight: 40.4 }, tyre_management: 45.0, dirty_air_sensitivity: 49.8, chassis_reliability: 47.4, aero_efficiency: 0.950, chassis_starting_potential: { braking: 52.0, acceleration: 51.0, team_pace: 37.8, slow: 50.7, med: 48.2, high: 48.3, straight: 57.4, tyre_management: 50.0, dirty_air_sensitivity: 54.8, chassis_reliability: 57.4 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Ford Cosworth', engine_supplier: 'Ford', engine_contract_type: 'customer', engine_contract_seasons: 2, driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'British American Racing', car_mass_kg: 646.0, braking: 49.0, acceleration: 50.0, team_pace: 37.1, attr: { slow: 45.7, med: 42.3, high: 41.8, straight: 44.6 }, tyre_management: 40.0, dirty_air_sensitivity: 55.4, chassis_reliability: 35.0, aero_efficiency: 1.020, chassis_starting_potential: { braking: 54.0, acceleration: 55.0, team_pace: 52.1, slow: 62.7, med: 57.3, high: 56.8, straight: 59.6, tyre_management: 45.0, dirty_air_sensitivity: 60.4, chassis_reliability: 46.8 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer', start_season: 1, expires_season: 2 }, engine: 'Supertec', engine_supplier: 'Mecachrome', engine_contract_type: 'customer', engine_contract_seasons: 1, driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Porsche', car_mass_kg: 645.0, braking: 50.0, acceleration: 50.0, team_pace: 45.0, attr: { slow: 49.0, med: 49.0, high: 49.0, straight: 49.0 }, tyre_management: 45.0, dirty_air_sensitivity: 51.9, chassis_reliability: 60.9, aero_efficiency: 1.025, chassis_starting_potential: { braking: 55.0, acceleration: 50.0, team_pace: 60.0, slow: 60.0, med: 60.0, high: 60.0, straight: 60.0, tyre_management: 50.0, dirty_air_sensitivity: 56.9, chassis_reliability: 70.9 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer' }, engine: 'Porsche', engine_contract_type: 'works', driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Toyota', car_mass_kg: 645.0, braking: 50.0, acceleration: 50.0, team_pace: 42.5, attr: { slow: 48.0, med: 48.0, high: 48.0, straight: 48.0 }, tyre_management: 40.0, dirty_air_sensitivity: 51.9, chassis_reliability: 64.1, aero_efficiency: 1.015, chassis_starting_potential: { braking: 55.0, acceleration: 55.0, team_pace: 57.5, slow: 59.0, med: 59.0, high: 59.0, straight: 59.0, tyre_management: 45.0, dirty_air_sensitivity: 56.9, chassis_reliability: 74.1 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer' }, engine: 'Toyota', engine_contract_type: 'works', driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Lotus', car_mass_kg: 650.0, braking: 50.0, acceleration: 50.0, team_pace: 40.0, attr: { slow: 47.0, med: 47.0, high: 47.0, straight: 47.0 }, tyre_management: 40.0, dirty_air_sensitivity: 51.9, chassis_reliability: 59.3, aero_efficiency: 1.025, chassis_starting_potential: { braking: 55.0, acceleration: 55.0, team_pace: 55.0, slow: 58.0, med: 58.0, high: 58.0, straight: 58.0, tyre_management: 45.0, dirty_air_sensitivity: 56.9, chassis_reliability: 69.3 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer' }, engine: 'Ford Cosworth', engine_supplier: 'Ford', engine_contract_type: 'customer', engine_contract_seasons: 1, driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
  { name: 'Super Aguri', car_mass_kg: 650.0, braking: 50.0, acceleration: 50.0, team_pace: 37.5, attr: { slow: 46.0, med: 46.0, high: 46.0, straight: 46.0 }, tyre_management: 40.0, dirty_air_sensitivity: 51.9, chassis_reliability: 59.3, aero_efficiency: 0.95, chassis_starting_potential: { braking: 55.0, acceleration: 55.0, team_pace: 52.5, slow: 57.0, med: 57.0, high: 57.0, straight: 57.0, tyre_management: 45.0, dirty_air_sensitivity: 56.9, chassis_reliability: 69.3 }, tyre_contract: { supplier: 'Bridgestone', type: 'customer' }, engine: 'Honda', engine_supplier: 'Honda', engine_contract_type: 'customer', engine_contract_seasons: 2, driver_aids: { active_suspension: 0, active_aero: 0, traction_control: 0, abs: 0, advanced_tpms: 0 }, driver_focus: { cornering: 20, braking: 20, consistency: 20, smoothness: 20, control: 20 } },
].sort((a, b) => b.team_pace - a.team_pace);

// Chris' vorgegebene Reihenfolge (05.09., ueberarbeitet): Index 0 ist das staerkste Team,
// letzter Index das schwaechste. Das steuert NUR die geliehene Chassis-Physik-Kurve, nicht
// Prestige/Budget (die bleiben Oly-eigen).
const F1_TEAM_NAMES = [
  'Mayhem Mavericks', 'Zero Heroes', 'Cold Steel', 'Golden Gladiators', 'Last Ride',
  'Project Suicide', 'Raging Lunatics', 'Wrecking Legionnaires', 'Hell Raisers',
  'Silver Soldiers', 'Black Panthers', 'Nunchuck Ninjas', 'Natures Wrath', 'Death Peaches',
  'Wicked Wizards', 'Vicious & Delicious',
];

// Interpoliert an Perzentil p (0 = staerkstes Team, 1 = schwaechstes) linear zwischen den
// beiden naechstliegenden Punkten der Referenzkurve. Numerische Felder werden geblendet,
// alles andere (Motor-/Reifendeal, Name) kommt vom naeher liegenden Referenzpunkt.
function interpolateChassis(percentile) {
  const curve = REFERENCE_CHASSIS_CURVE;
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
// Unvollstaendig by design -- alles ausserhalb dieser Liste faellt auf einen neutralen
// Default. Ein erster Vorschlag zum Gegenlesen, keine Wahrheit.
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
  let h = 0;
  for (let i = 0; i < playerId.length; i++) h = (h * 31 + playerId.charCodeAt(i)) >>> 0;
  return 19 + (h % 24);
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
// GESAMTE exportierte Fahrer-Population gerankt, nicht linear /99 umgerechnet. So bleibt die
// volle Ziel-Bandbreite (1-20 bzw. 1-99) auch dann ausgenutzt, wenn die gewichteten
// Roh-Werte selbst nie in die Naehe von 99 kommen -- exakt Chris' Wunsch nach echten
// 90er-Stars UND echten <10-Nieten.
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

// roleInfo: {number, contractLength, salary, role: 'main'|'reserve', status} oder null fuer
// einen Free Agent (Spieler aus einem der 16 nicht uebersetzten Oly-Teams, oder ueberzaehlig
// im Kader eines F1-Teams). Free-Agent-Schema ist ein Best-Guess (die Mod-Datenbank zeigt
// z.B. "Jos Verstappen ... Free Agent" ohne Startnummer/Vertrag in der Drivers-Skills-
// Tabelle, aber keine vollstaendige Feldliste) -- im Spiel gegenpruefen.
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
    team: teamNameForContract,
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
    personalities: [loyalty, motivation, flavour],
    career_stage: !roleInfo ? 'free_agent' : roleInfo.role === 'reserve' ? 'reserve_driver' : 'racer',
    nationality: 'international',
    _oly: { playerId: player.id, sourceRating: raw.rating, sourcePotential: raw.potential, className: player.className, race: player.race },
  };

  if (roleInfo) {
    entry.number = roleInfo.number;
    entry.contract = {
      team: teamNameForContract,
      length_weeks: roleInfo.contractLength * 52,
      salary_m: roleInfo.salary,
      start_week: 1,
      role: roleInfo.role,
      status: roleInfo.status,
      priority: roleInfo.status,
    };
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

function buildF1Team(oly, rank, fieldSize, colors) {
  const percentile = fieldSize > 1 ? rank / (fieldSize - 1) : 0;
  const template = interpolateChassis(percentile);
  const prestige = computeTeamPrestige(oly.identity);
  return {
    name: oly.team.name,
    active: true,
    color_rgb: colors.primary,
    secondary_color_rgb: colors.secondary || colors.primary,
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

// Die uebrigen 16 Oly-Teams (Chris, 05.09.: "moechte dass du die restlichen 16 Teams auch
// einbaust, allerdings sind die dann inactive... aber koennen spaeter dazu stossen"). Genau
// das Muster, das die Mod selbst fuer Porsche/Toyota/Lotus/Super Aguri im echten 1999er-Feld
// nutzt: active:false + first_active_season, budget_m statt starting_balance_m, kein
// previous_constructor_position/difficulty, tyre_contract ohne start/expires_season (noch
// kein laufender Reifenvertrag). Chris hat fuer diese 16 keine Reihenfolge vorgegeben, daher
// hier die einzige Stelle, an der wieder Olys eigene Prestige-Formel ueber die Chassis-Staerke
// entscheidet -- unter sich selbst gerankt, nicht gegen die F1-Teams.
function buildInactiveTeam(oly, rank, fieldSize, colors, firstActiveSeason) {
  const percentile = fieldSize > 1 ? rank / (fieldSize - 1) : 0;
  const template = interpolateChassis(percentile);
  const prestige = computeTeamPrestige(oly.identity);
  return {
    name: oly.team.name,
    active: false,
    first_active_season: firstActiveSeason,
    color_rgb: colors.primary,
    secondary_color_rgb: colors.secondary || colors.primary,
    heritage_prestige: prestige.heritage,
    form_prestige: prestige.form,
    prestige_base: prestige.base,
    // Olys "budget"-Feld liegt ueber alle 32 Teams zwischen 170 und 325 -- praktisch
    // dieselbe Groessenordnung wie die budget_m-Werte der echten inaktiven Zukunftsteams
    // (Porsche 350, Toyota 400, Lotus 200, Super Aguri 140). Deshalb unskaliert uebernommen,
    // anders als starting_balance_m oben (das ist Olys "cash", die laufende Kriegskasse
    // eines bereits aktiven Teams -- ein anderer Wert mit anderer Bedeutung).
    budget_m: oly.team.budget,
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
    tyre_contract: { supplier: template.tyre_contract.supplier, type: template.tyre_contract.type },
    engine: template.engine,
    engine_supplier: template.engine_supplier,
    engine_contract_type: template.engine_contract_type,
    engine_contract_seasons: template.engine_contract_seasons,
    engine_contract_bonus: template.engine_contract_bonus,
    driver_aids: template.driver_aids,
    driver_focus: template.driver_focus,
    history: { seasons: 0, championships: 0, wins: 0, podiums: 0, poles: 0 },
    nationality: 'international',
    _oly: { teamId: oly.team.teamId, budget: oly.team.budget, chassisTemplateBorrowedFrom: template.name },
  };
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
// Bekannt: die Mod-Oberflaeche hat dafuer bislang nur den "Team Logo"/"Car PNG"-Upload je
// Team gezeigt (s. Chris' Screenshot) -- ob und wo "Drivers" ein Portrait-Upload-Feld hat,
// ist ungeprueft. Die PNGs werden trotzdem vorbereitet, damit sie bereitliegen.
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
  // Chris (05.09.): die restlichen 16 Teams auch einbauen, aber als "active: false" --
  // koennen laut Mod-Konvention (first_active_season, s. Porsche/Toyota/Lotus/Super Aguri
  // im echten 1999er-Feld) spaeter dazustossen. Untereinander nach Olys eigener Prestige
  // gerankt (Chris hat fuer diese 16 keine Reihenfolge vorgegeben), gestaffelt ab Saison 3,
  // zwei neue Teams pro Saison -- die staerksten zuerst.
  const inactiveTeams = teams
    .filter((t) => !F1_TEAM_NAMES.includes(t.team.name))
    .map((t) => ({ ...t, prestige: computeTeamPrestige(t.identity) }))
    .sort((a, b) => b.prestige.base - a.prestige.base);
  console.log(`Inaktiv, koennen spaeter dazustossen (${inactiveTeams.length}): ${inactiveTeams.map((t) => t.team.name).join(', ')}`);

  // Chris will ALLE im Save eingesetzten (gerosterten) Charaktere sehen, nicht nur 48
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

  const colorMap = loadTeamColorMap();
  const teamsJson = [];
  const driversJson = [];
  const assignedPlayerIds = new Set();

  f1Teams.forEach((oly, rank) => {
    const colors = resolveTeamColors(colorMap, oly.team.shortCode);
    teamsJson.push(buildF1Team(oly, rank, f1Teams.length, colors));

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
          number: rank * 2 + i + 1,
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
          number: null,
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
    const firstActiveSeason = 3 + Math.floor(rank / 2);
    teamsJson.push(buildInactiveTeam(oly, rank, inactiveTeams.length, colors, firstActiveSeason));
    // Kein Kader: ein inaktives Team hat noch keine Fahrer unter Vertrag (wie im Vorbild
    // Porsche/Toyota/Lotus/Super Aguri). Die Spieler dieser Teams bleiben Free Agents.
  });

  for (const entry of allEntries) {
    if (assignedPlayerIds.has(entry.player.id)) continue;
    driversJson.push(mapPlayerToDriver(entry.player, entry.raw, scalers, 'Free Agent', null));
  }

  const talents = driversJson.map((d) => d.talent).sort((a, b) => a - b);
  console.log(`Talent-Spanne: ${talents[0]} - ${talents[talents.length - 1]} (Median ${talents[Math.floor(talents.length / 2)]})`);

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
