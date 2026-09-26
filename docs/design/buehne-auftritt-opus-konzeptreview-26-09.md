# Bühne-Auftritt: Gameplay-/Taktik-Gegencheck — Showcase und Eiskunstlauf (Opus, 26.09.)

**Reines Konzept. Kein Code, keine Rezeptänderung, kein Bauauftrag.** Unabhängiger Gegencheck der
beiden Disziplinen, die noch durch den generischen Auftritt-Rechner in `bauBuehne()` laufen
(`BUEHNE_ART.showcase`, `BUEHNE_ART.eiskunstlauf`). Die Frage ist nicht, ob die Zahlen stimmen —
beide bestehen die Rangtreue-Schranke (Showcase 0,892, Eiskunstlauf 0,885) —, sondern ob die
Mechanik **taktisch und künstlerisch** eine echte Wettkampfform abbildet: gibt es Entscheidungen,
gibt es Risiko gegen Sicherheit, spielt der Programmaufbau eine Rolle, gibt es mehrere Wege zum
Erfolg.

Stand: `origin/main` @ `254a56c5` (26.09.), Motor `public/mockups/battle-mode.engine.js`.
Zeilennummern unten beziehen sich auf diesen Stand.

---

## Kurzfassung

| | Showcase | Eiskunstlauf |
|---|---|---|
| Präsentation | **stark** — sechs Acts aus dem Bauplan, Rampenlicht, Backstage, Ton (Scorecard 91 %) | **stark** — Startgruppen, Spotlight, Kiss & Cry, Duett, Führungsanzeige (#1024) |
| Rangtreue / Validität | bestanden (0,892) | bestanden (0,885), Pp 23,7 (n=12, s. 1.5) |
| Entscheidungen im Wettkampf | **keine** | **keine** |
| Risiko gegen Sicherheit | **keines** — „WAGNIS" ist ein reiner Bonus | **keines** — dasselbe, und die Sprünge sind nicht einmal als Sprünge modelliert |
| Programmaufbau / Reihenfolge | irrelevant (Summe über austauschbare Würfe) | irrelevant (dito); die Elementnamen im Bild sind `u.aktuell % 3` |
| Mehrere Wege zum Erfolg | Act ist reine Optik — Golem und Barde werden mit derselben Charisma-Formel gewertet | ein Weg; „Springer" und „Künstler" haben keinen unterscheidbaren Pfad |
| Urteil | **Mechanik passt zur Sportart besser, als es aussieht** — eine Talentshow ist wirklich weitgehend Publikumsgunst. Lücke: das Wagnis und der „Money Moment". | **Größte Lücke der beiden.** Eiskunstlauf IST die Sportart der Risiko-/Sicherheitsabwägung (Quad oder Triple), und genau diese Abwägung fehlt vollständig. |
| Priorität | **zweite** | **erste** |

**Der Kernbefund in einem Satz:** beide Disziplinen sind zwölf bzw. fünf unabhängige, im Voraus
gewürfelte Münzwürfe, deren Summe zählt. Nichts, was während des Auftritts passiert, verändert
irgendetwas danach; kein Teilnehmer (und kein Manager) trifft eine Wahl; und die Rolle, die
„Wagnis" heißt, macht einen Auftritt ausschließlich **besser** und nie riskanter.

---

## 1. Das gemeinsame Chassis — was ein „Auftritt" rechnet

### 1.1 Die Formel

Beide Disziplinen laufen durch denselben Block in `setz()` innerhalb von `bauBuehne()`
(`:14152-14166`). Je Durchgang `ri` von `0` bis `rundenN-1`, **alle vorab berechnet** und danach
nur noch enthüllt:

```
ermued = 1 − max(0, 60 − AUSDAUER) · 0,0035 · ri/(rundenN−1)
basis  = (20 + GRUNDLAGE · 0,7) · max(0,4, ermued)
erfolg = min(0,94;  0,15 + TECHNIK · 0,0055 + NERVEN · 0,0035)
Erfolg:      basis + SPITZENMOMENT · 0,35 · (0,4 + WAGNIS · 0,006)
Fehlschlag:  basis · failAbzug          (Showcase 0,55, Eiskunstlauf 0,35)
immer:       + PUBLIKUM · 0,12
```

`u.summe` ist die Summe dieser Durchgänge; die Mannschaft mit der höheren Summe gewinnt. Danach
passieren nur noch zwei Dinge: Eiskunstlauf fusioniert benachbarte Paare 80/20 (`:14259-14274`),
und beide bauen eine Enthüllungsreihenfolge (schwächste zuerst, Star zuletzt).

### 1.2 Befund A — es gibt keine einzige Entscheidung

Weder der simulierte Athlet noch der Manager wählt irgendetwas, das im Wettkampf wirkt:

- **Kein Schwierigkeitsgrad.** Jeder Durchgang hat dieselbe Erfolgschance und denselben
  Punktrahmen. Es gibt kein „schweres Element" und kein „sicheres Element".
- **Keine Reaktion auf den Stand.** Alles ist vorab gewürfelt. Der letzte Läufer weiß im Modell
  nicht, was er braucht — und selbst wenn, könnte er nichts daraus machen. Gewichtheben hat genau
  diese Reaktion (`baueHebenDuelle()`: der zurückliegende Heber zieht im dritten Versuch auf
  Gegnerbestwert + 1, und der „kühne Versuch" legt über ANSAGE noch etwas drauf) — auf derselben
  Bühne, im selben Chassis, seit Wochen erprobt.
- **Aufstellung wirkt nur als kleiner Attributzuschlag.** `slotAufschlag()` (`:5459`) verschiebt
  einzelne Attribute um höchstens ±8,5 Punkte. Die Eiskunstlauf-Slots heißen *Jump Setup*,
  *Spin Grace*, *Program Flow*, *Final Pose* — die Namen versprechen ein Programm aus
  unterschiedlichen Elementen, das es mechanisch nicht gibt. Bei Showcase versprechen *Big Moment*
  und *Finale* eine Dramaturgie, die es ebenfalls nicht gibt.
- **Auftrittsreihenfolge und Duett-Partner** setzt der Motor selbst (nach `eig` sortiert). Der
  Manager hat keinen Hebel.

### 1.3 Befund B — „WAGNIS" ist kein Wagnis

WAGNIS steht in genau einem Term: als Multiplikator auf den Bonus **bei Erfolg**. In der
Erfolgschance steht es nicht. Also:

```
∂(Erwartungswert)/∂WAGNIS = erfolg · SPITZENMOMENT · 0,35 · 0,006  > 0   immer
∂(erfolg)/∂WAGNIS         = 0
```

Mehr Wagnis bringt ausschließlich mehr Punkte, nie mehr Stürze. Das ist exakt der Befund, den die
Gewichtheben-Recherche vom 06.09. für ihren alten Stand festgehalten hat („das Risiko … sitzt
nicht im Wagnis") und dort mit `HEBEN_WAGNIS_K` / `HEBEN_WAGNIS_ANSAGE_FLEX` behoben hat. Auf der
Auftritt-Bühne ist er offen geblieben — und betrifft neben Showcase und Eiskunstlauf alle
Disziplinen, die diesen Block noch durchlaufen (Speed-Schach, Tennis, Fechten, Wettessen).

Beispiel Eiskunstlauf, typischer Läufer (GRUNDLAGE 60, TECHNIK 55, NERVEN 50, SPITZENMOMENT 60,
PUBLIKUM 60):

| WAGNIS | Punkte bei Erfolg | bei Sturz | Erfolgschance | Erwartung je Element |
|---:|---:|---:|---:|---:|
| 30 | 81,4 | 28,9 | 62,8 % | 61,8 |
| 50 | 83,9 | 28,9 | 62,8 % | 63,4 |
| 80 | 87,7 | 28,9 | 62,8 % | 65,8 |

(Jeweils inklusive des Publikumsterms `PUBLIKUM·0,12 = 7,2`.)

Die Spalte „Erfolgschance" bewegt sich nicht. Ein echtes Wagnis sähe anders aus.

### 1.4 Befund C — die Durchgänge sind austauschbar, der Aufbau ist bedeutungslos

Alle Durchgänge sind statistisch gleich. Das einzige, was von der Position im Programm abhängt,
ist `ermued` — und das zieht erst unter AUSDAUER 60 und kostet selbst bei AUSDAUER 30 im letzten
Durchgang nur 10,5 % der Basis. Es gibt:

- keinen Grund, ein Element früh oder spät zu setzen,
- keinen Höhepunkt, der mehr zählt als der Rest,
- keine Folge eines Fehlers für das nächste Element (bewusst: `bauBuehne()` hat keine
  Zufallskaskade — das ist der Grund, warum die Rundenverdopplung am 07.09. nach Spearman-Brown so
  sauber griff; jede Aufbau-Idee unten muss sich daran messen lassen).

Die Enthüllungsreihenfolge (schwächste zuerst, Star zuletzt) ist reine Dramaturgie und ausdrücklich
rho-neutral gebaut — richtig so, aber sie heißt: **der Wettkampf baut sich auf, ohne dass
irgendjemand darauf reagiert.**

### 1.5 Befund D — ein Sturz frisst den Kunstanteil

Bei einem Fehlschlag fällt nicht nur der Bonus weg, sondern `1 − failAbzug` der **Basis** — und die
Basis ist GRUNDLAGE, also bei Eiskunstlauf `charisma 50 / spirit 30 / dexterity 20`. Im Beispiel
oben kostet ein Sturz 55 Punkte, davon 40 aus der Basis und nur 15 aus dem Bonus. Das Modell
bestraft einen Sturz also hauptsächlich am **künstlerischen** Teil. In der echten ISU-Wertung ist
es umgekehrt: der Sturz kostet das Element (GOE −5, also die halbe Basiswertung) plus einen
Punkt Abzug; die Programmkomponenten (Präsentation, Komposition, Laufqualität) bleiben
weitgehend stehen. Die Kalibrierrunde vom 10.09. (`eiskunstlauf-kalibrierung-10-09.md`) hat
außerdem gemessen, dass **47 % aller Elemente** als „stürzt" enden — fast jedes zweite. Echte
Elitekür: ein Sturz im ganzen Programm ist schon ein schlechter Tag.

### 1.6 Pp-Messung (Budget-Methode, Pflichtprüfung laut CLAUDE.md)

Eiskunstlaufs Rezept wurde laut Politur-Recherche 07.09. „nie" gegen ein Pp-Ziel geprüft. Für
diesen Gegencheck einmal gemessen (`node scripts/messe-arena-einfluss.mjs eiskunstlauf 12`, Stand
`254a56c5`):

| Attribut | gemessen | Matrix | Differenz |
|---|---:|---:|---:|
| dexterity | 24,7 % | 18 | +6,7 |
| charisma | 22,3 % | 28 | −5,7 |
| awareness | 15,6 % | 14 | +1,6 |
| spirit | 14,5 % | 16 | −1,5 |
| intelligence | 9,9 % | 8 | +1,9 |
| determination | 7,7 % | 6 | +1,7 |
| speed | 5,4 % | 10 | −4,6 |
| **Abweichung** | **23,7 Pp** | | Ziel ≤ 25 |

(Eine Nachmessung mit n=48 und für Showcase wurde gestartet, lief in dieser Runde aber nicht
durch, weil sich mehrere Sessions die Maschine teilten. Sie ist der erste Schritt vor jedem
Bauauftrag unten.)

Das ist nur ein Saatstamm mit zwölf Läufen; das Skript selbst warnt, dass zwölf Läufe systematisch
zu günstig messen (s. dortiger Kopfkommentar, Spurt 40,9 → 54,7 Pp von n=12 auf n=48). **Die
Zahl ist also ein Hinweis, keine Abnahme.** Das Muster ist aber deutlich und passt zu den Befunden
oben: Dexterity (Technik/Spitzenmoment/Wagnis/Ausdauer — viermal im Rezept) liest über Gewicht,
Charisma (nur in der Basis und im flachen Publikumsterm) darunter, Speed (fast nur im
wirkungsschwachen WAGNIS) klar darunter. **Jeder Vorschlag unten, der WAGNIS in die Erfolgschance
holt, gibt Speed genau den Hebel, der ihm heute fehlt** — die Pp-Lücke und die Gameplay-Lücke
haben dieselbe Ursache.

---

## 2. Eiskunstlauf

### 2.1 Bestandsaufnahme

**Was gut ist — und das ist viel:**

- **Format richtig verstanden.** Startgruppen, schwächste zuerst, jedes Paar läuft sein Programm
  am Stück, die anderen warten an der Bande, danach Kiss & Cry (`stepKuer()`, `:16235 ff.`,
  Recherche 13.09.). Das ist das ISU-Format und liest sich im Bild auch so.
- **Zwölf Elemente** (`rundenN:12`) sind genau die Größenordnung einer Senioren-Kür (sieben
  Sprungelemente, drei Pirouetten, eine Schrittfolge, eine Choreosequenz = zwölf).
- **Duett** als Paarlauf-Anklang, sauber linear fusioniert (Teamsumme bleibt erhalten).
- **Führungsanzeige** (#1024: Eis-Halo, Bandenlicht, Vorsprungsbalken) macht den Stand sichtbar.
- **Zahlen:** rho 0,885 je Spiel, Saison 0,965–0,986, Pp (grob) unter 25.

**Was die Mechanik tatsächlich ist:** zwölf identische Münzwürfe je Läufer (Formel 1.1). Im Bild
wechselt das Element nach `["pirouette","hebung","wurf"][u.aktuell % 3]` (`:16272`) — rein
kosmetisch, derselbe Wurf dahinter. Es gibt im Modell **keinen Sprung**; „stürzt" ist das Wort für
jeden Fehlschlag, auch für den einer Pirouette.

### 2.2 Die echte Wettkampfform — was Eiskunstlauf taktisch ausmacht

Kurz, nur was für ein Spielkonzept trägt (ISU-Wertungssystem IJS, Senioren-Einzel/Paar; Werte
Stand der ISU-Wertetabelle seit 2022/23, gerundet):

1. **Zwei getrennte Säulen.** *Technical Element Score* (TES): jedes Element hat einen Basiswert,
   die Ausführung (GOE, −5 … +5) verschiebt ihn um je 10 %. *Program Component Score* (PCS): drei
   Komponenten (Komposition, Präsentation, Laufqualität), einmal je Programm vergeben, mit Faktor
   hochgerechnet — bei der Kür rund die Hälfte der Gesamtwertung.
2. **Schwierigkeit ist eine Wahl, und sie ist teuer.** Basiswerte (gerundet): Vierfach-Lutz 11,5,
   Vierfach-Toeloop 9,5, Dreifach-Axel 8,0, Dreifach-Lutz 5,9, Dreifach-Toeloop 4,2,
   Doppel-Axel 3,3. Ein Quad ist also rund doppelt so viel wert wie der entsprechende Triple.
3. **Der Sturz kostet das Element, nicht das Programm.** GOE −5 (halber Basiswert) plus 1 Punkt
   Abzug (die ersten beiden Stürze; danach steigt der Abzug). Unterdrehte Sprünge verlieren 20 %
   Basiswert, ohne dass jemand fällt — es gibt also **drei** Ausgänge, nicht zwei: sauber,
   unsauber/unterdreht, Sturz.
4. **Die Rechnung hinter dem Quad.** Vierfach-Lutz mit GOE +1 bringt ~12,7, gestürzt ~4,75;
   ein sauberer Dreifach-Lutz mit GOE +2 bringt ~7,1. Der Quad lohnt sich schon ab rund **30 %**
   Landequote. Deshalb springen alle Quads, und deshalb ist die Frage „wann springe ich ihn
   nicht" die eigentliche Taktikfrage.
5. **Zweite Programmhälfte.** Die letzten drei Sprungelemente der Kür bekommen den 1,1-fachen
   Basiswert. Wer schwere Sprünge nach hinten legt („Backloading"), holt 10 % — auf müden Beinen.
6. **Planung und Umplanung.** Der Läufer meldet sein geplantes Programm, darf aber auf dem Eis
   umstellen: nach einem verpatzten Quad den nächsten auf Triple herunternehmen, eine verpasste
   Kombination an einen späteren Sprung anhängen. Der **letzte Läufer der letzten Gruppe kennt die
   Zielzahl** und plant danach — wer führt, lässt den Quad weg, wer jagt, stockt auf.
7. **Zwei Wege zum Sieg.** Vancouver 2010: Evan Lysacek gewinnt ohne einen einzigen Vierfachsprung
   mit 257,67 gegen Jewgeni Pluschenko (256,36, mit Quad) — über saubere Ausführung und
   Programmkomponenten. Das ist die berühmteste Risiko-gegen-Sicherheit-Entscheidung des Sports,
   und sie ist ein Lehrbuchfall für „mehrere Wege zum Erfolg".
8. **Paarlauf-Besonderheiten.** Nebeneinander gesprungene Sprünge (beide müssen stehen — das
   schwächere Glied entscheidet), Wurfsprünge, Hebungen, Todesspirale. Die Paarkür hat eigene
   Elementpflichten.

### 2.3 Was fehlt

| Echte Form | Im Modell | Lücke |
|---|---|---|
| Elementtypen mit unterschiedlichem Risiko (Sprung riskant, Pirouette/Schritte sicher) | alle zwölf Durchgänge identisch | **groß** |
| Schwierigkeitswahl Quad/Triple | nicht vorhanden; WAGNIS ist reiner Bonus | **groß — der Kern der Sportart** |
| TES und PCS getrennt; Sturz trifft nicht die Kunst | Sturz frisst die charismalastige Basis | mittel |
| Drei Ausgänge (sauber / unterdreht / Sturz), Stürze selten | zwei Ausgänge, 47 % „stürzt" | mittel (Bild: groß) |
| Umplanung nach Stand und nach eigenem Fehler | alles vorab gewürfelt | mittel |
| Bonus zweite Hälfte gegen Ermüdung | Ermüdung ja, Bonus nein → kein Anreiz | klein bis mittel |
| Paarlauf: schwächeres Glied bei Nebeneinander-Sprüngen | lineare 80/20-Mischung | klein |
| Mehrere Wege (Springer vs. Künstler) | ein Weg | groß |

### 2.4 Priorisierte Vorschläge (nur Konzept)

Leitlinie für alle: die Matrix bleibt gesperrt, die Rangtreue-Schranke (0,80) und die
Pp-Schranke (≤ 25) sind Abnahme; jeder Umbau steht hinter einer eigenen Weiche auf
`BUEHNE_ART.eiskunstlauf` (Muster `heben`/`gauntlet`/`schatzsuche`), damit die Geschwister im
generischen Block bit-identisch bleiben. **Entscheidungen werden nicht gewürfelt**, sondern
deterministisch aus Attributen und Stand abgeleitet — Präzedenzfall `lastFuer()` im
Gewichtheben: „kein neuer Würfel für die Entscheidung, nur für den Ausgang".

#### E0 — Sofort, rho-neutral: das Bild sagt die Wahrheit über das Element (klein)

- Die zwölf Durchgänge bekommen feste **Elementnamen nach Kür-Bauplan** statt `% 3`: sieben
  Sprungelemente, drei Pirouetten, eine Schrittfolge, eine Choreosequenz, in einer
  plausiblen Reihenfolge (Beispiel: Sprung, Sprung, Pirouette, Sprung, Schritte, Sprung | zweite
  Hälfte: Sprung, Pirouette, Sprung, Sprung, Choreo, Pirouette). Nur Beschriftung, Feed-Text,
  Pose.
- **Sturz vs. Wackler aus demselben Wurf.** Heute: `if(rr()<erfolg)`. Den ohnehin gezogenen Wert
  einmal in einer Variablen halten und im Fehlschlagfall danach beschriften, *wie knapp* er
  daneben lag: knapp → „unterdreht / Hand am Eis", deutlich → „stürzt". Gleiche Zahl an
  `rr()`-Aufrufen, gleiche Punkte, bit-identische Messung — aber aus 47 % „stürzt" werden
  vielleicht 15 % Stürze und 30 % Wackler, und das Bild wirkt nicht mehr wie ein Anfängerkurs.
- Auf Pirouetten/Schritten/Choreo heißt der Fehlschlag nie „stürzt", sondern „verliert die
  Zentrierung" / „stolpert".

Aufwand: klein. Wert: hoch fürs Auge, null für die Taktik — deshalb nur Vorstufe.

#### E1 — Kern: der Kür-Bauplan mit Elementtypen (mittel)

Die zwölf Durchgänge werden **typisiert**, jeder Typ mit eigener Erfolgs- und Punktlogik aus den
**vorhandenen sieben Rollen** (keine neuen Rollen nötig, nur eine andere Verteilung je Typ):

| Typ | Anzahl | Erfolgschance aus | Punkte aus | Risiko |
|---|---:|---|---|---|
| Sprungelement | 7 | TECHNIK, NERVEN, WAGNIS (s. E2) | Basiswert je Sprungstufe + SPITZENMOMENT | hoch |
| Pirouette | 3 | TECHNIK (hoch angesetzt) | GRUNDLAGE + TECHNIK | niedrig |
| Schrittfolge | 1 | fast sicher | GRUNDLAGE + PUBLIKUM | sehr niedrig |
| Choreosequenz | 1 | fast sicher | PUBLIKUM | sehr niedrig |

Dazu **PCS als eigene Säule** (Befund D): einmal je Programm aus PUBLIKUM/GRUNDLAGE vergeben,
nicht je Element und **nicht vom Sturz gefressen** — höchstens ein kleiner Abzug je Sturz auf die
Präsentation. Ein Sturz kostet dann das Element (halber Basiswert) plus einen festen Abzug, wie
im echten Sport.

Warum das zuerst kommt: ohne Typen gibt es nichts, worüber man entscheiden kann. Und es macht die
Slots endlich wahr — *Jump Setup* verstärkt Sprünge, *Spin Grace* Pirouetten, *Program Flow* und
*Final Pose* die PCS-Säule und die Choreo. Der Slotaufschlag selbst bleibt, was er ist
(Attributzuschlag); er trifft jetzt nur Elemente, bei denen man es sieht.

Matrix-Passung: Charisma (28) sitzt heute nur in Basis und Publikum — in E1 trägt es die
PCS-Säule, die bei echten Küren die Hälfte der Wertung ist; Dexterity/Awareness (18/14) tragen die
Sprünge; Spirit (16) die Pirouetten und die Ausdauer. Das ist eine **natürlichere** Abbildung der
Matrix als das heutige Einheitsrezept; ob Pp dabei sinkt, ist zu messen.

Risiko für rho: gering bis mittel. Die Elementzahl bleibt zwölf, keine Kaskade. Die Streuung
verschiebt sich von „jedes Element 47 % Sturz" zu „sieben riskante, fünf sichere Elemente" — das
senkt die Rauschvarianz eher.

#### E2 — Das Herz: die Sprungwahl, Quad oder Triple (mittel)

Jedes Sprungelement hat **drei Stufen**: *Doppel* (sicher, wenig), *Dreifach* (Standard),
*Vierfach* (doppelter Wert, deutlich geringere Landequote). Welche Stufe ein Läufer plant, ist
eine **deterministische Programmplanung** aus seinen Attributen — kein Würfel:

- Er rechnet die Erwartung je Stufe aus der eigenen Landequote und wählt das Maximum
  (rationaler Planer). Die Landequote für den Quad fällt steil mit TECHNIK — so steil, dass die
  **Weiche im Kader liegt**: die obere Hälfte springt den Quad, die untere nicht. Anders als im
  echten IJS (Break-even ~30 %, s. 2.2 Punkt 4) muss der Kipppunkt so kalibriert sein, dass die
  Entscheidung **für einen Teil des Feldes falsch wäre** — sonst ist sie keine.
- **WAGNIS wird endlich ein Wagnis:** es verschiebt die Planung zum schwereren Sprung
  (Selbstvertrauen) **und** hebt die Landequote genau auf den schweren Stufen ein wenig
  (abgeklärter unter Risiko) — exakt das Muster `HEBEN_WAGNIS_ANSAGE_FLEX` aus Gewichtheben, das
  dort Pp und Gameplay gleichzeitig repariert hat. Ein Läufer mit hohem WAGNIS und mittlerer
  TECHNIK ist dann der Pluschenko-Typ: plant zwei Quads, landet einen, fällt beim anderen.
- Der Ertrag für die Validität: die Schwierigkeitswahl **verstärkt** Eignungsunterschiede statt
  Rauschen hinzuzufügen — der Starke holt aus dem Quad mehr, der Schwache verliert mit dem Quad
  mehr und lässt ihn deshalb weg. Das ist die Richtung, in der ein Mechanismus rho eher hebt als
  senkt. Die Verlässlichkeit je Spiel kann trotzdem sinken (mehr Varianz beim Quad-Springer) —
  deshalb Abnahme mit `miss-alle-disziplinen.mjs` n=24 **und** n=96.

Sichtbar machen: im Programm-Einblender vor dem Auftritt „geplant: 2 × Vierfach"; im Feed
„Vierfach-Lutz — gelandet (+12,7)" oder „Vierfach-Lutz — Sturz (4,8)". Das ist der Moment, auf
den Eiskunstlauf-Zuschauer warten, und heute gibt es ihn nicht.

#### E3 — Umplanen auf dem Eis: Reaktion auf den Stand (mittel)

Dafür muss die Berechnung von „alles vorab" auf „in Startreihenfolge" umgestellt werden — derselbe
Schritt, den Heben und Gauntlet schon gegangen sind (eigene Rechenfunktion, `return` vor dem
generischen Block). Weiterhin kein `rr()` in der Entscheidung:

- **Nach eigenem Sturz:** der nächste geplante Quad wird zum Triple, wenn NERVEN niedrig ist; mit
  hohem NERVEN bleibt der Plan. Das ist die realistische Kaskade — und sie ist **dämpfend**, nicht
  verstärkend (wer fällt, geht sicher), also eher gut für die Verlässlichkeit.
- **Nach dem Mannschaftsstand:** die letzte Startgruppe sieht den Vorsprungsbalken aus #1024. Wer
  vorn liegt, streicht Quads (Lysacek), wer hinten liegt, stockt auf (Pluschenko). Damit wird die
  Führungsanzeige vom Schmuck zum **Instrument** — der Zuschauer sieht den Balken und versteht,
  warum das letzte Paar den Quad wagt.
- Kombination retten: verpasste Kombination an einen späteren Sprung anhängen — nett, niedrige
  Priorität.

#### E4 — Zweite Hälfte gegen Ermüdung (klein)

Die letzten drei Sprungelemente zählen ×1,1; AUSDAUER senkt dort die Landequote statt (wie heute)
die Basis. Die Planung (E2) entscheidet, ob ein Läufer seine Quads nach hinten legt. Macht
AUSDAUER (heute nur ein weicher Basisabzug, der erst unter 60 greift) zu einer echten
Planungsgröße und die Reihenfolge der Elemente zum ersten Mal relevant. Klein, weil es auf E1/E2
aufsetzt und nur zwei Stellschrauben braucht.

#### E5 — Paarlauf-Charakter im Duett (klein bis mittel)

Heute: lineare 80/20-Mischung, Partner nach Eignung benachbart. Vorschlag: auf Elementebene
unterscheiden — **Nebeneinander-Sprünge zählen das schwächere Glied** (beide müssen stehen),
**Hebungen/Würfe/Todesspirale** den Durchschnitt, Choreo/PCS das Paar gemeinsam. Das gibt der
Paarbildung Gewicht (zwei ähnlich starke Springer sind mehr wert als ein Star mit einem schwachen
Partner) und ist ehrlicher zum Sport. Offene Frage für Chris (s. 4), ob die Paarung dann eine
Managerentscheidung werden soll.

### 2.5 Mehrere Wege zum Erfolg (Eiskunstlauf)

E1 + E2 zusammen ergeben genau das Primär-/Nebenweg-Muster aus der I-Spy-Runde:

- **Springer-Weg:** hohe TECHNIK/WAGNIS/Dexterity → plant Quads, holt den TES. Riskant.
- **Künstler-Weg:** hohe Charisma/Spirit → sichere Triples, starke PCS, saubere GOE.
  Weniger Spitze, mehr Boden. Das ist der Lysacek-Weg, und er muss gewinnen können.

Beide Wege liegen **in der Matrix** (Charisma 28 für den Künstler, Dexterity/Awareness/Speed
18/14/10 für den Springer) — es braucht keinen Override, nur eine Mechanik, die beide Säulen
getrennt ausspielt. Die Pp-Messung ist die Probe, ob die Gewichtung am Ende stimmt.

---

## 3. Showcase

### 3.1 Bestandsaufnahme

**Was Showcase ist:** eine Talentshow nach dem Muster *America's Got Talent* (Chris, 17.09.; Konzept
`showcase-talentshow-konzept-17-09.md`). Jeder der zwölf Teilnehmer tritt einmal auf, fünf
Durchgänge am Stück, schwächste zuerst. Seit S0–S3 (#957–#961) hat jeder Teilnehmer einen
**Act** — Kampfkunst, Schützenkunst, Zaubershow, Gesang, Kraftakt, Akrobatik —, deterministisch
aus Bauplan, Klasse, Unterklassen, Rasse und Traits abgeleitet (`actVon()`, `:18958`), mit eigener
Pose, Requisite, Ton und Feed-Text. Bühne mit Vorhang, Rampenlicht, Backstage-Reihen.

**Was die Mechanik ist:** exakt die Formel aus 1.1 mit fünf Durchgängen und `failAbzug 0,55`. Der
Act geht **absichtlich** nicht in die Wertung ein (Konzept Abschnitt 4.1: act-abhängige Gewichte
würden die Validität senken). Ein Golem im Kraftakt und ein Barde im Gesang werden also mit
derselben Charisma-lastigen Formel gewertet.

**Ehrliche Einordnung:** das ist bei einer Talentshow **weniger falsch als es klingt.** Im echten
Format entscheidet am Ende Publikumsgunst — Ausstrahlung, Sympathie, der Moment, der hängen
bleibt. Die Matrix (Charisma 27, Spirit 16) sagt genau das, und eine flache, charismagetragene
Summe bildet das ordentlich ab. Die Lücke liegt nicht in der Grundformel, sondern in drei Dingen,
die eine Talentshow ausmachen und hier fehlen.

### 3.2 Die echte Wettkampfform — was eine Talentshow taktisch ausmacht

1. **Die Nummer hat einen Bogen.** Ein Vorsprech-Auftritt dauert rund anderthalb Minuten und ist
   auf *einen* Höhepunkt gebaut („money moment", „wow moment") — der Stunt, der hohe Ton, der
   Trick, für den die Nummer da ist. Das Davor baut Spannung auf, das Danach ist Applaus.
2. **Das Wagnis ist das Produkt.** Gefahren-Acts, der Trick, der schiefgehen kann, der höhere Ton
   im Finale. Die Jury-Floskel „you played it safe" ist ein Vorwurf. Wer nichts riskiert, wird
   vergessen; wer riskiert und scheitert, ebenfalls — aber wer riskiert und trifft, gewinnt.
3. **Die Jury kann abbrechen.** Vier Juroren mit Buzzer; drücken alle, ist die Nummer vorbei.
   Ein schwacher Anfang kann den Auftritt also beenden, bevor der Höhepunkt kommt.
4. **Der goldene Buzzer.** Einmal je Juror und Staffel: eine Nummer wird sofort ins Finale
   geschickt. Seltenes, großes Ereignis.
5. **Der Startplatz zählt.** In den Liveshows gilt der letzte Platz als der beste („pimp slot") —
   was zuletzt kommt, bleibt im Gedächtnis.
6. **Jeder Act hat sein eigenes Kriterium.** Beim Kraftakt zählt, ob der Fels bricht, beim Sänger
   die Stimme, beim Zauberer, ob man den Trick durchschaut. Charisma verkauft jede Nummer — aber
   es ersetzt nicht das Handwerk.

### 3.3 Was fehlt

| Echte Form | Im Modell | Lücke |
|---|---|---|
| Nummer mit Höhepunkt | fünf gleichwertige Würfe | **mittel bis groß** |
| Wagnis als Wahl („Gefahren-Nummer") | WAGNIS ist reiner Bonus | **groß** |
| Act-eigenes Handwerk | Act ist reine Optik | mittel (s. 3.4 S3 — mit Vorsicht) |
| Jury-Abbruch | Buzzer leuchtet nur | klein (und riskant, s. S4) |
| Goldener Buzzer | fehlt | klein |
| Startplatz als Managerentscheidung | automatisch nach Eignung | klein |

### 3.4 Priorisierte Vorschläge (nur Konzept)

#### S1 — Die Nummer bekommt einen Bogen: Aufbau, Höhepunkt, Applaus (mittel)

Die fünf Durchgänge bekommen **Rollen**: *Auftakt*, *Aufbau*, *Aufbau*, **Höhepunkt**,
*Schlussbild*. Der Höhepunkt trägt den großen Teil des Spitzenmoment-Bonus (SPITZENMOMENT ×
WAGNIS wandert fast ganz dorthin); die anderen vier tragen Basis und Publikum. Dazu ein sanfter
**Stimmungswert**: gelungene Aufbau-Durchgänge heben ihn, verpatzte senken ihn, und er
multipliziert den Höhepunkt leicht.

Das ist eine Kaskade und muss als solche gemessen werden. Sie ist aber gewollt klein und
**verstärkt Eignung**, nicht Zufall: wer besser ist, baut eher Stimmung auf. Die Slots *Big Moment*
und *Finale* bekommen damit zum ersten Mal Bedeutung (verstärken den Höhepunkt bzw. das
Schlussbild).

Im Bild ist das schon halb vorbereitet: Rampenlicht, Act-Pose, Applaus-/Buzzer-Ton. Der Höhepunkt
braucht nur eine größere Pose und einen Einblender.

#### S2 — Das Wagnis wird eine Wahl: sichere Nummer oder Gefahren-Nummer (mittel)

Für den Höhepunkt plant jeder Teilnehmer deterministisch (Muster E2 / `lastFuer()`):
**sicher** (hohe Gelingchance, mittlerer Bonus) oder **gefährlich** (spürbar niedrigere
Gelingchance, großer Bonus). WAGNIS (`torment 45 / power 30 / speed 25`) schiebt zur Gefahr und
hebt dort die Gelingchance leicht — wieder das Heben-Muster: der Mutige wählt das Risiko und
trägt es besser. Mit S3 zusammen die sichtbarste Entscheidung der Disziplin: „Lava Golem wagt
den Doppelfelsen" — und bricht ein, oder der Saal tobt.

Zusätzlich die Standreaktion aus E3, im Kleinen: wer als eines der letzten Talente hinten liegt,
geht auf Gefahr.

#### S3 — Act-Handwerk im Höhepunkt: Primärweg und Nebenweg (mittel, mit Messvorbehalt)

Das Talentshow-Konzept hat act-abhängige Wertung zu Recht abgelehnt, weil die **ganze**
Punkteformel dann je Teilnehmer etwas anderes belohnt hätte als die Eignung. Ein engerer Schnitt
ist mit der Matrix vereinbar:

- Nur der **Höhepunkt-Bonus** (S1) liest ein act-eigenes Handwerksattribut, der Rest bleibt
  charismagetragen wie heute.
- Die Handwerksattribute sind genau die **Nebengewichte, die die Matrix ohnehin vorsieht**:
  Kraftakt → power (11), Zaubershow → intelligence (10), Schützenkunst → dexterity (9),
  Akrobatik → speed (8), Kampfkunst → power/dexterity, Gesang → charisma/spirit. Diese vier
  Nebengewichte summieren sich auf 38 % der Matrix — das Budget ist also da, es wird heute nur
  über SPITZENMOMENT/TECHNIK/WAGNIS verschmiert statt act-bezogen ausgespielt.
- **Primärweg:** das act-eigene Attribut trägt den Höhepunkt voll. **Nebenweg:** Charisma kann
  den Höhepunkt „verkaufen", aber gedeckelt (etwa zu zwei Dritteln). Ein charismatischer Golem
  mit wenig Kraft kommt so trotzdem durch — nur nicht als Sieger des Kraftakts.

Messvorbehalt, ausdrücklich: weil `actVon()` den Act fast nur aus dem Bauplan ableitet und kaum
aus Attributen (ein einziger Kipp-Punkt), kann es Teilnehmer geben, deren Act nicht zu ihren
Werten passt. Dann läse die Einflussmessung dieses Attribut quer über den Kader verzerrt. Zwei
Auswege, beide für Chris (s. 4): (a) Act fest am Charakter lassen und die Verzerrung per Pp-Messung
belegen/tolerieren, oder (b) die Attribute in `actVon()` stärker gewichten, damit ein Charakter
die Nummer zeigt, die er kann. Ohne Pp-Messung mit zwei Saatstämmen wird S3 nicht gebaut.

#### S4 — Jury und goldener Buzzer (klein, optional)

- **Goldener Buzzer:** einmal je Spiel für den besten Höhepunkt (höchste Einzelpunktzahl), fester
  kleiner Bonus plus großes Bildereignis (Konfetti, Ton). Kaum Einfluss auf rho, hoher
  Showwert. Unkritisch.
- **Jury-Abbruch:** drei Juroren-X nach zwei verpatzten Aufbau-Durchgängen beenden die Nummer
  vor dem Höhepunkt. Echt, dramatisch — aber eine harte Kaskade, die vor allem die Schwachen trifft
  und die Verlässlichkeit je Spiel senken kann. **Nur mit Messung, sonst weglassen.** Eine weiche
  Fassung (Abbruch kostet nur den Höhepunkt-Bonus, Basis bleibt) ist das Mindeste.

#### S5 — Der Schlussplatz als Managerentscheidung (klein)

Heute setzt der Motor die Reihenfolge nach Eignung. Vorschlag: der Spieler im Slot *Finale* tritt
als letzter seines Teams auf und bekommt einen kleinen Schlussapplaus-Zuschlag auf PUBLIKUM. Gibt
dem Aufstellungsbildschirm eine echte Showcase-Entscheidung („wen schicke ich zuletzt raus?") und
ist mechanisch winzig. Die Dramaturgie „Star zuletzt" bleibt erhalten, wenn der Manager seinen Star
dorthin setzt — und wer es nicht tut, verschenkt etwas.

### 3.5 Mehrere Wege zum Erfolg (Showcase)

Heute gibt es genau einen: Charisma. S3 ergibt einen **Handwerksweg je Act** (Primärweg) plus den
**Charisma-Weg als Nebenweg**; S2 ergibt quer dazu **Risiko gegen Sicherheit**. Zusammen: der
charismatische Sänger gewinnt mit einer sicheren Nummer, der kräftige Golem mit dem gewagten
Doppelfelsen, der wendige Akrobat mit dem Salto, den keiner erwartet — alles innerhalb der
Matrix. Wichtig bleibt die ehrliche Grenze: Showcase ist eine Charisma-Disziplin, und der
Charisma-Weg soll der breiteste bleiben.

---

## 4. Offene Entscheidungen für Chris

1. **Soll es in Auftritt-Disziplinen überhaupt Entscheidungen geben?** Das ist die Grundfrage.
   Heute sind Showcase und Eiskunstlauf reine Wertungsrechner mit schöner Bühne. Mit E2/S2 plant
   jeder Teilnehmer sein Risiko — deterministisch aus seinen Werten, also nicht vom Spieler
   gesteuert, aber sichtbar und nachvollziehbar. (Empfehlung: ja, nach dem Heben-Muster.)
2. **Soll der Manager Einfluss auf die Risikoplanung bekommen?** Etwa ein Team-Schalter „auf
   Sicherheit / auf Angriff" für eine Disziplin. Das wäre die erste echte taktische
   Vorab-Entscheidung auf der Bühne. (Empfehlung: erst nach E2 entscheiden, wenn man sieht, wie
   die automatische Planung wirkt.)
3. **Eiskunstlauf: Duett-Paare vom Manager wählen lassen?** Mit E5 hätte die Paarung Gewicht.
4. **Showcase: Act fest am Charakter oder nach Können?** Relevant erst für S3 (s. dort).
5. **Jury-Abbruch bei Showcase: ja, weich oder gar nicht?** (S4)

## 5. Empfohlene Reihenfolge und Messplan

| Schritt | Inhalt | Aufwand | Wirkung auf Gameplay | rho-/Pp-Risiko |
|---|---|---|---|---|
| 1 | **E0** Elementnamen + Sturz/Wackler aus demselben Wurf | klein | Bild, nicht Taktik | keins (bit-identisch nachweisen) |
| 2 | **E1** Kür-Bauplan mit Elementtypen, PCS getrennt | mittel | Grundlage für alles Weitere | gering–mittel |
| 3 | **E2** Sprungwahl Quad/Triple, WAGNIS in die Landequote | mittel | **der Kern** | mittel — n=24 und n=96, zwei Saatstämme Pp |
| 4 | **E3** Umplanen nach Sturz und nach Stand | mittel | macht #1024 zum Instrument | mittel |
| 5 | **S1 + S2** Showcase-Bogen und Gefahren-Nummer | mittel | Kern für Showcase | gering–mittel |
| 6 | **E4** zweite Hälfte / Ermüdung | klein | Reihenfolge wird relevant | gering |
| 7 | **S5** Schlussplatz | klein | erste Showcase-Aufstellungsentscheidung | gering |
| 8 | **S3** Act-Handwerk im Höhepunkt | mittel | mehrere Wege | **nur mit Pp-Messung** |
| 9 | **E5**, **S4** | klein–mittel | Feinschliff | S4-Abbruch: hoch |

Für jeden Schritt: `node scripts/miss-alle-disziplinen.mjs 24 eiskunstlauf showcase` vorher und
nachher, bei Schritten mit neuer Varianz zusätzlich n=96; `messe-arena-einfluss.mjs <diszi> 48`
mit zwei Saatstämmen (Pflicht laut CLAUDE.md); die anderen Bühnen-Disziplinen bit-identisch
nachweisen, solange die Weiche sauber gesetzt ist.

**Nebenbefund für die anderen Bühnen:** Befund B (WAGNIS ohne Risiko) steckt im generischen Block
und betrifft alles, was ihn noch durchläuft (Speed-Schach, Tennis, Fechten, Wettessen). Wer eine
dieser Disziplinen als nächstes anfasst, sollte die Stelle kennen — eine chassisweite Korrektur ist
**nicht** empfohlen, weil jede davon anders „wagt".

---

## Quellen

**Code (gelesen, Stand `254a56c5`):** `public/mockups/battle-mode.engine.js` —
`BUEHNE_ART.showcase`/`.eiskunstlauf` (`:13345-13387`), Slots (`:5312`, `:5366`),
`slotAufschlag()` (`:5459`), `bauBuehne()`/`setz()` inkl. Durchgangsformel (`:14048-14166`),
Duett-Fusion und Startreihenfolge (`:14259-14322`), Showcase-Reihenfolge (`:14337-14352`),
`stepKuer()` (`:16235 ff.`, Elementwahl `:16272`), `SHOWCASE_ACTS`/`actVon()`/`stepShowcase()`
(`:18886-19310`), Gewichtheben-Präzedenzfälle (`HEBEN_WAGNIS_ANSAGE_FLEX`, kühner Versuch).

**Dokumente:** `showcase-talentshow-konzept-17-09.md`, `eiskunstlauf-kalibrierung-10-09.md`,
`eiskunstlauf-startreihenfolge-spotlight-recherche-13-09.md`,
`fechten-eiskunstlauf-breaking-politur-recherche-07-09.md`,
`gewichtheben-risiko-versuch-recherche-06-09.md`, `gewichtheben-gameplay-fertig.md`,
`broadcast-praesentation-runde-2-22-09.md`, `stand-aller-disziplinen.md`.

**Sport:** ISU-Wertungssystem (IJS) — Basiswertetabelle seit 2022/23, GOE −5…+5 in 10-%-Schritten,
Sturzabzüge, drei Programmkomponenten seit 2022/23, 1,1-Bonus der letzten drei Sprungelemente der
Kür, Elementpflichten der Senioren-Kür (sieben Sprungelemente, drei Pirouetten, Schrittfolge,
Choreosequenz). Olympia Vancouver 2010, Herren: Lysacek 257,67 / Pluschenko 256,36.
*America's Got Talent* (NBC): vier Juroren mit Buzzer, Abbruch bei vier X, goldener Buzzer seit
Staffel 9 (2014). Zahlen gerundet und aus dem Gedächtnis des Stands der letzten Regelfassung; vor
einer Kalibrierung gegen die aktuelle ISU-Kommunikation prüfen.
