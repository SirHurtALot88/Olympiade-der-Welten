# Football-Rezept nach Budget-Methode gegen die Matrix (14.11.–15.11.) — mehrere Runden

Chris, nach der Override-Ruecknahme (`football-matrix-rueckkehr-14-11.md`), woertlich: „ja mach
das rezept jetzt komplett über die matrix, für alle disziplinen!! also wie in 1. Das 2. ist genau
das was zu problemen führt! Wenn du zb nur 26 power für die diszi zur verfügung hast gehen dann
vllt nur 3 in laufkraft 15 in tackling usw" — echte Budget-**Konservierung** (jedes Attribut
verteilt exakt 100 % seines Matrixgewichts ueber die acht Unterfertigkeiten), nicht nur eine
Obergrenze je Zelle. Dieses Dokument beschreibt mehrere Rezeptrunden mit dem dafuer gehaerteten
Werkzeug (`scripts/baue-feldspiel-rezept.mjs`).

**15.11., Chris zum rho-Ergebnis von Runde 1 (0,525), woertlich: „also heißt es du hast die
matrixpunkte verteilt, aber halt nicht gut - wahrscheinlich zu sehr nach realismus und nicht nach
rho balancing. bitte anpassen und paar mal rum probieren."** Das urspruengliche Stopp-Kriterium
(rho < 0,75 nach zwei Runden → vorlegen statt durchdruecken) ist damit aufgehoben — Runde 3
unten ist die direkte Antwort darauf und zugleich ein wichtiger NEUER Befund: die Spaltenseite
(ERLAUBT-Tabelle) hat fuer Football weniger Spielraum, als die lineare Sinkhorn-Rechnung nahelegt,
weil der echte Motor NICHTLINEAR reagiert (s. Abschnitt 3a).

## 1. Werkzeug-Befund: zwei strukturelle Bugs, beide behoben

`scripts/baue-feldspiel-rezept.mjs` loest die Budget-Methode bereits per Sinkhorn-Algorithmus —
das Werkzeug musste nicht neu erfunden werden. Es hatte aber fuer Football zwei konkrete Fehler,
beide in der `ERLAUBT`-Tabelle (welche Zelle welches Attribut ueberhaupt bekommen darf):

1. **`awareness` war in KEINER Zelle erlaubt.** Begruendung im alten Kommentar: awareness
   korrelierte auf einer frueheren Kaderfamilie negativ mit der (damals override-basierten)
   Football-Eignung (rho −0,34). Das macht die Zeile fuer awareness unloesbar — Sinkhorn kann ein
   Attribut nur verteilen, wenn mindestens eine Zelle es zulaesst; awareness trug dadurch
   FAKTISCH 0 Pp statt seines vollen Matrixgewichts (11). Genau der Fehler, den Chris benennt:
   die rho-Sorge darf nicht durch Aussperren aus der ZEILE geloest werden.
2. **`charisma` fehlte ebenfalls komplett** (von niemandem explizit begruendet — schlicht nie
   hinzugefuegt, seit Football ueberhaupt eine Matrix-Zeile fuer charisma bekam).

Behoben: `awareness` ist jetzt in PASSGENAUIGKEIT, PASSSCHUTZ und ABWEHR_PASS erlaubt (die drei
Zellen, die der urspruengliche Football-Plan Teil D dafuer vorsah); `charisma` war schon immer in
TEAMGEIST erlaubt (keine Aenderung dort noetig — der Fehler lag nur in der fehlenden ZEILE, nicht
in einer fehlenden Zelle). Verifiziert mit einem neuen, dauerhaften CI-Guard
(`tests/feldspiel-rezept-budget-guard.test.ts`, separate PR): er schlug auf dem ALTEN Rezept
sofort fehl (meldete korrekt sowohl das fehlende `awareness` als auch `charisma`) und ist auf dem
neuen Rezept gruen.

**Dritter, kleinerer Fund:** `speed` in LAUFKRAFT und `dexterity` in PASSGENAUIGKEIT trugen im
alten (override-kalibrierten) Rezept Gewicht, obwohl beide in der Matrix 0 Pp fuer Football
wiegen. Das loest sich automatisch, weil das neue Rezept ausschliesslich aus der (jetzt
korrekten) `ERLAUBT`-Tabelle gebaut wird — keine zusaetzliche Korrektur noetig.

## 2. Methodisches Zwischenergebnis: die Sondierung ist kompositionsunabhaengig

