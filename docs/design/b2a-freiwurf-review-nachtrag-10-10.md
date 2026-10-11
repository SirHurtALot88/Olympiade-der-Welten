# B2a (Spirit-Freiwurf) — unabhaengiger Review nach dem Merge (10.10.)

**Gegenstand:** Basketball B2a aus `docs/design/fable-ideen-feldspiel-30-09.md` §3 B2, gebaut am
07.10., inzwischen per Squash `52bd6c1` (PR #1164) in `main`. Der Review lief in zwei Runden:
eine am 07.10. gegen den damaligen Branch-Stand (`00c5279`), eine am 10.10. gegen den gemergten
Endstand. Zwischen beiden hat die Nachbesserung `f9cc9f9` die **Mechanik geaendert**
(`FREIWURF_KANAL` 50/30/20 → spirit 48 / intelligence 35 / dexterity 17), weshalb alle Zahlen
unten am Endstand neu gemessen sind und die der ersten Runde nicht mehr gelten.

Dieses Dokument ist **retrospektiv**: die Merge-Entscheidung ist gefallen. Es haelt fest, was
geprueft ist, welche Zahl die Abnahme traegt, und welche zwei Punkte offen bleiben.

## 1. Was geprueft und sauber ist

- **Determinismus.** Genau EIN `rr()` je Freiwurf, wie vorher. `mische()` ist rein. Im neuen
  Code kein `rr()`. Darueber hinaus gilt mehr als der Kommentar bei `verbucheFreiwurf`
  behauptet und was ihn stuetzt: `beendeFreiwuerfe()` ruft `naechsterAngriff(1-schuetze.side)`
  **ergebnisunabhaengig**, der Treffer verzweigt den Ballbesitz also nicht. Die einzige
  Zustandsaenderung ist der Spielstand. Das erklaert, warum rho sich auf drei Stellen nicht
  bewegt (s. Abschnitt 2).
- **Isolation.** `ftWert` wird nur in `bauFeldspiel` und nur fuer Basketball gerechnet;
  `verbucheFreiwurf` ist nur aus Basketball erreichbar (`foulChance=0` bei `istHockey()`,
  Football laeuft nie durch `wirf()`). Die uebrigen 17 Disziplinen fahren andere Chassis
  (`bauBuehne`/`bauSpurt`/`baueEinheit`), in denen `ftWert` nicht vorkommt. Gemessen: Hockey
  und Football zeichengleich.
- **Kein Durchsickern des neuen Feldes.** Nirgends wird ueber die Eigenschaften eines
  Spielerobjekts iteriert (`for..in`, `Object.keys/entries`), der neue Schluessel kann also
  keine andere Rechnung beruehren. `BASKETBALL_POS_MOD` fasst nur AUFBAU/SCHUSS_*/ZWEITCHANCE/
  ABWEHR an, nie etwas Freiwurf-Relevantes — dass `ftWert` ihn nicht bekommt, ist konsistent.
- **Rand und Clamp.** Band verifiziert: 0 → 55 %, 150 → 92 %, monoton; Ankerpunkte im
  Kommentar stimmen (50 → 72,0 / 72 → 84,1 / 20 → 55,5 / Deckel ab ~87).
- **Haken seiteneffektfrei.** `freiwurfKanal()` gibt eine Kopie des Kanals, `chance`/
  `chanceOhneKanal` sind rein, kein `rr()`, kein Zustand.
- **Gewichte matrixtreu.** 48/35/17 ist die gesperrte Basketball-Matrix (spirit 22 /
  intelligence 16 / dexterity 8, Summe 46) auf diese drei normiert: 47,8/34,8/17,4. Die Sonde
  prueft das mit ±1.
- **Rueckfall.** Ohne `ftWert` liefert `freiwurfChance` zeichengleich die alte ABSCHLUSS-Kurve,
  nicht die spirit-geeichte Gerade. Von der Sonde geprueft.
- **Werkzeuge.** `eslint` 0 Fehler in den geaenderten Zeilen, `fahre-quelltext-waechter.ts`
  2043/2043 bestanden.

## 2. Gemessen — echte Merge-Basis `bc05b50` gegen `52bd6c1`

Nicht Branch-gegen-`main` gemessen: der Branch stand auf dem alten `main`, das haette B2a mit
fuenf fremden Commits vermischt. Gemessen ist der Commit **vor** B2a gegen B2a selbst.

| Messung | vor B2a (`bc05b50`) | nach B2a (`52bd6c1`) |
|---|---:|---:|
| basketball rho je Spiel (Median, Kader-Familie live-save, n=24) | 0,795 (Sp. 0,083) | 0,795 (Sp. 0,085) |
| basketball rho Saison | 0,881 (Sp. 0,140) | 0,881 (Sp. 0,140) |
| hockey, football | — | **zeichengleich** |
| Pp-Abweichung, Saatstrom 1 / 2 (`messe-arena-einfluss.mjs basketball`) | 43,6 / 43,7 | **43,0 / 44,7** |
| spirit-Anteil, Saatstrom 1 / 2 (Schranke ≤ 22 %) | 19,6 % / 18,1 % | **19,7 % / 18,2 %** |

**Einschraenkung zur Pp-Zahl:** gemessen mit `n=12`, nicht mit den `n=48` der Abnahme — ein
`n=48`-Lauf braucht auf der Review-Maschine ~57 min, vier davon passen in kein Zeitfenster
dieser Sitzung. Es ist ein GEPAARTER Vergleich auf identischen Saaten, der Unterschied traegt
also; die Absolutwerte sind grob. Beide Schluesse haben Luft: spirit liegt ~3 Pp unter seiner
Schranke, die Pp-Abweichung ~18 Pp darueber.

### 2.1 Die Freiwurfkurve am echten Kader (620 Versuche, 5 Kader x 40 Spiele)

Beide Formeln auf dieselben Versuche gerechnet, geschnitten nach Chris' Buckets vom 26.08.:

| | alt (ABSCHLUSS) | neu (ftWert) |
|---|---:|---:|
| AVG (ABSCHLUSS < 60, n=449) | 71,9 % | 70,2 % (−1,7 Pp) |
| gut (60–84, n=171) | 75,4 % | 83,9 % (**+8,5 Pp**) |
| alle | 72,9 % | 74,0 % (+1,1 Pp) |
| Spreizung schwaechster ↔ staerkster | 10,1 Pp | **32,1 Pp** (59,9–92,0 %) |

Der Boden 55 % klemmt bei **0 von 620** Versuchen, der Deckel 92 % bei **48 von 620 (7,7 %)**.
`ftWert` streut deutlich breiter als ABSCHLUSS (28–98 gegen 36–74), was der Sinn des Kanals ist.

## 3. Was die Nachbesserung behoben hat

Die Runde vom 07.10. fand sieben Punkte; `f9cc9f9` hat sie eingearbeitet. Festgehalten, weil die
Begruendungen sonst nur im Branch-Verlauf stehen:

| | Fund | Stand |
|---|---|---|
| F1 | Rueckfall ohne `ftWert` haette die neue Gerade auf die ABSCHLUSS-Skala angewandt — eine andere Verteilung, also stille Fehlkalibrierung statt lautem Fehler | behoben |
| F2 | 50/30/20 stellte dexterity (Matrix 8) vor intelligence (Matrix 16) und drehte damit die gesperrte Matrix um | behoben |
| F3 | Die Eichung war als abgenommen dokumentiert, obwohl sie an ~2 Freiwuerfen je Spiel haengt und das Dokument sie fuer die P1-Runde vorsieht | behoben |
| F4/F7 | ueberfluessiges `Math.round` um `mische()` (das selbst rundet und auf 1..99 klemmt); Ankerzahlen im Kommentar | behoben |
| F5 | Pruefung (d) hatte ±13,2 Pp Toleranz bei n=85 und konnte eine Fehlkalibrierung nicht entdecken | behoben: neue `d2` mit zwei Kunstkadern, gleicher ABSCHLUSS, gespiegeltem Kanal — alte Formel saehe 72,4 % gegen 72,2 %, neue trennt um 23,0 Pp |

**F2 hat der erste Review-Durchgang NICHT gefunden** — er pruefte die Mischung gegen das
Quelldokument (das die drei Attribute nennt, aber keine Gewichte) und nicht gegen die Matrix.
Das ist der Fund mit der groessten inhaltlichen Wirkung in dieser Runde.

## 4. Offen: eine Behauptung im Quelltext, die nicht belegt ist

`public/mockups/battle-mode.engine.js:11295–11297` sagt in `main`:

> `spirit-SCHRANKE (Dokument: "die Freiwurf-Formel darf spirit nicht ueber 22 treiben"):`
> `nachgemessen mit messe-arena-einfluss.mjs basketball 48 in zwei Saatstroemen, s.`
> `scripts/verify-basketball-freiwurf-paket-07-10.mjs und die PR-Beschreibung.`

Beide Belegstellen tragen die Zahl nicht: `verify-basketball-freiwurf-paket-07-10.mjs` enthaelt
keine Pp- oder Einfluss-Messung (nur Trefferquoten-Pp), und die Tabelle in PR #1164 fuehrt
„Pp-Abweichung" und „spirit-Anteil" bis heute als `_laeuft_`. Die Pflichtpruefung aus CLAUDE.md
(„Pp-Abweichung ≤ 25, zwei unabhaengige Saatstaemme … genauso verbindlich wie die
rho-ueber-0,80-Schranke") ist an dieser Mechanik also **uebersprungen und als erledigt
dokumentiert** worden.

Die Zahl steht jetzt in Abschnitt 2: **die Schranke haelt** (spirit 19,7 % / 18,2 %, beide unter
22). Der Satz im Quelltext bleibt trotzdem falsch, solange er `n=48` und zwei Stroeme behauptet
und auf Stellen zeigt, die nichts davon enthalten. Zwei Wege, einer genuegt:

1. Den Verweis auf dieses Dokument umbiegen und `n=12` nennen, statt `n=48` zu behaupten.
2. Den `n=48`-Lauf nachholen und die Zahl dort eintragen.

Dieser Review durfte ausdruecklich **keinen Code anfassen** (Doku-Mandat), deshalb steht der
Punkt hier statt als Patch.

## 5. Zwei Einordnungen fuer Chris — keine Fehler, sondern Entscheidungen

**B2a erreicht sein erklaertes Motiv nicht.** Das Quelldokument begruendet den Kanal damit, dass
„spirit Basketballs schwerstes Matrixattribut (22) und untergewichtet" sei. Gemessen ist spirit
nach B2a weiterhin **unter** seinem Matrixgewicht (19,7 % / 18,2 % gegen 22), und der Kanal
bewegt es um **+0,1 Pp in beiden Stroemen**. rho bewegt sich um 0,000. Bei 2,1 Freiwuerfen je
Spiel statt der vom Dokument angenommenen ~20 ist das strukturell unvermeidlich — die Wirkung
kommt erst mit dem Foulsystem P1, was der Branch in seiner „ehrlichen Einordnung" selbst sagt.
Der heutige Wert von B2a ist qualitativ: der Freiwurf liest die richtigen Attribute, in der
richtigen Matrix-Reihenfolge. Das ist fuer die „Matrixgewichte durchreichen"-Vorgabe etwas wert,
auch ohne Zahlenbewegung.

**Die Freiwurfkurve verschiebt eine bewusst gesetzte Kalibrierung.** Am 26.08. hat Chris
entschieden: „Freiwuerfe kannst du den guten noch mal um 5% verbessern, den AVG kannst du
lassen." Die alte Formel setzte das mit einem KNICK bei 60 um und hielt den AVG-Bucket
absichtlich flach. Die neue Gerade haelt den AVG (−1,7 Pp, also „gelassen"), hebt die Guten aber
um **+8,5 Pp** ueber ihr damals geeichtes Niveau und verdreifacht die Spreizung (10,1 → 32,1 Pp).
Der Deckel liegt jetzt bei 92 % und greift bei 7,7 % der Versuche — der alte Kommentar hatte
90 % ausdruecklich als Realismus-Obergrenze gesetzt („Career-Elite ~90 % nur bei den
allerbesten Schuetzen"). Die breitere Spreizung IST der Zweck von B2a und steht so im Dokument
(„≈ 55–92 %"); dass sie Chris' 26.08.-Eichung fuer die Guten ueberschreibt, sollte er aber
wissen und nicht aus einer Tabelle rekonstruieren muessen.

## 6. Vorbestand, nicht von B2a verursacht

**Basketball reisst die Pp-Schranke deutlich** — 43,6 / 43,7 **vor** B2a, 43,0 / 44,7 danach,
gegen eine Schranke von ≤ 25. B2a bewegt das innerhalb des Strom-Rauschens (−0,6 / +1,0) und ist
nicht die Ursache. Die Treiber sind andere: speed traegt 17–20 % bei Matrixgewicht 10 (+7,3 bis
+9,9) und torment 9–13 % bei Gewicht 6 (+3,6 bis +7,4), waehrend awareness (−6,0 bis −7,0) und
charisma (−5,4 bis −6,0) zu wenig tragen. Das ist eine eigene Messrunde wert und gehoert nicht
in ein Freiwurf-Paket.

## 7. Restpunkte, bewusst nicht als Fehler gefuehrt

- **Lange TDZ-Strecke.** `ftWert` (Zeile 7989) liest `FREIWURF_KANAL`, ein `const`, das ~3300
  Zeilen spaeter (11298) im selben IIFE deklariert wird, und bei 4720 liegt ein `await` davor.
  Kein `bauFeldspiel`-Aufrufer ist waehrend dieser Unterbrechung erreichbar (alle Aufrufstellen
  haengen an `window.__arena`, das erst danach gesetzt wird), und es tritt empirisch kein
  `pageerror` auf. Ein kuenftiger frueher Aufrufer bekaeme aber einen `ReferenceError`.
- **Beobachtete Quote ueber der Formel.** Die Sonde meldet 85,9 % beobachtet gegen 78,1 %
  Formel (n=85, innerhalb der 3-Sigma-Toleranz von ±13,0 Pp, also ~1,8 Sigma — nicht
  signifikant). Mit den alten Gewichten war der Abstand +2,8 Pp, jetzt +7,8 Pp. Die Richtung ist
  konsistent und koennte Auswahl sein (wer Fouls zieht, ist nicht der Durchschnittsschuetze).
  Mit den ~20 Freiwuerfen aus P1 wird das pruefbar; vorher ist n zu klein.

## 8. Wie nachgemessen wurde

```sh
node scripts/miss-alle-disziplinen.mjs 24 basketball hockey football
node scripts/messe-arena-einfluss.mjs basketball 12
node scripts/messe-arena-einfluss.mjs basketball 12 --saat-versatz=10000000
node scripts/verify-basketball-freiwurf-paket-07-10.mjs
```

Je einmal auf `bc05b50` und auf `52bd6c1`, Kader-Quelle
`data/generated/kaderfamilie-live-save.json` (zwischen beiden Staenden unveraendert, die Zahlen
sind also vergleichbar). Die Kurvenvergleiche in 2.1 stammen aus einer eigenen Review-Sonde, die
jeden Freiwurf-Versuch mit `ftWert` UND `ABSCHLUSS` sammelt und beide Formeln darauf rechnet;
sie ist nicht eingecheckt, weil `d2` in der Branch-Sonde dieselbe Frage dauerhaft abdeckt.
