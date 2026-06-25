"use client";

import { useMemo, useState } from "react";

import ClassColorChip from "@/app/foundation/ClassColorChip";
import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { TooltipHeading } from "@/components/ui/TooltipHeading";
import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import type { PlayerGeneratorAttributeName, Team } from "@/lib/data/olyDataTypes";
import {
  SPECIALIST_WING_VARIANTS,
  getFacilityLevelDefinition,
  type FacilityId,
  type SpecialistWingVariant,
} from "@/lib/facilities/facility-catalog";
import type { ProgressionClassName } from "@/lib/training/class-progression-config";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

type TrainingModeOption = {
  value: PlayerTrainingMode;
  label: string;
  note: string;
  fatigueRisk: "niedrig" | "mittel" | "hoch";
};

type AttributeOption = {
  value: PlayerGeneratorAttributeName;
  label: string;
};

type TrainingPlayerRowView = {
  entryId: string;
  roleTag: string | null;
  player: {
    id: string;
    name: string;
    className: string;
    portraitUrl?: string | null;
    portraitPath?: string | null;
    coreStats: {
      pow: number;
      spe: number;
      men: number;
      soc: number;
    };
  };
  mode: PlayerTrainingMode;
  trainingClass: string;
  modeConfig: {
    label: string;
    note: string;
    fatigueRisk: "niedrig" | "mittel" | "hoch";
  };
  appearances: number;
  playerMvs: number | null;
  playerPps: number | null;
  trainingXp: number;
  performanceXp: number;
  totalXp: number;
  upgradeEstimate: string;
  fatigueWarning: string;
  recoveryForecast: {
    before: number;
    after: number;
    modifierPct: number;
  };
  organicForecast: {
    classBefore: string;
    classAfter: string;
    potentialRating: number | null;
    potentialTrainingMultiplier: number;
    trainingSetpoints: number;
    performanceSetpoints: number;
    netSetpoints: number;
    fatigueLoad: number;
    topGains: Array<{ attribute: string; before: number; after: number; delta: number }>;
    topLosses: Array<{ attribute: string; before: number; after: number; delta: number }>;
  };
  forecast: {
    netDevelopmentXP: number;
    trainingFormTier: string;
    regressionRisk: string | null;
    regressionPressure: number;
    appearanceXP: number;
    mvsXP: number;
    ppsBonusXP: number;
    topPlayerXP: number;
    highlightXP: number;
    traitModifierPct: number;
    fatigueStrain: {
      label: "niedrig" | "mittel" | "hoch";
    };
  };
};

type TrainingFacilityRowView = {
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

type FacilityUpgradePreviewView = {
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

type FacilityMaintenancePreviewView = {
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

type FacilityDialogState = {
  facilityId: FacilityId;
  action: "upgrade" | "downgrade" | "maintenance";
} | null;

type SeasonEndRowView = {
  playerId: string;
  playerName: string;
  className: string | null;
  portraitUrl?: string | null;
  portraitPath?: string | null;
  availableXP: number;
  plannedXP: number;
  remainingXP: number;
  plannedCount: number;
  status: string;
  blockReason: string;
  selectedAttribute: PlayerGeneratorAttributeName;
  attributeBefore: number | null;
  attributeAfter: number | null;
  ratingTierBefore: string | null;
  ratingTierAfter: string | null;
  plannedCost: number | null;
  topDeltas: Array<{ label: string; disciplineDelta: number | null }>;
  organicProgression: {
    classBefore: string;
    classAfter: string;
    trainingClass: string;
    secondaryTrainingClass?: string | null;
    traitModifierPct: number;
    facilityModifierPct: number;
    marketValuePressureTotal: number;
    trainingSetpoints: number;
    performanceSetpoints: number;
    netSetpoints: number;
    fatigueLoad: number;
    topGains: Array<{ attribute: string; delta: number }>;
    topLosses: Array<{ attribute: string; delta: number }>;
  } | null;
  facilityEffects: {
    xpBeforeFacility: number;
    facilityModifierPct: number;
    costBeforeFacility: number | null;
    facilityDiscountPct: number;
    appliedEffects: string[];
  };
  developmentSummary: {
    level: number;
    progressPct: number;
    trainingPointsAvailable: number;
    seasonLevelUpCap: number;
    signatureAttributes: string[];
    weakAttribute: string;
    lastTrend: string;
  } | null;
  economyAudit: {
    warningLevel: string;
    marketValueDeltaPct: number | null;
    salaryDeltaPct: number | null;
    marketValueWarnings: string[];
    salaryWarnings: string[];
  };
};

type TrainingFacilitiesV2ClientProps = {
  source: "sqlite" | "prisma";
  managementLocked?: boolean;
  managementLockedReason?: string | null;
  teams: Team[];
  selectedTeam: Team;
  selectedTeamControlMode?: string | null;
  seasonLabel: string;
  sponsorTotal: number | null;
  onSelectTeam: (teamId: string) => void;
  onOpenTeams?: (() => void) | null;
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
  summary: {
    cashCurrent: number;
    upkeepTotal: number;
    incomeTotal: number;
    netFacilityResult: number;
    trainingXpBefore: number;
    trainingXpAfter: number;
    trainingXpModifierPct: number;
    recoveryBeforeTraining: number;
    recoveryAfterTraining: number;
    performanceXp: number;
    totalXp: number;
    lightModeCount: number;
    hardModeCount: number;
  };
  developmentFilter: "all" | "growth" | "stable" | "regression";
  developmentSummary: Record<"all" | "growth" | "stable" | "regression", number>;
  onSetDevelopmentFilter: (filter: "all" | "growth" | "stable" | "regression") => void;
  trainingModeOptions: TrainingModeOption[];
  trainingClassOptions: Array<{ value: ProgressionClassName; label: string }>;
  playerRows: TrainingPlayerRowView[];
  allPlayerCount: number;
  onSetTrainingMode: (playerId: string, mode: PlayerTrainingMode) => void;
  onSetTrainingClass: (playerId: string, trainingClass: string) => void;
  facilityRows: TrainingFacilityRowView[];
  selectedFacilityPreviewId: string | null;
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
  facilityFinance: {
    cashBeforeFacilities: number;
    cashAfterFacilities: number;
    fanShopIncome: number;
    arenaIncome: number;
    incomeTotal: number;
    upkeepTotal: number;
    netFacilityResult: number;
    disabledFacilities: Array<{ name: string }>;
  };
  facilityForecast: {
    upgradeCost: number | null;
    currentUpkeep: number;
    nextUpkeep: number;
    currentIncome: number;
    nextIncome: number;
    projectedCash: number | null;
  };
  facilityEffectPreview: {
    recoveryAfterTraining: number;
    academyLowTier: { costBeforeFacility: number; costAfterFacility: number };
    specialistPower: { costAfterFacility: number };
    specialistSpeed: { costAfterFacility: number };
    scouting: { label: string };
    analytics: { label: string };
    warnings: string[];
  };
  onRunFacilityUpgradePreview: (facilityId: FacilityId, action?: "upgrade" | "downgrade") => void;
  onConfirmFacilityUpgrade: () => void;
  onRunFacilityMaintenancePreview: (facilityId: FacilityId) => void;
  onConfirmFacilityMaintenance: () => void;
  attributeOptions: AttributeOption[];
  seasonEndRows: SeasonEndRowView[];
  seasonEndBusy: boolean;
  seasonEndError: string | null;
  seasonEndSuccess: string | null;
  seasonEndStatus: {
    ok: boolean;
    confirmToken: string | null;
    warnings: string[];
    blockingReasons: string[];
    xpAvailable: number;
    xpPlanned: number;
    xpRemaining: number;
    plannedCount: number;
  };
  onSetSeasonEndAttribute: (playerId: string, attribute: PlayerGeneratorAttributeName) => void;
  onAddSeasonEndUpgrade: (playerId: string, attribute: PlayerGeneratorAttributeName) => void;
  onRemoveSeasonEndUpgrade: (playerId: string, attribute: PlayerGeneratorAttributeName) => void;
  onClearUpgradeCart: () => void;
  onConfirmSeasonEndXpSpend: () => void;
};

const AXIS_META = {
  pow: { label: "POW", tone: "is-pow" },
  spe: { label: "SPE", tone: "is-spe" },
  men: { label: "MEN", tone: "is-men" },
  soc: { label: "SOC", tone: "is-soc" },
} as const;

const ATTRIBUTE_SHORT_LABELS: Record<PlayerGeneratorAttributeName, string> = {
  power: "POW",
  health: "HEA",
  stamina: "STA",
  torment: "TOR",
  speed: "SPE",
  dexterity: "DEX",
  awareness: "AWA",
  intelligence: "INT",
  will: "WIL",
  determination: "DET",
  charisma: "CHA",
  spirit: "SPI",
};

function formatLocaleNumber(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPps(value: number | null | undefined) {
  return formatLocaleNumber(value, 1);
}

function formatSignedPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatLocaleNumber(value, 0)}%`;
}

function formatRiskLabel(value: string | null | undefined) {
  if (!value) return "unbekannt";
  if (value === "low") return "niedrig";
  if (value === "medium") return "mittel";
  if (value === "high") return "hoch";
  return value.replaceAll("_", " ");
}

function getDevelopmentTone(row: TrainingPlayerRowView) {
  if (row.forecast.netDevelopmentXP < 0 || row.forecast.regressionRisk === "high") {
    return "regression";
  }
  if (row.forecast.netDevelopmentXP >= 45) {
    return "growth";
  }
  return "stable";
}

function getTrainingModeTone(risk: TrainingModeOption["fatigueRisk"]) {
  if (risk === "hoch") return "regression";
  if (risk === "mittel") return "stable";
  return "growth";
}

function getFacilityHealthTone(facility: TrainingFacilityRowView) {
  if (facility.conditionPct < 60 || facility.efficiencyPct < 70) return "regression";
  if (facility.level <= 0) return "info";
  if (facility.upgradeCost != null) return "growth";
  return "stable";
}

function getPortraitModel(player: {
  id: string;
  name: string;
  portraitUrl?: string | null;
  portraitPath?: string | null;
}) {
  const src = getPlayerPortraitBrowserUrl(player.id, player.portraitUrl, player.portraitPath);
  const initials =
    player.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return { src, initials };
}

function getTeamLogoModel(team: Pick<Team, "teamId" | "name" | "logoPath">) {
  const src = getTeamLogoBrowserUrl(team.teamId, team.logoPath ?? null);
  const initials =
    team.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return { src, initials };
}

function FacilityLevelRail({ level, nextLevel }: { level: number; nextLevel: number }) {
  return (
    <div className="training-v2-level-rail" aria-label={`Facility Level ${level} von 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          className={`training-v2-level-dot${step <= level ? " is-filled" : ""}${step === nextLevel && nextLevel > level ? " is-next" : ""}`}
          title={`Level ${step}${step <= level ? " aktiv" : step === nextLevel ? " naechster Ausbau" : ""}`}
        />
      ))}
    </div>
  );
}

