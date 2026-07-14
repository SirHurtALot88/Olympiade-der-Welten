import { useMemo } from "react";

import type { ContractShape } from "@/lib/data/olyDataTypes";
import type { TransfermarktBuyPreview } from "@/lib/market/transfermarkt-buy-service";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";

export type MarketBuyNegotiationOutcome = {
  status: "accepted" | "countered" | "rejected";
  title: string;
  message: string;
  tone: "success" | "warning" | "error";
  counterSalary?: number | null;
};

export type MarketBuyWishlistEntry = {
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  bracket?: number | null;
  marketValue?: number | null;
  salary?: number | null;
};

function formatContractShapeLabel(value: ContractShape | null | undefined) {
  if (value === "front_loaded") return "vorne schwer";
  if (value === "back_loaded") return "hinten schwer";
  if (value === "balanced") return "ausgeglichen";
  return "offen";
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

export interface UseMarketBuyDerivationsInput {
  buyPreview: TransfermarktBuyPreview | null;
  contractLength: number | null;
  contractShape: ContractShape | null;
  offeredSalary: number | null;
  salaryEditedManually: boolean;
  selectedPlayer: TransfermarktFreeAgentItem | null;
  buyModalWishlistEntry: MarketBuyWishlistEntry | null;
  source: "sqlite" | "prisma";
  selectedTeamCanManage: boolean;
  selectedTeamReadOnlyReason: string | null;
  selectedTeamId: string;
  previewBusy: boolean;
  buyBusy: boolean;
  buyNegotiationOutcome: MarketBuyNegotiationOutcome | null;
}

/**
 * Market buy drilldown derivations (Strangler Phase 5.3). Runs only while
 * `FoundationMarketBuyShellHost` is mounted (`offerPanelActive` / `buyModalOpen`).
 */
export function useMarketBuyDerivations(input: UseMarketBuyDerivationsInput) {
  const {
    buyPreview,
    contractLength,
    contractShape,
    offeredSalary,
    salaryEditedManually,
    selectedPlayer,
    buyModalWishlistEntry,
    source,
    selectedTeamCanManage,
    selectedTeamReadOnlyReason,
    selectedTeamId,
    previewBusy,
    buyBusy,
    buyNegotiationOutcome,
  } = input;

  const contractPreference = buyPreview?.contractPreference ?? null;
  const activeContractLength = contractLength ?? buyPreview?.contractLength ?? contractPreference?.idealLength ?? 1;
  const activeContractShape = contractShape ?? buyPreview?.contractShape ?? contractPreference?.shapePreference ?? "balanced";
  const contractSalaryAdjustmentPct = contractPreference?.salaryAdjustmentPct ?? null;
  const contractScoreAdjustment = contractPreference?.scoreAdjustment ?? null;
  const contractLengthOutsidePreference = contractPreference
    ? activeContractLength < contractPreference.preferredMinLength || activeContractLength > contractPreference.preferredMaxLength
    : false;
  const contractShapeMismatch = contractPreference ? activeContractShape !== contractPreference.shapePreference : false;
  const marketAndFitDelta =
    buyPreview?.expectedSalary != null && buyPreview.baseExpectedSalary != null
      ? buyPreview.expectedSalary - buyPreview.baseExpectedSalary
      : null;
  const fitSalaryDiscountActive =
    (buyPreview?.teamFit ?? selectedPlayer?.fit ?? null) != null
      ? Number(buyPreview?.teamFit ?? selectedPlayer?.fit) >= 25
      : false;

  const modalPlayerName = buyPreview?.player?.name ?? selectedPlayer?.name ?? buyModalWishlistEntry?.playerName ?? "Unbekannt";
  const modalPlayerClass = buyPreview?.player?.className ?? selectedPlayer?.className ?? buyModalWishlistEntry?.className ?? "—";
  const modalPlayerRace = buyPreview?.player?.race ?? selectedPlayer?.race ?? buyModalWishlistEntry?.race ?? "—";
  const modalPlayerBracket = buyPreview?.bracket ?? selectedPlayer?.bracket ?? buyModalWishlistEntry?.bracket ?? null;
  const modalPlayerMarketValue = buyPreview?.currentValue ?? selectedPlayer?.marketValue ?? buyModalWishlistEntry?.marketValue ?? null;
  const modalPlayerSalary = buyPreview?.salary ?? selectedPlayer?.salary ?? buyModalWishlistEntry?.salary ?? null;
  const modalOfferValue = salaryEditedManually ? offeredSalary : (buyPreview?.offeredSalary ?? selectedPlayer?.salary ?? null);

  const compactNegotiationFeedback = useMemo(() => {
    const likes: string[] = [];
    const concerns: string[] = [];

    if (contractPreference) {
      if (contractLengthOutsidePreference) {
        concerns.push(
          activeContractLength < contractPreference.preferredMinLength
            ? `Laufzeit zu kurz für den Wunsch (${contractPreference.preferredMinLength}-${contractPreference.preferredMaxLength} Saisons okay)`
            : `Laufzeit zu lang für den Wunsch (${contractPreference.preferredMinLength}-${contractPreference.preferredMaxLength} Saisons okay)`,
        );
      } else {
        likes.push(`Laufzeit passt in sein Wunschfenster (${contractPreference.preferredMinLength}-${contractPreference.preferredMaxLength})`);
      }

      if (contractShapeMismatch) {
        concerns.push(
          `Vertragsform mag er weniger (${formatContractShapeLabel(activeContractShape)} statt ${formatContractShapeLabel(contractPreference.shapePreference)})`,
        );
      } else {
        likes.push(`Vertragsform passt (${formatContractShapeLabel(activeContractShape)})`);
      }
    }

    if (buyPreview?.expectedSalary != null && modalOfferValue != null) {
      const salaryDelta = Number((modalOfferValue - buyPreview.expectedSalary).toFixed(1));
      if (salaryDelta >= 0) {
        likes.push(
          salaryDelta === 0
            ? "Gehalt trifft genau seine aktuelle Forderung"
            : `Gehalt liegt ${formatTransfermarktCurrency(salaryDelta)} über seiner Forderung`,
        );
      } else {
        concerns.push(`Gehalt liegt ${formatTransfermarktCurrency(Math.abs(salaryDelta))} unter seiner Forderung`);
      }
    }

    const breakdown = buyPreview?.negotiationScoreBreakdown ?? [];
    for (const entry of breakdown) {
      if (entry.tone === "positive" && likes.length < 3) {
        likes.push(`${entry.label}: ${entry.reason}`);
      }
      if (entry.tone === "negative" && concerns.length < 3) {
        concerns.push(`${entry.label}: ${entry.reason}`);
      }
      if (likes.length >= 3 && concerns.length >= 3) {
        break;
      }
    }

    return {
      likes: likes.slice(0, 3),
      concerns: concerns.slice(0, 3),
    };
  }, [
    activeContractLength,
    activeContractShape,
    buyPreview?.expectedSalary,
    buyPreview?.negotiationScoreBreakdown,
    contractLengthOutsidePreference,
    contractPreference,
    contractShapeMismatch,
    modalOfferValue,
  ]);

  const visibleBuyWarnings = useMemo(
    () => filterVisibleNegotiationWarnings(buyPreview?.warnings),
    [buyPreview?.warnings],
  );

  const priorBadExperienceDemandEntry = useMemo(
    () => buyPreview?.demandBreakdown?.find((entry) => entry.key === "prior_bad_experience") ?? null,
    [buyPreview?.demandBreakdown],
  );
  const priorBadExperienceScoreEntry = useMemo(
    () => buyPreview?.negotiationScoreBreakdown?.find((entry) => entry.key === "bad_experience") ?? null,
    [buyPreview?.negotiationScoreBreakdown],
  );
  const priorBadExperienceActive = Boolean(
    buyPreview?.warnings?.includes("previous_rejected_offer_reduces_trust") ||
      priorBadExperienceDemandEntry ||
      priorBadExperienceScoreEntry,
  );

  const finalBuyDisabledReason =
    source !== "sqlite"
      ? "Im Referenzmodus ist nur Vorschau möglich."
      : !selectedTeamCanManage
        ? (selectedTeamReadOnlyReason ?? "Dieses Team ist hier nur Ansicht.")
        : previewBusy
          ? "Die Deal-Vorschau rechnet gerade noch."
          : buyBusy
            ? "Der Kauf wird gerade verarbeitet."
            : !selectedPlayer || !selectedTeamId
              ? "Bitte erst Team und Kandidat wählen."
              : !buyPreview?.canBuy
                ? buyPreview?.blockingReasons?.map(formatNegotiationSignalLabel).join(" · ") || "Der Deal ist noch nicht bereit."
                : buyNegotiationOutcome?.status !== "accepted"
                  ? "Erst verhandeln, dann final bestätigen."
                  : null;

  return {
    contractPreference,
    activeContractLength,
    activeContractShape,
    contractSalaryAdjustmentPct,
    contractScoreAdjustment,
    marketAndFitDelta,
    fitSalaryDiscountActive,
    modalPlayerName,
    modalPlayerClass,
    modalPlayerRace,
    modalPlayerBracket,
    modalPlayerMarketValue,
    modalPlayerSalary,
    modalOfferValue,
    compactNegotiationFeedback,
    priorBadExperienceDemandEntry,
    priorBadExperienceScoreEntry,
    priorBadExperienceActive,
    finalBuyDisabledReason,
    formatNegotiationSignalLabel,
    visibleBuyWarnings,
  };
}
