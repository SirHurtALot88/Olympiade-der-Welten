// Rechenkern der Kandidaten-/Kader-Ableitungen aus der Einsatzliste (vormals reine
// `useMemo`-Koerper in LegacyLineupLabClient.tsx). Reines Verschieben — keine
// Verhaltensaenderung. Die Komponente behaelt duenne `useMemo`-Huellen, die diese
// Funktionen mit denselben Eingaben aufrufen wie vorher.
//
// Warum das lohnt: `teamdeckCandidateEntries` entscheidet, welcher Spieler beim
// Draenden von "1" im Teamdeck landet — eine still veraenderte Sortier-Regel wirft
// keine Exception, sie setzt nur einen anderen Spieler. Als reine Funktion in `lib/`
// ist genau das jetzt mit einer festen Fixture ueber `vitest` (node-Umgebung, kein
// jsdom) direkt pruefbar. Siehe tests/lineup-candidate-model.test.ts.

import type { PlayerAttributeSheetStats } from "@/lib/data/olyDataTypes";
import { getFatiguePerformancePenaltyPercent, getInjuryRiskPercent } from "@/lib/fatigue/fatigue-calibration";
import {
  formatLegacyLineupDragBlockReason,
  getLegacyLineupDragFitTier,
  resolveLegacyLineupDragBlockReason,
} from "@/lib/lineups/legacy-lineup-drag-drop";
import type { LegacyLineupLabPlayerOption, LegacyLineupLabSlot } from "@/lib/lineups/legacy-lineup-lab";
import { calculatePerPlayerFormModifier } from "@/lib/lineups/legacy-lineup-modifiers";
import type { LegacyLineupLoadedContext, LegacyLineupPreviewResult } from "@/lib/lineups/legacy-lineup-types";
import {
  calculateMatchdayProjectedPreview,
  type MatchdayIntensityStage,
  type MatchdaySlotRoleDefinition,
} from "@/lib/lineups/matchday-slot-roles";
import { getTransfermarktTierFromPoints } from "@/lib/market/transfermarkt-sheet-stats";

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export type MatchdayFocusAttribute = {
  key: keyof PlayerAttributeSheetStats;
  label: string;
  shortLabel: string;
  weightPct: number;
  value: number | null;
  ratingLabel: string | null;
};

export type LineupPlayerTableRow = {
  id: string;
  activePlayerId: string | null;
  portraitUrl: string | null;
  name: string;
  teamName: string;
  contractLength: number | null;
  className: string | null;
  potential: number | null;
  discipline1Score: number | null;
  discipline2Score: number | null;
  appearances: number | null;
  marketValue: number | null;
  playerOvr: number | null;
  playerPps: number | null;
  coreStats: {
    pow: number;
    spe: number;
    men: number;
    soc: number;
  } | null;
  traitsPositive: string[];
  traitsNegative: string[];
  injuryStatus: "healthy" | "injured" | "recovering" | null;
  injuryRiskLabel: string | null;
  availabilityBlocker: string | null;
  demands: Array<{
    demandId: string;
    label: string;
    detail: string;
    targetDisciplineId?: string | null;
    status: "open" | "fulfilled" | "at_risk" | "failed";
    priority: "low" | "medium" | "high";
    moraleReward: number;
    moralePenalty: number;
  }>;
  attributeStats: PlayerAttributeSheetStats | null;
  attributeRatings: Partial<Record<keyof PlayerAttributeSheetStats, string | null>> | null;
};

export type MatchdayRosterCard = LineupPlayerTableRow & {
  discipline1Label: string;
  discipline2Label: string;
  selectedSides: Array<"d1" | "d2">;
  topAttributesD1: MatchdayFocusAttribute[];
  topAttributesD2: MatchdayFocusAttribute[];
  fitLane: "d1" | "flex" | "d2";
  fitDelta: number;
  fatigueCount: number | null;
  captainEligible: boolean;
};

export type MatchdaySlotPreviewCard = {
  slotKey: string;
  disciplineSide: "d1" | "d2";
  role: MatchdaySlotRoleDefinition | null;
  intensity: MatchdayIntensityStage;
  projected: ReturnType<typeof calculateMatchdayProjectedPreview>;
  selectedScore: number | null;
  selectedPlayerName: string | null;
  /**
   * Rohe Eingabe der Slot-Projektion OHNE Intensitaet. Damit laesst sich dieselbe
   * Funktion (`calculateMatchdayProjectedPreview`) mit einer hypothetischen
   * Intensitaet erneut aufrufen, statt deren Formel irgendwo nachzubauen.
   */
  projectionInput: Omit<Parameters<typeof calculateMatchdayProjectedPreview>[0], "intensity">;
};

export type TeamdeckFilterMode = "all" | "free" | "assigned" | "blocked";
export type TeamdeckSortMode = "fit" | "top" | "d1" | "d2" | "captain" | "fatigue" | "wish";
export type TeamdeckCandidateQualityKey = "instant" | "alternative" | "fatigue" | "blocked" | "emergency";

export type SlotCandidateSummaryEntry = {
  activePlayerId: string;
  name: string;
  projectedScore: number | null;
  scoreDelta: number | null;
  fitSummary: string;
  fitDetail: string;
  reasonChips: CandidateAxisReasonChip[];
  roleModifier: number;
  rangeLow: number | null;
  rangeHigh: number | null;
  warnings: string[];
};

export type PlayerBestSlotEntry = {
  slotKey: string;
  disciplineSide: "d1" | "d2";
  slotIndex: number;
  projectedScore: number | null;
  projectedDelta: number | null;
  fitSummary: string;
};

export type ActiveSlotCandidate = {
  baseScore: number | null;
  projectedScore: number | null;
  scoreDelta: number | null;
  blockReason: ReturnType<typeof resolveLegacyLineupDragBlockReason>;
  fitSummary: string;
  fitDetail: string;
  roleModifier: number;
  rangeLow: number | null;
  rangeHigh: number | null;
  warnings: string[];
  fatigueModifier: number;
  additionalFatigue: number;
};

export type TeamdeckCandidateEntry = {
  player: MatchdayRosterCard;
  activeSlotCandidate: ActiveSlotCandidate | null;
  relevantDisciplineDemands: MatchdayRosterCard["demands"];
  preferredSlotTags: string[];
  captainDemand: MatchdayRosterCard["demands"][number] | null;
  wantsActiveSlot: boolean;
  isWishMatch: boolean;
  fitTier: ReturnType<typeof getLegacyLineupDragFitTier>;
  groupKey: TeamdeckCandidateQualityKey;
  detail: string;
  shortReason: string;
  groupMeta: ReturnType<typeof getTeamdeckCandidateGroupMeta>;
};

export type TeamdeckCandidateGroup = {
  key: TeamdeckCandidateQualityKey;
  meta: ReturnType<typeof getTeamdeckCandidateGroupMeta>;
  entries: TeamdeckCandidateEntry[];
  totalCount: number;
};

