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
fs.writeFileSync(ziel, kopf + rumpf);
console.log(`geschrieben: ${ziel} (${Math.round(fs.statSync(ziel).size / 1024)} KB)`);