`scripts/sondiere-feldspiel-subskills.mjs football 24` **zweimal** gefahren — einmal gegen das
ALTE (override-kalibrierte) Rezept, einmal gegen das NEUE (Runde 1) Rezept — lieferte
**bit-identische** mechanische Gewichte (TEAMGEIST 52,7 %, LAUFKRAFT 24,4 %, ABWEHR_LAUF 8,7 %,
PASSGENAUIGKEIT 8,1 %, ABWEHR_PASS 4,9 %, PASSSCHUTZ 1,2 %, BALLSICHERHEIT/AUSDAUER/LAUFTEMPO
0 %). Das ist kein Messfehler, sondern erwartet: Die Sondierung ersetzt die Attribut-Komposition
jeder Unterfertigkeit durch ein orthogonales Ersatzrezept (ein Attribut je Unterfertigkeit), um
genau das mechanische Gewicht der UNTERFERTIGKEIT selbst zu isolieren — unabhaengig davon, welche
Attribute sie im echten Rezept speisen. Die „Sondieren → Sinkhorn → neu sondieren"-Schleife
konvergiert fuer Football deshalb nach einem einzigen Durchlauf; eine dritte Sondierung haette
dieselben Zahlen geliefert. (Das kann sich fuer andere Disziplinen anders verhalten, falls deren
Motor-Formeln staerker kompositionsabhaengig sind — hier nicht der Fall.)

Praktische Folge: **"Runde 2" war eine ERLAUBT-Tabellen-Anpassung (Spaltenseite), keine neue
Sondierung.** TEAMGEIST brauchte laut Sondierung 51,7 % der mechanischen Gesamtmasse, konnte aus
seinen urspruenglich erlaubten Attributen (spirit 25 + charisma 4 + torment 16 = 45 Punkte
Matrixbudget) aber hoechstens 45 erreichen — strukturell zu wenig. `health` zugelassen
(football-fachlich: der grosse, zaehe Zielspieler) sollte die Obergrenze auf 59 heben.

## 3. Gemessen — drei Runden

| | Alt (Override) | Runde 1 (Sinkhorn, awareness/charisma restauriert) | Runde 2 (+ health in TEAMGEIST) | Runde 3 (determination/will umverteilt) |
|---|---:|---:|---:|---:|
| **Pp**, Saatstrom 0 | 121,0 | **18,3** | **26,3** (durchgefallen) | **40** (durchgefallen, deutlich schlechter) |
| rho je Spiel (n=48, frische Kaderfamilie) | — (0,270 nach Matrix-Ruecknahme, altes Rezept) | **0,525** | **0,564** | **0,512** (schlechter, nicht besser) |
| rho Saison | — (0,238) | 0,685 | 0,699 | 0,678 |
| Spannweite je Spiel / Saison | — (0,789/0,853) | 0,206/0,280 | **0,154/0,133** (deutlich stabiler) | 0,137/0,315 |

**Runde 2 und Runde 3 beide verworfen, Runde 1 bleibt der committete Stand.** Runde 2 hob rho
leicht (0,525 → 0,564), kostete dafuer aber die Pp-Pflichtschranke (18,3 → 26,3, `spirit`
ueberzeichnet jetzt um +9,6 statt +2,4 Pp) — `health` wurde LAUFKRAFT entzogen (dort bereits knapp
bemessen), ohne TEAMGEISTs Gesamtmasse tatsaechlich zu heben (39,9 % blieb unveraendert, nur die
Komposition verschob sich). Ein kleiner, weiterhin-durchfallender rho-Gewinn rechtfertigt nicht,
eine bestandene Pflichtschranke wieder zu verletzen — zurueckgerollt. Der committete Stand (und die
`ERLAUBT`-Tabelle in `scripts/baue-feldspiel-rezept.mjs`) ist deshalb wieder Runde 1.

**Pp ist gelöst (Runde 1).** 18,3 Pp liegt bereits unter der 25er-Pflichtschranke und nahe am
angestrebten Optimum (<15) — jedes Attribut außer `stamina` liegt innerhalb von ±2,4 Pp seines
Matrixgewichts (spirit 27,4 vs. 25, torment 17,2 vs. 16, health 16,4 vs. 14, awareness 9,6 vs. 11,
determination 9 vs. 8, will 8,2 vs. 10, power 7,8 vs. 6, charisma 4,3 vs. 4). `stamina` zeigt 0 %
trotz vollem Gewicht in AUSDAUER — nicht, weil das Rezept es falsch verteilt, sondern weil
`AUSDAUER` selbst seit jeher **keinen mechanischen Kanal im Motor hat** (die Sondierung maß 0 %
fuer AUSDAUER schon auf dem ALTEN Rezept) — ein vorbestehender Mechanik-Befund, keine
Rezept-Luecke. Das waere ein eigener, separater Mechanik-Auftrag (AUSDAUER einen tatsaechlichen
Effekt geben), nicht Teil dieser Rezept-Rebuild-Runde.

