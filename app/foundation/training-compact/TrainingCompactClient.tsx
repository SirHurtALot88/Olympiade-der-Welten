"use client";

import type { Team } from "@/lib/data/olyDataTypes";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

import TrainingCompactNewLook from "@/app/foundation/training-compact/TrainingCompactNewLook";
import type {
  TrainingClassOption,
  TrainingDevelopmentFilter,
  TrainingModeOption,
  TrainingPlayerRowView,
  TrainingSummaryView,
} from "@/app/foundation/training-facilities-v2/training-view-types";

export type TrainingCompactClientProps = {
  selectedTeam: Team;
  selectedTeamControlMode?: string | null;
  seasonLabel: string;
  managementLocked?: boolean;
  managementLockedReason?: string | null;
  summary: TrainingSummaryView;
  developmentFilter: TrainingDevelopmentFilter;
  developmentSummary: Record<TrainingDevelopmentFilter, number>;
  onSetDevelopmentFilter: (filter: TrainingDevelopmentFilter) => void;
  trainingModeOptions: TrainingModeOption[];
  trainingClassOptions: TrainingClassOption[];
  playerRows: TrainingPlayerRowView[];
  allPlayerCount: number;
  onSetTrainingMode: (playerId: string, mode: PlayerTrainingMode) => void;
  onSetTrainingClass: (playerId: string, trainingClass: string) => void;
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
  onOpenFacilities?: () => void;
  onOpenTeams?: () => void;
};

export default function TrainingCompactClient(props: TrainingCompactClientProps) {
  return <TrainingCompactNewLook {...props} />;
}
