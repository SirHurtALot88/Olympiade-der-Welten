# Golden Master Fixture Spec

## Ziel
Fixtures halten die erwartete Retool-Wahrheit fest, damit neue App-Logik spaeter deterministisch dagegen verglichen werden kann.

## Gemeinsame Pflichtfelder
Jedes Fixture soll mindestens enthalten:
- `source`: `retool` oder `app`
- `capturedAt`: ISO-Timestamp der Aufnahme
- `saveId`: falls relevant
- `seasonId`
- `matchdayId`: falls relevant
- `inputs`: strukturierte Eingaben oder Query-Parameter
- `outputs`: erwartete Ausgabe
- `notes`: kurze Einordnung oder bekannte Besonderheiten
- `toleratedFloatDelta`: falls Rundungsabweichungen erlaubt sind

## 1. standings-before.json
Zweck:
- Saisonstand vor einem Matchday oder einer Operation

Empfohlene Outputs:
- `teams[]`
- `rank`
- `teamId`
- `teamName`
- `points`
- `pointDiff`
- `cash`
- optional `totalScore`
- optional `matchday`

## 2. matchday-result.json
Zweck:
- Ergebnis eines Resolve-/Matchday-Laufs

Empfohlene Outputs:
- `teamResults[]`
- `disciplineResults[]`
- `topPlayers[]`
- `scoreBreakdown`
- `warnings[]`

## 3. standings-after.json
Zweck:
- Saisonstand nach dem Matchday

Empfohlene Outputs:
- gleiche Struktur wie `standings-before.json`
- veraenderte Punkte-/Rank-/Diff-Werte

## 4. economy-before.json
Zweck:
- Team-Finanzen vor Buy/Sell/Prize/Cash-Operation

Empfohlene Outputs:
- `teams[]`
- `teamId`
- `cash`
- `budget`
- `salary`
- `rosterCount`

## 5. economy-after.json
Zweck:
- Team-Finanzen nach der Operation

Empfohlene Outputs:
- gleiche Struktur wie `economy-before.json`
- zusaetzlich `deltaSummary`, falls hilfreich

## 6. transfer-event.json
Zweck:
- Einzelnes Kauf-/Verkaufsevent als Golden-Master-Referenz

Empfohlene Outputs:
- `transferId`
- `type`
- `playerId`
- `playerName`
- `fromTeamId`
- `toTeamId`
- `fee`
- `salary`
- `marketValue`
- `happenedAt`

## Vergleichsregel
- Exakte Gleichheit bevorzugen
- Nur dokumentierte Float-Deltas tolerieren
- Timestamps oder volatile IDs nur ueber bewusst gesetzte Ignore-Regeln ausnehmen
