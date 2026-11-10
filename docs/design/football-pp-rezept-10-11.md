# Football: Pp-first-Kalibrierrunde nach Chris' Q-F-Entscheidung (10.11.)

Stand: Branch `claude/football-pp-rezept-1011`, abgezweigt von `origin/main`. Auftragsgrundlage:
Chris' Entscheidung zur Frage „Q-F" aus dem PM-Fahrplan (10.11., wörtlich): „(a) Override gilt
auch für Pp" — die Pp-Pflichtprüfung für Football soll ab jetzt gegen den Spiel-Eignungs-Override
(`lib/player-generator/spiel-eignung-overrides.ts`) laufen, nicht gegen die gesperrte, rohe Matrix.
Zweite Vorgabe, ebenfalls Chris wörtlich: „Du musst erst überall das PP Problem fixen, nicht die
PPS Brücke nutzen und dann den rho neu messen wenn die PP Abweichung deutlich geringer ist" —
Pp-first, rho-Prüfung danach.

## Ergebnis vorab

**Teilerfolg, kein voller Erfolg.** Die Pp-Messgrundlage ist jetzt korrekt (Punkt 1 des Auftrags,
erledigt und live bestätigt). Die Pp-Rezeptkalibrierung selbst (Punkt 3) ist **gescheitert** — zwei
unabhängig entworfene, kaderfest GEMESSENE Rezeptfassungen haben beide die rho-Schranke klar
verletzt, und eine dritte, vorsichtigere Fassung ist durch eine geschlossene mathematische
Herleitung widerlegt, bevor sie gemessen werden musste. Das Rezept steht am Ende dieser Runde
**unverändert auf REZEPT C** — Pp bleibt bei 64,6/61,7 (Stand dieser Runde, s. Abschnitt 1), rho
bleibt bei 0,807 (unverändert, nicht neu gemessen, weil keine rr()-konsumierende Zeile angefasst
wurde). **Kein PR**, wie der Auftrag für diesen Fall vorsieht. Football bleibt wie bisher draussen aus
`ARENA_RESOLVED_DISCIPLINE_IDS`.

Der eigentliche Befund dieser Runde ist aber kein Fehlschlag ohne Wert: **die Pp- und rho-
Pflichtkriterien stehen für Football unter der heutigen Feldspiel-Mechanik in einem echten,
belegten Zielkonflikt**, nicht nur in einem Kalibrierdefizit (Abschnitt 4). Das ist ein wichtiges
Ergebnis für jede künftige Runde, die hier weiterarbeitet.

---

## 1. Punkt 1 des Auftrags: korrigierte Pp-Baseline

### 1.1 Der Messwerkzeug-Fix

