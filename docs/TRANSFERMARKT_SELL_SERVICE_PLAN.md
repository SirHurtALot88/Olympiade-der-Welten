# Transfermarkt Sell Service Plan

## 1. Ziel

Der erste Sell-Service-MVP soll einen bereits aktiven Spieler kontrolliert aus einem Teamkader entfernen.

Was der MVP fachlich leisten soll:

- `ActivePlayer` aus einem Team verkaufen
- `TeamSeasonState.cash` erhoehen
- den Spieler aus dem aktiven Kader entfernen
- einen `Transfer`-Datensatz mit `type = sell` schreiben
- die Transferhistorie ergaenzen
- den Spieler wieder als Free Agent sichtbar machen
- die Team-Readiness nach dem Verkauf sichtbar schlechter werden lassen, falls der Kader zu klein wird

Warum serverseitig:

- Verkauf ist genauso wie Kauf ein kontrollierter Wirtschaftsschritt
- `ActivePlayer`, `Transfer` und `TeamSeasonState` muessen gemeinsam konsistent bleiben
- ein halber Verkauf waere fachlich kaputt

Warum transaktional:

- Cash darf nicht steigen, wenn `ActivePlayer` nicht wirklich entfernt wurde
- `Transfer` darf nicht fehlen, wenn ein Spieler aus dem Kader verschwunden ist
- Read-side Ableitungen wie `teamSalary`, `rosterCount`, `freeAgents` muessen danach aus einem konsistenten DB-Stand lesen

Warum MVP erst ohne Listings / Packages / AI:

- der sichere erste Verkaufspfad ist `Team -> Markt / Free Agent`
- kein Listing-System notwendig
- kein Auto-Sell
- kein Package-/Multi-Player-Transfer

## 2. Retool- / Doku-Referenz

### Sicher gefunden

Aus den vorhandenen Projektspuren ist fachlich sicher bestaetigt:

- `Transfer` existiert bereits als echte Persistenz mit:
  - `fromTeamId`
  - `toTeamId`
  - `type`
  - `fee`
  - `salary`
  - `marketValue`
  - `remainingContractLength`
  - `happenedAt`
- `TransferType` kennt bereits:
  - `buy`
  - `sell`
- die App zeigt bereits read-only:
  - Transferhistorie
  - Team-Cash
  - Team-Gehalt
  - Roster Count
  - Readiness
- es gibt Retool-/AI-Doku-Spuren zu:
  - `sellPlayerComplete`
  - Buyout / Season-Consistency-Hinweise
  - `cash_creator`
  - `sell-flexibility`
  - Cash-/Salary-Posture
  - Package-Scoring

Konkrete Projektspuren:

- `docs/README_RETOOL_SYSTEM.md`
  - `sellPlayerComplete` wird dort als Verkauf + Season-Consistency-Fix beschrieben
  - die Spur nennt Netto-/Cash-/Salary-Update als Ziel, aber nicht vollstaendig portierbar genug fuer eine 1:1-MVP-Logik
- `references/golden-master-fixtures/economy/retool-transfer-economy-confirmed-rules.md`
  - bestaetigt: Verkauf erhoeht Cash
  - bestaetigt: Kauf/Verkauf beruehren Saisonstand-/Cash-/Salary-Zustand

### Nicht sauber / nicht verbindlich gefunden

Nicht als sichere MVP-Quelle bestaetigt:

- eine komplette Retool-Funktion `sellPlayerComplete` als 1:1 portierbare Referenz
- eine verbindliche Netto-/Brutto-Verkaufslogik
- Gebuehren / Tax / Buyout-Abschlaege
- Season-Lock-Regeln fuer Re-Sell / Re-Buy
- finale KI-Regeln fuer automatische Verkaeufe

### Was der MVP bewusst einfacher macht

Der erste Sell-MVP bleibt absichtlich simpel:

- kein Gebuehrensystem
- kein Marktpreis-Generator
- kein Buyout / kein Discount / kein Prozentmodell
- kein brutto/netto-Split
- Verkauf immer an den Markt / Free-Agent-Pool
- kein Transfer-Lock im ersten Schritt
- keine Package- oder AI-Logik

## 3. Input

Geplanter Service-Input:

- `saveId`
- `seasonId`
- `teamId`
- `activePlayerId`
- `salePrice` optional
- `dryRun` default `true`

Begruendung:

- `activePlayerId` ist der sichere Anker fuer den Verkauf
- so wird wirklich der aktive Kader-Eintrag verkauft, nicht nur ein `playerId`
- dadurch vermeiden wir Konflikte bei spaeteren Save-/Season-Kontexten

## 4. MVP-Preis-Policy

Empfohlene MVP-Policy:

- `salePrice = ActivePlayer.currentValue`, falls vorhanden
- fallback `salePrice = ActivePlayer.purchasePrice`
- wenn beides fehlt: **blockieren**
- keine Preisgenerierung
- kein Zufall
- kein AI-/Markt-Multiplikator
- kein Prozent-Abschlag im ersten MVP

Begruendung:

- `currentValue` ist der beste vorhandene Kandidat fuer einen aktuellen Verkaufspreis
- `purchasePrice` ist ein sicherer Fallback
- alles andere waere aktuell erfundene Marktlogik

## 5. Salary-Policy

Empfohlene MVP-Policy:

- `teamSalary` wird weiterhin aus `ActivePlayer.salary` aggregiert
- nach Verkauf sinkt `teamSalary` dadurch automatisch
- kein separates persistiertes Salary-Summenfeld auf `TeamSeasonState` schreiben

Aktueller sicherer Befund:

- beim Buy-Service wird bereits dokumentiert, dass `TeamSeasonState` aktuell **kein** eigenes Salary-/Upkeep-Summenfeld als gepflegtes Aggregat fuehrt
- Salary-/Roster-Folgen werden read-only aus `ActivePlayer` abgeleitet

