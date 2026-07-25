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
