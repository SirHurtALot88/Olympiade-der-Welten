"use client";

import { useEffect, useMemo, useState } from "react";

import { TooltipHeading } from "@/components/ui/TooltipHeading";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";
import type { FacilityId } from "@/lib/facilities/facility-catalog";

import FacilityGridCard from "@/app/foundation/facilities-v2/FacilityGridCard";
import type { FacilitiesV2ClientProps, FacilityDialogState } from "@/app/foundation/facilities-v2/facilities-v2-types";
import {
  FacilityDecisionModal,
  formatFacilityActionReason,
  formatLocaleNumber,
} from "@/app/foundation/facilities-v2/facility-ui-shared";

export default function FacilitiesV2Client({
  source,
  managementLocked = false,
  managementLockedReason = null,
  selectedTeam,
  selectedTeamControlMode,
  seasonLabel,
  onOpenTraining,
  onOpenTeams,
  facilityPanelTarget = null,
  onOpenFacilityPanel,
  onCloseFacilityPanel,
  summary,
  trainingFacilityEffectPreview = null,
  facilityRows,
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
  onRunFacilityUpgradePreview,
  onConfirmFacilityUpgrade,
  onRunFacilityMaintenancePreview,
  onConfirmFacilityMaintenance,
}: FacilitiesV2ClientProps) {
  const readOnly = source === "prisma" || managementLocked;
  const [selectedFacilityId, setSelectedFacilityId] = useState<FacilityId | null>(() => facilityRows[0]?.id ?? null);
  const [facilityDialog, setFacilityDialog] = useState<FacilityDialogState>(null);

  const selectedFacility = useMemo(
    () => facilityRows.find((facility) => facility.id === selectedFacilityId) ?? facilityRows[0] ?? null,
    [facilityRows, selectedFacilityId],
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

  const facilityUpgradeConfirmReason = readOnly
    ? "Nur eigene Teams."
    : facilityUpgradeBusy
      ? "Upgrade läuft."
      : !facilityUpgradePreview?.ok
        ? facilityUpgradePreview?.blockingReasons[0]
          ? formatFacilityActionReason(facilityUpgradePreview.blockingReasons[0])
          : "Upgrade-Preview fehlt."
        : !facilityUpgradePreview?.confirmToken
          ? "Preview neu laden."
          : null;

  const facilityMaintenanceConfirmReason = readOnly
    ? "Nur eigene Teams."
    : facilityMaintenanceBusy
      ? "Wartung läuft."
      : !facilityMaintenancePreview?.ok
        ? facilityMaintenancePreview?.blockingReasons[0]
          ? formatFacilityActionReason(facilityMaintenancePreview.blockingReasons[0])
          : "Wartungs-Preview fehlt."
        : !facilityMaintenancePreview?.confirmToken
          ? "Preview neu laden."
          : null;

  const facilityLaneActionReason = readOnly
    ? "Nur eigene Teams."
    : facilityUpgradeBusy || facilityMaintenanceBusy
      ? "Aktion läuft."
      : null;

  function openFacilityDialog(facilityId: FacilityId, action: "upgrade" | "downgrade" | "maintenance") {
    if (onOpenFacilityPanel) {
      onOpenFacilityPanel(facilityId, action);
      return;
    }
    setSelectedFacilityId(facilityId);
    setFacilityDialog({ facilityId, action });
    if (action === "maintenance") {
      onRunFacilityMaintenancePreview(facilityId);
      return;
    }
    onRunFacilityUpgradePreview(facilityId, action);
  }

  useEffect(() => {
    if (!facilityPanelTarget) {
      setFacilityDialog(null);
      return;
    }

    setSelectedFacilityId(facilityPanelTarget.facilityId);
    setFacilityDialog({
      facilityId: facilityPanelTarget.facilityId,
      action: facilityPanelTarget.action,
    });
    if (facilityPanelTarget.action === "maintenance") {
      onRunFacilityMaintenancePreview(facilityPanelTarget.facilityId);
      return;
    }
    onRunFacilityUpgradePreview(facilityPanelTarget.facilityId, facilityPanelTarget.action);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preview handlers are stable enough for panel transitions
  }, [facilityPanelTarget?.facilityId, facilityPanelTarget?.action]);

  function closeFacilityDialog() {
    if (onCloseFacilityPanel) {
      onCloseFacilityPanel();
      return;
    }
    setFacilityDialog(null);
  }

  function runFacilityDialogAction(action: "upgrade" | "downgrade" | "maintenance") {
    if (!facilityDialog) return;
    setFacilityDialog({ facilityId: facilityDialog.facilityId, action });
    if (action === "maintenance") {
      onRunFacilityMaintenancePreview(facilityDialog.facilityId);
      return;
    }
    onRunFacilityUpgradePreview(facilityDialog.facilityId, action);
  }

  const activeFacility = selectedFacility;

  return (
    <section
      className={`facilities-v2-shell${facilityDialog ? " is-facility-mode" : ""}`}
      data-testid="foundation-facilities-v2"
      id="foundation-facilities-v2"
    >
      <header className="facilities-v2-header">
        <div className="facilities-v2-header-main">
          <TooltipHeading as="h2" tooltip="Upgrade, Wartung und Unterhalt pro Gebaeude.">
            Gebäude
          </TooltipHeading>
          <p>
            {selectedTeam.shortCode} · {selectedTeamControlMode ?? "manual"} · {seasonLabel}
          </p>
        </div>
        <div className="facilities-v2-header-actions" />
      </header>

      {managementLockedReason ? <p className="text-negative">{managementLockedReason}</p> : null}

      <div className="facilities-v2-kpi-row">
        <article className="facilities-v2-kpi">
          <span>Cash</span>
          <strong>{formatTransfermarktCurrency(summary.cashCurrent)}</strong>
        </article>
        <article className="facilities-v2-kpi">
          <span>Netto</span>
          <strong className={summary.netFacilityResult >= 0 ? "text-positive" : "text-negative"}>
            {formatTransfermarktCurrency(summary.netFacilityResult)}
          </strong>
        </article>
        <article className="facilities-v2-kpi">
          <span>Recovery</span>
          <strong>{formatLocaleNumber(summary.recoveryAfterTraining, 1)}</strong>
        </article>
      </div>

      {trainingFacilityEffectPreview ? (
        <div className="facilities-v2-kpi-row" aria-label="Trainings-Preview durch Gebaeude">
          <article className="facilities-v2-kpi">
            <span>Trainingseffekt</span>
            <strong>{formatLocaleNumber(trainingFacilityEffectPreview.trainingXp.after, 1)}</strong>
            <small>
              {trainingFacilityEffectPreview.trainingXp.modifierPct > 0
                ? `+${formatLocaleNumber(trainingFacilityEffectPreview.trainingXp.modifierPct, 1)}% · `
                : ""}
              Recovery {formatLocaleNumber(trainingFacilityEffectPreview.recoveryAfterTraining, 1)}
            </small>
          </article>
          <article className="facilities-v2-kpi">
            <span>Scouting</span>
            <strong>{trainingFacilityEffectPreview.scouting.label}</strong>
            <small>Level {trainingFacilityEffectPreview.scouting.level}</small>
          </article>
          <article className="facilities-v2-kpi">
            <span>Analytics</span>
            <strong>{trainingFacilityEffectPreview.analytics.label}</strong>
            <small>Level {trainingFacilityEffectPreview.analytics.level}</small>
          </article>
        </div>
      ) : null}

      <div className="facilities-v2-grid" data-testid="facilities-v2-grid">
        {facilityRows.map((facility) => (
          <FacilityGridCard
            key={facility.id}
            facility={facility}
            selected={facility.id === (selectedFacilityId ?? facilityRows[0]?.id)}
            onSelect={() => setSelectedFacilityId(facility.id)}
          />
        ))}
      </div>

      {activeFacility ? (
        <footer className="facilities-v2-action-bar" data-testid="facilities-v2-action-bar">
          <strong>{activeFacility.name}</strong>
          <div className="facilities-v2-action-buttons">
            <button
              type="button"
              className="secondary-button inline-button"
              data-testid="facilities-upgrade-button"
              disabled={readOnly || facilityUpgradeBusy || facilityMaintenanceBusy}
              title={facilityLaneActionReason ?? undefined}
              onClick={() => openFacilityDialog(activeFacility.id, "upgrade")}
            >
              Upgrade
            </button>
            <button
              type="button"
              className="secondary-button inline-button"
              disabled={readOnly || facilityUpgradeBusy || facilityMaintenanceBusy || activeFacility.level <= 0}
              title={facilityLaneActionReason ?? undefined}
              onClick={() => openFacilityDialog(activeFacility.id, "downgrade")}
            >
              Downgrade
            </button>
            <button
              type="button"
              className="secondary-button inline-button"
              disabled={
                readOnly ||
                facilityUpgradeBusy ||
                facilityMaintenanceBusy ||
                activeFacility.level <= 0 ||
                activeFacility.conditionPct >= 100
              }
              title={facilityLaneActionReason ?? undefined}
              onClick={() => openFacilityDialog(activeFacility.id, "maintenance")}
            >
              Wartung
            </button>
          </div>
        </footer>
      ) : null}

      {facilityDialog && selectedDialogFacility ? (
        <FacilityDecisionModal
          readOnly={readOnly}
          selectedTeam={selectedTeam}
          facilityDialog={facilityDialog}
          selectedFacility={selectedDialogFacility}
          specialistWingVariant={specialistWingVariant}
          specialistWingOptions={specialistWingOptions}
          onSetSpecialistWingVariant={onSetSpecialistWingVariant}
          matchingUpgradePreview={matchingUpgradePreview}
          matchingMaintenancePreview={matchingMaintenancePreview}
          facilityUpgradeBusy={facilityUpgradeBusy}
          facilityMaintenanceBusy={facilityMaintenanceBusy}
          facilityUpgradeError={facilityUpgradeError}
          facilityUpgradeSuccess={facilityUpgradeSuccess}
          facilityMaintenanceError={facilityMaintenanceError}
          facilityMaintenanceSuccess={facilityMaintenanceSuccess}
          facilityUpgradeConfirmReason={facilityUpgradeConfirmReason}
          facilityMaintenanceConfirmReason={facilityMaintenanceConfirmReason}
          onClose={closeFacilityDialog}
          onRunAction={runFacilityDialogAction}
          onConfirmUpgrade={onConfirmFacilityUpgrade}
          onConfirmMaintenance={onConfirmFacilityMaintenance}
        />
      ) : null}
    </section>
  );
}
