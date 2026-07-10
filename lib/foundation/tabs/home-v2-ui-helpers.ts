import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import { getPlayerPortraitMediaModel } from "@/lib/data/mediaAssets";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getPlayerDisplayMarketValueDelta } from "@/lib/foundation/player-display-market-value";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { PlayerSeasonPerformanceSummary } from "@/lib/foundation/player-season-performance";
import { normalizeVisibleRosterMoney } from "@/lib/market/transfermarkt-sale-factor";
import { getPlayerBaselineEconomyReference } from "@/lib/players/player-baseline-service";
import type { FacilityId } from "@/lib/facilities/facility-catalog";

export const HOME_V2_FACILITY_IDS: FacilityId[] = [
  "scouting_office",
  "training_center",
  "analytics_room",
  "fan_shop",
  "recovery_center",
];

export function formatLocalePoints(value: number | null | undefined, maximumFractionDigits = 2) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

export function formatTeamControlModeLabel(mode: "manual" | "ai" | "passive" | null | undefined) {
  if (mode === "manual") return "geführt";
  if (mode === "ai") return "automatisch";
  if (mode === "passive") return "beobachtet";
  return "offen";
}

export function getHomePlayerPortraitModel(player: Pick<Player, "id" | "name" | "portraitUrl" | "portraitPath">) {
  return getPlayerPortraitMediaModel(player);
}

function getRosterEntryDisplaySalary(entry: Pick<RosterEntry, "salary">, player?: Player | null) {
  const economy = resolvePlayerEconomyContract({ playerId: player?.id ?? null, player, rosterEntry: entry });
  return economy.annualSalary ?? economy.salary ?? entry.salary;
}

function getRosterEntryNormalSalary(player?: Pick<Player, "id" | "salaryDemand" | "displaySalary"> | null) {
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

function isPlausibleSalaryDeltaReference(
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

function getRosterEntrySalaryDelta(
  entry: Pick<RosterEntry, "salary">,
  player: Player | null | undefined,
  gameState: GameState,
) {
  const economy = resolvePlayerEconomyContract({ playerId: player?.id ?? null, player, rosterEntry: entry });
  const salary = economy.annualSalary ?? getRosterEntryDisplaySalary(entry, player);
  const normalSalary =
    getRosterEntryNormalSalary(player) ??
    (player?.id
      ? getPlayerBaselineEconomyReference(
          gameState.playerBaselines?.find((row) => row.playerId === player.id) ?? null,
        )?.salary
      : null);

  if (!isPlausibleSalaryDeltaReference(salary, normalSalary) || salary == null || normalSalary == null) {
    return null;
  }

  return salary - normalSalary;
}

export type HomeV2RosterTableRow = {
  entry: RosterEntry;
  player: Player;
  playerOvr: number | null;
  playerMvs: number | null;
  playerPps: number | null;
};

export type HomeV2PlayerCardRow = HomeV2RosterTableRow & {
  portrait: ReturnType<typeof getPlayerPortraitMediaModel>;
  salary: number | null;
  marketValue: number | null;
  marketValueDelta: number | null;
  salaryDelta: number | null;
  xp: number;
  fatigue: number;
  ppPow: number | null;
  ppSpe: number | null;
  ppMen: number | null;
  ppSoc: number | null;
};

export function buildHomePlayerCardsFromRoster(input: {
  gameState: GameState;
  selectedRosterTableRows: HomeV2RosterTableRow[];
  playerRatingsById: Map<string, PlayerRatingContractRow>;
  playerSeasonPerformanceMap: Map<string, PlayerSeasonPerformanceSummary | null>;
}): HomeV2PlayerCardRow[] {
  const { gameState, selectedRosterTableRows, playerRatingsById, playerSeasonPerformanceMap } = input;

  return selectedRosterTableRows
    .map((row) => {
      const portrait = getHomePlayerPortraitModel(row.player);
      const salary = getRosterEntryDisplaySalary(row.entry, row.player);
      const economy = resolvePlayerEconomyContract({
        playerId: row.player.id,
        player: row.player,
        rosterEntry: row.entry,
      });
      const marketValue =
        normalizeVisibleRosterMoney(row.entry.currentValue ?? row.entry.purchasePrice ?? null, economy.marketValue) ??
        economy.marketValue ??
        null;
      const rating = playerRatingsById.get(row.player.id) ?? null;
      const seasonPerformance = playerSeasonPerformanceMap.get(row.player.id) ?? null;
      return {
        ...row,
        portrait,
        salary,
        marketValue,
        marketValueDelta: getPlayerDisplayMarketValueDelta({
          player: row.player,
          rosterEntry: row.entry,
          gameState,
        }),
        salaryDelta: getRosterEntrySalaryDelta(row.entry, row.player, gameState),
        xp: row.player.currentXP ?? 0,
        fatigue: row.player.fatigue ?? 0,
        ppPow: rating?.ppPow ?? seasonPerformance?.pointsByArea.pow ?? null,
        ppSpe: rating?.ppSpe ?? seasonPerformance?.pointsByArea.spe ?? null,
        ppMen: rating?.ppMen ?? seasonPerformance?.pointsByArea.men ?? null,
        ppSoc: rating?.ppSoc ?? seasonPerformance?.pointsByArea.soc ?? null,
      };
    })
    .sort((left, right) => {
      const leftRoleScore = /star|core|starter/i.test(left.entry.roleTag ?? "") ? 1 : 0;
      const rightRoleScore = /star|core|starter/i.test(right.entry.roleTag ?? "") ? 1 : 0;
      if (rightRoleScore !== leftRoleScore) {
        return rightRoleScore - leftRoleScore;
      }

      const ppsDelta = (right.playerPps ?? Number.NEGATIVE_INFINITY) - (left.playerPps ?? Number.NEGATIVE_INFINITY);
      if (ppsDelta !== 0) {
        return ppsDelta;
      }

      const mvsDelta = (right.playerMvs ?? Number.NEGATIVE_INFINITY) - (left.playerMvs ?? Number.NEGATIVE_INFINITY);
      if (mvsDelta !== 0) {
        return mvsDelta;
      }

      return (right.playerOvr ?? Number.NEGATIVE_INFINITY) - (left.playerOvr ?? Number.NEGATIVE_INFINITY);
    })
    .slice(0, 6);
}
