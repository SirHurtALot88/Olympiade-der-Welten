# LEC: Welche Kennzahlen zählen? (Recherche, 14.11.2026)

Nur Recherche und Bewertung, nichts umgesetzt. Grundlage: die Konzepte unter `docs/enterich-cards/`, der Code unter
`apps/LEC/src/lib/{dashboard,cockpit,pricing}` und `apps/LEC/src/components`, das Schema `apps/LEC/prisma/schema.prisma`
und 15 gelesene Webseiten (Liste in Abschnitt 6). Beispielzahlen stammen aus `BETRIEBSZAHLEN.md` und
`PREIS_DYNAMIK_KONZEPT.md`; wo ich selbst überschlage, steht „Überschlag“ mit der Annahme dabei.

---

## 1. Kurzfazit

1. Für einen Shop mit rund 2.000 Artikeln, Bestand 1 bis 5 und 2.850 Stück im Jahr ist die wichtigste Frage nicht „wie viel Umsatz“, sondern „wie viel Geld liegt wie lange im Ordner, und was bringt es zurück“: Kapital nach Alter, Umschlag/Reichweite und GMROI (Rohertrag je Euro Lager) gehören nach oben, Umsatz und Stück sind Kontext.
2. LEC hat die Rohdaten für fast alles davon schon (`Sale` mit Datum und `orderRef`, `Article.stock`/`currentEk`, `StockMovement`, `PriceChange`, `MarketPriceHistory` seit 13.11.2026); was fehlt, ist die Verdichtung auf Shop-Ebene (Altersklassen, GMROI, Sell-Through je Preisband, Spread gegen Markt je Preisband) statt nur je Artikel im Drawer.
3. Echte Lücken in den Daten gibt es nur drei: eBay-Traffic (Impressionen, Klickrate, Conversion je Angebot, über die eBay-Analytics-API abrufbar), Einkäufe je Beleg (`Purchase` ist leer, damit fehlen Einkaufstempo und EK-Quote am Marktwert) und Käuferkennung (ohne sie keine Wiederkaufrate).
4. LEC zeigt heute einige Kennzahlen doppelt oder in drei leicht verschiedenen Definitionen (Ladenhüter, Preis-Ampel gegen eigenen EK und gegen Marktwert, Klasse gegen Sortiment-Status, zwei Startseiten mit derselben KPI-Leiste); Zusammenlegen bringt mehr Klarheit als jede neue Kachel.
5. Vorsicht bei Standardkennzahlen aus dem Großhandel: Sell-Through je Artikel, XYZ-Analyse, Preiselastizität je Artikel und „Fehlmengenkosten“ sind bei 1 bis 5 Stück und meist 0 bis 2 Verkäufen im Jahr je Karte Zufall; sie taugen nur gebündelt (Preisband, Ordner, Kartenart, ganzer Shop).

---

## 2. Kennzahlen, die für Chris zählen

Nach Nutzen sortiert. „Daten in LEC“: ja = alles da, teilweise = Rohdaten da, aber unvollständig oder nur je Artikel; nein = Datenquelle fehlt.
Aufwand: S = reine Rechnung aus vorhandenen Tabellen, M = neue Verdichtung/Ansicht oder Daten müssen erst wachsen, L = neuer Zugang/Import.
Priorität: 1 = bald bauen, 2 = lohnt sich, 3 = nur wenn Zeit. Alle Webquellen abgerufen am 14.11.2026.

