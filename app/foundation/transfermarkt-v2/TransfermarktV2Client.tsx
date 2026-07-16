"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { getClassColorToken } from "@/app/foundation/ClassColorChip";
import { FoundationShellRouterMarketBuy } from "@/app/foundation/FoundationShellRouter";
import TransfermarktV2NewLook from "@/app/foundation/transfermarkt-v2/TransfermarktV2NewLook";
import type { ContractShape, Discipline, Team, TeamControlMode, TeamSeasonObjectiveRecord, TransferWishlistEntry } from "@/lib/data/olyDataTypes";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";
import { getTransfermarktPortraitModel } from "@/lib/market/transfermarkt-lab";
import type { TransferHistoryReadResult } from "@/lib/market/transfer-history-read-service";
import type { TransfermarktBuyPreview } from "@/lib/market/transfermarkt-buy-service";
import { filterTransfermarktFreeAgentsByBracket, type TransfermarktPoolBracketBucket } from "@/lib/market/transfermarkt-pool-audit";
import type { TransfermarktFreeAgentItem, TransfermarktReadResult } from "@/lib/market/transfermarkt-read-service";
import { getScoutingTierWindow, resolveScoutingConfidenceFromLevel } from "@/lib/market/transfermarkt-scouting";
import { computeCompositeTopSixAverage, computeDisciplineTopSixImpact, computeTopSixAxisImpact, computeCandidateAxisTeamRankEstimates } from "@/lib/market/transfermarkt-roster-impact";
import { officialDisciplineWeightOrder, type OfficialDisciplineWeightId } from "@/lib/player-generator/official-discipline-weights";
import { appendRoomContextToParams, readFoundationRoomContextFromLocation, withRoomContextBody, type FoundationRoomContext } from "@/lib/room/foundation-room-context-client";
import { formatMarketPreviewError } from "@/lib/room/parse-room-write-context";
import { DEFAULT_ACTIVE_OWNER_ID } from "@/lib/foundation/team-control-settings";
import type { MarketBuyNegotiationOutcome } from "@/lib/foundation/tabs/use-market-buy-derivations";

