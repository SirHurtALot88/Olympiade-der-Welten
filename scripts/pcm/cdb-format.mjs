// Parser/Serializer fuer Pro Cycling Manager 2026s WorldDB-Format (`.cdb`).
//
// Format (empirisch ermittelt am 05.09.2026 an einer echten WorldDB, s. plan.md):
//   Datei = 12-Byte-Header (u32 0xFFFFFFFF, u32 uncompressedSize, u32 compressedSize)
//           + zlib-Stream (Standard-zlib-Wrapper, NICHT raw deflate).
//   Baum aus "Chunks": jeder Chunk = AAAAAAAA + u32 totalSize + u32 type + u32 flags
//           + u32 descPresent [+ u32 descLen + UTF-8-Bytes + NUL, auf 4 aufgerundet]
//           + BBBBBBBB + Daten [+ Padding auf 4] + CCCCCCCC.
//   totalSize ist damit die alleinige Autoritaet fuer die Chunk-Grenze -- die schliessende
//   CCCCCCCC sitzt IMMER exakt 4 Bytes vor `offset + totalSize` (kein Rueckwaerts-Scan noetig).
//
// Die gesamte Datenbank benutzt nur 13 Chunk-Typen (Root/Version/Tabellen-Array/Tabelle/
// TabellenId/Zeilenzahl/Flags/Spalten-Array/Spalte/Spalten-Index/Spalten-Datentyp/
// Spalten-Werte/Spalten-Blob) -- Tabellen unterscheiden sich nur durch ihre Spaltendaten,
// nicht durch neue Chunk-Typen. Container- vs. Leaf-Klassifikation ist deshalb eine feste
// Tabelle, kein Rateversuch pro Chunk.

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

export const CHUNK_TYPE = {
  ROOT: 0x00,
  TABLES_ARRAY: 0x01,
  VERSION: 0x02,
  TABLE: 0x10,
  ROW_COUNT: 0x11,
  COLUMNS_ARRAY: 0x12,
  TABLE_ID: 0x15,
  TABLE_FLAGS: 0x16,
  COLUMN: 0x20,
  COLUMN_DATA_TYPE: 0x21,
  COLUMN_VALUES: 0x22,
  COLUMN_BLOB_DATA: 0x23,
  COLUMN_INDEX: 0x24,
};

const CONTAINER_TYPES = new Set([CHUNK_TYPE.ROOT, CHUNK_TYPE.TABLES_ARRAY, CHUNK_TYPE.TABLE, CHUNK_TYPE.COLUMNS_ARRAY, CHUNK_TYPE.COLUMN]);
const ARRAY_TYPES = new Set([CHUNK_TYPE.TABLES_ARRAY, CHUNK_TYPE.COLUMNS_ARRAY]);

export const DATA_TYPES = {
  0: 'INTEGER',
  1: 'FLOAT',
  2: 'STRING',
  3: 'BOOLEAN',
  4: 'BYTE_INT',
  5: 'SHORT_INT',
  10: 'FLOAT_LIST',
  11: 'INTEGER_LIST',
};

const MAGIC_CHUNK = 0xaaaaaaaa;
const MAGIC_SEP = 0xbbbbbbbb;
const MAGIC_CLOSE = 0xcccccccc;
const MAGIC_ARRAY_OPEN = 0xdddddddd;
const MAGIC_ARRAY_CLOSE = 0xeeeeeeee;

