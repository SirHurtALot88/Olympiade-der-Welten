/**
 * Konfigurierbare Kostensaetze fuer die VK-Kalkulation (KONZEPT.md Abschnitt 7.3),
 * Default-Werte aus `VK Preis Kalkulator`, korrigiert gegen Chris' bestaetigte
 * Betriebszahlen (Stand 10/2026). Gespiegelt im Prisma-Model `CostSettings` —
 * dieses Modul haelt die Werte auch ohne DB-Zugriff bereit (z. B. fuer reine
 * Berechnungs-Tests).
 *
 * Betriebszahlen hinter den Defaults (von Chris bestaetigt, nicht raten):
 * - ca. 3.400 verkaufte Stueck/Jahr in 1.980 Verkaufs-Bestellungen (Ø 1,72 Artikel/Bestellung)
 * - ca. 840 Einkaufs-Bestellungen/Jahr (Ø 2-5 Artikel)
 * - Jahresfixkosten laut EUeR (Lexoffice) ca. 4.179 EUR: Abos 2.340 (eBay-Shop 1.140 + Billbee 840 +
 *   Lexoffice 360) + Verpackungslizenzen 50 + Sonstige 1.839 (Telekom 540, AfA 199, Beitraege 141,
 *   Steuerberatung 16, Zinsen 24, Raumkosten 919 — Raumkosten bucht Chris erst zum Jahresende)
 * - EUeR 2025: 1.994 Rechnungen, 24.181,19 EUR Umsatz; 2026 bis Q3: 1.277 Rechnungen, 18.158,31 EUR
 * - 100 Einschreiben-Marken auf ca. 1.703 Bestellungen/Jahr = 5,9 % der Sendungen
 * - Kleinunternehmer (§19 UStG): Brutto-Modell ist korrekt, KEINE Umsatzsteuer-Logik.
 */
export interface CostSettingsValues {
  /** Einkaufs-Bestellporto bei < 5 Stk. Rechnungswert, wird NICHT direkt je Stueck angesetzt (siehe buyShippingShareFactor). */
  buyShippingUnderFive: number;
  /**
   * Einkaufs-Bestellporto ab 5 Stk. Rechnungswert.
   * Hinweis: Aktuell toter Zweig — `purchaseQty` wird nirgends >= 5 uebergeben
   * (importPlan setzt defaultPurchaseQty = 3). Bewusst nicht entfernt.
   */
  buyShippingFive: number;
  /**
   * Anteil des Einkaufs-Bestellportos, der je verkaufter Einheit einkalkuliert wird
   * (Chris: "ich kalkuliere beim einkauf den versand zu 50% ein"). 0.5 = 50 %.
   */
  buyShippingShareFactor: number;
  shippingSingle: number;
  shippingPack: number;
  /** Kosten je Einschreiben-Einwurf (Marke), EUR. */
  registeredCostPerShipment: number;
  /** Warenkorb-Schwelle (EUR) ab der Chris mit Einschreiben versendet. */
  registeredThreshold: number;
  /** Verbrauchte Einschreiben-Marken pro Jahr (Chris: ca. 100). */
  registeredStampsPerYear: number;
  packagingSingle: number;
  packagingPack: number;
  /** eBay-Shop, EUR pro JAHR (nicht pro Monat!). 95 EUR/Monat = 1140. */
  fixedYearlyEbayShop: number;
  /** Billbee, EUR pro JAHR. 70 EUR/Monat = 840. */
  fixedYearlyBillbee: number;
  /** Lexoffice, EUR pro JAHR. 30 EUR/Monat = 360. */
  fixedYearlyLexoffice: number;
  /** Verpackungslizenzen, EUR pro JAHR (echte Jahreskosten). */
  fixedYearlyPackagingLicense: number;
  /**
   * Sammelfeld: ALLE uebrigen volumenunabhaengigen Jahreskosten aus der EUeR
   * (EUR pro JAHR) — Telekommunikation, AfA, Beitraege/Gebuehren/Versicherungen,
   * Rechts-/Steuerberatung, Schuldzinsen, Raumkosten. Default 1.839 =
   * 540 + 199 + 141 + 16 + 24 + 919. Posten ohne eigenes Feld gehoeren HIER hinein,
   * sonst fehlen sie unsichtbar in der Fixkosten-Umlage.
   */
  fixedYearlyOther: number;
  ebayCommissionRate: number;
  ebayCommissionVat: number;
  ebayCommissionFixed: number;
  adFeeRateSingle: number;
  adFeeRateMin: number;
  adFeeRateGood: number;
}

export const DEFAULT_COST_SETTINGS: CostSettingsValues = {
  buyShippingUnderFive: 1.15,
  buyShippingFive: 1.3,
  buyShippingShareFactor: 0.5,
  shippingSingle: 0.67,
  shippingPack: 0.5,
  registeredCostPerShipment: 2.35,
  registeredThreshold: 30,
  registeredStampsPerYear: 100,
  packagingSingle: 0.053,
  packagingPack: 0.062,
  fixedYearlyEbayShop: 1140,
  fixedYearlyBillbee: 840,
  fixedYearlyLexoffice: 360,
  fixedYearlyPackagingLicense: 50,
  fixedYearlyOther: 1839,
  ebayCommissionRate: 0.11,
  ebayCommissionVat: 0.19,
  ebayCommissionFixed: 0.35,
  adFeeRateSingle: 0.09,
  adFeeRateMin: 0.09,
  adFeeRateGood: 0.1,
};
