// ===================================================================================
// OLY -> "Pro Cycling Manager 2026" Exporteur (In-Place-Patch der WorldDB `.cdb`).
//
// Plan: /tmp/.../scratchpad/pcm/plan.md (Fable, 05.09.2026) -- vollstaendige empirische
// Herleitung aller Zahlen unten steht dort, hier nur die Umsetzung.
//
// Strategie: KEINE Offset-Chirurgie. Die `.cdb` wird komplett als Baum geparst
// (scripts/pcm/cdb-format.mjs), einzelne Zellen werden veraendert, der Baum wird neu
// serialisiert. Ein Byte-Identitaetstest (serialize(parse(x)) === x) laeuft VOR jeder
// Aenderung und beweist den Writer, bevor er etwas anfasst.
//
// Chris' Vorgabe (05.09.): oberste 18 Oly-Teams (nach Budget) -> WorldTour, Rest in die
// ProTeams; PCMs harte Obergrenze ist 85 (nicht 99 wie bei Team Principal).
//
// Vierte Runde (05.09.): "es waere gut wenn die teams nur meine Fahrer in den teams haetten
// und dann noch schwaechere zum auffuellen, nicht direkt so krass starke, die kann man dann
// in der kommenden Transferperiode holen" -- die staerksten freien Oly-Charaktere (Standard
// 20 %, s. RESERVE_FOR_TRANSFERS_FRACTION) werden deshalb NICHT als Kader-Auffuellung
// verwendet, sondern landen im echten PCM-Freien-Markt (Division 4) -- sichtbar und
// signierbar im Spiel, statt sofort in einem Team zu stecken. Kader-Auffuellung (WT/PT UND
// Continental/U23) zieht nur noch aus dem Rest.
//
// Fuenfte Runde (05.09.): "kannst du die gehaelter denn irgendwie vorgeben? ... auf Basis
// der urspruenglichen gehaelter und den Staerken der Fahrer ... alle auf 0 ist kacke".
// `finan_i_period_wage` ist in der ECHTEN WorldDB fuer ALLE 4202 Vertraege 0 -- nachgeprueft
// auch in Nachbartabellen (DYN_finance, DYN_contract_cyclist_offer, DYN_brand_contract:
// value_i_budget ueberall 0) -- es gibt buchstaeblich KEINEN echten Referenzwert in der
// Datei, an dem sich eine Skala kalibrieren liesse; PCM generiert Gehaelter offenbar rein
// zur Laufzeit. Phase 4 unten setzt deshalb eine bewusst ERFUNDENE, aber konsistente Skala:
// realistische oeffentlich bekannte Radsport-Gehaltsspannen (nicht aus Oly/PCM selbst) je
// Divisions-Tier, log-verteilt nach Perzentil-Rang aus Niveau+Potenzial (dieselbe
// "echte Population statt Formel"-Lehre wie beim Rest des Skripts), plus ein
// Persoenlichkeits-Faktor (+/-) fuer unsere eigenen Charaktere aus ihren Oly-Traits. Die
// ABSOLUTE Groessenordnung (Waehrung? Periode = Jahr/Monat/Woche?) ist Annahme, kein
// Messwert -- Chris muss im Spiel gegenpruefen, `--wage-scale`/`--wage-period` skalieren
// alles gemeinsam nach, ohne die Formel neu zu bauen.
//
//   node scripts/export-pcm-mod.mjs --cdb <pfad-zur-OfficialRelease.cdb> [--out <dir>]
//     [--save <saveId>] [--order f1|budget] [--fill free-agents|keep-real]
//     [--transfer-reserve 0.2] [--wage-period annual|monthly|weekly] [--wage-scale 1]
//     [--firstname-fallback ""] [--teams-only] [--validate-only]
//
// Save-Quelle: OLY_APP_SQLITE_PATH (Default data/persistence/oly-app.sqlite).
// ===================================================================================

import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  readCdb,
  writeCdb,
  assertRoundTrip,
  parseTree,
  serializeTree,
  findTableChunk,
  getTableMeta,
  readColumnValues,
  setIntegerCell,
  setFloatCell,
  setColumnStrings,
} from './pcm/cdb-format.mjs';
import {
  DISCIPLINES,
  computeRaw,
  pearsonCorrelation,
  buildLevelTargets,
  buildShapeMatchedProfiler,
  multisetAssign,
  limitsFor,
  tourIndexRaw,
  classicIndexRaw,
  splitName,
  fidelityFromTraits,
  wageDemandMultiplier,
  rankOlyTeams,
  matchSlotOrder,
  draftTopUps,
  assignSlotsWithinTeam,
  teamAbbreviation,
  loadTeamColorMap,
  resolveTeamColors,
  rgbToHex,
  WT_SLOT_STRENGTH_ORDER,
  PT_SLOT_STRENGTH_ORDER,
  clamp,
} from './pcm/oly-pcm-mapping.mjs';

const SQLITE_PATH = process.env.OLY_APP_SQLITE_PATH || 'data/persistence/oly-app.sqlite';
const TEAM_COLORS_TS_PATH = 'lib/foundation/team-colors.ts';
const CURRENT_SEASON_YEAR = 2026;
const VICTORY_COUNTER_COLUMNS = [
  'gene_i_nb_total_victory', 'gene_i_nb_tdf', 'gene_i_nb_giro', 'gene_i_nb_vuelta',
  'gene_i_nb_sanremo', 'gene_i_nb_flandres', 'gene_i_nb_roubaix', 'gene_i_nb_liege', 'gene_i_nb_lombardia',
];
// Grob: kein Fahrer <= 27 waechst um mehr als 5 Punkte pro Alterstufe (plan.md 1.3) --
// dieselbe Naeherung dient hier zusaetzlich als potentiel-Rangschluessel (levelTarget +
// Basis-Headroom), damit juenger/mehr-Potenzial tendenziell hoehere Sternezahlen bekommt.
const baseHeadroomByAge = (age) => (age >= 28 ? 0 : age <= 21 ? 5 : age <= 24 ? 3 : 1);

