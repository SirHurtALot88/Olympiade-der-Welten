// ===================================================================================
// LAEUFT ES AUCH WIRKLICH? — die Live-Abnahme fuer den Basketball-Entwurf.
//
// messe-basketball-wurfquoten.mjs und messe-arena-einfluss.mjs fahren die Engine ueber
// den Serien-Hook (window.__arena.wurfSerie / einflussVon): sie bauen ein Spiel, lassen
// es in einer Schleife durchrechnen und lesen das Protokoll. Das ist schnell und
// reproduzierbar — aber es beruehrt die ANZEIGE nie. Ein Fehler, der nur beim Zeichnen
// auftritt (undefinierte Eigenschaft im Sprite, Division durch null in einer Kamera,
// ein Feed-Text, der auf ein geloeschtes Objekt zugreift), faellt dort NICHT auf.
//
// Dieses Skript spielt deshalb ein Basketballspiel so, wie Chris es sieht: Tab "Arena",
// Knopf "Kampf starten", zusehen. Es prueft drei Dinge, die die Serienmessung nicht
// pruefen kann:
//   1. keine Konsolen-/Seitenfehler ueber die volle Spieldauer,
//   2. es passiert tatsaechlich etwas (Punkte, Rebounds, Doppelungen, Durchbrueche),
//   3. Bilder, auf denen man das nachsehen kann.
//
//   node scripts/abnahme-basketball-live.mjs
//   node scripts/abnahme-basketball-live.mjs /pfad/fuer/bilder
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const pfad = path.join(HIER, "..", "public", "mockups", "battle-mode.html");
const ausgabe = process.argv[2] || path.join(HIER, "..", ".abnahme-bilder");
fs.mkdirSync(ausgabe, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const seite = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

// ALLES einsammeln, was schiefgehen kann — nicht nur `pageerror`. Ein `console.error`
// aus einem verschluckten try/catch loest kein pageerror aus und waere sonst unsichtbar.
const fehler = [];
seite.on("pageerror", (e) => fehler.push("pageerror: " + String(e)));
// WAS ALS FEHLER ZAEHLT UND WAS NICHT — nachgemessen, nicht gesetzt. Der erste Lauf
// dieses Skripts meldete zehn "Fehler", von denen KEIN EINZIGER aus dem Spiel kam:
//   - fonts.googleapis.com  — der Umgebungs-Proxy laesst nur eine Allowlist durch (s.
//     CLAUDE.md); im Browser von Chris laedt die Schrift ganz normal.
//   - /sprites/arena/*.png  — absolute Pfade, die unter file:// an der Wurzel des
//     Dateisystems suchen. Betrifft die Kulisse, nicht die Mechanik, und ist aelter als
//     diese Runde.
//   - *.mp3                — Tondateien liegen nicht im Repo.
// Solche Meldungen faerben eine Abnahme dauerhaft rot und machen sie damit wertlos: wer
// zehn bekannte Fehler jedes Mal wegliest, liest den elften auch weg. Sie stehen deshalb
// getrennt unter "bekannt" und nur echte JS-Fehler unter "Fehler".
const bekannt = [];
const istKulisse = (u) =>
  /fonts\.(googleapis|gstatic)\.com/.test(u) || /\.(mp3|ogg|wav|png|jpg|jpeg|webp|svg)$/i.test(u);
seite.on("console", (m) => {
  if (m.type() !== "error" && m.type() !== "warning") return;
  const t = m.text();
  (/Failed to load resource/.test(t) ? bekannt : fehler).push(`console.${m.type()}: ${t}`);
});
seite.on("requestfailed", (r) => {
  (istKulisse(r.url()) ? bekannt : fehler).push("requestfailed: " + r.url());
});

await seite.goto("file://" + pfad, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });

// Auf Basketball stellen und in den Arena-Tab wechseln.
await seite.evaluate(() => window.__arena.setDisc("basketball"));
await seite.click("#t2");
await seite.waitForTimeout(400);
await seite.screenshot({ path: path.join(ausgabe, "01-arena-bereit.png") });

await seite.click("#play");

// Zusehen und unterwegs Bilder machen. Die Spieldauer steht in der Engine
// (SPIELDAUER_BASKETBALL = 90 s Spielzeit); bei Tempo 1x laeuft das in Echtzeit, deshalb
// wird hier nicht auf das Spielende gewartet, sondern eine Weile mitgeschaut.
// Auf Tempo 4x stellen, damit die volle Spielzeit (90 s) in die Abnahme passt — sonst
// sieht man nur die ersten zwanzig Sekunden und damit kaum eine Doppelung.
for (let i = 0; i < 2; i++) await seite.click("#spd");
const marken = [1500, 4000, 7000, 10000, 14000, 18000, 23000, 28000];
let vorher = 0;
for (let i = 0; i < marken.length; i++) {
  await seite.waitForTimeout(marken[i] - vorher);
  vorher = marken[i];
  await seite.screenshot({ path: path.join(ausgabe, `02-lauf-${String(i + 1).padStart(2, "0")}.png`) });
}

// Was ist in der Zeit passiert? Das rohe Protokoll der Live-Engine (fsZuege) — dieselbe
// Quelle, aus der auch die Anzeige ihre Statistik zieht.
const bilanz = await seite.evaluate(() => {
  const z = window.__arena.fsZuege() || [];
  const zaehl = {};
  for (const e of z) zaehl[e.art] = (zaehl[e.art] || 0) + 1;
  return {
    ereignisse: z.length,
    zaehl,
    stand: document.getElementById("score")?.textContent?.trim() || "?",
    uhr: document.getElementById("clock")?.textContent?.trim() || "?",
    feed: [...document.querySelectorAll("#feed div, .feed div")].slice(-8).map((d) => d.textContent.trim()),
  };
});

await seite.screenshot({ path: path.join(ausgabe, "03-ende.png"), fullPage: true });

console.log("Stand:", bilanz.stand, " Uhr:", bilanz.uhr);
console.log("Ereignisse:", bilanz.ereignisse);
for (const [k, v] of Object.entries(bilanz.zaehl).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(22)} ${v}`);
}
if (bilanz.feed.length) {
  console.log("\nLetzte Feed-Zeilen:");
  for (const f of bilanz.feed) console.log("  " + f);
}
console.log("\nBilder in:", ausgabe);
console.log("Fehler (echte JS-/Spielfehler):", fehler.length ? fehler.slice(0, 10) : "keine");
console.log("bekannte Kulissen-Meldungen (Schrift/Sprites/Ton, aelter als diese Runde):", bekannt.length);

await browser.close();
process.exit(fehler.length ? 1 : 0);
