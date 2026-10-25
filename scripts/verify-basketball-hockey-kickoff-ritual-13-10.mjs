// VERIFIKATION TASKS #21/#24a (Basketball-Sprungball/Eishockey-Bully, Chris 13.10. — docs/design/
// chris-feedback-breite-runde-13-10.md Abschnitt "Basketball" Punkt 21 / "Eishockey" Punkt 24):
// prueft auf der ECHTEN Spieltags-Buehne (DisciplineStageNativeArena ueber /dev-arena), NICHT dem
// alten Battle-Arena-Motor (public/mockups/battle-mode.html) -- genau die Unterscheidung, die die
// Aufgabe verlangt. Analog zu scripts/verify-tennis-schach-sequenziell-reveal-13-10.mjs
// (Tasks #126/#127) und scripts/verify-fechten-sequenziell-reveal-13-10.mjs (Task #116):
//
//   (a) Basketball (prim "court") zeigt vor dem allerersten Reveal eine Sprungball-Karte
//       ("🏀 SPRUNGBALL") mit zwei Spielern.
//   (b) Eishockey (prim "rink") zeigt vor dem allerersten Reveal eine Bully-Karte ("🏒 BULLY")
//       mit zwei Spielern.
//   (c) Beide Karten verschwinden wieder (kein Dauer-Overlay) und das Feld laeuft danach weiter
//       (round steigt auf 1).
//   (d) Football (prim "parcours", ausdruecklich NICHT Teil dieses Auftrags, Punkt 23) und
//       Staffel (prim "track", Regressionsschutz) zeigen NIE eine Sprungball-/Bully-Karte.
//   (e) keine Seitenfehler (pageerror) in allen Laeufen.
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
  let karteHatteZweiSpieler = false;
  const start = Date.now();
  const startBtn = seite.getByRole("button", { name: /▶/ }).first();
  if (await startBtn.count()) await startBtn.click().catch(() => {});

  // Das Ritual steht KICKOFF_RITUAL_MS (1,6s) -- Fenster grosszuegig auf ~8s, um die Karte
  // sicher zu fangen UND verschwinden zu sehen.
  while (Date.now() - start < 8000) {
    const probe = await seite.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll("div"));
      // Das Label (🏀 SPRUNGBALL / 🏒 BULLY) sitzt auf einem Blatt-<div> ohne weitere Kind-
      // Elemente -- GENAU dieses Element suchen (statt des ersten Treffers in DOM-Reihenfolge,
      // der sonst ein Vorfahre mit viel fremdem Text ist, z.B. der Seiten-Root). Von dort zwei
      // Ebenen hoch zum Karten-Container, dessen Text die "vs"-Trennzeile zwischen den beiden
      // Seiten trägt (Beleg für zwei Seiten -- Mock-Spieler ohne portraitUrl rendern PlayerMark
      // als reinen Platzhalter-<span>, kein img/svg, daher kein Bild-Count als Beleg).
      const label = nodes.find((n) => n.children.length === 0 && (n.textContent === "🏀 SPRUNGBALL" || n.textContent === "🏒 BULLY"));
      if (!label) return { sichtbar: false, spieler: 0 };
      // Playwright/JSDOM haengen Kind-Texte ohne Whitespace zusammen (z.B. "FalkvsSC"), daher
      // reine Teilstring-Suche statt \b-Regex (das "vs" steht garantiert zwischen den beiden
      // Spieler-Blöcken, s. JSX -- kein anderer Text in dieser Karte enthaelt "vs").
      const karte = label.parentElement;
      const spieler = (karte?.textContent ?? "").includes("vs") ? 2 : 0;
      return { sichtbar: true, spieler };
    });
    if (probe.sichtbar) {
      karteGesehen = true;
      if (probe.spieler >= 2) karteHatteZweiSpieler = true;
    }
    if (karteGesehen && !probe.sichtbar) karteWiederWeg = true;
    if (karteGesehen && karteWiederWeg) break;
    await seite.waitForTimeout(100);
  }

  // Reveal-Cascade fuer 2 Teams braucht ueber den Kickoff hinaus noch ~10s (TRACK_ROUND_MS/2
  // je Team) -- bis zu 14s auf den Rundenwechsel warten, statt auf ein zu kurzes Fenster zu
  // vertrauen.
  let roundLabel = null;
  const roundStart = Date.now();
  while (Date.now() - roundStart < 14000) {
    roundLabel = await seite.evaluate(() => document.body.textContent?.match(/Etappe\s+(\d+)\s*\/\s*\d+/)?.[1] ?? null);
    if (roundLabel && Number(roundLabel) > 1) break;
    await seite.waitForTimeout(200);
  }

  await seite.close();
  if (erwarteKarte) {
    return { karteGesehen, karteWiederWeg, karteHatteZweiSpieler, roundLabel, fehler };
  }
  return { karteGesehen, fehler };
}

