# Climbing — Nulllinie und Wand-Sonde (PR 0, 24.09.)

Dieses Dokument ist die Nulllinie, die `docs/design/climbing-neukonzept-22-09.md` Abschnitt
6.4 Schritt 1 und `docs/design/climbing-opus-gegencheck-24-09.md` Abschnitt 5 (Zeile "PR 0") für
PR 0 verlangen: eine Mess-Sonde plus die Zahlen, gegen die PR 2 (Griffarten, Zonen, Abrutschen,
Zeitlimit) später gemessen wird. **Kein Messwert bewegt sich in dieser PR** — PR 0 und PR 1 (Wand-Darstellung) sind beide
rho-neutral, s. die PR-Beschreibung von `climbing-pr01-wand-24-09` für den Beleg (bit-identisch
gegen die Basislinie 0,834/0,860 und gegen die vier Geschwister-Bahnen Spurt/Staffel/
Time-Trial/Takeshi's Castle).

## 1. Die Sonde: `window.__arena.wandProbe(opt)`

Rein lesende Diagnose-Sonde nach demselben Prinzip wie `showcaseActProbe`/`ispyNachfuellSonde`
(`public/mockups/battle-mode.engine.js`, im `window.__arena`-Objekt neben `disziplinProbe`):
kein Gameplay, kein zusätzlicher `rr()`-Verbrauch — sie fährt `MOTOREN.climbing.bau()`/`lauf()`
genau wie `disziplinProbe()` und liest danach nur `LAEUFER`.

```js
window.__arena.wandProbe({ n: 48 })
```

Optionen: `n` (Rennen, Default 48), `saat0`/`schritt` (wie `disziplinProbe`), `k` (die Liste der
Zeitlimit-Faktoren für die Top-out-Tabelle, Default `[1.10,1.15,1.20,1.25,1.30,1.40,1.60]`).
Läuft mit dem **hardcodierten Standardkader** (SQUAD/OPP), nicht mit der Kader-Familie aus
`data/generated/kaderfamilie-live-save.json` — für die kaderfeste rho-Abnahme bleiben
`scripts/miss-alle-disziplinen.mjs`/`scripts/miss-star-paartreue.mjs` die maßgeblichen
Werkzeuge; `wandProbe()` ist die leichte Sonde für Timing/Zeitlimit-Fragen, kein Ersatz dafür.

Rückgabe (Beispiel, n=48, Standardkader, 24.09.):

```json
{
  "disziplin": "climbing", "spiele": 48,
  "siegerzeitMedianSimS": 10.31, "siegerzeitSpanneSimS": [9.67, 11.08],
  "zeitZuSiegerMedian": 1.307, "zeitZuSieger90": 1.508,
  "langsamsterZuSiegerMedian": 1.546, "langsamsterZuSiegerMax": 1.653,
  "stolpererJeKopf": 1.0, "kraftzuegeJeKopf": 3.78, "reserveAmEndeMedian": 34.1,
  "topoutQuoteJeK": {"1.1":10.1,"1.15":13.2,"1.2":20.7,"1.25":34.2,"1.3":53.6,"1.4":79.7,"1.6":99.3}
}
```

Die Größenordnung deckt sich mit der kaderfesten Messung im Gegencheck (Abschnitt 2, unten
übernommen): Top-out bei k=1,6 liegt bei beiden Messungen um 99 % — der genaue Wert bei
mittleren k (z. B. 1,2) weicht ab, weil der Gegencheck über die **Fünfer-Kader-Familie**
gemittelt hat und `wandProbe()` hier mit dem **einzelnen Standardkader** lief (andere
Eignungsverteilung, andere Reserve-/Tempo-Streuung). Für eine kaderfeste Eichung des
Zeitlimits in PR 2 ist deshalb die Kader-Familie die maßgebliche Quelle, nicht `wandProbe()`
allein.

## 2. Die Nulllinie aus dem Gegencheck (übernommen, nicht neu gemessen)

Die folgenden zwei Tabellen sind aus `docs/design/climbing-opus-gegencheck-24-09.md` Abschnitt 2.1/2.2
übernommen — kaderfest, 24 Spiele je Paarung, fünf Paarungen (120 Rennen), Saatstamm 1337, Motor
`origin/main` `68ad8c48`, vor jeder Mechanikänderung.

### 2.1 Wie weit die Zielzeiten heute auseinanderliegen

| Größe | Wert |
|---|---:|
| Median-Siegerzeit | 10,08 Sim-s (Spanne 8,50–11,02) |
| Zeit ÷ Siegerzeit, alle Nicht-Sieger, Median | 1,247 |
| … 90-%-Punkt | 1,441 |
| Langsamster ÷ Sieger je Rennen, Median / Maximum | 1,449 / 1,675 |
| Stolperer je Kopf / Kraftzüge je Kopf | 1,32 / 2,88 |

Top-out-Quote bei einem **festen** Limit von k × Median-Siegerzeit:

| k | 1,10 | 1,15 | 1,20 | 1,25 | 1,30 | 1,40 | 1,60 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Top-out | 19,2 % | 30,1 % | 44,0 % | 57,8 % | 70,7 % | 88,2 % | 99,4 % |

**Befund (Gegencheck 2.1/3.5, verbindlich für PR 2):** das Konzeptlimit 1,6× wäre auf der
heutigen Mechanik wirkungslos (99,4 % Top-out — dann entscheidet die Uhr, nicht die Höhe, genau
das Speed-Bild, das Chris nicht will). Der Gegencheck eicht stattdessen auf eine **Top-out-Quote
von 40–55 %** (auf der heutigen Mechanik ≈ 1,2×); nach PR 2 (Griffarten, Abrutschen) verschiebt
sich die Zeitverteilung, das Limit wird dann am **Korridor**, nicht am Faktor, neu geeicht.

### 2.2 Zeitlimit mit Höhenwertung, auf der heutigen Mechanik

| Limit | rho je Spiel | Spannweite | rho Saison | Top-out |
|---|---:|---:|---:|---:|
| ohne (heute) | 0,834 | 0,209 | 0,860 | 100 % |
| 1,6 × | 0,834 | 0,209 | 0,860 | 99,4 % |
| 1,3 × | 0,833 | 0,209 | 0,860 | 70,7 % |
| 1,2 × | 0,830 | 0,210 | 0,846 | 44,0 % |
| 1,15 × | 0,822 | 0,211 | 0,839 | 30,1 % |
| 1,1 × | 0,807 | 0,217 | 0,825 | 19,2 % |

Bei 1,2× kostet das Lead-Bild 0,004 rho — weit innerhalb der Spannweite (0,209), also Rauschen.
Erst unter ≈ 30 % Top-out wird es teuer. Das begründet den 40–55-%-Korridor aus 2.1.

## 3. Bekannter Befund, NICHT in dieser PR behoben: `wert()` ordnet Nicht-Angekommene nicht nach Höhe

Aus Gegencheck Abschnitt 2.3, hier nur dokumentiert — die Behebung ist PR-2-Aufgabe:

`MOTOREN.climbing.wert()` (der Zweig, den `disziplinProbe()`/die Rangtreue-Messung liest, NICHT
`bahnRangliste()`, die Wertung im echten Spiel) sortiert `(bahnZeit(a)??99)-(bahnZeit(b)??99)`.
Alle Nicht-Angekommenen bekommen dieselbe `99`; die stabile Sortierung lässt sie dann in
`LAEUFER`-Reihenfolge (Bahn-Reihenfolge) stehen, **nicht** nach erreichter Höhe. Heute fällt das
nicht auf, weil Climbing kein Zeitlimit hat und ohne Limit ohnehin alle irgendwann ankommen.
Sobald PR 2 ein Zeitlimit einführt, würde `wert()` unverändert die **Bahnreihenfolge** messen
statt der Höhe — gemessen (Gegencheck 2.3):

| Limit | rho je Spiel mit heutiger `wert()` | mit höhenbewusster `wert()` |
|---|---:|---:|
| 1,3 × | 0,767 | 0,833 |
| 1,2 × | 0,686 | 0,830 |
| 1,1 × | 0,564 | 0,807 |

`bahnRangliste()` (die Wertung im Spiel selbst) ordnet Nicht-Angekommene schon heute korrekt nach
`pos` — nur die Mess-Funktion `wert()` tut es nicht. **PR 2 muss `wert()` für Climbing auf
dieselbe Ordnung wie `bahnRangliste()` bringen** (Zeit, darunter Höchstmarke `u.hoch`, s.
Gegencheck 3.3), sonst liefert jede Kalibrierrunde mit Zeitlimit ein Ergebnis, das nach
Mechanikschaden aussieht und keiner ist. In PR 1 bleibt `wert()` unangetastet — es gibt noch
kein Zeitlimit im Motor, der Bug ist also inaktiv, aber bekannt.

## 4. Was das für PR 2 bedeutet

- Zeitlimit-Eichung: am 40–55-%-Top-out-Korridor, nicht am 1,6×-Faktor.
- `wert()`-Fix ist Pflicht, sobald `zeitlimit` gesetzt wird (Abschnitt 3).
- Die Star-/Paartreue-Latte (CLAUDE.md) und die heutigen Werte (kaderfest 0,834/Spiel,
  0,860/Saison, Spannweite 0,209/0,308) sind die Latte, gegen die jede PR-2-Kalibrierrunde
  gemessen wird (`scripts/miss-alle-disziplinen.mjs 24 climbing`,
  `scripts/miss-star-paartreue.mjs climbing 24`, `scripts/messe-arena-einfluss.mjs climbing 48`).
