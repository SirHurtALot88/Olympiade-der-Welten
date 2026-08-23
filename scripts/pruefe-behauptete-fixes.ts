/* eslint-disable no-console */
/**
 * AUDIT: HALTEN DIE BEHAUPTETEN FIXES AM ECHTEN SPIELSTAND?
 *
 * Angestossen von Chris am 23.08.: „hast du die anderen bugs auch alle auditiert und geprueft ob
 * sie WIRKLICH gefixt sind?" Die Vier-Stunden-Routine vergleicht nur Meldungen gegen Quittungen —
 * das ist Buchhaltung. Dieses Skript prueft die Behauptungen, die sich am Save messen lassen.
 *
 * Jede Zeile nennt die Meldung, die Behauptung aus der Quittung und die heutige Messung.
 *
 * Nutzung:
 *   OLY_APP_SQLITE_PATH=/pfad/zur/kopie.sqlite npx tsx scripts/pruefe-behauptete-fixes.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const p = createPersistenceService();
const staende: Array<{ kuerzel: string; gs: GameState }> = [];
for (const eintrag of p.listSaves()) {
  const gs = p.getSaveById(eintrag.saveId)?.gameState as GameState | undefined;
  if (gs?.teams?.length) staende.push({ kuerzel: String(eintrag.saveId).slice(-6), gs });
}

function saison(gs: GameState): string {
  return gs.seasonState?.seasonId ?? "?";
}

console.log(`Spielstaende: ${staende.map((s) => `${s.kuerzel} (${saison(s.gs)})`).join(", ")}\n`);

/* ---------------------------------------------------------------- nl5eju */
console.log("nl5eju — „in Season 2 hat IMMERNOCH kein einziges team in gebäude investiert\"");
console.log("  Behauptung: KI-Reserve gedeckelt, Teams koennen wieder investieren.");
for (const { kuerzel, gs } of staende) {
  let mitStufe = 0;
  let stufenSumme = 0;
  for (const team of gs.teams ?? []) {
    const stufen = Object.values(getTeamFacilityState(gs, team.teamId).facilities ?? {}).map((f) => f.level ?? 0);
    const summe = stufen.reduce((a, b) => a + b, 0);
    stufenSumme += summe;
    if (summe > 0) mitStufe += 1;
  }
  console.log(
    `    ${kuerzel} (${saison(gs)}): ${mitStufe}/${(gs.teams ?? []).length} Teams mit Gebaeudestufe > 0 · Stufen gesamt ${stufenSumme}`,
  );
}

/* ---------------------------------------------------------------- 7mjqbg */
// AM SAVE NICHT MESSBAR — und der erste Versuch tat so, als waere er es. Er las
// `gs.matchdayLineups`; das Feld gibt es nicht, die Schleife lief ueber eine leere Liste und
// meldete „0 Verstoesse". Eine Null aus einer leeren Menge ist kein Beleg, sondern der bequemste
// Weg, ein Audit zu faelschen. Der Save haelt weder die gespielten Formkarten je Spieltag noch die
// Kapitaenswahl je Disziplin vor; geprueft wird die Regel deshalb im Quelltext
// (`ai-legacy-lineup-engine.ts:298` — `concedesByNegativeFormCard`, gespeist aus
// `negativeFormCardSides` in Zeile 1514). Sie steht dort. Was FEHLT, ist ein Test darauf.
console.log("\n7mjqbg — „… schmeißen eine negative Formkarte rein aber wählen dennoch den Captain\"");
console.log("  Regel im Quelltext vorhanden (ai-legacy-lineup-engine.ts:298), aber ohne Test.");
console.log("  Am Spielstand nicht nachweisbar: Formkarten je Spieltag und Kapitaenswahl je");
console.log("  Disziplin werden nicht gespeichert.");

/* ---------------------------------------------------------------- wk26tq */
console.log("\nwk26tq — „KI Pick problem wo so geplant wurde dass das Team nach Käufen im Minus wäre\"");
console.log("  Befund der Quittung: nicht reproduzierbar, kein Eingriff. Heutige Lage:");
for (const { kuerzel, gs } of staende) {
  const imMinus = (gs.teams ?? []).filter((t) => ((t as { cash?: number }).cash ?? 0) < 0);
  const summe = imMinus.reduce((a, t) => a + ((t as { cash?: number }).cash ?? 0), 0);
  console.log(
    `    ${kuerzel} (${saison(gs)}): ${imMinus.length}/${gs.teams.length} Teams im Minus` +
      `${imMinus.length ? ` · Summe ${summe.toFixed(1)}` : ""}`,
  );
}

/* ---------------------------------------------------------------- 33c172 */
console.log("\n33c172 — „verkäufe gestoppt wegen spieler minimum — diesen grund darf es nicht geben\"");
console.log("  Behauptung: der Grund ist entfernt. Heute im Quelltext geprueft (siehe Quittung),");
console.log("  am Save nicht messbar — Verkaufssperren sind kein gespeicherter Zustand.");
