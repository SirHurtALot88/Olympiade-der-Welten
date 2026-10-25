# Football: Kickoff, Snap, „Goalkicks" — Regel-Recherche + Sichtbarkeits-Audit (K5, 14.10.)

**Konzeptpapier, kein Code, keine Freigabe.** Football-Hälfte von K5
(`fable-konzept-chris-feedback-13-10.md` Abschnitt 5.5, „Feldspiel: Football zuerst, dann
Basketball/Hockey") und Ausarbeitung von Punkt 23 aus
`docs/design/chris-feedback-breite-runde-13-10.md`. Chris, wörtlich (13.10.):

> „Football benötigt auch einen richtigen Kickoff mit Animationen etc! bisher wird da nur
> gerangelt, es geht gar nicht richtig voran, der quarterback muss ja normal den ball bekommen,
> die anderen spieler vom gegner wollen hin und die defender blocken -> da muss auch mal
> geworfen werden oder dass es diese goalkicks gibt - die kenne ich die regeln nicht! bitte
> anpassen"

Chris sagt selbst, dass er die „Goalkicks"-Regeln nicht kennt. Dieses Papier ordnet seinen Wunsch
deshalb zuerst in echte NFL-Regeln ein (Abschnitt 2), prüft **danach** — wie von Chris' eigener
Formulierung „Konzeptrunden … Sonde an Motorkopie" verlangt — was der Motor davon bereits simuliert
und zeigt (Abschnitt 3), und stellt erst am Ende die Mechanik- und Formatfrage (Abschnitt 4/5), ohne
sie zu entscheiden. **Nichts an `public/mockups/battle-mode.engine.js` wurde für dieses Papier
geändert.** Alle Zeilenangaben gelten für `origin/main` `5da90654` (14.10., letzter Commit, der die
Datei berührt hat).

**Bindender Rahmen (CLAUDE.md):** Football steht aktuell bei rho 0,818/Spiel (0,874 Saison,
26.09.-Nachtrag `stand-aller-disziplinen.md`) — über der 0,80-Schranke, mit Puffer. Die
Pp-Pflichtprüfung ist **verletzt**: je nach Messzeitpunkt zwischen 47,3 und 60,6 Pp (Ziel ≤ 25,
s. Abschnitt 3.4 unten) — Football bleibt deshalb bewusst außerhalb von
`ARENA_RESOLVED_DISCIPLINE_IDS`, also nicht im echten Spielstand. Jeder künftige Eingriff unterliegt
der Abbruchregel aus Abschnitt 5.5 des Master-Konzepts: fällt rho unter 0,818 oder wandert Pp noch
weiter über 25, bekommt nur das **Bild** die Änderung, nie die Entscheidungslogik. Dass das kein
theoretisches Risiko ist, zeigt ein bereits gescheiterter Versuch: `football-rezept-sondierung-
awareness-ausdauer-spirit-02-10.md` Zeile 11 hält fest, dass P1 (Uhr/Spielstand-Bewusstsein) „geparkt
wegen Pp 47,3→71,1" wurde — derselbe Baustein, den Chris' Kickoff-Wunsch berührt, hat die Pp-Zahl
in einem früheren Anlauf bereits verschlechtert statt verbessert, nicht am Kickoff selbst, aber am
benachbarten Spielstands-Bewusstsein.

Außerdem geteilter Chassis-Hinweis aus CLAUDE.md: `bauFeldspiel()` in `battle-mode.engine.js` ist
die gemeinsame Funktion für Basketball, Football und Hockey. Dieses Papier bleibt strikt
Football-exklusiv — jede hier skizzierte künftige Änderung müsste, wie die Opus-Runde vom 09.10. es
für ihre eigenen Vorschläge nachgewiesen hat (`opus-plan-football-gameplay-09-10.md` Abschnitt 7),
ausschließlich in football-eigenen Funktionen/Zweigen laufen und mit `git diff` in einem Blick als
Basketball/Hockey-unberührt prüfbar sein.

---

## 0. Ergebnis vorab

1. **Der wichtigste Einzelbefund: der Snap, den Chris vermisst, existiert nicht einmal als
   Animation — nicht „unsichtbar simuliert", sondern schlicht nicht gebaut.** Beim Pass fliegt der
   Ball in `animiereFootballZug()` von der Line-of-Scrimmage-Koordinate `s.losX` direkt zum Ziel
   (`engine.js:10362`) — nie erst zu einem Spieler an der Center-/QB-Position. Es gibt keine
   Center-zu-QB-Teilphase. Dazu kommt ein zweiter, tieferliegender Fehler: der Spieler, der optisch
   auf dem QB-Platz steht, ist nicht notwendig der Spieler, den die Simulation als Werfer gezogen hat
   — `starteSnap()` (`:10707`) vergibt Formationsplätze nach **Team-Reihenfolge**
   (`FSTEAM[fb.side].forEach((u,i)=>...)`, `:10722`), während `resolvePass()` den Passer **separat**
   über `fkLos(off,"PASSGENAUIGKEIT")` auslost (`:10219`) — derselbe Befund, den das
   Football-Opus-Konzeptreview vom 26.09. schon unter „0.2 Wer den Ball anfasst" notiert hatte und
   der bis heute nicht behoben ist.
2. **Zweiter wichtiger Befund: Vieles, was wie eine Lücke aussieht, ist tatsächlich schon da.**
   Down & Distance wird angezeigt (`"1st & 10"`-Kontextzeile, `engine.js:14029-14032`), Field Goal
   und Punt sind als eigene, unterscheidbare Ereignisse simuliert UND animiert (Bogenwurf,
   `:10316-10332`) UND im Feed benannt (`"Field Goal von 43 Yards ist gut"`, `:10548`; `"Punt —
   Ballwechsel"`, `:10586`), und die Field-Goal-Erfolgsquote ist bereits **gegen echte NFL-2024-
   Zahlen kalibriert** (`:10281-10286`). Chris' „die kenne ich die Regeln nicht" trifft vermutlich
   genau diese beiden Ereignisse — sie existieren, sind aber nicht als eigenständiges „jetzt kommt
   ein Kick"-Momentum inszeniert und laufen in derselben generischen Snap-Choreografie wie jeder
   andere Spielzug ab (s. Abschnitt 3.5).
3. **Der Kickoff selbst dagegen fehlt vollständig — das ist der einzige Teil von Chris' Wunsch, der
   wirklich eine neue Mechanik braucht, kein Sichtbarkeits-Fix.** `beginneFootballSerie()`
   (`:10779`) kommentiert es selbst: „ein Kickoff nach einem Score fährt immer auf den
   Standard-Touchback-Spot, kein Rückgabespiel modelliert" — kein Kick, kein Flug, kein Returner,
   keine Deckung, nichts zu sehen. Was Chris als „nur gerangelt" beschreibt, ist mit hoher
   Wahrscheinlichkeit die `fkEngageZiel()`-Bewegung (`:10411-10417`, seit 06.09. gebaut, s.
   Abschnitt 3.2) — eine kleine Aufeinander-zu-Bewegung der acht am Spielzug nicht direkt
   beteiligten Spieler, die bei **jedem** Snap abläuft, Kickoff eingeschlossen (weil es den als
   eigenen Moment gar nicht gibt).
4. **Pass-Block und Pass-Rush sind, wie Chris vermutet, ein Zwei-Personen-Duell ohne Linie.**
   `resolvePass()` rechnet die Sack-Chance aus `rusher.ABWEHR_PASS − passer.PASSSCHUTZ` (`:10228`)
   — der Passer verteidigt sich mechanisch selbst, eine Offensive Line als eigene Entität gibt es
   nicht. Visuell gibt es seit der Bewegungs-Runde vom 06.09. immerhin eine angedeutete Blockbewegung
   (`fkEngageZiel`, s.o.), ausdrücklich „keine vollständige Block-Assignment-Nachbildung" laut
   eigenem Kommentar (`:10392-10399`) und ohne jede Wirkung auf die Erfolgsformel.
5. **Regel-Recherche (Abschnitt 2):** Kickoff, Punt, Field Goal/XP/Two-Point, der Snap selbst und
   Pass-Block/-Rush, auf dem Stand der echten, seit 2024 geänderten Dynamic-Kickoff-Regel (seit der
   Saison 2025 permanent, Touchback jetzt an der 35).
6. **Die Mechanikfrage (Abschnitt 4) wird nicht entschieden.** Ein Kickoff-Return als eigene
   Zustandsmaschine ist in der Opus-Konzeptreview vom 26.09. als P4 skizziert
   (`football-opus-konzeptreview-26-09.md`, Branch `football-konzeptreview-26-09`, dort NICHT
   gemergt) und im Reihenfolgeplan selbst **nach** P1–P3 vorgesehen — dieses Papier hält diese
   Reihenfolge fest, baut aber nichts.
7. **Die Formatfrage E7 (Abschnitt 5) bleibt bei der bestehenden Empfehlung: NFL-Modell behalten.**
   Field Goal und Punt existieren schon in NFL-Form und sind kalibriert; ein Wechsel zur Arena
   Football League (kein Punt, Rebound-Netze) würde beides verwerfen und vier Kalibrierrunden
   entwerten. Aber: Chris' eigenes „die kenne ich die Regeln nicht" bei den Goalkicks ist ein neues
   Signal, das die Frage noch einmal wert macht, bevor eine Kickoff-Return-Zustandsmaschine gebaut
   wird (s. Abschnitt 5, letzter Absatz).
8. **Für eine künftige Runde: ein kleiner Teil ist reine Anzeige (Klasse A), der Rest ist Mechanik
   (Klasse B/C) und braucht Chris' Entscheidung plus volle rho-/Pp-Messung.** Abschnitt 6 trennt
   beides und nennt die offenen Fragen an Chris in Abschnitt 7.

---

## 1. Was dieses Papier ist und was nicht

Reine Konzept-/Rechercherunde, kaderfest an keiner Stelle gemessen (kein Code geändert, also nichts
zu messen). Auftrag laut Master-Konzept Abschnitt 5.5: „Regel-Recherche … dann der
Sichtbarkeits-Audit: was davon simuliert der Motor schon … aber zeigt es nicht lesbar? Erst danach
die Mechanikfrage." Dieses Papier hält sich an die Reihenfolge und geht nicht darüber hinaus — es
schlägt keine Zeile Code vor, die diese Runde selbst bauen würde. Die K5-Basketball/Hockey-Hälfte
(Punkt 22/24b) ist ausdrücklich nicht Teil dieses Papiers.

---

## 2. Regel-Recherche: was „Kickoff" und „Goalkick" in der NFL wirklich bedeuten

Kurz gehalten, für jemanden ohne Football-Vorwissen — genau Chris' eigene Einschränkung.

### 2.1 Kickoff — seit 2024 ein anderes Spiel als vorher

Der Kickoff eröffnet jede Halbzeit und folgt auf jeden erzielten Punktgewinn. 2024 hat die NFL die
Regel grundlegend umgebaut („Dynamic Kickoff"), 2025 wurde sie dauerhaft übernommen und noch einmal
verschärft:

- **Aufstellung:** Der Kicker tritt weiter von der eigenen 35-Yard-Linie, die übrigen zehn Spieler
  der kickenden Mannschaft stehen mit einem Fuß an der gegnerischen 40. Die empfangende Mannschaft
  muss mindestens neun Spieler in eine fünf Yards breite „Setup Zone" zwischen ihrer eigenen 30 und
  35 stellen. Niemand darf sich bewegen, bevor der Ball berührt wird oder in der „Landing Zone"
  aufkommt — der Sprint-Start, der früher den ganzen Platz querte, ist damit weg.
- **Touchback:** Ein Ball, der in der Endzone landet und dort heruntergenommen wird (oder im Flug
  die Endzone verlässt), ist ein Touchback. Der Touchback-Ort ist seit 2024 mehrfach verschoben
  worden: vorher die 25, 2024 die 30, **seit der Saison 2025 die 35**.
- **Kurze Kicks:** Ein Kick, der die Landing Zone nicht erreicht, wird wie ein Kickoff im Seitenaus
  behandelt — die empfangende Mannschaft bekommt den Ball automatisch an ihrer eigenen 40.
- **Onside Kick:** Nur noch dort erlaubt, wo eine Mannschaft zurückliegt, dafür nicht mehr auf das
  vierte Viertel beschränkt — ein zurückliegendes Team darf jederzeit ankündigen und versuchen.
- **Wirkung:** Die Rückgabequote stieg von 21,8 % (altes Regime) auf 32,8 % (2024) — der Kickoff ist
  bewusst wieder ein Spielzug mit echtem Rückgabespiel statt eines reinen Ritualaktes geworden.

### 2.2 Punt — der taktische Verzicht auf den vierten Versuch

Gelingt eine Serie nicht, tritt die Offense den Ball im vierten Versuch ab, statt ihn zu riskieren.
Das Ziel ist Feldposition, nicht ein Score:

- **Touchback:** Landet der Punt unberührt in der gegnerischen Endzone oder wird dort heruntergenommen,
  bekommt die empfangende Mannschaft den Ball an ihrer eigenen 20.
- **Fair Catch:** Der Returner kann die Rückgabe durch Winken über dem Kopf abwählen — der Ball wird
  am Fangort sofort tot, keine Rückgabe, aber auch kein Risiko eines Fumbles.
- **Downed:** Ein Spieler der kickenden Mannschaft kann den Ball vor dem Returner durch Knien
  „herunternehmen" — die Mannschaft, die den Punt getreten hat, verteidigt so die Feldposition aktiv.
- **Seitenaus:** Geht der Punt im Flug oder nach Aufsetzen ins Seitenaus, bekommt die empfangende
  Mannschaft den ersten Versuch an genau diesem Punkt — ein gezielter, kurzer „Coffin Corner"-Punt
  nah an der gegnerischen Torlinie ist eine eigene Kunstform.
- **Illegal Touching:** Berührt ein Spieler der kickenden Mannschaft den Ball zuerst, bevor er die
  Line of Scrimmage überquert hat, bekommt die empfangende Mannschaft den Ball am Berührungsort.

### 2.3 Field Goal, Extra Point, Two-Point Conversion

- **Field Goal:** Der Kicker versucht, den Ball zwischen den Torstangen über die Querlatte zu treten.
  Drei Spezialisten sind beteiligt: der Long Snapper (schnappt den Ball ca. 1,5 Yards über dem
  Kicker-Fußabdruck direkt zum Holder), der Holder (fängt, dreht die Nähte nach vorn, setzt den Ball
  in weniger als einer Sekunde ab) und der Kicker selbst — die gesamte Sequenz dauert real rund
  1,3 Sekunden, eine Verzögerung von wenigen Hundertstelsekunden erhöht das Blockrisiko spürbar.
  Gelingt der Kick nicht, bekommt die Verteidigung den Ball am Ort des Anlaufs der Offense (bzw. am
  Spot des Snaps bei kurzen Distanzen).
- **Extra Point (XP):** Nach jedem Touchdown kann die Mannschaft einen Kick von der 15-Yard-Linie
  (seit der Regeländerung 2015, vorher deutlich kürzer und fast automatisch) für einen Punkt wählen.
- **Two-Point Conversion:** Alternative von der 2-Yard-Linie — Lauf oder Pass über die Torlinie zählt
  zwei Punkte. 2024 lag die reale Erfolgsquote auf einem 15-Jahres-Tief, weil Verteidigungen sich
  gezielt darauf eingestellt haben.
- Beide Versuche sind „live": Eine Defense kann einen geblockten Kick oder einen Turnover bei einem
  Two-Point-Versuch selbst für zwei Punkte zurücktragen.

### 2.4 Der Snap — wie der QB den Ball wirklich bekommt

Der Center reicht den Ball zwischen den eigenen Beinen hindurch an den Quarterback. Zwei Varianten:

- **Under Center:** Der QB steht direkt hinter dem Center, der Ball wird kurz und direkt nach oben in
  die Hände gereicht — die klassische Haltung für Läufe und Play-Action, weil der QB sofort einen
  Handoff geben oder vortäuschen kann.
- **Shotgun:** Der QB steht 4–7 Yards zurückversetzt, der Center wirft den Ball durch die Luft zu ihm
  — mehr Zeit und besserer Überblick für den QB, dafür ein höheres Risiko eines verunglückten Snaps
  und ein für die Defense erkennbarerer Passversuch. 2023 lag die Liga auf einem Shotgun-Höchststand,
  seither bewegen sich einzelne Teams wieder zurück Richtung Under Center.
- Der Spielzug beginnt offiziell in dem Moment, in dem der Center den Ball vom Boden löst — danach
  dürfen sich alle Spieler bewegen. Bei Punts und Field Goals übernimmt ein eigens trainierter „Long
  Snapper" diesen Wurf, weil ein verunglückter Snap dort ein Spiel sofort entscheiden kann.

### 2.5 Pass-Block und Pass-Rush

Auf einem Passspielzug ist die Offensive Line nicht dazu da, Gegner wegzudrücken, sondern den
Quarterback **sauber** zu halten: Die Lineman feuern aus der Haltung, setzen die Füße und benutzen
Hände/Fußarbeit, um den Rusher vom Quarterback fernzuhalten, statt ihn zu blocken wie bei einem
Laufspielzug. Jeder einzelne Blocker ist ein Glied einer Kette — ein einziger durchbrechender Rusher
reicht für einen Sack, unabhängig davon, wie gut die anderen vier stehen. Die Defensive Line
versucht im Gegenzug, mit Tempo, Kraft oder Finten am Blocker vorbeizukommen; jeder Rusher hat dabei
eine feste „Lane", damit der Quarterback nicht einfach aus der Pocket läuft. Schnelles Werfen ist die
wirksamste Gegenmaßnahme der Offense gegen jeden Pass-Rush, weil es dem Rusher die Zeit nimmt.

---

## 3. Sichtbarkeits-Audit: was der Motor heute tatsächlich tut

Alle Zeilenangaben `public/mockups/battle-mode.engine.js`, `origin/main` `5da90654`. Drei Kategorien,
wie Abschnitt 5.5 des Master-Konzepts sie verlangt: **sichtbar simuliert**, **simuliert, aber nicht
lesbar**, **genuinely fehlend**. Eine vierte, in diesem Motor besonders football-typische Kategorie
kommt dazu: **simuliert und gezeichnet, aber nicht mechanisch verdrahtet** — etwas, das man sieht,
das aber auf das Ergebnis keinen Einfluss hat.

### 3.1 Schon sichtbar simuliert (überraschend viel)

| Was | Fundstelle | Befund |
|---|---|---|
| Down & Distance | `:14029-14032` | HUD-Kontextzeile `"▶ 1st & 10"` — live, pro Snap aktualisiert. |
| Field Goal als eigenes Ereignis | `resolveFieldgoal` `:10287-10294`, Feed `:10548` | Distanzabhängige Erfolgsquote **gegen echte NFL-2024-Zahlen kalibriert** (76,9 % bei 40–49 Yards, 71,7 % bei 50+, Kommentar `:10281-10286`), eigene Bogenanimation `:10316-10332`, eigener Feed-Text und Schwebetext „FIELD GOAL!". |
| Punt als eigenes Ereignis | `resolvePunt` `:10296`, Feed `:10586` | Eigene Bogenanimation (dieselbe Funktion wie FG), eigener Feed „Punt — Ballwechsel". |
| Formation reagiert auf Down/Distance | `waehleFormationOffense/-Defense` `:9992/:9998` | „eng" (I-Form) bei kurzer Distanz/Goal-Line, „weit" (Shotgun/Spread) sonst; „nickel" bei Pass-Situationen — Schwellen laut Kommentar `:9982-9991` aus realen 2024-Quellen (Gridiron Deep Dive/Sharp Football Stats) übernommen. |
| Spielzugwahl nach Down/Distance | `waehlePlayCall` `:10037-10056` | Lauf-/Pass-Anteil interpoliert nach realen NFL-Quoten, inkl. „Money Down"-Unterscheidung (3./4. Versuch). |
| Pass-Tiefe nach Situation | `waehleFootballTier` `:10201-10206` | Auf 3./4. Versuch wird häufiger über die Distanzmarke geworfen — „distance to sticks". |
| EPA je Zug | `footballEpVon`/`footballDownWeiter` `:10485-10542`, Buchung in `vollziehFootballErgebnis` `:10543-10698` | Jeder Snap bucht Expected-Points-Added auf die beteiligten Akteure — existiert vollständig, **aber nirgends gezeigt** (s. 3.2). |

Das relativiert Chris' „es geht gar nicht richtig voran" an einer Stelle deutlich: Down, Distance,
Formation und sogar die Field-Goal-/Punt-Ereignisse selbst sind nicht das Problem — sie laufen
bereits nah an der realen NFL-Logik aus Abschnitt 2.

### 3.2 Simuliert, aber nicht lesbar

- **EPA wird nirgends gezeigt.** Der komplette F1-Umbau (EPA-Buchung an Passer/Receiver/Läufer/
  Tackler, `:10507-10696`) ist reine Hintergrundbuchhaltung — kein Feed-Text, kein HUD-Element liest
  `erg.spieler.epa`. Ein Zuschauer sieht nie, wer den Impact eines Zugs wirklich trug, obwohl die
  Zahl längst existiert.
- **Der 3. Versuch wird nicht als Wendepunkt erzählt.** Der Motor spielt ihn strukturell richtig
  (eigene Playcall-/Tiefen-Schwelle), aber ein konvertierter 3rd & 8 sieht im Feed genauso aus wie
  ein 1st-Down-Lauf — kein eigener Text, kein Kamera-/Zoom-Moment. Schon im Opus-Plan vom 10.09.
  benannt (Abschnitt 6.3 Punkt 1 dort), bis heute nicht gebaut.
- **Die Block-Andeutung (`fkEngageZiel`, `:10401-10417`) trägt kein Ergebnis.** Die acht nicht direkt
  am Zug beteiligten Spieler bewegen sich sichtbar 35 % des Weges aufeinander zu — genau die
  Bewegung, die Chris vermutlich als „gerangelt" wahrnimmt, weil sie bei jedem Snap (auch nach einem
  Touchdown, wo real ein Kickoff folgen müsste) identisch abläuft, ohne dass ein Zuschauer sie von
  einem echten Blockgewinn/-verlust unterscheiden kann.

### 3.3 Sichtbar, aber falsch verdrahtet — der Kern von Chris' Snap-Wunsch

- **Der Ball „snapt" nicht zum QB, er fliegt direkt vom Line-of-Scrimmage-Punkt los.**
  `animiereFootballZug()` (`:10313-10364`) setzt den Startpunkt jeder Pass-/Lauf-/Kick-Animation auf
  `s.losX` (die X-Koordinate der Line of Scrimmage, nicht die Position eines gezeichneten Spielers).
  Es gibt keine „formation → Snap zum Center-/QB-Platz → Dropback → Wurf"-Teilphase — die
  `stepSnapPhase()`-Stufe „formation" (`:10752-10759`, 0,9 s) zeigt den Ball unbewegt an der Line
  (`:10756`), dann springt er in der „zug"-Stufe direkt Richtung Ziel.
- **Der Spieler am QB-Platz ist nicht notwendig der gewürfelte Passer.** `starteSnap()` (`:10707`)
  vergibt die Formationsplätze (`SLOTS_FOOTBALL_OFF`, `:9960-9965` — Slot 0 ist der QB-/Center-Platz)
  strikt nach Team-Reihenfolge (`FSTEAM[fb.side].forEach((u,i)=>...)`, `:10722`). `resolvePass()`
  zieht den tatsächlichen Werfer dagegen unabhängig über `fkLos(off,"PASSGENAUIGKEIT")` (`:10219`,
  κ=3,4-Lotterie). Beide Zuweisungen laufen nebeneinander her, ohne sich abzustimmen — exakt der
  Befund, den das Opus-Konzeptreview vom 26.09. unter „0.2 Wer den Ball anfasst" dokumentiert
  („Der gezeichnete Passer kann als Wide Receiver am Rand stehen, während der Ball aus der Mitte
  fliegt") und der auf dem heutigen Stand unverändert zutrifft.
- **Pass-Schutz hat keine Linie.** `resolvePass()` rechnet die Sack-Chance direkt aus
  `rusher.ABWEHR_PASS − passer.PASSSCHUTZ` (`:10228`) — PASSSCHUTZ ist ein Attribut **des Passers
  selbst**, keine separate Offensive-Line-Entität. Die optische Block-Andeutung aus 3.2 ist davon
  komplett entkoppelt (eigener Kommentar `:10392-10399`: „keine dieser Funktionen wird von
  resolveLauf/resolvePass … gelesen").

### 3.4 Genuinely fehlend — keine Sichtbarkeits-Lücke, sondern eine neue Mechanik

- **Kickoff komplett.** `beginneFootballSerie()` (`:10779-10786`) plus der Kommentar direkt davor
  (`:10775-10778`): „ein Kickoff nach einem Score fährt immer auf den Standard-Touchback-Spot, kein
  Rückgabespiel modelliert." Kein Kick-Wurf, kein Returner, keine Deckungsspieler, keine
  Feldpositions-Verteilung — der Ballbesitz wechselt unsichtbar auf `startSpot:75` (die eigene
  25-Yard-Linie im alten Touchback-Schema, s. `:7079`).
- **Returns nach Interception/Fumble/Punt.** Alle drei setzen den neuen Ballbesitz exakt an den Ort
  des Turnovers (`fkNaechsterSpot=...`, `:10538/:10629/:10646/:10588`) — kein Returner, keine Yards.
- **Punt-Touchback.** Ein Punt aus Spot 39–41 legt den Gegner nach der aktuellen Formel immer an
  dessen eigene 1-Yard-Linie, weil es keine Endzonen-Sonderregel gibt (derselbe Befund F6 aus dem
  26.09.-Review, am heutigen `resolvePunt`/`vollziehFootballErgebnis`-Code weiterhin nachvollziehbar).
- **Skill-basierter Punt/Kicker.** `puntNetto` ist eine feste Konstante (40, `:7079`), kein Spieler
  zieht sie. Field Goal/XP sind reine Distanz- bzw. Pauschalquoten ohne Kicker-Attribut — eine
  bewusste, bereits getroffene Entscheidung („Football-Plan D: kein Kicker-Slot bei sechs
  Feldspielern", Kommentar `:10279/:10550`), nicht ein Bug.
- **Safety, Overtime, Halbzeit-Kickoff-Seitenwechsel, Two-Point-Conversion.** Keines davon existiert;
  die zweite Halbzeit beginnt mit der Seite, die gerade dran war, statt mit einem Kickoff der
  anderen (unverändert gegenüber dem 26.09.-Befund F5).
- **4. Versuch kennt Spielstand/Uhr nicht.** `waehleVierterVersuch(spot,toGo)` (`:10061-10066`) liest
  weder Punktestand noch Restzeit — ein Team puntet im letzten Viertel auch bei zweistelligem
  Rückstand. Ein früherer Versuch, genau das zu beheben (P1), ist dokumentiert **gescheitert**: Pp
  verschlechterte sich von 47,3 auf 71,1 (`football-rezept-sondierung-awareness-ausdauer-spirit-
  02-10.md:11`) — ein Hinweis, dass dieser Punkt nicht trivial ist, auch wenn er klein aussieht.
- **Pp-Pflichtprüfung insgesamt verletzt.** Sechs der zwölf Matrixattribute (awareness, will, spirit,
  intelligence, charisma, stamina) tragen laut `stand-aller-disziplinen.md` (Zeilen 574-579) 0–0,7 %
  mechanisch bei, gegen 3–8 Pp Matrixgewicht — kein Ein-Zeilen-Fix, braucht laut derselben Quelle
  genau die P2–P4-Rezeptrunde (Spielplan/Box, O-Line, Special Teams), die dieses Papier bewusst nicht
  baut. Aktuellster bekannter Messwert (02.10., n=48, zwei Saatströme): 51,7 / 57,8 Pp, Mittel 57,05
  — nicht die oft zitierte, inzwischen veraltete 47,3 (Hinweis in derselben Quelle, Zeile 173-177).

### 3.5 Chris' „Goalkicks" — welche Regel er meint, und warum er sie vielleicht übersehen hat

Chris' eigener Satz legt die Zuordnung nahe: „dass es diese goalkicks gibt". Gemeint sind mit
ziemlicher Sicherheit **Field Goal und Punt** (Abschnitt 2.2/2.3) — beides existiert im Motor bereits
(3.1), real kalibriert. Zwei naheliegende Gründe, warum er sie trotzdem als fehlend wahrgenommen
haben könnte:

1. **Kein eigenes Momentum.** Field Goal und Punt laufen durch dieselbe generische
   Formation-Snap-Zug-Choreografie wie jeder Laufzug oder Pass (`stepSnapPhase`, `:10752`) — keine
   eigene Kamera-Einstellung, kein „jetzt kommt ein Spezialist"-Signal, das sie von einem normalen
   Spielzug optisch abhebt. Wer nicht weiß, wonach er sucht, sieht einen Bogenwurf, der auch ein
   langer Pass sein könnte.
2. **Spielhäufigkeit.** Bei `fgReichweite:38` und `toGo<=1&&spot<85` als „Go"-Schwelle (`:10063-64`)
   kommt es je nach Spielverlauf zu wenigen Field-Goal-/Punt-Versuchen pro Spiel — in einem kurzen
   Testlauf in der Battle-Arena kann es passieren, dass gar keiner fällt.

Das ist ein Sichtbarkeits- und Inszenierungsproblem (Klasse A — s. Abschnitt 6), kein fehlendes
Regelverständnis des Motors.

---

## 4. Die Mechanikfrage: Kickoff-Return als Zustandsmaschine (P4.4) — nicht in dieser Runde

Der einzige Baustein aus Abschnitt 3, der tatsächlich eine neue Mechanik statt eines
Sichtbarkeits-Fixes ist, ist der Kickoff samt Return. Das Opus-Konzeptreview vom 26.09.
(`football-opus-konzeptreview-26-09.md`, nur auf Branch `football-konzeptreview-26-09`, **nicht**
gemergt) hat dafür bereits einen Vorschlag P4 „Special Teams als Momente" skizziert, mit genau dieser
Reihenfolge-Empfehlung:

1. Punter über `fkLos(off,"AUSDAUER")` statt Konstante — gibt AUSDAUER (stamina 67/will 33) seinen
   **ersten** mechanischen Kanal überhaupt.
2. Punt-Touchback/Fair-Catch-Logik (behebt die „immer an die eigene 1"-Lücke aus 3.4).
3. Kicker-Sub-Skill für Field Goal/XP (Abweichung von der bisherigen „kein Kicker-Slot"-Entscheidung
   — explizit eine neue Design-Frage, s. Abschnitt 7).
4. **Kickoff-Return** mit einem Anteil nach der realen Dynamic-Kickoff-Quote (~1/3 zurückgetragen,
   sonst Touchback — s. Abschnitt 2.1), Returner über LAUFTEMPO/LAUFKRAFT gezogen.
5. Onside Kick als Karte der zurückliegenden Mannschaft (selten, ~10 % Erfolg vorgeschlagen).

Eigene Risikoeinschätzung aus demselben Review: „rho-Risiko: gering bis mittel. Punter und Kicker
sind wenige Ereignisse je Spiel. Ihr Kredit muss klein bleiben, sonst entsteht Rauschen." Das deckt
sich mit der CLAUDE.md-Lehre „mehr Ereignisse helfen fast nie" — ein Kickoff-Return ist pro Spiel ein
seltenes Ereignis (maximal eins je Score plus zwei Halbzeit-Kickoffs), trägt also wenig zur
Verlässlichkeit bei und muss stattdessen über die Validität gerechtfertigt werden (neue, echte Kanäle
für LAUFTEMPO/AUSDAUER, die heute 0 % bzw. nahe 0 % mechanisches Gewicht tragen).

**Dieses Papier baut nichts davon.** Es hält die Reihenfolge (Punter vor Kicker vor Return vor Onside)
fest, weil sie aus Risikoabwägung begründet ist, nicht aus Beliebigkeit — und weil P1 (der
naheliegendste, kleinste Baustein) bereits einmal an der Pp-Prüfung gescheitert ist (Abschnitt 3.4),
ist eine erneute, vollständige Messung (rho kaderfest + Pp, zwei Saatströme) vor jedem einzelnen
Schritt Pflicht, nicht nur am Ende der ganzen Reihe.

---

## 5. Formatfrage E7: NFL im Kleinformat oder Arena Football?

Aus dem Master-Konzept (Abschnitt 9, E7): „Football: NFL-Modell bleibt (Fable F4)? — Ja, NFL.
Punts/Field Goals existieren schon; sie müssen sichtbar werden." Der Sichtbarkeits-Audit in
Abschnitt 3 bestätigt die Prämisse dieser Empfehlung eins zu eins: Field Goal und Punt sind
**bereits vorhanden und gegen echte NFL-Quoten kalibriert** (3.1) — ein Wechsel zur Arena Football
League (acht gegen acht, 50 Yards, **kein Punt**, Rebound-Netze statt Kickoff-Returns,
`fable-ideen-feldspiel-30-09.md` Abschnitt F4) würde genau diese bereits geleistete Kalibrierarbeit
verwerfen und müsste den kompletten NFL-Korridor (Completion-Quote, Sack-Quote, Punts je Team) neu
gegen AFL-Werte fitten — vier Kalibrierrunden (04.09.–10.09., in `football-rezept-kalibrierung.md`,
`football-review-bugfixes.md`, `opus-plan-football-gameplay-09-10.md` dokumentiert) wären hinfällig.

**Empfehlung dieses Papiers, unverändert: beim NFL-Modell bleiben.** Sechs gegen sechs bleibt dabei
ein reines Chassis-Merkmal (begrenzt durch die Kadergröße je Disziplin), keine Sportart-Entscheidung
— echte Football-Teams haben elf Spieler, unser Motor sechs, trotzdem NFL-Regeln.

**Aber:** Chris' eigener Satz „die goalkicks … die kenne ich die regeln nicht" ist ein neues Signal,
das die Frage nicht ganz erledigt sein lässt. Er kennt die NFL-Regeln an dieser Stelle selbst nicht
genau — es ist nicht ausgeschlossen, dass ihm eine einfachere Variante (etwa: kein Punt, dafür jeder
vierte Versuch ein Go, wie es die AFL macht) lieber wäre als die reale NFL-Komplexität, sobald er sie
einmal in einfachen Worten vor sich hat (Abschnitt 2 dieses Papiers). Deshalb bleibt die Frage in
Abschnitt 7 trotz der Empfehlung ausdrücklich offen, statt sie als erledigt zu behandeln.

---

## 6. Was in einer künftigen Runde Bild bleibt und was Mechanik würde

Eine Trennung nach der Abbruchregel aus dem Master-Konzept („nur das Bild bekommt die Änderung … nie
die Entscheidung"), vorbereitend für eine spätere Baurunde — nichts davon ist in diesem Papier gebaut.

**Reine Anzeige, kein neues `rr()`, rho/Pp bit-identisch erwartbar (Klasse A):**
- Die Pass-/Lauf-Animation am Formationsplatz des jeweils gezeichneten Spielers statt an `s.losX`
  starten lassen — ein geometrischer Fix, keine neue Wahrscheinlichkeit.
- Field Goal/Punt ein eigenes, optisch abgesetztes Momentum geben (Kamerafokus, eigene Ansage „Field
  Goal-Versuch!" VOR dem Ausgang, nicht nur danach) — macht sichtbar, was laut 3.1/3.5 längst
  simuliert wird.
- 3. Versuch als Wendepunkt markieren (Feed-Text „3. Versuch konvertiert!", s. 3.2) — der Motor weiß
  das bereits, zeigt es nur nicht.
- EPA irgendwo lesbar machen (z. B. als stille Spieler-Statistik, kein neuer Wertungskanal) —
  existiert bereits als Zahl (3.2).

**Echte Mechanik, braucht Chris' Ja + volle Messung (Klasse B/C, s. Abschnitt 4):**
- Formationsassignment an die tatsächlich gewürfelten Passer/Rusher koppeln, statt an die
  Team-Reihenfolge (das wäre der eigentliche Kern von „der QB bekommt den Ball" — eine Verdrahtung,
  keine reine Optik, weil es festlegt, WER an welcher Stelle steht und ob sich das auf die Lotterie
  auswirken soll).
- Kickoff-Return-Zustandsmaschine (Abschnitt 4).
- Skill-basierter Punt/Kicker, Returns nach Turnover, Safety, Two-Point, Overtime, Halbzeit-Kickoff.
- Alles, was P2/P3 des Opus-Plans berührt (Spielplan/Box-Reads, O-Line als eigene Entität) — diese
  würden auch Abschnitt 3.3 (Pass-Schutz ohne Linie) direkt angehen, sind aber mittelgroß bis groß
  und laut Opus-Plan-Risikoabschätzung (`opus-plan-football-gameplay-09-10.md` Abschnitt 6) am
  ehesten geeignet, den Korridor ein zweites Mal zu verschieben — eigene Runde, eigene Messung.

---

## 7. Offene Fragen an Chris

1. **Soll Football einen eigenen Kickoff-Return bekommen (P4.4), auch wenn er pro Spiel nur 1–3 Mal
   vorkommt** und laut Risikoeinschätzung wenig zur Verlässlichkeit, aber (hoffentlich) etwas zur
   Validität beiträgt? Oder reicht erst einmal eine sichtbar gemachte, aber weiterhin konstante
   Touchback-Regel (reine Optik, kein neuer Wurf)?
2. **Soll es einen eigenen Kicker-/Punter-Slot geben**, oder bleibt die bisherige, bewusste
   Entscheidung „kein Kicker-Slot bei sechs Feldspielern" (Football-Plan D) stehen und Punter/Kicker
   werden weiter aus dem bestehenden Kader gezogen (z. B. über AUSDAUER/eine neue Kombination)?
3. **NFL oder doch etwas Einfacheres?** Die Empfehlung in Abschnitt 5 ist NFL — aber da Chris selbst
   sagt, er kenne die Goalkick-Regeln nicht: Soll die reale NFL-Komplexität (Punt als eigener,
   seltener Entschluss, Field Goal ab ~38 Yards Spielstand) so bleiben, oder wäre eine vereinfachte
   Variante (z. B. „jeder 4. Versuch ist automatisch ein Go, kein Punt" nach Arena-Football-Vorbild)
   für ihn als Zuschauer leichter zu lesen? Das würde die Empfehlung aus Abschnitt 5 direkt umkehren
   und müsste den ganzen Korridor neu kalibrieren — deshalb wichtig, das jetzt zu klären, bevor eine
   Baurunde beginnt.
4. **Reicht für diese Runde der Klasse-A-Teil aus Abschnitt 6** (Snap-Animation an den richtigen
   Formationsplatz, Field-Goal-/Punt-Momentum, 3.-Versuch-Hervorhebung) als erster, risikoarmer
   Schritt, bevor die Kickoff-Return-Mechanik überhaupt zur Debatte steht? Das wäre der Weg, der am
   wenigsten riskiert, die bestehende Pp-Verletzung (Abschnitt 3.4) weiter zu verschlechtern, so wie
   es dem P1-Versuch im Oktober passiert ist.
5. **Soll die Formationszuweisung an die tatsächlich gewürfelte Rolle gekoppelt werden** (der
   Spieler am QB-Platz ist dann IMMER der, der auch wirft), obwohl das laut früherem Test mit festem
   Depth Chart schlechter abschnitt (rho 0,167/0,280 gegen 0,277/0,413, Kommentar `:10068-10079`
   zum alten Versuch mit statischer statt dynamischer Rollenwahl) — oder soll die Optik (wer wo
   steht) von der Mechanik (wer tatsächlich wirft) bewusst getrennt bleiben, mit einer rein visuellen
   Lösung (z. B. der gewürfelte Passer bewegt sich kurz zur QB-Position, bevor er wirft)?

---

## Quellen

Internes Repo (alle Pfade relativ zum Repo-Root):

- `docs/design/chris-feedback-breite-runde-13-10.md` — Punkt 23, Chris' Original-Wunsch.
- `docs/design/fable-konzept-chris-feedback-13-10.md` — Abschnitt 1 (Zeile 139, Punkt 23),
  Abschnitt 5.5 (K5), Abschnitt 9 (E7).
- `docs/design/fable-ideen-feldspiel-30-09.md` — Abschnitt 4 (F1–F4), insbesondere F4 (NFL vs. Arena
  Football).
- `docs/pm-briefings/opus-plan-football-gameplay-09-10.md` — Ist-Zustand des Motors (Stand c56fffd7),
  Risikoabschätzung P1–P6, Kollisionsrisiko-Nachweis für `bauFeldspiel()`.
- `football-konzeptreview-26-09` (Branch, nicht gemergt) → `docs/design/football-opus-konzeptreview-
  26-09.md` — vollständige Bestandsaufnahme, Befunde F1–F10, Vorschläge P1–P6 (hier zitiert als
  „Opus-Konzeptreview").
- `docs/design/football-gewichtheben-opus-review.md` — unabhängige Nachmessung, Field-Goal-/
  Formations-Befunde.
- `docs/design/football-rezept-sondierung-awareness-ausdauer-spirit-02-10.md` — aktuellster Pp-Stand,
  gescheiterter P1-Versuch (Pp 47,3→71,1).
- `docs/design/stand-aller-disziplinen.md` — rho-/Pp-Tabellen, Football-Zeilen 536-579, 1451.
- `public/mockups/battle-mode.engine.js`, `origin/main` `5da90654` — alle Zeilenangaben in
  Abschnitt 3.

Recherche (abgerufen 14.10.2026):

- NFL Football Operations, „Dynamic Kickoff Rule Explainer": https://operations.nfl.com/updates/football-ops/new-nfl-kickoff-rule/
- CBS Sports, „NFL's new kickoff: What is it? Why did it change? What are the rules for 2024?": https://www.cbssports.com/nfl/news/nfls-new-kickoff-what-is-it-why-did-it-change-what-are-the-rules-for-2024-everything-you-need-to-know/amp
- Deseret News, „Understanding new NFL kickoff rules, 2025 season" (Touchback an die 35): https://www.deseret.com/sports/2025/08/08/understanding-new-nfl-kickoff-rules-2025-season/
- Wikipedia, „Touchback": https://en.wikipedia.org/wiki/Touchback
- Wikipedia, „Punt (gridiron football)": https://en.wikipedia.org/wiki/Punt_(gridiron_football)
- Dummies.com, „The Punt Rules of a Football Game": https://www.dummies.com/article/the-punt-rules-of-a-football-game-204328
- Wikipedia, „Center (gridiron football)": https://en.wikipedia.org/wiki/Center_(gridiron_football)
- Wikipedia, „Shotgun formation": https://en.wikipedia.org/wiki/Shotgun_formation
- Fox Baltimore / 6abc, „NFL offenses boost under-center snaps, reversing the shotgun trend": https://foxbaltimore.com/sports/sports-unlimited/nfl-offenses-boost-under-center-snaps-early-this-season-reversing-shotgun-trend
- Sportskeeda, „Can the defense score on an extra point? NFL rules explained": https://www.sportskeeda.com/nfl/can-defense-score-extra-point-nfl-rules-explained
- ESPN, „How NFL rule changes this season are changing football strategy" (PAT-Regel 2015): https://qz.com/516768/how-nfl-rule-changes-this-season-are-changing-football-strategy
- Fox Sports, „Why the NFL's two-point conversion rate hit a 15-year low": https://www.foxsports.com/stories/nfl/why-nfls-two-point-conversion-rate-15-year-low
- ESPN, „Pass blocking matters more than pass rushing, and we can prove it": https://www.espn.co.uk/nfl/story/_/id/26888038/pass-blocking-matters-more-pass-rushing-prove-it
- NFL Football Operations Glossar, „Offensive Tackle": https://operations.nfl.com/learn-the-game/nfl-basics/terms-glossary/glossary-terms-list/offensive-tackle
- Throw Deep Publishing, „The Holder Position in Football": https://throwdeeppublishing.com/blogs/football-glossary/what-is-a-holder-in-football
- Long Snapper, „Making the Chip Shot (Part II – The Snapper)": https://longsnapper.com/?p=90

Zusätzlich bereits im Motor zitiert (Kommentar `engine.js:10281-10286`, dort als frühere
WebSearch-Runde dokumentiert): NFL-2024-Field-Goal-Quoten nach Distanzstufe (40–49 Yards 76,9 %,
50+ Yards 71,7 %).
