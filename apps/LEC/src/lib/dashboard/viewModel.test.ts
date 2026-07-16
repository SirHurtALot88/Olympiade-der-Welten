import { describe, expect, it } from "vitest";
import { buildDashboardViewModel, type ArticleAggregate, type WindowAggregate } from "./viewModel";
import { DEFAULT_COST_SETTINGS } from "../pricing/costSettings";

function agg(overrides: Partial<WindowAggregate> = {}): WindowAggregate {
  return {
    qty: 1,
    revenue: 10,
    ek: 3,
    ebayFeeTotal: 1,
    shippingCost: 1,
    dbI: 7,
    dbII: 5,
    avgPrice: 10,
    rank: null,
    ...overrides,
  };
}

function article(nameRaw: string, overrides: Partial<ArticleAggregate> = {}): ArticleAggregate {
  return {
    articleId: nameRaw,
    nameRaw,
    setCode: null,
    packQty: 1,
    stock: 0,
    latestMarketTrend: null,
    windows: {},
    ...overrides,
  };
}

describe("buildDashboardViewModel", () => {
  it("summiert Umsatz/Menge/DB je Fenster ueber alle Artikel", () => {
    const articles: ArticleAggregate[] = [
      article("A", { windows: { "30": agg({ revenue: 10, qty: 1, dbI: 7, dbII: 5 }) } }),
      article("B", { windows: { "30": agg({ revenue: 20, qty: 2, dbI: 14, dbII: 10 }) } }),
    ];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    expect(vm.windows["30"].revenue).toBe(30);
    expect(vm.windows["30"].qty).toBe(3);
    expect(vm.windows["30"].dbIPercent).toBeCloseTo(21 / 30);
  });

  it("erkennt totes Kapital (Lebenszeit-Verkaeufe, aber 0 in 365T)", () => {
    const articles: ArticleAggregate[] = [
      article("Ladenhueter", {
        windows: { all: agg({ qty: 5, revenue: 50 }) }, // kein "365"-Eintrag -> 0 in 365T
      }),
      article("Aktiv", {
        windows: { all: agg({ qty: 5, revenue: 50 }), "365": agg({ qty: 5, revenue: 50 }) },
      }),
    ];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    expect(vm.deadCapital.count).toBe(1);
    expect(vm.deadCapital.totalArticles).toBe(2);
    expect(vm.deadCapital.percent).toBeCloseTo(0.5);
  });

  it("baut die 'Laeuft gut'-Liste aus den staerksten 30d-Umsaetzen mit positivem DB I", () => {
    const articles: ArticleAggregate[] = [
      article("Schwach", { windows: { "30": agg({ revenue: 5, dbI: 1 }) } }),
      article("Stark", { windows: { "30": agg({ revenue: 100, dbI: 70 }) } }),
    ];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    expect(vm.moversGood[0].nameRaw).toBe("Stark");
  });

  it("baut die 'Laeuft schlecht'-Liste aus der schlechtesten Lebenszeit-DB-II-%", () => {
    const articles: ArticleAggregate[] = [
      article("Verlust", { windows: { all: agg({ revenue: 100, dbII: -50, qty: 5 }) } }),
      article("Gewinn", { windows: { all: agg({ revenue: 100, dbII: 30, qty: 5 }) } }),
    ];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    expect(vm.moversBad).toHaveLength(1);
    expect(vm.moversBad[0].nameRaw).toBe("Verlust");
  });

  it("sortiert die Sortiment-Tabelle nach AKTUELLER Velocity, nicht nach Lebenszeit-Umsatz", () => {
    // Regressionstest fuer KONZEPT §2: ein eingebrochener Alt-Renner mit hohem
    // Lebenszeit-/365T-Umsatz darf einen aktuell aktiven Artikel mit kleinerem
    // Umsatz NICHT verdraengen ("lief mal gut" vs. "läuft gut jetzt").
    const articles: ArticleAggregate[] = [
      article("Alter Bundle-Renner", {
        windows: {
          "365": agg({ qty: 0, revenue: 2000, ek: 600 }), // hoher Umsatz, aber 0 Verkaeufe in 365T? -> kein 30/90-Eintrag
        },
      }),
      article("Aktueller Renner", {
        windows: {
          "30": agg({ qty: 3, revenue: 90 }),
          "90": agg({ qty: 8, revenue: 240 }),
          "365": agg({ qty: 20, revenue: 400, ek: 120 }),
        },
      }),
    ];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    expect(vm.sortiment[0].nameRaw).toBe("Aktueller Renner");
  });

  it("berechnet die Sortiment-Tabelle inkl. Preis-Korridor und Status", () => {
    const articles: ArticleAggregate[] = [
      article("Karte", {
        packQty: 1,
        windows: { "365": agg({ qty: 10, revenue: 100, ek: 30, avgPrice: 10 }) },
      }),
    ];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    expect(vm.sortiment).toHaveLength(1);
    expect(vm.sortiment[0].vk).toBeCloseTo(10);
    expect(vm.sortiment[0].corridor.good).toBeGreaterThan(vm.sortiment[0].corridor.min);
  });

  it("berechnet Warenquote/Betriebsausgabenquote aus dem 365-Tage-Fenster", () => {
    const articles: ArticleAggregate[] = [
      article("A", {
        windows: {
          "365": agg({ revenue: 100, ek: 40, ebayFeeTotal: 10, shippingCost: 5 }),
        },
      }),
    ];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    expect(vm.quotas.warenquote).toBeCloseTo(0.4);
    expect(vm.quotas.betriebsausgabenquote).toBeCloseTo(0.15);
  });

  it("erzeugt eine Auslisten-Empfehlung fuer den staerksten Low-Runner", () => {
    const articles: ArticleAggregate[] = [
      article("Verlustbringer", {
        windows: {
          all: agg({ qty: 10, revenue: 100, dbII: -50 }),
          "365": agg({ qty: 10, revenue: 100, dbII: -50 }),
        },
      }),
    ];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    expect(vm.recommendations.some((r) => r.kind === "auslisten")).toBe(true);
  });
});
