import type {
  GameState,
  InjuryEventRecord,
  LineupDraft,
  Player,
  PlayerAvailabilityStateRecord,
  PlayerInjuryRiskRollRecord,
  PlayerInjuryStatus,
} from "@/lib/data/olyDataTypes";
import { applyRecoveryFacilityModifiers, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import {
  appendPlayerInjuryHistory,
  injuryEventToPlayerHistoryRecord,
} from "@/lib/foundation/player-injury-history";
import {
  FATIGUE_INJURY_RISK_ANCHORS,
  getInjuryPerformanceMultiplier,
  getInjuryRiskBand,
  getInjuryRiskPercent,
  injuryRiskBands,
  type InjuryRiskBand,
} from "@/lib/fatigue/fatigue-calibration";
import type { MatchdayIntensityStage } from "@/lib/lineups/matchday-slot-roles";
import { applyTrainingRecoveryImpact } from "@/lib/training/training-recovery-impact";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import { getPlayerFatigueLoadMultiplier } from "@/lib/traits/cosmetic-trait-soft-effects";

export const FATIGUE_INJURY_SOURCE = "fatigue_injury_risk_v1" as const;
export const FATIGUE_INJURY_REHEARSAL_SOURCE = "fatigue_injury_rehearsal_v1" as const;
// Fatigue-Kalibrierung (Balancing): Recovery/Last-Ratio eng genug, dass Fatigue ein GLATTER,
// universeller Constraint ist (auch für Rotierer, nicht nur Dauerspieler) und echte Kadertiefe
// belohnt — aber NICHT so hart, dass Verletzungen explodieren. Ratio ~1,67 (20/12): ein Ruhetag
// (Recovery) löscht ~1,7 Spieltage (Last) — enger als die alten 2,2 (24/11, wo ein Ruhetag zwei
// Spieltage tilgte und Fatigue für Rotierer wirkungslos war), aber load 15 hatte überschossen
// (Verletzungen ~verdoppelt, 22/32 Teams rot). `BASE_MATCHDAY_RECOVERY = 20` ist die Basis, für die
// die REHA-Recovery-Leiter designt war (L5 = 20 + 12 = 32 absolut, siehe RECOVERY_FLAT_BONUS_BY_LEVEL).
//
// Owner-Entscheidung (2026-07): push bleibt bei 1.4 (siehe INTENSITY_FATIGUE_MULT unten) -- statt
// push zurueckzudrehen, senkt der Owner den GENERELLEN Verbrauch, um die Saison-Verletzungszahl auf
// ~200 (Ziel-Korridor) zu bringen. Sweep bei Push=1.4: Load 12 ergab 268/297 (Mittel ~283, klar
// drueber); Load 10 ergab 234/184 (Mittel 209, im Korridor) -- siehe PR fuer den vollen Sweep und
// die Multi-Season-Gegenprobe. ENV-tunable (OLY_FATIGUE_MATCHDAY_LOAD) fuer weiteres Tuning ohne
// Code-Aenderung.
function envNumber(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * LAST JE EINSATZ — 2026-08 von 10 auf 15 angehoben (Owner-Entscheidung).
 *
 * GEMELDET VON CHRIS: „ich habe das gefühl es ist zu einfach auch mit 9 spielern verletzungen zu
 * vermeiden! sonst muss ein einsatz auf allen 3 stufen etwas mehr kosten." — Anheben der BASIS
 * skaliert automatisch alle drei Intensitätsstufen (siehe `INTENSITY_FATIGUE_MULT`): schonen
 * 7,5 → 11,25, normal 10 → 15, pushen 14 → 21. Das Verhältnis zwischen den Stufen bleibt exakt
 * erhalten, die 2026-07 austarierte Score-je-Fatigue-Abwägung also auch.
 *
 * WARUM ES NÖTIG WURDE — die Kalibrierung oben ist ÜBERHOLT, nicht falsch. Sie stammt aus einer
 * Zeit mit STEILERER Risikokurve. Danach wurde die Kurve zweimal auf Chris' Wunsch abgeflacht:
 * erst die Schutzzone bis Fatigue 25 (Risiko dort exakt 0), dann der Anker bei 50 von 10 % auf 3 %
 * (beides in `fatigue-calibration.ts` dokumentiert). Beide Änderungen waren richtig — ein frischer
 * Spieler soll sich nicht grundlos verletzen. Nur hat danach niemand die LAST nachgezogen, und
 * damit fiel die Verletzungszahl mit durch.
 *
 * GEMESSEN, mit `scripts/export-injury-balance-audit.ts` gegen den echten Spielstand (32 Teams,
 * 10 Spieltage, Rotation nach niedrigster Fatigue):
 *
 *   Last 10 →  63 Verletzungen je Saison   (die Kalibrierung oben nannte für Last 10 noch 234/184
 *                                           — derselbe Simulator, aber die alte, steilere Kurve)
 *   Last 12 → 103      Last 14 → 166
 *   Last 15 → 199  ← trifft den Ziel-Korridor „~200" der ursprünglichen Kalibrierung
 *   Last 16 → 236      Last 18 → 321      Last 20 → 378
 *
 * Am echten Spielstand (Saison 1: 38 Verletzungen bei Last 10) hochgerechnet ergibt Last 15 rund
 * 120. Der Simulator läuft also etwa 1,7× heisser als die echte Saison — er kennt die
 * Trainingsmodus-Erholung nicht (`base_recovery_20_plus_facilities` steht in seiner eigenen
 * Annahmen-Liste) und besetzt beide Disziplinen an JEDEM Spieltag, während real auch halb
 * gewertete Spieltage vorkamen. 15 ist deshalb der vorsichtige Wert: er stellt auf der Skala der
 * URSPRÜNGLICHEN Kalibrierung den alten Korridor wieder her, ohne über ihn hinauszuschiessen.
 *
 * NEBENWIRKUNG, die gewollt ist: Kadertiefe zählt wieder. Bei Last 15 geraten 15 von 32 Teams
 * mindestens einmal in Aufstellungs-Not (bei Last 10 waren es 8) — genau der Druck, den ein
 * 9-Mann-Kader spüren SOLL. Ab Last 18 kippt das (21 von 32); dort wäre es keine Tiefe-Belohnung
 * mehr, sondern Unfähigkeit, überhaupt aufzustellen.
 *
 * WEITER TUNEN ohne Code-Änderung: `OLY_FATIGUE_MATCHDAY_LOAD`, und der Sweep oben ist mit
 * `OLY_FATIGUE_MATCHDAY_LOAD=<n> npx tsx scripts/export-injury-balance-audit.ts` reproduzierbar.
 */
export const MATCHDAY_FATIGUE_LOAD = envNumber("OLY_FATIGUE_MATCHDAY_LOAD", 15);
export const BASE_MATCHDAY_RECOVERY = 20;

/**
 * Discipline-side INTENSITY (Schonen/conserve, normal, Pushen/push) must scale the per-player
 * matchday fatigue load, not just the match score. Conserve saves ~25 % load (a real reason to
 * rotate down when leverage is low); push costs 40 % more (a deliberate, sparing gamble that
 * trades stamina + injury risk for score). Moderate + ENV-tunable so the fatigue-validation sim
 * can retune without a code change (OLY_FATIGUE_INTENSITY_CONSERVE / OLY_FATIGUE_INTENSITY_PUSH).
 * Normal stays exactly 1.0 so the standard path is byte-identical to the pre-change behaviour.
 *
 * Owner-Entscheidung (2026-07): push war strikt dominant -- +3 Score fuer nur +1,8 Fatigue
 * (Load 12 * 0.15) sind 1,67 Score/Fatigue-Punkt, waehrend Schonen -2 Score kostet, um 3 Fatigue
 * zu sparen (0,67 Score/Fatigue-Punkt). Pushen war damit ~2,5x effizienter als Schonen -- die
 * Intensitaets-Wahl war keine echte Entscheidung. Bei 1.4 (Load 12 * 0.4 = 4,8 Mehr-Fatigue) liegt
 * das Verhaeltnis bei 3 / 4,8 = 0,63 Score/Fatigue-Punkt -- nah an Schonen, also ein echter Trade-off.
 * push BLEIBT bei 1.4 (siehe MATCHDAY_FATIGUE_LOAD oben fuer den Injury-Korridor-Fix).
 */
function envMultiplier(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const INTENSITY_FATIGUE_MULT: Record<MatchdayIntensityStage, number> = {
  conserve: envMultiplier("OLY_FATIGUE_INTENSITY_CONSERVE", 0.75),
  normal: 1.0,
  push: envMultiplier("OLY_FATIGUE_INTENSITY_PUSH", 1.4),
};

/**
 * Higher-load ordering (push > normal > conserve) used to dedup a player who appears on both
 * discipline sides of the same team: the harsher intensity governs their fatigue accrual.
 */
const INTENSITY_LOAD_RANK: Record<MatchdayIntensityStage, number> = {
  conserve: 0,
  normal: 1,
  push: 2,
};

function normalizeIntensityStage(value: unknown): MatchdayIntensityStage {
  return value === "conserve" || value === "push" || value === "normal" ? value : "normal";
}

/**
 * Deterministische Phasendauern der Verletzungs-Timeline (in Spieltagen), gemessen relativ zum
 * Spieltag, an dem sich der Spieler verletzt hat (`injuredAtMatchdayId`).
 *
 * - INJURY_UNAVAILABLE_MATCHDAYS: Ausfallzeit — Spieltage nach der Verletzung, an denen der
 *   Spieler gesperrt ist (`injured` + unavailable). Deckungsgleich mit `unavailableForMatchdays`.
 * - INJURY_RECOVERING_MATCHDAYS: anschließendes Erholungsfenster — der Spieler ist wieder
 *   einsatzfähig, aber noch als `recovering` markiert, bevor er auf `healthy` zurückfällt.
 *
 * Der Status wird ausschließlich aus diesen Spieltags-Fenstern abgeleitet und hängt NICHT davon
 * ab, dass ein späterer Spieltag-Apply eine Status-Transition anstößt. Dadurch (a) friert eine
 * Verletzung am letzten Spieltag der Saison nicht dauerhaft als `injured` ein und (b) kehrt
 * `recovering` nach Ablauf des Fensters innerhalb der Saison zu `healthy` zurück.
 */
export const INJURY_UNAVAILABLE_MATCHDAYS = 1;
export const INJURY_RECOVERING_MATCHDAYS = 1;

export { getInjuryRiskBand, getInjuryRiskPercent, injuryRiskBands, type InjuryRiskBand };
export const FATIGUE_INJURY_RISK_CURVE = FATIGUE_INJURY_RISK_ANCHORS;

export type PlayerAvailabilityView = PlayerAvailabilityStateRecord & {
  isUnavailable: boolean;
  blocker: "player_injured_unavailable" | null;
};

export type PlayerAvailabilityViewOptions = {
  /**
   * Buchhaltungssicht der Fatigue-Verrechnung: nur die Spieltags-FENSTER zaehlen, die
   * Sperre fuer die noch offene Disziplin desselben Spieltags bleibt aussen vor.
   *
   * Wer an Spieltag N verletzt wird, ist an N GELAUFEN — die Verrechnung muss ihm dort
   * Belastung statt Erholung zuschreiben, und ein forceReplace-Re-Apply desselben
   * Spieltags muss genau dieselbe Klassifikation treffen, sonst kippt die Idempotenz
   * (siehe `restorePreMatchdayAvailability`). Nur die vier Aufrufer INNERHALB dieser
   * Datei setzen das Flag; alles, was ueber die AUFSTELLBARKEIT entscheidet, nimmt den
   * Normalfall.
   */
  matchdayBookkeeping?: boolean;
};

/**
 * Welche Disziplin-Seiten des Spieltags sind bereits gebucht?
 *
 * Die Arena wertet pro Disziplin und bucht nach D1 ein Teil-Ergebnis (siehe
 * `commitThroughSide` in lib/resolve/legacy-matchday-result-apply-service.ts). Solange
 * nicht beide Seiten geschrieben sind, laeuft der Spieltag noch — und genau dann darf ein
 * in D1 verletzter Spieler in der Folgedisziplin nicht mehr auflaufen.
 */
function isMatchdayFullyCommitted(gameState: GameState, matchdayId: string) {
  const matchdayResultIds = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((entry) => entry.matchdayId === matchdayId && entry.status !== "voided")
      .map((entry) => entry.id),
  );
  if (matchdayResultIds.size === 0) {
    return false;
  }
  const committedSides = new Set(
    (gameState.seasonState.disciplineResults ?? [])
      .filter((entry) => matchdayResultIds.has(entry.matchdayResultId))
      .map((entry) => entry.disciplineSide),
  );
  return committedSides.has("d1") && committedSides.has("d2");
}

export type InjuryRehearsalOptions = {
  enabled: boolean;
  seed?: string;
  maxInjuries?: number;
  riskPercentOverride?: number;
};

type MatchdayUse = {
  teamId: string;
  playerId: string;
  intensity: MatchdayIntensityStage;
};

export type MatchdayInjuryRollKey = `${string}::${string}`;

export type MatchdayInjuryPerformanceRef = {
  injuredThisMatchday: boolean;
  multiplier: number;
};

export type MatchdayInjuryRollMap = Map<MatchdayInjuryRollKey, PlayerInjuryRiskRollRecord>;

function clampFatigue(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

/**
 * Per-matchday fatigue load for a specific player: the flat
 * `MATCHDAY_FATIGUE_LOAD` nudged by a small trait-driven multiplier (see
 * lib/traits/cosmetic-trait-soft-effects.ts). This is the single choke
 * point where cosmetic traits touch fatigue accrual.
 *
 * The player's discipline-side INTENSITY additionally scales the load (see
 * INTENSITY_FATIGUE_MULT): conserve saves load, push costs more. Deterministic — no Math.random,
 * so the forceReplace/replay path stays idempotent (same intensity -> same load ->
 * same fatigueBeforeRoll). Defaults to "normal" (multiplier 1.0) when unspecified.
 */
function getPlayerMatchdayFatigueLoad(
  player: Pick<Player, "traitsPositive" | "traitsNegative">,
  intensity: MatchdayIntensityStage = "normal",
) {
  return round(
    MATCHDAY_FATIGUE_LOAD * getPlayerFatigueLoadMultiplier(player) * INTENSITY_FATIGUE_MULT[intensity],
  );
}

export type MatchdayInjuryRiskProjection = {
  /** Fatigue, bei der der Wurf tatsaechlich stattfaende: aktuelle Fatigue + Spieltags-Last. */
  fatigueBeforeRoll: number;
  /** Spieltags-Last, die VOR dem Wurf aufgeschlagen wird (trait- und intensitaetsskaliert). */
  matchdayLoad: number;
  riskPercent: number;
  bandLabel: InjuryRiskBand["label"];
};

/**
 * Projiziert das Verletzungsrisiko eines EINSATZES — also genau die Zahl, gegen die der
 * Spieltags-Wurf in `buildMatchdayInjuryRollMap` spaeter wirklich wuerfelt.
 *
 * Warum eine eigene Funktion statt `getInjuryRiskPercent(aktuelleFatigue)` in der Anzeige:
 * Der echte Wurf passiert NICHT auf der aktuellen Fatigue, sondern auf
 * `fatigueBeforeRoll = aktuelleFatigue + Spieltags-Last` (siehe die identische Rechnung im
 * Roll-Loop). Eine Anzeige auf der aktuellen Fatigue unterschlaegt die Last systematisch —
 * gemessen am echten Spielstand ~2,5 % angezeigt vs. ~4,5 % gewuerfelt im Mittel — und zeigt
 * fuer ausgeruhte Spieler faelschlich 0 %, obwohl jeder Einsatz ein Restrisiko traegt
 * (Minimum bei Fatigue 0, normaler Intensitaet: Wurf bei Fatigue ~10 => ~1,7 %). Genau diese
 * unsichtbare Restwahrscheinlichkeit wurde als "Bug" gemeldet ("Ruhetag davor und trotzdem
 * verletzt").
 *
 * Die Einsatzliste (und jede andere Anzeige) MUSS hierueber gehen, damit Anzeige und
 * Wurf nie auseinanderdriften: gleiche Last-Funktion, gleiche Klemmung, gleiche Kurve.
 */
export function projectMatchdayInjuryRisk(input: {
  player: Pick<Player, "traitsPositive" | "traitsNegative">;
  currentFatigue: number | null | undefined;
  intensity?: MatchdayIntensityStage;
}): MatchdayInjuryRiskProjection {
  const matchdayLoad = getPlayerMatchdayFatigueLoad(input.player, input.intensity ?? "normal");
  // Gleiche Rechnung wie im Roll-Loop: getPlayerCurrentFatigue klemmt die aktuelle Fatigue,
  // danach klemmt die Summe erneut — beides hier gespiegelt, damit Randfaelle (>100) identisch fallen.
  const fatigueBeforeRoll = clampFatigue(clampFatigue(input.currentFatigue) + matchdayLoad);
  return {
    fatigueBeforeRoll,
    matchdayLoad,
    riskPercent: getInjuryRiskPercent(fatigueBeforeRoll),
    bandLabel: getInjuryRiskBand(fatigueBeforeRoll).label,
  };
}

function stableHash(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getMatchdayIndex(gameState: GameState, matchdayId: string) {
  return gameState.season.matchdayIds?.findIndex((entry) => entry === matchdayId) ?? -1;
}

function getNextMatchdayId(gameState: GameState, matchdayId: string) {
  const index = getMatchdayIndex(gameState, matchdayId);
  return index >= 0 ? gameState.season.matchdayIds[index + 1] ?? null : null;
}

function getRosterTeamForPlayer(gameState: GameState, playerId: string) {
  return gameState.rosters.find((entry) => entry.playerId === playerId)?.teamId ?? null;
}

function isActiveRosterPlayer(gameState: GameState, playerId: string, teamId: string) {
  return gameState.rosters.some((entry) => entry.playerId === playerId && entry.teamId === teamId);
}

export function isPlayerAvailabilityInjured(
  entry: Pick<PlayerAvailabilityStateRecord, "injuryStatus"> & { status?: string },
): boolean {
  return entry.injuryStatus === "injured" || entry.status === "injured";
}

export function countTeamInjuredPlayers(gameState: GameState, teamId: string) {
  return (gameState.seasonState.playerAvailabilityState ?? []).filter(
    (entry) => entry.teamId === teamId && isPlayerAvailabilityInjured(entry),
  ).length;
}

function getPlayerCurrentFatigue(gameState: GameState, player: Player, teamId: string) {
  if (!isActiveRosterPlayer(gameState, player.id, teamId)) {
    return 0;
  }
  const availability = gameState.seasonState.playerAvailabilityState?.find(
    (entry) => entry.playerId === player.id && entry.teamId === teamId,
  );
  return clampFatigue(availability?.fatigue ?? player.fatigue ?? 0);
}

export function rollInjuryRisk(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  playerId: string;
  fatigueBefore: number;
}): PlayerInjuryRiskRollRecord {
  const riskPercent = getInjuryRiskPercent(input.fatigueBefore);
  const seed = `${input.saveId}:${input.seasonId}:${input.matchdayId}:${input.playerId}:${FATIGUE_INJURY_SOURCE}`;
  const roll = round((stableHash(seed) % 10_000) / 100, 2);
  return {
    fatigueBefore: clampFatigue(input.fatigueBefore),
    riskPercent,
    roll,
    result: riskPercent > 0 && roll < riskPercent ? "injured" : "healthy",
    source: FATIGUE_INJURY_SOURCE,
  };
}

function rollInjuryRiskForRehearsal(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  playerId: string;
  fatigueBefore: number;
  options: InjuryRehearsalOptions;
}): PlayerInjuryRiskRollRecord {
  const riskPercent = Math.max(
    0,
    Math.min(100, input.options.riskPercentOverride ?? getInjuryRiskPercent(input.fatigueBefore)),
  );
  const seed = `${input.saveId}:${input.seasonId}:${input.matchdayId}:${input.playerId}:${FATIGUE_INJURY_REHEARSAL_SOURCE}:${input.options.seed ?? "default"}`;
  const roll = round((stableHash(seed) % 10_000) / 100, 2);
  return {
    fatigueBefore: clampFatigue(input.fatigueBefore),
    riskPercent,
    roll,
    result: riskPercent > 0 && roll < riskPercent ? "injured" : "healthy",
    source: FATIGUE_INJURY_REHEARSAL_SOURCE,
  };
}

export function calculateTeamRecovery(gameState: GameState, teamId: string) {
  const facilities = getTeamFacilityState(gameState, teamId);
  const normalRecovery = applyRecoveryFacilityModifiers(BASE_MATCHDAY_RECOVERY, facilities).after;
  return {
    normalRecovery,
    injuryRecovery: round(normalRecovery * 0.5, 2),
  };
}

export function calculatePlayerRecovery(
  gameState: GameState,
  teamId: string,
  trainingMode: PlayerTrainingMode | null | undefined,
) {
  const teamRecovery = calculateTeamRecovery(gameState, teamId);
  const modeRecovery = applyTrainingRecoveryImpact(teamRecovery.normalRecovery, trainingMode ?? "mittel");
  return {
    teamNormalRecovery: teamRecovery.normalRecovery,
    normalRecovery: modeRecovery.after,
    injuryRecovery: round(modeRecovery.after * 0.5, 2),
    trainingMode: trainingMode ?? "mittel",
    trainingRecoveryModifierPct: modeRecovery.modifierPct,
    trainingRecoveryLabel: modeRecovery.label,
  };
}

export function getPlayerAvailabilityView(
  gameState: GameState,
  playerId: string,
  teamId: string,
  matchdayId: string,
  options?: PlayerAvailabilityViewOptions,
): PlayerAvailabilityView {
  const player = gameState.players.find((entry) => entry.id === playerId) ?? null;
  const activeTeamId = getRosterTeamForPlayer(gameState, playerId);
  const isActive = Boolean(teamId && activeTeamId === teamId);
  if (!isActive) {
    return {
      playerId,
      teamId,
      fatigue: 0,
      injuryStatus: "healthy",
      injuryUntilMatchday: undefined,
      injuredAtSeasonId: undefined,
      injuredAtMatchdayId: undefined,
      injuryReason: undefined,
      injuryRiskLastRoll: undefined,
      isUnavailable: false,
      blocker: null,
    };
  }
  const stored = gameState.seasonState.playerAvailabilityState?.find(
    (entry) => entry.playerId === playerId && entry.teamId === teamId,
  );
  const currentIndex = getMatchdayIndex(gameState, matchdayId);
  const injuredAtIndex = stored?.injuredAtMatchdayId ? getMatchdayIndex(gameState, stored.injuredAtMatchdayId) : -1;
  const explicitUntilIndex = stored?.injuryUntilMatchday ? getMatchdayIndex(gameState, stored.injuryUntilMatchday) : -1;
  // Effektives Ende der Ausfallzeit (letzter Spieltag, an dem der Spieler gesperrt ist):
  // bevorzugt der persistierte `injuryUntilMatchday`; fehlt dieser (Verletzung am LETZTEN
  // Spieltag der Saison -> kein Folge-Spieltag, `injuryUntilMatchday` ist unbestimmt), wird die
  // Ausfalldauer deterministisch aus dem Verletzungs-Spieltag + INJURY_UNAVAILABLE_MATCHDAYS
  // abgeleitet. So folgt der Status der Timeline, statt als "injured" einzufrieren.
  const unavailableUntilIndex =
    explicitUntilIndex >= 0
      ? explicitUntilIndex
      : injuredAtIndex >= 0
        ? injuredAtIndex + INJURY_UNAVAILABLE_MATCHDAYS
        : -1;
  // Ende des Erholungsfensters: nach der Ausfallzeit ist der Spieler wieder einsatzfähig, bleibt
  // aber INJURY_RECOVERING_MATCHDAYS Spieltage lang "recovering", danach "healthy".
  const recoveryUntilIndex = unavailableUntilIndex >= 0 ? unavailableUntilIndex + INJURY_RECOVERING_MATCHDAYS : -1;
  const hasActiveInjury = stored?.injuryStatus === "injured" || stored?.injuryStatus === "recovering";

  // Gesperrt: ab dem Spieltag NACH der Verletzung bis einschließlich Ende der Ausfallzeit.
  const isUnavailableInLaterMatchday =
    stored?.injuryStatus === "injured" &&
    currentIndex >= 0 &&
    injuredAtIndex >= 0 &&
    unavailableUntilIndex >= 0 &&
    currentIndex > injuredAtIndex &&
    currentIndex <= unavailableUntilIndex;
  // Gesperrt AUCH in der Folgedisziplin desselben Spieltags. Ein Spieltag hat zwei
  // Disziplinen; verletzt sich der Spieler in D1, stand er in D2 bisher weiter zur
  // Auswahl, weil die Sperre erst ab `currentIndex > injuredAtIndex` galt — also erst am
  // naechsten Spieltag. Der Eintrag entsteht mit dem D1-Commit, ab da ist die Verletzung
  // Tatsache und die noch offene Seite fuer ihn zu.
  //
  // Die Klammer `!isMatchdayFullyCommitted` haelt das auf die LAUFENDE Wertung begrenzt:
  // Ist der Spieltag komplett gebucht, gibt es keine Folgedisziplin mehr, und ein
  // Rueckblick auf denselben Spieltag (Arena-Tabelle, Bereitschaft, Historie) soll nicht
  // nachtraeglich behaupten, der Spieler haette nicht antreten duerfen.
  const isBlockedForRemainingDisciplineSide =
    !options?.matchdayBookkeeping &&
    stored?.injuryStatus === "injured" &&
    currentIndex >= 0 &&
    injuredAtIndex === currentIndex &&
    !isMatchdayFullyCommitted(gameState, matchdayId);
  const isUnavailable = isUnavailableInLaterMatchday || isBlockedForRemainingDisciplineSide;
  // Ausfallzeit vorbei, aber Erholungsfenster noch offen -> "recovering" (einsatzfähig).
  const inRecoveryWindow =
    hasActiveInjury &&
    currentIndex >= 0 &&
    unavailableUntilIndex >= 0 &&
    currentIndex > unavailableUntilIndex &&
    currentIndex <= recoveryUntilIndex;
  // Erholungsfenster abgelaufen -> Rückkehr zu "healthy" INNERHALB der Saison, statt in
  // "recovering" zu verharren.
  const recovered =
    hasActiveInjury &&
    currentIndex >= 0 &&
    recoveryUntilIndex >= 0 &&
    currentIndex > recoveryUntilIndex;

  const resolvedInjuryStatus: PlayerInjuryStatus = recovered
    ? "healthy"
    : inRecoveryWindow
      ? "recovering"
      : stored?.injuryStatus ?? "healthy";

  return {
    playerId,
    teamId,
    fatigue: clampFatigue(stored?.fatigue ?? player?.fatigue ?? 0),
    injuryStatus: resolvedInjuryStatus,
    injuryUntilMatchday: stored?.injuryUntilMatchday,
    injuredAtSeasonId: stored?.injuredAtSeasonId,
    injuredAtMatchdayId: stored?.injuredAtMatchdayId,
    injuryReason: stored?.injuryReason,
    injuryRiskLastRoll: stored?.injuryRiskLastRoll,
    isUnavailable,
    blocker: isUnavailable ? "player_injured_unavailable" : null,
  };
}

export function buildPlayerAvailabilityMap(gameState: GameState, matchdayId: string) {
  return new Map(
    gameState.rosters.map((roster) => [
      roster.playerId,
      getPlayerAvailabilityView(gameState, roster.playerId, roster.teamId, matchdayId),
    ] as const),
  );
}

/**
 * Normalisiert Verletzungs-Zustände beim Saisonwechsel: jede offene Verletzung (`injured` oder
 * `recovering`) wird auf `healthy` zurückgesetzt und die zugehörigen Verletzungs-Metadaten
 * (Ausfallfenster, Ursache, Herkunft) werden entfernt. Fatigue/Ausdauer bleibt unangetastet.
 *
 * Hintergrund: Die maximale Verletzungsdauer (Ausfall + Erholung =
 * INJURY_UNAVAILABLE_MATCHDAYS + INJURY_RECOVERING_MATCHDAYS Spieltage) ist deutlich kürzer als
 * die Pause zwischen zwei Saisons. Eine am LETZTEN Spieltag zugezogene Verletzung hat innerhalb
 * der Saison keinen Folge-Spieltag mehr, an dem sie weiterlaufen könnte; zu Saisonbeginn ist sie
 * jedoch längst ausgeheilt. Diese Funktion stellt sicher, dass ein solcher Spieler nicht mit
 * eingefrorenem `injured`/`recovering`-Status in die neue Saison übernommen wird.
 *
 * Rein funktional und deterministisch (kein Zufall). Vorgesehener Aufrufer: der Saison-Setup-Pfad,
 * der `seasonState.playerAvailabilityState` für die neue Saison aufbaut
 * (siehe lib/season/preseason-workflow-service.ts).
 */
export function normalizeAvailabilityForNewSeason(
  entries: PlayerAvailabilityStateRecord[] | undefined | null,
): PlayerAvailabilityStateRecord[] {
  return (entries ?? []).map((entry) => {
    if (entry.injuryStatus !== "injured" && entry.injuryStatus !== "recovering") {
      return entry;
    }
    return {
      playerId: entry.playerId,
      teamId: entry.teamId,
      fatigue: entry.fatigue,
      injuryStatus: "healthy",
    };
  });
}

function collectMatchdayUses(
  gameState: GameState,
  seasonId: string,
  matchdayId: string,
  /**
   * Bis zu welcher Disziplin-Seite gebucht wurde. Die Arena wertet pro Disziplin, und
   * die Ermuedung soll dem folgen: Nach D1 traegt nur, wer in D1 gelaufen ist. Ohne
   * Angabe zaehlt der ganze Spieltag — das Verhalten aller bisherigen Aufrufer.
   *
   * Der Endzustand bleibt davon unberuehrt: Der D2-Commit setzt zuerst auf den
   * Vor-Spieltags-Stand zurueck und wendet dann beide Seiten an, kommt also auf
   * denselben Wert wie ein Voll-Apply in einem Rutsch (kein F + 2*Load).
   */
  commitThroughSide: "d1" | "d2" = "d2",
): MatchdayUse[] {
  // Insertion-ordered map so the returned order matches the previous Set-based dedup exactly
  // (determinism for the injury roll loop). A player selected on BOTH discipline sides is deduped
  // to a single use whose intensity is the HIGHER-load side (push > normal > conserve).
  const byKey = new Map<string, MatchdayUse>();
  const drafts = (gameState.seasonState.lineupDrafts ?? []).filter(
    (draft) => draft.seasonId === seasonId && draft.matchdayId === matchdayId,
  );
  for (const draft of drafts) {
    for (const entry of draft.entries) {
      if (commitThroughSide === "d1" && entry.disciplineSide !== "d1") continue;
      if (!isActiveRosterPlayer(gameState, entry.playerId, draft.teamId)) continue;
      const key = `${draft.teamId}::${entry.playerId}`;
      // Each entry carries its discipline side; the side's intensity lives in the draft modifiers.
      const intensity = normalizeIntensityStage(draft.modifiers?.[entry.disciplineSide]?.intensity);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { teamId: draft.teamId, playerId: entry.playerId, intensity });
        continue;
      }
      if (INTENSITY_LOAD_RANK[intensity] > INTENSITY_LOAD_RANK[existing.intensity]) {
        existing.intensity = intensity;
      }
    }
  }
  return [...byKey.values()];
}

