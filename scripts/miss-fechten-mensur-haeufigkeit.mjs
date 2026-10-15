// ===================================================================================
// F-F2 -- MENSUR-HAEUFIGKEIT (Paket 3, Fable-Ideen Buehne-Duell 30.09.,
// docs/design/fable-ideen-buehne-duell-30-09.md Abschnitt F-F2): Kalibrierziel aus dem
// Dokument ist "selten -- hoechstens ein bis zwei Bahnende-Treffer je Gefecht, sonst
// ueberlagert es das Fechten". Dieses Skript ruft `window.__arena.spieleBuehneDuell("fechten",
// saat)` ueber viele Saaten auf (derselbe Einstiegspunkt wie miss-arena-buehne-spiegel.mjs) und
// liest die Diagnosefelder `boxscore[].mensurTreffer`/`.treffer`, die die F-F1/F-F2-Aenderung
// dort zusaetzlich mitgibt -- reine Messung, kein neuer rr()-Verbrauch.
//
//   node scripts/miss-fechten-mensur-haeufigkeit.mjs [laeufe] [saatstart]
//   node scripts/miss-fechten-mensur-haeufigkeit.mjs 300
//   node scripts/miss-fechten-mensur-haeufigkeit.mjs 300 10000000   (zweiter, unabhaengiger Strom)
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const N = Number(process.argv[2] || 300);
const SAAT0 = Number(process.argv[3] || 500000);
const pfad = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "mockups", "battle-mode.html");
const datei = pathToFileURL(pfad).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(datei, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena, null, { timeout: 30000 });

const ergebnis = await seite.evaluate(({ n, saat0 }) => {
  const proGefecht = []; // Summe (mensurTrefferA+mensurTrefferB) je Spiel (12 Teilnehmer, 6 Gefechte)
  const proSpiel = []; // {seitenA, seitenB} kumulierte Trefferteamstaende
  let gefechteGesamt = 0, mensurTrefferGesamt = 0;
  for (let i = 0; i < n; i++) {
    const saat = saat0 + i * 977;
    const r = window.__arena.spieleBuehneDuell("fechten", saat);
    if (!r) continue;
    const mensurJeSpiel = r.boxscore.reduce((s, row) => s + (row.mensurTreffer || 0), 0);
    gefechteGesamt += r.boxscore.length / 2; // 2 Teilnehmer je Gefecht
    mensurTrefferGesamt += mensurJeSpiel;
    proGefecht.push(mensurJeSpiel / (r.boxscore.length / 2));
    proSpiel.push(r.seiten);
  }
  return { gefechteGesamt, mensurTrefferGesamt, proGefecht, proSpiel };
}, { n: N, saat0: SAAT0 });

await browser.close();
if (fehler.length) {
  console.error("Seitenfehler:", fehler.slice(0, 5));
  process.exit(1);
}

const mittel = ergebnis.mensurTrefferGesamt / ergebnis.gefechteGesamt;
let siegeL = 0, siegeR = 0, un = 0, sL = 0, sR = 0;
for (const [l, r] of ergebnis.proSpiel) {
  sL += l; sR += r;
  if (l > r) siegeL++; else if (r > l) siegeR++; else un++;
}
console.log(`=== Fechten -- Mensur-Haeufigkeit (${N} Spiele, Saatstart ${SAAT0}) ===`);
console.log(`Gefechte insgesamt: ${ergebnis.gefechteGesamt}, Mensur-Treffer insgesamt: ${ergebnis.mensurTrefferGesamt}`);
console.log(`Mensur-Treffer je Gefecht im Mittel: ${mittel.toFixed(3)} (Kalibrierziel: 1-2)`);
console.log(`Teamsiege (kumulierte Treffer, F-F1): links ${siegeL}, rechts ${siegeR}, unentschieden ${un}`);
console.log(`Trefferschnitt je Team: links ${(sL / N).toFixed(2)}, rechts ${(sR / N).toFixed(2)}`);
