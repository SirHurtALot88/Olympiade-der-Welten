// WERTUNGS-FINGERABDRUCK (Kulissen-Integration 07.11.): beweist, dass eine reine Darstellungs-
// Aenderung (Kulisse/Boden) die Simulation nicht beruehrt. Derselbe Abgleich wie am 03.11.
// (docs/design/arena-kulissen-im-motor-03-11.md, "Wertung unveraendert"), jetzt als Skript:
//   - window.__arena.spiele(d, s) fuer alle 20 Disziplinen x 3 Saaten,
//   - disziplinProbe fuer TDM, Mini-DM, Battlefield,
//   - spieleArenaDomination (Battlefield),
//   - spieleBahnPod fuer Staffel und Takeshi, spieleBattlefieldPod (Vier-Team-Pod),
//   - Spurt in den beiden Zusatzformaten "Die Hatz" und "HYROX" (spiele spurt/hatz|hyrox <saat>, 3 Saaten
//     je Format), mit window.__arena.bahnFlags({spurtFormat}) AUSDRUECKLICH gesetzt und danach wieder
//     auf "klassisch" zurueck. Grund (16.11., Opus-Review #1502): im echten Spiel waehlt die Saat das
//     Format (spurtFormatWaehlen()), die kader-losen Messwerkzeuge -- auch dieses -- laufen aber immer
//     "klassisch"; ohne diese Eintraege waeren Hatz und HYROX gegen Motoraenderungen UNGESCHUETZT.
//     Die Zusatz-Eintraege stehen ans ENDE der Liste: die 69 aelteren Zeilen behalten Reihenfolge und
//     Einzel-Hashes, nur GESAMT aendert sich (69 -> 75 Eintraege).
// GESAMT-STAND (17.11., I-Spy-Knack-Motor V2, docs/design/ispy-knacken-ortswahl-schubsen-17-11.md):
// `GESAMT d09e10bb872c (75 Eintraege)`; gegenueber dem Vorstand (`7c9257b4435c`, Kontakt im klassischen Spurt
// scharf) bewegen sich NUR die drei Zeilen `spiele i-spy 1|7|42`. Mit window.__arena.ispyMotor("alt") kommt
// wieder der Vorstand heraus.
// VORSTAND (17.11., vor I-Spy V2): `GESAMT 7c9257b4435c (75 Eintraege)` -- Kontakt im klassischen Spurt SCHARF
// (BAHN_ART.spurt.kontakt={stufe:3}, docs/design/kontakt-persoenlichkeit-16-11.md 6.5). Gegen den Stand davor
// bewegen sich NUR `spiele spurt 1` (d22c9e6244c2 -> 870e28b88ab3) und `spiele spurt 7` (3ee976267e5a ->
// 3732ee6cd899); `spiele spurt 42`, Hatz, HYROX, Takeshi und alle anderen 71 Zeilen sind gleich. Rueckweg:
// --kontakt-aus (alle Kontakt-Flags null) ergibt wieder `e80babacb68c`.
// VORHERIGER STAND (16.11., zweimal gelaufen, identisch): `GESAMT e80babacb68c (75 Eintraege)`. Davor,
// ohne die sechs Spurt-Zusatzformat-Eintraege: `GESAMT 0057e683fc3f (69 Eintraege)` -- die ersten 69
// Zeilen sind unveraendert, der alte Wert bleibt also als Praefix-Beleg pruefbar (die ersten 69
// Zeilen der Ausgabe diffen). Eine Motor-/Rezept-Aenderung, die diesen Wert absichtlich bewegt, nennt
// den neuen Wert im PR; eine reine Darstellungs-Aenderung darf ihn nicht bewegen. (Kein Test und keine
// CI-Stufe pinnt den Wert -- er wird per Hand vorher/nachher verglichen, s. unten.)
// Ausgabe: je Eintrag ein Kurz-Hash und ein Gesamt-Hash. Vorher/nachher vergleichen:
//   node scripts/pruefe-wertung-fingerabdruck.mjs > vorher.txt   (auf main)
//   node scripts/pruefe-wertung-fingerabdruck.mjs > nachher.txt  (auf dem Branch)
//   diff vorher.txt nachher.txt
// Laeuft mit leerer Kulissenliste UND mit der echten: beide Laeufe muessen gleich sein.
// --kulissen-effekt=aus (Oberflaechen-Effekte 08.11.): schaltet den Kulissen-Effekt fuer die ganze
// Messung ab (window.__arena.kulissePin("aus")). Damit muss der Gesamt-Hash wieder dem Stand vor
// dem Effekt entsprechen (Lauf auf main ohne Schalter == Lauf auf dem Branch mit
// --kulissen-effekt=aus) -- Beleg, dass Staerke 0 bit-identisch ist. Ohne den Schalter aendern
// sich gewollt genau die Tennis-Eintraege.
// --kontakt-flag (Kontakt-Schritt 0, 16.11., docs/design/kontakt-persoenlichkeit-16-11.md 6.5): setzt
// fuer ALLE Disziplinen `kontakt:{stufe:0}` (window.__arena.kontaktFlags) und gibt danach die Kontakt-
// Zaehler eines Spurt- und eines Takeshi-Rennens aus. In Schritt 0 hat das Flag keine Wirkung: GESAMT
// muss dem Lauf ohne Schalter gleichen. --kontakt-zwang=<typ> zwingt die Kontakt-Schicht auf einen
// Persoenlichkeitstyp (Kontrafaktik); das bewegt gewollt die Bahnen mit Rempler (Spurt, Takeshi).
// Seit 17.11. ist Spurt klassisch SCHARF (Engine-Standard spurt:{stufe:3}); --kontakt-flag setzt {stufe:0}
// deshalb nur fuer Disziplinen OHNE gesetztes Flag und laesst Spurt scharf.
// --kontakt-aus (17.11.): schaltet alle Kontakt-Flags ab (window.__arena.kontaktFlags({<d>:null})) -- der
// Rueckweg-Beleg: damit muss GESAMT wieder dem Stand vor dem Scharfschalten gleichen (e80babacb68c).
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public", "mockups", "battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const DISZIPLINEN = ["tdm", "mini-dm", "battlefield", "basketball", "football", "hockey", "gewichtheben", "showcase",
  "eiskunstlauf", "breaking", "wettessen", "speed-schach", "i-spy", "tennis", "fechten", "spurt", "time-trial",
  "climbing", "staffel", "takeshis-castle"];
