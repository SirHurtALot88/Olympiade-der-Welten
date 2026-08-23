import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import type { SeasonGuvPosten } from "@/lib/finance/season-end-guv";
import { normalizeEconomyMoney, resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getSeasonDerivations } from "@/lib/foundation/get-season-derivations";
import { roundValue } from "@/lib/foundation/foundation-number-utils";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { saisonstandDisciplineColumns } from "@/lib/foundation/saisonstand-column-contract";
import { buildTeamSeasonAreaPoints } from "@/lib/foundation/season-area-points";
import { buildTeamPrizeSummary } from "@/lib/season/prize-money";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";
import { buildAllTimeTableFromSnapshots } from "@/lib/season/season-snapshot-helpers";

type TeamManagementSnapshotStanding = {
  rank: number | null;
  points: number | null;
  cash: number | null;
  cashFc?: number | null;
  startplatz?: number | null;
  rankDiff?: number | null;
  sponsorBasis?: number | null;
  sponsorRank?: number | null;
  sponsorTotal?: number | null;
  sponsorSeason?: number | null;
  guv?: number | null;
  /** Aufschlüsselung der GuV in ihre Posten — kommt aus dem Feed, damit der Hover nichts neu rechnet. */
  guvPosten?: SeasonGuvPosten[] | null;
  cashTotal?: number | null;
  form?: number | null;
  transfers?: number | null;
  rosterCount?: number | null;
  salaryTotal?: number | null;
  marketValueTotal?: number | null;
  budget?: number | null;
  playerMin?: number | null;
  playerOpt?: number | null;
  disciplineValues?: Record<string, number | null> | null;
};

type TeamManagementTransferSummary = {
  transferCount: number;
  /**
   * Kaeufe und Verkaeufe GETRENNT gezaehlt — fuer den Transfer-Hover im Saisonstand (Chris, 23.08.).
   * `transferCount` ist die Summe beider und sagt allein nicht, in welche Richtung gehandelt wurde;
   * genau das war Chris' Beanstandung an der Netto-Spalte (`ls9jfg`).
   */
  transferBuyCount: number;
  transferSellCount: number;
  transferBuyTotal: number;
  transferSellTotal: number;
  transferNet: number;
};

/**
 * Transfersaldo je Team — MIT SAISONFILTER.
 *
 * Ohne den Filter summierte diese Rechnung die GESAMTE Transferhistorie und lieferte damit den
 * Alle-Zeiten-Saldo in eine Zeile, die eine SAISON beschreibt. Im Saisonstand stand die Zahl
 * direkt neben Sponsoren, Gehaeltern und GuV — alles Saisonwerte — und war dadurch nicht als
 * andere Groesse erkennbar.
 *
 * Gemessen am Abnahme-Spielstand (Saison 2, Spieltag 4): Wrecking Legionnaires zeigte
 * −251,47, der Saldo der laufenden Saison ist aber −43,48 (322,21 Kaeufe gegen 70,74 Verkaeufe
 * ueber BEIDE Saisons; in Saison 2 allein ein Kauf ueber 43,48). Project Suicide −270,34 statt
 * −50,17, Cold Steel −341,55 statt −108,95. Der Loewenanteil stammt aus dem Liga-Draft der
 * Saison 1, der jeden Grundstock-Spieler als Kauf schreibt.
 *
 * `seasonId = null` behaelt bewusst das alte Verhalten (alle Saisons) — dafuer gibt es Aufrufer
 * ohne Saisonbezug.
 */
function buildTransferSummaryByTeamIdFromHistory(gameState: GameState, seasonId: string | null = null) {
  const summary = new Map<string, TeamManagementTransferSummary>();

  for (const entry of gameState.transferHistory ?? []) {
    if (seasonId != null && entry.seasonId !== seasonId) {
      continue;
    }
    const fee = typeof entry.fee === "number" && Number.isFinite(entry.fee) ? entry.fee : 0;

    if (entry.transferType === "buy" && entry.toTeamId) {
      const current = summary.get(entry.toTeamId) ?? {
        transferCount: 0,
        transferBuyCount: 0,
        transferSellCount: 0,
        transferBuyTotal: 0,
        transferSellTotal: 0,
        transferNet: 0,
      };
      current.transferCount += 1;
      current.transferBuyCount += 1;
      current.transferBuyTotal = roundValue(current.transferBuyTotal + fee, 2);
      current.transferNet = roundValue(current.transferSellTotal - current.transferBuyTotal, 2);
      summary.set(entry.toTeamId, current);
    }

    if (entry.transferType === "sell" && entry.fromTeamId) {
      const current = summary.get(entry.fromTeamId) ?? {
        transferCount: 0,
        transferBuyCount: 0,
        transferSellCount: 0,
        transferBuyTotal: 0,
        transferSellTotal: 0,
        transferNet: 0,
      };
      current.transferCount += 1;
      current.transferSellCount += 1;
      current.transferSellTotal = roundValue(current.transferSellTotal + fee, 2);
      current.transferNet = roundValue(current.transferSellTotal - current.transferBuyTotal, 2);
      summary.set(entry.fromTeamId, current);
    }
  }

  return Object.fromEntries(summary.entries());
}

