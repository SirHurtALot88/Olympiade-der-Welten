"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { getClassColorClassName, getClassColorToken } from "@/app/foundation/ClassColorChip";
import ClassIcon from "@/app/foundation/ClassIcon";
import ContractOfferClient from "@/app/foundation/contract-offer/ContractOfferClient";
import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import RaceIcon from "@/app/foundation/RaceIcon";
import { getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import type { ContractShape, Discipline, Team, TeamControlMode, TeamSeasonObjectiveRecord, TransferWishlistEntry } from "@/lib/data/olyDataTypes";
import {
  formatTransfermarktCurrency,
  formatTransfermarktRatio,
  getConfirmedTierStyle,
  type TransfermarktTier,
} from "@/lib/market/transfermarkt-formatting-contract";
import { getTransfermarktPortraitModel } from "@/lib/market/transfermarkt-lab";
import type { TransferHistoryItem, TransferHistoryReadResult } from "@/lib/market/transfer-history-read-service";
import type { TransfermarktBuyPreview } from "@/lib/market/transfermarkt-buy-service";
import type { TransfermarktFreeAgentItem, TransfermarktReadResult } from "@/lib/market/transfermarkt-read-service";
import {
  buildTransfermarktScoutedAttributeRows,
  getTransfermarktScoutingDisclosure,
  getTransfermarktScoutingVisibilityBuckets,
  normalizeTransfermarktScoutingLevel,
  getTransfermarktTrainingAffinityVisibility,
  type TransfermarktAttributeRatings,
  type TransfermarktAttributeKey,
  type TransfermarktScoutedAttributeRow,
} from "@/lib/market/transfermarkt-scouting";
import {
  officialDisciplineWeightLabels,
  officialDisciplineWeightOrder,
  officialDisciplineWeightTable,
  type OfficialDisciplineWeightId,
  type PlayerGeneratorAttributeKey,
} from "@/lib/player-generator/official-discipline-weights";
import {
  appendRoomContextToParams,
  readFoundationRoomContextFromLocation,
  withRoomContextBody,
} from "@/lib/room/foundation-room-context-client";
import { DEFAULT_ACTIVE_OWNER_ID } from "@/lib/foundation/team-control-settings";
import { getClassTrainingSignals } from "@/lib/training/class-progression-config";
import { VeloAttributeFocusTags, VeloStatOrbitRow } from "@/components/foundation/velo-ui";

type TransfermarktV2ClientProps = {
  defaultSaveId: string;
  defaultSeasonId: string;
  bootstrapReady?: boolean;
  defaultTeamId?: string | null;
  source?: "sqlite" | "prisma";
  activeOwnerId?: string | null;
  manageableTeamIds?: string[];
  teamControlModesByTeamId?: Record<string, TeamControlMode>;
  teamControlOwnersByTeamId?: Record<string, { ownerId?: string | null; ownerSlot?: string | null }>;
  teams: Team[];
  disciplines?: Discipline[];
  rosterRows?: TransfermarktV2RosterRow[];
  wishlistEntries?: TransferWishlistEntry[];
  wishlistPlayerIds?: string[];
  boardObjectiveHighlights?: TeamSeasonObjectiveRecord[];
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
  onOpenHistory?: (() => void) | null;
  onOpenClassicMarket?: (() => void) | null;
  onToggleWishlist?: ((item: TransfermarktFreeAgentItem) => void) | null;
  onRemoveWishlist?: ((playerId: string) => void) | null;
  scoutingWatchPlayerIds?: string[];
  scoutingIntelByPlayerId?: Record<string, number>;
  scoutingPipelineCapacity?: { occupied: number; max: number } | null;
  onToggleScoutingWatch?: ((item: TransfermarktFreeAgentItem) => void) | null;
  onBuyCompleted?: ((teamId: string) => Promise<void> | void) | null;
  initialPlayerId?: string | null;
  onInitialPlayerFocusConsumed?: (() => void) | null;
  onSell?: ((payload: { activePlayerId: string; playerId: string; playerName: string; className: string; race: string | null; portraitUrl: string | null }) => void) | null;
};

type MarketFeedResponse = TransfermarktReadResult & {
  error?: string;
};

type MarketBuyResponse = {
  success: boolean;
  summary: TransfermarktBuyPreview | null;
  warnings: string[];
  error?: string;
};

type MarketHistoryResponse = TransferHistoryReadResult & {
  error?: string;
};
type MarketNegotiationOutcome = {
  status: "accepted" | "countered" | "rejected";
  title: string;
  message: string;
  tone: "success" | "warning" | "error";
  counterSalary?: number | null;
};

type MarketSortMode = "need" | "fit" | "value" | "cheap" | "potential" | "salary";
type MarketAxisKey = keyof typeof AXIS_META;
type MarketClassAxisFilter = "pow" | "spe" | "men" | "soc";
type MarketFilterSnapshot = {
  search: string;
  sortMode: MarketSortMode;
  selectedDisciplineLens: OfficialDisciplineWeightId | "";
  selectedAxes: MarketAxisKey[];
  axisMinimums: Record<MarketAxisKey, number>;
  selectedClassNames: string[];
  selectedClassAxes: MarketClassAxisFilter[];
  selectedRaceNames: string[];
  maxValue: number;
  maxSalary: number;
  maxRatio: number;
  minFit: number;
};
type MarketFilterPreset = {
  id: string;
  name: string;
  snapshot: MarketFilterSnapshot;
  createdAt: string;
  updatedAt: string;
};
type WishlistSortKey = "createdAt" | "playerName" | "className" | "marketValue" | "salary" | "bracket" | "pow" | "spe" | "men" | "soc";
type WishlistSortState = {
  key: WishlistSortKey;
  direction: "asc" | "desc";
};
type TransfermarktV2RosterRow = {
  activePlayerId: string;
  playerId: string;
  teamId: string;
  name: string;
  className: string;
  marketValue: number | null;
  salary: number | null;
  contractLength: number | null;
  pps: number | null;
  ovr: number | null;
  mvs: number | null;
  race?: string | null;
  portraitUrl?: string | null;
  valueScore?: number | null;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
  disciplineRatings?: Record<string, number | null>;
};

const MARKET_PAGE_LIMIT = 250;
const MARKET_INITIAL_RENDER_COUNT = 32;
const MARKET_RENDER_STEP = 24;
const MARKET_BATCH_PUBLISH_SIZE = 500;
const DEFAULT_MAX_MARKET_VALUE = 0;
const DEFAULT_MAX_SALARY = 0;
const DEFAULT_MAX_RATIO = 0;
const MARKET_FILTER_STORAGE_VERSION = 1;
const MARKET_FILTER_STORAGE_PREFIX = "oly.transfermarkt.v2.filters";
const MARKET_AXIS_ORDER: MarketAxisKey[] = ["pow", "spe", "men", "soc"];
const MARKET_SORT_MODES: MarketSortMode[] = ["need", "fit", "value", "cheap", "potential", "salary"];
const MARKET_CLASS_AXIS_FILTERS: MarketClassAxisFilter[] = ["pow", "spe", "men", "soc"];
const HIDDEN_RACE_FILTER_VALUES = new Set(["unknown"]);
const TRAINING_ATTRIBUTE_LABELS: Record<PlayerGeneratorAttributeKey, string> = {
  power: "Power",
  health: "Health",
  stamina: "Stamina",
  intelligence: "Intelligence",
  awareness: "Awareness",
  determination: "Determination",
  speed: "Speed",
  dexterity: "Dexterity",
  charisma: "Charisma",
  will: "Will",
  spirit: "Spirit",
  torment: "Torment",
};
const MARKET_CLASS_OPTIONS = [
  "Bard",
  "Badass",
  "Berserker",
  "Charger",
  "Hero",
  "Mage",
  "Overseer",
  "Rogue",
  "Sprinter",
  "Tactician",
  "Tank",
  "Templar",
  "Warlord",
] as const;
const MARKET_CLASS_DISPLAY_ORDER = [
  "Berserker",
  "Tank",
  "Warlord",
  "Charger",
  "Rogue",
  "Sprinter",
  "Mage",
  "Overseer",
  "Templar",
  "Hero",
  "Badass",
  "Bard",
  "Tactician",
] as const;

const SCOUT_TIER_ORDER = ["F", "E", "D", "C", "B", "A", "S", "S+"] as const;
const DISCIPLINE_ABBREVIATIONS: Record<string, string> = {
  tdm: "TDM",
  "mini-dm": "MDM",
  gewichtheben: "GEW",
  hockey: "HOC",
  breaking: "BRE",
  staffel: "STA",
  staffellauf: "STA",
  spurt: "SPU",
  climbing: "CLM",
  fechten: "FEC",
  schach: "SCH",
  "speed-schach": "SCH",
  takeshi: "TAK",
  "takeshis-castle": "TAK",
  tennis: "TEN",
  "time-trial": "TT",
  timetrial: "TT",
  "i-spy": "SPY",
  wettessen: "WET",
  basketball: "BAS",
  football: "FOO",
  battlefield: "BAT",
  eiskunst: "EIS",
  eiskunstlauf: "EIS",
  showcase: "SHW",
};

const AXIS_META = {
  pow: { label: "POW", className: "is-pow" },
  spe: { label: "SPE", className: "is-spe" },
  men: { label: "MEN", className: "is-men" },
  soc: { label: "SOC", className: "is-soc" },
} as const;

const CLASS_COLOR_TO_AXIS: Record<string, MarketClassAxisFilter> = {
  red: "pow",
  green: "spe",
  blue: "men",
  yellow: "soc",
};

const DISCIPLINE_CATEGORY_BY_KEY: Record<string, "power" | "speed" | "mental" | "social"> = {
  tdm: "power",
  "mini-dm": "power",
  gewichtheben: "power",
  hockey: "power",
  breaking: "power",
  spurt: "speed",
  staffel: "speed",
  staffellauf: "speed",
  climbing: "speed",
  fechten: "speed",
  tennis: "mental",
  schach: "mental",
  "speed-schach": "mental",
  takeshi: "mental",
  "takeshis-castle": "mental",
  "i-spy": "mental",
  wettessen: "mental",
  showcase: "social",
  basketball: "social",
  football: "social",
  battlefield: "social",
  eiskunst: "social",
  eiskunstlauf: "social",
};

const LABEL_MAP: Record<string, string> = {
  affordable: "bezahlbar",
  under_opt: "unter Soll",
  over_opt: "ueber Soll",
  unknown: "unbekannt",
  ready: "bereit",
  not_ready: "noch roh",
  high: "hoch",
  medium: "mittel",
  low: "niedrig",
  elite: "elite",
  balanced: "ausgeglichen",
  front_loaded: "vorne schwer",
  back_loaded: "hinten schwer",
};

const ATTRIBUTE_SHORT_LABELS: Record<PlayerGeneratorAttributeKey, string> = {
  power: "POW",
  health: "HEA",
  determination: "DET",
  stamina: "STA",
  speed: "SPE",
  dexterity: "DEX",
  awareness: "AWA",
  intelligence: "INT",
  will: "WIL",
  charisma: "CHA",
  spirit: "SPI",
  torment: "TOR",
};

const MARKET_ATTRIBUTE_GRID_ORDER: TransfermarktAttributeKey[] = [
  "power",
  "health",
  "stamina",
  "intelligence",
  "awareness",
  "determination",
  "speed",
  "dexterity",
  "charisma",
  "will",
  "spirit",
  "torment",
];

type DisciplineLensAttribute = {
  attribute: PlayerGeneratorAttributeKey;
  label: string;
  shortLabel: string;
  weight: number;
  focusTone: "focus-primary" | "focus-secondary" | "focus-support" | "focus-soft";
};

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function createDefaultMarketFilterSnapshot(): MarketFilterSnapshot {
  return {
    search: "",
    sortMode: "potential",
    selectedDisciplineLens: "",
    selectedAxes: [],
    axisMinimums: { pow: 0, spe: 0, men: 0, soc: 0 },
    selectedClassNames: [],
    selectedClassAxes: [],
    selectedRaceNames: [],
    maxValue: DEFAULT_MAX_MARKET_VALUE,
    maxSalary: DEFAULT_MAX_SALARY,
    maxRatio: DEFAULT_MAX_RATIO,
    minFit: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, numericValue));
}

function sanitizeStringArray(value: unknown, allowedValues?: readonly string[]) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .filter((entry, index, entries) => entries.indexOf(entry) === index)
    .filter((entry) => !allowedValues || allowedValues.includes(entry));
}

function sanitizeMarketFilterSnapshot(value: unknown): MarketFilterSnapshot {
  const defaults = createDefaultMarketFilterSnapshot();
  if (!isRecord(value)) {
    return defaults;
  }
  const rawAxisMinimums = isRecord(value.axisMinimums) ? value.axisMinimums : {};
  return {
    search: typeof value.search === "string" ? value.search.slice(0, 80) : defaults.search,
    sortMode: typeof value.sortMode === "string" && MARKET_SORT_MODES.includes(value.sortMode as MarketSortMode)
      ? value.sortMode as MarketSortMode
      : defaults.sortMode,
    selectedDisciplineLens:
      typeof value.selectedDisciplineLens === "string" &&
      [...officialDisciplineWeightOrder, ""].includes(value.selectedDisciplineLens as OfficialDisciplineWeightId | "")
        ? (value.selectedDisciplineLens as OfficialDisciplineWeightId | "")
        : defaults.selectedDisciplineLens,
    selectedAxes: sanitizeStringArray(value.selectedAxes, MARKET_AXIS_ORDER) as MarketAxisKey[],
    axisMinimums: {
      pow: sanitizeNumber(rawAxisMinimums.pow, defaults.axisMinimums.pow, 0, 100),
      spe: sanitizeNumber(rawAxisMinimums.spe, defaults.axisMinimums.spe, 0, 100),
      men: sanitizeNumber(rawAxisMinimums.men, defaults.axisMinimums.men, 0, 100),
      soc: sanitizeNumber(rawAxisMinimums.soc, defaults.axisMinimums.soc, 0, 100),
    },
    selectedClassNames: sanitizeStringArray(value.selectedClassNames),
    selectedClassAxes: sanitizeStringArray(value.selectedClassAxes, MARKET_CLASS_AXIS_FILTERS) as MarketClassAxisFilter[],
    selectedRaceNames: sanitizeStringArray(value.selectedRaceNames).filter((raceName) => !HIDDEN_RACE_FILTER_VALUES.has(raceName.toLowerCase())),
    maxValue: sanitizeNumber(value.maxValue, defaults.maxValue, 0, 1000),
    maxSalary: sanitizeNumber(value.maxSalary, defaults.maxSalary, 0, 250),
    maxRatio: sanitizeNumber(value.maxRatio, defaults.maxRatio, 0, 20),
    minFit: sanitizeNumber(value.minFit, defaults.minFit, 0, 25),
  };
}

function getMarketFilterStorageKey(saveId: string | null | undefined) {
  return `${MARKET_FILTER_STORAGE_PREFIX}:${saveId || "global"}`;
}

function readMarketFilterStorage(saveId: string | null | undefined): { last: MarketFilterSnapshot | null; presets: MarketFilterPreset[] } {
  if (typeof window === "undefined") {
    return { last: null, presets: [] };
  }
  try {
    const raw = window.localStorage.getItem(getMarketFilterStorageKey(saveId));
    if (!raw) {
      return { last: null, presets: [] };
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return { last: null, presets: [] };
    }
    const presets = Array.isArray(parsed.presets)
      ? parsed.presets
          .filter(isRecord)
          .map((preset) => ({
            id: typeof preset.id === "string" && preset.id ? preset.id : `preset-${crypto.randomUUID()}`,
            name: typeof preset.name === "string" && preset.name.trim() ? preset.name.trim().slice(0, 32) : "Filter",
            snapshot: sanitizeMarketFilterSnapshot(preset.snapshot),
            createdAt: typeof preset.createdAt === "string" ? preset.createdAt : new Date().toISOString(),
            updatedAt: typeof preset.updatedAt === "string" ? preset.updatedAt : new Date().toISOString(),
          }))
          .slice(0, 18)
      : [];
    return {
      last: parsed.last ? sanitizeMarketFilterSnapshot(parsed.last) : null,
      presets,
    };
  } catch {
    return { last: null, presets: [] };
  }
}

function writeMarketFilterStorage(saveId: string | null | undefined, last: MarketFilterSnapshot, presets: MarketFilterPreset[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      getMarketFilterStorageKey(saveId),
      JSON.stringify({
        version: MARKET_FILTER_STORAGE_VERSION,
        last,
        presets: presets.slice(0, 18),
      }),
    );
  } catch {
    // Browser storage is optional UI comfort. If it is full/blocked, the market must still work.
  }
}

function formatCompactNumber(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatTransfermarktCash(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${formatCompactNumber(value, 1)} €`;
}

function formatPercentLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${Math.round(value)}%`;
}

function formatSignedPercentDelta(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const formatted = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Math.abs(value) * 100);
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatted}%`;
}

function formatSignedPoints(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${value > 0 ? "+" : ""}${Math.round(value)}`;
}

function formatDemandPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function formatToneLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  return LABEL_MAP[value] ?? value.replaceAll("_", " ");
}

function formatDevelopmentRouteLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    core_growth: "Kernwerte steigern",
    late_bloomer: "Spaetentwickler",
    veteran_plateau: "Plateau halten",
    free_agent_ambient: "freier Markt",
    regression_watch: "Rueckschritt vermeiden",
    star_refinement: "Star verfeinern",
    balanced_growth: "balanciert entwickeln",
  };

  if (!value) return "Entwicklung offen";
  return labels[value] ?? formatToneLabel(value);
}

function getScoutReliabilityCopy(confidence: number | null | undefined) {
  if (confidence == null || !Number.isFinite(confidence)) {
    return "Scouting unscharf: Werte als grobe Richtung lesen.";
  }
  if (confidence >= 75) return "Scouting klar: Range ist relativ eng.";
  if (confidence >= 50) return "Scouting solide: kleine Abweichungen moeglich.";
  if (confidence >= 30) return "Scouting grob: erst als Tendenz nutzen.";
  return "Scouting roh: grobe Spanne, nicht als exakte Wahrheit lesen.";
}

function formatReadinessLabel(value: string | null | undefined) {
  if (!value) {
    return "unbekannt";
  }
  return value.replaceAll("_", " ");
}

function formatContractLengthPreference(value: "short" | "medium" | "long" | null | undefined) {
  if (value === "short") return "kurze Verträge";
  if (value === "long") return "lange Verträge";
  if (value === "medium") return "mittlere Verträge";
  return "offen";
}

function formatContractShapeLabel(value: ContractShape | null | undefined) {
  if (value === "front_loaded") return "vorne schwer";
  if (value === "back_loaded") return "hinten schwer";
  if (value === "balanced") return "ausgeglichen";
  return "offen";
}

function formatContractPreferenceCurrentStatus(
  contractPreference: {
    preferredMinLength: number;
    preferredMaxLength: number;
    shapePreference: ContractShape;
  },
  contractLength: number | null | undefined,
  contractShape: ContractShape | null | undefined,
) {
  const safeLength = typeof contractLength === "number" && Number.isFinite(contractLength) ? contractLength : null;
  const lengthMatches =
    safeLength != null &&
    safeLength >= contractPreference.preferredMinLength &&
    safeLength <= contractPreference.preferredMaxLength;
  const shapeMatches = contractShape === contractPreference.shapePreference;

  if (lengthMatches && shapeMatches) {
    return "Aktuell: Laufzeit und Form passen gut";
  }
  if (lengthMatches) {
    return `Aktuell: Laufzeit passt, Form stoert (${formatContractShapeLabel(contractShape)})`;
  }
  if (shapeMatches) {
    return `Aktuell: Form passt, Laufzeit stoert (${safeLength ?? "?"} Saisons)`;
  }
  return `Aktuell: Laufzeit (${safeLength ?? "?"}) und Form (${formatContractShapeLabel(contractShape)}) weichen ab`;
}

function getAxisBarWidth(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(8, Math.min(100, value));
}

function getTopDisciplineHeadline(item: TransfermarktFreeAgentItem) {
  if (!item.topDisciplineScores.length) {
    return "keine Top-Diszis";
  }

  return item.topDisciplineScores
    .slice(0, 2)
    .map((entry) => `${getDisciplineAbbreviation(entry.disciplineId ?? null, entry.disciplineName)} ${entry.scoreTier ?? "—"}`)
    .join(" · ");
}

function getPotentialLabel(item: TransfermarktFreeAgentItem) {
  const range = item.potentialRange;
  if (!range) {
    return item.potentialBand;
  }
  return `${item.potentialBand} · ${formatCompactNumber(range.min, 0)}-${formatCompactNumber(range.max, 0)}`;
}

function getScoutingClarityLabel(confidence: number | null | undefined) {
  if (confidence == null || !Number.isFinite(confidence)) {
    return "unklar";
  }
  if (confidence >= 75) return "klar";
  if (confidence >= 50) return "solide";
  if (confidence >= 30) return "grob";
  return "roh";
}

function getScoutingTierWindow(tier: string | null | undefined, confidence: number | null | undefined) {
  if (!tier) {
    return "—";
  }
  const normalizedTier = tier.toUpperCase();
  const index = SCOUT_TIER_ORDER.indexOf(normalizedTier as (typeof SCOUT_TIER_ORDER)[number]);
  if (index === -1) {
    return normalizedTier;
  }
  if (confidence != null && confidence >= 75) {
    return normalizedTier;
  }

  const radius = confidence != null && confidence >= 50 ? 1 : 2;
  const lower = SCOUT_TIER_ORDER[Math.max(0, index - radius)];
  const upper = SCOUT_TIER_ORDER[Math.min(SCOUT_TIER_ORDER.length - 1, index + radius)];
  return lower === upper ? lower : `${upper}-${lower}`;
}

