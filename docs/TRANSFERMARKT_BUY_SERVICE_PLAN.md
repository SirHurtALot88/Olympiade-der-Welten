# Transfermarkt Buy Service Plan

## 1. Ziel

Der erste Buy-Service-MVP soll einen **Free Agent** serverseitig und kontrolliert in einen Teamkader uebernehmen.

Ein Buy-Service ist dabei:

- ein dedizierter Server-Pfad fuer einen Kauf
- kein UI-Write
- kein direkter Prisma-Client im Browser
- kein AI-Pfad

Warum serverseitig:

- nur dort lassen sich Kader-, Cash- und Duplikat-Pruefungen sicher erzwingen
- nur dort kann spaeter eine echte DB-Transaktion sauber laufen
- nur dort kann ein spaeterer Audit-/Transferlog konsistent geschrieben werden

Warum transaktional:

- `ActivePlayer`, `Transfer` und `TeamSeasonState` muessen gemeinsam konsistent bleiben
- ein teilweise erfolgreicher Kauf waere fachlich falsch
- Duplikate oder negativer Cash-Stand muessen atomar verhindert werden

Warum zuerst nur Free Agents:

- es gibt aktuell kein Prisma-`TransferListing`-Modell
- Free Agents sind bereits klar als `Player` ohne `ActivePlayer` im aktuellen `saveId + seasonId`-Scope definierbar
- Listings, Packages und Verkaeufe waeren ein separater spaeterer Komplexitaetsblock

## 2. Input

Geplanter spaeterer Service-Input:

- `saveId`
- `seasonId`
- `teamId`
- `playerId`
- `contractLength` optional
- `dryRun` optional

Empfohlene Defaults:

- `contractLength` default `1`
- `dryRun` default `true` fuer Smoke-/Preview-Pfade

## 3. Blockierende Validierungen

Vor einem spaeteren Write muessen diese Checks serverseitig **blockierend** sein:

- Save existiert
- Season existiert und gehoert zum Save
- `TeamSeasonState` existiert fuer `saveId + seasonId + teamId`
- Team existiert
- Player existiert
- `PlayerAttribute` existiert
- Player ist im aktuellen `saveId + seasonId`-Scope wirklich Free Agent
- Team hat Kaderplatz
- Team hat genug Cash
- `marketValue` ist vorhanden
- `salaryDemand` ist vorhanden
- kein `ActivePlayer`-Duplikat im aktuellen Scope
- kein Cross-Save- oder Cross-Season-Fehler

Was als blockierend zaehlt:

- fehlender Player
- fehlender Teamzustand
- fehlender Cash
- fehlender Marktwert
- fehlendes Salary
- Spieler ist bereits aktiv im Scope
- Kaderlimit wuerde ueberschritten

## 4. Preis- und Salary-MVP-Policy

Empfohlene MVP-Policy:

- `purchasePrice = PlayerAttribute.marketValue`
- `salary = PlayerAttribute.salaryDemand`
- `upkeep = PlayerAttribute.salaryDemand`
- wenn `salaryDemand` fehlt: **Kauf blockieren**
- wenn `marketValue` fehlt: **Kauf blockieren**
- `contractLength` default `1`, solange keine Fit-/AI-/Vertragslogik aktiv ist
- `currentValue` beim Einstieg gleich `marketValue`
- `purchasePrice` wird im neuen `ActivePlayer` mitgeschrieben
- `joinedSeasonId = seasonId`

Diese Policy ist absichtlich schlicht:

- keine Preisgenerierung
- keine Rabatt-/Aufschlaglogik
- keine AI-/Fit-basierte Vertragslaenge
- keine Sonderregeln fuer Stars oder Billigspieler

## 5. Erlaubte Writes spaeter

Der spaetere Buy-Service darf nur innerhalb **einer** DB-Transaktion in diese Bereiche schreiben:

- `ActivePlayer` create
- `Transfer` create
- `TeamSeasonState` update

Konkrete beabsichtigte Effekte:

- neuer `ActivePlayer` fuer das kaufende Team
- `Transfer`-Eintrag fuer den Kauf
- `TeamSeasonState.cash` wird reduziert
- `TeamSeasonState.budget` bleibt vorerst unveraendert, solange keine separate Budget-Policy beschlossen ist
- es gibt aktuell **kein** eigenes Salary-/Upkeep-Summenfeld auf `TeamSeasonState`; Salary- und Roster-Folgen werden daher im MVP aus `ActivePlayer` abgeleitet und nicht als separates Aggregat persistiert
- kein weiteres Tabellen- oder Season-Progress-Write

Optional spaeter:

- eigener `TransferAuditLog`
- oder anderer Audit-Pfad fuer Revisionssicherheit

## 6. Nicht erlaubt

Nicht Teil des ersten Buy-Service-MVP:

- keine AI
- keine automatische Package-Logik
- keine Standings-/Fame-/Cash-Schreibpfade ausser dem direkten Kauf in `TeamSeasonState`
- keine SQLite-Writes
- keine Result-Writes
- keine Preisgenerierung
- keine Verkaeufe
- keine Vertragsverlaengerungen
- keine Auto-Buys

## 7. Dry-run Strategie

Der Buy-Service soll vor einem spaeteren Write einen Dry-run bzw. eine Preview liefern koennen.

Empfohlener Preview-Output:

- `cashBefore`
- `cashAfter`
- `salaryBefore`
- `salaryAfter`
- `rosterBefore`
- `rosterAfter`
- `purchasePrice`
- `salary`
- `validationWarnings`
- `blockingReasons`

Wichtige Regel:

- `dryRun` fuehrt niemals Writes aus
- `dryRun` darf aber alle Validierungen und Berechnungen vollstaendig auswerten

## 8. Smoke-Test-Plan

Empfohlener spaeterer Smoke-Pfad:

- `transfermarkt:smoke-buy` default = dry-run
- `--write` schreibt wirklich
- kein Write ohne explizites Flag
- nach Write:
  - Free-Agent-Read erneut pruefen
  - Teamkader erneut pruefen
  - Readiness erneut pruefen

Ausgabe im Dry-run:

- `teamId` / `teamName`
- `playerId` / `playerName`
- `rosterBefore` / `rosterAfter`
- `cashBefore` / `cashAfter`
- `salaryBefore` / `salaryAfter`
- `purchasePrice`
- `salary`
- `canBuy`
- `blockingReasons`

Zusatzregeln:

- kein `force` im ersten MVP
- kein Rollback-Feature ausserhalb der DB-Transaktion
- keine Massentransfers

## 9. Open Questions

Weiter offen fuer spaetere Bloecke:

- Soll `contractLength` spaeter aus Fit oder Teamprofil berechnet werden?
- Soll es einen Transfer-Lock in derselben Season geben?
- Brauchen wir einen dedizierten `TransferAuditLog`?
- Sollen Free Agents dauerhaft sichtbar bleiben oder spaeter in ein Listing-Modell uebergehen?
- Soll `budget` spaeter neben `cash` ebenfalls geprueft oder veraendert werden?

## Kurzfazit fuer die Implementierungspaeter

Der erste sichere Buy-Service-MVP soll nur diesen Pfad erlauben:

1. Free Agent validieren
2. Cash und Kaderplatz pruefen
3. Preis und Salary 1:1 aus `PlayerAttribute` uebernehmen
4. in einer Transaktion schreiben:
   - `ActivePlayer`
   - `Transfer`
   - `TeamSeasonState.cash`
5. Dry-run zuerst, echter Write nur explizit
