# Saisonstand modern (Fable, 17.11.)

Anlass, Chris am 17.11.: „die Mockups sehen mega gut aus … die Einsatzliste ist der Hammer … dann
vielleicht mal für den Saisonstand, also die Tabelle, die wir haben, da auch so ein Mockup bauen.
Wenn wir so weitermachen mit den Mockups und du mir das erst zeigst, kann ich direkt sagen: finde
ich mega gut, bau das.“

Dies ist ein Entwurf. `components/`, `app/` und der Motor sind nicht angefasst, nichts ist
committet. Bei PixelLab ist nichts bestellt (0 Generationen): alles ist CSS und SVG. Das
Designsystem (Tokens, zwei Schriften, Schiene, Hero-Kopf, Tafel, Reiter, Marken, Blatt) ist
unverändert aus `einsatzliste-modern-17-11.html` und `oly-start-modern-17-11.html` übernommen;
Grundlage ist `docs/design/oly-seiten-modern-17-11.md`.

## Ansehen

| Was | Datei |
|---|---|
| Saisonstand, klickbar | `public/mockups/saisonstand-modern-17-11.html` |
| Bilder (doppelte Dichte) | `docs/design/saisonstand-modern-17-11/01` bis `20` |

Die Seite läuft per Doppelklick ohne Server, über den Dev-Server unter `/mockups/...`. Sie braucht
den Schriftordner `public/mockups/einsatzliste-modern-17-11/` und die beiden Vorlagen vom Branch
`claude/einsatzliste-modern-mockup-17-11` (die Schiene verlinkt dorthin). Die graue Leiste oben
gehört nicht zum UI, sie springt zwischen den Zuständen.

Adresse: `?szene=tabelle|teamkarte|liga1|gesamt|verein|matrix|kader|verlauf|punkte|spieltage|ansetzungen|bestenliste|start|ende`,
dazu `&liga=1|2|0`, `&st=0..20`, `&team=X-X`, `&wir=X-X`, `&still=1` (ohne Leiste), `&phone=1`,
`&blatt=kontext`. Tasten: `←` `→` Spieltag, `1` `2` `G` Liga, `T` `M` `V` `S` Ansicht, `Esc`.

| Bild | Zustand |
|---|---|
| `01-tabelle-liga2-showdown.png` | Liga 2 nach Spieltag 12, rechts der Showdown für Spieltag 13 |
| `02-teamkarte.png` | Klick auf Dire Legion: Teamkarte |
| `03-liga1.png` | Liga 1 mit Titel- und Abstiegszone, Teamkarte Nunchuck Ninjas |
| `04-gesamt-32.png` | Beide Ligen untereinander, Platz 1 bis 32 |
| `05-verein-finanzen.png` | Spaltensatz „Verein“: Kader, Marktwert, Cash, Sponsoren, Gehälter, GuV |
| `06-disziplin-matrix.png` | 16 Teams × 20 Disziplinen, Punkte als Heatmap |
| `07-matrix-kaderstaerke.png` | Dieselbe Matrix als Rang der Kaderstärke |
| `08-saisonverlauf-rang.png` | Rang über die Spieltage, eigenes Team gegen ein gewähltes |
| `09-saisonverlauf-punkte.png` | Punkte über die Spieltage |
| `10-spieltag-ergebnisse.png` | Ergebnisse eines Spieltags, acht Paarungen |
| `11-ansetzungen.png` | Nächster Spieltag mit Papierform je Disziplin |
| `12-bestenliste.png` | Matchwinner, Disziplin-Beste, Rekorde |
| `13-vor-spieltag-1.png` | Leerer Zustand vor dem ersten Spieltag |
| `14-saisonende.png` | Endstand mit Meister, Auf- und Absteigern |
| `15` bis `20-phone-*.png` | Phone 390 × 844 |

### Was echt ist und was nicht

Quelle des Echten ist das Live-Abbild vom 17.11. (`origin/live-save`), aktiver Save
`new-game-1793476611202-0dwpok` vom 31.10. Das ist derselbe Save wie im Bild
`fable-uiux-screenshots-14-11/04-saisonstand-dichte-tabelle.png`. Er steht vor Spieltag 1, es gibt
also noch kein einziges echtes Ergebnis.

