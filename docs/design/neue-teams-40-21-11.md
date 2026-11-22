# Neue Teams für zwei 20er-Ligen: zehn Vorschläge (21.11., Runde 2)

Status: **Vorschlag, nichts ist eingetragen.** Mockup `public/mockups/neue-teams-40-21-11.html`,
Daten im Quellformat `docs/design/neue-teams-40-21-11/vorschlag.json`, Aufnahmen im selben Ordner.

Anlass (Chris, 21.11.): 20 Teams je Liga statt 16, passend zu 20 Disziplinen, also 40 statt 32 Teams.
Gebraucht werden acht neue Teams; hier liegen zehn (acht Hauptvorschlag, zwei Reserve).

**Korrektur von Chris zu Runde 1, wörtlich:** „achtung wichtig ist die teams die jetzt da sind würden in
liga 1 befördert werden und alle deine teams kämen in liga 2!" Runde 1 hatte vier neue Teams (O-D, G-A,
L-L, W-H) über das Startbudget in Liga 1 gesetzt. Das ist gestrichen: **alle neuen Teams spielen in Liga 2**
und sind auf Liga-2-Niveau kalibriert. Was sich gegenüber Runde 1 geändert hat, steht in Abschnitt 8.

## 1. Kurzfassung

**Ligaaufteilung (Vorschlag):**

- **Liga 1** = die 16 heutigen Liga-1-Teams + 4 Aufsteiger aus der heutigen Liga 2: **M-S, D-P, V-V, T-G**.
- **Liga 2** = die übrigen 12 heutigen Liga-2-Teams (L-K, R-C, C-C, T-C, S-C, P-C, D-L, U-A, B-B, V-W, A-A,
  R-R) + **alle 8 neuen Teams**. Die zwei Reserve-Teams sind ebenfalls für Liga 2 gebaut.

| Kürzel | Team | Idee in einem Satz | POW/SPE/MEN/SOC | Start­budget | Fin. | Ehrg. |
|---|---|---|---|---:|---:|---:|
| O-D | Obsidian Dragons | Verarmte Drachendynastie auf dem Rückweg: kleiner Kader um ein, zwei Schwergewichte, knappe Kasse, großer Anspruch. | 10 / 2 / 7 / 1 | 222 | 4 | 8,5 |
| G-A | Grey Archivists | Chronisten-Orden ohne Magie: reine Kopfarbeit, beste Manieren, kaum Ehrgeiz, kleine geordnete Kasse. | 1 / 0 / 14 / 5 | 212 | 6,5 | 2,5 |
| L-L | Little Legends | Kleinvolk-Kollektiv aus Zwergen, Gnomen und Goblins: Kopf und Tempo statt Masse, breiter Kader. | 3 / 5 / 8 / 4 | 207 | 5,5 | 7 |
| W-H | The Wild Hunt | Gilde der Monsterjäger: Tempo, Wahrnehmung, Präzision, kleiner abgeklärter Kader. | 5 / 8 / 6 / 1 | 202 | 5 | 6,5 |
| B-H | Broken Halos | Verstoßene Engel als Rebellen: Charisma und Einzelkönner, Dauerstreit mit dem Vorstand. | 6 / 2 / 4 / 8 | 197 | 4 | 8,5 |
| T-H | Thunder Horde | Steppenhorde aus Orks und Tauren: rohe Kraft plus Clan-Treue, tiefer Kader, kein Tempo. | 11 / 0 / 2 / 7 | 192 | 3 | 7,5 |
| Q-Q | Quiet Quasars | Außenweltler-Schwarm aus Aliens, Voidborn und Mutanten: Kopf und Tempo, null Show. | 0 / 7 / 11 / 2 | 187 | 5,5 | 4 |
| J-J | Jolly Jesters | Wanderzirkus: Tricks, Tempo, Charme, offen für jede Herkunft, pleite und beliebt. | 2 / 5 / 3 / 10 | 177 | 2,5 | 3,5 |
| H-H | Heavy Hitters (Reserve) | Showkampf-Promotion: Kraft plus Bühnenpräsenz, Diven und Fehden. | 8 / 3 / 0 / 9 | 217 | 5 | 8 |
| P-P | Peak Performers (Reserve) | Profisportler ohne Fantasy-Abkürzung: Training, Disziplin, Fairness. | 6 / 8 / 4 / 2 | 182 | 5 | 8,5 |

