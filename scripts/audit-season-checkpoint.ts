/**
 * Read-only per-season checkpoint audit for long balancing runs.
 *
 * Reads the LIVE save directly (no clone, no writes) right after a season reaches
 * `season_completed`, and reports per-team Cash/MW/Salary/Kader, how many teams are
 * at/above Opt, the season's emergency-filler quote (reusing the classification from
 * scripts/generate-balancing-report.ts), and the salary factor applied for the season.
 *
 * Usage:
 *   npx tsx scripts/audit-season-checkpoint.ts \
 *     --save-id <id> \
 *     --output-dir <dir> \
 *     [--season-id season-3]
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

import { getTeamHardMinRequired, getTeamOptTarget } from "@/lib/ai/ai-market-plan-convergence-service";
import type { GameState, SeasonSnapshotTeamRecord, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

import { seasonBuyFidelity } from "@/scripts/generate-balancing-report";

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

function toMio(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return value >= 1_000_000 ? value / 1_000_000 : value;
}

function fmt(value: number | null) {
  return value == null ? "—" : round(value, 1).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

type TeamCheckpointRow = {
  teamId: string;
  teamCode: string;
  cash: number | null;
  mw: number | null;
  salary: number | null;
  roster: number | null;
  hardMin: number;
  optTarget: number;
  atOpt: boolean;
  belowHardMin: boolean;
  rosterZero: boolean;
  optGap: number;
  optGapCategory: OptGapCategory;
  optGapReason: string | null;
};

export type OptGapCategory = "at_or_above_opt" | "opt_gap_acceptable" | "opt_gap_red_flag";

/**
 * Graduated Opt-Gap rule (User-Vorgabe 2026-07-04): eine rohe Opt-Quote allein verschleiert,
 * OB ein Rückstand harmlos (bewusste Planner-Entscheidung mangels gutem Fit-Kandidaten, oder
 * Cash-Knappheit) oder ein echtes Rotations-Risiko (Fatigue/Verletzungen bei zu wenig Kader) ist.
 *
 * - gap 0: at_or_above_opt.
 * - gap 1-2: opt_gap_acceptable, ABER nur mit explizitem Grund (cash_constrained ODER
 *   planner_decision_no_fit — inferiert, da kein direkter Log-Zugriff auf die Pick-Preview an
 *   dieser Stelle: liegt das verbleibende Cash unter der Cheap-Fill-Schwelle, war das Team
 *   Cash-limitiert; sonst wird angenommen, dass der Planner bewusst keinen Fit-Kandidaten mehr
 *   gekauft hat, weil ausreichend Cash für einen weiteren Pick vorhanden gewesen wäre).
 * - gap >=3: opt_gap_red_flag — nicht ausreichend für gesunden Rotationsbetrieb, muss aktiv
 *   gefixt werden (Rebuild über Unified-Engine erzwingen), nicht nur dokumentiert.
 */
const CASH_CONSTRAINED_THRESHOLD_MIO = 3.0;

function classifyOptGap(input: { gap: number; cash: number | null }): { category: OptGapCategory; reason: string | null } {
  if (input.gap <= 0) return { category: "at_or_above_opt", reason: null };
  if (input.gap >= 3) {
    return {
      category: "opt_gap_red_flag",
      reason: `${input.gap} Spieler unter Opt — reicht nicht für gesunden Rotationsbetrieb (Fatigue/Verletzungen), aktiver Fix nötig`,
    };
  }
  const cashConstrained = input.cash != null && input.cash < CASH_CONSTRAINED_THRESHOLD_MIO;
  return {
    category: "opt_gap_acceptable",
    reason: cashConstrained
      ? `cash_constrained: verbleibendes Cash ${fmt(input.cash)} < Schwelle ${fmt(CASH_CONSTRAINED_THRESHOLD_MIO)} (Mio) für einen weiteren Cheap-Fill-Pick`
      : `planner_decision_no_fit (inferiert): ausreichend Cash vorhanden (${fmt(input.cash)}), Planner hat bewusst keinen weiteren Pick ohne guten Fit ausgeführt`,
  };
}

function snapshotRow(row: SeasonSnapshotTeamRecord) {
  return {
    teamId: row.teamId,
    teamCode: row.teamCode,
    cash: toMio(row.cashEnd),
    mw: toMio(row.marketValueEnd ?? row.marketValueTotalEnd),
    salary: toMio(row.salaryEnd ?? row.salaryTotalEnd),
    roster: row.rosterEnd ?? row.rosterCountEnd ?? null,
  };
}

