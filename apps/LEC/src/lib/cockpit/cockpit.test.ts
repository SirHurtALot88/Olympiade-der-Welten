import { describe, expect, it } from "vitest";
import type { ArticleAggregate, WindowAggregate } from "../dashboard/viewModel";
import { buildDashboardViewModel } from "../dashboard/viewModel";
import { DEFAULT_COST_SETTINGS } from "../pricing/costSettings";
import { computeRunRateBands } from "./bands";
import { buildBridge } from "./bridge";
import { computeCapital } from "./capital";
import { classDistribution, priceStatusDistribution } from "./distribution";
import { computeEkGap } from "./ekGap";
import { buildGuardrails } from "./guardrails";
import { buildMovers, imageUrlFor } from "./movers";
import { PLANWERTE } from "./planwerte";
import { buildCockpitViewModel, parseWindowParam } from "./viewModel";
import { sumAllWindows, sumWindow } from "./windowSums";

function win(qty: number, revenue: number, ek: number, fees = 0, ship = 0, fix = 0): WindowAggregate {
  const dbI = revenue - ek;
  const dbII = dbI - fees - ship;
  return { qty, revenue, ek, ebayFeeTotal: fees, shippingCost: ship, dbI, dbII, fixedCostShare: fix, avgPrice: qty > 0 ? revenue / qty : 0, rank: null };
}

function article(id: string, windows: ArticleAggregate["windows"], extra: Partial<ArticleAggregate> = {}): ArticleAggregate {
  return {
    articleId: id,
    nameRaw: `Yu-Gi-Oh! TEST-DE0${id} Karte ${id}`,
    setCode: `TEST-DE0${id}`,
    packQty: 1,
    stock: 0,
    active: false,
    currentVk: null,
    currentEk: null,
    latestMarketTrend: null,
    windows,
    ...extra,
  };
}

// Vier erfundene Artikel, verschachtelte Fenster (30 ⊂ 90 ⊂ 365 ⊂ all).
const ARTICLES: ArticleAggregate[] = [
  // Renner mit EK, aktiv, Bestand.
  article(
    "1",
    { "30": win(4, 40, 12, 10, 3, 4), "90": win(10, 100, 30, 25, 7, 10), "365": win(30, 300, 90, 75, 21, 30), all: win(40, 400, 120, 100, 28, 40) },
    { active: true, stock: 10, currentVk: 10, currentEk: 3 }
  ),
  // Aktiv ohne jeden EK (EK-Luecke), verkauft sich in 90 T.
  article(
    "2",
    { "30": win(1, 5, 0, 1.5, 0.7, 1), "90": win(3, 15, 0, 4.5, 2.1, 3), "365": win(6, 30, 0, 9, 4.2, 6), all: win(6, 30, 0, 9, 4.2, 6) },
    { active: true, stock: 5, currentVk: 5, currentEk: null }
  ),
  // Verlustbringer (DB II negativ), inaktiv.
  article("3", { "90": win(2, 6, 8, 2, 1.4, 2), "365": win(5, 15, 20, 5, 3.5, 5), all: win(5, 15, 20, 5, 3.5, 5) }),
  // Ladenhueter: Historie, aber 0 in 365 T.
  article("4", { all: win(3, 30, 9, 8, 2, 3) }, { active: true, stock: 4, currentVk: 9, currentEk: 3 }),
];

describe("windowSums", () => {
  it("summiert die Fenster-Snapshots und bildet DB III = DB II − Fixkostenanteil", () => {
    const s = sumWindow(ARTICLES, "90");
    expect(s.qty).toBe(15);
    expect(s.revenue).toBeCloseTo(121);
    expect(s.ek).toBeCloseTo(38);
    expect(s.dbI).toBeCloseTo(121 - 38);
    expect(s.dbII).toBeCloseTo(s.dbI - (25 + 4.5 + 2) - (7 + 2.1 + 1.4));
    expect(s.dbIII).toBeCloseTo(s.dbII - 15);
    expect(s.articlesWithSales).toBe(3);
  });

  it("liefert dieselben Fensterzahlen wie das bestehende Dashboard-View-Model", () => {
    const vm = buildDashboardViewModel(ARTICLES, DEFAULT_COST_SETTINGS);
    const sums = sumAllWindows(ARTICLES);
    for (const w of ["30", "90", "365", "all"] as const) {
      expect(sums[w].revenue).toBeCloseTo(vm.windows[w].revenue);
      expect(sums[w].qty).toBe(vm.windows[w].qty);
      expect(sums[w].revenue > 0 ? sums[w].dbII / sums[w].revenue : 0).toBeCloseTo(vm.windows[w].dbIIPercent);
    }
  });
});

