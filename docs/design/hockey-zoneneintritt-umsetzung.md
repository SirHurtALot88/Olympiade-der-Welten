# Zoneneintritt als Zweikampf (K1) — gebaut, gemessen, nicht committed (ehrlich dokumentiert)

Auftragsgrundlage: `docs/design/hockey-naechster-hebel-recherche-fable.md`, Abschnitt 3.1
(„K1 — Zoneneintritt als Zweikampf an der blauen Linie", die dortige Empfehlung mit dem
größten gefundenen Hebel), gegengelesen mit Abschnitt 0 (Messmethodik) und 1 (Torwart-/
Verlässlichkeitsbefund). **Ergebnis vorweg: nicht committed.** Die Mechanik ist vollständig
gebaut, misst sich sauber gegen den Torkorridor und die reale kontrollierte Eintrittsquote,
aber die Rangtreue-Bewegung ist bei jeder getesteten Gewichtung kleiner als das Kaderrauschen
UND — das ist der eigentliche Befund dieser Runde — **das Vorzeichen der Bewegung kippt, wenn
man dieselbe Kader-Familie mit mehr Spielen misst.** `battle-mode.engine.js` steht unverändert
auf dem `origin/main`-Stand.

---

## 1) Was gebaut wurde

Ein `zoneneintritt(traeger,verteidiger)` neben `bully()`/`versucheSteal` (genau der im Bericht
vorgeschlagene Ort), aufgerufen aus `stepFeldspielLive` in dem Moment, in dem ein Puckträger
`HK_RADIUS_MAX` (330 px, die blaue Linie) mit Ballbesitz von außen nach innen unterschreitet —
exakt EIN `rr()`-Wurf je Überschreitung, keine Kaskade:

```js
gap       = Abstand des goal-side-Verteidigers, 0..1 normiert (wie bedraengnisGate)
angriff   = 0.5·AUFBAU + 0.3·LAUFTEMPO + 0.2·TECHNIK  (Träger)
abwehr    = 0.7·ABWEHR + 0.3·LAUFTEMPO                (Verteidiger)
pKontroll = logistisch((angriff−abwehr)·K1 − gap·K2 + BASIS)
r = rr()  // genau ein Wurf
  r < pKontroll               -> kontrolliert: eintritte++, Besitz bleibt
  r < pKontroll+pDump          -> Dump-in: Puck lose in die Ecke (haltePuckImFeld, vonSeite=Träger
                                  -> der bestehende REB_BOXOUT-Vorteil der Verteidigung im
                                  Zweikampf-Los greift automatisch, keine zweite Ausbox-Logik)
  sonst                        -> abgefangen: eintritteAbgewehrt++, verteidiger.ballUebernehmen(),
                                  startFastbreak() — dieselbe Bauform wie eine abgefangene
                                  Pass-Flugbahn (loeseFlugAuf)
```

Zwei Boxscore-Spalten (`eintritte`, `eintritteAbgewehrt`), sichtbar in `feldspielProbe`s
Spielerzeile, gewichtet mit 0,4 in `feldspielWert` — dieselbe Größenordnung wie ein Block.
`HK_TW_BASIS` wäre bei einem Commit auf den neuen Feldspieler-Mittelwert nachzuziehen (s.
Kommentar dort); da nichts committed wird, bleibt der aktuelle Wert unangetastet.

Ein `inZone`-Flag pro Spieler sorgt dafür, dass ein Ballbesitzwechsel OHNE Bewegung (Bully im
gegnerischen Zonenkreis, Anspiel nach Strafe, ein Pass, der den Empfänger bereits tief in der
Zone erreicht) nicht fälschlich als „Eintritt" zählt — es synct sich bei jedem Ballbesitzwechsel
(`ballUebernehmen`, Pass-Zweig in `loeseFlugAuf`) auf die tatsächliche Position. Nur ein
echtes Überschreiten der Linie mit Bewegung löst den Zweikampf aus. Basketball, Football,
Tennis, Fechten und alle Bühne/Bahn/Spurt-Disziplinen: nicht angefasst — alle neuen Zeilen
liegen hinter `istHockey()`-Weichen oder sind rein additive, ungelesene Felder auf JEDER
Feldspiel-Einheit (dasselbe Muster wie `checks`/`saves`/`passYards`).

