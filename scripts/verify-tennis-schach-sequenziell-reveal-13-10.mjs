// VERIFIKATION TASKS #126/#127 (Tennis/Schach sequenziell/Reveal, Chris 13.10. — docs/design/
// chris-feedback-breite-runde-13-10.md Abschnitt "Tennis" Punkt 25 / "Schach" Punkt 26): prueft
// auf der ECHTEN Spieltags-Buehne (DisciplineStageNativeArena ueber /dev-arena), NICHT dem alten
// Battle-Arena-Motor (public/mockups/battle-mode.html) -- genau die Unterscheidung, die die
// Aufgabe verlangt. Analog zu scripts/verify-fechten-sequenziell-reveal-13-10.mjs (Task #116),
// hier fuer das geteilte `"klassen"`-Primitive (Tennis UND Speed-Schach):
//
//   (a) fuer Tennis UND Speed-Schach (prim "klassen") erscheint vor einem Board-Paar eine
//       Matchup-Reveal-Karte ("wer gegen wen" + Eignung) -- mindestens einmal waehrend des
//       Durchlaufs, fuer BEIDE Disziplinen einzeln geprueft.
//   (b) die Reveal-Karte verschwindet wieder (kein Dauer-Overlay) und das Feld laeuft weiter.
//   (c) fuer eine ANDERE, nicht betroffene Disziplin (Staffel, prim "track") erscheint NIE eine
//       solche Karte -- Regressionsschutz: die neue Logik ist strikt auf klassen beschraenkt.
//   (d) keine Seitenfehler (pageerror) in allen Laeufen.
import { chromium } from "playwright";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

async function pruefeDisziplin(browser, { select }) {
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
  // KLASSEN_REVEAL_MS (1,1s), reicht aber fuer mehrere Paare in diesem Fenster.
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
  for (const { select, label } of [
    { select: "tennis", label: "Tennis" },
    { select: "speed-schach", label: "Speed-Schach" },
  ]) {
    const r = await pruefeDisziplin(browser, { select });
    console.log(`(a) ${label}: Matchup-Reveal-Karte gesehen: ${r.karteGesehen} -> ${r.karteGesehen ? "OK" : "FEHLER"}`);
    if (!r.karteGesehen) alleOk = false;
    console.log(`(b) ${label}: Karte verschwindet wieder (kein Dauer-Overlay): ${r.karteWiederWeg} -> ${r.karteWiederWeg ? "OK" : "FEHLER"}`);
    if (!r.karteWiederWeg) alleOk = false;
    console.log(`(d) ${label}: Seitenfehler: ${r.fehler.length === 0 ? "keine" : r.fehler.join(" | ")} -> ${r.fehler.length === 0 ? "OK" : "FEHLER"}`);
    if (r.fehler.length !== 0) alleOk = false;
  }

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
