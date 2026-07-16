/**
 * Comprehensive S1–S5 balancing save review: team finance snapshots,
 * top market values, and cumulative organic training progression.
 *
 * Usage:
 *   npx tsx scripts/export-balancing-save-review.ts \
 *     --save-id <id> \
 *     --output-dir <dir> \
 *     [--seasons 5]
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { PlayerProgressionSpendEventRecord, SeasonSnapshotTeamRecord } from "@/lib/data/olyDataTypes";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { getFacilityEfficiency, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { buildLeagueMarketBrackets, classifyMarketBracket } from "@/lib/ai/market-pick-engine/market-brackets";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mioRaw(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return round(value, 1).toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function toMio(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return value >= 1_000_000 ? value / 1_000_000 : value;
}

function snapshotRow(row: SeasonSnapshotTeamRecord) {
  return {
    teamCode: row.teamCode,
    rank: row.rank,
    cash: toMio(row.cashEnd ?? row.cashTotal),
    mw: toMio(row.marketValueEnd ?? row.marketValueTotalEnd),
    salary: toMio(row.salaryEnd ?? row.salaryTotalEnd),
    roster: row.rosterEnd ?? row.rosterCountEnd ?? null,
  };
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

function formatProgressionTable(
  title: string,
  rows: Array<{ rank: number; name: string; team: string; ovr: string; net: string }>,
) {
  const lines = [
    `### ${title}`,
    "",
    "| # | Spieler | Team | OVR | Netto-Attr.-Pkt. (S1–S5) |",
    "|--:|---|---|---:|---:|",
  ];
  for (const row of rows) {
    lines.push(`| ${row.rank} | ${row.name} | ${row.team} | ${row.ovr} | ${row.net} |`);
  }
  return lines.join("\n");
}

export function buildBalancingSaveReviewMarkdown(input: {
  saveId: string;
  seasonIds: string[];
  gs: ReturnType<NonNullable<ReturnType<typeof createPersistenceService>["getSaveById"]>>["gameState"];
  saveName?: string | null;
}) {
  const { saveId, seasonIds, gs, saveName } = input;
  const playerById = new Map(gs.players.map((player) => [player.id, player]));
  const teamById = new Map(gs.teams.map((team) => [team.teamId, team]));
  const rosterTeamByPlayer = new Map(gs.rosters.map((entry) => [entry.playerId, entry.teamId]));

  const snaps = [...(gs.seasonState.seasonSnapshots ?? [])].sort((left, right) =>
    left.seasonId.localeCompare(right.seasonId, undefined, { numeric: true }),
  );

  const teamCodes = [...gs.teams]
    .sort((left, right) => left.shortCode.localeCompare(right.shortCode, "de"))
    .map((team) => team.shortCode);

  const seasonTeamRows = new Map<string, Map<string, ReturnType<typeof snapshotRow>>>();
  const zeroRosterBySeason = new Map<string, string[]>();

  for (const seasonId of seasonIds) {
    const snap = snaps.find((entry) => entry.seasonId === seasonId);
    const rows = snap?.teamSnapshots ?? snap?.finalStandings ?? [];
    const byTeam = new Map<string, ReturnType<typeof snapshotRow>>();

    if (rows.length > 0) {
      for (const row of rows) {
        byTeam.set(row.teamCode, snapshotRow(row));
      }
    } else if (seasonId === seasonIds.at(-1)) {
      for (const team of gs.teams) {
        const roster = gs.rosters.filter((entry) => entry.teamId === team.teamId);
        const mw = roster.reduce((sum, entry) => {
          const player = playerById.get(entry.playerId);
          return sum + (player?.displayMarketValue ?? player?.marketValue ?? 0);
        }, 0);
        const salary = roster.reduce((sum, entry) => sum + (entry.salary ?? 0), 0);
        byTeam.set(team.shortCode, {
          teamCode: team.shortCode,
          rank: gs.seasonState.standings?.[team.teamId]?.rank ?? null,
          cash: toMio(team.cash ?? null),
          mw: toMio(mw),
          salary: toMio(salary),
          roster: roster.length,
        });
      }
    }

    const zeroRoster = [...byTeam.values()]
      .filter((row) => row.roster === 0)
      .map((row) => row.teamCode);
    if (zeroRoster.length > 0) zeroRosterBySeason.set(seasonId, zeroRoster);
    seasonTeamRows.set(seasonId, byTeam);
  }

  const lines: string[] = [
    `# Balancing Save Review · S1–S5`,
    "",
    `**Save:** ${saveName ?? saveId}`,
    `**Save-ID:** \`${saveId}\``,
    `**Stand:** ${gs.season.id} · Phase: ${gs.gamePhase ?? "?"}`,
    `**Erstellt:** ${new Date().toISOString()}`,
    "",
    "## Übersicht",
    "",
    `- **Teams:** ${gs.teams.length}`,
    `- **Spieler (Live):** ${gs.players.length}`,
    `- **Season-Snapshots:** ${snaps.map((snap) => snap.seasonId).join(", ") || "keine"}`,
    `- **Werte:** Mio € (1 Dezimalstelle)`,
    "",
  ];

  if (zeroRosterBySeason.size > 0) {
    lines.push("### Auffälligkeiten · Kader = 0", "");
    for (const seasonId of seasonIds) {
      const zero = zeroRosterBySeason.get(seasonId);
      if (!zero || zero.length === 0) continue;
      lines.push(`- **${seasonId.replace("season-", "S")}:** ${zero.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("## Teams · MW · Cash · Kader · Gehalt (S1–S5)", "");

  for (const seasonId of seasonIds) {
    const label = seasonId.replace("season-", "S");
    const byTeam = seasonTeamRows.get(seasonId) ?? new Map();
    const snap = snaps.find((entry) => entry.seasonId === seasonId);
    const source =
      snap && (snap.teamSnapshots?.length || snap.finalStandings?.length)
        ? "Snapshot"
        : seasonId === seasonIds.at(-1)
          ? "Live (Saisonende)"
          : "—";

    lines.push(`### ${label} (${seasonId}) · Quelle: ${source}`, "");
    lines.push("| Team | Rang | MW | Cash | Kader | Gehalt |", "|---|---:|---:|---:|---:|---:|");

    let sumMw = 0;
    let sumCash = 0;
    let sumSalary = 0;
    let sumRoster = 0;
    let count = 0;

    for (const code of teamCodes) {
      const row = byTeam.get(code);
      if (!row) {
        lines.push(`| ${code} | — | — | — | — | — |`);
        continue;
      }
      const fmt = (value: number | null) => (value == null ? "—" : mioRaw(value));
      lines.push(
        `| ${row.teamCode} | ${row.rank ?? "—"} | ${fmt(row.mw)} | ${fmt(row.cash)} | ${row.roster ?? "—"} | ${fmt(row.salary)} |`,
      );
      if (row.mw != null) sumMw += row.mw;
      if (row.cash != null) sumCash += row.cash;
      if (row.salary != null) sumSalary += row.salary;
      if (row.roster != null) sumRoster += row.roster;
      count += 1;
    }

    lines.push(
      `| **Σ Liga** | — | **${mioRaw(sumMw)}** | **${mioRaw(sumCash)}** | **${sumRoster}** | **${mioRaw(sumSalary)}** |`,
      "",
    );
  }

  lines.push("## Teams · Entwicklung pro Team (Querformat)", "");
  const seasonLabels = seasonIds.map((id) => id.replace("season-", "S"));
  lines.push(
    `| Team | ${seasonLabels.map((label) => `MW ${label}`).join(" | ")} | ${seasonLabels.map((label) => `Cash ${label}`).join(" | ")} | ${seasonLabels.map((label) => `Kader ${label}`).join(" | ")} |`,
    `|---|${seasonLabels.map(() => "---:").join("|")}|${seasonLabels.map(() => "---:").join("|")}|${seasonLabels.map(() => "---:").join("|")}|`,
  );

  for (const code of teamCodes) {
    const mwCells = seasonIds.map((seasonId) => {
      const row = seasonTeamRows.get(seasonId)?.get(code);
      return row?.mw != null ? mioRaw(row.mw) : "—";
    });
    const cashCells = seasonIds.map((seasonId) => {
      const row = seasonTeamRows.get(seasonId)?.get(code);
      return row?.cash != null ? mioRaw(row.cash) : "—";
    });
    const rosterCells = seasonIds.map((seasonId) => {
      const row = seasonTeamRows.get(seasonId)?.get(code);
      return row?.roster != null ? String(row.roster) : "—";
    });
    lines.push(`| ${code} | ${mwCells.join(" | ")} | ${cashCells.join(" | ")} | ${rosterCells.join(" | ")} |`);
  }
  lines.push("");

  const expensivePlayers = gs.rosters
    .map((entry) => {
      const player = playerById.get(entry.playerId);
      if (!player) return null;
      const team = teamById.get(entry.teamId);
      const mv = player.displayMarketValue ?? player.marketValue ?? entry.currentValue ?? 0;
      return {
        name: player.name,
        team: team?.shortCode ?? "?",
        ovr: player.ovr ?? player.rating ?? null,
        mv: toMio(mv) ?? 0,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null && entry.mv > 0)
    .sort((left, right) => right.mv - left.mv)
    .slice(0, 10);

  lines.push("## 10 teuerste Spieler (Live · Saisonende S5)", "");
  lines.push("| # | Spieler | Team | OVR | Marktwert |", "|--:|---|---|---:|---:|");
  expensivePlayers.forEach((entry, index) => {
    lines.push(
      `| ${index + 1} | ${entry.name} | ${entry.team} | ${entry.ovr != null ? round(entry.ovr, 1) : "—"} | ${mioRaw(entry.mv)} |`,
    );
  });
  lines.push("");

  // Rollen / Tier-Verteilung (Live, Saisonende): classify each rostered player's market value into
  // the same league brackets the pick engine uses (superstar/star/core/depth/backup/reserve). The
  // "Kern%" column (Star+Core+Depth share) is the anti-clustering signal — a low Kern% with high
  // Backup+Reserve is exactly the "too much backup/reserve" shape to watch per team.
  const leagueBrackets = buildLeagueMarketBrackets(
    gs.players.map((player) => player.displayMarketValue ?? player.marketValue ?? null),
  );
  lines.push("## Rollen · Tier-Verteilung (Live · Saisonende)", "");
  lines.push(
    "| Team | Kader | Superstar | Star | Core | Depth | Backup | Reserve | Kern% |",
    "|---|--:|--:|--:|--:|--:|--:|--:|--:|",
  );
  for (const team of [...gs.teams].sort((left, right) => left.shortCode.localeCompare(right.shortCode, "de"))) {
    const roster = gs.rosters.filter((entry) => entry.teamId === team.teamId);
    const counts: Record<string, number> = { Superstar: 0, Star: 0, Core: 0, Depth: 0, Backup: 0, Reserve: 0 };
    for (const entry of roster) {
      const player = playerById.get(entry.playerId);
      const mv = player?.displayMarketValue ?? player?.marketValue ?? entry.currentValue ?? null;
      counts[classifyMarketBracket(mv, leagueBrackets)] += 1;
    }
    const total = roster.length;
    const kernShare = total > 0 ? Math.round(((counts.Star + counts.Core + counts.Depth) / total) * 100) : 0;
    lines.push(
      `| ${team.shortCode} | ${total} | ${counts.Superstar} | ${counts.Star} | ${counts.Core} | ${counts.Depth} | ${counts.Backup} | ${counts.Reserve} | ${kernShare}% |`,
    );
  }
  lines.push("");

  const organicEvents = (gs.playerProgressionEvents ?? []).filter(
    (event) => event.source === "organic_season_progression",
  );
  const netByPlayer = new Map<string, number>();
  for (const event of organicEvents) {
    if (!seasonIds.includes(event.seasonId)) continue;
    const net = computeNetSetpoints(event);
    netByPlayer.set(event.playerId, (netByPlayer.get(event.playerId) ?? 0) + net);
  }

  const progressionEntries = [...netByPlayer.entries()]
    .map(([playerId, netSetpoints]) => {
      const player = playerById.get(playerId);
      const teamId =
        organicEvents.find((event) => event.playerId === playerId)?.teamId ??
        rosterTeamByPlayer.get(playerId) ??
        "";
      const team = teamById.get(teamId);
      return {
        playerId,
        name: player?.name ?? playerId,
        team: team?.shortCode ?? "?",
        ovr: player?.ovr ?? player?.rating ?? null,
        netSetpoints,
      };
    })
    .sort((left, right) => right.netSetpoints - left.netSetpoints);

  const top10 = progressionEntries.slice(0, 10);
  const bottom10 = [...progressionEntries].sort((left, right) => left.netSetpoints - right.netSetpoints).slice(0, 10);

  lines.push("## Training · Organic Progression (S1–S5 kumuliert)", "");
  lines.push(
    `- **Quelle:** \`organic_season_progression\` (${organicEvents.length} Events über ${seasonIds.length} Seasons)`,
    `- **Spieler mit Progression:** ${progressionEntries.length}`,
    `- **Summe Netto-Pkt. Liga:** ${round(progressionEntries.reduce((sum, entry) => sum + entry.netSetpoints, 0), 1)}`,
    "",
  );

  lines.push(
    formatProgressionTable(
      "Top 10 — größte Verbesserungen durch Training",
      top10.map((entry, index) => ({
        rank: index + 1,
        name: entry.name,
        team: entry.team,
        ovr: entry.ovr != null ? String(round(entry.ovr, 1)) : "—",
        net: `${entry.netSetpoints >= 0 ? "+" : ""}${round(entry.netSetpoints)}`,
      })),
    ),
  );
  lines.push("");
  lines.push(
    formatProgressionTable(
      "Bottom 10 — größte Verschlechterungen durch Training",
      bottom10.map((entry, index) => ({
        rank: index + 1,
        name: entry.name,
        team: entry.team,
        ovr: entry.ovr != null ? String(round(entry.ovr, 1)) : "—",
        net: `${entry.netSetpoints >= 0 ? "+" : ""}${round(entry.netSetpoints)}`,
      })),
    ),
  );
  lines.push("");

  const injuryEvents = (gs.seasonState.injuryEvents ?? []).filter((event) => seasonIds.includes(event.seasonId));
  const injuredEvents = injuryEvents.filter((event) => event.result === "injured");
  const injuriesByTeam = new Map<string, number>();
  const injuriesByPlayer = new Map<string, number>();
  const injuriesBySeason = new Map<string, number>();
  for (const event of injuredEvents) {
    const team = teamById.get(event.teamId);
    const teamCode = team?.shortCode ?? event.teamId;
    injuriesByTeam.set(teamCode, (injuriesByTeam.get(teamCode) ?? 0) + 1);
    injuriesByPlayer.set(event.playerId, (injuriesByPlayer.get(event.playerId) ?? 0) + 1);
    injuriesBySeason.set(event.seasonId, (injuriesBySeason.get(event.seasonId) ?? 0) + 1);
  }
  const avgRiskPercent = round(
    injuredEvents.length > 0
      ? injuredEvents.reduce((sum, event) => sum + (event.riskPercent ?? 0), 0) / injuredEvents.length
      : 0,
    1,
  );
  const avgUnavailableMatchdays = round(
    injuredEvents.length > 0
      ? injuredEvents.reduce((sum, event) => sum + (event.unavailableForMatchdays ?? 1), 0) / injuredEvents.length
      : 0,
    2,
  );

  lines.push("## Verletzungen (S1–S5)", "");
  lines.push(
    `- **Risiko-Rolls gesamt:** ${injuryEvents.length} (davon **${injuredEvents.length}** tatsächliche Verletzungen)`,
    `- **Ø Risiko% bei Verletzung:** ${avgRiskPercent}%`,
    `- **Ø Ausfall (Spieltage) je Verletzung:** ${avgUnavailableMatchdays}`,
    `- **Betroffene Spieler (mind. 1x verletzt):** ${injuriesByPlayer.size}`,
    "",
  );

  lines.push("### Verletzungen pro Season", "");
  lines.push("| Season | Verletzungen |", "|---|---:|");
  for (const seasonId of seasonIds) {
    lines.push(`| ${seasonId.replace("season-", "S")} | ${injuriesBySeason.get(seasonId) ?? 0} |`);
  }
  lines.push("");

  lines.push("### Verletzungen pro Team", "");
  lines.push("| Team | Verletzungen |", "|---|---:|");
  for (const code of teamCodes) {
    lines.push(`| ${code} | ${injuriesByTeam.get(code) ?? 0} |`);
  }
  lines.push("");

  const lastInjuryTeamByPlayer = new Map<string, string>();
  for (const event of injuredEvents) {
    lastInjuryTeamByPlayer.set(event.playerId, event.teamId);
  }
  const mostInjuredPlayers = [...injuriesByPlayer.entries()]
    .map(([playerId, count]) => {
      const player = playerById.get(playerId);
      const teamId = rosterTeamByPlayer.get(playerId) ?? lastInjuryTeamByPlayer.get(playerId) ?? "";
      const team = teamById.get(teamId);
      return { name: player?.name ?? playerId, team: team?.shortCode ?? "?", count };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 10);
  if (mostInjuredPlayers.length > 0) {
    lines.push("### Top 10 — am häufigsten verletzte Spieler", "");
    lines.push("| # | Spieler | Team | Verletzungen |", "|--:|---|---|---:|");
    mostInjuredPlayers.forEach((entry, index) => {
      lines.push(`| ${index + 1} | ${entry.name} | ${entry.team} | ${entry.count} |`);
    });
    lines.push("");
  }

  const facilityIds = FACILITY_CATALOG.map((facility) => facility.facilityId);
  const facilityEvents = (gs.seasonState.facilityEvents ?? []).filter((event) => seasonIds.includes(event.seasonId));
  const facilityUpgradeEvents = facilityEvents.filter((event) => (event.nextLevel ?? 0) > (event.previousLevel ?? 0));
  const upgradesBySeason = new Map<string, number>();
  for (const event of facilityUpgradeEvents) {
    upgradesBySeason.set(event.seasonId, (upgradesBySeason.get(event.seasonId) ?? 0) + 1);
  }

  lines.push("## Gebäude / Facilities (Stand S5-Ende)", "");
  lines.push(`- **Facility-Upgrades gesamt (S1–S5):** ${facilityUpgradeEvents.length}`, "");
  lines.push("### Upgrades pro Season", "");
  lines.push("| Season | Upgrades |", "|---|---:|");
  for (const seasonId of seasonIds) {
    lines.push(`| ${seasonId.replace("season-", "S")} | ${upgradesBySeason.get(seasonId) ?? 0} |`);
  }
  lines.push("");

  lines.push("### Facility-Level pro Team (Live-Stand)", "");
  const facilityShortLabels = facilityIds.map((id) => id.replace(/_center|_office|_room|_upgrade|_shop|_wing/g, "").slice(0, 5));
  lines.push(
    `| Team | ${facilityShortLabels.join(" | ")} | Ø Zustand% | Ø Effizienz% |`,
    `|---|${facilityShortLabels.map(() => "---:").join("|")}|---:|---:|`,
  );
  let teamsWithAllZero = 0;
  const levelTotals = Object.fromEntries(facilityIds.map((id) => [id, 0])) as Record<string, number>;
  for (const team of gs.teams) {
    const facilities = getTeamFacilityState(gs, team.teamId);
    const levels = facilityIds.map((facilityId) => {
      const level = facilities.facilities[facilityId]?.level ?? 0;
      levelTotals[facilityId] += level;
      return level;
    });
    const conditions: number[] = [];
    const efficiencies: number[] = [];
    for (const facilityId of facilityIds) {
      const efficiency = getFacilityEfficiency(facilities, facilityId);
      if ((facilities.facilities[facilityId]?.level ?? 0) > 0) {
        conditions.push(efficiency.conditionPct);
        efficiencies.push(efficiency.efficiencyPct);
      }
    }
    if (levels.every((level) => level === 0)) teamsWithAllZero += 1;
    const condAvg = conditions.length ? Math.round(conditions.reduce((sum, value) => sum + value, 0) / conditions.length) : null;
    const effAvg = efficiencies.length ? Math.round(efficiencies.reduce((sum, value) => sum + value, 0) / efficiencies.length) : null;
    const team2 = teamById.get(team.teamId);
    lines.push(
      `| ${team2?.shortCode ?? team.teamId} | ${levels.join(" | ")} | ${condAvg ?? "—"} | ${effAvg ?? "—"} |`,
    );
  }
  lines.push(
    "",
    `- **Ø Level je Facility (Liga):** ${facilityIds.map((id, index) => `${facilityShortLabels[index]}=${round(levelTotals[id] / Math.max(gs.teams.length, 1), 2)}`).join(", ")}`,
    `- **Teams ohne jedes Gebäude (Level 0 überall):** ${teamsWithAllZero} / ${gs.teams.length}`,
    "",
  );

  lines.push("## Beobachtungen", "");
  const observations: string[] = [];

  const s4Zero = zeroRosterBySeason.get("season-4") ?? [];
  if (s4Zero.length > 0) {
    const recovered = s4Zero.filter((code) => {
      const s5 = seasonTeamRows.get("season-5")?.get(code);
      return (s5?.roster ?? 0) > 0;
    });
    observations.push(
      `In **S4** hatten ${s4Zero.length} Teams keinen Kader (${s4Zero.join(", ")}). Am S5-Ende sind ${recovered.length} davon wieder aufgebaut${recovered.length > 0 ? `: ${recovered.join(", ")}` : ""}.`,
    );
  }

  const s5Rows = seasonTeamRows.get("season-5");
  if (s5Rows) {
    const cashSorted = [...s5Rows.values()]
      .filter((row) => row.cash != null)
      .sort((left, right) => (right.cash ?? 0) - (left.cash ?? 0));
    const mwSorted = [...s5Rows.values()]
      .filter((row) => row.mw != null)
      .sort((left, right) => (right.mw ?? 0) - (left.mw ?? 0));
    if (cashSorted[0]) {
      observations.push(
        `Reichstes Team S5: **${cashSorted[0].teamCode}** (${mioRaw(cashSorted[0].cash)} Mio € Cash).`,
      );
    }
    if (mwSorted[0]) {
      observations.push(
        `Höchster Kader-MW S5: **${mwSorted[0].teamCode}** (${mioRaw(mwSorted[0].mw)} Mio €).`,
      );
    }
    const poorCash = [...s5Rows.values()].filter((row) => (row.cash ?? 0) <= 5);
    if (poorCash.length > 0) {
      observations.push(
        `Teams mit Cash ≤ 5 Mio € am S5-Ende: ${poorCash.map((row) => row.teamCode).join(", ")}.`,
      );
    }
    const s1TotalCash = [...(seasonTeamRows.get("season-1")?.values() ?? [])].reduce(
      (sum, row) => sum + (row.cash ?? 0),
      0,
    );
    const s5TotalCash = [...s5Rows.values()].reduce((sum, row) => sum + (row.cash ?? 0), 0);
    if (s1TotalCash > 0 && s5TotalCash > 0) {
      observations.push(
        `Liga-Cash gesamt: S1 **${mioRaw(s1TotalCash)}** → S5 **${mioRaw(s5TotalCash)}** Mio € (−${mioRaw(s1TotalCash - s5TotalCash)}).`,
      );
    }
    const negativeCashS4 = [...(seasonTeamRows.get("season-4")?.values() ?? [])].filter(
      (row) => (row.cash ?? 0) < 0,
    );
    if (negativeCashS4.length > 0) {
      observations.push(
        `Negatives Cash in S4: ${negativeCashS4.map((row) => `${row.teamCode} (${mioRaw(row.cash!)})`).join(", ")}.`,
      );
    }
  }

  if (top10[0]) {
    observations.push(
      `Stärkster Trainings-Gewinner (kumuliert): **${top10[0].name}** (${top10[0].team}, +${round(top10[0].netSetpoints)} Attr.-Pkt.).`,
    );
  }
  if (bottom10[0]) {
    observations.push(
      `Stärkster Trainings-Verlierer (kumuliert): **${bottom10[0].name}** (${bottom10[0].team}, ${round(bottom10[0].netSetpoints)} Attr.-Pkt.).`,
    );
  }

  if (observations.length === 0) {
    lines.push("- Keine besonderen Auffälligkeiten.");
  } else {
    for (const note of observations) lines.push(`- ${note}`);
  }
  lines.push("");

  return lines.join("\n");
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  const outputDir = argValue("--output-dir");
  const seasonCount = Number(argValue("--seasons") ?? "5");
  if (!saveId || !outputDir) throw new Error("Missing --save-id or --output-dir");

  const save = createPersistenceService().getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const seasonIds = Array.from({ length: seasonCount }, (_, index) => `season-${index + 1}`);
  const markdown = buildBalancingSaveReviewMarkdown({
    saveId,
    seasonIds,
    gs: save.gameState,
    saveName: save.name,
  });

  fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, "balancing-s5-review.md");
  fs.writeFileSync(outPath, `${markdown}\n`);
  console.log(`Wrote ${outPath}`);
}

const isDirectRun = process.argv[1]?.includes("export-balancing-save-review");
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
