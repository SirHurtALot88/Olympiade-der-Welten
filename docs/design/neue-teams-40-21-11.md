# Neue Teams für zwei 20er-Ligen: zehn Vorschläge (21.11.)

Status: **Vorschlag, nichts ist eingetragen.** Mockup `public/mockups/neue-teams-40-21-11.html`,
Daten im Quellformat `docs/design/neue-teams-40-21-11/vorschlag.json`, Aufnahmen im selben Ordner.

Anlass (Chris, 21.11.): 20 Teams je Liga statt 16, passend zu 20 Disziplinen, also 40 statt 32 Teams.
Gebraucht werden acht neue Teams; hier liegen zehn (acht Hauptvorschlag, zwei Reserve).

## 1. Kurzfassung

| Kürzel | Team | Idee in einem Satz | Achsen POW/SPE/MEN/SOC | Liga |
|---|---|---|---|---|
| L-L | Little Legends | Kleinvolk-Kollektiv aus Zwergen, Gnomen und Goblins: Kopf und Tempo statt Masse, breiter Kader. | 3 / 5 / 8 / 4 | 1 |
| T-H | Thunder Horde | Steppenhorde aus Orks und Tauren: rohe Kraft plus Clan-Treue, tiefer Kader, kein Tempo. | 11 / 0 / 2 / 7 | 2 |
| O-D | Obsidian Dragons | Drachendynastie mit dem größten Hort: wenige teure Schwergewichte, ungeduldiger Vorstand. | 10 / 2 / 7 / 1 | 1 |
| Q-Q | Quiet Quasars | Außenweltler-Schwarm aus Aliens, Voidborn und Mutanten: Kopf und Tempo, null Show. | 0 / 7 / 11 / 2 | 2 |
| J-J | Jolly Jesters | Wanderzirkus: Tricks, Tempo, Charme, offen für jede Herkunft, pleite und beliebt. | 2 / 5 / 3 / 10 | 2 |
| B-H | Broken Halos | Verstoßene Engel als Rebellen: Charisma und Einzelkönner, Dauerstreit mit dem Vorstand. | 6 / 2 / 4 / 8 | 2 |
| W-H | The Wild Hunt | Gilde der Monsterjäger: Tempo, Wahrnehmung, Präzision, kleiner abgeklärter Kader. | 5 / 8 / 6 / 1 | 1 |
| G-A | Grey Archivists | Chronisten-Orden ohne Magie: reine Kopfarbeit, beste Manieren, kaum Ehrgeiz. | 1 / 0 / 14 / 5 | 1 |
| H-H | Heavy Hitters (Reserve) | Showkampf-Promotion: Kraft plus Bühnenpräsenz, Diven und Fehden. | 8 / 3 / 0 / 9 | (1) |
| P-P | Peak Performers (Reserve) | Profisportler ohne Fantasy-Abkürzung: Training, Disziplin, Fairness. | 6 / 8 / 4 / 2 | (2) |

Die übrigen Ratings (Ehrgeiz, Finanzen, Vorstand, Harmonie, Manieren, Beliebtheit, Kooperation,
Kader min/opt, Startbudget) stehen im Mockup unter „Tabellen" und in `vorschlag.json`.

## 2. Was die Rechnung braucht und was geliefert ist

Der Team-Fit eines Spielers (`lib/market/transfermarkt-fit.ts`, `calculateTransfermarktFit`) ist

    Fit = Rassen-Fit (Matrix) + Summe Subklassen-Fit (Matrix) + 2 x Gesinnung + 0,8 x Traits

Rasse und Subklassen kommen aus `data/source/team-fit-matrix.json`. Gesinnung und Traits haben
**keine** Tabelle je Team: sie zählen, wie oft derselbe Token schon im Kader steht (Treffer = Anzahl,
kein Treffer = −1). Eine Trait- oder Klassen-Spalte in der Matrix gibt es nicht; Klassen und Traits
steuern die KI-Auswahl über das Strategieprofil (`preferredClasses`, `preferredTraits`,
`dislikedTraits`) und die Themenquote.

`vorschlag.json` enthält deshalb je Team:

| Block | Ziel beim Einbau | Format |
|---|---|---|
| `teams` | `data/source/teams.json` | exakt wie dort |
| `teamIdentities` | `data/source/team-identities.json` | exakt wie dort |
| `teamFitMatrix.races.rows` / `.subclasses.rows` | `data/source/team-fit-matrix.json` | exakt wie dort, Tokens unverändert |
| `seasonManagementRows` | `references/sheets/season-management.csv` | Spalten der CSV, mit Startbudget |
| `strategyProfiles` | `lib/foundation/team-strategy-profiles.ts` | Eingabe für `createProfile` |
| `themeTargets` | `lib/ai/team-theme-composition-service.ts` | `TeamThemeCompositionTarget` |
| `relationships` | `lib/rivalries/team-rivalries.ts` | nur Werte ungleich 0, Skala −5 bis +5 |

