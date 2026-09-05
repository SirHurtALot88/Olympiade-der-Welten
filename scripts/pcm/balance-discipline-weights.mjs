// Baut eine neue DISCIPLINE_WEIGHTS-Tabelle: (1) Chris' drei Vorgaben (mountain->power,
// sprint->speed, plain->speed dominant), (2) danach IPF-Ausgleich (Iterative Proportional
// Fitting), damit am Ende jedes der 12 Attribute ueber alle 13 Disziplinen moeglichst
// gleich viel Gesamtgewicht traegt -- ohne die Zeilensumme (100 je Disziplin) zu brechen.

const ATTRS = ['power', 'health', 'determination', 'stamina', 'speed', 'dexterity', 'awareness', 'intelligence', 'will', 'charisma', 'spirit', 'torment'];

// Qualitative Staerke-Codes -> Startgewicht (IPF skaliert das anschliessend passend).
const P = 6.0;   // primary (dominant)
const S = 2.4;   // secondary
const T = 1.1;   // tertiary
const R = 0.4;   // trace (kommt vor, zaehlt aber kaum)

// 13 unabhaengig gewichtete Disziplinen (medium_mountain bleibt Mittel aus mountain+hill).
const SEED = {
  mountain:      { power: P, stamina: S, determination: S, will: T, health: T, dexterity: R, awareness: R },
  timetrial:     { dexterity: P, speed: S, intelligence: S, stamina: T, awareness: T, torment: R, power: R },
  sprint:        { speed: P, power: S, determination: S, torment: S, dexterity: T, charisma: R, awareness: R },
  hill:          { power: P, determination: S, speed: S, will: T, torment: T, awareness: R },
  plain:         { speed: P, power: S, stamina: S, health: T, charisma: R, awareness: R },
  prologue:      { speed: P, power: S, dexterity: S, intelligence: T, torment: T, charisma: R },
  acceleration:  { power: P, speed: S, torment: S, determination: T, dexterity: R },
  endurance:     { stamina: P, health: S, will: S, spirit: T, determination: R, intelligence: R },
  resistance:    { will: P, stamina: S, health: S, determination: T, spirit: R, torment: R },
  recuperation:  { health: P, spirit: S, stamina: T, intelligence: T, will: R },
  cobble:        { health: P, power: S, dexterity: S, will: T, determination: R, stamina: R },
  downhilling:   { dexterity: P, awareness: S, torment: S, speed: T, intelligence: T, spirit: R },
  baroudeur:     { will: P, determination: S, torment: S, stamina: T, charisma: T, spirit: R, awareness: R },
};

const disciplines = Object.keys(SEED);

// Die drei seltensten Attribute (charisma/intelligence/spirit) tauchen im obigen Entwurf
// nur in 4-5 von 13 Zeilen auf -- der Ausgleich unten muesste ihr Spaltenziel dann auf
// wenige Zellen konzentrieren und wuerde sie dort zur groessten Kraft aufblasen (bricht
// Chris' Vorgaben mountain->power/sprint+plain->speed). Deshalb zuerst ueberall, wo sie
// noch fehlen, mit einer Spur ergaenzen (jede Disziplin hat ein bisschen Kopfsache/
// Nervenstaerke/Ausstrahlung) -- verteilt die Zielsumme auf mehr Zellen, bevor der
// eigentliche Ausgleich beginnt.
for (const d of disciplines) {
  for (const a of ['charisma', 'intelligence', 'spirit']) {
    if (!SEED[d][a]) SEED[d][a] = R;
  }
}

const matrix = disciplines.map((d) => ATTRS.map((a) => SEED[d][a] || 0));

const rowTarget = 100;
const colTarget = (disciplines.length * rowTarget) / ATTRS.length; // 1300/12

function colSums(m) { return ATTRS.map((_, j) => m.reduce((s, row) => s + row[j], 0)); }

// Gedaempftes IPF: volle Konvergenz wuerde die Spaltensummen exakt gleich machen, aber
// dabei die urspruengliche Rangordnung INNERHALB einer Zeile ueber den Haufen werfen (ein
// selten vorkommendes Attribut muesste sich dann auf wenige Zellen konzentrieren und dort
// alles andere ueberstrahlen -- genau das soll mountain/sprint/plain NICHT passieren).
// Deshalb pro Iteration nur einen Bruchteil (DAMPING) des Korrekturfaktors anwenden.
// ITERATIONS bewusst klein (voller Ausgleich/hohe Iterationszahl konvergiert IMMER auf
// exakt gleiche Spaltensummen -- das Daempfen allein aendert nur die Geschwindigkeit, nicht
// den Fixpunkt. Erst der fruehe Abbruch verhindert, dass seltene Attribute wie charisma
// mountain/sprint/plain die Vorgabe wegnehmen. 4 Iterationen: mountain/sprint/plain klar
// power/speed-gefuehrt (>=30% Vorsprung vor Platz 2), Spaltensummen 91-131 statt 12-190).
const DAMPING = 0.35;
const ITERATIONS = 4;
let m = matrix.map((row) => row.slice());
for (let iter = 0; iter < ITERATIONS; iter++) {
  m = m.map((row) => {
    const s = row.reduce((a, b) => a + b, 0);
    return s === 0 ? row : row.map((v) => (v / s) * rowTarget);
  });
  const cs = colSums(m);
  m = m.map((row) => row.map((v, j) => {
    if (cs[j] === 0 || v === 0) return v;
    const factor = 1 + DAMPING * (colTarget / cs[j] - 1);
    return v * factor;
  }));
}
// Letzter Zeilen-Normierungsschritt, damit rowSum wieder exakt 100 ist.
m = m.map((row) => {
  const s = row.reduce((a, b) => a + b, 0);
  return s === 0 ? row : row.map((v) => (v / s) * rowTarget);
});

// Ganzzahlig runden mit "largest remainder", damit jede Zeile exakt 100 ergibt.
function roundRowToInt(row) {
  const floors = row.map(Math.floor);
  const deficit = rowTarget - floors.reduce((a, b) => a + b, 0);
  const remainders = row.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac);
  const out = floors.slice();
  for (let k = 0; k < deficit; k++) out[remainders[k].i] += 1;
  return out;
}
const intMatrix = m.map(roundRowToInt);

console.log('// --- Ergebnis: geglaettete DISCIPLINE_WEIGHTS ---\n');
disciplines.forEach((d, i) => {
  const parts = ATTRS.map((a, j) => [a, intMatrix[i][j]]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  console.log(`  ${d}: { ${parts.map(([a, v]) => `${a}: ${v}`).join(', ')} },`);
});

console.log('\n// --- Spaltensummen (Ziel je Attribut: ' + colTarget.toFixed(1) + ') ---');
const finalCols = colSums(intMatrix);
ATTRS.forEach((a, j) => console.log(`  ${a}: ${finalCols[j]}`));

console.log('\n// --- Zeilensummen (muss ueberall 100 sein) ---');
disciplines.forEach((d, i) => console.log(`  ${d}: ${intMatrix[i].reduce((a, b) => a + b, 0)}`));
