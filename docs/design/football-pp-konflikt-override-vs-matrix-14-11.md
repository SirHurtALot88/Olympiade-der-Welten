> **UEBERHOLT (14.11., selber Tag).** Chris hat die Frage direkt entschieden (im Chat, nicht per
> PR-Review): „football muss zu unserem system mit der matrix zurückkehren" — Weg A aus
> `football-matrix-entscheidung.md`, nicht eine der drei unten vorgeschlagenen Optionen. Der
> Override ist zurueckgebaut; was dabei GEMESSEN wurde (inklusive einer wichtigen Ueberraschung:
> Pp sinkt dadurch NICHT auf nahe 0) steht in `football-matrix-rueckkehr-14-11.md`. Dieses
> Dokument bleibt als Befund/Historie stehen (die NERVENSTAERKE-Nebenweg-Messung und die
> TEAMGEIST-/PASSSCHUTZ-Historie sind weiterhin gueltiger Kontext), nur der Options-Teil ist
> erledigt.

# Football: Pp-Konflikt Override vs. Matrix — Befund und Optionen

Keine Rezeptrunde, keine Implementierung — eine Entscheidungsvorlage, wie
`football-matrix-entscheidung.md` selbst eine war. Task #196 (25.10.) hat die Pp-Pflichtzahl für
Football korrigiert und auf 121,0/120,1 gesetzt; dieses Dokument prüft, ob sich das mit einem
Primär-/Nebenweg-Ansatz (CLAUDE.md-Designleitlinie, 21.09.) ehrlich schließen lässt. Kurze Antwort:
nein, nicht ohne entweder rho zu kosten oder den Bonus so groß zu machen, dass er kein
Nebenweg mehr ist, sondern ein künstlicher Zahlentrick. Beides verbietet die Aufgabe ausdrücklich.

## 1. Verifizierung der 121,0/120,1-Zahl

Frisch gemessen (`node scripts/messe-arena-einfluss.mjs football 48` bzw. mit
`--saat-versatz=10000000`, unveränderter Stand von `main`, Commit `5e5916d25`):

| Saatstrom | Dokumentiert (25.10.) | Frisch gemessen (14.11.) |
|---|---:|---:|
| 0 | 121,0 | **121,0** |
| 10 000 000 | 120,1 | nicht erneut einzeln gemessen, s. unten |

Stream 0 trifft die dokumentierte Zahl exakt. Die Konsolenausgabe zeigt denselben Befund wie die
`anmerkung` in `data/generated/disziplin-abnahme.json`: `spirit` (Matrixgewicht 25) trägt **0,0 %**
gemessenen Einfluss, `will` (10) und `awareness` (11) ebenfalls 0,0 %, `stamina` (6) 0,0 %. Die
Mechanik belohnt statt dessen `health` (33,2 % gegen Matrixgewicht 14), `speed` (23 % gegen 0!)
und `power` (17,4 % gegen 6) — exakt das Override-Profil (power/health/speed-schwer,
`spiel-eignung-overrides.ts`), nicht die gesperrte Matrix. **Bestätigt, nicht widerlegt.**

```
Attribut          Anteil   Matrix   Differenz
health            33.2 %     14   +19.2
speed               23 %      0   +23.0
torment           20.1 %     16   +4.1
power             17.4 %      6   +11.4
determination      3.5 %      8   -4.5
dexterity          2.8 %      0   +2.8
intelligence         0 %      0   0.0
charisma             0 %      4   -4.0
will                 0 %     10   -10.0
spirit               0 %     25   -25.0
stamina              0 %      6   -6.0
awareness            0 %     11   -11.0
```

rho (nicht Teil der heutigen Baustelle, aber zur Einordnung mitgemessen,
`node scripts/miss-alle-disziplinen.mjs 48 football`, auf dem unten beschriebenen,
NERVENSTAERKE-Experiment-Stand): 0,805 je Spiel (Median, Spannweite 0,095) / 0,902 Saison
(Spannweite 0,077) — bestanden, deckungsgleich mit der dokumentierten Baseline 0,807/0,902. rho
ist und bleibt nicht das Problem.

## 2. Der Primär-/Nebenweg-Versuch: NERVENSTAERKE

### Idee

