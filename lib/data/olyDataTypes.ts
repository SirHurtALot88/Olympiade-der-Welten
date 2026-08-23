import type { SeasonGuvPosten } from "@/lib/finance/season-end-guv";
// Nur ein Typ-Import: zur Laufzeit bleibt davon nichts, der Zirkel ist also keiner.
import type { FoundationSeasonHistoryEntry } from "@/lib/persistence/foundation-season-history-projection";
import type { FoundationFieldRaceProjection } from "@/lib/persistence/foundation-field-race-projection";

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
  // Die Station des SAISONENDES (Training/Ziele, nach der Spielerentwicklung). Hiess bis 0.4.11
  // ebenfalls `preseason_management` — derselbe Name wie der frische Spielaufbau, obwohl es der
  // gegenteilige Zeitpunkt ist. Aus dieser Doppeldeutigkeit sind zwei Fehler entstanden (der
  // Setup-Draft feuerte am Saisonende erneut, Client wie Server). Deshalb ein eigener Name.
  | "season_end_management"
  // Nur noch der FRISCHE Aufbau vor dem allerersten Spieltag. Neue Spiele legt
  // `new-game-setup-service` in `season_active` an; diese Phase tragen nur noch Altstaende.
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
  /**
   * Saison-Id, fuer die die Saisonende-Entwicklung bereits WIRKLICH auf die Attribute geschrieben
   * wurde (verhandlung-/saisonende-Ablauf).
   *
   * GEMELDET: „Kannst du dafuer sorgen, dass nach MD10 bevor man verkaufen kann die
   * Trainingsupgrades der spieler schon durch laufen und die neuen Marktwerte dann verfuegbar
   * sind? erst DANN darf wirklich verkauft werden."
   *
   * Genau das ging vorher nicht: der Schritt „Spielerentwicklung" schaltete nur die Phase weiter
   * („preview_only_no_attribute_writes"), gerechnet wurde erst beim Start der NEUEN Saison — also
   * hinter dem Transferfenster. Man verkaufte zu Marktwerten, die der Spieler schon nicht mehr
   * hatte. Jetzt schreibt der Schritt selbst, und dieser Marker verhindert, dass die Entwicklung
   * beim Saisonstart ein zweites Mal laeuft.
   */
  progressionAppliedForSeasonId?: string | null;
  /**
   * Saison-Id, fuer die die KI-Verkaeufe des Saisonendes bereits gelaufen sind.
   *
   * Derselbe Zweck wie `progressionAppliedForSeasonId` eine Zeile darueber, und aus demselben
   * Grund noetig: der Schritt „Verkaeufe" schreibt jetzt selbst, also muss er sich merken, dass er
   * fertig ist. Ohne den Marker verkauft die KI bei jedem erneuten Durchlauf der Station ein
   * weiteres Mal Spieler — und ein Klick zurueck und wieder vor wuerde Kader leerraeumen.
   */
  aiSeasonEndSellsAppliedForSeasonId?: string | null;
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
  | "sandbox_snapshot"
  /**
   * Der dedizierte, schreibgeschuetzte Spielstand fuer den CI-Gameplay-Smoke
   * (`scripts/ensure-ci-gameplay-smoke-save.ts`).
   *
   * Das Skript benutzte diesen Wert seit jeher, nur stand er nie in der Union. Folge: der Vergleich
   * `save.scenarioMeta?.scenarioType === SMOKE_SCENARIO_TYPE`, mit dem es einen BESTEHENDEN
   * Smoke-Save wiederfinden will, verglich zwei Typen ohne Schnittmenge — er konnte nie wahr werden.
   * Das Skript legte deshalb bei JEDEM CI-Lauf einen neuen Smoke-Save an, statt den vorhandenen
   * wiederzuverwenden. Zur Laufzeit faellt das nicht auf, weil `tsx` nicht typprueft.
   */
  | "gameplay_smoke_readonly";

export type ScenarioMeta = {
  scenarioType: ScenarioType;
  label: string;
  description?: string;
  saveCategory?: "manual" | "autosave" | "pre-deploy" | "pre-season" | "post-season" | "emergency" | "recovery";
  // PAKET 2 (docs/MULTIPLAYER_MODI_1V1_2V2_PLAN.md, E4): "online_1v1"/"online_2v2" ergaenzt, damit
  // ein 1+1-/2+2-Raum sein eigenes `FoundationSaveModePreset` (lib/persistence/foundation-save-mode.ts)
  // ueberhaupt tragen kann. FUND: diese Werte-Liste steht literal an VIER Stellen dupliziert
  // (hier x2, lib/persistence/types.ts, lib/game/new-game-setup-service.ts `NewGamePresetId`,
  // lib/foundation/tabs/foundation-page-types.ts `NewGamePresetId`) statt an einer -- eine
  // bestehende Verletzung der Hausregel "eine Quelle pro Groesse", die NICHT aus diesem Paket
  // stammt. Sie hier zu vereinheitlichen war nicht Teil des Auftrags (die zwei `NewGamePresetId`-
  // Stellen gehoeren zum getrennten Solo-"Neues Spiel"-Wizard-System, siehe Kommentar an
  // `createRoomCoopSave`s Aufruf in room-store.ts) -- nur die zwei fuer Paket 2 tatsaechlich
  // benoetigten Stellen (hier und lib/persistence/types.ts) wurden ergaenzt.
  saveMode?: "solo_1" | "solo_2" | "solo_4" | "online_1v1" | "online_2v2" | "online_4v4" | "custom";
  newGamePresetId?: "solo_1" | "solo_2" | "solo_4" | "online_1v1" | "online_2v2" | "online_4v4" | "custom";
  humanControlledTeamCount?: number;
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
  | "facility"
  | "sponsor";

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
  ctaLabel?: string | null;
  targetView: string;
  targetParams: Record<string, string | number | boolean | null>;
  status: GameInboxStatus;
  createdAt: string;
  source: string;
};

export type AiPreseasonAutomationRunRecord = {
  runId: string;
  seasonId: string;
  status: "running" | "completed" | "failed" | "skipped";
  mode: "setup_draft" | "season_market" | "none";
  startedAt: string;
  completedAt?: string | null;
  aiTeamsTotal: number;
  aiTeamsCompleted: number;
  managerActionsApplied: number;
  transferBuysApplied: number;
  transferSellsApplied: number;
  warnings: string[];
  blockingReasons: string[];
  /**
   * Optionale, kompakte Kategorie-Aufstellung (angewandt vs. blockiert) der
   * angewandten AI-Manager-Aktionen, damit ein Diagnose-UI angewandt/blockiert
   * pro Kategorie ("Training", "Gebäude", …) zeigen kann, ohne aus den rohen
   * `blockingReasons` neu abzuleiten. Rückwärtskompatibel optional: alte Records
   * ohne dieses Feld rendern weiterhin (das UI leitet dann einen Fallback ab).
   */
  actionBreakdown?: { category: string; applied: number; blocked: number }[];
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
  inactiveSeasons?: number;
  reasons: PlayerMoraleReason[];
  contractIntent: PlayerMoraleContractIntent;
};

export type PlayerRelationshipEventRecord = {
  eventId: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  reason: string;
  delta: number;
  severity: "positive" | "neutral" | "negative";
  createdAt: string;
  source: "promised_role_morale";
};

export type PlayerDemandStatus = "open" | "fulfilled" | "at_risk" | "failed";

export type PlayerDemandRecord = {
  demandId: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  type: "discipline_start" | "captaincy" | "appearances" | "facility" | "role" | "training_mode";
  label: string;
  detail: string;
  targetDisciplineId?: string | null;
  targetDisciplineName?: string | null;
  targetCategory?: DisciplineCategory | null;
  targetValue?: number | string | null;
  currentValue?: number | string | null;
  status: PlayerDemandStatus;
  moraleReward: number;
  moralePenalty: number;
  priority: "low" | "medium" | "high";
  source: string;
};

export type TeamCaptainRecord = {
  seasonId: string;
  teamId: string;
  playerId: string;
  playerName: string;
  leadershipScore: number;
  style: "leader" | "inspirer" | "enforcer" | "operator" | "wildcard";
  effects: {
    moraleBuffer: number;
    rivalryPressureReductionPct: number;
    teamPowerModifierPct: number;
    conflictSoftenChancePct: number;
  };
  traitSignals: string[];
  source: string;
};

export type StandingRecord = {
  points: number;
  rank?: number | null;
  /**
   * Idempotency baseline for standings-apply: the team's points BEFORE `matchdayBaselineId`'s delta
   * was applied, plus which matchday that baseline belongs to. On a `forceReplace` re-apply of the
   * same matchday, the projected points are recomputed from this baseline (baseline + delta) instead
   * of the already-incremented live `points`, so the delta is not double-counted. Undefined until a
   * matchday has been applied to this record.
   */
  matchdayBaselinePoints?: number | null;
  matchdayBaselineId?: string | null;
  cashFc?: number | null;
  startplatz?: number | null;
  rankDiff?: number | null;
  sponsorBasis?: number | null;
  sponsorRank?: number | null;
  sponsorSeason?: number | null;
  sponsorTotal?: number | null;
  guv?: number | null;
  /**
   * Aufschlüsselung der GuV in ihre Posten (`lib/finance/season-end-guv.ts`) — VOLLSTÄNDIG, auch die
   * Posten mit 0. Wird bei der Saisonende-Buchung mitgeschrieben, damit der Hover die Zusammensetzung
   * auch dann zeigen kann, wenn eine Ansicht aus dem gespeicherten Stand statt aus dem Live-Feed liest.
   * Fehlt das Feld (ältere Spielstände), fällt der Hover auf die schmale Herleitung zurück.
   */
  guvPosten?: SeasonGuvPosten[] | null;
  cashTotal?: number | null;
};

/**
 * Fortgeschriebener Beliebtheits-KPI eines Teams (TEIL A). Anders als der frühere stateless,
 * größen-korrelierte KPI wird dieser Wert Saison für Saison FORTGESCHRIEBEN (siehe
 * `advanceTeamBeliebtheitForSeasonTransition` in lib/economy/team-beliebtheit.ts):
 *   value[t] = clamp(REVERT*1.0 + (1-REVERT)*value[t-1] + GAIN*spotlightDelta[t], 0.5, 1.5)
 * `value` bleibt in [0.5, 1.5], neutral 1.0 (= Liga-Durchschnitt), und speist weiter die
 * Arena-Kopplung (facility-season-end-service liest `.value` als arenaPopularityFactor).
 * `spotlightDelta` ist LIGA-ZENTRIERT um 0 (Σ über die Liga ≈ 0) und aus überwiegend
 * größen-neutralen End-of-Season-Signalen zusammengesetzt (siehe `components`).
 */
export type TeamBeliebtheitRecord = {
  /** Fortgeschriebener Faktor, geclampt auf [0.5, 1.5]; 1.0 = Liga-Durchschnitt. */
  value: number;
  /** Liga-zentrierter Spotlight-Impuls dieser Saison (Σ über die Liga ≈ 0). */
  spotlightDelta: number;
  /** Bereits gewichtete, liga-zentrierte Einzelbeiträge zum spotlightDelta (Summe = spotlightDelta). */
  components: {
    /** Rang-Überperformance: expectedRank − finalRank (größen-neutral). */
    overperf: number;
    /** Bracket-Helden: Anteil Kader mit bracketScore≈1 (größen-neutral). */
    bracket: number;
    /** Upsets: zugelassene/erzielte Aufholjagden schwächer erwarteter Teams. */
    upset: number;
    /** Saison-Sprung: finalRank vs. bisher bester/mittlerer historischer Rang. */
    jump: number;
    /** Disziplin-Spotlight: Anteil Kader mit rankInDiscipline<=3 pro Kadergröße. */
    discipline: number;
    /** FanFavorites + Kosmetik-Trait-Term (bestehende weiche Effekte). */
    fanFavorites: number;
    /**
     * TEIL B — erfüllte Sponsor-Bonusziele mit spotlightBonus (liga-zentriert). Rückwärtskompatibel
     * optional: fehlt der Beitrag (Alt-Saves, keine Ziele), zählt er als 0.
     */
    objective?: number;
  };
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
    /** Preisgeld-Tabelle ist Benchmark-only; kein Cash-Payout auf Team-Wallets. */
    benchmarkOnly?: boolean;
    cashPayoutApplied?: boolean;
  };
  createdAt: string;
};

export type ObjectiveRewardApplyLogRecord = {
  id: string;
  saveId: string;
  seasonId: string;
  action: "apply";
  payload: {
    totalCashDelta: number;
    totalBoardConfidenceDelta: number;
    appliedTeams: number;
    /**
     * Cash-Wirkung JE TEAM, so wie sie gebucht wurde.
     *
     * Vorher trug der Log nur Summen. Wer nachrechnen wollte, wer wie viel bekommen hat, musste die
     * Abrechnung aus dem Spielstand NEU herleiten — und traf dabei nicht mehr denselben Zustand:
     * die Ziele werden am Saisonende NACH Sponsor, Apron und Gebäuden gebucht, also gegen einen
     * anderen Cash-Stand als den, den ein Nachrechner vor dem Apply sieht. Genau daran ist die
     * Cashflow-Invariante aufgelaufen. Der Log nennt die Zahlen jetzt selbst.
     *
     * Ältere Spielstände führen das Feld nicht; fehlend heisst „nicht protokolliert", nicht „null".
     */
    cashDeltaByTeamId?: Record<string, number>;
  };
  createdAt: string;
};

/**
 * Audit R2/V7: Audit-Eintrag für Notfall-Kasse-Aufstockungen, die die KI-Preseason-Roster-Reparatur an
 * Teams unter dem Cash-Floor vergibt (damit sie den Pflicht-Mindestkader kaufen können). Dieses Geld
 * entsteht aus dem Nichts — ohne diesen Ledger-Eintrag wäre die Injektion unsichtbar/unauditierbar und die
 * Wert-Erhaltung (Cash wird nicht aus dem Nichts geschaffen) verschleiert. `cashBefore`/`cashAfter` machen
 * den erzeugten Betrag (`amount = cashAfter - cashBefore`) nachvollziehbar.
 */
