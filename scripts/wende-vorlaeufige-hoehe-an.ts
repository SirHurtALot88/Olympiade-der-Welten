// Schreibt die vorlaeufige Groessen-Schaetzung (lib/player-generator/provisional-height.ts)
// in den Katalog data/generated/oly-player-attributes.json — NUR fuer Zeilen, deren
// height aktuell null ist (also niemals eine bereits gesetzte, ggf. echte Height
// ueberschreiben). Jede geschriebene Zeile bekommt heightIsEstimate:true, s.
// PlayerAttributeSheetStats.heightIsEstimate (lib/data/olyDataTypes.ts) — Chris' Auftrag
// vom 25.08.: "erstmal so fuer die chars uebernehmen und taggen dass das vorab werte
// sind die noch ersetzt werden muessen".
//
// Betrifft nur den Repo-Katalog, NICHT bereits bestehende Spielstaende (s. Kommentar in
// provisional-height.ts) — der laufende Spielstand auf dem Server aendert sich dadurch
// nicht.
//
//   npx tsx scripts/wende-vorlaeufige-hoehe-an.ts             (Bericht, schreibt NICHTS)
//   npx tsx scripts/wende-vorlaeufige-hoehe-an.ts --schreiben  (schreibt oly-player-attributes.json)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  berechneStaturModifikator,
  leiteVorlaeufigeHoeheAb,
} from "@/lib/player-generator/provisional-height";
import { normalizeAttributeSheetName, type PlayerAttributeSheetRow } from "@/lib/data/playerAttributeSheet";
import type { Player } from "@/lib/data/olyDataTypes";

const attributesPath = resolve(process.cwd(), "data/generated/oly-player-attributes.json");
const statsPath = resolve(process.cwd(), "data/generated/oly-player-stats.json");

const attributeRows = JSON.parse(readFileSync(attributesPath, "utf8")) as PlayerAttributeSheetRow[];
const players = JSON.parse(readFileSync(statsPath, "utf8")) as Player[];

function normalizeName(name: string) {
  return normalizeAttributeSheetName(name).trim().toLocaleLowerCase("de");
}

const playerByName = new Map(players.map((p) => [normalizeName(p.name), p] as const));

// Statur = (power+health)/2, s. berechneStaturModifikator-Kommentar in
// provisional-height.ts. Rassen-Mittelwert/-Streuung ueber ALLE Zeilen mit
// erkennbarer Rasse und numerischen power/health-Werten, unabhaengig davon, ob die
// Height dieser Zeile schon gesetzt ist — die Population soll das ganze Roster
// abbilden, nicht nur die noch-null-Teilmenge.
const staturJeRasse = new Map<string, number[]>();
for (const row of attributeRows) {
  const player = playerByName.get(normalizeName(row.name));
  if (!player?.race) continue;
  if (typeof row.power !== "number" || typeof row.health !== "number") continue;
  const statur = (row.power + row.health) / 2;
  if (!staturJeRasse.has(player.race)) staturJeRasse.set(player.race, []);
  staturJeRasse.get(player.race)!.push(statur);
}

function mittelUndStdabw(werte: number[]) {
  const n = werte.length;
  const mittel = werte.reduce((s, v) => s + v, 0) / n;
  const varianz = werte.reduce((s, v) => s + (v - mittel) ** 2, 0) / n;
  return { mittel, stdabw: Math.sqrt(varianz) };
}

const rassenStatistik = new Map<string, { mittel: number; stdabw: number }>();
for (const [race, werte] of staturJeRasse) rassenStatistik.set(race, mittelUndStdabw(werte));

let aktualisiert = 0;
let ohneRasse = 0;
let bereitsGesetzt = 0;
const verteilung = new Map<number, number>();
const modifikatorVerteilung = new Map<number, number>();

for (const row of attributeRows) {
  if (typeof row.height === "number") {
    bereitsGesetzt += 1;
    continue;
  }
  const player = playerByName.get(normalizeName(row.name));
  if (!player?.race) {
    ohneRasse += 1;
    continue;
  }
  const stats = rassenStatistik.get(player.race);
  const statur = typeof row.power === "number" && typeof row.health === "number" ? (row.power + row.health) / 2 : NaN;
  const staturModifikator = stats ? berechneStaturModifikator(statur, stats.mittel, stats.stdabw) : 0;
  const hoehe = leiteVorlaeufigeHoeheAb(player.race, player.subclasses ?? [], staturModifikator);

  row.height = hoehe;
  row.heightIsEstimate = true;
  aktualisiert += 1;
  verteilung.set(hoehe, (verteilung.get(hoehe) ?? 0) + 1);
  modifikatorVerteilung.set(staturModifikator, (modifikatorVerteilung.get(staturModifikator) ?? 0) + 1);
}

console.log(`${attributeRows.length} Zeilen insgesamt.`);
console.log(`  bereits gesetzte Height (unangetastet): ${bereitsGesetzt}`);
console.log(`  ohne zuordenbare Rasse (uebersprungen):  ${ohneRasse}`);
console.log(`  neu geschaetzt (heightIsEstimate:true):  ${aktualisiert}`);

console.log("\nVerteilung der neu geschaetzten Werte:");
for (let stufe = 1; stufe <= 10; stufe++) {
  const anzahl = verteilung.get(stufe) ?? 0;
  if (anzahl === 0) continue;
  console.log(`  ${String(stufe).padStart(2)}: ${anzahl} ${"#".repeat(Math.round(anzahl / 20))}`);
}

console.log("\nStatur-Modifikator-Verteilung (Z-Score-basiert, s. berechneStaturModifikator):");
for (const mod of [-1, 0, 1, 2]) {
  console.log(`  ${mod >= 0 ? "+" : ""}${mod}: ${modifikatorVerteilung.get(mod) ?? 0}`);
}

const schreiben = process.argv.includes("--schreiben");
if (schreiben) {
  writeFileSync(attributesPath, `${JSON.stringify(attributeRows, null, 2)}\n`, "utf8");
  console.log(`\nGeschrieben nach ${attributesPath}.`);
} else {
  console.log("\nNur Bericht — mit --schreiben tatsaechlich in oly-player-attributes.json eintragen.");
}
