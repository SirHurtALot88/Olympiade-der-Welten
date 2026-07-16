# SYSTEM_MAP Retool Reference

Diese Datei basiert auf dem von dir im Chat gelieferten Retool-Referenzblock.

Wichtiger Hinweis:
- Der zweite Block `SYSTEM_MAP.json` ist in der übermittelten Nachricht **nicht vollständig angekommen**
- die Nachricht bricht mitten im Objekt bei `pages -> Einsatz...` ab
- deshalb speichere ich hier bewusst **keine kaputte JSON-Datei**, sondern den sicheren Referenzhinweis

## Sicher angekommen

- Projektname: `Olympiade der Welten`
- Quelle: `Retool export (RSX + lib/*.js + lib/*.sql)`
- Intent: `Reference/prototype only; used to derive clean rebuild architecture and DB schema`
- genannte Hauptressourcen:
  - Retool Database
  - Olympiade Player Stats (Google Sheets)
  - Retool Storage
- genannte Seiten:
  - Saisonstand
  - Teams
  - Einsatzliste
  - Transfermarkt
  - Transferhistorie
  - Preisgeld
  - Spieler
  - Ranks
  - Diszis
  - Battle
  - Draft Mode
  - Draft Ranks
  - Allianz Spieltage
  - Einsatzliste Slots v2

## Empfehlung

Wenn du willst, schick mir den `SYSTEM_MAP.json`-Block noch einmal separat ab `{
  "project": ...` bis zur schließenden Klammer.

Dann speichere ich ihn dir direkt als echte:

- [SYSTEM_MAP.json](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/docs/SYSTEM_MAP.json)

ohne Verlust und ohne manuelle Nacharbeit.