const SAATEN = [1, 7, 42];
const KULISSEN_EFFEKT = process.argv.slice(2).find((a) => a.startsWith("--kulissen-effekt="))?.split("=")[1] ?? null;
const KONTAKT_FLAG = process.argv.slice(2).includes("--kontakt-flag");
const KONTAKT_AUS = process.argv.slice(2).includes("--kontakt-aus");
const KONTAKT_ZWANG = process.argv.slice(2).find((a) => a.startsWith("--kontakt-zwang="))?.split("=")[1] ?? null;
if (KONTAKT_ZWANG !== null && !["draufgaenger", "opportunist", "duellant", "schleicher", "beschuetzer", "bollwerk"].includes(KONTAKT_ZWANG)) {
  // Tippfehler (z. B. "Bollwerk") wuerden sonst lautlos als "Zwang ohne Wirkung" durchlaufen.
  console.error(`FEHLER: unbekannter --kontakt-zwang=${KONTAKT_ZWANG}`);
  process.exit(2);
}

const v = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten;
const vierKader = [v[0].heim, v[0].gast, v[1].heim, v[1].gast];
const vierTeams = [
  { name: v[0].heimName, kader: v[0].heim }, { name: v[0].gastName, kader: v[0].gast },
  { name: v[1].heimName, kader: v[1].heim }, { name: v[1].gastName, kader: v[1].gast },
];

// Einige Ergebnisse tragen Rueckverweise (z.B. `deckt`): Zyklen werden deterministisch markiert.
const sicher = (x) => { const auf = new WeakSet(); return JSON.stringify(x, (k, w) => {
  if (w && typeof w === "object") { if (auf.has(w)) return "[verweis]"; auf.add(w); }
  return w; }); };
