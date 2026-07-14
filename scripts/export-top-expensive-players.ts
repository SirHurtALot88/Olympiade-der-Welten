/**
 * Export the N most expensive rostered players (by resolved market value) with team, salary, rating
 * and market-value tier. Used to eyeball whether the AI is overpaying for a handful of mega-priced
 * stars vs. spreading value across the roster.
 *
 * Usage: OLY_APP_SQLITE_PATH=<db> npx tsx scripts/export-top-expensive-players.ts --save-id <id> [--top 10]
 */
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildLeagueMarketBrackets, classifyMarketBracket } from "@/lib/ai/market-pick-engine/market-brackets";

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function main() {
  const saveId = arg("--save-id");
  const top = Number(arg("--top") ?? "10");
  if (!saveId) throw new Error("--save-id required");

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);
  const gs = save.gameState;

  const rosterByPlayerId = new Map(gs.rosters.map((entry) => [entry.playerId, entry] as const));
  const teamCodeById = new Map(gs.teams.map((team) => [team.teamId, team.shortCode ?? team.teamId] as const));
  const brackets = buildLeagueMarketBrackets(gs.players.map((p) => p.marketValue ?? p.displayMarketValue ?? null));

  const rows = gs.players
    .filter((player) => rosterByPlayerId.has(player.id))
    .map((player) => {
      const rosterEntry = rosterByPlayerId.get(player.id) ?? null;
      const contract = resolvePlayerEconomyContract({ player: player as never, rosterEntry: rosterEntry as never });
      const mw = contract.marketValue ?? player.marketValue ?? player.displayMarketValue ?? 0;
      return {
        name: player.name,
        team: rosterEntry ? teamCodeById.get(rosterEntry.teamId) ?? rosterEntry.teamId : "—",
        mw,
        salary: contract.salary ?? 0,
        rating: player.rating ?? null,
        tier: classifyMarketBracket(mw, brackets),
      };
    })
    .sort((a, b) => b.mw - a.mw)
    .slice(0, top);

  const round1 = (v: number | null) => (v == null ? "—" : (Math.round(v * 10) / 10).toString());
  console.log(`# Top-${top} teuerste Spieler · ${saveId} · ${gs.season?.id ?? ""}`);
  console.log("");
  console.log("| # | Spieler | Team | MW | Gehalt | MW/Gehalt | Rating | Tier |");
  console.log("|--:|---|---|--:|--:|--:|--:|---|");
  rows.forEach((r, i) => {
    const ratio = r.salary > 0 ? (Math.round((r.mw / r.salary) * 10) / 10).toString() : "—";
    console.log(`| ${i + 1} | ${r.name} | ${r.team} | ${round1(r.mw)} | ${round1(r.salary)} | ${ratio} | ${round1(r.rating)} | ${r.tier} |`);
  });
  const avgTop = rows.length ? rows.reduce((s, r) => s + r.mw, 0) / rows.length : 0;
  console.log("");
  console.log(`Ø MW Top-${top}: ${round1(avgTop)} · teuerster: ${round1(rows[0]?.mw ?? 0)} · Gehalt-Summe Top-${top}: ${round1(rows.reduce((s, r) => s + r.salary, 0))}`);
}

main();
