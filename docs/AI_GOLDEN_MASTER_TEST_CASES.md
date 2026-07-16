# AI Golden-Master Test Cases

## Ziel

Diese Datei definiert die **Testfall-Spezifikation** fuer einen spaeteren treuen Port der Retool-AI-/Needs-/Planner-Logik.

Sie ist bewusst noch **keine Testimplementierung**.
Sie soll vor dem eigentlichen Port klarmachen:
- welche Testfallarten wir brauchen
- welche Inputs pro Fall eingefroren werden muessen
- welche Outputs spaeter verglichen werden muessen
- welche Retool-Daten oder Ask-Mode-Antworten uns noch fehlen

## 1. Welche Testfallarten brauchen wir?

### 1. Needs fuer ein Team
Ziel:
- pruefen, ob die portierte Needs-Engine fuer ein konkretes Team fachlich dieselben Prioritaeten liefert wie Retool

Vergleichsobjekte:
- Top Needs
- Need Scores
- Need Labels / Need Types
- Reihenfolge der Needs
- Debug-/Reason-Fragmente

### 2. Simulate Picks fuer ein Team
Ziel:
- pruefen, ob sequentielle Pick-Entscheidungen bei gleichem Team, gleichem Seed und gleicher Kandidatenlage fachlich aehnlich ausfallen wie im Retool-Stand

Vergleichsobjekte:
- Pick vs Skip
- Reihenfolge der Picks
- Restbudgetentwicklung
- geaenderte Needs nach jedem Schritt
- Debug-/Reason-Fragmente

### 3. Package Scoring
Ziel:
- pruefen, ob Paket-Rankings und Score-Breakdowns aus `aiPackageScoringConfig` aehnlich bleiben

Vergleichsobjekte:
- Gesamtpunktzahl pro Paket
- Teilscore nach Kategorien
- Ranking mehrerer Pakete
- Overlap-/Need-/Similarity-Effekte

### 4. Cash Creator Sonderfall
Ziel:
- pruefen, ob `cashCreatorPackageScoringConfig` wirklich die spezielle Bewertungslogik fuer Cash-Creator-Teams treu abbildet

Vergleichsobjekte:
- Paket-Ranking fuer Cash-Creator-Team
- Effekte von Package-Groesse, Axis-Alignment, Resale, Flip, Holes
- Unterschiede gegen normale Teams

### 5. Player Exhaustion / Fatigue
Ziel:
- pruefen, ob `playerExhaustionMap` dieselben Multipliers liefert

Vergleichsobjekte:
- consecutive-use count
- multiplier pro Spieler
- Folgewirkung auf Auswahl-/Captain-/Scoring-nahe Entscheidungen, falls Retool das im jeweiligen Pfad nutzt

### 6. Team Identity Overrides
Ziel:
- pruefen, ob Team-spezifische Archetypen und Sonderregeln gleich interpretiert werden

Vergleichsobjekte:
- erkannter Archetyp
- abgeleitete Zielwerte
- Trait-/Roster-Praeferenzen
- abweichende Bewertung derselben Kandidaten je Teamidentitaet

### 7. Season Planner / Matchday Planning
Ziel:
- spaeter pruefen, ob Plan-/Captain-/Card-Entscheidungen aus dem Planner treu bleiben

Vergleichsobjekte:
- Spieltagsreihenfolge / Priorisierung
- Captain-Wahl
- Positive-/Negative-Card-Platzierung
- Planner-Notes / Warnings

## 2. Welche Inputs muessen pro Testfall gespeichert werden?

Jeder Golden-Master-Testfall sollte als Snapshot mindestens diese Felder enthalten.

### Team-Kontext
- `team`
- optional `teamCode`
- `teamIdentityOverride`, falls vorhanden
- `teamRatingsRow` oder aequivalente Identity-Achsen
- relevante Config-Versionen

### Roster / Kader
- aktive Spielerliste
- Spielerrollen / Traits, soweit relevant
- relevante Axis-/Core-Stats
- relevante Discipline-Scores
- Roster-Groesse

### Finanzkontext
- `cash`
- `budget`
- `salary / upkeep`
- `playerMin`
- `playerOpt`
- evtl. `rosterTarget`

