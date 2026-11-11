import type { PrismaClient } from "@prisma/client";
import { computeEbayFees } from "./costEngine";
import type { CostSettingsValues } from "./costSettings";

export interface FeeCheckBand {
  label: string;
  units: number;
  revenue: number;
  /** Echter Gebuehrensatz aus den eBay-Verkaufsberichten (Gebuehren / Umsatz). */
  actualRate: number | null;
  /** Satz laut Kostenmodell beim mittleren Stueckpreis des Bandes. */
  modelRate: number;
}

const BANDS = [
  { label: "unter 5 €", lo: 0, hi: 5 },
  { label: "5 – 15 €", lo: 5, hi: 15 },
  { label: "15 – 40 €", lo: 15, hi: 40 },
  { label: "ab 40 €", lo: 40, hi: Infinity },
];

/** Echter gegen modellierten eBay-Gebuehrensatz je Preisband (reine Rechnung, getestet). */
export function feeCheckBands(
  facts: { qtySold: number; totalRevenueGross: number; totalSellingCosts: number }[],
  settings: CostSettingsValues
): FeeCheckBand[] {
  return BANDS.map((b) => {
    const inBand = facts.filter((f) => f.qtySold > 0 && f.totalRevenueGross > 0 && f.totalRevenueGross / f.qtySold >= b.lo && f.totalRevenueGross / f.qtySold < b.hi);
    const units = inBand.reduce((s, f) => s + f.qtySold, 0);
    const revenue = inBand.reduce((s, f) => s + f.totalRevenueGross, 0);
    const fees = inBand.reduce((s, f) => s + f.totalSellingCosts, 0);
    const meanPrice = units > 0 ? revenue / units : Number.isFinite(b.hi) ? (b.lo + b.hi) / 2 : b.lo * 1.5;
    return {
      label: b.label,
      units,
      revenue,
      actualRate: revenue > 0 ? fees / revenue : null,
      modelRate: computeEbayFees(meanPrice, settings.adFeeRateGood, settings).total / meanPrice,
    };
  });
}

export async function loadFeeCheck(prisma: PrismaClient, settings: CostSettingsValues): Promise<FeeCheckBand[]> {
  const facts = await prisma.ebayListingFact.findMany({ select: { qtySold: true, totalRevenueGross: true, totalSellingCosts: true } });
  return feeCheckBands(facts, settings);
}
