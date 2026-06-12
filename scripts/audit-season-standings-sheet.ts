import {
  inspectPrizeMoneySheet,
  inspectRankToPointsSheet,
  inspectSeasonStandingsSheet,
  LOCAL_PRIZE_MONEY_CSV_PATH,
  LOCAL_PRIZE_MONEY_JSON_PATH,
  LOCAL_RANK_TO_POINTS_CSV_PATH,
  LOCAL_RANK_TO_POINTS_JSON_PATH,
  LOCAL_STANDINGS_CSV_PATH,
  LOCAL_STANDINGS_JSON_PATH,
  type StandingsDetectedTabKind,
  type StandingsSheetAudit,
  type SeasonStandingsSheetRow,
  mapSeasonStandingsRowsToTeams,
} from "@/lib/standings/season-standings-sheet";
import {
  PRIZE_MONEY_NORMALIZED_CSV_PATH,
  PRIZE_MONEY_NORMALIZED_JSON_PATH,
} from "@/lib/season/prize-money-sheet";
import { loadEnvConfig } from "@next/env";
import { db } from "@/src/server/db";

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = current.slice(2).split("=", 2);
    if (inlineValue != null) {
      args.set(rawKey, inlineValue);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(rawKey, next);
      index += 1;
      continue;
    }

    args.set(rawKey, "true");
  }

  return {
    gid: args.get("gid") ?? null,
    url: args.get("url") ?? null,
  };
}

function buildSheetUrlFromGid(gid: string) {
  return `https://docs.google.com/spreadsheets/d/1Y4DJWoLBcEAWuS4dXTqnZK_6UXZe7NJtRD-rNjYc8Fk/export?format=csv&gid=${gid}`;
}

function formatTabKind(kind: StandingsDetectedTabKind) {
  return kind.replaceAll("_", " ");
}

function printAudit(audit: StandingsSheetAudit) {
  console.log(`sourceKind: ${audit.sourceKind}`);
  console.log(`sheetUrl: ${audit.sheetUrl ?? "none"}`);
  console.log(`access: ${audit.access}`);
  console.log(`status: ${audit.status}`);
  console.log(`detectedTabKind: ${formatTabKind(audit.detectedTabKind)}`);
  console.log(`rowsCount: ${audit.rowsCount}`);
  console.log(`headers: ${audit.headers.length ? audit.headers.join(" | ") : "none"}`);
  console.log(`detectedColumns: ${audit.detectedColumns.length ? audit.detectedColumns.join(" | ") : "none"}`);

  if (audit.reason) {
    console.log(`reason: ${audit.reason}`);
  }

  console.log("expectedExportPaths:");
  for (const exportPath of audit.expectedExportPaths) {
    console.log(`- ${exportPath}`);
  }

  console.log("sampleRows:");
  if (!audit.sampleRows.length) {
    console.log("- none");
  } else {
    for (const row of audit.sampleRows.slice(0, 3)) {
      console.log(`- ${JSON.stringify(row)}`);
    }
  }

  console.log("mappedRows:");
  if (!audit.mappedRows.length) {
    console.log("- none");
  } else {
    for (const row of audit.mappedRows.slice(0, 3)) {
      console.log(`- ${JSON.stringify(row)}`);
    }
  }

  if (audit.invalidRows.length) {
    console.log(`invalidRows: ${audit.invalidRows.join(" | ")}`);
  }
  if (audit.duplicateRanks.length) {
    console.log(`duplicateRanks: ${audit.duplicateRanks.join(" | ")}`);
  }
  if (audit.missingPrizeValues.length) {
    console.log(`missingPrizeValues: ${audit.missingPrizeValues.join(" | ")}`);
  }
  if (audit.warnings.length) {
    console.log(`warnings: ${audit.warnings.join(" | ")}`);
  }
  if (audit.candidateHeaderRows?.length) {
    console.log(`candidateHeaderRows: ${audit.candidateHeaderRows.join(" | ")}`);
  }
  if (audit.candidateDataRanges?.length) {
    console.log(`candidateDataRanges: ${audit.candidateDataRanges.join(" | ")}`);
  }
  if (audit.detectedBlocks?.length) {
    console.log("detectedBlocks:");
    for (const block of audit.detectedBlocks) {
      console.log(
        `- ${block.id} ${block.status} rows=${block.rowsCount} rowRange=${block.startRow}-${block.endRow} colRange=${block.startCol}-${block.endCol} headers=${block.headers.join(" | ") || "none"}${block.reason ? ` reason=${block.reason}` : ""}`,
      );
    }
  }
  if (audit.rejectedBlocks?.length) {
    console.log("rejectedBlocks:");
    for (const block of audit.rejectedBlocks) {
      console.log(`- ${block.id}: ${block.reason}`);
    }
  }
  if (audit.selectedBlock) {
    console.log(
      `selectedBlock: ${audit.selectedBlock.id} rows=${audit.selectedBlock.rowsCount} rowRange=${audit.selectedBlock.startRow}-${audit.selectedBlock.endRow} colRange=${audit.selectedBlock.startCol}-${audit.selectedBlock.endCol}`,
    );
  }
}

