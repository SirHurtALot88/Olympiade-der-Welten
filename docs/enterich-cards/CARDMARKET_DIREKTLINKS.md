# Cardmarket-Direktlinks auf die richtige Seltenheit (Chris, 22.11.2026)

**Problem:** Der Link im Drawer war eine Suche nach dem Set-Code. Cardmarket führt jede Seltenheit als eigenes Produkt mit gleichem Namen; die Suche landete auf der Trefferliste oder der falschen Version (Ultra Rare gewollt, Super Rare geöffnet).

**Adressmuster** (aus Chris' Beispielen, RA02 Ghost Ogre & Snow Rabbit):

    /de/YuGiOh/Products/Singles/<Expansion>/<Name>-V<n>-<Seltenheit>?sellerCountry=7&language=3&minCondition=2&amount=<n>

Super Rare = V1, Ultra Rare = V2 usw. Die Versionsnummer zählt die gleichnamigen Produkte einer Expansion nach `idProduct` aufsteigend (an den beiden Beispielen bestätigt).

**Umfang:** nur RA01–RA05 (dort liegt das Problem). `scripts/build-cardmarket-direktlinks.ts` baut `src/lib/market/cardmarketDirekt.json` aus `rarityMap.json` und der Cardmarket-Produktliste. Ein Eintrag entsteht nur, wenn die Zuordnung eindeutig ist (Produktname nur aus Buchstaben, Ziffern, Leerzeichen, Bindestrich, Apostroph, &; je Karte genauso viele gleichnamige Produkte wie Seltenheiten; keine Mehrdeutigkeit in der rarityMap). Alles andere bleibt bei der Suche mit gelbem Warnhinweis („N Versionen").

**Server → Drawer:** `/api/article-detail/<id>` liefert `cardmarketPfad`; der Drawer baut daraus den Link (`cardmarketDirektLink`).

**Noch ungeprüft (Cardmarket sperrt Abfragen vom Server):**
- Expansionsnamen RA01, RA03, RA04, RA05 (laut YGOPRODeck: 25th-Anniversary-Rarity-Collection, Quarter-Century-Bonanza, Quarter-Century-Stampede, Rarity-Collection-5); RA02 ist bestätigt.
- Seltenheitsnamen in der Adresse außer Super Rare und Ultra Rare (Secret, Platinum Secret, Quarter Century Secret, Prismatic Collector's/Ultimate, Starlight).
- Namen mit anderen Sonderzeichen (Komma, Punkt, Doppelpunkt, !, ?, #, /) sind bewusst ausgenommen.
Wer einen Link prüft, der ins Leere läuft, meldet Set und Seltenheit; dann wird die Schreibweise im Skript angepasst und die Datei neu gebaut.
