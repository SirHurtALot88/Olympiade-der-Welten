import type {
  SponsorCurveFamily,
  SponsorOffer,
  SponsorOfferComponent,
  SponsorRarity,
} from "@/lib/data/olyDataTypes";

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
  clause: "clause",
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

// =====================================================================================================
// P4b — Die TIEFE modulare Komposition: Rarity steuert die ANZAHL der Cash-Module, ein EV-Budget wird
// zwischen Basis und Upside-Modulen UMVERTEILT (nicht erhöht), und ein Klausel-Modul kauft Basis-Budget frei.
//
// Prinzip (§3 des Design-Docs):
//  - gewöhnlich = 2 Cash-Module (XL-Basis), magisch = 3 (L), selten = 4 (M), legendär = 5 (S). Die Basis ist
//    IMMER Modul #1; die restlichen (count-1) Upside-Module werden familien-gegatet ausgewählt.
//  - EV-Budget-Invariante: das Erwartungsbudget des Angebots (Basis + Rang-Leiter-EV am Erwartungsrang +
//    Σ attainment×Reward der Bonus-Module) bleibt erhalten. WEGGELASSENE Module geben ihren EV-Anteil an die
//    Basis ab → niedrige Rarity ist basislastig & verlässlich, hohe Rarity upside-reich.
//  - Risikoprämie ρ (~1.2): behaltene BEDINGTE Module (special/overperf/improvement) werden um ρ vergrößert,
//    finanziert aus einer minimal kleineren Basis — EV-neutral, aber Bonus-lastige (hohe-Rarity) Angebote
//    werden dadurch attraktiv. Rang-Leiter wird NICHT prämiert (sie wird über die gelockte Leiter gesettelt,
//    Anzeige==Settlement) und die Klausel ebenso wenig.
//  - Klausel-Modul (negativer EV-Anteil): kauft Basis frei — ein Abstiegs-Malus im Tausch gegen mehr Basis;
//    für ein Mittelfeld-/Spitzenteam EV-nahezu-neutral (kleine Abstiegs-Wahrscheinlichkeit), für ein schwaches
//    Team riskant. Familien-gegatet (sicherheit/aufstieg).
// =====================================================================================================

function round1(value: number): number {
  return Number(value.toFixed(1));
}

/** Cash-Modul-Anzahl je Rarity (Basis + Upside-Module). gewöhnlich 2 … legendär 5 (§3-Tabelle). */
export const SPONSOR_MODULE_COUNT_BY_RARITY: Record<SponsorRarity, number> = {
  gewöhnlich: Number(process.env.OLY_SPONSOR_MODULES_COMMON ?? 2) || 2,
  magisch: Number(process.env.OLY_SPONSOR_MODULES_MAGIC ?? 3) || 3,
  selten: Number(process.env.OLY_SPONSOR_MODULES_RARE ?? 4) || 4,
  legendär: Number(process.env.OLY_SPONSOR_MODULES_LEGENDARY ?? 5) || 5,
};

/** Basis-Größen-Label je Rarity (rein Anzeige — die tatsächliche Größe kommt aus der EV-Umverteilung). */
export const SPONSOR_BASE_SIZE_BY_RARITY: Record<SponsorRarity, string> = {
  gewöhnlich: "XL",
  magisch: "L",
  selten: "M",
  legendär: "S",
};

/** Risikoprämie auf behaltenes bedingtes Geld (macht Bonus-lastige Angebote attraktiv, EV-neutral). */
export const SPONSOR_RISK_PREMIUM = Number(process.env.OLY_SPONSOR_RISK_PREMIUM ?? 1.2) || 1.2;

/** attainment-Gewichte fürs EV-Budget (konsistent mit estimateExpectedPayout). */
const EV_WEIGHT_SPECIAL = 0.45;
const EV_WEIGHT_OVERPERF = 0.25;
const EV_WEIGHT_IMPROVEMENT = 0.2;

type ModuleToken = "rank" | "overperformance" | "special" | "improvement" | "clause";

