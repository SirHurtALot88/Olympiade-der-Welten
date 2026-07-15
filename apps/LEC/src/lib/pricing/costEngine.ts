import type { CostSettingsValues } from "./costSettings";

export type ItemKind = "single" | "pack";

export interface HkInput {
  /** Einkaufspreis der Verkaufseinheit (bei Pack bereits der Pack-EK). */
  ek: number;
  kind: ItemKind;
  /** Menge des Cardmarket-Einkaufs (fuer die Einkauf-Versand-Staffel <5/sonst). Nur fuer "single" relevant. */
  purchaseQty?: number;
  /** Pack-Groesse (z. B. 3 bei "3x"). Nur fuer "pack" relevant. */
  packSize?: number;
  /** Verkaufte Stueck in 365 Tagen, fuer die Fixkosten-Umlage. */
  soldUnits365d: number;
}

/** Einkaufs-Versand-Anteil (KONZEPT §7.3): Einzel <5 Stk -> 1,15/Menge, sonst 1,30/Menge; Pack: 1,30/Menge x Packgroesse. */
export function buyShippingShare(input: HkInput, settings: CostSettingsValues): number {
  if (input.kind === "pack") {
    return settings.buyShippingFive * (input.packSize ?? 3);
  }
  const qty = input.purchaseQty ?? 1;
  return qty < 5 ? settings.buyShippingUnderFive : settings.buyShippingFive;
}

/** Fixkosten-Anteil je verkaufter Einheit: (eBay-Shop + Billbee + Lexoffice) EUR/Jahr geteilt durch verkaufte Stueck/365T. */
export function fixedCostShare(soldUnits365d: number, settings: CostSettingsValues): number {
  const yearlyFixed =
    settings.fixedYearlyEbayShop + settings.fixedYearlyBillbee + settings.fixedYearlyLexoffice;
  if (soldUnits365d <= 0) return 0;
  return yearlyFixed / soldUnits365d;
}

export interface HkBreakdown {
  ek: number;
  buyShipping: number;
  shipping: number;
  registeredMail: number;
  packaging: number;
  fixedCostShare: number;
  total: number;
}

/** Selbstkosten HK (KONZEPT §7.3), ohne eBay-Verkaufsgebuehr. */
export function computeHk(input: HkInput, settings: CostSettingsValues): HkBreakdown {
  const isPack = input.kind === "pack";
  const buyShipping = buyShippingShare(input, settings);
  const shipping = isPack ? settings.shippingPack : settings.shippingSingle;
  const registeredMail = isPack ? settings.registeredPack : settings.registeredSingle;
  const packaging = isPack ? settings.packagingPack : settings.packagingSingle;
  const fixed = fixedCostShare(input.soldUnits365d, settings);

  const total = input.ek + buyShipping + shipping + registeredMail + packaging + fixed;

  return {
    ek: input.ek,
    buyShipping,
    shipping,
    registeredMail,
    packaging,
    fixedCostShare: fixed,
    total,
  };
}

export interface EbayFeeBreakdown {
  commission: number;
  adFee: number;
  total: number;
}

/**
 * eBay-Verkaufsgebuehren fuer einen VK-Preis (KONZEPT §7.3):
 * Provision = 0,35 EUR + VK x 11% x 1,19 (Provision inkl. 19% USt-Aufschlag)
 * Anzeigen  = VK x Ad-Rate x 1,19
 */
export function computeEbayFees(
  vk: number,
  adRate: number,
  settings: CostSettingsValues
): EbayFeeBreakdown {
  const commission =
    settings.ebayCommissionFixed + vk * settings.ebayCommissionRate * (1 + settings.ebayCommissionVat);
  const adFee = vk * adRate * (1 + settings.ebayCommissionVat);
  return { commission, adFee, total: commission + adFee };
}

export interface MarginResult {
  vk: number;
  ebayFees: EbayFeeBreakdown;
  hk: number;
  profit: number;
  marginPct: number;
}

/** Gewinn/Gewinnmarge fuer einen konkreten VK (KONZEPT §7.3): Gewinn = VK - VK-Kosten - HK. */
export function computeMargin(
  vk: number,
  hk: number,
  adRate: number,
  settings: CostSettingsValues
): MarginResult {
  const ebayFees = computeEbayFees(vk, adRate, settings);
  const profit = vk - ebayFees.total - hk;
  const marginPct = vk === 0 ? 0 : profit / vk;
  return { vk, ebayFees, hk, profit, marginPct };
}

export interface PriceCorridor {
  hk: number;
  currentVkFees: EbayFeeBreakdown;
  vkMin: number;
  vkGood: number;
}

/**
 * Preis-Korridor MIN/GUT (KONZEPT §7.3):
 * Basis = HK + VK-Kosten des aktuellen VK (Ad-Rate "Einzel aktuell" 9%,
 * fuer die Korridor-Zielrechnung wird die Ziel-Ad-Rate min/gut = 10% verwendet).
 * VK-MIN  = (HK + VK-Kosten) x 1,33  (~25% Marge)
 * VK-GUT  = (HK + VK-Kosten) x 1,66  (~35% Marge)
 */
export function computePriceCorridor(
  hk: number,
  currentVk: number,
  settings: CostSettingsValues
): PriceCorridor {
  const currentVkFees = computeEbayFees(currentVk, settings.adFeeRateGood, settings);
  const basis = hk + currentVkFees.total;
  return {
    hk,
    currentVkFees,
    vkMin: basis * settings.marginMinMultiplier,
    vkGood: basis * settings.marginGoodMultiplier,
  };
}

export type PriceStatus = "unter_min" | "im_korridor" | "ueber_gut";

/** Status "zu guenstig / im Korridor / zu teuer" fuer den Dashboard-Ampel-Pill. */
export function classifyPriceStatus(vk: number, corridor: PriceCorridor): PriceStatus {
  if (vk < corridor.vkMin) return "unter_min";
  if (vk > corridor.vkGood) return "ueber_gut";
  return "im_korridor";
}