Die übrigen Ratings (Vorstand, Harmonie, Manieren, Beliebtheit, Kooperation, Kader min/opt) stehen im Mockup
unter „Tabellen" und in `vorschlag.json`.

## 2. Ligen: wer aufsteigt und warum

**Regel (Vorschlag, nicht entschieden): Liga 1 = Startbudget-Rang 1 bis 20.** Das ist dieselbe Regel, nach
der die Ligen heute geteilt sind (Rang 1 bis 16, `leagueLocalRankByTeamId` in
`lib/game/new-game-setup-service.ts`), nur vier Plätze länger. Aufsteiger sind damit die vier
budgetstärksten Teams der heutigen Liga 2:

| Startrang | Team | Startbudget | POW/SPE/MEN/SOC |
|---:|---|---:|---|
| 17 | M-S Mortal Sin | 245 | 0 / 0 / 0 / 20 |
| 18 | D-P Death Peaches | 240 | 1 / 7 / 2 / 10 |
| 19 | V-V Vigorous Vikings | 235 | 8 / 8 / 1 / 3 |
| 20 | T-G The Giants | 230 | 16 / 2 / 2 / 0 |

Alle neuen Startbudgets liegen unter 230 (177 bis 222). Kein neues Team kann über das Budget in Liga 1
rutschen; in Liga 2 bleibt L-K (225) Spitze und R-R (170) Schlusslicht.

Warum diese Regel: Sie braucht keine neue Logik und keine Messung, und sie gleicht die Ligen nebenbei aus
(Abschnitt 4): Liga 1 ist heute kopflastig (MEN-Summe 94, SOC 61), Liga 2 umgekehrt (MEN 51, SOC 101). Die
vier Aufsteiger bringen SOC und POW nach oben, die acht neuen bringen MEN nach unten.

**Alternativen:**

1. **Kaderstärke** (beste 6) nach einem Referenz-Draft mit 32 KI-Teams: sportlicher begründet, braucht aber
   einen Messlauf und hängt am Draft-Zufall.
2. **Endtabelle der Liga 2** aus der letzten gespielten Saison: echter Aufstieg, funktioniert aber nur als
   Migration eines laufenden Spielstands, nicht für ein neues Spiel.
3. **Von Hand:** Chris nennt die vier.

Wer mit M-S, D-P, V-V oder T-G in Liga 2 bleiben soll, tauscht einzelne Teams; die neuen Teams sind davon
unabhängig.

## 3. Kalibrierung auf Liga-2-Niveau

Maßstab ist die **heutige Liga 2** (16 Teams). Jeder Wert der zehn liegt in deren Spanne:

| Wert | Heutige Liga 2: Spanne (Ø) | Die zehn neuen |
|---|---|---|
| Startbudget | 170–245 (207,5) | 177–222, Ø der acht 199,5 |
| Finanzen | 1–10 (5,25) | 2,5–6,5, Ø der acht 4,50 |
| Ehrgeiz | 2–8,5 (5,50) | 2,5–8,5, Ø der acht 6,00 |
| Vorstand | 1–10 (5,44) | 2–9,5 |
| Beliebtheit | 1–9 (5,47) | 2–9 |
| Kader min / opt | 7–11 / 11–14 | 7–10 / 11–14 |

Zwei Werte liegen bewusst außerhalb der Liga-2-Spanne, heben aber kein Team über das Niveau: Manieren 9,5
der Grey Archivists (Liga 2 heute höchstens 8,5, Liga 1 hat 10) und MEN 11 bzw. 14 bei Quiet Quasars und
Grey Archivists (Liga 2 heute höchstens 8). Genau diese Kopf-Teams fehlen der Liga 2.

Einen eigenen „Kaderwert" gibt es in den Quelldaten nicht: Der Kaderwert-Rahmen folgt aus Startbudget und
Wunsch-Kadergröße. Mit 177 bis 222 Startbudget und 11 bis 14 Wunschplätzen liegen alle zehn im Rahmen der
heutigen Liga 2.

