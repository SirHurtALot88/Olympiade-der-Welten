import { describe, expect, it } from "vitest";
import {
  buildDashboardViewModel,
  buildRecommendations,
  buildSortimentRow,
  shopVolumeFromAggregates,
  type ArticleAggregate,
  type WindowAggregate,
} from "./viewModel";
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
    active: true,
    currentVk: null,
    currentEk: null,
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
    expect(vm.sortiment[0].avgVkRealized).toBeCloseTo(10);
    expect(vm.sortiment[0].corridor.good).toBeGreaterThan(vm.sortiment[0].corridor.min);
  });

  it("nutzt den aktuellen Listen-VK (nicht den realisierten Ø-VK) fuer den Preis-Korridor-Vergleich", () => {
    // Methodik-Klarstellung: DB I/II rechnen mit dem realisierten Ø-VK, aber
    // die "zu teuer/guenstig"-Ampel prueft den AKTUELLEN Listenpreis aus dem
    // Billbee-Artikelstamm-Export gegen den Korridor.
    const articles: ArticleAggregate[] = [
      article("Karte", {
        currentVk: 1, // deutlich unter dem MIN-Korridor -> "unter_min"
        windows: { "365": agg({ qty: 10, revenue: 100, ek: 30, avgPrice: 10 }) }, // realisierter Ø-VK 10 waere "im_korridor"
      }),
    ];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    expect(vm.sortiment[0].avgVkRealized).toBeCloseTo(10);
    expect(vm.sortiment[0].listingVk).toBeCloseTo(1);
    expect(vm.sortiment[0].priceStatus).toBe("unter_min");
  });

  it("gibt `active` aus dem Billbee-Artikelstamm-Import durch (Ladenhueter-Klassifikation bleibt unabhaengig davon)", () => {
    const articles: ArticleAggregate[] = [
      article("Ausgelaufen", {
        active: false,
        windows: { all: agg({ qty: 5, revenue: 50 }) },
      }),
    ];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    expect(vm.sortiment[0].active).toBe(false);
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

  it("erzeugt fuer JEDEN Low-Runner eine eigene Auslisten-Empfehlung (nicht nur den schlimmsten)", () => {
    const articles: ArticleAggregate[] = [
      article("Verlust A", {
        windows: { all: agg({ qty: 5, revenue: 50, dbII: -20 }), "365": agg({ qty: 5, revenue: 50, dbII: -20 }) },
      }),
      article("Verlust B", {
        windows: { all: agg({ qty: 5, revenue: 50, dbII: -80 }), "365": agg({ qty: 5, revenue: 50, dbII: -80 }) },
      }),
    ];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    const auslisten = vm.recommendations.filter((r) => r.kind === "auslisten");
    expect(auslisten).toHaveLength(2);
    // Sortierung nach |€-Effekt| absteigend -> der groessere Verlust zuerst.
    expect(auslisten[0].title).toContain("Verlust B");
  });

  it("buendelt Ladenhueter zu GENAU einem Sammel-Eintrag mit aufklappbarer Artikelliste", () => {
    const articles: ArticleAggregate[] = [
      // stock/currentEk gesetzt, weil das gebundene Kapital seit FIX 2 aus Bestand x EK/Stk
      // berechnet wird, nicht mehr aus der Lebenszeit-EK-Summe der verkauften Stuecke.
      article("Ladenhueter A", { stock: 1, currentEk: 10, windows: { all: agg({ qty: 3, revenue: 30, ek: 10 }) } }),
      article("Ladenhueter B", { stock: 1, currentEk: 15, windows: { all: agg({ qty: 2, revenue: 20, ek: 15 }) } }),
    ];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    const lots = vm.recommendations.filter((r) => r.kind === "lot_bilden");
    expect(lots).toHaveLength(1);
    expect(lots[0].items).toHaveLength(2);
    expect(lots[0].effectValue).toBeCloseTo(25); // 10 + 15 gebundener EK
  });

  // --- FIX 1 Regressionstest -------------------------------------------------
  it("REGRESSION FIX 1: Artikel ohne jeden EK-Anhaltspunkt werden NIE Champion, erzeugen KEINE Nachkauf-Empfehlung, stattdessen 'EK pflegen' ganz oben", () => {
    const articles: ArticleAggregate[] = [
      article("Ohne EK", {
        active: true,
        currentEk: null,
        windows: {
          "30": agg({ qty: 3, revenue: 90, ek: 0, dbI: 90, dbII: 90 }),
          "90": agg({ qty: 9, revenue: 270, ek: 0, dbI: 270, dbII: 270 }),
          "365": agg({ qty: 35, revenue: 1000, ek: 0, dbI: 1000, dbII: 1000 }),
          all: agg({ qty: 35, revenue: 1000, ek: 0, dbI: 1000, dbII: 1000 }),
        },
      }),
    ];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    // Ohne den Fix waere dbIIPercent=1.0 (Phantom-Marge, weil ek=0 -> dbI=Umsatz) bei
    // qty30d=3>=2 ein klarer "champion" -> Nachkauf-Empfehlung fuer einen Artikel ohne
    // bekannten Einkaufspreis. Das darf nicht mehr passieren.
    expect(vm.sortiment[0].ekMissing).toBe(true);
    expect(vm.sortiment[0].articleClass).not.toBe("champion");
    expect(vm.recommendations.some((r) => r.kind === "nachkaufen")).toBe(false);
    expect(vm.recommendations).toHaveLength(1);
    expect(vm.recommendations[0].kind).toBe("ek_pflegen");
    expect(vm.recommendations[0].title).toContain("1 Artikel");
  });

  // --- FIX 2 Regressionstest -------------------------------------------------
  it("REGRESSION FIX 2: gebundenes Kapital ist Bestand x EK/Stk, nicht der Lebenszeit-EK bereits verkaufter Stuecke", () => {
    const articles: ArticleAggregate[] = [
      article("Alter Renner", {
        active: true,
        stock: 1,
        currentEk: 2,
        windows: { all: agg({ qty: 50, revenue: 500, ek: 500 }) }, // 50 verkaufte Stk, Lebenszeit-EK-Summe 500 €
      }),
      article("Ausgelaufen ohne Bestandsimport", {
        active: false,
        stock: 0,
        currentEk: null,
        windows: { all: agg({ qty: 10, revenue: 100, ek: 100 }) },
      }),
    ];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    const lot = vm.recommendations.find((r) => r.kind === "lot_bilden");
    expect(lot).toBeDefined();
    const known = lot!.items!.find((i) => i.nameRaw === "Alter Renner");
    // Bestand 1 Stk x EK/Stk 2 € = 2 € -- NICHT die Lebenszeit-EK-Summe von 500 €
    // (der alte Fehler haette hier windows.all.ek = 500 verwendet).
    expect(known!.boundCapital).toBeCloseTo(2);
    const unknown = lot!.items!.find((i) => i.nameRaw === "Ausgelaufen ohne Bestandsimport");
    // Kein Bestandsimport gelaufen -> Bestand unbekannt, NICHT erfunden als 0.
    expect(unknown!.boundCapital).toBeNull();
    // Gesamtsumme zaehlt den unbekannten Bestand nicht als 0 mit.
    expect(lot!.effectValue).toBeCloseTo(2);
  });

  // --- FIX 3 Regressionstest (Integrationsebene, Unit-Test siehe classification.test.ts) ---
  it("REGRESSION FIX 3: Bestandsartikel ohne JEDE Verkaufshistorie ist Ladenhueter, nicht Beobachten", () => {
    const articles: ArticleAggregate[] = [
      article("Nie verkauft", { active: true, stock: 4, windows: {} }),
    ];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    expect(vm.sortiment[0].articleClass).toBe("ladenhueter");
  });

  // --- FIX 4 Regressionstests -------------------------------------------------
  it("REGRESSION FIX 4: preis_anpassen effectValue ist Luecke x Hebel (€ gesamt), nicht Luecke/Stk", () => {
    const articles: ArticleAggregate[] = [
      article("Karte", {
        currentVk: 1, // deutlich unter dem MIN-Korridor -> "unter_min"
        stock: 5,
        windows: {
          "365": agg({ qty: 10, revenue: 100, ek: 30, avgPrice: 10 }),
          "90": agg({ qty: 20, revenue: 200 }),
        },
      }),
    ];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    expect(vm.sortiment[0].priceStatus).toBe("unter_min");
    const gap = vm.sortiment[0].corridor.min - 1;
    const rec = vm.recommendations.find((r) => r.kind === "preis_anpassen");
    expect(rec).toBeDefined();
    // Hebel = max(Bestand 5, 90T-Velocity 20) = 20 -- effectValue MUSS die Gesamtsumme sein,
    // nicht nur die Luecke/Stk (das waere der alte, fehlerhafte Wert `gap`).
    expect(rec!.effectValue).toBeCloseTo(gap * 20, 2);
    expect(rec!.effectValue).not.toBeCloseTo(gap, 2);
  });

  it("REGRESSION FIX 4: nachkaufen effectValue ist der 90T-Erwartungswert, nicht die Lebenszeit-DB-II-Summe", () => {
    const articles: ArticleAggregate[] = [
      article("Renner", {
        windows: {
          "30": agg({ qty: 3, revenue: 90, ek: 9, dbI: 81, dbII: 70 }),
          "90": agg({ qty: 3, revenue: 90, ek: 9, dbI: 81, dbII: 70 }),
          "365": agg({ qty: 3, revenue: 90, ek: 9, dbI: 81, dbII: 70 }), // aktuell nur noch 3 Stk/Jahr
          all: agg({ qty: 200, revenue: 4000, ek: 400, dbI: 3600, dbII: 3200 }), // riesige Lebenszeit-Summe
        },
      }),
    ];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    expect(vm.sortiment[0].articleClass).toBe("champion");
    const rec = vm.recommendations.find((r) => r.kind === "nachkaufen");
    expect(rec).toBeDefined();
    // DB II/Stk (Referenz-Fenster) x 3 Stk/90T -- NICHT die Lebenszeit-DB-II-Summe von
    // 3200 € (der alte, fehlerhafte Wert).
    const expected = vm.sortiment[0].dbIIPerUnit * 3;
    expect(rec!.effectValue).toBeCloseTo(expected, 2);
    expect(rec!.effectValue).toBeLessThan(3200);
  });
});

