import type { Team } from "@/lib/data/olyDataTypes";
import type { FacilityId, SpecialistWingVariant } from "@/lib/facilities/facility-catalog";

export type FacilityRowView = {
  id: FacilityId;
  name: string;
  description: string;
  effect: string;
  level: number;
  nextLevel: number;
  upgradeCost: number | null;
  currentUpkeep: number;
  nextUpkeep: number;
  currentIncome: number;
  nextIncome: number;
  conditionPct: number;
  efficiencyPct: number;
  conditionStatus: string;
  maintenanceCost: number;
  sourceStatus: string;
  currentEffect: string;
  nextLevelEffect: string;
};

export type FacilityUpgradePreviewView = {
  ok: boolean;
  action?: "upgrade" | "downgrade";
  confirmToken: string | null;
  facility: { facilityId: FacilityId; label: string; variant: string | null } | null;
  currentLevel: number;
  nextLevel: number | null;
  currentEffect: string;
  nextEffect: string | null;
  upgradeCost: number | null;
  refundAmount?: number | null;
  currentUpkeep: number;
  newUpkeep: number;
  currentIncome: number;
  newIncome: number;
  cashAfter: number | null;
  warnings: string[];
  blockingReasons: string[];
} | null;

export type FacilityMaintenancePreviewView = {
  ok: boolean;
  confirmToken: string | null;
  facility: { facilityId: FacilityId; label: string } | null;
  conditionPct: number;
  nextConditionPct: number;
  efficiencyPct: number;
  nextEfficiencyPct: number;
  maintenanceCost: number;
  cashAfter: number | null;
  warnings: string[];
  blockingReasons: string[];
} | null;

export type FacilityDialogState = {
  facilityId: FacilityId;
  action: "upgrade" | "downgrade" | "maintenance";
} | null;

export type FacilitiesV2ClientProps = {
  source: "sqlite" | "prisma";
  managementLocked?: boolean;
  managementLockedReason?: string | null;
  selectedTeam: Team;
  selectedTeamControlMode?: string | null;
  seasonLabel: string;
  onOpenTraining?: () => void;
  onOpenTeams?: () => void;
  facilityPanelTarget?: { facilityId: FacilityId; action: "upgrade" | "downgrade" | "maintenance" } | null;
  onOpenFacilityPanel?: (facilityId: FacilityId, action: "upgrade" | "downgrade" | "maintenance") => void;
  onCloseFacilityPanel?: () => void;
  summary: {
    cashCurrent: number;
    netFacilityResult: number;
    recoveryAfterTraining: number;
  };
  facilityRows: FacilityRowView[];
  specialistWingVariant: SpecialistWingVariant;
  specialistWingOptions: Array<{ value: SpecialistWingVariant; label: string }>;
  onSetSpecialistWingVariant: (variant: SpecialistWingVariant) => void;
  facilityUpgradeBusy: boolean;
  facilityUpgradePreview: FacilityUpgradePreviewView;
  facilityUpgradeError: string | null;
  facilityUpgradeSuccess: string | null;
  facilityMaintenanceBusy: boolean;
  facilityMaintenancePreview: FacilityMaintenancePreviewView;
  facilityMaintenanceError: string | null;
  facilityMaintenanceSuccess: string | null;
  onRunFacilityUpgradePreview: (facilityId: FacilityId, action?: "upgrade" | "downgrade") => void;
  onConfirmFacilityUpgrade: () => void;
  onRunFacilityMaintenancePreview: (facilityId: FacilityId) => void;
  onConfirmFacilityMaintenance: () => void;
};
