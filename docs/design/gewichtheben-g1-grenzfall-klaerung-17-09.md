# Gewichtheben und die 0,85-Kante: 0,843 oder 0,851? (17.09.)

Auftrag: Chris, „Gewichtheben mit Fable klären". Es geht um Abschnitt 3.1 des Opus-Plans
`docs/pm-briefings/opus-plan-top-zehn-ueber-90-16-09.md` und die Zeile 2 der Scorecard
`docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md`: Gewichtheben steht bei
Gameplay 90 statt 95, weil rho kaderfest bei n=24 **0,843** liefert und die G1-Regel in
Abschnitt 0 der Scorecard eine Treppe mit einer Stufe bei 0,85 ist (≥0,85 → 40 Punkte, 0,80–0,85
→ 35). Bei n=48 kommt **0,851** heraus, das Vorzeichen der Frage „über 0,85?" kippt mit der
Stichprobengröße.

Reine Recherche und Messung. **Kein Produktionscode, keine Scorecard-Änderung, nichts
committet** — die Entscheidung gehört Chris, und sie steht in Abschnitt 5.

## Kurzfassung

1. Beide Zahlen sind reproduziert, bit-identisch. Sie messen **dieselbe Größe** — n=48 ist kein
   „genaueres Verfahren", sondern enthält die 24 Spiele von n=24 als erste Hälfte plus 24 weitere,
   und die zweite Hälfte liefert für sich 0,858.
2. Über **288 Spiele je Kader-Variante** (zwölf unabhängige 24er-Blöcke, der erste ist die
   Standardmessung) streut der Median mit SD **0,011** um **0,847**; fünf der zwölf Blöcke liegen
   über 0,85, sieben darunter. Der Wert über alle 288 Spiele ist **0,844**. Das ist Rauschen um
   einen wahren Wert **knapp unter der Kante**, kein Trend mit n.
3. **Kein realistisches n entscheidet diese Frage.** Für eine 2-Sigma-Aussage bei 0,005 Abstand
   bräuchte es rund 900 Spiele je Variante — und selbst dann würde eine Treppe aus 0,001
   Unterschied fünf Punkte machen.
4. **Wettessen** (Scorecard-Zeile 18, rho 0,845, ebenfalls G1 35) ist der Spiegelfall: sein
   Standard-Block ist der **niedrigste von zwölf**, der wahre Wert liegt bei ≈0,885, elf von zwölf
   Blöcken stehen über 0,85. Es ist heute eine Stufe **zu tief** eingestuft, und niemand hat es
   bemerkt. Das Problem ist die Treppe, nicht Gewichtheben.
5. **Empfehlung:** (i) Die 90 bleibt heute stehen — das Standardverfahren sagt 0,843, der wahre
   Wert liegt unter 0,85, und den n=48-Wert zu nehmen hieße, die Stichprobe nach dem Ergebnis zu
   wählen. (ii) Die G1-Treppe in der Scorecard durch eine **stückweise lineare Interpolation
   zwischen den bestehenden Stufenpunkten** ersetzen; dann steht Gewichtheben bei Gameplay 94,
   Gesamt 98,6, und die Klasse „fünf Punkte für 0,007 Wackeln" ist für alle zwanzig erledigt.
   (iii) n **nicht** ändern — weder für alle noch gezielt für Gewichtheben.

---

## 1. Reproduktion

Beide Aufrufe auf `main` @ `91b17c3a`, echte live-save-Kaderfamilie (fünf Team-Paarungen):

```
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben
gewichtheben  buehne  12   0.843   Spannweite 0.208   Saison 0.930   Spannweite 0.280   bestanden

node scripts/miss-alle-disziplinen.mjs 48 gewichtheben
gewichtheben  buehne  12   0.851   Spannweite 0.187   Saison 0.937   Spannweite 0.266   bestanden
```

Ziffernidentisch zur Scorecard (0,843) und zum Opus-Plan (0,851). Die Messung ist deterministisch
(feste Saaten, feste Kader), ein Wiederholungslauf ändert nichts — die Streuung, um die es hier
geht, sitzt nicht zwischen zwei Läufen, sondern **zwischen der gewählten Saatenfolge und jeder
anderen**.