function updateAvailability(
  entries: PlayerAvailabilityStateRecord[],
  nextEntry: PlayerAvailabilityStateRecord,
) {
  return [
    ...entries.filter((entry) => !(entry.playerId === nextEntry.playerId && entry.teamId === nextEntry.teamId)),
    nextEntry,
  ];
}

function buildMatchdayUseKey(teamId: string, playerId: string): MatchdayInjuryRollKey {
  return `${teamId}::${playerId}`;
}

function resolveMatchdayInjuryRoll(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  playerId: string;
  fatigueBeforeRoll: number;
  injuryRehearsal?: InjuryRehearsalOptions | null;
  allowInjury?: boolean;
}): PlayerInjuryRiskRollRecord {
  const riskPercent = getInjuryRiskPercent(input.fatigueBeforeRoll);
  if (riskPercent <= 0) {
    return {
      fatigueBefore: clampFatigue(input.fatigueBeforeRoll),
      riskPercent: 0,
      roll: 0,
      result: "healthy",
      source: FATIGUE_INJURY_SOURCE,
    };
  }
  const initialRoll = input.injuryRehearsal?.enabled
    ? rollInjuryRiskForRehearsal({
        saveId: input.saveId,
        seasonId: input.seasonId,
        matchdayId: input.matchdayId,
        playerId: input.playerId,
        fatigueBefore: input.fatigueBeforeRoll,
        options: input.injuryRehearsal,
      })
    : rollInjuryRisk({
        saveId: input.saveId,
        seasonId: input.seasonId,
        matchdayId: input.matchdayId,
        playerId: input.playerId,
        fatigueBefore: input.fatigueBeforeRoll,
      });
  if (initialRoll.result === "injured" && input.allowInjury === false) {
    return { ...initialRoll, result: "healthy" as const };
  }
  return initialRoll;
}