function FacilityLevelEffectGrid({ facilityId, level }: { facilityId: FacilityId; level: number }) {
  return (
    <div className="training-v2-level-effect-grid" aria-label="Facility Level Effekte">
      {[2, 3, 4, 5].map((targetLevel) => {
        const definition = getFacilityLevelDefinition(facilityId, targetLevel);
        return (
          <div
            key={`${facilityId}-level-${targetLevel}`}
            className={`training-v2-level-effect${targetLevel <= level ? " is-active" : ""}${targetLevel === level + 1 ? " is-next" : ""}`}
            title={definition?.effectDescription ?? "Kein Effekt hinterlegt"}
          >
            <span>L{targetLevel}</span>
            <strong>{definition?.effectDescription ?? "—"}</strong>
          </div>
        );
      })}
    </div>
  );
}

function TrainingAxisPill({
  axis,
  value,
}: {
  axis: keyof typeof AXIS_META;
  value: number | null | undefined;
}) {
  const meta = AXIS_META[axis];
  return (
    <span className={`training-v2-axis-pill ${meta.tone}`}>
      {meta.label} {formatLocaleNumber(value, 0)}
    </span>
  );
}

function formatFacilityActionReason(reason: string) {
  const mapped: Record<string, string> = {
    insufficient_cash: "Nicht genug Cash fuer diese Aktion.",
    facility_max_level: "Dieses Gebaeude ist bereits auf Max-Level.",
    facility_disabled: "Dieses Gebaeude ist aktuell deaktiviert und muss erst stabilisiert werden.",
    specialist_wing_variant_required: "Bitte zuerst eine Spezialisten-Variante waehlen.",
    specialist_wing_variant_switch_not_supported: "Diese Spezialisten-Variante kann nach dem Bau nicht mehr gewechselt werden.",
    team_not_found: "Team konnte fuer diese Gebaeude-Aktion nicht gefunden werden.",
    save_not_active: "Dieser Spielstand ist nicht aktiv.",
    save_not_found: "Spielstand konnte nicht gefunden werden.",
    local_team_not_owned_or_ai_controlled: "Nur eigene manuelle Teams duerfen Gebaeude bauen oder warten.",
    confirm_token_required: "Bitte erst pruefen und danach bestaetigen.",
    facility_upgrade_preview_stale: "Die Upgrade-Vorschau ist veraltet. Bitte noch einmal pruefen.",
    facility_maintenance_preview_stale: "Die Wartungs-Vorschau ist veraltet. Bitte noch einmal pruefen.",
    early_season_setup_allowed_before_first_result: "Frueher Saisonstart: Management-Aktion ist bis zum ersten echten Resultat erlaubt.",
  };
  if (mapped[reason]) return mapped[reason];
  if (reason.startsWith("phase_blocked:facility_apply:")) {
    return "Bauen ist in dieser Phase noch nicht dran. Du kannst die Kosten trotzdem pruefen; bestaetigen geht erst im Management-Fenster.";
  }
  return reason.replaceAll("_", " ");
}

function describeFacilityCondition(facility: TrainingFacilityRowView) {
  if (facility.level <= 0) {
    return "Noch nicht gebaut. Erst mit dem Bau startet Wirkung und Unterhalt.";
  }
  if (facility.conditionPct >= 100) {
    return "Zustand 100%: volle Effizienz, keine Wartung noetig.";
  }
  if (facility.conditionPct >= 80) {
    return `Zustand ${formatLocaleNumber(facility.conditionPct, 0)}%: noch stabil, aber Wirkung ist bereits leicht gedrueckt.`;
  }
  if (facility.conditionPct >= 60) {
    return `Zustand ${formatLocaleNumber(facility.conditionPct, 0)}%: Wirkung ist spuerbar reduziert, Wartung lohnt sich bald.`;
  }
  return `Zustand ${formatLocaleNumber(facility.conditionPct, 0)}%: deutlicher Leistungsverlust, hier versickert gerade viel Wirkung.`;
}

function describeFacilityUpkeep(facility: TrainingFacilityRowView) {
  if (facility.level <= 0) {
    return "Kein laufender Unterhalt, solange das Gebaeude nicht gebaut ist.";
  }
  const income = facility.currentIncome;
  const upkeep = facility.currentUpkeep;
  if (income <= 0) {
    return `Unterhalt kostet jede Saison ${formatTransfermarktCurrency(upkeep)}. Wartung aendert diese Last nicht, ein Downgrade schon.`;
  }
  const net = income - upkeep;
  return `Pro Saison: ${formatTransfermarktCurrency(income)} Income minus ${formatTransfermarktCurrency(upkeep)} Unterhalt = ${formatTransfermarktCurrency(net)} netto.`;
}

function describeSpecialistWingVariant(variant: SpecialistWingVariant, level: number, efficiencyPct: number) {
  const entry = SPECIALIST_WING_VARIANTS[variant];
  const labels = entry.attributes.map((attribute) => ATTRIBUTE_SHORT_LABELS[attribute]).join(" · ");
  const discountPct = ((getFacilityLevelDefinition("specialist_wing", level)?.discountPct ?? 0) * efficiencyPct) / 100;
  if (level <= 0) {
    return `${entry.label}: wirkt spaeter auf ${labels}. Erst nach dem Bau greift der Rabatt.`;
  }
  return `${entry.label}: passende Upgrades fuer ${labels} aktuell ${formatLocaleNumber(discountPct, 0)}% guenstiger.`;
}

function getFacilityActionExplainer(
  facility: TrainingFacilityRowView,
  action: "upgrade" | "downgrade" | "maintenance",
  variant: SpecialistWingVariant,
) {
  if (action === "maintenance") {
    return {
      title: "Wartung bringt das Gebaeude wieder hoch",
      body: "Wartung hebt den Zustand zurueck Richtung 100%. Mehr Zustand bedeutet direkt mehr Effizienz und damit mehr echte Wirkung.",
      bullets: [
        "Level bleibt gleich",
        "Unterhalt bleibt gleich",
        "Ziel ist volle Effizienz statt neues Level",
      ],
    };
  }
  if (action === "downgrade") {
    return {
      title: "Downgrade nimmt Wirkung raus, entlastet aber die Saisonkosten",
      body: "Beim Downgrade faellt ein Level weg. Dafuer bekommst du Geld zurueck, der kuenftige Unterhalt sinkt und das Gebaeude startet wieder sauber bei 100% Zustand.",
      bullets: [
        "25% Rueckerstattung des entfernten Levels",
        "kuenftiger Unterhalt sinkt",
        "Zustand wird auf 100% gesetzt",
      ],
    };
  }
  if (facility.id === "specialist_wing") {
    return {
      title: "Specialist Wing macht nur passende Upgrades billiger",
      body: describeSpecialistWingVariant(variant, Math.max(1, facility.nextLevel), Math.max(facility.efficiencyPct, 100)),
      bullets: [
        "wirkt nicht auf alle Attribute",
        "Rabatt haengt an Variante und Zustand",
        "mehr Level = groesserer Rabatt",
      ],
    };
  }
  return {
    title: "Upgrade hebt Level, Wirkung und Folgekosten",
    body: "Ein Upgrade schiebt das Gebaeude auf das naechste Level. Dadurch steigt die Wirkung, oft auch Income oder Rabatt, aber ebenso der laufende Unterhalt.",
    bullets: [
      "sofort staerkere Gebaeude-Wirkung",
      "kuenftiger Unterhalt steigt mit",
      "Cash wird jetzt belastet, Nutzen kommt ueber die Saison",
    ],
  };
}

