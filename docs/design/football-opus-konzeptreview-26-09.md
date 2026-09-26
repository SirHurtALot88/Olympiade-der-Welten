# Football — Konzeptreview: Gameplay und Taktik (Opus, 26.09.)

Chris will für jede Disziplin „das volle Programm“: erst das Gameplay- und Taktikkonzept prüfen,
dann Zahlen. Dieses Dokument fragt für American Football, ob die Mechanik echte Football-Taktik
abbildet. Ob sie die Rangtreue-Schranke hält, ist hier nicht die Frage, denn das tut sie seit der
κ-Rasterung vom 21.09. (rho 0,818 je Spiel). Gefragt wird, ob sie **Football** ist.

Das Dokument ist reines Konzept. Am Motor wurde nichts geändert. `engine.js` meint
`public/mockups/battle-mode.engine.js`, Stand `main` `254a56c5` (26.09.); Zeilennummern
beziehen sich auf diesen Stand. Die einzige eigene Messung (Abschnitt 0.4) lief über
`window.__arena.feldspielProbe("football",{n:200,jeSeite:6})` auf dem unveränderten Mockup, also
auf dem Standard-Testkader und nicht kaderfest. Sie beschreibt den Spielverlauf, keine Rangtreue.

Vorgänger, alle gelesen:

- `football-rollout-plan.md` (Fable, Migrationsplan und zengm-Formeln)
- `football-gewichtheben-opus-review.md` (Formationen, Down-Verdrahtung)
- `football-matrix-entscheidung.md`
- `football-zufriedenstellend.md`
- `football-balance-runde-nach-e3-15-09.md`
- `football-prd-drift-befund-21-09.md`
- `docs/pm-briefings/opus-plan-football-gameplay-09-10.md` (Abschnitt 6: „ergibt Sinn und läuft
  smooth“)
- `docs/pm-briefings/fable-entscheidung-e1-e2-e3-basketball-hockey-football-10-09.md` (E3)

Zum Vergleich der Form dienten `i-spy-opus-konzeptreview-26-09.md` vom selben Tag und der
Hockey-T1-Commit `254a56c5`.

---

## Kurzfassung

- **Die Hülle ist echtes Football, das Innere eines Spielzugs nicht.** Anders als Hockey, das sich
  als Basketball-Gerüst herausstellte, hat Football eine eigene Zustandsmaschine. Es gibt Downs,
  Distanz, Line of Scrimmage, Serien, Feldposition, Punt und Field Goal, Formationen je Down und
  eine Spielzugwahl, die auf Down und Distanz reagiert. **Innerhalb eines Snaps** passiert aber
  nur Folgendes: Zwei Personen werden per Los gezogen (Passer gegen Pass-Rusher oder Läufer gegen
  Run-Stopper), und zwei bis vier Würfel entscheiden. Die übrigen acht bis zehn Figuren bewegen
  sich laut Code ausdrücklich „rein optisch“ (`fkEngageZiel`, `engine.js:9188-9221`). Football
  lebt aber gerade von elf gegen elf: Linie gegen Front, Receiver gegen Deckung, Spielzug gegen
  Verteidigung. Dieses Zusammenspiel gibt es mechanisch nicht.
- **Down-and-Distance-Logik gibt es, und sie ist die stärkste Seite.** `waehlePlayCall`
  (`:8859`), `waehleFootballTier` (`:9023`) und die Formationswahl (`:8814/:8820`) lesen seit dem
  Opus-Review Down und Distanz, mit belegten NFL-Quoten (3rd & long 83 % Pass, 3rd & short
  laufbetont). **Sie ist aber eine Würfeltabelle, keine Entscheidung.** Beide Teams würfeln aus
  derselben Tabelle, unabhängig von Kader, Spielstand, Uhr und Gegner.
- **Die Formationen sind Kulisse.** `formOff`/`formDef` werden gewählt und gezeichnet. Weder
  `resolveLauf` noch `resolvePass` lesen sie. Ein Lauf gegen Nickel (leichte Box) bringt exakt so
  viel wie ein Lauf gegen die 4-3-Basis. Das zentrale Schere-Stein-Papier des Footballs (Spielzug
  gegen Aufstellung) fehlt vollständig.
- **Uhr und Spielstand existieren für die Taktik nicht.** Die Uhr läuft pro Snap immer gleich,
  egal ob Lauf, unvollständiger Pass oder Touchdown. Es gibt keinen Two-Minute-Drill, kein
  Auslaufenlassen der Uhr und keine Entscheidung für den vierten Versuch nach Spielstand. Die
  Halbzeit beendet keinen Drive. Das Spielende schneidet mitten in einen Spielzug. Ein
  Unentschieden bleibt stehen, es gibt keine Overtime. Das wiegt schwer, denn **41,5 % der Spiele
  enden mit höchstens acht Punkten Abstand** (One-Score-Game, eigene Probe 0.4). Genau dort
  entscheidet in echtem Football das Situationsspiel.
- **Special Teams sind Konstanten, keine Momente.**
  - Field Goal: nur die Distanz zählt, kein Spielerattribut.
  - Punt: immer 40 Yards netto.
  - Kickoff: immer Touchback an die eigene 25.
  - Extra-Punkt: 95 %.
  - Es gibt keine Returns, keine Two-Point-Conversion, keinen Punt-Touchback und keine Safety.
  - Ein Punt von der gegnerischen 41 legt den Gegner **immer** an seine eigene 1-Yard-Linie.
- **Positionen sind Lose, keine Rollen.** Wer wirft, läuft, fängt oder sackt, wird je Snap neu
  gelost (`fkLos`, κ = 3,4). Die Sechs-Slot-Rollen der Aufstellung haben keine
  Spielzugfunktion, sondern wirken nur als Attributaufschlag: „Line Power: gewinnt Kontakt“,
  „Route Burst: schafft Separation“, „Field Read: liest Plays“. Die Texte versprechen damit
  Funktionen, die der Motor nicht kennt. Dazu kommt:
  - Der Quarterback schützt sich selbst, denn `pSack` liest `passer.PASSSCHUTZ`.
  - Eine Offensive Line existiert mechanisch nicht.
- **„Mehrere Wege zum Erfolg“: heute genau einer.** Beide Teams spielen denselben
  Lauf-/Pass-Mix, gleich welcher Kader. Laufen und Passen unterscheiden sich im Risikoprofil nur
  schwach und im Uhrwert gar nicht. Big Plays sind strukturell unmöglich: Der längste mögliche
  Spielzug ist etwa 23 Yards lang, ein Touchdown aus 40 Yards kann nicht fallen. Ein laufstarkes
  und ein passstarkes Team gewinnen deshalb nicht auf zwei verschiedene Arten. Sie gewinnen beide
  über denselben Würfel mit anderen Summanden.
- **Die Pp-Pflichtprüfung ist offen, und das hängt direkt mit der fehlenden Taktik zusammen.** Laut
  Code-Kommentar bei `FK_LOS_KAPPA` (`:8942-8948`) liegt Football bei **58,8 Pp** Abweichung,
  erlaubt sind 25. awareness, stamina, will und spirit tragen mechanisch 0 %. Das sind genau die
  Attribute, die ein Taktikmodell natürlich bindet:
  - Awareness: Reads und Audibles.
  - Stamina und will: Tempo, Punter, Endphase.

  Taktik bauen und die Pp-Lücke schließen ist hier weitgehend **dieselbe Arbeit**.