export function buildMatchdayInjuryRollMap(input: {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  injuryRehearsal?: InjuryRehearsalOptions | null;
  /**
   * forceReplace-Re-Apply desselben Spieltags: der übergebene `gameState` trägt in
   * `playerAvailabilityState` bereits die NACH-Spieltags-Fatigue aus dem ersten Apply.
   * Ist das Flag gesetzt, wird der Vor-Spieltags-Stand rekonstruiert, damit
   * `fatigueBeforeRoll` (und damit riskPercent/roll) identisch zum ersten Apply bleibt.
   */
  isMatchdayReplay?: boolean;
}): MatchdayInjuryRollMap {
  const gameState = restorePreMatchdayAvailability({
    gameState: input.gameState,
    seasonId: input.seasonId,
    matchdayId: input.matchdayId,
    isMatchdayReplay: Boolean(input.isMatchdayReplay),
  });
  const injuryRehearsal = input.injuryRehearsal?.enabled ? input.injuryRehearsal : null;
  const maxRehearsalInjuries = injuryRehearsal ? Math.max(0, injuryRehearsal.maxInjuries ?? 3) : Number.POSITIVE_INFINITY;
  let rehearsalInjuriesCreated = 0;
  const rollMap: MatchdayInjuryRollMap = new Map();
  const usedPlayers = collectMatchdayUses(gameState, input.seasonId, input.matchdayId);

  for (const use of usedPlayers) {
    const availabilityView = getPlayerAvailabilityView(
      gameState,
      use.playerId,
      use.teamId,
      input.matchdayId,
      { matchdayBookkeeping: true },
    );
    if (availabilityView.isUnavailable) continue;

    const player = gameState.players.find((entry) => entry.id === use.playerId);
    if (!player) continue;

    const fatigueBeforeRoll = clampFatigue(getPlayerCurrentFatigue(gameState, player, use.teamId) + getPlayerMatchdayFatigueLoad(player, use.intensity));
    const allowInjury = !injuryRehearsal || rehearsalInjuriesCreated < maxRehearsalInjuries;
    const roll = resolveMatchdayInjuryRoll({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      playerId: use.playerId,
      fatigueBeforeRoll,
      injuryRehearsal,
      allowInjury,
    });
    if (roll.result === "injured" && injuryRehearsal) {
      rehearsalInjuriesCreated += 1;
    }
    rollMap.set(buildMatchdayUseKey(use.teamId, use.playerId), roll);
  }

  return rollMap;
}

