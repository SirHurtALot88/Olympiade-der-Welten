// KLUMPEN-/SPACING-MESSUNG FUER DIE FELDSPIELE (Benchmark Basketball, 17.11.).
//
// Chris: "alle laufen immer nur als klumpen gefuehlt rum ... niemand steht mal separat und ist
// frei fuer einen pass". Diese Sonde macht daraus Zahlen (window.__arena.diagSpacing, read-only,
// s. dort): mittlerer Mitspielerabstand, Anteil Ticks mit >=3 Spielern in einem kleinen Kreis,
// Spieler im Ballumfeld, und wie oft der Ballfuehrer mindestens eine freie Anspielstation hat.
// Laeuft ohne Chromium ueber den Node-Motor (lib/battle/arena-node-motor.mjs), Standardkader.
//
//   node scripts/miss-spacing.mjs [disziplin] [spiele] [sekunden] [radius]
//   node scripts/miss-spacing.mjs basketball 6 120 45
//
// Optional: OLY_ENGINE_DATEI=<pfad> misst eine andere Engine-Datei (Vorher/Nachher-Vergleich),
// z.B. eine Kopie des main-Stands.
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { baueMotorKontext } from "../lib/battle/arena-node-motor.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOCKUP = path.join(WURZEL, "public", "mockups");
const [disziplin = "basketball", spiele = "6", sekunden = "120", radius = "45"] = process.argv.slice(2);
const enginePfad = process.env.OLY_ENGINE_DATEI || path.join(MOCKUP, "battle-mode.engine.js");

const kontext = baueMotorKontext();
try {
  new vm.Script(readFileSync(path.join(MOCKUP, "battle-mode.rezepte.js"), "utf8")).runInContext(kontext.fenster);
  new vm.Script(readFileSync(enginePfad, "utf8"), { filename: enginePfad }).runInContext(kontext.fenster);
  for (let i = 0; i < 2000 && !kontext.fenster.__arena; i += 1) await new Promise((r) => setImmediate(r));
  const A = kontext.fenster.__arena;
  if (!A || typeof A.diagSpacing !== "function") throw new Error("window.__arena.diagSpacing fehlt in " + enginePfad);
  const erg = A.diagSpacing(Number(spiele), Number(sekunden), disziplin, Number(radius));
  console.log(JSON.stringify({ disziplin, engine: path.relative(WURZEL, enginePfad), ...erg }, null, 1));
} finally {
  kontext.aufraeumen();
}
process.exit(0);
