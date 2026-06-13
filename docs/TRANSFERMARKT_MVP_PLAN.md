# Transfermarkt MVP Plan

## Warum der Transfermarkt aktuell leer wirkt

Der aktuelle Prisma-/Supabase-Pfad hat noch kein eigenes `TransferListing`-Modell. In der App wird der Markt derzeit nur lokal bzw. projektiert aus `Player` minus `ActivePlayer` abgeleitet. Wenn im aktiven `saveId + seasonId`-Scope nur wenige oder keine freien Spieler uebrig sind, wirkt der Transfermarkt leer.

Zusaetzlich ist die serverseitige Marktquelle bisher nicht als eigene read-only API formalisiert. Die Foundation-Seite zeigt deshalb eher einen Frontend-Projektionspfad als einen klaren serverseitigen Marktservice.

## Welche Daten bereits vorhanden sind

- `Player`
- `PlayerAttribute`
  - `marketValue`
  - `salaryDemand`
  - `pow`
  - `spe`
  - `men`
  - `soc`
- `ActivePlayer`
  - `teamId`
  - `playerId`
  - `salary`
  - `purchasePrice`
  - `currentValue`
  - `contractLength`
  - `joinedSeasonId`
- `Transfer`
  - historische bzw. strukturelle Transferdaten
- `TeamSeasonState`
  - `cash`
  - `budget`
  - `rosterLimit`
  - `playerMin`
  - `playerOpt`

## Echte Audit-Counts

Fuer `save-initial / season-1` wurde read-only ermittelt:

- `playersTotal = 2984`
- `activePlayersTotal = 261`
- `freeAgentsTotal = 2723`
- `transfersTotal = 0`
- `transferListingsTotal = model_missing`
- `teamsUnder7 = 7`
- `teamsUnderPlayerMin = 15`
- `teamsUnderPlayerOpt = 22`

Verteilungscheck fuer Geldwerte aus `player:audit-economy-source`:

- `distinctMarketValues = 21`
- `marketValueMedian = 40000`
- `marketValue100000Count = 44`
- `marketValue100000Pct = 1.47%`
- `distinctSalaryDemandValues = 11`
- `salaryDemandMedian = 4000`
- `salaryDemand10000Count = 42`
- `salaryDemand10000Pct = 1.41%`

Damit ist wichtig:

- `100000 / 10000` ist **kein globaler Default fuer fast alle Spieler**
- die Exportdatei enthaelt eine echte, aber stark gestufte Money-Verteilung
- wenn Marktwerte fachlich unplausibel wirken, ist der naechste Kandidat die Export-/Sheet-Quelle selbst, nicht ein Seed-Fallback

Direkte API-Pruef-URL:

- `http://localhost:3000/api/transfermarkt/free-agents?saveId=save-initial&seasonId=season-1&limit=5`

Damit ist klar:

- Free Agents existieren in grosser Zahl
- der Markt ist nicht fachlich leer
- der fehlende Listing-Layer und der bisher fehlende serverseitige Marktpfad waren das eigentliche MVP-Problem

## Welche Daten noch fehlen

- kein Prisma-`TransferListing`-Modell
- noch kein kontrollierter Buy-Service
- noch keine produktive `Transfer`-Historien-Schreiblogik fuer neue Kaeufe

## Free-Agent-Ansatz fuer den MVP

Der kleinste sichere MVP ist:

- alle `Player`, die **keinen** `ActivePlayer` im aktuellen `saveId + seasonId`-Scope haben, gelten read-only als potenzielle Free Agents
- Preise werden nicht neu erfunden
- `marketValue` kommt aus `PlayerAttribute.marketValue`
- Gehalt kommt aus `PlayerAttribute.salaryDemand`, falls vorhanden
- wenn Salary fehlt, bleibt sie `missing`

Damit kann der Markt sichtbar gemacht werden, ohne neue Listing-Tabellen oder Kauf-Writes einzufuehren.

Der Markt funktioniert damit aktuell ueber `derived_free_agents`.

## Zuverlaessige Marktfelder

Fuer den MVP als verlaesslich nutzbar:

- `PlayerAttribute.marketValue`
- `PlayerAttribute.salaryDemand`
- `PlayerAttribute.pow`
- `PlayerAttribute.spe`
- `PlayerAttribute.men`
- `PlayerAttribute.soc`
- `Player.className`
- `Player.race`
- `Player.portraitPath`
- `Player.portraitUrl`

Die fachliche Seed-Quelle fuer diese beiden Werte ist aktuell:

- `data/generated/oly-player-stats.json`

Der Pfad ist:

- Google-Sheets-/Player-Export
- `loadImportedPlayerStats()`
- `loadSeedData()`
- `mapPlayerAttributeRecord()`
- `PlayerAttribute.marketValue`
- `PlayerAttribute.salaryDemand`

Die Werte werden als Vollwerte gespeichert und angezeigt, nicht als interne `k`-Einheit:

- `marketValue = 100000` bedeutet `100.000`
- `salaryDemand = 10000` bedeutet `10.000`

Pruefbefehl:

- `npm run player:audit-economy-source`

Die aktuelle Rohfeld-Inventur zeigt fuer die generierte Importdatei:

