/**
 * Konfigurierbare Kostensaetze fuer die VK-Kalkulation (KONZEPT.md Abschnitt 7.3),
 * Default-Werte aus `VK Preis Kalkulator`. Gespiegelt im Prisma-Model
 * `CostSettings` — dieses Modul haelt die Werte auch ohne DB-Zugriff bereit
 * (z. B. fuer reine Berechnungs-Tests).
 */
export interface CostSettingsValues {
  buyShippingUnderFive: number;
  buyShippingFive: number;
  shippingSingle: number;
  shippingPack: number;
  registeredSingle: number;
  registeredPack: number;
  packagingSingle: number;
  packagingPack: number;
  fixedYearlyEbayShop: number;
  fixedYearlyBillbee: number;
  fixedYearlyLexoffice: number;
  ebayCommissionRate: number;
  ebayCommissionVat: number;
  ebayCommissionFixed: number;
  adFeeRateSingle: number;
  adFeeRateMin: number;
  adFeeRateGood: number;
  marginMinMultiplier: number;
  marginGoodMultiplier: number;
}

export const DEFAULT_COST_SETTINGS: CostSettingsValues = {
  buyShippingUnderFive: 1.15,
  buyShippingFive: 1.3,
  shippingSingle: 0.67,
  shippingPack: 0.5,
  registeredSingle: 0.15,
  registeredPack: 0.1875,
  packagingSingle: 0.053,
  packagingPack: 0.062,
  fixedYearlyEbayShop: 95,
  fixedYearlyBillbee: 25,
  fixedYearlyLexoffice: 60,
  ebayCommissionRate: 0.11,
  ebayCommissionVat: 0.19,
  ebayCommissionFixed: 0.35,
  adFeeRateSingle: 0.09,
  adFeeRateMin: 0.09,
  adFeeRateGood: 0.1,
  marginMinMultiplier: 1.33,
  marginGoodMultiplier: 1.66,
};
