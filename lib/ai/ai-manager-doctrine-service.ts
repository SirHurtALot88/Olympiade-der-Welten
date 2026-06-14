import type {
  AiIdentityGuardResult,
  AiLineupStrategy,
  AiManagerDecisionJournalEntry,
  AiSeasonStrategy,
  AiSeasonStrategyStateRecord,
  AiStrategyShiftRecord,
  AiTacticalMode,
  GameState,
  Player,
  Team,
  TeamDoctrineRecord,
  TeamIdentity,
  TeamStrategyProfile,
} from "@/lib/data/olyDataTypes";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";

export type DoctrineSeasonTeamReviewRow = {
  teamId: string;
  teamCode: string;
  teamName: string;
  rank: number | null;
  points: number | null;
  goalAchieved: boolean;
  boardSatisfaction: "low" | "medium" | "high";
  cash: number;
  salaryPressure: "low" | "medium" | "high";
  rosterStrength: number;
  rosterCount: number;
  bestDisciplines: string[];
  worstDisciplines: string[];
  injuryFatigueBurden: "low" | "medium" | "high";
  strategySuccess: "low" | "medium" | "high";
  doctrineAdherence: "green" | "yellow" | "red";
  nextSeasonRecommendation: AiSeasonStrategy;
};

export type DoctrineSeasonPlayerReviewRow = {
  teamId: string;
  playerId: string;
  playerName: string;
  role: string;
  performanceVsExpectation: "above" | "met" | "below" | "unknown";
  pps: number | null;
  mvs: number | null;
  moraleNote: string;
  xp: number;
  regressionRisk: "low" | "medium" | "high";
  contractStatus: string;
  keepSellRenew: "keep" | "sell" | "renew" | "watch";
  salaryValue: "cheap" | "fair" | "expensive";
};

export type ManagerReviewSummaryRow = {
  teamId: string;
  teamCode: string;
  teamName: string;
  strategyScore: number;
  pickScore: number;
  budgetScore: number;
  trainingScore: number;
  buildingScore: number;
  identityScore: number;
  adaptationScore: number;
  nextSeasonRecommendation: AiSeasonStrategy;
  notes: string[];
};

export type TacticalAdaptationAuditRow = {
  teamId: string;
  teamCode: string;
  teamName: string;
  trigger: string;
  tacticalMode: AiTacticalMode;
  allowedActions: string[];
  blockedActions: string[];
  reason: string;
  identityRisk: "low" | "medium" | "high";
};

export type LineupStrategyAuditRow = {
  teamId: string;
  teamCode: string;
  teamName: string;
  lineupStrategy: AiLineupStrategy;
  reason: string;
  playerUsagePlan: string;
  starProtection: string;
  prospectMinutes: string;
  fatigueRiskAccepted: boolean;
};

export type DoctrineAuditBundle = {
  generatedAt: string;
  seasonId: string;
  doctrines: TeamDoctrineRecord[];
  strategyStates: AiSeasonStrategyStateRecord[];
  strategyShiftMatrix: AiStrategyShiftRecord[];
  identityGuardAudit: AiIdentityGuardResult[];
  decisionJournal: AiManagerDecisionJournalEntry[];
  seasonTeamReview: DoctrineSeasonTeamReviewRow[];
  seasonPlayerReview: DoctrineSeasonPlayerReviewRow[];
  managerReview: ManagerReviewSummaryRow[];
  tacticalAdaptationAudit: TacticalAdaptationAuditRow[];
  lineupStrategyAudit: LineupStrategyAuditRow[];
};

type IdentityGuardInput = {
  gameState: GameState;
  teamId: string;
  decisionType: string;
  decision?: string;
  candidate?: Player | null;
  projectedRosterCount?: number | null;
  projectedAverageMarketValue?: number | null;
  context?: {
    seasonStrategy?: AiSeasonStrategy;
    tacticalMode?: AiTacticalMode;
    cashCrisis?: boolean;
    cheapProspectOnly?: boolean;
    broadCheapRoster?: boolean;
    unplayableRoster?: boolean;
    hardTrainingAfterInjuryCrisis?: boolean;
    stopUnderOptWithoutReason?: boolean;
    overpayForCore?: boolean;
  };
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function avg(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length === 0 ? 0 : valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function norm(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasTokenMatch(tokens: string[] | undefined, values: string[]) {
  const normalizedValues = values.map(norm).filter(Boolean);
  return (tokens ?? []).some((token) => {
    const normalizedToken = norm(token);
    return normalizedValues.some((value) => value.includes(normalizedToken) || normalizedToken.includes(value));
  });
}

function team(gameState: GameState, teamId: string) {
  return gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
}

function identity(gameState: GameState, teamId: string) {
  return gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
}

function rosterPlayers(gameState: GameState, teamId: string) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => playerById.get(entry.playerId))
    .filter((player): player is Player => Boolean(player));
}

function rosterCount(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).length;
}

