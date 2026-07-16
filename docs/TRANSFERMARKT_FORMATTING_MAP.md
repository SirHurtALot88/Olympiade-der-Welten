# Transfermarkt Formatting Map

## Gefundene Farbcodes

| colorCode/token | Retool table | column | expression/rule | Bedeutung | certainty |
| --- | --- | --- | --- | --- | --- |
| `#1565C0` | `playersTable` | `Pow`, `Spe`, `Men`, `Soc` | `v >= 86` | oberster Rating-Bucket | `confirmed` |
| `#42A5F5` | `playersTable` | `Pow`, `Spe`, `Men`, `Soc` | `v >= 76` | sehr starker Rating-Bucket | `confirmed` |
| `#2E7D32` | `playersTable` | `Pow`, `Spe`, `Men`, `Soc` | `v >= 66` | starker Rating-Bucket | `confirmed` |
| `#66BB6A` | `playersTable` | `Pow`, `Spe`, `Men`, `Soc` | `v >= 56` | guter Rating-Bucket | `confirmed` |
| `#F9A825` | `playersTable` | `Pow`, `Spe`, `Men`, `Soc` | `v >= 46` | mittlerer Rating-Bucket | `confirmed` |
| `#FFEB3B` | `playersTable` | `Pow`, `Spe`, `Men`, `Soc` | `v >= 36` | unterer mittlerer Rating-Bucket | `confirmed` |
| `#FF9800` | `playersTable` | `Pow`, `Spe`, `Men`, `Soc` | `v >= 21` | schwacher Rating-Bucket | `confirmed` |
| `#EF5350` | `playersTable` | `Pow`, `Spe`, `Men`, `Soc` | fallback | niedrigster Rating-Bucket | `confirmed` |
| `#4CAF50` | `playersTable` | `>20`, `>40`, `>60`, `>80` | relative top range | hohe Diszi-Breite | `confirmed` |
| `#FFEB3B` | `playersTable` | `>20`, `>40`, `>60`, `>80` | relative mid range | mittlere Diszi-Breite | `confirmed` |
| `#F44336` | `playersTable` | `>20`, `>40`, `>60`, `>80` | relative low range | niedrige Diszi-Breite | `confirmed` |
| `#ff8a80` / `#b71c1c` | `playersTable` | `Klasse` | class palette | rote Klassenfamilie | `confirmed` |
| `#a5d6a7` / `#1b5e20` | `playersTable` | `Klasse` | class palette | gruene Klassenfamilie | `confirmed` |
| `#90caf9` / `#0d47a1` | `playersTable` | `Klasse` | class palette | blaue Klassenfamilie | `confirmed` |
| `#ffe082` / `#e65100` | `playersTable` | `Klasse` | class palette | gelbe Klassenfamilie | `confirmed` |

## Gefundene 8-Farb-Skala

Quelle:

- `playersTable`
- Spalten: `Pow`, `Spe`, `Men`, `Soc`
- JSON-Regel: `conditionalFormatting`

Farben:

1. `#1565C0`
2. `#42A5F5`
3. `#2E7D32`
4. `#66BB6A`
5. `#F9A825`
6. `#FFEB3B`
7. `#FF9800`
8. `#EF5350`

Buckets:

- `>= 86`
- `>= 76`
- `>= 66`
- `>= 56`
- `>= 46`
- `>= 36`
- `>= 21`
- fallback

Typ:

- Rating-/Score-Skala

## Formatierungsregeln

### `Marktwert`

- Retool-Spalte: `Marktwert`
- dataKey: `marktwert`
- Format: `currency`
- neue App: `formatTransfermarktCurrency(...)`
- Status: sicher uebernommen

### `Gehalt`

- Retool-Spalte: `Gehalt`
- dataKey: `gehalt`
- Format: `currency`
- neue App: `formatTransfermarktCurrency(...)`
- Status: sicher uebernommen

### `Pow/Spe/Men/Soc`

- Retool-Spalten: `Pow`, `Spe`, `Men`, `Soc`
- Format: `decimal`, Anzeige gerundet
- Farben: bestaetigte 8-Farb-Skala
- neue App: `getConfirmedAxisHeatStyle(...)`
- Status: sicher uebernommen

### `>20 / >40 / >60 / >80`

- Retool-Spalten: `count_gt20`, `count_gt40`, `count_gt60`, `count_gt80`
- Format: `decimal`
- Farben: relative 3-Farb-Skala aus Tabellenverteilung
- neue App: noch nicht produktiv angewandt
- Status: bestaetigte Quelle, aber bewusst noch blockiert

### `Klasse`

- Retool-Spalte: `klasse`
- Format: `tag`
- Farben: feste Klassenpalette
- neue App: semantisch bekannt, aber noch nicht als produktive exakte Retool-Palette verdrahtet
- Status: confirmed source, cautious rollout

### `Fit`

- Retool-Spalte: `team_fit`
- Format: `decimal`
- Farbe: keine sichere Golden-Master-Fit-Farbregel fuer den neuen Stack bestaetigt
- neue App: keine Fit-Farbe ohne echten Golden Master
- Status: blockiert

## Nicht eindeutig

- `Kartenfarbe`
  - im Screenshot sichtbar
  - im aktuellen Transfermarkt-JSON-/DB-Pfad nicht sauber als eigene fachliche Quelle bestaetigt
  - Status: `unknown`
- zusaetzliche Attributspalten wie `Hea`, `Sta`, `Int`, `Det`, `Awa`, `Dex`, `Cha`, `Wil`, `Spi`, `Tor`
  - in Retool sichtbar
  - im neuen App-Pfad noch nicht als bestaetigte Transfermarktquelle verdrahtet
  - Status: manuelle Portierung spaeter
- falls eine Screenshot-Farbwirkung nicht exakt im JSON wiederzufinden ist:
  - als `screenshot_only_unconfirmed` behandeln

