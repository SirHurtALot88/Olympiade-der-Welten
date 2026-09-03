# Hockey-Rezept nach der Sonde: Ursache und Fix

Auftrag: Chris' Budget-Methode (Sondierung + Sinkhorn) wurde nach `hockey-eigene-
erfolgskurve` (TEAMGEIST raus, SCHUSS_NAH/FERN neu gefittet) auf Hockey angewandt — exakt
das Verfahren, das für Arena/Bahn/Basketball in dieser Runde funktioniert hat. Ergebnis war
eine reproduzierbare VERSCHLECHTERUNG auf beiden Abnahme-Achsen (rho je Spiel 0,617 → 0,582,
rho Saison 0,783 → 0,755, n=24, zweimal identisch), deshalb nicht eingebaut. Auftrag hier:
Ursache finden, Fix versuchen, nur einbauen wenn nachweisbar besser als 0,617/0,783.

**Ergebnis vorweg:** die Arbeitshypothese (Health überlädt zu viele Sub-Skills) ist
**falsch** — die gemessene Kreuzkorrelation zwischen Sub-Skills sinkt mit dem neuen Rezept
sogar. Der echte Grund ist ein blinder Fleck in Sinkhorn selbst (Abschnitt 2). Ein Fix, der
diesen blinden Fleck gezielt korrigiert, schlägt beide Referenzzahlen: **rho je Spiel 0,647
(n=24) / 0,626 (n=48), rho Saison 0,860 (n=24) / 0,846 (n=48)** — eingebaut in
`public/mockups/battle-mode.rezepte.js`, Basketball bei beiden Stichproben bit-identisch
zum unveränderten Stand.

---

## 0) Reproduktion

Erste Amtshandlung: die gemeldeten Zahlen nachrechnen, mit einem Werkzeug, das exakt
dieselbe Rechnung fährt wie `scripts/miss-alle-disziplinen.mjs` (disziplinProbe + dieselbe
Spearman-Formel), aber ein beliebiges Kandidatenrezept in eine Wegwerfkopie von
Mockup/Motor/Rezepten einsetzt, bevor es misst.

| Rezept | n | rho je Spiel | rho Saison |
|---|---:|---:|---:|
| Alt (Handkalibrierung, Stand vor dieser Untersuchung) | 24 | 0,617 | 0,783 |
| Alt | 48 | 0,607 | 0,804 |
| Neu (Sinkhorn, Chris' Sondierung + `baue-feldspiel-rezept.mjs`) | 24 | 0,582 | 0,755 |

Bit-identisch zu den gemeldeten Werten. Die eigene Sondierung (`sondiere-feldspiel-
subskills.mjs hockey 24 0`, 711 s Laufzeit) reproduziert außerdem exakt dieselben
mechanischen Gewichte, die dem Auftrag zugrunde lagen:

```
ABSCHLUSS 17,7 %   ZWEITCHANCE 17,5 %   SCHUSS_FERN 12,4 %   TEAMGEIST 11,6 %
ABWEHR 11,1 %      LAUFTEMPO 9,4 %      TECHNIK 8,9 %        AUSDAUER 6,1 %
SCHUSS_NAH 5,4 %   AUFBAU 0 %           PARADE 0 %
```

Kein Transkriptionsfehler, keine Stichprobenschwankung (die Saaten sind deterministisch) —
die Verschlechterung ist real und reproduzierbar.

---

## 1) Die Arbeitshypothese ist widerlegt

Hypothese: das neue Rezept konzentriert Health breit über mehrere schwere Sub-Skills
(SCHUSS_NAH 63 %, ZWEITCHANCE 62 %, ABWEHR 24 %, AUSDAUER 20 %), macht sie dadurch
untereinander redundant und verliert unabhängige Information.

Geprüft direkt am 12-Spieler-Testkader, den jede dieser Sonden benutzt (dieselben zwölf
Feldspieler aus `SQUAD`/`OPP`, mit denen `feldspielSubskills()` arbeitet):

**a) Health streut im Testkader nicht ungewöhnlich wenig.** Standardabweichung je Attribut,
zwölf Spieler:

| Attribut | Std | Attribut | Std |
|---|---:|---|---:|
| torment | 30,6 | speed | 24,8 |
| charisma | 29,2 | intelligence | 24,5 |
| spirit | 27,4 | awareness | 23,2 |
| will | 27,1 | stamina | 22,8 |
| dexterity | 26,6 | determination | 19,4 |
| power | 25,7 | **health** | **18,2** |

Health hat zwar die kleinste Streuung aller zehn Kampfattribute — aber nur knapp unter
determination, und das reicht nicht als Erklärung: es ist die Attribut-KORRELATION mit der
Eignung, nicht die rohe Streuung, die zählt (s. Abschnitt 2).

**b) Die Sub-Skill-Kreuzkorrelation sinkt, sie steigt nicht.** Mittlere absolute
Korrelation über alle 55 Sub-Skill-Paare (Werte der zwölf Spieler, Rezept alt gegen neu):

| Gewichtung | Alt | Neu | Richtung |
|---|---:|---:|---|
| ungewichtet (alle 55 Paare) | 0,467 | 0,408 | **sinkt** |
| gewichtet mit dem Produkt der mechanischen Gewichte beider Sub-Skills | 0,483 | 0,422 | **sinkt** |

Einzelne Paare bewegen sich in beide Richtungen (SCHUSS_NAH×ZWEITCHANCE 0,40→0,92, aber
ZWEITCHANCE×ABWEHR 0,92→0,61) — im Mittel überwiegt die Entkopplung. Die Hypothese sagt das
Gegenteil des Messergebnisses voraus und ist damit widerlegt, nicht nur unbestätigt.

---

## 2) Die echte Ursache: Sinkhorn kennt kein "das muss führen"

Der Hockey-Plan (`docs/design/hockey-rollout-plan.md`, Abschnitt B.2) verlangt ausdrücklich
getrennte FÜHRENDE Attribute, damit Archetypen mechanisch unterscheidbar bleiben — genau das
Prinzip, das `hockey-eigene-erfolgskurve` gerade erst für SCHUSS_NAH/FERN durchgesetzt hat
(Sniper-Archetyp-Korrelation 0,04/-0,16 → 0,82/0,82):

> „SCHUSS_NAH führt dexterity, SCHUSS_FERN führt power. Kein gemeinsames führendes
> Attribut."

`baue-feldspiel-rezept.mjs` respektiert diese Vorgabe nur INSOWEIT, wie sie in der
ERLAUBT-Tabelle steht (welche Attribute ein Sub-Skill überhaupt tragen darf) — aber Sinkhorn
selbst balanciert ausschließlich Zeilen- (Attributbudget = 100 %) und Spaltensummen
(Sub-Skill trifft sein gemessenes Gewicht). Es gibt keine dritte Nebenbedingung, die sagt
„und dieses Attribut soll dabei das GRÖSSTE sein". Wenn mehrere schwere Sub-Skills um
dasselbe knappe Attribut konkurrieren, kann Sinkhorn das dokumentierte Führungsattribut
eines LEICHTEREN Sub-Skills praktisch leerlaufen lassen, ohne dass die Kontrollrechnung
(„0,00 Pp Abweichung") das anzeigt — die Kontrollrechnung prüft nur Summen, keine
Zusammensetzung.

Genau das ist passiert. Power (Matrixgewicht 18, das schwerste Attribut) wird von FÜNF
Sub-Skills zugleich angefragt: AUFBAU, ABSCHLUSS, SCHUSS_FERN, ZWEITCHANCE, ABWEHR. Die
beiden schwersten Abnehmer — ABSCHLUSS (17,7 % mechanisches Gewicht) und ZWEITCHANCE
(17,5 %) — ziehen dabei so viel von Powers 18-Punkte-Budget ab, dass für SCHUSS_FERN (12,4 %)
nur noch 17 % Power-Anteil übrig blieb; den Rest seiner Zielmasse musste Sinkhorn aus
awareness und **speed** auffüllen (53 % Speed-Anteil) — obwohl der Plan für SCHUSS_FERN
ausdrücklich „führt power" verlangt.

Auf dem festen Testkader ist das kein kosmetischer Unterschied:

| Attribut | Spearman-rho zur Matrix-Eignung (12-Spieler-Testkader) |
|---|---:|
| power | **0,68** |
| torment | 0,59 |
| stamina | 0,39 |
| health | 0,35 |
| will | 0,25 |
| dexterity | -0,22 |
| speed | **-0,06** |
| spirit | **-0,34** |

Speed korreliert auf diesem Kader praktisch NULL mit der Eignung; Spirit sogar NEGATIV.
Ein rein buchhalterisch bilanzierter Tausch — Power raus, Speed oder Spirit rein, Summe
stimmt — zerstört deshalb die Korrelation des betroffenen Sub-Skills mit der Eignung, ohne
dass die Sinkhorn-Kontrollrechnung je etwas davon merkt:

| Sub-Skill | rho(Sub-Skill-Wert, Eignung) alt | neu (Sinkhorn) | Kandidat (Fix, Abschnitt 3) |
|---|---:|---:|---:|
| ABSCHLUSS (17,7 % Gewicht) | 0,70 | 0,52 | 0,63 |
| SCHUSS_FERN (12,4 % Gewicht) | 0,39 | 0,21 | **0,56** |
| SCHUSS_NAH (5,4 % Gewicht) | 0,36 | **0,76** | 0,76 (unverändert übernommen) |

Bei ABSCHLUSS liegt dieselbe Mechanik vor, nur milder: der Plan erlaubt dort ausdrücklich
nur „power, spirit" (keine Dokumentationsverletzung), aber Sinkhorns 63/37-Aufteilung gibt
Spirit (rho -0,34) mehr Gewicht, als seine schwache Korrelation mit der Eignung verträgt.
SCHUSS_NAH dagegen — dexterity/torment/health statt der alten power-Führung — wurde durch
denselben Mechanismus zufällig BESSER (0,36 → 0,76), weil Health und Torment auf diesem
Kader gut mit der Eignung korrelieren. Sinkhorn trifft beide Fälle nach demselben blinden
Verfahren; nur der Ausgang unterscheidet sich, je nachdem, welches Attribut es dem
betroffenen Sub-Skill zuteilt.

**Fazit der Ursachensuche:** kein Fehler im Rezept-Datenformat, keine Verletzung der
Hockey-Plan-Dokumentation (B.2 wird an keiner Stelle wörtlich gebrochen), sondern eine Lücke
im SINKHORN-VERFAHREN selbst — es kann die Nebenbedingung „X soll das führende Attribut
bleiben" nicht ausdrücken, nur Summen. Bei Arena/Bahn/Basketball ist diese Lücke offenbar
nicht schlagend geworden (entweder weniger Konkurrenz um dieselben Attribute, oder die
jeweils verdrängten Alternativ-Attribute korrelierten dort zufällig nicht so schlecht mit
der Eignung) — für Hockey war sie es, an genau den zwei am schwersten wiegenden
Sub-Skills, die am meisten Power-Konkurrenz hatten.

---

## 3) Der Fix

Zwei Sub-Skills gezielt nachjustiert, **innerhalb derselben von B.2 erlaubten
Attribut-Auswahl** (keine neue Semantik, keine Attribut-Erweiterung) — nur die INTERNE
Aufteilung zugunsten des dokumentierten Führungsattributs verschoben:

```
ABSCHLUSS:   {power:63,spirit:37}  ->  {power:82,spirit:18}
SCHUSS_FERN: {speed:53,awareness:30,power:17}  ->  {power:47,awareness:30,speed:23}
```

Alle übrigen neun Sub-Skills (AUFBAU, SCHUSS_NAH, TECHNIK, ZWEITCHANCE, ABWEHR, TEAMGEIST,
AUSDAUER, LAUFTEMPO, PARADE) unverändert aus dem Sinkhorn-Ergebnis übernommen — ihre
Einzel-Korrelation mit der Eignung war beim Sinkhorn-Rezept gleich gut oder besser als beim
alten Handrezept (PARADE ohnehin unangetastet, Torwart-Rolle).

Eine zweite, engere Variante (power:90/spirit:10 bei ABSCHLUSS, power:55 bei SCHUSS_FERN)
wurde ebenfalls gemessen — rho je Spiel minimal besser (0,625), rho Saison aber schlechter
als der Ausgangswert (0,748 gegen 0,783) — und deshalb verworfen. Der Kandidat oben ist der
robustere Punkt, nicht der am stärksten in eine Richtung gedrehte.

### Verifikation

`scripts/miss-alle-disziplinen.mjs`, gegen die tatsächliche Datei
`public/mockups/battle-mode.rezepte.js` (kein Sandkasten):

| | n=24 | n=48 |
|---|---:|---:|
| Hockey vorher (altes Handrezept) | 0,617 / 0,783 | 0,607 / 0,804 |
| Hockey nachher (dieser Fix) | **0,647 / 0,860** | **0,626 / 0,846** |
| Basketball vorher | 0,820 / 0,881 | 0,821 / 0,895 |
| Basketball nachher | 0,820 / 0,881 | 0,821 / 0,895 |

(Format: rho je Spiel / rho Saison.) Beide Hockey-Kennzahlen liegen bei BEIDEN Stichproben
über dem alten Stand — nicht nur die Saisonzahl bei fallendem Einzelspiel, sondern echte
Verbesserung auf beiden Achsen. Basketball ist bei beiden n bit-identisch zum unveränderten
Stand — keine Regression durch diese Datei.

Absolute Zahl bleibt unter der CLAUDE.md-Schranke (rho je Spiel > 0,80): Hockey ist mit
0,647/0,626 weiterhin klar "durchgefallen", nicht "bestanden". Diese Runde behebt die
Verschlechterung aus dem Sondierungs-Update, sie behebt nicht die Grundlücke zur
80-%-Schranke — das bleibt ein offener, separater Befund für eine künftige Runde am Rezept
oder am Chassis selbst.

---

## 4) Was das für die Methode insgesamt heißt

Chris' Budget-Methode (Sondierung → Sinkhorn) bleibt das richtige Verfahren, um
mechanisches Gewicht gegen die Matrix zu bilanzieren — sie hat bei Arena, Bahn und
Basketball funktioniert und liefert auch für Hockey die richtigen SUB-SKILL-Zielmassen. Was
sie NICHT von sich aus sicherstellt: dass die WAHL zwischen mehreren erlaubten Attributen
innerhalb eines Sub-Skills bei Attribut-Konkurrenz das dokumentierte Führungsattribut nicht
verdrängt. Eine künftige Version von `baue-feldspiel-rezept.mjs` könnte das strukturell
lösen — etwa mit einer verzerrten Startbelegung, die dem deklarierten Führungsattribut je
Sub-Skill ein höheres Anfangsgewicht gibt, bevor Sinkhorn zu balancieren beginnt (Sinkhorns
Grenzwert ist bei vorgegebenem Nullmuster nur bis auf Zeilen-/Spaltenskalierung der
Startmatrix eindeutig — die Startverhältnisse bestimmen also die finalen Verhältnisse
innerhalb einer Zeile oder Spalte mit). Für diese Runde war die gezielte Nachkorrektur von
Hand schneller und ist gemessen, nicht nur plausibel.
