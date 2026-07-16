# Golden Master Fixtures

Diese Fixtures sind die bewusst festgehaltene Referenzwahrheit aus Retool oder aus einem spaeter dagegen geprueften App-Output.

## Grundregel
- Retool gilt hier als Golden Master.
- Neue TypeScript-Logik fuer Saisonstand, Punkte, Cash, Preisgeld oder Matchday-Resultate darf erst als "gleichwertig" gelten, wenn sie gegen diese Fixtures diffbar ist.

## Wichtige Vorsicht
- Fixtures niemals automatisch ueberschreiben.
- Snapshot-Updates nur bewusst, nachvollziehbar und mit dokumentierter Quelle.
- Volatile Felder wie Timestamps duerfen nur gezielt ueber Ignore-Regeln ausgenommen werden.

## Struktur
- `standings/`
- `matchday-results/`
- `economy/`
- `transfermarkt/`

## Empfohlener Ablauf
1. Retool-Output exportieren
2. Als Fixture ablegen
3. App-Output separat erzeugen
4. Mit `golden:compare` diffen
5. Abweichungen erst erklaeren, dann fachlich portieren
