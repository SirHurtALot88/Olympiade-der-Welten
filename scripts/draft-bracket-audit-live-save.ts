/**
 * Read-only bracket audit for an EXISTING save's S1 draft (no new save created, no writes).
 *
 * Answers: were the S1 draft buys actually spread across Core/Star/Depth tiers (genuine
 * planner-quality picks), or overwhelmingly Reserve/Backup with just enough spend to look like a
 * clean budget landing (cheap-fill/repair-driven, just tagged "ai_roster_fill" like everything
 * else in ai-picks-run-service.ts — the transferSource string alone can't tell planned from
 * filler here, since virtually every AI buy path uses that same tag)?
 *
 * Usage:
 *   npx tsx scripts/draft-bracket-audit-live-save.ts --save-id <id> [--season-id season-1]
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";

import {
  buildLeagueMarketBrackets,
  classifyMarketBracket,
  type MarketBracketTierLabel,
} from "@/lib/ai/market-pick-engine/market-brackets";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function emptyBrackets(): Record<MarketBracketTierLabel, number> {
  return { Superstar: 0, Star: 0, Core: 0, Depth: 0, Backup: 0, Reserve: 0 };
}

function countBrackets(prices: number[], leagueBrackets: ReturnType<typeof buildLeagueMarketBrackets>) {
  const counts = emptyBrackets();
  for (const price of prices) {
    counts[classifyMarketBracket(price, leagueBrackets)] += 1;
  }
  return counts;
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  const seasonId = argValue("--season-id") ?? "season-1";
  if (!saveId) throw new Error("Missing --save-id");

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);
  const gs = save.gameState;

  const buyPrices = gs.transferHistory
    .filter((entry) => entry.seasonId === seasonId && entry.transferType === "buy")
    .map((entry) => entry.fee ?? entry.marketValue ?? 0)
    .filter((value) => value > 0);
  const leagueBrackets = buildLeagueMarketBrackets(buyPrices);
  const league = countBrackets(buyPrices, leagueBrackets);
  const teamCount = Math.max(gs.teams.length, 1);
  const leagueAvg = Object.fromEntries(
    (Object.keys(league) as MarketBracketTierLabel[]).map((tier) => [tier, round(league[tier] / teamCount, 2)]),
  ) as Record<MarketBracketTierLabel, number>;

  const playerById = new Map(gs.players.map((player) => [player.id, player]));
  const perTeam = gs.teams.map((team) => {
    const rosterEntries = gs.rosters.filter((entry) => entry.teamId === team.teamId);
    const prices = rosterEntries.map((entry) => {
      const player = playerById.get(entry.playerId);
      if (!player) return 0;
      return resolvePlayerEconomyContract(player).marketValue ?? player.marketValue ?? 0;
    });
    return {
      teamCode: team.shortCode || team.teamId,
      roster: rosterEntries.length,
      brackets: countBrackets(prices, leagueBrackets),
    };
  });

  const teamsWithNoCoreOrAbove = perTeam.filter(
    (row) => row.brackets.Core + row.brackets.Star + row.brackets.Superstar === 0,
  );
  const teamsMostlyReserveBackup = perTeam.filter((row) => {
    const cheap = row.brackets.Reserve + row.brackets.Backup;
    return row.roster > 0 && cheap / row.roster >= 0.7;
  });

  console.log(`\n=== Draft Bracket Audit: ${saveId} (${seasonId}) ===\n`);
  console.log(`League Bracket-Grenzen (aus S1-Buy-Preisverteilung, ${buyPrices.length} Buys):`);
  console.log(
    `  Superstar >= ${leagueBrackets.superstar.floorMw} | Star >= ${leagueBrackets.star.floorMw} | Core >= ${leagueBrackets.core.floorMw} | Depth >= ${leagueBrackets.depth.floorMw} | Backup >= ${leagueBrackets.backup.floorMw} | Reserve < ${leagueBrackets.backup.floorMw}`,
  );
  console.log(`\nLiga-Summe (alle Buys): SS=${league.Superstar} Star=${league.Star} Core=${league.Core} Depth=${league.Depth} Backup=${league.Backup} Reserve=${league.Reserve}`);
  console.log(`Liga-Ø pro Team (Roster nach Draft): SS=${leagueAvg.Superstar} Star=${leagueAvg.Star} Core=${leagueAvg.Core} Depth=${leagueAvg.Depth} Backup=${leagueAvg.Backup} Reserve=${leagueAvg.Reserve}`);

  console.log(`\n${teamsWithNoCoreOrAbove.length}/${teamCount} Teams OHNE JEDEN Core/Star/Superstar-Spieler im Kader:`);
  for (const row of teamsWithNoCoreOrAbove) console.log(`  - ${row.teamCode}`);

  console.log(`\n${teamsMostlyReserveBackup.length}/${teamCount} Teams mit >=70% Reserve/Backup-Anteil im Kader (Verdachtsmoment "nur Filler"):`);
  for (const row of teamsMostlyReserveBackup) {
    console.log(
      `  - ${row.teamCode}: SS=${row.brackets.Superstar} Star=${row.brackets.Star} Core=${row.brackets.Core} Depth=${row.brackets.Depth} Backup=${row.brackets.Backup} Reserve=${row.brackets.Reserve} (Roster ${row.roster})`,
    );
  }

  console.log(`\n=== Per-Team Detail ===`);
  console.log(`Team | SS | Star | Core | Depth | Backup | Reserve | Roster`);
  for (const row of [...perTeam].sort((a, b) => a.teamCode.localeCompare(b.teamCode, "de"))) {
    console.log(
      `${row.teamCode} | ${row.brackets.Superstar} | ${row.brackets.Star} | ${row.brackets.Core} | ${row.brackets.Depth} | ${row.brackets.Backup} | ${row.brackets.Reserve} | ${row.roster}`,
    );
  }

  console.log(`\n=== Verdikt ===`);
  if (leagueAvg.Core + leagueAvg.Star + leagueAvg.Superstar < 0.5) {
    console.log("❌ VERDACHT BESTÄTIGT: Liga-weit fast kein Core/Star/Superstar-Anteil im Kader — sieht nach reinem Cheap-Fill/Repair statt echter Planner-Qualität aus.");
  } else if (teamsMostlyReserveBackup.length >= teamCount * 0.3) {
    console.log("⚠️ TEILWEISE VERDACHT: Ein relevanter Teil der Teams (>=30%) ist fast nur Reserve/Backup — für diese Teams lohnt ein genauerer Blick auf die Planner-Logs.");
  } else {
    console.log("✅ Sieht nach echter Planner-Verteilung aus: Core/Star/Superstar sind liga-weit und pro Team vertreten, nicht nur Reserve/Backup-Filler.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
