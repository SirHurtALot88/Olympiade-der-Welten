// Sicht-QA fuer PR S2 (Talentshow-Konzept, "Die sechs Acts"): screenshotet gezielt JEDEN der
// sechs Acts, je einmal mit einer typischen (LPC-)Kaderfigur UND einmal mit einer Vollbild-/
// reiherMech-Kreatur -- die von der PR-Beschreibung explizit verlangte Verifikation ("nicht nur
// 1-2 Beispielfiguren", Lehre aus der Zeitfahr-Weste-Runde).
//
// WARUM EIN EIGENER KADER STATT DES STANDALONE-DEMOKADERS: der hartkodierte 17-Charakter-
// Demokader (SQUAD+OPP) liefert fuer Kampfkunst/Schuetzenkunst/Zaubershow KEINE Vollbild-
// Kreatur (nachgemessen: keiner der vier Vollbild-Charaktere -- Lava Golem/Krolach/Krag'Zul/
// Tidesprinter -- traegt eine Waffen-/Warrior-/Hunter-lastige Unterklassen-Kombination, die den
// eingebauten Kraftakt/Akrobatik-Bauplanvorsprung von 3 Punkten schlagen wuerde). Statt eine
// nicht existierende Kombination vorzutaeuschen, nutzt dieses Skript window.__arena.kaderSetzen
// (rein additiv, s. Kommentar dort), um GEZIELT drei Vollbild-Baupläne (Terradon/Vorrak/
// Abysskraken) mit Klasse/Unterklasse zu versehen, die sie ueber actVon()s eigene, im Produkt
// bereits vorhandene Punktetabelle in genau den gewuenschten Act zwingen -- keine neue Logik,
// nur eine deterministische Wahl der Eingabedaten. Lava Golem/Seraph-11/Tidesprinter liefern
// ihre Acts bereits natuerlich (unveraendert aus dem Demokader uebernommen).
//
// DETERMINISTISCHE REIHENFOLGE STATT POLLING: die Buehnenwarteschlange sortiert je Seite
// aufsteigend nach `eig` (s. bauBuehne()-Kommentar "TALENTSHOW-AUFTRITTSREIHENFOLGE") und ist
// bei Showcase je Teilnehmer 5 Enthuellungen (rundenN) x 1,0s (rundenDauer) am Stueck. Die
// Charisma-Werte unten sind bewusst so gestaffelt, dass jede Seite in exakt der hier
// aufgefuehrten Reihenfolge auftritt -- das Skript screenshotet deshalb zeitgesteuert statt
// den Bildschirminhalt zu parsen.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const ausgabeDir = process.argv[2] || path.join(WURZEL, "tmp-ux-audit", "showcase-s2");
mkdirSync(ausgabeDir, { recursive: true });

// Voller Attribut-Satz (dieselben zwoelf Schluessel wie SQUAD/OPP) -- alle Nicht-Charisma-Werte
// bewusst gleich und moderat, damit ausschliesslich Charisma die Reihenfolge bestimmt
// (Rezept-Matrix: charisma 27, mit Abstand das schwerste Gewicht).
// power/intelligence/dexterity/speed absichtlich WEIT unter jedem verwendeten Charisma-Wert
// (mindestens 10) -- sonst kann die Attribut-Kipp-Regel in actVon() (Konzept Abschnitt 3.2
// Punkt 3: "das Maximum aus {charisma,power,intelligence,dexterity/speed} gibt einen Punkt")
// bei einem knappen Gleichstand (z.B. Vollbild+Effekt: Kraftakt 3 gegen Zaubershow 3) den
// erzwungenen Ziel-Act ueberraschend kippen -- nachgemessen bei Vorrak (s. unten).
const basisAttr = (charisma) => ({
  power: 5, health: 40, stamina: 30, intelligence: 5, awareness: 30,
  determination: 30, speed: 5, dexterity: 5, charisma, will: 30, spirit: 30, torment: 10,
});
// `d` MUSS vorhanden sein (auch leer) -- setz() liest ungeprueft `p.d[buehneDisc]`
// (":12957"), ein Kader ohne dieses Feld crasht bauBuehne() sofort. SQUAD/OPP tragen es nur
// fuer tdm/spurt vor; showcase fehlt darin ohnehin immer und faellt dann auf `gewichtet(p.a,
// BASIS_JE_DISC.showcase)` zurueck -- exakt das gewuenschte Verhalten.
const D = {};