| Echt | Erfunden |
|---|---|
| 32 Teams, Wappen, Liga-Zuordnung (`leagueByTeamId`), Startplätze | **Jedes Ergebnis.** Simulation: Kaderstärke der Disziplin plus Rauschen, fester Zufallsstart |
| Spielplan: alle 320 Paarungen (`seasonState.schedule`) | Daraus abgeleitet und damit ebenfalls erfunden: Punkte, S-U-N, Verhältnis, Form, Trend, Verlauf, Matchwinner, Rekorde |
| Disziplin-Plan: 20 Spieltage × 2 Disziplinen (`disciplineSchedule`) | Darstellung der Ergebnisse (Basketball 80 : 77, Fechten 15 : 11, sonst ein Wert mit einer Nachkommastelle) |
| Kader (367 Verträge), Spielernamen, Portraits, Klassen, Gesamtwerte, Disziplinwerte | „Papierform“ in Prozent: logistische Kurve über den Unterschied der Kaderstärke |
| Marktwert, Gehälter, Cash je Team (aus den Verträgen summiert; Marktwert stimmt auf die Nachkommastelle mit dem Bild vom 14.11.) | Zusammensetzung der Vierer-Pods (je zwei Paarungen des Spieltags); echt wäre `mini-dm-pod-schedule.ts` |
| Sponsoren und GuV: aus dem Bild vom 14.11. abgetippt | Die Marken „Franky“ (Nunchuck Ninjas) und „Rivale“ (Armageddon Aftermath) |
| „Kaderstärke“ je Disziplin: Mittel der vier besten Disziplinwerte im Kader | Die eigene Mannschaft: Vigilante Wranglers wie in den beiden anderen Mockups. Im echten Save führt Chris Nunchuck Ninjas; `?wir=N-N` zeigt die Seite aus dieser Sicht |

Die Geschichte des Zufallsstarts ist gewählt, nicht gefunden: Wranglers nach Spieltag 12 auf Platz 4
der Liga 2, einen Punkt hinter dem Aufstiegsplatz, am Ende Dritter.

---

## Teil 1: Der Saisonstand heute

Quellen: `app/foundation/season-v2/SeasonStandingsNewLook.tsx` (3589 Zeilen),
`SeasonStandingsV2Client.tsx` (Zeilentyp `SeasonV2StandingsRow`), `season-standings-new-look.css`
(955 Zeilen), `lib/season/league-split.ts`, `lib/standings/standings-bilanz.ts`,
`lib/foundation/build-field-race-ledger.ts`, `lib/foundation/season-matchday-fixtures-overview.ts`
und das Bild vom 14.11. Ein eigenes Bild der Live-Seite gibt es nicht, sie liegt hinter `/login`.

### Was die Seite kann

Sie hat vier Ansichten: „Daten“ (Standard), „Board“, „Vereine“ und, nur im Battle-Save,
„Spieltage“. Die Datenlage dahinter ist gut:

- Zwei Ligen zu je 16, drei Auf- und drei Absteiger (`LEAGUE_SIZE`, `RELEGATION_COUNT`), Rang
  liga-lokal 1 bis 16.
- Punkte je Disziplin (`disciplineValues`), 2/1/0 je Einsatz, Vierer-Pods 2/1/0/0.
- Bilanz S-U-N samt Pod-Platzierungen (`summiereSaisonBilanz`), Verhältnis als Tiebreaker.
- Rangbewegung zum Spieltag davor und Form der letzten fünf Spieltage (Feld-Rennen-Ledger).
- Titelrennen (`title-race.ts`), Paarungen und Pods je Spieltag (`buildSpieltagsUebersicht`).
- Hovers auf Team, Marktwert, Gehalt, Sponsoren, Transfers, Gebäude, GuV (Chris, 23.08.).
- Rekordbuch, Saison-Bestwerte, Top-Spieler, Historie je Saison.

### Was heute stört (belegt am Bild vom 14.11.)

1. **Die Tabelle beginnt bei 680 von 2000 Pixeln.** Davor stehen Statusleiste, Brotkrume, Knopf
   „Office öffnen“, Kopfkarte mit fünf Kennzahlen und der Kasten „Top-Spieler, noch zu vergeben“.