// Jaehrliche Gehaltsspannen je Divisions-Tier (min = schwaechster Fahrer der Division,
// max = Superstar) -- oeffentlich bekannte reale Radsport-Groessenordnungen, NICHT aus
// Oly oder PCM hergeleitet (s. Kopfkommentar). Log-Interpolation zwischen min/max nach
// Perzentil-Rang, damit wenige Stars ueberproportional viel verdienen (wie im echten
// Sport), nicht linear gestaffelt.
const WAGE_TIER_BY_DIVISION = {
  10: { min: 60_000, max: 5_500_000 }, // WorldTour
  11: { min: 25_000, max: 180_000 }, // ProTeams
  12: { min: 8_000, max: 40_000 }, // Continental
  20: { min: 5_000, max: 20_000 }, // U23
};
const WAGE_PERIOD_DIVISOR = { annual: 1, monthly: 12, weekly: 52 };

function parseArgs(argv) {
  const out = {
    cdb: null,
    outDir: 'data/generated/pcm-mod',
    save: null,
    order: 'f1',
    fill: 'free-agents',
    transferReserve: 0.2,
    firstnameFallback: '',
    teamsOnly: false,
    validateOnly: false,
    wagePeriod: 'annual',
    wageScale: 1,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--cdb') out.cdb = argv[++i];
    else if (argv[i] === '--out') out.outDir = argv[++i];
    else if (argv[i] === '--save') out.save = argv[++i];
    else if (argv[i] === '--order') out.order = argv[++i];
    else if (argv[i] === '--fill') out.fill = argv[++i];
    else if (argv[i] === '--transfer-reserve') out.transferReserve = Number(argv[++i]);
    else if (argv[i] === '--firstname-fallback') out.firstnameFallback = argv[++i];
    else if (argv[i] === '--teams-only') out.teamsOnly = true;
    else if (argv[i] === '--validate-only') out.validateOnly = true;
    else if (argv[i] === '--wage-period') out.wagePeriod = argv[++i];
    else if (argv[i] === '--wage-scale') out.wageScale = Number(argv[++i]);
  }
  if (!out.cdb) throw new Error('Pflichtargument fehlt: --cdb <pfad-zur-OfficialRelease.cdb>');
  return out;
}

// ---- Referenz-/Team-Erkennung in der echten .cdb -----------------------------------

function realTeamRowsByDivision(tree, division) {
  const teamTable = findTableChunk(tree, 'DYN_team');
  const { rowCount } = getTableMeta(teamTable);
  const ids = readColumnValues(teamTable, 'IDteam').values;
  const names = readColumnValues(teamTable, 'gene_sz_name').values;
  const divisions = readColumnValues(teamTable, 'fkIDdivision').values;
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    if (divisions[i] === division) rows.push({ rowIndex: i, IDteam: ids[i], name: names[i] });
  }
  return rows;
}

function cyclistRowIndicesByTeam(tree) {
  const cyclistTable = findTableChunk(tree, 'DYN_cyclist');
  const { rowCount } = getTableMeta(cyclistTable);
  const teamIds = readColumnValues(cyclistTable, 'fkIDteam').values;
  const byTeam = new Map();
  for (let i = 0; i < rowCount; i++) {
    const t = teamIds[i];
    if (!byTeam.has(t)) byTeam.set(t, []);
    byTeam.get(t).push(i);
  }
  return byTeam;
}

