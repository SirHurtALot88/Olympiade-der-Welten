// Visueller Beleg fuer die Trage-Pose des Sandsack-Finales (Weg C, Stufe 1, 05.10.,
// docs/design/gewichtheben-sandsack-trage-pose-05-10.md). Kein Teil der Abnahme-Sonden —
// nur zum Ansehen. Zwei Bilder:
//
//   1. GALERIE: je Figur eine Zeile, Spalten = Last-Stufe 1..6, dann Pause (Haende auf den
//      Knien), Buecken (Rutscher, nach dem Sack greifen) und leer (Rueckweg, normaler Gang).
//      Gezeichnet ueber window.__arena.sandsackTragePoseProbe(), die exakt die
//      Produktions-Zeichenfunktion zeichneSandsackTragePose() aufruft, vergroessert.
//   2. SZENE: die echte Vorschau-Szene (window.__arena.sandsackVorschau()) in Spielgroesse.
//
// Aufruf:  node scripts/screenshot-sandsack-trage-pose.mjs [galerie.png] [szene.png] [vorspulen] [Name ...]
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const outGalerie = process.argv[2] || path.join(WURZEL, "tmp-ux-audit/sandsack-trage-pose-galerie.png");
const outSzene = process.argv[3] || path.join(WURZEL, "tmp-ux-audit/sandsack-trage-pose-szene.png");
const vorspulen = Number(process.argv[4] || 25);
const namenArg = process.argv.slice(5);

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.sandsackTragePoseProbe, null, { timeout: 30000 });
// Ein Gewichtheben-Duell bauen (fuer die Szene; die Galerie braucht es nicht, nutzt aber
// dieselben geladenen Blaetter und Kadergroessen).
await seite.evaluate(() => window.__arena.setDisc("gewichtheben"));
await seite.click("#t2");
await seite.click("#play");
await seite.waitForTimeout(400);

const galerie = await seite.evaluate((namenArg) => {
  const A = window.__arena;
  // Standard: die Traeger des aktuellen Duells (Heim zuerst), dazu der Standardkoerper.
  let namen = namenArg;
  if (!namen.length) {
    A.sandsackVorschau(true, 0);
    const plan = A.sandsackVorschauZeitplan() || [];
    const alle = [];
    plan.forEach((s) => s.trips.forEach((t) => { if (!alle.includes(t.u)) alle.push(t.u); }));
    A.sandsackVorschau(false);
    namen = ["__Std", ...alle.slice(0, 5)];
  }
  const spalten = [
    ...[1, 2, 3, 4, 5, 6].map((s) => ({ titel: "Stufe " + s, stufe: s, opts: { phase: "hin", schritt: 0.28, puste: s >= 5 ? 0.55 : 0.9 } })),
    { titel: "Pause", stufe: 5, opts: { phase: "pause", pp: 0.5, puste: 0.35, t: 0.1 } },
    { titel: "Rutscher", stufe: 5, opts: { phase: "rutscher", pp: 0.7, puste: 0.5 } },
    { titel: "leer", stufe: 1, opts: { phase: "leer", schritt: 0.28, ring: false } },
  ];
  const SK = 3, BW = 80, BH = 92;
  const zw = BW * SK, zh = BH * SK, kopf = 26, rand = 150;
  const w = rand + spalten.length * zw, h = kopf + namen.length * zh;
  const bilder = [];
  namen.forEach((n, r) => spalten.forEach((sp, i) => {
    bilder.push({ r, i, url: A.sandsackTragePoseProbe(n, sp.stufe, { ...sp.opts, skala: SK, breite: BW, hoehe: BH }) });
  }));
  return { namen, spalten: spalten.map((s) => s.titel), bilder, w, h, zw, zh, kopf, rand };
}, namenArg);