**Lore, die sich dafür geändert hat:** Die Obsidian Dragons waren in Runde 1 der reichste Hort der Liga
(Finanzen 9, Startbudget 312). Jetzt sind sie eine verarmte Dynastie: Der Hort ist verpfändet, verprasst, an
Zwerge verloren, geblieben sind Stolz, Blutlinie und der Anspruch (Finanzen 4, Ehrgeiz 8,5). Die KI-Vorgaben
im Strategieprofil sind mitgezogen (cashPriority 3 → 6, wageSensitivity 2 → 6, starPriority 10 → 8). Die
Grey Archivists haben statt einer „soliden" eine „kleine, aber geordnete" Kasse. Alle anderen Ideen passten
schon zu einem Liga-2-Team.

## 4. Ausgewogenheits-Check je Liga

Vorher = die heutigen 16er-Ligen, nachher = die 20er-Ligen des Vorschlags.

| Wert | Liga 1 heute (16) | Liga 1 neu (20) | Liga 2 heute (16) | Liga 2 neu (20) |
|---|---:|---:|---:|---:|
| POW Summe / Ø | 80 / 5,00 | 105 / 5,25 | 82 / 5,12 | 95 / 4,75 |
| SPE Summe / Ø | 85 / 5,31 | 102 / 5,10 | 86 / 5,38 | 98 / 4,90 |
| MEN Summe / Ø | 94 / 5,88 | 99 / 4,95 | 51 / 3,19 | 101 / 5,05 |
| SOC Summe / Ø | 61 / 3,81 | 94 / 4,70 | 101 / 6,31 | 106 / 5,30 |
| Ehrgeiz Ø | 6,06 | 5,97 | 5,50 | 5,67 |
| Finanzen Ø | 4,97 | 4,70 | 5,25 | 5,28 |
| Vorstand Ø | 5,47 | 5,72 | 5,44 | 5,35 |
| Harmonie Ø | 5,66 | 6,10 | 6,50 | 6,30 |
| Manieren Ø | 4,84 | 4,83 | 4,34 | 4,58 |
| Beliebtheit Ø | 4,72 | 4,78 | 5,47 | 5,55 |
| Kooperation Ø | 5,78 | 5,67 | 5,56 | 5,78 |
| Kader min Ø | 8,56 | 8,55 | 9,06 | 9,05 |
| Kader opt Ø | 11,56 | 11,65 | 12,31 | 12,30 |
| Startbudget Ø | 287,5 | 277,5 | 207,5 | 198,3 |
| Startbudget Spanne | 250–325 | 230–325 | 170–245 | 170–225 |
| Gruppe C : F | 9 : 7 | 11 : 9 | 8 : 8 | 9 : 11 |
| Rassen ohne Sucher (von 18) | 2 (Aqua, Gnom) | 2 (Aqua, Gnom) | 3 (Mutant, Voidborn, Gnom) | 0 |
| Subklassen ohne Sucher (von 54) | 7 | 5 (Wayfarer, Pirate, Lord, Royalty, Fallen Angel) | 8 | 0 |

„Ohne Sucher" heißt: kein Team der Liga führt den Token mit +4 oder +5.

Was die Tabelle sagt:

- **Achsen.** Ausgeglichen wäre Ø 5,00 je Achse. Heute liegt die größte Abweichung bei 1,81 (MEN in Liga 2),
  danach bei 0,30 (SOC in beiden Ligen). Über alle 40 bleibt jede Achse bei genau **200**.
- **Charakterwerte.** Kein Liga-Schnitt bewegt sich um mehr als 0,44 (Harmonie Liga 1, durch die Aufsteiger
  M-S und D-P); die Liga 2 bewegt sich um höchstens 0,24.
- **Budget.** Beide Schnitte sinken um rund 10, weil Liga 1 vier Teams von unten bekommt und Liga 2 ihre vier
  reichsten abgibt. Der Abstand zwischen den Ligen bleibt (80 heute, 79 neu).
