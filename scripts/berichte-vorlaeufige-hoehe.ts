// Bericht ueber lib/player-generator/provisional-height.ts: wendet die vorlaeufige
// Groessen-Ableitung (Rasse + Subklassen -> 1-10) auf den echten Bestand an und zeigt
// die Verteilung, damit man die Mapping-Tabelle pruefen kann, BEVOR irgendwas davon
// irgendwo verbaut wird. Schreibt nichts, nur Konsolenausgabe.
//
//   npx tsx scripts/berichte-vorlaeufige-hoehe.ts [pfad-zur-sqlite]
//
// Ohne Argument die lokale data/persistence/oly-app.sqlite (erster Save darin, alle
// Saves teilen laut Stichprobe vom 25.08. denselben 2984-Spieler-Kader).

import Database from "better-sqlite3";
import { resolve } from "node:path";

import { leiteVorlaeufigeHoeheAb } from "@/lib/player-generator/provisional-height";

const pfad = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(process.cwd(), "data/persistence/oly-app.sqlite");

const db = new Database(pfad, { readonly: true });
const saveRow = db.prepare("select save_id from saves limit 1").get() as { save_id: string } | undefined;
if (!saveRow) {
  console.error(`Keine Saves in ${pfad} gefunden.`);
  process.exit(1);
}

const rows = db
  .prepare("select payload_json from players where save_id = ?")
  .all(saveRow.save_id) as Array<{ payload_json: string }>;

type Eintrag = { name: string; race: string; subclasses: string[]; hoehe: number };
const eintraege: Eintrag[] = [];
for (const row of rows) {
  const payload = JSON.parse(row.payload_json);
  const player = payload?.player;
  if (!player?.race) continue;
  const subclasses: string[] = Array.isArray(player.subclasses) ? player.subclasses : [];
  eintraege.push({
    name: player.name,
    race: player.race,
    subclasses,
    hoehe: leiteVorlaeufigeHoeheAb(player.race, subclasses),
  });
}

console.log(`Save ${saveRow.save_id}: ${eintraege.length} Spieler mit Rasse.\n`);

// Verteilung ueber die Skala 1-10.
const verteilung = new Map<number, number>();
for (const e of eintraege) verteilung.set(e.hoehe, (verteilung.get(e.hoehe) ?? 0) + 1);
console.log("Verteilung (Groesse: Anzahl):");
for (let stufe = 1; stufe <= 10; stufe++) {
  const anzahl = verteilung.get(stufe) ?? 0;
  if (anzahl === 0) continue;
  console.log(`  ${String(stufe).padStart(2)}: ${anzahl} ${"#".repeat(Math.round(anzahl / 20))}`);
}

// Je Rasse: min/max/typisch, damit Ausreisser (Behemoth-Modifikator wirkt) sichtbar sind.
console.log("\nJe Rasse (Basis -> tatsaechliche Spanne mit Subklassen-Modifikator):");
const nachRasse = new Map<string, number[]>();
for (const e of eintraege) {
  if (!nachRasse.has(e.race)) nachRasse.set(e.race, []);
  nachRasse.get(e.race)!.push(e.hoehe);
}
for (const [race, werte] of [...nachRasse.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const min = Math.min(...werte);
  const max = Math.max(...werte);
  console.log(`  ${race.padEnd(12)} n=${String(werte.length).padStart(4)}  ${min}${min === max ? "" : `-${max}`}`);
}

// Beispiele mit Behemoth-Modifikator, zur Stichprobenkontrolle gegen den Report von vorhin.
console.log("\nBeispiele mit Subklasse Behemoth (Modifikator +3):");
for (const e of eintraege.filter((e) => e.subclasses.includes("Behemoth")).slice(0, 8)) {
  console.log(`  ${e.name.padEnd(24)} ${e.race.padEnd(10)} [${e.subclasses.join(", ")}] -> ${e.hoehe}`);
}