CLAUDE.md (21.09.) fragt bei jeder ohnehin anstehenden Rezeptrunde: lässt sich ein zusätzlicher,
schlechter gestellter Nebenweg einbauen, statt ein Attribut komplett auszuschließen? Für Football
naheliegend: ein **rein additiver** neunter Sub-Skill `NERVENSTAERKE` (wie `LAUFTEMPO` kein
"fachlicher" Sub-Skill, der irgendeine Spielwahrscheinlichkeit zieht — er wird nirgends per
`fkLos()` gelost) aus genau den fünf Attributen, die im Override am stärksten unterrepräsentiert
sind (Matrixgewicht minus `BASIS_JE_DISC.football`):

| Attribut | Matrix | Override | Lücke |
|---|---:|---:|---:|
| spirit | 25 | 3 | 22 |
| will | 10 | 3 | 7 |
| torment | 16 | 12 | 4 |
| charisma | 4 | 0 | 4 |
| awareness | 11 | 8 | 3 |

Normiert auf Summe 100: `NERVENSTAERKE = {spirit:55, will:17, torment:10, charisma:10,
awareness:8}`. Gutgeschrieben wird eine kleine, additive Bonuspunktzahl
(`FB_NERVEN_GEWICHT=0.4`, Größenordnung an `assists*0.3`/`checks*0.15` orientiert, nicht an den
großen Yards-Posten) in `feldspielWert()`, und zwar **nur** an den Spieler, der einen 3rd-/4th-
Down-Spielzug tatsächlich konvertiert (neuer erster Versuch oder Touchdown auf Money Down) —
football-plausibel als "Nervenstärke/mentale Härte in der Crunch-Situation". Bewusst **kein**
Eingriff in eine bestehende Wahrscheinlichkeit (Completion/Yards/Sack/Fumble bleiben
bit-identisch) und **keine** Umverteilung von Kredit zwischen Spielern — nur ein zusätzlicher,
kleiner Bonus für denselben Spieler, der den Erfolg ohnehin schon über den Primärweg
(PASSGENAUIGKEIT/LAUFKRAFT) erzielt hat.

### Messung

Gebaut und mit genau dieser einen Änderung gemessen (zwei Pp-Saatströme + rho, alle n=48,
derselbe Lauf wie Abschnitt 1):

| Größe | Baseline (unverändert) | Mit NERVENSTAERKE-Nebenweg |
|---|---:|---:|
| Pp, Saatstrom 0 | 121,0 | **121,2** |
| Pp, Saatstrom 10 000 000 | 120,1 | **119,9** |
| rho je Spiel (Median) | 0,807 | **0,805** |
| rho Saison (Median) | 0,902 | **0,902** |
| spirit-Anteil (Pp-Tabelle) | 0,0 % | **0,0 % / 0,2 %** |

**Ergebnis: keine messbare Wirkung.** Die Pp-Zahl bewegt sich innerhalb der Saatstrom-Streuung
(121,0/120,1 vs. 121,2/119,9 — der Mittelwert ist praktisch identisch, 120,55 vs. 120,55).
`spirit` bleibt bei 0,0 % (Saatstrom 0) bzw. steigt auf 0,2 % (Saatstrom 10 000 000) — eine
Rundungsgröße, keine Bewegung. rho bleibt unverändert innerhalb der Kader-Spannweite (0,095) —
der Kanal ist **rho-sicher**, aber eben deshalb auch **Pp-wirkungslos**.

### Warum das so ausgeht — nicht nur gemessen, auch verstanden

`einflussVon()` hebt ein Attribut bei einem Teilnehmer um +15 und misst den Gewinn in
`feldspielWert()` über 48 Spiele. Ein Spieler mit mittlerer `NERVENSTAERKE` (~50) gewinnt durch
+15 auf `spirit` (55 % Gewicht in `NERVENSTAERKE`) rund +8 Punkte `NERVENSTAERKE` — macht
`0,4 * 8/100 ≈ 0,03` zusätzliche Bonuspunkte, und zwar nur in den (wenigen) Spielen, in denen
genau dieser Spieler auch tatsächlich einen Money-Down-Spielzug konvertiert. Das verschwindet
neben den dominanten Postern der Formel (`passYards/25`, `laufYards/10` — ein einzelner 40-Yard-
Lauf allein ist +4,0; ein Touchdown +6 über `punkte`). Um `spirit` auf einen zweistelligen
Pp-Anteil zu heben (nötig, um die 22-Punkte-Lücke nennenswert zu schließen), müsste
`FB_NERVEN_GEWICHT` um etwa zwei Größenordnungen steigen — der Bonus würde dann pro Conversion
mehr wert sein als ein Touchdown. Das ist kein Nebenweg mehr, sondern ein freistehender
Zahlenwert ohne jede Deckung in Yards/Punkten/Downs — genau der „künstliche Zahlentrick“, den die
Aufgabe ausdrücklich ausschließt, und er würde vermutlich auch rho kosten (dieselbe Mechanik wie
bei den `TEAMGEIST`-spirit- und `PASSSCHUTZ`-awareness-Versuchen unten, nur über einen neuen
Kanal statt eines alten).