| # | Kennzahl | Formel in Klartext | Warum sie für diesen Shop zählt (Beispiel) | Daten in LEC | Fehlende Daten | Aufw. | Prio | Quelle |
|---|---|---|---|---|---|---|---|---|
| 1 | **Gebundenes Kapital nach Alter** | Bestand × EK je Artikel, aufgeteilt in Altersklassen „Tage seit letztem Verkauf (nie verkauft: seit Einstellen)“: 0–90 / 91–180 / 181–365 / über 365 | Die eine Zahl, die zeigt, wo Geld schläft. 886 von 1.781 aktiven Artikeln (50 %) nie verkauft, 285 (16 %) seit über 365 Tagen nichts (PREIS_DYNAMIK §1). Altersklassen sind die übliche Form von Lager-Alterungsberichten. | teilweise: `Article.stock`, `currentEk`, `Sale.soldAt`; Einstellalter nur geschätzt (`listedAge.ts`, `Article.createdAt` = erster LEC-Import) | echtes Einstelldatum | S | 1 | cleverence (Aging), racklify, sortswift |
| 2 | **Umschlag und Reichweite** | Umschlag = Wareneinsatz 365 T ÷ gebundenes Kapital zum EK; Reichweite = Kapital ÷ Wareneinsatz je Monat | Standardkennzahl Nr. 1 im Bestandsmanagement. Median-Reichweite heute 11 Monate (PREIS_DYNAMIK §1). Überschlag: Einkauf 2025 8.656 € gegen Inventar 8.283 € (31.12.2024, KONZEPT §1.2) ergibt rund 1 Umschlag im Jahr, unter der Annahme Wareneinsatz ≈ Einkauf. | ja: `capitalByGroup` (kennzahlen.ts), `computeCapital` (cockpit/capital.ts) | – | S | 1 | Shopify Inventory-Formeln, theretailexec |
| 3 | **GMROI** (Rohertrag je Euro Lager) | DB I der letzten 365 T ÷ Ø gebundenes Kapital zum EK | Verbindet Marge und Kapital: eine 30-€-Karte mit 1 Verkauf im Jahr kann schlechter sein als eine 3-€-Karte mit 6. Überschlag: Umsatz 2025 24.135 € minus Einkauf 8.656 € = ca. 15.480 € Rohertrag ÷ 8.283 € Inventar ≈ 1,9 (gleiche Annahme wie Zeile 2). Je Ordner/Preisband gerechnet zeigt es, welcher Teil des Sortiments das Kapital verdient. | teilweise: `SaleWindow.dbI` je Artikel, Bestand × EK heute; Ø-Bestand erst ab Beginn von `StockMovement` | Bestandsverlauf vor der Aufzeichnung (Stichtagswert genügt als Start) | S | 1 | Shopify Inventory-Formeln, theretailexec |
| 4 | **Deckungsbeitragsstufen DB I / II / III** je Fenster | Umsatz − Ware = DB I; − eBay-Gebühren, Versand, Verpackung = DB II; − anteilige Fixkosten = DB III | Kern des Excel-Modells und des Ergebniskorridors (1.600–1.800 €). eBay-Verkaufskosten 2025: 33,1 % vom Umsatz; Fixkosten 4.229 €/Jahr = 1,59 € je Stück bei Ø 9,45 € VK (17 %). | ja: `SaleWindow`, `bridge.ts`, `costEngine.ts` | echte Gebühren/Versand je Bestellung (TODO Punkt 7) | S | 1 (vorhanden) | Repo (KONZEPT §1.5) |
| 5 | **Sell-Through je Preisband / Ordner / Kartenart** | verkaufte Stück ÷ (verkaufte Stück + Endbestand), über 90 und 365 T, summiert über die Gruppe | Zeigt, in welchem Preisband Ware tatsächlich rausgeht. Bei Bestand 1–5 nur als Gruppenwert sinnvoll (siehe Warnungen). Shopify rechnet genau so (30-T-Fenster). | ja: `Sale`, `Article.stock` | – | S | 1 | Shopify Hilfe Inventory Reports |
| 6 | **Anteil Artikel mit Verkauf** („Aktivierungsquote“) | aktive Artikel mit ≥ 1 Verkauf in 365 T ÷ aktive Artikel mit Bestand | Das eBay-Gegenstück zur Sell-Through auf Angebotsebene. Heute: 394 (≥ 2 Verkäufe) + 216 (genau 1) = 610 von 1.781, also ca. 34 %; 50 % nie verkauft (PREIS_DYNAMIK §1). Sinkt sie, wird mehr eingestellt als gekauft wird. | ja | – | S | 1 | eBay UK Product Research (Sell-Through-Begriff) |
| 7 | **Verkaufspreis gegen Marktwert (Spread)** | Σ (Stückpreis − Marktwert Ø 7 T am Verkaufstag) × Menge ÷ Σ Marktwert × Menge; je Preisband als 25./50./75. Perzentil | Sagt, ob Chris systematisch unter Markt verkauft (Geld auf dem Tisch) oder über Markt (dann ist eBay der bessere Kanal). Händler-Faustregeln liegen preisbandabhängig zwischen Markt und Markt −10 %. | teilweise: `saleVsMarket` (kennzahlen.ts) je Artikel; `MarketPriceHistory` erst seit 13.11.2026 | Verlauf muss erst wachsen (4–8 Wochen) | M | 1 | tcgsync (Preisregeln), Repo TODO Punkt 2 |
| 8 | **Zeit bis zum ersten Verkauf** | Tage zwischen Einstellen und erstem Verkauf; Median je Preisband, Anteil „nach 90 T noch nichts“ | Liquiditätsmaß der Karte. Ein TCG-Leitfaden nennt 90 Tage ohne Verkauf als Grenze für tote Singles; PREIS_DYNAMIK braucht diese Zahl zum Kalibrieren der Fristen. | teilweise: `daysToFirstSale` ab `Article.createdAt`, sonst Schätzung aus der eBay-Nummer | echtes Einstelldatum („zuerst gesehen“) | S | 2 | tcgsync |
| 9 | **ABC nach Deckungsbeitrag** | Artikel nach DB II (365 T) absteigend; A bis 80 % kumuliert, B bis 95 %, C Rest; dazu Klasse „0“ ohne Verkauf | Zeigt, worauf sich Nachkauf und Preispflege lohnen. Heute schon belegt: 80 % des DB aus 119 Artikeln (PREIS_DYNAMIK §1). Shopify macht ABC nach Umsatz über 28 T; für Chris besser nach DB und 365 T, weil die Fenster sonst zu dünn sind. | ja | – | S | 2 | Shopify Hilfe, cleverence (Klassifikation) |
| 10 | **Marktbewegung des Lagers** | Σ Bestand × (Marktwert heute − Marktwert vor 30 T); Anteil Artikel mit Ø 7/Ø 30 unter −20 % | Banlist-Updates und Reprints verschieben Preise schnell (Quellen: „20 % in einer Woche“, Bannliste quartalsweise). Wer das als Summe sieht, weiß, ob sich der Lagerwert gerade bewegt und welche Karten er zuerst umpreisen muss. | teilweise: `MarketPriceHistory`, Filter „Markt fällt, Bestand liegt“ im Sortiment | 30 T Verlauf (ab Mitte Dezember 2026) | M | 2 | tcgapi, tcgsync |
| 11 | **Einkaufstempo gegen Verkaufstempo** | Einkauf € je Monat gegen Wareneinsatz € je Monat | Wird mehr eingekauft als verkauft, wächst das Kapital in Zeile 1. 2026: 8.061 € Einkauf bis 31.10. (Ø 10,71 € je Beleg, 2025: 8,94 €). | teilweise: `CapitalCard` zeigt den Vergleich, `Purchase` ist aber leer, nur Planwert 782 €/Monat | Einkaufsbelege (Lexoffice- oder Cardmarket-Export) | M | 2 | Repo (COCKPIT_V2 §5.3) |
| 12 | **EK-Quote am Marktwert** | gezahlter EK je Karte ÷ Marktwert am Kauftag | Einkaufsdisziplin ist laut KONZEPT §1.2 einer der zwei Kernhebel. Ladengeschäfte kaufen typischerweise zu 50 % (bar) bzw. 60 % (Gutschrift) vom Marktwert an; Chris kauft auf Cardmarket nahe am Markt, deshalb muss die Marge aus dem Verkaufspreis kommen. | teilweise: `EkChange` + `MarketPriceHistory` (beide jung); Filter „EK über Markt“ | Einkäufe mit Datum (`Purchase`) | M | 2 | empire-games Buylist |
| 13 | **Tage ohne Bestand / verpasste Stück** | Anteil Tage mit Bestand 0; Tempo nur über Tage mit Bestand × Tage ohne Bestand | Korrigiert das Tempo von Rennern, die oft ausverkauft sind, und damit die Nachkaufliste. „Lost sales ratio“ = Tage ohne Bestand ÷ 365. | ja je Artikel: `outOfStock` (kennzahlen.ts), ab Beginn von `StockMovement` | Summe auf Shopebene fehlt | S | 2 | theretailexec |
| 14 | **Ø Warenkorb und Artikel je Bestellung** | Umsatz ÷ Bestellungen; Stück ÷ Bestellungen (`Sale.orderRef`) | Bestimmt Versand je Stück. 2026: 13,29 € und 1,50 Artikel; Warenkorb seit 2022 +66 %, Artikel je Bestellung stabil 1,45–1,57. | ja: `orderStats` (orderStats.ts), nur für die Kostenrechnung genutzt | – | S | 2 | Repo (BETRIEBSZAHLEN) |
| 15 | **Verkaufskosten in % vom Umsatz** (eBay) | (Provision + Anzeigen + Fixgebühr + Shop-Abo) ÷ Umsatz | Größter variabler Block: 2025 33,1 %, 2024 31,5 %. Die Anzeigengebühr ist der einzige Teil, den Chris direkt steuert. | ja: `EbayListingFact` (Gebühren je Angebot und Berichtszeitraum) | – | S | 2 | Repo (BETRIEBSZAHLEN) |
| 16 | **Preiswirkung je Preisband** | Stück je Monat in gleich langen Fenstern vor/nach Preisänderungen ab 10 %, summiert je Preisband | Das ist die einzige ehrliche Form von „Preiselastizität“ bei diesem Shop. Liefert die Kalibrierung für Ladenhüter-Abschlag und dynamischen VK. | teilweise: `priceEffects` je Artikel; `PriceChange` erst seit LEC mitschreibt | Summe je Band, mehr Verlauf | M | 2 | Repo (PREIS_DYNAMIK §2, §4) |
| 17 | **Impressionen, Klickrate, Conversion je Angebot** | Klicks ÷ Impressionen; Transaktionen ÷ Seitenaufrufe | Trennt bei Ladenhütern „wird nicht gefunden“ (Titel, Kategorie) von „wird gesehen, aber nicht gekauft“ (Preis). Die eBay-Analytics-API liefert das je Tag oder je Angebot. | nein (`EbayListingFact` hat keine Traffic-Felder) | eBay-OAuth und Abruf des Traffic-Berichts (TODO Abschnitt C) | L | 2 | eBay Developer Traffic Report |
| 18 | **Schwund- und Retourenquote** | Stück aus `StockLoss` ÷ verkaufte Stück; Wert zum EK | Kleine Zahl, aber Teil der echten Marge. Erst seit 14.11.2026 erfasst. | teilweise: `StockLoss` (retoure, reklamation, beschaedigt, verloren) | Zeit | S | 3 | theretailexec (Shrinkage) |
| 19 | **eBay-Servicestatus** (Mängelquote, Fälle ohne Klärung, verspätete Lieferung) | Mängel ÷ Transaktionen; Top-Bewertung: höchstens 0,5 %, höchstens 3 % verspätet | Schützt Sichtbarkeit und Rabatt. Mit ca. 475 Bestellungen je Quartal liegt der Shop nahe der 400er-Grenze, ab der eBay 3 statt 12 Monate auswertet; 0,5 % sind dann nur 2 Mängel. eBay zeigt das selbst im Seller Hub. | nein | Seller-Hub-Daten | M | 3 | eBay.de Verkäuferstandards |
| 20 | **Fixkosten je Stück und Break-even-Stückzahl** | Fixkosten ÷ verkaufte Stück; Fixkosten ÷ DB II je Stück | Zeigt, warum Billigkarten tragen müssen: 1,59 € je Stück. Wird schon in DB III verrechnet. | ja: `CostSettings`, `fixedCostPerUnit` | – | S | 3 | Repo |
| 21 | **Wiederkaufrate** | Käufer mit ≥ 2 Bestellungen ÷ alle Käufer | Klassische Shop-Kennzahl; bei eBay-Einzelkarten mit Ø 1,5 Artikeln je Bestellung wenig steuerbar. | nein: `Sale` hat nur `orderRef`, keine Käuferkennung | anonymisierte Käufer-ID aus Billbee | M | 3 | keine gelesene Quelle, Standardbegriff |

