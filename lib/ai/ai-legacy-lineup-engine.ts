import type {
  AiCaptainSelectionStatus,
  AiLegacyLineupPreview,
  AiLegacyLineupPreviewStatus,
  AiLegacyLineupSelectedPlayer,
  AiLegacyLineupSuggestion,
  AiLegacyLineupSuggestionSide,
  AiNeedAxis,
} from "@/lib/ai/ai-needs-types";
import { resolveLineupStrategyForTeam } from "@/lib/ai/ai-manager-doctrine-service";
import { playerNeedsLineupRestFromTrainingLoad } from "@/lib/ai/ai-player-training-load-service";
import { evaluateLegacyAiNeeds } from "@/lib/ai/ai-needs-engine";
import type { AiLineupStrategy } from "@/lib/data/olyDataTypes";
import { deriveTeamIdentityAxisWeightMap } from "@/lib/foundation/team-identity-settings";
import { getFatiguePerformanceMultiplier, getInjuryRiskPercent } from "@/lib/fatigue/fatigue-calibration";
import { buildLegacyLineupAggregateScore } from "@/lib/lineups/legacy-score-engine";
import { scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";
import type { DisciplineSide, LegacyLineupEntryInput, LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { validateLegacyLineupContext } from "@/lib/lineups/legacy-lineup-validator";

type CaptainSuggestionCandidate = {
  disciplineId: string;
  disciplineSide: DisciplineSide;
  activePlayerId: string;
  playerId: string;
  captainName: string | null;
  estimatedContribution: number;
  warnings: string[];
};

type CaptainDecision = {
  candidate: CaptainSuggestionCandidate | null;
  status: AiCaptainSelectionStatus;
  warnings: string[];
};

// ===========================================================================================
// Captain-Opportunismus & Pacing
// -------------------------------------------------------------------------------------------
// Der Captain-Boost ist knapp: SEASON_CAPTAIN_SLOTS = 3 über 10 Spieltage. Früher wurde er
// rein gierig gesetzt (jede KI klatscht ihn an Spieltag 1 rein und verbrennt alle 3 bis
// Spieltag 3). Stattdessen entscheidet die KI jetzt opportunistisch, ob sich EIN Slot HEUTE
// lohnt, gemessen an:
//   1. Ertrag/Magnitude: Der Boost bringt exakt +0.5 x finalContribution des Spielers
//      (siehe legacy-score-engine.ts). Je stärker der geboostete Spieler, desto mehr Rohpunkte.
//   2. Hebel/Leverage: Wie stark verbessert der Boost die Platzierung? Über den
//      Disziplin-Rang (teamDisciplineRanks). Hoch im umkämpften oberen Mittelfeld, gering an
//      der Tabellenspitze (schon vorne) und im aussichtslosen Keller.
//   3. Diszi-Größe: In großen Disziplinen (viele Spieler) generiert der Boost mehr Rohpunkte
//      ("den großen Weg für ein paar Extrapunkte gehen").
// Pacing ("use it but not all at once"): Früh in der Saison mit allen Slots muss die Chance
// ÜBERDURCHSCHNITTLICH sein; läuft die Saison aus (Restspieltage nähern sich Restslots), sinkt
// die Hürde Richtung 0, damit ungenutzte Slots trotzdem vergeben werden (kein ai_captain_unused).
// Alle Schwellen sind benannte Konstanten, damit der Owner sie später tunen kann.
// ===========================================================================================

// Maximal EIN neuer Captain pro Spieltag: verhindert das Verbrennen mehrerer knapper Slots
// an einem einzigen Spieltag und streut sie über die Saison.
const CAPTAIN_MAX_NEW_PER_MATCHDAY = 1;
// Basis-Hürde für den "lohnt es sich"-Ertrag (in effektiven Boost-Punkten), früh in der Saison.
const CAPTAIN_WORTHWHILE_BASE_THRESHOLD = 44;
// Die Hürde sinkt mit dem Saison-Druck, aber nie unter diesen Bruchteil der Basis.
const CAPTAIN_THRESHOLD_MIN_FRACTION = 0.15;
// Faktor des Captain-Boosts laut Score-Engine: +0.5 x finalContribution.
const CAPTAIN_RAW_BOOST_FACTOR = 0.5;
// Ab dieser Spielerzahl gilt eine Diszi als "groß" -> Boost bringt spürbar mehr Rohpunkte.
const CAPTAIN_LARGE_DISCIPLINE_PLAYER_COUNT = 5;
const CAPTAIN_LARGE_DISCIPLINE_MULTIPLIER = 1.18;
// Fallback-Teamzahl für die Rang-Normierung, falls allTeamIdentities fehlt.
const CAPTAIN_DEFAULT_TOTAL_TEAMS = 32;
// Ein bester Seiten-Score darunter gilt als "schwache Seite" (Konzession möglich).
const CAPTAIN_WEAK_SIDE_STRONGEST_SCORE = 66;
// Fallback-Hebel, wenn kein Rang bekannt ist: Magnitude entscheidet allein.
const CAPTAIN_LEVERAGE_UNKNOWN_RANK = 0.85;

// Hebel-Multiplikator aus dem Disziplin-Rang (rank 1 = stärkstes Team der Liga in der Diszi).
// Deterministisch, rein aus Rangposition; dokumentiert und beschränkt (0.28..1.15).
function getCaptainRankLeverage(rank: number | null, totalTeams: number): number {
  if (rank == null) {
    return CAPTAIN_LEVERAGE_UNKNOWN_RANK;
  }
  // Absoluter Rang-Check: Der Disziplin-LEADER (Rang 1) hat immer wenig Platzierungshebel,
  // unabhängig von der Ligagröße. Der reine Bruchteil (frac <= 0.06) trifft Rang 1 nur ab
  // >=17 Teams; in kleineren Ligen/Tests bekäme der Leader sonst fälschlich den HÖCHSTEN
  // Hebel (1.15). In der 32-Team-Produktion ist das Verhalten identisch (Rang 1 -> frac 0.031).
  if (rank <= 1) return 0.55; // Disziplin-Leader – wenig Platzierungshebel
  const frac = rank / Math.max(1, totalTeams);
  if (frac <= 0.06) return 0.55; // schon (fast) Rang 1 – wenig Platzierungshebel
  if (frac <= 0.45) return 1.15; // umkämpftes oberes Mittelfeld – höchster Hebel
  if (frac <= 0.62) return 0.8;
  if (frac <= 0.78) return 0.5;
  return 0.28; // aussichtslos schwach – Slot lieber sparen
}

function getCaptainTotalTeams(context: LegacyLineupLoadedContext): number {
  return context.allTeamIdentities?.length && context.allTeamIdentities.length > 0
    ? context.allTeamIdentities.length
    : CAPTAIN_DEFAULT_TOTAL_TEAMS;
}

function getCaptainRequiredPlayers(
  context: LegacyLineupLoadedContext,
  disciplineId: string,
  disciplineSide: DisciplineSide,
): number {
  return (
    context.disciplineSidePlayerCounts?.[`${disciplineId}::${disciplineSide}`] ??
    context.disciplinePlayerCounts[disciplineId] ??
    0
  );
}

// Stärkster Disziplin-Score der aktuell für diese Seite geplanten Spieler.
function getCaptainSideStrongestScore(
  context: LegacyLineupLoadedContext,
  entries: Array<LegacyLineupEntryInput & { isCaptain: boolean }>,
  disciplineId: string,
  disciplineSide: DisciplineSide,
): number {
  const sideEntries = entries.filter(
    (entry) => entry.disciplineId === disciplineId && entry.disciplineSide === disciplineSide,
  );
  return Math.max(
    0,
    ...sideEntries.map(
      (entry) =>
        context.disciplineScores.find(
          (score) => score.playerId === entry.playerId && score.disciplineId === disciplineId,
        )?.score ?? 0,
    ),
  );
}

// Ist das Team insgesamt unterdurchschnittlich (Tabellenkeller-Kandidat)? Nur als weiches
// Zusatzsignal für die Konzessions-Erkennung; ohne allTeamIdentities neutral (false).
function isCaptainTeamBottomTier(context: LegacyLineupLoadedContext): boolean {
  const others = context.allTeamIdentities ?? [];
  if (others.length === 0) {
    return false;
  }
  const teamTotal = context.teamIdentity.pow + context.teamIdentity.spe + context.teamIdentity.men + context.teamIdentity.soc;
  const mean =
    others.reduce((sum, entry) => sum + entry.pow + entry.spe + entry.men + entry.soc, 0) / others.length;
  return teamTotal < mean * 0.9;
}

type CaptainOpportunity = {
  side: DisciplineSide;
  candidate: CaptainSuggestionCandidate;
  opportunityScore: number;
  rawBoost: number;
  leverage: number;
  rank: number | null;
  strongestScore: number;
  isLargeDiscipline: boolean;
  isConceding: boolean;
  worthwhile: boolean;
};

// Bewertet einen Captain-Kandidaten: erwarteter effektiver Ertrag = Rohboost x Hebel x Größe,
// plus Konzessions-Erkennung (schwach + konservativ/Tabellenkeller => Slot sparen).
function evaluateCaptainOpportunity(input: {
  context: LegacyLineupLoadedContext;
  entries: Array<LegacyLineupEntryInput & { isCaptain: boolean }>;
  candidate: CaptainSuggestionCandidate;
  effectiveThreshold: number;
  strategyConservative: boolean;
  bottomTier: boolean;
  totalTeams: number;
}): CaptainOpportunity {
  const { context, entries, candidate, totalTeams } = input;
  const rank = context.teamDisciplineRanks?.[candidate.disciplineId]?.rank ?? null;
  const requiredPlayers = getCaptainRequiredPlayers(context, candidate.disciplineId, candidate.disciplineSide);
  const strongestScore = getCaptainSideStrongestScore(context, entries, candidate.disciplineId, candidate.disciplineSide);
  const contribution = Number.isFinite(candidate.estimatedContribution) ? candidate.estimatedContribution : 0;
  const rawBoost = Math.max(0, contribution) * CAPTAIN_RAW_BOOST_FACTOR;
  const leverage = getCaptainRankLeverage(rank, totalTeams);
  const isLargeDiscipline = requiredPlayers >= CAPTAIN_LARGE_DISCIPLINE_PLAYER_COUNT;
  const sizeMultiplier = isLargeDiscipline ? CAPTAIN_LARGE_DISCIPLINE_MULTIPLIER : 1;
  const opportunityScore = rawBoost * leverage * sizeMultiplier;

  // Konzession: schwache Seite UND (konservative Aufstellung ODER Tabellenkeller). Genau der
  // Fall des Users: "wenn man eh schwach ist und negative Form reinschmeißt, warum Captain?"
  const isWeakSide =
    (rank != null && rank >= Math.ceil(totalTeams * 0.72)) || strongestScore < CAPTAIN_WEAK_SIDE_STRONGEST_SCORE;
  const isConceding = isWeakSide && (input.strategyConservative || input.bottomTier);

  const worthwhile = !isConceding && opportunityScore >= input.effectiveThreshold;

  return {
    side: candidate.disciplineSide,
    candidate,
    opportunityScore,
    rawBoost,
    leverage,
    rank,
    strongestScore,
    isLargeDiscipline,
    isConceding,
    worthwhile,
  };
}

function getIdentityTieBreakScore(
  context: LegacyLineupLoadedContext,
  playerId: string,
  focusAxes: AiNeedAxis[],
) {
  const player = context.rosterPlayers.find((entry) => entry.id === playerId);
  if (!player) {
    return 0;
  }

  const identity = deriveTeamIdentityAxisWeightMap(context.teamIdentity);
  const axisScores = {
    pow: player.coreStats.pow * identity.pow,
    spe: player.coreStats.spe * identity.spe,
    men: player.coreStats.men * identity.men,
    soc: player.coreStats.soc * identity.soc,
  };

  if (focusAxes.length === 0) {
    return axisScores.pow + axisScores.spe + axisScores.men + axisScores.soc;
  }

  return focusAxes.reduce((sum, axis) => sum + axisScores[axis], 0);
}

type RosterHealthSnapshot = {
  fatigue: number;
  injuryRiskPercent: number;
};

function getRosterHealth(context: LegacyLineupLoadedContext, playerId: string): RosterHealthSnapshot {
  const roster = context.rosterPlayers?.find((entry) => entry.id === playerId);
  const fatigue =
    roster?.fatigue ??
    context.fatigueByPlayerId?.[playerId]?.count ??
    0;
  const injuryRiskPercent = roster?.injuryRiskPercent ?? getInjuryRiskPercent(fatigue);
  return { fatigue, injuryRiskPercent };
}

function inferLineupStrategyFromRoster(context: LegacyLineupLoadedContext): AiLineupStrategy {
  const players = context.rosterPlayers ?? [];
  const highFatigue = players.filter((player) => (player.fatigue ?? 0) >= 70).length;
  const criticalFatigue = players.filter((player) => (player.fatigue ?? 0) >= 85).length;
  const highInjuryRisk = players.filter(
    (player) => (player.injuryRiskPercent ?? getInjuryRiskPercent(player.fatigue ?? 0)) >= 12,
  ).length;
  if (criticalFatigue >= 2 || highInjuryRisk >= 3) return "avoid_injury";
  if (highFatigue >= 3) return "rotate_depth";
  return "best_score_now";
}

function resolveLineupStrategy(context: LegacyLineupLoadedContext): AiLineupStrategy {
  if (context.lineupStrategy) {
    return context.lineupStrategy;
  }
  if (context.gameState) {
    return resolveLineupStrategyForTeam(context.gameState, context.teamId);
  }
  return inferLineupStrategyFromRoster(context);
}

function getHealthLineupPenalty(strategy: AiLineupStrategy, health: RosterHealthSnapshot) {
  const { fatigue, injuryRiskPercent } = health;
  let penalty = 0;

  if (fatigue >= 85) penalty += 12;
  else if (fatigue >= 70) penalty += 9;
  else if (fatigue >= 55) penalty += 3;

  if (injuryRiskPercent >= 25) penalty += 10;
  else if (injuryRiskPercent >= 12) penalty += 5;
  else if (injuryRiskPercent >= 8) penalty += 2;

  if (strategy === "avoid_injury") {
    penalty *= 2;
    if (fatigue >= 65 || injuryRiskPercent >= 10) penalty += 14;
    if (fatigue >= 80 || injuryRiskPercent >= 20) penalty += 8;
  } else if (strategy === "rotate_depth") {
    penalty *= 1.6;
    if (fatigue >= 70) penalty += 8;
  } else if (strategy === "protect_stars" || strategy === "captain_safe") {
    if (fatigue >= 60) penalty += 4;
  }

  return penalty;
}

function playerNeedsLineupRest(context: LegacyLineupLoadedContext, playerId: string) {
  if (context.gameState) {
    return playerNeedsLineupRestFromTrainingLoad({
      gameState: context.gameState,
      teamId: context.teamId,
      playerId,
    });
  }
  const health = getRosterHealth(context, playerId);
  return health.fatigue >= 85 || health.injuryRiskPercent >= 25;
}

function getSelectionScore(
  context: LegacyLineupLoadedContext,
  playerId: string,
  rawScore: number,
  strategy: AiLineupStrategy,
) {
  if (!Number.isFinite(rawScore) || rawScore === Number.NEGATIVE_INFINITY) {
    return rawScore;
  }
  const health = getRosterHealth(context, playerId);
  const fatigueAdjusted = rawScore * getFatiguePerformanceMultiplier(health.fatigue);
  let score = fatigueAdjusted - getHealthLineupPenalty(strategy, health);
  if (playerNeedsLineupRest(context, playerId)) {
    score -= 28;
  }
  return score;
}

function buildEntriesForDisciplineSide(
  context: LegacyLineupLoadedContext,
  disciplineId: string | null,
  disciplineSide: DisciplineSide,
  usedPlayerIds: Set<string>,
  focusAxes: AiNeedAxis[],
): { entries: LegacyLineupEntryInput[]; warnings: string[]; reasoning: string[] } {
  if (!disciplineId) {
    return {
      entries: [],
      warnings: [`No discipline configured for ${disciplineSide}.`],
      reasoning: [],
    };
  }

  const playerCount =
    context.disciplineSidePlayerCounts?.[`${disciplineId}::${disciplineSide}`] ??
    context.disciplinePlayerCounts[disciplineId] ??
    0;
  const lineupStrategy = resolveLineupStrategy(context);
  const candidates = context.activePlayers
    .filter((player) => !usedPlayerIds.has(player.playerId))
    .map((player) => {
      const disciplineScore = context.disciplineScores.find(
        (entry) => entry.playerId === player.playerId && entry.disciplineId === disciplineId,
      );
      const score = disciplineScore?.score ?? Number.NEGATIVE_INFINITY;
      const tieBreak = getIdentityTieBreakScore(context, player.playerId, focusAxes);
      const health = getRosterHealth(context, player.playerId);
      const selectionScore = getSelectionScore(context, player.playerId, score, lineupStrategy);

      return {
        activePlayerId: player.id,
        playerId: player.playerId,
        score,
        selectionScore,
        hasScore: disciplineScore != null,
        tieBreak,
        health,
      };
    })
    .sort((left, right) => {
      if (left.hasScore !== right.hasScore) {
        return left.hasScore ? -1 : 1;
      }
      if (right.selectionScore !== left.selectionScore) {
        return right.selectionScore - left.selectionScore;
      }
      if (right.tieBreak !== left.tieBreak) {
        return right.tieBreak - left.tieBreak;
      }
      return left.playerId.localeCompare(right.playerId);
    });

  const picked = candidates.slice(0, playerCount);
  picked.forEach((player) => usedPlayerIds.add(player.playerId));

  return {
    entries: picked.map((player, index) => ({
      disciplineId,
      disciplineSide,
      slotIndex: index,
      playerId: player.playerId,
      activePlayerId: player.activePlayerId,
    })),
    warnings: [
      ...(picked.length < playerCount ? [`Only ${picked.length}/${playerCount} players available for ${disciplineId} ${disciplineSide}.`] : []),
      ...picked
        .filter((player) => !player.hasScore)
        .map((player) => `Missing discipline score for player ${player.playerId} in ${disciplineId} (${disciplineSide}).`),
    ],
    reasoning: picked.map(
      (player, index) =>
        `${disciplineSide.toUpperCase()} slot ${index + 1}: ${player.playerId} via selectionScore=${player.hasScore ? player.selectionScore.toFixed(2) : "missing"} disciplineScore=${player.hasScore ? player.score.toFixed(2) : "missing"} fatigue=${player.health.fatigue.toFixed(0)} injuryRisk=${player.health.injuryRiskPercent.toFixed(1)}% strategy=${lineupStrategy} tieBreak=${player.tieBreak.toFixed(2)}`,
    ),
  };
}

export function buildAiLegacyLineupSuggestion(context: LegacyLineupLoadedContext): AiLegacyLineupSuggestion {
  const needsSummary = evaluateLegacyAiNeeds(context);
  const usedPlayerIds = new Set<string>();

  const d1 = buildEntriesForDisciplineSide(
    context,
    needsSummary.d1NeedSummary.disciplineId,
    "d1",
    usedPlayerIds,
    needsSummary.d1NeedSummary.focusAxes,
  );
  const d2 = buildEntriesForDisciplineSide(
    context,
    needsSummary.d2NeedSummary.disciplineId,
    "d2",
    usedPlayerIds,
    needsSummary.d2NeedSummary.focusAxes,
  );

  const entries = [...d1.entries, ...d2.entries];
  const validation = validateLegacyLineupContext({
    ...context,
    entries,
    disciplineSidePlayerCounts: {
      ...(needsSummary.d1NeedSummary.disciplineId
        ? { [`${needsSummary.d1NeedSummary.disciplineId}::d1`]: needsSummary.d1NeedSummary.playerCount }
        : {}),
      ...(needsSummary.d2NeedSummary.disciplineId
        ? { [`${needsSummary.d2NeedSummary.disciplineId}::d2`]: needsSummary.d2NeedSummary.playerCount }
        : {}),
    },
  });

  const scoreD1 = needsSummary.d1NeedSummary.disciplineId
    ? scoreLegacyLineupDisciplineSide({
        disciplineId: needsSummary.d1NeedSummary.disciplineId,
        disciplineSide: "d1",
        entries,
        disciplineScores: context.disciplineScores,
      })
    : { entries: [], totalScore: 0, missingScores: [], validationWarnings: [] };
  const scoreD2 = needsSummary.d2NeedSummary.disciplineId
    ? scoreLegacyLineupDisciplineSide({
        disciplineId: needsSummary.d2NeedSummary.disciplineId,
        disciplineSide: "d2",
        entries,
        disciplineScores: context.disciplineScores,
      })
    : { entries: [], totalScore: 0, missingScores: [], validationWarnings: [] };

  return {
    entries,
    scorePreview: {
      entries: [...scoreD1.entries, ...scoreD2.entries],
      totalScore: scoreD1.totalScore + scoreD2.totalScore,
      missingScores: [...scoreD1.missingScores, ...scoreD2.missingScores],
      validationWarnings: [...validation.warnings, ...scoreD1.validationWarnings, ...scoreD2.validationWarnings],
    },
    needsSummary,
    warnings: [...needsSummary.warnings, ...d1.warnings, ...d2.warnings, ...validation.errors],
    debugReasoning: [...d1.reasoning, ...d2.reasoning],
    d1SelectionReasons: [],
    d2SelectionReasons: [],
  };
}

function getDisciplineName(context: LegacyLineupLoadedContext, disciplineId: string | null) {
  if (!disciplineId) {
    return null;
  }
  return (
    context.matchdayContract?.discipline1?.disciplineId === disciplineId
      ? context.matchdayContract.discipline1.displayName
      : context.matchdayContract?.discipline2?.disciplineId === disciplineId
        ? context.matchdayContract.discipline2.displayName
        : context.disciplines.find((entry) => entry.id === disciplineId)?.name ?? null
  );
}

function getSideStatus(input: {
  disciplineId: string | null;
  selectedPlayers: number;
  requiredPlayers: number;
  missingScores: string[];
  warnings: string[];
}) : AiLegacyLineupPreviewStatus {
  if (!input.disciplineId) {
    return "blocked";
  }
  if (input.missingScores.length > 0) {
    return "missing_scores";
  }
  if (input.selectedPlayers < input.requiredPlayers || input.warnings.length > 0) {
    return "incomplete_roster";
  }
  return "ready";
}

function getPreviewStatus(
  d1: AiLegacyLineupSuggestionSide,
  d2: AiLegacyLineupSuggestionSide,
  warnings: string[],
): AiLegacyLineupPreviewStatus {
  if (d1.status === "blocked" || d2.status === "blocked") {
    return "blocked";
  }
  if (d1.status === "missing_scores" || d2.status === "missing_scores") {
    return "missing_scores";
  }
  if (
    d1.status === "incomplete_roster" ||
    d2.status === "incomplete_roster" ||
    warnings.some((warning) => warning.toLowerCase().includes("only ")) ||
    warnings.some((warning) => warning.toLowerCase().includes("kein captain")) ||
    warnings.some((warning) => warning.toLowerCase().includes("keine disziplin"))
  ) {
    return "incomplete_roster";
  }
  return "ready";
}

function buildSideExplanation(
  disciplineName: string | null,
  selectedPlayers: number,
  requiredPlayers: number,
  captainName: string | null,
  fatigueWarnings: string[],
  sideWarnings: string[],
) {
  const label = disciplineName ?? "Unbekannte Disziplin";
  const parts = [
    `${label}: ${selectedPlayers}/${requiredPlayers} Spieler`,
    captainName ? `Captain ${captainName}` : "kein Captain",
  ];
  if (fatigueWarnings.length > 0) {
    parts.push(`${fatigueWarnings.length} Fatigue-Hinweise`);
  }
  if (sideWarnings.length > 0) {
    parts.push(`${sideWarnings.length} Warnings`);
  }
  return parts.join(" · ");
}

function buildStrategyProfileExplanation(context: LegacyLineupLoadedContext) {
  const profile = context.teamStrategyProfile;
  if (!profile) {
    return null;
  }

  const tags = [
    profile.rosterStyle,
    profile.buyStyle,
    profile.preferredArchetypes[0] ? `Prefers ${profile.preferredArchetypes[0]}` : null,
    profile.hardNoGos[0] ? `No-go: ${profile.hardNoGos[0]}` : null,
  ].filter((entry): entry is string => Boolean(entry));

  return `${profile.strategySummary}${tags.length > 0 ? ` · ${tags.slice(0, 3).join(" · ")}` : ""}`;
}

function suggestCaptainForSide(
  context: LegacyLineupLoadedContext,
  entries: Array<LegacyLineupEntryInput & { isCaptain: boolean }>,
  disciplineId: string | null,
  disciplineSide: DisciplineSide,
): CaptainSuggestionCandidate | null {
  if (!disciplineId) {
    return null;
  }

  const sideEntries = entries.filter((entry) => entry.disciplineId === disciplineId && entry.disciplineSide === disciplineSide);
  if (sideEntries.length === 0) {
    return null;
  }

  const scorePreview = scoreLegacyLineupDisciplineSide({
    disciplineId,
    disciplineSide,
    entries: sideEntries,
    disciplineScores: context.disciplineScores,
    activePlayers: context.activePlayers,
    rosterPlayers: context.rosterPlayers,
    requiredPlayers:
      context.disciplineSidePlayerCounts?.[`${disciplineId}::${disciplineSide}`] ??
      context.disciplinePlayerCounts[disciplineId] ??
      null,
    fatigueByPlayerId: context.fatigueByPlayerId ?? null,
    fatigueSourceStatus: context.fatigueSourceStatus ?? "missing_source",
    formCardsAvailable: null,
    formCardsSelected: null,
    formModifier: null,
    mutatorText: null,
    mutatorModifier: null,
  });

  const bestEntry =
    [...scorePreview.entries]
      .filter((entry) => entry.finalContribution != null)
      .sort((left, right) => (right.finalContribution ?? 0) - (left.finalContribution ?? 0))[0] ?? null;

  if (!bestEntry) {
    return {
      disciplineId,
      disciplineSide,
      activePlayerId: sideEntries[0]!.activePlayerId!,
      playerId: sideEntries[0]!.playerId,
      captainName: null,
      estimatedContribution: Number.NEGATIVE_INFINITY,
      warnings: [`Captain-Vorschlag fuer ${disciplineId}/${disciplineSide} konnte nicht berechnet werden.`],
    };
  }

  return {
    disciplineId,
    disciplineSide,
    activePlayerId: bestEntry.activePlayerId ?? sideEntries[0]!.activePlayerId!,
    playerId: bestEntry.playerId,
    captainName: bestEntry.name ?? null,
    estimatedContribution: bestEntry.finalContribution ?? Number.NEGATIVE_INFINITY,
    warnings: [],
  };
}

function applyCaptainDecisions(
  entries: Array<LegacyLineupEntryInput & { isCaptain: boolean }>,
  decisions: CaptainDecision[],
) {
  const selectedKeys = new Set(
    decisions
      .filter((decision) => decision.status === "selected" && decision.candidate)
      .map((decision) => `${decision.candidate!.disciplineId}::${decision.candidate!.disciplineSide}::${decision.candidate!.playerId}::${decision.candidate!.activePlayerId}`),
  );

  return entries.map((entry) => {
    const key = `${entry.disciplineId}::${entry.disciplineSide}::${entry.playerId}::${entry.activePlayerId ?? ""}`;
    const sameSide = decisions.some(
      (decision) => decision.candidate?.disciplineId === entry.disciplineId && decision.candidate?.disciplineSide === entry.disciplineSide,
    );

    if (!sameSide) {
      return entry;
    }

    return {
      ...entry,
      isCaptain: selectedKeys.has(key),
    };
  });
}

function getCaptainUsageBeforeCurrentDraft(context: LegacyLineupLoadedContext) {
  const previousCaptainKeys = new Set(
    (context.existingDraft?.entries ?? [])
      .filter((entry) => entry.isCaptain)
      .map((entry) => `${entry.disciplineId}::${entry.disciplineSide}`),
  );
  const exactCaptainUsedSideKeys = Array.isArray(context.teamStatus?.captainUsedSides)
    ? new Set(context.teamStatus.captainUsedSides)
    : null;

  if (exactCaptainUsedSideKeys) {
    for (const key of previousCaptainKeys) {
      exactCaptainUsedSideKeys.delete(key);
    }

    return {
      count: exactCaptainUsedSideKeys.size,
      sideKeys: exactCaptainUsedSideKeys,
      hasExactSideKeys: true,
    };
  }

  return {
    count: Math.max(0, (context.teamStatus?.captainUsedCount ?? 0) - previousCaptainKeys.size),
    sideKeys: new Set<string>(),
    hasExactSideKeys: false,
  };
}

function buildCaptainDecisions(
  context: LegacyLineupLoadedContext,
  entries: Array<LegacyLineupEntryInput & { isCaptain: boolean }>,
  input: {
    d1DisciplineId: string | null;
    d2DisciplineId: string | null;
  },
) {
  const captainUsage = getCaptainUsageBeforeCurrentDraft(context);
  const captainSlotsUsed = captainUsage.count;
  const seasonCaptainSlots = context.captainRule?.seasonCaptainSlots ?? 0;
  // Slots VOR diesem Spieltag (für Validierung/Idempotenz).
  const captainSlotsRemainingBeforeDraft = Math.max(0, seasonCaptainSlots - captainSlotsUsed);

  const candidates = [
    suggestCaptainForSide(context, entries, input.d1DisciplineId, "d1"),
    suggestCaptainForSide(context, entries, input.d2DisciplineId, "d2"),
  ].filter((candidate): candidate is CaptainSuggestionCandidate => Boolean(candidate));

  // --- Pacing-Kontext: Wie viel Saison ist noch übrig pro verbleibendem Slot? ---
  const totalSeasonSides = context.matchdayContract?.totalDisciplineSidesInSeason ?? 20;
  const totalMatchdays = Math.max(1, Math.ceil(totalSeasonSides / 2));
  const matchdayIndex = Math.max(
    1,
    context.matchdayContract?.matchdayIndex ?? context.matchday?.index ?? context.season?.currentMatchday ?? 1,
  );
  const matchdaysRemainingIncludingCurrent = Math.max(1, totalMatchdays - matchdayIndex + 1);
  // "use it or lose it": sobald man ab jetzt an JEDEM Restspieltag einen Slot bräuchte, wird
  // erzwungen (Hürde/Konzession ignoriert), damit keine Slots ungenutzt verfallen.
  const forced =
    captainSlotsRemainingBeforeDraft > 0 &&
    captainSlotsRemainingBeforeDraft >= matchdaysRemainingIncludingCurrent;
  // Druck steigt Richtung Saisonende / bei vielen Restslots -> Hürde sinkt.
  const pressure = captainSlotsRemainingBeforeDraft / matchdaysRemainingIncludingCurrent;
  const thresholdFraction = Math.min(1, Math.max(CAPTAIN_THRESHOLD_MIN_FRACTION, 1 - pressure));
  const effectiveThreshold = CAPTAIN_WORTHWHILE_BASE_THRESHOLD * thresholdFraction;

  const strategyConservative = (() => {
    const strategy = resolveLineupStrategy(context);
    return strategy === "avoid_injury" || strategy === "rotate_depth";
  })();
  const bottomTier = isCaptainTeamBottomTier(context);
  const totalTeams = getCaptainTotalTeams(context);

  const opportunityBySide = new Map<DisciplineSide, CaptainOpportunity>();
  for (const candidate of candidates) {
    opportunityBySide.set(
      candidate.disciplineSide,
      evaluateCaptainOpportunity({
        context,
        entries,
        candidate,
        effectiveThreshold,
        strategyConservative,
        bottomTier,
        totalTeams,
      }),
    );
  }

  // --- Auswahl: höchstens EIN neuer Captain pro Spieltag, an der lohnendsten Seite. ---
  // Deterministische Reihenfolge: bester Opportunity-Score zuerst, dann stabile Schlüssel.
  const rankedOpportunities = [...opportunityBySide.values()].sort((left, right) => {
    if (right.opportunityScore !== left.opportunityScore) {
      return right.opportunityScore - left.opportunityScore;
    }
    if (left.candidate.disciplineId !== right.candidate.disciplineId) {
      return left.candidate.disciplineId.localeCompare(right.candidate.disciplineId);
    }
    if (left.side !== right.side) {
      return left.side.localeCompare(right.side);
    }
    return left.candidate.playerId.localeCompare(right.candidate.playerId);
  });

  const selectedNewSides = new Set<DisciplineSide>();
  let newlyConsumedCaptainSlots = 0;
  const maxNewThisMatchday = Math.min(CAPTAIN_MAX_NEW_PER_MATCHDAY, captainSlotsRemainingBeforeDraft);
  for (const opportunity of rankedOpportunities) {
    if (newlyConsumedCaptainSlots >= maxNewThisMatchday) {
      break;
    }
    const sideKey = `${opportunity.candidate.disciplineId}::${opportunity.candidate.disciplineSide}`;
    const alreadyConsumedThisSeason = captainUsage.hasExactSideKeys && captainUsage.sideKeys.has(sideKey);
    if (alreadyConsumedThisSeason) {
      continue; // verbraucht keinen neuen Slot; wird unten separat als "selected" markiert
    }
    // Erzwungener Spend (Saisonende) nimmt die beste Seite unabhängig von Hürde/Konzession.
    if (forced || opportunity.worthwhile) {
      selectedNewSides.add(opportunity.side);
      newlyConsumedCaptainSlots += 1;
    }
  }

  const captainSlotsRemainingAfterDraft = Math.max(
    0,
    captainSlotsRemainingBeforeDraft - newlyConsumedCaptainSlots,
  );

  const formatBoost = (value: number) => (Math.round(value * 10) / 10).toFixed(1);

  const decisionsBySide = new Map<DisciplineSide, CaptainDecision>();
  for (const side of ["d1", "d2"] as const) {
    const candidate = candidates.find((entry) => entry.disciplineSide === side) ?? null;

    if (!candidate) {
      decisionsBySide.set(side, {
        candidate: null,
        status: "skipped_not_needed",
        warnings: [],
      });
      continue;
    }

    if ((context.captainRule?.sourceStatus ?? "missing_source") === "missing_source") {
      decisionsBySide.set(side, {
        candidate,
        status: "blocked_policy",
        warnings: ["captain_policy_source_missing"],
      });
      continue;
    }

    const sideKey = `${candidate.disciplineId}::${candidate.disciplineSide}`;
    const alreadyConsumedThisSeason = captainUsage.hasExactSideKeys && captainUsage.sideKeys.has(sideKey);
    const opportunity = opportunityBySide.get(side)!;
    const captainLabel = candidate.captainName ?? candidate.playerId;
    const rankLabel = opportunity.rank == null ? "n/a" : String(opportunity.rank);

    // Bereits diese Saison an dieser Diszi-Seite gesetzt -> beibehalten (Idempotenz).
    if (alreadyConsumedThisSeason) {
      decisionsBySide.set(side, {
        candidate,
        status: "selected",
        warnings: candidate.warnings,
      });
      continue;
    }

    // Saisonlimit bereits ausgeschöpft (unabhängig vom Pacing).
    if (captainSlotsRemainingBeforeDraft <= 0) {
      decisionsBySide.set(side, {
        candidate,
        status: "skipped_limit_reached",
        warnings: ["captain_limit_reached"],
      });
      continue;
    }

    if (selectedNewSides.has(side)) {
      // Grund/Reasoning sichtbar machen (Audit/Preview): großer Weg vs. opportunistisch.
      const reason =
        opportunity.isLargeDiscipline && opportunity.rank != null && opportunity.rank <= Math.ceil(totalTeams * 0.5)
          ? `Captain auf große Diszi absichern: ${captainLabel} (Rang ${rankLabel}, +${formatBoost(opportunity.rawBoost)} Rohpunkte, Hebel ${opportunity.leverage.toFixed(2)})`
          : forced
            ? `Captain gesetzt (Saisonende, Slot sonst verfallen): ${captainLabel} (+${formatBoost(opportunity.rawBoost)} Rohpunkte)`
            : `Captain opportunistisch gesetzt: ${captainLabel} (Wert ${formatBoost(opportunity.opportunityScore)} >= Hürde ${formatBoost(effectiveThreshold)}, Rang ${rankLabel})`;
      decisionsBySide.set(side, {
        candidate,
        status: "selected",
        warnings: [reason, ...candidate.warnings],
      });
      continue;
    }

    // Nicht gewählt: Slot wird bewusst gespart. Grund je nach Ursache.
    if (opportunity.isConceding) {
      decisionsBySide.set(side, {
        candidate,
        status: "skipped_not_worthwhile",
        warnings: [
          `Captain gespart: schwache/konservative Diszi, Slot für später aufgehoben (Rang ${rankLabel}, bester Score ${formatBoost(opportunity.strongestScore)})`,
          ...candidate.warnings,
        ],
      });
      continue;
    }

    if (!opportunity.worthwhile) {
      decisionsBySide.set(side, {
        candidate,
        status: "skipped_not_worthwhile",
        warnings: [
          `Captain gespart: Ertrag zu gering (Wert ${formatBoost(opportunity.opportunityScore)} < Hürde ${formatBoost(effectiveThreshold)}, Rang ${rankLabel})`,
          ...candidate.warnings,
        ],
      });
      continue;
    }

    // Grundsätzlich lohnend, aber wir setzen nur den besten Kandidaten pro Spieltag: gespart.
    decisionsBySide.set(side, {
      candidate,
      status: "skipped_saving_for_later",
      warnings: [
        `Captain gespart: stärkere Seite/späterer Spieltag bevorzugt (Wert ${formatBoost(opportunity.opportunityScore)}, max ${CAPTAIN_MAX_NEW_PER_MATCHDAY}/Spieltag)`,
        ...candidate.warnings,
      ],
    });
  }

  const decisions = [decisionsBySide.get("d1")!, decisionsBySide.get("d2")!];
  const nextEntries = applyCaptainDecisions(entries, decisions);

  return {
    entries: nextEntries,
    captainSlotsUsed,
    // Nach diesem Spieltag verbleibende Slots (spiegelt die heutige Entscheidung wider).
    captainSlotsRemaining: captainSlotsRemainingAfterDraft,
    captainUsedBeforeCurrentDraftSides: Array.from(captainUsage.sideKeys),
    d1: decisionsBySide.get("d1")!,
    d2: decisionsBySide.get("d2")!,
  };
}

function buildPreviewSide(
  context: LegacyLineupLoadedContext,
  entries: LegacyLineupEntryInput[],
  disciplineId: string | null,
  disciplineSide: DisciplineSide,
  baseReasoning: string[],
  captainDecision: CaptainDecision,
  captainSlotsUsed: number,
  captainSlotsRemaining: number,
): AiLegacyLineupSuggestionSide {
  const requiredPlayers =
    (disciplineId
      ? context.disciplineSidePlayerCounts?.[`${disciplineId}::${disciplineSide}`] ??
        context.disciplinePlayerCounts[disciplineId] ??
        0
      : 0) ?? 0;

  if (!disciplineId) {
    return {
      disciplineId: null,
      disciplineSide,
      disciplineName: null,
      status: "blocked",
      requiredPlayers,
      selectedPlayers: 0,
      missingSlots: requiredPlayers,
      captainActivePlayerId: captainDecision.candidate?.activePlayerId ?? null,
      captainPlayerId: captainDecision.candidate?.playerId ?? null,
      captainName: captainDecision.status === "selected" ? captainDecision.candidate?.captainName ?? null : null,
      captainSlotsUsed,
      captainSlotsRemaining,
      captainSelectionStatus: captainDecision.status,
      expectedBaseScore: null,
      expectedCaptainBonus: null,
      expectedScore: 0,
      teamDisciplineRank: null,
      rankSourceStatus: null,
      selectedEntries: [],
      fatigueWarnings: [`Keine Disziplin fuer ${disciplineSide} konfiguriert.`],
      warnings: [`Keine Disziplin fuer ${disciplineSide} konfiguriert.`],
      reasoning: baseReasoning,
    };
  }

  const scorePreview = scoreLegacyLineupDisciplineSide({
    disciplineId,
    disciplineSide,
    entries,
    disciplineScores: context.disciplineScores,
    activePlayers: context.activePlayers,
    rosterPlayers: context.rosterPlayers,
    requiredPlayers,
    fatigueByPlayerId: context.fatigueByPlayerId ?? null,
    fatigueSourceStatus: context.fatigueSourceStatus ?? "missing_source",
    formCardsAvailable: null,
    formCardsSelected: null,
    formModifier: null,
    mutatorText: null,
    mutatorModifier: null,
  });

  const fatigueWarnings = [
    ...(scorePreview.modifierWarnings ?? []).filter((warning) => warning.toLowerCase().includes("fatigue")),
    ...scorePreview.entries
      .filter((entry) => (entry.fatigueCount ?? 0) > 0)
      .map((entry) => `${entry.name ?? entry.playerId}: Fatigue x${(entry.fatigueMultiplier ?? 1).toFixed(2)}`),
  ];
  const criticalWarnings = [
    ...scorePreview.validationWarnings.filter(
      (warning) =>
        warning.includes("Missing discipline score") || warning.includes("is incomplete"),
    ),
    ...scorePreview.missingScores.map((score) => `Missing score: ${score}`),
  ];
  const sideWarnings = [
    ...criticalWarnings,
    ...scorePreview.validationWarnings.filter(
      (warning) =>
        !warning.includes("Missing discipline score") && !warning.includes("is incomplete"),
    ),
  ];
  const selectedEntries: AiLegacyLineupSelectedPlayer[] = scorePreview.entries.map((entry) => ({
    playerId: entry.playerId,
    activePlayerId: entry.activePlayerId ?? null,
    name: entry.name ?? null,
    isCaptain: Boolean(entry.isCaptain),
    baseScore: entry.baseDisciplineScore ?? null,
    fatigueCount: entry.fatigueCount ?? null,
    fatigueMultiplier: entry.fatigueMultiplier ?? null,
    fatigueAdjustedScore: entry.fatigueAdjustedScore ?? null,
    captainBonus: entry.captainBonus ?? null,
    finalContribution: entry.finalContribution ?? null,
  }));
  const selectedPlayers = scorePreview.selectedPlayers ?? scorePreview.entries.length;
  const missingSlots = Math.max(0, requiredPlayers - selectedPlayers);
  const rankEntry = context.teamDisciplineRanks?.[disciplineId] ?? null;
  const status = getSideStatus({
    disciplineId,
    selectedPlayers,
    requiredPlayers,
    missingScores: scorePreview.missingScores,
    warnings: criticalWarnings,
  });

  return {
    disciplineId,
    disciplineSide,
    disciplineName: getDisciplineName(context, disciplineId),
    requiredPlayers,
    status,
    selectedPlayers,
    missingSlots,
    captainActivePlayerId: captainDecision.candidate?.activePlayerId ?? null,
    captainPlayerId: captainDecision.candidate?.playerId ?? null,
    captainName: captainDecision.status === "selected" ? captainDecision.candidate?.captainName ?? null : null,
    captainSlotsUsed,
    captainSlotsRemaining,
    captainSelectionStatus: captainDecision.status,
    expectedBaseScore: scorePreview.baseScore ?? null,
    expectedCaptainBonus: scorePreview.captainBonusTotal ?? null,
    expectedScore: scorePreview.totalScore,
    teamDisciplineRank: rankEntry?.rank ?? null,
    rankSourceStatus: rankEntry?.sourceStatus ?? null,
    selectedEntries,
    fatigueWarnings,
    warnings: sideWarnings,
    reasoning: [
      ...baseReasoning,
      ...(captainDecision.status === "selected" && captainDecision.candidate?.captainName
        ? [`Captain: ${captainDecision.candidate.captainName}`]
        : captainDecision.status === "skipped_limit_reached"
          ? ["Captain uebersprungen: Saisonlimit erreicht"]
          : captainDecision.status === "skipped_not_worthwhile"
            ? ["Captain gespart: Ertrag/Diszi diesen Spieltag nicht lohnend"]
            : captainDecision.status === "skipped_saving_for_later"
              ? ["Captain gespart: Slot fuer spaeter/staerkere Seite aufgehoben"]
              : ["Kein Captain-Vorschlag"]),
    ],
  };
}

export function buildAiLegacyLineupPreview(
  context: LegacyLineupLoadedContext,
  source: "sqlite" | "prisma" = "sqlite",
): AiLegacyLineupPreview {
  const suggestion = buildAiLegacyLineupSuggestion(context);
  const captainRuleStatus = context.captainRule?.sourceStatus ?? "missing_source";

  let entries: Array<LegacyLineupEntryInput & { isCaptain: boolean }> = suggestion.entries.map((entry) => ({
    ...entry,
    isCaptain: false,
  }));
  const d1BaseReasoning = suggestion.debugReasoning.filter((line) => line.startsWith("D1"));
  const d2BaseReasoning = suggestion.debugReasoning.filter((line) => line.startsWith("D2"));
  const d1DisciplineId = context.contextMeta.d1DisciplineId;
  const d2DisciplineId = context.contextMeta.d2DisciplineId;

  const captainPlan = buildCaptainDecisions(context, entries, {
    d1DisciplineId,
    d2DisciplineId,
  });
  entries = captainPlan.entries;

  const d1 = buildPreviewSide(
    context,
    entries,
    d1DisciplineId,
    "d1",
    d1BaseReasoning,
    captainPlan.d1,
    captainPlan.captainSlotsUsed,
    captainPlan.captainSlotsRemaining,
  );
  const d2 = buildPreviewSide(
    context,
    entries,
    d2DisciplineId,
    "d2",
    d2BaseReasoning,
    captainPlan.d2,
    captainPlan.captainSlotsUsed,
    captainPlan.captainSlotsRemaining,
  );

  const validation = validateLegacyLineupContext(
    {
      ...context,
      entries,
    },
    {
      enforceCompleteness: false,
      seasonCaptainLimit: context.captainRule?.seasonCaptainSlots,
      captainUsedBeforeCurrentDraft: captainPlan.captainSlotsUsed,
      captainUsedBeforeCurrentDraftSides: captainPlan.captainUsedBeforeCurrentDraftSides,
    },
  );

  const fullScorePreview = buildLegacyLineupAggregateScore(
    [
      d1DisciplineId
        ? scoreLegacyLineupDisciplineSide({
            disciplineId: d1DisciplineId,
            disciplineSide: "d1",
            entries,
            disciplineScores: context.disciplineScores,
            activePlayers: context.activePlayers,
            rosterPlayers: context.rosterPlayers,
            requiredPlayers: context.disciplineSidePlayerCounts?.[`${d1DisciplineId}::d1`] ?? context.disciplinePlayerCounts[d1DisciplineId] ?? null,
            fatigueByPlayerId: context.fatigueByPlayerId ?? null,
            fatigueSourceStatus: context.fatigueSourceStatus ?? "missing_source",
            formCardsAvailable: null,
            formCardsSelected: null,
            formModifier: null,
            mutatorText: null,
            mutatorModifier: null,
          })
        : null,
      d2DisciplineId
        ? scoreLegacyLineupDisciplineSide({
            disciplineId: d2DisciplineId,
            disciplineSide: "d2",
            entries,
            disciplineScores: context.disciplineScores,
            activePlayers: context.activePlayers,
            rosterPlayers: context.rosterPlayers,
            requiredPlayers: context.disciplineSidePlayerCounts?.[`${d2DisciplineId}::d2`] ?? context.disciplinePlayerCounts[d2DisciplineId] ?? null,
            fatigueByPlayerId: context.fatigueByPlayerId ?? null,
            fatigueSourceStatus: context.fatigueSourceStatus ?? "missing_source",
            formCardsAvailable: null,
            formCardsSelected: null,
            formModifier: null,
            mutatorText: null,
            mutatorModifier: null,
          })
        : null,
    ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
  );

  const warnings = [
    ...suggestion.warnings,
    ...captainPlan.d1.warnings,
    ...captainPlan.d2.warnings,
    ...validation.errors,
    ...validation.warnings,
  ];
  const status = getPreviewStatus(d1, d2, warnings);
  const strategyExplanation = buildStrategyProfileExplanation(context);
  const explanation = [
    strategyExplanation,
    buildSideExplanation(d1.disciplineName, d1.selectedPlayers, d1.requiredPlayers, d1.captainName, d1.fatigueWarnings, d1.warnings),
    buildSideExplanation(d2.disciplineName, d2.selectedPlayers, d2.requiredPlayers, d2.captainName, d2.fatigueWarnings, d2.warnings),
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join(" | ");

  return {
    source,
    readOnly: true,
    teamId: context.teamId,
    teamCode: context.team.shortCode,
    teamName: context.team.name,
    matchdayId: context.matchdayId,
    status,
    captainRuleStatus,
    captainSlotsUsed: captainPlan.captainSlotsUsed,
    captainSlotsRemaining: captainPlan.captainSlotsRemaining,
    totalExpectedScore: fullScorePreview.totalScore,
    expectedScore: fullScorePreview.totalScore,
    warnings,
    explanation,
    debugReasoning: [...(strategyExplanation ? [`Strategy: ${strategyExplanation}`] : []), ...suggestion.debugReasoning],
    d1,
    d2,
    entries,
    scorePreview: {
      ...fullScorePreview,
      validationWarnings: [...validation.warnings, ...fullScorePreview.validationWarnings],
    },
  };
}
