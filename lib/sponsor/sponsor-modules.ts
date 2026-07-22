import type { SponsorOffer, SponsorOfferComponent, SponsorRarity } from "@/lib/data/olyDataTypes";

/**
 * P4 — Sponsor-Baukasten (Modul-Modell).
 *
 * Ein Sponsor ist ab hier explizit aus MODULEN zusammengesetzt statt aus einem fixen 4+2-Template. Die
 * Cash-tragenden Module sind exakt die bestehenden `SponsorOfferComponent`s (base/rank/improvement/
 * overperformance/special) — die bewährte, sim-kalibrierte Auszahlungs-Mathematik aus P0–P3 bleibt damit
 * unangetastet. NEU kommen nicht-Cash-Module hinzu (Perks), deren Reichtum mit der Rarity steigt, sodass
 * „Legendär" sich sichtbar wertiger anfühlt.
 *
 * Diese Datei ist die deklarative Schicht: sie beschreibt, aus welchen Modulen ein Angebot besteht
 * (`describeSponsorOfferModules`), liefert die stabile `moduleIds`-Liste (`buildSponsorOfferModuleIds`) und
 * definiert die (balance-neutralen) Perk-Regeln. Die Komposition selbst passiert weiterhin in
 * `buildOffer` (sponsor-offer-service); künftige Ausbaustufen können den fixen Block dort schrittweise durch
 * einen katalog-getriebenen Selektor ersetzen, ohne dass sich das Persistenz-/Settlement-Format ändert.
 */

export type SponsorModuleKind =
  | "base_income"
  | "rank_ladder"
  | "overperformance"
  | "improvement"
  | "special_objective"
  | "clause"
  | "perk";

export type SponsorModuleDescriptor = {
  /** Stabile ID (bei Cash-Modulen die componentId, bei Perks eine feste Perk-ID). */
  id: string;
  kind: SponsorModuleKind;
  labelDe: string;
  /** true = Cash-tragend (Teil der `components`/Total); false = nicht-Cash (Perk/Flavor). */
  cash: boolean;
};

export const SPONSOR_MODULE_KIND_LABEL: Record<SponsorModuleKind, string> = {
  base_income: "Basis",
  rank_ladder: "Gewinnstufen",
  overperformance: "Überperformance",
  improvement: "Tabellenziel",
  special_objective: "Sonderziel",
  clause: "Klausel",
  perk: "Perk",
};

const COMPONENT_KIND_TO_MODULE: Record<SponsorOfferComponent["kind"], SponsorModuleKind> = {
  base: "base_income",
  rank: "rank_ladder",
  improvement: "improvement",
  overperformance: "overperformance",
  special: "special_objective",
};

/** Perk-IDs (nicht-Cash-Module). */
export const SPONSOR_PERK_SPOTLIGHT_X2 = "perk-spotlight-x2";

/** Faktor, um den der Spotlight-Perk den Beliebtheits-Impuls des Sonderziels hebt (nur Popularity, cash-neutral). */
export const SPONSOR_SPOTLIGHT_PERK_FACTOR = 2;

/**
 * Qualifiziert ein Angebot für den Spotlight-Perk? Nur die Spitze: legendär ODER golden. Balance-neutral
 * (verstärkt nur den liga-zentrierten Beliebtheits-Impuls, keinen Cash), macht aber Top-Angebote sichtbar reicher.
 */
export function offerQualifiesForSpotlightPerk(
  rarity: SponsorRarity | undefined,
  isGolden: boolean | undefined,
): boolean {
  return rarity === "legendär" || isGolden === true;
}

/** Die Modul-Beschreibungen eines Angebots: alle Cash-Komponenten als Module + evtl. Perk-Module. */
export function describeSponsorOfferModules(offer: SponsorOffer): SponsorModuleDescriptor[] {
  const modules: SponsorModuleDescriptor[] = offer.components.map((component) => {
    const kind = COMPONENT_KIND_TO_MODULE[component.kind];
    return { id: component.componentId, kind, labelDe: SPONSOR_MODULE_KIND_LABEL[kind], cash: true };
  });
  if (offerQualifiesForSpotlightPerk(offer.rarity, offer.isGolden)) {
    modules.push({ id: SPONSOR_PERK_SPOTLIGHT_X2, kind: "perk", labelDe: "Spotlight ×2", cash: false });
  }
  return modules;
}

/** Stabile Modul-ID-Liste für Persistenz/Anzeige (`SponsorOffer.moduleIds`). */
export function buildSponsorOfferModuleIds(offer: SponsorOffer): string[] {
  return describeSponsorOfferModules(offer).map((module) => module.id);
}

/**
 * Wendet den Spotlight-Perk auf die Komponenten an: verdoppelt den `spotlightBonus` des Sonderziels, wenn das
 * Angebot qualifiziert (legendär/golden). Rein Popularity-wirksam (Σ über die Liga ≈ 0), keine Cash-Änderung —
 * damit bleibt die Payout-Balance aus P0–P3 exakt erhalten.
 */
export function applySpotlightPerkToComponents(
  components: SponsorOfferComponent[],
  rarity: SponsorRarity | undefined,
  isGolden: boolean | undefined,
): SponsorOfferComponent[] {
  if (!offerQualifiesForSpotlightPerk(rarity, isGolden)) {
    return components;
  }
  return components.map((component) =>
    component.kind === "special" && typeof component.spotlightBonus === "number" && component.spotlightBonus > 0
      ? { ...component, spotlightBonus: Number((component.spotlightBonus * SPONSOR_SPOTLIGHT_PERK_FACTOR).toFixed(3)) }
      : component,
  );
}
