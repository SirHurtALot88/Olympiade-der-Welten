# Arena-Zielwahl-Messsonde (Task #26, 02.10.) — P0-Bugfix + Rangvarianz-Aufschlüsselung

Reine Mess-/Diagnose-Runde, ausgelöst durch eine Opus-Konsultation (Task #26, 02.10.), die
Arena-Kämpfe (TDM/Mini-DM/Battlefield) mit einer bindenden rho-Verletzung fand (TDM rho=0,404
gegen die CLAUDE.md-Schranke 0,80, s. `docs/design/tdm-pp-rezeptrunde-diagnose-02-10.md`
Abschnitt 3) und vermutete, dass der "Zugang" zu Kämpfen (wie oft ein Spieler als Ziel gewählt
wird) kaum mit Eignung zusammenhängt. **`chooseTarget`, `PERSZIEL`, `bedrohungVon` und
`schlachtplan` wurden inhaltlich nicht angefasst** — beide Teile dieser Runde sind
Mess-Sonden-Arbeit (Klasse A).

**Nachtrag (02.10., nach unabhängiger Review):** die erste Fassung dieses Dokuments enthielt
eine falsche Kausalerzählung ("GAST = reine Geometrie") und zwei zu optimistische Aussagen
("ergebnisgleich für TDM", Verifikation ohne den eigentlich nötigen Rollentausch-Lauf nach dem
Fix). Alle drei sind unten korrigiert; die Code-Änderung selbst war davon nicht betroffen und
blieb unverändert.

## Teil 1: P0-Bugfix — Heim/Gast-Zielwahl-Asymmetrie in der Kader-Familie-Sonde

### Befund

`disziplinProbe()`s Kader-Familie-Pfad tauscht `SQUAD`/`OPP` für jede Paarung aus, füllt dabei
aber **nie `place[]`** (die Aufstellungstabelle) für die neuen Namen. Das bricht `schlachtplan()`
lautlos:

- `schlachtplan()` ruft `gegnerVorschau()`, und die liest ausschließlich `inDisc("tdm")` —
  fest verdrahtet auf die Zeichenkette `"tdm"`, nicht auf die gerade gemessene Disziplin, und
  nur von der **SQUAD(heim)**-Seite (`inDisc=(d)=>SQUAD.filter(p=>place[p.n]&&place[p.n].d===d)`).
- Ohne `place`-Einträge für die SQUAD-Namen ist `inDisc("tdm")` leer, `gegnerVorschau()` liefert
  `[]`, `schlachtplan()` liefert `null`.

**Was das NICHT bedeutet (Korrektur gegenüber der ersten Fassung dieses Dokuments):** die
GAST-Seite fällt dadurch NICHT auf reine Geometrie zurück. `baueEinheit()`s
`zielP:zielPers||PERSZIEL[persOf[p.n]||"duellant"]` greift für GAST genauso wie für HEIM — ist
der von `schlachtplan()` kommende `zielPers`-Parameter `null` (gebrochener Plan), fällt `zielP`
auf den **PERSZIEL-Wert der Persönlichkeit dieser einen Einheit** zurück (bollwerk→naechster,
draufgaenger→speer, duellant→bedrohung, schleicher→hinten, beschuetzer→schild,
opportunist→schwach) — nicht bedingungslos auf `nearest(foes)`. Die einzige echte Ausnahme ist
die Persönlichkeit "bollwerk" (→"naechster", reine Geometrie) — und die degeneriert IDENTISCH
auch für HEIM, weil `zielOf[p.n]` (die manuelle Übersteuerung) in der automatisierten Sonde nie
gesetzt ist.

**Was es tatsächlich bedeutet:** ohne `schlachtplan()` verliert die GAST-Seite die
TEAM-KOORDINIERTE Zuteilung (wer bindet den Zähesten/"fels", wer flankiert wen gezielt,
`ord:"mitlinie"`/`"flanke"` nach Team-Analyse der eigenen und gegnerischen Stärken statt nach
reiner Slot-Vorgabe) und fällt auf INDIVIDUELLE, nicht team-abgestimmte
Persönlichkeits-Zielwahl zurück. Die HEIM-Seite nutzt ohnehin immer nur die individuelle
PERSZIEL-Zielwahl (nie `schlachtplan()`). Der Unterschied ist also **"Team-Plan vs.
Einzelverhalten"**, nicht "Taktik vs. Geometrie" — eine reale, aber kleinere Lücke als zuerst
beschrieben.

Betroffen sind **vier von fünf** Kader-Paarungen in `data/generated/kaderfamilie-live-save.json`
— die erste ("vigilante-armageddon") trägt zufällig dieselben Namen wie der alte hartkodierte
SQUAD/OPP-Testkader (für den `place[]` beim Modul-Start sechs feste Einträge bekommt), die
anderen vier nicht. Der Zustand besteht seit der Umstellung auf die Kader-Familien-Methodik
(03.09.2026) und betrifft seither jede TDM/Mini-DM/Battlefield-Rangtreue-Messung des Projekts.

### Verifikation (vollständig: Rollentausch VOR und NACH dem Fix)

Ein Rollentausch derselben Kader-Paarung (heim↔gast, sonst identisch), coldsteel-direlegion,
n=8, beide Orientierungen (eigenständig nachgemessen, nicht nur aus der Review übernommen):

| | "coldsteel=heim" | "direlegion=heim" (getauscht) |
|---|---:|---:|
| main (vor dem Fix) | −1,78 Pp (gast vorn) | +4,01 Pp (heim vorn) |
| PR (nach dem Fix) | +0,57 Pp (heim knapp vorn) | +3,77 Pp (heim vorn) |

(Score-Anteil-Überschuss von "heim" über 50 %, je Orientierung; positiv = heim im Vorteil.)
Die unabhängige Review maß auf derselben Paarung mit einer eigenen Methode/Metrik ähnliche
Größenordnungen (main ≈+2,2 Pp, PR ≈+4,3 Pp, dort vermutlich über beide Orientierungen
gemittelt oder anders normiert — die genaue Kennzahl war in der Review-Rückmeldung nicht
spezifiziert).

**Der rollengebundene Heim-Vorteil verschwindet durch den Fix NICHT.** Auf `main` ist der
Effekt zwischen den beiden Orientierungen sogar WIDERSPRÜCHLICH gerichtet (−1,78 vs. +4,01) —
bei n=8 ist nicht klar, ob überhaupt ein konsistenter Rolleneffekt vorliegt oder nur
Kaderrauschen (die beiden Teams sind nicht gleich stark). Nach dem Fix zeigen BEIDE
Orientierungen einen Heim-Vorteil (+0,57 und +3,77) — der Effekt wird also eher
KONSISTENTER sichtbar, nicht kleiner. Das widerspricht der ursprünglichen Erwartung dieser
Verifikation (die erste Fassung dieses Dokuments zeigte nur EINE Richtung und behauptete
fälschlich, der Effekt sei durch die Rolle allein erklärt und werde durch den Fix adressiert).
Die wahrscheinlichste Erklärung nach der Korrektur in Abschnitt "Befund": der Fix behebt eine
ECHTE, aber kleinere Lücke (Team-Plan vs. Einzelverhalten auf der GAST-Seite); der hier
gemessene Heim-Vorteil hat mindestens eine weitere, von diesem Fix unberührte Ursache (denkbar:
die allgemeine Heim-Aufstellungslogik in `build()`, oder schlicht Kaderrauschen bei n=8 — nicht
in dieser Runde weiter untersucht, da außerhalb des Fix-Umfangs). Diese Beobachtung relativiert,
wie viel die Teil-1-Korrektur an der rollengebundenen Verzerrung tatsächlich auflöst.

### Fix (nur in der Mess-Sonde)

`disziplinProbe()`s Kader-Familie-Zweig füllt `place[]` für die SQUAD-Seite vor jedem
Spieldurchlauf — mit `d:"tdm"` (passend zu `gegnerVorschau()`s hartkodierter Lesestelle) für
die besten `jeSeiteVon(dId)` Namen nach TDM-Eignung, mit dem Slot, den `slotsVon(dId)` nach
Eignungs-Rang vergeben würde. Für Mini-DM/Battlefield ist das für die EIGENE Aufstellung
wirkungslos (deren `place`-Eintrag trägt `d:"tdm"`, nicht `d:dId` — nur `gegnerVorschau()`s
hartkodiertes `inDisc("tdm")` sieht ihn). Die beabsichtigte Wirkung: `schlachtplan()` bekommt
wieder eine echte Vorschau und damit wieder eine echte TEAM-Taktik für die GAST-Seite. Jeder
berührte `place`-Eintrag wird danach auf seinen Stand davor zurückgesetzt.

`chooseTarget`/`PERSZIEL`/`bedrohungVon`/`schlachtplan`/`gegnerVorschau` bleiben byte-identisch
— das ist unabhängig bestätigt (Review 02.10.), inklusive des neuen `ZIEL_DIAG`-Zähl-Wrappers
aus Teil 2, der ohne `zielDiag:true` ein reiner No-Op ist.

### Gemessene Wirkung — NICHT eindeutig gerichtet, keine validierte Verbesserung

`node scripts/miss-alle-disziplinen.mjs 24 <disziplin>`, isoliert ohne Parallellast gemessen
(deterministische Saaten — die folgenden Zahlen sind reproduzierbare Codefolgen, kein
Zufallsrauschen):

| Disziplin | rho je Spiel (Median) VOR | NACH | Spannweite VOR | NACH |
|---|---:|---:|---:|---:|
| TDM | 0,404 | **0,324** | 0,912 | 0,861 |
| Mini-DM | 0,321 | **0,365** | — | — |
| Battlefield | 0,399 | **0,399** (unverändert) | — | — |

**Derselbe Fix-Mechanismus bewegt die drei Disziplinen NICHT in dieselbe Richtung:** TDM
sinkt, Mini-DM steigt, Battlefield bleibt gleich. Das spricht dafür, dass der Fix vor allem die
Kader-Familie-SLOT-Zuteilung (welcher Name welchen Rang/Slot bekommt) inzidentell neu
durchmischt, statt eine prinzipiengeleitete Korrektur der Zielwahl zu sein. **Dies wird
deshalb ausdrücklich NICHT als validierte Verbesserung der Rangtreue dargestellt, sondern als
Änderung der Mess-Grundlage mit unklarem Vorzeichen.** Die TDM-Verschiebung (0,404→0,324) liegt
außerdem innerhalb der für TDM selbst dokumentierten Kader-Familie-Spannweite (≈0,86–0,91) und
ist damit nach der projekteigenen Regel ("eine Änderung, die kleiner bewegt als die
Spannweite, ist von Null nicht unterscheidbar") nicht von Rauschen zu unterscheiden.

**Bezug zu PR #1124:** solange #1125 nicht gemergt ist, liefert `main` unverändert 0,404 —
#1124s Befund (rho-Schranke klar verfehlt, Ursache Zielwahl-Logik nicht Rezept) bleibt für den
aktuellen `main`-Stand vollständig korrekt, keine Korrektur nötig. Erst nach einem Merge einer
überarbeiteten Fassung bräuchte #1124 einen kurzen Nachtrag mit dem neuen Wert UND der
Erklärung, dass der Unterschied aus einer Mess-Sonden-Korrektur stammt, nicht aus einer
Rezeptänderung.

## Teil 2: Neue Diagnose-Sonde — Rangvarianz-Aufschlüsselung

`scripts/miss-arena-rangvarianz-aufschluesselung.mjs`, nach dem Vorbild von
`miss-rangtreue-nach-rolle.mjs`/`miss-star-paartreue.mjs` (kaderfeste Methodik,
`scripts/lib/rangtreue-messung.mjs`). Methodisch unabhängig bestätigt (Review 02.10.) — nur
die begleitende Interpretation unten wurde an die Korrektur aus Teil 1 angepasst. Zwei
Messungen je Disziplin (tdm/mini-dm/battlefield, n=12 Spiele je der 5 Kader-Paarungen, auf dem
Stand NACH dem Teil-1-Fix):

1. **rho(Eignung, Zugang)**: Spearman zwischen Eignung und der Zahl, wie oft eine Einheit
   tatsächlich als Ziel gewählt wurde — gezählt direkt an den `chooseTarget()`-Rückgaben über
   einen neuen, rein additiven Zähl-Wrapper (`ZIEL_DIAG`, aktiviert über
   `disziplinProbe(d,{...,zielDiag:true})`, nach dem Vorbild von `takeshiWuchtDiag()` aus
   PR #1121 — `chooseTarget` selbst bleibt byte-identisch, nur umbenannt zu
   `chooseTargetKern()` und von einem dünnen Zähl-Wrapper umschlossen, der ohne die Option ein
   reiner No-Op ist).
2. **eta² je Faktor** (Persönlichkeit/PERSZIEL-Typ, Heiler-Unterklasse, Reihe/Slot, Seite) auf
   dem Residuum einer Regression von Perzentil-Rang(Wert) auf Perzentil-Rang(Eignung) je
   Kader-Paarung — also dem Teil der Rangvarianz, den die Eignung NICHT erklärt, gepoolt über
   alle fünf Paarungen (Perzentil-Rang macht unterschiedlich große Paarungen vergleichbar).

### Ergebnisse

| Disziplin | rho(Eig,Zugang) Median (Spannweite) | eta² Persönlichkeit | eta² Heiler-Unterklasse | eta² Reihe/Slot | eta² Seite |
|---|---:|---:|---:|---:|---:|
| TDM | 0,336 (1,182) | **0,295** | 0,036 | 0,077 | 0,019 |
| Mini-DM | −0,381 (1,381) | **0,241** | 0,001 | 0,003 | 0,011 |
| Battlefield | −0,143 (1,238) | 0,154 | 0,090 | 0,023 | 0,023 |

(eta²-Richtwerte nach Cohen 1988: ~0,06 klein, ~0,14 mittel, ~0,26 groß.)

**Antwort auf die Opus-Vermutung:** rho(Eignung, Zugang) ist in allen drei Disziplinen schwach
UND vorzeichen-instabil über die Paarungen (TDM-Spannweite 1,18 bei nur fünf Paarungen,
Mini-DM/Battlefield sogar überwiegend NEGATIV) — Eignung sagt kaum voraus, wie oft jemand zum
Ziel wird, auch auf dem Stand nach dem Teil-1-Fix.

**Persönlichkeit (PERSZIEL-Typ) dominiert tatsächlich** — mit Abstand der größte der vier
gemessenen Faktoren in allen drei Disziplinen (0,295/0,241/0,154, "groß" bis "mittel" nach
Cohen), und zwar in dieselbe Richtung: "beschuetzer"/"duellant" liegen im Rest-Rang
durchgehend über dem Mittel, "draufgaenger"/"schleicher" durchgehend darunter. **Heiler-
Unterklasse dominiert NICHT** — ihr eta² ist in allen drei Disziplinen klein (0,001–0,090),
auch wenn die Stichprobe dort am kleinsten ist (n=5–10 Heiler über alle Paarungen). Reihe/Slot
ist durchgehend klein bis mittel (0,003–0,077).

**Seite (Heim/Gast) ist mit Abstand die kleinste Kategorie (0,011–0,023) — das ist auf dem
NACH-Fix-Stand gemessen, und die Teil-1-Verifikation zeigt, dass der Rollentausch-Effekt bei
n=8 trotzdem bestehen bleibt (siehe oben).** Die kleine eta²-Zahl und der fortbestehende
Rollentausch-Effekt widersprechen sich nicht zwangsläufig: eta² misst hier den Anteil an der
GESAMTEN Rest-Rangvarianz über alle fünf Paarungen gepoolt (n=60/40), während der
Rollentausch-Befund eine EINZELNE Paarung bei n=8 betrifft — ein in dieser Runde nicht
aufgelöster Unterschied in der Auflösung, kein Widerspruch in den Rohdaten. Die Aussage "der
Fix macht Seite zum kleinsten Faktor" wird deshalb NICHT mehr als unabhängige Bestätigung des
Fixes verkauft (wie in der ersten Fassung), sondern nur noch als Messwert berichtet.

**Einordnung für die nächste Chris-Entscheidung:** die Daten stützen eher eine P1-Zielwahl-
Korrektur an der PERSZIEL-Dimension (der eine Faktor, der in allen drei Disziplinen groß bis
mittel bleibt) als eine reine Tauschwert-Zielwahl ("bedrohung" für alle) — Letzteres wurde
laut `docs/design/arena-zielwahl-umsetzung.md` bereits zweimal versucht und bewegte TDM nicht
nachweisbar, verschlechterte Mini-DM/Battlefield aber messbar. Eine Korrektur, die gezielt an
der Persönlichkeits-Varianz ansetzt (z. B. die Streuung der sechs Archetypen verkleinern, ohne
sie auf eine einzige Neigung zusammenzulegen), trifft laut dieser Messung den größten Hebel,
ohne den bereits zweimal gescheiterten Weg zu wiederholen. Das ist eine Beobachtung dieser
Mess-Runde, keine Empfehlung für eine konkrete Umsetzung — die Zielwahl-Mechanik selbst bleibt
Chris' Entscheidung (Klasse B).

## Pflichtprüfungen

- `node --check public/mockups/battle-mode.engine.js`: OK.
- `npx vitest run`: 8224 bestanden, 23 übersprungen, 1 Fehlschlag
  (`matchday-auto-run-service.test.ts`, Timeout durch Ressourcen-Konkurrenz mit der eigenen
  Chromium-Messung im selben Lauf — isoliert erneut gelaufen: 9/9 bestanden, keine Regression).

## Reproduktion

```sh
git worktree add /tmp/wt-arena-zielwahl <branch> --detach
ln -s <repo>/node_modules /tmp/wt-arena-zielwahl/node_modules
node /tmp/wt-arena-zielwahl/scripts/miss-arena-rangvarianz-aufschluesselung.mjs 24 tdm mini-dm battlefield
node /tmp/wt-arena-zielwahl/scripts/miss-alle-disziplinen.mjs 24 tdm mini-dm battlefield
```
