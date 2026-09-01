// SICHTPRUEFUNG DES NBA2K-UMBAUS — Vorher/Nachher-Screenshots aus der ECHTEN Arena.
//
// Chris' Anforderung: die Wirkung nicht nur als Zahl sehen, sondern im laufenden Mockup,
// derselben Datei, die im Spiel als Tab laeuft. Dieses Skript bedient die UI wie ein
// Mensch — Arena-Reiter, Disziplin Basketball, Tempo hochstellen, "Kampf starten" —
// und fotografiert die gerenderte Seite zu denselben Spielzeitpunkten in beiden Staenden.
//
// BEWUSST UEBER DIE UI und nicht ueber die headless-Sonde: eine headless-Simulation
// zeichnet nichts. Was hier entsteht, ist genau das Bild, das Chris im Spiel sieht —
// Spielfeld, Feed-Text, laufende Wertungstabelle.
//
// Aufruf:
//   node scripts/schiesse-basketball-vergleich.mjs <vorher.html> <nachher.html> <ziel-ordner> [saat]

import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const [vorherPfad, nachherPfad, zielArg] = process.argv.slice(2);
if (!vorherPfad || !nachherPfad || !zielArg) {
  console.error("Aufruf: node scripts/schiesse-basketball-vergleich.mjs <vorher.html> <nachher.html> <ziel>");
  process.exit(1);
}
const ziel = resolve(zielArg);
mkdirSync(ziel, { recursive: true });

const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});

// Spielzeitpunkte (Sekunden auf der Spieluhr), zu denen fotografiert wird.
const MOMENTE = [25, 70, 130];

async function lauf(pfad, marke) {
  const seite = await browser.newPage({ viewport: { width: 1320, height: 1000 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(pathToFileURL(resolve(pfad)).href, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => Boolean(window.__arena), null, { timeout: 30000 });

  // Basketball waehlen (derselbe Einstieg, den auch die Disziplin-Leiste benutzt) und in
  // den Arena-Reiter wechseln.
  await seite.evaluate(() => window.__arena.setDisc("basketball"));
  await seite.click("#t2");
  await seite.waitForTimeout(400);

  // Tempo auf die hoechste Stufe, damit ein 180-Sekunden-Spiel nicht in Echtzeit
  // abgewartet werden muss. Der Knopf schaltet ZYKLISCH durch die Stufen — also klicken,
  // bis die hoechste ansteht, statt blind viermal. Das aendert NUR, wie oft stepSim je
  // Bild laeuft, nicht das Ergebnis (s. loop()/ZEIT_DEHNUNG im Motor): bei hoeherem Tempo
  // laeuft stepSim oefter mit demselben festen dt, nicht mit groesserem dt.
  let tempo = await seite.textContent("#spd");
  for (let i = 0; i < 6 && !/4/.test(tempo || ""); i++) {
    await seite.click("#spd");
    await seite.waitForTimeout(120);
    tempo = await seite.textContent("#spd");
  }

  await seite.click("#play");

  // WARTEN AN DER SICHTBAREN SPIELUHR, nicht an window.__arena.zeit(): `zeit()` gibt die
  // KAMPF-Uhr zurueck (`t`) und bleibt im Feldspiel bei 0 — die Basketball-Spielzeit ist
  // `fsT` und steht nach aussen nur im HUD (#clock, Format "m:ss"). Zugleich der ehrlichere
  // Test: gewartet wird auf das, was auch Chris auf dem Schirm sieht.
  const schuesse = [];
  for (const t of MOMENTE) {
    await seite.waitForFunction(
      (bis) => {
        const e = document.getElementById("clock");
        if (!e) return false;
        const m = /(\d+):(\d+)/.exec(e.textContent || "");
        const sek = m ? Number(m[1]) * 60 + Number(m[2]) : 0;
        return sek >= bis || window.__arena.vorbei();
      },
      t,
      { timeout: 240000 },
    );
    const datei = resolve(ziel, `${marke}-spielzeit-${t}s.png`);
    await seite.screenshot({ path: datei });
    schuesse.push(datei);
  }

  // Bis zum Ende laufen lassen und den Endstand mitnehmen.
  await seite.waitForFunction(() => window.__arena.vorbei(), null, { timeout: 300000 }).catch(() => {});
  await seite.waitForTimeout(1200);
  const endDatei = resolve(ziel, `${marke}-endstand.png`);
  await seite.screenshot({ path: endDatei });
  schuesse.push(endDatei);

  const stand = await seite.evaluate(() => {
    const t = document.getElementById("score");
    const feed = [...document.querySelectorAll("#feed *")].slice(-12).map((e) => e.textContent.trim());
    return { score: t ? t.textContent : null, feed };
  });

  await seite.close();
  return { schuesse, stand, tempo, fehler };
}

const v = await lauf(vorherPfad, "vorher");
const n = await lauf(nachherPfad, "nachher");
await browser.close();

writeFileSync(resolve(ziel, "stand.json"), JSON.stringify({ vorher: v.stand, nachher: n.stand }, null, 2));
console.log("Tempo:", v.tempo, "/", n.tempo);
console.log("Endstand vorher :", v.stand.score);
console.log("Endstand nachher:", n.stand.score);
console.log("Screenshots:");
for (const d of [...v.schuesse, ...n.schuesse]) console.log("  " + d);
console.log("Seitenfehler vorher:", v.fehler.slice(0, 3), "nachher:", n.fehler.slice(0, 3));