21 Kennzahlen.

---

## 3. Was LEC heute zeigt: behalten, zusammenlegen, streichen

### 3.1 Dashboard `/` (`components/dashboard/DashboardShell.tsx`)

| Komponente / Kennzahl | Urteil | Begründung |
|---|---|---|
| `KpiRow`: Umsatz, Verkäufe (Stk, Ø VK), Ø Marge DB II je Fenster | **zusammenlegen** mit `components/cockpit/KpiRow.tsx` | Dieselben drei Zahlen stehen auf `/cockpit` mit besserer Herleitung (Run-Rate-Bänder, DB III). Zwei Startseiten mit derselben Leiste lassen Chris fragen, welche gilt. Vorschlag: `/` wird die Arbeitsseite („heute zu tun“), `/cockpit` die Zahlenseite. |
| `KpiRow`: „Totes Kapital · Ladenhüter“ | **zusammenlegen**, Definition vereinheitlichen | Hier zählt nur, wer schon einmal verkauft hat (`viewModel.ts`, `withHistory`), die Klassifikation (`classification.ts`) zählt auch nie verkaufte Ware mit Bestand, Top/Flop beschriftet „trotz Historie“. Drei Definitionen für denselben Begriff. Ersetzen durch Zeile 1 (Kapital nach Alter) mit einer Definition; der Kommentar im Code („echter Bestand liegt noch nicht vor“) ist seit dem Artikelstamm-Import überholt. |
| `MoversPanels` „Läuft gerade gut“ (Top 4 Umsatz 30 T) | **behalten**, aber nur einmal | Gleiche Logik wie `MoversCard` im Cockpit und Top-Seller auf Top/Flop. Auf der Arbeitsseite reicht eine Liste. |
| `MoversPanels` „Läuft schlecht“ (Top 4 negativer DB II, Lebenszeit) | **zusammenlegen** mit Top/Flop „Low-Runner“ und `Recommendations` „Auslisten“ | Gleiche Artikel, drei Orte. Lebenszeit-DB-II ist zudem genau die Bundle-Falle aus KONZEPT §2; besser 365 T. |
| `SortimentTable` (Vorschau 8 Zeilen) | **streichen** auf der Startseite | Acht Zeilen nach Velocity entscheiden nichts; `/sortiment` hat dieselbe Tabelle vollständig mit Filtern. Ein Link genügt. |
| `CardmarketPlaceholder` | **streichen** | Text sagt „manuell, keine API“; der Marktwert kommt seit dem automatischen Preisführer-Abruf von selbst. `MarketHintsCard` ersetzt ihn vollständig. |
| `OperatingQuotas`: Warenquote ≤ 43 % | **behalten**, umbenennen | Sinnvoller Zielwert aus dem Forecast, aber LEC rechnet Wareneinsatz der verkauften Ware ÷ Umsatz, die Excel-Warenquote ist Einkauf ÷ Einnahmen (EÜR). Beschriftung „Wareneinsatzquote 365 T“, die EÜR-Quote erst mit Einkaufsdaten. |
| `OperatingQuotas`: Betriebsausgaben ≤ 40 % | **streichen** oder in `BridgeCard` aufgehen lassen | Gerechnet werden nur eBay-Gebühren + Versand (`viewModel.ts`, `variableCosts`), verglichen mit einem Ziel, das in KONZEPT §1.2 alle Betriebsausgaben meint (2024: 46 %). Der Balken ist dadurch fast immer grün und sagt nichts. Die Brücke zeigt dieselben Abzüge ehrlich. |
| `Recommendations` (Top 4) | **behalten** | Das ist der Kern einer Arbeitsseite. Nach €-Effekt sortiert ist richtig. |