**Zwei Gewichtungen wurden gebaut und gemessen** (Abschnitt 2):

| | K1 (Skill) | K2 (Gap) | Ziel |
|---|---:|---:|---|
| Variante 1 | 0,032 | 1,1 | erster Versuch, Gap dominiert die Formel deutlich |
| Variante 2 | 0,055 | 0,7 | Skill-Anteil verstärkt, Gap-Anteil gesenkt |

Basis 0,35, Deckel 0,15–0,90, Dump-Anteil an den nicht kontrollierten Versuchen 0,65 (PLATZHALTER,
s. Bericht 3.1/5) — in beiden Varianten unverändert.

---

## 2) Gemessen — und wo es kippt

### Korridor hält

Beide Varianten halten die kalibrierten Korridore: Torzahl ~3,5 je Team unverändert,
kontrollierte Eintrittsquote (eintritte/(eintritte+eintritteAbgewehrt), ohne Dump-ins im
Nenner) 58–68 % — mittig in der realen Spanne (Tulsky/Sznajder, Bericht 0.3: 55–66 %),
Eintritte je Feldspieler und Spiel 2,8 kontrolliert + 1,3 abgewehrt (+ geschätzt ~0,6 Dump,
kein eigener Zähler), zusammen nahe an den 4,8 blind gemessenen Übertritten aus dem Bericht.
Basketball bit-identisch in JEDER Messung dieser Runde (Regressionsnachweis: `zoneneintritt`,
der `inZone`-Sync und die zwei neuen Boxscore-Felder liegen ausschließlich hinter
`istHockey()`).

### n=24, kaderfest (die offizielle Abnahmezahl)

`node scripts/miss-alle-disziplinen.mjs 24 hockey basketball`, plus eine Feldspieler-only-Sonde
nach demselben Muster (Kader-Familie, Median+Spannweite, `feldspielProbe` statt
`disziplinProbe`, Torhüter-Zeilen vor der Rangberechnung gefiltert — Empfehlung aus Bericht 1.1):

| | Baseline | Variante 1 (K1=0,032) | Δ | Variante 2 (K1=0,055) | Δ |
|---|---:|---:|---:|---:|---:|
| rho/Spiel, alle 12 | 0,589 [0,292] | 0,643 [0,278] | **+0,054** | 0,572 [0,273] | **−0,017** |
| rho Saison, alle 12 | 0,748 [0,105] | 0,804 [0,161] | +0,056 | 0,769 [0,154] | +0,021 |
| rho/Spiel, nur Feldspieler | 0,651 [0,197] | 0,711 [0,165] | **+0,060** | 0,669 [0,163] | **+0,018** |
| rho Saison, nur Feldspieler | 0,818 [0,259] | 0,867 [0,142] | +0,049 | 0,853 [0,259] | +0,035 |
| Basketball rho/Spiel (Regression) | 0,757 [0,102] | 0,757 [0,102] | ±0,000 | 0,757 [0,102] | ±0,000 |

Auf den ersten Blick sieht Variante 1 nach einem Treffer aus: jede der vier Hockey-Zahlen
steigt, and das field-only-Ergebnis (+0,060) ist sogar größer als die Spannweite (0,197) —
nach der Projekt-eigenen Faustregel „eine Bewegung kleiner als die Spannweite ist von Null
nicht unterscheidbar" wäre das ein Kandidat für „bewegt real etwas". Variante 2 dagegen bewegt
sich UNTER die Baseline (alle 12) bzw. nur unwesentlich darüber (Feldspieler) — beides
innerhalb der jeweiligen Spannweite, also nicht von Null unterscheidbar.

