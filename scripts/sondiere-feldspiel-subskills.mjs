// ===================================================================================
// WAS WIEGT EIN SUB-SKILL IM MOTOR WIRKLICH? — die Sondierung.
//
// Ein Rezept verteilt Attribute auf Sub-Skills. Damit die Disziplinmatrix aufgeht, muss
// man aber wissen, wie viel jeder SUB-SKILL mechanisch traegt: ein Rezept, das 30 % des
// Attributbudgets auf einen Sub-Skill legt, der im Motor gar nichts bewirkt, verschenkt
// diese 30 %.
//
// MESSVERFAHREN (dasselbe, mit dem Basketballs Rezept entstanden ist, s. dessen
// Kommentare in battle-mode.rezepte.js): ein ORTHOGONALES Rezept, in dem jeder Sub-Skill
// von genau EINEM Attribut gespeist wird und kein Attribut zweimal vorkommt. Hebt man
// dann ein Attribut an, kann sich NUR sein eigener Sub-Skill bewegen — der gemessene
// Einflussanteil des Attributs IST also das mechanische Gewicht seines Sub-Skills.
//
//   node scripts/sondiere-feldspiel-subskills.mjs hockey [laeufe]
//
// Das Skript fasst den Arbeitsbaum NICHT an: es kopiert Mockup, Motor und Rezepte in ein
// temporaeres Verzeichnis, schreibt das orthogonale Rezept nur dort hinein und misst die
// Kopie. Ein abgebrochener Lauf kann deshalb nichts hinterlassen.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdtempSync, copyFileSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DISZIPLIN = process.argv[2] || "hockey";
const LAEUFE = Number(process.argv[3] || 24);
// Dritter Aufrufwert: die Zuordnung Sub-Skill zu Traeger-Attribut um n Stellen drehen.
// Kein Luxus, sondern die Gegenprobe: liest ein Sub-Skill nur deshalb null, weil sein
// Traeger-Attribut zufaellig eines ist, das die Einflussmessung nicht abdeckt, faellt das
// erst auf, wenn er ein anderes bekommt. Zwei Laeufe mit verschiedenem Versatz muessen
// dieselbe Rangfolge liefern.
const VERSATZ = Number(process.argv[4] || 0);

// Reihenfolge egal, nur die Eindeutigkeit zaehlt: jedes Attribut hoechstens einmal.
const ATTRIBUTE = ["power", "health", "speed", "spirit", "stamina", "torment",
  "awareness", "determination", "dexterity", "will", "intelligence", "charisma"];

const ordner = mkdtempSync(path.join(tmpdir(), "sondierung-"));
try {
  for (const d of ["battle-mode.html", "battle-mode.engine.js", "battle-mode.rezepte.js"])
    copyFileSync(path.join(WURZEL, "public/mockups", d), path.join(ordner, d));

  // Sub-Skills der Disziplin aus dem echten Rezept lesen — nicht aus einer festen Liste.
  const rezepteQuelle = readFileSync(path.join(ordner, "battle-mode.rezepte.js"), "utf8");
  const block = rezepteQuelle.match(new RegExp(`\\n  ${DISZIPLIN}:\\{([\\s\\S]*?)\\n  \\}`));
  if (!block) throw new Error(`Kein Rezept fuer "${DISZIPLIN}" in battle-mode.rezepte.js gefunden.`);
  const subskills = [...block[1].matchAll(/^\s{4}([A-Z_]+):\s*\{/gm)].map((m) => m[1]);
  if (subskills.length > ATTRIBUTE.length)
    throw new Error(`${subskills.length} Sub-Skills, aber nur ${ATTRIBUTE.length} Attribute — nicht orthogonal moeglich.`);

  const zuordnung = Object.fromEntries(subskills.map((s, i) => [s, ATTRIBUTE[(i + VERSATZ) % ATTRIBUTE.length]]));
  const orthogonal = "\n  " + DISZIPLIN + ":{\n" +
    subskills.map((s) => `    ${s}: {${zuordnung[s]}:100}`).join(",\n") + "\n  }";
  writeFileSync(path.join(ordner, "battle-mode.rezepte.js"),
    rezepteQuelle.replace(block[0], orthogonal), "utf8");

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(pathToFileURL(path.join(ordner, "battle-mode.html")).href, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena, null, { timeout: 30000 });

  const start = Date.now();
  const e = await seite.evaluate(([d, n]) => window.__arena.einflussVon(d, n), [DISZIPLIN, LAEUFE]);
  const dauer = ((Date.now() - start) / 1000).toFixed(0);
  await browser.close();

  const anteilVon = Object.fromEntries(e.reihen.map((r) => [r.attribut, r.anteil]));
  const zeilen = subskills
    .map((s) => ({ s, attribut: zuordnung[s], gewicht: anteilVon[zuordnung[s]] ?? 0 }))
    .sort((a, b) => b.gewicht - a.gewicht);

  console.log(`Sondierung ${DISZIPLIN} — ${LAEUFE} Laeufe, ${dauer}s, orthogonales Rezept\n`);
  console.log("Sub-Skill        Traeger-Attribut   mechanisches Gewicht");
  for (const z of zeilen)
    console.log(`${z.s.padEnd(16)} ${z.attribut.padEnd(18)} ${String(z.gewicht).padStart(6)} %`);
  const summe = zeilen.reduce((a, z) => a + z.gewicht, 0);
  console.log(`\nSumme ${summe.toFixed(1)} % (der Rest faellt auf Attribute ohne Sub-Skill).`);
  console.log(`Seitenfehler: ${fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"}`);
} finally {
  rmSync(ordner, { recursive: true, force: true });
}
