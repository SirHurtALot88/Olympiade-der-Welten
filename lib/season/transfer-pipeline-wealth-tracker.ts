import type { GameState } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";

export type WealthCorridorStatus = "green" | "warn" | "red";

export type SeasonWealthSnapshot = {
  seasonId: string;
  seasonNumber: number;
  phase: "draft" | "preseason";
  salaryFactor: number | null;
  salaryFactorWindow: number[];
  leagueStartBudget: number;
  leagueMw: number;
  leagueCash: number;
  leagueWealth: number;
  leagueSalary: number;
  wealthPctOfStartBudget: number;
  mwPctOfStartBudget: number;
  cashPctOfStartBudget: number;
  avgTeamWealth: number;
  avgTeamMw: number;
  avgTeamCash: number;
  avgTeamStartBudget: number;
  teamsBelowMwFloor: number;
  teamsBelowWealthFloor: number;
  corridor: {
    wealthPctMin: number;
    wealthPctMax: number;
    mwPctMin: number;
    mwPctMax: number;
    wealthStatus: WealthCorridorStatus;
    mwStatus: WealthCorridorStatus;
    overallStatus: WealthCorridorStatus;
  };
  deltaFromPrior: {
    wealthPct: number | null;
    mwPct: number | null;
    cashPct: number | null;
  } | null;
  sampleTeams: Array<{
    teamCode: string;
    startBudget: number;
    mw: number;
    cash: number;
    wealth: number;
    mwPctOfBudget: number;
    status: WealthCorridorStatus;
  }>;
  notes: string[];
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function parseSeasonNumber(seasonId: string) {
  const parsed = Number(seasonId.match(/(\d+)$/)?.[1] ?? 1);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function resolveCurrentSalaryFactor(gameState: GameState, saveId: string): {
  current: number | null;
  window: number[];
} {
  const window = getSeasonEconomyFactorWindow({
    saveId,
    seasonId: gameState.season.id,
    seasonState: gameState.seasonState,
  });
  const current = window.find((entry) => entry.horizonIndex === 0)?.factor ?? null;
  return {
    current: current != null && Number.isFinite(current) ? round(current, 3) : null,
    window: window.map((entry) => round(entry.factor ?? 1, 3)),
  };
}

function resolveTeamMw(gameState: GameState, teamId: string) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  return round(
    gameState.rosters
      .filter((entry) => entry.teamId === teamId)
      .reduce((sum, entry) => {
        const player = playerById.get(entry.playerId);
        const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
        return sum + (economy.marketValue ?? 0);
      }, 0),
  );
}

function resolveTeamSalary(gameState: GameState, teamId: string) {
  return round(
    gameState.rosters
      .filter((entry) => entry.teamId === teamId)
      .reduce((sum, entry) => sum + (entry.salary ?? 0), 0),
  );
}

function statusForBand(value: number, min: number, max: number): WealthCorridorStatus {
  if (value >= min && value <= max) return "green";
  const slack = (max - min) * 0.12;
  if (value >= min - slack && value <= max + slack) return "warn";
  return "red";
}

function mergeStatus(left: WealthCorridorStatus, right: WealthCorridorStatus): WealthCorridorStatus {
  if (left === "red" || right === "red") return "red";
  if (left === "warn" || right === "warn") return "warn";
  return "green";
}

export function resolveWealthCorridorBounds(input: {
  seasonNumber: number;
  phase: "draft" | "preseason";
  salaryFactorsThroughSeason: number[];
}) {
  const cumDrift = input.salaryFactorsThroughSeason.reduce((sum, factor) => sum + (factor - 1), 0);
  const salaryAdjust = round(cumDrift * 0.08, 4);
  const seasonGrowth = round(Math.max(0, input.seasonNumber - 1) * 0.012, 4);

  if (input.seasonNumber === 1 && input.phase === "draft") {
    return {
      wealthPctMin: 0.9,
      wealthPctMax: 1.0,
      mwPctMin: 0.82,
      mwPctMax: 0.96,
      teamMwPctMin: 0.78,
    };
  }

  return {
    wealthPctMin: round(0.88 + salaryAdjust + seasonGrowth, 4),
    wealthPctMax: round(1.04 + salaryAdjust + seasonGrowth * 1.4, 4),
    mwPctMin: round(0.8 + salaryAdjust + seasonGrowth, 4),
    mwPctMax: round(1.0 + salaryAdjust + seasonGrowth * 1.2, 4),
    teamMwPctMin: round(0.72 + salaryAdjust * 0.8 + seasonGrowth * 0.8, 4),
  };
}

export function collectSeasonWealthSnapshot(input: {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  phase: "draft" | "preseason";
  priorSnapshot?: SeasonWealthSnapshot | null;
  salaryFactorsThroughSeason?: number[];
}): SeasonWealthSnapshot {
  const seasonNumber = parseSeasonNumber(input.seasonId);
  const { current: salaryFactor, window: salaryFactorWindow } = resolveCurrentSalaryFactor(
    input.gameState,
    input.saveId,
  );
  const salaryFactorsThroughSeason = (() => {
    const prior = input.salaryFactorsThroughSeason ?? [];
    if (salaryFactor == null) return prior;
    if (prior.length >= seasonNumber) return prior.slice(0, seasonNumber);
    return [...prior, salaryFactor];
  })();

  const bounds = resolveWealthCorridorBounds({
    seasonNumber,
    phase: input.phase,
    salaryFactorsThroughSeason,
  });

  const teamMetrics = input.gameState.teams.map((team) => {
    const startBudget = round(team.budget ?? 0);
    const cash = round(team.cash ?? 0);
    const mw = resolveTeamMw(input.gameState, team.teamId);
    const wealth = round(mw + cash);
    const mwPctOfBudget = startBudget > 0 ? round(mw / startBudget, 4) : 0;
    return {
      teamCode: team.shortCode ?? team.teamId,
      startBudget,
      mw,
      cash,
      wealth,
      mwPctOfBudget,
      salary: resolveTeamSalary(input.gameState, team.teamId),
    };
  });

  const leagueStartBudget = round(teamMetrics.reduce((sum, team) => sum + team.startBudget, 0));
  const leagueMw = round(teamMetrics.reduce((sum, team) => sum + team.mw, 0));
  const leagueCash = round(teamMetrics.reduce((sum, team) => sum + team.cash, 0));
  const leagueWealth = round(leagueMw + leagueCash);
  const leagueSalary = round(teamMetrics.reduce((sum, team) => sum + team.salary, 0));
  const teamCount = Math.max(teamMetrics.length, 1);

  const wealthPctOfStartBudget = leagueStartBudget > 0 ? round(leagueWealth / leagueStartBudget, 4) : 0;
  const mwPctOfStartBudget = leagueStartBudget > 0 ? round(leagueMw / leagueStartBudget, 4) : 0;
  const cashPctOfStartBudget = leagueStartBudget > 0 ? round(leagueCash / leagueStartBudget, 4) : 0;

  const wealthStatus = statusForBand(wealthPctOfStartBudget, bounds.wealthPctMin, bounds.wealthPctMax);
  const mwStatus = statusForBand(mwPctOfStartBudget, bounds.mwPctMin, bounds.mwPctMax);
  const overallStatus = mergeStatus(wealthStatus, mwStatus);

  const teamsBelowMwFloor = teamMetrics.filter((team) => team.mwPctOfBudget < bounds.teamMwPctMin).length;
  const teamsBelowWealthFloor = teamMetrics.filter(
    (team) => team.startBudget > 0 && team.wealth / team.startBudget < bounds.wealthPctMin,
  ).length;

  const notes: string[] = [];
  if (teamsBelowMwFloor > 0) {
    notes.push(`teams_below_mw_floor:${teamsBelowMwFloor}/${teamMetrics.length}`);
  }
  if (teamsBelowWealthFloor > 0) {
    notes.push(`teams_below_wealth_floor:${teamsBelowWealthFloor}/${teamMetrics.length}`);
  }
  if (salaryFactor != null && salaryFactor > 1.05 && mwPctOfStartBudget < bounds.mwPctMin) {
    notes.push("salary_factor_positive_but_mw_low");
  }
  if (salaryFactor != null && salaryFactor < 0.95 && wealthPctOfStartBudget > bounds.wealthPctMax) {
    notes.push("salary_factor_negative_but_cash_hoarding");
  }

  const focusCodes = new Set(["R-R", "M-M", "A-A", "C-C"]);
  const sampleTeams = teamMetrics
    .filter((team) => focusCodes.has(team.teamCode))
    .map((team) => ({
      teamCode: team.teamCode,
      startBudget: team.startBudget,
      mw: team.mw,
      cash: team.cash,
      wealth: team.wealth,
      mwPctOfBudget: team.mwPctOfBudget,
      status: statusForBand(team.mwPctOfBudget, bounds.teamMwPctMin, 0.98),
    }));

  const prior = input.priorSnapshot ?? null;
  const deltaFromPrior =
    prior == null
      ? null
      : {
          wealthPct: round(wealthPctOfStartBudget - prior.wealthPctOfStartBudget, 4),
          mwPct: round(mwPctOfStartBudget - prior.mwPctOfStartBudget, 4),
          cashPct: round(cashPctOfStartBudget - prior.cashPctOfStartBudget, 4),
        };

  return {
    seasonId: input.seasonId,
    seasonNumber,
    phase: input.phase,
    salaryFactor,
    salaryFactorWindow,
    leagueStartBudget,
    leagueMw,
    leagueCash,
    leagueWealth,
    leagueSalary,
    wealthPctOfStartBudget,
    mwPctOfStartBudget,
    cashPctOfStartBudget,
    avgTeamWealth: round(leagueWealth / teamCount),
    avgTeamMw: round(leagueMw / teamCount),
    avgTeamCash: round(leagueCash / teamCount),
    avgTeamStartBudget: round(leagueStartBudget / teamCount),
    teamsBelowMwFloor,
    teamsBelowWealthFloor,
    corridor: {
      wealthPctMin: bounds.wealthPctMin,
      wealthPctMax: bounds.wealthPctMax,
      mwPctMin: bounds.mwPctMin,
      mwPctMax: bounds.mwPctMax,
      wealthStatus,
      mwStatus,
      overallStatus,
    },
    deltaFromPrior,
    sampleTeams,
    notes,
  };
}

export function formatWealthSnapshotLogLine(snapshot: SeasonWealthSnapshot): string {
  const pct = (value: number) => `${round(value * 100, 1)}%`;
  const corridor = snapshot.corridor;
  const delta =
    snapshot.deltaFromPrior == null
      ? ""
      : ` Δwealth=${pct(snapshot.deltaFromPrior.wealthPct)} Δmw=${pct(snapshot.deltaFromPrior.mwPct)}`;
  const salary = snapshot.salaryFactor != null ? ` salaryF=${snapshot.salaryFactor}` : "";
  return (
    `${snapshot.seasonId} ${snapshot.phase}: ` +
    `MW=${snapshot.leagueMw} (${pct(snapshot.mwPctOfStartBudget)}) ` +
    `Cash=${snapshot.leagueCash} (${pct(snapshot.cashPctOfStartBudget)}) ` +
    `Σ=${snapshot.leagueWealth} (${pct(snapshot.wealthPctOfStartBudget)} of start ${snapshot.leagueStartBudget})` +
    `${salary} → ${corridor.overallStatus.toUpperCase()} ` +
    `[wealth ${pct(corridor.wealthPctMin)}-${pct(corridor.wealthPctMax)}=${corridor.wealthStatus}, ` +
    `mw ${pct(corridor.mwPctMin)}-${pct(corridor.mwPctMax)}=${corridor.mwStatus}]` +
    `${delta}` +
    (snapshot.notes.length > 0 ? ` | ${snapshot.notes.join("; ")}` : "")
  );
}

export function formatWealthTrackMarkdown(snapshots: SeasonWealthSnapshot[]): string {
  const lines = [
    "# S1–S10 Wealth Track (MW + Cash vs Startbudget)",
    "",
    "Benchmark: **MW + Cash** gegen **Startbudget Σ** (team.budget), Korridor angepasst an kumulierte Salary-Faktoren.",
    "",
    "| Season | Phase | SalaryF | MW Σ | MW% | Cash Σ | Cash% | Wealth Σ | Wealth% | Korridor | Δ MW% | Δ Wealth% | Under-MW |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |",
  ];

  for (const row of snapshots) {
    const pct = (value: number) => `${round(value * 100, 1)}%`;
    lines.push(
      `| ${row.seasonId} | ${row.phase} | ${row.salaryFactor ?? "—"} | ${row.leagueMw} | ${pct(row.mwPctOfStartBudget)} | ${row.leagueCash} | ${pct(row.cashPctOfStartBudget)} | ${row.leagueWealth} | ${pct(row.wealthPctOfStartBudget)} | **${row.corridor.overallStatus}** | ${row.deltaFromPrior?.mwPct != null ? pct(row.deltaFromPrior.mwPct) : "—"} | ${row.deltaFromPrior?.wealthPct != null ? pct(row.deltaFromPrior.wealthPct) : "—"} | ${row.teamsBelowMwFloor} |`,
    );
  }

  lines.push("", "## Focus Teams (R-R, M-M, A-A, C-C)", "");
  for (const row of snapshots) {
    if (row.sampleTeams.length === 0) continue;
    lines.push(`### ${row.seasonId} ${row.phase}`, "");
    lines.push("| Team | Start | MW | Cash | Wealth | MW/Start | Status |");
    lines.push("| --- | ---: | ---: | ---: | ---: | ---: | --- |");
    for (const team of row.sampleTeams) {
      lines.push(
        `| ${team.teamCode} | ${team.startBudget} | ${team.mw} | ${team.cash} | ${team.wealth} | ${round(team.mwPctOfBudget * 100, 1)}% | ${team.status} |`,
      );
    }
    lines.push("");
  }

  if (snapshots.length >= 2) {
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const greenCount = snapshots.filter((row) => row.corridor.overallStatus === "green").length;
    const warnCount = snapshots.filter((row) => row.corridor.overallStatus === "warn").length;
    const redCount = snapshots.filter((row) => row.corridor.overallStatus === "red").length;
    const pct = (value: number) => `${round(value * 100, 1)}%`;
    lines.push("## S1→S10 Trend Check", "");
    lines.push(
      `- Snapshots: **${greenCount} green** / ${warnCount} warn / ${redCount} red (${snapshots.length} total)`,
    );
    lines.push(
      `- League wealth: ${pct(first.wealthPctOfStartBudget)} → ${pct(last.wealthPctOfStartBudget)} (Δ ${pct(last.wealthPctOfStartBudget - first.wealthPctOfStartBudget)})`,
    );
    lines.push(
      `- League MW: ${pct(first.mwPctOfStartBudget)} → ${pct(last.mwPctOfStartBudget)} (Δ ${pct(last.mwPctOfStartBudget - first.mwPctOfStartBudget)})`,
    );
    lines.push(
      `- Under-MW teams: ${first.teamsBelowMwFloor} → ${last.teamsBelowMwFloor}`,
    );
    lines.push("");
  }

  return lines.join("\n");
}
