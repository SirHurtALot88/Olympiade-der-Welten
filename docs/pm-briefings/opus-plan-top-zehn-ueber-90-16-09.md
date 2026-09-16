# Opus-Plan: die Top 10 über 90 % (16.09.)

**Auftrag von Chris (woertlich, 16.09.):** „Wie schaffst du es die top 10 diszis über 90% zu heben?
Gibt's dafür ne Review und nen Plan? Lass opus das bauen und setz das dann um." Dieses Dokument ist
die Review und der Plan. Es aendert **keine Zeile Produktionscode**.

**Stand beim Schreiben:** `main` = `ef80d7aa` („Scorecard: Time-Trial und Climbing auf 86 %/66 %
nachziehen", 16.09. 18:39). Alle sechs heutigen Merges sind darin: #943 (Climbing-Kalibrierung +
Produktionsanbindung), #945/#946 (Fechten Rezept + Movement/Assets), #947 (Scorecard Fechten), #948
(Zeitfahren Movement/Assets), #949 (Scorecard Time-Trial/Climbing).

**PR #944 ist NICHT gemergt — selbst nachgeprueft, nicht aus dem Auftrag uebernommen.**
`mcp__github__list_pull_requests` auf `SirHurtALot88/Olympiade-der-Welten` liefert fuer #944
(„Football-Balance-Runde: breit + Skala 0,35, rho 0,722 → 0,796") `state: open`, `draft: true`,
`merged_at: null`. Football steht auf `main` weiterhin bei rho **0,722** — und selbst der PR-Titel
sagt, dass die Runde mit 0,796 **unter** der Schranke bleibt und Football ausserhalb der Arena
bleibt. Fuer diesen Plan ist Football damit unveraendert Platz 12.

**Grundlage der Rubrik:** `docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md`
Abschnitt 0 — Konzept K1–K4 je 25 · Assets A1 30 / A2 25 / A3 25 / A4 20 · Gameplay G1 40 / G2 30 /
G3 15 / G4 15 (Bahn/Arena 12) · Movement M1 35 / M2 25 / M3 25 / M4 15. **Gesamt = ungewichteter
Durchschnitt der vier Achsen.**

**Dieses Dokument schreibt den 10.09.-Plan NICHT fort.** Dessen Zahlen sind sechs Tage und rund
dreissig PRs alt; seine Zehnerliste (Fechten Platz 10, Time-Trial Platz 8, Spurt Platz 9) beschreibt
ein Feld, das es nicht mehr gibt. Jede rho-Zahl unten ist **heute frisch gemessen**, jede
Code-Aussage am heutigen `main` mit Datei:Zeile belegt.

---

## 0. Die Kurzfassung — und die Zahl, die überrascht

### 0.1 Neun von zehn sind schon drüber. Es fehlt genau eine Zeile.

> **Sortiert man alle zwanzig Disziplinen nach der Gesamt-Spalte, liegen neun der obersten zehn
> bereits über 90 %. Die einzige Ausnahme ist Time-Trial mit 85,5 % — und sie haengt an EINER
> Achse (Assets 55), die an ZWEI Teilkriterien haengt (A3 Requisite, A4 Ton), von denen die letzte
> PR beide ausdruecklich als „bewusst ausgelassen" protokolliert hat.**

Das ist die ganze Antwort auf Chris' Frage in der Lesart „Gesamt ueber 90 %": **eine einzige
Bauagenten-Runde, reine Praesentation, kein rho-Risiko.** Assets 55→75 (nur Ton) reicht bereits
(Gesamt 90,5 %); Assets 55→80 (nur Requisite) reicht auch (91,75 %); beides zusammen bringt
Time-Trial auf **96,75 %**.

Der Grund, warum das so billig ist, steht in `docs/design/zeitfahren-movement-assets-16-09.md`
selbst, Abschnitt „Nicht Teil dieser PR": *„Kein neuer Ton — `TON_KATALOG[\"time-trial\"]` (`start`,
`zwischenzeit`, `bergauf`, `ziel`, `publikum`) bestand schon vollstaendig und war nicht Teil des
Auftrags"* und *„Keine Requisite ... bewusst ausgelassen, niedrige Prioritaet"*. Die Runde von
heute Nachmittag hat die zwei teuren Achsen (Movement 65→100, A2) gebaut und die zwei billigen
liegen lassen.

### 0.2 Die zweite Lesart, die Chris auch gemeint haben kann

Der 10.09.-Plan las denselben Satz strenger: **„alle vier Kategorien >90"**, nicht „Gesamt >90".
Unter dieser Lesart sieht das Bild anders aus — **fuenf von zehn bestehen**, fuenf nicht:

| Disziplin | Gesamt | besteht „alle vier >90"? | Achse(n) ≤90 |
|---|--:|:--:|---|
| Takeshi's Castle | 96,75 | **ja** | — |
| Breaking | 96,50 | **ja** | — |
| Speed-Schach | 96,25 | **ja** | — |
| Eiskunstlauf | 96,00 | **ja** | — |
| Staffel | 95,50 | **ja** | — |
| Gewichtheben | 97,50 | nein (knapp) | Gameplay **genau 90**, nicht >90 |
| Basketball | 95,50 | nein | Gameplay 82 (rho 0,769) |
| Hockey | 93,00 | nein | Gameplay 72 (rho 0,669) |
| Fechten | 91,25 | nein | Konzept 75 (K4), Gameplay genau 90 |
| Time-Trial | 85,50 | nein | Assets 55 |

Dieser Plan beantwortet **beide** Lesarten und sagt bei jeder Zeile ehrlich, ob sie wirtschaftlich
erreichbar ist. Kurzfassung der strengen Lesart: **Time-Trial ja (billig), Gewichtheben ist ein
Messkanten-Artefakt (keine Bauaufgabe, eine Methodenentscheidung), Fechten braucht ein Werkzeug, das
es im Repo nicht gibt, und Basketball/Hockey sind die von Chris selbst abgenommene rho-Wand — die
zwei sind NICHT wirtschaftlich zu heben und sollen es auch nicht sein.**

### 0.3 Die Bauaufträge, sortiert nach Aufwand je Nutzen

| # | Auftrag | Achse(n) | Aufwand | Risiko | Gewinn |
|--:|---|---|---|---|---|
| **B1** | **Time-Trial: Requisite + Ton** | Assets 55 → 100 | **eine Runde** | **keins** (reine Praesentation) | 85,5 → **96,75** — Ziel erreicht |
| **B2** | **Spurt: Requisite + Ton + Huerdenpose** | Assets 55 → 100, Movement 85 → 100 | **eine Runde** | **keins** (reine Praesentation) | 83,0 → **98,0** — elfte Zeile ueber 90 |
| **B3** | **Stufenwaechter in der CI** | — (Absicherung) | halbe Runde | keins (nur Sonde) | schuetzt alle zehn Zeilen gegen ein stilles G1-Abrutschen |
| B4 | `scripts/baue-buehne-rezept.mjs` | Konzept K4 fuer 5 Buehnen-Zeilen | mehrere Runden | Messung noetig | macht Fechtens K4 ueberhaupt erst erreichbar |
| — | Gewichtheben Gameplay 90 → 95 | Gameplay | **keine Bauaufgabe** | — | Methodenentscheidung, s. 3.1 |
| — | Basketball / Hockey Gameplay | Gameplay | **nicht wirtschaftlich** | — | s. 3.3 |

