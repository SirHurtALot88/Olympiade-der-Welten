/**
 * One-shot: Top/Bottom Spieler nach Attribut-Netto-Progression pro Season.
 * Nur organic_season_progression; manual_xp_spend_preview wird aus Upgrades gefiltert.
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PlayerProgressionSpendEventRecord } from "@/lib/data/olyDataTypes";

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

function computeNetSetpoints(event: PlayerProgressionSpendEventRecord): number {
  const fromMeta = event.organicMeta?.netSetpoints;
  if (typeof fromMeta === "number" && Number.isFinite(fromMeta)) {
    return fromMeta;
  }
  return (event.upgrades ?? [])
    .filter((upgrade) => upgrade.source !== "manual_xp_spend_preview")
    .reduce((sum, upgrade) => sum + (upgrade.toValue - upgrade.fromValue), 0);
}

function formatTable(
  title: string,
  rows: Array<{ rank: number; name: string; team: string; ovr: string; net: string }>,
) {
  const lines = [
    `### ${title}`,
    "",
    "| # | Spieler | Team | OVR | Netto-Attr.-Pkt. |",
    "|--:|---|---|---:|---:|",
  ];
  for (const row of rows) {
    lines.push(`| ${row.rank} | ${row.name} | ${row.team} | ${row.ovr} | ${row.net} |`);
  }
  return lines.join("\n");
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id") ?? "fresh-season-1-1782854277541";
  const save = createPersistenceService().getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const gs = save.gameState;
  const playerById = new Map(gs.players.map((player) => [player.id, player]));
  const teamById = new Map(gs.teams.map((team) => [team.teamId, team]));

  const allEvents = gs.playerProgressionEvents ?? [];
  const manualPreviewUpgrades = allEvents.flatMap((event) =>
    (event.upgrades ?? []).filter((upgrade) => upgrade.source === "manual_xp_spend_preview"),
  );
  const manualPreviewEvents = allEvents.filter((event) =>
    (event.upgrades ?? []).some((upgrade) => upgrade.source === "manual_xp_spend_preview"),
  );

  const organicEvents = allEvents.filter((event) => event.source === "organic_season_progression");

  const bySeasonPlayer = new Map<string, Map<string, number>>();
  for (const event of organicEvents) {
    const net = computeNetSetpoints(event);
    const seasonMap = bySeasonPlayer.get(event.seasonId) ?? new Map<string, number>();
    seasonMap.set(event.playerId, (seasonMap.get(event.playerId) ?? 0) + net);
    bySeasonPlayer.set(event.seasonId, seasonMap);
  }

  const seasonIds = [...bySeasonPlayer.keys()].sort((left, right) =>
    left.localeCompare(right, "de", { numeric: true }),
  );

  const output: string[] = [
    `# Attribut-Progression Rankings · ${saveId}`,
    "",
    `**Save:** ${save.name ?? saveId}`,
    `**Aktuelle Season:** ${gs.season.id} · Phase: ${gs.gamePhase ?? "?"}`,
    "",
    "## Datenhinweise",
    "",
    `- **Quelle:** Nur Events mit \`source = organic_season_progression\` (${organicEvents.length} Events)`,
    `- **Filter:** \`manual_xp_spend_preview\`-Upgrades werden ignoriert`,
  ];

  if (manualPreviewUpgrades.length > 0) {
    output.push(
      `- ⚠️ **Korruptionshinweis:** ${manualPreviewUpgrades.length} \`manual_xp_spend_preview\`-Upgrades in ${manualPreviewEvents.length} Events gefunden — diese sind **nicht** in den Rankings enthalten`,
    );
  } else {
    output.push(`- Keine \`manual_xp_spend_preview\`-Upgrades im Save gefunden`);
  }

  output.push(
    "",
    `**Seasons mit Progression-Daten:** ${seasonIds.length > 0 ? seasonIds.join(", ") : "keine"}`,
    "",
  );

  for (const seasonId of seasonIds) {
    const seasonMap = bySeasonPlayer.get(seasonId)!;
    const entries = [...seasonMap.entries()]
      .map(([playerId, netSetpoints]) => {
        const player = playerById.get(playerId);
        const team = teamById.get(
          organicEvents.find((event) => event.playerId === playerId && event.seasonId === seasonId)?.teamId ??
            gs.rosters.find((entry) => entry.playerId === playerId)?.teamId ??
            "",
        );
        return {
          playerId,
          name: player?.name ?? playerId,
          team: team?.shortCode ?? "?",
          ovr: player?.ovr ?? player?.rating ?? null,
          netSetpoints,
        };
      })
      .sort((left, right) => right.netSetpoints - left.netSetpoints);

    const top10 = entries.slice(0, 10);
    const bottom10 = [...entries].sort((left, right) => left.netSetpoints - right.netSetpoints).slice(0, 10);

    const seasonLabel = seasonId.replace("season-", "S");
    output.push(`## ${seasonLabel} (${seasonId})`);
    output.push("");
    output.push(
      `**Spieler mit organic Progression:** ${entries.length} · **Summe Netto-Pkt.:** ${round(entries.reduce((sum, entry) => sum + entry.netSetpoints, 0))}`,
    );
    output.push("");

    output.push(
      formatTable(
        `Top 10 — größte Verbesserung (${seasonLabel})`,
        top10.map((entry, index) => ({
          rank: index + 1,
          name: entry.name,
          team: entry.team,
          ovr: entry.ovr != null ? String(round(entry.ovr, 1)) : "—",
          net: `${entry.netSetpoints >= 0 ? "+" : ""}${round(entry.netSetpoints)}`,
        })),
      ),
    );
    output.push("");
    output.push(
      formatTable(
        `Bottom 10 — größte Regression (${seasonLabel})`,
        bottom10.map((entry, index) => ({
          rank: index + 1,
          name: entry.name,
          team: entry.team,
          ovr: entry.ovr != null ? String(round(entry.ovr, 1)) : "—",
          net: `${entry.netSetpoints >= 0 ? "+" : ""}${round(entry.netSetpoints)}`,
        })),
      ),
    );
    output.push("");
  }

  const markdown = `${output.join("\n")}\n`;
  console.log(markdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
