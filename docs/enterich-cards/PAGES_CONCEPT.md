# LEC Cockpit — Konzept für die 5 fehlenden Seiten + Tabellen-Feinschliff

> Design-Konzept (von Fable) + Chris' Dashboard-Spalten + Resizable-Anforderung.
> Umsetzung: Sonnet. Baut fast komplett auf vorhandenem Code/CSS auf.

## Vorarbeit (einmalig, vor allen Seiten)
- **`AppShell`** extrahieren (Sidebar + `<main>` + Topbar-Slot + Footer mit Datenstand), damit nicht
  jede Seite `DashboardShell` kopiert. Sidebar: `href`s von `#` auf echte Routen umstellen
  (`/sortiment`, `/top-flop`, `/marktpreise`, `/empfehlungen`, `/einstellungen`), `active` aus der Route.
- **`viewModel.ts`** aufteilen: Loader `loadArticleAggregates()` (Prisma → `ArticleAggregate[]` +
  `CostSettingsValues`) als gemeinsame Datenquelle aller Seiten; `buildSortimentRow`, `MicroVelocity`,
  `Corridor` als wiederverwendbare Bausteine exportieren. Das `.slice(0,20)` + `revenue>0`-Filter
  raus (Ladenhüter mit 0 € müssen auf `/sortiment` sichtbar sein).

---

