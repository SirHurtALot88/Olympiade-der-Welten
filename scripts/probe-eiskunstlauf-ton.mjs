// Eiskunstlauf-Ton-Beweis (Welle 1, Opus-Plan 09-10 Abschnitt 4.4, A4 0->20, 12.09.) —
// analog zu PR #876s N1-Beweis-Sonde (scripts/probe-n1-gewichtheben.mjs) und PR #883s
// Takeshi-Pendant (scripts/probe-takeshi-ton.mjs), aber mit dem Pflichtteil, den #883 NICHT
// gefahren hatte (Opus-Plan Abschnitt 6, "Ton-Leck-Test"):
//
//   (a) N1-LOOP-RESET: der Publikums-Loop (eiskunstlaufPublikumAn) startet bei Spielbeginn
//       UND kehrt nach jedem reset() (= naechster Kampf) wieder zurueck — ueber VIER
//       aufeinanderfolgende Kaempfe (Plan: "Starts muessen 1/2/3/4 zaehlen, nicht 1/1/1/1").
//       Das ist genau die Falle, die PR #883 bei Takeshi teuer bezahlt hat: die Flagge muss
//       in reset() zurueckgesetzt werden, sonst schweigt das Publikum ab dem zweiten Kampf
//       fuer immer.
//   (b) TON-LECK-TEST: in JEDER der acht Geschwister-Buehnen-Disziplinen (alles, was
//       BUEHNE_ART nutzt, ausser Eiskunstlauf selbst) wird gemessen, ob sfx("eiskunstlauf",
//       ...) versehentlich ausgeloest wird. Erwartung: exakt 0 — der Kern des Risikos, weil
//       stepKuer()/bodenEis() zwar exklusiv auf art.duett gegated sind, aber Buehne EIN
//       geteilter Dispatcher ist (buehnenBewegung()/zeichneBuehne()), an dem schon einmal
//       (PR #883-Review) eine falsch gesetzte Bedingung eine andere Disziplin mitreissen
//       konnte.
//   (c) SFX-VERDRAHTUNG: waehrend eines echten Kuer-Laufs feuern kufe/sprung/landung/sturz
//       tatsaechlich (nicht nur wenn sfxProbe() sie von aussen direkt aufruft).
//
// METHODE fuer (b)/(c): AudioContext-Instrumentierung wie bei den Vorgaenger-Sonden, aber um
// zwei Sensoren erweitert:
//   - Oszillator-RAMPE (exponentialRampToValueAtTime) zusaetzlich zum Startwert
//     (setValueAtTime) mitgeschnitten -> jeder Sinuston ist als (f0,f1)-Paar bekannt, nicht
//     nur an seiner Startfrequenz. Das ist noetig, weil TON_KATALOG.eiskunstlauf.sprung
//     (tonSchlag(vol,320,900,...)) der EINZIGE STEIGENDE Sinuston im GESAMTEN Katalog ist —
//     jeder andere tonSchlag()-Aufruf im ganzen Motor faellt (f0>f1). Ein steigender Sinus
//     ist damit ein wasserdichtes, kollisionsfreies Signal fuer genau dieses Ereignis, egal
//     welche andere Disziplin gerade laeuft.
//   - BiquadFilterNode.connect() abgefangen: tonKlick()/tonRauschen() setzen ihre
//     Filterfrequenz synchron VOR dem connect()-Aufruf (filt.frequency.value=...;
//     ...; filt.connect(gain)), deshalb liest der Patch beim connect() bereits den
//     richtigen Wert. Das faengt kufe (highpass 3200), landungs Klick-Anteil (highpass
//     2600), sturz' Rauschen-Anteil (bandpass 700) und den Publikums-Loop (bandpass 450).
//     Naechste Nachbarn in den Geschwister-Katalogen liegen jeweils >=190 Hz entfernt (s.
//     Kommentar unten je Signatur) — eine Toleranz von +-20 Hz ist kollisionsfrei.
//
// Aufruf: node scripts/probe-eiskunstlauf-ton.mjs (kein Argument)
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
  window.__oscLog = []; // {wave, f0, f1|null} je oscillator.start()
  window.__filterLog = []; // {ftype, freq} je BiquadFilterNode.connect()

  const origSVAT = AudioParam.prototype.setValueAtTime;
  AudioParam.prototype.setValueAtTime = function (value, time) {
    this.__letzterWert = value;
    return origSVAT.call(this, value, time);
  };
  const origERTVA = AudioParam.prototype.exponentialRampToValueAtTime;
  AudioParam.prototype.exponentialRampToValueAtTime = function (value, time) {
    this.__letztesZiel = value;
    return origERTVA.call(this, value, time);
  };

  const origOsc = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function (...args) {
    const osc = origOsc.apply(this, args);
    const origStart = osc.start.bind(osc);
    osc.start = (...a) => {
      const f0 = osc.frequency.__letzterWert ?? osc.frequency.value;
      const f1 = osc.frequency.__letztesZiel;
      window.__oscLog.push({
        wave: osc.type,
        f0: Math.round(f0),
        f1: f1 != null ? Math.round(f1) : null,
      });
      return origStart(...a);
    };
    return osc;
  };

  // WICHTIG: haengt sich an die Zielseite (dest instanceof BiquadFilterNode), nicht an den
  // Filter selbst — sonst verwechselt die Sonde tonMetall() (zwei QUADRAT-Oszillatoren durch
  // ein Bandpass-Filter, s. TON_KATALOG-Baustein 3/5) mit tonRauschen() (ein RAUSCH-Buffer
  // durch ein Bandpass-Filter, Baustein 4/5) — beide sind vom Filtertyp/Frequenz allein nicht
  // zu unterscheiden, wenn zufaellig dieselbe Frequenz gewaehlt wurde (genau das passierte:
  // speed-schachs "schlag" nutzt tonMetall(...,700,...), kollidierte mit sturz' tonRauschen
  // (...,700,...) im ersten Fassungsversuch dieser Sonde). `quelle` haelt fest, ob ein
  // Oszillator oder ein Buffer-Rauschen in den Filter gespeist wird.
  const origConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (typeof BiquadFilterNode !== "undefined" && dest instanceof BiquadFilterNode) {
      const quelle =
        (typeof OscillatorNode !== "undefined" && this instanceof OscillatorNode) ? "osc" :
        (typeof AudioBufferSourceNode !== "undefined" && this instanceof AudioBufferSourceNode) ? "buf" :
        "andere";
      window.__filterLog.push({ ftype: dest.type, freq: Math.round(dest.frequency.value), quelle });
    }
    return origConnect.call(this, dest, ...rest);
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

