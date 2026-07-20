import type {
  AiLineupStrategy,
  DisciplineCategory,
  FormCardPlanRecord,
  FormCardColor,
  GameState,
  LineupDraftModifiers,
  SeasonDisciplineScheduleEntry,
  PlayerAttributeSheetStats,
  TeamPowerAttributeTag,
  TeamPowerCategory,
  TeamPowerConditionalTrigger,
  TeamPowerEffectType,
  TeamPowerTargetMode,
  TeamStrategyProfile,
} from "@/lib/data/olyDataTypes";

export type DisciplineSide = "d1" | "d2";

export type LegacyLineupEntryInput = {
  disciplineId: string;
  disciplineSide: DisciplineSide;
  slotIndex: number;
  playerId: string;
  activePlayerId: string | null;
  isCaptain?: boolean;
};

export type LegacyActivePlayerRef = {
  id: string;
  saveId: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  contractLength?: number | null;
  salary?: number | null;
  upkeep?: number;
  marketValue?: number | null;
};

export type LegacyRosterPlayerRef = {
  id: string;
  name: string;
  portraitUrl?: string | null;
  className?: string;
  race?: string;
  displayMarketValue?: number | null;
  displaySalary?: number | null;
  potential?: number | null;
  ovr?: number | null;
  pps?: number | null;
  fatigue?: number | null;
  injuryStatus?: "healthy" | "injured" | "recovering" | null;
  injuryUntilMatchday?: string | null;
  injuryRiskPercent?: number | null;
  injuryRiskBand?: string | null;
  injuryRiskLabel?: string | null;
  availabilityBlocker?: "player_injured_unavailable" | null;
  form?: number | null;
  traitsPositive?: string[];
  traitsNegative?: string[];
  attributeStats?: PlayerAttributeSheetStats | null;
  attributeRatings?:
    | Partial<Record<keyof PlayerAttributeSheetStats, string | null>>
    | null;
  coreStats: {
    pow: number;
    spe: number;
    men: number;
    soc: number;
  };
};

export type LegacyDisciplineScoreRef = {
  playerId: string;
  disciplineId: string;
  score: number;
};

export type LegacyLineupContext = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string;
  entries: LegacyLineupEntryInput[];
  disciplinePlayerCounts: Record<string, number>;
  disciplineSidePlayerCounts?: Record<string, number>;
  disciplineSideCaptainCounts?: Record<string, number>;
  activePlayers: LegacyActivePlayerRef[];
  rosterPlayers?: LegacyRosterPlayerRef[];
  disciplineScores: LegacyDisciplineScoreRef[];
  moraleByPlayerId?: Record<string, LegacyMoralePerformanceRef> | null;
};

export type LegacyMoralePerformanceRef = {
  morale: number;
  multiplier: number;
  modifierPct: number;
  label: "boost" | "neutral" | "risk";
  contractDragPct?: number | null;
};

export type LegacyLineupEntryScore = {
  playerId: string;
  activePlayerId: string | null;
  disciplineId: string;
  disciplineSide: DisciplineSide;
  slotIndex: number;
  name?: string;
  score: number | null;
  baseDisciplineScore?: number | null;
  fatigueStatus?: "mapped" | "missing_source";
  fatigueCount?: number | null;
  fatigueMultiplier?: number | null;
  fatigueAdjustedScore?: number | null;
  injuryStatus?: "mapped" | "not_applied";
  injuryMultiplier?: number | null;
  injuryAdjustedScore?: number | null;
  moraleStatus?: "mapped" | "missing_source" | "not_applied";
  morale?: number | null;
  moraleMultiplier?: number | null;
  moraleModifierPct?: number | null;
  moraleModifier?: number | null;
  moraleAdjustedScore?: number | null;
  isCaptain?: boolean;
  captainMultiplier?: number | null;
  captainBonus?: number | null;
  mutatorBonus?: number | null;
  mutatorPpsBonus?: number | null;
  formShare?: number | null; // pro Spieler angewandter Form-Anteil (flacher Kartenwert + Jitter)
  finalContribution?: number | null;
  sourceStatus?: "mapped" | "missing_source";
  warnings?: string[];
};

export type LegacyResolveMutatorMode = "legacy_selected_traits" | "mvp_forced_mutators";

export type LegacyMutatorSlotEffect = {
  slotKey: "mutator1" | "mutator2";
  label: string;
  hitCount?: number;
  scoreModifier: number;
  playerPpsModifier: number;
  teamPpsModifier: number | null;
  teamPpsStatus: "ready" | "missing_source";
  affectedPlayerIds: string[];
  sourceStatus: "ready" | "missing_source";
};