**Priorisierte Vorschläge** (Abschnitt 5):

| Nr. | Titel | Inhalt |
|---|---|---|
| **P1** | „Uhr und Spielstand“ | Situationsspiel: Two-Minute-Drill, Uhr auslaufen lassen, vierter Versuch und 2-Punkte nach Spielstand, Halbzeit beendet den Drive. Nach dem Hockey-T1-Muster; klein, isoliert, rho-neutral erwartet. |
| **P2** | „Zwei Wege: Spielplan, Box und Play-Action“ | Formationen werden Mechanik, Lauf und Pass werden zwei valide Strategien, awareness bekommt einen Kanal. Kern des Reviews, mittelgroß. |
| **P3** | „Die Linie arbeitet“ | Die O-Line schützt statt des Quarterbacks, Pass-Rush und Deckung werden getrennt, die Figur auf der QB-Position ist auch der Werfer. |
| **P4** | „Special Teams als Momente“ | Kicker, Punter und Returner an Attribute gebunden, Punt-Touchback, Onside Kick in der Endphase. |
| **P5** | „Big Plays“ | Ein langer Schwanz für Lauf und Pass, getragen von speed. Nur nach Messung, weil er die Verlässlichkeit gefährdet. |
| **P6** | Regelrahmen | Safety, Overtime, Kickoff zur zweiten Halbzeit. |

---

## 0. Ist-Zustand, nachgelesen

### 0.1 Was ein Snap heute tut

| Stufe | Funktion | Liest | Liest NICHT |
|---|---|---|---|
| Serie | `beginneFootballSerie` `:9493` | Spot aus `fkNaechsterSpot` oder `startSpot:75` | Kickoff, Return |
| Spielzug | `waehlePlayCall` `:8859` | `down`, `toGo`, ein `rr()` | Spielstand, Uhr, Kader, Gegner-Tendenz |
| 4. Versuch | `waehleVierterVersuch` `:8883` | `spot`, `toGo` | Spielstand, Uhr (s. auch Opus-Plan 6.3 Punkt 2, seit 10.09. offen) |
| Formation | `waehleFormationOffense/Defense` `:8814/:8820` | `down`, `toGo` | — und wird selbst von niemandem gelesen außer der Zeichnung |
| Aufstellung | `starteSnap` `:9426` | Teamreihenfolge `FSTEAM[i]` | wer gleich wirft oder läuft |
| Auflösung Lauf | `resolveLauf` `:8975` | `fkLos(LAUFKRAFT)` gegen `fkLos(ABWEHR_LAUF)`, Fumble-Wurf, Yards = 4,0 + 0,055·Δ ± 4,5 (gleichverteilt, Mittel gekappt auf −3…11) | Blocker, Formation, Box |
| Auflösung Pass | `resolvePass` `:9040` | Passer `fkLos(PASSGENAUIGKEIT)`, Rusher `fkLos(ABWEHR_PASS)`, Sack über `rusher.ABWEHR_PASS − passer.PASSSCHUTZ`, Tiefe, INT, Completion über `kurve`, Receiver `fkLos(TEAMGEIST)` | O-Line, Deckungsspieler (der Rusher **ist** der Deckungsspieler), Formation |
| Field Goal | `resolveFieldgoal` `:9109` | Distanz (Stufen 97/93/76,9/71,7 %) | Kicker |
| Punt | `resolvePunt` `:9118` | nichts — `netto = 40` | Punter, Returner, Touchback |
| Buchung | `footballDownWeiter` `:9281`, `vollziehFootballErgebnis` `:9307` | Yards, TD, 1st Down, Turnover on Downs, XP 95 % | Safety, 2-Punkte, Returns nach INT/Fumble |
| Uhr | `stepSnapPhase` `:9466` + `fsT+=dt` | Animationsdauer: 0,9 s Formation + 0,8–1,6 s Zug + 0,6 s Nachlauf | Ausgang des Zugs (Lauf, unvollständig, Seitenaus) |
| Periode | `naechsterAngriff` `:9717` | Viertelgrenze nur bei Ballwechsel | Halbzeit beendet den Drive nicht |
| Spielende | `:11949` | `fsT >= 280 s` → sofort Schluss | letzter Spielzug, Overtime |

Die Vorab-Felder `spielzuege.screen/deepball` (`:6371-6386`) sind laut eigenem Kommentar tot. Der
„Screen“ im Live-Motor ist ein normaler Pass der Tiefe `dunk`. `live.schussuhr:6` (`:6118`) wird
von keinem Football-Code gelesen.

### 0.2 Wer den Ball anfasst

Jeder Snap zieht seine Akteure neu über `fkLos` (`:8950`, κ = 3,4). Bei realistischen Werten
bedeutet das etwa 94:6 für den Besseren (Kommentar `:8919`). Das ist in der Praxis ein **implizites
Depth Chart**: Fast immer wirft der beste Passer, fast immer läuft der beste Läufer. Aber:

- **Das Bild zeigt es nicht.** Die Formationsplätze vergibt `starteSnap` nach Teamindex. Der
  gezogene Passer kann als Wide Receiver am Rand stehen, während der Ball aus der Mitte fliegt
  (`animiereFootballZug` startet bei `losX`, der Passer bekommt kein eigenes Ziel).
- **Die Rollenmischung ist absichtlich.** Der Versuch mit festem Depth Chart war früher schlechter
  (Kommentar `:8890-8901`: rho 0,167/0,280 gegen 0,277/0,413). Gemessen wurde das aber mit der
  flachen Lotterie und dem alten Rezept, also nicht auf dem heutigen Stand.
- **Die Linie fehlt mechanisch.** Beim Sack verteidigt der Passer sich mit seinem eigenen
  PASSSCHUTZ. Beim Lauf gibt es keinen Blocker-Term.
- **Die Defense hat einen Mann je Snap.** Derselbe gezogene `rusher` entscheidet Sack, Deckung
  (als `verteidiger`) und Interception.

### 0.3 Was die Aufstellung (Slots) heute bedeutet

`lib/lineups/matchday-slot-roles.ts:241-253` definiert sechs Rollen: Line Power, Route Burst,
Field Read, Ball Hawk, Red Zone und Locker Leader. Mechanisch wirken sie ausschließlich als
Attributaufschlag, seit 16.09. sogar immer „breit“ über alle Eignungsattribute
(`betroffeneAttribute`, `engine.js:5605`). Kein Slot entscheidet, wer wirft, wer blockt, wer in
der Red Zone den Ball bekommt oder wer Plays liest. Der Manager stellt also sechs Rollen auf, die
im Spielzug nicht vorkommen.

### 0.4 Messstand

