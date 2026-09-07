// DIAGNOSE (Aufgabe: Naechster Versuch nach Fehlversuch). Prueft, ob die eigene Sequenz
// eines Hebers (NICHT die Gegner-reaktive v===2-Ausnahme) nach einem Fehlversuch die
// naechste Ansage erhoeht, gleich laesst oder senkt. v=0->1 ist NIE reaktiv (die Reaktion
// greift nur bei v===2), das ist also der saubere Test.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const SPIELE = Number(process.argv[2] || 200);
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.spiele, null, { timeout: 30000 });

const roh = await seite.evaluate((n) => {
  const A = window.__arena, spiele = [];
  for (let i = 0; i < n; i++) spiele.push(A.spiele("gewichtheben", 5000 + i * 7919).protokoll);
  return spiele;
}, SPIELE);
await browser.close();

let steigt01=0, gleich01=0, sinkt01=0, n01=0;
let steigt12=0, gleich12=0, sinkt12=0, n12=0;
const beispiele=[];
for (const prot of roh) {
  for (const u of prot) {
    for (const uebung of ["reissen","stossen"]) {
      const r = u.runden.filter(x=>x.uebung===uebung).sort((a,b)=>a.versuch-b.versuch);
      if (r.length<3) continue;
      const [v0,v1,v2]=r;
      if (!v0.gueltig) {
        n01++;
        if (v1.kg>v0.kg){steigt01++; if(beispiele.length<8)beispiele.push({u:u.n,uebung,von:v0.kg,nach:v1.kg,phase:"0->1"});}
        else if (v1.kg===v0.kg) gleich01++;
        else sinkt01++;
      }
      if (!v1.gueltig) {
        n12++;
        if (v2.kg>v1.kg){steigt12++; if(beispiele.length<8)beispiele.push({u:u.n,uebung,von:v1.kg,nach:v2.kg,phase:"1->2"});}
        else if (v2.kg===v1.kg) gleich12++;
        else sinkt12++;
      }
    }
  }
}
console.log(`Spiele: ${SPIELE}`);
console.log(`\nNach Fehlversuch 1 -> Ansage 2 (v=0->1, NIE reaktiv, n=${n01}):`);
console.log(`  steigt: ${steigt01} (${(100*steigt01/Math.max(1,n01)).toFixed(1)}%)  gleich: ${gleich01} (${(100*gleich01/Math.max(1,n01)).toFixed(1)}%)  sinkt: ${sinkt01} (${(100*sinkt01/Math.max(1,n01)).toFixed(1)}%)`);
console.log(`\nNach Fehlversuch 2 -> Ansage 3 (v=1->2, KANN reaktiv sein, n=${n12}):`);
console.log(`  steigt: ${steigt12} (${(100*steigt12/Math.max(1,n12)).toFixed(1)}%)  gleich: ${gleich12} (${(100*gleich12/Math.max(1,n12)).toFixed(1)}%)  sinkt: ${sinkt12} (${(100*sinkt12/Math.max(1,n12)).toFixed(1)}%)`);
console.log("\nBeispiele:", JSON.stringify(beispiele,null,2));
