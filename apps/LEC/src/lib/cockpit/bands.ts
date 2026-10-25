import type { SaleWindowKey } from "../parsing/date";
import type { WindowSums } from "./windowSums";

/**
 * Run-Rate-Baender (COCKPIT_V2_KONZEPT §4.2): Die Billbee-Fenster sind verschachtelt
 * (30 ⊂ 90 ⊂ 365). Daraus folgen drei DISJUNKTE Zeitbaender, deren Ø/Monat ehrlich zeigt, ob
 * das Tempo anzieht oder nachlaesst -- ohne eine Tagesreihe zu erfinden, die die Daten nicht haben.
 *
 *   A  Tage 1–30     Ø/Monat = W30
 *   B  Tage 31–90    Ø/Monat = (W90 − W30) / 2
 *   C  Tage 91–365   Ø/Monat = (W365 − W90) / (275 / 30)
 */
export type BandKey = "a" | "b" | "c";

export interface RunRateBand {
  key: BandKey;
  /** Kurzlabel fuer Achsen ("1–30 T"). */
  label: string;
  /** Langlabel fuer Tooltips/Tabelle. */
  longLabel: string;
  /** Laenge des Bandes in Monaten (30 Tage = 1 Monat). */
  months: number;
  /** Ø je Monat im Band. */
  revenuePerMonth: number;
  qtyPerMonth: number;
  ekPerMonth: number;
  dbIIPerMonth: number;
  dbIIIPerMonth: number;
  /** true, wenn eine Fensterdifferenz negativ war und auf 0 geklemmt wurde (inkonsistente Importe). */
  clamped: boolean;
}

export interface RunRateBands {
  bands: RunRateBand[];
  /** Mindestens ein Band wurde geklemmt -> Hinweis in der UI. */
  anyClamped: boolean;
  /** false, wenn kein 30/90/365-Fenster vorliegt (dann sind alle Baender 0). */
  available: boolean;
}

const BAND_DEFS: { key: BandKey; label: string; longLabel: string; months: number; upper: SaleWindowKey; lower: SaleWindowKey | null }[] = [
  { key: "a", label: "1–30 T", longLabel: "letzte 30 Tage", months: 1, upper: "30", lower: null },
  { key: "b", label: "31–90 T", longLabel: "Tage 31 bis 90", months: 2, upper: "90", lower: "30" },
  { key: "c", label: "91–365 T", longLabel: "Tage 91 bis 365", months: 275 / 30, upper: "365", lower: "90" },
];

function diff(upper: number, lower: number): { value: number; clamped: boolean } {
  const d = upper - lower;
  return d < 0 ? { value: 0, clamped: true } : { value: d, clamped: false };
}

export function computeRunRateBands(sums: Record<SaleWindowKey, WindowSums>): RunRateBands {
  const available = sums["30"].qty > 0 || sums["90"].qty > 0 || sums["365"].qty > 0;
  let anyClamped = false;
  const bands = BAND_DEFS.map((def) => {
    const up = sums[def.upper];
    const lo = def.lower ? sums[def.lower] : null;
    let clamped = false;
    // Nur Mengen/Umsatz/Wareneinsatz koennen bei konsistenten Fenstern nicht sinken -- DB II/III
    // duerfen es (Verluste), die werden deshalb nicht geklemmt.
    const take = (field: "revenue" | "qty" | "ek") => {
      const d = diff(up[field], lo ? lo[field] : 0);
      if (d.clamped) clamped = true;
      return d.value / def.months;
    };
    const revenuePerMonth = take("revenue");
    const qtyPerMonth = take("qty");
    const ekPerMonth = take("ek");
    const dbIIPerMonth = (up.dbII - (lo ? lo.dbII : 0)) / def.months;
    const dbIIIPerMonth = (up.dbIII - (lo ? lo.dbIII : 0)) / def.months;
    if (clamped) anyClamped = true;
    return {
      key: def.key,
      label: def.label,
      longLabel: def.longLabel,
      months: def.months,
      revenuePerMonth,
      qtyPerMonth,
      ekPerMonth,
      dbIIPerMonth,
      dbIIIPerMonth,
      clamped,
    };
  });
  return { bands, anyClamped, available };
}

/** Ø Umsatz je Monat des juengsten Bandes (A) -- Kurzgriff fuer KPI-Unterzeilen. */
export function latestBand(bands: RunRateBands): RunRateBand {
  return bands.bands[0];
}
