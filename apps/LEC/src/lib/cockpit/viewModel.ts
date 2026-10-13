import type { SaleWindowKey } from "../parsing/date";
import {
  buildDashboardViewModel,
  classifyArticles,
  type ArticleAggregate,
  type DashboardViewModel,
} from "../dashboard/viewModel";
import type { CostSettingsValues } from "../pricing/costSettings";
import { totalFixedYearly } from "../pricing/costEngine";
import { computeRunRateBands, type RunRateBands } from "./bands";
import { buildBridge, type Bridge } from "./bridge";
import { computeCapital, type CapitalFacts } from "./capital";
import { classDistribution, priceStatusDistribution, type Distribution, type PriceStatusKey } from "./distribution";
import { computeEkGap, type EkGap } from "./ekGap";
import { buildGuardrails, type BulletGuardrail, type PurchaseFacts } from "./guardrails";
import { buildMovers, type ImageMap, type Movers } from "./movers";
import { computeMarketHints, type MarketHints } from "./marketHints";
import type { LatestQuote } from "../dashboard/marketComparison";
import { PLANWERTE, type Planwerte } from "./planwerte";
import { sumAllWindows, type WindowSums } from "./windowSums";
import type { ArticleClass } from "../pricing/classification";

export const WINDOW_OPTIONS: { key: SaleWindowKey; label: string; long: string }[] = [
  { key: "30", label: "30 T", long: "30 Tage" },
  { key: "90", label: "90 T", long: "90 Tage" },
  { key: "365", label: "365 T", long: "365 Tage" },
  { key: "all", label: "Lebenszeit", long: "Lebenszeit" },
];

export const DEFAULT_WINDOW: SaleWindowKey = "90";

export function parseWindowParam(raw: string | string[] | undefined): SaleWindowKey {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return WINDOW_OPTIONS.some((o) => o.key === v) ? (v as SaleWindowKey) : DEFAULT_WINDOW;
}

export interface ImportStatus {
  kind: string;
  label: string;
  createdAt: Date | null;
  windowFrom: Date | null;
  windowTo: Date | null;
  fileName: string | null;
}

export interface CockpitViewModel {
  window: SaleWindowKey;
  windowLabel: string;
  /** Das bestehende Dashboard-View-Model -- dieselben Zahlen wie `/`. */
  dashboard: DashboardViewModel;
  sums: Record<SaleWindowKey, WindowSums>;
  /** Summen des gewaehlten Fensters. */
  current: WindowSums;
  bands: RunRateBands;
  bridge: Bridge;
  ekGap: EkGap;
  classes: Distribution<ArticleClass>;
  priceStatus: Distribution<PriceStatusKey>;
  movers: Movers;
  guardrails: BulletGuardrail[];
  capital: CapitalFacts;
  market: MarketHints;
  planwerte: Planwerte;
  fixedYearly: number;
  imports: ImportStatus[];
  totals: { articles: number; active: number };
}

export interface CockpitInputs {
  aggregates: ArticleAggregate[];
  costSettings: CostSettingsValues;
  window: SaleWindowKey;
  images?: ImageMap;
  purchases?: PurchaseFacts;
  imports?: ImportStatus[];
  planwerte?: Planwerte;
  /** Juengster Cardmarket-Marktwert je Artikel-ID (MarketPrice). */
  quotes?: ReadonlyMap<string, LatestQuote>;
}

const NO_PURCHASES: PurchaseFacts = { spentInBudgetMonths: null, spentLast90d: null, recordCount: 0 };

/**
 * Baut das Cockpit-View-Model AUF dem bestehenden Dashboard-View-Model auf: `buildDashboardViewModel`
 * liefert Fenster-KPIs, Sortiment-Zeilen (Klasse, Preis-Status, DB-Stufen) und Totes Kapital --
 * das Cockpit rechnet nur Ableitungen (Baender, Bruecke, Verteilungen, Leitplanken) obendrauf.
 * So stimmen beide Seiten per Konstruktion ueberein.
 */
export function buildCockpitViewModel(input: CockpitInputs): CockpitViewModel {
  const { aggregates, costSettings, window } = input;
  const images: ImageMap = input.images ?? new Map();
  const purchases = input.purchases ?? NO_PURCHASES;
  const planwerte = input.planwerte ?? PLANWERTE;

  const dashboard = buildDashboardViewModel(aggregates, costSettings);
  const classified = classifyArticles(aggregates);
  const sums = sumAllWindows(aggregates);
  const bands = computeRunRateBands(sums);

  return {
    window,
    windowLabel: WINDOW_OPTIONS.find((o) => o.key === window)?.long ?? window,
    dashboard,
    sums,
    current: sums[window],
    bands,
    bridge: buildBridge(sums[window]),
    ekGap: computeEkGap(aggregates),
    classes: classDistribution(dashboard.sortiment),
    priceStatus: priceStatusDistribution(dashboard.sortiment),
    movers: buildMovers(aggregates, classified, window, images),
    guardrails: buildGuardrails(sums["365"], purchases, planwerte),
    capital: computeCapital(aggregates, bands, purchases),
    market: computeMarketHints(aggregates, input.quotes ?? new Map(), costSettings, images),
    planwerte,
    fixedYearly: totalFixedYearly(costSettings),
    imports: input.imports ?? [],
    totals: { articles: aggregates.length, active: aggregates.filter((a) => a.active).length },
  };
}
