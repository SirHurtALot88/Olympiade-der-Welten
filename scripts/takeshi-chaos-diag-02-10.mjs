// Isolations-Sonde fuer die WUCHT-Kalibrierung (Task #45, 02.10.): liest
// window.__arena.bahnSerie("takeshis-castle", n) direkt aus der aktuell im Worktree
// liegenden engine.js (kein Flag, keine Variante -- die Datei IST die Messung) und druckt
// Tackle-/Chaos-Kennzahlen plus die Fallen-Typ-Aufschluesselung (sauber/durchbruch/sturz je
// Fallen-ART), dazu den Median von u.WUCHT ueber alle Laeufer (ueber bahnSerie's reihen[].eig
// NICHT direkt messbar -- WUCHT selbst wird separat ueber eine kleine Einzel-Bau-Schleife
// gelesen, s. unten).
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(process.argv[2] || "/home/user/worktrees/takeshi-wucht");
const N = Number(process.argv[3] || 48);
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1223/chrome-linux64/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
try {
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.bahnSerie, null, { timeout: 30000 });

  const x = await seite.evaluate((n) => window.__arena.bahnSerie("takeshis-castle", n), N);

  console.log(`Takeshi's Castle Chaos-/Fallen-Diagnose, ${x.laeufe} Rennen, ${WURZEL}`);
  const tackles = x.reihen.reduce((s, r) => s + r.tackles, 0);
  const getackelt = x.reihen.reduce((s, r) => s + r.getackelt, 0);
  const ausgewichen = x.reihen.reduce((s, r) => s + r.ausgewichen, 0);
  const gedraengt = x.reihen.reduce((s, r) => s + r.gedraengt, 0);
  console.log(`Je Rennen: Rempler ${tackles.toFixed(2)}, Getroffene ${getackelt.toFixed(2)}, Ausgewichen ${ausgewichen.toFixed(2)}, Gedraenge ${gedraengt.toFixed(2)}`);
  console.log("");
  console.log("Fallen nach Typ (sauber% / durchbruch% / sturz%, n = Fallen-Durchgaenge ueber alle Laeufer/Rennen):");
  for (const [typ, c] of Object.entries(x.fallenNachTyp)) {
    console.log(`  ${typ.padEnd(12)} n=${String(c.n).padStart(6)}  sauber ${c.sauberPct.toFixed(1).padStart(5)}%  durchbruch ${c.durchbruchPct.toFixed(1).padStart(5)}%  sturz ${c.sturzPct.toFixed(1).padStart(5)}%`);
  }

  // Median von u.WUCHT direkt, ueber eine einzelne, unabhaengige Mess-Schleife (reine
  // Diagnose, kein Einfluss auf obige Serie): baut dieselbe Bahn mehrfach und liest LAEUFER
  // ueber dieselbe Sonde wie feldspielSubskills (Sichern/Bauen/Zuruecksetzen).
  const wucht = await seite.evaluate(() => {
    if (!window.__arena.takeshiWuchtDiag) return null;
    return window.__arena.takeshiWuchtDiag();
  });
  if (wucht) console.log("\nu.WUCHT ueber die Kaderfamilie: Median " + wucht.median + ", Spanne " + wucht.min + "-" + wucht.max);

  console.log("\nSeitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
} finally {
  await browser.close();
}