### 3.2 Leitplanken `/cockpit` (`components/cockpit/CockpitPage.tsx`)

| Komponente / Kennzahl | Urteil | Begründung |
|---|---|---|
| `KpiRow`: Umsatz mit drei Run-Rate-Balken, Verkäufe, Marge DB II, Ergebnis DB III | **behalten** | Ehrlichste Form ohne Tagesreihe. Nachtrag: jetzt, da `Sale` Einzelverkäufe mit Datum hat, kann aus den Balken eine echte Monatsreihe werden. |
| `KpiRow`: „EK fehlt“ | **behalten**, solange die Lücke groß ist | Entscheidet, wie weit man allen anderen Margen trauen kann. Später in den Datenstand-Footer. |
| `BridgeCard` (Wasserfall Umsatz → DB III) | **behalten** | Zeigt, wo die Marge bleibt; ersetzt die Betriebsausgaben-Quote. |
| `GuardrailsCard`: Umsatz rollierend 365 T gegen 24.000/25.000 €, DB III gegen 1.400/1.600–1.800 € | **behalten** | Steuerlich entscheidend (Kleinunternehmergrenze, Gewinnprognose). |
| `GuardrailsCard`: Warenbudget Nov/Dez | **behalten, aber leer** | Ohne `Purchase`-Daten nur Marke ohne Ist. Entscheidet erst mit Einkaufsimport (Zeile 11). |
| `TempoCard` (Umsatz, Wareneinsatz, DB II je Band) | **zusammenlegen** mit den Run-Rate-Balken der `KpiRow` | Gleiche drei Bänder, zweimal gezeichnet. Eine Monatsreihe aus `Sale` ersetzt beide. |
| `DistributionCard` „Sortimentsgesundheit“ (Klassen) | **zusammenlegen** mit dem Sortiment-Status | Es gibt zwei Einstufungen nebeneinander: die Klasse (Champion bis Ladenhüter, `classification.ts`) und den Status (Behalten bis Auslisten, `lifecycle.ts`). Für Entscheidungen zählt der Status; die Klasse sollte darin aufgehen oder nur noch als Tempo-Etikett dienen. |
| `DistributionCard` „Preis-Ampel“ (Listen-VK gegen eigenen EK-Korridor) | **zusammenlegen** mit `MarketHintsCard` | Zwei Ampeln mit gleichen Wörtern („zu günstig“, „im Korridor“/„im Rahmen“) und verschiedenen Maßstäben (eigener EK gegen Marktwert). Eine Ampel mit klar benannter Basis: Marktwert, wo vorhanden, sonst eigener EK. |
| `MarketHintsCard` (zu günstig, im Rahmen, zu teuer, EK über Markt, Abdeckung, Top-5 nach €-Hebel) | **behalten** | Entscheidet direkt, sortiert nach €. |
| `MoversCard` (Läuft, Bremst, Fällt ab) | **behalten**, die Dashboard-Version streichen | siehe 3.1. |
| `CapitalCard` (Kapital, nicht bezifferbar, potenzieller Umsatz, Reichweite, Verkaufs- gegen Einkaufstempo) | **behalten, erweitern** um Altersklassen und GMROI | Die richtige Karte für die wichtigste Frage; „potenzieller Umsatz (VK)“ ist nur Kontext und kann klein werden. |

