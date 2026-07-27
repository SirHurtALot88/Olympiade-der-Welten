# Lord Enterich Cards – Shop-Analytics-App · Konzept & Umsetzungsplan

> Arbeitsdokument für die Weiterentwicklung. Ziel: aus der bestehenden Excel-basierten
> Verkaufsauswertung eine moderne Browser-App machen, die (1) echte Marktpreise einbindet,
> (2) Top-Seller / Margen sichtbar macht und (3) KI-gestützt Low-Runner aussortiert.
> Gehostet auf demselben Hetzner-Server wie die Olympiade, aber unter einem **eigenen
> Sub-Link ohne sichtbare Verknüpfung** zur Oly.

Stand der Analyse: 2026-07-15. Datenquelle: Dropbox `/Lord Enterich Cards/` + `/Yu Gi Oh Verkäufe.xlsx`.

---

## 1. Bestandsaufnahme – was existiert heute

### 1.1 Geschäft (Kontext)
- **Lord Enterich Cards** – gewerblicher TCG-Händler (Yu-Gi-Oh! Schwerpunkt, vereinzelt Magic/Pokémon).
- Verkauf primär über **eBay** (Auftragsabwicklung via **Billbee**), Einkauf über **Cardmarket**.
- Steuerlich Einzelunternehmen (bisher Kleinunternehmer, Umsatz überschreitet die Grenze ab 2025).

### 1.2 Wirtschaftliche Eckdaten (aus `Entwicklung + Forecast 2021-2029.xlsx`)
| Jahr | Einnahmen | Wareneinkauf | Warenquote | Betriebsausgabenquote | Ergebnis |
|------|-----------|--------------|-----------|-----------------------|----------|
| 2021 | 14.031 €  | 5.734 €      | 41 %      | 51 %                  | −3.102 € |
| 2022 | 17.158 €  | 9.366 €      | 55 %      | 52 %                  | −4.427 € |
| 2023 | 19.849 €  | 7.934 €      | 40 %      | 49 %                  | −1.565 € |
| 2024 | 24.707 €  | 11.866 €     | 48 %      | 46 %                  | −5.021 € |
| 2025 FC | 27.000 € | 11.880 €    | 44 %      | 43 %                  | +1.410 € |
| 2029 FC | 44.000 € | 18.920 €    | 43 %      | 40 %                  | +5.180 € |

- Auflaufende Verluste bis 2024 ≈ 14.000 € (v. a. Raumkosten ~10 k € + Bestandsaufbau ~5,6 k €).
- Inventarwert 31.12.2024: 8.283 € → soll bis 2029 auf ~11.500 € wachsen.
- **Kernhebel** laut Zahlen: Warenquote (Einkaufspreis-Disziplin) und Betriebsausgabenquote
  (eBay-Gebühren + Versand) – genau die zwei Stellschrauben, die die App transparent machen soll.

### 1.3 Die Master-Mappe `Yu Gi Oh Verkäufe.xlsx` – schon ein starkes Modell
Die Mappe ist **kein Chaos**, sondern eine durchdachte, mehrstufige Auswertung mit 11 Blättern.
Sie definiert praktisch schon das Ziel-Datenmodell der App:

| Blatt | Zeilen | Inhalt | Rolle für die App |
|-------|--------|--------|-------------------|
| **Dashboard** | ~1.514 Art. | Pro Artikel: `Angebotstitel · Source ID · Preis VK · Preis EK · pot. VK€ · Stk (Bestand) · Rank 30/90/365d/AllTime · Verkäufe 30/90/365d/AllTime · Umsatz-Fenster · Ø Preis-Fenster` | **= Ziel-Cockpit.** Velocity nach Zeitfenster + Bestand ist hier schon modelliert |
| **ALL TIME** / **365d / 90d / 30d Billbee** | 2.870 / 780 / … | Deckungsbeitrags-Modell je Artikel & Zeitfenster: `Anzahl · Summe · EK · Marge · Einkauf-Versand · Versand · Prio/Einschreiben · Verpackung · eBay Shop · var. Kosten real/kalk. · Kosten % · Gewinn · DB I · DB II · EK/Stk` | **Kern-Kennzahlenmodell** (zeitfenster-basiert) |
| **Billbee Artikel** | 1.683 | Roh-Export Billbee-Artikelstamm (83 Spalten): `SKU · Titel · Price gross · CostPrice gross · Weight · Category …` | Roh-Importquelle (Stammdaten + EK) |
| **365d eBay** | 775 | Roh-Export eBay mit **voller Gebühren-Aufschlüsselung**: `Verkaufsprovisionen · Angebotsgebühren · Anzeigen Standard/Erweitert/Express · Internationale Gebühren · Kosten Versandetikette · Gebührengutschriften …` | Roh-Importquelle (Gebühren) |
| **Artikelabgleich** | 959 | Zuordnung Billbee ↔ eBay | **= das Namens-Matching**, das du meinst |
| **VK Preis Kalkulator** / **EK Calc** | 23 / 38 | Kalkulatoren VK-Preis / EK-Mischpreis | Logik für „Was-wäre-wenn"/Preis-Kalkulator |
| **eBay Verkäufe** | – | Monats-GuV 2020-09 → 2026 | KPI-Historie fürs Dashboard |

