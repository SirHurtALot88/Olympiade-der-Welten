# Speed-Schach — Nachtkonzept „Die Uhr wird der dritte Spieler" (03.10.)

**Reine Konzeptrunde. Kein Produktionscode geändert, kein Verhaltens-PR.** Auftrag: Chris am
02.10. („wie viele disziplinen haben wir die recht langwilig aussehen […] so müssen wir denken
wie man mit einfachen methoden das spiel etwas interaktiver gestalten kann und das auch nen
gewissen impact haben kann - mehr risiko führt dazu dass jemand sich evtl übertrifft oder unter
dem druck oder gewicht einbricht") und am 03.10. abends („bei den anderen event poors bitte
heute über die nacht auch konzepte ausarbeiten […] denk gern um die ecke, hol infos aus dem
internet und probier dich aus").

Ausgangspunkt ist der Schach-Eintrag der Opus-Konsultation
(`docs/design/manager-risiko-interaktivitaet-konzept-02-10.md`, PR #1118): „Bild steht 76 % der
Zeit, Remis nur in 0,24 % der Partien", Rho-Puffer 0,906, Vorschlag dort nur ein Wagnis-Zuschlag
„Angriffsschach/solide". Dieses Dokument geht darüber hinaus — und misst, wie weit man gehen darf.

`engine.js` meint `public/mockups/battle-mode.engine.js` (Stand `main`, 03.10.). Bindend wie
überall: Matrix gesperrt (intelligence 28, awareness 21, determination 14, will 14, speed 10,
dexterity 7, charisma 6), rho > 0,80 je Spiel, Pp ≤ 25 Pflicht, Klasse T nur mit Chris' Zustimmung.

---

## 0. Kurzfassung

1. **Der Befund hinter dem Befund:** Speed-Schach ist nicht langweilig, weil zu wenig passiert —
   es passiert *dasselbe* zehnmal. Jeder Zug ist ein Würfel mit zwei Ausgängen, der Vorteil ist
   eine Summe, und die einzige Größe, die eine Blitzpartie dramatisch macht — **die Uhr** — ist
   reine Anzeige: sie folgt dem Würfel und fällt praktisch nie (Opus-Nachbildung 0,13 %), und
   wenn, hat es keine Folge. Dazu enden heute **rund 30 % aller Mannschaftskämpfe 3:3**
   („UNENTSCHIEDEN", s. 1.3) — der Kampf hat überhaupt keinen Schluss.
2. **Kernidee:** die Uhr wird eine echte zweite Achse, in drei Stufen, die jede für sich
   stehen kann:
   - **Stufe 1 — Das Blättchen fällt** (Klasse B, rho/Pp per Konstruktion unberührt): die Uhr
     läuft aus den Händen des Spielers (ein Sub-Skill TEMPO aus speed/dexterity/awareness,
     alles Matrixattribute, die heute schon in WAGNIS/NERVEN sitzen) statt aus dem Ergebnis;
     wer auf 0 fällt, **verliert das Brett auf Zeit**, egal wie der Vorteil steht. Das ist der
     Gewichtheben-Grundsatz („380 kg gehoben, auch wenn er verliert") und Fechtens F1: `u.summe`
     bleibt Zeichen für Zeichen die Leistung, nur das Brettergebnis bekommt einen zweiten Weg.
   - **Stufe 2 — Die Tempo-Ansage** (Klasse B, Messrunde nötig): **Chris' Manager-Hebel.** Je
     Brett vorab „Blitzen / Normal / Rechnen". Rechnen kauft Zugqualität mit Bedenkzeit und
     riskiert Zeitnot (Erfolgschance der Restzüge sinkt, gedämpft durch NERVEN); Blitzen spart
     die Uhr, spielt flacher und kann einen stärkeren Rechner **auf Zeit schlagen** — der
     Nebenweg für speed/dexterity-Typen, exakt das Primär-/Nebenweg-Muster der Leitlinie. Auch
     bedingt möglich („Blitzen, wenn er hinten liegt" — Konsultation Befund B).
   - **Stufe 3 — Der Armageddon-Entscheider** (Klasse T, nur dokumentiert): bei 3:3 ein
     siebtes Brett, für das beide Manager **verdeckt Bedenkzeit bieten** — wer weniger Zeit
     akzeptiert, spielt Schwarz und gewinnt bei Remis (Chess.com Speed Chess Championship,
     Norway Chess). Das ist das stärkste Interaktivitätsstück dieses Papiers, kostet aber
     Sendezeit und einen Spielablauf-Schritt — ohne Chris' Ja wird es nicht gebaut. Die
     T-freie Alternative ist Fables S-F1 (Remis ½ + Berliner Wertung).
3. **Gemessen (Scratch-Sonde, keine Engine):** die Nachbildung des heutigen Rechners trifft
   das Repo (rho 0,913 gegen 0,906, Pp 14,9/16,1 gegen 17,3/18,3). Stufe 1 lässt rho/Pp
   bit-identisch. Stufe 2 mit einer **Zeitbudget-KI-Regel** hebt rho leicht (0,922) und senkt Pp
   (12,3/14,3); „alle rechnen" und „alle blitzen" sind **beide schlechter** als die KI-Regel
   (Heimsieg 28,9 / 27,6 gegen 32,0 %) — kein Knopf ist immer besser. **Die Falle:** eine naive
   KI-Regel („schnelle Hände blitzen") treibt Pp auf 21,6 — die KI-Vorgabe ist Teil der
   Mechanik, nicht Beiwerk.
4. **Das Dirty-Flag-Problem:** solange die Uhr 8 s je starkem und 20 s je schwachem Zug kostet,
   fällt nur, wer ohnehin auf Punkte verliert — die Flagge widerspricht dem Vorteil in 0,1 % der
   Bretter, sie erzählt nichts Neues. Erst eine von der Zugqualität **entkoppelte** Uhr (12/17 s,
   stärkerer Tempo-Faktor) erzeugt den Botez-Hansen-Moment (1–5 % der Bretter, je nach
   Ansage). Das ist die eine Kalibrierfrage, an der Stufe 1 steht oder fällt.

---

## 1. Problemrahmen

### 1.1 Was heute gerechnet wird (engine.js)

- `BUEHNE_ART["speed-schach"]` (:14820): 6 Bretter je Seite, `rundenN:10`, `rundenDauer`
  60/(10·6·2) = 0,5 s je Halbzug, `duell:true`, `schach:true`, `failAbzug:0.55`.
- `setz()` (:15657 ff.) würfelt jeden Spieler **allein**, bevor sein Gegner feststeht: je Zug
  genau ein `rr()`, Erfolgschance `buehneErfolgschance()` (:15538, TECHNIK·0,0055 + NERVEN·0,0035
  − (WAGNIS−50)·0,0015), Punkte `basis + SPITZENMOMENT·0,35·Wagnisfaktor` bzw. `basis·0,55`,
  plus PUBLIKUM·0,12.
- Der `art.duell`-Block (:15797 ff.) bildet danach `vorteil` = Σ eigene − Σ gegnerische Punkte;
  Brettsieger ist, wer `vorteil > 0` hat. Teamstand = gewonnene Bretter.
- **Die Uhr** `schachUhrWert()` (:20138): 180 s minus 8 s je starkem, 20 s je schwachem Zug.
  Sie liest nur bereits enthüllte `runden[]`, schreibt nichts zurück. Zehn schwache Züge kosten
  200 s — die Uhr fällt nur, wenn alle zehn Züge scheitern.
- Der Spielerwert für rho ist `u.summe` (`MOTOREN["speed-schach"].wert`), nicht `vorteil` —
  der Grund, warum rho mit 0,906 so hoch steht (`speed-schach-fable-recherche-12-09.md` 2.1).

### 1.2 Was der Zuschauer davon sieht (Broadcast-Audit 30.09., `f1-broadcast-audit-runde-2-30-09.md`)

| Dauer | Bannerzeit | Banner | Ticker/min | längste Bannerpause | stehende Bilder | längster Stillstand |
|---|---|---|---|---|---|---|
| 1:00 | 17 % | 7 | 123 | 37 s | **76 %** | 5,5 s |

Das Bild steht drei Viertel der Zeit, der Ticker rattert mit 123 Zeilen je Minute („findet
den starken Zug" × 120), und die große Zahl bleibt die ganze Minute 0:0, weil Bretter erst nach
dem letzten Zug entschieden sind. Was schon gebaut ist: Regie springt zur Zeitnot (S-B2 in
`zeichneSchach()`, :26407) und meidet entschiedene Bretter (S-F2, `buehneMaxRestPunkte()`). Beides
ist gute Regie für eine Mechanik, in der die Zeitnot nichts kostet.

### 1.3 Der stille Befund: 30 % Unentschieden

Sechs Bretter, kein Remis, Brettsieg per Vorzeichen: bei annähernd gleich starken Teams endet
der Kampf in C(6,3)/2⁶ = 31 % der Fälle 3:3. Die Sonde (Abschnitt 5) misst 30,0 %, mit echten
Stärkeunterschieden etwas weniger. `zeichneSchach()` zeigt dann „UNENTSCHIEDEN (3:3)" — ein
Mannschaftskampf ohne Schluss, jedes dritte Mal. Das ist, neben der toten Uhr, die zweite
Stelle, an der Speed-Schach kein Drama hat, und sie wird in keinem der bisherigen Papiere
beziffert.

### 1.4 Was schon vorgeschlagen wurde — und wo dieses Papier abbiegt

| Quelle | Vorschlag | Hier |
|---|---|---|
| Opus-Konzeptreview 26.09. (Branch `buehne-duell-konzeptreview-26-09`) | S1 Uhr als Ressource mit Zeitnot-Schwelle (über einen Paar-Rechner), S2 Bewertung als Zustand, S3 Phasen, S4 Gambit, S5 Brettordnung, S6 Kulisse | S1 wird **ohne Paar-Rechner** gebaut (Stufe 1/2 bleiben solo in `setz()`), S2/S3 bewusst nicht (s. 3.6) |
| Fable-Ideen Buehne-Duell 30.09. | S-F1 Remis als Mannschaftstaktik, S-F2 „letztes Brett entscheidet" (gebaut), 5.4 Brettreihenfolge | S-F1 ist die T-freie Alternative zu Stufe 3; S-F2 ist die Vorlage für „Brett auf Zeit verloren" in der Regie |
| Konsultation 02.10. | Wagnis-Zuschlag „Angriffsschach/solide" (±20 WAGNIS-Punkte) | Nicht der Blitz-Hebel. WAGNIS verschiebt Streuung; die Blitz-Entscheidung ist **Zeit gegen Qualität**. Beides zusammen wären zwei Knöpfe — Empfehlung: Tempo-Ansage als *die* Schach-Haltung (3.3) |

---

## 2. Recherche: Was Blitz- und Bulletschach beim Zuschauen spannend macht

### 2.1 Flaggen — auf Zeit gewinnen, auch aus verlorener Stellung

„Flagging in chess refers to the act of winning (or drawing) a game on time." Und der Moment,
den jeder Blitz-Zuschauer kennt: „WFM Alexandra Botez could win a bullet game against GM Eric
Hansen by flagging him, even though she was down on material"
([chess.com, Flagging](https://www.chess.com/terms/flagging-chess)). In der Spitze passiert das
genauso — Firouzja „dirty flags" Carlsen in der Global Chess League: er wählte den Zug, der
auf Zeit gewann, statt die Dame zu nehmen
([chessdom](https://www.chessdom.com/alireza-firouzja-dirty-flags-magnus-carlsen-in-day-2-of-global-chess-league/)).
„Running out of time in a clearly winning position is called being 'dirty flagged'"
([Lichess-Blog, The Art of Flagging](https://lichess.org/@/Abhiramlanka/blog/the-art-of-flagging-bullet-chess-survival-guide/j46qkxJQ)).

**Überträgt sich:** das ist der eine Comeback-Moment, den unsere Mechanik nicht kennt — ein
Brett, das auf Punkte verloren ist und trotzdem gewonnen wird. Stufe 1 baut genau diesen Weg;
die Sonde zeigt, dass er ohne Entkopplung der Uhr fast nie eintritt (5.2).

### 2.2 Die Zeitnot-Schwelle — ein Knick, kein Gefälle

Die Auswertung von Lichess-3+0-Partien (im Repo schon zitiert, hier bestätigt): „The other
areas stay roughly stable before a big drop off around 10 to 30 seconds left, depending on the
rating level" — und unter 5 Sekunden bei starken Spielern „there is hardly any difference between
an objectively winning or losing position"
([jk_182, Lichess / Substack](https://chessenginelab.substack.com/p/evaluation-time-score)).
Der Autor merkt an, warum der reine Zeitwert nicht isolierbar ist: „players who are in a lost
position may play faster to put pressure on the clock".

**Überträgt sich:** Zeitnot ist ein **Schwellenereignis**, kein stetiger Abzug. Stufe 2 senkt
die Erfolgschance erst unter 30 s Restzeit, nicht linear — und der Nebensatz („wer verloren
steht, spielt schneller") ist wörtlich die bedingte Anweisung „Blitzen, wenn hinten".

### 2.3 Pre-Moves und Bullet — die Hände als eigene Fertigkeit

„Pre-moving is the lifeblood of flagging, and knowing when to pre-move separates seasoned
flaggers from beginners" ([Lichess-Blog, a. a. O.](https://lichess.org/@/Abhiramlanka/blog/the-art-of-flagging-bullet-chess-survival-guide/j46qkxJQ)).
„Bullet is a special case where up to a certain level, bullet is almost entirely about beating
your opponent on the clock" ([chess.com Forum, Flagging in Bullet](https://chess.com/forum/view/for-beginners/flagging-in-bullet-chess)).

**Überträgt sich:** es gibt im echten Blitz eine Fertigkeit, die **nicht** Rechnen ist — schnelle,
sichere Hände. Die Matrix hat dafür bereits Platz (speed 10, dexterity 7), heute sitzen die beiden
nur in WAGNIS/NERVEN/AUSDAUER als Beimischung. Ein Sub-Skill TEMPO gibt ihnen den Ort, an dem sie
im echten Sport wirken: an der Uhr. Die Slot-Rolle *Clock Pressure* („Spielt Uhrdruck über Will
und Speed", `matchday-slot-roles.ts:195`) bekommt damit erstmals eine Mechanik, auf die ihr Name
zeigt.

### 2.4 Speed Chess Championship und Armageddon — Zeit wird gehandelt

Das Chess.com-Format: „90 minutes of 5+1 blitz games, 60 minutes of 3+1 blitz games and 30 minutes
of 1+1 bullet games", bei Gleichstand „four additional 1+1 games, and if necessary, an Armageddon
game where the players bid the time" ([ChessBase, SCC-Finals-Preview](https://en.chessbase.com/newsroom/post/speed-chess-ch-2025-26-preview?page=0)).
Das Gebot: „Both players communicate privately the amount of time they are willing to give away
to play as Black. The player willing to play with the lowest amount of time wins the bid and plays
as Black with draw odds." Norway Chess fährt feste Werte: „Black gets 7 minutes to White's 10
[…] Black gets draw odds" ([Wikipedia, Norway Chess 2025](https://en.wikipedia.org/wiki/Norway_Chess_2025)),
und mit diesen Werten „white has won 34 / 64 = 53 %" — ein fast fairer Münzwurf mit Hirn
([Armageddon Chess – a bidder's guide](https://simonm.substack.com/p/armageddon-chess-a-bidders-guide);
dort auch das Beispiel „Carlsen bid 8:58 and Nakamura 8:59, so Magnus wins and has Black").

**Überträgt sich:** das Gebot ist eine **Manager-Entscheidung mit echtem Impact und ohne
Würfel** — man setzt Zeit gegen Remisrecht. Für unser 3:3-Problem (1.3) ist das der
dramatischste Schluss, den es gibt. Es ist aber ein zusätzlicher Spielschritt (Stufe 3, Klasse T).

### 2.5 Clutch Chess — späte Partien zählen mehr

„The final two games of each day are 'clutch' games that are worth double the points on day one
and triple on day two" ([chess.com, Clutch Chess Day 1](https://www.chess.com/news/view/clutch-chess-day-1)),
„facilitates comebacks on the final day and encourages risks and experimentation in earlier
rounds" ([US Chess](https://new.uschess.org/online-events/clutch-chess-begins-top-four-americans-facing-off-new-format)).

**Überträgt sich kaum:** ein „Clutch-Brett", das der Manager vorab nominiert und das doppelt
zählt, wurde in der Sonde mitgemessen — es löst nur 6,5 Prozentpunkte der 3:3-Fälle (30,0 → 23,5
%) und kann einen entschiedenen Kampf nie kippen, nur zum Remis machen. Als Fußnote behalten,
nicht empfohlen.

### 2.6 Chessboxing — die radikale Hybridform

„Matches consist of 11 total rounds, six of which are chess and five of which are boxing. The
first and last rounds are always chess […] Chess rounds last four minutes […] Boxing rounds
last three minutes […] each competitor being given a total of 12 minutes on the chess clock
over the entire match"; gewonnen wird durch Matt oder K.o., „if the chess match ends in a draw,
an additional boxing round takes place" ([gamerules.com, Chess Boxing](https://gamerules.com/rules/chess-boxing/)).

**Überträgt sich nicht mechanisch:** die Schach-Matrix kennt weder power noch health; jede
Boxrunde würde Attribute belohnen, die laut gesperrter Matrix für diese Disziplin nichts zählen —
Pp wäre per Konstruktion verletzt. **Was sich überträgt, ist die Dramaturgie:** die Glocke.
Chessboxing ist spannend, weil der Zustand des Spielers zwischen den Runden sichtbar *kippt*
(wer in Runde 3 Treffer kassiert, rechnet in Runde 4 schlechter). Unser Äquivalent ist die
Zeitnot-Schwelle: der Spieler, der mit 25 s in die letzten drei Züge geht, ist derselbe Mensch mit
einem anderen Kopf. Die Regie sollte diesen Übertritt wie einen Rundenwechsel schneiden (3.5).

### 2.7 PRO Chess League — Mannschaftswertung mit Brettpunkten

„4 vs 4 all-play-all […] A match win gives a team 10 points in the standings (8.5 points required
for a match win), and a drawn match gives each team five points"
([Wikipedia, PRO Chess League](https://en.wikipedia.org/wiki/PRO_Chess_League)). Reale Ligen
leben mit Mannschaftsremis — aber mit Brettpunkten in Halben, die seltener exakt gleich stehen.
Spricht für S-F1 (Remis ½) als T-freie Antwort auf 1.3.

---

## 3. Das Konzept: Die Uhr wird der dritte Spieler

### 3.1 Grundsatz — Leistungsschicht bleibt solo, die Uhr ist eine zweite Ergebnis-Achse

Alle Stufen setzen in `setz()` an oder danach, **ohne Paar-Rechner**: jeder Spieler würfelt wie
heute seine zehn Züge für sich, mit genau einem `rr()` je Zug. Was dazukommt, ist je Spieler eine
**Uhr, die aus seinen eigenen Attributen und seinen eigenen Zügen läuft**. Erst der
`art.duell`-Block vergleicht — wie heute den Vorteil, neu zusätzlich die Flagge.

Ein Sub-Skill **TEMPO** (Vorschlag: speed 50, dexterity 30, awareness 20 — nur Attribute, die in
der Matrix stehen und heute schon in WAGNIS/NERVEN/TECHNIK sitzen; kein neues Attribut) ersetzt
die Konstante „8 s stark / 20 s schwach":

    zeit(Zug) = kostenJeZug(stark | schwach) × (1 + (50 − TEMPO) × k) × haltungsfaktor

Die Uhr startet bei 180 s, Zeitnot gilt unter 30 s (jk_182), bei 0 s ist das Blättchen gefallen.

### 3.2 Stufe 1 — Das Blättchen fällt (Klasse B, rho/Pp per Konstruktion neutral)

**Mechanik:** `u.summe`, `u.runden[].punkte`, Erfolgschance, `rr()`-Verbrauch: **unverändert.**
Neu ist im Paarungsblock ein Feld `u.geflaggt` (aus der eigenen Uhr, berechnet aus den fertigen
`runden[]` wie `schachUhrWert()` heute, nur mit TEMPO-Faktor) und die Regel: ist genau einer der
beiden geflaggt, hat er das Brett verloren — sonst `vorteil` wie heute. `MOTOREN[…].wert()` liest
weiter `summe`; `miss-alle-disziplinen.mjs` und `messe-arena-einfluss.mjs` sind bit-identisch
(dasselbe Argument wie Fechten F1, `fable-ideen-buehne-duell-30-09.md` 1.2).

**Was zu messen ist:** Spiegel (`miss-arena-buehne-spiegel.mjs`, Heim:Gast), Teamwertung in
`spieleBuehneDuell()`, Star/Paartreue über das **Brettergebnis**, und die zwei Quoten, die das
Konzept tragen: Flagg-Quote je Spieler und **Flagg-Entscheid gegen den Vorteil je Brett**.

**Die Kalibrierfrage (Sonde, 5.2):** mit den heutigen 8/20 s ist die Uhr an die Zugqualität
gekettet — wer flaggt, hat auch auf Punkte verloren. Flagg-Entscheid gegen den Vorteil: **0,1 %
der Bretter.** Mit 12/17 s und doppeltem Tempo-Faktor: **1,1 %** bei 9,5 % geflaggten Spielern.
Zielband aus meiner Sicht: 2–4 % der Bretter (bei sechs Brettern je Kampf etwa jeder vierte bis
achte Kampf hat ein „Sieg auf Zeit"-Brett) — selten genug, dass es ein Ereignis bleibt, häufig
genug, dass es in einer Saison mit zwei Schach-Spieltagen vorkommt. Das ist eine Konstante im
Paarungsblock, keine Rezeptänderung.

**Narrativ (Klasse A, erst mit Stufe 1 ehrlich):** ein geflaggtes Brett endet vorzeitig wie ein
S-F2-„aufgegebenes" — die Kamera bleibt bei den offenen Brettern; Ticker „Brett 4: **Blättchen
gefallen** — Ralazar gewinnt auf Zeit, obwohl er auf dem Brett zurücklag"; die Wertungstabelle
bekommt in „Stand" ein ⌛ neben + / −.

### 3.3 Stufe 2 — Die Tempo-Ansage (Klasse B, Messrunde nötig) — Chris' Manager-Hebel

**Die Entscheidung:** je Brett vorab eine von drei Haltungen, in der Einsatzliste wie die
Haltungs-Achse aus der Konsultation (Grundgerüst Zeile 0 dort), hier mit Schach-Wortschatz:

| Ansage | Zeit je Zug | Erfolgschance | Für wen |
|---|---|---|---|
| **Rechnen** | × 1,30 | + 4 pp | starke Rechner (TECHNIK hoch), die ihre Zeit auch haben — Primärweg intelligence/awareness |
| **Normal** | × 1,00 | ± 0 | — |
| **Blitzen** | × 0,72 | − 4 pp | schnelle Hände (TEMPO hoch) oder wer den Gegner auf Zeit schlagen will — Nebenweg speed/dexterity |

**Zeitnot wirkt ins Rezept:** unter 30 s sinkt die Erfolgschance der **Restzüge** um
`0,10 × (1 − NERVEN/100) × 1,6` (NERVEN 50 → −8 pp, NERVEN 80 → −3 pp; will/determination
dämpfen, wie die Slot-Rolle *Endgame Anchor* es verspricht). Ist das Blättchen gefallen, bringen
die Restzüge 0 Punkte — der Patzer in Zeitnot ist dann **auch** schlechtere Leistung, nicht nur
schlechteres Brett. Das ist der Preis gegenüber Stufe 1: `u.summe` ändert sich, rho und Pp
müssen neu gemessen werden.

**Die KI-Vorgabe ist Teil der Mechanik.** Deterministisch aus dem Kader (Muster
`berechneFokusAuto`), Regel **Zeitbudget**: die rechnendste Ansage, deren *erwartete* Uhrzeit
(aus Erfolgschance und TEMPO, ohne Wurf) plus 25 s Sicherheitsrand unter 180 s bleibt; sonst
Blitzen. Die Sonde zeigt, warum das keine Nebensache ist: die naheliegende Regel „schnelle Hände
blitzen, starke Rechner rechnen" **treibt Pp auf 21,6** (speed fällt auf 3,6 % Einfluss, weil ein
Speed-Zuwachs die KI in die flachere Ansage kippt), die Zeitbudget-Regel **senkt** Pp auf
12,3/14,3 und hebt rho auf 0,922.

**„Kein Knopf darf immer besser sein" — geprüft (5.1):** gegen die KI-Regel verliert ein Manager,
der pauschal alles auf Rechnen stellt (Heimsieg 28,9 % statt 32,0 %), und einer, der alles auf
Blitzen stellt (27,6 %). Rechnen für alle flaggt 22 % der Spieler. Der Vorteil liegt in der
**Wahl je Brett** — genau das, was eine Manager-Entscheidung sein soll.

**Mehrere Wege zum Erfolg:** ein Spieler mit intelligence 55 und speed 85 ist laut Matrix
Mittelfeld — und bleibt es in `summe`. Aber er hat einen eigenen Weg zum Brettgewinn (Blitzen,
Gegner flaggt), den ein 80er-Rechner mit langsamen Händen nicht hat. Der Rechner gewinnt
weiterhin die meisten Bretter (Pp-Treue), der Blitzer gewinnt *andere*.

**Bedingt:** „Blitzen, wenn er nach Zug 5 hinten liegt" — die bedingte Anweisung aus Befund B
der Konsultation, die reale Blitz-Praxis aus jk_182 („players who are in a lost position may
play faster"). Braucht die Anweisungsbilanz / das Replay, das die Konsultation ohnehin fordert.

**Ausbaustufe „Druck"** (nur wenn Blitzen in der Messrunde zu schwach ausfällt): blitzt der
Gegner, läuft die eigene Uhr 12 % schneller — als Paarinteraktion **nur in der
Ergebnisschicht** (Flagge), nie in `summe`. Mitgemessen, aber nicht Teil des Vorschlags.

### 3.4 Stufe 3 — Der Armageddon-Entscheider (Klasse T — nur mit Chris' Zustimmung)

**Mechanik:** steht es nach sechs Brettern 3:3, gibt es ein siebtes Brett. Jeder Manager
nominiert vorab einen Spieler und bietet **verdeckt** eine Bedenkzeit zwischen 60 und 180 s; wer
weniger bietet, spielt Schwarz **mit Remisrecht** (|vorteil| unter einer Schwelle = Schwarz
gewinnt), der andere Weiß mit vollen 180 s und Siegzwang. Das Brett läuft über dieselben
`setz()`-Züge mit echter Uhr (Stufe 1/2). KI-Gebot deterministisch aus dem Kader (grob: je
stärker der eigene Spieler, desto weniger Zeit braucht er — Vorlage: die Norway-Kalibrierung
10:7 ≙ 53 % Weißsiege, s. 2.4).

**Warum T:** +10 s Sendezeit (20 Halbzüge × 0,5 s) plus ein neuer Eingabeschritt vor dem Kampf
(Gebot und Nominierung). Das ist Spielablauf. Nicht bauen ohne Chris. Der rho-Messwert bleibt
unberührt, wenn das siebte Brett **nach** allen `summe`-Würfen gezogen wird und sein Spieler
nicht ein zweites Mal in `wert()` einfließt.

**T-freie Alternative:** Fables S-F1 — Remis als ½ ab einer Vorteilsschwelle, Teamstand in
Brettpunkten, bei Gleichstand Berliner Wertung (Brett 1 zählt mehr). Deterministisch, keine
Sekunde Sendezeit, aber ohne Entscheidung des Managers. Beides kann koexistieren (S-F1 senkt die
3:3-Quote, Armageddon löst den Rest).

### 3.5 Was der Zuschauer sieht (Klasse A — alles erst ehrlich, wenn Stufe 1 steht)

- **Zwei Balken statt einem:** neben dem Bewertungsbalken ein **Uhr-Balken** (Restzeit beider
  Spieler als Tauziehen). „Die Uhr als dritter Spieler" wird lesbar: Stellung links, Zeit rechts,
  und der Zuschauer sieht, wenn sie sich widersprechen.
- **Zeitnot-Zone als Rundenwechsel** (die Chessboxing-Glocke): Übertritt unter 30 s ist ein
  Schnitt — Uhr rot und pulsierend, Hand-Schlag (`SCHACH_SCHLAG_T`) kürzer, Ticker einmal
  „Zeitnot! Cassandra, 28 s für 3 Züge", Ton. Nicht jeder Zug, nur der Übertritt.
- **Das Blättchen:** fällt die Uhr, kippt sie sichtbar (die Doppeluhr hat dafür ein Zifferblatt,
  `zeichneSchachuhr()`), Ton, Banner „SIEG AUF ZEIT" mit Vorteil in Klammern, wenn er
  widerspricht („… obwohl −41 auf dem Brett").
- **Ansage im Bild:** „Blitzen" / „Rechnen" als kleines Etikett an der Bauchbinde (das Feld
  `vizSlotLabel` zeigt, wie das geht), damit die Entscheidung des Managers im Replay zu sehen ist.
- **Ticker-Dosis:** die 120 Zeilen „findet den starken Zug" gehören ins Protokoll (Audit-Punkt
  8); sichtbar bleiben Zeitnot, Blättchen, Brettentscheid.

### 3.6 Bewusst nicht vorgeschlagen

- **Kein Paar-Rechner, keine Bewertung als Zustand (Opus S2), keine Phasen (S3).** Alle drei
  verlangen die 5.3-Frage (gegnerbereinigter Wert) oder ein zweites Rezept je Phase — die Disziplin
  mit der sauberesten Zahl des Feldes würde ihren größten Vorzug riskieren, bevor Tennis/Fechten
  stehen (Fables Einwand vom 30.09., dem ich mich anschließe).
- **Kein echter Schachmotor, keine Eval-Kopplung der Kulisse (S6).** Die Uhr-Sekunden sind wahr,
  die Stellung ist Kulisse — das bleibt so.
- **Kein Wagnis-Zuschlag zusätzlich zur Tempo-Ansage.** Zwei Knöpfe, die beide „Risiko" heißen,
  sind Chris' ausdrücklicher Einwand gegen „Push" (Konsultation Befund A). Wenn eine Haltung,
  dann die, die im Sport existiert: Tempo.
- **Kein Clutch-Brett** (2.5, numerisch zu schwach).

---

## 4. Klasse-Einstufung

| Baustein | Klasse | Warum | Zustimmung |
|---|---|---|---|
| Stufe 1 — Blättchen entscheidet das Brett, TEMPO-Uhr | **B** | Ergebnisschicht, `summe` bit-identisch; Teamwertung/Spiegel ändern sich | Chris (Mechanik) |
| Kalibrierung der Zugkosten (8/20 → 12/17 o. ä.) | B | reine Konstante, entscheidet aber über Sinn von Stufe 1 | mit Stufe 1 |
| Stufe 2 — Tempo-Ansage je Brett, Zeitnot ins Rezept, KI-Zeitbudget | **B** | `summe` ändert sich; Messrunde Pflicht (rho, Pp, Spiegel, Extremfälle) | Chris + Grundgerüst „Haltung" aus der Konsultation |
| Bedingte Ansage („Blitzen, wenn hinten") | B | braucht Anweisungsbilanz/Replay | nach Stufe 2 |
| Ausbaustufe „Druck" (Gegneruhr × 1,12) | B | Paarinteraktion, nur Ergebnisschicht | nur bei Bedarf |
| Stufe 3 — Armageddon mit Zeit-Gebot | **T** | +Sendezeit, neuer Eingabeschritt im Spielablauf | **nur Chris, explizit — wird nicht gebaut** |
| S-F1 Remis ½ + Berliner Wertung (Fable) | B | T-freie Antwort auf 3:3 | Chris |
| Uhr-Balken, Zeitnot-Schnitt, Blättchen-Animation, Ansage-Etikett, Ticker-Dosis | **A** | reine Anzeige — aber erst ehrlich, wenn Stufe 1 die Uhr echt macht | keine |

Nichts davon ändert `rundenN`/`rundenDauer` oder die Sendezeit, außer Stufe 3.

---

## 5. rho/Pp-Risikoeinschätzung (Scratch-Sonde, keine Engine)

**Methode.** Nachbildung von `setz()` + `art.duell`-Block mit den Original-Rezepten und
-Konstanten in einem Skript außerhalb des Repos (Scratch-Verzeichnis, nicht eingecheckt):
40 synthetische Spieler mit korrelierten Attributen (Niveau-Anteil 0,80, kalibriert, bis rho je
Spiel die Repo-Zahl trifft), je Fall 2 × 400 Spiele à 6 gegen 6, rho = Spearman über die zwölf
Teilnehmer je Spiel (wie `rangtreue-messung.mjs`), Pp nach `einflussVon()` (Attribut +15 bei
einem Spieler, Gewinn normiert, Σ|Anteil − Matrix|, zwei Saatstämme). Star = eignungsbester der
zwölf; Paartreue über Paare mit ≥ 15 Eignungspunkten Abstand.

**Die Nachbildung trifft das Repo:** rho 0,913 (Repo 0,906), Pp 14,9/16,1 (Repo 17,3/18,3),
Star auf Rang 1 80 %, Paartreue 99,8 %. Absolute Zahlen trotzdem nur als Richtung lesen — die
Abnahme läuft über `miss-alle-disziplinen.mjs 24 speed-schach` und
`messe-arena-einfluss.mjs speed-schach 24` (gestückelt 4 × 6), kaderfest, wenn Chris freigibt.

### 5.1 Haupttabelle (Uhr wie heute gekoppelt: 8 s stark / 20 s schwach, Tempo-Faktor 1,2 %/Punkt)

| Fall | rho/Spiel | rho/Saison | geflaggt (Spieler) | Zeitnot | Flagg-Entscheid gegen Vorteil (Bretter) | 3:3 | Heim / Gast | Star 1 / Top 2 | Paar ≥ 15 | Pp (2 Stämme) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| heute | 0,913 | 0,995 | 0,0 % | 0,0 % | 0,0 % | 30,0 % | 32,8 / 37,3 | 80,5 / 94,4 | 99,8 % | 14,9 / 16,1 |
| **Stufe 1** (nur Brett) | 0,913 | 0,995 | 3,9 % | 8,6 % | **0,1 %** | 30,0 % | 32,6 / 37,4 | 80,5 / 94,4 | 99,8 % | 14,9 / 16,1 (identisch) |
| **Stufe 2**, KI-Zeitbudget | **0,922** | 0,994 | 2,6 % | 9,1 % | 1,1 % | 30,5 % | 32,0 / 37,5 | 81,6 / 95,5 | 99,9 % | **12,3 / 14,3** |
| Stufe 2, KI naiv („Hände → blitzen") | 0,910 | 0,993 | 7,1 % | 12,1 % | 1,1 % | 29,8 % | 33,0 / 37,3 | 80,4 / 94,4 | 99,8 % | **21,6 / 18,0** |
| Stufe 2, alle „rechnen" | 0,911 | 0,993 | 22,1 % | 31,3 % | 0,7 % | 31,1 % | 32,3 / 36,6 | 81,6 / 95,5 | 99,8 % | 10,8 / 11,3 |
| Stufe 2, alle „blitzen" | 0,908 | 0,996 | 0,1 % | 0,3 % | 0,0 % | 29,5 % | 32,9 / 37,6 | 80,0 / 94,3 | 99,8 % | 15,7 / 17,1 |
| Stufe 2, Heim „rechnen", Gast KI | 0,916 | 0,993 | 12,7 % | 20,9 % | 2,7 % | 29,4 % | **28,9** / 41,8 | 81,6 / 95,5 | 99,8 % | — |
| Stufe 2, Heim „blitzen", Gast KI | 0,912 | 0,995 | 1,5 % | 4,9 % | 0,6 % | 28,1 % | **27,6** / 44,3 | 80,0 / 93,6 | 99,8 % | — |
| Stufe 2, Heim KI, Gast „rechnen" | 0,917 | 0,993 | 12,0 % | 19,5 % | 2,4 % | 30,5 % | 36,4 / 33,1 | 81,6 / 95,5 | 99,8 % | — |

(Heim/Gast-Asymmetrie 32,8/37,3 ist Stichprobenrauschen der synthetischen Paarung — beide
Seiten laufen durch denselben Code. Die Spiegelmessung im Repo ist davon unabhängig Pflicht.)

### 5.2 Entkoppelte Uhr (12 s stark / 17 s schwach, Tempo-Faktor 2,2 %/Punkt)

| Fall | rho/Spiel | geflaggt | Zeitnot | Flagg-Entscheid gegen Vorteil | Heim / Gast | Pp |
|---|---:|---:|---:|---:|---:|---:|
| Stufe 1 (nur Brett) | 0,913 | 9,5 % | 19,8 % | **1,1 %** | 32,4 / 37,4 | 14,9 / 16,1 (identisch) |
| Stufe 2, KI-Zeitbudget | 0,923 | 1,2 % | 2,7 % | 0,0 % | 31,1 / 37,1 | 12,2 / 13,4 |
| Stufe 2, KI naiv | 0,910 | 14,8 % | 23,2 % | 2,8 % | 32,6 / 37,1 | 16,7 / 14,8 |
| Stufe 2, alle „rechnen" | 0,920 | 37,0 % | 45,6 % | 0,7 % | 30,5 / 36,8 | 18,8 / 11,7 |
| Stufe 2, Heim „rechnen", Gast KI | 0,920 | 19,8 % | 24,9 % | **5,5 %** | **21,8** / 48,8 | — |

### 5.3 Lesart

1. **Stufe 1 ist rho/Pp-sicher per Konstruktion** — die Spalten sind identisch zu „heute". Ihr
   Risiko liegt woanders: ob die Flagge je etwas Neues erzählt. Gekoppelt (8/20) nie (0,1 %),
   entkoppelt (12/17) selten (1,1 %). Das Zielband (2–4 % der Bretter) braucht noch weitere
   Entkopplung oder einen stärkeren TEMPO-Faktor; das ist eine Konstante, kein Rezept.
2. **Stufe 2 mit Zeitbudget-KI ist rho-positiv und Pp-positiv** (0,922, Pp 12–14): Zeitnot
   trifft überwiegend die, die ohnehin unten stehen, und speed/dexterity bekommen über TEMPO
   den Anteil, den die Matrix ihnen gibt (speed 7,1 → 8,5 %, Matrix 10). Puffer zur Schranke
   bleibt groß.
3. **Die Pp-Falle ist die KI-Regel, nicht das Rezept.** Naive Regel: Pp 21,6 / 18,0 — nahe der
   Schranke, mit speed auf 3,6 %. Dieselbe Mechanik, andere Vorgabe. Für die Messrunde heißt
   das: KI-Regel auf beiden Seiten plus Extremfälle, wie die Konsultation (Regel 5) es verlangt.
4. **„Kein Knopf immer besser" hält:** pauschal Rechnen oder Blitzen verliert gegen die
   KI-Regel, in der entkoppelten Fassung deutlich (21,8 % Heimsieg bei „alle rechnen"). Die
   Entscheidung je Brett ist der Hebel; wer ihn falsch pauschalisiert, zahlt.
5. **Der Konflikt zwischen 1 und 2:** die entkoppelte Uhr, die Stufe 1 braucht, macht die KI in
   Stufe 2 so vorsichtig, dass sie fast nie flaggt (0,0 %) — die Flagg-Momente kommen dann nur
   noch aus Manager-Entscheidungen (5,5 % bei „Heim rechnen"). Das ist vielleicht sogar richtig
   (die Flagge als Folge einer *Entscheidung*), muss aber bewusst so gewählt werden.
6. **3:3 bleibt bei ~30 % in jeder Variante** — die Uhr löst das Unentschieden-Problem nicht.
   Dafür braucht es Stufe 3 oder S-F1.

**Was die Sonde nicht kann:** echte Kaderfamilien, Slot-/Form-/Mutator-Zuschläge, Unterzahl,
`spieleBuehneDuell()`-Teamwertung, Sendezeit. Alles davon gehört in die Messrunde.

---

## 6. Offene Fragen / Entscheidungen für Chris

1. **Stufe 1 ja/nein:** darf ein Brett auf Zeit verloren gehen, obwohl der Vorteil anders steht
   (der Gewichtheben-Grundsatz, für Schach)? Wenn ja: Zielband für „Sieg auf Zeit gegen den
   Vorteil" — mein Vorschlag 2–4 % der Bretter.
2. **Stufe 2 — die Tempo-Ansage als *die* Schach-Haltung** anstelle des Wagnis-Zuschlags aus der
   Konsultation? Oder beide (dann zwei Knöpfe)? Hängt an der Grundsatzfrage der Konsultation
   („Haltung" als eigene Achse neben Intensität).
3. **Zeitnot ins Rezept (Stufe 2) oder nur ins Brett (Stufe 1)?** Ins Rezept ist ehrlicher (der
   Patzer in Zeitnot ist schlechtere Leistung) und laut Sonde sogar rho-/Pp-günstig — aber
   `summe` ändert sich, Messrunde Pflicht.
4. **3:3 — Armageddon mit Gebot (Klasse T, +10 s Sendezeit, Eingabeschritt) oder Berliner Wertung
   (S-F1, deterministisch, keine Entscheidung)?** Beides ist möglich, Armageddon ist das
   interaktivere, S-F1 das billigere. Ohne eines von beiden endet jeder dritte Kampf ohne Sieger.
5. **Reihenfolge:** Speed-Schach steht in Fables Rangliste bewusst zuletzt (sauberste Zahl).
   Wenn die Konsultation das Grundgerüst „Haltung" ohnehin baut, ist Stufe 2 die eine Zeile, die
   Schach daran anschließt — Stufe 1 kann unabhängig davon vorher laufen.

## 7. Quellen

Web (alle am 03.10. abgerufen):
- [chess.com — Flagging in Chess](https://www.chess.com/terms/flagging-chess) — Definition, Botez/Hansen
- [chessdom — Firouzja dirty flags Carlsen (Global Chess League)](https://www.chessdom.com/alireza-firouzja-dirty-flags-magnus-carlsen-in-day-2-of-global-chess-league/)
- [Lichess-Blog — The Art of Flagging: Bullet Chess Survival Guide](https://lichess.org/@/Abhiramlanka/blog/the-art-of-flagging-bullet-chess-survival-guide/j46qkxJQ) — Pre-Moves, „dirty flagged"
- [chess.com Forum — Flagging in Bullet Chess](https://chess.com/forum/view/for-beginners/flagging-in-bullet-chess)
- [jk_182 — How the Evaluation and Clock impact Results of Blitz Games](https://chessenginelab.substack.com/p/evaluation-time-score) (Lichess-Original: [I2kRp2sk](https://lichess.org/@/jk_182/blog/how-the-evaluation-and-clock-impact-results-of-blitz-games/I2kRp2sk)) — Zeitnot-Schwelle 10–30 s, Kollaps unter 5 s
- [ChessBase — SCC Finals 2025/26 Preview](https://en.chessbase.com/newsroom/post/speed-chess-ch-2025-26-preview?page=0) — Format 5+1/3+1/1+1, Armageddon-Gebot
- [Simon M. — Armageddon Chess: a bidder's guide](https://simonm.substack.com/p/armageddon-chess-a-bidders-guide) — Gebotsmechanik, Norway 10:7 → 53 % Weiß
- [Wikipedia — Norway Chess 2025](https://en.wikipedia.org/wiki/Norway_Chess_2025) — 10 min Weiß, 7 min Schwarz mit Remisrecht
- [chess.com — Clutch Chess Day 1](https://www.chess.com/news/view/clutch-chess-day-1), [US Chess — Clutch Chess begins](https://new.uschess.org/online-events/clutch-chess-begins-top-four-americans-facing-off-new-format) — doppelt/dreifach zählende Schlusspartien
- [gamerules.com — Chess Boxing](https://gamerules.com/rules/chess-boxing/) — 11 Runden, 4/3 min, 12 min Schachuhr, Remis → Zusatzrunde Boxen
- [Wikipedia — PRO Chess League](https://en.wikipedia.org/wiki/PRO_Chess_League) — 4 gegen 4, Mannschaftspunkte

Repo: `public/mockups/battle-mode.engine.js` (`BUEHNE_ART["speed-schach"]` :14820,
`buehneErfolgschance`/`buehneWagnisFaktor` :15538, `setz()` :15657, `art.duell`-Block :15797,
`schachUhrWert()` :20138, `stepSchach()` :20143, `zeichneSchach()` :26383, `einflussVon()`
:44289), `scripts/lib/rangtreue-messung.mjs`, `lib/lineups/matchday-slot-roles.ts` (:192–199),
`docs/design/manager-risiko-interaktivitaet-konzept-02-10.md`,
`docs/design/fable-ideen-buehne-duell-30-09.md`, `docs/design/speed-schach-fable-recherche-12-09.md`,
`docs/design/f1-broadcast-audit-runde-2-30-09.md`, Branch `buehne-duell-konzeptreview-26-09`
(Opus-Review, Abschnitt 2), CLAUDE.md.