// HEIM (side 0): sechs TYPISCHE (LPC-)Kaderfiguren, eine je Act, aufsteigend nach Charisma.
// GROSSE ABSTAENDE (300 statt anfangs 20, s. Kopfkommentar-Nachtrag): `eig` ist NICHT nur
// Charisma*0,27, sondern zusaetzlich Slot-/Form-Aufschlag (engP/breitP in setz(), inkl.
// einer per Name GEZOGENEN Formkarte) -- bei nur 20 Charisma Abstand (~5,4 Punkte `eig`)
// reichte dieses Rauschen aus, um zwei Nachbarn zu vertauschen (Lava Golem/Tidesprinter
// tauschten beim ersten Versuch die Fenster). 300 Charisma Abstand (~81 Punkte `eig`) liegt
// weit ausserhalb dessen, was Slot/Formkarte je bewegen.
const heim = [
  { n: "Cassandra", c: "Bard", r: "Human", sub: ["Hunter", "Jungle"], tp: [], tn: [], groesse: 5, d: D, a: basisAttr(100) },
  { n: "Ralazar the Balanced", c: "Mage", r: "Human", sub: ["Warrior", "Mage"], tp: [], tn: [], groesse: 5, d: D, a: basisAttr(400) },
  { n: "Rhyx'Tal", c: "Badass", r: "Alien", sub: ["Isolated", "Controller", "Guardian"], tp: [], tn: [], groesse: 8, d: D, a: basisAttr(700) },
  { n: "Greenkraut", c: "Warlord", r: "Construct", sub: ["Behemoth", "Pet Master", "Druid"], tp: [], tn: [], groesse: 7, d: D, a: basisAttr(1000) },
  { n: "King Arlen Morgolor", c: "Hero", r: "Human", sub: ["Warrior", "Royalty"], tp: ["Eloquent"], tn: [], groesse: 5, d: D, a: basisAttr(1300) },
  { n: "Draco", c: "Warlord", r: "Human", sub: ["Knight", "Destroyer", "Scout"], tp: [], tn: [], groesse: 6, d: D, a: basisAttr(1600) },
];
// GAST (side 1): sechs VOLLBILD-/reiherMech-Kreaturen, eine je Act (drei natuerlich aus dem
// Demokader, drei ueber Klasse/Unterklasse gezielt in den Act gezwungen, s. Kopfkommentar),
// ebenfalls aufsteigend nach Charisma.
const gast = [
  // Vorrak (BAU vollbild:"golem", effekt:voidRot) hat von Natur aus 3 Punkte Kraftakt UND 3
  // Punkte Zaubershow (Gleichstand) -- Hunter+Scout (je 2) heben Schuetzenkunst auf 4 und
  // entscheiden eindeutig, ohne dass actVon() dafuer angefasst werden muesste.
  { n: "Vorrak", c: "Tank", r: "Human", sub: ["Hunter", "Scout"], tp: [], tn: [], groesse: 8, d: D, a: basisAttr(150) },
  // Abysskraken (BAU vollbild:"kraken", kein eigener Effekt) hat von Natur aus 3 Punkte
  // Akrobatik -- Mage-Klasse (2) + Warlock/Alchemist (je 2) heben Zaubershow auf 6.
  { n: "Abysskraken", c: "Mage", r: "Human", sub: ["Warlock", "Alchemist"], tp: [], tn: [], groesse: 7, d: D, a: basisAttr(450) },
  { n: "Tidesprinter", c: "Berserker", r: "Aqua", sub: ["Trickster", "Warrior"], tp: [], tn: [], groesse: 6, d: D, a: basisAttr(750) },
  { n: "Lava Golem", c: "Warlord", r: "Construct", sub: ["Wayfarer", "Behemoth"], tp: [], tn: [], groesse: 8, d: D, a: basisAttr(1050) },
  { n: "Seraph-11", c: "Bard", r: "Construct", sub: ["Healer", "Servant", "Guardian"], tp: [], tn: [], groesse: 6, d: D, a: basisAttr(1350) },
  // Terradon (BAU vollbild:"golem", effekt:feuer) hat von Natur aus denselben 3/3-Gleichstand
  // wie Vorrak -- Warlord (2) + Warrior/Knight (je 2) heben Kampfkunst auf 6.
  { n: "Terradon", c: "Warlord", r: "Human", sub: ["Warrior", "Knight"], tp: [], tn: [], groesse: 9, d: D, a: basisAttr(1650) },
];