/** Resolves the salary factor that was active for `seasonId`. Only exact for the season
 * currently referenced by gs.season.id (the window only looks forward from "now"); for
 * already-passed seasons this returns null since the window has since advanced. */
function resolveSeasonSalaryFactor(gs: GameState, seasonId: string): number | null {
  if (gs.season.id !== seasonId) return null;
  const entry = (gs.seasonState.seasonEconomyFactors ?? []).find((record) => record.horizonIndex === 0);
  return entry ? round(entry.factor, 2) : null;
}

export function buildSeasonCheckpointMarkdown(input: {
  saveId: string;
  seasonId: string;
  gs: GameState;
}) {
  const { saveId, seasonId, gs } = input;
  const teamById = new Map(gs.teams.map((team) => [team.teamId, team]));

  const snaps = gs.seasonState.seasonSnapshots ?? [];
  const snap = snaps.find((entry) => entry.seasonId === seasonId);
  const rows = snap?.teamSnapshots ?? snap?.finalStandings ?? [];
  const isLive = rows.length === 0 && gs.season.id === seasonId;

  const teamRows: TeamCheckpointRow[] = gs.teams.map((team) => {
    const hardMin = getTeamHardMinRequired(gs, team.teamId);
    const optTarget = getTeamOptTarget(gs, team.teamId);
    const snapRow = rows.find((entry) => entry.teamId === team.teamId);
    let cash: number | null;
    let mw: number | null;
    let salary: number | null;
    let roster: number | null;

    if (snapRow) {
      const normalized = snapshotRow(snapRow);
      cash = normalized.cash;
      mw = normalized.mw;
      salary = normalized.salary;
      roster = normalized.roster;
    } else if (isLive) {
      const rosterEntries = gs.rosters.filter((entry) => entry.teamId === team.teamId);
      const playerById = new Map(gs.players.map((player) => [player.id, player]));
      const mwSum = rosterEntries.reduce((sum, entry) => {
        const player = playerById.get(entry.playerId);
        return sum + (player?.displayMarketValue ?? player?.marketValue ?? 0);
      }, 0);
      const salarySum = rosterEntries.reduce((sum, entry) => sum + (entry.salary ?? 0), 0);
      cash = toMio(team.cash ?? null);
      mw = toMio(mwSum);
      salary = toMio(salarySum);
      roster = rosterEntries.length;
    } else {
      cash = null;
      mw = null;
      salary = null;
      roster = null;
    }

    const optGap = roster != null ? Math.max(0, optTarget - roster) : 0;
    const optGapClassification = classifyOptGap({ gap: optGap, cash });

    return {
      teamId: team.teamId,
      teamCode: team.shortCode,
      cash,
      mw,
      salary,
      roster,
      hardMin,
      optTarget,
      atOpt: roster != null && roster >= optTarget,
      belowHardMin: roster != null && roster < hardMin,
      rosterZero: roster === 0,
      optGap,
      optGapCategory: optGapClassification.category,
      optGapReason: optGapClassification.reason,
    };
  });

  const teamsAtOpt = teamRows.filter((row) => row.atOpt).length;
  const teamsBelowHardMin = teamRows.filter((row) => row.belowHardMin);
  const teamsRosterZero = teamRows.filter((row) => row.rosterZero);
  const teamsOptGapAcceptable = teamRows.filter((row) => row.optGapCategory === "opt_gap_acceptable");
  const teamsOptGapRedFlag = teamRows.filter((row) => row.optGapCategory === "opt_gap_red_flag");
  const fidelity = seasonBuyFidelity(gs.transferHistory ?? [], seasonId);
  const salaryFactor = resolveSeasonSalaryFactor(gs, seasonId);

  const negativeCashTeams = teamRows.filter((row) => (row.cash ?? 0) < 0);

  const lines: string[] = [
    `# Season Checkpoint · ${seasonId}`,
    "",
    `**Save:** \`${saveId}\``,
    `**Stand:** ${gs.season.id} · Phase: ${gs.gamePhase ?? "?"} · Quelle: ${snap ? "Snapshot" : isLive ? "Live" : "unbekannt (keine Daten)"}`,
    `**Erstellt:** ${new Date().toISOString()}`,
    "",
    "## Zielwerte-Check",
    "",
    `- **Teams ≥ Opt:** ${teamsAtOpt}/${gs.teams.length} (Ziel: ≥28/32) → ${teamsAtOpt >= 28 ? "✅ PASS" : "❌ RED"}`,
    `- **Opt-Gap 1-2 (akzeptabel, mit Grund):** ${teamsOptGapAcceptable.length} (${teamsOptGapAcceptable.map((row) => row.teamCode).join(", ") || "—"})`,
    `- **Opt-Gap 3+ (RED FLAG, aktiver Fix nötig):** ${teamsOptGapRedFlag.length} (${teamsOptGapRedFlag.map((row) => row.teamCode).join(", ") || "—"}) → ${teamsOptGapRedFlag.length === 0 ? "✅ PASS" : "❌ RED — Rebuild über Unified-Engine erzwingen"}`,
    `- **Emergency-Filler-Quote:** ${fidelity.buys > 0 ? `${fidelity.emergency}/${fidelity.buys} (${fidelity.emergencyPct}%)` : "— (keine Buys)"} (Ziel: <15%) → ${fidelity.buys === 0 || fidelity.emergencyPct < 15 ? "✅ PASS" : "❌ RED"}`,
    `- **Teams unter hardMin:** ${teamsBelowHardMin.length} (${teamsBelowHardMin.map((row) => row.teamCode).join(", ") || "—"})`,
    `- **Teams mit Kader = 0 (Negative-Cash-Spiral-Risiko):** ${teamsRosterZero.length} (${teamsRosterZero.map((row) => row.teamCode).join(", ") || "—"})`,
    `- **Teams mit negativem Cash:** ${negativeCashTeams.length} (${negativeCashTeams.map((row) => row.teamCode).join(", ") || "—"})`,
    `- **Salary-Faktor dieser Season:** ${salaryFactor ?? "n/a (Fenster bereits weitergeschoben — siehe OLY_LONG_RUN_SALARY_FACTOR_PATTERN im finalen Report)"}`,
    "",
    "## Teams · Cash/MW/Kader/Gehalt",
    "",
    "| Team | Cash | MW | Kader | hardMin | Opt | Gehalt | ≥Opt | Opt-Gap-Status |",
    "|---|---:|---:|---:|---:|---:|---:|:--:|---|",
  ];

  const optGapBadge = (category: OptGapCategory) =>
    category === "at_or_above_opt" ? "" : category === "opt_gap_acceptable" ? "🟡 acceptable" : "🔴 RED FLAG";

  for (const row of [...teamRows].sort((left, right) => left.teamCode.localeCompare(right.teamCode, "de"))) {
    lines.push(
      `| ${row.teamCode} | ${fmt(row.cash)} | ${fmt(row.mw)} | ${row.roster ?? "—"} | ${row.hardMin} | ${row.optTarget} | ${fmt(row.salary)} | ${row.atOpt ? "✅" : "—"} | ${optGapBadge(row.optGapCategory)} |`,
    );
  }
  lines.push("");

  if (teamsOptGapAcceptable.length > 0 || teamsOptGapRedFlag.length > 0) {
    lines.push("### Opt-Gap-Begründungen (nur betroffene Teams)", "");
    lines.push("| Team | Gap | Kategorie | Grund |", "|---|---:|---|---|");
    for (const row of [...teamRows]
      .filter((row) => row.optGap > 0)
      .sort((left, right) => right.optGap - left.optGap || left.teamCode.localeCompare(right.teamCode, "de"))) {
      lines.push(
        `| ${row.teamCode} | ${row.optGap} | ${row.optGapCategory === "opt_gap_red_flag" ? "🔴 red_flag" : "🟡 acceptable"} | ${row.optGapReason ?? "—"} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Pick-Fidelity dieser Season", "");
  lines.push(
    `- Buys: **${fidelity.buys}** (Planned Market: ${fidelity.plannedMarket}, Planned Other: ${fidelity.plannedOther}, Emergency: ${fidelity.emergency})`,
    `- Emergency-Anteil: **${fidelity.emergencyPct}%**`,
    `- Planned-Anteil: **${fidelity.plannedPct}%**`,
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
  const markdown = buildSeasonCheckpointMarkdown({ saveId, seasonId, gs: save.gameState });

  fs.mkdirSync(outputDir, { recursive: true });
  const seasonNumber = seasonId.match(/(\d+)$/)?.[1] ?? seasonId;
  const outPath = path.join(outputDir, `checkpoint-season-${seasonNumber}.md`);
  fs.writeFileSync(outPath, `${markdown}\n`);
  console.log(`Wrote ${outPath}`);
}

const isDirectRun = process.argv[1]?.includes("audit-season-checkpoint");
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
