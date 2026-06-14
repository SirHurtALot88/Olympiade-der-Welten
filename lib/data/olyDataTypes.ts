export type DisciplineCategory =
  | "power"
  | "speed"
  | "mental"
  | "social";

export type TeamArchetype = "balanced" | "sprinter_factory" | "powerhouse" | "youth_focus" | "value_hunter";

export type ContractStatus =
  | "active"
  | "expiring"
  | "renewal_pending"
  | "out_of_contract"
  | "released"
  | "free_agent";

export type TransferListingStatus = "open" | "pending" | "closed";
export type ContractShape = "balanced" | "front_loaded" | "back_loaded";
export type GamePhase =
  | "season_active"
  | "season_completed"
  | "season_review"
  | "season_rewards"
  | "player_development"
  | "preseason_management"
  | "transfer_sell_phase"
  | "transfer_buy_phase"
  | "lineup_setup"
  | "next_season_ready";

export type SeasonTransitionState = {
  transitionId: string;
  fromSeasonId: string;
  toSeasonId: string;
  currentStep: string;
  status: "idle" | "preview" | "applying" | "applied" | "failed";
  completedSteps: string[];
  warnings: string[];
  errors: string[];
  createdAt: string;
  appliedAt?: string;
};

export type ScenarioType =
  | "fresh_start"
  | "new_game"
  | "ai_redraft_test"
  | "season1_simulation"
  | "season1_completed"
  | "season_transition_test"
  | "season2_start"
  | "live_feature_test"
  | "sandbox_multiseason_test"
  | "manager_multiplayer_test"
  | "sandbox_snapshot";

export type ScenarioMeta = {
  scenarioType: ScenarioType;
  label: string;
  description?: string;
  createdAt: string;
  sourceSaveId?: string;
  isStableTestPoint?: boolean;
  allowTestWrites?: boolean;
  containsFinalStandings?: boolean;
  containsSeasonHistory?: boolean;
  activeSeasonId?: string;
  activeMatchday?: number;
  gamePhase?: string;
  roomId?: string;
  roomCode?: string;
  roomParticipants?: Array<{
    participantId: string;
    userId: string;
    displayName: string;
    role: "host" | "player" | "spectator";
    connectionStatus: "online" | "offline" | "reconnecting";
    controlledTeamIds: string[];
    readyState: "not_ready" | "ready" | "waiting";
    lastSeenAt: string;
  }>;
  teamOwnership?: Array<{
    teamId: string;
    controllerType: "human" | "ai" | "passive";
    userId?: string;
    participantId?: string;
    ownerDisplayName?: string;
  }>;
};

export type GameInboxCategory =
  | "task"
  | "warning"
  | "news"
  | "result"
  | "finance"
  | "transfer"
  | "training"
  | "contract"
  | "facility";

export type GameInboxSeverity = "info" | "warning" | "critical";
export type GameInboxStatus = "open" | "done" | "dismissed";

export type GameInboxItem = {
  itemId: string;
  saveId: string;
  seasonId: string;
  matchday?: number | string | null;
  teamId?: string | null;
  playerId?: string | null;
  category: GameInboxCategory;
  severity: GameInboxSeverity;
  title: string;
  description: string;
  targetView: string;
  targetParams: Record<string, string | number | boolean | null>;
  status: GameInboxStatus;
  createdAt: string;
  source: string;
};

export type PlayerMoraleVisibleMood = "angry" | "unhappy" | "neutral" | "happy" | "excellent";

export type PlayerMoraleContractIntent =
  | "willing_to_extend"
  | "short_term_only"
  | "demands_raise"
  | "considering_exit"
  | "refuses_extension";

export type PlayerMoraleReason = {
  reasonId: string;
  label: string;
  valueDelta: number;
  source: string;
};

export type PlayerMoraleState = {
  playerId: string;
  teamId: string;
  morale: number;
  visibleMood: PlayerMoraleVisibleMood;
  lastUpdatedSeasonId: string;
  reasons: PlayerMoraleReason[];
  contractIntent: PlayerMoraleContractIntent;
};

export type StandingRecord = {
  points: number;
  rank?: number | null;
  cashFc?: number | null;
  startplatz?: number | null;
  rankDiff?: number | null;
  sponsorBasis?: number | null;
  sponsorRank?: number | null;
  sponsorSeason?: number | null;
  sponsorTotal?: number | null;
  guv?: number | null;
  cashTotal?: number | null;
};

export type StandingsApplyAuditLogRecord = {
  id: string;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  action: "apply";
  payload: {
    idempotencyKey: string;
    totalTeams: number;
    appliedTeams: number;
    tieGroupsCount: number;
    previewWarningsCount: number;
  };
  createdAt: string;
};

export type CashPrizeApplyLogRecord = {
  id: string;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  action: "apply";
  payload: {
    idempotencyKey: string;
    totalTeams: number;
    appliedTeams: number;
    totalPrizeMoney: number;
  };
  createdAt: string;
};

export type MatchdayAdvanceLogRecord = {
  id: string;
  saveId: string;
  seasonId: string;
  fromMatchdayId: string;
  toMatchdayId: string | null;
  action: "advance";
  payload: {
    idempotencyKey: string;
    lockedLineups: number;
    resolvedFixtures: number;
    resultApplied: boolean;
    standingsApplied: boolean;
    cashApplied: boolean;
  };
  createdAt: string;
};

export type PlayerProgressionSpendUpgradeRecord = {
  playerId: string;
  attribute: PlayerGeneratorAttributeName;
  fromValue: number;
  toValue: number;
  cost: number;
  source: "manual_xp_spend_preview";
};

export type PlayerProgressionEconomySnapshot = {
  attributes: Partial<Record<PlayerGeneratorAttributeName, number>>;
  disciplineRatings: Record<string, number>;
  ovr: number | null;
  mvs: number | null;
  marketValue: number | null;
  salary: number | null;
  bracket: string | null;
};

export type PlayerProgressionSpendEventRecord = {
  eventId: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  upgrades: PlayerProgressionSpendUpgradeRecord[];
  xpEarned?: number;
  xpSpent: number;
  currentXPBefore?: number;
  currentXPAfter?: number;
  lifetimeXPBefore?: number | null;
  lifetimeXPAfter?: number | null;
  progressionSnapshotBefore?: PlayerProgressionEconomySnapshot;
  progressionSnapshotAfter?: PlayerProgressionEconomySnapshot & {
    marketValuePreview: number | null;
    salaryPreview: number | null;
    bracketPreview: string | null;
  };
  economyWarnings?: string[];
  timestamp: string;
  source: "manual_season_end_xp_spend";
};

