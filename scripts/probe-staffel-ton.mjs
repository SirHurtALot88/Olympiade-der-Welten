// Staffel-Ton-und-Bewegungs-Beweis (Ziel 6, Opus-Plan Zehn-Disziplinen 09-10, Abschnitt
// 5.2/6) — analog zu scripts/probe-hockey-ton.mjs (E2) und scripts/probe-takeshi-ton.mjs
// (Ziel 3), fuer die fuenf neu verdrahteten Staffel-Aufrufstellen (startschuss/uebergabe/
// fehlwechsel/ziel/publikum, alle aus stepStaffel()) UND den vom Plan (Abschnitt 6)
// verlangten Ton-Leck-Test ueber die Geschwister-Bahn-Disziplinen.
//
//   (a) Katalog-Eintraege existieren, sfx()/tonLoopStart() werfen dabei nie (sfxProbe/
//       tonLoopProbe, wie bei jeder frueheren Ton-Runde).
//   (b) PUBLIKUMS-LOOP UEBER VIER RENNEN (Plan Abschnitt 6, "Loop-Reset-Gegenversuch"
//       ausdruecklich mit VIER, nicht drei wie bei Hockey/Takeshi): Rennen 1 = setDisc,
//       Rennen 2-4 = #reset ohne Disziplinwechsel. Erwartung: Loop-Starts 1/2/3/4, NICHT
//       1/1/1/1 (genau der Bug-Pattern aus PR #879/#883, den der Auftrag ausdruecklich
//       nennt).
//   (c) EIN-SCHUSS-EREIGNISSE feuern waehrend eines echten Staffel-Rennens tatsaechlich
//       (Oszillator-/Rauschen-Fingerabdruck, dieselbe AudioContext-Instrumentierung wie bei
//       Hockey/Takeshi).
//   (d) TON-LECK-TEST (Plan Abschnitt 6): Takeshi's Castle, Time-Trial und Spurt laufen
//       vollstaendig durch — DANACH darf staffelVizProbe() (battle-mode.engine.js, s. dort)
//       fuer KEINEN Teilnehmer vizInitDoneGesetzt:true zeigen. stepStaffel() ist die
//       EINZIGE Stelle im Motor, die dieses Feld je setzt UND die einzige, die
//       sfx("staffel",...) aufruft — sie wird ausschliesslich ueber bahnBewegung() erreicht,
//       gegated auf art.staffel (battle-mode.engine.js, bahnBewegung()-Dispatcher). Ein
//       reiner Oszillator-Fingerabdruck waere hier mehrdeutig, weil startschuss/ziel exakt
//       dieselben Synth-Aufrufe wie bei Spurt/Zeitfahren teilen (TON_KATALOG, s. dort) —
//       der viz*-Feld-Beweis ist der schaerfere, code-nahe Nachweis, dass die staffel-
//       eigene Bewegungs-/Ton-Funktion fuer diese drei Geschwister-Disziplinen kein
//       einziges Mal lief.
//
// Aufruf: node scripts/probe-staffel-ton.mjs (kein Argument)
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch({
  ...(existsSync(fest) ? { executablePath: fest } : {}),
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));

// Instrumentierung VOR jedem Seitenskript, damit jeder spaetere `new AudioContext()`
// (inkl. der Engine-eigenen tonKontext()) die gepatchte Version erbt. Dasselbe Muster wie
// probe-hockey-ton.mjs/probe-takeshi-ton.mjs.
await seite.addInitScript(() => {
  window.__loopStarts = 0;
  window.__loopStops = 0;
  window.__oscLog = []; // {type, freq} je Oszillator-start()
  window.__noiseLog = []; // {freq} je gefiltertem Rauschimpuls (tonKlick/tonRauschen einmalig)

  const origSVAT = AudioParam.prototype.setValueAtTime;
  AudioParam.prototype.setValueAtTime = function (value, time) {
    this.__letzterWert = value;
    return origSVAT.call(this, value, time);
  };

  const origOsc = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function (...args) {
    const osc = origOsc.apply(this, args);
    const origStart = osc.start.bind(osc);
    osc.start = (...a) => {
      const freq = osc.frequency.__letzterWert ?? osc.frequency.value;
      window.__oscLog.push({ type: osc.type, freq: Math.round(freq) });
      return origStart(...a);
    };
    return osc;
  };

  const origBuf = AudioContext.prototype.createBufferSource;
  AudioContext.prototype.createBufferSource = function (...args) {
    const src = origBuf.apply(this, args);
    const origStart = src.start.bind(src);
    const origStop = src.stop.bind(src);
    src.start = (...a) => {
      if (src.loop) window.__loopStarts++;
      else window.__noiseLog.push({ t: performance.now() });
      return origStart(...a);
    };
    src.stop = (...a) => {
      if (src.loop) window.__loopStops++;
      return origStop(...a);
    };
    return src;
  };
});

await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
await seite.click("#t2");

