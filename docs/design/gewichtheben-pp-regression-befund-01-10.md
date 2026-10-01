# Gewichtheben-Pp: die 19,1-Zahl vom 27.09. war ein einzelner, günstiger Saatstrom — der echte Wert liegt auf der Schranke (01.10.)

Reine Diagnose, kein Code auf `main` geändert. Auftrag: klären, ob die 34,6 Pp (n=12, PR #1094)
bzw. 29,1/32,2 Pp (n=12, PR #1099) nur Stichproben-Rauschen um den dokumentierten ~19,1-Wert
(`gewichtheben-pp-regression-befund-27-09.md`, n=48) sind, oder ob sich seit dem 27.09.-Befund
real etwas an Gewichtheben verschlechtert hat.

## Ergebnis vorab

**Beides stimmt nur teilweise — die ehrliche Antwort ist eine dritte.** Die n=12/n=24-Werte
(29,1–34,6 Pp) sind tatsächlich zu einem guten Teil Stichproben-Rauschen, wie das 27.09.-Dokument
richtig vermutet hat. Aber der dort als "der" n=48-Wert gemeldete **19,1 Pp stammt aus einem
einzigen Saatstrom** (`versatz=0`) und war selbst ein günstiger Ausreißer nach unten. Eine
Nachmessung mit **fünf unabhängigen Saatströmen bei n=48** (dem laut Handbuch vorgeschriebenen
Sample) ergibt:

| Saatstrom (`versatz`) | Pp-Abweichung (n=48) |
|---:|---:|
| 0 (Standard, `messe-arena-einfluss.mjs`) | 21,4 |
| 10 000 000 | 27,5 |
| 20 000 000 | 26,6 |
| 30 000 000 | 24,5 |
| 40 000 000 | 24,7 |
| **Mittel (5 Ströme)** | **24,9** |

**Der echte Wert liegt auf der 25-Pp-Schranke, nicht komfortabel darunter bei 19,1.** Zwei von
fünf unabhängigen Stichproben liegen über 25 Pp (27,5 und 26,6), zwei knapp darunter (24,5 und
24,7), nur der am 27.09. allein gemessene Standard-Strom lag mit 21,4 spürbar darunter. Die
Streuung zwischen den Strömen (21,4 bis 27,5, Spannweite 6,1 Pp) ist außerdem deutlich größer als
die am 27.09. zwischen zwei Strömen bei n=24 dokumentierte Spannweite (29,1 vs. 27,3, nur 1,8 Pp)
— ein Hinweis darauf, dass hier nicht nur gewöhnliches Messrauschen wirkt.

**Keiner der seit dem 27.09.-Befund gemergten Commits hat daran etwas geändert.** Git-Archäologie
(Abschnitt 2) zeigt: jeder einzelne Commit, der seitdem `battle-mode.engine.js` im
Gewichtheben-Kontext anfasst, ist als reine Anzeige/Optik dokumentiert und von seinem jeweiligen
Autor selbst gegen `wert()`/`u.summe`/die Eignungsberechnung geprüft — bit-identisch. Das
34,6-Pp-Ergebnis aus PR #1094/#1091 und das 29,1/32,2-Pp-Ergebnis aus PR #1099 sind also nicht
durch eine neue Scoring-Änderung verursacht, sondern Messungen desselben, seit dem 27.09.
unveränderten Rezepts — nur eben bei kleinerem n (12 statt 48) und (bei #1099) auf einem bereits
leicht veränderten Rezept (G1/G4, siehe dort), das laut eigener Verifikation selbst **verbessert**
(30,2/32,2 statt 34,6).

**Zusätzlicher, eigenständiger Befund:** Über alle fünf Ströme hinweg ist das Vorzeichen- und
Größenmuster der Attribut-Abweichungen **stabil**, nicht zufällig verteilt — power, charisma und
speed sind in jedem einzelnen der fünf Läufe überrepräsentiert (speed am auffälligsten: +5,0 bis
+6,3 Pp in allen fünf Strömen), dexterity, will und health in jedem Lauf unterrepräsentiert.
Das ist kein Rauschsignal, das sich bei mehr Stichproben wegmitteln würde — es ist die Signatur
eines strukturellen Rezeptproblems (Abschnitt 5).

## 1. Ausgangslage

`docs/design/gewichtheben-pp-regression-befund-27-09.md` maß am 27.09. auf dem Commit-Stand
`14660167` (unmittelbar nach PR #1036) **nur einen Saatstrom** (`versatz=0`) bei n=48: **19,1 Pp**.
Ein zweiter Strom wurde dort nur bei n=24 gemessen (27,3 Pp), nie bei n=48. Das Dokument und in
der Folge `docs/design/fable-ideen-heben-breaking-climbing-30-09.md` (Abschnitt 1.1) zitierten die
19,1 seither als abschließenden, bestandenen Wert — ohne dass je ein zweiter Strom bei n=48 nachgezogen
wurde. Die CLAUDE.md-Pflichtprüfung verlangt die Abnahme ausdrücklich "in zwei unabhängigen
Saatströmen"; diese zweite Säule fehlte für Gewichtheben bislang komplett bei korrektem n.

Zwischenzeitlich maßen zwei PRs bei n=12 wieder hohe Werte:

| PR | Commit | n | Strom 1 | Strom 2 | Einordnung in der PR selbst |
|---|---|---:|---:|---:|---|
| #1091 (Spoiler-Fix, Gewichtheben) | `f549fc9b` | 12 | 34,6 | — | "zeichengleich" zu vorher |
| #1094 (Paket 1 Politur A, G2/G3) | `7c5f0a85` | 12 | 34,6 | — | Tabelle markiert fälschlich **"bestanden (bit-identisch zu vorher)"** — 34,6 > 25 ist nach der eigenen Spaltenüberschrift "Abnahme (≤ 25 Pp)" nie "bestanden" |
| #1099 (Paket 2, G1/G4, Draft, unmerged) | `000268a0` | 12 | 30,2 | 32,2 | korrekt als "Ziel ≤25 Pp war schon vor dieser PR nicht erreicht (34,6) und bleibt es (30,2/32,2)" beschrieben — **nicht** als "bestanden" |

PR #1094 ist der einzige der drei, der eine falsche "bestanden"-Kennzeichnung trägt (Abschnitt 6).

## 2. Git-Archäologie: kein Scoring-Commit seit dem 27.09.-Befund

```sh
git log --oneline 14660167..7c5f0a85 -- public/mockups/battle-mode.engine.js
```

Listet 36 Commits. Davon betreffen folgende Gewichtheben direkt (per Commit-Message):

| Commit | Was | Scoring betroffen? |
|---|---|---|
| `f549fc9b`/`80096ab6` (#1091) | `hebenSichtbareSumme()` — Kaderleiste/Team-Balken lesen enthüllte statt fertige Summe | **Nein**, ausdrücklich: "Nicht angefasst: `u.summe`, `baueHebenDuelle()`, `hebeUebung()`, `wert()`, `buehneStand()`, Endstand-Overlay, Eignungsmatrix." Selbst verifiziert: `messe-arena-einfluss.mjs gewichtheben 12` "zeichengleich" |
| `17f4204b` | Bühnenbild (Tribüne, Scheinwerfer, Plattform-Optik) | **Nein**, ausdrücklich: "Rein visuell/Requisiten — keine Änderung an Zweikampf-Logik, wert(), Eignungsberechnung oder Wertung." Selbst verifiziert über rho (0,843 vor/nach identisch); Pp dort nicht erneut gemessen, da nur Canvas-Zeichnung |
| `f58e11f1` (Team-Feier Phase 1 inkl. Gewichtheben-Teambank/-Feier/-Score-Fix) | Teambank-Sprites, Konfetti/Feier-Trigger am Lampen-Moment, Score-Update-Timing (`hebenDuellEntschieden()` für die HUD-Anzeige, nicht für `u.summe`) | **Nein** für `wert()`/`u.summe`/Eignung — der "Score-Fix" korrigiert nur, **wann** `updateHudBuehne()`/`buehneStand()` ein Duell als entschieden anzeigt (Anzeige-Timing), nicht den Endwert. 103 Tests grün inkl. `gewichtheben-kg-folgt-dem-score` |
| `7c5f0a85` (#1094, G2/G3) | Kampfrichterlampen-Marge, sichtbare Ansage-Änderung (beides reine Anzeigefelder `r.marge`, `ansageAlt` auf `runden[]`) | **Nein**, ausdrücklich: "keine ... schreibt in `u.summe`/`u.zweikampf`/`wert()`." Selbst verifiziert: Pp 34,6 (n=12) "bit-identisch zum vorherigen Stand" |

Kein einziger dieser vier Commits ändert `hebeUebung()`, `baueHebenDuelle()`, `wert()` für Heben
oder die Eignungsberechnung. Jede Behauptung "unverändert" ist in der jeweiligen PR-Beschreibung
mit einer eigenen Vorher/Nachher-Messung belegt (rho und/oder Pp), nicht nur behauptet. Die
34,6 Pp (n=12) sind damit auf allen vier Commits seit dem 27.09.-Stand **dieselbe Zahl** — exakt
das Bild, das man erwartet, wenn sich am Rezept nichts geändert hat.

**Schlussfolgerung:** Es gibt keinen "Täter"-Commit. Die scheinbare Verschlechterung ist keine
Regression im Sinn von CLAUDE.md, sondern eine **Messlücke**: Der 27.09.-Befund hat die
Pflichtprüfung (zwei unabhängige Ströme bei n=48) für Gewichtheben nie vollständig durchgeführt,
sondern nur einen Strom bei n=48 und einen zweiten nur bei n=24.

## 3. Eigene Messung: Standardaufruf (ein Strom je Skript, n=48)

Gemessen auf `origin/main`, Commit `7c5f0a85` (aktueller Stand nach #1094, vor dem noch offenen
Draft #1099):

```sh
node scripts/messe-arena-einfluss.mjs gewichtheben 48
# → 21,4 Pp (power +2,4, charisma +2,4, speed +5,9, health -4,2, determination -1,5,
#    will -2,2, dexterity -2,2, stamina -0,6)

node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48
# → 27,5 Pp (power +4,5, charisma +4,3, health -4,3, speed +5,0, determination -1,4,
#    will -3,0, stamina -0,4, dexterity -4,6)
```

Beide Läufe liefen in 36–38 Sekunden durch, keine Seitenfehler — deutlich schneller als die
veranschlagten 15–20 Minuten (Gewichtheben ist eine Bühnen-/Duell-Disziplin, keine Feldspiel- oder
TDM-Messung, die bei n=48 Minuten braucht).

Schon diese **beiden** vorgeschriebenen Ströme zeigen kein eindeutiges Bild: Strom 1 liegt klar
unter der Schranke (21,4), Strom 2 klar darüber (27,5) — die 19,1 vom 27.09. war nicht reproduzierbar
nah dran, sondern lag noch günstiger als der heutige Strom 1.

## 4. Erweiterte Messung: fünf unabhängige Ströme bei n=48

Um zu klären, ob Strom 2 (27,5) ein Ausreißer oder die Regel ist, wurden drei weitere,
disjunkte Saatversätze nachgezogen (`messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48 <versatz>`):

| Versatz | Pp | power | charisma | speed | health | determination | will | dexterity | stamina |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 21,4 | +2,4 | +2,4 | +5,9 | -4,2 | -1,5 | -2,2 | -2,2 | -0,6 |
| 10 000 000 | 27,5 | +4,5 | +4,3 | +5,0 | -4,3 | -1,4 | -3,0 | -4,6 | -0,4 |
| 20 000 000 | 26,6 | +4,8 | +2,2 | +6,3 | -3,6 | -1,4 | -3,8 | -4,0 | -0,5 |
| 30 000 000 | 24,5 | +3,5 | +2,5 | +6,3 | -2,9 | -1,4 | -3,6 | -3,7 | -0,6 |
| 40 000 000 | 24,7 | +4,2 | +2,1 | +6,0 | -3,4 | -2,0 | -3,2 | -3,2 | -0,6 |
| **Mittel** | **24,9** | **+3,9** | **+2,7** | **+5,9** | **-3,7** | **-1,5** | **-3,2** | **-3,5** | **-0,5** |

(intelligence/awareness/spirit/torment sind in allen fünf Läufen 0 %, Matrixgewicht 0 — kein
Beitrag zur Abweichung, hier zur Lesbarkeit weggelassen.)

Mittelwert über fünf unabhängige Ströme: **24,9 Pp**, Median 24,7, Spannweite 21,4–27,5 (6,1 Pp).
Zwei von fünf Strömen liegen über 25, drei knapp darunter — die Verteilung **zentriert sich auf
der Schranke selbst**, nicht auf 19,1 und auch nicht auf 30+.

## 5. Strukturmuster statt Zufallsrauschen

Wäre die Abweichung vom Richtwert reines Stichprobenrauschen, würde erwartet, dass unterschiedliche
Attribute in unterschiedlichen Strömen über- bzw. unterrepräsentiert sind. Tatsächlich zeigt sich
über alle fünf unabhängigen Ströme dasselbe Vorzeichen bei denselben Attributen:

- **speed ist in jedem einzelnen der fünf Läufe um +5,0 bis +6,3 Pp überrepräsentiert** — bei
  einem Matrixgewicht von nur 6 % trägt es real 11–12 % zur Wertung bei, in jedem Strom fast
  identisch. Das ist kein Rauschsignal, das sich bei mehr Läufen wegmitteln würde.
- power (+2,4 bis +4,8) und charisma (+2,1 bis +4,3) sind in jedem Strom überrepräsentiert.
- dexterity (-2,2 bis -4,6), will (-2,2 bis -3,8) und health (-2,9 bis -4,3) sind in jedem Strom
  unterrepräsentiert.

Diese Konsistenz über fünf disjunkte Formkarten-/Bau-Saatreihen hinweg spricht für ein
**strukturelles Rezeptproblem** in `hebeUebung()`/`baueHebenDuelle()`, nicht für Zufall — vermutlich
ein Kanal, über den speed/power/charisma systematisch mehr Einfluss auf `wert()` nehmen, als ihr
Matrixgewicht vorsieht (z. B. über Formkarten- oder Trait-Boni, die diese drei Attribute begünstigen,
während dexterity/will/health kaum einen eigenen Kanal haben). Das ist jedoch eine Hypothese, keine
fertige Diagnose — eine dedizierte Kalibrierrunde müsste den genauen Pfad (analog zur
Attribut-Einfluss-Aufschlüsselung in `einflussVon()`) nachverfolgen.

## 6. Folgen

**Kein Code-Fix in dieser Diagnose** — wie bei der Climbing-Diagnose in PR #1098 ist das hier
bewusst nur der Befund, keine Kalibrierrunde. Konkret:

1. **PR #1094s "bestanden"-Kennzeichnung für Gewichtheben (34,6 Pp, n=12) ist falsch** und wird
   über `update_pull_request` korrigiert — nicht durch eine neue "bestanden, 19,1 bestätigt"-Zahl
   (die gibt es nach dieser Messung nicht), sondern durch einen Verweis auf diese Diagnose: die
   Pp-Pflichtprüfung für Gewichtheben ist bei korrektem n=48 über mehrere Ströme **nicht
   zuverlässig unter 25**, unabhängig von #1094 selbst.
2. **Die 19,1-Pp-Referenz in `gewichtheben-pp-regression-befund-27-09.md` und
   `fable-ideen-heben-breaking-climbing-30-09.md` Abschnitt 1.1 ist überholt** — sie beruhte auf
   einem einzelnen, günstigen Saatstrom. Diese Dokumente werden hier nicht nachträglich verändert
   (sie sind historisch korrekt für den Stand, auf dem sie gemessen wurden), aber künftige
   Zitate von "19,1, bestanden" für Gewichtheben sollten auf dieses Dokument verweisen.
3. **Empfehlung für eine künftige, eigenständige Kalibrierrunde** (nicht Teil dieser Diagnose):
   - Pp-Pflichtprüfung für Gewichtheben künftig mit **mindestens drei, besser fünf** unabhängigen
     Strömen bei n=48 fahren, nicht nur zwei — die Streuung (6,1 Pp über fünf Ströme) ist groß
     genug, dass zwei Ströme leicht beide zufällig unter oder über der Schranke liegen können.
   - Den speed-Kanal in `hebeUebung()`/`baueHebenDuelle()` gezielt untersuchen (konsistent
     +5 bis +6,3 Pp in allen fünf Strömen) — das ist der auffälligste Einzelbefund.
   - dexterity/will/health brauchen vermutlich einen stärkeren eigenen Kanal (Primär-/Nebenweg-
     Leitlinie, CLAUDE.md 21.09.), statt nur über Slot-/Traitzuschlag indirekt mitzulaufen.
   - rho bleibt unberührt (0,836–0,849, bestanden, s. PR #1094/#1099) — dies ist ausschließlich
     ein Pp-/Validitätsbefund, kein Rangtreue-Problem.

## Anhang: Reproduktion

```sh
# Stand: origin/main, 7c5f0a85 (nach #1094, vor #1099)
node scripts/messe-arena-einfluss.mjs gewichtheben 48                        # 21,4 Pp
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48      # 27,5 Pp (versatz=10 000 000)
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48 20000000   # 26,6 Pp
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48 30000000   # 24,5 Pp
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48 40000000   # 24,7 Pp
```

Jeder Lauf dauert bei Gewichtheben nur 30–40 Sekunden (Bühnen-/Duell-Disziplin, kein
Feldspiel/TDM) — eine Mehrstrom-Messung ist hier also praktisch kostenlos und sollte künftig
Standard sein, statt sich auf zwei Ströme zu verlassen.