export type PlayerBaselineRecord = {
  playerId: string;
  name: string;
  race: string;
  className: string;
  subclasses: string[];
  traits: string[];
  traitsPositive?: string[];
  traitsNegative?: string[];
  attributes: Partial<Record<PlayerGeneratorAttributeName, number>>;
  marketValue: number | null;
  salary: number | null;
  bracket: string | null;
  disciplineRatings: Record<string, number>;
  imageRef: string | null;
  source: "import" | "seed" | "legacy";
  sourceFile?: string | null;
  sourceHash?: string | null;
  baselineVersion: string;
  checksum?: string;
  checksumAlgorithm?: "sha256";
  createdAt: string;
  importedAt?: string;
  reconstructionWarning?: "baseline_reconstructed_from_mutated_state";
};

export type PlayerBaselineWriteGuardEvent = {
  eventId: string;
  playerId: string;
  reason: "player_baseline_write_blocked";
  attemptedSource: string;
  previousChecksum: string | null;
  attemptedChecksum: string | null;
  timestamp: string;
};

export type TeamIdentity = {
  teamId: string;
  playerType?: string | null;
  pow: number;
  spe: number;
  men: number;
  soc: number;
  ambition: number;
  finances: number;
  boardConfidence: number;
  harmony: number;
  manners: number;
  popularity: number;
  cooperation: number;
  playerMin: number;
  playerOpt: number;
  sourceNote?: string;
};

export type TeamIdentityOverride = Partial<Omit<TeamIdentity, "teamId">>;

export type PlayerAttributeSheetStats = {
  power?: number | null;
  health?: number | null;
  stamina?: number | null;
  intelligence?: number | null;
  awareness?: number | null;
  determination?: number | null;
  speed?: number | null;
  dexterity?: number | null;
  charisma?: number | null;
  will?: number | null;
  spirit?: number | null;
  torment?: number | null;
};

export type PlayerGeneratorRoleIntent = "offense" | "defense" | "support" | "allround" | "specialist" | "chaos";

export type PlayerGeneratorStrengthTier = "very_weak" | "weak" | "normal" | "strong" | "elite" | "legendary";

export type PlayerGeneratorRandomness = "low" | "medium" | "high";

export type PlayerGeneratorArchetype =
  | "mage"
  | "beast"
  | "rogue"
  | "tank"
  | "warrior"
  | "social_icon"
  | "construct"
  | "undead"
  | "nature"
  | "demon"
  | "angel"
  | "pirate"
  | "ninja"
  | "mercenary";

export type PlayerGeneratorAxisIntentValue = 1 | 2 | 3 | 4 | 5 | null | "auto";

export type PlayerGeneratorAxisIntent = {
  pow?: PlayerGeneratorAxisIntentValue;
  spe?: PlayerGeneratorAxisIntentValue;
  men?: PlayerGeneratorAxisIntentValue;
  soc?: PlayerGeneratorAxisIntentValue;
};

export type PlayerGeneratorResolvedAxisIntent = {
  pow: 1 | 2 | 3 | 4 | 5;
  spe: 1 | 2 | 3 | 4 | 5;
  men: 1 | 2 | 3 | 4 | 5;
  soc: 1 | 2 | 3 | 4 | 5;
};

export type PlayerGeneratorAxisSource =
  | "user"
  | "auto-role"
  | "auto-archetype"
  | "blended";

export type PlayerGeneratorInput = {
  name?: string | null;
  roleIntent: PlayerGeneratorRoleIntent;
  strengthTier: PlayerGeneratorStrengthTier;
  axisIntent: PlayerGeneratorAxisIntent;
  randomness: PlayerGeneratorRandomness;
  preferredArchetype?: PlayerGeneratorArchetype | null;
  raceHint?: string | null;
  classHint?: string | null;
  traitHint?: string | null;
  seed?: string | null;
};

export type PlayerGeneratorAttributes = {
  power: number;
  health: number;
  stamina: number;
  intelligence: number;
  awareness: number;
  determination: number;
  speed: number;
  dexterity: number;
  charisma: number;
  will: number;
  spirit: number;
  torment: number;
};

export type PlayerGeneratorAttributeName = keyof PlayerGeneratorAttributes;

export type PlayerGeneratorMatchState = "ok" | "warning" | "failed";

export type PlayerGeneratorValidationStatus =
  | "ready_for_review"
  | "needs_edit"
  | "blocked_missing_engine"
  | "blocked_archetype_conflict";

export type PlayerGeneratorClassSuggestion = {
  className: string;
  fitScore: number;
  reasons: string[];
  warnings: string[];
};

export type PlayerGeneratorFormulaSourceStatus = "ready" | "missing_source" | "incomplete_source" | "blocked";

export type PlayerGeneratorMarketValueEngineStatus = "ready" | "blocked_missing_rank_to_mw_source";

export type PlayerGeneratorSalaryEngineStatus = "ready_if_market_value_input_present" | "blocked_missing_salary_sources";

export type PlayerGeneratorClassEngineStatus = "ready" | "heuristic" | "blocked_missing_class_factors";

export type PlayerGeneratorMarketValueStatus = "ready" | "missing_market_value_engine";

export type PlayerGeneratorSalaryStatus = "ready" | "missing_salary_engine" | "missing_market_value_input";

export type PlayerGeneratorFormulaStatusSnapshot = {
  attributeSalaryModifiersStatus: PlayerGeneratorFormulaSourceStatus;
  traitSalaryFactorsStatus: PlayerGeneratorFormulaSourceStatus;
  rankMarketValueStatus: PlayerGeneratorFormulaSourceStatus;
  classFactorsStatus: PlayerGeneratorFormulaSourceStatus;
  marketValueEngineStatus: PlayerGeneratorMarketValueEngineStatus;
  salaryEngineStatus: PlayerGeneratorSalaryEngineStatus;
  classEngineStatus: PlayerGeneratorClassEngineStatus;
  warnings: string[];
};

