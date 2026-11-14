# LEC: To-do (Stand 13.11.)

Von Chris am 13.11. zur Umsetzung am 14.11. freigegeben (Budget). Reihenfolge wie unten.

## A. Aus vorhandenen Daten (kein neuer Zugang nötig)

1. **Kapitalbindung und Umschlag:** Bestand × EK je Artikel, Ordner und Kartenart; Umschlagsdauer. Sichtbar machen, wie viel Geld in Ladenhütern steckt.
2. **Verkaufspreis gegen Marktwert zum Verkaufszeitpunkt:** aus `MarketPriceHistory` (gesammelt erst ab dem ersten Cardmarket-Sync nach dem Deploy von #1432). Zeigt zu billig verkaufte Karten und liegen gebliebene Marge.
3. **Wirkung einer Preisänderung:** `PriceChange` und `Sale` vorher/nachher in gleich langen Fenstern; Preisänderung ab 10 % setzt die Preis-Uhr zurück. Speist Auslisten- und Preisregeln.
4. **Tage bis zum ersten Verkauf:** genauer als die Schätzung aus der eBay-Artikelnummer (`listedAge.ts`), sobald „zuerst gesehen“ je Artikel gespeichert ist.

## B. Billbee trackt es nicht, wir erfassen es selbst

5. **Tage ohne Bestand:** täglicher Bestandsstand je Artikel (`StockMovement` nutzen oder täglichen Schnappschuss anlegen); Tempo nur über Tage mit Bestand rechnen; Grundlage der Nachbestell-Liste.
6. **Retouren, Reklamationen, Schwund:** eigene Erfassung (beschädigt, verloren, zurück); fließt in die Marge ein.
7. **Tatsächliche Marge je Bestellung:** echte Versandkosten und eBay-Gebühren aus der Billbee-Bestellung statt Pauschalen.

## C. Später, braucht Zugang von Chris

- eBay-Aufrufe und Beobachter je Angebot (eBay-API oder Seller-Hub-Export).
- Konkurrenzpreise bei eBay und Angebotsmenge bei Cardmarket.

## D. Weitere offene Entscheidungen

- Status „Abverkauf“ für Artikel ohne EK (ab 90 Tagen stärkerer Abschlag, höchstens 50 %, nie unter Marktwert): Chris hat noch nicht geantwortet.
- Auslisten-Button auch in der Listenzeile oder umbenennen: Chris hat noch nicht geantwortet.
- Obergrenze von etwa 50 Kandidaten für Auslisten ist noch nicht gebaut.