Folge fuer Sell:

- nach Entfernen/Deaktivieren des `ActivePlayer` sinkt `teamSalaryAfter` automatisch ueber die Read-Seite

## 6. ActivePlayer-Policy

Zu bewerten:

- Hard Delete
- Soft Delete via `status = inactive`
- nur `Transfer` schreiben und `ActivePlayer` stehen lassen

Empfehlung fuer MVP:

- **kontrolliertes Delete in Transaktion**

Begruendung:

- aktueller Markt nutzt `Player ohne ActivePlayer im saveId + seasonId` als Free-Agent-Quelle
- fuer den MVP ist Delete der direkteste und sauberste Weg, damit der Spieler wieder als Free Agent auftaucht
- `Transfer` haelt die Historie
- Soft Delete waere spaeter moeglich, aber muesste zusaetzlich im Free-Agent-Read und in allen ActivePlayer-Queries sauber beachtet werden

Nicht empfohlen fuer MVP:

- `status = inactive`, solange nicht alle Read-Pfade darauf vorbereitet sind
- nur `Transfer` ohne Kaderaenderung

## 7. Blockierende Validierungen

Vor einem spaeteren Write muessen diese Checks **blockierend** sein:

- Save existiert
- Season existiert
- Team existiert
- `TeamSeasonState` existiert
- `ActivePlayer` existiert
- `ActivePlayer` gehoert zu `teamId + saveId + seasonId`
- `Player` fuer den `ActivePlayer` existiert
- `salePrice` ist vorhanden
- kein Cross-Save-/Cross-Season-Fehler

Optional blockierend, wenn pruefbar:

- `ActivePlayer` ist nicht bereits in einem inkonsistenten Status

Nicht blockierend, aber warnend:

- Team faellt unter `7` Spieler
- Team faellt unter `playerMin`
- Team faellt unter `playerOpt`
- Team verliert Readiness
- verkaufter Spieler war in gespeichertem Lineup oder Draft enthalten

## 8. Erlaubte spaetere Writes

Nur in **einer** Transaktion:

- `Transfer` create mit `type = sell`
- `ActivePlayer` delete
- `TeamSeasonState.cash` increment

Konkrete Effekte:

- `fromTeamId = teamId`
- `toTeamId = null` fuer Verkauf an Markt / Free-Agent-Pool
- `fee = salePrice`
- `salary = ActivePlayer.salary`
- `marketValue = salePrice` oder `ActivePlayer.currentValue` analog zur Preis-Policy
- `remainingContractLength = ActivePlayer.contractLength`
- `happenedAt = now`

Nicht erlaubt:

- keine Standings
- keine Result-Writes
- keine SQLite-Writes
- keine AI
- keine Auto-Sells
- keine Preisgenerierung
- keine Budget-/Fame-/Cash-Schreibpfade ausser `TeamSeasonState.cash`

## 9. Dry-run Strategie

Die Preview soll vor jedem spaeteren Write liefern:

- `player`
- `team`
- `cashBefore`
- `cashAfter`
- `rosterBefore`
- `rosterAfter`
- `teamSalaryBefore`
- `teamSalaryAfter`
- `salePrice`
- `warnings`
- `blockingReasons`
- `projectedReadinessAfterSell`

Wichtige Regel:

- `dryRun = true` fuehrt niemals Writes aus
- Confirm / Execute darf nur moeglich sein, wenn `canSell = true`

## 10. Smoke-Test-Plan

Empfohlener spaeterer Smoke-Pfad:

- `transfermarkt:smoke-sell` default = dry-run
- `--write` nur explizit
- defensiv einen entbehrlichen Spieler waehlen
- **nicht Kloeschen automatisch verkaufen**

Nach Write pruefen:

- `Transferhistorie`
- `Free-Agent-Liste`
- `Readiness`
- `rosterCount`
- `teamSalary`
- `cash`

## 11. Testfaelle spaeter

Diese Faelle sollen bei spaeterer Implementierung abgedeckt werden:

- Sell Preview blockiert falsches Team
- Sell Preview blockiert fehlenden `ActivePlayer`
- Sell Preview blockiert fehlenden `salePrice`
- Sell Preview warnt bei Team unter `7`
- Sell Preview warnt bei Team unter `playerMin`
- Sell Preview warnt bei Readiness-Verlust
- Write entfernt den `ActivePlayer`
- Write schreibt `Transfer type = sell`
- Write erhoeht `TeamSeasonState.cash`
- Spieler erscheint wieder als Free Agent
- Readiness kann schlechter werden
- keine Standings-/SQLite-/Result-Writes

## 12. Offene Fragen

- Soll Verkaufspreis spaeter brutto/netto unterscheiden?
- Soll es Gebuehren geben?
- Geht Verkauf im MVP immer an `FA / Markt` oder spaeter an explizite Listings?
- Darf derselbe Spieler in derselben Season sofort wieder kaufbar sein?
- Brauchen wir einen Transfer-Lock?
- Soll spaeter statt Delete doch Soft-Delete genutzt werden?
- Wollen wir einen zusaetzlichen `TransferAuditLog`?

## Kurzfazit

Der kleinste sichere Sell-MVP ist:

1. `ActivePlayer` per `activePlayerId` identifizieren
2. Verkaufspreis aus `currentValue` oder `purchasePrice` nehmen
3. Dry-run mit Cash-/Roster-/Salary-/Readiness-Projektion
4. In einer Transaktion:
   - `Transfer` schreiben
   - `ActivePlayer` loeschen
   - `TeamSeasonState.cash` erhoehen
5. Spieler dadurch wieder im Free-Agent-Markt sichtbar machen