| Größe | Wert | Quelle |
|---|---:|---|
| rho je Spiel (kaderfest) | 0,818 | Kommentar `:8928-8941` (κ-Raster 21.09.) |
| Pp-Abweichung zur Eignung | **58,8** (Ziel ≤ 25) | Kommentar `:8942-8948`, `messe-arena-einfluss.mjs football 48` |
| Attribute mit 0 % mechanischem Anteil | awareness, stamina, will, spirit (+ charisma/intelligence, die in der Override-Eignung 0 wiegen) | ebenda |
| Punkte je Team | 15,6 (NFL 22,9) | eigene Probe, 200 Spiele, Testkader |
| Läufe / Pässe / Sacks je Team | 23,8 / 25,5 / 2,0 | ebenda |
| Punts je Team | 2,8 (NFL ~4) | ebenda |
| **Unentschieden** | **4,5 %** (9 von 200) | ebenda |
| **One-Score-Games (1–8 Punkte)** | **41,5 %** | ebenda |
| Median der Punktdifferenz | 10 | ebenda |

Die Zahlen der letzten fünf Zeilen stammen aus einer einzigen Probe auf dem Standardkader. Sie
sollen nur zeigen, **wie oft ein Spiel in eine Situation kommt, in der Situationstaktik zählen
würde**, nämlich in fast jedem zweiten.

---

## 1. Bestandsaufnahme: Wie viel Football-Taktik steckt drin?

### 1.1 Die taktischen Dimensionen des echten Footballs gegen den Motor

| Dimension | Echtes Football | Motor heute | Urteil |
|---|---|---|---|
| Down & Distance | stärkster Prädiktor der Spielzugwahl | verdrahtet, NFL-Quoten, aber Würfeltabelle für beide Teams gleich | **teilweise** |
| Run vs. Pass als Risiko/Ertrag | Pass: höherer Erwartungswert, mehr Varianz, Sack/INT, stoppt Uhr bei Incompletion. Lauf: stabiler, weniger Turnover, verbrennt Uhr | Pass höherer Ertrag und Sack/INT-Risiko: ja. Uhrwert: nein. Lauf-Varianz künstlich gleichverteilt | **teilweise** |
| Formation vs. Formation | Box-Zählung, Nickel gegen Lauf schwach, Basis gegen Spread schwach | gezeichnet, **nicht gelesen** | **fehlt** |
| Play-Action | ~26 % der Dropbacks, 8,1 statt 6,8 Y/A (2024) | existiert nicht | **fehlt** |
| Blitz / Coverage-Wahl | Blitzrate 2024 gestiegen, 5er-Rush effektivster Druck | existiert nicht | **fehlt** |
| Audible / Pre-Snap-Read | QB liest Box, ändert den Spielzug | existiert nicht | **fehlt** |
| Uhr | Zeit je Spielzug hängt am Ausgang; Timeouts, Spike, Seitenaus | konstante Animationszeit je Snap | **fehlt** |
| Two-Minute / Four-Minute | Tempo- und Uhrstrategie je Spielstand | existiert nicht | **fehlt** |
| 4. Versuch | Spielstand, Uhr, Feld, Distanz (4th-Down-Bot) | nur Feld und Distanz; FG immer ab spot ≤ 38, sogar 4th & Goal an der 1 | **grob** |
| 2-Punkte-Entscheidung | Chart nach Spielstand, ~40–56 % Erfolg | existiert nicht, XP 95 % pauschal | **fehlt** |
| Special Teams | Feldpositionskampf, Returner, Kicker, Punter | Konstanten | **fehlt** |
| Positionen | QB/RB/WR/OL/DL/LB/DB radikal verschieden | fünf Lose je Snap; OL/DL/LB-Arbeit nicht modelliert | **grob** |
| Big Plays | ein Explosiv-Spielzug hebt die Scoring-Quote eines Drives von ~6 % auf ~51 % | längster möglicher Zug ~23 Yards | **fehlt** |
| Turnover-Returns | Pick-Six, Fumble-Return | Ballbesitz genau am Wurf-/Fumble-Ort | **fehlt** |

### 1.2 Ist Football ein generisches Feldspiel-Gerüst mit Football-Namen?

**Nein, nicht so wie Hockey.** Hockey erbte `entscheideBallaktion`, also Basketballs
Entscheidungskette je Tick. Football hat mit `starteSnap`/`stepSnapPhase` eine eigene, strukturell
richtige Einheit: Formation, **ein** Snap, **ein** Ergebnis, dann Down-Fortschreibung. Serie,
Feldposition und Down-Grenze sind echtes Football und kein Basketball-Erbe. Das ist die Arbeit
vom 03.–10.09., und sie trägt.

**Aber innen ist ein Snap ein Zwei-Personen-Duell.** Der Vorab-Pfad, den der Live-Motor ablöste,
war laut Kommentar `:6100-6106` „48 unabhängige Zwei-Personen-Duelle ohne Downs“. Der Live-Motor
hat die Downs dazugebaut, das Duell ist geblieben. Im echten Football gibt es aber keinen Spielzug,
der von zwei Personen entschieden wird. Der Lauf gelingt, weil die Linie die Front bewegt. Der Pass
gelingt, weil die Protektion lange genug hält und der Receiver sich gegen **seinen** Verteidiger
löst. Beides entscheidet sich an der Aufstellung, die der Gegner gewählt hat. Diese Ebene
fehlt. Sie ist der Unterschied zwischen einem Football-Ergebnisgenerator und einem Football-Spiel.

Das Urteil in einem Satz: **Football hat das richtige Gerüst und ein generisches Herz.** Anders als
bei Hockey muss man nicht das Gerüst tauschen, sondern das Innere des Snaps mit Taktik füllen.

---

## 2. Was echtes Football taktisch trägt (Recherche)

Kurz gehalten. Die Zahlenbelege stehen in den Quellen am Ende; was schon in
`football-rollout-plan.md` Teil A und `football-gewichtheben-opus-review.md` B.4/B.5 steht, wird
nicht wiederholt.

1. **Down & Distance ist ein Budget.** Vier Versuche für zehn Yards. Auf 1st & 10 sind etwa
   4 Yards Erfolg (Early-Down-Success). Auf 3rd & long muss der Ball über die Marke, deshalb
   Pass-Übergewicht. Auf 3rd & short ist der Lauf die sichere Wahl. Der Motor bildet genau das
   bereits ab. Was fehlt: Ein **guter** erster Versuch soll den dritten erleichtern (2nd & 3 statt
   2nd & 10). Das ergibt sich im Motor automatisch aus der Serie, es wird nur nicht erzählt.
2. **Run vs. Pass ist kein Entweder-oder, sondern ein Ratespiel.** Passen hat fast überall den
   höheren EPA, weil nur der Pass große Gewinne produziert. Laufen hat trotzdem drei
   eigenständige Werte:
   - Die Uhr läuft weiter, das ist der Wert beim Führen.
   - Die Varianz ist geringer, das hilft auf 3rd & short.
   - Der Lauf zwingt die Verteidigung, Leute in die Box zu stellen. Das öffnet Play-Action
     (2024: 8,1 statt 6,8 Yards je Versuch).

   Ohne diese drei Werte ist Laufen nur ein schlechterer Pass.
3. **Die Aufstellung ist die Antwort auf die Aufstellung.** Die Defense zählt die Box. Sie stellt
   eine leichte Box (Nickel) gegen den Pass und eine schwere Box (Basis) gegen den Lauf und liegt
   manchmal falsch. Die Offense liest das vor dem Snap und ändert den Spielzug (Audible). Das ist
   die einzige echte Hin-und-her-Entscheidung **innerhalb** eines Spielzugs, und sie ist der Kern
   dessen, was Football-Fans als Taktik bezeichnen.