// Zusammensetzen in einer frischen Seite (Bilder als <img> laden, auf eine Leinwand legen).
const zusammen = await seite.evaluate(async (gal) => {
  const c = document.createElement("canvas"); c.width = gal.w; c.height = gal.h;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  g.fillStyle = "#0e1015"; g.fillRect(0, 0, c.width, c.height);
  g.font = "bold 15px Georgia,serif"; g.textBaseline = "middle"; g.textAlign = "center"; g.fillStyle = "#d6ac36";
  gal.spalten.forEach((t, i) => g.fillText(t, gal.rand + i * gal.zw + gal.zw / 2, gal.kopf / 2));
  g.textAlign = "left"; g.fillStyle = "#cfd6e3"; g.font = "13px Georgia,serif";
  gal.namen.forEach((n, r) => g.fillText(n, 8, gal.kopf + r * gal.zh + gal.zh / 2));
  for (const b of gal.bilder) {
    const im = new Image(); im.src = b.url; await im.decode();
    g.drawImage(im, gal.rand + b.i * gal.zw, gal.kopf + b.r * gal.zh);
  }
  g.strokeStyle = "rgba(255,255,255,.08)";
  for (let i = 0; i <= gal.spalten.length; i++) { g.beginPath(); g.moveTo(gal.rand + i * gal.zw, 0); g.lineTo(gal.rand + i * gal.zw, c.height); g.stroke(); }
  return c.toDataURL();
}, galerie);
writeFileSync(outGalerie, Buffer.from(zusammen.split(",")[1], "base64"));
console.log("Galerie: " + outGalerie + " (" + galerie.namen.join(", ") + ")");

// Szene in Spielgroesse.
const status = await seite.evaluate((s) => window.__arena.sandsackVorschau(true, s), vorspulen);
console.log("sandsackVorschau(true, " + vorspulen + "):", JSON.stringify(status));
await seite.waitForTimeout(150);
const cv = await seite.$("#cv");
await cv.screenshot({ path: outSzene });
console.log("Szene: " + outSzene);