**B1 allein erfuellt den Auftrag.** B1+B2 bringen die obersten **elf** Zeilen ueber 90 % — dann ist
egal, welche zehn Chris meint, und der Projektdurchschnitt steigt von 76 % auf **78 %**.

---

## 1. Die Top 10 — hergeleitet, nicht behauptet

### 1.1 Die Rangliste, alle zwanzig nach Gesamt sortiert

Quelle der vier Achsen: Abschnitt 1 der Scorecard, Stand nach dem dreizehnten Nachtrag (16.09.).
Die Gesamt-Spalte ist hier **exakt** ausgerechnet (ungerundet), weil die Scorecard-Tabelle rundet
und zwei Zeilen dadurch gleich aussehen, die es nicht sind.

| Rang | Disziplin | Chassis | Konzept | Assets | Gameplay | Movement | **Gesamt (exakt)** | rho je Spiel |
|--:|---|---|--:|--:|--:|--:|--:|--:|
| **1** | **Gewichtheben** | Buehne | 100 | 100 | 90 | 100 | **97,50** | 0,843 |
| **2** | **Takeshi's Castle** | Bahn | 100 | 95 | 97 | 95 | **96,75** | 0,879 |
| **3** | **Breaking** | Buehne | 95 | 100 | 95 | 96 | **96,50** | 0,869 |
| **4** | **Speed-Schach** | Buehne | 95 | 95 | 100 | 95 | **96,25** | 0,908 |
| **5** | **Eiskunstlauf** | Buehne | 95 | 100 | 95 | 94 | **96,00** | 0,885 |
| **6** | **Staffel** | Bahn | 95 | 95 | 97 | 95 | **95,50** | 0,899 |
| **7** | **Basketball** | Feldspiel | 100 | 100 | 82 | 100 | **95,50** | 0,769 |
| **8** | **Hockey** | Feldspiel | 100 | 100 | 72 | 100 | **93,00** | 0,669 / 0,719 |
| **9** | **Fechten** | Buehne | 75 | 100 | 90 | 100 | **91,25** | 0,826 |
| **10** | **Time-Trial** | Bahn | 95 | **55** | 92 | 100 | **85,50** | 0,825 |
| — | — | — | — | — | — | — | *— Schnitt —* | — |
| 11 | Spurt | Bahn | 95 | 55 | 97 | 85 | 83,00 | 0,894 |
| 12 | Football | Feldspiel | 90 | 75 | 52 | 85 | 75,50 | 0,722 |
| 13 | Tennis | Buehne | 75 | 70 | 90 | 50 | 71,25 | 0,825 |
| 14 | Climbing | Bahn | 65 | 40 | 92 | 65 | 65,50 | 0,834 |
| 15 | Mini-DM | Arena | 75 | 60 | 22 | 60 | 54,25 | 0,256 |
| 16 | Battlefield | Arena | 70 | 60 | 22 | 60 | 53,00 | 0,251 |
| 17 | TDM | Arena | 55 | 65 | 22 | 65 | 51,75 | 0,165 |
| 18 | Wettessen | Buehne | 35 | 40 | 95 | 15 | 46,25 | 0,845 |
| 19 | Showcase | Buehne | 25 | 40 | 95 | 20 | 45,00 | 0,892 |
| 20 | I-Spy | Buehne | 55 | 40 | 37 | 20 | 38,00 | 0,684 |

**Die Plaetze 6 und 7 stehen exakt gleich (95,50).** Gebrochen ist der Gleichstand nach der
schwaechsten Einzelachse — Staffels schlechteste ist 95, Basketballs ist 82. Fuer das Ergebnis
dieses Plans ist die Reihenfolge der beiden egal: beide liegen ueber 90, beide sind in der Top 10.

**Die Grenze zwischen Platz 10 und 11 ist mit 2,5 Punkten deutlich** (85,50 gegen 83,00) — die
Top 10 ist keine Wackelentscheidung. Nach B1+B2 dreht sich das Paar um (Spurt 98,0 vor Time-Trial
96,75), aber dann sind beide drueber und die Frage stellt sich nicht mehr.

**Basketball und Hockey stehen zu Recht hier oben.** Beide haben Konzept/Assets/Movement bei 100
und fallen allein an rho durch — und genau diese zwei rho-Zahlen hat Chris ausdruecklich fuer den
Live-Betrieb abgenommen (CLAUDE.md, Scorecard Zeilen 1/5). Das ist die dokumentierte Ausnahme, kein
Fehler der Sortierung.

### 1.2 rho frisch gemessen — zwölf Zeilen, keine Überraschung

Nicht aus der Scorecard uebernommen, sondern fuer diesen Bericht neu gefahren auf `main`
@ `ef80d7aa`:

```
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben takeshis-castle breaking speed-schach \
  eiskunstlauf staffel basketball hockey fechten time-trial spurt football
```

```
Disziplin           Chassis     Teiln.  rho je Spiel (Median)  Spannweite  rho Saison  Abnahme
speed-schach        buehne         12                  0.908       0.066       0.972   bestanden
staffel             bahn           12                  0.899       0.100       0.951   bestanden
spurt               bahn           12                  0.894       0.138       0.916   bestanden
eiskunstlauf        buehne         12                  0.885       0.083       0.979   bestanden
takeshis-castle     bahn           12                  0.879       0.101       0.958   bestanden
breaking            buehne         12                  0.869       0.114       0.951   bestanden
gewichtheben        buehne         12                  0.843       0.208       0.930   bestanden
fechten             buehne         12                  0.826       0.203       0.888   bestanden
time-trial          bahn           12                  0.825       0.082       0.825   bestanden
basketball          feldspiel      12                  0.769       0.105       0.923   knapp
football            feldspiel      12                  0.722       0.164       0.832   knapp
hockey              feldspiel      12                  0.669       0.181       0.832   durchgefallen
  davon nur Feldspieler            12                  0.719       0.182       0.818   knapp
```

**Alle zwoelf sind ziffernidentisch zur Scorecard UND zur eingecheckten Basislinie**
(`data/generated/rangtreue-basislinie.json`, gezogen 16.09. 15:06, enthaelt Climbings 0,834 und
Fechtens 0,826 bereits). Keine Regression, keine stale Zeile, **kein Basislinien-Nachzug noetig** —
anders als am 10.09. und am 14.09., wo dieser Abschnitt jedesmal acht stale Eintraege meldete.

