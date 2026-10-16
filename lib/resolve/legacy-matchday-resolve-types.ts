import type { LegacyMutatorSlotEffect, LegacyResolveMutatorMode } from "@/lib/lineups/legacy-lineup-types";
import type { TeamPowerEffectType, TeamPowerTargetMode } from "@/lib/data/olyDataTypes";
// S. Kommentar an diesem Import in legacy-lineup-types.ts -- `import type` zieht keine
// Playwright-/`node:fs`-Laufzeitimporte mit.
import type { ArenaMomentEintrag } from "@/lib/battle/arena-headless-runner";

export type ResolveHighlightType =
  | "best_player_discipline"
  | "strongest_team_score"
  | "closest_score_gap"
  | "missing_lineup_warning"
  | "injury_event";

export type ResolvePreviewStatus =
  | "ready"
  | "incomplete_lineups"
  | "missing_lineups"
  | "missing_scores"
  | "missing_sources"
  | "blocked";

export type PlayerPerformancePreview = {
  matchdayId: string;
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  teamId: string;
  playerId: string;
  activePlayerId?: string | null;
  playerName: string;
  slotIndex: number;
  baseValue: number;
  fatigueAdjustedValue?: number | null;
  // Same-day injury malus (siehe lib/fatigue/fatigue-calibration.ts INJURY_PERFORMANCE_MULTIPLIER),
  // angewandt NACH Fatigue: injuryAdjustedValue = fatigueAdjustedValue * INJURY_PERFORMANCE_MULTIPLIER,
  // sofern injuryApplied true ist. Für die Arena-Bühne (optisches Verletzungs-Feedback +
  // Score-Aufschlüsselung), siehe lib/foundation/discipline-stage/discipline-stage-from-preview.ts.
  injuryApplied?: boolean;
  injuryAdjustedValue?: number | null;
  captainBonus?: number | null;
  mutatorBonus?: number | null;
  mutatorPpsBonus?: number | null;
  /** MUTATOR ORGANISCH (29.09.): Trefferzahl 0/1/2, s. `LegacyScoredEntry.mutatorHits`. */
  mutatorHits?: number | null;
  formShare?: number | null; // pro Spieler angewandter Form-Anteil (flach + Jitter)
  /** Sein eigener Intensitaets-Wurf (schonen/normal/pushen), seeded pro Spieler und Spieltag. */
  intensityShare?: number | null;
  /** Der Modifikator SEINER Slot-Rolle (Clutch Shot, Fastbreak und so weiter). */
  slotRoleShare?: number | null;
  /** Sein anteiliger Teil der echten Seiten-Effekte: Team-Power, Mutator-Rest, Rundung. */
  teamEffectShare?: number | null;
  /** Sein anteiliger Teil der Team-Power — eigenes Feld, damit die Buehne sie benennen kann. */
  teamPowerShare?: number | null;
  finalPlayerScore: number;
  scoreContribution: number;
  pointsAwarded: number | null;
  pointSource: string;
  /**
   * BOXSCORE-AN-PPS (docs/design/boxscore-an-pps.md): true NUR fuer Battle-Mode-Basketball, wenn
   * `pointsAwarded` oben tatsaechlich aus dem echten Arena-Boxscore-Impact kam statt aus der alten
   * PPS-Rang-Formel — s. lib/resolve/battle-mode-arena-team-points.ts. Rein informativ (Debug/
   * Anzeige); fehlt es (aeltere Preview-Objekte), gilt der Default "false" — kein
   * Verhaltensunterschied.
   */
  arenaBoxscoreImpactApplied?: boolean;
  rankInTeam: number;
  rankInDiscipline: number;
  isTop10: boolean;
  isMvpCandidate: boolean;
  storyWeight?: number;
};

export type DisciplineHighlightCandidate = {
  matchdayId: string;
  disciplineId: string;
  highlightType: ResolveHighlightType;
  teamId?: string;
  playerId?: string;
  relatedTeamId?: string;
  importanceScore: number;
  shortSummary?: string;
  payload: Record<string, unknown>;
};

/**
 * Woher `teamPoints` einer Disziplin-Zeile stammt:
 *  - `"pps"`: Manager-Mode-Rangtabelle (`getRankToPointsValue()`), Standard ausserhalb von Battle Mode.
 *  - `"arena"`: Battle Mode, 2/1/0 aus einem echten Arena-Duell.
 *  - `"pps_duell"`: Battle Mode, 2/1/0 aus dem PPS-Score beider Seiten desselben Fixtures
 *    (PPS-Duell-Bruecke, lib/resolve/battle-mode-pps-duell.ts) — der verbindliche Rueckfall ohne
 *    Arena-Ergebnis.
 */
export type DisciplineResolutionSource = "pps" | "arena" | "pps_duell";