function salarySum(gameState: GameState, teamId: string) {
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .reduce((sum, entry) => sum + (entry.salary ?? 0), 0);
}

function profileFor(gameState: GameState, teamId: string) {
  return getTeamStrategyProfile(gameState, teamId);
}

function levelFromScore(score: number): "low" | "medium" | "high" {
  if (score >= 8) return "high";
  if (score <= 3) return "low";
  return "medium";
}

function doctrineNameFor(teamRow: Team, profile: TeamStrategyProfile, identityRow: TeamIdentity | null): string {
  const overrides: Record<string, string> = {
    "M-M": "Mayhem Star Dominion",
    "B-P": "Small Elite Panther Core",
    "C-C": "Cash-Value Trading Desk",
    "W-W": "Arcane Mental Supremacy",
    "Z-H": "Zero-to-Hero Risk Engine",
    "D-L": "Human Legion Order",
    "T-T": "Teacher Mentor Academy",
  };
  return overrides[teamRow.teamId] ?? profile.fantasyTheme ?? `${teamRow.name} Doctrine ${identityRow?.playerType ?? "Core"}`;
}

function buildIdentityPillars(profile: TeamStrategyProfile, identityRow: TeamIdentity | null) {
  const axis = identityRow
    ? [
        ["POW", identityRow.pow],
        ["SPE", identityRow.spe],
        ["MEN", identityRow.men],
        ["SOC", identityRow.soc],
      ]
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 2)
        .map(([label]) => `${label}-DNA`)
    : [];

  return [
    profile.fantasyTheme ?? null,
    ...profile.preferredArchetypes.slice(0, 3),
    ...profile.preferredClasses.slice(0, 2),
    ...axis,
  ].filter((entry): entry is string => Boolean(entry));
}

function preferredWinPath(profile: TeamStrategyProfile, identityRow: TeamIdentity | null): string {
  if (profile.bias.starPriority >= 8) return "Stars/Core zuerst, danach gezielte Rollenspieler.";
  if (profile.bias.valuePriority >= 8) return "Value und Flexibilitaet in jedem Pick.";
  if ((identityRow?.ambition ?? 5) <= 3) return "Geduldiger Prospect-Aufbau mit spielbarem Minimum.";
  return "Ausbalancierter Kader ueber Teamfit, Need und bezahlbare Qualitaet.";
}

function seasonStrategyFor(gameState: GameState, teamId: string): AiSeasonStrategyStateRecord {
  const now = new Date().toISOString();
  const teamRow = team(gameState, teamId);
  const identityRow = identity(gameState, teamId);
  const profile = profileFor(gameState, teamId);
  const count = rosterCount(gameState, teamId);
  const playerMin = identityRow?.playerMin ?? profile?.rosterMinTarget ?? teamRow?.rosterMinTarget ?? 8;
  const playerOpt = identityRow?.playerOpt ?? profile?.rosterOptTarget ?? teamRow?.rosterOptTarget ?? Math.max(playerMin, 11);
  const cash = teamRow?.cash ?? 0;
  const rank = gameState.seasonState.standings?.[teamId]?.rank ?? null;
  const salary = salarySum(gameState, teamId);
  const salaryPressure = cash > 0 ? salary / Math.max(cash, 1) : salary > 0 ? 99 : 0;

  let strategy: AiSeasonStrategy = "balanced_growth";
  let reason = "Normale Saisonplanung: Teamfit, Need und Budget ausbalancieren.";

  if (count < playerMin) {
    strategy = "roster_repair";
    reason = `Kader ${count}/${playerMin}: playerMin ist Pflicht vor Opt/Luxus.`;
  } else if (cash < 0 || salaryPressure > 1.25) {
    strategy = "cash_recovery";
    reason = "Cash-/Salary-Druck erzwingt kontrollierte Erholung.";
  } else if ((identityRow?.ambition ?? 5) >= 8 || (profile?.bias.starPriority ?? 5) >= 8 || (rank != null && rank <= 5)) {
    strategy = "win_now_push";
    reason = "Ambition/Star-Bias oder Topplatzierung verlangt Win-now-Verhalten.";
  } else if ((identityRow?.finances ?? 5) >= 8 || (profile?.bias.valuePriority ?? 5) >= 8) {
    strategy = "eco_round";
    reason = "Finanz-/Value-DNA erlaubt Eco-Round, aber nicht unter spielbares Minimum.";
  } else if (count < playerOpt) {
    strategy = "depth_repair";
    reason = `Optimum noch offen: ${count}/${playerOpt}.`;
  }

  return {
    teamId,
    seasonId: gameState.season.id,
    seasonStrategy: strategy,
    tacticalMode: deriveTacticalMode(gameState, teamId),
    doctrineCompatibility: strategy === "cash_recovery" || strategy === "roster_repair" ? "yellow" : "green",
    reason,
    updatedAt: now,
  };
}

