# Ranks im neuen Stil (Mockup, 22.11.)

Schritt 1 des Ablaufs aus CLAUDE.md: Mockup und Erklärung. Gebaut wird erst nach „bau das“. Kein App-Code, kein PixelLab.

- Mockup: `public/mockups/ranks-modern-22-11.html`
- Schalter: `?sicht=teams|spieler`, `&mass=staerke|punkte`, `&zeige=rang|wert`, `&liga=eigene|andere|alle`,
  `&d=<disziplin-id>`, `&sel=<team>`, `&nebel=0`, `&kader=1`, `&still=1`

## 1. Kernidee

**Eine Rang-Matrix statt einer Liste.** Jedes Team steht in einer Zeile, jede Spalte ist ein Maß: Gesamt, die vier Bereiche
und alle zwanzig Disziplinen. Die Matrix lässt sich in zwei Lesarten umschalten: **Stärke** (was der Kader auf dem Papier
kann) und **Punkte** (was er daraus gemacht hat). Das Profil rechts stellt beide nebeneinander und zeigt, wo ein Team über
oder unter seiner Papierform spielt. Eine zweite Sicht ordnet die **Spieler** je Disziplin.

## 2. Was die Seite heute zeigt

`app/foundation/ranks-v2/FoundationRanksNewLook.tsx` (523 Zeilen, alter Stil) zeigt genau eine Sache: „PPs pro Bereich“ je
Team, also die Tabellenpunkte gesamt und nach POW, SPE, MEN, SOC, mit einem Umschalter für den Bereich, Kennzahlen
(Liga-Mittel, Median, Spannweite), einem aufklappbaren Radar und dem Podium der Vorsaison. Disziplinen kommen nicht vor,
Spieler auch nicht, die Kaderstärke ebenfalls nicht. Für die Frage „wo ist mein Team stark, wo schwach?“ muss man heute
zwischen Saisonstand, Teamprofil und Spielerliste springen.

## 3. Aufbau

### Sicht Teams

| Teil | Inhalt |
|---|---|
| Kopf | Reiter Teams und Spieler. Rechts die eigene Kaderstärke: Rang in der Liga, klein unter allen 32, darunter der Tabellenplatz. |
| Schalter | Stärke oder Punkte · Rang oder Wert · eigene Liga, andere Liga, alle 32 |
| Matrix | 16 Zeilen (oder 32), 25 Spalten. Kopf mit Disziplin-Icons, oben ein Strich in der Farbe des Bereichs. Zelle = Rang: Gold für Rang 1, grün für das beste Viertel, rot für das letzte. Jede Spalte ist per Klick sortierbar; die erste Spalte zeigt dann den Rang in dieser Spalte, klein den Rang unter allen 32. Eigenes Team hervorgehoben. |
| Profil (rechts) | Für die angeklickte Zeile: Gesamt und vier Bereiche mit Stärke-Rang → Punkte-Rang und der Differenz „Ertrag“. Darunter alle 20 Disziplinen, nach Stärke-Rang geordnet, mit Punkte-Rang und Ertrag. |

**Stärke** = Mittel der besten sechs Spieler des Kaders (Regel aus CLAUDE.md): gesamt aus dem Gesamtwert, je Bereich aus
dem Bereichswert, je Disziplin aus der Eignung. **Punkte** = Tabellenpunkte gesamt und je Bereich; je Disziplin die
Ergebnispunkte, also dieselbe Wertung wie die Disziplin-Medaillen (siehe `leaders-modern-22-11.md`).

Beispiel aus den echten Daten: Death Peaches sind in Basketball nach Stärke Rang 1, nach Punkten Rang 9 (Ertrag −8), in
Climbing nach Stärke Rang 3, nach Punkten Rang 1 (+2).

### Sicht Spieler

| Teil | Inhalt |
|---|---|
| Disziplin-Wahl | Leiste mit „Gesamt“ und den 20 Disziplin-Icons, nach Bereich gefärbt |
| Filter | Klassenfarbe (POW, SPE, MEN, SOC), alle oder mein Kader, Liga |
| Tabelle | Rang (Liga, klein unter allen), Spieler mit Porträt, **Klasse mit Icon in Klassenfarbe**, Rasse, Team, Gesamt, POW, SPE, MEN, SOC, Eignung in der gewählten Disziplin als Zahl und Balken, PP. Alle Spalten sortierbar. Verletzte tragen eine rote Marke. |
| Profil (rechts) | Porträt, Klasse, Rasse, Team; Bereiche mit Rang; alle 20 Disziplinen nach Eignung mit Rang und PP |