**rho bleibt unter der Schranke, auch nach drei Runden.** Alle drei sind eine massive
Verbesserung gegenueber dem nackten Override-Rueckbau (0,270 → 0,525/0,564/0,512), aber keine
kommt ueber 0,57 — und Runde 3, die gezielte Antwort auf Chris' "probiere mehrmals, nach rho
balancing statt Realismus", bewegt rho ueberhaupt nicht (0,525 → 0,512, innerhalb der
Kaderrauschen-Spannweite von 0,137 also nicht von Null unterscheidbar) und zerstoert dabei die
Pp-Schranke massiv.

### 3a. Runde 3 im Detail — und der wichtigste neue Befund dieser Runde

**Idee (15.11., direkte Umsetzung von Chris' Auftrag):** statt wie Runde 2 ein bereits
ausgeschoepftes Attribut (health) umzuverteilen, bekommen zwei Attribute mit in Runde 1
ungenutzter "Luft" (`determination`, `will`) zusaetzlichen Zugriff auf die unterversorgte
TEAMGEIST/LAUFKRAFT-Spalte — dafuer verlassen sie teilweise die ueberfuetterte
PASSGENAUIGKEIT/PASSSCHUTZ-Doppelzelle. Rein linear (Sinkhorn-Rechnung) ist das die bisher BESTE
Variante: die interne Rest-Abweichung (Soll- vs. Ist-Masse je Unterfertigkeit, siehe
`scripts/baue-feldspiel-rezept.mjs`-Ausgabe) fiel von 11,74 Pp (Runde 1) auf 5,02 Pp — TEAMGEIST
erreichte 49,0 % statt 39,9 %, PASSGENAUIGKEIT fiel von ueberfuetterten 15,5 % auf fast exakt die
gemessenen 7,5 %.

**Real gemessen am Motor (`scripts/messe-arena-einfluss.mjs football 48`) kam das Gegenteil
heraus: Pp 18,3 → 40,0, der schlechteste Wert aller drei Runden.** Die Ursache ist eindeutig in
der Attribut-Tabelle sichtbar: `awareness` sprang von 9,6 % gemessenem Einfluss (nahe seinem
Matrixgewicht 11) auf **29,9 %** — eine Verzerrung von +18,9 Pp allein durch dieses eine Attribut.
Der Grund: in Runde 1 war `awareness` in PASSGENAUIGKEIT/PASSSCHUTZ eine kleine MINDERHEIT (9 %
je Zelle) und nur in der mechanisch winzigen ABWEHR_PASS-Zelle (4,9 % Gesamtmasse) zu 100 %
vertreten. Weil Runde 3 `determination`/`will` aus PASSGENAUIGKEIT/PASSSCHUTZ abzieht, bleibt dem
Sinkhorn-Solver dort nur noch `awareness` als dominanter Rest — er wird in beiden Zellen zur
MEHRHEIT (81 % bzw. 79 % statt 9 %). Linear (Sinkhorn-Budgetrechnung) ist das unproblematisch:
die GESAMTMASSE, die awareness ueber alle Zellen summiert bekommt, bleibt exakt bei seinem
Matrixgewicht (11 von 100 Punkten). Der echte Motor rechnet aber NICHTLINEAR — vermutlich ueber
die Receiver-/Passer-Lotterie `fkLos()` (`FK_LOS_KAPPA=3,4`, s. `battle-mode.engine.js` ~12680),
die den STAERKSTEN Akteur nach genau dem Attribut auswaehlt, das in seiner Zelle DOMINIERT: wird
`awareness` in zwei von drei football-eigenen "Passing"-Zellen zur Mehrheit, zieht die kappa=3,4-
Lotterie ueberproportional oft Spieler mit hohem `awareness`-Wert heran, unabhaengig davon, wie
klein die Gesamtmasse dieser Zellen ist. Das ist der zentrale methodische Befund dieser Runde:
**die Sinkhorn-Budgetrechnung (Zeile=100%, Spalte=mechanisches Gewicht) ist eine NOTWENDIGE, aber
keine HINREICHENDE Bedingung fuer eine niedrige Pp-Abweichung.** Ob ein Attribut innerhalb einer
Zelle MEHRHEIT oder MINDERHEIT ist, spielt real eine Rolle, die die lineare Rechnung nicht sieht
— ein Attribut, das in mehreren Zellen zur Mehrheit wird, kann real weit mehr Einfluss gewinnen,
als sein Matrixbudget linear vorhersagt, selbst wenn die Spaltensumme stimmt.

**Folge fuer weitere Spaltenseiten-Experimente:** jede Variante, die `determination`/`will` aus
PASSGENAUIGKEIT/PASSSCHUTZ abzieht, laesst dort zwangslaeufig `awareness` als einzigen Rest
zurueck und reproduziert vermutlich denselben Effekt (lokal mit dem Sinkhorn-Werkzeug kurz
gegengerechnet: jede Variante, die `determination` oder `will` aus diesen beiden Zellen entfernt,
hebt `awareness`s Anteil dort automatisch auf 33–87 %, je nachdem wie viel entzogen wird — nicht
nur die hier gemessene 81%/79%-Extremvariante). Das schraenkt den verbleibenden Spielraum der
Spaltenseite erheblich ein: Attribute duerfen zwischen Zellen WANDERN, aber nicht so, dass eine
bereits sichere, kleine Minderheit (awareness) dadurch zur Mehrheit wird.

**Zurueckgerollt (ohne Zoegern, noch vor einer PR-Aktualisierung):** `scripts/
baue-feldspiel-rezept.mjs`s `ERLAUBT.football` und `FELDSPIEL_ART.football.rezept` in
`battle-mode.engine.js` stehen wieder auf Runde 1 (CI-Guard erneut gruen verifiziert). Runde 3 war
nur lokal in diesem Durchlauf veraendert, nie committet oder gepusht — PR #1463 zeigt weiterhin
Runde 1.

## 4. Stopp-Kriterium aufgehoben, aber keine weitere Variante bislang besser als Runde 1

**Chris' Auftrag (15.11.) hebt das urspruengliche Stopp-Kriterium (rho < 0,75 nach zwei Runden)
ausdruecklich auf** — Runde 3 oben ist die direkte Umsetzung davon, kein Ignorieren des Auftrags.
Das Ergebnis bleibt trotzdem: drei genuin unterschiedliche Spaltenseiten-Varianten probiert (Runde
1 = restaurierte ERLAUBT-Zeilen, Runde 2 = neue Zelle fuer ein bereits ausgeschoepftes Attribut,
Runde 3 = Umverteilung zweier noch nicht ausgeschoepfter Attribute), keine schlaegt Runde 1 auf
BEIDEN Kennzahlen zugleich, und Runde 3 zeigt zusaetzlich eine neue, bisher unbekannte Huerde
(Abschnitt 3a), die den verbleibenden Spielraum der Spaltenseite weiter einschraenkt, statt ihn zu
erweitern.

- **Pp ist kein Blocker mehr fuer Runde 1** — die Budget-Methode funktioniert fuer Football genauso
  gut wie fuer jede andere Disziplin, sobald die ERLAUBT-Tabelle keine Matrix-Attribute mehr
  aussperrt. Runde 2 UND Runde 3 zeigen aber: jede weitere Spaltenseiten-Aenderung kann Pp leicht
  verschlechtern — Runde 3 sogar drastisch, ueber einen Mechanismus (Mehrheits-/Minderheits-Anteil
  innerhalb einer Zelle plus `fkLos()`-Lotterie), der mit der reinen Sinkhorn-Rechnung nicht
  sichtbar ist. Jede weitere Runde braucht deshalb zwingend eine ECHTE Pp-Nachmessung am Motor,
  nicht nur den internen Sinkhorn-Restfehler als Proxy.
- **rho ist der verbleibende, harte Rest — und reagiert bisher auf KEINE der drei Varianten.**
  0,525 / 0,564 / 0,512 liegen alle im selben, engen Band, und die Spannweiten (0,137–0,28 je
  Spiel) legen nahe, dass ein Teil dieser Unterschiede ohnehin Kaderrauschen ist, kein echter
  Mechanik-Effekt. Ein konkreter, bisher UNANGETASTETER Hebel wurde dabei gefunden, aber noch
  nicht ausprobiert: `FK_LOS_KAPPA=3,4` in `battle-mode.engine.js` (~12680) ist der Lotterie-
  Exponent, mit dem `fkLos()` JEDE Rollen-Auswahl im Football-Motor trifft (Passer, Receiver/
  TEAMGEIST, Rusher/LAUFKRAFT, Verteidiger) — hoeher zieht staerker zum staerksten Akteur, war
  laut Code-Kommentar (`battle-mode.engine.js` ~12826) in einer frueheren Kalibrierungsrunde
  bereits GEZIELT auf rho hochgesetzt (TEAMGEIST wurde genau DESHALB zur Receiver-Kreditquelle
  gemacht, weil es rho von 0,431 auf 0,460 hob). Das ist ein Hinweis darauf, dass TEAMGEISTs
  Dominanz (52,7 % mechanische Masse) selbst ein bewusst kalibrierter, kein zufaelliger Befund ist
  — ein Tausch der Receiver-Quelle ist also vermutlich SCHON ausprobiert und verworfen worden,
  nicht mehr ungetestet. `FK_LOS_KAPPA` selbst (der Exponent, nicht die Rollen-Wahl) wurde in
  dieser Runde NICHT veraendert — das ist kein Spaltenseiten-Hebel (ERLAUBT-Tabelle) mehr, sondern
  eine Aenderung an der Motor-Formel selbst, die football-weit (jede Lotterie-Entscheidung, nicht
  nur TEAMGEIST) wirkt und eine eigene, sorgfaeltige Nachmessung braucht (Korridor-Fit: Completion-
  Quote, Yards/Attempt, Turnover-Quote duerfen sich dabei nicht verschieben, s. `kurve`-Kommentare
  in `battle-mode.engine.js`) — das sprengt den in dieser Runde vereinbarten Rahmen (nur die
  ERLAUBT-Tabelle, harte Zeilensummen-Grenze) und ist deshalb eine Entscheidung fuer Chris, nicht
  stillschweigend mitgemacht.
- **Kein Attribut-Budget wurde verschoben, um rho zu retten** — alle drei Runden bleiben strikt
  innerhalb der Chris-Vorgabe (volle Zeilensumme je Attribut, s. Guard-Test). Der einzige Hebel,
  der gezogen wurde, ist die Spaltenseite (ERLAUBT-Tabelle), wie ausdruecklich erlaubt.

## 5. Optionen fuer Chris / die naechste Runde

1. **`FK_LOS_KAPPA` als neuen, separaten Hebel diskutieren** (Abschnitt 4) — koennte rho heben
   (das ist der dokumentierte Grund, warum TEAMGEIST ueberhaupt die Receiver-Quelle wurde), wirkt
   aber auf den GESAMTEN Football-Motor (jede Lotterie, nicht nur TEAMGEIST) und braucht eine
   eigene Korridor-Nachmessung (Completion-Quote/Yards-Attempt/Turnover-Quote) — ein groesserer,
   eigener Auftrag, keine weitere ERLAUBT-Tabellen-Iteration.
2. **Weitere, VORSICHTIGERE Spaltenseiten-Iterationen** — nach Runde 3s Befund (Abschnitt 3a)
   eingeschraenkt auf Varianten, die KEIN Attribut in einer PASSGENAUIGKEIT/PASSSCHUTZ-artigen
   Zelle von Minderheit zu Mehrheit verschieben. Der verbleibende Spielraum ist damit klein; drei
   von drei bisher versuchten Varianten haben rho nicht ueber das Kaderrauschen hinaus bewegt.
3. **rho-Schranke fuer Football gesondert diskutieren** (analog zur bereits bestehenden
   Stern-/Paartreue-Ausnahme bei anderen Disziplinen, falls 0,55–0,60 als "ehrlicher" Zielwert fuer
   diese spezielle Disziplin akzeptiert werden kann, nachdem drei unabhaengige Spaltenseiten-
   Varianten alle im selben engen Band landen) — eine Design-Entscheidung, keine
   Implementierungsfrage.
4. **AUSDAUER einen echten mechanischen Kanal geben** (eigener, kleinerer Auftrag, unabhaengig von
   der rho-Frage, würde `stamina`s Pp von 0 auf etwas Reales heben, ohne das aktuelle Rezept
   anzutasten).

## Quellen

- `scripts/baue-feldspiel-rezept.mjs`, `scripts/sondiere-feldspiel-subskills.mjs` (gehaertet,
  separate PR).
- `tests/feldspiel-rezept-budget-guard.test.ts` (neuer CI-Guard, separate PR).
- `public/mockups/battle-mode.engine.js`, `FELDSPIEL_ART.football.rezept` (diese PR).
- `docs/design/football-matrix-rueckkehr-14-11.md` (Vorlaeufer-Dokument, Override-Ruecknahme).
- `docs/design/football-matrix-entscheidung.md` (16.09., die urspruengliche A/B-Entscheidung).
- Eigene Messungen (14.11.): `node scripts/messe-arena-einfluss.mjs football 48`,
  `node scripts/miss-alle-disziplinen.mjs 48 football` — frische Kaderfamilie
  (`scripts/ziehe-kader-familie.ts`, Save "Oly New Game Custom 31.10.2026").