function deriveTacticalMode(gameState: GameState, teamId: string): AiTacticalMode {
  const players = rosterPlayers(gameState, teamId);
  const highFatigue = players.filter((player) => (player.fatigue ?? 0) >= 70).length;
  const injured = gameState.seasonState.playerAvailabilityState?.filter((entry: any) => entry.teamId === teamId && entry.status === "injured").length ?? 0;
  const rank = gameState.seasonState.standings?.[teamId]?.rank ?? null;
  const cash = team(gameState, teamId)?.cash ?? 0;

  if (injured >= 2) return "injury_crisis";
  if (highFatigue >= 4) return "fatigue_crisis";
  if (cash < 0) return "salary_freeze";
  if (rank != null && rank <= 5) return "protect_lead";
  if (rank != null && rank >= Math.max(24, gameState.teams.length - 5)) return "chase_top10";
  return "standard";
}

export function buildTeamDoctrineMap(gameState: GameState): Record<string, TeamDoctrineRecord> {
  return Object.fromEntries(
    gameState.teams.map((teamRow) => {
      const profile = profileFor(gameState, teamRow.teamId);
      const identityRow = identity(gameState, teamRow.teamId);
      const safeProfile =
        profile ??
        ({
          teamId: teamRow.teamId,
          strategySummary: `Default strategy profile for ${teamRow.name}`,
          buyStyle: "Balanced buying.",
          sellStyle: "Balanced selling.",
          contractStyle: "Balanced contracts.",
          rosterStyle: "Balanced roster.",
          preferredArchetypes: [],
          avoidedArchetypes: [],
          preferredRaces: [],
          avoidedRaces: [],
          preferredClasses: [],
          avoidedClasses: [],
          hardNoGos: [],
          bias: {
            cashPriority: 5,
            valuePriority: 5,
            starPriority: 5,
            riskTolerance: 5,
            wageSensitivity: 5,
            sellForProfitAggression: 5,
            shortContractPreference: 5,
            longContractPreference: 5,
            loyaltyBias: 5,
            harmonyStrictness: 5,
            rosterDepthPreference: 5,
            eliteSmallRosterPreference: 5,
          },
        } as TeamStrategyProfile);

      const strictnessScore = Math.max(safeProfile.bias.harmonyStrictness, safeProfile.bias.eliteSmallRosterPreference, safeProfile.hardNoGos.length >= 2 ? 8 : 5);

      const doctrine: TeamDoctrineRecord = {
        teamId: teamRow.teamId,
        doctrineName: doctrineNameFor(teamRow, safeProfile, identityRow),
        identityPillars: buildIdentityPillars(safeProfile, identityRow),
        preferredWinPath: preferredWinPath(safeProfile, identityRow),
        secondaryWinPath:
          safeProfile.bias.rosterDepthPreference >= 7
            ? "Tiefe Rotation und Fatigue-Stabilitaet."
            : "Gezielte Need-Reparatur ohne Identitaetsverlust.",
        forbiddenPaths: [...safeProfile.hardNoGos, ...safeProfile.avoidedArchetypes.slice(0, 3)],
        rosterPhilosophy: safeProfile.rosterStyle,
        transferPhilosophy: safeProfile.buyStyle,
        trainingPhilosophy:
          safeProfile.bias.riskTolerance >= 8
            ? "Darf aggressiv trainieren, ausser Verletzungs-/Fatigue-Krise ist aktiv."
            : "Training folgt Teamfit und Recovery-Schutz.",
        facilityPhilosophy:
          safeProfile.bias.starPriority >= 8
            ? "Performance-/Recovery-Gebaeude schuetzen Core-Spieler."
            : "Facility-Invest nur mit Budget- und Strategie-Fit.",
        contractPhilosophy: safeProfile.contractStyle,
        riskPhilosophy:
          safeProfile.bias.riskTolerance >= 8
            ? "Risiko und Overpay sind erlaubt, wenn sie Core/Winpath staerken."
            : "Risiko nur bei klarem Value oder Need.",
        identityStrictness: levelFromScore(strictnessScore),
        adaptationFlexibility: levelFromScore(Math.max(safeProfile.bias.riskTolerance, 11 - safeProfile.bias.harmonyStrictness)),
      };

      return [teamRow.teamId, doctrine];
    }),
  );
}

