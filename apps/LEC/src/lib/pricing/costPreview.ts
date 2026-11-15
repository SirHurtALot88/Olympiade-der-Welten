import {
  computeHk,
  computePriceCorridor,
  classifyPriceStatus,
  contributionMarginAt,
  fixedCostPerUnit,
  fullCostMarginAt,
  registeredRateBelowThreshold,
  totalFixedYearly,
  type HkBreakdown,
  type ItemKind,
  type PriceCorridor,
  type PriceStatus,
  type ShopVolume,
} from "./costEngine";
import type { CostSettingsValues } from "./costSettings";

/**
 * Rechenkern der Live-Vorschau auf /einstellungen. Bewusst KEIN eigener Rechenweg:
 * dieselben Engine-Funktionen mit denselben Eingaben wie `buildSortimentRow`
 * (shopweite Fixkosten, VK-abhaengiges Einschreiben, Korridor inkl.
 * Deckungsbeitrags-Grenze) — sonst widerspraeche die Vorschau Dashboard und Sortiment.
 */
export interface PreviewExample {
  label: string;
  kind: ItemKind;
  ek: number;
  vk: number;
}

/** Die zwei Vorschau-Beispiele: je eines UNTER und ÜBER der Einschreiben-Schwelle. */
export const PREVIEW_EXAMPLES: PreviewExample[] = [
  { label: "Günstige Karte", kind: "single", ek: 0.9, vk: 4.99 },
  { label: "Teure Karte", kind: "single", ek: 12, vk: 35 },
];

export interface CostPreview {
  example: PreviewExample;
  hk: HkBreakdown;
  /** HK ohne Fixkostenanteil (Basis der Deckungsbeitrags-Linie). */
  hkContribution: number;
  corridor: PriceCorridor;
  /** Marge vor Fixkosten / nach Fixkosten bei dem Beispiel-VK (Anteil, 0.22 = 22 %). */
  contributionMargin: number;
  fullMargin: number;
  status: PriceStatus;
}

export function buildCostPreview(
  example: PreviewExample,
  settings: CostSettingsValues,
  shop: ShopVolume | null
): CostPreview {
  const hk = computeHk(
    {
      ek: example.ek,
      kind: example.kind,
      fixedCostPerUnit: fixedCostPerUnit(shop?.units365d ?? 0, settings),
      vk: example.vk,
      shop,
    },
    settings
  );
  const corridor = computePriceCorridor(hk, example.vk, settings, { kind: example.kind, shop });
  return {
    example,
    hk,
    hkContribution: corridor.hkContribution,
    corridor,
    contributionMargin: contributionMarginAt(example.vk, corridor),
    fullMargin: fullCostMarginAt(example.vk, corridor),
    status: classifyPriceStatus(example.vk, corridor),
  };
}

/** Abgeleitete Kennzahlen: die Zahlen, die Chris zum Gegenrechnen braucht. */
export interface DerivedCostFacts {
  fixedYearlyTotal: number;
  fixedMonthlyTotal: number;
  /** N: Stueck der letzten 365 Tage laut Import, null = kein Import. */
  shopUnits: number | null;
  /** Fixkosten je verkaufter Einheit (Jahressumme / N), null ohne Import. */
  fixedPerUnit: number | null;
  /** Marken pro Jahr x Kosten je Marke. */
  registeredYearlyCost: number;
  /** N_T: Stueck mit VK >= Schwelle, null = unbekannt. */
  unitsAtOrAboveThreshold: number | null;
  /** r: Einschreiben-Anteil je Stueck unter der Schwelle, null ohne Import. */
  registeredRateBelow: number | null;
  /** Einkaufs-Versand wirksam je Einheit: Bestellporto x Anteil. */
  buyShippingEffectiveUnderFive: number;
  buyShippingEffectiveFive: number;
}

export function deriveCostFacts(settings: CostSettingsValues, shop: ShopVolume | null): DerivedCostFacts {
  const hasShop = !!shop && shop.units365d > 0;
  return {
    fixedYearlyTotal: totalFixedYearly(settings),
    fixedMonthlyTotal: totalFixedYearly(settings) / 12,
    shopUnits: hasShop ? shop!.units365d : null,
    fixedPerUnit: hasShop ? fixedCostPerUnit(shop!.units365d, settings) : null,
    registeredYearlyCost: settings.registeredStampsPerYear * settings.registeredCostPerShipment,
    unitsAtOrAboveThreshold: hasShop ? shop!.unitsAtOrAboveThreshold : null,
    registeredRateBelow: hasShop ? registeredRateBelowThreshold(shop, settings) : null,
    buyShippingEffectiveUnderFive: settings.buyShippingUnderFive * settings.buyShippingShareFactor,
    buyShippingEffectiveFive: settings.buyShippingFive * settings.buyShippingShareFactor,
  };
}

/** Eine Zeile des Vergleichs "feste Stueckwerte" gegen "nach Volumen". */
export interface CostModelRow {
  label: string;
  oldValue: number;
  newValue: number;
}
export interface CostModelComparison {
  rows: CostModelRow[];
  /** Nebenkosten ohne EK (alles ausser dem Einkaufspreis), je Stueck. */
  oldTotal: number;
  newTotal: number;
  /** Empfohlener VK-Mindestpreis fuer das Beispiel (VK-MIN) im alten und neuen Modus. */
  oldVkMin: number;
  newVkMin: number;
}

/**
 * Vergleicht die zwei Kalkulationsarten fuer ein Beispiel mit dem echten Verkaufsvolumen: alt = feste Stueckwerte, neu = Jahreskosten
 * geteilt durch die verkauften Stueck (Chris, 14.11.2026). Gleiche Engine-Funktionen wie Dashboard und Sortiment.
 */
export function compareCostModels(example: PreviewExample, settings: CostSettingsValues, shop: ShopVolume | null): CostModelComparison {
  const oldS: CostSettingsValues = { ...settings, volumeBasedCosts: false };
  const newS: CostSettingsValues = { ...settings, volumeBasedCosts: true };
  const a = buildCostPreview(example, oldS, shop);
  const b = buildCostPreview(example, newS, shop);
  const parts = (pv: CostPreview) => ({
    buyShipping: pv.hk.buyShipping,
    shipping: pv.hk.shipping,
    registeredMail: pv.hk.registeredMail,
    packaging: pv.hk.packaging,
    fixedCostShare: pv.hk.fixedCostShare,
  });
  const pa = parts(a);
  const pb = parts(b);
  return {
    rows: [
      { label: "Einkaufs-Versand", oldValue: pa.buyShipping, newValue: pb.buyShipping },
      { label: "Versand Inland", oldValue: pa.shipping, newValue: pb.shipping },
      { label: "Einschreiben", oldValue: pa.registeredMail, newValue: pb.registeredMail },
      { label: "Verpackung", oldValue: pa.packaging, newValue: pb.packaging },
      { label: "Fixkosten-Anteil", oldValue: pa.fixedCostShare, newValue: pb.fixedCostShare },
    ],
    oldTotal: a.hk.total - a.hk.ek,
    newTotal: b.hk.total - b.hk.ek,
    oldVkMin: a.corridor.vkMin,
    newVkMin: b.corridor.vkMin,
  };
}
