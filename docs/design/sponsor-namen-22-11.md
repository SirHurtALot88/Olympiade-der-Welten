# Sponsor-Namen: eigene Parodien statt echter Marken (22.11.)

Chris, 22.11.: „wenn du sowas wie Red Stag etc. hast, musst du natürlich die Namen der Sponsoren noch anpassen! dass ingame
alle so heißen wie auch auf den Logos“. Davor: „du sollst für die Sponsoren-Logos n eigenen Stil finden, auch wenn die Marken
sehr an echte angelehnt sind. Du darfst dich auch anlehnen. Wir sind hier u. a. auch privat und nicht kommerziell unterwegs.“

## 1. Was sich ändert

- Alle **200 Dachmarken** in `lib/sponsor/sponsor-brand-parents.ts` tragen einen eigenen, an das Vorbild angelehnten Namen
  (Tabelle unten). Die **`id` bleibt unverändert**; Spielstände, Verträge, Marken-Historie und Wappen-Dateien hängen daran.
  Werte, Geld und Auswahl-Logik sind nicht berührt (Fingerabdruck GESAMT unverändert `fe1dc086d68d`).
- Die drei Probe-Wappen aus PR #1697 behalten genau ihre Namen: `red-stag-energy` = **Red Stag Energy** (Vorbild Red Bull),
  `rainforest-commerce` = **Rainforest Commerce** (Amazon), `alphasearch-global` = **Alphasearch Global** (Google/Alphabet).
- Die echten Namen stehen nur noch in `lib/sponsor/sponsor-brand-alte-namen.ts` (id → alter Name), und zwar für die Lade-Migration
  und als **Sperrliste** im Test. Sie werden nirgends angezeigt.
- Namensregel: erkennbar angelehnt (Klang, Wortspiel, Übersetzung), aber kein echter Markenname; jeder Name ist im Katalog eindeutig.
  Die Beschreibungstexte (`flavorBase`) nennen keine echte Marke; der Test prüft das gegen die Sperrliste.

## 2. Stehen Namen im Spielstand?

**Ja, an drei Stellen** (Typen in `lib/data/olyDataTypes.ts`):

| Ort im Spielstand | Feld | Quelle |
|---|---|---|
| Angebote `seasonState.sponsorOffersByTeamId[]` | `name` (Kopie von `parent.name` beim Bau) | `sponsor-offer-service.ts` |
| Verträge `seasonState.sponsorContractsByTeamId` | `name` (aus dem gewählten Angebot kopiert) | `chooseSponsorOffer` |
| Ereignisse `seasonState.sponsorEvents[]` | `sponsorName` und `message` (Text mit Namen; die Inbox-Karte liest `message`) | `sponsor-event-service.ts` |

Nicht im Spielstand als Text: Marken-Historie (`sponsorBrandHistoryByTeamId`, nur ids), Auszahlungs-Log (nur Beträge), Finanzzeilen und
Inbox-Einträge der Vertragswahl (leiten live ab).

**Lösung: Lade-Migration** `migriereSponsorNamen` (`lib/sponsor/sponsor-namen-migration.ts`), eingehängt im Ladeweg von
`materializePersistedSave` (`lib/persistence/save-repository.ts`, direkt nach den übrigen Nachzügen). Sie setzt bei Angeboten und
Verträgen den Namen aus der `sponsorParentBrandId` (sonst über die Tabelle alter Name → neuer Name) und ersetzt in Ereignissen
`sponsorName` und jeden alten Namen im Nachrichtentext. Nur Namen ändern sich, kein Betrag. Idempotent (zweiter Lauf liefert dasselbe
Objekt zurück). Nach dem ersten Laden und Speichern zeigt der Spielstand nirgends mehr einen echten Namen. Neu gebaute Angebote
tragen den neuen Namen von Anfang an, weil sie `parent.name` kopieren.

## 3. Getränke-Partner und Essen/Trinken

