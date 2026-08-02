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
  /**
   * Unterscheidet die zwei "countered"-Faelle aus dem Verhandlungs-Rework (Abschnitt 3): ein
   * Geld-Gegenangebot ("money", counterSalary gesetzt) laesst sich per Klick einschlagen, ein
   * Konditionen-Gegenangebot ("conditions") verlangt Laufzeit/Form anzupassen. closeBuyModal()
   * behandelt beide gleich (Abbruch-Malus bei offener "countered"-Verhandlung), nur die Anzeige
   * unterscheidet sich.
   */
  counterKind?: "money" | "conditions" | null;
  counterConditions?: { contractLength: number; contractShape: ContractShape } | null;
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

export function formatContractShapeLabel(value: ContractShape | null | undefined) {
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

export type NegotiationTooltipBundle = {
  id: "willingness" | "fit" | "money" | "history";
  title: string;
  items: string[];
};

export type NegotiationTooltip = {
  headline: string;
  bundles: NegotiationTooltipBundle[];
};

function formatWillingnessBand(willingness: number): string {
  if (willingness < 35) return "will eher nicht wechseln";
  if (willingness <= 60) return "ist offen für den Wechsel";
  return "will kommen";
}

/**
 * Baut den Tooltip aus verhandlung-rework.md Abschnitt 5: die Frage des Nutzers ("von was das
 * abhängt, also ob es an den traits vom spieler liegt oder ob er aus gründen ggf lieber oder
 * weniger gern wechseln will") wird NICHT mit einer 15er-Rohliste beantwortet, sondern mit vier
 * Bündeln in der Reihenfolge, in der ein Mensch fragt. Alle Inhalte kommen 1:1 aus
 * ContractNegotiationPreview (scoreBreakdown/demandBreakdown/contractPreference/Schwellen) — kein
 * neues Feld. Bündel ohne Inhalt fallen weg.
 */
export function buildNegotiationTooltip(buyPreview: TransfermarktBuyPreview | null): NegotiationTooltip | null {
  if (!buyPreview) {
    return null;
  }

  const scoreBreakdown = buyPreview.negotiationScoreBreakdown ?? [];
  const demandBreakdown = buyPreview.demandBreakdown ?? [];
  const findScore = (key: string) => scoreBreakdown.find((entry) => entry.key === key) ?? null;
  const findDemand = (key: string) => demandBreakdown.find((entry) => entry.key === key) ?? null;

  // Kopfzeile: Verdikt als Satz + staerkster Treiber (groesster Punktebetrag ausserhalb von
  // base_interest — der ist immer da und sagt nichts Unterscheidendes).
  const strongestDriver = [...scoreBreakdown]
    .filter((entry) => entry.key !== "base_interest")
    .sort((left, right) => Math.abs(right.points) - Math.abs(left.points))[0] ?? null;
  const offerGap =
    buyPreview.counterSalary != null && buyPreview.offeredSalary != null
      ? Math.max(0, buyPreview.counterSalary - buyPreview.offeredSalary)
      : null;

  let headline: string;
  switch (buyPreview.verdict) {
    case "accept":
      headline = strongestDriver
        ? `Er würde zusagen — ${strongestDriver.label} zieht.`
        : "Er würde zusagen.";
      break;
    case "counter_money":
      headline = offerGap != null
        ? `Er verhandelt: ihm fehlen rund ${formatTransfermarktCurrency(offerGap)}.`
        : "Er verhandelt über das Gehalt.";
      break;
    case "counter_conditions":
      headline = "Beim Gehalt ist man sich einig — er verhandelt über Laufzeit/Form.";
      break;
    case "reject_not_about_money":
      headline = "Er sagt ab — und am Geld liegt es nicht.";
      break;
    case "reject_affront":
      headline = "Er zieht sich zurück — ihr seid nach seinem Entgegenkommen zurückgerudert.";
      break;
    case "reject_lowball":
      headline = "Er lehnt ab — das Angebot ist zu weit von seiner Forderung entfernt.";
      break;
    default:
      headline = "Verhandlungsstand wird berechnet.";
  }

  const bundles: NegotiationTooltipBundle[] = [];

  // 1. Will er überhaupt wechseln? (Achse W, angebotsunabhängig)
  if (buyPreview.acceptanceScore != null) {
    const items: string[] = [];
    const scouting = findScore("scouting_network");
    const ambitionMatch = findScore("ambition_match");
    const ambitionMismatch = findScore("ambition_mismatch");
    const mood = findScore("negotiation_mood");
    if (scouting) items.push(scouting.reason);
    if (ambitionMatch) items.push(ambitionMatch.reason);
    if (ambitionMismatch) items.push(ambitionMismatch.reason);
    if (mood) items.push(mood.points >= 0 ? "Heute gut drauf." : "Heute eher schlecht drauf.");
    bundles.push({
      id: "willingness",
      title: `Will er überhaupt wechseln? Er ${formatWillingnessBand(buyPreview.acceptanceScore)}.`,
      items,
    });
  }

  // 2. Passt er zu uns? (Team & Kultur)
  {
    const items: string[] = [];
    const teamFitEntry = findScore("team_fit");
    const loyalFit = findScore("loyal_fit");
    const traitCulture = findScore("trait_culture");
    const negativeFitPressure = findDemand("negative_fit_pressure");
    const fit25Discount = findDemand("fit25_salary_discount");
    if (teamFitEntry) items.push(teamFitEntry.reason);
    if (loyalFit) items.push(loyalFit.reason);
    if (traitCulture) items.push(traitCulture.reason);
    if (negativeFitPressure) items.push(negativeFitPressure.reason);
    if (fit25Discount) items.push(fit25Discount.reason);
    if (items.length > 0) {
      bundles.push({ id: "fit", title: "Passt er zu uns?", items });
    }
  }

  // 3. Reicht das Paket? (Geld & Vertrag) — die eine Zahl, die alles sagt, ist jetzt fest
  // berechenbar, weil W angebotsunabhängig ist.
  {
    const items: string[] = [];
    if (buyPreview.acceptThresholdSalary != null) {
      items.push(`Zusage ab ${formatTransfermarktCurrency(buyPreview.acceptThresholdSalary)}.`);
    }
    if (buyPreview.rejectThresholdSalary != null && (buyPreview.offerRatio ?? 1) < 1.02) {
      items.push(`Unter ${formatTransfermarktCurrency(buyPreview.rejectThresholdSalary)} bricht er die Verhandlung ab.`);
    }
    const natureTrait = findDemand("nature_trait_demand");
    const natureSubclass = findDemand("nature_subclass_demand");
    const natureAlignment = findDemand("nature_alignment_demand");
    const mercenaryPremium = findDemand("mercenary_money_premium");
    if (natureTrait) items.push(natureTrait.reason);
    if (natureSubclass) items.push(natureSubclass.reason);
    if (natureAlignment) items.push(natureAlignment.reason);
    if (mercenaryPremium) items.push(mercenaryPremium.reason);
    if (buyPreview.contractPreference?.reasons?.[0]) {
      const conditionsPct =
        buyPreview.conditionsAdjustmentPct != null ? Math.round(buyPreview.conditionsAdjustmentPct * 100) : null;
      items.push(
        conditionsPct != null && conditionsPct !== 0
          ? `${buyPreview.contractPreference.reasons[0]} (${conditionsPct > 0 ? "+" : ""}${conditionsPct}% Gehalt)`
          : buyPreview.contractPreference.reasons[0],
      );
    }
    // mercenary_*/ego_* wirken nur noch als Schwellen-Verschiebung (kein Score-Eintrag mehr) —
    // der Hinweistext dazu steckt in negotiationReasons, hier als Lowball-Empfindlichkeit.
    if (buyPreview.negotiationReasons?.some((reason) => reason.includes("Lowball-Angebote"))) {
      items.push("Mercenary reagiert empfindlich auf Lowballs.");
    }
    if (buyPreview.negotiationReasons?.some((reason) => reason.includes("sichtbares Signal"))) {
      items.push("Diva/Egomaniac erwarten ein sichtbares Signal im Angebot.");
    }
    bundles.push({ id: "money", title: "Reicht das Paket?", items });
  }

  /**
   * 4. Ist was vorgefallen? (Geschichte) — Bündel entfällt, wenn nichts vorgefallen ist.
   *
   * Hier stehen jetzt ALLE DREI Verhandlungsgedächtnisse zusammen, und das ist der Punkt: sie
   * hängen an der Richtung des Angebots (runter = Affront, tief = Trotz, rauf = Erwiderung) und
   * erklären sich nur gemeinsam. Verteilt auf drei Ecken der Oberfläche wären sie einzeln je
   * ein Rätsel — „warum ist seine Forderung anders als eben?" ist genau die Frage, die dieses
   * Bündel beantworten muss (verhandlung-rework.md Abschnitt 9.1/9.3, 11.6).
   */
  {
    const items: string[] = [];
    if (findScore("bad_experience")) {
      items.push("Die letzte Runde mit euch ist ihm quer im Hals — das kostet gerade Wille und Forderung.");
    }
    if (buyPreview.verdict === "reject_affront") {
      items.push("Ihr seid nach seinem Entgegenkommen mit einem niedrigeren Angebot zurückgerudert.");
    }
    const defiance = buyPreview.defianceSurchargePct ?? 0;
    if (defiance > 0) {
      const von = buyPreview.baseDemandSalary;
      const bis = buyPreview.expectedSalary;
      items.push(
        von != null && bis != null
          ? `Trotz: euer Lowball hat seine Forderung von ${formatTransfermarktCurrency(von)} auf ${formatTransfermarktCurrency(bis)} gehoben (+${Math.round(defiance * 1000) / 10} %). Gilt bis zum Ende dieser Verhandlung, eine neue Season setzt es zurück.`
          : `Trotz: euer Lowball hat seine Forderung um ${Math.round(defiance * 1000) / 10} % gehoben — bis zum Ende dieser Verhandlung.`,
      );
    }
    const pending = buyPreview.pendingDefianceSurchargePct ?? 0;
    if (pending > defiance) {
      items.push(
        `Dieses Angebot würde ihn zusätzlich verärgern: verhandelst du so, steigt seine Forderung auf +${Math.round(pending * 1000) / 10} %. Tippen ist folgenlos, verhandeln nicht.`,
      );
    }
    if (buyPreview.concededFromLastCounter) {
      items.push("Er hat auf euer Entgegenkommen reagiert und seine Forderung gegenüber der letzten Runde gesenkt.");
    }
    if (items.length > 0) {
      bundles.push({ id: "history", title: "Ist was vorgefallen?", items });
    }
  }

  return { headline, bundles };
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

  const negotiationTooltip = useMemo(() => buildNegotiationTooltip(buyPreview), [buyPreview]);

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
    negotiationTooltip,
    finalBuyDisabledReason,
    formatNegotiationSignalLabel,
    visibleBuyWarnings,
  };
}