export type PlayerGeneratorEngineStatusView = {
  marketValueEngine: "ready" | "blocked" | "incomplete_source";
  salaryEngine: "ready" | "missing_market_value_input" | "blocked";
  classEngine: "ready" | "heuristic" | "blocked";
  potentialEngine: "missing_progression_source";
};

export type PlayerGeneratorDraftStatusView = {
  ovr: "draft_preview";
  pps: "draft_preview";
};

export type PlayerGeneratorSaveStatusView = {
  save: "draft_only";
  commit: "disabled";
  commitReasons: Array<"market_value_engine_blocked" | "salary_engine_blocked" | "salary_engine_waits_for_market_value" | "commit_path_not_ready">;
};

export type PlayerGeneratorQualityWarningCode =
  | "archetype_constraint_failed"
  | "role_profile_weak"
  | "too_flat_profile"
  | "axis_auto_resolved"
  | "archetype_pool_missing"
  | "unknown_trait"
  | "unknown_class"
  | "unknown_race";

export type PlayerGeneratorDraft = {
  draftId: string;
  input: PlayerGeneratorInput;
  generated: {
    name: string;
    race: string;
    className: string;
    classSuggestion: PlayerGeneratorClassSuggestion;
    subclasses: string[];
    traitsPositive: string[];
    traitsNegative: string[];
    attributes: PlayerGeneratorAttributes;
    axes: {
      pow: number;
      spe: number;
      men: number;
      soc: number;
    };
    disciplineRatings: Record<string, number>;
    ovr: number | null;
    pps: number | null;
    potential: number | null;
    marketValue: number | null;
    salary: number | null;
    marketValueStatus: PlayerGeneratorMarketValueStatus;
    salaryStatus: PlayerGeneratorSalaryStatus;
    formulaStatus: PlayerGeneratorFormulaStatusSnapshot;
    diagnostics: {
      archetypeMatch: PlayerGeneratorMatchState;
      roleMatch: PlayerGeneratorMatchState;
      statSilhouette: PlayerGeneratorMatchState;
      engineStatus: PlayerGeneratorEngineStatusView;
      draftStatus: PlayerGeneratorDraftStatusView;
      saveStatus: PlayerGeneratorSaveStatusView;
      qualityWarnings: PlayerGeneratorQualityWarningCode[];
      statSpread: number;
      flatAttributeCount: number;
      resolvedAxisIntent: PlayerGeneratorResolvedAxisIntent;
      axisIntentSources: {
        pow: PlayerGeneratorAxisSource;
        spe: PlayerGeneratorAxisSource;
        men: PlayerGeneratorAxisSource;
        soc: PlayerGeneratorAxisSource;
      };
      peakAttributes: PlayerGeneratorAttributeName[];
      weakAttributes: PlayerGeneratorAttributeName[];
      archetypeSummary: string[];
      roleSummary: string[];
    };
  };
  warnings: string[];
  validationStatus: PlayerGeneratorValidationStatus;
  createdAt: string;
  updatedAt?: string;
};

export type Player = {
  id: string;
  name: string;
  portraitPath?: string | null;
  portraitUrl?: string | null;
  rating: number;
  marketValue: number;
  salaryDemand: number;
  displayMarketValue?: number;
  displaySalary?: number;
  pps?: number | null;
  ovr?: number | null;
  currentXP?: number | null;
  spentXP?: number | null;
  lifetimeXP?: number | null;
  trainingMode?: "leicht" | "mittel" | "hart" | null;
  cost?: number;
  upkeepBase?: number;
  className: string;
  race: string;
  alignment: string;
  gender: string;
  referenceClass?: string | null;
  imageSource?: string | null;
  bracketLabel?: string | null;
  subclasses: string[];
  traitsPositive: string[];
  traitsNegative: string[];
  coreStats: {
    pow: number;
    spe: number;
    men: number;
    soc: number;
  };
  attributeSheetStats?: PlayerAttributeSheetStats;
  attributeSheetRatings?: {
    powerRating?: string | null;
    healthRating?: string | null;
    staminaRating?: string | null;
    intelligenceRating?: string | null;
    awarenessRating?: string | null;
    determinationRating?: string | null;
    speedRating?: string | null;
    dexterityRating?: string | null;
    charismaRating?: string | null;
    willRating?: string | null;
    spiritRating?: string | null;
    tormentRating?: string | null;
  };
  preferredDisciplineIds: string[];
  disciplineRatings: Record<string, number>;
  previousDisciplineRatings?: Record<string, number>;
  lastSeasonDisciplineValues?: Record<string, number>;
  currentDisciplineValues?: Record<string, number>;
  disciplineDelta?: Record<string, number>;
  economyAfterUpgradePreview?: {
    marketValuePreview: number | null;
    salaryExpectation: number | null;
    renewalSalaryPreview: number | null;
    currentContractSalary: number | null;
    ovrPreview: number | null;
    mvsUnchanged: number | null;
    marketValueWarnings?: string[];
    salaryWarnings?: string[];
    warningLevel?: "none" | "gt_25_pct" | "gt_50_pct" | "gt_90_pct";
    updatedAt: string;
    source: "season_end_xp_spend_preview";
  } | null;
  disciplineTierCounts: {
    above20: number;
    above40: number;
    above60: number;
    above80: number;
  };
  flavorEn: string;
  flavorDe: string;
  fatigue: number;
  form: number;
  potential: number;
};

export type PlayerPotentialBand = "low" | "medium" | "high" | "elite" | "unknown";
export type PlayerPotentialSource = "generated" | "imported" | "scouted" | "missing";

export type PlayerPotentialRecord = {
  playerId: string;
  potentialBand: PlayerPotentialBand;
  hiddenPotentialScore?: number;
  revealedPotentialRange?: {
    min: number;
    max: number;
  };
  confidence: number;
  source: PlayerPotentialSource;
};

export type Team = {
  teamId: string;
  shortCode: string;
  name: string;
  logoPath?: string | null;
  budget: number;
  cash: number;
  identityId: string;
  humanControlled: boolean;
  rosterLimit: number;
  rosterMinTarget?: number | null;
  rosterOptTarget?: number | null;
};

export type TeamControlMode = "manual" | "ai" | "passive";

