// ===================================================================================
// ZEITFAHREN-ANZEIGE-PROBE (Chris' Fundliste 13.09.) — misst die vier Groessen, an denen
// seine Meldung haengt, statt sie zu vermuten. Analog zu scripts/probe-staffel-ton.mjs
// und scripts/probe-takeshi-ton.mjs: ein echtes Rennen im Browser, von aussen
// mitgelesen ueber window.__arena.zeitfahrenVizProbe() (rein diagnostisch, s. dort).
//
// Chris' Meldung, woertlich (die Punkte, die dieses Skript misst):
//   "es wird sich nur mit gleichbleibender geschwindikeit bewegt also gewinnt der der am
//    anfang vorne ist auch auf jeden fall"
//   "lauf animationen! momentan schweben alle."
//   "oben die punkte zb 56:22 sagen gar nichts aus. Man kann es nicht nachvollziehen!"
//   "Die Diszi ist nach 1:26 schon vorbei und dann steht es plötzlich 38:40 das darf
//    nicht passieren! und dort sieht man tidesprinter als schnellsten mit anbstand,
//    vorhin beim laufen war er optisch aber nur 4. oder so ... und auch hier hat er bei
//    ner diszi die 1:26 dauert nur 8,1 sekunden gebraucht."
//
// GEPRUEFT WERDEN VIER DINGE:
//
//   (A) ANIMATIONSUHR. `aniT` ist die globale Sprite-Animationsuhr `t`. Der Bildindex in
//       zeichneSprite() ist `(t*7+u.id)%n` — steht `t` still, ist jede Figur ein
//       STEHENDES Einzelbild, das ueber die Bahn gleitet ("alle schweben"). Erwartung
//       NACH der Reparatur: nicht mehr relevant fuer Time-Trial, weil der Schritt dort
//       aus `u.vizSchritt` kommt (stepZeitfahren) — deshalb misst dieses Skript
//       zusaetzlich, dass `vizSchritt` ueberhaupt waechst und mit dem Tempo skaliert.
//
//   (B) VORLAEUFIGER STAND gegen ENDSTAND. Bei gestaffeltem Start sortierte
//       bahnRangliste() die noch Laufenden nach roher Strecke — also nach Startfolge.
//       Erwartung VOR der Reparatur: der Stand steht ueber fast das ganze Rennen auf dem
//       rechnerisch groesstmoeglichen Vorsprung (bei zwoelf Laeufern 57:21) und kippt
//       erst am Ziel. Erwartung NACH: er bewegt sich ueber das Rennen und trifft den
//       Endstand ohne Sprung.
//
//   (C) BILD gegen RANGLISTE. Die auf dem Schirm sichtbare Reihenfolge (nach `pos`) gegen
//       die Rangliste. Erwartung VOR: der spaetere Sieger taucht im Bild nie vorn auf.
//
//   (D) ANGEZEIGTE ZEIT gegen UHR. Die Siegerzeit gegen die Uhr, die beim Zusehen lief.
//       Erwartung VOR: Faktor ZEIT_DEHNUNG["time-trial"]=4,38 auseinander (Uhr 1:26,
//       Siegerzeit "8,1 s"). Erwartung NACH: dieselbe Groessenordnung.
//
// Aufruf:  node scripts/probe-zeitfahren-anzeige.mjs [sekunden]
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MAX_S = Number(process.argv[2] || 240);

const browser = await chromium.launch({ ...(existsSync(fest) ? { executablePath: fest } : {}) });
const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));

// `domcontentloaded` statt `networkidle`: die Mockup-Seite laedt einige hundert
// Sprite-Blaetter, von denen ein Teil in einem frischen Worktree fehlt (404) — auf
// `networkidle` zu warten ist dort ein Gluecksspiel. Der Waechter darunter wartet ohnehin
// gezielt auf die Engine-Bruecke, das ist die schaerfere Bedingung.
await seite.goto(SEITE, { waitUntil: "domcontentloaded" });
await seite.waitForFunction(() => window.__arena && window.__arena.zeitfahrenVizProbe, null, { timeout: 90000 });
await seite.click("#t2");
await seite.evaluate(() => window.__arena.setDisc("time-trial"));
await seite.click("#play");

