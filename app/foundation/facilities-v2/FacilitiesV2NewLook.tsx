"use client";

import { useEffect, useMemo, useState } from "react";

import {
  NlBarChart,
  NlCard,
  NlDeltaChip,
  NlProgressBar,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlNumber,
} from "@/components/foundation/new-look";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";
import { getFacilityLevelDefinition, type FacilityId } from "@/lib/facilities/facility-catalog";
import {
  FACILITY_CONDITION_WARNING,
  FACILITY_SEASON_DECAY_PAID,
  FACILITY_SEASON_DECAY_UNPAID,
} from "@/lib/facilities/facility-condition";

import type { FacilitiesV2ClientProps, FacilityDialogState, FacilityRowView } from "@/app/foundation/facilities-v2/facilities-v2-types";
import { FacilityDecisionModal, formatFacilityActionReason } from "@/app/foundation/facilities-v2/facility-ui-shared";

/**
 * "Neuer Look" Gebäude — flag-gated, additiv (nur wenn `useNewLook` aktiv ist).
 *
 * Konsumiert exakt dieselben Props wie `FacilitiesV2Client` und läuft über
 * dieselben echten Flows: `onRunFacilityUpgradePreview` / `onConfirmFacilityUpgrade`
 * / `onRunFacilityMaintenancePreview` / `onConfirmFacilityMaintenance` inkl.
 * Confirm-Token via `FacilityDecisionModal` (unverändert wiederverwendet).
 */

const FACILITY_MAX_LEVEL = 5;

/**
 * Anzeige-Schwellen für den Beliebtheits-Chip (nur Präsentation, kein Balance).
 * Beliebtheit liegt real in [0.5, 1.5] mit 1.0 = Liga-Durchschnitt.
 */
const BELIEBTHEIT_HIGH_THRESHOLD = 1.15;
const BELIEBTHEIT_LOW_THRESHOLD = 0.85;

const TIP_BELIEBTHEIT =
  "Die Beliebtheit (1.0 = Liga-Durchschnitt) treibt die Arena-Einnahme: Effektiv = Basis × Beliebtheit. Sie steigt mit sportlichem Erfolg (Tabellenplatz), dem Anteil an Fan-Favoriten im Kader und der Stärke der Top-Spieler. Ein beliebtes Team verdient an der Arena mehr, ein schwaches weniger. Der Fan-Shop bleibt davon unberührt.";

/**
 * Erklärtexte (E5): Konzepte in einfachem Deutsch, Schwellen kommen aus den
 * echten Konstanten in `lib/facilities/facility-condition.ts` — keine
 * erfundenen Zahlen.
 */
const TIP_ZUSTAND = `Zustand zeigt, wie fit ein Gebäude ist (100% = neuwertig). Jede Saison nutzt es sich ab. Ab ${FACILITY_CONDITION_WARNING}% Zustand arbeitet es mit voller Effizienz — darunter sinkt die Effizienz proportional, bei 0% fällt das Gebäude komplett aus.`;
const TIP_UNTERHALT = `Unterhalt sind die laufenden Kosten pro Saison, um ein Gebäude in Betrieb zu halten. Wird der Unterhalt nicht gezahlt, verschleißt das Gebäude deutlich schneller (−${FACILITY_SEASON_DECAY_UNPAID} statt −${FACILITY_SEASON_DECAY_PAID} Zustandspunkte pro Saison).`;
const TIP_WARTUNG = `Wartung stellt den Zustand eines Gebäudes wieder auf 100% her. Je schlechter der Zustand, desto teurer die Wartung. Fällt der Zustand unter ${FACILITY_CONDITION_WARNING}%, sinkt die Effizienz — Effekte und Einnahmen wirken dann nur noch anteilig.`;
const TIP_AUSBAU = "Ausbau-Kosten fallen einmalig beim Upgrade auf die jeweilige Stufe an. Grün = bereits erreichte Stufen, hervorgehoben = nächste Stufe.";
const TIP_EFFIZIENZ = `Wie stark das Gebäude aktuell wirkt. 100%, solange der Zustand mindestens ${FACILITY_CONDITION_WARNING}% beträgt — darunter sinkt die Effizienz proportional mit dem Zustand.`;