### 3.3 Sortiment `/sortiment` (`components/sortiment/SortimentPage.tsx` und Drawer)

| Komponente / Kennzahl | Urteil | Begründung |
|---|---|---|
| Karten „VK gegen Marktwert“ (zu günstig / im Rahmen / zu teuer / offen) als Filter | **behalten** | Klickbare Zähler, die direkt filtern: gutes Muster. |
| Filterchips (nicht im eBay-Shop, zum Auslisten markiert, Preis senken/Auslaufen/Auslisten, bei eBay beendet, mögliche Doppelte, Nachbestellen fällig, Markt fällt, Name ≠ Code) | **behalten** | Jede ist eine Arbeitsliste. Datenqualität (Doppelte, Name ≠ Code, nicht im Shop) könnte in eine eigene Gruppe „Daten prüfen“. |
| Tabellenspalten: Rank, Umsatz, Ø Preis **und** Ø-VK (real.) | **zusammenlegen** | „Ø Preis“ und „Ø-VK (real.)“ sind für Chris kaum unterscheidbar; eine Spalte. Rank ist bei vielen Gleichständen mit 0–1 Verkauf ohne Aussage. |
| Spalten DB I/Stk, DB II/Stk, DB III/Stk, DB II %, DB III % | **zusammenlegen** auf DB II/Stk und DB II % in der Standardansicht | Fünf Margenspalten nebeneinander; DB I und DB III gehören in den Drawer („Ergebnis“). |
| Spalte „Preis-Korridor“ und „Empf. VK 25–33 %“ und „VK vs. Markt“ | **zusammenlegen** | Zwei Korridore (EK-Basis, Markt-Basis), siehe Preis-Ampel. |
| Spalten Stk, pot. VK€, Stk > VK | **behalten** Stk; pot. VK€ und „Stk > VK“ **streichen** oder umbenennen | „Stk > VK“ ist als Name unverständlich (gemeint: Reichweite). Reichweite in Monaten und Kapital zum EK sagen mehr als pot. VK€. |
| `KapitalPanel` (Kapital je Ordner/Kartenart, davon Maßnahme, Umschlag/Jahr, Reichweite) | **behalten, erweitern** | Genau die richtige Form. Ergänzen: Spalte GMROI und Sell-Through 365 T, Gruppierung auch nach Preisband. |
| `PreisUeberblick` (Streudiagramm Marktwert gegen VK, Urteil je Marktwert-Klasse) | **behalten** | Zeigt, in welchem Preisband die Fehler liegen. |
| `PreisBoard` | **behalten** | Arbeitsliste fürs Umpreisen. |
| Drawer `ArtikelDetail`: Entscheidungs-Kacheln (Dein VK, Zielspanne, Marktwert, Marge Nachkauf, Gewinn/Stück, Gewinn/Monat, Bestand, Ø EK) | **behalten** | Gewinn/Monat ist die beste Einzelzahl je Artikel (Tempo × Gewinn). |
| Drawer-Gruppen Markt, Verkäufe (Monatsbalken, Preiswirkung, erster Verkauf, Rhythmus, Menge je Verkauf), Ergebnis, Lager (Tage ohne Bestand, Tempo mit Bestand), Schwund | **behalten** | Richtiger Ort für die kleinen Zahlen: je Artikel lesen, nie aufsummiert als Urteil. „Rhythmus“ und „Menge je Verkauf“ entscheiden selten etwas und können zugeklappt bleiben. |

### 3.4 Empfehlungen `/empfehlungen` (`components/empfehlungen/EmpfehlungenPage.tsx`)

| Kennzahl | Urteil | Begründung |
|---|---|---|
| Gebundenes Kapital · Ladenhüter | **zusammenlegen** mit Zeile 1 | vierte Stelle mit Ladenhüter-Kapital. |
| Verlust p.a. · Low-Runner | **korrigieren** oder streichen | Summiert `effectValue` der Auslisten-Empfehlungen = Lebenszeit-DB II (`app/empfehlungen/page.tsx`), beschriftet aber „p.a.“. Entweder 365-T-Wert rechnen oder „Lebenszeit“ schreiben. |
| Verschenkte Marge · VK < MIN | **behalten** | Entscheidet direkt über Preisanhebung; Basis sollte dieselbe Ampel wie im Sortiment sein. |
| Nachkauf-Kandidaten (Anzahl) | **behalten**, besser als € | Erwarteter DB der Nachkäufe sagt mehr als die Zahl. |
| Liste mit €-Effekt / Dringlichkeit | **behalten** | Kern der Seite. |

### 3.5 Top/Flop `/top-flop` (`components/topflop/TopFlopPage.tsx`, `RankList.tsx`)

| Liste | Urteil | Begründung |
|---|---|---|
| Top-Seller (Top 10 Umsatz je Fenster) | **behalten, Maß wechseln** auf DB II € | Umsatz belohnt teure Karten mit dünner Marge. |
| Margen-Champions (Top 10 DB II %, ab 3 Stk) | **ersetzen** durch Gewinn/Monat oder GMROI | Prozent ohne Euro und ohne Kapital sagt nicht, wo das Geld verdient wird. |
| Low-Runner (schlechteste DB II %, Lebenszeit) | **zusammenlegen** mit Empfehlungen „Auslisten/Preis anpassen“ | Doppelt; Lebenszeit-Fenster. |
| Ladenhüter (0 Verkäufe 365 T trotz Historie) | **zusammenlegen** mit Zeile 1 | siehe oben. |
| Seite insgesamt | **zusammenlegen** in `/sortiment` als vorgefertigte Sortierungen | Vier Ranglisten sind vier Sortierungen derselben Tabelle. |

