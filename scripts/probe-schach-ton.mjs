// Speed-Schach-Ton-Beweis (Ziel 5, Opus-Plan 09-10 Abschnitt 5.1, A4 75->95) — analog zu
// PR #893s scripts/probe-hockey-ton.mjs und PR #883s scripts/probe-takeshi-ton.mjs, fuer
// die vier neu verdrahteten Speed-Schach-Aufrufstellen (zug/schlag/uhr/matt) UND fuer den
// vom Opus-Plan (Abschnitt 6) verlangten zusaetzlichen Geschwister-Leck-Test, den weder
// die Hockey- noch die Takeshi-Sonde bisher gebaut haben.
//
// TEIL A: sfxProbe()/tonLoopProbe() bestaetigen, dass die fuenf Katalogeintraege
// existieren (TON_KATALOG["speed-schach"], bereits gemergt) und sfx() dabei nie wirft.
// TEIL B: Publikums-Loop ueber VIER aufeinanderfolgende Speed-Schach-Spiele (Opus-Plan
// Abschnitt 6, "Loop-Reset-Gegenversuch") — Starts muessen 1/2/3/4 zeigen, nicht 1/1/1/1
// (derselbe N1-Fehler, den PR #879/#883 fuer Gewichtheben/Takeshi behoben haben).
// TEIL C: waehrend eines echten Speed-Schach-Spiels feuern zug/schlag/uhr/matt
// tatsaechlich (nicht nur wenn man sfx() von aussen direkt aufruft).
// TEIL D (Ton-Leck-Test, Opus-Plan Abschnitt 6): in den sieben Geschwister-Buehnen
// (Fechten, Wettessen, Showcase, Eiskunstlauf, Breaking, Tennis, I-Spy) darf WAEHREND
// eines echten Spiels dieser Disziplin KEIN speed-schach-Ereignis auftreten.
//
// METHODE fuer C/D: tonKlick() (zug/uhr/das Buffer-Teil von schlag) filtert Rauschen durch
// einen BiquadFilterNode, dessen .frequency.value die Zielfrequenz traegt — anders als bei
// Hockey/Takeshi (deren Ein-Schuss-Ereignisse alle ueber tonSchlag/tonMetall laufen, also
// reine Oszillatoren sind) reicht die bestehende "nur Oszillator-start() abfangen"-Sonde
// hier NICHT. Diese Sonde faengt zusaetzlich JEDEN Wert ab, der auf irgendeinen
// AudioParam.value gesetzt wird (Property-Setter UND setValueAtTime), egal ob Gain, Q,
// Oszillator- oder Filterfrequenz — Gain/Q-Werte liegen alle unter 6, Frequenzen im
// drei-/vierstelligen Bereich, es gibt also keine Verwechslungsgefahr mit den hier
// gesuchten Buckets. GEFUNDEN BEIM ERSTEN TESTLAUF DIESER SONDE (nicht nur theoretisch):
// Breakings eigener "beat"-Publikums-Loop (tonRauschen(vol,220,0,true)) setzt seine
// Bandpass-Filterfrequenz auf exakt 220 — dieselbe Zielfrequenz wie die EINE Haelfte von
// schach "matt" (tonMetall(vol,220,...)). Ein Einzel-Bucket-Treffer bei 220 waere deshalb
// KEIN Beweis fuer ein Leck. Loesung: tonMetall() setzt IMMER zwei leicht verstimmte
// Oszillatoren (×1 und ×1,0075, s. tonMetall()), tonRauschen() nie einen zweiten Wert in
// der Naehe — "matt" (und ebenso "schlag"s tonMetall-Anteil bei 700/705,25) zaehlt deshalb
// nur, wenn BEIDE Bucket-Haelften treffen, mit eng gefasster Toleranz (±0,5 statt ±3-4):
// eine weite Toleranz auf BEIDE Haelften ueberlappt sich selbst (220±3 und 221,65±3
// teilen den Bereich [218,65;223]) und liesse sich von EINEM einzigen Wert erfuellen —
// Breakings 220-Filterwert allein haette die Doppel-Pruefung sonst trotzdem bestanden
// (zweiter Fund dieser Sonde, nach dem ersten mit der Einzel-Bucket-Fassung). Beide
// Zielwerte sind exakte Multiplikationen (freq×1 / freq×1,0075), keine Messwerte — ±0,5
// laesst nur Fliesskomma-Rundung durch. Nach dieser Korrektur kollisionsfrei gegen ALLE
// elf Geschwister-Kataloge nachgelesen (TON_KATALOG in battle-mode.engine.js, Stand
// 12.09.): kein anderer Eintrag der sieben getesteten Disziplinen (Fechten/Eiskunstlauf/
// Breaking haben Katalogeintraege, Wettessen/Showcase/Tennis/I-Spy keinen einzigen) liegt
// innerhalb der Toleranz um 2200 (zug), 2000+700+705,25 (schlag), 3400 (uhr) oder
// 220+221,65 (matt).
//
// Aufruf: node scripts/probe-schach-ton.mjs (kein Argument)
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

