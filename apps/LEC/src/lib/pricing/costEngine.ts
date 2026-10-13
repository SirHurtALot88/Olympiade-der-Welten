import type { CostSettingsValues } from "./costSettings";

export type ItemKind = "single" | "pack";

/**
 * Shopweite Verkaufsmengen (365 Tage), aus denen sich Fixkosten-Umlage und
 * Einschreiben-Satz ableiten. EIN Wert fuer den ganzen Shop, nicht je Artikel.
 */
export interface ShopVolume {
  /** N: insgesamt verkaufte Stueck in 365 Tagen (alle Karten-Artikel). */
  units365d: number;
  /**
   * N_T: davon Stueck mit VK >= `registeredThreshold`. `null` = unbekannt
   * (z. B. nur eine bekannte Gesamtzahl aus einem frueheren Import) ->
   * Einschreiben-Rueckfall auf den flachen Satz S*C/N.
   */
  unitsAtOrAboveThreshold: number | null;
}

/**
 * Baut das ShopVolume aus Zeilen mit Stueckzahl und Ø-VK (Billbee-Zeilen bzw.
 * Fenster-Aggregate). Gemeinsame Quelle fuer Import UND Anzeige, damit beide
 * dieselbe Zahl sehen.
 */
export function computeShopVolume(
  rows: ReadonlyArray<{ qty: number; avgPrice: number }>,
  settings: CostSettingsValues
): ShopVolume {
  let units = 0;
  let atOrAbove = 0;
  for (const row of rows) {
    if (!(row.qty > 0)) continue;
    units += row.qty;
    if (row.avgPrice >= settings.registeredThreshold) atOrAbove += row.qty;
  }
  return { units365d: units, unitsAtOrAboveThreshold: atOrAbove };
}

export interface HkInput {
  /** Einkaufspreis der Verkaufseinheit (bei Pack bereits der Pack-EK). */
  ek: number;
  kind: ItemKind;
  /** Menge des Cardmarket-Einkaufs (fuer die Einkauf-Versand-Staffel <5/sonst). Nur fuer "single" relevant. */
  purchaseQty?: number;
  /** Pack-Groesse (z. B. 3 bei "3x"). Nur fuer "pack" relevant. */
  packSize?: number;
  /**
   * Fixkosten-Anteil je verkaufter Einheit (siehe fixedCostPerUnit()) — EIN
   * shopweiter Wert, nicht pro Artikel! eBay-Shop-/Billbee-/Lexoffice-Gebuehren
   * sind Gesamt-Fixkosten des Shops, keine Artikel-Fixkosten: sie muessen durch
   * die shopweite 365-Tage-Stueckzahl geteilt werden, nicht durch die
   * Verkaufsmenge des einzelnen Artikels (sonst wuerden Nischen-Artikel mit
   * wenigen Verkaeufen faelschlich die komplette Fixkostenlast allein tragen).
   */
  fixedCostPerUnit: number;
  /**
   * Verkaufspreis, zu dem der HK gerechnet wird. Das Einschreiben haengt am
   * VK (ab `registeredThreshold` real 2,35 EUR, darunter nur der anteilige
   * Satz) — siehe registeredCostPerUnit(). `null` = VK unbekannt -> flacher
   * Durchschnittssatz S*C/N.
   */
  vk: number | null;
  /** Shopweite Mengen fuer den Einschreiben-Satz unter der Schwelle. `null` = unbekannt. */
  shop: ShopVolume | null;
}

/**
 * Einkaufs-Versand-Anteil (KONZEPT §7.3, korrigiert nach Chris' Vorgabe):
 * Das Porto faellt je BESTELLUNG an, nicht je Stueck. Chris: "ich kalkuliere
 * beim einkauf den versand zu 50% ein" -> Anteil = Bestellporto x
 * `buyShippingShareFactor` (Default 0,5). Ein 3er-Pack gilt als EINE Einheit
 * (NICHT x Packgroesse). Die Portowerte selbst bleiben als nachpruefbare
 * Rechnungswerte stehen: <5 Stk -> 1,15, ab 5 Stk -> 1,30.
 *
 * Hinweis zur Staffel: `purchaseQty` wird im Code nirgends >= 5 uebergeben
 * (importPlan.ts setzt defaultPurchaseQty = 3). Der Zweig "ab 5 Stk" (1,30)
 * ist damit derzeit toter Code. Bewusst NICHT entfernt: sobald die echte
 * Bestellmenge bekannt ist (Einkaufs-Import), greift er wieder.
 */
