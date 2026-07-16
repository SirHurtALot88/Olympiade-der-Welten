# Player Array Fields Policy

## Status

Die folgenden `Player`-Felder sind aktuell in Prisma als `Json` gespeichert:

- `subclasses`
- `traitsPositive`
- `traitsNegative`
- `preferredDisciplineIds`

Sie sind damit:

- keine nativen `String[]`-Spalten
- keine einfachen Strings
- keine serialisierten JSON-Strings als kanonische Fachquelle

Die App behandelt sie read-only als **Array-artige JSON-Felder** und normalisiert sie beim Lesen zu `string[]`.

## Source of Truth

Die kanonische Quelle bleiben die Originalfelder:

- `subclasses`
- `traitsPositive`
- `traitsNegative`
- `preferredDisciplineIds`

Diese Felder werden im Read-Pfad ueber `toStringArray(...)` sicher zu Arrays normalisiert.

## Flache Retool-kompatible Spalten

Fuer Tabellen und Filter werden daraus read-only flache Felder abgeleitet:

- `subclass1`
- `subclass2`
- `subclass3`
- `traitPos1`
- `traitPos2`
- `traitPos3`
- `traitNeg1`
- `traitNeg2`
- `traitNeg3`

Die Original-Arrays bleiben gleichzeitig im Response erhalten.

## Filterregel

Filter duerfen nicht ueber serialisierte JSON-Strings oder `JSON.stringify(...).includes(...)` laufen.

Stattdessen gilt:

- Subclass-Filter prueft `subclasses.includes(...)`
- Trait+-Filter prueft `traitsPositive.includes(...)`
- Trait--Filter prueft `traitsNegative.includes(...)`
- Preferred-Discipline-Filter prueft `preferredDisciplineIds.includes(...)`, falls verwendet

## Spaeter optional

Falls diese Filter spaeter direkt auf Datenbankebene skaliert werden muessen:

- optional JSONB-/GIN-Index pruefen
- aber erst bei echtem Performancebedarf

Bis dahin bleibt service-seitiges Array-Filtering der sichere Standard.
