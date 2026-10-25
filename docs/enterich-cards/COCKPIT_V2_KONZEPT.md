# LEC Cockpit v2 („/cockpit") — Konzept

> Neue Dashboard-Seite **neben** dem bestehenden Dashboard (`/`), zum Vergleichen. Nichts Bestehendes
> wird umgebaut; die Datenlogik (`src/lib/dashboard/queries.ts`, `viewModel.ts`, `src/lib/pricing/*`)
> wird wiederverwendet, nicht dupliziert. Chris' Auftrag (13.10.): „nach aktuellen Benchmarks die
> Seite neu bauen! komplett modern, Konzept erarbeiten und dann wirklich step by step aufbauen.
> […] Modernes schnelles Design, gute Grafiken, übersichtlich, richtiges LEC-Dashboard!"

Stand: 13.10.2026. Route `/cockpit`, Komponenten `src/components/cockpit/`, Datenaufbereitung
`src/lib/cockpit/`.

---

## 0. Verbindliche Leitplanke: reine Anzeige, nichts manuell pflegen

Chris, wörtlich: „ich möchte dort NICHTS manuell pflegen, ich würde dir immer nur Upload-Dateien
geben, die du eigenständig dort einarbeitest, das soll ein reines OPTISCHES Dashboard sein und darauf
soll der Fokus liegen, keine eigenen Werte etc."

Daraus folgt für das Cockpit:

- **Keine Eingabefelder, Formulare, Speichern-Knöpfe, editierbaren Werte.** Erlaubt sind nur Dinge,
  die keine Daten ändern: Zeitfenster-Umschalter, Sortierung, Links auf andere Seiten.
- **Daten kommen ausschließlich aus den Importen** (Billbee-Fenster 30/90/365/all, eBay-Report,
  Billbee-Artikelstamm). Keine zweite Datenquelle, keine Handeingabe.
- **Planwerte sind benannte Konstanten im Code** (`src/lib/cockpit/planwerte.ts`), nicht in der
  Oberfläche einstellbar. Pflege per Code/Datei, nicht per Formular. Jede Konstante trägt Herkunft und
  Datum als Kommentar, die Oberfläche zeigt sie als „Planwert" gekennzeichnet.
- **Wo Daten fehlen, zeigt das Cockpit die Lücke ehrlich an** — „EK fehlt bei X aktiven Artikeln,
  Anteil am 90-T-Umsatz Y %" — statt zur Eingabe aufzufordern. Es gibt keine EK-Pflege-Route und
  keine `src/lib/ek/*`; darauf baut nichts auf.
- **Keine erfundenen Zahlen.** Fehlt eine Datenbasis (z. B. Einkäufe, Bestand), steht dort ein
  leerer Zustand mit Erklärung, nie ein geschätzter Wert ohne Kennzeichnung.

---

## 1. Ziel und Zielbild in einem Satz

In **fünf Sekunden** soll Chris sehen: Wie läuft der Laden im gewählten Fenster (Umsatz, Stück, Marge
nach Stufen), **wo** die Marge bleibt (Deckungsbeitrags-Brücke) und **ob er innerhalb der
steuerlichen Leitplanken** liegt (Gewinnkorridor, Umsatz-Arbeitsgrenze, Warenbudget). Beim Scrollen
folgt das „Warum": Sortimentsgesundheit, Preis-Ampel, Top-/Flop-Mover, Datenlücken, Datenstand.

Chris ist Controller. Deshalb: **Zahlen vor Einschätzungen, Herleitung sichtbar** (jede Kennzahl hat
eine Unterzeile, die sagt, aus welchem Fenster und welcher Formel sie kommt), **eine Achse je Chart**,
keine Dekoration.

---

## 2. Recherche: was aktuelle Seller-/Analytics-Dashboards gemeinsam haben

Kurz und gezielt (13.10.2026, Quellen am Ende):