4. **Die Uhr ist eine Ressource.** Ein unvollständiger Pass und das Seitenaus stoppen die Uhr, ein
   Lauf im Feld lässt sie laufen. In den letzten zwei Minuten einer Halbzeit spielt die hintere
   Mannschaft Two-Minute (Pässe an die Seitenlinie, kein Huddle, Timeouts). Die führende
   Mannschaft spielt Four-Minute (laufen, Uhr verbrennen). Die Halbzeit beendet den Drive,
   deshalb gibt es auch vor der Pause einen Two-Minute-Drill.
5. **Der vierte Versuch ist die sichtbarste Trainerentscheidung.** Moderne Modelle
   (4th-Down-Bot, NFL Next Gen Stats) rechnen aus Spielstand, Uhr, Feld und Distanz. Teams sind
   im Schnitt zu konservativ, die aggressivsten (Lions) liegen analytisch am häufigsten richtig.
   Ein Field Goal ist nur dann richtig, wenn drei Punkte die Lage verbessern: Wer 4 hinten liegt
   und 30 Sekunden hat, braucht einen Touchdown.
6. **Special Teams sind der Feldpositionskampf.**
   - Mit dem Dynamic Kickoff (2024) wurden 32,8 % der Kicks zurückgetragen, davor 21,8 %.
     Touchback an die 30, seit 2025 an die 35.
   - Punts landen innerhalb der 20 oder gehen als Touchback an die 20.
   - Field Goals hängen am Kicker.
   - Der Onside Kick ist die letzte Karte der hinteren Mannschaft.
7. **Positionen sind radikal verschieden.** Der Quarterback entscheidet und wirft. Der Running
   Back liest die Blocks. Die Receiver lösen sich von der Deckung. Die Offensive Line gewinnt oder
   verliert jeden Snap, ohne je im Boxscore zu stehen. Die Defensive Line und die Linebacker
   halten die Box und machen Druck. Die Defensive Backs decken. Jede Position hat eine andere
   Aufgabe, nicht bloß einen anderen Wert.
8. **Big Plays entscheiden Spiele.** Laut PFF-Studie punktet ein Drive ohne einen einzigen
   explosiven Spielzug in ~6 % der Fälle, mit einem in ~51 %. 70 % der Explosivspielzüge sind
   Pässe. Ohne langen Schwanz gibt es keinen Star-Moment.

---

## 3. Was fehlt — die Befunde am Code

**F1 — Die Formationen sind Kulisse.** `formOff`/`formDef` (`starteSnap` `:9430-9431`) gehen in
`fsLive.snap` und in die Zeichnung, aber nicht in `loeseFootballZug` (`:9119`). Der
Box-Mechanismus fehlt vollständig. Die Formationswahl der Defense reagiert auf Down und Distanz,
wie es richtig ist. Weil sie nichts bewirkt, ist sie trotzdem keine Entscheidung.

**F2 — Die Spielzugwahl ist ein gemeinsamer Würfel.** `waehlePlayCall(down,toGo)` ist für beide
Teams gleich, egal ob ein Team einen 90er-Läufer und einen 40er-Passer hat oder umgekehrt. Es gibt
keine Teamidentität und keine Anpassung an den Gegner im Spiel („sie stoppen den Lauf, wir werfen
mehr“).

**F3 — Die Uhr kennt den Ausgang nicht.** `fsT` wächst mit der Animationszeit (`stepSnapPhase`
`:9466`). Ein unvollständiger Pass kostet so viel Spielzeit wie ein Lauf. Damit hat der Lauf keinen
Uhrwert, und die hintere Mannschaft kann keine Zeit sparen.

**F4 — Keine Spielstandsreaktion.** Weder `waehlePlayCall` noch `waehleVierterVersuch` lesen
`fsPunkte` oder `fsT`. Konkret heißt das:
- Wer im letzten Viertel 10 hinten liegt, puntet auf 4th & 3.
- Wer 4 hinten liegt, kickt in der letzten Minute ein Field Goal.
- Wer führt, wirft auf 1st & 10 in der letzten Minute so oft wie im ersten Viertel.

Der Opus-Plan vom 10.09. (Abschnitt 6.3 Punkt 2) hat das benannt, gebaut wurde es nicht.

**F5 — Die Halbzeit- und Spielgrenzen sind nicht footballig.**
- `naechsterAngriff` prüft die Viertelgrenze nur beim Ballwechsel (`:9719-9721`). Ein Drive läuft
  deshalb über die Halbzeit hinweg weiter, was es real nicht gibt. Damit fehlt auch der
  Two-Minute-Drill vor der Pause.
- Die zweite Halbzeit beginnt mit der Seite, die gerade dran war, statt mit einem Kickoff der
  anderen.
- Das Spielende (`:11949`) bricht hart mitten im Snap ab.
- 4,5 % Unentschieden bleiben stehen.

**F6 — Der vierte Versuch ist grob.** `waehleVierterVersuch` (`:8883`):
- Bei `spot ≤ 38` wird **immer** ein Field Goal versucht, auch bei 4th & Goal an der 1.
- „Go“ gibt es nur bei `toGo ≤ 1`. Auf 4th & 2 an der gegnerischen 40 wird gepuntet, obwohl
  jedes Analytics-Modell dort klar zum Ausspielen rät.
- Jeder Punt aus Spot 39–41 legt den Gegner an seine eigene 1 (`fkNaechsterSpot = 100 −
  max(1, spot − 40)`), weil es keinen Punt-Touchback gibt.

**F7 — Special Teams ohne Spieler.**
- FG und XP: reine Distanz bzw. 95 %. Der Punkteschütze in `logZug` ist ein symbolischer
  PASSGENAUIGKEIT-Losgewinner (`:9318`).
- Punt: konstant 40 Yards.
- Kickoff: Touchback (`startSpot:75`).
- Returns gibt es weder nach Kick, Punt, Interception noch nach Fumble.
- Two-Point-Conversion und Onside Kick fehlen.

**F8 — Die Offensive Line gibt es nicht.** `pSack` (`:9050`) rechnet `rusher.ABWEHR_PASS −
passer.PASSSCHUTZ`, der Quarterback blockt also für sich selbst. Da der Passer über
PASSGENAUIGKEIT gezogen wird, ist PASSSCHUTZ ein Beiwert des Passers ohne eigene Auswahl. Das
erklärt, warum PASSSCHUTZ in der Sondierung 0 % mechanisches Gewicht las (Kommentar `:6261`) und
damit auch awareness, das 20 % von PASSSCHUTZ trägt. `resolveLauf` hat überhaupt keinen
Blockterm.

**F9 — Die Defense hat einen Mann.** Der über ABWEHR_PASS gezogene `rusher` sackt, deckt und fängt
ab. Pass-Rush (Linie, Kraft) und Deckung (Defensive Backs, Tempo und Übersicht) sind derselbe Wurf
derselben Person. Der Slot „Ball Hawk“ („greift Chancen über Torment und Awareness“) hat keinen
eigenen Kanal.

