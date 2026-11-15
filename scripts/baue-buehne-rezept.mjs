// ===================================================================================
// DAS BUEHNEN-REZEPT ALS BUDGET AUSRECHNEN — das Buehnen-Gegenstueck zu
// scripts/baue-feldspiel-rezept.mjs, fuer Chris' Auftrag vom 14.11.: ALLE zwanzig
// Disziplinen auf echte Budget-Konservierung umstellen (nicht nur eine Obergrenze je
// Zelle, sondern die Summe der Anteile EINES Attributs ueber alle Unterfertigkeiten
// hinweg muss exakt seinem Matrixgewicht entsprechen, s. CLAUDE.md "Die Eignungsmatrix
// ist gesperrt").
//
// WARUM EIN EIGENES SKRIPT STATT EIN --budget-MODUS IN scripts/kalibriere-buehne-rezept.mjs:
// jenes Skript hat eine ANDERE Aufgabe und sagt das in seinem eigenen Kopfkommentar
// ausdruecklich — es maximiert rho/Spiel per Grid-Suche, GERADE WEIL ein reines
// Matrix-Treue-Rezept (Sinkhorn) nur die Validitaet, nicht die Verlaesslichkeit
// optimiert ("Ein Sinkhorn-Rezept (Matrix-Treue je Rolle) maximiert nur die erste
// Groesse."). Dieses Skript hier ist genau das — ein reines Sinkhorn-Transportproblem,
// ohne jede rho-Messung, ohne die rundenN-Nachbildung, ohne Playwright-Motor-Pruefung.
// Beide Werkzeuge bleiben nebeneinander bestehen, wie bei Feldspiel schon
// scripts/baue-feldspiel-rezept.mjs (Budget) neben scripts/miss-feldspiel-rangtreue.mjs
// (rho) steht.
//
// DASSELBE VERFAHREN WIE scripts/baue-feldspiel-rezept.mjs (s. dessen Kopfkommentar fuer
// die volle Herleitung): ein Rezept verteilt jedes ATTRIBUT auf Unterfertigkeiten. Damit
// die Disziplinmatrix aufgeht, muessen zwei Bedingungen zugleich gelten:
//
//   ZEILE  Jedes Attribut verteilt genau 100 % seines Budgets.
//   SPALTE Die Masse, die auf einer Unterfertigkeit landet (Summe aus Matrixgewicht mal
//          Anteil), muss ihrem MECHANISCHEN Gewicht entsprechen — dem, was sie im Motor
//          wirklich bewirkt (gemessen mit scripts/sondiere-buehne-subskills.mjs).
//
// Geloest per Sinkhorn (iteratives proportionales Anpassen): abwechselnd Zeilen auf ihr
// Budget und Spalten auf ihre Zielmasse skalieren, bis sich nichts mehr bewegt. Nullen in
// der ERLAUBT-Matrix bleiben null — dort steht die Semantik.
//
//   node scripts/baue-buehne-rezept.mjs tennis <sondierung.txt>
//
// Ausgegeben wird der fertige Rezeptblock zum Einsetzen in BUEHNE_ART[dId].rezept
// (battle-mode.engine.js) plus die Kontrollrechnung (Ist-Masse gegen Soll-Masse je
// Unterfertigkeit).
//
// NUR DAS WERKZEUG — kein Rezept in battle-mode.engine.js wird von diesem Skript
// automatisch geschrieben, und keines ist fuer diese PR geaendert worden. Das Ausrollen
// auf die neun Disziplinen (CLAUDE.md-Aufgabe #133) ist ein separater, spaeterer Schritt
// mit eigener rho/Pp-Abnahme je Disziplin (ueber scripts/kalibriere-buehne-rezept.mjs
// --pruefe, GENAUSO wie beim Feldspiel scripts/messe-arena-einfluss.mjs nach jedem
// Sinkhorn-Rezept laeuft).
// ===================================================================================
import { readFileSync } from "node:fs";

