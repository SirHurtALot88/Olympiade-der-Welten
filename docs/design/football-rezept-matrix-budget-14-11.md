# Football-Rezept nach Budget-Methode gegen die Matrix (14.11.) — zwei Runden, Stopp

Chris, nach der Override-Ruecknahme (`football-matrix-rueckkehr-14-11.md`), woertlich: „ja mach
das rezept jetzt komplett über die matrix, für alle disziplinen!! also wie in 1. Das 2. ist genau
das was zu problemen führt! Wenn du zb nur 26 power für die diszi zur verfügung hast gehen dann
vllt nur 3 in laufkraft 15 in tackling usw" — echte Budget-**Konservierung** (jedes Attribut
verteilt exakt 100 % seines Matrixgewichts ueber die acht Unterfertigkeiten), nicht nur eine
Obergrenze je Zelle. Dieses Dokument beschreibt zwei Rezeptrunden mit dem dafuer gehaerteten
Werkzeug (`scripts/baue-feldspiel-rezept.mjs`) und wendet das vereinbarte Stopp-Kriterium an.

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

## 3. Gemessen — zwei Runden

| | Alt (Override) | Runde 1 (Sinkhorn, awareness/charisma restauriert) | Runde 2 (+ health in TEAMGEIST) |
|---|---:|---:|---:|
| **Pp**, Saatstrom 0 | 121,0 | **18,3** | **26,3** (durchgefallen) |
| rho je Spiel (n=48, frische Kaderfamilie) | — (0,270 nach Matrix-Ruecknahme, altes Rezept) | **0,525** | **0,564** |
| rho Saison | — (0,238) | 0,685 | 0,699 |
| Spannweite je Spiel / Saison | — (0,789/0,853) | 0,206/0,280 | **0,154/0,133** (deutlich stabiler) |

**Runde 2 verworfen, Runde 1 ist der finale Stand dieser PR.** Runde 2 hob rho leicht (0,525 →
0,564), kostete dafuer aber die Pp-Pflichtschranke (18,3 → 26,3, `spirit` ueberzeichnet jetzt um
+9,6 statt +2,4 Pp) — `health` wurde LAUFKRAFT entzogen (dort bereits knapp bemessen), ohne
TEAMGEISTs Gesamtmasse tatsaechlich zu heben (39,9 % blieb unveraendert, nur die Komposition
verschob sich). Ein kleiner, weiterhin-durchfallender rho-Gewinn rechtfertigt nicht, eine
bestandene Pflichtschranke wieder zu verletzen — zurueckgerollt. Der committete Stand (und die
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

**rho bleibt unter der Schranke.** Beide Runden sind eine massive Verbesserung gegenueber dem
nackten Override-Rueckbau (0,270 → 0,525 → 0,564), aber beide liegen klar unter 0,80 — und unter
dem vereinbarten Stopp-Kriterium von 0,75 nach zwei Runden.

## 4. Stopp — wie vereinbart

**Kriterium erreicht: rho < 0,75 nach zwei Rezeptrunden (0,525 und 0,564 je Spiel).** Diese Runde
stoppt hier, legt die Zahlen vor und drueckt nicht durch — committet ist Runde 1 (Pp bestanden,
rho durchgefallen), nicht Runde 2 (beides schlechter kombiniert als Runde 1 wert ist). Zur
Einordnung:

- **Pp ist kein Blocker mehr** — die Budget-Methode funktioniert fuer Football genauso gut wie
  fuer jede andere Disziplin, sobald die ERLAUBT-Tabelle keine Matrix-Attribute mehr aussperrt.
  Runde 2 zeigt aber auch: eine weitere Spaltenseiten-Aenderung kann Pp genauso leicht wieder
  verschlechtern wie verbessern, wenn sie ein bereits ausgeschoepftes Attribut nur umverteilt statt
  echten Spielraum zu schaffen — jede weitere Runde braucht dieselbe Pp-Nachmessung, nicht nur eine
  rho-Nachmessung.
- **rho ist der verbleibende, harte Rest.** Die Sondierung zeigt: TEAMGEIST (Receiver-Kredit) und
  LAUFKRAFT (Laeufer-Kredit) tragen zusammen ~76 % der mechanischen Gesamtmasse des Spiels, und
  TEAMGEISTs erlaubte Attribute (spirit/charisma/torment) korrelieren auf der frischen
  Kaderfamilie offenbar deutlich schwaecher mit der tatsaechlichen Spielleistung als die alte
  power/health/speed-Mischung es tat — exakt die Spannung, die `football-matrix-entscheidung.md`
  schon am 16.09. vorhergesagt hatte ("könnte, muss aber nicht, auch die Rangtreue heben... ob
  eine neue Matrix insgesamt sauberer trennt, ist ungemessen").
- **Kein Attribut-Budget wurde verschoben, um rho zu retten** — beide Runden bleiben strikt
  innerhalb der Chris-Vorgabe (volle Zeilensumme je Attribut, s. Guard-Test). Der einzige Hebel,
  der gezogen wurde, ist die Spaltenseite (ERLAUBT-Tabelle), wie ausdruecklich erlaubt.

## 5. Optionen fuer Chris / die naechste Runde

1. **Weitere Spaltenseiten-Iterationen** (mehr ERLAUBT-Varianten fuer TEAMGEIST/LAUFKRAFT
   durchprobieren, ggf. mit einer dritten Sondierung, falls eine spaetere Variante tatsaechlich
   komplexer mit der Komposition interagiert) — ungewisser Ausgang, da die Sondierung bisher
   kompositionsunabhaengig war.
2. **rho-Schranke fuer Football gesondert diskutieren** (analog zur bereits bestehenden
   Stern-/Paartreue-Ausnahme bei anderen Disziplinen, falls 0,70–0,75 als "ehrlicher" Zielwert fuer
   diese spezielle Disziplin akzeptiert werden kann) — eine Design-Entscheidung, keine
   Implementierungsfrage.
3. **AUSDAUER einen echten mechanischen Kanal geben** (eigener, kleinerer Auftrag, unabhaengig von
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
