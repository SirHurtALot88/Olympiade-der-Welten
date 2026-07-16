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
