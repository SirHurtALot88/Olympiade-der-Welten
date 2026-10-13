// VERIFIKATION TASK #116 (Fechten sequenziell/Reveal, Chris 13.10. — docs/design/
// chris-feedback-breite-runde-13-10.md Abschnitt "Fechten" Punkt 15): prueft auf der ECHTEN
// Spieltags-Buehne (DisciplineStageNativeArena ueber /dev-arena), NICHT dem alten
// Battle-Arena-Motor (public/mockups/battle-mode.html) -- genau die Unterscheidung, die die
// Aufgabe verlangt:
//
//   (a) fuer Fechten (prim "lamps") erscheint vor einem Gefecht-Paar eine Matchup-Reveal-Karte
//       ("wer gegen wen" + Eignung) -- mindestens einmal waehrend des Durchlaufs.
//   (b) die Reveal-Karte verschwindet wieder (kein Dauer-Overlay) und das Feld laeuft weiter.
//   (c) fuer eine ANDERE Disziplin (Staffel, prim "track") erscheint NIE eine solche Karte --
//       Regressionsschutz: die neue Logik ist strikt auf lamps beschraenkt.
//   (d) keine Seitenfehler (pageerror) in beiden Laeufen.
import { chromium } from "playwright";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

async function pruefeDisziplin(browser, { select, erwarteKarte }) {
  const seite = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(`${BASE}/dev-arena`, { waitUntil: "networkidle" });
  await seite.selectOption('[data-testid="prim-select"]', select);
  await seite.waitForTimeout(150);

  let karteGesehen = false;
  let karteWiederWeg = false;
  const start = Date.now();
  // Erst starten (▶), dann bis zu ~12s beobachten -- die Reveal-Karte steht je Paar nur
  // FECHT_REVEAL_MS (1,1s), reicht aber fuer mehrere Paare in diesem Fenster.
  const startBtn = seite.getByRole("button", { name: /▶/ }).first();
  if (await startBtn.count()) await startBtn.click().catch(() => {});

  while (Date.now() - start < 12000) {
    const sichtbar = await seite.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll("div"));
      return nodes.some((n) => n.textContent?.includes("⚔ VS"));
    });
    if (sichtbar) karteGesehen = true;
    if (karteGesehen && !sichtbar) karteWiederWeg = true;
    if (karteGesehen && karteWiederWeg) break;
    await seite.waitForTimeout(150);
  }

  await seite.close();
  return { karteGesehen, karteWiederWeg, fehler };
}

let alleOk = true;
const browser = await chromium.launch(process.env.CI ? {} : (await import("node:fs")).existsSync(fest) ? { executablePath: fest } : {});
try {
  const fecht = await pruefeDisziplin(browser, { select: "fechten" });
  console.log(`(a) Fechten: Matchup-Reveal-Karte gesehen: ${fecht.karteGesehen} -> ${fecht.karteGesehen ? "OK" : "FEHLER"}`);
  if (!fecht.karteGesehen) alleOk = false;
  console.log(`(b) Fechten: Karte verschwindet wieder (kein Dauer-Overlay): ${fecht.karteWiederWeg} -> ${fecht.karteWiederWeg ? "OK" : "FEHLER"}`);
  if (!fecht.karteWiederWeg) alleOk = false;
  console.log(`(d) Fechten: Seitenfehler: ${fecht.fehler.length === 0 ? "keine" : fecht.fehler.join(" | ")} -> ${fecht.fehler.length === 0 ? "OK" : "FEHLER"}`);
  if (fecht.fehler.length !== 0) alleOk = false;

  const staffel = await pruefeDisziplin(browser, { select: "staffel" });
  console.log(`(c) Staffel (track, Regressionsschutz): Matchup-Reveal-Karte NIE gesehen: ${!staffel.karteGesehen} -> ${!staffel.karteGesehen ? "OK" : "FEHLER"}`);
  if (staffel.karteGesehen) alleOk = false;
  console.log(`(d) Staffel: Seitenfehler: ${staffel.fehler.length === 0 ? "keine" : staffel.fehler.join(" | ")} -> ${staffel.fehler.length === 0 ? "OK" : "FEHLER"}`);
  if (staffel.fehler.length !== 0) alleOk = false;
} finally {
  await browser.close();
}

console.log(`\n=== GESAMT: ${alleOk ? "ALLE PRUEFUNGEN BESTANDEN" : "MINDESTENS EINE PRUEFUNG FEHLGESCHLAGEN"} ===`);
process.exit(alleOk ? 0 : 1);