2. **19 Spalten, davon sieben Geldspalten.** In der Tabelle, die „Saisonstand“ heißt, nehmen
   Marktwert, Cash, Sponsoren, Gehälter, Gebäude, Transfers und GuV mehr Breite ein als Rang, Team
   und Punkte zusammen. Die sportliche Aussage steht in drei schmalen Spalten links.
3. **Vor Spieltag 1 besteht die Tabelle aus Strichen.** Punkte, Bonus, POW, SPE, MEN, SOC zeigen
   „—“, in 32 Zeilen. Der Hinweis dazu steht zwei Karten weiter oben.
4. **Zonen sind nicht zu sehen.** Aufstieg, Abstieg und Titel haben keine Farbe und keine Linie.
   Die Plätze 1 bis 3 tragen Medaillenringe, in Liga 1 wie in Liga 2, obwohl sie dort Verschiedenes
   bedeuten.
5. **Das eigene Team ist ein leicht helleres Blau.** Im Bild ist Zeile 12 kaum von Zeile 11 zu
   unterscheiden; auffälliger sind die roten „Rivale“-Marken.
6. **Kein Wappen in der Zeile.** Teamname rechtsbündig, Kürzel dahinter.
7. **Die 20 Disziplinen stecken hinter einem Aufklapp-Pfeil je Zeile.** Ein Vergleich zweier Teams
   über alle Disziplinen ist nicht möglich, ohne zwei Zeilen aufzuklappen.
8. **Kein Verlauf.** Die Rangbewegung gibt es als Zahl zum Vorspieltag, nicht als Linie über die
   Saison.
9. **Der nächste Spieltag fehlt.** Wer gegen wen um den Aufstieg spielt, steht nur im Modus
   „Spieltage“, ohne Bezug zur Tabelle.
10. **Mobil:** 19 Spalten in einer Tabelle; die Seitenleiste klappt nicht ein (Brainstorm 14.11.,
    Abschnitt 15).

---

## Teil 2: Der Entwurf

### Aufbau

```
┌──┬────────────────────────────────────────────────────────────────────────────────┐
│  │ Wappen  ‹ nach Spieltag 12 von 20 ›   ◢ Liga 1  38 ◣ ◢ Liga 2  4. ◣ ◢ Gesamt 20. ◣   ST 13 │ Hero-Kopf
│S │ Saisonstand · 1 Pkt hinter Aufstiegsplatz 3                              gegen Pirate Crew │
│c ├───────────────────────────────────────────────────────────┬────────────────────┤
│h │ TABELLE │ DISZIPLIN-MATRIX │ SAISONVERLAUF │ SPIELTAGE         │ Teamkarte│Showdown│Besten│
│i │ Liga 2 · Tabelle                          [Sport│Verein]   │                    │
│e │ #  ±  Team   S-U-N  Verh.  Form  Verlauf  POW SPE MEN SOC  │ Dein Spiel         │
│n │ 1. ─  Dire Legion ...                               31     │ zwei weitere       │
│e │ ...  (grün: Aufstieg, gestrichelte Linie nach Platz 3)     │ Paarungen          │
│  │ 4. ▲1 Vigilante Wranglers  DU                        28     │ Was auf dem Spiel  │
│64│ ...                                                        │ steht              │
│px│ Legende                                                    │                    │
└──┴───────────────────────────────────────────────────────────┴────────────────────┘
```

Bei 1600 × 900 stehen alle 16 Zeilen ohne Scrollen; „Gesamt“ scrollt in der Tafel.

### Entwurfsentscheidungen

1. **Die Tabelle steht ganz oben, sonst nichts.** Der Hero-Kopf trägt nur das, was für jede Ansicht
   gilt: Spieltag, Liga, die eigene Lage in einem Satz („1 Pkt hinter Aufstiegsplatz 3“) und den
   nächsten Gegner. Die erste Zeile beginnt bei rund 250 von 900 Pixeln.
2. **Liga als Reiter im Kopf.** Derselbe Baustein wie die Disziplin-Reiter der Einsatzliste. Jeder
   Reiter zeigt etwas Nützliches, auch wenn er nicht aktiv ist: den Führenden und seine Punkte,
   beim eigenen den eigenen Rang, bei „Gesamt“ den Platz unter 32. „Deine Liga“ ist markiert.
