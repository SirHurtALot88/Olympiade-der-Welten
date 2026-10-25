// VERIFIKATION TASK #118/#119 (Showcase/Eiskunstlauf sequenziell/Reveal, Chris 13.10. —
// docs/design/chris-feedback-breite-runde-13-10.md Punkte 17/18): prueft auf der ECHTEN
// Spieltags-Buehne (DisciplineStageNativeArena ueber /dev-arena), NICHT dem alten
// Battle-Arena-Motor (public/mockups/battle-mode.engine.js) — dieselbe Unterscheidung, die
// scripts/verify-fechten-sequenziell-reveal-13-10.mjs (Task #116) schon fuer Fechten trifft.
//
//   (a) fuer Showcase (prim "stage") erscheint vor einem Matchup-Block eine Reveal-Karte
//       ("wer gegen wen" + Eignung, "✨ VS") -- mindestens einmal waehrend des Durchlaufs.
//   (b) fuer Eiskunstlauf (ebenfalls prim "stage", aber Gruppengroesse 2) erscheint dieselbe
//       Karte ebenfalls.
//   (c) die Reveal-Karte verschwindet in beiden Faellen wieder (kein Dauer-Overlay).
//   (d) fuer eine ANDERE Disziplin (Staffel, prim "track") erscheint NIE eine solche Karte --
//       Regressionsschutz: die neue Logik ist strikt auf stage beschraenkt.
//   (e) fuer Fechten (prim "lamps", Task #116, falls bereits auf diesem Checkout vorhanden)
//       erscheint NIE die "✨ VS"-Karte (nur dessen eigene "⚔ VS"-Karte) -- Regressionsschutz,
//       dass sich die beiden Primitive-Codepfade nicht ueberschneiden.
import { chromium } from "playwright";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

async function pruefeDisziplin(browser, select) {
  const seite = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(`${BASE}/dev-arena`, { waitUntil: "networkidle" });
  await seite.selectOption('[data-testid="prim-select"]', select);
  await seite.waitForTimeout(150);

  let karteGesehen = false;
  let karteWiederWeg = false;
  let kartenText = "";
  const start = Date.now();
  // Erst starten (▶), dann bis zu ~14s beobachten -- die Reveal-Karte steht je Block nur
  // STAGE_REVEAL_MS (1,3s), reicht aber fuer mehrere Paare/Bloecke in diesem Fenster.
  const startBtn = seite.getByRole("button", { name: /▶/ }).first();
  if (await startBtn.count()) await startBtn.click().catch(() => {});

  while (Date.now() - start < 14000) {
    const snap = await seite.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll("div"));
      const hit = nodes.find((n) => n.textContent?.includes("✨ VS"));
      return { sichtbar: Boolean(hit), text: hit?.textContent ?? "" };
    });
    if (snap.sichtbar) {
      karteGesehen = true;
      kartenText = snap.text;
    }
    if (karteGesehen && !snap.sichtbar) karteWiederWeg = true;
    if (karteGesehen && karteWiederWeg) break;
    await seite.waitForTimeout(150);
  }

  await seite.close();
  return { karteGesehen, karteWiederWeg, kartenText, fehler };
}

let alleOk = true;
const browser = await chromium.launch(process.env.CI ? {} : (await import("node:fs")).existsSync(fest) ? { executablePath: fest } : {});
try {
  const showcase = await pruefeDisziplin(browser, "showcase");
  console.log(`(a) Showcase: Matchup-Reveal-Karte gesehen: ${showcase.karteGesehen} -> ${showcase.karteGesehen ? "OK" : "FEHLER"}`);
  if (!showcase.karteGesehen) alleOk = false;
  console.log(`(c) Showcase: Karte verschwindet wieder (kein Dauer-Overlay): ${showcase.karteWiederWeg} -> ${showcase.karteWiederWeg ? "OK" : "FEHLER"}`);
  if (!showcase.karteWiederWeg) alleOk = false;
  console.log(`(d) Showcase: Seitenfehler: ${showcase.fehler.length === 0 ? "keine" : showcase.fehler.join(" | ")} -> ${showcase.fehler.length === 0 ? "OK" : "FEHLER"}`);
  if (showcase.fehler.length !== 0) alleOk = false;

  const eiskunst = await pruefeDisziplin(browser, "eiskunstlauf");
  console.log(`(b) Eiskunstlauf: Matchup-Reveal-Karte gesehen: ${eiskunst.karteGesehen} -> ${eiskunst.karteGesehen ? "OK" : "FEHLER"}`);
  if (!eiskunst.karteGesehen) alleOk = false;
  console.log(`(c) Eiskunstlauf: Karte verschwindet wieder (kein Dauer-Overlay): ${eiskunst.karteWiederWeg} -> ${eiskunst.karteWiederWeg ? "OK" : "FEHLER"}`);
  if (!eiskunst.karteWiederWeg) alleOk = false;
  console.log(`(d) Eiskunstlauf: Seitenfehler: ${eiskunst.fehler.length === 0 ? "keine" : eiskunst.fehler.join(" | ")} -> ${eiskunst.fehler.length === 0 ? "OK" : "FEHLER"}`);
  if (eiskunst.fehler.length !== 0) alleOk = false;

  const staffel = await pruefeDisziplin(browser, "staffel");
  console.log(`(d) Staffel (track, Regressionsschutz): Matchup-Reveal-Karte NIE gesehen: ${!staffel.karteGesehen} -> ${!staffel.karteGesehen ? "OK" : "FEHLER"}`);
  if (staffel.karteGesehen) alleOk = false;
  console.log(`(d) Staffel: Seitenfehler: ${staffel.fehler.length === 0 ? "keine" : staffel.fehler.join(" | ")} -> ${staffel.fehler.length === 0 ? "OK" : "FEHLER"}`);
  if (staffel.fehler.length !== 0) alleOk = false;

  const fechten = await pruefeDisziplin(browser, "fechten");
  console.log(`(e) Fechten (lamps, Regressionsschutz): "✨ VS"-Karte NIE gesehen: ${!fechten.karteGesehen} -> ${!fechten.karteGesehen ? "OK" : "FEHLER"}`);
  if (fechten.karteGesehen) alleOk = false;
  console.log(`(d) Fechten: Seitenfehler: ${fechten.fehler.length === 0 ? "keine" : fechten.fehler.join(" | ")} -> ${fechten.fehler.length === 0 ? "OK" : "FEHLER"}`);
  if (fechten.fehler.length !== 0) alleOk = false;
} finally {
  await browser.close();
}

console.log(`\n=== GESAMT: ${alleOk ? "ALLE PRUEFUNGEN BESTANDEN" : "MINDESTENS EINE PRUEFUNG FEHLGESCHLAGEN"} ===`);
process.exit(alleOk ? 0 : 1);