const DISZIPLIN = process.argv[2] || "tennis";
const SONDIERUNG = process.argv[3];

// Die Matrixgewichte der neun Buehnen-Disziplinen. Quelle: die GESPERRTE Matrix
// (lib/player-generator/official-discipline-weights.ts, officialDisciplineWeightTable),
// dieselben Zahlen wie in den "MATRIX:"-Kommentaren ueber jedem BUEHNE_ART-Eintrag in
// battle-mode.engine.js. Nur Attribute mit Gewicht > 0 — Sinkhorn kennt keine Nullzeilen.
const MATRIX = {
  tennis: { intelligence: 22, awareness: 20, spirit: 18, stamina: 12, dexterity: 12,
            determination: 6, speed: 6, charisma: 4 },
  fechten: { torment: 25, dexterity: 20, speed: 16, awareness: 15, power: 10,
             determination: 6, health: 4, intelligence: 4 },
  gewichtheben: { power: 28, charisma: 23, health: 16, determination: 12, will: 7,
                  speed: 6, dexterity: 6, stamina: 2 },
  "speed-schach": { intelligence: 28, awareness: 21, determination: 14, will: 14,
                     speed: 10, dexterity: 7, charisma: 6 },
  breaking: { will: 28, torment: 22, health: 18, power: 10, determination: 10,
              stamina: 8, dexterity: 2, intelligence: 2 },
  showcase: { charisma: 27, spirit: 16, determination: 14, power: 11, intelligence: 10,
              dexterity: 9, speed: 8, health: 3, torment: 2 },
  wettessen: { will: 26, health: 22, stamina: 22, determination: 16, intelligence: 8,
               torment: 6 },
  eiskunstlauf: { charisma: 28, dexterity: 18, spirit: 16, awareness: 14, speed: 10,
                  intelligence: 8, determination: 6 },
  "i-spy": { intelligence: 18, torment: 17, spirit: 13, will: 12, charisma: 9,
             determination: 8, speed: 8, dexterity: 8, awareness: 5, health: 2 },
};

