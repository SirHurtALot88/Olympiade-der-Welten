# Tennis-Nachtkonzept (03.10.) — „Der Stand erzählt das Match"

**Reine Konzeptrunde, kein Code geändert, kein Verhaltens-PR.** Auftrag aus Chris' Nachtbestellung
vom 03.10. („bei den anderen event poors bitte heute über die nacht auch konzepte ausarbeiten …
denk gern um die ecke, hol infos aus dem internet und probier dich aus"), aufbauend auf seiner
Grundfrage vom 02.10. („wie man mit einfachen methoden das spiel etwas interaktiver gestalten kann
und das auch nen gewissen impact haben kann — mehr risiko führt dazu dass jemand sich evtl übertrifft
oder unter dem druck oder gewicht einbricht").

Tennis ist Nummer 5 der neun ereignisarmen Disziplinen aus
`docs/design/manager-risiko-interaktivitaet-konzept-02-10.md` (PR #1118): „Bild steht 48 %, bis 54 s
ohne Banner. Laut Fable gewinnt den Punkt nicht zwingend, wer den Ballwechsel besser spielt — das
Spiel erzählt nicht, was man sieht." Der zweite Satz ist seit **T-F1a** (PR #1135, gemergt)
erledigt: es gibt einen diskreten Punktgewinner je Ballwechsel und ein Break-Banner. Offen ist die
größere Frage dieses Papiers: **wie wird ein ganzes Match sichtbar spannend — der Stand, nicht
der Punkt.**

**Bindender Rahmen (CLAUDE.md), für alles unten:** die Eignungsmatrix
(`lib/player-generator/official-discipline-weights.ts`) bleibt unangetastet; rho je Einzelspiel
muss über 0,80 bleiben und hat Vorrang vor Pp; Pp-Abweichung ≤ 25 ist Pflichtprüfung; „mehrere
Wege zum Erfolg" wird mitgedacht; **alles, was Sendezeit oder Spielablauf verändert, ist Klasse T
und braucht Chris' ausdrückliche Zustimmung — es wird hier nur beschrieben, nie gebaut.**

### Klassenschema (wie in den Geschwister-Nachtkonzepten vom 03.10.)

| Klasse | Bedeutung | Braucht |
|---|---|---|
| **A** | reine Anzeige: kein `rr()`, kein neues Sim-Feld, `wert()`/Rezept unangetastet, rho bit-identisch | Sichtprüfung |
| **A\*** | Anzeige mit eigener Buchhaltung (Zweitrechnung über bereits feststehende Werte), Ergebnis unverändert | Nachweis, dass die Zufallskette nicht berührt wird |
| **B** | echte Mechanik in der Ergebnis- oder Teamschicht (Platzsieger, Seitenstand) — `u.summe` bleibt | Chris' Zustimmung, Prototyp, kaderfeste Messung |
| **C** | Mechanik, die eine Design-Entscheidung von Chris voraussetzt (Regel des Sports im Spiel) | Chris' Entscheidung vor dem Bau |
| **T** | greift in Sendezeit/Wandzeit/Spielablauf ein | **nur Chris persönlich, ausdrücklich** |
| **M** | Manager-/Saisonzustand (Aufstellung, Anweisung, Haltung) | Chris' Zustimmung, Persistenz |

---

## 0. Kurzfassung

1. **Tennis hat heute alles, was ein Punkt braucht, und nichts, was ein Match braucht.** Es gibt
   Punktgewinner, Aufschlag, Break — aber keinen Spielstand, der sich bewegt (Audit 30.09.: „Stand
   0 : 0 bis zum Schluss"), keinen Matchball, keinen Satzball, kein „abgewehrt", und ein Drittel
   aller Mannschaftskämpfe endet 3:3 (nachgerechnet, Abschnitt 4.3). Der Ticker schreibt
   122 Zeilen je Minute, weil jeder Punkt gleich laut ist.
2. **Die eine Zahl, die Tennis von jedem anderen Sport unterscheidet, heißt Wichtigkeit.** Morris
   (1977) definiert sie als Differenz der Match-Siegchance je nach Ausgang dieses einen Punkts; ein
   Breakball ist viermal so wichtig wie der erste Punkt eines Spiels. Für unser Rennen bis 7 ist
   diese Zahl **ohne Spoiler aus dem Spielstand allein berechenbar** (Tabelle in 3.1). Sie ist der
   Schlüssel für alles Weitere: Banner, Ticker-Dosis, Clutch, Manager-Haltung.
3. **Drei Konzepte, aufeinander aufbauend, je eigene Klasse:**
   - **T-N1 Der Druckmesser** (Klasse A\*): Wichtigkeit live, Matchball/Satzball/Abgewehrt/
     Comeback-Banner, Ticker nur für große Punkte. Geht heute, ohne dass ein Würfel fällt.
   - **T-N2 Das Rennen bis 7 mit Clutch und Momentum** (Klasse B/C): das volle T-F1 (Rennen als
     Platzentscheider) — aber mit einem ehrlichen Befund aus meinem Experiment: **das nackte T-F1
     senkt die Paartreue** im 5–10-Punkte-Band von 85 % auf 75 %, weil der Aufschlag-Zuschlag das
     einzige Rauschen ist und Eignung nicht kennt. Ein Clutch-Term aus NERVEN an großen Punkten
     plus ein kleiner Momentum-Term heben sie auf 91 % — über den heutigen Stand — und halten das
     Drama (jeder siebte Platz geht ins 6:6, jeder dreizehnte wird aus unter 15 % Siegchance
     gedreht).
   - **T-N3 Der Decider-Platz** (Klasse B + M): Platz 6 zählt doppelt, wird zuletzt enthüllt und
     ist Chris' Aufstellungsentscheidung. Remis 33 % → 0 %, zwei Drittel aller Kämpfe bleiben bis
     zum letzten Platz offen.
   - **T-N4 Manager-Haltung „Angriff auf den großen Punkt"** (Klasse M + B): Chris' Risiko-Idee,
     an die Wichtigkeit gekoppelt — Angreifen verstärkt den Clutch-Term in beide Richtungen
     (ein Nervenstarker übertrifft sich, ein Nervenschwacher bricht ein). Kein Knopf ist immer
     besser.
4. **Zwei Dinge sind Klasse T und stehen nur zur Kenntnis:** die Hawk-Eye-Verzögerung (Sekunden
   Wandzeit vor dem Matchball) und eine Satzpause. Beides nicht gebaut, beides nicht empfohlen,
   beides nur Chris' Entscheidung.

---

## 1. Problemrahmen — was Tennis heute ist

**Mechanik (`BUEHNE_ART.tennis`, `engine.js:15034 ff.`, `setz()` `:15657 ff.`, `art.duell`-Block
`:15797 ff.`).** Sechs Plätze, je Platz Heim i gegen Gast i. Jeder Spieler würfelt **zehn Runden
allein** (ein `rr()` je Runde; Erfolgschance aus TECHNIK/NERVEN/WAGNIS, Punkte aus GRUNDLAGE/
SPITZENMOMENT/PUBLIKUM, Ermüdung aus AUSDAUER). Danach vergleicht der Paarungsblock: `vorteil` =
Summe der Punktdifferenzen entscheidet den Platz (`spieleBuehneDuell()` `:45180`: `u.vorteil>0`);
seit T-F1a bekommt zusätzlich jede Runde einen `punktGewinner` (Vergleich mit Aufschlag-Zuschlag
`TENNIS_AUFSCHLAG_H=10` nur im Vergleich, nie im Wurf) und ein `aufschlag`-Label nach der
Match-Tiebreak-Wechselregel. Spielerwert für rho ist `u.summe` (eigene Punkte), nicht der Platz.

**Zahlen.** rho je Spiel 0,813–0,827 (PR #1135: 0,813 kaderfest, Saison 0,944), Pp 9,8 / 6,2 —
beide Schranken bestanden, rho-Puffer dünn (Kaderrauschen ~0,21). Audit 30.09.
(`f1-broadcast-audit-runde-2-30-09.md`): Bild steht 48 %, 54 s ohne Banner, 122 Tickerzeilen/min,
Scoreline 0 : 0 bis zum Schluss, 1:01 Dauer.

**Was nach T-F1a noch fehlt — der Befund dieses Papiers:**

| Lücke | Beleg | Warum es den Zuschauer trifft |
|---|---|---|
| **Kein Stand, der sich bewegt.** `vorteil` ist eine Summe von Punktdifferenzen (±100 und mehr), die Scoreline zählt gewonnene Plätze, und die stehen bis zur letzten Runde auf 0 : 0 | Audit Tabelle Z. 138/472 | Es gibt keinen Moment, in dem „6:5" auf der Tafel steht und alle wissen, was der nächste Punkt bedeutet |
| **Jeder Punkt ist gleich laut.** 13 Runden × 6 Plätze × 2 Seiten = 156 Enthüllungen je Minute, alle mit derselben Dosis | Audit Z. 409: 122 Zeilen/min; Maßnahme 8 Zielband ≤ 30 | Der Break-Banner (T-F1a) feuert bei ~36 % der Punkte und ist deshalb gedrosselt, s. Kommentar `:18494` |
| **Kein Matchball, kein Satzball, kein Abgewehrt.** Das Rennen bis 7 existiert nur als Idee (T-F1, Klasse B, offen) | PR #1135 „Was bewusst NICHT Teil dieses Pakets ist" | Die drei Worte, die jede Tennis-Übertragung trägt, kommen im Spiel nicht vor |
| **Ein Drittel Remis.** Sechs Plätze, Mehrheit nötig: 3:3 ist ein häufiges, „echtes" Unentschieden (`:45160` ausdrücklich so gewollt) | nachgerechnet 31–35 % (Abschnitt 4.3) | Ein Mannschaftskampf, der zu einem Drittel unentschieden endet, hat kein Ende |
| **Der Platz widerspricht der Leistung — und darf das noch nicht.** Chris' Frage 1 aus dem Fable-Papier („Darf das Brettergebnis der Leist-Spalte widersprechen?") ist unbeantwortet | `fable-ideen-buehne-duell-30-09.md` Abschnitt 7 | Solange das offen ist, bleibt jedes T-N2 ein Konzept |

---

## 2. Recherche — was echtes Tennis beim Zuschauen spannend macht

### 2.1 Die Wichtigkeit eines Punkts ist messbar — und sehr ungleich verteilt

> „Morris (1977) defined importance based on how pivotal the point is, calculated as the probability
> of winning the match if the first player wins the point minus the probability of winning the match
> if the second player wins the point." … „The most important point in a given game is 30:40 (or
> Advantage to the returning player), and within that game that point is more than 4 times more
> important than the point at 0:0 in the game."
> — [evidently.substack.com, „The points that matter"](https://evidently.substack.com/p/the-points-that-matter)
> (Zusammenfassung von Morris, C. (1977), „The most important points in tennis").

> „The importance of a given point also depends on the wider match situation, such that even at a
> high-stakes game score of 40:40, the point could matter little (if one player is up 5-0 in the set)
> or matter a lot (if the set is tied at 4-4 or 5-5)." — ebd.

**Übertrag:** Wichtigkeit ist eine Funktion des Spielstands, nicht der Spieler. Sie lässt sich für
jedes Format vorab tabellieren, ohne irgendein Ergebnis zu kennen — **spoilerfrei**, im Sinn des
Projekts (S-F2-Regel: „liest kein zukünftiges Ergebnis").

### 2.2 Punkte sind nicht unabhängig — aber fast

> „We find that points are neither independent nor identically distributed: winning the previous
> point has a positive effect on winning the current point, and at important points it is more
> difficult for the server to win the point than at less important points. Furthermore, the weaker a
> player, the stronger are these effects. Deviations from iid are small, however, and hence the iid
> hypothesis will still provide a good approximation in many cases."
> — Klaassen, F. & Magnus, J. (2001), „Are points in tennis independent and identically distributed?
> Evidence from a dynamic binary panel data model", *JASA* 96(454), 500–509; Abstract zitiert nach
> [research.tilburguniversity.edu](https://research.tilburguniversity.edu/en/publications/are-points-in-tennis-independent-and-identically-distributed-evid/)
> (knapp 90.000 Punkte, Wimbledon 1992–1995).

**Übertrag:** Ein Momentum-Term (letzter Punkt gewonnen → kleiner Vorteil) und ein Clutch-Term
(an wichtigen Punkten trifft es den Schwächeren härter) sind nicht erfunden, sondern gemessen —
und beide sind **klein**. Genau so klein muss unser Zusatz sein (Abschnitt 4: Momentum 4 von
~60 Rundenpunkten, Clutch 0,8 × Wichtigkeit × NERVEN-Differenz).

### 2.3 Kleine Punkt-Vorsprünge werden große Match-Vorsprünge — und wann man punktet, zählt

> „winning at least 53% of points will virtually guarantee a match victory" — 51–52 % der Punkte:
> 86,7 % Matchsiege (best of 3); 52–53 %: 95,8 %; ≥ 53 %: 99,1 %. … „scoring more points *tends*
> to lead to victory, but it's not a guarantee. It also matters *when* you score your points, and
> whether those points help you win sets."
> — [inpredictable.com, „Tennis matches and luck"](https://www.inpredictable.com/2014/07/tennis-matches-and-luck.html)

**Übertrag:** Das ist der Grund, warum eine hierarchische Zählung (Punkt → Rennen → Platz →
Mannschaft) Tennis überhaupt erst zu Tennis macht: sie verstärkt Eignungsunterschiede (gut für
Paartreue) **und** erlaubt, mit weniger Punkten zu gewinnen (gut für Drama). Beides zugleich ist
nur mit einer Zählhierarchie zu haben, nie mit einer Summe.

### 2.4 Breakpunkte: Druck wirkt, aber keine „heiße Hand" bei vergebenen Chancen

> „players got broken in 21.7% of their service games" … „after a hold of serve: 22.6%; after a
> break of serve: 19.3%; after a hold including a missed break point chance: 21.2%; after a hold
> including four or more missed bp chances: 19.4%."
> — [tennisabstract.com, „Do Players Get Broken More Often After Failing to Convert Break Point?"](https://tennisabstract.com/blog/?p=1717)

> „From 15-40, the break point at 30-40 was converted 41.2% of the time. In 30-30 games, the break
> point was converted 40.2% of the time." … „In those 206 games that passed through 0-40 en route to
> 30-40, the third break point was converted a whopping 45.1% of the time." … „If a game passes
> through 30-0 en route to 30-40, you're better off betting on the guy who just lost the last three
> points" (34,9 %).
> — [tennisabstract.com, „The Hot Hand in Reverse at 30-40"](https://www.tennisabstract.com/blog/?p=570)

**Übertrag:** Der *Weg* zu einem Stand trägt Information (wer die letzten drei Punkte verlor, ist
angeschlagen) — ein Momentum-Term mit kurzem Gedächtnis (letzter Punkt) bildet das sparsam ab.
Nicht übertragen: eine „Gegen-heiße-Hand" nach vergebenen Breakbällen — die Daten zeigen keine.

### 2.5 Hawk-Eye: Spannung entsteht durch die *angehaltene* Sekunde

> „When a player chooses to consult the replay, an animated image of the ball hitting the court zooms
> into focus on giant screens around the stadium, and the effect is so entertaining that tennis
> officials have actually asked the Hawk-Eye technicians to delay showing instant replays for a few
> extra seconds to allow suspense and excitement to build."
> — [popsci.com, „US Open instant replay: total accuracy, major fun"](https://www.popsci.com/scitech/article/2006-09/us-open-instant-replay-total-accuracy-major-fun)
> (Zitat über die Suchzusammenfassung; die Seite selbst war beim Nachfassen nur als Archivliste
> erreichbar — mit diesem Vorbehalt.)

> Khachanov challenged an out call, „but hawkeye took an agonisingly long time to reveal the correct
> decision, with Federer joking that he couldn't take it as ‚it's too nerve-wracking.'"
> — [au.sports.yahoo.com, Hopman Cup 2019](https://au.sports.yahoo.com/hopman-cup-roger-federers-hilarious-rollercoaster-of-emotions-38472343.html)

**Übertrag — und Warnung:** Das stärkste Spannungsmittel des realen Sports ist **Wandzeit**: der
Stand ist bekannt, das Ergebnis des nächsten Punkts steht fest, nur die Enthüllung wird verzögert.
Das ist exakt das, was im Projekt Klasse T ist (PR #1117/D7+A4, Commit `06666101`, zurückgenommen;
`broadcast-d7-a4-fable-empfehlung-02-10.md`). Dieses Papier beschreibt eine Tennis-Fassung davon in
Abschnitt 3.5 **nur zur Kenntnis**.

### 2.6 Kurzformate erzeugen mehr entscheidende Momente

> Next Gen ATP Finals: „first to 4, best of 5 … No-Ad scoring". Datenanalyse: „The NextGen format
> had 73% of its matches containing 12+ break points, compared to the ATP Finals which had only 7%
> … the NextGen format having more than double the tie-breaks (20) compared to the ATP Finals (9)."
> — [atptour.com, Next Gen ATP Finals 2025 rules and innovations](https://www.atptour.com/en/news/next-gen-atp-finals-presented-by-pif-2025-rules-and-innovations),
> Zahlen nach [braingametennis.com](https://braingametennis.com/nextgen-scoring-format-is-the-future)
> (Seite beim direkten Abruf 403; Zahlen aus der Suchzusammenfassung, mit Vorbehalt).

> UTS: „matches being divided into timed quarters" (acht Minuten), „If two players are equal in the
> amount of quarters won, a ‚sudden death' is played, where the first player to win two consecutive
> points wins the match." Bonuskarten, u. a. eine, die „the opponent's second serve" nimmt; „once
> per quarter, each player has the chance to use their ‚next point counts as 3' bonus card".
> — [en.wikipedia.org, Ultimate Tennis Showdown](https://en.wikipedia.org/wiki/Ultimate_Tennis_Showdown),
> [tennishead.net, UTS guide](https://tennishead.net/ultimate-tennis-showdown-begins-today-how-it-works-and-who-is-playing/)

**Übertrag:** Unser Platz *ist* bereits ein Kurzformat (13 Punkte). Was fehlt, ist nicht Kürze,
sondern das Sudden-Death-Gefühl am Ende (6:6) und — als Manager-Element — die UTS-Karte „dieser
Punkt zählt mehr": nicht als Zufallskarte, sondern als **Haltung** (Abschnitt 3.4).

### 2.7 Mannschaftsformate: steigende Gewichte, Decider, tote Rubber

> Laver Cup: „Each match victory on day 1 is worth one point, on day 2 two points, and on day 3 three
> points." … „The first team to claim 13 points wins the tournament. Therefore, the winning team can
> only be decided on day 3. In the event both teams are tied at 12 points each, a fifth match known
> as ‚The Decider' is played on day 3."
> — [en.wikipedia.org, Laver Cup](https://en.wikipedia.org/wiki/Laver_Cup)

> Davis Cup: „A dead rubber is a match in a series where the series result has already been decided
> by earlier matches" … „If the tie has already been decided in favour of one of the teams, it is
> common for younger lower-ranked team members to play the remaining ‚dead-rubbers'."
> — [Dead rubber (Wikipedia)](https://en.wikipedia.com/wiki/Dead-rubber), [tennisabstract.com, „The Likelihood of Live Doubles Rubber in the New Davis Cup"](https://tennisabstract.com/blog/?p=3779)

**Übertrag:** Ein Mannschaftskampf braucht ein Ende, das sich lohnt — ein Decider statt eines 3:3.
Und: tote Plätze dürfen tot aussehen (S-F2-Regie „das letzte Brett entscheidet", bereits Paket 1).

### 2.8 Das Comeback, das jeder kennt

> Wimbledon 2019: „7-6(5) 1-6 7-6(4) 4-6 13-12(3)" … „Federer had two championship points at 8-7,
> 40/15 on serve, in the fifth set that Djokovic saved" … „Djokovic is the first man in 71 years to
> win the title from match points down."
> — [atptour.com, Match analysis](https://www.atptour.com/en/news/djokovic-federer-wimbledon-2019-final-match-analysis),
> [eurosport.com](https://www.eurosport.com/tennis/wimbledon/2019/wimbledon-2019-novak-djokovic-downs-roger-federer-in-epic-after-final-set-tie-break_sto7373082/story.shtml)

**Übertrag:** „Matchball abgewehrt" ist das Ereignis, das ein Match erzählt. In unserem Rennen bis 7
kommt es — nachgerechnet — etwa 0,8-mal je Platz vor, also rund fünfmal je Mannschaftskampf. Es
muss nur jemand sagen.

---

## 3. Die Konzepte

### 3.1 T-N1 — Der Druckmesser (Klasse A\*, Aufwand klein)

**Idee.** Für das Rennen bis 7 (13 Punkte, kein Zwei-Punkte-Vorsprung, T-F1-Zählung) ist die
Siegchance aus dem Stand allein bei p = 0,5 je Punkt eine kleine Tabelle, und die Wichtigkeit
eines Punkts ist `imp(a,b) = P(a+1,b) − P(a,b+1)`:

| Stand | P(Sieg) | Wichtigkeit | Wort |
|---|---:|---:|---|
| 0:0 | 0,50 | 0,23 | — |
| 3:3 | 0,50 | 0,31 | — |
| 4:4 | 0,50 | 0,38 | „großer Punkt" |
| 5:5 | 0,50 | 0,50 | „großer Punkt" |
| **6:5 / 5:6** | 0,75 / 0,25 | **0,50** | **„Matchball"** |
| 6:4 | 0,88 | 0,25 | „zwei Matchbälle" |
| 6:3 | 0,94 | 0,13 | — |
| **6:6** | 0,50 | **1,00** | **„Entscheidungspunkt"** |
| 2:5 | 0,11 | 0,16 | „muss drei in Folge" |

Alles daran ist spoilerfrei: es liest nur den bereits enthüllten Stand und eine Konstante
(p = 0,5), nie `eig`, nie zukünftige `runden[]`. Es ist das, was die Enthüllungs-Warteschlange
`buehneQueue` ohnehin weiß. Im heutigen `vorteil`-Modus ließe sich dasselbe über die verbleibenden
Runden rechnen (Monte-Carlo über symmetrische Punktverteilung) — aber erst mit dem Rennen bis 7
werden die Worte wahr.

**Was daraus wird (alles Klasse A/A\*):**

1. **Die Platz-Tafel zeigt `a:b` statt „Vorteil +116".** Die Scoreline bewegt sich ab dem ersten
   Punkt; „Stand 0 : 0 bis zum Schluss" (Audit) ist damit vorbei, ohne eine Regel zu ändern — das
   ist die Tennis-Fassung von Audit-Maßnahme 18.
2. **Banner nach Wichtigkeit, nicht nach Ereignis.** „MATCHBALL ‹Name›" bei 6:x, „ABGEWEHRT" wenn
   der Rückstehende den Matchball gewinnt, „ENTSCHEIDUNGSPUNKT — 6:6" einmal je Platz,
   „COMEBACK — aus 2:5" wenn ein Spieler aus ≤ 15 % Siegchance gewinnt. Nachgerechnet
   (Abschnitt 4): Matchball abgewehrt ~0,8 je Platz, 6:6 bei 15–19 % der Plätze, Comeback bei
   6–8 % — also je Mannschaftskampf rund fünf „Abgewehrt", ein „Entscheidungspunkt", ein
   Comeback alle zwei Kämpfe. Selten genug, dass sie ohne Drossel groß sein dürfen.
3. **Der Ticker bekommt eine Dosis aus der Wichtigkeit.** Nur Punkte mit `imp ≥ 0,3` (4:4 und
   später, Matchbälle, 6:6) schreiben eine Zeile — nachgerechnet 1,9–2,5 je Platz, also
   **12–15 Zeilen je Minute statt 122**; das trifft das Zielband ≤ 30 aus Audit-Maßnahme 8 ohne
   eine neue Drossel. Der Break-Banner aus T-F1a feuert dann nur auf großen Punkten („BREAK zum
   Matchball"), was ihn vom Routine-Ereignis zur Nachricht macht.
4. **Eine Spannungsleiste je Platz** (Mini-Platz in der Übersicht): Füllstand = Wichtigkeit des
   nächsten Punkts. Sechs Leisten nebeneinander zeigen dem Zuschauer, **wohin er schauen soll** —
   das ist die Kamera-Regel aus S-F2, nur als Zahl statt als Schnitt.

**rho/Pp:** per Konstruktion null — kein `rr()`, keine Änderung an `summe`/`vorteil`/`runden[]`.
Voraussetzung ist allerdings, dass das Rennen bis 7 die Zählung ist, die auf der Tafel steht —
heute ist es der `vorteil`. T-N1 **ohne** T-N2 wäre eine Tafel, die 7:5 sagt, während der Platz
über `vorteil` an den anderen geht. Das ist der Widerspruch, den F1 bei Fechten beseitigt hat
(11,4 % der Gefechte an den mit weniger Treffern). Deshalb: **T-N1 und der Platzentscheider aus
T-N2 gehören in dieselbe Runde**, auch wenn Clutch/Momentum später kommen.

### 3.2 T-N2 — Das Rennen bis 7 mit Clutch und Momentum (Klasse B, Teil C; Aufwand mittel)

**Ausgangspunkt: volles T-F1.** 13 Runden, der Nullsummen-Vergleich (seit T-F1a vorhanden)
entscheidet den Platz, nicht mehr `vorteil`. Das Fable-Papier hat es vorgeschlagen, PR #1135 hat
es ausdrücklich zurückgestellt. Mein Experiment (Abschnitt 4) sagt dazu etwas, das im Papier
nicht stand:

**Befund 1 — das nackte T-F1 macht den Platz *ungenauer* als heute.** Paartreue über das
Platzergebnis im 5–10-Punkte-Band: heute (`vorteil`, 10 Runden) 84,9 %, Rennen bis 7 mit H=10
**75,5 %**; 10–15-Band 97,2 % → 94,1 %. Grund: die Rundenpunkte sind zu großen Teilen
deterministisch (`basis = 20 + 0,7·GRUNDLAGE`), der einzige Zufall je Runde ist Erfolg/Fehlschlag.
Ohne Aufschlag-Zuschlag (H=0) gewinnt deshalb fast immer der mit der höheren Basis — Paartreue
5–10 bei 98,8 %, aber 6:6 nur in 5,8 % der Plätze, kein Drama. **H ist der einzige Regler, und er
ist stumpf:** H=10 kauft Drama (6:6 in 18,6 %) mit Paartreue, H=20 lässt sie einbrechen (5–10:
59,9 %, Star nur noch 78 %). H ist Rauschen, das Eignung nicht kennt.

**Befund 2 — zwei kleine, eignungsgebundene Terme reparieren das.** Beide wirken nur im
Vergleich (wie H), nie im Wurf, nie auf `summe`:

- **Clutch:** `+ c · imp(a,b) · (NERVEN_A − NERVEN_B)` zugunsten der nervenstärkeren Seite,
  c = 0,8. Bei 6:6 (imp 1,0) und 20 Punkten NERVEN-Abstand sind das 16 Vergleichspunkte — mehr
  als der Aufschlag; bei 0:0 (imp 0,23) knapp 4. NERVEN trägt awareness 44 / spirit 40 /
  determination 16 — die Matrixattribute 20/18/6, also exakt die, die im Platzergebnis des nackten
  T-F1 unterrepräsentiert waren (Pp-Proxy: awareness 12 statt 20). Der Slot *Tiebreak Clutch*
  bekommt damit den Ort, den sein Name verspricht. Klaassen/Magnus: „the weaker a player, the
  stronger are these effects" — genau das rechnet der Term.
- **Momentum:** `+ m` für die Seite, die den vorigen Punkt gewann, m = 4 (von ~60 Rundenpunkten).
  Kurzes Gedächtnis, kleine Zahl — „deviations from iid are small".

Ergebnis (V4, c=0,8 / m=4): Paartreue 5–10 **90,8 %** (heute 84,9 %), 10–15 96,1 %, Star gewinnt
seinen Platz 94,6 % (heute 91,7 %), Pp-Proxy auf dem Platzergebnis 24,5 (nacktes T-F1: 51,9),
6:6 in 14,5 % der Plätze, Matchball abgewehrt 0,76 je Platz, Comeback 7,7 %. **Besser als heute
und dramatischer als heute — und beides zugleich nur, weil die Terme aus der Matrix kommen und
nicht aus dem Würfel.**

**Was Klasse C daran ist:** die Entscheidung, dass der Platz der Leistung widersprechen darf
(Chris' Frage 1, offen seit 30.09.). Tennis ist der Sport, in dem man mehr Punkte macht und
trotzdem verliert (inpredictable); Fechten hat die Regel seit F1. Ohne diese Entscheidung bleibt
T-N2 ein Papier.

**Was zu messen wäre (Projektregel, nicht meine Sonde):** `miss-alle-disziplinen.mjs 24 tennis`
vorher/nachher (muss auf `summe` bit-identisch bleiben bis auf die 13-Runden-Änderung — die
hebt rho eher, Spearman-Brown; im Experiment 0,683 → 0,735), `messe-arena-einfluss.mjs` (dito),
`miss-arena-buehne-spiegel.mjs` (im Experiment 50,0 % im Mittel über Original/gespiegelt — die
Aufschlag-Startparität je Platz ist symmetrisch), `miss-star-paartreue.mjs` **über das
Platzergebnis**, und: **Pp zusätzlich auf dem Platzergebnis** messen. Das ist neu und wichtig —
CLAUDE.md misst Pp auf `wert()` = `summe`, aber Chris' „ein 80er muss einer der Top-Leute sein"
gilt für das, was der Zuschauer sieht, und das ist ab T-N2 der Platz. `tennis-pps-referenz.json`
neu ziehen (rohe Summe +30 %).

### 3.3 T-N3 — Der Decider-Platz (Klasse B + M, Aufwand klein–mittel)

**Idee.** Platz 6 zählt doppelt. Sechs Plätze ergeben dann 7 Punkte — es gibt **kein Remis
mehr**, und keine Seite kann vor Platz 5 gewonnen haben. Platz 6 wird **zuletzt** enthüllt
(Startreihenfolge-Muster von Eiskunstlauf/Breaking, nachweislich rho-neutral, Gesamtdauer
identisch — keine Wandzeit, kein T), die anderen fünf laufen wie heute verschränkt. Wer auf
Platz 6 steht, ist **Chris' Aufstellungsentscheidung** — der Anker, wie in der Fechtstaffel
(F-F1), nur als Gewicht statt als Reihenfolge. KI-Seite: stärkste Eignung auf Platz 6, damit der
Vorteil nicht einseitig bei Chris liegt.

**Nachgerechnet (Abschnitt 4.3):** Remis 33,9 % → 0,2 % (heute) bzw. 0,0 % (mit T-N2); „offen
bis Platz 6" 62–67 % der Kämpfe; „stärkeres Team gewinnt" steigt in meiner groben Sonde von 48 %
auf 63 % (Vorsicht: Teams dort fast gleich stark, das ist kein rho-Maß). Die Laver-Variante
(1/1/2/2/3/3, Ziel 7 von 12) lässt 15 % Remis übrig (6:6) und braucht einen eigenen Decider —
mehr Regel, weniger Wirkung. Die Variante 1/1/1/2/2/2 tilgt Remis ebenfalls, lässt aber nur 46 %
der Kämpfe bis Platz 6 offen. **Platz 6 doppelt ist die kleinste Regel mit der größten Wirkung.**

**Was sich ändert:** `spieleBuehneDuell()` zählt Platz 6 doppelt (eine Zeile), `updateHudBuehne()`
dito, die Enthüllungsreihenfolge für Tennis (Platz 6 ans Ende der Warteschlange), Scoreline
„4 : 3". Bei jeSeite < 6 (Saison-Ziehung 2–6): der **letzte** besetzte Platz zählt doppelt — bei
geraden Feldgrößen tilgt das Remis, bei ungeraden war keins möglich. Zu messen: Teamwertung gegen
`runArenaFixtures()`, Spiegel (Platz 6 beginnt laut Parität mit Gast-Aufschlag — mit T-N2 wäre
zu prüfen, ob der Decider besser mit Los beginnt).

**Was es nicht ist:** keine Punktevergabe-Änderung, kein `rr()`, `summe` unberührt. rho/Pp auf
`summe` bit-identisch; die „ehrlichere Abnahme" (Star, Paartreue) über das Platzergebnis bleibt,
weil die Plätze selbst sich nicht ändern — nur ihr Gewicht.

### 3.4 T-N4 — Manager-Haltung „Angriff auf den großen Punkt" (Klasse M + B, Aufwand klein, nur mit T-N2)

**Chris' Idee, an Tennis angepasst.** Das 02.10.-Papier schlägt für die sechs Bühnen eine Haltung
Absichern/Normal/Angreifen als `h·Δ` an `buehneErfolgschance` vor — Tennis mit halbiertem Δ, weil
der rho-Puffer knapp ist. Das greift in den Wurf und braucht die volle Pp-Messung. **Hier der
andere Weg:** die Haltung wirkt nur in der Ergebnisschicht, als Verstärker des Clutch-Terms:

    Angreifen:  c_eigen = 1,5 · c      Normal: c      Absichern: 0,5 · c

Der Term trägt ein Vorzeichen aus der NERVEN-Differenz. **Angreifen vergrößert ihn in beide
Richtungen:** ein Spieler mit mehr NERVEN als sein Gegner übertrifft sich an großen Punkten, ein
Spieler mit weniger bricht genau dort ein — wörtlich Chris' „mehr risiko führt dazu dass jemand
sich evtl übertrifft oder unter dem druck einbricht". Absichern halbiert beides: wer nervenschwach
ist, verliert am Matchball weniger als er müsste, gewinnt aber auch nicht.

**Designregeln des 02.10.-Papiers, geprüft:** Normal ist bit-identisch zu T-N2 (Regel 1). Die
Obergrenze liegt im eigenen Korridor — der Term kann einen 15-Punkte-Eignungsabstand nicht
drehen, weil `imp` nur an wenigen Punkten groß ist (Regel 2). **Kein Knopf ist immer besser**
(Regel 3): Angreifen lohnt nur bei NERVEN über dem Gegner, und das weiß der Manager vorher nur
ungefähr (er kennt seine NERVEN, nicht die des Gegners auf diesem Platz). Zusatzwirkung außerhalb
der gewerteten Summe (Regel 4): `summe` sieht nichts. KI-Vorgabe deterministisch aus dem Kader
(Regel 5): Angreifen bei NERVEN ≥ 60, Absichern bei ≤ 40.

**Sichtbar im Spiel:** Ticker „Anweisung greift: ‹Name› geht am Matchball volles Risiko" (nur bei
`imp ≥ 0,5`), Anweisungsbilanz im Endstand („Angreifen: 3 große Punkte gewonnen, 1 verloren").
Beides Klasse A, sobald der Term existiert.

**Primär-/Nebenweg (Mehrwege-Leitlinie):** Der Primärweg zum Platz bleibt der Ballwechsel
(TECHNIK/GRUNDLAGE). Clutch + Haltung öffnen einen **Nebenweg über NERVEN**: ein Spieler mit
mittlerer Technik, aber 80 awareness/spirit, gewinnt seine Plätze an den großen Punkten — und
die Matrix sagt (awareness 20, spirit 18), dass er zu den Besseren gehören soll.

### 3.5 Nur zur Kenntnis — Klasse T, nicht gebaut, nicht empfohlen

Zwei Dinge aus der Recherche wären die stärksten Spannungsmittel und sind **genau deshalb**
Klasse T. Ich schreibe sie auf, damit Chris sie kennt, nicht damit sie jemand baut:

- **Die Hawk-Eye-Sekunde.** Am Matchball und am 6:6 die Enthüllung des nächsten Punkts um 1–2 s
  Wandzeit verzögern (Stand groß im Bild, Ballflug langsam) — das, was Tennis-Offizielle Hawk-Eye
  ausdrücklich abverlangt haben (2.5). Bei ~5 Matchbällen und einem 6:6 je Kampf wären das 8–12 s
  je Sendung. Wandzeit-Eingriff → Klasse T, dieselbe Kategorie wie D7/A4 (`broadcast-d7-a4-fable-
  empfehlung-02-10.md`), die bei Chris liegt. Wenn er sie für D7/A4 entscheidet, ist dies der
  Tennis-Fall derselben Entscheidung.
- **Die Satzpause.** Zwischen Platz 5 und dem Decider (T-N3) eine Pause mit Zwischenstand
  „3 : 2 — Platz 6 entscheidet" (wie F-F4 Perioden-Pause als Bild, dort ohne Wandzeit). Als
  Overlay über laufender Enthüllung Klasse A; als Pause Klasse T.

Alles Übrige in diesem Papier läuft im selben Enthüllungstakt wie heute (`rundenDauer`
60/(13·6·2) ≈ 0,385 s — die 13-Runden-Änderung aus T-F1 verteilt dieselben 60 s auf mehr
Punkte, Gesamtdauer unverändert).

---

## 4. Das Experiment — grobe Verträglichkeitsschätzung

**Was es ist.** Ein Scratch-Skript außerhalb des Repos (`tennis-match-stand-experiment.mjs`,
nicht committet), das die Rundenformel aus `setz()` (Ermüdung, Basis, Erfolgschance, Wagnisfaktor,
Fehlschlag ×0,55, PUBLIKUM ×0,12) und das Tennis-Rezept (`:15147 ff.`) nachbildet, synthetische
Spieler zieht (acht Attribute gleichverteilt 30–80, `eig` = Matrixgewichtung, Sub-Skills via
`mische`), 12 Kaderpaarungen × 150 Spiele × 6 Plätze rechnet und für jede Variante dieselben
Würfe verwendet. Gemessen: rho je Spiel auf `summe`, Paartreue über das **Platzergebnis** je
Eignungsabstand, Star gewinnt seinen Platz, Spiegel (jedes Spiel zusätzlich mit getauschten
Seiten), Drama-Zähler, ein grober Pp-Proxy (Korrelationsanteile der Attribute am Platzergebnis
gegen die Matrix — **kein** `messe-arena-einfluss`, nur eine Richtungsangabe) und zwei
Teamwertungen.

**Was es nicht ist.** Keine Messung am echten Motor, kein echter Kader (mein rho auf `summe`
liegt bei 0,68–0,74, der Motor kaderfest bei 0,81 — die synthetischen Attribute haben nicht die
Struktur echter Spieler), kein Slot-/Form-/Mutator-Zuschlag, kein Pp nach Projektmethode. Es
beantwortet nur: **in welche Richtung bewegt welche Regel welche Größe, und wie groß ist der
Hebel ungefähr.**

### 4.1 Platzentscheider

| Variante | Paartreue 2–5 | 5–10 | 10–15 | >15 | Star gewinnt | 6:6 | Matchball abgewehrt/Platz | Comeback | Pp-Proxy Platz |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **heute:** `vorteil`, 10 Runden | 71,5 % | 84,9 % | 97,2 % | 98,8 % | 91,7 % | — | — | — | 30 |
| `vorteil`, 13 Runden | 73,9 % | 88,4 % | 98,5 % | 99,9 % | 94,8 % | — | — | — | 27,5 |
| Rennen bis 7, H=0 | 84,2 % | 98,8 % | 98,7 % | 99,4 % | 97,9 % | 5,8 % | 0,44 | 2,8 % | 43,1 |
| **T-F1:** Rennen bis 7, H=10 | 66,5 % | 75,5 % | 94,1 % | 98,0 % | 92,1 % | 18,6 % | 0,86 | 5,8 % | 51,9 |
| Rennen bis 7, H=20 | 50,5 % | 59,9 % | 82,0 % | 95,1 % | 78,2 % | 22,2 % | 0,96 | 6,1 % | 62,8 |
| + Clutch 0,8 | 74,3 % | 83,0 % | 96,7 % | 98,8 % | 91,2 % | 16,1 % | 0,80 | 5,4 % | 31,9 |
| + Momentum 4 | 68,8 % | 85,0 % | 96,3 % | 98,2 % | 92,3 % | 16,0 % | 0,79 | 6,9 % | 29,7 |
| + Momentum 8 | 76,0 % | 92,1 % | 95,3 % | 99,3 % | 93,1 % | 11,8 % | 0,65 | 8,3 % | 22,6 |
| **T-N2:** Clutch 0,8 + Momentum 4 | 72,3 % | **90,8 %** | 96,1 % | 99,4 % | **94,6 %** | 14,5 % | 0,76 | 7,7 % | **24,5** |
| Clutch 1,6 + Momentum 8 | 73,5 % | 92,9 % | 96,4 % | 99,4 % | 96,2 % | 9,4 % | 0,60 | 7,9 % | 55,1 |

Lesart: rho auf `summe` ist in allen 13-Runden-Varianten identisch (0,735; 10 Runden 0,683) —
die Entscheiderregel berührt den Spielerwert nicht. Spiegel in allen Varianten 49,7–50,4 % im
Mittel über Original und Tausch. Clutch 1,6 + Momentum 8 zeigt die Grenze: Paartreue steigt
weiter, aber Drama fällt (6:6 nur 9 %) und der Pp-Proxy kippt (awareness 31 statt 20) —
**die Terme müssen klein bleiben**, genau wie Klaassen/Magnus es messen.

### 4.2 Was die Tabelle über die Mechanik sagt

- Das Platzergebnis hat ein **anderes Attributprofil** als `summe`. Im nackten T-F1 trägt
  intelligence 31 % (Matrix 22), awareness 12 % (Matrix 20), stamina 2 % (Matrix 12). Pp auf
  `summe` sieht davon nichts. Wer den Platzentscheider ändert, sollte Pp auch dort messen.
- Der Aufschlag-Zuschlag ist das einzige Eignungs-blinde Rauschen im Vergleich. Je größer H,
  desto mehr Drama und desto weniger Treue. Clutch/Momentum sind Rauschen, das Eignung kennt —
  darum heben sie beides.
- 13 statt 10 Runden heben rho auf `summe` (0,683 → 0,735) und die Paartreue im `vorteil`-Modus —
  die Fable-Erwartung („rho sollte eher steigen") hält in der Nachbildung.

### 4.3 Teamwertung

| Gewichte | Remis | stärkeres Team gewinnt* | offen bis Platz 5 | offen bis Platz 6 |
|---|---:|---:|---:|---:|
| **heute:** 1/1/1/1/1/1 | 33,9 % | 48,2 % | 93,4 % | 66,2 % |
| Laver 1/1/2/2/3/3 | 15,3 % | 58,6 % | 100 % | 64,1 % |
| **T-N3:** Decider 1/1/1/1/1/2 | 0,2 % | 62,8 % | 93,6 % | 66,6 % |
| steigend 1/1/1/2/2/2 | 0,0 % | 67,0 % | 93,6 % | 46,0 % |

\* Teams zufällig gezogen und meist fast gleich stark — die Spalte zeigt nur, dass Remis-Tilgung
mehr entschiedene Kämpfe ergibt, nicht ein rho. Mit T-N2 statt `vorteil` ändern sich die Werte um
wenige Prozentpunkte (Remis 32,3 / 14,8 / 0,0 / 0,0 %).

---

## 5. Klassen, Risiken, Reihenfolge

| # | Konzept | Klasse | Aufwand | rho auf `summe` | Pp | Größtes Risiko |
|---|---|---|---|---|---|---|
| T-N1 | Druckmesser: Stand `a:b`, Matchball/Abgewehrt/6:6/Comeback-Banner, Ticker-Dosis aus Wichtigkeit, Spannungsleiste | A\* | klein | bit-identisch | unberührt | ohne T-N2-Entscheider sagt die Tafel 7:5, der Platz geht über `vorteil` an den anderen |
| T-N2 | Rennen bis 7 als Platzentscheider + Clutch (NERVEN × Wichtigkeit) + Momentum | B, Entscheidung C | mittel | bit-identisch bis auf 13 Runden (eher +) | auf `summe` unberührt; **auf dem Platz neu messen** | Chris' Frage 1 (Platz darf Leistung widersprechen) offen; nacktes T-F1 ohne die Terme senkt die Paartreue |
| T-N3 | Decider-Platz: Platz 6 doppelt, zuletzt enthüllt, Aufstellung = Entscheidung | B + M | klein–mittel | bit-identisch | unberührt | Teamwertung muss gegen `runArenaFixtures()` und Spiegel bestehen; Saison-Datenmodell für „wer steht auf 6" |
| T-N4 | Haltung Angreifen/Normal/Absichern als Clutch-Verstärker | M + B | klein (nach T-N2) | bit-identisch | unberührt | braucht das Grundgerüst „Haltung" aus dem 02.10.-Papier (Zeile 0: Einsatzliste, Übergabe `{d,slot,haltung}`) — Chris' Antwort auf „eigene Achse oder Intensität umdeuten?" |
| — | Hawk-Eye-Sekunde, Satzpause | **T** | — | — | — | **nur Chris**, nicht gebaut |

**Empfohlene Reihenfolge:** (1) Chris' Entscheidung zu Frage 1 — ohne sie geht nur T-N3.
(2) T-N2-Entscheider + T-N1 in einer Runde (Tafel und Regel müssen dasselbe sagen), Clutch/
Momentum im selben Prototyp mitmessen, aber als getrennt schaltbare Konstanten. (3) T-N3 — klein,
unabhängig, tilgt das Drittel Remis. (4) T-N4, sobald das Haltungs-Grundgerüst steht.

---

## 6. Offene Fragen und Entscheidungen für Chris

1. **Darf der Platz der Leistung widersprechen?** (Frage 1 vom 30.09., unverändert offen.) Mit Ja
   wird T-N2 baubar; mit Nein bleibt Tennis bei `vorteil`, und T-N1 muss den Druckmesser über die
   verbleibenden Runden rechnen statt über ein Rennen — schwächer, aber möglich.
2. **Rennen bis 7 nackt (T-F1 wie im Fable-Papier) oder mit Clutch/Momentum?** Mein Experiment
   sagt: nackt kostet Paartreue; mit den Termen gewinnt sie. Beides ist Klasse B, die Terme sind
   die kleinere Zahl im Vergleich (c = 0,8, m = 4), aber die größere Design-Aussage („Nerven
   entscheiden große Punkte").
3. **Platz 6 doppelt — und wer steht dort?** Chris' Aufstellung (wie Fechtstaffel-Anker) oder
   Sortierung nach Eignung (wie Schach)? Ich empfehle die Aufstellung; die KI setzt ihren Besten.
4. **Haltung als eigene Achse** (Frage aus dem 02.10.-Papier) — Tennis bräuchte sie nur an großen
   Punkten; wenn Chris Intensität umdeutet statt eine Achse zu bauen, ließe sich „Pushen" hier als
   Angreifen lesen.
5. **Die Hawk-Eye-Sekunde** — Klasse T, dieselbe Entscheidung wie D7/A4. Ja, nein, oder nur bei
   6:6?
6. **Pp auf dem Platzergebnis als zweite Pflichtzahl für Duell-Disziplinen?** Keine Regeländerung,
   nur eine zusätzliche Sonde — aber eine, die CLAUDE.md heute nicht verlangt. Wenn Chris sie
   will, gehört sie in die Messpflicht für Tennis, Fechten und Schach gleichermaßen.

---

## Quellen

**Im Repo:** `public/mockups/battle-mode.engine.js` (`BUEHNE_ART.tennis` :15034, `rezept` :15147,
`buehneErfolgschance`/`buehneWagnisFaktor` :15538, `setz()` :15657, `art.duell`-Block :15797,
T-F1a-Vergleich :15887, `tennisAufschlagSeite`/`TENNIS_AUFSCHLAG_H` :15361/:15370, Break-Banner
:18477, `spieleBuehneDuell` :45166), `lib/player-generator/official-discipline-weights.ts`,
`docs/design/manager-risiko-interaktivitaet-konzept-02-10.md`,
`docs/design/fable-ideen-buehne-duell-30-09.md`, `docs/design/tennis-feinschliff-recherche-21-09.md`,
`docs/design/f1-broadcast-audit-runde-2-30-09.md`, `docs/design/broadcast-d7-a4-fable-empfehlung-02-10.md`,
`docs/design/fable-ideen-bahn-30-09.md` (Klassenschema 0.5), PR #1135, CLAUDE.md.

**Internet (abgerufen 03.10.2026):**
- Morris (1977) via [evidently.substack.com — The points that matter](https://evidently.substack.com/p/the-points-that-matter)
- Klaassen & Magnus (2001), JASA 96(454) — [Tilburg University Research Portal](https://research.tilburguniversity.edu/en/publications/are-points-in-tennis-independent-and-identically-distributed-evid/)
- [inpredictable.com — Tennis matches and luck](https://www.inpredictable.com/2014/07/tennis-matches-and-luck.html)
- [tennisabstract.com — Do Players Get Broken More Often After Failing to Convert Break Point?](https://tennisabstract.com/blog/?p=1717)
- [tennisabstract.com — The Hot Hand in Reverse at 30-40](https://www.tennisabstract.com/blog/?p=570)
- [tennisabstract.com — The Likelihood of Live Doubles Rubber in the New Davis Cup](https://tennisabstract.com/blog/?p=3779)
- [popsci.com — US Open instant replay](https://www.popsci.com/scitech/article/2006-09/us-open-instant-replay-total-accuracy-major-fun) (Vorbehalt s. 2.5)
- [au.sports.yahoo.com — Federer, Hopman Cup Hawk-Eye](https://au.sports.yahoo.com/hopman-cup-roger-federers-hilarious-rollercoaster-of-emotions-38472343.html)
- [atptour.com — Next Gen ATP Finals 2025 rules](https://www.atptour.com/en/news/next-gen-atp-finals-presented-by-pif-2025-rules-and-innovations), [braingametennis.com](https://braingametennis.com/nextgen-scoring-format-is-the-future) (Vorbehalt s. 2.6)
- [Wikipedia — Ultimate Tennis Showdown](https://en.wikipedia.org/wiki/Ultimate_Tennis_Showdown), [tennishead.net — UTS guide](https://tennishead.net/ultimate-tennis-showdown-begins-today-how-it-works-and-who-is-playing/)
- [Wikipedia — Laver Cup](https://en.wikipedia.org/wiki/Laver_Cup), [Wikipedia — Dead rubber](https://en.wikipedia.com/wiki/Dead-rubber)
- [atptour.com — Djokovic/Federer Wimbledon 2019 analysis](https://www.atptour.com/en/news/djokovic-federer-wimbledon-2019-final-match-analysis), [eurosport.com](https://www.eurosport.com/tennis/wimbledon/2019/wimbledon-2019-novak-djokovic-downs-roger-federer-in-epic-after-final-set-tie-break_sto7373082/story.shtml)
- Momentum-Forschung (gemischte Evidenz): [arxiv 2009.05830 — Hot Racquet or Not?](https://arxiv.org/pdf/2009.05830), [arxiv 2509.01243](https://arxiv.org/html/2509.01243v1)
