// Hockey-Ton-Beweis (E2, Assets 80->100, 10.09.) — analog zu PR #876s N1-Beweis-Sonde
// (scripts/probe-n1-gewichtheben.mjs) und PR #883s Takeshi-Pendant
// (scripts/probe-takeshi-ton.mjs), fuer die fuenf neu verdrahteten Hockey-Aufrufstellen:
//
//   (a) Publikums-Loop startet bei Spielbeginn UND kehrt nach jedem reset() (= naechstes
//       Spiel) wieder zurueck — genau die N1-Garantie, die PR #879 fuer Gewichtheben und
//       PR #883 fuer Takeshi's Castle nachgewiesen haben, hier fuer
//       hockeyPublikumAn/eisflaeche().
//   (b) Die vier Ein-Schuss-Ereignisse schuss/treffer/pfiff/tor feuern waehrend eines
//       echten Hockey-Spiels tatsaechlich, nicht nur wenn man sfx() von aussen direkt
//       aufruft (das prueft schon der bestehende sfxProbe()-Haken, aber der belegt nur,
//       dass der KATALOG-Eintrag existiert, nicht dass die SIMULATION ihn erreicht).
//
// Methode fuer (b): dieselbe AudioContext-Instrumentierung wie beim N1-Beweis, aber statt
// nur Loop-Start/-Stop zu zaehlen, wird jede Oszillator-Frequenz beim start() mitgeschnitten
// (ueber AudioParam.prototype.setValueAtTime, nicht ueber den .value-Getter — robust
// gegenueber Timing). Die vier Ereignisse sind an Oszillatortyp+Frequenz eindeutig zu
// erkennen, weil TON_KATALOG.hockey (battle-mode.engine.js, s. "HOCKEY (Fable-Entscheidung
// E2 ...)") sie fest verdrahtet:
//   schuss  -> tonKlick(...) + tonSchlag(vol,420,140,...)  => Sinus-Oszillator, Start 420
//   treffer -> tonSchlag(vol,170,45,...) + tonRauschen(...) => Sinus-Oszillator, Start 170
//   pfiff   -> tonDoppelton(vol,2600,3100,...)              => zwei Sinus-Oszillatoren,
//                                                               Start 2600 UND 3100
//   tor     -> tonTon(vol,220,...) + tonMetall(vol,440,...) => Sinus-Oszillator Start 220,
//                                                               PLUS zwei Rechteck-
//                                                               Oszillatoren um 440
//                                                               (Verstimmung 1x/1,0075x)
// Kein anderes Katalog-Ereignis in einer laufenden Hockey-Partie erzeugt einen Sinus bei
// 420, 170, 2600, 3100 oder 220, bzw. ein Rechteck-Paar um 440 — die Buckets sind
// kollisionsfrei fuer diesen Test (nur TON_KATALOG.hockey laeuft mit, s. dortige Werte;
// keine andere Disziplin ist waehrend dieser Sonde geladen).
//
// Aufruf: node scripts/probe-hockey-ton.mjs (kein Argument)
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
// (inkl. der Engine-eigenen tonKontext()) die gepatchte Version erbt.
await seite.addInitScript(() => {
  window.__loopStarts = 0;
  window.__loopStops = 0;
  window.__oscLog = []; // {type, freq} je start()

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
// dabei nie wirft — die Grundlage, auf der die Verdrahtung unten aufbaut.
const katalog = await seite.evaluate(() => ({
  schuss: window.__arena.sfxProbe("hockey", "schuss"),
  treffer: window.__arena.sfxProbe("hockey", "treffer"),
  pfiff: window.__arena.sfxProbe("hockey", "pfiff"),
  tor: window.__arena.sfxProbe("hockey", "tor"),
  publikum: window.__arena.tonLoopProbe("hockey"),
}));
console.log("Katalog-Eintraege (sfxProbe/tonLoopProbe, rufen sfx() direkt, kein Fehler erwartet):");
console.log("  schuss=" + JSON.stringify(katalog.schuss) + " treffer=" + JSON.stringify(katalog.treffer) +
  " pfiff=" + JSON.stringify(katalog.pfiff) + " tor=" + JSON.stringify(katalog.tor) +
  " publikum=" + JSON.stringify(katalog.publikum));
// tonLoopProbe() oben hat selbst einen Start+Stop erzeugt (Diagnose-Aufruf) -- Zaehler vor
// Teil B auf 0 zuruecksetzen, sonst waere die Basis fuer den Loop-Beweis unten verfaelscht.
await seite.evaluate(() => { window.__loopStarts = 0; window.__loopStops = 0; });

// TEIL B: Publikums-Loop ueber drei Hockey-"Spiele" hinweg (Spiel 1: setDisc, Spiel 2+3:
// #reset ohne Disziplinwechsel — derselbe Codepfad wie "noch ein Hockeyspiel").
const gesetzt = await seite.evaluate((d) => {
  try { window.__arena.setDisc(d); return true; } catch (e) { return String(e); }
}, "hockey");
if (gesetzt !== true) {
  console.error("setDisc fehlgeschlagen: " + gesetzt);
  await browser.close();
  process.exit(1);
}
await seite.click("#play");
// Tempo auf 4x, damit ein Spiel in vertretbarer Wallclock-Zeit durchlaeuft.
await seite.click("#spd"); await seite.click("#spd");
await seite.waitForTimeout(1500);
const nach1 = await seite.evaluate(() => ({ starts: window.__loopStarts, stops: window.__loopStops }));

await seite.click("#reset");
await seite.click("#play");
await seite.click("#spd"); await seite.click("#spd"); // Tempo-Flag sicherheitshalber neu setzen
await seite.waitForTimeout(1500);
const nach2 = await seite.evaluate(() => ({ starts: window.__loopStarts, stops: window.__loopStops }));

await seite.click("#reset");
await seite.click("#play");
await seite.waitForTimeout(1500);
const nach3 = await seite.evaluate(() => ({ starts: window.__loopStarts, stops: window.__loopStops }));

console.log("\nPublikums-Loop (hockeyPublikumAn):");
console.log("Nach Spiel 1 (setDisc):      gestartete Loop-Quellen = " + nach1.starts + ", gestoppte = " + nach1.stops);
console.log("Nach Spiel 2 (#reset+#play): gestartete Loop-Quellen = " + nach2.starts + ", gestoppte = " + nach2.stops);
console.log("Nach Spiel 3 (#reset+#play): gestartete Loop-Quellen = " + nach3.starts + ", gestoppte = " + nach3.stops);
console.log("Erwartung bei korrekter Buchfuehrung (N1-Muster angewendet): 1, 2, 3.");
const loopOk = nach1.starts === 1 && nach2.starts === 2 && nach3.starts === 3;
console.log(loopOk ? "PUBLIKUMS-LOOP: BESTANDEN" : "PUBLIKUMS-LOOP: FEHLGESCHLAGEN");

// TEIL C: das dritte Spiel laeuft noch (nach dem #reset+#play oben) — jetzt lange genug
// zusehen, dass ein echtes Spiel weit genug laeuft (3 Drittel a 80s Simulationszeit, bei
// 4x Tempo rund 60-70s Wallclock, s. ZEIT_DEHNUNG-Kommentar bei FELDSPIEL_ART.hockey) und
// dabei tatsaechlich sfx() ueber die vier neu verdrahteten Stellen ausloest.
await seite.evaluate(() => { window.__oscLog.length = 0; });
await seite.click("#spd"); await seite.click("#spd"); // sicherstellen: 4x
await seite.waitForTimeout(90000);
const log = await seite.evaluate(() => window.__oscLog.slice());

const nahe = (f, ziel, tol) => Math.abs(f - ziel) <= tol;
const schussTreffer = log.filter(e => e.type === "sine" && nahe(e.freq, 420, 4)).length;
const trefferTreffer = log.filter(e => e.type === "sine" && nahe(e.freq, 170, 3)).length;
const pfiffTreffer = log.filter(e => e.type === "sine" && (nahe(e.freq, 2600, 6) || nahe(e.freq, 3100, 6))).length;
const torSinus = log.filter(e => e.type === "sine" && nahe(e.freq, 220, 3)).length;
const torRechteck = log.filter(e => e.type === "square" && nahe(e.freq, 440, 6)).length;

console.log("\nEin-Schuss-Ereignisse waehrend eines echten 4x-Hockeyspiels (90 s Wallclock):");
console.log("  schuss  (Sinus ~420 Hz):            " + schussTreffer + " Treffer");
console.log("  treffer (Sinus ~170 Hz):             " + trefferTreffer + " Treffer");
console.log("  pfiff   (Sinus ~2600/3100 Hz):        " + pfiffTreffer + " Treffer");
console.log("  tor     (Sinus ~220 Hz + Rechteck ~440 Hz, paarweise): " + torSinus + " / " + torRechteck);
console.log("  (alle Oszillator-Events im Fenster, zur Kontrolle: " + log.length + ")");

// pfiff ist selten (HK_FOUL_ANTEIL trifft nur einen Teil der ohnehin seltenen Bodychecks
// je Spiel) — ein einzelnes 90s-Fenster kann ihn verpassen, ohne dass die Verdrahtung
// falsch waere. schuss/treffer/tor sind haeufig genug, dass ihr Ausbleiben auf einen
// echten Verdrahtungsfehler hindeutet; pfiff wird gemeldet, aber nicht hart verlangt.
const sfxKernOk = schussTreffer > 0 && trefferTreffer > 0 && torSinus > 0 && torRechteck > 0;
console.log(sfxKernOk ? "SFX-VERDRAHTUNG (schuss/treffer/tor): BESTANDEN"
                      : "SFX-VERDRAHTUNG (schuss/treffer/tor): FEHLGESCHLAGEN (mindestens ein Ereignis blieb stumm)");
console.log(pfiffTreffer > 0 ? "SFX-VERDRAHTUNG (pfiff): BESTANDEN (mindestens einmal gepfiffen)"
                             : "SFX-VERDRAHTUNG (pfiff): NICHT BEOBACHTET in diesem Fenster (selten, kein Fehlschlag fuer sich allein)");

console.log("\nSeitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));

const ok = loopOk && sfxKernOk && fehler.length === 0;
console.log(ok ? "\nGESAMT: BESTANDEN" : "\nGESAMT: FEHLGESCHLAGEN");
await browser.close();
process.exit(ok ? 0 : 1);