function candidateDoctrineScore(profile: TeamStrategyProfile | null, candidate: Player | null | undefined) {
  if (!candidate || !profile) return 55;
  const tokens = [
    candidate.className,
    candidate.race,
    candidate.alignment,
    candidate.referenceClass ?? "",
    ...candidate.subclasses,
    ...candidate.traitsPositive,
    ...candidate.traitsNegative,
  ];
  let score = 50;
  if (hasTokenMatch(profile.preferredClasses, tokens)) score += 18;
  if (hasTokenMatch(profile.preferredRaces, tokens)) score += 12;
  if (hasTokenMatch(profile.preferredArchetypes, tokens)) score += 14;
  if (hasTokenMatch(profile.avoidedClasses, tokens)) score -= 18;
  if (hasTokenMatch(profile.avoidedRaces, tokens)) score -= 16;
  if (hasTokenMatch(profile.avoidedArchetypes, tokens)) score -= 18;
  if (hasTokenMatch(profile.hardNoGos, tokens)) score -= 35;
  return clamp(score);
}

function hasToxicTraits(candidate: Player | null | undefined) {
  if (!candidate) return false;
  return hasTokenMatch(["toxic", "diva", "chaos", "corrupt", "mutineer", "lazy", "fainthearted"], candidate.traitsNegative);
}

export function evaluateIdentityGuard(input: IdentityGuardInput): AiIdentityGuardResult {
  const teamRow = team(input.gameState, input.teamId);
  const identityRow = identity(input.gameState, input.teamId);
  const profile = profileFor(input.gameState, input.teamId);
  const doctrineMap = buildTeamDoctrineMap(input.gameState);
  const doctrine = doctrineMap[input.teamId];
  const count = input.projectedRosterCount ?? rosterCount(input.gameState, input.teamId);
  const playerMin = identityRow?.playerMin ?? profile?.rosterMinTarget ?? teamRow?.rosterMinTarget ?? 8;
  const playerOpt = identityRow?.playerOpt ?? profile?.rosterOptTarget ?? teamRow?.rosterOptTarget ?? Math.max(playerMin, 11);
  const cash = teamRow?.cash ?? 0;
  const candidateScore = candidateDoctrineScore(profile, input.candidate);
  const hardFails: string[] = [];

  if (input.context?.cheapProspectOnly && cash > 50 && (profile?.bias.starPriority ?? 5) >= 8) {
    hardFails.push("topteam_cheap_players_despite_cash");
  }
  if (input.context?.broadCheapRoster && (profile?.bias.eliteSmallRosterPreference ?? 5) >= 8) {
    hardFails.push("small_elite_broad_cheap_roster");
  }
  if ((doctrine?.identityStrictness === "high" || input.teamId === "W-W") && input.candidate && candidateScore < 45 && !input.context?.cashCrisis) {
    hardFails.push("theme_strict_off_theme_pick");
  }
  if (
    input.teamId === "W-W" &&
    input.candidate &&
    !hasTokenMatch(profile?.preferredClasses, [input.candidate.className, ...input.candidate.subclasses]) &&
    !hasTokenMatch(profile?.preferredRaces, [input.candidate.race]) &&
    !input.context?.cashCrisis
  ) {
    hardFails.push("theme_strict_ignored_mage_mental_fit");
  }
  if ((identityRow?.harmony ?? 5) >= 8 && hasToxicTraits(input.candidate) && !input.context?.overpayForCore) {
    hardFails.push("harmony_team_toxic_player_blocked");
  }
  if (input.teamId === "C-C" && input.context?.overpayForCore && candidateScore < 60) {
    hardFails.push("cash_team_overpay_without_value");
  }
  if ((profile?.bias.riskTolerance ?? 5) >= 8 && cash > 80 && input.context?.cheapProspectOnly && !input.context?.cashCrisis) {
    hardFails.push("aggressive_team_saves_passively");
  }
  if (input.context?.unplayableRoster || (count < playerMin && cash > 0 && input.context?.seasonStrategy === "eco_round")) {
    hardFails.push("eco_round_unplayable_roster");
  }
  if (input.context?.hardTrainingAfterInjuryCrisis) {
    hardFails.push("hard_training_after_injury_crisis");
  }
  if (input.context?.stopUnderOptWithoutReason && count < playerOpt && cash > 0) {
    hardFails.push("stop_under_opt_without_reason");
  }

  const scorePenalty = hardFails.length * 22;
  const identityScore = clamp(candidateScore - scorePenalty);
  const doctrineFit: AiIdentityGuardResult["doctrineFit"] =
    hardFails.length > 0 || identityScore < 40 ? "red" : identityScore < 65 ? "yellow" : "green";
  const identityRisk: AiIdentityGuardResult["identityRisk"] = doctrineFit === "red" ? "high" : doctrineFit === "yellow" ? "medium" : "low";

  return {
    teamId: input.teamId,
    decisionType: input.decisionType,
    identityScore,
    doctrineFit,
    identityRisk,
    adaptationAllowed: doctrineFit !== "red" || Boolean(input.context?.cashCrisis && input.context.seasonStrategy === "cash_recovery"),
    reason:
      hardFails.length > 0
        ? hardFails.join("; ")
        : input.context?.cashCrisis
          ? "Cash-Recovery ist erlaubt, solange die Abweichung begruendet und temporaer ist."
          : "Entscheidung bleibt innerhalb der Team-Doctrine.",
    hardFails,
  };
}

