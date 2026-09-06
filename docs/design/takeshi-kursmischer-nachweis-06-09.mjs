// Nachweis fuer die Haertung der Kurs-Auswahl in bauSpurt (battle-mode.engine.js).
//
//   node docs/design/takeshi-kursmischer-nachweis-06-09.mjs
//
// Befund (Opus-Review zu PR #810): die Auswahl eines der drei Takeshi-Kurse lief ueber
// EINEN LCG-Schritt auf der Renn-Saat. Das ist eine affine Abbildung — benachbarte
// ZAHLEN-Saaten landen danach 1664525/2^32 ~ 0,00039 auseinander, also fast immer im
// selben Drittel des Wertebereichs. Fortlaufende Saaten ziehen deshalb praktisch immer
// denselben Kurs.
//
// Das Skript rechnet die Kennzahl nach, mit der die Haertung begruendet ist:
//   P(gleicher Kurs bei Saat n und n+1)   Sollwert 1/3 = 0,3333
// dazu die Gleichverteilung ueber die drei Kurse und den Vergleich der Varianten, die
// im Kommentar in bauSpurt genannt sind.
//
// Der Produktivpfad ist von dem Fehler nicht betroffen (er uebergibt Text-Saaten, die
// normalisiereSaat durch FNV-1a schickt) — die letzte Tabelle zeigt das.

const KURSE = 3;
const N = 300000;

// --- die Mischer -----------------------------------------------------------------
// FNV-1a wie normalisiereSaat (Offset 2166136261, Prime 16777619), hier ueber die vier
// Bytes einer Zahl statt ueber die Zeichen eines Strings.
const fnvBytes = (n) => {
  let h = 2166136261;
  for (let i = 0; i < 4; i++) { h ^= (n >>> (i * 8)) & 255; h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const fnvText = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const lcgSchritt = (s0) => (Math.imul(s0, 1664525) + 1013904223) >>> 0;
const obenAus = (s0) => (s0 >>> 8) / 16777216;

const VARIANTEN = {
  'vorher: 1 LCG-Schritt':      (saat) => obenAus(lcgSchritt((saat >>> 0) || 1)),
  '2 LCG-Schritte':             (saat) => { let s = (saat >>> 0) || 1; for (let k = 0; k < 2; k++) s = lcgSchritt(s); return obenAus(s); },
  '3 LCG-Schritte':             (saat) => { let s = (saat >>> 0) || 1; for (let k = 0; k < 3; k++) s = lcgSchritt(s); return obenAus(s); },
  '4 LCG-Schritte':             (saat) => { let s = (saat >>> 0) || 1; for (let k = 0; k < 4; k++) s = lcgSchritt(s); return obenAus(s); },
  'FNV 1x, ohne LCG':           (saat) => obenAus(fnvBytes((saat >>> 0) || 1)),
  'FNV 1x + 1 LCG-Schritt':     (saat) => obenAus(lcgSchritt(fnvBytes((saat >>> 0) || 1) || 1)),
  'NACHHER: FNV 2x + 1 LCG':    (saat) => { let s = (saat >>> 0) || 1; for (let r = 0; r < 2; r++) s = fnvBytes(s) || 1; return obenAus(lcgSchritt(s)); },
};

// --- die Messung -----------------------------------------------------------------
function messe(f, start, schritt, n = N) {
  const zaehl = new Array(KURSE).fill(0);
  let gleich = 0, vorher = null;
  for (let i = 0; i < n; i++) {
    const k = Math.floor(f(start + i * schritt) * KURSE);
    zaehl[k]++;
    if (vorher !== null && k === vorher) gleich++;
    vorher = k;
  }
  return { verteilung: zaehl.map((x) => x / n), pGleich: gleich / (n - 1) };
}

const reihen = [
  ['Saat 1000, Schritt 1', 1000, 1],
  ['Saat 0, Schritt 1', 0, 1],
  ['Saat 5, Schritt 13', 5, 13],
  ['Saat 1337, Schritt 7919', 1337, 7919],
];

console.log('Kurs-Auswahl aus ZAHLEN-Saaten — P(gleicher Kurs wie bei der Vorgaengersaat)');
console.log('Sollwert 1/3 = 0,3333.  n = ' + N + ' Saaten je Zelle.\n');
process.stdout.write('Mischer'.padEnd(26));
for (const [name] of reihen) process.stdout.write(name.padEnd(26));
console.log('');
for (const [name, f] of Object.entries(VARIANTEN)) {
  process.stdout.write(name.padEnd(26));
  for (const [, start, schritt] of reihen) {
    const r = messe(f, start, schritt);
    process.stdout.write(r.pGleich.toFixed(4).padEnd(26));
  }
  console.log('');
}

console.log('\nGleichverteilung ueber die drei Kurse (Saat 1000, Schritt 1):');
for (const [name, f] of Object.entries(VARIANTEN)) {
  const r = messe(f, 1000, 1);
  console.log('  ' + name.padEnd(26) + r.verteilung.map((x) => x.toFixed(4)).join(' / '));
}

// Produktivpfad: Text-Saaten laufen erst durch normalisiereSaat (FNV-1a ueber die
// Zeichen), erreichen die Kurs-Auswahl also schon gemischt. Vorher wie nachher sauber —
// das ist der Grund, warum der Fehler im Spiel nie sichtbar war.
console.log('\nText-Saaten wie im Produktivpfad ("save:season:disziplin:spieltag"):');
for (const [name, f] of Object.entries(VARIANTEN)) {
  const zaehl = new Array(KURSE).fill(0);
  let gleich = 0, vorher = null;
  for (let i = 0; i < N; i++) {
    const k = Math.floor(f(fnvText('save7:s3:takeshis-castle:md' + i)) * KURSE);
    zaehl[k]++;
    if (vorher !== null && k === vorher) gleich++;
    vorher = k;
  }
  console.log('  ' + name.padEnd(26) + 'P(gleich) ' + (gleich / (N - 1)).toFixed(4)
    + '   Verteilung ' + zaehl.map((x) => (x / N).toFixed(4)).join(' / '));
}

// Welche Kurse die 24 Messsaaten der Abnahme ziehen (miss-alle-disziplinen.mjs:
// 1337 + i*7919). Die Reihenfolge aendert sich durch die Haertung — deshalb muss
// Takeshi's Castle nach dieser Aenderung neu gemessen werden.
console.log('\nDie 24 Messsaaten der Abnahme (1337 + i*7919), N=Nordhof S=Sumpfpfad M=Die Mauern:');
for (const [name, f] of Object.entries(VARIANTEN)) {
  const folge = [];
  for (let i = 0; i < 24; i++) folge.push('NSM'[Math.floor(f(1337 + i * 7919) * KURSE)]);
  const z = [0, 0, 0];
  folge.forEach((c) => z['NSM'.indexOf(c)]++);
  console.log('  ' + name.padEnd(26) + folge.join('') + '   ' + z.join(' / '));
}