**F10 — Keine Big Plays.** Lauf: Mittel gekappt auf 11, plus höchstens 4,5, also maximal etwa
15 Yards. Pass: `fern: [9, 20]` plus YAC von höchstens etwa 3, also maximal etwa 23 Yards. Ein
Touchdown aus mehr als 23 Yards ist unmöglich. Jeder Touchdown braucht deshalb eine Serie, und der
Star-Receiver hat nie seinen Moment. speed (Override-Gewicht 14, drittschwerstes Attribut) wirkt
nur verdünnt über Rezeptmischungen und nicht als Tempo-Vorteil im Spielzug.

**F11 — Die Slot-Texte versprechen Rollen, die der Motor nicht kennt** (0.3). Das ist kein
Motorfehler, aber ein Vertrauensproblem gegenüber dem Manager: Die Aufstellung sieht nach Taktik
aus und ist keine.

---

## 4. „Mehrere Wege zum Erfolg“: heute und möglich

**Heute gibt es einen Weg.** Das stärkste Team in power/health/torment gewinnt, gleich wie. Ein
laufstarkes und ein passstarkes Team spielen denselben Mix (F2). Der Lauf hat gegenüber dem Pass
keinen eigenständigen Wert (F3, F1). Die Defense kann nicht gegen eine Tendenz spielen (F1, F9).
Die Special Teams geben keinem Spieler eine Bühne (F7).

**Möglich wären vier Wege, die alle an Attributen der Override-Eignung hängen:**

| Weg | Wer ihn trägt | Wodurch er gewinnt | Attribute (Override-Gewicht) |
|---|---|---|---|
| **Boden** | Läufer + Linie | Yards ohne Turnover, Uhr verbrennen, Box erzwingen → Play-Action | power 22, health 18 (LAUFKRAFT, Linie) |
| **Luft** | Quarterback + Receiver | Explosivspielzüge, Tempo, Two-Minute | determination 10, dexterity 4, speed 14 |
| **Front** | Pass-Rush + Box | Sacks, Stopps auf 3rd & short, Drives beenden | torment 12, power |
| **Feld** | Kicker/Punter/Returner + Deckung | Feldposition, Punkte aus Distanz, Returns | stamina 6, will 3, speed, determination |

Primärweg und Nebenweg im Sinne von Chris' Leitlinie vom 21.09.: Ein Team ohne Elite-Passer
kann über den **Boden** gewinnen. Das geht langsamer, aber sicherer, und Play-Action gibt ihm den
Pass als Nebenweg. Ein Team ohne Läufer kann über die **Luft** gewinnen, riskanter, aber mit Big
Plays. Beide Wege sind nur dann echte Alternativen, wenn die Defense sie unterschiedlich beantwortet
(Box oder Nickel) und die Uhr den Lauf belohnt. Deshalb hängt P2 an P1.

---

## 5. Vorschläge nach Priorität

Alle Vorschläge sind Konzept. Zahlen sind als **Vorschlag** gekennzeichnet und vor jedem Bau zu
messen, und zwar mit den Pflichtwerkzeugen:

    node scripts/miss-alle-disziplinen.mjs 24 football
    node scripts/miss-football-korridor.mjs 200
    node scripts/messe-arena-einfluss.mjs football 48

Alle Vorschläge sind football-exklusiv, liegen im Block `:8720-9500` und berühren die anderen
neunzehn Disziplinen nicht. Die Matrix bleibt unangetastet (Sperre 21.09.). Rezeptänderungen
betreffen nur `FELDSPIEL_ART.football.rezept`.

### P1 — „Uhr und Spielstand“: das Situationsspiel (klein, zuerst)

**Warum zuerst.** Es ist die sichtbarste „unfootballige“ Stelle (F3–F6). Es braucht keine neue
Spielerlogik, nur Entscheidungslogik. Mit Hockey T1 (`254a56c5`: Torwart raus, Führungs-Riegel)
gibt es seit heute eine Vorlage im selben Motor, die dort rho-neutral bis leicht positiv war
(0,669 → 0,686). Und es ist die Voraussetzung dafür, dass der Lauf in P2 einen Uhrwert hat.

**Bausteine:**

1. **Spielzeit je Snap nach Ausgang statt nach Animationsdauer.** Eine Tabelle „Uhrkosten“
   (Vorschlag, in Spielsekunden der gerafften Uhr):

   | Ausgang | Uhrkosten |
   |---|---|
   | Lauf oder Completion im Feld | hoch |
   | Unvollständig, Seitenaus (neu, s. u.), Score, Turnover | niedrig |
   | Kneel, Spike | fest |

   Den Mittelwert so kalibrieren, dass die Snapzahl je Team bei ~50 bleibt. CLAUDE.md warnt,
   dass mehr Ereignisse fast nie helfen, und das Ziel ist ausdrücklich keine längere Uhr.
   Technisch wird der Uhrverbrauch vom Animationstakt entkoppelt: `fsT` bekommt je Snap eine
   Buchung statt je Tick. Das ist nur konzeptionell benannt; die Wirkung auf `fsT`-abhängige Sonden
   ist beim Bau zu prüfen.
2. **Endphase je Halbzeit** (letzte ~15 % einer Halbzeit, Vorschlag; analog
   `FELDSPIEL_ART.hockey.endphase`):
   - *Hintere oder gleichstehende Offense, Two-Minute:* Laufanteil stark runter, mehr
     kurze und mittlere Pässe mit Seitenaus-Chance (stoppt die Uhr), kürzere Formationsphase (No
     Huddle).
   - *Führende Offense, Four-Minute:* Laufanteil hoch, Uhr läuft. In der letzten Sekunde der Kneel.
   - *Führende Defense, Prevent:* Nickel tief, weniger Big Plays, mehr Raum darunter. Das wird
     erst mit P2 und P5 mechanisch wirksam.
3. **Der vierte Versuch nach Lage.** `waehleVierterVersuch(spot,toGo,down,stand,rest)` bekommt eine
   kleine Entscheidungstabelle nach dem Vorbild des 4th-Down-Bots:
   - Go-Zone je Feld und Distanz (z. B. 4th & ≤ 2 zwischen den 40ern, 4th & Goal ≤ 2).
   - Field Goal nur, wenn drei Punkte die Lage verbessern.
   - Hinten und spät heißt immer Go.
   - Konservativ oder aggressiv kann später ein Managerregler werden (offene Frage 7.2).
4. **Die 2-Punkte-Entscheidung** nach einer Standardtabelle (z. B. −2, −5, −9 nach dem TD →
   2 Punkte). Erfolgsquote über einen Spielzug von der 2: das ist ein normaler Snap mit
   `toGo = 2` an der gegnerischen 2, keine neue Formel.
5. **Halbzeit beendet den Drive.** Die Viertelgrenze Q2 und Q4 wird zur harten Grenze: Der
   laufende Snap wird noch zu Ende gespielt, dann ist Schluss. Zur zweiten Halbzeit bekommt die
   andere Seite den Ball.
6. **Erzählung.** Down und Distanz im HUD, Line of Scrimmage und First-Down-Marke im Feld, ein
   Drive-Zähler („9 Spielzüge, 62 Yards, Touchdown“). Das steht seit dem Opus-Plan 6.2 offen, ist
   rein visuell und gehört zu P1, weil das Situationsspiel ohne sichtbaren Spielstand, Down und Uhr
   nicht lesbar ist.

**Mehrwege-Beitrag:** indirekt. Der Lauf bekommt seinen Uhrwert, das Passspiel seinen
Two-Minute-Wert.