/**
 * Kleiner Tooltip-Trigger (E5): echter Button (fokussierbar, aria-label trägt
 * die volle Erklärung), Bubble rein per CSS (`data-tip`), respektiert
 * `prefers-reduced-motion` (siehe globals.css).
 */
function InfoTip({ label, tip, up = false }: { label: string; tip: string; up?: boolean }) {
  return (
    <button
      type="button"
      className={`nl-facility-infotip${up ? " is-up" : ""}`}
      aria-label={`${label} ${tip}`}
      data-tip={tip}
    >
      <span aria-hidden="true">i</span>
    </button>
  );
}

/**
 * Stilisiertes Gebäude-Motiv pro Facility-Typ (Inline-SVG-Silhouette).
 * // TODO: replace with dark-fantasy artwork asset — die SVG-Motive sind
 * bewusst nur Platzhalter in der richtigen Silhouette, bis die echten
 * Dark-Fantasy-Artworks als Assets vorliegen (Mapping bleibt per FacilityId).
 */
function FacilityMotif({ facilityId }: { facilityId: FacilityId }) {
  const shared = {
    viewBox: "0 0 64 40",
    className: "nl-facility-motif-svg",
    "aria-hidden": true as const,
    focusable: false as const,
  };

  switch (facilityId) {
    case "training_center":
      // Trainingshalle mit Hantel
      return (
        <svg {...shared}>
          <path d="M6 38V20l26-12 26 12v18H6Z" fill="currentColor" opacity="0.28" />
          <path d="M14 38V24h36v14H14Z" fill="currentColor" opacity="0.4" />
          <rect x="22" y="28" width="20" height="3" rx="1.5" fill="currentColor" />
          <rect x="18" y="25" width="4" height="9" rx="1" fill="currentColor" />
          <rect x="42" y="25" width="4" height="9" rx="1" fill="currentColor" />
        </svg>
      );
    case "recovery_center":
      // Medizinischer Flügel mit Kreuz
      return (
        <svg {...shared}>
          <path d="M8 38V18h20v20H8Z" fill="currentColor" opacity="0.3" />
          <path d="M28 38V12h28v26H28Z" fill="currentColor" opacity="0.42" />
          <path d="M40 18v14M33 25h14" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    case "scouting_office":
      // Späher-Turm mit Auge
      return (
        <svg {...shared}>
          <path d="M26 38V10l6-6 6 6v28H26Z" fill="currentColor" opacity="0.42" />
          <path d="M14 38V26h12v12H14Zm24 0V26h12v12H38Z" fill="currentColor" opacity="0.28" />
          <ellipse cx="32" cy="16" rx="5" ry="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="32" cy="16" r="1.4" fill="currentColor" />
        </svg>
      );
    case "analytics_room":
      // Analytik-Gebäude mit Chart-Fenstern
      return (
        <svg {...shared}>
          <path d="M10 38V14h44v24H10Z" fill="currentColor" opacity="0.34" />
          <rect x="17" y="27" width="5" height="7" fill="currentColor" />
          <rect x="26" y="23" width="5" height="11" fill="currentColor" />
          <rect x="35" y="19" width="5" height="15" fill="currentColor" />
          <path d="M18 20l9-5 8 3 10-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "fan_shop":
      // Fan-Shop mit Markise und Wimpel
      return (
        <svg {...shared}>
          <path d="M12 38V18h40v20H12Z" fill="currentColor" opacity="0.32" />
          <path d="M10 18h44l-4-8H14l-4 8Z" fill="currentColor" opacity="0.55" />
          <path d="M12 18v4a4 4 0 0 0 8 0v-4m0 0v4a4 4 0 0 0 8 0v-4m0 0v4a4 4 0 0 0 8 0v-4m0 0v4a4 4 0 0 0 8 0v-4" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M40 26h8v8h-8v-8Zm-22 2 5 3-5 3v-6Z" fill="currentColor" />
        </svg>
      );
    case "arena_upgrade":
      // Stadion-Bogen mit Flutlicht
      return (
        <svg {...shared}>
          <path d="M6 38c0-12 12-20 26-20s26 8 26 20H6Z" fill="currentColor" opacity="0.4" />
          <path d="M14 38c0-8 8-13 18-13s18 5 18 13" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 16V6m40 10V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <rect x="8" y="3" width="8" height="4" rx="1" fill="currentColor" />
          <rect x="48" y="3" width="8" height="4" rx="1" fill="currentColor" />
        </svg>
      );
    case "academy":
      // Akademie mit Giebel und Säulen
      return (
        <svg {...shared}>
          <path d="M8 16 32 4l24 12H8Z" fill="currentColor" opacity="0.55" />
          <path d="M12 38V18h40v20H12Z" fill="currentColor" opacity="0.3" />
          <path d="M18 20v14m9-14v14m10-14v14m9-14v14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "specialist_wing":
      // Spezialisten-Flügel mit Stern
      return (
        <svg {...shared}>
          <path d="M8 38V22l16-8v24H8Z" fill="currentColor" opacity="0.3" />
          <path d="M24 38V10l32 10v18H24Z" fill="currentColor" opacity="0.42" />
          <path d="m42 18 1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6L42 18Z" fill="currentColor" />
        </svg>
      );
    default:
      // Generische Silhouette als Fallback
      return (
        <svg {...shared}>
          <path d="M10 38V16h44v22H10Z" fill="currentColor" opacity="0.35" />
        </svg>
      );
  }
}

/** Horizontale Meilenstein-Leiter L1–L5: erreicht = voll, nächste = pulsierend, gesperrt = gedimmt. */
function FacilityMilestoneLadder({ facilityId, level }: { facilityId: FacilityId; level: number }) {
  return (
    <div className="nl-facility-ladder" aria-label={`Ausbaustufen L1 bis L${FACILITY_MAX_LEVEL}`}>
      {Array.from({ length: FACILITY_MAX_LEVEL }, (_, index) => {
        const targetLevel = index + 1;
        const definition = getFacilityLevelDefinition(facilityId, targetLevel);
        const state = targetLevel <= level ? "is-reached" : targetLevel === level + 1 ? "is-next" : "is-locked";
        return (
          <span
            key={`${facilityId}-ladder-${targetLevel}`}
            className={`nl-facility-ladder-step ${state}`}
            title={
              definition
                ? `L${targetLevel}: ${definition.effectDescription} · Kosten ${formatTransfermarktCurrency(definition.upgradeCost)}`
                : `L${targetLevel}`
            }
          >
            L{targetLevel}
          </span>
        );
      })}
    </div>
  );
}

function getWearTone(facility: FacilityRowView) {
  if (facility.conditionPct < 60 || facility.efficiencyPct < 70) return "risk" as const;
  if (facility.conditionPct < 85) return "warn" as const;
  return "good" as const;
}

/** Sinnvollste nächste Aktion: Wartung bei schlechtem Zustand, sonst Upgrade. */
function getPrimaryFacilityAction(facility: FacilityRowView): "maintenance" | "upgrade" {
  const maintenancePossible = facility.level > 0 && facility.conditionPct < 100;
  if (maintenancePossible && (facility.conditionPct < 60 || facility.efficiencyPct < 70)) {
    return "maintenance";
  }
  if (facility.upgradeCost != null) {
    return "upgrade";
  }
  return maintenancePossible ? "maintenance" : "upgrade";
}

type FacilityWearFilter = "all" | "risk" | "warn" | "good";
type FacilitySortKey = "default" | "name" | "level" | "condition" | "efficiency" | "upkeep" | "net";
type FacilitySortDirection = "asc" | "desc";

const FACILITY_LIST_COLUMNS: Array<{ key: FacilitySortKey; label: string; title?: string }> = [
  { key: "name", label: "Gebäude" },
  { key: "level", label: "Level" },
  { key: "condition", label: "Zustand", title: TIP_ZUSTAND },
  { key: "efficiency", label: "Effizienz", title: TIP_EFFIZIENZ },
  { key: "upkeep", label: "Unterhalt", title: TIP_UNTERHALT },
  { key: "net", label: "Netto", title: "Einnahmen minus Unterhalt pro Saison." },
];

/** Nur echte Felder aus `FacilityRowView`; "default" hält die Katalog-Reihenfolge. */
function facilitySortValue(facility: FacilityRowView, key: FacilitySortKey): number | string {
  switch (key) {
    case "name":
      return facility.name;
    case "level":
      return facility.level;
    case "condition":
      return facility.conditionPct;
    case "efficiency":
      return facility.efficiencyPct;
    case "upkeep":
      return facility.currentUpkeep;
    case "net":
      return facility.currentIncome - facility.currentUpkeep;
    default:
      return 0;
  }
}

function sortFacilityRows(
  rows: FacilityRowView[],
  sortKey: FacilitySortKey,
  direction: FacilitySortDirection,
): FacilityRowView[] {
  if (sortKey === "default") return rows;
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const a = facilitySortValue(left, sortKey);
    const b = facilitySortValue(right, sortKey);
    if (typeof a === "string" || typeof b === "string") {
      return sign * String(a).localeCompare(String(b), "de");
    }
    return sign * (a - b);
  });
}

export default function FacilitiesV2NewLook({
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
  beliebtheit = null,
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
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [wearFilter, setWearFilter] = useState<FacilityWearFilter>("all");
  const [sort, setSort] = useState<{ key: FacilitySortKey; direction: FacilitySortDirection }>({
    key: "default",
    direction: "desc",
  });

  const wearTallies = useMemo(() => {
    return facilityRows.reduce(
      (tallies, facility) => {
        if (facility.level <= 0) {
          tallies.unbuilt += 1;
          return tallies;
        }
        tallies[getWearTone(facility)] += 1;
        return tallies;
      },
      { good: 0, warn: 0, risk: 0, unbuilt: 0 },
    );
  }, [facilityRows]);

  /**
   * Kosten-Übersicht (E1): Portfolio-Summen für den Header. Spiegelt exakt
   * die Formeln aus `calculateFacilityUpkeep` / `calculateFacilityIncome`
   * (lib/facilities/facility-effects.ts, gleiche Katalog-Quelle), damit
   * „Einnahmen − Unterhalt" dem Netto-Chip (`summary.netFacilityResult`)
   * entspricht: Einnahmen effizienzgewichtet, Unterhalt inkl.
   * Spezialisten-Flügel-Rabatt. Reine Präsentation — keine neuen Balance-Zahlen.
   */
  const portfolioFinance = useMemo(() => {
    const specialistRow = facilityRows.find((facility) => facility.id === "specialist_wing");
    const specialistDiscountPct = specialistRow
      ? Number(
          (((getFacilityLevelDefinition("specialist_wing", specialistRow.level)?.discountPct ?? 0) *
            specialistRow.efficiencyPct) /
            100).toFixed(2),
        )
      : 0;

    let upkeepTotal = 0;
    let incomeTotal = 0;
    let builtCount = 0;
    for (const facility of facilityRows) {
      if (facility.level > 0) {
        builtCount += 1;
      }
      if (facility.currentUpkeep > 0) {
        upkeepTotal += Number((facility.currentUpkeep * (1 - specialistDiscountPct / 100)).toFixed(2));
      }
      incomeTotal += (facility.currentIncome * facility.efficiencyPct) / 100;
    }

    return {
      upkeepTotal: Number(upkeepTotal.toFixed(2)),
      incomeTotal: Number(incomeTotal.toFixed(2)),
      builtCount,
    };
  }, [facilityRows]);

  const visibleFacilityRows = useMemo(() => {
    const filtered =
      wearFilter === "all" ? facilityRows : facilityRows.filter((facility) => facility.level > 0 && getWearTone(facility) === wearFilter);
    return sortFacilityRows(filtered, sort.key, sort.direction);
  }, [facilityRows, wearFilter, sort]);

  function toggleWearFilter(tone: "good" | "warn" | "risk") {
    if (wearFilter === tone) {
      setWearFilter("all");
      setSort({ key: "default", direction: "desc" });
      return;
    }
    setWearFilter(tone);
    setSort({ key: "condition", direction: tone === "good" ? "desc" : "asc" });
  }

  function toggleColumnSort(key: FacilitySortKey) {
    setSort((current) => {
      if (current.key !== key) {
        return { key, direction: key === "name" ? "asc" : "desc" };
      }
      return { key, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  }

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
  const primaryAction = activeFacility ? getPrimaryFacilityAction(activeFacility) : "upgrade";

  return (
    <section
      className={`nl-facility${facilityDialog ? " is-facility-mode" : ""}`}
      data-testid="foundation-facilities-v2"
      id="foundation-facilities-v2"
      data-new-look="true"
    >
      <NlCard
        className="nl-facility-header-card"
        eyebrow={`${selectedTeam.shortCode} · ${selectedTeamControlMode ?? "manual"} · ${seasonLabel}`}
        title="Gebäude"
        actions={
          <div className="nl-facility-header-actions">
            {onOpenTraining ? (
              <button type="button" className="nl-facility-inline-button" onClick={onOpenTraining}>
                Training
              </button>
            ) : null}
            {onOpenTeams ? (
              <button type="button" className="nl-facility-inline-button" onClick={onOpenTeams}>
                Teams
              </button>
            ) : null}
          </div>
        }
      >
        {managementLockedReason ? <p className="nl-facility-locked">{managementLockedReason}</p> : null}
        <StatChipRow aria-label="Gebäude-Kennzahlen">
          <StatChip label="Cash" value={formatTransfermarktCurrency(summary.cashCurrent)} tone="soc" />
          <StatChip
            label="Einnahmen"
            value={`+${formatTransfermarktCurrency(portfolioFinance.incomeTotal)}`}
            tone="good"
            sub="pro Saison · effektiv"
            title={`Summe der Gebäude-Einnahmen pro Saison (nach Effizienz). ${TIP_EFFIZIENZ}`}
          />
          <StatChip
            label="Unterhalt"
            value={`−${formatTransfermarktCurrency(portfolioFinance.upkeepTotal)}`}
            tone="warn"
            sub={`${portfolioFinance.builtCount} Gebäude · pro Saison`}
            title={`${TIP_UNTERHALT} Klick: Gebäude nach Unterhalt sortieren.`}
            onClick={() => setSort({ key: "upkeep", direction: "desc" })}
          />
          <StatChip
            label="Netto"
            value={formatTransfermarktCurrency(summary.netFacilityResult)}
            tone={summary.netFacilityResult >= 0 ? "good" : "risk"}
            sub="Einnahmen − Unterhalt"
            title="Klick: Gebäude nach Netto (Einnahmen − Unterhalt) sortieren."
            onClick={() => setSort({ key: "net", direction: "desc" })}
          />
          <StatChip label="Recovery" value={formatNlNumber(summary.recoveryAfterTraining, 1)} tone="spe" />
          {beliebtheit ? (
            <StatChip
              label="Beliebtheit"
              value={`×${formatNlNumber(beliebtheit.value, 2)}`}
              tone={
                beliebtheit.value >= BELIEBTHEIT_HIGH_THRESHOLD
                  ? "good"
                  : beliebtheit.value <= BELIEBTHEIT_LOW_THRESHOLD
                    ? "warn"
                    : "accent"
              }
              sub="treibt Arena-Einnahme"
              title={TIP_BELIEBTHEIT}
            />
          ) : null}
          {trainingFacilityEffectPreview ? (
            <StatChip
              label="Trainingseffekt"
              value={formatNlNumber(trainingFacilityEffectPreview.trainingXp.after, 1)}
              sub={`${
                trainingFacilityEffectPreview.trainingXp.modifierPct > 0
                  ? `+${formatNlNumber(trainingFacilityEffectPreview.trainingXp.modifierPct, 1)}% · `
                  : ""
              }Scouting ${trainingFacilityEffectPreview.scouting.label} · Analytics ${trainingFacilityEffectPreview.analytics.label}`}
              tone="accent"
            />
          ) : null}
        </StatChipRow>
      </NlCard>

      <div className="nl-facility-toolbar">
        <div className="nl-facility-ampel" role="group" aria-label="Portfolio-Zustand">
          <span className="nl-facility-ampel-label">
            Zustand
            <InfoTip label="Was bedeutet Zustand?" tip={TIP_ZUSTAND} />
          </span>
          {(["good", "warn", "risk"] as const).map((tone) => (
            <button
              key={tone}
              type="button"
              className={`nl-facility-ampel-chip is-${tone}${wearFilter === tone ? " is-active" : ""}`}
              aria-pressed={wearFilter === tone}
              title={
                tone === "good"
                  ? "Guter Zustand — Klick: filtern & nach Zustand sortieren"
                  : tone === "warn"
                    ? "Achtung nötig — Klick: filtern & nach Zustand sortieren"
                    : "Risiko — Klick: filtern & nach Zustand sortieren"
              }
              onClick={() => toggleWearFilter(tone)}
            >
              <span className="nl-facility-ampel-dot" aria-hidden="true" />
              {tone === "good" ? "Gut" : tone === "warn" ? "Achtung" : "Risiko"}
              <strong className="nl-tnum">{wearTallies[tone]}</strong>
            </button>
          ))}
          {wearTallies.unbuilt > 0 ? (
            <span className="nl-facility-ampel-chip is-unbuilt" title="Noch nicht gebaut">
              Nicht gebaut
              <strong className="nl-tnum">{wearTallies.unbuilt}</strong>
            </span>
          ) : null}
        </div>
        <NlSubTabs
          className="nl-facility-view-tabs"
          aria-label="Ansicht"
          items={[
            { id: "cards", label: "Karten" },
            { id: "list", label: "Liste" },
          ]}
          activeId={viewMode}
          onSelect={(id) => setViewMode(id as "cards" | "list")}
        />
      </div>

      {viewMode === "cards" ? (
        <div className="nl-facility-grid" data-testid="facilities-v2-grid">
          {visibleFacilityRows.map((facility) => {
            const wearTone = getWearTone(facility);
            const isSelected = facility.id === (selectedFacilityId ?? facilityRows[0]?.id);
            return (
              <button
                key={facility.id}
                type="button"
                className={`nl-facility-card is-${wearTone}${isSelected ? " is-selected" : ""}`}
                data-testid={`facilities-v2-card-${facility.id}`}
                onClick={() => setSelectedFacilityId(facility.id)}
                title={facility.description}
              >
                <div className="nl-facility-motif" aria-hidden="true">
                  <FacilityMotif facilityId={facility.id} />
                </div>
                <div className="nl-facility-card-head">
                  <strong>{facility.name}</strong>
                  <span className="nl-facility-card-level nl-tnum">
                    {facility.level <= 0 ? "Nicht gebaut" : `Level ${facility.level}`}
                  </span>
                </div>
                <FacilityMilestoneLadder facilityId={facility.id} level={facility.level} />
                {facility.id === "arena_upgrade" && beliebtheit ? (
                  <small
                    className="nl-facility-arena-popularity"
                    title={TIP_BELIEBTHEIT}
                  >
                    Einnahme: Basis ×{formatNlNumber(beliebtheit.value, 2)} Beliebtheit
                  </small>
                ) : null}
                {facility.level > 0 ? (
                  /* E6: Zustands-Bar mit Schwellen-Marke — unterhalb von
                     FACILITY_CONDITION_WARNING% sinkt die Effizienz. */
                  <div className="nl-facility-wear-wrap">
                    <NlProgressBar
                      className="nl-facility-wear"
                      label="Zustand"
                      value={facility.conditionPct}
                      max={100}
                      format={(value) => `${formatNlNumber(value, 0)}%`}
                      title={`Zustand ${formatNlNumber(facility.conditionPct, 0)}% · Effizienz ${formatNlNumber(facility.efficiencyPct, 0)}% (${facility.conditionStatus}) · Volle Effizienz ab ${FACILITY_CONDITION_WARNING}% Zustand — die Marke zeigt die Schwelle.`}
                    />
                    <span
                      className="nl-facility-wear-threshold"
                      style={{ left: `${FACILITY_CONDITION_WARNING}%` }}
                      aria-hidden="true"
                    />
                  </div>
                ) : (
                  <small className="nl-facility-unbuilt">{facility.effect}</small>
                )}
                <div className="nl-facility-card-stats nl-tnum">
                  <span title="Effizienz">Eff. {facility.level > 0 ? `${formatNlNumber(facility.efficiencyPct, 0)}%` : "—"}</span>
                  <span title="Unterhalt pro Saison">−{formatTransfermarktCurrency(facility.currentUpkeep)}</span>
                  <span
                    title="Netto (Einnahmen − Unterhalt)"
                    className={facility.currentIncome - facility.currentUpkeep >= 0 ? "is-positive" : "is-negative"}
                  >
                    {formatTransfermarktCurrency(facility.currentIncome - facility.currentUpkeep)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="nl-facility-list-wrap" data-testid="facilities-v2-list">
          <table className="nl-facility-list-table">
            <thead>
              <tr>
                {FACILITY_LIST_COLUMNS.map((column) => (
                  <th key={column.key}>
                    <button
                      type="button"
                      className={`nl-facility-list-header-button${sort.key === column.key ? " is-active" : ""}`}
                      title={column.title}
                      onClick={() => toggleColumnSort(column.key)}
                    >
                      {column.label}
                      {sort.key === column.key ? (
                        <span aria-hidden="true">{sort.direction === "asc" ? " ▲" : " ▼"}</span>
                      ) : null}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleFacilityRows.map((facility) => {
                const wearTone = getWearTone(facility);
                const isSelected = facility.id === (selectedFacilityId ?? facilityRows[0]?.id);
                return (
                  <tr
                    key={facility.id}
                    className={`nl-facility-list-row is-${wearTone}${isSelected ? " is-selected" : ""}`}
                    data-testid={`facilities-v2-list-row-${facility.id}`}
                    onClick={() => setSelectedFacilityId(facility.id)}
                  >
                    <td>{facility.name}</td>
                    <td className="nl-tnum">{facility.level <= 0 ? "—" : `L${facility.level}`}</td>
                    <td className="nl-tnum">{facility.level > 0 ? `${formatNlNumber(facility.conditionPct, 0)}%` : "—"}</td>
                    <td className="nl-tnum">{facility.level > 0 ? `${formatNlNumber(facility.efficiencyPct, 0)}%` : "—"}</td>
                    <td className="nl-tnum">−{formatTransfermarktCurrency(facility.currentUpkeep)}</td>
                    <td className={`nl-tnum ${facility.currentIncome - facility.currentUpkeep >= 0 ? "is-positive" : "is-negative"}`}>
                      {formatTransfermarktCurrency(facility.currentIncome - facility.currentUpkeep)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeFacility ? (
        /* E4: Ausbau-Kurve (einmalige Upgrade-Kosten) und Unterhalts-Kurve
           (laufende Kosten pro Saison je Stufe) nebeneinander — beide direkt
           aus dem Facility-Katalog (`getFacilityLevelDefinition`), derselben
           Quelle wie der Upgrade-Service. */
        <NlCard
          className="nl-facility-curve-card"
          eyebrow="Kosten-Kurven"
          title={`${activeFacility.name} · L1→L${FACILITY_MAX_LEVEL}`}
        >
          <div className="nl-facility-curve-duo">
            <figure className="nl-facility-curve-col">
              <figcaption className="nl-facility-curve-col-head">
                <span>Ausbau (einmalig)</span>
                <InfoTip label="Was sind Ausbau-Kosten?" tip={TIP_AUSBAU} />
              </figcaption>
              <NlBarChart
                aria-label={`Upgrade-Kosten je Ausbaustufe für ${activeFacility.name}`}
                format={(value) => formatTransfermarktCurrency(value)}
                bars={Array.from({ length: FACILITY_MAX_LEVEL }, (_, index) => {
                  const targetLevel = index + 1;
                  const definition = getFacilityLevelDefinition(activeFacility.id, targetLevel);
                  return {
                    label: `L${targetLevel}`,
                    value: definition?.upgradeCost ?? 0,
                    tone:
                      targetLevel <= activeFacility.level
                        ? "good"
                        : targetLevel === activeFacility.level + 1
                          ? "accent"
                          : "neutral",
                  };
                })}
              />
            </figure>
            <figure className="nl-facility-curve-col">
              <figcaption className="nl-facility-curve-col-head">
                <span>Unterhalt (pro Saison)</span>
                <InfoTip label="Was ist Unterhalt?" tip={TIP_UNTERHALT} />
              </figcaption>
              <NlBarChart
                aria-label={`Unterhalt pro Saison je Ausbaustufe für ${activeFacility.name}`}
                format={(value) => formatTransfermarktCurrency(value)}
                bars={Array.from({ length: FACILITY_MAX_LEVEL }, (_, index) => {
                  const targetLevel = index + 1;
                  const definition = getFacilityLevelDefinition(activeFacility.id, targetLevel);
                  return {
                    label: `L${targetLevel}`,
                    value: definition?.seasonUpkeep ?? 0,
                    tone:
                      targetLevel <= activeFacility.level
                        ? "good"
                        : targetLevel === activeFacility.level + 1
                          ? "accent"
                          : "neutral",
                  };
                })}
              />
              <small className="nl-facility-curve-note nl-tnum">
                {activeFacility.level > 0
                  ? `Heute −${formatTransfermarktCurrency(activeFacility.currentUpkeep)}/Saison`
                  : "Heute kein Unterhalt (nicht gebaut)"}
                {activeFacility.upgradeCost != null
                  ? ` · nach Ausbau auf L${activeFacility.nextLevel} −${formatTransfermarktCurrency(activeFacility.nextUpkeep)}/Saison`
                  : " · Max-Level erreicht"}
              </small>
            </figure>
          </div>
        </NlCard>
      ) : null}

      {activeFacility ? (
        <footer className="nl-facility-action-bar" data-testid="facilities-v2-action-bar">
          <div className="nl-facility-action-copy">
            <strong>{activeFacility.name}</strong>
            <small>
              {activeFacility.level <= 0 ? "Nicht gebaut" : `Level ${activeFacility.level}`} · Zustand{" "}
              {formatNlNumber(activeFacility.conditionPct, 0)}% ·{" "}
              {activeFacility.upgradeCost != null
                ? `Upgrade ${formatTransfermarktCurrency(activeFacility.upgradeCost)}`
                : "Max-Level"}{" "}
              <InfoTip up label="Was bringen Zustand und Wartung?" tip={TIP_WARTUNG} />
            </small>
            {activeFacility.upgradeCost != null ? (
              <div className="nl-facility-action-consequence" aria-label="Konsequenz-Vorschau nach Upgrade">
                <NlDeltaChip
                  value={activeFacility.nextIncome - activeFacility.currentIncome}
                  format={(n) => `${n > 0 ? "+" : ""}${formatTransfermarktCurrency(n)} Einnahmen`}
                  title="Einnahmen-Änderung nach Upgrade auf die nächste Stufe"
                />
                <NlDeltaChip
                  value={activeFacility.nextUpkeep - activeFacility.currentUpkeep}
                  format={(n) => `${n > 0 ? "+" : ""}${formatTransfermarktCurrency(n)} Unterhalt`}
                  invert
                  title="Unterhalts-Änderung nach Upgrade auf die nächste Stufe"
                />
              </div>
            ) : null}
          </div>
          <div className="nl-facility-action-buttons">
            <button
              type="button"
              className={primaryAction === "upgrade" ? "primary-button" : "secondary-button inline-button"}
              data-testid="facilities-upgrade-button"
              disabled={readOnly || facilityUpgradeBusy || facilityMaintenanceBusy}
              title={facilityLaneActionReason ?? undefined}
              onClick={() => openFacilityDialog(activeFacility.id, "upgrade")}
            >
              Upgrade
              {activeFacility.upgradeCost != null ? ` · ${formatTransfermarktCurrency(activeFacility.upgradeCost)}` : ""}
            </button>
            <button
              type="button"
              className={primaryAction === "maintenance" ? "primary-button" : "secondary-button inline-button"}
              disabled={
                readOnly ||
                facilityUpgradeBusy ||
                facilityMaintenanceBusy ||
                activeFacility.level <= 0 ||
                activeFacility.conditionPct >= 100
              }
              title={
                facilityLaneActionReason ??
                (primaryAction === "maintenance" ? "Zustand niedrig — Wartung empfohlen." : undefined)
              }
              onClick={() => openFacilityDialog(activeFacility.id, "maintenance")}
            >
              Wartung
              {activeFacility.maintenanceCost > 0 ? ` · ${formatTransfermarktCurrency(activeFacility.maintenanceCost)}` : ""}
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
