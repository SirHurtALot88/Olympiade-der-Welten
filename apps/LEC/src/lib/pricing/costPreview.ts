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
  const corridor = computePriceCorridor(hk, example.vk, settings);
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
