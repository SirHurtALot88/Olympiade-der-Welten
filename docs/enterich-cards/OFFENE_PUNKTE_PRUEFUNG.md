# LEC: Offene Punkte nach Paket A–D (Prüfung 14.11.2026)

Bewertung der offenen Punkte nach Paket A bis D (#1458 bis #1461 auf `main`). Das ist nur Doku, es gibt keinen Code dazu.
Grundlage sind `KENNZAHLEN_RECHERCHE.md` (Abschnitt „Entscheidungen 14.11.“) und der Code-Stand von `origin/main`.
Aufwand: S = unter einem halben Tag, M = etwa ein Tag, L = mehr. Priorität: 1 = als Nächstes, 2 = danach, 3 = nur wenn Zeit bleibt.

| # | Punkt | Entscheidung | Prio | Aufw. |
|---|---|---|---|---|
| 1 | Filterleiste und „Auswertung“ | umsetzen, aber verkleinert | 3 | S |
| 2 | Reichweite und GMROI auf Finanzen | umsetzen | 1 | S |
| 3 | Stand-Zeile in der Seitenleiste | umsetzen | 1 | S |
| 4 | Handy-Layout für Sortiment und Drawer | umsetzen, erst den Drawer | 2 | M |
| 5 | Alte Komponenten löschen | umsetzen, ohne Frist (Umleitungen bleiben) | 2 | S |
| 6 | Verkaufspreis gegen Marktwert je Preisband | warten bis etwa 15.12.2026 | 2 | S |
| 7 | Status „Abverkauf“ ohne EK | verwerfen | – | – |
| 8 | Drawer-Ideen | Preis-/Marktlinie umsetzen, Rest verwerfen | 2 / – | S–M |
| 9 | Nie verkauft und ohne eBay-ID: Alter unbekannt | umsetzen | 2 | S |
| 10 | Echte Marge je Bestellung | warten auf das Order-JSON von Chris | 1 sobald da | M |

**Empfohlene Reihenfolge:** 3 → 2 → 5 → 9 → 4 (Drawer) → 8 (Preis-/Marktlinie) → 6 (ab Mitte Dezember) → 10 (sobald das JSON da ist) → 1.

---

## 1. Filterleiste (vier Menüs, „Aktiv“-Zeile, „Auswertung“)

**Umsetzen, aber verkleinert.** Die Aufgaben-Reiter decken die Arbeitslisten ab. Die Filter braucht Chris nur noch zum Finden im Regal und zum Eingrenzen.
- Behalten werden die Suche sowie Ordner, Kartenart und Preisband. Der Ordner entspricht dem physischen Fach, in dem die Karte liegt. Alle übrigen Menüs, die eine Arbeitsliste wiederholen, entfallen.
- Die „Aktiv“-Zeile erscheint nur, wenn mindestens ein Filter gesetzt ist.
- „Auswertung“ wandert vom Sortiment auf Finanzen: `KapitalPanel` (Kapital je Ordner, Kartenart oder Preisband) und `PreisUeberblick`. Das Sortiment bleibt eine Arbeitsseite.

## 2. Reichweite und GMROI als Shop-Summen (Finanzen)

**Umsetzen.**
- Kapital = Σ `Article.stock` × `Article.currentEk` über Artikel mit `active` und nicht `hidden`, mit `stock` > 0 und `currentEk` > 0.
- Wareneinsatz 365 = Σ `SaleWindow[window="365"].ek` über alle Artikel mit bekanntem EK, auch über ausverkaufte. Ausgeschlossen sind Fenster mit `qty` > 0 und `ek` = 0, denn das sind Verkäufe ohne EK.
- Reichweite (Monate) = Kapital ÷ (Wareneinsatz 365 ÷ 12), angezeigt mit einer Nachkommastelle.
- GMROI = Σ `SaleWindow[365].dbI` (gleiche Artikelauswahl wie beim Wareneinsatz) ÷ Kapital. Anzeige: „x,xx € Rohertrag je € Lager (365 T)“.
- Darunter steht immer eine Zeile: „ohne EK: N Artikel mit Bestand, M Stück, Umsatzanteil 365 T P %“. Dazu der Hinweis „Kapital am Stichtag, nicht Ø-Bestand“.
- Keine Ampel und kein Zielwert: Für Einzelkarten-Händler gibt es keinen belastbaren Vergleichswert. Gezeigt wird nur der Verlauf, sobald es Monatswerte gibt.
- Risiko: Fehlen die EK-Angaben stark, sieht GMROI besser aus, als er ist. Deshalb muss die Lücken-Zeile Pflicht sein.

## 3. Stand-Zeile in der Seitenleiste

**Umsetzen.** Ein veralteter Stand sieht aus wie ein gültiger; das ist dieselbe Lehre wie bei den Spiegeln der Olympiade.
- Die Zeile enthält: letzter Billbee-Abgleich, letzter eBay-Shop-Abruf, letzter Cardmarket-Abruf und die Marktwert-Abdeckung. Abdeckung = aktive Artikel mit Bestand und eindeutigem Marktwert ÷ aktive Artikel mit Bestand, in Prozent.
- Gelb wird ein Eintrag bei Billbee oder eBay ab 2 Tagen, bei Cardmarket ab 7 Tagen. Rot doppelt so lange.
- Quellen sind `ImportBatch.createdAt` und die Zeitstempel der Syncs (`MarketPrice.fetchedAt`, `Article.ebayPriceAt`).

## 4. Restliches Handy-Layout

**Umsetzen, erst den Drawer.** Am Handy braucht Chris vor allem den Drawer: Karte nachschlagen, Preis prüfen, vormerken.
- Drawer: eine Spalte, die Entscheidungszeile oben fest, Gruppen zugeklappt.
- Tabelle: unter 640 px eine Kartenliste mit Name, Bestand, Dein VK, Urteil und Aktion statt 20 Spalten. Das ist der zweite Schritt.
- Ein zweispaltiger Drawer (siehe 8) kommt nur am Desktop, und erst danach.

## 5. Alte Komponenten löschen

**Umsetzen, ohne Sicherheitsfrist für den Code.** Die Git-Historie bewahrt alles auf. Eine Frist braucht nur die URL: die Umleitungen `/top-flop`, `/marktpreise` und `/empfehlungen` bleiben etwa drei Monate stehen, wegen Lesezeichen.

Löschbar sind laut `git grep` auf `main`, weil sie nur noch untereinander verwendet werden:
- `components/topflop/*`
- `lib/dashboard/topFlop.ts` samt Test
- `components/marktpreise/*`
- `components/empfehlungen/*`
- `components/dashboard/Recommendations.tsx`. `RECOMMENDATION_CHIPS` wird nur von ihr und von `EmpfehlungenPage` genutzt.
- `components/dashboard/CardmarketPlaceholder.tsx`
- `MoversPanels.tsx` und `dashboard/KpiRow.tsx`, falls `DashboardShell` sie nicht mehr einbindet. Vor dem Löschen prüfen.

**Nicht löschen:**
- `lib/dashboard/marketComparison.ts`: Den nutzen `lib/cockpit/marketHints.ts`, `cockpit/queries.ts`, `cockpit/viewModel.ts`, `dashboard/queries.ts` und `dashboard/viewModel.ts`.
- `buildRecommendations` in `viewModel.ts`, solange „Muss weg“ oder „Daten prüfen“ daraus lesen. Sonst nur die nicht mehr genutzten Arten entfernen.
- `OperatingQuotas`, solange `DashboardShell` sie einbindet. Fachlich war die Streichung entschieden (Recherche 3.1).

## 6. Verkaufspreis gegen Marktwert je Preisband

**Warten, ab etwa 15.12.2026.** `MarketPriceHistory` läuft erst seit 13.11.2026. `saleVsMarket` braucht für jeden Verkauf einen Marktstand aus den 14 Tagen davor. Bei rund 2.850 Stück im Jahr sind das etwa 220 Stück in vier Wochen, und nur ein Teil hat einen eindeutigen Marktwert.

Spezifikation für später:
- Bänder nach Marktwert: bis 2 €, 2–5, 5–20, 20–50 und ab 50 €.
- Je Band: n, das 25., 50. und 75. Perzentil von `unitPrice ÷ Marktwert(Ø 7, sonst Trend)` und „Euro unter Markt gesamt“ (`leftOnTable`).
- Ein Band wird nur gezeigt, wenn n ≥ 20 ist. Sonst steht dort „noch zu wenig Verkäufe“.
- Platz: Finanzen, neben Reichweite und GMROI.

## 7. Status „Abverkauf“ für Artikel ohne EK

**Verwerfen.** Ohne EK sind weder Marge noch Untergrenze bekannt. Ein eigener Status würde die Lücke zudecken statt sie zu schließen.
- Stattdessen bleiben die Artikel in „Daten prüfen“ (EK fehlt).
- Lässt sich der EK nicht mehr feststellen, gilt der Marktwert am Tag der Prüfung als Ersatz-EK, mit dem Kennzeichen „EK geschätzt“.
- Für das Alter brauchen diese Artikel keinen Status: die Altersgruppen (Muss weg) erfassen sie schon über „ohne EK“.

## 8. Drawer-Ideen

- **Preis- und Marktlinie: umsetzen** (Prio 2, S–M). Eine Achse in Euro: eigener VK als Stufenlinie aus `PriceChange`, Marktwert als Linie aus `MarketPriceHistory` (Ø 7, sonst Trend), Verkäufe als Punkte aus `Sale`. Zeitraum 180 Tage. Ohne Verlauf wird sie nicht gezeichnet, dann gibt es keine leere Grafik. Richtig nützlich wird sie erst ab Mitte Dezember.
- **Warenkorb und Mitkäufe über `orderRef`: verwerfen.** Bei 1,5 Artikeln je Bestellung und meist 0 bis 2 Verkäufen je Karte entstehen keine belastbaren Muster.
- **Zweispaltiges Layout:** nur am Desktop und erst nach Punkt 4. Prio 3.
- **Land und Versandart: verwerfen.** `Sale` hat diese Felder nicht, und die Quelle in der Billbee-Bestellung ist nicht belegt. Frühestens zusammen mit Punkt 10.

## 9. Nie verkauft und ohne eBay-ID: Alter unbekannt

**Umsetzen.**
- Fehlt die Schätzung aus der eBay-Nummer, gilt als Alter die Zahl der Tage seit `Article.createdAt`. Das ist der erste LEC-Import, also ein Mindestalter.
- Der Artikel kommt damit in die passende Altersgruppe und trägt das Kennzeichen „Mindestalter“.
- Nur wenn auch das fehlt, bleibt er in „ohne Alter“.
- Risiko: Wegen des Mindestalters landen alte Ladenhüter eine Zeit lang in zu jungen Gruppen. Das unterschätzt das Problem, erfindet aber nichts.

## 10. Echte Marge je Bestellung

**Warten.** Es fehlt das JSON einer echten Billbee-Bestellung, ohne Kundendaten. Die Route `api/billbee/order` („Bestellung prüfen“) liefert es; nur Chris kann sie auslösen. Danach gilt Prio 1, Aufwand M.

Formel: Marge der Bestellung = Σ Positionen (Stückpreis × Menge) − Σ EK − tatsächliche eBay-Gebühren − tatsächliches Porto, sofern in der Bestellung vorhanden − Verpackungspauschale. Danach ersetzt der echte Wert die Pauschalen in DB II, sobald es mindestens 200 Bestellungen mit Werten gibt. Das ist dieselbe Schwelle wie `MIN_ORDERS_FOR_MEASURE`.

## Umsetzungsstand 14.11. (Paket E)

- Punkt 3 Stand-Zeile: umgesetzt (`/api/stand`, `lib/dashboard/stand.ts`, Seitenleiste).
- Punkt 2 Reichweite/GMROI: umgesetzt (`lib/cockpit/capital.ts`, `CapitalCard`), mit Lücken-Hinweis, ohne Ampel.
- Punkt 5 Alte Komponenten: gelöscht (topflop, marktpreise, empfehlungen, Recommendations, CardmarketPlaceholder, MoversPanels, topFlop.ts). Die drei Umleitungsseiten bleiben.
- Punkt 9 Alter unbekannt: Rückfall auf Tage seit erster Erfassung (`Article.createdAt`) in `queries.ts`. Unterschätzt alte Ladenhüter, solange die DB jung ist.
- Punkt 7 verworfen; Punkt 8 Mitkäufe und Land/Versandart verworfen.
- Offen: 4 Handy (Drawer zuerst), 8 Preis-/Marktlinie, 6 ab 15.12., 10 wartet auf Order-JSON, 1 Filterleiste verkleinert.