await seite.addInitScript(() => {
  window.__loopStarts = 0;
  window.__loopStops = 0;
  window.__wertLog = []; // JEDER Wert, der auf irgendeinen AudioParam gesetzt wird

  const proto = AudioParam.prototype;
  const origSVAT = proto.setValueAtTime;
  proto.setValueAtTime = function (value, time) {
    window.__wertLog.push(value);
    return origSVAT.call(this, value, time);
  };
  const origRamp = proto.linearRampToValueAtTime;
  proto.linearRampToValueAtTime = function (value, time) {
    window.__wertLog.push(value);
    return origRamp.call(this, value, time);
  };
  const origExpRamp = proto.exponentialRampToValueAtTime;
  proto.exponentialRampToValueAtTime = function (value, time) {
    window.__wertLog.push(value);
    return origExpRamp.call(this, value, time);
  };
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  if (desc && desc.configurable) {
    Object.defineProperty(proto, "value", {
      get() { return desc.get.call(this); },
      set(v) { window.__wertLog.push(v); return desc.set.call(this, v); },
      configurable: true,
    });
  }

  const origBuf = AudioContext.prototype.createBufferSource;
  AudioContext.prototype.createBufferSource = function (...args) {
    const src = origBuf.apply(this, args);
    const origStart = src.start.bind(src);
    const origStop = src.stop.bind(src);
    src.start = (...a) => { if (src.loop) window.__loopStarts++; return origStart(...a); };
    src.stop = (...a) => { if (src.loop) window.__loopStops++; return origStop(...a); };
    return src;
  };
});

await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
await seite.click("#t2");

// TEIL A
const katalog = await seite.evaluate(() => ({
  zug: window.__arena.sfxProbe("speed-schach", "zug"),
  schlag: window.__arena.sfxProbe("speed-schach", "schlag"),
  uhr: window.__arena.sfxProbe("speed-schach", "uhr"),
  matt: window.__arena.sfxProbe("speed-schach", "matt"),
  publikum: window.__arena.tonLoopProbe("speed-schach"),
}));
console.log("TEIL A — Katalog-Eintraege (sfxProbe/tonLoopProbe, rufen sfx() direkt, kein Fehler erwartet):");
console.log("  " + JSON.stringify(katalog));
const katalogOk = Object.values(katalog).every((v) => v && v.ok !== false);
console.log(katalogOk ? "KATALOG: BESTANDEN" : "KATALOG: FEHLGESCHLAGEN");

await seite.evaluate(() => { window.__loopStarts = 0; window.__loopStops = 0; });

// TEIL B — VIER aufeinanderfolgende Speed-Schach-Spiele (Opus-Plan Abschnitt 6).
const gesetzt = await seite.evaluate((d) => {
  try { window.__arena.setDisc(d); return true; } catch (e) { return String(e); }
}, "speed-schach");
if (gesetzt !== true) {
  console.error("setDisc fehlgeschlagen: " + gesetzt);
  await browser.close();
  process.exit(1);
}
await seite.click("#play");
await seite.click("#spd"); await seite.click("#spd"); // 4x
await seite.waitForTimeout(1200);
const loopNach = [];
loopNach.push(await seite.evaluate(() => window.__loopStarts));
for (let i = 0; i < 3; i++) {
  await seite.click("#reset");
  await seite.click("#play");
  await seite.click("#spd"); await seite.click("#spd"); // Tempo-Flag sicherheitshalber neu setzen
  await seite.waitForTimeout(1200);
  loopNach.push(await seite.evaluate(() => window.__loopStarts));
}
console.log("\nTEIL B — Publikums-Loop (schachPublikumAn) ueber vier Spiele:");
console.log("  Starts nach Spiel 1/2/3/4: " + loopNach.join(" / ") + " (Erwartung: 1, 2, 3, 4)");
const loopOk = loopNach[0] === 1 && loopNach[1] === 2 && loopNach[2] === 3 && loopNach[3] === 4;
console.log(loopOk ? "LOOP-RESET-GEGENVERSUCH: BESTANDEN" : "LOOP-RESET-GEGENVERSUCH: FEHLGESCHLAGEN");