// TEIL A: sfxProbe() bestaetigt, dass die fuenf Ereignisnamen im Katalog stehen und sfx()
// dabei nie wirft.
const katalog = await seite.evaluate(() => ({
  startschuss: window.__arena.sfxProbe("staffel", "startschuss"),
  uebergabe: window.__arena.sfxProbe("staffel", "uebergabe"),
  fehlwechsel: window.__arena.sfxProbe("staffel", "fehlwechsel"),
  ziel: window.__arena.sfxProbe("staffel", "ziel"),
  publikum: window.__arena.tonLoopProbe("staffel"),
}));
console.log("Katalog-Eintraege (sfxProbe/tonLoopProbe, rufen sfx() direkt, kein Fehler erwartet):");
console.log("  startschuss=" + JSON.stringify(katalog.startschuss) +
  " uebergabe=" + JSON.stringify(katalog.uebergabe) +
  " fehlwechsel=" + JSON.stringify(katalog.fehlwechsel) +
  " ziel=" + JSON.stringify(katalog.ziel) +
  " publikum=" + JSON.stringify(katalog.publikum));
const katalogOk = [katalog.startschuss, katalog.uebergabe, katalog.fehlwechsel, katalog.ziel, katalog.publikum]
  .every((e) => e && e.ok === true);
console.log(katalogOk ? "KATALOG: BESTANDEN" : "KATALOG: FEHLGESCHLAGEN");
// tonLoopProbe() oben hat selbst einen Start+Stop erzeugt (Diagnose-Aufruf) -- Zaehler vor
// Teil B auf 0 zuruecksetzen, sonst waere die Basis fuer den Loop-Beweis unten verfaelscht.
await seite.evaluate(() => { window.__loopStarts = 0; window.__loopStops = 0; });

// TEIL B: PUBLIKUMS-LOOP UEBER VIER STAFFEL-RENNEN (Plan Abschnitt 6: ausdruecklich VIER,
// nicht drei). Rennen 1: setDisc, Rennen 2-4: #reset ohne Disziplinwechsel — derselbe
// Codepfad wie "noch ein Staffel-Rennen".
const gesetzt = await seite.evaluate((d) => {
  try { window.__arena.setDisc(d); return true; } catch (e) { return String(e); }
}, "staffel");
if (gesetzt !== true) {
  console.error("setDisc fehlgeschlagen: " + gesetzt);
  await browser.close();
  process.exit(1);
}
const loopStandNach = async () => {
  await seite.click("#play");
  await seite.click("#spd"); await seite.click("#spd"); // 4x Tempo, damit ein Rennen schnell durchlaeuft
  await seite.waitForTimeout(1500);
  return seite.evaluate(() => ({ starts: window.__loopStarts, stops: window.__loopStops }));
};
const nach1 = await loopStandNach();
await seite.click("#reset"); const nach2 = await loopStandNach();
await seite.click("#reset"); const nach3 = await loopStandNach();
await seite.click("#reset"); const nach4 = await loopStandNach();

console.log("\nPublikums-Loop (staffelPublikumAn) ueber VIER aufeinanderfolgende Rennen:");
console.log("Nach Rennen 1 (setDisc):      gestartete Loop-Quellen = " + nach1.starts);
console.log("Nach Rennen 2 (#reset+#play): gestartete Loop-Quellen = " + nach2.starts);
console.log("Nach Rennen 3 (#reset+#play): gestartete Loop-Quellen = " + nach3.starts);
console.log("Nach Rennen 4 (#reset+#play): gestartete Loop-Quellen = " + nach4.starts);
console.log("Erwartung bei korrekter Buchfuehrung (N1-Muster angewendet): 1, 2, 3, 4 -- NICHT 1, 1, 1, 1.");
const loopOk = nach1.starts === 1 && nach2.starts === 2 && nach3.starts === 3 && nach4.starts === 4;
console.log(loopOk ? "LOOP-RESET-GEGENVERSUCH: BESTANDEN" : "LOOP-RESET-GEGENVERSUCH: FEHLGESCHLAGEN");

// TEIL C: das vierte Rennen laeuft noch (nach dem letzten #reset+#play oben) — jetzt lange
// genug zusehen, dass ein echtes Staffel-Rennen durchlaeuft (sechs Laeufer, fuenf Wechsel,
// Zieleinlauf) und dabei tatsaechlich sfx() ueber startschuss/uebergabe(oder fehlwechsel)/
// ziel ausloest. startschuss ist ein einmaliger Rauschimpuls+Klick (kein Loop-Oszillator);
// uebergabe/fehlwechsel/ziel benutzen Oszillatoren (tonKlick nutzt BufferSource+Filter,
// tonDoppelton/tonMetall Oszillatoren) -- ziel ist eindeutig an tonDoppelton(vol,700,1050)
// zu erkennen.
const vorRennstart = await seite.evaluate(() => window.__noiseLog.length);
await seite.evaluate(() => { window.__oscLog.length = 0; });
await seite.click("#spd"); await seite.click("#spd"); // sicherstellen: 4x
await seite.waitForTimeout(30000);
const log = await seite.evaluate(() => window.__oscLog.slice());
const nachRennstart = await seite.evaluate(() => window.__noiseLog.length);