export function buildInjuryPerformanceMapForTeam(
  teamId: string,
  rollMap: MatchdayInjuryRollMap,
): Record<string, MatchdayInjuryPerformanceRef> | null {
  const entries: Record<string, MatchdayInjuryPerformanceRef> = {};
  let hasAny = false;
  for (const [key, roll] of rollMap.entries()) {
    if (!key.startsWith(`${teamId}::`)) continue;
    hasAny = true;
    const playerId = key.slice(teamId.length + 2);
    const injuredThisMatchday = roll.result === "injured";
    entries[playerId] = {
      injuredThisMatchday,
      multiplier: getInjuryPerformanceMultiplier(injuredThisMatchday),
    };
  }
  return hasAny ? entries : null;
}

export function attachMatchdayInjuryPerformanceToContexts(
  contexts: Array<{ teamId: string; injuryByPlayerId?: Record<string, MatchdayInjuryPerformanceRef> | null; injurySourceStatus?: "mapped" | "not_applied" }>,
  rollMap: MatchdayInjuryRollMap,
) {
  for (const context of contexts) {
    context.injuryByPlayerId = buildInjuryPerformanceMapForTeam(context.teamId, rollMap);
    context.injurySourceStatus = context.injuryByPlayerId ? "mapped" : "not_applied";
  }
}