### 1.3 Ein methodischer Hinweis, den man beim Rückrechnen braucht

Die vier Achsenzahlen sind laut Abschnitt 0 der Scorecard ausdruecklich **„kein Messwert, sondern
eine begruendete Einstufung"**. Sie sind deshalb **nicht ueberall streng additiv** aus
G1+G2+G3+G4 bzw. A1+…+A4: mehrere Buehnen-Zeilen tragen bei Gameplay eine 5-Punkte-Abwertung, die
dieselbe Ursache hat wie Bahn/Arenas 12-statt-15 bei G4 (die 2–6-Spieler-Wirkung ist im Code
geschlossen, aber nie nachgemessen — Scorecard 3.3). Wer aus „Gameplay 95" auf
„40+30+15+15 = 100" zurueckrechnet, landet daneben.

**Fuer diesen Plan ist das ohne Folgen**, weil die einzige Zeile unter 90 (Time-Trial) auf der
**Assets**-Achse haengt, und die ist bei ihr sauber additiv und in der Scorecard explizit
aufgeschluesselt: 55 = A1 30 + A2 25, A3 und A4 offen. Bei den Achsen, wo es Folgen haette
(Gameplay der strengen Lesart), ist es unten in 3.1 benannt.

---

## 2. Die einzige Lücke: Time-Trial, Assets 55