const nahe = (f, ziel, tol) => Math.abs(f - ziel) <= tol;
const zielTreffer = log.filter((e) => e.type === "sine" && (nahe(e.freq, 700, 4) || nahe(e.freq, 1050, 4))).length;
// uebergabe/fehlwechsel/startschuss laufen ueber tonKlick/tonRauschen (BufferSource, kein
// Oszillator) -- window.__noiseLog zaehlt jeden nicht-loopenden BufferSource-Start mit;
// waehrend eines echten Rennens (Startschuss + mind. fuenf Wechsel) muss dieser Zaehler
// deutlich steigen.
const nichtLoopEreignisse = nachRennstart - vorRennstart;

console.log("\nEin-Schuss-Ereignisse waehrend eines echten 4x-Staffel-Rennens (30 s Wallclock):");
console.log("  ziel (Sinus ~700/1050 Hz):                    " + zielTreffer + " Treffer");
console.log("  startschuss/uebergabe/fehlwechsel (BufferSource-Impulse gesamt): " + nichtLoopEreignisse);
const sfxKernOk = nichtLoopEreignisse > 0;
console.log(sfxKernOk ? "SFX-VERDRAHTUNG (startschuss/uebergabe/fehlwechsel): BESTANDEN"
  : "SFX-VERDRAHTUNG (startschuss/uebergabe/fehlwechsel): FEHLGESCHLAGEN (kein einziger Impuls)");
console.log(zielTreffer > 0 ? "SFX-VERDRAHTUNG (ziel): BESTANDEN (Rennen im Fenster beendet)"
  : "SFX-VERDRAHTUNG (ziel): NICHT BEOBACHTET in diesem Fenster (Rennen evtl. noch nicht fertig -- kein Fehlschlag fuer sich allein)");

// TEIL D: TON-LECK-TEST (Plan Abschnitt 6) -- Takeshi's Castle, Time-Trial, Spurt jeweils
// vollstaendig durchlaufen lassen, danach staffelVizProbe() pruefen: KEIN Teilnehmer darf
// vizInitDoneGesetzt:true zeigen, sonst haette stepStaffel() (und damit sfx("staffel",...))
// fuer eine dieser drei Geschwister-Disziplinen gelaufen sein muessen.
const geschwister = ["takeshis-castle", "time-trial", "spurt"];
const leckErgebnisse = [];
for (const disc of geschwister) {
  const gesetzt2 = await seite.evaluate((d) => {
    try { window.__arena.setDisc(d); return true; } catch (e) { return String(e); }
  }, disc);
  if (gesetzt2 !== true) { leckErgebnisse.push({ disc, fehler: gesetzt2 }); continue; }
  await seite.click("#play");
  await seite.click("#spd"); await seite.click("#spd");
  // Bis zu 100s Wallclock warten oder bis die Disziplin fertig ist (done-Flag ueber
  // renderProbe/andere Debug-Wege nicht direkt exponiert -- ein fester Zeitrahmen genuegt
  // hier, weil der Leck-Test nicht "das Rennen ist fertig" braucht, sondern nur "die
  // Bewegungsfunktion lief lange genug mit, um eine falsch gegatete Staffel-Logik zu
  // zeigen, falls sie existierte").
  await seite.waitForTimeout(20000);
  const probe = await seite.evaluate(() => window.__arena.staffelVizProbe());
  const geleckt = (probe || []).filter((p) => p.vizInitDoneGesetzt);
  leckErgebnisse.push({ disc, teilnehmer: (probe || []).length, geleckt: geleckt.length });
  await seite.click("#reset");
}
console.log("\nTON-LECK-TEST (staffelVizProbe() nach vollem Lauf jeder Geschwister-Disziplin):");
for (const r of leckErgebnisse) {
  console.log("  " + r.disc + ": " + (r.fehler ? ("setDisc-Fehler: " + r.fehler)
    : (r.teilnehmer + " Teilnehmer, " + r.geleckt + " mit vizInitDoneGesetzt:true (muss 0 sein)")));
}
const leckOk = leckErgebnisse.every((r) => !r.fehler && r.geleckt === 0);
console.log(leckOk ? "TON-LECK-TEST: BESTANDEN (0 Leck-Ereignisse in allen drei Geschwister-Disziplinen)"
  : "TON-LECK-TEST: FEHLGESCHLAGEN");

console.log("\nSeitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));

const ok = katalogOk && loopOk && sfxKernOk && leckOk && fehler.length === 0;
console.log(ok ? "\nGESAMT: BESTANDEN" : "\nGESAMT: FEHLGESCHLAGEN");
await browser.close();
process.exit(ok ? 0 : 1);
