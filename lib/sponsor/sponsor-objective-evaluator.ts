import type { GameState, Player, SponsorOfferComponent } from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows, type TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { computeTeamExpectation } from "@/lib/board/team-season-objectives-service";
import { calculateFacilityIncome, calculateFacilityUpkeep, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import {
  FAN_INFRASTRUCTURE_LEVEL_CAP,
  fanInfrastructureLevelSum,
  getTeamAxisRank,
  parseAxisTargetValue,
  computeTransferWindowNet,
  SPONSOR_OBJ_BRACKET_HERO,
  SPONSOR_OBJ_DISCIPLINE_GOOD_RANK,
  SPONSOR_OBJ_FATIGUE_CAP,
  SPONSOR_OBJ_GOLDEN_DISCIPLINE_RANK,
  SPONSOR_OBJ_TALENT_JUMP_MV,
  SPONSOR_OBJ_TITLE_SHOCK_WEAK_RANK,
  type SponsorAxisKey,
} from "@/lib/sponsor/sponsor-special-objectives";

export function evaluateSponsorRankObjective(currentRank: number | null, targetRank: number) {
  if (currentRank == null) return "open" as const;
  if (currentRank <= targetRank) return "completed" as const;
  if (currentRank <= targetRank + 2) return "at_risk" as const;
  return "failed" as const;
}

export function evaluateSponsorImprovementObjective(startRank: number | null, currentRank: number | null, targetImprovement: number) {
  if (startRank == null || currentRank == null) return "open" as const;
  const improvement = startRank - currentRank;
  if (improvement >= targetImprovement) return "completed" as const;
  if (improvement >= targetImprovement - 1) return "at_risk" as const;
  return "open" as const;
}

export function evaluateSpecialComponentForObjective(
  gameState: GameState,
  teamId: string,
  component: SponsorOfferComponent,
): "open" | "completed" | "at_risk" {
  const specialKey = component.specialKey ?? "";
  const rows = buildTeamSeasonOverviewRows({ gameState });
  const row = rows.find((entry) => entry.teamId === teamId) ?? null;

  if (specialKey === "axis_rank_top") {
    const parsed = parseAxisTargetValue(component.targetValue);
    if (!parsed) {
      return "open";
    }
    const axisRank = getTeamAxisRank(rows, teamId, parsed.axis as SponsorAxisKey, gameState);
    if (axisRank.rank == null) {
      return "open";
    }
    if (axisRank.rank <= parsed.topRank) {
      return "completed";
    }
    if (axisRank.rank <= parsed.topRank + 2) {
      return "at_risk";
    }
    return "open";
  }

  if (specialKey === "salary_pressure_max") {
    const target = typeof component.targetValue === "number" ? component.targetValue : Number(component.targetValue);
    const salary = row?.salaryTotal ?? getTeamDisplaySalaryTotal(gameState, teamId);
    if (!Number.isFinite(target) || target <= 0) {
      return "open";
    }
    if (salary <= target) {
      return "completed";
    }
    if (salary <= target * 1.05) {
      return "at_risk";
    }
    return "open";
  }

  if (specialKey === "transfer_profit_min") {
    const target = typeof component.targetValue === "number" ? component.targetValue : 5;
    return (row?.transferNet ?? 0) >= target ? "completed" : (row?.transferNet ?? 0) >= target - 2 ? "at_risk" : "open";
  }
  if (specialKey === "discipline_top3_count") {
    const performances = (gameState.seasonState.playerDisciplinePerformances ?? []).filter(
      (entry) => entry.teamId === teamId && (entry.rankInDiscipline ?? 99) <= 3,
    );
    const target = typeof component.targetValue === "number" ? component.targetValue : 2;
    return performances.length >= target ? "completed" : performances.length >= target - 1 ? "at_risk" : "open";
  }
  if (specialKey === "fan_infrastructure") {
    // Greift, sobald mindestens ein Income-Gebäude (fan_shop / arena_upgrade) auf L1 steht. Die
    // eigentliche Höhe der Auszahlung skaliert dann in der Settlement mit der Gesamtstufe (siehe
    // fanInfrastructureLevelSum / die Settlement-Skalierung) — hier nur die Ja/Nein-Schwelle.
    const target = typeof component.targetValue === "number" ? component.targetValue : 1;
    const levelSum = fanInfrastructureLevelSum(gameState, teamId);
    if (levelSum >= target) return "completed";
    return "open";
  }
  if (specialKey === "beat_expected_rank") {
    // targetValue = beim Signing eingefrorene absolute Ziel-Platzierung (erwartete Qualität − margin).
    const target = typeof component.targetValue === "number" ? component.targetValue : Number(component.targetValue);
    const rank = row?.rank ?? null;
    if (rank == null || !Number.isFinite(target)) return "open";
    if (rank <= target) return "completed";
    if (rank <= target + 2) return "at_risk";
    return "open";
  }
  if (specialKey === "form_color_cover") {
    const rosterPlayerIds = new Set(
      gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId),
    );
    const colors = new Set(
      gameState.players
        .filter((player) => rosterPlayerIds.has(player.id))
        .map((player) => player.className)
        .filter(Boolean),
    );
    const parsedTarget =
      typeof component.targetValue === "number"
        ? component.targetValue
        : typeof component.targetValue === "string"
          ? Number.parseInt(component.targetValue, 10)
          : NaN;
    const targetColors = Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : 4;
    return colors.size >= targetColors ? "completed" : colors.size >= targetColors - 1 ? "at_risk" : "open";
  }
  return "open";
}