const plan = [
  { fenster: 0, name: "Cassandra", act: "schuetzenkunst", art: "typisch" },
  { fenster: 1, name: "Vorrak", act: "schuetzenkunst", art: "vollbild" },
  { fenster: 2, name: "Ralazar the Balanced", act: "zaubershow", art: "typisch" },
  { fenster: 3, name: "Abysskraken", act: "zaubershow", art: "vollbild" },
  { fenster: 4, name: "Rhyx'Tal", act: "akrobatik", art: "typisch" },
  { fenster: 5, name: "Tidesprinter", act: "akrobatik", art: "vollbild" },
  { fenster: 6, name: "Greenkraut", act: "kraftakt", art: "typisch" },
  { fenster: 7, name: "Lava Golem", act: "kraftakt", art: "vollbild" },
  { fenster: 8, name: "King Arlen Morgolor", act: "gesang", art: "typisch" },
  { fenster: 9, name: "Seraph-11", act: "gesang", art: "reiherMech" },
  { fenster: 10, name: "Draco", act: "kampfkunst", art: "typisch" },
  { fenster: 11, name: "Terradon", act: "kampfkunst", art: "vollbild" },
];

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.setDisc && window.__arena.kaderSetzen, null, { timeout: 30000 });

const kaderErgebnis = await seite.evaluate((k) => window.__arena.kaderSetzen(k), { heim, gast });
console.log("kaderSetzen:", JSON.stringify(kaderErgebnis));

// SANITY-CHECK VOR DEM SPIEL: showcaseActProbe bestaetigt fuer alle zwoelf den geplanten Act,
// bevor irgendetwas gezeichnet wird (dasselbe Prinzip wie PR S0s Abnahme "kein Act > 50%,
// keiner bei 0%" -- hier: jeder geplante Act trifft).
const proben = await seite.evaluate((namen) => namen.map((n) => ({ n, probe: window.__arena.showcaseActProbe(n) })), plan.map((p) => p.name));
let probenOk = true;
for (const { n, probe } of proben) {
  const soll = plan.find((p) => p.name === n).act;
  const treffer = probe && probe.act === soll;
  if (!treffer) probenOk = false;
  console.log((treffer ? "OK  " : "FEHL") + "  " + n.padEnd(22) + " -> " + (probe ? probe.act : "null") + " (soll: " + soll + ")");
}
if (!probenOk) {
  console.error("Mindestens eine actVon()-Zuweisung traf nicht die geplante -- Screenshots trotzdem aufnehmen, aber Plan pruefen.");
}

const gesetzt = await seite.evaluate((d) => {
  try { window.__arena.setDisc(d); return true; } catch (e) { return String(e); }
}, "showcase");
if (gesetzt !== true) {
  console.error("setDisc(showcase) schlug fehl: " + gesetzt);
  await browser.close();
  process.exit(1);
}
await seite.click("#t2");
await seite.click("#play");

const cv = await seite.$("#cv");
const FENSTER_S = 5.0; // rundenN(5) * rundenDauer(1.0s)
const start = Date.now();
for (const eintrag of plan) {
  const zielMs = (eintrag.fenster * FENSTER_S + 1.2) * 1000; // 1,2s ins Fenster: nach der
  // zweiten Enthuellung (bei t=1,0s), waehrend deren u.lunge-Uhr noch laeuft (~0,2s hinein) --
  // guter Treffer fuer act-eigene Effekte (Funken/Fels/Geschoss/Noten/Mikrofon-Phase).
  const wartenMs = zielMs - (Date.now() - start);
  if (wartenMs > 0) await seite.waitForTimeout(wartenMs);
  const datei = path.join(ausgabeDir, String(eintrag.fenster).padStart(2, "0") + "-" + eintrag.act + "-" + eintrag.art + "-" + eintrag.name.replace(/[^a-zA-Z0-9]+/g, "_") + ".png");
  await cv.screenshot({ path: datei });
  console.log("Screenshot: " + datei + "  (t=" + ((Date.now() - start) / 1000).toFixed(2) + "s)");
}
console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
await browser.close();
