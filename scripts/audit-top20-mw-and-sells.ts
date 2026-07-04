/**
 * Read-only per-season supplementary audit: Top-20-MW player progression distribution
 * (net positive/negative, organic potential-cap-based growth — NOT rating-gated) and
 * Sell/Buyout behavior (profit sells, contract exits, fee-vs-MW ratio).
 *
 * Usage:
 *   npx tsx scripts/audit-top20-mw-and-sells.ts --save-id <id> --output-dir <dir> [--season-id season-3]
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { computeNetSetpointsFromEvent } from "@/lib/season/long-run-organic-progression-audit";

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

function fmtMio(value: number) {
  return round(value >= 1_000_000 ? value / 1_000_000 : value, 1);
}

export function buildTop20MwAndSellsMarkdown(input: { saveId: string; seasonId: string; gs: GameState }) {
  const { saveId, seasonId, gs } = input;
  const teamById = new Map(gs.teams.map((team) => [team.teamId, team]));
  const rosteredPlayerIds = new Set(gs.rosters.map((entry) => entry.playerId));
  const rosteredPlayers = gs.players.filter((player) => rosteredPlayerIds.has(player.id));

  const top20 = [...rosteredPlayers]
    .sort((left, right) => (right.marketValue ?? 0) - (left.marketValue ?? 0))
    .slice(0, 20);

  const organicEvents = (gs.playerProgressionEvents ?? []).filter(
    (event) =>
      event.seasonId === seasonId &&
      (event.source === "organic_season_progression" ||
        (event.upgrades ?? []).some((upgrade) => upgrade.source === "organic_season_progression")),
  );
  const netByPlayer = new Map<string, number>();
  for (const event of organicEvents) {
    const net = computeNetSetpointsFromEvent(event);
    netByPlayer.set(event.playerId, (netByPlayer.get(event.playerId) ?? 0) + net);
  }

  const top20Rows = top20.map((player) => {
    const roster = gs.rosters.find((entry) => entry.playerId === player.id);
    const team = roster ? teamById.get(roster.teamId) : null;
    const net = netByPlayer.get(player.id) ?? 0;
    return {
      name: player.name,
      team: team?.shortCode ?? "?",
      mw: player.marketValue ?? 0,
      rating: player.rating ?? player.ovr ?? null,
      net,
    };
  });

  const netPositive = top20Rows.filter((row) => row.net > 0).length;
  const netNegative = top20Rows.filter((row) => row.net < 0).length;
  const netFlat = top20Rows.filter((row) => row.net === 0).length;

  const history = gs.transferHistory ?? [];
  const seasonHistory = history.filter((entry) => entry.seasonId === seasonId);
  const sells = seasonHistory.filter((entry) => entry.transferType === "sell");
  const contractExits = seasonHistory.filter((entry) => entry.transferType === "contract_exit");

  const sellFeeTotal = sells.reduce((sum, entry) => sum + (entry.fee ?? 0), 0);
  const sellsAtOrAboveMw = sells.filter((entry) => entry.marketValue > 0 && entry.fee >= entry.marketValue * 0.9);
  const sellsBelowHalfMw = sells.filter((entry) => entry.marketValue > 0 && entry.fee < entry.marketValue * 0.5);
  const avgFeeToMwRatio =
    sells.length > 0
      ? round(
          sells.reduce((sum, entry) => sum + (entry.marketValue > 0 ? entry.fee / entry.marketValue : 1), 0) /
            sells.length,
          2,
        )
      : null;

  const lines: string[] = [
    `# Top20-MW & Sell/Buyout Audit · ${seasonId}`,
    "",
    `**Save:** \`${saveId}\``,
    `**Aktueller Save-Stand:** ${gs.season.id} · Phase: ${gs.gamePhase ?? "?"}`,
    `**Erstellt:** ${new Date().toISOString()}`,
    "",
    "## Top-20-MW Verteilung netto positiv/negativ (organisches Potential-Cap-Wachstum)",
    "",
    `- **Netto positiv:** ${netPositive}/20 · **Netto negativ:** ${netNegative}/20 · **Unverändert/keine Daten:** ${netFlat}/20`,
    `- Datenquelle: \`organic_season_progression\`-Events für ${seasonId} (${organicEvents.length} Events im Save)`,
    "",
    "| # | Spieler | Team | MW (Mio) | Rating | Netto-Attr.-Pkt. (Season) |",
    "|--:|---|---|---:|---:|---:|",
  ];
  top20Rows.forEach((row, index) => {
    lines.push(
      `| ${index + 1} | ${row.name} | ${row.team} | ${fmtMio(row.mw)} | ${row.rating != null ? round(row.rating, 1) : "—"} | ${row.net >= 0 ? "+" : ""}${round(row.net)} |`,
    );
  });
  lines.push("");

  lines.push("## Sell/Buyout-Verhalten dieser Season", "");
  lines.push(
    `- **Sells:** ${sells.length} (Summe Fee: ${fmtMio(sellFeeTotal)} Mio) · **Contract-Exits:** ${contractExits.length}`,
    `- **Ø Fee/MW-Ratio bei Sells:** ${avgFeeToMwRatio ?? "—"} (1.0 = exakt zum Marktwert verkauft)`,
    `- **Sells ≥90% des MW ("fairer Verkauf"):** ${sellsAtOrAboveMw.length}/${sells.length || 0}`,
    `- **Sells <50% des MW (potenzielles No-Sell-Floor-Warnsignal):** ${sellsBelowHalfMw.length}/${sells.length || 0}${sellsBelowHalfMw.length > 0 ? ` → ${sellsBelowHalfMw.map((entry) => `${entry.playerName ?? entry.playerId}(${fmtMio(entry.fee)}/${fmtMio(entry.marketValue)})`).join(", ")}` : ""}`,
    "",
  );

  return lines.join("\n");
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  const outputDir = argValue("--output-dir");
  const explicitSeasonId = argValue("--season-id");
  if (!saveId || !outputDir) throw new Error("Missing --save-id or --output-dir");

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const seasonId = explicitSeasonId ?? save.gameState.season.id;
  const markdown = buildTop20MwAndSellsMarkdown({ saveId, seasonId, gs: save.gameState });

  fs.mkdirSync(outputDir, { recursive: true });
  const seasonNumber = seasonId.match(/(\d+)$/)?.[1] ?? seasonId;
  const outPath = path.join(outputDir, `top20mw-sells-season-${seasonNumber}.md`);
  fs.writeFileSync(outPath, `${markdown}\n`);
  console.log(`Wrote ${outPath}`);
}

const isDirectRun = process.argv[1]?.includes("audit-top20-mw-and-sells");
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
