# Transfermarkt Column Mapping

## Primärquelle

Die führende Quelle für die Transfermarkt-Spalten ist jetzt der automatische Retool-JSON-Extract:

- `/Users/chrisfalk/Documents/Codex/Olympiade der Welten/references/retool-transfermarkt-columns/manifest.json`
- `/Users/chrisfalk/Documents/Codex/Olympiade der Welten/references/retool-transfermarkt-columns/transfermarkt-columns.raw.json`

Screenshots sind nur Fallback für:

- visuelle Reihenfolge
- spacing / widths
- letzte UI-Optik

Wenn der Retool-JSON-Extract keine brauchbare Column-Config liefert, erst dann auf Screenshots oder Rückfrage gehen.

## Gefundene Retool-Tabellen

### `playersTable`

- Seite: `transfermarktPage`
- Typ: `TableWidget2`
- Datenquelle: `playersWithTeamFitBreakdown.value`
- sichtbare Kernspalten:
  - `Bild`
  - `Name`
  - `Marktwert`
  - `Gehalt`
  - `Pow`
  - `Spe`
  - `Men`
  - `Soc`
  - `Klasse`
  - `Fit`
  - `Bracket`
  - `Rasse`
  - `>20 / >40 / >60 / >80`
  - `Subclass 1/2/3`
  - `Alignment`
  - `Trait+ / Trait-`
- Row Actions:
  - `Pick`
  - `Kaufen`

### `playersTable2`

- Seite: `transfermarktPage`
- Typ: `TableWidget2`
- Datenquelle: `wishlistWithImages.value`
- sichtbare Kernspalten:
  - `Bild`
  - `Name`
  - `Marktwert`
  - `Gehalt`
  - `Fit`
  - `Pow`
  - `Spe`
  - `Men`
  - `Soc`
  - `Klasse`
  - `Rasse`
  - `>20 / >40 / >60 / >80`
  - `Subclass 1/2/3`
  - `Alignment`
  - `Trait+1`
- Row Actions:
  - `Entfernen`
  - `Kaufen`

### `aiTeamNeedsTable`

- Seite: `transfermarktPage`
- Typ: `TableWidget2`
- Datenquelle: `ai2NeedsSnapshot.value`
- sichtbare Kernspalten:
  - `Weight`
  - `Category`
  - `Weight (0-100)`
  - `Reason`
  - `Meta`

## Mapping nach Spalte