Time-Trial steht bei **95 / 55 / 92 / 100**. Konzept, Gameplay und Movement sind alle ueber 90 —
Movement erst seit heute Nachmittag (PR #948 hob es von 65 auf 100). **Assets 55 ist die einzige
Zahl, die diese Zeile unter 90 haelt.**

### 2.1 A3 (25 Punkte) — es gibt keine Time-Trial-Requisite. Beleg im Code.

`DISZIPLIN_PROP` ist die zentrale Requisiten-Tabelle
(`public/mockups/battle-mode.engine.js:2730-2741`). Sie fuehrt heute **acht** Eintraege:

```js
  const DISZIPLIN_PROP={
    gewichtheben:{ hand:HEBEN_HAND,   phasen:HEBEN_PHASEN,  zeichne:zeichneHantel },
    takeshi:     { hand:TAKESHI_HAND, phasen:TAKESHI_PHASEN,zeichne:zeichneStartnummer },
    hockey:      { hand:HOCKEY_HAND,  phasen:HOCKEY_PHASEN, zeichne:zeichneHockeyschlaeger },
    staffel:     { hand:STAFFEL_HAND, phasen:null,          zeichne:zeichneStab },
    "speed-schach":{ hand:SCHACH_HAND, phasen:SCHACH_UHR_PHASEN, zeichne:zeichneSchachuhr },
    eiskunstlauf:{ fuss:FUSS_EISKUNSTLAUF, phasen:KUFE_PHASEN, zeichne:zeichneKufe },
    tennis:      { hand:TENNIS_HAND, phasen:TENNIS_PHASEN, zeichne:zeichneSchlaeger },
    fechten:     { hand:FECHTEN_HAND, phasen:FECHTEN_PHASEN, zeichne:zeichneDegen },
  };
```

**Kein `"time-trial"`, kein `zeitfahren`.** Ein Zeitfahrer traegt heute buchstaeblich nichts, was
ihn von einem Spurt-, Staffel- oder Climbing-Laeufer unterscheidet.

Das PR-Dokument von heute Nachmittag sagt es selbst
(`docs/design/zeitfahren-movement-assets-16-09.md`, Abschnitt „Nicht Teil dieser PR"):
*„Keine Requisite (s. ‚Nicht ideal' oben) — bewusst ausgelassen, niedrige Prioritaet."*

### 2.2 A4 (20 Punkte) — der Ton-Katalog ist fertig und wird an null Stellen aufgerufen.

`TON_KATALOG["time-trial"]` (`public/mockups/battle-mode.engine.js:20504-20510`) steht seit PR 0.1
(12.09.) **vollstaendig** mit fuenf Ereignissen:

```js
    "time-trial":{
      start:         {synth:(vol)=>tonSchlag(vol,900,300,0.12)},
      zwischenzeit:  {synth:(vol)=>tonKlick(vol,2400,0.04)},
      bergauf:       {synth:(vol)=>tonMetall(vol,350,0.3)},
      ziel:          {synth:(vol)=>tonDoppelton(vol,700,1050,0.32)},
      publikum:      {loop:true, synth:(vol)=>tonRauschen(vol,500,0,true)}
    },
```

Ein `grep` ueber alle `sfx(`-Aufrufstellen im Motor liefert **acht** Disziplinen mit verdrahtetem
Ton — hockey (`:7310, :9360, :9894, :10065`), gewichtheben (`:13410, :15692-15694`), eiskunstlauf
(`:13768, :13769, :13844, :13845`), breaking (`:14202, :14209, :14211`), fechten (`:14425, :14431`,
seit PR #946 von heute), speed-schach (`:15980, :16059, :16060`), takeshis-castle (`:23808, :24005,
:24015, :24247`), staffel (`:24372, :24417, :24427`). **`sfx("time-trial", …)` steht an null
Stellen.** Dasselbe gilt fuer `spurt` und `football`.

Auch das steht im PR-Dokument von heute ausdruecklich als bewusst offen gelassen.

Die Scorecard vergibt A4 **binaer** („hat Ton" = 20, unabhaengig von der Zahl der Aufrufstellen,
Abschnitt 3.1) — genau so hat sie es bei Hockey, Speed-Schach, Eiskunstlauf und zuletzt bei Fechten
gehandhabt. **Zwei echte Aufrufstellen genuegen**, so wie `stepFechten()` heute frueh mit zwei
Ereignissen A4 von 0 auf 20 gehoben hat.

### 2.3 Die Arithmetik — was jedes Teilkriterium allein bringt

| Zustand | Assets | Gesamt (95 / A / 92 / 100) | über 90? |
|---|--:|--:|:--:|
| heute | 55 | **85,50** | nein |
| nur A4 (Ton) | 75 | **90,50** | **ja** |
| nur A3 (Requisite) | 80 | **91,75** | **ja** |
| A3 + A4 | 100 | **96,75** | **ja, mit Puffer** |

**Jedes der beiden Teilkriterien allein reicht.** Beide zusammen sind trotzdem der richtige
Auftrag: sie liegen in derselben Datei, in denselben zwei Funktionen, und der Unterschied im
Aufwand zwischen „einem" und „beiden" ist kleiner als der Aufwand, zweimal eine Runde aufzusetzen.
Und der Puffer ist es wert — mit 90,50 haengt die Zeile an der Rundungskante, mit 96,75 nicht.

---

## 3. Die strenge Lesart — fünf weitere Zeilen und was sie kosten

### 3.1 Gewichtheben: eine Messkante, kein Befund über die Disziplin

Gewichtheben steht bei Gameplay **genau 90** — nicht >90. Der Grund ist allein die G1-Stufenleiter
mit ihrer Kante bei rho = 0,85. Gemessen (n=24): **0,843**. Eine Stufe tiefer, fuenf Punkte weg.

**Selbst nachgemessen fuer diesen Plan, bei n=48:**

```
node scripts/miss-alle-disziplinen.mjs 48 gewichtheben
gewichtheben  buehne  12   0.851   Spannweite 0.187   Saison 0.937   bestanden
```

**0,851 — auf der anderen Seite der Kante.** Bei n=24 faellt die Zeile auf 90, bei n=48 steht sie
auf 95. Der Unterschied betraegt 0,008 bei einem **Kaderrauschen von 0,187 bis 0,208** — er ist von
Null nicht zu unterscheiden (`docs/design/messgrundlage-kaderfest.md`). Die Scorecard sagt das
ueber ihre eigene Zahl bereits woertlich: *„Das ist ein Artefakt der Kante, kein Befund ueber
Gewichtheben."*

**Empfehlung: keine Bauaufgabe.** Eine Rezeptrunde koennte rho nicht um mehr bewegen, als das
Kaderrauschen ohnehin verdeckt — jede „Verbesserung" waere nicht belegbar. Was hier fehlt, ist eine
**Methodenentscheidung**, und die gehoert Chris, nicht einem Bauagenten:

- **(a) n=48 als Abnahme-Konvention fuer Buehnen-Disziplinen** mit grossem Kaderrauschen. Kostet
  Rechenzeit, aendert keinen Code, macht die Zahl stabiler.
- **(b) Die G1-Kante glaetten** — eine lineare Interpolation zwischen den Stufen statt einer
  Treppe. Aendert die Scorecard-Methodik (und damit rueckwirkend mehrere Zeilen), aber beendet die
  Klasse „Zeile faellt um 5 Punkte, weil eine Messung um 0,007 wackelt" fuer immer.
- **(c) Nichts tun.** Gewichtheben steht mit 97,50 % als bestfertige Disziplin des Projekts an
  Platz 1 — unter der Gesamt-Lesart, um die Chris gefragt hat, ist hier nichts offen.

### 3.2 Fechten: K4 hängt an einem Werkzeug, das es im Repo nicht gibt

Fechten steht bei Konzept **75** — K1/K2/K3 erfuellt, **K4 offen**. Belegt im Code, nicht aus der
Doku: der Kopfkommentar direkt ueber dem Rezept heisst nach PR #945 **immer noch woertlich**
(`public/mockups/battle-mode.engine.js:12520`):

> „ERSTER, AUSDRUeCKLICH NICHT FINALER Sieben-Rollen-Entwurf aus Fechtens realer Arena-Matrix … Noch
> keine Sinkhorn-Kalibrierrunde (Recherche F.2) — Startpunkt, kein fertiges Ergebnis."

PR #945 hat den Puffer zur 0,80-Schranke von 0,009 auf **0,026** gehoben (rho 0,809 → 0,826, heute
bit-identisch bestaetigt). Das Kaderrauschen betraegt **0,203** — achtmal so viel. Nach dem
strengen Kriterium, das die Scorecard bei Climbing genauso angelegt hat, zaehlt K4 damit nicht.

**Warum das nicht in einer Runde zu schliessen ist.** Das PR-Dokument
(`docs/design/fechten-rezeptkalibrierung-16-09.md`) benennt den naechsten Schritt selbst: eine
echte Sinkhorn-Kalibrierung, *„sobald ein Buehnen-Aequivalent zu `baue-feldspiel-rezept.mjs`
existiert"*. Nachgesehen — **es existiert nicht**:

```
ls scripts/ | grep rezept
baue-feldspiel-rezept.mjs
```

Ein einziger Rezeptbauer, und der kennt nur das Feldspiel-Chassis. Fechten (Buehne) wurde deshalb
per Hand-Gridsuche ueber `sondiere-feldspiel-subskills.mjs` kalibriert — dasselbe Werkzeug, das
Climbing (Bahn) heute benutzt hat. Das ist eine Sonde, kein Optimierer.

**Einschaetzung: mehrere Runden, nicht eine — und der Ertrag liegt nicht bei Fechten.** Fechten
steht mit 91,25 % bereits ueber 90 und braucht K4 nur fuer die strenge Lesart. Der eigentliche Wert
eines `scripts/baue-buehne-rezept.mjs` liegt darin, dass **fuenf** Buehnen-Zeilen davon leben
wuerden (Fechten 75, Tennis 75, I-Spy 55, Wettessen 35, Showcase 25) — das ist ein strategisches
Werkzeug, kein Top-10-Auftrag. Es steht unten als **B4** und ausdruecklich **nicht in Welle 1**.

### 3.3 Basketball und Hockey: die rho-Wand — ausdrücklich nicht wirtschaftlich

| | rho je Spiel | Validitaet (Saison) | G1 | Gameplay |
|---|--:|--:|--:|--:|
| Basketball | 0,769 | 0,923 | 22 | 82 |
| Hockey | 0,669 (Feldspieler 0,719) | 0,832 (0,818) | 12 | 72 |

Beide haben Konzept 100 / Assets 100 / Movement 100. Beide fallen **ausschliesslich** an G1 durch.
Um Gameplay ueber 90 zu bekommen, muesste rho von 0,769 auf ≥0,80 (Basketball, +0,031) bzw. von
0,669 auf ≥0,80 (Hockey, +0,131) — und Hockey braeuchte dafuer **zwei** Stufen.

**Warum das nicht geht, steht in CLAUDE.md und ist nachgemessen, nicht vermutet:**
rho(ein Spiel) = rho(Saison) × √Verlaesslichkeit. Hockeys Validitaet liegt bei 0,832 — die Mechanik
belohnt also weitgehend das Richtige. Was fehlt, ist Verlaesslichkeit, und die haengt an der
Ereigniszahl. **Mehr Ereignisse helfen bei Hockey nachweislich nicht:** verdoppelte Spielzeit hob
die Verlaesslichkeit von 0,755 auf 0,85 und liess rho bei 0,719/0,721/0,723 stehen — flach. Das
Hockeyspiel hat je Minute bereits die **dreizehnfache NHL-Ereignisdichte**.

Dazu kommt die Chris-Ausnahme: beide Zahlen sind ausdruecklich fuer den Live-Betrieb abgenommen,
und CLAUDE.md haelt fest, dass die ehrlichere Abnahme ohnehin nach dem Star und der Paartreue mit
Abstand fragt (Hockey: Star in 78 % der Spiele in den ersten zwei, Paare mit ≥15 Eignungspunkten
Abstand zu 99 % richtig geordnet).

> **Klar gesagt: Basketball und Hockey sind unter der strengen Lesart nicht wirtschaftlich auf
> „alle vier >90" zu heben. Das ist ein akzeptables Ergebnis, kein Versagen des Plans.** Unter der
> Gesamt-Lesart, um die Chris gefragt hat, stehen beide mit 95,5 % und 93,0 % ohnehin drueber.

---

## 4. Ein Fund nebenbei: die CI schützt die G1-Stufe nicht

Waehrend der Pruefung der Basislinie aufgefallen, und er betrifft **alle zehn** Zeilen dieses Plans.

`scripts/pruefe-rangtreue-schranke.mjs` macht die CI rot, wenn rho **relativ** faellt (`:66-67`):

```js
    const rueckgang = basis.spielMedian - z.spielMed; // positiv = gefallen
    const gefallen = rueckgang > basis.schranke;
```

Die Schranke ist `max(0,05 · 0,3 × spielSpannweite)` — also **umso grosszuegiger, je verrauschter
die Disziplin ist.** Aus `data/generated/rangtreue-basislinie.json`:

| Disziplin | Basis | Spannweite | CI-Schranke | darf fallen bis | unter 0,80? |
|---|--:|--:|--:|--:|:--:|
| Fechten | 0,826 | 0,203 | 0,061 | **0,765** | **ja** |
| Gewichtheben | 0,843 | 0,208 | 0,063 | **0,780** | **ja** |
| Tennis | 0,825 | 0,210 | 0,063 | **0,762** | **ja** |
| Climbing | 0,834 | 0,209 | 0,063 | **0,771** | **ja** |
| Time-Trial | 0,825 | 0,082 | 0,050 | 0,775 | **ja** |

**Vier Zeilen der Top 10 koennen unter die 0,80-Abnahmeschranke rutschen, ohne dass die CI ein Wort
sagt.** Fuer Fechten waere das konkret: rho 0,826 → 0,79, G1 von 35 auf 22, Gameplay 90 → 77,
**Gesamt 91,25 → 88** — Fechten faellt still aus der Top 10, und niemand erfaehrt es, bis das
naechste Mal jemand die Scorecard nachzieht.

**Vorschlag B3 (halbe Runde, kein Produktionscode, kein rho-Risiko):** einen zweiten, **absoluten**
Waechter in dasselbe Skript — die CI wird auch dann rot, wenn eine Disziplin, die in der Basislinie
≥0,80 steht, unter 0,80 faellt, **oder** wenn sie eine G1-Stufengrenze (0,85 / 0,80 / 0,70 / 0,50)
nach unten kreuzt. Der relative Waechter bleibt unveraendert daneben stehen; er faengt schleichende
Regression, der neue faengt Stufenbrueche. Das ist die billigste Absicherung des gesamten Plans und
schuetzt nicht nur Time-Trial, sondern alle zwanzig Zeilen.

---

## 5. Der Bauplan

Vorbild fuer Stil und Vorgehen sind die drei heute erfolgreich abgeschlossenen Runden:
`docs/design/fechten-movement-assets-16-09.md`, `docs/design/zeitfahren-movement-assets-16-09.md`,
`docs/design/climbing-kalibrierung-16-09.md`. Jede von ihnen: Vorher/Nachher am Code, rho vorher und
nachher gemessen, Playwright-Beleg, „Nicht Teil dieser PR" am Ende.

### 5.1 B1 — Time-Trial: Requisite + Ton (Assets 55 → 100, Gesamt 85,5 → 96,75)

**Aufwand: eine fokussierte Bauagenten-Runde. Risiko: keins — reine Praesentation.**

#### B1.a — A3: `DISZIPLIN_PROP["time-trial"]`, ein Aero-Helm

**Was gebaut wird:**

1. `ZF_HELM` — eine Ankerpunkt-Tabelle mit vier Eintraegen (Blickrichtung 0..3), exakt nach dem
   Muster von `TAKESHI_HAND` (`:2571-2576`), per Pixelscan an den Kopfpunkt des Standard-Blattes
   ausgemessen. Der `DISZIPLIN_PROP`-Vertrag verlangt **kein** Feld namens `hand` (Kommentar
   `:598-602`: „der Verankerungspunkt selbst kann je Disziplin ein anderer sein") — Eiskunstlauf
   nutzt `fuss`, hier heisst das Feld sinnvollerweise `kopf`.
2. `ZF_HELM_PHASEN` — drei Auspraegungen, die das Feld nutzen, das PR #948 heute schon eingefuehrt
   hat: `u.vizNeigung > 0` (Steigung, Kopf leicht aufgerichtet), `< 0` (Abfahrt, Helm in die
   Aero-Lage gekippt), `≈ 0` (Ebene). Damit zahlt die Requisite auf dasselbe Bild ein wie die
   Koerperhaltung von heute Nachmittag, statt daneben zu stehen.
3. `zeichneAeroHelm(ctx,x,y,s,richtung,phase)` — Schale plus langes Heck, das in Blickrichtung
   zeigt. Aufbau 1:1 nach `zeichneStartnummer()` (`:2593 ff.`): `ctx.save()/translate/rotate`, alle
   Masse in Vielfachen von `s`, Rueckfall auf die Standardphase bei unbekanntem Schluessel.
4. **Aufrufstelle in `zeichneSpurt()`** (`:24712`) — neuer Block direkt neben dem
   Takeshi-Startnummernband (Kommentar ab `:24810`, `if`-Block `:24826-24833`), **innerhalb
   desselben** `ctx.save()/scale()/restore()`-Blocks, damit Position,
   Kamera-Zoom und die M4-Posen automatisch mitvererbt werden:

   ```js
   if(BA().zeitfahren && u.fertig==null){
     const prop=DISZIPLIN_PROP["time-trial"], hp=prop.kopf[parcRicht]||prop.kopf[2];
     const parcZ=groesseFaktor(parcSpriteArg.groesse)*hoehenKorrektur(parcSpriteArg)
       *bauSkala(BAU[u.n]||BAU_STD);
     prop.zeichne(ctx,x-32*parcZ+hp.x*parcZ,y-46*parcZ+hp.y*parcZ,parcZ,parcRicht, …);
   }
   ```

   Die Ankerformel `x-32*Z+cx*Z` / `y-46*Z+cy*Z` ist dieselbe wie bei Hockey/Heben/Takeshi — der
   Review-Fund vom 12.09. (ohne Z-Skalierung driftet die Requisite 5–10 px je Figurgroesse) ist im
   Kommentar an der Takeshi-Stelle festgehalten und gilt hier genauso.

**Warum ein Helm und nicht eine Startnummer:** A3 fragt nach *disziplinrichtiger* Ausruestung. Ein
Startnummernband traegt Takeshi bereits — eine zweite Disziplin mit demselben Prop waere eine
Wiederverwendung, kein eigenes Kriterium. Der Aero-Helm ist das Erkennungszeichen des
Einzelzeitfahrens, und er nutzt `u.vizNeigung` als Phase, was ihn zusaetzlich mit der Mechanik
verbindet.

#### B1.b — A4: `sfx("time-trial", …)` in `stepZeitfahren()`

**Vorbild: `stepStaffel()` (`:24367-24427`)** — die bisher einzige Bahn-Disziplin mit Ton, mit
Modul-Flagge `staffelStartschussAn` (`:24366`) und ausdruecklicher Rueckstellung in `reset()`
(N1-Fix nach dem PR-#879-Muster).

Vier Aufrufstellen in `stepZeitfahren()` (`:24596-24632`), jede an einer **Kante**, nicht an einem
Zustand:

| Ereignis | Ausloeser | Kantenerkennung |
|---|---|---|
| `start` | Block 1: `u.vizRampe` faellt von >0 auf 0 | neues Feld `u.vizStartTon` |
| `bergauf` | Block 4: `zone.art` wechselt auf `"steigung"` | neues Feld `u.vizZone` (haelt die letzte Zonenart) |
| `zwischenzeit` | derselbe Zonenwechsel-Zaehler, an den Zwischenzeit-Marken | `u.vizZwischenTon` |
| `ziel` | `u.fertig != null` zum ersten Mal | `u.vizZielTon` |

**`start` je Fahrer einzeln ist hier richtig und nicht „zu viel Ton":** Time-Trial hat als einzige
Bahn einen gestaffelten Einzelstart (`startAbstand`, nur bei dieser Disziplin gesetzt) — genau das
Bild, das PR #908 mit Startrampe und Countdown gebaut hat. Ein Startsignal je Fahrer ist die
akustische Entsprechung.

**Der Vertrag, woertlich wie bei `stepStaffel`/`stepHuerden`/`stepClimbing`:** geschrieben werden
**ausschliesslich** neue, praesentationale `viz*`-Felder — **niemals** `u.pos`, `u.v`, `u.reserve`,
`u.fertig`, `rennT`, `rennFertig`, `done` — und es faellt **kein** `rr()`-Aufruf an. `sfx()` selbst
ruft nachweislich nie `rr()` (Kommentar `:20324`) und ist ohne AudioContext ein stiller No-Op
(`:15685`, `:27048`). `disziplinProbe()` und `miss-alle-disziplinen.mjs` durchlaufen diese Funktion
mit jedem Frame mit — genau deshalb ist der Vertrag nicht optional.

**`publikum` (Loop) ist ausdruecklich NICHT Teil des Auftrags.** A4 ist binaer; zwei Ereignisse
genuegen, und ein Loop braucht die `tonLoopStart`/`tonLoopStop`-Paarung mit `reset()`-Disziplin
(s. `hockeyPublikumAn`), die zusaetzliches Risiko ohne zusaetzliche Punkte traegt.

#### B1.c — Abnahme

```sh
node scripts/miss-alle-disziplinen.mjs 24 time-trial     # MUSS 0,825 liefern, bit-identisch
node scripts/pruefe-rangtreue-schranke.mjs               # alle zwanzig gruen
node scripts/screenshot-disziplin.mjs time-trial 4000
```

Dazu ein Playwright-Beleg nach dem Muster, das `zeitfahren-movement-assets-16-09.md` Abschnitt
„Visuelle Verifikation" vorgemacht hat: Helm an der Figur sichtbar (Zoom-Ausschnitt), **die anderen
vier Bahnen bit-identisch ohne Helm** (`setDisc('spurt'|'staffel'|'takeshis-castle'|'climbing')`),
und der Tonbeleg ueber die `window.__arena`-Bruecke (`:28612`), die `sfx(disziplin,ereignis,vol)`
von aussen aufrufbar macht.

#### B1.d — Ergebnis

Assets 55 → **100** (A3 +25, A4 +20). Konzept/Gameplay/Movement unberuehrt.
**Time-Trial 85,50 % → 96,75 %.** Damit sind **alle zehn** Top-10-Zeilen ueber 90 %.

### 5.2 B2 — Spurt: Requisite + Ton + Hürdenpose (83,0 → 98,0)

**Aufwand: eine fokussierte Runde. Risiko: keins — reine Praesentation.** Nicht fuer den Auftrag
noetig, aber derselbe Handgriff in derselben Dateiregion, und er hebt die **elfte** Zeile ueber 90.

Spurt steht bei **95 / 55 / 97 / 85**. Drei Teilkriterien fehlen, alle drei billig:

- **A3 (25):** `DISZIPLIN_PROP.spurt` — **Sprint-Spikes am Fuss**, nach dem
  `fuss:FUSS_EISKUNSTLAUF` / `zeichneKufe`-Muster (`:2739`), nicht nach dem Hand-Muster: ein
  Huerdenlaeufer traegt nichts in der Hand. Aufrufstelle wie B1.a.
- **A4 (20):** `sfx("spurt", …)` in `stepHuerden()` (`:24672-24686`). Der Katalog steht seit PR 0.1
  vollstaendig (`:20511-20517`: `startschuss`, `huerde`, `riss`, `ziel`, `publikum`). Vier Kanten,
  alle aus Feldern, die `stepHuerden()` schon liest: `startschuss` einmal je Rennen ueber eine
  Modul-Flagge (`spurtStartschussAn`, mit `reset()`-Rueckstellung wie `staffelStartschussAn`),
  `huerde` an der Kante `u.huerde > 0`, `riss` an der Kante `u.leer`, `ziel` an `u.fertig != null`.
- **M4 (15):** eine echte **Huerdenflug-Pose**. `stepHuerden()` schreibt heute nur `vizSchritt` und
  `vizErschoepft` — waehrend `u.huerde > 0` treten die Beine still, aber die Figur springt nicht.
  Neu: `u.vizHuerde` (0..1, weich nachgezogen aus `u.huerde`, dieselbe `1-Math.exp(-dt/…)`-Glaettung
  wie `vizErschoepft` direkt darueber), gelesen in `zeichneSpurt()` als Sprunghoehe plus
  Beinstreckung — **exakt nach dem `zfTilt`/`zfHaltung`-Muster** (`:24804-24806`), das PR #948
  heute fuer Zeitfahren vorgemacht hat, inklusive der Gattung auf `BA().spurt`, damit jede andere
  Bahn bit-identisch bleibt.

**Abnahme:** `node scripts/miss-alle-disziplinen.mjs 24 spurt` muss **0,894** bit-identisch
liefern. Ergebnis: Assets 55 → 100, Movement 85 → 100, **Spurt 83,0 % → 98,0 %.**

### 5.3 B3 — Stufenwächter in `pruefe-rangtreue-schranke.mjs`

**Aufwand: halbe Runde. Risiko: keins** (das Skript ist eine Sonde, kein Produktionscode; es
aendert nichts am Spiel). Inhalt: der absolute Waechter aus Abschnitt 4. Zusaetzlich sollte der
Bericht des Skripts die G1-Stufe je Zeile ausgeben (≥0,85 / 0,80–0,85 / …), damit ein Stufenbruch
schon im Log sichtbar ist und nicht erst in der naechsten Scorecard-Runde.

### 5.4 B4 — `scripts/baue-buehne-rezept.mjs` (strategisch, NICHT Welle 1)

Das Buehnen-Aequivalent zu `baue-feldspiel-rezept.mjs`, das `fechten-rezeptkalibrierung-16-09.md`
als fehlendes Werkzeug benennt. **Mehrere Runden, Rezeptaenderungen, jede braucht Messung.** Der
Ertrag liegt nicht in der Top 10 (Fechten ist mit 91,25 % schon drueber), sondern in den fuenf
Buehnen-Zeilen, deren K4 heute strukturell unerreichbar ist. Gehoert in einen eigenen Plan, nicht
in diesen.

### 5.5 Der gemeinsame Abnahme-Pflichtteil für B1 und B2

Beide sind **reine Praesentations-PRs**. Der Nachweis dafuer ist nicht „wir haben nichts
Gefaehrliches angefasst", sondern:

1. **rho bit-identisch**, vorher und nachher gemessen, im PR-Dokument abgedruckt (`24` Spiele,
   kaderfest, Median ueber fuenf echte Team-Paarungen).
2. **Die uebrigen neunzehn Zeilen bit-identisch** — `node scripts/pruefe-rangtreue-schranke.mjs`
   laeuft ueber alle zwanzig und muss durchgaengig gruen sein. Das faengt insbesondere den Fall,
   dass eine Aenderung an `zeichneSpurt()` oder `DISZIPLIN_PROP` versehentlich eine andere Bahn
   trifft.
3. **Der viz-Vertrag explizit im Kommentar**, woertlich nach dem Muster von `stepStaffel` /
   `stepHuerden` / `stepZeitfahren` — welche Felder geschrieben werden, welche nur gelesen, und dass
   kein `rr()` faellt.
4. **Playwright-Beleg mit Gegenprobe**: die Ziel-Disziplin zeigt das Neue, die anderen vier Bahnen
   zeigen nachweislich keine Spur davon.
5. **Ein eigenes `docs/design/<disziplin>-<thema>-16-09.md`** im Stil der drei heutigen Dokumente,
   mit einem ehrlichen Abschnitt „Nicht Teil dieser PR".

---

## 6. Reihenfolge, Aufteilung, Kollisionsmatrix

### 6.1 Das Problem, unverändert seit dem 10.09.: `battle-mode.engine.js` ist EINE Datei

29 000 Zeilen, und B1 und B2 fassen **dieselben drei Stellen** an:

| Stelle | B1 (Time-Trial) | B2 (Spurt) | Kollision |
|---|:--:|:--:|:--:|
| `DISZIPLIN_PROP` (`:2730-2741`) | neuer Eintrag | neuer Eintrag | **JA — dieselbe Tabelle, benachbarte Zeilen** |
| Prop-Zeichenfunktionen (`:2571-2620` Umfeld) | `ZF_HELM` + `zeichneAeroHelm` | `SPURT_FUSS` + `zeichneSpikes` | **JA — dieselbe Region** |
| `zeichneSpurt()` Prop-Block (`:24826-24833`) | neuer `BA().zeitfahren`-Block | neuer `BA().spurt`-Block | **JA — direkt benachbart** |
| `stepZeitfahren()` (`:24596`) | Ton-Kanten | — | nein |
| `stepHuerden()` (`:24672`) | — | Ton-Kanten + `vizHuerde` | nein |
| `TON_KATALOG` (`:20453 ff.`) | — | — | nein (beide Kataloge stehen schon) |

> **B1 und B2 duerfen NICHT parallel in getrennten Worktrees laufen.** Drei von sechs Beruehrungs-
> punkten liegen in denselben oder unmittelbar benachbarten Zeilen. Zwei parallele Agenten wuerden
> in `DISZIPLIN_PROP` und im `zeichneSpurt()`-Prop-Block sicher kollidieren, und ein
> Merge-Konflikt an einer Ankerpunkt-Tabelle ist die unangenehmste Sorte: er sieht harmlos aus und
> verschiebt Requisiten um Pixel.

**Zwei gangbare Wege, in dieser Reihenfolge empfohlen:**

- **(A) Ein Agent, zwei Commits, ein PR** („Bahn-Requisiten und Bahn-Ton: Time-Trial + Spurt").
  Schneller, ein Review, eine rho-Messung ueber beide. **Empfohlen**, weil der gemeinsame Teil
  (`DISZIPLIN_PROP`-Eintrag, Aufrufblock-Muster) ohnehin zweimal derselbe Handgriff ist.
- **(B) Strikt sequenziell**, B1 zuerst, B2 erst nach dem Merge von B1 auf `main`. Naeher an der
  Projektgewohnheit „ein PR je Disziplin", kostet aber eine volle Merge-Wartezeit.

### 6.2 Was parallel laufen KANN

| Auftrag | Dateien | Kollision mit B1/B2 |
|---|---|:--:|
| **B3** (Stufenwaechter) | `scripts/pruefe-rangtreue-schranke.mjs` | **keine** — eigene Datei, kein Motor-Code |
| **B4** (Buehnen-Rezeptbauer) | neue Datei `scripts/baue-buehne-rezept.mjs` | **keine** — neue Datei |
| Scorecard-Nachzug | `docs/design/gesamtstand-…-09-10.md` | **muss danach**, nicht parallel |

**B3 laeuft ab sofort parallel in einem eigenen Worktree.** Es ist der einzige Auftrag dieses
Plans, der ohne jede Abhaengigkeit sofort starten kann, und der einzige, der die bereits erreichten
neun Zeilen aktiv schuetzt statt eine zehnte zu bauen.

**Der Scorecard-Nachzug ist sequenziell und gehoert in einen eigenen PR** — genau so, wie #947 und
#949 es heute fuer Fechten bzw. Time-Trial/Climbing gemacht haben. Er darf erst laufen, wenn B1
(und ggf. B2) auf `main` stehen, und muss rho fuer die betroffenen Zeilen **frisch** messen statt
sie aus den PR-Texten zu uebernehmen.

### 6.3 Die Wellen

**Welle 1 — das Ziel (heute/morgen)**

| | Auftrag | Agent | laeuft |
|---|---|---|---|
| 1 | **B1** Time-Trial Requisite + Ton | Bauagent 1 | sofort |
| 1 | **B3** Stufenwaechter | Bauagent 2 | **parallel**, eigener Worktree |
| 2 | **B2** Spurt Requisite + Ton + Huerdenpose | Bauagent 1 (derselbe) | nach/mit B1 |
| 3 | Scorecard-Nachzug (Zeilen 10 und 11) | Bauagent 3 | nach Merge von B1/B2 |

Ergebnis nach Welle 1: **die obersten ELF Zeilen liegen ueber 90 %.** Projektdurchschnitt 76 % →
**78 %** (Time-Trial +11,25, Spurt +15,00, verteilt auf zwanzig Zeilen: +1,31).

**Welle 2 — die strenge Lesart, nur wenn Chris sie meint**

| | Auftrag | Einschaetzung |
|---|---|---|
| 1 | Methodenentscheidung Gewichtheben (n=48 / Kantenglaettung / nichts) | **Chris-Entscheidung**, keine Bauaufgabe |
| 2 | **B4** `baue-buehne-rezept.mjs`, danach Fechten K4 | mehrere Runden, Messung noetig |
| — | Basketball / Hockey | **nicht wirtschaftlich**, s. 3.3 |

**Welle 3 — der Rand der Top 10 (ausserhalb dieses Auftrags)**
Football 75,5 (haengt an rho, PR #944 kommt mit 0,796 nicht ueber die Schranke), Tennis 71,25
(Movement 50 — dieselbe Art Runde wie B1/B2, aber Buehne statt Bahn, kollisionsfrei zu B1/B2),
Climbing 65,5 (Assets 40, Konzept 65).

### 6.4 Was ausdrücklich NICHT in diesen Plan gehört

- **Jede Rezeptaenderung an einer Top-10-Disziplin.** Neun von zehn Zeilen sind fertig; das
  groesste Risiko dieses Plans ist nicht, dass eine Zeile nicht steigt, sondern dass eine faellt.
  B1/B2 fassen aus genau diesem Grund kein `rezept`, kein `wert()`, keine Rennlogik an.
- **Footballs Produktivschaltung.** #944 ist offen, Draft, und bleibt laut eigenem Titel unter der
  Schranke. Nichts daran gehoert in eine Top-10-Runde.
- **Der Publikums-Loop** bei Time-Trial und Spurt (s. B1.b) — Risiko ohne Punkte.
- **Eine Neubewertung der Scorecard-Methodik im selben PR wie ein Bauauftrag.** Wenn die
  G1-Kantenglaettung kommt (3.1 Option b), dann als eigener, klar benannter Methodik-PR.

---

## 7. Ehrliche Einschätzung — was wirklich kommt

**Sicher: die zehnte Zeile.** B1 ist der billigste Auftrag, den dieses Projekt seit Wochen hatte:
beide fehlenden Teilkriterien haben ein fertiges Vorbild im selben File (Takeshis Startnummernband
fuer die Requisite, Staffels Ton fuer die vier `sfx`-Kanten), der Ton-Katalog steht seit vier Tagen
ungenutzt bereit, und die Requisiten-Tabelle nimmt einen neunten Eintrag ohne strukturelle
Aenderung auf. Das Risiko liegt nicht bei rho — es liegt bei der Handwerksqualitaet der Ankerpunkte
(der 12.09.-Fund „ohne Z-Skalierung driftet die Requisite 5–10 px" und der 14.09.-Fund „5 von 17
Figuren hatten gar keine Hantel" sind die zwei Fallen, die dieser Bauauftrag kennen muss).

**Sehr wahrscheinlich: die elfte.** B2 ist derselbe Handgriff mit einer zusaetzlichen Pose. Der
einzige Grund, warum er nicht ebenso sicher ist wie B1: die Huerdenpose (M4) ist die einzige
Stelle in beiden Auftraegen, an der etwas **aussehen** muss und nicht nur **da sein** muss — und
die Erfahrung von heute Nachmittag ist, dass so etwas bei 32-px-Sprites subtiler ausfaellt als
erwartet (`zeitfahren-movement-assets-16-09.md`: *„der Lehnwinkel ist bei 32-px-Sprites ein feines
Detail, kein Blickfang"*). Falls die Pose nicht ueberzeugt, traegt B2 die Zeile ueber A3+A4 immer
noch auf 94,25 % — auch dann ueber 90.

**Unsicher und deshalb nicht versprochen: die strenge Lesart.** Fuenf Zeilen, davon zwei
(Basketball/Hockey) nach heutigem Wissen gar nicht, eine (Gewichtheben) nur ueber eine
Methodenentscheidung, und eine (Fechten) erst nach einem Werkzeug, das noch nicht existiert. Wer
„alle vier Achsen ueber 90 fuer die Top 10" verspricht, verspricht mindestens drei Wellen und eine
gelungene Rangtreue-Forschungsrunde an Hockey, die es in diesem Projekt seit Monaten nicht gegeben
hat.

**Die Antwort auf Chris' Frage, in einem Satz:** Neun der Top 10 sind schon ueber 90 % — die zehnte
(Time-Trial) fehlt an einem Helm und vier Tonaufrufen, das ist **eine Runde ohne rho-Risiko**, und
mit einer zweiten gleichartigen Runde (Spurt) liegen gleich **elf** Zeilen drueber.

---

## 8. Grenzen dieses Plans

1. **Die vier Achsenzahlen sind Einstufungen, keine Messungen.** Nur rho ist gemessen. Assets und
   Movement sind aus gelesenem Zeichencode eingestuft — die Scorecard selbst haelt in Abschnitt 3.4
   fest, dass gelesener Zeichencode dort schon zweimal etwas anderes behauptet hat als das
   tatsaechliche Bild. Der Playwright-Beleg im Abnahmeteil (5.5, Punkt 4) ist genau dagegen da.
2. **Ob ein Aero-Helm bei 32 px als Aero-Helm lesbar ist, ist eine offene Frage.** Sie laesst sich
   nicht am Code beantworten, sondern nur am Screenshot. Sollte sie mit „nein" ausgehen, ist die
   Alternative eine groessere, kontrastreichere Requisite (eine Trinkflasche am Rahmen, eine
   Zeitfahr-Rueckennummer in eigener Farbe) — A3 verlangt „disziplinrichtig", nicht „fotorealistisch".
3. **Die Gesamt-Lesart ist eine Entscheidung, keine Ableitung.** Chris' Satz „über 90%" laesst beide
   Lesarten zu. Dieser Plan waehlt die Gesamt-Spalte, weil sie die Spalte ist, die in der Scorecard
   „Gesamt" heisst — und beantwortet die strenge Lesart in Abschnitt 3 trotzdem vollstaendig, damit
   die Wahl revidierbar ist, ohne dass jemand nochmal von vorn recherchieren muss.
4. **Der CI-Fund (Abschnitt 4) ist nicht empirisch belegt, sondern aus dem Schwellenwert
   hergeleitet.** Es ist bisher nicht passiert, dass eine Zeile still unter 0,80 gerutscht ist —
   die Rechnung zeigt nur, dass es passieren **koennte**, und zwar bei vier der zehn Zeilen.
5. **Kein Blick auf Chris' In-Game-Meldungen.** Dieser Plan ist eine Fertigstellungsgrad-Review, kein
   Bug-Triage. Vor der naechsten Runde gehoert `git fetch origin bug-reports` trotzdem gelesen
   (CLAUDE.md, „Vor jeder Runde einmal lesen") — was dort steht, kann die Reihenfolge dieses Plans
   jederzeit schlagen.