### Die Gegenprobe: dasselbe Kader, mehr Spiele — und das Vorzeichen kippt

n=24 ist die vom Projekt festgelegte Abnahmezahl, aber jeder neue `rr()`-Aufruf verschiebt die
Zufallsfolge JEDES folgenden Ereignisses im Spiel (der Bericht warnt selbst genau davor,
Abschnitt 3.1 „Risiko"). Um zu prüfen, ob Variante 1s scheinbarer Gewinn ein echter Effekt oder
eine Ziehung ist, wurden dieselben fünf Kader-Paarungen zusätzlich mit **paarweisem
Vorher/Nachher auf denselben Saaten** bei n=48 und n=96 gemessen (rho je Spiel, Median über die
Familie):

| n je Kader-Variante | Baseline | Variante 1 | Δ Median | Variante 2 | Δ Median |
|---:|---:|---:|---:|---:|---:|
| 24 | 0,589 | 0,643 | **+0,054** | 0,572 | **−0,017** |
| 48 | 0,595 | — | — | 0,600 | **+0,006**, alle 5 Paarungen positiv |
| 96 | 0,596 | 0,578 | **−0,018**, 3 von 5 Paarungen negativ | 0,578 | **+0,008**, gemischtes Vorzeichen |

Feldspieler-only, dieselbe Messreihe:

| n | Baseline | Variante 1 | Δ | Variante 2 | Δ |
|---:|---:|---:|---:|---:|---:|
| 24 | 0,651 | 0,711 | +0,060 | 0,669 | +0,018 |
| 48 | 0,666 | — | — | 0,696 | **+0,030**, alle 5 Paarungen positiv |
| 96 | 0,687 | 0,660 | **−0,027**, 4 von 5 Paarungen negativ oder flach | 0,713 | +0,026, 4 von 5 positiv |

Bei n=48 sind BEIDE Varianten in JEDER der fünf Kader-Paarungen ins Positive gekippt — ein
Muster, das nach einem echten, wenn auch kleinen Effekt aussieht. Bei n=96 (doppelt so viele
Spiele je Paarung wie n=48, also weniger Rauschen je Paarung) kippt Variante 1 in drei von
fünf Paarungen zurück ins Negative, Variante 2 bleibt für die Feldspieler überwiegend positiv,
aber für „alle 12" gemischt. Läuft man dieselbe Paarung bei n=24, n=48 UND n=96, bewegt sich
das Ergebnis nicht monoton in eine Richtung, sondern schwankt — das ist die Unterschrift von
Kaderrauschen plus RNG-Kaskade, nicht von einem stabilen Mechanik-Effekt.

**Deshalb: kein Commit.** Nicht weil eine einzelne Messung schlecht ausfiel (Variante 1 bei
n=24 sah gut aus), sondern weil die Messung selbst instabil ist — genau die Situation, vor der
`messgrundlage-kaderfest.md` warnt, nur diesmal zusätzlich durch die RNG-Verschiebung
verschärft, die ein neuer `rr()`-Aufruf mitten im Tick-Loop zwangsläufig erzeugt.

---

## 3) Warum, vermutlich — und was das für den nächsten Anlauf bedeutet

Der Bericht selbst hat vorgerechnet, dass ein rein additiver, BLINDER Eintritts-Bonus (kein
Zweikampf, kein `rr()`, +0,5 je Eintritt in die Wertformel, in einer festen-Formkarten-Kopie
gemessen) die Saison-Validität von 0,842 auf 0,903 hebt — sauber, weil dort **kein** neuer
Zufallswurf die restliche Zufallsfolge verschiebt. Der echte Zweikampf in dieser Runde fügt
genau diesen Zufallswurf ein (er MUSS, sonst wäre es kein Duell), und jeder Eintritt passiert
4- bis 5-mal je Feldspieler und Spiel — bei zehn Feldspielern also 40- bis 50-mal je Spiel ein
zusätzlicher `rr()`-Aufruf, der alle nachfolgenden Schüsse, Checks, Steals und Fastbreaks auf
eine andere Zufallsbahn schiebt. Der reale, vermutlich kleine Validitätsgewinn aus dem
skill-gebundenen Zweikampf wird dadurch von einer Kaskaden-Varianz überdeckt, die pro Kader-
Paarung und Spielzahl unterschiedlich ausschlägt — sichtbar genau daran, dass sich das
Vorzeichen zwischen n=24/48/96 nicht stabilisiert.

Das ist kein Einwand gegen die Diagnose des Berichts (die carryIn-Validitätslücke ist real
und gemessen, Abschnitt 0.1/3.1 dort) — es ist ein Einwand gegen DIESE Bauform als Weg dorthin:
ein hochfrequentes Ereignis (40–50× je Spiel), das einen neuen Würfel braucht, ist für die
kaderfeste n=24-Abnahme dieses Projekts schlecht geeignet, weil die RNG-Kaskade bei dieser
Frequenz die Messung selbst dominiert. Zwei ehrliche Wege für einen nächsten Anlauf:

1. **Deutlich größere Stichprobe fest einplanen** (n≥150 je Kader-Paarung), wenn diese Bauform
   weiterverfolgt wird — die Instabilität in Abschnitt 2 legt nahe, dass n=24 für ein derart
   hochfrequentes, neu gewürfeltes Ereignis grundsätzlich zu wenig ist, nicht nur für diese
   beiden Gewichtungen.
2. **Der blinde Bonus selbst, ohne Zweikampf**, wie ihn der Bericht als Diagnose-Schritt
   gemessen hat (`u.eintritte` bei jedem Überschreiten der Linie hochzählen, KEIN `rr()`,
   Gewicht wie hier 0,4 statt 0,5) — hebt die Saison-Validität nachweislich, ohne die
   RNG-Kaskade der restlichen Simulation zu verschieben. Trägt real weniger Reliabilität
   (kein fähigkeitsgebundenes Los), ist aber sauber messbar und ein kleinerer, prüfbarer
   erster Schritt, bevor ein echter Zweikampf riskiert wird.

Nicht mehr in dieser Runde versucht: Chris' CLAUDE.md-Vorgabe (Abnahme in EINEM Spiel, n=24
kaderfest) ist bindend für diesen Auftrag, und eine dritte Gewichtung auf derselben Bauform
hätte hier lediglich eine dritte Zahl geliefert, keine dritte Erkenntnis — das eigentliche
Problem ist die Messstabilität dieser Ereignisklasse, nicht die konkrete Zahl von K1/K2.

---

## 4) Was NICHT angefasst wurde

Bestätigt durch die bit-identischen Basketball-Zahlen in jeder Messung: `ARENA_RESOLVED_
DISCIPLINE_IDS` (`lib/resolve/battle-mode-arena-team-points.ts`) enthält weiterhin
ausschließlich `"basketball"` — Hockey bleibt wie jede andere Nicht-Basketball-Disziplin
mockup-only, dieser Versuch trägt kein Produktionsrisiko, ob committed oder nicht. Hockeys
bestehende Schusserfolgskurve, Rezeptgewichte, Torwart-GSAA-Formel und alles bereits
Feinjustierte: unangetastet — die getesteten Änderungen lagen ausschließlich in der neuen,
separaten `zoneneintritt()`-Funktion und den zwei additiven Boxscore-Feldern.

`npm test` und `node --check public/mockups/battle-mode.engine.js` liefen während der
Entwicklung durchgehend grün; da nichts committed wird, ist der Arbeitsbaum am Ende dieser
Runde wieder Zeichen für Zeichen der `origin/main`-Stand.
