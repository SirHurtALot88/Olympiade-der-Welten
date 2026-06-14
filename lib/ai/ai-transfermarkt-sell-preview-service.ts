import { evaluateAiNeeds } from "@/lib/ai/aiNeedsEngine";
import type {
  GameState,
  Player,
  PlayerDisciplinePerformanceRecord,
  RosterEntry,
  SeasonSnapshotRecord,
  Team,
  TeamControlMode,
  TeamStrategyProfile,
} from "@/lib/data/olyDataTypes";
import { loadFoundationSnapshotFromPrisma } from "@/lib/db/read/foundation-read-repository";
import { projectFoundationStateFromPrisma } from "@/lib/db/read/foundation-read-projection";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildPlayerRatingContractMap, type PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import { getTeamControlSettings, withNormalizedTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { getTeamStrategyProfile, withNormalizedTeamStrategyProfiles } from "@/lib/foundation/team-strategy-profiles";
import { normalizeTransfermarktToken } from "@/lib/market/transfermarkt-fit";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { assessPlayerBoardTrust, type PlayerBoardTrustRenewalPolicy } from "@/lib/ai/player-board-trust-service";

export type AiSellPreviewSource = "sqlite" | "prisma";
export type AiSellPreviewTeamScope = "ai" | "all";
export type AiSellPreviewTeamStatus =
  | "ready"
  | "no_sell_need"
  | "low_roster_depth"
  | "no_candidates"
  | "warning"
  | "blocked";
export type AiSellPreviewBudgetPressure = "healthy" | "tight" | "critical" | "unknown";

export type AiSellPreviewParams = {
  source?: AiSellPreviewSource;
  saveId?: string | null;
  seasonId?: string | null;
  teamId?: string | null;
  teamScope?: AiSellPreviewTeamScope;
  limit?: number | null;
};

export type AiSellPreviewCandidate = {
  activePlayerId: string;
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  raceName: string;
  ovr: number | null;
  mvs: number | null;
  salary: number | null;
  marketValue: number | null;
  expectedSellValue: number | null;
  contractLength: number | null;
  rosterAfter: number | null;
  salaryAfter: number | null;
  cashAfter: number | null;
  sportValueSummary: string;
  performanceSummary: string;
  strategyFitSummary: string;
  reasonToSell: string[];
  reasonToKeep: string[];
  reasonsToSell: string[];
  reasonsToKeep: string[];
  warnings: string[];
  boardTrustScore: number | null;
  boardTrustSmiley: string | null;
  boardTrustPolicy: PlayerBoardTrustRenewalPolicy;
  boardTrustReasons: string[];
  boardTrustWarnings: string[];
  salaryCapMultiplier: number | null;
  sellPriority: number;
  sellPriorityScore: number;
};

export type AiSellPreviewTeamEntry = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: TeamControlMode;
  aiSellPreviewEnabled: boolean;
  status: AiSellPreviewTeamStatus;
  strategySummary: string;
  cash: number | null;
  rosterCount: number | null;
  salaryTotal: number | null;
  marketValueTotal: number | null;
  rosterSize: number | null;
  playerMin: number | null;
  playerOpt: number | null;
  targetRosterMin: number | null;
  targetRosterOpt: number | null;
  budgetPressure: AiSellPreviewBudgetPressure;
  sellCandidates: AiSellPreviewCandidate[];
  keepCore: AiSellPreviewCandidate[];
  warnings: string[];
  blockingReasons: string[];
  explanation: string;
};

export type AiSellPreviewResult = {
  readOnly: true;
  source: AiSellPreviewSource;
  scope: {
    saveId: string;
    seasonId: string;
    teamId: string | null;
    teamScope: AiSellPreviewTeamScope;
  };
  totalTeams: number;
  aiTeams: number;
  skippedManual: number;
  skippedPassive: number;
  skippedDisabled: number;
  readyTeams: number;
  warningTeams: number;
  blockedTeams: number;
  teams: AiSellPreviewTeamEntry[];
  debugPerformance?: {
    durationMs: number;
    candidateCount: number;
    sellValuePreviewCount: number;
    needsEvaluationCount: number;
    snapshotLookupCount: number;
  };
};