**Attributkanäle:** keine neuen. Das ist bewusst so, denn Situationsspiel ist Trainerlogik.

**rho-Risiko:** gering. Es ändert, **welche** Spielzüge in der Endphase gerufen werden, nicht wer
sie ausführt. Wie bei Hockey T1 ist ein leichter Gewinn möglich: Engere Spiele werden aggressiver
ausgespielt, das bedeutet mehr Snaps für die Stars in der Endphase. Das ist zu messen.

**Aufwand:** klein bis mittel. Die Uhr-Buchung ist der einzige strukturelle Teil.

### P2 — „Zwei Wege: Spielplan, Box und Play-Action“ (Kern, mittelgroß)

**Idee.** Aus dem Würfel wird ein Ratespiel mit Gedächtnis. Die Offense hat einen **Spielplan**,
die Defense eine **Box**. Beide lesen einander, und wer besser liest, gewinnt den Snap.

1. **Spielplan je Team: Boden, Ausgewogen oder Luft.**
   - *Standard ohne Managereingriff:* aus dem Kader abgeleitet. Liegt der erwartete Läufer
     (Spitze LAUFKRAFT) deutlich über dem erwarteten Passer (Spitze PASSGENAUIGKEIT), spielt das
     Team Boden, im umgekehrten Fall Luft, sonst Ausgewogen.
   - *Wirkung:* Der Plan verschiebt `pLauf` in `waehlePlayCall` um ±0,10–0,15 (Vorschlag). Die
     Down-und-Distanz-Anker bleiben erhalten, auch ein Boden-Team wirft auf 3rd & 12.
   - *Optionaler Managereingriff:* Der Plan wird ein Taktikschalter vor dem Spiel. Das ist die
     Football-Fassung von I-Spy P2 „Slots werden Spielpläne“, siehe offene Frage 7.1.
2. **Die Box wird Mechanik (F1).** Die Formationen, die heute schon gewählt werden, bekommen eine
   2×2-Matrix aus kleinen Modifikatoren (Vorschlag):

   |  | Lauf | Pass |
   |---|---|---|
   | **Basis (schwere Box)** | Laufmittel −1,0 Yard | Completion +, Big-Play-Chance + |
   | **Nickel (leichte Box)** | Laufmittel +1,0 Yard | Completion −, Sack-Chance leicht + |

   Die Defense wählt die Box nicht mehr nur nach Down und Distanz, sondern auch nach der
   **beobachteten Tendenz** des Gegners in diesem Spiel (Lauf-Yards je Versuch, Laufanteil). Ein
   Boden-Team, das Erfolg hat, zieht die Box auf sich.
3. **Play-Action als Belohnung des Laufs.** Hat die Offense in diesem Spiel den Lauf „etabliert“
   (Laufanteil und Erfolg über einer Schwelle), wird ein Teil der Pässe zu Play-Action: eine
   Tiefenstufe weiter und mehr Completion gegen Basis, dafür leicht mehr Sackrisiko, weil der Fake
   Zeit kostet. Das Vorbild sind 8,1 gegen 6,8 Y/A. So bekommt das Boden-Team seinen Nebenweg in
   die Luft, und dieser Nebenweg ist gerade dann stark, wenn der Primärweg funktioniert.
4. **Der Read: awareness bekommt einen Kanal.**
   - *Defense:* Die Wahrscheinlichkeit, die Box passend zum tatsächlichen Spielzug zu wählen,
     steigt mit der Übersicht des besten Lesers der Defense. Das ist der Slot „Field Read“ oder ein
     `fkLos` über einen neuen Sub-Skill LESEN aus awareness/determination.
   - *Offense:* Mit der Übersicht des Passers steigt die Chance, einen schlechten Call gegen die
     falsche Box per **Audible** zu korrigieren (Lauf gegen Basis wird zum Pass und umgekehrt).
   - Damit bekommt awareness (Override-Gewicht 8, heute 0 % mechanisch) eine football-echte
     Aufgabe, und der Slot „Field Read“ hält, was sein Text verspricht.

**Warum football-echt.** Genau dieses Hin und Her aus Tendenz, Box, Audible und Play-Action
beschreiben Trainer als das Spiel im Spiel. Heute ist davon nur die Kulisse da.

**Mehrwege-Beitrag:** hoch. Boden und Luft werden zwei strukturell verschiedene Siegwege, jeder
mit eigenem Risikoprofil, und der Gegner kann nur einen davon „zumachen“.

**Pp-Beitrag:** awareness von 0 auf einen echten Anteil. PASSSCHUTZ bekommt über P3 zusätzlich
seinen Kanal.

**rho-Risiko: mittel, und in beide Richtungen denkbar.**
- *Validität rauf:* Ein Boden-Team gibt seinem besten Läufer mehr Snaps. Ein Kaderstar bekommt
  damit mehr Volumen in seiner Stärke, und das ist genau der Kanal, den CLAUDE.md als Hebel nennt
  (Validität statt Uhr).
- *Validität runter:* Der zweitbeste Offensivspieler eines Boden-Teams, zum Beispiel ein guter
  Passer, verliert Volumen. Außerdem hat awareness laut `football-matrix-entscheidung.md` im Kader
  gegen die **alte** Matrix-Eignung mit −0,34 korreliert; gegen die Override-Eignung ist das
  ungemessen. Deshalb gehört der Read-Kanal klein dosiert und gemessen dazu, nicht groß.

**Aufwand:** mittel. Es sind drei kleine Zustände (Plan, Tendenzzähler, PA-Flag) und zwei
Modifikatoren. Ein neues Ereignis gibt es nicht.

### P3 — „Die Linie arbeitet“: Positionen sichtbar und mechanisch (mittel)

1. **Protektion durch die Linie statt durch den Quarterback (F8).** `pSack` liest statt
   `passer.PASSSCHUTZ` die Linie. Das ist der beste PASSSCHUTZ unter den Spielern, die in diesem
   Snap weder werfen noch Ziel sind, oder der Mittelwert der zwei besten. Der Lauf bekommt
   denselben Blockterm gegen die Front (ABWEHR_LAUF). Damit trägt PASSSCHUTZ erstmals etwas, und
   über seine Mischung (power 40, health 40, awareness 20) auch awareness.
2. **Pass-Rush und Deckung trennen (F9).** Zwei Verteidiger je Pass statt einem: Der **Rusher**
   (ABWEHR_PASS, Kraft und Aggression) entscheidet den Sack, der **Decker** (neuer Sub-Skill
   DECKUNG, z. B. speed/awareness/torment, Vorschlag) entscheidet Completion und Interception gegen
   den Receiver. Der Slot „Ball Hawk“ bekommt seinen Kanal. Den Blitz kann man später darauf
   aufsetzen: ein Rusher mehr bedeutet eine höhere Sackchance und einen schwächeren Decker.
3. **Das Bild folgt dem Los.** Die Akteure werden vor der Aufstellung gezogen, und `starteSnap`
   stellt den gezogenen Passer auf den QB-Platz, den Läufer auf den RB-Platz und den Receiver
   nach außen. Das ist rein visuell. Es ändert nur, wann der Zug gezogen wird. Ob sich die
   `rr()`-Reihenfolge dabei verschiebt, weil zwischen Formation und Auflösung in
   `bewegeSpielerLive` gewürfelt wird, ist beim Bau zu prüfen.