export type LegacyLineupScoreResult = {
  disciplineId?: string;
  disciplineSide?: DisciplineSide;
  requiredPlayers?: number | null;
  selectedPlayers?: number;
  missingPlayers?: number;
  isComplete?: boolean;
  entries: LegacyLineupEntryScore[];
  baseScore?: number;
  fatigueStatus?: "mapped" | "missing_source";
  fatigueModifier?: number | null;
  moraleStatus?: "mapped" | "missing_source" | "not_applied";
  moraleModifier?: number | null;
  intensity?: "conserve" | "normal" | "push" | null;
  intensityModifier?: number | null;
  slotRoleModifier?: number | null;
  captainStatus?: "mapped" | "missing_source";
  captainBonusTotal?: number | null;
  formCardsAvailable?: number | null;
  formCardsSelected?: number | null;
  formCardStatus?: "ready" | "missing_source";
  formCardLabel?: string | null;
  formModifier?: number | null;
  mutatorMode?: LegacyResolveMutatorMode;
  mutatorText?: string | null;
  mutatorModifier?: number | null;
  teamPowerSelected?: number | null;
  teamPowerStatus?: "ready" | "missing_source";
  teamPowerLabel?: string | null;
  teamPowerModifier?: number | null;
  teamPowerImpact?: number | null;
  teamPowerBasePct?: number | null;
  teamPowerConditionalPct?: number | null;
  teamPowerAttributeFitPct?: number | null;
  teamPowerEffectType?: TeamPowerEffectType | null;
  teamPowerTargetMode?: TeamPowerTargetMode | null;
  teamPowerTargetLimit?: number | null;
  mutatorSlots?: LegacyMutatorSlotEffect[];
  teamPpsModifier?: number | null;
  teamPpsStatus?: "ready" | "missing_source";
  finalPreviewScore?: number;
  modifierWarnings?: string[];
  totalScore: number;
  missingScores: string[];
  validationWarnings: string[];
};

export type LegacyLineupValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};

export type LegacyLineupKeyParams = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string;
};

export type LegacyLineupDraft = LegacyLineupKeyParams & {
  lineupId: string;
  status: "draft" | "submitted" | "locked" | "resolved";
  entries: LegacyLineupEntryInput[];
  modifiers: LineupDraftModifiers;
  createdAt: string;
  updatedAt: string;
};

export type LegacyFormCardOption = {
  id: string;
  playerId: string;
  playerName: string;
  color: FormCardColor;
  value: number;
  isUsed: boolean;
  usedByLineupId: string | null;
};

export type LegacyTeamPowerOption = {
  id: string;
  label: string;
  description: string;
  category: TeamPowerCategory;
  effectType: TeamPowerEffectType;
  targetMode: TeamPowerTargetMode;
  targetLimit: number;
  conditionalBonusPct: number;
  conditionalTrigger: TeamPowerConditionalTrigger | null;
  conditionalDescription: string | null;
  source: "team_identity" | "facility";
  sourceFacilityId: string | null;
  modifier: number;
  positiveAttributeTags: TeamPowerAttributeTag[];
  negativeAttributeTag: TeamPowerAttributeTag | null;
  chargesTotal: number;
  chargesUsed: number;
  chargesRemaining: number;
  selectedForSeason: boolean;
  isUsedUp: boolean;
  isPassive: boolean;
};

export type LegacyMutatorTraitOption = {
  label: string;
  value: string;
  polarity: "positive" | "negative";
};

export type LegacyModifierSelectionSourceStatus = "ready" | "missing_source";

export type LegacyModifierEffectStatus = "ready" | "pending_source" | "missing_source";

export type LegacyModifierSourceSummary = {
  selectionStatus: LegacyModifierSelectionSourceStatus;
  effectStatus: LegacyModifierEffectStatus;
  sourceLabel: string;
  warnings: string[];
};

export type LegacyLineupPreview = LegacyLineupDraft & {
  disciplineSideScores: LegacyLineupScoreResult[];
  scorePreview: LegacyLineupScoreResult;
  totalScore: number;
  validationWarnings: string[];
  missingScores: string[];
};

export type LegacyLineupSaveResult =
  | {
      ok: true;
      draft: LegacyLineupDraft;
      warnings: string[];
    }
  | {
      ok: false;
      errors: string[];
      warnings: string[];
    };

export type LegacyLineupRepositoryContext = LegacyLineupKeyParams & {
  entries: LegacyLineupEntryInput[];
  disciplinePlayerCounts: Record<string, number>;
  disciplineSidePlayerCounts?: Record<string, number>;
  disciplineSideCaptainCounts?: Record<string, number>;
  activePlayers: LegacyActivePlayerRef[];
  disciplineScores: LegacyDisciplineScoreRef[];
};

export type LegacyLineupContextMeta = LegacyLineupKeyParams & {
  d1DisciplineId: string | null;
  d2DisciplineId: string | null;
};