- **Gruppen C/F.** 20 zu 20 über alle 40; je Liga 11 : 9 und 9 : 11.
- **Abdeckung.** In der neuen Liga 2 hat jede Rasse und jede Subklasse mindestens ein Team, das sie sucht.
  Dafür sind vier Fit-Werte um einen Punkt angehoben (Abschnitt 8). Die Lücken der Liga 1 (Aqua, Gnom und
  fünf Subklassen) sind Lücken der heutigen 32 und mit neuen Liga-2-Teams nicht zu schließen: Riptide Rivers
  (Aqua) bleibt in Liga 2, Gnom sucht bisher kein einziges Team.

Über alle 40 (zur Kontrolle, wie in Runde 1):

| Wert | Summe 32 | Summe 40 | Ø 32 | Ø der 8 neuen | Ø 40 |
|---|---:|---:|---:|---:|---:|
| POW | 162 | 200 | 5,06 | 4,75 | 5,00 |
| SPE | 171 | 200 | 5,34 | 3,62 | 5,00 |
| MEN | 145 | 200 | 4,53 | 6,88 | 5,00 |
| SOC | 162 | 200 | 5,06 | 4,75 | 5,00 |
| Ehrgeiz | 185,0 | 233,0 | 5,78 | 6,00 | 5,83 |
| Finanzen | 163,5 | 199,5 | 5,11 | 4,50 | 4,99 |
| Vorstand | 174,5 | 221,5 | 5,45 | 5,88 | 5,54 |
| Harmonie | 194,5 | 248,0 | 6,08 | 6,69 | 6,20 |
| Manieren | 147,0 | 188,0 | 4,59 | 5,12 | 4,70 |
| Beliebtheit | 163,0 | 206,5 | 5,09 | 5,44 | 5,16 |
| Kooperation | 181,5 | 229,0 | 5,67 | 5,94 | 5,72 |
| Kader min | 282 | 352 | 8,81 | 8,75 | 8,80 |
| Kader opt | 382 | 479 | 11,94 | 12,12 | 11,97 |

**Fit-Zeilen.** Zeilensummen der 32: Rassen −335 bis +20 (Median −33), Subklassen −154 bis +29
(Median −18,5). Die zehn liegen bei Rassen zwischen −63 und +17, bei Subklassen zwischen −27 und +16.

**Finden die Teams genug Spieler?** Gerechnet über alle 2984 Spieler des Pools, nur der Matrix-Teil des Fits
(Rasse plus Subklassen), jetzt mit Aqua und Behemoth wie in PR #1674:

| Team | Spieler mit Fit über 0 | ab 5 | ab 10 |
|---|---:|---:|---:|
| Bestehende 32: kleinster / Median / größter Wert | 726 / 1385 / 2023 | 352 / 651 / 1092 | 4 / 181 / 493 |
| L-L | 1474 | 659 | 121 |
| T-H | 1103 | 592 | 203 |
| O-D | 1029 | 392 | 46 |
| Q-Q | 942 | 404 | 70 |
| J-J | 2232 | 1360 | 336 |
| B-H | 1726 | 890 | 212 |
| W-H | 1511 | 1016 | 288 |
| G-A | 1694 | 962 | 189 |
| H-H (Reserve) | 2027 | 1148 | 306 |
| P-P (Reserve) | 1411 | 911 | 292 |

Obsidian Dragons und Quiet Quasars sind bewusst wählerisch, bleiben aber innerhalb der Spanne der 32. Jolly
Jesters (und die Reserve Heavy Hitters) sind offener als jedes bestehende Team: J-J liegt mit 1360 ein
Viertel über dem bisherigen Höchstwert 1092 (Cash Creators). Das ist als „nimmt jeden" gewollt, sollte aber
beim Einbau gegen die Themenquote geprüft werden.

## 5. Was die Rechnung braucht und was geliefert ist

Der Team-Fit eines Spielers (`lib/market/transfermarkt-fit.ts`, `calculateTransfermarktFit`) ist

    Fit = Rassen-Fit (Matrix) + Summe Subklassen-Fit (Matrix) + 2 x Gesinnung + 0,8 x Traits

Rasse und Subklassen kommen aus `data/source/team-fit-matrix.json`. Gesinnung und Traits haben **keine**
Tabelle je Team: sie zählen, wie oft derselbe Token schon im Kader steht. Klassen und Traits steuern die
KI-Auswahl über das Strategieprofil und die Themenquote.

