# Player Attributes 12 Import Plan

## Aktueller Stand

Im Transfermarkt werden aktuell 12 Attributspalten als `S+` bis `F` angezeigt:

- `Pow`
- `Hea`
- `Sta`
- `Int`
- `Det`
- `Awa`
- `Spe`
- `Dex`
- `Cha`
- `Wil`
- `Spi`
- `Tor`

Der aktuelle ehrliche Zustand ist zweigeteilt:

- **Echt vorhanden**
  - `Pow`
  - `Spe`
  - `Men`
  - `Soc`
- **Aktuell Proxy**
  - `Hea`
  - `Sta`
  - `Int`
  - `Det`
  - `Awa`
  - `Dex`
  - `Cha`
  - `Wil`
  - `Spi`
  - `Tor`

## Reale Quellen heute

### In `data/generated/oly-player-stats.json`

Echt vorhanden:

- `coreStats.pow`
- `coreStats.spe`
- `coreStats.men`
- `coreStats.soc`

Nicht als eigene echte 12er-Felder vorhanden:

- `health`
- `stamina`
- `intelligence`
- `determination`
- `awareness`
- `dexterity`
- `charisma`
- `will`
- `spirit`
- `torment`

### Im Google-Sheet-Export / Player-Reiter

Aktuell sichtbar im Export:

- `Pow`
- `Spe`
- `Men`
- `Soc`

Nicht sichtbar als eigene echte 12er-Quellspalten:

- `Hea`
- `Sta`
- `Int`
- `Det`
- `Awa`
- `Dex`
- `Cha`
- `Wil`
- `Spi`
- `Tor`

### Retool-Attributquelle / Google-Sheet `Attribute`

Die Retool-Referenzen zeigen inzwischen eine eigene Attributquelle, und der Google-Sheet-Tab ist direkt abrufbar:

- Query/Source:
  - `getAttributeData`
- Source kind:
  - `GoogleSheetsQuery`
- Page:
  - `Saisonstand`
- Spreadsheet:
  - `Olympiade Player Stats`
- Sheet:
  - `Attribute`

Die Header des echten `Attribute`-Tabs sind:

- `Name`
- `Power`
- `Health`
- `Stamina`
- `Intelligence`
- `Awareness`
- `Determination`
- `Speed`
- `Dexterity`
- `Charisma`
- `Will`
- `Spirit`
- `Torment`
- `Power Rating`
- `Health Rating`
- `Stamina Rating`
- `Intelligence Rating`
- `Awareness Rating`
- `Determination Rating`
- `Speed Rating`
- `Dexterity Rating`
- `Charisma Rating`
- `Will Rating`
- `Spirit Rating`
- `Torment Rating`

Wichtig:

- In den lokal vorliegenden Retool-Exports ist diese Quelle als Query/Connector-Spur vorhanden.
- Der Google-Sheet-Tab selbst ist direkt als CSV abrufbar und wurde bereits in die DB uebernommen.
- Der aktuelle Sync-Pfad ist:
  - `npm run player:sync-attribute-sheet-db`
- Stand 2026-06-04:
  - `2983` Attributzeilen
  - `2982` exakte Namensmatches
  - `1` Alias-Match:
    - `Riley Le Rogue` -> `Riley Le Rouge`
  - `1` Spieler ohne Attributzeile:
    - `VIP Wal`

## Erwartete Read-only-Exportdatei fuer Mapping-Audit

Fuer den reinen Mapping-/Golden-Master-Audit wird lokal eine dieser Dateien erwartet:

- `references/retool-player-attributes/attribute-data.csv`
- `references/retool-player-attributes/attribute-data.json`

Pflichtspalten:

- `name`
- `power`
- `health`
- `stamina`
- `determination`
- `speed`
- `dexterity`
- `intelligence`
- `awareness`
- `will`
- `charisma`
- `spirit`
- `torment`
- `power_rating`
- `health_rating`
- `stamina_rating`
- `determination_rating`
- `speed_rating`
- `dexterity_rating`
- `intelligence_rating`
- `awareness_rating`
- `will_rating`
- `charisma_rating`
- `spirit_rating`
- `torment_rating`

Wenn diese Datei fehlt, bleibt der Mapping-Audit korrekt auf:

- `Attribute data missing; need export from Retool/Google Sheet Attribute tab`

## Aktueller Proxy-Pfad

Der Transfermarkt baut die 12er-Rating-Anzeige aktuell read-only aus den vorhandenen Achsen:

- `Health` -> Proxy aus `pow`
- `Stamina` -> Proxy aus `spe`
- `Intelligence` -> Proxy aus `men`
- `Determination` -> Proxy aus `men`
- `Awareness` -> Proxy aus `men`
- `Dexterity` -> Proxy aus `spe`
- `Charisma` -> Proxy aus `soc`
- `Will` -> Proxy aus `men`
- `Spirit` -> Proxy aus `soc`
- `Torment` -> Proxy aus `soc`

