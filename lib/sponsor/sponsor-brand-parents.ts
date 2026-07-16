export type SponsorBrandIndustry =
  | "retail"
  | "tech"
  | "auto"
  | "finance"
  | "telecom"
  | "logistics"
  | "sport"
  | "energy"
  | "food"
  | "pharma"
  | "airline"
  | "media";

export type SponsorBrandRegion = "dach" | "eu" | "global";

export type SponsorBrandParent = {
  id: string;
  name: string;
  industry: SponsorBrandIndustry;
  region: SponsorBrandRegion;
  flavorBase: string;
};

export const SPONSOR_BRAND_PARENTS: SponsorBrandParent[] = [
  { id: "obi-baumarkt", name: "O.B.I. Baumarkt", industry: "retail", region: "dach", flavorBase: "Baumarkt-Partner mit solider Basisfinanzierung." },
  { id: "hornbach-co", name: "Hornbach & Co", industry: "retail", region: "dach", flavorBase: "Heimwerker-Marke für verlässliche Saisonbudgets." },
  { id: "bauhaus-arena", name: "Bauhaus Arena", industry: "retail", region: "dach", flavorBase: "DIY-Sponsor mit Fokus auf Team-Identität." },
  { id: "toom-werkstadt", name: "Toom Werkstadt", industry: "retail", region: "dach", flavorBase: "Regionaler Handwerkspartner." },
  { id: "hagebau-united", name: "Hagebau United", industry: "retail", region: "dach", flavorBase: "Genossenschaftlicher Sponsor mit breiter Reichweite." },
  { id: "aldi-nordpack", name: "Aldi Nordpack", industry: "retail", region: "dach", flavorBase: "Discounter-Partner — effizient und planbar." },
  { id: "lidl-plus", name: "Lidl Plus", industry: "retail", region: "dach", flavorBase: "Massenmarkt-Sponsor mit klaren Zielen." },
  { id: "rewe-united", name: "Rewe United", industry: "retail", region: "dach", flavorBase: "Lebensmittel-Riese mit Fan-Nähe." },
  { id: "kaufland-gruppe", name: "Kaufland Gruppe", industry: "retail", region: "dach", flavorBase: "Großflächen-Partner für ambitionierte Teams." },
  { id: "metro-grosshandel", name: "Metro Großhandel", industry: "retail", region: "dach", flavorBase: "B2B-Sponsor mit wirtschaftlichem Profil." },
  { id: "siemenswerk", name: "Siemenswerk AG", industry: "tech", region: "dach", flavorBase: "Industrietech mit Präzisionszielen." },
  { id: "bosch-hausgeraete", name: "Bosch Hausgeräte", industry: "tech", region: "dach", flavorBase: "Engineering-Partner für stabile Leistung." },
  { id: "sap-business", name: "SAP Business Cloud", industry: "tech", region: "dach", flavorBase: "Software-Gigant mit datengetriebenen Boni." },
  { id: "infineon-chips", name: "Infineon Chips", industry: "tech", region: "dach", flavorBase: "Halbleiter-Sponsor mit High-Tech-Profil." },
  { id: "bayer-pharma", name: "Bayer Pharma Labs", industry: "pharma", region: "dach", flavorBase: "Pharma-Partner mit langfristiger Perspektive." },
  { id: "basf-chemie", name: "BASF Chemie Partner", industry: "tech", region: "dach", flavorBase: "Chemie-Konzern mit solider Basis." },
  { id: "linde-gases", name: "Linde Gases", industry: "tech", region: "dach", flavorBase: "Industriegase — verlässlicher Cashflow." },
  { id: "thyssen-stahl", name: "ThyssenKrupp Stahl", industry: "tech", region: "dach", flavorBase: "Schwerindustrie-Sponsor mit Stabilitätsfokus." },
  { id: "evonik-materials", name: "Evonik Materials", industry: "tech", region: "dach", flavorBase: "Spezialchemie mit Entwicklungsbonus." },
  { id: "continental-reifen", name: "Continental Reifen", industry: "auto", region: "dach", flavorBase: "Mobilitäts-Partner mit Rang-Boni." },
  { id: "zf-getriebe", name: "ZF Getriebe", industry: "auto", region: "dach", flavorBase: "Antriebstechnik für Performance-Teams." },
  { id: "kuka-automation", name: "Kuka Automation", industry: "tech", region: "dach", flavorBase: "Robotik-Sponsor mit Disziplin-Fokus." },
  { id: "bmw-motoren", name: "BMW Motoren", industry: "auto", region: "dach", flavorBase: "Premium-Auto mit Titelambition." },
  { id: "mercedes-mobilitaet", name: "Mercedes-Benz Mobilität", industry: "auto", region: "dach", flavorBase: "Luxus-Mobilität — hohe Erwartungen." },
  { id: "volkswagen-gruppe", name: "Volkswagen Gruppe", industry: "auto", region: "dach", flavorBase: "Massenmarkt-Auto mit breitem Sponsoring." },
  { id: "audi-sport", name: "Audi Sport Partner", industry: "auto", region: "dach", flavorBase: "Motorsport-DNA mit Leistungsklauseln." },
  { id: "porsche-holding", name: "Porsche Holding", industry: "auto", region: "dach", flavorBase: "Elite-Auto für Top-Teams." },
  { id: "opel-motors", name: "Opel Motors", industry: "auto", region: "dach", flavorBase: "Volksnaher Auto-Partner." },
  { id: "man-truck", name: "MAN Truck & Bus", industry: "auto", region: "dach", flavorBase: "Nutzfahrzeug-Sponsor mit robuster Basis." },
  { id: "schaeffler-antrieb", name: "Schaeffler Antrieb", industry: "auto", region: "dach", flavorBase: "Zulieferer mit Entwicklungsfokus." },
  { id: "mahle-motoren", name: "Mahle Motoren", industry: "auto", region: "dach", flavorBase: "Motorenbauer mit technischen Sonderzielen." },
  { id: "webasto-comfort", name: "Webasto Comfort", industry: "auto", region: "dach", flavorBase: "Komfort-Technik für ausgewogene Deals." },
  { id: "allianz-versicherung", name: "Allianz Versicherung", industry: "finance", region: "dach", flavorBase: "Versicherer — Sicherheit first." },
  { id: "muenchener-rueck", name: "Münchener Rück", industry: "finance", region: "dach", flavorBase: "Rückversicherer mit konservativem Profil." },
  { id: "deutsche-bank", name: "Deutsche Bank Partner", industry: "finance", region: "dach", flavorBase: "Finanzhaus mit Premium-Paketen." },
  { id: "commerzbank-sport", name: "Commerzbank Sport", industry: "finance", region: "dach", flavorBase: "Bank-Sponsor mit Leistungsbonus." },
  { id: "sparkassen-allianz", name: "Sparkassen Allianz", industry: "finance", region: "dach", flavorBase: "Regionalbank-Netzwerk." },
  { id: "dws-investments", name: "DWS Investments", industry: "finance", region: "dach", flavorBase: "Fondshaus mit Upside-Klauseln." },
  { id: "talanx-gruppe", name: "Talanx Gruppe", industry: "finance", region: "dach", flavorBase: "Versicherungsgruppe mit breitem Portfolio." },
  { id: "ergo-versicherung", name: "Ergo Versicherung", industry: "finance", region: "dach", flavorBase: "Versicherer mit Fan-Programm." },
  { id: "hannover-rueck", name: "Hannover Rück", industry: "finance", region: "dach", flavorBase: "Rückversicherung — planbare Zahlungen." },
  { id: "uniper-finance", name: "Uniper Energy Finance", industry: "energy", region: "dach", flavorBase: "Energie-Finanzierung mit saisonalen Boni." },
  { id: "telekom-mobil", name: "Deutsche Telekom Mobil", industry: "telecom", region: "dach", flavorBase: "Telekom-Riese mit Medien-Power." },
  { id: "vodafone-arena", name: "Vodafone Arena Partner", industry: "telecom", region: "dach", flavorBase: "Mobilfunk mit Stadion-Präsenz." },
  { id: "o2-telefonica", name: "O2 Telefónica", industry: "telecom", region: "dach", flavorBase: "Telekom-Partner mit jungem Profil." },
  { id: "prosieben-media", name: "ProSiebenSat.1 Media", industry: "media", region: "dach", flavorBase: "TV-Sender mit Reichweiten-Bonus." },
  { id: "rtl-deutschland", name: "RTL Deutschland", industry: "media", region: "dach", flavorBase: "Entertainment-Sponsor mit Sonderzielen." },
  { id: "axel-springer", name: "Axel Springer Media", industry: "media", region: "dach", flavorBase: "Medienhaus mit PR-Aktivierungen." },
  { id: "bertelsmann-content", name: "Bertelsmann Content", industry: "media", region: "dach", flavorBase: "Content-Konzern mit Identitäts-Fokus." },
  { id: "wdr-sport", name: "WDR Sportpartner", industry: "media", region: "dach", flavorBase: "Öffentlich-rechtlicher Sportpartner." },
  { id: "deutsche-bahn", name: "Deutsche Bahn Mobilität", industry: "logistics", region: "dach", flavorBase: "Mobilität und Logistik vereint." },
  { id: "lufthansa-sky", name: "Lufthansa Sky Partner", industry: "airline", region: "dach", flavorBase: "Fluglinie mit globalem Profil." },
  { id: "eurowings-connect", name: "Eurowings Connect", industry: "airline", region: "dach", flavorBase: "Regionalflieger — solide Basis." },
  { id: "dhl-logistik", name: "DHL Logistik", industry: "logistics", region: "dach", flavorBase: "Logistik-Gigant mit Transfer-Fokus." },
  { id: "hermes-paket", name: "Hermes Paket", industry: "logistics", region: "dach", flavorBase: "Paketdienst mit schnellen Boni." },
  { id: "tchibo-kaffee", name: "Tchibo Kaffee", industry: "food", region: "dach", flavorBase: "Kaffee-Röster mit Fan-Kultur." },
  { id: "dr-oetker", name: "Dr. Oetker Gastronomie", industry: "food", region: "dach", flavorBase: "Food-Partner mit Event-Potenzial." },
  { id: "haribo-suesswaren", name: "Haribo Süßwaren", industry: "food", region: "dach", flavorBase: "Süßwaren — fröhlicher Sponsor." },
  { id: "ritter-sport", name: "Ritter Sport", industry: "food", region: "dach", flavorBase: "Schokolade mit regionalem Charme." },
  { id: "henkel-waschmittel", name: "Henkel Waschmittel", industry: "retail", region: "dach", flavorBase: "Konsumgüter mit stabiler Basis." },
  { id: "adidas-sport", name: "Adidas Sport Performance", industry: "sport", region: "dach", flavorBase: "Sportmarke — Leistung im Fokus." },
  { id: "puma-athletica", name: "Puma Athletica", industry: "sport", region: "dach", flavorBase: "Athletik-Sponsor mit Rang-Boni." },
  { id: "hugo-boss", name: "Hugo Boss Premium", industry: "retail", region: "dach", flavorBase: "Premium-Mode für Elite-Teams." },
  { id: "zalando-fashion", name: "Zalando Fashion", industry: "retail", region: "dach", flavorBase: "Online-Mode mit jungem Publikum." },
  { id: "otto-versand", name: "Otto Versand", industry: "retail", region: "dach", flavorBase: "Versandhandel — planbare Deals." },
  { id: "mediamarkt-saturn", name: "MediaMarkt Saturn", industry: "retail", region: "dach", flavorBase: "Elektronik-Handel mit Medien-Power." },
  { id: "conrad-elektronik", name: "Conrad Elektronik", industry: "retail", region: "dach", flavorBase: "Tech-Handel für datenaffine Teams." },
  { id: "beiersdorf-nivea", name: "Beiersdorf Nivea", industry: "retail", region: "dach", flavorBase: "Kosmetik mit breiter Fanbasis." },
  { id: "montblanc-writing", name: "Montblanc Writing", industry: "retail", region: "dach", flavorBase: "Luxus-Schreibwaren — Prestige-Sponsor." },
  { id: "wuerth-handwerk", name: "Würth Handwerk", industry: "retail", region: "dach", flavorBase: "Handwerks-Zulieferer mit Solidität." },
  { id: "teslara-motors", name: "Teslara Motors", industry: "auto", region: "global", flavorBase: "Elektro-Auto-Pionier mit Upside." },
  { id: "apple-core", name: "Apple Core Technology", industry: "tech", region: "global", flavorBase: "Tech-Ikone — Premium-Sponsoring." },
  { id: "microsoft-dynamics", name: "MicroSoft Dynamics", industry: "tech", region: "global", flavorBase: "Software-Riese mit Enterprise-Deals." },
  { id: "alphasearch-global", name: "AlphaSearch Global", industry: "tech", region: "global", flavorBase: "Suchmaschinen-Gigant mit Reichweite." },
  { id: "rainforest-commerce", name: "Rainforest Commerce", industry: "retail", region: "global", flavorBase: "E-Commerce mit Logistik-Bonus." },
  { id: "metaworld-social", name: "Metaworld Social", industry: "media", region: "global", flavorBase: "Social-Media mit Aktivierungs-Events." },
  { id: "flixnet-media", name: "FlixNet Media", industry: "media", region: "global", flavorBase: "Streaming mit Entertainment-Fokus." },
  { id: "oracle-enterprise", name: "Oracle Enterprise", industry: "tech", region: "global", flavorBase: "Enterprise-Tech mit anspruchsvollen Zielen." },
  { id: "ibm-watson", name: "IBM Watson Tech", industry: "tech", region: "global", flavorBase: "KI-Tech mit analytischen Klauseln." },
  { id: "salesforce-crm", name: "Salesforce CRM", industry: "tech", region: "global", flavorBase: "Cloud-CRM mit Wachstumsbonus." },
  { id: "toyota-way", name: "Toyota Way Mobility", industry: "auto", region: "global", flavorBase: "Zuverlässigkeit und Effizienz." },
  { id: "honda-engineering", name: "Honda Engineering", industry: "auto", region: "global", flavorBase: "Engineering-Kultur mit Disziplin-Fokus." },
  { id: "volvo-safety", name: "Volvo Safety Motor", industry: "auto", region: "global", flavorBase: "Sicherheits-Auto — konservatives Profil." },
  { id: "shell-energy", name: "Shell Energy", industry: "energy", region: "global", flavorBase: "Energie-Konzern mit globaler Reichweite." },
  { id: "total-energies", name: "Total Energies", industry: "energy", region: "global", flavorBase: "Energie-Partner mit Performance-Klauseln." },
  { id: "red-stag-energy", name: "Red Stag Energy", industry: "sport", region: "global", flavorBase: "Energy-Drink — extreme Leistungsboni." },
  { id: "nike-just-win", name: "Nike Just Win", industry: "sport", region: "global", flavorBase: "Sportswear-Gigant mit Titelambition." },
  { id: "cola-classic", name: "Cola Classic Beverages", industry: "food", region: "global", flavorBase: "Getränke-Riese mit Massen-Appeal." },
  { id: "golden-arches", name: "Golden Arches Fast", industry: "food", region: "global", flavorBase: "Fast-Food mit Event-Potenzial." },
  { id: "starbucks-coffee", name: "Starbucks Coffee Co", industry: "food", region: "global", flavorBase: "Coffee-Chain mit Lifestyle-Profil." },
  { id: "mastercard-payments", name: "Mastercard Payments", industry: "finance", region: "global", flavorBase: "Zahlungsdienst mit Premium-Deals." },
  { id: "visa-worldwide", name: "Visa Worldwide", industry: "finance", region: "global", flavorBase: "Globale Zahlungen — solide Basis." },
  { id: "fedex-express", name: "FedEx Express", industry: "logistics", region: "global", flavorBase: "Express-Logistik mit Speed-Bonus." },
  { id: "ups-brown", name: "UPS Brown Logistics", industry: "logistics", region: "global", flavorBase: "Paketriese mit Transfer-Fokus." },
  { id: "pfizer-pharma", name: "Pfizer Pharma", industry: "pharma", region: "global", flavorBase: "Pharma-Global mit Langfrist-Deals." },
  { id: "johnson-health", name: "Johnson Health", industry: "pharma", region: "global", flavorBase: "Healthcare mit Entwicklungszielen." },
  { id: "emirates-airlines", name: "Emirates Airlines", industry: "airline", region: "global", flavorBase: "Luxus-Airline — Elite-Sponsoring." },
  { id: "qatar-sky", name: "Qatar Sky Airways", industry: "airline", region: "global", flavorBase: "Premium-Flieger mit globalem Profil." },
  { id: "heineken-brewery", name: "Heineken Brewery", industry: "food", region: "global", flavorBase: "Brauerei mit Fan-Events." },
  { id: "ikea-home", name: "IKEA Home Arena", industry: "retail", region: "global", flavorBase: "Möbel-Riese mit Stadion-Präsenz." },
];