const proben = [];
const start = Date.now();
for (let i = 0; i < MAX_S; i++) {
  await seite.waitForTimeout(1000);
  const p = await seite.evaluate(() => ({
    d: window.__arena.zeitfahrenVizProbe(),
    score: document.getElementById("score")?.textContent,
    clock: document.getElementById("clock")?.textContent,
    phase: document.getElementById("phase")?.textContent,
  }));
  p.real = (Date.now() - start) / 1000;
  proben.push(p);
  if (p.phase === "beendet") break;
}
const letzte = proben[proben.length - 1];
const kurz = (s) => String(s).slice(0, 11);

console.log("ZEITFAHREN-ANZEIGE-PROBE — " + proben.length + " Messpunkte, Uhr am Ende: " + letzte.clock);
console.log("ZEIT_DEHNUNG['time-trial'] = " + letzte.d.zeitFaktor + "\n");

// ---- (A) ANIMATION -------------------------------------------------------------
const aniTs = [...new Set(proben.map((p) => p.d.aniT))];
const schritte = proben.map((p) => p.d.reihe.map((u) => u.vizSchritt ?? null));
const schrittWaechst = schritte.length > 2 && schritte[schritte.length - 1].some(
  (v, i) => v != null && schritte[1][i] != null && v > schritte[1][i] + 0.5);
console.log("(A) ANIMATION");
console.log("    globale Uhr t:           " + (aniTs.length === 1
  ? "STEHT STILL bei " + aniTs[0] + "  <- Sprite-Laufzyklus eingefroren"
  : "laeuft (" + aniTs.length + " verschiedene Werte)"));
console.log("    eigene Schrittphase:     " + (schrittWaechst
  ? "waechst (stepZeitfahren liefert vizSchritt)"
  : "waechst NICHT / nicht vorhanden"));

// ---- (B) VORLAEUFIGER STAND ----------------------------------------------------
const staende = proben.map((p) => p.score);
const ersterStand = staende[0], endStand = staende[staende.length - 1];
const wechsel = staende.filter((s, i) => i > 0 && s !== staende[i - 1]).length;
const anteilErster = staende.filter((s) => s === ersterStand).length / staende.length;
console.log("\n(B) VORLAEUFIGER STAND");
console.log("    erster Stand:            " + ersterStand + "  (bei rennT=" + proben[0].d.rennT + " s)");
console.log("    Endstand:                " + endStand);
console.log("    Stand-Wechsel im Rennen: " + wechsel);
console.log("    Anteil auf dem 1. Wert:  " + Math.round(anteilErster * 100) + " %"
  + (anteilErster > 0.3 ? "  <- steht zu lange still, zeigt die Startfolge statt des Rennens" : ""));

// ---- (C) BILD GEGEN RANGLISTE --------------------------------------------------
const sieger = [...letzte.d.reihe].sort((a, b) => (a.platz || 99) - (b.platz || 99))[0];
const jeImBildVorn = proben.filter((p) => {
  const bild = [...p.d.reihe].sort((a, b) => b.pos - a.pos).slice(0, 3).map((u) => u.n);
  return bild.includes(sieger.n);
}).length;
console.log("\n(C) BILD GEGEN RANGLISTE");
console.log("    Sieger:                  " + sieger.n + " (Startzeit " + sieger.startT + " s)");
console.log("    davon in den Bild-Top-3: " + jeImBildVorn + " von " + proben.length + " Messpunkten"
  + (jeImBildVorn === 0 ? "  <- er war NIE sichtbar vorn" : ""));

// ---- (D) ZEIT GEGEN UHR --------------------------------------------------------
console.log("\n(D) ZEIT GEGEN UHR");
console.log("    Uhr beim Zusehen:        " + letzte.clock);
console.log("    Siegerzeit (Simulation): " + sieger.eigenzeit + " s");
console.log("    Siegerzeit (Zuschauzeit): " + (sieger.eigenzeit * letzte.d.zeitFaktor).toFixed(1) + " s"
  + "   <- das ist es, was seit Chris' Fund 13.09. angezeigt wird");

console.log("\nENDSTAND (Rang, Startzeit, eigene Zeit in Simulationssekunden, Restreserve):");
for (const u of [...letzte.d.reihe].sort((a, b) => a.platz - b.platz)) {
  console.log("  P" + String(u.platz).padStart(2) + "  " + kurz(u.n).padEnd(12)
    + " Seite " + u.seite + "  start " + String(u.startT).padStart(4) + " s"
    + "  Zeit " + String(u.eigenzeit).padStart(6) + " s"
    + "  Reserve " + String(u.reserve).padStart(3) + " %" + (u.leer ? "  LEER" : ""));
}
console.log("\nSeitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
await browser.close();
