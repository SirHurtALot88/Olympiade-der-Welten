import { readCdb, parseTree, findTableChunk, getTableMeta, getColumnMeta, readColumnValues, DATA_TYPES } from './cdb-format.mjs';

const path = process.argv[2];
const tableName = process.argv[3];
const { buffer } = readCdb(path);
const tree = parseTree(buffer);
const table = findTableChunk(tree, tableName);
const meta = getTableMeta(table);
console.log(`${tableName}: rowCount=${meta.rowCount}`);
for (const col of meta.columns) {
  const cm = getColumnMeta(col);
  let sample = '';
  try {
    const { values } = readColumnValues(table, col.desc);
    sample = JSON.stringify(values ? values.slice(0, 3) : null);
  } catch (e) {
    sample = `ERR: ${e.message}`;
  }
  console.log(`  idx=${cm.index}\ttype=${DATA_TYPES[cm.dataType] || cm.dataType}\t${col.desc}\t${sample}`);
}
