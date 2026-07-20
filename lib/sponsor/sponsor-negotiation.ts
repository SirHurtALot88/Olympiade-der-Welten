import type {
  SponsorNegotiationProfile,
  SponsorOffer,
  SponsorOfferComponent,
  SponsorRarity,
  SponsorTermSeasons,
  TeamSponsorContract,
} from "@/lib/data/olyDataTypes";

const TERM_MULTIPLIERS: Record<SponsorTermSeasons, number> = {
  1: 1.0,
  2: 1.0,
  3: 0.92,
};

/**
 * WAVE 1 — echter Downside für "Ambitioniert" (Risiko-Achse). Statt eines uniformen Skalars pro Profil
 * skaliert jede Komponentenklasse getrennt:
 *  - baseMult:    Basis-Saisonzahlung (der GARANTIERTE Sockel). safe hebt ihn, ambitious senkt ihn.
 *  - upsideMult:  Rang-/Sonder-/Verbesserungs-Belohnung (nur bei Erfolg). ambitious hebt sie, safe senkt sie.
 *  - penaltyMult: Malus bei Verfehlen. ambitious verdoppelt ihn (echtes Risiko), safe halbiert ihn.
 *  - targetShift: Rang-Zielverschiebung (safe leichter, ambitious härter).
 * Effekt: bei schlechter Platzierung (nur Basis greift) safe > balanced > ambitious; bei Titel ambitious >
 * balanced > safe. Damit hat "Ambitioniert" nicht mehr IMMER nur Vorteile.
 */
export type SponsorProfileComponentFactors = {
  baseMult: number;
  upsideMult: number;
  penaltyMult: number;
  targetShift: number;
};

export const PROFILE_COMPONENT_FACTORS: Record<SponsorNegotiationProfile, SponsorProfileComponentFactors> = {
  safe: { baseMult: 1.05, upsideMult: 0.85, penaltyMult: 0.5, targetShift: 2 },
  balanced: { baseMult: 1.0, upsideMult: 1.0, penaltyMult: 1.0, targetShift: 0 },
  ambitious: { baseMult: 0.88, upsideMult: 1.25, penaltyMult: 2.0, targetShift: -1 },
};

function roundCash(value: number) {
  return Number(value.toFixed(1));
}

export function getSponsorTermMultiplier(termSeasons: SponsorTermSeasons) {
  return TERM_MULTIPLIERS[termSeasons];
}

export function getSponsorProfileComponentFactors(profile: SponsorNegotiationProfile): SponsorProfileComponentFactors {
  return PROFILE_COMPONENT_FACTORS[profile] ?? PROFILE_COMPONENT_FACTORS.balanced;
}

/**
 * @deprecated WAVE 1: Der Cash-Effekt eines Profils ist kein einzelner Skalar mehr (base/upside/penalty
 * getrennt). Diese Funktion liefert nur noch einen REPRÄSENTATIVEN Gesamtfaktor (Mittel aus base- und
 * upside-Faktor) für Abwärtskompatibilität. Für den echten, angezeigten Cash-Faktor bei Referenzrang siehe
 * getSponsorNegotiationCashFactor (komponentenbasiert).
 */
export function getSponsorProfileMultiplier(profile: SponsorNegotiationProfile) {
  const { baseMult, upsideMult } = getSponsorProfileComponentFactors(profile);
  return roundCash((baseMult + upsideMult) / 2);
}

/** @deprecated WAVE 1: siehe getSponsorProfileMultiplier / getSponsorNegotiationCashFactor. */
export function getSponsorNegotiationMultiplier(input: {
  termSeasons: SponsorTermSeasons;
  negotiationProfile: SponsorNegotiationProfile;
}) {
  return roundCash(getSponsorTermMultiplier(input.termSeasons) * getSponsorProfileMultiplier(input.negotiationProfile));
}

/**
 * Effektiver, angezeigter Cash-Faktor bei Referenzrang: das Verhältnis der verhandlungs-adjustierten
 * Reward-Summe zur Original-Reward-Summe über die konkreten Komponenten. Das ist der EINZIGE ehrliche
 * Skalar für die UI, weil der Profil-Effekt jetzt komponentenspezifisch ist.
 */