`vorschlag.json` enthält deshalb je Team:

| Block | Ziel beim Einbau | Format |
|---|---|---|
| `meta.ligaVorschlag` | (nur Vorschlag) | Regel, Aufsteiger, beide Ligen als Listen, Alternativen |
| `teams` | `data/source/teams.json` | exakt wie dort |
| `teamIdentities` | `data/source/team-identities.json` | exakt wie dort |
| `teamFitMatrix.races.rows` / `.subclasses.rows` | `data/source/team-fit-matrix.json` | exakt wie dort; Rasse **Aqua** wie seit PR #1674 |
| `seasonManagementRows` | `references/sheets/season-management.csv` | Spalten der CSV, mit Startbudget |
| `strategyProfiles` | `lib/foundation/team-strategy-profiles.ts` | Eingabe für `createProfile` |
| `themeTargets` | `lib/ai/team-theme-composition-service.ts` | `TeamThemeCompositionTarget` |
| `relationships` | `lib/rivalries/team-rivalries.ts` | nur Werte ungleich 0, Skala −5 bis +5 |

Formatdetails wie bei den 32: Die Rassen-Zeilen tragen 18 der 20 Tokens (ohne Undead und Cyborg), die
Subklassen-Zeilen 54 der 58 (ohne Humanoid, Demonic, Tauren, Aquatic); `sum` ist bei Rassen die
Zeilensumme, bei Subklassen `null`. Der Wertebereich ist real −20 bis +5. `cash` und `budget` in
`teams.json` sind auch bei den 32 nur eine Platzhalter-Reihe; das Spielbudget kommt aus dem Startbudget der
CSV (`docs/design/liga-split-plan.md`, Fund 1). Der Themen-Tag `Fish` in `themeTargets` bleibt, weil der
Themen-Dienst ihn so führt; nur der Rassen-Token heißt Aqua.

## 6. Designlogik: welche Lücken die zehn füllen

**Achsen.** Jedes der 32 Teams verteilt genau 20 Punkte auf POW, SPE, MEN, SOC. Die Summen sind ungleich:
POW 162, SPE 171, MEN 145, SOC 162. Die acht Hauptvorschläge (POW 38, SPE 29, MEN 55, SOC 38) bringen jede
Achse auf 200, und sie tun es dort, wo es fehlt: MEN fehlt in der Liga 2.

**Rassen.** Wie viele der 32 Teams eine Rasse mit +4 oder +5 suchen: Human 11, Dragon 6, Gnom **0**,
Mutant **1**, Demon 2, Divine 2, Aqua 2, Alien 2, Voidborn 3. Daraus: Little Legends (Dwarf, Gnom, Goblin),
Quiet Quasars (Alien, Voidborn, Mutant), Broken Halos (Divine und Demon zugleich), Jolly Jesters (Mutant
als Attraktion), Thunder Horde (Orc, Tauren), Obsidian Dragons (Dragon, Lizard).

**Subklassen.** Bisher von fast niemandem gesucht: Fallen Angel (kein Team mit +4), Assassin, Pirate,
Amazoness, Ninja, Wraith (je eins), Alchemist, Wayfarer, Viking, Angel, Warrior (je zwei). Die Vorschläge
setzen Fallen Angel, Wraith (Broken Halos), Alchemist, Engineer (Little Legends, Grey Archivists), Hunter,
Scout (Wild Hunt), Strategist, Monk (Grey Archivists), Apparition, Controller (Quiet Quasars) nach oben.

**Themen.** Neu gegenüber den 32 Strategieprofilen: Kleinvolk, Steppenhorde, Drachen, Außenweltler, Zirkus,
gefallene Engel, Monsterjäger, Chronisten, Showkampf, Profisport.

Nähe, die bleibt und die man kennen sollte:

