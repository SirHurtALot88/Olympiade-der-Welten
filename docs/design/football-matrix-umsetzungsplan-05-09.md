# Football: Matrix-Umsetzungsplan — die drei offenen Fragen entschieden, nachgemessen, umsetzungsreif (05.09.)

Reine Planung, kein Code auf `main`. Fortsetzung von `football-matrix-und-assets-recherche-05-09.md`
(PR #790), das eine neue Football-Gewichtstabelle vorgeschlagen und drei Fragen an Chris offen
gelassen hat. Chris' Ansage vom selben Tag — „mach weiter mit den 3 offenen … lass fable das
planen und wenn das soweit durch ist review noch mal ingame" — ist die Freigabe, die drei Fragen
selbst zu entscheiden. Das tut dieses Dokument, mit Zahlen: alles unten ist an der echten
Kaderfamilie (110 Spieler, fünf Paarungen), an der **ganzen Liga** des live-save-Abbilds
(2984 Spieler mit Attributbogen) und am Motor nachgemessen, in einem eigenen `git worktree`,
über exakt die Werkzeuge, die auch die Umsetzung nutzen würde (Generator, Sondierung, Sinkhorn,
`miss-alle-disziplinen.mjs`). Nichts davon ist auf `main` gelandet.

---

## 0. Ergebnis vorab

**Die drei Entscheidungen** (Herleitung in Abschnitt 3):

1. **Scope: nur die Football-Spalte, aber in der produktiven Tabelle.** Das Rating-System ist
   von Haus aus je Disziplin gebaut — `officialDisciplineWeightTable[attribut][disziplin]` —,
   die anderen neunzehn Spalten bleiben byte-identisch, der Generator-Diff im Motor umfasst
   genau 14 Zeilen (Football-Matrix und die sechs Football-Slotprofile). Eine
   „nur-Arena"-Variante gibt es **nicht**: der Feldspiel-Motor liest die Eignung aus
   `p.d.football`, also aus dem gespeicherten Produktionsrating — eine handgeänderte
   `BASIS_JE_DISC.football` würde die Zielgröße gar nicht bewegen, nur die Slot-Zuschläge.
   Produktionsweit ist die Änderung deshalb zwangsläufig, aber nur für Football.
2. **Rangbild: ja, das neue Bild ist das richtige.** Heute sind die zwölf besten
   Football-Spieler der Liga zehn Tacticians/Heroes — spirit/awareness/will. Neu sind es
   Tanks, Berserker, Charger, Templar (The D, Tentakulus, Fleshbreed, Pyrrhakos, Brujo Oso).
   „Die Liebenden" (power 1, speed 1) fallen von 68 auf 22. Das ist kein Nebeneffekt, das ist
   der Zweck.
3. **torment 12, nicht 16.** Die beiden Tabellen ordnen die Liga zu rho 0,996 gleich (mittlere
   Rangverschiebung in der Kaderfamilie: 2 Plätze, maximal 10). Gemessen liegt jede Differenz
   innerhalb der Kader-Spannweite. Die Evidenz für Aggression als Eignungsmerkmal ist
   positionsgebunden (Defensive Line), die für Masse und Kraft ist der Grundton der Sportart —
   deshalb bekommt power die vier Punkte, nicht torment.

**Der Befund, der die Umsetzung bestimmt:** Die Matrix allein **senkt** die Rangtreue — von
0,468 auf 0,121 je Spiel. Das ist kein Argument gegen die Matrix, sondern die Bestätigung
dessen, was CLAUDE.md „Validität" nennt: das Rezept (`LAUFKRAFT: spirit 56 …`) belohnt heute
exakt die alte Matrix; verschiebt man die Zielgröße, belohnt es das Falsche. **Matrix und
Rezept müssen in EINEM Zug wechseln.** Mit einem gegen die neue Matrix sondierten und per
Sinkhorn verteilten Rezept steht Football bei **0,520 je Spiel und 0,806 über die Saison**
(Spannweite 0,241 / 0,139; heute 0,468 / 0,671 bei 0,383 / 0,420) — Abschnitt 4. Ehrlich
gelesen heißt das: die Matrix repariert die **Validität** (Saison 0,67 → 0,81, Spannweite
drittelt sich), die Einzelspielzahl bleibt bei ~0,5, weil Footballs **Verlässlichkeit** nur
0,42 beträgt (Hockey: 0,755) — ein Spiel hat zu wenige, zu stark verloste Ereignisse. Die
0,80 je Spiel sind mit dieser Runde nicht erreichbar; sie werden es erst mit einer
Ereignis-/Losrunde am Motor, die als nächster Football-Schritt in 5.9 steht.

**Was die Umsetzung konkret ist** (Abschnitt 5): zwölf Zahlen in
`lib/player-generator/official-discipline-weights.ts`, ein Generatorlauf, sechs Rollenzeilen in
`lib/lineups/matchday-slot-roles.ts`, die Rezept-Werkzeugtabelle in
`scripts/baue-feldspiel-rezept.mjs`, der Rezeptblock in `battle-mode.engine.js`, plus ein
kleiner Schalter für `scripts/ziehe-kader-familie.ts`, ohne den jede Messung nach der Änderung
gegen die ALTE Eignung liefe.

---

## 1. Ausgangslage

| | |
|---|---|
| Matrix heute (`official-discipline-weights.ts`, Spalte `football`) | spirit 25, torment 16, health 14, awareness 11, will 10, determination 8, power 6, stamina 6, charisma 4 |
| Vorschlag aus PR #790 | power 22, health 18, speed 14, torment 12, determination 10, awareness 8, stamina 6, dexterity 4, spirit 3, will 3 |
| Rangtreue heute (kaderfest, 24 Spiele × 5 Paarungen) | **0,468** je Spiel (Spannweite 0,383) / 0,671 Saison (0,420) — in dieser Runde reproduziert |
| Abnahme | rho je Spiel über 0,80, angestrebt 0,85 (CLAUDE.md) |
| Verdrahtung | Tabelle → `rebuildLeagueDisciplineRatings` (Ligarang → `rank-to-discipline-stat.json`) → `player.disciplineRatings.football` → Arena-Adapter `p.d.football` → `bauFeldspiel` `eig` |

Zwei Dinge, die die Vorgängerrunde noch nicht wusste:

- **Das gespeicherte Rating ist exakt reproduzierbar.** `buildLeagueDisciplineRatingsForPlayers`
  über alle 2984 Spieler mit der heutigen Tabelle liefert für 2982 den gespeicherten
  `disciplineRatings.football` auf 0,05 genau (die zwei Abweichler sind Spieler, deren
  Attribute sich seit dem letzten Saisonende geändert haben). Damit lässt sich jede
  Kandidatenmatrix **über den Produktionspfad** in die Kaderfamilie schreiben — statt über den
  Motor-Rückfall `gewichtet(p.a, …)`, der eine andere Skala hat. So sind alle Messungen unten
  entstanden.
- **Die Ratings werden nur an Saisonübergängen neu gerechnet** (`preseason-workflow-service.ts`,
  `season-end-xp-apply-service.ts`; `discipline-stage-data.ts` rechnet nur nach, wenn ein Rating
  ganz fehlt). Eine geänderte Tabelle wirkt im laufenden Spielstand also erst mit dem nächsten
  Saisonwechsel — das ist die eingebaute „hinter einem Saisonwechsel"-Sperre, die PR #790
  gefordert hat. Umgekehrt heißt es: `ziehe-kader-familie.ts` würde nach der Änderung weiter die
  ALTEN Ratings ziehen (Abschnitt 5.5).

---

## 2. Vertiefte Recherche

### 2.1 Was der Combine je Positionsgruppe misst — und was davon vorhersagt

Positionsdurchschnitte (Ourlads, Combine 2018; Gil-Brandt-Schwellen aus CBS 2020 in Klammern):

| Position | Gewicht | 40 Yards | Bench | Vertical | 3-Cone |
|---|---:|---:|---:|---:|---:|
| OT / OG / C | 308 / 315 / 305 lb | 5,24 / 5,29 / 5,22 s (5,20) | 22 / 29 / 25 | 27" (30) | 7,8 s (7,85) |
| DT / DE | 306 / 270 lb | 5,12 / 4,82 s (5,10) | 29 / 25 | 29" / 33" (31) | 7,6 / 7,3 s |
| ILB / OLB | 238 / 244 lb | 4,70 / 4,67 s (4,75) | 21 | 34,6" (34,5) | 7,0 s |
| RB | 217 lb | 4,59 s (4,55) | 17 | 34,6" (36) | 7,00 s |
| WR / CB / S | 203 / 194 / 209 lb | 4,53 / 4,52 / 4,53 s (4,50) | 14–18 | 35–36,6" (36) | 6,8–6,9 s |
| QB | 221 lb | 4,87 s (4,90) | — | 29,5" (30) | 7,12 s |

Was davon NFL-Leistung vorhersagt (alle Quellen im Anhang):

- **SumerSports** (Positionsgruppen gegen Produktion): nur 5 von 11 Gruppen erreichen überhaupt
  r ≈ 0,30. Inside Linebacker: alle Sprinttests über 0,30. Cornerback: 40 Yards gegen Snaps.
  Offensive Tackle: alles „konsistent über 0,20", nichts darüber. Wide Receiver: **kein** Test
  über 0,30. Safety: nichts über 0,25.
- **Sports Info Solutions** (Combine gegen Total Points, 2023): **keine** Korrelation über 0,40,
  in keiner Position. Offense wird am ehesten von Unterkörper-Explosivität (Vertical, Broad)
  vorhergesagt, Defense von Geschwindigkeit. Defensive Line gespalten: Pass Rush hängt an
  Speed/Sprüngen, **Run Defense an Gewicht und Bench**.
- **Kuzmits & Adams 2008** (JSCR): 1999–2004, QB/RB/WR — nur der Sprint bei Running Backs
  korreliert konsistent; für QB und WR gar nichts.
- **Sport Journal** (Draft-Status): gedraftete Linemen sind messbar besser in Bench, 40 und
  3-Cone als ungedraftete; über alle Positionen sind schnellerer 40, höherer Vertical, mehr
  Bench, weiterer Broad Jump mit besserer Draftposition verbunden.

Lehre für eine Sechs-gegen-Sechs-Abstraktion ohne Positionen: **Masse/Kraft (power, health) ist
der gemeinsame Nenner aller 22 Positionen, Sprint (speed) der einzige Einzelwert mit belastbarer
Vorhersagekraft, alles Kognitive misst nichts** (Wonderlic: Lyons/Hoffman/Michel 2009 — null).
Das stützt die Reihenfolge power > health > speed des Vorschlags.

### 2.2 Wie Madden ein Overall baut

- **Olson 2017** (Regression über Madden-17-Ratings): Awareness dominiert die OVR-Formel fast
  jeder Position, Speed zählt „selbst bei HB/WR/CB überraschend wenig". Strong Safety: Play
  Recognition vor Awareness.
- **Madden-12-Aufschlüsselung** (Madden Manniac): Center AWR ≈ 20 %; SS Hit Power 6 % („höchster
  Anteil für einen Defensivspieler"); bei RB/WR halten CAT/RTE den OVR nach unten; CB: Catching
  wirkt gar nicht.
- **Attribut-Semantik** (Madden-25-Guide): Strength speist Blocken, Block-Shedding, Power Moves,
  Trucking; Toughness = Verletzungsdauer, Injury = Verletzungshäufigkeit; Hit Power erzeugt
  Fumbles.

Zwei Lehren: (a) Madden ist eine Spiel-, keine Empirie-Formel — AWR ist dort zu einem großen
Teil ein Alters-/Erfahrungsproxy und kein Beleg dafür, dass Wahrnehmung Football-Eignung IST.
Deshalb awareness 8, nicht 11. (b) Was Madden „Strength" und „Toughness/Injury" nennt, ist bei
uns **power** und **health** — genau die beiden Attribute, die der Vorschlag nach vorn zieht.

### 2.3 Was `torment` und `spirit` in dieser Welt sind — und was sie im Football tun sollten

Herkunft im System: beide sind Proxys der **sozialen Achse** (`SOC = charisma + spirit +
torment`, `PLAYER_GENERATOR_PLAN.md`; Importplan: „Spirit → Proxy aus soc, Torment → Proxy aus
soc"). Die Archetypen legen die Polarität fest: **Demon** `torment +10, spirit −4`, **Angel**
`spirit +10, torment −8`, **Pirate** `torment −5`, Berserker-nahe Archetypen `torment +10, power
+6`. `torment` ist also die dunkle Sozialkraft — Einschüchterung, Härte, Regelbruch —, `spirit`
die helle — Moral, Teamgeist, Haltung. Auf dem echten Kader stehen sie mit **−0,58**
gegeneinander; ein Spieler hat fast nie beides.

Was die Empirie über die dunkle Seite sagt:

- **Trash Talk wirkt** (Yip, Schweitzer & Nurmohamed 2018, OBHDP): experimentell erhöht es beim
  Ziel Rivalität und Anstrengung, senkt kreative Leistung, fördert Regelbrüche. Die NFL hat 2021
  Taunting zum Point of Emphasis gemacht — der Effekt ist real genug, um reguliert zu werden.
- **Aggressive Spieler halten länger durch** (BEJEAP 2019, „Risk Taking and Aggression On and
  Off the Field"): Spieler mit Verhaftungsakte begehen signifikant mehr aggressionsbezogene
  Strafen; Wiederholungstäter haben **bessere Karriereleistung und längere Karrieren** als
  Unbescholtene.
- **Aber nur auf einer Position**: Crist (CMC 2016) findet, dass eine Verhaftungsakte
  ausschließlich bei **Defensive Linemen** mit besserer Leistung einhergeht — „Aggression und
  Gewalt sind dort wichtiger". Bei QB/RB/WR nichts.
- **Draft unterschätzt den Charakter-Malus** (Univ. of Georgia/ScienceDaily 2015, 1200+
  Spieler): Verhaftete ohne Anklage übertreffen die Erwartung; Angeklagte spielen gleich gut,
  werden aber 15 Plätze später gezogen.
- **Persönlichkeit ≠ Sportart** (Keeler 2007): keine Aggressionsunterschiede zwischen
  Kollisions-, Kontakt- und Nicht-Kontakt-Athleten.
- **Strafen sind kein stabiles Teammerkmal** (Open Source Football 2021): Defensivstrafen sind
  Jahr zu Jahr „extrem fluky"; Offense kontrolliert ihre Strafen, Defense kaum.

Gelesen als Eignungsdesign: `torment` ist ein **realer, positionsgebundener** Football-Faktor
(Line, Pass Rush, Run Defense) — hoch genug, um Platz 4 zu verdienen, zu eng, um vor power zu
stehen. Das ist die 12. `spirit` als Nummer eins war die Basketball-Ära (`football-rollout-plan.md`
Teil D); im Football gibt es dafür weder Combine-, noch Madden-, noch Persönlichkeitsevidenz. Die
3 halten `TEAMGEIST` als Rezeptkanal am Leben, mehr nicht.

Was mentale Härte angeht (die Vorgängerrunde hatte sie unter `spirit` verbucht): Mental Toughness
sagt Leistung **unter Druck** voraus (Research Square 2025; PMC-Studien zu Fußball), aber nicht
die Rangfolge über ein ganzes Spiel — und in einer Studie an Elite-Fußballerinnen (PMC 2023)
sagten Mental Toughness und Grit Leistung gar nicht voraus, nur Mastery-Klima und Extraversion.
Das ist Momente-Modellierung (vierter Down), keine Matrixgröße. Sie gehört, wenn überhaupt, in
`determination` (10) — dort steht sie.

### 2.4 Die zwölf Attribute, auf Football übersetzt

| Attribut | Football-Bedeutung | Combine-/Madden-Entsprechung | Gewicht |
|---|---|---|---:|
| power | Anker, Drive, Trucking, Power Moves, Hit Power | Bench, Gewicht; STR/POW/PMV/TRK | **22** |
| health | Masse, Kontaktbalance, Snap-für-Snap-Belastbarkeit | Gewicht; TGH/INJ | **18** |
| speed | Sprint, Closing Speed, Separation | 40 Yards, 10-Yard-Split; SPD/ACC/PUR | **14** |
| torment | Einschüchterung, Härte, Taunting, Pass Rush „violence" | Aggressionsstrafen-Evidenz (DL) | **12** |
| determination | Vierter Down, Motor, Effort in Pursuit | „competitive toughness" im Scouting | **10** |
| awareness | Play Recognition, Lesen von Coverage/Blitz | PRC/AWR — als Mechanik, nicht als Proxy | **8** |
| stamina | 60+ Snaps, vierte Viertel | STA | **6** |
| dexterity | Hände (Catching, Hand Placement), Change of Direction | 3-Cone, Shuttle; CTH/AGI | **4** |
| spirit | Teamgeist, Moral — Kreditkanal für den Receiver | — | **3** |
| will | Standhalten, Pocket-Ruhe | — | **3** |
| charisma | Locker Leader — kein Feldwert | — | 0 |
| intelligence | Wonderlic sagt nichts voraus | — | 0 |

Summe 100. Gegenüber Hockey (`power 18, health 18, speed 12, spirit 12, stamina 10, torment 10,
awareness 8, …`) bewusst eine Stufe wuchtiger und deutlich weniger spirit.

---

## 3. Die drei Entscheidungen

### 3.1 Scope: Football-Spalte in der Produktionstabelle — und warum es keinen dritten Weg gibt

Die Frage aus PR #790 lautete „Football-spezifisch oder produktionsweit?". Nachgesehen ist sie
falsch gestellt, weil beides zugleich zutrifft:

- **Football-spezifisch ist die Änderung strukturell.** Die Tabelle ist nach Attribut × Disziplin
  geschlüsselt; `officialDisciplineWeightMatrix` baut daraus je Disziplin ein eigenes Objekt.
  Geändert werden zwölf Zellen der Spalte `football`. Der Generatorlauf (`generiere-arena-daten.ts
  --schreiben`) ändert im Motor **14 Zeilen**: die Zeile `"football": {…}` in `BASIS_JE_DISC` und
  die sechs Einträge unter `SLOTS_JE_DISC.football` (nachgesehen per `git diff` im Worktree).
  Basketball, Hockey und alle anderen bleiben byte-identisch — sie lesen andere Spalten.
- **Produktionsweit ist sie im Wirkungsbereich Football.** Alle 20 Leser der Tabelle
  (`team-powers.ts` Attribut-Fit, `organic-season-progression.ts` Trainingsrichtung,
  Scouting-Decken, Transfermarkt-Linse, KI-Bedarf über `disciplineRatings`) sehen für Football
  neue Zahlen. Gemessen an der ganzen Liga (2984 Spieler, Produktionspfad):

  | | Wert |
  |---|---:|
  | Spearman-rho altes gegen neues Football-Rating (Liga) | **0,523** |
  | mittlere absolute Rating-Änderung | 13,3 Punkte |
  | Spieler, die sich um ≥ 20 Punkte bewegen | 722 (24 %) |
  | Spieler, die sich um ≥ 30 Punkte bewegen | 199 (7 %) |
  | Teams, deren Football-Rang (Mittel der besten 6) sich um ≥ 10 Plätze verschiebt | 9 von 32 |

  Größte Teambewegungen: The Giants 21 → 3, Hell Raisers 13 → 2, Raging Lunatics 23 → 7,
  Death Peaches 10 → 28, The Chantry 16 → 32, Royal Court 7 → 20. Das ist die ehrliche Größe
  des Blast-Radius: **eine Disziplin von zwanzig, dort aber ein neues Kräfteverhältnis.**

- **Eine Arena-only-Variante existiert nicht.** `bauFeldspiel` liest
  `basisWert = p.d[feldspielDisc] != null ? p.d[…] : gewichtet(p.a, BASIS_JE_DISC[…])`
  (`engine.js:5391`), und der Arena-Adapter füllt `p.d` mit `player.disciplineRatings`. Eine von
  Hand geänderte `BASIS_JE_DISC.football` bewegt also die Eignung **nicht** — nur die
  Slot-Zuschläge (`slotAufschlag`/`mitAufschlag`). Nachgemessen: Matrix im Motor patchen und die
  Kaderfamilie unverändert lassen ergibt eine Zahl, die nichts über die neue Matrix sagt.
  Wer die Zielgröße ändern will, muss sie dort ändern, wo sie entsteht.

**Empfehlung: Variante A, Spalte `football` der Produktionstabelle, in einem PR mit Generator,
Rollen, Rezept und Kaderfamilien-Schalter.** Der Wirkungszeitpunkt im Spielstand ist von selbst
der nächste Saisonwechsel (Abschnitt 1); für den Fall, dass Chris das neue Bild sofort sehen
will, steht in 5.6 ein optionaler Einmal-Rebuild.

### 3.2 Rangbild — plausibel, und zwar auf beiden Ebenen

**Kaderfamilie (110 Spieler, Produktionsrating alt → neu, torment 12 / torment 16):**

| Spieler | Klasse / Rasse | Team | alt | neu 12 | neu 16 | power/health/speed/torment/spirit |
|---|---|---|---:|---:|---:|---|
| Ser Camelot | Bard / Human | Cold Steel | 72 | 45 | 45 | 60/71/28/38/87 |
| Johanna | Templar / Human | Vigilante Wranglers | 70 | 46 | 47 | 56/81/23/69/68 |
| Vorrak | Tank / Construct | Silver Soldiers | 68 | 64 | 64 | 79/99/5/71/36 |
| Die Liebenden | Tank / Human | Dire Legion | 68 | **22** | 21 | 1/99/1/2/98 |
| Elyon | Templar / Divine | Golden Gladiators | 68 | 45 | 44 | 65/70/18/46/75 |
| Midas | Hero / Demon | Cold Steel | 65 | 41 | 40 | 60/63/18/37/79 |
| Krolach | Templar / Construct | Vigilante Wranglers | 64 | 59 | 57 | 86/88/20/64/45 |
| Umbrafond | Berserker / Plant | Raging Lunatics | 63 | **92** | 90 | 88/79/65/76/34 |
| Angrod | Badass / Human | Dire Legion | 63 | 49 | 50 | 63/42/57/71/69 |
| Erna Wellenlaut | Bard / Aqua | Golden Gladiators | 61 | 27 | 26 | 16/48/28/6/92 |

Die neue Spitze derselben 110:

| Spieler | Klasse / Rasse | Team | alt | neu 12 | neu 16 | power/health/speed/torment/spirit |
|---|---|---|---:|---:|---:|---|
| Umbrafond | Berserker / Plant | Raging Lunatics | 63 | **92** | 90 | 88/79/65/76/34 |
| Tidesprinter | Berserker / Aqua | Armageddon Aftermath | 41 | **79** | 79 | 80/51/89/78/5 |
| Brontar | Tank / Construct | Silver Soldiers | 48 | 70 | 66 | 90/95/40/41/30 |
| Terradon | Warlord / Construct | Golden Gladiators | 38 | 69 | 67 | 86/98/82/55/14 |
| Reefstrike | Berserker / Aqua | Cold Steel | 42 | 67 | 69 | 70/71/72/75/26 |
| Tavascron | Berserker / Construct | Silver Soldiers | 48 | 66 | 66 | 92/74/48/84/38 |
| Vorrak | Tank / Construct | Silver Soldiers | 68 | 64 | 64 | 79/99/5/71/36 |
| Radditz | Charger / Animal | Raging Lunatics | 44 | 62 | 61 | 66/69/82/43/41 |
| Buttercup | Charger / Animal | Natures Wrath | 44 | 62 | 60 | 81/70/89/44/71 |
| Nytharos | Berserker / Animal | Raging Lunatics | 38 | 60 | 62 | 84/9/78/93/19 |

**Ganze Liga, Top 12:** heute Marrow, Severiel, Warpriest, Murkavon, Hell Architect, Depholia,
Deep, Lyranael, Morkel, Lyssara, Zargron, Ra — **acht Tacticians**, zwei Heroes, ein Templar,
ein Warlord. Neu: The D (Tank/Demon), Tentakulus (Tank/Aqua), Fleshbreed (Templar/Demon),
Pyrrhakos (Tank/Lizard), Brujo Oso (Charger/Animal), Lyranael (bleibt, 97 → 98), Kelektros
(Berserker/Dragon), Malagor, Morak, Teerblut, Kargath, Thunderhorn — Tanks, Berserker, Charger.
Klassen in den Top 20 der Kaderfamilie: alt Bard 5, Tank 5, Hero 4, Templar 3; neu Berserker 5,
Tank 4, Charger 4, Warlord 3.

Urteil: Eine Sportart, deren Liga-Elite aus Tacticians besteht, ist Speed-Schach in Helmen. Eine,
deren Elite Tanks, Berserker und Charger sind — mit einem Templar (Lyranael) und einem Warlord
(Hell Architect, 98 → 93) darunter — sieht aus wie eine Offensive Line mit Backfield. Reine
Sprinter bleiben Mittelfeld (Lulu: speed 71, power 3 → 21). **Das Bild stimmt.** Sollte Chris beim
Ingame-Review widersprechen, ist die Konsequenz Weg B aus `football-matrix-entscheidung.md`
(Schauspiel-Disziplin), nicht eine dritte Zwischenmatrix — die „sanfte Variante" aus PR #790 hat
gezeigt, dass Halbherzigkeit die Trennschärfe nicht bringt.

### 3.3 torment 12 oder 16 — 12, mit Zahlen

| | torment 12 (power 22) | torment 16 (power 18) |
|---|---:|---:|
| rho zur alten Eignung (Kaderfamilie) | 0,427 | 0,415 |
| rho zwischen beiden (Kaderfamilie / Liga) | **0,996 / 0,996** | |
| mittlere Rangverschiebung 12 → 16 (110 Spieler) | 2,0 Plätze, max. 10 (Webweaver, Faith) | |
| Paare ≥ 15 Punkte Abstand im Kader | 38 % | 38 % |
| SD der Eignung | 12,3 | 12,0 |
| rho je Spiel, Matrix allein (altes Rezept) | 0,121 | 0,185 |
| rho je Spiel, Matrix + Sinkhorn-Rezept (gleiche ERLAUBT, spirit/torment als TEAMGEIST) | 0,453 (0,313) | 0,474 (0,426) |
| rho Saison, dito | 0,722 (0,545) | 0,741 (0,545) |
| rho je Spiel / Saison, bestes Rezept je Tabelle | **0,520 / 0,806** (H) | 0,474 / 0,741 (J) bzw. 0,441 / 0,762 (K) |

Die beiden Tabellen sind **dieselbe Rangordnung** — was sie unterscheidet, liegt innerhalb der
Kader-Spannweite (0,4–0,5) und ist damit per Definition der Messgrundlage von Null nicht zu
unterscheiden. Die Entscheidung fällt deshalb inhaltlich:

- Für 16 spricht der Stil („Football als Disziplin der Bösewichte") und die BEJEAP-Evidenz, dass
  aggressive Spieler länger und besser spielen.
- Für 12 spricht, dass diese Evidenz **nur bei Defensive Linemen** trägt (Crist), dass
  Persönlichkeitsaggression nicht sportartspezifisch ist (Keeler), dass Strafen als Teammerkmal
  instabil sind — und dass power der Faktor ist, der bei **allen** Positionsgruppen zieht (SIS:
  Run Defense = Gewicht und Bench; Sport Journal: Linemen-Bench; Madden: STR speist Blocken,
  Shedding, Trucking). Vier Punkte von power nach torment nehmen also dem Grundton, um einer
  Positionsnische zu geben.
- Kosmetisch: bei 16 wird im generierten Slotprofil `linepower` torment (19,4) das Topattribut
  vor power (16,9) — „Line Power gewinnt Kontakt über Torment" liest sich falsch, über Power
  richtig.

**torment 12.** Wer die Welt dreckiger will, dreht später am Rezept (`ABWEHR_LAUF`,
`ABWEHR_PASS`), nicht an der Matrix — dort wirkt es gezielt auf die Defensivrollen, so wie die
Evidenz es beschreibt.

---

## 4. Kaderfest nachgemessen — Matrix allein, Matrix mit Rezept

Alle Läufe: `node scripts/miss-alle-disziplinen.mjs 24 football`, Kaderfamilie mit
`d.football` **über den Produktionspfad** neu gerechnet (Rohscore → Ligarang über 2984 Spieler →
`rank-to-discipline-stat`), Motor über den Generator aus der gepatchten Tabelle erzeugt. Alle
Zahlen sind Median über fünf Paarungen, Spannweite in Klammern.

| Lauf | Tabelle | Rezept | rho je Spiel | rho Saison |
|---|---|---|---:|---:|
| A — Stand `main` | alt | alt | **0,468** (0,383) | 0,671 (0,420) |
| B — Matrix allein | t12 | alt | 0,121 (0,532) | 0,228 (0,580) |
| C — Matrix allein | t16 | alt | 0,185 (0,502) | 0,196 (0,699) |
| D — Matrix + Rollen umgehängt | t12 | alt | 0,085 (0,399) | 0,224 (0,469) |
| E — Matrix + Sinkhorn-Rezept, TEAMGEIST ← spirit, torment (ERLAUBT aus PR #790, 2.5) | t12 | neu | 0,453 (0,313) | 0,722 (0,545) |
| F — wie E, TEAMGEIST ← speed, awareness, dexterity | t12 | neu | 0,407 (0,255) | 0,671 (0,245) |
| G — wie E, TEAMGEIST ← speed, awareness, dexterity, health | t12 | neu | 0,453 (0,316) | 0,713 (0,268) |
| **H — wie E, TEAMGEIST ← power, health, speed** | **t12** | **neu** | **0,520 (0,241)** | **0,806 (0,139)** |
| I — wie E, TEAMGEIST ← power, health, speed, awareness, dexterity | t12 | neu | 0,478 (0,203) | 0,706 (0,146) |
| J — wie E (eigene Sondierung) | t16 | neu | 0,474 (0,426) | 0,741 (0,545) |
| K — wie G | t16 | neu | 0,441 (0,272) | 0,762 (0,385) |

**Lesart nach CLAUDE.md, zwei Spalten.** In B und C fallen Saison UND Einzelspiel: die Mechanik
belohnt das Falsche — sie belohnt nämlich weiter die alte Matrix (`LAUFKRAFT` zu 56 % spirit,
`PASSGENAUIGKEIT` aus will und determination, `BALLSICHERHEIT` aus health und will). Die
Zielgröße ist umgezogen, das Rezept nicht. Das ist der Beweis für die Aussage der
Vorgängerrunde, dass Validität im Rezept sitzt: **die Matrix ändert, WEN der Motor belohnen
soll; das Rezept entscheidet, WEN er belohnt.** D zeigt, dass Rollen-Umhängen ohne Rezept nichts
rettet (die Slot-Zuschläge sind ±8,5 Punkte auf einer 40-Punkte-Spanne).

**E bis K: die Mechanik belohnt wieder das Richtige — und der Engpass wandert.** Mit Rezept H
steht die Saisonzahl bei 0,806 und ihre Spannweite bei 0,139 (heute 0,420): die Validität ist
repariert, kaderunabhängig. Die Einzelspielzahl steigt nur auf 0,520 — ein Plus von 0,05, das
innerhalb der Spannweite liegt und nach `messgrundlage-kaderfest.md` nicht als Verbesserung
gilt. Nach der CLAUDE.md-Formel rho(Spiel) = rho(Saison) × √Verlässlichkeit heißt das:
Verlässlichkeit (0,520/0,806)² = **0,42** — gegen 0,755 bei Hockey. Ein Football-Spiel sagt das
nächste nur zur Hälfte voraus, weil es aus rund einem Dutzend Drives besteht, deren
Ballberührungen per `gewichtetesLos` verlost werden. **Das ist der eine Fall, in dem
CLAUDE.md's „mehr Ereignisse helfen fast nie" nicht greift**: Hockey war schon bei 0,755, Football
liegt bei 0,42 — hier ist die Uhr (bzw. das Los) der Hebel, nicht das Rezept. Deshalb steht in
5.9 eine Ereignis-/Losrunde als nächster Schritt, und die Abnahme dieser Runde ist die
Saisonzahl, nicht die Einzelspielzahl.

**Warum H gewinnt — und was das über den Motor sagt.** Die Sondierung unten misst für
`TEAMGEIST` **49,6 %** mechanisches Gewicht — es ist seit der Kalibrierung vom 04.09. das
Receiver-Los, und der Receiver bekommt in dieser Sechs-gegen-Sechs-Abstraktion den Löwenanteil
der Yards. Sinkhorn kann diesen Sub-Skill nur mit den Attributen füllen, die `ERLAUBT` ihm gibt:
mit `spirit`(3)+`torment`(12) kommen 15 Punkte Masse zusammen, wo 49,6 gefordert sind
(Kontrollrechnung E: −34,6 Pp, größte Abweichung des Laufs). Erst wenn TEAMGEIST aus den
Matrix-Schwergewichten gespeist werden darf (H: power 41, health 33, speed 26 — der
„große Receiver", Tight-End-Profil), passt das Rezept zur Zielgröße (−14,7 Pp Rest, weil
LAUFKRAFT und TEAMGEIST um dieselben Attribute konkurrieren). Die Alternative wäre, das
mechanische Gewicht des Receiver-Loses im Motor zu senken — das ist Motorarbeit und gehört in
die Losrunde (5.9), nicht in diesen PR.

Nebenbefund für die torment-Frage: J (t16, eigene Sondierung) liegt bei 0,474 / 0,741 gegen E
(t12) 0,453 / 0,722 — Differenz 0,02, Spannweiten 0,3–0,5. Kein Signal.

**Sondierung gegen die neue Matrix** (`sondiere-feldspiel-subskills.mjs football 24`, orthogonales
Rezept — der gemessene Einflussanteil IST das mechanische Gewicht des Sub-Skills):

| Sub-Skill | Träger im Lauf | mechanisches Gewicht t12 | t16 (eigener Lauf) |
|---|---|---:|---:|
| TEAMGEIST (Receiver-Los) | awareness | **49,6 %** | 49,0 % |
| LAUFKRAFT | health | 27,3 % | 21,1 % |
| ABWEHR_PASS | spirit | 6,5 % | 5,6 % |
| PASSSCHUTZ | speed | 6,4 % | 3,2 % |
| PASSGENAUIGKEIT | power | 6,1 % | 21,0 % |
| BALLSICHERHEIT | torment | 2,2 % | 0 % |
| LAUFTEMPO | dexterity | 0,7 % | 0 % |
| AUSDAUER | determination | 0,4 % | 0 % |
| ABWEHR_LAUF | stamina | 0 % | 0 % |

Die Rangfolge ist dieselbe wie in `football-rezept-kalibrierung.md` 4.5 (TEAMGEIST 44,5 %,
LAUFKRAFT 24,9 %, PASSGENAUIGKEIT 17,4 %) — die Sondierung misst den Motor, nicht die Matrix,
und der Motor hat sich seither nicht bewegt. Dass PASSGENAUIGKEIT zwischen 6 und 21 % springt,
ist die bekannte Unschärfe des Verfahrens bei n = 24 (Versatz-Gegenprobe in der Umsetzung
fahren, `sondiere-feldspiel-subskills.mjs football 24 3`). ABWEHR_LAUF liest 0 %: der Sub-Skill
bewirkt mechanisch nichts — ein Motorbefund, den die Kalibrierung schon kannte und der mit
`MINDEST 1 %` am Leben gehalten wird.

**Das Sinkhorn-Rezept (Lauf H)**, erzeugt mit `baue-feldspiel-rezept.mjs football` aus dieser
Sondierung, Matrix t12 und der ERLAUBT-Tabelle aus 5.4:

```js
  football:{
    PASSGENAUIGKEIT: {determination:71,dexterity:29},
    LAUFKRAFT:       {power:41,health:33,speed:26},
    PASSSCHUTZ:      {awareness:100},
    ABWEHR_PASS:     {torment:100},
    ABWEHR_LAUF:     {torment:100},
    BALLSICHERHEIT:  {determination:71,dexterity:29},
    TEAMGEIST:       {power:41,health:33,speed:26},
    AUSDAUER:        {stamina:67,will:33},
    LAUFTEMPO:       {speed:52,stamina:32,dexterity:16}   // unverändert
  }
```

Zwei Zeilen darin sind Sinkhorn-Artefakte, keine Absicht, und gehören in der Umsetzung von
Hand gegengeprüft: `PASSSCHUTZ: {awareness:100}` (power/health sind von LAUFKRAFT und TEAMGEIST
aufgebraucht; eine O-Line aus reiner Wahrnehmung ist unplausibel — Kandidat: awareness 60 /
health 40) und `ABWEHR_PASS: {torment:100}` (speed/awareness sind weg, s. o.). Beide Sub-Skills
tragen ~6 % mechanisches Gewicht; eine Handkorrektur bewegt die Rangtreue innerhalb der
Spannweite, muss aber nachgemessen werden.

---

## 5. Das Rezept — umsetzungsreif

Ein PR, in dieser Reihenfolge, jeder Schritt einzeln prüfbar. Alles unten ist im Worktree
durchgespielt; Zeilennummern beziehen sich auf `origin/main` `ee2ac733`.

### 5.1 Die Tabelle

`lib/player-generator/official-discipline-weights.ts`, Spalte `football`, zwölf Zellen:

| Zeile | Attribut | alt | **neu** |
|---:|---|---:|---:|
| 87 | power | 6 | **22** |
| 109 | health | 14 | **18** |
| 131 | determination | 8 | **10** |
| 153 | stamina | 6 | 6 |
| 175 | speed | 0 | **14** |
| 197 | dexterity | 0 | **4** |
| 219 | awareness | 11 | **8** |
| 241 | intelligence | 0 | 0 |
| 263 | will | 10 | **3** |
| 285 | charisma | 4 | **0** |
| 307 | spirit | 25 | **3** |
| 329 | torment | 16 | **12** |

Summe 100 (vorher 100). Kein anderer Eintrag der Datei wird berührt.

### 5.2 Der Generator

```sh
npx tsx scripts/generiere-arena-daten.ts --schreiben
```

Erwarteter Diff in `public/mockups/battle-mode.engine.js`: genau 14 Zeilen — die Zeile
`"football": {…}` in `BASIS_JE_DISC` (:3479) und die sechs Slot-Einträge unter
`SLOTS_JE_DISC.football`. Ist der Diff größer, hat jemand seit dem letzten Lauf am generierten
Block von Hand gearbeitet; dann zuerst klären, was.

Zusätzlich von Hand: der Matrix-Kommentar über dem Football-Rezept (`engine.js:4359ff`, „MATRIX:
spirit 25, …") und die Tabelle `MATRIX.football` in `scripts/baue-feldspiel-rezept.mjs:33` — beide
tragen die Zahlen als Prosa bzw. Werkzeugkopie und laufen sonst auseinander.

### 5.3 Die sechs Rollen

`lib/lineups/matchday-slot-roles.ts:232-239`. Der Generator leitet `gross`/`klein` aus dem
Profil ab, der Text nicht — ohne diesen Schritt steht im Aufstellungsbildschirm „Locker Leader
führt über Spirit und Charisma" an einem Slot, dessen Profil speed 19,7 / power 26,2 trägt
(nachgesehen in `slots-t12.txt`). Vorschlag, Fokusattribute an die Matrix gehängt, Texte in
derselben Bauart wie heute:

```ts
football: [
  roleTheme("linepower",    "Line Power",    "Gewinnt Kontakt über Power und Health.",          ["power", "health"],        "speed",   "high",   ["tank", "berserker"]),
  roleTheme("routeburst",   "Route Burst",   "Schafft Separation über Speed und Dexterity.",    ["speed", "dexterity"],     "power",   "medium", ["sprinter"]),
  roleTheme("fieldread",    "Field Read",    "Liest Plays über Awareness und Determination.",   ["awareness", "determination"], "torment", "low", ["tactician"]),
  roleTheme("ballhawk",     "Ball Hawk",     "Greift Chancen über Torment und Speed.",          ["torment", "speed"],       "health",  "medium", ["rogue"]),
  roleTheme("redzone",      "Red Zone",      "Braucht Power und Torment nahe der Linie.",       ["power", "torment"],       "will",    "high",   ["hero"]),
  roleTheme("lockerleader", "Locker Leader", "Führt über Determination und Spirit.",            ["determination", "spirit"], "health", "low",    ["bard", "hero"]),
],
```

Danach `npx tsx scripts/pruefe-slot-invariante.ts` (Spaltensumme je Attribut über alle Slots = 0)
und den Generator **noch einmal** laufen lassen — die Rollen speisen die Slotprofile.

### 5.4 Das Rezept

1. `scripts/baue-feldspiel-rezept.mjs`: `MATRIX.football` auf die neue Tabelle, `ERLAUBT.football`
   auf die Kandidaten aus PR #790 Abschnitt 2.5, mit einer Abweichung bei TEAMGEIST (Lauf H):

   ```js
   football: {
     PASSGENAUIGKEIT: ["dexterity", "awareness", "determination"],
     LAUFKRAFT:       ["power", "speed", "health"],
     PASSSCHUTZ:      ["power", "health", "awareness"],
     ABWEHR_PASS:     ["speed", "awareness", "torment"],
     ABWEHR_LAUF:     ["torment", "power", "health"],
     BALLSICHERHEIT:  ["health", "dexterity", "determination"],
     TEAMGEIST:       ["power", "health", "speed"],   // Receiver-Los: der grosse Receiver (Lauf H)
     AUSDAUER:        ["stamina", "health", "will"],
   },
   ```

   `TEAMGEIST` weicht bewusst von PR #790 (2.5: spirit, torment) ab — Abschnitt 4 erklärt, warum
   das Receiver-Los die Matrix-Schwergewichte braucht (E gegen H: 0,453 gegen 0,520 je Spiel,
   0,722 gegen 0,806 Saison).

   Der lange Kommentar darüber („awareness fällt heraus, weil rho −0,34") beschreibt die ALTE
   Matrix und muss weg oder umgeschrieben werden: gegen die neue Eignung liegt awareness bei
   −0,22, speed bei +0,11, power bei +0,88.
2. `node scripts/sondiere-feldspiel-subskills.mjs football 24 > /tmp/sond.txt` — auf dem Motor
   NACH 5.2/5.3 (die Sondierung kopiert Motor und Rezepte in ein Temp-Verzeichnis, fasst den
   Arbeitsbaum nicht an; ~5 Minuten). Erwartung: die Tabelle aus Abschnitt 4 (TEAMGEIST ~50 %,
   LAUFKRAFT 20–27 %); weicht sie stark ab, hat sich der Motor zwischenzeitlich bewegt. Die
   Versatz-Gegenprobe (`… football 24 3`) muss dieselbe Rangfolge liefern.
3. `node scripts/baue-feldspiel-rezept.mjs football /tmp/sond.txt` → Rezeptblock nach
   `engine.js:4432-4441` (die acht Sub-Skills; `LAUFTEMPO` bleibt, es ist der
   disziplinübergreifende Bewegungswert). Den Kommentarblock 4359–4431 auf den neuen Stand
   bringen — er erzählt heute die Geschichte des alten Rezepts.
4. Messen: `node scripts/miss-alle-disziplinen.mjs 24 football basketball hockey`. Football
   muss die Zahlen aus Lauf H treffen (0,52 / 0,81, ±0,02), Basketball und Hockey müssen bit-identisch bleiben
   (0,772 / 0,669).

### 5.5 Der Kaderfamilien-Schalter — ohne ihn misst man die Vergangenheit

`scripts/ziehe-kader-familie.ts` kopiert `player.disciplineRatings` aus dem Spielstand. Nach der
Tabellenänderung stehen dort bis zum nächsten Saisonwechsel die **alten** Football-Ratings; die
Kaderfamilie trüge also weiter die alte Eignung, und jede Messung liefe gegen die falsche
Zielgröße — genau der Fehler, den CLAUDE.md unter „ein veraltetes Abbild sieht aus wie ein
gültiger Spielstand" beschreibt. Ein Schalter `--ratings-neu` behebt das mit dem Produktionspfad:

```ts
import { buildLeagueDisciplineRatingsForPlayers } from "@/lib/player-formulas/discipline-rating-engine";
// …nach dem Laden des gameState, vor buildArenaTeam():
if (process.argv.includes("--ratings-neu")) {
  const neu = buildLeagueDisciplineRatingsForPlayers(gameState.players);
  for (const p of gameState.players) {
    const r = neu.get(p.id); if (r) p.disciplineRatings = { ...p.disciplineRatings, ...r };
  }
}
```

Kontrolle, die im Worktree bestanden hat: ohne Tabellenänderung reproduziert dieser Weg die
gespeicherten Ratings der 110 Kaderfamilien-Spieler zu 110/110 (max. Abweichung 0,00). Dann
`data/generated/kaderfamilie-live-save.json` neu ziehen und mit committen; `quelle.gezogenAm`
dokumentiert den Stand.

### 5.6 Optional: sofortige Wirkung im laufenden Spielstand

Ohne Zutun wirkt die neue Spalte beim nächsten Saisonwechsel (`preseason-workflow-service.ts:257`,
`season-end-xp-apply-service.ts:1078/1382`). Will Chris das neue Bild sofort im Transfermarkt und
in der Teamstärke sehen, braucht es einen Einmal-Rebuild über `buildLeagueDisciplineRatingsForPlayers`
plus `applyLeagueDisciplineRatingsToPlayer` für alle Spieler des aktiven Saves — als Skript nach dem
Muster von `deploy/hetzner/kader-auffuellen.sh` (Bericht ohne Schalter, `--apply` mit Sicherung,
`--zurueck`). Das ist ein eigener kleiner Auftrag, kein Teil dieses PRs, und **nicht** mitten in
einem Kauffenster fahren: die KI-Bedarfsrechnung (`discipline-need.ts`) liest `disciplineRatings`.

### 5.7 Tests und Doku

- Kein Test im Repo prüft Football-Gewichte numerisch (`tests/` referenziert `football` nur als
  Disziplin-ID mit erfundenen Ratings). `pruefe-slot-invariante.ts` ist die einzige Prüfung, die
  von 5.3 abhängt.
- `docs/design/stand-aller-disziplinen.md`: Football-Zeile auf die neue Baseline — mit dem
  Vermerk, dass 0,468 und die neue Zahl **nicht vergleichbar** sind (andere Zielgröße), wie
  `football-matrix-entscheidung.md` es vorhergesagt hat. `football-matrix-entscheidung.md` trägt
  die Antwort „A, am 05.09. per Freigabe" nach.
- `docs/design/football-rezept-kalibrierung.md` bleibt als Geschichte stehen; der Hinweis, dass
  seine Zahlen die alte Matrix beschreiben, gehört an den Anfang.

### 5.8 Erwarteter Sprung und Abnahme

| | rho je Spiel | rho Saison |
|---|---:|---:|
| heute | 0,468 | 0,671 |
| nach Matrix + Rezept H (kaderfest) | **0,520** (Spannweite 0,241) | **0,806** (Spannweite 0,139) |
| Verlässlichkeit (rho Spiel / rho Saison)² | 0,49 → 0,42 | |

Abnahme dieser Runde, ehrlich formuliert: **die Saisonzahl muss über 0,78 und ihre Spannweite
unter 0,20** (das ist der Sprung, der außerhalb des Kaderrauschens liegt); die Einzelspielzahl
muss über 0,50 bleiben und darf nicht fallen. Basketball 0,772 und Hockey 0,669 müssen
bit-identisch bleiben. Die 0,80 je Spiel sind **nicht** das Ziel dieses PRs — sie sind das Ziel
der Losrunde danach.

### 5.9 Danach für Football: die Losrunde

Nach diesem PR sitzt Footballs Rest im Faktor √0,42. Drei Kandidaten, alle Motor, alle messbar
mit derselben Sonde:

1. **Receiver-Los proportional statt Lotterie**: `gewichtetesLos(restOff,"TEAMGEIST")`
   (`engine.js:6590`) verlost jeden Pass; ein Spieler mit TEAMGEIST 80 gegen einen mit 60
   bekommt nur anteilig mehr Bälle. Ein steilerer Exponent oder Top-2-Bindung erhöht die
   Verlässlichkeit, ohne die Validität zu berühren.
2. **Mehr Drives je Spiel** (die Uhr): Football ist die einzige Disziplin, bei der die
   Verlässlichkeit unter 0,5 liegt — die Hockey-Erfahrung (0,755 → 0,85 bringt nichts) gilt
   hier nicht. Verdoppelte Spielzeit als Messexperiment, nicht als Produktentscheidung.
3. **ABWEHR_LAUF zum Leben erwecken** (0 % mechanisch): Run Defense hat heute keinen Kanal,
   obwohl die Matrix sie mit torment/power/health bepreist.

---

## 6. Ingame-Review — was Chris nach dem Deploy anschauen sollte

1. **Transfermarkt, Linse „Football"** (`TransfermarktV2Client`, `selectedDisciplineLens`): oben
   müssen Tanks/Berserker/Charger stehen (The D, Tentakulus, Fleshbreed, Pyrrhakos, Brujo Oso),
   Tacticians (Marrow, Warpriest, Murkavon, Deep) im Mittelfeld. Sieht es noch aus wie vorher,
   hat der Saisonwechsel bzw. der Rebuild (5.6) nicht stattgefunden.
2. **Teamstärke Football**: Mayhem Mavericks, Hell Raisers, The Giants, Wrecking Legionnaires,
   Zero Heroes vorn; Death Peaches, The Chantry, Royal Court deutlich gefallen. Chris' eigenes
   Team bitte gegen die Tabelle in 3.1 lesen.
3. **Aufstellung, Football-Slots**: die sechs Rollentexte müssen zu den Attributen passen, die der
   Slot-Fit („passt perfekt/sehr gut/okay") tatsächlich belohnt — „Line Power über Power und
   Health", nicht mehr „über Spirit und Torment".
4. **Arena, ein Football-Spiel**: Boxscore-Spitze sollte den power/speed-Stars gehören; „Die
   Liebenden" oder Erna Wellenlaut dürfen dort nicht mehr oben stehen. Die Formationen, Downs und
   Spielzüge selbst ändern sich nicht — nur, wer sie gewinnt.
5. **Training/Saisonende-Vorschau**: die Trainingsrichtung für Football-Spieler
   (`organic-season-progression.ts`) zeigt jetzt power/health/speed als Zielattribute.

---

## 7. Danach: die nächsten drei

Chris' Ansage endet mit „mach dann weiter mit den nächsten 3 diszis". Nach
`stand-aller-disziplinen.md` (Abschnitt 1) sind die drei am weitesten von der Schranke
entfernten Disziplinen mit eigenem Motor **TDM (0,113), Mini-DM (0,269) und Battlefield
(0,325)** — alle drei Arena, alle drei mit dem bereits ausgearbeiteten, noch offenen Befund
„Zielwahl ist Geometrie statt Bedrohung" (Abschnitt 4 dort). Die drei zahlen auf denselben
Hebel ein und sind deshalb als Block sinnvoller als drei getrennte Runden. Die knappen Fälle
(Climbing 0,790, Basketball 0,772, Eiskunstlauf 0,757) sind dagegen Rezept-Feinschliff, keine
Mechanikfrage.

---

## Anhang A: Quellen dieser Runde

Combine und Vorhersagekraft:

- SumerSports, *NFL Combine by Position: How do the 40-Yard Dash and Other Drills Predict NFL
  Success?* — https://sumersports.com/the-zone/nfl-combine-by-position-how-do-the-40-yard-dash-and-other-drills-predict-nfl-success/
- Sports Info Solutions (2023), *Combine Measurements and Total Points — Do they Correlate?* —
  https://www.sportsinfosolutions.com/2023/03/08/study-combine-measurements-and-total-points-do-they-correlate/
- Kuzmits & Adams (2008), JSCR 22(6) — https://pubmed.ncbi.nlm.nih.gov/18841077/
- The Sport Journal, *Do Performance Measures Predict Draft Status Among NFL Draftees* —
  https://thesportjournal.org/article/the-national-football-league-combine-do-performance-measures-predict-draft-status-among-nfl-draftees/
- Ourlads, *NFL Draft Position Averages (Combine 2018)* — https://www.ourlads.com/nfl-draft-position-averages/
- CBS Sports (2020), *Most important drills for each position, target times* (Gil Brandt) —
  https://www.cbssports.com/nfl/draft/news/2020-nfl-combine-most-important-drills-for-each-position-including-target-times-and-distances

Madden:

- Olson (2017), *Machine Learning Madden NFL* — https://www.randalolson.com/2017/01/10/machine-learning-madden-nfl-how-madden-player-ratings-are-actually-calculated/
- Madden Manniac (2012), *What attributes effect OVR and the percentage by position* —
  http://maddenmanniac.blogspot.com/2012/01/madden-12-what-attributes-effect-ovr.html
- OldManSim, *Madden 25 Guide To Player Ratings, Attributes & Traits* —
  https://oldmansim.wordpress.com/2014/03/27/madden-25-guide-to-player-ratings-attributes-traits/

Aggression, Charakter, mentale Härte:

- Yip, Schweitzer & Nurmohamed (2018), *Trash-Talking*, OBHDP 144 —
  https://www.sciencedirect.com/science/article/pii/S0749597816301157
- *Risk Taking and Aggression On and Off the Field: Evidence from the NFL*, B.E. J. Econ. Anal.
  Policy (2019) — https://www.degruyterbrill.com/document/doi/10.1515/bejeap-2018-0195/html
- Crist (2016), *Crime in the NFL: Does an Arrest History Lead to Better Performance?*, CMC —
  https://scholarship.claremont.edu/cmc_theses/1300/
- ScienceDaily (2015), *NFL players with an arrest record but no charges did well* —
  https://www.sciencedaily.com/releases/2015/04/150428124725.htm
- Keeler (2007), J. Sport Behavior — https://www.semanticscholar.org/paper/667b65c5607200b443f7cf669736b7eb5620a5fd
- Open Source Football (2021), *Stability and Predictive Power of Penalties* —
  https://opensourcefootball.com/posts/2021-01-21-exploring-stability-and-predictive-power-of-penalties-in-the-nfl/
- Research Square (2025), *Mental Toughness and Psychological Skills Among Football Players* —
  https://www.researchsquare.com/article/rs-8734107/v1 ; PMC10090955 (Frauenfußball, Prädiktoren)
  — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10090955/

Repo-intern: `football-matrix-und-assets-recherche-05-09.md`, `football-matrix-entscheidung.md`,
`football-rezept-kalibrierung.md` (4.4/4.5), `messgrundlage-kaderfest.md`,
`stand-aller-disziplinen.md`, `docs/PLAYER_ATTRIBUTES_12_IMPORT_PLAN.md`,
`docs/PLAYER_GENERATOR_PLAN.md`, `lib/player-generator/player-generator-archetypes.ts`.

## Anhang B: Wie die Messungen entstanden sind (reproduzierbar)

Im Worktree (`origin/main` `ee2ac733`), je Variante:

1. Spalte `football` in `official-discipline-weights.ts` gesetzt (Skript, regex je Attributblock).
2. `npx tsx scripts/generiere-arena-daten.ts --schreiben`.
3. Kaderfamilie mit `buildLeagueDisciplineRatingsForPlayers(gameState.players)` über den lokalen
   Store (`OLY_APP_SQLITE_PATH=data/persistence/oly-app.sqlite`, Save
   `new-game-1787123325719-swnjlk`, 2984 Spieler) neu bewertet und als eigene Datei geschrieben.
4. Für E–K: `sondiere-feldspiel-subskills.mjs football 24` (je Tabelle einmal, 294 s / 273 s), dann `baue-feldspiel-rezept.mjs
   football` mit gepatchter `MATRIX`/`ERLAUBT`, Rezeptblock in den Motor gesetzt.
5. `OLY_KADER_FAMILIE=<datei> node scripts/miss-alle-disziplinen.mjs 24 football`.
6. `git checkout` der vier berührten Dateien; `git status` leer bis auf die Hilfsskripte, die
   nicht committed wurden.

Liga-Vergleich (3.1/3.2): Rohscore alt/neu je Spieler, `buildCompetitionRanks` +
`mapRankToDisciplineStat` — derselbe Code wie im Spiel; Teamstärke = Mittel der sechs besten
Football-Ratings je Team über `gameState.rosters`.