// Save-/gameplay-level control. This controls local AI/manual/passive behavior
// in simulations and singleplayer flows, but it does not grant multiplayer
// write permissions. Online writes are authorized by teamOwnership.
export type TeamControlSettings = {
  teamId: string;
  controlMode: TeamControlMode;
  ownerId?: string | null;
  // Legacy local owner slot for old saves/UI filters. Keep for compatibility;
  // do not use as final online multiplayer ownership.
  ownerSlot?: string | null;
  displayLabel?: string | null;
  aiLineupPreviewEnabled: boolean;
  aiLineupApplyEnabled?: boolean;
  aiLineupAutoApplyEnabled: boolean;
  aiTransferPreviewEnabled: boolean;
  aiTransferAutoApplyEnabled: boolean;
  aiSellPreviewEnabled: boolean;
  aiSellAutoApplyEnabled: boolean;
  notes?: string | null;
  strategyLock?: string | null;
};

export type TeamStrategyBias = {
  cashPriority: number;
  valuePriority: number;
  starPriority: number;
  riskTolerance: number;
  wageSensitivity: number;
  sellForProfitAggression: number;
  shortContractPreference: number;
  longContractPreference: number;
  loyaltyBias: number;
  harmonyStrictness: number;
  rosterDepthPreference: number;
  eliteSmallRosterPreference: number;
};

export type TeamStrategyLevel = "low" | "medium" | "high";

export type TeamStrategyProfile = {
  teamId: string;
  teamCode?: string;
  teamName?: string;
  strategyVersion?: string;
  strategySummary: string;
  buyStyle: string;
  sellStyle: string;
  contractStyle: string;
  rosterStyle: string;
  fantasyTheme?: string | null;
  loreTheme?: string | null;
  preferredArchetypes: string[];
  secondaryArchetypes?: string[];
  avoidedArchetypes: string[];
  dislikedArchetypes?: string[];
  preferredRaces: string[];
  dislikedRaces?: string[];
  avoidedRaces: string[];
  preferredClasses: string[];
  dislikedClasses?: string[];
  avoidedClasses: string[];
  preferredTraits?: string[];
  dislikedTraits?: string[];
  rosterMinTarget?: number | null;
  rosterOptTarget?: number | null;
  prefersDepth?: TeamStrategyLevel;
  prefersStars?: TeamStrategyLevel;
  prefersAllrounders?: TeamStrategyLevel;
  prefersSpecialists?: TeamStrategyLevel;
  shortContractsBias?: TeamStrategyLevel;
  longContractsBias?: TeamStrategyLevel;
  spendAggression?: TeamStrategyLevel;
  saveDiscipline?: TeamStrategyLevel;
  overpayTolerance?: TeamStrategyLevel;
  sellAggression?: TeamStrategyLevel;
  profitSellBias?: TeamStrategyLevel;
  loyaltyPreference?: TeamStrategyLevel;
  riskToleranceLevel?: TeamStrategyLevel;
  emergencyBuyBias?: TeamStrategyLevel;
  powBias?: number | null;
  speBias?: number | null;
  menBias?: number | null;
  socBias?: number | null;
  lineupStyleNote?: string | null;
  transferStyleNote?: string | null;
  sellStyleNote?: string | null;
  hardNoGos: string[];
  lockedNoGos?: string[];
  strategyWarnings?: string[];
  notes?: string | null;
  bias: TeamStrategyBias;
};

export type FormCardColor = "red" | "green" | "blue" | "yellow";

export type FormCardRecord = {
  id: string;
  saveId: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  playerName: string;
  cardColor: FormCardColor;
  cardValue: number;
  createdAt: string;
};

export type TeamFacilityRecord = {
  level: number;
  enabled: boolean;
  conditionPct?: number;
  activeVariant?: string;
  lastPaidSeasonId?: string;
  disabledReason?: string;
};

export type TeamFacilityCollection = {
  facilities: Record<string, TeamFacilityRecord>;
};

export type FacilityEventRecord = {
  eventId: string;
  seasonId: string;
  teamId: string;
  facilityId: string;
  previousLevel: number;
  nextLevel: number;
  cost: number;
  timestamp: string;
  source:
    | "manual_facility_upgrade"
    | "facility_upkeep_paid"
    | "facility_upkeep_unpaid"
    | "facility_income_collected"
    | "facility_condition_decay"
    | "manual_facility_maintenance";
  previousConditionPct?: number;
  nextConditionPct?: number;
};

export type TeamSeasonObjectiveCategory = "sport" | "finance" | "transfer" | "roster" | "facility" | "development";

export type TeamSeasonObjectiveStatus = "open" | "completed" | "failed" | "at_risk";

export type TeamSeasonObjectiveRecord = {
  seasonId: string;
  teamId: string;
  objectiveId: string;
  category: TeamSeasonObjectiveCategory;
  label: string;
  targetValue: number | string | boolean | null;
  currentValue: number | string | boolean | null;
  status: TeamSeasonObjectiveStatus;
  rewardCash?: number;
  penaltyCash?: number;
  boardConfidenceDelta?: number;
  source: string;
};

export type TeamBoardConfidenceRecord = {
  teamId: string;
  value: number;
  pressure: number;
  warnings: string[];
};

export type ContractEventRecord = {
  eventId: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  eventType: "contract_renewed" | "contract_expired" | "player_released" | "contract_expired_exit";
  exitValue?: number | null;
  saleFactor?: number | null;
  marketValueAtExit?: number | null;
  purchasePrice?: number | null;
  profitLoss?: number | null;
  oldSalary: number | null;
  newSalary: number | null;
  oldLength: number | null;
  newLength: number | null;
  timestamp: string;
  source:
    | "season_end_contract_tick"
    | "manual_contract_renewal"
    | "ai_contract_renewal"
    | "manual_player_release"
    | "ai_player_release"
    | "manual_contract_expiry"
    | "ai_contract_expiry";
};

export type AiManagerBudgetReservationRecord = {
  teamId: string;
  seasonId: string;
  sourcePlanId: string;
  cashReserve: number;
  salaryReserve: number;
  transferBudget: number;
  buildingBudget: number;
  maintenanceBudget: number;
  emergencyBudget: number;
  updatedAt: string;
};

export type AiManagerTrainingSettingRecord = {
  teamId: string;
  seasonId: string;
  sourcePlanId: string;
  trainingFocus: "POW" | "SPE" | "MEN" | "SOC" | "BALANCED" | "RECOVERY";
  trainingIntensity: "light" | "normal" | "hard";
  playerTrainingMode: "leicht" | "mittel" | "hart";
  expectedXpEffect: number;
  expectedRecoveryEffect: number;
  expectedInjuryRiskEffect: number;
  updatedAt: string;
};