export type AiEmergencyCashInjectionRecord = {
  id: string;
  saveId: string;
  seasonId: string;
  teamId: string;
  reason: "preseason_roster_repair_cash_floor";
  cashBefore: number;
  cashAfter: number;
  amount: number;
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
  source: "manual_xp_spend_preview" | "season_end_regression" | "organic_season_progression";
  /**
   * Herkunft der Änderung je Attribut, wie sie die organische Progression berechnet hat
   * (`OrganicProgressionAttributeBreakdown`). Bisher wurde nur `fromValue`/`toValue`
   * festgehalten — in der Trainingshistorie stand danach eine Zahl ohne Erklärung, und ein
   * Zuwachs aus Spieltags-Leistungen sah aus wie ein Erfolg des Trainingsplans.
   *
   * Optional, weil die Felder erst ab dieser Version geschrieben werden: Für Saisons, die
   * vorher abgeschlossen wurden, gibt es die Aufteilung nicht mehr — sie ließe sich nur
   * schätzen. Die Historie fällt dort auf die Saison-Summen aus `organicMeta` zurück.
   * Nur bei `source: "organic_season_progression"` gesetzt.
   */
  originTraining?: number;
  originSpillover?: number;
  originPerformance?: number;
  originRegression?: number;
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
  source: "manual_season_end_xp_spend" | "organic_season_progression";
  organicMeta?: {
    trainingClass: string;
    secondaryTrainingClass?: string | null;
    trainingMode: "leicht" | "mittel" | "hart";
    classBefore: string;
    classAfter: string;
    netSetpoints: number;
    trainingSetpoints: number;
    performanceSetpoints: number;
    traitModifierPct?: number;
  };
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
  seasonZeroEconomy?: {
    source: "season_0_computed" | "season_0_backfilled" | "season_0_reconstructed";
    marketValue: number | null;
    salary: number | null;
    purchasePrice: number | null;
    salaryMarketValue: number | null;
    baseMarketValue: number | null;
    salaryBase: number | null;
    traitPercentSum: number | null;
    marketValueSource: string;
    salarySource: string;
    computedAt: string;
  };
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

/**
 * Eine gespeicherte Konjunktur-Reihe, die NICHT zu dem passt, was der Seed aus
 * `(saveId, seasonId)` errechnet.
 *
 * WARUM DAS AUFGESCHRIEBEN WIRD, statt es stillschweigend zu überschreiben: der Faktor entscheidet
 * über Sponsorenzahlungen und die Apron-Drosselung. Wer ihn beim Laden austauscht, ändert
 * rückwirkend die Grundlage von Geld, das schon geflossen ist — und niemand erführe davon. Der
 * Wächter lässt die gespeicherte Reihe deshalb STEHEN und schreibt die Abweichung auf.
 */
export type SeasonEconomyFactorGuardEvent = {
  eventId: string;
  seasonId: string;
  reason: "season_economy_factor_mismatch";
  /** Die Faktoren, die im Spielstand stehen — und mit denen gerechnet wurde. */
  storedFactors: number[];
  /** Was der Seed aus (saveId, seasonId) heute ergäbe. */
  seededFactors: number[];
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

export type TeamGeneralManagerArchetype =
  | "bargain_hunter"
  | "talent_builder"
  | "star_chaser"
  | "depth_spammer"
  | "elite_curator"
  | "facility_architect"
  | "risk_gambler"
  | "culture_keeper"
  | "rivalry_hawk"
  | "systems_tinkerer";

export type TeamGeneralManagerProfile = {
  gmId: string;
  name: string;
  archetype: TeamGeneralManagerArchetype;
  title: string;
  description: string;
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
  playerOptDelta: -2 | -1 | 0 | 1 | 2;
  preferredTraits: string[];
  facilityPriorities: string[];
  marketDoctrine: string;
  lineupDoctrine: string;
  bias: Partial<TeamStrategyBias>;
};

export type TeamGeneralManagerAssignment = {
  teamId: string;
  gmId: string;
  assignedSeasonId: string;
  influencePct: number;
  source: "auto_generated" | "auto_wildcard" | "human_slot" | "board_replacement";
  previousGmId?: string | null;
  dismissalReason?: "low_board_confidence" | "high_board_pressure" | null;
};

export type PlayerAttributeSheetStats = {
  height?: number | null;
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

/**
 * Distribution "silhouette" for the generator's 4 axes (POW/SPE/MEN/SOC).
 * Orthogonal to `roleIntent`/`preferredArchetype` (which decide flavour and
 * WHICH axis peaks): a silhouette decides the SHAPE of the descending-axis
 * distribution while the peak-weighted Current Ability is held constant.
 * `null`/absent → no distribution shaping (legacy behaviour, unchanged).
 */
export type PlayerGeneratorSilhouette = "allrounder" | "duo" | "specialist" | "rohdiamant";

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
  /** Optional axis-distribution silhouette; `null`/absent → no shaping. */
  silhouette?: PlayerGeneratorSilhouette | null;
  targetTeamId?: string | null;
  contractMode?: "value" | "balanced" | "front_loaded" | "back_loaded" | "prove_it" | null;
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
  height?: number | null;
};

export type PlayerGeneratorAttributeName = Exclude<keyof PlayerGeneratorAttributes, "height">;

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

export type PlayerGeneratorMarketValueStatus = "ready" | "missing_market_value_engine" | "heuristic_estimate";

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
  marketValueEngine: "ready" | "blocked" | "incomplete_source" | "heuristic";
  salaryEngine: "ready" | "missing_market_value_input" | "blocked";
  classEngine: "ready" | "heuristic" | "blocked";
  potentialEngine: "ready" | "missing_progression_source";
};

export type PlayerGeneratorDraftStatusView = {
  ovr: "draft_preview";
  pps: "draft_preview";
};

export type PlayerGeneratorSaveStatusView = {
  save: "draft_only";
  // Phase 2: "enabled" when `commitReasons` is empty, i.e. the draft has a
  // real ovr/marketValue/salary and no hard validation block. Prior to
  // Phase 2 this was hardcoded "disabled" (the commit path did not exist
  // yet) — `commit_path_not_ready` below is kept only so old persisted
  // drafts/fixtures created before Phase 2 still satisfy the type.
  commit: "enabled" | "disabled";
  commitReasons: Array<
    | "market_value_engine_blocked"
    | "salary_engine_blocked"
    | "salary_engine_waits_for_market_value"
    | "draft_validation_blocked"
    | "commit_path_not_ready"
  >;
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
    portraitUrl?: string | null;
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
    disciplineOutlook?: Array<{
      disciplineId: string;
      disciplineName: string;
      rating: number;
      category: DisciplineCategory | string;
      bestSlotLabel: string | null;
      bestSlotScore: number | null;
      keyAttributes: PlayerGeneratorAttributeName[];
    }>;
    ovr: number | null;
    pps: number | null;
    potential: number | null;
    projectedRole?: "star" | "starter" | "rotation" | "prospect" | "flier";
    captaincyScore?: number | null;
    teamFit?: {
      teamId: string | null;
      teamName: string | null;
      score: number | null;
      axisFit: number | null;
      gmFit: number | null;
      traitFit: number | null;
      rosterNeed: "thin" | "healthy" | "crowded" | "unknown";
      reasons: string[];
      warnings: string[];
    };
    economyProjection?: {
      marketValueEstimate: number | null;
      salaryEstimate: number | null;
      valueRatio: number | null;
      salaryPressure: "low" | "medium" | "high" | "unknown";
      contractMode: "value" | "balanced" | "front_loaded" | "back_loaded" | "prove_it";
      recommendedContractLength: number | null;
      salarySchedule: Array<{ yearIndex: number; label: string; salary: number }>;
      warnings: string[];
    };
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
      /**
       * The steering target `buildAxisTargets()` aimed for (post role/archetype
       * bias + randomness jitter, pre attribute-silhouette shaping), so the
       * requested-vs-achieved drift against `generated.axes` is legible. Null
       * when the draft's attributes were recalculated from a manual edit and no
       * fresh target was generated for this pass (see recalculatePlayerGeneratorDraft).
       */
      axisTargets: { pow: number; spe: number; men: number; soc: number } | null;
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
  trainingClass?: string | null;
  /**
   * Per-matchday training accumulation for the current season (anti-cheese). Instead of a single
   * season-end training budget derived from whatever `trainingMode` happens to be set at season end,
   * each resolved matchday records the mode that was active for that matchday. The season-end organic
   * progression then derives its base training budget + performance-weight from the EXACT per-mode
   * matchday counts (see `resolveSeasonTrainingAccumulatorInputs`). Additive/optional: absent/null →
   * legacy behaviour (mode-at-season-end). Reset to null every preseason baseline pass.
   */
  seasonTrainingAccumulator?: {
    seasonId: string;
    matchdaysCounted: number;
    modeByMatchday: Record<string, "leicht" | "mittel" | "hart">;
    accumulatedTrainingFatigue: number;
    updatedAt: string;
  } | null;
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
  classHistory?: Array<{
    seasonId: string;
    className: string;
    previousClassName?: string | null;
    reason: "seed" | "organic_progression" | "manual";
    createdAt: string;
  }>;
  injuryHistory?: PlayerInjuryHistoryRecord[];
  lastOrganicProgression?: {
    seasonId: string;
    classBefore: string;
    classAfter: string;
    trainingClass: string;
    secondaryTrainingClass?: string | null;
    trainingMode: "leicht" | "mittel" | "hart";
    traitModifierPct: number;
    facilityModifierPct: number;
    marketValuePressureTotal: number;
    trainingSetpoints: number;
    appliedTrainingSetpoints?: number;
    performanceSetpoints: number;
    appliedPerformanceSetpoints?: number;
    regressionCombinedTotal?: number;
    netSetpoints: number;
    fatigueLoad: number;
    topGains: Array<{ attribute: PlayerGeneratorAttributeName; delta: number }>;
    topLosses: Array<{ attribute: PlayerGeneratorAttributeName; delta: number }>;
    attributeDeltas: Partial<Record<PlayerGeneratorAttributeName, number>>;
    createdAt: string;
  } | null;
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
  /**
   * ALTFELD — NICHT mehr als Potenzial-Quelle lesen. Wird nur einmalig beim Import
   * (`character-import-service`: max(rating, Top-3-Ø) + 4) bzw. beim Generator-Commit
   * gesetzt und danach nie gepflegt. Das Saisonende-Modell driftet ausschließlich
   * `playerPotential[].hiddenPotentialScore`; am Live-Spielstand (2026-08, n=2984) wichen
   * dadurch ALLE Spieler ab (Median +16,1 Punkte, hiddenPotentialScore fast immer höher).
   * Die eine gültige Quelle ist `gameState.playerPotential[].hiddenPotentialScore`,
   * aufgelöst über `resolvePlayerPotentialScoreFromGameState`
   * (lib/scouting/player-attribute-ceiling-service.ts). Das Feld bleibt nur für
   * Persistenz-Roundtrips und Alt-Saves ohne Records bestehen.
   */
  potential: number;
};

export type PlayerPotentialBand = "low" | "medium" | "high" | "elite" | "unknown";
export type PlayerPotentialSource = "generated" | "imported" | "scouted" | "missing";

export type PlayerPotentialSeasonSnapshot = {
  seasonId: string;
  hiddenPotentialScore: number;
  overallStars: number;
  byAxis: {
    pow: number;
    spe: number;
    men: number;
    soc: number;
  };
};

export type PlayerPotentialRecord = {
  playerId: string;
  potentialBand: PlayerPotentialBand;
  hiddenPotentialScore?: number;
  hiddenPotentialCeilingByAxis?: {
    pow: number;
    spe: number;
    men: number;
    soc: number;
  };
  hiddenPotentialOverallStars?: number;
  hiddenAttributeCeiling?: Partial<Record<PlayerGeneratorAttributeName, number>>;
  lastSeasonSnapshot?: PlayerPotentialSeasonSnapshot;
  revealedPotentialRange?: {
    min: number;
    max: number;
  };
  confidence: number;
  source: PlayerPotentialSource;
  /**
   * Version des Potenzial-Generator-Modells, mit dem hiddenPotentialScore erzeugt
   * wurde (siehe POTENTIAL_MODEL_VERSION). Fehlt/älter → Save wird beim Laden einmalig
   * auf das aktuelle Modell migriert.
   */
  modelVersion?: number;
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
  /**
   * KREDIT-BUDGET, das dieses Team anderen Teams zur Verfuegung stellt (Mio).
   *
   * CHRIS: „wie kann man als spieler kredite an AI Teams anbieten? die picken ja direkt ihre
   * spieler das heißt wenn ich z.B. C-C spiele wäre es gut wenn das geht, die sollen damit ihr geld
   * verdienen! … sonst muss es eine möglichkeit geben, ein budget für kredite vorab festzulegen an
   * dem andere teams sich bedienen können."
   *
   * Nur fuer von Hand gefuehrte Teams von Belang: KI-Teams entscheiden selbst und stellen ihr Geld
   * ohnehin zur Verfuegung. Fuer ein manuell gefuehrtes Team ist ein Team-Kredit dagegen eine
   * Entscheidung ueber das Geld des Spielers — ohne gesetztes Budget taucht es gar nicht erst als
   * Geldgeber auf. `null`/`0` heisst also „verleihe nichts"; das ist der Startwert.
   *
   * Gegenzaehler ist die bereits verliehene Summe: es kann nie mehr als dieses Budget gleichzeitig
   * draussen sein.
   */
  lendingBudget?: number | null;
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

export type TeamPowerCategory = "power" | "speed" | "mental" | "social" | "flex";
export type TeamPowerEffectType = "self_boost" | "support_boost" | "snipe_debuff" | "field_debuff" | "rivalry_debuff";
export type TeamPowerTargetMode = "self" | "single_top" | "single_rival" | "single_rank_neighbor" | "rank_band";
export type TeamPowerConditionalTrigger = "rival_top8_discipline" | "target_top8_discipline";
export type TeamPowerAttributeTag =
  | "power"
  | "health"
  | "determination"
  | "stamina"
  | "speed"
  | "dexterity"
  | "awareness"
  | "intelligence"
  | "will"
  | "charisma"
  | "spirit"
  | "torment";

export type TeamPowerRecord = {
  id: string;
  saveId: string;
  seasonId: string;
  teamId: string;
  label: string;
  description: string;
  category: TeamPowerCategory;
  effectType: TeamPowerEffectType;
  targetMode: TeamPowerTargetMode;
  targetLimit: number;
  conditionalBonusPct?: number;
  conditionalTrigger?: TeamPowerConditionalTrigger;
  conditionalDescription?: string;
  source: "team_identity" | "facility";
  sourceRank?: number;
  sourceFacilityId?: string;
  modifier: number;
  positiveAttributeTags?: TeamPowerAttributeTag[];
  negativeAttributeTag?: TeamPowerAttributeTag | null;
  chargesTotal: number;
  selectedForSeason: boolean;
  isPassive?: boolean;
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

/**
 * Ein vom Sponsor geliehenes Gebäude. `zustandPct` ist die Vertragsvariable: derselbe Gebäudetyp
 * auf derselben Stufe kann neu oder gebraucht verliehen werden und ist dann verschieden wertvoll.
 * `ruht` schaltet die Leihe ab, wenn die Rangmarke des Vertrags gerissen ist — der Cash-Verzicht
 * laeuft dabei weiter.
 */
/**
 * DER LEIH-BLOCK EINER SPONSOR-KARTE — bei der Erzeugung eingefroren, bei der Unterschrift 1:1 in
 * den Vertrag kopiert. Fehlt er, ist es eine reine Cash-Karte.
 *
 * Strukturell (keine Importe aus `lib/sponsor`) gehalten, damit der Datentyp nicht an der
 * Rechenschicht haengt; gebaut wird er ausschliesslich von `verteileLeihgabenAufSlate`.
 */
export type SponsorOfferLeihe = {
  facilityId: string;
  /** ASCII-Schreibweise der Rarität, wie in `lib/sponsor/sponsor-leihe.ts`. */
  raritaet: "gewoehnlich" | "magisch" | "selten" | "legendaer";
  /** Umwandlungskurs dieser Rarität (1,4 / 1,8 / 2,3 / 3,0). */
  kurs: number;
  /** Gebäudestufe je Vertragsjahr. */
  stufenreihe: number[];
  /** Cash-Verzicht je Vertragsjahr — steckt bereits in der Leiter (E1), ist KEINE Abzugszeile. */
  verzichtJeSaison: number[];
  /** Was der Sponsor je Vertragsjahr bereitstellt — Anrechnungsbasis der Übernahme. */
  leihwertJeSaison: number[];
  /** Zustand des Gebäudes bei Übergabe (0..100) — die Vertragsvariable aus E7. */
  startZustandPct: number;
  /**
   * DIE RANGMARKE: bis zu welchem Tabellenplatz das geliehene Gebäude wirkt. Bei Unterschrift
   * eingefroren, relativ zum Startblock, nie darüber (Abschnitt 4.4). Darunter **ruht** das
   * Gebäude — der Cash-Verzicht läuft trotzdem weiter, das ist der Preis des Risikos.
   *
   * Fehlt sie, wirkt die Leihe unbedingt (Angebote aus der Zeit vor Schritt 6).
   */
  rangmarke?: number;
  /** Wie hart die Marke gesetzt ist: `hart` = eigener Startblock, `mild` = ein Block darunter. */
  rangmarkenHaerte?: "mild" | "hart";
  /** Selbstbaukosten der zuletzt erreichten Stufe — Grundlage des Übernahmepreises. */
  katalogkostenEndstufe: number;
};

export type SponsorLeihgabeRecord = {
  facilityId: string;
  stufe: number;
  zustandPct: number;
  ruht?: boolean;
  /** Der Vertrag, aus dem die Leihe stammt — fuer Anzeige und Aufraeumen beim Vertragsende. */
  seasonId: string;
  offerId?: string;
};

/**
 * DAS ANGEBOT AM VERTRAGSENDE: das geliehene Gebäude behalten, zum Preis aus
 * `berechneUebernahmepreis` (Katalogkosten − bereitgestellter Leihwert − geerbte Reparatur).
 *
 * Es entsteht beim Saisonwechsel, wenn ein Sponsorvertrag mit Leihe auslaeuft, und verschwindet,
 * sobald das Team zugreift oder ablehnt. Nimmt es niemand an, faellt das Gebäude ersatzlos weg —
 * das Team steht wieder auf seinem eigenen Bestand.
 */
export type SponsorUebernahmeAngebot = {
  teamId: string;
  /** Saison, in der das Angebot auf dem Tisch liegt. */
  seasonId: string;
  facilityId: string;
  /** Die zuletzt geliehene Stufe — die bekommt man, keine andere. */
  stufe: number;
  /** Zustand bei der Uebergabe. Nach drei Saisons Verschleiss ist das der halbe Preisunterschied. */
  zustandPct: number;
  preis: number;
  /** Der Vertrag, aus dem die Leihe stammte. */
  offerId?: string;
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
    | "manual_facility_downgrade"
    | "facility_upkeep_paid"
    | "facility_upkeep_unpaid"
    | "facility_income_collected"
    | "facility_condition_decay"
    | "manual_facility_maintenance";
  previousConditionPct?: number;
  nextConditionPct?: number;
};

export type TeamSeasonObjectiveCategory =
  | "sport"
  | "finance"
  | "transfer"
  | "roster"
  | "facility"
  | "development"
  | "morale"
  | "player"
  | "sponsor";

/** @deprecated Legacy star-tier archetype. Superseded by SponsorCurveShape + SponsorRarity. Kept only for
 * back-compat reading of old saves during migration; the active model no longer assigns it. */
export type SponsorArchetype = "security" | "performance" | "identity";

/**
 * Rarity replaces the old 1..5 star tier as the Etat (total-payout) dial. Bounded spread (see
 * SPONSOR_RARITIES in lib/sponsor/sponsor-curve-shapes.ts): gewöhnlich (lowest) → legendär (highest),
 * factors 0.90 / 1.00 / 1.07 / 1.15 — salary-anchored, so it never dwarfs a team's wage bill.
 */
export type SponsorRarity = "gewöhnlich" | "magisch" | "selten" | "legendär";

/**
 * NUR NOCH LESEN. Thematische Familie einer alten Kurvenform. Die Angebotserzeugung wuerfelt seit dem
 * Aufraeumen des Sponsor-Cutovers die sechs Modellkurven (siehe SPONSOR_V2_CURVES) und kennt keine
 * Familien mehr; dieser Typ existiert fuer die Anzeige und Abrechnung von Altvertraegen.
 */
export type SponsorCurveFamily = "titel" | "europa" | "stetig" | "aufstieg" | "sicherheit";

/**
 * Die Kurvenform beschreibt, WO ueber die Endtabelle (Platz 1..32) das feste Etat eines Sponsors sitzt.
 *
 * War zwischen dem V2-Cutover und dem Ligaleiter-Umbau (sponsor-liga-leiter.ts) nur noch ein
 * Anzeige-Etikett ohne Wirkung auf die Auszahlung. Seit dem Umbau ist sie WIEDER ein Erzeugungs-Feld:
 * jedes Angebot zieht eine der 11 Formen (sponsor-tier-pool.ts), und `sponsorKurvenLeiter`
 * (sponsor-liga-leiter.ts) normiert sie auf denselben Erwartungswert wie die neutrale Ligaleiter — die
 * Form entscheidet also NUR NOCH, wo das Geld liegt, nicht wie viel es insgesamt ist. Die 11
 * `reference`-Arrays dazu stehen in lib/sponsor/sponsor-curve-shapes.ts.
 */
export type SponsorCurveShape =
  | "titeljaeger"
  | "meisterschale"
  | "koenigsklasse"
  | "europapokal"
  | "conference"
  | "stetig"
  | "mittelfeld"
  | "aufsteiger"
  | "konsolidierung"
  | "sicherheit"
  | "klassenerhalt";

/**
 * `improvement` (Tabellenziel) und `overperformance` (Ueberperformance) werden NICHT MEHR ERZEUGT — die
 * beiden Module gehoerten zum alten Sponsorsystem und sind aus der Angebotserzeugung entfernt. Sie
 * bleiben Teil des Typs, weil Vertraege und Angebote in bestehenden Spielstaenden sie tragen und
 * Anzeige, Evaluator und Abrechnung sie weiter verstehen muessen. Wer sie wieder BAUT, bricht
 * tests/sponsor-v1-erzeugung-tot.test.ts.
 */
export type SponsorOfferComponentKind = "base" | "rank" | "improvement" | "special" | "overperformance";

/**
 * Eine Stufe eines mehrstufigen Sonderziels (TEIL B). `threshold` ist die (aufsteigend sortierte)
 * Mindest-Metrik, ab der die Stufe erreicht ist; `fraction` der Anteil des `rewardCash`, der bei dieser
 * Stufe ausgezahlt wird (z. B. 0.4 / 0.7 / 1.0 für 40/70/100 %). `label` ist die UI-Beschriftung der Stufe.
 */
export type SponsorObjectiveStage = {
  threshold: number;
  fraction: number;
  label: string;
};

export type SponsorOfferComponent = {
  componentId: string;
  kind: SponsorOfferComponentKind;
  label: string;
  targetValue: number | string;
  rewardCash: number;
  penaltyCash?: number;
  specialKey?: string | null;
  /**
   * TEIL B — mehrstufiges Sonderziel: anteilige Auszahlung je erreichter Stufe. Rückwärtskompatibel
   * optional: fehlt `stages`, bleibt das Sonderziel binär (Fraction 0 oder 1 über den bestehenden
   * Evaluator-Pfad). Stufen sind aufsteigend nach `threshold` zu lesen; der Evaluator liefert die höchste
   * erreichte Stufen-Fraction, die Settlement zahlt `rewardCash * fraction`.
   */
  stages?: SponsorObjectiveStage[];
  /**
   * TEIL B — Beliebtheits-Impuls (Spotlight) bei Erfüllung. Roh-Magnitude (grob 0..1), die als
   * ZUSÄTZLICHES, LIGA-ZENTRIERTES Signal in die Beliebtheits-Fortschreibung der Folge-Saison einfließt
   * (Σ über die Liga ≈ 0). Skaliert mit der erreichten Stufen-Fraction. Rückwärtskompatibel optional.
   */
  spotlightBonus?: number;
  /**
   * NUR NOCH LESEN (Altvertraege): beim SIGNIEREN eingefrorene Rate für lineare, gedeckelte Module:
   * - `kind: "overperformance"` zahlt `min(rewardCash, ratePerUnitC × max(0, targetValue − finalRank))`,
   *   wobei `targetValue` der eingefrorene Erwartungsrang und `rewardCash` der Cap ist.
   * - `kind: "improvement"` (neuer per-Platz-Modus) zahlt `min(rewardCash, ratePerUnitC × max(0, startRank − finalRank))`.
   * Fehlt `ratePerUnitC`, gilt der Legacy-Binär-Pfad (Improvement: rewardCash bei ≥ targetValue Plätzen).
   */
  ratePerUnitC?: number;
  /** P3 — Kappungsgrenze in Plätzen für die per-Einheit-Module (max. vergütete Ränge/Plätze). */
  maxUnits?: number;
};

export type SponsorDemandProfile = "safe" | "balanced" | "ambitious" | "elite";

export type SponsorTermSeasons = 1 | 2 | 3;

export type SponsorNegotiationProfile = "safe" | "balanced" | "ambitious";

export type SponsorEventType = "activation_bonus" | "clause_trigger" | "partner_conflict";

export type SponsorEventRecord = {
  eventId: string;
  saveId: string;
  seasonId: string;
  teamId: string;
  matchday: number;
  eventType: SponsorEventType;
  sponsorName: string;
  cashDelta: number;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
  message: string;
};

/**
 * SPONSORSYSTEM V3 — die bei Unterschrift eingefrorenen Konditionen (Sponsor-Ligaleiter: Sockel nach
 * Startrang + Wertungstopf nach Endrang, seit dem Ligaleiter-Umbau).
 *
 * `rankLadder[finalRank - 1]` ist die FERTIG GETILTETE Leiter `L(f) = M(f) + beta·(M(f) − A)` — die
 * Auszahlung vor Untergrenze und Sonderziel. `baseLadder` ist dieselbe Leiter OHNE Tilt — beim
 * Live-Pfad die geshapete Ligaleiter (`sponsorKurvenLeiter`, sponsor-liga-leiter.ts), bei aus der
 * Migration gehobenen Altvertraegen weiterhin die reine Preisgeld-Benchmark; sie steht mit im
 * Vertrag, damit Anzeige und Abrechnung zeigen koennen, WOVON die gewaehlte Karte abweicht, ohne die
 * Liga-Groessen des Unterschriftszeitpunkts noch einmal zu rekonstruieren.
 *
 * Die vollstaendige Auszahlung liefert `sponsorV3Settle` in lib/sponsor/sponsor-v3-model.ts.
 */
export type SponsorV3ContractTermsRecord = {
  version: 3;
  rankLadder: number[];
  baseLadder: number[];
  anchor: number;
  tilt: number;
  cardKey: string;
  cardName: string;
  rarity: string;
  startRank: number;
  goalKey: string | null;
  goalP: number;
  goalSize: number;
  salaryFactor: number;
  floor: number;
  /** Kurvenform, aus der `baseLadder` gebaut wurde — nur Anzeige, siehe SponsorCurveShape. */
  curveShape?: SponsorCurveShape;
  /**
   * V4-Zielachse: wofuer dieser Sponsor zahlt, gemessen gegen die bei Angebotserzeugung
   * eingefrorene eigene Ausgangslage. Fehlt bei der Basis-Karte und bei Altvertraegen.
   */
  axis?: { key: string; baseline: number; scale: number; offset: number };
  /**
   * ENTFALLEN: `advance` (V4-Vorschuss, bei Unterschrift ausgezahlt und am Saisonende samt Gebuehr
   * verrechnet). Sponsorgeld flieszt jetzt ausnahmslos am Saisonende — Begruendung in
   * sponsor-v3-model.ts. Das Feld wird BEWUSST nicht neu deklariert: gespeicherte Vertraege aus
   * laufenden Spielen tragen es noch, aber keine Rechenstelle liest es mehr, und ein Typ, der es
   * weiter kennt, wuerde genau dazu einladen.
   */
  /**
   * Cash-Verzicht der Gebäude-Karte (E1), der in dieser Leiter BEREITS steckt. Dokumentarisch —
   * und die Grundlage dafür, dass der Mehrjahres-Roll ihn beim Neubau der Leiter wieder abzieht.
   * Fehlt bei reinen Cash-Karten und bei Altverträgen.
   */
  leihVerzicht?: number;
};

/**
 * LEGACY-FELD: die eingefrorenen Konditionen des abgeloesten V2-Modells, wie sie in Spielstaenden von
 * vor dem V3-Umbau stehen. Sie werden NICHT mehr gerechnet — die einmalige, versionierte Migration
 * (`lib/sponsor/sponsor-v3-migration.ts`) ersetzt sie bei jedem noch nicht abgerechneten Vertrag
 * durch die V3-Basisleiter. Der Typ bleibt nur, damit das Lesen alter Saves typisiert bleibt.
 */
export type SponsorLegacyV2TermsRecord = {
  version: 2;
  rankLadder?: number[];
  rarity?: string;
  goalKey?: string | null;
  [key: string]: unknown;
};

export type SponsorOffer = {
  offerId: string;
  seasonId: string;
  teamId: string;
  archetype: SponsorArchetype;
  /**
   * WIEDER EIN ERZEUGUNGS-FELD (Sponsor-Ligaleiter, sponsor-liga-leiter.ts): die Kurvenform bestimmt,
   * WO auf der Sockel+Wertungstopf-Leiter dieses Angebot sein Geld hat — `sponsorKurvenLeiter` liest
   * sie beim Bauen der `sponsorV3`-Konditionen. War zwischenzeitlich (V2/V3-Cutover bis zu diesem
   * Umbau) nur noch ein Anzeige-Feld an Alt-Angeboten; optional bleibt sie trotzdem, weil sehr alte
   * Spielstaende sie erst beim Laden ueber `normalizeLegacySponsors` (save-repository.ts) bekommen.
   */
  curveShape?: SponsorCurveShape;
  /** Rarity = the Etat dial that replaced the legacy star tier (transitional-optional; required after cutover). */
  rarity?: SponsorRarity;
  name: string;
  flavor: string;
  components: SponsorOfferComponent[];
  totalUpsideEstimate: number;
  commercialRating?: number;
  sponsorBrandId?: string;
  sponsorParentBrandId?: string;
  variantKey?: string;
  termSeasons?: SponsorTermSeasons;
  negotiationProfile?: SponsorNegotiationProfile;
  demandProfile?: SponsorDemandProfile;
  teamQualityRank?: number;
  /** Exactly one offer per team uses challenge specials (axis / salary / transfer). */
  isChallengeOffer?: boolean;
  /**
   * Golden-Sponsor-Los: höchstens EIN Slot/Team kann golden werden (underdog-/beliebtheits-gewichtet,
   * mit Cooldown). Golden ist KEIN eigener Rarity-Sprung — der Offer behält seine rarity — sondern hebt
   * die Rang-Meilenstein-Komponente (gedeckelt). Wird in chooseSponsorOffer in den Vertrag mitkopiert.
   */
  isGolden?: boolean;
  /**
   * P4 — Baukasten: stabile Liste der Modul-IDs, aus denen dieses Angebot zusammengesetzt ist (Cash-Module
   * = die `components`, plus nicht-Cash-Perks wie „Spotlight ×2" bei legendär/golden). Rein deskriptiv für
   * UI/Debug; die Auszahlung läuft weiter über `components`. Optional/rückwärtskompatibel.
   */
  moduleIds?: string[];
  /**
   * DIE GEBÄUDE-LEIHE DIESER KARTE (E1). Gesetzt heisst: weniger Cash, dafür ein Gebäude. Der
   * Verzicht steckt bereits in der Leiter (`sponsorV3.leihVerzicht`) — hier steht, wofür.
   */
  sponsorLeihe?: SponsorOfferLeihe;
  /** SPONSORSYSTEM V3: eingefrorene Konditionen. Jedes erzeugte Angebot traegt sie. */
  sponsorV3?: SponsorV3ContractTermsRecord;
  /** LEGACY, nur noch gelesen: V2-Konditionen aus Spielstaenden von vor dem V3-Umbau. */
  sponsorV2?: SponsorLegacyV2TermsRecord;
};

export type SponsorCommercialRating = {
  score: number;
  /** Erwartete Rarity aus dem Kommerz-Score (ersetzt den früheren 1..5-Sterne-Hint). */
  rarityHint: SponsorRarity;
  breakdown: {
    recentPerformance: number;
    rosterPotential: number;
    prestige: number;
  };
  inputs: {
    lastSeasonRank: number | null;
    avgWeightedRank: number | null;
    qualityRank: number | null;
    marketValuePercentile: number;
    axisPercentile: number;
    depthScore: number;
    prestigeMedalScore: number;
  };
};

export type TeamSponsorContractPayouts = {
  baseFirstPaid?: boolean;
  baseSecondPaid?: boolean;
  rankPaid?: boolean;
  improvementPaid?: boolean;
  specialPaid?: boolean;
};

export type TeamSponsorContract = {
  seasonId: string;
  teamId: string;
  offerId: string;
  archetype: SponsorArchetype;
  /** Die Kurvenform des unterschriebenen Angebots, 1:1 uebernommen (siehe `SponsorOffer.curveShape`). */
  curveShape?: SponsorCurveShape;
  /** Rarity — the Etat dial that replaced the legacy star tier (transitional-optional; required after cutover). */
  rarity?: SponsorRarity;
  name: string;
  chosenAt: string;
  startRank: number | null;
  components: SponsorOfferComponent[];
  payouts: TeamSponsorContractPayouts;
  commercialRating?: number;
  sponsorBrandId?: string;
  sponsorParentBrandId?: string;
  variantKey?: string;
  termSeasons?: SponsorTermSeasons;
  seasonsRemaining?: number;
  negotiationProfile?: SponsorNegotiationProfile;
  demandProfile?: SponsorDemandProfile;
  teamQualityRankAtSign?: number;
  /** Golden-Sponsor-Vertrag (aus dem gewählten Offer mitkopiert) — Rang-Payout-Boost gedeckelt. */
  isGolden?: boolean;
  /**
   * Die Gebäude-Leihe dieses Vertrags, 1:1 vom Angebot übernommen. Sie ist die Quelle für die
   * Leihgabe im Season-State, für den Stufen-Aufstieg beim Saisonwechsel und für den
   * Übernahmepreis am Vertragsende.
   */
  sponsorLeihe?: SponsorOfferLeihe;
  /**
   * LOCKED-AT-SIGNING Rang-Payout-Leiter: `lockedRankPayoutLadder[finalRank - 1]` = die volle
   * getSponsorPayoutForFinalRankAndTier-Summe für diesen Endrang, berechnet mit dem Anker + salaryFactor
   * ZUM ZEITPUNKT DER UNTERSCHRIFT. Das Settlement zahlt am erreichten Endrang aus dieser gespeicherten
   * Leiter (statt die Kurve aus den Season-End-Ankern neu abzuleiten), sodass eine Anker-/salaryFactor-Drift
   * über die Saison die Auszahlung eines bereits unterschriebenen Vertrags nicht mehr verändert. Fehlt das
   * Feld (Altsaves vor diesem Fix), fällt das Settlement auf die alte Season-End-Ableitung zurück.
   */
  lockedRankPayoutLadder?: number[];
  /** salaryFactor zum Zeitpunkt der Unterschrift — für konsistente Meilenstein-Anzeige im Settlement. */
  salaryFactorAtSign?: number;
  /**
   * SPONSORSYSTEM V3: beim Unterschreiben aus dem Angebot mitkopierte Konditionen. Fehlt das Feld,
   * stammt der Vertrag aus einem Spielstand von vor dem V3-Umbau; die einmalige, versionierte
   * Migration (`lib/sponsor/sponsor-v3-migration.ts`) setzt es beim Laden nach.
   */
  sponsorV3?: SponsorV3ContractTermsRecord;
  /** LEGACY, nur noch gelesen: V2-Konditionen aus Spielstaenden von vor dem V3-Umbau. */
  sponsorV2?: SponsorLegacyV2TermsRecord;
};

export type ScoutIntelSource = "watchlist" | "wishlist_mirror" | "passive_need" | "roster";

export type PlayerScoutIntelRecord = {
  playerId: string;
  teamId: string;
  seasonId: string;
  source: ScoutIntelSource;
  certainty: number;
  startedAt: string;
  lastTickAt: string | null;
  ticksCompleted: number;
};

export type SponsorPayoutLogRecord = {
  id: string;
  saveId: string;
  seasonId: string;
  teamId: string;
  phase: "base_first" | "base_second" | "season_end";
  componentId: string | null;
  cashDelta: number;
  action: "apply";
  createdAt: string;
};

/**
 * APRON — die beim SCHLIESSEN DES KAUFFENSTERS eingefrorenen Gehaltslinien (siehe
 * lib/season/apron-service.ts und `ensureSeasonApronLinesFrozen` in apron-settlement-service.ts).
 * Bewusst NICHT am Saisonende berechnet: sonst kauft man blind gegen eine Grenze, die sich durch die
 * eigenen Käufe verschiebt. Und bewusst NICHT mehr am Ende des Preseason-Workflows: das Kauffenster
 * der neuen Saison öffnet ERST DANACH — eine dort eingefrorene Linie misst die ausgedünnten
 * Nach-Verkaufs-Kader und gilt dann für eine Liga, die es so nicht mehr gibt (gemessener Schaden:
 * Median 45,0 eingefroren, Liga-Median nach dem Fenster 63,9 → 29 von 32 Teams über der Linie,
 * 3 Empfänger teilen 428,7). `medianSalary`/`line1`/`line2` sind ab dem Einfrieren fix für die
 * gesamte Saison, egal wie sich die Gehälter danach noch verschieben (Verletzungsersatz etc.).
 */
export type ApronLinesSnapshot = {
  seasonId: string;
  frozenAtMatchdayId: string;
  createdAt: string;
  /**
   * HERKUNFT des Snapshots — ohne den Vermerk war ein von einem Alt-Build zu früh eingefrorener
   * Stand von außen nicht von einem gültigen zu unterscheiden (so festgesessen auf Chris' Save,
   * Median 45,0 gegen real 69,8):
   *   - "transfers_finalized" = beim Bestätigen von „Transfers finalisieren" geschrieben. DAS ist
   *     seit Chris' Meldung („ich habe nun transfers finalisiert -> apron müsste nun eingefroren
   *     werden") der reguläre Zeitpunkt: mit dem Finalisieren endet der Kaderbau der Saison.
   *   - "buy_window_close" = von `ensureSeasonApronLinesFrozen` geschrieben. Solange das
   *     Kauffenster offen ist, wird bei jedem Aufruf nachgeführt; endgültig ist der letzte Stand
   *     vor dem ersten gewerteten Spieltag. Bleibt der Vermerk für Spielstände ohne menschliches
   *     Team (Simulation) und für den Fall, dass ein Spieltag ohne vorheriges Finalisieren läuft.
   *   - "recompute_repair" = per `scripts/repariere-apron-linien.ts` neu berechnet, nachdem ein
   *     Alt-Build-Snapshot in einer bereits gespielten Saison festsaß; `note` nennt Zeitpunkt und
   *     Grund.
   * Fehlt das Feld, stammt der Snapshot von einem älteren Build, der VOR dem Kauffenster der
   * Saison einfror (Preseason-Workflow/New-Game). Solche Snapshots werden in einer bereits
   * gespielten Saison BEWUSST NICHT automatisch ersetzt: eine Grenze, die mitten in der Saison
   * wandert, ist genau das, wovor das Einfrieren schützt. Die Heilung läuft ausschließlich über
   * das Reparaturskript, das vorher nachweist, dass seit dem ersten gewerteten Spieltag keine
   * Transfers stattfanden — nur dann ist die Neuberechnung der Stand vom Fensterschluss und keine
   * Schätzung.
   */
  frozenAtEvent?: "transfers_finalized" | "buy_window_close" | "recompute_repair";
  /** Freitext-Herkunftsvermerk (Reparaturskript: Zeitpunkt und Grund der Neuberechnung). */
  note?: string;
  medianSalary: number;
  line1: number;
  line2: number;
  /** true = die Liga hatte beim Einfrieren noch keine echten Gehälter (Season-1-Fallback). */
  usedReferenceSalary: boolean;
};

/** Ein Ledger-Eintrag der Apron-Abrechnung (Saisonende) — analog zu SponsorPayoutLogRecord. */
export type ApronSettlementLogRecord = {
  id: string;
  saveId: string;
  seasonId: string;
  teamId: string;
  phase: "season_end";
  /** "levy" = Abgabe (negativ), "payout" = Ausschüttung aus dem Topf (positiv oder 0). */
  kind: "levy" | "payout";
  cashDelta: number;
  action: "apply";
  createdAt: string;
};

export type LoanLenderType = "bank" | "team"; // "team" erst Phase 3

export type LoanRecord = {
  loanId: string;
  borrowerTeamId: string;
  lenderType: LoanLenderType;
  lenderTeamId?: string; // nur bei lenderType === "team"
  principalOriginal: number; // ursprüngliche Kreditsumme
  principalOutstanding: number; // Restschuld -> die Schulden-Seite
  interestRatePerSeason: number; // fix bei Abschluss (z. B. 0.152)
  termSeasons: number; // 1..10
  seasonsRemaining: number;
  installmentPerSeason: number; // Annuität, konstante Jahresrate
  originatedSeasonId: string;
  status: "active" | "paid" | "defaulted";
  missedPayments: number;
};

export type LoanApplyLogRecord = {
  seasonId: string; // Saison, in der die Rate verbucht wurde
  loanId: string;
  installmentCharged: number;
  interestPortion: number;
  principalPortion: number;
  createdAt: string;
  /**
   * Ledger-Quelle des Eintrags. Fehlt/`"settlement"` = reguläre Saison-End-Ratenbuchung
   * (`applyLoanSettlement`). `"early_payoff"` = vorzeitige Ablösung (`applyEarlyPayoff`), die
   * denselben Cash-Effekt trägt (Kreditnehmer −payoff, Team-Verleiher +payoff) und deshalb hier
   * geloggt wird, damit die Cash-Reconciliation (transfer-finance-audit.ts) sie nicht als Leck
   * meldet. Die Saison-End-Settlement-Idempotenz (`previewLoanSettlement`/`season-completion-service`)
   * ignoriert `"early_payoff"`-Einträge bewusst — eine In-Season-Ablösung darf das Settlement
   * derselben Saison NICHT als "bereits gelaufen" markieren.
   */
  kind?: "settlement" | "early_payoff";
};

/**
 * Ledger-Eintrag für die Kredit-AUSZAHLUNG (Origination), analog `loanApplyLogs` (die nur die
 * Saison-End-Raten abdecken). Ohne diesen Log war der Cash-Sprung bei Kreditaufnahme aus dem
 * Ledger nicht rekonstruierbar (siehe tests/economy-cashflow-invariant.test.ts, das die Auszahlung
 * bislang selbst als "loan:origination(unlogged)" markiert hat).
 */
export type LoanOriginationLogRecord = {
  loanId: string;
  seasonId: string;
  borrowerTeamId: string;
  borrowerCashDelta: number; // = +principal
  lenderType: LoanLenderType;
  lenderTeamId?: string; // nur bei lenderType === "team"
  lenderCashDelta?: number; // = -principal, nur bei lenderType === "team"
  principal: number;
  createdAt: string;
};

export type ScoutingWatchlistEntry = {
  playerId: string;
  teamId: string;
  seasonId: string;
  addedAt: string;
  source: "manual_scouting_hub" | "transfer_wishlist_mirror";
  note?: string | null;
};

/**
 * EIN LESEZEICHEN — nicht zu verwechseln mit der Scouting-Beobachtungsliste.
 *
 * GEWUENSCHT (Chris): „man sollte sich aussuchen können welche teams getrackt werden, dass man so
 * ne wishlist option bei teams und spielern hat wie so lesezeichen und sich die dann noch mal
 * angucken kann".
 *
 * WARUM NICHT DIE VORHANDENE `ScoutingWatchlistEntry` ERWEITERT WURDE — die ist etwas anderes,
 * und der Unterschied faellt erst auf, wenn man sie missbraucht:
 *
 *   - sie haengt an einer SAISON (`seasonId`) und ist beim Saisonwechsel weg,
 *   - sie hat eine Platzgrenze (`scouting-wishlist-slots.ts`),
 *   - und sie blendet jeden Spieler aus, der in EINEM Kader steht — sie ist eine Liste von
 *     TRANSFERZIELEN, und ein Spieler mit Vertrag ist keins mehr.
 *
 * Genau das darf ein Lesezeichen nicht tun: wer sich den eigenen Aufsteiger merkt, will ihn beim
 * naechsten Blick wiederfinden und nicht feststellen, dass er verschwunden ist, weil man ihn
 * gekauft hat.
 *
 * AM BESITZER, NICHT AM TEAM. Die Merkliste ist eine Ansichts-Vorliebe, keine Spieltatsache: im
 * Koop fuehrt Chris seine eigene und Franky seine, und keiner sieht oder ueberschreibt die des
 * anderen. Ohne Anmeldung (Solo) gibt es genau einen Eimer — `ownerId` steht dann auf null.
 */
export type MerklisteArt = "team" | "spieler";

export type MerklisteEintrag = {
  art: MerklisteArt;
  /** Team-ID oder Spieler-ID, je nach `art`. */
  id: string;
  /** Besitzer der Liste. `null` = Solo/ohne Anmeldung, ein einziger gemeinsamer Eimer. */
  ownerId: string | null;
  angelegtAm: string;
  notiz?: string | null;
};

export type TeamSeasonObjectiveStatus = "open" | "completed" | "failed" | "at_risk";

export type TeamSeasonObjectiveRecord = {
  seasonId: string;
  teamId: string;
  objectiveId: string;
  category: TeamSeasonObjectiveCategory;
  label: string;
  detail?: string | null;
  actionHint?: string | null;
  targetValue: number | string | boolean | null;
  currentValue: number | string | boolean | null;
  status: TeamSeasonObjectiveStatus;
  rewardCash?: number;
  penaltyCash?: number;
  boardConfidenceDelta?: number;
  source: string;
  /**
   * Optionales Zusatzziel: Der Vorstand stellt pro Saison nur EIN verbindliches Rang-Ziel. Jedes
   * weitere Rang-Ziel im Slate wird bei der Vergabe herabgestuft — es kann Bonus bringen, kostet
   * aber weder Cash noch Vertrauen, wenn es verfehlt wird. Ältere Spielstände führen das Feld
   * nicht; fehlend bedeutet "verbindlich".
   */
  optional?: boolean;
  /**
   * Der ausgewiesene Wert ist eine HOCHRECHNUNG: das Ziel hängt an Cash, und die Einnahmen der
   * Saison (Sponsor, Apron, Gebäude) werden erst am Saisonende gebucht. Die Oberfläche schreibt
   * das dazu, und bis zur Abrechnung kann der Status höchstens "gefährdet" sein. Ältere
   * Spielstände führen das Feld nicht; fehlend bedeutet "steht fest".
   */
  provisional?: boolean;
};

export type TeamBoardConfidenceRecord = {
  teamId: string;
  value: number;
  pressure: number;
  warnings: string[];
  /**
   * Board-Objectives V2 (OLY_BOARD_OBJECTIVES_V2): the perceived-pressure layer — a momentum-smoothed,
   * patience-adjusted pressure distinct from the raw inverse-of-value `pressure`. Consequences (GM
   * firing, AI bias, GM psychology) read this when present. Undefined under V1.
   */
  perceivedPressure?: number;
  /** V2 EMA state for perceivedPressure momentum, carried across refreshes/seasons. */
  pressureMomentum?: number;
};

export type TeamRelationshipEventRecord = {
  eventId: string;
  seasonId: string;
  matchdayId?: string | null;
  fromTeamId: string;
  toTeamId: string;
  delta: number;
  reason: "rivalry_win" | "rivalry_loss" | "rivalry_close_finish" | "ally_shared_success" | "manual_adjustment";
  source: "matchday_result" | "manual" | "system_preview";
  createdAt: string;
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
  /** AI renewal/exit rationale (MS-3.2). */
  decisionReason?: string | null;
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

/** Tracks when AI teams spend below their liquidity buffer to finish roster rebuilds. */
export type AiCashBufferDipLedgerEntry = {
  teamId: string;
  seasonId: string;
  dipCount: number;
  totalDipped: number;
  lastAt: string;
  /** After the first dip, AI should bias toward profit sells and cheap-salary picks. */
  rebuildFocusActive: boolean;
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

/**
 * Audit trail for the season-long training intensity lock: written the moment
 * a team's training focus/intensity or per-player training modes are
 * confirmed (via `applyTeamTrainingSettings`, `applyPlayerTrainingModes`, or
 * the manual per-player training UI). Purely informational/"nachvollziehbar" —
 * the actual lock is enforced live via
 * `isTrainingIntensityLockedForSeason`/`evaluateGamePhaseAction(gameState,
 * "set_training")` in lib/foundation/game-phase-action-policy.ts, so this
 * record cannot go stale in a way that would bypass the block.
 */
export type TrainingIntensityConfirmationRecord = {
  teamId: string;
  seasonId: string;
  confirmedAt: string;
  sourcePlanId: string;
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
  source: "fatigue_injury_risk_v1" | "fatigue_injury_rehearsal_v1";
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

/**
 * Ein Wuerfelwurf gegen das Verletzungsrisiko — einer je eingesetztem Spieler und Spieltag.
 *
 * ZWEI DINGE IN EINEM TYP: bei `result: "healthy"` (am Live-Spielstand 4988 von 5032 Zeilen) ist
 * das eine BELASTUNGS-MESSUNG — `fatigueBefore` speist den Spieltags-Schnitt in
 * `computePlayerSeasonAverageMatchdayFatigue`. Erst bei `result: "injured"` wird daraus ein
 * Verletzungs-Datensatz mit Ausfall- und Genesungs-Angaben.
 *
 * Die Felder der zweiten Haelfte sind deshalb optional: auf gesunden Zeilen standen sie
 * ausnahmslos auf `null` bzw. `1` und wurden von keiner Lesestelle je angesehen
 * (`injuryEventToPlayerHistoryRecord` verwirft alles ausser `injured` sofort). Sie werden beim
 * Speichern weggelassen, siehe `lib/persistence/save-payload-slimming.ts` — 593 KB, die keine
 * Auskunft trugen.
 */
export type InjuryEventRecord = {
  eventId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string;
  playerId: string;
  /** Belastung vor dem Spieltag — der Grund, warum auch gesunde Wuerfe aufbewahrt werden. */
  fatigueBefore: number;
  riskPercent: number;
  roll: number;
  result: "healthy" | "injured";
  /** Nur bei `injured` gespeichert; fehlt sie, ist sie `1` (der einzige je geschriebene Wert). */
  unavailableForMatchdays?: 1;
  unavailableUntil?: string | null;
  normalRecovery?: number | null;
  injuryRecovery?: number | null;
  fatigueAfterRecovery?: number | null;
  /**
   * Fehlt das Feld, ist es `fatigue_injury_risk_v1` — der Standard steht in
   * `INJURY_EVENT_DEFAULT_SOURCE`, nicht tausendfach im Spielstand. Proben-Wuerfe
   * (`fatigue_injury_rehearsal_v1`) behalten ihre Angabe.
   */
  source?: "fatigue_injury_risk_v1" | "fatigue_injury_rehearsal_v1";
  timestamp: string;
};

export type PlayerInjuryHistoryRecord = {
  eventId: string;
  seasonId: string;
  seasonName?: string;
  matchdayId: string;
  matchdayLabel?: string;
  teamId: string;
  fatigueBefore: number;
  riskPercent: number;
  unavailableUntil: string | null;
  matchdaysMissed: number;
  injuryRecoveryPct: number;
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
  /**
   * NICHT die Wertungsgroesse. Das ist der Katalog-Startzustand (Tabelle `disciplines`,
   * Seed-Daten in lib/data/dataAdapter.ts) — der Spielplan wuerfelt die tatsaechlich fuer eine
   * Saison geltende Kadergroesse jede Saison neu aus (`buildSeasonSeededDisciplineSchedule`,
   * lib/season/season-discipline-schedule.ts) und legt sie in
   * `seasonState.disciplineSchedule[].discipline1/2.playerCount` ab. Am Live-Spielstand
   * gemessen weichen 15 von 20 Disziplinen zwischen Katalog und Spielplan ab; gegen die
   * Standings-Punkte nachgerechnet stimmt fuer alle 32 Teams nur der Spielplan-Wert. Wer
   * wissen will, wie viele Spieler DIESE Saison in einer Disziplin antreten (Aufstellung,
   * Anzeige, Rangpunkte, KI), muss den Spielplan-Slot lesen — `buildSeasonDisciplinePlayerCountMap`
   * in lib/season/season-discipline-schedule.ts liefert das je Disziplin fertig mit Katalog-
   * Rueckfall fuer Disziplinen, die (noch) keinen Spielplan-Eintrag haben.
   */
  playerCount?: number;
  mutator1?: string | null;
  mutator2?: string | null;
};

export type RosterPromisedRole = "starter" | "rotation" | "bench" | "prospect";

export type RosterEntry = {
  id: string;
  teamId: string;
  playerId: string;
  /**
   * Der Countdown — ABGELEITET, sobald `contractEndSeasonNumber` gesetzt ist.
   *
   * Bleibt vorerst das Feld, das die meisten Lesestellen benutzen (93 Dateien in `lib/` und
   * `app/`). Die Wahrheit ist die Endsaison; siehe `lib/contracts/vertragslaufzeit.ts`.
   */
  contractLength: number;
  /**
   * DIE SAISON, NACH DER DER VERTRAG ENDET — die Wahrheit ueber die Laufzeit.
   *
   * Eine Zahl, die nicht fortgeschrieben werden muss: „laeuft aus" heisst, dass sie die laufende
   * Saison IST. Der Countdown daneben wird daraus gerechnet. Optional, weil Altstaende sie noch
   * nicht tragen — dann leitet `endSaisonNummer` sie einmalig aus `contractLength` ab.
   */
  contractEndSeasonNumber?: number;
  contractStatus?: ContractStatus;
  contractShape?: ContractShape;
  yearlySalarySchedule?: ContractYearSalary[];
  salary: number;
  /**
   * DAS BEI UNTERSCHRIFT VERHANDELTE JAHRESGEHALT — die Bemessungsgrundlage der Apron.
   *
   * Persistiert und danach UNVERAENDERLICH, bis derselbe Vertrag neu unterschrieben wird. Genau
   * darin liegt sein Zweck: `salary` wird bei JEDEM Saisonwechsel von
   * `advanceRosterContractSchedule` mit der Jahr-1-Rate der Rest-Schedule ueberschrieben, und auch
   * der Durchschnitt der REST-Schedule schrumpft bei einem front_loaded-Vertrag Jahr fuer Jahr
   * (3 Jahre 1,2/1,0/0,8 ⇒ Basen 1,0a / 0,9a / 0,8a = Σ 2,7a statt 3,0a). Beide waeren
   * formabhaengig — die Apron wuerde sich durch Front-Loading senken lassen.
   *
   * Optional, weil Bestandsvertraege das Feld nicht tragen; der Leser
   * (`resolveNegotiatedAnnualSalary`) und der Lade-Backfill
   * (`withNegotiatedSalaryBenchmark`) fuellen es aus dem Schedule-Durchschnitt nach.
   */
  negotiatedAnnualSalary?: number | null;
  upkeep: number;
  purchasePrice?: number | null;
  currentValue?: number | null;
  roleTag: "starter" | "bench" | "prospect";
  promisedRole?: RosterPromisedRole | null;
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
  /**
   * Sein letztes GELD-Wort in dieser Verhandlung (verhandlung-rework.md Abschnitt 9.3).
   *
   * Abschnitt 7 hatte das Gegenangebot ausdrücklich für nicht speicherwürdig erklärt — es war
   * eine gedächtnislose Funktion von (Angebot, Forderung, Wille, Traits) und jederzeit neu
   * herleitbar. Mit der Erwiderung ist es das nicht mehr: wer entgegenkommt, soll die Zahl
   * sinken sehen, und dafür muss die Vorrunde bekannt sein.
   *
   * Geschrieben bei `status = "countered"` mit Geld-Gegenangebot; genullt bei jedem
   * Statuswechsel weg von "countered" und bei Konditionenwechsel (sein Wort galt für die
   * damalige Laufzeit/Form — andere Konditionen sind eine neue Sachlage).
   */
  lastCounterSalary?: number | null;
  /**
   * Trotz-Aufschlag auf die Forderung, als Anteil (0,03 = +3 %) — verhandlung-rework.md
   * Abschnitt 9.1.
   *
   * Wächst nur monoton (`max`): es zählt der tiefste je VERHANDELTE Griff, nicht der zuletzt
   * getippte. Tippen ist frei, die Vorschau warnt vorher; Verhandeln klebt. Klebrig für die
   * Dauer dieses Drafts (Season/Team/Spieler) — wäre er durch anschließendes Wohlverhalten
   * abbaubar, wäre Lowball-zuerst gratis.
   *
   * Genullt beim Übergang zu `rejected_bad_experience`: dort greift die Vertrauensbruch-Strafe
   * (×1,12), und beides zu stapeln wäre zweimal kassiert für denselben Vorfall.
   */
  defianceSurchargePct?: number;
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
  pow?: number | null;
  spe?: number | null;
  men?: number | null;
  soc?: number | null;
  teamId?: string | null;
  createdAt: string;
  /** Scouting focus queue order — lower rank scouts first. Falls back to createdAt for legacy entries. */
  priorityRank?: number | null;
  /**
   * Projected yearly salary schedule this (not-yet-signed) target would command
   * if signed today — view-model-only, computed via `projectWishlistSalarySchedule`
   * (see `lib/market/contract-negotiation-preview.ts`). Never persisted; only set
   * on the derived wishlist rows the UI renders.
   */
  projectedSalarySchedule?: ContractYearSalary[] | null;
};

export type TransferSellMarkerEntry = {
  id: string;
  saveId: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  playerName: string;
  contractLength: number;
  buyoutCost: number | null;
  marketValueAtExit: number | null;
  morale: number | null;
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
  /** Buyout-Kosten (Restgehalt-Ablösung), die vom Bruttoerlös (fee) abgezogen wurden. Nur bei transferType "sell". */
  buyoutCost?: number | null;
  /** Tatsächlicher Cash-Zufluss/-Abfluss (fee − buyoutCost). Bei "buy"/"contract_exit" i.d.R. gleich fee. */
  netCashImpact?: number | null;
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

/** Season-end depth stress from lineup coverage; drives opt bump for the next preseason. */
export type TeamRosterStressRecord = {
  teamId: string;
  sourceSeasonId: string;
  matchdaysTotal: number;
  matchdaysWithSlotGaps: number;
  matchdaysWithRosterLimited: number;
  conserveSideUses: number;
  endedBelowBaseOpt: boolean;
  depthStressScore: number;
  optBump: number;
  generatedAt: string;
};

export type FormCardPlanRecord = {
  id: string;
  saveId: string;
  seasonId: string;
  teamId: string;
  matchdayId: string;
  disciplineSide: "d1" | "d2";
  disciplineId: string | null;
  primaryFormCardId: string | null;
  secondaryFormCardId: string | null;
  /**
   * Vorgeplante Intensitaet dieser Spieltag-Seite (Formplan). Rein planerisch:
   * die Wertung liest weiterhin ausschliesslich `LineupDraftModifiers.intensity`
   * des am Spieltag gespeicherten Entwurfs. Der Plan sagt "hier will ich pushen"
   * und wird beim Oeffnen des Spieltags in den Entwurf uebernommen — er ersetzt
   * ihn nicht. `null`/fehlend = kein Plan (die Einsatzliste startet auf "normal").
   */
  plannedIntensity?: "conserve" | "normal" | "push" | null;
  updatedAt: string;
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
  totalMatchdays?: number;
  isCompleted?: boolean;
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
  formModifier?: number | null;
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

/**
 * Vorberechneter Spieltag: das Resolve-Ergebnis, einmal gerechnet und abgelegt.
 *
 * `payload` ist die Resolve-Vorschau (`LegacyMatchdayResolvePreviewPayload`) — hier
 * bewusst als `unknown` typisiert, damit die Datentypen nicht gegen die Resolve-Schicht
 * ziehen; `lib/foundation/matchday-resolve-snapshot.ts` liest ihn typisiert.
 *
 * `signature` bindet den Snapshot an die Eingaben, aus denen er entstand (Aufstellungen,
 * Kapitaene, Verfuegbarkeit). Aendert sich davon etwas, ist er ungueltig und wird neu
 * gerechnet — ein Snapshot darf niemals ein Ergebnis zu einer Aufstellung liefern, die
 * so gar nicht mehr antritt.
 */
export type MatchdayResolveSnapshotRecord = {
  id: string;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  signature: string;
  /**
   * Signatur NUR ueber die Aufstellungen, je Disziplin-Seite getrennt, plus die
   * Verfuegbarkeit der auf DIESER Seite eingesetzten Spieler.
   *
   * Warum getrennt: Der D1-Commit schreibt die Fatigue der in D1 gelaufenen Spieler und
   * veraendert damit die volle `signature` — der Snapshot waere ausgerechnet fuer den
   * D2-Commit ungueltig. Fuer D2 zaehlt aber nur, ob sich an D2 etwas geaendert hat. Mit
   * der seitenweisen Signatur laesst sich genau das pruefen, statt die Pruefung fuer den
   * ganzen Spieltag auszuschalten (dabei ueberlebte auch ein laengst verfallener
   * Snapshot und wurde als "Ergebnis" gezeigt).
   *
   * Alt-Snapshots ohne dieses Feld gelten als nicht mehr pruefbar und werden verworfen —
   * lieber die gebuchte Wahrheit als eine huebschere Vorschau.
   */
  sideSignatures?: Record<"d1" | "d2", string>;
  previewStatus: string;
  readinessByTeamId: Record<
    string,
    {
      readinessStatus: string;
      reasonCodes: string[];
      shortReason: string;
    }
  >;
  payload: unknown;
  /**
   * GESETZT, SOBALD GENAU DIESE RECHNUNG GEBUCHT WURDE — mit der Ergebnis-ID, in die sie floss.
   *
   * GEMELDET VON CHRIS an der Arena: „Screenshot 1 zeigt die Ergebnisse. Screenshot 2 zeigt andere
   * ergebnisse ungefähr ne Minute später nachdem gebucht wurde. […] ich will keinen switch mehr
   * sehen dass die punkte sich ändern."
   *
   * URSACHE: Ist ein Spieltag DURCH, gab `readMatchdayResolveSnapshot` bewusst `null` zurück (ein
   * veralteter Snapshot darf die gebuchte Wahrheit nicht überstimmen). Die Arena fiel damit auf den
   * LIVE-Pfad zurück und rechnete den Spieltag neu — gegen den Zustand NACH der Buchung. Und genau
   * die schreibt die Nach-Spieltags-Fatigue: dieselbe Disziplin kommt danach anders heraus. Am
   * Screenshot: Malagor 98,8 → 92,1, Silver Soldiers 14,9 → 14,2, Cold Steel 14,4 → 14,9 — samt
   * getauschter Plätze.
   *
   * Der Stempel löst das ohne Vergleichsheuristik: eine Vorberechnung, die nachweislich GEBUCHT
   * wurde, ist keine Vorschau mehr, sondern der Beleg des Ergebnisses. Sie darf danach angezeigt
   * werden — und nur sie. Ein Snapshot ohne Stempel bleibt nach der Buchung ungültig, wie bisher.
   */
  bookedAt?: string | null;
  /** Das Ergebnis, in das diese Rechnung gebucht wurde. Zusammen mit `bookedAt` der Beleg. */
  bookedMatchdayResultId?: string | null;
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
  /**
   * DER KONTOSTAND, MIT DEM DAS TEAM IN DIE NAECHSTE SAISON GEHT — eingefroren am Saisonstart,
   * NACH Kaeufen, Kaderfuellung und Krediten.
   *
   * CHRIS' REGEL: „die snapshots für Cash und Marktwert sollen ja auch erst am anfang der Saison
   * nach den Käufen stattfinden für die ewige Tabelle / Finanzen."
   *
   * Warum ein EIGENES Feld statt `cashEnd` zu ueberschreiben: `cashEnd` ist der wahre
   * Saison-Endstand (nach Sponsoren, vor dem Transferfenster) und die Bezugsgroesse des
   * Abgleichs in `getSnapshotCashByTeam`. Wird er mit dem Stand nach den Kaeufen ueberschrieben,
   * rechnet der Abgleich die Preseason-Ausgaben doppelt und meldet ein falsches
   * `cash_reconciliation_delta_hard` — genau der Grund, aus dem
   * `buildTeamEntryEconomyFromGameState` das Feld bisher gar nicht anfasste. Die Ansichten lesen
   * jetzt `cashEntry` zuerst und fallen auf `cashEnd` zurueck, wo es fehlt (Altsaves).
   */
  cashEntry?: number | null;
  /**
   * DER KONTOSTAND AN DER SAISONGRENZE — das Geld, das ein Team wirklich in die neue Saison
   * mitgenommen hat. Eingefroren im `next_season_setup`, unmittelbar NACH der Vertragsalterung
   * (`computeSeasonEndContractTick`) und BEVOR die neue Saison-ID gesetzt ist.
   *
   * WOZU EIN DRITTER CASH-WERT. Zwischen `cashEnd` (Ende der Saisonabrechnung, vor dem
   * Transfermarkt — Chris' Regel) und `cashEntry` (nach den Kaeufen der Folgesaison) liegen
   * Buchungen, die auf die ALTE Saison gebucht werden, aber erst beim Saisonwechsel stattfinden:
   * die auslaufenden Vertraege. Ihr Ablösewert (`contract_exit`, `transferHistory` mit der ALTEN
   * `seasonId`) landet auf `team.cash`, nachdem der Schnappschuss laengst steht.
   *
   * Gemessen am Live-Abbild `new-game-1785823388048-1hf25q`: 54 `ai_contract_expiry`-Abgaenge,
   * zusammen +1085,24 C, gebucht 0,7 s NACH `createSeasonSnapshot`. Genau dieser Betrag war die
   * Luecke, die `buildTransferFinanceAudit` als `cash_reconciliation_delta_hard` der FOLGE-Saison
   * meldete (bis 112,9 C bei 19 von 32 Teams) — das Audit verankerte Saison N+1 auf `cashEnd`,
   * und das ist nicht das Geld, mit dem das Team gestartet ist.
   *
   * `cashEnd` bleibt deshalb, was Chris will (Stand vor Marktoeffnung, das zeigt die Historie),
   * und dieses Feld ist die Buchungsgrenze fuer den Abgleich. Write-once: einmal gesetzt, nie
   * wieder angefasst.
   */
  cashCarryOver?: number | null;
  /** Roster size captured at season_end (post-sell). Preserved when entry roster is patched after next preseason buys. */
  rosterEndPostSell?: number | null;
  rosterEnd: number;
  rosterCountEnd?: number | null;
  salaryEnd: number | null;
  salaryTotalEnd?: number | null;
  marketValueEnd: number | null;
  marketValueTotalEnd?: number | null;
  /**
   * DER MARKTWERT, MIT DEM DAS TEAM DIE SAISON WIRKLICH BEENDET HAT — eingefroren NACH dem
   * Trainings-Apply und der Marktwert-Neuberechnung (`player_development`), aber VOR dem
   * Transferfenster.
   *
   * Nötig, weil der Snapshot selbst frueher entsteht: die Reihenfolge am Saisonende ist
   * `… → snapshot → transition → player_development → transfer_sell_phase`. `marketValueEnd` traegt
   * deshalb den Stand VOR der Entwicklung, und `patchCompletedSeasonSnapshotAfterPreseasonBuy`
   * ueberschreibt ihn spaeter zusaetzlich mit dem Eintrittsstand der NAECHSTEN Saison. Beide Werte
   * beantworten eine andere Frage als „wie stark war das Team am Saisonende" — und genau die
   * braucht man, um Saisons ueber Jahre miteinander zu vergleichen.
   *
   * Dieses Feld wird nach dem Einfrieren NICHT mehr angefasst. Fehlt es (Altsaves, oder eine Saison,
   * in der die Entwicklung nicht lief), fallen die Ansichten auf `marketValueTotalEnd` zurueck.
   */
  marketValueSeasonEnd?: number | null;
  /**
   * Die uebrigen Momentwerte zum selben Zeitpunkt wie `marketValueSeasonEnd`:
   * Ende `player_development`, also NACH dem Trainings-Apply und VOR dem ersten
   * Verkauf des Transferfensters.
   *
   * Warum eigene Felder statt `cashEnd`/`salaryEnd`/`rosterEnd`: Die alten Felder
   * bezeichnen andere Zeitpunkte und werden von spaeteren Patches ueberschrieben —
   * `salaryEnd`/`rosterEnd` tragen nach `patchCompletedSeasonSnapshotAfterPreseasonBuy`
   * den Eintrittsstand der FOLGE-Saison, `cashEnd` den Stand nach den Verkaeufen.
   * Die Historie zeigte dadurch drei Spalten mit drei verschiedenen Zeitpunkten,
   * zwei davon aus der falschen Saison (gemeldet von Chris).
   *
   * Alle drei werden wie `marketValueSeasonEnd` write-once gesetzt und danach nie
   * wieder angefasst. `cashEnd` bleibt unveraendert bestehen — es ist die
   * Bezugsgroesse des Cash-Abgleichs (`cash_reconciliation_delta_hard`).
   */
  cashSeasonEnd?: number | null;
  salarySeasonEnd?: number | null;
  rosterSeasonEnd?: number | null;
  /** Zeitpunkt des Einfrierens — belegt, dass der Block wirklich vor der Verkaufsphase entstand. */
  seasonEndFrozenAt?: string | null;
  /**
   * Woher der Snapshot stammt. `"post_sell_fallback"` markiert einen Datensatz, der
   * NICHT beim Saisonabschluss entstand, sondern nachtraeglich beim
   * `next_season_setup` — dann liegen die Verkaeufe bereits dahinter und die
   * eingefrorenen Felder bleiben leer, statt eine falsche Zahl zu behaupten.
   */
  economySnapshotSource?: "season_completion" | "post_sell_fallback";
  transferCount: number;
  transferBuyCount: number;
  transferSellCount: number;
  transferBuyTotal?: number | null;
  transferSellTotal?: number | null;
  transferNet: number | null;
  cashFc?: number | null;
  startplatz?: number | null;
  rankDiff?: number | null;
  sponsorBasis?: number | null;
  sponsorRank?: number | null;
  sponsorSeason?: number | null;
  sponsorTotal?: number | null;
  guv?: number | null;
  cashTotal?: number | null;
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
  powPoints?: number | null;
  spePoints?: number | null;
  menPoints?: number | null;
  socPoints?: number | null;
  ovr?: number | null;
  ovrRank?: number | null;
  pps?: number | null;
  ppsRank?: number | null;
  mvs?: number | null;
  mvsRank?: number | null;
  marketValue?: number | null;
  purchasePrice?: number | null;
  projectedSellValue?: number | null;
  projectedSellFactor?: number | null;
  saleFactorBracket?: number | null;
  saleFactorRankInBracket?: number | null;
  saleFactorBracketSize?: number | null;
  salary?: number | null;
  contractLength?: number | null;
  promisedRole?: RosterPromisedRole | null;
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
  amountDeltaToMarketValue?: number | null;
  amountMarketValueFactor?: number | null;
  contractLength: number | null;
  source: string;
  happenedAt?: string | null;
};

export type SeasonSnapshotGeneralManagerRecord = {
  teamId: string;
  teamCode: string;
  teamName: string;
  gmId: string;
  gmName: string;
  gmTitle: string;
  gmArchetype: TeamGeneralManagerArchetype;
  assignedSeasonId: string;
  source: TeamGeneralManagerAssignment["source"];
  influencePct: number;
  boardConfidenceValue?: number | null;
  boardPressure?: number | null;
  previousGmId?: string | null;
  dismissalReason?: TeamGeneralManagerAssignment["dismissalReason"];
};

export type TeamDisciplineRankSnapshotRecord = {
  teamId: string;
  teamCode?: string | null;
  teamName: string;
  totalRank: number;
  powRank: number;
  speRank: number;
  menRank: number;
  socRank: number;
  disciplineRanks?: Record<string, number>;
  scorePack?: {
    total: number;
    pow: number;
    spe: number;
    men: number;
    soc: number;
    disciplines?: Record<string, number>;
  };
};

/**
 * HERKUNFTSVERMERK der Teamstärke-Ränge im Saison-Schnappschuss.
 *
 * GEMELDET VON CHRIS: „die snapshots für die ranking änderungen [müssen] sich auf den season 1 lauf
 * beziehen vor verkäufen! … da ist N-N zb 32. das kann nicht der stand während der saison gewesen
 * sein". Befund: `buildSeasonSnapshotRecord` rechnete die Ränge beim Saisonabschluss aus dem
 * LIVE-Kader — der lag im echten Spielstand vier Tage nach dem letzten Spieltag, nach 49 Verkäufen.
 *
 * Deshalb steht am Datensatz jetzt, WOHER die Ränge stammen:
 *   - `matchday_capture`: bei der Wertung des letzten Spieltags festgehalten (der Soll-Weg),
 *   - `season_end_live`: Rückfall für Altstände ohne festgehaltenen Satz — Live-Kader beim
 *     Saisonabschluss, also potenziell nach Verkäufen,
 *   - `transfer_history_reconstruction`: rückwirkend aus der Transferhistorie rekonstruiert
 *     (scripts/repariere-s1-teamstaerke-snapshot.ts).
 */
export type TeamDisciplineRankSnapshotMeta = {
  source: "matchday_capture" | "season_end_live" | "transfer_history_reconstruction";
  /** Spieltag, dessen Kaderstand die Ränge abbilden (bei `season_end_live` null). */
  matchdayId?: string | null;
  /** Zeitpunkt, zu dem der Kaderstand galt bzw. festgehalten wurde. */
  capturedAt?: string | null;
  note?: string | null;
};

/**
 * Bei jeder Spieltagswertung festgehaltene Teamstärke-Ränge — der jeweils letzte gewinnt.
 *
 * Ein Eintrag pro Saison (Upsert über `seasonId`). Der Saison-Schnappschuss übernimmt diesen Satz,
 * statt beim Saisonabschluss neu aus dem Live-Kader zu rechnen — zwischen letztem Spieltag und
 * Abschluss liegen sonst Verkäufe/Vertragsenden, die die Saisonränge verfälschen (siehe
 * TeamDisciplineRankSnapshotMeta). Muster: matchdayResolveSnapshots, nur pro Saison statt pro
 * Spieltag. Einträge vergangener Saisons bleiben als kleines Audit-Archiv stehen.
 */
export type TeamStrengthRankCaptureRecord = {
  id: string;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  capturedAt: string;
  records: TeamDisciplineRankSnapshotRecord[];
};

/**
 * Eine Auszeichnung, wie sie im Saison-Schnappschuss liegenbleibt. Bewusst eine FLACHE Kopie der
 * Felder aus `SeasonReviewAward` statt eines Imports: der Schnappschuss ist ein gespeichertes
 * Format und darf sich nicht mitbewegen, wenn der Dienst seinen Typ aendert.
 */
export type SeasonSnapshotAwardRecord = {
  awardId: string;
  label: string;
  category: "team" | "player" | "transfer" | "discipline";
  winnerType: "team" | "player";
  winnerId: string;
  winnerName: string;
  value: number | string | null;
  reason: string;
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
  /** Top-6 discipline strength ranks per team at season end (for Ranks archive). */
  teamDisciplineRankSnapshots?: TeamDisciplineRankSnapshotRecord[];
  /** Woher `teamDisciplineRankSnapshots` stammt — fehlt bei Altständen (dann: Live-Kader beim Abschluss). */
  teamDisciplineRankSnapshotMeta?: TeamDisciplineRankSnapshotMeta;
  matchdayResults?: MatchdayResultRecord[];
  disciplineResults?: DisciplineResultRecord[];
  playerDisciplinePerformances?: PlayerDisciplinePerformanceRecord[];
  disciplineHighlights?: DisciplineHighlightRecord[];
  playerPerformances: SeasonSnapshotPlayerPerformanceRecord[];
  playerPerformanceSnapshots?: SeasonSnapshotPlayerPerformanceRecord[];
  transferSnapshots?: SeasonSnapshotTransferRecord[];
  gmAssignments?: SeasonSnapshotGeneralManagerRecord[];
  /**
   * DIE AUSZEICHNUNGEN DIESER SAISON — Ticket #41.
   *
   * CHRIS: „Dafür hätte ich gerne im Spielerprofil die Icons dass man auch später direkt sieht ah
   * der spieler gehört [dazu]". Genau daran haengt dieses Feld: `buildSeasonReview` ermittelt die
   * Auszeichnungen beim Saisonabschluss, aber sie wurden NIRGENDS abgelegt. Mit dem
   * Saisonwechsel waren sie weg — ein Spieler konnte also MVP gewesen sein, ohne dass es eine
   * Saison spaeter noch irgendwo stand.
   *
   * Optional, weil Bestandsspielstaende das Feld nicht haben. Fehlt es, zeigt das Profil keine
   * Auszeichnungen statt falscher — eine leere Liste waere hier eine Luege.
   */
  seasonAwards?: SeasonSnapshotAwardRecord[];
  /** Set when rosterEnd/cashEnd were refreshed from the next season's preseason (post-buy entry state). */
  entryRosterPatchedAt?: string | null;
  entryRosterPatchedFromSeasonId?: string | null;
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

export type NewGameFlowStepId =
  | "season_intro"
  | "team_confirm"
  | "roster_review"
  | "appoint_captain"
  | "first_transfers"
  | "fill_roster"
  | "training_facilities"
  | "choose_sponsor"
  | "set_lineup";

export type NewGameFlowStepStatus = "open" | "completed" | "skipped";

export type NewGameFlowStepRecord = {
  stepId: NewGameFlowStepId;
  status: NewGameFlowStepStatus;
  completedAt?: string | null;
  skippedAt?: string | null;
};

export type NewGameFlowState = {
  active: boolean;
  selectedTeamId?: string | null;
  dismissed?: boolean;
  completedAt?: string | null;
  updatedAt?: string | null;
  steps?: NewGameFlowStepRecord[];
  /**
   * KOOP: der Einstiegs-Fortschritt EINES Raum-Teilnehmers, keyed per `participantId`.
   *
   * WARUM: Beim 4v4-Preset baut JEDER Mensch seinen eigenen Kader auf (siehe
   * `kickoffLeagueSetupDraft`-Ausschluss beider Team-Saetze in `startRoom`). Die Top-Level-Felder
   * oben (`active`/`selectedTeamId`/`steps`/`completedAt`/`dismissed`) sind aber EIN Wert fuer den
   * GANZEN Save — bei zwei Menschen ueberschreibt jeder Schreibzugriff den des anderen
   * (`selectedTeamId` last-writer-wins) und ein team-loser Schritt wie `season_intro` gilt nach
   * EINEM Abschluss faelschlich fuer BEIDE. Siehe Messbefund in
   * `tests/coop-onboarding-new-game-flow-zwei-sitzungen.test.ts`.
   *
   * MIGRATIONSREGEL (bindend fuer jeden Leser dieses Feldes, siehe
   * `lib/game/new-game-flow-scope.ts`): fehlt `byParticipant` ODER fehlt darin ein Eintrag fuer den
   * fragenden Teilnehmer (aeltere Saves, Solo-Saves, oder der Teilnehmer hat noch keinen eigenen
   * Schritt geschrieben), gelten die TOP-LEVEL-Felder dieses Objekts unveraendert als Fallback —
   * das IST der Normalfall fuer Solo, kein Sonderfall. Ein Solo-Save befuellt `byParticipant` nie
   * und verhaelt sich dadurch bit-identisch zum Verhalten vor Einfuehrung dieses Feldes. Sobald ein
   * Save an einen Raum mit einem bekannten Teilnehmer gebunden ist, wird ausschliesslich hier
   * gelesen/geschrieben — die Top-Level-Felder bleiben dann auf ihrem Anfangszustand eingefroren
   * (kein Feld wird doppelt gepflegt, sie sind nur noch der Alt-Save-Fallback).
   */
  byParticipant?: Record<string, NewGameFlowState>;
};

export type AdminBalancingConfigInput = {
  version?: number;
  classProgressionWeights?: Record<string, Partial<Record<PlayerGeneratorAttributeName, number>>>;
  traitTrainingFactorsPct?: Record<string, number>;
  prizeMoneyPercents?: number[];
  updatedAt?: string | null;
};

export type AdminBalancingConfig = {
  version: number;
  classProgressionWeights: Record<string, Record<PlayerGeneratorAttributeName, number>>;
  traitTrainingFactorsPct: Record<string, number>;
  prizeMoneyPercents: number[];
  updatedAt?: string | null;
};

/** A team the fresh-Season-1 background roster-fill left below its minimum roster (or otherwise blocked). */
export type LeagueSetupTeamWarning = {
  teamId: string;
  teamName: string;
  rosterAfter: number;
  targetMin: number;
  status: string;
};

/**
 * Frozen per-player valuation row captured at MD10 season end. Once the season is completed
 * (gamePhase !== "season_active"), OVR/MVS/PPs/MW and the sale-factor bracket rank are read from
 * this snapshot instead of being recomputed pool-relative, so post-season sales/roster changes do
 * NOT shift the valuations of the remaining players. All fields are null-tolerant for draft/import
 * players without ratings.
 */
export type FrozenValuationPlayerRow = {
  playerId: string;
  frozenOvr: number | null;
  frozenOvrRank: number | null;
  frozenMvs: number | null;
  frozenMvsRank: number | null;
  frozenPps: number | null;
  frozenPpsRank: number | null;
  frozenPpPow: number | null;
  frozenPpPowRank: number | null;
  frozenPpSpe: number | null;
  frozenPpSpeRank: number | null;
  frozenPpMen: number | null;
  frozenPpMenRank: number | null;
  frozenPpSoc: number | null;
  frozenPpSocRank: number | null;
  frozenMw: number | null;
  frozenSaleBracket: number | null;
  frozenSaleRankInBracket: number | null;
  frozenSaleBracketSize: number | null;
};

export type FrozenValuationSnapshot = {
  seasonId: string;
  frozenAtMatchdayId: string;
  createdAt: string;
  playersById: Record<string, FrozenValuationPlayerRow>;
  teamAggregatesByTeamId?: Record<string, { frozenTeamOvr: number | null; frozenTeamMvs: number | null }>;
};

export type SeasonState = {
  seasonId: string;
  schedule: Fixture[];
  disciplineSchedule?: SeasonDisciplineScheduleEntry[];
  seasonEconomyFactors?: SeasonEconomyFactorRecord[];
  /**
   * Fresh-Season-1 league setup: the AI teams' rosters are auto-filled in the background right after the
   * save is created (the fill takes ~40s). "in_progress" while it runs, "ready" once every team has a roster,
   * "failed" if the background fill errored (the human can retry the fill from the Cockpit). Absent = no
   * background setup pending (e.g. an already-populated save). The UI shows a "Liga wird erstellt…" state and
   * polls until "ready" before letting the human start matchdays.
   */
  leagueSetupStatus?: "in_progress" | "ready" | "failed";
  /**
   * Teams that the fresh-Season-1 background roster-fill could NOT bring up to their minimum roster (or that
   * ended blocked). Empty/absent = every team reached at least its minimum. `leagueSetupStatus` may still be
   * "ready" (the league is playable) while this is non-empty — the UI surfaces these as "needs attention"
   * instead of pretending the fill fully succeeded, so an under-filled team is never silently shipped.
   */
  leagueSetupWarnings?: LeagueSetupTeamWarning[];
  standings: Record<string, StandingRecord>;
  teamIdentityOverrides?: Record<string, TeamIdentityOverride>;
  teamGeneralManagers?: Record<string, TeamGeneralManagerAssignment>;
  teamControlSettings?: Record<string, TeamControlSettings>;
  teamStrategyProfiles?: Record<string, TeamStrategyProfile>;
  aiPreseasonAutomationRuns?: Record<string, AiPreseasonAutomationRunRecord>;
  teamFacilities?: Record<string, TeamFacilityCollection>;
  /**
   * GELIEHENE GEBÄUDE aus laufenden Sponsorvertraegen, je Team. Sie liegen NEBEN dem eigenen
   * Bestand, nicht darin: `getTeamFacilityState` legt sie beim Lesen darueber (Maximum aus eigen
   * und geliehen), sodass jede Wirkungsrechnung sie sieht, ohne von der Leihe zu wissen. Endet der
   * Vertrag oder reisst die Rangmarke, faellt das Team auf den eigenen Bestand zurueck — deshalb
   * darf die Leihe nie in `teamFacilities` geschrieben werden.
   */
  sponsorLeihgabenByTeamId?: Record<string, SponsorLeihgabeRecord[]>;
  /** Offene Übernahme-Angebote aus ausgelaufenen Leihverträgen (siehe `SponsorUebernahmeAngebot`). */
  sponsorUebernahmeAngeboteByTeamId?: Record<string, SponsorUebernahmeAngebot[]>;
  facilityEvents?: FacilityEventRecord[];
  teamSeasonObjectives?: TeamSeasonObjectiveRecord[];
  boardConfidence?: Record<string, TeamBoardConfidenceRecord>;
  previousSeasonBoardConfidence?: Record<string, TeamBoardConfidenceRecord>;
  teamRelationshipEvents?: TeamRelationshipEventRecord[];
  contractEvents?: ContractEventRecord[];
  playerAvailabilityState?: PlayerAvailabilityStateRecord[];
  injuryEvents?: InjuryEventRecord[];
  preSeasonWorkflowLogs?: PreSeasonWorkflowLogRecord[];
  playerGeneratorDrafts?: PlayerGeneratorDraft[];
  contractNegotiationDrafts?: ContractNegotiationDraft[];
  transferWishlist?: TransferWishlistEntry[];
  transferSellMarkers?: TransferSellMarkerEntry[];
  standingsApplyLogs?: StandingsApplyAuditLogRecord[];
  /**
   * Audit R2/V4: Saison-IDs, für die die Formkarten-Übernutzungs-Strafe bereits auf die Endtabelle
   * angewandt wurde (Punktabzug + Re-Rank, in der season-completion-Kaskade VOR Snapshot/Rang-Payouts).
   * Idempotenz-Marker, damit ein erneuter Abschluss-Lauf die Strafpunkte nicht doppelt abzieht.
   */
  formCardPenaltyAppliedSeasonIds?: string[];
  /**
   * Audit R2/V7: Ledger der Notfall-Kasse-Aufstockungen (KI-Preseason-Roster-Reparatur unter Cash-Floor).
   * Macht das aus dem Nichts erzeugte Geld auditierbar (siehe AiEmergencyCashInjectionRecord).
   */
  aiEmergencyCashInjections?: AiEmergencyCashInjectionRecord[];
  cashPrizeApplyLogs?: CashPrizeApplyLogRecord[];
  matchdayAdvanceLogs?: MatchdayAdvanceLogRecord[];
  objectiveRewardApplyLogs?: ObjectiveRewardApplyLogRecord[];
  /**
   * WELCHES SPONSORSYSTEM DIESER SPIELSTAND BENUTZT — im Save, nicht in der Umgebung.
   *
   * Vorher entschied eine Umgebungsvariable (`OLY_SPONSOR_V2`) im Moment der Angebotserzeugung,
   * welches Modell ein Spiel bekommt. Danach war sie unsichtbar wirkungslos — und das war die
   * eigentliche Falle: startete derselbe Spielstand spaeter auf einem Server ohne die Variable,
   * erzeugte der naechste Saisonuebergang (`ensureSeasonSponsorOffers`) fuer ein V2-Spiel
   * stillschweigend wieder Angebote nach altem Recht. Das Regelwerk kippte, je nachdem wie der
   * Server gestartet wurde.
   *
   * Deshalb steht die Version jetzt IM SPIELSTAND und wird genau einmal bei der Erzeugung gesetzt.
   * `3` = Preisgeld-Sockel mit EV-neutralen Aufsaetzen (lib/sponsor/sponsor-v3-*), `2` = das
   * abgeloeste Kurve-x-Klausel-x-Sonderziel-Modell, `1` = das Modell davor.
   *
   * DER VERMERK BESCHREIBT AB V3 NUR NOCH DIE HERKUNFT. Die Abrechnung selbst haengt nicht mehr
   * daran: `sponsorLadderMigrationVersion` unten sagt, ob die Leitern dieses Spielstands schon auf
   * die V3-Basis gehoben wurden — und danach rechnen alle noch offenen Vertraege nach V3.
   */
  sponsorSystemVersion?: 1 | 2 | 3;
  /**
   * MIGRATION M1 (docs/SPONSOR_PREISGELD_SOCKEL_ENTWURF.md, Abschnitt 5). Versionsstempel der
   * einmaligen Neuberechnung noch NICHT abgerechneter Sponsorleitern auf die V3-Basisleiter.
   *
   * Warum ueberhaupt eine Migration, obwohl unterschriebene Vertraege sonst nie nachtraeglich
   * geaendert werden: die Regel schuetzt vor STILLER DRIFT (Anzeige != Settlement, Ankerwanderung).
   * M1 ist das Gegenteil davon — eine explizite, einmalige, versionierte Design-Korrektur. Wer die
   * alte Leiter behaelt, konserviert einen erkannten Systemfehler eine volle Saison lang; das
   * schuetzt keinen Spieler, es schuetzt den Fehler. Der Stempel sorgt dafuer, dass sie GENAU EINMAL
   * laeuft; danach gilt die Nie-nachtraeglich-Regel unveraendert auch fuer V3-Leitern.
   */
  sponsorLadderMigrationVersion?: number;
  sponsorOffersByTeamId?: Record<string, SponsorOffer[]>;
  sponsorContractsByTeamId?: Record<string, TeamSponsorContract>;
  sponsorBrandHistoryByTeamId?: Record<string, string[]>;
  sponsorEvents?: SponsorEventRecord[];
  sponsorPayoutLogs?: SponsorPayoutLogRecord[];
  /** Zu Saisonbeginn eingefrorene Apron-Linien dieser Saison. Siehe ApronLinesSnapshot. */
  apronLinesSnapshot?: ApronLinesSnapshot;
  /** Ledger der Apron-Abgaben/Ausschüttungen — Idempotenz-Marker + Audit-Trail, analog sponsorPayoutLogs. */
  apronSettlementLogs?: ApronSettlementLogRecord[];
  /**
   * Fortgeschriebener Beliebtheits-KPI pro Team (TEIL A). Wird 1×/Saison am Saison-Ende (vor der
   * Sponsor-Angebots-Generierung des nächsten Zyklus) fortgeschrieben. Rückwärtskompatibel optional:
   * fehlt der Eintrag, fällt die Fortschreibung auf einen neutralen Vorwert 1.0 zurück.
   */
  beliebtheitByTeamId?: Record<string, TeamBeliebtheitRecord>;
  /** Zeitreihe der fortgeschriebenen Beliebtheits-`value`s pro Team (älteste zuerst), für Debug/Balance. */
  beliebtheitHistoryByTeamId?: Record<string, number[]>;
  /**
   * Golden-Sponsor-Cooldown: true, wenn das Team in der VORSAISON einen golden Slot hatte. Speist den
   * COOLDOWN_PENALTY-Term in rollGoldenLuck, damit kein Team dauerhaft golden bleibt. Rückwärtskompatibel
   * optional: fehlt der Eintrag, gilt hadGoldenLastSeason = false.
   */
  goldenSponsorHistoryByTeamId?: Record<string, boolean>;
  loans?: LoanRecord[];
  loanApplyLogs?: LoanApplyLogRecord[]; // Idempotenz-Log analog objectiveRewardApplyLogs
  loanOriginationLogs?: LoanOriginationLogRecord[]; // Ledger für Kredit-Auszahlung (Origination), siehe T-016
  scoutingWatchlist?: ScoutingWatchlistEntry[];
  scoutIntelByTeamId?: Record<string, PlayerScoutIntelRecord[]>;
  formCards?: FormCardRecord[];
  formCardPlans?: FormCardPlanRecord[];
  teamPowers?: TeamPowerRecord[];
  lineupDrafts?: LineupDraft[];
  /** Per-team depth stress ledger for next-season roster planning (computed at season_end). */
  teamRosterStressByTeamId?: Record<string, TeamRosterStressRecord>;
  matchdayResults?: MatchdayResultRecord[];
  disciplineResults?: DisciplineResultRecord[];
  playerDisciplinePerformances?: PlayerDisciplinePerformanceRecord[];
  disciplineHighlights?: DisciplineHighlightRecord[];
  resultAuditLogs?: ResultAuditLogRecord[];
  /**
   * Die EINE Rechnung des laufenden Spieltags. Entsteht, sobald alle Aufstellungen
   * stehen (also auf dem Weg zur Arena), und ist danach die gemeinsame Quelle fuer
   * die Arena-Buehne und beide Disziplin-Buchungen. Vorher rechneten Vorschau,
   * D1-Commit und D2-Commit jeweils neu — und kamen wegen der zwischenzeitlich
   * geschriebenen Fatigue nicht auf dieselben Zahlen.
   *
   * Immer hoechstens ein Eintrag: der des aktuell offenen Spieltags. Aeltere werden
   * beim Schreiben ersetzt, damit der Save nicht mit Vorschauen zulaeuft.
   */
  matchdayResolveSnapshots?: MatchdayResolveSnapshotRecord[];
  /**
   * Teamstärke-Ränge, festgehalten bei der Wertung eines Spieltags (Standings-Apply) — ein Eintrag
   * pro Saison, der jeweils letzte Spieltag gewinnt. Quelle der `teamDisciplineRankSnapshots` im
   * Saison-Schnappschuss; siehe TeamStrengthRankCaptureRecord.
   */
  teamStrengthRankCaptures?: TeamStrengthRankCaptureRecord[];
  seasonSnapshots?: SeasonSnapshotRecord[];
  /**
   * NUR ANZEIGEFRACHT, NIEMALS QUELLE. Schlanke Fassung der abgeschlossenen Saisons fuer den
   * Browser, weil die Anfangsladung `seasonSnapshots` streicht (siehe
   * `foundation-season-history-projection`). Wird nie in den Spielstand zurueckgeschrieben — sie
   * traegt absichtlich weniger Felder als das Original, und ein Rueckschreiben waere Datenverlust.
   */
  foundationSeasonHistory?: FoundationSeasonHistoryEntry[];
  /**
   * NUR ANZEIGEFRACHT, NIEMALS QUELLE — Geschwister der Saison-Historie oben: der fertige
   * Feld-Rennen-Ledger (gewertete Spieltage je Team), serverseitig auf dem vollen Save
   * gerechnet, weil die Anfangsladung `matchdayResults`/`disciplineResults` auf den aktiven
   * Spieltag beschneidet und ein Browser-Neubau sonst „0 gespielte Spieltage" ergibt
   * (siehe `foundation-field-race-projection`). Wird nie zurueckgeschrieben.
   */
  foundationFieldRace?: FoundationFieldRaceProjection;
  /**
   * HIER STANDEN FUENF WEITERE PROJEKTIONEN — `foundationFormCardBonus`, `foundationRecordBook`,
   * `foundationDisciplineTally`, `foundationMatchdayPoints`, `foundationPpAreaFormBonus`. Sie sind
   * ERSATZLOS ENTFERNT.
   *
   * Alle fuenf gab es nur, weil die Anfangsladung `disciplineResults` und `lineupDrafts` auf den
   * aktiven Spieltag beschnitt. Seit `8ec6454b` fahren beide Listen vollstaendig mit; die Leser
   * rechnen wieder selbst richtig. Nachgemessen an beiden aktiven Spielstaenden: mit und ohne
   * Projektion Zeichen fuer Zeichen dasselbe Ergebnis.
   *
   * Kommt die Beschneidung je zurueck, kommen NICHT die Projektionen zurueck — dann waere der
   * Schnitt selbst der Fehler. Siehe `compactFoundationInitialGameState`.
   */
  aiManagerBudgetReservations?: Record<string, AiManagerBudgetReservationRecord>;
  aiCashBufferDipLedger?: Record<string, AiCashBufferDipLedgerEntry>;
  aiManagerTrainingSettings?: Record<string, AiManagerTrainingSettingRecord>;
  trainingIntensityConfirmations?: Record<string, TrainingIntensityConfirmationRecord>;
  aiManagerContractStrategies?: Record<string, AiManagerContractStrategyRecord>;
  aiManagerSellStrategies?: Record<string, AiManagerContractStrategyRecord>;
  aiLifecyclePhaseRuns?: AiLifecyclePhaseRunRecord[];
  aiManagerMemory?: Record<string, AiManagerMemoryRecord>;
  teamDoctrines?: Record<string, TeamDoctrineRecord>;
  aiSeasonStrategyState?: Record<string, AiSeasonStrategyStateRecord>;
  aiManagerDecisionJournal?: AiManagerDecisionJournalEntry[];
  newGameFlow?: NewGameFlowState;
  adminBalancingConfig?: AdminBalancingConfigInput;
  /** Pre-computed ledger + OVR/PPS/MVS ratings; invalidated via contentSignature. */
  persistedSeasonDerivations?: unknown;
  /**
   * Snapshot of OVR/MVS/PPs/MW + sale-factor bracket ranks taken at MD10 season end. Present only
   * after the season completes; cleared when a new season activates. See FrozenValuationSnapshot.
   */
  frozenValuationSnapshot?: FrozenValuationSnapshot;
};

export type SeasonEconomyFactorRecord = {
  seasonId: string;
  seasonLabel: string;
  horizonIndex: number;
  factor: number;
  source: "sheet_seed" | "rolled" | "carried";
  rollSeed?: string | null;
  carriedFromSeasonId?: string | null;
  generatedAt?: string;
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
  teamPowerId?: string | null;
  intensity?: "conserve" | "normal" | "push" | null;
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
  /**
   * Lesezeichen auf Teams und Spieler, je Besitzer. BEWUSST AUF DER OBERSTEN EBENE und nicht in
   * `seasonState`: die Liste ueberlebt den Saisonwechsel, das ist ihr halber Zweck. Siehe
   * `MerklisteEintrag` und lib/merkliste/merkliste-service.ts.
   */
  merkliste?: MerklisteEintrag[];
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
  /**
   * Abweichungen zwischen gespeicherter und geseedeter Konjunktur-Reihe. Leer im Normalfall;
   * ein Eintrag heisst, dass jemand nachsehen sollte (siehe `SeasonEconomyFactorGuardEvent`).
   */
  seasonEconomyFactorGuardEvents?: SeasonEconomyFactorGuardEvent[];
  playerPotential?: PlayerPotentialRecord[];
  playerMoraleState?: PlayerMoraleState[];
  playerRelationshipEvents?: PlayerRelationshipEventRecord[];
  playerDemands?: PlayerDemandRecord[];
  teamCaptains?: TeamCaptainRecord[];
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