// =====================================================================================================
// TEIL B — mehrstufige Auswertung (erreichte Stufe / Fraction 0..1) für die neuen Sponsor-Bonusziele.
//
// `evaluateSpecialComponentStage` liefert statt des binären "open|completed" eine ERREICHTE STUFE als
// Fraction 0..1. Bestehende binäre Keys (ohne `stages`) fallen auf den Legacy-Evaluator zurück (0 oder 1).
// Neue mehrstufige Keys nutzen eine "höher = besser"-Metrik + die aufsteigenden `stages` der Komponente.
// `fan_infrastructure` skaliert weiterhin kontinuierlich (levelSum / CAP).
// =====================================================================================================

export type SponsorObjectiveStageResult = {
  /** Erreichte Auszahlungs-Fraction in [0,1]. */
  fraction: number;
  /** Index der höchsten erreichten Stufe (-1 = keine). */
  stageIndex: number;
  /** Roh-Metrik ("höher = besser"), oder null wenn nicht berechenbar. */
  metric: number | null;
  /** Beschriftung der erreichten Stufe (oder der Legacy-Status). */
  reachedLabel: string;
};

const MARKET_VALUE_BRACKET_STARTS = [0, 12.5, 17.5, 22.5, 30, 37.5, 45, 55, 70];

function marketValueBracketId(marketValue: number | null | undefined): number {
  if (marketValue == null || !Number.isFinite(marketValue)) return 0;
  let bracket = 0;
  for (let index = 0; index < MARKET_VALUE_BRACKET_STARTS.length; index += 1) {
    if (marketValue >= MARKET_VALUE_BRACKET_STARTS[index]!) bracket = index;
  }
  return bracket;
}

/** bracketScore je Spieler (1 = Bester seiner Marktwert-Klasse), gespiegelt aus der Beliebtheits-Logik. */
function buildBracketScoreMap(gameState: GameState): Map<string, number> {
  const ratingMap = buildPlayerRatingContractMap(gameState);
  const members = new Map<number, Array<{ playerId: string; mvs: number }>>();
  for (const [playerId, row] of ratingMap) {
    const mvs = typeof row.mvs === "number" && Number.isFinite(row.mvs) ? row.mvs : 0;
    if (mvs <= 0) continue;
    const bracketId = marketValueBracketId(row.marketValue);
    const list = members.get(bracketId) ?? [];
    list.push({ playerId, mvs });
    members.set(bracketId, list);
  }
  const scoreByPlayerId = new Map<string, number>();
  for (const list of members.values()) {
    const sorted = list.sort((left, right) => right.mvs - left.mvs);
    const count = sorted.length;
    sorted.forEach((member, index) => {
      scoreByPlayerId.set(member.playerId, count <= 1 ? 1 : 1 - index / (count - 1));
    });
  }
  return scoreByPlayerId;
}

function rosterPlayerIdsForTeam(gameState: GameState, teamId: string): Set<string> {
  return new Set(gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId));
}

function currentSeasonPerformances(gameState: GameState, teamId: string) {
  const seasonMatchdayResultIds = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((record) => record.seasonId === gameState.season.id)
      .map((record) => record.id),
  );
  return (gameState.seasonState.playerDisciplinePerformances ?? []).filter(
    (perf) => perf.teamId === teamId && seasonMatchdayResultIds.has(perf.matchdayResultId),
  );
}