---

## 4. Neue Ansichten, die sich lohnen

1. **Ladenhüter-Kapital nach Alter** (in `CapitalCard` auf `/cockpit` und als Kopf von `KapitalPanel` auf `/sortiment`).
   Ein gestapelter Balken über das ganze Kapital zum EK, Segmente 0–90 / 91–180 / 181–365 / über 365 Tage seit letztem Verkauf (nie verkauft: seit Einstellen, mit Kennzeichen „geschätzt“). Daneben Stückzahl je Segment. Klick auf ein Segment filtert `/sortiment`. Die Segmentgrenzen passen zu den Fristen in `lifecycle.ts` (180, 365) und zum Ladenhüter-Abschlag ab 120 Tagen (`staleDecay.ts`); sie sollten fest bleiben, damit man den Verlauf vergleichen kann (so die Aging-Quellen).
2. **Kapital-Rendite-Tabelle je Preisband** (`KapitalPanel`, zusätzliche Gruppierung „Preisband“ neben Ordner/Kartenart).
   Zeilen = Marktwert- bzw. VK-Bänder wie in `PreisUeberblick` (bis 2 €, 2–5, 5–20, 20–50, ab 50 €). Spalten: Artikel, Stück, Kapital, Sell-Through 365 T, Anteil mit Verkauf, Umschlag, GMROI, Median Tage bis Verkauf. Beantwortet „welche Karten soll ich überhaupt einkaufen?“.
3. **ABC nach DB II mit Klasse 0** (`/sortiment`, Spalte + Filterchip; im Cockpit als 100-%-Balken anstelle der heutigen Klassenverteilung).
   A/B/C nach 80/15/5 % des DB II der letzten 365 T, dazu „0“ für Artikel ohne Verkauf. Zwei Balken: Anteil Artikel und Anteil Kapital je Klasse. Zeigt auf einen Blick: viel Kapital in C und 0.
4. **Verkaufspreis gegen Marktwert je Preisband** (`/marktpreise` oder `MarketHintsCard`), ab ca. Mitte Dezember 2026, wenn `MarketPriceHistory` vier Wochen hat.
   Boxplot oder drei Zahlen (25./50./75. Perzentil) des realisierten Aufschlags je Band. Das ist die Kalibrierung, die PREIS_DYNAMIK §2 verlangt.
5. **Marktbewegung des Lagers** (`/cockpit`, kleine Karte neben `MarketHintsCard`).
   Lagerwert zum Marktwert heute gegen vor 30 Tagen, Zahl der Artikel mit Ø 7/Ø 30 unter −20 % (Bannlisten-/Reprint-Alarm, vgl. PREIS_DYNAMIK §4), Top 5 nach € Wertverlust mit Link ins Sortiment.
6. **Monatsreihe aus Einzelverkäufen** (`/cockpit`, ersetzt `TempoCard` und die Bänder).
   Umsatz, Stück, Bestellungen und Ø Warenkorb je Kalendermonat aus `Sale`, mit Vorjahreslinie. Damit lassen sich Jahreszeit und Set-Zyklen erkennen, die heute in rollierenden Fenstern untergehen.
7. **Einkauf gegen Verkauf je Monat** (`CapitalCard`), sobald Einkäufe importiert werden (Lexoffice-Belege oder Cardmarket-Kaufübersichten).
   Zwei Linien: Einkauf € und Wareneinsatz €; Fläche dazwischen = Kapitalaufbau oder -abbau.
8. **Traffic-Diagnose für Ladenhüter** (Drawer und Filter), erst mit eBay-API-Zugang.
   Impressionen und Klickrate der letzten 90 Tage; Filter „gesehen, nicht gekauft“ (Preisproblem) gegen „kaum gesehen“ (Titel/Kategorie). Das macht die Auslisten-Regel deutlich treffsicherer.

---

## 5. Warnungen