3. **„Stand nach Spieltag“ ist ein Regler, kein Zustand.** Die Pfeile im Kopf drehen die ganze Seite
   auf jeden Spieltag zurück: Tabelle, Matrix, Verlauf, Ergebnisse, Teamkarte. Vor Spieltag 1 und
   nach Spieltag 20 sind damit ganz normale Zustände derselben Seite, keine Sonderfälle.
4. **Zwei Spaltensätze statt 19 Spalten.** „Sport“ (Standard): Rang, Bewegung, Team, S-U-N,
   Verhältnis, Form, Verlauf, Punkte je Bereich, nächster Gegner, Abstand, Punkte. „Verein“: Kader,
   Stärke, Marktwert, Cash, Sponsoren, Gehälter, GuV, Punkte. Keine Geldspalte geht verloren; die
   bestehenden Hovers (Kader, GuV-Posten) hängen in der App an denselben Zellen.
5. **Zonen mit fester Farbe.** Gold = Titel (Liga 1, Platz 1), Grün = Aufstieg (Liga 2, Platz 1
   bis 3), Rot = Abstieg (Liga 1, Platz 14 bis 16): ein Streifen links, die Rangzahl in der Farbe,
   eine gestrichelte Linie an der Grenze. Dieselben Farben in Matrix und Verlauf. Am Saisonende
   werden daraus die Marken „Meister“, „Aufstieg“, „Abstieg“.
6. **Das eigene Team ist bernstein hinterlegt**, überall (Tabelle, Matrix, Verlauf, Paarung, Pod),
   mit der Marke „DU“. Von Franky gesteuerte Teams tragen eine türkise Marke, der Rivale eine
   umrandete (beides gibt es in der App schon: `isFrankyTeam`, Rivalen-Marke).
7. **Form und Verlauf in der Zeile.** Sechs Kästchen für die letzten sechs Einsätze (grün Sieg,
   grau Unentschieden, rot Niederlage) und eine kleine Ranglinie über die Saison. Damit sieht man
   ohne Klick, wer gerade kommt und wer fällt.
8. **Klick auf ein Team öffnet die Teamkarte rechts** (Phone: als Blatt von unten). Sie zeigt Rang,
   Punkte, Bilanz, Verhältnis, Trend; die vier besten Spieler mit Portrait; die 20 Disziplinen als
   Kacheln (Rang der Kaderstärke in der Liga, dazu geholte von möglichen Punkten, gold umrandet =
   am nächsten Spieltag); die letzten sechs Einsätze mit Gegner und Ergebnis; den nächsten
   Spieltag mit Papierform. Ein Klick auf einen Gegner springt zu dessen Karte.
9. **Disziplin-Matrix als eigene Ansicht.** Teams × 20 Disziplinen, gruppiert nach Power, Speed,
   Mental, Social. Farbe = Anteil der möglichen Punkte (rot keine, grau die Hälfte, grün alle),
   die Zahl steht in jeder Zelle, noch nicht Gespieltes ist ein Punkt. Klick auf einen
   Spaltenkopf sortiert nach dieser Disziplin und dimmt den Rest. Umschalter „Kaderstärke“ zeigt
   dieselbe Matrix als Rang 1 bis 16 in einem Goldton: so sieht man, wo ein Team auf dem Papier
   stark ist und trotzdem keine Punkte holt.
10. **Saisonverlauf als Linien.** Rang (oder Punkte) über die Spieltage, alle Teams grau, das eigene
    bernstein, ein gewähltes türkis; Zonen als Flächen dahinter; Namen und Wappen direkt am
    Linienende statt in einer Legende.
11. **Spieltage kompakt.** Je Paarung eine Karte: Gesamtpunkte groß, darunter je Disziplin eine
    Zeile mit Ergebnis und den vergebenen Punkten. Vierer-Pods stehen zusätzlich als vier kleine
    Tabellen. In „Gesamt“ steht Liga 1 links und Liga 2 rechts, wie von Chris für die heutige
    Ansicht gewünscht. Umschalter „Ansetzungen“ zeigt den nächsten Spieltag mit Papierform.