Die Umrechnung in `S+` bis `F` nutzt derzeit die Retool-Tiers:

- `>= 88` -> `S+`
- `>= 82` -> `S`
- `>= 76` -> `A`
- `>= 70` -> `B`
- `>= 64` -> `C`
- `>= 58` -> `D`
- `>= 52` -> `E`
- sonst `F`

## Datenbank-Stand heute

Im Prisma-Modell `PlayerAttribute` gibt es jetzt echte Felder fuer:

- `pow`
- `spe`
- `men`
- `soc`
- `power`
- `health`
- `stamina`
- `intelligence`
- `determination`
- `awareness`
- `speed`
- `dexterity`
- `charisma`
- `will`
- `spirit`
- `torment`
- plus die 12 Rating-Felder `*Rating`

Wichtig:

- Der Enum `PlayerAttributeKey` kennt bereits alle 12 Oly-Attribute.
- Das hilft bei Gewichtungsmatrizen.
- Es bedeutet aber **nicht**, dass die 12 Spielerattribute bereits als echte Player-Spalten importiert sind.

## Was für einen echten 12er-Import später nötig wäre

1. Die echte Quelle `Attribute` liefert inzwischen belastbar alle 12 Attributfelder plus 12 Rating-Felder.
2. Die DB-Felder und der Sync-Pfad sind ergänzt.
3. Noch offen bleibt die Umstellung aller UI-Pfade von Proxy auf echte DB-Werte.
4. Zusätzlich offen bleibt die Restlücke im Sheet selbst:
   - `VIP Wal` fehlt derzeit im `Attribute`-Tab und kann deshalb nicht importiert werden.

## Aktueller Sync-/Mapper-Stand

Vorhanden:

- Sheet-Fetcher fuer `Attribute`
- DB-Sync-Script:
  - `player:sync-attribute-sheet-db`
- Prisma-Felder fuer die 12 Werte und Ratings

Noch spaeter sinnvoll:

- Seed-Pfad ebenfalls auf die echten 12 Attribute anheben
- Transfermarkt-Read-Service und andere UI-Pfade von Proxy auf echte DB-Werte umstellen

## UI-Spalten nach echtem Import

Diese Spalten würden dann von Proxy auf echte Werte umgestellt:

- `Hea`
- `Sta`
- `Int`
- `Det`
- `Awa`
- `Dex`
- `Cha`
- `Wil`
- `Spi`
- `Tor`

`Pow` und `Spe` sind bereits heute echt vorhanden.

## Nötige Tests später

- Audit erkennt echte 12er-Quellspalten korrekt.
- Adapter mappt echte 12er-Felder korrekt.
- Seed/Sync schreibt echte 12er-Felder korrekt.
- Transfermarkt zeigt keine Proxy-Tiers mehr, sobald echte Werte da sind.
- UI und Audit markieren Proxy nur so lange, bis der echte Import steht.

## Fazit

Der echte 12-Attribut-Import ist jetzt technisch moeglich und der Sync-Pfad steht.

## Name-Matching

Das Mapping-Audit nutzt:

- exakte Normalisierung ueber Kleinschreibung
- Unicode-Normalisierung
- Entfernen einfacher Sonderzeichen
- Fuzzy-Kandidaten nur als Hinweis, nicht als automatisches Mapping

Bekannter Alias:

- `Riley Le Rogue` -> `Riley Le Rouge`

## Migration spaeter

Die eigentliche DB-Migration ist bereits erfolgt. Spaeter offen bleibt nur noch:

- Rest-UI von Proxy auf echte DB-Felder umstellen
- eventuell Seed-/Fallback-Pfade nachziehen

## Was bei fehlenden Daten weiter blocked bleibt

- matchRate gegen einen exportierten Retool-/Sheet-Dump
- Vollstaendigkeitspruefung aller 12 Werte ausserhalb des direkten Live-Sheet-Syncs
- externe Golden-Master-Referenzdatei fuer reproduzierbare Audits

Die verbleibende fachliche Restluecke liegt aktuell nicht mehr in der App, sondern im Quellsheet bzw. in fehlenden Exportartefakten:

- `VIP Wal` hat keine Zeile im `Attribute`-Tab

Der ehrliche Stand ist:

- **der echte 12er-Import ist bereits umgesetzt**
- die App hat die echten Felder in der DB
- einzelne UI-Pfade koennen noch von Proxy auf echte DB-Felder umgestellt werden
- fuer den separaten read-only Mapping-Audit bleibt ohne Exportdatei trotzdem ein Blocker:
  - Export der Retool-/Sheet-Attributdaten als `attribute-data.csv` oder `attribute-data.json`
