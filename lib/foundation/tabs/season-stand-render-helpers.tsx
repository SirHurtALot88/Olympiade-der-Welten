"use client";

import type { CSSProperties } from "react";
import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import type { SaisonstandColumnContractEntry } from "@/lib/foundation/saisonstand-column-contract";
import { getMetricBarPercent } from "@/lib/foundation/player-league-heat";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getPlayerDisplayMarketValueDelta as resolvePlayerDisplayMarketValueDelta } from "@/lib/foundation/player-display-market-value";
import { getPlayerBaselineEconomyReference } from "@/lib/players/player-baseline-service";
import { normalizeVisibleRosterMoney } from "@/lib/market/transfermarkt-sale-factor";
import { formatPpFormBonusParen } from "@/lib/foundation/pp-area-form-bonus";
import { formatLocalePoints } from "@/lib/foundation/tabs/home-v2-ui-helpers";

function joinClassNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDisplayMoney(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSignedDisplayMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatDisplayMoney(value)}`;
}

function formatPpsValue(value: number | null | undefined) {
  return formatLocalePoints(value, 1);
}

const SEASON_TOP_PLAYER_TEAM_TAG_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  "A-A": { bg: "rgba(125, 44, 48, 0.74)", border: "rgba(236, 92, 89, 0.82)", text: "#ffe0dc", glow: "rgba(236, 92, 89, 0.28)" },
  "B-B": { bg: "rgba(117, 65, 29, 0.76)", border: "rgba(245, 139, 57, 0.82)", text: "#ffe4ca", glow: "rgba(245, 139, 57, 0.25)" },
  "B-P": { bg: "rgba(44, 42, 62, 0.78)", border: "rgba(143, 130, 201, 0.8)", text: "#ebe7ff", glow: "rgba(143, 130, 201, 0.24)" },
  "C-C": { bg: "rgba(117, 90, 37, 0.76)", border: "rgba(247, 205, 91, 0.84)", text: "#fff1c8", glow: "rgba(247, 205, 91, 0.26)" },
  "C-S": { bg: "rgba(55, 78, 92, 0.76)", border: "rgba(159, 205, 225, 0.76)", text: "#e6f7ff", glow: "rgba(159, 205, 225, 0.22)" },
  "D-L": { bg: "rgba(63, 44, 79, 0.76)", border: "rgba(179, 116, 220, 0.8)", text: "#f1ddff", glow: "rgba(179, 116, 220, 0.24)" },
  "D-P": { bg: "rgba(111, 68, 89, 0.76)", border: "rgba(245, 154, 189, 0.78)", text: "#ffe1ee", glow: "rgba(245, 154, 189, 0.23)" },
  "G-G": { bg: "rgba(116, 86, 31, 0.78)", border: "rgba(250, 194, 70, 0.86)", text: "#fff0bd", glow: "rgba(250, 194, 70, 0.27)" },
  "H-R": { bg: "rgba(105, 34, 34, 0.78)", border: "rgba(241, 76, 68, 0.86)", text: "#ffe0dd", glow: "rgba(241, 76, 68, 0.27)" },
  "L-K": { bg: "rgba(51, 62, 78, 0.78)", border: "rgba(142, 169, 207, 0.76)", text: "#e8f0ff", glow: "rgba(142, 169, 207, 0.22)" },
  "L-R": { bg: "rgba(62, 55, 51, 0.78)", border: "rgba(185, 162, 139, 0.72)", text: "#f4e6d8", glow: "rgba(185, 162, 139, 0.2)" },
  "M-M": { bg: "rgba(101, 60, 35, 0.78)", border: "rgba(238, 145, 75, 0.84)", text: "#ffe5cf", glow: "rgba(238, 145, 75, 0.25)" },
  "M-S": { bg: "rgba(78, 40, 72, 0.78)", border: "rgba(210, 104, 183, 0.78)", text: "#ffdff7", glow: "rgba(210, 104, 183, 0.22)" },
  "N-N": { bg: "rgba(64, 54, 82, 0.78)", border: "rgba(176, 148, 227, 0.8)", text: "#eee5ff", glow: "rgba(176, 148, 227, 0.23)" },
  "N-W": { bg: "rgba(45, 84, 54, 0.78)", border: "rgba(121, 202, 131, 0.78)", text: "#def8df", glow: "rgba(121, 202, 131, 0.24)" },
  "P-C": { bg: "rgba(51, 75, 93, 0.78)", border: "rgba(101, 185, 225, 0.76)", text: "#dff5ff", glow: "rgba(101, 185, 225, 0.22)" },
  "P-S": { bg: "rgba(70, 52, 108, 0.78)", border: "rgba(169, 133, 255, 0.86)", text: "#eee5ff", glow: "rgba(169, 133, 255, 0.27)" },
  "R-C": { bg: "rgba(92, 45, 81, 0.78)", border: "rgba(231, 128, 203, 0.78)", text: "#ffe2f8", glow: "rgba(231, 128, 203, 0.24)" },
  "R-L": { bg: "rgba(40, 85, 61, 0.78)", border: "rgba(109, 215, 143, 0.82)", text: "#d9ffe5", glow: "rgba(109, 215, 143, 0.25)" },
  "R-R": { bg: "rgba(34, 87, 98, 0.78)", border: "rgba(83, 205, 225, 0.78)", text: "#d8fbff", glow: "rgba(83, 205, 225, 0.23)" },
  "S-C": { bg: "rgba(98, 46, 38, 0.78)", border: "rgba(236, 104, 83, 0.82)", text: "#ffe1dc", glow: "rgba(236, 104, 83, 0.25)" },
  "S-S": { bg: "rgba(75, 84, 96, 0.78)", border: "rgba(190, 205, 224, 0.78)", text: "#edf5ff", glow: "rgba(190, 205, 224, 0.22)" },
  "T-C": { bg: "rgba(62, 91, 74, 0.78)", border: "rgba(151, 217, 174, 0.76)", text: "#e2ffea", glow: "rgba(151, 217, 174, 0.22)" },
  "T-G": { bg: "rgba(70, 75, 80, 0.78)", border: "rgba(175, 185, 194, 0.76)", text: "#f0f4f8", glow: "rgba(175, 185, 194, 0.22)" },
  "T-T": { bg: "rgba(94, 61, 39, 0.78)", border: "rgba(226, 163, 90, 0.8)", text: "#ffe7ca", glow: "rgba(226, 163, 90, 0.23)" },
  "U-A": { bg: "rgba(44, 75, 91, 0.78)", border: "rgba(112, 185, 223, 0.76)", text: "#e2f6ff", glow: "rgba(112, 185, 223, 0.22)" },
  "V-D": { bg: "rgba(91, 45, 77, 0.78)", border: "rgba(229, 116, 193, 0.78)", text: "#ffe2f5", glow: "rgba(229, 116, 193, 0.22)" },
  "V-V": { bg: "rgba(76, 68, 100, 0.78)", border: "rgba(180, 160, 238, 0.78)", text: "#eee7ff", glow: "rgba(180, 160, 238, 0.23)" },
  "V-W": { bg: "rgba(75, 53, 90, 0.78)", border: "rgba(190, 137, 225, 0.78)", text: "#f5e1ff", glow: "rgba(190, 137, 225, 0.22)" },
  "W-L": { bg: "rgba(64, 73, 77, 0.78)", border: "rgba(165, 190, 198, 0.76)", text: "#e9f6f9", glow: "rgba(165, 190, 198, 0.2)" },
  "W-W": { bg: "rgba(42, 72, 111, 0.78)", border: "rgba(104, 168, 244, 0.84)", text: "#ddecff", glow: "rgba(104, 168, 244, 0.25)" },
  "Z-H": { bg: "rgba(50, 77, 116, 0.78)", border: "rgba(92, 164, 245, 0.84)", text: "#e0efff", glow: "rgba(92, 164, 245, 0.25)" },
};

function hashTeamColorSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getSeasonTopPlayerTeamTagStyle(teamCode: string | null | undefined): CSSProperties | undefined {
  const code = String(teamCode ?? "").trim().toUpperCase();
  if (!code) {
    return undefined;
  }

  const mapped = SEASON_TOP_PLAYER_TEAM_TAG_COLORS[code];
  if (mapped) {
    return {
      "--team-tag-bg": mapped.bg,
      "--team-tag-border": mapped.border,
      "--team-tag-text": mapped.text,
      "--team-tag-glow": mapped.glow,
    } as CSSProperties;
  }

  const hue = hashTeamColorSeed(code) % 360;
  return {
    "--team-tag-bg": `hsla(${hue}, 38%, 30%, 0.78)`,
    "--team-tag-border": `hsla(${hue}, 72%, 68%, 0.78)`,
    "--team-tag-text": `hsl(${hue}, 80%, 92%)`,
    "--team-tag-glow": `hsla(${hue}, 72%, 60%, 0.22)`,
  } as CSSProperties;
}
export function getSeasonFactorToneClass(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "is-neutral";
  }
  if (value > 1.1) {
    return "is-positive";
  }
  if (value < 0.9) {
    return "is-negative";
  }
  return "is-neutral";
}
export function getTeamHistoryRankToneClass(rank: number | null | undefined) {
  if (rank == null) return "is-muted";
  if (rank <= 4) return "is-elite";
  if (rank <= 10) return "is-strong";
  if (rank <= 20) return "is-mid";
  return "is-weak";
}
export function formatSeasonContractNumber(
  value: number | null | undefined,
  column: Pick<SaisonstandColumnContractEntry, "format" | "decimalPlaces">,
) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const fallbackDecimals =
    column.format === "decimal_0" ? 0 : column.format === "decimal_1" ? 1 : column.format === "decimal_2" ? 2 : 2;
  const digits = column.decimalPlaces ?? fallbackDecimals;

  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function getPlayerDisplayMarketValue(player?: Pick<Player, "id" | "marketValue" | "displayMarketValue"> | null) {
  return resolvePlayerEconomyContract({ playerId: player?.id ?? null, player }).marketValue;
}

export function getPlayerDisplaySalary(player?: Pick<Player, "id" | "salaryDemand" | "displaySalary"> | null) {
  return resolvePlayerEconomyContract({ playerId: player?.id ?? null, player }).salary;
}

export function getRosterEntryDisplayMarketValue(
  entry?: Pick<RosterEntry, "currentValue" | "purchasePrice"> | null,
  player?: Player | null,
) {
  const economy = resolvePlayerEconomyContract({ playerId: player?.id ?? null, player, rosterEntry: entry ?? null });
  return (
    normalizeVisibleRosterMoney(entry?.currentValue ?? entry?.purchasePrice ?? null, economy.marketValue) ??
    economy.marketValue ??
    null
  );
}

export function getPlayerOvr(
  player: Pick<Player, "id" | "ovr" | "rating">,
  playerRatingsById?: Map<string, { ovrNormalized: number | null }> | null,
) {
  return playerRatingsById?.get(player.id)?.ovrNormalized ?? player.ovr ?? player.rating;
}

export function getRosterEntryDisplaySalary(
  entry: Pick<RosterEntry, "salary">,
  player?: Player | null,
) {
  const economy = resolvePlayerEconomyContract({ playerId: player?.id ?? null, player, rosterEntry: entry });
  return economy.annualSalary ?? economy.salary ?? entry.salary;
}

export function getRosterEntryCurrentSeasonSalary(
  entry: Pick<RosterEntry, "salary">,
  player?: Player | null,
) {
  const economy = resolvePlayerEconomyContract({ playerId: player?.id ?? null, player, rosterEntry: entry });
  return economy.salary ?? entry.salary;
}

export function getRosterEntrySalarySortValue(
  entry: Pick<RosterEntry, "salary">,
  player?: Player | null,
) {
  return getRosterEntryCurrentSeasonSalary(entry, player) ?? getRosterEntryDisplaySalary(entry, player);
}

export function getRosterEntryNormalSalary(
  player?: Pick<Player, "id" | "salaryDemand" | "displaySalary"> | null,
) {
  const displayNormalSalary = normalizeVisibleRosterMoney(player?.displaySalary ?? null, null);
  if (displayNormalSalary != null) {
    return displayNormalSalary;
  }

  const storedNormalSalary = normalizeVisibleRosterMoney(player?.salaryDemand ?? null, null);
  if (storedNormalSalary != null) {
    return storedNormalSalary;
  }

  return resolvePlayerEconomyContract({ playerId: player?.id ?? null, player }).expectedSalary;
}

export function getPlayerBaselineEconomy(gameState: GameState | null | undefined, playerId: string | null | undefined) {
  if (!gameState || !playerId) {
    return null;
  }
  const baseline = gameState.playerBaselines?.find((entry) => entry.playerId === playerId) ?? null;
  return getPlayerBaselineEconomyReference(baseline);
}

export function isPlausibleSalaryDeltaReference(
  salary: number | null | undefined,
  normalSalary: number | null | undefined,
) {
  if (
    salary == null ||
    normalSalary == null ||
    !Number.isFinite(salary) ||
    !Number.isFinite(normalSalary) ||
    salary <= 0 ||
    normalSalary <= 0
  ) {
    return false;
  }

  const largerSalary = Math.max(salary, normalSalary);
  const smallerSalary = Math.max(0.01, Math.min(salary, normalSalary));
  return largerSalary / smallerSalary <= 8 && Math.abs(salary - normalSalary) <= 50;
}

export function getPlayerDisplayMarketValueDelta(
  player?: Player | null,
  entry?: Pick<RosterEntry, "currentValue" | "purchasePrice" | "joinedSeasonId"> | null,
  gameState?: GameState | null,
) {
  return resolvePlayerDisplayMarketValueDelta({
    player,
    rosterEntry: entry,
    gameState,
  });
}

export function getRosterEntrySalaryDelta(
  entry?: Pick<RosterEntry, "salary"> | null,
  player?: Player | null,
  gameState?: GameState | null,
) {
  if (!entry) {
    return null;
  }

  const economy = resolvePlayerEconomyContract({ playerId: player?.id ?? null, player, rosterEntry: entry });
  const salary = economy.annualSalary ?? getRosterEntryDisplaySalary(entry, player);
  const normalSalary =
    economy.expectedSalary ??
    getPlayerBaselineEconomy(gameState, player?.id)?.salary ??
    getRosterEntryNormalSalary(player);
  if (!isPlausibleSalaryDeltaReference(salary, normalSalary)) {
    return null;
  }
  if (normalSalary == null) {
    return null;
  }

  const delta = salary - normalSalary;
  return Math.abs(delta) >= 0.01 ? roundViewNumber(delta, 2) : null;
}

export function getEconomyDeltaClass(
  value: number | null | undefined,
  positiveDirection: "higher" | "lower",
) {
  if (value == null || !Number.isFinite(value) || Math.abs(value) < 0.01) {
    return "";
  }

  const isPositive = positiveDirection === "higher" ? value > 0 : value < 0;
  return isPositive ? " is-positive" : " is-negative";
}

export function renderEconomyDelta(
  value: number | null | undefined,
  positiveDirection: "higher" | "lower",
  className = "player-card-money-delta",
) {
  if (value == null || !Number.isFinite(value) || Math.abs(value) < 0.01) {
    return null;
  }

  return (
    <small className={`${className}${getEconomyDeltaClass(value, positiveDirection)}`}>
      {formatSignedDisplayMoney(value)}
    </small>
  );
}

export function roundViewNumber(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

export function resolveSeasonPlayerAxisValue(...candidates: Array<number | null | undefined>) {
  for (const value of candidates) {
    if (value != null && Number.isFinite(value) && value > 0) {
      return roundViewNumber(value, 1);
    }
  }
  for (const value of candidates) {
    if (value != null && Number.isFinite(value)) {
      return roundViewNumber(value, 1);
    }
  }
  return null;
}

export function getRosterPlayers(gameState: GameState, roster: RosterEntry[]) {
  return roster
    .map((entry) => ({
      entry,
      player: gameState.players.find((candidate) => candidate.id === entry.playerId),
    }))
    .filter((item): item is { entry: RosterEntry; player: Player } => Boolean(item.player));
}

export function getHeatClass(value: number, thresholds: [number, number, number]) {
  if (value >= thresholds[2]) {
    return "heat-strong";
  }
  if (value >= thresholds[1]) {
    return "heat-good";
  }
  if (value >= thresholds[0]) {
    return "heat-warn";
  }
  return "heat-weak";
}

export function renderMetricBar(
  value: number | null | undefined,
  options: {
    tone: "neutral" | "pps" | "mvs" | "ovr" | "pow" | "spe" | "men" | "soc";
    pool?: Array<number | null | undefined>;
    fallbackMax?: number;
    format?: (value: number) => string;
    detail?: string | null;
    detailNegative?: boolean;
    detailClassName?: string;
    title?: string;
  },
) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="table-metric-bar is-empty">—</span>;
  }

  const percent = getMetricBarPercent(value, options.pool, options.fallbackMax ?? 100);
  const displayValue = options.format ? options.format(value) : formatLocalePoints(value);
  return (
    <span className={`table-metric-bar is-${options.tone}`} title={options.title}>
      <span className="table-metric-bar-fill" style={{ width: `${percent}%` }} />
      <span className="table-metric-bar-content">
        <span className="table-metric-bar-value">{displayValue}</span>
        {options.detail ? (
          <small
            className={joinClassNames(
              options.detailClassName ?? "table-metric-bar-detail",
              options.detailNegative ? "is-negative" : undefined,
            )}
          >
            {options.detail}
          </small>
        ) : null}
      </span>
    </span>
  );
}

export function renderPpAreaMetricCell(
  value: number | null | undefined,
  formBonus: number | null | undefined,
  options: {
    tone: "pps" | "pow" | "spe" | "men" | "soc";
    pool?: Array<number | null | undefined>;
    fallbackMax?: number;
  },
) {
  return renderMetricBar(value, {
    ...options,
    format: (nextValue) => formatPpsValue(nextValue),
    detail: formatPpFormBonusParen(formBonus),
    detailNegative: (formBonus ?? 0) < 0,
    detailClassName: "pp-form-bonus",
  });
}

export function getTransferHistoryAxisHeaderClass(columnId: string) {
  if (columnId === "pow") return "transfer-history-axis-header transfer-history-axis-header-pow heat-band-1";
  if (columnId === "spe") return "transfer-history-axis-header transfer-history-axis-header-spe heat-band-6";
  if (columnId === "men") return "transfer-history-axis-header transfer-history-axis-header-men heat-band-8";
  if (columnId === "soc") return "transfer-history-axis-header transfer-history-axis-header-soc heat-band-3";
  return "";
}

export function getSeasonCashHeatClass(value: number, rows: Array<{ cash: number | null }>) {
  const cashValues = rows.map((row) => row.cash).filter((cash): cash is number => cash != null && Number.isFinite(cash));
  if (cashValues.length < 4) {
    return value >= 0 ? "heat-elite" : "heat-weak";
  }

  const sorted = [...cashValues].sort((left, right) => left - right);
  const pick = (ratio: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))] ?? 0;

  if (value >= pick(0.75)) {
    return "heat-elite";
  }
  if (value >= pick(0.5)) {
    return "heat-strong";
  }
  if (value >= pick(0.25)) {
    return "heat-good";
  }
  return "heat-weak";
}

export function getRankHeatClass(rank: number, teamCount: number) {
  if (teamCount <= 1) {
    return "";
  }

  // Rank matrices highlight only the Top 10: 1-3 green, 4-6 yellow, 7-10 red; places 11+ stay calm.
  if (rank <= 3) {
    return "rank-strong";
  }
  if (rank <= 6) {
    return "rank-mid";
  }
  if (rank <= 10) {
    return "rank-weak";
  }
  return "rank-muted";
}

export function getTop10TrafficRankClass(rank: number | null | undefined) {
  if (rank == null || !Number.isFinite(rank)) {
    return "";
  }
  if (rank <= 3) {
    return "top10-rank-strong";
  }
  if (rank <= 6) {
    return "top10-rank-mid";
  }
  if (rank <= 10) {
    return "top10-rank-weak";
  }
  return "";
}

export function getSeasonMatrixRankClass(rank: number) {
  // The large Saisonstand matrix is ranked per column: only real Top-10 values should carry heat.
  if (rank <= 3) {
    return "pp-rank-top";
  }
  if (rank <= 7) {
    return "pp-rank-chase";
  }
  if (rank <= 10) {
    return "pp-rank-watch";
  }
  return "pp-rank-muted";
}

export function buildSharedRankMap(values: Array<{ teamId: string; value: number }>) {
  const sortedValues = [...values].sort((left, right) => {
    if (right.value !== left.value) {
      return right.value - left.value;
    }
    return left.teamId.localeCompare(right.teamId, "de");
  });
  const rankMap = new Map<string, number>();
  let previousValue: number | null = null;
  let previousRank = 0;

  sortedValues.forEach((entry, index) => {
    if (previousValue != null && Math.abs(previousValue - entry.value) < 0.0001) {
      rankMap.set(entry.teamId, previousRank);
      return;
    }

    const nextRank = index + 1;
    previousValue = entry.value;
    previousRank = nextRank;
    rankMap.set(entry.teamId, nextRank);
  });

  return rankMap;
}

export function buildMetricRankMap(values: Array<{ id: string; value: number | null | undefined }>) {
  const numericValues = values.filter(
    (entry): entry is { id: string; value: number } =>
      typeof entry.value === "number" && Number.isFinite(entry.value),
  );
  const sortedValues = [...numericValues].sort((left, right) => {
    if (Math.abs(right.value - left.value) > 0.0001) {
      return right.value - left.value;
    }
    return left.id.localeCompare(right.id, "de");
  });
  const rankMap = new Map<string, number>();
  let previousValue: number | null = null;
  let previousRank = 0;

  sortedValues.forEach((entry, index) => {
    if (previousValue != null && Math.abs(previousValue - entry.value) < 0.0001) {
      rankMap.set(entry.id, previousRank);
      return;
    }

    const nextRank = index + 1;
    previousValue = entry.value;
    previousRank = nextRank;
    rankMap.set(entry.id, nextRank);
  });

  return rankMap;
}

export function buildMetricRankClassMap(values: Array<{ id: string; value: number | null | undefined }>) {
  const rankMap = buildMetricRankMap(values);
  return new Map(values.map((entry) => [entry.id, getTop10TrafficRankClass(rankMap.get(entry.id))] as const));
}

export function buildNullableSharedRankMap(values: Array<{ teamId: string; value: number | null | undefined }>) {
  const numericValues = values.filter(
    (entry): entry is { teamId: string; value: number } =>
      typeof entry.value === "number" && Number.isFinite(entry.value),
  );

  if (numericValues.length === 0) {
    return new Map<string, number | null>(values.map((entry) => [entry.teamId, null]));
  }

  const rankedValues = buildSharedRankMap(numericValues);
  return new Map<string, number | null>(
    values.map((entry) => [
      entry.teamId,
      typeof entry.value === "number" && Number.isFinite(entry.value)
        ? (rankedValues.get(entry.teamId) ?? null)
        : null,
    ]),
  );
}

export function buildSeasonDisciplineRankMaps<TDiscipline extends string>(
  activeView: string,
  disciplineColumns: readonly TDiscipline[],
  seasonStandRows: Array<{ teamId: string; disciplineValues: Record<string, number | null> }>,
) {
  if (activeView !== "seasonV2") {
    return Object.fromEntries(
      disciplineColumns.map((disciplineKey) => [disciplineKey, new Map<string, number | null>()]),
    ) as Record<TDiscipline, Map<string, number | null>>;
  }

  return Object.fromEntries(
    disciplineColumns.map((disciplineKey) => [
      disciplineKey,
      buildNullableSharedRankMap(
        seasonStandRows.map((row) => ({
          teamId: row.teamId,
          value: row.disciplineValues[disciplineKey] ?? null,
        })),
      ),
    ]),
  ) as Record<TDiscipline, Map<string, number | null>>;
}

type AreaRankEntry = { pow: number | null; spe: number | null; men: number | null; soc: number | null };

export function buildCurrentAreaRanksByTeamId(input: {
  shouldBuildDisciplineRanks: boolean;
  disciplineRankRows: Array<{
    team: { teamId: string };
    scorePack: { pow: number; spe: number; men: number; soc: number };
    powRank: number;
    speRank: number;
    menRank: number;
    socRank: number;
  }>;
  shouldBuildTeamsView: boolean;
  activeView: string;
  seasonStandRows: Array<{
    teamId: string;
    rosterCount: number;
    ppsPow?: number | null;
    ppsSpe?: number | null;
    ppsMen?: number | null;
    ppsSoc?: number | null;
  }>;
}): Map<string, AreaRankEntry> {
  if (input.shouldBuildDisciplineRanks && input.disciplineRankRows.length > 0) {
    return new Map(
      input.disciplineRankRows.map((row) => [
        row.team.teamId,
        {
          pow: row.scorePack.pow > 0 ? row.powRank || null : null,
          spe: row.scorePack.spe > 0 ? row.speRank || null : null,
          men: row.scorePack.men > 0 ? row.menRank || null : null,
          soc: row.scorePack.soc > 0 ? row.socRank || null : null,
        },
      ]),
    );
  }

  if (!input.shouldBuildTeamsView && input.activeView !== "teamProfile") {
    return new Map<string, AreaRankEntry>();
  }

  const powRankMap = buildSharedRankMap(
    input.seasonStandRows.map((row) => ({ teamId: row.teamId, value: row.ppsPow ?? 0 })),
  );
  const speRankMap = buildSharedRankMap(
    input.seasonStandRows.map((row) => ({ teamId: row.teamId, value: row.ppsSpe ?? 0 })),
  );
  const menRankMap = buildSharedRankMap(
    input.seasonStandRows.map((row) => ({ teamId: row.teamId, value: row.ppsMen ?? 0 })),
  );
  const socRankMap = buildSharedRankMap(
    input.seasonStandRows.map((row) => ({ teamId: row.teamId, value: row.ppsSoc ?? 0 })),
  );

  return new Map(
    input.seasonStandRows.map((row) => {
      const hasActiveRoster = row.rosterCount > 0;
      return [
        row.teamId,
        {
          pow: hasActiveRoster && (row.ppsPow ?? 0) > 0 ? powRankMap.get(row.teamId) ?? null : null,
          spe: hasActiveRoster && (row.ppsSpe ?? 0) > 0 ? speRankMap.get(row.teamId) ?? null : null,
          men: hasActiveRoster && (row.ppsMen ?? 0) > 0 ? menRankMap.get(row.teamId) ?? null : null,
          soc: hasActiveRoster && (row.ppsSoc ?? 0) > 0 ? socRankMap.get(row.teamId) ?? null : null,
        },
      ] as const;
    }),
  );
}

type ArchivedSeasonPlayerPerformance = {
  playerId: string;
  playerName: string;
  teamCode?: string | null;
  teamName?: string | null;
  disciplineBreakdown?: Array<{
    disciplineId: string;
    disciplineName: string;
    appearances: number;
    totalContribution?: number | null;
    averageContribution?: number | null;
    averageFinalScore?: number | null;
  }>;
};

export function buildArchivedSeasonDisciplineLeaderboards(
  selectedSeasonSnapshot: { playerPerformances?: ArchivedSeasonPlayerPerformance[] } | null,
) {
  if (!selectedSeasonSnapshot) {
    return [];
  }

  const disciplineRows = new Map<
    string,
    {
      disciplineId: string;
      disciplineName: string;
      players: Array<{
        playerId: string;
        playerName: string;
        teamCode: string | null;
        teamName: string | null;
        appearances: number;
        totalContribution: number | null;
        averageContribution: number | null;
        averageFinalScore: number | null;
      }>;
    }
  >();

  for (const player of selectedSeasonSnapshot.playerPerformances ?? []) {
    for (const discipline of player.disciplineBreakdown ?? []) {
      const bucket = disciplineRows.get(discipline.disciplineId) ?? {
        disciplineId: discipline.disciplineId,
        disciplineName: discipline.disciplineName,
        players: [],
      };
      bucket.players.push({
        playerId: player.playerId,
        playerName: player.playerName,
        teamCode: player.teamCode ?? null,
        teamName: player.teamName ?? null,
        appearances: discipline.appearances,
        totalContribution: discipline.totalContribution ?? null,
        averageContribution: discipline.averageContribution ?? null,
        averageFinalScore: discipline.averageFinalScore ?? null,
      });
      disciplineRows.set(discipline.disciplineId, bucket);
    }
  }

  return Array.from(disciplineRows.values())
    .map((entry) => ({
      ...entry,
      players: entry.players
        .sort((left, right) => {
          const contributionDelta =
            (right.totalContribution ?? Number.NEGATIVE_INFINITY) -
            (left.totalContribution ?? Number.NEGATIVE_INFINITY);
          if (contributionDelta !== 0) {
            return contributionDelta;
          }
          return (right.averageFinalScore ?? Number.NEGATIVE_INFINITY) - (left.averageFinalScore ?? Number.NEGATIVE_INFINITY);
        })
        .slice(0, 6),
    }))
    .sort((left, right) => left.disciplineName.localeCompare(right.disciplineName, "de"));
}
