// ===================================================================================
// DAS REZEPT AUSRECHNEN STATT RATEN — Chris' Budget-Methode als Verfahren.
//
// Ein Rezept verteilt jedes ATTRIBUT auf Sub-Skills. Damit die Disziplinmatrix aufgeht,
// muessen zwei Bedingungen zugleich gelten:
//
//   ZEILE  Jedes Attribut verteilt genau 100 % seines Budgets.
//   SPALTE Die Masse, die auf einem Sub-Skill landet (Summe aus Matrixgewicht mal Anteil),
//          muss seinem MECHANISCHEN Gewicht entsprechen — dem, was er im Motor wirklich
//          bewirkt (gemessen mit scripts/sondiere-feldspiel-subskills.mjs).
//
// Beides zugleich ist ein Transportproblem, und es hat immer eine Loesung, solange beide
// Summen 100 sind. Geloest wird es mit iterativem proportionalem Anpassen (Sinkhorn):
// abwechselnd Zeilen auf ihr Budget und Spalten auf ihre Zielmasse skalieren, bis sich
// nichts mehr bewegt. Nullen in der ERLAUBT-Matrix bleiben null — dort steht die
// Semantik: Power hat in PARADE nichts zu suchen, egal was die Rechnung will.
//
//   node scripts/baue-feldspiel-rezept.mjs hockey <sondierung.txt>
//
// Ausgegeben wird der fertige Rezeptblock zum Einsetzen in battle-mode.rezepte.js plus
// die Kontrollrechnung (Ist-Masse gegen Soll-Masse je Sub-Skill).
// ===================================================================================
import { readFileSync } from "node:fs";

const DISZIPLIN = process.argv[2] || "hockey";
const SONDIERUNG = process.argv[3];

// Die Matrixgewichte der Disziplin. Quelle: der Kommentar ueber dem FELDSPIEL_ART-Eintrag
// im Motor, dieselben Zahlen wie in BASIS_JE_DISC.
const MATRIX = {
  hockey: { power: 18, health: 18, speed: 12, spirit: 12, stamina: 10, torment: 10,
            awareness: 8, determination: 4, dexterity: 4, will: 4 },
  football: { spirit: 25, torment: 16, health: 14, awareness: 11, will: 10,
              determination: 8, power: 6, stamina: 6, charisma: 4 },
};

// WO EIN ATTRIBUT UEBERHAUPT HINGEHOEREN DARF. Aus der Sub-Skill-Tabelle des
// Hockey-Plans (docs/design/hockey-rollout-plan.md, B.2/B.3), auf die elf Sub-Skills
// abgebildet, die der Motor heute liest. Das ist die einzige Stelle mit Semantik; alles
// andere unten ist Arithmetik.
const ERLAUBT = {
  hockey: {
    // Sub-Skill      Attribute, die dort etwas zu suchen haben
    AUFBAU:      ["speed", "awareness", "stamina", "power"],
    ABSCHLUSS:   ["power", "spirit"],
    SCHUSS_NAH:  ["dexterity", "torment", "health"],
    SCHUSS_FERN: ["power", "awareness", "speed"],
    TECHNIK:     ["dexterity", "awareness", "determination"],
    ZWEITCHANCE: ["torment", "health", "power"],
    ABWEHR:      ["torment", "power", "health", "speed", "determination", "will"],
    TEAMGEIST:   ["spirit", "torment"],
    AUSDAUER:    ["stamina", "health", "will", "spirit"],
    LAUFTEMPO:   ["speed", "stamina", "dexterity"],
    PARADE:      ["awareness", "will", "determination", "health", "dexterity"],
  },
  // FOOTBALL — Kandidaten aus dem Football-Plan (docs/design/football-rollout-plan.md,
  // Teil D).
  //
  // AWARENESS WIEDER ZUGELASSEN (14.11., Opus-PM-Praezisierung nach Chris' Matrix-
  // Ruecknahme-Auftrag). Bis hierher war "awareness" in KEINER Zelle erlaubt — ausdruecklich,
  // weil es auf der (damaligen) Kaderfamilie negativ mit der Football-Eignung korrelierte
  // (rho -0,34, docs/design/football-rezept-kalibrierung.md Abschnitt 4.2) und das Projekt
  // damals noch gegen den Spiel-Eignungs-Override kalibrierte, in dem awareness nur 8 Pp
  // wog. Genau das ist jetzt der Fehler, den Chris ausdrueckllich benennt: eine ERLAUBT-
  // Liste, die ein Matrix-Attribut komplett aussperrt, macht seine Zeilensumme unloesbar
  // (0 statt des vollen Matrixgewichts 11) — Sinkhorn kann ein Attribut nur verteilen,
  // wenn mindestens eine Zelle es zulaesst. Die rho-Sorge bleibt real (und bleibt zu
  // beobachten), aber die Antwort darauf ist die SPALTENSEITE (Sondierung/mechanisches
  // Gewicht der Sub-Skills, Primaer-/Nebenwege), nicht das Aussperren eines Attributs aus
  // der ZEILE — s. CLAUDE.md "Die Eignungsmatrix ist gesperrt". Zugelassen in den drei
  // Zellen, die der Football-Plan (Teil D) urspruenglich dafuer vorsah: PASSGENAUIGKEIT
  // (Feldlesen/Progression), PASSSCHUTZ (Blitz-Erkennung) und ABWEHR_PASS (Coverage-
  // Antizipation) — football-fachlich die drei Rollen, in denen "awareness" tatsaechlich
  // die Bedeutung hat, die der Name verspricht. "dexterity"/"speed"/"intelligence" bleiben
  // zu Recht aussen vor: keins der drei traegt Matrixgewicht in MATRIX.football, Sinkhorn
  // kann sie ohnehin nicht speisen. LAUFTEMPO fehlt hier bewusst (wie PARADE
  // torwartspezifisch bei Hockey, nur umgekehrt): es ist keine fachliche Rolle, sondern das
  // disziplinuebergreifend erwartete Bewegungstempo (battle-mode.rezepte.js-Konvention 1:1
  // mit Basketball/Hockey), speed/dexterity tragen dafuer ohnehin kein Football-
  // Matrixgewicht — bleibt unangetastet.
  football: {
    PASSGENAUIGKEIT: ["determination", "will", "awareness"],
    LAUFKRAFT:       ["power", "health", "spirit"],
    PASSSCHUTZ:      ["health", "determination", "will", "awareness"],
    ABWEHR_PASS:     ["torment", "power", "awareness"],
    ABWEHR_LAUF:     ["torment", "power", "health"],
    BALLSICHERHEIT:  ["health", "will"],
    // RUNDE 2 VERSUCHT UND VERWORFEN (14.11., Spaltenseite): TEAMGEIST brauchte laut Sondierung
    // 51,7 % der mechanischen Gesamtmasse, konnte aus spirit+charisma+torment (Matrixbudget
    // 25+4+16=45) aber nur 39,9 % tatsaechlich erreichen. "health" zusaetzlich zugelassen
    // (football-fachlich: der grosse, zaehe Zielspieler) hob diese Luecke NICHT (health ist
    // bereits anderswo voll ausgeschoepft, verschob nur die Komposition) und kostete Pp
    // (18,3 -> 26,3, durchgefallen) fuer einen kleinen rho-Gewinn (0,525 -> 0,564) — s.
    // docs/design/football-rezept-matrix-budget-14-11.md. Zurueckgerollt auf die urspruengliche
    // Drei-Attribute-Zelle; die naechste Runde braucht eine andere Spaltenseiten-Idee, keine
    // weitere Verdraengung eines bereits ausgeschoepften Attributs.
    TEAMGEIST:       ["spirit", "charisma", "torment"],
    AUSDAUER:        ["stamina", "health", "will"],
  },
};