/**
 * Familien-Prioritäten der Upside-Module (Basis ist immer separat & zuerst). Die ersten (count-1) VERFÜGBAREN
 * Token werden behalten. titel/europa bevorzugen Overperf+Rang (kleine Basis), stetig/aufstieg das Tabellenziel,
 * sicherheit die Klausel + hohe Basis (kein Overperf).
 */
const FAMILY_MODULE_PRIORITY: Record<SponsorCurveFamily, ModuleToken[]> = {
  titel: ["rank", "overperformance", "special", "improvement"],
  europa: ["rank", "overperformance", "special", "improvement"],
  stetig: ["rank", "improvement", "special", "overperformance"],
  aufstieg: ["rank", "improvement", "special", "clause"],
  sicherheit: ["clause", "rank", "special", "improvement"],
};

let p4bEnabled = (process.env.OLY_SPONSOR_P4B ?? "1") !== "0";
/** P4b-Komposition an/aus (Default an; ENV OLY_SPONSOR_P4B=0 deaktiviert). Für In-Process-Vergleichsläufe. */
export function isSponsorP4bEnabled(): boolean {
  return p4bEnabled;
}
export function setSponsorP4bEnabled(value: boolean): void {
  p4bEnabled = value;
}

export type SponsorP4bComposeInput = {
  /** Volle P0–P3-Komponentenliste (base, rank, improvement, special[+fanInfra], overperf?). */
  components: SponsorOfferComponent[];
  rarity: SponsorRarity;
  family: SponsorCurveFamily;
  /** Erwarteter Endrang (teamQualityRank) — Basis fürs Rang-EV & die Klausel-Wahrscheinlichkeit. */
  expectedRank: number | null;
  teamCount: number;
  /** Rang-Leiter-EV am Erwartungsrang: payout(expectedRank) − payout(32), aus der gelockten Kurve. */
  rankEvAtExpected: number;
};

/**
 * Baut aus der vollen Komponentenliste die rarity-gestaffelte P4b-Modulmenge, EV-erhaltend umverteilt.
 * Rein funktional (kein GameState) → deterministisch und leicht testbar.
 */