type ResolvedPreviewContext = {
  source: AiSellPreviewSource;
  saveId: string;
  seasonId: string;
  gameState: GameState;
};

type PlayerPerformanceSummary = {
  appearances: number;
  averageContribution: number | null;
  averageFinalScore: number | null;
  top10Count: number;
  mvpCount: number;
};

type SellPreviewRunCache = {
  latestSnapshot: SeasonSnapshotRecord | null;
  performanceByTeamPlayer: Map<string, PlayerPerformanceSummary>;
  needsByTeamId: Map<string, ReturnType<typeof evaluateAiNeeds>>;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function normalizeGameState(gameState: GameState) {
  return withNormalizedTeamStrategyProfiles(withNormalizedTeamControlSettings(gameState));
}

function getBudgetPressure(team: Team): AiSellPreviewBudgetPressure {
  if (!Number.isFinite(team.cash) || !Number.isFinite(team.budget) || team.budget <= 0) {
    return "unknown";
  }

  const ratio = team.cash / team.budget;
  if (ratio <= 0.18) return "critical";
  if (ratio <= 0.4) return "tight";
  return "healthy";
}

function getTeamRoster(gameState: GameState, teamId: string) {
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => ({
      roster: entry,
      player: gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null,
    }))
    .filter((item): item is { roster: RosterEntry; player: Player } => Boolean(item.player));
}

