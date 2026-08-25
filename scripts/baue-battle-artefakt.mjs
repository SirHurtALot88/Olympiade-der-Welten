#!/usr/bin/env node
// Setzt aus der duennen Huelle (public/mockups/battle-mode.html) und ihren zwei
// ausgelagerten Dateien (battle-mode.css, battle-mode.engine.js) wieder EINE
// selbststaendige HTML-Datei zusammen — fuer die Claude-Artefakt-Veroeffentlichung,
// die (anders als die laufende App) keine externen <link>/<script src>-Verweise
// laden darf.
//
// Die drei Quelldateien bleiben die einzige Wahrheit; dieses Skript liest nur und
// schreibt nur die zusammengesetzte Ausgabedatei. Aufruf:
//   node scripts/baue-battle-artefakt.mjs [ziel-datei]
// Ohne Argument landet das Ergebnis unter dist/battle-mode-artefakt.html (gitignored).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const mockupsDir = resolve(hier, "..", "public", "mockups");

const shell = readFileSync(resolve(mockupsDir, "battle-mode.html"), "utf8");
const css = readFileSync(resolve(mockupsDir, "battle-mode.css"), "utf8");
const js = readFileSync(resolve(mockupsDir, "battle-mode.engine.js"), "utf8");

// Das Google-Fonts-<link> bleibt stehen (Artefakte duerfen dorthin verlinken, s.
// Publish-Regeln) — nur der lokale Stylesheet-Verweis wird durch den Inhalt selbst
// ersetzt, und das <script src> durch den Motor selbst.
let ausgabe = shell
  .replace(
    /<link rel="stylesheet" href="battle-mode\.css">/,
    () => `<style>\n${css}</style>`,
  )
  .replace(
    /<script src="battle-mode\.engine\.js"><\/script>/,
    () => `<script>\n${js}</script>`,
  );

if (ausgabe.includes('href="battle-mode.css"') || ausgabe.includes('src="battle-mode.engine.js"')) {
  throw new Error(
    "battle-mode.html hat sich strukturell geaendert — die <link>/<script>-Ersetzung hat nicht beide Stellen getroffen. Skript pruefen, bevor ein Artefakt draus wird.",
  );
}

const zielArg = process.argv[2];
const ziel = zielArg ? resolve(process.cwd(), zielArg) : resolve(hier, "..", "dist", "battle-mode-artefakt.html");
mkdirSync(dirname(ziel), { recursive: true });
writeFileSync(ziel, ausgabe);
console.log(`Artefakt geschrieben: ${ziel} (${(ausgabe.length / 1024).toFixed(0)} KiB)`);