/**
 * SICHTBARE ARENA-AUSFÄLLE (Plan `docs/design/battle-arena-auto-run-anbindung-plan-16-10.md`
 * Abschnitt 3.1, PR 1 — harte Auflage der Projektaufsicht): Grund, warum eine arena-aufgelöste
 * Disziplin (`ARENA_RESOLVED_DISCIPLINE_IDS`) in dieser Zeile KEIN Arena-Ergebnis trägt, sondern
 * über die PPS-Duell-Brücke läuft. `"nicht_ausgefuehrt"` ist die Engine-Strukturprüfung selbst
 * (Abschnitt 3.2 Punkt 4) — sie greift immer dann, wenn weder ein Arena-Override noch einer der
 * anderen, explizit übergebenen Gründe vorliegt. Das ist GENAU der heutige K1-Zustand (der
 * Auto-Run ruft die Arena nie auf, s. Plan Abschnitt 1.1): bis PR 3 den Arena-Vorlauf anbindet,
 * bekommt JEDE gebuchte Zeile einer arena-aufgelösten Disziplin in einem Battle-Save diesen Grund
 * — bewusst und laut statt, wie bisher, nur über `console.warn` (Befund F2).
 */
export type ArenaAusfallGrund =
  | "chromium_start" // Launch scheitert: Binary fehlt, Abhaengigkeit fehlt (E1)
  | "timeout" // seitenTimeoutMs oder Gesamt-Timeout
  | "absturz" // Target/Page closed, Renderer crash, OOM
  | "liga_fehlgeschlagen" // eine Liga warf, die andere lief (Teil-Ausfall)
  | "ergebnis_unvollstaendig" // arena_matchday_missing_result: Team ohne Duell-Ergebnis
  | "abgebrochen_neustart" // in_progress aelter als 5 min (erst ab PR 3 relevant)
  | "deaktiviert" // arenaModus "aus" (Tests/Notschalter, erst ab PR 3 relevant)
  | "nicht_ausgefuehrt"; // Engine-Strukturpruefung: gewertet, aber nie versucht (die K1-Klasse)

export type ArenaAusfall = {
  grund: ArenaAusfallGrund;
  /** gekuerzte Fehlermeldung, max. 200 Zeichen, nur fuer Log/Tooltip. */
  detail?: string | null;
  leagueTier?: string | null;
  zeitpunkt: string;
  versuch: number;
};