| Neu | Am nächsten im Achsenraum | Warum trotzdem eigen |
|---|---|---|
| T-H | S-C (Abstand 4) | Kreuzritter sind Human/Dwarf mit Kirche; die Horde ist Orc/Tauren, schamanisch, ohne Maschinen. Beide in Liga 2. |
| O-D | W-L (Abstand 4) | Söldner ohne Heimat gegen Blutlinie; W-L spielt in Liga 1. |
| J-J | D-P (Abstand 4) | Beide SPE/SOC; D-P ist Dämonen-Verführung und steigt auf, J-J ist offen für alle Rassen und pleite. |
| B-H | G-G, T-C (Thema) | Dieselbe Rasse, entgegengesetzte Haltung: Fallen Angel +5, God −10, Cleric −5. T-C ist Liga-2-Rivale. |
| G-A | W-W (Abstand 8) | Beide MEN; W-W ist Magie und Liga 1, G-A ausdrücklich nicht-magisch. |
| W-H | H-R (Abstand 4) | Nur die Achsen ähneln sich; Dämonen sind für die Jäger Beute (Demon −10). |

Abstand = Summe der Unterschiede über die vier Achsen.

## 7. Was sich bei 40 Teams sonst ändern müsste (nur Liste)

Nicht Teil dieses Vorschlags. Ältere Überlegungen zur Ligagröße: `docs/design/liga-split-plan.md` und
`docs/design/battle-mode-20-spieltage-liga-mechanik-16-10.md`.

1. **Spieler und Figuren.** Acht Teams brauchen Kader. Der Pool reicht rechnerisch (2984 Spieler, rund 480
   Kaderplätze), aber `data/source/player-team-mapping.json` und die Startkader müssen erweitert werden.
   **Neue PixelLab-Figuren und Animationen sind gesperrt, bis Chris sie für genau diesen Fall freigibt**;
   ohne Freigabe laufen neue Teams mit den vorhandenen Figuren und der Marke „Spieler ohne Figur".
2. **Wappen.** Die Embleme im Mockup sind reine SVG-Zeichen und nur eine Idee; echte Wappen wären
   Requisiten-Bestellungen.
3. **Liga-Größe.** `LEAGUE_SIZE` 16 → 20, `TEAM_COUNT_TOTAL` 32 → 40, Auf- und Abstieg, Tabellen,
   Rangleisten, Perzentile, Sponsor-Leiter, Vorstandsziele. Die Prüfung `start_rank_reference_mismatch`
   erwartet R-R auf Rang 32 und müsste auf 40 gehen.
4. **Spielplan.** 19 Gegner je Liga statt 15; Pods brauchen bei 20 Teams fünf Vierer-Pods.
5. **Draft.** Reihenfolge für 40, rund 80 Picks mehr, Laufzeit der KI-Picks, Draft-Brett.
6. **Markt und Finanzen.** Startbudget-Leiter (Zwischenwerte oder neu staffeln), Apron-Linien am
   Liga-Median, Gehaltsniveau bei dünnerer Spitze.
7. **Daten je Team.** Beziehungs-Tabelle (40×40), Strategieprofile, Themenquoten, General Manager,
   Sponsoren.
8. **Messläufe.** Alle Abnahmen mit „32 KI-Teams von Anfang an" werden zu 40.
9. **UI.** Jede Seite, die 16 oder 32 Zeilen ohne Scrollen zeigt, muss bei 2560×1440 und 1920×1080 neu
   geprüft werden.
10. **Spielstände.** Bestehende Saves haben 32 Teams und eine Liga-Zuordnung; die Erweiterung braucht eine
    Lade-Migration (dort wäre die Endtabelle als Aufstiegsregel möglich) oder gilt nur für neue Spiele.

## 8. Änderungen gegenüber Runde 1

**Ligen.** Alle neuen Teams in Liga 2 (vorher vier in Liga 1). Neu: Aufstiegsregel mit vier Aufsteigern und
Alternativen, Check je Liga statt nur über 40.

**Werte.**

| Team | Startbudget | Sonst |
|---|---|---|
| O-D | 312 → 222 | Finanzen 9 → 4, Ehrgeiz 9,5 → 8,5, Beliebtheit 6,5 → 5,5; Lore, Spielidee, Kaufstil und Strategieprofil neu (verarmte Dynastie) |
| G-A | 287 → 212 | Finanzen 7,5 → 6,5; „solide Kasse" → „kleine, aber geordnete Kasse" |
| L-L | 267 → 207 | Finanzen 6,5 → 5,5 |
| W-H | 257 → 202 | |
| B-H | 242 → 197 | Ehrgeiz 9 → 8,5 (Höchstwert der heutigen Liga 2) |
| T-H | 222 → 192 | |
| Q-Q | 207 → 187 | |
| J-J | 177 | Beliebtheit 9,5 → 9 (Höchstwert der 32) |
| H-H (Reserve) | 272 → 217 | Finanzen 6 → 5 |
| P-P (Reserve) | 232 → 182 | |

