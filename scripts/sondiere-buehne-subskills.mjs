// ===================================================================================
// WAS WIEGT EINE BUEHNEN-UNTERFERTIGKEIT IM MOTOR WIRKLICH? — das Buehnen-Gegenstueck zu
// scripts/sondiere-feldspiel-subskills.mjs, fuer die neun Buehnen-Disziplinen (Tennis,
// Fechten, Gewichtheben, Speed-Schach, Breaking, Showcase, Wettessen, Eiskunstlauf, I-Spy).
//
// SELBES MESSVERFAHREN wie beim Feldspiel: ein ORTHOGONALES Rezept, in dem jede
// Unterfertigkeit von genau EINEM Attribut gespeist wird und kein Attribut zweimal
// vorkommt. Hebt man dann ein Attribut an, kann sich NUR seine eigene Unterfertigkeit
// bewegen — der gemessene Einflussanteil des Attributs IST also das mechanische Gewicht
// seiner Unterfertigkeit. Gemessen wird ueber `window.__arena.einflussVon(d,n)` — dieselbe
// Funktion, die MOTOREN[dId].bau()/.wert() tatsaechlich durchlaeuft, also voellig
// unabhaengig davon, ob die Disziplin ueber den generischen Durchgangs-Rechner
// (bauBuehne()), ueber Heben (baueHebenDuelle()), ueber den Gauntlet (baueGauntlet()) oder
// ueber die Schatzsuche (baueSchatzsuche()) laeuft — anders als
// scripts/kalibriere-buehne-rezept.mjs, dessen Nachbildung bauBuehne() Zeichen fuer
// Zeichen kopiert und `heben:true` deshalb ausdruecklich ABLEHNT, lehnt diese Sondierung
// NICHTS ab: `einflussVon()` fragt nur nach `MOTOREN[dId].wert()`, nicht nach der
// Nachbildung. Nachgemessen (s. PR-Beschreibung): laeuft fuer alle neun durch, Gewichtheben
// eingeschlossen.
//
// WARUM EIN EIGENES SKRIPT STATT scripts/sondiere-feldspiel-subskills.mjs DIREKT
// AUFZURUFEN: dieses Skript laeuft bereits heute fuer eine Buehnen-Disziplin durch (sein
// "Chassis-Eintrag"-Fallzweig fuer Disziplinen ohne battle-mode.rezepte.js-Eintrag findet
// auch BUEHNE_ART-Bloecke) — ABER zwei Luecken wuerden stillschweigend falsche Ergebnisse
// liefern, statt sauber zu scheitern:
//   (a) Disziplin-IDs mit Bindestrich MUESSEN in einem JS-Objektliteral in Anfuehrungszeichen
//       stehen ("i-spy":{...}, "speed-schach":{...}) — die dortige Suche
//       (`\n    ${DISZIPLIN}:{`) erwartet das Muster OHNE Anfuehrungszeichen und findet dann
//       gar keinen Treffer (geprueft: wirft "Kein Rezept fuer i-spy" statt zu sondieren).
//   (b) die Suche laeuft ueber die GESAMTE Motor-Datei, nicht nur ueber BUEHNE_ART — bei
//       einem Namenszusammenstoss mit einer anderen Chassis-Tabelle (ARENA_ART/
//       FELDSPIEL_ART/BAHN_ART) waere das Ergebnis ein Zufallstreffer, kein gepruefter.
// Dieses Skript behebt beides: quote-tolerante Suche (dasselbe `"?..."?`-Muster wie
// scripts/kalibriere-buehne-rezept.mjs's liesMotor()) UND explizit nur innerhalb von
// `const BUEHNE_ART={...}` gesucht.
//
//   node scripts/sondiere-buehne-subskills.mjs tennis [laeufe]
//
// Das Skript fasst den Arbeitsbaum NICHT an: es kopiert Mockup und Motor in ein temporaeres
// Verzeichnis, schreibt das orthogonale Rezept nur dort in die BUEHNE_ART-Kopie und misst
// die Kopie. Ein abgebrochener Lauf kann deshalb nichts hinterlassen.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdtempSync, copyFileSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DISZIPLIN = process.argv[2] || "tennis";
const LAEUFE = Number(process.argv[3] || 24);
// Dritter Aufrufwert: dieselbe Versatz-Gegenprobe wie beim Feldspiel-Pendant (s. dessen
// Kopfkommentar) — zwei Laeufe mit verschiedenem Versatz muessen dieselbe Rangfolge liefern.
const VERSATZ = Number(process.argv[4] || 0);

const ATTRIBUTE = ["power", "health", "speed", "spirit", "stamina", "torment",
  "awareness", "determination", "dexterity", "will", "intelligence", "charisma"];

// Klammer-bewusster Blockfang — dieselbe Logik wie in scripts/kalibriere-buehne-rezept.mjs
// und scripts/sondiere-feldspiel-subskills.mjs.
function klammerBlock(quelle, von) {
  let tiefe = 0;
  for (let i = von; i < quelle.length; i++) {
    if (quelle[i] === "{") tiefe++;
    else if (quelle[i] === "}") { tiefe--; if (tiefe === 0) return quelle.slice(von, i + 1); }
  }
  throw new Error("Klammer nicht geschlossen ab Position " + von);
}