export type AiManagerContractStrategy =
  | "extend_core"
  | "salary_cap"
  | "sell_if_offer"
  | "do_not_renew"
  | "wait_and_see"
  | "prospect_hold"
  | "market_test";

export type AiManagerContractStrategyRecord = {
  teamId: string;
  playerId: string;
  seasonId: string;
  strategy: AiManagerContractStrategy;
  reason: string;
  sourcePlanId: string;
  updatedAt: string;
};

export type PlayerInjuryStatus = "healthy" | "injured" | "recovering";

export type PlayerInjuryRiskRollRecord = {
  fatigueBefore: number;
  riskPercent: number;
  roll: number;
  result: "healthy" | "injured";
  source: "fatigue_injury_risk_v1";
};

export type PlayerAvailabilityStateRecord = {
  playerId: string;
  teamId: string;
  fatigue: number;
  injuryStatus: PlayerInjuryStatus;
  injuryUntilMatchday?: string;
  injuredAtSeasonId?: string;
  injuredAtMatchdayId?: string;
  injuryReason?: string;
  injuryRiskLastRoll?: PlayerInjuryRiskRollRecord;
};

export type InjuryEventRecord = {
  eventId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string;
  playerId: string;
  fatigueBefore: number;
  riskPercent: number;
  roll: number;
  result: "healthy" | "injured";
  unavailableForMatchdays: 1;
  unavailableUntil?: string | null;
  normalRecovery?: number | null;
  injuryRecovery?: number | null;
  fatigueAfterRecovery?: number | null;
  source: "fatigue_injury_risk_v1";
  timestamp: string;
};

export type PreSeasonWorkflowLogRecord = {
  logId: string;
  saveId: string;
  fromSeasonId: string;
  toSeasonId: string;
  stepId: string;
  status: "started" | "applied" | "failed";
  errors: string[];
  warnings: string[];
  affectedEntities: string[];
  timestamp: string;
};

export type Discipline = {
  id: string;
  name: string;
  category: DisciplineCategory;
  weight: number;
  originalOrder?: number;
  displayOrder?: number;
  playerCount?: number;
  mutator1?: string | null;
  mutator2?: string | null;
};

export type RosterEntry = {
  id: string;
  teamId: string;
  playerId: string;
  contractLength: number;
  contractStatus?: ContractStatus;
  salary: number;
  upkeep: number;
  purchasePrice?: number | null;
  currentValue?: number | null;
  roleTag: "starter" | "bench" | "prospect";
  joinedSeasonId: string;
};

export type ContractYearSalary = {
  yearIndex: number;
  seasonOffset: number;
  label: string;
  salary: number;
};

export type ContractNegotiationDraftStatus =
  | "preview_only"
  | "ready_for_review"
  | "countered"
  | "accepted_pending_confirm"
  | "rejected_bad_experience"
  | "blocked_missing_salary_source"
  | "blocked_read_only";

export type ContractNegotiationDraft = {
  draftId: string;
  saveId: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  playerName: string;
  contractLength: number;
  contractShape: ContractShape;
  expectedSalary: number | null;
  offeredSalary: number | null;
  yearlySalarySchedule: ContractYearSalary[];
  totalSalary: number | null;
  roundingAdjustment: number | null;
  buyoutCost: number | null;
  bracket: number | null;
  teamFit: number | null;
  acceptanceScore: number | null;
  acceptChance: number | null;
  counterChance: number | null;
  rejectChance: number | null;
  reasons: string[];
  warnings: string[];
  blockingReasons: string[];
  status: ContractNegotiationDraftStatus;
  updatedAt: string;
};

export type TransferWishlistEntry = {
  id: string;
  saveId: string;
  seasonId: string;
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  marketValue: number | null;
  salary: number | null;
  bracket: number | null;
  teamId?: string | null;
  createdAt: string;
};

export type Contract = {
  id: string;
  playerId: string;
  teamId: string | null;
  salary: number;
  expiresAtMatchday: number;
  status: ContractStatus;
};

export type TransferListing = {
  id: string;
  playerId: string;
  sellerTeamId: string | null;
  askingPrice: number;
  minimumSalary: number;
  status: TransferListingStatus;
  createdAt: string;
};

export type TransferHistoryEntry = {
  id: string;
  playerId: string;
  playerName?: string | null;
  seasonId: string;
  matchdayId?: string | null;
  phase?: string | null;
  source?: string | null;
  seasonLabel: string;
  transferType: "buy" | "sell" | "contract_exit";
  fromTeamId: string | null;
  toTeamId: string | null;
  fee: number;
  salary: number;
  marketValue: number;
  remainingContractLength: number;
  happenedAt: string;
};

export type Matchday = {
  id: string;
  seasonId: string;
  index: number;
  label: string;
  fixtureIds: string[];
};

export type SeasonDisciplineScheduleSourceStatus =
  | "mapped"
  | "legacy_seed"
  | "season_seed"
  | "discipline_schedule_rule_missing";

export type SeasonDisciplineScheduleSlot = {
  disciplineId: string;
  displayName: string;
  order: number | null;
  playerCount: number | null;
  category: DisciplineCategory;
};

export type SeasonDisciplineScheduleEntry = {
  seasonId: string;
  matchdayId: string;
  matchdayIndex: number;
  matchdayLabel: string;
  discipline1: SeasonDisciplineScheduleSlot | null;
  discipline2: SeasonDisciplineScheduleSlot | null;
  sourceStatus: SeasonDisciplineScheduleSourceStatus;
  sourceNote: string | null;
};

export type Fixture = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  matchdayId: string;
  status: "scheduled" | "resolved";
};

export type Season = {
  id: string;
  name: string;
  year: number;
  currentMatchday: number;
  matchdayIds: string[];
};

export type MatchdayResultStatus = "preview_applied" | "superseded" | "voided";

export type LegacyResultReadinessStatus =
  | "ready"
  | "underfilled_roster"
  | "missing_lineup"
  | "invalid_lineup"
  | "missing_score_coverage"
  | "unknown";