### Markt- / Kandidatenkontext
- Kandidatenliste
- Paketliste oder Einzelspielerangebote
- Preise / Gebühren / Salary
- Kandidatenachsen / Covered Needs / Covered Disciplines

### Needs-/Diszi-Kontext
- vorhandene Needs-Snapshots, falls Retool sie schon ausgibt
- `disciplineRecipesGlobal`-relevante Daten
- Rankings / Coverage / hole severity, soweit vorhanden
- Team-Focus / Farben / Axis-Shares, soweit sichtbar

### Form- / Fatigue-Kontext
- letzte Einsaetze oder fertige `playerExhaustionMap`
- aktueller Spieltag / Saisonkontext
- falls relevant: Formkarten-Kontext

### Determinismus-Kontext
- `simSeed`
- Engine-Version
- Needs-Version
- Planner-Version
- Simulate-Version

## 3. Welche Outputs muessen verglichen werden?

### Needs-Faelle
- Need Type
- Need Label
- Importance Score
- Rank
- Search Profile / Profile-Fragmente
- Debug-/Reason-Felder
- Warnings

### Simulate-Picks-Faelle
- Pick / Skip pro Schritt
- Reihenfolge der Entscheidungen
- verbleibendes Budget
- geaenderter Sim-Roster
- `planned_picks`
- `needs_timeline`
- Debug-Notes

### Package-Scoring-Faelle
- Gesamt-Score
- Ranking aller Pakete
- Teilscore nach:
  - Need Coverage
  - Similarity
  - Identity Balance
  - Finance Posture
  - Cash Creator Sonderregeln
- Tiebreaker-Wirkung

### Fatigue-Faelle
- count pro Spieler
- multiplier pro Spieler
- daraus abgeleitete Auswahl- oder Score-Effekte, falls im Testfall enthalten

### Team-Identity-Faelle
- erkannter Archetyp
- daraus abgeleitete Roster-/Trait-Ziele
- Auswirkungen auf Ranking / Need Importance

### Vergleichsstrategie
Nicht alles sollte als exakte Gleichheit geprueft werden.

Empfohlen:
- exakte Gleichheit fuer:
  - diskrete Entscheidungen
  - Rankings
  - IDs / Labels
  - Multipliers / harte Caps
  - Konfigurationswerte
- Toleranzvergleich fuer:
  - Float-Scores
  - Summen mit kleineren Rundungsdifferenzen

## 4. Woher koennen Testfaelle kommen?

### A. Alte Retool-Debug-Ausgaben
Beste Quelle fuer Golden Master:
- echte Retool-Snapshots aus Textwidgets / Queries / Debug-Ausgaben
- besonders wertvoll:
  - `AI2_RunNeeds` Result
  - `AI2_06_SimulatePicks` Result
  - `ai2QuickDebugSnapshot`
  - `ai2QuickDebugTopPicksText`
  - `aiPreviewE2ETest`
  - `validateAiTeamNeedsThinRoster`

### B. Aktuelle JSON-Snippets
- gut fuer Konfigurations- und Algorithmusrekonstruktion
- schlecht fuer endgueltige Golden-Master-Outputs, wenn nur Code, aber kein Laufresultat vorhanden ist

### C. Manuell exportierte Retool Ask Mode Antworten
- sehr wichtig fuer spaetere Soll-Ausgaben
- ideal fuer konkrete Teams und Kandidatensets

### D. Kuenftige Snapshot-Dateien
Empfohlen spaeter:
- versionierte JSON-Snapshots mit:
  - inputs
  - outputs
  - engine versions
  - timestamp

## 5. Minimaler erster Golden-Master-Test

### Vorschlag
Ein erster echter Golden-Master-Test sollte **klein, deterministisch und reviewbar** sein.

#### Testfall: Package Ranking fuer ein Team
- `1` Team
- `3 bis 5` Kandidaten oder kleine Pakete
- feste `simSeed` / feste Config-Version
- klarer Team-Override, z. B. `Cash Creators` oder ein Team mit sichtbarem Override

#### Warum dieser Fall zuerst?
- kleiner als komplette Pick-Simulation
- weniger abhaengig von langen Pipelineketten
- nutzt trotzdem echte Kernlogik:
  - Identity
  - Need Coverage
  - Similarity
  - Finance
  - Cash-Creator-Sonderregeln