function buildInjuryEventId(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string;
  playerId: string;
}) {
  return `injury-event__${input.saveId}__${input.seasonId}__${input.matchdayId}__${input.teamId}__${input.playerId}`;
}

function buildInjuryHighlight(event: InjuryEventRecord, playerName: string, matchdayResultId: string) {
  return {
    id: `discipline-highlight__${matchdayResultId}__injury_event__${event.teamId}__${event.playerId}`,
    matchdayResultId,
    disciplineId: null,
    highlightType: "injury_event" as const,
    teamId: event.teamId,
    playerId: event.playerId,
    relatedTeamId: null,
    importanceScore: event.result === "injured" ? 72 : 18,
    shortSummary:
      event.result === "injured"
        ? `${playerName} verletzt sich nach Überlastung.`
        : `${playerName} übersteht den Injury-Risk-Roll.`,
    payload: {
      fatigueBefore: event.fatigueBefore,
      riskPercent: event.riskPercent,
      roll: event.roll,
      result: event.result,
      unavailableUntil: event.unavailableUntil,
      source: event.source,
    },
    createdAt: event.timestamp,
  };
}

/**
 * Rekonstruiert den VOR-Spieltags-Stand der Fatigue (Ausdauer) je Spieler für einen
 * forceReplace-Re-Apply desselben Spieltags.
 *
 * Hintergrund (Idempotenz): Der erste Apply von Spieltag N schreibt den NACH-Spieltags-Wert
 * in `playerAvailabilityState` — Einsatz-Spieler: +Load, Bank/verletzt: -Recovery. Ein
 * `forceReplace`-Re-Apply bekommt genau diesen bereits fortgeschriebenen Stand herein.
 * Ohne Korrektur käme der Load/die Recovery ein zweites Mal drauf (F + 2*Load bzw. doppelte
 * Erholung). Diese Funktion macht den Delta von Spieltag N rückgängig, sodass Roll,
 * event.fatigueBefore und availability.fatigue exakt wie beim ersten Apply herauskommen.
 *
 * Beim NORMALEN Vorrücken (distinct matchdays, isMatchdayReplay=false) wird der State
 * unverändert (identische Referenz) zurückgegeben -> byte-identisches Verhalten des
 * Standard-Sim-Pfades.
 */
