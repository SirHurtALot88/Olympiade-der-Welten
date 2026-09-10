# Opus-Plan: Zehn Disziplinen auf >90 % in allen vier Kategorien (10.09.)

**Auftrag von Chris (woertlich, 10.09. abends):** „10 diszis sollten soweit sein dass alle Bereiche
auf jeden fall alle Kategorien >90 sind" — und ausdruecklich: erst planen, dann bauen. Dieses
Dokument ist der Plan. Es aendert **keine Zeile Produktionscode**.

**Stand beim Schreiben:** `main` = `c845014a` („Opus-Overseer-Review PR #883"). Alle heutigen PRs
sind darin: #872 (Fundament), #874 (Eiskunstlauf), #875 (Breaking), #876 (Gewichtheben), #880
(Takeshi + Bahn-Produktivierung), #883 (Takeshi-Ton), #884 (Football-Gameplay Runde 1).

**Grundlage der Rubrik:** `docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md`
Abschnitt 0 — Konzept K1–K4 je 25 · Assets A1 30 / A2 25 / A3 25 / A4 20 · Gameplay G1 40 / G2 30 /
G3 15 / G4 15 · Movement M1 35 / M2 25 / M3 25 / M4 15. Gesamt = ungewichteter Durchschnitt.

**Dieses Dokument schreibt das Audit von heute frueh NICHT ab.** Das Audit ist an sechs Stellen
veraltet, und sein Abschnitt 3.2 („der Zufallswaffen-Bug ist bei vier Disziplinen offen") ist heute
schlicht falsch — der Bug ist projektweit zu (Abschnitt 1.2). Jede Zahl unten ist entweder frisch
gemessen oder am gemergten Code belegt, mit Datei:Zeile.

---

## 0. Die Kurzfassung — und die Zahl, die den ganzen Auftrag begrenzt

### 0.1 Die unbequeme Wahrheit vorweg

> **Es gibt im ganzen Projekt nur ELF Disziplinen, die „alle vier Kategorien >90 %" ueberhaupt
> erreichen koennen, ohne dass vorher eine Rangtreue-Forschungsrunde gelingt.**
> Zehn davon zu nehmen heisst: **eine einzige Reserve.** Der Auftrag hat keinen Puffer.

Der Grund ist die G1-Stufenleiter. Gameplay >90 verlangt arithmetisch:

| Chassis | Rechnung fuer >90 | notwendige Bedingung |
|---|---|---|
| Feldspiel / Buehne | G1 35 + G2 30 + G3 15 + G4 15 = **95** | **rho ≥ 0,80** UND Produktionsanschluss |
| Bahn / Arena | G1 35 + G2 30 + G3 15 + G4 12 = **92** | **rho ≥ 0,80** UND Produktionsanschluss |

Mit `rho` in der Stufe 0,70–0,80 gibt G1 nur 22 Punkte — Gameplay landet dann bei 82 bzw. 79, und
**kein noch so guter Anschluss und keine noch so schoene Wertung heben das ueber 90.**

Frisch gemessen fuer diesen Bericht (`node scripts/miss-alle-disziplinen.mjs 24 football hockey
basketball`, kaderfest, Median ueber fuenf echte Kader-Paarungen aus
`data/generated/kaderfamilie-live-save.json`), die uebrigen siebzehn aus dem Lauf des Reviews zu
PR #883 auf demselben Code:

```
staffel      0,915 | speed-schach 0,908 | showcase 0,892 | eiskunstlauf 0,885 | spurt 0,871
breaking     0,869 | takeshis-castle 0,861 | gewichtheben 0,854 | wettessen 0,845
time-trial   0,828 | tennis 0,825 | fechten 0,816 | football 0,800   <- ab hier reisst G1
climbing     0,790 | basketball 0,769 | i-spy 0,684 | hockey 0,669 (Feldspieler 0,719)
battlefield  0,387 | tdm 0,253 | mini-dm 0,094
```

**Dreizehn Disziplinen liegen bei rho ≥ 0,80.** Davon fallen zwei aus jeder realistischen
Zehnerliste heraus, weil ihr Konzept bei 25 % bzw. 35 % steht und sie ueberhaupt keine eigene
Sportidentitaet haben (Showcase, Wettessen — Audit Abschnitt 6, „kein eigenes Konzept"). Bleiben
**elf**.

**Und: die beiden bestfertigen Disziplinen des Projekts sind ausgesperrt.** Basketball steht bei
Konzept 100 / Assets 100 / Movement 100 — und faellt allein an rho 0,769 durch. Hockey steht bei
100 / 80 / — / 100 und faellt an rho 0,669 durch. Genau diese zwei Zahlen hat Chris ausdruecklich
abgenommen. Das ist die groesste strukturelle Huerde des Auftrags, und sie ist in Abschnitt 8 eine
Entscheidung fuer Chris, keine Bauaufgabe.

### 0.2 Die Zehnerliste, sortiert nach Aufwand

| # | Disziplin | Achse(n) unter 90 | Aufwand | Risiko | Vorlage aus dieser Session |
|--:|---|---|---|---|---|
| 1 | **Gewichtheben** | Movement 87 | klein | keins | `stepKuer()` / `stepCypher()` (#874/#875) |
| 2 | **Breaking** | Konzept 85 | klein | keins | `basketball-k3.md`-Kalibrierrunde |
| 3 | **Takeshi's Castle** | Movement 85 | klein–mittel | keins | #874/#875, aber neuer Bahn-Dispatcher noetig |
| 4 | **Eiskunstlauf** | Assets 70 · Konzept 90 | mittel | keins | **#883 (Ton) + #876 (Prop an der Hand)** |
| 5 | **Speed-Schach** | Konzept 80 · Assets 75 · Movement 80 | mittel | keins | drei bekannte Rezepte, drei Achsen |
| 6 | **Staffel** | Assets 55 · Movement 70 | mittel | keins | #876 (Prop) + #883 (Ton) + #874 (Step) |
| 7 | **Football** | Gameplay 65 · Assets 75 · Movement 85 · Konzept 90 | mittel–gross | **eine Chris-Entscheidung** | #880 (Produktivierung) |
| 8 | **Time-Trial** | Assets 45 · Movement 50 | gross | keins | — (echter Neubau zweier Achsen) |
| 9 | **Spurt** | Gameplay 67 · Assets 55 · Movement 60 | gross | ein Vorticket (F1) | #880 |
| 10 | **Fechten** | Konzept 55 · Assets 55 · Movement 35 | gross | **Rezept steht live auf einem Entwurf** | — |

**Ehrliche Einschaetzung vorweg (ausfuehrlich in Abschnitt 9):** **1–7 sind sicher.** 8–10 sind je
ein Neubau von zwei bis drei Achsen und zusammen deutlich mehr Arbeit als die gesamte heutige
Session. Wer heute „zehn" verspricht, verspricht drei Wellen, nicht eine.

### 0.3 Was das mit dem Feld macht

Nach 1–7: **sieben Disziplinen mit allen vier Kategorien >90**, Projektdurchschnitt von heute 65 %
auf rund 78 %, sechzehn von zwanzig produktionsangeschlossen (heute dreizehn).

---

## 1. Der aktuelle Stand — nicht abgeschrieben, sondern nachgerechnet

### 1.1 Die Tabelle, Stand `c845014a`

Fett = seit dem Audit von heute frueh veraendert. `*` = in diesem Dokument neu eingestuft, Begruendung
in 1.2/1.3.

| # | Disziplin | Chassis | Konzept | Assets | Gameplay | Movement | Gesamt | rho | Achsen <90 |
|--:|---|---|--:|--:|--:|--:|--:|--:|--:|
| 1 | Basketball | Feldspiel | 100 | 100 | 82 | 100 | 96 | 0,769 | **1** |
| 2 | Gewichtheben | Buehne | 100 | **100** | 95 | **87\*** | **96** | 0,854 | **1** |
| 3 | Takeshi's Castle | Bahn | 100 | **95** | **97** | **85\*** | **94** | 0,861 | **1** |
| 4 | Breaking | Buehne | 85 | **100** | 95 | **92** | **93** | 0,869 | **1** |
| 5 | Hockey | Feldspiel | 100 | 80 | 72 | 100 | 88 | 0,669 | 2 |
| 6 | Eiskunstlauf | Buehne | 90 | 70 | 95 | **94** | **87** | 0,885 | 2 |
| 7 | Speed-Schach | Buehne | 80 | 75 | 100 | 80 | 84 | 0,908 | 3 |
| 8 | Staffel | Bahn | 95 | 55 | **97** | 70 | **79** | 0,915 | 2 |
| 9 | Football | Feldspiel | 90 | 75 | **65\*** | 85 | **79** | **0,800** | 4 |
| 10 | Time-Trial | Bahn | 95 | 45 | **92** | 50 | **71** | 0,828 | 2 |
| 11 | Spurt | Bahn | 95 | 55 | 67 | 60 | 69 | 0,871 | 3 |
| 12 | Fechten | Buehne | 55 | 55 | 90 | 35 | 59 | 0,816 | 3 |
| 13 | Tennis | Buehne | 75 | **40\*** | 90 | 20 | **56** | 0,825 | 3 |
| 14 | Mini-DM | Arena | 70 | 60 | 22 | 55 | 52 | 0,094 | 4 |
| 15 | Battlefield | Arena | 70 | 60 | 22 | 55 | 52 | 0,387 | 4 |
| 16 | TDM | Arena | 55 | 65 | 22 | 60 | 51 | 0,253 | 4 |
| 17 | Climbing | Bahn | 65 | 40 | 49 | 40 | 49 | 0,790 | 4 |
| 18 | Wettessen | Buehne | 35 | **40\*** | 95 | 15 | **46** | 0,845 | 3 |
| 19 | Showcase | Buehne | 25 | **40\*** | 95 | 20 | **45** | 0,892 | 3 |
| 20 | I-Spy | Buehne | 55 | **40\*** | 37 | 20 | **38** | 0,684 | 4 |

**Vier Disziplinen haben heute nur noch EINE Achse unter 90** — Basketball, Gewichtheben, Takeshi,
Breaking. Keine hat heute alle vier.

### 1.2 Die Neueinstufungen, jede einzeln belegt

**Football Gameplay 35 → 65\*.** rho ist heute **0,800** (frisch gemessen, Spannweite 0,054, rho
Saison 0,867) statt 0,516 — PR #884. G1 springt von 5 (Stufe <0,50) auf 35 (Stufe 0,80–0,85). G2
bleibt **0**: `"football"` steht nicht in `ARENA_RESOLVED_DISCIPLINE_IDS`
(`lib/resolve/battle-mode-arena-team-points.ts:236-255`, selbst nachgelesen). G3 15
(`wertungTabelle:(basis,art)=>WERTUNG_FOOTBALL(art)`, `battle-mode.engine.js:4430`), G4 15
(Feldspiel). 35 + 0 + 15 + 15 = 65.
**Achtung: 0,800 liegt exakt auf der Schranke**, nicht darueber. Siehe 7.1.

**Gewichtheben Movement 85 → 87\*, mit einer klaren Luecke.** M1 35 (`bodenHeben()` `:12207`,
`zeichneHeben()` `:12755`), M3 25 (`barbell.tsx` 589 Z., rAF-getriebener Platten-Clip), M4 15
(`HEBEN_PHASEN` `:370-377`, `zeichneHantel()` an `HEBEN_HAND` `:358-363`). **M2 aber nur 12**: es
gibt keine eigene Schrittlogik. `hebePhase(u)` (`:12745`) leitet die Pose jeden Frame neu aus
`buehneAkt` ab — ein Fortschrittsbalken, keine Zustandsmaschine. Der Motor sagt es selbst
(`:364-369`): *„Das Sprite-Blatt kennt keine eigene Hebe-Animation — die Stange wandert an der Hand
vorbei."* Und `buehnenBewegung()` (`:11879-11883`) kennt genau zwei Zweige, `art.duett` und
`art.cypher` — **`art.heben` fehlt.** 35 + 12 + 25 + 15 = 87.

**Takeshi Movement 75 → 85\*.** M3 steigt von 15 auf 25: `takeshi.tsx` ist durch PR #880 von 273 auf
**517 Zeilen** und von 3 auf **14 Animationsstellen** gewachsen (selbst gezaehlt). M1 35
(`bodenTakeshiRoute()` `:17326`, `zeichneFalleTakeshi()` `:17197`), M4 12 (Fallen-FX, aber keine
eigene Laeufer-Pose), **M2 13** — es gibt keinen Bahn-Bewegungs-Dispatcher; `bahnBewegung()`
existiert im ganzen Motor nicht (nachgesucht). 35 + 13 + 25 + 12 = 85.

**Takeshi Assets 75 → 95.** A4 0 → 20 durch PR #883: vier `sfx("takeshis-castle", …)`-Aufrufstellen
plus Loop-Start/-Stop/-Reset, vom Reviewer unabhaengig nachgezaehlt und der Leck-Test in den vier
Geschwister-Bahnen gefahren (0/0/0/0). A3 bleibt 20 (Waffe unterdrueckt, aber kein Helm, keine
Startnummer am Sprite).

**Tennis / Showcase / Wettessen / I-Spy Assets +10\*.** Audit-Abschnitt 3.2 („der Zufallswaffen-Bug
ist bei Showcase, Tennis, Wettessen und I-Spy offen") **ist ueberholt.** `DISZIPLIN_WAFFE`
(`:2185-2192`) fuehrt heute alle vier mit `null`, dazu die fuenf Bahnen. Der Bug ist projektweit zu.
A3 steigt damit von 0 auf 10 — die Waffe ist weg, eigene Requisiten gibt es weiterhin nicht.

### 1.3 Ein Befund, der den Plan mitbestimmt: der TON-Katalog ist zu drei Vierteln lebendig

Selbst nachgezaehlt ueber die ganze Datei:

```
sfx("gewichtheben"      6 Aufrufstellen     tonLoopStart :12208
sfx("breaking"          3 Aufrufstellen     tonLoopStart :21811
sfx("takeshis-castle"   4 Aufrufstellen     tonLoopStart :17327
sfx("eiskunstlauf"      0 Aufrufstellen     — toter Katalogeintrag
```

`TON_KATALOG` (`:16980`) traegt vier Disziplinen. **Sechzehn Disziplinen haben nicht einmal einen
Katalogeintrag.** A4 ist 20 Punkte und in der Rubrik-Anwendung praktisch an den Ton gebunden
(Praezedenzfall Hockey: volle eigene Kulisse `eisflaeche()`, trotzdem A4 = 0). Ohne A4 hat Assets
eine harte Decke bei 80.

**Folge: von den zehn Zielen brauchen SIEBEN Ton** — Eiskunstlauf, Speed-Schach, Staffel, Football,
Time-Trial, Spurt, Fechten. Das ist der groesste gemeinsame Nenner der ganzen Liste und deshalb
PR 0.1.

---

## 2. Warum genau diese zehn — und warum die anderen zehn nicht

### 2.1 Die Ausschlussgruende, nach Haerte sortiert

| Ausgeschlossen | Grund | waere es zu retten? |
|---|---|---|
| **Mini-DM** (0,094), **TDM** (0,253), **Battlefield** (0,387) | G1 = 5. Und: die Kader-Spannweite ist bei allen dreien **groesser als der Median** — bei n=24 ist dort keine Aenderung nachweisbar. | Erst ein Messbudget (n ≥ 96–150), dann Forschung. Mehrere Wellen. |
| **I-Spy** (0,684) | einzige Buehne unter der Schranke, dazu Assets 40 / Movement 20 | vier Achsen. Nein. |
| **Climbing** (0,790) | 0,010 unter der Schranke, **aber** Konzept 65 / Assets 40 / Movement 40 und nie eine eigene Rezeptrunde gehabt | vier Achsen. Nein. |
| **Showcase** (K 25), **Wettessen** (K 35) | rho und Gameplay sind gut, aber es gibt **kein Dokument, das sie als Sportart modelliert**, kein Flag, keine eigene Regel. K1–K4 sind vier verschiedene Baustellen. | Erst eine Sportart erfinden. Das ist Konzeptarbeit, keine Bauarbeit. |
| **Hockey** (0,669) | Assets waeren mit Ton in einem Tag bei 100 — Gameplay verlangt rho **+0,131**. | Siehe 8.2: es gibt einen sehr guten Hebel. Aber es ist Forschung. |
| **Basketball** (0,769) | **eine einzige Achse, acht Punkte** — aber sie verlangt rho +0,031. | Siehe 8.1. Kleinster Umfang der ganzen Liste, groesstes Risiko. |
| **Tennis** (0,825) | Gameplay 90 ist mit fuenf Punkten zu heilen, aber Assets **40** und Movement **20** sind Neubauten aus dem Nichts. | Ja, aber teurer als Platz 10. Reserve. |

### 2.2 Die Reserve

**Tennis** ist die einzige echte Reserve: rho passt, Gameplay ist mit einer eigenen
`wertungTabelle` (fuenf Punkte, Muster `BUEHNE_ART.wettessen` `:10992` und
`BUEHNE_ART["speed-schach"]` `:11023`) sofort bei 95. Danach fehlen Assets und Movement komplett.
Faellt eines der zehn aus, ruecken Tennis oder Basketball nach — **nicht Showcase, Wettessen oder
Climbing.**

---

## 3. PR 0 — das gemeinsame Fundament (muss ZUERST gemerged sein)

Vier Teile. Sie sind bewusst **vier PRs, nicht einer**, weil sie vier verschiedene Regionen von
`battle-mode.engine.js` anfassen und PR 0.1 und 0.3 unabhaengig voneinander gebaut werden koennen.

### 3.1 PR 0.1 — `TON_KATALOG` fuer die sieben stummen Ziele

**Blockiert:** Eiskunstlauf, Speed-Schach, Staffel, Football, Time-Trial, Spurt, Fechten (7 von 10).
**Region:** ausschliesslich `TON_KATALOG` (`:16980-17014`). Kein anderer Ort.

Diese PR liefert **nur die Katalogeintraege**, keine einzige Aufrufstelle. Das ist die
Kollisionsvermeidung: sieben Disziplin-PRs wuerden sich sonst alle an derselben Objektliteral-Stelle
in die Quere kommen, waehrend ihre Aufrufstellen jeweils in ihrer eigenen, disjunkten Motorregion
liegen.

Vorgeschlagene Ereignisse, je Disziplin vier bis sechs, alle prozedural synthetisiert (`{synth:…}`
wie die vier bestehenden — der Umgebungs-Proxy laesst keine Audio-Dateien durch, `:16848-16853`):

| Disziplin | Ereignisse |
|---|---|
| `eiskunstlauf` | **existiert bereits** (`kufe`/`sprung`/`landung`/`sturz`/`publikum`, `:16989`) — nur Aufrufstellen fehlen |
| `speed-schach` | `zug`, `schlag`, `uhr`, `matt`, `publikum` |
| `staffel` | `startschuss`, `uebergabe`, `fehlwechsel`, `ziel`, `publikum` |
| `football` | `snap`, `pass`, `tackle`, `touchdown`, `pfiff`, `publikum` |
| `time-trial` | `start`, `zwischenzeit`, `bergauf`, `ziel`, `publikum` |
| `spurt` | `startschuss`, `huerde`, `riss`, `ziel`, `publikum` |
| `fechten` | `klingen`, `treffer`, `lampe`, `halt`, `publikum` |

**Vertrag, woertlich uebernehmen:** `sfx()`/`tonLoopStart()`/`tonLoopStop()` rufen **niemals** `rr()`
auf (harte Regel `:16853`). Deshalb ist jede Ton-PR rangtreue-neutral und muss es beweisen
(Abschnitt 6).

**Abnahme PR 0.1:** `miss-alle-disziplinen.mjs 24` ueber alle zwanzig **bit-identisch** mit `main`
(ein reiner Katalog aendert nichts), `tsc --noEmit` zeichengleich.

### 3.2 PR 0.2 — Requisiten POSITIV: `DISZIPLIN_PROP` neben `DISZIPLIN_WAFFE`

**Blockiert:** Eiskunstlauf (A3 15→25), Staffel (A3 0→25), Speed-Schach (A3 20→25), Takeshi
(A3 20→25), Tennis-Reserve (5 von 10 plus Reserve).
**Region:** `:2185-2200` (Tabelle) und `:2980-2990` (Zeichenpfad).

`DISZIPLIN_WAFFE` (`:2185`) kann heute nur **wegnehmen** (`null`) oder eine der bestehenden
Kosmetikwaffen **erzwingen** (`fechten:"schwert"`). Was fehlt, ist die dritte Moeglichkeit: eine
**eigene, an einem Koerperpunkt verankerte Requisite**. Genau die gibt es im Motor bereits zweimal,
ad hoc und nicht wiederverwendbar:

* `zeichneHockeyschlaeger()` (`:311`) mit `HOCKEY_PHASEN` (`:273-289`) — Schaft/Kelle relativ zum Handpunkt
* `zeichneHantel()` (`:398`) mit `HEBEN_HAND` (`:358`) und `HEBEN_PHASEN` (`:370`) — PR #876, die
  Handpunkte per **Pixelscan der Alphakontur** ausgemessen
  (`docs/design/sprite-handpunkte-beweis-gewichtheben.png`)

**Diese PR verallgemeinert die zweite Fassung**, weil sie die neuere und die belegtere ist:

```
DISZIPLIN_PROP = {
  <disziplin>: { hand:[{x,y}x4],           // wie HEBEN_HAND, per Pixelscan ausgemessen
                 phasen:{…},                // wie HEBEN_PHASEN, dy/neigung je Zustand
                 zeichne(ctx,x,y,s,richtung,phase,extra) }
}
```

und ruft sie an derselben Stelle auf, an der `zeichneHantel()` heute steht (`:2983-2985`).
`zeichneHockeyschlaeger()` und `zeichneHantel()` werden **nicht angefasst** — sie werden nur als
zwei Eintraege der neuen Tabelle registriert. Das haelt Hockey und Gewichtheben bit-identisch.

**Wichtig fuer die Handpunkte:** nicht schaetzen. PR #876 hat das Verfahren
(`window.__arena.renderProbe(name,"shoot",true,dir,lunge,256)`, Pixelscan) und ein Beweisbild
etabliert. Jede neue Requisite bringt ihr eigenes Beweisbild mit.

**Abnahme PR 0.2:** alle zwanzig bit-identisch (die Tabelle ist erst mal leer bis auf die zwei
registrierten Bestandsfaelle), plus ein Screenshot-Vergleich Hockey/Gewichtheben vorher/nachher.

### 3.3 PR 0.3 — `bahnBewegung(dt)`: der Dispatcher, den die Bahn nicht hat

**Blockiert:** Takeshi (M2), Staffel (M2/M1), Time-Trial (M2), Spurt (M2) — **4 von 10**.
**Region:** die Bahn-Schrittfunktion, ~`:19265-19800` (der Block, in dem PR #883 seine vier
`sfx("takeshis-castle", …)`-Aufrufe gesetzt hat: `:19436`, `:19539`, `:19549`, `:19761`).

Nachgesucht: `buehnenBewegung()` (`:11879`) existiert und traegt genau zwei Zweige. Ein
**`bahnBewegung()` gibt es nicht.** Alle vier Bahn-Disziplinen laufen durch dieselbe geteilte
Schrittlogik, weshalb M2 dort strukturell bei 12–15 von 25 haengt.

Diese PR baut den Dispatcher **leer** — mit demselben harten Vertrag, den PR #872 fuer die Buehne
formuliert hat und der sich seither zweimal bewaehrt hat (`:11870-11878`, woertlich uebernehmen):

> Eine `bahnBewegung`-Implementierung darf **ausschliesslich neue, praesentationale `viz*`-Felder**
> schreiben. Niemals `rr()`, niemals `u.pos`, niemals irgendetwas, das in `MOTOREN[d].wert()`
> einfliesst.

Das ist nicht Formalismus: der Vertrag ist der Grund, warum #874 und #875 ganze
Bewegungsmaschinen einbauen konnten und trotzdem **ziffernidentische** rho-Werte lieferten
(Abschlussverifikation Abschnitt 1).

**Abnahme PR 0.3:** alle zwanzig bit-identisch (ein leerer Dispatcher aendert nichts), plus ein
`typeof`-Waechterschutz wie bei `:11881-11882`, damit die Ziel-PRs unabhaengig voneinander mergen
koennen.

### 3.4 PR 0.4 — die sechs offenen Kleinbefunde abraeumen

Alle sechs stehen bereits zeilengenau in
`docs/design/feinschliff-abschlussverifikation-10-09.md` Abschnitt 6. Sie kosten zusammen weniger
als ein halber Tag und heben zwei Achsen der Zehnerliste mit:

| # | Befund | Ort | Wirkung |
|--:|---|---|---|
| 1 | `buehnenBewegung(dt)` auch nach `done` laufen lassen | `stepBuehne()` `:11779` (`if(done)return;`) | **Breaking Movement 92 → 95**, **Eiskunstlauf Movement 94 → 97**. Ein Einzeiler, gemeinsame Wurzel von Breaking-N1 und der nie ankommenden Eiskunstlauf-Schlusspose. |
| 2 | Eiskunstlauf N7: waehrend `haeltStelle` (`:11973`) nicht in `u.vizSpur` pushen | `:11993` | Kufenspur ueberlebt die Pirouette. **M4 12 → 15.** |
| 3 | Breaking N3: Divisoren `0.35`/`0.3` auf `FREEZE_T`/`RUECKZUG_T` setzen | `:13410`, `:13419` gegen `:12075` | Effektringe blenden aus statt abzureissen. **M4 12 → 15.** |
| 4 | Breaking N2: `u.vizA` glaetten (Winkelumlauf beachten) | `:12081` (Zustand `ring`) | 107 sichtbare Teleports je Spiel weg. |
| 5 | Takeshi: `platsch` bleibt toter Katalogeintrag, Ausscheiden (`:19539`) bekommt den Torklang | Review PR #883 Abschnitt 7.1 | beide loesen sich gegenseitig. |
| 6 | Takeshi: 227 Ein-Schuss-Toene je Rennen ungedrosselt | Review PR #883 | eine Drossel, sonst klingt es wie ein Geigerzaehler. |

**Nach PR 0.4 hat Breaking Movement 95+ und Eiskunstlauf Movement 97** — beide dann sicher ueber 90,
ohne dass ihre eigenen Ziel-PRs die Achse noch anfassen muessen.

---

## 4. Die vier billigen Ziele (Plaetze 1–4)

### 4.1 Platz 1 — Gewichtheben: **Movement 87 → 100**

**Die einzige Luecke ist M2 (12/25).** Der Rest steht: M1 35, M3 25, M4 15.

**Was zu bauen ist:** `stepHeben(dt, art)` als **dritter Zweig** in `buehnenBewegung()`
(`:11879-11883`), gegated auf `art.heben` — exakt das Muster, mit dem #874 `art.duett` und #875
`art.cypher` angeschlossen haben:

```
if(art.heben  && typeof stepHeben ==="function"){ stepHeben (dt,art); return; }
```

Die Zustandsmaschine ergibt sich direkt aus dem, was `hebePhase()` (`:12745`) heute schon als
Fortschritt ableitet — nur als echte Bewegung statt als Balken:

| Zustand | Was der Heber tut | Dauer-Budget |
|---|---|---|
| `warten` | steht seitlich an der Platte, Stange am Boden (heutiges `"boden"`) | bis zur Enthuellung |
| `antritt` | **geht zur Hantel** — die Bewegung, die es heute gar nicht gibt | ~0,25 · `rundenDauer` |
| `zug` | Umsetzen, Knie beugen (heutiges `"zug"`) | ~0,20 |
| `hoch` | Ausstossen, Arme durch, kurzes Halten (heutiges `"hoch"`) | ~0,25 |
| `abwurf`/`ablage` | Hantel fallen lassen, zurueckweichen | ~0,20 |

**Timing-Budget muss unter `rundenDauer` 1,55 s bleiben** (`BUEHNE_ART.gewichtheben` `:10827`) —
dieselbe Rechnung, die `stepCypher()` mit 0,55 s < 0,625 s gefuehrt hat (`:12057ff`).

**M4 profitiert mit:** `HEBEN_PHASEN` bekommt zwei Eintraege mehr (`antritt`, `ablage`), die
`zeichneHantel()` ohne Aenderung mitzeichnet (`HEBEN_PHASEN[phase]||HEBEN_PHASEN.zug`, `:399` —
der Fallback ist schon da).

**Erwartet:** M1 35 + M2 25 + M3 25 + M4 15 = **100**. Gewichtheben gesamt 100/100/95/100 = **99 %**.
**Aufwand:** klein. Ein Zweig, eine Zustandsmaschine, zwei Phasentabellen-Zeilen.

### 4.2 Platz 2 — Breaking: **Konzept 85 → 95**

**Die einzige Luecke ist ein K-Kriterium bei 10/25.** K1 (eigenes Torment/Will-Rezept ohne Charisma,
`:10947ff`), K2 (`cypher:true` `:10954` ist seit #875 **echte Mechanik**, `stepCypher()` `:12057` — der
Audit-Satz „rein zeichnerisch" ist ueberholt) und K3 (eigenes Fable-Dokument
`breaking-folter-survival-visuelle-identitaet-recherche-08-09.md`) sind voll.

**K4 ist die Luecke: „Rezept nachweislich kalibriert (gemessene NACHGEZOGEN-Runde, Kalibrierung
gegen echte Sportdaten) und die offenen Designfragen entschieden."** Breaking hat die
NACHGEZOGEN-Korrektur (`:10956ff`) und `rundenN` 4 → 8 an der WDSF-Bewertung — aber **keine
Kalibrierung gegen echte Sportdaten** und kein Dokument, das die offenen Fragen schliesst.

**Was zu bauen ist — reine Mess- und Schreibarbeit, kein Motorumbau:**

1. Eine **Kalibrierrunde nach dem Muster `docs/design/basketball-k3.md`**: die Verteilung der
   Rundenausgaenge (Powermove gelingt / Freeze haelt / Abbruch) gegen die reale WDSF-Battle-Statistik
   stellen. Heute sind diese Quoten gesetzt, nicht kalibriert.
2. Ein Dokument `docs/design/breaking-kalibrierung-10-09.md`, das die drei offenen Fragen entscheidet:
   Wie viele Runden ist ein echter Battle? Wie schwer wiegt ein Abbruch gegen einen sauberen Freeze?
   Traegt Charisma bei Breaking wirklich nichts (heute bewusst 0)?
3. Die daraus folgende Rezeptanpassung **nur, wenn sie mehr bewegt als das Kaderrauschen** —
   Breakings Spannweite ist 0,114 (Abschlussverifikation Abschnitt 1). Bewegt sie weniger, wird
   **nichts geaendert** und das Dokument haelt fest, warum. Auch das erfuellt K4.

**Erwartet:** K4 10 → 25, Konzept **95 %**. Breaking gesamt (mit PR 0.4) 95/100/95/95 = **96 %**.
**Aufwand:** klein. Ein Messlauf, ein Dokument, wahrscheinlich null Codezeilen.
**Vorlage:** `basketball-k3.md` (04.09.), `HEBEN_TAGESMAX_ANSAGE_K` (Gewichtheben, 04.09.).

### 4.3 Platz 3 — Takeshi's Castle: **Movement 85 → 95**

**Zwei Luecken: M2 (13/25) und M4 (12/15).** M1 35 und M3 25 stehen seit #880.

**Braucht PR 0.3 (`bahnBewegung()`).** Danach:

* **M2** — `stepParcours(dt, art)`, gegated auf `art.takeshi` (die Flagge steht **genau einmal** im
  ganzen Motor, `BAHN_ART["takeshis-castle"]` `:18186` — vom Reviewer PR #883 unabhaengig
  nachgezaehlt, also eine exakte Disziplin-Schranke). Zustaende, die alle schon Daten im Motor
  haben: `laufen` → `fallenkontakt` (aus `u.fallen[].typ`) → `sturz` (aus `aus:'sturz'`) →
  `aufrappeln` → `laufen`, plus `ausgeschieden` nach drei Stuerzen. Der Laeufer bekommt damit
  zum ersten Mal eine sichtbare Reaktion **an sich selbst** statt nur an der Falle.
* **M4** — eigene Posen: gebueckt beim Schlammabschnitt, Sprung ueber die Huerde, Taumeln nach dem
  Sturz. Dazu ueber PR 0.2 eine Requisite am Sprite (Helm oder Startnummernband), was **A3 20 → 25
  und damit Assets 95 → 100** mitnimmt.

**Erwartet:** M 35 + 25 + 25 + 15 = **100**, Assets **100**. Takeshi gesamt 100/100/97/100 = **99 %**.
**Aufwand:** klein–mittel (der Dispatcher ist PR 0.3, nicht diese PR).

### 4.4 Platz 4 — Eiskunstlauf: **Assets 70 → 95** und **Konzept 90 → 95**

**Assets zerlegt sich als 30 + 25 + 15 + 0.** Zwei Luecken, beide mit einer heutigen Vorlage:

* **A4 0 → 20 — die Aufrufstellen fehlen, der Katalog steht seit PR #872 fertig da.**
  `TON_KATALOG.eiskunstlauf` (`:16989`) traegt `kufe`/`sprung`/`landung`/`sturz`/`publikum`, und
  `sfx("eiskunstlauf"` kommt im ganzen Motor **null** mal vor. Der natuerliche Ort ist der
  Elementuebergang in `stepKuer()` (`:11957-11963`, wo `vizPhase` und `vizSturz` ohnehin gesetzt
  werden) plus ein `tonLoopStart("eiskunstlauf")` in `bodenEis()` (`:12289`).
  **Das ist Zeile fuer Zeile PR #883**, nur auf der Buehne statt auf der Bahn — inklusive der Falle,
  die #883 teuer bezahlt hat: **die Loop-Flagge muss in `reset()` zurueckgesetzt werden**
  (`reset()` `:21741`), sonst schweigt das Publikum ab dem zweiten Kampf fuer immer. Der Reviewer hat das
  bei Takeshi im Gegenversuch nachgewiesen (1/2/3/4 mit der Zeile, 1/1/1/1 ohne).
* **A3 15 → 25 — Schlittschuhe und Kostuem.** Der Audit benennt es woertlich: „Die Waffenebene ist
  korrekt entfernt (`DISZIPLIN_WAFFE` `:2187`) — aber es gibt keine Schlittschuhe, kein Kostuem." Ueber PR 0.2:
  ein `DISZIPLIN_PROP.eiskunstlauf` mit Kufe am Fusspunkt (nicht an der Hand — der Verankerungspunkt
  ist ein anderer, das muss die Tabelle koennen) und einer Kostuemfarbe je Paar.

**Konzept 90 → 95:** eine der vier K-Zeilen steht bei 15/25. K1 (Matrix-Rezept), K2 (`duett:true`, `:10915`), K3 (eigenes Fable-Dokument) sind voll; **K4** hat die Spearman-Brown-Runde (rundenN 6 → 12,
gemessen 0,792 → 0,875), aber keine Kalibrierung gegen echte ISU-Wertungsdaten. Dieselbe kleine
Mess- und Schreibrunde wie bei Breaking (4.2).

**Erwartet:** Assets 30 + 25 + 25 + 20 = **100**, Konzept **95**, Movement mit PR 0.4 **97**.
Eiskunstlauf gesamt 95/100/95/97 = **97 %**.
**Aufwand:** mittel. Zwei bekannte Rezepte plus eine Messrunde.

---

## 5. Die drei mittleren Ziele (Plaetze 5–7)

### 5.1 Platz 5 — Speed-Schach: **Konzept 80 → 95 · Assets 75 → 95 · Movement 80 → 95**

Drei Achsen — aber alle drei flach, und **keine einzige davon ist Forschung.** Speed-Schach hat mit
rho 0,908 die zweitbeste Rangtreue des Feldes und Gameplay 100; es ist die Disziplin mit dem
groessten Abstand zwischen „funktioniert" und „sieht danach aus".

* **Konzept 80 → 95 (K3).** Der Audit sagt es genau: „**kein eigenes Fable-Recherche-Dokument** — der
  Entwurf steht in `takeshi-schach-optik-gameplay-plan-05-09.md` Teil A und in
  `arena-duell-recherche-fable.md` Abschnitt 4, beide geteilt mit anderen Disziplinen." **Ein
  eigenes Dokument schreiben**, das Speed-Schach als Sportart modelliert: warum Blitzschach eine
  Mannschaftsdisziplin sein kann, was ein Brett-gegen-Brett-Vorteil bedeutet, wie sich Zeitnot
  gegen Stellungsvorteil verrechnet. Reine Schreibarbeit, null Coderisiko.
* **Assets 75 → 95 (A4 0 → 20).** Ton, ueber PR 0.1: `zug` (Figurenklack), `schlag`, `uhr`
  (der Druck auf die Schachuhr — das ikonische Geraeusch der Disziplin), `matt`, Publikums-Loop in
  `zeichneSchach()` (`:13016`). Muster #883.
* **Movement 80 → 95 (M2 + M4).** Der Motorkommentar (`:10788`) sagt selbst, die Zugfolge sei
  „eine plausible Zugfolge", keine Schach-Logik. Es braucht **keine Schach-Engine** — es braucht
  eine Bewegung: `stepSchach()` als vierter Zweig in `buehnenBewegung()`, gegated auf `art.schach`
  (`:11008`), mit Figuren, die vom Ausgangs- zum Zielfeld **gleiten** statt zu springen, einer
  sichtbar heruntertickenden Uhr und einer Hand, die auf den Uhrenknopf schlaegt. Plus A3 25 ueber
  PR 0.2 (Schachuhr als Requisite).

**Erwartet:** 95/95/100/95 = **96 %**. **Aufwand:** mittel — drei Achsen, drei bekannte Rezepte.

### 5.2 Platz 6 — Staffel: **Assets 55 → 95 · Movement 70 → 95**

Staffel hat **die beste Rangtreue des ganzen Feldes** (0,915) und seit #880 Gameplay 97. Was fehlt,
ist alles Sichtbare.

* **Assets 55 → 100 — und die Luecke hat einen Namen.** A1 30 (`track.tsx` 321 Z., 13
  Animationsstellen) und A2 25 (`bodenSpurtOval()` `:17719`, eigene Ovalbahn) stehen.
  **A3 = 0: es gibt keinen Staffelstab-Sprite.** Der Audit: „**Kein Staffelstab-Sprite** — der Stab
  ist Mechanik, kein Bild." Das ist die auffaelligste fehlende Requisite im gesamten Projekt: die
  Disziplin heisst nach dem Gegenstand, den man nicht sieht. Ueber PR 0.2, mit Handpunkt-Pixelscan
  wie bei der Hantel. **A4 = 0:** Ton ueber PR 0.1 — `startschuss`, `uebergabe`, `fehlwechsel`,
  `ziel`, Publikums-Loop.
* **Movement 70 → 95 (M1 + M2 + M4).** Ueber PR 0.3 ein `stepStaffel()`: die **fliegende Uebergabe**
  ist die einzige Bewegung, die keine andere Disziplin hat — der wartende Laeufer laeuft an, der
  ankommende holt auf, der Stab wechselt in der Wechselzone die Hand. Die Mechanik dafuer liegt
  vollstaendig vor (`wechselBasis`/`wechselSpanne`/`wechselStrafe`), sie wird heute nur nicht
  gezeichnet. Wartende Laeufer stehen bereits sichtbar in ihrer Zone (`:18297`).

**Erwartet:** 95/100/97/95 = **97 %**. **Aufwand:** mittel. Drei bekannte Rezepte, aber der
Uebergabe-Schritt ist echte Neuarbeit.

### 5.3 Platz 7 — Football: **Gameplay 65 → 95 · Assets 75 → 95 · Movement 85 → 95 · Konzept 90 → 95**

Vier Achsen — aber Football hat die **beste Nicht-Rezept-Ausstattung des Feldes** ausserhalb von
Basketball/Hockey, und seit PR #884 auch die Rangtreue. Es ist der Kandidat mit dem groessten
Sprung je investierter Stunde.

* **Gameplay 65 → 95 (G2 0 → 30) — der Produktionsanschluss.** Das Feldspiel-Chassis existiert
  bereits (`spieleFeldspiel()`, benutzt von Basketball und Hockey). Zu tun ist genau das, was #880
  fuer die Bahn getan hat, nur **ohne neues Chassis**:
  1. `data/generated/football-pps-referenz.json` ziehen — es ist die einzige der dreizehn
     angeschlossenen Disziplinen ohne Referenz (`ls data/generated/*pps-referenz*` selbst geprueft:
     basketball, breaking, eiskunstlauf, fechten, gewichtheben, hockey, showcase, speed-schach,
     spurt, staffel, takeshis-castle, tennis, time-trial, wettessen — **kein football**).
  2. `"football"` in `ARENA_RESOLVED_DISCIPLINE_IDS` (`battle-mode-arena-team-points.ts:236`).
  3. Invarianten-Test analog `tests/spiele-bahn-invarianten.test.ts`.
  **Und die Feldgroessen-Gegenprobe von Fund F1 fahren, bevor der Eintrag gesetzt wird** (5.4) —
  bei Spurt hat genau diese Pruefung gefehlt und 64 von 64 Fixtures verzerrt.
* **Konzept 90 → 95 — hier haengt eine ENTSCHEIDUNG VON CHRIS.** Der Audit: „K4 nur teilweise:
  Anzeige/Teamstaerke/KI-Kauf ordnen Football weiterhin nach der ALTEN Matrix, das Minispiel nach
  der neuen — eine offene Entscheidung von Chris." Solange die zwei Ordnungen auseinanderlaufen,
  kauft die KI nach anderen Kriterien, als das Spiel belohnt. **Das ist der einzige Punkt der
  ganzen Zehnerliste, an dem nicht weitergebaut werden kann, ohne zu fragen** (Abschnitt 8.3).
* **Assets 75 → 95 (A4).** Ton ueber PR 0.1. Football hat mit `footballGear` (`:2685ff`) bereits
  eigene Helme und Montur — A3 ist voll, A1/A2 stehen.
* **Movement 85 → 95.** Der eigene Bericht nennt es „strukturell fertig, aber noch nicht poliert":
  fuenf visuell unterschiedene Spielzugtypen mit je eigener Ballflugbahn stehen. Was fehlt, sind
  M4-Posen (Snap-Haltung, Tackle-Sturz) und der Feinschliff der Uebergaenge.

**Erwartet:** 95/95/95/95 = **95 %**. **Aufwand:** mittel–gross, plus eine Chris-Entscheidung.

### 5.4 Der Pflichtteil fuer JEDEN neuen Produktionsanschluss (Football, Spurt)

Aus Review PR #881, Fund F1 — der Fehler, der Spurt heute noch draussen haelt und der bei Football
genauso passieren kann:

> `BAHN_ART.spurt.jeSeite` ist **4**, nicht 6. Ein Kommentar in `ziehe-buehne-pps-referenz.ts` nahm
> 6 an. Ergebnis, gegen den echten Spielstand gemessen (32 Teams, 64 Fixtures): **alle 64** liefern
> einen zu kleinen Boxscore (512 statt 768 Eintraege), und 4 von 64 liefen 4-gegen-2 statt
> 4-gegen-4. Echte Punkteverzerrung, kein kosmetischer Fehler.

**Deshalb, verpflichtend vor jedem Eintrag in `ARENA_RESOLVED_DISCIPLINE_IDS`:**
`runArenaFixtures()` ueber die volle Liga fahren und **die Boxscore-Eintragszahl gegen
`jeSeite x 2 x Fixtures` pruefen**. Stimmt sie nicht, ist die PPS-Referenz bei der falschen
Feldgroesse gezogen.

---

## 6. Der gemeinsame Verifikations-Pflichtteil

Fuer **jede** PR aus diesem Plan, ohne Ausnahme. Das ist der Teil, an dem heute drei Reviews
Nachbesserungen gefunden haben, die die PR-Beschreibungen nicht kannten.

| Pruefung | Befehl | Erwartung |
|---|---|---|
| Rangtreue aller zwanzig | `node scripts/miss-alle-disziplinen.mjs 24` | **bit-identisch** mit `main`, ausser bei Rezept-PRs (4.2, 4.4-Konzept) |
| Typen | `npx tsc --noEmit`, beide Baeume | `diff` **leer** (nicht „gleich viele Fehler") |
| Slot-Invariante | `npx tsx scripts/pruefe-slot-invariante.ts` | haelt |
| **Ton-Leck-Test** | eine Playwright-Sonde, die in den **Geschwister-Disziplinen desselben Chassis** die `sfx()`-Ereignisse zaehlt | **0** — genau der Test, den PR #883 nicht gefahren hatte und der Kern des Risikos ist, weil Chassis-Zweige geteilt sind |
| **Loop-Reset-Gegenversuch** | dieselbe Sonde ueber **vier** aufeinanderfolgende Kaempfe | Starts 1/2/3/4, nicht 1/1/1/1 |
| Spiegel-Frische | `npx tsx scripts/pruefe-spiegel-frische.ts` | frisch, **bevor** gegen den Spielstand gemessen wird |
| Feldgroesse (nur bei neuem Anschluss) | s. 5.4 | Boxscore-Eintraege = `jeSeite x 2 x Fixtures` |

**Der Vertrag, der alles traegt:** Bewegungs- und Ton-PRs schreiben ausschliesslich `viz*`-Felder und
rufen niemals `rr()`. Deshalb duerfen sie die Rangtreue nicht um eine Nachkommastelle bewegen — und
das ist zu **messen**, nicht zu behaupten. Heute haben #874, #875, #876 und #883 diesen Beweis
geliefert; #883 sogar ueber alle siebzehn nicht beteiligten Disziplinen.

---

## 7. Reihenfolge, Aufteilung, Kollisionsmatrix

### 7.1 Das Problem: `battle-mode.engine.js` ist EINE Datei

Alle zwanzig Disziplinen leben in derselben ~23 000-Zeilen-Datei. Parallelarbeit ist nur ueber
**disjunkte Regionen** moeglich. Die Matrix:

| PR | `battle-mode.engine.js`-Region | andere Dateien |
|---|---|---|
| **0.1 Ton-Katalog** | `:16980-17014` **nur** | — |
| **0.2 Requisiten** | `:2185-2200`, `:2980-2990` | — |
| **0.3 `bahnBewegung()`** | `:19265-19800` | — |
| **0.4 Kleinbefunde** | `:11779`, `:11993`, `:12081`, `:13410`, `:13419`, `:17327`, `:19539` | — |
| 1 Gewichtheben M | `:11879-11883` (Dispatcher-Zeile), neuer `stepHeben()`-Block, `:370-377` | `barbell.tsx` |
| 2 Breaking K | — (voraussichtlich **null** Codezeilen) | neues Dokument |
| 3 Takeshi M | neuer `stepParcours()`-Block hinter 0.3, `:18186` | `takeshi.tsx` |
| 4 Eiskunstlauf A+K | `:11957-11963`, `:12289`, `:21741` | `eiskunst.tsx`, neues Dokument |
| 5 Speed-Schach K+A+M | `:11879-11883`, neuer `stepSchach()`-Block, `:13016` | `schach.tsx`, neues Dokument |
| 6 Staffel A+M | neuer `stepStaffel()`-Block hinter 0.3, `:17719` | `track.tsx` |
| 7 Football G+A+M+K | `:6658-7200` (Football-Block), `:4430` | `football.tsx`, **`battle-mode-arena-team-points.ts:236`**, `scripts/ziehe-*`, `data/generated/football-pps-referenz.json`, `tests/` |
| 8 Time-Trial A+M | `:17499`, neuer Block hinter 0.3 | `peloton.tsx` |
| 9 Spurt G+A+M | `:17499`, neuer Block hinter 0.3 | **`battle-mode-arena-team-points.ts:236`**, `data/generated/spurt-pps-referenz.json` |
| 10 Fechten K+A+M | `:11146` (Rezept), `:11879-11883` | `lamps.tsx`, neues Dokument |

**Drei echte Kollisionen, alle vermeidbar:**

1. **Die Dispatcher-Zeile in `buehnenBewegung()`** (`:11879-11883`) wird von 1, 5 und 10 angefasst.
   → **Loesung:** PR 0.3 legt gleich **alle vier** Gates (`heben`, `schach`, `fechten` plus
   Bahn-Dispatcher) mit dem `typeof`-Waechterschutz an, so wie `:11881-11882` es fuer `duett`/`cypher`
   vormacht. Danach fasst keine Ziel-PR die Zeile mehr an — sie liefert nur ihre Funktion.
2. **`ARENA_RESOLVED_DISCIPLINE_IDS`** wird von 7 (Football) und 9 (Spurt) angefasst.
   → **Loesung:** serialisieren. Football zuerst, Spurt danach — Spurt braucht ohnehin erst das
   F1-Vorticket.
3. **`bodenSpurt()`** (`:17499`) wird von 8 (Time-Trial) und 9 (Spurt) geteilt.
   → **Loesung:** 8 und 9 nicht parallel vergeben, oder Time-Trial bekommt vorher ein eigenes
   `bodenZeitfahren()` (was A2 ohnehin verlangt, s. 9.1).

### 7.2 Die Reihenfolge

```
Welle 0 (seriell, blockiert alles)      PR 0.1  PR 0.2  PR 0.3  PR 0.4
                                          |       |       |       |
Welle 1 (vier parallel, kollisionsfrei) --+-------+-------+-------+--
   1 Gewichtheben M     (braucht 0.3)
   2 Breaking K         (braucht nichts)
   3 Takeshi M          (braucht 0.2, 0.3)
   4 Eiskunstlauf A+K   (braucht 0.1, 0.2)
                              |
Welle 2 (drei parallel) ------+--
   5 Speed-Schach       (braucht 0.1, 0.2, 0.3)
   6 Staffel            (braucht 0.1, 0.2, 0.3)
   7 Football           (braucht 0.1 + Chris' Matrix-Entscheidung)
                              |
Welle 3 (seriell, gross) -----+--
   8 Time-Trial   ->   9 Spurt   ->   10 Fechten
```

**Nach Welle 1: vier Disziplinen mit allen vier Kategorien >90.** Nach Welle 2: sieben. Welle 3 ist
eine eigene Session, wahrscheinlich zwei.

### 7.3 Was ausdruecklich NICHT in diesen Plan gehoert

* **Die Arena** (TDM / Mini-DM / Battlefield). Vor jedem Eingriff dort braucht es ein Messbudget
  (n ≥ 96–150), weil die Kader-Spannweite groesser als der Median ist. Ohne das ist kein Erfolg
  nachweisbar. Eigenes Ticket, eigene Session.
* **Climbing, I-Spy, Showcase, Wettessen.** Vier Achsen bzw. eine fehlende Sportidentitaet.
* **`baue-rangtreue-basislinie.mjs` nachziehen.** Faellig (die Basislinie ist an mehreren Stellen
  stale, jetzt zusaetzlich durch Football), aber ein Pflege-PR, kein Ziel dieses Plans.

---

## 8. Drei Entscheidungen fuer Chris

### 8.1 E1 — Basketball: acht Punkte, die Chris schon abgenommen hat

Basketball steht bei **Konzept 100 / Assets 100 / Movement 100** und ist die Referenz des Projekts.
Es faellt aus der Zehnerliste allein an **Gameplay 82**, und die acht fehlenden Punkte sind
ausschliesslich G1: rho 0,769 statt der 0,80, die die Stufe verlangt. **Genau diese Zahl hat Chris
fuer den Live-Betrieb ausdruecklich abgenommen.**

Es gibt zwei Wege, und ich empfehle den zweiten:

* **(a) Die Rubrik mit einer Fussnote versehen** („von Chris abgenommene rho zaehlt als bestanden").
  Kostet null Arbeit und macht Basketball sofort zur ersten Disziplin mit allen vier Kategorien
  >90. **Ich rate ab** — es hoehlt genau die Zahl aus, nach der Chris gefragt hat, und danach
  bedeutet „>90 in allen Kategorien" nicht mehr dasselbe wie heute.
* **(b) Die 0,031 wirklich holen.** Kleinster Umfang der ganzen Liste (eine Achse, eine Zahl),
  groesstes Risiko (Forschung, kein Bau). Basketballs Validitaet ist mit 0,923 die zweithoechste des
  Feldes; die Verlaesslichkeit liegt bei 0,69. Nach CLAUDE.mds Zwei-Spalten-Regel fehlen also
  **Ereignisse bzw. Ereignis-Konzentration**, nicht Rezept. Der `LOS_KAPPA=3`-Hebel ist bei
  Basketball allerdings schon gezogen (`:4846`) — der naheliegende naechste Kandidat ist
  `USAGE_KAPPA=2` (`:4851`), der bewusst flacher steht.

**Meine Empfehlung: (b), aber als eigenes Forschungsticket, nicht als Platz in der Zehnerliste.**

### 8.2 E2 — Hockey: der beste ungenutzte Rangtreue-Hebel im Projekt

Hockey steht bei 100 / 80 / 72 / 100. **Assets waeren in einem Tag bei 100** (Ton, Muster #883 —
Hockey hat mit `eisflaeche()` bereits die vollstaendige Kulisse und ist die einzige Disziplin ausser
Basketball mit eigener Flaeche und eigenen Bewegungen). Gameplay verlangt rho **0,669 → 0,80**.

**Beim Nachsehen fuer diesen Plan gefunden, und es ist ein echter Fund:** Hockey hat **keine
Live-Engine** — der Motor sagt es selbst (`:4883-4886`: „Hockey hat noch keine Live-Engine wie
`stepBasketballLive`; die `MOTOREN[hockey]` rechnet die Partie vorab durch"). Es laeuft durch den
generischen `fsZuege`-Vorab-Durchlauf in `bauFeldspiel()` (`:5725ff`) und lost dort ueber die
**lineare** `gewichtetesLos()` (`:4814-4819`).

**Das ist Zeile fuer Zeile die Lage, aus der Football heute +0,284 geholt hat.** Der Commit von
PR #884 sagt es woertlich: *„Football zog bis hierher linear ueber `gewichtetesLos()` (70 gegen 40 =
64:36) … NEUE Funktion, keine Aenderung an `gewichtetesLos()` — **Hockey und Tennis rufen weiter die
unveraenderte Fassung auf**."* Hockey ist damit die letzte Feldspiel-Disziplin auf der flachen
Lotterie.

**Empfehlung: ein eigenes Ticket „Hockey-Gameplay Runde 1", nach dem Football-Muster** — `hkLos()`
mit eigener Kappa-Konstante, plus die Pruefung, ob Hockeys Sub-Skills dieselbe Duplikat-Falle
tragen wie Footballs TEAMGEIST/BALLSICHERHEIT. Nicht Teil der Zehnerliste, aber der aussichtsreichste
Einzelhebel, den das Projekt gerade offen hat.

### 8.3 E3 — Football: welche Matrix gilt?

Blockiert Platz 7 auf der Konzept-Achse. Anzeige, Teamstaerke und KI-Kauf ordnen Football nach der
**alten** Matrix, das Minispiel nach der **neuen** (`spielEignung`-Block, PR #803). Solange das so
bleibt, kauft die KI nach anderen Kriterien, als das Spiel belohnt — und ein Spieler, der seine
Aufstellung nach der angezeigten Staerke baut, wird bestraft.

**Zu entscheiden:** zieht die Anzeige-/Kauf-Seite auf die neue Matrix nach (mein Vorschlag), oder
bleibt die alte die verbindliche und das Minispiel zieht zurueck?

---

## 9. Ehrliche Einschaetzung — wie viele der zehn wirklich kommen

### 9.1 Sicher: sieben

**Plaetze 1–7.** Jeder einzelne Schritt dort hat entweder eine Vorlage aus dieser Session
(#874/#875 fuer Bewegungsmaschinen, #876 fuer Requisiten an der Hand, #883 fuer Ton, #880 fuer den
Produktionsanschluss) oder ist reine Mess- und Schreibarbeit. Kein Schritt verlangt, dass eine
Rangtreue-Zahl steigt.

**Der einzige Vorbehalt bei den sieben** ist Football: rho steht bei **0,800** — exakt auf der
Schranke, nicht darueber, bei einer Kader-Spannweite von 0,054. Sinkt die Zahl bei einer spaeteren
Messung auf 0,799, faellt G1 von 35 auf 22 und Gameplay von 95 auf 82. **Empfehlung: eine kurze
Runde 2 fuer Football, bevor der Anschluss gesetzt wird**, mit dem Ziel 0,83–0,85, damit die Zahl
Luft hat. Der Plan `opus-plan-football-gameplay-09-10.md` hat die Messtabelle dafuer bereits.

### 9.2 Unsicher: drei

**Plaetze 8–10 sind keine Feinschliff-Arbeiten, sondern Neubauten.**

* **Time-Trial** braucht Assets 45 → >90 und Movement 50 → >90. Der Kern ist ein einzelner Satz aus
  dem Audit: „im Mockup ist das Streckenprofil **unsichtbar** — `gelaende` wirkt in
  `gelaendeFaktor()` (`:19105`) und erscheint nur als HUD-Balken, nicht auf der Bahn. **Man sieht
  keinen Berg.**" Ein Zeitfahren ohne sichtbares Profil hat keine eigene Optik. Das ist ein eigenes
  `bodenZeitfahren()` mit Hoehenprofil, plus eine Bewegung, die Steigung und Abfahrt am Fahrer zeigt.
* **Spurt** braucht zuerst das F1-Vorticket (PPS-Referenz bei `jeSeite` **4** neu ziehen), dann
  Assets 55 → >90 und Movement 60 → >90.
* **Fechten** ist der schwierigste Platz der Liste und zugleich der noetigste: Konzept 55, Movement
  35 — **und das Rezept steht LIVE auf einem im Code selbst als „ERSTER, AUSDRUECKLICH NICHT
  FINALER Sieben-Rollen-Entwurf" bezeichneten Stand** (`:11146`), mit einem Puffer zur Schranke von
  0,016 bei einem Kaderrauschen von 0,192. Von den dreizehn produktiven Disziplinen ist das die
  einzige mit einem echten Rangtreue-Risiko. Die Kalibrierrunde ist unabhaengig vom Zehner-Auftrag
  faellig.

**Aufwandsschaetzung fuer 8–10 zusammen: mehr als die gesamte heutige Session**, in der vier
Disziplinen je **eine** Achse bekommen haben. Hier sind es drei Disziplinen mit je **zwei bis drei**
Achsen von einem deutlich niedrigeren Ausgangspunkt.

### 9.3 Die Antwort auf Chris' Frage, in einem Satz

**Sieben Disziplinen sind mit vertretbarem Aufwand auf „alle vier Kategorien >90 %" zu bringen —
Gewichtheben, Breaking, Takeshi's Castle, Eiskunstlauf, Speed-Schach, Staffel und Football.** Die
Zehn sind erreichbar, aber nicht in einer Welle: Time-Trial, Spurt und Fechten sind je ein Neubau
von zwei bis drei Achsen. Und die strukturelle Huerde dahinter ist, dass **nur elf Disziplinen die
G1-Stufe ueberhaupt erreichen koennen** — die Liste hat exakt eine Reserve, und die beiden
bestfertigen Disziplinen des Projekts (Basketball, Hockey) stehen allein wegen einer Rangtreue-Zahl
draussen, die Chris selbst abgenommen hat.

---

## 10. Grenzen dieses Plans

1. **Keine Sicht-QA.** Wie beim Audit vom Vormittag stammen alle Aussagen ueber Optik und Bewegung
   aus gelesenem Zeichencode, nicht aus Screenshots. Die Assets- und Movement-Spalten wuerden sich
   durch eine Sichtprobe in beide Richtungen verschieben.
2. **Die Neueinstufungen in 1.2 sind Einstufungen, keine Messungen.** Nur die rho-Spalte ist
   gemessen. Wo ich von der Basislinie abweiche, steht die Begruendung mit Datei:Zeile dabei — aber
   ein anderer Bewerter kaeme bei Gewichtheben-Movement (87) und Takeshi-Movement (85) plausibel auf
   ±5.
3. **Siebzehn der zwanzig rho-Werte** sind aus dem Messlauf des Reviews zu PR #883 uebernommen (auf
   demselben Code, `25d1d388`); Football, Basketball und Hockey habe ich fuer diesen Plan selbst
   gemessen. Da PR #884 nur den Football-Block angefasst hat und der Reviewer die Bit-Identitaet der
   uebrigen siebzehn belegt hat, ist das zulaessig — aber es ist eine Uebernahme, keine eigene
   Messung.
4. **Kein Zugriff auf den Server** (CLAUDE.md). Die Kaderfamilie stammt aus dem `live-save`-Abbild
   vom 03.09.; die Spiegel-Frische wurde fuer diesen Plan nicht neu geprueft.
5. **Kein aktiver Save nutzt Battle Mode.** Die gesamte G2-Spalte ist damit real, aber latent — sie
   wirkt auf keinen von Chris' aktuellen Spielstaenden, bis ein NEUER Save mit Battle-Mode-Wahl
   angelegt wird. Das gilt auch fuer jeden Anschluss, den dieser Plan neu vorschlaegt.