describe("bands", () => {
  it("bildet drei disjunkte Run-Rate-Baender aus den verschachtelten Fenstern", () => {
    const b = computeRunRateBands(sumAllWindows(ARTICLES));
    expect(b.available).toBe(true);
    expect(b.anyClamped).toBe(false);
    const [a, bb, c] = b.bands;
    expect(a.revenuePerMonth).toBeCloseTo(45); // W30 = 40 + 5
    expect(bb.revenuePerMonth).toBeCloseTo((121 - 45) / 2);
    expect(c.revenuePerMonth).toBeCloseTo((345 - 121) / (275 / 30));
  });

  it("klemmt negative Fensterdifferenzen auf 0 und meldet das", () => {
    const inconsistent = [article("x", { "30": win(5, 50, 10), "90": win(3, 30, 6), "365": win(3, 30, 6), all: win(3, 30, 6) })];
    const b = computeRunRateBands(sumAllWindows(inconsistent));
    expect(b.anyClamped).toBe(true);
    expect(b.bands[1].revenuePerMonth).toBe(0);
  });
});

describe("bridge", () => {
  it("laeuft von Umsatz ueber DB I und DB II zu DB III ohne Rest-Schritt bei konsistenten Daten", () => {
    const br = buildBridge(sumWindow(ARTICLES, "365"));
    const keys = br.steps.map((s) => s.key);
    expect(keys).toEqual(["umsatz", "ware", "dbI", "ebay", "versand", "dbII", "fix", "dbIII"]);
    const ware = br.steps.find((s) => s.key === "ware")!;
    expect(ware.runningAfter).toBeCloseTo(br.steps.find((s) => s.key === "dbI")!.value);
    expect(br.steps[br.steps.length - 1].value).toBeCloseTo(sumWindow(ARTICLES, "365").dbIII);
    expect(br.max).toBeCloseTo(345);
  });

  it("zeigt eine Rest-Differenz, wenn DB II nicht zu den Kostenbloecken passt", () => {
    const odd = article("o", { "90": { ...win(1, 10, 2, 1, 1), dbII: 3 } });
    const br = buildBridge(sumWindow([odd], "90"));
    expect(br.steps.some((s) => s.key === "rest")).toBe(true);
    expect(br.steps.find((s) => s.key === "rest")!.value).toBeCloseTo(3);
  });
});

describe("ekGap", () => {
  it("zaehlt aktive Artikel ohne EK und ihren 90-T-Umsatzanteil", () => {
    const g = computeEkGap(ARTICLES);
    expect(g.activeTotal).toBe(3);
    expect(g.missingActive).toBe(1);
    expect(g.shareOfActive).toBeCloseTo(1 / 3);
    expect(g.revenue90Missing).toBeCloseTo(15);
    expect(g.shareOfRevenue90).toBeCloseTo(15 / 121);
    expect(g.missingActiveWithSales90).toBe(1);
  });
});

describe("distribution", () => {
  it("haelt die ordinale Klassenreihenfolge und summiert Anteile auf 1", () => {
    const vm = buildDashboardViewModel(ARTICLES, DEFAULT_COST_SETTINGS);
    const d = classDistribution(vm.sortiment);
    expect(d.segments.map((s) => s.key)).toEqual(["champion", "solide", "beobachten", "faellt_ab", "low_runner", "ladenhueter"]);
    expect(d.total).toBe(4);
    expect(d.segments.reduce((s, x) => s + x.countShare, 0)).toBeCloseTo(1);
    expect(d.segments.find((s) => s.key === "ladenhueter")!.count).toBe(1);
    expect(d.segments.find((s) => s.key === "low_runner")!.count).toBe(1);
  });

  it("Preis-Ampel nur ueber aktive Artikel, 'kein EK' als eigener Anteil", () => {
    const vm = buildDashboardViewModel(ARTICLES, DEFAULT_COST_SETTINGS);
    const d = priceStatusDistribution(vm.sortiment);
    expect(d.total).toBe(3);
    expect(d.segments.find((s) => s.key === "kein_ek")!.count).toBe(1);
  });
});

