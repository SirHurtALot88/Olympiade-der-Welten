/**
 * IN-GAME-AUDIT — der wiederholbare Durchlauf.
 *
 * Steuert die echte Oberflaeche mit Chromium: klickt jede Hauptansicht an, sammelt
 * Konsolenfehler, Ladeskelette, Ueberschriften-Hierarchie und Screenshots.
 *
 * BENUTZUNG — der Server laeuft gegen eine KOPIE, nie gegen den echten Spielstand:
 *
 *   git fetch origin live-save
 *   git show origin/live-save:data/online-saves/hetzner-live.sqlite.gz > /tmp/abbild.gz
 *   gunzip -cf /tmp/abbild.gz > /tmp/audit.sqlite
 *   OLY_APP_SQLITE_PATH=/tmp/audit.sqlite npx next dev --port 3000
 *   node scripts/audit-ingame-durchlauf.mjs
 *
 * WARUM EINE KOPIE: der Durchlauf klickt Knoepfe, und Knoepfe schreiben. Gegen den
 * gespiegelten Live-Stand zu fahren hiesse, den Spielstand beim Messen zu veraendern.
 *
 * Befunde und Screenshots landen in AUDIT_OUT (Vorgabe: ./outputs/audit-ingame).
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const OUT = process.env.AUDIT_OUT ?? new URL('../outputs/audit-ingame/', import.meta.url).pathname;
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
const fehler = []; let ort = 'start';
page.on('console', (m) => { if (m.type() === 'error') fehler.push({ ort, t: m.text().slice(0,200) }); });
page.on('pageerror', (e) => fehler.push({ ort, t: 'PAGEERROR ' + String(e).slice(0,300) }));
page.on('response', (r) => { if (r.status() >= 500) fehler.push({ ort, t: `HTTP ${r.status()} ${r.url().slice(0,120)}` }); });

await page.goto('http://127.0.0.1:3000/foundation', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(12000);

const ZIELE = ['Home','Inbox','Einsatzliste','Arena','Saisonstand','Teams','Spieler','Training','Gebäude','Ewige Tabelle','Transfermarkt','Scouting','Historie','Kredite','Finanzen','Ranks','Spielplan','Leaders','Sponsoren'];
const bericht = [];
for (const ziel of ZIELE) {
  ort = ziel;
  const t0 = Date.now();
  try {
    await page.getByRole('button', { name: ziel, exact: true }).first().click({ timeout: 15000 });
    await page.waitForTimeout(4500);
    const dauer = Date.now() - t0;
    const info = await page.evaluate(() => ({
      hoehe: document.body.scrollHeight,
      leer: document.body.innerText.trim().length,
      skelett: document.querySelectorAll('[class*="skeleton"],[class*="Skeleton"],[class*="lade"],[class*="loading"]').length,
      striche: (document.body.innerText.match(/—/g) || []).length,
      nan: (document.body.innerText.match(/\bNaN\b|undefined|\[object Object\]/g) || []).length,
      h: document.querySelector('h1,h2')?.innerText?.slice(0,60),
    }));
    bericht.push({ ziel, dauer, ...info });
    await page.screenshot({ path: `${OUT}/screen-${ziel.replace(/[^a-zA-Z]/g,'')}.png` });
    await fs.writeFile(`${OUT}/t-${ziel.replace(/[^a-zA-Z]/g,'')}.txt`, await page.evaluate(() => document.body.innerText.slice(0, 12000)));
    console.log(`${ziel.padEnd(16)} ${String(dauer).padStart(6)}ms  Text ${String(info.leer).padStart(6)}  Skelette ${String(info.skelett).padStart(3)}  NaN/undef ${info.nan}  · ${info.h ?? ''}`);
  } catch (e) {
    bericht.push({ ziel, fehler: String(e).slice(0,150) });
    console.log(`${ziel.padEnd(16)} NICHT ERREICHBAR — ${String(e).split('\n')[0].slice(0,90)}`);
  }
}
await fs.writeFile(`${OUT}/screens-bericht.json`, JSON.stringify({ bericht, fehler }, null, 2));
console.log(`\nFEHLER: ${fehler.length}`);
const uniq = [...new Set(fehler.map((f) => f.ort + ' :: ' + f.t))];
uniq.slice(0, 20).forEach((t) => console.log('  ' + t));
await browser.close();
