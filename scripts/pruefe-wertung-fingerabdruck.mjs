// WERTUNGS-FINGERABDRUCK (Kulissen-Integration 07.11.): beweist, dass eine reine Darstellungs-
// Aenderung (Kulisse/Boden) die Simulation nicht beruehrt. Derselbe Abgleich wie am 03.11.
// (docs/design/arena-kulissen-im-motor-03-11.md, "Wertung unveraendert"), jetzt als Skript:
//   - window.__arena.spiele(d, s) fuer alle 20 Disziplinen x 3 Saaten,
//   - disziplinProbe fuer TDM, Mini-DM, Battlefield,
//   - spieleArenaDomination (Battlefield),
//   - spieleBahnPod fuer Staffel und Takeshi, spieleBattlefieldPod (Vier-Team-Pod).
// Ausgabe: je Eintrag ein Kurz-Hash und ein Gesamt-Hash. Vorher/nachher vergleichen:
//   node scripts/pruefe-wertung-fingerabdruck.mjs > vorher.txt   (auf main)
//   node scripts/pruefe-wertung-fingerabdruck.mjs > nachher.txt  (auf dem Branch)
//   diff vorher.txt nachher.txt
// Laeuft mit leerer Kulissenliste UND mit der echten: beide Laeufe muessen gleich sein.
// --kulissen-effekt=aus (Oberflaechen-Effekte 08.11.): schaltet den Kulissen-Effekt fuer die ganze
// Messung ab (window.__arena.kulissePin("aus")). Damit muss der Gesamt-Hash wieder dem Stand vor
// dem Effekt entsprechen (22f04e06e285) -- Beleg, dass Staerke 0 bit-identisch ist. Ohne den
// Schalter aendern sich gewollt genau die Tennis-Eintraege.
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
  const ergebnis = await seite.evaluate(({ DISZIPLINEN, SAATEN, vierKader, vierTeams, KULISSEN_EFFEKT }) => {
    const A = window.__arena;
    if (KULISSEN_EFFEKT) A.kulissePin(KULISSEN_EFFEKT);
    const aus = [];
    const probe = (name, f) => { try { aus.push([name, f()]); } catch (e) { aus.push([name, "FEHLER " + String(e)]); } };
    for (const d of DISZIPLINEN) for (const s of SAATEN) probe(`spiele ${d} ${s}`, () => A.spiele(d, s));
    for (const d of ["tdm", "mini-dm", "battlefield"]) probe(`disziplinProbe ${d}`, () => A.disziplinProbe(d, { n: 6 }));
    for (const s of SAATEN) probe(`spieleArenaDomination ${s}`, () => A.spieleArenaDomination("battlefield", s, { jeSeite: 4 }));
    for (const bd of ["staffel", "takeshis-castle"]) probe(`spieleBahnPod ${bd}`, () => A.spieleBahnPod(bd, vierKader, "save:s1:md7:" + bd, null, { formSaat: "save:s1:md7:" + bd }));
    probe("spieleBattlefieldPod", () => A.spieleBattlefieldPod(vierTeams, "save:s1:md7:bf"));
    return aus;
  }, { DISZIPLINEN, SAATEN, vierKader, vierTeams, KULISSEN_EFFEKT });
  for (const [name, wert] of ergebnis) console.log(`${h(wert)}  ${name}`);
  console.log(`GESAMT ${h(ergebnis)} (${ergebnis.length} Eintraege)`);
} finally {
  await browser.close();
}