| Kennzahl | Warum sie hier irreführt | Besser |
|---|---|---|
| **Sell-Through je Artikel** | Bei Bestand 1 ist sie 0 % oder 100 %, bei 2 bis 5 Stück springt sie in großen Schritten. Shopify rechnet über 30 Tage; bei Chris verkauft der Median-Artikel in 30 Tagen nichts. | Nur je Gruppe (Preisband, Ordner, Kartenart) und über 90/365 T. |
| **XYZ-Analyse (Variationskoeffizient)** | Die Quellen selbst warnen: bei sehr kleinem Mittelwert ist der CV wegen ganzzahliger Mengen hoch, nicht wegen echter Unvorhersehbarkeit; zuverlässig erst ab 8–12 Perioden. Fast alle Karten wären „Z“. | Weglassen. Für die wenigen Renner reicht „Verkäufe je Monat mit Bestand“. |
| **Preiselastizität je Artikel** | 0 bis 2 Verkäufe vor und nach einer Preisänderung; `priceEffects` sagt deshalb zu Recht meist „zu wenig Daten“. Ein einzelner Verkauf nach der Senkung beweist nichts. | Nur über Preisbänder summieren (Zeile 16) und als Richtung lesen. |
| **Fehlmengenkosten / verpasste Stück je Artikel** | Tempo mit Bestand × Tage ohne Bestand rechnet bei einem Verkauf im Jahr Bruchteile von Stück hoch. Zudem kauft ein Sammler eine fehlende Karte oft anderswo, nicht später. | Nur für Artikel mit ≥ 4 Verkäufen im Jahr und als Summe. |
| **Rang je Fenster** | Hunderte Artikel teilen sich Rang „0 Verkäufe“; die Rangfolge unter 1 Verkauf ist Zufall. | Weglassen oder nur für die Top 50 zeigen. |
| **DB II % als Rangliste** | Belohnt billige Karten mit hoher Prozentmarge und kleinen Euro. Bei Ø 9,45 € VK und 1,59 € Fixkosten je Stück kann eine 4,99-€-Karte mit 30 % DB II nach Fixkosten verlieren. | Euro je Monat (Gewinn/Monat) oder GMROI. |
| **Lebenszeit-Fenster** | Bundle-Falle (KONZEPT §2): früher stark, heute tot. Noch genutzt in „Läuft schlecht“, Top/Flop „Low-Runner“ und „Verlust p.a.“. | 365 T als längstes Entscheidungsfenster. |
| **Marktwert als Wahrheit** | Preisführer gilt für Near Mint und ohne Sprach-/Auflagenfilter; „ab“ ist oft eine bespielte englische Karte (PREIS_DYNAMIK §4). Preise können nach Bannlisten-Updates in Tagen springen. | Marktwert mit Datum zeigen, Ausreißer kappen, „mehrdeutig“ nie bewerten (macht LEC schon). |
| **Umschlag aus Kapital zum Listen-EK** | Artikel ohne EK fehlen in der Summe; der Umschlag sieht dann besser aus, als er ist. `CapitalCard` weist die Lücke aus, `KapitalPanel` nur mit Sternchen. | Lücke immer neben die Zahl schreiben. |
| **Ø Warenkorb als Erfolgsmaß** | Er steigt (8,00 € → 13,29 €), weil die Karten teurer werden, nicht weil mehr in den Korb kommt (1,45–1,57 Artikel konstant). Eine Steigerung heißt nicht mehr Gewinn je Sendung. | Zusammen mit Artikel je Bestellung und Versand je Bestellung zeigen. |
| **eBay-Sell-Through aus Terapeak** | Marktweite Quote über ähnliche Angebote, mit uneinheitlicher Formel (je nach Quelle verkauft ÷ alle Angebote oder verkauft ÷ aktive, dann auch über 100 %). Nicht mit Chris' eigener Quote vergleichbar. | Nur als Marktsignal für Einkauf, nicht als Benchmark. |
| **eBay-Servicestatus in Prozent** | Bei ca. 475 Bestellungen je Quartal sind 0,5 % nur 2 Fälle; eine Zahl in LEC wäre zu grob und doppelt zum Seller Hub. | Im Seller Hub lassen, in LEC höchstens verlinken. |

---

## Entscheidungen 14.11.

Antworten auf Chris' Rückfragen (über den Koordinator). Grundlage: Code-Stand 14.11. (`viewModel.ts` `buildRecommendations`, `classification.ts`, `lifecycle.ts`).

**1. Eine Ladenhüter-Definition.** Kapital-Altersklassen über alle aktiven, nicht ausgeblendeten Artikel mit Bestand > 0 und EK > 0. Alter = Tage seit letztem `Sale.soldAt`; nie verkauft: das größere aus Tagen seit `Article.createdAt` und geschätztem Angebotsalter (`listedDaysAtLeast`). Namen: **Frisch** 0–90, **Ruhig** 91–180, **Langsam** 181–365, **Ladenhüter** über 365 Tage. Chris sieht: „Ladenhüter: X € in N Artikeln“ plus die drei anderen Segmente. Nie verkaufte Artikel tragen in jedem Segment ein Kennzeichen „ohne Verkauf, Alter geschätzt“. „Kapitalbinder“ entfällt als Begriff; der Abverkaufsblock = Langsam + Ladenhüter. Die Status-Maßnahmen (Preis senken, Auslaufen, Auslisten) bleiben Aufgaben, keine Kapitalgruppe. Risiko: `createdAt` ist der erste LEC-Import, also zu jung; ohne die Schätzung aus der eBay-Nummer käme kein nie verkaufter Artikel über 365 Tage.

**2. Sortiment-Zielspanne als einzige Preis-Ampel:** einverstanden, mit zwei Bedingungen. (a) Ohne eindeutigen Marktwert gibt es kein Urteil, und das zeigt die Ampel als „offen“ samt Anzahl an. (b) Die Ampel misst nur am Markt; eine Karte, die zu teuer eingekauft wurde, steht trotzdem „im Rahmen“. Deshalb bleibt die EK-Sicht als zweite Spalte, umbenannt in **„Marge am eigenen EK“** (unter 25 % / 25–33 % / darüber / kein EK). Sie ist keine Ampel für Preisänderungen, sondern eine Prüfung des Einkaufs. Risiko: Der Preisführer filtert weder Zustand noch Sprache.

**3. Dashboard-Kennzahlen.**
- Kapital nach Alter = Σ `stock` × `currentEk` je Segment (siehe 1).
- Reichweite (Monate) = dasselbe Kapital ÷ (Σ `SaleWindow[365].ek` ÷ 12).
- GMROI = Σ `SaleWindow[365].dbI` ÷ Kapital heute.
- Für Reichweite und GMROI gilt: nur Artikel mit EK zählen im Zähler und im Nenner, sonst entsteht eine Phantommarge (dbI = Umsatz).
- Umschlag entfällt, weil er der Kehrwert der Reichweite ist.
- Alle drei werden nur als Shopsumme bzw. je Ordner oder Preisband gezeigt, nie je Artikel. Bei Bestand 1–5 und 0–2 Verkäufen je Karte ist der Artikelwert Zufall.
- Sie verschweigen Artikel ohne EK; deren Zahl steht deshalb daneben.
- GMROI rechnet mit dem Kapital am Stichtag statt dem Durchschnittsbestand.
- Läuft gut: Top nach Gewinn/Monat (DB II €).
- Läuft schlecht: Verlust trotz Verkäufen (365 T) und „Markt fällt, Bestand liegt“.
- Muss weg: Langsam + Ladenhüter.
- Gestrichen: Sell-Through und Rang je Artikel, Ranglisten nach DB II %, Lebenszeit-Fenster, Betriebsausgaben-Quote.