type TeamManagementSnapshotInput = {
  gameState: GameState;
  saveId?: string;
  seasonId?: string;
  preferStandingDisciplineValues?: boolean;
  standingsByTeamId?: Record<string, TeamManagementSnapshotStanding>;
  needScoreByTeamId?: Record<string, number | null | undefined>;
  transferSummaryByTeamId?: Record<string, TeamManagementTransferSummary | undefined>;
};

export type TeamManagementSnapshotRow = {
  team: Team;
  teamId: string;
  teamCode: string;
  teamName: string;
  generalManagerName: string | null;
  generalManagerTitle: string | null;
  generalManagerInfluencePct: number | null;
  rank: number | null;
  points: number | null;
  rosterCount: number;
  salaryTotal: number;
  avgContractLength: number | null;
  marketValueTotal: number | null;
  cash: number | null;
  cashFc: number | null;
  budget: number | null;
  formAvg: number | null;
  financeForm: number | null;
  needScore: number | null;
  avgMarketValue: number | null;
  avgPps: number | null;
  avgOvr: number | null;
  ppsTotal: number;
  ppsPow: number;
  ppsSpe: number;
  ppsMen: number;
  ppsSoc: number;
  playerMin: number | null;
  playerOpt: number | null;
  rosterTarget: string | null;
  transferCount: number;
  /** Getrennt gezaehlt — speist den Transfer-Hover im Saisonstand. */
  transferBuyCount: number;
  transferSellCount: number;
  transferBuyTotal: number;
  transferSellTotal: number;
  transferNet: number;
  transfersSeasonValue: number | null;
  cashDelta: number | null;
  startplatz: number | null;
  rankDiff: number | null;
  sponsorBasis: number | null;
  sponsorRank: number | null;
  sponsorTotal: number | null;
  sponsorSeason: number | null;
  guv: number | null;
  /**
   * Die Posten, aus denen `guv` besteht — IMMER vollständig, auch die mit 0. Chris: „bitte alles was
   * berechnet wird dann auch in das Hover rein bringen damit man es sieht selbst wenn es 0 ist."
   */
  guvPosten: SeasonGuvPosten[] | null;
  cashTotal: number | null;
  historicalPow: number | null;
  historicalSpe: number | null;
  historicalMen: number | null;
  historicalSoc: number | null;
  historicalGoldCount: number;
  historicalSilverCount: number;
  historicalBronzeCount: number;
  historicalTop5Count: number;
  historicalTop10Count: number;
  historicalAvgRank: number | null;
  historicalAvgPoints: number | null;
  historicalPointsTotal: number | null;
  historicalPointsBySeason: Array<{
    seasonId: string;
    seasonName: string;
    points: number | null;
    rank: number | null;
  }>;
  // Optional gehalten, damit bestehende Test-Fixtures/Fremd-Konstruktoren gültig
  // bleiben; die produktiven Builder setzen es immer, Konsumenten nutzen `?? []`.
  historicalEconomyBySeason?: Array<{
    seasonId: string;
    seasonName: string;
    marketValueTotal: number | null;
    cash: number | null;
  }>;
  historicalSeasonsPlayed: number;
  historicalBestRank: number | null;
  historicalLastSeasonRank: number | null;
  historicalLastSeasonPoints: number | null;
  historicalHasData: boolean;
  disciplineValues: Record<string, number | null>;
  roster: RosterEntry[];
  rosterPlayers: Array<{ entry: RosterEntry; player: Player }>;
};

function deriveDisplayedCash(input: {
  teamCash: number | null;
  budget: number | null;
  transferNet: number | null;
  hasCashPrizeApply: boolean;
}) {
  if (input.teamCash != null && Number.isFinite(input.teamCash)) {
    return roundValue(input.teamCash, 2);
  }

  if (
    input.budget != null &&
    Number.isFinite(input.budget) &&
    input.transferNet != null &&
    Number.isFinite(input.transferNet)
  ) {
    return roundValue(input.budget + input.transferNet, 2);
  }

  return input.teamCash;
}

function buildStartBudgetRankMap(teams: Team[]) {
  const sorted = [...teams].sort((left, right) => {
    const leftBudget = Number.isFinite(left.budget) ? left.budget : Number.NEGATIVE_INFINITY;
    const rightBudget = Number.isFinite(right.budget) ? right.budget : Number.NEGATIVE_INFINITY;
    if (rightBudget !== leftBudget) {
      return rightBudget - leftBudget;
    }
    return left.name.localeCompare(right.name, "de");
  });

  return new Map(sorted.map((team, index) => [team.teamId, index + 1] as const));
}

function getRosterDisplaySalary(entry: RosterEntry, player?: Player | null) {
  return resolvePlayerEconomyContract({ player, rosterEntry: entry }).salary ?? 0;
}

function getRosterPlayers(
  playersById: Map<string, Player>,
  roster: RosterEntry[],
) {
  return roster
    .map((entry) => ({
      entry,
      player: playersById.get(entry.playerId),
    }))
    .filter((item): item is { entry: RosterEntry; player: Player } => Boolean(item.player));
}