## 2. Was die Zahl ist — und warum n=48 nichts anderes misst

### 2.1 n=48 enthält n=24

`disziplinProbe` (`public/mockups/battle-mode.engine.js:29281`) zieht Spiel `i` mit
`M.bau(saat0 + i·schritt)` und `zieheFormkarten(20260823 + i·104729)`, Standard `saat0=1337`,
`schritt=7919`. Spiel `i` ist damit bei jedem n dasselbe Spiel. n=48 ist also die Standardmessung
plus 24 weitere Spiele, nicht eine andere Messung. Die Sonde nimmt `saat0`/`schritt` als Option
entgegen, `miss-alle-disziplinen.mjs` reicht sie nur nicht durch — für diese Klärung habe ich die
Sonde deshalb direkt aufgerufen (`window.__arena.disziplinProbe("gewichtheben", {n:288,
kaderFamilie, saat0:1337, schritt:7919})`) und die 288 Spiele je Variante nachträglich in Blöcke
geschnitten. Block 0 der 24er-Schnitte ist bit-identisch die Standardmessung, Block 0 der
48er-Schnitte bit-identisch der Opus-Wert — die Methode ist damit gegen die beiden bekannten Zahlen
verankert.

### 2.2 Zwölf unabhängige 24er-Blöcke

Je Zeile der Median über die fünf Kader-Varianten (die Zahl, die die Scorecard führt), in
Klammern die fünf Varianten in der Reihenfolge vigilante / coldsteel / goldengladiators /
mortalsin / piratecrew:

| Block (Saaten) | Median | Spannweite | Varianten | Stufe |
|---|---:|---:|---|---|
| 0 (= Standard) | **0,843** | 0,208 | 0,927 0,842 0,878 0,843 0,719 | 0,80–0,85 |
| 1 | 0,858 | 0,165 | 0,934 0,853 0,870 0,858 0,770 | ≥0,85 |
| 2 | 0,839 | 0,184 | 0,941 0,839 0,875 0,813 0,757 | 0,80–0,85 |
| 3 | 0,856 | 0,180 | 0,924 0,856 0,878 0,841 0,744 | ≥0,85 |
| 4 | 0,854 | 0,185 | 0,941 0,833 0,886 0,854 0,756 | ≥0,85 |
| 5 | 0,848 | 0,220 | 0,936 0,836 0,883 0,848 0,716 | 0,80–0,85 |
| 6 | 0,822 | 0,123 | 0,882 0,822 0,840 0,806 0,759 | 0,80–0,85 |
| 7 | 0,832 | 0,134 | 0,906 0,832 0,886 0,826 0,771 | 0,80–0,85 |
| 8 | 0,858 | 0,181 | 0,937 0,862 0,858 0,841 0,756 | ≥0,85 |
| 9 | 0,848 | 0,175 | 0,911 0,848 0,867 0,848 0,736 | 0,80–0,85 |
| 10 | 0,849 | 0,197 | 0,943 0,849 0,887 0,847 0,747 | 0,80–0,85 |
| 11 | 0,857 | 0,194 | 0,908 0,857 0,861 0,849 0,714 | ≥0,85 |

**Mittel der zwölf Mediane 0,847, SD 0,011, Spanne 0,822–0,858, über 0,85 in 5 von 12.**

Dieselben 288 Spiele in größeren Blöcken:

| Blockgröße | Blöcke | Mediane | Mittel | SD | ≥0,85 |
|---|---:|---|---:|---:|---|
| 24 | 12 | s. o. | 0,847 | 0,011 | 5/12 |
| 48 | 6 | 0,851 · 0,847 · 0,851 · 0,827 · 0,855 · 0,853 | 0,847 | 0,010 | 4/6 |
| 96 | 3 | 0,848 · 0,834 · 0,854 | 0,845 | 0,010 | 1/3 |
| 288 | 1 | **0,844** (Varianten 0,924 0,844 0,872 0,840 0,745) | — | — | 0/1 |

