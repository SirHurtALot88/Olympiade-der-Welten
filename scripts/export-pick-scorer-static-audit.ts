import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildAiTransfermarktPreview } from "@/lib/ai/ai-transfermarkt-preview-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

type CliArgs = {
  saveId: string | null;
  teamIds: string[];
};

type TeamRecommendation = {
  teamCode: string;
  score: number | null;
  fitSummary: string;
  sportsSummary: string;
  reasons: string[];
  warnings: string[];
  price: number | null;
  salary: number | null;
  marketValue: number | null;
  contractLength: number | null;
};

function parseArgs(argv: string[]): CliArgs {
  let saveId: string | null = null;
  const teamIds: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--save-id") {
      saveId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--team-id") {
      const value = argv[index + 1] ?? "";
      if (value) {
        teamIds.push(value);
      }
      index += 1;
    }
  }
  return { saveId, teamIds };
}

function csvCell(value: unknown) {
  const normalized =
    value == null
      ? ""
      : Array.isArray(value)
        ? value.join(" | ")
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  return `"${normalized.replaceAll(`"`, `""`)}"`;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return "";
  }
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

function round(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return Number(value.toFixed(digits));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();
  const activeSave = persistence.getActiveSave();
  const saveId = args.saveId ?? activeSave?.saveId ?? null;
  if (!saveId) {
    throw new Error("Kein Save fuer den Pick-Scorer-Audit aufloesbar.");
  }

  const teamIds = args.teamIds.length > 0 ? args.teamIds : ["C-C", "W-W", "T-T", "A-A"];
  const preview = await buildAiTransfermarktPreview({
    source: "sqlite",
    saveId,
    teamScope: "all",
    limit: 220,
    fullScoringLimit: 220,
    buyNeedOnly: false,
  });

  const scopedTeams = preview.teams.filter((team) => teamIds.includes(team.teamId) || teamIds.includes(team.teamCode));
  if (scopedTeams.length < 2) {
    throw new Error(`Zu wenige Teams fuer den Audit gefunden: ${teamIds.join(", ")}`);
  }

  const playerRows = new Map<
    string,
    {
      playerName: string;
      className: string;
      race: string;
      teams: TeamRecommendation[];
    }
  >();

  for (const team of scopedTeams) {
    for (const candidate of team.legalCandidatePool ?? []) {
      const current = playerRows.get(candidate.playerId) ?? {
        playerName: candidate.playerName,
        className: candidate.className,
        race: candidate.race,
        teams: [],
      };
      current.teams.push({
        teamCode: team.teamCode,
        score: round(candidate.overallRecommendationScore ?? candidate.score ?? null, 2),
        fitSummary: candidate.fitSummary,
        sportsSummary: candidate.sportsSummary,
        reasons: [candidate.reason, ...candidate.strategyNotes].filter(Boolean).slice(0, 4),
        warnings: candidate.warnings.slice(0, 3),
        price: round(candidate.price ?? null, 2),
        salary: round(candidate.salary ?? null, 2),
        marketValue: round(candidate.marketValue ?? null, 2),
        contractLength: candidate.contractLength ?? null,
      });
      playerRows.set(candidate.playerId, current);
    }
  }

  const comparisonRows = [...playerRows.entries()]
    .map(([playerId, entry]) => {
      const sortedTeams = [...entry.teams].sort((left, right) => (right.score ?? -999) - (left.score ?? -999));
      if (sortedTeams.length < 2) {
        return null;
      }
      const best = sortedTeams[0];
      const worst = sortedTeams[sortedTeams.length - 1];
      return {
        playerId,
        playerName: entry.playerName,
        className: entry.className,
        race: entry.race,
        comparedTeams: sortedTeams.length,
        bestTeam: best.teamCode,
        bestScore: best.score,
        bestFit: best.fitSummary,
        bestSports: best.sportsSummary,
        bestReasons: best.reasons.join(" | "),
        worstTeam: worst.teamCode,
        worstScore: worst.score,
        worstFit: worst.fitSummary,
        worstSports: worst.sportsSummary,
        worstReasons: worst.reasons.join(" | "),
        scoreGap: round((best.score ?? 0) - (worst.score ?? 0), 2),
        marketValue: best.marketValue ?? worst.marketValue,
        salary: best.salary ?? worst.salary,
        price: best.price ?? worst.price,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => (right.scoreGap ?? 0) - (left.scoreGap ?? 0));

  const detailRows = [...playerRows.entries()].flatMap(([playerId, entry]) =>
    entry.teams.map((team) => ({
      playerId,
      playerName: entry.playerName,
      className: entry.className,
      race: entry.race,
      teamCode: team.teamCode,
      score: team.score,
      fitSummary: team.fitSummary,
      sportsSummary: team.sportsSummary,
      reasons: team.reasons.join(" | "),
      warnings: team.warnings.join(" | "),
      price: team.price,
      salary: team.salary,
      marketValue: team.marketValue,
      contractLength: team.contractLength,
    })),
  );

  const markdownLines = [
    "# Pick-Scorer Static Audit",
    "",
    `- Save: ${saveId}`,
    `- Teams: ${scopedTeams.map((team) => team.teamCode).join(", ")}`,
    `- Verglichene Marktspieler: ${comparisonRows.length}`,
    "",
    "## Team-Pool-Status",
    "",
    ...scopedTeams.map(
      (team) =>
        `- ${team.teamCode}: Status ${team.status} · legal ${(team.legalCandidatePool ?? []).length} · topTargets ${team.topTargets.length} · buys ${team.recommendedBuys.length} · ${team.explanation}`,
    ),
    "",
    "## Groesste Bewertungsunterschiede",
    "",
    ...comparisonRows.slice(0, 20).map(
      (row) =>
        `- ${row.playerName} (${row.className}/${row.race}): ${row.bestTeam} ${row.bestScore} vs ${row.worstTeam} ${row.worstScore} · Gap ${row.scoreGap} · Fit ${row.bestFit} vs ${row.worstFit}`,
    ),
    ...(comparisonRows.length === 0
      ? [
          "",
          "Hinweis: Fuer diese Teamauswahl gab es auf dem aktuellen Snapshot keine ueberlappenden legalen Kandidaten. Das spricht entweder fuer sehr harte Vorfilter oder fuer ein Marktfenster ohne offene Kaufpfade.",
        ]
      : []),
    "",
  ];

  const exportDir = path.resolve(process.cwd(), "tmp", "exports");
  await mkdir(exportDir, { recursive: true });
  await writeFile(path.join(exportDir, "pick-scorer-static-summary.csv"), toCsv(comparisonRows), "utf8");
  await writeFile(path.join(exportDir, "pick-scorer-static-audit.csv"), toCsv(detailRows), "utf8");
  await writeFile(path.join(exportDir, "pick-scorer-static-audit.md"), `${markdownLines.join("\n")}\n`, "utf8");

  console.log(`Pick-Scorer Static Audit fertig. ${comparisonRows.length} Spieler-Vergleiche exportiert nach ${exportDir}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