function align4(n) {
  return (n + 3) & ~3;
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

// ---- Parsing --------------------------------------------------------------

// Parses one chunk at `offset`. Returns { chunk, nextOffset }.
function parseChunk(buf, offset) {
  const magic = buf.readUInt32LE(offset);
  if (magic !== MAGIC_CHUNK) {
    throw new Error(`Erwartete Chunk-Magic 0xAAAAAAAA bei Offset ${offset}, fand 0x${magic.toString(16)}`);
  }
  const totalSize = buf.readUInt32LE(offset + 4);
  const type = buf.readUInt32LE(offset + 8);
  const flags = buf.readUInt32LE(offset + 12);
  const descPresent = buf.readUInt32LE(offset + 16);
  let desc = null;
  let pos = offset + 20;
  if (descPresent) {
    const descLen = buf.readUInt32LE(pos);
    pos += 4;
    if (descLen > 0) {
      desc = buf.toString('utf8', pos, pos + descLen - 1);
      pos += descLen;
    } else {
      desc = '';
    }
    pos = offset + align4(pos - offset);
  }
  const sep = buf.readUInt32LE(pos);
  if (sep !== MAGIC_SEP) {
    throw new Error(`Erwartete 0xBBBBBBBB bei ${pos}, fand 0x${sep.toString(16)} (Chunk-Typ 0x${type.toString(16)} bei ${offset})`);
  }
  const dataStart = pos + 4;
  const nextOffset = offset + totalSize;

  let dataEnd = nextOffset - 4;
  if (buf.readUInt32LE(dataEnd) !== MAGIC_CLOSE) {
    // Fallback fuer unerwartete/unbekannte Layouts: rueckwaerts nach der schliessenden
    // Markierung suchen (fragiler, s. plan.md 4.4d) -- sollte in dieser Datei nie greifen.
    let scan = nextOffset - 4;
    while (scan > dataStart && buf.readUInt32LE(scan) !== MAGIC_CLOSE) scan--;
    if (buf.readUInt32LE(scan) !== MAGIC_CLOSE) {
      throw new Error(`Keine 0xCCCCCCCC-Markierung fuer Chunk bei ${offset} (Typ 0x${type.toString(16)}) gefunden`);
    }
    dataEnd = scan;
  }

  const isContainer = CONTAINER_TYPES.has(type);
  const isArray = ARRAY_TYPES.has(type);

  if (!isContainer) {
    const raw = Buffer.from(buf.subarray(dataStart, dataEnd));
    return { chunk: { type, desc, flags, isArray: false, children: null, raw }, nextOffset };
  }

  const children = [];
  if (isArray) {
    let p = dataStart;
    const openMarker = buf.readUInt32LE(p);
    if (openMarker !== MAGIC_ARRAY_OPEN) {
      throw new Error(`Erwartete 0xDDDDDDDD bei ${p} (Array-Chunk Typ 0x${type.toString(16)} bei ${offset})`);
    }
    p += 4;
    const declaredCount = buf.readUInt32LE(p);
    p += 4;
    while (p < dataEnd) {
      const marker = buf.readUInt32LE(p);
      if (marker === MAGIC_ARRAY_CLOSE) {
        p += 4;
        break;
      }
      const { chunk: child, nextOffset: childNext } = parseChunk(buf, p);
      children.push(child);
      p = childNext;
    }
    if (children.length !== declaredCount) {
      throw new Error(`Array-Chunk bei ${offset}: deklarierte Anzahl ${declaredCount} != gelesene Kinder ${children.length}`);
    }
    if (p !== dataEnd) {
      throw new Error(`Array-Chunk bei ${offset}: Ende bei ${p}, erwartet ${dataEnd}`);
    }
  } else {
    let p = dataStart;
    while (p < dataEnd) {
      const { chunk: child, nextOffset: childNext } = parseChunk(buf, p);
      children.push(child);
      p = childNext;
    }
    if (p !== dataEnd) {
      throw new Error(`Container-Chunk bei ${offset}: Ende bei ${p}, erwartet ${dataEnd}`);
    }
  }

  return { chunk: { type, desc, flags, isArray, children, raw: null }, nextOffset };
}

export function parseTree(buffer) {
  const { chunk, nextOffset } = parseChunk(buffer, 0);
  if (nextOffset !== buffer.length) {
    throw new Error(`Root-Chunk endet bei ${nextOffset}, Puffer ist ${buffer.length} Bytes lang`);
  }
  return chunk;
}

// ---- Serializing ------------------------------------------------------------

export function serializeChunk(chunk) {
  let body;
  if (chunk.children != null) {
    const parts = [];
    if (chunk.isArray) {
      parts.push(u32(MAGIC_ARRAY_OPEN));
      parts.push(u32(chunk.children.length));
      for (const child of chunk.children) parts.push(serializeChunk(child));
      parts.push(u32(MAGIC_ARRAY_CLOSE));
    } else {
      for (const child of chunk.children) parts.push(serializeChunk(child));
    }
    body = Buffer.concat(parts);
  } else {
    body = chunk.raw;
  }

  let descPart = Buffer.alloc(0);
  const descPresent = chunk.desc != null ? 1 : 0;
  if (descPresent) {
    const descBytes = Buffer.from(chunk.desc, 'utf8');
    const descLen = descBytes.length + 1;
    const unpadded = Buffer.concat([u32(descLen), descBytes, Buffer.from([0])]);
    const padLen = align4(unpadded.length) - unpadded.length;
    descPart = padLen > 0 ? Buffer.concat([unpadded, Buffer.alloc(padLen)]) : unpadded;
  }

  const bodyPadLen = align4(body.length) - body.length;
  const dataPart = bodyPadLen > 0 ? Buffer.concat([body, Buffer.alloc(bodyPadLen)]) : body;

  const totalSize = 20 + descPart.length + 4 + dataPart.length + 4;

  return Buffer.concat([
    u32(MAGIC_CHUNK),
    u32(totalSize),
    u32(chunk.type),
    u32(chunk.flags || 0),
    u32(descPresent),
    descPart,
    u32(MAGIC_SEP),
    dataPart,
    u32(MAGIC_CLOSE),
  ]);
}

export function serializeTree(rootChunk) {
  return serializeChunk(rootChunk);
}

// ---- File I/O ---------------------------------------------------------------

export function readCdb(path) {
  const fileBuf = readFileSync(path);
  const magic = fileBuf.readUInt32LE(0);
  if (magic !== 0xffffffff) {
    throw new Error(`Unerwarteter Datei-Header in ${path}: 0x${magic.toString(16)} (erwartet 0xFFFFFFFF)`);
  }
  const uncompressedSize = fileBuf.readUInt32LE(4);
  const compressedSize = fileBuf.readUInt32LE(8);
  const compressed = fileBuf.subarray(12, 12 + compressedSize);
  const buffer = inflateSync(compressed);
  if (buffer.length !== uncompressedSize) {
    throw new Error(`Dekomprimierte Groesse ${buffer.length} != Header-Angabe ${uncompressedSize}`);
  }
  return { header: { uncompressedSize, compressedSize }, buffer };
}

export function writeCdb(path, buffer) {
  const compressed = deflateSync(buffer, { level: 9 });
  const check = inflateSync(compressed);
  if (!check.equals(buffer)) {
    throw new Error('Rekompressions-Kontrolle fehlgeschlagen: inflateSync(deflateSync(buffer)) != buffer');
  }
  const header = Buffer.concat([u32(0xffffffff), u32(buffer.length), u32(compressed.length)]);
  writeFileSync(path, Buffer.concat([header, compressed]));
  return { uncompressedSize: buffer.length, compressedSize: compressed.length };
}

// Pflicht-Selbsttest vor jeder Aenderung (plan.md 4.1): unveraendert geparst und wieder
// serialisiert muss byte-fuer-byte das Original ergeben.
export function assertRoundTrip(buffer) {
  const tree = parseTree(buffer);
  const out = serializeChunk(tree);
  if (out.length !== buffer.length) {
    throw new Error(`Roundtrip-Test fehlgeschlagen: Laenge ${out.length} != Original ${buffer.length}`);
  }
  if (!out.equals(buffer)) {
    let firstDiff = -1;
    for (let i = 0; i < buffer.length; i++) {
      if (out[i] !== buffer[i]) {
        firstDiff = i;
        break;
      }
    }
    throw new Error(`Roundtrip-Test fehlgeschlagen: erste Abweichung bei Byte ${firstDiff} (original 0x${buffer[firstDiff].toString(16)}, neu 0x${out[firstDiff].toString(16)})`);
  }
  return tree;
}

// ---- Semantische Sicht auf Tabellen/Spalten/Zeilen ---------------------------

function findChild(chunk, type) {
  return chunk.children.find((c) => c.type === type) || null;
}

export function findTableChunk(rootChunk, tableName) {
  const tablesArray = findChild(rootChunk, CHUNK_TYPE.TABLES_ARRAY);
  return tablesArray.children.find((t) => t.desc === tableName) || null;
}

export function listTableNames(rootChunk) {
  const tablesArray = findChild(rootChunk, CHUNK_TYPE.TABLES_ARRAY);
  return tablesArray.children.map((t) => t.desc);
}

export function getTableMeta(tableChunk) {
  const idChunk = findChild(tableChunk, CHUNK_TYPE.TABLE_ID);
  const rowCountChunk = findChild(tableChunk, CHUNK_TYPE.ROW_COUNT);
  const flagsChunk = findChild(tableChunk, CHUNK_TYPE.TABLE_FLAGS);
  const columnsArray = findChild(tableChunk, CHUNK_TYPE.COLUMNS_ARRAY);
  return {
    tableId: idChunk.raw.readInt32LE(0),
    rowCount: rowCountChunk.raw.readInt32LE(0),
    tableFlags: flagsChunk.raw.readInt32LE(0),
    columns: columnsArray.children,
  };
}

export function getColumnChunk(tableChunk, columnName) {
  const { columns } = getTableMeta(tableChunk);
  return columns.find((c) => c.desc === columnName) || null;
}

export function getColumnMeta(columnChunk) {
  const indexChunk = findChild(columnChunk, CHUNK_TYPE.COLUMN_INDEX);
  const dataTypeChunk = findChild(columnChunk, CHUNK_TYPE.COLUMN_DATA_TYPE);
  const valuesChunk = findChild(columnChunk, CHUNK_TYPE.COLUMN_VALUES);
  const blobChunk = findChild(columnChunk, CHUNK_TYPE.COLUMN_BLOB_DATA);
  return {
    index: indexChunk.raw.readInt32LE(0),
    dataType: dataTypeChunk.raw.readInt32LE(0),
    valuesChunk,
    blobChunk,
  };
}

export function readColumnValues(tableChunk, columnName) {
  const { rowCount } = getTableMeta(tableChunk);
  const columnChunk = getColumnChunk(tableChunk, columnName);
  if (!columnChunk) throw new Error(`Spalte "${columnName}" nicht gefunden`);
  const { dataType, valuesChunk, blobChunk } = getColumnMeta(columnChunk);
  const typeName = DATA_TYPES[dataType] || `UNKNOWN(${dataType})`;
  if (!valuesChunk) return { typeName, dataType, values: rowCount === 0 ? [] : null };
  const vc = valuesChunk.raw;

  if (dataType === 0) {
    const values = [];
    for (let i = 0; i < rowCount; i++) values.push(vc.readInt32LE(i * 4));
    return { typeName, dataType, values };
  }
  if (dataType === 1) {
    const values = [];
    for (let i = 0; i < rowCount; i++) values.push(vc.readFloatLE(i * 4));
    return { typeName, dataType, values };
  }
  if (dataType === 4) {
    const values = [];
    for (let i = 0; i < rowCount; i++) values.push(vc.readInt8(i));
    return { typeName, dataType, values };
  }
  if (dataType === 5) {
    const values = [];
    for (let i = 0; i < rowCount; i++) values.push(vc.readUInt16LE(i * 2));
    return { typeName, dataType, values };
  }
  if (dataType === 2) {
    if (!blobChunk) {
      if (rowCount === 0) return { typeName, dataType, values: [] };
      throw new Error(`STRING-Spalte "${columnName}" hat ${rowCount} Zeilen, aber keinen Blob-Chunk`);
    }
    const lengths = [];
    for (let i = 0; i < rowCount; i++) lengths.push(vc.readUInt32LE(i * 4));
    const blob = blobChunk.raw;
    const blobSize = blob.readUInt32LE(0);
    const sumLengths = lengths.reduce((a, b) => a + b, 0);
    if (sumLengths !== blobSize) {
      throw new Error(`STRING-Spalte "${columnName}": sum(lengths)=${sumLengths} != blobSize=${blobSize}`);
    }
    let pos = 4;
    const values = [];
    for (const len of lengths) {
      if (len === 0) {
        values.push('');
        continue;
      }
      values.push(blob.toString('utf8', pos, pos + len - 1));
      pos += len;
    }
    return { typeName, dataType, values };
  }
  if (dataType === 3) {
    const values = [];
    for (let i = 0; i < rowCount; i++) {
      const byte = vc.readUInt8(i >> 3);
      values.push(!!((byte >> (i & 7)) & 1));
    }
    return { typeName, dataType, values };
  }
  return { typeName, dataType, values: null, note: 'Listentyp, nicht dekodiert' };
}

// ---- Zellen schreiben ---------------------------------------------------------

export function setIntegerCell(tableChunk, columnName, rowIndex, value) {
  const columnChunk = getColumnChunk(tableChunk, columnName);
  const { dataType, valuesChunk } = getColumnMeta(columnChunk);
  if (dataType !== 0) throw new Error(`Spalte "${columnName}" ist kein INTEGER (Typ ${dataType})`);
  valuesChunk.raw.writeInt32LE(value | 0, rowIndex * 4);
}

export function setFloatCell(tableChunk, columnName, rowIndex, value) {
  const columnChunk = getColumnChunk(tableChunk, columnName);
  const { dataType, valuesChunk } = getColumnMeta(columnChunk);
  if (dataType !== 1) throw new Error(`Spalte "${columnName}" ist kein FLOAT (Typ ${dataType})`);
  valuesChunk.raw.writeFloatLE(value, rowIndex * 4);
}

export function setByteCell(tableChunk, columnName, rowIndex, value) {
  const columnChunk = getColumnChunk(tableChunk, columnName);
  const { dataType, valuesChunk } = getColumnMeta(columnChunk);
  if (dataType !== 4) throw new Error(`Spalte "${columnName}" ist kein BYTE_INT (Typ ${dataType})`);
  valuesChunk.raw.writeInt8(value, rowIndex);
}

export function setShortCell(tableChunk, columnName, rowIndex, value) {
  const columnChunk = getColumnChunk(tableChunk, columnName);
  const { dataType, valuesChunk } = getColumnMeta(columnChunk);
  if (dataType !== 5) throw new Error(`Spalte "${columnName}" ist kein SHORT_INT (Typ ${dataType})`);
  valuesChunk.raw.writeUInt16LE(value, rowIndex * 2);
}

// Ersetzt ALLE Zellen einer STRING-Spalte (die Spalte wird komplett neu aufgebaut, s.
// plan.md 4.2 -- Laengen- und Blob-Chunk haengen zusammen und muessen synchron bleiben).
export function setColumnStrings(tableChunk, columnName, values) {
  const { rowCount } = getTableMeta(tableChunk);
  if (values.length !== rowCount) {
    throw new Error(`setColumnStrings("${columnName}"): ${values.length} Werte != rowCount ${rowCount}`);
  }
  const columnChunk = getColumnChunk(tableChunk, columnName);
  const { dataType, valuesChunk } = getColumnMeta(columnChunk);
  if (dataType !== 2) throw new Error(`Spalte "${columnName}" ist kein STRING (Typ ${dataType})`);

  const lengths = values.map((v) => Buffer.byteLength(v, 'utf8') + 1);
  const lengthsBuf = Buffer.alloc(lengths.length * 4);
  lengths.forEach((len, i) => lengthsBuf.writeUInt32LE(len, i * 4));

  const blobSize = lengths.reduce((a, b) => a + b, 0);
  const blobParts = [u32(blobSize)];
  for (const v of values) {
    blobParts.push(Buffer.from(v, 'utf8'));
    blobParts.push(Buffer.from([0]));
  }
  const blobBuf = Buffer.concat(blobParts);

  valuesChunk.raw = lengthsBuf;
  const blobChunk = findChild(columnChunk, CHUNK_TYPE.COLUMN_BLOB_DATA);
  if (blobChunk) {
    blobChunk.raw = blobBuf;
  } else {
    columnChunk.children.push({ type: CHUNK_TYPE.COLUMN_BLOB_DATA, desc: null, flags: 0, isArray: false, children: null, raw: blobBuf });
  }
}

export function rowIndexById(tableChunk, idColumnName, id) {
  const { values } = readColumnValues(tableChunk, idColumnName);
  return values.indexOf(id);
}