const visibleSeasonPointsDisciplineKeys = saisonstandDisciplineColumns.filter(
  (columnKey) => columnKey !== "bonuspunkte",
);

function deriveVisibleSeasonPoints(
  disciplineValues: Record<string, number | null> | null | undefined,
) {
  if (!disciplineValues) {
    return null;
  }

  const numericValues = visibleSeasonPointsDisciplineKeys
    .map((disciplineKey) => disciplineValues[disciplineKey])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (numericValues.length === 0) {
    return null;
  }

  return roundValue(numericValues.reduce((sum, value) => sum + value, 0), 1);
}

/**
 * Perf (Audit #2 F4/F5): `buildTeamSeasonOverviewRows` ist eine liga-weite O(Teams×Kader)-Berechnung
 * (Rating-Maps, Setpoint-Reduktionen, Snapshot-Historie) und wird auf dem Default-Input-Pfad dutzendfach
 * mit DEMSELBEN `gameState` aufgerufen — Sponsor-Angebotsgenerierung (×N Teams/Ziele), Settlement-Schleifen,
 * Objective-Evaluator, Client-Sponsors-Tab. Der Memo cached pro `gameState`-Identität (WeakMap → wird beim
 * Klonen/Ersetzen automatisch invalidiert, passend zum immutable-GameState-Muster des Projekts). Der Cache
 * greift NUR, wenn keine custom `standingsByTeamId`/`needScoreByTeamId`/`transferSummaryByTeamId` übergeben
 * werden (sonst hängt das Ergebnis von nicht-identitätsstabilen Objekten ab → uncached). Rückgabe ist stets
 * eine flache Array-Kopie, weil mehrere Aufrufer das Ergebnis in-place `.sort()`en.
 */
const overviewRowsCache = new WeakMap<GameState, Map<string, TeamManagementSnapshotRow[]>>();

export function buildTeamSeasonOverviewRows(input: TeamManagementSnapshotInput): TeamManagementSnapshotRow[] {
  const cacheable =
    input.standingsByTeamId === undefined &&
    input.needScoreByTeamId === undefined &&
    input.transferSummaryByTeamId === undefined;
  const cacheKey = cacheable
    ? `${input.saveId ?? ""}|${input.seasonId ?? input.gameState.season.id}|${input.preferStandingDisciplineValues ? 1 : 0}`
    : null;

  if (cacheKey != null) {
    const cached = overviewRowsCache.get(input.gameState)?.get(cacheKey);
    if (cached) {
      return cached.slice();
    }
  }

  const rows = buildTeamSeasonOverviewRowsUncached(input);

  if (cacheKey != null) {
    let byKey = overviewRowsCache.get(input.gameState);
    if (!byKey) {
      byKey = new Map();
      overviewRowsCache.set(input.gameState, byKey);
    }
    byKey.set(cacheKey, rows);
    return rows.slice();
  }

  return rows;
}