**4. Empfehlungen.**
- Behalten:
  - `lot_bilden` als Dashboard-Block „Muss weg“.
  - `ek_pflegen` und die drei `daten_pruefen`-Fälle (Name ≠ Code → Aufräumen; Verlust trotz Verkäufen und krumme Stückzahl → Daten prüfen).
- Redundant und weg:
  - `preis_anpassen` (Preis ändern).
  - `nachkaufen` (Nachbestellen).
  - `auslisten` aus der Low-Runner-Klasse: Negative Marge mit Verkäufen ist ein Preis- oder EK-Fall, er wandert in „Preis ändern“ bzw. „Daten prüfen“.

**5. Was nicht verloren gehen darf.** Von Marktpreise: die Abdeckung (mit Marktwert / mehrdeutig / älter als 30 T) in den Datenstand, und später Verkaufspreis gegen Marktwert je Preisband. Von Top/Flop: nur „Top nach DB II €“, das in „Läuft gut“ aufgeht.

**6. Trennung „Daten prüfen“ / „Aufräumen“:** einverstanden.
- Ergänzen in „Daten prüfen“:
  - EK über 150 % des Marktwerts (meist ein Tippfehler im EK).
  - Bestand > 0 ohne VK.
  - Krumme Stückzahl.
  - Marktwert mehrdeutig bei Bestand > 0.
- Ergänzen in „Aufräumen“: aktiv, aber nicht im eBay-Shop gefunden.

## 6. Quellen (alle abgerufen am 14.11.2026)

Gelesen (15 Seiten):

1. Shopify, „Inventory formulas“ (Umschlag, GMROI, DSI, Sell-Through, Lagerkosten): https://www.shopify.com/retail/inventory-formulas
2. The Retail Exec, „26 Inventory Management KPIs Retailers Need in 2026“ (Formeln, Lost-Sales-Ratio, Dead-Stock-Rate, Shrinkage): https://theretailexec.com/logistics/inventory-management-kpis/
3. Shopify Hilfe, „Inventory reports“ (Sell-Through 30 T, Tage Restbestand 28 T, ABC 80/15/5 nach Umsatz, Darstellung): https://help.shopify.com/manual/reports-and-analytics/shopify-reports/report-types/inventory-reports
4. eBay Developer, „Traffic report“ (Impressionen, Klickrate, Seitenaufrufe, Conversion; Dimension Tag oder Angebot): https://www.developer.ebay.com/api-docs/sell/static/performance/traffic-report.html
5. eBay.de Hilfe, „Grundsatz zu Verkäuferstandards“ (Mängelquote, Fälle, verspätete Lieferung, 3/12 Monate, 400er-Grenze): https://www.ebay.de/help/policies/selling-policies/seller-standards-policy?id=4347
6. eBay UK Seller Centre, Produktrecherche-Tool Oktober 2024 (Sell-Through-Begriff, 3 Jahre Daten): https://www.ebay.co.uk/sellercentre/news/2024-october/product-research-tool
7. TCGsync, TCG-Inventory-Management-Leitfaden (90 Tage ohne Verkauf, Preisregeln je Preisband, Preissprünge 20 %/Woche): https://www.tcgsync.com/blog/tcg-inventory-management-guide
8. SortSwift, „Reports“ (ABC, Dead-Stock, Set-Lebenszyklus, Inventory Health, Sell-Through für Kartenläden): https://sortswift.com/features/reports
9. TCG API, Yu-Gi-Oh-Seite (Bannliste quartalsweise, Reprints, Volatilität): https://tcgapi-site.pages.dev/games/yugioh
10. Empire Games, Buylist Policy (Ankauf 50 % bar / 60 % Gutschrift vom Marktwert, Zustandsabschläge): https://empire-games.com/pages/buylist-policy
11. Mecalux, „ABC XYZ analysis“ (9-Felder-Matrix, CV-Grenzen 10/25 %, braucht Historie): https://www.mecalux.com/blog/abc-xyz
12. Metricgate, „XYZ demand classification“ (CV 0,5/1,0, Warnung bei kleinen Mengen, 8–12 Perioden): https://metricgate.com/docs/xyz-demand-classification/
13. Cleverence, „Inventory classification types“ (ABC 80/95 %, XYZ, FSN): https://www.cleverence.com/articles/for-business/inventory-classification-types-5932/
14. Cleverence, „What is inventory aging“ (Altersklassen, Alter ab Eingang oder letzter Bewegung, Abschriftsleiter): https://www.cleverence.com/articles/for-business/what-is-inventory-aging-9264/
15. Racklify, „Aged Inventory vs Dead Stock“ (91–180 / 181–365 / über 365 Tage, Maßnahmen je Klasse): https://racklify.com/encyclopedia/aged-inventory-vs-dead-stock-how-they-differ-and-why-it-matters/

Nur über Suchergebnisse gesehen, nicht vollständig gelesen (nicht als Beleg verwendet): misprint.com (HTTP 429), help.tcgplayer.com Pricing Guidelines (HTTP 403), Cardmarket-API-Dokumentation Price Guide (HTTP 410).

Repo-Quellen: `docs/enterich-cards/KONZEPT.md`, `COCKPIT_V2_KONZEPT.md`, `PAGES_CONCEPT.md`, `PREIS_DYNAMIK_KONZEPT.md`, `BETRIEBSZAHLEN.md`, `TODO.md`; Code wie oben genannt.
