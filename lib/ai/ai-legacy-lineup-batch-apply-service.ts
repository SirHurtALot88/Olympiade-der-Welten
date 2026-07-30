import {
  buildAiFormCardSeasonPlan,
  getPlannedCardIdsForSlot,
  getPlannedClaimValue,
  type FormCardSeasonPlan,
  type FormCardSeasonPlanSlot,
} from "@/lib/ai/ai-form-card-season-plan";
import { buildAiLegacyLineupPreview, getMarginalRankPointSwing } from "@/lib/ai/ai-legacy-lineup-engine";
import type { FormCardColor, GameState, LineupDraft, LineupDraftModifiers } from "@/lib/data/olyDataTypes";
import { isTeamMatchdayLineupOperationallyReady } from "@/lib/foundation/matchday-lineup-readiness";
import type { AiLegacyLineupPreviewStatus } from "@/lib/ai/ai-needs-types";
import { buildTeamControlSettingsMap, isAiLineupBatchApplyEnabled } from "@/lib/foundation/team-control-settings";
import {
  createDefaultLineupDraftModifiers,
  ensureLocalFormCardsForSeason,
  getFormCardColorForDisciplineCategory,
  seededUnitInterval,
} from "@/lib/lineups/legacy-lineup-modifiers";
import type { LegacyFormCardOption, LegacyLineupEntryInput, LegacyLineupKeyParams, LegacyLineupLoadedContext, LegacyMutatorTraitOption, LegacyRosterPlayerRef, LegacyTeamPowerOption } from "@/lib/lineups/legacy-lineup-types";
import {
  calculateLocalLegacyLineupPreviewFromContext,
  loadLocalLegacyLineupContextFromGameState,
  saveLocalLegacyLineupDraftBatch,
} from "@/lib/lineups/legacy-lineup-local-service";
import { isLegacyLineupDraftComplete } from "@/lib/lineups/legacy-matchday-readiness";
import { calculateTeamPowerModifierForSide, ensureLocalTeamPowersForSeason } from "@/lib/lineups/team-powers";
import { selectTeamCaptain } from "@/lib/morale/player-demands-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { requireLocalPersistedSave } from "@/lib/persistence/resolve-local-save";
import type { PersistenceService } from "@/lib/persistence/types";

export type AiBatchApplyTeamStatus =
  | "saved"
  | "skipped_warning"
  | "skipped_blocked"
  | "skipped_existing"
  | "skipped_manual"
  | "skipped_passive"
  | "skipped_disabled"
  | "failed_validation";

export type AiBatchApplyTeamResult = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: "manual" | "ai" | "passive";
  aiEligible: boolean;
  previewStatus: AiLegacyLineupPreviewStatus | "validation_failed";
  captainSlotsUsed: number | null;
  captainSlotsRemaining: number | null;
  d1CaptainSelectionStatus: string | null;
  d2CaptainSelectionStatus: string | null;
  result: AiBatchApplyTeamStatus;
  overwriteExisting: boolean;
  warnings: string[];
  /** Begruendungen der Captain-KI — Protokoll, kein Problem (s. AiLegacyLineupPreview). */
  captainDecisions: string[];
  blockingReasons: string[];
  saved: boolean;
  formCardsSelected?: number;
  negativeFormCardsSelected?: number;
};

export type AiBatchApplySummary = {
  totalTeams: number;
  aiEligibleTeams: number;
  skippedManual: number;
  skippedPassive: number;
  skippedDisabled: number;
  readyToSave: number;
  readyTeams: number;
  warningTeams: number;
  blockedTeams: number;
  wouldSave: number;
  savedTeams: number;
  skippedWarning: number;
  skippedBlocked: number;
  skippedExisting: number;
  existingLineups: number;
  wouldOverwrite: number;
  overwrittenExisting: number;
  plannedLineups: number;
  formCardsSelected: number;
  negativeFormCardsSelected: number;
  performanceBreakdown?: {
    formCardPlanningMs: number;
    aiLineupGenerationMs: number;
    lineupValidationMs: number;
    mutatorPlanningMs: number;
    saveWriteMs: number;
    contextLoadMs: number;
    teamPowerPlanningMs: number;
    totalMs: number;
  };
  warnings: string[];
  /** Gesammelte Captain-Begruendungen aller Teams (dedupliziert). */
  captainDecisions: string[];
  blockingReasons: string[];
};

export type AiBatchApplyResult = {
  source: "sqlite";
  readOnly: false;
  dryRun: boolean;
  includeWarningTeams: boolean;
  totalTeams: number;
  results: AiBatchApplyTeamResult[];
  summary: AiBatchApplySummary;
};

type AiBatchApplyInput = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  includeWarningTeams?: boolean;
  overwriteExisting?: boolean;
  forceAiTeams?: boolean;
  dryRun?: boolean;
};

// Audit S4: AI batch lineup apply persists lineup drafts for every AI-controlled team — an
// unresolved saveId must never silently apply to "the active save" instead of the requested one.
function resolveLocalScope(input: AiBatchApplyInput, persistence: PersistenceService) {
  const { save } = requireLocalPersistedSave(persistence, input.saveId);

	  return {
	    save,
	    saveId: save.saveId,
	    seasonId: input.seasonId || save.gameState.season.id,
	    matchdayId: input.matchdayId || save.gameState.matchdayState.matchdayId,
    teams: (() => {
      const settingsMap = buildTeamControlSettingsMap(
        save.gameState.teams,
        save.gameState.seasonState?.teamControlSettings,
      );

      return save.gameState.teams.map((team) => {
        const settings = settingsMap[team.teamId];
        const controlMode = settings?.controlMode ?? "manual";
        const aiEligible = controlMode === "ai" && (input.forceAiTeams === true || isAiLineupBatchApplyEnabled(settings));

        return {
          teamId: team.teamId,
          teamCode: team.shortCode ?? team.teamId,
          teamName: team.name,
          controlMode,
          aiEligible,
        };
      });
    })(),
  };
}

function classifyPreviewStatus(status: AiLegacyLineupPreviewStatus) {
  if (status === "blocked") {
    return "blocked";
  }
  if (status === "ready") {
    return "ready";
  }
  return "warning";
}

