/**
 * Schreibt die Kartenschmiede als eigenständige HTML-Datei (ohne Server-Speicher), z. B. zum Teilen
 * oder Öffnen ohne laufende App.
 *
 *   npx tsx scripts/kartenschmiede-eigenstaendig.ts [zieldatei]
 */
import fs from "node:fs";
import path from "node:path";

import { baueKartenschmiedeSeite } from "@/lib/kartenschmiede/seite";

const ziel = path.resolve(process.argv[2] ?? "kartenschmiede.html");
const { kopf, rumpf } = baueKartenschmiedeSeite("eigenstaendig");
// Ohne Zeichensatz liest der Browser eine lokale Datei als Latin-1: Umlaute zerfallen, und Bezeichner mit Umlaut brechen die Skripte
fs.writeFileSync(ziel, `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${kopf}</head><body>${rumpf}</body></html>`);
console.log(`geschrieben: ${ziel} (${Math.round(fs.statSync(ziel).size / 1024)} KB)`);