describe("movers", () => {
  it("Laeuft = Top-Umsatz mit positivem DB II, Bremst = negativster DB II, Bild-URL defensiv", () => {
    const vm = buildDashboardViewModel(ARTICLES, DEFAULT_COST_SETTINGS);
    void vm;
    const images = new Map([["1", { imageFile: "a.jpg", imageGuid: "g1" }]]);
    const classified = ARTICLES.map((a) => ({ article: a, articleClass: "solide" as const, label: "Solide", reason: "" }));
    const m = buildMovers(ARTICLES, classified, "90", images);
    expect(m.running[0].articleId).toBe("1");
    expect(m.running[0].relative).toBe(1);
    expect(m.running[0].imageUrl).toBe("/api/article-image/1?v=g1");
    expect(m.running.some((e) => e.articleId === "3")).toBe(false);
    expect(m.braking[0].articleId).toBe("3");
    expect(m.braking[0].imageUrl).toBeNull();
    expect(imageUrlFor("zzz", images)).toBeNull();
  });
});

describe("guardrails", () => {
  const sums365 = sumWindow(ARTICLES, "365");

  it("Umsatz-Bullet bewertet gegen Arbeits- und Kleinunternehmergrenze", () => {
    const [umsatz] = buildGuardrails(sums365, { spentInBudgetMonths: null, spentLast90d: null, recordCount: 0 }, PLANWERTE);
    expect(umsatz.value).toBeCloseTo(345);
    expect(umsatz.tone).toBe("good");
    expect(umsatz.markers.map((m) => m.value)).toEqual([24000, 25000]);
    const big = buildGuardrails({ ...sums365, revenue: 24500 }, { spentInBudgetMonths: null, spentLast90d: null, recordCount: 0 }, PLANWERTE)[0];
    expect(big.tone).toBe("warn");
  });

  it("Ergebnis-Bullet nutzt DB III und den Zielkorridor", () => {
    const g = buildGuardrails({ ...sums365, dbIII: 1700 }, { spentInBudgetMonths: null, spentLast90d: null, recordCount: 0 }, PLANWERTE)[1];
    expect(g.tone).toBe("good");
    const loss = buildGuardrails({ ...sums365, dbIII: -200 }, { spentInBudgetMonths: null, spentLast90d: null, recordCount: 0 }, PLANWERTE)[1];
    expect(loss.tone).toBe("crit");
    expect(loss.axisMin).toBeLessThan(0);
  });

  it("Warenbudget ohne Einkaufsdaten ist ein leerer Zustand, nie eine erfundene Zahl", () => {
    const g = buildGuardrails(sums365, { spentInBudgetMonths: null, spentLast90d: null, recordCount: 0 }, PLANWERTE)[2];
    expect(g.value).toBeNull();
    expect(g.tone).toBe("neutral");
    const withData = buildGuardrails(sums365, { spentInBudgetMonths: 1000, spentLast90d: 1500, recordCount: 12 }, PLANWERTE)[2];
    expect(withData.tone).toBe("crit");
  });
});

describe("capital", () => {
  it("gebundenes Kapital nur aus Artikeln mit bekanntem EK, Luecke separat ausgewiesen", () => {
    const bands = computeRunRateBands(sumAllWindows(ARTICLES));
    const c = computeCapital(ARTICLES, bands, { spentInBudgetMonths: null, spentLast90d: 300, recordCount: 3 });
    expect(c.boundCapitalEk).toBeCloseTo(10 * 3 + 4 * 3);
    expect(c.articlesWithKnownCapital).toBe(2);
    expect(c.articlesStockWithoutEk).toBe(1);
    expect(c.stockUnitsWithoutEk).toBe(5);
    expect(c.potentialRevenueVk).toBeCloseTo(100 + 25 + 36);
    expect(c.purchasePerMonth90).toBeCloseTo(100);
    expect(c.reachMonths).not.toBeNull();
  });
});

describe("viewModel", () => {
  it("parseWindowParam faellt auf 90 zurueck", () => {
    expect(parseWindowParam(undefined)).toBe("90");
    expect(parseWindowParam("foo")).toBe("90");
    expect(parseWindowParam("30")).toBe("30");
    expect(parseWindowParam(["all"])).toBe("all");
  });

  it("baut das Cockpit auf dem Dashboard-View-Model auf -- gleiche Zahlen", () => {
    const vm = buildCockpitViewModel({ aggregates: ARTICLES, costSettings: DEFAULT_COST_SETTINGS, window: "30" });
    expect(vm.current.revenue).toBeCloseTo(vm.dashboard.windows["30"].revenue);
    expect(vm.bridge.revenue).toBeCloseTo(45);
    expect(vm.totals).toEqual({ articles: 4, active: 3 });
    expect(vm.guardrails).toHaveLength(3);
    expect(vm.fixedYearly).toBeCloseTo(4229);
  });
});
