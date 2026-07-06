"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import {
  formatGmDismissalReason,
  getGmStoryDetail,
  getGmStoryLabel,
  getGmStoryTone,
} from "@/lib/foundation/gm-story";
import { clampTableColumnWidth } from "@/lib/ui/global-table-layout";
import { useRowVirtualWindow } from "@/lib/foundation/use-row-virtual-window";
import {
  resolveSeasonDisciplineAreaTotal,
  SEASON_DISCIPLINE_AREA_GROUPS,
  SEASON_DISCIPLINE_LABELS,
  type SeasonDisciplineKey,
} from "@/lib/season/season-discipline-area-groups";

type SeasonV2AreaId = "pow" | "spe" | "men" | "soc";

type SeasonV2ExpandableColumnId = "points" | SeasonV2AreaId;

type SeasonV2DisciplineKey = SeasonDisciplineKey | "bonuspunkte";

const seasonV2DisciplineLabels: Record<SeasonV2DisciplineKey, string> = {
  bonuspunkte: "Bonus",
  ...SEASON_DISCIPLINE_LABELS,
};

const seasonV2AreaGroups = SEASON_DISCIPLINE_AREA_GROUPS;

type SeasonV2Option = {
  seasonId: string;
  seasonName: string;
  status: string;
  archivedAt: string | null;
};

type SeasonV2TeamSummary = {
  teamId: string;
  teamName: string;
  teamCode: string;
  rank: number | null;
  points: number | null;
  pps: number | null;
  cash: number | null;
  salaryTotal: number | null;
  guv: number | null;
  sponsorTotal: number | null;
  marketValueTotal: number | null;
};

type SeasonV2StandingsRow = {
  teamId: string;
  teamName: string;
  teamCode: string;
  gmName: string | null;
  gmTitle: string | null;
  gmArchetype: string | null;
  logoUrl: string | null;
  logoInitials: string;
  rank: number | null;
  rankDiff: number | null;
  points: number | null;
  pps: number | null;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
  cash: number | null;
  salaryTotal: number | null;
  guv: number | null;
  sponsorTotal: number | null;
  marketValueTotal: number | null;
  disciplineValues: Record<SeasonV2DisciplineKey, number | null>;
  rosterCount: number;
  avgContractLength: number | null;
  isSelected: boolean;
};

type SeasonV2PpRow = {
  teamId: string;
  teamName: string;
  teamCode: string;
  rank: number;
  total: number;
  pow: number;
  spe: number;
  men: number;
  soc: number;
};

type SeasonV2TopPlayerRow = {
  playerId: string;
  name: string;
  teamId: string | null;
  teamCode: string | null;
  teamName: string | null;
  className: string | null;
  portraitUrl: string | null;
  portraitInitials: string;
  rank: number;
  pps: number | null;
  ovr: number | null;
  mvs: number | null;
  ppPow: number | null;
  ppSpe: number | null;
  ppMen: number | null;
  ppSoc: number | null;
};

type SortDirection = "asc" | "desc";

type SeasonV2StandingsSortKey =
  | "rank"
  | "team"
  | "points"
  | "pow"
  | "spe"
  | "men"
  | "soc"
  | "cash"
  | "salary"
  | "contractLength"
  | "guv"
  | "sponsor"
  | "marketValue";

type SeasonV2PlayerSortKey = "rank" | "player" | "team" | "pps" | "pow" | "spe" | "men" | "soc" | "ovr" | "mvs";

type SeasonV2TableStorageId = "seasonStandingsV2Table" | "seasonStandingsV2TopPlayersTable";

type SeasonV2ColumnConfig = {
  id: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth?: number;
};

const seasonV2TableWidthStorageKeys: Record<SeasonV2TableStorageId, string> = {
  seasonStandingsV2Table: "foundation:seasonStandingsV2Table:widths:v1",
  seasonStandingsV2TopPlayersTable: "foundation:seasonStandingsV2TopPlayersTable:widths:v1",
};

const seasonV2StandingsColumnConfigs: Record<string, SeasonV2ColumnConfig> = {
  rank: { id: "rank", label: "Rang", defaultWidth: 70, minWidth: 54, maxWidth: 110 },
  team: { id: "team", label: "Team", defaultWidth: 220, minWidth: 170, maxWidth: 360 },
  points: { id: "points", label: "Punkte", defaultWidth: 106, minWidth: 86, maxWidth: 160 },
  ...Object.fromEntries(
    (Object.keys(seasonV2DisciplineLabels) as SeasonV2DisciplineKey[]).map((key) => [
      key,
      {
        id: key,
        label: seasonV2DisciplineLabels[key],
        defaultWidth: key === "bonuspunkte" ? 86 : 78,
        minWidth: 62,
        maxWidth: 116,
      },
    ]),
  ),
  pow: { id: "pow", label: "POW", defaultWidth: 122, minWidth: 92, maxWidth: 170 },
  spe: { id: "spe", label: "SPE", defaultWidth: 122, minWidth: 92, maxWidth: 170 },
  men: { id: "men", label: "MEN", defaultWidth: 122, minWidth: 92, maxWidth: 170 },
  soc: { id: "soc", label: "SOC", defaultWidth: 122, minWidth: 92, maxWidth: 170 },
  cash: { id: "cash", label: "Cash", defaultWidth: 102, minWidth: 82, maxWidth: 150 },
  salary: { id: "salary", label: "Gehalt", defaultWidth: 102, minWidth: 82, maxWidth: 150 },
  contractLength: { id: "contractLength", label: "Ø LZ", defaultWidth: 88, minWidth: 70, maxWidth: 128 },
  guv: { id: "guv", label: "GuV", defaultWidth: 102, minWidth: 82, maxWidth: 150 },
  sponsor: { id: "sponsor", label: "Sponsor", defaultWidth: 102, minWidth: 82, maxWidth: 150 },
  marketValue: { id: "marketValue", label: "MW", defaultWidth: 102, minWidth: 82, maxWidth: 150 },
};

const seasonV2TopPlayerColumnConfigs: Record<string, SeasonV2ColumnConfig> = {
  rank: { id: "rank", label: "#", defaultWidth: 54, minWidth: 44, maxWidth: 90 },
  player: { id: "player", label: "Spieler", defaultWidth: 180, minWidth: 140, maxWidth: 300 },
  team: { id: "team", label: "Team", defaultWidth: 88, minWidth: 70, maxWidth: 130 },
  pps: { id: "pps", label: "PPs", defaultWidth: 92, minWidth: 76, maxWidth: 140 },
  pow: { id: "pow", label: "POW", defaultWidth: 78, minWidth: 66, maxWidth: 116 },
  spe: { id: "spe", label: "SPE", defaultWidth: 78, minWidth: 66, maxWidth: 116 },
  men: { id: "men", label: "MEN", defaultWidth: 78, minWidth: 66, maxWidth: 116 },
  soc: { id: "soc", label: "SOC", defaultWidth: 78, minWidth: 66, maxWidth: 116 },
  ovr: { id: "ovr", label: "OVR", defaultWidth: 86, minWidth: 72, maxWidth: 130 },
  mvs: { id: "mvs", label: "MVS", defaultWidth: 86, minWidth: 72, maxWidth: 130 },
};

type SeasonV2ArchiveRow = {
  seasonId: string;
  seasonName: string;
  archivedAt: string | null;
  teamCount: number;
  playerCount: number;
};

type SeasonV2DisciplineLeader = {
  disciplineId: string;
  disciplineName: string;
  playerId: string;
  playerName: string;
  teamCode: string | null;
  appearances: number;
  totalContribution: number | null;
};

type SeasonV2GmHistoryRow = {
  seasonId: string;
  seasonName: string;
  gmId: string;
  gmName: string;
  gmTitle: string;
  source: string;
  boardConfidenceValue: number | null;
  boardPressure: number | null;
  previousGmId?: string | null;
  dismissalReason?: string | null;
};

type SeasonV2GmRow = {
  teamId: string;
  teamName: string;
  teamCode: string;
  logoUrl: string | null;
  logoInitials: string;
  gmId: string | null;
  gmName: string | null;
  gmTitle: string | null;
  gmArchetype: string | null;
  description: string | null;
  marketDoctrine: string | null;
  lineupDoctrine: string | null;
  facilityPriorities: string[];
  preferredTraits: string[];
  influencePct: number | null;
  source: string | null;
  assignedSeasonId: string | null;
  boardConfidenceValue: number | null;
  boardPressure: number | null;
  previousGmId?: string | null;
  dismissalReason?: string | null;
  history: SeasonV2GmHistoryRow[];
};