let alleOk = true;
const browser = await chromium.launch(process.env.CI ? {} : (await import("node:fs")).existsSync(fest) ? { executablePath: fest } : {});
try {
  for (const { select, label } of [
    { select: "basketball", label: "Basketball (🏀 SPRUNGBALL)" },
    { select: "hockey", label: "Eishockey (🏒 BULLY)" },
  ]) {
    const r = await pruefeDisziplin(browser, { select, erwarteKarte: true });
    console.log(`(a/b) ${label}: Karte gesehen: ${r.karteGesehen} -> ${r.karteGesehen ? "OK" : "FEHLER"}`);
    if (!r.karteGesehen) alleOk = false;
    console.log(`      ${label}: Karte zeigt 2 Spieler: ${r.karteHatteZweiSpieler} -> ${r.karteHatteZweiSpieler ? "OK" : "FEHLER"}`);
    if (!r.karteHatteZweiSpieler) alleOk = false;
    console.log(`(c)   ${label}: Karte verschwindet wieder: ${r.karteWiederWeg} -> ${r.karteWiederWeg ? "OK" : "FEHLER"}`);
    if (!r.karteWiederWeg) alleOk = false;
    console.log(`(c)   ${label}: Feld läuft danach weiter (Etappe > 1): ${r.roundLabel} -> ${r.roundLabel && Number(r.roundLabel) > 1 ? "OK" : "FEHLER"}`);
    if (!(r.roundLabel && Number(r.roundLabel) > 1)) alleOk = false;
    console.log(`(e)   ${label}: Seitenfehler: ${r.fehler.length === 0 ? "keine" : r.fehler.join(" | ")} -> ${r.fehler.length === 0 ? "OK" : "FEHLER"}`);
    if (r.fehler.length !== 0) alleOk = false;
  }

  for (const { select, label } of [
    { select: "football", label: "Football (parcours, NICHT Teil dieses Auftrags, Punkt 23)" },
    { select: "staffel", label: "Staffel (track, Regressionsschutz)" },
  ]) {
    const r = await pruefeDisziplin(browser, { select, erwarteKarte: false });
    console.log(`(d) ${label}: Sprungball-/Bully-Karte NIE gesehen: ${!r.karteGesehen} -> ${!r.karteGesehen ? "OK" : "FEHLER"}`);
    if (r.karteGesehen) alleOk = false;
    console.log(`(e) ${label}: Seitenfehler: ${r.fehler.length === 0 ? "keine" : r.fehler.join(" | ")} -> ${r.fehler.length === 0 ? "OK" : "FEHLER"}`);
    if (r.fehler.length !== 0) alleOk = false;
  }
} finally {
  await browser.close();
}

console.log(`\n=== GESAMT: ${alleOk ? "ALLE PRUEFUNGEN BESTANDEN" : "MINDESTENS EINE PRUEFUNG FEHLGESCHLAGEN"} ===`);
process.exit(alleOk ? 0 : 1);