export function buildStrategyShiftMatrix(): AiStrategyShiftRecord[] {
  return [
    ["bad_season_board_low", "win_now_push", "balanced_growth", "Win-now wird vorsichtiger, ohne Core-Anspruch zu verlieren."],
    ["good_season_prize_high", "balanced_growth", "win_now_push", "Erfolg und Preisgeld erlauben kontrollierte Attacke."],
    ["prospects_breakout", "rebuild_prospect", "win_now_push", "Prospects werden Core, Timing-Fenster oeffnet sich."],
    ["cash_negative_salary_critical", "win_now_push", "cash_recovery", "Finanzschutz ist temporaer legitim."],
    ["roster_under_min", "eco_round", "roster_repair", "Spielbarkeit bricht Eco-Prioritaet."],
    ["building_under_70_and_cash_ok", "roster_repair", "facility_push", "Facility-Mangel verhindert Performance."],
    ["fatigue_depth_problem", "win_now_push", "depth_repair", "Small Core braucht Rotation, ohne Identitaet zu verlieren."],
    ["market_quality_high_cash_high", "eco_round", "market_attack", "Value-Team darf attackieren, wenn Marktfenster exzellent ist."],
    ["salary_pressure_high", "balanced_growth", "salary_control", "Salary-Kontrolle schuetzt naechste Saison."],
  ].map(([trigger, oldStrategy, newStrategy, benefit]) => ({
    trigger,
    oldStrategy: oldStrategy as AiSeasonStrategy,
    newStrategy: newStrategy as AiSeasonStrategy,
    doctrineCompatibility: newStrategy === "cash_recovery" || newStrategy === "salary_control" ? "yellow" : "green",
    benefit,
    risk: newStrategy === "cash_recovery" ? "Kurzfristig weniger Kaderqualitaet." : "Kann Team-Rhythmus veraendern.",
    boardAcceptance: newStrategy === "roster_repair" || newStrategy === "win_now_push" ? "high" : "medium",
    identityRisk: newStrategy === "cash_recovery" || newStrategy === "salary_control" ? "medium" : "low",
    duration: "bis naechster Review-Point",
    reviewPoint: "midseason_check oder season_end_review",
  }));
}

export function buildSeasonStrategyState(gameState: GameState): Record<string, AiSeasonStrategyStateRecord> {
  return Object.fromEntries(gameState.teams.map((teamRow) => [teamRow.teamId, seasonStrategyFor(gameState, teamRow.teamId)]));
}