- `marketValue` vorhanden, Typ `number`
- `salaryDemand` vorhanden, Typ `number`
- kein separates `purchasePrice`-Feld in `oly-player-stats.json`
- keine String-Locale-Signale fuer Geldfelder
- keine Dezimalkomma-Faelle in den Money-Feldern

## Fehlende oder noch offene Felder

- kein Listing-spezifischer Preis
- kein Listing-spezifischer Salary-Override
- keine Listing-Status-Historie
- keine produktive Transferhistorie fuer neue Kaeufe
- keine serverseitige Kaufmutation

## Spaeterer sicherer Kaufpfad

1. read-only Markt
2. serverseitiger Buy-Service mit Dry-run-first
3. Buy Smoke-Test
4. UI-Kaufbutton
5. AI-Kaeufe spaeter

Aktueller MVP-Stand fuer den Kaufpfad:

- `previewTransfermarktBuy(...)` fuer reine Vorschau
- `executeTransfermarktBuy(...)` fuer kontrollierten Write
- `POST /api/transfermarkt/buy`
- `transfermarkt:smoke-buy` default = Dry-run
- echter Write nur mit `--write`

## Retool Atomic Buy als Referenz

Fuer den spaeteren Kaufpfad bleibt Retool die fachliche Referenz:

- Cash/Budget pruefen
- Kaderlimit pruefen
- Duplicate `ActivePlayer` verhindern
- saisonale Locks spaeter pruefen
- Transferhistorie schreiben
- `TeamSeasonState` / Cash / Salary kontrolliert aendern

## Offene Fragen

- Brauchen wir spaeter ein echtes `TransferListing`-Modell?
- Sollen langfristig wirklich alle Free Agents sichtbar sein?
- Wie wird Salary spaeter final behandelt, wenn `salaryDemand` nur eine Ausgangsbasis ist?
- Wann soll `Transfer` fuer neue Kaeufe produktiv beschrieben werden?

## Audit-Hinweis

Das Script `transfermarkt:audit` ist read-only und erwartet lokal eine `.env.local` mit gesetzter `DATABASE_URL` im Projektroot. Es loggt nur, ob `DATABASE_URL` vorhanden ist, aber niemals den Secret-Wert selbst.

## Transfermarkt-Lab

Das read-only Lab ist fuer diesen MVP gebaut:

- `/foundation/transfermarkt-lab`
- direkte API-Pruefung:
  - `http://localhost:3000/api/transfermarkt/free-agents?saveId=save-initial&seasonId=season-1&limit=5`

Es zeigt:

- Scope
- API-Status
- `total`
- `items.length`
- `source`
- Team-Context-Status
- Free-Agent-Tabelle
- Suche
- Limit
- optionale Teamwahl
- Marktwert, Gehalt, Achsenwerte
- Top 3 Disziplinen
- Availability
- Team-Cash / Roster-Pressure / PlayerMin-Opt / Fit-Display nach Column Contract

Ohne:

- Kaufbuttons
- Wishlist
- jegliche Writes

## Bild-/Portrait-MVP-Regel

Wenn `portraitUrl` oder `portraitPath` nicht browserfaehig ist, wird kein kaputtes Bild gerendert. Stattdessen:

- Placeholder/Initialen sind erlaubt
- `missing_or_unresolved_portrait` wird als Warning bzw. fehlendes Feld behandelt
- das Lab darf dadurch nicht crashen

## Transfermarkt-UI-MVP-Regeln

- Default-Sortierung im Markt: `marketValue desc`
- sichtbarer Hinweis: `Sortierung: Marktwert ↓`
- die Spaltenreihenfolge folgt dem neutralen Contract in
  - `lib/market/transfermarkt-column-contract.ts`
- ohne Teamkontext gibt es **keine** echte Fit-Zahl
- die UI zeigt dann `Team waehlen`
- `fit = null`
- `fitSource = select_team_for_fit`
- mit Teamkontext werden nur diese echten Kontextfelder angezeigt:
  - `teamCash`
  - `rosterCount`
  - `playerMin`
  - `playerOpt`
  - `affordabilityStatus`
  - `rosterPressureStatus`
- mit Team bleibt `fit` trotzdem `null`
- `fitDisplay = Fit nicht verfügbar`
- `fitSource = not_ported_golden_master`
- sichtbarer UI-Hinweis:
  - `Golden-Master-Fit noch nicht portiert`
- keine Fantasiezahl

## Retool-Column-Quelle

Die Transfermarkt-Spalten werden jetzt primär aus Retool-JSON extrahiert:

- `npm run retool:extract-transfermarkt-columns`
- Output:
  - `references/retool-transfermarkt-columns/manifest.json`
  - `references/retool-transfermarkt-columns/transfermarkt-columns.raw.json`
  - `references/retool-transfermarkt-columns/README.md`

Aktuell gefundene Transfermarkt-Tabellen:

- `playersTable`
- `playersTable2`
- `aiTeamNeedsTable`

## Naechster sicherer Schritt

Der serverseitige Buy-Service bleibt auf diesen Write-Scope begrenzt:

- `ActivePlayer`
- `Transfer`
- `TeamSeasonState.cash`

Nicht Teil des Kauf-MVP:

- keine AI-Kaeufe
- keine Verkaeufe
- keine Standings-/Result-Writes
- keine SQLite-Writes
- keine Preisgenerierung
