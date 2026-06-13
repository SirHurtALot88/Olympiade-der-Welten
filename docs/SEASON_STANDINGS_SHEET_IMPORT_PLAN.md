# Season Standings Sheet Import Plan

## Ziel

Diese App-Version nutzt **globales Gesamtscoring aller Teams**.

Es gilt bewusst **nicht**:

- keine Fame-Logik
- keine Draw-Logik
- keine Allianz-Logik
- keine paarungsbasierte Offline-Tabelle

Der Saisonstand soll deshalb aus einer globalen Punktetabelle bzw. einem Saisonstand-Sheet gelesen werden.

## Erwartete Quellen

- Saisonstand:
  - `references/sheets/season-standings.csv`
  - `references/sheets/season-standings.json`
- Rang-zu-Punkte:
  - `references/sheets/rank-to-points.csv`
  - `references/sheets/rank-to-points.json`
- Preisgeld:
  - `references/sheets/prize-money-table.csv`
  - `references/sheets/prize-money-table.json`
  - `references/sheets/prize-money-table.normalized.csv`
  - `references/sheets/prize-money-table.normalized.json`

## Erwartetes Format

### Saisonstand

Die aktuelle Online-App liest jetzt erfolgreich diese echten Saisonstand-Felder:

- `Mannschaft`
- `Kürzel`
- `Platz`
- `Punkte`
- `Cash`

Zusätzlich akzeptiert der Parser weiter die Synonyme:

- `Team` / `Teamname` / `Name`
- `Rank` / `Rang` / `Platz` / `position`
- `Points` / `Punkte` / `Pkt` / `pts`
- `Cash` / `Geld` / `Budget` / `Kontostand`
- `Cash`, falls vorhanden
- `Matchday`, falls vorhanden
- `Season`, falls vorhanden

### Rang-zu-Punkte

Die aktuelle lokale Punktetabelle liegt als Matrix vor:

- `Spieleranzahl`
- `1.` bis `32.`

Der Parser akzeptiert zusätzlich spaeter auch flachere Varianten wie:

- `Rank` / `Platz` / `Rang`
- `Points` / `Punkte`

Der Parser blockiert bewusst, wenn:

- Ränge fehlen
- Punkte fehlen
- die Datei stattdessen Teamzeilen oder Attributspalten enthält

### Preisgeld

Aktuell kommt der Preisgeld-Export als gemischter Mehrfachblock.

Der Parser:

- analysiert zuerst die Rohdatei
- erkennt Headerzeilen und Kandidatenbloecke
- waehlt nur einen eindeutigen Rang-/Preisgeldblock
- schreibt daraus bei Erfolg ein normalisiertes Format

Normalisiertes Zielschema:

- `rank`
- `placementLabel` optional
- `prizeMoney`
- `percent` optional
- `basis` optional
- `correction` optional
- `bonus` optional
- `malus` optional
- `season` optional
- `sourceRow`
- `warnings`

## Aktueller Stand

- Bestaetigte Blatt-IDs:
  - `Saisonstand` -> `475050161`
  - `Punktetabelle` -> `1155023152`
  - `Preisgeld` -> `2059519103`
- Der fruehere Verweis auf `gid=589766543` zeigt auf den `Attribute`-Tab und ist fuer Saisonstand falsch.
- Saisonstand und Punktetabelle koennen jetzt lokal exportiert und fachlich angebunden werden.
- Das Team-Mapping gegen Prisma-Teams funktioniert aktuell vollstaendig ueber `shortCode` / `name`.
- Die Preisgeldtabelle ist jetzt analysiert, normalisiert und als eigener read-only Preview-Pfad angebunden.
- `projectedCash` ist damit fachlich berechenbar, bleibt aber weiter getrennt von Standings Apply und jedem Cash-Apply.
- die normalisierte Preisgelddatei wird zusaetzlich ueber `prize:audit-normalized` auf 32 Ränge, doppelte Ränge, gueltige Preiswerte und dokumentierten `selectedBlock` geprueft

## Nächster sicherer Schritt

1. Season-End-Cash-Golden-Master ergaenzen
2. Preisgeld-/Cash-Apply weiter blockiert lassen
3. Standings Apply weiter blockiert lassen, bis Golden-Master- und Tie-Breaker-Gates vollstaendig sind
