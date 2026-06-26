import type { PlayerPotentialBand } from "@/lib/data/olyDataTypes";

export type HomeV2TopPlayerCard = {
  playerId: string;
  name: string;
  roleTag: string | null;
  portraitUrl: string | null;
  portraitInitials: string;
  playerOvr: number | null;
  playerPps: number | null;
  playerMvs: number | null;
  ppPow: number | null;
  ppSpe: number | null;
  ppMen: number | null;
  ppSoc: number | null;
  contractLength: number | null;
  marketValue: number | null;
  highlight?: "top" | "prospect" | null;
  topDisciplineId?: string | null;
  topDisciplineLabel?: string | null;
  topDisciplineTier?: string | null;
  topDisciplineScore?: number | null;
  potential?: number | null;
  potentialBand?: PlayerPotentialBand | null;
};

export type HomeV2FacilitySnapshot = {
  facilityId: string;
  label: string;
  level: number;
  maxLevel: number;
};

export type HomeV2ScheduleItem = {
  matchdayId: string;
  label: string;
  isCurrent: boolean;
  isPast: boolean;
};

export type HomeV2InboxItem = {
  id: string;
  title: string;
  detail: string;
  severity: "critical" | "warning" | "info";
};

export type HomeV2TodayCard = {
  key: string;
  kicker: string;
  title: string;
  detail: string;
  tone: "ready" | "warning" | "info";
};

export type HomeV2BoardObjective = {
  objectiveId: string;
  label: string;
  status: string;
  currentValue: string | number | boolean | null;
  targetValue: string | number | boolean | null;
};

export type HomeV2ClientProps = {
  teamName: string;
  teamCode: string;
  teamLogoUrl: string | null;
  teamLogoInitials: string;
  seasonName: string;
  matchdayLabel: string;
  managerLabel: string;
  controlModeLabel: string;
  rank: number | null;
  points: number | null;
  cash: number | null;
  salaryTotal: number | null;
  guv: number | null;
  rosterCount: number;
  gmStoryLabel: string | null;
  gmStoryDetail: string | null;
  gmStoryTone: string | null;
  boardPressure: number | null;
  boardRating: number | null;
  nextStepLabel: string;
  nextStepStatus: string;
  nextStepDetail: string;
  warnings: string[];
  topPlayers: HomeV2TopPlayerCard[];
  facilities: HomeV2FacilitySnapshot[];
  scheduleItems: HomeV2ScheduleItem[];
  inboxItems: HomeV2InboxItem[];
  todayCards: HomeV2TodayCard[];
  boardObjectives: HomeV2BoardObjective[];
  onContinue: () => void;
  onOpenTeams: () => void;
  onOpenLineup: () => void;
  onOpenMarket: () => void;
  onOpenTraining: () => void;
  onOpenOffice: () => void;
  onOpenSeason: () => void;
  onOpenInbox: () => void;
  onOpenBoardObjectives?: () => void;
  onOpenPlayer: (playerId: string) => void;
};