## 4. Scouting-Nebel

Regeln aus CLAUDE.md (Kader-&-Teams-Mockup Abschnitt 7a), hier angewandt:

- **Teams:** der Rang ist öffentlich (er mittelt nur die besten sechs), der Wert fremder Teams steht als feste 5er-Stufe
  („40–45“). Das eigene Team ist exakt.
- **Spieler:** fremde, ungescoutete Spieler zeigen feste 10er-Stufen („70–80“), nie „~Zahl“. Sortiert wird nach der Stufe,
  bei Gleichstand nach Name; der Rang ist der Rang der Stufe und wird geteilt. Der Balken zeigt die Stufe als schraffiertes
  Stück, nicht als Länge. Eigene Spieler sind exakt.
- **PP und Tabellenpunkte sind öffentlich**, dort gibt es keinen Nebel.
- Der Schalter „Nebel aus (Einstellung)“ in der Mockup-Leiste steht für die App-Einstellung, die den Fog of War ganz
  abschaltet.

Im Spielstand ist kein fremder Spieler gescoutet; die Stufe „beobachtet“ (5er) kommt im Mockup deshalb nicht vor, gilt aber
genauso.

## 5. Echte Daten

Live-Abbild, Spielstand `new-game-1795114260527-nzr0z9`, Saison 1, 11 gebuchte Spieltage: alle 32 Teams, 376 Kaderspieler
mit Klasse, Rasse, Gesamtwert, Bereichswerten und 20 Eignungen, PP je Spieler und Disziplin, Tabellenpunkte und
Ergebnispunkte je Team und Disziplin. Nichts ist erfunden. Die Stärke rechnet das Mockup selbst aus den Kaderwerten; die
App hat dafür eine eigene Funktion (`teamStrengthRankCaptures`), deren Zahlen leicht abweichen können.

## 6. Bilder

| Datei | Ansicht |
|---|---|
| `ranks-modern-22-11/ranks-teams-1920x1080.png`, `…-2560x1440.png`, `…-1710x1112.png` | Teams, Stärke, Rang |
| `ranks-modern-22-11/ranks-teams-punkte-2560x1440.png` | Teams, Punkte, Werte, Profil eines fremden Teams |
| `ranks-modern-22-11/ranks-spieler-1920x1080.png`, `…-2560x1440.png` | Spieler, Basketball, Nebel an |

Kein Seitenscroll. Die Matrix zeigt alle 16 Teams ohne Scrollen; bei „Alle 32“ und in der Spielerliste (195 Spieler in
Liga 2) rollt nur die Liste in ihrer Tafel.

## 7. Für den Bau

- Neue Komponente unter `app/foundation/ranks-v2/` mit eigenem CSS-Präfix; `FoundationRanksNewLook.tsx` und `.nl-ranks*`
  fliegen danach raus. Die Bausteine Tabelle, Zelle und Profil sind dieselben wie in Leaders.
- Eine Quelle für die Stärke: dieselbe Funktion wie Saisonstand, Startseite und Vorstandsziel („Kaderstärke erwartet Rang
  2/16“), sonst zeigen drei Seiten drei Ränge.
- Mehrspieler: eigenes Team aus `activeManagerTeamId`; der Nebel hängt am Scouting-Stand **dieses** Managers
  (`scoutIntelByTeamId`), nicht an einem festen Team.
- Sortieren und Filtern laufen über die sichtbaren Stufen, nie über die verdeckten Werte.

## 8. Offene Fragen

1. **Name der Seite.** „Ranks“ bleibt als Navigationspunkt? Inhaltlich ist es jetzt „Ränge: Stärke und Ertrag“.
2. **Stärke je Disziplin über die besten sechs oder über die Einsatzplätze der Disziplin** (Wettessen hat drei)? Das
   Mockup nimmt überall die besten sechs, wie die Regel sagt; das ist bewusst ungenau, damit es das Ergebnis nicht verrät.
3. **Podium der Vorsaison** (heute auf der Seite, wenn noch nichts gespielt ist): hierher oder auf die Historie-Seite?
   Empfehlung: Historie.