| Retool table | Retool label | Retool data key | Zweck | Neue Quelle | MVP Status | Teamabhängig | Golden-Master nötig | Kommentar |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `playersTable` | `Bild` | `image_url` | Portrait / Bild | `transfermarkt-read-service.imageUrl` | show now | no | no | Nicht browserfähige Pfade fallen auf Placeholder zurück. |
| `playersTable` | `Name` | `name` | Spieleridentität | `Player.name` | show now | no | no | Primäre Namensspalte. |
| `playersTable` | `Marktwert` | `marktwert` | Kaufpreis-Sicht | `PlayerAttribute.marketValue` | show now | no | no | Defaultsortierung bleibt Marktwert absteigend. |
| `playersTable` | `Gehalt` | `gehalt` | Salary-Sicht | `PlayerAttribute.salaryDemand` | show now | no | no | Keine Schätzung, nur echter Wert oder `missing`. |
| `playersTable` | `Pow` | `pow` | Kernattribut | `PlayerAttribute.pow` | show now | no | no | 1:1 Read-only. |
| `playersTable` | `Spe` | `spe` | Kernattribut | `PlayerAttribute.spe` | show now | no | no | 1:1 Read-only. |
| `playersTable` | `Men` | `men` | Kernattribut | `PlayerAttribute.men` | show now | no | no | 1:1 Read-only. |
| `playersTable` | `Soc` | `soc` | Kernattribut | `PlayerAttribute.soc` | show now | no | no | 1:1 Read-only. |
| `playersTable` | `Klasse` | `klasse` | Spielertyp | `Player.className` | show now | no | no | 1:1 Read-only. |
| `playersTable` | `Rasse` | `rasse` | Flavor / Filter | `Player.race` | show now | no | no | 1:1 Read-only. |
| `playersTable` | `Fit` | `team_fit` | Teambezogener Fit | `calculated read-only` | show only with team selected | yes | yes | Ohne Team `Team wählen`. Mit Team nur `Fit nicht verfügbar` / `not_ported_golden_master`. |
| `playersTable` | `Bracket` | `Bracket` | Einordnung / Paketlogik | unavailable | blocked | yes | yes | Retool nutzt zusätzliche AI-/Package-Logik. |
| `playersTable` | `Alignment` | `alignment` | Flavor / Teamfit | unavailable | later | yes | yes | In neuer App noch nicht als Marktspalte portiert. |
| `playersTable` | `Subclass 1/2/3` | `subclass_*` | Rollen-/Feinprofil | unavailable | later | no | yes | Noch keine stabile neue Datenquelle im MVP. |
| `playersTable` | `Trait+ / Trait-` | `trait_pos_*` / `trait_neg_*` | Feingranulare Profilierung | unavailable | later | no | yes | Erst mit Trait-/Wishlist-/AI-Kontext sinnvoll. |
| `playersTable` | `>20 / >40 / >60 / >80` | `count_gt*` | Diszi-Breite | calculated read-only | later | no | no | Kann lokal abgeleitet werden, aber nicht MVP-kritisch. |
| `playersTable2` | `Kaufen` | row action | Kaufaktion | unavailable | later | yes | no | Buy-Path bleibt in diesem Block aus. |
| `playersTable2` | `Entfernen` | row action | Wishlist entfernen | unavailable | blocked | yes | no | Keine Wishlist-Implementierung in neuer App. |
| `aiTeamNeedsTable` | `Weight` | `weight` | Need-Priorität | unavailable | blocked | yes | yes | Retool Needs-Snapshot noch nicht portiert. |
| `aiTeamNeedsTable` | `Category` | `category` | Need-Typ | unavailable | blocked | yes | yes | Hängt am Needs-/AI-Stack. |
| `aiTeamNeedsTable` | `Reason` | `reason` | Begründung | unavailable | blocked | yes | yes | Hängt am Needs-/AI-Stack. |

## Neuer MVP-Column-Contract

Die neue App verwendet jetzt einen neutralen, expliziten Contract:

- `/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/market/transfermarkt-column-contract.ts`

### `show now`

- `Name`
- `Bild`
- `Klasse`
- `Rasse`
- `Marktwert`
- `Gehalt`
- `POW`
- `SPE`
- `MEN`
- `SOC`
- `Fit`
- `Bracket`
- `>20 / >40 / >60 / >80`

### `show only with attribute toggle`

- `Subclass 2`
- `Subclass 1`
- `Subclass 3`
- `Alignment`
- `Trait+1 / Trait+2 / Trait+3`
- `Trait-1 / Trait-2 / Trait-3`
- `Geschlecht`
- `Marktwert gehalt ratio`
- `Fit Rasse`
- `Fit Subclasses`
- `Fit Traits`
- `Fit Alignment`

### `show only with team selected`

- `Affordable`
- `Team Cash`
- `Roster Pressure`
- `PlayerMin/Opt`
- `Fit`

### `later / blocked`

- echter `Fit`
- `Need Score`
- `Role`
- `Package/Wishlist`
- `Buy Action`
- `Transfer Lock`
- `Listing Price Override`

## Fit-Regel

- Ohne `teamId`:
  - `fit = null`
  - `fitDisplay = Team wählen`
  - `fitSource = select_team_for_fit`
- Mit `teamId`:
  - echte Team-Kontextfelder werden geliefert
  - ein lokaler, Retool-naher Read-only-Fit wird berechnet
  - Spieler mit `Mercenary` bleiben sichtbar, auch wenn `fit <= 0`

Die exakte Retool-Matrix ist weiter nicht vollstaendig portiert. Details dazu stehen in:

- `/Users/chrisfalk/Documents/Codex/Olympiade der Welten/docs/TRANSFERMARKT_RETOOL_GAP.md`
