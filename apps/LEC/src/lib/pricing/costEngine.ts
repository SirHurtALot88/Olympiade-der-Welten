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

/**
 * Zielspanne des VK (Chris, 13.10.): Deckungsbeitrags-Marge — also VOR Fixkosten — mindestens
 * 25 %, optimal 33 %. Ein Maßstab fuer das ganze Board (Sortiment-Korridor, Marktpreise, Cockpit).
 */
export const DB_MARGIN_MIN = 0.25;
export const DB_MARGIN_OPT = 0.33;

/**
 * Untergrenze 4,99 € (seit September): Billigkarten sind bewusst Warenkorb-Fueller. Ein Artikel,
 * der auf der Untergrenze steht, ist "im Rahmen", auch wenn die reine Margenrechnung weniger
 * verlangen wuerde.
 */
export const PRICE_FLOOR = 4.99;

/** Toleranz gegen x,99-Rundung: knapp neben der Spanne ist noch keine Abweichung. */
export const RANGE_TOLERANCE = 0.03;

export interface TargetContext {
  kind: ItemKind;
  packSize?: number;
  /** Shopweite Mengen fuer den Einschreiben-Satz. `null` = unbekannt. */
  shop: ShopVolume | null;
}

export interface TargetRange {
  /** VK fuer 25 % Deckungsbeitrags-Marge, mindestens PRICE_FLOOR. */
  min: number;
  /** VK fuer 33 %, mindestens PRICE_FLOOR. */
  opt: number;
}

export interface PriceCorridor {
  /** Vollkosten-HK (inkl. shopweitem Fixkostenanteil), nur zur Anzeige der Vollkosten-Marge. */
  hk: number;
  currentVkFees: EbayFeeBreakdown;
  /** Zielspanne: VK-MIN (25 %) / VK-GUT (33 %) Deckungsbeitrags-Marge, mindestens 4,99 €. */
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
  /** Ziel-Marge der MIN-Linie: 25 % Deckungsbeitrag. */
  targetMargin: number;
  /** Lineares Gebuehrenmodell fuer den Korridor-Ad-Satz: Gebuehr(VK) = feeFixed + VK x feeRate. */
  feeFixed: number;
  feeRate: number;
}

/**
 * Zielspanne zu einem EK der Verkaufseinheit: VK fuer 25 % bis 33 % Deckungsbeitrags-Marge
 * (Anzeigen-Satz MIN bzw. GUT), mindestens PRICE_FLOOR. Eine Quelle fuer Sortiment-Korridor
 * (EK = eigener EK) und Marktpreise/Cockpit (EK = Cardmarket-Marktwert).
 */
export function computeTargetRange(ek: number, ctx: TargetContext, settings: CostSettingsValues): TargetRange {
  const input = { ek, kind: ctx.kind, packSize: ctx.packSize, shop: ctx.shop };
  const min = targetPriceForMargin(input, DB_MARGIN_MIN, settings.adFeeRateMin, settings);
  const opt = targetPriceForMargin(input, DB_MARGIN_OPT, settings.adFeeRateGood, settings);
  return { min: Math.max(PRICE_FLOOR, min ?? PRICE_FLOOR), opt: Math.max(PRICE_FLOOR, opt ?? PRICE_FLOOR) };
}

/**
 * Marktdeckel (Chris, 13.10.): Bei teuren Karten gibt der Markt keinen grossen Aufschlag her —
 * "selten mehr als das 1,5-fache vom Marktwert, das waere schon ein super guter Deal"
 * (Dominus-Funke: Einkauf rund 48 €, verkauft fuer 69,99 €); eine Karte mit Marktwert 120 geht
 * bei etwa 150 weg, man bietet sie bei 170-180 an. Die 25-%-Marge-Regel (rund das Doppelte
 * des EK) ist dort nicht erreichbar.
 *
 * Bis CHEAP_UNTIL € Marktwert gilt allein die Margenregel (Chris' eigene Formel
 * 3 x EK + 0,99 liegt dort bei 3,2-fach). Ab EXPENSIVE_FROM € gilt der Deckel von 1,5-fach,
 * dazwischen gleitet der Faktor linear herunter.
 */
