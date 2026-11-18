// BATTLEFIELD "DOMINATION MIT FUENF PUNKTEN" (17.11.) — Sonde fuer das neue Pod-Format.
//
// Faehrt N Vier-Team-Gefechte (Kader-Familie, vier Teams) im Format "domination5" und meldet je Lauf
// Platzierung/Punkte, und ueber alle: wie oft der Besitz der fuenf Orte wechselt, wie viele Orte am Ende
// je Team gehalten werden, Respawns, Rotationen (Laufwege) je Kaempfer und Takt, die Verteilung der
// Kaempfer ueber die Orte (Aufteilen statt Klumpen) und die Spieldauer. Dazu der Kontrolllauf im
// Standardformat "orte3" mit derselben Saat (muss unveraendert bleiben).
//
//   node scripts/probe-battlefield-domination5.mjs [laeufe] [--je-seite=4]
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const args = process.argv.slice(2);
const LAEUFE = Number(args.find((a) => !a.startsWith("--")) || 12);
const JE_SEITE = Number((args.find((a) => a.startsWith("--je-seite=")) || "--je-seite=4").split("=")[1]);
// --d5='{"schaden":2,"plan":{...}}': Kalibrierwerte fuer diesen Lauf (window.__arena.battlefieldD5).
const D5 = JSON.parse((args.find((a) => a.startsWith("--d5=")) || "--d5={}").slice(5));
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const v = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten;
const teams = [v[0].heim, v[0].gast, v[1].heim, v[1].gast];

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
try {
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.addInitScript(() => { window.AudioContext = undefined; });
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.spieleBattlefieldPod, null, { timeout: 60000 });
  const r = await seite.evaluate(({ teams, LAEUFE, JE_SEITE, D5 }) => {
    const A = window.__arena, aus = [];
    A.battlefieldD5(D5);
    for (let i = 0; i < LAEUFE; i += 1) {
      const saat = 4242 + i * 7919;
      const e = A.spieleBattlefieldPod(teams, saat, null, { formSaat: saat, jeSeite: JE_SEITE, format: "domination5", protokoll: true });
      const g = e.gefecht;
      let wechsel = 0, rotationen = 0, respawns = 0, kos = 0;
      const verteilung = [];
      for (const tk of g.takte) {
        for (const ev of tk.ereignisse) {
          if (ev.typ === "erobert") wechsel += 1;
          if (ev.typ === "rotation") rotationen += 1;
          if (ev.typ === "respawn") respawns += 1;
          if (ev.typ === "ko") kos += 1;
        }
        // Wie viele verschiedene Orte besetzt ein Team im Mittel gleichzeitig?
        const jeTeam = [0, 1, 2, 3].map((s) => new Set(tk.k.filter((k, idx) => g.kaempfer[idx].side === s && k.ort != null && !k.raus).map((k) => k.ort)).size);
        verteilung.push(jeTeam.reduce((a, b) => a + b, 0) / 4);
      }
      const orte3 = A.spieleBattlefieldPod(teams, saat, null, { formSaat: saat, jeSeite: JE_SEITE });
      aus.push({ saat, ende: e.ende, takte: e.takte, dauer: e.dauer, punkte: e.teams.map((t) => t.punkte), platz: e.teams.map((t) => t.eventPlatz),
        besitz: g.orte.map((o) => o.besitz), wechsel, rotationen, respawns, kos, kaempfer: g.kaempfer.length,
        orteJeTeam: verteilung.reduce((a, b) => a + b, 0) / Math.max(1, verteilung.length),
        podFormat: e.podFormat || null, orte3Format: orte3.podFormat || "orte3", orte3Takte: orte3.takte });
    }
    return aus;
  }, { teams, LAEUFE, JE_SEITE, D5 });
  for (const l of r) console.log(JSON.stringify(l));
  const m = (f) => (r.reduce((a, l) => a + f(l), 0) / r.length).toFixed(2);
  console.log(`MITTEL: Takte ${m((l) => l.takte)}, Dauer ${m((l) => l.dauer)} s, Besitzwechsel ${m((l) => l.wechsel)}, Rotationen je Kaempfer ${m((l) => l.rotationen / l.kaempfer)}, ` +
    `K.o. ${m((l) => l.kos)}, Respawns ${m((l) => l.respawns)}, gleichzeitig besetzte Orte je Team ${m((l) => l.orteJeTeam)}`);
  console.log("Seitenfehler:", fehler.length ? fehler.join(" | ") : "keine");
} finally {
  await browser.close();
}
