#!/usr/bin/env node
// ENGINE-BILDER AUSLAGERN (Task #165, Performance-Paket 3 "Ladezeit", 16.11.).
//
// public/mockups/battle-mode.engine.js trug 532 eingebettete `data:image/png;base64,...`-Strings
// (15,1 MB Text, 14,2 MB davon in EINER Zeile) in genau zwei Tabellen: `SPRITES` (Arena-Blaetter,
// LPC-Grundsatz) und `B_SPRITES` (der Sprite-Baukasten samt Vollbild-Figuren). Beide werden nur an
// je EINER Stelle geladen (`for(const k in SPRITES){...im.src=...}` bzw. dasselbe fuer B_SPRITES),
// heute ueber `engineBild()` im Motor. Dieses Skript ersetzt jeden Wert durch einen Pfad RELATIV
// ZUR ENGINE-DATEI und legt die Bilder als einzelne Dateien ab:
//
//   - `engine-bilder/<sha256[0..12]>.png` (public/mockups/engine-bilder/): inhaltsadressiert, darf
//     deshalb `immutable` gecacht werden (next.config.ts). Gleiche Bilder (125 Doppel im Bestand)
//     liegen nur EINMAL dort.
//   - `../sprites/<pfad>.png#<sha256[0..12]>`: das Bild liegt byte-identisch schon unter
//     public/sprites/ (der Baukasten-Export public/sprites/baukasten/ u.a.) -> keine zweite Kopie.
//     Das Fragment haelt den Inhalts-Hash fest; `--pruefen` schlaegt an, sobald jemand die
//     Sprite-Datei aendert (der Motor saehe sonst stillschweigend ein anderes Bild).
//
// Aufrufe (alle idempotent):
//   node scripts/lagere-engine-bilder-aus.mjs              auslagern (data: -> Datei), verwaiste
//                                                          Dateien in engine-bilder/ entfernen
//   node scripts/lagere-engine-bilder-aus.mjs --einlagern  Rueckweg: jede Referenz wieder als
//                                                          data:-URI in die Engine (Dateien bleiben)
//   node scripts/lagere-engine-bilder-aus.mjs --pruefen    nur pruefen (CI, tests/engine-bilder-
//                                                          ausgelagert.test.ts), Exit 1 bei Befund
//   --ohne-sprite-abgleich                                 beim Auslagern NICHT gegen public/sprites
//                                                          abgleichen, alles nach engine-bilder/
//
// Wer kuenftig ein neues Blatt als data:-URI in SPRITES/B_SPRITES eintraegt (das alte Muster aus
// docs/design/neue-disziplin-assets.md), laesst danach einfach dieses Skript laufen.
// Reine Anzeige: die Simulation liest keine Bildpixel (Beleg: scripts/pruefe-wertung-fingerabdruck.mjs).

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ENGINE_DATEI = path.join(WURZEL, "public", "mockups", "battle-mode.engine.js");
export const BILD_ORDNER_NAME = "engine-bilder";
export const TABELLEN = ["SPRITES", "B_SPRITES"];
const DATA_PRAEFIX = "data:image/png;base64,";
const HASH_LAENGE = 12;

const inhaltsHash = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, HASH_LAENGE);

/**
 * Findet die Objektliterale `const <NAME>={...}` und liefert je Wert-String Position und Inhalt.
 * Die Tabellen bestehen nur aus `"schluessel": "wert"`-Paaren (doppelte Anfuehrungszeichen, keine
 * Escapes in den Werten) — der Scanner prueft das und bricht sonst laut ab, statt zu raten.
 */