export const CHEAP_UNTIL = 5;
export const EXPENSIVE_FROM = 40;
export const CAP_FACTOR_CHEAP = 3.2;
export const CAP_FACTOR_EXPENSIVE = 1.5;
/** Realistische Verkaufszone unter dem Deckel: ab 1,25-fach (statt 1,5-fach) gilt ein Preis noch als marktgerecht. */
export const SELL_ZONE_LOW = 1.25 / 1.5;

/** Hoechster realistischer Aufschlag auf den Marktwert; null = kein Deckel (billige Karten). */
export function marketCapFactor(market: number): number | null {
  if (!(market > CHEAP_UNTIL)) return null;
  if (market >= EXPENSIVE_FROM) return CAP_FACTOR_EXPENSIVE;
  const t = (market - CHEAP_UNTIL) / (EXPENSIVE_FROM - CHEAP_UNTIL);
  return CAP_FACTOR_CHEAP + (CAP_FACTOR_EXPENSIVE - CAP_FACTOR_CHEAP) * t;
}

export interface MarketTargetRange extends TargetRange {
  /** Der Marktdeckel hat die Spanne begrenzt (33 %-Preis oder auch 25 %-Preis liegen darueber). */
  capped: boolean;
  /** Ist die 25-%-Marge bei realistischem Preis erreichbar? Nein = der Markt gibt fuer diese Karte nicht mehr her. */
  marginReachable: boolean;
}

/**
 * Zielspanne bei Nachkauf zum Marktwert `market`: Margenregel (25-33 %) begrenzt durch den Marktdeckel.
 * Ist 25 % nicht erreichbar, ist die Spanne die Verkaufszone unter dem Deckel (1,25- bis 1,5-fach).
 */
export function computeMarketTargetRange(market: number, ctx: TargetContext, settings: CostSettingsValues): MarketTargetRange {
  const base = computeTargetRange(market, ctx, settings);
  const factor = marketCapFactor(market);
  if (factor === null) return { ...base, capped: false, marginReachable: true };
  const cap = Math.max(PRICE_FLOOR, factor * market);
  if (base.min <= cap) {
    // Mindestens 6 % Breite, damit die Spanne am Uebergang nicht zu einem Strich zusammenfaellt.
    const opt = Math.max(Math.min(base.opt, cap), base.min * 1.06);
    return { min: base.min, opt, capped: base.opt > cap, marginReachable: true };
  }
  return { min: Math.max(PRICE_FLOOR, SELL_ZONE_LOW * cap), opt: cap, capped: true, marginReachable: false };
}

/**
 * Preis-Korridor MIN/GUT plus Deckungsbeitrags-Grenze (Chris, 13.10.: 25 % Deckungsbeitrags-
 * Marge als Minimum, 33 % als Optimum):
 * VK-MIN = VK fuer 25 % Marge vor Fixkosten, VK-GUT = VK fuer 33 %, jeweils mit dem EK des
 * Artikels, den Gebuehren AM ZIELPREIS (geschlossene Form) und mindestens 4,99 €.
 * VK-DB  = (HK ohne Fixkosten + 0,35) / (1 - Gebuehrensatz)  (Gewinn vor Fixkosten = 0)
 *
 * Der HK wird als HkBreakdown uebergeben (nicht nur als Summe), weil die
 * Deckungsbeitrags-Linie den Fixkostenanteil herausrechnen muss.
 */
