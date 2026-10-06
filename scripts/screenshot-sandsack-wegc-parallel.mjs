// Visueller Rauchtest fuer Gewichtheben Sandsack Weg C PARALLEL, Stufe 3 (Sichtbarkeit der
// Flag-10-Schicht, 06.10., docs/design/gewichtheben-sandsack-wegc-parallel-stufe3-sichtbarkeit-
// 06-10.md). Kein Teil der Abnahme-Sonden — nur zum Ansehen und fuer den Film-Abgleich.
//
// Laedt die Seite MIT dem Schalter (window.__olyBuehneFlags={gewichthebenSandsack:10} vor dem
// Laden, der Weg fuer den Headless-Runner), spielt ein ECHTES Gewichtheben-Spiel (Arena-Tab,
// "Kampf starten") und spult ueber window.__arena.sandsackParSzene() an bestimmte Momente:
// Auftakt, Startaufstellung, laufende Schicht, Direktuebergabe, Stationswechsel, Rutscher, Pause,
// Endstand/Boxscore. Danach dieselben Ereignisse als Lupe (2,5-fache Pixeldichte).
//
//   node scripts/screenshot-sandsack-wegc-parallel.mjs [zielordner] [--paarung=k] [--ohne-lupe] [--nur-abgleich]
//
// --nur-abgleich: keine Bilder, nur bis zum Ende spulen und Film gegen Mechanik abgleichen.
//
// --paarung=k (0..4) setzt vor dem Spiel die k-te Paarung der Kader-Familie live-save
// (window.__arena.kaderSetzen); ohne Angabe der Standardkader der Seite.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ladeKaderFamilieAusDatei } from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const posArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
const ziel = path.resolve(posArg || path.join(WURZEL, "docs/design"));
const paarArg = process.argv.find((a) => a.startsWith("--paarung="));
const PAARUNG = paarArg ? Number(paarArg.slice(10)) : null;
const NUR_ABGLEICH = process.argv.includes("--nur-abgleich");
const MIT_LUPE = !process.argv.includes("--ohne-lupe") && !NUR_ABGLEICH;
mkdirSync(ziel, { recursive: true });
const datei = (m) => path.join(ziel, "gewichtheben-sandsack-wegc-parallel-stufe3-" + m + "-06-10.png");