export type MatchdayResultRecord = {
  id: string;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  status: MatchdayResultStatus;
  sourceVersion: string;
  teamsTotal: number;
  teamsReady: number;
  teamsUnderfilled: number;
  teamsMissingLineup: number;
  teamsInvalidLineup: number;
  teamsMissingScoreCoverage: number;
  warningsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DisciplineResultRecord = {
  id: string;
  matchdayResultId: string;
  teamId: string;
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  rank: number;
  baseScore: number;
  totalScore: number;
  readinessStatus: LegacyResultReadinessStatus;
  warnings: string[];
  createdAt: string;
};

export type PlayerDisciplinePerformanceRecord = {
  id: string;
  matchdayResultId: string;
  teamId: string;
  playerId: string;
  activePlayerId: string | null;
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  slotIndex: number;
  baseValue: number;
  finalPlayerScore: number;
  mutatorScoreBonus?: number | null;
  mutatorPpsBonus?: number | null;
  scoreContribution: number;
  rankInTeam: number;
  rankInDiscipline: number;
  isTop10: boolean;
  isMvpCandidate: boolean;
  storyWeight: number | null;
  createdAt: string;
};

export type DisciplineHighlightRecord = {
  id: string;
  matchdayResultId: string;
  disciplineId: string | null;
  highlightType: "best_player_discipline" | "strongest_team_score" | "closest_score_gap" | "missing_lineup_warning" | "injury_event";
  teamId: string | null;
  playerId: string | null;
  relatedTeamId: string | null;
  importanceScore: number;
  shortSummary: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ResultAuditLogRecord = {
  id: string;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  matchdayResultId: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type SeasonSnapshotTeamRecord = {
  teamId: string;
  teamCode: string;
  teamName: string;
  rank: number | null;
  points: number | null;
  disciplinePoints: number | null;
  disciplinePointsByArea: {
    pow: number | null;
    spe: number | null;
    men: number | null;
    soc: number | null;
  };
  cashEnd: number | null;
  rosterEnd: number;
  rosterCountEnd?: number | null;
  salaryEnd: number | null;
  salaryTotalEnd?: number | null;
  marketValueEnd: number | null;
  marketValueTotalEnd?: number | null;
  transferCount: number;
  transferBuyCount: number;
  transferSellCount: number;
  transferNet: number | null;
  isGold?: boolean;
  isSilver?: boolean;
  isBronze?: boolean;
  isTop5?: boolean;
  isTop10?: boolean;
  avgRankContribution?: number | null;
};

export type SeasonSnapshotPlayerDisciplineBreakdownRecord = {
  disciplineId: string;
  disciplineName: string;
  appearances: number;
  totalContribution: number | null;
  averageContribution: number | null;
  averageFinalScore: number | null;
};

export type SeasonSnapshotPlayerTeamBreakdownRecord = {
  teamId: string | null;
  teamCode: string | null;
  teamName: string | null;
  appearances: number;
  totalPoints: number | null;
};

export type SeasonSnapshotPlayerPerformanceRecord = {
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamCode: string | null;
  teamName: string | null;
  seasonId?: string;
  appearances: number;
  totalContribution: number | null;
  totalPoints?: number | null;
  averageContribution: number | null;
  averageFinalScore: number | null;
  top10Count: number;
  mvpCount: number;
  bestDisciplineId: string | null;
  bestDisciplineLabel?: string | null;
  bestDisciplineScore: number | null;
  disciplineBreakdown?: SeasonSnapshotPlayerDisciplineBreakdownRecord[];
  teamBreakdown?: SeasonSnapshotPlayerTeamBreakdownRecord[];
  warnings?: string[];
};

export type SeasonSnapshotTransferRecord = {
  transferId: string;
  seasonId: string;
  matchdayId?: string | null;
  phase?: string | null;
  playerId: string;
  playerName: string;
  fromTeamId: string | null;
  fromTeamName: string | null;
  toTeamId: string | null;
  toTeamName: string | null;
  type: "buy" | "sell" | "contract_exit";
  amount: number | null;
  salary: number | null;
  marketValue: number | null;
  contractLength: number | null;
  source: string;
};

export type SeasonSnapshotRecord = {
  snapshotId?: string;
  seasonId: string;
  seasonName: string;
  createdAt?: string;
  archivedAt: string;
  source?: "local";
  status?: "completed" | "partial" | "dry_run";
  sourceStatus?: "mapped" | "partial" | "missing_source";
  finalStandings: SeasonSnapshotTeamRecord[];
  teamSnapshots?: SeasonSnapshotTeamRecord[];
  playerPerformances: SeasonSnapshotPlayerPerformanceRecord[];
  playerPerformanceSnapshots?: SeasonSnapshotPlayerPerformanceRecord[];
  transferSnapshots?: SeasonSnapshotTransferRecord[];
  warnings?: string[];
};

export type AiLifecyclePhase =
  | "new_game_setup"
  | "preseason_review"
  | "preseason_strategy"
  | "preseason_market"
  | "preseason_facilities"
  | "preseason_training_setup"
  | "matchday_preparation"
  | "matchday_resolve"
  | "matchday_review"
  | "midseason_check"
  | "season_end_review"
  | "postseason_management"
  | "season_transition";

export type AiLifecyclePhaseStatus = "pending" | "running" | "completed" | "failed" | "blocked" | "skipped" | "degraded";

export type AiLifecyclePhaseRunRecord = {
  runId: string;
  saveId: string;
  seasonId: string;
  matchdayId?: string | null;
  phase: AiLifecyclePhase;
  status: AiLifecyclePhaseStatus;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  memoryPeakMb?: number | null;
  warnings: string[];
  blockers: string[];
  affectedTeams: string[];
  affectedPlayers: string[];
  outputFiles: string[];
  canResume: boolean;
};

export type AiManagerMemoryRecord = {
  teamId: string;
  seasonId: string;
  lastSeasonRank: number | null;
  lastSeasonPoints: number | null;
  prizeMoney: number | null;
  cashTrend: "up" | "down" | "flat" | "unknown";
  salaryTrend: "up" | "down" | "flat" | "unknown";
  rosterSizeTrend: "up" | "down" | "flat" | "unknown";
  playerPerformanceNotes: string[];
  underperformingPlayers: string[];
  breakoutPlayers: string[];
  injuryProblems: string[];
  fatigueProblems: string[];
  disciplineWeaknesses: string[];
  disciplineStrengths: string[];
  boardTrustTrend: "up" | "down" | "flat" | "unknown";
  moraleTrend: "up" | "down" | "flat" | "unknown";
  transferMistakes: string[];
  goodTransfers: string[];
  facilityNeeds: string[];
  trainingEffectiveness: string[];
  nextSeasonHints: string[];
  source: "ai_lifecycle_season_review";
  generatedAt: string;
};

export type AiSeasonStrategy =
  | "win_now_push"
  | "balanced_growth"
  | "rebuild_prospect"
  | "eco_round"
  | "roster_repair"
  | "cash_recovery"
  | "facility_push"
  | "salary_control"
  | "market_attack"
  | "depth_repair";

export type AiTacticalMode =
  | "standard"
  | "injury_crisis"
  | "fatigue_crisis"
  | "protect_lead"
  | "chase_top10"
  | "salary_freeze"
  | "rotate_more"
  | "train_light"
  | "overpay_for_core"
  | "market_window"
  | "morale_repair";

export type AiLineupStrategy =
  | "best_score_now"
  | "protect_stars"
  | "rotate_depth"
  | "develop_prospects"
  | "avoid_injury"
  | "captain_star"
  | "captain_safe"
  | "risk_high_ceiling"
  | "preserve_for_later_matchday";

export type TeamDoctrineRecord = {
  teamId: string;
  doctrineName: string;
  identityPillars: string[];
  preferredWinPath: string;
  secondaryWinPath: string;
  forbiddenPaths: string[];
  rosterPhilosophy: string;
  transferPhilosophy: string;
  trainingPhilosophy: string;
  facilityPhilosophy: string;
  contractPhilosophy: string;
  riskPhilosophy: string;
  identityStrictness: "low" | "medium" | "high";
  adaptationFlexibility: "low" | "medium" | "high";
};

export type AiStrategyShiftRecord = {
  trigger: string;
  oldStrategy: AiSeasonStrategy;
  newStrategy: AiSeasonStrategy;
  doctrineCompatibility: "green" | "yellow" | "red";
  benefit: string;
  risk: string;
  boardAcceptance: "low" | "medium" | "high";
  identityRisk: "low" | "medium" | "high";
  duration: string;
  reviewPoint: string;
};

export type AiIdentityGuardResult = {
  teamId: string;
  decisionType: string;
  identityScore: number;
  doctrineFit: "green" | "yellow" | "red";
  identityRisk: "low" | "medium" | "high";
  adaptationAllowed: boolean;
  reason: string;
  hardFails: string[];
};

export type AiManagerDecisionJournalEntry = {
  season: string;
  phase: AiLifecyclePhase | "audit";
  teamId: string;
  decisionType:
    | "strategy_shift"
    | "roster_target"
    | "player_buy"
    | "player_sell"
    | "renewal"
    | "training_change"
    | "building_maintenance"
    | "building_upgrade"
    | "eco_round"
    | "overpay"
    | "stop_under_opt"
    | "tactical_adjustment";
  decision: string;
  strategyBefore: AiSeasonStrategy | AiTacticalMode | "unknown";
  strategyAfter: AiSeasonStrategy | AiTacticalMode | "unknown";
  doctrineFit: "green" | "yellow" | "red";
  expectedOutcome: string;
  actualOutcome?: string | null;
  reason: string;
  rejectedAlternatives: string[];
  risk: "low" | "medium" | "high";
  wasCorrect?: boolean | null;
};

export type AiSeasonStrategyStateRecord = {
  teamId: string;
  seasonId: string;
  seasonStrategy: AiSeasonStrategy;
  tacticalMode: AiTacticalMode;
  doctrineCompatibility: "green" | "yellow" | "red";
  reason: string;
  updatedAt: string;
};

export type SeasonState = {
  seasonId: string;
  schedule: Fixture[];
  disciplineSchedule?: SeasonDisciplineScheduleEntry[];
  standings: Record<string, StandingRecord>;
  teamIdentityOverrides?: Record<string, TeamIdentityOverride>;
  teamControlSettings?: Record<string, TeamControlSettings>;
  teamStrategyProfiles?: Record<string, TeamStrategyProfile>;
  teamFacilities?: Record<string, TeamFacilityCollection>;
  facilityEvents?: FacilityEventRecord[];
  teamSeasonObjectives?: TeamSeasonObjectiveRecord[];
  boardConfidence?: Record<string, TeamBoardConfidenceRecord>;
  contractEvents?: ContractEventRecord[];
  playerAvailabilityState?: PlayerAvailabilityStateRecord[];
  injuryEvents?: InjuryEventRecord[];
  preSeasonWorkflowLogs?: PreSeasonWorkflowLogRecord[];
  playerGeneratorDrafts?: PlayerGeneratorDraft[];
  contractNegotiationDrafts?: ContractNegotiationDraft[];
  transferWishlist?: TransferWishlistEntry[];
  standingsApplyLogs?: StandingsApplyAuditLogRecord[];
  cashPrizeApplyLogs?: CashPrizeApplyLogRecord[];
  matchdayAdvanceLogs?: MatchdayAdvanceLogRecord[];
  formCards?: FormCardRecord[];
  lineupDrafts?: LineupDraft[];
  matchdayResults?: MatchdayResultRecord[];
  disciplineResults?: DisciplineResultRecord[];
  playerDisciplinePerformances?: PlayerDisciplinePerformanceRecord[];
  disciplineHighlights?: DisciplineHighlightRecord[];
  resultAuditLogs?: ResultAuditLogRecord[];
  seasonSnapshots?: SeasonSnapshotRecord[];
  aiManagerBudgetReservations?: Record<string, AiManagerBudgetReservationRecord>;
  aiManagerTrainingSettings?: Record<string, AiManagerTrainingSettingRecord>;
  aiManagerContractStrategies?: Record<string, AiManagerContractStrategyRecord>;
  aiManagerSellStrategies?: Record<string, AiManagerContractStrategyRecord>;
  aiLifecyclePhaseRuns?: AiLifecyclePhaseRunRecord[];
  aiManagerMemory?: Record<string, AiManagerMemoryRecord>;
  teamDoctrines?: Record<string, TeamDoctrineRecord>;
  aiSeasonStrategyState?: Record<string, AiSeasonStrategyStateRecord>;
  aiManagerDecisionJournal?: AiManagerDecisionJournalEntry[];
};

export type MatchdayState = {
  matchdayId: string;
  status: "planning" | "ready" | "resolved";
  pendingTeamIds: string[];
  resolvedFixtureIds: string[];
};

export type LineupDisciplineSide = "d1" | "d2";

export type LineupDraftEntry = {
  disciplineId: string;
  disciplineSide: LineupDisciplineSide;
  slotIndex: number;
  playerId: string;
  activePlayerId: string | null;
  isCaptain?: boolean;
};

export type LineupDraftModifierSide = {
  primaryFormCardId?: string | null;
  secondaryFormCardId?: string | null;
  mutatorTrait1?: string | null;
  mutatorTrait2?: string | null;
};

export type LineupDraftModifiers = {
  d1: LineupDraftModifierSide;
  d2: LineupDraftModifierSide;
};

export type LineupDraft = {
  lineupId: string;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string;
  status: "draft" | "submitted" | "locked" | "resolved";
  entries: LineupDraftEntry[];
  modifiers?: LineupDraftModifiers;
  createdAt: string;
  updatedAt: string;
};

export type GameLogEntry = {
  id: string;
  type: "system" | "ai" | "transfer" | "season";
  message: string;
  createdAt: string;
};

export type MappingWarningType =
  | "playerWithoutTeam"
  | "teamWithoutPlayers"
  | "mappingRowWithoutPlayerMatch"
  | "duplicateMappedPlayer"
  | "unknownTeamCode"
  | "duplicateTeamCode"
  | "officialTeamPendingCode";

export type MappingWarning = {
  type: MappingWarningType;
  message: string;
  teamId?: string;
  playerName?: string;
};

export type MappingReport = {
  mappingSource: string;
  teamSource: string;
  generatedAt: string;
  processedMappingRows: number;
  importedPlayerCount: number;
  matchedRosterCount: number;
  teamCount: number;
  unmappedPlayers: string[];
  teamsWithoutPlayers: string[];
  mappingRowsWithoutPlayerMatch: string[];
  duplicateMappedPlayers: string[];
  unknownTeamCodes: string[];
  duplicateTeamCodes: string[];
  warnings: MappingWarning[];
};

export type GameState = {
  gamePhase?: GamePhase;
  seasonTransition?: SeasonTransitionState;
  scenarioMeta?: ScenarioMeta;
  saveVersion?: number;
  lastAppliedEventId?: string | null;
  appliedEventIds?: string[];
  seasonReviewState?: unknown;
  preSeasonWorkflowState?: unknown;
  season: Season;
  seasonState: SeasonState;
  matchdayState: MatchdayState;
  teams: Team[];
  teamIdentities: TeamIdentity[];
  players: Player[];
  disciplines: Discipline[];
  rosters: RosterEntry[];
  contracts: Contract[];
  transferListings: TransferListing[];
  transferHistory: TransferHistoryEntry[];
  playerBaselines?: PlayerBaselineRecord[];
  baselineWriteGuardEvents?: PlayerBaselineWriteGuardEvent[];
  playerPotential?: PlayerPotentialRecord[];
  playerMoraleState?: PlayerMoraleState[];
  playerProgressionEvents?: PlayerProgressionSpendEventRecord[];
  gameInboxItems?: GameInboxItem[];
  logs: GameLogEntry[];
  mappingReport: MappingReport;
};

export type SaveGameState = {
  saveId: string;
  name?: string;
  status?: "active" | "archived" | "template";
  createdAt: string;
  updatedAt: string;
  gameState: GameState;
};

export type ServerGameSaveRecord = {
  saveId: string;
  roomId: string | null;
  ownerUserId: string | null;
  activeSeasonId: string;
  activeMatchday: string | number | null;
  gamePhase: GamePhase;
  scenarioMeta?: ScenarioMeta;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ServerGameStatePayload = {
  players: Player[];
  playerBaselines: PlayerBaselineRecord[];
  teams: Team[];
  teamIdentities: TeamIdentity[];
  rosters: RosterEntry[];
  contracts: Contract[];
  transferListings: TransferListing[];
  transferHistory: TransferHistoryEntry[];
  facilities: NonNullable<SeasonState["teamFacilities"]>;
  facilityEvents: NonNullable<SeasonState["facilityEvents"]>;
  progressionEvents: NonNullable<GameState["playerProgressionEvents"]>;
  lineups: NonNullable<SeasonState["lineupDrafts"]>;
  formCards: NonNullable<SeasonState["formCards"]>;
  mutators: {
    source: "lineup_modifiers" | "missing_source";
    lineupModifiers: Array<{
      lineupId: string;
      seasonId: string;
      matchdayId: string;
      teamId: string;
      modifiers: LineupDraftModifiers | null;
    }>;
  };
  matchdayResults: NonNullable<SeasonState["matchdayResults"]>;
  disciplineResults: NonNullable<SeasonState["disciplineResults"]>;
  playerDisciplinePerformances: NonNullable<SeasonState["playerDisciplinePerformances"]>;
  standings: SeasonState["standings"];
  seasonHistory: NonNullable<SeasonState["seasonSnapshots"]>;
  workflowLogs: NonNullable<SeasonState["preSeasonWorkflowLogs"]>;
  roomParticipants: NonNullable<SeasonState["teamControlSettings"]>;
  teamOwnership: NonNullable<SeasonState["teamControlSettings"]>;
  scenarioMeta?: ScenarioMeta;
};

export type ServerActionRequest = {
  roomId: string;
  saveId: string;
  userId: string;
  teamId?: string | null;
  actionType: string;
  payload: Record<string, unknown>;
  confirmToken?: string | null;
  expectedSaveVersion: number;
  idempotencyKey?: string | null;
};

export type ServerActionConflictCode =
  | "save_version_conflict"
  | "action_already_applied"
  | "confirm_token_stale";

export type OlySeedData = {
  teamIdentities: TeamIdentity[];
  teams: Team[];
  disciplines: Discipline[];
  players: Player[];
  rosters: RosterEntry[];
  contracts: Contract[];
  transferListings: TransferListing[];
  transferHistory: TransferHistoryEntry[];
  season: Season;
  matchdays: Matchday[];
  fixtures: Fixture[];
  mappingReport: MappingReport;
};