4. **Kredit für Linienarbeit.** Ein kleiner Boxscore-Posten „Block gewonnen“ bei einem Lauf von
   mindestens 4 Yards oder einem Pass ohne Sack, analog zum Solo-Tackle (0,15, `:8497-8499`).
   Ohne diesen Posten stehen Linienspieler bei null, und genau das hat die Rollenlotterie
   ursprünglich verhindern sollen (`:8890-8901`).

**Mehrwege-Beitrag:** Der Boden-Weg bekommt seine zweite Säule (Linie). Die Front-Defense wird ein
eigener Weg.

**rho-Risiko:** mittel bis hoch. Die Geschichte des Depth Charts (0,167 gegen 0,277) mahnt zur
Vorsicht. Mit κ = 3,4 und dem heutigen Rezept ist das allerdings ungemessen, der alte Befund gilt
nicht automatisch. Schritt 3 ist rho-neutral, wenn die `rr()`-Reihenfolge hält. Schritte 1, 2 und 4
gehören einzeln gemessen.

**Aufwand:** mittel.

### P4 — „Special Teams als Momente“ (klein bis mittel)

1. **Punter.** `netto = 40 + (AUSDAUER − 50)·k + Rauschen`, der Punter über `fkLos(off,"AUSDAUER")`.
   Das ist der Vorschlag aus dem Opus-Plan 6.3 Punkt 3, offen seit 10.09. AUSDAUER (stamina 67,
   will 33) bekommt damit seinen **ersten** mechanischen Kanal, und stamina und will verlassen die
   0 %.
2. **Punt-Touchback und Fair Catch.** Landet der Punt in der Endzone, kommt der Ball an die 20. Das
   behebt F6, dass jeder Punt aus Spot 39–41 den Gegner an seine eigene 1 legt. Ein Return ist
   optional, siehe Schritt 4.
3. **Kicker.** Die Field-Goal- und XP-Quote bekommt einen kleinen Attributterm über einen
   Kicker-Sub-Skill (z. B. determination/dexterity, „Kaltblütigkeit + Technik“, Vorschlag). Der
   Kicker wird per `fkLos` gezogen. Dann trägt der Field-Goal-Treffer auch einen echten Schützen,
   statt dass `logZug` einen symbolischen PASSGENAUIGKEIT-Losgewinner einsetzt (`:9318`).
4. **Returns.** Kickoff-Return mit einem Anteil nach dem Dynamic Kickoff (~1/3 zurückgetragen,
   sonst Touchback an die 30 bzw. 35), dazu Interception- und Fumble-Returns. Der Returner kommt
   über LAUFTEMPO oder LAUFKRAFT. Returns sind die natürliche Stelle für seltene Big Plays (P5).
5. **Onside Kick** als Karte der hinteren Mannschaft in der Endphase (P1). Erfolg selten, der
   Vorschlag ist ~10 %.

**Mehrwege-Beitrag:** Der Feld-Weg wird überhaupt erst möglich.

**Pp-Beitrag:** stamina, will und determination bekommen Kanäle.

**rho-Risiko:** gering bis mittel. Punter und Kicker sind wenige Ereignisse je Spiel. Ihr Kredit
muss klein bleiben, sonst entsteht Rauschen. Der Punter-Kredit muss wie der Solo-Tackle ein
Plateau-Gewicht bekommen und gemessen werden.

### P5 — „Big Plays“: der lange Schwanz (nur nach Messung)

**Idee (F10).** Zwei seltene Ausgänge kommen dazu:
- *Lauf:* Eine Durchbruch-Chance, die mit LAUFTEMPO des Läufers gegen die Front wächst und
  +10 bis +60 Yards bringt.
- *Pass:* Bei `fern` eine YAC-Verlängerung über speed des Receivers gegen den Decker (P3).

Die Returns aus P4 kommen hinzu. speed (14) bekommt damit einen direkten Kanal. Der Prevent aus P1
bekommt seine Wirkung, weil er die Durchbruchchance senkt.

**Warum nur nach Messung.** CLAUDE.md zerlegt rho in Validität × √Verlässlichkeit. Big Plays
bündeln Impact in wenigen Ereignissen, das senkt die **Verlässlichkeit**. Das ist genau die
Größe, bei der Football nach dem PRD-Befund schon am Limit sitzt (Abschnitt 4 dort: Rauschen sitzt
im Yards-Wurf). Der Vorschlag ist nur dann ein Gewinn, wenn die Durchbruchchance stark genug an
der Eignung hängt, sodass die **Validität** mehr steigt als die Verlässlichkeit fällt. Das kann
man nicht vorher wissen, man muss es messen. Eine Variante mit wenig Risiko: Den Yards-Wurf von
gleichverteilt ±4,5 auf eine schiefe Verteilung mit gleichem Mittel umstellen. Die meisten Läufe
bringen dann 1–4 Yards, wenige deutlich mehr, und die Durchbruchchance ist attributgesteuert. Die
Gesamtstreuung wächst so nur wenig, aber der lange Schwanz gehört dann den Richtigen.

**Aufwand:** klein im Code, groß in der Messung.

### P6 — Regelrahmen (klein, mitnehmen)

- **Safety.** Ein Sack oder Lauf, der hinter der eigenen Torlinie endet, gibt 2 Punkte, danach
  Free Kick. Heute klemmt `footballDownWeiter` den Spot bei 100 (`:9282`).
- **Overtime oder bewusstes Unentschieden.** 4,5 % Remis sind für ein Turnier mit Tabelle eine
  echte Frage an Chris (7.4). Eine kurze Overtime (ein Ballbesitz je Seite, dann Sudden Death)
  wäre football-echt, verlängert aber das Spiel.
- **Kickoff zur zweiten Halbzeit** an die andere Seite (siehe P1.5).
- **Letzter Spielzug.** Ein laufender Snap wird am Spielende zu Ende gespielt, erst dann ertönt die
  Sirene.

---

## 6. Machbarkeit gegen die Schranken

| Vorschlag | Erwartung rho (Validität / Verlässlichkeit) | Erwartung Pp | Korridor | Isolation |
|---|---|---|---|---|
| P1 | neutral bis leicht +, Vorbild Hockey T1 | neutral | Punkte je Team leicht +, weil mehr Go-Versuche; Punts −; 2-Punkte neu | football-exklusiv |
| P2 | Validität + (Volumen folgt der Stärke), Read-Kanal ungewiss | awareness 0 → >0 | Lauf/Pass-Mix je Team streut; Liga-Mittel muss bleiben | football-exklusiv |
| P3 | ungewiss; Schritt 3 neutral | PASSSCHUTZ/awareness 0 → >0 | Sack-Quote neu fitten | football-exklusiv |
| P4 | neutral bei kleinem Kredit | stamina/will/determination 0 → >0 | Punts, FG-%, Startfeld neu | football-exklusiv |
| P5 | Verlässlichkeit −, Validität + → nur messen | speed direkter | Y/Carry, Y/A, Punkte + | football-exklusiv |
| P6 | neutral | neutral | Remisquote → 0 bei OT | football-exklusiv |

