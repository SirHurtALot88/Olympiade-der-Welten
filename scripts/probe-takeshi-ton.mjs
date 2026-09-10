// Takeshi's-Castle-Ton-Beweis (Ziel 3, A4, 10.09.) — analog zu PR #876s N1-Beweis-Sonde
// (scripts/probe-n1-gewichtheben.mjs), fuer die vier neu verdrahteten Aufrufstellen:
//
//   (a) Publikums-Loop startet bei Spielbeginn UND kehrt nach jedem reset() (= naechster
//       Kampf) wieder zurueck — genau die N1-Garantie, die PR #879 fuer Gewichtheben
//       nachgewiesen hat, hier fuer takeshiPublikumAn/bodenTakeshiRoute().
//   (b) Die drei Ein-Schuss-Ereignisse falle/sturz/tor feuern waehrend eines echten
//       Rennens tatsaechlich, nicht nur wenn man sfx() von aussen direkt aufruft
//       (das pruefte schon der bestehende sfxProbe()-Haken, aber der belegt nur, dass
//       der KATALOG-Eintrag existiert, nicht dass die SIMULATION ihn erreicht).
//
// Methode fuer (b): dieselbe AudioContext-Instrumentierung wie beim N1-Beweis, aber statt
// nur Loop-Start/-Stop zu zaehlen, wird jede Oszillator-Frequenz beim start() mitgeschnitten
// (ueber AudioParam.prototype.setValueAtTime, nicht ueber den .value-Getter — robust
// gegenueber Timing). Die drei Ereignisse sind an ihrer Frequenz eindeutig zu erkennen,
// weil TON_KATALOG["takeshis-castle"] (battle-mode.engine.js ~:16914) sie fest verdrahtet:
//   falle -> tonSchlag(vol,180,70,...)   => Sinus-Oszillator, Startfrequenz 180
//   sturz -> tonSchlag(vol,260,60,...)   => Sinus-Oszillator, Startfrequenz 260
//   tor   -> tonMetall(vol,300,...)      => zwei Rechteck-Oszillatoren um 300 (Verstimmung
//                                            1x und 1,0075x, s. tonMetall())
// Kein anderes Katalog-Ereignis in einer laufenden Takeshi-Partie erzeugt einen Sinus bei
// 180 oder 260 oder ein Rechteck-Paar um 300 — die Buckets sind kollisionsfrei fuer diesen
// Test (eiskunstlauf/gewichtheben laufen nicht mit).
//
// Aufruf: node scripts/probe-takeshi-ton.mjs (kein Argument)
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

// TEIL A: sfxProbe() bestaetigt, dass die vier Ereignisnamen im Katalog stehen und sfx()
// dabei nie wirft — die Grundlage, auf der die Verdrahtung unten aufbaut.
const katalog = await seite.evaluate(() => ({
  falle: window.__arena.sfxProbe("takeshis-castle", "falle"),
  sturz: window.__arena.sfxProbe("takeshis-castle", "sturz"),
  tor: window.__arena.sfxProbe("takeshis-castle", "tor"),
  publikum: window.__arena.tonLoopProbe("takeshis-castle"),
}));
console.log("Katalog-Eintraege (sfxProbe/tonLoopProbe, rufen sfx() direkt, kein Fehler erwartet):");
console.log("  falle="+JSON.stringify(katalog.falle)+" sturz="+JSON.stringify(katalog.sturz)+
  " tor="+JSON.stringify(katalog.tor)+" publikum="+JSON.stringify(katalog.publikum));
// tonLoopProbe() oben hat selbst einen Start+Stop erzeugt (Diagnose-Aufruf) -- Zaehler vor
// Teil B auf 0 zuruecksetzen, sonst waere die Basis fuer den Loop-Beweis unten verfaelscht.
await seite.evaluate(() => { window.__loopStarts = 0; window.__loopStops = 0; });

