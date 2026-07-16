"use client";

import type { PlayerGeneratorAttributeName, Team } from "@/lib/data/olyDataTypes";
import {
  SPECIALIST_WING_VARIANTS,
  getFacilityLevelDefinition,
  type FacilityId,
  type SpecialistWingVariant,
} from "@/lib/facilities/facility-catalog";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";

import type {
  FacilityDialogState,
  FacilityMaintenancePreviewView,
  FacilityRowView,
  FacilityUpgradePreviewView,
} from "@/app/foundation/facilities-v2/facilities-v2-types";

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

export function formatLocaleNumber(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatFacilityActionReason(reason: string) {
  const mapped: Record<string, string> = {
    insufficient_cash: "Nicht genug Cash.",
    facility_max_level: "Max-Level erreicht.",
    facility_disabled: "Gebäude deaktiviert.",
    specialist_wing_variant_required: "Variante wählen.",
    specialist_wing_variant_switch_not_supported: "Variante nach Bau nicht wechselbar.",
    team_not_found: "Team nicht gefunden.",
    save_not_active: "Spielstand nicht aktiv.",
    save_not_found: "Spielstand nicht gefunden.",
    local_team_not_owned_or_ai_controlled: "Nur eigene Teams.",
    confirm_token_required: "Erst prüfen, dann bestätigen.",
    facility_upgrade_preview_stale: "Preview veraltet.",
    facility_maintenance_preview_stale: "Preview veraltet.",
  };
  if (mapped[reason]) return mapped[reason];
  if (reason.startsWith("phase_blocked:facility_apply:")) {
    return "In dieser Phase noch blockiert.";
  }
  return reason.replaceAll("_", " ");
}

export function formatFacilityStatusLabel(facility: FacilityRowView) {
  if (facility.level <= 0) {
    return "L0";
  }
  if (facility.conditionPct >= 100) {
    return `L${facility.level} · 100%`;
  }
  return `L${facility.level} · ${formatLocaleNumber(facility.conditionPct, 0)}%`;
}

export function getFacilityHealthTone(facility: FacilityRowView) {
  if (facility.conditionPct < 60 || facility.efficiencyPct < 70) return "regression";
  if (facility.level <= 0) return "info";
  if (facility.upgradeCost != null) return "growth";
  return "stable";
}

function describeSpecialistWingVariant(variant: SpecialistWingVariant, level: number, efficiencyPct: number) {
  const entry = SPECIALIST_WING_VARIANTS[variant];
  const labels = entry.attributes.map((attribute) => ATTRIBUTE_SHORT_LABELS[attribute]).join(" · ");
  const discountPct = ((getFacilityLevelDefinition("specialist_wing", level)?.discountPct ?? 0) * efficiencyPct) / 100;
  return `${entry.label}: ${labels} · ${formatLocaleNumber(discountPct, 0)}% Rabatt`;
}

export function FacilityLevelStrip({ facilityId, level }: { facilityId: FacilityId; level: number }) {
  return (
    <div className="facilities-v2-level-strip" aria-label="Stufen L1 bis L5">
      {[1, 2, 3, 4, 5].map((targetLevel) => {
        const definition = getFacilityLevelDefinition(facilityId, targetLevel);
        return (
          <div
            key={`${facilityId}-l${targetLevel}`}
            className={`facilities-v2-level-step${targetLevel <= level ? " is-active" : ""}`}
            title={definition?.effectDescription ?? undefined}
          >
            <span>L{targetLevel}</span>
            <strong>{definition?.effectDescription ?? "—"}</strong>
          </div>
        );
      })}
    </div>
  );
}

type FacilityDecisionModalProps = {
  readOnly: boolean;
  selectedTeam: Team;
  facilityDialog: FacilityDialogState;
  selectedFacility: FacilityRowView;
  specialistWingVariant: SpecialistWingVariant;
  specialistWingOptions: Array<{ value: SpecialistWingVariant; label: string }>;
  onSetSpecialistWingVariant: (variant: SpecialistWingVariant) => void;
  matchingUpgradePreview: FacilityUpgradePreviewView;
  matchingMaintenancePreview: FacilityMaintenancePreviewView;
  facilityUpgradeBusy: boolean;
  facilityMaintenanceBusy: boolean;
  facilityUpgradeError: string | null;
  facilityUpgradeSuccess: string | null;
  facilityMaintenanceError: string | null;
  facilityMaintenanceSuccess: string | null;
  facilityUpgradeConfirmReason: string | null;
  facilityMaintenanceConfirmReason: string | null;
  onClose: () => void;
  onRunAction: (action: "upgrade" | "downgrade" | "maintenance") => void;
  onConfirmUpgrade: () => void;
  onConfirmMaintenance: () => void;
};

export function FacilityDecisionModal({
  readOnly,
  selectedTeam,
  facilityDialog,
  selectedFacility,
  specialistWingVariant,
  specialistWingOptions,
  onSetSpecialistWingVariant,
  matchingUpgradePreview,
  matchingMaintenancePreview,
  facilityUpgradeBusy,
  facilityMaintenanceBusy,
  facilityUpgradeError,
  facilityUpgradeSuccess,
  facilityMaintenanceError,
  facilityMaintenanceSuccess,
  facilityUpgradeConfirmReason,
  facilityMaintenanceConfirmReason,
  onClose,
  onRunAction,
  onConfirmUpgrade,
  onConfirmMaintenance,
}: FacilityDecisionModalProps) {
  if (!facilityDialog) return null;

  const activeConfirmReason =
    facilityDialog.action === "maintenance" ? facilityMaintenanceConfirmReason : facilityUpgradeConfirmReason;
  const activeBusy = facilityDialog.action === "maintenance" ? facilityMaintenanceBusy : facilityUpgradeBusy;

  return (
    <section className="foundation-drilldown-page facility-upgrade-page" data-testid="facility-upgrade-page">
      <header className="foundation-drilldown-header">
        <div>
          <span className="eyebrow">{facilityDialog.action === "maintenance" ? "Wartung" : facilityDialog.action === "downgrade" ? "Downgrade" : "Upgrade"}</span>
          <h1>{selectedFacility.name}</h1>
          <p>
            {selectedTeam.shortCode} · L{selectedFacility.level} · {formatLocaleNumber(selectedFacility.conditionPct, 0)}% ·{" "}
            {formatLocaleNumber(selectedFacility.efficiencyPct, 0)}%
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={onClose}>
          Zurück
        </button>
      </header>

      <div className="foundation-drilldown-body training-v2-facility-modal-body">
          <section className="training-v2-facility-modal-hero">
            <div>
              <span>Jetzt</span>
              <strong>{selectedFacility.currentEffect}</strong>
            </div>
            <div>
              <span>Nächstes Level</span>
              <strong>{selectedFacility.nextLevelEffect}</strong>
              <small>
                {selectedFacility.upgradeCost != null ? formatTransfermarktCurrency(selectedFacility.upgradeCost) : "Max"} · Unterhalt{" "}
                {formatTransfermarktCurrency(selectedFacility.currentUpkeep)} → {formatTransfermarktCurrency(selectedFacility.nextUpkeep)}
              </small>
            </div>
          </section>

          <FacilityLevelStrip facilityId={selectedFacility.id} level={selectedFacility.level} />

          {selectedFacility.id === "specialist_wing" && selectedFacility.level === 0 ? (
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
          {selectedFacility.id === "specialist_wing" && selectedFacility.level > 0 ? (
            <p title="Spezialisten-Rabatt">
              {describeSpecialistWingVariant(
                specialistWingVariant,
                Math.max(selectedFacility.level, 1),
                Math.max(selectedFacility.efficiencyPct, 100),
              )}
            </p>
          ) : null}

          <section className="training-v2-facility-action-tabs" aria-label="Aktion">
            <button
              className={`training-v2-facility-action-tab${facilityDialog.action === "upgrade" ? " is-active" : ""}`}
              type="button"
              disabled={readOnly || facilityUpgradeBusy || facilityMaintenanceBusy}
              onClick={() => onRunAction("upgrade")}
            >
              <span>Upgrade</span>
              <strong>{selectedFacility.upgradeCost != null ? formatTransfermarktCurrency(selectedFacility.upgradeCost) : "Max"}</strong>
            </button>
            <button
              className={`training-v2-facility-action-tab${facilityDialog.action === "downgrade" ? " is-active" : ""}`}
              type="button"
              disabled={readOnly || selectedFacility.level <= 0 || facilityUpgradeBusy || facilityMaintenanceBusy}
              onClick={() => onRunAction("downgrade")}
            >
              <span>Downgrade</span>
              <strong>25%</strong>
            </button>
            <button
              className={`training-v2-facility-action-tab${facilityDialog.action === "maintenance" ? " is-active" : ""}`}
              type="button"
              disabled={
                readOnly ||
                selectedFacility.level <= 0 ||
                selectedFacility.conditionPct >= 100 ||
                facilityUpgradeBusy ||
                facilityMaintenanceBusy
              }
              onClick={() => onRunAction("maintenance")}
            >
              <span>Wartung</span>
              <strong>
                {selectedFacility.maintenanceCost > 0 ? formatTransfermarktCurrency(selectedFacility.maintenanceCost) : "—"}
              </strong>
            </button>
          </section>

          {facilityDialog.action === "maintenance" ? (
            <section className="training-v2-preview-card is-maintenance training-v2-modal-preview-card">
              <span>Wartung</span>
              {matchingMaintenancePreview ? (
                <div className="training-v2-mini-grid">
                  <div>
                    <small>Zustand</small>
                    <strong>
                      {formatLocaleNumber(matchingMaintenancePreview.conditionPct, 0)}% →{" "}
                      {formatLocaleNumber(matchingMaintenancePreview.nextConditionPct, 0)}%
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
              ) : null}
              {matchingMaintenancePreview?.blockingReasons.length ? (
                <p className="text-negative">{matchingMaintenancePreview.blockingReasons.map(formatFacilityActionReason).join(" · ")}</p>
              ) : null}
              {facilityMaintenanceError ? <p className="text-negative">{facilityMaintenanceError}</p> : null}
              {facilityMaintenanceSuccess ? <p className="text-positive">{facilityMaintenanceSuccess}</p> : null}
            </section>
          ) : (
            <section className="training-v2-preview-card is-upgrade training-v2-modal-preview-card">
              <span>{facilityDialog.action === "downgrade" ? "Downgrade" : "Upgrade"}</span>
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
                  </div>
                  {matchingUpgradePreview.blockingReasons.length > 0 ? (
                    <p className="text-negative">{matchingUpgradePreview.blockingReasons.map(formatFacilityActionReason).join(" · ")}</p>
                  ) : null}
                </>
              ) : null}
              {facilityUpgradeError ? <p className="text-negative">{facilityUpgradeError}</p> : null}
              {facilityUpgradeSuccess ? <p className="text-positive">{facilityUpgradeSuccess}</p> : null}
            </section>
          )}
        </div>

        <div className="foundation-modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Abbrechen
          </button>
          {facilityDialog.action === "maintenance" ? (
            <button
              className="primary-button"
              type="button"
              disabled={readOnly || facilityMaintenanceBusy || !matchingMaintenancePreview?.ok || !matchingMaintenancePreview.confirmToken}
              onClick={onConfirmMaintenance}
              title={activeConfirmReason ?? undefined}
            >
              {activeBusy ? "Wartung…" : "Wartung bestätigen"}
            </button>
          ) : (
            <button
              className="primary-button"
              type="button"
              data-testid="facility-confirm-button"
              disabled={readOnly || facilityUpgradeBusy || !matchingUpgradePreview?.ok || !matchingUpgradePreview.confirmToken}
              onClick={onConfirmUpgrade}
              title={activeConfirmReason ?? undefined}
            >
              {activeBusy
                ? "…"
                : facilityDialog.action === "downgrade"
                  ? "Downgrade bestätigen"
                  : "Upgrade bestätigen"}
            </button>
          )}
        </div>
        {activeConfirmReason ? <p className="foundation-screen-action-reason training-v2-modal-action-reason">{activeConfirmReason}</p> : null}
    </section>
  );
}