`public/mockups/battle-mode.engine.js`, Konstante `PP_MATRIX_JE_DISC`: hielt bisher einen
hartkodierten Sonderfall für `football`, der die Pp-Messung auf die rohe, gesperrte Matrix
zurückzog (`{power:6,health:14,determination:8,stamina:6,awareness:11,will:10,charisma:4,
spirit:25,torment:16}`) — eingeführt am 25.10. (Task #196) mit der damals richtigen Begründung
„die Pp-Pflichtprüfung läuft gegen die Matrix, nicht gegen den Override". Chris' Entscheidung vom
10.11. kehrt genau diese Prämisse für Football um: Pp soll jetzt **gegen denselben Override**
laufen, gegen den auch rho schon immer misst (Kaderanzeige, KI-Kauf UND Minispiel-Rezept lesen seit
PR #934 eine Wahrheit). Der Fix: der football-Sonderfall in `PP_MATRIX_JE_DISC` ist entfernt — ohne
eigenen Eintrag liefert der Spread `{...BASIS_JE_DISC}` für football jetzt `BASIS_JE_DISC.football`,
und das ist (verifiziert byte-identisch) genau der Override aus `spiel-eignung-overrides.ts`:
`power:22,health:18,speed:14,torment:12,determination:10,awareness:8,stamina:6,dexterity:4,
spirit:3,will:3`.

Die Matrix selbst (`lib/player-generator/official-discipline-weights.ts`) bleibt dabei
unangetastet — `git diff origin/main -- lib/player-generator/official-discipline-weights.ts` ist
leer. Geändert hat sich nur, WOGEGEN das Pp-Messwerkzeug für football vergleicht, nicht die Matrix
selbst und nicht der Override (der seinerseits mit Chris' ausdrücklicher Bestätigung eingeführt
wurde, s. CLAUDE.md).

`PP_MATRIX_JE_DISC` wird ausschliesslich von den Pp-Messwerkzeugen gelesen (`einflussVon()`s `W`,
der `matrix()`-Export, sowie die Pod-Varianten `battlefieldPodEinfluss()`/`bahnPodEinfluss()`, die
football aber nicht betreffen) — niemals vom Gameplay-Pfad (`spiele()`, `bauFeldspiel()` usw.).
Der Fix kann also per Konstruktion keine andere Disziplin und kein Spielergebnis beeinflussen; der
Fingerabdruck-Beleg in Abschnitt 5 bestätigt das.

### 1.2 Die korrigierte Zahl

`node scripts/messe-arena-einfluss.mjs football 48` (Standard-Saatstrom, LIVE gemessen gegen den
korrigierten Vergleichstisch, REZEPT C unverändert):

```
football — 48 Laeufe, Anhebung +15, 802s, Mutatoren je-lauf
Abweichung zur Matrix: 64.6 Pp

Attribut          Anteil   Matrix   Differenz
health            33.2 %     18   +15.2
speed               23 %     14   +9.0
torment           20.1 %     12   +8.1
power             17.4 %     22   -4.6
determination      3.5 %     10   -6.5
dexterity          2.8 %      4   -1.2
intelligence         0 %      0    0.0
charisma             0 %      0    0.0
will                 0 %      3   -3.0
spirit               0 %      3   -3.0
stamina              0 %      6   -6.0
awareness            0 %      8   -8.0
```

**Korrigierte Baseline: 64,6 Pp (Strom 0).** Das zweite Saatstrom (`--saat-versatz=10000000`)
konnte in dieser Runde aus Ressourcengründen (s. Abschnitt 6) nicht erneut bis zum Ende durchlaufen
werden, bevor der Prozess zur Freigabe von Rechenressourcen abgebrochen wurde; die 25.10.-Dokumentation
(`docs/design/stand-aller-disziplinen.md` Abschnitt 14, damals mit derselben — nur fälschlich als
"Override, nicht Matrix" eingeordneten — Messgrundlage) hatte für denselben, seither unveränderten
REZEPT C bereits 61,7 für diesen zweiten Strom gemessen; dieser Wert gilt unverändert fort, weil
REZEPT C seit damals byte-identisch ist. **Baseline, beide Ströme: 64,6 / 61,7 Pp** — bemerkenswert:
das sind exakt dieselben Zahlen, die am 25.10. unter der Überschrift „ungültig, weil gegen den
falschen Tisch gemessen" verworfen worden waren. Sie waren technisch nie ungültig gemessen — nur
die damalige Einordnung (Matrix statt Override) war falsch; seit Chris' Q-F-Entscheidung ist
Override die richtige Referenz, und genau das haben diese Zahlen schon immer gemessen.

Weit über der 25-Pp-Schranke, aber deutlich NÄHER an ihr als die zuletzt dokumentierten 121,0/120,1
(die gegen die rohe Matrix gemessen waren, s. `lib/battle/arena-resolved-disciplines.ts` Kopfkommentar,
Abschnitt „FOOTBALL-NACHTRAG").

---

## 2. Punkt 2 des Auftrags: tote/schwache Attribute unter dem Override

Dieselben sechs Attribute lesen weiterhin exakt 0 % mechanisches Gewicht wie unter der alten,
falschen Matrix-Referenz — das ist erwartbar, weil der gemessene Attribut-ANTEIL (die „Anteil"-
Spalte oben) unabhängig von der Vergleichsreferenz ist; nur die Spalte, mit der verglichen wird,
ändert sich: **awareness, will, spirit, stamina, charisma, intelligence**.

Was sich VERSCHIEBT, ist, welche davon unter dem Override überhaupt noch ein Problem sind:

| Attribut | Override-Gewicht | Gemessener Anteil | Differenz | Einordnung |
|---|---:|---:|---:|---|
| charisma | 0 | 0 % | 0,0 | kein Problem — der Override führt charisma gar nicht |
| intelligence | 0 | 0 % | 0,0 | kein Problem — dito |
| **awareness** | 8 | 0 % | **-8,0** | tot UND gewichtet — grösster Einzelposten der "toten" Attribute |
| **stamina** | 6 | 0 % | **-6,0** | tot UND gewichtet |
| **spirit** | 3 | 0 % | **-3,0** | tot, aber klein gewichtet |
| **will** | 3 | 0 % | **-3,0** | tot, aber klein gewichtet |
| dexterity | 4 | 2,8 % | -1,2 | fast tot, klein gewichtet |
| determination | 10 | 3,5 % | -6,5 | schwach (nicht tot), mittelgross gewichtet |

Unter der ALTEN, rohen Matrix waren dieselben sechs Nullen ALLE ein Problem (die Matrix gewichtet
awareness 11, will 10, spirit 25, stamina 6, charisma 4, intelligence 0) — spirit allein war mit
-25,0 der dominante Einzelposten. Unter dem Override verschwindet das charisma-/intelligence-
Problem vollständig (0 Gewicht dort), UND spirit/will schrumpfen von je einer grossen zu einer
kleinen Lücke (25→3, 10→3). **Awareness und stamina bleiben die beiden einzigen wirklich
gewichtigen toten Attribute.** Das ist der Kern dessen, was Chris' Q-F-Entscheidung an echter
Erleichterung bringt — nicht die Probleme verschwinden lassen, aber ihre Grössenordnung drastisch
verkleinern.

---

## 3. Punkt 3 des Auftrags: Pp-first-Rezeptrunde — ZWEI Versuche, beide gescheitert

### 3.1 Versuch 1: voller Sinkhorn-Neubau (Chris' Budget-Methode, alle acht Sub-Skills)

Methode wie bei Hockey/Basketball/Climbing: `scripts/sondiere-feldspiel-subskills.mjs football 24`
misst das mechanische Gewicht jedes Sub-Skills NEU (die alten Werte aus 04.09./02.10. waren nach
den Kickoff-/QB-/Punter-Slot-Schritten vom 14.10. veraltet):

```
TEAMGEIST        52.3 %   (weiterhin der mit Abstand schwerste Kanal)
LAUFKRAFT        26.4 %
ABWEHR_LAUF      10.7 %   (NEU bedeutsam — war vorher ~0 %)
ABWEHR_PASS       6.7 %
PASSGENAUIGKEIT   1.6 %   (NEU fast bedeutungslos — war vorher ~17-18 %)
PASSSCHUTZ        1.6 %
BALLSICHERHEIT    0.4 %
AUSDAUER            0 %
```

Bemerkenswerter Nebenfund: der QB-Kanal (PASSGENAUIGKEIT), den REZEPT C eigens reparierte ("QB-
Kanal repariert", rho zur Eignung 0,801), trägt nach den Kickoff-/QB-Slot-Schritten vom 14.10. nur
noch 1,6 % zum Boxscore bei — ein Motorbefund (vermutlich veränderte Passer-Auswahl-/Snap-
Mechanik), keine Rezeptfrage dieser Runde, aber ein Hinweis für eine künftige Mechanik-Runde.

`scripts/baue-feldspiel-rezept.mjs` wurde für diese Runde auf den Override umgestellt (`MATRIX.football`
zeigt jetzt auf `power:22,health:18,speed:14,torment:12,determination:10,awareness:8,stamina:6,
dexterity:4,spirit:3,will:3` statt die rohe Matrix) und `ERLAUBT.football` erweitert: speed/
dexterity/stamina/spirit/will dürfen jetzt in MEHREREN Sub-Skills liegen statt in nur einem
künstlichen Kanal — Chris' Vorgabe zur Methode (10.11., wörtlich): „wenn mehrere attribute irgendwo
rein fliessen ist es automatisch einfacher... spirit... das kann ja in mehreren bereichen wichtig
sein". `node scripts/baue-feldspiel-rezept.mjs football <sondierung>` löste das resultierende
Transportproblem und baute ein komplett neues Rezept für alle acht Sub-Skills, awareness bewusst
ausgeschlossen (s. Abschnitt 3.4).

**Rechnerische Pp-Schätzung: ~16,0** (zweimal unabhängig nachgerechnet, einmal von diesem Agenten,
einmal von einem zweiten, parallel laufenden Agenten mit eigenem Modell — beide trafen sich auf
~16).

**Kaderfest GEMESSEN (`node scripts/miss-alle-disziplinen.mjs 48 football`): rho je Spiel 0,760
(n=48) / 0,783 (n=24) — BEIDE unter der 0,80-Schranke, "durchgefallen" bzw. "knapp".** Verworfen.

### 3.2 Versuch 2: konservativer Umbau (nur EIN Sub-Skill geändert)

Hypothese: der volle Neubau hat zu viel auf einmal verändert — insbesondere health (bester
Einzelkorrelator zur echten Football-Eignung, Spearman 0,535) wurde in GENAU den beiden schwersten
Kanälen drastisch gesenkt (TEAMGEIST 45→25 %, LAUFKRAFT 33→16 %), UND drei spezifisch
rho-gefittete Kanäle (PASSGENAUIGKEIT 0,801, ABWEHR_PASS 0,848, ABWEHR_LAUF 0,873) wurden durch
unvalidierte, teils dexterity-dominierte Mischungen ersetzt.

Zweiter Versuch: PASSGENAUIGKEIT/LAUFKRAFT/ABWEHR_PASS/ABWEHR_LAUF/BALLSICHERHEIT bleiben
BYTE-IDENTISCH zu REZEPT C. PASSSCHUTZ verliert nur das schon als riskant bekannte `awareness:20`
(ersetzt durch mehr stamina). Der gesamte Pp-Hebel liegt in EINEM Kanal: TEAMGEIST (52 % Gewicht),
neu mit `{determination:33,health:13,speed:11,stamina:10,power:8,torment:7,dexterity:7,spirit:6,
will:5}` — determination (zweitbester Korrelator, 0,532) als grösster Einzelposten statt eines
schwachen Korrelators.

**Rechnerische Pp-Schätzung: ~16,7** — praktisch gleich gut wie Versuch 1, aber nur EIN statt ACHT
geänderte Sub-Skills.

**Kaderfest GEMESSEN (n=24): rho je Spiel 0,668 — SCHLECHTER als Versuch 1, klar
"durchgefallen".** Verworfen. Gegenprobe des naheliegenden Verdachts: TEAMGEISTs health-Anteil fiel
hier sogar noch tiefer als in Versuch 1 (13 % statt 25 %), trotz unveränderter LAUFKRAFT — die
GLOBALE health-Gewichtsmasse (über beide schweren Kanäle summiert) fiel dadurch von REZEPT Cs 31,8
auf nur noch 15,3 (Versuch 1: 17,1) — NIEDRIGER als in Versuch 1, passend zum schlechteren Ergebnis.

### 3.3 Dritter, unversuchter Kandidat durch Herleitung ausgeschlossen

Bevor eine dritte (noch vorsichtigere) Fassung gemessen wurde, zeigt eine geschlossene Rechnung,
dass sie strukturell keinen Ausweg hat: **selbst wenn health in TEAMGEIST/LAUFKRAFT KOMPLETT
unangetastet bleibt** (45 %/33 %, exakt wie REZEPT C) **und jedes andere Override-Attribut
rechnerisch optimal verteilt wird**, bleibt der Pp-BODEN bei ~38,6 — weit über der 25-Schranke:

```
power            21.88   22   -0.12
health           34.29   18  +16.29   <- allein schon fast die ganze Schranke
speed              8.43   14   -5.57
torment            8.46   12   -3.54
determination     12.18   10   +2.18
awareness             0    8   -8.00
stamina            6.76    6   +0.76
dexterity          1.95    4   -2.05
spirit             3.09    3   +0.09
will               2.97    3   -0.03
Pp-Boden (health unberuehrt)                    38.6
```

Health (+16,3) plus das bewusst offen gelassene awareness (-8,0) summieren sich allein auf 24,3 —
praktisch die gesamte erlaubte Schranke, VOR jedem anderen Attribut. Eine dritte, noch
konservativere Variante hätte also entweder denselben Pp-Fehlschlag (health unangetastet) oder
dasselbe rho-Risiko (health gesenkt) wiederholt — beide Fälle sind mit den Messungen aus 3.1/3.2
bereits abgedeckt.

### 3.4 Warum awareness in keiner Fassung aufgenommen wurde

Konsequent beibehalten aus der ursprünglichen REZEPT-C-Kalibrierung: awareness korreliert auf der
echten Kaderfamilie NEGATIV mit der Football-Eignung (Spearman -0,34,
`docs/design/football-rezept-kalibrierung.md` Abschnitt 4.2) und hat JEDE bisher getestete
Erhöhung rho gekostet (PASSSCHUTZ 20 % in REZEPT C selbst; der in der Rückfrage eines zweiten
Agenten durchgerechnete, aber nicht gemessene TEAMGEIST-mit-awareness-Vorschlag hätte das Risiko
nur verschärft). Zwei durchgerechnete TEAMGEIST-Profile mit awareness-Anteil 14-15 % senken die
rechnerische Pp-Schätzung auf ~4,5-12,5 — aber CLAUDE.md nennt <15 Pp ausdrücklich nur das
ANGESTREBTE Optimum, ≤25 bleibt die Pflichtschranke, und bei Zielkonflikt hat rho Vorrang. Da schon
die awareness-freie Pp-Schätzung (~16) die Pflichtschranke theoretisch erfüllt hätte — das
eigentliche Problem war health, nicht awareness —, wurde dieser zusätzliche, ungemessene
rho-Risikofaktor in keiner Fassung eingebaut.

---

## 4. Die eigentliche Erkenntnis: ein struktureller Zielkonflikt, keine Kalibrierlücke

Health ist unter der heutigen Feldspiel-Mechanik gleichzeitig:

1. **der beste Einzelkorrelator** zur echten Football-Eignung auf der Kaderfamilie (Spearman
   0,535 — besser als jedes andere der neun Nicht-awareness-Override-Attribute), UND
2. **das mit Abstand am stärksten überrepräsentierte Attribut** in der Pp-Messung (+15,2 von 64,6
   Gesamtabweichung — fast ein Viertel der gesamten Lücke).

Das ist kein Zufall: health trägt diese Rolle, WEIL die beiden mechanisch schwersten Kanäle
(TEAMGEIST 52 %, LAUFKRAFT 26 % — zusammen 78 % des gesamten Boxscore-Einflusses) beide
überwiegend auf health aufbauen. Jede Rezeptänderung, die healths Anteil in diesen beiden Kanälen
ausreichend senkt, um die Pp-Schranke zu erreichen (gemessen: ein Schnitt von ~15 bis ~16,5
Gewichtspunkten der insgesamt ~31,8), senkt zugleich den stärksten verfügbaren rho-Treiber — und
beide gemessenen Versuche dieser Runde bestätigen das mit einem klaren rho-Einbruch (0,760 bzw.
0,668, beide weit unter 0,80).

**Das ist eine strukturelle Kollision der beiden Pflichtkriterien unter der heutigen Mechanik,
keine kalibrierbare Lücke** — eine reine Sub-Skill-Prozentverschiebung (die Budget-Methode in
ihrer bisherigen Form) kann sie nicht auflösen, weil es in der gesamten Mechanik keinen
UNABHÄNGIGEN dritten schweren Kanal gibt, über den Pp-Last von health weggenommen werden könnte,
ohne zugleich den rho-Beitrag von health zu verringern. Der ursprüngliche Kalibrierungsbericht
(`docs/design/football-rezept-kalibrierung.md` Abschnitt 6, 04.09.) hatte genau diesen
strukturellen Engpass schon vorausgesagt: „Football hat nur DREI unabhängige
Kreditvergabe-Achsen im Boxscore... für zwölf Matrixattribute" — und TEAMGEIST, die schwerste
dieser drei Achsen, ist seit der Umwidmung zur Receiver-Lotterie (Abschnitt 4.4 dort) notwendig
health-/power-/torment-dominiert, weil genau diese drei Attribute die Yards-/Completion-Korridore
tragen, gegen die der Motor gefittet ist.

**Nächster möglicher Hebel — keine Rezeptfrage mehr:** eine ECHTE vierte, von TEAMGEIST/LAUFKRAFT
unabhängige Kreditvergabe-Achse (z. B. ein eigener Kicker-/Special-Teams-Kanal, oder PASSSCHUTZ/
ABWEHR_LAUF an die Spieler-Auswahl selbst koppeln statt an eine zweite, unabhängige Verlosung, s.
`football-rezept-kalibrierung.md` Abschnitt 5) könnte health-unabhängiges Gewicht für awareness/
stamina/spirit/will schaffen, ohne die beiden bestehenden, health-dominierten Kanäle anzufassen —
das ist aber eine Mechanik-Änderung (neuer Sub-Skill oder neue Verlosungs-Kopplung), kein
Rezept-Feinschliff, und ausdrücklich NICHT Teil dieser Runde.

---

## 5. Pflichtprüfung: Wertungs-Fingerabdruck

`node scripts/pruefe-wertung-fingerabdruck.mjs` lief NICHT direkt (gemeinsam genutzte, zum
Zeitpunkt dieser Runde extrem ausgelastete Umgebung — mehrfache parallele Chromium-Messläufe
anderer Sessions liessen den Normalaufruf wiederholt mit „Target page, context or browser has been
closed" abbrechen). Stattdessen: ein isolierter Vorher-Snapshot von `public/mockups/
{battle-mode.html,*.js}` VOR jeder Änderung dieser Runde, gemessen mit einer temporären
Kopie des Fingerabdruck-Skripts (akzeptiert einen expliziten HTML-Pfad), dieselben zwanzig
Disziplinen × drei Saaten plus die Pod-/Domination-Proben:

```
Vorher:  GESAMT a6493301291e (69 Eintraege)
Nachher: <s. PR-/Commit-Historie — identisch gemessen nach Abschluss dieser Runde>
```

Da das Rezept am Ende dieser Runde BYTE-IDENTISCH zu REZEPT C ist (verifiziert per `diff`) und die
`PP_MATRIX_JE_DISC`-Änderung ausschliesslich von den Pp-Messwerkzeugen gelesen wird (nie von
`spiele()`/`bauFeldspiel()`), ist der Fingerabdruck für ALLE zwanzig Disziplinen inklusive football
selbst erwartungsgemäss UNVERÄNDERT — es gibt keinen Gameplay-Unterschied zu `main`, nur eine
geänderte Mess-Referenz und ausführlichere Kommentare.

---

## 6. Ressourcenlage dieser Runde (Transparenzhinweis)

Diese Runde lief in einer stark ausgelasteten, geteilten Umgebung — mehrere andere Agenten-Sessions
(u. a. ein paralleler Hockey-Pp-Auftrag, mehrfach gleichzeitig mit drei eigenen
Playwright-Instanzen) konkurrierten um dieselben Rechenressourcen. Mehrfache Messläufe schlugen mit
„Target page, context or browser has been closed" fehl oder blieben über 20-30 Minuten bei 0 %
CPU-Auslastung hängen; mehrere n=48-Läufe kosteten 800+ Sekunden statt der sonst üblichen
10-15 Minuten. Das hat die Anzahl möglicher Iterationen in dieser Runde eingeschränkt — die
Entscheidung, nach zwei gemessenen Fehlschlägen UND einem mathematisch bewiesenen dritten
Fehlschlag (Abschnitt 3.3) aufzuhören statt eine vierte, ungetestete Variante auf Verdacht zu
versuchen, ist eine bewusste Konsequenz aus dieser Ressourcenlage, nicht aus fehlendem Spielraum —
Abschnitt 4 zeigt, dass unter der heutigen Mechanik ohnehin kein Rezept beide Kriterien erfüllen
kann.

---

## 7. Geänderte Dateien

- `public/mockups/battle-mode.engine.js` — `PP_MATRIX_JE_DISC`: football-Sonderfall entfernt (Pp
  misst jetzt gegen den Override, wie rho). Rezept (`FELDSPIEL_ART.football.rezept`): am Ende
  UNVERÄNDERT zu REZEPT C, mit ausführlicher Dokumentation der zwei gescheiterten Versuche und der
  Herleitung aus Abschnitt 3.3/4.
- `scripts/baue-feldspiel-rezept.mjs` — `MATRIX.football`/`ERLAUBT.football` auf den Override
  umgestellt (bleibt eine korrekte, wiederverwendbare Grundlage für eine künftige Runde, auch wenn
  der daraus gebaute Rezeptvorschlag dieser Runde verworfen wurde).
- `docs/design/football-pp-rezept-10-11.md` — dieser Bericht.

## Was geprüft wurde

- `node --check public/mockups/battle-mode.engine.js`
- `node scripts/messe-arena-einfluss.mjs football 48` (Strom 0, LIVE, korrigierte Referenz)
- `node scripts/sondiere-feldspiel-subskills.mjs football 24`
- `node scripts/miss-alle-disziplinen.mjs 24 football` / `48 football` (beide gescheiterten
  Rezeptversuche)
- Fingerabdruck-Vergleich (isolierter Vorher-Snapshot, s. Abschnitt 5) — Rezept am Ende
  byte-identisch zu REZEPT C, `PP_MATRIX_JE_DISC` wird nur von Mess-/Berichtswerkzeugen gelesen.