## A. Tabellen-Feinschliff (ÜBERALL, Chris' ausdrücklicher Wunsch)
1. **Anpassbare Spaltenbreiten in ALLEN Tabellen** — nicht nur der Dashboard-Sortiment-Tabelle.
   Die Resize-Logik aus `SortimentTable.tsx` (Pointer-Griff, `table-layout:fixed` + `<colgroup>`,
   localStorage-Persistenz, „Spalten zurücksetzen") in eine **wiederverwendbare Komponente/Hook**
   (`ResizableTable` / `useColumnWidths`) extrahieren und in jeder Tabelle einsetzen
   (Sortiment-Vollseite, Marktpreis-Vergleich, Import-History etc.).
2. **Artikelnamen überall voll sichtbar machen.** In Nicht-Tabellen-Listen (`MoversPanels` „läuft
   gut/schlecht", `ReviewRow` Review-Liste) werden Namen abgeschnitten — dort den vollen Namen
   zeigen (umbrechen statt hart abschneiden **oder** aufklappbar), sodass Chris immer den kompletten
   Namen lesen kann. In der Sortiment-Tabelle löst das die resizable Artikel-Spalte.

## B. Chris' Dashboard-Registerkarte (Kennzahlen, die ihm wichtig sind)
Die Sortiment-Vollseite soll die Spalten der Excel-Registerkarte „Dashboard" spiegeln, soweit
Daten vorhanden. Verfügbar aus `SaleWindow` (je Fenster 30/90/365/all) + `Article`:
- **Verfügbar & einzubauen:** Preis VK (avgPrice / Listenpreis) · Preis EK (ek/qty) ·
  **Rank** je Fenster · **Verkäufe** (qty) je Fenster · **Umsatz** (revenue) je Fenster ·
  **Ø Preis** (avgPrice) je Fenster · **DB I/Stk** · **DB II/Stk** · **DB II %** · Klasse · Status.
- **Braucht Lagerbestand (aktuell NICHT importiert — `Article.stock` = 0):** **Stk (Bestand)** ·
  **pot. VK€** (Stk × VK) · **Stk > VK** (Bestandsreichweite). → Diese Spalten anlegen, aber solange
  kein Bestand da ist, sauber leer/„—" bzw. „Bestand nicht importiert" anzeigen. Follow-up: optionaler
  Import des **Billbee-Artikel-Stamm-Exports** (enthält Bestand) füllt `Article.stock`.
- **Braucht Marktpreis:** **Preistendenz** → aus `MarketPrice` (Seite /marktpreise), sonst „—".

---

## 1. `/sortiment` — Vollständige Artikelliste
**Zweck:** Alle ~1.500 Kartenartikel durchsuchen/sortieren/filtern — ungekürzte Dashboard-Tabelle.
- Bestehende `SortimentTable`-Logik als Basis, aber: `slice`/`revenue>0`-Filter raus; `SortimentRow`
  um qty je Fenster, dbII% (gewähltes Fenster), ek/Stk + Chris' Dashboard-Spalten (§B) erweitern.
- ~1.500 Zeilen: alles serverseitig laden, **Filter/Sortierung clientseitig**; Rendering auf 100
  Zeilen + „Mehr laden".
- **Layout:** Topbar (H1 „Sortiment", Sub „1.514 Artikel · X aktiv / Y Ladenhüter", rechts `.search`
  Name/Set-Code + `.seg` Fenster, Default 90) → Filterzeile (`.chip`-Toggles: Klasse, Preis-Status,
  „nur Ladenhüter"; Zähler „X von Y") → **volle resizable Tabelle** mit Chris' Spalten, klickbar
  sortierbare Köpfe (▲▼), Default-Sort = Velocity 90d.
- **Neu:** `SortimentFilterBar` (Client), `useSortimentFilter`-Hook (Suche normalisiert wie Match-Key).
  URL-Query-Sync (`?q=&fenster=&klasse=`).

## 2. `/top-flop` — Ranglisten
**Zweck:** Top-Seller, Margen-Champions, Low-Runner, Ladenhüter auf einen Blick, je Fenster.
- **2×2-Grid (`.grid-2`), keine Tabs** (der Vergleich ist der Wert). **Ein** globaler Fenster-
  Umschalter in der Topbar, Default 90 T (nie Lebenszeit → Bundle-Falle §2 KONZEPT).
- **Top-Seller** (good): Top 10 Umsatz/Fenster; Zeile = Rang + Name/Set-Code + Umsatz + Stk +
  DB-II-%-Pill + `.bar` (relativ zu Platz 1); Badge „▼ fällt ab" bei Klasse `faellt_ab`.
- **Margen-Champions** (accent): Top 10 DB II %/Fenster, Schwelle qty ≥ 3.
- **Low-Runner** (crit): schlechteste DB II % (Lebenszeit), DB II € negativ + Stk verkauft.
- **Ladenhüter** (warn): qty365 = 0 trotz Historie, sortiert nach gebundenem EK; Kartenkopf
  „≈ € X gebunden · Y Artikel".
- **Neu:** generische `RankList`-Komponente (4 Instanzen), `buildTopFlop(aggregates, window)`.
- Klick auf Eintrag → `/sortiment?q=<name>`.

## 3. `/marktpreise` — Cardmarket-Vergleich (Provider B, KEINE API, §7.1)
**Zweck:** Manuell gepflegte Cardmarket-Preise erfassen; eigenen EK/VK gegen Markt (Ampel §7.4).
- **Erfassungs-Karte:** links Artikel-Picker (Autocomplete gegen bestehende `/api/articles/search`),
  nach Auswahl **„Bei Cardmarket öffnen"-Link** aus Set-Code+Name mit harten Parametern
  `sellerCountry=7&language=3&minCondition=2&amount=<packQty>` (DE-Karten, DE-Verkäufer). Rechts
  Eingabeformular = `MarketPrice`-Felder (ab · Trend · 30-T-Ø · 7-T-Ø · 1-T-Ø · Verfügbar), Komma &
  Punkt akzeptieren (Parser aus `src/lib/parsing`). Speichern → `POST /api/market-price` (neuer
  Datensatz, Historie bleibt).
- **Detail-Panel** (`.grid-2`): links `.pricegrid`/`.pcell` (ab/Trend/30-T-Ø/Verfügbar) + `.calc`
  „EK-Ableitung" (Markt-ab × packQty + Einkaufs-Versand = Markt-EK §7.2 vs. eigener Ø-EK/Stk; rot
  wenn eigener EK > Markt-EK). Rechts: `Corridor` (wiederverwendet) + **Markt-Marker** (blauer
  `--market`-Marker für Trend) + Ampel-Kachel („zu günstig"/„im Korridor"/„zu teuer ggü. Markt",
  ±15 % um Trend = neutral).
- **Vergleichstabelle** (resizable): Artikel · eigener VK · EK/Stk · Markt ab · Markt Trend ·
  Δ VK↔Trend % · Ampel · **Datenstand** (`fetchedAt`; > 30 T → `.p-warn` „veraltet").
- **Neu:** `MarketPriceForm`, `MarketComparisonTable`, `GET/POST /api/market-price`,
  `classifyMarketStatus()` in `marketPrice.ts` (Interface vorbereitet). Dashboard-`CardmarketPlaceholder`
  danach durch Mini-Teaser ersetzen (Link hierher).

## 4. `/empfehlungen` — Handlungsempfehlungen (§8 Stufe 1, regelbasiert)
**Zweck:** Alle Empfehlungen vollständig, priorisiert nach €-Effekt (nicht nur Top-4 des Dashboards).
- **Summen-KPI-Zeile** (`.grid-kpi`, 4 Tiles): Gebundenes Kapital (Ladenhüter) € · Verlust p.a.
  (Low-Runner) € · Verschenkte Marge (VK<MIN) €/Stk · Nachkauf-Kandidaten Anzahl.
- Filterzeile: `.chip`-Toggles je Aktionstyp + Sortier-`.seg` (nach €-Effekt / Dringlichkeit).
- **Liste** (`.rec`-Zeilen, vollständig): Icon · Titel (Artikel + Aktion) · Begründung
  (`reason` + Kennzahlen) · Aktions-Chip · **€-Effekt** (`.eff`). Ladenhüter als **ein** Sammel-
  Eintrag „Lot bilden" mit aufklappbarer Artikelliste (nicht 900 Zeilen).
- `buildRecommendations()` verallgemeinern (alle low_runner / unter_min / champion + Ladenhüter-Sammel).
  Sortierung |€-Effekt| absteigend, crit zuerst. „Ausblenden" v1 clientseitig (localStorage).

## 5. `/einstellungen` — Kostensätze & Konto (§7.3)
**Zweck:** Alle Parameter der Preis-Engine editieren, Datenstand einsehen, Session verwalten.
- **Kostensätze-Formular** (`.card` je Gruppe): Einkaufs-Versand (<5 / ≥5) · Versand & Verpackung
  (Einzel|Pack) · Prio/Einschreiben · eBay-Gebühren (0,35 € fix, 11 % Provision, 19 % USt,
  Anzeigen 9/9/10 %) · Fixkosten p.a. (eBay-Shop 95, Billbee 25, Lexoffice 60) · Margen-Ziele
  (×1,33 ≈ 25 % MIN, ×1,66 ≈ 35 % GUT) mit Klartext-Ableitung. %-Felder als Prozent anzeigen,
  als Faktor speichern.
- **Live-Vorschau** (`.calc`): Beispielrechnung (0,59 € × 3er-Pack) HK→VK-Kosten→MIN/GUT, rechnet
  bei jeder Änderung neu (`computeHk`/`computePriceCorridor`).
- Speichern = **neue Version** (`active=true`, alte `false` — kein Überschreiben) + „Zurücksetzen".
- **Datenstand-Karte:** letzte `ImportBatch`-Läufe (Tabelle) + Link `/import`.
- **Konto-Karte:** Login-Status, Logout (`/api/auth/logout`), optional Theme-Umschalter (Tokens da).
- **Neu:** `CostSettingsForm` (Client), `GET/PUT /api/settings/costs`, `ImportHistoryCard`.

---

## Seitenübergreifende Prinzipien
1. **Ein Shell, ein Aktiv-State:** alle Seiten `AppShell`; Sidebar-`active` aus Route; Topbar immer
   H1 + Sub + rechts Werkzeuge; Footer immer Datenstand.
2. **Fenster-Semantik heilig:** 30/90/365/Lebenszeit-Umschalter überall gleich (`.seg`), rechts in der
   Topbar, **Default 90 T** (nie Lebenszeit — Bundle-Falle §2). Fensterunabhängige Kennzahlen
   (Ladenhüter, Low-Runner) explizit beschriften.
3. **Keine erfundenen Zahlen:** leere Zustände im `CardmarketPlaceholder`-Stil (gestrichelte Box +
   Erklärung + CTA zu `/import` bzw. Erfassung). Server Components laden, Client nur Filter/Formulare.
4. **Farb-Semantik strikt aus Tokens:** `--good` gesund, `--warn` beobachten/veraltet, `--crit`
   Verlust/unter MIN, `--market` (blau) Markt/Info. Zahlen `.num`, € via `formatEuro*`, % 1 Nachkomma.
5. **Seiten verlinken statt duplizieren:** Ranglisten/Empfehlungen → `/sortiment?q=…`; Dashboard-Karten
   werden „Top 4 + Alle ansehen →"-Teaser; Filterzustände in URL-Query.

## Regeln für die Umsetzung
- `npm run build` + `npm test` grün halten; kleine, lauffähige Commits auf die Branch
  `claude/enterich-cards-shop-qdf6m8` (aktualisiert PR #111).
- Nichts außerhalb `apps/LEC/` anfassen. Keine echten Geschäftsdaten committen.
- Für Seiten 1–5 ist **keine Schema-Änderung** nötig (`MarketPrice`, `CostSettings`, `SaleWindow`
  decken alles ab). Ausnahme optional: Bestands-Import (Billbee-Artikel-Stamm) für Stk/pot.VK€/Stk>VK
  — nur wenn Zeit, sonst als Follow-up dokumentieren.