Konzept `docs/design/zwischen-den-spieltagen-22-11.md` (§76, §78) und Mockup `public/mockups/zwischen-den-spieltagen-22-11.html`
sind umgestellt. Wo es im Sponsor-Katalog eine passende Dachmarke gibt, nutzt die Partner-Linie genau diesen Namen; sonst gibt es einen
neuen, im selben Stil gebauten Namen. Icon-Probe: `public/sprites/verpflegung/quellen.json` und Galerie
`public/mockups/gm-galerie-22-11.html` tragen die neuen Beschriftungen (die Bilder selbst sind marken-neutral und blieben).

| Alt (echt) | Neu | Hinweis |
|---|---|---|
| Red Bull | Red Stag Energy | Dachmarke `red-stag-energy` (Probe-Wappen), Partner-Linie |
| Monster (Energy) | Monstrum (Energy) | eigener Partner-Name, keine Dachmarke im Katalog |
| Coca-Cola | Koka-Kolla | Dachmarke `cola-classic` (Koka-Kolla Beverages), Partner-Linie |
| Pepsi | Papsi | Dachmarke `pepsico-beverages` (PapsiCo Beverages) |
| Gatorade | Gatorlade | eigener Partner-Name |
| Club-Mate | Klub-Matte | eigener Partner-Name |
| Carlsberg | Karlsbrau | Dachmarke `carlsberg-brewery` (Karlsbrau Brewery), Partner-Linie |
| Jägermeister | Jagdmeister | eigener Partner-Name |
| Lavazza | Lavazzo | eigener Partner-Name |
| Haribo (Goldbären) | Harimbo (Goldbären) | Dachmarke `haribo-suesswaren` (Harimbo Süßwaren) |
| Snickers | Snackers | eigener Name (Dachmarke Mors Confectionery wäre die Herstellerfirma) |
| Aperol (Spritz) | Aperoll (Spritz) | Fund-Artikel |
| Bacardí (Mojito) | Bakardi (Mojito) | Fund-Artikel |
| Pitú (Caipirinha) | Pituh (Caipirinha) | Fund-Artikel |
| Kahlúa (Espresso Martini) | Kahluna (Espresso Martini) | Fund-Artikel |
| José Cuervo (Tequila Shot) | José Cuervero (Tequila Shot) | Fund-Artikel |
| Guinness | Guinnis | Dachmarke `guinness-stout` (Guinnis Stout) |
| PowerBar (Proteinriegel) | KraftBarr (Proteinriegel) | Fund-Artikel |
| innocent (Smoothie) | Unschuld (Smoothie) | Fund-Artikel |
| Chiquita (Banane) | Chiquito (Banane) | Fund-Artikel |
| Kölln (Haferflocken) | Köllner (Haferflocken) | Fund-Artikel |
| Volvic (Wasser) | Volvix (Wasser) | Fund-Artikel |
| Teekanne (Grüner Tee) | Teekännchen (Grüner Tee) | Fund-Artikel |
| Big Mac (McDonald's) | Big Mäc (Mac Dougall's) | Dachmarke `golden-arches` (Mac Dougall's Restaurants) |
| Whopper (Burger King) | Woppa (Burger Kaiser) | Fund-Artikel |
| Pizza (Domino's) | Pizza (Dominik's) | Fund-Artikel |
| Bucket (KFC) | Bucket (KFK) | Fund-Artikel |
| Döner, Currywurst, Poke Bowl | unverändert | keine Marken, nur Gerichte |

Weitere Fundstellen mit Marken-Beispielen sind ebenfalls umgestellt: `public/mockups/office-modern-18-11.html`,
`public/mockups/inbox-modern-18-11.html`, `docs/mockups/sponsoren-gebaeude.html`, `docs/SPONSOREN_BAUVORLAGE.md`,
`docs/SPONSOREN_GEBAEUDE_KONZEPT.md`, `docs/design/fehlende-seiten-mockups-18-11.md`. Bewusst nicht angefasst: historische
Rechercheabschnitte (Red Bull BC One in den Breaking-Dokumenten, Red Bull Racing in den Saisonökonomie-Entwürfen), weil dort die
echte Welt gemeint ist, und das ASCII-Kästchen in `docs/SPONSOREN_REWORK_KONZEPT.md` (Layout-Skizze mit festen Spaltenbreiten).

## 4. Tests

- `tests/sponsor-namen.test.ts`: 200 neue Namen, jeder anders als der alte; **kein alter Name** in Katalog, Flavour oder Varianten
  (Sperrliste = die 200 alten Namen); Namen eindeutig; die drei Probe-Wappen heißen genau wie auf dem Logo; Lade-Migration für Angebote,
  Verträge, Ereignisse, ohne Geldänderung, idempotent.
- `tests/sponsor-v26.test.ts`: harte Namens-Erwartungen auf die neuen Namen umgestellt.

## 5. Liste alt → neu (alle 200 Dachmarken)

Zum Gegenlesen. Die Reihenfolge ist die des Katalogs (zuerst die ersten 100 Marken, dann die Erweiterung auf 200).

| Nr. | id | Alt (echt) | Neu |
|---:|---|---|---|
| 1 | `obi-baumarkt` | O.B.I. Baumarkt | Oberbau Baumarkt |
| 2 | `hornbach-co` | Hornbach & Co | Hornberg & Co |
| 3 | `bauhaus-arena` | Bauhaus Arena | Bauhütte Arena |
| 4 | `toom-werkstadt` | Toom Werkstatt | Tumm Werkstatt |
| 5 | `hagebau-united` | Hagebau United | Hagelbau United |
| 6 | `aldi-nordpack` | Aldi Nordpack | Alldi Nordpack |
| 7 | `lidl-plus` | Lidl Plus | Liedl Plus |
| 8 | `rewe-united` | Rewe United | Rewo United |
| 9 | `kaufland-gruppe` | Kaufland Gruppe | Kaufwald Gruppe |
| 10 | `metro-grosshandel` | Metro Großhandel | Metra Großhandel |
| 11 | `siemenswerk` | Siemenswerk AG | Simmenswerk AG |
| 12 | `bosch-hausgeraete` | Bosch Hausgeräte | Bosko Hausgeräte |
| 13 | `sap-business` | SAP Business Cloud | SOP Business Cloud |
| 14 | `infineon-chips` | Infineon Chips | Infinitron Chips |
| 15 | `bayer-pharma` | Bayer Pharma Labs | Baier Pharma Labs |
| 16 | `basf-chemie` | BASF Chemie Partner | BASK Chemie Partner |
| 17 | `linde-gases` | Linde Gases | Lindau Gases |
| 18 | `thyssen-stahl` | ThyssenKrupp Stahl | Thürsen Stahl |
| 19 | `evonik-materials` | Evonik Materials | Evonix Materials |
| 20 | `continental-reifen` | Continental Reifen | Kontinent Reifen |
| 21 | `zf-getriebe` | ZF Getriebe | ZG Getriebe |
| 22 | `kuka-automation` | Kuka Automation | Kuxa Automation |
| 23 | `bmw-motoren` | BMW Motoren | BMV Motoren |
| 24 | `mercedes-mobilitaet` | Mercedes-Benz Mobilität | Mercator-Bänz Mobilität |
| 25 | `volkswagen-gruppe` | Volkswagen Gruppe | Völkerwagen Gruppe |
| 26 | `audi-sport` | Audi Sport Partner | Audix Sport Partner |
| 27 | `porsche-holding` | Porsche Holding | Porschen Holding |
| 28 | `opel-motors` | Opel Motors | Opelt Motors |
| 29 | `man-truck` | MAN Truck & Bus | MÄN Truck & Bus |
| 30 | `schaeffler-antrieb` | Schaeffler Antrieb | Schäffner Antrieb |
| 31 | `mahle-motoren` | Mahle Motoren | Mahlke Motoren |
| 32 | `webasto-comfort` | Webasto Comfort | Webasco Comfort |
| 33 | `allianz-versicherung` | Allianz Versicherung | Alleanz Versicherung |
| 34 | `muenchener-rueck` | Münchener Rück | Münchhausen Rück |
| 35 | `deutsche-bank` | Deutsche Bank Partner | Teutonia Bank Partner |
| 36 | `commerzbank-sport` | Commerzbank Sport | Kommerzbank Sport |
| 37 | `sparkassen-allianz` | Sparkassen Allianz | Sparkasten Allianz |
| 38 | `dws-investments` | DWS Investments | DVS Investments |
| 39 | `talanx-gruppe` | Talanx Gruppe | Talanix Gruppe |
| 40 | `ergo-versicherung` | Ergo Versicherung | Ergono Versicherung |
| 41 | `hannover-rueck` | Hannover Rück | Hannober Rück |
| 42 | `uniper-finance` | Uniper Energy Finance | Unipor Energy Finance |
| 43 | `telekom-mobil` | Deutsche Telekom Mobil | Telecom Teutonia Mobil |
| 44 | `vodafone-arena` | Vodafone Arena Partner | Wodaphone Arena Partner |
| 45 | `o2-telefonica` | O2 Telefónica | Oh2 Telefonika |
| 46 | `prosieben-media` | ProSiebenSat.1 Media | ProAcht Media |
| 47 | `rtl-deutschland` | RTL Deutschland | RTK Deutschland |
| 48 | `axel-springer` | Axel Springer Media | Axel Sprenger Media |
| 49 | `bertelsmann-content` | Bertelsmann Content | Bertelsmeier Content |
| 50 | `wdr-sport` | WDR Sportpartner | WRD Sportpartner |
| 51 | `deutsche-bahn` | Deutsche Bahn Mobilität | Teutonia Bahn Mobilität |
| 52 | `lufthansa-sky` | Lufthansa Sky Partner | Luftbansa Sky Partner |
| 53 | `eurowings-connect` | Eurowings Connect | Euroschwingen Connect |
| 54 | `dhl-logistik` | DHL Logistik | DXL Logistik |
| 55 | `hermes-paket` | Hermes Paket | Hermos Paket |
| 56 | `tchibo-kaffee` | Tchibo Kaffee | Tschimbo Kaffee |
| 57 | `dr-oetker` | Dr. Oetker Gastronomie | Dr. Oedeker Gastronomie |
| 58 | `haribo-suesswaren` | Haribo Süßwaren | Harimbo Süßwaren |
| 59 | `ritter-sport` | Ritter Sport | Ritterburg Sport |
| 60 | `henkel-waschmittel` | Henkel Waschmittel | Henkelmann Waschmittel |
| 61 | `adidas-sport` | Adidas Sport Performance | Adivas Sport Performance |
| 62 | `puma-athletica` | Puma Athletica | Pumao Athletica |
| 63 | `hugo-boss` | Hugo Boss Premium | Hugo Bosser Premium |
| 64 | `zalando-fashion` | Zalando Fashion | Zalendo Fashion |
| 65 | `otto-versand` | Otto Versand | Ottokar Versand |
| 66 | `mediamarkt-saturn` | MediaMarkt Saturn | Medienmarkt Jupiter |
| 67 | `conrad-elektronik` | Conrad Elektronik | Konradin Elektronik |
| 68 | `beiersdorf-nivea` | Beiersdorf Nivea | Beiersburg Nivella |
| 69 | `montblanc-writing` | Montblanc Writing | Montblanko Writing |
| 70 | `wuerth-handwerk` | Würth Handwerk | Würtz Handwerk |
| 71 | `teslara-motors` | Tesla Motors | Teslara Motors |
| 72 | `apple-core` | Apple Core Technology | Apfelkern Technology |
| 73 | `microsoft-dynamics` | Microsoft Dynamics | Mikroweich Dynamics |
| 74 | `alphasearch-global` | Google Search | Alphasearch Global |
| 75 | `rainforest-commerce` | Amazon Commerce | Rainforest Commerce |
| 76 | `metaworld-social` | Meta Social | Metaworld Social |
| 77 | `flixnet-media` | Netflix Media | Flixnet Media |
| 78 | `oracle-enterprise` | Oracle Enterprise | Orakel Enterprise |
| 79 | `ibm-watson` | IBM Watson Tech | IBN Wattson Tech |
| 80 | `salesforce-crm` | Salesforce CRM | Salesforge CRM |
| 81 | `toyota-way` | Toyota Way Mobility | Toyato Way Mobility |
| 82 | `honda-engineering` | Honda Engineering | Hanta Engineering |
| 83 | `volvo-safety` | Volvo Safety Motor | Volvox Safety Motor |
| 84 | `shell-energy` | Shell Energy | Muschel Energy |
| 85 | `total-energies` | Total Energies | Totalis Energies |
| 86 | `red-stag-energy` | Red Bull Energy | Red Stag Energy |
| 87 | `nike-just-win` | Nike Just Win | Nyke Just Win |
| 88 | `cola-classic` | Coca-Cola Beverages | Koka-Kolla Beverages |
| 89 | `golden-arches` | McDonalds Restaurants | Mac Dougall's Restaurants |
| 90 | `starbucks-coffee` | Starbucks Coffee Co | Sternbucks Coffee Co |
| 91 | `mastercard-payments` | Mastercard Payments | Meistercard Payments |
| 92 | `visa-worldwide` | Visa Worldwide | Visum Worldwide |
| 93 | `fedex-express` | FedEx Express | Fedox Express |
| 94 | `ups-brown` | UPS Brown Logistics | UPZ Braun Logistics |
| 95 | `pfizer-pharma` | Pfizer Pharma | Pfeifer Pharma |
| 96 | `johnson-health` | Johnson & Johnson Health | Jackson & Jackson Health |
| 97 | `emirates-airlines` | Emirates Airlines | Emiratos Airlines |
| 98 | `qatar-sky` | Qatar Sky Airways | Qatara Sky Airways |
| 99 | `heineken-brewery` | Heineken Brewery | Heinicken Brewery |
| 100 | `ikea-home` | IKEA Home Arena | IKEO Home Arena |
| 101 | `edeka-frischemarkt` | Edeka Frischemarkt | Edeko Frischemarkt |
| 102 | `dm-drogeriemarkt` | dm Drogeriemarkt | dn Drogeriemarkt |
| 103 | `rossmann-drogerie` | Rossmann Drogerie | Rossmeier Drogerie |
| 104 | `douglas-beauty` | Douglas Beauty | Dougall Beauty |
| 105 | `deichmann-schuhe` | Deichmann Schuhe | Deichmeier Schuhe |
| 106 | `galeria-kaufhof` | Galeria Kaufhof | Galeria Kaufhalle |
| 107 | `fressnapf-tierbedarf` | Fressnapf Tierbedarf | Fresstrog Tierbedarf |
| 108 | `netto-markendiscount` | Netto Markendiscount | Nettio Markendiscount |
| 109 | `penny-markt` | Penny Markt | Pfennig Markt |
| 110 | `fischer-duebelwerke` | Fischer Duebelwerke | Fischler Dübelwerke |
| 111 | `zeiss-optik` | Zeiss Optik | Zeuss Optik |
| 112 | `trumpf-lasertechnik` | Trumpf Lasertechnik | Trumpfel Lasertechnik |
| 113 | `miele-hausgeraete` | Miele Hausgeraete | Miela Hausgeräte |
| 114 | `stihl-motorgeraete` | Stihl Motorgeraete | Stiehl Motorgeräte |
| 115 | `hilti-befestigung` | Hilti Befestigung | Hilto Befestigung |
| 116 | `sennheiser-audio` | Sennheiser Audio | Sennhauser Audio |
| 117 | `leica-kamera` | Leica Kamera | Leiko Kamera |
| 118 | `sky-deutschland-sport` | Sky Deutschland Sport | Himmel Deutschland Sport |
| 119 | `brose-fahrzeugteile` | Brose Fahrzeugteile | Brosse Fahrzeugteile |
| 120 | `hella-fahrzeuglicht` | Hella Fahrzeuglicht | Hellix Fahrzeuglicht |
| 121 | `recaro-sitze` | Recaro Sitze | Rekaro Sitze |
| 122 | `dekra-pruef` | Dekra Pruefstelle | Dekrax Prüfstelle |
| 123 | `knorr-bremssysteme` | Knorr Bremssysteme | Knarr Bremssysteme |
| 124 | `eon-energie` | E.ON Energie | E.ONN Energie |
| 125 | `rwe-power-partner` | RWE Power Partner | RVE Power Partner |
| 126 | `enbw-strom` | EnBW Strom | EnWB Strom |
| 127 | `viessmann-waerme` | Viessmann Waermesysteme | Wiessmann Wärmesysteme |
| 128 | `kuehne-nagel-fracht` | Kuehne & Nagel Fracht | Kühle & Nagel Fracht |
| 129 | `db-schenker-fracht` | DB Schenker Fracht | TB Schenkel Fracht |
| 130 | `dachser-logistik` | Dachser Logistik | Dachsbau Logistik |
| 131 | `samsung-electronics` | Samsung Electronics | Samsang Electronics |
| 132 | `lg-electronics` | LG Electronics | LJ Electronics |
| 133 | `sony-entertainment` | Sony Entertainment | Sonnie Entertainment |
| 134 | `panasonic-systems` | Panasonic Systems | Panasonik Systems |
| 135 | `intel-processors` | Intel Processors | Inteil Processors |
| 136 | `nvidia-graphics` | Nvidia Graphics | Envidia Graphics |
| 137 | `amd-semiconductor` | AMD Semiconductor | AMB Semiconductor |
| 138 | `dell-technologies` | Dell Technologies | Dahl Technologies |
| 139 | `hp-hardware` | HP Hardware | HQ Hardware |
| 140 | `lenovo-computing` | Lenovo Computing | Lenavo Computing |
| 141 | `xiaomi-mobile` | Xiaomi Mobile | Xiaomu Mobile |
| 142 | `huawei-networks` | Huawei Networks | Huwai Networks |
| 143 | `canon-imaging` | Canon Imaging | Kanon Imaging |
| 144 | `philips-healthtech` | Philips Healthtech | Filipps Healthtech |
| 145 | `adobe-creative` | Adobe Creative | Abode Creative |
| 146 | `cisco-networking` | Cisco Networking | Cisko Networking |
| 147 | `chrysler-motors` | Chrysler Motors | Kreisler Motors |
| 148 | `ford-motor-company` | Ford Motor Company | Fjord Motor Company |
| 149 | `general-motors` | General Motors | Generic Motors |
| 150 | `hyundai-motor-group` | Hyundai Motor Group | Hyondai Motor Group |
| 151 | `kia-motors` | Kia Motors | Kiya Motors |
| 152 | `nissan-motor` | Nissan Motor | Nissen Motor |
| 153 | `mazda-motor` | Mazda Motor | Mazdi Motor |
| 154 | `renault-mobility` | Renault Mobility | Renolt Mobility |
| 155 | `peugeot-automobiles` | Peugeot Automobiles | Peujot Automobiles |
| 156 | `fiat-automobili` | Fiat Automobili | Fiato Automobili |
| 157 | `ferrari-corse` | Ferrari Corse | Ferrali Corse |
| 158 | `lamborghini-automobili` | Lamborghini Automobili | Lambargini Automobili |
| 159 | `jaguar-land-rover` | Jaguar Land Rover | Jagwar Land Roamer |
| 160 | `skoda-auto` | Skoda Auto | Skodra Auto |
| 161 | `michelin-reifen` | Michelin Reifen | Mitchelin Reifen |
| 162 | `pirelli-tyres` | Pirelli Tyres | Pirelo Tyres |
| 163 | `goodyear-tires` | Goodyear Tires | Goodyard Tires |
| 164 | `harley-davidson` | Harley-Davidson | Harly-Davison |
| 165 | `carrefour-retail` | Carrefour Retail | Carrefort Retail |
| 166 | `walmart-stores` | Walmart Stores | Walmarkt Stores |
| 167 | `costco-wholesale` | Costco Wholesale | Costko Wholesale |
| 168 | `zara-fashion` | Zara Fashion | Zora Fashion |
| 169 | `hm-fashion` | H&M Fashion | H&N Fashion |
| 170 | `uniqlo-basics` | Uniqlo Basics | Uniklo Basics |
| 171 | `levis-jeans` | Levis Jeans | Levvi's Jeans |
| 172 | `gucci-luxury` | Gucci Luxury | Gucchi Luxury |
| 173 | `rolex-timepieces` | Rolex Timepieces | Rolux Timepieces |
| 174 | `loreal-cosmetics` | LOreal Cosmetics | LaRoyal Cosmetics |
| 175 | `nestle-nutrition` | Nestle Nutrition | Nestel Nutrition |
| 176 | `pepsico-beverages` | PepsiCo Beverages | PapsiCo Beverages |
| 177 | `danone-dairy` | Danone Dairy | Danona Dairy |
| 178 | `unilever-brands` | Unilever Brands | Unilover Brands |
| 179 | `procter-gamble` | Procter & Gamble | Prokter & Gambel |
| 180 | `kelloggs-cereals` | Kelloggs Cereals | Kellock's Cereals |
| 181 | `mars-confectionery` | Mars Confectionery | Mors Confectionery |
| 182 | `ferrero-suesswaren` | Ferrero Suesswaren | Ferrara Süßwaren |
| 183 | `lindt-schokolade` | Lindt Schokolade | Lindtz Schokolade |
| 184 | `carlsberg-brewery` | Carlsberg Brewery | Karlsbrau Brewery |
| 185 | `guinness-stout` | Guinness Stout | Guinnis Stout |
| 186 | `nike-just-do-it` | Nike Sportswear | Nikay Sportswear |
| 187 | `reebok-athletics` | Reebok Athletics | Reebuk Athletics |
| 188 | `under-armour-gear` | Under Armour Gear | Unter Amour Gear |
| 189 | `new-balance-running` | New Balance Running | Neu Balanz Running |
| 190 | `asics-running` | Asics Running | Asyx Running |
| 191 | `converse-classics` | Converse Classics | Conversa Classics |
| 192 | `decathlon-sport` | Decathlon Sport | Dekathlon Sport |
| 193 | `paypal-payments` | PayPal Payments | PayPol Payments |
| 194 | `american-express` | American Express | Americano Express |
| 195 | `hsbc-banking` | HSBC Banking | HSBK Banking |
| 196 | `barclays-bank` | Barclays Bank | Barkley's Bank |
| 197 | `ubs-wealth` | UBS Wealth | UBX Wealth |
| 198 | `jpmorgan-chase` | JPMorgan Chase | JPMorgen Chaser |
| 199 | `santander-bank-partner` | Santander Bank Partner | Santandor Bank Partner |
| 200 | `zurich-insurance` | Zurich Insurance | Zürick Insurance |