/** Endrang eines Teams aus der Tabelle (Fallback startplatz). */
function finalRankForTeam(gameState: GameState, teamId: string, row: TeamManagementSnapshotRow | null): number | null {
  const standing = (gameState.seasonState.standings ?? {})[teamId] as { rank?: number; startplatz?: number } | undefined;
  if (typeof standing?.rank === "number" && Number.isFinite(standing.rank)) return standing.rank;
  if (typeof row?.rank === "number" && Number.isFinite(row.rank)) return row.rank;
  if (typeof standing?.startplatz === "number" && Number.isFinite(standing.startplatz)) return standing.startplatz;
  return null;
}

function expectedRankForTeam(rows: TeamManagementSnapshotRow[], teamId: string): number | null {
  const rowsByTeamId = new Map(rows.map((row) => [row.teamId, row] as const));
  const row = rowsByTeamId.get(teamId);
  if (!row) return null;
  return computeTeamExpectation({ row, rowsByTeamId, identity: null }).expectedRank;
}

function parseRivalTeamId(targetValue: SponsorOfferComponent["targetValue"]): string | null {
  const raw = typeof targetValue === "string" ? targetValue : "";
  const match = /^rival:(.*)$/.exec(raw);
  return match && match[1] ? match[1] : null;
}

/**
 * Roh-Metrik ("höher = besser") eines Bonusziels. null → nicht berechenbar (Ziel gilt als offen).
 * Behandelt sowohl die 14 Standard- als auch die 6 Golden-Keys.
 */