**Datenqualität:** Die *sauberen* Blätter (Dashboard, ALL TIME, Billbee-Fenster) sind gut nutzbar.
Nur die alten Roh-/Zwischenbereiche haben kaputte Formeln (`#N/A`, `#VALUE!`) und gemischte
Dezimaltrennzeichen (`3.79` vs `27,94`) – die App rechnet DB I/II sauber neu statt sie zu importieren.

### 1.4 Weitere Daten-Assets (Dropbox)
| Datei / Ordner | Inhalt |
|----------------|--------|
| `Tracking Artikelmargen Sammelkarten Top 100.xlsx` | Sauberer Top-100-Auszug des DB-Modells |
| `Entwicklung + Forecast 2021-2029.xlsx` | Jahres-GuV + Forecast (siehe §1.2) |
| `Eingangsrechnungen/Cardmarket Einkäufe/` | Monats-PDFs + Transaction Summaries (2023–2026) → EK-Quelle |
| `eBay Ausgangsrechnungen/`, `eBay/` | eBay-Belege (PDF) |

> **Kein App-Code im Repo.** Die bisherige „App" ist genau diese Excel-Mappe (Code liegt evtl. lokal
> auf dem Mac in `Dokumente/codex`). Falls dort Code existiert → in den Branch
> `claude/enterich-cards-shop-qdf6m8` pushen, dann baut Sonnet darauf auf statt neu zu bauen.

### 1.5 Kern-Datenmodell (bestätigt)
Zweistufiges **Deckungsbeitragsmodell** je Artikel & Zeitfenster (30/90/365d/AllTime):
DB I = Umsatz − EK; DB II = DB I − variable Kosten (Versand, Briefmarke Standard/Prio,
Verpackung, eBay-Shop-Gebühr). Plus Bestand (Stk), Velocity (Verkäufe/Fenster) und Rang.
Dieses Modell wird 1:1 das Datenschema der App (§5.4).

---

## 2. Was die Daten schon verraten (geprüft an `ALL TIME` + `Dashboard`)

Alle Zahlen unten sind aus den *sauberen* Blättern der Master-Mappe berechnet.

**Gesamtbild:** All-Time-Umsatz **102.022 €** über **2.863 verkaufte SKUs**.

**Top-Seller (All-Time) — Bundles waren mal stark, kippen aber gerade:**
| Artikel | Umsatz All-Time | Gew.-% | Umsatz **90d** | Umsatz **30d** |
|---------|----------------:|-------:|---------------:|---------------:|
| 250 YuGiOh Karten Sammlung (30 Holos) | 2.584 € | 48,7 % | **151 €** | 94 € |
| 100 YuGiOh Karten Sammlung (15 Seltene) | 1.416 € | 50,8 % | **22 €** | 10 € |
| DLCS-DE137 Das Siegel von Orichalcos | 1.308 € | 38,2 % | – | – |

> ⚠️ **Wichtigste methodische Erkenntnis (von Chris bestätigt):** Die **Bundles waren früher top,
> sind es aktuell aber nicht mehr.** Beispiel: „250 Karten Sammlung" 2.584 € All-Time, aber nur
> **151 € in den letzten 90 Tagen**; „100 Karten Sammlung 15 Seltene" von 1.416 € All-Time auf **22 €
> in 90d** eingebrochen. → **All-Time-Ranking täuscht. Das Dashboard muss primär nach dem aktuellen
> Zeitfenster (30/90d) bewerten und Trend (90d vs. All-Time-Run-Rate) anzeigen** – „läuft gut *jetzt*"
> statt „lief mal gut". Genau das kann die Excel heute nur mühsam, die App macht es sichtbar.

**Echte Verlustbringer im Volumen (belegt, verkaufen sich aber trotzdem):**
| Artikel | Stk | Umsatz | Gewinn-% |
|---------|----:|-------:|---------:|
| 3x YS17-DE036 Ring der Zerstörung | 25 | 103 € | **−47,0 %** |
| 3x MAGO-DE158 Dimensionsgefängnis | 53 | 294 € | **−24,2 %** |
| GFTP-DE011 Galaxieaugen Cipher X Drache | 48 | 354 € | **−13,5 %** |
| LED7-DE003 Wächterschleim | 53 | 534 € | **−7,3 %** |
| LDS2-DE030 Die Ultimative Kreatur | 89 | 508 € | **+1,8 %** |