function restorePreMatchdayAvailability(input: {
  gameState: GameState;
  seasonId: string;
  matchdayId: string;
  isMatchdayReplay: boolean;
}): GameState {
  if (!input.isMatchdayReplay) {
    return input.gameState;
  }
  const { gameState, seasonId, matchdayId } = input;
  const currentAvailability = gameState.seasonState.playerAvailabilityState ?? [];
  if (currentAvailability.length === 0) {
    return gameState;
  }
  // Key -> intensity, so the inversion subtracts the SAME intensity-scaled load the first apply
  // added. Without this the replay would over/under-subtract and break idempotency.
  const usedIntensityByKey = new Map<string, MatchdayIntensityStage>(
    collectMatchdayUses(gameState, seasonId, matchdayId).map(
      (use) => [`${use.teamId}::${use.playerId}`, use.intensity] as const,
    ),
  );

  // Pass 1: Den einzigen Verletzungs-Status-Wechsel, den der Recovery-Loop an Spieltag N
  // vornimmt ("injured" -> "recovering", wenn `injuryUntilMatchday === matchdayId`),
  // zurücksetzen. Nur so entspricht die Unavailable-Klassifikation exakt dem ersten Apply
  // und die Fatigue-Inversion trifft denselben Zweig (Load vs. Recovery). Spieler, die AN
  // Spieltag N verletzt wurden (injuredAtMatchdayId === matchdayId, until = nächster
  // Spieltag), bleiben unangetastet: sie waren an N nicht unavailable und werden vom
  // Einsatz-Loop identisch neu erzeugt.
  const restoredInjuryRecords = currentAvailability.map((entry) => {
    if (
      entry.injuryStatus === "recovering" &&
      entry.injuryUntilMatchday === matchdayId &&
      entry.injuredAtMatchdayId &&
      entry.injuredAtMatchdayId !== matchdayId
    ) {
      return { ...entry, injuryStatus: "injured" as const };
    }
    return entry;
  });
  const restoredGameState: GameState = {
    ...gameState,
    seasonState: { ...gameState.seasonState, playerAvailabilityState: restoredInjuryRecords },
  };

  // Pass 2: Fatigue-Delta je Spieler invertieren, basierend auf der (rekonstruierten)
  // Klassifikation des ersten Apply. Die Klemmung auf [0,100] ist unter der Inversion
  // idempotent: clamp(clamp(F + Load) - Load) == clamp(F + Load) und
  // clamp(clamp(F - Rec) + Rec) == clamp(F - Rec).
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const nextAvailability = restoredInjuryRecords.map((entry) => {
    if (!isActiveRosterPlayer(gameState, entry.playerId, entry.teamId)) {
      return entry;
    }
    const player = playerById.get(entry.playerId);
    if (!player) {
      return entry;
    }
    const view = getPlayerAvailabilityView(restoredGameState, entry.playerId, entry.teamId, matchdayId, {
      matchdayBookkeeping: true,
    });
    const useKey = `${entry.teamId}::${entry.playerId}`;
    const wasUsedLoop = usedIntensityByKey.has(useKey) && !view.isUnavailable;
    if (wasUsedLoop) {
      // Einsatz-Spieler: erster Apply hat +Load (intensitätsskaliert) gerechnet -> zurücknehmen.
      const intensity = usedIntensityByKey.get(useKey) ?? "normal";
      return { ...entry, fatigue: clampFatigue(entry.fatigue - getPlayerMatchdayFatigueLoad(player, intensity)) };
    }
    // Bank oder verletzt/unavailable: erster Apply hat Recovery abgezogen -> wieder aufaddieren.
    const recovery = calculatePlayerRecovery(gameState, entry.teamId, player.trainingMode);
    const recoveryValue = view.isUnavailable ? recovery.injuryRecovery : recovery.normalRecovery;
    return { ...entry, fatigue: clampFatigue(entry.fatigue + recoveryValue) };
  });

  return {
    ...gameState,
    seasonState: { ...gameState.seasonState, playerAvailabilityState: nextAvailability },
  };
}