function buildTeamSeasonOverviewRowsUncached(input: TeamManagementSnapshotInput): TeamManagementSnapshotRow[] {
  const {
    gameState,
    saveId,
    seasonId = gameState.season.id,
    preferStandingDisciplineValues = false,
    standingsByTeamId = (gameState.seasonState.standings ?? {}) as Record<string, TeamManagementSnapshotStanding>,
    needScoreByTeamId = {},
    transferSummaryByTeamId = {},
  } = input;
  // Diese Zeilen beschreiben GENAU EINE Saison (`seasonId`) — der Transfersaldo muss sich auf
  // dieselbe beziehen, sonst steht ein Alle-Zeiten-Wert zwischen lauter Saisonwerten.
  const derivedTransferSummaryByTeamId = buildTransferSummaryByTeamIdFromHistory(gameState, seasonId);
  const seasonSnapshots = gameState.seasonState.seasonSnapshots ?? [];
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const rostersByTeamId = new Map<string, RosterEntry[]>();
  for (const rosterEntry of gameState.rosters) {
    const existing = rostersByTeamId.get(rosterEntry.teamId);
    if (existing) {
      existing.push(rosterEntry);
      continue;
    }
    rostersByTeamId.set(rosterEntry.teamId, [rosterEntry]);
  }
  const historicalStandingsByTeamId = new Map<
    string,
    Array<{
      snapshot: (typeof seasonSnapshots)[number];
      standing: (typeof seasonSnapshots)[number]["finalStandings"][number];
    }>
  >();
  for (const snapshot of seasonSnapshots) {
    for (const standing of snapshot.finalStandings) {
      const existing = historicalStandingsByTeamId.get(standing.teamId);
      const item = { snapshot, standing };
      if (existing) {
        existing.push(item);
        continue;
      }
      historicalStandingsByTeamId.set(standing.teamId, [item]);
    }
  }
  const hasCashPrizeApply = (gameState.seasonState.cashPrizeApplyLogs ?? []).some(
    (entry) => entry.seasonId === seasonId,
  );
  const seasonDerivations = saveId
    ? getSeasonDerivations({ gameState, saveId, seasonId })
    : null;
  const seasonPointsLedger = seasonDerivations?.ledger ?? buildSeasonPointsLedger(gameState, seasonId);
  const playerRatingsById =
    seasonDerivations?.ratingsById ?? buildPlayerRatingContractMap(gameState, seasonPointsLedger);
  const allTimeTableByTeamId = new Map(
    buildAllTimeTableFromSnapshots(seasonSnapshots, gameState.teams).map((row) => [row.teamId, row] as const),
  );
  const startBudgetRankByTeamId = buildStartBudgetRankMap(gameState.teams);
  const currentSalaryFactor =
    getSeasonEconomyFactorWindow({
      saveId: "team-management-overview",
      seasonId,
      seasonState: gameState.seasonState,
    }).find((row) => row.seasonLabel === "Aktuell")?.factor ?? 1;

  const baseRows = gameState.teams.map((team) => {
    const generalManager = getTeamGeneralManager(gameState, team.teamId);
    const roster = rostersByTeamId.get(team.teamId) ?? [];
    const rosterPlayers = getRosterPlayers(playersById, roster);
    const standing = standingsByTeamId[team.teamId] ?? null;
    const usesArchivedSnapshotValues =
      standing?.rosterCount != null ||
      standing?.salaryTotal != null ||
      standing?.marketValueTotal != null;
    const transferSummary = transferSummaryByTeamId[team.teamId] ?? derivedTransferSummaryByTeamId[team.teamId] ?? null;
    const avgContractLength =
      roster.length > 0
        ? roundValue(roster.reduce((sum, entry) => sum + entry.contractLength, 0) / roster.length, 1)
        : null;
    const salaryTotal =
      rosterPlayers.length > 0
        ? roundValue(
            rosterPlayers.reduce((sum, item) => sum + getRosterDisplaySalary(item.entry, item.player), 0),
            2,
          )
        : roundValue(
            roster.reduce((sum, entry) => sum + (normalizeEconomyMoney(entry.salary) ?? 0), 0),
            2,
          );
    const marketValueTotal =
      rosterPlayers.length > 0
        ? roundValue(
            rosterPlayers.reduce(
              (sum, item) =>
                sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.entry }).marketValue ?? 0),
              0,
            ),
            2,
          )
        : null;
    const averageMarketValue =
      marketValueTotal != null && rosterPlayers.length > 0
        ? roundValue(marketValueTotal / rosterPlayers.length, 2)
        : null;
    const seasonPointsSummary = seasonPointsLedger.teamSummariesByTeamId.get(team.teamId) ?? null;
    const currentPpsTotal = roundValue(seasonPointsSummary?.totalPoints ?? 0, 1);
    const hasCurrentPps = (seasonPointsSummary?.playerDerivedTotal ?? 0) > 0;
    const fallbackPpsTotal = 0;
    const ppsValues = rosterPlayers.map((item) => seasonPointsLedger.playerSummariesByPlayerId.get(item.player.id)?.totalPoints ?? 0);
    const avgPps =
      ppsValues.length > 0
        ? roundValue(ppsValues.reduce((sum, value) => sum + value, 0) / ppsValues.length, 2)
        : null;
    const ovrValues = rosterPlayers
      .map((item) => playerRatingsById.get(item.player.id)?.ovrNormalized ?? null)
      .filter((value): value is number => value != null && Number.isFinite(value));
    const avgOvr =
      ovrValues.length > 0
        ? roundValue(ovrValues.reduce((sum, value) => sum + value, 0) / ovrValues.length, 2)
        : null;
    const ppsTotal = hasCurrentPps ? currentPpsTotal : fallbackPpsTotal;
    const formAvg =
      rosterPlayers.length > 0
        ? roundValue(
            rosterPlayers.reduce((sum, item) => sum + item.player.form, 0) / rosterPlayers.length,
            1,
          )
        : null;
    const playerMin = standing?.playerMin ?? null;
    const playerOpt = standing?.playerOpt ?? null;
    const budget = standing?.budget ?? team.budget ?? null;
    const transferNet = standing?.transfers ?? transferSummary?.transferNet ?? 0;
    const cash = deriveDisplayedCash({
      teamCash: usesArchivedSnapshotValues ? standing?.cash ?? team.cash ?? null : team.cash ?? standing?.cash ?? null,
      budget,
      transferNet,
      hasCashPrizeApply,
    });
    const cashFc = standing?.cashFc ?? null;
    const cashDelta = budget != null && cash != null ? roundValue(cash - budget, 2) : null;
    // Eine Rechnung fuer Tabelle UND RANG-Popover (`lib/foundation/season-area-points.ts`) —
    // vorher lagen die drei Helfer privat hier, und das Popover baute sich seine eigenen Zahlen.
    const areaPoints = buildTeamSeasonAreaPoints({
      standingDisciplineValues: standing?.disciplineValues,
      ledgerPointsByDiscipline: seasonPointsSummary?.pointsByDiscipline ?? null,
      ledgerPointsByArea: seasonPointsSummary?.pointsByArea ?? null,
      ledgerTotalPoints: ppsTotal,
      hasCurrentPps,
      preferStandingDisciplineValues,
    });
    const disciplineValues = areaPoints.disciplineValues;
    const displayPpsPow = areaPoints.displayPow;
    const displayPpsSpe = areaPoints.displaySpe;
    const displayPpsMen = areaPoints.displayMen;
    const displayPpsSoc = areaPoints.displaySoc;
    const displayPpsTotal = areaPoints.displayTotal;
    disciplineValues.bonuspunkte =
      hasCurrentPps && seasonPointsSummary != null && seasonPointsSummary.mutatorPpsBonus > 0
        ? roundValue(seasonPointsSummary.mutatorPpsBonus, 1)
        : disciplineValues.bonuspunkte ?? null;
    const visibleSeasonPoints = deriveVisibleSeasonPoints(disciplineValues);
    const storedStandingPoints =
      standing?.points != null && Number.isFinite(standing.points)
        ? roundValue(standing.points, 1)
        : null;
    const currentVisiblePoints =
      storedStandingPoints != null && storedStandingPoints > 0
        ? storedStandingPoints
        : visibleSeasonPoints != null && visibleSeasonPoints > 0
          ? visibleSeasonPoints
          : hasCurrentPps
            ? displayPpsTotal
            : null;
    const sponsorSeason =
      standing?.sponsorTotal != null &&
      standing?.sponsorBasis != null &&
      standing?.sponsorRank != null
        ? roundValue(standing.sponsorTotal - standing.sponsorBasis - standing.sponsorRank, 2)
        : null;
    const allTimeRow = allTimeTableByTeamId.get(team.teamId) ?? null;
    const teamHistoricalSnapshots = historicalStandingsByTeamId.get(team.teamId) ?? [];
    const historicalHasData = allTimeRow?.hasHistory ?? teamHistoricalSnapshots.length > 0;
    const historicalPointsTotal = allTimeRow?.totalHistoricalPoints ?? null;
    const historicalPointsBySeason = [...teamHistoricalSnapshots]
      .sort((left, right) => left.snapshot.seasonId.localeCompare(right.snapshot.seasonId, "de", { numeric: true }))
      .map((entry) => ({
        seasonId: entry.snapshot.seasonId,
        seasonName: entry.snapshot.seasonName,
        points:
          entry.standing.disciplinePoints != null
            ? roundValue(entry.standing.disciplinePoints, 1)
            : entry.standing.points != null
              ? roundValue(entry.standing.points, 1)
              : null,
        rank: entry.standing.rank ?? null,
      }));
    // Ökonomie je abgeschlossener Saison (echte Snapshot-Endwerte, chronologisch).
    // Gleiche Feld-Präzedenz wie die Team-Detail-Historie (…TotalEnd → …End),
    // damit MW/Cash-Verläufe konsistent sind. Fehlt ein Feld im Snapshot, bleibt
    // der Punkt null und wird beim Zeichnen übersprungen (kein Fake).
    const historicalEconomyBySeason = [...teamHistoricalSnapshots]
      .sort((left, right) => left.snapshot.seasonId.localeCompare(right.snapshot.seasonId, "de", { numeric: true }))
      .map((entry) => ({
        seasonId: entry.snapshot.seasonId,
        seasonName: entry.snapshot.seasonName,
        marketValueTotal:
          entry.standing.marketValueTotalEnd != null && Number.isFinite(entry.standing.marketValueTotalEnd)
            ? roundValue(entry.standing.marketValueTotalEnd, 2)
            : entry.standing.marketValueEnd != null && Number.isFinite(entry.standing.marketValueEnd)
              ? roundValue(entry.standing.marketValueEnd, 2)
              : null,
        cash:
          entry.standing.cashTotal != null && Number.isFinite(entry.standing.cashTotal)
            ? roundValue(entry.standing.cashTotal, 2)
            : entry.standing.cashEnd != null && Number.isFinite(entry.standing.cashEnd)
              ? roundValue(entry.standing.cashEnd, 2)
              : null,
      }));
    const historicalAvgPoints =
      historicalPointsBySeason.length > 0
        ? roundValue(
            historicalPointsBySeason.reduce((sum, entry) => sum + (entry.points ?? 0), 0) /
              historicalPointsBySeason.length,
            1,
          )
        : null;
    const latestHistoricalEntry =
      [...teamHistoricalSnapshots].sort((left, right) => {
        const leftTs = Date.parse(left.snapshot.archivedAt ?? "");
        const rightTs = Date.parse(right.snapshot.archivedAt ?? "");
        if (Number.isFinite(leftTs) && Number.isFinite(rightTs) && leftTs !== rightTs) {
          return rightTs - leftTs;
        }
        return right.snapshot.seasonId.localeCompare(left.snapshot.seasonId, "de");
      })[0] ?? null;
    const startBudgetRank = startBudgetRankByTeamId.get(team.teamId) ?? null;
    // Preseason (points=0): den getragenen Vorsaison-Endrang (`standing.startplatz`, von buildZeroStandings
    // fortgeschrieben) VOR dem statischen S1-Budget-Rang nutzen. Sonst friert ab S2 der Budget-Rang alle
    // rang-abhängigen Sponsor-Größen ein (contract.startRank, Verbesserungsziel, rankTarget, Quality-'current')
    // → Aufsteiger bekommen triviale, Absteiger unerreichbare Ziele.
    const activeRank =
      currentVisiblePoints == null
        ? standing?.startplatz ?? startBudgetRank
        : standing?.rank ?? startBudgetRank;

    return {
      team,
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      generalManagerName: generalManager?.profile.name ?? null,
      generalManagerTitle: generalManager?.profile.title ?? null,
      generalManagerInfluencePct: generalManager?.assignment.influencePct ?? null,
      rank: activeRank,
      points: currentVisiblePoints,
      rosterCount: roster.length > 0 ? roster.length : usesArchivedSnapshotValues ? standing?.rosterCount ?? roster.length : roster.length,
      salaryTotal: roster.length > 0 ? salaryTotal : usesArchivedSnapshotValues ? normalizeEconomyMoney(standing?.salaryTotal) ?? salaryTotal : salaryTotal,
      avgContractLength,
      marketValueTotal: roster.length > 0 ? marketValueTotal : usesArchivedSnapshotValues ? normalizeEconomyMoney(standing?.marketValueTotal) ?? marketValueTotal : marketValueTotal,
      cash,
      cashFc,
      budget,
      formAvg,
      financeForm: standing?.form ?? null,
      needScore: needScoreByTeamId[team.teamId] ?? null,
      avgMarketValue: averageMarketValue,
      avgPps,
      avgOvr,
      ppsTotal: displayPpsTotal,
      ppsPow: displayPpsPow,
      ppsSpe: displayPpsSpe,
      ppsMen: displayPpsMen,
      ppsSoc: displayPpsSoc,
      playerMin,
      playerOpt,
      rosterTarget:
        playerMin != null && playerOpt != null
          ? `${Math.round(playerMin)} / ${Math.round(playerOpt)}`
          : null,
      transferCount: transferSummary?.transferCount ?? 0,
      transferBuyCount: transferSummary?.transferBuyCount ?? 0,
      transferSellCount: transferSummary?.transferSellCount ?? 0,
      transferBuyTotal: transferSummary?.transferBuyTotal ?? 0,
      transferSellTotal: transferSummary?.transferSellTotal ?? 0,
      transferNet,
      transfersSeasonValue: transferNet,
      cashDelta,
      startplatz: standing?.startplatz ?? startBudgetRank,
      rankDiff: standing?.rankDiff ?? null,
      sponsorBasis: standing?.sponsorBasis ?? null,
      sponsorRank: standing?.sponsorRank ?? null,
      sponsorTotal: standing?.sponsorTotal ?? null,
      sponsorSeason,
      guv: standing?.guv ?? null,
      guvPosten: standing?.guvPosten ?? null,
      cashTotal: standing?.cashTotal ?? null,
      historicalPow: allTimeRow?.historicalPow ?? null,
      historicalSpe: allTimeRow?.historicalSpe ?? null,
      historicalMen: allTimeRow?.historicalMen ?? null,
      historicalSoc: allTimeRow?.historicalSoc ?? null,
      historicalGoldCount: allTimeRow?.gold ?? 0,
      historicalSilverCount: allTimeRow?.silver ?? 0,
      historicalBronzeCount: allTimeRow?.bronze ?? 0,
      historicalTop5Count: allTimeRow?.top5 ?? 0,
      historicalTop10Count: allTimeRow?.top10 ?? 0,
      historicalAvgRank: allTimeRow?.avgRank ?? null,
      historicalAvgPoints,
      historicalPointsTotal,
      historicalPointsBySeason,
      historicalEconomyBySeason,
      historicalSeasonsPlayed: allTimeRow?.seasonsPlayed ?? teamHistoricalSnapshots.length,
      historicalBestRank: allTimeRow?.bestRank ?? null,
      historicalLastSeasonRank: latestHistoricalEntry?.standing.rank ?? allTimeRow?.lastSeasonRank ?? null,
      historicalLastSeasonPoints:
        latestHistoricalEntry?.standing.disciplinePoints != null
          ? roundValue(latestHistoricalEntry.standing.disciplinePoints, 1)
          : null,
      historicalHasData,
      disciplineValues,
      roster,
      rosterPlayers,
    };
  });

  const startRankRows = [...baseRows]
    .filter((row) => row.budget != null)
    .sort((left, right) => {
      if ((right.budget ?? Number.NEGATIVE_INFINITY) !== (left.budget ?? Number.NEGATIVE_INFINITY)) {
        return (right.budget ?? Number.NEGATIVE_INFINITY) - (left.budget ?? Number.NEGATIVE_INFINITY);
      }
      return left.teamName.localeCompare(right.teamName, "de");
    });

  const derivedStartRankByTeamId = new Map<string, number>();
  let previousBudget: number | null = null;
  let previousRank = 0;

  startRankRows.forEach((row, index) => {
    if (previousBudget != null && row.budget === previousBudget) {
      derivedStartRankByTeamId.set(row.teamId, previousRank);
      return;
    }

    const nextRank = index + 1;
    previousBudget = row.budget;
    previousRank = nextRank;
    derivedStartRankByTeamId.set(row.teamId, nextRank);
  });

  const rowsWithDerivedRanks = baseRows
    .map((row) => {
      const derivedStartRank = derivedStartRankByTeamId.get(row.teamId) ?? null;
      return {
        ...row,
        rank: row.rank ?? derivedStartRank,
        startplatz: row.startplatz ?? derivedStartRank,
      };
    });

  /**
   * GEMELDET VON CHRIS („ROTER ALARM"): die GuV-Spalte wies dicke Gewinne aus, während dieselben
   * Teams mit NEGATIVEM Cash aus der Saison gingen.
   *
   * DIE URSACHE STAND HIER. Bis zu diesem Fix gewann `prizeSummary` gegen den echten Wert:
   *
   *     guv: normalizeEconomyMoney(prizeSummary?.profitLoss ?? row.guv) ?? …
   *
   * `prizeSummary` kommt aus `buildTeamPrizeSummary` → `prize-money.ts`, also aus der ABGESCHAFFTEN
   * Preisgeldkurve (`CASH_PRIZE_BENCHMARK_ONLY = true`, wird nie ausgezahlt). Weil `??` nur bei
   * `null`/`undefined` weiterfällt und der Benchmark für JEDE Zeile eine Zahl liefert, war
   * `row.guv` — der Wert, der wirklich gebucht wird — ein toter Fallback. Der Benchmark kennt weder
   * Gebäude noch Apron noch Kredite noch Vorstandsziele; bei Rang `null` (→ `rank ?? 0`) fiel er
   * zusätzlich auf „Basis 0 minus Gehälter" zurück. Dazu skalierte `normalizeEconomyMoney` jeden
   * Betrag über 1000 still durch 100 — asymmetrisch, denn unter −1000 blieb er unangetastet.
   *
   * JETZT: der echte Stand gewinnt, der Benchmark füllt nur noch Spalten, die es ohne ihn gar nicht
   * gäbe (Cash-Forecast). Für GuV und Sponsorsumme gibt es KEINEN Preisgeld-Rückfall mehr — fehlt
   * der echte Wert, steht dort nichts. Eine leere Zelle ist ehrlich; eine falsche Zahl war der Bug.
   */
  const prizeSummaryByTeamId = new Map(
    buildTeamPrizeSummary(
      rowsWithDerivedRanks.map((row) => ({
        rank: row.rank ?? 0,
        startPlace: row.startplatz ?? row.rank ?? 0,
        team: {
          teamId: row.team.teamId,
          name: row.team.name,
          cash: row.cash ?? 0,
        },
        upkeep: row.salaryTotal,
        transfers: row.transfersSeasonValue ?? 0,
      })),
      currentSalaryFactor,
      gameState.seasonState.adminBalancingConfig,
    ).map((row) => [row.teamId, row] as const),
  );

  return rowsWithDerivedRanks
    .map((row) => {
      const prizeSummary = prizeSummaryByTeamId.get(row.teamId) ?? null;
      return {
        ...row,
        cashFc: row.cashFc ?? prizeSummary?.cashForecast ?? null,
        sponsorBasis: row.sponsorBasis ?? prizeSummary?.basis ?? null,
        sponsorRank: row.sponsorRank ?? prizeSummary?.placementBonus ?? null,
        sponsorSeason: row.sponsorSeason ?? prizeSummary?.sponsorSeason ?? null,
        sponsorTotal: row.sponsorTotal ?? null,
        guv: row.guv ?? null,
        guvPosten: row.guvPosten ?? null,
        cashTotal: row.cashTotal ?? prizeSummary?.cashTotal ?? null,
      };
    })
    .sort((left, right) => {
      const leftRank = left.rank ?? Number.POSITIVE_INFINITY;
      const rightRank = right.rank ?? Number.POSITIVE_INFINITY;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return (right.cash ?? Number.NEGATIVE_INFINITY) - (left.cash ?? Number.NEGATIVE_INFINITY);
    });
}