→ Diese Artikel werden **mit Verlust bzw. Null-Marge im Volumen verkauft** – EK zu hoch und/oder
Versand-/Gebührenlast frisst die Marge. Erste KI-Kandidaten für „neu kalkulieren oder auslisten".

**Der größte Hebel — Ladenhüter / totes Kapital:**
- **922 von 1.514 Dashboard-Artikeln (≈ 61 %) haben Bestand > 0, aber 0 Verkäufe in 365 Tagen.**
- Genau hier setzt „Low-Runner rauskicken" an: Kapital, das im Regal gebunden ist und nicht dreht →
  bündeln (in Sammlungs-Lots), abpreisen oder aussortieren.

**Muster für die KI-Klassifikation:** zwei Low-Runner-Typen –
(a) **Singles mit zu hohem EK** (Einkaufsdisziplin), und
(b) **günstige Commons/Bulk**, bei denen die fixe Versand-/Gebührenlast den DB II auffrisst –
plus (c) **Ladenhüter ohne Velocity**. Für jeden Typ eine andere Handlung (§8).

---

## 3. Zielbild der App

Eine schlanke, moderne **Browser-Dashboard-App** („Enterich Cockpit"), die:

1. **Verkaufs- & Margendaten** aus eBay/Billbee + Cardmarket zentral zusammenführt (statt Excel).
2. **KPIs** live zeigt: Umsatz, DB I/II, Warenquote, Betriebsausgabenquote je Monat/Jahr –
   inkl. Vergleich gegen den Forecast 2021–2029.
3. **Sortiments-Analyse**: Top-Seller, Margen-Champions, Low-Runner, „Ladenhüter" (liegt lange,
   dreht nicht), Velocity (Verkäufe/Monat), Bestandsreichweite.
4. **Echte Marktpreise (Cardmarket)** je Artikel einblendet und mit dem eigenen VK/EK vergleicht
   (Repricing-Signale: „zu billig gelistet", „nicht mehr konkurrenzfähig").
5. **KI-Empfehlungen**: Low-Runner-Kandidaten zum Auslisten/Abverkauf, EK-Ausreißer,
   Preisanpassungen, Nachkauf-Empfehlungen für Margen-Champions.
6. **Optik** im modernen Look der Olympiade-„new-look"-Designsprache (siehe §6).

Nicht-Ziel (v1): kein Warenwirtschafts-Ersatz, keine direkte eBay-/Cardmarket-Schreibaktion
(Repricing bleibt zunächst eine Empfehlung, kein Auto-Push).

---

## 4. Architektur & Hosting

### 4.1 Tech-Entscheidung
- **Next.js (App Router) + TypeScript**, gleiche Basis wie die Oly → maximale Wiederverwendung
  von Design-Tokens, Chart-Komponenten und Deploy-Pipeline.
- **Als eigenständige App / eigener Container** (nicht als Route innerhalb der Oly), damit sie
  „nicht direkt mit der Oly verknüpft" ist. **Verzeichnis: `apps/LEC/`** (im Oly-Repo, eigenes
  Dockerfile). **Greenfield-Neubau** – die alte App war nur rudimentär und wird nicht übernommen.
- **Datenhaltung**: SQLite (wie Oly, `OLY_APP_SQLITE_PATH`-Muster) reicht völlig – kleine
  Datenmengen, Single-User. Prisma-Schema analog.

### 4.2 Hosting auf Hetzner (Sub-Link ohne Oly-Verknüpfung)
Der Server nutzt heute Caddy als Reverse-Proxy (`deploy/hetzner/Caddyfile`):
```
{$OLY_DOMAIN} { reverse_proxy oly-app:3000 }
```
**Subdomain: `LEC`** (z. B. `lec.<deine-domain>`) – URL-seitig keine Verbindung zur Oly:
```
{$LEC_DOMAIN} { reverse_proxy lec-app:3000 }
```
+ zweiter Service in `docker-compose.yml`:
```yaml
lec-app:
  build: { context: ../../apps/LEC, dockerfile: Dockerfile }
  restart: unless-stopped
  environment: { NODE_ENV: production, PORT: "3000", LEC_SQLITE_PATH: /app/data/lec.sqlite }
  volumes: [ lec-data:/app/data ]
  expose: [ "3000" ]
```
- **Zugangsschutz**: gleiches optionale Login-Muster wie Oly (`OLY_AUTH_*`) übernehmen – die
  App enthält Geschäfts-/Umsatzdaten, sollte also nicht öffentlich offen sein. Mindestens
  Basic-Auth über Caddy oder das vorhandene Phase-1-Login.