// TEIL C — waehrend des vierten (noch laufenden) Speed-Schach-Spiels: feuern zug/schlag/
// uhr/matt tatsaechlich?
await seite.evaluate(() => { window.__wertLog.length = 0; });
await seite.click("#spd"); await seite.click("#spd"); // sicherstellen: 4x
await seite.waitForTimeout(20000);
const logC = await seite.evaluate(() => window.__wertLog.slice());
const nahe = (log, ziel, tol) => log.filter((v) => Math.abs(v - ziel) <= tol).length;
// "matt" braucht BEIDE tonMetall-Quinten (220 UND 221,65 — die Verstimmung 1x/1,0075x, s.
// tonMetall()), nicht nur die eine: Breakings EIGENER "beat"-Loop
// (tonRauschen(vol,220,0,true)) setzt eine Bandpass-Filterfrequenz exakt auf 220 und wuerde
// sonst als falscher "matt"-Treffer durchgehen (gefunden beim ersten Testlauf dieser
// Sonde — kein echter Leck, sondern eine zu grobe Bucket-Wahl). ZWEITER FUND (zweiter
// Testlauf): eine TOLERANZ von ±3 auf BEIDE Buckets liess sich von EINEM EINZIGEN Wert
// erfuellen, weil 220±3=[217,223] und 221,65±3=[218,65;224,65] sich UEBERLAPPEN — Breakings
// einzelner 220-Wert lag damit selbst schon "nahe" an 221,65 und bestand die
// Doppel-Bucket-Pruefung trotzdem faelschlich. Toleranz auf ±0,5 verschaerft (Luecke
// zwischen den Fenstern [219,5;220,5] und [221,15;222,15] = 0,65) — die beiden
// Zielfrequenzen selbst sind exakte Multiplikationen (700×1/700×1,0075 bzw. 220×1/
// 220×1,0075), keine Messwerte, ±0,5 laesst nur Fliesskomma-Rundung durch, keine
// Verwechslung mit einer benachbarten, aber andersartigen Frequenz.
const zugC = nahe(logC, 2200, 4);
const schlagC = nahe(logC, 2000, 4) + Math.min(nahe(logC, 700, 0.5), nahe(logC, 705.25, 0.5));
const uhrC = nahe(logC, 3400, 4);
const mattC = Math.min(nahe(logC, 220, 0.5), nahe(logC, 221.65, 0.5));
console.log("\nTEIL C — Ein-Schuss-Ereignisse waehrend eines echten Speed-Schach-Spiels (20s@4x):");
console.log("  zug (~2200):    " + zugC + " Treffer");
console.log("  schlag (~2000/~700): " + schlagC + " Treffer");
console.log("  uhr (~3400):    " + uhrC + " Treffer");
console.log("  matt (~220):    " + mattC + " Treffer (matt ist selten — nicht jedes Duell endet eindeutig)");
const wiringOk = zugC > 0 && uhrC > 0; // zug/uhr feuern bei JEDEM Zug, matt/schlag sind seltener
console.log(wiringOk ? "SFX-VERDRAHTUNG (zug/uhr): BESTANDEN" : "SFX-VERDRAHTUNG (zug/uhr): FEHLGESCHLAGEN");

// TEIL D — TON-LECK-TEST: sieben Geschwister-Buehnen, 0 speed-schach-Ereignisse erwartet.
const GESCHWISTER = ["fechten", "wettessen", "showcase", "eiskunstlauf", "breaking", "tennis", "i-spy"];
const leckErgebnis = {};
for (const disc of GESCHWISTER) {
  const ok = await seite.evaluate((d) => {
    try { window.__arena.setDisc(d); return true; } catch (e) { return String(e); }
  }, disc);
  if (ok !== true) { leckErgebnis[disc] = { fehler: ok }; continue; }
  await seite.evaluate(() => { window.__wertLog.length = 0; });
  await seite.click("#play");
  await seite.click("#spd"); await seite.click("#spd"); // 4x
  await seite.waitForTimeout(8000);
  const log = await seite.evaluate(() => window.__wertLog.slice());
  // Dieselben verfeinerten Bucket-Regeln wie TEIL C (Doppel-Bucket fuer schlag/matt, s.
  // dortiger Kommentar) — nicht die grobe Einzel-Frequenz-Summe, die im ersten Testlauf
  // dieser Sonde Breakings eigenen "beat"-Loop (220 Hz Bandpass) faelschlich als
  // "matt"-Leck gemeldet hat.
  const treffer = nahe(log, 2200, 4)
    + nahe(log, 2000, 4) + Math.min(nahe(log, 700, 0.5), nahe(log, 705.25, 0.5))
    + nahe(log, 3400, 4)
    + Math.min(nahe(log, 220, 0.5), nahe(log, 221.65, 0.5));
  leckErgebnis[disc] = { treffer };
  await seite.click("#reset");
}
console.log("\nTEIL D — Ton-Leck-Test (sieben Geschwister-Buehnen, erwartet ueberall 0):");
let leckOk = true;
for (const disc of GESCHWISTER) {
  const r = leckErgebnis[disc];
  console.log("  " + disc.padEnd(14) + " " + (r.fehler ? ("setDisc-Fehler: " + r.fehler) : r.treffer + " Treffer"));
  if (r.fehler || r.treffer !== 0) leckOk = false;
}
console.log(leckOk ? "TON-LECK-TEST: BESTANDEN (0 speed-schach-Ereignisse in allen sieben Geschwistern)"
                   : "TON-LECK-TEST: FEHLGESCHLAGEN");

console.log("\nSeitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));

const ok = katalogOk && loopOk && wiringOk && leckOk && fehler.length === 0;
console.log(ok ? "\nGESAMT: BESTANDEN" : "\nGESAMT: FEHLGESCHLAGEN");
await browser.close();
process.exit(ok ? 0 : 1);
