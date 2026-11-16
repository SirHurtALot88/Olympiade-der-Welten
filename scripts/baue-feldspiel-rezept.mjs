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
  // NFL-RUNDE (15.11., docs/design/football-opus-review-nfl-15-11.md): der Motor hat jetzt
  // Linien-Duelle je Snap (PASSSCHUTZ gegen ABWEHR_PASS/ABWEHR_LAUF), Tackling/Yards nach
  // Kontakt (LAUFKRAFT gegen ABWEHR_LAUF), Ballsicherheit bei jedem Kontakt plus Faenger-Haende
  // und Money Downs (TEAMGEIST). Die Zellen folgen dieser neuen Semantik; jedes Matrixattribut
  // hat mindestens zwei football-fachlich begruendete Zellen (Primaer- und Nebenweg), damit
  // Sinkhorn kein Attribut in eine einzige Rolle zwingen muss.
  //   PASSSCHUTZ   = Blocken (Pass- UND Laufblock): Robustheit, Wucht, Wille, Kampfgeist,
  //                  Schmerzresistenz, Kondition.
  //   ABWEHR_PASS  = Pass Rush + Deckung: Antizipation (awareness), Kampfgeist, Aggression
  //                  (torment), Wucht, Entschlossenheit.
  //   ABWEHR_LAUF  = Tackling/Run Stop: Aggression, Wucht, Robustheit, Kampfgeist, Wille.
  //   BALLSICHERHEIT = Haende + Ball am Koerper: Wille, Robustheit, Entschlossenheit, Antizipation.
  //   TEAMGEIST    = Nervenstaerke auf 3./4. Versuch + Chemie als Anspielstation: Kampfgeist,
  //                  Charisma, Wille, Entschlossenheit.
  football: {
    PASSGENAUIGKEIT: ["determination", "will", "awareness", "charisma"],
    LAUFKRAFT:       ["power", "health", "spirit", "torment"],
    PASSSCHUTZ:      ["health", "power", "will", "spirit", "torment", "stamina"],
    ABWEHR_PASS:     ["awareness", "spirit", "torment", "power", "determination"],
    ABWEHR_LAUF:     ["torment", "power", "health", "spirit", "will"],
    BALLSICHERHEIT:  ["will", "health", "determination", "awareness"],
    // RUNDE 2 VERSUCHT UND VERWORFEN (14.11., Spaltenseite): TEAMGEIST brauchte laut Sondierung
    // 51,7 % der mechanischen Gesamtmasse, konnte aus spirit+charisma+torment (Matrixbudget
    // 25+4+16=45) aber nur 39,9 % tatsaechlich erreichen. "health" zusaetzlich zugelassen
    // (football-fachlich: der grosse, zaehe Zielspieler) hob diese Luecke NICHT (health ist
    // bereits anderswo voll ausgeschoepft, verschob nur die Komposition) und kostete Pp
    // (18,3 -> 26,3, durchgefallen) fuer einen kleinen rho-Gewinn (0,525 -> 0,564) — s.
    // docs/design/football-rezept-matrix-budget-14-11.md. Zurueckgerollt auf die urspruengliche
    // Drei-Attribute-Zelle; die naechste Runde braucht eine andere Spaltenseiten-Idee, keine
    // weitere Verdraengung eines bereits ausgeschoepften Attributs.
    TEAMGEIST:       ["spirit", "charisma", "will", "determination"],
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

// Startbelegung: gleichverteilt ueber die erlaubten Zellen (`prior` = 1 je erlaubter Zelle).
const attribute = Object.keys(matrix);

// Sinkhorn: abwechselnd Zeilen (Attributbudget = 1) und Spalten (Masse = Soll) normieren. Das
// Ergebnis ist die Diagonalskalierung der Startbelegung `prior` — verschiedene Prioren liefern
// verschiedene, aber IMMER zeilen- und spaltentreue Loesungen.
function sinkhorn(prior) {
  const q = {};
  for (const a of attribute) {
    q[a] = {};
    for (const s of subskills) if (erlaubt[s].includes(a)) q[a][s] = prior ? prior[a + "|" + s] : 1;
  }
  for (let runde = 0; runde < 4000; runde++) {
    for (const s of subskills) {
      let ist = 0;
      for (const a of attribute) ist += matrix[a] * (q[a][s] || 0);
      if (ist <= 0) continue;
      const f = soll[s] / ist;
      for (const a of attribute) if (q[a][s] != null) q[a][s] *= f;
    }
    for (const a of attribute) {
      const summe = Object.values(q[a]).reduce((x, y) => x + y, 0);
      if (summe > 0) for (const s in q[a]) q[a][s] /= summe;
    }
  }
  return q;
}
let p = sinkhorn(null);

// --kaderfamilie (NFL-Runde Football, 15.11., docs/design/football-opus-review-nfl-15-11.md
// Abschnitt 3): UNTER ALLEN zeilen- und spaltentreuen Loesungen die waehlen, deren Sub-Skills
// je fuer sich am besten mit der Eignung gehen. Reines Sinkhorn ist budget-treu, verteilt ein
// Attribut aber blind nach Proportion — bei Football landete so ein Sub-Skill bei rho 0,17 zur
// Eignung, obwohl er die halbe Wertung trug. Gesucht wird ueber die Startbelegung (Prior je
// Zelle, deterministischer Zufall), bewertet mit der soll-gewichteten mittleren Spearman-
// Korrelation Sub-Skill/Eignung INNERHALB der je 2x6 Antretenden jeder Paarung der echten
// Kaderfamilie (data/generated/kaderfamilie-live-save.json, dieselbe Quelle wie die rho-Abnahme).
// Die Zeilen (Matrix) und Spalten (Sondierung) bleiben dabei exakt erhalten — die Suche
// verschiebt NUR, welches Attribut in welcher erlaubten Zelle landet.
if (process.argv.includes("--kaderfamilie")) {
  const familie = JSON.parse(readFileSync(new URL("../data/generated/kaderfamilie-live-save.json", import.meta.url), "utf8"));
  const proSeite = 6;
  const gruppen = familie.varianten.map((v) => [v.heim, v.gast].flatMap((k) =>
    [...k].sort((x, y) => (y.d[DISZIPLIN] || 0) - (x.d[DISZIPLIN] || 0)).slice(0, proSeite)));
  const rang = (arr) => { const o = arr.map((v, i) => ({ v, i })).sort((x, y) => y.v - x.v); const r = new Array(arr.length);
    let k = 0; while (k < o.length) { let j = k; while (j + 1 < o.length && o[j + 1].v === o[k].v) j++;
      for (let m = k; m <= j; m++) r[o[m].i] = (k + j) / 2 + 1; k = j + 1; } return r; };
  const rho = (x, y) => { const a = rang(x), b = rang(y), n = x.length, ma = (n + 1) / 2;
    let sab = 0, sa = 0, sb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - ma); sa += (a[i] - ma) ** 2; sb += (b[i] - ma) ** 2; }
    return sab / Math.sqrt(sa * sb || 1); };
  const korr = (q, s) => {
    let t = 0;
    for (const g of gruppen) t += rho(g.map((pl) => pl.d[DISZIPLIN] || 0),
      g.map((pl) => attribute.reduce((x, a) => x + (pl.a[a] || 0) * matrix[a] * (q[a][s] || 0), 0)));
    return t / gruppen.length;
  };
  const ziel = (q) => subskills.reduce((x, s) => x + soll[s] * korr(q, s), 0) / 100;
  let prior = {};
  for (const a of attribute) for (const s of subskills) if (erlaubt[s].includes(a)) prior[a + "|" + s] = 1;
  let bester = ziel(p);
  console.log(`--kaderfamilie: reines Sinkhorn ${bester.toFixed(3)}`);
  let zustand = 7;
  const zufall = () => { zustand = (zustand * 1103515245 + 12345) & 0x7fffffff; return zustand / 0x7fffffff; };
  const schluessel = Object.keys(prior);
  const RUNDEN = 1500;
  for (let i = 0; i < RUNDEN; i++) {
    const neu = { ...prior };
    for (let k = 0; k < 2; k++) neu[schluessel[Math.floor(zufall() * schluessel.length)]] *= Math.exp((zufall() - 0.5) * 1.5);
    const q = sinkhorn(neu), z = ziel(q);
    if (z > bester) { bester = z; prior = neu; p = q; }
  }
  console.log(`--kaderfamilie: nach ${RUNDEN} Suchschritten ${bester.toFixed(3)}\n`);
  for (const s of subskills) console.log(`  rho(${s}, Eignung) = ${korr(p, s).toFixed(2)}`);
  console.log("");
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
  const anteile = roh.map((r) => ({ a: r.a, v: Math.round((r.v / summe) * 100) })).filter((r) => r.v > 0);
  // Rundungsrest auf den groessten Posten legen, damit die Zeile exakt 100 ergibt.
  const rest = 100 - anteile.reduce((x, y) => x + y.v, 0);
  if (anteile.length) anteile[0].v += rest;
  zeilen.push(`    ${(s + ":").padEnd(13)}{${anteile.map((r) => `${r.a}:${r.v}`).join(",")}}`);
}
console.log(zeilen.join(",\n"));
console.log("  }");