// ---------------------------------------------------------------------------------------
// TEIL A: Katalog-Eintraege bestaetigen (sfxProbe/tonLoopProbe, rufen sfx() direkt auf,
// kein Fehler erwartet) — die Grundlage, auf der die Verdrahtung unten aufbaut. Diese fuenf
// standen laut Opus-Plan schon seit PR 0.1 vollstaendig da; hier nur zur Kontrolle.
const katalog = await seite.evaluate(() => ({
  kufe: window.__arena.sfxProbe("eiskunstlauf", "kufe"),
  sprung: window.__arena.sfxProbe("eiskunstlauf", "sprung"),
  landung: window.__arena.sfxProbe("eiskunstlauf", "landung"),
  sturz: window.__arena.sfxProbe("eiskunstlauf", "sturz"),
  publikum: window.__arena.tonLoopProbe("eiskunstlauf"),
}));
console.log("TEIL A — Katalog-Eintraege (sfxProbe/tonLoopProbe, kein Fehler erwartet):");
console.log(
  "  kufe=" + JSON.stringify(katalog.kufe) +
  " sprung=" + JSON.stringify(katalog.sprung) +
  " landung=" + JSON.stringify(katalog.landung) +
  " sturz=" + JSON.stringify(katalog.sturz) +
  " publikum=" + JSON.stringify(katalog.publikum)
);
const katalogOk = [katalog.kufe, katalog.sprung, katalog.landung, katalog.sturz, katalog.publikum]
  .every((r) => r.ok === true);
console.log(katalogOk ? "TEIL A: BESTANDEN\n" : "TEIL A: FEHLGESCHLAGEN\n");
// tonLoopProbe() oben hat selbst einen Start+Stop erzeugt (Diagnose-Aufruf) -- Zaehler vor
// Teil B auf 0 zuruecksetzen, sonst waere die Basis fuer den Loop-Beweis unten verfaelscht.
await seite.evaluate(() => { window.__loopStarts = 0; window.__loopStops = 0; });

// ---------------------------------------------------------------------------------------
// TEIL B: Publikums-Loop ueber VIER aufeinanderfolgende Eiskunstlauf-"Kaempfe" (Kampf 1:
// setDisc, Kaempfe 2-4: #reset ohne Disziplinwechsel — derselbe Codepfad wie "noch eine
// Kuer"). Das ist die N1-Gegenprobe aus dem Plan: Starts MUESSEN 1/2/3/4 zaehlen.
const gesetzt = await seite.evaluate((d) => {
  try { window.__arena.setDisc(d); return true; } catch (e) { return String(e); }
}, "eiskunstlauf");
if (gesetzt !== true) {
  console.error("setDisc fehlgeschlagen: " + gesetzt);
  await browser.close();
  process.exit(1);
}
const naechsterKampf = async () => {
  await seite.click("#play");
  await seite.click("#spd"); await seite.click("#spd"); // Tempo auf 4x
  await seite.waitForTimeout(1500);
  return seite.evaluate(() => ({ starts: window.__loopStarts, stops: window.__loopStops }));
};
const nach1 = await naechsterKampf();
await seite.click("#reset");
const nach2 = await naechsterKampf();
await seite.click("#reset");
const nach3 = await naechsterKampf();
await seite.click("#reset");
const nach4 = await naechsterKampf();

