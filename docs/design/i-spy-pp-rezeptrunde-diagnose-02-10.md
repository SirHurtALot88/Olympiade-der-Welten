# I-Spy: Pp-/rho-Kalibrierungsrunde — reine Diagnose, kein Rezept geändert (Task #46, 02.10.)

## Auftrag und Ergebnis vorweg

Auftrag war, I-Spys dokumentierte rho-Lücke (zuletzt 0,756 je Spiel, 26.09.) über die 0,80-Schranke
zu bringen, ohne die Pp-Abweichung zu verschlechtern — Ist-Stand für beide Zahlen zuerst frisch
messen, bevor irgendetwas geändert wird, und die bekannte "Positiv-Summen-Normierungseffekt"-Falle
(`einflussVon()`, s. `docs/design/tdm-pp-rezeptrunde-diagnose-02-10.md`,
`docs/design/bahn-staffel-pp-rezeptrunde-02-10.md`) vorher prüfen.

**Ergebnis: reine Diagnose, kein funktionaler Code geändert.** Der Ist-Stand ist frisch kaderfest
gemessen (rho je Spiel 0,750, Saison 0,881, Pp sauber im Budget bei 16,6/12,8). Ein konkreter,
in dieser Runde eigens gebauter und wieder verworfener Kalibrierhebel (additiver EV-Bonus auf die
Rätselart-Rotation, Abschnitt 3) bewegt rho nicht über die Schranke — er bleibt innerhalb der
eigenen Kaderrauschen-Spannweite. Die Diagnose (Abschnitt 4) zeigt, warum: die verbleibende Lücke
ist eine Verlässlichkeits-/Validitäts-Tauschkurve, die bei acht Ticks je Spiel strukturell
begrenzt ist — keine Rezept-/Zahlenfrage mehr, sondern eine Konzeptfrage, für die bereits vier
ausgearbeitete, aber nicht gebaute Mechanik-Ideen vorliegen (Fable, 30.09., Abschnitt 5). Das ist
dieselbe Art Ergebnis wie bei TDM (PR, Task #39) und Bahn-Staffel (PR, Task #40): reine
Diagnose ohne erzwungene Zahlenkalibrierung, die das eigentliche Problem nur verdecken würde.

## 1. Ist-Stand, frisch gemessen

Kaderfest über die fünf Kader-Familie-Paarungen (`data/generated/kaderfamilie-live-save.json`),
exakt wie in `CLAUDE.md` vorgeschrieben.

```
node scripts/miss-alle-disziplinen.mjs 24 i-spy
```

| Kennzahl | Wert | Spannweite |
|---|---:|---:|
| rho je Spiel (Median, n=24) | **0,750** | 0,177 |
| rho Saison (Median) | **0,881** | 0,210 |
| Abnahme | "knapp" (0,70–0,80) | |

Das ist dieselbe Größenordnung wie der zuletzt dokumentierte Stand vom 26.09. (0,756/0,909,
`docs/design/stand-aller-disziplinen.md` Abschnitt 7) — die Differenz liegt klar innerhalb der
Kaderrauschen-Spannweite (0,177–0,210) und ist **keine Regression**: Die aktuell eingecheckte
CI-Basislinie (`data/generated/rangtreue-basislinie.json`, Zeile "i-spy") trägt bereits exakt
diese Zahlen (0,75/0,177/0,881/0,21). Am I-Spy-Motor wurde seit dem 26.09. nur Task #42 ("Die
Fallakte", I-5) committet — eine rein additive Anzeige ohne `rr()`-Verbrauch, die beim eigenen
Merge als rho-neutral dokumentiert ist. Die kleine Bewegung ist reines Kaderrauschen aus einem
neu gezogenen live-save-Abbild bzw. unterschiedlichen Zufallsstichproben, kein Hinweis auf ein
neues Problem.

Je Kader-Paarung (`node scripts/miss-star-paartreue.mjs 24 i-spy`), zugleich die "ehrlichere
Abnahme" G1\* aus `CLAUDE.md`:

| Paarung | rho Spiel | rho Saison | Star Rang1 | Star Top2 | Star Letzter | Paartreue(≥15) |
|---|---:|---:|---:|---:|---:|---:|
| vigilante-armageddon | 0,858 | 0,979 | 41,7 % | 95,8 % | 0,0 % | 99,7 % |
| coldsteel-direlegion | 0,750 | 0,888 | 45,8 % | 62,5 % | 0,0 % | 92,3 % |
| goldengladiators-silversoldiers | 0,707 | 0,839 | 54,2 % | 70,8 % | 0,0 % | 91,1 % |
| mortalsin-natureswrath | 0,799 | 0,881 | 58,3 % | 95,8 % | 0,0 % | 97,1 % |
| piratecrew-raginglunatics | 0,681 | 0,769 | 16,7 % | 45,8 % | 0,0 % | 95,4 % |
| **Median/Gesamt** | **0,750** | **0,881** | 43,3 % | 74,2 % | 0,0 % | 94,6 % (n=3271) |

**G1\*-Bedingungen** (CLAUDE.md, Fable-Entscheidung E1, 35 statt 22 G1-Punkte für eine
0,70–0,80-Disziplin bei vier erfüllten Bedingungen):

| Bedingung | Ziel | Gemessen | |
|---|---|---:|---|
| (a) rho Saison | ≥ 0,85 | 0,881 | ✓ |
| (b) Star Rang1 / Top2 | ≥ 50 % / ≥ 75 % | 43,3 % / 74,2 % | ✗ (knapp, −6,7 Pkt / −0,8 Pkt) |
| (c) Star nie Letzter | 0 % | 0,0 % | ✓ |
| (d) Paartreue ≥15 Punkte | ≥ 95 % | 94,6 % | ✗ (knapp, −0,4 Pkt) |

**G1\* ist nicht erfüllt, aber so knapp wie bei keiner anderen bisher geprüften Disziplin** — zwei
von vier Bedingungen fehlen um unter einem Prozentpunkt (d) bzw. unter einem Punkt (b, Top2). Das
ist der Opus-Konzeptreview-Befund vom 26.09. (dort: Star Rang1 47,5 % gegen 50 %, "nur 2,5 Punkte
unter der Schranke") nochmals bestätigt, mit frischen Zahlen.

## 2. Pp sauber im Budget — kein Zielkonflikt

```
node scripts/messe-arena-einfluss.mjs i-spy 48                     → 16,6 Pp
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs i-spy 48 10000000 → 12,8 Pp
```

| Attribut | Anteil (Saat 1) | Anteil (Saat 2) | Matrix |
|---|---:|---:|---:|
| intelligence | 19,8 % | 20,3 % | 18 |
| torment | 15,5 % | 15,7 % | 17 |
| will | 13 % | 14,2 % | 12 |
| determination | 10,2 % | 9,1 % | 8 |
| dexterity | 9,8 % | 7,9 % | 8 |
| spirit | 9,6 % | 10,6 % | 13 |
| charisma | 8,1 % | 8,3 % | 9 |
| awareness | 6,6 % | 5,8 % | 5 |
| speed | 6,1 % | 6,4 % | 8 |
| health | 1,5 % | 1,7 % | 2 |
| power | 0 % | 0 % | 0 |
| stamina | 0 % | 0 % | 0 |

Beide unabhängigen Saatströme (n=48) liegen klar unter der 25-Pp-Schranke, kein Attribut mit
Matrixgewicht > 0 liest 0 %, und `power`/`stamina` (Matrixgewicht 0) lesen korrekt 0 %. **Die
"Positiv-Summen-Normierungseffekt"-Falle aus den TDM-/Bahn-Staffel-Diagnosen greift hier nicht**:
anders als bei Bahn-Staffel (Normierungsnenner `m` wurde nur aus zwei von sieben Sub-Skills
gebildet) und TDM (`aufEignung()`s Normierung ließ TMP/AUS außen vor) bezieht I-Spys
`ispyBesterWeg()`/Sub-Skill-Rechnung alle zehn Matrixattribute über die sieben Sub-Skill-Mischungen
(`rezept`) ein — es gibt keinen versteckten, nicht normierten Nenner. Auch die ältere,
projektweite `p.d[disziplin]||0`-Lücke (CLAUDE.md, "Dieselbe Eignungslücke saß in ALLEN VIER
Chassis") betrifft I-Spy nicht: das Rezept wurde erst nach deren Behebung (02.09.) am 21.09./
22.09. gebaut und bezieht die Sub-Skills direkt aus `gewichtet()` über die volle Matrix, nicht aus
einem vorberechneten `p.d`-Cache. **Es gibt also keinen Zielkonflikt rho-vs-Pp zu lösen** — das
Rezept belohnt bereits die vorgegebenen Attribute; die rho-Lücke liegt woanders.

## 3. Geprüft und verworfen: Fable-Idee I-6 (Rätselart-Rotationsbonus)

`docs/design/fable-ideen-arena-ispy-30-09.md` Abschnitt 6 schlägt I-6 vor: "nach jedem
Knackversuch rotiert die bevorzugte Art … F2 bekommt einen kleinen Bonus auf die Art, die der
Spieler zuletzt *nicht* gespielt hat" — ausdrücklich als "Diagnose-Messung auf dem bestehenden
Kern, nicht als P1-Wiederbelebung", weil der P1-Befund (26.09.) zeigte, dass die Durchmischung
über die drei Rätselarten (Logik/Verhör/Mechanik) die Saison-Validität trägt (reiner `argmax`
0,671 gegen `avg` 0,776 Saison — die größte Einzelbewegung aller P1-Stellschrauben).

**Umgesetzt** (nur in einer lokalen Arbeitskopie, nie committet — Vorgehen wie beim
P1-Prototyp): `u._letzteArt` merkt sich je Teilnehmer die zuletzt bearbeitete Rätselart; die
EV-Bewertung in der F2-Wahl (`baueSchatzsuche()`) bekommt einen Faktor `1+ISPY_ROTATION_BONUS`
auf Truhen einer ANDEREN Art als der zuletzt gespielten. Bei `ISPY_ROTATION_BONUS=0` ist das
bit-identisch zum Ist-Stand (bestätigt: `miss-alle-disziplinen.mjs 24 i-spy` liest exakt
0,750/0,177/0,881/0,210, Seitenfehler keine).

**Gemessen** (`node scripts/miss-alle-disziplinen.mjs 24 i-spy`, jeweils nur der Bonus-Wert
geändert):

| ISPY_ROTATION_BONUS | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite |
|---:|---:|---:|---:|---:|
| 0 (Ist-Stand) | 0,750 | 0,177 | 0,881 | 0,210 |
| 0,1 | 0,760 | 0,177 | 0,860 | 0,252 |
| 0,2 | 0,740 | 0,163 | 0,888 | 0,217 |
| 0,4 | 0,747 | 0,174 | 0,888 | 0,210 |

**Kein Hebel.** Die vier Werte (0,740–0,760) schwanken nicht monoton mit der Bonusstärke und
liegen alle innerhalb der eigenen Kaderrauschen-Spannweite (0,163–0,252) — von Null nicht zu
unterscheiden, wie `docs/design/messgrundlage-kaderfest.md` es für genau diesen Fall definiert.
Die Patch-Datei wurde **nicht committet**; `public/mockups/battle-mode.engine.js` ist nach dem
Experiment bit-identisch zum Stand vor dieser Runde (per `git checkout --`/md5sum geprüft) bis auf
den erklärenden Kommentar in dieser PR.

**Warum der Hebel nicht greift (die eigentliche Diagnose):** I-Spys Ist-Stand hat die
Durchmischung, die P1 fehlte, bereits eingebaut — nicht als expliziten Bonus, sondern strukturell.
Zwölf Fundorte sind ein **geteilter** Zustand über alle zwölf Teilnehmer EINER Seite; `belegt`
sperrt eine besuchte Truhe für den Rest des Ticks. Über acht Ticks hinweg zwingt diese Konkurrenz
jeden Teilnehmer faktisch dazu, mehrere Rätselarten zu bearbeiten, weil seine bevorzugte Art oft
schon besetzt ist, wenn er an der Reihe ist (`ISPY_REIHENFOLGE_NERVEN_ANTEIL`-Reihenfolge). Genau
dieser Mechanismus — nicht ein fehlender expliziter Rotationsbonus — ist das, was P1 beim Umstieg
auf personengebundene, unkonkurrierte Spuren verlor (P1-Befund Abschnitt 3, Punkt 1: "Ohne diesen
Zwang … bricht diese Durchmischung weg"). Ein zusätzlicher expliziter Bonus auf dieselbe
Durchmischung, die der geteilte Pool schon erzwingt, hat nichts mehr beizutragen — er verschiebt
nur, WELCHE der ohnehin schon gemischten Arten ein Spieler in einem gegebenen Tick bevorzugt,
ändert aber nicht, DASS er über das Spiel hinweg mischt.

## 4. Warum die Lücke bleibt — Verlässlichkeit/Validität, nicht Rezept

Der Opus-Konzeptreview (26.09., Abschnitt 3.2) hat die Zerlegung vorgerechnet:
`rho(Spiel) = rho(Saison) · √Verlässlichkeit` (CLAUDE.md). Mit den frischen Zahlen:

    Verlässlichkeit = (0,750 / 0,881)² = 0,724
    nötig für 0,80 bei Validität 0,881: (0,80 / 0,881)² = 0,825   → +0,10 Verlässlichkeit nötig

Das ist dieselbe Tauschkurve, die der Konzeptreview am 26.09. bei der damaligen Validität (0,909)
mit +0,083 bezifferte — heute, bei etwas niedrigerer (innerhalb des Kaderrauschens liegender)
Validität, ist der nötige Sprung sogar etwas größer. Die im Konzeptreview selbst durchgemessenen
Hebel für mehr Verlässlichkeit sind erschöpft:

- **Mehr Ticks helfen kaum** (CLAUDE.md-Lehre, hier bestätigt: 8→16 Ticks maß nur +0,011 rho,
  `stand-aller-disziplinen.md` Abschnitt 7).
- **Teilpunkte entfernen** (volle Auszahlung erst bei Erfolg) **senkt die Validität** (0,909→0,867
  im Konzeptreview) — Verlässlichkeit und Validität tauschen auf derselben Kurve, kein Gewinn.
- **Reaktionskanal verstärken** senkt die Validität noch stärker (volle Sicht: 0,909→0,804).
- **Rezept-Feinjustierung** (diese Runde, Abschnitt 3) bewegt gar nichts — die relevante
  Durchmischung ist strukturell, nicht rezeptabhängig.
- **P1 "Spur statt Los"** (vollständiger Architekturumbau, 26.09.) hat genau diese Tauschkurve
  verschoben, aber in die FALSCHE Richtung (0 von 5 Kader-Paarungen besser, Star Rang1 38,3 %
  gegen gefordert 47,5 %) — mehr/größere Ereignisse ohne die geteilte Ressource verlieren Validität
  schneller, als sie Verlässlichkeit gewinnen.

**Das ist eine Konzeptfrage, keine Zahlenfrage mehr.** Die einzigen noch nicht ausprobierten Hebel
sind echte Mechanik-Ergänzungen, die den geteilten Pool NICHT ersetzen, sondern einen zusätzlichen,
eigenständigen Kanal daneben stellen — genau das, was `docs/design/fable-ideen-arena-ispy-30-09.md`
Abschnitt 6 mit I-1 bis I-4 vorschlägt (alle Klasse M, Chris' Zustimmung vorausgesetzt):

| Idee | Was | Aufwand |
|---|---|---|
| I-1 Raumwahl | Jede Seite wählt vor dem Spiel einen von drei Räumen mit leicht verschobener Art-Punktmasse — eine echte, spiegelfreie Aufstellungsentscheidung | mittel |
| I-2 Mehrwege im Finden | Der Spürwurf bekommt zwei Nebenwege (Befragen/Beschatten neben Beobachten) — verbreitert die Attributmischung genau am Tor, das laut P1-Befund Signal UND Rauschen trägt | mittel |
| I-3 Nebenweg macht Lärm | Tresor-Nebenweg zahlt voll, ist dafür für die Gegenseite hörbar — macht den heute kaum genutzten Nebenweg (3,71 % der Züge) attraktiver | klein |
| I-4 Kooperations-Truhe | Eine Zwei-Personen-Truhe je Raum — benanntes Risiko: geteilter Zustand INNERHALB des Teams, nur mit paarweiser Abnahme (≥4 von 5) vertretbar | mittel |

Keine davon wurde in dieser Runde gebaut — sie sind Mechanik-Ergänzungen, keine Kalibrierung, und
brauchen nach Projektkonvention (Abschnitt "mehrere Wege zum Erfolg", CLAUDE.md) eine bewusste,
dokumentierte Design-Entscheidung, keine automatische Umsetzung durch einen Kalibrierungs-Agenten.

## 5. Offene Entscheidung für Chris

Zwei unabhängige, sich nicht ausschließende Wege liegen auf dem Tisch:

1. **Die "ehrlichere Abnahme" G1\*** (CLAUDE.md) auf I-Spy anwenden: Saison-Validität (0,881)
   erfüllt die 0,85-Schranke komfortabel, Star landet nie auf dem letzten Rang — nur Star-Rang1/
   Top2 (43,3 %/74,2 % gegen 50 %/75 %) und Paartreue (94,6 % gegen 95 %) fehlen, beide um
   weniger als einen Punkt bzw. unter sieben Punkten. Das ist die knappste Verfehlung aller bisher
   so geprüften Disziplinen und ein starker Kandidat für eine bewusste Chris-Entscheidung, I-Spy
   die 35-Punkte-G1\*-Einstufung zu geben, statt eine weitere Rezeptrunde zu versuchen.
2. **Eine der vier Fable-Ideen (I-1 bis I-4) bauen und PR-0-artig abnehmen**, wie beim
   gescheiterten P1-Anlauf — mit demselben Abbruchkriterium-Muster (Median ≥ 0,80, paarweise
   ≥ 4 von 5 besser, Star-Bedingungen), damit ein zweiter Fehlschlag früh und günstig auffällt.

Diese PR trifft keine der beiden Entscheidungen — sie liefert die frische Messung, die geprüfte
und verworfene Kalibrierhypothese, und die Diagnose, warum eine weitere Zahlenrunde allein nicht
reichen wird.

## 6. Reproduktion

```sh
node scripts/miss-alle-disziplinen.mjs 24 i-spy
node scripts/miss-star-paartreue.mjs 24 i-spy
node scripts/messe-arena-einfluss.mjs i-spy 48
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs i-spy 48 10000000
```

Der I-6-Rotationsbonus-Patch wurde nicht committet; wer ihn reproduzieren will, fügt in
`ispyBaueRaum()` ein `u._letzteArt=null` und in der F2-Bewertung in `ispySeiteTick()` einen
Faktor `(1+ISPY_ROTATION_BONUS)` auf Truhen mit `t.art!==u._letzteArt` ein (s. Abschnitt 3) und
setzt `u._letzteArt=wahl.t.art` nach der Wahl.