### Einordnung gegen die bestehende Historie

Der Football-Rezeptkommentar in `battle-mode.engine.js` (Zeile ~9672 ff.) dokumentiert bereits
mehrere, unabhängig gemessene Versuche, genau diesen fünf Attributen mehr Gewicht zu geben —
alle über bestehende, bereits korridor-gefittete Sub-Skills statt eines neuen additiven Kanals:

- **TEAMGEIST + spirit** (8 %, `health:45,torment:22,speed:25,spirit:8`): rho je Spiel 0,814 →
  0,788 (durchgefallen). Bei 15 % spirit: 0,765.
- **PASSSCHUTZ + awareness** (20→25 %): rho 0,804 (Baseline) → 0,799 (knapp durchgefallen).
- Eine komplett neu gegen die Eignung sondierte Mischung (`health+will+spirit+torment` für
  `ABWEHR_PASS`): rho je Spiel 0,342 — deutlich schlechter als die Lotterie allein.

Der heutige NERVENSTAERKE-Versuch ist die **komplementäre** Probe: ein Kanal, der **nicht** über
eine bestehende Spielwahrscheinlichkeit läuft, bleibt rho-sicher, aber genau deshalb bei einer
football-plausiblen Größenordnung Pp-wirkungslos. Zusammen zeigen beide Versuchsreihen von zwei
verschiedenen Seiten dieselbe Grenze: **der Override (power/health/speed-schwer) und die Matrix
(spirit/torment/awareness-schwer) sind zwei unterschiedliche Vorstellungen davon, was einen guten
Football-Spieler ausmacht — jeder Kanal, der der einen folgt, entfernt sich zwangsläufig von der
anderen.** Das ist keine Kalibrierungslücke, sondern die mathematische Konsequenz von Chris'
eigener, am 05.09./16.09. bestätigter Entscheidung, dass das Minispiel nach dem realistischeren
Override spielen soll, nicht nach der Matrix.

## 3. Ehrliches Stopp-Kriterium — erreicht

Die Aufgabe verlangt, bei diesem Ergebnis zu stoppen: der Nebenweg-Versuch ist ehrlich (keine
Wahrscheinlichkeit angefasst, kein Kredit umverteilt, football-plausibel benannt) und rho-sicher,
aber er hilft nicht einmal ansatzweise (121,2/119,9 gegen 121,0/120,1 — keine Bewegung, kein
Fortschritt im Sinne von Schritt 5 der Aufgabe, der eine deutliche Verbesserung auf <40 Pp oder
besser verlangt, um einen Code-Vorschlag zu rechtfertigen). Der Code für dieses Experiment
(`NERVENSTAERKE`-Rezept, `FB_NERVEN_GEWICHT`, `nervenGutschrift()`) ist **verworfen und nicht
committet** — nur dieses Dokument beschreibt ihn, damit die nächste Runde ihn nicht noch einmal
baut, um dasselbe Nullergebnis zu reproduzieren.

## 4. Optionen für Chris

