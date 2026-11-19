// @ts-check
/**
 * NODE-SEITE FUER DIE MESSSKRIPTE (Climbing-Canyon-Bau, 18.11.): eine Playwright-artige `seite` mit
 * `evaluate(fn, arg)`, die den Arena-Motor im `node:vm`-Kontext von `lib/battle/arena-node-motor.mjs`
 * statt in Chromium ausfuehrt. Damit laufen `disziplinMessen()` (rangtreue-messung.mjs) und
 * `window.__arena.einflussVon()` ohne Browser -- derselbe Messcode, derselbe Motor; der Node-Motor ist
 * gegen Chromium bitgleich (Fingerabdruck, s. arena-node-motor.mjs Kopfkommentar und
 * docs/design/arena-start-ende-figuren-18-11.md).
 *
 * `evaluate()` serialisiert die Funktion als Quelltext und das Argument als JSON, genau wie Playwright;
 * die Funktion sieht also nur `window` (den Kontext), keine Variablen aus dem Aufrufer.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { baueMotorKontext } from "../../lib/battle/arena-node-motor.mjs";

/**
 * @param {string} mockupVerzeichnis  Ordner mit battle-mode.rezepte.js und battle-mode.engine.js
 * @param {{ enginePfad?: string, bahnFlags?: Record<string, unknown> }} [opt]
 */
export async function oeffneNodeSeite(mockupVerzeichnis, opt = {}) {
  const kontext = baueMotorKontext();
  const enginePfad = opt.enginePfad || path.join(mockupVerzeichnis, "battle-mode.engine.js");
  // AudioContext wie in den Chromium-Messskripten abschalten (Speicherleck-Fix 01.10.).
  vm.runInContext("window.AudioContext = undefined; window.webkitAudioContext = undefined;", kontext.fenster);
  if (opt.bahnFlags) {
    kontext.fenster.__olyNodeUebergabe = JSON.stringify(opt.bahnFlags);
    vm.runInContext("window.__olyBahnFlags = JSON.parse(window.__olyNodeUebergabe); delete window.__olyNodeUebergabe;", kontext.fenster);
  }
  new vm.Script(readFileSync(path.join(mockupVerzeichnis, "battle-mode.rezepte.js"), "utf8")).runInContext(kontext.fenster);
  new vm.Script(readFileSync(enginePfad, "utf8"), { filename: enginePfad }).runInContext(kontext.fenster);
  for (let i = 0; i < 2000 && !kontext.fenster.__arena; i += 1) await new Promise((r) => setImmediate(r));
  if (!kontext.fenster.__arena) throw new Error("node-arena-seite: window.__arena nicht bereit");
  return {
    /** @param {Function|string} fn @param {unknown} [arg] */
    async evaluate(fn, arg) {
      kontext.fenster.__olyNodeArg = JSON.stringify(arg === undefined ? null : arg);
      const quelle = typeof fn === "function" ? fn.toString() : String(fn);
      const roh = vm.runInContext(
        // Mehrfach erreichte Objekte (auch Zyklen) werden beim zweiten Mal zu "[verweis]" -- genau die
        // Form, die scripts/pruefe-wertung-fingerabdruck.mjs (`sicher()`) aus einem Playwright-Ergebnis macht.
        `(() => { const a = JSON.parse(window.__olyNodeArg); delete window.__olyNodeArg;
                  const r = (${quelle})(a); const auf = new WeakSet();
                  return JSON.stringify(r === undefined ? null : r, (k, w) => {
                    if (w && typeof w === "object") { if (auf.has(w)) return "[verweis]"; auf.add(w); }
                    return w; }); })()`,
        kontext.fenster,
      );
      return JSON.parse(roh);
    },
    fenster: kontext.fenster,
    schliessen() { kontext.aufraeumen(); },
  };
}