export function applyFatigueAndInjuryAfterMatchday(input: {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  matchdayResultId: string;
  timestamp: string;
  injuryRehearsal?: InjuryRehearsalOptions | null;
  precomputedInjuryRolls?: MatchdayInjuryRollMap | null;
  /**
   * forceReplace-Re-Apply desselben Spieltags: macht den bereits persistierten Fatigue-Delta
   * von Spieltag N rückgängig, bevor Load/Recovery neu angewandt werden. Standard-Vorrücken
   * (distinct matchdays) lässt dieses Flag weg -> unverändertes Verhalten.
   */
  isMatchdayReplay?: boolean;
  /**
   * Bis zu welcher Disziplin-Seite gebucht wurde (siehe `collectMatchdayUses`). Nach
   * einem D1-Commit traegt nur die D1-Belastung; der D2-Commit setzt zurueck und wendet
   * beide Seiten an. Ohne Angabe: ganzer Spieltag wie bisher.
   */
  commitThroughSide?: "d1" | "d2";
}): { gameState: GameState; injuryEvents: InjuryEventRecord[] } {
  const gameState = restorePreMatchdayAvailability({
    gameState: input.gameState,
    seasonId: input.seasonId,
    matchdayId: input.matchdayId,
    isMatchdayReplay: Boolean(input.isMatchdayReplay),
  });
  const usedPlayers = collectMatchdayUses(
    gameState,
    input.seasonId,
    input.matchdayId,
    input.commitThroughSide ?? "d2",
  );
  const usedPlayerKeys = new Set(usedPlayers.map((use) => `${use.teamId}::${use.playerId}`));
  const nextMatchdayId = getNextMatchdayId(gameState, input.matchdayId);
  const injuryRollMap =
    input.precomputedInjuryRolls ??
    buildMatchdayInjuryRollMap({
      gameState,
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      injuryRehearsal: input.injuryRehearsal,
    });
  let nextAvailability = (gameState.seasonState.playerAvailabilityState ?? []).filter((entry) =>
    isActiveRosterPlayer(gameState, entry.playerId, entry.teamId),
  );
  const nextPlayers = gameState.players.map((player) => ({ ...player }));
  const playerIndexById = new Map(nextPlayers.map((player, index) => [player.id, index] as const));
  const playerNameById = new Map(gameState.players.map((player) => [player.id, player.name] as const));
  const newEvents: InjuryEventRecord[] = [];

  for (const roster of gameState.rosters) {
    const playerIndex = playerIndexById.get(roster.playerId);
    if (playerIndex == null) continue;
    const player = nextPlayers[playerIndex];
    const usedKey = `${roster.teamId}::${roster.playerId}`;
    const view = getPlayerAvailabilityView(
      { ...gameState, players: nextPlayers, seasonState: { ...gameState.seasonState, playerAvailabilityState: nextAvailability } },
      roster.playerId,
      roster.teamId,
      input.matchdayId,
      { matchdayBookkeeping: true },
    );
    if (usedPlayerKeys.has(usedKey) && !view.isUnavailable) continue;
    const recovery = calculatePlayerRecovery(gameState, roster.teamId, player.trainingMode);
    const currentFatigue = getPlayerCurrentFatigue(
      { ...gameState, players: nextPlayers, seasonState: { ...gameState.seasonState, playerAvailabilityState: nextAvailability } },
      player,
      roster.teamId,
    );
    const recoveryValue = view.isUnavailable ? recovery.injuryRecovery : recovery.normalRecovery;
    const fatigueAfterRecovery = clampFatigue(currentFatigue - recoveryValue);
    nextAvailability = updateAvailability(nextAvailability, {
      playerId: roster.playerId,
      teamId: roster.teamId,
      fatigue: fatigueAfterRecovery,
      injuryStatus: view.injuryUntilMatchday === input.matchdayId ? "recovering" : view.injuryStatus,
      injuryUntilMatchday: view.injuryUntilMatchday,
      injuredAtSeasonId: view.injuredAtSeasonId,
      injuredAtMatchdayId: view.injuredAtMatchdayId,
      injuryReason: view.injuryReason,
      injuryRiskLastRoll: view.injuryRiskLastRoll,
    });
    nextPlayers[playerIndex] = { ...player, fatigue: fatigueAfterRecovery };
  }

  for (const use of usedPlayers) {
    const playerIndex = playerIndexById.get(use.playerId);
    if (playerIndex == null) continue;
    const player = nextPlayers[playerIndex];
    const availabilityView = getPlayerAvailabilityView(
      { ...gameState, players: nextPlayers, seasonState: { ...gameState.seasonState, playerAvailabilityState: nextAvailability } },
      use.playerId,
      use.teamId,
      input.matchdayId,
      { matchdayBookkeeping: true },
    );
    if (availabilityView.isUnavailable) continue;

    const recovery = calculatePlayerRecovery(gameState, use.teamId, player.trainingMode);
    const fatigueBeforeRoll = clampFatigue(getPlayerCurrentFatigue(gameState, player, use.teamId) + getPlayerMatchdayFatigueLoad(player, use.intensity));
    const roll =
      injuryRollMap.get(buildMatchdayUseKey(use.teamId, use.playerId)) ??
      resolveMatchdayInjuryRoll({
        saveId: input.saveId,
        seasonId: input.seasonId,
        matchdayId: input.matchdayId,
        playerId: use.playerId,
        fatigueBeforeRoll,
        injuryRehearsal: input.injuryRehearsal,
      });
    const event: InjuryEventRecord = {
      eventId: buildInjuryEventId({
        saveId: input.saveId,
        seasonId: input.seasonId,
        matchdayId: input.matchdayId,
        teamId: use.teamId,
        playerId: use.playerId,
      }),
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      teamId: use.teamId,
      playerId: use.playerId,
      fatigueBefore: roll.fatigueBefore,
      riskPercent: roll.riskPercent,
      roll: roll.roll,
      result: roll.result,
      unavailableForMatchdays: 1,
      unavailableUntil: roll.result === "injured" ? nextMatchdayId : null,
      normalRecovery: recovery.normalRecovery,
      injuryRecovery: roll.result === "injured" ? recovery.injuryRecovery : null,
      fatigueAfterRecovery: null,
      source: roll.source,
      timestamp: input.timestamp,
    };
    newEvents.push(event);
    if (roll.result === "injured") {
      const historyRecord = injuryEventToPlayerHistoryRecord(event, gameState);
      if (historyRecord) {
        nextPlayers[playerIndex] = appendPlayerInjuryHistory(nextPlayers[playerIndex], historyRecord);
      }
    }
    nextAvailability = updateAvailability(nextAvailability, {
      playerId: use.playerId,
      teamId: use.teamId,
      fatigue: fatigueBeforeRoll,
      injuryStatus: roll.result === "injured" ? "injured" : availabilityView.injuryStatus === "recovering" ? "recovering" : "healthy",
      injuryUntilMatchday: roll.result === "injured" ? nextMatchdayId ?? undefined : availabilityView.injuryUntilMatchday,
      injuredAtSeasonId: roll.result === "injured" ? input.seasonId : availabilityView.injuredAtSeasonId,
      injuredAtMatchdayId: roll.result === "injured" ? input.matchdayId : availabilityView.injuredAtMatchdayId,
      injuryReason: roll.result === "injured" ? "fatigue_over_30_after_matchday_use" : availabilityView.injuryReason,
      injuryRiskLastRoll: roll,
    });
    nextPlayers[playerIndex] = { ...nextPlayers[playerIndex], fatigue: fatigueBeforeRoll };
  }

  const injuryHighlights = newEvents
    .filter((event) => event.result === "injured")
    .map((event) => buildInjuryHighlight(event, playerNameById.get(event.playerId) ?? event.playerId, input.matchdayResultId));

  return {
    injuryEvents: newEvents,
    gameState: {
      ...gameState,
      players: nextPlayers,
      seasonState: {
        ...gameState.seasonState,
        playerAvailabilityState: nextAvailability,
        injuryEvents: [
          ...(gameState.seasonState.injuryEvents ?? []).filter(
            (event) => !(event.seasonId === input.seasonId && event.matchdayId === input.matchdayId),
          ),
          ...newEvents,
        ],
        disciplineHighlights: [
          ...(gameState.seasonState.disciplineHighlights ?? []),
          ...injuryHighlights,
        ],
      },
    },
  };
}

export function getLineupInjuryBlockers(gameState: GameState, draft: LineupDraft) {
  return draft.entries.flatMap((entry) => {
    const availability = getPlayerAvailabilityView(gameState, entry.playerId, draft.teamId, draft.matchdayId);
    return availability.isUnavailable
      ? [{
          teamId: draft.teamId,
          playerId: entry.playerId,
          matchdayId: draft.matchdayId,
          blocker: "player_injured_unavailable" as const,
          injuryUntilMatchday: availability.injuryUntilMatchday ?? null,
        }]
      : [];
  });
}
