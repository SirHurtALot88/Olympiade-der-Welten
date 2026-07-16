# Auto Resolve Highlights And Visualization Plan

## Status

Die aktuellen Resolve-Highlight-Strukturen sind **nur read-only Preview-Daten**.

Es gibt aktuell:
- keine Persistenz
- keine Migration
- keine neuen Tabellen
- keine DB-Writes

Die Vorschau dient nur dazu, spaeter Top-Spieler, Highlight-Kandidaten, Visualisierung und Lore-Recap-Pfade ohne Datenmodellbruch anbinden zu koennen.

## Aktuelle Preview-Strukturen

Es werden read-only In-Memory-Outputs vorbereitet fuer:
- `PlayerPerformancePreview`
- `DisciplineHighlightCandidate`
- `DisciplineResolvePreview`

Diese Strukturen koennen spaeter genutzt werden fuer:
- Matchday-MVP / Top-10-Listen
- Disziplin-Visualisierung
- Lore-/Chronicle-Backlog
- Audio-/Hoerspiel-Backlog

## Was diese Preview bewusst noch nicht ist

- keine persistierte `discipline_results`
- keine persistierte `player_discipline_performances`
- keine persistierte `discipline_highlights`
- keine narrative Textgenerierung
- keine Faktenanreicherung ausserhalb der bereits berechneten Scores und Warnings

## Spaeter moegliche Persistenz-Tabellen

Wenn die Resolve-Logik produktiv wird, sind spaeter wahrscheinlich sinnvoll:
- `discipline_results`
- `player_discipline_performances`
- `discipline_highlights`

## Read-only Regel fuer den aktuellen Stand

Alle Highlight- und Performance-Daten bleiben aktuell:
- transient
- in-memory
- preview-only
- ohne Seiteneffekte
