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
  { id: "obi-baumarkt", name: "Oberbau Baumarkt", industry: "retail", region: "dach", flavorBase: "Baumarkt-Partner mit solider Basisfinanzierung." },
  { id: "hornbach-co", name: "Hornberg & Co", industry: "retail", region: "dach", flavorBase: "Heimwerker-Marke für verlässliche Saisonbudgets." },
  { id: "bauhaus-arena", name: "Bauhütte Arena", industry: "retail", region: "dach", flavorBase: "DIY-Sponsor mit Fokus auf Team-Identität." },
  { id: "toom-werkstadt", name: "Tumm Werkstatt", industry: "retail", region: "dach", flavorBase: "Regionaler Handwerkspartner." },
  { id: "hagebau-united", name: "Hagelbau United", industry: "retail", region: "dach", flavorBase: "Genossenschaftlicher Sponsor mit breiter Reichweite." },
  { id: "aldi-nordpack", name: "Alldi Nordpack", industry: "retail", region: "dach", flavorBase: "Discounter-Partner — effizient und planbar." },
  { id: "lidl-plus", name: "Liedl Plus", industry: "retail", region: "dach", flavorBase: "Massenmarkt-Sponsor mit klaren Zielen." },
  { id: "rewe-united", name: "Rewo United", industry: "retail", region: "dach", flavorBase: "Lebensmittel-Riese mit Fan-Nähe." },
  { id: "kaufland-gruppe", name: "Kaufwald Gruppe", industry: "retail", region: "dach", flavorBase: "Großflächen-Partner für ambitionierte Teams." },
  { id: "metro-grosshandel", name: "Metra Großhandel", industry: "retail", region: "dach", flavorBase: "B2B-Sponsor mit wirtschaftlichem Profil." },
  { id: "siemenswerk", name: "Simmenswerk AG", industry: "tech", region: "dach", flavorBase: "Industrietech mit Präzisionszielen." },
  { id: "bosch-hausgeraete", name: "Bosko Hausgeräte", industry: "tech", region: "dach", flavorBase: "Engineering-Partner für stabile Leistung." },
  { id: "sap-business", name: "SOP Business Cloud", industry: "tech", region: "dach", flavorBase: "Software-Gigant mit datengetriebenen Boni." },
  { id: "infineon-chips", name: "Infinitron Chips", industry: "tech", region: "dach", flavorBase: "Halbleiter-Sponsor mit High-Tech-Profil." },
  { id: "bayer-pharma", name: "Baier Pharma Labs", industry: "pharma", region: "dach", flavorBase: "Pharma-Partner mit langfristiger Perspektive." },
  { id: "basf-chemie", name: "BASK Chemie Partner", industry: "tech", region: "dach", flavorBase: "Chemie-Konzern mit solider Basis." },
  { id: "linde-gases", name: "Lindau Gases", industry: "tech", region: "dach", flavorBase: "Industriegase — verlässlicher Cashflow." },
  { id: "thyssen-stahl", name: "Thürsen Stahl", industry: "tech", region: "dach", flavorBase: "Schwerindustrie-Sponsor mit Stabilitätsfokus." },
  { id: "evonik-materials", name: "Evonix Materials", industry: "tech", region: "dach", flavorBase: "Spezialchemie mit Entwicklungsbonus." },
  { id: "continental-reifen", name: "Kontinent Reifen", industry: "auto", region: "dach", flavorBase: "Mobilitäts-Partner mit Rang-Boni." },
  { id: "zf-getriebe", name: "ZG Getriebe", industry: "auto", region: "dach", flavorBase: "Antriebstechnik für Performance-Teams." },
  { id: "kuka-automation", name: "Kuxa Automation", industry: "tech", region: "dach", flavorBase: "Robotik-Sponsor mit Disziplin-Fokus." },
  { id: "bmw-motoren", name: "BMV Motoren", industry: "auto", region: "dach", flavorBase: "Premium-Auto mit Titelambition." },
  { id: "mercedes-mobilitaet", name: "Mercator-Bänz Mobilität", industry: "auto", region: "dach", flavorBase: "Luxus-Mobilität — hohe Erwartungen." },
  { id: "volkswagen-gruppe", name: "Völkerwagen Gruppe", industry: "auto", region: "dach", flavorBase: "Massenmarkt-Auto mit breitem Sponsoring." },
  { id: "audi-sport", name: "Audix Sport Partner", industry: "auto", region: "dach", flavorBase: "Motorsport-DNA mit Leistungsklauseln." },
  { id: "porsche-holding", name: "Porschen Holding", industry: "auto", region: "dach", flavorBase: "Elite-Auto für Top-Teams." },
  { id: "opel-motors", name: "Opelt Motors", industry: "auto", region: "dach", flavorBase: "Volksnaher Auto-Partner." },
  { id: "man-truck", name: "MÄN Truck & Bus", industry: "auto", region: "dach", flavorBase: "Nutzfahrzeug-Sponsor mit robuster Basis." },
  { id: "schaeffler-antrieb", name: "Schäffner Antrieb", industry: "auto", region: "dach", flavorBase: "Zulieferer mit Entwicklungsfokus." },
  { id: "mahle-motoren", name: "Mahlke Motoren", industry: "auto", region: "dach", flavorBase: "Motorenbauer mit technischen Sonderzielen." },
  { id: "webasto-comfort", name: "Webasco Comfort", industry: "auto", region: "dach", flavorBase: "Komfort-Technik für ausgewogene Deals." },
  { id: "allianz-versicherung", name: "Alleanz Versicherung", industry: "finance", region: "dach", flavorBase: "Versicherer — Sicherheit first." },
  { id: "muenchener-rueck", name: "Münchhausen Rück", industry: "finance", region: "dach", flavorBase: "Rückversicherer mit konservativem Profil." },
  { id: "deutsche-bank", name: "Teutonia Bank Partner", industry: "finance", region: "dach", flavorBase: "Finanzhaus mit Premium-Paketen." },
  { id: "commerzbank-sport", name: "Kommerzbank Sport", industry: "finance", region: "dach", flavorBase: "Bank-Sponsor mit Leistungsbonus." },
  { id: "sparkassen-allianz", name: "Sparkasten Allianz", industry: "finance", region: "dach", flavorBase: "Regionalbank-Netzwerk." },
  { id: "dws-investments", name: "DVS Investments", industry: "finance", region: "dach", flavorBase: "Fondshaus mit Upside-Klauseln." },
  { id: "talanx-gruppe", name: "Talanix Gruppe", industry: "finance", region: "dach", flavorBase: "Versicherungsgruppe mit breitem Portfolio." },
  { id: "ergo-versicherung", name: "Ergono Versicherung", industry: "finance", region: "dach", flavorBase: "Versicherer mit Fan-Programm." },
  { id: "hannover-rueck", name: "Hannober Rück", industry: "finance", region: "dach", flavorBase: "Rückversicherung — planbare Zahlungen." },
  { id: "uniper-finance", name: "Unipor Energy Finance", industry: "energy", region: "dach", flavorBase: "Energie-Finanzierung mit saisonalen Boni." },
  { id: "telekom-mobil", name: "Telecom Teutonia Mobil", industry: "telecom", region: "dach", flavorBase: "Telekom-Riese mit Medien-Power." },
  { id: "vodafone-arena", name: "Wodaphone Arena Partner", industry: "telecom", region: "dach", flavorBase: "Mobilfunk mit Stadion-Präsenz." },
  { id: "o2-telefonica", name: "Oh2 Telefonika", industry: "telecom", region: "dach", flavorBase: "Telekom-Partner mit jungem Profil." },
  { id: "prosieben-media", name: "ProAcht Media", industry: "media", region: "dach", flavorBase: "TV-Sender mit Reichweiten-Bonus." },
  { id: "rtl-deutschland", name: "RTK Deutschland", industry: "media", region: "dach", flavorBase: "Entertainment-Sponsor mit Sonderzielen." },
  { id: "axel-springer", name: "Axel Sprenger Media", industry: "media", region: "dach", flavorBase: "Medienhaus mit PR-Aktivierungen." },
  { id: "bertelsmann-content", name: "Bertelsmeier Content", industry: "media", region: "dach", flavorBase: "Content-Konzern mit Identitäts-Fokus." },
  { id: "wdr-sport", name: "WRD Sportpartner", industry: "media", region: "dach", flavorBase: "Öffentlich-rechtlicher Sportpartner." },
  { id: "deutsche-bahn", name: "Teutonia Bahn Mobilität", industry: "logistics", region: "dach", flavorBase: "Mobilität und Logistik vereint." },
  { id: "lufthansa-sky", name: "Luftbansa Sky Partner", industry: "airline", region: "dach", flavorBase: "Fluglinie mit globalem Profil." },
  { id: "eurowings-connect", name: "Euroschwingen Connect", industry: "airline", region: "dach", flavorBase: "Regionalflieger — solide Basis." },
  { id: "dhl-logistik", name: "DXL Logistik", industry: "logistics", region: "dach", flavorBase: "Logistik-Gigant mit Transfer-Fokus." },
  { id: "hermes-paket", name: "Hermos Paket", industry: "logistics", region: "dach", flavorBase: "Paketdienst mit schnellen Boni." },
  { id: "tchibo-kaffee", name: "Tschimbo Kaffee", industry: "food", region: "dach", flavorBase: "Kaffee-Röster mit Fan-Kultur." },
  { id: "dr-oetker", name: "Dr. Oedeker Gastronomie", industry: "food", region: "dach", flavorBase: "Food-Partner mit Event-Potenzial." },
  { id: "haribo-suesswaren", name: "Harimbo Süßwaren", industry: "food", region: "dach", flavorBase: "Süßwaren — fröhlicher Sponsor." },
  { id: "ritter-sport", name: "Ritterburg Sport", industry: "food", region: "dach", flavorBase: "Schokolade mit regionalem Charme." },
  { id: "henkel-waschmittel", name: "Henkelmann Waschmittel", industry: "retail", region: "dach", flavorBase: "Konsumgüter mit stabiler Basis." },
  { id: "adidas-sport", name: "Adivas Sport Performance", industry: "sport", region: "dach", flavorBase: "Sportmarke — Leistung im Fokus." },
  { id: "puma-athletica", name: "Pumao Athletica", industry: "sport", region: "dach", flavorBase: "Athletik-Sponsor mit Rang-Boni." },
  { id: "hugo-boss", name: "Hugo Bosser Premium", industry: "retail", region: "dach", flavorBase: "Premium-Mode für Elite-Teams." },
  { id: "zalando-fashion", name: "Zalendo Fashion", industry: "retail", region: "dach", flavorBase: "Online-Mode mit jungem Publikum." },
  { id: "otto-versand", name: "Ottokar Versand", industry: "retail", region: "dach", flavorBase: "Versandhandel — planbare Deals." },
  { id: "mediamarkt-saturn", name: "Medienmarkt Jupiter", industry: "retail", region: "dach", flavorBase: "Elektronik-Handel mit Medien-Power." },
  { id: "conrad-elektronik", name: "Konradin Elektronik", industry: "retail", region: "dach", flavorBase: "Tech-Handel für datenaffine Teams." },
  { id: "beiersdorf-nivea", name: "Beiersburg Nivella", industry: "retail", region: "dach", flavorBase: "Kosmetik mit breiter Fanbasis." },
  { id: "montblanc-writing", name: "Montblanko Writing", industry: "retail", region: "dach", flavorBase: "Luxus-Schreibwaren — Prestige-Sponsor." },
  { id: "wuerth-handwerk", name: "Würtz Handwerk", industry: "retail", region: "dach", flavorBase: "Handwerks-Zulieferer mit Solidität." },
  { id: "teslara-motors", name: "Teslara Motors", industry: "auto", region: "global", flavorBase: "Elektro-Auto-Pionier mit Upside." },
  { id: "apple-core", name: "Apfelkern Technology", industry: "tech", region: "global", flavorBase: "Tech-Ikone — Premium-Sponsoring." },
  { id: "microsoft-dynamics", name: "Mikroweich Dynamics", industry: "tech", region: "global", flavorBase: "Software-Riese mit Enterprise-Deals." },
  { id: "alphasearch-global", name: "Alphasearch Global", industry: "tech", region: "global", flavorBase: "Suchmaschinen-Gigant mit Reichweite." },
  { id: "rainforest-commerce", name: "Rainforest Commerce", industry: "retail", region: "global", flavorBase: "E-Commerce mit Logistik-Bonus." },
  { id: "metaworld-social", name: "Metaworld Social", industry: "media", region: "global", flavorBase: "Social-Media mit Aktivierungs-Events." },
  { id: "flixnet-media", name: "Flixnet Media", industry: "media", region: "global", flavorBase: "Streaming mit Entertainment-Fokus." },
  { id: "oracle-enterprise", name: "Orakel Enterprise", industry: "tech", region: "global", flavorBase: "Enterprise-Tech mit anspruchsvollen Zielen." },
  { id: "ibm-watson", name: "IBN Wattson Tech", industry: "tech", region: "global", flavorBase: "KI-Tech mit analytischen Klauseln." },
  { id: "salesforce-crm", name: "Salesforge CRM", industry: "tech", region: "global", flavorBase: "Cloud-CRM mit Wachstumsbonus." },
  { id: "toyota-way", name: "Toyato Way Mobility", industry: "auto", region: "global", flavorBase: "Zuverlässigkeit und Effizienz." },
  { id: "honda-engineering", name: "Hanta Engineering", industry: "auto", region: "global", flavorBase: "Engineering-Kultur mit Disziplin-Fokus." },
  { id: "volvo-safety", name: "Volvox Safety Motor", industry: "auto", region: "global", flavorBase: "Sicherheits-Auto — konservatives Profil." },
  { id: "shell-energy", name: "Muschel Energy", industry: "energy", region: "global", flavorBase: "Energie-Konzern mit globaler Reichweite." },
  { id: "total-energies", name: "Totalis Energies", industry: "energy", region: "global", flavorBase: "Energie-Partner mit Performance-Klauseln." },
  { id: "red-stag-energy", name: "Red Stag Energy", industry: "sport", region: "global", flavorBase: "Energy-Drink — extreme Leistungsboni." },
  { id: "nike-just-win", name: "Nyke Just Win", industry: "sport", region: "global", flavorBase: "Sportswear-Gigant mit Titelambition." },
  { id: "cola-classic", name: "Koka-Kolla Beverages", industry: "food", region: "global", flavorBase: "Getränke-Riese mit Massen-Appeal." },
  { id: "golden-arches", name: "Mac Dougall's Restaurants", industry: "food", region: "global", flavorBase: "Fast-Food mit Event-Potenzial." },
  { id: "starbucks-coffee", name: "Sternbucks Coffee Co", industry: "food", region: "global", flavorBase: "Coffee-Chain mit Lifestyle-Profil." },
  { id: "mastercard-payments", name: "Meistercard Payments", industry: "finance", region: "global", flavorBase: "Zahlungsdienst mit Premium-Deals." },
  { id: "visa-worldwide", name: "Visum Worldwide", industry: "finance", region: "global", flavorBase: "Globale Zahlungen — solide Basis." },
  { id: "fedex-express", name: "Fedox Express", industry: "logistics", region: "global", flavorBase: "Express-Logistik mit Speed-Bonus." },
  { id: "ups-brown", name: "UPZ Braun Logistics", industry: "logistics", region: "global", flavorBase: "Paketriese mit Transfer-Fokus." },
  { id: "pfizer-pharma", name: "Pfeifer Pharma", industry: "pharma", region: "global", flavorBase: "Pharma-Global mit Langfrist-Deals." },
  { id: "johnson-health", name: "Jackson & Jackson Health", industry: "pharma", region: "global", flavorBase: "Healthcare mit Entwicklungszielen." },
  { id: "emirates-airlines", name: "Emiratos Airlines", industry: "airline", region: "global", flavorBase: "Luxus-Airline — Elite-Sponsoring." },
  { id: "qatar-sky", name: "Qatara Sky Airways", industry: "airline", region: "global", flavorBase: "Premium-Flieger mit globalem Profil." },
  { id: "heineken-brewery", name: "Heinicken Brewery", industry: "food", region: "global", flavorBase: "Brauerei mit Fan-Events." },
  { id: "ikea-home", name: "IKEO Home Arena", industry: "retail", region: "global", flavorBase: "Möbel-Riese mit Stadion-Präsenz." },
  // --- Erweiterung auf 200 Marken -------------------------------------------------------------
  // 32 Teams x 5 Angebote = 160 Angebote pro Saison. Erst ab >=160 Marken kann JEDES Angebot der
  // gesamten Liga eine eigene Marke tragen (GLOBAL_PARENT_MAX_TEAMS = 1 in sponsor-brand-catalog.ts)
  // -- damit kann auch kein Team denselben Sponsor unter Vertrag haben wie ein anderes. Der Puffer
  // auf 200 haelt die Auswahl rotierend, statt sie bei exakt 160 zur Zwangszuteilung zu machen.
  //
  // Aufteilung ueber den GESAMTEN Katalog: 100 deutsche und 100 internationale Marken. Die
  // Namen sind seit 22.11. eigene Parodien (sponsor-brand-alte-namen.ts, docs/design/sponsor-namen-22-11.md).

  // --- Deutschland (Ergaenzung auf 100) ---
  { id: "edeka-frischemarkt", name: "Edeko Frischemarkt", industry: "retail", region: "dach", flavorBase: "Vollsortimenter mit regionaler Verwurzelung." },
  { id: "dm-drogeriemarkt", name: "dn Drogeriemarkt", industry: "retail", region: "dach", flavorBase: "Werteorientierter Handelspartner." },
  { id: "rossmann-drogerie", name: "Rossmeier Drogerie", industry: "retail", region: "dach", flavorBase: "Drogeriekette mit hoher Kundenfrequenz." },
  { id: "douglas-beauty", name: "Dougall Beauty", industry: "retail", region: "dach", flavorBase: "Beauty-Marke mit Premium-Anspruch." },
  { id: "deichmann-schuhe", name: "Deichmeier Schuhe", industry: "retail", region: "dach", flavorBase: "Schuhhandel mit Volumen-Strategie." },
  { id: "galeria-kaufhof", name: "Galeria Kaufhalle", industry: "retail", region: "dach", flavorBase: "Warenhaus-Traditionsmarke im Umbau." },
  { id: "fressnapf-tierbedarf", name: "Fresstrog Tierbedarf", industry: "retail", region: "dach", flavorBase: "Fachhandel mit treuer Stammkundschaft." },
  { id: "netto-markendiscount", name: "Nettio Markendiscount", industry: "retail", region: "dach", flavorBase: "Discounter mit knapper, planbarer Kalkulation." },
  { id: "penny-markt", name: "Pfennig Markt", industry: "retail", region: "dach", flavorBase: "Nahversorger mit Fokus auf Breitenwirkung." },
  { id: "fischer-duebelwerke", name: "Fischler Dübelwerke", industry: "retail", region: "dach", flavorBase: "Befestigungsspezialist mit Ingenieursstolz." },
  { id: "zeiss-optik", name: "Zeuss Optik", industry: "tech", region: "dach", flavorBase: "Praezisionsoptik mit Forschungstiefe." },
  { id: "trumpf-lasertechnik", name: "Trumpfel Lasertechnik", industry: "tech", region: "dach", flavorBase: "Lasertechnik fuer hochgenaue Fertigung." },
  { id: "miele-hausgeraete", name: "Miela Hausgeräte", industry: "tech", region: "dach", flavorBase: "Langlebigkeit als Markenversprechen." },
  { id: "stihl-motorgeraete", name: "Stiehl Motorgeräte", industry: "tech", region: "dach", flavorBase: "Motorgeraete mit robustem Auftritt." },
  { id: "hilti-befestigung", name: "Hilto Befestigung", industry: "tech", region: "dach", flavorBase: "Bau-Profi mit Direktvertriebs-Naehe." },
  { id: "sennheiser-audio", name: "Sennhauser Audio", industry: "media", region: "dach", flavorBase: "Audiotechnik mit Studio-Reputation." },
  { id: "leica-kamera", name: "Leiko Kamera", industry: "media", region: "dach", flavorBase: "Kamerabau als Handwerkskunst." },
  { id: "sky-deutschland-sport", name: "Himmel Deutschland Sport", industry: "media", region: "dach", flavorBase: "Pay-TV mit Live-Rechte-Fokus." },
  { id: "brose-fahrzeugteile", name: "Brosse Fahrzeugteile", industry: "auto", region: "dach", flavorBase: "Zulieferer mit Mechatronik-Schwerpunkt." },
  { id: "hella-fahrzeuglicht", name: "Hellix Fahrzeuglicht", industry: "auto", region: "dach", flavorBase: "Lichttechnik, die Auftritte sichtbar macht." },
  { id: "recaro-sitze", name: "Rekaro Sitze", industry: "auto", region: "dach", flavorBase: "Sitzsysteme zwischen Sport und Komfort." },
  { id: "dekra-pruef", name: "Dekrax Prüfstelle", industry: "auto", region: "dach", flavorBase: "Pruefkonzern mit Sicherheits-Anspruch." },
  { id: "knorr-bremssysteme", name: "Knarr Bremssysteme", industry: "auto", region: "dach", flavorBase: "Bremssysteme fuer Schiene und Strasse." },
  { id: "eon-energie", name: "E.ONN Energie", industry: "energy", region: "dach", flavorBase: "Energieversorger im Netzumbau." },
  { id: "rwe-power-partner", name: "RVE Power Partner", industry: "energy", region: "dach", flavorBase: "Erzeuger mit Transformationsdruck." },
  { id: "enbw-strom", name: "EnWB Strom", industry: "energy", region: "dach", flavorBase: "Versorger mit Ausbau-Offensive." },
  { id: "viessmann-waerme", name: "Wiessmann Wärmesysteme", industry: "energy", region: "dach", flavorBase: "Heiztechnik im Generationenbetrieb." },
  { id: "kuehne-nagel-fracht", name: "Kühle & Nagel Fracht", industry: "logistics", region: "dach", flavorBase: "Seefracht-Spezialist mit globalem Netz." },
  { id: "db-schenker-fracht", name: "TB Schenkel Fracht", industry: "logistics", region: "dach", flavorBase: "Landverkehr mit Bahn-Anbindung." },
  { id: "dachser-logistik", name: "Dachsbau Logistik", industry: "logistics", region: "dach", flavorBase: "Familienlogistiker mit Netzdichte." },

  // --- International (Ergaenzung auf 100) ---
  { id: "samsung-electronics", name: "Samsang Electronics", industry: "tech", region: "global", flavorBase: "Elektronik-Konzern mit Sponsoring-Volumen." },
  { id: "lg-electronics", name: "LJ Electronics", industry: "tech", region: "global", flavorBase: "Displays und Hausgeraete aus Suedkorea." },
  { id: "sony-entertainment", name: "Sonnie Entertainment", industry: "tech", region: "global", flavorBase: "Unterhaltungselektronik mit Studio-Arm." },
  { id: "panasonic-systems", name: "Panasonik Systems", industry: "tech", region: "global", flavorBase: "Systemtechnik mit langfristigen Vertraegen." },
  { id: "intel-processors", name: "Inteil Processors", industry: "tech", region: "global", flavorBase: "Prozessor-Riese mit Fertigungs-Ambition." },
  { id: "nvidia-graphics", name: "Envidia Graphics", industry: "tech", region: "global", flavorBase: "Grafik- und KI-Chips im Hoehenflug." },
  { id: "amd-semiconductor", name: "AMB Semiconductor", industry: "tech", region: "global", flavorBase: "Herausforderer mit Comeback-Geschichte." },
  { id: "dell-technologies", name: "Dahl Technologies", industry: "tech", region: "global", flavorBase: "Direktvertrieb fuer Business-Hardware." },
  { id: "hp-hardware", name: "HQ Hardware", industry: "tech", region: "global", flavorBase: "Drucker und Notebooks im Volumenmarkt." },
  { id: "lenovo-computing", name: "Lenavo Computing", industry: "tech", region: "global", flavorBase: "Groesster PC-Hersteller der Welt." },
  { id: "xiaomi-mobile", name: "Xiaomu Mobile", industry: "tech", region: "global", flavorBase: "Preisaggressive Smartphone-Marke." },
  { id: "huawei-networks", name: "Huwai Networks", industry: "tech", region: "global", flavorBase: "Netzausruester mit globaler Praesenz." },
  { id: "canon-imaging", name: "Kanon Imaging", industry: "tech", region: "global", flavorBase: "Kamera- und Drucktechnik aus Japan." },
  { id: "philips-healthtech", name: "Filipps Healthtech", industry: "tech", region: "global", flavorBase: "Medizintechnik mit Konsumgueter-Erbe." },
  { id: "adobe-creative", name: "Abode Creative", industry: "tech", region: "global", flavorBase: "Kreativ-Software im Abo-Modell." },
  { id: "cisco-networking", name: "Cisko Networking", industry: "tech", region: "global", flavorBase: "Netzwerk-Infrastruktur fuer Konzerne." },
  { id: "chrysler-motors", name: "Kreisler Motors", industry: "auto", region: "global", flavorBase: "US-Traditionsmarke mit Muscle-Car-Erbe." },
  { id: "ford-motor-company", name: "Fjord Motor Company", industry: "auto", region: "global", flavorBase: "Massenfertigung als Erfindung des Hauses." },
  { id: "general-motors", name: "Generic Motors", industry: "auto", region: "global", flavorBase: "US-Konzern mit breitem Markenportfolio." },
  { id: "hyundai-motor-group", name: "Hyondai Motor Group", industry: "auto", region: "global", flavorBase: "Autobauer mit aggressiver Marken-Offensive." },
  { id: "kia-motors", name: "Kiya Motors", industry: "auto", region: "global", flavorBase: "Design-getriebene Schwestermarke." },
  { id: "nissan-motor", name: "Nissen Motor", industry: "auto", region: "global", flavorBase: "Volumenhersteller mit Elektro-Vorsprung." },
  { id: "mazda-motor", name: "Mazdi Motor", industry: "auto", region: "global", flavorBase: "Eigenwilliger Ingenieursweg." },
  { id: "renault-mobility", name: "Renolt Mobility", industry: "auto", region: "global", flavorBase: "Mobilitaets-Konzern mit Motorsport-Erbe." },
  { id: "peugeot-automobiles", name: "Peujot Automobiles", industry: "auto", region: "global", flavorBase: "Franzoesischer Hersteller mit Loewen-Wappen." },
  { id: "fiat-automobili", name: "Fiato Automobili", industry: "auto", region: "global", flavorBase: "Italienischer Kleinwagen-Spezialist." },
  { id: "ferrari-corse", name: "Ferrali Corse", industry: "sport", region: "global", flavorBase: "Rennsport-Ikone mit Preisaufschlag." },
  { id: "lamborghini-automobili", name: "Lambargini Automobili", industry: "auto", region: "global", flavorBase: "Supersportwagen mit Show-Faktor." },
  { id: "jaguar-land-rover", name: "Jagwar Land Roamer", industry: "auto", region: "global", flavorBase: "Britische Premium-Doppelmarke." },
  { id: "skoda-auto", name: "Skodra Auto", industry: "auto", region: "global", flavorBase: "Vernunft-Marke mit Radsport-Historie." },
  { id: "michelin-reifen", name: "Mitchelin Reifen", industry: "auto", region: "global", flavorBase: "Reifenhersteller mit eigenem Sterne-Guide." },
  { id: "pirelli-tyres", name: "Pirelo Tyres", industry: "auto", region: "global", flavorBase: "Formel-1-Ausruester aus Mailand." },
  { id: "goodyear-tires", name: "Goodyard Tires", industry: "auto", region: "global", flavorBase: "US-Reifenmarke mit Luftschiff-Logo." },
  { id: "harley-davidson", name: "Harly-Davison", industry: "auto", region: "global", flavorBase: "Motorrad-Kult mit Sound-Signatur." },
  { id: "carrefour-retail", name: "Carrefort Retail", industry: "retail", region: "global", flavorBase: "Handelskonzern mit europaeischer Flaeche." },
  { id: "walmart-stores", name: "Walmarkt Stores", industry: "retail", region: "global", flavorBase: "Groesster Einzelhaendler der Welt." },
  { id: "costco-wholesale", name: "Costko Wholesale", industry: "retail", region: "global", flavorBase: "Mitglieder-Grosshandel mit Kultstatus." },
  { id: "zara-fashion", name: "Zora Fashion", industry: "retail", region: "global", flavorBase: "Fast-Fashion mit kurzen Zyklen." },
  { id: "hm-fashion", name: "H&N Fashion", industry: "retail", region: "global", flavorBase: "Schwedische Modekette mit Massenreichweite." },
  { id: "uniqlo-basics", name: "Uniklo Basics", industry: "retail", region: "global", flavorBase: "Japanische Basics mit Funktionsanspruch." },
  { id: "levis-jeans", name: "Levvi's Jeans", industry: "retail", region: "global", flavorBase: "Jeans-Original mit Nietenpatent." },
  { id: "gucci-luxury", name: "Gucchi Luxury", industry: "retail", region: "global", flavorBase: "Luxusmode mit Logo-Kraft." },
  { id: "rolex-timepieces", name: "Rolux Timepieces", industry: "retail", region: "global", flavorBase: "Uhrmacher mit Sport-Sponsoring-Tradition." },
  { id: "loreal-cosmetics", name: "LaRoyal Cosmetics", industry: "retail", region: "global", flavorBase: "Kosmetik-Weltmarktfuehrer." },
  { id: "nestle-nutrition", name: "Nestel Nutrition", industry: "food", region: "global", flavorBase: "Nahrungsmittel-Riese mit Markenportfolio." },
  { id: "pepsico-beverages", name: "PapsiCo Beverages", industry: "food", region: "global", flavorBase: "Getraenke und Snacks im Doppelpack." },
  { id: "danone-dairy", name: "Danona Dairy", industry: "food", region: "global", flavorBase: "Molkerei-Konzern mit Gesundheitsfokus." },
  { id: "unilever-brands", name: "Unilover Brands", industry: "food", region: "global", flavorBase: "Konsumgueter-Haus mit Markenvielfalt." },
  { id: "procter-gamble", name: "Prokter & Gambel", industry: "food", region: "global", flavorBase: "Haushaltsmarken mit Werbebudget." },
  { id: "kelloggs-cereals", name: "Kellock's Cereals", industry: "food", region: "global", flavorBase: "Fruehstuecksflocken-Klassiker." },
  { id: "mars-confectionery", name: "Mors Confectionery", industry: "food", region: "global", flavorBase: "Suesswaren-Riese in Familienbesitz." },
  { id: "ferrero-suesswaren", name: "Ferrara Süßwaren", industry: "food", region: "global", flavorBase: "Italienische Suesswaren mit Kultmarken." },
  { id: "lindt-schokolade", name: "Lindtz Schokolade", industry: "food", region: "global", flavorBase: "Schweizer Premium-Schokolade." },
  { id: "carlsberg-brewery", name: "Karlsbrau Brewery", industry: "food", region: "global", flavorBase: "Daenische Brauerei mit Fussball-Historie." },
  { id: "guinness-stout", name: "Guinnis Stout", industry: "food", region: "global", flavorBase: "Irisches Stout mit Rekordbuch." },
  { id: "nike-just-do-it", name: "Nikay Sportswear", industry: "sport", region: "global", flavorBase: "Sportmarke mit Athleten-Portfolio." },
  { id: "reebok-athletics", name: "Reebuk Athletics", industry: "sport", region: "global", flavorBase: "Fitness-Marke mit Retro-Appeal." },
  { id: "under-armour-gear", name: "Unter Amour Gear", industry: "sport", region: "global", flavorBase: "Funktionsbekleidung mit Underdog-Story." },
  { id: "new-balance-running", name: "Neu Balanz Running", industry: "sport", region: "global", flavorBase: "Laufschuhe mit Breiten-Passform." },
  { id: "asics-running", name: "Asyx Running", industry: "sport", region: "global", flavorBase: "Japanische Laufschuh-Technik." },
  { id: "converse-classics", name: "Conversa Classics", industry: "sport", region: "global", flavorBase: "Basketball-Klassiker als Streetwear." },
  { id: "decathlon-sport", name: "Dekathlon Sport", industry: "sport", region: "global", flavorBase: "Sport-Discounter mit Eigenmarken." },
  { id: "paypal-payments", name: "PayPol Payments", industry: "finance", region: "global", flavorBase: "Online-Zahlungen mit Reichweite." },
  { id: "american-express", name: "Americano Express", industry: "finance", region: "global", flavorBase: "Premium-Karte mit Service-Versprechen." },
  { id: "hsbc-banking", name: "HSBK Banking", industry: "finance", region: "global", flavorBase: "Grossbank mit Asien-Schwerpunkt." },
  { id: "barclays-bank", name: "Barkley's Bank", industry: "finance", region: "global", flavorBase: "Britische Bank mit Liga-Sponsoring-Historie." },
  { id: "ubs-wealth", name: "UBX Wealth", industry: "finance", region: "global", flavorBase: "Schweizer Vermoegensverwaltung." },
  { id: "jpmorgan-chase", name: "JPMorgen Chaser", industry: "finance", region: "global", flavorBase: "US-Investmentbank mit Bilanzmacht." },
  { id: "santander-bank-partner", name: "Santandor Bank Partner", industry: "finance", region: "global", flavorBase: "Retail-Bank mit Sport-Sponsoring-Budget." },
  { id: "zurich-insurance", name: "Zürick Insurance", industry: "finance", region: "global", flavorBase: "Versicherer mit Konzern-Klientel." },
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
