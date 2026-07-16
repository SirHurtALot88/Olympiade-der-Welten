# Save Backup Policy V1

Diese Regel schuetzt Spielstaende waehrend Entwicklung, Deploys und Tests.

## Save-Kategorien

- `manual`: wichtige manuelle Saves, niemals automatisch loeschen
- `autosave`: automatische Ruecksprungpunkte, pro Bereich letzte 5 behalten
- `pre-deploy`: Sicherung vor Deploys, letzte 5 behalten
- `pre-season`: Sicherung vor Saisonstart/-uebergang, letzte 5 behalten
- `post-season`: Sicherung nach Saisonende, letzte 5 behalten
- `emergency`: Notfall-/Recovery-Save, erstmal behalten
- `recovery`: Restore-/Reparaturpunkt, erstmal behalten
- `legacy`: alte Saves ohne Kategorie, behalten bisherige 5er-Rotation pro Singleplayer/Multiplayer-Bereich

## Harte Regel

`manual` wird nie von Autosave-Rotation geloescht. Deploys duerfen keine Saves loeschen.

## Was wird gesichert?

Das Save-Backup sichert die SQLite-Datenbank:

- Save-Liste
- aktiver Save
- Game-State-Tabellen
- Manifest mit Datum, Save-IDs, aktiver Save, Dateigroesse, App-Version und Git-Commit falls vorhanden

## Wann wird gesichert?

- vor jedem Deploy
- vor groesseren Upgrades
- vor riskanten Datenmigrationen
- optional taeglich in der Entwicklungsphase
- manuell vor langen Spielabenden

Command:

```sh
npm run backup:save
```

## Restore

Restore spielt ein Backup wieder ein und erstellt vorher immer eine Sicherheitskopie des aktuellen Zustands.

Command:

```sh
npm run restore:save -- backups/saves/<backup-ordner>
```

Restore bricht ab, wenn:

- der Backup-Pfad fehlt
- keine SQLite-Datei gefunden wird
- die Backup-Datenbank keinen lesbaren aktiven Save enthaelt
- die Sicherheitskopie des aktuellen Zustands fehlschlaegt

## Hetzner-Strategie

- Hetzner-Server-Backup aktivieren
- zusaetzlich `npm run backup:save` vor jedem Deploy
- wichtige Backups nicht nur im Docker-Volume liegen lassen
- bei spaeterem On-Demand-Betrieb vor dem Loeschen des Servers Save-Backup oder Snapshot erstellen

