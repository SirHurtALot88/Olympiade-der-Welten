// Erzeugt references/pcm-2026/reference-stats.json aus einer echten WorldDB -- kleine
// Kennzahlen (keine Rohdaten), damit das Mapping-Modul nachvollziehbar bleibt, ohne Chris'
// lizenzierte .cdb selbst zu committen (plan.md 6.14).
import { writeFileSync, mkdirSync } from 'node:fs';
import { readCdb, parseTree, findTableChunk, getTableMeta, readColumnValues } from './cdb-format.mjs';
import { DISCIPLINES, WT_SLOT_STRENGTH_ORDER, PT_SLOT_STRENGTH_ORDER } from './oly-pcm-mapping.mjs';

const cdbPath = process.argv[2];
if (!cdbPath) {
  console.error('Nutzung: node dump-reference-stats.mjs <pfad-zur-OfficialRelease.cdb>');
  process.exit(1);
}

function quantiles(sorted, qs) {
  const n = sorted.length;
  return qs.map((q) => sorted[Math.min(n - 1, Math.round(q * (n - 1)))]);
}

const { buffer } = readCdb(cdbPath);
const tree = parseTree(buffer);
const teamTable = findTableChunk(tree, 'DYN_team');
const cyclistTable = findTableChunk(tree, 'DYN_cyclist');

const teamIds = readColumnValues(teamTable, 'IDteam').values;
const divisions = readColumnValues(teamTable, 'fkIDdivision').values;
const wtTeamIds = new Set(teamIds.filter((_, i) => divisions[i] === 10));
const ptTeamIds = new Set(teamIds.filter((_, i) => divisions[i] === 11));

const { rowCount } = getTableMeta(cyclistTable);
const fkTeam = readColumnValues(cyclistTable, 'fkIDteam').values;
const potentiel = readColumnValues(cyclistTable, 'value_f_potentiel').values;
const tour = readColumnValues(cyclistTable, 'charac_i_tour').values;
const classic = readColumnValues(cyclistTable, 'charac_i_classic').values;
const characCols = Object.fromEntries(DISCIPLINES.map((d) => [d, readColumnValues(cyclistTable, `charac_i_${d}`).values]));

const wtLevels = [], ptLevels = [], withinSds = [], potentielAll = [], tourAll = [], classicAll = [];
for (let i = 0; i < rowCount; i++) {
  const inWt = wtTeamIds.has(fkTeam[i]);
  const inPt = ptTeamIds.has(fkTeam[i]);
  if (!inWt && !inPt) continue;
  const vals = DISCIPLINES.map((d) => characCols[d][i]);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  (inWt ? wtLevels : ptLevels).push(mean);
  withinSds.push(Math.sqrt(variance));
  potentielAll.push(potentiel[i]);
  tourAll.push(tour[i]);
  classicAll.push(classic[i]);
}
withinSds.sort((a, b) => a - b);
const wtSorted = [...wtLevels].sort((a, b) => a - b);
const ptSorted = [...ptLevels].sort((a, b) => a - b);

function counts(arr) {
  const out = {};
  for (const v of arr) out[v] = (out[v] || 0) + 1;
  return out;
}

const out = {
  generatedFrom: 'echte WorldDB 2026 (.cdb), s. plan.md Abschnitt 0',
  rowCounts: { worldTour: wtLevels.length, proTeams: ptLevels.length, total: wtLevels.length + ptLevels.length },
  levelQuantiles: {
    worldTour: quantiles(wtSorted, [0, 0.1, 0.5, 0.9, 0.99, 1]),
    proTeams: quantiles(ptSorted, [0, 0.1, 0.5, 0.9, 0.99, 1]),
  },
  withinPlayerSdMedian: withinSds[Math.floor(withinSds.length / 2)],
  potentielDistribution: counts(potentielAll),
  tourDistribution: counts(tourAll),
  classicDistribution: counts(classicAll),
  wtSlotStrengthOrder: WT_SLOT_STRENGTH_ORDER,
  ptSlotStrengthOrder: PT_SLOT_STRENGTH_ORDER,
};

mkdirSync('references/pcm-2026', { recursive: true });
writeFileSync('references/pcm-2026/reference-stats.json', JSON.stringify(out, null, 2));
console.log('Geschrieben: references/pcm-2026/reference-stats.json');
console.log(JSON.stringify(out, null, 2));