- Alternative zur Subdomain (falls kein DNS-Eintrag gewünscht): Pfad `…/cockpit` mit
  `handle_path`. Subdomain ist aber sauberer und besser für „nicht verknüpft".

---

## 5. Daten-Ingestion (das Fundament – zuerst bauen)

Die App darf **nicht** auf der kaputten Excel-Mappe aufsetzen. Stattdessen definierte Importe:

### 5.1 Der reale Datenfluss (bestätigt von Chris)
1. Einkauf bei **Cardmarket** → **EK-Preise werden in Billbee gepflegt** (`CostPrice gross`).
2. **Billbee-Exporte** liefern Verkaufszahlen + EK je Artikel – als Zeitfenster **30d / 90d / 365d**.
3. **eBay-Export** liefert die **Gebühren** (Provisionen, Anzeigen, Versandetikett), die je Artikel
   **zugeordnet** werden müssen.

### 5.2 Wiederkehrender Import-Workflow (Kernanforderung)
Chris will **regelmäßig die Billbee-Dateien (30d/90d/365d) hochladen/schicken**, die App soll sie
verarbeiten und mit den eBay-Daten **matchen**. Wichtig: **Der Artikelname ist in Billbee und eBay
identisch** → **Name = primärer Match-Schlüssel** (genau das macht heute das Blatt `Artikelabgleich`).

Konkreter Flow in der App:
- **Upload-Seite**: drei Billbee-Fenster-Dateien (30/90/365d) + eBay-Export (365d) reinziehen.
- **Matching** über den **normalisierten Artikelnamen** (trim, Mehrfach-Leerzeichen, Groß/Klein,
  Präfix `3x`/`2x` separat als Menge erfassen). **Set-Code** (`[A-Z0-9]{2,5}-(DE|EN)[A-Z]?\d{2,3}`)
  als **sekundärer** Schlüssel/Tiebreaker und zur Dublettenerkennung.
- **Ungematchte Zeilen** landen in einer Review-Liste (manuell zuordnen, Zuordnung wird gemerkt →
  persistente Alias-Tabelle, damit derselbe Name künftig automatisch matcht).
- Nach dem Import: DB I/II + Velocity + Ränge **serverseitig neu berechnen** und Fenster-Snapshots
  (30/90/365d) speichern → Trendvergleich über die Zeit.

> Damit funktioniert genau das, was du willst: „Billbee-Dateien schicken → verarbeiten → matchen".
> Der gleiche Importer läuft (a) in der Web-App und (b) als CLI/Skript, das ich (Claude) direkt auf
> geschickte Dateien anwenden kann.

### 5.3 Weitere Quellen & Normalisierung
- **Cardmarket-Einkäufe** – aus `Transaction Summary`-CSV → EK-Gegencheck + Einkaufsversand
  (ergänzend; primär kommt EK aus Billbee).
- **Alt-Bestand** – einmaliger Migrations-Importer aus den sauberen Blättern der Master-Mappe
  (`ALL TIME`, `Dashboard`, `eBay Verkäufe` = Monats-GuV) für die Historie.
- **Zahlen-Parser** für gemischte Dezimaltrennzeichen (`3.79`, `27,94`, `- 0 €`, `1.234,56 €`).
- **Kostensätze konfigurierbar** (Briefmarke Standard/Prio, Verpackung, eBay-Shop-%-Satz,
  Billbee/Lexoffice/Kontist-Fixkosten) in `cost_settings` – exakt die Positionen aus
  `VK Preis Kalkulator`.

### 5.4 Datenschema (Vorschlag)
- `article` (set_code, **name_normalized (Match-Key)**, name_raw, rarity, condition, edition, stock)
- `article_alias` (name_variant → article_id) – gelernte manuelle Zuordnungen
- `sale_window` (article_id, window=30/90/365d/all, snapshot_date, qty, revenue, avg_price, rank)
- `sale` (article_id, date, qty, gross_price, ebay_fee_total, shipping_type, order_ref) – falls
  eBay je Bestellung vorliegt
- `purchase` (article_id, date, qty, unit_ek, buy_shipping, source=Cardmarket|Billbee)
- `market_price` (article_id, source, price_trend, price_low, price_avg, fetched_at)
- `cost_settings` (versioniert)
- Abgeleitet: `article_margin` (DB I/II €+%, Velocity, Bestandsreichweite, Klassifikation)

---

## 6. Feature-Backlog (priorisiert)

### Muss (v1 – „Cockpit")
- **F1 Dashboard „läuft gut / läuft schlecht"**: oben KPI-Tiles (Umsatz, DB I/II, Warenquote,
  BA-Quote je Fenster + Forecast-Vergleich, Zielquoten-Ampel Warenquote ≤43 % / BA-Quote ≤40 %).
  Darunter zwei Kacheln: **„Läuft gerade gut"** (hohe 30/90d-Velocity × gute Marge) und
  **„Läuft schlecht / fällt ab"** (eingebrochene Velocity, negative Marge, Ladenhüter).