export function getSponsorBrandParentById(parentId: string): SponsorBrandParent | null {
  return SPONSOR_BRAND_PARENTS.find((entry) => entry.id === parentId) ?? null;
}

export function listSponsorBrandParents() {
  return SPONSOR_BRAND_PARENTS;
}

export function resolveSponsorBrandDisplay(
  parent: SponsorBrandParent,
  variant: { flavorSuffix: string; variantKey: string },
): { name: string; flavor: string } {
  return {
    name: parent.name,
    flavor: `${variant.flavorSuffix} ${parent.flavorBase}`,
  };
}

export function preferredIndustriesForTeam(input: {
  teamShortCode: string;
  ambition: number;
  sellForProfitAggression: number;
  finances: number;
}): SponsorBrandIndustry[] {
  if (input.teamShortCode === "C-C" || input.sellForProfitAggression >= 8 || input.finances >= 8) {
    return ["finance", "retail", "logistics"];
  }
  if (input.teamShortCode === "M-M" || input.ambition >= 8) {
    return ["sport", "auto", "airline", "media"];
  }
  if (input.ambition >= 6) {
    return ["sport", "tech", "auto"];
  }
  return ["retail", "food", "telecom"];
}

export function scoreParentTeamAffinity(parent: SponsorBrandParent, preferredIndustries: SponsorBrandIndustry[]) {
  let score = 0;
  if (preferredIndustries.includes(parent.industry)) {
    score += 3;
  }
  if (parent.region === "dach") {
    score += 1;
  }
  return score;
}
