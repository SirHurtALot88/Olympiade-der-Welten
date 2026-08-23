// Misst die Battle Arena ueber eine SERIE von Kaempfen statt ueber einen.
//
// Ein einzelner Kampf mit festem Startwert ist ein Wurf: er sagt, was DIESES Mal
// passiert ist, nicht was der Fall ist. Zwei Zahlen aus zwei Einzelkaempfen zu
// vergleichen heisst, Rauschen mit Rauschen zu vergleichen. Deshalb laeuft hier
// eine Serie, und deshalb summiert sie die Skill-Kennzahlen ueber alle Laeufe.
//
// Aufruf (aus dem Repo-Wurzelverzeichnis, sonst findet node "playwright" nicht):
//   node scripts/miss-arena-serie.mjs [anzahl]
//
// Ausgegeben werden:
//   - Siegquote und mittlere Kampfdauer
//   - Leistung je Spieler in Prozent (100 % = Feldmittel)
//   - je Skill: Wirkungen, Ziele je Wirkung, wie lange er einsatzbereit gewartet
//     hat (Aufsparen), und wie oft die Wahl knapp war ("eng", unter 10 % Abstand)
//   - die statische Nutzwert-Tabelle: Nutzen je Sekunde aus der Wechselkurstabelle.
//     Reisst hier ein Skill nach oben aus, ist er OP — und zwar bevor jemand spielt.

import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const hier = dirname(fileURLToPath(import.meta.url));
const seite = resolve(hier, "..", "public", "mockups", "battle-mode.html");
if (!existsSync(seite)) {
  console.error("Mockup nicht gefunden: " + seite);
  process.exit(1);
}

const laeufe = Number.parseInt(process.argv[2] ?? "24", 10);
if (!Number.isFinite(laeufe) || laeufe < 1) {
  console.error("Anzahl muss eine positive Zahl sein.");
  process.exit(1);
}

// Der Browser ist im Image vorinstalliert; ohne Pfad sucht Playwright im
// Home-Verzeichnis und laedt nach. PLAYWRIGHT_BROWSERS_PATH deckt den Normalfall,
// der feste Pfad den Fall, dass die Umgebungsvariable fehlt.
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});

try {
  const seiteImBrowser = await browser.newPage();
  const fehler = [];
  seiteImBrowser.on("pageerror", (e) => fehler.push(String(e)));
  await seiteImBrowser.goto(pathToFileURL(seite).href);
  await seiteImBrowser.waitForFunction(() => Boolean(window.__arena), null, { timeout: 15000 });

  const ergebnis = await seiteImBrowser.evaluate((n) => {
    const serie = window.__arena.serie(n);
    return { serie, nutzwert: window.__arena.nutzwert() };
  }, laeufe);

  if (fehler.length) {
    console.error("Seitenfehler:\n  " + fehler.join("\n  "));
    process.exitCode = 1;
  }

  const s = ergebnis.serie;
  console.log(`Serie ueber ${s.laeufe} Kaempfe — Siegquote ${s.siegquote} %, im Mittel ${s.dauer} s`);
  console.log("Ergebnisse: " + s.ergebnisse.map(([e, n]) => `${e} (${n}x)`).join(", "));

  console.log("\nLeistung je Spieler (100 % = Feldmittel)");
  for (const r of s.reihen) {
    console.log(`  ${String(r.leist + " %").padStart(6)}  ${r.n}${r.seite === 1 ? " (Gegner)" : ""}`);
  }

  console.log("\nSkills");
  const skills = Object.entries(s.skills).sort((a, b) => b[1].n - a[1].n);
  for (const [id, m] of skills) {
    const zieleJe = m.n ? (m.ziele / m.n).toFixed(2) : "0.00";
    const wartete = m.n ? (m.bereit / m.n).toFixed(1) : "0.0";
    console.log(`  ${id.padEnd(16)} ${String(m.n).padStart(5)}x  ${zieleJe} Ziele/Wirkung  ` +
      `${wartete}s einsatzbereit gewartet  ${m.eng} knappe Wahl`);
  }
  const ungenutzt = ergebnis.nutzwert.filter((x) => !s.skills[x.id]).map((x) => x.id);
  if (ungenutzt.length) {
    // Ein Skill, den nie jemand wirkt, ist nicht geprueft — untestet ist nicht dasselbe
    // wie richtig. Das gehoert in die Ausgabe, nicht ins Schweigen.
    console.log("  OHNE TRAEGER (in keinem Kampf gewirkt): " + ungenutzt.join(", "));
  }

  console.log("\nNutzwert je Sekunde (statisch, aus der Wechselkurstabelle)");
  const nutz = [...ergebnis.nutzwert].sort((a, b) => b.jeSekunde - a.jeSekunde);
  for (const x of nutz) {
    console.log(`  ${x.jeSekunde.toFixed(1).padStart(5)}/s  ${x.name.padEnd(28)} ` +
      `Wert ${x.wert.toFixed(1)} / ${x.zeit.toFixed(1)}s  [${x.teile.join(", ")}]`);
  }
  if (nutz.length > 1) {
    const spanne = nutz[0].jeSekunde / Math.max(nutz[nutz.length - 1].jeSekunde, 0.01);
    console.log(`  Spanne staerkster zu schwaechstem: Faktor ${spanne.toFixed(1)}`);
  }
} finally {
  await browser.close();
}
