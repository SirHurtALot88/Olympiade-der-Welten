/**
 * NACHRECHNUNG: MUTATORPUNKTE IN DIE SAISONTABELLE.
 *
 * GEMELDET VON CHRIS (19.08.): „im Saisonstand sind die Mutatorpunkte mit 0,3 gar nicht drin!"
 *
 * Der Fehler selbst ist behoben (`standings-preview-engine`), aber NUR FUER KUENFTIGE Buchungen.
 * Die Saisontabelle ist ein GESPEICHERTER Wert; bereits gebuchte Spieltage tragen ihren Fehler
 * weiter. An Chris' Spielstand waren das acht Spieltage — ligaweit 101,40 fehlende Punkte und
 * vier falsch besetzte Plaetze.
 *
 * Dieses Skript rechnet die Tabelle aus dem LEDGER nach, das den Aufschlag von jeher mitfuehrt
 * (`season-points-ledger`), und vergibt die Raenge mit derselben Funktion wie die Buchung
 * (`resolveProjectedRankWithTiePolicy`) — nicht mit einer zweiten, eigenen Sortierung.
 *
 *   npx tsx scripts/repair-save-mutatorpunkte.ts                  (nur zeigen)
 *   npx tsx scripts/repair-save-mutatorpunkte.ts --schreiben      (anwenden)
 *   SAVE_ID=... npx tsx scripts/repair-save-mutatorpunkte.ts      (bestimmter Stand)
 *
 * SCHREIBT NICHTS OHNE `--schreiben`. Und auf dem Server gilt weiterhin: zurueckspielen nur ueber
 * `deploy/hetzner/pull-repaired-save.sh` — wegen WAL, siehe CLAUDE.md.
 */
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolveProjectedRankWithTiePolicy } from "@/lib/standings/standings-tiebreaker-policy";
import type { GameState } from "@/lib/data/olyDataTypes";

const schreiben = process.argv.includes("--schreiben");
const persistence = createPersistenceService();
const save = process.env.SAVE_ID ? persistence.getSaveById(process.env.SAVE_ID) : persistence.getActiveSave();
if (!save?.gameState) {
  throw new Error("Kein Spielstand gefunden.");
}
const gs = save.gameState as GameState;
const seasonId = gs.season.id;
console.log(`Spielstand ${save.saveId} · ${seasonId} · ${gs.matchdayState?.matchdayId ?? "?"}`);
console.log(schreiben ? "MODUS: schreiben\n" : "MODUS: nur zeigen (--schreiben zum Anwenden)\n");

const ledger = buildSeasonPointsLedger(gs, seasonId);
const standings = (gs.seasonState.standings ?? {}) as Record<
  string,
  { points?: number | null; rank?: number | null }
>;

const zeilen = gs.teams.map((team) => {
  const summary = ledger.teamSummariesByTeamId.get(team.teamId);
  return {
    teamId: team.teamId,
    teamName: team.name,
    alt: Number((standings[team.teamId]?.points ?? 0).toFixed(1)),
    neu: Number((summary?.totalPoints ?? 0).toFixed(1)),
    mutator: Number((summary?.mutatorPpsBonus ?? 0).toFixed(1)),
    altRang: standings[team.teamId]?.rank ?? null,
    cash: team.cash ?? null,
  };
});

const abweichend = zeilen.filter((z) => Math.abs(z.alt - z.neu) > 0.05);
if (abweichend.length === 0) {
  console.log("Tabelle und Ledger stimmen ueberein — nichts zu tun.");
  process.exit(0);
}

// Raenge mit DERSELBEN Funktion wie die Buchung, nicht mit einer eigenen Sortierung.
const neueRaenge = resolveProjectedRankWithTiePolicy(
  zeilen.map((z) => ({
    teamId: z.teamId,
    teamName: z.teamName,
    totalScore: null,
    projectedPoints: z.neu,
    currentRank: z.altRang,
    currentPoints: z.alt,
    matchdayRank: null,
    cash: z.cash,
  })),
);

console.log(`Teams mit Abweichung: ${abweichend.length} von ${zeilen.length}`);
console.log(`Fehlende Punkte ligaweit: ${zeilen.reduce((s, z) => s + (z.neu - z.alt), 0).toFixed(2)}\n`);
console.log("Team   alt      neu    Mutator   Rang alt -> neu");
for (const z of [...zeilen].sort((a, b) => b.neu - a.neu)) {
  const rangNeu = neueRaenge.get(z.teamId) ?? null;
  const wechsel = z.altRang !== rangNeu ? "  <-- verschiebt sich" : "";
  console.log(
    `${z.teamId.padEnd(5)} ${String(z.alt).padStart(6)} ${String(z.neu).padStart(7)} ${String(z.mutator).padStart(9)}   ${String(z.altRang ?? "-").padStart(3)} -> ${String(rangNeu ?? "-").padStart(3)}${wechsel}`,
  );
}

if (!schreiben) {
  console.log("\nNichts geschrieben. Mit --schreiben anwenden.");
  process.exit(0);
}

const naechste = { ...standings };
for (const z of zeilen) {
  const vorher = naechste[z.teamId] ?? {};
  naechste[z.teamId] = { ...vorher, points: z.neu, rank: neueRaenge.get(z.teamId) ?? vorher.rank ?? null };
}
const naechsterStand: GameState = {
  ...gs,
  seasonState: { ...gs.seasonState, standings: naechste },
} as GameState;

persistence.saveSingleplayerState(save.saveId, naechsterStand);
console.log("\nGESCHRIEBEN. Auf dem Server nur ueber deploy/hetzner/pull-repaired-save.sh zurueckspielen (WAL).");