export function buildTacticalAdaptationAudit(gameState: GameState): TacticalAdaptationAuditRow[] {
  return gameState.teams.map((teamRow) => {
    const mode = deriveTacticalMode(gameState, teamRow.teamId);
    const actions =
      mode === "injury_crisis"
        ? ["training_focus_recovery", "training_intensity_light", "rotate_more", "board_warning"]
        : mode === "fatigue_crisis"
          ? ["training_intensity_light", "rotate_more", "avoid_injury"]
          : mode === "salary_freeze"
            ? ["mark_sell_candidate", "salary_freeze", "no_luxury_buy"]
            : mode === "protect_lead"
              ? ["protect_stars", "captain_safe", "preserve_for_later_matchday"]
              : ["normal_strategy_execution"];

    return {
      teamId: teamRow.teamId,
      teamCode: teamRow.shortCode,
      teamName: teamRow.name,
      trigger: mode === "standard" ? "none" : mode,
      tacticalMode: mode,
      allowedActions: actions,
      blockedActions: ["doctrine_change", "wild_roster_overhaul", "direct_service_bypass"],
      reason: mode === "standard" ? "Kein Krisensignal aktiv." : `Tactical Mode ${mode} aus aktuellem Teamzustand abgeleitet.`,
      identityRisk: mode === "salary_freeze" ? "medium" : "low",
    };
  });
}

export function buildLineupStrategyAudit(gameState: GameState): LineupStrategyAuditRow[] {
  const strategies = buildSeasonStrategyState(gameState);
  return gameState.teams.map((teamRow) => {
    const tacticalMode = strategies[teamRow.teamId]?.tacticalMode ?? "standard";
    const seasonStrategy = strategies[teamRow.teamId]?.seasonStrategy ?? "balanced_growth";
    let lineupStrategy: AiLineupStrategy = "best_score_now";

    if (tacticalMode === "injury_crisis") lineupStrategy = "avoid_injury";
    else if (tacticalMode === "fatigue_crisis") lineupStrategy = "rotate_depth";
    else if (seasonStrategy === "rebuild_prospect") lineupStrategy = "develop_prospects";
    else if (tacticalMode === "protect_lead") lineupStrategy = "protect_stars";
    else if (seasonStrategy === "win_now_push") lineupStrategy = "captain_star";

    return {
      teamId: teamRow.teamId,
      teamCode: teamRow.shortCode,
      teamName: teamRow.name,
      lineupStrategy,
      reason: `Season Strategy ${seasonStrategy}, Tactical Mode ${tacticalMode}.`,
      playerUsagePlan:
        lineupStrategy === "develop_prospects"
          ? "Prospects erhalten sichere Slots, solange Validator und Scoreverlust es erlauben."
          : lineupStrategy === "rotate_depth"
            ? "Fatigue-Risiko senken und Bankspieler frueher nutzen."
            : "Beste verfuegbare Spieler fuer aktuelle Disziplinen.",
      starProtection: lineupStrategy === "protect_stars" || lineupStrategy === "avoid_injury" ? "hoch" : "normal",
      prospectMinutes: lineupStrategy === "develop_prospects" ? "aktiv" : "situativ",
      fatigueRiskAccepted: false,
    };
  });
}

function topDisciplines(players: Player[], mode: "best" | "worst") {
  const values = new Map<string, number[]>();
  for (const player of players) {
    for (const [disciplineId, value] of Object.entries(player.disciplineRatings ?? {})) {
      const bucket = values.get(disciplineId) ?? [];
      bucket.push(value);
      values.set(disciplineId, bucket);
    }
  }
  return [...values.entries()]
    .map(([disciplineId, entries]) => [disciplineId, avg(entries)] as const)
    .sort((a, b) => (mode === "best" ? b[1] - a[1] : a[1] - b[1]))
    .slice(0, 3)
    .map(([disciplineId]) => disciplineId);
}