| Muster | Wo zu sehen | Übernahme ins Cockpit |
|---|---|---|
| **Eine Metrik-Leiste oben, Zeitraum-Umschalter steuert alles darunter** | Shopify Analytics (seit 06/2025 Standard: Metrik-Karten, konfigurierbare Sektionen), eBay Seller Hub „Performance → Sales" | Ja: Fenster-Umschalter 30/90/365/Lebenszeit in der Topbar, **alle** Module unten laufen auf demselben Fenster (dataviz-Regel „ein Filter-Row scoped alles"). |
| **Stat-Tile = Label · Wert · Kontextzeile · kleine Grafik** | Stripe, Vercel, Linear; Shopify-Metrik-Karten | Ja, aber mit **ehrlicher Mini-Grafik**: wir haben keine Tagesreihe, also keine erfundene Sparkline, sondern drei Run-Rate-Balken (Ø/Monat: letzte 30 T · Tage 31–90 · Tage 91–365). |
| **Weniger Sparklines in Übersichtskarten, Fokus auf die Zahl** | Shopify-App-Changelog 08/2026 (Sparklines aus Summary-Cards entfernt) | Teilweise: Mini-Grafik nur dort, wo sie etwas Eigenes sagt (Tempo-Vergleich), nicht als Deko. |
| **Dichte Tabellen als Hauptfläche, oben eine ruhige Ebene** | Stripe (Dichte-Referenz), Linear | Ja: Oben ruhig (Tiles + zwei Charts), unten dicht (Mover-Listen, Klassen, Datenstand). |
| **Bullet Graph für Ist vs. Ziel/Grenze** statt Tacho | Stephen Few, *Information Dashboard Design* Kap. 6; *Bullet Graph Design Specification* | Ja, für alle drei Leitplanken: dicker Ist-Balken, dünne Zielmarke, graue Kontextbänder. Kein Gauge, kein Donut. |
| **Dark-first für Power-User-Tools, Light als gleichwertige Variante** | Linear, Vercel, Supabase | Ja: bestehende Tokens (abgenommener Mockup `design-reference.html`) bleiben, dunkel ist Standard (`layout.tsx` setzt `data-theme="dark"`), hell funktioniert über dieselben Tokens. |
| **Top-N mit „Rest"-Gruppe, wählbar** | Shopify „flexible top items" (09/2025) | Ja: Klassen- und Preisampel-Verteilungen als 100 %-Stapel mit vollständigen Labels, Mover-Listen Top 6. |

---

## 3. Informationsarchitektur

### 3.1 Erste fünf Sekunden (above the fold, Desktop ≥ 1280 px)

```
┌ Topbar: „Cockpit" · Untertitel mit Datenstand ·        [30 T | 90 T | 365 T | Lebenszeit] ┐
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ KPI-Leiste (5 Tiles)                                                                      │
│ Umsatz │ Verkäufe (Stk, Ø VK) │ DB II % (DB I % darunter) │ DB III € │ EK-Lücke (Daten)    │
├──────────────────────────────────────┬─────────────────────────────────────────────────────┤
│ Deckungsbeitrags-Brücke (Waterfall)  │ Leitplanken (3 Bullet Graphs)                       │
│ Umsatz → −Ware → DB I → −eBay →      │ Umsatz rollierend 365 T vs. 24.000 / 25.000 €       │
│ −Versand/Verpackung → DB II →        │ Ergebnis-Proxy DB III 365 T vs. 1.400 / 1.600–1.800 │
│ −Fixkostenanteil → DB III            │ Warenbudget Nov+Dez 980 € vs. Einkäufe (falls Daten)│
└──────────────────────────────────────┴─────────────────────────────────────────────────────┘
```

### 3.2 Beim Scrollen

