import { readCdb, assertRoundTrip, listTableNames, getTableMeta, findTableChunk, readColumnValues } from './cdb-format.mjs';

const path = process.argv[2];
if (!path) {
  console.error('Nutzung: node self-test.mjs <pfad-zu-OfficialRelease.cdb>');
  process.exit(1);
}

console.log(`Lade ${path} ...`);
const { header, buffer } = readCdb(path);
console.log(`Header: uncompressed=${header.uncompressedSize} compressed=${header.compressedSize}, tatsaechlich dekomprimiert=${buffer.length}`);

console.log('Parse + serialisiere erneut, vergleiche byte-fuer-byte ...');
const tree = assertRoundTrip(buffer);
console.log('OK: Roundtrip ist byte-identisch.');

const tableNames = listTableNames(tree);
console.log(`\n${tableNames.length} Tabellen gefunden.`);

for (const name of ['DYN_cyclist', 'DYN_team', 'DYN_contract_cyclist']) {
  const t = findTableChunk(tree, name);
  if (!t) {
    console.log(`  ${name}: NICHT GEFUNDEN`);
    continue;
  }
  const meta = getTableMeta(t);
  console.log(`  ${name}: tableId=${meta.tableId} rowCount=${meta.rowCount} Spalten=${meta.columns.length}`);
}

const cyclistTable = findTableChunk(tree, 'DYN_cyclist');
const names = readColumnValues(cyclistTable, 'gene_sz_firstlastname');
console.log(`\nBeispiel-Fahrernamen: ${names.values.slice(0, 5).join(', ')}`);
const teamIds = readColumnValues(cyclistTable, 'fkIDteam');
console.log(`Beispiel fkIDteam: ${teamIds.values.slice(0, 5).join(', ')}`);