// TEIL B: Publikums-Loop ueber drei Takeshi-"Kaempfe" hinweg (Race 1: setDisc, Race 2+3:
// #reset ohne Disziplinwechsel — derselbe Codepfad wie "noch ein Takeshi-Rennen").
const gesetzt = await seite.evaluate((d) => {
  try { window.__arena.setDisc(d); return true; } catch (e) { return String(e); }
}, "takeshis-castle");
if (gesetzt !== true) {
  console.error("setDisc fehlgeschlagen: " + gesetzt);
  await browser.close();
  process.exit(1);
}
await seite.click("#play");
// Tempo auf 4x, damit ein Rennen in vertretbarer Wallclock-Zeit durchlaeuft.
await seite.click("#spd"); await seite.click("#spd");
await seite.waitForTimeout(1500);
const nach1 = await seite.evaluate(() => ({ starts: window.__loopStarts, stops: window.__loopStops }));

await seite.click("#reset");
await seite.click("#play");
await seite.click("#spd"); await seite.click("#spd"); // Tempo-Flag ist ein reset()-unabhaengiger Zustand? sicherheitshalber neu setzen
await seite.waitForTimeout(1500);
const nach2 = await seite.evaluate(() => ({ starts: window.__loopStarts, stops: window.__loopStops }));

await seite.click("#reset");
await seite.click("#play");
await seite.waitForTimeout(1500);
const nach3 = await seite.evaluate(() => ({ starts: window.__loopStarts, stops: window.__loopStops }));

console.log("\nPublikums-Loop (takeshiPublikumAn):");
console.log("Nach Rennen 1 (setDisc):      gestartete Loop-Quellen = " + nach1.starts + ", gestoppte = " + nach1.stops);
console.log("Nach Rennen 2 (#reset+#play): gestartete Loop-Quellen = " + nach2.starts + ", gestoppte = " + nach2.stops);
console.log("Nach Rennen 3 (#reset+#play): gestartete Loop-Quellen = " + nach3.starts + ", gestoppte = " + nach3.stops);
console.log("Erwartung bei korrekter Buchfuehrung (N1-Muster angewendet): 1, 2, 3.");
const loopOk = nach1.starts === 1 && nach2.starts === 2 && nach3.starts === 3;
console.log(loopOk ? "PUBLIKUMS-LOOP: BESTANDEN" : "PUBLIKUMS-LOOP: FEHLGESCHLAGEN");

// TEIL C: das dritte Rennen laeuft noch (nach dem #reset+#play oben) — jetzt lange genug
// zusehen, dass ein echtes Rennen durchlaeuft (14 Fallen je Laeufer, 6 Laeufer je Seite,
// dabei Stuerze und Ziel-Einlaeufe) und dabei tatsaechlich sfx() ueber die drei neu
// verdrahteten Stellen ausloest.
await seite.evaluate(() => { window.__oscLog.length = 0; });
await seite.click("#spd"); await seite.click("#spd"); // sicherstellen: 4x
await seite.waitForTimeout(45000);
const log = await seite.evaluate(() => window.__oscLog.slice());

const nahe = (f, ziel, tol) => Math.abs(f - ziel) <= tol;
const falleTreffer = log.filter(e => e.type === "sine" && nahe(e.freq, 180, 3)).length;
const sturzTreffer = log.filter(e => e.type === "sine" && nahe(e.freq, 260, 3)).length;
const torTreffer = log.filter(e => e.type === "square" && nahe(e.freq, 300, 4)).length;

console.log("\nEin-Schuss-Ereignisse waehrend eines echten 4x-Rennens (45 s Wallclock):");
console.log("  falle (Sinus ~180 Hz):  " + falleTreffer + " Treffer");
console.log("  sturz (Sinus ~260 Hz):  " + sturzTreffer + " Treffer");
console.log("  tor   (Rechteck ~300 Hz, paarweise): " + torTreffer + " Oszillatoren");
console.log("  (alle Oszillator-Events im Fenster, zur Kontrolle: " + log.length + ")");

const sfxOk = falleTreffer > 0 && sturzTreffer > 0 && torTreffer > 0;
console.log(sfxOk ? "SFX-VERDRAHTUNG: BESTANDEN (alle drei Ereignisse feuerten waehrend echten Gameplays)"
                  : "SFX-VERDRAHTUNG: FEHLGESCHLAGEN (mindestens ein Ereignis blieb stumm)");

console.log("\nSeitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));

const ok = loopOk && sfxOk && fehler.length === 0;
console.log(ok ? "\nGESAMT: BESTANDEN" : "\nGESAMT: FEHLGESCHLAGEN");
await browser.close();
process.exit(ok ? 0 : 1);