```
┌ Tempo: Umsatz, Wareneinsatz, DB II als Ø/Monat in drei Zeitbändern (gruppierte Säulen)  ┐
├──────────────────────────────────────┬────────────────────────────────────────────────────┤
│ Sortimentsgesundheit                 │ Preis-Ampel                                        │
│ 100 %-Stapel: Anzahl Artikel je      │ 100 %-Stapel: aktive Artikel nach Preis-Status     │
│ Klasse + 100 %-Stapel: Umsatzanteil  │ (unter MIN · Ziel unerreichbar · im Korridor ·     │
│ je Klasse (365 T)                    │ über GUT · kein EK)                                │
├──────────────────────────────────────┼────────────────────────────────────────────────────┤
│ Läuft (Top 6 Umsatz im Fenster)      │ Bremst (Top 6 negativer DB II, Fenster)            │
│ mit Kartenbild, Stk, DB II %         │ + „Fällt ab" (Klasse faellt_ab, 90-T vs. 365-T)    │
├──────────────────────────────────────┴────────────────────────────────────────────────────┤
│ Kapital & Tempo: gebundenes Kapital (Bestand × EK), Reichweite in Monaten,                │
│ Verkaufstempo (Wareneinsatz/Monat) vs. Einkaufstempo (Purchase-Tabelle, sonst „keine     │
│ Einkaufsdaten importiert" + Planwert 782 €/Monat gekennzeichnet)                          │
├───────────────────────────────────────────────────────────────────────────────────────────┤
│ Footer: Datenstand je Import-Art (letzter Lauf, Fenster von–bis), Artikelzahl, Hinweis    │
│ „alle Zahlen serverseitig aus den Importen, Planwerte aus src/lib/cockpit/planwerte.ts"   │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

Modul 14 (Preis-Hinweise Cardmarket) sitzt zwischen Preis-Ampel und Läuft/Bremst; es kam mit dem
Merge von `claude/peaceful-rubin-k1nggz` (automatischer Cardmarket-Marktwert, alle manuellen
Eingaben aus der App entfernt) dazu.

### 3.3 Bewusst **nicht** auf dem Cockpit

- Keine vollständige Sortiment-Tabelle (dafür gibt es `/sortiment`; das Cockpit verlinkt).
- Keine Empfehlungsliste mit Klartext (dafür `/empfehlungen`); das Cockpit zeigt nur Zahlen.
- Kein Cardmarket-Platzhalter und keine Marktpreis-Erfassung: der Marktwert kommt automatisch
  (`MarketPrice`, source `cardmarket-priceguide`), das Cockpit zählt ihn nur aus (Modul 14); die
  Detailtabelle bleibt auf `/marktpreise`.
- Keine Kalenderjahres-GuV: die DB kennt nur rollierende Fenster (30/90/365/all), **keine
  Kalenderjahr-Summe**. Alles „Jahres"-Artige ist deshalb als **„rollierend 365 T"** beschriftet
  und ausdrücklich **kein Ersatz für die EÜR** (siehe 5.3).

---

## 4. Module im Detail — Datenquelle, Chart-Form, Begründung

Alle Module lesen aus **einem** Ladevorgang: `loadArticleAggregates(prisma)` (bestehend) →
`buildDashboardViewModel(aggregates, costSettings)` (bestehend, liefert `windows`, `sortiment`,
`deadCapital`, `quotas`, `recommendations`) → `buildCockpitViewModel(...)` (neu, `src/lib/cockpit/`)
rechnet nur **zusätzliche Ableitungen** und fasst zusammen. Dadurch stimmen DB I/II/III, Korridor,
Klassen und Fensterzahlen **per Konstruktion** mit der alten Seite überein — es ist dieselbe Funktion.

| # | Modul | Datenquelle (bestehend) | Neue Ableitung (`src/lib/cockpit/`) | Form | Warum diese Form |
|---|---|---|---|---|---|
| 1 | **Umsatz** | `vm.windows[w].revenue` | Run-Rate-Bänder aus 30/90/365 (`bands.ts`) | Stat-Tile + 3 Mini-Balken | Eine Zahl ist das Chart; Sparkline wäre erfunden (keine Tagesreihe). Drei Ø/Monat-Balken zeigen ehrlich, ob das Tempo zieht oder nachlässt. |
| 2 | **Verkäufe** | `vm.windows[w].qty`, `avgPrice` | — | Stat-Tile | Stückzahl + Ø VK, Kontextzeile. |
| 3 | **DB II %** | `vm.windows[w].dbIIPercent`, `dbIPercent` | — | Stat-Tile | Marge je Fenster, DB I darunter. |
| 4 | **DB III €** | Summe `agg.dbII − agg.fixedCostShare` über Artikel im Fenster | `bridge.ts` | Stat-Tile, Vorzeichen-Farbe (Status) | Vollkosten-Ergebnis des Fensters; einzige rote/grüne Zahl in der Leiste. |
| 5 | **EK-Lücke** | `hasNoEkData(a)`, `a.active`, `windows["90"].revenue` | `ekGap.ts`: Anzahl, Anteil aktive, Umsatzanteil 90 T | Stat-Tile (warn) | Chris' größtes Datenproblem (722 aktive Artikel). Keine Aufforderung, nur die Zahl. |
| 6 | **Deckungsbeitrags-Brücke** | je Fenster Summen von `revenue, ek, ebayFeeTotal, shippingCost, fixedCostShare, dbI, dbII` | `bridge.ts` | **Waterfall, horizontal** | Zeigt, wo die Marge bleibt. Controller-Standard; eine Achse, Summenbalken (Umsatz, DB I/II/III) in Akzent, Abzüge in Crit-Ton, Direktlabel am Balkenende. |
| 7 | **Leitplanken** | `windows["365"].revenue`; DB III 365 T; `Purchase`-Tabelle (falls Daten) | `planwerte.ts`, `guardrails.ts` | **3 Bullet Graphs** | Few: Ist-Balken dick, Zielmarke dünn, Kontextbänder grau. Grenze (24.000/25.000) und Korridor (1.600–1.800) sind Bänder, nicht Tacho. |
| 8 | **Tempo** | Fenster 30/90/365 | `bands.ts`: Ø/Monat je Band für Umsatz, Wareneinsatz, DB II | gruppierte Säulen, 3 Serien, 3 Gruppen | Zeigt Verkaufstempo vs. Wareneinsatz-Tempo (EÜR-Logik: Ware ist sofort Aufwand). 3 Serien = kategorisch sicher (validiert, s. 6). Legende + Direktlabel. |
| 9 | **Sortimentsgesundheit** | `vm.sortiment[].articleClass`, `revenue365` | `distribution.ts` | 2 × 100 %-Stapelbalken (Artikel-Anteil, Umsatz-Anteil) | Teil-zum-Ganzen über 6 geordnete Klassen (Champion → Ladenhüter) = ordinal; eine Hue-Rampe von Good zu Crit ist hier **Status**, deshalb mit Label + Zahl je Segment, nie Farbe allein. |
| 10 | **Preis-Ampel** | `vm.sortiment[].priceStatus` (nur `active`) = `classifyPriceStatus` gegen den MIN/GUT-Korridor aus `costEngine.ts` (`computePriceCorridor`) | `distribution.ts` | 100 %-Stapelbalken | Verteilung der Korridor-Zustände, „kein EK" als eigener grauer Anteil. **Maßstab ist Chris' Preis-Spanne** (Deckungsbeitrags-Marge Minimum bis Optimum): VK-MIN = Basis × `marginMinMultiplier` (1,33 → ≈ 25 %), VK-GUT = Basis × `marginGoodMultiplier`. Das Cockpit rechnet keinen eigenen Maßstab, es zählt die Einstufung und beschriftet sie aus den aktiven Kostensätzen. |
| 11 | **Läuft / Bremst / Fällt ab** | `vm.sortiment` (Fenster-Umsatz, DB II, Klasse) | `movers.ts`: Top 6 je Liste für das gewählte Fenster | Listen mit Mini-Balken (relativ zu Platz 1) + Kartenbild | Identität braucht Namen, nicht Farbe. Bild hilft Chris beim Erkennen (Übergabe §6). |
| 12 | **Kapital & Tempo** | `boundCapitalOf(a)`, `stock`, Wareneinsatz je Band, `Purchase` | `capital.ts` | Stat-Tiles + Bullet (Reichweite) | Einkauf vs. Verkauf ist der EÜR-Hebel. Ohne Purchase-Daten: leerer Zustand + Planwert. |
| 13 | **Datenstand** | `listRecentImportBatches(prisma)` (bestehend) | letzter Lauf je `kind` | Footer-Zeile | Ein veraltetes Abbild sieht aus wie ein gültiger Stand (CLAUDE.md-Lektion). |
| 14 | **Preis-Hinweise Cardmarket** | `MarketPrice` (source `cardmarket-priceguide`, automatisch), `buildMarketComparisonRow` aus `marketComparison.ts` (dieselbe Zeile wie `/marktpreise`) | `marketHints.ts`: Zählung zu günstig / im Korridor / zu teuer / EK über Markt, Abdeckung, mehrdeutig, veraltet; Top 5 je Richtung nach €-Hebel (Lücke × max(Bestand, 90-T-Absatz)) | 5 Fakt-Kacheln + 2 Listen mit Mini-Balken | Marktwert ist eine Zahl je Artikel, kein Zeitverlauf: Zählen und Rangliste sind die ehrliche Form. Bewertung wird nicht dupliziert, nur gezählt. Ohne Marktwert kein Urteil, keine erfundenen Preise. |

### 4.1 Fenster-Semantik

Default **90 T** (wie überall, nie Lebenszeit — Bundle-Falle KONZEPT §2). Der Umschalter ist ein
Satz **Links** (`/cockpit?fenster=30|90|365|all`), die Seite ist eine Server Component und rendert
das Fenster serverseitig. Kein Client-State, kein Hydration-JS für den Umschalter. Module, die
fensterunabhängig sind (Leitplanken auf 365 T, Ladenhüter, Preis-Ampel), tragen ihr Fenster im
Titel.

### 4.2 Run-Rate-Bänder (die ehrliche „Sparkline")

Die Fenster sind verschachtelt (30 ⊂ 90 ⊂ 365). Daraus folgen drei disjunkte Zeitbänder:

```
Band A  Tage 1–30     Ø/Monat = W30
Band B  Tage 31–90    Ø/Monat = (W90 − W30) / 2
Band C  Tage 91–365   Ø/Monat = (W365 − W90) / (275/30 ≈ 9,17)
```

Gilt für Umsatz, Stück, Wareneinsatz, DB II. Negative Differenzen (nur bei inkonsistenten Importen
mit verschiedenen `windowTo`) werden auf 0 geklemmt und als Hinweis gezeigt. Lebenszeit bekommt
kein Band (Zeitraum unbekannt).

### 4.3 Kartenbilder

`Article.imageFile`/`imageGuid` kommen mit PR #1183 (Route `/api/article-image/[id]`). In diesem
Stand fehlen die Felder im Schema; der Loader liest sie **defensiv** (`(article as { imageFile?:
string | null }).imageFile ?? null`), und die Mover-Listen zeigen einen neutralen Platzhalter
(Set-Code-Kachel), wenn kein Bild da ist. Bild-URL: `/api/article-image/<articleId>?v=<imageGuid>`.

---

## 5. Planwerte (`src/lib/cockpit/planwerte.ts`)

Alle Werte stammen aus dem Übergabe-Dokument (13.10.2026) und Chris' Steuerplanung. **Pflege nur
per Code/Datei** (Leitplanke 0), kein UI.

| Konstante | Wert | Herkunft |
|---|---|---|
| `GEWINN_PROGNOSE_FINANZAMT_EUR` | 1.400 | Totalgewinnprognose 2026, beim Finanzamt eingereicht |
| `GEWINN_ZIELKORRIDOR_EUR` | 1.600 – 1.800 | Chris' Zielkorridor (über 1.400, nicht zu weit darüber) |
| `UMSATZ_ARBEITSGRENZE_EUR` | 24.000 | selbst gesetzte Arbeitsgrenze |
| `KLEINUNTERNEHMER_GRENZE_EUR` | 25.000 | § 19 UStG Vorjahresumsatz |
| `WARENBUDGET_NOV_DEZ_EUR` | 980 | Rest-Q4-Budget (Nov + Dez zusammen) |
| `EINKAUFSRATE_NORMAL_EUR_MONAT` | 782 | bisherige Einkaufsrate (nur Vergleichswert) |
| `TARGET_WARENQUOTE`, `TARGET_BETRIEBSAUSGABENQUOTE` | 0,43 / 0,40 | wie `viewModel.quotas` (bleiben dort) |

### 5.1 Umsatz-Leitplanke

Ist = `windows["365"].revenue` (rollierend). Bänder: 0–24.000 neutral, 24.000–25.000 warn,
> 25.000 crit. Beschriftung: „rollierend 365 T, nicht Kalenderjahr". Ein Kalenderjahreswert ist aus
den Importen nicht ableitbar — das steht so dran.

### 5.2 Ergebnis-Leitplanke (Proxy)

Ist = Σ (dbII − fixedCostShare) über alle Artikel im 365-T-Fenster = DB III rollierend. Marken:
1.400 (Prognose), Band 1.600–1.800 (Ziel). **Klar beschriftet als Proxy:** DB III ist das
Vollkosten-Ergebnis der *verkauften* Ware; die EÜR zählt Wareneinkauf im Zahlungsjahr (sofort
Aufwand), also weicht die EÜR um (Einkauf − Wareneinsatz) ab. Genau diese Differenz zeigt Modul 12.

### 5.3 Warenbudget-Leitplanke

Ist = Σ `Purchase.qty × unitEk + buyShipping` mit `date` in Nov/Dez des laufenden Jahres. Die
`Purchase`-Tabelle wird derzeit von keinem Importer befüllt → in Produktion zeigt der Bullet den
leeren Zustand „keine Einkaufsdaten importiert" und nur die Budgetmarke. Sobald ein Einkaufs-Import
existiert, füllt sich das Modul ohne Codeänderung.

---

## 6. Design-Tokens, Farben, Typografie

**Basis bleibt der abgenommene Mockup** (`design-reference.html`, Tokens in `globals.css`): `--bg`,
`--panel`, `--ink`, `--muted`, `--accent` (Gold), `--good`, `--warn`, `--crit`, `--market` (Blau).
Das Cockpit ergänzt in `src/app/cockpit/cockpit.css` nur **Serienfarben für Charts** mit eigenem
Dunkel-Schritt, weil die bestehenden Dunkel-Tokens als *Flächenfarbe* für Charts zu hell sind
(validiert, s. u.):

| Rolle | Hell (Surface `#ffffff`) | Dunkel (Surface `#1d1726`) | Einsatz |
|---|---|---|---|
| `--ck-s1` Gold | `#a8791f` | `#b8862a` | Serie 1: Umsatz, Summenbalken Waterfall, Ist-Balken Bullet |
| `--ck-s2` Blau | `#356bb0` | `#3f7fcd` | Serie 2: Wareneinsatz |
| `--ck-s3` Grün | `#1c9860` | `#259664` | Serie 3: DB II (nur **neben** Blau, nie all-pairs mit Rot) |
| Status good/warn/crit | bestehende Tokens | bestehende Tokens | **nur** mit Label + Zahl, nie Farbe allein |
| Grid/Achse | `--line` / `--border` | dito | Hairline 1 px, durchgezogen |