export default function TrainingFacilitiesV2Client({
  source,
  managementLocked = false,
  managementLockedReason = null,
  teams,
  selectedTeam,
  selectedTeamControlMode,
  seasonLabel,
  sponsorTotal,
  onSelectTeam,
  onOpenTeams,
  onOpenPlayerDetails,
  summary,
  developmentFilter,
  developmentSummary,
  onSetDevelopmentFilter,
  trainingModeOptions,
  trainingClassOptions,
  playerRows,
  allPlayerCount,
  onSetTrainingMode,
  onSetTrainingClass,
  facilityRows,
  selectedFacilityPreviewId,
  specialistWingVariant,
  specialistWingOptions,
  onSetSpecialistWingVariant,
  facilityUpgradeBusy,
  facilityUpgradePreview,
  facilityUpgradeError,
  facilityUpgradeSuccess,
  facilityMaintenanceBusy,
  facilityMaintenancePreview,
  facilityMaintenanceError,
  facilityMaintenanceSuccess,
  facilityFinance,
  facilityForecast,
  facilityEffectPreview,
  onRunFacilityUpgradePreview,
  onConfirmFacilityUpgrade,
  onRunFacilityMaintenancePreview,
  onConfirmFacilityMaintenance,
  attributeOptions,
  seasonEndRows,
  seasonEndBusy,
  seasonEndError,
  seasonEndSuccess,
  seasonEndStatus,
  onSetSeasonEndAttribute,
  onAddSeasonEndUpgrade,
  onRemoveSeasonEndUpgrade,
  onClearUpgradeCart,
  onConfirmSeasonEndXpSpend,
}: TrainingFacilitiesV2ClientProps) {
  const [facilityDialog, setFacilityDialog] = useState<FacilityDialogState>(null);
  const teamLogo = getTeamLogoModel(selectedTeam);
  const readOnly = source === "prisma" || managementLocked;
  const trainingModeReadOnly = readOnly;
  const showLegacySeasonEndXpPanel = false;
  const facilityLaneActionReason =
    readOnly
      ? "Nur eigene Teams duerfen Gebaeude bauen oder warten."
      : facilityUpgradeBusy || facilityMaintenanceBusy
        ? "Erst die laufende Gebaeude-Aktion fertig rechnen lassen."
        : null;
  const facilityUpgradeConfirmReason =
    readOnly
      ? "Nur eigene Teams duerfen Gebaeude ausbauen."
        : facilityUpgradeBusy
          ? "Upgrade wird gerade verarbeitet."
        : !facilityUpgradePreview?.ok
          ? facilityUpgradePreview?.blockingReasons[0]
            ? formatFacilityActionReason(facilityUpgradePreview.blockingReasons[0])
            : "Bitte erst einen gueltigen Upgrade-Rahmen pruefen."
          : !facilityUpgradePreview?.confirmToken
            ? "Upgrade-Preview bitte einmal frisch laden."
            : null;
  const facilityMaintenanceConfirmReason =
    readOnly
      ? "Nur eigene Teams duerfen Wartung ausfuehren."
        : facilityMaintenanceBusy
          ? "Wartung wird gerade verarbeitet."
        : !facilityMaintenancePreview?.ok
          ? facilityMaintenancePreview?.blockingReasons[0]
            ? formatFacilityActionReason(facilityMaintenancePreview.blockingReasons[0])
            : "Bitte erst einen gueltigen Wartungs-Rahmen pruefen."
          : !facilityMaintenancePreview?.confirmToken
            ? "Wartungs-Preview bitte einmal frisch laden."
            : null;
  const seasonEndResetReason =
    readOnly
      ? "Nur eigene Teams duerfen XP-Planungen aendern."
      : seasonEndBusy
        ? "Erst die laufende XP-Aktion fertig rechnen lassen."
        : seasonEndStatus.plannedCount === 0
          ? "Es liegen noch keine XP-Upgrades im Warenkorb."
          : null;
  const seasonEndConfirmReason =
    readOnly
      ? "Nur eigene Teams duerfen Season-End-Upgrades bestaetigen."
      : seasonEndBusy
        ? "Season-End-XP wird gerade berechnet."
        : !seasonEndStatus.ok
          ? seasonEndStatus.blockingReasons[0] ?? "Bitte erst alle Blocker im XP-Plan loesen."
          : !seasonEndStatus.confirmToken
            ? "Bitte den XP-Plan einmal frisch aufbauen."
            : null;

  const topGrowth = useMemo(
    () =>
      [...playerRows]
        .sort((left, right) => right.forecast.netDevelopmentXP - left.forecast.netDevelopmentXP)[0] ?? null,
    [playerRows],
  );
  const topRisk = useMemo(
    () =>
      [...playerRows]
        .sort(
          (left, right) =>
            right.forecast.regressionPressure - left.forecast.regressionPressure ||
            right.totalXp - left.totalXp,
        )[0] ?? null,
    [playerRows],
  );
  const topFacilityNeed = useMemo(
    () =>
      [...facilityRows]
        .sort(
          (left, right) =>
            left.conditionPct - right.conditionPct ||
            (right.upgradeCost ?? 0) - (left.upgradeCost ?? 0),
        )[0] ?? null,
    [facilityRows],
  );
  const selectedDialogFacility = useMemo(
    () => facilityRows.find((facility) => facility.id === facilityDialog?.facilityId) ?? null,
    [facilityDialog?.facilityId, facilityRows],
  );
  const matchingUpgradePreview =
    facilityDialog?.action !== "maintenance" &&
    facilityUpgradePreview?.facility?.facilityId === facilityDialog?.facilityId
      ? facilityUpgradePreview
      : null;
  const matchingMaintenancePreview =
    facilityDialog?.action === "maintenance" &&
    facilityMaintenancePreview?.facility?.facilityId === facilityDialog?.facilityId
      ? facilityMaintenancePreview
      : null;
  const openFacilityDialog = (facilityId: FacilityId, action: "upgrade" | "downgrade" | "maintenance") => {
    setFacilityDialog({ facilityId, action });
    if (action === "maintenance") {
      onRunFacilityMaintenancePreview(facilityId);
      return;
    }
    onRunFacilityUpgradePreview(facilityId, action);
  };
  const runFacilityDialogAction = (action: "upgrade" | "downgrade" | "maintenance") => {
    if (!facilityDialog) return;
    setFacilityDialog({ facilityId: facilityDialog.facilityId, action });
    if (action === "maintenance") {
      onRunFacilityMaintenancePreview(facilityDialog.facilityId);
      return;
    }
    onRunFacilityUpgradePreview(facilityDialog.facilityId, action);
  };
  const activeFacilityConfirmReason =
    facilityDialog?.action === "maintenance" ? facilityMaintenanceConfirmReason : facilityUpgradeConfirmReason;
  const activeFacilityBusy =
    facilityDialog?.action === "maintenance" ? facilityMaintenanceBusy : facilityUpgradeBusy;
  const activeFacilityExplainer = selectedDialogFacility && facilityDialog
    ? getFacilityActionExplainer(selectedDialogFacility, facilityDialog.action, specialistWingVariant)
    : null;

  return (
    <section className="training-v2-shell">
      <header className="training-v2-hero">
        <div className="training-v2-hero-main">
          <div className="training-v2-team">
            {teamLogo.src ? (
              <OptimizedMediaImage
                src={teamLogo.src}
                alt={`${selectedTeam.name} Logo`}
                width={88}
                height={88}
                className="training-v2-team-logo"
              />
            ) : (
              <div className="training-v2-team-logo training-v2-team-logo-fallback">{teamLogo.initials}</div>
            )}
            <div className="training-v2-team-copy">
              <span className="training-v2-kicker">Training & Gebaeude</span>
              <TooltipHeading
                as="h2"
                tooltip="V2 baut den Trainingsscreen als Steuerzentrale: Spielerentwicklung zuerst, Gebaeude rechts im Blick und organisches Wachstum sichtbar."
              >
                Entwicklung steuern, Gebaeude lesen, Wachstum sauber planen.
              </TooltipHeading>
              <p>
                {selectedTeam.shortCode} · {selectedTeamControlMode ?? "manual"} · {seasonLabel}
              </p>
            </div>
          </div>
          <div className="training-v2-hero-actions">
            <label className="filter-field training-v2-team-select">
              <span>Fokus-Team</span>
              <select className="input" value={selectedTeam.teamId} onChange={(event) => onSelectTeam(event.target.value)}>
                {teams.map((team) => (
                  <option key={team.teamId} value={team.teamId}>
                    {team.shortCode} · {team.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="training-v2-hero-button-row">
              <button className="secondary-button inline-button" type="button" onClick={() => onOpenTeams?.()}>
                Team ansehen
              </button>
            </div>
          </div>
        </div>

        <div className="training-v2-summary-grid">
          <article className="training-v2-summary-card">
            <span>Cash</span>
            <strong>{formatTransfermarktCurrency(summary.cashCurrent)}</strong>
            <small>Sponsor {sponsorTotal != null ? formatTransfermarktCurrency(sponsorTotal) : "—"}</small>
          </article>
          <article className="training-v2-summary-card">
            <span>Facility-Netto</span>
            <strong className={summary.netFacilityResult >= 0 ? "text-positive" : "text-negative"}>
              {formatTransfermarktCurrency(summary.netFacilityResult)}
            </strong>
            <small>
              Income {formatTransfermarktCurrency(summary.incomeTotal)} · Unterhalt {formatTransfermarktCurrency(summary.upkeepTotal)}
            </small>
          </article>
          <article className="training-v2-summary-card">
            <span>Trainingsertrag</span>
            <strong>{formatLocaleNumber(summary.trainingXpAfter, 0)}</strong>
            <small>
              {formatLocaleNumber(summary.trainingXpBefore, 0)} vor Facility · {formatSignedPercent(summary.trainingXpModifierPct)}
            </small>
          </article>
          <article className="training-v2-summary-card">
            <span>Regeneration</span>
            <strong>
              {formatPps(summary.recoveryBeforeTraining)} → {formatPps(summary.recoveryAfterTraining)}
            </strong>
            <small>
              Performance {formatLocaleNumber(summary.performanceXp, 0)} · Gesamt {formatLocaleNumber(summary.totalXp, 0)}
            </small>
          </article>
        </div>

        <div className="training-v2-story-grid">
          <article className="training-v2-story-card is-growth">
            <span>Top Steigerer</span>
            <strong>{topGrowth?.player.name ?? "—"}</strong>
            <small>
              {topGrowth
                ? `+${formatLocaleNumber(topGrowth.forecast.netDevelopmentXP, 0)} Wachstum · ${topGrowth.modeConfig.label}`
                : "Kein aktiver Kader"}
            </small>
          </article>
          <article className="training-v2-story-card is-risk">
            <span>Groesstes Risiko</span>
            <strong>{topRisk?.player.name ?? "—"}</strong>
            <small>
              {topRisk
                ? `Rueckschritt ${formatLocaleNumber(topRisk.forecast.regressionPressure, 0)} · ${formatRiskLabel(topRisk.forecast.regressionRisk)}`
                : "Keine Risikodaten"}
            </small>
          </article>
          <article className="training-v2-story-card is-facility">
            <span>Gebaeude-Fokus</span>
            <strong>{topFacilityNeed?.name ?? "—"}</strong>
            <small>
              {topFacilityNeed
                ? `Zustand ${formatLocaleNumber(topFacilityNeed.conditionPct, 0)}% · Effizienz ${formatLocaleNumber(topFacilityNeed.efficiencyPct, 0)}%`
                : "Keine Facility-Daten"}
            </small>
          </article>
          <article className="training-v2-story-card is-seasonend">
            <span>Kaderentwicklung</span>
            <strong>{developmentSummary.growth}</strong>
            <small>
              {developmentSummary.regression} Risiko · {developmentSummary.stable} stabil
            </small>
          </article>
        </div>
      </header>

      <section className="training-v2-workspace">
        <div className="training-v2-lane training-v2-lane-training">
          <div className="training-v2-section-head">
            <div>
              <span className="training-v2-kicker">Spielertraining</span>
              <strong>Wer steigt jetzt, wer kippt spaeter?</strong>
            </div>
            <span className="pill">
              {playerRows.length}/{allPlayerCount}
            </span>
          </div>

          <div className="training-v2-filter-row">
            {([
              { id: "all" as const, label: "Alle", detail: "ganzer Kader" },
              { id: "growth" as const, label: "Steigt", detail: "lohnt sich jetzt" },
              { id: "stable" as const, label: "Stabil", detail: "Modus pruefen" },
              { id: "regression" as const, label: "Risiko", detail: "zuerst sichern" },
            ]).map((filter) => (
              <button
                key={filter.id}
                className={`training-v2-filter-card${developmentFilter === filter.id ? " is-active" : ""}`}
                type="button"
                onClick={() => onSetDevelopmentFilter(filter.id)}
              >
                <span>{filter.label}</span>
                <strong>{developmentSummary[filter.id]}</strong>
                <small>{filter.detail}</small>
              </button>
            ))}
          </div>

          <div className="training-v2-player-list">
            {playerRows.map((row) => {
              const portrait = getPortraitModel(row.player);
              const tone = getDevelopmentTone(row);
              return (
                <article className={`training-v2-player-card is-${tone}`} id={`training-player-${row.player.id}`} key={row.entryId}>
                  <button
                    className="training-v2-player-head"
                    type="button"
                    onClick={() => onOpenPlayerDetails?.({ playerId: row.player.id, activePlayerId: row.entryId })}
                  >
                    <div className="training-v2-player-media">
                      {portrait.src ? (
                        <OptimizedMediaImage
                          src={portrait.src}
                          alt={row.player.name}
                          width={78}
                          height={78}
                          className="training-v2-player-image"
                        />
                      ) : (
                        <div className="training-v2-player-image training-v2-player-image-fallback">{portrait.initials}</div>
                      )}
                    </div>
                    <div className="training-v2-player-copy">
                      <strong className="training-v2-clickable">{row.player.name}</strong>
                      <p>
                        <ClassColorChip className={row.player.className} /> · {row.roleTag ?? "ohne Rolle"}
                      </p>
                      <div className="training-v2-axis-row">
                        <TrainingAxisPill axis="pow" value={row.player.coreStats.pow} />
                        <TrainingAxisPill axis="spe" value={row.player.coreStats.spe} />
                        <TrainingAxisPill axis="men" value={row.player.coreStats.men} />
                        <TrainingAxisPill axis="soc" value={row.player.coreStats.soc} />
                      </div>
                    </div>
                    <div className="training-v2-player-badge-row">
                      <span className={`training-v2-badge is-${tone}`}>
                        {tone === "growth" ? "steigt" : tone === "regression" ? "kann fallen" : "stabil"}
                      </span>
                    </div>
                  </button>

	                  <div className="training-v2-player-metrics">
	                    <div>
	                      <span>Stat Forecast</span>
	                      <strong className={row.organicForecast.netSetpoints >= 0 ? "text-positive" : "text-negative"}>
	                        {row.organicForecast.netSetpoints > 0 ? "+" : ""}
	                        {formatLocaleNumber(row.organicForecast.netSetpoints, 1)}
	                      </strong>
	                    </div>
	                    <div>
	                      <span>Training</span>
	                      <strong>+{formatLocaleNumber(row.organicForecast.trainingSetpoints, 1)}</strong>
	                    </div>
	                    <div>
	                      <span>Potential</span>
	                      <strong>{row.organicForecast.potentialRating ?? "—"} · x{formatLocaleNumber(row.organicForecast.potentialTrainingMultiplier, 2)}</strong>
	                    </div>
	                    <div>
	                      <span>Fatigue</span>
	                      <strong>+{formatLocaleNumber(row.organicForecast.fatigueLoad, 1)}</strong>
	                    </div>
	                  </div>

	                  <div className="training-v2-plan-controls">
	                  <div className="training-v2-mode-strip" aria-label={`${row.player.name} Trainingsmodus`}>
	                    {trainingModeOptions.map((option) => (
	                      <button
                        key={`${row.player.id}-${option.value}`}
                        className={`training-v2-mode-chip${row.mode === option.value ? " is-active" : ""}`}
                        type="button"
                        disabled={trainingModeReadOnly}
                        onClick={() => onSetTrainingMode(row.player.id, option.value)}
                      >
                        {option.label}
	                      </button>
	                    ))}
	                  </div>
	                    <label className="filter-field training-v2-class-select">
	                      <span>Trainingsklasse</span>
	                      <select
	                        className="input"
	                        value={row.trainingClass}
	                        disabled={trainingModeReadOnly}
	                        onChange={(event) => onSetTrainingClass(row.player.id, event.target.value)}
	                      >
	                        {trainingClassOptions.map((option) => (
	                          <option key={option.value} value={option.value}>
	                            {option.label}
	                          </option>
	                        ))}
	                      </select>
	                    </label>
	                  </div>

	                  <div className="training-v2-stat-forecast">
	                    {row.organicForecast.topGains.map((entry) => (
	                      <span key={`${row.player.id}-gain-${entry.attribute}`}>
	                        <small>{entry.attribute}</small>
	                        <strong>
	                          {formatLocaleNumber(entry.before, 1)} → {formatLocaleNumber(entry.after, 1)}
	                        </strong>
	                        <em>+{formatLocaleNumber(entry.delta, 1)}</em>
	                      </span>
	                    ))}
	                    {row.organicForecast.topLosses.map((entry) => (
	                      <span className="is-risk" key={`${row.player.id}-loss-${entry.attribute}`}>
	                        <small>{entry.attribute}</small>
	                        <strong>
	                          {formatLocaleNumber(entry.before, 1)} → {formatLocaleNumber(entry.after, 1)}
	                        </strong>
	                        <em>{formatLocaleNumber(entry.delta, 1)}</em>
	                      </span>
	                    ))}
	                  </div>

	                  <div className="training-v2-player-foot">
	                    <small>{row.modeConfig.note}</small>
	                    <small>
	                      Klasse {row.organicForecast.classBefore} → {row.organicForecast.classAfter} · Training {row.trainingClass}
	                    </small>
	                    <small>
	                      Performance +{formatLocaleNumber(row.organicForecast.performanceSetpoints, 1)} · Steigerungsstufe {row.forecast.trainingFormTier}
	                    </small>
	                    <small>
	                      Risiko {row.forecast.fatigueStrain.label} · {row.fatigueWarning}
	                    </small>
	                  </div>
                </article>
              );
            })}
            {playerRows.length === 0 ? (
              <div className="training-v2-empty">
                <strong>Keine Spieler im aktuellen Filter.</strong>
                <p>Wechsle den Entwicklungsfokus oder waehle ein anderes Team.</p>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="training-v2-lane training-v2-lane-facilities">
          <div className="training-v2-section-head">
            <div>
              <span className="training-v2-kicker">Gebaeude</span>
              <strong>Unterhalt, Zustand und naechster Hebel</strong>
            </div>
            <span className={`transfer-status-pill ${readOnly ? "is-warning" : "is-ready"}`}>
              {managementLocked ? "nur ansehen" : readOnly ? "read only" : "lokal aktiv"}
            </span>
          </div>
          {managementLockedReason ? <p className="muted">{managementLockedReason}</p> : null}
          {readOnly ? (
            <div className="training-v2-lock-note">
              <strong>Nur Ansicht</strong>
              <span>Du kannst Wirkung, Kosten und Risiken lesen. Aenderungen sind nur fuer eigene Teams aktiv.</span>
            </div>
          ) : null}
          {facilityLaneActionReason ? <p className="foundation-screen-action-reason">Warum nicht: {facilityLaneActionReason}</p> : null}

          <div className="training-v2-mode-guide" aria-label="Trainingslast Erklaerung">
            {trainingModeOptions.map((option) => (
              <article className={`training-v2-mode-guide-card is-${getTrainingModeTone(option.fatigueRisk)}`} key={`mode-guide-${option.value}`}>
                <span>{option.label}</span>
                <strong>Fatigue {option.fatigueRisk}</strong>
                <small>{option.note}</small>
              </article>
            ))}
          </div>

          <div className="training-v2-facility-list">
            {facilityRows.map((facility) => {
              const selected = selectedFacilityPreviewId === facility.id;
              const canMaintain = facility.level > 0 && facility.conditionPct < 100 && !readOnly;
              const canDowngrade = facility.level > 0 && !readOnly;
              const facilityTone = getFacilityHealthTone(facility);
              return (
                <article className={`training-v2-facility-card is-${facilityTone}${selected ? " is-selected" : ""}`} key={facility.id}>
                  <div className="training-v2-facility-head">
                    <div>
                      <strong>{facility.name}</strong>
                      <small>{facility.description}</small>
                    </div>
                    <span className={`training-v2-badge is-${facilityTone}`}>
                      L{facility.level}
                    </span>
                  </div>
                  <FacilityLevelRail level={facility.level} nextLevel={facility.nextLevel} />
                  <div className="training-v2-facility-metrics">
                    <span>Zustand {formatLocaleNumber(facility.conditionPct, 0)}%</span>
                    <span>Effizienz {formatLocaleNumber(facility.efficiencyPct, 0)}%</span>
                    <span>Kosten {facility.upgradeCost != null ? formatTransfermarktCurrency(facility.upgradeCost) : "Max"}</span>
                    <span>Wartung {facility.maintenanceCost > 0 ? formatTransfermarktCurrency(facility.maintenanceCost) : "voll"}</span>
                    <span>Netto {formatTransfermarktCurrency(facility.currentIncome - facility.currentUpkeep)}</span>
                    <span>Status {facility.sourceStatus.replaceAll("_", " ")}</span>
                  </div>
                  <div className="training-v2-facility-effects">
                    <div>
                      <span>Jetzt</span>
                      <strong>{facility.currentEffect}</strong>
                    </div>
                    <div>
                      <span>Naechstes Level</span>
                      <strong>{facility.nextLevelEffect}</strong>
                    </div>
                  </div>
                  <div className="training-v2-facility-callout">
                    <strong>{describeFacilityCondition(facility)}</strong>
                    <small>{describeFacilityUpkeep(facility)}</small>
                    {facility.id === "specialist_wing" ? (
                      <small>{describeSpecialistWingVariant(specialistWingVariant, Math.max(facility.level, 1), Math.max(facility.efficiencyPct, 100))}</small>
                    ) : null}
                  </div>
                  <FacilityLevelEffectGrid facilityId={facility.id} level={facility.level} />
                  {facility.id === "specialist_wing" && facility.level === 0 ? (
                    <label className="filter-field">
                      <span>Variante</span>
                      <select
                        className="input"
                        value={specialistWingVariant}
                        disabled={readOnly}
                        onChange={(event) => onSetSpecialistWingVariant(event.target.value as SpecialistWingVariant)}
                      >
                        {specialistWingOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <div className="training-v2-facility-actions">
                    <button
                      className="secondary-button inline-button"
                      type="button"
                      disabled={readOnly || facilityUpgradeBusy || facilityMaintenanceBusy}
                      title={readOnly ? "Nur eigene Teams duerfen Gebaeude ausbauen." : "Prueft Kosten, Unterhalt, Income und naechsten Effekt."}
                      onClick={() => openFacilityDialog(facility.id, "upgrade")}
                    >
                      {selected && facilityUpgradePreview?.ok ? "Upgrade neu pruefen" : "Upgrade pruefen"}
                    </button>
                    <button
                      className="secondary-button inline-button"
                      type="button"
                      disabled={facilityUpgradeBusy || facilityMaintenanceBusy || !canDowngrade}
                      title={
                        readOnly
                          ? "Nur eigene Teams duerfen Gebaeude abbauen."
                          : facility.level <= 0
                            ? "Noch kein aktives Gebaeude vorhanden."
                            : "Senkt das Level, repariert auf 100% und erstattet 25% der Kosten des entfernten Levels."
                      }
                      onClick={() => openFacilityDialog(facility.id, "downgrade")}
                    >
                      Downgrade pruefen
                    </button>
                    <button
                      className="secondary-button inline-button"
                      type="button"
                      disabled={facilityUpgradeBusy || facilityMaintenanceBusy || !canMaintain}
                      title={
                        readOnly
                          ? "Nur eigene Teams duerfen Wartung ausfuehren."
                          : facility.level <= 0
                            ? "Noch kein aktives Gebaeude vorhanden."
                            : facility.conditionPct >= 100
                              ? "Zustand ist bereits voll."
                              : "Prueft Kosten und Effizienz nach Wartung."
                      }
                      onClick={() => openFacilityDialog(facility.id, "maintenance")}
                    >
                      Wartung pruefen
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="training-v2-preview-stack">
            <article className="training-v2-preview-card">
              <span>Facility-Finance</span>
              <div className="training-v2-mini-grid">
                <div>
                  <small>Cash vor/nach</small>
                  <strong>
                    {formatTransfermarktCurrency(facilityFinance.cashBeforeFacilities)} → {formatTransfermarktCurrency(facilityFinance.cashAfterFacilities)}
                  </strong>
                </div>
                <div>
                  <small>Income / Unterhalt</small>
                  <strong>
                    {formatTransfermarktCurrency(facilityFinance.incomeTotal)} / {formatTransfermarktCurrency(facilityFinance.upkeepTotal)}
                  </strong>
                </div>
                <div>
                  <small>Fan Shop / Arena</small>
                  <strong>
                    {formatTransfermarktCurrency(facilityFinance.fanShopIncome)} / {formatTransfermarktCurrency(facilityFinance.arenaIncome)}
                  </strong>
                </div>
                <div>
                  <small>Naechstes Upgrade</small>
                  <strong>{facilityForecast.upgradeCost != null ? formatTransfermarktCurrency(facilityForecast.upgradeCost) : "—"}</strong>
                </div>
              </div>
              <p className="muted">
                {facilityFinance.disabledFacilities.length > 0
                  ? `Ausgebremst: ${facilityFinance.disabledFacilities.map((entry) => entry.name).join(", ")}`
                  : "Keine deaktivierten Gebaeude."}
              </p>
            </article>

            <article className="training-v2-preview-card">
              <span>Gebaeude-Wirkung</span>
              <div className="training-v2-mini-grid">
                <div>
                  <small>Training-XP</small>
                  <strong>
                    {formatLocaleNumber(summary.trainingXpBefore, 0)} → {formatLocaleNumber(summary.trainingXpAfter, 0)}
                  </strong>
                </div>
                <div>
                  <small>Recovery nach Training</small>
                  <strong>{formatPps(facilityEffectPreview.recoveryAfterTraining)}</strong>
                </div>
                <div>
                  <small>Akademie Rabatt</small>
                  <strong>
                    {formatLocaleNumber(facilityEffectPreview.academyLowTier.costBeforeFacility, 0)} → {formatLocaleNumber(facilityEffectPreview.academyLowTier.costAfterFacility, 0)}
                  </strong>
                </div>
                <div>
                  <small>Spezialist POW / SPE</small>
                  <strong>
                    {formatLocaleNumber(facilityEffectPreview.specialistPower.costAfterFacility, 0)} / {formatLocaleNumber(facilityEffectPreview.specialistSpeed.costAfterFacility, 0)}
                  </strong>
                </div>
              </div>
              <p className="muted">
                Scouting {facilityEffectPreview.scouting.label} · Analytics {facilityEffectPreview.analytics.label}
                {facilityEffectPreview.warnings.length > 0 ? ` · ${facilityEffectPreview.warnings.join(" · ")}` : ""}
              </p>
            </article>

            {facilityUpgradePreview ? (
              <article className="training-v2-preview-card is-upgrade">
                <span>{facilityUpgradePreview.action === "downgrade" ? "Downgrade-Vorschau" : "Upgrade-Vorschau"}</span>
                <strong>{facilityUpgradePreview.facility?.label ?? "Gebaeude"}</strong>
                <div className="training-v2-mini-grid">
                  <div>
                    <small>Level</small>
                    <strong>
                      {facilityUpgradePreview.currentLevel} → {facilityUpgradePreview.nextLevel ?? "—"}
                    </strong>
                  </div>
                  <div>
                    <small>Cash danach</small>
                    <strong>{formatTransfermarktCurrency(facilityUpgradePreview.cashAfter)}</strong>
                  </div>
                  <div>
                    <small>{facilityUpgradePreview.action === "downgrade" ? "Erstattung" : "Kosten"}</small>
                    <strong>
                      {facilityUpgradePreview.action === "downgrade"
                        ? formatTransfermarktCurrency(facilityUpgradePreview.refundAmount ?? null)
                        : formatTransfermarktCurrency(facilityUpgradePreview.upgradeCost)}
                    </strong>
                  </div>
                  <div>
                    <small>Unterhalt</small>
                    <strong>
                      {formatTransfermarktCurrency(facilityUpgradePreview.currentUpkeep)} → {formatTransfermarktCurrency(facilityUpgradePreview.newUpkeep)}
                    </strong>
                  </div>
                  <div>
                    <small>Income</small>
                    <strong>
                      {formatTransfermarktCurrency(facilityUpgradePreview.currentIncome)} → {formatTransfermarktCurrency(facilityUpgradePreview.newIncome)}
                    </strong>
                  </div>
                </div>
                <p className="muted">
                  {facilityUpgradePreview.currentEffect} → {facilityUpgradePreview.nextEffect ?? "Max"}
                </p>
                {facilityUpgradePreview.blockingReasons.length > 0 ? (
                  <p className="text-negative">Noch offen: {facilityUpgradePreview.blockingReasons.map(formatFacilityActionReason).join(" · ")}</p>
                ) : null}
                {facilityUpgradePreview.warnings.length > 0 ? (
                  <p className="muted">Hinweise: {facilityUpgradePreview.warnings.map(formatFacilityActionReason).join(" · ")}</p>
                ) : null}
                {facilityUpgradeError ? <p className="text-negative">{facilityUpgradeError}</p> : null}
                {facilityUpgradeSuccess ? <p className="text-positive">{facilityUpgradeSuccess}</p> : null}
                <button
                  className="primary-button"
                  type="button"
                  disabled={readOnly || facilityUpgradeBusy || !facilityUpgradePreview.ok || !facilityUpgradePreview.confirmToken}
                  onClick={() => onConfirmFacilityUpgrade()}
                >
                  {facilityUpgradeBusy
                    ? facilityUpgradePreview.action === "downgrade"
                      ? "Downgrade laeuft..."
                      : "Upgrade laeuft..."
                    : facilityUpgradePreview.action === "downgrade"
                      ? "Downgrade bestaetigen"
                      : "Upgrade bestaetigen"}
                </button>
                {facilityUpgradeConfirmReason ? <p className="foundation-screen-action-reason">Warum nicht: {facilityUpgradeConfirmReason}</p> : null}
              </article>
            ) : null}

            {facilityMaintenancePreview ? (
              <article className="training-v2-preview-card is-maintenance">
                <span>Wartungs-Vorschau</span>
                <strong>{facilityMaintenancePreview.facility?.label ?? "Gebaeude"}</strong>
                <div className="training-v2-mini-grid">
                  <div>
                    <small>Zustand</small>
                    <strong>
                      {formatLocaleNumber(facilityMaintenancePreview.conditionPct, 0)}% → {formatLocaleNumber(facilityMaintenancePreview.nextConditionPct, 0)}%
                    </strong>
                  </div>
                  <div>
                    <small>Effizienz</small>
                    <strong>
                      {formatLocaleNumber(facilityMaintenancePreview.efficiencyPct, 0)}% → {formatLocaleNumber(facilityMaintenancePreview.nextEfficiencyPct, 0)}%
                    </strong>
                  </div>
                  <div>
                    <small>Kosten</small>
                    <strong>{formatTransfermarktCurrency(facilityMaintenancePreview.maintenanceCost)}</strong>
                  </div>
                  <div>
                    <small>Cash danach</small>
                    <strong>{formatTransfermarktCurrency(facilityMaintenancePreview.cashAfter)}</strong>
                  </div>
                </div>
                {facilityMaintenancePreview.blockingReasons.length > 0 ? (
                  <p className="text-negative">Noch offen: {facilityMaintenancePreview.blockingReasons.map(formatFacilityActionReason).join(" · ")}</p>
                ) : null}
                {facilityMaintenancePreview.warnings.length > 0 ? (
                  <p className="muted">Hinweise: {facilityMaintenancePreview.warnings.map(formatFacilityActionReason).join(" · ")}</p>
                ) : null}
                {facilityMaintenanceError ? <p className="text-negative">{facilityMaintenanceError}</p> : null}
                {facilityMaintenanceSuccess ? <p className="text-positive">{facilityMaintenanceSuccess}</p> : null}
                <button
                  className="primary-button"
                  type="button"
                  disabled={readOnly || facilityMaintenanceBusy || !facilityMaintenancePreview.ok || !facilityMaintenancePreview.confirmToken}
                  onClick={() => onConfirmFacilityMaintenance()}
                >
                  {facilityMaintenanceBusy ? "Wartung laeuft..." : "Wartung bestaetigen"}
                </button>
                {facilityMaintenanceConfirmReason ? <p className="foundation-screen-action-reason">Warum nicht: {facilityMaintenanceConfirmReason}</p> : null}
              </article>
            ) : null}
          </div>
        </aside>
      </section>

      {facilityDialog && selectedDialogFacility ? (
        <div className="foundation-modal-backdrop" onClick={() => setFacilityDialog(null)}>
          <div className="foundation-modal training-v2-facility-modal" onClick={(event) => event.stopPropagation()}>
            <div className="foundation-modal-header">
              <div>
                <span className="training-v2-kicker">Gebaeude-Entscheidung</span>
                <h3>{selectedDialogFacility.name}</h3>
                <p className="muted">
                  {selectedTeam.shortCode} · Level {selectedDialogFacility.level} · Zustand{" "}
                  {formatLocaleNumber(selectedDialogFacility.conditionPct, 0)}% · Effizienz{" "}
                  {formatLocaleNumber(selectedDialogFacility.efficiencyPct, 0)}%
                </p>
              </div>
              <button className="secondary-button" type="button" onClick={() => setFacilityDialog(null)}>
                Schliessen
              </button>
            </div>

            <div className="foundation-modal-body training-v2-facility-modal-body">
              <section className="training-v2-facility-modal-hero">
                <div>
                  <span>Aktuell</span>
                  <strong>{selectedDialogFacility.currentEffect}</strong>
                  <small>{selectedDialogFacility.description}</small>
                </div>
                <div>
                  <span>Naechstes Level</span>
                  <strong>{selectedDialogFacility.nextLevelEffect}</strong>
                  <small>
                    Kosten {selectedDialogFacility.upgradeCost != null ? formatTransfermarktCurrency(selectedDialogFacility.upgradeCost) : "Max"} ·
                    Unterhalt {formatTransfermarktCurrency(selectedDialogFacility.currentUpkeep)} →{" "}
                    {formatTransfermarktCurrency(selectedDialogFacility.nextUpkeep)}
                  </small>
                </div>
              </section>

              <section className="training-v2-facility-modal-grid">
                <article className="training-v2-preview-card">
                  <span>Gebaeudezustand</span>
                  <FacilityLevelRail level={selectedDialogFacility.level} nextLevel={selectedDialogFacility.nextLevel} />
                  <div className="training-v2-mini-grid">
                    <div>
                      <small>Zustand</small>
                      <strong>{formatLocaleNumber(selectedDialogFacility.conditionPct, 0)}%</strong>
                    </div>
                    <div>
                      <small>Effizienz</small>
                      <strong>{formatLocaleNumber(selectedDialogFacility.efficiencyPct, 0)}%</strong>
                    </div>
                    <div>
                      <small>Unterhalt</small>
                      <strong>{formatTransfermarktCurrency(selectedDialogFacility.currentUpkeep)}</strong>
                    </div>
                    <div>
                      <small>Income</small>
                      <strong>{formatTransfermarktCurrency(selectedDialogFacility.currentIncome)}</strong>
                    </div>
                    <div>
                      <small>Netto</small>
                      <strong>{formatTransfermarktCurrency(selectedDialogFacility.currentIncome - selectedDialogFacility.currentUpkeep)}</strong>
                    </div>
                    <div>
                      <small>Status</small>
                      <strong>{selectedDialogFacility.sourceStatus.replaceAll("_", " ")}</strong>
                    </div>
                  </div>
                  <p className="muted">{describeFacilityCondition(selectedDialogFacility)}</p>
                </article>

                <article className="training-v2-preview-card">
                  <span>Level-Wirkung</span>
                  <FacilityLevelEffectGrid facilityId={selectedDialogFacility.id} level={selectedDialogFacility.level} />
                  <p className="muted">{describeFacilityUpkeep(selectedDialogFacility)}</p>
                  {selectedDialogFacility.id === "specialist_wing" && selectedDialogFacility.level === 0 ? (
                    <label className="filter-field">
                      <span>Variante vor Bau</span>
                      <select
                        className="input"
                        value={specialistWingVariant}
                        disabled={readOnly}
                        onChange={(event) => onSetSpecialistWingVariant(event.target.value as SpecialistWingVariant)}
                      >
                        {specialistWingOptions.map((option) => (
                          <option key={`modal-specialist-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {selectedDialogFacility.id === "specialist_wing" ? (
                    <div className="training-v2-specialist-note">
                      <strong>Aktive Variante</strong>
                      <small>{describeSpecialistWingVariant(specialistWingVariant, Math.max(selectedDialogFacility.level, 1), Math.max(selectedDialogFacility.efficiencyPct, 100))}</small>
                    </div>
                  ) : null}
                </article>
              </section>

              {activeFacilityExplainer ? (
                <section className="training-v2-facility-logic-grid">
                  <article className="training-v2-preview-card">
                    <span>Was passiert jetzt?</span>
                    <strong>{activeFacilityExplainer.title}</strong>
                    <p className="muted">{activeFacilityExplainer.body}</p>
                    <div className="training-v2-logic-pill-row">
                      {activeFacilityExplainer.bullets.map((bullet) => (
                        <span className="training-v2-logic-pill" key={bullet}>
                          {bullet}
                        </span>
                      ))}
                    </div>
                  </article>
                  <article className="training-v2-preview-card">
                    <span>System-Regeln</span>
                    <strong>Zustand 100% = volle Wirkung</strong>
                    <p className="muted">
                      Sinkt der Zustand, faellt auch die Effizienz. Wartung stellt die Wirkung wieder her. Unterhalt ist die laufende Saisonlast und wird
                      durch Wartung nicht billiger.
                    </p>
                    {selectedDialogFacility.id === "specialist_wing" ? (
                      <div className="training-v2-logic-pill-row">
                        <span className="training-v2-logic-pill">nur passende Attribute</span>
                        <span className="training-v2-logic-pill">Variante entscheidet den Rabatt</span>
                        <span className="training-v2-logic-pill">bester Wert bei starkem Zustand</span>
                      </div>
                    ) : null}
                  </article>
                </section>
              ) : null}

              <section className="training-v2-facility-action-tabs" aria-label="Gebaeude-Aktion waehlen">
                <button
                  className={`training-v2-facility-action-tab${facilityDialog.action === "upgrade" ? " is-active" : ""}`}
                  type="button"
                  disabled={readOnly || facilityUpgradeBusy || facilityMaintenanceBusy}
                  onClick={() => runFacilityDialogAction("upgrade")}
                >
                  <span>Upgrade</span>
                  <strong>{selectedDialogFacility.upgradeCost != null ? formatTransfermarktCurrency(selectedDialogFacility.upgradeCost) : "Max"}</strong>
                </button>
                <button
                  className={`training-v2-facility-action-tab${facilityDialog.action === "downgrade" ? " is-active" : ""}`}
                  type="button"
                  disabled={readOnly || selectedDialogFacility.level <= 0 || facilityUpgradeBusy || facilityMaintenanceBusy}
                  onClick={() => runFacilityDialogAction("downgrade")}
                >
                  <span>Downgrade</span>
                  <strong>25% Refund</strong>
                </button>
                <button
                  className={`training-v2-facility-action-tab${facilityDialog.action === "maintenance" ? " is-active" : ""}`}
                  type="button"
                  disabled={readOnly || selectedDialogFacility.level <= 0 || selectedDialogFacility.conditionPct >= 100 || facilityUpgradeBusy || facilityMaintenanceBusy}
                  onClick={() => runFacilityDialogAction("maintenance")}
                >
                  <span>Wartung</span>
                  <strong>{selectedDialogFacility.maintenanceCost > 0 ? formatTransfermarktCurrency(selectedDialogFacility.maintenanceCost) : "voll"}</strong>
                </button>
              </section>

              {facilityDialog.action === "maintenance" ? (
                <section className="training-v2-preview-card is-maintenance training-v2-modal-preview-card">
                  <span>Wartungs-Vorschau</span>
                  <strong>{matchingMaintenancePreview?.facility?.label ?? selectedDialogFacility.name}</strong>
                  {matchingMaintenancePreview ? (
                    <>
                      <div className="training-v2-mini-grid">
                        <div>
                          <small>Zustand</small>
                          <strong>
                            {formatLocaleNumber(matchingMaintenancePreview.conditionPct, 0)}% →{" "}
                            {formatLocaleNumber(matchingMaintenancePreview.nextConditionPct, 0)}%
                          </strong>
                        </div>
                        <div>
                          <small>Effizienz</small>
                          <strong>
                            {formatLocaleNumber(matchingMaintenancePreview.efficiencyPct, 0)}% →{" "}
                            {formatLocaleNumber(matchingMaintenancePreview.nextEfficiencyPct, 0)}%
                          </strong>
                        </div>
                        <div>
                          <small>Kosten</small>
                          <strong>{formatTransfermarktCurrency(matchingMaintenancePreview.maintenanceCost)}</strong>
                        </div>
                        <div>
                          <small>Cash danach</small>
                          <strong>{formatTransfermarktCurrency(matchingMaintenancePreview.cashAfter)}</strong>
                        </div>
                      </div>
                      {matchingMaintenancePreview.blockingReasons.length > 0 ? (
                        <p className="text-negative">
                          Noch offen: {matchingMaintenancePreview.blockingReasons.map(formatFacilityActionReason).join(" · ")}
                        </p>
                      ) : null}
                      {matchingMaintenancePreview.warnings.length > 0 ? (
                        <p className="muted">Hinweise: {matchingMaintenancePreview.warnings.map(formatFacilityActionReason).join(" · ")}</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="muted">Vorschau wird geladen oder muss neu geprueft werden.</p>
                  )}
                  {facilityMaintenanceError ? <p className="text-negative">{facilityMaintenanceError}</p> : null}
                  {facilityMaintenanceSuccess ? <p className="text-positive">{facilityMaintenanceSuccess}</p> : null}
                </section>
              ) : (
                <section className="training-v2-preview-card is-upgrade training-v2-modal-preview-card">
                  <span>{facilityDialog.action === "downgrade" ? "Downgrade-Vorschau" : "Upgrade-Vorschau"}</span>
                  <strong>{matchingUpgradePreview?.facility?.label ?? selectedDialogFacility.name}</strong>
                  {matchingUpgradePreview ? (
                    <>
                      <div className="training-v2-mini-grid">
                        <div>
                          <small>Level</small>
                          <strong>
                            {matchingUpgradePreview.currentLevel} → {matchingUpgradePreview.nextLevel ?? "—"}
                          </strong>
                        </div>
                        <div>
                          <small>Cash danach</small>
                          <strong>{formatTransfermarktCurrency(matchingUpgradePreview.cashAfter)}</strong>
                        </div>
                        <div>
                          <small>{facilityDialog.action === "downgrade" ? "Erstattung" : "Kosten"}</small>
                          <strong>
                            {facilityDialog.action === "downgrade"
                              ? formatTransfermarktCurrency(matchingUpgradePreview.refundAmount ?? null)
                              : formatTransfermarktCurrency(matchingUpgradePreview.upgradeCost)}
                          </strong>
                        </div>
                        <div>
                          <small>Unterhalt</small>
                          <strong>
                            {formatTransfermarktCurrency(matchingUpgradePreview.currentUpkeep)} →{" "}
                            {formatTransfermarktCurrency(matchingUpgradePreview.newUpkeep)}
                          </strong>
                        </div>
                        <div>
                          <small>Income</small>
                          <strong>
                            {formatTransfermarktCurrency(matchingUpgradePreview.currentIncome)} →{" "}
                            {formatTransfermarktCurrency(matchingUpgradePreview.newIncome)}
                          </strong>
                        </div>
                      </div>
                      <p className="muted">
                        {matchingUpgradePreview.currentEffect} → {matchingUpgradePreview.nextEffect ?? "Max"}
                      </p>
                      {facilityDialog.action === "downgrade" ? (
                        <p className="muted">Downgrade repariert das Gebaeude direkt auf 100% und senkt kuenftige Unterhaltskosten.</p>
                      ) : null}
                      {matchingUpgradePreview.blockingReasons.length > 0 ? (
                        <p className="text-negative">
                          Noch offen: {matchingUpgradePreview.blockingReasons.map(formatFacilityActionReason).join(" · ")}
                        </p>
                      ) : null}
                      {matchingUpgradePreview.warnings.length > 0 ? (
                        <p className="muted">Hinweise: {matchingUpgradePreview.warnings.map(formatFacilityActionReason).join(" · ")}</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="muted">Vorschau wird geladen oder muss neu geprueft werden.</p>
                  )}
                  {facilityUpgradeError ? <p className="text-negative">{facilityUpgradeError}</p> : null}
                  {facilityUpgradeSuccess ? <p className="text-positive">{facilityUpgradeSuccess}</p> : null}
                </section>
              )}
            </div>

            <div className="foundation-modal-actions">
              <button className="secondary-button" type="button" onClick={() => setFacilityDialog(null)}>
                Abbrechen
              </button>
              {facilityDialog.action === "maintenance" ? (
                <button
                  className="primary-button"
                  type="button"
                  disabled={readOnly || facilityMaintenanceBusy || !matchingMaintenancePreview?.ok || !matchingMaintenancePreview.confirmToken}
                  onClick={() => onConfirmFacilityMaintenance()}
                  title={activeFacilityConfirmReason ?? "Fuehrt die Wartung aus und stellt den Zustand wieder her."}
                >
                  {activeFacilityBusy ? "Wartung laeuft..." : "Wartung bestaetigen"}
                </button>
              ) : (
                <button
                  className="primary-button"
                  type="button"
                  disabled={readOnly || facilityUpgradeBusy || !matchingUpgradePreview?.ok || !matchingUpgradePreview.confirmToken}
                  onClick={() => onConfirmFacilityUpgrade()}
                  title={activeFacilityConfirmReason ?? "Fuehrt die gepruefte Gebaeude-Aktion aus."}
                >
                  {activeFacilityBusy
                    ? facilityDialog.action === "downgrade"
                      ? "Downgrade laeuft..."
                      : "Upgrade laeuft..."
                    : facilityDialog.action === "downgrade"
                      ? "Downgrade bestaetigen"
                      : "Upgrade bestaetigen"}
                </button>
              )}
            </div>
            {activeFacilityConfirmReason ? (
              <p className="foundation-screen-action-reason training-v2-modal-action-reason">
                Warum nicht: {activeFacilityConfirmReason}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {showLegacySeasonEndXpPanel ? (
      <section className="training-v2-seasonend">
        <div className="training-v2-section-head">
          <div>
            <span className="training-v2-kicker">Season-End Entwicklung</span>
            <strong>XP einsammeln, Upgrades planen, dann gesammelt bestaetigen</strong>
          </div>
          <span className={`transfer-status-pill ${seasonEndStatus.ok ? "is-ready" : seasonEndStatus.plannedCount > 0 ? "is-warning" : "is-info"}`}>
            {seasonEndStatus.plannedCount > 0 ? `${seasonEndStatus.plannedCount} geplant` : "leer"}
          </span>
        </div>

        <div className="training-v2-seasonend-bar">
          <div className="training-v2-seasonend-totals">
            <div>
              <span>Verfuegbar</span>
              <strong>{formatLocaleNumber(seasonEndStatus.xpAvailable, 0)} XP</strong>
            </div>
            <div>
              <span>Geplant</span>
              <strong>{formatLocaleNumber(seasonEndStatus.xpPlanned, 0)} XP</strong>
            </div>
            <div>
              <span>Rest</span>
              <strong>{formatLocaleNumber(seasonEndStatus.xpRemaining, 0)} XP</strong>
            </div>
          </div>
          <div className="training-v2-seasonend-actions">
            <button
              className="secondary-button inline-button"
              type="button"
              disabled={readOnly || seasonEndStatus.plannedCount === 0 || seasonEndBusy}
              onClick={() => onClearUpgradeCart()}
            >
              Warenkorb leeren
            </button>
            <button
              className="primary-button inline-button"
              type="button"
              disabled={
                readOnly ||
                seasonEndBusy ||
                !seasonEndStatus.ok ||
                !seasonEndStatus.confirmToken
              }
              onClick={() => onConfirmSeasonEndXpSpend()}
            >
              {seasonEndBusy ? "Pruefe..." : seasonEndStatus.plannedCount > 0 ? "XP-Upgrades bestaetigen" : "Season-XP einsammeln"}
            </button>
          </div>
        </div>
        {seasonEndResetReason || seasonEndConfirmReason ? (
          <p className="foundation-screen-action-reason">
            Warum nicht: {seasonEndConfirmReason ?? seasonEndResetReason}
          </p>
        ) : null}

        {seasonEndStatus.blockingReasons.length > 0 ? (
          <p className="muted">Noch offen: {seasonEndStatus.blockingReasons.join(" · ")}</p>
        ) : null}
        {seasonEndStatus.warnings.length > 0 ? (
          <p className="muted">Hinweise: {seasonEndStatus.warnings.slice(0, 4).join(" · ")}</p>
        ) : null}
        {seasonEndError ? <p className="text-negative">{seasonEndError}</p> : null}
        {seasonEndSuccess ? <p className="text-positive">{seasonEndSuccess}</p> : null}

        <div className="training-v2-seasonend-grid">
          {seasonEndRows.map((row) => {
            const portrait = getPortraitModel({
              id: row.playerId,
              name: row.playerName,
              portraitUrl: row.portraitUrl ?? null,
              portraitPath: row.portraitPath ?? null,
            });
            return (
              <article className="training-v2-upgrade-card" id={`training-upgrade-player-${row.playerId}`} key={row.playerId}>
                <button
                  className="training-v2-upgrade-head"
                  type="button"
                  onClick={() => onOpenPlayerDetails?.({ playerId: row.playerId })}
                >
                  <div className="training-v2-upgrade-media">
                    {portrait.src ? (
                      <OptimizedMediaImage
                        src={portrait.src}
                        alt={row.playerName}
                        width={64}
                        height={64}
                        className="training-v2-upgrade-image"
                      />
                    ) : (
                      <div className="training-v2-upgrade-image training-v2-player-image-fallback">{portrait.initials}</div>
                    )}
                  </div>
                  <div className="training-v2-upgrade-copy">
                    <strong className="training-v2-clickable">{row.playerName}</strong>
                    <p>
                      {row.organicProgression
                        ? `${row.organicProgression.classBefore} → ${row.organicProgression.classAfter}`
                        : row.className ?? "ohne Klasse"}
                    </p>
                    <small>
                      {row.organicProgression
                        ? `Setpoints ${row.organicProgression.netSetpoints > 0 ? "+" : ""}${formatLocaleNumber(row.organicProgression.netSetpoints, 1)} · Training ${row.organicProgression.trainingClass}`
                        : `XP ${formatLocaleNumber(row.availableXP, 0)} · geplant ${formatLocaleNumber(row.plannedXP, 0)} · Rest ${formatLocaleNumber(row.remainingXP, 0)}`}
                    </small>
                  </div>
                  <span className={`training-v2-badge ${row.plannedCount > 0 ? "is-growth" : row.status === "planned" ? "is-stable" : "is-info"}`}>
                    {row.plannedCount > 0 ? `${row.plannedCount}x geplant` : row.status === "planned" ? "preview ok" : row.blockReason}
                  </span>
                </button>

                <div className="training-v2-upgrade-controls">
                  <label className="filter-field">
                    <span>Attribut</span>
                    <select
                      className="input"
                      value={row.selectedAttribute}
                      disabled={readOnly}
                      onChange={(event) => onSetSeasonEndAttribute(row.playerId, event.target.value as PlayerGeneratorAttributeName)}
                    >
                      {attributeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="training-v2-upgrade-buttons">
                    <button
                      className="secondary-button inline-button"
                      type="button"
                      disabled={readOnly || seasonEndBusy}
                      onClick={() => onAddSeasonEndUpgrade(row.playerId, row.selectedAttribute)}
                    >
                      +1 planen
                    </button>
                    <button
                      className="secondary-button inline-button"
                      type="button"
                      disabled={readOnly || row.plannedCount === 0 || seasonEndBusy}
                      onClick={() => onRemoveSeasonEndUpgrade(row.playerId, row.selectedAttribute)}
                    >
                      Entfernen
                    </button>
                  </div>
                </div>

                <div className="training-v2-upgrade-grid">
                  <div>
                    <span>Attribut</span>
                    <strong>
                      {row.attributeBefore ?? "—"} → {row.attributeAfter ?? "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Tier</span>
                    <strong>
                      {row.ratingTierBefore ?? "—"} → {row.ratingTierAfter ?? "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Kosten</span>
                    <strong>{row.plannedCost != null ? `${formatLocaleNumber(row.plannedCost, 0)} XP` : "—"}</strong>
                  </div>
                  <div>
                    <span>MW / Gehalt Delta</span>
                    <strong>
                      {formatSignedPercent(row.economyAudit.marketValueDeltaPct)} / {formatSignedPercent(row.economyAudit.salaryDeltaPct)}
                    </strong>
                  </div>
                </div>

                {row.organicProgression ? (
                  <div className="training-v2-upgrade-meta is-organic">
                    <span title="Positive Traits beschleunigen, negative Traits bremsen das organische Wachstum. Signature-Attribute wachsen leichter, Weak-Attribute schwerer.">
                      Bonus/Malus aktiv · Signature {row.developmentSummary?.signatureAttributes.join(" / ") || "Profil"} · Weak{" "}
                      {row.developmentSummary?.weakAttribute ?? "offen"}
                    </span>
                    <span>
                      Training +{formatLocaleNumber(row.organicProgression.trainingSetpoints, 1)} · Performance +
                      {formatLocaleNumber(row.organicProgression.performanceSetpoints, 1)}
                    </span>
                    <span>MW-Druck -{formatLocaleNumber(row.organicProgression.marketValuePressureTotal, 1)} gesamt</span>
                    <span>
                      Traits {formatSignedPercent(row.organicProgression.traitModifierPct)} · Facility{" "}
                      {formatSignedPercent(row.organicProgression.facilityModifierPct)}
                    </span>
                    <span>Fatigue +{formatLocaleNumber(row.organicProgression.fatigueLoad, 1)}</span>
                    <span>
                      Staerkt{" "}
                      {row.organicProgression.topGains.length > 0
                        ? row.organicProgression.topGains.map((entry) => `${entry.attribute} +${formatLocaleNumber(entry.delta, 1)}`).join(", ")
                        : "keine klare Achse"}
                    </span>
                    <span>
                      Risiko{" "}
                      {row.organicProgression.topLosses.length > 0
                        ? row.organicProgression.topLosses.map((entry) => `${entry.attribute} ${formatLocaleNumber(entry.delta, 1)}`).join(", ")
                        : "keine starken Verluste"}
                    </span>
                  </div>
                ) : null}

                {row.developmentSummary ? (
                  <div className="training-v2-upgrade-meta">
                    <span>
                      Lv {row.developmentSummary.level} · {row.developmentSummary.progressPct}% · {row.developmentSummary.trainingPointsAvailable} TP
                    </span>
                    <span>Cap {row.developmentSummary.seasonLevelUpCap} / Saison</span>
                    <span>Staerke {row.developmentSummary.signatureAttributes.join(" / ")}</span>
                    <span>Weak {row.developmentSummary.weakAttribute}</span>
                    <span>Trend {row.developmentSummary.lastTrend}</span>
                  </div>
                ) : null}

                <div className="training-v2-upgrade-meta">
                  <span>
                    XP vor Facility {formatLocaleNumber(row.facilityEffects.xpBeforeFacility, 0)} · Modifier {formatSignedPercent(row.facilityEffects.facilityModifierPct)}
                  </span>
                  <span>
                    Kosten vor Facility {row.facilityEffects.costBeforeFacility ?? "—"} · Discount {formatSignedPercent(-row.facilityEffects.facilityDiscountPct)}
                  </span>
                  <span>
                    Deltas{" "}
                    {row.topDeltas.length > 0
                      ? row.topDeltas
                          .map((entry) => `${entry.label} ${(entry.disciplineDelta ?? 0) > 0 ? "+" : ""}${formatLocaleNumber(entry.disciplineDelta, 0)}`)
                          .join(", ")
                      : "keine"}
                  </span>
                  <span>
                    Effekte {row.facilityEffects.appliedEffects.length > 0 ? row.facilityEffects.appliedEffects.join(", ") : "keine"}
                  </span>
                </div>

                {(row.economyAudit.marketValueWarnings.length > 0 || row.economyAudit.salaryWarnings.length > 0) ? (
                  <p className="muted">
                    Hinweise: {[...row.economyAudit.marketValueWarnings, ...row.economyAudit.salaryWarnings].slice(0, 4).join(" · ")}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
      ) : null}
    </section>
  );
}