- **F2 Artikel-Tabelle mit „zu teuer / zu günstig"-Ampel**: sortier-/filterbar nach Fenster-Velocity,
  Momentum, DB II %/€, EK-Anteil, Bestandsreichweite; je Artikel Sparkline (Verkäufe/Fenster) **und
  Preis-Ampel aus §7.4** (eigener VK vs. MIN/GUT vs. Cardmarket) + empfohlener VK-Korridor.
- **F3 Top-/Flop-Ranglisten**: Top-Seller, Margen-Champions, Low-Runner, Ladenhüter.
- **F4 Import & Matching** (Kernstück): Upload der Billbee-Fenster (30/90/365d) + eBay-Export,
  **automatisches Matching über den Artikelnamen** (Billbee = eBay), Review-Liste für Ungematchtes,
  gelernte Aliasse, Fenster-Snapshots für Trendvergleich (§5.2). Inkl. einmaliger Alt-Migration.

### Soll (v1.5 – Marktpreise & KI)
- **F5 Cardmarket-Preise** je Artikel (siehe §7) + Vergleich VK/EK gegen Markt-Trend/Tiefpreis;
  Repricing-Signale.
- **F6 KI-Low-Runner-Klassifikation** (siehe §8): Auslisten / Abverkauf / halten / nachkaufen.
- **F7 Was-wäre-wenn**: „Wenn ich Artikel X 0,50 € teurer liste, DB II von … auf …".

### Kann (v2)
- Automatischer Cardmarket-Preis-Refresh (Cron), Preis-Historie/Trend-Charts.
- Nachkauf-/Bestell-Empfehlungen (Margen-Champions mit niedrigem Bestand).
- Export der Empfehlungen als To-do-Liste.

---

## 7. Preis-Engine (Cardmarket-Check + VK-Kalkulation)

Das Herzstück, damit das Dashboard „zu teuer / zu günstig" beantworten kann. Drei Teile:
(7.1) Cardmarket-Preis holen → (7.2) EK ableiten → (7.3) MIN/optimalen VK berechnen → mit dem
tatsächlichen VK vergleichen.

### 7.1 Cardmarket-Preisbeschaffung

**Harte Regel: nur DEUTSCHE Karten.** Chris kauft/kalkuliert ausschließlich deutsche Karten;
englische kommen selten vor und werden nicht nachgekauft → irrelevant. In der Cardmarket-URL heißt
das `language=3` (Deutsch) und `sellerCountry=7` (Deutschland). Beispiel (BROL Red-Eyes Fusion):
`…/Singles/Brothers-of-Legend/Red-Eyes-Fusion?sellerCountry=7&language=3&minCondition=2&amount=2`

Zu lesende Felder (aus der Produktseite):
`Verfügbare Artikel · ab (günstigstes Angebot) · Preis-Trend · 30-/7-/1-Tages-Durchschnitt`
plus die **Angebotsliste** (Preis × verfügbare Menge je Verkäufer, DE/NM gefiltert).

Bezugs-Optionen:
| Option | Beschreibung | Bewertung |
|--------|--------------|-----------|
| **B – Manueller/halbautomatischer Abgleich** | Chris liefert die Cardmarket-Preisdaten (Produkt-URL bzw. kopierte Preisfelder / Preisliste), App verarbeitet & rechnet. | **Der Weg für v1** – Chris hat **keine API**. Passt zum „schick-mir-die-Daten"-Workflow. |
| **A – Offizielle MKM-API** | OAuth-1.0a-API für gewerbliche Verkäufer, liefert Preis-Guide automatisch. | Später, **nur falls Chris den Zugang doch bekommt** (aktuell nicht vorhanden). |
| **C – Scraping** | HTML parsen. | **Nicht empfohlen** (ToS-Verstoß, Cloudflare). |

Empfehlung: austauschbarer `MarketPriceProvider` (Interface: `getPrice(setCode, lang=DE) →
{available, from, trend, avg30, avg7, avg1, offers[]}`). **v1 = Provider B** (manuelle/übergebene
Preisdaten). Damit ist die Preis-Engine sofort nutzbar; ein API-Provider ließe sich später ohne
UI-Änderung hinter dasselbe Interface hängen.

### 7.2 EK-Ableitung aus Cardmarket (verfügbarkeitsabhängig)

Chris' Logik: **EK = günstigster verfügbarer DE-Preis, bei dem genug Stück verfügbar sind,
× Pack-Multiplikator.** Beispiel 3er-Pack: unterster Preis 0,59 € und davon „noch einige verfügbar"
→ EK = 0,59 € × 3 = **1,80 €**.

