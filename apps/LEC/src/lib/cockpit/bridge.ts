import type { WindowSums } from "./windowSums";

/**
 * Deckungsbeitrags-Bruecke (Waterfall) eines Fensters -- COCKPIT_V2_KONZEPT §4 Modul 6.
 *
 *   Umsatz → − Wareneinsatz → DB I → − eBay-Gebuehren → − Versand/Verpackung → DB II
 *          → − Fixkostenanteil → DB III
 *
 * Es wird NICHTS neu berechnet: DB I/II kommen aus den gespeicherten Fenster-Snapshots
 * (importPlan.ts), die Abzuege sind die dort mitgespeicherten Kostenbloecke. `rest` faengt die
 * Differenz ab, falls DB I/II in der DB nicht exakt Umsatz − Bloecke entsprechen (z. B. aeltere
 * Snapshots mit anderem Kostenmodell) -- dann steht die Luecke sichtbar in der Bruecke statt
 * stillschweigend in einer Summe zu verschwinden.
 */
export type BridgeStepKind = "total" | "minus";

export interface BridgeStep {
  key: "umsatz" | "ware" | "dbI" | "ebay" | "versand" | "rest" | "dbII" | "fix" | "dbIII";
  label: string;
  kind: BridgeStepKind;
  /** Betrag des Schritts: bei "total" der Stand, bei "minus" der (positive) Abzug. */
  value: number;
  /** Stand NACH diesem Schritt (fuer die Balkenposition im Waterfall). */
  runningAfter: number;
  /** Anteil am Umsatz (0..1), fuer die Beschriftung. */
  shareOfRevenue: number;
}

export interface Bridge {
  steps: BridgeStep[];
  revenue: number;
  /** Maximaler Stand (fuer die Achsenskalierung). */
  max: number;
  /** Minimaler Stand (DB III kann negativ sein). */
  min: number;
}

export function buildBridge(sums: WindowSums): Bridge {
  const revenue = sums.revenue;
  const share = (v: number) => (revenue > 0 ? v / revenue : 0);
  const ware = sums.ek;
  const dbI = sums.dbI;
  const ebay = sums.ebayFeeTotal;
  const versand = sums.shippingCost;
  const dbII = sums.dbII;
  // Rest = Abweichung zwischen (DB I − eBay − Versand) und gespeichertem DB II. Normal 0.
  const rest = dbI - ebay - versand - dbII;
  const fix = sums.fixedCostShare;
  const dbIII = sums.dbIII;

  const steps: BridgeStep[] = [
    { key: "umsatz", label: "Umsatz", kind: "total", value: revenue, runningAfter: revenue, shareOfRevenue: 1 },
    { key: "ware", label: "Wareneinsatz", kind: "minus", value: ware, runningAfter: revenue - ware, shareOfRevenue: share(ware) },
    { key: "dbI", label: "DB I", kind: "total", value: dbI, runningAfter: dbI, shareOfRevenue: share(dbI) },
    { key: "ebay", label: "eBay-Gebühren", kind: "minus", value: ebay, runningAfter: dbI - ebay, shareOfRevenue: share(ebay) },
    { key: "versand", label: "Versand & Verpackung", kind: "minus", value: versand, runningAfter: dbI - ebay - versand, shareOfRevenue: share(versand) },
  ];
  if (Math.abs(rest) >= 0.5) {
    steps.push({ key: "rest", label: "Sonstige Differenz", kind: "minus", value: rest, runningAfter: dbII, shareOfRevenue: share(rest) });
  }
  steps.push(
    { key: "dbII", label: "DB II", kind: "total", value: dbII, runningAfter: dbII, shareOfRevenue: share(dbII) },
    { key: "fix", label: "Fixkostenanteil", kind: "minus", value: fix, runningAfter: dbII - fix, shareOfRevenue: share(fix) },
    { key: "dbIII", label: "DB III", kind: "total", value: dbIII, runningAfter: dbIII, shareOfRevenue: share(dbIII) }
  );

  const positions = steps.flatMap((s) => (s.kind === "total" ? [s.value, 0] : [s.runningAfter, s.runningAfter + s.value]));
  const max = Math.max(0, ...positions);
  const min = Math.min(0, ...positions);
  return { steps, revenue, max, min };
}