Kein Trend: das Mittel bleibt bei 0,845–0,847, egal wie groß der Block ist. Was mit n schrumpft,
ist allein die Streuung *einer* Messung um dieses Mittel — und die schrumpft langsam (je Variante
SD je Spiel 0,064–0,099, also Standardfehler des 24er-Mittels 0,013–0,020, des 48er-Mittels
0,009–0,014). Der Abstand des wahren Werts zur Kante ist 0,005: **bei n=24 wie bei n=48 ist die
Frage „über 0,85?" ein Münzwurf.** Für eine 2-Sigma-Antwort bei 0,005 Abstand müsste der
Standardfehler auf 0,0025 fallen, das sind rund (0,075/0,0025)² ≈ **900 Spiele je Variante** —
und das Ergebnis wäre dann mit hoher Wahrscheinlichkeit „knapp darunter".

### 2.3 Die Gegenprobe: Wettessen

Wettessen steht in der Scorecard mit rho **0,845** ebenfalls in der 0,80–0,85-Stufe (Zeile 18,
G1 35, Gameplay 95). Derselbe Lauf, 288 Spiele je Variante:

| | Wettessen |
|---|---|
| Block 0 (= Standardmessung) | **0,845** — der **niedrigste** aller zwölf 24er-Blöcke |
| zwölf 24er-Blöcke | Mittel 0,881, SD 0,018, Spanne 0,845–0,903, **≥0,85 in 11 von 12** |
| sechs 48er-Blöcke | 0,875–0,897, ≥0,85 in 6 von 6 |
| alle 288 Spiele | **0,888** |

Wettessen liegt in Wahrheit klar in der ≥0,85-Stufe und steht seit dem 10.09. eine Stufe zu tief,
weil die eine feste Saatenfolge dort ungünstig fiel. Das ist kein Vorwurf an die Messung — sie tut
genau, was sie soll, sie ist reproduzierbar — sondern der Beleg, dass **eine Treppe mit Stufen im
Abstand von einer Standardabweichung** die Zeilen nach Losglück sortiert, nach oben wie nach unten.
Gewichtheben ist nur der Fall, bei dem es jemand gesehen hat.

### 2.4 Zu CLAUDE.md „Mehr Ereignisse helfen fast nie"

Der Satz bezieht sich auf Ereignisse **innerhalb eines Spiels** (Spielzeit, Verlässlichkeit): bei
Hockey mit verdoppelter Spielzeit blieb rho je Spiel flach, weil die Mechanik das Falsche mit dem
Richtigen vermischt. Die Zahl n in `miss-alle-disziplinen.mjs` ist etwas anderes — die **Zahl der
Stichproben-Spiele**, über die derselbe rho-je-Spiel-Wert gemittelt wird. Ein größeres n macht
das Spiel nicht länger und die Mechanik nicht anders; es macht nur die Schätzung dieses Werts
glatter. Beide Warnungen gelten daher zugleich: mehr Spielzeit hebt rho nicht (CLAUDE.md), und
mehr Stichproben-Spiele heben rho auch nicht — sie zeigen nur genauer, wo es liegt. Hier: bei
0,845.

## 3. Ist n=24 als Standard begründet?

