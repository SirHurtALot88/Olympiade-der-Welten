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
//   node scripts/export-pcm-mod.mjs --cdb <pfad-zur-OfficialRelease.cdb> [--out <dir>]
//     [--save <saveId>] [--order f1|budget] [--fill free-agents|keep-real]
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
  buildProfileScaler,
  multisetAssign,
  limitsFor,
  tourIndexRaw,
  classicIndexRaw,
  splitName,
  fidelityFromTraits,
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

function parseArgs(argv) {
  const out = {
    cdb: null,
    outDir: 'data/generated/pcm-mod',
    save: null,
    order: 'f1',
    fill: 'free-agents',
    firstnameFallback: '',
    teamsOnly: false,
    validateOnly: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--cdb') out.cdb = argv[++i];
    else if (argv[i] === '--out') out.outDir = argv[++i];
    else if (argv[i] === '--save') out.save = argv[++i];
    else if (argv[i] === '--order') out.order = argv[++i];
    else if (argv[i] === '--fill') out.fill = argv[++i];
    else if (argv[i] === '--firstname-fallback') out.firstnameFallback = argv[++i];
    else if (argv[i] === '--teams-only') out.teamsOnly = true;
    else if (argv[i] === '--validate-only') out.validateOnly = true;
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

  const referenceStats = collectReferenceStats(
    cyclistTable,
    rowIndicesByTeam,
    [...wtTeamRows.map((t) => t.IDteam), ...ptTeamRows.map((t) => t.IDteam)],
  );
  console.log(`Referenzpopulation (alle 18 WT + 16 PT Zeilen): ${referenceStats.rowCount} Fahrer, Innerhalb-SD-Median=${referenceStats.withinSdMedian.toFixed(2)}`);

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

  // ---- Fahrer-Population bauen -------------------------------------------------------
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
    draftedByTeam = draftTopUps(teamsInStrengthOrder, oly.freePlayers, topUpNeedByTeam);
  }

  const totalTopUps = [...topUpNeedByTeam.values()].reduce((a, b) => a + b, 0);
  console.log(`Kader-Auffuellung: ${totalTopUps} Top-up-Slots ueber ${teamsInStrengthOrder.length} Teams (Modus: ${args.fill}).`);

  // ---- Rohwerte/Level fuer JEDEN Kandidaten (gerostert + Top-up) vorab berechnen -----
  const population = []; // { rowIndex, olyTeamId, division, player, roster, raw, levelRaw }
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

    const birthdates = readColumnValues(cyclistTable, 'gene_i_birthdate').values;
    const slotRows = slotRowIndices.map((rowIndex) => ({
      rowIndex,
      birthYear: Math.floor(birthdates[rowIndex] / 10000),
    }));

    const withLevel = teamPlayers.map((e) => {
      const { raw, levelRaw } = computeRaw(e.player);
      return { ...e, raw, levelRaw };
    });

    const assigned = assignSlotsWithinTeam(slotRows, withLevel, CURRENT_SEASON_YEAR);
    for (const a of assigned) {
      if (!a.player) continue; // mehr Slots als Spieler (sollte laut plan.md nicht vorkommen)
      population.push({
        rowIndex: a.rowIndex,
        age: a.age,
        olyTeamId: olyTeam.teamId,
        olyTeamName: olyTeam.name,
        division,
        player: a.player.player,
        roster: a.player.roster,
        raw: a.player.raw,
        levelRaw: a.player.levelRaw,
      });
    }
  }
  console.log(`Fahrer-Population (Slots, die gepatcht werden): ${population.length}`);

  // ---- Ankerpruefung: unsere mountain/timetrial/sprint-Rohformeln vs. Olys eigene
  // offizielle climbing/time-trial/spurt-disciplineRatings (plan.md 1.1).
  for (const [ourKey, olyKey] of [['mountain', 'climbing'], ['timetrial', 'time-trial'], ['sprint', 'spurt']]) {
    const xs = population.map((p) => p.raw[ourKey]);
    const ys = population.map((p) => Number(p.player.disciplineRatings?.[olyKey] ?? 0));
    const corr = pearsonCorrelation(xs, ys);
    const flag = corr >= 0.95 ? 'ok' : 'WARNUNG < 0.95';
    console.log(`  Ankerpruefung ${ourKey} vs. ${olyKey}: corr=${corr.toFixed(3)} (${flag})`);
  }

  // ---- Skalierung kalibrieren ---------------------------------------------------------
  const levelTargets = buildLevelTargets(population, referenceStats.levelValues);
  const profileScaler = buildProfileScaler(population.map((p) => p.raw), referenceStats.withinSdMedian);
  console.log(`Profil-Skalierung kalibriert: k=${profileScaler.k.toFixed(3)}`);

  const characByRow = new Map();
  population.forEach((p, i) => {
    characByRow.set(p.rowIndex, profileScaler.apply(p.raw, levelTargets[i]));
  });

  // potentiel: Rang nach grober peakLevel-Naeherung (Level + alterabhaengiges Basis-Headroom,
  // ohne den zirkulaeren potentiel-Term -- plan.md 1.3).
  const baseHeadroomByAge = (age) => (age >= 28 ? 0 : age <= 21 ? 5 : age <= 24 ? 3 : 1);
  const potentielValues = multisetAssign(
    population,
    (p) => levelTargets[population.indexOf(p)] + baseHeadroomByAge(p.age),
    referenceStats.potentielValues,
  );
  const potentielByRow = new Map();
  population.forEach((p, i) => potentielByRow.set(p.rowIndex, potentielValues[i]));

  // tour/classic: Rang nach dem jeweiligen Rohindex aus den fertigen charac-Werten.
  const tourValues = multisetAssign(population, (p) => tourIndexRaw(characByRow.get(p.rowIndex)), referenceStats.tourValues);
  const classicValues = multisetAssign(population, (p) => classicIndexRaw(characByRow.get(p.rowIndex)), referenceStats.classicValues);

  // ---- Fahrer patchen ------------------------------------------------------------------
  const riderEditors = {
    firstname: makeStringColumnEditor(cyclistTable, 'gene_sz_firstname'),
    lastname: makeStringColumnEditor(cyclistTable, 'gene_sz_lastname'),
    firstlastname: makeStringColumnEditor(cyclistTable, 'gene_sz_firstlastname'),
    photo: makeStringColumnEditor(cyclistTable, 'gene_sz_photo'),
    soundname: makeStringColumnEditor(cyclistTable, 'gene_sz_soundname'),
    constant: makeStringColumnEditor(cyclistTable, 'CONSTANT'),
  };

  const riderPatchTrace = [];
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

    riderEditors.firstname.set(p.rowIndex, names.firstname);
    riderEditors.lastname.set(p.rowIndex, names.lastname);
    riderEditors.firstlastname.set(p.rowIndex, names.firstlastname);
    riderEditors.photo.set(p.rowIndex, slug);
    riderEditors.soundname.set(p.rowIndex, '');
    riderEditors.constant.set(p.rowIndex, '');

    riderPatchTrace.push({
      rowIndex: p.rowIndex, olyPlayerId: p.player.id, olyPlayerName: p.player.name,
      olyTeamId: p.olyTeamId, olyTeamName: p.olyTeamName, division: p.division,
      rostered: p.roster != null, age: p.age, charac, limits, potentiel, tour, classic, fidelity,
    });
  });
  for (const editor of Object.values(riderEditors)) editor.flush();
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

  finalizeAndWrite(tree, args, { teams: teamPatchTrace, riders: riderPatchTrace, contractsPatched });
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