**Reihenfolge und Messpflicht.** Jeder Schritt einzeln, jeweils mit rho (24er-Sonde, fünf
Paarungen), Korridor (200 Spiele) und Pp (48). Die Lehre aus dem PRD-Befund gilt: **Die
Korridor-Sonde gehört in jede Verifikationsliste.** Die Lehre aus Rezept C gilt ebenfalls: Neue
Sub-Skills (LESEN, DECKUNG, KICK) brauchen jeweils einen eigenen Anker an power/health/torment
**plus** ein Unterscheidungsmerkmal, sonst korrelieren sie nicht mit der Eignung (Kommentar
`:6340-6351`).

**Die ehrliche Gegenrede.** Football hat die Schranke seit fünf Tagen bestanden. Jede der hier
vorgeschlagenen Ebenen kann rho wieder unter 0,80 drücken, und Football ist noch nicht einmal
produktiv geschaltet. Man könnte also sagen: erst schalten, dann vertiefen. Dagegen stehen zwei
Punkte:
- Die Pp-Pflichtprüfung ist mit 58,8 **nicht** bestanden. Bei der Pflichtprüfung ist Football
  also noch gar nicht fertig.
- Der Weg dahin führt fast zwangsläufig über neue Kanäle für awareness, stamina, will und speed,
  also über genau die Taktikebenen aus P2 bis P5.

Wer Football jetzt produktiv schaltet, schaltet ein Spiel, das bei der zweiten Pflichtprüfung
durchfällt. Mein Rat: **P1 vor oder zusammen mit dem Produktivschalter**, weil es billig, sichtbar
und rho-arm ist. **P2 bis P4 als nächste Football-Runde** mit dem Pp-Ziel ausdrücklich als
Abnahme. **P5 zuletzt.**

---

## 7. Offene Fragen an Chris

1. **Soll der Manager den Spielplan wählen** (Boden, Ausgewogen oder Luft vor dem Spiel), oder
   leitet der Motor ihn nur aus dem Kader ab? Die erste Variante ist echte Taktik für dich, die
   zweite läuft ohne Eingriff.
2. **Soll es einen Regler „Aggressivität am 4. Versuch“ geben** (konservativ, Standard oder
   Analytics)? Dieser Regler ist klein, sichtbar und football-typisch.
3. **Sollen die sechs Slot-Rollen echte Positionen werden?** Das hieße: Line Power blockt, Route
   Burst ist bevorzugtes Ziel, Field Read liest, Ball Hawk deckt, Red Zone bekommt den Ball an der
   Goal Line und Locker Leader wird Punter oder Kicker. Oder bleiben sie Attributaufschläge? Die
   erste Variante macht die Aufstellung zur Taktik, kostet aber Rangtreue-Risiko (P3).
4. **Unentschieden oder Overtime?** Heute enden 4,5 % der Spiele remis.
5. **Soll der Kicker ein eigener Slot sein** oder weiter per Los gezogen werden? Der Rollout-Plan
   hatte „kein Kicker-Slot bei sechs Feldspielern“ festgehalten.

---

## 8. Was dieser Review bewusst nicht tut

- **Keine Strafen** (Holding, Pass Interference). Das ist echte NFL-Würze, aber für die Taktik
  Rauschen ohne Attributkanal.
- **Keine Routen- oder Blocksimulation elf gegen elf.** Die Vorschläge bleiben im Snap-Modell
  (ein Snap, ein Ergebnis) und fügen Entscheidungsebenen hinzu, keine Physik.
- **Keine längere Uhr, keine zusätzlichen Snaps.** CLAUDE.md: „Wer die Rangtreue heben will,
  arbeitet an der Validität, nicht an der Uhr.“ P1 verschiebt Uhrzeit zwischen Spielzugtypen,
  ohne die Gesamtzahl zu heben.
- **Keine Matrix-Frage.** Die Gewichtsmatrix bleibt gesperrt. Der Override
  `spiel-eignung-overrides.ts` bleibt, wie er ist.
- **Kein Code.** Es wurde auch nichts an einer Kopie gemessen außer der einen Verlaufsprobe in 0.4.

---

## Quellen

Motor und Projekt: `public/mockups/battle-mode.engine.js` (Stand `254a56c5`, Stellen im Text),
`lib/lineups/matchday-slot-roles.ts:232-253`, `lib/player-generator/spiel-eignung-overrides.ts`,
die eingangs genannten Design- und PM-Dokumente.

Recherche (abgerufen 26.09.2026):

- PFF, „Explosive plays and re-thinking offensive success“ (Scoring-Quote von Drives mit und ohne
  Explosivspielzug): https://www.pff.com/news/nfl-explosive-plays-and-re-thinking-offensive-success
- NFL Analytics, „Explosive Plays: Why Big Gains Matter“ (70 % der Explosivspielzüge sind Pässe):
  https://nflanalytic.com/explainer-explosive-plays.html
- Yahoo Sports, „How have motion and play-action revolutionized NFL offenses?“ (Play-Action 26 %,
  8,1 gegen 6,8 Y/A, 2024): https://sports.yahoo.com/article/motion-play-action-revolutionized-nfl-234354517.html
- Stick to the Model, „Expected Points Added, Explained“ (Pass-EPA über Lauf-EPA):
  https://sticktothemodel.com/encyclopedia/expected-points-added
- Berkeley Sports Analytics, „The Pass and the Pass Nots“:
  https://sportsanalytics.studentorg.berkeley.edu/articles/pass-and-passnots.html
- nfl4th / Ben Baldwin, 4th-Down-Modell (Spielstand, Uhr, Timeouts, Feld, Distanz):
  https://www.nfl4th.com/articles/4th-down-research.html und https://rbsdm.com/stats/fourth_calculator/
- Pride of Detroit, Lions und analytisch richtige Entscheidungen am 4. Versuch:
  https://www.prideofdetroit.com/2025/1/7/24338071/detroit-lions-lead-nfl-in-analytically-sound-4th-down-decisions
- Wikipedia, „Clock management“ und „Hurry-up offense“ (Uhrstopps, Two-Minute):
  https://en.wikipedia.org/wiki/Clock_management, https://en.wikipedia.org/wiki/Hurry-up_offense
- ESPN, „Inside an NFL two-minute drill“: https://www.espn.com/nfl/story/_/id/42508173/nfl-2024-two-minute-drill-game-winning-drives-offense-keys
- NFL Football Operations, „What Stats Suggest About the NFL's New Kickoff“ (Return-Rate 21,8 →
  32,8 %): https://operations.nfl.com/gameday/analytics/stats-articles/what-stats-suggest-about-the-nfl-s-new-kickoff/
- NFL.com, Dynamic Kickoff (Touchback an die 30, ab 2025 an die 35):
  https://www.nfl.com/news/2024-nfl-season-explaining-rules-for-new-dynamic-kickoff und
  https://www.nfl.com/news/nfl-owners-vote-to-make-dynamic-kickoff-permanent-adjust-ball-spot-on-touchbacks-to-35-yard-line
- FOX Sports, Two-Point-Conversion-Quote 2024 auf 15-Jahres-Tief:
  https://www.foxsports.com/stories/nfl/why-nfls-two-point-conversion-rate-15-year-low
- FTN, „2024 Blitz Rates: The Blitz is Back!“ (Druckrate 31 %, 5er-Rush effektivster):
  https://ftnfantasy.com/nfl/2024-blitz-rates-the-blitz-is-back
