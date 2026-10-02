# Arena-Zielwahl-Messsonde (Task #26, 02.10.) — P0-Bugfix + Rangvarianz-Aufschlüsselung

Reine Mess-/Diagnose-Runde, ausgelöst durch eine Opus-Konsultation (Task #26, 02.10.), die
Arena-Kämpfe (TDM/Mini-DM/Battlefield) mit einer bindenden rho-Verletzung fand (TDM rho=0,404
gegen die CLAUDE.md-Schranke 0,80, s. `docs/design/tdm-pp-rezeptrunde-diagnose-02-10.md`
Abschnitt 3) und vermutete, dass der "Zugang" zu Kämpfen (wie oft ein Spieler als Ziel gewählt
wird) kaum mit Eignung zusammenhängt. **Weder `chooseTarget`, `PERSZIEL`, `bedrohungVon` noch
`schlachtplan` wurden inhaltlich angefasst** — beide Teile dieser Runde sind Mess-Sonden-Arbeit
(Klasse A).

## Teil 1: P0-Bugfix — Heim/Gast-Zielwahl-Asymmetrie in der Kader-Familie-Sonde

### Befund

`disziplinProbe()`s Kader-Familie-Pfad tauscht `SQUAD`/`OPP` für jede Paarung aus, füllt dabei
aber **nie `place[]`** (die Aufstellungstabelle) für die neuen Namen. Das bricht `schlachtplan()`
(die KI-Taktik, die der GAST-Seite ihr `zielP` gibt) lautlos:

- `schlachtplan()` ruft `gegnerVorschau()`, und die liest ausschließlich `inDisc("tdm")` —
  fest verdrahtet auf die Zeichenkette `"tdm"`, nicht auf die gerade gemessene Disziplin, und
  nur von der **SQUAD(heim)**-Seite (`inDisc=(d)=>SQUAD.filter(p=>place[p.n]&&place[p.n].d===d)`).
- Ohne `place`-Einträge für die SQUAD-Namen ist `inDisc("tdm")` leer, `gegnerVorschau()` liefert
  `[]`, `schlachtplan()` liefert `null`.
- In `build()` heißt das für die GAST-Seite: `z.zielP||(o.jagd?"bedrohung":null)` — `z` ist
  `{}`, und `o.jagd` wird **im gesamten Motor nirgends gesetzt** (verifiziert: kein einziges
  `.jagd=`/`jagd:` im ganzen Quelltext außer dieser einen Lesestelle — ein totes Flag). `zielP`
  bleibt also für **jede einzelne** GAST-Einheit `null`/`undefined`.
- In `chooseTarget()` fällt eine Einheit ohne `zielP` (und ohne die nie gesetzte generische
  `u.ziel`-Neigung, die für Arena-Einheiten gar nicht existiert) komplett auf den letzten
  Fallback `return nearest(foes)` zurück — **reine Geometrie statt Taktik, ausnahmslos.**

Die HEIM-Seite hängt nie an `schlachtplan()` — ihr `zielP` kommt direkt aus der
PERSZIEL-Persönlichkeit (`baueEinheit()`, "UNSERE SEITE") und bleibt die ganze Zeit
individuell (sechs verschiedene Zielwahl-Archetypen). Gemessen wurde also nie "Eignung gegen
Eignung", sondern **"individualisierte Zielwahl (heim) gegen reine Nächster-Geometrie
(gast)"** — eine Verzerrung, die an der ROLLE hängt, nicht an der Eignung.

Betroffen sind **vier von fünf** Kader-Paarungen in `data/generated/kaderfamilie-live-save.json`
— die erste ("vigilante-armageddon") trägt zufällig dieselben Namen wie der alte hartkodierte
SQUAD/OPP-Testkader (für den `place[]` beim Modul-Start sechs feste Einträge bekommt), die
anderen vier nicht. Der Bug besteht seit der Umstellung auf die Kader-Familien-Methodik
(03.09.2026) und hat seither jede TDM/Mini-DM/Battlefield-Rangtreue-Messung des Projekts
mitverzerrt — vermutlich ein Teil der Erklärung, warum TDM in keiner dokumentierten Messung
auch nur in die Nähe von 0,80 kam.

### Verifikation

Ein Rollentausch derselben Kader-Paarung (heim↔gast, sonst identisch) zeigt auf dem
unveränderten Code für Paarungen ohne funktionierenden `schlachtplan()` einen konsistenten
Heim-Vorteil, unabhängig davon, welches Team gerade "heim" ist — z. B. coldsteel-direlegion:
Team A als heim 8,24 Punkte Anteil / als gast 7,88; Team B als gast 8,43 / als heim 8,79
(**beide Richtungen "heim > gast"**, wie es ein rollengebundener statt eignungsgebundener
Effekt erwarten lässt). Ein Spiegeltest mit byte-identischen, aber generischen Platzhalter-
Kadern zeigt dagegen 50:50 — erwartbar, weil alle sechs Platzhalter auf dieselbe
PERSZIEL-Kategorie fallen und "bedrohung" in einem einfachen symmetrischen Gefecht praktisch
mit "nächster" zusammenfällt; der Effekt braucht echte, gemischte Persönlichkeiten, um
sichtbar zu werden.

### Fix (nur in der Mess-Sonde)

`disziplinProbe()`s Kader-Familie-Zweig füllt `place[]` jetzt für die SQUAD-Seite vor jedem
Spieldurchlauf — mit `d:"tdm"` (passend zu `gegnerVorschau()`s hartkodierter Lesestelle) für
die besten `jeSeiteVon(dId)` Namen nach TDM-Eignung, mit genau dem Slot, den der bisherige
Eignungs-Rückfall in `build()` (`ersatz`/`slotFuer`) ohnehin vergeben hätte
(`slotsVon(dId)` nach Rang) — für TDM selbst dadurch ergebnisgleich zum bisherigen Rückfall
(nur explizit statt implizit gesetzt; einzige Nebenwirkung: die Links-Rechts-Reihenfolge
INNERHALB einer Reihe kann sich geringfügig verschieben, Slot und Reihe selbst bleiben pro
Spieler gleich), für Mini-DM/Battlefield wirkungslos für die EIGENE Aufstellung (deren
`place`-Eintrag trägt `d:"tdm"`, nicht `d:dId` — nur `gegnerVorschau()`s hartkodiertes
`inDisc("tdm")` sieht sie). Einzige Wirkung: `schlachtplan()` bekommt wieder eine echte
Vorschau und damit eine echte Taktik für die GAST-Seite, symmetrisch zur immer-individuellen
HEIM-Seite — genau das, was im echten Spiel (und zufällig in Paarung 1 dieser Sonde) ohnehin
passiert. Jeder berührte `place`-Eintrag wird danach auf seinen Stand davor zurückgesetzt
(meist "nicht vorhanden").

`chooseTarget`/`PERSZIEL`/`bedrohungVon`/`schlachtplan`/`gegnerVorschau` bleiben byte-identisch.

### Wirkung gemessen (TDM, n=8 Spiele je Paarung, 5 Paarungen)

| Paarung | Score-Anteil VORHER (heim/gast) | Score-Anteil NACHHER (heim/gast) |
|---|---:|---:|
| vigilante-armageddon | 49,8 % / 50,2 % | 49,1 % / 50,9 % |
| coldsteel-direlegion | 48,2 % / 51,8 % | 50,6 % / 49,4 % |
| goldengladiators-silversoldiers | 50,1 % / 49,9 % | 47,9 % / 52,1 % |
| mortalsin-natureswrath | 48,6 % / 51,4 % | 49,3 % / 50,7 % |
| piratecrew-raginglunatics | 47,4 % / 52,6 % | 45,3 % / 54,7 % |

Der rohe Score-Anteil bewegt sich bei n=8 kaum (beide Spalten liegen im selben, von
Kaderstärke und Zufallsrauschen dominierten Band) — erwartbar, weil die Team-GESAMTPUNKTZAHL
stark von der allgemeinen Kaderstärke und der Matchlänge abhängt, nicht nur von der
Zielwahl-Mechanik. Die eigentliche Wirkung des Fixes zeigt sich erst in Teil 2, an der
Seite-eta² (unten): die Rolle als Erklärfaktor der EIGNUNGS-UNABHÄNGIGEN Rangvarianz ist nach
dem Fix klein (0,011–0,023), nicht groß — genau das Ergebnis, das ein korrigierter, jetzt
beidseitig taktischer Zielwahl-Mechanismus erwarten lässt.

## Teil 2: Neue Diagnose-Sonde — Rangvarianz-Aufschlüsselung

`scripts/miss-arena-rangvarianz-aufschluesselung.mjs`, nach dem Vorbild von
`miss-rangtreue-nach-rolle.mjs`/`miss-star-paartreue.mjs` (kaderfeste Methodik,
`scripts/lib/rangtreue-messung.mjs`). Zwei Messungen je Disziplin (tdm/mini-dm/battlefield,
n=12 Spiele je der 5 Kader-Paarungen, NACH dem P0-Fix):

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
Ziel wird, selbst nachdem der P0-Fix die Zielwahl wieder symmetrisch gemacht hat.

**Persönlichkeit (PERSZIEL-Typ) dominiert tatsächlich** — mit Abstand der größte der vier
gemessenen Faktoren in allen drei Disziplinen (0,295/0,241/0,154, "groß" bis "mittel" nach
Cohen), und zwar in dieselbe Richtung: "beschuetzer"/"duellant" liegen im Rest-Rang
durchgehend über dem Mittel, "draufgaenger"/"schleicher" durchgehend darunter. **Heiler-
Unterklasse dominiert NICHT** — ihr eta² ist in allen drei Disziplinen klein (0,001–0,090),
auch wenn die Stichprobe dort am kleinsten ist (n=5–10 Heiler über alle Paarungen). Reihe/Slot
ist durchgehend klein bis mittel (0,003–0,077). **Seite (Heim/Gast) ist nach dem P0-Fix die
mit Abstand kleinste Kategorie (0,011–0,023)** — ein Nebenbefund, der den Fix aus Teil 1
unabhängig bestätigt: vor dem Fix wäre dieser Faktor (reine Rollen-Zielwahl ohne jeden
Eignungs-Bezug für die gesamte Gast-Seite) strukturell groß gewesen.

**Einordnung für die nächste Chris-Entscheidung:** die Daten stützen eher eine P1-Zielwahl-
Korrektur an der PERSZIEL-Dimension (der eine Faktor, der in allen drei Disziplinen groß bis
mittel bleibt) als eine reine Tauschwert-Zielwahl ("bedrohung" für alle) — Letzteres wurde
laut `docs/design/arena-zielwahl-umsetzung.md` bereits zweimal versucht und bewegte TDM nicht
nachweisbar, verschlechterte Mini-DM/Battlefield aber messbar. Eine Korrektur, die gezielt an
der Persönlichkeits-Varianz ansetzt (z. B. die Streuung der sechs Archetypen verkleinern, ohne
sie auf eine einzige Neigung zusammenzulegen), trifft laut dieser Messung den größten Hebel,
ohne den bereits zweimal gescheiterten Weg zu wiederholen. Das ist eine Beobachtung dieser
Mess-Runde, keine Empfehlung für eine konkrete Umsetzung — die bleibt Chris' Entscheidung
(Klasse B).

## Pflichtprüfungen

- `node --check public/mockups/battle-mode.engine.js`: OK.
- `npx vitest run`: s. PR-Beschreibung für das Ergebnis dieser Runde.

## Reproduktion

```sh
git worktree add /tmp/wt-arena-zielwahl <branch> --detach
ln -s <repo>/node_modules /tmp/wt-arena-zielwahl/node_modules
node /tmp/wt-arena-zielwahl/scripts/miss-arena-rangvarianz-aufschluesselung.mjs 24 tdm mini-dm battlefield
```
