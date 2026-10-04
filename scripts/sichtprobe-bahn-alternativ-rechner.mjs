// SICHTPROBE: DER ALTERNATIV-RECHNER IM ECHTEN ENDSTAND-OVERLAY (Task #27, Klasse A*,
// docs/design/fable-ideen-bahn-30-09.md Abschnitt 1.3).
//
// Spielt fuer jede der vier Bahn-Disziplinen EIN echtes, sichtbares Rennen (ueber den
// Play-Knopf, nicht ueber eine headless Sonde) bis zum Zieleinlauf durch und prueft, dass
// die neue #ealternativ-Zeile im Endstand-Overlay erscheint -- fuer Time-Trial als exakte
// Zeitangabe je Alternativplan, fuer Spurt/Staffel/Takeshi als "X von 3 Saaten"-Tendenz --
// und dass dabei kein Seitenfehler auftritt.
//
//   node scripts/sichtprobe-bahn-alternativ-rechner.mjs
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const AUSGABE = path.join(WURZEL, "scratch/sichtprobe-bahn-alternativ");
mkdirSync(AUSGABE, { recursive: true });

const DISZIS = ["time-trial", "spurt", "staffel", "takeshis-castle"];

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
let fehlerGesamt = 0;
try {
  for (const d of DISZIS) {
    // Hohe Viewport-Hoehe: #endstand ist ein feststehendes Overlay, dessen Element-Screenshot
    // sonst an der Fensterhoehe abschneidet, BEVOR die Alternativ-Rechner-Zeile (ganz unten,
    // nach Sieger-Banner/Tafeln/Szene des Spiels) ueberhaupt sichtbar wird.
    const seite = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
    // NUR pageerror ZAEHLT ALS SEITENFEHLER, wie in jedem anderen Skript dieses Projekts
    // (miss-bahn-puste.mjs/miss-alle-disziplinen.mjs/pruefe-bahn-alternativ-isolation.mjs):
    // console.error faengt hier auch harmlose 404 auf Ton-/Bild-Assets, die battle-mode.html
    // unter file:// schon immer lose referenziert und die mit dieser Aenderung nichts zu tun
    // haben (nachgemessen auch ohne Alternativ-Rechner-Interaktion vorhanden).
    const seitenfehler = [];
    seite.on("pageerror", (e) => seitenfehler.push(String(e)));
    await seite.goto(SEITE, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });

    await seite.evaluate((d) => window.__arena.setDisc(d), d);
    // TAB "ARENA" (#t2/#p2) -- die Arena-Ansicht (mit #play/#spd/#endstand) liegt hinter
    // einem Reiter, der neben "Aufstellung"/"Spielerprofil" erst angeklickt werden muss;
    // ohne das bleibt #p2 (und damit #spd) `hidden` und jeder Klick darauf schlaegt fehl.
    await seite.click("#t2");
    // Hoechstes Tempo (4x) -- zwei Klicks auf den Tempo-Knopf (1x -> 2x -> 4x), s.
    // dessen Handler in battle-mode.engine.js. Rein praesentational, keine Wirkung auf
    // stepSpurt()/rr()/die Rangtreue -- nur WIE SCHNELL die Sichtprobe zuschaut.
    await seite.click("#spd");
    await seite.click("#spd");
    await seite.click("#play");

    const startMs = Date.now();
    await seite.waitForFunction(
      () => document.getElementById("endstand") && !document.getElementById("endstand").hidden,
      null,
      { timeout: 150000 },
    );
    const dauerMs = Date.now() - startMs;

    const befund = await seite.evaluate(() => {
      const box = document.getElementById("ealternativ");
      return {
        vorhanden: !!box,
        hidden: box ? box.hidden : null,
        text: box ? box.textContent : null,
        zeilenzahl: box ? box.querySelectorAll(".ehzeile").length : 0,
      };
    });

    // ZWEI Aufnahmen: der ganze Endstand (Kontext, auch wenn #endstand als scrollbare
    // `overflow:auto`-Flaeche nur den oberen Teil zeigt) UND gezielt #ealternativ selbst
    // (locator.screenshot() scrollt dafuer innerhalb von #endstand genau dorthin) -- das
    // ist der eigentliche Beleg, nicht nur Kontext drumherum. animations:"disabled" +
    // eigenes Timeout: bei Takeshi laeuft im Hintergrund eine Jubel-/Konfetti-Schleife
    // weiter, die Playwrights "Element stabil"-Wartezeit sonst nie erfuellt -- reine Optik,
    // mit der Alternativ-Rechner-Zeile selbst hat das nichts zu tun.
    try {
      await seite.locator("#endstand").screenshot({
        path: path.join(AUSGABE, `${d}-endstand.png`), animations: "disabled", timeout: 10000,
      });
    } catch (e) {
      console.log(`  (#endstand-Screenshot instabil, uebersprungen: ${e.message.split("\n")[0]})`);
    }
    try {
      await seite.locator("#ealternativ").scrollIntoViewIfNeeded();
      await seite.locator("#ealternativ").screenshot({
        path: path.join(AUSGABE, `${d}-ealternativ.png`), animations: "disabled", timeout: 10000,
      });
    } catch (e) {
      console.log(`  (#ealternativ-Screenshot instabil, uebersprungen: ${e.message.split("\n")[0]})`);
    }

    const ok = befund.vorhanden && !befund.hidden && befund.zeilenzahl > 0 && seitenfehler.length === 0;
    if (!ok) fehlerGesamt++;
    console.log(`\n=== ${d} (Rennende nach ${(dauerMs / 1000).toFixed(1)} s Realzeit bei 4x) ===`);
    console.log(`  #ealternativ sichtbar: ${befund.vorhanden && !befund.hidden ? "ja" : "NEIN"}, Zeilen: ${befund.zeilenzahl}`);
    console.log(`  Inhalt: ${befund.text ? befund.text.replace(/\s+/g, " ").trim() : "(leer)"}`);
    console.log(`  Seitenfehler: ${seitenfehler.length ? seitenfehler.join(" | ") : "keine"}`);
    console.log(`  Screenshots: scratch/sichtprobe-bahn-alternativ/${d}-endstand.png, ${d}-ealternativ.png`);
    await seite.close();
  }
} finally {
  await browser.close();
}

console.log(`\nGesamturteil: ${fehlerGesamt === 0 ? "ALLE VIER BESTANDEN" : fehlerGesamt + " VON 4 FEHLGESCHLAGEN"}`);
if (fehlerGesamt > 0) process.exitCode = 1;