function getLatestCompletedSeasonSnapshot(gameState: GameState): SeasonSnapshotRecord | null {
  return [...(gameState.seasonState.seasonSnapshots ?? [])]
    .filter((snapshot) => snapshot.status !== "dry_run" && snapshot.playerPerformances.length > 0)
    .sort((left, right) => {
      const leftTime = Date.parse(left.archivedAt ?? left.createdAt ?? "");
      const rightTime = Date.parse(right.archivedAt ?? right.createdAt ?? "");
      if (Number.isFinite(rightTime) && Number.isFinite(leftTime) && rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return right.seasonId.localeCompare(left.seasonId, "de", { numeric: true });
    })[0] ?? null;
}

function teamPlayerKey(teamId: string, playerId: string) {
  return `${teamId}::${playerId}`;
}

function buildSellPreviewRunCache(gameState: GameState): SellPreviewRunCache {
  const latestSnapshot = getLatestCompletedSeasonSnapshot(gameState);
  const grouped = new Map<string, PlayerDisciplinePerformanceRecord[]>();
  for (const performance of gameState.seasonState.playerDisciplinePerformances ?? []) {
    const key = teamPlayerKey(performance.teamId, performance.playerId);
    const rows = grouped.get(key) ?? [];
    rows.push(performance);
    grouped.set(key, rows);
  }
  const performanceByTeamPlayer = new Map<string, PlayerPerformanceSummary>();
  for (const [key, performances] of grouped) {
    performanceByTeamPlayer.set(key, {
      appearances: performances.length,
      averageContribution: roundValue(
        performances.reduce((sum, entry) => sum + entry.scoreContribution, 0) / performances.length,
        1,
      ),
      averageFinalScore: roundValue(
        performances.reduce((sum, entry) => sum + entry.finalPlayerScore, 0) / performances.length,
        1,
      ),
      top10Count: performances.filter((entry) => entry.isTop10).length,
      mvpCount: performances.filter((entry) => entry.isMvpCandidate).length,
    });
  }
  return {
    latestSnapshot,
    performanceByTeamPlayer,
    needsByTeamId: new Map(),
  };
}

function getPlayerPerformanceSummary(cache: SellPreviewRunCache, teamId: string, playerId: string): PlayerPerformanceSummary {
  const cached = cache.performanceByTeamPlayer.get(teamPlayerKey(teamId, playerId));
  if (cached) return cached;

  const snapshotPerformance = cache.latestSnapshot?.playerPerformances.find(
    (entry) => entry.playerId === playerId && (entry.teamId == null || entry.teamId === teamId),
  ) ?? null;

  if (snapshotPerformance) {
    return {
      appearances: snapshotPerformance.appearances,
      averageContribution: snapshotPerformance.averageContribution,
      averageFinalScore: snapshotPerformance.averageFinalScore,
      top10Count: snapshotPerformance.top10Count,
      mvpCount: snapshotPerformance.mvpCount,
    };
  }

  return {
    appearances: 0,
    averageContribution: null,
    averageFinalScore: null,
    top10Count: 0,
    mvpCount: 0,
  };
}

function getProfileTokens(player: Player) {
  return [
    player.className,
    player.race,
    ...player.subclasses,
    ...player.traitsPositive,
    ...player.traitsNegative,
  ]
    .map(normalizeTransfermarktToken)
    .filter(Boolean);
}

function countMatches(values: string[] | undefined, candidateTokens: string[]) {
  const normalizedValues = (values ?? []).map(normalizeTransfermarktToken).filter(Boolean);
  return normalizedValues.filter((token) => candidateTokens.some((candidate) => candidate === token || candidate.includes(token) || token.includes(candidate))).length;
}

function getPlayerAxisLabel(player: Player) {
  const entries = Object.entries(player.coreStats) as Array<["pow" | "spe" | "men" | "soc", number]>;
  const top = [...entries].sort((left, right) => right[1] - left[1])[0];
  return top?.[0] ?? null;
}

function matchesHardNoGo(profile: TeamStrategyProfile | null, player: Player) {
  if (!profile || profile.hardNoGos.length === 0) {
    return false;
  }

  const tokens = getProfileTokens(player);
  const normalizedRace = normalizeTransfermarktToken(player.race);
  return profile.hardNoGos.some((entry) => {
    const normalized = normalizeTransfermarktToken(entry);
    if (!normalized) {
      return false;
    }
    if (normalized.includes("nonhuman") && normalizedRace !== "human") {
      return true;
    }
    if (normalized.includes("human") && normalized.includes("anti") && normalizedRace === "human") {
      return true;
    }
    return tokens.some((token) => token === normalized || token.includes(normalized) || normalized.includes(token));
  });
}

function buildStrategySummary(profile: TeamStrategyProfile | null, player: Player) {
  if (!profile) {
    return {
      summary: "Kein Teamprofil vorhanden.",
      preferredHits: 0,
      avoidedHits: 0,
      preferredTraitHits: 0,
      avoidedTraitHits: 0,
    };
  }

  const tokens = getProfileTokens(player);
  const preferredRaceHits = countMatches(profile.preferredRaces, [normalizeTransfermarktToken(player.race)]);
  const avoidedRaceHits = countMatches(profile.avoidedRaces, [normalizeTransfermarktToken(player.race)]);
  const preferredClassHits = countMatches(profile.preferredClasses, [normalizeTransfermarktToken(player.className)]);
  const avoidedClassHits = countMatches(profile.avoidedClasses, [normalizeTransfermarktToken(player.className)]);
  const preferredTraitHits = countMatches(profile.preferredTraits, tokens);
  const avoidedTraitHits = countMatches(profile.dislikedTraits, tokens);
  const preferredArchetypeHits = countMatches(profile.preferredArchetypes, tokens);
  const avoidedArchetypeHits = countMatches(profile.avoidedArchetypes, tokens);

  const preferredHits = preferredRaceHits + preferredClassHits + preferredTraitHits + preferredArchetypeHits;
  const avoidedHits = avoidedRaceHits + avoidedClassHits + avoidedTraitHits + avoidedArchetypeHits;

  let summary = "Profil neutral.";
  if (preferredHits > avoidedHits) {
    summary = "Passt eher zum Teamprofil.";
  } else if (avoidedHits > preferredHits) {
    summary = "Widerspricht eher dem Teamprofil.";
  }

  return {
    summary,
    preferredHits,
    avoidedHits,
    preferredTraitHits,
    avoidedTraitHits,
  };
}

function buildSportValueSummary(player: Player, performance: PlayerPerformanceSummary) {
  if (performance.appearances === 0) {
    return `Noch keine lokale Performance-Historie. Kern: POW ${Math.round(player.coreStats.pow)} · SPE ${Math.round(player.coreStats.spe)} · MEN ${Math.round(player.coreStats.men)} · SOC ${Math.round(player.coreStats.soc)}.`;
  }

  return `${performance.appearances} Einsaetze · Beitrag Ø ${performance.averageContribution ?? "—"} · Final Score Ø ${performance.averageFinalScore ?? "—"} · Top 10 ${performance.top10Count}.`;
}

function buildExpectedSellValue(context: ResolvedPreviewContext, player: Player, roster: RosterEntry) {
  const economy = resolvePlayerEconomyContract({ player, rosterEntry: roster });
  if (context.source !== "sqlite") {
    return economy.marketValue;
  }

  const saleFactorBreakdown = buildTransfermarktSaleFactorBreakdown(context.gameState, player, roster);
  return saleFactorBreakdown.salePrice ?? economy.marketValue ?? null;
}

function buildCandidate(
  context: ResolvedPreviewContext,
  playerRatingsById: Map<string, PlayerRatingContractRow>,
  team: Team,
  roster: RosterEntry,
  player: Player,
  rosterSize: number,
  salaryTotal: number,
  playerMin: number | null,
  playerOpt: number | null,
  cache: SellPreviewRunCache,
) {
  const profile = getTeamStrategyProfile(context.gameState, team.teamId);
  const playerRating = playerRatingsById.get(player.id) ?? null;
  const performance = getPlayerPerformanceSummary(cache, team.teamId, player.id);
  const needs = cache.needsByTeamId.get(team.teamId) ?? evaluateAiNeeds(context.gameState, team.teamId);
  cache.needsByTeamId.set(team.teamId, needs);
  const identity = context.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
  const expectedSellValue = buildExpectedSellValue(context, player, roster);
  const economy = resolvePlayerEconomyContract({ player, rosterEntry: roster });
  const marketValue = economy.marketValue;
  const purchasePrice = economy.purchasePrice;
  const strategy = buildStrategySummary(profile, player);
  const salary = economy.salary;
  const reasonToSell: string[] = [];
  const reasonToKeep: string[] = [];
  const warnings: string[] = [];
  const hardNoGoHit = matchesHardNoGo(profile, player);
  const rosterAfter = Math.max(rosterSize - 1, 0);

  if (playerMin != null && rosterSize - 1 < playerMin) {
    warnings.push("Verkauf wuerde den Kader unter das Team-Minimum druecken.");
  }
  if (rosterSize <= 7) {
    warnings.push("Kader ist bereits sehr klein.");
  }
  if (expectedSellValue == null) {
    warnings.push("Kein belastbarer Verkaufswert aus der aktuellen Sell-Preview vorhanden.");
  }
  if (performance.appearances === 0) {
    warnings.push("Noch keine lokale Leistungs-Historie fuer diesen Spieler.");
  }

  const budgetPressure = getBudgetPressure(team);
  const salaryShare = salary != null && salaryTotal > 0 ? clamp(salary / salaryTotal, 0, 1) : 0;
  const cashShare = salary != null && team.cash > 0 ? clamp(salary / team.cash, 0, 1) : 0;
  const wagePressureScore = clamp(salaryShare * 0.7 + cashShare * 0.3, 0, 1);
  const profitDelta = expectedSellValue != null && purchasePrice != null ? expectedSellValue - purchasePrice : null;
  const profitScore = profitDelta != null && purchasePrice != null && purchasePrice > 0 ? clamp(profitDelta / purchasePrice, -1, 1) : null;
  const lowPerformanceScore =
    performance.averageContribution != null ? clamp(1 - performance.averageContribution / 75, 0, 1) : 0;
  const keepPerformanceScore =
    performance.averageContribution != null ? clamp(performance.averageContribution / 75, 0, 1) : 0;
  const hasMeaningfulPerformanceSample = performance.appearances >= 3;
  const underperformed =
    hasMeaningfulPerformanceSample &&
    ((performance.averageContribution != null && performance.averageContribution < 30) ||
      (performance.averageFinalScore != null &&
        playerRating?.ovrNormalized != null &&
        performance.averageFinalScore < playerRating.ovrNormalized * 0.48));
  const rosterPressureScore =
    playerOpt != null && rosterSize > playerOpt ? clamp((rosterSize - playerOpt) / Math.max(playerOpt, 1), 0, 1) : 0;
  const playerAxis = getPlayerAxisLabel(player);
  const coversNeedAxis = playerAxis ? needs.uncoveredNeedAxes.includes(playerAxis) : false;
  const nonStarterBonus = roster.roleTag !== "starter" ? 0.15 : 0;
  const shortContractScore = roster.contractLength <= 1 ? 0.16 : roster.contractLength === 2 ? 0.08 : 0;
  const sellAggression = (profile?.bias.sellForProfitAggression ?? 5) / 10;
  const wageSensitivity = (profile?.bias.wageSensitivity ?? 5) / 10;
  const loyaltyBias = (profile?.bias.loyaltyBias ?? 5) / 10;
  const negativeCashPressure = Number.isFinite(team.cash) && team.cash < 0;
  const weakTeamFit = strategy.avoidedHits > strategy.preferredHits || hardNoGoHit;
  const boardTrust = assessPlayerBoardTrust({
    boardConfidence: identity?.boardConfidence ?? null,
    appearances: performance.appearances,
    averageContribution: performance.averageContribution,
    averageFinalScore: performance.averageFinalScore,
    expectedPerformanceValue: playerRating?.ovrNormalized ?? player.rating ?? null,
    contractLength: roster.contractLength,
    roleTag: roster.roleTag ?? null,
    salary,
    marketValue,
    purchasePrice,
    currentValue: expectedSellValue,
    ovrRank: playerRating?.ovrRank ?? null,
    actualPpsRank: playerRating?.ppsSeasonRank ?? null,
    actualMvsRank: playerRating?.mvsRank ?? null,
    weakTeamFit,
    hardNoGoHit,
  });

  if (salary != null && wagePressureScore >= 0.28) {
    reasonToSell.push("hohes Gehalt im Verhaeltnis zum aktuellen Teambudget");
  } else if (salary != null && wagePressureScore <= 0.12) {
    reasonToKeep.push("geringe Gehaltslast");
  }

  if (profitDelta != null && profitDelta > 0) {
    reasonToSell.push(`realisierbarer Gewinn von ${roundValue(profitDelta, 1)}`);
  } else if (profitDelta != null && profitDelta < 0) {
    reasonToKeep.push("aktueller Verkauf wuerde unter Einkauf liegen");
  }

  if (underperformed) {
    reasonToSell.push("Performance blieb unter Erwartung");
  } else if (performance.averageContribution != null && performance.averageContribution < 25) {
    reasonToSell.push("schwache lokale Score-Beitraege");
  }
  if (performance.averageContribution != null && performance.averageContribution >= 40) {
    reasonToKeep.push("starke lokale Score-Beitraege");
  }
  if (performance.top10Count > 0) {
    reasonToKeep.push(`Top-10-Praesenz in ${performance.top10Count} Diszi-Einsaetzen`);
  }

  if (strategy.avoidedHits > strategy.preferredHits) {
    reasonToSell.push("passt nur schwach zum Teamprofil");
  }
  if (strategy.preferredHits > strategy.avoidedHits) {
    reasonToKeep.push("passt gut zum Teamprofil");
  }
  if (hardNoGoHit) {
    reasonToSell.push("faellt in ein Team-Hard-No-Go");
  }
  if (boardTrust.renewalPolicy === "salary_cap") {
    reasonToSell.push("Vorstand begrenzt Vertragsrahmen wegen Vertrauensverlust");
  }
  if (boardTrust.renewalPolicy === "renewal_warning") {
    reasonToSell.push("Vorstand warnt vor voller Verlaengerung");
  }
  if (boardTrust.renewalPolicy === "do_not_renew") {
    reasonToSell.push("Vorstand will keine Verlaengerung");
  }
  if (coversNeedAxis) {
    reasonToKeep.push(`deckt die aktuelle Achsenluecke ${playerAxis?.toUpperCase() ?? ""}`);
  }
  if (rosterSize > (playerOpt ?? rosterSize)) {
    reasonToSell.push("Kader liegt ueber dem Optimum");
  }
  if (roster.contractLength <= 1) {
    if (strategy.avoidedHits >= strategy.preferredHits || underperformed || hardNoGoHit) {
      reasonToSell.push("Vertrag laeuft aus und Fit/Leistung rechtfertigt keine automatische Verlaengerung");
    } else {
      reasonToSell.push("kurze Restvertragslaenge");
    }
  } else if (roster.contractLength >= 3) {
    reasonToKeep.push("laengerer Restvertrag");
  }

  const scoreRaw =
    18 +
    (negativeCashPressure ? 24 : 0) +
    wagePressureScore * 30 * wageSensitivity +
    Math.max(profitScore ?? 0, 0) * 24 * sellAggression +
    lowPerformanceScore * 18 +
    (underperformed ? 12 : 0) +
    rosterPressureScore * 16 +
    shortContractScore * 30 * (profile?.bias.shortContractPreference ?? 5) / 10 +
    (roster.contractLength <= 1 && (strategy.avoidedHits >= strategy.preferredHits || underperformed || hardNoGoHit) ? 10 : 0) +
    (boardTrust.renewalPolicy === "salary_cap" ? 5 : 0) +
    (boardTrust.renewalPolicy === "renewal_warning" ? 11 : 0) +
    (boardTrust.renewalPolicy === "do_not_renew" ? 22 : 0) +
    strategy.avoidedHits * 6 +
    (hardNoGoHit ? 14 : 0) +
    nonStarterBonus * 50 -
    keepPerformanceScore * 22 -
    strategy.preferredHits * 5 -
    (coversNeedAxis ? 12 : 0) -
    loyaltyBias * (roster.contractLength >= 3 ? 8 : 2);

  if (negativeCashPressure) {
    reasonToSell.unshift("negatives Teamcash zum Seasonstart");
  } else if (budgetPressure === "critical") {
    reasonToSell.unshift("Teamcash ist kritisch");
  } else if (budgetPressure === "healthy") {
    reasonToKeep.push("Teamcash ist entspannt");
  }

  const sellPriority = Math.round(clamp(scoreRaw, 0, 100));

  return {
    activePlayerId: roster.id,
    playerId: player.id,
    playerName: player.name,
    className: player.className,
    race: player.race,
    raceName: player.race,
    ovr: playerRating?.ovrNormalized ?? null,
    mvs: playerRating?.mvs ?? null,
    salary,
    marketValue,
    expectedSellValue,
    contractLength: roster.contractLength,
    rosterAfter,
    salaryAfter: salary != null ? Math.max(salaryTotal - salary, 0) : salaryTotal,
    cashAfter: expectedSellValue != null && team.cash != null ? roundValue(team.cash + expectedSellValue, 1) : null,
    sportValueSummary: buildSportValueSummary(player, performance),
    performanceSummary: buildSportValueSummary(player, performance),
    strategyFitSummary: `${strategy.summary} ${profile?.sellStyleNote ?? profile?.sellStyle ?? ""}`.trim(),
    reasonToSell,
    reasonToKeep,
    reasonsToSell: reasonToSell,
    reasonsToKeep: reasonToKeep,
    warnings,
    boardTrustScore: boardTrust.trustScore,
    boardTrustSmiley: boardTrust.smiley,
    boardTrustPolicy: boardTrust.renewalPolicy,
    boardTrustReasons: boardTrust.reasons,
    boardTrustWarnings: boardTrust.warnings,
    salaryCapMultiplier: boardTrust.salaryCapMultiplier,
    sellPriority,
    sellPriorityScore: sellPriority,
  } satisfies AiSellPreviewCandidate;
}

async function resolvePreviewContext(params: AiSellPreviewParams): Promise<ResolvedPreviewContext> {
  const source = params.source === "prisma" ? "prisma" : "sqlite";

  if (source === "prisma") {
    const snapshot = await loadFoundationSnapshotFromPrisma(params.saveId ?? undefined);
    if (!snapshot) {
      throw new Error("Prisma foundation snapshot could not be loaded.");
    }

    const projected = projectFoundationStateFromPrisma(snapshot);
    return {
      source,
      saveId: projected.save.saveId,
      seasonId: projected.save.gameState.season.id,
      gameState: normalizeGameState(projected.save.gameState),
    };
  }

  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const requestedSave = params.saveId ? persistence.getSaveById(params.saveId) : null;
  if (params.saveId && !requestedSave) {
    throw new Error(`Requested save ${params.saveId} could not be resolved for AI sell preview.`);
  }
  const save =
    requestedSave ??
    persistence.getActiveSave() ??
    bootstrapped.save;

  if (!save) {
    throw new Error("SQLite save could not be loaded.");
  }

  return {
    source,
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    gameState: normalizeGameState(save.gameState),
  };
}

function getTeamStatus(entry: {
  controlMode: TeamControlMode;
  aiSellPreviewEnabled: boolean;
  sellCandidates: AiSellPreviewCandidate[];
  keepCore: AiSellPreviewCandidate[];
  warnings: string[];
  blockingReasons: string[];
  teamScope: AiSellPreviewTeamScope;
  rosterSize: number;
  playerMin: number | null;
}) {
  if (!entry.aiSellPreviewEnabled && entry.controlMode === "ai") {
    return "blocked" as const;
  }
  if (entry.blockingReasons.length > 0) {
    return "blocked" as const;
  }
  if (entry.teamScope === "all" && entry.controlMode !== "ai") {
    return "warning" as const;
  }
  if (entry.playerMin != null && entry.rosterSize <= entry.playerMin) {
    return "low_roster_depth" as const;
  }
  if (entry.sellCandidates.length === 0) {
    return entry.keepCore.length > 0 ? ("no_sell_need" as const) : ("no_candidates" as const);
  }
  if (entry.sellCandidates.every((candidate) => candidate.warnings.length > 0)) {
    return "warning" as const;
  }
  return entry.warnings.length > 0 ? ("warning" as const) : ("ready" as const);
}

export async function buildAiTransfermarktSellPreview(params: AiSellPreviewParams = {}): Promise<AiSellPreviewResult> {
  const startedAt = Date.now();
  const context = await resolvePreviewContext(params);
  const playerRatingsById = buildPlayerRatingContractMap(context.gameState);
  const runCache = buildSellPreviewRunCache(context.gameState);
  const teamScope = params.teamScope === "all" ? "all" : "ai";
  const limit = typeof params.limit === "number" && Number.isFinite(params.limit) ? Math.max(1, Math.round(params.limit)) : 5;
  let candidateCount = 0;

  const requestedTeam =
    params.teamId != null
      ? context.gameState.teams.find((team) => team.teamId === params.teamId) ?? null
      : null;

  if (params.teamId && !requestedTeam) {
    throw new Error(`Team ${params.teamId} could not be found.`);
  }

  const candidateTeams = (requestedTeam ? [requestedTeam] : context.gameState.teams).filter((team) => {
    if (requestedTeam) return true;
    if (teamScope === "all") return true;
    const control = getTeamControlSettings(context.gameState, team.teamId);
    return control?.controlMode === "ai";
  });

  const teams = candidateTeams.map((team) => {
    const control = getTeamControlSettings(context.gameState, team.teamId);
    const profile = getTeamStrategyProfile(context.gameState, team.teamId);
    const roster = getTeamRoster(context.gameState, team.teamId);
    const identity = context.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const rosterSize = roster.length;
    const salaryTotal = roster.reduce(
      (sum, item) => sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.roster }).salary ?? 0),
      0,
    );
    const marketValueTotal = roster.reduce(
      (sum, item) => sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.roster }).marketValue ?? 0),
      0,
    );
    const warnings: string[] = [];
    const blockingReasons: string[] = [];
    const playerMin = identity?.playerMin ?? profile?.rosterMinTarget ?? null;
    const playerOpt = identity?.playerOpt ?? profile?.rosterOptTarget ?? null;

    if (teamScope === "all" && control?.controlMode === "manual") {
      warnings.push("manuell gesteuertes Team – Vorschlag nur informativ");
    }
    if (teamScope === "all" && control?.controlMode === "passive") {
      warnings.push("passives Team – Vorschlag nur informativ");
    }
    if (control?.controlMode === "ai" && !control.aiSellPreviewEnabled) {
      blockingReasons.push("AI-Sell-Preview ist fuer dieses Team deaktiviert");
    }
    if (roster.length === 0) {
      blockingReasons.push("kein aktiver Kader vorhanden");
    }

    const allCandidates = roster
      .map((item) =>
        buildCandidate(
          context,
          playerRatingsById,
          team,
          item.roster,
          item.player,
          rosterSize,
          salaryTotal,
          playerMin,
          playerOpt,
          runCache,
        ),
      )
      .sort((left, right) => right.sellPriority - left.sellPriority || left.playerName.localeCompare(right.playerName, "de"));
    candidateCount += allCandidates.length;

    const keepCore = [...allCandidates]
      .sort((left, right) => {
        const leftKeepScore = (100 - left.sellPriority) + left.reasonToKeep.length * 12 - left.reasonToSell.length * 6 - left.warnings.length * 8;
        const rightKeepScore =
          (100 - right.sellPriority) + right.reasonToKeep.length * 12 - right.reasonToSell.length * 6 - right.warnings.length * 8;
        if (rightKeepScore !== leftKeepScore) {
          return rightKeepScore - leftKeepScore;
        }
        return left.playerName.localeCompare(right.playerName, "de");
      })
      .filter((entry) => entry.reasonToKeep.length > 0)
      .slice(0, Math.min(3, limit));

    const sellCandidates = allCandidates
      .filter((entry) => entry.reasonToSell.length > 0 || entry.warnings.length > 0)
      .slice(0, limit);

    const explanation = [
      profile?.strategySummary ?? "Kein Teamprofil vorhanden.",
      sellCandidates[0]
        ? `Top-Kandidat: ${sellCandidates[0].playerName}. ${sellCandidates[0].reasonToSell[0] ?? "Verkauf wirkt aktuell vertretbar."}`
        : "Aktuell kein sauberer Verkaufsvorschlag.",
    ]
      .filter(Boolean)
      .join(" ");

    const status = getTeamStatus({
      controlMode: control?.controlMode ?? "manual",
      aiSellPreviewEnabled: control?.aiSellPreviewEnabled ?? false,
      sellCandidates,
      keepCore,
      warnings,
      blockingReasons,
      teamScope,
      rosterSize,
      playerMin,
    });

    return {
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      controlMode: control?.controlMode ?? "manual",
      aiSellPreviewEnabled: control?.aiSellPreviewEnabled ?? false,
      status,
      strategySummary: profile?.strategySummary ?? "Kein Teamprofil vorhanden.",
      cash: team.cash ?? null,
      rosterCount: rosterSize,
      salaryTotal,
      marketValueTotal: roundValue(marketValueTotal, 1),
      rosterSize,
      playerMin,
      playerOpt,
      targetRosterMin: playerMin,
      targetRosterOpt: playerOpt,
      budgetPressure: getBudgetPressure(team),
      sellCandidates,
      keepCore,
      warnings,
      blockingReasons,
      explanation,
    } satisfies AiSellPreviewTeamEntry;
  });

  const sortedTeams = [...teams].sort((left, right) => {
    const leftScore = left.sellCandidates[0]?.sellPriority ?? -1;
    const rightScore = right.sellCandidates[0]?.sellPriority ?? -1;
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    return left.teamName.localeCompare(right.teamName, "de");
  });

  const result: AiSellPreviewResult = {
    readOnly: true,
    source: context.source,
    scope: {
      saveId: context.saveId,
      seasonId: context.seasonId,
      teamId: requestedTeam?.teamId ?? null,
      teamScope,
    },
    totalTeams: sortedTeams.length,
    aiTeams: sortedTeams.filter((team) => team.controlMode === "ai").length,
    skippedManual: sortedTeams.filter((team) => team.controlMode === "manual").length,
    skippedPassive: sortedTeams.filter((team) => team.controlMode === "passive").length,
    skippedDisabled: sortedTeams.filter((team) => team.controlMode === "ai" && !team.aiSellPreviewEnabled).length,
    readyTeams: sortedTeams.filter((team) => team.status === "ready").length,
    warningTeams: sortedTeams.filter((team) => team.status === "warning" || team.status === "no_sell_need" || team.status === "low_roster_depth" || team.status === "no_candidates").length,
    blockedTeams: sortedTeams.filter((team) => team.status === "blocked").length,
    teams: sortedTeams,
    debugPerformance: {
      durationMs: Date.now() - startedAt,
      candidateCount,
      sellValuePreviewCount: candidateCount,
      needsEvaluationCount: runCache.needsByTeamId.size,
      snapshotLookupCount: runCache.latestSnapshot ? 1 : 0,
    },
  };
  return result;
}
