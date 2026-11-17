// Sonde fuer die sichtbare Bahn-Pod-Anzeige (Takeshi's Castle/Staffel): liest Kaderleisten-Mitte (#kmitte),
// die Vier-Team-Kopfleiste (#bahnPodLeiste) und den Pod-Stand nach ein paar Sekunden Simulation.
// Aufruf: node scripts/probe-bahn-pod-hud.mjs <disziplin> [teams 2..4] [sekunden]
import { chromium } from "playwright";
import { createServer } from "node:http";
import { existsSync, createReadStream, statSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const v = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten;
const alle = [v[0].heim, v[0].gast, v[1].heim, v[1].gast];
const bd = process.argv[2] || "takeshis-castle";
const n = Number(process.argv[3] || 4);
const sek = Number(process.argv[4] || 5);
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
const srv = await new Promise((r) => {
  const s = createServer((q, res) => {
    const p = path.join(PUBLIC, decodeURIComponent(new URL(q.url, "http://x").pathname));
    try { statSync(p); res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" }); createReadStream(p).pipe(res); }
    catch { res.writeHead(404); res.end(); }
  });
  s.listen(0, "127.0.0.1", () => r(s));
});
const b = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
try {
  const pg = await b.newPage();
  await pg.goto(`http://127.0.0.1:${srv.address().port}/mockups/battle-mode.html`, { waitUntil: "networkidle" });
  await pg.waitForFunction(() => window.__arena && window.__arena.setDisc);
  const r = await pg.evaluate(({ bd, kader, sek }) => {
    const A = window.__arena;
    A.bahnPodAnzeigen(bd, { teams: kader.map((k, i) => ({ name: "Team " + "ABCD"[i], kader: k })), k: 4, saat: 4242, aufstellung: null });
    A.setDisc(bd);
    for (let i = 0; i < sek; i += 1) A.sondenLauf(60);
    const leiste = document.getElementById("bahnPodLeiste");
    return {
      kmitte: document.getElementById("kmitte").textContent,
      leiste: leiste ? leiste.innerText.replace(/\n+/g, " | ") : null,
      leisteKaesten: leiste ? leiste.children.length : 0,
      tnameLSichtbar: getComputedStyle(document.getElementById("tnameL")).display,
      stand: A.bahnPodAnzeigeStand(),
    };
  }, { bd, kader: alle.slice(0, n), sek });
  console.log(JSON.stringify(r).slice(0, 1200));
} finally {
  await b.close();
  srv.close();
}
