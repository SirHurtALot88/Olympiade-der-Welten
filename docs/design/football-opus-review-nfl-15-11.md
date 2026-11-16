# Football: Opus-Review mit NFL-Recherche und Motor-Überarbeitung (15.11.)

Chris, wörtlich (15.11.): „Die tabelle sollst du anpassen dass maxiaml die punkte aus der matrix
vergeben werden!!!! und wieso ist dein Skill TEAMGEIST den du gebaut hast so stark? dafür
ballsicherheit 0? Was ist mit stärke/tacklings usw? da kannst du dich auch an den NHL games
orientieren bitte versuch darüber mal besser zu werden" — und danach: „lass opus das diesmal bitte
zu ende bearbeiten, dass wir die neue matrix regelung oder budgetierung wie du es nennst in jeder
diszi haben und das abgenommen ist".

Stand vorher (`main` `2d4153b4b` plus PR #1483): Pp 18,3 (bestanden), rho **0,525** je Spiel /
0,685 Saison (durchgefallen), nach fünf verworfenen reinen Rezeptrunden. Diese Runde ändert den
**Motor**, nicht nur das Rezept.

## Das Ergebnis, bevor die Begründung kommt

**Football besteht jetzt beide Pflichtkriterien regulär — ohne Ausnahme — und ist produktiv
geschaltet** (`ARENA_ANGESCHLOSSENE_DISCIPLINE_IDS` und `ARENA_RESOLVED_DISCIPLINE_IDS`).

| Größe | vorher (`main` + #1483) | **nachher** | Schranke |
|---|---:|---:|---|
| rho je Spiel, n=48, Median der Kaderfamilie | 0,525 | **0,854** (Spannweite 0,179) | > 0,80 (Football-Minimum 0,75) |
| rho je Spiel, n=24 | 0,526 | **0,874** (Spannweite 0,175) | — |
| rho Saison, n=48 | 0,685 | **0,937** | — |
| Pp, Saatstrom 0 / 10 000 000 (n=48) | 18,3 / 18,8 | **15,3 / 16,0** | ≤ 25, Optimum < 15 |
| Eignungsbester auf Wertrang 1 | 36 % | **70 %** | — |
| … in den ersten zwei | 51 % | **83 %** | — |
| Paare ≥ 15 Eignungspunkte richtig geordnet | 82,2 % | **97,5 %** | — |
| größtes mechanisches Gewicht eines Sub-Skills | TEAMGEIST 52,7 % | PASSSCHUTZ 22,7 % | — |
| BALLSICHERHEIT / AUSDAUER mechanisch | 0 % / 0 % | **13,6 % / 3,8 %** | — |
| stamina im Pp-Einfluss | 0 % | **7,7 % / 7,4 %** (Matrix 6) | — |

Die Matrix ist **unangetastet**. Die übrigen 19 Disziplinen sind **bit-identisch**
(`node scripts/pruefe-wertung-fingerabdruck.mjs` vorher/nachher: nur die drei Football-Einträge
ändern sich). Die Football-PPS-Referenz ist gegen den neuen Motor neu gezogen.

**Was den Unterschied gemacht hat, in einem Satz:** nicht noch ein Rezept, sondern ein Motor, in
dem jeder Spieler auf jedem Snap etwas tut (Linien-Duelle, Tackles), und erst darauf ein Rezept,
das das Matrixbudget über diese neuen Kanäle verteilt.

---

## 1. Was die echte NFL-Analytik über die Mechanik sagt

### 1.1 Recherche (Zahlen wörtlich aus der Quelle)

| Kennzahl | Wert | Quelle |
|---|---|---|
| Pass Block / Pass Rush Win Rate | ein Blocker „gewinnt", wenn er seinen Block **2,5 s** hält; der Rusher, wenn er ihn in diesem Fenster schlägt — gemessen für **jeden** Lineman auf **jedem** Snap aus Next-Gen-Stats-Tracking | ESPN, „NFL win rates" (2020–2025) |
| Run Stop Win Rate | nicht zeitgebunden; Sieg u. a. durch Tackle **innerhalb von 3 Yards** an der Line of Scrimmage, Zurückdrücken des Blockers oder Contain; gewinnt der Verteidiger, verliert sein Blocker, und umgekehrt | ESPN, ebd. |
| Yards nach Kontakt | Liga-Rekordwert **3,0 Yards nach Kontakt je Lauf** (bei ~4,3 Yards je Lauf insgesamt — rund zwei Drittel jedes Laufs entstehen NACH dem ersten Kontakt) | CBS Sports, „Return of power running backs" |
| Erzwungene verpasste Tackles | Spitze **0,30–0,31 je Ballberührung** (Jacobs 2019, Williams 2021, Chubb 2020, Lynch 2014), Schlusslicht **0,08** | PFF Signature Stats |
| Fumbles | rund 44 % aller Fumbles gehen verloren (Fox Sports); 2024: 271 verlorene Fumbles in 272 Spielen, also ~0,5 je Team und Spiel | Fox Sports; NFL 2024 (s. Rollout-Plan A.1) |
| Drop-Rate | Ligaschnitt grob **6,7 %** der fangbaren Bälle; Spannweite der Teams 3,3 % (Patriots 2021) bis 9,6 % (Jaguars 2025) | NFL.com Stadium-Analyse; PFF |
| Contested Catch | Spitze 67,7 % umkämpfter Fänge (M. Thomas 2019) | PFF Receiver Spotlight |
| „Clutch" auf 3. Down | Team-Rang Jahr zu Jahr r² = **0,10** auf 3. Down gegen 0,14 auf frühen Downs; QB-„Clutch"-WPA-Lücke ohne Persistenz — **aber** der Erfolg auf 3. Down ist mindestens so prädiktiv für Siege wie frühe Downs | Sharp Football Analysis; Bleacher Report |
| Madden-Bewertungen (Spielmechanik-Vorbild) | Ballträger: Carrying (Fumbles), Trucking/Break Tackle (Tackle-Durchbruch); Verteidiger: Tackle, Hit Power (erzwungene Fumbles), Pursuit (Gang Tackling); Linie: Pass/Run Block gegen Power/Finesse Move und Block Shedding | EA Madden Ratings (allgemein bekannt) |

### 1.2 Was daraus für unseren Motor folgt

1. **Jeder Spieler ist auf jedem Snap beteiligt.** Die NFL bewertet Linienspieler snap-genau
   (Win Rates, PFF-Noten), obwohl sie nie den Ball berühren. Unser Motor ließ bisher je Snap zehn
   von zwölf Spielern unbeteiligt stehen — Wert entstand nur über wenige, stark konvexe
   Ballberührungs-Lotterien. Das ist der Kern des alten rho-Problems (Abschnitt 2).
2. **Tackling ist ein Duell um Yards, nicht nur „wer wird gezogen".** Zwei Drittel eines Laufs
   entstehen nach dem ersten Kontakt; ob der erste Tackle sitzt, entscheidet Ballträger-Wucht
   gegen Tackler. Ein gebrochener Tackle bringt Zusatzyards und zwingt einen zweiten Verteidiger
   heran (Gang Tackling).
3. **Ballsicherheit wirkt bei jedem Kontakt, ist aber selten.** Ein Fumble je ~100 Berührungen
   heißt: Ballsicherheit kann nie so viel mechanisches Gewicht tragen wie Tackling oder Blocken.
   Die NFL-Analytik misst den Fänger aber zusätzlich über Drops und umkämpfte Fänge — das ist der
   zweite, häufigere Kanal derselben Fähigkeit („Hände").
4. **Teamgeist/„Clutch" ist real wertvoll, aber nicht die Hälfte des Spiels.** Ein Money Down
   (3./4. Versuch) entscheidet Serien; die Fähigkeit dort zu bestehen ist aber analytisch
   schwach stabil. Unser TEAMGEIST bekommt deshalb einen klar umrissenen Kanal (Money Downs plus
   Chemie als Anspielstation) statt des Receiver-Monopols, das 52,7 % des Spiels trug.

---

## 2. Warum fünf Rezeptrunden scheitern mussten — die Diagnose

Eigene Sonde (je Spiel und Spieler Eignung, Wert, jede Boxscore-Komponente und jeder Sub-Skill;
5 Paarungen × 24 Spiele, alter Motor):

| Komponente | Anteil an der Wertmasse | rho(Eignung, Komponente) je Spiel |
|---|---:|---:|
| Fangyards | 27,6 % | 0,21 |
| Laufyards | 18,3 % | 0,42 |
| Touchdown-Punkte | 17,7 % | 0,20 |
| Passyards | 10,5 % | 0,40 |
| Tackles | 8,7 % | 0,05 |

Die Sub-Skills selbst gingen innerhalb eines Spiels nur mit **0,27–0,46** mit der Eignung
(ABWEHR_PASS sogar −0,10). Der Grund liegt in der Kaderfamilie, nicht im Code: unter den je
zwölf Antretenden (die besten sechs je Team) korreliert **kein einzelnes Matrixattribut** stark
mit der Eignung — spirit, das schwerste Gewicht (25), liegt je Paarung zwischen −0,45 und +0,25,
awareness zwischen −0,60 und +0,02. Erst die **Mischung** aller neun Attribute ist die Eignung.

Daraus folgt der Kern:

- Eine Wertung, die **linear** in den Sub-Skills ist, ordnet bei Pp ≈ 0 automatisch nach der
  Eignung (die gewichtete Summe der Sub-Skills IST dann die Matrixsumme). Offline nachgerechnet:
  schon das alte Rezept hätte bei rein linearer Wertung rho ≈ 0,85 erreicht.
- Der alte Motor war aber **nicht linear**: Wert entstand fast nur über drei Ballberührungs-
  Lotterien mit `FK_LOS_KAPPA = 3,4` (Passer, Läufer, Receiver), jede konvex in EINEM Sub-Skill.
  Wer im Receiver-Sub-Skill vorne lag, bekam die Fangyards — und dieser Sub-Skill (TEAMGEIST,
  52,7 % des mechanischen Gewichts) bestand aus spirit/torment/charisma, die in dieser
  Population kaum mit der Eignung gehen. Zehn von zwölf Spielern waren je Snap unbeteiligt.
- Jede Rezeptvariante konnte nur verschieben, WELCHER schwach korrelierte Spezialist die
  Lotterie gewinnt. Deshalb landeten alle fünf im selben Band 0,50–0,58.

## 3. Was gebaut wurde

Alles in `public/mockups/battle-mode.engine.js`, Football-eigener Code (`FB_NFL`,
`fbLinienDuelle`, `resolveLaufNfl`, `resolvePassNfl`, `fbKonversion`, Football-Zweig von
`feldspielWert`, `WERTUNG_FOOTBALL`). Kein gemeinsamer Chassis-Code angefasst; die alten
`resolveLauf`/`resolvePass` sind entfernt.

### 3.1 Linien-Duelle je Snap (Block gegen Pass Rush / Run Stop)

Vorbild: ESPN Pass Block / Pass Rush / Run Stop Win Rate. Auf jedem Lauf- und Passspielzug führt
**jeder nicht direkt beteiligte Spieler** ein Duell: Offense-Blocker (`PASSSCHUTZ`) gegen
Verteidiger (`ABWEHR_PASS` beim Pass, `ABWEHR_LAUF` beim Lauf). Paare = max(Blocker,
Verteidiger), die Paarung rotiert je Snap deterministisch (kein zusätzlicher Wurf), Überzahl gibt
ein Doppel-Team. Siegchance logistisch in der Sub-Skill-Differenz (Skala 12).

- **Wirkung auf den Spielzug:** der Druckanteil der Abwehr verschiebt die Sack-Chance (±5 Pp) und
  die Fangchance (±6 Pp); beim Lauf bestimmt der Netto-Linienanteil die Yards vor Kontakt
  (1,4 ± 2,6).
- **Wirkung auf die Wertung:** jeder Spieler bekommt je Duell eine Note (halb realisiert, halb
  erwartet, zentriert um 0 — dieselbe K3-Logik wie Hockeys xG), Gewicht 1,0 in `feldspielWert`.
  Boxscore: „BlkW" (gewonnene Blocks), „Druck" (gewonnene Duelle als Verteidiger).

### 3.2 Tackling: Yards nach Kontakt, gebrochene Tackles, Gang Tackling

Vorbild: PFF „yards after contact", „missed tackles forced". Der Läufer (`LAUFKRAFT`) trifft auf
den Tackler (`ABWEHR_LAUF`): Yards nach Kontakt 1,2 + 0,05 × Differenz; mit 14 % + 0,6 Pp je
Differenzpunkt bricht er den ersten Tackle (3–12 Zusatzyards), dann bringt ihn ein zweiter
Verteidiger (eigene `ABWEHR_LAUF`-Ziehung) zu Boden. Beim Fang dasselbe für die Yards nach dem
Fang (`LAUFKRAFT` des Receivers gegen einen Tackler). Wertung: Run Stop (Tackle bei ≤ 2 Yards)
+0,4, verpasster erster Tackle −0,4. Boxscore: „Stop", „MT".

### 3.3 Ballsicherheit: Fumbles bei jedem Kontakt, Hände beim Fang

- Lauf-Fumble beim ersten Kontakt (1,8 % + 0,04 Pp je Punkt `ABWEHR_LAUF` − `BALLSICHERHEIT`),
  Fang-Fumble beim Tackle nach dem Fang, Strip-Sack (8 % der Sacks, `BALLSICHERHEIT` des Passers
  gegen den Rusher). Selten, aber wertungsrelevant (Ballbesitzwechsel, −2 für den Ballverlierer,
  +1 für den Eroberer).
- Häufigerer zweiter Kanal derselben Fähigkeit: **umkämpfter Fang** — `BALLSICHERHEIT` des
  Receivers gegen `ABWEHR_PASS` des Deckungsspielers verschiebt die Fangchance (0,3 Pp je Punkt).
- Receiver-Los: Mittel aus `TEAMGEIST` (Chemie mit dem QB) und `BALLSICHERHEIT` (Hände) statt
  `TEAMGEIST` allein.

### 3.4 Money Downs (TEAMGEIST)

Auf 3./4. Versuch verschiebt die Differenz `TEAMGEIST` Ballträger − direkter Gegenspieler die
Lauf-Yards (0,04 je Punkt) bzw. die Fangchance (0,25 Pp je Punkt), und wer einen Money Down
verwandelt (Angriff) oder verhindert (Abwehr), bekommt +1 (Boxscore „3./4."). Bewusst klar
umrissen, weil die Analytik „Clutch" als wenig stabile Fähigkeit ausweist (Abschnitt 1.1) —
TEAMGEIST trägt jetzt 14,5 % statt 52,7 %.

### 3.5 AUSDAUER: Ermüdung in der Linie

Erster Live-Kanal überhaupt: in den Linien-Duellen wirkt `AUSDAUER` ab dem 2. Viertel wachsend
(0 / ⅓ / ⅔ / 1 × 0,12 × (AUSDAUER − 50) Duellpunkte). stamina liest im Pp-Einfluss jetzt
7,7 % / 7,4 % gegen Matrix 6 (vorher 0 %).

### 3.6 Das Rezept — per Budget-Methode, mit neuer Suche

Sondierung des neuen Motors (`node scripts/sondiere-feldspiel-subskills.mjs football 16`):

| Sub-Skill | mechanisches Gewicht | vorher |
|---|---:|---:|
| PASSSCHUTZ (Blocken) | 22,7 % | 1,2 % |
| ABWEHR_LAUF (Tackling) | 17,3 % | 8,7 % |
| TEAMGEIST | 14,5 % | 52,7 % |
| LAUFKRAFT | 14,2 % | 24,4 % |
| BALLSICHERHEIT | 13,6 % | 0 % |
| ABWEHR_PASS | 10,6 % | 4,9 % |
| AUSDAUER | 3,8 % | 0 % |
| PASSGENAUIGKEIT | 3,3 % | 8,1 % |

`scripts/baue-feldspiel-rezept.mjs` hat dafür drei Erweiterungen bekommen:

1. **ERLAUBT-Zellen nach der neuen Semantik** (Blocken, Pass Rush/Deckung, Tackling, Hände,
   Money Downs) — jedes Matrixattribut hat mindestens zwei fachlich begründete Zellen (Primär-
   und Nebenweg, CLAUDE.md „mehrere Wege zum Erfolg").
2. **`--kaderfamilie`**: Sinkhorn liefert für jede Startbelegung eine Lösung, die Zeilen (Matrix)
   und Spalten (Sondierung) exakt einhält. Die Suche wählt unter diesen die, deren Sub-Skills je
   für sich am besten mit der Eignung gehen (gemessen auf den 2×6 Antretenden jeder Paarung der
   echten Kaderfamilie). Reines Sinkhorn: 0,541, nach der Suche: 0,627. Das ändert **nicht**, wie
   viel jedes Attribut insgesamt bekommt — nur, in welcher erlaubten Zelle es landet.
3. **Budget-Tabelle in Matrixpunkten** als zusätzliche Ausgabe (die Tabelle unten).

**Die Tabelle in Matrixpunkten** (Chris' Punkt 1: „maximal die Punkte aus der Matrix") — jede
Zeile verteilt genau das Matrixgewicht des Attributs, nie mehr; jede Spalte summiert sich auf das
mechanische Gewicht des Sub-Skills:

| Attribut | PASSGENAUIGKEIT | LAUFKRAFT | PASSSCHUTZ | ABWEHR_PASS | ABWEHR_LAUF | BALLSICHERHEIT | TEAMGEIST | AUSDAUER | Summe | Matrix |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| spirit | – | 5,8 | 6,0 | 2,0 | 6,8 | – | 4,4 | – | 25,0 | 25 |
| torment | – | 3,7 | 5,6 | 3,4 | 3,3 | – | – | – | 16,0 | 16 |
| health | – | 3,9 | 0,5 | – | 2,8 | 5,3 | – | 1,4 | 14,0 | 14 |
| awareness | 3,1 | – | – | 2,4 | – | 5,5 | – | – | 11,0 | 11 |
| will | 0,1 | – | 4,3 | – | 2,6 | 1,6 | 0,6 | 0,9 | 10,0 | 10 |
| determination | 0,0 | – | – | 1,2 | – | 1,2 | 5,5 | – | 8,0 | 8 |
| power | – | 0,8 | 1,8 | 1,6 | 1,8 | – | – | – | 6,0 | 6 |
| stamina | – | – | 4,4 | – | – | – | – | 1,6 | 6,0 | 6 |
| charisma | 0,0 | – | – | – | – | – | 4,0 | – | 4,0 | 4 |
| **Spalte** | 3,3 | 14,2 | 22,7 | 10,6 | 17,3 | 13,6 | 14,5 | 3,8 | 100 | 100 |

Dieselbe Lösung in der Prozent-Schreibweise, die der Motor liest (`FELDSPIEL_ART.football.rezept`):

```
PASSGENAUIGKEIT: {awareness:95,will:3,determination:1,charisma:1}
LAUFKRAFT:       {spirit:41,health:28,torment:26,power:5}
PASSSCHUTZ:      {spirit:26,torment:25,stamina:20,will:19,power:8,health:2}
ABWEHR_PASS:     {torment:33,awareness:22,spirit:19,power:15,determination:11}
ABWEHR_LAUF:     {spirit:39,torment:19,health:16,will:15,power:11}
BALLSICHERHEIT:  {awareness:41,health:39,will:11,determination:9}
TEAMGEIST:       {determination:39,spirit:30,charisma:27,will:4}
AUSDAUER:        {stamina:41,health:36,will:23}
```

Nachrechnen: `node scripts/baue-feldspiel-rezept.mjs football <sondierung.txt> --kaderfamilie`
reproduziert genau diese Zahlen (deterministische Suche, 1500 Schritte, rund eine Minute).

„Stärke" (power) hat nur 6 Matrixpunkte — mehr kann sie nach der gesperrten Matrix nicht
bekommen. Sie sitzt jetzt dort, wo Football sie braucht (Blocken, Pass Rush, Tackling, Läufer);
die eigentliche Wucht-Arbeit in Linie und Tackling tragen die schweren Football-Attribute
spirit/torment/health.

## 4. Messungen

### 4.1 Rangtreue (kaderfest, fünf echte Paarungen)

| Befehl | rho je Spiel (Median) | Spannweite | Saison |
|---|---:|---:|---:|
| `miss-alle-disziplinen.mjs 24 football` (vorher) | 0,526 | 0,242 | 0,573 |
| neuer Motor, ALTES Rezept (Zwischenschritt, eigene Sonde) | 0,681 | — | 0,755 |
| `miss-alle-disziplinen.mjs 24 football` (nachher) | **0,874** | 0,175 | 0,951 |
| `miss-alle-disziplinen.mjs 48 football` (nachher) | **0,854** | 0,179 | 0,937 |
| `… 24 football --je-seite=4` | 0,846 | 0,229 | 0,976 |
| `… 24 football --je-seite=2` | 0,775 | 0,325 | 0,800 |

Schon der neue Motor mit dem alten Rezept hob rho von 0,53 auf 0,68 — der Motor ist der Hebel,
das Rezept setzt danach den Rest um. 2-gegen-2 (vier Teilnehmer; ein Rang mehr oder weniger
kippt rho stark) bleibt die schwächste Kadergröße.

Star- und Paartreue (eigene Sonde, n=48 × 5 Paarungen, nachher): Eignungsbester auf Wertrang 1
in **70 %**, in den ersten zwei in **83 %**, nie auf dem letzten; Paare mit ≥ 15 Eignungspunkten
Abstand zu **97,5 %**, 10–15 Punkte zu 89,3 %, unter 2 Punkten zu 54 % richtig geordnet (vorher
36 % / 51 % / 82,2 %).

### 4.2 Budget-Methode (Pp)

`node scripts/messe-arena-einfluss.mjs football 48` und `… --saat-versatz=10000000`:

| Attribut | Strom 0 | Strom 1e7 | Matrix |
|---|---:|---:|---:|
| spirit | 24,6 | 25,8 | 25 |
| torment | 20,5 | 20,3 | 16 |
| health | 10,8 | 10,4 | 14 |
| awareness | 10,3 | 11,2 | 11 |
| will | 9,6 | 10,0 | 10 |
| stamina | 7,7 | 7,4 | 6 |
| power | 7,5 | 7,3 | 6 |
| determination | 7,3 | 6,1 | 8 |
| charisma | 1,8 | 1,5 | 4 |
| **Abweichung** | **15,3 Pp** | **16,0 Pp** | ≤ 25 |

Knapp über dem Optimum < 15. Eine weitere Iteration (torment-Anteil senken, health/charisma
heben) könnte darunter kommen, hätte aber die Budget-Tabelle oben vom Matrixgewicht gelöst (Zeilen
müssten bewusst über-/unterbucht werden, um die Ungleichheit der Kanäle auszugleichen) — bewusst
nicht gemacht: Chris' Wunsch war, dass die Tabelle genau die Matrixpunkte zeigt.

### 4.3 NFL-Korridor (`node scripts/miss-football-korridor.mjs 40`)

| Größe | vorher | nachher | Ziel (NFL 2024) |
|---|---:|---:|---:|
| Completion-Quote | 70,5 % | **65,2 %** | 65,3 % |
| Yards je Passversuch | 7,38 | **7,23** | 7,1 |
| Yards je Laufversuch | 5,10 | **4,48** | ~4,3 |
| Sack-Quote | 4,0 % | **7,3 %** | ~7,0 % |
| Interception-Quote | 1,3 % | 1,5 % | 2,1–2,4 % |
| Fumbles verloren je Team | 0,56 | 0,63 | ~0,5 |
| Punkte je Team | 17,7 | 14,6 | 22,9 |

Completion, Yards/Versuch, Laufyards und Sack-Quote liegen jetzt dichter am realen Wert als
vorher. Punkte je Team sind gesunken (bei ~50 Snaps je Team gegen ~63 in der NFL sind weniger
Punkte strukturell). `kurve.skillMittel` folgt dem neu gezogenen Passer (0,559 → 0,469, die im
Kommentar dort beschriebene Nachziehpflicht).

### 4.4 Gegenproben

- **Fingerabdruck** (`pruefe-wertung-fingerabdruck.mjs`, 69 Einträge): vorher/nachher nur die
  drei `spiele football`-Einträge verschieden; alle anderen 19 Disziplinen bit-identisch.
- **PPS-Referenz** (`scripts/ziehe-football-pps-referenz.ts`, 64 Fixtures je Feldgröße 2..6)
  gegen den neuen Motor neu gezogen — die Linien-Note verschiebt die Wertskala (iMittel bei n=6
  jetzt 12,5, bei n=2 33,8).
- **Seitenfehler:** in keinem Lauf.

## 5. Was ehrlich offen bleibt

1. **Die Linien-Note trägt 42 % der Wertmasse.** Gewollt (jeder spielt jeden Snap) und rangtreu
   belegt, heißt aber auch: ein Spieler ohne Ballberührung kann allein über die Linie ein gutes
   Spiel machen. Fachlich vertretbar (Linienspieler sind in der NFL wertvoll), aber eine
   Gestaltungsentscheidung, die Chris kennen sollte.
2. **PASSGENAUIGKEIT ist awareness-getragen und trägt nur 3,3 %.** Der Quarterback ist damit der
   „Feldleser"; awareness geht in dieser Population negativ mit der Football-Eignung, deshalb hat
   die Suche sie in den Sub-Skill mit dem kleinsten Gewicht gelegt. Soll der QB mehr zählen,
   müsste der Passerkanal im Motor gestärkt werden — keine Rezeptfrage.
3. **Kein erneuter kappa-/Gewichts-Sweep mit dem neuen Rezept.** Zwei Varianten (kappa 2,0,
   Linien-Gewicht 2,0) wurden nur mit dem ALTEN Rezept gemessen (0,696 / 0,658 gegen 0,681) und
   sind nicht übernommen; bei 0,854 bestand kein Anlass für weitere Eingriffe.
4. **Pp 15,3/16,0 statt < 15**, s. 4.2.
5. **Interception-Quote 1,5 %** liegt (wie schon vorher, 1,3 %) unter dem NFL-Band — nicht Teil
   dieser Runde, kein Abnahmekriterium.

## Quellen

- ESPN, NFL Win Rates (Pass Rush / Run Stop / Pass Block), Methodik 2020–2025:
  https://global.espn.com/nfl/story/_/id/38356170/2023-nfl-pass-rush-run-stop-blocking-win-rate-rankings-top-players-teams
- CBS Sports, „Return of power running backs is a key part of this year's rushing resurgence":
  https://www.cbssports.com/nfl/news/return-of-power-running-backs-is-a-key-part-of-this-years-rushing-resurgence
- PFF Signature Stat Spotlight Running Backs: https://www.pff.com/news/pro-signature-stat-spotlight-running-backs
- Fox Sports, Fumbles: https://www.foxsports.com/stories/nfl/fumbles-nfl-all-stats-you-didnt-realize-you-needed-know
- PFF, Jaguars-Drop-Rate 2025: https://www.pff.com/news/nfl-jaguars-receiving-corps-must-avoid-drops-to-unlock-trevor-lawrence-next-step
- NFL.com, Stadien und Drops: https://edge-operations.nfl.com/gameday/analytics/stats-articles/how-nfl-stadiums-factor-in-dropped-passes
- PFF Receiver Spotlight (Contested Catch): https://www.pff.com/news/pro-signature-stat-spotlight-wide-receivers
- Sharp Football Analysis, „How crucial is success on third down":
  https://www.sharpfootballanalysis.com/analysis/how-crucial-is-success-on-third-down
- Bleacher Report, „What really defines a clutch NFL player":
  https://bleacherreport.com/articles/1594313-what-really-defines-a-clutch-nfl-player
