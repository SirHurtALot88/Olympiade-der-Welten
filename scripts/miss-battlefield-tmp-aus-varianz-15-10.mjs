// ===================================================================================
// REALKAMPF-VARIANZVERGLEICH BATTLEFIELD, TMP/AUS-MISCHFAKTOR (15.10.)
//
// Punkt 2 des Auftrags aus docs/design/tmp-aus-pp-chassis-diagnose-15-10.md Abschnitt 5:
// serieVon("battlefield", n) ueber MEHRERE echte Paarungen (data/generated/
// kaderfamilie-live-save.json, 5 Paarungen aus dem live-save, nicht nur V-W/A-A) bei
// alpha in {0,1}, und falls kein Blowout, zusaetzlich bei einem Zwischenwert.
//
// Braucht den temporaeren Messhaken in aufEignung() (window.__TMP_AUS_ALPHA, additiv,
// Default 0 -> bit-identisch) -- NICHT Teil eines etwaigen Builds, nur dieser Messrunde.
//
//   node scripts/miss-battlefield-tmp-aus-varianz-15-10.mjs [laeufe] [alpha ...]
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";

const hier = dirname(fileURLToPath(import.meta.url));
const seite = resolve(hier, "..", "public", "mockups", "battle-mode.html");
const kaderfamilieDatei = resolve(hier, "..", "data", "generated", "kaderfamilie-live-save.json");

const laeufe = Number.parseInt(process.argv[2] ?? "24", 10);
const alphaListe = (process.argv.slice(3).length ? process.argv.slice(3) : ["0", "1"]).map(Number);

const roh = JSON.parse(readFileSync(kaderfamilieDatei, "utf8"));
const paarungen = roh.varianten.map((v) => ({ label: v.label, heim: v.heim, gast: v.gast }));

const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(
  { executablePath: fest }
);

function varianz(werte) {
  const m = werte.reduce((a, b) => a + b, 0) / werte.length;
  return werte.reduce((a, b) => a + (b - m) ** 2, 0) / werte.length;
}

try {
  const seiteImBrowser = await browser.newPage();
  const fehler = [];
  seiteImBrowser.on("pageerror", (e) => fehler.push(String(e)));
  await seiteImBrowser.goto(pathToFileURL(seite).href);
  await seiteImBrowser.waitForFunction(() => Boolean(window.__arena), null, { timeout: 15000 });

  for (const alpha of alphaListe) {
    console.log(`\n=== alpha = ${alpha} ===`);
    await seiteImBrowser.evaluate((a) => { window.__TMP_AUS_ALPHA = a; }, alpha);
    for (const p of paarungen) {
      const r = await seiteImBrowser.evaluate(
        ([heim, gast, n]) => {
          window.__arena.kaderSetzen({ heim, gast });
          return window.__arena.serieVon("battlefield", n);
        },
        [p.heim, p.gast, laeufe],
      );
      const diffe = r.ergebnisse.map(([e]) => {
        const [l, g] = e.split(":").map(Number);
        return l - g;
      });
      // Jedes Ergebnis "l:g" so oft wie in r.ergebnisse angegeben -> fuer die Varianz
      // ueber ALLE Laeufe (nicht nur ueber die verschiedenen Endstaende) braucht es die
      // Haeufigkeiten mit.
      const alleDiffe = [];
      r.ergebnisse.forEach(([e, n]) => {
        const [l, g] = e.split(":").map(Number);
        for (let i = 0; i < n; i++) alleDiffe.push(l - g);
      });
      const verschiedene = r.ergebnisse.length;
      const haeufigsterAnteil = Math.max(...r.ergebnisse.map(([, n]) => n)) / laeufe;
      console.log(
        `  ${p.label.padEnd(32)} Siegquote ${String(r.siegquote).padStart(3)}%  ` +
        `Endstaende: ${r.ergebnisse.map(([e, n]) => `${e}(${n}x)`).join(", ")}  ` +
        `[verschieden ${verschiedene}/${laeufe}, haeufigster ${(haeufigsterAnteil * 100).toFixed(0)}%, ` +
        `Varianz(Diff) ${varianz(alleDiffe).toFixed(1)}]`,
      );
    }
  }

  if (fehler.length) {
    console.error("Seitenfehler:\n  " + fehler.join("\n  "));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