export function buyShippingShare(input: HkInput, settings: CostSettingsValues): number {
  const qty = input.purchaseQty ?? 1;
  const orderPostage = qty < 5 ? settings.buyShippingUnderFive : settings.buyShippingFive;
  return orderPostage * settings.buyShippingShareFactor;
}

/**
 * Einschreiben-Satz je Stueck UNTER der Schwelle (r):
 *   r = max(0, S - N_T) * C / (N - N_T)
 * S = Marken/Jahr, C = Kosten je Einschreiben, N = shopweite Stueckzahl/365T,
 * N_T = Stueck mit VK >= Schwelle T. Alle Marken, die nicht fuer Warenkoerbe
 * ab T draufgehen, verteilen sich auf die uebrigen Stuecke.
 * Rueckfall ohne N_T: flacher Satz S*C/N. Ohne N: 0 (nichts umzulegen).
 */
export function registeredRateBelowThreshold(shop: ShopVolume | null, settings: CostSettingsValues): number {
  if (!shop || !(shop.units365d > 0)) return 0;
  const { registeredStampsPerYear: S, registeredCostPerShipment: C } = settings;
  const N = shop.units365d;
  const NT = shop.unitsAtOrAboveThreshold;
  if (NT === null) return (S * C) / N;
  const below = N - NT;
  if (below <= 0) return 0;
  return (Math.max(0, S - NT) * C) / below;
}

/**
 * Einschreiben-Kosten je Stueck (Chris: "ab 30 euro warenkorb mit einschreiben
 * einwurf", ca. 100 Marken/Jahr a 2,35 EUR):
 *   registered(VK) = VK >= T ? C : r
 * Eine 35-EUR-Karte traegt real 2,35 EUR, eine 4,99er meist nichts. `vk = null`
 * (unbekannt) -> flacher Durchschnitt S*C/N.
 */
export function registeredCostPerUnit(
  vk: number | null,
  shop: ShopVolume | null,
  settings: CostSettingsValues
): number {
  if (vk !== null && vk >= settings.registeredThreshold) return settings.registeredCostPerShipment;
  if (vk === null) {
    if (!shop || !(shop.units365d > 0)) return 0;
    return (settings.registeredStampsPerYear * settings.registeredCostPerShipment) / shop.units365d;
  }
  return registeredRateBelowThreshold(shop, settings);
}

/** Summe ALLER Jahres-Fixkostenfelder (eBay-Shop + Billbee + Lexoffice + Verpackungslizenz + Sonstige), EUR/Jahr. */
export function totalFixedYearly(settings: CostSettingsValues): number {
  return (
    settings.fixedYearlyEbayShop +
    settings.fixedYearlyBillbee +
    settings.fixedYearlyLexoffice +
    settings.fixedYearlyPackagingLicense +
    settings.fixedYearlyOther
  );
}

/**
 * Fixkosten-Anteil je verkaufter Einheit, SHOPWEIT (KONZEPT §7.3):
 * (eBay-Shop + Billbee + Lexoffice + Verpackungslizenz + Sonstige) EUR/Jahr geteilt durch
 * die INSGESAMT im Shop verkauften Stueck in 365 Tagen (ueber alle Artikel
 * hinweg) — einmal pro Import berechnen, dann als Konstante an jeden Artikel
 * weiterreichen. Alle fuenf Felder sind JAHRESwerte (95 EUR/Monat = 1140).
 */
export function fixedCostPerUnit(totalShopUnitsSold365d: number, settings: CostSettingsValues): number {
  if (totalShopUnitsSold365d <= 0) return 0;
  return totalFixedYearly(settings) / totalShopUnitsSold365d;
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
  const registeredMail = registeredCostPerUnit(input.vk, input.shop, settings);
  const packaging = isPack ? settings.packagingPack : settings.packagingSingle;
  const fixed = input.fixedCostPerUnit;

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
  /** Vollkosten-HK (inkl. shopweitem Fixkostenanteil). */
  hk: number;
  currentVkFees: EbayFeeBreakdown;
  /** Vollkosten-Korridor: VK-MIN / VK-GUT (inkl. Fixkosten). */
  vkMin: number;
  vkGood: number;
  /** HK OHNE Fixkostenanteil (Basis der Deckungsbeitrags-Rechnung). */
  hkContribution: number;
  /**
   * Deckungsbeitrags-Grenze: VK, bei dem der Gewinn VOR Fixkosten genau 0 ist.
   * Darunter verliert Chris bei jedem Verkauf echtes Geld (Ware, Porto, Gebuehren
   * werden nicht mehr gedeckt) — unabhaengig davon, wie die Fixkosten verteilt werden.
   */
  vkContribution: number;
  /** Ziel-Marge der MIN-Linie, abgeleitet aus dem Multiplikator: 1 - 1/1,33 = 24,8 % (~25 %). */
  targetMargin: number;
  /** Lineares Gebuehrenmodell fuer den Korridor-Ad-Satz: Gebuehr(VK) = feeFixed + VK x feeRate. */
  feeFixed: number;
  feeRate: number;
}