// ---------------------------------------------------------------------------
// Formatierung / kleine reine Helfer (vormals modulweite Funktionen in
// LegacyLineupLabClient.tsx — unveraendert hierher verschoben, weil die
// Kandidaten-Texte (`fitSummary`, `detail`, `shortReason`, …) direkt von ihnen
// abhaengen).
// ---------------------------------------------------------------------------

export const attributeShortLabels: Record<keyof PlayerAttributeSheetStats, string> = {
  power: "POW",
  health: "HEA",
  stamina: "STA",
  intelligence: "INT",
  awareness: "AWA",
  determination: "DET",
  speed: "SPD",
  dexterity: "DEX",
  charisma: "CHA",
  will: "WIL",
  spirit: "SPI",
  torment: "TOR",
  height: "HGT",
};

const FATIGUE_UI_MEDIUM = 40;

export function isElevatedFatigue(fatigue: number | null | undefined) {
  return (fatigue ?? 0) >= FATIGUE_UI_MEDIUM;
}

export function formatScore(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDecimalScore(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatNullableScore(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }
  return formatScore(value);
}

export function formatFatigueImpactDetail(fatigue: number | null | undefined) {
  const value = Math.round(fatigue ?? 0);
  if (value <= 0) {
    return "Fatigue 0";
  }
  const penalty = getFatiguePerformancePenaltyPercent(fatigue);
  const injury = getInjuryRiskPercent(fatigue);
  return `Fatigue ${value} · −${formatDecimalScore(penalty, 1)}% Leistung · ${formatDecimalScore(injury, 1)}% Verletzungsrisiko`;
}

export function normalizeClassHintToken(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function resolveAttributeGrade(
  ratings: Partial<Record<keyof PlayerAttributeSheetStats, string | null>> | null | undefined,
  key: keyof PlayerAttributeSheetStats,
  value: number | null | undefined,
) {
  const explicit = ratings?.[key];
  if (explicit) {
    return explicit;
  }
  return getTransfermarktTierFromPoints(value ?? null);
}

export function buildSlotFitExplanation(
  role: MatchdaySlotRoleDefinition | null,
  rosterCard: Pick<LineupPlayerTableRow, "className" | "attributeStats" | "attributeRatings"> | null,
  projected: ReturnType<typeof calculateMatchdayProjectedPreview> | null,
  scoreDelta?: number | null,
) {
  const keyAttributes = (role?.keyAttributes ?? [])
    .slice(0, 3)
    .map((attribute) => {
      const value = rosterCard?.attributeStats?.[attribute.attribute] ?? null;
      const rating = rosterCard?.attributeRatings?.[attribute.attribute] ?? null;
      return {
        shortLabel: attributeShortLabels[attribute.attribute],
        value,
        rating,
        weightPct: attribute.weightPct,
        emphasis: attribute.emphasis,
      };
    });
  const positiveAttributes = keyAttributes.filter((attribute) => attribute.emphasis !== "support");
  const strainAttribute = keyAttributes.find((attribute) => attribute.emphasis === "support") ?? null;
  const normalizedClass = normalizeClassHintToken(rosterCard?.className ?? null);
  const roleClassFit =
    role?.classHints?.length && normalizedClass
      ? role.classHints.some((hint) => normalizeClassHintToken(hint) === normalizedClass)
      : false;
  const attributeLine = positiveAttributes.length
    ? positiveAttributes
        .map((attribute) => `${attribute.shortLabel} ${attribute.rating ?? (attribute.value != null ? Math.round(attribute.value) : "—")}`)
        .join(" · ")
    : "Basiswert entscheidet";
  const roleDelta = projected?.roleModifier ?? 0;
  const roleDeltaText = roleDelta
    ? `Rolle ${roleDelta > 0 ? "+" : ""}${formatDecimalScore(roleDelta, 1)}`
    : "Rolle neutral";
  const deltaText =
    scoreDelta != null
      ? `Δ ${scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(scoreDelta, 1)}`
      : projected?.totalProjected != null
        ? `Slot ${formatDecimalScore(projected.totalProjected, 1)}`
        : "Slot offen";
  const summary = role
    ? `${role.label}: ${attributeLine} · ${roleDeltaText}`
    : `${attributeLine} · ${roleDeltaText}`;
  const detailParts = [
    roleClassFit ? "Klassenfit" : role?.classHints?.length ? `Off-Role gegen ${role.classHints.join(" / ")}` : null,
    strainAttribute ? `Belastung ${strainAttribute.shortLabel} ${strainAttribute.rating ?? (strainAttribute.value != null ? Math.round(strainAttribute.value) : "—")}` : null,
    projected?.fatigueModifier ? `Fatigue -${formatDecimalScore(projected.fatigueModifier, 1)}` : null,
    deltaText,
  ].filter(Boolean);

  return {
    summary,
    detail: detailParts.join(" · ") || "Keine besonderen Slot-Abweichungen.",
    roleClassFit,
  };
}

type CandidateAxisKey = "pow" | "spe" | "men" | "soc";

export type CandidateAxisReasonChip = {
  axis: CandidateAxisKey;
  label: string;
  rating: string | null;
  tone: string;
  weightPct: number;
  detail: string;
};

const attributeAxisKeys: Partial<Record<keyof PlayerAttributeSheetStats, CandidateAxisKey>> = {
  power: "pow",
  health: "pow",
  stamina: "pow",
  determination: "pow",
  speed: "spe",
  dexterity: "spe",
  awareness: "spe",
  intelligence: "men",
  will: "men",
  spirit: "men",
  charisma: "soc",
  torment: "soc",
};

const axisReasonLabels: Record<CandidateAxisKey, string> = {
  pow: "POW",
  spe: "SPE",
  men: "MEN",
  soc: "SOC",
};

const axisReasonToneClasses: Record<CandidateAxisKey, string> = {
  pow: "is-pow",
  spe: "is-spe",
  men: "is-men",
  soc: "is-soc",
};

export function buildCandidateAxisReasonChips(
  role: MatchdaySlotRoleDefinition | null,
  rosterCard: Pick<LineupPlayerTableRow, "attributeStats" | "attributeRatings"> | null,
): CandidateAxisReasonChip[] {
  if (!role || !rosterCard) {
    return [];
  }

  const roleAttributes = role.keyAttributes?.length
    ? role.keyAttributes.slice(0, 4)
    : [
        { attribute: role.majorPositiveAttribute, weightPct: 100, deltaPct: 0, emphasis: "primary" as const },
        { attribute: role.minorPositiveAttribute, weightPct: 70, deltaPct: 0, emphasis: "secondary" as const },
        { attribute: role.strainAttribute, weightPct: 40, deltaPct: 0, emphasis: "support" as const },
      ];
  const axisMap = new Map<CandidateAxisKey, CandidateAxisReasonChip>();

  for (const attribute of roleAttributes) {
    if (attribute.emphasis === "support") {
      continue;
    }
    const axis = attributeAxisKeys[attribute.attribute];
    if (!axis) {
      continue;
    }
    const rating = rosterCard.attributeRatings?.[attribute.attribute] ?? null;
    const value = rosterCard.attributeStats?.[attribute.attribute] ?? null;
    // S6/L3 (Audit Spieltag): die Attribut-Note (z. B. "B") stand bisher ohne jede
    // Erklärung der Skala im Tooltip — man kann "B" nicht einordnen, ohne die Skala
    // zu kennen. Die Buchstaben kommen 1:1 aus den importierten Spieler-Attributen
    // (`attributeRatings`, s. `lib/data/playerAttributeSheet.ts`); die echten Werte
    // im Datensatz reichen von S+ (beste Note) bis F (schwächste) — keine erfundene
    // Skala, nur die vorhandenen Stufen einmal ausgeschrieben.
    const ratingScaleHint = rating ? " (Notenskala S+ bis F, S+ am stärksten)" : "";
    const detail = `${axisReasonLabels[axis]} ${rating ?? (value != null ? Math.round(value) : "—")}${ratingScaleHint} · Slot ${formatDecimalScore(attribute.weightPct, 0)}%`;
    const existing = axisMap.get(axis);
    if (!existing || attribute.weightPct > existing.weightPct) {
      axisMap.set(axis, {
        axis,
        label: axisReasonLabels[axis],
        rating,
        tone: axisReasonToneClasses[axis],
        weightPct: attribute.weightPct,
        detail,
      });
    }
  }

  return (["pow", "spe", "men", "soc"] as const)
    .map((axis) => axisMap.get(axis))
    .filter((chip): chip is CandidateAxisReasonChip => chip != null)
    .slice(0, 3);
}

export function getTeamdeckCandidateGroupMeta(groupKey: TeamdeckCandidateQualityKey) {
  switch (groupKey) {
    case "instant":
      return {
        label: "Passt sofort",
        description: "Saubere Sofort-Picks für den aktiven Slot.",
        tone: "ready" as const,
        order: 0,
      };
    case "alternative":
      return {
        label: "Gute Alternative",
        description: "Spielbar, aber nicht ganz der klarste Direktzug.",
        tone: "info" as const,
        order: 1,
      };
    case "fatigue":
      return {
        label: "Riskant wegen Fatigue",
        description: "Nur mit Bedacht einsetzen oder über Team-Einsatz abfedern.",
        tone: "warning" as const,
        order: 2,
      };
    case "blocked":
      return {
        label: "Blockiert / schon eingesetzt",
        description: "Sichtbar zum Verstehen, aber nicht für den direkten Flow.",
        tone: "blocked" as const,
        order: 3,
      };
    case "emergency":
    default:
      return {
        label: "Nur Notfall",
        description: "Geht im Zweifel, fuehlt sich aber klar nach Fallback an.",
        tone: "muted" as const,
        order: 4,
      };
  }
}

// ---------------------------------------------------------------------------
// Kleine, playerOptions-basierte Nachschlage-Helfer (vormals Komponenten-lokale
// Funktionen, die ueber `playerOptions`/`selections` per Closure geschlossen
// haben — hier rein als Parameter statt Closure).
// ---------------------------------------------------------------------------

export function getSelectedOptionMeta(playerOptions: LegacyLineupLabPlayerOption[], activePlayerId: string | null | undefined) {
  if (!activePlayerId) {
    return null;
  }
  return playerOptions.find((option) => option.activePlayerId === activePlayerId) ?? null;
}

function getSelectedOptionScore(option: LegacyLineupLabPlayerOption | null, disciplineId: string | null | undefined) {
  if (!option || !disciplineId) {
    return null;
  }
  return option.disciplineScores[disciplineId] ?? null;
}

function getAvailableOptionsForSlot(
  playerOptions: LegacyLineupLabPlayerOption[],
  selections: Record<string, string>,
  slotKey: string,
) {
  const selectedByOtherSlots = new Set(
    Object.entries(selections)
      .filter(([key, value]) => key !== slotKey && value)
      .map(([, value]) => value),
  );

  return playerOptions.filter((option) => {
    const selectedHere = selections[slotKey];
    return option.activePlayerId === selectedHere || !selectedByOtherSlots.has(option.activePlayerId);
  });
}

function sortOptionsByDisciplineSkill(options: LegacyLineupLabPlayerOption[], disciplineId: string | null | undefined) {
  return [...options].sort((left, right) => {
    const leftScore = disciplineId ? left.disciplineScores[disciplineId] ?? Number.NEGATIVE_INFINITY : Number.NEGATIVE_INFINITY;
    const rightScore = disciplineId ? right.disciplineScores[disciplineId] ?? Number.NEGATIVE_INFINITY : Number.NEGATIVE_INFINITY;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    return left.name.localeCompare(right.name, "de");
  });
}

function projectCandidateForSlot(
  slot: LegacyLineupLabSlot,
  option: LegacyLineupLabPlayerOption,
  ctx: {
    rosterCardByActivePlayerId: Map<string, MatchdayRosterCard>;
    slotRoleByKey: Map<string, MatchdaySlotRoleDefinition | null>;
    context: LegacyLineupLoadedContext | null;
    intensityBySide: Record<"d1" | "d2", MatchdayIntensityStage>;
    rivalryPressureByDiscipline: Record<string, number>;
  },
) {
  const rosterCard = ctx.rosterCardByActivePlayerId.get(option.activePlayerId) ?? null;
  return calculateMatchdayProjectedPreview({
    baseScore: option.disciplineScores[slot.disciplineId] ?? null,
    role: ctx.slotRoleByKey.get(slot.key) ?? null,
    attributeStats: rosterCard?.attributeStats ?? null,
    currentFatigueCount: option.fatigueCount ?? null,
    requiredPlayers: ctx.context?.disciplinePlayerCounts[slot.disciplineId] ?? null,
    intensity: ctx.intensityBySide[slot.disciplineSide],
    knownModifierBonus: 0,
    revealVariance: 0,
    rivalryPressure: ctx.rivalryPressureByDiscipline[slot.disciplineId] ?? 0,
  });
}

// ---------------------------------------------------------------------------
// Der eigentliche Rechenkern — vormals `useMemo`-Koerper in LegacyLineupLabClient.
// ---------------------------------------------------------------------------

/** Vormals `matchdayRosterCards` (useMemo). */
export function buildMatchdayRosterCards(input: {
  playerRows: LineupPlayerTableRow[];
  selections: Record<string, string>;
  slots: LegacyLineupLabSlot[];
  discipline1Label: string;
  discipline2Label: string;
  disciplineWeightInfo: {
    d1: Array<Pick<MatchdayFocusAttribute, "key" | "label" | "shortLabel" | "weightPct">>;
    d2: Array<Pick<MatchdayFocusAttribute, "key" | "label" | "shortLabel" | "weightPct">>;
  };
}): MatchdayRosterCard[] {
  const { playerRows, selections, slots, discipline1Label, discipline2Label, disciplineWeightInfo } = input;
  const d1Focus = disciplineWeightInfo.d1;
  const d2Focus = disciplineWeightInfo.d2;

  return playerRows
    .map((row) => {
      const selectedSides: Array<"d1" | "d2"> = [];
      if (Object.values(selections).includes(row.activePlayerId ?? "")) {
        if (
          row.activePlayerId &&
          slots.some((slot) => slot.disciplineSide === "d1" && selections[slot.key] === row.activePlayerId)
        ) {
          selectedSides.push("d1");
        }
        if (
          row.activePlayerId &&
          slots.some((slot) => slot.disciplineSide === "d2" && selections[slot.key] === row.activePlayerId)
        ) {
          selectedSides.push("d2");
        }
      }

      const fitLane: MatchdayRosterCard["fitLane"] =
        (row.discipline1Score ?? Number.NEGATIVE_INFINITY) - (row.discipline2Score ?? Number.NEGATIVE_INFINITY) >= 8
          ? "d1"
          : (row.discipline2Score ?? Number.NEGATIVE_INFINITY) - (row.discipline1Score ?? Number.NEGATIVE_INFINITY) >= 8
            ? "d2"
            : "flex";

      return {
        ...row,
        discipline1Label,
        discipline2Label,
        selectedSides,
        topAttributesD1: d1Focus.map((attribute) => ({
          ...attribute,
          value: row.attributeStats?.[attribute.key] ?? null,
          ratingLabel: resolveAttributeGrade(row.attributeRatings, attribute.key, row.attributeStats?.[attribute.key] ?? null),
        })),
        topAttributesD2: d2Focus.map((attribute) => ({
          ...attribute,
          value: row.attributeStats?.[attribute.key] ?? null,
          ratingLabel: resolveAttributeGrade(row.attributeRatings, attribute.key, row.attributeStats?.[attribute.key] ?? null),
        })),
        fitLane,
        fitDelta: (row.discipline1Score ?? 0) - (row.discipline2Score ?? 0),
        fatigueCount: row.appearances ?? null,
        captainEligible: Boolean(row.activePlayerId),
      };
    })
    .sort((left, right) => {
      if (left.selectedSides.length !== right.selectedSides.length) {
        return right.selectedSides.length - left.selectedSides.length;
      }

      const leftD1 = left.discipline1Score ?? Number.NEGATIVE_INFINITY;
      const rightD1 = right.discipline1Score ?? Number.NEGATIVE_INFINITY;
      const leftD2 = left.discipline2Score ?? Number.NEGATIVE_INFINITY;
      const rightD2 = right.discipline2Score ?? Number.NEGATIVE_INFINITY;
      const leftBias = leftD1 - leftD2;
      const rightBias = rightD1 - rightD2;

      const getBiasBucket = (bias: number) => {
        if (bias >= 8) {
          return 0;
        }
        if (bias <= -8) {
          return 2;
        }
        return 1;
      };

      const leftBucket = getBiasBucket(leftBias);
      const rightBucket = getBiasBucket(rightBias);
      if (leftBucket !== rightBucket) {
        return leftBucket - rightBucket;
      }

      const leftTopScore = Math.max(leftD1, leftD2);
      const rightTopScore = Math.max(rightD1, rightD2);
      if (leftTopScore !== rightTopScore) {
        return rightTopScore - leftTopScore;
      }

      if (Math.abs(leftBias) !== Math.abs(rightBias)) {
        return Math.abs(rightBias) - Math.abs(leftBias);
      }

      return left.name.localeCompare(right.name, "de");
    });
}

/** Vormals `slotPreviewByKey` (useMemo). */
export function buildSlotPreviewByKey(input: {
  slots: LegacyLineupLabSlot[];
  selections: Record<string, string>;
  playerOptions: LegacyLineupLabPlayerOption[];
  rosterCardByActivePlayerId: Map<string, MatchdayRosterCard>;
  resolvedPreview: Extract<LegacyLineupPreviewResult, { ok: true }> | null;
  slotRoleByKey: Map<string, MatchdaySlotRoleDefinition | null>;
  intensityBySide: Record<"d1" | "d2", MatchdayIntensityStage>;
  context: LegacyLineupLoadedContext | null;
  captains: Record<"d1" | "d2", string>;
  rivalryPressureByDiscipline: Record<string, number>;
}): Map<string, MatchdaySlotPreviewCard> {
  const { slots, selections, playerOptions, rosterCardByActivePlayerId, resolvedPreview, slotRoleByKey, intensityBySide, context, captains, rivalryPressureByDiscipline } = input;

  const previews = slots.map<MatchdaySlotPreviewCard>((slot) => {
    const selectedOption = getSelectedOptionMeta(playerOptions, selections[slot.key]);
    const selectedScore = getSelectedOptionScore(selectedOption, slot.disciplineId);
    const selectedRosterCard = rosterCardByActivePlayerId.get(selections[slot.key] ?? "");
    const sidePreview = resolvedPreview?.disciplineSideScores.find((entry) => entry.disciplineSide === slot.disciplineSide) ?? null;
    const role: MatchdaySlotRoleDefinition | null = slotRoleByKey.get(slot.key) ?? null;
    const intensity = intensityBySide[slot.disciplineSide];
    // JEDER Slot bekommt NUR seinen eigenen Anteil an den Modifikatoren.
    //
    // Vorher standen hier `sidePreview.mutatorModifier` und `.teamPowerModifier`
    // roh drin — das sind aber SEITEN-Summen, keine Pro-Spieler-Werte
    // (`legacy-lineup-modifiers.ts`: mutatorModifier = Treffer × 6 über die ganze
    // Seite; `legacy-score-engine.ts`: teamPowerModifier = Prozentsatz auf den
    // Seiten-Score). Bei N belegten Slots wurden beide N-fach gezählt. Weil die
    // Vorschau asynchron nachlädt, sprang die Anzeige genau in dem Moment nach
    // oben: gemeldet als „erst 72,8 Punkte, dann lädt es neu und er hat 96,8".
    //
    // Die Engine liefert die Pro-Spieler-Zahlen längst mit (`formShare`,
    // `mutatorBonus`, `captainBonus` je Eintrag) — hier wird jetzt der eigene
    // Eintrag nachgeschlagen statt der Seiten-Summe.
    const selectedActivePlayerId = selections[slot.key] ?? "";
    const sideEntry =
      sidePreview?.entries?.find(
        (entry) => entry.activePlayerId === selectedActivePlayerId && entry.slotIndex === slot.slotIndex,
      ) ?? null;
    // Team-Power ist als einziger Posten wirklich team-weit (Prozent auf den
    // Seiten-Score) und hat in der Engine keinen Pro-Spieler-Kanal. Gleichmäßig
    // auf die belegten Slots verteilt bleibt wenigstens die Summe über die Seite
    // richtig — voll pro Slot wäre sie es garantiert nicht.
    const teamPowerSlotDivisor =
      (sidePreview?.selectedPlayers ?? 0) > 0
        ? (sidePreview?.selectedPlayers as number)
        : (sidePreview?.requiredPlayers ?? 0) > 0
          ? (sidePreview?.requiredPlayers as number)
          : 1;
    const knownModifierBonus =
      (sideEntry?.formShare ??
        calculatePerPlayerFormModifier({
          formModifier: sidePreview?.formModifier,
          selectedPlayers: sidePreview?.selectedPlayers,
          requiredPlayers: sidePreview?.requiredPlayers,
        })) +
      (sideEntry?.mutatorBonus ?? 0) +
      (sideEntry?.captainBonus ??
        (captains[slot.disciplineSide] === selectedActivePlayerId ? sidePreview?.captainBonusTotal ?? 0 : 0)) +
      (sidePreview?.teamPowerModifier ?? 0) / teamPowerSlotDivisor;
    const revealVariance =
      (context?.formCardSource?.effectStatus === "ready" ? 0 : 2) +
      (context?.mutatorSource?.effectStatus === "ready" ? 0 : 2) +
      (context?.teamPowerSource?.effectStatus === "ready" ? 0 : 2);

    const projectionInput = {
      baseScore: selectedScore,
      role,
      attributeStats: selectedRosterCard?.attributeStats ?? null,
      currentFatigueCount: selectedOption?.fatigueCount ?? null,
      requiredPlayers: context?.disciplinePlayerCounts[slot.disciplineId] ?? null,
      knownModifierBonus,
      revealVariance,
      rivalryPressure: slot.disciplineId ? rivalryPressureByDiscipline[slot.disciplineId] ?? 0 : 0,
    };

    return {
      slotKey: slot.key,
      disciplineSide: slot.disciplineSide,
      role,
      intensity,
      selectedScore,
      selectedPlayerName: selectedRosterCard?.name ?? null,
      projectionInput,
      projected: calculateMatchdayProjectedPreview({ ...projectionInput, intensity }),
    };
  });

  return new Map(previews.map((entry) => [entry.slotKey, entry]));
}

/** Vormals `slotCandidateSummaryByKey` (useMemo). */
export function buildSlotCandidateSummaryByKey(input: {
  slots: LegacyLineupLabSlot[];
  selections: Record<string, string>;
  playerOptions: LegacyLineupLabPlayerOption[];
  slotPreviewByKey: Map<string, MatchdaySlotPreviewCard>;
  slotRoleByKey: Map<string, MatchdaySlotRoleDefinition | null>;
  rosterCardByActivePlayerId: Map<string, MatchdayRosterCard>;
  captainSideByActivePlayerId: Map<string, "d1" | "d2">;
  context: LegacyLineupLoadedContext | null;
  intensityBySide: Record<"d1" | "d2", MatchdayIntensityStage>;
  rivalryPressureByDiscipline: Record<string, number>;
}): Map<string, { topCandidates: SlotCandidateSummaryEntry[]; currentProjected: number | null }> {
  const { slots, selections, playerOptions, slotPreviewByKey, slotRoleByKey, rosterCardByActivePlayerId, captainSideByActivePlayerId, context, intensityBySide, rivalryPressureByDiscipline } = input;

  return new Map(
    slots.map((slot) => {
      const currentProjected = slotPreviewByKey.get(slot.key)?.projected.totalProjected ?? null;
      const role = slotRoleByKey.get(slot.key) ?? null;
      // Bug T-002: getAvailableOptionsForSlot() prüft nur Slot-Kollision, NICHT
      // Verfügbarkeit/Captain-Regel/Slot-Regel. Ohne diesen Filter konnte
      // Best-Fit/Top-Pick einen laut Kandidatenliste blockierten Spieler
      // vorschlagen & zuweisen. Denselben Check wie teamdeckCandidateEntries
      // (resolveLegacyLineupDragBlockReason) anwenden, BEVOR sortiert/geslict wird.
      const topCandidates = sortOptionsByDisciplineSkill(
        getAvailableOptionsForSlot(playerOptions, selections, slot.key).filter((option) => {
          const rosterCard = rosterCardByActivePlayerId.get(option.activePlayerId) ?? null;
          const blockReason = resolveLegacyLineupDragBlockReason({
            availabilityBlocker: rosterCard?.availabilityBlocker ?? null,
            selectedSides: rosterCard?.selectedSides ?? [],
            targetDisciplineSide: slot.disciplineSide,
            captainSide: captainSideByActivePlayerId.get(option.activePlayerId) ?? null,
            hasBaseScore: option.disciplineScores[slot.disciplineId] != null,
          });
          return blockReason == null;
        }),
        slot.disciplineId,
      )
        // GEMELDET: „bester fit wird nich immer korrekt angezeigt".
        //
        // Hier stand `.slice(0, 3)` VOR dem `.map(...)`. Die Auswahl fiel damit nach
        // `sortOptionsByDisciplineSkill` — dem rohen Disziplin-Skill —, waehrend die
        // angezeigte Zahl (und der Tooltip, und der Gewinn beim "Optimieren") der
        // PROJIZIERTE Score ist: Rolle, Attribute, Fatigue, Intensitaet, Rivalitaet.
        //
        // Zwei verschiedene Massstaebe fuer dieselbe Aussage. Ein Spieler mit etwas
        // weniger Grund-Skill, aber besserer Rollen-Passung oder frischer, projiziert
        // regelmaessig hoeher — er stand dann hinter dem "Best Fit" oder war durch den
        // Schnitt schon raus. Der Knopf zeigte also einen Vorschlag, dessen eigene Zahl
        // eine andere Reihenfolge behauptete.
        //
        // Jetzt wird erst projiziert, dann nach der projizierten Zahl sortiert und
        // zuletzt geschnitten. Die Vorsortierung nach Skill bleibt als stabile
        // Ausgangsreihenfolge (Gleichstand faellt auf sie zurueck).
        //
        // Kosten: die Projektion laeuft jetzt fuer alle zulaessigen Optionen statt fuer
        // drei. Das ist dieselbe Groessenordnung, die `playerBestSlotSummaryByActivePlayerId`
        // direkt darunter ohnehin schon rechnet (jeder Spieler × jeder Slot).
        .map((option) => {
          const rosterCard = rosterCardByActivePlayerId.get(option.activePlayerId) ?? null;
          const projected = calculateMatchdayProjectedPreview({
            baseScore: option.disciplineScores[slot.disciplineId] ?? null,
            role,
            attributeStats: rosterCard?.attributeStats ?? null,
            currentFatigueCount: option.fatigueCount ?? null,
            requiredPlayers: context?.disciplinePlayerCounts[slot.disciplineId] ?? null,
            intensity: intensityBySide[slot.disciplineSide],
            knownModifierBonus: 0,
            revealVariance: 0,
            rivalryPressure: slot.disciplineId ? rivalryPressureByDiscipline[slot.disciplineId] ?? 0 : 0,
          });
          const scoreDelta =
            projected.totalProjected != null && currentProjected != null
              ? Number((projected.totalProjected - currentProjected).toFixed(1))
              : null;
          const fitExplanation = buildSlotFitExplanation(role, rosterCard, projected, scoreDelta);
          return {
            activePlayerId: option.activePlayerId,
            name: option.name,
            projectedScore: projected.totalProjected ?? null,
            scoreDelta,
            fitSummary: fitExplanation.summary,
            fitDetail: fitExplanation.detail,
            reasonChips: buildCandidateAxisReasonChips(role, rosterCard),
            roleModifier: projected.roleModifier,
            rangeLow: projected.rangeLow,
            rangeHigh: projected.rangeHigh,
            warnings: projected.warnings,
          };
        })
        // Nach der PROJIZIERTEN Zahl ordnen — das ist die, die am Knopf steht. Ohne
        // Projektion (kein Basis-Score fuer diese Diszi) nach hinten: ein Vorschlag ohne
        // Zahl ist kein Vorschlag.
        .sort((left, right) => (right.projectedScore ?? Number.NEGATIVE_INFINITY) - (left.projectedScore ?? Number.NEGATIVE_INFINITY))
        .slice(0, 3);

      return [slot.key, { topCandidates, currentProjected }] as const;
    }),
  );
}

/** Vormals `playerBestSlotSummaryByActivePlayerId` (useMemo). */
export function buildPlayerBestSlotSummaryByActivePlayerId(input: {
  playerOptions: LegacyLineupLabPlayerOption[];
  slots: LegacyLineupLabSlot[];
  rosterCardByActivePlayerId: Map<string, MatchdayRosterCard>;
  slotRoleByKey: Map<string, MatchdaySlotRoleDefinition | null>;
  context: LegacyLineupLoadedContext | null;
  intensityBySide: Record<"d1" | "d2", MatchdayIntensityStage>;
  rivalryPressureByDiscipline: Record<string, number>;
  slotPreviewByKey: Map<string, MatchdaySlotPreviewCard>;
}): Map<string, PlayerBestSlotEntry[]> {
  const { playerOptions, slots, rosterCardByActivePlayerId, slotRoleByKey, context, intensityBySide, rivalryPressureByDiscipline, slotPreviewByKey } = input;

  return new Map(
    playerOptions.map((option) => {
      const candidateSlots = slots
        .map((slot) => {
          const rosterCard = rosterCardByActivePlayerId.get(option.activePlayerId) ?? null;
          const role = slotRoleByKey.get(slot.key) ?? null;
          const projected = calculateMatchdayProjectedPreview({
            baseScore: option.disciplineScores[slot.disciplineId] ?? null,
            role,
            attributeStats: rosterCard?.attributeStats ?? null,
            currentFatigueCount: option.fatigueCount ?? null,
            requiredPlayers: context?.disciplinePlayerCounts[slot.disciplineId] ?? null,
            intensity: intensityBySide[slot.disciplineSide],
            knownModifierBonus: 0,
            revealVariance: 0,
            rivalryPressure: slot.disciplineId ? rivalryPressureByDiscipline[slot.disciplineId] ?? 0 : 0,
          });
          const currentProjected = slotPreviewByKey.get(slot.key)?.projected.totalProjected ?? null;
          const projectedDelta =
            projected.totalProjected != null && currentProjected != null
              ? Number((projected.totalProjected - currentProjected).toFixed(1))
              : null;
          return {
            slotKey: slot.key,
            disciplineSide: slot.disciplineSide,
            slotIndex: slot.slotIndex,
            projectedScore: projected.totalProjected ?? null,
            projectedDelta,
            fitSummary: buildSlotFitExplanation(role, rosterCard, projected, projectedDelta).summary,
          };
        })
        .filter((entry) => entry.projectedScore != null)
        .sort((left, right) => {
          if ((right.projectedScore ?? Number.NEGATIVE_INFINITY) !== (left.projectedScore ?? Number.NEGATIVE_INFINITY)) {
            return (right.projectedScore ?? Number.NEGATIVE_INFINITY) - (left.projectedScore ?? Number.NEGATIVE_INFINITY);
          }
          return left.slotKey.localeCompare(right.slotKey, "de");
        });
      // Keep the full ranked list here (bounded by slot count, so cheap); callers that only
      // want the top picks (e.g. classic "Wunsch" tags) slice further at the usage site. The
      // v2 focus board's player-focus highlight needs the delta for every slot, not just top 2.

      return [option.activePlayerId, candidateSlots] as const;
    }),
  );
}

/** Vormals `activeSlotCandidateByActivePlayerId` (useMemo). */
export function buildActiveSlotCandidateByActivePlayerId(input: {
  activeSlot: LegacyLineupLabSlot | null;
  captainSideByActivePlayerId: Map<string, "d1" | "d2">;
  context: LegacyLineupLoadedContext | null;
  intensityBySide: Record<"d1" | "d2", MatchdayIntensityStage>;
  playerOptions: LegacyLineupLabPlayerOption[];
  rosterCardByActivePlayerId: Map<string, MatchdayRosterCard>;
  slotPreviewByKey: Map<string, MatchdaySlotPreviewCard>;
  slotRoleByKey: Map<string, MatchdaySlotRoleDefinition | null>;
  rivalryPressureByDiscipline: Record<string, number>;
}): Map<string, ActiveSlotCandidate> {
  const { activeSlot, captainSideByActivePlayerId, context, intensityBySide, playerOptions, rosterCardByActivePlayerId, slotPreviewByKey, slotRoleByKey, rivalryPressureByDiscipline } = input;

  if (!activeSlot) {
    return new Map<string, ActiveSlotCandidate>();
  }

  const currentProjectedScore = slotPreviewByKey.get(activeSlot.key)?.projected.totalProjected ?? null;
  return new Map(
    playerOptions.map((option) => {
      const rosterCard = rosterCardByActivePlayerId.get(option.activePlayerId) ?? null;
      const role = slotRoleByKey.get(activeSlot.key) ?? null;
      const projected = projectCandidateForSlot(activeSlot, option, {
        rosterCardByActivePlayerId,
        slotRoleByKey,
        context,
        intensityBySide,
        rivalryPressureByDiscipline,
      });
      const blockReason = resolveLegacyLineupDragBlockReason({
        availabilityBlocker: rosterCard?.availabilityBlocker ?? null,
        selectedSides: rosterCard?.selectedSides ?? [],
        targetDisciplineSide: activeSlot.disciplineSide,
        captainSide: captainSideByActivePlayerId.get(option.activePlayerId) ?? null,
        hasBaseScore: option.disciplineScores[activeSlot.disciplineId] != null,
      });

      const scoreDelta =
        projected.totalProjected != null && currentProjectedScore != null
          ? Number((projected.totalProjected - currentProjectedScore).toFixed(1))
          : null;
      const fitExplanation = buildSlotFitExplanation(role, rosterCard, projected, scoreDelta);

      return [
        option.activePlayerId,
        {
          baseScore: option.disciplineScores[activeSlot.disciplineId] ?? null,
          projectedScore: projected.totalProjected,
          scoreDelta,
          blockReason,
          fitSummary: fitExplanation.summary,
          fitDetail: fitExplanation.detail,
          roleModifier: projected.roleModifier,
          rangeLow: projected.rangeLow,
          rangeHigh: projected.rangeHigh,
          warnings: projected.warnings,
          fatigueModifier: projected.fatigueModifier,
          additionalFatigue: projected.additionalFatigue,
        },
      ] as const;
    }),
  );
}

/** Vormals `teamdeckCandidateEntries` (useMemo). */
export function buildTeamdeckCandidateEntries(input: {
  activeSlot: LegacyLineupLabSlot | null;
  selections: Record<string, string>;
  activeSlotCandidateSummary: { topCandidates: SlotCandidateSummaryEntry[]; currentProjected: number | null } | null;
  activeSlotCandidateByActivePlayerId: Map<string, ActiveSlotCandidate>;
  matchdayRosterCards: MatchdayRosterCard[];
  playerBestSlotSummaryByActivePlayerId: Map<string, PlayerBestSlotEntry[]>;
  context: LegacyLineupLoadedContext | null;
  focusedDisciplineSide: "d1" | "d2";
  teamdeckFilterMode: TeamdeckFilterMode;
  teamdeckSortMode: TeamdeckSortMode;
}): TeamdeckCandidateEntry[] {
  const {
    activeSlot,
    selections,
    activeSlotCandidateSummary,
    activeSlotCandidateByActivePlayerId,
    matchdayRosterCards,
    playerBestSlotSummaryByActivePlayerId,
    context,
    focusedDisciplineSide,
    teamdeckFilterMode,
    teamdeckSortMode,
  } = input;

  const selectedInActiveSlot = activeSlot ? selections[activeSlot.key] ?? "" : "";
  const bestProjectedScore = activeSlotCandidateSummary?.topCandidates[0]?.projectedScore ?? null;
  const currentProjectedScore = activeSlotCandidateSummary?.currentProjected ?? null;
  const activeSlotTag = activeSlot ? `${activeSlot.disciplineSide.toUpperCase()}-${activeSlot.slotIndex + 1}` : null;
  const currentTeamdeckDisciplineId =
    activeSlot?.disciplineId ??
    (focusedDisciplineSide === "d1"
      ? context?.matchdayContract?.discipline1?.disciplineId ?? null
      : context?.matchdayContract?.discipline2?.disciplineId ?? null);

  return matchdayRosterCards
    .map((player) => {
      const activeSlotCandidate = player.activePlayerId
        ? activeSlotCandidateByActivePlayerId.get(player.activePlayerId) ?? null
        : null;
      const selectedElsewhere = Boolean(
        player.activePlayerId &&
          player.activePlayerId !== selectedInActiveSlot &&
          player.selectedSides.length > 0,
      );
      const projectedScore = activeSlotCandidate?.projectedScore ?? null;
      const scoreDelta = activeSlotCandidate?.scoreDelta ?? null;
      const fitTier =
        activeSlot && player.activePlayerId
          ? getLegacyLineupDragFitTier({
              blocked: Boolean(activeSlotCandidate?.blockReason || selectedElsewhere),
              projectedScore,
              bestProjectedScore,
              currentProjectedScore,
            })
          : "blocked";
      const relevantDisciplineDemands = player.demands.filter(
        (demand) => demand.targetDisciplineId && demand.targetDisciplineId === currentTeamdeckDisciplineId,
      );
      const preferredSlotTags = (playerBestSlotSummaryByActivePlayerId.get(player.activePlayerId ?? "") ?? [])
        .slice(0, 2)
        .map((entry) => `${entry.disciplineSide.toUpperCase()}-${entry.slotIndex + 1}`);
      const wantsActiveSlot = Boolean(activeSlotTag && preferredSlotTags.includes(activeSlotTag));
      const captainDemand = relevantDisciplineDemands.find((demand) => demand.label === "Captain-Rolle") ?? null;

      let groupKey: TeamdeckCandidateQualityKey = "alternative";
      let detail = "Spielbar für diesen Slot.";
      let shortReason = `${formatNullableScore(projectedScore)} Score`;

      if (selectedElsewhere) {
        groupKey = "blocked";
        detail = `Schon in ${player.selectedSides.join(" + ").toUpperCase()} eingesetzt.`;
        shortReason = player.selectedSides.join(" + ").toUpperCase();
      } else if (activeSlotCandidate?.blockReason) {
        groupKey = "blocked";
        detail = formatLegacyLineupDragBlockReason(activeSlotCandidate.blockReason) ?? "Gerade nicht legal einsetzbar.";
        // "Verletzt" statt "blockiert": In der Auswahlliste stand fuer JEDEN Sperrgrund dasselbe
        // Wort. Warum ein Spieler nicht geht, sah man erst im Hovertext — eine Verletzung war
        // damit vor dem Setzen nicht erkennbar, obwohl sie der haeufigste und wichtigste Grund
        // ist. Genau so gemeldet: "verletzungen muessen im ui direkt erkennbar sein".
        shortReason = activeSlotCandidate.blockReason === "player_injured_unavailable" ? "Verletzt" : "blockiert";
      } else if (isElevatedFatigue(player.fatigueCount)) {
        groupKey = "fatigue";
        detail = `${formatFatigueImpactDetail(player.fatigueCount)} macht den Pick spürbar riskanter.`;
        shortReason = `F ${Math.round(player.fatigueCount ?? 0)}`;
      } else if (
        fitTier === "poor" ||
        projectedScore == null ||
        (scoreDelta != null && scoreDelta <= -6) ||
        (projectedScore != null && projectedScore < 45)
      ) {
        groupKey = "emergency";
        detail = "Nur als Notfall-Pick sinnvoll.";
        shortReason = scoreDelta != null ? `${scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(scoreDelta, 1)}` : "Notfall";
      } else if (
        fitTier === "best" ||
        fitTier === "great" ||
        (scoreDelta != null && scoreDelta >= 0)
      ) {
        groupKey = "instant";
        detail = "Passt direkt sauber in den Slot.";
        shortReason = scoreDelta != null ? `${scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(scoreDelta, 1)}` : "direkt";
      } else {
        groupKey = "alternative";
        detail = "Gute Alternative, falls du bewusst variieren willst.";
        shortReason = scoreDelta != null ? `${scoreDelta >= 0 ? "+" : ""}${formatDecimalScore(scoreDelta, 1)}` : "Alternative";
      }

      return {
        player,
        activeSlotCandidate,
        relevantDisciplineDemands,
        preferredSlotTags,
        captainDemand,
        wantsActiveSlot,
        isWishMatch: relevantDisciplineDemands.length > 0,
        fitTier,
        groupKey,
        detail,
        shortReason,
        groupMeta: getTeamdeckCandidateGroupMeta(groupKey),
      };
    })
    .filter((entry) => {
      if (teamdeckFilterMode === "free") {
        return entry.player.selectedSides.length === 0 && !entry.player.availabilityBlocker;
      }
      if (teamdeckFilterMode === "assigned") {
        return entry.player.selectedSides.length > 0;
      }
      if (teamdeckFilterMode === "blocked") {
        return entry.groupKey === "blocked";
      }
      return true;
    })
    .sort((left, right) => {
      const leftBlocked = left.groupKey === "blocked";
      const rightBlocked = right.groupKey === "blocked";
      if (leftBlocked !== rightBlocked) {
        return leftBlocked ? 1 : -1;
      }
      const leftSlotScore = left.activeSlotCandidate?.projectedScore ?? Number.NEGATIVE_INFINITY;
      const rightSlotScore = right.activeSlotCandidate?.projectedScore ?? Number.NEGATIVE_INFINITY;
      if (teamdeckSortMode === "top" && leftSlotScore !== rightSlotScore) {
        return rightSlotScore - leftSlotScore;
      }
      if (teamdeckSortMode === "d1") {
        const leftScore = left.player.discipline1Score ?? Number.NEGATIVE_INFINITY;
        const rightScore = right.player.discipline1Score ?? Number.NEGATIVE_INFINITY;
        if (leftScore !== rightScore) {
          return rightScore - leftScore;
        }
      }
      if (teamdeckSortMode === "d2") {
        const leftScore = left.player.discipline2Score ?? Number.NEGATIVE_INFINITY;
        const rightScore = right.player.discipline2Score ?? Number.NEGATIVE_INFINITY;
        if (leftScore !== rightScore) {
          return rightScore - leftScore;
        }
      }
      if (teamdeckSortMode === "captain") {
        const leftCaptainScore =
          (left.player.captainEligible ? 1000 : 0) +
          (left.captainDemand ? 200 : 0) +
          (left.activeSlotCandidate?.projectedScore ?? Number.NEGATIVE_INFINITY);
        const rightCaptainScore =
          (right.player.captainEligible ? 1000 : 0) +
          (right.captainDemand ? 200 : 0) +
          (right.activeSlotCandidate?.projectedScore ?? Number.NEGATIVE_INFINITY);
        if (leftCaptainScore !== rightCaptainScore) {
          return rightCaptainScore - leftCaptainScore;
        }
      }
      if (teamdeckSortMode === "fatigue") {
        const leftFatigue = left.player.fatigueCount ?? Number.POSITIVE_INFINITY;
        const rightFatigue = right.player.fatigueCount ?? Number.POSITIVE_INFINITY;
        if (leftFatigue !== rightFatigue) {
          return leftFatigue - rightFatigue;
        }
      }
      if (teamdeckSortMode === "wish") {
        const leftWishScore =
          (left.isWishMatch ? 1000 : 0) +
          (left.wantsActiveSlot ? 160 : 0) +
          (left.activeSlotCandidate?.projectedScore ?? Number.NEGATIVE_INFINITY);
        const rightWishScore =
          (right.isWishMatch ? 1000 : 0) +
          (right.wantsActiveSlot ? 160 : 0) +
          (right.activeSlotCandidate?.projectedScore ?? Number.NEGATIVE_INFINITY);
        if (leftWishScore !== rightWishScore) {
          return rightWishScore - leftWishScore;
        }
      }
      if (left.groupMeta.order !== right.groupMeta.order) {
        return left.groupMeta.order - right.groupMeta.order;
      }
      if (leftSlotScore !== rightSlotScore) {
        return rightSlotScore - leftSlotScore;
      }
      const leftFocusedScore =
        teamdeckSortMode === "d1"
          ? left.player.discipline2Score ?? Number.NEGATIVE_INFINITY
          : teamdeckSortMode === "d2"
            ? left.player.discipline1Score ?? Number.NEGATIVE_INFINITY
            : Math.max(left.player.discipline1Score ?? Number.NEGATIVE_INFINITY, left.player.discipline2Score ?? Number.NEGATIVE_INFINITY);
      const rightFocusedScore =
        teamdeckSortMode === "d1"
          ? right.player.discipline2Score ?? Number.NEGATIVE_INFINITY
          : teamdeckSortMode === "d2"
            ? right.player.discipline1Score ?? Number.NEGATIVE_INFINITY
            : Math.max(right.player.discipline1Score ?? Number.NEGATIVE_INFINITY, right.player.discipline2Score ?? Number.NEGATIVE_INFINITY);
      if (leftFocusedScore !== rightFocusedScore) {
        return rightFocusedScore - leftFocusedScore;
      }
      return left.player.name.localeCompare(right.player.name, "de");
    });
}

/** Vormals `teamdeckCandidateGroups` (useMemo). */
export function buildTeamdeckCandidateGroups(input: {
  teamdeckCandidateEntries: TeamdeckCandidateEntry[];
  showOnlyTopSlotCandidates: boolean;
  teamdeckFilterMode: TeamdeckFilterMode;
}): TeamdeckCandidateGroup[] {
  const { teamdeckCandidateEntries, showOnlyTopSlotCandidates, teamdeckFilterMode } = input;
  const keys: TeamdeckCandidateQualityKey[] = ["instant", "alternative", "fatigue", "blocked", "emergency"];
  return keys
    .map((groupKey) => {
      const meta = getTeamdeckCandidateGroupMeta(groupKey);
      const entries = teamdeckCandidateEntries.filter((entry) => entry.groupKey === groupKey);
      const limitedEntries =
        showOnlyTopSlotCandidates && teamdeckFilterMode !== "blocked"
          ? entries.slice(0, groupKey === "instant" ? 5 : groupKey === "blocked" ? 4 : 3)
          : entries;
      return {
        key: groupKey,
        meta,
        entries: limitedEntries,
        totalCount: entries.length,
      };
    })
    .filter((group) => group.entries.length > 0);
}
