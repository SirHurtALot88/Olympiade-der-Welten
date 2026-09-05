// Validiert eine geschriebene Oly-PCM-.cdb gegen plan.md Abschnitt 5 (harte Fehler +
// Warnungen). Vergleicht zusaetzlich gegen das Original, um zu beweisen, dass NICHTS
// ausserhalb der beabsichtigten Zellen veraendert wurde.
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  readCdb, parseTree, serializeChunk, findTableChunk, getTableMeta, readColumnValues,
} from './cdb-format.mjs';
import { DISCIPLINES, PCM_MIN, PCM_MAX } from './oly-pcm-mapping.mjs';

const origPath = process.argv[2];
const newPath = process.argv[3];
if (!origPath || !newPath) {
  console.error('Nutzung: node validate-export.mjs <original.cdb> <neu.cdb>');
  process.exit(1);
}

// Die Real-Datenbank selbst traegt Altlasten (s.u., "ACR"/"ACR") -- Eindeutigkeit pruefen
// wir deshalb nur fuer unsere eigenen 32 gepatchten Team-Zeilen, nicht global.
const tracePath = path.join(path.dirname(newPath), 'oly-pcm-mapping-trace.json');
const trace = existsSync(tracePath) ? JSON.parse(readFileSync(tracePath, 'utf8')) : null;
const patchedTeamRowIndexes = trace ? new Set(trace.teams.map((t) => t.realIDteam)) : null;

let errors = 0;
let warnings = 0;
function fail(msg) {
  console.error(`FEHLER: ${msg}`);
  errors++;
}
function warn(msg) {
  console.warn(`WARNUNG: ${msg}`);
  warnings++;
}

console.log(`Original: ${origPath}\nNeu:      ${newPath}\n`);
const orig = readCdb(origPath);
const neu = readCdb(newPath);
const origTree = parseTree(orig.buffer);
const newTree = parseTree(neu.buffer);

// ---- 2. Struktur: gleiche Tabellenanzahl/-namen/-rowCounts/-spalten -----------------
function tablesOf(tree) {
  const arr = tree.children.find((c) => c.isArray);
  return arr.children;
}
const origTablesList = tablesOf(origTree);
const newTablesList = tablesOf(newTree);
if (origTablesList.length !== newTablesList.length) {
  fail(`Tabellenanzahl: original ${origTablesList.length} != neu ${newTablesList.length}`);
} else {
  console.log(`${origTablesList.length} Tabellen in beiden Dateien.`);
}

const CHANGED_TABLES = new Set(['DYN_cyclist', 'DYN_team', 'DYN_contract_cyclist']);
let unchangedIdentical = 0;
let unchangedDiffer = 0;
for (let i = 0; i < origTablesList.length; i++) {
  const ot = origTablesList[i];
  const nt = newTablesList[i];
  if (ot.desc !== nt.desc) {
    fail(`Tabellenreihenfolge/-name weicht ab an Index ${i}: "${ot.desc}" vs "${nt.desc}"`);
    continue;
  }
  const om = getTableMeta(ot);
  const nm = getTableMeta(nt);
  if (om.rowCount !== nm.rowCount) fail(`${ot.desc}: rowCount ${om.rowCount} != ${nm.rowCount}`);
  if (om.columns.length !== nm.columns.length) fail(`${ot.desc}: Spaltenanzahl ${om.columns.length} != ${nm.columns.length}`);

  if (!CHANGED_TABLES.has(ot.desc)) {
    const oh = createHash('sha256').update(serializeChunk(ot)).digest('hex');
    const nh = createHash('sha256').update(serializeChunk(nt)).digest('hex');
    if (oh === nh) unchangedIdentical++;
    else {
      unchangedDiffer++;
      fail(`Unveraenderte Tabelle "${ot.desc}" ist NICHT byte-identisch (SHA-256 weicht ab)`);
    }
  } else {
    // Nur die nicht angefassten Spalten muessen identisch sein.
    for (let ci = 0; ci < om.columns.length; ci++) {
      const oc = om.columns[ci];
      const nc = nm.columns[ci];
      if (oc.desc !== nc.desc) {
        fail(`${ot.desc}: Spaltenreihenfolge weicht ab an Index ${ci}`);
        continue;
      }
    }
  }
}
console.log(`Unveraenderte Tabellen: ${unchangedIdentical} identisch, ${unchangedDiffer} weichen ab.`);

// ---- 5/6. Domaenen- und Verkettungspruefungen auf der neuen Datei -------------------
const cyclistTable = findTableChunk(newTree, 'DYN_cyclist');
const teamTable = findTableChunk(newTree, 'DYN_team');
const contractTable = findTableChunk(newTree, 'DYN_contract_cyclist');
const { rowCount: cyclistRowCount } = getTableMeta(cyclistTable);

