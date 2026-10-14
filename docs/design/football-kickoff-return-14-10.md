# Football: Kickoff-Return gebaut (Schritt 4 von 4, 14.10.)

Baurunde für Schritt 4 — den letzten — aus `docs/design/football-kickoff-slot-plan-14-10.md`
(Abschnitt 3.1). Schritt 1 (Klasse-A visual slice, PR #1224), Schritt 2 (Kicker/Punter-Slot,
PR #1225) und Schritt 3 (QB-Slot, PR #1226) sind gemergt. Chris' Autorisierung
(`football-kickoff-regeln-konzept-14-10.md` Abschnitt 7, Q1): „ja" — eine echte
Kickoff-Rückgabemechanik soll gebaut werden.

## 1. Zustand vorher

`beginneFootballSerie()` (`battle-mode.engine.js`) setzte nach jedem Score (Touchdown,
erfolgreiches Field Goal) und beim Spielbeginn (Münzwurf) den Ballbesitz unsichtbar auf
`d.startSpot` (75, die alte 25-Yard-Touchback-Linie im veralteten Touchback-Schema — die reale
NFL-Regel liegt seit der 2025-Saison bei der 35; **das Ändern dieser Konstante selbst bleibt
bewusst außerhalb des Umfangs dieser Runde**, der Plan behandelt dies rein als "kein Kick-Flug,
kein Returner, keine Deckung"). Kein Kick-Flug, kein Returner, keine Deckung.

## 2. Rezept (Primärweg/Nebenweg-Muster, CLAUDE.md „mehrere Wege zum Erfolg")

- **Returner-Auswahl:** über LAUFKRAFT (`power:41,health:33,speed:26`, rho 0,909 zur Eignung,
  UNVERÄNDERT — derselbe Sub-Skill, den `resolveLauf()` für Laufspielzüge bereits zieht).
  Bewusst NICHT LAUFTEMPO (die rein physische, disziplinübergreifende Bewegungsformel).
- **Rückgabe-Yards:** eine Gauß-Verteilung um einen Mittelwert, der von BEIDEN Seiten abhängt —
  Primärweg Returner-LAUFKRAFT, Nebenweg kickende Mannschaft über ABWEHR_LAUF
  (`torment:55,power:30,health:15`, derselbe Sub-Skill, den `resolveLauf()` für die
  Verteidigung zieht) als Verlustchance im Mittelwert. Kein neuer Sub-Skill auf beiden Seiten.
- **Touchback-Anteil:** feste 67 % (reale Rückgabequote ~32,8 %), NICHT attributabhängig — ein
  Touchback ist eine taktische Kicker-Entscheidung, kein Returner-Ereignis; ein
  Kicker-Attributkanal dafür gehört in den Kicker/Punter-Slot (Schritt 2), nicht hierher.
- **Onside Kick:** ausdrücklich NICHT Teil dieser Runde (Plan, "aus Risikogründen" — seltenstes
  Ereignis mit dem höchsten Rauschrisiko pro Ereignis).

## 3. Zustandsmaschine: `starteKickoff()`/`stepKickoffPhase()`

`public/mockups/battle-mode.engine.js:10930-11080` (direkt vor `beginneFootballSerie()`,
Zeile 11071): `kickoffLos()` (10930), `kickoffRrGauss()` (10940), `loeseKickoffReturn()`
(10960), `starteKickoff()` (10985), `stepKickoffPhase()` (11000). Eine NEUE, football-eigene
Phase,
analog zu `starteSnap()`, mit eigenem `stufe`-Automat: `"flug"` (Kick-Flugbahn, Dauer 1,3s) →
bei Touchback direkt `"nach"`, bei Rückgabe `"return"` (Lauf-Animation, Dauer 0,9s) → `"nach"`
(0,5s Verweildauer) → `starteSnap()` der neuen Serie.

**Erreicht ausschließlich aus `beginneFootballSerie()`** (football-eigen), nicht aus dem
generischen `stepFeldspielLive()`-Dispatcher direkt: der einzige neue Zweig dort
(`else if(fsLive.phase==="kickoff")stepKickoffPhase(dt);`) steht INNERHALB des bereits
bestehenden, football-exklusiven `if(istFootball()){...}`-Blocks — Basketball/Hockey/Tennis
lesen `fsLive.phase==="kickoff"` nie.

**Auslöse-Signal:** `fkNaechsterSpot==null` beim Eintritt in `beginneFootballSerie(seite)`.
Jeder Punt/Turnover/Turnover-on-Downs/verfehltes Field Goal setzt `fkNaechsterSpot` VORHER auf
einen konkreten Feldstand (fünf Zuweisungen in `vollziehFootballErgebnis()`), ein Kickoff
(Spielbeginn, nach Touchdown, nach erfolgreichem Field Goal) dagegen nie — ein bereits
vorhandenes, zuverlässiges Signal, kein neuer Zustand nötig. Der Punt-/Turnover-Pfad bleibt
dadurch bit-identisch zum Stand vor diesem Schritt.

```js
function beginneFootballSerie(seite){
  if(fkNaechsterSpot==null){ starteKickoff(seite); return; }
  const d=FB().live.downs;
  ballUebernehmen(spielmacherLos(FSTEAM[seite]));
  const spot=Math.max(1,Math.min(99,fkNaechsterSpot));
  fkNaechsterSpot=null;
  fsLive.football={side:seite,down:1,toGo:Math.min(d.distanz,spot),max:d.max,spot,puntNetto:d.puntNetto};
  starteSnap();
}
```

## 4. Der eigentliche Befund dieser Runde: ein unabhängiger Kickoff-Saatstrom

Die erste Fassung zog Returner/Deckung/Rückgabe-Yards über die GEMEINSAME `rr()` — dieselbe
Zufallsfolge, die jeden Sack/jede Completion/jede Interception/jeden Laufzug des gesamten
restlichen Spiels speist. Kaderfest GEMESSEN (`node scripts/miss-alle-disziplinen.mjs 48
football`): das senkte rho je Spiel auf 0,783-0,791 (**durchgefallen**, unter der
0,80-Schranke) — über mehrere Varianten der Rückgabe-Formel hinweg (Gauß vs. uniform,
Streuung 6/10, Box-Score-Kredit an/aus), nie zuverlässig über 0,80.

**Isolationstest, der den Grund beweist:** mit der Touchback-Quote testweise auf 100 % gesetzt
(der Spielausgang bleibt dadurch in JEDEM Fall exakt wie vorher — nie eine echte Rückgabe,
kein einziges verändertes Boxscore-Feld) sinkt rho allein durch die EINE zusätzliche
`rr()`-Ziehung je Kickoff bereits von 0,804 auf 0,800 — der Beweis, dass der Schaden aus der
VERSCHIEBUNG der restlichen Zufallsfolge kam (dieselbe Kaskade, vor der CLAUDE.md warnt,
„Zoneneintritt-Lehre"), nicht aus der Mechanik selbst. Ein Kickoff eröffnet jede neue Serie mit
Down 1 — jede zusätzliche Ziehung dort verschiebt den gesamten restlichen Spielverlauf, anders
als z. B. eine rein optische Zusatzdauer (vgl. Hockeys FG-/Punt-Kick-Bogenhöhen-Kommentar, der
dort rho flach ließ, weil keine neue `rr()`-Ziehung involviert war).

**Lösung:** ein zweiter, komplett unabhängiger, parallel laufender Saatstrom nur für den
Kickoff (`kickoffSeed`/`kickoffRr()`, Grundprinzip wie das bereits vorhandene
„unabhängiger Mutator-Saatstrom"-Muster bei `disziplinProbe`/`o.mutatorSaat`, hier aber als
ECHTE zweite Ziehungsfolge statt eines Saat-Versatzes auf derselben Folge). Reseeded in
`bauFeldspiel(saat)` mit einem festen Versatz auf denselben Spiel-Seed
(`kickoffSeed=(normalisiereSaat(saat)+777777)>>>0`) — weiterhin voll deterministisch und
reproduzierbar je Spiel-Saat, aber unkorreliert zu `seed`/`rr()`. `kickoffLos()` dupliziert nur
die Gewichtungsformel aus `fkLos()` (`Math.pow(Math.max(1,u[rolle]-LOS_NULLPUNKT),FK_LOS_KAPPA)`,
dieselben Modul-Konstanten) auf dem neuen Strom — dasselbe Rezept, keine neue Gewichtung.
`kickoffRrGauss()` ist dieselbe Box-Muller-Transformation wie der ursprüngliche Entwurf, jetzt
unbedenklich auf dem isolierten Strom (Plan 3.1 verlangt ausdrücklich eine echte
Gauß-Verteilung für die Rückgabe-Yards — mit dem unabhängigen Strom lässt sich das jetzt ohne
rho-Kosten einhalten, statt auf eine uniforme Notlösung auszuweichen).

Diese eine Zeile in `bauFeldspiel(saat)` (`kickoffSeed=...`) ist die einzige Stelle, an der
dieser PR eine vom gesamten Feldspiel-Chassis GETEILTE Funktion berührt — rein additiv
(ein neues Statement, keine Änderung an einer bestehenden Zeile) und für Basketball/Hockey/
Tennis vollständig wirkungslos, weil `kickoffSeed`/`kickoffRr()` außerhalb der neuen,
football-eigenen Funktionen (`starteKickoff`, `stepKickoffPhase`, `loeseKickoffReturn`,
`kickoffLos`, `kickoffRrGauss`) nirgends gelesen werden. `git diff` zeigt das: jede entfernte
Zeile liegt innerhalb des Football-Blocks, jede hinzugefügte Zeile außerhalb von
Basketball/Hockey/Tennis-Codepfaden.

**Mit dem isolierten Strom GEMESSEN** (dieselbe Sonde, derselbe Kader):

| Variante | rho/Spiel (Median) | rho/Saison (Median) |
|---|---:|---:|
| Gemeinsame `rr()`, mit Box-Score-Kredit (erster Entwurf) | 0,788 | — |
| Gemeinsame `rr()`, ohne Kredit, uniforme Streuung | 0,783 | 0,874 |
| **Unabhängiger Strom, OHNE Box-Score-Kredit** | 0,805 | 0,902 |
| **Unabhängiger Strom, MIT Box-Score-Kredit (finale Fassung)** | **0,807** | **0,902** |

Der Box-Score-Kredit selbst (`laufYards` für den Returner, derselbe Kanal, den
`feldspielWert()` bereits kennt — `passYards/25 + laufYards/10 + fangYards/10`) ist auf dem
isolierten Strom nicht nur unschädlich, sondern minimal förderlich (0,805 → 0,807) — er bleibt
deshalb in der finalen Fassung erhalten, der Returner trägt seine Rückgabe-Yards sichtbar im
Boxscore, genau wie ein Laufspielzug.

## 5. Messergebnisse (final)

### 5.1 rho (CLAUDE.md-Schranke 0,80, angestrebt 0,85), n=48, Kader-Familie (live-save)

`node scripts/miss-alle-disziplinen.mjs 48 football`:

| | rho/Spiel (Median) | Spannweite | rho/Saison (Median) | Spannweite |
|---|---:|---:|---:|---:|
| vorher (Schritt 3, PR #1226) | 0,804 | 0,089 | 0,895 | 0,077 |
| nachher (dieser PR) | 0,807 | 0,090 | 0,902 | 0,077 |

**Praktisch unverändert (+0,003 je Spiel, +0,007 je Saison), beides WEIT innerhalb der
Kaderrauschen-Spannweite dieser Messung selbst — nicht von Null unterscheidbar, aber in jedem
Fall sicher über der 0,80-Schranke.** Der Plan selbst hatte genau das als Hauptrisiko benannt
(„eher ein rho-Risiko … mehr Ereignisse helfen fast nie") — mit dem unabhängigen Saatstrom hat
sich dieses Risiko nicht materialisiert, **aber nur, weil die Kaskaden-Ursache aktiv behoben
wurde** (s. Abschnitt 4), nicht von selbst.

### 5.2 Pp-Abweichung (CLAUDE.md-Schranke ≤25, `scripts/messe-arena-einfluss.mjs`), zwei
unabhängige Saatströme

| Saatstrom | vorher (Schritt 3, PR #1226) | nachher (dieser PR) |
|---|---:|---:|
| Strom 0 (versatz=0) | 64,0 Pp | 64,6 Pp |
| Strom 2 (versatz=10 000 000) | 71,3 Pp | 61,7 Pp |

**Strom 0 praktisch flach (+0,6 Pp), wie vom Plan erwartet** („barely changes it either way
since it reinforces already-measured channels"). **Strom 2 bewegt sich deutlicher als erwartet
— aber in die GÜNSTIGE Richtung** (−9,6 Pp): kein Fall, der laut Aufgabenstellung Innehalten
verlangt (das gilt nur für eine Verschlechterung über einen unerwarteten Seitenkanal). Eine
plausible Erklärung, ohne sie als bewiesen auszugeben: Strom 2 saß mit 71,3 Pp nach Schritt 3
am oberen Ende der beiden gemessenen Ströme, und LAUFKRAFT/ABWEHR_LAUF sind in BEIDEN Strömen
bereits unter den am stärksten tragenden Kanälen (power/torment/health, s. Attributtabellen
oben) — eine zusätzliche, geringfügig häufigere Ziehung genau dieser beiden Kanäle über den
Kickoff-Return kann die Pp-Abweichung in einem Strom leicht verbessern, ohne dass das
systematisch in jedem Strom passieren muss (Strom 0 zeigt das nicht). Football verletzt die
≤25-Pp-Schranke in BEIDEN Strömen weiterhin massiv (64,6/61,7 Pp, weit über dem Zielwert) — ein
vorbestehendes, separat verfolgtes Rezeptproblem (sechs der zwölf Matrix-Attribute tragen
praktisch nichts zur Mechanik bei, s. `football-kickoff-slot-plan-14-10.md` Abschnitt 2.1),
**das ist weiterhin NICHT Teil dieser Runde** und durch diesen Schritt qualitativ unverändert
(beide Zahlen lagen vor UND liegen nach diesem PR weit über der Schranke). LAUFKRAFT/
ABWEHR_LAUF sind bereits existierende, bereits gemessene Kanäle — der Kickoff-Return verstärkt
nur ihre Ziehungshäufigkeit geringfügig, ändert aber nicht, welche Attribute zählen.

## 6. HUD-Degradation (Plan-Risikopunkt, offen bis zu dieser Runde)

Geprüft: `feldspielKontextZusatz()` (`battle-mode.engine.js`, HUD-Kontextzeile) zeigte VOR
diesem PR für `fsLive.football===null` (genau der Zustand während eines Kickoffs) bereits
korrekt GAR NICHTS an statt eines veralteten/falschen Down-&-Distance-Stands — kein Bug, aber
auch keine Information für den Betrachter. **Fix:** ein neuer, vorangestellter Zweig
(`if(istFootball()&&fsLive.kickoff)return (…seite===0?"▶":"◀")+" Kickoff";`) ersetzt das
„nichts" durch ein ausdrückliches „Kickoff", im selben Muster wie die bestehenden
`.knapp`/`.torwartraus`-Anzeigen. Genau das vom Plan selbst vorgeschlagene Degradierungsmuster
(„zeigt z. B. 'Kickoff' statt '1st & 10'").

## 7. Verifikation

- `node --check public/mockups/battle-mode.engine.js`: ok
- `npx eslint public/mockups/battle-mode.engine.js`: 0 Errors, 76 Warnings — identisch zum
  Stand vor dieser Änderung (wie in PR #1224/#1225/#1226 festgestellt); keine der 76 Warnungen
  liegt in neuem Code dieses PRs
- `npx tsc --noEmit`: dieselben vorbestehenden, von dieser Änderung unabhängigen Fehler
  (Transfermarkt-/Season-Ratings-/Wishlist-Testdateien) — kein neuer Fehler, keine Datei
  dieses PRs betroffen (`battle-mode.engine.js` ist reines JS, nicht Teil der
  TS-Typprüfung)
- `npx vitest run tests/matchday-mvp-scoring-service.test.ts tests/matchday-auto-run-service.test.ts tests/standings-apply-service.test.ts`:
  21/21 bestanden (dieselbe Testklasse, die nach Schritt 3s Slot-Profil-Umbenennung einmal
  bereits eine deterministische Fixture in ein exaktes Unentschieden geschoben hatte, PR #1230)
- `npx vitest run tests/battle-mode-arena-matchday-resolve-e2e.test.ts tests/battle-mode-arena-resolve-engine.test.ts tests/battle-mode-arena-team-points.test.ts tests/liga-spielplan-saison2-battle-mode.test.ts`:
  91/91 bestanden
- `npx vitest run tests/matchday-slot-roles.test.ts`: 19/19 bestanden (unberührt, dieser PR
  fügt keinen neuen Lineup-Slot hinzu — der Returner wird wie in Plan 3.1 vorgesehen über
  `fkLos()`/`kickoffLos()` aus dem gesamten Feld gezogen, kein dedizierter Slot)

## 8. Was NICHT Teil dieser Runde ist

Onside Kick (Plan 3.1, bewusst ausgeklammert), die Touchback-Yardage-Konstante selbst
(`d.startSpot=75`, real inzwischen 35 statt 25 — out of scope laut Aufgabenstellung), ein
dedizierter Returner-Lineup-Slot (der Plan sieht keinen vor — Returner-Auswahl bleibt eine
reine `fkLos`-Lotterie über das gesamte Feld, wie bei jedem Laufspielzug), jede Reparatur der
vorbestehenden, separat verfolgten Football-Pp-Verletzung, jede Änderung an der gesperrten
Eignungsmatrix oder am Football-Override (`spiel-eignung-overrides.ts`, unangetastet).

## 9. Abschlussnotiz: alle vier Schritte von `football-kickoff-slot-plan-14-10.md` sind jetzt
gebaut

Schritt 1 (Klasse-A visual slice, PR #1224), Schritt 2 (Kicker/Punter-Slot, PR #1225), Schritt 3
(QB-Slot, PR #1226) und Schritt 4 (Kickoff-Return, dieser PR) sind damit vollständig. Jeder
Schritt wurde einzeln kaderfest gemessen (rho UND Pp, je zwei unabhängige Saatströme), wie
CLAUDE.md es für jede neue Mechanik verlangt — keine Messung wurde übersprungen oder auf das
Ende der Reihe verschoben. Die einzige unerwartete, substanzielle Erkenntnis dieser letzten
Runde war **nicht** im Rezept selbst (LAUFKRAFT/ABWEHR_LAUF trugen genau wie erwartet), sondern
in der Zufallsfolgen-Architektur: ein Kickoff ist der einzige Moment in Football, der
JEDE neue Serie mit einer frischen Ziehung eröffnet, und das macht ihn strukturell
empfindlicher gegenüber Kaskaden-Effekten als jede andere Stelle, an der bisher in diesem Plan
neue Zufallsentscheidungen eingefügt wurden (Kicker/Punter-Slot und QB-Slot griffen beide in
BESTEHENDE, bereits laufende Ziehungen ein, statt neue hinzuzufügen). Ein unabhängiger
Saatstrom ist die saubere, auf dieses Muster übertragbare Lösung, falls ein künftiger
Football-Schritt an einer ähnlich frühen Stelle im Spielfluss neue Zufallsentscheidungen
einführen will.

Football bleibt dabei weiterhin eine Disziplin mit einer vorbestehenden, großen,
EIGENSTÄNDIGEN Pp-Baustelle (64-65/71-72 Pp gegen die 25-Pp-Schranke) — das war schon vor diesem
Plan so, blieb durch alle vier Schritte dieses Plans im Wesentlichen unverändert, und braucht
eine eigene, dedizierte Rezeptrunde (sechs der zwölf Matrixattribute tragen mechanisch
praktisch nichts bei), die hier bewusst nicht versucht wurde.
