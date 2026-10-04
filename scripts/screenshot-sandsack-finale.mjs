// Visueller Rauchtest fuer das Sandsack-Finale-Buehnenbild (Paket 2, Task #58). Kein Teil der
// Abnahme-Sonden — nur zum Ansehen. Schaltet window.__arena.sandsackVorschau() ein (reine
// Anzeige, s. deren Kopfkommentar in battle-mode.engine.js), lauft ein Stueck vor und macht
// einen Screenshot zu einem Zeitpunkt, an dem beide Seiten mitten im Rennen stehen.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const saat = Number(process.argv[2] || 1337);
const vorspulenSekunden = Number(process.argv[3] || 20);
const out = process.argv[4] || path.join(WURZEL, "tmp-ux-audit/sandsack-finale-buehne.png");

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
await seite.evaluate((saat) => window.__arena.setDisc("gewichtheben"), saat);
await seite.click("#t2");
await seite.click("#play");
// Kurz laufen lassen, damit LASTEN_FINALE sicher gesetzt ist (baueSandsackFinale() laeuft
// unmittelbar nach baueHebenDuelle() beim Buehnenaufbau), dann die Vorschau einschalten.
await seite.waitForTimeout(400);
const status = await seite.evaluate((s) => window.__arena.sandsackVorschau(true, s), vorspulenSekunden);
console.log("sandsackVorschau(true, " + vorspulenSekunden + "):", JSON.stringify(status));
// Einen echten Frame abwarten, damit draw() den vorgespulten Zustand tatsaechlich rendert.
await seite.waitForTimeout(150);
const cv = await seite.$("#cv");
await cv.screenshot({ path: out });
console.log("Screenshot: " + out);
console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
await browser.close();