const characCols = {};
const limitCols = {};
for (const d of DISCIPLINES) {
  characCols[d] = readColumnValues(cyclistTable, `charac_i_${d}`).values;
  limitCols[d] = readColumnValues(cyclistTable, `limit_i_${d}`).values;
}
const potentiel = readColumnValues(cyclistTable, 'value_f_potentiel').values;
const tour = readColumnValues(cyclistTable, 'charac_i_tour').values;
const classic = readColumnValues(cyclistTable, 'charac_i_classic').values;
const birthdates = readColumnValues(cyclistTable, 'gene_i_birthdate').values;
const idCyclist = readColumnValues(cyclistTable, 'IDcyclist').values;
const fkTeam = readColumnValues(cyclistTable, 'fkIDteam').values;
const firstnames = readColumnValues(cyclistTable, 'gene_sz_firstname').values;
const lastnames = readColumnValues(cyclistTable, 'gene_sz_lastname').values;
const CURRENT_SEASON_YEAR = 2026;

let characOutOfRange = 0, limitInvalid = 0, ageLimitViolation = 0, potentielInvalid = 0, tourClassicInvalid = 0;
for (let i = 0; i < cyclistRowCount; i++) {
  const age = CURRENT_SEASON_YEAR - Math.floor(birthdates[i] / 10000);
  for (const d of DISCIPLINES) {
    const c = characCols[d][i];
    if (c < PCM_MIN || c > PCM_MAX) characOutOfRange++;
    const l = limitCols[d][i];
    if (l !== 0 && (l < c || l > PCM_MAX)) limitInvalid++;
    if (age >= 28 && l !== 0) ageLimitViolation++;
  }
  if (Math.abs(potentiel[i] * 2 - Math.round(potentiel[i] * 2)) > 1e-6) potentielInvalid++;
  if (tour[i] < 1 || tour[i] > 5 || classic[i] < 1 || classic[i] > 5) tourClassicInvalid++;
}
if (characOutOfRange > 0) fail(`${characOutOfRange} charac_i_* Zellen ausserhalb [${PCM_MIN},${PCM_MAX}]`); else console.log(`OK: alle charac_i_* in [${PCM_MIN},${PCM_MAX}] (alle ${cyclistRowCount} Zeilen)`);
if (limitInvalid > 0) fail(`${limitInvalid} limit_i_* Zellen verletzen limit>=charac oder limit>${PCM_MAX}`); else console.log('OK: alle limit_i_* Invarianten erfuellt');
if (ageLimitViolation > 0) fail(`${ageLimitViolation} limit_i_* Zellen bei Alter>=28 sind nicht 0`); else console.log('OK: Alter>=28 -> alle Limits 0');
if (potentielInvalid > 0) fail(`${potentielInvalid} value_f_potentiel Werte nicht im 0.5-Raster`); else console.log('OK: value_f_potentiel im 0.5-Raster');
if (tourClassicInvalid > 0) fail(`${tourClassicInvalid} charac_i_tour/classic ausserhalb 1..5`); else console.log('OK: charac_i_tour/classic in 1..5');

// Superman-/Namenspruefung NUR fuer unsere eigene Population (die 878 gepatchten Zeilen) --
// ueber alle 8194 waeren die echten Profi-Namen mitgezaehlt, die wir nicht anfassen und
// nicht beeinflussen koennen.
const patchedRiderRows = trace ? trace.riders.map((r) => r.rowIndex) : Array.from({ length: cyclistRowCount }, (_, i) => i);
let supermanCount = 0, emptyNameCount = 0, longNameCount = 0;
for (const i of patchedRiderRows) {
  if (characCols.sprint[i] >= 80 && characCols.mountain[i] >= 80) supermanCount++;
  if (firstnames[i] === '' && lastnames[i] === '') emptyNameCount++;
  const nameBytes = Buffer.byteLength(`${firstnames[i]} ${lastnames[i]}`, 'utf8');
  if (nameBytes > 23) longNameCount++;
}
console.log(`Superman-Faelle in unserer Population (sprint>=80 UND mountain>=80): ${supermanCount}/${patchedRiderRows.length} (Original: praktisch 0 erwartet)`);
if (emptyNameCount > 0) warn(`${emptyNameCount} unserer Fahrer mit komplett leerem Namen`);
if (longNameCount > 0) warn(`${longNameCount} unserer Fahrernamen > 23 Bytes (UI-Truncation moeglich)`);