describe("Kostenmodell im Sortiment (Fixkosten, Einschreiben, Korridor-Linien)", () => {
  /** Renner, der die shopweite Stueckzahl auf 3.400 hebt (Chris' Betriebszahl), Ø-VK 6,87. */
  const filler = () => article("Renner", { windows: { "365": agg({ qty: 3400, revenue: 3400 * 6.87, ek: 3400 * 2, avgPrice: 6.87 }) } });
  const cheapCard = () =>
    article("Billigkarte", {
      currentVk: 4.99,
      windows: { "365": agg({ qty: 20, revenue: 20 * 4.99, ek: 20 * 0.9, avgPrice: 4.99 }) },
    });

  it("shopVolumeFromAggregates: N und N_T aus dem 365-Fenster (Fallback all)", () => {
    const articles = [
      article("A", { windows: { "365": agg({ qty: 10, avgPrice: 5 }) } }),
      article("B", { windows: { "365": agg({ qty: 2, avgPrice: 35 }) } }),
      article("C", { windows: { "30": agg({ qty: 99, avgPrice: 50 }) } }),
    ];
    expect(shopVolumeFromAggregates(articles, DEFAULT_COST_SETTINGS)).toEqual({
      units365d: 12,
      unitsAtOrAboveThreshold: 2,
    });
    const onlyAll = [article("A", { windows: { all: agg({ qty: 7, avgPrice: 5 }) } })];
    expect(shopVolumeFromAggregates(onlyAll, DEFAULT_COST_SETTINGS)?.units365d).toBe(7);
    expect(shopVolumeFromAggregates([article("Leer")], DEFAULT_COST_SETTINGS)).toBeNull();
  });

  it("reicht die shopweiten Fixkosten in den Korridor durch (Regression: fixedCostPerUnit war 0)", () => {
    const card = article("Karte", {
      currentVk: 10,
      windows: { "365": agg({ qty: 10, revenue: 100, ek: 30, avgPrice: 10 }) },
    });
    const withShop = buildDashboardViewModel([card, filler()], DEFAULT_COST_SETTINGS).sortiment.find(
      (r) => r.nameRaw === "Karte"
    )!;
    const noShop = buildSortimentRow(card, "beobachten", DEFAULT_COST_SETTINGS, null);
    const shop = shopVolumeFromAggregates([card, filler()], DEFAULT_COST_SETTINGS)!;
    const mitShop = buildSortimentRow(card, "beobachten", DEFAULT_COST_SETTINGS, shop);
    expect(withShop.corridor.min).toBeCloseTo(mitShop.corridor.min, 8);
    expect(mitShop.corridor.min).toBeGreaterThan(noShop.corridor.min + 1);
    // Fixkosten stecken auch in der Deckungsbeitrags-Grenze NICHT: sie bleibt (fast) gleich.
    expect(mitShop.corridor.contribution - noShop.corridor.contribution).toBeLessThan(0.1);
  });

  it("EK 0,90 / VK 4,99 ist 'ziel_unerreichbar' statt dauerhaft 'unter_min'", () => {
    const vm = buildDashboardViewModel([cheapCard(), filler()], DEFAULT_COST_SETTINGS);
    const row = vm.sortiment.find((r) => r.nameRaw === "Billigkarte")!;
    expect(row.priceStatus).toBe("ziel_unerreichbar");
    expect(row.corridor.contribution).toBeLessThan(4.99);
  });

  it("'ziel_unerreichbar' taucht NICHT als 'VK anheben'-Empfehlung auf, echter Verlust schon", () => {
    const verlust = article("Verlustkarte", {
      currentVk: 2.5,
      windows: { "365": agg({ qty: 20, revenue: 20 * 2.5, ek: 20 * 0.9, avgPrice: 2.5 }) },
    });
    const articles = [cheapCard(), verlust, filler()];
    const vm = buildDashboardViewModel(articles, DEFAULT_COST_SETTINGS);
    expect(vm.sortiment.find((r) => r.nameRaw === "Verlustkarte")!.priceStatus).toBe("unter_min");
    const ids = buildRecommendations(
      articles.map((a) => ({ article: a, articleClass: "solide" as const, reason: "" })),
      vm.sortiment
    )
      .filter((r) => r.kind === "preis_anpassen")
      .map((r) => r.id);
    expect(ids).toContain("preis_anpassen:Verlustkarte");
    expect(ids).not.toContain("preis_anpassen:Billigkarte");
  });
});

