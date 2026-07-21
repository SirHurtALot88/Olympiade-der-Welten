"use client";

import type { CSSProperties } from "react";

import SeasonStandingsNewLook from "@/app/foundation/season-v2/SeasonStandingsNewLook";
import type { SeasonDisciplineKey } from "@/lib/season/season-discipline-area-groups";

type SeasonV2DisciplineKey = SeasonDisciplineKey | "bonuspunkte";

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

export type SeasonV2StandingsRow = {
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
  /**
   * Wave D · D4 Rang-Movement: Δ Gesamtrang gegenüber dem letzten Spieltag
   * (Feld-Rennen-Ledger, `rankDeltaVsPrev`). >0 = Plätze gutgemacht (▲),
   * <0 = abgerutscht (▼), `null` am ersten Spieltag. Additiv/optional — der
   * bestehende Render liest dieses Feld nur im "Neuer Look"-Board.
   */
  fieldRaceRankDelta?: number | null;
  points: number | null;
  pps: number | null;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
  cash: number | null;
  salaryTotal: number | null;
  /** Gebäude-Unterhalt p.a. (Summe der Season-Upkeeps gebauter Anlagen). */
  buildingCost: number | null;
  guv: number | null;
  sponsorTotal: number | null;
  marketValueTotal: number | null;
  disciplineValues: Record<SeasonV2DisciplineKey, number | null>;
  rosterCount: number;
  avgContractLength: number | null;
  isSelected: boolean;
  /**
   * Saisonübergreifende Snapshot-Historie (Rang/Punkte pro archivierter
   * Saison) — optional durchgereicht für den "Neuer Look"-Saisonstand.
   * Der bestehende Render liest dieses Feld nicht.
   */
  historicalPointsBySeason?: Array<{
    seasonId: string;
    seasonName: string;
    points: number | null;
    rank: number | null;
  }>;
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
  /** Team-IDs der Rivalen des aktiven Teams (additive Hervorhebung, optional/graceful). */
  rivalTeamIds?: ReadonlySet<string>;
  onChangeSeason: (seasonId: string) => void;
  onOpenTeam: (teamId: string) => void;
  onOpenPlayer: (playerId: string) => void;
  viewMode?: SeasonV2ViewMode;
  onViewModeChange?: (mode: SeasonV2ViewMode) => void;
  onOpenRanks?: (() => void) | null;
  onOpenPrize?: (() => void) | null;
  isLoading?: boolean;
};

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

export function getSeasonV2TeamTagStyle(teamCode: string | null | undefined): CSSProperties | undefined {
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

type SeasonV2ViewMode = "table" | "gms";

export default function SeasonStandingsV2Client(props: SeasonStandingsV2ClientProps) {
  return <SeasonStandingsNewLook {...props} />;
}