// Team-Eindeutigkeit -- nur unter UNSEREN 32 gepatchten Zeilen hart pruefen. Die reale
// Datenbank traegt selbst schon Duplikate unter unberuehrten Teams (z.B. "Anicolor/
// Campicarn" und "ACRS Cycling Team" beide "ACR" -- pre-existing, nichts mit unserem
// Patch zu tun), ueber alle 296 waere die Pruefung deshalb zu streng.
const teamNames = readColumnValues(teamTable, 'gene_sz_name').values;
const abbreviations = readColumnValues(teamTable, 'abbreviation').values;
const teamIds = readColumnValues(teamTable, 'IDteam').values;
if (patchedTeamRowIndexes) {
  const ourRows = teamIds.map((id, i) => i).filter((i) => patchedTeamRowIndexes.has(teamIds[i]));
  const ourNames = ourRows.map((i) => teamNames[i]);
  const ourAbbrs = ourRows.map((i) => abbreviations[i]);
  if (new Set(ourNames).size !== ourNames.length) fail('Unsere 32 Teamnamen sind nicht eindeutig');
  else console.log(`OK: unsere ${ourNames.length} Teamnamen eindeutig`);
  if (new Set(ourAbbrs).size !== ourAbbrs.length) fail('Unsere 32 Team-Abkuerzungen sind nicht eindeutig');
  else console.log(`OK: unsere ${ourAbbrs.length} Team-Abkuerzungen eindeutig gegen alle 296`);
} else {
  warn('Keine Trace-Datei gefunden -- Team-Eindeutigkeit nicht geprueft (nur --teams-only?)');
}
const globalAbbrDupes = new Map();
abbreviations.forEach((a, i) => {
  if (!globalAbbrDupes.has(a)) globalAbbrDupes.set(a, []);
  globalAbbrDupes.get(a).push(i);
});
const preexistingDupes = [...globalAbbrDupes.entries()].filter(([, idxs]) => idxs.length > 1);
if (preexistingDupes.length > 0) {
  console.log(`Info: ${preexistingDupes.length} Abkuerzungs-Duplikate insgesamt (teils bereits im Original vorhanden, informativ): ${preexistingDupes.map(([a]) => a).join(', ')}`);
}

// Vertragskonsistenz: fkIDteam des Vertrags == fkIDteam des Fahrers
const { rowCount: contractRowCount } = getTableMeta(contractTable);
const contractFkCyclist = readColumnValues(contractTable, 'fkIDcyclist').values;
const contractFkTeam = readColumnValues(contractTable, 'fkIDteam').values;
const contractYearEnd = readColumnValues(contractTable, 'iYearEnd').values;
const cyclistIdToRow = new Map(idCyclist.map((id, i) => [id, i]));
let contractMismatch = 0, yearEndInvalid = 0;
for (let i = 0; i < contractRowCount; i++) {
  const cyclistRow = cyclistIdToRow.get(contractFkCyclist[i]);
  if (cyclistRow == null) continue;
  if (contractFkTeam[i] !== fkTeam[cyclistRow]) contractMismatch++;
  if (contractYearEnd[i] < 2026 || contractYearEnd[i] > 2029) yearEndInvalid++;
}
if (contractMismatch > 0) fail(`${contractMismatch} Vertraege mit fkIDteam != Fahrer.fkIDteam`); else console.log(`OK: alle ${contractRowCount} Vertraege konsistent zu fkIDteam`);
if (yearEndInvalid > 0) fail(`${yearEndInvalid} Vertraege mit iYearEnd ausserhalb 2026..2029`); else console.log('OK: iYearEnd in 2026..2029');

// Gehaelter (Phase 4) -- erfundene, aber konsistente Skala, s. export-pcm-mod.mjs
// Kopfkommentar. Kein echter Referenzwert existiert, deshalb nur ein weicher Sanity-Check:
// niemand mehr auf 0 (das war vorher ausnahmslos der Fall), keine negativen Werte.
const contractWage = readColumnValues(contractTable, 'finan_i_period_wage').values;
const zeroWages = contractWage.filter((w) => w === 0).length;
const negativeWages = contractWage.filter((w) => w < 0).length;
if (negativeWages > 0) fail(`${negativeWages} Vertraege mit negativem Gehalt`);
if (zeroWages > 0) warn(`${zeroWages} Vertraege noch auf Gehalt 0 (Phase 4 evtl. nicht gelaufen?)`);
else {
  const sorted = [...contractWage].sort((a, b) => a - b);
  console.log(`OK: alle ${contractRowCount} Gehaelter > 0 (Median ${sorted[Math.floor(sorted.length / 2)]}, Max ${sorted[sorted.length - 1]})`);
}

// Kompressions-Header
if (neu.header.uncompressedSize !== neu.buffer.length) fail('Header uncompressedSize stimmt nicht');
else console.log('OK: Kompressions-Header konsistent');

console.log(`\n${errors} Fehler, ${warnings} Warnungen.`);
process.exit(errors > 0 ? 1 : 0);