export type TransfermarktV2ClientProps = {
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
  playerRatingsById?: Map<
    string,
    { ovrRank?: number | null; ppsSeasonRank?: number | null; mvsRank?: number | null; ppsSeason?: number | null }
  >;
  wishlistEntries?: TransferWishlistEntry[];
  wishlistPlayerIds?: string[];
  boardObjectiveHighlights?: TeamSeasonObjectiveRecord[];
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
  onOpenHistory?: (() => void) | null;
  onToggleWishlist?: ((item: TransfermarktFreeAgentItem) => void) | null;
  onRemoveWishlist?: ((playerId: string) => void) | null;
  scoutingWatchPlayerIds?: string[];
  scoutingIntelByPlayerId?: Record<string, number>;
  scoutingPipelineCapacity?: { occupied: number; max: number | null; draftSuspended?: boolean } | null;
  scoutingActiveWishlistPlayerIds?: string[];
  onToggleScoutingWatch?: ((item: TransfermarktFreeAgentItem) => void) | null;
  onBuyCompleted?: ((teamId: string) => Promise<void> | void) | null;
  initialPlayerId?: string | null;
  onInitialPlayerFocusConsumed?: (() => void) | null;
  offerPanelActive?: boolean;
  onOpenOfferPanel?: (playerId: string) => void;
  onCloseOfferPanel?: () => void;
  onSell?: ((payload: { activePlayerId: string; playerId: string; playerName: string; className: string; race: string | null; portraitUrl: string | null }) => void) | null;
  roomContext?: FoundationRoomContext | null;
  /**
   * Transferfenster-Status (additiv). Fehlt der Prop, bleibt der Markt voll
   * bedienbar (Default „offen"). Ist das Fenster geschlossen, degradiert die
   * Ansicht zu Read-only: Markt/Scouting bleiben sichtbar, nur Kauf/Verkauf
   * werden gesperrt.
   */
  transferWindow?: { open: boolean; canBuy: boolean; canSell: boolean; phaseLabel: string };
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
  /** Blendet Kandidaten mit fit < 0 aus (Söldner bleiben sichtbar). Default an. */
  hidePoorFit: boolean;
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
export type TransfermarktV2RosterRow = {
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
  previousSeasonAxis?: {
    seasonId: string;
    ppPow: number | null;
    ppSpe: number | null;
    ppMen: number | null;
    ppSoc: number | null;
    ppPowRank: number | null;
    ppSpeRank: number | null;
    ppMenRank: number | null;
    ppSocRank: number | null;
  } | null;
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

const LABEL_MAP: Record<string, string> = {
  affordable: "bezahlbar",
  under_opt: "unter Soll",
  over_opt: "über Soll",
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
    hidePoorFit: true,
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
    hidePoorFit: typeof value.hidePoorFit === "boolean" ? value.hidePoorFit : defaults.hidePoorFit,
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

function formatToneLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  return LABEL_MAP[value] ?? value.replaceAll("_", " ");
}

function formatReadinessLabel(value: string | null | undefined) {
  if (!value) {
    return "unbekannt";
  }
  return value.replaceAll("_", " ");
}

function formatNegotiationSignalLabel(value: string) {
  const labels: Record<string, string> = {
    insufficient_cash: "Cash reicht für Kauf oder Gesamtpaket noch nicht.",
    low_team_fit_reduces_acceptance: "Schwacher Teamfit drueckt die Zusage.",
    local_team_not_owned_or_ai_controlled: "Dieses Team ist hier nur Ansicht und kann keine Deals schreiben.",
    market_bracket_factor_preview_pending: "Marktklasse ist nur grob eingeschaetzt.",
    negotiation_cancelled_after_contact: "Abbruch nach Kontakt bleibt als Vertrauensmalus hängen.",
    negotiation_rejected_bad_experience: "Die letzte Absage macht die nächste Runde härter.",
    offer_below_expected_salary: "Angebot liegt unter der aktuellen Forderung.",
    previous_rejected_offer_reduces_trust: "Spieler ist nach der letzten Runde noch angefressen und verhandelt härter.",
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

/** Auf Wunsch entfernter Hinweis — Laufzeit-Abweichung ist kein eigener UI-Hinweis mehr. */
const SUPPRESSED_NEGOTIATION_WARNING_CODES = new Set(["contract_length_override_in_effect"]);

function filterVisibleNegotiationWarnings(warnings: string[] | null | undefined): string[] {
  return (warnings ?? []).filter((code) => !SUPPRESSED_NEGOTIATION_WARNING_CODES.has(code));
}

function formatCandidateAvailabilityLabel(teamCode: string | null | undefined, availableCount: number | null | undefined) {
  const safeCount = typeof availableCount === "number" && Number.isFinite(availableCount) ? availableCount : 0;
  if (teamCode) {
    return `${safeCount} für ${teamCode} verfügbar`;
  }
  return `${safeCount} im Markt`;
}

function toggleSelection<T extends string>(current: T[], value: T) {
  return current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
}

function passesMarketMinFitFilter(item: TransfermarktFreeAgentItem, minFit: number) {
  if (minFit <= 0) {
    return true;
  }
  return (item.fit ?? Number.NEGATIVE_INFINITY) >= minFit;
}

/**
 * Fit-Sichtbarkeitsfilter (Default an): blendet Kandidaten mit negativem Fit
 * aus — AUSSER Söldnern (`mercenary === true`), die immer sichtbar bleiben.
 * Reduziert die Kandidatenliste auf real passende Optionen.
 */
function passesMarketFitVisibilityFilter(item: TransfermarktFreeAgentItem, hidePoorFit: boolean) {
  if (!hidePoorFit) {
    return true;
  }
  if (item.mercenary === true) {
    return true;
  }
  return (item.fit ?? Number.NEGATIVE_INFINITY) >= 0;
}

function passesMarketAxisFilters(
  item: TransfermarktFreeAgentItem,
  axisMinimums: Record<MarketAxisKey, number>,
) {
  // Jeder Achs-Mindestwert filtert eigenständig (unabhängig voneinander); 0 = aus.
  return (Object.keys(axisMinimums) as MarketAxisKey[]).every((axis) => {
    const minimum = axisMinimums[axis];
    if (minimum <= 0) {
      return true;
    }
    const value = item[axis];
    return typeof value === "number" && Number.isFinite(value) && value >= minimum;
  });
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
  playerRatingsById = new Map(),
  wishlistEntries = [],
  wishlistPlayerIds = [],
  boardObjectiveHighlights = [],
  onOpenPlayerDetails,
  onOpenHistory,
  onToggleWishlist,
  onRemoveWishlist,
  scoutingWatchPlayerIds = [],
  scoutingIntelByPlayerId = {},
  scoutingPipelineCapacity = null,
  scoutingActiveWishlistPlayerIds = [],
  onToggleScoutingWatch,
  onBuyCompleted,
  initialPlayerId = null,
  onInitialPlayerFocusConsumed = null,
  offerPanelActive = false,
  onOpenOfferPanel,
  onCloseOfferPanel,
  onSell,
  roomContext: roomContextProp = null,
  transferWindow,
}: TransfermarktV2ClientProps) {
  // Transferfenster: fehlt der Prop -> als offen behandeln (kein Regress ohne Wiring).
  const transferWindowOpen = transferWindow?.open ?? true;
  const transferCanBuy = transferWindow?.canBuy ?? true;
  const transferCanSell = transferWindow?.canSell ?? true;
  const marketReadOnlyReason = "Transferfenster geschlossen — nur Ansicht.";
  const marketWindowNotice = transferWindowOpen
    ? null
    : transferWindow?.phaseLabel
      ? `Transferfenster geschlossen (${transferWindow.phaseLabel}) — Markt und Scouting bleiben offen, Kauf und Verkauf sind gesperrt.`
      : `${marketReadOnlyReason} Markt und Scouting bleiben sichtbar, Kauf und Verkauf sind gesperrt.`;
  const roomContextRef = useRef<FoundationRoomContext | null>(roomContextProp ?? readFoundationRoomContextFromLocation());
  useEffect(() => {
    roomContextRef.current = roomContextProp ?? readFoundationRoomContextFromLocation();
  }, [roomContextProp]);
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
  const poolBracketAbortRef = useRef<AbortController | null>(null);
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
  const [hidePoorFit, setHidePoorFit] = useState(true);
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
  const [buyNegotiationOutcome, setBuyNegotiationOutcome] = useState<MarketBuyNegotiationOutcome | null>(null);
  const buyModalOpen = offerPanelActive;

  function activateOfferPanel(playerId?: string) {
    const targetId = playerId ?? selectedPlayer?.playerId ?? buyModalWishlistEntry?.playerId;
    if (targetId) {
      onOpenOfferPanel?.(targetId);
    }
  }

  function deactivateOfferPanel() {
    onCloseOfferPanel?.();
  }

  const [buyModalWishlistEntry, setBuyModalWishlistEntry] = useState<TransferWishlistEntry | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [filterStorageReady, setFilterStorageReady] = useState(false);
  const [filterPresets, setFilterPresets] = useState<MarketFilterPreset[]>([]);
  const [filterPresetMessage, setFilterPresetMessage] = useState<string | null>(null);
  const [selectedDisciplineLens, setSelectedDisciplineLens] = useState<OfficialDisciplineWeightId | "">("");
  const [wishlistSort, setWishlistSort] = useState<WishlistSortState>({ key: "createdAt", direction: "desc" });
  const [poolBracketPanel, setPoolBracketPanel] = useState<TransfermarktPoolBracketBucket | null>(null);
  const [poolBracketItems, setPoolBracketItems] = useState<TransfermarktFreeAgentItem[]>([]);
  const [poolBracketBusy, setPoolBracketBusy] = useState(false);

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
    setHidePoorFit(snapshot.hidePoorFit);
  }

  function resetMarketFilters() {
    applyMarketFilterSnapshot(createDefaultMarketFilterSnapshot());
    setFilterPresetMessage("Filter zurückgesetzt.");
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
      hidePoorFit,
    }),
    [axisMinimums, hidePoorFit, maxRatio, maxSalary, maxValue, minFit, search, selectedAxes, selectedClassAxes, selectedClassNames, selectedDisciplineLens, selectedRaceNames, sortMode],
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
  // Anzahl aktiver Achs-Mindestwerte (> 0) — jeder filtert eigenständig.
  const activeAxisMinimumCount = (Object.keys(axisMinimums) as MarketAxisKey[]).filter(
    (axis) => axisMinimums[axis] > 0,
  ).length;

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
      if (!passesMarketMinFitFilter(item, minFit)) {
        return false;
      }
      if (!passesMarketFitVisibilityFilter(item, hidePoorFit)) {
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
      if (!passesMarketAxisFilters(item, axisMinimums)) {
        return false;
      }
      return true;
    });

    return sortCandidates(filtered, sortMode);
  }, [axisMinimums, effectiveMinRatio, effectiveMaxSalary, effectiveMaxValue, hidePoorFit, marketItems, minFit, selectedClassAxes, selectedClassNames, selectedRaceNames, sortMode]);
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
  const wishlistSlotsFull = Boolean(
    scoutingPipelineCapacity &&
      !scoutingPipelineCapacity.draftSuspended &&
      scoutingPipelineCapacity.max != null &&
      scoutingPipelineCapacity.max > 0 &&
      scoutingPipelineCapacity.occupied >= scoutingPipelineCapacity.max &&
      !selectedPlayerWishlisted,
  );
  const wishlistDisabledReason =
    scoutingPipelineCapacity?.draftSuspended
      ? null
      : wishlistSlotsFull
        ? `Wishlist voll (${scoutingPipelineCapacity?.occupied}/${scoutingPipelineCapacity?.max}) — Spieler entfernen oder Scouting Office upgraden.`
        : null;
  const scoutingPipelineFull = Boolean(
    scoutingPipelineCapacity &&
      !scoutingPipelineCapacity.draftSuspended &&
      scoutingPipelineCapacity.max != null &&
      scoutingPipelineCapacity.max > 0 &&
      scoutingPipelineCapacity.occupied >= scoutingPipelineCapacity.max &&
      !selectedPlayerScoutingWatched,
  );
  const scoutingWatchDisabledReason =
    scoutingPipelineCapacity?.draftSuspended
      ? null
      : scoutingPipelineFull
        ? `Scouting voll (${scoutingPipelineCapacity?.occupied}/${scoutingPipelineCapacity?.max}) — Ziel entfernen oder Scouting Office upgraden.`
        : null;

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
    ? `${selectedTeam?.name ?? "Dieses Team"} gehört nicht zu deinen steuerbaren Teams. Du kannst scouten, aber keine Deals abschliessen.`
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
  const selectedTeamRosterRows = useMemo(
    () => rosterRows.filter((row) => row.teamId === selectedTeamId),
    [rosterRows, selectedTeamId],
  );
  const topSixCount = Math.min(6, marketContext?.playerOpt ?? 6);
  const topSixAxisImpact = useMemo(
    () =>
      computeTopSixAxisImpact(
        selectedTeamRosterRows,
        selectedPlayer
          ? {
              pow: selectedPlayer.pow,
              spe: selectedPlayer.spe,
              men: selectedPlayer.men,
              soc: selectedPlayer.soc,
            }
          : null,
        topSixCount,
      ),
    [selectedPlayer, selectedTeamRosterRows, topSixCount],
  );
  const topSixCompositeBefore = useMemo(
    () => computeCompositeTopSixAverage(topSixAxisImpact, "before"),
    [topSixAxisImpact],
  );
  const topSixCompositeAfter = useMemo(
    () => computeCompositeTopSixAverage(topSixAxisImpact, "after"),
    [topSixAxisImpact],
  );
  const topSixCompositeDelta = useMemo(() => {
    if (topSixCompositeBefore == null || topSixCompositeAfter == null) {
      return null;
    }
    return Number((topSixCompositeAfter - topSixCompositeBefore).toFixed(1));
  }, [topSixCompositeAfter, topSixCompositeBefore]);
  const selectedScoutingConfidence = useMemo(
    () =>
      selectedPlayer?.scoutingConfidence ??
      resolveScoutingConfidenceFromLevel(selectedPlayer?.scoutingLevel ?? 0),
    [selectedPlayer?.scoutingConfidence, selectedPlayer?.scoutingLevel],
  );
  const topSixAxisRankEstimates = useMemo(
    () =>
      computeCandidateAxisTeamRankEstimates(
        selectedTeamRosterRows,
        selectedPlayer
          ? {
              pow: selectedPlayer.pow,
              spe: selectedPlayer.spe,
              men: selectedPlayer.men,
              soc: selectedPlayer.soc,
            }
          : null,
        selectedScoutingConfidence,
      ),
    [selectedPlayer, selectedScoutingConfidence, selectedTeamRosterRows],
  );
  const selectedTopDisciplineImpact = useMemo(() => {
    if (!selectedPlayer) {
      return [];
    }
    const confidence =
      selectedPlayer.scoutingConfidence ?? resolveScoutingConfidenceFromLevel(selectedPlayer.scoutingLevel);
    return computeDisciplineTopSixImpact(
      selectedTeamRosterRows,
      selectedPlayer.topDisciplineScores.slice(0, 5).map((entry) => ({
        disciplineId: entry.disciplineId,
        disciplineName: entry.disciplineName,
        displayedScore: entry.displayedScore ?? null,
        tierWindow: getScoutingTierWindow(entry.scoreTier, confidence),
        playerCount: entry.playerCount ?? null,
      })),
      topSixCount,
    );
  }, [selectedPlayer, selectedTeamRosterRows, topSixCount]);
  const selectedPortrait = selectedPlayer ? getTransfermarktPortraitModel(selectedPlayer) : null;
  const effectiveOfferedSalary = salaryEditedManually ? offeredSalary : null;
  const previewPlayerId = selectedPlayer?.playerId ?? (buyModalOpen ? buyModalWishlistEntry?.playerId ?? null : null);

  function selectCandidateFromKeyboard(playerId: string) {
    shouldFocusSelectedCandidateRef.current = true;
    setSelectedPlayerId(playerId);
  }

  function moveCandidateSelection(key: "ArrowDown" | "ArrowUp" | "Home" | "End") {
    if (!visibleItems.length) {
      return;
    }

    const currentIndex = visibleItems.findIndex((item) => item.playerId === selectedPlayerId);
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
    const targetIndex =
      key === "Home"
        ? 0
        : key === "End"
          ? visibleItems.length - 1
          : Math.min(
              Math.max(fallbackIndex + (key === "ArrowDown" ? 1 : -1), 0),
              visibleItems.length - 1,
            );
    selectCandidateFromKeyboard(visibleItems[targetIndex].playerId);
  }

  useEffect(() => {
    if (buyModalOpen || !visibleItems.length) {
      return undefined;
    }

    function onGlobalCandidateKeyDown(event: globalThis.KeyboardEvent) {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      event.preventDefault();
      moveCandidateSelection(event.key as "ArrowDown" | "ArrowUp" | "Home" | "End");
    }

    window.addEventListener("keydown", onGlobalCandidateKeyDown);
    return () => window.removeEventListener("keydown", onGlobalCandidateKeyDown);
  }, [buyModalOpen, selectedPlayerId, visibleItems]);

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
      activateOfferPanel(entry.playerId);
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

  function openWishlistDeal(entry: TransferWishlistEntry) {
    clearWishlistClickTimer();
    void focusWishlistEntry(entry, { openDeal: true });
  }

  useEffect(() => {
    setRenderedCandidateCount(MARKET_INITIAL_RENDER_COUNT);
  }, [selectedTeamId, deferredSearch, sortMode, minFit, hidePoorFit, maxValue, maxSalary, maxRatio, selectedDisciplineLens, selectedClassNames, selectedClassAxes, selectedRaceNames, selectedAxes, axisMinimums]);

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
    if (!bootstrapReady || defaultSeasonId === "loading" || !defaultSaveId || defaultSaveId === "loading-save") {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    marketAbortRef.current?.abort();
    marketAbortRef.current = controller;
    const marketCacheKey = `${defaultSaveId}:${defaultSeasonId}:${selectedTeamId}:${deferredSearch.trim()}`;
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

        const searchActive = deferredSearch.trim().length > 0;

        while (hasMore) {
          const params = appendRoomContextToParams(new URLSearchParams({
            saveId: defaultSaveId,
            seasonId: defaultSeasonId,
            source,
            teamId: selectedTeamId,
            limit: String(MARKET_PAGE_LIMIT),
            offset: String(nextOffset),
            ...(searchActive ? { search: deferredSearch.trim() } : {}),
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
            setMarketError(formatMarketPreviewError(payload.error) ?? "Transfermarkt konnte nicht geladen werden.");
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
          const finalHasMore = hasMore;
          marketCacheRef.current.set(marketCacheKey, {
            items: [...mergedItems],
            feed: {
              ...latestPayload,
              items: mergedItems,
              offset: 0,
              returned: mergedItems.length,
              hasMore: finalHasMore,
            },
            total: latestPayload.total,
            hasMore: finalHasMore,
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
  }, [bootstrapReady, defaultSaveId, defaultSeasonId, deferredSearch, reloadToken, selectedTeamId, source]);

  useEffect(() => {
    if (!poolBracketPanel || !bootstrapReady || !defaultSaveId || defaultSaveId === "loading-save" || defaultSeasonId === "loading") {
      setPoolBracketItems([]);
      setPoolBracketBusy(false);
      return;
    }
    const activePoolBracketPanel = poolBracketPanel;

    let cancelled = false;
    const controller = new AbortController();
    poolBracketAbortRef.current?.abort();
    poolBracketAbortRef.current = controller;

    async function loadPoolBracketPlayers() {
      setPoolBracketBusy(true);
      try {
        if (deferredSearch.trim().length === 0 && !marketHasMore && marketItems.length > 0) {
          const filtered = filterTransfermarktFreeAgentsByBracket(marketItems, activePoolBracketPanel.bracket);
          if (!cancelled) {
            setPoolBracketItems(filtered);
          }
          return;
        }

        const mergedItems: TransfermarktFreeAgentItem[] = [];
        const seen = new Set<string>();
        let nextOffset = 0;
        let hasMore = true;

        while (hasMore) {
          const params = appendRoomContextToParams(
            new URLSearchParams({
              saveId: defaultSaveId,
              seasonId: defaultSeasonId,
              source,
              teamId: selectedTeamId,
              limit: String(MARKET_PAGE_LIMIT),
              offset: String(nextOffset),
            }),
            roomContextRef.current,
          );
          const response = await fetch(`/api/transfermarkt/free-agents?${params.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const payload = (await response.json()) as MarketFeedResponse;
          if (cancelled || controller.signal.aborted) {
            return;
          }
          if (!response.ok || payload.error) {
            if (!cancelled) {
              setPoolBracketItems([]);
            }
            return;
          }

          payload.items.forEach((item) => {
            if (!seen.has(item.playerId)) {
              mergedItems.push(item);
              seen.add(item.playerId);
            }
          });
          nextOffset += payload.returned;
          hasMore = Boolean(payload.hasMore && payload.returned > 0);
        }

        if (!cancelled) {
          setPoolBracketItems(filterTransfermarktFreeAgentsByBracket(mergedItems, activePoolBracketPanel.bracket));
        }
      } catch (error) {
        if (cancelled || controller.signal.aborted || isAbortError(error)) {
          return;
        }
        if (!cancelled) {
          setPoolBracketItems([]);
        }
      } finally {
        if (!cancelled) {
          setPoolBracketBusy(false);
        }
      }
    }

    void loadPoolBracketPlayers();

    return () => {
      cancelled = true;
      controller.abort();
      if (poolBracketAbortRef.current === controller) {
        poolBracketAbortRef.current = null;
      }
    };
  }, [
    bootstrapReady,
    defaultSaveId,
    defaultSeasonId,
    deferredSearch,
    marketHasMore,
    marketItems,
    poolBracketPanel,
    selectedTeamId,
    source,
  ]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    historyAbortRef.current?.abort();
    historyAbortRef.current = controller;

    async function loadHistory() {
      try {
        const params = appendRoomContextToParams(new URLSearchParams({
          saveId: defaultSaveId,
          source,
          allSeasons: "1",
          limit: "12",
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
  }, [defaultSaveId, reloadToken, selectedTeamId, source]);

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
          setPreviewError(formatMarketPreviewError(payload.error) ?? "Vorschau konnte nicht geladen werden.");
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
        setPreviewError(
          formatMarketPreviewError(payload.error ?? payload.summary?.blockingReasons?.[0]) ??
            "Kauf konnte nicht bestätigt werden.",
        );
        return;
      }
      setBuyPreview(payload.summary);
      setBuySuccess(
        `${payload.summary.player?.name ?? "Spieler"} fix für ${selectedTeam?.shortCode ?? "dein Team"}: ${formatTransfermarktCurrency(payload.summary.purchasePrice)} Ablöse, ${formatTransfermarktCurrency(payload.summary.salary)} Gehalt p.a., ${payload.summary.contractLength} Saison${payload.summary.contractLength === 1 ? "" : "en"}.`,
      );
      deactivateOfferPanel();
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
        message: `${buyPreview.player.name} will weitermachen, aber eher ${formatTransfermarktCurrency(counterSalary)} pro Season${counterDelta != null ? ` (${counterDelta > 0 ? "+" : ""}${formatTransfermarktCurrency(counterDelta)} gegenüber deinem Angebot)` : ""}. Das Angebot wurde direkt auf den neuen Rahmen gesetzt.`,
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
    activateOfferPanel();
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
      buyNegotiationOutcome?.status === "countered";
    deactivateOfferPanel();
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
          ? `Verhandlung mit ${playerName} abgebrochen. Das gibt einen Malus für die nächste Runde.`
          : `Kauf von ${playerName} abgebrochen.`,
      );
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  const historyItems = historyFeed?.items ?? [];
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
  const dealOpenDisabledReason =
    !transferCanBuy
      ? marketReadOnlyReason
      : !selectedTeamId
        ? "Bitte erst ein Team wählen."
        : !selectedPlayer
          ? "Bitte erst links einen Kandidaten wählen."
          : !selectedTeamCanManage
            ? selectedTeamReadOnlyReason ?? "Dieses Team ist hier nur Ansicht."
            : null;

  const canSellRoster = Boolean(onSell && selectedTeamId && manageableTeamIdSet.has(selectedTeamId) && transferCanSell);
  return (
    <TransfermarktV2NewLook
        teamName={selectedTeam ? `${selectedTeam.shortCode} · ${selectedTeam.name}` : null}
        teamShortCode={selectedTeam?.shortCode ?? null}
        availabilityLabel={availabilityLabel}
        marketWindowNotice={marketWindowNotice}
        marketBusy={marketBusy}
        marketError={marketError}
        onRetryMarket={() => setReloadToken((current) => current + 1)}
        buySuccess={buySuccess}
        onDismissBuySuccess={() => setBuySuccess(null)}
        teamCash={marketContext?.teamCash ?? null}
        teamSalaryTotal={marketContext?.teamSalary ?? null}
        rosterCount={marketContext?.rosterCount ?? null}
        rosterLimit={selectedTeam?.rosterLimit ?? null}
        rosterGapOpenCount={rosterGapOpenCount}
        search={search}
        onSearchChange={setSearch}
        sortMode={sortMode}
        onSortModeChange={(mode) => setSortMode(mode)}
        selectedClassAxes={selectedClassAxes}
        onToggleClassAxis={(axis) => setSelectedClassAxes((current) => toggleSelection(current, axis))}
        axisMinimums={axisMinimums}
        onAxisMinimumChange={(axis, value) => setAxisMinimums((current) => ({ ...current, [axis]: value }))}
        hidePoorFit={hidePoorFit}
        onToggleHidePoorFit={() => setHidePoorFit((current) => !current)}
        minRatioFilter={maxRatio}
        onMinRatioFilterChange={(value) => setMaxRatio(value)}
        onResetFilters={resetMarketFilters}
        activeFilterCount={
          selectedClassNames.length +
          selectedRaceNames.length +
          activeAxisMinimumCount +
          selectedClassAxes.length
        }
        candidates={renderedVisibleItems}
        totalVisibleCount={visibleItems.length}
        selectedPlayerId={selectedPlayer?.playerId ?? null}
        onSelectCandidate={(playerId) => {
          shouldFocusSelectedCandidateRef.current = false;
          setSelectedPlayerId(playerId);
        }}
        selectedPlayer={selectedPlayer}
        onOpenPlayerDetails={onOpenPlayerDetails}
        onOpenDeal={openBuyModal}
        dealOpenDisabledReason={dealOpenDisabledReason}
        buyBusy={buyBusy}
        selectedPlayerWishlisted={selectedPlayerWishlisted}
        wishlistDisabledReason={wishlistDisabledReason}
        onToggleSelectedWishlist={() => {
          if (selectedPlayer) {
            onToggleWishlist?.(selectedPlayer);
          }
        }}
        selectedPlayerScoutingWatched={selectedPlayerScoutingWatched}
        scoutingWatchDisabledReason={scoutingWatchDisabledReason}
        onToggleSelectedScoutingWatch={() => {
          if (selectedPlayer) {
            onToggleScoutingWatch?.(selectedPlayer);
          }
        }}
        selectedPlayerScoutCertainty={selectedPlayerScoutCertainty}
        contractLength={contractLength}
        onContractLengthChange={setContractLength}
        previewError={previewError}
        buyPreviewCanBuy={buyPreview?.canBuy ?? null}
        previewPurchasePrice={previewPurchasePrice}
        previewSalaryLabel={previewSalaryLabel}
        previewCashBefore={previewCashBefore}
        previewCashAfter={previewCashAfter}
        previewTeamSalaryBefore={previewTeamSalaryBefore}
        previewTeamSalaryAfter={previewTeamSalaryAfter}
        previewRosterBefore={previewRosterBefore}
        previewRosterAfter={previewRosterAfter}
        previewMarketValueBefore={previewMarketValueBefore}
        previewMarketValueAfter={previewMarketValueAfter}
        buyBlockingReasons={(buyPreview?.blockingReasons ?? []).map(formatNegotiationSignalLabel)}
        buyWarnings={filterVisibleNegotiationWarnings(buyPreview?.warnings).map(formatNegotiationSignalLabel)}
        topSixCount={topSixCount}
        topSixAxisImpact={topSixAxisImpact}
        topSixCompositeBefore={topSixCompositeBefore}
        topSixCompositeDelta={topSixCompositeDelta}
        topSixAxisRankEstimates={topSixAxisRankEstimates}
        selectedScoutingConfidence={selectedScoutingConfidence}
        disciplineImpact={selectedTopDisciplineImpact}
        wishlistAxes={wishlistAxes}
        wishlistDisciplines={wishlistDisciplines}
        wishlistEntries={selectedWishlistEntries}
        scoutingIntelByPlayerId={scoutingIntelByPlayerId}
        scoutingActiveWishlistPlayerIds={scoutingActiveWishlistPlayerIds}
        scoutingPipelineCapacity={scoutingPipelineCapacity}
        onFocusWishlistEntry={(entry) => {
          void focusWishlistEntry(entry);
        }}
        onOpenWishlistDeal={openWishlistDeal}
        onRemoveWishlist={onRemoveWishlist}
        marketItemsById={marketItemByPlayerId}
        rosterRows={selectedRosterRows}
        disciplines={orderedDisciplines}
        budgetStatusLabel={marketContext?.affordabilityStatus ? formatToneLabel(marketContext.affordabilityStatus) : null}
        readinessStatusLabel={marketContext?.readinessStatus ? formatReadinessLabel(marketContext.readinessStatus) : null}
        onSellRow={
          canSellRoster && onSell
            ? (row) =>
                onSell({
                  activePlayerId: row.activePlayerId,
                  playerId: row.playerId,
                  playerName: row.name,
                  className: row.className,
                  race: row.race ?? null,
                  portraitUrl: row.portraitUrl ?? null,
                })
            : null
        }
        historyItems={historyItems}
        buyModalOpen={buyModalOpen}
        buyModalSlot={
          <FoundationShellRouterMarketBuy
            active={buyModalOpen}
            hostProps={{
              buyModalRef,
              buyModalBodyRef,
              source,
              selectedTeam,
              selectedPlayer,
              buyModalWishlistEntry,
              selectedPortrait,
              selectedTeamCanManage,
              selectedTeamId,
              buyPreview,
              previewBusy,
              previewError,
              buyBusy,
              buySuccess,
              buyNegotiationOutcome,
              contractLength,
              contractShape,
              offeredSalary,
              salaryEditedManually,
              derivationsInput: {
                source,
                selectedTeamCanManage,
                selectedTeamReadOnlyReason,
                selectedTeamId,
                previewBusy,
                buyBusy,
              },
              onContractLengthChange: setContractLength,
              onContractShapeChange: setContractShape,
              onOfferedSalaryChange: setOfferedSalary,
              onSalaryEditedManuallyChange: setSalaryEditedManually,
              onBuyNegotiationOutcomeChange: setBuyNegotiationOutcome,
              closeBuyModal,
              negotiateBuy,
              confirmBuy,
              resetBuyDemandFrame,
            }}
          />
        }
      />
    );
  }