export function buildDoctrineSeasonReview(gameState: GameState) {
  const strategyState = buildSeasonStrategyState(gameState);
  const identityRows = gameState.teams.map((teamRow) =>
    evaluateIdentityGuard({
      gameState,
      teamId: teamRow.teamId,
      decisionType: "season_review",
      context: { seasonStrategy: strategyState[teamRow.teamId]?.seasonStrategy },
    }),
  );

  const teamReview: DoctrineSeasonTeamReviewRow[] = gameState.teams.map((teamRow) => {
    const players = rosterPlayers(gameState, teamRow.teamId);
    const standing = gameState.seasonState.standings?.[teamRow.teamId];
    const salary = salarySum(gameState, teamRow.teamId);
    const rosterStrength = avg(players.map((player) => player.rating ?? player.ovr ?? 0));
    const fatigueBurden = avg(players.map((player) => player.fatigue ?? 0));
    const identityGuard = identityRows.find((entry) => entry.teamId === teamRow.teamId);
    const salaryPressure = teamRow.cash > 0 ? salary / Math.max(teamRow.cash, 1) : salary > 0 ? 99 : 0;

    return {
      teamId: teamRow.teamId,
      teamCode: teamRow.shortCode,
      teamName: teamRow.name,
      rank: standing?.rank ?? null,
      points: standing?.points ?? null,
      goalAchieved: standing?.rank != null ? standing.rank <= Math.ceil(gameState.teams.length / 2) : false,
      boardSatisfaction: standing?.rank != null && standing.rank <= 8 ? "high" : standing?.rank != null && standing.rank <= 20 ? "medium" : "low",
      cash: teamRow.cash,
      salaryPressure: salaryPressure > 1 ? "high" : salaryPressure > 0.5 ? "medium" : "low",
      rosterStrength: Number(rosterStrength.toFixed(2)),
      rosterCount: players.length,
      bestDisciplines: topDisciplines(players, "best"),
      worstDisciplines: topDisciplines(players, "worst"),
      injuryFatigueBurden: fatigueBurden >= 65 ? "high" : fatigueBurden >= 35 ? "medium" : "low",
      strategySuccess: standing?.rank != null && standing.rank <= 12 ? "high" : "medium",
      doctrineAdherence: identityGuard?.doctrineFit ?? "green",
      nextSeasonRecommendation: strategyState[teamRow.teamId]?.seasonStrategy ?? "balanced_growth",
    };
  });

  const rosterByPlayer = new Map(gameState.rosters.map((entry) => [entry.playerId, entry]));
  const playerReview: DoctrineSeasonPlayerReviewRow[] = gameState.players
    .filter((player) => rosterByPlayer.has(player.id))
    .slice(0, 500)
    .map((player) => {
      const roster = rosterByPlayer.get(player.id)!;
      const rating = player.rating ?? player.ovr ?? 0;
      const pps = player.pps ?? null;
      const valueRatio = roster.salary > 0 ? (player.marketValue ?? 0) / roster.salary : 99;
      return {
        teamId: roster.teamId,
        playerId: player.id,
        playerName: player.name,
        role: roster.roleTag,
        performanceVsExpectation: pps == null ? "unknown" : pps >= rating * 0.8 ? "above" : pps >= rating * 0.5 ? "met" : "below",
        pps,
        mvs: player.marketValue ?? null,
        moraleNote: "nicht im Doctrine-Block geschrieben",
        xp: player.currentXP ?? 0,
        regressionRisk: player.potential < rating ? "high" : player.potential - rating < 10 ? "medium" : "low",
        contractStatus: roster.contractStatus ?? "active",
        keepSellRenew: valueRatio < 2 ? "watch" : roster.contractLength <= 1 ? "renew" : "keep",
        salaryValue: valueRatio >= 5 ? "cheap" : valueRatio >= 2 ? "fair" : "expensive",
      };
    });

  const managerReview: ManagerReviewSummaryRow[] = teamReview.map((row) => ({
    teamId: row.teamId,
    teamCode: row.teamCode,
    teamName: row.teamName,
    strategyScore: row.strategySuccess === "high" ? 85 : 65,
    pickScore: row.doctrineAdherence === "green" ? 82 : row.doctrineAdherence === "yellow" ? 62 : 35,
    budgetScore: row.salaryPressure === "high" ? 45 : 75,
    trainingScore: row.injuryFatigueBurden === "high" ? 45 : 75,
    buildingScore: 70,
    identityScore: row.doctrineAdherence === "green" ? 88 : row.doctrineAdherence === "yellow" ? 65 : 30,
    adaptationScore: row.injuryFatigueBurden === "high" ? 58 : 78,
    nextSeasonRecommendation: row.nextSeasonRecommendation,
    notes: [
      row.doctrineAdherence !== "green" ? "Doctrine-Risiko beobachten." : "Identity stabil.",
      row.injuryFatigueBurden === "high" ? "Recovery/Rotation pruefen." : "Keine akute Belastungskrise.",
    ],
  }));

  return { teamReview, playerReview, managerReview };
}