export function computeObjectiveProgressMetric(
  gameState: GameState,
  teamId: string,
  component: SponsorOfferComponent,
): number | null {
  const key = component.specialKey ?? "";
  const rows = buildTeamSeasonOverviewRows({ gameState });
  const row = rows.find((entry) => entry.teamId === teamId) ?? null;

  switch (key) {
    case "underdog_story":
    case "golden_fairytale": {
      const expected = expectedRankForTeam(rows, teamId);
      const final = finalRankForTeam(gameState, teamId, row);
      if (expected == null || final == null) return null;
      return expected - final;
    }
    case "momentum_series": {
      // Zahl der Spieltage, an denen das Team beim Gesamtscore im oberen Drittel der Liga lag.
      const matchdayIdByResultId = new Map(
        (gameState.seasonState.matchdayResults ?? [])
          .filter((record) => record.seasonId === gameState.season.id)
          .map((record) => [record.id, record.matchdayId] as const),
      );
      const scoresByMatchday = new Map<string, Map<string, number>>();
      for (const result of gameState.seasonState.disciplineResults ?? []) {
        const matchdayId = matchdayIdByResultId.get(result.matchdayResultId);
        if (!matchdayId) continue;
        const teamScores = scoresByMatchday.get(matchdayId) ?? new Map<string, number>();
        teamScores.set(result.teamId, (teamScores.get(result.teamId) ?? 0) + (result.totalScore ?? 0));
        scoresByMatchday.set(matchdayId, teamScores);
      }
      let strong = 0;
      for (const teamScores of scoresByMatchday.values()) {
        const ranked = [...teamScores.entries()].sort((left, right) => right[1] - left[1]);
        const cutoff = Math.max(1, Math.ceil(ranked.length / 3));
        const index = ranked.findIndex(([id]) => id === teamId);
        if (index >= 0 && index < cutoff) strong += 1;
      }
      return strong;
    }
    case "discipline_dominance": {
      const rosterSize = rosterPlayerIdsForTeam(gameState, teamId).size;
      if (rosterSize === 0) return 0;
      const goodRank = SPONSOR_OBJ_DISCIPLINE_GOOD_RANK;
      const good = new Set(
        currentSeasonPerformances(gameState, teamId)
          .filter((perf) => (perf.rankInDiscipline ?? 99) <= goodRank)
          .map((perf) => perf.playerId),
      );
      return (100 * good.size) / rosterSize;
    }
    case "axis_ascension": {
      const parsed = parseAxisTargetValue(component.targetValue);
      if (!parsed) return null;
      const axisRank = getTeamAxisRank(rows, teamId, parsed.axis as SponsorAxisKey, gameState);
      if (axisRank.rank == null) return null;
      // targetValue kodiert die Baseline-Platzierung → Verbesserung = baseline − aktuell.
      return parsed.topRank - axisRank.rank;
    }
    case "fan_cult_player": {
      const rosterIds = rosterPlayerIdsForTeam(gameState, teamId);
      const bracket = buildBracketScoreMap(gameState);
      const playersById = new Map(gameState.players.map((p) => [p.id, p] as const));
      let best = 0;
      for (const id of rosterIds) {
        const score = (bracket.get(id) ?? 0) * 100;
        const player = playersById.get(id);
        const fanBonus = player?.traitsPositive?.includes("FanFavorite") ? 10 : 0;
        best = Math.max(best, Math.min(100, score + fanBonus));
      }
      return best;
    }
    case "homegrown_elevation": {
      const bracket = buildBracketScoreMap(gameState);
      const homegrown = homegrownPlayerIds(gameState, teamId);
      let best = 0;
      for (const id of homegrown) {
        best = Math.max(best, (bracket.get(id) ?? 0) * 100);
      }
      return best;
    }
    case "rival_humiliation":
    case "golden_rival_deluxe": {
      const rivalId = parseRivalTeamId(component.targetValue);
      if (!rivalId) return null;
      const ownRank = finalRankForTeam(gameState, teamId, row);
      const rivalRow = rows.find((entry) => entry.teamId === rivalId) ?? null;
      const rivalRank = finalRankForTeam(gameState, rivalId, rivalRow);
      if (ownRank == null || rivalRank == null) return null;
      return rivalRank - ownRank;
    }
    case "solvency_series": {
      const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
      return typeof team?.cash === "number" ? team.cash : 0;
    }
    case "transfer_trader":
      return computeTransferWindowNet(gameState, teamId, gameState.season.id);
    case "sustainability_architect": {
      const facilities = getTeamFacilityState(gameState, teamId);
      const income = calculateFacilityIncome(facilities);
      const upkeep = calculateFacilityUpkeep(facilities);
      return income - upkeep;
    }
    case "fatigue_management": {
      const rosterIds = rosterPlayerIdsForTeam(gameState, teamId);
      if (rosterIds.size === 0) return 0;
      const cap = SPONSOR_OBJ_FATIGUE_CAP;
      const fresh = gameState.players.filter(
        (player) => rosterIds.has(player.id) && (typeof player.fatigue === "number" ? player.fatigue : 0) <= cap,
      ).length;
      return (100 * fresh) / rosterIds.size;
    }
    case "form_color_cover": {
      const rosterIds = rosterPlayerIdsForTeam(gameState, teamId);
      const colors = new Set(
        gameState.players.filter((player) => rosterIds.has(player.id)).map((player) => player.className).filter(Boolean),
      );
      return colors.size;
    }
    case "golden_crowd_favorites": {
      const rosterIds = rosterPlayerIdsForTeam(gameState, teamId);
      const bracket = buildBracketScoreMap(gameState);
      let heroes = 0;
      for (const id of rosterIds) {
        if ((bracket.get(id) ?? 0) >= SPONSOR_OBJ_BRACKET_HERO) heroes += 1;
      }
      return heroes;
    }
    case "golden_talent_forge": {
      // Zahl der (eigenen) Spieler mit großem Marktwert-Sprung in DIESER Saison (Development-Signal).
      const rosterIds = rosterPlayerIdsForTeam(gameState, teamId);
      const threshold = SPONSOR_OBJ_TALENT_JUMP_MV;
      const jumped = new Set<string>();
      for (const event of gameState.playerProgressionEvents ?? []) {
        if (event.seasonId !== gameState.season.id) continue;
        if (event.teamId !== teamId && !rosterIds.has(event.playerId)) continue;
        const before = event.progressionSnapshotBefore;
        const after = event.progressionSnapshotAfter;
        const mvBefore = typeof before?.marketValue === "number" ? before.marketValue : null;
        const mvAfter =
          typeof after?.marketValuePreview === "number"
            ? after.marketValuePreview
            : typeof after?.marketValue === "number"
              ? after.marketValue
              : null;
        if (mvBefore != null && mvAfter != null && mvAfter - mvBefore >= threshold) {
          jumped.add(event.playerId);
        }
      }
      return jumped.size;
    }
    case "golden_discipline_monopoly": {
      const goodRank = SPONSOR_OBJ_GOLDEN_DISCIPLINE_RANK;
      const players = new Set(
        currentSeasonPerformances(gameState, teamId)
          .filter((perf) => (perf.rankInDiscipline ?? 99) <= goodRank)
          .map((perf) => perf.playerId),
      );
      return players.size;
    }
    case "golden_title_shock": {
      // Nur "schwache" Teams (eingefrorene Qualitäts-Platzierung hoch) sind eignungsberechtigt.
      const raw = typeof component.targetValue === "string" ? component.targetValue : "";
      const match = /^title_shock:(\d+)$/.exec(raw);
      const qualityRank = match ? Number.parseInt(match[1]!, 10) : Number.NaN;
      if (Number.isFinite(qualityRank) && qualityRank < SPONSOR_OBJ_TITLE_SHOCK_WEAK_RANK) {
        return 0; // starkes Team → Titel-Schock zählt nicht.
      }
      const final = finalRankForTeam(gameState, teamId, row);
      if (final == null) return 0;
      if (final <= 1) return 3;
      if (final <= 2) return 2;
      if (final <= 3) return 1;
      return 0;
    }
    default:
      return null;
  }
}