export function getSponsorNegotiationCashFactor(input: {
  components: SponsorOfferComponent[];
  termSeasons: SponsorTermSeasons;
  negotiationProfile: SponsorNegotiationProfile;
}): number {
  const original = input.components.reduce((sum, component) => sum + component.rewardCash, 0);
  if (original <= 0) {
    return getSponsorNegotiationMultiplier({ termSeasons: input.termSeasons, negotiationProfile: input.negotiationProfile });
  }
  const adjusted = applySponsorNegotiationToComponents({
    components: input.components,
    termSeasons: input.termSeasons,
    negotiationProfile: input.negotiationProfile,
  }).reduce((sum, component) => sum + component.rewardCash, 0);
  return roundCash(adjusted / original);
}

export function applySponsorNegotiationToComponents(input: {
  components: SponsorOfferComponent[];
  termSeasons: SponsorTermSeasons;
  negotiationProfile: SponsorNegotiationProfile;
  /** Etat-Dial (Rarität). Der Profil-/Term-Effekt ist rarity-unabhängig, daher wird der Wert nur als
   *  Kontext mitgeführt (kein Branch darauf). */
  rarity?: SponsorRarity;
}): SponsorOfferComponent[] {
  const termMult = getSponsorTermMultiplier(input.termSeasons);
  const factors = getSponsorProfileComponentFactors(input.negotiationProfile);

  return input.components.map((component) => {
    const scaledPenalty = (mult: number) =>
      component.penaltyCash != null ? roundCash(component.penaltyCash * mult * termMult) : undefined;

    if (component.kind === "base") {
      // Basis = der garantierte Sockel: skaliert mit baseMult (safe hebt, ambitious senkt).
      const baseReward = roundCash(component.rewardCash * factors.baseMult * termMult);
      return {
        ...component,
        rewardCash: baseReward,
        targetValue: typeof component.targetValue === "number" ? baseReward : component.targetValue,
        penaltyCash: scaledPenalty(factors.penaltyMult),
      };
    }

    // rank / improvement / special = Upside: Reward mit upsideMult, Malus mit penaltyMult.
    const upsideReward = roundCash(component.rewardCash * factors.upsideMult * termMult);
    if (component.kind === "rank" && typeof component.targetValue === "number") {
      return {
        ...component,
        targetValue: Math.max(3, component.targetValue + factors.targetShift),
        rewardCash: upsideReward,
        penaltyCash: scaledPenalty(factors.penaltyMult),
      };
    }
    return {
      ...component,
      rewardCash: upsideReward,
      penaltyCash: scaledPenalty(factors.penaltyMult),
    };
  });
}

export function applySponsorNegotiationToOffer(
  offer: SponsorOffer,
  input: { termSeasons: SponsorTermSeasons; negotiationProfile: SponsorNegotiationProfile },
): SponsorOffer {
  const components = applySponsorNegotiationToComponents({
    components: offer.components,
    termSeasons: input.termSeasons,
    negotiationProfile: input.negotiationProfile,
    rarity: offer.rarity ?? "magisch",
  });
  return {
    ...offer,
    components,
    termSeasons: input.termSeasons,
    negotiationProfile: input.negotiationProfile,
    demandProfile: input.negotiationProfile === "safe" ? "safe" : input.negotiationProfile === "ambitious" ? "ambitious" : offer.demandProfile,
    totalUpsideEstimate: roundCash(components.reduce((sum, component) => sum + component.rewardCash, 0)),
  };
}

export function applySponsorNegotiationToContract(
  contract: TeamSponsorContract,
  input: { termSeasons: SponsorTermSeasons; negotiationProfile: SponsorNegotiationProfile },
): TeamSponsorContract {
  const components = applySponsorNegotiationToComponents({
    components: contract.components,
    termSeasons: input.termSeasons,
    negotiationProfile: input.negotiationProfile,
    rarity: contract.rarity ?? "magisch",
  });
  return {
    ...contract,
    components,
    termSeasons: input.termSeasons,
    seasonsRemaining: input.termSeasons,
    negotiationProfile: input.negotiationProfile,
    demandProfile: input.negotiationProfile === "safe" ? "safe" : input.negotiationProfile === "ambitious" ? "ambitious" : contract.demandProfile,
  };
}

export function defaultAiSponsorNegotiation(input: {
  cashPressure: number;
  ambition: number;
}): { termSeasons: SponsorTermSeasons; negotiationProfile: SponsorNegotiationProfile } {
  if (input.cashPressure >= 7) {
    return { termSeasons: 1, negotiationProfile: "safe" };
  }
  if (input.ambition >= 8) {
    return { termSeasons: 1, negotiationProfile: "ambitious" };
  }
  return { termSeasons: 1, negotiationProfile: "balanced" };
}