**Validierung** (`dataviz/scripts/validate_palette.js`, 13.10.):
- Hell `#a8791f,#356bb0,#1c9860` → alle Prüfungen PASS (schlechtestes Nachbarpaar ΔE 19,2 deutan,
  20,9 normal, alle ≥ 3:1).
- Dunkel `#b8862a,#3f7fcd,#259664` auf `#1d1726` → alle Prüfungen PASS (ΔE 17,8 deutan, 19,4 normal).
- Die bestehenden Dunkel-Tokens (`#d8ab45,#63a0e6,#43c188`) fallen aus dem Lightness-Band
  (L 0,69–0,76 > 0,67) → deshalb eigene Chart-Schritte, Text/Pills behalten die alten Tokens.
- Rot als vierte *Serie* scheitert (crit↔good ΔE 4,7 deutan) → Rot ist im Cockpit **ausschließlich
  Status** (Abzüge im Waterfall, negatives DB III, „unter MIN"), immer mit Beschriftung.

**Mark-Spezifikationen** (dataviz): Balken ≤ 24 px, 4 px gerundetes Datenende, 2 px Surface-Lücke
zwischen Stapelsegmenten, Linien 2 px, Hairline-Grid, selektive Direktlabels (Endwert, Extremum),
Legende ab 2 Serien, Text immer in Text-Tokens (nie Serienfarbe), tabular-nums nur in Spalten,
proportional in Tiles.

**Typografie:** System-Sans (`--fs-sans`), Mono (`--fs-mono`) nur für Set-Codes/Spalten.
Hero-Zahlen 28–32 px semibold, Labels 11,5 px, Kontextzeilen 12 px `--muted`.

**Hover-Ebene:** Server-Component-Seite ohne Client-JS → native SVG-`<title>`-Tooltips je Mark
(Kategorie + Wert). Jeder Wert ist zusätzlich direkt beschriftet oder steht in der Modul-Tabelle
darunter (`<details>` „als Tabelle"), die Tooltips sind nie der einzige Weg.

---

## 7. Layout-Raster

**Desktop (≥ 1180 px):** 12-Spalten-Grid, Gutter 14 px, Seitenränder 26 px (wie `main`).
KPI-Leiste 5 × (12/5), Brücke 7 Spalten + Leitplanken 5, Tempo 12, Gesundheit 6 + Ampel 6,
Läuft 6 + Bremst 6, Kapital 12, Footer 12.

**Tablet (920–1180 px):** KPI 3 + 2, alle Paare 6/6 bleiben, Brücke/Leitplanken untereinander.

**Mobil (< 920 px):** eine Spalte, 16 px Seitenrand, Sidebar ausgeblendet (bestehende Regel),
Fenster-Umschalter als volle Breite unter dem Titel, Waterfall bleibt horizontal (Labels links,
Balken rechts — skaliert ohne Umbruch), Stapelbalken behalten Labels in einer Legendenliste darunter.
Kein horizontales Scrollen der Seite.

---

## 8. Performance-Budget

| Posten | Budget | Umsetzung |
|---|---|---|
| Client-JS der Seite | **0 KB zusätzlich** (nur Next-Runtime + bestehende Sidebar, die ist bereits Client) | Alle Cockpit-Komponenten Server Components; Charts als inline SVG; Fenster-Umschalter als Links |
| Externe Chart-Bibliothek | **keine** | Waterfall, Bullet, Stapel, Säulen sind je < 80 Zeilen SVG; eine Bibliothek (Recharts ≈ 100 KB+, Chart.js ≈ 60 KB) brächte Hydration und Client-Rendering ohne Mehrwert |
| Neue Dependencies | **keine** | — |
| Datenbank | 1 Ladevorgang (`loadArticleAggregates`) + 1 `importBatch`-Query + 1 `purchase`-Aggregat | ~1.500 Artikel × 4 Fenster, wie `/` heute |
| Serverzeit | < 300 ms bei 1.500 Artikeln (Ziel) | View-Model ist O(n), keine zweite Klassifikation |
| Bilder | lazy, 40 × 56 px, `loading="lazy"`, Platzhalter ohne Request | Nur in Mover-Listen (≤ 18 Bilder) |
| CSS | eine Datei `cockpit.css`, Präfix `ck-`, keine Überschneidung mit `globals.css` | — |

---

## 9. Abgrenzung zur alten Seite (`/`)

| | Alt `/` | Neu `/cockpit` |
|---|---|---|
| Rendering | Client Component (`DashboardShell` mit `useState`), Hydration | Server Component, 0 KB Client-JS |
| Fenster | Client-State | URL-Parameter, serverseitig |
| KPI | 4 Tiles (Umsatz, Stk, DB II %, Totes Kapital) | 5 Tiles (+ DB III €, EK-Lücke), Run-Rate-Bänder |
| Charts | keine (Balken in Listen) | Waterfall, 3 Bullets, gruppierte Säulen, 3 Stapel |
| Leitplanken | Betriebsquoten vs. Ziel | Gewinnkorridor, Umsatzgrenze, Warenbudget, Einkauf vs. Verkauf |
| Sortiment-Tabelle | Vorschau 8 Zeilen | keine (Link `/sortiment`) |
| Empfehlungen | Top 4 Klartext | keine (Link `/empfehlungen`), nur Zahlen |
| Cardmarket | Platzhalter-Karte | kein Modul |
| Zahlenbasis | `buildDashboardViewModel` | **dieselbe Funktion** + Ableitungen |

Beide Seiten bleiben erreichbar; die Sidebar bekommt einen Eintrag „Cockpit (neu)". Entscheidung,
welche bleibt, trifft Chris nach dem Vergleich.

---

## 10. Umsetzungsschritte (je ein Commit)

1. Konzept (dieses Dokument).
2. Grundgerüst: Route `/cockpit`, `cockpit.css` mit Tokens, `planwerte.ts`, `buildCockpitViewModel`
   (Skelett + Tests), Sidebar-Eintrag, Demo-Seed `scripts/seed-demo.ts`.
3. KPI-Leiste mit Run-Rate-Bändern.
4. Hauptcharts: Deckungsbeitrags-Brücke, Tempo-Säulen.
5. Listen: Läuft / Bremst / Fällt ab mit Bild-Platzhalter; Verteilungen (Gesundheit, Preis-Ampel).
6. Leitplanken-Modul (Bullets) + Kapital & Tempo.
7. Feinschliff, Mobil, Datenstand-Footer, Screenshots (Desktop/Handy, hell/dunkel).

Nach jedem größeren Schritt: `npx tsc --noEmit`, `npm test`, `npm run build`.

---

## 11. Offene Fragen an Chris

1. **Kalenderjahr:** Soll ein künftiger Import (z. B. Lexoffice-EÜR-Export oder Billbee-Monatsumsatz)
   die Kalenderjahr-Sicht liefern? Dann würden die Leitplanken „Umsatz" und „Ergebnis" vom
   365-T-Proxy auf echte YTD-Werte umschalten. Aus den heutigen Exporten geht das nicht.
2. **Einkäufe:** Gibt es einen Cardmarket-/Billbee-Einkaufsexport, den der Import einlesen soll
   (`Purchase`-Tabelle)? Erst dann füllt sich „Warenbudget Nov+Dez" und „Einkaufstempo".
3. **Planwerte:** Stimmen 1.400 / 1.600–1.800 / 24.000 / 25.000 / 980 / 782 so, und gelten sie für
   2026? Pflege erfolgt in `src/lib/cockpit/planwerte.ts`.
4. **Fenster-Default** 90 T wie überall — oder soll das Cockpit mit 30 T öffnen?
5. **Optimum-Marge 33 % vs. Kostensatz:** Chris nennt als Preis-Spanne 25 % (Minimum) bis 33 %
   (Optimum). Der aktive Kostensatz `marginGoodMultiplier` steht auf 1,66, das entspricht
   1 − 1/1,66 ≈ 39,8 % Vollkosten-Marge (der Kommentar in `costEngine.ts` nennt „~35 %"). Für 33 %
   wäre der Multiplikator 1,49. Das Cockpit zeigt den Wert, den die Kostensätze vorgeben, und
   ändert nichts an `costEngine.ts` — ob 1,66 bleibt oder auf 1,49 soll, ist eine Entscheidung für
   die Kostensätze (Import/Datei), nicht fürs Cockpit.

---

## Quellen der Recherche

- Shopify Changelog: [New analytics is now the default](https://changelog.shopify.com/posts/new-analytics-is-now-the-default) (06/2025),
  [Organize your analytics dashboard with custom sections](https://changelog.shopify.com/posts/organize-your-analytics-dashboard-with-custom-sections) (08/2025),
  [Flexible top items in reports](https://changelog.shopify.com/posts/flexible-top-items-in-reports) (09/2025)
- Subi Changelog: [Dashboard chart cleanup](https://subi.co/changelog/2026-08-23-dashboard-chart-cleanup) (Sparklines aus Summary-Cards entfernt)
- Stephen Few, Bullet Graph: [Wikipedia](https://en.wikipedia.org/wiki/Bullet_graph), [Peltier Tech](https://peltiertech.com/tag/bullet-graphs/), [Domo](https://domo-webflow.domo.com/learn/charts/bullet-graphs)
- Dichte-/Hierarchie-Referenzen: [AdminLTE: 25 best dashboard design examples 2026](https://adminlte.io/blog/25-best-dashboard-design-examples-for-2026-real-products-principles/),
  [925 Studios: SaaS dashboard patterns 2026](https://925studios.co/blog/saas-dashboard-design-examples-2026)
- Interne Methodik: `dataviz`-Skill (Form-Heuristik, Farbformel, Mark-Specs, Anti-Patterns), Palette per
  `validate_palette.js` geprüft.