Zwei Formatdetails, die ich von den 32 übernommen habe: Die Rassen-Zeilen tragen 18 der 20 Tokens
(ohne Undead und Cyborg), die Subklassen-Zeilen 54 der 58 (ohne Humanoid, Demonic, Tauren, Aquatic);
`sum` ist bei Rassen die Zeilensumme, bei Subklassen `null`. Der Wertebereich ist real −20 bis +5,
nicht −10 bis +5.

`cash` und `budget` in `teams.json` sind auch bei den 32 nur eine Platzhalter-Reihe; das Spielbudget
kommt aus dem Startbudget der CSV (siehe `docs/design/liga-split-plan.md`, Fund 1).

## 3. Designlogik: welche Lücken die zehn füllen

**Achsen.** Jedes der 32 Teams verteilt genau 20 Punkte auf POW, SPE, MEN, SOC. Die Summen sind
ungleich: POW 162, SPE 171, MEN 145, SOC 162. MEN ist klar unterbesetzt. Die acht Hauptvorschläge
sind so verteilt (POW 38, SPE 29, MEN 55, SOC 38), dass jede Achse über 40 Teams auf **200** kommt.

**Rassen.** Wie viele der 32 Teams eine Rasse mit +4 oder +5 suchen: Human 11, Dragon 6, Gnom **0**,
Mutant **1**, Demon 2, Divine 2, Fish 2, Alien 2, Voidborn 3. Divine (162 Spieler) und Alien (132)
sind große Gruppen mit wenig Nachfrage. Daraus: Little Legends (Dwarf, Gnom, Goblin), Quiet Quasars
(Alien, Voidborn, Mutant), Broken Halos (Divine und Demon zugleich), Jolly Jesters (Mutant als
Attraktion), Thunder Horde (Orc, Tauren), Obsidian Dragons (Dragon, Lizard als Dynastie statt als
Beifang).

**Subklassen.** Bisher von fast niemandem gesucht: Fallen Angel (kein Team mit +4), Assassin,
Pirate, Amazoness, Ninja, Wraith (je eins), Alchemist, Wayfarer, Viking, Angel, Warrior (je zwei).
Die Vorschläge setzen Fallen Angel, Wraith (Broken Halos), Alchemist, Engineer (Little Legends,
Grey Archivists), Hunter, Scout (Wild Hunt), Strategist, Monk (Grey Archivists), Apparition,
Controller (Quiet Quasars) nach oben.

**Themen.** Abgeglichen gegen die 32 Strategieprofile: Endzeit, Elite, Bestien (zweimal), Bank,
Klingen, Succubi, Human-only, Engel, Dämonen, Untote (zweimal), Champions, Verführung, Natur, Ninjas,
Piraten, Melancholie, Fisch, Hof, Bots, Kreuzritter, Lehrer, Kirche, Riesen, Agenten, Amazonen,
Selbstjustiz, Wikinger, Magier, Söldner, Opportunisten. Neu sind Kleinvolk, Steppenhorde, Drachen,
Außenweltler, Zirkus, gefallene Engel, Monsterjäger, Chronisten, Showkampf, Profisport.

Nähe, die bleibt und die man kennen sollte:

| Neu | Am nächsten im Achsenraum | Warum trotzdem eigen |
|---|---|---|
| T-H | S-C (Abstand 4) | Kreuzritter sind Human/Dwarf mit Kirche; die Horde ist Orc/Tauren, schamanisch, ohne Maschinen. |
| O-D | W-L (Abstand 4) | Söldner ohne Heimat gegen Blutlinie; Finanzen und Kadergröße sind entgegengesetzt. |
| J-J | D-P (Abstand 4) | Beide SPE/SOC; D-P ist Dämonen-Verführung, J-J ist offen für alle Rassen und pleite. |
| B-H | G-G, T-C (Thema) | Dieselbe Rasse, entgegengesetzte Haltung: Fallen Angel +5, God −10, Cleric −5. |
| G-A | W-W (Abstand 8) | Beide MEN; W-W ist Magie (Mage, Warlock +5), G-A ausdrücklich nicht-magisch. |
| W-H | H-R (Abstand 4) | Nur die Achsen ähneln sich; Dämonen sind für die Jäger Beute (Demon −10). |

Abstand = Summe der Unterschiede über die vier Achsen.

## 4. Ausgewogenheits-Check

Summen und Schnitte der 32 gegen die 40 (32 plus acht Hauptvorschläge):

