// HYROX-ARENA: ZEICHENTEMPO JE ABSCHNITT (Pixel je Sim-Sekunde), 17.11.
//
// Der Fahrplan (HYROX_ZEITWEG) legt je Abschnitt fest, WIE LANGE ein Laeufer darin ist; die Arena-Geometrie
// legt fest, WIE WEIT er dabei zeichnet. Passen beide nicht zusammen, rast die Figur durch einen Abschnitt und
// kriecht durch den naechsten. Dieses Skript gibt je Abschnitt den Median ueber alle zwoelf Laeufer aus
// (Weglaenge / Abschnittsdauer), das Verhaeltnis zur Rundengeschwindigkeit (Lauf-Abschnitte 1-3) und eine
// Zusammenfassung je Art+Gruppe. Reine Messung: liest nur hyroxFahrplanProbe()/hyroxArenaProbe().
//
// Aufruf: node scripts/miss-hyrox-tempo.mjs [--json]
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public", "mockups", "battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const alsJson = process.argv.slice(2).includes("--json");
const median = (a) => {
  const b = [...a].sort((x, y) => x - y);
  const m = b.length >> 1;
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
};

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
try {
  const seite = await browser.newPage();
  await seite.goto(SEITE);
  await seite.waitForFunction(() => window.__arena && window.__arena.hyroxArenaProbe, null, { timeout: 60000 });
  await seite.evaluate(() => {
    const A = window.__arena;
    A.bahnFlags({ spurtFormat: "hyrox" });
    A.setDisc("spurt");
  });
  const { fahrplan, arena } = await seite.evaluate(() => ({
    fahrplan: window.__arena.hyroxFahrplanProbe(),
    arena: window.__arena.hyroxArenaProbe(),
  }));
  const A = fahrplan.abschnitte;
  const laeufer = fahrplan.laeufer.filter((l) => l.t0);
  const dauer = (l, j) => l.t0[j + 1] - l.t0[j];
  const zeilen = A.map((a, j) => ({
    j: j + 1, art: a.art, gruppe: a.gruppe, station: a.station, laenge: arena.segLaenge[j],
    tempo: median(laeufer.map((l) => arena.segLaenge[j] / dauer(l, j))),
  }));
  // Rundengeschwindigkeit: die drei vollen Laufrunden (Abschnitte 1, 11, 19), Median ueber die Laeufer.
  const runden = [0, 10, 18];
  const rundeV = median(laeufer.map((l) =>
    runden.reduce((s, j) => s + arena.segLaenge[j], 0) / runden.reduce((s, j) => s + dauer(l, j), 0)));
  const gruppen = {};
  A.forEach((a, j) => { (gruppen[a.art + ":" + (a.gruppe || "-")] ||= []).push(j); });
  const gz = Object.entries(gruppen).map(([k, js]) => ({
    gruppe: k,
    tempo: median(laeufer.map((l) =>
      js.reduce((s, j) => s + arena.segLaenge[j], 0) / js.reduce((s, j) => s + dauer(l, j), 0))),
  }));
  if (alsJson) {
    console.log(JSON.stringify({ rundeV, zeilen, gz }, null, 1));
  } else {
    console.log(`Rundengeschwindigkeit (Lauf-Abschnitte 1/11/19): ${rundeV.toFixed(0)} px/s`);
    for (const z of zeilen) {
      const r = z.tempo / rundeV;
      const flagge = r > 2 ? "  <-- >2x" : r < 0.5 ? "  <-- <0,5x" : "";
      console.log(
        `${String(z.j).padStart(2)} ${z.art.padEnd(6)} ${(z.gruppe || "-").padEnd(7)} st${String(z.station).padStart(2)}  ` +
          `${z.laenge.toFixed(0).padStart(5)} px  ${z.tempo.toFixed(0).padStart(5)} px/s  x${r.toFixed(2)}${flagge}`,
      );
    }
    console.log("Je Art+Gruppe (Summe Weg / Summe Zeit, Median):");
    for (const g of gz) console.log(`  ${g.gruppe.padEnd(14)} ${g.tempo.toFixed(0).padStart(5)} px/s  x${(g.tempo / rundeV).toFixed(2)}`);
  }
} finally {
  await browser.close();
}