**Herkunft.** n=24 ist der Default-Parameter der Sonde (`n=o.n||24`, `:29284`) und seit der
Hockey-Messreihe die Zahl, mit der alle Dokumente arbeiten. Eine Herleitung — aus der Saison, aus
einer Genauigkeitsanforderung, aus dem Rechenbudget — habe ich weder in CLAUDE.md noch in
`messgrundlage-kaderfest.md` gefunden. Einen Bezug zur Saison kann sie nicht haben: im Battle Mode
kommt jede Disziplin **zweimal** je Saison dran (Chris 06.09., `getSeasonDisciplineRepeatCount`),
heute noch einmal; 24 ist keine Saisonzahl, sondern eine Stichprobenzahl. Und bis zum 02.09. war
sie faktisch n=4 (LCG-Fehler in `zieheFormkarten`, `arena-duell-recherche-fable.md` Abschnitt
„Formkarten") — die 24 hat also nie eine Genauigkeitsprüfung durchlaufen.

**Was sie leistet.** Gemessen (Abschnitt 2.2/2.3): der Median über die Kader-Familie streut bei
n=24 mit SD **0,011** (Gewichtheben) bis **0,018** (Wettessen). Das reicht für das, wofür die Zahl
gebaut wurde — die 0,80-Abnahme mit einem Puffer von 0,03 und mehr, und die CI-Schranke, die
nur Bewegungen ab 0,05 melden will. Es reicht **nicht** für eine Stufenkante, die 0,005 vom wahren
Wert entfernt liegt. Das ist aber keine Schwäche von n=24 gegenüber n=48 (SD 0,010), sondern eine
Schwäche jeder Treppe gegenüber jeder Messung mit endlicher Genauigkeit.

**Kosten.** Gewichtheben rechnet alle Versuche beim Aufbau durch und enthüllt sie nur noch:
1440 Spiele (288 × 5 Varianten) in **14 s**. Hockey braucht für 24 Spiele × 5 Varianten **37 s**.
Ein größeres n wäre für die Bühne umsonst, für Feldspiel/Bahn/Arena nicht — der volle
Basislinien-Lauf (heute ~11 min) würde bei n=96 auf rund 45 min gehen und den 30-Minuten-Timeout
des CI-Jobs reißen.

**Fazit zu n:** n=24 ist nicht sorgfältig hergeleitet, aber für seinen Zweck ausreichend, und
kein anderes n löst die Kantenfrage. Was ich **nicht** empfehle, ist ein anderes n **nur für
Gewichtheben** oder **nach Sicht des Ergebnisses** — das wäre die Wahl der Stichprobe nach dem
gewünschten Ausgang, und die Scorecard hätte danach für dieselbe Größe zwei Verfahren.

## 4. Warum Gewichtheben so nah an der Kante hängt — strukturell

Dass der wahre Wert genau bei 0,845 liegt und die Kante bei 0,85, ist Zufall. Dass er **dort
stehen bleibt** und nicht höher, hat einen Grund im Rezept, und den kann man beziffern.

**Die Zerlegung nach CLAUDE.md.** rho(Spiel) = rho(Saison) × √Verlässlichkeit. Gewichtheben:
Saison-rho **0,930** (Median; je Variante 0,80–0,97), Verlässlichkeit je Variante (Spiel/Saison)²
**0,86–0,90**. Zum Vergleich Hockey: Validität 0,874, Verlässlichkeit 0,755. Gewichtheben hat also
die höhere Validität **und** die höhere Verlässlichkeit — die Mechanik belohnt das Richtige, und
sie tut es verlässlicher als jedes Feldspiel. Der Rest ist Würfelrauschen, und das hat eine klar
benennbare Quelle.

**Sechs Würfel je Heber.** Das Ergebnis eines Hebers ist `besteReissen + besteStossen`, je Übung
das beste von drei Versuchen mit Gelingchancen 0,885/0,789/0,587 (Reißen) und 0,908/0,758/0,565
(Stoßen) (`HEBEN_BASIS`, `:13048`), die Versuche liegen je nach Slot-Rolle 2–6 % auseinander
(`HEBEN_ROLLEN`, `:13067`). Ein Heber landet also je Spiel auf einer von wenigen diskreten Stufen
seines Tagesmaximums. Gemessen über 288 Spiele:

| Kader-Variante | rho Spiel | Spanne der Heber-Mittel (kg) | SD je Heber, Spiel zu Spiel (kg) | Abstand benachbarter Heber (kg, Median) |
|---|---:|---:|---:|---:|
| vigilante-armageddon | 0,924 | 200–499 | 21,4 | 12,9 |
| coldsteel-direlegion | 0,844 | 207–411 | 21,8 | 7,5 |
| goldengladiators-silversoldiers | 0,872 | 275–433 | 19,1 | 11,9 |
| mortalsin-natureswrath | 0,840 | 173–413 | 19,1 | 13,3 |
| piratecrew-raginglunatics | 0,745 | 212–430 | 17,7 | 5,9 |

Ein Heber schwankt Spiel zu Spiel um **±18–22 kg**; sein Nachbar in der Rangliste ist im Median
nur **6–13 kg** entfernt. Benachbarte Paare liegen damit innerhalb **einer** Würfelstufe, und
Spearman zählt jedes Paar gleich. Nach Eignungsabstand aufgeschlüsselt (alle 1440 Spiele):

| Eignungsabstand | Anteil aller Paare | richtig geordnet |
|---|---:|---:|
| < 2 Punkte | 9,1 % | **54,3 %** (Münzwurf) |
| 2–5 | 14,0 % | 67,6 % |
| 5–10 | 20,6 % | 79,0 % |
| 10–15 | 16,8 % | 93,2 % |
| ≥ 15 | 39,6 % | **99,3 %** |

Das ist exakt das Muster, das CLAUDE.md für Hockey beschreibt („Paare unter zwei Punkten Abstand
kann kein Motor der Welt ordnen, und sie sollen es auch nicht"). Die ehrlicheren Abnahmezahlen
sehen für Gewichtheben so aus: **der eignungsbeste Heber steht in 69,0 % der Spiele auf Rang 1,
in 87,4 % in den ersten zwei, in 0,07 % auf dem letzten** (Hockey kaderfest: 58 % / 78 % / nie).
Keine dieser Zahlen hängt davon ab, ob rho 0,843 oder 0,851 heißt.

**Die Kader-Familie entscheidet den Median.** Die zwei Varianten, die den Median halten,
coldsteel (0,844 über 288 Spiele) und mortalsin (0,840), sind praktisch gleichauf; welche von
beiden gerade Median ist, wechselt mit den Saaten. Und die Variante mit dem niedrigsten rho
(piratecrew, 0,745) ist genau die mit dem engsten Nachbarabstand (5,9 kg) — dort sitzen zwölf
Heber auf 218 kg Spanne, bei vigilante auf 299. **rho misst hier den Kader, nicht das Rezept**,
so wie `messgrundlage-kaderfest.md` es vorhergesagt hat (Gewichtheben und Spurt: „hier ist selbst
eine Rezeptrunde mit sichtbarem Effekt noch nicht sicher von Zufall zu trennen").

**Was es nicht ist.** Die Nullwertung ist **nicht** der Treiber, obwohl sie der dramatischste
Einzelfall ist: 1,17 % der Heber-Spiele; Spiele mit Nullwertung liegen bei rho 0,795 gegen 0,853
ohne, aber nur in **11 von 1440 Spielen** trifft es einen der drei Eignungsbesten (dann rho 0,494).
Wer rho heben wollte, fände an der Nullwertung nichts — und an den 3–6 %-Sprüngen nur, indem er
sie kleiner macht, was die sechs Slot-Rollen ununterscheidbar machte und dem IWF-Korridor
widerspräche. Die letzte Rezeptrunde, die rho messbar bewegt hat, war `HEBEN_TAGESMAX_ANSAGE_K`
(0,720 → 0,887, 04.09.); seither hat keine Änderung mehr als das Kaderrauschen bewegt, und PR
#907 (−0,011 bei n=24, +0,007 bei n=48) war dafür schon das Beispiel.

**Nebenbefund, außerhalb des Auftrags, aber gemessen:** die echte Saison lost die Spielerzahl je
Seite gleichverteilt aus {2..6} (`buildSeasonPlayerCountByDiscipline`), die Scorecard misst bei 6.
Derselbe Lauf bei n=96, kaderfest: jeSeite 5 → **0,818**, 4 → **0,822**, 3 → **0,778**, 2 →
**0,685** (Spannweite 0,714 — Spearman über vier Punkte ist, wie `gewichtheben-zufriedenstellend.md`
schon festhielt, ein Messartefakt). Die 0,85-Frage stellt sich also nur in einem von fünf
Saison-Losen; bei 3 und 2 je Seite liegt die Disziplin unter der 0,80-Abnahme. Das gehört zu G4
(2–6-Tauglichkeit, Scorecard Abschnitt 3.3 „im Code geschlossen, aber nicht nachgemessen"), nicht
zu G1, und ist ein Thema für sich — hier nur festgehalten, weil es die Frage „welche Zahl ist die
richtige?" relativiert: alle fünf sind echte Spielsituationen.

## 5. Empfehlung

**(1) Heute: die 90 bleibt.** Das Standardverfahren des Projekts (n=24, fünf echte Paarungen,
Median) sagt 0,843, und die lange Messung sagt, dass der wahre Wert bei 0,845 und damit **unter**
0,85 liegt. Die 0,851 bei n=48 ist die günstige Hälfte einer Stichprobe, nicht die bessere Zahl.
Sie in die Scorecard zu übernehmen hieße, für eine Zeile das Verfahren zu wechseln, weil das
Ergebnis gefällt — und dann müsste Wettessen auf dieselbe Art hochgesetzt werden, was
niemand kontrolliert hat. Also: **nicht nachmessen, nicht umschreiben**, solange die Treppe gilt.
Der Preis ist bekannt und klein: 5 Gameplay-Punkte sind 1,25 Punkte im Gesamtwert (97,5 statt
98,75), Gewichtheben bleibt so oder so die bestfertige Disziplin des Projekts.

**(2) Methodik: die Treppe glätten.** G1 in Abschnitt 0 der Scorecard stückweise linear durch die
**bestehenden** Stufenpunkte legen, ohne einen davon zu verschieben:

    rho < 0,50          → 5
    0,50 ≤ rho < 0,70   → 12 + (rho − 0,50) · 50    (12 → 22)
    0,70 ≤ rho < 0,80   → 22 + (rho − 0,70) · 130   (22 → 35)
    0,80 ≤ rho < 0,85   → 35 + (rho − 0,80) · 100   (35 → 40)
    rho ≥ 0,85          → 40

Jede heutige Stufe behält ihren Wert an ihrer Unterkante; darüber steigt er bis zur nächsten. Das
ist die kleinste Änderung, die die Klippen entfernt: eine Bewegung von 0,011 (die gemessene
Messunschärfe) ist dann **1,1 Gameplay-Punkte, 0,3 Gesamtpunkte** — unterhalb der Rundung der
Tabelle — statt 5 bzw. 1,25. Die 0,80-**Abnahme** bleibt davon unberührt: sie lebt in CLAUDE.md,
in `ARENA_RESOLVED_DISCIPLINE_IDS` (G2) und im absoluten CI-Wächter (`rangtreue-stufenwaechter-
16-09.md`), nicht in der G1-Punktzahl. Der Einwand aus dem Opus-Plan („ändert rückwirkend mehrere
Zeilen") stimmt und ist rechenbar — mit den Basislinienwerten vom 16.09.:

| Disziplin | rho | G1 heute | G1 interpoliert | Gameplay | Gesamt |
|---|---:|---:|---:|---:|---:|
| Gewichtheben | 0,843 | 35 | **39,3** | 90 → 94,3 | 97,5 → **98,6** |
| Wettessen | 0,845 | 35 | 39,5 | 95 → 99,5 | 46,3 → 47,4 |
| Climbing | 0,834 | 35 | 38,4 | +3,4 | +0,9 |
| Fechten | 0,826 | 35 | 37,6 | +2,6 | +0,7 |
| Time-Trial | 0,825 | 35 | 37,5 | +2,5 | +0,6 |
| Tennis | 0,825 | 35 | 37,5 | +2,5 | +0,6 |
| Basketball | 0,769 | 22 | 31,0 | +9,0 | +2,2 |
| Football | 0,722 | 22 | 24,9 | +2,9 | +0,7 |
| I-Spy | 0,684 | 12 | 21,2 | +9,2 | +2,3 |
| Hockey | 0,669 | 12 | 20,5 | +8,5 | +2,1 |
| übrige zehn | ≥0,85 bzw. <0,50 | | unverändert | | |

Zehn Zeilen bewegen sich, alle nach oben (die Treppe war eine Untergrenze), der
Projektdurchschnitt um +0,6 auf ≈78,3 %. Keine Zeile wechselt dadurch ihre Aussage — Basketball
und Hockey bleiben die von Chris abgenommenen Ausnahmen, die Arena-Disziplinen bleiben unten.
Folgeänderung, klein: die G1-Stufenwarnung in `pruefe-rangtreue-schranke.mjs` (Info, kein
CI-Abbruch) meldet Stufenwechsel; mit Interpolation gäbe es keine Stufen mehr, die Warnung würde
zu „G1-Punkte bewegen sich um mehr als X" oder entfiele. Das ist eine Zeile Skript, kein
Produktionscode.

Warum Interpolation und nicht eine Hysterese („Stufenwechsel erst, wenn die Kante um mehr als die
Messunschärfe überschritten ist")? Hysterese braucht je Disziplin eine bekannte Unschärfe (für
zwei von zwanzig habe ich sie jetzt), macht die Zeile von ihrer Geschichte abhängig und hätte
Wettessen trotzdem falsch stehen lassen. Interpolation braucht nichts Neues und ist an jeder Kante
gleich ehrlich.

**(3) n nicht ändern.** Nicht auf 48 für alle (verdoppelt die CI-Kosten, löst die Kante nicht,
Abschnitt 2.2), nicht auf 48 für die Bühne allein (zwei Verfahren für eine Größe), nicht auf 48
für Gewichtheben (Stichprobenwahl nach Ergebnis). Falls Chris die Zahlen grundsätzlich glatter
haben will — eine legitime, separate Entscheidung —, dann **für alle zwanzig gleich**, zusammen
mit einem Neubau der Basislinie (`baue-rangtreue-basislinie.mjs`) und einer Anhebung des
CI-Timeouts, und **bevor** jemand weiß, welche Zeile davon profitiert. Ein `--saat0=`-Schalter in
`miss-alle-disziplinen.mjs`, der die Blockmethode aus Abschnitt 2 ohne Umweg über die Sonde
fahrbar macht, wäre dafür die passende kleine Ergänzung; gebaut habe ich ihn nicht, weil dieser
Auftrag eine Klärung war und keine Bauaufgabe.

**Was ich Chris konkret raten würde, in einem Satz:** die 90 heute stehen lassen, die Treppe in
der Scorecard durch die Interpolation oben ersetzen (dann 94/98,6), Wettessen dabei gleich mit
geradeziehen, und die Zahl n in Ruhe lassen.

## 6. Was geprüft wurde, was nicht

- Beide Standardaufrufe (n=24, n=48) frisch gefahren, ziffernidentisch zu Scorecard und Opus-Plan.
- 288 Spiele je Variante für Gewichtheben und Wettessen über `window.__arena.disziplinProbe` mit
  den Standardsaaten; Block 0 der Schnitte reproduziert beide Standardzahlen bit-identisch
  (Verankerung der Methode). Zerlegung in Blöcke, Verlässlichkeit, Star-Rang, Paartreue und
  kg-Streuung aus denselben Rohdaten (Spearman mit Bindungsrängen aus
  `scripts/lib/rangtreue-messung.mjs`, keine zweite Formel).
- jeSeite 2/3/4/5 bei n=96 (Teilnehmerzahl je Spiel aus den Rohdaten gegengeprüft: 8 bei
  jeSeite 4; die Kopfzeile der Sonde meldet nach dem `finally`-Reset immer 6, das ist ein
  Anzeigeartefakt der Rückgabe, nicht der Messung).
- Hockey n=24 einmal zeitgemessen (37 s) als Kostenvergleich.
- **Nicht** geändert: Scorecard, Basislinie, Motor, Messskripte. Die Sonden dieser Klärung liegen
  außerhalb des Repos; die Methode ist in Abschnitt 2.1 vollständig beschrieben und mit den
  genannten Parametern von jedem reproduzierbar.