Als Regel für die App: von den DE/NM-Angeboten aufsteigend die günstigsten aufsummieren, bis die
benötigte Menge (Pack-Größe, ggf. × Sicherheitsfaktor) gedeckt ist → gewichteter Roh-EK je Karte;
× Pack-Größe = Pack-EK. `amount`-Parameter der URL entspricht genau dieser „genug verfügbar"-Idee.
(Das Blatt `EK Calc` macht heute die gewichtete Mischkalkulation `Σ(Anzahl×Preis)/ΣAnzahl` manuell.)

> **Wichtig (von Chris):** Der Cardmarket-Preis ist nur der **Waren-Rohpreis**. **Einkaufs-Versand
> muss obendrauf** – hinterlegt in `cost_settings` (heute: <5 Stk → 1,15/Menge, sonst 1,30/Menge;
> beim Pack 1,30/Menge×3). Der so ermittelte EK inkl. Einkaufs-Versand geht dann in den HK-Aufbau
> (§7.3). Und der **VK trägt die eBay-Gebühren-%** (Provision + Anzeigen, §7.3) – beide dürfen in der
> Kalkulation nie fehlen.

### 7.3 VK-Kalkulation – Chris' exakte Formeln (aus `VK Preis Kalkulator`)

**Selbstkosten HK** (pro Verkaufseinheit, ohne eBay-Verkaufsgebühr):
```
HK = EK
   + Einkauf-Versand   (Einzel: <5 Stk → 1,15/Menge, sonst 1,30/Menge; Pack: 1,30/Menge×3)
   + Versand (Brief)   (Einzel ≈ 0,67 ; Pack ≈ 0,50 – netto Portoanteil, konfigurierbar)
   + Prio/Einschreiben (Einzel 0,15 ; Pack 0,1875)
   + Verpackung        (≈ 52,95 €/1000 = 0,053 ; Pack 61,95 €/1000 = 0,062)
   + Fixkosten-Anteil  ((95+25+60) €/Jahr ÷ verkaufte Stück 365d = eBay-Shop/Billbee/Lexoffice)
```
**eBay-Verkaufsgebühren** (auf einen VK-Preis):
```
eBay-Provision  = 0,35 € + VK × 11 % × 1,19        (11 % Provision inkl. 19 % USt)
Anzeigen-Gebühr = VK × 9–10 % × 1,19               (Ads; Einzel akt. 9 %, min/gut 10 %)
VK-Kosten       = eBay-Provision + Anzeigen-Gebühr
```
**Preis-Stufen** (Basis = HK + VK-Kosten des aktuellen VK):
```
VK-Preis MIN  = (HK + VK-Kosten) × 1,33   → ergibt ≈ 25 % Gewinnmarge   ← der geforderte „MIN VK (25 %)"
VK-Preis GUT  = (HK + VK-Kosten) × 1,66   → ergibt ≈ 35 % Gewinnmarge   ← „optimaler VK"
Gewinn        = VK − VK-Kosten − HK
Gewinnmarge   = Gewinn / VK
```

### 7.4 „Zu teuer / zu günstig"-Signal fürs Dashboard
Pro Artikel vergleicht die App:
- **eigener VK** vs. **VK-MIN** und **VK-GUT** (aus 7.3) → *unter MIN = zu günstig / Verlustrisiko*.
- **eigener VK** vs. **Cardmarket** (from / Trend / 30-Tage-Ø) → *deutlich über Markt = zu teuer /
  dreht nicht; deutlich unter Markt = Marge verschenkt*.
- **aktueller EK** vs. **Cardmarket-EK (7.2)** → *EK zu hoch → Nachkauf-/Auslist-Signal*.

Ergebnis: Ampel je Artikel (grün/gelb/rot) + empfohlener VK-Korridor [MIN … GUT], gedeckelt/geführt
vom Marktpreis.