console.log("TEIL B — Publikums-Loop (eiskunstlaufPublikumAn) ueber vier Kaempfe:");
console.log("Nach Kampf 1 (setDisc):      gestartete Loop-Quellen = " + nach1.starts + ", gestoppte = " + nach1.stops);
console.log("Nach Kampf 2 (#reset+#play): gestartete Loop-Quellen = " + nach2.starts + ", gestoppte = " + nach2.stops);
console.log("Nach Kampf 3 (#reset+#play): gestartete Loop-Quellen = " + nach3.starts + ", gestoppte = " + nach3.stops);
console.log("Nach Kampf 4 (#reset+#play): gestartete Loop-Quellen = " + nach4.starts + ", gestoppte = " + nach4.stops);
console.log("Erwartung bei korrekter Buchfuehrung (N1-Muster angewendet): 1, 2, 3, 4.");
const loopOk = nach1.starts === 1 && nach2.starts === 2 && nach3.starts === 3 && nach4.starts === 4;
console.log(loopOk ? "TEIL B: BESTANDEN\n" : "TEIL B: FEHLGESCHLAGEN\n");

// ---------------------------------------------------------------------------------------
// TEIL C: EIN FRISCHER fuenfter Kampf (kufe feuert nur EINMAL je Laeufer, ganz am Anfang
// der Kuer, s. Kommentar bei stepKuer() — mitten im laufenden vierten Kampf einzusteigen,
// wie eine fruehere Fassung dieser Sonde es tat, verpasst dieses Fenster systematisch und
// meldet dann faelschlich 0 Treffer). Log-Reset UNMITTELBAR vor #play, damit der
// einlauf->gleiten-Uebergang jedes Laeufers ab t=0 mitgeschnitten wird.
// KEIN erneuter #spd-Klick hier: `speed` ist ein reset()-unabhaengiger Modul-Zustand, der
// von Kampf 1-4 oben schon auf ein hohes Tempo gebracht wurde (#spd zyklisiert
// 1->2->4->1..., ein Klick mehr wuerde ihn ohne Not wieder verstellen).
await seite.click("#reset");
await seite.evaluate(() => { window.__oscLog.length = 0; window.__filterLog.length = 0; });
await seite.click("#play");
await seite.waitForTimeout(15000);
const log1 = await seite.evaluate(() => window.__oscLog.slice());
const filt1 = await seite.evaluate(() => window.__filterLog.slice());

const nahe = (f, ziel, tol) => Math.abs(f - ziel) <= tol;
// sprung: EINZIGER steigender Sinus im gesamten Katalog (f1>f0), s. Kommentar am Kopf.
const sprungTreffer = log1.filter((e) => e.wave === "sine" && e.f1 != null && e.f1 > e.f0).length;
// kufe: tonKlick(vol,3200,...) -> highpass 3200. Naechster Nachbar: fechten klingen 3000
// (Abstand 200), speed-schach uhr 3400 (Abstand 200).
const kufeTreffer = filt1.filter((e) => e.quelle === "buf" && e.ftype === "highpass" && nahe(e.freq, 3200, 20)).length;
// landung (Klick-Anteil): tonKlick(vol*0.8,2600,...) -> highpass 2600. Naechster Nachbar:
// breaking freeze 2400 (Abstand 200).
const landungTreffer = filt1.filter((e) => e.quelle === "buf" && e.ftype === "highpass" && nahe(e.freq, 2600, 20)).length;
// sturz (Rauschen-Anteil): tonRauschen(vol*0.5,700,...) -> bandpass 700. Naechster Nachbar:
// gewichtheben scheiben_fall 280 (Abstand 420), breaking powermove 1600 (Abstand 900).
const sturzTreffer = filt1.filter((e) => e.quelle === "buf" && e.ftype === "bandpass" && nahe(e.freq, 700, 20)).length;