export function buildManagerDecisionJournalPreview(gameState: GameState): AiManagerDecisionJournalEntry[] {
  const strategies = buildSeasonStrategyState(gameState);
  const tacticalRows = buildTacticalAdaptationAudit(gameState);
  return gameState.teams.flatMap((teamRow) => {
    const strategy = strategies[teamRow.teamId];
    const tactical = tacticalRows.find((row) => row.teamId === teamRow.teamId);
    const entries: AiManagerDecisionJournalEntry[] = [
      {
        season: gameState.season.id,
        phase: "preseason_strategy",
        teamId: teamRow.teamId,
        decisionType: "strategy_shift",
        decision: strategy?.seasonStrategy ?? "balanced_growth",
        strategyBefore: "unknown",
        strategyAfter: strategy?.seasonStrategy ?? "balanced_growth",
        doctrineFit: strategy?.doctrineCompatibility ?? "green",
        expectedOutcome: "Kader-, Budget- und Market-Plan folgen der Team-Doctrine.",
        actualOutcome: null,
        reason: strategy?.reason ?? "Fallback Strategy.",
        rejectedAlternatives: ["direct_buy_without_plan", "doctrine_change"],
        risk: strategy?.doctrineCompatibility === "yellow" ? "medium" : "low",
        wasCorrect: null,
      },
    ];

    if (tactical && tactical.tacticalMode !== "standard") {
      entries.push({
        season: gameState.season.id,
        phase: "midseason_check",
        teamId: teamRow.teamId,
        decisionType: "tactical_adjustment",
        decision: tactical.tacticalMode,
        strategyBefore: "standard",
        strategyAfter: tactical.tacticalMode,
        doctrineFit: tactical.identityRisk === "high" ? "red" : tactical.identityRisk === "medium" ? "yellow" : "green",
        expectedOutcome: tactical.reason,
        actualOutcome: null,
        reason: tactical.trigger,
        rejectedAlternatives: tactical.blockedActions,
        risk: tactical.identityRisk,
        wasCorrect: null,
      });
    }

    return entries;
  });
}

export function buildIdentityGuardAudit(gameState: GameState): AiIdentityGuardResult[] {
  const result: AiIdentityGuardResult[] = [];
  const candidateByTeam: Record<string, Player | null> = {
    "M-M": gameState.players.find((player) => (player.marketValue ?? 0) < 10 && (player.potential ?? 0) > (player.rating ?? 0)) ?? null,
    "W-W": gameState.players.find((player) => player.className !== "Mage" && player.race !== "Construct" && (player.rating ?? 0) > 70) ?? null,
    "C-C": gameState.players.find((player) => (player.marketValue ?? 0) > 80) ?? null,
  };

  for (const teamRow of gameState.teams) {
    const state = seasonStrategyFor(gameState, teamRow.teamId);
    result.push(
      evaluateIdentityGuard({
        gameState,
        teamId: teamRow.teamId,
        decisionType: "strategy_state",
        candidate: candidateByTeam[teamRow.teamId] ?? null,
        context: {
          seasonStrategy: state.seasonStrategy,
          cheapProspectOnly: teamRow.teamId === "M-M",
          broadCheapRoster: teamRow.teamId === "B-P",
          unplayableRoster: teamRow.teamId === "C-C" && rosterCount(gameState, teamRow.teamId) < 8,
        },
      }),
    );
  }

  return result;
}

export function buildDoctrineAuditBundle(gameState: GameState): DoctrineAuditBundle {
  const review = buildDoctrineSeasonReview(gameState);
  return {
    generatedAt: new Date().toISOString(),
    seasonId: gameState.season.id,
    doctrines: Object.values(buildTeamDoctrineMap(gameState)),
    strategyStates: Object.values(buildSeasonStrategyState(gameState)),
    strategyShiftMatrix: buildStrategyShiftMatrix(),
    identityGuardAudit: buildIdentityGuardAudit(gameState),
    decisionJournal: buildManagerDecisionJournalPreview(gameState),
    seasonTeamReview: review.teamReview,
    seasonPlayerReview: review.playerReview,
    managerReview: review.managerReview,
    tacticalAdaptationAudit: buildTacticalAdaptationAudit(gameState),
    lineupStrategyAudit: buildLineupStrategyAudit(gameState),
  };
}
