// ===================================================================================
// VERTEILUNG DES AUFGELOESTEN KAMPF-ARCHETYPS UEBER ALLE ECHTEN SPIELER.
//
// Backlog #156, Schritt 1 — Abnahmekriterium aus dem Auftrag: "keine entartete Verteilung
// (z.B. 90% landen auf 'Fighter' oder demselben einzelnen Archetyp), die grobe Verteilung
// sollte den ~9-10 breiten Buckets einigermassen entsprechen." Dieses Skript wendet
// `bestimmeKampfArchetyp()` (lib/battle/combat-archetype-resolver.ts) auf JEDEN Spieler
// des geladenen Spielstands an — nicht nur auf eine Kader-Familie fuer die Arena-Messung,
// sondern auf die volle Spielerliste (`gameState.players`).
//
// Aufruf (nach dem ueblichen Weg an den Spielstand, s. CLAUDE.md "An die Spielstaende
// kommen"):
//   OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/miss-kampf-archetyp-verteilung.ts
// ===================================================================================
import { createSaveRepository } from "@/lib/persistence/save-repository";
import { bestimmeKampfArchetyp, STANDARD_ARCHETYP_ID } from "@/lib/battle/combat-archetype-resolver";
import type { GameState } from "@/lib/data/olyDataTypes";

if (!process.env.OLY_APP_SQLITE_PATH) {
  console.error("OLY_APP_SQLITE_PATH ist nicht gesetzt (s. CLAUDE.md, \"An die Spielstände kommen\").");
  process.exit(1);
}

const repo = createSaveRepository();
const koepfe = repo.listSaves();
if (!koepfe.length) {
  console.error("Kein Spielstand im Store unter OLY_APP_SQLITE_PATH gefunden.");
  process.exit(1);
}

let gesamtSpieler = 0;
const archNach = new Map<string, number>();
const bucketNach = new Map<string, number>();
let fallbackCount = 0;
let leereSubclasses = 0;
const beispielJeArch = new Map<string, string[]>();

for (const kopf of koepfe) {
  const gameState = repo.getSaveById(kopf.saveId)?.gameState as GameState | undefined;
  if (!gameState || !Array.isArray(gameState.players)) continue;
  for (const p of gameState.players) {
    gesamtSpieler++;
    const ergebnis = bestimmeKampfArchetyp({
      className: p.className,
      subclasses: p.subclasses ?? [],
      traitsPositive: p.traitsPositive ?? [],
      traitsNegative: p.traitsNegative ?? [],
      name: p.name,
    });
    archNach.set(ergebnis.archetype.name, (archNach.get(ergebnis.archetype.name) ?? 0) + 1);
    bucketNach.set(ergebnis.breiterBucket, (bucketNach.get(ergebnis.breiterBucket) ?? 0) + 1);
    if (ergebnis.fallback) fallbackCount++;
    if (!p.subclasses || p.subclasses.length === 0) leereSubclasses++;
    const liste = beispielJeArch.get(ergebnis.archetype.name) ?? [];
    if (liste.length < 3) { liste.push(p.name); beispielJeArch.set(ergebnis.archetype.name, liste); }
  }
}

if (gesamtSpieler === 0) {
  console.error("Keine Spieler in irgendeinem geladenen Spielstand gefunden.");
  process.exit(1);
}

console.log(`Spielstände geprüft: ${koepfe.length}, Spieler gesamt: ${gesamtSpieler}\n`);

console.log("Verteilung über die 35 Kampf-Archetypen (absteigend):");
console.log("Archetyp".padEnd(16) + "Anzahl".padStart(8) + "  %".padStart(8) + "   Beispiele");
const archSortiert = [...archNach.entries()].sort((a, b) => b[1] - a[1]);
for (const [name, n] of archSortiert) {
  const pct = ((n / gesamtSpieler) * 100).toFixed(1);
  const beispiele = (beispielJeArch.get(name) ?? []).join(", ");
  console.log(name.padEnd(16) + String(n).padStart(8) + (pct + "%").padStart(8) + "   " + beispiele);
}
console.log(`\n${archSortiert.length} von 35 Archetypen tatsächlich vergeben. ` +
  `Höchster Anteil: ${archSortiert[0][0]} mit ${((archSortiert[0][1] / gesamtSpieler) * 100).toFixed(1)}%.`);

console.log("\nVerteilung über die 14 breiten Buckets (absteigend):");
const bucketSortiert = [...bucketNach.entries()].sort((a, b) => b[1] - a[1]);
for (const [key, n] of bucketSortiert) {
  console.log(key.padEnd(16) + String(n).padStart(8) + ((n / gesamtSpieler) * 100).toFixed(1).padStart(8) + "%");
}

console.log(`\nFallback (leere Kandidatenmenge -> ${STANDARD_ARCHETYP_ID}): ${fallbackCount} von ${gesamtSpieler} ` +
  `(${((fallbackCount / gesamtSpieler) * 100).toFixed(2)}%).`);
console.log(`Spieler ganz ohne Unterklasse: ${leereSubclasses}.`);