> Aktion an dich (Chris): MKM-API-Zugang beantragen (gewerbl. Account → „App-Zugang/API"). Bis dahin
> läuft v1 über den halbautomatischen Abgleich (Provider B).

---

## 8. KI-Komponente (Low-Runner rauskicken)

Zwei Stufen, damit es erklärbar bleibt:

1. **Regelbasiertes Scoring (deterministisch, zuerst):** je Artikel ein Score aus
   Velocity (Verkäufe/Monat), **Momentum/Trend (90d-Run-Rate vs. 365d/All-Time – steigend/fallend)**,
   DB II %, DB II € absolut, Bestandsreichweite (Monate bis ausverkauft bei aktueller Velocity),
   EK-Anteil am VK, Markt-Konkurrenzfähigkeit.
   Klassen: **Champion** (skalieren) · **Solide** · **Beobachten** · **Fällt ab** (früher gut, jetzt
   schwach – wie die Bundles) · **Low-Runner (auslisten)** · **Ladenhüter (abverkaufen/bundle)**.
2. **LLM-Layer darüber (Claude):** nimmt die Kennzahlen + Marktkontext und schreibt je
   Kandidat eine **kurze Begründung + Handlungsempfehlung** in Klartext („EK 3,40 € zu hoch
   relativ zum Markt-Tiefpreis 3,10 €, DB II nur 4,4 % – auslisten oder EK-Ziel < 2,20 €").
   So bleibt die Zahl die Wahrheit, die KI nur die Erklärung/Priorisierung.

Bundle-Idee als eigene Empfehlung: schwache Commons/Ladenhüter zu Sammlungs-Lots bündeln, um totes
Kapital abzubauen. **Aber:** die alten Bundle-Renner sind aktuell eingebrochen (§2) – Bundles also
nur als Abverkaufskanal für Ladenhüter behandeln, nicht als Wachstumswette. Die App soll überwachen,
ob neu geschnürte Lots aktuell tatsächlich noch drehen (30/90d-Velocity), bevor nachgelegt wird.

---

## 9. Optik / Modernisierung

- Design-Sprache der Oly-**„new-look"**-Komponenten übernehmen
  (`components/foundation/new-look/`, `app/foundation/*NewLook*`, `docs/design/`):
  gleiche Farb-Tokens, Card-/Panel-Stil, Typo, Radar/Chart-Look.
- Für Charts/KPIs die **`dataviz`-Skill**-Prinzipien nutzen (konsistente, barrierefreie Palette,
  Light/Dark). Kein zusätzliches Schwergewicht-Charting nötig – SVG/Recharts o. Ä. reicht.
- Layout: Sidebar-Navigation (Dashboard · Sortiment · Top/Flop · Marktpreise · Empfehlungen ·
  Import · Einstellungen), Stat-Tiles-Reihe oben, responsive (Desktop-first, mobil nutzbar).
- Dark-Mode als Default, passend zur „Lord Enterich"-Marke (Logo/Profilbild in Dropbox vorhanden).

---

## 10. Roadmap – konkrete Arbeitspakete für Sonnet

**Phase 0 – Setup**
- [ ] App-Gerüst `apps/LEC/` (Next.js + TS + Prisma/SQLite), Dockerfile, `.env.example` (greenfield).
- [ ] Caddy-/compose-Eintrag für Subdomain `LEC` (§4.2) vorbereiten (noch nicht live schalten).

**Phase 1 – Datenfundament**
- [ ] Prisma-Schema nach §5.4.
- [ ] Robuster Zahlen-/Währungs-Parser + Set-Code-Extraktor + **Namens-Normalisierer** (mit Tests).
- [ ] **Matching-Engine Billbee ↔ eBay über den Artikelnamen** + Alias-Lernen + Review-Liste (§5.2).
- [ ] Importer für Billbee-Fenster (30/90/365d) + eBay-Export; DB I/II & Velocity serverseitig neu
      berechnen; Fenster-Snapshots speichern.
- [ ] Migrations-Importer für die sauberen Blätter aus `Yu Gi Oh Verkäufe.xlsx`
      (`ALL TIME`, `Dashboard`, `eBay Verkäufe`-Monats-GuV).
- [ ] Kosten-Einstellungen (`cost_settings`) konfigurierbar (aus `VK Preis Kalkulator`).

**Phase 2 – Cockpit-UI (v1)**
- [ ] Dashboard (F1) inkl. Forecast-Vergleich + Zielquoten-Ampel.
- [ ] Artikel-Tabelle (F2) mit Sortier/Filter + Sparklines.
- [ ] Top/Flop-Ranglisten (F3).
- [ ] new-look-Design-Tokens einbinden (§9).

**Phase 3 – Marktpreise & KI (v1.5)**
- [ ] `MarketPriceProvider`-Interface + CSV-Provider (F5).
- [ ] Regelbasiertes Klassifikations-Scoring (§8, Stufe 1) + Tests.
- [ ] LLM-Empfehlungs-Layer (§8, Stufe 2) hinter Feature-Flag.
- [ ] Repricing-Signale + Was-wäre-wenn (F7).

**Phase 4 – Deploy & Härtung**
- [ ] MKM-API-Provider (sobald Keys da).
- [ ] Login/Zugangsschutz aktivieren.
- [ ] Auf Hetzner unter der neuen Subdomain live schalten.

---

## 11. Entscheidungen (mit Chris geklärt)

- ✅ **Greenfield-Neubau** unter `apps/LEC/` (die alte App war nur rudimentär, wird nicht übernommen).
- ✅ **Eigene Subdomain `LEC`** (`lec.<domain>`) – URL-seitig getrennt von der Oly, gleicher Server.
- ✅ **Im Oly-Repo** (`apps/LEC/`), eigener Container – teilt Deploy-Infra, bleibt aber getrennt.
- ✅ **Cardmarket: keine API vorhanden** → v1 über Provider B (übergebene Preisdaten, §7.1).
- ✅ **Leitquelle** = Billbee-Exporte (30/90/365d) + eBay-Gebühren, **Matching über Artikelname**
  (in den Beispieldateien 98 % exakt, §12).
- ✅ **Privatverkäufe** (Nicht-Karten wie Elektronik/Schmuck über denselben Shop-Account) werden aus
  der Karten-Analytics **ausgefiltert** – über Billbee-Match/Set-Code, nicht über eBay-Kategorie (§12).

---

## 12. Rohdaten-Referenz (aus echten Beispiel-Exporten)

Chris liefert diese Dateien; die App muss genau diese Formate parsen. (Andere Zeiträume analog –
Chris kann 30/90/365d-Varianten ergänzen.)

### 12.1 Billbee „Verkäufe nach Artikel" (`salesbyarticle.xlsx`)
- **Vorspann** Zeilen 0–6: Titel, `Gedruckt am`, **`Zeitraum: 15.06.2026 - 15.07.2026`** (← das
  Fenster steckt hier drin, daraus 30/90/365d ableiten!), `Preise: Brutto`.
- **Header in Zeile 7:** `SKU · Artikel · (leer) · (leer) · USt. Index · (leer) · Anzahl · Summe · EK · (leer) · Marge`
- **Datenzeilen ab 8:** `Artikel` (Kartenname, Spalte 1) · `Anzahl` (verkauft) · `Summe` (Umsatz brutto)
  · `EK` (Einkaufswert) · `Marge` (= Summe − EK). SKU meist leer.
- Beispiel: `Yu-Gi-Oh! RA04-… | Anzahl 3 | Summe 89,97 € | EK 25,50 € | Marge 64,47 €`.
- **Das ist die linke Seite des DB-Modells** (bis DB I); variable Kosten (Versand/Gebühren) kommen aus
  eBay + `cost_settings`. **Menge-Präfix `3x`** im Namen = Pack-Größe separat erfassen.

### 12.2 eBay „Listings Sales Report" (`eBay…Report….csv`)
- **Vorspann** Zeilen 0–10: Ausschlussklauseln + **`Bericht vom 1. Jan 2026 bis 15. Jul 2026`** +
  Hinweis auf **Abonnementgebühren** (hier 665,98 €, kontobasiert – NICHT je Artikel; als Fixkosten
  behandeln).
- **Header in Zeile 11 (27 Spalten):** `Angebotstitel · eBay-Artikelnummer · Shop-Kategorie L1 · L2 ·
  Verkaufte Stückzahl · Gesamtumsatz (inkl. Steuern) · Umsatz ohne Versand · gezahlte Versandkosten ·
  Verkaufskosten gesamt · Angebotsgebühren · Optionale Gebühren · **Verkaufsprovisionen** · Gebühren
  Basis-/Premium-/Express-/externe **Anzeigen** · Internationale Gebühren · Sonstige · … ·
  Gebührengutschriften · Kosten Versandetiketten · Umsatz nach Kosten · Ø Verkaufspreis · …`
- **Das ist die Gebühren-Seite** je Angebot → liefert die variablen eBay-Kosten für DB II.

### 12.3 Matching & Filter (verifiziert an den Beispieldateien)
- **Join-Schlüssel = Artikelname** (`Billbee.Artikel` == `eBay.Angebotstitel`), normalisiert
  (trim, Mehrfach-Leerzeichen, Groß/Klein). In den Beispielen: **167/171 = 98 % exakt** gematcht;
  die 4 Reste (z. B. „Mystery Pack", 3 Singles) → Review-Liste.
- **Set-Code als Zweitschlüssel:** 162/171 Billbee-Artikel tragen einen Set-Code im Namen.
- **Privatverkäufe ausfiltern:** eBay-`Shop-Kategorie` ist unbrauchbar (≈ 80 % der Karten stehen unter
  „Sonstiges"). Stattdessen als Karte gilt nur, was einen Set-Code/Yu-Gi-Oh-Marker trägt **oder** in
  Billbee als Artikel existiert. Nicht-Karten (Elektronik, Schmuck, Münzen – Chris' gelegentliche
  Privatverkäufe, in der Stichprobe 16 Stück) fallen damit automatisch raus.
- **eBay-Abonnementgebühr** (kontobasiert, ~666 €/Zeitraum) ist keine Artikelgebühr → als Fixkosten
  in die Betriebsausgaben, nicht je Artikel verteilen.