// WO EIN ATTRIBUT UEBERHAUPT HINGEHOEREN DARF — die einzige Stelle mit Semantik (dasselbe
// Muster wie ERLAUBT in scripts/baue-feldspiel-rezept.mjs). Kandidaten stammen aus den
// NARRATIV dokumentierten Rollenbeschreibungen der bestehenden Rezepte in battle-mode.engine.js
// (jeder BUEHNE_ART-Eintrag erklaert in seinen Kommentaren, wofuer jede Unterfertigkeit
// erzaehlerisch steht — GRUNDLAGE=Basistechnik, TECHNIK=Ausfuehrung/Fertigkeit,
// SPITZENMOMENT=riskanter Hoehepunkt, NERVEN=Nervenstaerke/Konzentration, PUBLIKUM=Wirkung
// aufs Publikum, AUSDAUER=Durchhalten, WAGNIS=bewusstes Risiko).
//
// tennis/fechten/speed-schach/showcase/wettessen/eiskunstlauf teilen sich die GENERISCHE
// Sieben-Rollen-Formel (GRUNDLAGE/SPITZENMOMENT/TECHNIK/NERVEN/PUBLIKUM/AUSDAUER/WAGNIS, s.
// bauBuehne() in battle-mode.engine.js) — breaking ebenfalls, trotz `gauntlet:true` (die
// Weiche aendert nur den TURNIERABLAUF, nicht die Rezeptform, s. deren eigener Kommentar
// "rezept/failAbzug/... bleiben WOERTLICH unveraendert"). gewichtheben (LAST/TECHNIK/NERVEN/
// ANSAGE/ERHOLUNG) und i-spy (SPUERSINN/LOGIK/MENSCHENKENNTNIS/FINGERFERTIGKEIT/NERVEN/
// TEAMGEIST/AUSDAUER) haben je EIGENE Unterfertigkeits-Namen (dieselbe Begruendung wie bei
// Footballs eigenen Sub-Skills in scripts/baue-feldspiel-rezept.mjs: eine eigene Mechanik
// bekommt eigene Rollennamen statt der geteilten Formel).
//
// AUSDRUECKLICH EIN STARTPUNKT FUER DEN ROLLOUT (Task #133), KEINE ENDGUELTIGE
// FACH-ENTSCHEIDUNG: jede Zelle hier ist so gewaehlt, dass (a) jedes Matrixattribut der
// Disziplin mindestens eine Heimat hat und (b) kein attributfremdes Attribut vorkommt —
// genau die zwei Eigenschaften, die tests/buehne-rezept-budget-guard.test.ts spaeter je
// Disziplin scharf prueft. Die FEINVERTEILUNG (welche Zelle wie viel Gewicht bekommt)
// entscheidet weiterhin Sinkhorn gegen die gemessene Sondierung, nicht diese Tabelle.
const ERLAUBT = {
  // FECHTEN: 1:1 aus scripts/kalibriere-buehne-rezept.mjs's eigener ERLAUBT.fechten
  // uebernommen (dort bereits mit der vollen fachlichen Begruendung kuratiert: Degen —
  // torment=Druck/Aggression, dexterity=Klingenarbeit, speed=Beinarbeit/Tempo,
  // awareness=Lesen des Gegners, power=Ausfall, determination/health/intelligence=Kopf und
  // Koerper ueber neun bis achtzehn Gaenge). Deckt alle acht Matrixattribute ab.
  fechten: {
    GRUNDLAGE: ["torment", "dexterity", "awareness", "speed"],
    SPITZENMOMENT: ["dexterity", "speed", "torment", "power"],
    TECHNIK: ["dexterity", "awareness", "torment", "speed", "intelligence"],
    NERVEN: ["awareness", "determination", "intelligence", "health", "torment"],
    PUBLIKUM: ["torment", "power", "intelligence", "health", "speed", "determination"],
    AUSDAUER: ["health", "speed", "power", "determination"],
    WAGNIS: ["speed", "power", "torment", "determination"],
  },
  // TENNIS: GRUNDLAGE = Spielverstaendnis/Antizipation/Ruhe im Rallye-Aufbau (intelligence/
  // awareness/spirit) plus Grundkondition (stamina). TECHNIK = der Schlag selbst, rein
  // koerperlich (dexterity/speed/intelligence fuer Schlagauswahl). WAGNIS = riskante
  // Returns/Netzangriffe, dieselbe mentale Basis wie GRUNDLAGE plus Handgelenk (dexterity).
  // SPITZENMOMENT = der entscheidende Ballwechsel (Kopf, Ausstrahlung, Wille). PUBLIKUM =
  // Charisma plus die beiden leichtesten Reserve-Attribute (stamina/spirit). NERVEN =
  // Konzentration im Match (awareness/spirit/determination). AUSDAUER = ueber drei Saetze
  // (stamina/determination/spirit). Deckt alle acht Matrixattribute ab.
  tennis: {
    GRUNDLAGE: ["intelligence", "awareness", "spirit", "stamina"],
    TECHNIK: ["dexterity", "speed", "intelligence"],
    WAGNIS: ["intelligence", "awareness", "spirit", "dexterity"],
    SPITZENMOMENT: ["intelligence", "charisma", "determination", "speed"],
    PUBLIKUM: ["charisma", "stamina", "spirit"],
    NERVEN: ["awareness", "spirit", "determination"],
    AUSDAUER: ["stamina", "determination", "spirit"],
  },
  // SPEED-SCHACH: GRUNDLAGE/SPITZENMOMENT/TECHNIK sind die drei "Schachkopf"-Rollen
  // (intelligence/awareness/determination, am Brett selbst). PUBLIKUM = Ausstrahlung am
  // Tisch (charisma/will). NERVEN/AUSDAUER = Uhrdruck ueber viele schnelle Zuege (will/
  // determination/speed). WAGNIS = riskante Zeitwetten (speed/dexterity/charisma). Deckt
  // alle sieben Matrixattribute ab.
  "speed-schach": {
    GRUNDLAGE: ["intelligence", "awareness", "determination"],
    SPITZENMOMENT: ["intelligence", "determination", "awareness"],
    TECHNIK: ["intelligence", "awareness", "dexterity"],
    PUBLIKUM: ["charisma", "will"],
    NERVEN: ["will", "determination", "speed"],
    AUSDAUER: ["will", "determination", "speed"],
    WAGNIS: ["speed", "dexterity", "charisma"],
  },
  // GEWICHTHEBEN: eigene fuenf Rollen, 1:1 aus der NARRATIV bereits etablierten Zuordnung
  // im BUEHNE_ART.gewichtheben-Kommentar (KALIBRIERRUNDE 01.10., "FIX"-Abschnitt) —
  // LAST = der Hub selbst (power/health/determination), TECHNIK = Hebetechnik
  // (dexterity/speed/determination/power), NERVEN = Konzentration unter Publikumsdruck
  // (charisma/will/determination/health), ANSAGE = der breite Strategie-/Mut-Kanal mit
  // sechs eigenen Hebeln (charisma/power/will/dexterity/health/speed, s. dortiger
  // Kommentar), ERHOLUNG = Pause zwischen Versuchen (stamina/health/will — stamina hat
  // hier laut Kommentar "sein einziges Zuhause"). Deckt alle acht Matrixattribute ab.
  gewichtheben: {
    LAST: ["power", "health", "determination"],
    TECHNIK: ["dexterity", "speed", "determination", "power"],
    NERVEN: ["charisma", "will", "determination", "health"],
    ANSAGE: ["charisma", "power", "will", "dexterity", "health", "speed"],
    ERHOLUNG: ["stamina", "health", "will"],
  },
  // BREAKING: Wille/Torment (die beiden Matrix-Hoechstwerte) teilen sich laut dem
  // "NEUES REZEPT, PRINZIP STATT FEINJUSTAGE"-Kommentar bewusst die beiden
  // erfolgsgebundenen Kanaele TECHNIK/NERVEN, nie beide zugleich. Dexterity (Matrixgewicht
  // nur 2) bleibt NUR in WAGNIS, dem am staerksten verduennten Kanal.
  //
  // FUND WAEHREND DES BAUS DIESES WERKZEUGS: intelligence (Matrixgewicht 2) kommt im
  // HEUTIGEN, handkuratierten breaking-Rezept in KEINER der sieben Unterfertigkeiten vor
  // (s. BUEHNE_ART.breaking.rezept in battle-mode.engine.js) — exakt der Fehlertyp (a), den
  // tests/buehne-rezept-budget-guard.test.ts prueft: eine unloesbare Zeile, das Attribut
  // traegt FAKTISCH NULL statt seines vollen Matrixgewichts. Hier bewusst behoben (TECHNIK,
  // kleine Beimischung neben torment/determination, als "wo man gezielt ansetzt") — ohne
  // dass dieses Werkzeug das committete Rezept selbst anfasst (s. Kopfkommentar, "nur das
  // Werkzeug"). Deckt alle acht Matrixattribute ab.
  breaking: {
    GRUNDLAGE: ["will", "torment", "health", "stamina"],
    SPITZENMOMENT: ["power", "will", "torment"],
    TECHNIK: ["torment", "determination", "intelligence"],
    PUBLIKUM: ["will", "torment"],
    NERVEN: ["will", "health", "determination"],
    AUSDAUER: ["stamina", "determination", "health"],
    WAGNIS: ["power", "dexterity", "torment"],
  },
  // SHOWCASE: 1:1 aus der bereits abgeschlossenen Budget-Kalibrierrunde im
  // BUEHNE_ART.showcase-Kommentar ("PP-FIX 27.09.") uebernommen — die dortige
  // Attributverteilung je Rolle deckt bereits alle neun Matrixattribute exakt ab (keine
  // Erweiterung noetig), nur die PROZENTE selbst sind dort noch handgerechnet statt
  // Sinkhorn-exakt.
  showcase: {
    GRUNDLAGE: ["charisma", "spirit", "determination"],
    TECHNIK: ["intelligence", "dexterity"],
    WAGNIS: ["torment", "power", "speed"],
    SPITZENMOMENT: ["power", "speed"],
    NERVEN: ["spirit", "determination", "health"],
    PUBLIKUM: ["charisma", "torment", "health"],
    AUSDAUER: ["spirit", "determination", "health"],
  },
  // WETTESSEN: 1:1 aus dem bestehenden Rezept uebernommen — seine sieben Rollen decken
  // bereits alle sechs Matrixattribute exakt ab (kein Fehlbestand wie bei Breaking).
  wettessen: {
    GRUNDLAGE: ["stamina", "health", "will"],
    SPITZENMOMENT: ["torment", "will", "determination"],
    TECHNIK: ["intelligence", "determination", "health"],
    PUBLIKUM: ["will", "determination"],
    NERVEN: ["will", "health", "determination"],
    AUSDAUER: ["stamina", "health", "will"],
    WAGNIS: ["torment", "stamina", "intelligence"],
  },
  // EISKUNSTLAUF: 1:1 aus dem bestehenden Rezept uebernommen — deckt bereits alle sieben
  // Matrixattribute exakt ab.
  eiskunstlauf: {
    GRUNDLAGE: ["charisma", "spirit", "dexterity"],
    SPITZENMOMENT: ["dexterity", "speed", "awareness"],
    TECHNIK: ["dexterity", "awareness", "intelligence"],
    PUBLIKUM: ["charisma", "spirit"],
    NERVEN: ["determination", "awareness", "intelligence"],
    AUSDAUER: ["spirit", "determination", "dexterity"],
    WAGNIS: ["speed", "dexterity", "awareness"],
  },
  // I-SPY: eigene sieben Rollen (s. BUEHNE_ART["i-spy"]-Kommentar "SIEBEN SUB-SKILLS STATT
  // DER GETEILTEN SIEBEN-ROLLEN-FORMEL"), 1:1 aus dem bestehenden, bereits
  // budget-kalibrierten Rezept uebernommen (s. dessen "BUDGET-KALIBRIERUNG"-Kommentar) —
  // deckt bereits alle zehn Matrixattribute exakt ab. KEIN power (die Matrix kennt es fuer
  // i-spy nicht, s. dortiger Kommentar "power r=-0,539 gegen die Eignung").
  "i-spy": {
    SPUERSINN: ["intelligence", "torment", "awareness"],
    LOGIK: ["intelligence", "will", "determination"],
    MENSCHENKENNTNIS: ["torment", "charisma", "spirit"],
    FINGERFERTIGKEIT: ["dexterity", "speed", "torment"],
    NERVEN: ["will", "awareness", "determination", "dexterity", "speed"],
    TEAMGEIST: ["spirit", "charisma", "awareness"],
    AUSDAUER: ["spirit", "health", "speed"],
  },
};