| Wert | Summe 32 | Summe 40 | Ø 32 | Ø der 8 neuen | Ø 40 |
|---|---:|---:|---:|---:|---:|
| POW | 162 | 200 | 5,06 | 4,75 | 5,00 |
| SPE | 171 | 200 | 5,34 | 3,62 | 5,00 |
| MEN | 145 | 200 | 4,53 | 6,88 | 5,00 |
| SOC | 162 | 200 | 5,06 | 4,75 | 5,00 |
| Ehrgeiz | 185,0 | 234,5 | 5,78 | 6,19 | 5,86 |
| Finanzen | 163,5 | 206,5 | 5,11 | 5,38 | 5,16 |
| Vorstand | 174,5 | 221,5 | 5,45 | 5,88 | 5,54 |
| Harmonie | 194,5 | 248,0 | 6,08 | 6,69 | 6,20 |
| Manieren | 147,0 | 188,0 | 4,59 | 5,12 | 4,70 |
| Beliebtheit | 163,0 | 208,0 | 5,09 | 5,62 | 5,20 |
| Kooperation | 181,5 | 229,0 | 5,67 | 5,94 | 5,72 |
| Kader min | 282 | 352 | 8,81 | 8,75 | 8,80 |
| Kader opt | 382 | 479 | 11,94 | 12,12 | 11,97 |

Die sieben Charakterwerte bewegen sich im Liga-Schnitt um höchstens 0,12 Punkte. Die Skalen (1 bis
10 in halben Schritten) und die Extreme der 32 bleiben: einzig Beliebtheit 9,5 (Jolly Jesters) liegt
einen halben Punkt über dem bisherigen Höchstwert 9.

**Fit-Zeilen.** Zeilensummen der 32: Rassen −335 bis +20 (Median −33), Subklassen −154 bis +29
(Median −18,5). Die zehn liegen bei Rassen zwischen −63 und +17, bei Subklassen zwischen −27 und +15.

**Finden die Teams genug Spieler?** Gerechnet über alle 2984 Spieler des Pools, nur der Matrix-Teil
des Fits (Rasse plus Subklassen):

| Team | Spieler mit Fit über 0 | ab 5 | ab 10 |
|---|---:|---:|---:|
| Bestehende 32: kleinster / Median / größter Wert | 705 / 1376 / 2057 | 288 / 642 / 1105 | 4 / 169 / 502 |
| L-L | 1576 | 704 | 123 |
| T-H | 1113 | 601 | 194 |
| O-D | 970 | 362 | 41 |
| Q-Q | 944 | 396 | 70 |
| J-J | 2188 | 1310 | 321 |
| B-H | 1749 | 862 | 183 |
| W-H | 1553 | 1033 | 280 |
| G-A | 1741 | 1007 | 191 |
| H-H (Reserve) | 2001 | 1099 | 260 |
| P-P (Reserve) | 1386 | 896 | 289 |

Obsidian Dragons und Quiet Quasars sind bewusst wählerisch (48 Dragon, 94 Lizard; 132 Alien, 23
Mutant, 19 Voidborn im Pool), bleiben aber innerhalb der Spanne der 32. Jolly Jesters ist das
offenste Team der Liga und liegt knapp über dem bisherigen Höchstwert.

**Ligen.** Startbudget-Rang 1 bis 20 wäre Liga 1. Die neuen Startbudgets sind Zwischenwerte der
bestehenden Fünfer-Leiter (170 bis 325), damit M-M Rang 1 und R-R Schlusslicht bleiben (die
Invariante `start_rank_reference_mismatch` in `lib/game/new-game-setup-service.ts`):

- Liga 1: O-D 312, G-A 287, L-L 267, W-H 257 (zu den 16 Teams ab 250)
- Liga 2: B-H 242, T-H 222, Q-Q 207, J-J 177
- Reserve: H-H 272 (wäre Liga 1), P-P 232 (wäre Liga 2)

Die Spalte „Player" (C/F) steht bei den 32 bei 17 zu 15; die acht sind mit 3 C und 5 F so verteilt,
dass es 20 zu 20 wird. Rückt ein Reserve-Team nach, verschiebt das die Achsensummen um wenige Punkte
(H-H für B-H wäre fast neutral: POW +2, SPE +1, MEN −4, SOC +1).

## 5. Was sich bei 40 Teams sonst ändern müsste (nur Liste)

Nicht Teil dieses Vorschlags. Ältere Überlegungen zur Ligagröße:
`docs/design/liga-split-plan.md` (2×16, Rangraum, Konstanten `TEAM_COUNT_TOTAL` und `LEAGUE_SIZE`)
und `docs/design/battle-mode-20-spieltage-liga-mechanik-16-10.md` (20 Spieltage, Doppel-Rundenplan,
simulierte Liga 2).