function elapsedSince(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function buildCaptainPreviewMeta(
  preview: Partial<{
    captainSlotsUsed: number;
    captainSlotsRemaining: number;
    captainDecisions: string[];
    d1: { captainSelectionStatus?: string | null } | null;
    d2: { captainSelectionStatus?: string | null } | null;
  }>,
) {
  return {
    captainSlotsUsed: preview.captainSlotsUsed ?? null,
    captainSlotsRemaining: preview.captainSlotsRemaining ?? null,
    // Reicht das Entscheidungsprotokoll der Captain-KI durch — getrennt vom Warnungskanal.
    captainDecisions: preview.captainDecisions ?? [],
    d1CaptainSelectionStatus: preview.d1?.captainSelectionStatus ?? null,
    d2CaptainSelectionStatus: preview.d2?.captainSelectionStatus ?? null,
  };
}

function countSelectedFormCards(modifiers: LineupDraftModifiers) {
  const ids = [
    modifiers.d1.primaryFormCardId,
    modifiers.d1.secondaryFormCardId,
    modifiers.d2.primaryFormCardId,
    modifiers.d2.secondaryFormCardId,
  ].filter((value): value is string => Boolean(value));

  return ids.length;
}

function countSelectedNegativeFormCards(modifiers: LineupDraftModifiers, cards: LegacyFormCardOption[]) {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  return [
    modifiers.d1.primaryFormCardId,
    modifiers.d2.primaryFormCardId,
  ].filter((cardId) => {
    if (!cardId) return false;
    return (cardById.get(cardId)?.value ?? 0) < 0;
  }).length;
}

function isNonActionableAiLineupWarning(warning: string) {
  return warning === "captain_limit_reached";
}

function normalizeAiLineupWarnings(warnings: string[]) {
  return Array.from(new Set(warnings.filter((warning) => !isNonActionableAiLineupWarning(warning))));
}

function sortFormCardsForSlot(
  cards: LegacyFormCardOption[],
  color: FormCardColor | null,
  polarity: "positive" | "negative",
) {
  return [...cards].sort((left, right) => {
    if (polarity === "negative") {
      const leftColorPenalty = color && left.color === color ? 1 : 0;
      const rightColorPenalty = color && right.color === color ? 1 : 0;
      if (leftColorPenalty !== rightColorPenalty) return leftColorPenalty - rightColorPenalty;
      const absDiff = Math.abs(left.value) - Math.abs(right.value);
      if (absDiff !== 0) return absDiff;
      return left.id.localeCompare(right.id);
    }

    const leftColorHit = color && left.color === color ? 1 : 0;
    const rightColorHit = color && right.color === color ? 1 : 0;
    if (leftColorHit !== rightColorHit) return rightColorHit - leftColorHit;
    if (left.value !== right.value) return right.value - left.value;
    return left.id.localeCompare(right.id);
  });
}

function takeBestFormCard(input: {
  cards: LegacyFormCardOption[];
  usedIds: Set<string>;
  color: FormCardColor | null;
  polarity: "positive" | "negative";
}) {
  const candidates = input.cards.filter((card) => {
    if (input.usedIds.has(card.id)) {
      return false;
    }
    if (input.polarity === "negative" && input.color && card.color === input.color) {
      return false;
    }
    return true;
  });
  const picked = sortFormCardsForSlot(candidates, input.color, input.polarity)[0] ?? null;
  if (picked) {
    input.usedIds.add(picked.id);
  }
  return picked;
}

function competitivenessRank(value: DisciplineSideCompetitiveness) {
  switch (value) {
    case "weak":
      return 0;
    case "neutral":
      return 1;
    case "strong":
      return 2;
  }
}

// --- Formkarten-Haushalt -------------------------------------------------------------------
// Der Punktwert eines Karteneinsatzes ist `Kartenwert × (Farbtreffer ? 2 : 1) × Spielerzahl`
// (s. calculateFormModifierForSide): dieselbe Karte bringt in einer 6er-Disziplin doppelt so
// viele Teampunkte wie in einer 3er.
//
// FRÜHER stand hier `estimateBestFutureFormCardValue`: JEDE Karte einzeln gegen den besten noch
// kommenden Slot. Das war kein Haushalt, sondern n unabhängige Tagträume — alle Karten
// reklamierten denselben 6er-Farbtreffer-Slot, weil keine der anderen den Slot je wegnahm.
// Beobachtbare Folge (Simulation über 10 Spieltage, alle 20 Disziplinen): an Spieltag 4 landeten
// `grün+8` UND `rot+2` beide auf Gewichtheben (6er, ROT), während Climbing (6er, GRÜN) desselben
// Spieltags leer blieb — 48 statt 96 Punkte für die grüne Acht, und die zweite Karte verpuffte
// als Doppelbelegung. Ersetzt durch eine echte SAISONZUORDNUNG (ai-form-card-season-plan): dort
// ist ein vergebener Slot vergeben, und die nächste Karte muss sich mit dem zweitbesten begnügen.
const FORM_CARD_FALLBACK_SLOT_PLAYER_COUNT = 4;

/**
 * Die Slots, über die geplant wird: der AKTUELLE Spieltag (mit den echten Seiten aus dem
 * Spieltags-Contract) plus alle folgenden aus dem Saison-Spielplan. Der aktuelle Spieltag gehört
 * bewusst dazu — nur so kann der Plan sagen „diese Karte gehört HEUTE auf d2 und nicht auf d1".
 *
 * Ohne echten Spielplan (synthetische Test-Kontexte, alte Saves) bleiben für die Zukunft
 * farb-neutrale 4er-Platzhalter: konservativ genug, dass dicke Karten nicht am ersten Spieltag
 * in Mini-Disziplinen landen, aber ohne eine Disziplin-Zuordnung zu erfinden, die es nicht gibt.
 */
function collectFormCardPlanSlots(input: {
  context: LegacyLineupLoadedContext;
  currentMatchdayIndex: number;
  remainingMatchdaysIncludingCurrent: number;
  currentSides: Array<{ side: "d1" | "d2"; disciplineId: string | null; color: FormCardColor | null; playerCount: number }>;
}): { slots: FormCardSeasonPlanSlot[]; hasRealSchedule: boolean } {
  const slots: FormCardSeasonPlanSlot[] = input.currentSides.map((side) => ({
    matchdayIndex: input.currentMatchdayIndex,
    matchdayId: input.context.matchdayId ?? null,
    disciplineSide: side.side,
    disciplineId: side.disciplineId,
    color: side.color,
    playerCount: side.playerCount,
  }));

  // „Echter Spielplan" heißt: die Saison kennt für den aktuellen Spieltag ODER später eine
  // Disziplin-Zuordnung. Bewusst nicht „es gibt noch SPÄTERE Einträge" — sonst gälte der Plan
  // ausgerechnet am letzten Spieltag als unecht, obwohl die Zuordnung dort am sichersten ist.
  const allEntries = input.context.seasonDisciplineSchedule ?? [];
  const hasRealSchedule = allEntries.some((entry) => entry.matchdayIndex >= input.currentMatchdayIndex);
  const schedule = allEntries.filter((entry) => entry.matchdayIndex > input.currentMatchdayIndex);
  if (hasRealSchedule) {
    for (const entry of schedule) {
      for (const [side, slot] of [["d1", entry.discipline1], ["d2", entry.discipline2]] as const) {
        if (!slot) continue;
        slots.push({
          matchdayIndex: entry.matchdayIndex,
          matchdayId: entry.matchdayId,
          disciplineSide: side,
          disciplineId: slot.disciplineId,
          color: getFormCardColorForDisciplineCategory(slot.category),
          playerCount: slot.playerCount,
        });
      }
    }
    return { slots, hasRealSchedule: true };
  }

  for (let distance = 1; distance < input.remainingMatchdaysIncludingCurrent; distance += 1) {
    const matchdayIndex = input.currentMatchdayIndex + distance;
    // `disciplineSide: null` ist hier ehrlich: welche Seite das wird, steht ohne Spielplan nicht
    // fest. Die Platzhalter tragen deshalb nur Kapazität bei, nie eine Seiten-Zuordnung.
    slots.push(
      { matchdayIndex, matchdayId: null, disciplineSide: null, disciplineId: null, color: null, playerCount: FORM_CARD_FALLBACK_SLOT_PLAYER_COUNT },
      { matchdayIndex, matchdayId: null, disciplineSide: null, disciplineId: null, color: null, playerCount: FORM_CARD_FALLBACK_SLOT_PLAYER_COUNT },
    );
  }
  return { slots, hasRealSchedule: false };
}

/**
 * Wie viele Spieler auf dieser Seite wirklich antreten — und damit, wie viel eine Formkarte hier
 * ueberhaupt bringen kann.
 *
 * Der Wert einer Karte ist `Kartenwert x Spielerzahl` (`calculateFormModifierForSide`), und die
 * Score-Engine setzt dort `sideEntries.length` ein, also die TATSAECHLICH aufgestellten Spieler.
 * Die KI hat stattdessen die SOLL-Kadergroesse der Disziplin gerechnet. Wer eine 5er-Disziplin nur
 * mit 4 Spielern besetzt, bekam eine Karte damit 25 % zu hoch bewertet — gemeldet als „M-M setzen
 * 2 Boostkarten ein, obwohl sie nur 4 statt 5 Spieler haben, das kostet auch Effizienz".
 *
 * Karten sind Einwegware: was hier verpufft, fehlt fuer den Rest der Saison. Es braucht dafuer
 * KEINE neue Regel — `selectPositiveFormCardForSlot` vergleicht den Jetzt-Wert ohnehin mit dem
 * Anspruch besserer Slots. Sie muss nur die ehrliche Zahl bekommen, dann bleibt die Karte von
 * allein liegen, wenn ein voller Kader mehr aus ihr macht.
 */
export function resolveFormCardSidePlayerCount(input: {
  /** Eintraege der Aufstellung fuer GENAU diese Seite. */
  filledPlayers: number;
  /** Soll-Kadergroesse der Disziplin — Rueckfall, solange keine Aufstellung vorliegt. */
  contractPlayerCount: number | null;
}): number {
  const { filledPlayers, contractPlayerCount } = input;
  if (filledPlayers > 0) {
    // Mehr als die Soll-Groesse zaehlt nicht: ueberzaehlige Eintraege werden vor der Wertung
    // gekappt (s. lineup-surplus-entries-cap), sie wuerden die Karte sonst zu hoch bewerten.
    return Math.max(1, Math.min(filledPlayers, contractPlayerCount ?? filledPlayers));
  }
  return Math.max(1, contractPlayerCount ?? FORM_CARD_FALLBACK_SLOT_PLAYER_COUNT);
}

function formCardDeploymentValue(card: LegacyFormCardOption, color: FormCardColor | null, playerCount: number) {
  const multiplier = color != null && card.color === color ? 2 : 1;
  return card.value * multiplier * Math.max(1, playerCount);
}

// Team-Charakter statt Einheits-KI (Vorbild: Doktrinen in team-powers): mentale Teams
// haushalten geduldiger, Power-Teams hauen eher raus. Dazu ein deterministischer Jitter
// pro Team, damit auch gleichgelagerte Identitäten nicht identisch spielen.
type FormCardDoctrineProfile = {
  /** ~0.85..1.2 — je höher, desto eher wird eine Karte für bessere zukünftige Slots reserviert. */
  patience: number;
  /** 0..1 — Overkill-Bremse: wie konsequent auf die zweite Karte verzichtet wird, wenn die Seite ohnehin dominiert. */
  restraint: number;
};

function getFormCardDoctrineProfile(context: LegacyLineupLoadedContext): FormCardDoctrineProfile {
  const identity = context.teamIdentity ?? null;
  const pow = identity?.pow ?? 0;
  const spe = identity?.spe ?? 0;
  const men = identity?.men ?? 0;
  const soc = identity?.soc ?? 0;
  const mentalLean = identity != null && men >= Math.max(pow, spe, soc);
  const powerLean = identity != null && pow >= Math.max(spe, men, soc);
  const patienceJitter = (seededUnitInterval(`formcard-patience|${context.teamId}`) - 0.5) * 0.16;
  const restraintJitter = (seededUnitInterval(`formcard-restraint|${context.teamId}`) - 0.5) * 0.3;
  const patience = Math.min(
    1.2,
    Math.max(0.85, 1 + (mentalLean ? 0.08 : 0) - (powerLean ? 0.08 : 0) + patienceJitter),
  );
  const restraint = Math.min(
    1,
    Math.max(0, 0.55 + (mentalLean ? 0.2 : 0) - (powerLean ? 0.2 : 0) + restraintJitter),
  );
  return { patience, restraint };
}

function selectPositiveFormCardForSlot(input: {
  positiveCards: LegacyFormCardOption[];
  usedIds: Set<string>;
  color: FormCardColor | null;
  playerCount: number;
  /** Saisonplan + aktueller Spieltag: woran der Einsatz HIER gemessen wird. */
  plan: FormCardSeasonPlan;
  currentMatchdayIndex: number;
  /** Karten, die der Plan für GENAU diese Seite vorgesehen hat. */
  plannedCardIds: Set<string>;
  patience: number;
  /** Ausgabedruck (Urgency/Pace/Restsaison): dann darf auch die "am wenigsten bereute" reservierte Karte fallen. */
  mustSpend: boolean;
}): LegacyFormCardOption | null {
  const candidates = input.positiveCards.filter((card) => !input.usedIds.has(card.id) && card.value > 0);
  if (candidates.length === 0) {
    return null;
  }

  // Reserve-Schwelle: geduldige Teams reservieren schon bei kleinem Zukunftsvorteil,
  // ungeduldige erst bei deutlichem. (patience 0.85..1.2 → Faktor 1.35..1.0)
  const reserveFactor = Math.max(1, 2.2 - input.patience);
  const scored = candidates.map((card) => {
    const nowValue = formCardDeploymentValue(card, input.color, input.playerCount);
    // Der ANSPRUCH der Karte auf ihren Planplatz, abgezinst auf heute. Drei Fälle fallen daraus
    // ohne Sonderbehandlung heraus (s. getPlannedClaimValue): Plan will sie hier → Anspruch ==
    // Jetzt-Wert, sie fällt. Plan will sie heute NEBENAN → Anspruch ist der dortige, bessere Wert,
    // sie bleibt liegen. Plan will sie später → abgezinster Anspruch. Kein Plan-Platz (`null`) →
    // kein Anspruch, sie darf sofort fallen, statt bis zum Saisonende zu verrotten.
    const claimValue = getPlannedClaimValue({ plan: input.plan, cardId: card.id, currentMatchdayIndex: input.currentMatchdayIndex }) ?? 0;
    return {
      card,
      colorHit: input.color != null && card.color === input.color,
      planned: input.plannedCardIds.has(card.id),
      nowValue,
      regret: claimValue - nowValue,
      reserved: claimValue > nowValue * reserveFactor,
    };
  });

  const playable = scored.filter((entry) => !entry.reserved);
  const pool =
    playable.length > 0
      ? playable
      : input.mustSpend
        ? // Zwangsausgabe: die Karte opfern, die durch den Einsatz JETZT am wenigsten verliert.
          [[...scored].sort((left, right) => left.regret - right.regret || left.card.id.localeCompare(right.card.id))[0]!]
        : [];
  if (pool.length === 0) {
    return null;
  }

  const picked = [...pool].sort((left, right) => {
    // Die Vorabsicht des Plans schlägt den Tageswert: der Plan hat diese Karte für DIESE Seite
    // vorgesehen, weil sie über die ganze Saison gerechnet hierher gehört. Erst wenn der Plan
    // nichts sagt, entscheidet wieder der Jetzt-Wert.
    if (left.planned !== right.planned) return (right.planned ? 1 : 0) - (left.planned ? 1 : 0);
    if (left.nowValue !== right.nowValue) return right.nowValue - left.nowValue;
    if (left.colorHit !== right.colorHit) return (right.colorHit ? 1 : 0) - (left.colorHit ? 1 : 0);
    return left.card.id.localeCompare(right.card.id);
  })[0]!.card;
  input.usedIds.add(picked.id);
  return picked;
}

function planNegativeDumpSidesForMatchday(input: {
  sides: Array<{ side: "d1" | "d2"; competitiveness: DisciplineSideCompetitiveness; playerCount?: number }>;
  dumpsRequiredThisMatchday: number;
  unusedNegativeCount: number;
  // Nur bei ECHTEM Zwang (letzte Spieltage / mehr Negativkarten als Restslots) dürfen
  // Minuskarten auch auf einer starken Seite landen. Ohne Zwang schützt die AI die Seite,
  // die sie gewinnen will: Früher schlug die Entsorgungspflicht die Wettbewerbslogik und
  // die AI kippte Minuskarten ausgerechnet in ihre aussichtsreichste Disziplin.
  allowStrongSideDump: boolean;
}) {
  const dumpSides = new Set<"d1" | "d2">();
  if (input.unusedNegativeCount <= 0 || input.dumpsRequiredThisMatchday <= 0) {
    return dumpSides;
  }

  const target = Math.min(input.dumpsRequiredThisMatchday, input.unusedNegativeCount, 2);
  // Bei gleicher Wettbewerbslage in die KLEINERE Disziplin entsorgen: der Malus einer
  // Minuskarte skaliert wie der Bonus mit der Spielerzahl — ein Dump in der 2er kostet
  // ein Drittel dessen, was er in der 6er kosten würde.
  const orderedSides = [...input.sides].sort(
    (left, right) =>
      competitivenessRank(left.competitiveness) - competitivenessRank(right.competitiveness) ||
      (left.playerCount ?? 0) - (right.playerCount ?? 0),
  );

  for (const side of orderedSides) {
    if (dumpSides.size >= target) {
      break;
    }
    if (side.competitiveness === "strong" && !input.allowStrongSideDump) {
      // Der Dump wird lieber auf einen späteren Spieltag verschoben, als die stärkste
      // Seite dieses Spieltags zu sabotieren.
      continue;
    }
    dumpSides.add(side.side);
  }

  return dumpSides;
}

function parseIdentityPowerSlotIndex(powerId: string) {
  const match = powerId.match(/:identity:(\d+)$/);
  if (!match) {
    return null;
  }
  return Number(match[1]) - 1;
}

function countRemainingSelectableCharges(teamPowers: LegacyTeamPowerOption[]) {
  return teamPowers
    .filter((power) => power.selectedForSeason && power.chargesRemaining > 0)
    .reduce((sum, power) => sum + power.chargesRemaining, 0);
}

function isDebuffTeamPower(power: LegacyTeamPowerOption) {
  return (
    power.effectType === "snipe_debuff" ||
    power.effectType === "field_debuff" ||
    power.effectType === "rivalry_debuff"
  );
}

function powerMatchesDisciplineCategory(power: LegacyTeamPowerOption, disciplineCategory: string | null | undefined) {
  return power.category === "flex" || power.category === disciplineCategory;
}

function sideTeamPowerPriority(input: {
  competitiveness: DisciplineSideCompetitiveness;
  rivalryCount: number;
}) {
  const competitivenessRank = input.competitiveness === "strong" ? 2 : input.competitiveness === "neutral" ? 1 : 0;
  return competitivenessRank * 3 + Math.min(input.rivalryCount, 2);
}

// Use-it-or-lose-it target: the AI aims to spend at least this fraction of a team's
// active team-power charges over the season, so powers don't rot unused. Tunable/reversible
// via OLY_TEAM_POWER_TARGET_USAGE (0..1); default 0.85 leaves margin above the 80% floor.
const TEAM_POWER_TARGET_SEASON_USAGE = (() => {
  const raw = Number(process.env.OLY_TEAM_POWER_TARGET_USAGE ?? 0.9);
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.9;
})();

// Fraction of the season before which no use-it-or-lose-it pressure applies, so early matchdays
// keep opportunistic/tactical deployment and forced spend concentrates in the back half.
const TEAM_POWER_PACE_START_FRACTION = 0.5;

function planTeamPowerSidesForMatchday(input: {
  sidePlans: Array<{
    side: "d1" | "d2";
    competitiveness: DisciplineSideCompetitiveness;
    rivalryCount: number;
  }>;
  remainingCharges: number;
  seasonTotalCharges: number;
  remainingMatchdaysIncludingCurrent: number;
  totalMatchdays: number;
  matchdayIndex: number;
}): { plannedSides: Set<"d1" | "d2">; forcedSides: Set<"d1" | "d2"> } {
  const plannedSides = new Set<"d1" | "d2">();
  const forcedSides = new Set<"d1" | "d2">();
  if (input.remainingCharges <= 0 || input.sidePlans.length === 0) {
    return { plannedSides, forcedSides };
  }

  const remainingSlots = input.remainingMatchdaysIncludingCurrent * 2;
  const slack = remainingSlots - input.remainingCharges;
  const totalMatchdays = Math.max(1, input.totalMatchdays);
  const lateSeason = input.matchdayIndex >= Math.ceil(totalMatchdays * 0.7);

  // --- Opportunistic uses (original behaviour): arm sides when the matchup warrants it. ---
  let opportunisticUses = 0;
  if (slack < 0) {
    opportunisticUses = Math.min(2, Math.max(1, input.remainingCharges - Math.max(0, remainingSlots - 2)));
  } else if (slack <= 1) {
    opportunisticUses = 1;
  } else if (lateSeason && slack <= 3) {
    opportunisticUses = 1;
  }

  // --- Use-it-or-lose-it pressure: keep cumulative spend on an 85% pace and guarantee the
  // target is reached before the season ends, so charges are not left unspent. The pace is
  // back-loaded (no pressure in the first half) so early matchdays keep their tactical/conserve
  // feel; the concentration of forced spend lands in the back half plus the end-of-season floor. ---
  const targetTotalToSpend = Math.ceil(input.seasonTotalCharges * TEAM_POWER_TARGET_SEASON_USAGE);
  const chargesSpent = Math.max(0, input.seasonTotalCharges - input.remainingCharges);
  const paceProgress = Math.max(
    0,
    (input.matchdayIndex / totalMatchdays - TEAM_POWER_PACE_START_FRACTION) /
      (1 - TEAM_POWER_PACE_START_FRACTION),
  );
  const paceTargetByNow = Math.ceil(targetTotalToSpend * Math.min(1, paceProgress));
  const paceDeficit = Math.max(0, paceTargetByNow - chargesSpent);
  const remainingMatchdaysAfterThis = Math.max(0, input.remainingMatchdaysIncludingCurrent - 1);
  const mustStillSpend = Math.max(0, targetTotalToSpend - chargesSpent);
  // How much MUST land this matchday so the rest can still fit in the remaining slots (2/matchday).
  const endGameForce = Math.max(0, mustStillSpend - remainingMatchdaysAfterThis * 2);
  const pressureUses = Math.min(2, Math.max(paceDeficit, endGameForce));

  const targetUses = Math.min(
    input.sidePlans.length,
    input.remainingCharges,
    Math.max(opportunisticUses, pressureUses),
  );

  const orderedSides = [...input.sidePlans].sort(
    (left, right) =>
      sideTeamPowerPriority(right) - sideTeamPowerPriority(left) || left.side.localeCompare(right.side),
  );

  if (targetUses === 0) {
    const bestSide =
      orderedSides.find((side) => side.rivalryCount > 0) ??
      orderedSides.find((side) => side.competitiveness === "strong") ??
      null;
    if (
      bestSide &&
      (bestSide.rivalryCount > 0 || (bestSide.competitiveness === "strong" && input.matchdayIndex >= 4))
    ) {
      plannedSides.add(bestSide.side);
    }
    return { plannedSides, forcedSides };
  }

  for (const side of orderedSides) {
    if (plannedSides.size >= targetUses) {
      break;
    }
    // Sides beyond the opportunistic quota are pressure-driven: mark them "forced" so the
    // selector relaxes its score cutoff / eligibility and even low-competitiveness teams deploy.
    const isPressureDriven = plannedSides.size >= opportunisticUses;
    if (side.competitiveness === "weak" && !lateSeason && slack > 0 && !isPressureDriven) {
      continue;
    }
    plannedSides.add(side.side);
    if (isPressureDriven) {
      forcedSides.add(side.side);
    }
  }

  // If the weak-side guard skipped everything but pressure still demands a deployment, force the
  // top-priority side anyway — this is what makes teams that otherwise never fire hit the target.
  if (plannedSides.size === 0 && pressureUses > 0 && orderedSides[0]) {
    plannedSides.add(orderedSides[0].side);
    forcedSides.add(orderedSides[0].side);
  }

  return { plannedSides, forcedSides };
}

function powerAllowedForSide(input: {
  power: LegacyTeamPowerOption;
  competitiveness: DisciplineSideCompetitiveness;
  disciplineCategory: string | null | undefined;
  rivalryCount: number;
  lateSeason: boolean;
}) {
  if (isDebuffTeamPower(input.power)) {
    return input.rivalryCount > 0 || input.power.conditionalTrigger === "rival_top8_discipline";
  }

  const identitySlot = parseIdentityPowerSlotIndex(input.power.id);
  if (identitySlot == null) {
    const categoryMatch = powerMatchesDisciplineCategory(input.power, input.disciplineCategory);
    if (input.power.source === "facility") {
      return (
        (input.competitiveness === "strong" || input.lateSeason) &&
        categoryMatch
      );
    }
    return (
      input.rivalryCount > 0 ||
      categoryMatch ||
      input.competitiveness === "strong" ||
      input.power.conditionalTrigger === "rival_top8_discipline"
    );
  }

  const categoryMatch = powerMatchesDisciplineCategory(input.power, input.disciplineCategory);
  if (input.competitiveness === "strong") {
    return identitySlot <= 1 || categoryMatch;
  }
  if (input.competitiveness === "neutral") {
    return identitySlot >= 1 || categoryMatch;
  }
  return identitySlot >= 2;
}

function selectBestTeamPowerForSide(input: {
  context: LegacyLineupLoadedContext;
  modifiers: LineupDraftModifiers;
  side: "d1" | "d2";
  disciplineId: string | null | undefined;
  disciplineCategory: string | null | undefined;
  usedPowerIds: Set<string>;
  competitiveness: DisciplineSideCompetitiveness;
  rivalryCount: number;
  lateSeason: boolean;
  forced: boolean;
}) {
  const candidates = (input.context.teamPowers ?? []).filter((power) => {
    if (input.usedPowerIds.has(power.id)) return false;
    if (power.isUsedUp || power.chargesRemaining <= 0) return false;
    // Pressure-driven ("forced") deployments ignore the eligibility gate so a team that would
    // otherwise never clear it still spends its charge before the season ends.
    if (input.forced) return true;
    return powerAllowedForSide({
      power,
      competitiveness: input.competitiveness,
      disciplineCategory: input.disciplineCategory,
      rivalryCount: input.rivalryCount,
      lateSeason: input.lateSeason,
    });
  });
  if (candidates.length === 0 || !input.disciplineId) return null;
  const contextGameState = (input.context as LegacyLineupLoadedContext & { gameState?: GameState }).gameState ?? null;
  const teamCaptain = contextGameState ? selectTeamCaptain(contextGameState, input.context.teamId) : null;

  const ranked = candidates
    .map((power) => {
      const conditionalBonusPct =
        power.conditionalTrigger === "rival_top8_discipline" && input.rivalryCount > 0
          ? power.conditionalBonusPct
          : 0;
      const result = calculateTeamPowerModifierForSide({
        modifiers: {
          ...input.modifiers,
          [input.side]: {
            ...input.modifiers[input.side],
            teamPowerId: power.id,
          },
        },
        disciplineSide: input.side,
        disciplineId: input.disciplineId,
        disciplineCategory: input.disciplineCategory,
        teamPowers: candidates,
        teamCaptainPowerModifierPct: teamCaptain?.effects.teamPowerModifierPct ?? null,
        conditionalBonusPct,
      });
      const categoryMatch = powerMatchesDisciplineCategory(power, input.disciplineCategory);
      const identitySlot = parseIdentityPowerSlotIndex(power.id);
      const slotFit =
        identitySlot == null
          ? power.source === "facility"
            ? 0.15
            : 0
          : input.competitiveness === "strong"
            ? identitySlot === 0
              ? 0.55
              : identitySlot === 1
                ? 0.35
                : 0.1
            : input.competitiveness === "neutral"
              ? identitySlot === 1
                ? 0.35
                : identitySlot === 2
                  ? 0.25
                  : 0.05
              : identitySlot === 2
                ? 0.2
                : 0;
      const categoryFit = categoryMatch ? 0.5 : power.category === "flex" ? 0.2 : -0.35;
      const rivalryFit = conditionalBonusPct > 0 || (isDebuffTeamPower(power) && input.rivalryCount > 0) ? 0.45 : 0;
      const chargeFit = (power.chargesTotal - power.chargesRemaining) / Math.max(1, power.chargesTotal);
      const conserveBonus = power.chargesTotal >= 4 && input.competitiveness !== "strong" ? -0.25 : 0;
      return {
        power,
        score:
          result.teamPowerImpact +
          categoryFit +
          rivalryFit +
          slotFit +
          conserveBonus -
          chargeFit * 0.15,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const leftSlot = parseIdentityPowerSlotIndex(left.power.id) ?? 99;
      const rightSlot = parseIdentityPowerSlotIndex(right.power.id) ?? 99;
      if (leftSlot !== rightSlot) return leftSlot - rightSlot;
      if (right.power.chargesRemaining !== left.power.chargesRemaining) {
        return right.power.chargesRemaining - left.power.chargesRemaining;
      }
      return left.power.label.localeCompare(right.power.label);
    });

  const best = ranked[0] ?? null;
  // Forced deployments take the best available power regardless of the score cutoff, since the
  // alternative is wasting the charge entirely.
  if (!best || (!input.forced && best.score < 5.5)) {
    return null;
  }
  return best.power;
}

function applyAiTeamPowers(
  context: LegacyLineupLoadedContext,
  modifiers: LineupDraftModifiers,
  plannedEntries: LegacyLineupEntryInput[],
) {
  const teamPowers = context.teamPowers ?? [];
  const remainingCharges = countRemainingSelectableCharges(teamPowers);
  if (remainingCharges <= 0) {
    return;
  }
  const seasonTotalCharges = teamPowers
    .filter((power) => power.selectedForSeason && power.chargesTotal > 0)
    .reduce((sum, power) => sum + power.chargesTotal, 0);

  const totalSeasonSides = context.matchdayContract?.totalDisciplineSidesInSeason ?? 20;
  const totalMatchdays = Math.max(1, Math.ceil(totalSeasonSides / 2));
  const matchdayIndex = Math.max(1, context.matchday?.index || context.season?.currentMatchday || 1);
  const remainingMatchdaysIncludingCurrent = Math.max(1, totalMatchdays - matchdayIndex + 1);
  const lateSeason = matchdayIndex >= Math.ceil(totalMatchdays * 0.7);

  const sidePlans = [
    {
      side: "d1" as const,
      disciplineId: context.matchdayContract?.discipline1?.disciplineId ?? null,
      category: context.matchdayContract?.discipline1?.category ?? null,
      competitiveness: estimateDisciplineSideCompetitiveness({
        context,
        side: "d1",
        disciplineId: context.matchdayContract?.discipline1?.disciplineId ?? null,
        plannedEntries,
      }),
      rivalryCount: context.teamPowerWindows?.[context.matchdayContract?.discipline1?.disciplineId ?? ""]?.top8Rivals.length ?? 0,
    },
    {
      side: "d2" as const,
      disciplineId: context.matchdayContract?.discipline2?.disciplineId ?? null,
      category: context.matchdayContract?.discipline2?.category ?? null,
      competitiveness: estimateDisciplineSideCompetitiveness({
        context,
        side: "d2",
        disciplineId: context.matchdayContract?.discipline2?.disciplineId ?? null,
        plannedEntries,
      }),
      rivalryCount: context.teamPowerWindows?.[context.matchdayContract?.discipline2?.disciplineId ?? ""]?.top8Rivals.length ?? 0,
    },
  ];

  const { plannedSides, forcedSides } = planTeamPowerSidesForMatchday({
    sidePlans: sidePlans.map((side) => ({
      side: side.side,
      competitiveness: side.competitiveness,
      rivalryCount: side.rivalryCount,
    })),
    remainingCharges,
    seasonTotalCharges,
    remainingMatchdaysIncludingCurrent,
    totalMatchdays,
    matchdayIndex,
  });

  const usedPowerIds = new Set<string>();
  for (const side of sidePlans) {
    if (!plannedSides.has(side.side)) {
      continue;
    }
    const selected = selectBestTeamPowerForSide({
      context,
      modifiers,
      side: side.side,
      disciplineId: side.disciplineId,
      disciplineCategory: side.category,
      usedPowerIds,
      competitiveness: side.competitiveness,
      rivalryCount: side.rivalryCount,
      lateSeason,
      forced: forcedSides.has(side.side),
    });
    if (!selected) continue;
    modifiers[side.side].teamPowerId = selected.id;
    usedPowerIds.add(selected.id);
  }
}

/**
 * Die Minuskarte, die der SAISONPLAN für genau diese Seite vorgesehen hat.
 *
 * Ohne Plan griff die Entsorgung zur jeweils KLEINSTEN Minuskarte (`takeDumpNegativeFormCard`),
 * weil das den Schaden dieses einen Spieltags minimiert. Über die Saison ist das genau falsch
 * herum: die kleinen Minuskarten sind billig genug für jede Disziplin, die dicke `-8` braucht
 * die 2er-Disziplin. In der Simulation blieben so alle `-8` bis zum Saisonende liegen und
 * landeten dann im Rückstau auf i_spy und Basketball (je 6 Spieler) — zweimal −48 statt zweimal
 * −16 in einer 2er. Der Plan dreht die Reihenfolge um: größter Betrag zuerst ins billigste Loch.
 */
function takePlannedNegativeFormCard(input: {
  cards: LegacyFormCardOption[];
  usedIds: Set<string>;
  plannedCardIds: Set<string>;
}) {
  const picked =
    input.cards
      .filter((card) => !input.usedIds.has(card.id) && input.plannedCardIds.has(card.id))
      .sort((left, right) => left.value - right.value || left.id.localeCompare(right.id))[0] ?? null;
  if (picked) {
    input.usedIds.add(picked.id);
  }
  return picked;
}

/**
 * Die Minuskarte, die auf DIESER Seite am wenigsten kostet — dieselbe Kostenrechnung wie im
 * Saisonplan, nur ohne die (hier konstante) Kadergröße: `|Wert| × (Farbtreffer ? 2 : 1)`.
 *
 * `takeBestFormCard` taugt dafür nicht: es SIEBT farbgleiche Minuskarten komplett aus und
 * liefert `null`, wenn alle verbliebenen Karten die Farbe der Disziplin haben — der Aufrufer
 * fiel dann auf `takeDumpNegativeFormCard` zurück, das ausgerechnet die GRÖSSTE Karte nimmt.
 * Hier wird die Farbe stattdessen eingepreist statt als Ausschlusskriterium benutzt.
 */
function takeCheapestNegativeFormCard(input: {
  cards: LegacyFormCardOption[];
  usedIds: Set<string>;
  color: FormCardColor | null;
}) {
  const damage = (card: LegacyFormCardOption) =>
    Math.abs(card.value) * (input.color != null && card.color === input.color ? 2 : 1);
  const picked =
    input.cards
      .filter((card) => !input.usedIds.has(card.id))
      .sort((left, right) => damage(left) - damage(right) || left.id.localeCompare(right.id))[0] ?? null;
  if (picked) {
    input.usedIds.add(picked.id);
  }
  return picked;
}

function takeDumpNegativeFormCard(input: {
  cards: LegacyFormCardOption[];
  usedIds: Set<string>;
  color: FormCardColor | null;
}) {
  const candidates = input.cards.filter((card) => !input.usedIds.has(card.id));
  if (candidates.length === 0) {
    return null;
  }

  const nonMatching = candidates.filter((card) => !(input.color && card.color === input.color));
  const pool = nonMatching.length > 0 ? nonMatching : candidates;
  const picked =
    [...pool].sort((left, right) => {
      if (left.value !== right.value) {
        return left.value - right.value;
      }
      return left.id.localeCompare(right.id);
    })[0] ?? null;

  if (picked) {
    input.usedIds.add(picked.id);
  }
  return picked;
}

function getSideStrongestScore(input: {
  context: LegacyLineupLoadedContext;
  side: "d1" | "d2";
  disciplineId: string | null | undefined;
  plannedEntries: LegacyLineupEntryInput[];
}) {
  if (!input.disciplineId) {
    return 0;
  }

  const sideEntries = input.plannedEntries.filter((entry) => entry.disciplineSide === input.side);
  return Math.max(
    0,
    ...sideEntries.map((entry) =>
      input.context.disciplineScores.find(
        (score) => score.playerId === entry.playerId && score.disciplineId === input.disciplineId,
      )?.score ?? 0,
    ),
  );
}

type DisciplineSideCompetitiveness = "weak" | "neutral" | "strong";

function estimateDisciplineSideCompetitiveness(input: {
  context: LegacyLineupLoadedContext;
  side: "d1" | "d2";
  disciplineId: string | null | undefined;
  plannedEntries: LegacyLineupEntryInput[];
}): DisciplineSideCompetitiveness {
  if (!input.disciplineId) {
    return "neutral";
  }

  const sideEntries = input.plannedEntries.filter((entry) => entry.disciplineSide === input.side);
  if (sideEntries.length === 0) {
    return "neutral";
  }

  const rank = input.context.teamDisciplineRanks?.[input.disciplineId]?.rank ?? null;
  const strongestScore = getSideStrongestScore(input);

  if ((rank != null && rank >= 24) || strongestScore < 68) {
    return "weak";
  }
  if (rank != null && rank >= 20 && strongestScore < 74) {
    return "weak";
  }
  if (rank != null && rank <= 12 && strongestScore >= 76) {
    return "strong";
  }
  if (rank != null && rank <= 16 && strongestScore >= 80) {
    return "strong";
  }

  return "neutral";
}

function pickPrimaryFormCardForSide(input: {
  competitiveness: DisciplineSideCompetitiveness;
  preferNegativeDump: boolean;
  negativeCards: LegacyFormCardOption[];
  positiveCards: LegacyFormCardOption[];
  usedIds: Set<string>;
  color: FormCardColor | null;
  playerCount: number;
  plan: FormCardSeasonPlan;
  currentMatchdayIndex: number;
  plannedCardIds: Set<string>;
  doctrine: FormCardDoctrineProfile;
  positiveSelected: number;
  desiredPositiveThisMatchday: number;
  mustSpendPositives: boolean;
  /** Der Saisonplan trägt eine echte Disziplin-Zuordnung (kein Platzhalter-Spielplan). */
  planActive: boolean;
  /** Karten, die der Plan für GENAU diese Seite auf den PRIMÄRplatz gelegt hat. */
  plannedPrimaryCardIds: Set<string>;
}) {
  if (input.competitiveness === "weak") {
    const planned = takePlannedNegativeFormCard({
      cards: input.negativeCards,
      usedIds: input.usedIds,
      plannedCardIds: input.plannedCardIds,
    });
    if (planned) return planned;
    // Schwache Seite, für die der Plan HEUTE keine Minuskarte vorsieht — trotzdem wird entsorgt:
    // Jede früh abgeladene Minuskarte macht einen späteren Primärplatz für eine PLUSkarte frei,
    // und dieser Kapazitätsgewinn wiegt in der Simulation schwerer als der Verlust auf dieser
    // einen Seite (den Dump hier ganz zu unterlassen kostete unterm Strich 264 → 150).
    //
    // Geändert hat sich nur, WELCHE Karte fällt: `takeDumpNegativeFormCard` sortiert aufsteigend
    // über den (negativen) Wert und greift damit zur GRÖSSTEN Minuskarte — sinnvoll unter echtem
    // Entsorgungszwang, fatal bei einer Gelegenheit. Auf einer schwachen 6er-Disziplin kostete
    // das −48, während der Plan für dieselbe −8 längst eine 2er-Disziplin vorgesehen hatte
    // (−16). `takeCheapestNegativeFormCard` nimmt stattdessen die hier BILLIGSTE Karte und
    // lässt die dicken für ihre geplanten Verstecke liegen.
    if (input.planActive && !input.preferNegativeDump) {
      const cheapest = takeCheapestNegativeFormCard({
        cards: input.negativeCards,
        usedIds: input.usedIds,
        color: input.color,
      });
      if (cheapest) return cheapest;
    }
    return takeDumpNegativeFormCard({
      cards: input.negativeCards,
      usedIds: input.usedIds,
      color: input.color,
    });
  }

  if (input.preferNegativeDump) {
    const planned = takePlannedNegativeFormCard({
      cards: input.negativeCards,
      usedIds: input.usedIds,
      plannedCardIds: input.plannedCardIds,
    });
    if (planned) return planned;
    // For both strong and neutral dump sides: prefer non-color-matched but always fall back
    // to any negative (including color-matched) so forced dumps never silently skip.
    const nonMatching = takeBestFormCard({
      cards: input.negativeCards,
      usedIds: input.usedIds,
      color: input.color,
      polarity: "negative",
    });
    if (nonMatching) return nonMatching;
    return takeDumpNegativeFormCard({
      cards: input.negativeCards,
      usedIds: input.usedIds,
      color: input.color,
    });
  }

  // Hat der Plan für DIESE Seite eine Pluskarte auf den Primärplatz gelegt, die noch frei ist?
  const hasPlannedPositive =
    input.planActive &&
    input.positiveCards.some((card) => !input.usedIds.has(card.id) && input.plannedPrimaryCardIds.has(card.id));

  // `desiredPositiveThisMatchday` verteilt die Pluskarten grob über die Restsaison
  // (Karten ÷ Restspieltage). Die Näherung wird bei vielen Restspieltagen zu 1 und deckelte
  // damit den ganzen Spieltag auf EINE Karte: an einem Spieltag mit zwei farbgleichen
  // 6er-Disziplinen nahm d1 die passende Karte und d2 ging leer aus, obwohl dort eine zweite
  // Karte derselben Farbe bereitlag. Der Plan ist die exakte Fassung derselben Absicht — er hat
  // die Karte bewusst HIER hingelegt — und hebt deshalb den Deckel auf.
  if (input.positiveSelected >= input.desiredPositiveThisMatchday && !hasPlannedPositive) {
    return null;
  }
  // Neutrale Seiten investieren nur unter Ausgabedruck (Karten stauen sich / Saisonende naht) —
  // sonst gehören die knappen Positivkarten den Seiten, auf denen das Team wirklich mitspielt.
  // Diese Sperre bleibt AUCH mit Plan: der Plan rechnet in Formmodifier und weiß nichts über
  // Ränge — ob Punkte hier überhaupt etwas bewegen, entscheidet weiter die Wettbewerbslogik.
  if (input.competitiveness === "neutral" && !input.mustSpendPositives) {
    return null;
  }

  return selectPositiveFormCardForSlot({
    positiveCards: input.positiveCards,
    usedIds: input.usedIds,
    color: input.color,
    playerCount: input.playerCount,
    plan: input.plan,
    currentMatchdayIndex: input.currentMatchdayIndex,
    plannedCardIds: input.plannedCardIds,
    patience: input.doctrine.patience,
    mustSpend: input.mustSpendPositives,
  });
}

function pickSecondaryFormCardForSide(input: {
  competitiveness: DisciplineSideCompetitiveness;
  primaryCard: LegacyFormCardOption | null;
  positiveCards: LegacyFormCardOption[];
  usedIds: Set<string>;
  color: FormCardColor | null;
  playerCount: number;
  plan: FormCardSeasonPlan;
  currentMatchdayIndex: number;
  plannedCardIds: Set<string>;
  doctrine: FormCardDoctrineProfile;
  /** Seite führt die Disziplin ohnehin klar an — die zweite dicke Karte wäre Overkill. */
  dominant: boolean;
  positiveSelected: number;
  desiredPositiveThisMatchday: number;
  mustSpendPositives: boolean;
  /** Der Saisonplan trägt eine echte Disziplin-Zuordnung (kein Platzhalter-Spielplan). */
  planActive: boolean;
  /** Karten, die der Plan für GENAU diese Seite auf den SEKUNDÄRplatz gelegt hat. */
  plannedSecondaryCardIds: Set<string>;
}) {
  // Weak sides never get secondary cards.
  if (input.competitiveness === "weak") return null;
  // Overkill-Bremse: Wer die Disziplin ohnehin klar anführt, gewinnt auch mit EINER Karte —
  // die zweite fehlt später (Chris: "selbst mit nur 1 8x2 Karte wären sie immer noch 1.").
  // Wie konsequent verzichtet wird, ist Team-Charakter (restraint), kein Einheitsschalter.
  // Steht VOR dem Plan: der Plan rechnet in Formmodifier und weiß nichts über Ränge — die
  // Wettbewerbslogik behält das Vetorecht über die Vorabsicht.
  if (input.dominant && !input.mustSpendPositives && input.doctrine.restraint >= 0.35) return null;

  if (input.planActive) {
    // OB eine Seite überhaupt doppelt belegt wird, entscheidet ab hier allein der Saisonplan.
    //
    // Vorher entschied das der Tageswert, und das kostete doppelt: an Spieltag 1 nahm Hockey
    // (5er, rot) Primär- UND Sekundärplatz (`rot+8` und `rot+2`), womit das Spieltags-Budget
    // `desiredPositiveThisMatchday` erschöpft war und Fechten (5er, GRÜN) derselben Runde leer
    // ausging — die kleine Zweitkarte verdrängte eine ganze Disziplinseite.
    //
    // Zwei bisherige Sperren fallen im Planpfad bewusst weg:
    //   - `primaryCard.value < 0 → kein Sekundär` war ein KAPAZITÄTS-Artefakt, keine Spielregel:
    //     `calculateFormModifierForSide` summiert beide Karten und verbietet nur eine NEGATIVE
    //     zweite Karte. Weil jeder Spieler eine Plus- UND eine Minuskarte erzeugt und alle
    //     Minuskarten gespielt werden müssen (sonst Punktabzug, s. form-card-penalty-service),
    //     belegen die Minuskarten den Großteil der Primärplätze. Mit der Sperre verrotteten in
    //     der Simulation 6 von 12 Pluskarten ungespielt.
    //   - `desiredPositiveThisMatchday` und die 3er-Grenze sind Näherungen für „nicht alles auf
    //     einmal". Der Plan ist die exakte Fassung derselben Absicht und ersetzt sie hier.
    if (input.plannedSecondaryCardIds.size === 0) return null;
    return selectPositiveFormCardForSlot({
      positiveCards: input.positiveCards.filter((card) => input.plannedSecondaryCardIds.has(card.id)),
      usedIds: input.usedIds,
      color: input.color,
      playerCount: input.playerCount,
      plan: input.plan,
      currentMatchdayIndex: input.currentMatchdayIndex,
      plannedCardIds: input.plannedSecondaryCardIds,
      patience: input.doctrine.patience,
      mustSpend: input.mustSpendPositives,
    });
  }

  // Ohne echten Spielplan (synthetische Kontexte, alte Saves) bleibt der bisherige Weg.
  // Neutral sides only get a secondary when positives are piling up.
  if (input.competitiveness === "neutral" && !input.mustSpendPositives) return null;
  // Never put a negative in the secondary slot.
  if (input.primaryCard && input.primaryCard.value < 0) return null;
  if (input.positiveSelected >= input.desiredPositiveThisMatchday) return null;
  // Kleine Disziplinen rechtfertigen keine Doppel-Investition: der zweite Karteneinsatz
  // wirkt dort nur mit halber Kraft einer großen Disziplin.
  if (input.playerCount <= 3 && !input.mustSpendPositives) return null;

  return selectPositiveFormCardForSlot({
    positiveCards: input.positiveCards,
    usedIds: input.usedIds,
    color: input.color,
    playerCount: input.playerCount,
    plan: input.plan,
    currentMatchdayIndex: input.currentMatchdayIndex,
    plannedCardIds: input.plannedCardIds,
    patience: input.doctrine.patience,
    mustSpend: input.mustSpendPositives,
  });
}

function getAiIntensityForSide(input: {
  context: LegacyLineupLoadedContext;
  side: "d1" | "d2";
  disciplineId: string | null | undefined;
  plannedEntries: LegacyLineupEntryInput[];
}) {
  if (!input.disciplineId) {
    return "normal" as const;
  }
  const rank = input.context.teamDisciplineRanks?.[input.disciplineId]?.rank ?? null;
  const sideEntries = input.plannedEntries.filter((entry) => entry.disciplineSide === input.side);
  const strongestScore = getSideStrongestScore({
    context: input.context,
    side: input.side,
    disciplineId: input.disciplineId,
    plannedEntries: input.plannedEntries,
  });
  const hasCaptain = sideEntries.some((entry) => entry.isCaptain);
  const matchdayIndex = Math.max(1, input.context.matchdayContract?.matchdayIndex ?? input.context.matchday.index ?? 1);
  const totalSeasonSides = input.context.matchdayContract?.totalDisciplineSidesInSeason ?? 20;
  const totalMatchdays = Math.max(1, Math.ceil(totalSeasonSides / 2));
  const isMidSeasonOrLater = matchdayIndex >= Math.ceil(totalMatchdays * 0.4);
  const isLateSeason = matchdayIndex >= Math.ceil(totalMatchdays * 0.7);
  const requiredPlayers =
    input.context.disciplineSidePlayerCounts?.[`${input.disciplineId}::${input.side}`] ??
    input.context.disciplinePlayerCounts[input.disciplineId] ??
    sideEntries.length;

  const isWeakDisciplineWindow =
    (rank != null && rank >= 28) ||
    (rank != null && rank >= 22 && strongestScore < 74) ||
    strongestScore < 66;

  if (isWeakDisciplineWindow) {
    return matchdayIndex <= 2 ? "conserve" as const : "normal" as const;
  }

  const hasHighLeverageRank = rank != null && rank <= 8 && strongestScore >= 76;
  const hasEliteSpecialistWindow = strongestScore >= (isLateSeason ? 84 : 88);
  const hasTopHalfPressure = rank != null && rank <= 16 && strongestScore >= 72 && isMidSeasonOrLater;
  const hasLargeDisciplineLeverage = requiredPlayers >= 5 && rank != null && rank <= 20 && strongestScore >= 72;
  const hasLateComebackWindow = isLateSeason && rank != null && rank <= 24 && strongestScore >= 78;

  // Fatigue awareness: since intensity now drives per-player fatigue + injury accrual (not just
  // score), "push" is no longer a free bonus — it burns ~15% extra stamina and raises injury risk
  // on exactly the players it engages. Read the side's current fatigue via the same accessor the
  // score engine uses (context.fatigueByPlayerId[...].count) so the guard sees what the engine sees.
  const sideFatigues = sideEntries
    .map((entry) => input.context.fatigueByPlayerId?.[entry.playerId]?.count)
    .filter((count): count is number => typeof count === "number" && Number.isFinite(count));
  const avgSideFatigue =
    sideFatigues.length > 0 ? sideFatigues.reduce((sum, count) => sum + count, 0) / sideFatigues.length : 0;
  const pushFatigueCeiling = Number(process.env.OLY_AI_PUSH_FATIGUE_CEILING ?? 65) || 65;

  const wantsPush =
    hasCaptain ||
    hasHighLeverageRank ||
    hasEliteSpecialistWindow ||
    hasTopHalfPressure ||
    hasLargeDisciplineLeverage ||
    hasLateComebackWindow;

  if (wantsPush) {
    // Push only when the side isn't already heavily fatigued — otherwise the extra load mostly
    // buys injuries and a deeper recovery hole for a few score points. Above the ceiling, hold at
    // normal so push stays a deliberate, sparing gamble rather than a constant.
    if (avgSideFatigue <= pushFatigueCeiling) {
      return "push" as const;
    }
    // Very fatigued AND not a genuine top-leverage window: actively conserve to bank recovery.
    const isGenuineHighLeverage = hasCaptain || hasHighLeverageRank || hasEliteSpecialistWindow;
    if (avgSideFatigue >= pushFatigueCeiling + 15 && !isGenuineHighLeverage) {
      return "conserve" as const;
    }
    return "normal" as const;
  }
  if (matchdayIndex <= 2 && rank != null && rank >= 24 && strongestScore < 68) {
    return "conserve" as const;
  }
  return "normal" as const;
}

function applyAiIntensity(context: LegacyLineupLoadedContext, modifiers: LineupDraftModifiers, plannedEntries: LegacyLineupEntryInput[]) {
  modifiers.d1.intensity = getAiIntensityForSide({
    context,
    side: "d1",
    disciplineId: context.matchdayContract?.discipline1?.disciplineId ?? null,
    plannedEntries,
  });
  modifiers.d2.intensity = getAiIntensityForSide({
    context,
    side: "d2",
    disciplineId: context.matchdayContract?.discipline2?.disciplineId ?? null,
    plannedEntries,
  });
}

export function buildAiLegacyLineupModifiers(
  context: LegacyLineupLoadedContext,
  plannedEntries: LegacyLineupEntryInput[] = context.existingDraft?.entries ?? context.entries ?? [],
): LineupDraftModifiers {
  const modifiers = createDefaultLineupDraftModifiers();
  const formCards = (context.formCards ?? []).filter((card) => !card.isUsed);

  const totalSeasonSides = context.matchdayContract?.totalDisciplineSidesInSeason ?? 20;
  const totalMatchdays = Math.max(1, Math.ceil(totalSeasonSides / 2));
  const currentMatchdayIndex = Math.max(1, context.matchday?.index || context.season?.currentMatchday || 1);
  const remainingMatchdaysIncludingCurrent = Math.max(1, totalMatchdays - currentMatchdayIndex + 1);
  const remainingPrimarySlots = remainingMatchdaysIncludingCurrent * 2;
  const negativeCards = formCards.filter((card) => card.value < 0);
  const positiveCards = formCards.filter((card) => card.value > 0);
  const dumpsRequiredThisMatchday = Math.min(
    2,
    Math.max(0, negativeCards.length - Math.max(0, remainingPrimarySlots - 2)),
  );
  // Urgency flags: true when cards are accumulating faster than available slots can absorb them.
  // Negative urgency: more negatives than remaining primary slots (can't all be used without color-override).
  // Positive urgency: more than 2 positives needed per matchday to exhaust the pool.
  const negativeUrgency = negativeCards.length > remainingPrimarySlots;
  const positiveUrgency = positiveCards.length > remainingMatchdaysIncludingCurrent * 2;
  // Ausgaben-Pace über die Saison: ~85% der Positivkarten sollen bis zum Saisonende fallen,
  // leicht backloaded (Exponent > 1), damit früh gespart und hinten raus ausgegeben wird.
  // Hinkt das Team dem Pace hinterher, entsteht Ausgabedruck — Karten sollen nicht verrotten.
  const positiveSpentSoFar = (context.formCards ?? []).filter((card) => card.isUsed && card.value > 0).length;
  const totalPositiveSeason = positiveSpentSoFar + positiveCards.length;
  const paceProgress = Math.pow(Math.max(0, currentMatchdayIndex - 1) / totalMatchdays, 1.15);
  const paceTarget = Math.floor(totalPositiveSeason * 0.85 * paceProgress);
  const paceDeficit = Math.max(0, paceTarget - positiveSpentSoFar);
  const mustSpendPositives =
    positiveUrgency || paceDeficit >= 1 || remainingMatchdaysIncludingCurrent <= 2;
  const desiredPositiveThisMatchday = Math.min(
    4,
    Math.max(Math.ceil(positiveCards.length / remainingMatchdaysIncludingCurrent), Math.min(3, paceDeficit)),
  );
  const doctrine = getFormCardDoctrineProfile(context);
  const usedIds = new Set<string>();
  let positiveSelected = 0;
  const sides = [
    {
      side: "d1" as const,
      disciplineId: context.matchdayContract?.discipline1?.disciplineId ?? null,
      color: getFormCardColorForDisciplineCategory(context.matchdayContract?.discipline1?.category),
      requiredPlayers: context.matchdayContract?.discipline1?.requiredPlayers ?? null,
    },
    {
      side: "d2" as const,
      disciplineId: context.matchdayContract?.discipline2?.disciplineId ?? null,
      color: getFormCardColorForDisciplineCategory(context.matchdayContract?.discipline2?.category),
      requiredPlayers: context.matchdayContract?.discipline2?.requiredPlayers ?? null,
    },
  ];
  const sidePlans = sides.map((side) => {
    const rank = side.disciplineId ? context.teamDisciplineRanks?.[side.disciplineId]?.rank ?? null : null;
    const strongestScore = getSideStrongestScore({
      context,
      side: side.side,
      disciplineId: side.disciplineId,
      plannedEntries,
    });
    const competitiveness = estimateDisciplineSideCompetitiveness({
      context,
      side: side.side,
      disciplineId: side.disciplineId,
      plannedEntries,
    });
    const contractPlayerCount =
      side.requiredPlayers ??
      (side.disciplineId
        ? context.disciplineSidePlayerCounts?.[`${side.disciplineId}::${side.side}`] ??
          context.disciplinePlayerCounts[side.disciplineId] ??
          null
        : null);
    const playerCount = resolveFormCardSidePlayerCount({
      filledPlayers: plannedEntries.filter((entry) => entry.disciplineSide === side.side).length,
      contractPlayerCount,
    });

    return {
      ...side,
      competitiveness,
      playerCount,
      // Klare Dominanz: Die Seite führt die Disziplin an UND bringt Top-Personal — hier reicht
      // eine Karte, die zweite wäre verschenkter Saisonvorrat (Overkill-Bremse im Secondary-Pick).
      dominant: competitiveness === "strong" && rank != null && rank <= 2 && strongestScore >= 80,
      // Marginaler Punktwert eines Rang-Schritts (rank-to-points): Positivkarten sollen dahin,
      // wo ein Rang-Sprung real Punkte bewegt — große Disziplinen und umkämpfte Ränge zuerst.
      rankPointSwing: (() => {
        if (!side.disciplineId || side.requiredPlayers == null) return null;
        return getMarginalRankPointSwing(side.requiredPlayers, rank);
      })(),
    };
  });
  // --- Saisonplan der Formkarten ---------------------------------------------------------
  // EINMAL pro Aufstellungslauf: welche Karte gehört über die Restsaison auf welchen Slot?
  // Die Zuordnung ist die Vorabsicht; alles darunter (Wettbewerbslage, Ausgabedruck,
  // Overkill-Bremse) bleibt die kurzfristige Korrektur am Spieltag — das vom Nutzer gewünschte
  // „umbuchen". Neu abgeleitet statt gespeichert: fällt ein Spieler aus oder ist eine Karte
  // anders verbraucht, ändert sich die Eingabe und der nächste Plan ordnet die Restkarten neu zu.
  const { slots: planSlots, hasRealSchedule } = collectFormCardPlanSlots({
    context,
    currentMatchdayIndex,
    remainingMatchdaysIncludingCurrent,
    currentSides: sidePlans.map((side) => ({
      side: side.side,
      disciplineId: side.disciplineId,
      color: side.color,
      playerCount: side.playerCount,
    })),
  });
  const formCardSeasonPlan = buildAiFormCardSeasonPlan({
    cards: formCards.map((card) => ({ id: card.id, value: card.value, color: card.color })),
    slots: planSlots,
  });
  const plannedCardIdsBySide: Record<"d1" | "d2", Set<string>> = {
    d1: getPlannedCardIdsForSlot(formCardSeasonPlan, currentMatchdayIndex, "d1"),
    d2: getPlannedCardIdsForSlot(formCardSeasonPlan, currentMatchdayIndex, "d2"),
  };
  const plannedPrimaryCardIdsBySide: Record<"d1" | "d2", Set<string>> = {
    d1: getPlannedCardIdsForSlot(formCardSeasonPlan, currentMatchdayIndex, "d1", "primary"),
    d2: getPlannedCardIdsForSlot(formCardSeasonPlan, currentMatchdayIndex, "d2", "primary"),
  };
  const plannedSecondaryCardIdsBySide: Record<"d1" | "d2", Set<string>> = {
    d1: getPlannedCardIdsForSlot(formCardSeasonPlan, currentMatchdayIndex, "d1", "secondary"),
    d2: getPlannedCardIdsForSlot(formCardSeasonPlan, currentMatchdayIndex, "d2", "secondary"),
  };
  const negativeCardIds = new Set(negativeCards.map((card) => card.id));
  // Seiten, für die der Plan HEUTE eine Minuskarte vorsieht. Das ersetzt das bisherige
  // „entsorgen, wenn der Rückstau zwingt" durch „entsorgen, wenn es billig ist": ohne Plan
  // sammelten sich die Minuskarten bis zum Saisonende und fielen dann zwangsweise in die
  // Disziplinen, die gerade dran waren — in der Simulation zweimal −48 in 6er-Disziplinen.
  //
  // NUR mit echtem Spielplan: ohne ihn weiß niemand, ob heute wirklich der billigste Tag ist,
  // und die alte Rückstau-Logik bleibt die ehrlichere Antwort.
  const plannedNegativeSideCount = hasRealSchedule
    ? (["d1", "d2"] as const).filter((side) =>
        [...plannedCardIdsBySide[side]].some((cardId) => negativeCardIds.has(cardId)),
      ).length
    : 0;
  // When negative urgency is active, also flag the weaker sides for forced dumps so all
  // negatives get assigned rather than waiting until the very last matchday.
  const effectiveDumpsRequired = Math.max(
    plannedNegativeSideCount,
    negativeUrgency ? Math.min(2, negativeCards.length) : dumpsRequiredThisMatchday,
  );
  // "Echter Zwang" für Dumps auf starken Seiten: nur wenn die Saison fast vorbei ist oder
  // die Negativkarten selbst die verbleibenden Primärslots übersteigen. Sonst bleibt die
  // stärkste/aussichtsreichste Seite von Minuskarten verschont (Wettbewerbslogik vor
  // Entsorgungspflicht).
  const allowStrongSideDump =
    remainingMatchdaysIncludingCurrent <= 2 || negativeCards.length >= remainingPrimarySlots;
  const negativeDumpSides = planNegativeDumpSidesForMatchday({
    sides: sidePlans,
    dumpsRequiredThisMatchday: effectiveDumpsRequired,
    unusedNegativeCount: negativeCards.length,
    allowStrongSideDump,
  });

  // Kartenvergabe in Opportunitäts-Reihenfolge statt stur d1-zuerst: die Seite mit der
  // besseren Wettbewerbslage und dem größeren Punkthebel greift zuerst in den (knappen)
  // Positivkarten-Pool. Die Zuordnung selbst bleibt pro Seite (side.side als Key).
  const orderedSidePlans = [...sidePlans].sort((left, right) => {
    const competitivenessDiff = competitivenessRank(right.competitiveness) - competitivenessRank(left.competitiveness);
    if (competitivenessDiff !== 0) return competitivenessDiff;
    // Zwei schwache Seiten sind reine Müllkippen: die KLEINERE Disziplin zuerst — dort
    // kostet die Minuskarte am wenigsten Teampunkte (Malus × Spielerzahl).
    if (left.competitiveness === "weak" && right.competitiveness === "weak") {
      const dumpCostDiff = left.playerCount - right.playerCount;
      if (dumpCostDiff !== 0) return dumpCostDiff;
      return left.side.localeCompare(right.side);
    }
    const swingDiff = (right.rankPointSwing ?? 0) - (left.rankPointSwing ?? 0);
    if (swingDiff !== 0) return swingDiff;
    const playerCountDiff = right.playerCount - left.playerCount;
    if (playerCountDiff !== 0) return playerCountDiff;
    return left.side.localeCompare(right.side);
  });

  for (const side of orderedSidePlans) {
    const primary =
      formCards.length > 0
        ? pickPrimaryFormCardForSide({
            competitiveness: side.competitiveness,
            preferNegativeDump: negativeDumpSides.has(side.side),
            negativeCards,
            positiveCards,
            usedIds,
            color: side.color,
            playerCount: side.playerCount,
            plan: formCardSeasonPlan,
            currentMatchdayIndex,
            plannedCardIds: plannedCardIdsBySide[side.side],
            doctrine,
            planActive: hasRealSchedule,
            plannedPrimaryCardIds: plannedPrimaryCardIdsBySide[side.side],
            positiveSelected,
            desiredPositiveThisMatchday,
            mustSpendPositives,
          })
        : null;

    if (primary) {
      modifiers[side.side].primaryFormCardId = primary.id;
      if (primary.value > 0) {
        positiveSelected += 1;
      }
    }

    const secondary =
      formCards.length > 0
        ? pickSecondaryFormCardForSide({
            competitiveness: side.competitiveness,
            primaryCard: primary,
            positiveCards,
            usedIds,
            color: side.color,
            playerCount: side.playerCount,
            plan: formCardSeasonPlan,
            currentMatchdayIndex,
            plannedCardIds: plannedCardIdsBySide[side.side],
            doctrine,
            dominant: side.dominant,
            planActive: hasRealSchedule,
            plannedSecondaryCardIds: plannedSecondaryCardIdsBySide[side.side],
            positiveSelected,
            desiredPositiveThisMatchday,
            mustSpendPositives,
          })
        : null;

    if (secondary) {
      modifiers[side.side].secondaryFormCardId = secondary.id;
      positiveSelected += 1;
    }
  }

  applyAiTeamPowers(context, modifiers, plannedEntries);
  applyAiIntensity(context, modifiers, plannedEntries);
  // KEINE kadergenaue Mutator-Auswahl mehr. `applyMutatorTraitsToLineupModifiers` waehlte ueber
  // `selectBestMutatorTraitsForEntries` genau die Traits, die der eigene Kader BESITZT — jedes
  // KI-Team bekam damit garantierte Treffer, waehrend das menschliche Team (das kein Auswahlfeld
  // dafuer hat) auf den blinden Spieltags-Wurf angewiesen war. Die Mutatoren sind eine Eigenschaft
  // der Disziplin und fuer alle 32 Teams dieselben; die Wertung nimmt jetzt den Wurf.
  return modifiers;
}

export function applyAiLegacyLineupBatchLocally(
  input: AiBatchApplyInput,
  persistence: PersistenceService = createPersistenceService(),
): AiBatchApplyResult {
  const totalStartedAt = performance.now();
  const performanceBreakdown = {
    formCardPlanningMs: 0,
    aiLineupGenerationMs: 0,
    lineupValidationMs: 0,
    mutatorPlanningMs: 0,
    saveWriteMs: 0,
    contextLoadMs: 0,
    teamPowerPlanningMs: 0,
    totalMs: 0,
  };
  const includeWarningTeams = input.includeWarningTeams ?? false;
  const overwriteExisting = input.overwriteExisting ?? false;
  const dryRun = input.dryRun ?? true;
	  const scope = resolveLocalScope(input, persistence);
	  const save = scope.save;
  const results: AiBatchApplyTeamResult[] = [];
  const pendingDrafts: Array<{
    resultIndex: number;
    params: LegacyLineupKeyParams;
    entries: LegacyLineupEntryInput[];
    modifiers: LineupDraftModifiers;
  }> = [];
	  const formCardStartedAt = performance.now();
	  const existingSeasonCards = (save.gameState.seasonState?.formCards ?? []).filter((card) => card.seasonId === scope.seasonId);
	  let preparedGameState = save.gameState;
	  const formCardEnsure = {
	    ok: true as const,
	    warnings: [] as string[],
	    generatedCardCount: 0,
	    existingCardCount: existingSeasonCards.length,
	  };
	  try {
	    preparedGameState = ensureLocalFormCardsForSeason(save.gameState, scope.saveId, scope.seasonId);
	    const preparedSeasonCards = (preparedGameState.seasonState?.formCards ?? []).filter((card) => card.seasonId === scope.seasonId);
	    // Additive Generierung: echte Differenz melden (nicht 0, sobald irgendeine Karte schon existierte).
	    formCardEnsure.generatedCardCount = Math.max(0, preparedSeasonCards.length - existingSeasonCards.length);
	  } catch (error) {
	    formCardEnsure.warnings.push(error instanceof Error ? `form_card_prepare_skipped:${error.message}` : "form_card_prepare_skipped");
	  }
	  performanceBreakdown.formCardPlanningMs += elapsedSince(formCardStartedAt);
	  const powerStartedAt = performance.now();
	  try {
	    preparedGameState = ensureLocalTeamPowersForSeason(preparedGameState, scope.saveId, scope.seasonId);
	  } catch (error) {
	    formCardEnsure.warnings.push(error instanceof Error ? `team_power_prepare_skipped:${error.message}` : "team_power_prepare_skipped");
	  }
	  performanceBreakdown.teamPowerPlanningMs += elapsedSince(powerStartedAt);
	  if (!dryRun && typeof persistence.saveSingleplayerState === "function") {
	    persistence.saveSingleplayerState(scope.saveId, preparedGameState);
	  }

  for (const team of scope.teams) {
    const params: LegacyLineupKeyParams = {
      saveId: scope.saveId,
      seasonId: scope.seasonId,
      matchdayId: scope.matchdayId,
      teamId: team.teamId,
    };
    const contextStartedAt = performance.now();
    const contextResult = loadLocalLegacyLineupContextFromGameState(preparedGameState, params);
    performanceBreakdown.contextLoadMs += elapsedSince(contextStartedAt);

    if (!contextResult.ok) {
      results.push({
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: "blocked",
        captainSlotsUsed: null,
        captainSlotsRemaining: null,
        d1CaptainSelectionStatus: null,
        d2CaptainSelectionStatus: null,
        captainDecisions: [],
        result: "skipped_blocked",
        overwriteExisting: false,
        warnings: contextResult.warnings,
        blockingReasons: contextResult.errors,
        saved: false,
      });
      continue;
    }

    const hasCompleteExistingDraft = isLegacyLineupDraftComplete(contextResult.context);
    // Nur fuer Teams OHNE Manager am Tisch: ein `passive`-Team wuerde sonst mit leerer
    // Einsatzliste antreten, weil niemand sie fuellt. Menschlich gesteuerte Teams sind
    // hier bewusst NICHT dabei — siehe die Sperre direkt darunter.
    const canAutoFillIncompleteLineup = !hasCompleteExistingDraft;

    // Ein `manual`-Team stellt der Spieler auf. Punkt. Frueher stand hier
    // `manual && !canAutoFillIncompleteLineup`, die Sperre griff also NUR bei bereits
    // vollstaendiger Aufstellung — genau umgekehrt zum Bedarf: Die leere Einsatzliste
    // eines neuen Spieltags galt als "unvollstaendig" und wurde von der KI gefuellt
    // (Komfort statt Blockade). Der Spieler fand seinen naechsten Spieltag damit fertig
    // aufgestellt vor, samt der von `buildAiLegacyLineupModifiers` gewaehlten FORMKARTEN,
    // die er nie gespielt hatte. Die Aufstellung ist die Kernentscheidung des Spielers;
    // fehlt sie, meldet der Resolve-Schritt `missing_manual_lineup` — das ist der richtige
    // Weg, nicht ein stiller KI-Griff in fremde Karten.
    if (team.controlMode === "manual") {
      results.push({
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        controlMode: team.controlMode,
        aiEligible: false,
        previewStatus: "blocked",
        captainSlotsUsed: null,
        captainSlotsRemaining: null,
        d1CaptainSelectionStatus: null,
        d2CaptainSelectionStatus: null,
        captainDecisions: [],
        result: "skipped_manual",
        overwriteExisting: false,
        warnings: [],
        blockingReasons: [],
        saved: false,
      });
      continue;
    }

    if (team.controlMode === "passive" && !canAutoFillIncompleteLineup) {
      results.push({
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        controlMode: team.controlMode,
        aiEligible: false,
        previewStatus: "blocked",
        captainSlotsUsed: null,
        captainSlotsRemaining: null,
        d1CaptainSelectionStatus: null,
        d2CaptainSelectionStatus: null,
        captainDecisions: [],
        result: "skipped_passive",
        overwriteExisting: false,
        warnings: [],
        blockingReasons: [],
        saved: false,
      });
      continue;
    }

    // Perf: Teams mit bereits VOLLSTÄNDIGER Aufstellung werden ohne `overwriteExisting` ohnehin
    // übersprungen — diese Entscheidung fiel bisher aber erst NACH `buildAiLegacyLineupPreview` +
    // `calculateLocalLegacyLineupPreviewFromContext`. Gemessen an 32 Teams: ein Lauf, in dem alle
    // Aufstellungen schon existierten, verbrannte trotzdem ~3,5 s Generierung + ~2,5 s Validierung
    // für Ergebnisse, die anschließend verworfen wurden (~6 s von ~8 s Gesamtdauer des Batches).
    // Die Bedingung hängt nur an `hasCompleteExistingDraft`/`overwriteExisting`, ist hier also
    // bereits vollständig entscheidbar. `previewStatus`/Captain-Felder bleiben leer, weil für ein
    // NICHT angefasstes Team keine KI-Aufstellung berechnet wurde — das ist ehrlicher als der
    // frühere Status einer sofort weggeworfenen Vorschau.
    if (hasCompleteExistingDraft && !overwriteExisting) {
      results.push({
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: "blocked",
        captainSlotsUsed: null,
        captainSlotsRemaining: null,
        d1CaptainSelectionStatus: null,
        d2CaptainSelectionStatus: null,
        captainDecisions: [],
        result: "skipped_existing",
        overwriteExisting: true,
        warnings: [],
        blockingReasons: ["existing_lineup_requires_overwrite_confirm"],
        saved: false,
      });
      continue;
    }

    if (!team.aiEligible && team.controlMode === "ai" && !canAutoFillIncompleteLineup) {
      results.push({
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        controlMode: team.controlMode,
        aiEligible: false,
        previewStatus: "blocked",
        captainSlotsUsed: null,
        captainSlotsRemaining: null,
        d1CaptainSelectionStatus: null,
        d2CaptainSelectionStatus: null,
        captainDecisions: [],
        result: "skipped_disabled",
        overwriteExisting: false,
        warnings: [],
        blockingReasons: ["ai_lineup_apply_disabled"],
        saved: false,
      });
      continue;
    }

    const previewStartedAt = performance.now();
    const preview = buildAiLegacyLineupPreview(contextResult.context, "sqlite");
    performanceBreakdown.aiLineupGenerationMs += elapsedSince(previewStartedAt);
    const modifierStartedAt = performance.now();
    const modifiers = buildAiLegacyLineupModifiers(contextResult.context, preview.entries);
    performanceBreakdown.mutatorPlanningMs += elapsedSince(modifierStartedAt);
    const validationStartedAt = performance.now();
    const validationPreview = calculateLocalLegacyLineupPreviewFromContext(
      contextResult.context,
      preview.entries,
      modifiers,
      contextResult.context.fatigueByPlayerId ?? null,
    );
    performanceBreakdown.lineupValidationMs += elapsedSince(validationStartedAt);
    const existingDraft = contextResult.context.existingDraft;
    const hasExistingDraft = Boolean(existingDraft?.entries?.length);
    const statusKind = classifyPreviewStatus(preview.status);
    const baseWarnings = normalizeAiLineupWarnings([
      ...(preview.warnings ?? []),
      ...(validationPreview.ok ? validationPreview.validation.warnings : validationPreview.warnings),
      ...(!formCardEnsure.ok ? formCardEnsure.warnings : formCardEnsure.warnings),
    ]);
    const formCardsSelected = countSelectedFormCards(modifiers);
    const negativeFormCardsSelected = countSelectedNegativeFormCards(modifiers, contextResult.context.formCards ?? []);

    if (!validationPreview.ok || !validationPreview.validation.isValid) {
      const captainMeta = buildCaptainPreviewMeta(preview);
      results.push({
        teamId: preview.teamId,
        teamCode: preview.teamCode,
        teamName: preview.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: "validation_failed",
        ...captainMeta,
        result: "failed_validation",
        overwriteExisting: hasExistingDraft,
        warnings: baseWarnings,
        blockingReasons: validationPreview.ok ? validationPreview.validation.errors : validationPreview.errors,
        saved: false,
        formCardsSelected,
        negativeFormCardsSelected,
      });
      continue;
    }

    if (statusKind === "blocked") {
      const captainMeta = buildCaptainPreviewMeta(preview);
      results.push({
        teamId: preview.teamId,
        teamCode: preview.teamCode,
        teamName: preview.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: preview.status,
        ...captainMeta,
        result: "skipped_blocked",
        overwriteExisting: hasExistingDraft,
        warnings: baseWarnings,
        blockingReasons: preview.warnings,
        saved: false,
        formCardsSelected,
        negativeFormCardsSelected,
      });
      continue;
    }

    if (statusKind === "warning" && !includeWarningTeams) {
      // Teilbesetzter Kader ist kein Grund, GAR NICHT anzutreten: Früher wurden diese Teams
      // als `skipped_warning` übersprungen und gingen mit NULL Aufstellung (0 Punkte) in den
      // Spieltag. Eine Teilaufstellung mit allen verfügbaren Spielern ist strikt besser —
      // genau das prüft `isTeamMatchdayLineupOperationallyReady` (alle einsatzbereiten
      // Spieler aufgestellt, offene Slots erlaubt). Andere Warnungsarten (missing_scores etc.)
      // werden weiterhin übersprungen, dort deutet die Warnung auf ein echtes Datenproblem.
      const partialLineupSaveable =
        preview.status === "incomplete_roster" &&
        preview.entries.length > 0 &&
        isTeamMatchdayLineupOperationallyReady(preparedGameState, team.teamId, {
          lineupId: `${params.saveId}:${params.seasonId}:${params.matchdayId}:${params.teamId}`,
          saveId: params.saveId,
          seasonId: params.seasonId,
          matchdayId: params.matchdayId,
          teamId: params.teamId,
          status: "draft",
          entries: preview.entries as LineupDraft["entries"],
          modifiers,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      if (!partialLineupSaveable) {
        const captainMeta = buildCaptainPreviewMeta(preview);
        results.push({
          teamId: preview.teamId,
          teamCode: preview.teamCode,
          teamName: preview.teamName,
          controlMode: team.controlMode,
          aiEligible: team.aiEligible,
          previewStatus: preview.status,
          ...captainMeta,
          result: "skipped_warning",
          overwriteExisting: hasExistingDraft,
          warnings: baseWarnings,
          blockingReasons: [],
          saved: false,
          formCardsSelected,
          negativeFormCardsSelected,
        });
        continue;
      }
      // Nachvollziehbarkeit im Batch-Protokoll: das Team tritt bewusst teilbesetzt an.
      baseWarnings.push("partial_lineup_saved_max_available_players");
    }

    if (hasCompleteExistingDraft && !overwriteExisting) {
      const captainMeta = buildCaptainPreviewMeta(preview);
      results.push({
        teamId: preview.teamId,
        teamCode: preview.teamCode,
        teamName: preview.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: preview.status,
        ...captainMeta,
        result: "skipped_existing",
        overwriteExisting: true,
        warnings: baseWarnings,
        blockingReasons: ["existing_lineup_requires_overwrite_confirm"],
        saved: false,
        formCardsSelected,
        negativeFormCardsSelected,
      });
      continue;
    }

    if (dryRun) {
      const captainMeta = buildCaptainPreviewMeta(preview);
      results.push({
        teamId: preview.teamId,
        teamCode: preview.teamCode,
        teamName: preview.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: preview.status,
        ...captainMeta,
        result: "saved",
        overwriteExisting: hasExistingDraft,
        warnings: baseWarnings,
        blockingReasons: [],
        saved: false,
        formCardsSelected,
        negativeFormCardsSelected,
      });
      continue;
    }

    const captainMeta = buildCaptainPreviewMeta(preview);
    const resultIndex = results.length;
    results.push({
      teamId: preview.teamId,
      teamCode: preview.teamCode,
      teamName: preview.teamName,
      controlMode: team.controlMode,
      aiEligible: team.aiEligible,
      previewStatus: preview.status,
      ...captainMeta,
      result: "saved",
      overwriteExisting: hasExistingDraft,
      warnings: baseWarnings,
      blockingReasons: [],
      saved: false,
      formCardsSelected,
      negativeFormCardsSelected,
    });
    pendingDrafts.push({
      resultIndex,
      params,
      entries: preview.entries,
      modifiers,
    });
  }

  if (!dryRun && pendingDrafts.length > 0) {
    const saveStartedAt = performance.now();
    const batchSave = saveLocalLegacyLineupDraftBatch(
      pendingDrafts.map((draft) => ({
        params: draft.params,
        entries: draft.entries,
        modifiers: draft.modifiers,
      })),
      persistence,
    );
    performanceBreakdown.saveWriteMs += elapsedSince(saveStartedAt);
    if (batchSave.ok) {
      for (const draft of pendingDrafts) {
        const result = results[draft.resultIndex];
        if (!result) continue;
        result.saved = true;
        result.warnings = Array.from(new Set([...result.warnings, ...batchSave.warnings]));
      }
    } else {
      for (const draft of pendingDrafts) {
        const result = results[draft.resultIndex];
        if (!result) continue;
        result.result = "failed_validation";
        result.saved = false;
        result.warnings = Array.from(new Set([...result.warnings, ...batchSave.warnings]));
        result.blockingReasons = Array.from(new Set([...result.blockingReasons, ...batchSave.errors]));
      }
    }
  }

  const summary: AiBatchApplySummary = {
    totalTeams: results.length,
    aiEligibleTeams: results.filter((entry) => entry.aiEligible).length,
    skippedManual: results.filter((entry) => entry.result === "skipped_manual").length,
    skippedPassive: results.filter((entry) => entry.result === "skipped_passive").length,
    skippedDisabled: results.filter((entry) => entry.result === "skipped_disabled").length,
    readyToSave: results.filter((entry) => entry.aiEligible && entry.previewStatus === "ready").length,
    readyTeams: results.filter((entry) => entry.previewStatus === "ready").length,
    warningTeams: results.filter((entry) => entry.previewStatus === "incomplete_roster" || entry.previewStatus === "missing_scores").length,
    blockedTeams: results.filter((entry) => entry.result === "skipped_blocked" || entry.result === "failed_validation").length,
    wouldSave: results.filter((entry) => dryRun && entry.result === "saved").length,
    savedTeams: results.filter((entry) => !dryRun && entry.saved).length,
    skippedWarning: results.filter((entry) => entry.result === "skipped_warning").length,
    skippedBlocked: results.filter((entry) => entry.result === "skipped_blocked" || entry.result === "failed_validation").length,
    skippedExisting: results.filter((entry) => entry.result === "skipped_existing").length,
    existingLineups: results.filter((entry) => entry.overwriteExisting).length,
    wouldOverwrite: results.filter((entry) => entry.overwriteExisting && entry.result === "saved").length,
    overwrittenExisting: results.filter((entry) => entry.overwriteExisting && (dryRun ? entry.result === "saved" : entry.saved)).length,
    plannedLineups: results.filter((entry) => dryRun ? entry.result === "saved" : entry.saved).length,
    formCardsSelected: results.reduce((sum, entry) => sum + (entry.formCardsSelected ?? 0), 0),
    negativeFormCardsSelected: results.reduce((sum, entry) => sum + (entry.negativeFormCardsSelected ?? 0), 0),
    performanceBreakdown: {
      ...performanceBreakdown,
      totalMs: elapsedSince(totalStartedAt),
    },
    warnings: Array.from(new Set(results.flatMap((entry) => entry.warnings))),
    captainDecisions: Array.from(new Set(results.flatMap((entry) => entry.captainDecisions ?? []))),
    blockingReasons: Array.from(new Set(results.flatMap((entry) => entry.blockingReasons))),
  };

  return {
    source: "sqlite",
    readOnly: false,
    dryRun,
    includeWarningTeams,
    totalTeams: results.length,
    results,
    summary,
  };
}