// Sammelt fuer eine Menge von realen Team-IDteams die charac_i_*, value_f_potentiel,
// charac_i_tour/classic-Referenzwerte ihrer Fahrerzeilen (plan.md 0.2/1.2).
function collectReferenceStats(cyclistTable, rowIndicesByTeam, teamIds) {
  const columns = {};
  for (const d of DISCIPLINES) columns[d] = readColumnValues(cyclistTable, `charac_i_${d}`).values;
  const potentiel = readColumnValues(cyclistTable, 'value_f_potentiel').values;
  const tour = readColumnValues(cyclistTable, 'charac_i_tour').values;
  const classic = readColumnValues(cyclistTable, 'charac_i_classic').values;

  const rowIndices = [];
  for (const id of teamIds) {
    for (const idx of rowIndicesByTeam.get(id) || []) rowIndices.push(idx);
  }

  const levelValues = [];
  const withinSds = [];
  const potentielValues = [];
  const tourValues = [];
  const classicValues = [];
  for (const idx of rowIndices) {
    const vals = DISCIPLINES.map((d) => columns[d][idx]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    levelValues.push(mean);
    withinSds.push(Math.sqrt(variance));
    potentielValues.push(potentiel[idx]);
    tourValues.push(tour[idx]);
    classicValues.push(classic[idx]);
  }
  withinSds.sort((a, b) => a - b);
  const withinSdMedian = withinSds[Math.floor(withinSds.length / 2)];
  return { levelValues, withinSdMedian, potentielValues, tourValues, classicValues, rowCount: rowIndices.length };
}

// Echte Fahrerprofile (Name + alle 14 charac_i_*-Werte) fuer die Form-Zuordnung (s.
// oly-pcm-mapping.mjs matchShapeTemplate) -- MUSS vor jeder Aenderung an der Tabelle gelesen
// werden, sonst liest man die eigenen, bereits gepatchten Werte statt der echten.
function collectReferenceProfiles(cyclistTable, rowIndicesByTeam, teamIds) {
  const columns = {};
  for (const d of DISCIPLINES) columns[d] = readColumnValues(cyclistTable, `charac_i_${d}`).values;
  const names = readColumnValues(cyclistTable, 'gene_sz_firstlastname').values;

  const profiles = [];
  for (const id of teamIds) {
    for (const idx of rowIndicesByTeam.get(id) || []) {
      const charac = {};
      for (const d of DISCIPLINES) charac[d] = columns[d][idx];
      profiles.push({ name: names[idx], charac });
    }
  }
  return profiles;
}

// ---- Oly-Save laden (Muster aus export-team-principal-mod.mjs) ---------------------

function loadOlySave(saveArg) {
  const db = new Database(SQLITE_PATH, { readonly: true });
  const saveId = saveArg || db.prepare('select save_id from saves order by updated_at desc limit 1').get().save_id;
  const saveRow = db.prepare('select name, updated_at from saves where save_id = ?').get(saveId);
  console.log(`Oly-Save: ${saveId} ("${saveRow?.name}", zuletzt aktualisiert ${saveRow?.updated_at})`);

  const teamRows = db.prepare('select team_id, payload_json from teams where save_id = ?').all(saveId);
  const identityRows = db.prepare('select team_id, payload_json from team_identities where save_id = ?').all(saveId);
  const rosterRows = db.prepare('select payload_json from rosters where save_id = ?').all(saveId);
  const allPlayerRows = db.prepare('select payload_json from players where save_id = ?').all(saveId);

  const identityByTeam = new Map(identityRows.map((r) => [r.team_id, JSON.parse(r.payload_json)]));
  const teams = teamRows.map((r) => JSON.parse(r.payload_json));
  const rosters = rosterRows.map((r) => JSON.parse(r.payload_json));
  const rostersByTeam = new Map();
  for (const r of rosters) {
    if (!rostersByTeam.has(r.teamId)) rostersByTeam.set(r.teamId, []);
    rostersByTeam.get(r.teamId).push(r);
  }
  const allPlayers = allPlayerRows.map((r) => JSON.parse(r.payload_json).player);
  const playersById = new Map(allPlayers.map((p) => [p.id, p]));
  const rosteredPlayerIds = new Set(rosters.map((r) => r.playerId));
  // Absteigend nach rating -- staerkste zuerst, s. Aufteilung in transferMarketPlayers /
  // fillerPlayers weiter unten in main().
  const freePlayers = allPlayers.filter((p) => !rosteredPlayerIds.has(p.id)).sort((a, b) => b.rating - a.rating);

  return { db, teams, identityByTeam, rosters, rostersByTeam, playersById, freePlayers };
}

function playerSlug(player) {
  const m = /^player-\d+-(.+)$/.exec(player.id);
  return m ? m[1] : player.id;
}

// Batched STRING-Spalten-Editor: setColumnStrings() baut Laengen- und Blob-Chunk komplett
// neu (plan.md 4.2) -- das pro einzelner Zelle zu tun waere O(Zeilen) pro Zelle. Stattdessen
// einmal laden, im Speicher mutieren, einmal am Ende zurueckschreiben.
function makeStringColumnEditor(tableChunk, columnName) {
  const { values } = readColumnValues(tableChunk, columnName);
  const arr = values.slice();
  return {
    set(rowIndex, value) {
      arr[rowIndex] = value;
    },
    flush() {
      setColumnStrings(tableChunk, columnName, arr);
    },
  };
}

// ---- Gemeinsame Patch-Logik fuer eine Fahrer-Population (Phase 1/2/3) ----------------
// population: [{ rowIndex, age, olyTeamId, olyTeamName, division, player, roster, raw,
// levelRaw }]. reference: Rueckgabe von collectReferenceStats(). templates: Rueckgabe von
// collectReferenceProfiles() (echte Fahrerprofile fuer die Form-Zuordnung, s.
// oly-pcm-mapping.mjs matchShapeTemplate -- IMMER dieselbe grosse WT+PT-Bibliothek, auch fuer
// Phase 2/3, weil Profil-FORM unabhaengig vom Liga-Niveau ist). Gibt den Trace-Eintrag je
// gepatchter Zeile zurueck.
function patchRiderPopulation(cyclistTable, population, reference, templates, args, label) {
  if (population.length === 0) return [];

  const levelTargets = buildLevelTargets(population, reference.levelValues);
  const profiler = buildShapeMatchedProfiler(templates);

  const characByRow = new Map();
  const compByRow = new Map();
  let similaritySum = 0;
  population.forEach((p, i) => {
    const { charac, matchedName, similarity } = profiler.apply(p.raw, levelTargets[i]);
    characByRow.set(p.rowIndex, charac);
    compByRow.set(p.rowIndex, { matchedName, similarity });
    similaritySum += similarity;
  });
  console.log(`  ${label}: Form-Zuordnung gegen ${templates.length} echte Fahrerprofile, mittlere Aehnlichkeit=${(similaritySum / population.length).toFixed(3)}`);

  // potentiel: Rang nach grober peakLevel-Naeherung (Level + alterabhaengiges
  // Basis-Headroom, ohne den zirkulaeren potentiel-Term -- plan.md 1.3).
  const potentielValues = multisetAssign(
    population,
    (p) => levelTargets[population.indexOf(p)] + baseHeadroomByAge(p.age),
    reference.potentielValues,
  );
  const potentielByRow = new Map();
  population.forEach((p, i) => potentielByRow.set(p.rowIndex, potentielValues[i]));

  // tour/classic: Rang nach dem jeweiligen Rohindex aus den fertigen charac-Werten.
  const tourValues = multisetAssign(population, (p) => tourIndexRaw(characByRow.get(p.rowIndex)), reference.tourValues);
  const classicValues = multisetAssign(population, (p) => classicIndexRaw(characByRow.get(p.rowIndex)), reference.classicValues);

  const editors = {
    firstname: makeStringColumnEditor(cyclistTable, 'gene_sz_firstname'),
    lastname: makeStringColumnEditor(cyclistTable, 'gene_sz_lastname'),
    firstlastname: makeStringColumnEditor(cyclistTable, 'gene_sz_firstlastname'),
    photo: makeStringColumnEditor(cyclistTable, 'gene_sz_photo'),
    soundname: makeStringColumnEditor(cyclistTable, 'gene_sz_soundname'),
    constant: makeStringColumnEditor(cyclistTable, 'CONSTANT'),
  };

  const trace = [];
  population.forEach((p, i) => {
    const charac = characByRow.get(p.rowIndex);
    const potentiel = potentielByRow.get(p.rowIndex);
    const limits = limitsFor(charac, p.age, potentiel);
    const tour = tourValues[i];
    const classic = classicValues[i];
    const names = splitName(p.player.name, args.firstnameFallback);
    const fidelity = fidelityFromTraits(p.player);
    const slug = playerSlug(p.player);

    for (const d of DISCIPLINES) {
      setIntegerCell(cyclistTable, `charac_i_${d}`, p.rowIndex, charac[d]);
      setIntegerCell(cyclistTable, `limit_i_${d}`, p.rowIndex, limits[d]);
    }
    setFloatCell(cyclistTable, 'value_f_potentiel', p.rowIndex, potentiel);
    setIntegerCell(cyclistTable, 'charac_i_tour', p.rowIndex, tour);
    setIntegerCell(cyclistTable, 'charac_i_classic', p.rowIndex, classic);
    setIntegerCell(cyclistTable, 'iContract_fidelity', p.rowIndex, fidelity);
    setIntegerCell(cyclistTable, 'gene_i_champion_bit', p.rowIndex, 0);
    for (const col of VICTORY_COUNTER_COLUMNS) setIntegerCell(cyclistTable, col, p.rowIndex, 0);

    editors.firstname.set(p.rowIndex, names.firstname);
    editors.lastname.set(p.rowIndex, names.lastname);
    editors.firstlastname.set(p.rowIndex, names.firstlastname);
    editors.photo.set(p.rowIndex, slug);
    editors.soundname.set(p.rowIndex, '');
    editors.constant.set(p.rowIndex, '');

    const comp = compByRow.get(p.rowIndex);
    trace.push({
      rowIndex: p.rowIndex,
      olyPlayerId: p.player.id,
      olyPlayerName: p.player.name,
      olyTeamId: p.olyTeamId,
      olyTeamName: p.olyTeamName,
      division: p.division,
      rostered: p.roster != null,
      age: p.age,
      charac,
      limits,
      potentiel,
      tour,
      classic,
      fidelity,
      realRiderComp: comp.matchedName,
      compSimilarity: Math.round(comp.similarity * 1000) / 1000,
    });
  });
  for (const editor of Object.values(editors)) editor.flush();
  return trace;
}

// Baut die Populationseintraege (raw/levelRaw vorab berechnet) fuer eine Liste von
// {rowIndex, birthYear}-Slots und eine Liste von Oly-Charakteren -- gemeinsame Vorstufe fuer
// Phase 1 (je Oly-Team) und Phase 2/3 (je reales Team bzw. Free-Pool).
function buildPopulationForSlots(slotRows, playerEntries, extra) {
  const withLevel = playerEntries.map((e) => {
    const { raw, levelRaw } = computeRaw(e.player);
    return { ...e, raw, levelRaw };
  });
  const assigned = assignSlotsWithinTeam(slotRows, withLevel, CURRENT_SEASON_YEAR);
  const out = [];
  for (const a of assigned) {
    if (!a.player) continue; // mehr Slots als Spieler -- Rest bleibt real.
    out.push({
      rowIndex: a.rowIndex,
      age: a.age,
      player: a.player.player,
      roster: a.player.roster,
      raw: a.player.raw,
      levelRaw: a.player.levelRaw,
      ...extra,
    });
  }
  return out;
}

// ---- Hauptprogramm ------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(args.outDir, { recursive: true });

  console.log(`Lade ${args.cdb} ...`);
  const { buffer } = readCdb(args.cdb);
  console.log('Pflicht-Selbsttest: parse(buffer) -> serialize() muss byte-identisch sein ...');
  const tree = assertRoundTrip(buffer);
  console.log('OK.');

  const cyclistTable = findTableChunk(tree, 'DYN_cyclist');
  const teamTable = findTableChunk(tree, 'DYN_team');
  const contractTable = findTableChunk(tree, 'DYN_contract_cyclist');

  const wtTeamRows = realTeamRowsByDivision(tree, 10);
  const ptTeamRows = realTeamRowsByDivision(tree, 11);
  console.log(`Echte WorldTour-Teams: ${wtTeamRows.length}, ProTeams: ${ptTeamRows.length}`);

  const wtOrderIdx = matchSlotOrder(WT_SLOT_STRENGTH_ORDER, wtTeamRows.map((t) => t.name));
  const ptOrderIdx = matchSlotOrder(PT_SLOT_STRENGTH_ORDER, ptTeamRows.map((t) => t.name));
  const wtSlotsOrdered = wtOrderIdx.map((i) => wtTeamRows[i]);
  const ptSlotsOrdered = ptOrderIdx.map((i) => ptTeamRows[i]);

  const rowIndicesByTeam = cyclistRowIndicesByTeam(tree);
  const birthdatesAll = readColumnValues(cyclistTable, 'gene_i_birthdate').values;

  const referenceTeamIds = [...wtTeamRows.map((t) => t.IDteam), ...ptTeamRows.map((t) => t.IDteam)];
  const referenceStats = collectReferenceStats(cyclistTable, rowIndicesByTeam, referenceTeamIds);
  console.log(`Referenzpopulation (alle 18 WT + 16 PT Zeilen): ${referenceStats.rowCount} Fahrer, Innerhalb-SD-Median=${referenceStats.withinSdMedian.toFixed(2)}`);
  // MUSS hier (vor jeder Aenderung) gelesen werden -- s. collectReferenceProfiles-Kommentar.
  const shapeTemplates = collectReferenceProfiles(cyclistTable, rowIndicesByTeam, referenceTeamIds);

  if (args.validateOnly) {
    console.log('\n--validate-only: nur Format- und Referenzpruefung, keine Aenderung.');
    console.log(`Tabellen: ${tree.children.length >= 1 ? 'ok' : 'FEHLT'}`);
    return;
  }

  // ---- Oly-Seite laden und Teams zuordnen ------------------------------------------
  const oly = loadOlySave(args.save);
  const olyTeamsForRanking = oly.teams.map((t) => ({ teamId: t.teamId, name: t.name, budget: t.budget }));
  const { worldTour, proTeams } = rankOlyTeams(olyTeamsForRanking, oly.identityByTeam, args.order);
  console.log(`\nWorldTour (${worldTour.length}): ${worldTour.map((t) => t.name).join(', ')}`);
  console.log(`ProTeams (${proTeams.length}): ${proTeams.map((t) => t.name).join(', ')}`);

  if (worldTour.length !== wtSlotsOrdered.length || proTeams.length !== ptSlotsOrdered.length) {
    throw new Error(`Slotanzahl passt nicht: WT ${worldTour.length}/${wtSlotsOrdered.length}, PT ${proTeams.length}/${ptSlotsOrdered.length}`);
  }

  // Chris (05.09., vierte Runde): Kader sollen "nur meine Fahrer + schwaechere zum
  // Auffuellen" enthalten, "nicht direkt so krass starke" -- die stellt er sich lieber fuer
  // die kommende Transferperiode vor. Die staerksten `transferReserve` (Default 20 %) der
  // freien Charaktere werden deshalb komplett aus jeder Kader-Auffuellung herausgehalten
  // (weder WT/PT-Top-ups noch Continental/U23) und landen stattdessen unten in Phase 3 im
  // echten PCM-Freien-Markt.
  const reserveCount = clamp(Math.round(oly.freePlayers.length * args.transferReserve), 0, oly.freePlayers.length);
  const transferMarketPlayers = oly.freePlayers.slice(0, reserveCount);
  const fillerPlayers = oly.freePlayers.slice(reserveCount);
  console.log(`\nFreie Oly-Charaktere: ${oly.freePlayers.length} gesamt, davon ${transferMarketPlayers.length} fuer den Transfermarkt reserviert (Anteil ${args.transferReserve}), ${fillerPlayers.length} als Kader-Auffuellung verfuegbar.`);

  const assignments = [
    ...worldTour.map((olyTeam, i) => ({ olyTeam, slot: wtSlotsOrdered[i], division: 'WT' })),
    ...proTeams.map((olyTeam, i) => ({ olyTeam, slot: ptSlotsOrdered[i], division: 'PT' })),
  ];

  const colorMap = loadTeamColorMap(TEAM_COLORS_TS_PATH);
  const usedAbbreviations = new Set(readColumnValues(teamTable, 'abbreviation').values);

  // ---- Teams patchen -----------------------------------------------------------------
  const teamEditors = {
    name: makeStringColumnEditor(teamTable, 'gene_sz_name'),
    shortname: makeStringColumnEditor(teamTable, 'gene_sz_shortname'),
    abbreviation: makeStringColumnEditor(teamTable, 'abbreviation'),
    color: makeStringColumnEditor(teamTable, 'gene_sz_color'),
    secondaryColor: makeStringColumnEditor(teamTable, 'gene_sz_secondary_color'),
    suffixeMail: makeStringColumnEditor(teamTable, 'gene_sz_suffixeMail'),
    managerGeneral: makeStringColumnEditor(teamTable, 'gene_sz_manager_general'),
    constant: makeStringColumnEditor(teamTable, 'CONSTANT'),
  };

  const teamPatchTrace = [];
  for (const { olyTeam, slot, division } of assignments) {
    const olyFull = oly.teams.find((t) => t.teamId === olyTeam.teamId);
    const colors = resolveTeamColors(colorMap, olyFull.shortCode);
    const abbr = teamAbbreviation(olyTeam.name, usedAbbreviations);
    usedAbbreviations.add(abbr);
    const slug = olyFull.shortCode.toLowerCase().replace(/[^a-z0-9]/g, '');

    teamEditors.name.set(slot.rowIndex, olyTeam.name);
    teamEditors.shortname.set(slot.rowIndex, olyTeam.name.slice(0, 20));
    teamEditors.abbreviation.set(slot.rowIndex, abbr);
    teamEditors.color.set(slot.rowIndex, rgbToHex(colors.primary));
    teamEditors.secondaryColor.set(slot.rowIndex, rgbToHex(colors.secondary));
    teamEditors.suffixeMail.set(slot.rowIndex, `${slug}.oly`);
    teamEditors.managerGeneral.set(slot.rowIndex, '-');
    teamEditors.constant.set(slot.rowIndex, '');

    teamPatchTrace.push({ olyTeamId: olyTeam.teamId, olyName: olyTeam.name, division, realIDteam: slot.IDteam, realSlotName: slot.name, abbreviation: abbr });
  }
  for (const editor of Object.values(teamEditors)) editor.flush();
  console.log(`\n${teamPatchTrace.length} Team-Zeilen gepatcht.`);

  if (args.teamsOnly) {
    finalizeAndWrite(tree, args, { teams: teamPatchTrace, riders: [] });
    return;
  }

  // ---- Phase 1: WorldTour/ProTeams -- gerosterte Oly-Spieler + schwaechere Top-ups ---
  const teamsInStrengthOrder = [...worldTour, ...proTeams];
  const slotCountByOlyTeam = new Map();
  for (const { olyTeam, slot } of assignments) {
    slotCountByOlyTeam.set(olyTeam.teamId, (rowIndicesByTeam.get(slot.IDteam) || []).length);
  }

  const rosteredByOlyTeam = new Map();
  for (const { olyTeam } of assignments) {
    const roster = (oly.rostersByTeam.get(olyTeam.teamId) || [])
      .map((r) => ({ roster: r, player: oly.playersById.get(r.playerId) }))
      .filter((e) => e.player);
    rosteredByOlyTeam.set(olyTeam.teamId, roster);
  }

  const topUpNeedByTeam = new Map();
  for (const { olyTeam } of assignments) {
    const need = slotCountByOlyTeam.get(olyTeam.teamId) - rosteredByOlyTeam.get(olyTeam.teamId).length;
    topUpNeedByTeam.set(olyTeam.teamId, Math.max(0, need));
  }

  let draftedByTeam = new Map(teamsInStrengthOrder.map((t) => [t.teamId, []]));
  if (args.fill === 'free-agents') {
    draftedByTeam = draftTopUps(teamsInStrengthOrder, fillerPlayers, topUpNeedByTeam);
  }

  const totalTopUps = [...topUpNeedByTeam.values()].reduce((a, b) => a + b, 0);
  console.log(`Kader-Auffuellung: ${totalTopUps} Top-up-Slots ueber ${teamsInStrengthOrder.length} Teams (Modus: ${args.fill}).`);

  const population = [];
  for (const { olyTeam, slot, division } of assignments) {
    const rosterEntries = rosteredByOlyTeam.get(olyTeam.teamId);
    const topUps = draftedByTeam.get(olyTeam.teamId) || [];
    const teamPlayers = [
      ...rosterEntries.map((e) => ({ player: e.player, roster: e.roster })),
      ...topUps.map((p) => ({ player: p, roster: null })),
    ];
    const slotRowIndices = rowIndicesByTeam.get(slot.IDteam) || [];
    if (teamPlayers.length !== slotRowIndices.length) {
      console.warn(`  WARNUNG: ${olyTeam.name}: ${teamPlayers.length} Spieler != ${slotRowIndices.length} Slots -- werde auffuellen/kappen.`);
    }
    const slotRows = slotRowIndices.map((rowIndex) => ({ rowIndex, birthYear: Math.floor(birthdatesAll[rowIndex] / 10000) }));
    population.push(...buildPopulationForSlots(slotRows, teamPlayers, { olyTeamId: olyTeam.teamId, olyTeamName: olyTeam.name, division }));
  }
  console.log(`Fahrer-Population (Slots, die gepatcht werden): ${population.length}`);

  // ---- Ankerpruefung (informativ): unsere mountain/timetrial/sprint-Rohformeln vs. Olys
  // eigene offizielle climbing/time-trial/spurt-disciplineRatings. Chris hat mountain/sprint
  // am 05.09. bewusst von Olys climbing-Formel weggeholt (power- statt stamina-gefuehrt,
  // s. DISCIPLINE_WEIGHTS-Kommentar) -- niedrige Korrelation bei mountain ist seitdem
  // ERWARTET, kein Fehler. timetrial blieb naeher am Original, dient hier noch als
  // Tippfehler-Absicherung.
  for (const [ourKey, olyKey] of [['mountain', 'climbing'], ['timetrial', 'time-trial'], ['sprint', 'spurt']]) {
    const xs = population.map((p) => p.raw[ourKey]);
    const ys = population.map((p) => Number(p.player.disciplineRatings?.[olyKey] ?? 0));
    const corr = pearsonCorrelation(xs, ys);
    console.log(`  Ankerpruefung ${ourKey} vs. ${olyKey}: corr=${corr.toFixed(3)}`);
  }

  const riderPatchTrace = patchRiderPopulation(cyclistTable, population, referenceStats, shapeTemplates, args, 'Phase 1');
  console.log(`${riderPatchTrace.length} Fahrer-Zeilen gepatcht.`);

  // ---- Vertraege patchen: nur iYearEnd fuer gerosterte Oly-Spieler -------------------
  const contractRowsByCyclist = new Map();
  {
    const { rowCount } = getTableMeta(contractTable);
    const fkCyclist = readColumnValues(contractTable, 'fkIDcyclist').values;
    for (let i = 0; i < rowCount; i++) contractRowsByCyclist.set(fkCyclist[i], i);
  }
  const idCyclistValues = readColumnValues(cyclistTable, 'IDcyclist').values;
  let contractsPatched = 0;
  for (const p of population) {
    if (!p.roster) continue;
    const cyclistId = idCyclistValues[p.rowIndex];
    const contractRow = contractRowsByCyclist.get(cyclistId);
    if (contractRow == null) continue;
    const yearEnd = clamp(2025 + (p.roster.contractLength || 1), 2026, 2029);
    setIntegerCell(contractTable, 'iYearEnd', contractRow, yearEnd);
    contractsPatched++;
  }
  console.log(`${contractsPatched} Vertraege (iYearEnd) angepasst.`);

  // ---- Phase 2: restliche Kader-Auffuellung in Continental/U23 ----------------------
  // Chris (05.09., dritte Runde): "ich moechte dass du alle ca 3k spieler einfuegst!". Phase
  // 1 platziert nur 878 Zeilen (328 gerostert + Top-ups). Die uebrigen freien Oly-Charaktere
  // (aus `fillerPlayers`, die staerksten 20 % sind fuer Phase 3 reserviert) werden jetzt in
  // Continental- (Division 12) und U23-Zeilen (Division 20) eingesetzt -- 3286 Zeilen
  // insgesamt. Staerkste Continental/U23-Teams zuerst (top8avg aus den eigenen echten
  // charac_i_*-Werten, keine Handliste noetig -- anders als bei WT/PT gibt es hier keine
  // bekannten Markennamen).
  const contiTeamRows = realTeamRowsByDivision(tree, 12).map((t) => ({ ...t, division: 'CONTI' }));
  const u23TeamRows = realTeamRowsByDivision(tree, 20).map((t) => ({ ...t, division: 'U23' }));
  console.log(`\nPhase 2: ${contiTeamRows.length} Continental-Teams, ${u23TeamRows.length} U23-Teams.`);

  const characColsCache = {};
  for (const d of DISCIPLINES) characColsCache[d] = readColumnValues(cyclistTable, `charac_i_${d}`).values;

  function teamStrengthScore(rows) {
    if (rows.length === 0) return -Infinity;
    const maxCharacPerRow = rows.map((idx) => Math.max(...DISCIPLINES.map((d) => characColsCache[d][idx])));
    maxCharacPerRow.sort((a, b) => b - a);
    const top = maxCharacPerRow.slice(0, 8);
    return top.reduce((a, b) => a + b, 0) / top.length;
  }

  const phase2Teams = [...contiTeamRows, ...u23TeamRows]
    .map((t) => ({ ...t, rows: rowIndicesByTeam.get(t.IDteam) || [] }))
    .map((t) => ({ ...t, score: teamStrengthScore(t.rows) }))
    .sort((a, b) => b.score - a.score);

  const phase2Reference = collectReferenceStats(cyclistTable, rowIndicesByTeam, phase2Teams.map((t) => t.IDteam));
  console.log(`Phase-2-Referenzpopulation: ${phase2Reference.rowCount} Fahrer, Innerhalb-SD-Median=${phase2Reference.withinSdMedian.toFixed(2)}`);

  const usedFillerIds = new Set(population.filter((p) => !p.roster).map((p) => p.player.id));
  const remainingFiller = fillerPlayers.filter((p) => !usedFillerIds.has(p.id));
  console.log(`Verbleibende Auffuell-Charaktere fuer Phase 2: ${remainingFiller.length}`);

  const phase2Population = [];
  let cursor = 0;
  for (const team of phase2Teams) {
    if (cursor >= remainingFiller.length) break;
    const take = Math.min(team.rows.length, remainingFiller.length - cursor);
    if (take <= 0) continue;
    const teamPlayers = remainingFiller.slice(cursor, cursor + take).map((p) => ({ player: p, roster: null }));
    cursor += take;

    const slotRows = team.rows.map((rowIndex) => ({ rowIndex, birthYear: Math.floor(birthdatesAll[rowIndex] / 10000) }));
    phase2Population.push(...buildPopulationForSlots(slotRows, teamPlayers, { olyTeamId: null, olyTeamName: null, division: team.division }));
  }
  console.log(`Phase-2-Population (Slots, die zusaetzlich gepatcht werden): ${phase2Population.length}`);

  const riderPatchTrace2 = patchRiderPopulation(cyclistTable, phase2Population, phase2Reference, shapeTemplates, args, 'Phase 2');
  console.log(`${riderPatchTrace2.length} zusaetzliche Fahrer-Zeilen gepatcht (Phase 2).`);

  // ---- Phase 3: staerkste freie Oly-Charaktere in den echten PCM-Freien-Markt --------
  // Chris (05.09., vierte Runde): diese Charaktere sollen NICHT in einem Kader landen,
  // sondern als Signings fuer die kommende Transferperiode sichtbar bleiben -- Division 4
  // ist Chris' eigener "Free"-Pseudo-Team (plan.md 0.3: "Fahrer ohne Team haengen am
  // Pseudo-Team ... Division 4 'Free'"). Referenz bewusst dieselbe wie Phase 1 (WT+PT) --
  // diese Charaktere sollen wie plausible Verstaerkungen fuer ein Topteam aussehen.
  const freeTeamRows = realTeamRowsByDivision(tree, 4);
  let riderPatchTrace3 = [];
  if (freeTeamRows.length === 0) {
    console.warn('\nWARNUNG: kein Team in Division 4 (Free-Pool) gefunden -- Phase 3 uebersprungen, Transfermarkt-Charaktere bleiben unplatziert.');
  } else {
    const freeTeam = freeTeamRows[0];
    const freeTeamRowIdx = rowIndicesByTeam.get(freeTeam.IDteam) || [];
    console.log(`\nPhase 3: Free-Pool-Team "${freeTeam.name}" hat ${freeTeamRowIdx.length} Zeilen, ${transferMarketPlayers.length} Oly-Charaktere fuer den Transfermarkt reserviert.`);
    if (transferMarketPlayers.length > freeTeamRowIdx.length) {
      console.warn(`  WARNUNG: mehr Transfermarkt-Charaktere (${transferMarketPlayers.length}) als freie Zeilen (${freeTeamRowIdx.length}) -- ueberschuessige bleiben unplatziert.`);
    }
    const slotRows3 = freeTeamRowIdx.map((rowIndex) => ({ rowIndex, birthYear: Math.floor(birthdatesAll[rowIndex] / 10000) }));
    const phase3Population = buildPopulationForSlots(
      slotRows3,
      transferMarketPlayers.map((p) => ({ player: p, roster: null })),
      { olyTeamId: null, olyTeamName: null, division: 'FREE' },
    );
    console.log(`Phase-3-Population: ${phase3Population.length}`);
    riderPatchTrace3 = patchRiderPopulation(cyclistTable, phase3Population, referenceStats, shapeTemplates, args, 'Phase 3');
    console.log(`${riderPatchTrace3.length} Fahrer-Zeilen im Freien Markt gepatcht (Phase 3).`);
  }

  const totalPatched = riderPatchTrace.length + riderPatchTrace2.length + riderPatchTrace3.length;
  console.log(`\nInsgesamt eingesetzte Oly-Charaktere: ${totalPatched} von ${oly.rosters.length + oly.freePlayers.length} (${oly.rosters.length} gerostert + ${oly.freePlayers.length} frei, davon ${riderPatchTrace3.length} im Transfermarkt statt im Kader).`);

  // ---- Phase 4: Gehaelter -------------------------------------------------------------
  // Chris (05.09., fuenfte Runde): "kannst du die gehaelter denn irgendwie vorgeben? auf
  // Basis der urspruenglichen gehaelter und den Staerken der Fahrer ... alle auf 0 ist
  // kacke". Betrifft ALLE 4202 Vertraege (auch die, deren Fahrerzeile real geblieben ist --
  // die haben ja auch charac_i_*/potentiel-Werte, nur eben keine Oly-Traits). Rang nach
  // Niveau+Potenzial INNERHALB der jeweiligen Division, log-Skala zwischen Tier-Minimum und
  // -Maximum (s. WAGE_TIER_BY_DIVISION-Kommentar), Persoenlichkeits-Faktor nur wo wir
  // Oly-Traits kennen (unsere eigenen gepatchten Zeilen aus Phase 1+2).
  const olyPlayerByRow = new Map();
  for (const p of [...population, ...phase2Population]) olyPlayerByRow.set(p.rowIndex, p.player);

  const characColsFinal = {};
  for (const d of DISCIPLINES) characColsFinal[d] = readColumnValues(cyclistTable, `charac_i_${d}`).values;
  const potentielFinal = readColumnValues(cyclistTable, 'value_f_potentiel').values;
  const cyclistIdToRow = new Map(idCyclistValues.map((id, i) => [id, i]));
  const teamDivisionById = new Map();
  {
    const { rowCount } = getTableMeta(teamTable);
    const ids = readColumnValues(teamTable, 'IDteam').values;
    const divs = readColumnValues(teamTable, 'fkIDdivision').values;
    for (let i = 0; i < rowCount; i++) teamDivisionById.set(ids[i], divs[i]);
  }

  function levelOfRow(rowIndex) {
    const vals = DISCIPLINES.map((d) => characColsFinal[d][rowIndex]);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  const { rowCount: contractRowCountAll } = getTableMeta(contractTable);
  const contractFkCyclistAll = readColumnValues(contractTable, 'fkIDcyclist').values;
  const contractFkTeamAll = readColumnValues(contractTable, 'fkIDteam').values;

  const rowsByDivision = new Map();
  for (let i = 0; i < contractRowCountAll; i++) {
    const cyclistRow = cyclistIdToRow.get(contractFkCyclistAll[i]);
    if (cyclistRow == null) continue;
    const division = teamDivisionById.get(contractFkTeamAll[i]);
    if (!WAGE_TIER_BY_DIVISION[division]) continue;
    const score = levelOfRow(cyclistRow) + potentielFinal[cyclistRow] * 3;
    if (!rowsByDivision.has(division)) rowsByDivision.set(division, []);
    rowsByDivision.get(division).push({ contractRow: i, cyclistRow, score });
  }

  const periodDivisor = WAGE_PERIOD_DIVISOR[args.wagePeriod] ?? 1;
  let wagesSet = 0;
  for (const [division, rows] of rowsByDivision) {
    const tier = WAGE_TIER_BY_DIVISION[division];
    const sorted = [...rows].sort((a, b) => a.score - b.score);
    const n = sorted.length;
    sorted.forEach((r, rank) => {
      const percentile = n <= 1 ? 0.5 : rank / (n - 1);
      const base = tier.min * (tier.max / tier.min) ** percentile;
      const olyPlayer = olyPlayerByRow.get(r.cyclistRow);
      const demandFactor = olyPlayer ? wageDemandMultiplier(olyPlayer) : 1;
      const wage = Math.round((base * demandFactor * args.wageScale) / periodDivisor / 100) * 100;
      setIntegerCell(contractTable, 'finan_i_period_wage', r.contractRow, wage);
      wagesSet++;
    });
  }
  console.log(`\nPhase 4: ${wagesSet} Gehaelter gesetzt (Tier-Perzentil x Potenzial, Periode=${args.wagePeriod}, Skala=${args.wageScale}).`);

  finalizeAndWrite(tree, args, {
    teams: teamPatchTrace,
    riders: [...riderPatchTrace, ...riderPatchTrace2, ...riderPatchTrace3],
    contractsPatched,
    wagesSet,
  });
}

function finalizeAndWrite(tree, args, trace) {
  console.log('\nSerialisiere Baum ...');
  const serialized = serializeTree(tree);
  console.log('Re-Parse der geschriebenen Struktur zur Kontrolle ...');
  const reparsed = parseTree(serialized);
  const reTable = findTableChunk(reparsed, 'DYN_cyclist');
  if (!reTable) throw new Error('Re-Parse-Kontrolle fehlgeschlagen: DYN_cyclist nicht gefunden');

  const outCdb = path.join(args.outDir, 'OfficialRelease.cdb');
  const { uncompressedSize, compressedSize } = writeCdb(outCdb, serialized);
  console.log(`Geschrieben: ${outCdb} (${uncompressedSize} Bytes unkomprimiert, ${compressedSize} komprimiert)`);

  writeFileSync(path.join(args.outDir, 'oly-pcm-mapping-trace.json'), JSON.stringify(trace, null, 2));
  console.log(`Trace: ${path.join(args.outDir, 'oly-pcm-mapping-trace.json')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
