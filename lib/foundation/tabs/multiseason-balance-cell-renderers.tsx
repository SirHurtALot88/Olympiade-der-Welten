"use client";

import type { ReactNode } from "react";

import type {
  MultiSeasonBalanceEconomyRow,
  MultiSeasonBalanceGameplayRow,
  MultiSeasonBalancePlayerRow,
  MultiSeasonBalanceTeamRow,
} from "@/lib/foundation/multiseason-balance-dashboard";
import { formatMoney } from "@/lib/foundation/tabs/foundation-format-render-helpers";
import { formatLocalePoints } from "@/lib/foundation/tabs/home-v2-ui-helpers";

export function renderMultiSeasonTeamCell(row: MultiSeasonBalanceTeamRow, columnId: string): ReactNode {
  if (columnId === "team") return <strong>{row.teamCode}</strong>;
  if (columnId === "seasons") return row.seasons;
  if (columnId === "champions") return row.championCount;
  if (columnId === "avgRank") return row.averageRank != null ? formatLocalePoints(row.averageRank, 1) : "—";
  if (columnId === "bestRank") return row.bestRank ?? "—";
  if (columnId === "worstRank") return row.worstRank ?? "—";
  if (columnId === "rankDelta") return row.rankDelta != null ? formatLocalePoints(row.rankDelta, 0) : "—";
  if (columnId === "avgPoints") return row.averagePoints != null ? formatLocalePoints(row.averagePoints, 1) : "—";
  if (columnId === "top5") return row.top5Count;
  if (columnId === "bottom5") return row.bottom5Count;
  if (columnId === "points") return row.pointsBySeason;
  if (columnId === "source") return row.source;
  return "—";
}

export function renderMultiSeasonEconomyCell(row: MultiSeasonBalanceEconomyRow, columnId: string): ReactNode {
  if (columnId === "team") return <strong>{row.teamCode}</strong>;
  if (columnId === "cash") return row.cashCurrent != null ? formatMoney(row.cashCurrent) : "—";
  if (columnId === "cashAvg") return row.cashEndAverage != null ? formatMoney(row.cashEndAverage) : "—";
  if (columnId === "cashMax") return row.cashMax != null ? formatMoney(row.cashMax) : "—";
  if (columnId === "salary") return row.salaryCurrent != null ? formatMoney(row.salaryCurrent) : "—";
  if (columnId === "salaryRatio") return row.salaryRatio != null ? formatLocalePoints(row.salaryRatio, 2) : "—";
  if (columnId === "transferSpend") return formatMoney(row.transferSpend);
  if (columnId === "transferIncome") return formatMoney(row.transferIncome);
  if (columnId === "transferNet") return formatMoney(row.transferNet);
  if (columnId === "facilityNet") return formatMoney(row.facilityNet);
  if (columnId === "warning") return row.warning ? <span className="pill is-warning">{row.warning}</span> : "—";
  return "—";
}

export function renderMultiSeasonPlayerCell(row: MultiSeasonBalancePlayerRow, columnId: string): ReactNode {
  if (columnId === "player") return <strong>{row.playerName}</strong>;
  if (columnId === "team") return row.teamName ?? row.teamId ?? "—";
  if (columnId === "seasons") return row.seasons;
  if (columnId === "points") return row.totalPoints != null ? formatLocalePoints(row.totalPoints, 1) : "—";
  if (columnId === "avg") return row.averageContribution != null ? formatLocalePoints(row.averageContribution, 2) : "—";
  if (columnId === "top10") return row.top10Count;
  if (columnId === "mvp") return row.mvpCount;
  if (columnId === "xp") return row.xpSpent || "—";
  if (columnId === "attrDelta") return row.attributeDelta || "—";
  if (columnId === "mwDelta") return row.marketValueDelta != null ? formatMoney(row.marketValueDelta) : "—";
  if (columnId === "salaryDelta") return row.salaryPreviewDelta != null ? formatMoney(row.salaryPreviewDelta) : "—";
  if (columnId === "value") return row.valueSignal != null ? formatLocalePoints(row.valueSignal, 2) : "—";
  return "—";
}

export function renderMultiSeasonGameplayCell(row: MultiSeasonBalanceGameplayRow, columnId: string): ReactNode {
  if (columnId === "metric") return <strong>{row.metric}</strong>;
  if (columnId === "value") return row.value;
  if (columnId === "signal") return row.signal != null ? formatLocalePoints(row.signal, 2) : "—";
  if (columnId === "warning") return row.warning ? <span className="pill is-warning">{row.warning}</span> : "—";
  if (columnId === "source") return row.source;
  return "—";
}