const matrix = MATRIX[DISZIPLIN];
const erlaubt = ERLAUBT[DISZIPLIN];
if (!matrix || !erlaubt) throw new Error(`Keine Matrix/Erlaubt-Tabelle fuer "${DISZIPLIN}".`);

// Mechanische Gewichte aus der Sondierungsausgabe lesen.
const subskills = Object.keys(erlaubt);
let soll;
if (SONDIERUNG) {
  const text = readFileSync(SONDIERUNG, "utf8");
  soll = {};
  for (const s of subskills) {
    const m = text.match(new RegExp(`^${s}\\s+\\S+\\s+([0-9.]+)\\s*%`, "m"));
    if (!m) throw new Error(`Sub-Skill ${s} steht nicht in ${SONDIERUNG}.`);
    soll[s] = Number(m[1]);
  }
} else {
  throw new Error("Zweiter Aufrufwert fehlt: die Datei mit der Sondierungsausgabe.");
}

// EIN SUB-SKILL MIT GEMESSENER NULL bekaeme sonst null Budget — und damit haette die
// Disziplin einen Sub-Skill, den kein Attribut speist. Das ist kein Rezeptfehler, sondern
// ein Motorbefund ("dieser Sub-Skill bewirkt nichts"), und er gehoert berichtet, nicht
// weggerechnet. Ein Mindestanteil haelt ihn am Leben, bis der Motor ihn traegt.
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
console.log("Sub-Skill        Soll-Masse   Ist-Masse   Differenz");
let maxAbw = 0;
for (const s of subskills) {
  let ist = 0;
  for (const a of attribute) ist += matrix[a] * (p[a][s] || 0);
  const d = ist - soll[s];
  maxAbw = Math.max(maxAbw, Math.abs(d));
  console.log(`${s.padEnd(16)} ${soll[s].toFixed(1).padStart(8)} ${ist.toFixed(1).padStart(11)} ${(d >= 0 ? "+" : "") + d.toFixed(2)}`);
}
console.log(`\nGroesste Abweichung: ${maxAbw.toFixed(2)} Pp\n`);

// Rezeptblock: je Sub-Skill die Attribute mit ihrem ANTEIL AN DER MASSE dieses Sub-Skills,
// auf 100 normiert und ganzzahlig gerundet — das ist die Schreibweise, die der Motor liest.
console.log(`  ${DISZIPLIN}:{`);
const zeilen = [];
for (const s of subskills) {
  const roh = attribute
    .filter((a) => p[a][s] > 0)
    .map((a) => ({ a, v: matrix[a] * p[a][s] }))
    .sort((x, y) => y.v - x.v);
  const summe = roh.reduce((x, y) => x + y.v, 0) || 1;
  let anteile = roh.map((r) => ({ a: r.a, v: Math.round((r.v / summe) * 100) })).filter((r) => r.v > 0);
  // Rundungsrest auf den groessten Posten legen, damit die Zeile exakt 100 ergibt.
  const rest = 100 - anteile.reduce((x, y) => x + y.v, 0);
  if (anteile.length) anteile[0].v += rest;
  zeilen.push(`    ${(s + ":").padEnd(13)}{${anteile.map((r) => `${r.a}:${r.v}`).join(",")}}`);
}
console.log(zeilen.join(",\n"));
console.log("  }");