## 9. Bau (22.11., Freigabe: „die Mockups sehen gut aus, hast die Freigabe die umzusetzen“)

Gebaut ist `app/foundation/ranks-v2/RanksModern.tsx` (mit `ranks-modern.css`, Präfix `rk-`, Wurzel `bc rk`, Kopf aus dem Broadcast-Fundament
`BcHero`/`BcReiter`), gerechnet wird in `lib/foundation/ranks-modern.ts` (rein, ohne React). `FoundationRanksHost` reicht nur noch
`gameState`, das aktive Manager-Team (`activeManagerTeamId`), die Spieltags-Übersichten des Saisonstands und die zwei Sprünge (Teamprofil,
Spielerprofil) durch. Entfallen sind `FoundationRanksPanel`, `FoundationRanksNewLook`, die alte Matrix im Shell-Router (Achsen-Gruppen,
Farblegende, Heat-Stufen, Dein-Team-Chip) und ihre Wächter-Tests; `FoundationDiszisHost` (Spielplan der Disziplinen) bleibt unberührt.
Reine Leseseite: kein Schreibweg, keine Wertung angefasst (Fingerabdruck unverändert).

### Quellen

| Anzeige | Quelle |
|---|---|
| Stärke Team (Gesamt, Bereich, Disziplin) | `buildTeamDisciplineRankRowsFromGameState(…, "combined")`, dieselbe Funktion wie Startseite, Vorstandsziel und Einsatzliste; Summe der besten sechs je Disziplin, hier durch 6 geteilt. Gesamt und Bereich mitteln über die Disziplinen. |
| Punkte Team | Duellpunkte (Tabelle) aus `duellPunkteJeDisziplin` über die Spieltags-Übersichten des Saisonstands; je Disziplin die Summe der Ergebnispunkte (0 bis 10 je Begegnung, Vierergruppen: Platzpunkte). Ohne Duell-Spielplan (Alt-Spielstand) bleibt die Lesart leer und sagt es. |
| PP Spieler | Punkte-Ledger der Saison (`buildSeasonPointsLedger`), öffentlich. |
| Eignung, Bereiche, Gesamt Spieler | `player.disciplineRatings` (wie die Team-Rangfunktion), `coreStats`, `rating`. |
| Nebel | `getEffectiveScoutingLevel(gameState, aktivesTeam, spieler)`: Stufe 0 = 10er, 1 bis 4 = 5er, 5 = exakt; eigener Kader exakt; Einstellung `scenarioMeta.scoutingNebelAus` schaltet ihn ab. |

### Abweichung Mockup (Rang 2) gegen Capture (Rang 1)

Das Mockup rechnete die Stärke selbst: Mittel der besten sechs nach **Gesamtwert** der Spieler. Die App und der Capture
(`teamStrengthRankCaptures`) ranken nach der **Disziplin-Eignung** (zwanzig Mal die besten sechs, summiert). Beide sind „beste 6“, aber nicht
dieselbe Größe: Death Peaches sind in der Eignung Rang 1 in Liga 2 (13 von 32), nach Gesamtwert Rang 2. Gebaut ist die kanonische Zahl, damit
Ranks, Startseite, Vorstandsziel und Saisonstand denselben Rang nennen. Folge: Die Werte im Profil (Ges. 48,1 statt 43,2) und die Reihenfolge
der Spitze weichen vom Mockup ab, die Kopfzeile sagt „Rang 1 von 16 · 13/32“.

### Mockup gegen App: drin / angepasst / fehlt