export type DisciplineTeamResolvePreview = {
  teamId: string;
  teamName: string;
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  status: ResolvePreviewStatus;
  baseScore: number;
  fatigueModifier: number | null;
  fatigueStatus: "mapped" | "missing_source";
  intensity?: "conserve" | "normal" | "push" | null;
  intensityModifier?: number | null;
  captainStatus: "mapped" | "missing_source";
  captainBonus: number | null;
  formCardStatus: "ready" | "missing_source";
  formCardLabel: string | null;
  formModifier: number | null;
  mutatorMode: LegacyResolveMutatorMode;
  mutatorModifier: number | null;
  mutatorSlots: LegacyMutatorSlotEffect[];
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
  teamPpsModifier: number | null;
  teamPpsStatus: "ready" | "missing_source";
  finalPreviewScore: number;
  score: number;
  rank: number;
  teamPoints: number | null;
  pointSource: string;
  /**
   * Battle Mode PR7 (docs/design/battle-mode-spielmodus-plan.md, Abschnitt 2.4): woher `teamPoints`
   * stammt — `"pps"` (Standard, jede Manager-Mode-Disziplin und jede Nicht-Basketball-Disziplin in
   * Battle Mode) oder `"arena"` (Battle-Mode-Basketball, `teamPoints` kommt aus einem echten
   * Arena-Duell, s. lib/resolve/battle-mode-arena-team-points.ts). Fehlt das Feld (aeltere
   * Preview-Objekte), gilt der Default `"pps"` — kein Verhalten aendert sich dadurch.
   */
  resolutionSource?: DisciplineResolutionSource;
  /**
   * PUNKTEVERHAELTNIS (docs/design/pps-duell-bruecke-punkteverhaeltnis-16-10.md): nur bei einem
   * Duell-Ergebnis (`resolutionSource` `"arena"` oder `"pps_duell"`) gesetzt, sonst `null`/fehlend.
   * `marge` = roher Abstand beider Seiten, `verhaeltnis` = ±D (0..10) aus Sicht dieses Teams,
   * `margeM90` = die verwendete Bezugsgroesse (`null` = Rueckfall-D ohne gezogene Referenz).
   * `duellSeiten` = Rohwerte [dieses Team, Gegner] (PPS-Scores bzw. Arena-Seitenstand).
   */
  marge?: number | null;
  verhaeltnis?: number | null;
  margeM90?: number | null;
  duellSeiten?: [number, number] | null;
  /**
   * Nur gesetzt, wenn `resolutionSource === "arena"`: der deterministische Seed
   * (`${saveId}:${seasonId}:${matchdayId}:arena:${homeTeamId}:${awayTeamId}`), mit dem sich genau
   * dieses Arena-Duell reproduzieren liesse. Die "Versionierung", die Chris fuer PR7 wollte — keine
   * Replay-Funktion, nur eine sichtbare, nachvollziehbare Kennung je Ergebnis.
   */
  arenaMatchSeed?: string | null;
  /**
   * "SPIEL DES TAGES" (Task #31 Paket 1, docs/design/fable-ideen-feldspiel-30-09.md Abschnitt 2.1,
   * Klasse A): wie `arenaMatchSeed` nur gesetzt, wenn `resolutionSource === "arena"` -- die drei
   * aus dem Ereignisprotokoll des gelaufenen Arena-Duells abgeleiteten Momente (s.
   * `ArenaMomentEintrag`, lib/battle/arena-headless-runner.ts), fuer Heim UND Gast identisch.
   */
  momente?: ArenaMomentEintrag[] | null;
  /**
   * Tasks #116/#118/#119/#126/#127 (Fechten/Showcase/Eiskunstlauf/Tennis/Schach
   * sequenziell+Reveal, Chris 13.10.): wie `arenaMatchSeed` nur gesetzt, wenn
   * `resolutionSource === "arena"` -- die Team-ID des Gegners in diesem Zwei-Team-Duell. Treibt
   * die paarweise Board-Sequenz + den Matchup-Reveal auf der Bühne (`prim === "lamps"` /
   * `"klassen"` / `"stage"`); für jede andere Disziplin ungenutzt.
   */
  opponentTeamId?: string | null;
  /**
   * SICHTBARE ARENA-AUSFÄLLE (s. `ArenaAusfall` oben): nur gesetzt, wenn diese Zeile eine
   * arena-aufgelöste Disziplin ohne Arena-Ergebnis ist — nie bei `resolutionSource === "arena"`
   * (dort lief die Arena ja) und nie außerhalb von Battle Mode bzw. außerhalb
   * `ARENA_RESOLVED_DISCIPLINE_IDS` (Manager-Mode-Zeilen bekommen diesen Schlüssel nie, bleiben
   * also byte-identisch zum Stand vor dieser Ergänzung).
   */
  arenaAusfall?: ArenaAusfall | null;
  warnings: string[];
  missingLineup: boolean;
  missingPlayers: number;
  isComplete: boolean;
  missingScores: string[];
  entries: Array<{
    playerId: string;
    activePlayerId: string | null;
    playerName: string;
    slotIndex: number;
    baseValue: number | null;
    fatigueAdjustedValue: number | null;
    injuryApplied?: boolean;
    injuryAdjustedValue?: number | null;
    captainBonus: number | null;
    mutatorBonus?: number | null;
    mutatorPpsBonus?: number | null;
    mutatorHits?: number | null;
    formShare?: number | null; // pro Spieler angewandter Form-Anteil (flach + Jitter)
    /** Sein eigener Intensitaets-Wurf (schonen/normal/pushen), seeded pro Spieler und Spieltag. */
    intensityShare?: number | null;
    /** Der Modifikator SEINER Slot-Rolle (Clutch Shot, Fastbreak und so weiter). */
    slotRoleShare?: number | null;
    /** Sein anteiliger Teil der echten Seiten-Effekte: Team-Power, Mutator-Rest, Rundung. */
    teamEffectShare?: number | null;
    /** Sein anteiliger Teil der Team-Power — eigenes Feld, damit die Buehne sie benennen kann. */
    teamPowerShare?: number | null;
    finalPlayerScore: number | null;
    pointsAwarded?: number | null;
    /**
     * BOXSCORE-AN-PPS (docs/design/boxscore-an-pps.md): true NUR fuer Battle-Mode-Basketball, wenn
     * `pointsAwarded` oben aus dem echten Arena-Boxscore-Impact kam statt aus der alten PPS-Rang-
     * Formel. Rein informativ; fehlt es (aeltere Preview-Objekte), gilt der Default "false".
     */
    arenaBoxscoreImpactApplied?: boolean;
    isCaptain: boolean;
    warnings: string[];
  }>;
};

export type DisciplineResolvePreview = {
  disciplineId: string;
  disciplineName: string;
  disciplineSide: "d1" | "d2";
  teamResults: DisciplineTeamResolvePreview[];
  topPlayers: PlayerPerformancePreview[];
  highlightCandidates: DisciplineHighlightCandidate[];
};

export type TeamResolvePreview = {
  teamId: string;
  teamName: string;
  status: ResolvePreviewStatus;
  d1DisciplineId: string | null;
  d1Status: ResolvePreviewStatus;
  d1Score: number;
  d1Points: number | null;
  d2DisciplineId: string | null;
  d2Status: ResolvePreviewStatus;
  d2Score: number;
  d2Points: number | null;
  totalScore: number;
  totalPoints: number | null;
  rank: number;
  warnings: string[];
  missingLineup: boolean;
  missingScores: string[];
};

export type LegacyMatchdayResolvePreview = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  status: ResolvePreviewStatus;
  disciplinePreviews: DisciplineResolvePreview[];
  teamResults: TeamResolvePreview[];
  warnings: string[];
  missingLineups: Array<{
    teamId: string;
    teamName: string;
  }>;
  incompleteLineups: Array<{
    teamId: string;
    teamName: string;
    disciplineSide: "d1" | "d2";
  }>;
  missingScores: string[];
};
