# Hockey — Pp-Messbasis (10.11.)

Reine Mess- und Diagnoserunde. Keine Rezept- oder Motoraenderung, kein Code angefasst.
Anlass: die alte Hockey-Pp-Zahl 38,5 / 81,5 (Task #195, 25.10.) stand auf n = 24 und nur zwei
Saatstroemen, und die Spannweite von 43 Pp zwischen den Stroemen war ungeklaert. Diese Runde
liefert drei Stroeme bei n = 48, eine Ursachendiagnose fuer die Spannweite und eine feste
Messvorschrift.

## 1. Ergebnis

`node scripts/messe-arena-einfluss.mjs hockey 48 --saat-versatz=N`, Stand `origin/main` 972b970cb,
Mutatoren `je-lauf` (Standard), Anhebung +15, alle drei ohne Seitenfehler.

| Strom (`--saat-versatz`) | Pp | Laufzeit |
|---|---:|---:|
| 0 | **52,1** | 3973 s |
| 10 000 000 | **46,1** | 3986 s |
| 20 000 000 | **35,7** | 3942 s |
| gepoolt (n = 144, s. Abschnitt 3) | **36,2** | — |

Alle drei Stroeme und die gepoolte Zahl verletzen die 25-Pp-Schranke.

Kontrast Basketball (`messe-arena-einfluss.mjs basketball 48`, Strom 0, gleicher Stand, 2926 s):
**15,6 Pp, bestanden** (spirit 23,0 / Matrix 22, intelligence 13,7 / 16, awareness 13,5 / 14,
speed 12,7 / 10, charisma 10,1 / 11, stamina 8,8 / 6, dexterity 7,4 / 8, torment 7,3 / 6,
power 3,5 / 7; kein Attribut weicht um mehr als 3,5 Pp ab). Die Referenz im Kopfkommentar von
`lib/battle/arena-resolved-disciplines.ts` (22,9 / 17,6, 25.10.) wird damit nicht bit-genau
wiedergefunden — der Motor hat sich seither weiterentwickelt; beide Zahlen liegen unter 25,
der Status "bestanden" ist bestaetigt.

### Anteile je Attribut (Prozent der positiven Gesamtwirkung)

| Attribut | Matrix | Strom 0 | Strom 1e7 | Strom 2e7 | Spannweite | gepoolt | gepoolt − Matrix |
|---|---:|---:|---:|---:|---:|---:|---:|
| power | 18 | 8,0 | 18,5 | 20,5 | 12,5 | 16,3 | −1,7 |
| health | 18 | 18,5 | 16,7 | 14,8 | 3,7 | 16,4 | −1,6 |
| spirit | 12 | 3,8 | 0 | 1,9 | 3,8 | 1,9 | **−10,1** |
| speed | 12 | 15,1 | 11,0 | 10,7 | 4,4 | 12,0 | 0,0 |
| stamina | 10 | 25,7 | 19,5 | 19,9 | 6,2 | 21,4 | **+11,4** |
| torment | 10 | 3,5 | 8,1 | 9,7 | 6,2 | 7,4 | −2,6 |
| awareness | 8 | 12,0 | 19,9 | 6,5 | **13,4** | 11,9 | +3,9 |
| will | 4 | 5,7 | 1,2 | 5,4 | 4,5 | 4,3 | +0,3 |
| dexterity | 4 | 5,1 | 5,2 | 8,1 | 3,0 | 6,4 | +2,4 |
| determination | 4 | 2,7 | 0 | 2,6 | 2,7 | 1,9 | −2,1 |
| intelligence | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| charisma | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

**Instabilstes Attribut: awareness** (12,0 / 19,9 / 6,5, Spannweite 13,4 Pp), knapp dahinter
power (8,0 / 18,5 / 20,5, Spannweite 12,5 Pp).

**Stabil und systematisch** (in allen drei Stroemen gleiches Vorzeichen, deutlich jenseits des
Rauschens aus Abschnitt 3): **stamina zu stark (+9,5 bis +15,7)** und **spirit fast tot
(0 bis 3,8 % bei Matrix 12)**. Diese beiden allein tragen gepoolt rund 21 Pp — das ist der
eigentliche, reproduzierbare Rezeptbefund. Der Rest der Abweichung ist ueberwiegend Messrauschen.

## 2. Diagnose der Spannweite — die Torwart-Hypothese ist widerlegt

Gepruefte Hypothese: ein seltenes Ereignis (die Torwartrolle) macht ein Attribut nur in manchen
Stroemen sichtbar. Plausibel, weil der Torwart ohne Aufstellung per hoechstem `PARADE` gewaehlt
wird (`bestimmeTorwaerter`, `battle-mode.engine.js`) und `PARADE` awareness mit 30 % liest
(`battle-mode.rezepte.js`, hockey.PARADE): +15 awareness kann also die Torwartwahl kippen, und
der Torwart wird mit einer ganz anderen Formel bewertet (Basis + GSAA statt Boxscore).

**Messung** (Diagnosekopie von Engine und Messskript im Scratchpad, NICHT im Repo; sie misst
dieselben Laeufe und schreibt zusaetzlich je Lauf den Torwart je Seite und den Spielwert jeder
Person mit; nur awareness und power gehoben, je n = 48 auf allen drei Stroemen, ca. 6,5 min je
Strom). Gegenprobe: das Verhaeltnis awareness : power stimmt in allen drei Stroemen auf 0,1 Pp
mit den Volllaeufen ueberein (60/40, 52/48, 24/76) — die Kopie misst also exakt dasselbe.

| Strom | Laeufe mit Torwartwechsel (awareness +15) | mittlerer awareness-Gewinn | davon aus Wechsel-Laeufen | Rest |
|---|---:|---:|---:|---:|
| 0 | 87 / 576 | 0,438 | 0,109 | 0,329 |
| 1e7 | 80 / 576 | 0,716 | 0,078 | 0,638 |
| 2e7 | 87 / 576 | 0,348 | 0,057 | 0,291 |

- Der Torwartwechsel ist **kein seltenes Ereignis** und **in allen Stroemen gleich haeufig**
  (14–15 % der gehobenen Laeufe; immer "wird Torwart", nie "verliert das Tor"). Bei power
  kommt er praktisch nicht vor (1–5 von 576, dann nur "verliert das Tor").
- Fuer einzelne Personen ist der Effekt gross (z. B. Seraph-11 +3,3 / +4,0 / +2,8 allein aus
  Wechsel-Laeufen, Draco/Greenkraut bis −2,4), aber **er hebt sich ueber die zwoelf Personen
  weitgehend auf**: netto 0,06–0,11 je Strom, Spannweite 0,05.
- Die Spannweite des awareness-Gewinns zwischen den Stroemen (0,35–0,72) steckt fast ganz im
  **Rest ohne Torwartwechsel** (0,29–0,64). Die Torwartrolle erklaert die Instabilitaet also
  NICHT.

**Was sie erklaert: reines Stichprobenrauschen bei n = 48.** Aus den gepaarten Einzellaeufen
(Spielwert mit Hebung minus Grundlauf, gleiche Saat):

| Strom | awareness-Gewinn ± SE | power-Gewinn ± SE |
|---|---:|---:|
| 0 | 0,438 ± 0,222 | 0,291 ± 0,179 |
| 1e7 | 0,716 ± 0,225 | 0,669 ± 0,176 |
| 2e7 | 0,348 ± 0,212 | 1,089 ± 0,189 |

Ein Hockeyspieler hat je Spiel einen Wert von im Mittel 8,7 bei einer Streuung von 4,2; der
Gewinn aus +15 auf einem Attribut liegt bei 0,3–1,1, also bei einem Zehntel der Streuung eines
einzelnen Spiels. Die Paarung (gleiche Saat) daempft das nur teilweise (Korrelation Grund/Hebung
0,63–0,80, weil die Hebung den Spielverlauf sofort umlenkt). Der Standardfehler je
Attributgewinn liegt damit bei ~0,2, bei einer Summe der positiven Gewinne von 3,6–5,3 — das
sind **4–6 Pp Rauschen je Attribut und Strom**. awareness liegt mit seiner Spannweite
innerhalb von ~1,2 SE der Differenz, ist also nicht auffaellig. power (0,29 gegen 1,09) liegt
bei rund 3 SE — eher am Rand, bei 36 Einzelvergleichen (12 Attribute × 3 Stroeme) aber noch
kein belastbarer Hinweis auf einen Strom-Effekt; ein Mechanismus, der Stroeme unterscheidet,
existiert im Messaufbau auch nicht (Lauf i haengt nur an `versatz + i`).

## 3. Der Rauschboden: n = 48 kann ≤ 25 Pp nicht nachweisen

Simulation (20 000 Ziehungen): wenn die Mechanik die Matrix **exakt** traefe, die Gewinne aber
mit dem gemessenen SE ~0,2 je Attribut verrauscht sind, liest die Pp-Formel:

| Aufwand | Median Pp | 90-%-Quantil |
|---|---:|---:|
| n = 48, ein Strom (Summe 3,6) | 41,5 | 56,5 |
| n = 48, ein Strom (Summe 4,2) | 36,5 | 49,3 |
| n = 144 (drei Stroeme gepoolt) | 22,5 | 29,9 |
| n = 192 (vier Stroeme gepoolt) | 19,6 | 26,2 |

**Ein einzelner Hockey-Strom bei n = 48 hat einen Rauschboden von 35–40 Pp — ueber der
Schranke, auch bei einer perfekten Mechanik.** Die Pp-Formel summiert Betraege, Rauschen
addiert sich also nie weg, es addiert sich auf. Das erklaert die Spannweite 35,7–52,1 dieser
Runde und erst recht die 38,5 / 81,5 bei n = 24 (doppelte Varianz). Basketball besteht bei
gleichem n mit 15,6 Pp, hat also einen deutlich niedrigeren Rauschboden; vermutlich schlaegt
dort die Hebung im Verhaeltnis zur Spielstreuung staerker durch. Das ist nicht gemessen —
die SE-Rechnung oben wurde nur fuer Hockey gemacht.

Folgerung: **eine Hockey-Pp-Abnahme ist nur auf gepoolten Gewinnen ueber mindestens drei
Stroeme sinnvoll** (n_gesamt ≥ 144). Die gepoolte Zahl dieser Runde, 36,2 Pp, liegt klar ueber
dem Rauschboden (~22) und ueber der Schranke — Hockey verfehlt Pp also tatsaechlich, nicht nur
messbedingt; der Befund dahinter ist stamina (+11,4) und spirit (−10,1).

Wie gepoolt wurde: das Skript gibt nur Anteile aus, nicht die Rohgewinne. Die Summe der positiven
Gewinne je Strom (3,64 / 3,61 / 5,33) wurde aus den in der Diagnose gemessenen Gewinnen von
awareness und power rueckgerechnet (beide Attribute liefern je Strom dieselbe Summe auf ±0,03),
Anteil × Summe ergibt den Gewinn, gemittelt ueber die Stroeme, neu normiert. Attribute mit 0 %
(negativer Gewinn) gehen als 0 ein — das ist dieselbe Klammerung wie in `einflussVon`.

## 4. Messvorschrift fuer kuenftige Hockey-Pp-Messungen

```sh
node scripts/messe-arena-einfluss.mjs hockey 48 --saat-versatz=0
node scripts/messe-arena-einfluss.mjs hockey 48 --saat-versatz=10000000
node scripts/messe-arena-einfluss.mjs hockey 48 --saat-versatz=20000000
```

- **n = 48, drei Stroeme 0 / 10 000 000 / 20 000 000**, Mutatoren Standard (`je-lauf`), kein
  vierter Aufrufwert (das Skript misst dann den eigenen Worktree).
- **Laufzeit:** rund 66 min je Strom (diese Runde: 3940–3990 s, vier Kerne, drei Hockey-Stroeme
  parallel plus Fremdlast mit Lastspitzen bis 24). Die Ergebnisse sind deterministisch und
  haengen nicht von der CPU-Last ab — die drei Stroeme duerfen parallel laufen. Immer im
  Hintergrund starten (`nohup … > /tmp/hockey-seedN.log 2>&1 &`), sonst greift der
  Werkzeug-Timeout.
- Bei frischem Container den Chromium-Pfad pruefen: das Skript erwartet
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; fehlt er, per Symlink auf die
  installierte Version legen.
- **Berichtet werden alle drei Einzelzahlen UND die gepoolte Zahl.** Abnahme-relevant ist die
  gepoolte (Rauschboden ~22 Pp). Ein einzelner Strom ist fuer Hockey nicht abnahmefaehig
  (Rauschboden 35–40 Pp), und Unterschiede zwischen Einzelstroemen von 10–15 Pp sind Rauschen.
- Der SE von ~0,2 je Attributgewinn ist an awareness und power gemessen und fuer die uebrigen
  zehn Attribute angenommen.
- Erwartungswert auf Stand 972b970cb, zum Wiedererkennen: 52,1 / 46,1 / 35,7, gepoolt 36,2.
- Zum Poolen werden die Rohgewinne je Attribut gebraucht. `einflussVon` liefert sie bereits
  (`reihen[].gewinn`), das Skript druckt sie nur nicht. Ein additiver Ausgabeschalter dafuer
  waere die naheliegende kleine Werkzeugverbesserung (nicht Teil dieser Runde).

## 5. Was daraus fuer eine Rezeptrunde folgt (nicht umgesetzt)

- Ziel ist stamina runter und spirit rauf. Im Hockey-Rezept fuehrt stamina AUFBAU (57),
  AUSDAUER (57) und LAUFTEMPO (66); spirit steht nur in ABSCHLUSS (18), TEAMGEIST (47) und
  AUSDAUER (4) — offenbar in Sub-Skills, die in der Wertformel wenig tragen.
- Jede solche Aenderung ist nur gegen die **gepoolte** Drei-Strom-Zahl abnehmbar; eine einzelne
  n = 48-Messung kann eine Verbesserung von 10 Pp weder zeigen noch ausschliessen.
- Die Torwart-Wahl ueber `PARADE` erzeugt fuer einzelne Spieler grosse Spruenge, verzerrt den
  Mittelwert aber kaum. Fuer Pp kein Hebel; fuer die Rangtreue nach Rolle ggf. schon.