console.log("TEIL C — Ein-Schuss-Ereignisse waehrend eines echten 4x-Kuer-Laufs (15 s Wallclock):");
console.log("  sprung  (einziger steigender Sinus im Katalog): " + sprungTreffer + " Treffer");
console.log("  kufe    (highpass ~3200 Hz):  " + kufeTreffer + " Treffer");
console.log("  landung (highpass ~2600 Hz):  " + landungTreffer + " Treffer");
console.log("  sturz   (bandpass ~700 Hz):   " + sturzTreffer + " Treffer");
const sfxOk = sprungTreffer > 0 && kufeTreffer > 0;
// landung/sturz sind seltener (landung nur bei sauberem Element, sturz nur bei Fehlschlag —
// je nach Zufall der Runde kann ein 15s-Fenster den einen oder anderen verpassen). kufe
// (einmal je Kuer, am Anfang) und sprung (bei JEDEM Element) sind haeufig genug, dass ihr
// Ausbleiben auf einen echten Verdrahtungsfehler hindeuten wuerde.
console.log(sfxOk ? "TEIL C (Kern: sprung/kufe): BESTANDEN" : "TEIL C (Kern: sprung/kufe): FEHLGESCHLAGEN");
console.log((landungTreffer > 0 || sturzTreffer > 0)
  ? "TEIL C (landung/sturz): mindestens eines von beiden beobachtet"
  : "TEIL C (landung/sturz): keines im Fenster beobachtet (selten, kein Fehlschlag fuer sich allein)");
console.log("");

// ---------------------------------------------------------------------------------------
// TEIL D: TON-LECK-TEST (Opus-Plan Abschnitt 6, der Pflichtteil, den PR #883 NICHT gefahren
// hatte). In JEDER Geschwister-Buehnen-Disziplin (alles, was BUEHNE_ART nutzt, ausser
// Eiskunstlauf selbst) darf sfx("eiskunstlauf", ...) NIE feuern. Gemessen ueber dieselben
// vier Signaturen wie Teil C, je Disziplin ein eigenes Zeitfenster.
const GESCHWISTER = ["gewichtheben", "breaking", "speed-schach", "fechten", "tennis", "wettessen", "showcase", "i-spy"];
const leckErgebnisse = [];
for (const d of GESCHWISTER) {
  const gesetztD = await seite.evaluate((disc) => {
    try { window.__arena.setDisc(disc); return true; } catch (e) { return String(e); }
  }, d);
  if (gesetztD !== true) {
    console.error("setDisc(" + d + ") fehlgeschlagen: " + gesetztD);
    leckErgebnisse.push({ d, fehler: true });
    continue;
  }
  await seite.evaluate(() => { window.__oscLog.length = 0; window.__filterLog.length = 0; });
  await seite.click("#play");
  await seite.click("#spd"); await seite.click("#spd"); // 4x, frisch je Disziplin gesetzt
  await seite.waitForTimeout(11000);
  const log = await seite.evaluate(() => window.__oscLog.slice());
  const filt = await seite.evaluate(() => window.__filterLog.slice());
  const sprung = log.filter((e) => e.wave === "sine" && e.f1 != null && e.f1 > e.f0).length;
  const kufe = filt.filter((e) => e.quelle === "buf" && e.ftype === "highpass" && nahe(e.freq, 3200, 20)).length;
  const landung = filt.filter((e) => e.quelle === "buf" && e.ftype === "highpass" && nahe(e.freq, 2600, 20)).length;
  const sturz = filt.filter((e) => e.quelle === "buf" && e.ftype === "bandpass" && nahe(e.freq, 700, 20)).length;
  const publikum = filt.filter((e) => e.quelle === "buf" && e.ftype === "bandpass" && nahe(e.freq, 450, 15)).length;
  const summe = sprung + kufe + landung + sturz + publikum;
  leckErgebnisse.push({ d, sprung, kufe, landung, sturz, publikum, summe });
  await seite.click("#reset");
}

console.log("TEIL D — Ton-Leck-Test (acht Geschwister-Buehnen-Disziplinen, je 11 s bei 4x):");
console.log("Disziplin            sprung  kufe  landung  sturz  publikum  Summe");
let leckSumme = 0;
for (const r of leckErgebnisse) {
  if (r.fehler) { console.log(r.d.padEnd(20) + "  setDisc fehlgeschlagen"); leckSumme += 1; continue; }
  console.log(
    r.d.padEnd(20) +
    String(r.sprung).padStart(6) + "  " +
    String(r.kufe).padStart(4) + "  " +
    String(r.landung).padStart(7) + "  " +
    String(r.sturz).padStart(5) + "  " +
    String(r.publikum).padStart(8) + "  " +
    String(r.summe).padStart(5)
  );
  leckSumme += r.summe;
}
console.log("Gesamtsumme ueber alle acht Geschwister-Disziplinen: " + leckSumme + " (Erwartung: 0)");
const leckOk = leckSumme === 0;
console.log(leckOk ? "TEIL D: BESTANDEN (kein Ton-Leck)\n" : "TEIL D: FEHLGESCHLAGEN (Ton-Leck gefunden)\n");

console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));

const ok = katalogOk && loopOk && sfxOk && leckOk && fehler.length === 0;
console.log(ok ? "\nGESAMT: BESTANDEN" : "\nGESAMT: FEHLGESCHLAGEN");
await browser.close();
process.exit(ok ? 0 : 1);