export function findeTabellenWerte(quelltext) {
  const werte = [];
  for (const name of TABELLEN) {
    const kopf = new RegExp(`\\bconst ${name}=\\{`).exec(quelltext);
    if (!kopf) throw new Error(`lagere-engine-bilder-aus: Tabelle ${name} nicht gefunden.`);
    let i = kopf.index + kopf[0].length;
    let erwarteWert = false;
    let schluessel = null;
    for (;;) {
      const z = quelltext[i];
      if (z === undefined) throw new Error(`lagere-engine-bilder-aus: ${name} endet nicht.`);
      if (z === "}") break;
      if (z === '"') {
        const ende = quelltext.indexOf('"', i + 1);
        const inhalt = quelltext.slice(i + 1, ende);
        if (inhalt.includes("\\") || inhalt.includes("\n")) {
          throw new Error(`lagere-engine-bilder-aus: unerwarteter String in ${name} bei ${i}.`);
        }
        if (erwarteWert) {
          werte.push({ tabelle: name, start: i + 1, ende, wert: inhalt, schluessel });
        } else {
          schluessel = inhalt;
        }
        i = ende + 1;
        continue;
      }
      if (z === ":") erwarteWert = true;
      else if (z === ",") erwarteWert = false;
      else if (!/\s/.test(z)) throw new Error(`lagere-engine-bilder-aus: unerwartetes Zeichen '${z}' in ${name} bei ${i}.`);
      i++;
    }
  }
  return werte.sort((a, b) => a.start - b.start);
}

/** Referenz -> Pfad unter public/ (ohne Fragment) und erwarteter Hash (oder null). */
export function loeseReferenz(wert, engineDatei = ENGINE_DATEI) {
  const [rel, fragment] = wert.split("#");
  const datei = path.resolve(path.dirname(engineDatei), rel);
  const istEngineBild = rel.startsWith(BILD_ORDNER_NAME + "/");
  const erwartet = istEngineBild ? path.basename(rel, ".png") : fragment || null;
  return { datei, erwartet, istEngineBild };
}