// BUDGET-TABELLE IN MATRIXPUNKTEN (Chris 15.11.: „die tabelle sollst du anpassen dass maximal
// die punkte aus der matrix vergeben werden"). Das Rezept oben ist je Sub-Skill auf 100 %
// normiert — dort kann ein Attribut optisch "53" tragen, obwohl die Matrix ihm nur 25 Punkte
// gibt. Diese Tabelle zeigt dieselbe Loesung in der Schreibweise der Matrix: jede ZEILE
// verteilt genau die Matrixpunkte des Attributs (nie mehr), jede SPALTE summiert sich auf das
// gemessene mechanische Gewicht des Sub-Skills.
console.log("\nBudget-Tabelle in Matrixpunkten (Zeile = Matrixgewicht, Spalte = mechanisches Gewicht)\n");
const kurz = (s) => s.slice(0, 9);
console.log("Attribut      " + subskills.map((s) => kurz(s).padStart(10)).join("") + "     Summe  Matrix");
for (const a of attribute) {
  const zelle = subskills.map((s) => (p[a][s] ? (matrix[a] * p[a][s]).toFixed(1) : "-").padStart(10));
  const summe = subskills.reduce((x, s) => x + matrix[a] * (p[a][s] || 0), 0);
  console.log(a.padEnd(14) + zelle.join("") + summe.toFixed(1).padStart(10) + String(matrix[a]).padStart(8));
}
console.log("Spaltensumme  " + subskills.map((s) =>
  attribute.reduce((x, a) => x + matrix[a] * (p[a][s] || 0), 0).toFixed(1).padStart(10)).join(""));
