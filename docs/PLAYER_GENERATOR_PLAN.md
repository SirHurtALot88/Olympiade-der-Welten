# Player Generator Plan

## Ziel von V2

Player Generator V2 baut auf dem lokalen Draft-Fundament auf und trennt jetzt sauber:

- Fantasy-Archetyp / Wesen
- Rollen-Silhouette
- allgemeines Staerkelevel
- Makro-Achsenbias
- Varianz

Der Block kann:

- Player-Drafts lokal erzeugen
- Drafts lokal speichern und wieder laden
- Attribute editierbar halten
- POW / SPE / MEN / SOC aus den 12 Attributen ableiten
- Disziwerte aus offizieller Gewichtungsmatrix ableiten
- transparente Klassenvorschlaege mit Begruendung liefern
- harte oder halbharte Archetyp-Constraints pruefen
- Rollen-Silhouetten validieren
- Anti-Flatness anwenden
- OVR als lokalen Draftwert zeigen
- PPs aus echten Generator-Disziwerten ableiten

## Was V2 bewusst nicht baut

- keine finale Marktwert-Engine
- keine finale Gehalts-Engine
- keine Player Progression
- keine Training-Logik
- keinen Free-Agent-Commit
- keine Aenderung bestehender Importspieler
- keine Prisma-Writes
- keine Migration

## Source of Truth

- Schreiben: `sqlite/local`
- Referenzmodus: `prisma` read-only
- Drafts liegen lokal unter `seasonState.playerGeneratorDrafts[]`
- `Draft speichern` schreibt nur diesen lokalen Draft-Speicherpfad
- ein Draft ist noch kein DB-Spieler und noch kein Free Agent
- bestehende Importspieler behalten bis zur finalen MW-/Gehalts-Umstellung ihre importierten `displayMarketValue`-/`displaySalary`-Werte als sichtbare Truth Source

## UI-Vertrag V1

Die Generator-UI zeigt bewusst einen `Player Draft Preview` statt eines scheinbar finalen Spielers.

- Draft: lokal
- DB: nicht gespeichert
- Free Agent: nein
- OVR: Draftwert
- PPs: Draftwert
- MW: `—`, solange die Marktwert-Engine fehlt
- Gehalt: `—`, solange die Salary-Engine fehlt

Die UI trennt sichtbar:

- Draft-Status
- finalen Spieler-Entwurf als Vorschau
- Attribute
- Achsen
- Disziwerte
- Economy-Blocker

Wichtig:

- Attribute, Achsen, OVR, PPs und Disziwerte werden ohne Nachkommastellen gezeigt
- MW/Gehalt bleiben ehrlich blockiert
- `Als Free Agent uebernehmen` bleibt deaktiviert, bis ein sicherer Insert-Pfad existiert

## Eingaben und Fachbedeutung

### `preferredArchetype`

`preferredArchetype` definiert die Fantasy-Identitaet oder das Wesen eines Entwurfs.
Der Wert beeinflusst:

- Race-Auswahl
- Class-Vorschlag
- bevorzugte Subclasses
- bevorzugte Traits
- Attribut-Biases
- Achsen-Biases
- harte oder halbharte Validierung

Ein gesetzter Archetyp darf nicht nur ein weicher Bonus sein.
Ein `undead`-Draft darf deshalb nicht still als `Dwarf Amazoness Healer` durchrutschen.

### `roleIntent`

`roleIntent` definiert die sportliche oder kampfbezogene Stat-Silhouette:

- `offense`
- `defense`
- `support`
- `allround`
- `specialist`
- `chaos`

Die Rolle steuert Peaks, Schwächen und Mindest-Spread.

### `strengthTier`

`strengthTier` setzt den groben Werte-Korridor:

- `very_weak`
- `weak`
- `normal`
- `strong`
- `elite`
- `legendary`

Dabei gilt:

- `very_weak` bleibt sichtbar schwach
- `legendary` darf sehr hoch werden, aber mit kontrollierten Schwaechen

### `axisIntent`

`axisIntent` ist jetzt optionaler Makro-Bias fuer `pow/spe/men/soc`.

Zulaessig pro Achse:

- `auto`
- `null`
- `1`
- `2`
- `3`
- `4`
- `5`

Default:

- alle vier Achsen stehen auf `auto`

Das bedeutet:

- Rolle + Archetyp formen zuerst das Profil
- User-Werte ueberschreiben nur gezielt einzelne Achsen
- `3/3/3/3` ist kein stiller Zwangsdefault mehr

Die UI zeigt danach transparent:

- `resolvedAxisIntent`
- Quelle je Achse:
  - `user`
  - `auto-role`
  - `auto-archetype`
  - `blended`

### `randomness`

`randomness` steuert die Varianz:

- `low`: eng am Profil
- `medium`: normale Varianz
- `high`: staerkere Ausreisser

Wichtig:

- hohe Varianz ist kein Freifahrtschein fuer Archetyp-Brueche

## Archetype-Constraint-System

V2 nutzt ein eigenes Constraint-Layer:

- `lib/player-generator/player-generator-archetypes.ts`

Jeder Archetyp kann definieren:

- bevorzugte Rassen
- erlaubte Rassen
- verbotene Rassen
- bevorzugte Klassen
- verbotene Klassen
- bevorzugte Subclasses
- bevorzugte positive Traits
- bevorzugte negative Traits
- Attribut-Biases
- Achsen-Biases
- Validierungsregeln

Beispiel `undead`:

- bevorzugt `Voidborn`, `Demon`, `Construct`
- verbietet u. a. `Dwarf`, `Divine`, `Animal`
- bevorzugt Subclasses wie `Undead`, `Vampire`, `Wraith`, `Apparition`, `Warlock`
- bevorzugt Klassen wie `Mage`, `Overseer`, `Templar`, `Tank`, `Tactician`

Wenn diese Signatur klar verfehlt wird:

- Warning oder
- `needs_edit` oder
- `blocked_archetype_conflict`

## Role Stat Silhouettes

V2 nutzt ein eigenes Rollenprofil-Layer:

- `lib/player-generator/player-generator-role-profiles.ts`

### Offense

- mindestens 2 klare Peaks
- hohe offensive oder explosive Werte
- Support-Werte duerfen sichtbar abfallen

### Defense

- Health / Stamina / Will / Determination tragen das Profil
- Mobilitaet oder Show duerfen niedriger sein

### Support

- Spirit / Charisma / Awareness / Will / Determination / Intelligence sind relevant
- mindestens 3 Support-Werte muessen sichtbar ueber Durchschnitt liegen
- Dark-Support erlaubt statt reinem Spirit mehr Intelligence / Awareness / Will

### Allround

- ausgeglichener
- aber nie komplett flach
- mindestens eine Staerke und eine Schwaeche bleiben sichtbar

### Specialist

- 2 bis 3 sehr hohe Werte
- mehrere klare Schwaechen
- hoher Spread

### Chaos

- extreme Staerken und Schwaechen
- hoher Spread
- Archetyp bleibt trotzdem bindend

## Anti-Flatness

V2 verhindert flache Durchschnittsprofile aktiv.

### Regeln

- `normal` und `strong`: Mindest-Spread typischerweise mindestens 20
- `elite` und `legendary`: mindestens 25
- `allround`: mindestens 12

Wenn zu viele Attribute in einem engen Band liegen:

- Peaks werden angehoben
- Dump-Stats werden gesenkt
- der Draft bekommt eine `too_flat_profile`-Warning
- der Validierungsstatus faellt auf `needs_edit`, wenn das Profil zu glatt bleibt

## Auto-Achsen / Profilableitung

Die Funktion `deriveAxisIntentFromProfile(input)` leitet Achsen aus:

- `roleIntent`
- `preferredArchetype`
- `strengthTier`
- `randomness`
- optional gesetzten User-Achsen

Beispiele im aktuellen Stand:

- `undead + support` -> `pow 2 / spe 2 / men 5 / soc 3`
- `beast + offense` -> `pow 5 / spe 4 / men 1 / soc 1`
- `construct + defense` -> `pow 3 / spe 2 / men 3 / soc 1`
- `angel + support` -> `pow 2 / spe 3 / men 4 / soc 5`

User-Werte schlagen Auto-Werte immer.

## Validierung

V2 validiert jeden Draft transparent:

- Archetyp getroffen?
- Rolle getroffen?
- Spread stark genug?
- Race/Class-Konflikt?
- bevorzugte Signatur sichtbar?
- Strength Tier plausibel?

Die UI zeigt dazu:

- `Archetype Match`
- `Role Match`
- `Stat Spread`
- `Peak Attributes`
- `Weak Attributes`

## Achsen und Disziwerte

### Achsen

Die Kernachsen werden aus den 12 Attributen gemittelt:

- `POW = power + health + stamina`
- `SPE = speed + dexterity + awareness`
- `MEN = intelligence + awareness + determination + will`
- `SOC = charisma + spirit + torment`

### Disziwerte

Disziwerte werden nur dann berechnet, wenn eine offizielle Gewichtungsmatrix vorliegt:

- `lib/player-generator/official-discipline-weights.ts`

Fehlende Gewichte bleiben Warning, nicht Fakewert.

## OVR / PPs / Potential

- `PPs`: Durchschnitt der berechneten Disziwerte
- `OVR`: lokaler Draftwert aus dem Mittel der Kernachsen, danach auf die reale 1-100-Spielerskala normalisiert
- `Potential`: bleibt bewusst `null`

Wichtig:

- OVR ist kein spaeteres Import- oder Balancing-Gold, aber die Anzeige folgt derselben 1-100-Skala wie die importierten Spieler
- MVS wird nicht erfunden

## Marktwert / Gehalt

Marktwert und Gehalt bleiben absichtlich offen:

- `marketValue = null`
- `salary = null`
- `marketValueStatus = missing_market_value_engine`
- `salaryStatus = missing_salary_engine`

Keine MW-/Gehalt-Heuristik wird in diesem Block geraten.

## Formula Source Gates

Aktuell bleiben zwei Gates bewusst offen:

- `references/formulas/rank-to-discipline-market-value.json`
- `references/formulas/class-factors.json`

Solange diese Dateien fehlen, gilt:

- MW bleibt blockiert / `null`
- Gehalt bleibt blockiert / `null`
- Klassenvorschlag bleibt heuristisch und wird als solcher markiert
- keine Ersatzkurve, keine Approximation, kein Fakewert

## Warum keine Fakewerte?

Die echte MW-/Gehaltslogik braucht weiterhin:

- Spieler-Ranks pro Diszi
- MW pro Diszi aus echtem Ranking
- Trait-/Vertragsfaktoren

Solange diese Engine nicht portiert ist, bleiben die Felder ehrlich offen.

## Nächster sinnvoller Block

1. Market Value Engine V1
2. Salary Engine V1
3. optional danach sicherer Draft -> Free-Agent-Insert mit explizitem Confirm