| Mockup-Merkmal | Stand |
|---|---|
| Kopf mit Wappen, Titel, Reitern Teams/Spieler, Kaderstärke-Kachel rechts | drin (`BcHero`; Kulisse = PixelLab-Kulisse der Disziplin statt der alten `szenen`-Szene, wechselt mit der gewählten Disziplin) |
| Rang-Matrix 25 Spalten, Disziplin-Icons, Bereichsstrich, Gold/grün/rot | drin |
| Schalter Stärke/Punkte, Rang/Wert, Liga 2/Liga 1/Alle 32 | drin (Liga-Namen aus der eigenen Liga des aktiven Managers) |
| Sortierbare Spalten, erste Spalte = Rang der Sortierspalte, klein unter allen 32 | drin |
| Profil rechts: Papierform gegen Ertrag, 20 Disziplinen nach Stärke-Rang | drin |
| Spieler-Sicht: Disziplin-Leiste, Klassenfarbe-Filter, Alle/Mein Kader, Liga, Klasse mit Icon in Klassenfarbe, Eignung als Zahl und Balken, PP | drin |
| Verletzte Marke | drin (`playerAvailabilityState`) |
| Nebel: Teams 5er, Spieler 10er | angepasst: Spieler nach Wissensstufe (10er unbekannt, 5er beobachtet, exakt gescoutet); im Spielstand ist niemand fremdes gescoutet, sichtbar sind die 10er |
| Schalter „Nebel aus (Einstellung)“ in der Mockup-Leiste | angepasst: kein Schalter auf der Seite, es gilt die Spielstand-Einstellung |
| Teamprofil-/Spielerprofil-Sprung | neu (Knopf im Profil-Kopf, die alte Seite öffnete das Teamprofil per Klick auf die Zeile) |
| Podium der Vorsaison (alte Seite, Saisonstart) | fehlt hier bewusst: gehört auf die Historie-Seite (Offene Frage 3, Empfehlung Historie) |
| Alte Radar-/Medianchips der Vorseite | entfallen, ersetzt durch die Matrix |

### Nachbesserung 22.11. (Chris: „Ranks sind noch nicht so gut farblich in den Bereichen separiert“)

Alle Bereichsfarben kommen aus den vier Tokens `--rk-pow/spe/men/soc` (Klassenfarben der App); eine Klasse `a-<bereich>` setzt `--ac`, alles Getönte liest nur das.

| Stelle | Änderung |
|---|---|
| Rang-Matrix | Gruppenkopf über den Spalten („Gesamt und Bereiche“, POW Power, SPE Speed, MEN Mental, SOC Social) mit Tönung, Unterkante und Trenner; farbige Oberkante je Spalte; die Spalten Ges./POW/SPE/MEN/SOC tragen ihre Farbe als Schrift; Disziplin-Icons als Chip in Bereichsfarbe; Spalten laufen ohne Lücke und sind je Bereich getönt (9 %), 2 px Trenner zwischen den Bereichen, 3 px zwischen Bereichen und Disziplinen |
| Rang-Ampel | bleibt lesbar: neutrale Zellen dunkel, Gold unverändert, grün und rot mit Rand und etwas mehr Deckkraft |
| Profil (Team) | Bereichszeilen getönt mit Kante; die 20 Disziplinen **nach Bereich gruppiert** (senkrechtes Kürzel, Tönung), innerhalb nach Stärke-Rang |
| Profil (Spieler) | Bereichszeilen getönt; Disziplinzeilen mit Bereichskante und Icon-Chip (Reihenfolge nach Eignung bleibt) |
| Spieler-Sicht | Disziplin-Leiste in vier getönte Gruppen mit Kürzel; Spalten POW/SPE/MEN/SOC getönt, Werte in Bereichsfarbe |
| Kopf | doppelter Titel behoben: die Dachzeile trägt „Ranks · Saison · Spieltag“ (wie Saisonstand), der Titel ist das Team |

Abgleich (Bildpaare `ranks-modern-22-11/vergleich-<ansicht>-<größe>.png`, links Mockup, rechts App, Live-Abbild, Team D-P; 1920x1080, 2560x1440, 1710x1112, kein Seitenscroll):

| Mockup-Merkmal | Stand |
|---|---|
| Matrix, Disziplin-Icons, Bereichsstrich | drin, jetzt mit Gruppenkopf und Tönung (über das Mockup hinaus) |
| Titel „Ranks“ im Hero | angepasst: das Regieband der Shell nennt „Ranks“ bereits, der Hero trägt Team als Titel und „Ranks“ in der Dachzeile |
| Spitzenreihenfolge, Werte im Profil | angepasst (kanonische Stärke, siehe oben) |
| Mockup ohne Shell | die App steht in der Shell (Schiene, Regieband), die Matrix ist dadurch rund 10 % niedriger |
| Profil: Disziplinen nach Stärke-Rang sortiert | angepasst: nach Bereich gruppiert, innerhalb nach Stärke-Rang |
| Fehlt | nichts |
