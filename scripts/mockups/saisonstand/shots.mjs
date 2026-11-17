import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
const repo = process.argv[2], only = process.argv[3];
const { chromium } = createRequire(repo + "/package.json")("playwright");
const out = repo + "/docs/design/saisonstand-modern-17-11";
fs.mkdirSync(out, { recursive: true });
const url = pathToFileURL(repo + "/public/mockups/saisonstand-modern-17-11.html").href;
const D = { width: 1600, height: 900 }, Ph = { width: 390, height: 844 };
const shots = [
  ["01-tabelle-liga2-showdown", "szene=tabelle", D],
  ["02-teamkarte", "szene=teamkarte", D],
  ["03-liga1", "szene=liga1&team=N-N", D],
  ["04-gesamt-32", "szene=gesamt", { width: 1600, height: 1500 }],
  ["05-verein-finanzen", "szene=verein", D],
  ["06-disziplin-matrix", "szene=matrix", D],
  ["07-matrix-kaderstaerke", "szene=kader", D],
  ["08-saisonverlauf-rang", "szene=verlauf", D],
  ["09-saisonverlauf-punkte", "szene=punkte", D],
  ["10-spieltag-ergebnisse", "szene=spieltage&st=11", D],
  ["11-ansetzungen", "szene=ansetzungen", D],
  ["12-bestenliste", "szene=bestenliste", D],
  ["13-vor-spieltag-1", "szene=start", D],
  ["14-saisonende", "szene=ende", D],
  ["15-phone-tabelle", "szene=tabelle&phone=1", Ph],
  ["16-phone-teamkarte", "szene=teamkarte&phone=1&blatt=kontext", Ph],
  ["17-phone-matrix", "szene=matrix&phone=1", Ph],
  ["18-phone-verlauf", "szene=verlauf&phone=1", Ph],
  ["19-phone-spieltag", "szene=spieltage&phone=1", Ph],
  ["20-phone-showdown", "szene=tabelle&phone=1&blatt=kontext", Ph],
];
const b = await chromium.launch();
for (const [name, qs, vp] of shots) {
  if (only && !name.startsWith(only)) continue;
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  p.on("requestfailed", (r) => errs.push("FAILED " + r.url()));
  await p.goto(url + "?still=1&" + qs);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(350);
  const ov = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight }));
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  console.log(name, JSON.stringify(ov), errs.length ? errs.slice(0, 4) : "ok");
  await ctx.close();
}
await b.close();