const browser = await chromium.launch({
  ...(existsSync(fest) ? { executablePath: fest } : {}),
  args: ["--disable-gpu"],
});
const fehler = [];
async function oeffne(skala) {
  const seite = await browser.newPage({ viewport: { width: 1320, height: 1400 }, deviceScaleFactor: skala || 1 });
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.addInitScript(() => { window.__olyBuehneFlags = { gewichthebenSandsack: 10 }; });
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  if (PAARUNG != null) {
    const fam = ladeKaderFamilieAusDatei(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"));
    const v = fam && fam.familie[PAARUNG];
    if (v) { await seite.evaluate((k) => window.__arena.kaderSetzen(k), { heim: v.heim, gast: v.gast }); console.log("Paarung", PAARUNG, v.name || ""); }
  }
  await seite.click('#dbar .dchip:has-text("Gewichtheben")');
  await seite.waitForTimeout(300);
  return seite;
}
const spule = async (seite, t) => {
  const jetzt = await seite.evaluate(() => window.__arena.sandsackParSzene(0).t);
  const st = await seite.evaluate((d) => window.__arena.sandsackParSzene(d), Math.max(0, t - jetzt));
  await seite.waitForTimeout(160);
  return seite.evaluate(() => window.__arena.sandsackParSzene(0));
};

const seite = await oeffne(1);
console.log("Flags:", JSON.stringify(await seite.evaluate(() => window.__arena.buehneFlags())));
await seite.click("#t2");
await seite.waitForTimeout(400);
const einlauf = await seite.$("#einlauf");
if (!NUR_ABGLEICH && einlauf && await einlauf.isVisible()) { await einlauf.screenshot({ path: datei("einlauf") }); console.log("einlauf ->", datei("einlauf")); }
await seite.click("#play");
await seite.waitForTimeout(300);
// Anhalten: die Sonde spult selbst (stepBuehne), die Zeichenschleife malt weiter — so laeuft
// zwischen Spulen und Aufnahme keine Wanduhr-Zeit mehr ab.
await seite.click("#play");
await seite.waitForTimeout(100);
const plan = await seite.evaluate(() => window.__arena.sandsackParSzene(0));
if (!plan) {
  console.log("KEINE Parallel-Szene gebaut (Flag nicht 10?) — nur Canvas-Bild.");
  await (await seite.$("#cv")).screenshot({ path: datei("ohne-szene") });
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
  await browser.close();
  process.exit(0);
}
const L = plan.laufVon;
const H = plan.hoehepunkte;
const zaehl = (typ) => H.filter((h) => h.typ === typ).length;
console.log(`Szene: gesamt ${plan.gesamt} s (Sendezeit ${Math.floor(plan.gesamt / 60)}:${String(Math.round(plan.gesamt % 60)).padStart(2, "0")}), Schicht ab ${L} s, Sieger ${plan.sieger}`);
console.log(`Hoehepunkte: Rutscher ${zaehl("rutscher")}, Pausen ${zaehl("pause")}, Wechsel ${zaehl("wechsel")}, Direkt ${zaehl("direkt")}; Kameraschnitte ${plan.fokusWechsel}`);

const erst = (typ, f) => H.find((h) => h.typ === typ && (!f || f(h)));
const direkt = erst("direkt", (h) => h.t > 20) || erst("direkt");
const wechsel = erst("wechsel");
const rutscher = erst("rutscher", (h) => h.t > 10) || erst("rutscher");
const pause = erst("pause");
const durch = erst("durch", (h) => h.t > 25) || erst("durch");
const momente = [
  ["auftakt", 1.6, null],
  ["startaufstellung", 3.0 + 2.6, null],
  ["schicht", L + 42, null],
  ...(direkt ? [["direkt", L + direkt.t + 0.12, direkt]] : []),
  ...(wechsel ? [["wechsel", L + wechsel.t + Math.min(1.2, (wechsel.dauer || 2) * 0.55), wechsel]] : []),
  ...(rutscher ? [["rutscher", L + rutscher.t + Math.min(0.9, (rutscher.dauer || 2) * 0.5), rutscher]] : []),
  ...(pause ? [["pause", L + pause.t + Math.min(1.0, (pause.dauer || 2) * 0.4), pause]] : []),
  ...(durch ? [["durchpowern", L + durch.t + 0.3, durch]] : []),
  ["ende", plan.gesamt + 1, null],
].filter((m) => !NUR_ABGLEICH || m[0] === "ende").sort((a, b) => a[1] - b[1]);
console.log("Momente:", momente.map(([m, t]) => m + "@" + t.toFixed(1)).join(" "));

const cv = await seite.$("#cv");
let abgleich = null;
const lupen = [];
for (const [moment, t, h] of momente) {
  const st = await spule(seite, t);
  if (moment === "ende" && NUR_ABGLEICH) { abgleich = st.abgleich; console.log("ende:", JSON.stringify({ t: st.t, done: st.done, stand: st.stand })); continue; }
  if (moment === "ende") {
    const haupt = await seite.$(".arenaHaupt");
    await (haupt || cv).screenshot({ path: datei("endstand") });
    const es = await seite.$("#endstand");
    if (es && await es.isVisible()) await es.screenshot({ path: datei("endstand-overlay") });
    abgleich = st.abgleich;
    console.log("ende:", JSON.stringify({ t: st.t, done: st.done, stand: st.stand }), "->", datei("endstand"), datei("endstand-overlay"));
    continue;
  }
  await cv.screenshot({ path: datei(moment) });
  console.log(`${moment}: t=${st.t} ${st.abschnitt} tau=${st.tau} Kamera S${st.fokus + 1}` + (h ? ` · ${h.typ} ${h.n} S${h.s + 1} bei ${h.t}s` : ""), "->", datei(moment));
  if (moment === "schicht") {
    const haupt = await seite.$(".arenaHaupt");
    if (haupt) await haupt.screenshot({ path: datei("hud") });
  }
  if (h && st.figuren) {
    const f = st.figuren.find((x) => x.n === h.n);
    if (f) lupen.push([moment, t, f]);
  }
}

// FILM gegen MECHANIK: dieselben Zahlen je Spieler?
if (abgleich) {
  let ok = 0, nicht = 0;
  for (const S of abgleich) {
    const d = S.beitragSumme - S.arbeitEnde;
    console.log(`Seite ${S.side}: Beitrag-Summe ${S.beitragSumme.toFixed(3)} gegen Arbeitswert ${S.arbeitEnde.toFixed(3)} (Differenz ${d.toExponential(1)})`);
    for (const p of S.spieler) {
      const a = p.film, b = p.mechanik;
      const gleich = Math.abs(a.saecke - b.saecke) < 0.011 && a.pausen === b.pausen && a.rutscher === b.rutscher
        && a.wechsel === b.wechsel && ["normal", "durch", "direkt", "erzwungen"].every((k) => a.entsch[k] === b.entsch[k]);
      if (gleich) ok++; else { nicht++; console.log("  ABWEICHUNG", p.n, JSON.stringify(p)); }
    }
  }
  console.log(`Film = Mechanik: ${ok} Spieler gleich, ${nicht} abweichend`);
}
await seite.close();

// LUPE: dieselben Momente mit 2,5-facher Pixeldichte, Ausschnitt um die betroffene Figur. Erst
// jetzt (erste Seite zu): zwei grosse Renderer gleichzeitig stuerzten in der Agenten-Umgebung ab.
if (MIT_LUPE && lupen.length) {
  const lupe = await oeffne(2.5);
  await lupe.click("#t2");
  await lupe.waitForTimeout(300);
  await lupe.click("#play");
  await lupe.waitForTimeout(300);
  await lupe.click("#play");
  await lupe.waitForTimeout(100);
  const cv2 = await lupe.$("#cv");
  for (const [moment, t, f] of lupen) {
    await spule(lupe, t);
    const box = await cv2.boundingBox();
    const sx = box.width / 1240, sy = box.height / 470;
    const bw = 420, bh = 190;
    const x = Math.max(0, Math.min(1240 - bw, f.x - bw / 2)), y = Math.max(0, Math.min(470 - bh, f.y - bh * 0.72));
    await lupe.screenshot({ path: datei("lupe-" + moment), clip: { x: box.x + x * sx, y: box.y + y * sy, width: bw * sx, height: bh * sy } });
    console.log("lupe-" + moment, "->", datei("lupe-" + moment));
  }
  await lupe.close();
}
console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
await browser.close();