**A — Pp-Ausnahmestatus für Football, analog zur Mini-DM-Star-/Paar-Ausnahme bei rho.**
CLAUDE.md erlaubt für rho bereits eine ehrlichere Abnahme jenseits der nackten Zahl (Star auf
Rang 1, Paartreue mit Abstand), weil manche Paare "kein Motor der Welt" richtig ordnen kann.
Football hat mit dem Override dieselbe Struktur: die Pp-Pflichtprüfung misst zu Recht gegen die
gesperrte Matrix, aber Football ist (seit PR #934, mit Chris' ausdrücklicher Zustimmung) die
einzige Disziplin, deren **Spiel-Ordnung bewusst von der Anzeige-/Kauf-Ordnung abweicht** — die
121-Pp-Zahl ist dann kein Kalibrierungsfehler, sondern die gemessene Größe genau dieser
Abweichung. Ein dokumentierter Ausnahmestatus ("Football: Pp wird ausgewiesen, zählt aber nicht
gegen die 25-Pp-Schranke, solange der Override in Kraft ist") würde das ehrlich machen, ohne die
Matrix anzufassen oder den Override zu verwässern. Nachteil: eine zweite, Football-eigene
Sonderregel neben dem Override selbst.

**B — Moderate Override-Anpassung mit benanntem Realismus-Tradeoff.** Der Override selbst
(`spiel-eignung-overrides.ts`, football-Block) könnte spirit/will/awareness von 3/3/8 auf etwas
wie 8/8/12 anheben (auf Kosten von power/health), OHNE die Matrix anzufassen — das würde Pp senken
(weniger Lücke zwischen Override und Matrix), aber nur, wenn die Mechanik (`feldspielWert`,
Rezept) diese Verschiebung auch tatsächlich durchreicht, was nach der obigen Messreihe wieder
dieselbe rho-Rechnung aufmacht: ein ehrlicher Rezept-Umbau in diese Richtung ist exakt das, was
`TEAMGEIST`/`PASSSCHUTZ` bereits gemessen und für durchgefallen erklärt haben. Diese Option ist
also keine kostenlose — sie bedeutet, einen Teil der mit PR #934 bewusst gewählten
Realismus-Position (power/speed-Running-Back statt spirit-Running-Back) aufzugeben, in einem
noch zu bestimmenden Ausmaß, gegen eine noch zu bestimmende Pp-Verbesserung. Ohne neue
Kalibrierungsrunde (mit offenem Ausgang) lässt sich der Tradeoff nicht genauer benennen, als die
bereits gemessenen Einzelversuche es tun (einige Prozentpunkte Pp gegen mehrere Hundertstel rho).

**C — Matrix-Override-Mix neu verhandeln.** Statt "Override ODER Matrix" ein gewichteter
Mittelweg (z. B. 70 % Override / 30 % Matrix als neue `BASIS_JE_DISC.football`-Quelle) — würde Pp
automatisch senken (die Lücke wird kleiner), weil die PP-Pflichtprüfung ja genau gegen die Matrix
rechnet. Das ist technisch die einfachste Stellschraube, braucht aber Chris' ausdrückliche
Zustimmung wie Weg A/B der ursprünglichen Matrix-Entscheidung (16.09.) — sie verändert dieselbe
Design-Frage, die damals schon einmal entschieden wurde ("ein Running Back, dessen Lauf-Eignung
zu 56 % aus Geist kommt" vs. "Power 6 Pp in der Matrix"), nur an einer anderen Stelle (Override
statt Matrix). Realismus-Tradeoff symmetrisch zu Option B, nur andersherum: mehr Matrix-Einfluss
heißt mehr spirit/torment-Gewicht im tatsächlichen Spiel, mit demselben erwartbaren rho-Risiko.

**Keine der drei Optionen ist eine Implementierungsaufgabe für diese Runde** — jede braucht
Chris' Entscheidung, welchen Tradeoff er eingehen will, genau wie die ursprüngliche
Matrix-Entscheidung vom 16.09. Bis dahin bleibt Football außerhalb der Pp-Pflichtabnahme, mit der
121,0/120,1-Zahl als ehrlich ausgewiesenem, verstandenem (nicht verschwiegenem) Blocker.

## Quellen

- `data/generated/disziplin-abnahme.json`, Eintrag `football` (Korrektur 25.10., Task #196).
- `docs/design/football-matrix-entscheidung.md` (16.09., Chris' Override-Zustimmung).
- `lib/player-generator/spiel-eignung-overrides.ts` (football-Block).
- `lib/player-generator/official-discipline-weights.ts` (gesperrte Matrix, unverändert).
- `public/mockups/battle-mode.engine.js`, Football-Rezeptkommentar (Zeile ~9672 ff., TEAMGEIST-/
  PASSSCHUTZ-Historie) und `BASIS_JE_DISC`/`PP_MATRIX_JE_DISC` (Zeile ~7997/8037).
- Eigene Messungen dieser Runde (14.11.): `node scripts/messe-arena-einfluss.mjs football 48`
  (+ `--saat-versatz=10000000`), `node scripts/miss-alle-disziplinen.mjs 48 football` — auf dem
  NERVENSTAERKE-Experimentstand, danach verworfen (nicht committet).