const h = (x) => createHash("sha256").update(sicher(x)).digest("hex").slice(0, 12);
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
try {
  const seite = await browser.newPage();
  await seite.addInitScript(() => { window.AudioContext = undefined; });
  await seite.goto(SEITE);
  await seite.waitForFunction(() => window.__arena && window.__arena.spiele, null, { timeout: 60000 });
  const ergebnis = await seite.evaluate(({ DISZIPLINEN, SAATEN, vierKader, vierTeams, KULISSEN_EFFEKT, KONTAKT_FLAG, KONTAKT_AUS, KONTAKT_ZWANG }) => {
    const A = window.__arena;
    if (KULISSEN_EFFEKT) A.kulissePin(KULISSEN_EFFEKT);
    if (KONTAKT_AUS) A.kontaktFlags(Object.fromEntries(DISZIPLINEN.map((d) => [d, null])));
    if (KONTAKT_FLAG) {
      const schonGesetzt = A.kontaktFlags();
      A.kontaktFlags(Object.fromEntries(DISZIPLINEN.filter((d) => !schonGesetzt[d]).map((d) => [d, { stufe: 0 }])));
    }
    if (KONTAKT_ZWANG) A.kontaktPersZwang(KONTAKT_ZWANG);
    const aus = [];
    const probe = (name, f) => { try { aus.push([name, f()]); } catch (e) { aus.push([name, "FEHLER " + String(e)]); } };
    for (const d of DISZIPLINEN) for (const s of SAATEN) probe(`spiele ${d} ${s}`, () => A.spiele(d, s));
    for (const d of ["tdm", "mini-dm", "battlefield"]) probe(`disziplinProbe ${d}`, () => A.disziplinProbe(d, { n: 6 }));
    for (const s of SAATEN) probe(`spieleArenaDomination ${s}`, () => A.spieleArenaDomination("battlefield", s, { jeSeite: 4 }));
    for (const bd of ["staffel", "takeshis-castle"]) probe(`spieleBahnPod ${bd}`, () => A.spieleBahnPod(bd, vierKader, "save:s1:md7:" + bd, null, { formSaat: "save:s1:md7:" + bd }));
    probe("spieleBattlefieldPod", () => A.spieleBattlefieldPod(vierTeams, "save:s1:md7:bf"));
    // Spurt-Zusatzformate (s. Kopfkommentar): Format ausdruecklich setzen, messen, im finally zuruecksetzen.
    for (const fmt of ["hatz", "hyrox"]) for (const s of SAATEN) probe(`spiele spurt/${fmt} ${s}`, () => {
      A.bahnFlags({ spurtFormat: fmt });
      try { return A.spiele("spurt", s); } finally { A.bahnFlags({ spurtFormat: "klassisch" }); }
    });
    const kontakt = (KONTAKT_FLAG || KONTAKT_ZWANG) ? {
      flags: Object.keys(A.kontaktFlags()).length,
      zwang: A.kontaktPersZwang(),
      zaehler: ["spurt", "takeshis-castle"].map((d) => { A.spiele(d, 7); return [d, A.kontaktZaehler()]; }),
    } : null;
    return { aus, kontakt };
  }, { DISZIPLINEN, SAATEN, vierKader, vierTeams, KULISSEN_EFFEKT, KONTAKT_FLAG, KONTAKT_AUS, KONTAKT_ZWANG });
  for (const [name, wert] of ergebnis.aus) console.log(`${h(wert)}  ${name}`);
  console.log(`GESAMT ${h(ergebnis.aus)} (${ergebnis.aus.length} Eintraege)`);
  // Nach GESAMT, damit ein diff der ersten 76 Zeilen gegen einen Lauf ohne Schalter direkt geht.
  if (ergebnis.kontakt) console.log("KONTAKT " + JSON.stringify(ergebnis.kontakt));
} finally {
  await browser.close();
}