const matrix = MATRIX[DISZIPLIN];
const erlaubt = ERLAUBT[DISZIPLIN];
if (!matrix || !erlaubt) throw new Error(`Keine Matrix/Erlaubt-Tabelle fuer "${DISZIPLIN}" (gueltig: ${Object.keys(MATRIX).join(", ")}).`);

// Mechanische Gewichte aus der Sondierungsausgabe (scripts/sondiere-buehne-subskills.mjs) lesen.
const subskills = Object.keys(erlaubt);
let soll;
if (SONDIERUNG) {
  const text = readFileSync(SONDIERUNG, "utf8");
  soll = {};
  for (const s of subskills) {
    const m = text.match(new RegExp(`^${s}\\s+\\S+\\s+([0-9.]+)\\s*%`, "m"));
    if (!m) throw new Error(`Unterfertigkeit ${s} steht nicht in ${SONDIERUNG}.`);
    soll[s] = Number(m[1]);
  }
} else {
  throw new Error("Zweiter Aufrufwert fehlt: die Datei mit der Sondierungsausgabe (scripts/sondiere-buehne-subskills.mjs).");
}

// EIN SUB-SKILL MIT GEMESSENER NULL bekaeme sonst null Budget — dasselbe Prinzip wie in
// scripts/baue-feldspiel-rezept.mjs: ein Mindestanteil haelt ihn am Leben, bis der Motor ihn
// traegt; das ist ein Motorbefund, kein Rezeptfehler, und gehoert berichtet, nicht weggerechnet.
const MINDEST = 1.0;
for (const s of subskills) if (soll[s] < MINDEST) soll[s] = MINDEST;
const skala = 100 / Object.values(soll).reduce((a, b) => a + b, 0);
for (const s of subskills) soll[s] *= skala;

