import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";
const WURZEL = process.argv[2];
const N = Number(process.argv[3] || 40);
const SEITE = pathToFileURL(path.join(WURZEL, "public", "mockups", "battle-mode.html")).href;
const browser = await chromium.launch({});
try {
  const seite = await browser.newPage();
  await seite.addInitScript(() => { window.AudioContext = undefined; });
  await seite.goto(SEITE);
  await seite.waitForFunction(() => window.__arena && window.__arena.tdmBewegungsProbe, null, { timeout: 60000 });
  const r = await seite.evaluate((N) => {
    const A = window.__arena, aus = { vorher: [], nachher: [] };
    for (const [k, an] of [["vorher", false], ["nachher", true]]) {
      A.tdmBewegung(an);
      for (let s = 1; s <= N; s++) aus[k].push(A.tdmBewegungsProbe(s * 7919));
    }
    A.tdmBewegung(true);
    return aus;
  }, N);
  const zus = (l) => {
    const m = (f) => +(l.reduce((a, x) => a + x[f], 0) / l.length).toFixed(3);
    return { spiele: l.length, getrenntAnteil: m("getrenntAnteil"), kontaktAnteil: m("kontaktAnteil"),
      laengsteGetrenntUhr_mittel: m("laengsteGetrenntUhr"), laengsteGetrenntUhr_max: Math.max(...l.map((x) => x.laengsteGetrenntUhr)),
      spieleMitStillstandUeber10sUhr: l.filter((x) => x.laengsteGetrenntUhr > 10).length,
      spieleMitStillstandUeber3sUhr: l.filter((x) => x.laengsteGetrenntUhr > 3).length,
      dauerUhr_mittel: m("dauerUhr"), wegJeFigur: m("wegJeFigur"), ySpanne: m("ySpanneMittel"), schlagDistanz: m("schlagDistanzMittel"),
      schlaegeInReichweite: m("schlaegeInReichweite") };
  };
  const gleich = r.vorher.every((v, i) => JSON.stringify(v.wert) === JSON.stringify(r.nachher[i].wert));
  console.log(JSON.stringify({ W: r.vorher[0].W, H: r.vorher[0].H, startX: r.vorher[0].startX, vorher: zus(r.vorher), nachher: zus(r.nachher), wertGleich: gleich }, null, 1));
  console.log("Beispiel vorher:", JSON.stringify({ ...r.vorher[0], wert: undefined }));
  console.log("Beispiel nachher:", JSON.stringify({ ...r.nachher[0], wert: undefined }));
} finally { await browser.close(); }