// 3. STUFEN IN DER ECHTEN SZENE: je Stufe einen Trip ohne Rutscher/Pause suchen, die Szene
// auf ein Viertel dieses Trips vorspulen (Phase "hin") und den Traeger ausschneiden — mit
// dreifacher Geraetepixeldichte, damit die Haltung in Spielaufloesung sichtbar wird.
const outStufen = outSzene.replace(/\.png$/, "-stufen.png");
const tmpDir = mkdtempSync(path.join(os.tmpdir(), "sandsack-stufen-"));
const zeitplan = await seite.evaluate(() => window.__arena.sandsackVorschauZeitplan());
const stufeVon = (kg) => Math.min(5, Math.floor(Math.max(0, Math.min(1, kg / 105)) * 6));
const STATIONEN = ["Depot", "Steg", "Rampe & Silo"];
const ziele = [];
for (let st = 0; st < 6; st++) {
  let fund = null;
  for (const seiteZ of zeitplan) for (const tr of seiteZ.trips)
    if (!fund && !tr.rutscher && !tr.pause && stufeVon(tr.kg) === st) fund = { side: seiteZ.side, anteil: 0.25, ...tr };
  // Rueckfall: ein Trip MIT Rutscher/Pause, dann aber frueh im "hin"-Teil (der Sonderteil
  // beginnt fruehestens bei 15 % des Trips, s. stepSandsackVorschau()).
  for (const seiteZ of zeitplan) for (const tr of seiteZ.trips)
    if (!fund && stufeVon(tr.kg) === st) fund = { side: seiteZ.side, anteil: 0.07, ...tr };
  ziele.push(fund);
}
const hd = await browser.newPage({ viewport: { width: 1300, height: 700 }, deviceScaleFactor: 3 });
hd.on("pageerror", (e) => fehler.push(String(e)));
await hd.goto(SEITE, { waitUntil: "networkidle" });
await hd.waitForFunction(() => window.__arena && window.__arena.sandsackVorschau, null, { timeout: 30000 });
await hd.evaluate(() => window.__arena.setDisc("gewichtheben"));
await hd.click("#t2");
await hd.click("#play");
await hd.waitForTimeout(400);
const ausschnitte = [];
for (let st = 0; st < 6; st++) {
  const z = ziele[st];
  if (!z) { ausschnitte.push(null); console.log("Stufe " + (st + 1) + ": kein passender Trip"); continue; }
  const t = z.start + z.dauer * z.anteil;
  await hd.evaluate((t) => { window.__arena.sandsackVorschau(false); window.__arena.sandsackVorschau(true, t); }, t);
  await hd.waitForTimeout(120);
  const box = await (await hd.$("#cv")).boundingBox();
  const geo = await hd.evaluate(() => { const c = document.getElementById("cv"); return { W: c.width, H: c.height }; });
  const s = box.width / geo.W;
  const sIdx = STATIONEN.indexOf(z.station);
  const zoneW = (geo.W * 0.84) / 3, x0 = geo.W * 0.08 + Math.max(0, sIdx) * zoneW;
  // Traeger-x wie in zeichneSandsackTraeger()/stepSandsackVorschau(): "hin" laeuft bis zum
  // Sonderteil (Rutscher 1,3 s / Pause 1,8 s, Anteil gedeckelt auf 0,7, Start >= 0,15) bzw.
  // ohne Sonderteil bis 0,55 des Trips, x = x0 + zoneW*min(1, pp*1,08).
  const sonder = z.rutscher ? 1.3 : z.pause ? 1.8 : 0;
  const sonderStart = sonder ? Math.max(0.15, 0.5 - Math.min(0.7, sonder / z.dauer) / 2) : 0.55;
  const traegerX = x0 + zoneW * Math.min(1, (z.anteil / sonderStart) * 1.08);
  const laneY = z.side === 0 ? geo.H * 0.36 : geo.H * 0.62;
  const B = 96, Hh = 84;
  const clip = { x: box.x + (traegerX - B / 2) * s, y: box.y + (laneY - 66) * s, width: B * s, height: Hh * s };
  const datei = path.join(tmpDir, "stufe-" + (st + 1) + ".png");
  await hd.screenshot({ path: datei, clip });
  ausschnitte.push(datei);
  console.log("Stufe " + (st + 1) + ": " + z.u + ", " + z.kg + " kg, " + z.station + ", t=" + t.toFixed(1) + "s -> " + datei);
}
// Die Einzelausschnitte nebeneinander zu einem Streifen zusammensetzen (Beschriftung oben).
const vorhanden = ausschnitte.map((d, i) => (d ? { d, i } : null)).filter(Boolean);
if (vorhanden.length) {
  const daten = vorhanden.map(({ d, i }) => ({ i, url: "data:image/png;base64," + readFileSync(d).toString("base64"), z: ziele[i] }));
  const streifen = await seite.evaluate(async (daten) => {
    const ims = [];
    for (const x of daten) { const im = new Image(); im.src = x.url; await im.decode(); ims.push(im); }
    const w = ims[0].width, h = ims[0].height, kopf = 44;
    const c = document.createElement("canvas"); c.width = w * ims.length; c.height = h + kopf;
    const g = c.getContext("2d"); g.fillStyle = "#0e1015"; g.fillRect(0, 0, c.width, c.height);
    g.textAlign = "center"; g.textBaseline = "middle";
    ims.forEach((im, k) => {
      g.drawImage(im, k * w, kopf);
      const z = daten[k].z;
      g.fillStyle = "#d6ac36"; g.font = "bold 18px Georgia,serif";
      g.fillText("Stufe " + (daten[k].i + 1) + " — " + z.kg + " kg", k * w + w / 2, 14);
      g.fillStyle = "#cfd6e3"; g.font = "14px Georgia,serif";
      g.fillText(z.u + " · " + z.station, k * w + w / 2, 33);
    });
    return c.toDataURL();
  }, daten);
  writeFileSync(outStufen, Buffer.from(streifen.split(",")[1], "base64"));
  console.log("Stufen in der Szene: " + outStufen);
}
console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
await browser.close();
