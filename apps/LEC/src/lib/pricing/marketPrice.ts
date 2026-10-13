/**
 * Marktpreis-Provider-Interface (KONZEPT.md §7.1). v1 = Provider B: Chris hat
 * keine Cardmarket-API, deshalb werden Preisdaten manuell/halbautomatisch
 * uebergeben (Produkt-URL bzw. kopierte Preisfelder) statt automatisch
 * abgerufen. Ein API-Provider (Option A) liesse sich spaeter ohne UI-Aenderung
 * hinter dasselbe Interface haengen.
 */
export interface MarketPriceOffer {
  price: number;
  quantity: number;
  sellerCountry: string;
}

export interface MarketPriceQuote {
  setCode: string;
  language: "DE" | "EN";
  available: number;
  from: number;
  trend: number;
  avg30: number;
  avg7: number;
  avg1: number;
  offers: MarketPriceOffer[];
  fetchedAt: Date;
}

export interface MarketPriceProvider {
  getPrice(setCode: string, language?: "DE" | "EN"): Promise<MarketPriceQuote | null>;
}

/**
 * Provider B (v1): haelt manuell/halbautomatisch uebergebene Preisdaten vor
 * (kein Netzwerk-Call). Aufruf z. B. aus einer zukuenftigen "Marktpreise"-Seite,
 * auf der Chris die von Cardmarket kopierten Werte eintraegt.
 */
export class ManualMarketPriceProvider implements MarketPriceProvider {
  constructor(private readonly quotes: Map<string, MarketPriceQuote>) {}

  async getPrice(setCode: string, language: "DE" | "EN" = "DE"): Promise<MarketPriceQuote | null> {
    const key = `${setCode.toUpperCase()}::${language}`;
    return this.quotes.get(key) ?? null;
  }
}

/**
 * Baut den harten Cardmarket-Produkt-URL-Parametersatz (KONZEPT §7.1): nur
 * deutsche Karten/Verkaeufer, Mindestzustand NM, Menge = Pack-Groesse. `base`
 * ist die vom Nutzer/Chris angegebene Produkt-URL-Basis (Set + Kartenname).
 */
export function buildCardmarketUrl(base: string, packQty: number): string {
  const params = new URLSearchParams({
    sellerCountry: "7",
    language: "3",
    minCondition: "2",
    amount: String(Math.max(1, packQty)),
  });
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${params.toString()}`;
}

/**
 * EK-Ableitung aus Cardmarket (KONZEPT §7.2): guenstigster verfuegbarer DE-Preis
 * x Pack-Groesse + Einkaufs-Versand-Anteil = Markt-EK. `buyShippingShare` kommt
 * aus costEngine.ts (haengt von Einzel/Pack + Bezugsmenge ab).
 */
export function computeMarketEk(priceFrom: number, packQty: number, buyShipping: number): number {
  return priceFrom * Math.max(1, packQty) + buyShipping;
}

/**
 * Cardmarket-Produktsuche als Basis-URL fuer `buildCardmarketUrl` (KONZEPT §7.1):
 * Chris pflegt keine Produkt-Slug-Datenbank, daher verlinkt die App auf die
 * Cardmarket-SUCHE mit Name/Set-Code als `searchString` -- Chris klickt sich
 * von dort zum exakten Produkt durch. Die harten DE/DE-Parameter gelten auch
 * fuer die Suchergebnisliste.
 */
export function buildCardmarketSearchUrl(nameOrSetCode: string, packQty: number): string {
  const base = `https://www.cardmarket.com/de/YuGiOh/Products/Search?searchString=${encodeURIComponent(nameOrSetCode)}`;
  return buildCardmarketUrl(base, packQty);
}

export type MarketStatus = "zu_guenstig" | "im_korridor" | "zu_teuer";

/**
 * "Zu teuer / zu guenstig ggue. Markt"-Ampel (KONZEPT §7.4): eigener VK vs.
 * Cardmarket-Trend, +/-15 % um den Trend gilt als neutral ("im Korridor").
 */
export function classifyMarketStatus(ownVk: number, trend: number): MarketStatus {
  if (trend <= 0) return "im_korridor";
  const diff = (ownVk - trend) / trend;
  if (diff < -0.15) return "zu_guenstig";
  if (diff > 0.15) return "zu_teuer";
  return "im_korridor";
}

/**
 * Chris' Preisformel: VK = 3 x EK + 0,99 €, Untergrenze 4,99 € (seit September).
 * Angewandt auf den heutigen Marktwert ergibt sie, wo der VK stehen muesste, wenn
 * die Karte heute zum Marktpreis nachgekauft wuerde.
 */
export const PRICE_FORMULA = { factor: 3, add: 0.99, floor: 4.99 } as const;

export function formulaVk(ek: number): number {
  return Math.max(PRICE_FORMULA.floor, PRICE_FORMULA.factor * ek + PRICE_FORMULA.add);
}

/**
 * Abgleich des eigenen VK mit der Formel auf Marktwert. Bewusst NICHT ±15 % um den
 * Cardmarket-Trend: Chris' VK liegt im Median beim Fuenffachen des Trends
 * (Untergrenze 4,99 € bei Billigkarten, nachgemessen 13.10.) — der alte Vergleich
 * haette fast alles "zu teuer" gefaerbt.
 * - zu guenstig: VK unter 85 % des Formel-VK (bei heutigem Markt verschenkt)
 * - zu teuer:    VK ueber 150 % des Formel-VK (deutlich ueber der eigenen Regel)
 */
export function classifyAgainstFormula(ownVk: number, formula: number): MarketStatus {
  if (ownVk <= 0 || formula <= 0) return "im_korridor";
  if (ownVk < formula * 0.85) return "zu_guenstig";
  if (ownVk > formula * 1.5) return "zu_teuer";
  return "im_korridor";
}