function normalizeDisciplineLookup(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getDisciplineAbbreviation(disciplineId: string | null | undefined, disciplineName: string | null | undefined) {
  const byId = DISCIPLINE_ABBREVIATIONS[normalizeDisciplineLookup(disciplineId)];
  if (byId) {
    return byId;
  }
  const byName = DISCIPLINE_ABBREVIATIONS[normalizeDisciplineLookup(disciplineName)];
  if (byName) {
    return byName;
  }

  const raw = (disciplineName ?? disciplineId ?? "DIS").trim();
  const compact = raw
    .split(/[\s/-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 3).toUpperCase())
    .join("");
  return compact.slice(0, 4) || "DIS";
}

function formatDisciplineScoutTag(entry: { disciplineId?: string | null; disciplineName: string; scoreTier?: string | null }, confidence: number | null | undefined) {
  return `${getDisciplineAbbreviation(entry.disciplineId ?? null, entry.disciplineName)} ${getScoutingTierWindow(entry.scoreTier ?? null, confidence)}`;
}

function formatDisciplineContextLabel(entry: {
  disciplineId?: string | null;
  disciplineName: string;
  playerCount?: number | null;
  teamRank?: number | null;
}) {
  const abbreviation = getDisciplineAbbreviation(entry.disciplineId ?? null, entry.disciplineName);
  const rank = typeof entry.teamRank === "number" && Number.isFinite(entry.teamRank) ? ` ${entry.teamRank}.` : "";
  const playerCount = typeof entry.playerCount === "number" && Number.isFinite(entry.playerCount) ? ` (${entry.playerCount})` : "";
  return `${abbreviation}${rank}${playerCount}`;
}

function getDisciplineCategoryClass(entry: { disciplineId?: string | null; disciplineName?: string | null }) {
  const category =
    DISCIPLINE_CATEGORY_BY_KEY[normalizeDisciplineLookup(entry.disciplineId)] ??
    DISCIPLINE_CATEGORY_BY_KEY[normalizeDisciplineLookup(entry.disciplineName)];
  return category ? `is-${category}` : "is-neutral";
}

function getScoutedTopDisciplineHeadline(item: TransfermarktFreeAgentItem) {
  if (!item.topDisciplineScores.length) {
    return "keine Top-Diszis";
  }

  return item.topDisciplineScores
    .slice(0, 2)
    .map((entry) => formatDisciplineScoutTag(entry, item.scoutingConfidence))
    .join(" · ");
}

function getScoutedDisciplineLine(item: TransfermarktFreeAgentItem) {
  if (!item.topDisciplineScores.length) {
    return "keine Diszi-Staerke bekannt";
  }

  return item.topDisciplineScores
    .slice(0, 5)
    .map((entry) => formatDisciplineScoutTag(entry, item.scoutingConfidence))
    .join(" · ");
}

function formatTrainingAttributeWeight(weight: number) {
  const sign = weight > 0 ? "+" : "";
  return `${sign}${formatCompactNumber(weight, 2)}`;
}

function getClassTrainingImpact(className: string | null | undefined) {
  const signals = getClassTrainingSignals(className);
  return {
    positive: signals.primaryAttributes.slice(0, 2),
    negative: signals.negativeRisks.slice(0, 1),
  };
}

function getTrainingAttributeTitle(entry: { attribute: PlayerGeneratorAttributeKey; weight: number }, tone: "signature" | "weak") {
  const direction = tone === "signature" ? "stark" : "schwach";
  return `${TRAINING_ATTRIBUTE_LABELS[entry.attribute]} trainiert aktuell ${direction}: Faktor ${formatTrainingAttributeWeight(entry.weight)}`;
}

function getDoubleLoadTooltip(item: TransfermarktFreeAgentItem) {
  const warnings = item.doubleLoadWarnings ?? [];
  if (warnings.length === 0) {
    return "";
  }
  return warnings.map((warning) => warning.tooltip).join(" · ");
}

function getItemAttributeRatings(item: TransfermarktFreeAgentItem): TransfermarktAttributeRatings {
  return {
    power: item.powerRating,
    health: item.healthRating,
    stamina: item.staminaRating,
    intelligence: item.intelligenceRating,
    awareness: item.awarenessRating,
    determination: item.determinationRating,
    speed: item.speedRating,
    dexterity: item.dexterityRating,
    charisma: item.charismaRating,
    will: item.willRating,
    spirit: item.spiritRating,
    torment: item.tormentRating,
  };
}

function getDisciplineLensTone(weight: number): DisciplineLensAttribute["focusTone"] {
  if (weight >= 20) return "focus-primary";
  if (weight >= 15) return "focus-secondary";
  if (weight >= 10) return "focus-support";
  return "focus-soft";
}

function getDisciplineLensAttributes(disciplineId: OfficialDisciplineWeightId | ""): DisciplineLensAttribute[] {
  if (!disciplineId) {
    return [];
  }
  return Object.entries(officialDisciplineWeightTable)
    .map(([attribute, weights]) => ({
      attribute: attribute as PlayerGeneratorAttributeKey,
      label: TRAINING_ATTRIBUTE_LABELS[attribute as PlayerGeneratorAttributeKey],
      shortLabel: ATTRIBUTE_SHORT_LABELS[attribute as PlayerGeneratorAttributeKey],
      weight: weights[disciplineId] ?? 0,
      focusTone: getDisciplineLensTone(weights[disciplineId] ?? 0),
    }))
    .sort((left, right) => {
      if (right.weight !== left.weight) {
        return right.weight - left.weight;
      }
      return left.label.localeCompare(right.label, "de", { sensitivity: "base" });
    })
    .slice(0, 4);
}

function getRatioTone(value: number | null | undefined) {
  if (value == null) return "neutral" as const;
  if (value >= 4) return "positive" as const;
  if (value >= 2.5) return "neutral" as const;
  if (value >= 1.5) return "warning" as const;
  return "negative" as const;
}

function getFitSignal(item: TransfermarktFreeAgentItem) {
  const fit = item.fit ?? -99;
  if (fit >= 18) {
    return { label: "starker Fit", tone: "positive" as const };
  }
  if (fit >= 10) {
    return { label: "solider Fit", tone: "neutral" as const };
  }
  if (fit >= 0) {
    return { label: "brauchbar", tone: "warning" as const };
  }
  return { label: "heikel", tone: "negative" as const };
}

function getCandidateFrameStyle(className: string | null | undefined): CSSProperties {
  const token = getClassColorToken(className);
  switch (token) {
    case "red":
      return {
        "--market-v2-candidate-accent": "rgba(214, 90, 90, 0.92)",
        "--market-v2-candidate-border": "rgba(196, 88, 88, 0.34)",
        "--market-v2-candidate-glow": "rgba(145, 47, 47, 0.18)",
      } as CSSProperties;
    case "green":
      return {
        "--market-v2-candidate-accent": "rgba(110, 191, 118, 0.92)",
        "--market-v2-candidate-border": "rgba(88, 160, 96, 0.34)",
        "--market-v2-candidate-glow": "rgba(46, 101, 54, 0.16)",
      } as CSSProperties;
    case "blue":
      return {
        "--market-v2-candidate-accent": "rgba(121, 164, 255, 0.94)",
        "--market-v2-candidate-border": "rgba(90, 129, 214, 0.34)",
        "--market-v2-candidate-glow": "rgba(45, 71, 132, 0.18)",
      } as CSSProperties;
    case "yellow":
      return {
        "--market-v2-candidate-accent": "rgba(234, 191, 87, 0.94)",
        "--market-v2-candidate-border": "rgba(184, 145, 58, 0.34)",
        "--market-v2-candidate-glow": "rgba(122, 88, 23, 0.18)",
      } as CSSProperties;
    default:
      return {
        "--market-v2-candidate-accent": "rgba(108, 143, 214, 0.82)",
        "--market-v2-candidate-border": "rgba(124, 147, 190, 0.16)",
        "--market-v2-candidate-glow": "rgba(44, 67, 109, 0.14)",
      } as CSSProperties;
  }
}

function getGrowthSignal(item: TransfermarktFreeAgentItem) {
  if (item.regressionRisk === "high") {
    return { label: "Regression hoch", tone: "negative" as const };
  }
  if (item.potentialBand === "elite" || item.potentialBand === "high") {
    return { label: "Potenzial stark", tone: "positive" as const };
  }
  if (item.potentialBand === "medium") {
    return { label: "Potenzial okay", tone: "neutral" as const };
  }
  return { label: "wenig Luft", tone: "warning" as const };
}

function getNeedSignal(item: TransfermarktFreeAgentItem) {
  const score = item.needMatchScore;
  if (score == null) {
    return { label: "Team wählen", tone: "neutral" as const };
  }
  if (score >= 72) {
    return { label: "Top-Bedarf", tone: "positive" as const };
  }
  if (score >= 48) {
    return { label: "guter Bedarf", tone: "positive" as const };
  }
  if (score >= 26) {
    return { label: "situativ", tone: "warning" as const };
  }
  return { label: "kaum Bedarf", tone: "neutral" as const };
}

function getCandidateFocusAxes(item: TransfermarktFreeAgentItem) {
  return MARKET_AXIS_ORDER
    .map((axis) => ({ axis, value: item[axis] ?? 0 }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 2);
}

function formatNegotiationSignalLabel(value: string) {
  const labels: Record<string, string> = {
    contract_length_override_in_effect: "Laufzeit weicht vom Standarddeal ab.",
    insufficient_cash: "Cash reicht fuer Kauf oder Gesamtpaket noch nicht.",
    low_team_fit_reduces_acceptance: "Schwacher Teamfit drueckt die Zusage.",
    local_team_not_owned_or_ai_controlled: "Dieses Team ist hier nur Ansicht und kann keine Deals schreiben.",
    market_bracket_factor_preview_pending: "Marktklasse ist nur grob eingeschaetzt.",
    negotiation_cancelled_after_contact: "Abbruch nach Kontakt bleibt als Vertrauensmalus haengen.",
    negotiation_rejected_bad_experience: "Die letzte Absage macht die naechste Runde haerter.",
    offer_below_expected_salary: "Angebot liegt unter der aktuellen Forderung.",
    previous_rejected_offer_reduces_trust: "Spieler ist nach der letzten Runde noch angefressen und verhandelt haerter.",
    preview_only_contract_negotiation: "Verhandlungssimulation — finaler Kauf über „Kauf bestätigen“.",
    trait_salary_factor_source_missing: "Ein Teil der Trait-Effekte ist noch unscharf.",
    team_not_found: "Team wurde nicht gefunden.",
    player_not_found: "Spieler wurde nicht gefunden.",
    player_not_free_agent_in_scope: "Spieler ist gerade kein freier Zugang.",
    roster_limit_reached: "Kader ist bereits voll.",
    salary_source_missing: "Gehaltsbasis fehlt.",
  };

  return labels[value] ?? value.replaceAll("_", " ");
}

function getNegotiationOutcomeToneClass(tone: MarketNegotiationOutcome["tone"]) {
  if (tone === "success") return "is-success";
  if (tone === "warning") return "is-warning";
  return "is-error";
}

function formatDealPreviewErrorLabel(value: string) {
  if (value === "local_team_not_owned_or_ai_controlled") return "Team nicht steuerbar";
  if (value.includes("not_owned") || value.includes("ai_controlled")) return "Team nicht steuerbar";
  return "Deal noch gesperrt";
}

function formatCandidateAvailabilityLabel(teamCode: string | null | undefined, availableCount: number | null | undefined) {
  const safeCount = typeof availableCount === "number" && Number.isFinite(availableCount) ? availableCount : 0;
  if (teamCode) {
    return `${safeCount} fuer ${teamCode} verfuegbar`;
  }
  return `${safeCount} im Markt`;
}

function getToneClass(tone: "positive" | "negative" | "neutral" | "warning") {
  if (tone === "positive") return "is-positive";
  if (tone === "negative") return "is-negative";
  if (tone === "warning") return "is-warning";
  return "is-neutral";
}

function toggleSelection<T extends string>(current: T[], value: T) {
  return current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
}

function sortClassNames(left: string, right: string) {
  const leftIndex = MARKET_CLASS_DISPLAY_ORDER.indexOf(left as typeof MARKET_CLASS_DISPLAY_ORDER[number]);
  const rightIndex = MARKET_CLASS_DISPLAY_ORDER.indexOf(right as typeof MARKET_CLASS_DISPLAY_ORDER[number]);
  if (leftIndex >= 0 || rightIndex >= 0) {
    if (leftIndex < 0) return 1;
    if (rightIndex < 0) return -1;
    return leftIndex - rightIndex;
  }
  return left.localeCompare(right, "de");
}

function getAxisValue(item: TransfermarktFreeAgentItem, axis: MarketAxisKey) {
  return item[axis] ?? Number.NEGATIVE_INFINITY;
}

function getWishlistAxisValue(
  entry: TransferWishlistEntry,
  marketItem: TransfermarktFreeAgentItem | undefined,
  axis: MarketAxisKey,
) {
  const liveValue = marketItem?.[axis];
  if (typeof liveValue === "number" && Number.isFinite(liveValue)) {
    return liveValue;
  }

  const storedValue = entry[axis];
  return typeof storedValue === "number" && Number.isFinite(storedValue) ? storedValue : null;
}

function getAxisComparisonTone(delta: number | null, isNeedAxis: boolean) {
  if (delta == null) return "is-neutral";
  if (delta >= 8) return "is-positive";
  if (delta >= 0) return isNeedAxis ? "is-positive" : "is-neutral";
  if (delta <= -8) return "is-negative";
  return isNeedAxis ? "is-warning" : "is-neutral";
}

function formatAxisComparisonDelta(delta: number | null) {
  if (delta == null) return "—";
  return `${delta >= 0 ? "+" : ""}${formatCompactNumber(delta, 0)}`;
}

function sortCandidates(items: TransfermarktFreeAgentItem[], mode: MarketSortMode) {
  const rows = [...items];
  rows.sort((left, right) => {
    if (mode === "need") {
      const needDelta = (right.needMatchScore ?? -1) - (left.needMatchScore ?? -1);
      if (needDelta !== 0) return needDelta;
      const fitDelta = (right.fit ?? -99) - (left.fit ?? -99);
      if (fitDelta !== 0) return fitDelta;
    }
    if (mode === "fit") {
      const fitDelta = (right.fit ?? -99) - (left.fit ?? -99);
      if (fitDelta !== 0) return fitDelta;
      const valueDelta = (right.marketValueSalaryRatio ?? 0) - (left.marketValueSalaryRatio ?? 0);
      if (valueDelta !== 0) return valueDelta;
    }
    if (mode === "value") {
      const valueDelta = (right.marketValueSalaryRatio ?? 0) - (left.marketValueSalaryRatio ?? 0);
      if (valueDelta !== 0) return valueDelta;
      const fitDelta = (right.fit ?? -99) - (left.fit ?? -99);
      if (fitDelta !== 0) return fitDelta;
    }
    if (mode === "cheap") {
      const marketDelta = (left.marketValue ?? Number.POSITIVE_INFINITY) - (right.marketValue ?? Number.POSITIVE_INFINITY);
      if (marketDelta !== 0) return marketDelta;
    }
    if (mode === "potential") {
      const premiumDelta = (right.marketValuePotentialPremiumPct ?? 0) - (left.marketValuePotentialPremiumPct ?? 0);
      if (premiumDelta !== 0) return premiumDelta;
      const confidenceDelta = (right.scoutingConfidence ?? 0) - (left.scoutingConfidence ?? 0);
      if (confidenceDelta !== 0) return confidenceDelta;
    }
    if (mode === "salary") {
      const salaryDelta = (left.salary ?? Number.POSITIVE_INFINITY) - (right.salary ?? Number.POSITIVE_INFINITY);
      if (salaryDelta !== 0) return salaryDelta;
    }

    const ovrDelta = (right.ovr ?? 0) - (left.ovr ?? 0);
    if (ovrDelta !== 0) return ovrDelta;
    return left.name.localeCompare(right.name, "de", { numeric: true, sensitivity: "base" });
  });

  return rows;
}

function buildTeamSelectOptions(teams: Team[]) {
  return [...teams].sort((left, right) => left.name.localeCompare(right.name, "de"));
}

function MarketAxisBar({
  axis,
  value,
}: {
  axis: keyof typeof AXIS_META;
  value: number | null | undefined;
}) {
  const meta = AXIS_META[axis];
  return (
    <div className={`market-v2-axis-bar ${meta.className}`}>
      <span className="market-v2-axis-label">{meta.label}</span>
      <span className="market-v2-axis-track">
        <span className="market-v2-axis-fill" style={{ width: `${getAxisBarWidth(value)}%` }} />
      </span>
      <strong>{formatCompactNumber(value, 0)}</strong>
    </div>
  );
}

export default function TransfermarktV2Client({
  defaultSaveId,
  defaultSeasonId,
  bootstrapReady = true,
  defaultTeamId = null,
  source = "sqlite",
  activeOwnerId = null,
  manageableTeamIds = [],
  teamControlModesByTeamId = {},
  teamControlOwnersByTeamId = {},
  teams,
  disciplines = [],
  rosterRows = [],
  wishlistEntries = [],
  wishlistPlayerIds = [],
  boardObjectiveHighlights = [],
  onOpenPlayerDetails,
  onOpenHistory,
  onOpenClassicMarket,
  onToggleWishlist,
  onRemoveWishlist,
  scoutingWatchPlayerIds = [],
  scoutingIntelByPlayerId = {},
  scoutingPipelineCapacity = null,
  onToggleScoutingWatch,
  onBuyCompleted,
  initialPlayerId = null,
  onInitialPlayerFocusConsumed = null,
  onSell,
}: TransfermarktV2ClientProps) {
  const roomContextRef = useRef(readFoundationRoomContextFromLocation());
  const marketCacheRef = useRef(
    new Map<
      string,
      {
        items: TransfermarktFreeAgentItem[];
        feed: MarketFeedResponse | null;
        total: number;
        hasMore: boolean;
      }
    >(),
  );
  const marketAbortRef = useRef<AbortController | null>(null);
  const historyAbortRef = useRef<AbortController | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewVersionRef = useRef(0);
  const candidateButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const shouldFocusSelectedCandidateRef = useRef(false);
  const wishlistClickTimerRef = useRef<number | null>(null);
  const buyModalRef = useRef<HTMLDivElement | null>(null);
  const buyModalBodyRef = useRef<HTMLDivElement | null>(null);

  const teamOptions = useMemo(() => buildTeamSelectOptions(teams), [teams]);
  const effectiveOwnerId = activeOwnerId || DEFAULT_ACTIVE_OWNER_ID;
  const manageableTeamIdSet = useMemo(() => {
    const ids = new Set(manageableTeamIds);
    Object.entries(teamControlModesByTeamId).forEach(([teamId, mode]) => {
      if (mode !== "manual") {
        return;
      }
      const owner = teamControlOwnersByTeamId[teamId] ?? null;
      const resolvedOwnerId =
        owner?.ownerSlot === "user"
          ? DEFAULT_ACTIVE_OWNER_ID
          : owner?.ownerId?.trim() || null;
      if (owner?.ownerSlot === "user" || resolvedOwnerId === effectiveOwnerId) {
        ids.add(teamId);
      }
    });
    return ids;
  }, [effectiveOwnerId, manageableTeamIds, teamControlModesByTeamId, teamControlOwnersByTeamId]);
  const wishlistPlayerIdSet = useMemo(() => new Set(wishlistPlayerIds), [wishlistPlayerIds]);
  const scoutingWatchPlayerIdSet = useMemo(() => new Set(scoutingWatchPlayerIds), [scoutingWatchPlayerIds]);
  const selectedTeamId = defaultTeamId ?? "";
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sortMode, setSortMode] = useState<MarketSortMode>("potential");
  const [selectedAxes, setSelectedAxes] = useState<MarketAxisKey[]>([]);
  const [axisMinimums, setAxisMinimums] = useState<Record<MarketAxisKey, number>>({
    pow: 0,
    spe: 0,
    men: 0,
    soc: 0,
  });
  const [selectedClassNames, setSelectedClassNames] = useState<string[]>([]);
  const [selectedClassAxes, setSelectedClassAxes] = useState<MarketClassAxisFilter[]>([]);
  const [selectedRaceNames, setSelectedRaceNames] = useState<string[]>([]);
  const [maxValue, setMaxValue] = useState(DEFAULT_MAX_MARKET_VALUE);
  const [maxSalary, setMaxSalary] = useState(DEFAULT_MAX_SALARY);
  const [maxRatio, setMaxRatio] = useState(DEFAULT_MAX_RATIO);
  const [minFit, setMinFit] = useState(0);
  const [marketFeed, setMarketFeed] = useState<MarketFeedResponse | null>(null);
  const [marketItems, setMarketItems] = useState<TransfermarktFreeAgentItem[]>([]);
  const [marketBusy, setMarketBusy] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [marketHasMore, setMarketHasMore] = useState(false);
  const [marketTotal, setMarketTotal] = useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [renderedCandidateCount, setRenderedCandidateCount] = useState(MARKET_INITIAL_RENDER_COUNT);
  const [historyFeed, setHistoryFeed] = useState<MarketHistoryResponse | null>(null);
  const [contractLength, setContractLength] = useState<number | null>(null);
  const [contractShape, setContractShape] = useState<ContractShape | null>(null);
  const [offeredSalary, setOfferedSalary] = useState<number | null>(null);
  const [salaryEditedManually, setSalaryEditedManually] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [buyBusy, setBuyBusy] = useState(false);
  const [buySuccess, setBuySuccess] = useState<string | null>(null);
  const [buyPreview, setBuyPreview] = useState<TransfermarktBuyPreview | null>(null);
  const [buyPreviewRefreshNonce, setBuyPreviewRefreshNonce] = useState(0);
  const [buyNegotiationOutcome, setBuyNegotiationOutcome] = useState<MarketNegotiationOutcome | null>(null);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [buyModalWishlistEntry, setBuyModalWishlistEntry] = useState<TransferWishlistEntry | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [filterStorageReady, setFilterStorageReady] = useState(false);
  const [filterPresets, setFilterPresets] = useState<MarketFilterPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [filterPresetMessage, setFilterPresetMessage] = useState<string | null>(null);
  const [selectedDisciplineLens, setSelectedDisciplineLens] = useState<OfficialDisciplineWeightId | "">("");
  const [showRosterDisciplines, setShowRosterDisciplines] = useState(false);
  const [wishlistSort, setWishlistSort] = useState<WishlistSortState>({ key: "createdAt", direction: "desc" });

  useEffect(() => () => {
    if (wishlistClickTimerRef.current != null) {
      window.clearTimeout(wishlistClickTimerRef.current);
    }
  }, []);

  function applyMarketFilterSnapshot(snapshot: MarketFilterSnapshot) {
    setSearch(snapshot.search);
    setSortMode(snapshot.sortMode);
    setSelectedDisciplineLens(snapshot.selectedDisciplineLens);
    setSelectedAxes(snapshot.selectedAxes);
    setAxisMinimums(snapshot.axisMinimums);
    setSelectedClassNames(snapshot.selectedClassNames);
    setSelectedClassAxes(snapshot.selectedClassAxes);
    setSelectedRaceNames(snapshot.selectedRaceNames);
    setMaxValue(snapshot.maxValue);
    setMaxSalary(snapshot.maxSalary);
    setMaxRatio(snapshot.maxRatio);
    setMinFit(snapshot.minFit);
  }

  function resetMarketFilters() {
    applyMarketFilterSnapshot(createDefaultMarketFilterSnapshot());
    setFilterPresetMessage("Filter zurueckgesetzt.");
  }

  const currentFilterSnapshot = useMemo<MarketFilterSnapshot>(
    () => ({
      search,
      sortMode,
      selectedDisciplineLens,
      selectedAxes,
      axisMinimums,
      selectedClassNames,
      selectedClassAxes,
      selectedRaceNames,
      maxValue,
      maxSalary,
      maxRatio,
      minFit,
    }),
    [axisMinimums, maxRatio, maxSalary, maxValue, minFit, search, selectedAxes, selectedClassAxes, selectedClassNames, selectedDisciplineLens, selectedRaceNames, sortMode],
  );

  useEffect(() => {
    const stored = readMarketFilterStorage(defaultSaveId);
    if (stored.last) {
      applyMarketFilterSnapshot(stored.last);
    }
    setFilterPresets(stored.presets);
    setFilterStorageReady(true);
    setFilterPresetMessage(stored.last ? "Letzte Filter geladen." : null);
  }, [defaultSaveId]);

  useEffect(() => {
    if (!filterStorageReady) {
      return;
    }
    writeMarketFilterStorage(defaultSaveId, currentFilterSnapshot, filterPresets);
  }, [currentFilterSnapshot, defaultSaveId, filterPresets, filterStorageReady]);

  function saveCurrentFilterPreset() {
    const trimmedName = presetName.trim();
    if (!trimmedName) {
      setFilterPresetMessage("Bitte erst einen Namen eingeben.");
      return;
    }
    const now = new Date().toISOString();
    setFilterPresets((current) => {
      const existing = current.find((preset) => preset.name.toLowerCase() === trimmedName.toLowerCase());
      const nextPreset: MarketFilterPreset = {
        id: existing?.id ?? `preset-${now}-${Math.random().toString(36).slice(2, 8)}`,
        name: trimmedName.slice(0, 32),
        snapshot: currentFilterSnapshot,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      return [nextPreset, ...current.filter((preset) => preset.id !== nextPreset.id)].slice(0, 18);
    });
    setPresetName("");
    setFilterPresetMessage(`Filter "${trimmedName.slice(0, 32)}" gespeichert.`);
  }

  function loadFilterPreset(preset: MarketFilterPreset) {
    applyMarketFilterSnapshot(preset.snapshot);
    setFilterPresetMessage(`Filter "${preset.name}" geladen.`);
  }

  function deleteFilterPreset(presetId: string) {
    const preset = filterPresets.find((entry) => entry.id === presetId);
    setFilterPresets((current) => current.filter((entry) => entry.id !== presetId));
    setFilterPresetMessage(preset ? `Filter "${preset.name}" geloescht.` : "Filter geloescht.");
  }

  function toggleWishlistSort(key: WishlistSortKey) {
    setWishlistSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "playerName" || key === "className" ? "asc" : "desc" },
    );
  }

  const availableClassNames = useMemo(
    () =>
      Array.from(
        new Set([...MARKET_CLASS_OPTIONS, ...marketItems.map((item) => item.className).filter(Boolean)]),
      ).sort(sortClassNames),
    [marketItems],
  );
  const groupedClassNames = useMemo(
    () => [
      ...MARKET_AXIS_ORDER.map((axis) => ({
        axis,
        meta: AXIS_META[axis],
        classes: availableClassNames.filter((className) => CLASS_COLOR_TO_AXIS[getClassColorToken(className) ?? ""] === axis),
      })),
      {
        axis: null,
        meta: null,
        classes: availableClassNames.filter((className) => !CLASS_COLOR_TO_AXIS[getClassColorToken(className) ?? ""]),
      },
    ].filter((group) => group.classes.length > 0),
    [availableClassNames],
  );
  const availableRaceNames = useMemo(
    () =>
      Array.from(
        new Set(
          marketItems
            .map((item) => item.race)
            .filter((race): race is string => Boolean(race) && !HIDDEN_RACE_FILTER_VALUES.has(race.toLowerCase())),
        ),
      ).sort((left, right) => left.localeCompare(right, "de")),
    [marketItems],
  );
  const maxLoadedMarketValue = useMemo(() => {
    const maxLoaded = Math.max(
      0,
      ...marketItems.map((item) => (typeof item.marketValue === "number" && Number.isFinite(item.marketValue) ? item.marketValue : 0)),
    );
    return Math.ceil(maxLoaded + 1);
  }, [marketItems]);
  const valueSliderMax = Math.max(1, maxLoadedMarketValue);
  const effectiveMaxValue = maxValue > 0 ? Math.min(maxValue, valueSliderMax) : valueSliderMax;
  const maxLoadedSalary = useMemo(() => {
    const maxLoaded = Math.max(
      0,
      ...marketItems.map((item) => (typeof item.salary === "number" && Number.isFinite(item.salary) ? item.salary : 0)),
    );
    return Math.ceil(maxLoaded + 1);
  }, [marketItems]);
  const salarySliderMax = Math.max(1, maxLoadedSalary);
  const effectiveMaxSalary = maxSalary > 0 ? Math.min(maxSalary, salarySliderMax) : salarySliderMax;
  const maxLoadedRatio = useMemo(() => {
    const maxLoaded = Math.max(
      0,
      ...marketItems.map((item) =>
        typeof item.marketValueSalaryRatio === "number" && Number.isFinite(item.marketValueSalaryRatio) ? item.marketValueSalaryRatio : 0,
      ),
    );
    return Math.ceil(maxLoaded + 0.5);
  }, [marketItems]);
  const ratioSliderMax = Math.max(1, maxLoadedRatio);
  const effectiveMinRatio = maxRatio > 0 ? Math.min(maxRatio, ratioSliderMax) : 0;

  const visibleItems = useMemo(() => {
    const filtered = marketItems.filter((item) => {
      if (item.marketValue != null && item.marketValue > effectiveMaxValue) {
        return false;
      }
      if (item.salary != null && item.salary > effectiveMaxSalary) {
        return false;
      }
      if (item.marketValueSalaryRatio != null && item.marketValueSalaryRatio < effectiveMinRatio) {
        return false;
      }
      if ((item.fit ?? -99) < minFit) {
        return false;
      }
      if (selectedClassNames.length > 0 && !selectedClassNames.includes(item.className)) {
        return false;
      }
      if (selectedRaceNames.length > 0 && !selectedRaceNames.includes(item.race)) {
        return false;
      }
      if (selectedClassAxes.length > 0) {
        const classAxis = CLASS_COLOR_TO_AXIS[getClassColorToken(item.className) ?? ""];
        if (!classAxis || !selectedClassAxes.includes(classAxis)) {
          return false;
        }
      }
      if (selectedAxes.length > 0 && !selectedAxes.every((axis) => getAxisValue(item, axis) >= axisMinimums[axis])) {
        return false;
      }
      return true;
    });

    return sortCandidates(filtered, sortMode);
  }, [axisMinimums, effectiveMinRatio, effectiveMaxSalary, effectiveMaxValue, marketItems, minFit, selectedAxes, selectedClassAxes, selectedClassNames, selectedRaceNames, sortMode]);
  const selectedPlayer = useMemo(
    () =>
      visibleItems.find((item) => item.playerId === selectedPlayerId) ??
      marketItems.find((item) => item.playerId === selectedPlayerId) ??
      visibleItems[0] ??
      null,
    [marketItems, selectedPlayerId, visibleItems],
  );
  const selectedVisibleIndex = useMemo(
    () => (selectedPlayerId ? visibleItems.findIndex((item) => item.playerId === selectedPlayerId) : -1),
    [selectedPlayerId, visibleItems],
  );
  const effectiveRenderedCandidateCount = useMemo(() => {
    if (selectedVisibleIndex < 0) {
      return renderedCandidateCount;
    }
    return Math.max(renderedCandidateCount, selectedVisibleIndex + 8);
  }, [renderedCandidateCount, selectedVisibleIndex]);
  const renderedVisibleItems = useMemo(
    () => visibleItems.slice(0, Math.min(visibleItems.length, effectiveRenderedCandidateCount)),
    [effectiveRenderedCandidateCount, visibleItems],
  );
  const selectedPlayerWishlisted = Boolean(selectedPlayer && wishlistPlayerIdSet.has(selectedPlayer.playerId));
  const selectedPlayerScoutingWatched = Boolean(selectedPlayer && scoutingWatchPlayerIdSet.has(selectedPlayer.playerId));
  const selectedPlayerScoutCertainty =
    selectedPlayer && scoutingIntelByPlayerId[selectedPlayer.playerId] != null
      ? scoutingIntelByPlayerId[selectedPlayer.playerId]!
      : null;
  const scoutingPipelineFull = Boolean(
    scoutingPipelineCapacity &&
      scoutingPipelineCapacity.max > 0 &&
      scoutingPipelineCapacity.occupied >= scoutingPipelineCapacity.max &&
      !selectedPlayerScoutingWatched,
  );
  const scoutingWatchDisabledReason =
    scoutingPipelineCapacity?.max === 0
      ? "Scouting Office L0 — Facility upgraden, um Beobachtung zu aktivieren."
      : scoutingPipelineFull
        ? `Scouting Office voll (${scoutingPipelineCapacity?.occupied}/${scoutingPipelineCapacity?.max}) — Ziel entfernen oder Facility upgraden.`
        : null;
  const activeBoardObjectiveHighlights = useMemo(
    () => boardObjectiveHighlights.filter((objective) => objective.status === "open" || objective.status === "at_risk" || objective.status === "failed").slice(0, 3),
    [boardObjectiveHighlights],
  );

  const selectedTeam = useMemo(
    () => teamOptions.find((team) => team.teamId === selectedTeamId) ?? null,
    [selectedTeamId, teamOptions],
  );
  const orderedDisciplines = useMemo(
    () => {
      const categoryOrder: Record<string, number> = {
        power: 0,
        speed: 1,
        mental: 2,
        social: 3,
      };
      return [...disciplines].sort((left, right) => {
        const leftCategoryOrder = categoryOrder[left.category] ?? 99;
        const rightCategoryOrder = categoryOrder[right.category] ?? 99;
        if (leftCategoryOrder !== rightCategoryOrder) return leftCategoryOrder - rightCategoryOrder;
        const leftOrder = left.displayOrder ?? left.originalOrder ?? 0;
        const rightOrder = right.displayOrder ?? right.originalOrder ?? 0;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left.name.localeCompare(right.name, "de", { numeric: true, sensitivity: "base" });
      });
    },
    [disciplines],
  );
  const selectedRosterRows = useMemo(
    () =>
      rosterRows
        .filter((row) => row.teamId === selectedTeamId)
        .sort((left, right) => {
          const ppsDelta = (right.pps ?? Number.NEGATIVE_INFINITY) - (left.pps ?? Number.NEGATIVE_INFINITY);
          if (ppsDelta !== 0) return ppsDelta;
          const valueDelta = (right.marketValue ?? Number.NEGATIVE_INFINITY) - (left.marketValue ?? Number.NEGATIVE_INFINITY);
          if (valueDelta !== 0) return valueDelta;
          return left.name.localeCompare(right.name, "de", { numeric: true, sensitivity: "base" });
        }),
    [rosterRows, selectedTeamId],
  );
  const marketItemByPlayerId = useMemo(
    () => new Map(marketItems.map((item) => [item.playerId, item] as const)),
    [marketItems],
  );
  const selectedWishlistEntries = useMemo(() => {
    const rows = wishlistEntries
      .filter((entry) => entry.saveId === defaultSaveId && (!selectedTeamId || !entry.teamId || entry.teamId === selectedTeamId))
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    const directionFactor = wishlistSort.direction === "asc" ? 1 : -1;
    return rows.sort((left, right) => {
      const leftMarketItem = marketItemByPlayerId.get(left.playerId);
      const rightMarketItem = marketItemByPlayerId.get(right.playerId);
      const compareNumber = (a: number | null | undefined, b: number | null | undefined) => {
        const safeA = typeof a === "number" && Number.isFinite(a) ? a : Number.NEGATIVE_INFINITY;
        const safeB = typeof b === "number" && Number.isFinite(b) ? b : Number.NEGATIVE_INFINITY;
        return (safeA - safeB) * directionFactor;
      };
      const compareText = (a: string | null | undefined, b: string | null | undefined) =>
        (a ?? "").localeCompare(b ?? "", "de", { numeric: true, sensitivity: "base" }) * directionFactor;
      let delta = 0;
      switch (wishlistSort.key) {
        case "playerName":
          delta = compareText(left.playerName, right.playerName);
          break;
        case "className":
          delta = compareText(left.className, right.className);
          break;
        case "marketValue":
          delta = compareNumber(left.marketValue, right.marketValue);
          break;
        case "salary":
          delta = compareNumber(left.salary, right.salary);
          break;
        case "bracket":
          delta = compareNumber(left.bracket, right.bracket);
          break;
        case "pow":
        case "spe":
        case "men":
        case "soc":
          delta = compareNumber(
            getWishlistAxisValue(left, leftMarketItem, wishlistSort.key),
            getWishlistAxisValue(right, rightMarketItem, wishlistSort.key),
          );
          break;
        case "createdAt":
        default:
          delta = compareNumber(Date.parse(left.createdAt), Date.parse(right.createdAt));
          break;
      }
      if (delta !== 0) return delta;
      return left.playerName.localeCompare(right.playerName, "de", { numeric: true, sensitivity: "base" });
    });
  }, [defaultSaveId, marketItemByPlayerId, selectedTeamId, wishlistEntries, wishlistSort]);
  const selectedTeamCanManage = Boolean(selectedTeamId && manageableTeamIdSet.has(selectedTeamId));
  const selectedTeamLockedReason = selectedTeamId && !selectedTeamCanManage
    ? `${selectedTeam?.name ?? "Dieses Team"} gehoert nicht zu deinen steuerbaren Teams. Du kannst scouten, aber keine Deals abschliessen.`
    : null;
  const selectedTeamReadOnlyReason =
    selectedTeamLockedReason ??
    (source !== "sqlite" ? "Referenzmodus: Du kannst scouten und simulieren, aber keinen Deal final schreiben." : null);

  function scrollBuyModalToTop() {
    window.scrollTo({ top: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    buyModalRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    buyModalRef.current?.scrollTo({ top: 0, behavior: "auto" });
    buyModalBodyRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }

  async function persistNegotiationOutcome(
    summary: TransfermarktBuyPreview | null,
    status: "ready_for_review" | "countered" | "accepted_pending_confirm" | "rejected_bad_experience",
    extraWarnings: string[] = [],
  ) {
    if (source !== "sqlite" || !defaultSaveId || !summary?.player?.id || !summary.team?.id) {
      return;
    }

    try {
      await fetch(
        `/api/singleplayer-state?${new URLSearchParams({
          source,
        }).toString()}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "contract-negotiation-outcome",
            saveId: defaultSaveId,
            summary,
            status,
            extraWarnings,
          }),
        },
      );
    } catch {
      // Keep the UI responsive even if the persistence note fails.
    }
  }

  function withWriteContext<T extends Record<string, unknown>>(body: T) {
    const teamId = typeof body.teamId === "string" ? body.teamId : selectedTeamId;
    const teamOwner = teamId ? teamControlOwnersByTeamId[teamId] ?? null : null;
    const resolvedOwnerId =
      teamOwner?.ownerSlot === "user"
        ? DEFAULT_ACTIVE_OWNER_ID
        : teamOwner?.ownerId?.trim() || effectiveOwnerId || DEFAULT_ACTIVE_OWNER_ID;
    return withRoomContextBody(
      {
        ...body,
        activeManagerTeamId: teamId ?? selectedTeamId,
        activeOwnerId: resolvedOwnerId,
        controlMode: teamControlModesByTeamId[teamId] ?? null,
      },
      roomContextRef.current,
    );
  }

  const marketContext = marketFeed?.teamContext ?? null;
  const teamAvailableTotal = marketFeed?.teamAvailableTotal ?? marketTotal;
  const availabilityLabel = formatCandidateAvailabilityLabel(selectedTeam?.shortCode ?? null, teamAvailableTotal);
  const rosterTarget = marketContext?.playerOpt ?? selectedTeam?.rosterLimit ?? null;
  const rosterGap = marketContext?.rosterGap ?? null;
  const rosterGapOpenCount =
    marketContext?.rosterCount != null && rosterTarget != null
      ? Math.max(0, Math.round(rosterTarget - marketContext.rosterCount))
      : rosterGap != null
        ? Math.max(0, Math.round(rosterGap))
        : null;
  const wishlistAxes = marketContext?.wishlistAxes ?? [];
  const wishlistDisciplines = marketContext?.wishlistDisciplines ?? [];
  const axisComparisonRows = useMemo(
    () =>
      MARKET_AXIS_ORDER.map((axis) => {
        const rosterValue = marketContext?.axisAverages?.[axis];
        const candidateValue = selectedPlayer?.[axis];
        const safeRosterValue = typeof rosterValue === "number" && Number.isFinite(rosterValue) ? rosterValue : null;
        const safeCandidateValue = typeof candidateValue === "number" && Number.isFinite(candidateValue) ? candidateValue : null;
        const delta = safeRosterValue != null && safeCandidateValue != null ? safeCandidateValue - safeRosterValue : null;
        const isNeedAxis = wishlistAxes.includes(axis) || Boolean(selectedPlayer?.needMatchAxes?.includes(axis));
        return {
          axis,
          rosterValue: safeRosterValue,
          candidateValue: safeCandidateValue,
          delta,
          isNeedAxis,
          toneClass: getAxisComparisonTone(delta, isNeedAxis),
        };
      }),
    [marketContext?.axisAverages, selectedPlayer, wishlistAxes],
  );
  const selectedPortrait = selectedPlayer ? getTransfermarktPortraitModel(selectedPlayer) : null;
  const fitSignal = selectedPlayer ? getFitSignal(selectedPlayer) : null;
  const growthSignal = selectedPlayer ? getGrowthSignal(selectedPlayer) : null;
  const selectedScoutingLevel = normalizeTransfermarktScoutingLevel(selectedPlayer?.scoutingLevel ?? 0);
  const selectedAttributeRows = useMemo(
    () =>
      selectedPlayer
        ? buildTransfermarktScoutedAttributeRows({
            values: selectedPlayer.attributeStatValues ?? null,
            ratings: getItemAttributeRatings(selectedPlayer),
            scoutingLevel: selectedScoutingLevel,
            saveId: defaultSaveId,
            playerId: selectedPlayer.playerId,
          })
        : [],
    [defaultSaveId, selectedPlayer, selectedScoutingLevel],
  );
  const orderedAttributeRows = useMemo(() => {
    const rowsByKey = new Map(selectedAttributeRows.map((entry) => [entry.key, entry] as const));
    return MARKET_ATTRIBUTE_GRID_ORDER.map((key) => rowsByKey.get(key)).filter((entry): entry is TransfermarktScoutedAttributeRow => Boolean(entry));
  }, [selectedAttributeRows]);
  const selectedTrainingImpact = selectedPlayer ? getClassTrainingImpact(selectedPlayer.className) : null;
  const scoutingDisclosure = getTransfermarktScoutingDisclosure(selectedScoutingLevel);
  const scoutingVisibility = getTransfermarktScoutingVisibilityBuckets(selectedScoutingLevel);
  const trainingVisibility = getTransfermarktTrainingAffinityVisibility(selectedScoutingLevel);
  const scoutingProfileTooltip = [
    `Grundwissen: ${scoutingVisibility.knowledge.join(" · ")}`,
    `Scouting L${selectedScoutingLevel}: ${scoutingDisclosure.positiveTraitsVisible} positive Traits sichtbar${
      scoutingDisclosure.negativeTraitsVisible ? " · negative Traits sichtbar" : " · negative Traits noch verdeckt"
    }${scoutingVisibility.scouted.length > 0 ? ` · ${scoutingVisibility.scouted.join(" · ")}` : ""}`,
    scoutingVisibility.hidden.length > 0 ? `Noch verdeckt: ${scoutingVisibility.hidden.join(" · ")}` : null,
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join("\n");
  const visibleTrainingPositive = selectedTrainingImpact?.positive.slice(0, trainingVisibility.positiveVisible) ?? [];
  const hiddenTrainingPositive = Math.max(0, (selectedTrainingImpact?.positive.length ?? 0) - visibleTrainingPositive.length);
  const visibleTrainingNegative = selectedTrainingImpact?.negative.slice(0, trainingVisibility.negativeVisible) ?? [];
  const hiddenTrainingNegative = Math.max(0, (selectedTrainingImpact?.negative.length ?? 0) - visibleTrainingNegative.length);
  const effectiveOfferedSalary = salaryEditedManually ? offeredSalary : null;
  const previewPlayerId = selectedPlayer?.playerId ?? (buyModalOpen ? buyModalWishlistEntry?.playerId ?? null : null);
  const contractPreference = buyPreview?.contractPreference ?? null;
  const activeContractLength = contractLength ?? buyPreview?.contractLength ?? contractPreference?.idealLength ?? 1;
  const activeContractShape = contractShape ?? buyPreview?.contractShape ?? contractPreference?.shapePreference ?? "balanced";
  const contractSalaryAdjustmentPct = contractPreference?.salaryAdjustmentPct ?? null;
  const contractScoreAdjustment = contractPreference?.scoreAdjustment ?? null;
  const fitSalaryDiscountActive = (buyPreview?.teamFit ?? selectedPlayer?.fit ?? null) != null
    ? Number(buyPreview?.teamFit ?? selectedPlayer?.fit) >= 25
    : false;
  const contractLengthOutsidePreference = contractPreference
    ? activeContractLength < contractPreference.preferredMinLength || activeContractLength > contractPreference.preferredMaxLength
    : false;
  const contractShapeMismatch = contractPreference
    ? activeContractShape !== contractPreference.shapePreference
    : false;
  const contractPressureTone =
    (contractSalaryAdjustmentPct ?? 0) > 0 || (contractScoreAdjustment ?? 0) < 0
      ? "negative"
      : (contractSalaryAdjustmentPct ?? 0) < 0 || (contractScoreAdjustment ?? 0) > 0
        ? "positive"
        : "neutral";
  const marketAndFitDelta =
    buyPreview?.expectedSalary != null && buyPreview.baseExpectedSalary != null
      ? buyPreview.expectedSalary - buyPreview.baseExpectedSalary
      : null;

  function setCandidateButtonRef(playerId: string, node: HTMLButtonElement | null) {
    if (node) {
      candidateButtonRefs.current.set(playerId, node);
      return;
    }
    candidateButtonRefs.current.delete(playerId);
  }

  function selectCandidateFromKeyboard(playerId: string) {
    shouldFocusSelectedCandidateRef.current = true;
    setSelectedPlayerId(playerId);
  }

  async function ensureWishlistCandidateVisible(playerId: string, playerName: string) {
    if (marketItems.some((item) => item.playerId === playerId)) {
      return true;
    }

    try {
      const params = appendRoomContextToParams(new URLSearchParams({
        saveId: defaultSaveId,
        seasonId: defaultSeasonId,
        source,
        teamId: selectedTeamId,
        limit: "25",
        offset: "0",
        search: playerName,
      }), roomContextRef.current);
      const response = await fetch(`/api/transfermarkt/free-agents?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as MarketFeedResponse;
      if (!response.ok || payload.error) {
        return false;
      }
      const focusedItem = payload.items.find((item) => item.playerId === playerId);
      if (!focusedItem) {
        return false;
      }
      setMarketItems((current) => {
        if (current.some((item) => item.playerId === playerId)) {
          return current;
        }
        return [focusedItem, ...current];
      });
      return true;
    } catch {
      // ignore focused preload miss and keep normal search-driven reload path
      return false;
    }
  }

  async function focusWishlistEntry(entry: TransferWishlistEntry, options?: { openDeal?: boolean }) {
    setSelectedPlayerId(entry.playerId);
    if (options?.openDeal) {
      if (!selectedTeamId) {
        setPreviewError("Bitte erst ein Team wählen.");
        return;
      }
      if (!selectedTeamCanManage) {
        setPreviewError(selectedTeamLockedReason ?? "Dieses Team ist nur zum Ansehen freigegeben.");
        return;
      }
      setBuySuccess(null);
      setPreviewError(null);
      setBuyPreview(null);
      setBuyNegotiationOutcome(null);
      setContractLength(null);
      setContractShape(null);
      setOfferedSalary(null);
      setSalaryEditedManually(false);
      setBuyModalWishlistEntry(entry);
      setBuyModalOpen(true);
      setBuyPreviewRefreshNonce((current) => current + 1);
      void ensureWishlistCandidateVisible(entry.playerId, entry.playerName);
      return;
    }

    shouldFocusSelectedCandidateRef.current = true;
    setBuyModalWishlistEntry(null);
    setSearch(entry.playerName);
    setSelectedAxes([]);
    setAxisMinimums({ pow: 0, spe: 0, men: 0, soc: 0 });
    setSelectedClassNames([]);
    setSelectedClassAxes([]);
    setSelectedRaceNames([]);
    setMaxValue(0);
    setMaxSalary(0);
    setMaxRatio(0);
    setMinFit(0);
    await ensureWishlistCandidateVisible(entry.playerId, entry.playerName);
  }

  function clearWishlistClickTimer() {
    if (wishlistClickTimerRef.current == null) {
      return;
    }
    window.clearTimeout(wishlistClickTimerRef.current);
    wishlistClickTimerRef.current = null;
  }

  function queueWishlistFocus(entry: TransferWishlistEntry) {
    clearWishlistClickTimer();
    wishlistClickTimerRef.current = window.setTimeout(() => {
      wishlistClickTimerRef.current = null;
      void focusWishlistEntry(entry);
    }, 180);
  }

  function openWishlistDeal(entry: TransferWishlistEntry) {
    clearWishlistClickTimer();
    void focusWishlistEntry(entry, { openDeal: true });
  }

  function handleCandidateKeyDown(event: KeyboardEvent<HTMLButtonElement>, playerId: string) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }
    if (!visibleItems.length) {
      return;
    }
    event.preventDefault();

    const currentIndex = visibleItems.findIndex((item) => item.playerId === playerId);
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
    const targetIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? visibleItems.length - 1
          : Math.min(
              Math.max(fallbackIndex + (event.key === "ArrowDown" ? 1 : -1), 0),
              visibleItems.length - 1,
            );
    selectCandidateFromKeyboard(visibleItems[targetIndex].playerId);
  }

  useEffect(() => {
    setRenderedCandidateCount(MARKET_INITIAL_RENDER_COUNT);
  }, [selectedTeamId, deferredSearch, sortMode, minFit, maxValue, maxSalary, maxRatio, selectedDisciplineLens, selectedClassNames, selectedClassAxes, selectedRaceNames, selectedAxes, axisMinimums]);

  useEffect(() => {
    if (visibleItems.length <= renderedCandidateCount) {
      return;
    }
    const handle = window.setTimeout(() => {
      setRenderedCandidateCount((current) => Math.min(visibleItems.length, current + MARKET_RENDER_STEP));
    }, 90);
    return () => window.clearTimeout(handle);
  }, [renderedCandidateCount, visibleItems.length]);

  useEffect(() => {
    if (selectedVisibleIndex < 0) {
      return;
    }
    if (selectedVisibleIndex < renderedCandidateCount) {
      return;
    }
    setRenderedCandidateCount(Math.min(visibleItems.length, selectedVisibleIndex + MARKET_RENDER_STEP));
  }, [renderedCandidateCount, selectedVisibleIndex, visibleItems.length]);

  useEffect(() => {
    if (!visibleItems.length) {
      if (
        !selectedPlayerId ||
        (!marketItems.some((item) => item.playerId === selectedPlayerId) &&
          !selectedWishlistEntries.some((entry) => entry.playerId === selectedPlayerId))
      ) {
        setSelectedPlayerId(null);
      }
      return;
    }
    if (
      !selectedPlayerId ||
      (
        !visibleItems.some((item) => item.playerId === selectedPlayerId) &&
        !marketItems.some((item) => item.playerId === selectedPlayerId) &&
        !selectedWishlistEntries.some((entry) => entry.playerId === selectedPlayerId)
      )
    ) {
      setSelectedPlayerId(visibleItems[0]?.playerId ?? null);
    }
  }, [marketItems, selectedPlayerId, selectedWishlistEntries, visibleItems]);

  useEffect(() => {
    if (!selectedPlayerId || !shouldFocusSelectedCandidateRef.current) {
      return;
    }
    const button = candidateButtonRefs.current.get(selectedPlayerId);
    if (!button) {
      return;
    }
    button.focus({ preventScroll: true });
    button.scrollIntoView({ block: "nearest" });
    shouldFocusSelectedCandidateRef.current = false;
  }, [selectedPlayerId, visibleItems]);

  useEffect(() => {
    setContractLength(null);
    setContractShape(null);
    setOfferedSalary(null);
    setSalaryEditedManually(false);
  }, [selectedPlayerId, selectedTeamId]);

  useEffect(() => {
    if (!initialPlayerId || marketBusy) {
      return;
    }
    const hasCandidate = marketItems.some((item) => item.playerId === initialPlayerId);
    if (!hasCandidate && marketItems.length === 0) {
      return;
    }
    setSelectedPlayerId(initialPlayerId);
    shouldFocusSelectedCandidateRef.current = true;
    onInitialPlayerFocusConsumed?.();
  }, [initialPlayerId, marketBusy, marketItems, onInitialPlayerFocusConsumed]);

  useEffect(() => {
    if (!buyModalOpen) {
      return;
    }
    scrollBuyModalToTop();
    const frame = window.requestAnimationFrame(() => {
      scrollBuyModalToTop();
      window.requestAnimationFrame(scrollBuyModalToTop);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [buyModalOpen, buyNegotiationOutcome?.status]);

  useEffect(() => {
    if (!bootstrapReady || defaultSeasonId === "loading" || !defaultSaveId) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    marketAbortRef.current?.abort();
    marketAbortRef.current = controller;
    const marketCacheKey = `${defaultSaveId}:${defaultSeasonId}:${deferredSearch.trim()}`;
    const cachedMarket = marketCacheRef.current.get(marketCacheKey);
    if (cachedMarket) {
      setMarketFeed(cachedMarket.feed);
      setMarketItems(cachedMarket.items);
      setMarketTotal(cachedMarket.total);
      setMarketHasMore(cachedMarket.hasMore);
      setMarketBusy(false);
      setMarketError(null);
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    async function loadFullMarketInPages() {
      setMarketBusy(true);
      setMarketError(null);
      setBuySuccess(null);
      setMarketItems([]);
      setMarketHasMore(false);
      try {
        const mergedItems: TransfermarktFreeAgentItem[] = [];
        const seen = new Set<string>();
        let latestPayload: MarketFeedResponse | null = null;
        let publishedCount = 0;
        let nextOffset = 0;
        let hasMore = true;

        while (hasMore) {
          const params = appendRoomContextToParams(new URLSearchParams({
            saveId: defaultSaveId,
            seasonId: defaultSeasonId,
            source,
            teamId: selectedTeamId,
            limit: String(MARKET_PAGE_LIMIT),
            offset: String(nextOffset),
            ...(deferredSearch.trim() ? { search: deferredSearch.trim() } : {}),
          }), roomContextRef.current);
          const response = await fetch(`/api/transfermarkt/free-agents?${params.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const payload = (await response.json()) as MarketFeedResponse;
          if (cancelled || controller.signal.aborted) {
            return;
          }
          if (!response.ok || payload.error) {
            setMarketFeed(payload);
            setMarketItems([]);
            setMarketTotal(0);
            setMarketHasMore(false);
            setMarketError(payload.error ?? "Transfermarkt konnte nicht geladen werden.");
            return;
          }

          payload.items.forEach((item) => {
            if (!seen.has(item.playerId)) {
              mergedItems.push(item);
              seen.add(item.playerId);
            }
          });
          latestPayload = payload;
          nextOffset += payload.returned;
          hasMore = Boolean(payload.hasMore && payload.returned > 0);

          const shouldPublish =
            mergedItems.length <= MARKET_PAGE_LIMIT ||
            !hasMore ||
            mergedItems.length - publishedCount >= MARKET_BATCH_PUBLISH_SIZE;

          if (shouldPublish) {
            setMarketFeed({
              ...payload,
              items: mergedItems,
              offset: 0,
              returned: mergedItems.length,
              hasMore,
            });
            setMarketItems([...mergedItems]);
            setMarketTotal(payload.total);
            setMarketHasMore(hasMore);
            publishedCount = mergedItems.length;
          }

          if (hasMore) {
            await new Promise((resolve) => window.setTimeout(resolve, 0));
          }
        }

        if (!latestPayload) {
          setMarketFeed(null);
          setMarketItems([]);
          setMarketTotal(0);
          setMarketHasMore(false);
        } else {
          marketCacheRef.current.set(marketCacheKey, {
            items: [...mergedItems],
            feed: {
              ...latestPayload,
              items: mergedItems,
              offset: 0,
              returned: mergedItems.length,
              hasMore: false,
            },
            total: latestPayload.total,
            hasMore: false,
          });
        }
      } catch (error) {
        if (cancelled || controller.signal.aborted || isAbortError(error)) {
          return;
        }
        setMarketFeed(null);
        setMarketItems([]);
        setMarketTotal(0);
        setMarketHasMore(false);
        setMarketError("Transfermarkt konnte nicht geladen werden.");
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setMarketBusy(false);
        }
      }
    }

    void loadFullMarketInPages();

    return () => {
      cancelled = true;
      controller.abort();
      if (marketAbortRef.current === controller) {
        marketAbortRef.current = null;
      }
    };
  }, [bootstrapReady, defaultSaveId, defaultSeasonId, deferredSearch, reloadToken, source]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    historyAbortRef.current?.abort();
    historyAbortRef.current = controller;

    async function loadHistory() {
      try {
        const params = appendRoomContextToParams(new URLSearchParams({
          saveId: defaultSaveId,
          seasonId: defaultSeasonId,
          source,
          limit: "8",
          ...(selectedTeamId ? { teamId: selectedTeamId } : {}),
        }), roomContextRef.current);
        const response = await fetch(`/api/transfermarkt/history?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as MarketHistoryResponse;
        if (!cancelled && !controller.signal.aborted) {
          setHistoryFeed(response.ok ? payload : null);
        }
      } catch (error) {
        if (cancelled || controller.signal.aborted || isAbortError(error)) {
          return;
        }
        setHistoryFeed(null);
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
      controller.abort();
      if (historyAbortRef.current === controller) {
        historyAbortRef.current = null;
      }
    };
  }, [defaultSaveId, defaultSeasonId, reloadToken, selectedTeamId, source]);

  useEffect(() => {
    if (!previewPlayerId || !selectedTeamId) {
      setBuyPreview(null);
      setPreviewError(null);
      setPreviewBusy(false);
      return;
    }
    if (!selectedTeamCanManage) {
      setBuyPreview(null);
      setPreviewError(selectedTeamLockedReason ?? "Dieses Team ist nur zum Ansehen freigegeben.");
      setPreviewBusy(false);
      return;
    }

    let cancelled = false;
    const requestVersion = ++previewVersionRef.current;
    const controller = new AbortController();
    previewAbortRef.current?.abort();
    previewAbortRef.current = controller;
    setPreviewBusy(true);
    setPreviewError(null);

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/transfermarkt/buy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(withWriteContext({
            saveId: defaultSaveId,
            seasonId: defaultSeasonId,
            teamId: selectedTeamId,
            playerId: previewPlayerId,
            ...(contractLength != null ? { contractLength } : {}),
            ...(contractShape != null ? { contractShape } : {}),
            ...(effectiveOfferedSalary != null ? { offeredSalary: effectiveOfferedSalary } : {}),
            dryRun: true,
            source,
          })),
          signal: controller.signal,
        });
        const payload = (await response.json()) as MarketBuyResponse;
        if (cancelled || controller.signal.aborted || requestVersion !== previewVersionRef.current) {
          return;
        }
        setBuyPreview(payload.summary ?? null);
        if (payload.summary?.offeredSalary != null && !salaryEditedManually) {
          setOfferedSalary(payload.summary.offeredSalary);
        }
        if ((!response.ok || payload.error) && !payload.summary) {
          setPreviewError(payload.error ?? "Vorschau konnte nicht geladen werden.");
          return;
        }
        setPreviewError(null);
      } catch (error) {
        if (cancelled || controller.signal.aborted || isAbortError(error)) {
          return;
        }
        setBuyPreview(null);
        setPreviewError("Vorschau konnte nicht geladen werden.");
      } finally {
        if (!cancelled && !controller.signal.aborted && requestVersion === previewVersionRef.current) {
          setPreviewBusy(false);
        }
      }
    }, salaryEditedManually ? 90 : 40);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
      if (previewAbortRef.current === controller) {
        previewAbortRef.current = null;
      }
    };
  }, [
    buyPreviewRefreshNonce,
    buyModalWishlistEntry,
    previewPlayerId,
    contractLength,
    contractShape,
    defaultSaveId,
    defaultSeasonId,
    effectiveOfferedSalary,
    salaryEditedManually,
    selectedPlayer,
    selectedTeamCanManage,
    selectedTeamId,
    selectedTeamLockedReason,
    source,
  ]);

  async function confirmBuy() {
    if (!selectedPlayer || !selectedTeamId) {
      return;
    }
    if (source !== "sqlite") {
      setPreviewError("Referenzmodus: Der Deal kann hier nicht final geschrieben werden.");
      return;
    }
    if (!selectedTeamCanManage) {
      setPreviewError(selectedTeamLockedReason ?? "Dieses Team ist nur zum Ansehen freigegeben.");
      return;
    }
    setBuyBusy(true);
    setBuySuccess(null);
    setPreviewError(null);
    try {
      const response = await fetch("/api/transfermarkt/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withWriteContext({
          saveId: defaultSaveId,
          seasonId: defaultSeasonId,
          teamId: selectedTeamId,
          playerId: selectedPlayer.playerId,
          ...(contractLength != null ? { contractLength } : {}),
          ...(contractShape != null ? { contractShape } : {}),
          ...(effectiveOfferedSalary != null ? { offeredSalary: effectiveOfferedSalary } : {}),
          dryRun: false,
          source,
        })),
      });
      const payload = (await response.json()) as MarketBuyResponse;
      if (!response.ok || payload.error || !payload.summary?.canBuy) {
        setPreviewError(payload.error ?? payload.summary?.blockingReasons?.[0] ?? "Kauf konnte nicht bestätigt werden.");
        return;
      }
      setBuyPreview(payload.summary);
      setBuySuccess(
        `${payload.summary.player?.name ?? "Spieler"} fix fuer ${selectedTeam?.shortCode ?? "dein Team"}: ${formatTransfermarktCurrency(payload.summary.purchasePrice)} Abloese, ${formatTransfermarktCurrency(payload.summary.salary)} Gehalt p.a., ${payload.summary.contractLength} Saison${payload.summary.contractLength === 1 ? "" : "en"}.`,
      );
      setBuyModalOpen(false);
      setBuyNegotiationOutcome(null);
      await onBuyCompleted?.(selectedTeamId);
      setOfferedSalary(null);
      setSalaryEditedManually(false);
      setMarketHasMore(false);
      setSelectedPlayerId(null);
      setMarketFeed(null);
      setHistoryFeed(null);
      setMarketItems([]);
      setReloadToken((current) => current + 1);
    } catch {
      setPreviewError("Kauf konnte nicht bestätigt werden.");
    } finally {
      setBuyBusy(false);
    }
  }

  async function negotiateBuy() {
    if (!buyPreview?.player?.id || !buyPreview.team?.id || buyBusy) {
      return;
    }

    const acceptChance = buyPreview.acceptChance ?? 0;
    const counterChance = buyPreview.counterChance ?? 0;
    const rejectChance = buyPreview.rejectChance ?? 0;
    const expectedSalary = buyPreview.expectedSalary ?? buyPreview.salary ?? null;
    const activeSalaryOffer = effectiveOfferedSalary ?? buyPreview.offeredSalary ?? expectedSalary;

    if (rejectChance >= acceptChance && rejectChance >= counterChance) {
      void persistNegotiationOutcome(
        buyPreview,
        "rejected_bad_experience",
        ["negotiation_rejected_bad_experience"],
      );
      setBuyNegotiationOutcome({
        status: "rejected",
        tone: "error",
        title: "Angebot abgelehnt",
        message: `${buyPreview.player.name} lehnt dieses Angebot aktuell ab. Heb das Gehalt an oder passe den Vertrag an, dann kannst du neu verhandeln.`,
      });
      window.requestAnimationFrame(() => {
        scrollBuyModalToTop();
      });
      return;
    }

    if (counterChance > acceptChance) {
      const counterSalary =
        expectedSalary != null
          ? Number(Math.max(expectedSalary * 1.04, (activeSalaryOffer ?? expectedSalary) * 1.08).toFixed(2))
          : activeSalaryOffer ?? null;
      const counterDelta =
        counterSalary != null && activeSalaryOffer != null
          ? Number((counterSalary - activeSalaryOffer).toFixed(2))
          : null;
      void persistNegotiationOutcome(buyPreview, "countered");
      setOfferedSalary(counterSalary);
      setSalaryEditedManually(true);
      setBuyNegotiationOutcome({
        status: "countered",
        tone: "warning",
        title: "Gegenseite verhandelt nach",
        message: `${buyPreview.player.name} will weitermachen, aber eher ${formatTransfermarktCurrency(counterSalary)} pro Season${counterDelta != null ? ` (${counterDelta > 0 ? "+" : ""}${formatTransfermarktCurrency(counterDelta)} gegenueber deinem Angebot)` : ""}. Das Angebot wurde direkt auf den neuen Rahmen gesetzt.`,
        counterSalary,
      });
      window.requestAnimationFrame(() => {
        scrollBuyModalToTop();
      });
      return;
    }

    void persistNegotiationOutcome(buyPreview, "accepted_pending_confirm");
    setBuyNegotiationOutcome({
      status: "accepted",
      tone: "success",
      title: "Angebot angenommen",
      message: `${buyPreview.player.name} akzeptiert den Rahmen. Du kannst den Kauf jetzt final abschließen.`,
    });
    window.requestAnimationFrame(() => {
      scrollBuyModalToTop();
    });
  }

  function openBuyModal() {
    if (!selectedPlayer || !selectedTeamId) {
      return;
    }
    if (!selectedTeamCanManage) {
      setPreviewError(selectedTeamLockedReason ?? "Dieses Team ist nur zum Ansehen freigegeben.");
      return;
    }
    setBuySuccess(null);
    setBuyNegotiationOutcome(null);
    setBuyPreview(null);
    setContractLength(null);
    setContractShape(null);
    setOfferedSalary(null);
    setSalaryEditedManually(false);
    setBuyModalWishlistEntry(null);
    setBuyModalOpen(true);
    setBuyPreviewRefreshNonce((current) => current + 1);
  }

  function resetBuyDemandFrame() {
    setBuyNegotiationOutcome(null);
    setContractLength(null);
    setContractShape(null);
    setOfferedSalary(null);
    setSalaryEditedManually(false);
    setBuyPreviewRefreshNonce((current) => current + 1);
  }

  function closeBuyModal() {
    if (buyBusy) {
      return;
    }
    const hadPreview = Boolean(buyPreview?.player?.id);
    const negotiationAccepted = buyNegotiationOutcome?.status === "accepted";
    const shouldApplyAbortMalus =
      source === "sqlite" &&
      selectedTeamCanManage &&
      hadPreview &&
      !negotiationAccepted &&
      Boolean(buyNegotiationOutcome);
    setBuyModalOpen(false);
    setBuyModalWishlistEntry(null);
    setBuyNegotiationOutcome(null);
    if (hadPreview && !negotiationAccepted && selectedTeamCanManage) {
      const playerName = buyPreview?.player?.name ?? "dem Spieler";
      if (shouldApplyAbortMalus && buyPreview) {
        void persistNegotiationOutcome(
          buyPreview,
          "rejected_bad_experience",
          ["negotiation_cancelled_after_contact"],
        );
      }
      setPreviewError(
        shouldApplyAbortMalus
          ? `Verhandlung mit ${playerName} abgebrochen. Das gibt einen Malus fuer die naechste Runde.`
          : `Kauf von ${playerName} abgebrochen.`,
      );
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  const historyItems = historyFeed?.items ?? [];
  const previewNeedSignal = selectedPlayer ? getNeedSignal(selectedPlayer) : null;
  const previewPurchasePrice = buyPreview?.purchasePrice ?? selectedPlayer?.marketValue ?? null;
  const previewAnnualSalary = buyPreview?.salary ?? selectedPlayer?.salary ?? null;
  const previewCashBefore = buyPreview?.cashBefore ?? marketContext?.teamCash ?? selectedTeam?.cash ?? null;
  const previewCashAfter =
    buyPreview?.cashAfter ??
    (previewCashBefore != null && previewPurchasePrice != null ? previewCashBefore - previewPurchasePrice : null);
  const previewTeamSalaryBefore = buyPreview?.salaryBefore ?? marketContext?.teamSalary ?? null;
  const previewTeamSalaryAfter =
    buyPreview?.salaryAfter ??
    (previewTeamSalaryBefore != null && previewAnnualSalary != null ? previewTeamSalaryBefore + previewAnnualSalary : null);
  const previewRosterBefore = buyPreview?.rosterBefore ?? marketContext?.rosterCount ?? null;
  const previewRosterAfter = buyPreview?.rosterAfter ?? (previewRosterBefore != null && selectedPlayer ? previewRosterBefore + 1 : null);
  const previewMarketValueBefore = buyPreview?.marketValueBefore ?? marketContext?.marketValueTotal ?? null;
  const previewMarketValueAfter =
    buyPreview?.marketValueAfter ??
    (previewMarketValueBefore != null && previewPurchasePrice != null ? previewMarketValueBefore + previewPurchasePrice : null);
  const previewSalaryLabel =
    buyPreview?.expectedSalary != null
      ? `${formatTransfermarktCurrency(buyPreview.baseExpectedSalary ?? null)} → ${formatTransfermarktCurrency(buyPreview.expectedSalary)}`
      : formatTransfermarktCurrency(previewAnnualSalary);
  const activeOfferLabel =
    buyPreview?.offeredSalary != null ? formatTransfermarktCurrency(buyPreview.offeredSalary) : "auto";
  const dealOpenDisabledReason =
    !selectedTeamId
      ? "Bitte erst ein Team wählen."
      : !selectedPlayer
        ? "Bitte erst links einen Kandidaten wählen."
        : !selectedTeamCanManage
          ? selectedTeamReadOnlyReason ?? "Dieses Team ist hier nur Ansicht."
          : null;
  const finalBuyDisabledReason =
    source !== "sqlite"
      ? "Im Referenzmodus ist nur Vorschau möglich."
      : !selectedTeamCanManage
        ? selectedTeamReadOnlyReason ?? "Dieses Team ist hier nur Ansicht."
        : previewBusy
          ? "Die Deal-Vorschau rechnet gerade noch."
          : buyBusy
            ? "Der Kauf wird gerade verarbeitet."
            : !selectedPlayer || !selectedTeamId
              ? "Bitte erst Team und Kandidat wählen."
              : !buyPreview?.canBuy
                ? buyPreview?.blockingReasons?.map(formatNegotiationSignalLabel).join(" · ") || "Der Deal ist noch nicht bereit."
                : buyNegotiationOutcome?.status !== "accepted"
                  ? "Erst verhandeln, dann final bestätigen."
                : null;
  const modalPlayerName = buyPreview?.player?.name ?? selectedPlayer?.name ?? buyModalWishlistEntry?.playerName ?? "Unbekannt";
  const modalPlayerClass = buyPreview?.player?.className ?? selectedPlayer?.className ?? buyModalWishlistEntry?.className ?? "—";
  const modalPlayerRace = buyPreview?.player?.race ?? selectedPlayer?.race ?? buyModalWishlistEntry?.race ?? "—";
  const modalPlayerBracket = buyPreview?.bracket ?? selectedPlayer?.bracket ?? buyModalWishlistEntry?.bracket ?? null;
  const modalPlayerMarketValue = buyPreview?.currentValue ?? selectedPlayer?.marketValue ?? buyModalWishlistEntry?.marketValue ?? null;
  const modalPlayerSalary = buyPreview?.salary ?? selectedPlayer?.salary ?? buyModalWishlistEntry?.salary ?? null;
  const modalOfferValue = salaryEditedManually
    ? offeredSalary
    : buyPreview?.offeredSalary ?? selectedPlayer?.salary ?? null;
  const modalSalarySliderMin =
    buyPreview?.expectedSalary != null
      ? Math.max(0.1, Number((buyPreview.expectedSalary * 0.7).toFixed(1)))
      : 0.1;
  const modalSalarySliderMax =
    buyPreview?.expectedSalary != null
      ? Math.max(modalSalarySliderMin + 0.1, Number((buyPreview.expectedSalary * 1.3).toFixed(1)))
      : Math.max(1, Number(((modalOfferValue ?? selectedPlayer?.salary ?? 1) * 1.3).toFixed(1)));
  const compactNegotiationFeedback = useMemo(() => {
    const likes: string[] = [];
    const concerns: string[] = [];

    if (contractPreference) {
      if (contractLengthOutsidePreference) {
        concerns.push(
          activeContractLength < contractPreference.preferredMinLength
            ? `Laufzeit zu kurz fuer den Wunsch (${contractPreference.preferredMinLength}-${contractPreference.preferredMaxLength} Saisons okay)`
            : `Laufzeit zu lang fuer den Wunsch (${contractPreference.preferredMinLength}-${contractPreference.preferredMaxLength} Saisons okay)`,
        );
      } else {
        likes.push(`Laufzeit passt in sein Wunschfenster (${contractPreference.preferredMinLength}-${contractPreference.preferredMaxLength})`);
      }

      if (contractShapeMismatch) {
        concerns.push(
          `Vertragsform mag er weniger (${formatContractShapeLabel(activeContractShape)} statt ${formatContractShapeLabel(contractPreference.shapePreference)})`,
        );
      } else {
        likes.push(`Vertragsform passt (${formatContractShapeLabel(activeContractShape)})`);
      }
    }

    if (buyPreview?.expectedSalary != null && modalOfferValue != null) {
      const salaryDelta = Number((modalOfferValue - buyPreview.expectedSalary).toFixed(1));
      if (salaryDelta >= 0) {
        likes.push(
          salaryDelta === 0
            ? "Gehalt trifft genau seine aktuelle Forderung"
            : `Gehalt liegt ${formatTransfermarktCurrency(salaryDelta)} ueber seiner Forderung`,
        );
      } else {
        concerns.push(`Gehalt liegt ${formatTransfermarktCurrency(Math.abs(salaryDelta))} unter seiner Forderung`);
      }
    }

    const breakdown = buyPreview?.negotiationScoreBreakdown ?? [];
    for (const entry of breakdown) {
      if (entry.tone === "positive" && likes.length < 3) {
        likes.push(`${entry.label}: ${entry.reason}`);
      }
      if (entry.tone === "negative" && concerns.length < 3) {
        concerns.push(`${entry.label}: ${entry.reason}`);
      }
      if (likes.length >= 3 && concerns.length >= 3) {
        break;
      }
    }

    return {
      likes: likes.slice(0, 3),
      concerns: concerns.slice(0, 3),
    };
  }, [
    activeContractLength,
    activeContractShape,
    buyPreview?.expectedSalary,
    buyPreview?.negotiationScoreBreakdown,
    contractLengthOutsidePreference,
    contractPreference,
    contractShapeMismatch,
    modalOfferValue,
  ]);
  const priorBadExperienceDemandEntry = useMemo(
    () => buyPreview?.demandBreakdown?.find((entry) => entry.key === "prior_bad_experience") ?? null,
    [buyPreview?.demandBreakdown],
  );
  const priorBadExperienceScoreEntry = useMemo(
    () => buyPreview?.negotiationScoreBreakdown?.find((entry) => entry.key === "bad_experience") ?? null,
    [buyPreview?.negotiationScoreBreakdown],
  );
  const priorBadExperienceActive = Boolean(
    buyPreview?.warnings?.includes("previous_rejected_offer_reduces_trust") ||
    priorBadExperienceDemandEntry ||
    priorBadExperienceScoreEntry,
  );
  const needBreakdownSummary = useMemo(() => {
    const breakdown = selectedPlayer?.needMatchBreakdown;
    if (!breakdown) {
      return null;
    }
    const parts = [
      { label: "Identity", value: breakdown.identityFitScore },
      { label: "Achse", value: breakdown.axisScore },
      { label: "Luecke", value: breakdown.rosterGapScore },
      { label: "Tiefe", value: breakdown.depthQualityScore },
      { label: "Diszi", value: breakdown.preferredDisciplineScore },
      { label: "Value", value: breakdown.valueReliefScore },
      { label: "Malus", value: breakdown.premiumOverfillPenalty * -1 },
    ]
      .filter((entry) => Math.abs(entry.value) >= 0.5)
      .map((entry) => `${entry.label} ${entry.value > 0 ? "+" : ""}${formatCompactNumber(entry.value, 0)}`);

    if (parts.length === 0) {
      return `Kaum direkter Need-Treiber = ${formatCompactNumber(breakdown.totalScore, 0)}`;
    }

    return `${parts.join(" · ")} = ${formatCompactNumber(breakdown.totalScore, 0)}`;
  }, [selectedPlayer]);

  return (
    <section className="market-v2-shell">
      <section className="market-v2-topbar">
        <div className="filter-field">
          <span>Aktives Team</span>
          <strong>{selectedTeam ? `${selectedTeam.shortCode} · ${selectedTeam.name}` : "Markt-Überblick"}</strong>
          <small className="muted">Wechsel oben in der Foundation-Leiste.</small>
        </div>
        <label className="filter-field">
          <span>Suchen</span>
          <input
            className="input"
            value={search}
            placeholder="Name, Klasse, Rasse, Trait"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="filter-field compact-filter">
          <span>Sortierung</span>
          <select className="input" value={sortMode} onChange={(event) => setSortMode(event.target.value as MarketSortMode)}>
            <option value="need">Größter Bedarf</option>
            <option value="fit">Bester Fit</option>
            <option value="value">Bestes Value</option>
            <option value="potential">Meistes Potenzial</option>
            <option value="cheap">Günstigste</option>
            <option value="salary">Niedriges Gehalt</option>
          </select>
        </label>
        <div className="market-v2-topbar-actions">
          <button className="secondary-button inline-button" type="button" onClick={() => onOpenClassicMarket?.()}>
            Klassischer Markt
          </button>
          <button className="secondary-button inline-button" type="button" onClick={() => onOpenHistory?.()}>
            Historie
          </button>
        </div>
      </section>

      <section className="market-v2-filter-board">
        <div className="market-v2-filter-panel">
          <div className="market-v2-filter-head">
            <strong>Klassen</strong>
            <small>nach Farbe gruppiert</small>
          </div>
          <div className="market-v2-class-group-grid">
            {groupedClassNames.map((group) => (
              <div className="market-v2-class-group" key={group.axis ?? "neutral"}>
                {group.meta ? (
                  <button
                    className={`market-v2-filter-chip market-v2-class-axis-chip ${group.meta.className}${selectedClassAxes.includes(group.axis) ? " is-active" : ""}`}
                    type="button"
                    onClick={() => setSelectedClassAxes((current) => toggleSelection(current, group.axis))}
                    title={`Nur ${group.meta.label}-Klassen anzeigen`}
                  >
                    {group.meta.label}
                  </button>
                ) : (
                  <span className="market-v2-class-axis-label">Weitere</span>
                )}
                <div className="market-v2-class-group-chips">
                  {group.classes.map((className) => {
                    const active = selectedClassNames.includes(className);
                    const classAxis = CLASS_COLOR_TO_AXIS[getClassColorToken(className) ?? ""];
                    const classAxisMeta = classAxis ? AXIS_META[classAxis] : null;
                    return (
                      <button
                        key={className}
                        className={`market-v2-filter-chip ${classAxisMeta?.className ?? "is-neutral"}${active ? " is-active" : ""}`}
                        type="button"
                        onClick={() => setSelectedClassNames((current) => toggleSelection(current, className))}
                      >
                        <ClassIcon classNameValue={className} showLabel={false} className="market-v2-filter-icon-chip" iconClassName="market-v2-filter-icon" />
                        <span>{className}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="market-v2-filter-panel market-v2-race-filter-panel">
          <div className="market-v2-filter-head">
            <strong>Rassen</strong>
            <small>inkl. Icon</small>
          </div>
          <div className="market-v2-chip-row">
            {availableRaceNames.map((raceName) => {
              const active = selectedRaceNames.includes(raceName);
              return (
                <button
                  key={raceName}
                  className={`market-v2-filter-chip is-race${active ? " is-active" : ""}`}
                  type="button"
                  onClick={() => setSelectedRaceNames((current) => toggleSelection(current, raceName))}
                >
                  <RaceIcon race={raceName} showLabel={false} className="market-v2-filter-icon-chip" iconClassName="market-v2-filter-icon" />
                  <span>{raceName}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="market-v2-filter-panel market-v2-discipline-lens-panel">
          <div className="market-v2-filter-head">
            <strong>Diszi-Linse</strong>
            <small>zeigt nur, worauf du achten solltest</small>
          </div>
          <label className="filter-field">
            <span>Ziel-Diszi</span>
            <select className="input" value={selectedDisciplineLens} onChange={(event) => setSelectedDisciplineLens(event.target.value as OfficialDisciplineWeightId | "")}>
              <option value="">keine Linse</option>
              {officialDisciplineWeightOrder.map((disciplineId) => (
                <option key={disciplineId} value={disciplineId}>
                  {officialDisciplineWeightLabels[disciplineId]}
                </option>
              ))}
            </select>
          </label>
          {selectedDisciplineLens ? (
            <div className="market-v2-development-grid">
              {getDisciplineLensAttributes(selectedDisciplineLens).map((entry) => (
                <span
                  className={`market-v2-signal-badge ${entry.focusTone}`}
                  title={`${officialDisciplineWeightLabels[selectedDisciplineLens]} gewichtet ${entry.label} mit ${entry.weight}%`}
                  key={`discipline-lens-${selectedDisciplineLens}-${entry.attribute}`}
                >
                  {entry.shortLabel} {entry.weight}%
                </span>
              ))}
            </div>
          ) : (
            <p className="market-v2-lens-copy">
              Waehle eine Diszi, dann markieren wir dir die vier wichtigsten Attribute als Orientierung. Kein Auto-Finder, nur bessere Scouting-Hilfe.
            </p>
          )}
        </div>
      </section>

      <section className="market-v2-controls-strip">
        <div className="market-v2-range-row">
        <label className="filter-field">
          <span>Max MW</span>
          <input
            className="input"
            type="range"
            min={0}
            max={valueSliderMax}
            step={0.5}
            value={effectiveMaxValue}
            onChange={(event) => setMaxValue(Number(event.target.value))}
          />
          <small>{effectiveMaxValue >= valueSliderMax ? `alle bis ${formatCompactNumber(valueSliderMax, 1)}` : `bis ${formatCompactNumber(effectiveMaxValue, 1)}`}</small>
        </label>
        <label className="filter-field">
          <span>Max Gehalt</span>
          <input
            className="input"
            type="range"
            min={0}
            max={salarySliderMax}
            step={0.5}
            value={effectiveMaxSalary}
            onChange={(event) => setMaxSalary(Number(event.target.value))}
          />
          <small>{effectiveMaxSalary >= salarySliderMax ? `alle bis ${formatCompactNumber(salarySliderMax, 1)}` : `bis ${formatCompactNumber(effectiveMaxSalary, 1)}`}</small>
        </label>
        <label className="filter-field">
          <span>Min Ratio</span>
          <input
            className="input"
            type="range"
            min={0}
            max={ratioSliderMax}
            step={0.1}
            value={effectiveMinRatio}
            onChange={(event) => setMaxRatio(Number(event.target.value))}
          />
          <small>{effectiveMinRatio <= 0 ? "ohne Mindestwert" : `ab ${formatCompactNumber(effectiveMinRatio, 1)}`}</small>
        </label>
        <label className="filter-field">
          <span>Min Fit</span>
          <input
            className="input"
            type="range"
            min={0}
            max={25}
            step={1}
            value={minFit}
            onChange={(event) => setMinFit(Number(event.target.value))}
          />
          <small>{minFit}</small>
        </label>
        <button
          className="secondary-button inline-button"
          type="button"
          onClick={resetMarketFilters}
        >
          Reset
        </button>
        </div>

        <div className="market-v2-filter-toolbar">
          <div className="market-v2-filter-panel market-v2-axis-inline-panel">
            <div className="market-v2-filter-head">
              <strong>POW / SPE / MEN / SOC</strong>
              <small>Mindestwerte direkt im Filter</small>
            </div>
            <div className="market-v2-axis-filter-grid is-inline">
              {MARKET_AXIS_ORDER.map((axis) => {
                const meta = AXIS_META[axis];
                const active = selectedAxes.includes(axis);
                return (
                  <label key={axis} className={`market-v2-axis-filter ${meta.className}${active ? " is-active" : ""}`}>
                    <span className="market-v2-axis-filter-top">
                      <button
                        className={`market-v2-filter-chip ${meta.className}${active ? " is-active" : ""}`}
                        type="button"
                        onClick={() => setSelectedAxes((current) => toggleSelection(current, axis))}
                      >
                        {meta.label}
                      </button>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={axisMinimums[axis]}
                        aria-label={`${meta.label} Mindestwert`}
                        onChange={(event) => {
                          const next = Math.max(0, Math.min(100, Number(event.target.value) || 0));
                          setAxisMinimums((current) => ({ ...current, [axis]: next }));
                          setSelectedAxes((current) => (current.includes(axis) ? current : [...current, axis]));
                        }}
                      />
                    </span>
                    <input
                      className="market-v2-axis-filter-slider"
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={axisMinimums[axis]}
                      aria-label={`${meta.label} Mindestwert Slider`}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setAxisMinimums((current) => ({ ...current, [axis]: next }));
                        setSelectedAxes((current) => (current.includes(axis) ? current : [...current, axis]));
                      }}
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <section className="market-v2-filter-presets" aria-label="Gespeicherte Transfermarkt-Filter">
            <div className="market-v2-filter-preset-save">
              <label className="filter-field">
                <span>Filter speichern</span>
                <input
                  className="input"
                  value={presetName}
                  maxLength={32}
                  placeholder="z.B. POW billig"
                  onChange={(event) => setPresetName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveCurrentFilterPreset();
                    }
                  }}
                />
              </label>
              <button className="primary-button inline-button" type="button" onClick={saveCurrentFilterPreset}>
                Speichern
              </button>
            </div>
            <div className="market-v2-filter-preset-list">
              {filterPresets.length ? (
                filterPresets.map((preset) => (
                  <span className="market-v2-filter-preset-chip" key={preset.id}>
                    <button type="button" onClick={() => loadFilterPreset(preset)} title={`Filter "${preset.name}" laden`}>
                      {preset.name}
                    </button>
                    <button type="button" className="is-danger" onClick={() => deleteFilterPreset(preset.id)} title={`Filter "${preset.name}" loeschen`}>
                      x
                    </button>
                  </span>
                ))
              ) : (
                <span className="market-v2-filter-preset-empty">Keine gespeicherten Filter</span>
              )}
            </div>
            {filterPresetMessage ? <span className="market-v2-filter-preset-status">{filterPresetMessage}</span> : null}
          </section>
        </div>
      </section>

      {marketError ? <p className="text-negative">{marketError}</p> : null}
      {buySuccess ? (
        <div className="transfer-feedback-banner is-success" style={{ marginBottom: 12 }}>
          <strong>Deal fix</strong>
          <span>{buySuccess}</span>
          <button className="secondary-button inline-button" type="button" onClick={() => setBuySuccess(null)}>
            Schließen
          </button>
        </div>
      ) : null}

      <section className="market-v2-budget-strip">
        <strong>{selectedTeam ? selectedTeam.name : "Liga-Überblick"}</strong>
        <span className="is-cash">Cash {marketContext ? formatCompactNumber(marketContext.teamCash, 1) : "—"}</span>
        <span className="is-salary">Gehalt {marketContext ? formatCompactNumber(marketContext.teamSalary, 1) : "—"}</span>
        <span className="is-roster">
          Kader {marketContext?.rosterCount ?? "—"} / {selectedTeam?.rosterLimit ?? "—"}
        </span>
        <span className="is-market">MW max {formatCompactNumber(valueSliderMax, 1)}</span>
        <span className="is-salary">Gehalt max {formatCompactNumber(salarySliderMax, 1)}</span>
        <span className="is-market">Ratio top {formatCompactNumber(ratioSliderMax, 1)}</span>
        <span className="is-feed">{visibleItems.length} sichtbar · {availabilityLabel}</span>
      </section>
      <section className="market-v2-main-grid">
        <aside className="market-v2-candidate-rail">
          <div className="market-v2-rail-head">
            <div>
              <span className="market-v2-lane-kicker">Markt-Pool</span>
              <strong>Kandidaten</strong>
              <small>
                {visibleItems.length} sichtbar · {availabilityLabel}
              </small>
            </div>
            <span className={`transfer-status-pill ${marketBusy ? "is-info" : "is-ready"}`}>
              {marketBusy ? "lädt" : "live"}
            </span>
          </div>
          <div className="market-v2-candidate-list">
            {renderedVisibleItems.map((item, index) => {
              const portrait = getTransfermarktPortraitModel(item);
              const isSelected = selectedPlayer?.playerId === item.playerId;
              const fitInfo = getFitSignal(item);
              const needInfo = getNeedSignal(item);
              const ratioTone = getRatioTone(item.marketValueSalaryRatio);
              const focusAxes = getCandidateFocusAxes(item);
              return (
                <button
                  className={`market-v2-candidate-card${isSelected ? " is-selected" : ""}`}
                  key={item.playerId}
                  type="button"
                  ref={(node) => {
                    setCandidateButtonRef(item.playerId, node);
                  }}
                  aria-selected={isSelected}
                  style={getCandidateFrameStyle(item.className)}
                  onClick={() => {
                    shouldFocusSelectedCandidateRef.current = false;
                    setSelectedPlayerId(item.playerId);
                  }}
                  onDoubleClick={() => onOpenPlayerDetails?.({ playerId: item.playerId })}
                  onKeyDown={(event) => handleCandidateKeyDown(event, item.playerId)}
                >
                  <div className="market-v2-candidate-media" style={getCandidateFrameStyle(item.className)}>
                    {portrait.src ? (
                      <OptimizedMediaImage
                        src={portrait.src}
                        alt={item.name}
                        width={68}
                        height={68}
                        className="market-v2-candidate-image"
                        loading={isSelected || index < 6 ? "eager" : "lazy"}
                        fetchPriority={isSelected || index < 3 ? "high" : "low"}
                      />
                    ) : (
                      <span className="market-v2-candidate-placeholder">{portrait.initials}</span>
                    )}
                  </div>
                  <div className="market-v2-candidate-copy">
                    <div className="market-v2-candidate-head">
                      <strong title={item.name}>{item.name}</strong>
                      <span className={`${getClassColorClassName(item.className)} market-v2-class-mini`}>{item.className}</span>
                    </div>
                    <small>
                      {item.race} · {item.alignment}
                      {item.mercenary ? " · Mercenary" : ""}
                    </small>
                    <div className="market-v2-candidate-metric-row">
                      <span>
                        <b>{formatTransfermarktCurrency(item.marketValue)}</b>
                        <small>MW</small>
                      </span>
                      <span>
                        <b>{formatTransfermarktCurrency(item.salary)}</b>
                        <small>Gehalt</small>
                      </span>
                      <span className={getToneClass(ratioTone)}>
                        <b>{formatTransfermarktRatio(item.marketValueSalaryRatio)}</b>
                        <small>MW/Geh</small>
                      </span>
                      <span className={getToneClass(fitInfo.tone)}>
                        <b>{item.fitDisplay}</b>
                        <small>Fit</small>
                      </span>
                      <span className={getToneClass(needInfo.tone)}>
                        <b>{item.needMatchScore != null ? formatCompactNumber(item.needMatchScore, 0) : "—"}</b>
                        <small>Bedarf</small>
                      </span>
                    </div>
                    {item.doubleLoadWarnings?.length ? (
                      <div className="market-v2-candidate-read-row">
                        <span className="market-v2-signal-badge is-negative" title={getDoubleLoadTooltip(item)}>
                          Doppelbelastung
                        </span>
                      </div>
                    ) : null}
                    <VeloStatOrbitRow
                      ariaLabel={`${item.name} Achsenwerte`}
                      className="market-v2-candidate-orbit"
                      stats={{
                        pow: item.pow ?? 0,
                        spe: item.spe ?? 0,
                        men: item.men ?? 0,
                        soc: item.soc ?? 0,
                      }}
                    />
                    {(() => {
                      const classFocus = getClassTrainingImpact(item.className);
                      return (
                        <VeloAttributeFocusTags
                          primary={classFocus.positive.map((entry) => ({
                            attribute: TRAINING_ATTRIBUTE_LABELS[entry.attribute as PlayerGeneratorAttributeKey],
                            weight: entry.weight,
                          }))}
                          risks={classFocus.negative.map((entry) => ({
                            attribute: TRAINING_ATTRIBUTE_LABELS[entry.attribute as PlayerGeneratorAttributeKey],
                            weight: entry.weight,
                          }))}
                          className="market-v2-candidate-class-focus"
                        />
                      );
                    })()}
                    <div className="market-v2-scouting-disclosure velo-scouting-disclosure" aria-label="Scouting Transparenz">
                      {(() => {
                        const buckets = getTransfermarktScoutingVisibilityBuckets(item.scoutingLevel ?? 0);
                        return (
                          <>
                            <span className="velo-scouting-segment is-visible has-data">Sichtbar {buckets.scouted.length}</span>
                            <span className={`velo-scouting-segment is-hidden${buckets.hidden.length > 0 ? " has-data" : ""}`}>Versteckt {buckets.hidden.length}</span>
                            <span className="velo-scouting-segment is-base has-data">Basis {buckets.knowledge.length}</span>
                          </>
                        );
                      })()}
                    </div>
                    <div className="market-v2-candidate-axis-row is-legacy">
                      {focusAxes.map((entry) => (
                        <span className={`market-v2-axis-chip ${AXIS_META[entry.axis].className}`} key={`${item.playerId}-${entry.axis}`}>
                          {AXIS_META[entry.axis].label} {formatCompactNumber(entry.value, 0)}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
            {marketBusy && visibleItems.length === 0 ? (
              <div className="market-v2-candidate-skeleton" aria-busy="true" aria-live="polite">
                {Array.from({ length: 6 }, (_, index) => (
                  <div className="market-v2-candidate-skeleton__card" key={`market-skeleton-${index}`} />
                ))}
              </div>
            ) : null}
            {!marketBusy && visibleItems.length === 0 ? (
              <div className="market-v2-empty">
                <strong>Keine Kandidaten im aktuellen Filter.</strong>
                <p>Suchbegriff, MW-Limit oder Fit etwas weiter stellen.</p>
              </div>
            ) : null}
          </div>
          {renderedVisibleItems.length < visibleItems.length ? (
            <p className="muted">
              {renderedVisibleItems.length} von {visibleItems.length} Kandidaten eingeblendet, der Rest kommt automatisch nach.
            </p>
          ) : null}
          {marketHasMore ? (
            <p className="muted">Weitere Kandidaten werden automatisch geladen.</p>
          ) : null}
        </aside>

        <section className="market-v2-focus-panel">
          {selectedPlayer ? (
            <>
              <div className="market-v2-player-hero">
                <div className="market-v2-player-media">
                  {selectedPortrait?.src ? (
                    <OptimizedMediaImage src={selectedPortrait.src} alt={selectedPlayer.name} width={240} height={240} className="market-v2-player-image" />
                  ) : (
                    <div className="market-v2-player-placeholder">{selectedPortrait?.initials ?? "FA"}</div>
                  )}
                </div>
                <div className="market-v2-player-copy">
                  <span className="market-v2-kicker" title={scoutingProfileTooltip}>
                    Scouting-Profil
                  </span>
                  <h3>{selectedPlayer.name}</h3>
                  <p>{selectedPlayer.className} · {selectedPlayer.race} · {selectedPlayer.alignment}</p>
                  <div className="market-v2-pill-row">
                    <span className="pill">{formatTransfermarktCurrency(selectedPlayer.marketValue)} MW</span>
                    <span className="pill">{formatTransfermarktCurrency(selectedPlayer.salary)} Gehalt</span>
                    <span className={`pill ${getToneClass(getRatioTone(selectedPlayer.marketValueSalaryRatio))}`}>
                      Ratio {formatTransfermarktRatio(selectedPlayer.marketValueSalaryRatio)}
                    </span>
                    <span className="pill">Bracket {selectedPlayer.bracket ?? "—"}</span>
                    <span
                      className={`pill ${fitSignal ? getToneClass(fitSignal.tone) : ""}${fitSalaryDiscountActive ? " market-v2-fit-bonus-pill" : ""}`}
                      title={fitSalaryDiscountActive ? "Teamfit 25+: -10% Gehalt wird am Ende der Forderung abgezogen." : undefined}
                    >
                      Fit {selectedPlayer.fitDisplay}
                      {fitSalaryDiscountActive ? " · -10% Vertrag" : ""}
                    </span>
                    <span className={`pill ${growthSignal ? getToneClass(growthSignal.tone) : ""}`}>
                      Potenzial {getPotentialLabel(selectedPlayer)}
                    </span>
                    {selectedPlayer.doubleLoadWarnings?.length ? (
                      <span className="pill text-negative" title={getDoubleLoadTooltip(selectedPlayer)}>
                        Doppelbelastung
                      </span>
                    ) : null}
                  </div>
                  {selectedPlayer.axisStarsDisplay ? (
                    <p className="market-v2-star-row muted" title="Achsen-Sterne (aktuell) — je nach Scouting-Level unscharf bis exakt.">
                      Aktuell: {selectedPlayer.axisStarsDisplay}
                    </p>
                  ) : null}
                  {selectedPlayer.potentialStarsDisplay ? (
                    <p className="market-v2-star-row muted" title="Potential-Decke — baut sich über Beobachtung/Spieltage enger auf.">
                      {selectedPlayer.potentialStarsDisplay}
                      {selectedPlayer.potentialGapStars != null ? ` · Gap ${selectedPlayer.potentialGapStars}★` : ""}
                    </p>
                  ) : null}
                  <div className="market-v2-link-row">
                    <button
                      className="secondary-button inline-button"
                      type="button"
                      onClick={() => onOpenPlayerDetails?.({ playerId: selectedPlayer.playerId })}
                    >
                      Spieler öffnen
                    </button>
                  </div>
                </div>
              </div>

              <div className="market-v2-axis-grid">
                <MarketAxisBar axis="pow" value={selectedPlayer.pow} />
                <MarketAxisBar axis="spe" value={selectedPlayer.spe} />
                <MarketAxisBar axis="men" value={selectedPlayer.men} />
                <MarketAxisBar axis="soc" value={selectedPlayer.soc} />
              </div>

              <div
                className="market-v2-attribute-grid"
                title="Scouting L1 zeigt 4 Attribute als Range. Hoehere Scouting-Stufen decken mehr Attribute und spaeter exakte Werte auf."
              >
                {orderedAttributeRows.map((entry) => {
                  const shortLabel = ATTRIBUTE_SHORT_LABELS[entry.key as PlayerGeneratorAttributeKey] ?? entry.label.slice(0, 3).toUpperCase();
                  const displayValue = entry.revealed
                    ? entry.value != null
                      ? formatCompactNumber(entry.value, 0)
                      : entry.rangeLabel ?? entry.ratingLabel ?? "?"
                    : "?";
                  const displayTier = entry.revealed && entry.value == null ? entry.ratingLabel : null;
                  return (
                    <span
                      className={`market-v2-attribute-chip is-${entry.tone}${entry.revealed ? "" : " is-hidden"}`}
                      title={
                        entry.revealed
                          ? `${entry.label}: ${entry.value != null ? "exakter Wert" : "Scouting-Range"}`
                          : `${entry.label} ab Scouting-Level ${entry.revealLevel}`
                      }
                      key={`profile-attr-${selectedPlayer.playerId}-${entry.key}`}
                    >
                      <b>{shortLabel}</b>
                      <strong>{displayValue}</strong>
                      {displayTier ? <small>{displayTier}</small> : null}
                    </span>
                  );
                })}
              </div>

              <div className="market-v2-focus-grid">
                <article
                  className="market-v2-info-card market-v2-info-card-top-diszi"
                  title={`Scouting ${getScoutingClarityLabel(selectedPlayer.scoutingConfidence)}: ${getScoutedDisciplineLine(selectedPlayer)}`}
                >
                  <div className="market-v2-card-eyebrow">Top-5 Diszis</div>
                  <div className="market-v2-diszi-list">
                    {selectedPlayer.topDisciplineScores.slice(0, 5).map((entry) => (
                      <div
                        className={`market-v2-diszi-row ${getDisciplineCategoryClass(entry)}`}
                        title={`${entry.disciplineName} · Slots ${entry.playerCount ?? "—"} · Teamrank ${entry.teamRank ?? "—"}`}
                        key={`${selectedPlayer.playerId}-${entry.disciplineId ?? entry.disciplineName}`}
                      >
                        <span>{formatDisciplineContextLabel(entry)}</span>
                        <strong>{getScoutingTierWindow(entry.scoreTier ?? null, selectedPlayer.scoutingConfidence)}</strong>
                      </div>
                    ))}
                    {selectedPlayer.topDisciplineScores.length === 0 ? <span className="pill">keine Top-Diszis</span> : null}
                  </div>
                  {selectedPlayer.doubleLoadWarnings?.length ? (
                    <span className="market-v2-signal-badge is-negative" title={getDoubleLoadTooltip(selectedPlayer)}>
                      Doppelbelastung
                    </span>
                  ) : null}
                  <div className="market-v2-inline-training" title={`Scouting L${selectedScoutingLevel}: Trainingsprofil wird schrittweise klarer.`}>
                    <div className="market-v2-card-eyebrow">Attribut-Wirkung</div>
                    <div className="market-v2-training-affinity-grid">
                      {visibleTrainingPositive.map((entry) => (
                        <span
                          className="market-v2-training-affinity-chip is-signature"
                          title={getTrainingAttributeTitle(
                            { attribute: entry.attribute as PlayerGeneratorAttributeKey, weight: entry.weight },
                            "signature",
                          )}
                          key={`train-pos-${selectedPlayer.playerId}-${entry.attribute}`}
                        >
                          <b>+</b>
                          <span>
                            <strong>{TRAINING_ATTRIBUTE_LABELS[entry.attribute as PlayerGeneratorAttributeKey]}</strong>
                            <small>{formatTrainingAttributeWeight(entry.weight)}</small>
                          </span>
                        </span>
                      ))}
                      {visibleTrainingNegative.map((entry) => (
                        <span
                          className="market-v2-training-affinity-chip is-weak"
                          title={getTrainingAttributeTitle(
                            { attribute: entry.attribute as PlayerGeneratorAttributeKey, weight: entry.weight },
                            "weak",
                          )}
                          key={`train-neg-${selectedPlayer.playerId}-${entry.attribute}`}
                        >
                          <b>-</b>
                          <span>
                            <strong>{TRAINING_ATTRIBUTE_LABELS[entry.attribute as PlayerGeneratorAttributeKey]}</strong>
                            <small>{formatTrainingAttributeWeight(entry.weight)}</small>
                          </span>
                        </span>
                      ))}
                      {hiddenTrainingPositive > 0 ? (
                        <span className="market-v2-training-affinity-chip is-locked" title="Mehr Scouting deckt weitere Trainingsstaerken auf.">
                          <b>?</b>
                          <span>
                            <strong>+{hiddenTrainingPositive} Staerken</strong>
                            <small>mehr Scouting</small>
                          </span>
                        </span>
                      ) : null}
                      {hiddenTrainingNegative > 0 ? (
                        <span className="market-v2-training-affinity-chip is-locked" title="Mehr Scouting deckt Trainingsrisiken auf.">
                          <b>?</b>
                          <span>
                            <strong>{hiddenTrainingNegative} Malus</strong>
                            <small>mehr Scouting</small>
                          </span>
                        </span>
                      ) : null}
                      {!visibleTrainingNegative.length && hiddenTrainingNegative === 0 ? (
                        <span className="market-v2-signal-badge is-neutral">kein klarer Malus</span>
                      ) : null}
                    </div>
                  </div>
                </article>

                <article
                  className="market-v2-info-card"
                  title={
                    selectedPlayer.needMatchReasons?.length
                      ? selectedPlayer.needMatchReasons.join(" · ")
                      : "Zeigt, ob dieser Spieler eine echte Kaderlücke des gewählten Teams löst."
                  }
                >
                  <div className="market-v2-card-eyebrow">Team-Match</div>
                  <span>Bedarfs-Match</span>
                  <strong>
                    {selectedPlayer.needMatchScore != null
                      ? `${formatCompactNumber(selectedPlayer.needMatchScore, 0)} · ${selectedPlayer.needMatchLabel ?? "Bedarf"}`
                      : "Team wählen"}
                  </strong>
                  <div className="market-v2-pill-row">
                    {(selectedPlayer.needMatchAxes ?? []).map((axis) => (
                      <span className={`pill ${AXIS_META[axis].className}`} key={`need-axis-${selectedPlayer.playerId}-${axis}`}>
                        {AXIS_META[axis].label}
                      </span>
                    ))}
                  </div>
                  {needBreakdownSummary ? (
                    <div className="market-v2-need-breakdown-line muted" aria-label="Bedarfs-Logik">
                      {needBreakdownSummary}
                    </div>
                  ) : null}
                  <div className="market-v2-axis-compare-mini" aria-label="Achsenvergleich mit dem aktuellen Kader">
                    {axisComparisonRows.map((row) => (
                      <span className={`market-v2-axis-compare-pill ${AXIS_META[row.axis].className} ${row.toneClass}`} key={`team-match-axis-${row.axis}`}>
                        <b>{AXIS_META[row.axis].label}</b>
                        <small>
                          {row.candidateValue != null ? formatCompactNumber(row.candidateValue, 0) : "—"} · Δ {formatAxisComparisonDelta(row.delta)}
                        </small>
                      </span>
                    ))}
                  </div>
                </article>
              </div>

              <div className="market-v2-focus-actions">
                <button
                  className="primary-button"
                  type="button"
                  disabled={!selectedPlayer || !selectedTeamId || !selectedTeamCanManage}
                  onClick={openBuyModal}
                  title={dealOpenDisabledReason ?? "Öffnet das Kaufmodal mit Vertragsrahmen, Forderung und Teamwirkung."}
                >
                  {buyBusy ? "kauft..." : "Deal prüfen"}
                </button>
                <button
                  className={`secondary-button${selectedPlayerWishlisted ? " is-active" : ""}`}
                  type="button"
                  disabled={!selectedPlayer}
                  onClick={() => {
                    if (selectedPlayer) {
                      onToggleWishlist?.(selectedPlayer);
                    }
                  }}
                  title={selectedPlayerWishlisted ? "Kaufabsicht — kein Scouting-Slot. Wishlist spiegelt optional passiv ins Scouting (ab Scouting Office L1)." : "Spieler auf die Transfer-Wishlist setzen (Kaufabsicht, nicht Scouting)."}
                >
                  {selectedPlayerWishlisted ? "Von Wishlist nehmen" : "Auf Wishlist"}
                </button>
                <button
                  className={`secondary-button${selectedPlayerScoutingWatched ? " is-active" : ""}`}
                  type="button"
                  disabled={!selectedPlayer || Boolean(scoutingWatchDisabledReason && !selectedPlayerScoutingWatched)}
                  onClick={() => {
                    if (selectedPlayer) {
                      onToggleScoutingWatch?.(selectedPlayer);
                    }
                  }}
                  title={
                    selectedPlayerScoutingWatched
                      ? "Spieler aus der aktiven Beobachtung nehmen."
                      : scoutingWatchDisabledReason ?? "Spieler aktiv beobachten — Intel baut sich über Spieltage auf."
                  }
                >
                  {selectedPlayerScoutingWatched ? "Nicht mehr beobachten" : "Beobachten"}
                </button>
              </div>
              {selectedPlayerScoutCertainty != null ? (
                <div className="market-v2-scout-certainty" title="Fortschritt der aktiven Beobachtung — höhere Certainty verbessert die Scouting-Disclosure.">
                  <span>Scouting {selectedPlayerScoutCertainty}%</span>
                  <div className="market-v2-scout-certainty-bar" aria-hidden="true">
                    <span style={{ width: `${Math.max(0, Math.min(100, selectedPlayerScoutCertainty))}%` }} />
                  </div>
                </div>
              ) : null}
              {scoutingWatchDisabledReason && !selectedPlayerScoutingWatched ? (
                <p className="foundation-screen-action-reason market-v2-focus-action-reason">{scoutingWatchDisabledReason}</p>
              ) : null}
              {dealOpenDisabledReason ? (
                <p className="foundation-screen-action-reason market-v2-focus-action-reason">Warum nicht: {dealOpenDisabledReason}</p>
              ) : null}

              <div
                className="market-v2-traits-card"
                title={
                  selectedPlayer.scoutingWarnings.length
                    ? `Scouting-Hinweise: ${selectedPlayer.scoutingWarnings.slice(0, 3).join(" · ")}`
                    : "Scouting wirkt ruhig. Exakter Player Drawer zeigt bei Bedarf die tieferen Zahlen."
                }
              >
                <span>Traits & Hinweise</span>
                <div className="market-v2-pill-row">
                  {selectedPlayer.traitsPositive.slice(0, 4).map((trait) => (
                    <span className="pill market-v2-trait-pill is-positive" key={`pos-${trait}`}>+ {trait}</span>
                  ))}
                  {selectedPlayer.traitsNegative.slice(0, 3).map((trait) => (
                    <span className="pill market-v2-trait-pill is-negative" key={`neg-${trait}`}>- {trait}</span>
                  ))}
                  {selectedPlayer.hiddenPositiveTraitCount > 0 ? (
                    <span className="pill market-v2-trait-pill is-neutral">
                      +{selectedPlayer.hiddenPositiveTraitCount} verdeckt
                    </span>
                  ) : null}
                  {selectedPlayer.hiddenNegativeTraitCount > 0 ? (
                    <span className="pill market-v2-trait-pill is-neutral">
                      {selectedPlayer.hiddenNegativeTraitCount} Risiko verdeckt
                    </span>
                  ) : null}
                  {selectedPlayer.traitsPositive.length === 0 && selectedPlayer.traitsNegative.length === 0 ? (
                    <span className="pill">keine markanten Traits</span>
                  ) : null}
                  {selectedPlayer.scoutingWarnings.length ? (
                    <span className="pill" title={selectedPlayer.scoutingWarnings.slice(0, 3).join(" · ")}>
                      Scouting-Hinweis
                    </span>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="market-v2-empty">
              <strong>Wähle links einen Kandidaten.</strong>
              <p>Dann bekommst du Scouting-Profil, Achsen, Top-Diszis und Vertragsvorschau an einer Stelle.</p>
            </div>
          )}
        </section>

        <aside className="market-v2-buy-panel">
          <div className="market-v2-buy-head">
            <div>
              <span className="market-v2-lane-kicker is-deal">Deal-Desk</span>
              <strong>Deal-Vorschau</strong>
              <small>{selectedTeam ? `${selectedTeam.shortCode} · ${selectedTeam.name}` : "Bitte Team wählen"}</small>
            </div>
            <span className={`transfer-status-pill ${buyPreview?.canBuy ? "is-ready" : "is-info"}`}>
              {selectedTeamReadOnlyReason ? "nur Ansicht" : buyPreview?.canBuy ? "bereit" : "pruefen"}
            </span>
          </div>
          {previewError ? (
            <span className="market-v2-inline-status is-negative" title={previewError}>
              {formatDealPreviewErrorLabel(previewError)}
            </span>
          ) : null}

          <div className="market-v2-buy-summary">
            <div>
              <span>Ablöse</span>
              <strong>{formatTransfermarktCurrency(previewPurchasePrice)}</strong>
            </div>
            <div>
              <span>Bedarf / Fit</span>
              <strong>
                {selectedPlayer
                  ? `${selectedPlayer.needMatchScore != null ? formatCompactNumber(selectedPlayer.needMatchScore, 0) : "—"} · Fit ${formatCompactNumber(selectedPlayer.fit, 0)}`
                  : "—"}
              </strong>
              {previewNeedSignal ? <small className={getToneClass(previewNeedSignal.tone)}>{previewNeedSignal.label}</small> : null}
            </div>
            <div>
              <span>Cash</span>
              <strong>
                {previewCashBefore != null || previewCashAfter != null
                  ? `${formatTransfermarktCash(previewCashBefore)} → ${formatTransfermarktCash(previewCashAfter)}`
                  : "—"}
              </strong>
            </div>
            <div>
              <span>Gehalt</span>
              <strong>
                {previewTeamSalaryBefore != null || previewTeamSalaryAfter != null
                  ? `${formatTransfermarktCurrency(previewTeamSalaryBefore)} → ${formatTransfermarktCurrency(previewTeamSalaryAfter)}`
                  : "—"}
              </strong>
            </div>
            <div>
              <span>Forderung p.a.</span>
              <strong>{previewSalaryLabel}</strong>
            </div>
            <div>
              <span>MW/Gehalt</span>
              <strong>{selectedPlayer ? formatTransfermarktRatio(selectedPlayer.marketValueSalaryRatio) : "—"}</strong>
            </div>
            <div>
              <span>Potenzial vs MW</span>
              <strong>
                {selectedPlayer?.marketValuePotentialPremiumPct != null
                  ? `${selectedPlayer.marketValuePotentialPremiumPct >= 0 ? "+" : ""}${formatCompactNumber(selectedPlayer.marketValuePotentialPremiumPct, 0)}%`
                  : "—"}
              </strong>
              <small>
                {selectedPlayer?.marketValuePotentialPremiumPct == null
                  ? "keine klare Scout-Tendenz"
                  : selectedPlayer.marketValuePotentialPremiumPct >= 0
                    ? "mehr Luft als aktueller MW"
                    : "eher schon teuer bezahlt"}
              </small>
            </div>
            <div>
              <span>Kader</span>
              <strong>
                {previewRosterBefore != null || previewRosterAfter != null
                  ? `${previewRosterBefore ?? "—"} → ${previewRosterAfter ?? "—"}`
                  : "—"}
              </strong>
            </div>
            <div>
              <span>MW</span>
              <strong>
                {previewMarketValueBefore != null || previewMarketValueAfter != null
                  ? `${formatTransfermarktCurrency(previewMarketValueBefore)} → ${formatTransfermarktCurrency(previewMarketValueAfter)}`
                  : "—"}
              </strong>
            </div>
          </div>

          {activeBoardObjectiveHighlights.length ? (
            <div className="market-v2-warning-box is-muted">
              <strong>Board-Fokus</strong>
              <div className="market-v2-board-focus-list">
                {activeBoardObjectiveHighlights.map((objective) => (
                  <div className="market-v2-board-focus-item" key={objective.objectiveId}>
                    <span className={`transfer-status-pill${objective.status === "failed" || objective.status === "at_risk" ? " is-warning" : ""}`}>
                      {objective.category}
                    </span>
                    <b>{objective.label}</b>
                    <small>{objective.actionHint ?? objective.detail ?? `Ist ${String(objective.currentValue ?? "—")} · Ziel ${String(objective.targetValue ?? "—")}`}</small>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {buyPreview?.blockingReasons?.length ? (
            <div className="market-v2-warning-box">
              <strong>Noch offen</strong>
              <p>{buyPreview.blockingReasons.map(formatNegotiationSignalLabel).join(" · ")}</p>
            </div>
          ) : null}
          {buyPreview?.warnings?.length ? (
            <div className="market-v2-warning-box is-muted">
              <strong>Hinweise</strong>
              <p>{buyPreview.warnings.slice(0, 3).map(formatNegotiationSignalLabel).join(" · ")}</p>
            </div>
          ) : null}
        </aside>
      </section>

      <section className="market-v2-context-grid" aria-label="Team- und Wishlist-Kontext">
        <article className="market-v2-context-panel">
          <details className="market-v2-context-details" open>
            <summary className="market-v2-context-summary">
              <span>
                <strong>Wishlist & Bedarf</strong>
                <small>{selectedWishlistEntries.length} gemerkt · konkrete Orientierung fürs Kaufen</small>
              </span>
              <b>{selectedWishlistEntries.length} Spieler</b>
            </summary>
            <div className="market-v2-context-details-body">
              <div className="market-v2-need-summary">
                <span>
                  {rosterGapOpenCount != null && rosterGapOpenCount > 0
                    ? `${rosterGapOpenCount} Kaderplatz${rosterGapOpenCount === 1 ? "" : "e"} offen`
                    : "Kadergröße okay"}
                </span>
                <span>Budget {formatToneLabel(marketContext?.affordabilityStatus)}</span>
                <span>Status {formatReadinessLabel(marketContext?.readinessStatus)}</span>
              </div>
              <div className="market-v2-axis-compare-grid" aria-label="Kader gegen Kandidat vergleichen">
                {axisComparisonRows.map((row) => (
                  <div className={`market-v2-axis-compare-card ${AXIS_META[row.axis].className} ${row.toneClass}`} key={`context-axis-compare-${row.axis}`}>
                    <div className="market-v2-axis-compare-head">
                      <strong>{AXIS_META[row.axis].label}</strong>
                      <span>{row.isNeedAxis ? "Bedarf" : "Kader"}</span>
                    </div>
                    <div className="market-v2-axis-compare-values">
                      <span>
                        <small>Kader</small>
                        <b>{row.rosterValue != null ? formatCompactNumber(row.rosterValue, 0) : "—"}</b>
                      </span>
                      <span>
                        <small>Kandidat</small>
                        <b>{row.candidateValue != null ? formatCompactNumber(row.candidateValue, 0) : "—"}</b>
                      </span>
                      <span>
                        <small>Δ</small>
                        <b>{formatAxisComparisonDelta(row.delta)}</b>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="market-v2-chip-row">
                {wishlistAxes.length > 0 ? (
                  wishlistAxes.map((axis) => (
                    <span key={`context-axis-${axis}`} className={`market-v2-axis-chip ${AXIS_META[axis].className}`}>
                      Bedarf {AXIS_META[axis].label}
                    </span>
                  ))
                ) : (
                  <span className="market-v2-signal-badge is-neutral">kein akuter Achsenbedarf</span>
                )}
                {wishlistDisciplines.slice(0, 8).map((disciplineName) => (
                  <span key={`context-discipline-${disciplineName}`} className="market-v2-signal-badge is-warning">
                    {disciplineName}
                  </span>
                ))}
              </div>
              <div className="market-v2-context-table-shell">
            <table className="team-table market-v2-context-table">
              <thead>
                <tr>
                  <th>Bild</th>
                  <th>
                    <button className={`sortable-header${wishlistSort.key === "playerName" ? " is-active" : ""}`} type="button" onClick={() => toggleWishlistSort("playerName")}>
                      <span>Gemerkter Spieler</span>
                      <span className="sortable-arrow">{wishlistSort.key === "playerName" ? (wishlistSort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
                    </button>
                  </th>
                  <th>
                    <button className={`sortable-header${wishlistSort.key === "className" ? " is-active" : ""}`} type="button" onClick={() => toggleWishlistSort("className")}>
                      <span>Klasse</span>
                      <span className="sortable-arrow">{wishlistSort.key === "className" ? (wishlistSort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
                    </button>
                  </th>
                  <th>
                    <button className={`sortable-header${wishlistSort.key === "marketValue" ? " is-active" : ""}`} type="button" onClick={() => toggleWishlistSort("marketValue")}>
                      <span>MW</span>
                      <span className="sortable-arrow">{wishlistSort.key === "marketValue" ? (wishlistSort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
                    </button>
                  </th>
                  <th>
                    <button className={`sortable-header${wishlistSort.key === "salary" ? " is-active" : ""}`} type="button" onClick={() => toggleWishlistSort("salary")}>
                      <span>Gehalt</span>
                      <span className="sortable-arrow">{wishlistSort.key === "salary" ? (wishlistSort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
                    </button>
                  </th>
                  <th>
                    <button className={`sortable-header${wishlistSort.key === "bracket" ? " is-active" : ""}`} type="button" onClick={() => toggleWishlistSort("bracket")}>
                      <span>Bracket</span>
                      <span className="sortable-arrow">{wishlistSort.key === "bracket" ? (wishlistSort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
                    </button>
                  </th>
                  {MARKET_AXIS_ORDER.map((axis) => (
                    <th key={`wishlist-head-${axis}`}>
                      <button className={`sortable-header${wishlistSort.key === axis ? " is-active" : ""}`} type="button" onClick={() => toggleWishlistSort(axis)}>
                        <span>{AXIS_META[axis].label}</span>
                        <span className="sortable-arrow">{wishlistSort.key === axis ? (wishlistSort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
                      </button>
                    </th>
                  ))}
                  <th aria-label="Aktionen" />
                </tr>
              </thead>
              <tbody>
                {selectedWishlistEntries.map((entry) => {
                  const marketItem = marketItemByPlayerId.get(entry.playerId);
                  const portrait = marketItem ? getTransfermarktPortraitModel(marketItem) : null;
                  const wishlistPortraitSrc = portrait?.src ?? getPlayerPortraitBrowserUrl(entry.playerId);
                  return (
                    <tr
                      key={entry.id}
                      className="market-v2-wishlist-row"
                      title="Einmal klicken: Kandidat fokussieren. Doppelklick: Kaufdialog öffnen."
                      onDoubleClick={() => openWishlistDeal(entry)}
                    >
                      <td>
                        {wishlistPortraitSrc ? (
                          <OptimizedMediaImage
                            src={wishlistPortraitSrc}
                            alt={entry.playerName}
                            width={42}
                            height={42}
                            className="market-v2-roster-context-portrait"
                          />
                        ) : (
                          <div className="market-v2-roster-context-placeholder">
                            {(portrait?.initials ?? entry.playerName.slice(0, 2)).toUpperCase()}
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          className="table-link-button market-v2-context-player"
                          type="button"
                          onClick={() => queueWishlistFocus(entry)}
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openWishlistDeal(entry);
                          }}
                          title="Einmal klicken: Kandidat fokussieren. Doppelklick: Kaufdialog öffnen."
                        >
                          <strong>{entry.playerName}</strong>
                          <small>{entry.race} · Doppelklick Deal</small>
                        </button>
                      </td>
                      <td>{entry.className}</td>
                      <td>{formatTransfermarktCurrency(entry.marketValue)}</td>
                      <td>{formatTransfermarktCurrency(entry.salary)}</td>
                      <td>{entry.bracket ?? "—"}</td>
                      {MARKET_AXIS_ORDER.map((axis) => {
                        const value = getWishlistAxisValue(entry, marketItem, axis);
                        return (
                          <td key={`wishlist-axis-cell-${entry.id}-${axis}`}>
                            <span className={`market-v2-axis-chip ${AXIS_META[axis].className}`}>
                              {typeof value === "number" && Number.isFinite(value) ? formatCompactNumber(value, 0) : "—"}
                            </span>
                          </td>
                        );
                      })}
                      <td>
                        <button
                          className="secondary-button inline-button market-v2-remove-wishlist-button"
                          type="button"
                          onClick={() => onRemoveWishlist?.(entry.playerId)}
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          title="Spieler von der Wishlist nehmen."
                        >
                          Entfernen
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {selectedWishlistEntries.length === 0 ? (
              <div className="market-v2-empty">
                <strong>Wishlist leer.</strong>
                <p>Nutze die Bedarfssignale oben als Einkaufsliste und merke Kandidaten im Markt, wenn du später vergleichen willst.</p>
              </div>
            ) : null}
              </div>
            </div>
          </details>
        </article>

        <article className="market-v2-context-panel">
          <details className="market-v2-context-details" open>
            <summary className="market-v2-context-summary">
              <span>
                <strong>Aktueller Kader</strong>
                <small>{selectedTeam ? `${selectedTeam.shortCode} · ${selectedTeam.name}` : "Team wählen"} · {selectedRosterRows.length} Spieler</small>
              </span>
              <b>{showRosterDisciplines ? "Diszis an" : "Kompakt"}</b>
            </summary>
            <div className="market-v2-context-details-body">
              <div className="market-v2-context-toolbar">
                <button
                  className={`secondary-button inline-button${showRosterDisciplines ? " is-selected" : ""}`}
                  type="button"
                  onClick={() => setShowRosterDisciplines((current) => !current)}
                  title={showRosterDisciplines ? "Diszi-Spalten im Kader ausblenden." : "Diszi-Spalten wie in der Teamansicht einblenden."}
                >
                  {showRosterDisciplines ? "Diszis ausblenden" : "Diszis anzeigen"}
                </button>
              </div>
              <div className="market-v2-context-table-shell">
            <table className={`team-table market-v2-context-table market-v2-roster-context-table${showRosterDisciplines ? " is-expanded" : ""}`}>
              <thead>
                <tr>
                  <th>Bild</th>
                  <th>Spieler</th>
                  <th>Klasse</th>
                  <th>Rasse</th>
                  <th>PPs</th>
                  <th>OVR</th>
                  <th>MVS</th>
                  <th>MW</th>
                  <th>Gehalt</th>
                  <th>Value</th>
                  <th>LZ</th>
                  <th>POW</th>
                  <th>SPE</th>
                  <th>MEN</th>
                  <th>SOC</th>
                  {showRosterDisciplines
                    ? orderedDisciplines.map((discipline) => (
                        <th className={`market-v2-roster-discipline-head is-${discipline.category}`} key={`roster-discipline-head-${discipline.id}`}>
                          {getDisciplineAbbreviation(discipline.id, discipline.name)}
                        </th>
                      ))
                    : null}
                  {onSell && manageableTeamIdSet.has(selectedTeamId) ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {selectedRosterRows.map((row) => (
                  <tr key={row.activePlayerId} onDoubleClick={() => onOpenPlayerDetails?.({ playerId: row.playerId, activePlayerId: row.activePlayerId })}>
                    <td>
                      {row.portraitUrl ? (
                        <OptimizedMediaImage
                          src={row.portraitUrl}
                          alt={row.name}
                          width={42}
                          height={42}
                          className="market-v2-roster-context-portrait"
                        />
                      ) : (
                        <div className="market-v2-roster-context-placeholder">{row.name.slice(0, 2).toUpperCase()}</div>
                      )}
                    </td>
                    <td>
                      <button
                        className="table-link-button market-v2-context-player"
                        type="button"
                        onClick={() => onOpenPlayerDetails?.({ playerId: row.playerId, activePlayerId: row.activePlayerId })}
                      >
                        <strong>{row.name}</strong>
                        <small>Doppelklick Details</small>
                      </button>
                    </td>
                    <td>
                      <span className="market-v2-roster-icon-cell">
                        <ClassIcon classNameValue={row.className} showLabel={false} className="market-v2-filter-icon-chip" iconClassName="market-v2-filter-icon" />
                        <small>{row.className}</small>
                      </span>
                    </td>
                    <td>
                      <span className="market-v2-roster-icon-cell">
                        <RaceIcon race={row.race ?? "—"} showLabel={false} className="market-v2-filter-icon-chip" iconClassName="market-v2-filter-icon" />
                        <small>{row.race ?? "—"}</small>
                      </span>
                    </td>
                    <td>{formatCompactNumber(row.pps, 1)}</td>
                    <td>{formatCompactNumber(row.ovr, 0)}</td>
                    <td>{formatCompactNumber(row.mvs, 1)}</td>
                    <td>{formatTransfermarktCurrency(row.marketValue)}</td>
                    <td>{formatTransfermarktCurrency(row.salary)}</td>
                    <td>{formatTransfermarktRatio(row.valueScore ?? null)}</td>
                    <td>{row.contractLength ?? "—"}</td>
                    <td><span className="market-v2-axis-chip is-pow">{formatCompactNumber(row.pow, 0)}</span></td>
                    <td><span className="market-v2-axis-chip is-spe">{formatCompactNumber(row.spe, 0)}</span></td>
                    <td><span className="market-v2-axis-chip is-men">{formatCompactNumber(row.men, 0)}</span></td>
                    <td><span className="market-v2-axis-chip is-soc">{formatCompactNumber(row.soc, 0)}</span></td>
                    {showRosterDisciplines
                      ? orderedDisciplines.map((discipline) => (
                          <td className={`market-v2-roster-discipline-cell is-${discipline.category}`} key={`roster-discipline-${row.activePlayerId}-${discipline.id}`}>
                            {formatCompactNumber(row.disciplineRatings?.[discipline.id] ?? null, 0)}
                          </td>
                        ))
                      : null}
                    {onSell && manageableTeamIdSet.has(selectedTeamId) ? (
                      <td>
                        <button
                          className="secondary-button inline-button"
                          type="button"
                          title={`${row.name} verkaufen`}
                          onClick={() =>
                            onSell({
                              activePlayerId: row.activePlayerId,
                              playerId: row.playerId,
                              playerName: row.name,
                              className: row.className,
                              race: row.race ?? null,
                              portraitUrl: row.portraitUrl ?? null,
                            })
                          }
                        >
                          Verkaufen
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedRosterRows.length === 0 ? (
              <div className="market-v2-empty">
                <strong>Noch kein Kader im Fokus.</strong>
                <p>Wähle ein Team, dann siehst du hier direkt, woran du deine Käufe ausrichten kannst.</p>
              </div>
            ) : null}
              </div>
            </div>
          </details>
        </article>
      </section>

      <section className="market-v2-bottom-grid">
        <article className="market-v2-activity-panel">
          <div className="market-v2-section-head">
            <strong>Aktuelle Season-Deals</strong>
            <small>{historyItems.length} sichtbar</small>
          </div>
          <div className="market-v2-activity-list">
            {historyItems.map((entry) => (
              <button
                className="market-v2-activity-row"
                key={entry.transferId}
                type="button"
                onClick={() => onOpenPlayerDetails?.({ playerId: entry.playerId })}
              >
                <div>
                  <strong className="market-v2-clickable">{entry.playerName}</strong>
                  <small>
                    {entry.type === "buy"
                      ? `${entry.toTeamName ?? "—"} kauft von ${entry.fromTeamName ?? "Free Agent"}`
                      : `${entry.fromTeamName ?? "—"} verkauft an ${entry.toTeamName ?? "—"}`}
                  </small>
                </div>
                <div className="market-v2-activity-numbers">
                  <strong>{formatTransfermarktCurrency(entry.fee)}</strong>
                  <small>{entry.seasonLabel}</small>
                </div>
              </button>
            ))}
            {historyItems.length === 0 ? (
              <div className="market-v2-empty">
                <strong>Noch keine Deals im aktuellen Scope.</strong>
                <p>Hier landen die Käufe und Verkäufe der gewählten Season direkt im Spielfluss.</p>
              </div>
            ) : null}
          </div>
        </article>

        <article className="market-v2-activity-panel">
          <div className="market-v2-section-head">
            <strong>Pool-Snapshot</strong>
            <small>{marketFeed?.poolAudit.activeFreeAgentCount ?? 0} aktive Free Agents</small>
          </div>
          <div className="market-v2-bucket-grid">
            {(marketFeed?.poolAudit.marketValueBrackets ?? []).map((bucket) => (
              <div className="market-v2-bucket-card" key={bucket.label}>
                <span>{bucket.label}</span>
                <strong>{bucket.count}</strong>
                <small>MW {bucket.rangeLabel}</small>
              </div>
            ))}
          </div>
          <p className="muted">
            Sichtbare Kandidaten {marketFeed?.poolAudit.visibleFeedCount ?? 0} · aktiver Marktpool{" "}
            {marketFeed?.poolAudit.activeFreeAgentCount ?? 0}
          </p>
        </article>
      </section>

      {buyModalOpen ? (
        <div className="foundation-modal-backdrop" onClick={closeBuyModal}>
          <div className="foundation-modal transfer-buy-modal" ref={buyModalRef} onClick={(event) => event.stopPropagation()}>
            <div className="foundation-modal-header">
              <div>
                <span className="market-v2-kicker">Kaufdialog</span>
                <h3>{selectedPlayer?.name ?? "Spieler prüfen"}</h3>
                <p className="muted">
                  {selectedPlayer
                    ? `${selectedPlayer.className} · ${selectedPlayer.race} · ${selectedPlayer.alignment || "ohne Fraktion"}`
                    : buyModalWishlistEntry
                      ? `${buyModalWishlistEntry.className} · ${buyModalWishlistEntry.race}`
                      : "Bitte zuerst einen Kandidaten wählen."}
                </p>
              </div>
              <button className="secondary-button" type="button" onClick={closeBuyModal} disabled={buyBusy}>
                Schließen
              </button>
            </div>

            <div className="foundation-modal-body transfer-buy-modal-body" ref={buyModalBodyRef}>
              <div className="transfer-buy-player-line">
                <div className="transfer-modal-player-hero">
                  {selectedPortrait?.src ? (
                    <OptimizedMediaImage
                      src={selectedPortrait.src}
                      alt={modalPlayerName}
                      width={72}
                      height={72}
                      className="transfermarkt-portrait"
                    />
                  ) : buyModalWishlistEntry ? (
                    <OptimizedMediaImage
                      src={getPlayerPortraitBrowserUrl(buyModalWishlistEntry.playerId)}
                      alt={modalPlayerName}
                      width={72}
                      height={72}
                      className="transfermarkt-portrait"
                    />
                  ) : (
                    <div className="transfermarkt-portrait transfermarkt-portrait-placeholder" aria-label={`${modalPlayerName} placeholder`}>
                      {(selectedPortrait?.initials ?? modalPlayerName.slice(0, 2)).toUpperCase()}
                    </div>
                  )}
                  <div className="transfer-modal-player-summary">
                    <div className="transfer-modal-player-head">
                      <strong>{modalPlayerName}</strong>
                      <div className="transfer-modal-player-meta">
                        <ClassIcon classNameValue={modalPlayerClass} showLabel={false} />
                        <span className="muted">{modalPlayerClass}</span>
                        <span className="muted">{modalPlayerRace}</span>
                        <span className="pill">Bracket {modalPlayerBracket != null ? formatCompactNumber(modalPlayerBracket, 0) : "—"}</span>
                        <span className="pill">{selectedTeam ? `${selectedTeam.shortCode} · ${selectedTeam.name}` : "Kein Team gewählt"}</span>
                      </div>
                    </div>
                    <div className="transfer-modal-player-kpis">
                      <article className="transfer-modal-kpi">
                        <span>Marktwert</span>
                        <strong>{formatTransfermarktCurrency(modalPlayerMarketValue)}</strong>
                      </article>
                      <article className="transfer-modal-kpi">
                        <span>Basisgehalt</span>
                        <strong>{formatTransfermarktCurrency(modalPlayerSalary)}</strong>
                      </article>
                      <article className="transfer-modal-kpi">
                        <span>Aktuelle Forderung</span>
                        <strong>{formatTransfermarktCurrency(buyPreview?.expectedSalary ?? null)}</strong>
                      </article>
                      <article className="transfer-modal-kpi">
                        <span>Zusage</span>
                        <strong>{formatPercentLabel(buyPreview?.acceptChance)}</strong>
                      </article>
                    </div>
                  </div>
                </div>
                <span className={`transfer-status-pill${buyPreview?.canBuy ? " is-ready" : " is-blocked"}`}>
                  {source !== "sqlite" ? "nur Ansicht" : buyPreview?.canBuy ? "bereit" : "pruefen"}
                </span>
              </div>

              {previewBusy && !buyPreview ? (
                <div className="transfer-feedback-banner">
                  <strong>Kaufvorschau lädt</strong>
                  <span>Forderung, Vertrag und Teamwirkung werden gerade berechnet.</span>
                </div>
              ) : null}
              {previewError ? (
                <div className="transfer-feedback-banner is-error">
                  <strong>Vorschau blockiert</strong>
                  <span>{previewError}</span>
                </div>
              ) : null}
              {buySuccess ? (
                <div className="transfer-feedback-banner is-success">
                  <strong>Kauf erfolgreich</strong>
                  <span>{buySuccess}</span>
                </div>
              ) : null}
              {source !== "sqlite" ? (
                <div className="transfer-feedback-banner is-info">
                  <strong>Read-only</strong>
                  <span>Hier kannst du alles prüfen, aber in diesem Modus keinen Kauf final schreiben.</span>
                </div>
              ) : null}
              {priorBadExperienceActive ? (
                <div className="transfer-feedback-banner is-warning">
                  <strong>Spieler ist noch angefressen</strong>
                  <span>
                    {priorBadExperienceDemandEntry
                      ? `Die letzte Verhandlung mit diesem Team wirkt noch nach. Seine Forderung liegt dadurch aktuell bei ${formatDemandPercent(priorBadExperienceDemandEntry.percent)} und die Zusage ist spuerbar schlechter.`
                      : "Die letzte Verhandlung mit diesem Team wirkt noch nach. Dadurch fordert der Spieler mehr und verhandelt misstrauischer."}
                  </span>
                </div>
              ) : null}

              <ContractOfferClient
                playerName={modalPlayerName}
                roleLabel={modalPlayerClass}
                expectedSalary={buyPreview?.expectedSalary ?? null}
                offeredSalary={modalOfferValue}
                contractLength={activeContractLength}
                contractShape={activeContractShape}
                budgetAvailable={buyPreview?.cashBefore ?? null}
                acceptChance={buyPreview?.acceptChance ?? null}
                counterChance={buyPreview?.counterChance ?? null}
                rejectChance={buyPreview?.rejectChance ?? null}
                negotiationOutcome={
                  buyNegotiationOutcome
                    ? {
                        title: buyNegotiationOutcome.title,
                        message: buyNegotiationOutcome.message,
                        tone: buyNegotiationOutcome.tone,
                      }
                    : null
                }
                busy={buyBusy}
                onContractLengthChange={(value) => {
                  setBuyNegotiationOutcome(null);
                  setContractLength(value);
                }}
                onContractShapeChange={(value) => {
                  setBuyNegotiationOutcome(null);
                  setContractShape(value);
                }}
                onSalaryChange={(value) => {
                  setBuyNegotiationOutcome(null);
                  setOfferedSalary(value);
                  setSalaryEditedManually(value != null);
                }}
                onResetSuggestion={resetBuyDemandFrame}
                onSendOffer={() => void negotiateBuy()}
                onCancel={closeBuyModal}
              />

              <div className="transfer-modal-section transfer-callout is-info transfer-compact-feedback-callout">
                <div className="transfer-callout-title">
                  <strong>Kompakt: Was er am Vertrag mag</strong>
                  <span className="muted">schneller Check ohne Scrollen</span>
                </div>
                <div className="transfer-compact-feedback-grid">
                    <div className="transfer-compact-feedback-column">
                      <span className="muted">Passt gut</span>
                      <div className="negotiation-factor-list">
                        {compactNegotiationFeedback.likes.length ? (
                          compactNegotiationFeedback.likes.map((entry) => (
                            <span className="negotiation-factor is-positive" key={`buy-like-${entry}`}>
                              {entry}
                            </span>
                          ))
                        ) : (
                          <span className="negotiation-factor is-neutral">Noch kein klarer Pluspunkt sichtbar</span>
                        )}
                      </div>
                    </div>
                    <div className="transfer-compact-feedback-column">
                      <span className="muted">Stoert ihn</span>
                      <div className="negotiation-factor-list">
                        {compactNegotiationFeedback.concerns.length ? (
                          compactNegotiationFeedback.concerns.map((entry) => (
                            <span className="negotiation-factor is-negative" key={`buy-concern-${entry}`}>
                              {entry}
                            </span>
                          ))
                        ) : (
                          <span className="negotiation-factor is-positive">Aktuell kein klarer Vertrags-Nachteil</span>
                        )}
                        {priorBadExperienceScoreEntry ? (
                          <span className="negotiation-factor is-negative">
                            {priorBadExperienceScoreEntry.label}: {priorBadExperienceScoreEntry.reason}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
              </div>

                {contractPreference ? (
                  <div className={`contract-preference-card is-${contractPreference.matchQuality}`}>
                    <div>
                      <span className="eyebrow">Spielerwunsch</span>
                      <strong>{formatContractLengthPreference(contractPreference.lengthPreference)}</strong>
                      <p className="muted">
                        Wunschfenster {contractPreference.preferredMinLength}-{contractPreference.preferredMaxLength} Saisons · am liebsten{" "}
                        {contractPreference.idealLength} · Form {formatContractShapeLabel(contractPreference.shapePreference)}
                      </p>
                      <p className="muted">
                        {formatContractPreferenceCurrentStatus(
                          contractPreference,
                          activeContractLength,
                          activeContractShape,
                        )}
                      </p>
                    </div>
                    <div className="contract-preference-impact">
                      <span className={contractSalaryAdjustmentPct != null && contractSalaryAdjustmentPct <= 0 ? "positive-value" : "negative-value"}>
                        {formatSignedPercentDelta(contractSalaryAdjustmentPct)} Gehalt
                      </span>
                      <span className={contractScoreAdjustment != null && contractScoreAdjustment >= 0 ? "positive-value" : "negative-value"}>
                        {formatSignedPoints(contractScoreAdjustment)} Score
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="metric-grid compact">
                  <article className="metric-card">
                    <span>Basisforderung</span>
                    <strong>{formatTransfermarktCurrency(buyPreview?.baseExpectedSalary ?? null)}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Aktuelle Forderung</span>
                    <strong>{formatTransfermarktCurrency(buyPreview?.expectedSalary ?? null)}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Forderungsfaktor</span>
                    <strong>{buyPreview?.demandMultiplier != null ? `${formatCompactNumber(buyPreview.demandMultiplier * 100, 0)}%` : "—"}</strong>
                  </article>
                  <article className="metric-card">
                    <span>Zusage / Nachf. / Absage</span>
                    <strong className="negotiation-chance-row">
                      <span className="is-positive">{formatPercentLabel(buyPreview?.acceptChance)}</span>
                      <span className="is-warning">{formatPercentLabel(buyPreview?.counterChance)}</span>
                      <span className="is-negative">{formatPercentLabel(buyPreview?.rejectChance)}</span>
                    </strong>
                  </article>
                  <article className="metric-card">
                    <span>Buyout</span>
                    <strong>{formatTransfermarktCurrency(buyPreview?.buyoutCost ?? null)}</strong>
                  </article>
                </div>
                {buyPreview?.demandBreakdown?.length ? (
                  <div className="transfer-demand-breakdown">
                    <div className="transfer-callout-title">
                      <strong>So entsteht die Forderung</strong>
                      <span className="muted">
                        {formatTransfermarktCurrency(buyPreview.baseExpectedSalary ?? null)} → {formatTransfermarktCurrency(buyPreview.expectedSalary ?? null)}
                      </span>
                    </div>
                    <ul className="warning-list negotiation-factor-list">
                      {buyPreview.demandBreakdown.map((entry) => (
                        <li className={`negotiation-factor is-${entry.tone}`} key={entry.key}>
                          <strong>{formatDemandPercent(entry.percent)}</strong>
                          <span>{entry.label}: {entry.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

              {buyPreview ? (
                <>
                  <div className="transfer-modal-section transfer-callout is-info">
                    <div className="transfer-callout-title">
                      <strong>Jahresplan</strong>
                      <span className="muted">
                        {formatContractShapeLabel(buyPreview.contractShape ?? activeContractShape)} · {buyPreview.contractLength} Saison{buyPreview.contractLength === 1 ? "" : "en"}
                      </span>
                    </div>
                    {buyPreview.yearlySalarySchedule?.length ? (
                      <div className="contract-schedule-table" role="table" aria-label="Vertrags-Jahresplan">
                        <div className="contract-schedule-row is-head" role="row">
                          <span>Jahr</span>
                          <span>Season</span>
                          <span>Gehalt</span>
                        </div>
                        {buyPreview.yearlySalarySchedule.map((entry) => (
                          <div className="contract-schedule-row" role="row" key={`${entry.label}-${entry.yearIndex}`}>
                            <span>Jahr {entry.yearIndex}</span>
                            <span>{entry.label}</span>
                            <strong>{formatTransfermarktCurrency(entry.salary)}</strong>
                          </div>
                        ))}
                        <div className="contract-schedule-row is-total" role="row">
                          <span>Summe</span>
                          <span>Buyout {formatTransfermarktCurrency(buyPreview.buyoutCost ?? null)}</span>
                          <strong>{formatTransfermarktCurrency(buyPreview.totalSalary ?? null)}</strong>
                        </div>
                      </div>
                    ) : (
                      <p className="muted">Noch kein Jahresplan verfuegbar.</p>
                    )}
                    <p className="muted" style={{ marginTop: 8 }}>
                      Forderungsweg: Basis {formatTransfermarktCurrency(buyPreview.baseExpectedSalary ?? null)} · aktuelle Forderung{" "}
                      {formatTransfermarktCurrency(buyPreview.expectedSalary ?? null)} · Gesamtverschiebung {formatTransfermarktCurrency(marketAndFitDelta)}
                      {fitSalaryDiscountActive ? " · Fit-Bonus zuletzt aktiv" : ""}
                    </p>
                  </div>

                  <div className="transfer-modal-section">
                    <div className="transfer-callout-title">
                      <strong>Team-Auswirkung</strong>
                      <span className="muted">Sofort sichtbar, final erst beim Abschluss</span>
                    </div>
                    <div className="metric-grid compact">
                      <article className="metric-card">
                        <span>Kaufpreis / Abloese</span>
                        <strong>{formatTransfermarktCurrency(buyPreview.purchasePrice)}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Cash vorher / nachher</span>
                        <strong>{formatTransfermarktCurrency(buyPreview.cashBefore)} / {formatTransfermarktCurrency(buyPreview.cashAfter)}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Kader vorher / nachher</span>
                        <strong>{buyPreview.rosterBefore ?? "—"} / {buyPreview.rosterAfter ?? "—"}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Gehalt vorher / nachher</span>
                        <strong>{formatTransfermarktCurrency(buyPreview.salaryBefore)} / {formatTransfermarktCurrency(buyPreview.salaryAfter)}</strong>
                      </article>
                      <article className="metric-card">
                        <span>MW vorher / nachher</span>
                        <strong>{formatTransfermarktCurrency(buyPreview.marketValueBefore)} / {formatTransfermarktCurrency(buyPreview.marketValueAfter)}</strong>
                      </article>
                      <article className="metric-card">
                        <span>Rolle</span>
                        <strong>{buyPreview.promisedRole ?? "offen"}</strong>
                      </article>
                    </div>
                  </div>

                  <div className="transfer-buy-meta-grid">
                    <div className="transfer-callout is-blocked">
                      <div className="transfer-callout-title">
                        <strong>Blocker</strong>
                        <span className="muted">{buyPreview.blockingReasons.length}</span>
                      </div>
                      {buyPreview.blockingReasons.length > 0 ? (
                        <ul className="warning-list negotiation-factor-list">
                          {buyPreview.blockingReasons.map((reason) => (
                            <li className="negotiation-factor is-negative" key={reason}>{formatNegotiationSignalLabel(reason)}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Keine blockierenden Gruende.</p>
                      )}
                    </div>
                    <div className="transfer-callout is-warning">
                      <div className="transfer-callout-title">
                        <strong>Hinweise</strong>
                        <span className="muted">{buyPreview.warnings.length}</span>
                      </div>
                      {buyPreview.warnings.length > 0 ? (
                        <ul className="warning-list negotiation-factor-list">
                          {buyPreview.warnings.map((warning) => (
                            <li className="negotiation-factor is-negative" key={warning}>{formatNegotiationSignalLabel(warning)}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Keine Warnungen.</p>
                      )}
                    </div>
                    <div className="transfer-callout is-info">
                      <div className="transfer-callout-title">
                        <strong>Warum der Deal so ausfällt</strong>
                        <span className="muted">{buyPreview.negotiationScoreBreakdown?.length ?? 0} Faktoren</span>
                      </div>
                      {buyPreview.negotiationScoreBreakdown?.length ? (
                        <ul className="warning-list negotiation-factor-list">
                          {buyPreview.negotiationScoreBreakdown.map((entry) => (
                            <li className={`negotiation-factor is-${entry.tone}`} key={entry.key}>
                              <strong>{entry.points > 0 ? `+${entry.points}` : entry.points}</strong>
                              <span>{entry.label}: {entry.reason}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Noch keine Score-Faktoren verfuegbar.</p>
                      )}
                      {buyPreview.negotiationReasons?.length ? (
                        <>
                          <p className="muted" style={{ marginTop: 8 }}>Treiber</p>
                          <ul className="warning-list negotiation-factor-list">
                            {buyPreview.negotiationReasons.map((reason) => (
                              <li className="negotiation-factor is-positive" key={reason}>{formatNegotiationSignalLabel(reason)}</li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                      {buyPreview.negotiationWarnings?.length ? (
                        <>
                          <p className="muted" style={{ marginTop: 8 }}>Risiken</p>
                          <ul className="warning-list negotiation-factor-list">
                            {buyPreview.negotiationWarnings.map((warning) => (
                              <li className="negotiation-factor is-negative" key={warning}>{formatNegotiationSignalLabel(warning)}</li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <p className="muted transfer-empty-hint">
                  Kaufvorschau wird geladen oder ist fuer diesen Kontext noch nicht verfuegbar.
                </p>
              )}
            </div>

            <div className="foundation-modal-actions">
              <button className="secondary-button" type="button" onClick={closeBuyModal} disabled={buyBusy}>
                Abbrechen
              </button>
              <button
                className={buyNegotiationOutcome?.status === "accepted" ? "primary-button" : "secondary-button"}
                type="button"
                disabled={source !== "sqlite" || !selectedTeamCanManage || previewBusy || buyBusy || !selectedPlayer || !selectedTeamId || !buyPreview?.canBuy || buyNegotiationOutcome?.status === "rejected"}
                onClick={() => void negotiateBuy()}
                title={
                  source !== "sqlite"
                    ? "Im Referenzmodus bleibt die Verhandlung gesperrt."
                    : !buyPreview?.canBuy
                      ? buyPreview?.blockingReasons?.map(formatNegotiationSignalLabel).join(" · ") || "Der Deal ist noch nicht bereit."
                      : buyNegotiationOutcome?.status === "rejected"
                        ? "Nach einer Absage erst Angebot oder Vertrag anpassen."
                        : "Verhandlung starten und Reaktion der Gegenseite prüfen."
                }
              >
                {buyBusy ? "verhandelt..." : buyNegotiationOutcome?.status === "accepted" ? "Annahme liegt vor" : "Verhandeln"}
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={source !== "sqlite" || !selectedTeamCanManage || previewBusy || buyBusy || !selectedPlayer || !selectedTeamId || !buyPreview?.canBuy || buyNegotiationOutcome?.status !== "accepted"}
                onClick={() => void confirmBuy()}
                title={finalBuyDisabledReason ?? "Bestätigt den Kauf jetzt final in deinem lokalen Spielstand."}
              >
                {buyBusy ? "kauft..." : "Kauf final abschließen"}
              </button>
            </div>
            {finalBuyDisabledReason ? <p className="foundation-screen-action-reason">Warum nicht: {finalBuyDisabledReason}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
