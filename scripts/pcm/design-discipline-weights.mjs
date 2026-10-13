// Reproduzierbare Quelle fuer DISCIPLINE_WEIGHTS in oly-pcm-mapping.mjs -- kein Ausgleichs-
// algorithmus mehr (die erste Fassung nutzte gedaempftes IPF, s. Git-Historie), sondern ein
// Handentwurf, der zwei konkrete Vorgaben von Chris direkt umsetzt (05.09.):
//
//   1. "alle 12 Attribute sollen ihren Sinn haben" -- jedes der 9 physischen/mentalen
//      Attribute (power/health/determination/stamina/speed/dexterity/awareness/
//      intelligence/will) fuehrt oder co-fuehrt mindestens eine Disziplin klar.
//   2. "social sind eher supportive stats und spielen ein wenig ueberall mit rein" --
//      Oly kennt selbst eine 4-Achsen-Einteilung (POW/SPE/MEN/SOC, s.
//      lib/ai/ai-needs-engine.ts mapAttributeToAxis und docs/PLAYER_GENERATOR_PLAN.md):
//      SOC = charisma + spirit + torment. Diese drei tauchen deshalb in JEDER der 13
//      unabhaengig gewichteten Disziplinen mit spuerbarem, aber nie fuehrendem Gewicht auf.
//
// Dieses Skript ist nur die Pruefung/Dokumentation des Entwurfs, kein Generator -- die
// Zahlen unten sind Handarbeit, das Skript verifiziert nur die beiden Invarianten und
// druckt die Tabelle im DISCIPLINE_WEIGHTS-Format.
const W = {
  mountain:      { power: 30, stamina: 18, determination: 13, torment: 7, health: 6, spirit: 6, will: 5, awareness: 5, charisma: 4, dexterity: 3, intelligence: 3 },
  timetrial:     { dexterity: 26, intelligence: 21, awareness: 14, speed: 10, stamina: 6, torment: 6, spirit: 5, charisma: 4, power: 2, determination: 2, health: 2, will: 2 },
  sprint:        { speed: 30, power: 16, determination: 14, torment: 12, dexterity: 7, spirit: 5, awareness: 4, charisma: 4, health: 4, will: 2, intelligence: 2 },
  hill:          { power: 29, determination: 17, speed: 13, torment: 7, will: 6, awareness: 5, spirit: 5, charisma: 4, health: 4, stamina: 4, dexterity: 3, intelligence: 3 },
  plain:         { speed: 29, stamina: 15, power: 14, awareness: 8, torment: 7, health: 5, spirit: 5, intelligence: 4, charisma: 4, determination: 4, dexterity: 3, will: 2 },
  prologue:      { speed: 30, dexterity: 15, power: 13, torment: 10, intelligence: 8, charisma: 5, spirit: 5, awareness: 4, determination: 4, health: 4, stamina: 2 },
  acceleration:  { power: 30, speed: 17, torment: 12, determination: 10, dexterity: 5, spirit: 5, charisma: 4, health: 4, stamina: 4, awareness: 3, intelligence: 3, will: 3 },
  endurance:     { stamina: 28, health: 15, will: 13, spirit: 12, determination: 6, torment: 6, intelligence: 5, charisma: 4, dexterity: 4, power: 3, speed: 2, awareness: 2 },
  resistance:    { will: 27, stamina: 15, health: 13, spirit: 13, determination: 7, torment: 6, intelligence: 4, charisma: 4, power: 3, awareness: 3, dexterity: 3, speed: 2 },
  recuperation:  { health: 27, spirit: 22, stamina: 10, intelligence: 10, will: 6, torment: 6, determination: 4, charisma: 4, power: 3, dexterity: 3, awareness: 3, speed: 2 },
  cobble:        { health: 26, power: 15, dexterity: 14, torment: 10, will: 6, awareness: 6, spirit: 5, determination: 4, charisma: 4, stamina: 4, speed: 3, intelligence: 3 },
  downhilling:   { dexterity: 25, awareness: 22, torment: 14, speed: 9, intelligence: 6, spirit: 5, charisma: 4, determination: 3, power: 3, health: 3, will: 3, stamina: 3 },
  baroudeur:     { determination: 24, will: 15, torment: 13, charisma: 12, stamina: 10, spirit: 8, intelligence: 5, power: 3, health: 3, awareness: 3, dexterity: 2, speed: 2 },
};

const ATTRS = ['power', 'health', 'determination', 'stamina', 'speed', 'dexterity', 'awareness', 'intelligence', 'will', 'charisma', 'spirit', 'torment'];
const SOC = ['charisma', 'spirit', 'torment'];

let ok = true;
for (const [d, row] of Object.entries(W)) {
  const sum = Object.values(row).reduce((a, b) => a + b, 0);
  if (sum !== 100) {
    console.log(`SUMME FALSCH ${d}: ${sum}`);
    ok = false;
  }
  const top = Object.entries(row).sort((a, b) => b[1] - a[1])[0];
  if (SOC.includes(top[0])) {
    console.log(`SOZIAL FUEHRT (verletzt Vorgabe 2) ${d}: ${top[0]}=${top[1]}`);
    ok = false;
  }
}
for (const d of Object.keys(W)) {
  for (const s of SOC) {
    if (!(s in W[d]) || W[d][s] <= 0) {
      console.log(`FEHLT ${s} in ${d} (verletzt Vorgabe 2)`);
      ok = false;
    }
  }
}
for (const a of ATTRS) {
  const s = Object.values(W).reduce((acc, row) => acc + (row[a] || 0), 0);
  if (s < 40) {
    console.log(`SEHR NIEDRIG (verletzt Vorgabe 1): ${a} = ${s}`);
    ok = false;
  }
}
console.log(ok ? 'OK: beide Vorgaben erfuellt (Zeilensumme 100, sozial nie Top aber ueberall vorhanden, kein Attribut bedeutungslos).' : 'FEHLER siehe oben.');

console.log('\nSpaltensummen (nur zur Information, keine Zielgroesse mehr):');
for (const a of ATTRS) {
  const s = Object.values(W).reduce((acc, row) => acc + (row[a] || 0), 0);
  console.log(`  ${a}: ${s}`);
}

console.log('\nFuehrendes Attribut je Disziplin (Top 3):');
for (const [d, row] of Object.entries(W)) {
  const sorted = Object.entries(row).sort((a, b) => b[1] - a[1]);
  console.log(`  ${d}: ${sorted.slice(0, 3).map(([a, v]) => `${a}=${v}`).join(', ')}`);
}