export type SeasonStandingsV2ClientProps = {
  selectedSeasonId: string;
  selectedSeasonLabel: string;
  sourceLabel: string;
  sourceBadgeLabel: string;
  isArchived: boolean;
  seasonOptions: SeasonV2Option[];
  selectedTeamSummary: SeasonV2TeamSummary | null;
  leaderTeam: SeasonV2StandingsRow | null;
  momentumTeam: SeasonV2StandingsRow | null;
  pressureTeam: SeasonV2StandingsRow | null;
  topPlayer: SeasonV2TopPlayerRow | null;
  standingsRows: SeasonV2StandingsRow[];
  topPlayers: SeasonV2TopPlayerRow[];
  playerRows: SeasonV2TopPlayerRow[];
  gmRows: SeasonV2GmRow[];
  archiveRows: SeasonV2ArchiveRow[];
  disciplineLeaders: SeasonV2DisciplineLeader[];
  onChangeSeason: (seasonId: string) => void;
  onOpenTeam: (teamId: string) => void;
  onOpenPlayer: (playerId: string) => void;
  viewMode?: SeasonV2ViewMode;
  onViewModeChange?: (mode: SeasonV2ViewMode) => void;
  onOpenRanks?: (() => void) | null;
  onOpenPrize?: (() => void) | null;
  isLoading?: boolean;
};

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatMoney(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatCash(value: number | null | undefined, digits = 1) {
  return formatMoney(value, digits);
}

function formatGmTitle(title: string | null | undefined, archetype?: string | null) {
  const cleanedTitle = String(title ?? "")
    .replace(/\s*GM$/i, "")
    .replace(/^(Prime|Wild|Patient|Clinical|Popular|Hardline|Agile|Builder|Showcase|Lean)\s+/i, "")
    .trim();
  if (cleanedTitle) return cleanedTitle;
  return String(archetype ?? "GM offen")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatGmLabel(row: SeasonV2StandingsRow) {
  return `${formatGmTitle(row.gmTitle, row.gmArchetype)} · ${row.rosterCount} Spieler`;
}

function formatSigned(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${formatNumber(value, digits)}`;
}

function compareNullableNumbers(left: number | null | undefined, right: number | null | undefined) {
  const safeLeft = left == null || !Number.isFinite(left) ? Number.NEGATIVE_INFINITY : left;
  const safeRight = right == null || !Number.isFinite(right) ? Number.NEGATIVE_INFINITY : right;
  return safeLeft - safeRight;
}

function compareNullableStrings(left: string | null | undefined, right: string | null | undefined) {
  return String(left ?? "").localeCompare(String(right ?? ""), "de-DE", { numeric: true, sensitivity: "base" });
}

function getTopTenRankClass(rank: number | null | undefined) {
  if (rank == null || !Number.isFinite(rank) || rank < 1 || rank > 10) return "";
  if (rank <= 3) return "season-v2-rank-green";
  if (rank <= 6) return "season-v2-rank-yellow";
  return "season-v2-rank-red";
}

function buildValueRankClassMap<T extends { teamId: string }>(
  rows: T[],
  getValue: (row: T) => number | null | undefined,
) {
  const values = rows
    .map((row) => ({ teamId: row.teamId, value: getValue(row) }))
    .filter((row): row is { teamId: string; value: number } => typeof row.value === "number" && Number.isFinite(row.value) && row.value > 0)
    .sort((left, right) => right.value - left.value);
  const map = new Map<string, string>();
  let lastValue: number | null = null;
  let rank = 0;

  values.forEach((row, index) => {
    if (lastValue == null || row.value !== lastValue) {
      rank = index + 1;
      lastValue = row.value;
    }
    const className = getTopTenRankClass(rank);
    if (className) map.set(row.teamId, className);
  });

  return map;
}

function getPercent(value: number | null | undefined, pool: Array<number | null | undefined>, fallbackMax = 100) {
  if (value == null || !Number.isFinite(value) || value <= 0) return 0;
  const numericPool = pool.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry) && entry > 0);
  const max = numericPool.length > 0 ? Math.max(...numericPool) : fallbackMax;
  if (!Number.isFinite(max) || max <= 0) return 0;
  return Math.max(10, Math.min(100, (value / max) * 100));
}

function renderBar(
  value: number | null | undefined,
  tone: "pps" | "pow" | "spe" | "men" | "soc" | "ovr" | "mvs",
  pool: Array<number | null | undefined>,
  fallbackMax: number,
  digits = 1,
) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="table-metric-bar is-empty">—</span>;
  }
  const percent = getPercent(value, pool, fallbackMax);
  return (
    <span className={`table-metric-bar is-${tone}`}>
      <span className="table-metric-bar-fill" style={{ width: `${percent}%` }} />
      <span className="table-metric-bar-content">
        <span className="table-metric-bar-value">{formatNumber(value, digits)}</span>
      </span>
    </span>
  );
}

function renderSummaryCard(
  title: string,
  value: string,
  detail: string,
  tone: "leader" | "selected" | "momentum" | "player",
  trend: number | null = null,
  formCurve: number[] | null = null,
) {
  return (
    <article className={`season-v2-story-card is-${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      {trend != null && trend !== 0 ? (
        <span className={`season-v2-trend-arrow ${trend > 0 ? "is-up" : "is-down"}`} aria-label="Trend">
          {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}
        </span>
      ) : null}
      {formCurve && formCurve.length > 0 ? (
        <div className="season-v2-form-curve" aria-hidden="true">
          {formCurve.map((point, index) => (
            <span key={`form-curve-${index}`} style={{ height: `${Math.max(12, Math.min(100, point))}%` }} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

const seasonV2TeamTagColorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  "A-A": { bg: "rgba(125, 44, 48, 0.74)", border: "rgba(236, 92, 89, 0.82)", text: "#ffe0dc", glow: "rgba(236, 92, 89, 0.28)" },
  "B-B": { bg: "rgba(117, 65, 29, 0.76)", border: "rgba(245, 139, 57, 0.82)", text: "#ffe4ca", glow: "rgba(245, 139, 57, 0.25)" },
  "B-P": { bg: "rgba(44, 42, 62, 0.78)", border: "rgba(143, 130, 201, 0.8)", text: "#ebe7ff", glow: "rgba(143, 130, 201, 0.24)" },
  "C-C": { bg: "rgba(117, 90, 37, 0.76)", border: "rgba(247, 205, 91, 0.84)", text: "#fff1c8", glow: "rgba(247, 205, 91, 0.26)" },
  "C-S": { bg: "rgba(55, 78, 92, 0.76)", border: "rgba(159, 205, 225, 0.76)", text: "#e6f7ff", glow: "rgba(159, 205, 225, 0.22)" },
  "D-L": { bg: "rgba(63, 44, 79, 0.76)", border: "rgba(179, 116, 220, 0.8)", text: "#f1ddff", glow: "rgba(179, 116, 220, 0.24)" },
  "D-P": { bg: "rgba(111, 68, 89, 0.76)", border: "rgba(245, 154, 189, 0.78)", text: "#ffe1ee", glow: "rgba(245, 154, 189, 0.23)" },
  "G-G": { bg: "rgba(116, 86, 31, 0.78)", border: "rgba(250, 194, 70, 0.86)", text: "#fff0bd", glow: "rgba(250, 194, 70, 0.27)" },
  "H-R": { bg: "rgba(105, 34, 34, 0.78)", border: "rgba(241, 76, 68, 0.86)", text: "#ffe0dd", glow: "rgba(241, 76, 68, 0.27)" },
  "L-K": { bg: "rgba(51, 62, 78, 0.78)", border: "rgba(142, 169, 207, 0.76)", text: "#e8f0ff", glow: "rgba(142, 169, 207, 0.22)" },
  "L-R": { bg: "rgba(62, 55, 51, 0.78)", border: "rgba(185, 162, 139, 0.72)", text: "#f4e6d8", glow: "rgba(185, 162, 139, 0.2)" },
  "M-M": { bg: "rgba(101, 60, 35, 0.78)", border: "rgba(238, 145, 75, 0.84)", text: "#ffe5cf", glow: "rgba(238, 145, 75, 0.25)" },
  "M-S": { bg: "rgba(78, 40, 72, 0.78)", border: "rgba(210, 104, 183, 0.78)", text: "#ffdff7", glow: "rgba(210, 104, 183, 0.22)" },
  "N-N": { bg: "rgba(64, 54, 82, 0.78)", border: "rgba(176, 148, 227, 0.8)", text: "#eee5ff", glow: "rgba(176, 148, 227, 0.23)" },
  "N-W": { bg: "rgba(45, 84, 54, 0.78)", border: "rgba(121, 202, 131, 0.78)", text: "#def8df", glow: "rgba(121, 202, 131, 0.24)" },
  "P-C": { bg: "rgba(51, 75, 93, 0.78)", border: "rgba(101, 185, 225, 0.76)", text: "#dff5ff", glow: "rgba(101, 185, 225, 0.22)" },
  "P-S": { bg: "rgba(70, 52, 108, 0.78)", border: "rgba(169, 133, 255, 0.86)", text: "#eee5ff", glow: "rgba(169, 133, 255, 0.27)" },
  "R-C": { bg: "rgba(92, 45, 81, 0.78)", border: "rgba(231, 128, 203, 0.78)", text: "#ffe2f8", glow: "rgba(231, 128, 203, 0.24)" },
  "R-L": { bg: "rgba(40, 85, 61, 0.78)", border: "rgba(109, 215, 143, 0.82)", text: "#d9ffe5", glow: "rgba(109, 215, 143, 0.25)" },
  "R-R": { bg: "rgba(34, 87, 98, 0.78)", border: "rgba(83, 205, 225, 0.78)", text: "#d8fbff", glow: "rgba(83, 205, 225, 0.23)" },
  "S-C": { bg: "rgba(98, 46, 38, 0.78)", border: "rgba(236, 104, 83, 0.82)", text: "#ffe1dc", glow: "rgba(236, 104, 83, 0.25)" },
  "S-S": { bg: "rgba(75, 84, 96, 0.78)", border: "rgba(190, 205, 224, 0.78)", text: "#edf5ff", glow: "rgba(190, 205, 224, 0.22)" },
  "T-C": { bg: "rgba(62, 91, 74, 0.78)", border: "rgba(151, 217, 174, 0.76)", text: "#e2ffea", glow: "rgba(151, 217, 174, 0.22)" },
  "T-G": { bg: "rgba(70, 75, 80, 0.78)", border: "rgba(175, 185, 194, 0.76)", text: "#f0f4f8", glow: "rgba(175, 185, 194, 0.22)" },
  "T-T": { bg: "rgba(94, 61, 39, 0.78)", border: "rgba(226, 163, 90, 0.8)", text: "#ffe7ca", glow: "rgba(226, 163, 90, 0.23)" },
  "U-A": { bg: "rgba(44, 75, 91, 0.78)", border: "rgba(112, 185, 223, 0.76)", text: "#e2f6ff", glow: "rgba(112, 185, 223, 0.22)" },
  "V-D": { bg: "rgba(91, 45, 77, 0.78)", border: "rgba(229, 116, 193, 0.78)", text: "#ffe2f5", glow: "rgba(229, 116, 193, 0.22)" },
  "V-V": { bg: "rgba(76, 68, 100, 0.78)", border: "rgba(180, 160, 238, 0.78)", text: "#eee7ff", glow: "rgba(180, 160, 238, 0.23)" },
  "V-W": { bg: "rgba(75, 53, 90, 0.78)", border: "rgba(190, 137, 225, 0.78)", text: "#f5e1ff", glow: "rgba(190, 137, 225, 0.22)" },
  "W-L": { bg: "rgba(64, 73, 77, 0.78)", border: "rgba(165, 190, 198, 0.76)", text: "#e9f6f9", glow: "rgba(165, 190, 198, 0.2)" },
  "W-W": { bg: "rgba(42, 72, 111, 0.78)", border: "rgba(104, 168, 244, 0.84)", text: "#ddecff", glow: "rgba(104, 168, 244, 0.25)" },
  "Z-H": { bg: "rgba(50, 77, 116, 0.78)", border: "rgba(92, 164, 245, 0.84)", text: "#e0efff", glow: "rgba(92, 164, 245, 0.25)" },
};

function hashSeasonV2TeamColorSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getSeasonV2TeamTagStyle(teamCode: string | null | undefined): CSSProperties | undefined {
  const code = String(teamCode ?? "").trim().toUpperCase();
  if (!code) return undefined;
  const mapped = seasonV2TeamTagColorMap[code];
  if (mapped) {
    return {
      "--team-tag-bg": mapped.bg,
      "--team-tag-border": mapped.border,
      "--team-tag-text": mapped.text,
      "--team-tag-glow": mapped.glow,
    } as CSSProperties;
  }
  const hue = hashSeasonV2TeamColorSeed(code) % 360;
  return {
    "--team-tag-bg": `hsla(${hue}, 38%, 30%, 0.78)`,
    "--team-tag-border": `hsla(${hue}, 72%, 68%, 0.78)`,
    "--team-tag-text": `hsl(${hue}, 80%, 92%)`,
    "--team-tag-glow": `hsla(${hue}, 72%, 60%, 0.22)`,
  } as CSSProperties;
}

function getSeasonV2ColumnConfig(tableId: SeasonV2TableStorageId, columnId: string) {
  const configs = tableId === "seasonStandingsV2Table" ? seasonV2StandingsColumnConfigs : seasonV2TopPlayerColumnConfigs;
  return configs[columnId] ?? { id: columnId, label: columnId, defaultWidth: 96, minWidth: 70, maxWidth: 180 };
}

function loadSeasonV2TableWidths(storageKey: string) {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === "number" && Number.isFinite(value)),
    ) as Record<string, number>;
  } catch {
    return {};
  }
}

function saveSeasonV2TableWidths(storageKey: string, widths: Record<string, number>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(widths));
  } catch {
    // Local storage can be blocked; the table remains usable for the current session.
  }
}

type SeasonV2ViewMode = "table" | "gms";

const SEASON_V2_DEFAULT_MODE: SeasonV2ViewMode = "table";

export default function SeasonStandingsV2Client({
  selectedSeasonId,
  selectedSeasonLabel,
  sourceLabel,
  sourceBadgeLabel,
  isArchived,
  seasonOptions,
  selectedTeamSummary,
  leaderTeam,
  momentumTeam,
  pressureTeam,
  topPlayer,
  standingsRows,
  topPlayers,
  playerRows,
  gmRows,
  archiveRows,
  disciplineLeaders,
  onChangeSeason,
  onOpenTeam,
  onOpenPlayer,
  viewMode,
  onViewModeChange,
  onOpenRanks,
  onOpenPrize,
  isLoading = false,
}: SeasonStandingsV2ClientProps) {
  const resolvedStandingsRows = useMemo(
    () =>
      standingsRows.map((row) => ({
        ...row,
        pow: resolveSeasonDisciplineAreaTotal(row.disciplineValues, "pow", row.pow),
        spe: resolveSeasonDisciplineAreaTotal(row.disciplineValues, "spe", row.spe),
        men: resolveSeasonDisciplineAreaTotal(row.disciplineValues, "men", row.men),
        soc: resolveSeasonDisciplineAreaTotal(row.disciplineValues, "soc", row.soc),
      })),
    [standingsRows],
  );
  const standingsPowPool = useMemo(() => resolvedStandingsRows.map((row) => row.pow), [resolvedStandingsRows]);
  const standingsSpePool = useMemo(() => resolvedStandingsRows.map((row) => row.spe), [resolvedStandingsRows]);
  const standingsMenPool = useMemo(() => resolvedStandingsRows.map((row) => row.men), [resolvedStandingsRows]);
  const standingsSocPool = useMemo(() => resolvedStandingsRows.map((row) => row.soc), [resolvedStandingsRows]);
  const topPlayerPpsPool = useMemo(() => topPlayers.map((row) => row.pps), [topPlayers]);
  const topPlayerPowPool = useMemo(() => topPlayers.map((row) => row.ppPow), [topPlayers]);
  const topPlayerSpePool = useMemo(() => topPlayers.map((row) => row.ppSpe), [topPlayers]);
  const topPlayerMenPool = useMemo(() => topPlayers.map((row) => row.ppMen), [topPlayers]);
  const topPlayerSocPool = useMemo(() => topPlayers.map((row) => row.ppSoc), [topPlayers]);
  const topPlayerOvrPool = useMemo(() => topPlayers.map((row) => row.ovr), [topPlayers]);
  const topPlayerMvsPool = useMemo(() => topPlayers.map((row) => row.mvs), [topPlayers]);
  const [expandedColumns, setExpandedColumns] = useState<Record<SeasonV2ExpandableColumnId, boolean>>({
    points: false,
    pow: false,
    spe: false,
    men: false,
    soc: false,
  });
  const [showFullStandingsTable, setShowFullStandingsTable] = useState(true);
  const [standingsSort, setStandingsSort] = useState<{ key: SeasonV2StandingsSortKey; direction: SortDirection }>({
    key: "rank",
    direction: "asc",
  });
  const [topPlayerSort, setTopPlayerSort] = useState<{ key: SeasonV2PlayerSortKey; direction: SortDirection }>({
    key: "rank",
    direction: "asc",
  });
  const [showTopPlayerAxes, setShowTopPlayerAxes] = useState(true);
  const [showFinanceColumns, setShowFinanceColumns] = useState(false);
  const [mobileCardsView, setMobileCardsView] = useState(false);
  const [internalSeasonV2Mode, setInternalSeasonV2Mode] = useState<SeasonV2ViewMode>(SEASON_V2_DEFAULT_MODE);
  const seasonV2Mode = viewMode ?? internalSeasonV2Mode;
  const setSeasonV2Mode = (mode: SeasonV2ViewMode) => {
    if (onViewModeChange) {
      onViewModeChange(mode);
      return;
    }
    setInternalSeasonV2Mode(mode);
  };
  const [standingsTableScrollTop, setStandingsTableScrollTop] = useState(0);
  const [standingsTableViewportHeight, setStandingsTableViewportHeight] = useState(560);
  const standingsTableShellRef = useRef<HTMLDivElement | null>(null);
  const [focusedTeamId, setFocusedTeamId] = useState<string | null>(selectedTeamSummary?.teamId ?? null);
  useEffect(() => {
    if (selectedTeamSummary?.teamId) {
      setFocusedTeamId(selectedTeamSummary.teamId);
    }
  }, [selectedTeamSummary?.teamId]);
  const seasonV2ResizeState = useRef<{
    tableId: SeasonV2TableStorageId;
    columnId: string;
    startX: number;
    startWidth: number;
    minWidth: number;
    maxWidth?: number;
  } | null>(null);
  const seasonV2TableWidthsSaveTimerRef = useRef<number | null>(null);
  const [seasonV2TableWidthsLoaded, setSeasonV2TableWidthsLoaded] = useState(false);
  const [seasonV2TableWidths, setSeasonV2TableWidths] = useState<Record<SeasonV2TableStorageId, Record<string, number>>>({
    seasonStandingsV2Table: {},
    seasonStandingsV2TopPlayersTable: {},
  });
  useEffect(() => {
    setSeasonV2TableWidths({
      seasonStandingsV2Table: loadSeasonV2TableWidths(seasonV2TableWidthStorageKeys.seasonStandingsV2Table),
      seasonStandingsV2TopPlayersTable: loadSeasonV2TableWidths(seasonV2TableWidthStorageKeys.seasonStandingsV2TopPlayersTable),
    });
    setSeasonV2TableWidthsLoaded(true);
  }, []);
  useEffect(() => {
    if (!seasonV2TableWidthsLoaded) {
      return;
    }
    if (seasonV2TableWidthsSaveTimerRef.current) {
      window.clearTimeout(seasonV2TableWidthsSaveTimerRef.current);
    }
    seasonV2TableWidthsSaveTimerRef.current = window.setTimeout(() => {
      saveSeasonV2TableWidths(seasonV2TableWidthStorageKeys.seasonStandingsV2Table, seasonV2TableWidths.seasonStandingsV2Table);
      saveSeasonV2TableWidths(
        seasonV2TableWidthStorageKeys.seasonStandingsV2TopPlayersTable,
        seasonV2TableWidths.seasonStandingsV2TopPlayersTable,
      );
    }, 300);
    return () => {
      if (seasonV2TableWidthsSaveTimerRef.current) {
        window.clearTimeout(seasonV2TableWidthsSaveTimerRef.current);
      }
    };
  }, [seasonV2TableWidths, seasonV2TableWidthsLoaded]);
  const seasonV2RankClassMaps = useMemo(() => {
    const disciplineMaps = Object.fromEntries(
      (Object.keys(seasonV2DisciplineLabels) as SeasonV2DisciplineKey[]).map((key) => [
        key,
        buildValueRankClassMap(standingsRows, (row) => row.disciplineValues[key]),
      ]),
    ) as Record<SeasonV2DisciplineKey, Map<string, string>>;
    return {
      points: buildValueRankClassMap(standingsRows, (row) => row.points),
      pow: buildValueRankClassMap(resolvedStandingsRows, (row) => row.pow),
      spe: buildValueRankClassMap(resolvedStandingsRows, (row) => row.spe),
      men: buildValueRankClassMap(resolvedStandingsRows, (row) => row.men),
      soc: buildValueRankClassMap(resolvedStandingsRows, (row) => row.soc),
      disciplines: disciplineMaps,
    };
  }, [resolvedStandingsRows, standingsRows]);
  const pointsRankClassByTeamId = seasonV2RankClassMaps.points;
  const areaRankClassByTeamId = {
    pow: seasonV2RankClassMaps.pow,
    spe: seasonV2RankClassMaps.spe,
    men: seasonV2RankClassMaps.men,
    soc: seasonV2RankClassMaps.soc,
  };
  const disciplineRankClassByKey = seasonV2RankClassMaps.disciplines;
  const sortedStandingsRows = useMemo(() => {
    const direction = standingsSort.direction === "asc" ? 1 : -1;
    return [...resolvedStandingsRows].sort((left, right) => {
      let result = 0;
      switch (standingsSort.key) {
        case "rank":
          result = compareNullableNumbers(left.rank, right.rank);
          break;
        case "team":
          result = compareNullableStrings(left.teamName, right.teamName);
          break;
        case "points":
          result = compareNullableNumbers(left.points, right.points);
          break;
        case "pow":
          result = compareNullableNumbers(left.pow, right.pow);
          break;
        case "spe":
          result = compareNullableNumbers(left.spe, right.spe);
          break;
        case "men":
          result = compareNullableNumbers(left.men, right.men);
          break;
        case "soc":
          result = compareNullableNumbers(left.soc, right.soc);
          break;
        case "cash":
          result = compareNullableNumbers(left.cash, right.cash);
          break;
        case "salary":
          result = compareNullableNumbers(left.salaryTotal, right.salaryTotal);
          break;
        case "contractLength":
          result = compareNullableNumbers(left.avgContractLength, right.avgContractLength);
          break;
        case "guv":
          result = compareNullableNumbers(left.guv, right.guv);
          break;
        case "sponsor":
          result = compareNullableNumbers(left.sponsorTotal, right.sponsorTotal);
          break;
        case "marketValue":
          result = compareNullableNumbers(left.marketValueTotal, right.marketValueTotal);
          break;
      }
      if (result === 0) {
        result = compareNullableStrings(left.teamName, right.teamName);
      }
      return result * direction;
    });
  }, [resolvedStandingsRows, standingsSort]);

  const displayStandingsRows = useMemo(() => {
    if (showFullStandingsTable || sortedStandingsRows.length <= 6) {
      return sortedStandingsRows;
    }
    const topRows = sortedStandingsRows.slice(0, 5);
    const focusTeamId = focusedTeamId ?? selectedTeamSummary?.teamId ?? null;
    if (!focusTeamId || topRows.some((row) => row.teamId === focusTeamId)) {
      return topRows;
    }
    const ownRow = sortedStandingsRows.find((row) => row.teamId === focusTeamId);
    return ownRow ? [...topRows, ownRow] : topRows;
  }, [focusedTeamId, selectedTeamSummary?.teamId, showFullStandingsTable, sortedStandingsRows]);

  const standingsTableVirtualWindow = useRowVirtualWindow({
    count: displayStandingsRows.length,
    scrollTop: standingsTableScrollTop,
    viewportHeight: standingsTableViewportHeight,
    rowHeight: 44,
    virtualizeThreshold: 48,
  });
  const visibleStandingsTableRows = useMemo(
    () => displayStandingsRows.slice(standingsTableVirtualWindow.start, standingsTableVirtualWindow.end),
    [displayStandingsRows, standingsTableVirtualWindow.end, standingsTableVirtualWindow.start],
  );

  useEffect(() => {
    const node = standingsTableShellRef.current;
    if (!node || seasonV2Mode !== "table") {
      return;
    }
    const syncHeight = () => setStandingsTableViewportHeight(node.clientHeight || 560);
    syncHeight();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncHeight) : null;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [seasonV2Mode, sortedStandingsRows.length]);

  const focusedTeam = useMemo(
    () => resolvedStandingsRows.find((row) => row.teamId === focusedTeamId) ?? null,
    [focusedTeamId, resolvedStandingsRows],
  );
  const rightPanelPlayers = useMemo(() => {
    const sourceRows = focusedTeamId ? playerRows.filter((player) => player.teamId === focusedTeamId) : topPlayers;
    const sortedRows = focusedTeamId
      ? [...sourceRows].sort((left, right) => {
          const ppsDelta = (right.pps ?? Number.NEGATIVE_INFINITY) - (left.pps ?? Number.NEGATIVE_INFINITY);
          if (ppsDelta !== 0) {
            return ppsDelta;
          }
          const ovrDelta = (right.ovr ?? Number.NEGATIVE_INFINITY) - (left.ovr ?? Number.NEGATIVE_INFINITY);
          if (ovrDelta !== 0) {
            return ovrDelta;
          }
          return left.name.localeCompare(right.name, "de");
        })
      : sourceRows;
    return sortedRows.map((player, index) => ({ ...player, rank: index + 1 }));
  }, [focusedTeamId, playerRows, topPlayers]);
  const sortedTopPlayers = useMemo(() => {
    const direction = topPlayerSort.direction === "asc" ? 1 : -1;
    return [...rightPanelPlayers].sort((left, right) => {
      let result = 0;
      switch (topPlayerSort.key) {
        case "rank":
          result = compareNullableNumbers(left.rank, right.rank);
          break;
        case "player":
          result = compareNullableStrings(left.name, right.name);
          break;
        case "team":
          result = compareNullableStrings(left.teamCode ?? left.teamName, right.teamCode ?? right.teamName);
          break;
        case "pps":
          result = compareNullableNumbers(left.pps, right.pps);
          break;
        case "pow":
          result = compareNullableNumbers(left.ppPow, right.ppPow);
          break;
        case "spe":
          result = compareNullableNumbers(left.ppSpe, right.ppSpe);
          break;
        case "men":
          result = compareNullableNumbers(left.ppMen, right.ppMen);
          break;
        case "soc":
          result = compareNullableNumbers(left.ppSoc, right.ppSoc);
          break;
        case "ovr":
          result = compareNullableNumbers(left.ovr, right.ovr);
          break;
        case "mvs":
          result = compareNullableNumbers(left.mvs, right.mvs);
          break;
      }
      if (result === 0) {
        result = compareNullableStrings(left.name, right.name);
      }
      return result * direction;
    });
  }, [rightPanelPlayers, topPlayerSort]);

  function selectTeam(teamId: string) {
    setFocusedTeamId((current) => (current === teamId ? null : teamId));
  }

  const visibleStandingsColumnIds = useMemo(() => {
    const columnIds = ["rank", "team", "points"];
    if (expandedColumns.points) {
      columnIds.push("bonuspunkte");
    }
    for (const group of seasonV2AreaGroups) {
      columnIds.push(group.id);
      if (expandedColumns[group.id]) {
        columnIds.push(...group.keys);
      }
    }
    if (showFinanceColumns) {
      columnIds.push("cash", "salary", "contractLength", "guv", "sponsor", "marketValue");
    }
    return columnIds;
  }, [expandedColumns, showFinanceColumns]);
  const visibleTopPlayerColumnIds = useMemo(
    () => ["rank", "player", "team", "pps", ...(showTopPlayerAxes ? ["pow", "spe", "men", "soc"] : []), "ovr", "mvs"],
    [showTopPlayerAxes],
  );
  const gmBoardStats = useMemo(() => {
    const hotSeats = gmRows.filter((row) => (row.boardPressure ?? 0) >= 8 || row.source === "board_replacement").length;
    const replacements = gmRows.filter((row) => row.source === "board_replacement" || row.previousGmId).length;
    const archetypes = new Set(gmRows.map((row) => formatGmTitle(row.gmTitle, row.gmArchetype))).size;
    return { hotSeats, replacements, archetypes };
  }, [gmRows]);
  const highlightedGmRows = useMemo(
    () =>
      [...gmRows]
        .sort((left, right) => {
          const pressureDelta = (right.boardPressure ?? 0) - (left.boardPressure ?? 0);
          if (pressureDelta !== 0) return pressureDelta;
          return left.teamName.localeCompare(right.teamName, "de");
        })
        .slice(0, 8),
    [gmRows],
  );

  function getSeasonV2TableColumnWidth(tableId: SeasonV2TableStorageId, columnId: string) {
    const config = getSeasonV2ColumnConfig(tableId, columnId);
    return clampTableColumnWidth(config, seasonV2TableWidths[tableId]?.[columnId] ?? config.defaultWidth);
  }

  function startSeasonV2ColumnResize(
    tableId: SeasonV2TableStorageId,
    columnId: string,
    event: ReactMouseEvent<HTMLSpanElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    const config = getSeasonV2ColumnConfig(tableId, columnId);
    seasonV2ResizeState.current = {
      tableId,
      columnId,
      startX: event.clientX,
      startWidth: getSeasonV2TableColumnWidth(tableId, columnId),
      minWidth: config.minWidth,
      maxWidth: config.maxWidth,
    };

    const handlePointerMove = (moveEvent: MouseEvent) => {
      const resizeState = seasonV2ResizeState.current;
      if (!resizeState) {
        return;
      }
      const nextWidth = Math.round(resizeState.startWidth + (moveEvent.clientX - resizeState.startX));
      setSeasonV2TableWidths((current) => ({
        ...current,
        [resizeState.tableId]: {
          ...(current[resizeState.tableId] ?? {}),
          [resizeState.columnId]: clampTableColumnWidth(resizeState, nextWidth),
        },
      }));
    };

    const handlePointerUp = () => {
      seasonV2ResizeState.current = null;
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
  }

  function resetSeasonV2ColumnWidth(tableId: SeasonV2TableStorageId, columnId: string) {
    const config = getSeasonV2ColumnConfig(tableId, columnId);
    setSeasonV2TableWidths((current) => ({
      ...current,
      [tableId]: {
        ...(current[tableId] ?? {}),
        [columnId]: clampTableColumnWidth(config, config.defaultWidth),
      },
    }));
  }

  function renderSeasonV2ResizableHeader(
    tableId: SeasonV2TableStorageId,
    columnId: string,
    content: ReactNode,
  ) {
    const config = getSeasonV2ColumnConfig(tableId, columnId);
    const width = getSeasonV2TableColumnWidth(tableId, columnId);
    return (
      <th style={{ width: `${width}px`, minWidth: `${config.minWidth}px` }}>
        <div className="resizable-header-cell">
          {content}
          <span
            className="column-resizer"
            draggable={false}
            role="separator"
            aria-orientation="vertical"
            aria-label={`${config.label} Breite anpassen`}
            onMouseDown={(event) => startSeasonV2ColumnResize(tableId, columnId, event)}
            onDoubleClick={() => resetSeasonV2ColumnWidth(tableId, columnId)}
          />
        </div>
      </th>
    );
  }

  function toggleExpandedColumn(columnId: SeasonV2ExpandableColumnId) {
    setExpandedColumns((current) => ({ ...current, [columnId]: !current[columnId] }));
  }

  function renderExpandableHeader(columnId: SeasonV2ExpandableColumnId, label: string) {
    return (
      <button
        className={`season-v2-expand-header${expandedColumns[columnId] ? " is-expanded" : ""}`}
        type="button"
        onClick={() => toggleExpandedColumn(columnId)}
        aria-expanded={expandedColumns[columnId]}
      >
        <span>{label}</span>
        <b>{expandedColumns[columnId] ? "−" : "+"}</b>
      </button>
    );
  }

  function toggleStandingsSort(key: SeasonV2StandingsSortKey) {
    setStandingsSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "team" ? "asc" : "desc" },
    );
  }

  function toggleTopPlayerSort(key: SeasonV2PlayerSortKey) {
    setTopPlayerSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "player" || key === "team" ? "asc" : "desc" },
    );
  }

  function toggleTopPlayerAxes() {
    setShowTopPlayerAxes((current) => {
      const next = !current;
      if (!next && ["pow", "spe", "men", "soc"].includes(topPlayerSort.key)) {
        setTopPlayerSort({ key: "pps", direction: "desc" });
      }
      return next;
    });
  }

  function renderSortHeader(
    label: string,
    isActive: boolean,
    direction: SortDirection,
    onClick: () => void,
    compact = false,
  ) {
    return (
      <button
        className={`season-v2-sort-header${compact ? " is-compact" : ""}${isActive ? " is-active" : ""}`}
        type="button"
        onClick={onClick}
      >
        <span>{label}</span>
        <b>{isActive ? (direction === "asc" ? "↑" : "↓") : "↕"}</b>
      </button>
    );
  }

  const pastSeasonOptions = useMemo(
    () => seasonOptions.filter((option) => option.status !== "active"),
    [seasonOptions],
  );

  return (
    <div className="season-v2-shell">
      <section className="season-v2-compact-toolbar" aria-label="Saisonstand Steuerung">
        <div className="season-v2-compact-toolbar-main">
          <div className="season-v2-compact-title">
            <h2>{selectedSeasonLabel}</h2>
            <span className="muted">{sourceLabel}</span>
          </div>
          <div className="season-v2-pill-row season-v2-compact-pills">
            <span className="pill">{sourceBadgeLabel}</span>
            <span className={`pill ${isArchived ? "is-warning" : "is-ready"}`}>{isArchived ? "Archiv" : "Live"}</span>
            {selectedTeamSummary?.rank != null ? <span className="pill">Dein Rang #{selectedTeamSummary.rank}</span> : null}
          </div>
        </div>
        <div className="season-v2-compact-toolbar-actions">
          <label className="filter-field season-v2-season-select">
            <span>Saison</span>
            <select className="input" value={selectedSeasonId} onChange={(event) => onChangeSeason(event.target.value)}>
              {seasonOptions.map((option) => (
                <option key={option.seasonId} value={option.seasonId}>
                  {option.seasonName} {option.status === "active" ? "(aktiv)" : "(Archiv)"}
                </option>
              ))}
            </select>
          </label>
          {!onViewModeChange ? (
            <div className="season-v2-action-row season-v2-mode-switch" role="tablist" aria-label="Saisonstand Modus">
              <button
                className={`secondary-button inline-button${seasonV2Mode === "table" ? " is-active" : ""}`}
                type="button"
                onClick={() => setSeasonV2Mode("table")}
                aria-pressed={seasonV2Mode === "table"}
              >
                Datenansicht
              </button>
              <button
                className={`secondary-button inline-button${seasonV2Mode === "gms" ? " is-active" : ""}`}
                type="button"
                onClick={() => setSeasonV2Mode("gms")}
                aria-pressed={seasonV2Mode === "gms"}
              >
                GM Board
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {pastSeasonOptions.length > 0 ? (
        <section className="season-v2-history-strip" aria-label="Vergangene Saisons">
          <div className="season-v2-history-chips">
            {pastSeasonOptions.map((option) => (
              <button
                key={option.seasonId}
                type="button"
                className={`secondary-button inline-button season-v2-history-chip${option.seasonId === selectedSeasonId ? " is-active" : ""}`}
                aria-pressed={option.seasonId === selectedSeasonId}
                onClick={() => onChangeSeason(option.seasonId)}
              >
                {option.seasonName}
              </button>
            ))}
            <button
              type="button"
              className={`secondary-button inline-button season-v2-history-chip season-v2-history-chip-live${selectedSeasonId === seasonOptions.find((option) => option.status === "active")?.seasonId ? " is-active" : ""}`}
              aria-pressed={!isArchived}
              onClick={() => {
                const activeSeason = seasonOptions.find((option) => option.status === "active");
                if (activeSeason) {
                  onChangeSeason(activeSeason.seasonId);
                }
              }}
            >
              Aktuelle Saison
            </button>
          </div>
        </section>
      ) : null}

      {seasonV2Mode === "gms" ? (
        <section className="season-v2-gm-board" aria-label="General Manager Board">
          <div className="season-v2-gm-hero">
            <div>
              <span className="season-v2-kicker">Front Office</span>
              <h3>GM Board</h3>
              <p>Aktuelle Manager-Styles, Board-Druck und künftige Snapshot-Historie pro Team.</p>
            </div>
            <div className="season-v2-gm-stats">
              <span><b>{gmRows.length}</b> GMs</span>
              <span><b>{gmBoardStats.archetypes}</b> Styles</span>
              <span><b>{gmBoardStats.hotSeats}</b> Hot Seats</span>
              <span><b>{gmBoardStats.replacements}</b> Wechsel</span>
            </div>
          </div>
          <div className="season-v2-gm-grid">
            {highlightedGmRows.map((row) => {
              const gmTitle = formatGmTitle(row.gmTitle, row.gmArchetype);
              const isHotSeat = (row.boardPressure ?? 0) >= 8;
              const gmStoryTone = getGmStoryTone({
                source: row.source,
                previousGmId: row.previousGmId,
                dismissalReason: row.dismissalReason,
                boardPressure: row.boardPressure,
                boardConfidenceValue: row.boardConfidenceValue,
              });
              return (
                <article key={row.teamId} className={`season-v2-gm-card${isHotSeat ? " is-hot" : ""}${row.source === "board_replacement" ? " is-new" : ""}`}>
                  <button className="season-v2-gm-team" type="button" onClick={() => onOpenTeam(row.teamId)}>
                    <BudgetedMediaImage
                      src={row.logoUrl}
                      alt={`${row.teamName} Logo`}
                      className="season-v2-team-logo"
                      width={34}
                      height={34}
                      loading="lazy"
                      fallback={<span className="season-v2-team-logo season-v2-team-logo-fallback">{row.logoInitials}</span>}
                    />
                    <span>
                      <strong>{row.teamName}</strong>
                      <small>{row.teamCode}</small>
                    </span>
                  </button>
                  <div className="season-v2-gm-main">
                    <span className="season-v2-gm-label">{row.source === "board_replacement" ? "Neu verpflichtet" : isHotSeat ? "Hot Seat" : "Aktiv"}</span>
                    <h4>{gmTitle}</h4>
                    <p>{row.description ?? row.lineupDoctrine ?? "Kein GM-Profil aktiv."}</p>
                  </div>
                  <div className={`season-v2-gm-story is-${gmStoryTone}`} title="GM-Story aus Board Confidence, Board-Druck und moeglichen Wechselgruenden.">
                    <strong>
                      {getGmStoryLabel({
                        source: row.source,
                        previousGmId: row.previousGmId,
                        dismissalReason: row.dismissalReason,
                        boardPressure: row.boardPressure,
                        boardConfidenceValue: row.boardConfidenceValue,
                      })}
                    </strong>
                    <span>
                      {getGmStoryDetail({
                        source: row.source,
                        previousGmId: row.previousGmId,
                        dismissalReason: row.dismissalReason,
                        boardPressure: row.boardPressure,
                        boardConfidenceValue: row.boardConfidenceValue,
                      })}
                    </span>
                  </div>
                  <div className="season-v2-gm-meters">
                    <span>Board <b>{formatNumber(row.boardConfidenceValue, 1)}</b></span>
                    <span>Druck <b>{formatNumber(row.boardPressure, 1)}</b></span>
                    <span>Einfluss <b>{formatNumber(row.influencePct, 0)}%</b></span>
                  </div>
                  <div className="season-v2-gm-tags">
                    {(row.preferredTraits.length ? row.preferredTraits : [gmTitle]).slice(0, 3).map((trait) => (
                      <span key={`${row.teamId}-${trait}`}>{trait}</span>
                    ))}
                  </div>
                  <div className="season-v2-gm-doctrine">
                    <small>{row.marketDoctrine ?? "Marktstil offen"}</small>
                    <small>{row.lineupDoctrine ?? "Lineupstil offen"}</small>
                  </div>
                  <div className="season-v2-gm-timeline">
                    {row.history.length > 0 ? (
                      row.history.slice(0, 4).map((entry) => (
                        <span key={`${row.teamId}-${entry.seasonId}-${entry.gmId}`}>
                          {entry.seasonName}: {formatGmTitle(entry.gmTitle)}
                          {entry.dismissalReason ? <small>{formatGmDismissalReason(entry.dismissalReason)}</small> : null}
                        </span>
                      ))
                    ) : (
                      <span>Historie startet mit dem nächsten Season-Snapshot.</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {seasonV2Mode === "table" && selectedTeamSummary ? (
        <section className="season-v2-pinned-team modern-game-pinned-row" aria-label="Dein Team" data-testid="season-v2-pinned-team">
          <span className="season-v2-pinned-label">Dein Team</span>
          <strong>{selectedTeamSummary.teamName}</strong>
          <span>#{selectedTeamSummary.rank ?? "—"}</span>
          <span>{formatNumber(selectedTeamSummary.points, 1)} Pkt</span>
          <span className="season-v2-prize-preview" title="Geschätztes Preisgeld bei diesem Rang">
            Preis ~{formatCash(Math.max(0, (33 - (selectedTeamSummary.rank ?? 33)) * 2.5))}
          </span>
          <button type="button" className="secondary-button inline-button" onClick={() => onOpenTeam(selectedTeamSummary.teamId)}>
            Team öffnen
          </button>
        </section>
      ) : null}

      {seasonV2Mode === "table" ? (
      <section className="season-v2-main-grid">
        <div className="season-v2-table-panel">
          <div className="panel-header season-v2-panel-header">
            <div className="stack">
              <TooltipHeading as="h3" tooltip="Kompakter Saisonstand mit Punkten, Bereichs-PPs und Finanzdruck.">
                Tabelle
              </TooltipHeading>
              <div className="season-v2-inline-sort-row" aria-label="Schnellsortierung Saisonstand">
                <button
                  className={`secondary-button inline-button${mobileCardsView ? " is-active" : ""}`}
                  type="button"
                  data-testid="season-v2-mobile-cards-toggle"
                  onClick={() => setMobileCardsView((current) => !current)}
                >
                  {mobileCardsView ? "Tabelle" : "Karten"}
                </button>
                <button
                  className={`secondary-button inline-button${showFinanceColumns ? "" : " is-active"}`}
                  type="button"
                  onClick={() => setShowFinanceColumns(false)}
                >
                  Kern
                </button>
                <button
                  className={`secondary-button inline-button${showFinanceColumns ? " is-active" : ""}`}
                  type="button"
                  onClick={() => setShowFinanceColumns(true)}
                >
                  Finanzen
                </button>
                {!showFullStandingsTable && sortedStandingsRows.length > 6 ? (
                  <button className="secondary-button inline-button" type="button" onClick={() => setShowFullStandingsTable(true)}>
                    Alle {sortedStandingsRows.length} Teams
                  </button>
                ) : showFullStandingsTable && sortedStandingsRows.length > 6 ? (
                  <button className="secondary-button inline-button" type="button" onClick={() => setShowFullStandingsTable(false)}>
                    Top 5
                  </button>
                ) : null}
                <button
                  className={`secondary-button inline-button${standingsSort.key === "points" ? " is-active" : ""}`}
                  type="button"
                  onClick={() => toggleStandingsSort("points")}
                >
                  Punkte
                </button>
              </div>
            </div>
          </div>
          <div
            className={`table-shell season-v2-table-shell season-v2-table-shell-full${mobileCardsView ? " is-mobile-cards" : ""}`}
            ref={standingsTableShellRef}
            data-virtualized={standingsTableVirtualWindow.enabled ? "true" : undefined}
            onScroll={(event) => setStandingsTableScrollTop(event.currentTarget.scrollTop)}
          >
            {mobileCardsView ? (
              <div className="season-v2-mobile-card-grid" data-testid="season-v2-mobile-cards">
                {sortedStandingsRows.map((row) => (
                  <article key={`mobile-card-${row.teamId}`} className={`season-v2-mobile-card${row.isSelected ? " is-selected" : ""}`}>
                    <strong>#{row.rank ?? "—"} {row.teamName}</strong>
                    <span>{formatNumber(row.points, 1)} Pkt</span>
                    {row.rankDiff != null && row.rankDiff !== 0 ? (
                      <span className={`season-v2-trend-arrow ${row.rankDiff > 0 ? "is-up" : "is-down"}`}>{row.rankDiff > 0 ? "↑" : "↓"} {Math.abs(row.rankDiff)}</span>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
            <table className="team-table season-v2-table season-v2-standings-table">
              <colgroup>
                {visibleStandingsColumnIds.map((columnId) => (
                  <col key={columnId} style={{ width: `${getSeasonV2TableColumnWidth("seasonStandingsV2Table", columnId)}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {renderSeasonV2ResizableHeader(
                    "seasonStandingsV2Table",
                    "rank",
                    renderSortHeader("Rang", standingsSort.key === "rank", standingsSort.direction, () => toggleStandingsSort("rank"), true),
                  )}
                  {renderSeasonV2ResizableHeader(
                    "seasonStandingsV2Table",
                    "team",
                    renderSortHeader("Team", standingsSort.key === "team", standingsSort.direction, () => toggleStandingsSort("team")),
                  )}
                  {renderSeasonV2ResizableHeader("seasonStandingsV2Table", "points", renderExpandableHeader("points", "Punkte"))}
                  {expandedColumns.points
                    ? renderSeasonV2ResizableHeader("seasonStandingsV2Table", "bonuspunkte", seasonV2DisciplineLabels.bonuspunkte)
                    : null}
                  {seasonV2AreaGroups.map((group) => (
                    <Fragment key={group.id}>
                      {renderSeasonV2ResizableHeader("seasonStandingsV2Table", group.id, renderExpandableHeader(group.id, group.label))}
                      {expandedColumns[group.id]
                        ? group.keys.map((key) => (
                            <Fragment key={`${group.id}-${key}`}>
                              {renderSeasonV2ResizableHeader("seasonStandingsV2Table", key, seasonV2DisciplineLabels[key])}
                            </Fragment>
                          ))
                        : null}
                    </Fragment>
                  ))}
                  {showFinanceColumns ? (
                    <>
                      {renderSeasonV2ResizableHeader(
                        "seasonStandingsV2Table",
                        "cash",
                        renderSortHeader("Cash", standingsSort.key === "cash", standingsSort.direction, () => toggleStandingsSort("cash"), true),
                      )}
                      {renderSeasonV2ResizableHeader(
                        "seasonStandingsV2Table",
                        "salary",
                        renderSortHeader("Gehalt", standingsSort.key === "salary", standingsSort.direction, () => toggleStandingsSort("salary"), true),
                      )}
                      {renderSeasonV2ResizableHeader(
                        "seasonStandingsV2Table",
                        "contractLength",
                        renderSortHeader("Ø LZ", standingsSort.key === "contractLength", standingsSort.direction, () => toggleStandingsSort("contractLength"), true),
                      )}
                      {renderSeasonV2ResizableHeader(
                        "seasonStandingsV2Table",
                        "guv",
                        renderSortHeader("GuV", standingsSort.key === "guv", standingsSort.direction, () => toggleStandingsSort("guv"), true),
                      )}
                      {renderSeasonV2ResizableHeader(
                        "seasonStandingsV2Table",
                        "sponsor",
                        renderSortHeader("Sponsor", standingsSort.key === "sponsor", standingsSort.direction, () => toggleStandingsSort("sponsor"), true),
                      )}
                      {renderSeasonV2ResizableHeader(
                        "seasonStandingsV2Table",
                        "marketValue",
                        renderSortHeader("MW", standingsSort.key === "marketValue", standingsSort.direction, () => toggleStandingsSort("marketValue"), true),
                      )}
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {isLoading && standingsRows.length === 0 ? (
                  Array.from({ length: 6 }, (_, index) => (
                    <tr key={`season-v2-skeleton-${index}`} className="season-v2-table-row is-skeleton" aria-hidden="true">
                      <td colSpan={visibleStandingsColumnIds.length}>
                        <div className="season-v2-table-skeleton-row" style={{ width: `${Math.max(52, 96 - index * 6)}%` }} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <>
                {standingsTableVirtualWindow.enabled ? (
                  <tr aria-hidden="true">
                    <td colSpan={visibleStandingsColumnIds.length} style={{ height: standingsTableVirtualWindow.offsetY, padding: 0, border: 0 }} />
                  </tr>
                ) : null}
                {visibleStandingsTableRows.map((row) => (
                  <tr
                    key={row.teamId}
                    className={`season-v2-table-row${row.isSelected ? " is-selected" : ""}${focusedTeamId === row.teamId ? " is-focused" : ""}`}
                    onClick={() => selectTeam(row.teamId)}
                  >
                    <td className="season-v2-rank-cell">
                      <span>{row.rank ?? "—"}</span>
                      {row.rankDiff != null && row.rankDiff !== 0 ? (
                        <small className={row.rankDiff > 0 ? "text-positive" : "text-negative"}>{formatSigned(row.rankDiff, 0)}</small>
                      ) : null}
                    </td>
                    <td className="season-v2-team-cell">
                      <button className="table-link-button season-v2-team-link" type="button" onClick={() => onOpenTeam(row.teamId)}>
                        <span className="season-v2-team-ident">
                          <BudgetedMediaImage
                            src={row.logoUrl}
                            alt={`${row.teamName} Logo`}
                            className="season-v2-team-logo"
                            width={28}
                            height={28}
                            loading="lazy"
                            fallback={<span className="season-v2-team-logo season-v2-team-logo-fallback">{row.logoInitials}</span>}
                          />
                          <span>
                            <span className="season-v2-team-title-row">
                              <strong>{row.teamName}</strong>
                              <span className="season-v2-team-tag" style={getSeasonV2TeamTagStyle(row.teamCode)}>
                                {row.teamCode}
                              </span>
                            </span>
                            <small title={row.gmTitle ?? undefined}>{formatGmLabel(row)}</small>
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className={pointsRankClassByTeamId.get(row.teamId) ?? undefined}>{formatNumber(row.points, 1)}</td>
                    {expandedColumns.points ? (
                      <td className={disciplineRankClassByKey.bonuspunkte.get(row.teamId) ?? undefined}>
                        {formatNumber(row.disciplineValues.bonuspunkte, 1)}
                      </td>
                    ) : null}
                    {seasonV2AreaGroups.map((group) => {
                      const areaValue = group.id === "pow" ? row.pow : group.id === "spe" ? row.spe : group.id === "men" ? row.men : row.soc;
                      const areaPool = group.id === "pow" ? standingsPowPool : group.id === "spe" ? standingsSpePool : group.id === "men" ? standingsMenPool : standingsSocPool;
                      return (
                        <Fragment key={`${row.teamId}-${group.id}`}>
                          <td className={areaRankClassByTeamId[group.id].get(row.teamId) ?? undefined}>
                            {renderBar(areaValue, group.id, areaPool, 60, 0)}
                          </td>
                          {expandedColumns[group.id]
                            ? group.keys.map((key) => (
                                <td key={`${row.teamId}-${key}`} className={disciplineRankClassByKey[key].get(row.teamId) ?? undefined}>
                                  {formatNumber(row.disciplineValues[key], 1)}
                                </td>
                              ))
                            : null}
                        </Fragment>
                      );
                    })}
                    {showFinanceColumns ? (
                      <>
                        <td>{formatCash(row.cash)}</td>
                        <td>{formatCash(row.salaryTotal, 1)}</td>
                        <td>{formatNumber(row.avgContractLength, 1)}</td>
                        <td className={row.guv != null && row.guv < 0 ? "text-negative" : "text-positive"}>{formatMoney(row.guv)}</td>
                        <td>{formatMoney(row.sponsorTotal)}</td>
                        <td>{formatMoney(row.marketValueTotal)}</td>
                      </>
                    ) : null}
                  </tr>
                ))}
                {standingsTableVirtualWindow.enabled ? (
                  <tr aria-hidden="true">
                    <td
                      colSpan={visibleStandingsColumnIds.length}
                      style={{
                        height:
                          standingsTableVirtualWindow.totalHeight -
                          standingsTableVirtualWindow.offsetY -
                          visibleStandingsTableRows.length * 44,
                        padding: 0,
                        border: 0,
                      }}
                    />
                  </tr>
                ) : null}
                  </>
                )}
              </tbody>
            </table>
            )}
          </div>
        </div>

        <section className="season-v2-table-panel">
          <div className="panel-header season-v2-panel-header">
            <div className="stack">
              <TooltipHeading as="h3" tooltip="Ein Klick auf ein Team zeigt hier den Kader. Klick auf Spielername öffnet das Profil.">
                {focusedTeam ? focusedTeam.teamName : "Top Player"}
              </TooltipHeading>
              <small className="muted">{focusedTeam ? `${rightPanelPlayers.length} Spieler im Kader` : "Globale Bestenliste"}</small>
            </div>
            <div className="season-v2-panel-actions">
              {focusedTeam ? (
                <button className="secondary-button inline-button" type="button" onClick={() => setFocusedTeamId(null)}>
                  Top Player
                </button>
              ) : null}
              <button
                className={`secondary-button inline-button${showTopPlayerAxes ? " is-active" : ""}`}
                type="button"
                onClick={toggleTopPlayerAxes}
                aria-pressed={showTopPlayerAxes}
                title="Blendet POW, SPE, MEN und SOC in der Player-Tabelle ein oder aus."
              >
                Achsen {showTopPlayerAxes ? "an" : "aus"}
              </button>
            </div>
          </div>
          <div className="table-shell season-v2-side-table-shell">
            <table className={`team-table season-v2-table season-v2-side-table${showTopPlayerAxes ? " has-axis-columns" : " is-compact"}`}>
              <colgroup>
                {visibleTopPlayerColumnIds.map((columnId) => (
                  <col key={columnId} style={{ width: `${getSeasonV2TableColumnWidth("seasonStandingsV2TopPlayersTable", columnId)}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {renderSeasonV2ResizableHeader(
                    "seasonStandingsV2TopPlayersTable",
                    "rank",
                    renderSortHeader("#", topPlayerSort.key === "rank", topPlayerSort.direction, () => toggleTopPlayerSort("rank"), true),
                  )}
                  {renderSeasonV2ResizableHeader(
                    "seasonStandingsV2TopPlayersTable",
                    "player",
                    renderSortHeader("Spieler", topPlayerSort.key === "player", topPlayerSort.direction, () => toggleTopPlayerSort("player")),
                  )}
                  {renderSeasonV2ResizableHeader(
                    "seasonStandingsV2TopPlayersTable",
                    "team",
                    renderSortHeader("Team", topPlayerSort.key === "team", topPlayerSort.direction, () => toggleTopPlayerSort("team"), true),
                  )}
                  {renderSeasonV2ResizableHeader(
                    "seasonStandingsV2TopPlayersTable",
                    "pps",
                    renderSortHeader("PPs", topPlayerSort.key === "pps", topPlayerSort.direction, () => toggleTopPlayerSort("pps"), true),
                  )}
                  {showTopPlayerAxes ? (
                    <>
                      {renderSeasonV2ResizableHeader(
                        "seasonStandingsV2TopPlayersTable",
                        "pow",
                        renderSortHeader("POW", topPlayerSort.key === "pow", topPlayerSort.direction, () => toggleTopPlayerSort("pow"), true),
                      )}
                      {renderSeasonV2ResizableHeader(
                        "seasonStandingsV2TopPlayersTable",
                        "spe",
                        renderSortHeader("SPE", topPlayerSort.key === "spe", topPlayerSort.direction, () => toggleTopPlayerSort("spe"), true),
                      )}
                      {renderSeasonV2ResizableHeader(
                        "seasonStandingsV2TopPlayersTable",
                        "men",
                        renderSortHeader("MEN", topPlayerSort.key === "men", topPlayerSort.direction, () => toggleTopPlayerSort("men"), true),
                      )}
                      {renderSeasonV2ResizableHeader(
                        "seasonStandingsV2TopPlayersTable",
                        "soc",
                        renderSortHeader("SOC", topPlayerSort.key === "soc", topPlayerSort.direction, () => toggleTopPlayerSort("soc"), true),
                      )}
                    </>
                  ) : null}
                  {renderSeasonV2ResizableHeader(
                    "seasonStandingsV2TopPlayersTable",
                    "ovr",
                    renderSortHeader("OVR", topPlayerSort.key === "ovr", topPlayerSort.direction, () => toggleTopPlayerSort("ovr"), true),
                  )}
                  {renderSeasonV2ResizableHeader(
                    "seasonStandingsV2TopPlayersTable",
                    "mvs",
                    renderSortHeader("MVS", topPlayerSort.key === "mvs", topPlayerSort.direction, () => toggleTopPlayerSort("mvs"), true),
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedTopPlayers.map((player) => (
                  <tr key={player.playerId} className="season-v2-player-table-row">
                    <td className="season-v2-rank-cell">
                      <span>{player.rank}</span>
                    </td>
                    <td className="season-v2-player-name-cell">
                      <button
                        className="table-link-button season-v2-player-link"
                        type="button"
                        onClick={() => onOpenPlayer(player.playerId)}
                      >
                        <span className="season-v2-player-name">{player.name}</span>
                        <small>{player.className ?? "Klasse offen"}</small>
                      </button>
                    </td>
                    <td className="season-v2-player-team-cell">
                      {player.teamId ? (
                        <button className="table-link-button season-v2-team-tag-button" type="button" onClick={() => selectTeam(player.teamId!)} style={getSeasonV2TeamTagStyle(player.teamCode)}>
                          <span className="season-v2-team-tag">{player.teamCode ?? "—"}</span>
                        </button>
                      ) : (
                        <span className="season-v2-team-tag is-neutral">FA</span>
                      )}
                    </td>
                    <td>{renderBar(player.pps, "pps", topPlayerPpsPool, 32, 1)}</td>
                    {showTopPlayerAxes ? (
                      <>
                        <td>{renderBar(player.ppPow, "pow", topPlayerPowPool, 24, 1)}</td>
                        <td>{renderBar(player.ppSpe, "spe", topPlayerSpePool, 24, 1)}</td>
                        <td>{renderBar(player.ppMen, "men", topPlayerMenPool, 24, 1)}</td>
                        <td>{renderBar(player.ppSoc, "soc", topPlayerSocPool, 24, 1)}</td>
                      </>
                    ) : null}
                    <td>{renderBar(player.ovr, "ovr", topPlayerOvrPool, 100, 0)}</td>
                    <td>{renderBar(player.mvs, "mvs", topPlayerMvsPool, 30, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
      ) : null}

      {seasonV2Mode === "table" ? (
      <section className="season-v2-story-grid season-v2-story-grid-compact" aria-label="Saison-Fokus">
        {renderSummaryCard(
          "Titelkurs",
          leaderTeam ? leaderTeam.teamName : "—",
          leaderTeam ? `#${leaderTeam.rank ?? "—"} · ${formatNumber(leaderTeam.points, 1)} Punkte` : "kein Leader",
          "leader",
          leaderTeam?.rankDiff ?? null,
          leaderTeam ? [leaderTeam.pow ?? 0, leaderTeam.spe ?? 0, leaderTeam.men ?? 0, leaderTeam.soc ?? 0] : null,
        )}
        {renderSummaryCard(
          "Dein Team",
          selectedTeamSummary ? selectedTeamSummary.teamName : "—",
          selectedTeamSummary
            ? `#${selectedTeamSummary.rank ?? "—"} · ${formatNumber(selectedTeamSummary.points, 1)} Punkte · Cash ${formatCash(selectedTeamSummary.cash)}`
            : "kein Team gewählt",
          "selected",
          sortedStandingsRows.find((row) => row.teamId === selectedTeamSummary?.teamId)?.rankDiff ?? null,
          (() => {
            const row = sortedStandingsRows.find((entry) => entry.teamId === selectedTeamSummary?.teamId);
            return row ? [row.pow ?? 0, row.spe ?? 0, row.men ?? 0, row.soc ?? 0] : null;
          })(),
        )}
        {renderSummaryCard(
          "Momentum",
          momentumTeam ? momentumTeam.teamName : "—",
          momentumTeam ? `${formatSigned(momentumTeam.rankDiff, 0)} Plätze · ${formatNumber(momentumTeam.points, 1)} Punkte` : "kein Aufsteiger",
          "momentum",
          momentumTeam?.rankDiff ?? null,
          momentumTeam ? [momentumTeam.pow ?? 0, momentumTeam.spe ?? 0, momentumTeam.men ?? 0, momentumTeam.soc ?? 0] : null,
        )}
        {renderSummaryCard(
          "Top Player",
          topPlayer ? topPlayer.name : "—",
          topPlayer
            ? `${topPlayer.teamCode ?? topPlayer.teamName ?? "—"} · ${formatNumber(topPlayer.pps, 1)} PPs · OVR ${formatNumber(topPlayer.ovr, 0)}`
            : "kein Spieler",
          "player",
        )}
      </section>
      ) : null}

      {seasonV2Mode === "table" ? (
      <section className="season-v2-bottom-grid">
        <section className="season-v2-bottom-panel">
          <div className="panel-header season-v2-panel-header">
            <div className="stack">
              <TooltipHeading as="h3" tooltip="Archivierte Saisons aus dem Save.">
                Saison-Archiv
              </TooltipHeading>
            </div>
          </div>
          <div className="season-v2-archive-list">
            {archiveRows.length > 0 ? (
              archiveRows.map((entry) => (
                <article
                  key={entry.seasonId}
                  className={`season-v2-archive-card${entry.seasonId === selectedSeasonId ? " is-active" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onChangeSeason(entry.seasonId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onChangeSeason(entry.seasonId);
                    }
                  }}
                >
                  <div>
                    <strong>{entry.seasonName}</strong>
                    <small>{entry.archivedAt ? new Date(entry.archivedAt).toLocaleString("de-DE") : "aktiv"}</small>
                  </div>
                  <div className="season-v2-archive-meta">
                    <span>{entry.teamCount} Teams</span>
                    <span>{entry.playerCount} Spieler</span>
                  </div>
                </article>
              ))
            ) : (
              <p className="muted">Noch kein Archiv gespeichert.</p>
            )}
          </div>
        </section>

        <section className="season-v2-bottom-panel">
          <div className="panel-header season-v2-panel-header">
            <div className="stack">
              <TooltipHeading as="h3" tooltip="Archivierte Disziplin-Leader helfen beim Lesen alter Seasons.">
                Diszi-Leader
              </TooltipHeading>
            </div>
          </div>
          <div className="season-v2-discipline-list">
            {disciplineLeaders.length > 0 ? (
              disciplineLeaders.map((entry) => (
                <button key={`${entry.disciplineId}-${entry.playerId}`} className="season-v2-discipline-card" type="button" onClick={() => onOpenPlayer(entry.playerId)}>
                  <strong>{entry.disciplineName}</strong>
                  <span>{entry.playerName}</span>
                  <small>
                    {entry.teamCode ?? "—"} · {formatNumber(entry.totalContribution, 1)} PPs · {entry.appearances} Eins.
                  </small>
                </button>
              ))
            ) : (
              <p className="muted">Kein extra Archiv-Diszi-Board für diese Auswahl vorhanden.</p>
            )}
          </div>
        </section>

        <section className="season-v2-bottom-panel">
          <div className="panel-header season-v2-panel-header">
            <div className="stack">
              <TooltipHeading as="h3" tooltip="Team mit dem größten Gehalts- oder GuV-Druck.">
                Finanzdruck
              </TooltipHeading>
            </div>
          </div>
          {pressureTeam ? (
            <button className="season-v2-pressure-card" type="button" onClick={() => onOpenTeam(pressureTeam.teamId)}>
              <strong>{pressureTeam.teamName}</strong>
              <div className="season-v2-pressure-grid">
                <span>Cash <b>{formatMoney(pressureTeam.cash)}</b></span>
                <span>Gehalt <b>{formatCash(pressureTeam.salaryTotal, 2)}</b></span>
                <span>GuV <b className={pressureTeam.guv != null && pressureTeam.guv < 0 ? "text-negative" : "text-positive"}>{formatMoney(pressureTeam.guv)}</b></span>
                <span>Ø LZ <b>{formatNumber(pressureTeam.avgContractLength, 1)}</b></span>
              </div>
            </button>
          ) : (
            <p className="muted">Kein Drucksignal gefunden.</p>
          )}
        </section>
      </section>
      ) : null}
    </div>
  );
}