export function composeSponsorOfferComponentsP4b(input: SponsorP4bComposeInput): SponsorOfferComponent[] {
  const { components, rarity, family, expectedRank, teamCount, rankEvAtExpected } = input;
  const base = components.find((component) => component.kind === "base");
  if (!base) {
    return components;
  }
  const baseCash0 = base.rewardCash;
  const rankComponent = components.find((component) => component.kind === "rank") ?? null;
  const overperfComponent = components.find((component) => component.kind === "overperformance") ?? null;
  const improvementComponent = components.find((component) => component.kind === "improvement") ?? null;
  const specials = components.filter((component) => component.kind === "special");
  const primarySpecial =
    specials.find((component) => component.specialKey !== "fan_infrastructure") ?? specials[0] ?? null;
  const otherSpecials = specials.filter((component) => component !== primarySpecial);

  // Referenz-EV (= "full EV" am Erwartungsrang): Basis + Rang-EV + Σ attainment×Reward ALLER Bonus-Module.
  const specialRewardTotal =
    (primarySpecial?.rewardCash ?? 0) + otherSpecials.reduce((sum, component) => sum + component.rewardCash, 0);
  const referenceEV = round1(
    baseCash0 +
      rankEvAtExpected +
      EV_WEIGHT_OVERPERF * (overperfComponent?.rewardCash ?? 0) +
      EV_WEIGHT_SPECIAL * specialRewardTotal +
      EV_WEIGHT_IMPROVEMENT * (improvementComponent?.rewardCash ?? 0),
  );

  // Klausel-Parameter (beim Signieren eingefroren): Abstiegs-Schwelle + Malus + Erfüllungs-Wahrscheinlichkeit.
  const dropThreshold = Math.max(2, teamCount - 3);
  const clausePenalty = round1(Math.max(3, Math.min(baseCash0 * 0.15, 8)));
  const clauseDropProbability =
    expectedRank == null ? 0 : Math.max(0, Math.min(0.9, (expectedRank - (dropThreshold - 6)) / 8));
  const clauseEv = -round1(clausePenalty * clauseDropProbability);

  // Verfügbare Token je nach vorhandenen Komponenten.
  const tokenAvailable: Record<ModuleToken, boolean> = {
    rank: rankComponent != null,
    overperformance: overperfComponent != null,
    special: primarySpecial != null,
    improvement: improvementComponent != null,
    clause: family === "sicherheit" || family === "aufstieg",
  };

  const totalModules = SPONSOR_MODULE_COUNT_BY_RARITY[rarity];
  const upsideSlots = Math.max(0, totalModules - 1);
  const keptTokens: ModuleToken[] = [];
  for (const token of FAMILY_MODULE_PRIORITY[family]) {
    if (keptTokens.length >= upsideSlots) break;
    if (tokenAvailable[token] && !keptTokens.includes(token)) {
      keptTokens.push(token);
    }
  }

  // Behaltene EV + prämierbare (bedingte) EV aufsummieren.
  let keptUpsideEv = 0;
  let keptPremiumEv = 0;
  for (const token of keptTokens) {
    if (token === "rank") {
      keptUpsideEv += rankEvAtExpected;
    } else if (token === "overperformance" && overperfComponent) {
      const ev = EV_WEIGHT_OVERPERF * overperfComponent.rewardCash;
      keptUpsideEv += ev;
      keptPremiumEv += ev;
    } else if (token === "special" && primarySpecial) {
      const ev = EV_WEIGHT_SPECIAL * primarySpecial.rewardCash;
      keptUpsideEv += ev;
      keptPremiumEv += ev;
    } else if (token === "improvement" && improvementComponent) {
      const ev = EV_WEIGHT_IMPROVEMENT * improvementComponent.rewardCash;
      keptUpsideEv += ev;
      keptPremiumEv += ev;
    } else if (token === "clause") {
      keptUpsideEv += clauseEv;
    }
  }

  const droppedEv = referenceEV - baseCash0 - keptUpsideEv;
  // Basis absorbiert das EV weggelassener Module, gibt aber die Risikoprämie auf behaltenes bedingtes Geld ab.
  const newBase = round1(Math.max(1, baseCash0 + droppedEv - (SPONSOR_RISK_PREMIUM - 1) * keptPremiumEv));

  const out: SponsorOfferComponent[] = [];
  out.push({
    ...base,
    label: `${base.label} · ${SPONSOR_BASE_SIZE_BY_RARITY[rarity]}`,
    targetValue: newBase,
    rewardCash: newBase,
  });

  const premium = SPONSOR_RISK_PREMIUM;
  for (const token of keptTokens) {
    if (token === "rank" && rankComponent) {
      // Rang-Leiter UNVERÄNDERT (gelockte Leiter settelt sie; keine Prämie → Anzeige==Settlement).
      out.push(rankComponent);
    } else if (token === "overperformance" && overperfComponent) {
      const rate = round1((overperfComponent.ratePerUnitC ?? 0) * premium);
      const cap = round1(overperfComponent.rewardCash * premium);
      out.push({
        ...overperfComponent,
        label: `+${rate} C je Platz über Erwartungsrang #${overperfComponent.targetValue} · max ${cap} C`,
        rewardCash: cap,
        ratePerUnitC: rate,
      });
    } else if (token === "improvement" && improvementComponent) {
      const rate = round1((improvementComponent.ratePerUnitC ?? 0) * premium);
      const cap = round1(improvementComponent.rewardCash * premium);
      out.push({
        ...improvementComponent,
        label: `+${rate} C je verbessertem Platz · max ${improvementComponent.maxUnits ?? "?"}`,
        rewardCash: cap,
        ratePerUnitC: rate,
      });
    } else if (token === "special" && primarySpecial) {
      const reward = round1(primarySpecial.rewardCash * premium);
      out.push({
        ...primarySpecial,
        rewardCash: reward,
        penaltyCash: primarySpecial.penaltyCash != null ? round1(primarySpecial.penaltyCash * premium) : undefined,
      });
    } else if (token === "clause") {
      out.push({
        componentId: "clause-relegation",
        kind: "clause",
        label: `Abstiegs-Klausel: −${clausePenalty} C bei Platz ≥ ${dropThreshold}`,
        targetValue: dropThreshold,
        rewardCash: 0,
        penaltyCash: clausePenalty,
      });
    }
  }

  return out;
}