export type LegacyLineupLoadedContext = LegacyLineupRepositoryContext & {
  gameState?: GameState;
  lineupStrategy?: AiLineupStrategy;
  save: {
    id: string;
    name: string;
    status: string;
  };
  season: {
    id: string;
    saveId: string;
    name: string;
    year: number;
    currentMatchday: number;
    status: string;
  };
  matchday: {
    id: string;
    seasonId: string;
    index: number;
    label: string;
    status: string;
  };
  team: {
    id: string;
    shortCode: string;
    name: string;
    logoPath?: string | null;
  };
  teamSeasonState: {
    id: string;
    saveId: string;
    seasonId: string;
    teamId: string;
    cash: number;
    budget: number;
    rosterLimit: number;
    playerOpt?: number;
  };
  teamIdentity: {
    pow: number;
    spe: number;
    men: number;
    soc: number;
  };
  teamStrategyProfile?: TeamStrategyProfile | null;
  allTeamIdentities?: Array<{
    teamId: string;
    teamCode: string;
    teamName: string;
    pow: number;
    spe: number;
    men: number;
    soc: number;
  }>;
  rosterPlayers: LegacyRosterPlayerRef[];
  disciplines: Array<{
    id: string;
    name: string;
    category: DisciplineCategory;
  }>;
  seasonDisciplineSchedule?: SeasonDisciplineScheduleEntry[];
  disciplineWeights: Array<{
    disciplineId: string;
    attributeKey: string;
    weightPct: number;
  }>;
  seasonDisciplineConfigs: Array<{
    disciplineId: string;
    originalOrder: number | null;
    displayOrder: number | null;
    playerCount: number | null;
    requiredCaptains?: number;
    mutator1: string | null;
    mutator2: string | null;
    sourceStatus?: string;
  }>;
  existingDraft: LegacyLineupDraft | null;
  contextMeta: LegacyLineupContextMeta;
  lineupContract?: Array<{
    disciplineId: string;
    displayName: string;
    order: number | null;
    requiredPlayers: number | null;
    requiredCaptains: number;
    category: string;
    scoringField: string;
    rankSource: string | null;
    rankSourceStatus: string;
    isSupported: boolean;
    sourceStatus: string;
  }>;
  matchdayContract?: {
    matchdayId: string;
    matchdayLabel: string;
    matchdayIndex: number;
    sourceStatus?: string;
    sourceNote?: string | null;
    discipline1: {
      disciplineId: string;
      displayName: string;
      requiredPlayers: number | null;
      requiredCaptains: number;
      category: string;
      rankSource: string | null;
      rankSourceStatus: string;
      sourceStatus: string;
      disciplineSide: DisciplineSide;
    } | null;
    discipline2: {
      disciplineId: string;
      displayName: string;
      requiredPlayers: number | null;
      requiredCaptains: number;
      category: string;
      rankSource: string | null;
      rankSourceStatus: string;
      sourceStatus: string;
      disciplineSide: DisciplineSide;
    } | null;
    seasonCaptainSlots: number;
    totalDisciplineSidesInSeason: number;
  };
  teamStatus?: {
    lineupFilledCount: number;
    totalLineupSides: number;
    captainUsedCount: number;
    captainUsedSides?: string[];
    captainSlots: number;
    displayLabel: string;
  };
  fatigueByPlayerId?: Record<string, { count: number; multiplier: number }> | null;
  injuryByPlayerId?: Record<string, { injuredThisMatchday: boolean; multiplier: number }> | null;
  injurySourceStatus?: "mapped" | "not_applied";
  moraleByPlayerId?: Record<string, LegacyMoralePerformanceRef> | null;
  fatigueSourceStatus?: "mapped" | "missing_source";
  teamDisciplineRanks?: Record<string, { rank: number | null; score?: number | null; sourceStatus: string; rankSource?: string | null }>;
  captainRule?: {
    seasonCaptainSlots: number;
    perDisciplineSideMaxCaptains: number;
    sourceStatus: string;
  };
  contextLoadMode?: "sqlite_local" | "prisma_reference";
  formCardSource?: LegacyModifierSourceSummary;
  mutatorSource?: LegacyModifierSourceSummary;
  teamPowerSource?: LegacyModifierSourceSummary;
  formCards?: LegacyFormCardOption[];
  formCardPlans?: FormCardPlanRecord[];
  teamPowers?: LegacyTeamPowerOption[];
  teamPowerWindows?: Record<string, {
    disciplineId: string;
    rankSource: string;
    sourceStatus: string;
    top8Rivals: Array<{ teamId: string; teamName: string; rank: number; relationship: number }>;
  }>;
  mutatorTraitOptions?: LegacyMutatorTraitOption[];
};

export type LegacyLineupContextLoadResult =
  | {
      ok: true;
      context: LegacyLineupLoadedContext;
      warnings: string[];
    }
  | {
      ok: false;
      errors: string[];
      warnings: string[];
    };

export type LegacyLineupPreviewResult =
  | {
      ok: true;
      contextMeta: LegacyLineupContextMeta;
      validation: LegacyLineupValidationResult;
      disciplineSideScores: LegacyLineupScoreResult[];
      scorePreview: LegacyLineupScoreResult;
      warnings: string[];
    }
  | {
      ok: false;
      errors: string[];
      warnings: string[];
    };

export type LegacyLineupValidationOptions = {
  enforceCompleteness?: boolean;
  seasonCaptainLimit?: number;
  captainUsedBeforeCurrentDraft?: number;
  captainUsedBeforeCurrentDraftSides?: string[];
};

export type LegacyResolvePreviewOptions = {
  modifierMode?: LegacyResolveMutatorMode;
  captainMode?: "selected_captain" | "legacy_strongest_selected" | "missing_source";
};