1. **Spieler und Figuren.** Acht Teams brauchen Kader. Der Pool reicht rechnerisch (2984 Spieler,
   rund 480 Kaderplätze), aber die Zuordnung `data/source/player-team-mapping.json` und die
   Startkader müssen erweitert werden. **Neue PixelLab-Figuren und Animationen sind gesperrt, bis
   Chris sie für genau diesen Fall freigibt**; ohne Freigabe laufen neue Teams mit den vorhandenen
   Figuren und der Marke „Spieler ohne Figur".
2. **Wappen.** Die 32 haben Bilder unter `public/team-logos/`. Die Embleme im Mockup sind reine
   SVG-Zeichen und nur eine Idee; echte Wappen wären Requisiten-Bestellungen.
3. **Liga-Größe.** `LEAGUE_SIZE` 16 → 20, Auf- und Abstieg, Tabellen, Rangleisten, Perzentile,
   Sponsor-Leiter (Sockel nach Startrang, Topf nach Endrang), Vorstandsziele.
4. **Spielplan.** 19 Gegner je Liga statt 15; 20 Spieltage decken dann ziemlich genau eine einfache
   Runde ab. Pods (Battlefield, Mini-DM-FFA, Bahn-Pod) brauchen bei 20 Teams fünf Vierer-Pods.
5. **Draft.** Reihenfolge für 40, rund 80 Picks mehr, Laufzeit der KI-Picks, Draft-Brett.
6. **Markt und Finanzen.** Startbudget-Leiter (Zwischenwerte oder neu staffeln), Apron-Linien am
   Liga-Median, Gehaltsniveau bei dünnerer Spitze.
7. **Daten je Team.** Beziehungs-Tabelle (40×40, bisher 32×32), Strategieprofile, Themenquoten,
   General Manager, Sponsoren.
8. **Messläufe.** Alle Abnahmen mit „32 KI-Teams von Anfang an" werden zu 40; Laufzeit und
   Referenzdateien unter `data/generated/` ändern sich.
9. **UI.** Jede Seite, die 16 oder 32 Zeilen ohne Scrollen zeigt (Tabelle, Liga-Vergleich,
   Draft-Ergebnis), muss bei 2560×1440 und 1920×1080 neu geprüft werden.
10. **Spielstände.** Bestehende Saves haben 32 Teams; die Erweiterung braucht eine Lade-Migration
    oder gilt nur für neue Spiele.

## 6. Befunde am Rand (nicht behoben, nur gemeldet)

- **Fish gegen Aqua.** Die Matrix führt die Rasse als `Fish`, der Pool als `Aqua` (104 Spieler,
  ein einziger `Fish`). `normalizeMatrixToken` macht daraus keinen Treffer; die Fish-Spalte wirkt für
  diese Spieler nicht, sie fallen auf die Kader-Präsenz zurück. Betrifft auch Riptide Rivers.
- **Giant gegen Behemoth.** Die Matrix hat die Subklasse `Giant`, im Pool heißt sie `Behemoth` (161
  Spieler); `Giant` trägt kein Spieler. Die Giant-Werte (auch The Giants +5) treffen niemanden. Die
  −20 der Little Legends auf Giant wirkt erst, wenn das zusammengeführt ist.
- Ohne Matrix-Spalte sind außerdem `Creature` (19) und `Klasse` (5, offenbar ein Importrest).

## 7. Mockup-Abgleich

Aufnahmen bei 1920×1080 und 2560×1440 liegen unter `docs/design/neue-teams-40-21-11/`. Geprüft je
Ansicht: kein Seitenscroll, keine abgeschnittenen Karten oder Texte, alle Icons geladen. Inneres
Scrollen gibt es nur in zwei Tabellen (alle 42 Teams, 54 Subklassen), jeweils mit festem Kopf.

| Ansicht | Inhalt |
|---|---|
| Übersicht | zehn Karten, Filter Liga 1 / Liga 2 / Reserve, Achsen-Kompass und Geld × Ehrgeiz gegen die 32, Bilanz, Liga-Vorschlag |
| Team im Detail | Steckbrief, alle Ratings mit Rang gegen 40, Pick-Profil (Rassen, Subklassen, Klassen in Klassenfarbe mit Icon, Traits), komplette Fit-Zeile je Tabelle |
| Tabellen | Ratings aller 40 plus Reserve, Fit-Matrix Rassen, Fit-Matrix Subklassen; alles sortierbar |
| Kurz zusammengefasst | Zusammenfassung, die zehn auf einen Blick, Folgen und Befunde |