function homegrownPlayerIds(gameState: GameState, teamId: string): Set<string> {
  const rosterEntries = gameState.rosters.filter((entry) => entry.teamId === teamId);
  const rosterIds = new Set(rosterEntries.map((entry) => entry.playerId));
  const homegrown = new Set<string>();
  // (a) Roster-Rolle prospect = selbst entwickelter Nachwuchs.
  for (const entry of rosterEntries) {
    if (entry.roleTag === "prospect" || entry.promisedRole === "prospect") homegrown.add(entry.playerId);
  }
  // (b) transferHistory-Quelle draft/nachwuchs/academy (Zugang zum Team via Nachwuchs).
  for (const t of gameState.transferHistory ?? []) {
    if (t.toTeamId !== teamId || !rosterIds.has(t.playerId)) continue;
    const source = String(t.source ?? "").toLowerCase();
    if (/draft|nachwuchs|academy|prospect|youth/.test(source)) homegrown.add(t.playerId);
  }
  return homegrown;
}

/**
 * Mehrstufige Auswertung: erreichte Stufe / Fraction 0..1 einer special-Komponente. Generalisiert den
 * bisherigen binären Pfad — bestehende binäre Keys (ohne `stages`) liefern weiterhin 0 oder 1.
 */
export function evaluateSpecialComponentStage(
  gameState: GameState,
  teamId: string,
  component: SponsorOfferComponent,
): SponsorObjectiveStageResult {
  const key = component.specialKey ?? "";

  // Fan-Infrastruktur: kontinuierliche Skalierung (levelSum / CAP) — kein Stufen-Raster.
  if (key === "fan_infrastructure") {
    const levelSum = fanInfrastructureLevelSum(gameState, teamId);
    const fraction = Math.max(0, Math.min(1, levelSum / FAN_INFRASTRUCTURE_LEVEL_CAP));
    return {
      fraction,
      stageIndex: fraction > 0 ? 0 : -1,
      metric: levelSum,
      reachedLabel: `Fan-Infrastruktur ${levelSum}/${FAN_INFRASTRUCTURE_LEVEL_CAP}`,
    };
  }

  const stages = component.stages;
  if (stages && stages.length > 0) {
    const metric = computeObjectiveProgressMetric(gameState, teamId, component);
    if (metric == null) {
      return { fraction: 0, stageIndex: -1, metric: null, reachedLabel: "offen" };
    }
    const ascending = [...stages].sort((left, right) => left.threshold - right.threshold);
    let best = { fraction: 0, stageIndex: -1, label: "offen" };
    ascending.forEach((entry, index) => {
      if (metric >= entry.threshold) {
        best = { fraction: entry.fraction, stageIndex: index, label: entry.label };
      }
    });
    return { fraction: best.fraction, stageIndex: best.stageIndex, metric, reachedLabel: best.label };
  }

  // Legacy/binär: bestehender String-Evaluator → completed = volle Auszahlung.
  const status = evaluateSpecialComponentForObjective(gameState, teamId, component);
  return {
    fraction: status === "completed" ? 1 : 0,
    stageIndex: status === "completed" ? 0 : -1,
    metric: null,
    reachedLabel: status,
  };
}