/**
 * Preis-Korridor MIN/GUT (KONZEPT §7.3) plus Deckungsbeitrags-Grenze:
 * Basis = HK + VK-Kosten des aktuellen VK (fuer die Korridor-Zielrechnung wird
 * die Ziel-Ad-Rate "gut" = 10 % verwendet).
 * VK-MIN  = (HK + VK-Kosten) x 1,33  (~25% Marge, Vollkosten)
 * VK-GUT  = (HK + VK-Kosten) x 1,66  (~35% Marge, Vollkosten)
 * VK-DB   = (HK ohne Fixkosten + 0,35) / (1 - Gebuehrensatz)  (Gewinn vor Fixkosten = 0)
 *
 * Der HK wird als HkBreakdown uebergeben (nicht nur als Summe), weil die
 * Deckungsbeitrags-Linie den Fixkostenanteil herausrechnen muss.
 */
export function computePriceCorridor(
  hk: HkBreakdown,
  currentVk: number,
  settings: CostSettingsValues
): PriceCorridor {
  const currentVkFees = computeEbayFees(currentVk, settings.adFeeRateGood, settings);
  const basis = hk.total + currentVkFees.total;
  const feeRate = (settings.ebayCommissionRate + settings.adFeeRateGood) * (1 + settings.ebayCommissionVat);
  const feeFixed = settings.ebayCommissionFixed;
  const hkContribution = hk.total - hk.fixedCostShare;
  return {
    hk: hk.total,
    currentVkFees,
    vkMin: basis * settings.marginMinMultiplier,
    vkGood: basis * settings.marginGoodMultiplier,
    hkContribution,
    vkContribution: feeRate < 1 ? (hkContribution + feeFixed) / (1 - feeRate) : Infinity,
    targetMargin: 1 - 1 / settings.marginMinMultiplier,
    feeFixed,
    feeRate,
  };
}

/**
 * Marge VOR Fixkosten (Deckungsbeitrags-Marge) bei einem VK: (VK - Gebuehren - HK ohne
 * Fixkosten) / VK. Das ist die Obergrenze der erreichbaren Vollkosten-Marge bei diesem VK —
 * mehr geht auch mit null Fixkosten nicht.
 */
export function contributionMarginAt(vk: number, corridor: PriceCorridor): number {
  if (vk <= 0) return 0;
  return (vk - corridor.feeFixed - vk * corridor.feeRate - corridor.hkContribution) / vk;
}

/** Vollkosten-Marge (nach Fixkosten) bei einem VK, im selben Gebuehrenmodell wie der Korridor. */
export function fullCostMarginAt(vk: number, corridor: PriceCorridor): number {
  if (vk <= 0) return 0;
  return (vk - corridor.feeFixed - vk * corridor.feeRate - corridor.hk) / vk;
}

export type PriceStatus = "unter_min" | "ziel_unerreichbar" | "im_korridor" | "ueber_gut";

/**
 * Status "zu guenstig / Ziel unerreichbar / im Korridor / zu teuer" fuer den Ampel-Pill.
 *
 * Unterhalb von VK-MIN gibt es zwei Faelle:
 * - `ziel_unerreichbar`: Schon die Marge VOR Fixkosten liegt bei diesem VK unter dem
 *   MIN-Ziel (z. B. EK 0,90 bei VK 4,99: Obergrenze ~22 % statt 25 %). Das Ziel ist mit
 *   diesem VK nicht erreichbar, egal wie die Fixkosten verteilt werden — kein "zu
 *   guenstig"-Alarm, sondern ein struktureller Befund (Preis oder EK muessen sich aendern).
 * - `unter_min`: das Ziel waere bei diesem VK erreichbar (Marge vor Fixkosten >= Ziel), die
 *   Fixkosten fressen es aber auf — oder der VK liegt unter der Deckungsbeitrags-Grenze und
 *   Chris verliert pro Verkauf echtes Geld. Letzteres bleibt IMMER `unter_min`.
 */
export function classifyPriceStatus(vk: number, corridor: PriceCorridor): PriceStatus {
  if (vk > corridor.vkGood) return "ueber_gut";
  if (vk >= corridor.vkMin) return "im_korridor";
  if (vk < corridor.vkContribution) return "unter_min";
  if (contributionMarginAt(vk, corridor) < corridor.targetMargin) return "ziel_unerreichbar";
  return "unter_min";
}
