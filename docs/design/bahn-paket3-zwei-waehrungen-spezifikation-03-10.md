# Bahn Paket 3 „Zwei Währungen": Spurt-Parcours + Zeitfahren-Kurven-Risiko — Spezifikation für Chris (03.10.)

**Task #29 im Backlog. Reine Spezifikation, kein Code geändert.** Nach Paket 1 (Haushalt
TT-P1/SP-P1, PR #1035, 26.09.) und Paket 2 (Takeshi `rezept.WUCHT` kalibriert, Task #28, PR
#1121, 02.10.; `fallenDurchbruch` dort separat gemessen und verworfen, Task #40/#45) ist dies
die Spezifikation für das dritte Bahn-Paket. Gelesen: `docs/design/fable-ideen-bahn-30-09.md`
(das Konzeptpapier, aus dem „Zwei Währungen" stammt, Abschnitt 1.1/2.2/3.1/3.2/6/7),
`docs/design/bahn-disziplinen-opus-konzeptreview-26-09.md`, `docs/design/stand-aller-
disziplinen.md`, `docs/design/manager-risiko-interaktivitaet-konzept-02-10.md` (verweist an
zwei Stellen auf #29), `docs/design/bahn-takeshi-wucht-kalibrierung-02-10.md` und
`docs/design/bahn-takeshi-pp-paket2-kalibrierung-01-10.md` (Messmethode/Stil für ein Bahn-Paket),
sowie die aktuellen `BAHN_ART.spurt`- (`:34094` ff.) und `BAHN_ART["time-trial"]`-Blöcke
(`:34335` ff.) in `public/mockups/battle-mode.engine.js`.

## 0. Ergebnis vorweg

**Beide Teile dieses Pakets sind Klasse B — echte Mechanikänderungen, die laut dem eigenen
Klassenschema des Konzeptpapiers (`fable-ideen-bahn-30-09.md` Abschnitt 0.5) Chris' Zustimmung
brauchen, bevor gebaut wird.** Keiner der beiden Teile ist Klasse T (kein neuer Stopp, keine
verzögerte Enthüllung, keine Wandzeit-Änderung — beide wirken rein innerhalb der laufenden
Simulation über `tempoVon()`/`gelaendeFaktor()`/`stepSpurt`), also greift die Klasse-T-Sperre
hier nicht. Aber: Für Klasse B gilt im etablierten Muster dieser Session (zuletzt PR #1127 „Bahn-
Staffel WECHSEL_*/KURVE_*-Kalibrierung: Diagnose, kein Code geändert", PR #1129 „Broadcast D7 +
A4 — Entscheidung ausstehend", PR #1131/#1133) dasselbe Prinzip wie bei Klasse T: ein Agent baut
die Mechanik nicht auf eigene Einschätzung hin, sondern legt eine bau-fertige Spezifikation vor
und wartet auf Chris' Go. Ich habe deshalb **keinen Code geändert** — weder an `tempoVon()`,
`gelaendeFaktor()`, `stepSpurt` noch an `BAHN_ART`. Was hier steht, ist die Spezifikation, mit der
die nächste Runde sofort bauen kann, sobald Chris zugestimmt hat.

Es gibt innerhalb dieses Pakets **keinen unkritischen Teilbereich**, der ohne Mechanikänderung
auskäme: Beide Vorschläge ändern nachweislich Zeit- oder Kraftkanäle (neue Felder, die
`gelaendeFaktor()`/`stepSpurt` tatsächlich lesen), keine Anzeige-Variante davon ist im
Konzeptpapier beschrieben. Etwas zu bauen, das reine Anzeige wäre, hieße, Umfang zu erfinden, den
das Papier nicht hergibt — ausdrücklich nicht gewünscht.

## 1. Scope-Klärung — ein Fund, der vor dem Bau geklärt werden sollte

Der Task-Titel nennt „Spurt 3-Parcours + TT Kurven-Risiko", und das entspricht wörtlich den
Abschnitten **3.1** („Drei Parcours: Sprinterkurs, Ninja-Kurs, Ausdauerkurs") und **2.2**
(„Kurven-Risiko") aus `fable-ideen-bahn-30-09.md`. Ich lege die Spezifikation für genau diese
beiden unten vor (Abschnitt 2 und 3).

**Aber:** `fable-ideen-bahn-30-09.md` selbst führt 3.1 **nicht** als Anwendung des „Zwei
Währungen"-Prinzips — Abschnitt 1.1 zählt als Anwendungen explizit nur „1.2 (Überziehen), 2.2
(Kurven-Risiko), 2.3 (Abfahrt als Erholung), 3.2 (Schleife oder Durchbruch nach Puste)" auf. 3.1
ist eine reine Streckenvariante (andere Stationspositionen, keine zweite Währung). Die spätere
Konsultation `manager-risiko-interaktivitaet-konzept-02-10.md` verweist an zwei Stellen explizit
auf #29 — einmal für Zeitfahren („Später Kurven-Risiko aus #29", Zeile 104, passt zu 2.2) und
einmal für Spurt, aber dort nicht für 3.1, sondern für **3.2**: „Angreifen senkt die Schwelle für
Durchbruch-per-Wucht statt Ausweichen (kostet Puste). Gehört zu #29." (Zeile 106) — das ist exakt
die „Zwei Währungen"-Anwendung aus 3.2, nicht die Parcours-Variante aus 3.1.

Es gibt also zwei leicht verschiedene, beide plausible Lesarten von „die Spurt-Hälfte von Paket
3":
- **Wörtlich nach Task-Titel:** 3.1, Drei Parcours (Streckenvariante, kein Zwei-Währungen-Fall).
- **Nach dem Paketnamen „Zwei Währungen" und der neueren Quer-Referenz:** 3.2, Schleife-oder-
  Durchbruch nach Puste (die tatsächliche zweite-Währung-Anwendung im Spurt).

Ich spezifiziere unten **3.1**, weil es der Task-Titel wörtlich verlangt, und lege **3.2** als
knappe Alternative daneben (Abschnitt 4), falls Chris das meinte. Beide sind unabhängig baubar
und unabhängig voneinander zu messen (Reihenfolge-Regel des Konzeptpapiers: „nie zwei Eingriffe
in einer Messung", Abschnitt 7).

## 2. Zeitfahren — Kurven-Risiko (Fable 2.2)

**Was.** Die Kurvenzone liest heute nur TECHNIK (Primärweg, „Linie": Intelligence 40 / Dexterity
34 / Awareness 26 — `kurveSkill:"TECHNIK"`, `kurveKosten:0.16`, `engine.js:34417`). Vorschlag: ein
zweiter, optionaler Weg über WUCHT („Risiko": Torment 40 / Dexterity 32 / Awareness 28 — derselbe
Sub-Skill, der schon `bergNebenSkill` am Berg trägt, `:34378`). Der Fahrer bremst spät; sein
Zeitverlust in der Kurve sinkt um einen von WUCHT abhängigen Anteil, kostet dafür zusätzlich
Puste über die Kurvenzone (ein `kurveNebenZehr`-Faktor auf `zehr`, nach demselben Muster wie
`bergZehr:1.1` es für den Berg schon tut). Kein Sturz, kein neuer `rr()` — deterministisch, wie
die Kurve es heute schon ist.

**Konkreter Vorschlag für den Bau** (Zahlen aus dem Konzeptpapier, hier mit expliziten
Platzhaltern, damit die Bau-Runde nur noch Werte kalibrieren muss, nicht das Muster entwerfen):

```
// nur BAHN_ART["time-trial"], jede andere Bahn bleibt bit-identisch
kurveNebenSkill:"WUCHT", kurveNebenAnteil:0.30,   // Startwert wie bergNebenAnteil vor dem
                                                    // Pp-Kalibrierschritt (0,30 -> 0,40 dort)
kurveNebenZehr:1.15,                               // zehrt beim Nebenweg etwas mehr als die
                                                    // Grund-Kurve (1,0); zu kalibrieren
```

`gelaendeFaktor()` bekommt für die Kurvenzone denselben Nebenweg-Mechanismus, den es für den Berg
bereits hat (`bergNebenSkill`/`bergNebenAnteil`, `:36666`) — keine neue Funktion, eine
Verallgemeinerung der bestehenden Berg-Logik auf die `art:"kurve"`-Zonen. Die Puste-Zehrung läuft
über denselben `zehr`-Multiplikator-Pfad wie `bergZehr` (`:36685`).

**Warum diese Disziplin, warum jetzt.** Zignoli 2021 (zitiert in der Fable-Recherche 3.2): In der
Kurve ist die Antriebsleistung null, der Verlust kommt auf der Geraden nicht zurück — außer man
trägt mehr Tempo hinein, was danach Beschleunigungsarbeit kostet. Vor der Haushalt-Runde (PR
#1035) hätte ein Puste-Preis nichts gekostet (Zeitfahren-Restpuste lag bei 14–17 %, batte also
nicht); seit TT-P1 bindet die Puste wirklich (Fangen erst bei 30 % Reserve), der Designraum ist
also seit dem 26.09. offen, nicht länger.

**rho/Pp, was zu prüfen ist.** Aktuelle Werte (kaderfest, `stand-aller-disziplinen.md`/Fable-Doc
0.1): rho/Spiel Zeitfahren 0,929 (höchster Wert der Gruppe, viel Puffer), Pp 22,8 (nah an der
25er-Schranke). Das Konzeptpapier warnt ausdrücklich: Stamina ist der bekannteste Überzeichner im
Zeitfahren (+9,8 Pp nach dem letzten Kalibrierschritt, `engine.js:31163`/`:34370`-Kommentar) —
jeder zusätzliche Puste-Kanal verschiebt Gewicht Richtung STEHEN/ROBUST (Stamina-nah) und muss
deshalb **klein dosiert** werden. Die Bau-Runde muss nach dem Einbau mindestens messen:
- `node scripts/miss-alle-disziplinen.mjs 24 zeitfahren` (bei dünner Marge zusätzlich n=48) —
  Ziel rho > 0,80, angestrebt 0,85, real „nicht schlechter als die aktuellen 0,929".
- `node scripts/messe-arena-einfluss.mjs time-trial 24` an zwei unabhängigen Saatströmen
  (`--saat-versatz=10000000`) — Ziel Pp-Abweichung ≤ 25; die 22,8 heute sind schon nah dran, also
  ist das Budget für den Kurven-Nebenweg klein.
- Isolationsnachweis: `node scripts/miss-alle-disziplinen.mjs 24` (alle zwanzig, ohne Filter) —
  nur Zeitfahren darf sich bewegen, da `kurveNebenSkill`/`kurveNebenZehr` nur in
  `BAHN_ART["time-trial"]` gesetzt würden (Konvention: ungesetztes Feld = wirkungslos).
- Bei zwei Fahrern je Seite (kleinste gewürfelte Kadergröße) Star-in-Top-2 und Paartreue mit
  Abstand statt nacktes rho prüfen (CLAUDE.md, `spurt-offene-fragen…` Frage 5 analog).

**Für Chris:** Darf das Zeitfahren in der Kurve einen zweiten, WUCHT-basierten Weg bekommen, der
Zeit gegen Puste tauscht? Und: Soll `kurveNebenAnteil` so dosiert werden, dass TECHNIK klarer
Primärweg bleibt (wie `bergNebenAnteil` 0,40 den Berg bei ENDTEMPO als Primärweg belässt), oder
gleichauf?

## 3. Spurt — Drei Parcours (Fable 3.1)

**Was.** Die sieben Spurt-Stationen stehen heute bei festen Positionen `[0.14, 0.26, 0.38, 0.50,
0.62, 0.74, 0.86]` (`engine.js:34122`, zwölf Prozent Abstand). Vorschlag: `kurse[]` in
`BAHN_ART.spurt`, nach dem bereits im Motor vorhandenen Takeshi-Muster (`kurse[]`, per Saat
gewählt — Takeshi nutzt es für Fallen-**Reihenfolge**, hier wären es Stations-**Positionen**),
mit drei benannten Varianten:

| Kurs | Stationen bei | Charakter |
|---|---|---|
| Sprinterkurs | 0,30 · 0,38 · 0,46 · 0,54 · 0,62 · 0,70 · 0,78 | 30 % freie Gerade vorn, dichte Kette danach, 22 % Auslauf |
| Ninja-Kurs | 0,08 · 0,16 · 0,30 · 0,44 · 0,58 · 0,72 · 0,86 | erste Station bei 8 %, Antritt zählt kaum |
| Ausdauerkurs | 0,14 · 0,26 · 0,38 · 0,50 · 0,62 · 0,74 · 0,86 (heutige Positionen) | drei Kraftstationen ans Ende |

`hindernisBilder`/`hindernisNamen` folgen dem Index, wie beim Takeshi-Kurs-Mechanismus bereits
gelöst (`bahnKursName`, `:32858`).

**Warum diese Disziplin.** Speed ist mit 18 die höchste Einzelzahl der Spurt-Matrix, hat aber
nach Opus' Befund an den Stationen selbst keinen Weg, sich auszudrücken — er zählt nur zwischen
den Stationen (ANTRITT/ENDTEMPO). Heute sind diese Zwischenräume bei jedem Rennen gleich; der
Sprinterkurs würde erstmals eine Variante geben, in der die freie Gerade selbst zur Aufstellungs-
frage wird.

**rho/Pp, was zu prüfen ist.** Aktuell rho/Spiel Spurt 0,906, Pp 11,4 (die beste Pp-Zahl der
Gruppe — viel Spielraum, aber auch am meisten zu verlieren). Das Konzeptpapier selbst warnt: Pp
muss **gemittelt über alle drei Kurse** ≤ 25 bleiben, Korridor je Einzelkurs ≤ 35 (eigener
Vorschlag des Papiers, Abschnitt 3.1). Takeshis Kurs-Varianten bewegten rho dort nur innerhalb der
Kader-Spannweite (0,073) — aber Takeshis Kurse ändern nur die Reihenfolge, nicht die absoluten
Positionen; der Sprinterkurs hier verschiebt tatsächlich Gewicht zu Speed und ist deshalb ein
größerer Eingriff als die Takeshi-Präzedenz. Zu messen, sobald gebaut:
- `node scripts/miss-alle-disziplinen.mjs 24 spurt` je Kurs einzeln + gemittelt (n=48 bei dünner
  Marge).
- `node scripts/messe-arena-einfluss.mjs spurt 24` je Kurs, zwei Saatströme, gemittelte Pp ≤ 25,
  Einzelkurs ≤ 35.
- Isolationsnachweis über alle zwanzig (`miss-alle-disziplinen.mjs 24`, nur Spurt bewegt sich).
- ANTRITT ist auf 3,2 Sim-Sekunden ab Start fest — beim Ninja-Kurs liegt die erste Station bei 8 %
  **innerhalb** der Antrittsphase; laut Konzeptpapier gewollt (der Turner braucht keinen Antritt),
  aber ausdrücklich zu messen, nicht nur zu behaupten.
- Bei zwei Läufern je Seite (kleinste Kadergröße): Star-in-Top-2/Paartreue je Kurs halten.

**Für Chris:** Drei Fragen, keine davon ist mit diesem Papier beantwortet: (1) Soll der Kurs vor
dem Spieltag sichtbar sein, damit er eine Aufstellungsfrage wird (Fable-Frage 2, Abschnitt 8) —
oder bleibt er Überraschung? (2) Sind die drei vorgeschlagenen Streckenprofile so gewollt, oder
andere Positionen/Namen? (3) Reicht die Pp-Korridor-Regel (≤35 je Kurs, ≤25 gemittelt), oder soll
jeder Einzelkurs die 25er-Schranke für sich halten?

## 4. Alternative Lesart der Spurt-Hälfte: 3.2 „Schleife oder Durchbruch nach Puste"

Falls mit „Paket 3 Zwei Währungen" für Spurt tatsächlich die namensgebende Mechanik gemeint war
(wie die Quer-Referenz in `manager-risiko-interaktivitaet-konzept-02-10.md` Zeile 106 nahelegt),
hier die knappe Spezifikation dazu — kleiner Aufwand, weil er auf dem bereits gebauten
`wuchtKraft`-Pfad aufsetzt, aber **mit derselben Voraussetzung wie im Konzeptpapier genannt**: er
baut auf SP-P2 (Opus' Strafschleife statt Sturz) auf, die nach meiner Prüfung **noch nicht
gebaut ist** (kein `strafschleife`/vergleichbares Feld in `BAHN_ART.spurt`, nur der bestehende
`wuchtKraft`/Sturz-Pfad). Ohne SP-P2 gibt es keine Schleifen-Alternative, zwischen der und dem
Durchbruch gewählt werden könnte — diese Variante ist also **zusätzlich von einer noch nicht
gebauten Vorstufe abhängig**, nicht nur von Chris' Zustimmung.

**Was (sobald SP-P2 existiert).** Der Durchbruch per WUCHT kostet Puste (`wuchtKraft`, heute
schon Teil des Sturz-Pfads); die Schleife kostet Zeit, aber keine Puste. Ein Läufer unter einer
Restpuste-Schwelle (Vorschlag: unter `pusteFangen` plus Durchbruchskosten) geht direkt in die
Schleife, ohne Versuch; mit Reserve versucht er zuerst Technik, dann Wucht. Deterministisch, kein
neuer `rr()`.

**rho/Pp.** Reduziert den teuren Sturz-Wurf bei ohnehin leeren Läufern (Verlässlichkeitsgewinn);
Pp: STEHEN (seit Paket 1 Torment/Health/Dexterity) gewinnt leicht — plausibel richtig, weil Torment
in der Spurt-Matrix lange bei 0 % Einfluss lag, aber ungemessen. Gleiche Messpflicht wie Abschnitt
3 oben, nur eben erst nach SP-P2.

**Empfehlung:** Diese Variante nicht statt 3.1 bauen, sondern als eigenständigen Folge-Task nach
SP-P2 führen — sie ist enger an den Paketnamen „Zwei Währungen" geknüpft, aber heute nicht
baubar, ohne SP-P2 vorzuziehen (ein zweiter, größerer Eingriff, der eine eigene Chris-
Entscheidung bräuchte).

## 5. Was dieses Papier nicht tut

- Kein Code in `public/mockups/battle-mode.engine.js` geändert — weder `BAHN_ART`, noch
  `tempoVon()`, `gelaendeFaktor()`, `stepSpurt`.
- Keine Messung gefahren. Alle rho/Pp-Zahlen oben sind aus `stand-aller-disziplinen.md` und dem
  Fable-Konzeptpapier übernommen (mit Quellenangabe), keine neue Sonde dieser Runde.
- Keine Entscheidung über 3.1 gegen 3.2 getroffen — beide liegen spezifiziert vor Chris.

## Quellen

`docs/design/fable-ideen-bahn-30-09.md` (Abschnitte 0.5 Klassenschema, 1.1 Zwei-Währungen-
Prinzip, 2.2 Kurven-Risiko, 3.1 Drei Parcours, 3.2 Schleife-oder-Durchbruch, 6 Mehrwege-Tabelle, 7
Prioritätstabelle, 8 Fragen an Chris), `docs/design/bahn-disziplinen-opus-konzeptreview-26-09.md`,
`docs/design/manager-risiko-interaktivitaet-konzept-02-10.md` (Zeilen 104/106, Quer-Referenz auf
#29), `docs/design/stand-aller-disziplinen.md` (Pp-/rho-Tabelle), `docs/design/bahn-takeshi-wucht-
kalibrierung-02-10.md` und `docs/design/bahn-takeshi-pp-paket2-kalibrierung-01-10.md` (Paket-2-
Präzedenz, Messmethode), `engine.js` `BAHN_ART.spurt` `:34094` ff. (`hindernisse` `:34122`),
`BAHN_ART["time-trial"]` `:34335` ff., `bergNebenSkill`-Mechanismus `:36666`, `bergZehr`-Pfad
`:36685`, Takeshi-Kurs-Mechanismus `bahnKursName` `:32858`.
