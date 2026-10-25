import type { Planwerte } from "./planwerte";
import type { WindowSums } from "./windowSums";

/**
 * Leitplanken als Bullet-Graph-Daten (COCKPIT_V2_KONZEPT §5): Ist-Balken, Marken, Baender.
 * Alle "Jahres"-Groessen sind ROLLIEREND 365 T -- die Importe kennen kein Kalenderjahr. Das steht
 * in `basisHinweis` und wird in der UI angezeigt, nicht versteckt.
 */
export type BandTone = "neutral" | "good" | "warn" | "crit";

export interface BulletBand {
  from: number;
  to: number;
  tone: BandTone;
  label: string;
}

export interface BulletMarker {
  value: number;
  label: string;
}

export interface BulletGuardrail {
  key: "umsatz" | "ergebnis" | "warenbudget";
  title: string;
  /** Ist-Wert; null = keine Datenbasis (leerer Zustand). */
  value: number | null;
  /** Einheit fuer die Beschriftung. */
  unit: "€";
  /** Achsen-Maximum (>= groesste Marke/Band). */
  axisMax: number;
  /** Achsen-Minimum (0 oder negativ bei Verlust). */
  axisMin: number;
  bands: BulletBand[];
  markers: BulletMarker[];
  /** Status des Ist-Werts, ausgewertet gegen die Baender. */
  tone: BandTone;
  /** Eine Zeile Klartext zur Datenbasis -- IMMER sichtbar. */
  basisHinweis: string;
  /** Leerer Zustand, wenn value === null. */
  emptyHinweis?: string;
}

export interface PurchaseFacts {
  /** Summe Einkaeufe (qty × unitEk + buyShipping) in den Warenbudget-Monaten des Planjahrs; null = keine Purchase-Daten. */
  spentInBudgetMonths: number | null;
  /** Summe Einkaeufe der letzten 90 Tage; null = keine Daten. */
  spentLast90d: number | null;
  /** Anzahl Purchase-Datensaetze insgesamt. */
  recordCount: number;
}

function toneFor(value: number, bands: BulletBand[]): BandTone {
  const hit = bands.find((b) => value >= b.from && value < b.to) ?? bands[bands.length - 1];
  return hit?.tone ?? "neutral";
}

export function buildGuardrails(
  sums365: WindowSums,
  purchases: PurchaseFacts,
  plan: Planwerte
): BulletGuardrail[] {
  const umsatzBands: BulletBand[] = [
    { from: 0, to: plan.umsatzArbeitsgrenzeEur, tone: "good", label: "unter Arbeitsgrenze" },
    { from: plan.umsatzArbeitsgrenzeEur, to: plan.kleinunternehmerGrenzeEur, tone: "warn", label: "über Arbeitsgrenze" },
    { from: plan.kleinunternehmerGrenzeEur, to: Number.POSITIVE_INFINITY, tone: "crit", label: "über Kleinunternehmergrenze" },
  ];
  const umsatz: BulletGuardrail = {
    key: "umsatz",
    title: "Umsatz vs. Kleinunternehmergrenze",
    value: sums365.qty > 0 ? sums365.revenue : null,
    unit: "€",
    axisMin: 0,
    axisMax: Math.max(plan.kleinunternehmerGrenzeEur * 1.1, sums365.revenue * 1.05),
    bands: umsatzBands,
    markers: [
      { value: plan.umsatzArbeitsgrenzeEur, label: "Arbeitsgrenze" },
      { value: plan.kleinunternehmerGrenzeEur, label: "§ 19 UStG" },
    ],
    tone: sums365.qty > 0 ? toneFor(sums365.revenue, umsatzBands) : "neutral",
    basisHinweis: "Umsatz rollierend 365 T aus dem Billbee-Fenster — nicht Kalenderjahr, nicht Zufluss nach EÜR.",
    emptyHinweis: "Kein 365-Tage-Fenster importiert.",
  };

  const k = plan.gewinnZielkorridorEur;
  const ergebnisBands: BulletBand[] = [
    { from: Number.NEGATIVE_INFINITY, to: 0, tone: "crit", label: "Verlust" },
    { from: 0, to: plan.gewinnPrognoseFinanzamtEur, tone: "warn", label: "unter Prognose" },
    { from: plan.gewinnPrognoseFinanzamtEur, to: k.von, tone: "neutral", label: "über Prognose, unter Ziel" },
    { from: k.von, to: k.bis, tone: "good", label: "Zielkorridor" },
    { from: k.bis, to: Number.POSITIVE_INFINITY, tone: "warn", label: "über Ziel (Treppe 2027)" },
  ];
  const dbIII = sums365.dbIII;
  const ergebnis: BulletGuardrail = {
    key: "ergebnis",
    title: "Ergebnis-Proxy DB III vs. Gewinnkorridor",
    value: sums365.qty > 0 ? dbIII : null,
    unit: "€",
    axisMin: Math.min(0, dbIII * 1.1),
    axisMax: Math.max(k.bis * 1.3, dbIII * 1.1),
    bands: ergebnisBands,
    markers: [
      { value: plan.gewinnPrognoseFinanzamtEur, label: "Prognose Finanzamt" },
      { value: k.von, label: "Ziel von" },
      { value: k.bis, label: "Ziel bis" },
    ],
    tone: sums365.qty > 0 ? toneFor(dbIII, ergebnisBands) : "neutral",
    basisHinweis:
      "DB III rollierend 365 T (DB II − Fixkostenanteil der verkauften Ware). Die EÜR zählt Wareneinkauf im Zahlungsjahr — Abweichung = Einkauf − Wareneinsatz.",
    emptyHinweis: "Kein 365-Tage-Fenster importiert.",
  };

  const budget = plan.warenbudgetNovDezEur;
  const budgetBands: BulletBand[] = [
    { from: 0, to: budget * 0.8, tone: "good", label: "im Budget" },
    { from: budget * 0.8, to: budget, tone: "warn", label: "Budget fast ausgeschöpft" },
    { from: budget, to: Number.POSITIVE_INFINITY, tone: "crit", label: "Budget überschritten" },
  ];
  const spent = purchases.spentInBudgetMonths;
  const monate = plan.warenbudgetMonate.map((m) => MONTH_SHORT[m - 1]).join(" + ");
  const warenbudget: BulletGuardrail = {
    key: "warenbudget",
    title: `Warenbudget ${monate} ${plan.planjahr}`,
    value: spent,
    unit: "€",
    axisMin: 0,
    axisMax: Math.max(budget * 1.25, (spent ?? 0) * 1.1, plan.einkaufsrateNormalEurProMonat * plan.warenbudgetMonate.length * 1.05),
    bands: budgetBands,
    markers: [
      { value: budget, label: "Budget" },
      { value: plan.einkaufsrateNormalEurProMonat * plan.warenbudgetMonate.length, label: "bisherige Rate" },
    ],
    tone: spent === null ? "neutral" : toneFor(spent, budgetBands),
    basisHinweis:
      spent === null
        ? "Einkäufe werden derzeit von keinem Import geliefert — es gibt keine Ist-Zahl, nur die Marken."
        : `Einkäufe (Stk × EK + Porto) mit Datum in ${monate} ${plan.planjahr}, ${purchases.recordCount} Einkaufsdatensätze.`,
    emptyHinweis: "Keine Einkaufsdaten importiert.",
  };

  return [umsatz, ergebnis, warenbudget];
}

const MONTH_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