export function computePriceCorridor(
  hk: HkBreakdown,
  currentVk: number,
  settings: CostSettingsValues,
  ctx: TargetContext
): PriceCorridor {
  const currentVkFees = computeEbayFees(currentVk, settings.adFeeRateGood, settings);
  const feeRate = (settings.ebayCommissionRate + settings.adFeeRateGood) * (1 + settings.ebayCommissionVat);
  const feeFixed = settings.ebayCommissionFixed;
  const hkContribution = hk.total - hk.fixedCostShare;
  const range = computeTargetRange(hk.ek, ctx, settings);
  return {
    hk: hk.total,
    currentVkFees,
    vkMin: range.min,
    vkGood: range.opt,
    hkContribution,
    vkContribution: feeRate < 1 ? (hkContribution + feeFixed) / (1 - feeRate) : Infinity,
    targetMargin: DB_MARGIN_MIN,
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

export type PriceStatus = "unter_min" | "im_korridor" | "ueber_gut";

/**
 * Status "zu guenstig / im Korridor / zu teuer" fuer den Ampel-Pill: unter VK-MIN (25 %
 * Deckungsbeitrag, minus Toleranz) = unter_min, ueber VK-GUT (33 %, plus Toleranz) = ueber_gut.
 * Liegt der VK sogar unter der Deckungsbeitrags-Grenze, verliert jeder Verkauf echtes Geld —
 * das ist ebenfalls `unter_min`, steht aber ueber `vkContribution` ablesbar im Korridor.
 */
export function classifyPriceStatus(vk: number, corridor: PriceCorridor): PriceStatus {
  if (vk > corridor.vkGood * (1 + RANGE_TOLERANCE)) return "ueber_gut";
  if (vk >= corridor.vkMin * (1 - RANGE_TOLERANCE)) return "im_korridor";
  return "unter_min";
}

/**
 * Zielpreis fuer eine Deckungsbeitrags-Marge (Marge VOR Fixkosten, also nach Ware,
 * Einkaufs-Versand, Versand, Verpackung, Einschreiben und eBay-Gebuehren).
 * Chris, 13.10.: "25 % Deckungsbeitragsmarge als Minimum, 33 % waeren das Optimum."
 *
 * Geschlossene Form statt Schaetzung zum aktuellen VK (die Gebuehren haengen am
 * Zielpreis selbst):
 *   VK x (1 - Gebuehrensatz - m) = Fixgebuehr + HK ohne Fixkosten
 * Das Einschreiben haengt ebenfalls am VK (ab Schwelle voller Satz); deshalb wird
 * es bis zur Konsistenz iteriert (hoechstens vier Schritte).
 *
 * `ek` ist der EK der Verkaufseinheit (bei Pack bereits Pack-EK). Null, wenn die
 * Marge mit dieser Kostenstruktur nicht erreichbar ist (Gebuehrensatz + m >= 1).
 */
export function targetPriceForMargin(
  input: Omit<HkInput, "vk" | "fixedCostPerUnit">,
  margin: number,
  adRate: number,
  settings: CostSettingsValues
): number | null {
  const feeRate = (settings.ebayCommissionRate + adRate) * (1 + settings.ebayCommissionVat);
  const denom = 1 - feeRate - margin;
  if (!(denom > 0)) return null;

  let vk: number | null = null;
  let guess: number | null = null;
  for (let i = 0; i < 4; i++) {
    const hk = computeHk({ ...input, fixedCostPerUnit: 0, vk: guess }, settings);
    const next = (settings.ebayCommissionFixed + hk.total) / denom;
    if (vk !== null && Math.abs(next - vk) < 0.005) {
      vk = next;
      break;
    }
    vk = next;
    guess = next;
  }
  return vk;
}

/** Deckungsbeitrags-Marge (vor Fixkosten) bei einem VK, EK der Verkaufseinheit gegeben. */
export function contributionMarginForPrice(
  vk: number,
  input: Omit<HkInput, "vk" | "fixedCostPerUnit">,
  adRate: number,
  settings: CostSettingsValues
): number {
  if (!(vk > 0)) return 0;
  const hk = computeHk({ ...input, fixedCostPerUnit: 0, vk }, settings);
  const fees = computeEbayFees(vk, adRate, settings);
  return (vk - fees.total - hk.total) / vk;
}