function buildEmptyDisciplineValues(): Record<string, number | null> {
  return Object.fromEntries(saisonstandDisciplineColumns.map((key) => [key, null]));
}

/** Fast standings rows for first paint while the team-overview slice loads. Skips season derivations. */
export function buildLightweightTeamSeasonStandRows(input: {
  gameState: GameState;
  standingsByTeamId?: Record<string, TeamManagementSnapshotStanding>;
  transferSummaryByTeamId?: Record<string, TeamManagementTransferSummary | undefined>;
}): TeamManagementSnapshotRow[] {
  const { gameState, standingsByTeamId = {}, transferSummaryByTeamId = {} } = input;
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const rostersByTeamId = new Map<string, RosterEntry[]>();
  for (const rosterEntry of gameState.rosters) {
    const existing = rostersByTeamId.get(rosterEntry.teamId);
    if (existing) {
      existing.push(rosterEntry);
      continue;
    }
    rostersByTeamId.set(rosterEntry.teamId, [rosterEntry]);
  }
  // Erstanstrich derselben Saisonzeilen — gleicher Saisonbezug wie im vollen Aufbau, sonst
  // springt die Spalte beim Nachladen von einem Alle-Zeiten-Wert auf den Saisonwert.
  const derivedTransferSummaryByTeamId = buildTransferSummaryByTeamIdFromHistory(
    gameState,
    gameState.season.id,
  );

  return gameState.teams
    .map((team) => {
      const generalManager = getTeamGeneralManager(gameState, team.teamId);
      const roster = rostersByTeamId.get(team.teamId) ?? [];
      const rosterPlayers = getRosterPlayers(playersById, roster);
      const standing = standingsByTeamId[team.teamId] ?? null;
      const transferSummary = transferSummaryByTeamId[team.teamId] ?? derivedTransferSummaryByTeamId[team.teamId] ?? null;
      const avgContractLength =
        roster.length > 0
          ? roundValue(roster.reduce((sum, entry) => sum + entry.contractLength, 0) / roster.length, 1)
          : null;
      const salaryTotal =
        rosterPlayers.length > 0
          ? roundValue(
              rosterPlayers.reduce((sum, item) => sum + getRosterDisplaySalary(item.entry, item.player), 0),
              2,
            )
          : roundValue(
              roster.reduce((sum, entry) => sum + (normalizeEconomyMoney(entry.salary) ?? 0), 0),
              2,
            );
      const marketValueTotal =
        rosterPlayers.length > 0
          ? roundValue(
              rosterPlayers.reduce(
                (sum, item) =>
                  sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.entry }).marketValue ?? 0),
                0,
              ),
              2,
            )
          : null;
      const disciplineValues = {
        ...buildEmptyDisciplineValues(),
        ...(standing?.disciplineValues ?? {}),
      };

      return {
        team,
        teamId: team.teamId,
        teamCode: team.shortCode,
        teamName: team.name,
        generalManagerName: generalManager?.profile.name ?? null,
        generalManagerTitle: generalManager?.profile.title ?? null,
        generalManagerInfluencePct: generalManager?.assignment.influencePct ?? null,
        rank: standing?.rank ?? null,
        points: standing?.points ?? null,
        rosterCount: standing?.rosterCount ?? roster.length,
        salaryTotal: standing?.salaryTotal ?? salaryTotal,
        avgContractLength,
        marketValueTotal: standing?.marketValueTotal ?? marketValueTotal,
        cash: standing?.cash ?? team.cash ?? null,
        cashFc: standing?.cashFc ?? null,
        budget: standing?.budget ?? team.budget ?? null,
        formAvg: null,
        financeForm: standing?.form ?? null,
        needScore: null,
        avgMarketValue: null,
        avgPps: null,
        avgOvr: null,
        ppsTotal: 0,
        ppsPow: 0,
        ppsSpe: 0,
        ppsMen: 0,
        ppsSoc: 0,
        playerMin: standing?.playerMin ?? null,
        playerOpt: standing?.playerOpt ?? null,
        rosterTarget: null,
        transferCount: transferSummary?.transferCount ?? 0,
        transferBuyCount: transferSummary?.transferBuyCount ?? 0,
        transferSellCount: transferSummary?.transferSellCount ?? 0,
        transferBuyTotal: transferSummary?.transferBuyTotal ?? 0,
        transferSellTotal: transferSummary?.transferSellTotal ?? 0,
        transferNet: transferSummary?.transferNet ?? 0,
        transfersSeasonValue: standing?.transfers ?? transferSummary?.transferNet ?? null,
        cashDelta: null,
        startplatz: standing?.startplatz ?? null,
        rankDiff: standing?.rankDiff ?? null,
        sponsorBasis: standing?.sponsorBasis ?? null,
        sponsorRank: standing?.sponsorRank ?? null,
        sponsorTotal: standing?.sponsorTotal ?? null,
        sponsorSeason: standing?.sponsorSeason ?? null,
        guv: standing?.guv ?? null,
        guvPosten: standing?.guvPosten ?? null,
        cashTotal: standing?.cashTotal ?? null,
        historicalPow: null,
        historicalSpe: null,
        historicalMen: null,
        historicalSoc: null,
        historicalGoldCount: 0,
        historicalSilverCount: 0,
        historicalBronzeCount: 0,
        historicalTop5Count: 0,
        historicalTop10Count: 0,
        historicalAvgRank: null,
        historicalAvgPoints: null,
        historicalPointsTotal: null,
        historicalPointsBySeason: [],
        historicalEconomyBySeason: [],
        historicalSeasonsPlayed: 0,
        historicalBestRank: null,
        historicalLastSeasonRank: null,
        historicalLastSeasonPoints: null,
        historicalHasData: false,
        disciplineValues,
        roster,
        rosterPlayers,
      } satisfies TeamManagementSnapshotRow;
    })
    .sort((left, right) => {
      const leftRank = left.rank ?? Number.POSITIVE_INFINITY;
      const rightRank = right.rank ?? Number.POSITIVE_INFINITY;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return (right.points ?? Number.NEGATIVE_INFINITY) - (left.points ?? Number.NEGATIVE_INFINITY);
    });
}