// Startbelegung: gleichverteilt ueber die erlaubten Zellen.
const attribute = Object.keys(matrix);
const p = {};
for (const a of attribute) {
  p[a] = {};
  const ziele = subskills.filter((s) => erlaubt[s].includes(a));
  if (ziele.length === 0) throw new Error(`Attribut "${a}" traegt Matrixgewicht ${matrix[a]} bei "${DISZIPLIN}", hat aber in ERLAUBT keine einzige Zelle — seine Zeile ist unloesbar.`);
  for (const s of ziele) p[a][s] = 1 / ziele.length;
}

// Sinkhorn: abwechselnd Zeilen (Attributbudget = 1) und Spalten (Masse = Soll) normieren.
for (let runde = 0; runde < 4000; runde++) {
  for (const s of subskills) {
    let ist = 0;
    for (const a of attribute) ist += matrix[a] * (p[a][s] || 0);
    if (ist <= 0) continue;
    const f = soll[s] / ist;
    for (const a of attribute) if (p[a][s] != null) p[a][s] *= f;
  }
  for (const a of attribute) {
    const summe = Object.values(p[a]).reduce((x, y) => x + y, 0);
    if (summe > 0) for (const s in p[a]) p[a][s] /= summe;
  }
}

// Kontrollrechnung
console.log(`Rezept ${DISZIPLIN} — Kontrolle\n`);
console.log("Unterfertigkeit  Soll-Masse   Ist-Masse   Differenz");
let maxAbw = 0;
for (const s of subskills) {
  let ist = 0;
  for (const a of attribute) ist += matrix[a] * (p[a][s] || 0);
  const d = ist - soll[s];
  maxAbw = Math.max(maxAbw, Math.abs(d));
  console.log(`${s.padEnd(16)} ${soll[s].toFixed(1).padStart(8)} ${ist.toFixed(1).padStart(11)} ${(d >= 0 ? "+" : "") + d.toFixed(2)}`);
}
console.log(`\nGroesste Abweichung: ${maxAbw.toFixed(2)} Pp\n`);

// Rezeptblock: je Unterfertigkeit die Attribute mit ihrem ANTEIL AN DER MASSE dieser
// Unterfertigkeit, auf 100 normiert und ganzzahlig gerundet — die Schreibweise, die
// mische() in battle-mode.engine.js liest.
console.log(`      rezept:{`);
const zeilen = [];
for (const s of subskills) {
  const roh = attribute
    .filter((a) => p[a][s] > 0)
    .map((a) => ({ a, v: matrix[a] * p[a][s] }))
    .sort((x, y) => y.v - x.v);
  const summe = roh.reduce((x, y) => x + y.v, 0) || 1;
  const anteile = roh.map((r) => ({ a: r.a, v: Math.round((r.v / summe) * 100) })).filter((r) => r.v > 0);
  const rest = 100 - anteile.reduce((x, y) => x + y.v, 0);
  if (anteile.length) anteile[0].v += rest;
  zeilen.push(`        ${(s + ":").padEnd(18)}{${anteile.map((r) => `${r.a}:${r.v}`).join(",")}}`);
}
console.log(zeilen.join(",\n"));
console.log("      }");