const ordner = mkdtempSync(path.join(tmpdir(), "buehne-sondierung-"));
try {
  for (const d of ["battle-mode.html", "battle-mode.engine.js", "battle-mode.rezepte.js"])
    copyFileSync(path.join(WURZEL, "public/mockups", d), path.join(ordner, d));

  const engineQuelle = readFileSync(path.join(ordner, "battle-mode.engine.js"), "utf8");

  // NUR innerhalb von BUEHNE_ART suchen (Luecke (b) oben) — quote-tolerant (Luecke (a)).
  const artIdx = engineQuelle.indexOf("const BUEHNE_ART={");
  if (artIdx < 0) throw new Error("const BUEHNE_ART={ nicht in battle-mode.engine.js gefunden.");
  const artBlock = klammerBlock(engineQuelle, artIdx + "const BUEHNE_ART=".length);
  const re = new RegExp(`\\n    "?${DISZIPLIN}"?:\\{`, "g");
  let m, discBlock = null, discStart = -1;
  while ((m = re.exec(artBlock))) {
    const kandidat = klammerBlock(artBlock, m.index + m[0].length - 1);
    if (kandidat.includes("rezept:{")) {
      discBlock = kandidat;
      discStart = artIdx + "const BUEHNE_ART=".length + m.index + m[0].length - 1;
      break;
    }
  }
  if (!discBlock) throw new Error(`"${DISZIPLIN}" ist keine Buehnen-Disziplin (kein BUEHNE_ART-Eintrag mit "rezept:{...}" gefunden).`);

  const ohneKommentare = discBlock.replace(/\/\/[^\n]*/g, "");
  const rezeptIdx = ohneKommentare.indexOf("rezept:{");
  const rezeptBlock = klammerBlock(ohneKommentare, rezeptIdx + "rezept:".length);
  const subskills = [...rezeptBlock.matchAll(/([A-Z_]+):\s*\{/g)].map((x) => x[1]);
  if (subskills.length === 0) throw new Error(`Kein Sub-Skill in "${DISZIPLIN}"s rezept:{...} gefunden.`);
  if (subskills.length > ATTRIBUTE.length)
    throw new Error(`${subskills.length} Unterfertigkeiten, aber nur ${ATTRIBUTE.length} Attribute — nicht orthogonal moeglich.`);

  // Originaltextstelle (MIT Kommentaren) des rezept-Felds fuer den Austausch in der Kopie —
  // dieselbe Technik wie liesMotor()/rezeptTextOrig in scripts/kalibriere-buehne-rezept.mjs.
  const rezeptIdxOrig = discBlock.indexOf("rezept:{");
  const rezeptBlockOrig = klammerBlock(discBlock, rezeptIdxOrig + "rezept:".length);

  const zuordnung = Object.fromEntries(subskills.map((s, i) => [s, ATTRIBUTE[(i + VERSATZ) % ATTRIBUTE.length]]));
  const orthogonalesRezept = "{\n" +
    subskills.map((s) => `        ${s}: {${zuordnung[s]}:100}`).join(",\n") + "\n      }";

  const engineQuelleNeu = engineQuelle.slice(0, discStart) +
    discBlock.replace(rezeptBlockOrig, orthogonalesRezept) +
    engineQuelle.slice(discStart + discBlock.length);
  writeFileSync(path.join(ordner, "battle-mode.engine.js"), engineQuelleNeu, "utf8");

  // Browser-Start robust gegen unterschiedliche Playwright-Installationen (derselbe
  // existsSync-Fallback wie motorMessung() in scripts/kalibriere-buehne-rezept.mjs).
  const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(pathToFileURL(path.join(ordner, "battle-mode.html")).href, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena, null, { timeout: 30000 });

  const start = Date.now();
  const e = await seite.evaluate(([d, n]) => window.__arena.einflussVon(d, n), [DISZIPLIN, LAEUFE]);
  const dauer = ((Date.now() - start) / 1000).toFixed(0);
  await browser.close();

  if (e.fehler) throw new Error(`einflussVon("${DISZIPLIN}") meldet: ${e.fehler} — kein Motor fuer diese Disziplin angemeldet?`);

  const anteilVon = Object.fromEntries(e.reihen.map((r) => [r.attribut, r.anteil]));
  const zeilen = subskills
    .map((s) => ({ s, attribut: zuordnung[s], gewicht: anteilVon[zuordnung[s]] ?? 0 }))
    .sort((a, b) => b.gewicht - a.gewicht);

  console.log(`Sondierung ${DISZIPLIN} — ${LAEUFE} Laeufe, ${dauer}s, orthogonales Rezept\n`);
  console.log("Unterfertigkeit  Traeger-Attribut   mechanisches Gewicht");
  for (const z of zeilen)
    console.log(`${z.s.padEnd(16)} ${z.attribut.padEnd(18)} ${String(z.gewicht).padStart(6)} %`);
  const summe = zeilen.reduce((a, z) => a + z.gewicht, 0);
  console.log(`\nSumme ${summe.toFixed(1)} % (der Rest faellt auf Attribute ohne Unterfertigkeit).`);
  console.log(`Seitenfehler: ${fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"}`);
} finally {
  rmSync(ordner, { recursive: true, force: true });
}