function spriteIndex(publicOrdner) {
  const index = new Map();
  const wurzel = path.join(publicOrdner, "sprites");
  if (!existsSync(wurzel)) return index;
  const laufe = (ordner) => {
    for (const e of readdirSync(ordner, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(ordner, e.name);
      if (e.isDirectory()) laufe(p);
      else if (e.name.endsWith(".png")) {
        const h = createHash("sha256").update(readFileSync(p)).digest("hex");
        if (!index.has(h)) index.set(h, p);
      }
    }
  };
  laufe(wurzel);
  return index;
}

function ersetze(quelltext, werte, neu) {
  const teile = [];
  let pos = 0;
  for (const w of werte) {
    const ersatz = neu(w);
    if (ersatz === null) continue;
    teile.push(quelltext.slice(pos, w.start), ersatz);
    pos = w.ende;
  }
  teile.push(quelltext.slice(pos));
  return teile.join("");
}

export function auslagern({ engineDatei = ENGINE_DATEI, spriteAbgleich = true, log = console.log } = {}) {
  const quelltext = readFileSync(engineDatei, "utf8");
  const werte = findeTabellenWerte(quelltext);
  const mockups = path.dirname(engineDatei);
  const ordner = path.join(mockups, BILD_ORDNER_NAME);
  const index = spriteAbgleich ? spriteIndex(path.dirname(mockups)) : new Map();
  mkdirSync(ordner, { recursive: true });
  let neuGeschrieben = 0, ausSprites = 0, ausgelagert = 0;
  const neuText = ersetze(quelltext, werte, (w) => {
    if (!w.wert.startsWith("data:")) return null;
    if (!w.wert.startsWith(DATA_PRAEFIX)) throw new Error(`lagere-engine-bilder-aus: ${w.schluessel} ist kein PNG-data:-URI.`);
    const buf = Buffer.from(w.wert.slice(DATA_PRAEFIX.length), "base64");
    const vollHash = createHash("sha256").update(buf).digest("hex");
    const h = vollHash.slice(0, HASH_LAENGE);
    ausgelagert++;
    const vorhanden = index.get(vollHash);
    if (vorhanden) {
      ausSprites++;
      return path.relative(mockups, vorhanden).split(path.sep).join("/") + "#" + h;
    }
    const ziel = path.join(ordner, h + ".png");
    if (existsSync(ziel)) {
      if (!readFileSync(ziel).equals(buf)) throw new Error(`lagere-engine-bilder-aus: Hash-Kollision ${h}.`);
    } else {
      writeFileSync(ziel, buf);
      neuGeschrieben++;
    }
    return `${BILD_ORDNER_NAME}/${h}.png`;
  });
  if (neuText !== quelltext) writeFileSync(engineDatei, neuText);
  // Verwaiste Dateien entfernen: der Ordner gehoert allein diesem Skript.
  const benutzt = new Set(findeTabellenWerte(neuText).map((w) => w.wert).filter((v) => v.startsWith(BILD_ORDNER_NAME + "/"))
    .map((v) => path.basename(v)));
  let entfernt = 0;
  for (const d of readdirSync(ordner)) {
    if (!benutzt.has(d)) { unlinkSync(path.join(ordner, d)); entfernt++; }
  }
  log(`auslagern: ${ausgelagert} data:-URIs ersetzt (${ausSprites} -> public/sprites, ${ausgelagert - ausSprites} -> ${BILD_ORDNER_NAME}/), `
    + `${neuGeschrieben} Dateien neu, ${entfernt} verwaiste entfernt, Engine ${(quelltext.length / 1e6).toFixed(2)} -> ${(neuText.length / 1e6).toFixed(2)} MB.`);
  return { ausgelagert, ausSprites, neuGeschrieben, entfernt };
}

export function einlagern({ engineDatei = ENGINE_DATEI, log = console.log } = {}) {
  const quelltext = readFileSync(engineDatei, "utf8");
  const werte = findeTabellenWerte(quelltext);
  let n = 0;
  const neuText = ersetze(quelltext, werte, (w) => {
    if (w.wert.startsWith("data:")) return null;
    const { datei } = loeseReferenz(w.wert, engineDatei);
    n++;
    return DATA_PRAEFIX + readFileSync(datei).toString("base64");
  });
  if (neuText !== quelltext) writeFileSync(engineDatei, neuText);
  log(`einlagern: ${n} Referenzen als data:-URI eingebettet, Engine ${(neuText.length / 1e6).toFixed(2)} MB.`);
  return { eingelagert: n };
}

/** Liefert eine Liste von Befunden (leer = alles in Ordnung). */
export function pruefen({ engineDatei = ENGINE_DATEI } = {}) {
  const befunde = [];
  const quelltext = readFileSync(engineDatei, "utf8");
  const werte = findeTabellenWerte(quelltext);
  const publicOrdner = path.dirname(path.dirname(engineDatei));
  const ordner = path.join(path.dirname(engineDatei), BILD_ORDNER_NAME);
  const benutzt = new Set();
  for (const w of werte) {
    if (w.wert.startsWith("data:")) {
      befunde.push(`${w.tabelle}.${w.schluessel}: noch als data:-URI eingebettet (node scripts/lagere-engine-bilder-aus.mjs)`);
      continue;
    }
    const { datei, erwartet, istEngineBild } = loeseReferenz(w.wert, engineDatei);
    if (!datei.startsWith(publicOrdner + path.sep)) { befunde.push(`${w.tabelle}.${w.schluessel}: Pfad verlaesst public/: ${w.wert}`); continue; }
    if (!existsSync(datei)) { befunde.push(`${w.tabelle}.${w.schluessel}: Datei fehlt: ${w.wert}`); continue; }
    if (istEngineBild) benutzt.add(path.basename(datei));
    if (!erwartet) { befunde.push(`${w.tabelle}.${w.schluessel}: kein Inhalts-Hash an ${w.wert}`); continue; }
    const ist = inhaltsHash(readFileSync(datei));
    if (ist !== erwartet) befunde.push(`${w.tabelle}.${w.schluessel}: Inhalt von ${w.wert} hat sich geaendert (Hash ${ist})`);
  }
  if (existsSync(ordner)) {
    for (const d of readdirSync(ordner)) {
      if (!benutzt.has(d)) befunde.push(`${BILD_ORDNER_NAME}/${d}: verwaist (node scripts/lagere-engine-bilder-aus.mjs raeumt auf)`);
    }
  }
  return befunde;
}

const istHauptskript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (istHauptskript) {
  const args = process.argv.slice(2);
  if (args.includes("--pruefen")) {
    const befunde = pruefen();
    if (befunde.length) {
      console.error(`lagere-engine-bilder-aus --pruefen: ${befunde.length} Befund(e)`);
      for (const b of befunde.slice(0, 40)) console.error("  " + b);
      process.exit(1);
    }
    console.log("lagere-engine-bilder-aus --pruefen: in Ordnung.");
  } else if (args.includes("--einlagern")) {
    einlagern();
  } else {
    auslagern({ spriteAbgleich: !args.includes("--ohne-sprite-abgleich") });
  }
}