#### Erwartete Vergleiche
- erwartetes Ranking der 3 bis 5 Kandidaten / Pakete
- grobe Score-Reihenfolge
- erwartete Why-/Reason-Fragmente, z. B.:
  - "primary need hit"
  - "discipline hole"
  - "cash posture penalty"
  - "cash creator size bonus"
- keine harte exakte Float-Gleichheit
- stattdessen:
  - Reihenfolge muss stimmen
  - Scores duerfen nur innerhalb kleiner Toleranz abweichen

#### Minimaler Snapshot-Inhalt
- Team-Kontext
- Config-Versionen
- Kandidatenliste
- Need Snapshot
- erwartete Reihenfolge
- erwartete Score-Baender
- erwartete Reason-Fragmente

## 6. Welche Retool Ask Mode Fragen fehlen noch?

Wenn die JSON allein nicht genug echte Soll-Outputs liefert, sollten wir Retool gezielt nach folgenden Faellen fragen.

### Fuer Needs
1. "Zeige fuer Team X den kompletten Output von `AI2_03_Needs` bzw. `aiTeamNeedsQuery` inklusive Rank, need_type, need_label, importance_score, reason und search_profile."
2. "Zeige denselben Needs-Output fuer ein Team mit duennem Kader und fuer ein Team mit breitem Kader."

### Fuer Package Scoring
3. "Bewerte fuer Team X drei konkrete Kandidatenpakete und gib den kompletten Breakdown aus `aiPackageScoringConfig` zurueck."
4. "Bewerte denselben Satz fuer ein Cash-Creator-Team und gib den Einfluss von `cashCreatorPackageScoringConfig` aus."

### Fuer Simulate Picks
5. "Fuehre `AI2_RunNeeds` und `AI2_06_SimulatePicks` fuer Team X aus und exportiere `planned_picks`, `needs_timeline`, `debug`, `simSeed`, `plannerVersion` und `simulateVersion`."
6. "Liefere einen Lauf mit mindestens einem `skip`, damit das Skip-Verhalten als Golden Master pruefbar wird."

### Fuer Team Identity
7. "Zeige fuer Team X die wirksame `teamIdentityOverrides`-Interpretation inklusive abgeleiteter Roster-/Trait-/Contract-Ziele."
8. "Falls vorhanden: gib `teamIdentityWeights` fuer Team X explizit aus."

### Fuer Fatigue
9. "Zeige fuer Team X und Spieltag Y den Output von `playerExhaustionMap` fuer alle aktiven Spieler."
10. "Zeige einen Fall, in dem derselbe Spieler 1x, 2x, 3x und 4x hintereinander eingesetzt wurde."

### Fuer Planner
11. "Fuehre `seasonPlannerEngine` fuer Team X aus und gib Captain-, Positive- und Negative-Card-Entscheidungen mit Notes zurueck."
12. "Zeige einen Planner-Fall mit Near-Tie, damit seeded tie-breaking spaeter testbar wird."

## 7. Empfohlene Reihenfolge der Testfaelle

1. Konfigurations-Snapshots pruefen
- einfache Vollstaendigkeits- und Werttests

2. Fatigue-Testfall
- klein, deterministisch, klar

3. Team-Identity-Override-Testfall
- statisch, wenig bewegliche Teile

4. Package-Scoring-Testfall
- erster echter balancingsensibler Golden-Master-Fall

5. Needs-Testfall
- wenn Output aus Retool sauber exportiert vorliegt

6. Simulate-Picks-Testfall
- erst wenn alle Vorstufen sauber eingefroren sind

7. Season-Planner-Testfall
- spaeter, wegen hoher Komplexitaet

## 8. Fazit

Der kleinste erste echte Golden-Master-Test sollte **kein kompletter AI-Run** sein, sondern ein kleiner Paket- oder Needs-Fall mit festem Team und wenigen Kandidaten.

Die aktuell wichtigsten fehlenden Daten sind:
- echte Retool-Laufoutputs
- konkrete Needs-Snapshots
- konkrete Package-Score-Breakdowns
- konkrete Simulate-Picks-Laufresultate mit Seed und Debug
- klarere Outputs zu `teamIdentityWeights`, `rosterNeeds`, `rosterPressureProfile`

Ohne solche Outputs koennen wir Code zwar portieren, aber nicht belastbar gegen das alte Balancing verifizieren.