12. **Eigene Ideen für das Liga-Gefühl**, alle im rechten Kontext, damit die Tabelle frei bleibt:
    - **Showdown:** das eigene Spiel und die zwei engsten Paarungen des nächsten Spieltags, mit
      Marke („Spitzenspiel“, „Aufstiegsduell“, „Abstiegskampf“, „Kellerduell“, „Tabellennachbarn“).
    - **Was auf dem Spiel steht:** Abstand an Titel-, Aufstiegs- und Abstiegslinie, noch zu holende
      Punkte.
    - **Matchwinner:** das Gegenstück zur Torjägerliste. Gezählt wird, wie oft ein Spieler der beste
      seines Teams in einem gewonnenen Einsatz war.
    - **Disziplin-Beste** und **Rekorde** (deutlichster Sieg, längste Siegesserie, Spieltage mit
      vier Punkten).
13. **Phone:** eine Spalte, Schiene als Leiste unten. Die Tabelle zeigt Rang, Team, S-U-N, Form,
    Punkte; die Matrix scrollt quer mit festem Teamkürzel; der Verlauf zeigt Kürzel statt Namen;
    Teamkarte und Showdown kommen als Blatt.

### Was der Entwurf bewusst weglässt

„Board“ und „Vereine“ als eigene Ansichten (Board geht in Tabelle plus Verlauf auf, die
GM-Abschnitte gehören ins Teamprofil), der Kasten „Top-Spieler“ über der Tabelle (jetzt
Bestenliste), die Saisonauswahl für archivierte Saisons (Vorschlag: Überlaufmenü im Kopf), die
Spalten Bonuspunkte, Formkarten, Verletzungen, Transfers, Gebäude (Vorschlag: in „Verein“ ergänzen,
sobald die Breite geprüft ist).

### Schwächen des Prototyps

- Die Hausschrift zeichnet die Ziffer 1 wie ein I („Liga I“). In Überschriften mit Zahlen setzt der
  Entwurf die Zahl deshalb in Barlow; in den Liga-Reitern ist das noch nicht geschehen.
- „Disziplin-Beste“ sagt bis zur Rückrunde wenig, weil jede Disziplin erst einmal gespielt ist und
  viele Teams gleichauf bei 2 Punkten liegen.
- Die Papierform ist eine grobe Kurve; echte Werte müssten aus der Gegner-Schätzung von PR #1358
  kommen.
- In „Gesamt“ zeigt der Verlauf nur die Liga des gewählten Teams; 32 Linien wären nicht lesbar.
- Unentschieden sind in der Simulation selten, die Bilanzen wirken dadurch kantiger als im Spiel.

---

## Teil 3: Datenquellen und Aufwand

„vorhanden“ heißt: die Zahl liegt heute fertig in `SeasonV2StandingsRow` oder in einer benannten
Funktion. „neu“ heißt: es braucht eine neue Ableitung (reine Anzeige, keine Wertung).

| Element | Status | Quelle |
|---|---|---|
| Rang, Punkte, Liga, eigenes Team, Franky-Team | vorhanden | `rank`, `points`, `leagueTier`, `isSelected`, `isFrankyTeam` |
| Zonen Titel, Aufstieg, Abstieg | vorhanden | `LEAGUE_SIZE`, `RELEGATION_COUNT`, `computeLeagueMovement` |
| Bewegung zum Vorspieltag | vorhanden | `fieldRaceRankDelta` |
| S-U-N, Pod-Platzierungen | vorhanden | `summiereSaisonBilanz` |
| Verhältnis | vorhanden | `verhaeltnis` |
| Form | teils | Ledger liefert Tagespunkte je Spieltag; je Einsatz (zwei je Spieltag) neu aus `disciplineResults` |
| Ranglinie, Saisonverlauf | teils | `FieldRaceLedgerEntry.cumulativeRank` und `cumulativePoints` je Spieltag. Zu prüfen: der Ledger ordnet bei Gleichstand alphabetisch, die Tabelle nach Verhältnis; und ob sein Rang liga-lokal ist |
| Punkte je Disziplin, je Bereich | vorhanden | `disciplineValues`, `SEASON_DISCIPLINE_AREA_GROUPS` |
| Abstand, Lagesatz, „Was auf dem Spiel steht“ | neu, klein | aus Rang und Punkten; Titelrennen: `buildTitleRace` |
| Nächster Gegner, Ansetzungen | vorhanden | `seasonState.schedule`, `disciplineSchedule` |
| Ergebnisse je Spieltag, Pods | vorhanden | `buildSpieltagsUebersicht` (lazy je Spieltag, so lassen) |
| „Stand nach Spieltag n“ | neu | Tabelle aus den gebuchten Zeilen bis n neu summieren; Ledger deckt Rang und Punkte schon ab |
| Spaltensatz „Verein“ | vorhanden | `rosterCount`, `marketValueTotal`, `cash`, `sponsorTotal`, `salaryTotal`, `guv` samt Hovers |
| Teamkarte: beste Spieler | vorhanden | `hoverKader`, `season-standings-top-players.ts` |
| Teamkarte: Kaderstärke je Disziplin und ihr Rang | teils | `computeTeamDisciplineRanks` (`lib/lineups/team-discipline-ranks.ts`); Definition „Mittel der vier Besten“ ist neu |
| Teamkarte: letzte Einsätze | vorhanden | `disciplineResults`, `findeDisziplinErgebnis` |
| Papierform, Showdown-Auswahl und -Marke | neu | Kaderstärke; besser `gegner-schaetzung.ts` aus PR #1358 |
| Matchwinner | neu | `playerDisciplinePerformances`, `disciplineHighlights` liegen im Save; die Zählregel ist neu |
| Disziplin-Beste, Rekorde | teils | `league-record-book.ts`, `league-season-bests.ts`; „deutlichster Sieg“ aus `verhaeltnisHeim` |
| Saisonende: Meister, Auf- und Absteiger | vorhanden | `computeLeagueMovement`, `findLeagueMovementLog` |