Achsen, Kadergrößen, Gruppen, Klassen, Traits, Beziehungen, Themenquoten: unverändert.

**Fit-Werte.** Vier Werte um je einen Punkt angehoben, damit die neue Liga 2 keine Rasse und keine
Subklasse ohne Sucher hat (die bisherigen Sucher steigen auf): Broken Halos Demon +3 → +4 und Succubus
+3 → +4, The Wild Hunt Assassin +3 → +4, Jolly Jesters Ninja +3 → +4.

**Befunde aus Runde 1, behoben mit PR #1674:**

- **Fish = Aqua.** Die Matrix heißt jetzt selbst `Aqua` (Chris: „fish = aqua"), der Sheet-Abgleich
  übersetzt. `vorschlag.json`, Mockup und alle Pool-Zahlen sind umgestellt (105 Spieler).
- **Giant = Behemoth.** Die Matrix behält `Giant`; `Behemoth` (161 Spieler in
  `data/generated/oly-player-stats.json`) wird beim Nachschlagen auf Giant übersetzt. Die Giant-Werte greifen
  damit, auch die −20 der Little Legends. Die Pool-Zahlen in Abschnitt 4 rechnen mit beiden Übersetzungen
  und weichen deshalb auch für die 32 von Runde 1 ab.

Weiter ohne Matrix-Spalte sind `Creature` (19 Spieler) und `Klasse` (5, offenbar ein Importrest).

**Mockup.** Neuer Reiter „Ligen" (zwei Liga-Tabellen, Aufsteiger und neue Teams markiert, Check je Liga,
Aufstiegsregel); Liga-Listen in der Übersicht; Team-Ratings gegen die heutige Liga 2 (Ø, Spanne, Rang in der
Liga groß, gegen alle 40 klein). Im Achsen-Kompass und in der Geldkarte suchen sich die Kürzel jetzt einen
freien Platz (mit Führungsstrich, wenn sie weiter weg müssen), Teams auf demselben Punkt rücken auseinander;
das P-P-Kürzel steht nicht mehr auf seinem Punkt.

## 9. Mockup-Abgleich

Aufnahmen bei 1920×1080 und 2560×1440 liegen unter `docs/design/neue-teams-40-21-11/`. Geprüft je Ansicht
(am Bild und per Skript): kein Seitenscroll, keine abgeschnittenen Karten, Namen oder Texte, alle Icons
geladen. Inneres Scrollen gibt es nur in drei Tabellen (alle 42 Teams, 54 Subklassen im Team-Detail,
Heatmap mit den 32), jeweils mit festem Kopf.

| Ansicht | Datei | Inhalt |
|---|---|---|
| Übersicht | `uebersicht-*`, `uebersicht-geld-*` | zehn Karten mit Startbudget, Achsen-Kompass und Geld × Ehrgeiz gegen die 32 (Liga 1 grau, Aufsteiger grüner Ring, Liga 2 blau), neue Ligaaufteilung als zwei Listen |
| Ligen | `ligen-*` | Liga 1 und Liga 2 als sortierbare Tabellen, Aufsteiger und neue Teams markiert, Check je Liga heute gegen neu, Aufstiegsregel mit Alternativen |
| Team im Detail | `team-*` | Steckbrief, alle Ratings mit Ø und Spanne der heutigen Liga 2, Rang in Liga 2 und gegen 40, Pick-Profil (Klassen in Klassenfarbe mit Icon), komplette Fit-Zeile |
| Tabellen | `tabellen-*` | Ratings aller 40 plus Reserve mit Liga neu und heute, Fit-Matrix Rassen, Fit-Matrix Subklassen; alles sortierbar |
| Kurz zusammengefasst | `kurz-*` | Zusammenfassung, die zehn auf einen Blick, Folgen und Erledigtes |