function isSeasonStandingsRow(row: unknown): row is SeasonStandingsSheetRow {
  return typeof row === "object" && row != null && "rawTeamLabel" in row && "currentPoints" in row;
}

async function main() {
  loadEnvConfig(process.cwd());
  const args = parseArgs(process.argv.slice(2));
  const seasonUrl = args.url ?? (args.gid ? buildSheetUrlFromGid(args.gid) : undefined);

  const [seasonAudit, rankAudit, prizeAudit] = await Promise.all([
    inspectSeasonStandingsSheet({ url: seasonUrl }),
    inspectRankToPointsSheet(),
    inspectPrizeMoneySheet(),
  ]);

  console.log("=== season standings ===");
  printAudit(seasonAudit);
  if (seasonAudit.status === "ok" && process.env.DATABASE_URL) {
    const teams = await db.teamSeasonState.findMany({
      where: { saveId: "save-initial", seasonId: "season-1" },
      select: {
        teamId: true,
        team: { select: { name: true, shortCode: true } },
      },
      orderBy: [{ teamId: "asc" }],
    });
    const mapping = mapSeasonStandingsRowsToTeams(
      seasonAudit.mappedRows.filter(isSeasonStandingsRow),
      teams.map((teamState) => ({
        teamId: teamState.teamId,
        shortCode: teamState.team.shortCode,
        teamName: teamState.team.name,
      })),
    );
    console.log("mappingSummary:");
    console.log(`- mappedTeamsCount: ${mapping.mappedTeamsCount}`);
    console.log(`- missingInSheet: ${mapping.missingInSheet.length}`);
    console.log(`- missingInDb: ${mapping.missingInDb.length}`);
    console.log(`- duplicateSheetTeams: ${mapping.duplicateSheetTeams.length}`);
    console.log(`- ambiguousMappings: ${mapping.ambiguousMappings.length}`);
  }
  console.log("");
  console.log("=== rank to points ===");
  printAudit(rankAudit);
  console.log("");
  console.log("=== prize money ===");
  printAudit(prizeAudit);
  console.log("");
  console.log("expectedLocalFiles:");
  console.log(`- ${LOCAL_STANDINGS_CSV_PATH}`);
  console.log(`- ${LOCAL_STANDINGS_JSON_PATH}`);
  console.log(`- ${LOCAL_RANK_TO_POINTS_CSV_PATH}`);
  console.log(`- ${LOCAL_RANK_TO_POINTS_JSON_PATH}`);
  console.log(`- ${LOCAL_PRIZE_MONEY_CSV_PATH}`);
  console.log(`- ${LOCAL_PRIZE_MONEY_JSON_PATH}`);
  console.log(`- ${PRIZE_MONEY_NORMALIZED_CSV_PATH}`);
  console.log(`- ${PRIZE_MONEY_NORMALIZED_JSON_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "standings sheet audit failed");
  process.exitCode = 1;
});