### Aufwand

Arbeitstage für den Bau in der App, hinter einem Schalter neben der alten Ansicht, mit Sichtprüfung
bei 1920 × 1080, 3840 × 2160 und 390 × 844. Vorausgesetzt ist das Fundament aus Welle 0 des Plans
(Tokens, Schiene, Hero-Kopf, Tafel, Blatt; 4 Tage, dort schon gerechnet).

| Paket | Inhalt | Tage |
|---|---|---:|
| A Kern | Hero-Kopf mit Liga-Reitern, Tabelle „Sport“ und „Verein“ mit Zonen, Form, Ranglinie, Sortierung, leerer Zustand, Saisonende | 2,5 |
| B Teamkarte | Kontextspalte, Teamkarte, Blatt auf dem Phone | 1,5 |
| C Spieltage | Ergebnis- und Ansetzungskarten, Pods, Gesamt links/rechts | 1 |
| D Matrix | Punkte und Kaderstärke, Sortierung je Spalte, Tooltips | 1 |
| E Verlauf | Linien für Rang und Punkte, Auswahl | 1,5 |
| F Liga-Gefühl | Showdown, „Was auf dem Spiel steht“, Matchwinner, Disziplin-Beste, Rekorde | 2 |
| G Zeitregler | „Stand nach Spieltag n“ für alle Ansichten | 1 |
| Phone, Tests, Vertragsprüfungen (`season-standings-v2-ui-contract.test.ts`) | über alle Pakete | 1,5 |
| **Summe** | | **12** |

Der Plan vom 17.11. hatte für den Saisonstand 4 Tage angesetzt; das entspricht etwa Paket A plus B.
Die übrigen 8 Tage sind die neuen Ansichten (Matrix, Verlauf, Liga-Gefühl, Zeitregler), die es
heute nicht gibt. A bis C (5 Tage plus anteilig Phone und Tests, zusammen etwa 6) ergeben schon eine
vollständige Seite; D bis G lassen sich einzeln nachziehen.

### Fragen an Chris

| # | Frage | Empfehlung |
|---|---|---|
| 1 | Geldspalten als zweiter Spaltensatz „Verein“ statt in derselben Tabelle wie die Punkte? | Ja. Der Saisonstand wird dadurch auf einen Blick lesbar, und keine Zahl geht verloren. |
| 2 | Alles bauen (12 Tage) oder zuerst den Kern A bis C (etwa 6 Tage) und Matrix, Verlauf, Showdown danach einzeln? | Erst A bis C, dann D und E, zuletzt F und G. Jede Stufe ist für sich benutzbar. |
| 3 | „Matchwinner“ als Bestenliste: zählt der beste Spieler eines gewonnenen Einsatzes, oder lieber die Summe der Spielerpunkte (PPs) wie heute bei den Top-Spielern? | Matchwinner. Die Zahl ist klein, jeder versteht sie, und sie belohnt Spieler, die Duelle entscheiden. Die PPs-Liste bleibt unter „Spieler“. |
