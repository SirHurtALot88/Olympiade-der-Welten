# TDM-Broadcast-Paket — Plan (07.10.)

**Nachtrag (07.10., Umsetzung): T1 und S1–S3 sind gebaut, gemessen und committet** (Branch
`tdm-broadcast-paket-07-10`). S4 (Schluss-Tickerzeile "11 : 14" statt "11:14") blieb wie im Plan
als optional/Kosmetik aussen vor. Gemessen nach dem Bau: Ticker TDM 348,6 → 23,5/min, Battlefield
143,8 → 8,9/min (genau die Vorhersage aus Abschnitt 2.4); `miss-alle-disziplinen.mjs 12`
bit-identisch für tdm/battlefield/mini-dm (rho 0,300/0,431/0,360, unveraendert); neue Sonde
`scripts/verify-tdm-broadcast-paket-07-10.mjs` komplett gruen für beide Disziplinen. Zwei
Praezisierungen gegenueber der Planannahme, beim Bau der Verifikationssonde gefunden: (1)
`chrome_crashpad_handler`-artige Parallele gibt es hier nicht, aber `#bbug` wird bei Spielende
(`done=true`) ausgeblendet UND `aktualisiereBbug()` kehrt dabei sofort zurueck, ohne die
Bug-Ziffer noch ein letztes Mal nachzuziehen -- die letzte sichtbare Ziffer kann dadurch eine
Ausschaltung hinter der (immer aktuellen) Scoreline zuruckbleiben, aber NUR nachdem der Bug
schon unsichtbar ist (kein Widerspruch im Bild). (2) Battlefields Sieg-Banner zeigt bei einem
Kontrollpunkt-Sieg weiterhin die KP-Zahlen statt der Ausschaltungen aus der Scoreline -- exakt
der in Abschnitt 3.3 dokumentierte, bewusst ausgeklammerte Nebenbefund, jetzt an der echten
Sonde (nicht nur den 357 Stichproben) bestaetigt.

**Reiner Plan, kein Code geändert.** Auftrag: die zwei Broadcast-Schwächen, die der Audit vom
30.09. (`f1-broadcast-audit-runde-2-30-09.md`) für TDM benannt hat, **selbst nachmessen**, die
Ursache im Code finden und ein Paket im Stil der Broadcast-Pakete A/B/C (06.10., PR #1155)
entwerfen. Gemessen wurde auf `main` bei `9d7f641c`.

Vorweg das Wichtigste, weil es den Auftrag verschiebt: **beide Probleme wurden schon einmal
angegangen.** Der Ticker am 01.10. (`6db278bc`, Punkt 8), der Stand am 30.09. (`636f065f`, Punkt 3).
Der Ticker-Fix ist **noch am selben Tag still zurückgefallen**, und der Stand-Fix hat die
Zahlen in Ordnung gebracht, aber nicht die Darstellung. Dieses Paket repariert also eine
Regression und macht eine halbe Lösung fertig. Es baut nichts von Grund auf neu.

---

## 0. Kurzfassung

| | Audit 30.09. | Fix | heute gemessen | nach diesem Paket (gemessen an einer Kopie, s. 2.4) |
|---|---|---|---|---|
| Ticker-Zeilen je Minute, TDM | 449 (Wanduhr) / 487 (Sonde) | `6db278bc` → 23 | **349** | **23,5** |
| Ticker-Zeilen je Minute, Battlefield | 172 / 180 | → 9 | **144** | **8,9** |
| Stand-Zahlen, die sich zahlenmäßig widersprechen | Bug „6 : 5“ gegen Kaderleiste „5 : 6“ | `636f065f` | **0 von 357 Proben** | 0 |
| Zwei „a : b“ verschiedener Bedeutung zugleich im Bild | ja | nur beschriftet | **356 von 357 Proben** | 0 |
| … davon zeigen sie in entgegengesetzte Richtung | — | — | **24 Proben (6,7 %)** | 0 |
| Wort unter dem Stand | — | — | „Punkte“ (Endstand und Ticker sagen „Ausschaltungen“) | „Ausschaltungen“ |

* **Ticker (Problem 2): bestätigt, und es ist eine Regression.** Ursache ist eine einzige
  Bedingung in `feed()`: Sie stuft jede Zeile **mit** `kind` als „ereignis“ ein. Der Merge
  `0fd081b3d` (C3 Highlight-Titel, 01.10. 17:12) hat dann `kind="grosserTreffer"` an jede
  gewöhnliche Trefferzeile gehängt. Gemessen sind 993 der 1040 sichtbaren Tickerzeilen
  gewöhnliche Treffer ohne Banner.
* **Stand (Problem 1): so, wie er in Erinnerung war, nicht mehr vorhanden.** Keine Stelle zeigt
  für dieselbe Größe eine andere Zahl. Was bleibt, ist schwächer, aber für den Zuschauer genau
  das, was er als Widerspruch wahrnimmt. Die Scoreline zeigt die Ausschaltungen, die Kaderleiste
  darunter die Lebenden, beide im selben Format „a : b“. In 6,7 % der Sendezeit liegt dabei laut
  Scoreline die eine Seite vorn und laut Kaderleiste die andere. Dazu heißt dieselbe Größe an
  drei Stellen dreimal anders: „Punkte“, „Ausschaltungen“, „KO“.
* **Paket: vier kleine Eingriffe, alle Klasse A** (s. Abschnitt 4). Die Wertung wird nirgends
  berührt, rho und Pp bleiben bit-identisch. Eine Freigabe durch Chris ist nicht nötig.

---

## 1. Wie gemessen wurde

* **Ticker:** `scripts/miss-ticker-dichte.mjs` (vorhanden, aus `6db278bc`). Die Sonde fährt
  `window.__arena.sondenLauf()` in festen 1/60-s-Ticks, das ist exakt Tempo-1×-Sendezeit und
  deterministisch. Gezählt wird per MutationObserver auf `#feed` und `#protokoll`.
  Standardkader, Produktionsmodus (dunkel, `.im-spiel`).
* **Stand:** eine Wegwerf-Sonde im Scratchpad, nicht im Repo; der Plan in 5.3 macht daraus die
  echte Sonde. Sie tastet alle 30 Ticks (0,5 s Sendezeit) über ein ganzes TDM-Spiel ab:
  `#score`, `#klsuffix`, `#bbugMitte` (Ziffer und `.ueberzahl`), `#kmitte`, `#aliveL/#aliveR`,
  die Lebens-Pips (`#bbugL/#bbugR .pip.an`/`.wartet`), die Summe der KO-Spalte in den beiden
  Wertungstabellen und am Ende `#esieger` sowie die Schluss-Tickerzeile. Das Einlauf-Overlay
  wird in der Sonde von Hand ausgeblendet (`#einlauf.hidden=true`), sonst bleibt `#bbug`
  verborgen, weil `sondenLauf()` nie über den Start-Knopf geht. Aus demselben Grund steht
  `#phase` in der Sonde auf „bereit“. Das ist ein Artefakt der Sonde, im echten Spiel steht
  dort „läuft“.
* **Fix-Vorhersage:** dieselbe Ticker-Sonde gegen eine **gepatchte Kopie** von
  `battle-mode.engine.js` im Scratchpad. Der Testserver liefert nur diese eine Datei aus, das
  Repo bleibt unangetastet. Die Zahlen in Spalte 5 der Kurzfassung und in 2.4 sind also
  gemessen, nicht geschätzt.

---

## 2. Problem 2 — der Ticker

### 2.1 Messung auf `main`

| Disziplin | Dauer 1× | Ticker-Zeilen | je min | Protokoll | je min | nur im Protokoll |
|---|---:|---:|---:|---:|---:|---:|
| TDM | 2:59 | 1040 | **348,6** | 1455 | 487,7 | 415 |
| Battlefield | 1:41 | 242 | **143,8** | 303 | 180,0 | 61 |

Zielband laut Audit-Punkt 8: höchstens 30 Zeilen je Minute im sichtbaren Ticker.

Woraus die 1040 sichtbaren TDM-Zeilen bestehen:

| Art | Zeilen |
|---|---:|
| gewöhnlicher Treffer „X trifft Y · 8“ / „X — Trennschlag auf Y · 14“ ohne Banner | **993** |
| großer Treffer mit Banner | 6 |
| Ausschaltung „Y fällt — zurück in 9 s.“ | 25 |
| „ist raus — die Ordnung bricht“, „vergilt“, „lässt die Stellung sein“, Eröffnung, Sieg | 16 |

Ein Ausschnitt in Sendezeit 0:22–0:24: 40 Zeilen in drei Sekunden, durchweg „Tidesprinter trifft
Draco · 8“, „Draco trifft Krag'Zul · 12“ und so weiter.

### 2.2 Ursache im Code

**`feed()`, `battle-mode.engine.js` Z. 42480:**

```js
const imTicker=!p||tickerZeigt(big||kind?"ereignis":stufe);
```

`kind` gewinnt hier gegen die ausdrücklich übergebene `stufe`. Für sich ist die Regel aus
Punkt 8 harmlos: Damals trug nur eine Zeile mit Banner ein `kind`.

**`nahschlag()` Z. 31110–31112 und der Geschoss-Treffer in der Projektil-Schleife
Z. 31785–31788:**

```js
feed(u.side, …+" · "+d,
  kampfGrossDrosseln(grosserTreffer(hpVorher,tg.hp,d,tg.max,crit),false),undefined,
  "grosserTreffer",undefined,undefined,"routine");
```

`kind="grosserTreffer"` steht hier **bedingungslos**, auch wenn `big` false ist. Damit greift
`"routine"` nie, und jeder einzelne Treffer landet im sichtbaren Ticker.

**Chronik**, per `git blame` belegt:

| Zeit | Commit | Was |
|---|---|---|
| 01.10. 10:36 | `6db278bc` (Punkt 8) | `feed()` bekommt `stufe`, Treffer werden `feedRoutine()`, TDM 487 → 23 je min |
| 01.10. 17:12 | `0fd081b3d` (C3 Highlight-Titel, Merge #1093/#1095) | Treffer-Aufrufe von `feedRoutine()` auf `feed(…,"grosserTreffer",…,"routine")` umgebaut, `kind` bedingungslos → **Regression** |
| 04.10. | T-N1 Ticker-Dosis (Tennis) | **derselbe Fehler**, gefunden und nur für Tennis behoben, Kommentar Z. 19766–19771: „Schach/Fechten bleiben unveraendert (nicht Teil dieses Auftrags)“ |

Der Fehler wurde also schon einmal verstanden. Die Lösung für Tennis ist das Muster, das hier
übernommen wird: `kind` nur, wenn die Zeile wirklich ein Banner ist.

### 2.3 Warum das sicher eine reine Anzeigeänderung ist

* `kind` wird in `feed()` an genau zwei Stellen gelesen: in der Ticker-Einstufung (Z. 42480)
  und **innerhalb** von `if(big){…}` (HIGHLIGHTS, Callout-Titel, Sting). Wenn `kind` nur bei
  `big` übergeben wird, bleibt der `if(big)`-Zweig Zeichen für Zeichen derselbe.
* `kampfGrossDrosseln()` wird weiter genau einmal je Treffer aufgerufen, in derselben
  Reihenfolge. Das Ergebnis landet nur vorher in einer Konstante. Die Funktion liest `t` und
  schreibt `letzterGrosserT`, beides Anzeigezustand ohne Rückwirkung auf die Simulation.
* Im stummen Messpfad (`miss-alle-disziplinen.mjs`) kehrt `feed()` in der ersten Zeile zurück
  (`if(stumm)return;`). Die Wertung kann sich deshalb gar nicht bewegen.
* Kein `rr()`, kein Simulationsfeld. Belegt ist das auch durch die Protokoll-Zahl: In der
  gepatchten Kopie ist sie mit 1455 bzw. 303 identisch mit `main`, ebenso die Spieldauer
  (2:59 / 1:41).

### 2.4 Vorhersage, an der gepatchten Kopie gemessen

**Variante T1 (empfohlen): Fix an den zwei Kampf-Aufrufstellen**, wie beim Tennis.

| Disziplin | vorher je min | nachher je min | Protokoll vorher / nachher | längste Lücke im Ticker |
|---|---:|---:|---:|---:|
| TDM | 348,6 | **23,5** | 1455 / 1455 | 15 s |
| Battlefield | 143,8 | **8,9** | 303 / 303 | — |

Das sind dieselben Werte, die `6db278bc` am 01.10. gemessen hat (23 / 9). Der Fix stellt also
genau den beabsichtigten Zustand wieder her. Was danach im TDM-Ticker steht, 70 Zeilen in 2:59:
24 Ausschaltungen, 7 „Ordnung bricht“, die Taktik-Meldungen („lässt die Stellung sein“, „löst
sich kurz aus dem Kampf“, „geht auf … durch“), 3 „vergilt“, 6 große Treffer mit Banner und die
Siegzeile. Das ist Play-by-Play für Ereignisse, so wie der Audit es verlangt hat.

**Variante T2 (Alternative, breiter): die Regel in `feed()` selbst**, ausdrückliche `stufe`
schlägt `kind`:

```js
const imTicker=!p||tickerZeigt(big?"ereignis":(stufe||(kind?"ereignis":undefined)));
```

Für TDM und Battlefield misst T2 exakt dasselbe wie T1 (70 / 15 Zeilen). T2 repariert
zusätzlich alle anderen Aufrufstellen, die `kind` und `"routine"` gemeinsam übergeben, gemessen
an derselben Kopie:

| Disziplin | `main` je min | mit T2 je min | Ursache derselbe Fehler? |
|---|---:|---:|---|
| Speed-Schach | 129,7 | **14,5** | ja, Z. 19773–19778 (`"kippZug"` bedingungslos) |
| Breaking | 169,7 | 73,1 | ja, Z. 20045 (`"angeschlagen"` bedingungslos). Noch über dem Band, Rest hat andere Ursachen |
| Fechten | 72,4 | 47,6 | teilweise. Z. 19778 lässt die Erfolgszeile absichtlich ohne `stufe` |
| I-Spy | 95,4 | 63,0 | teilweise |
| Tennis | 19,4 | 19,4 | schon lokal behoben (T-N1) |

**Empfehlung:** T1 in dieses Paket (Auftrag TDM, kleinster Radius, nur das Kampf-Chassis).
T2 gehört als **eigenes Folgepaket „Ticker-Regression Bühne“** auf die Liste. Es ist ebenfalls
Klasse A, betrifft aber fünf Bühnen-Disziplinen mit je eigener Sichtprüfung, und für Breaking,
Fechten und I-Spy reicht es allein nicht ins Band. Wer T2 trotzdem gleich mitnimmt, nimmt T2
**statt** T1, nicht beides.

### 2.5 Warum das niemand bemerkt hat

Zwischen Fix und Regression lagen keine sieben Stunden. Die Messsonde gibt nur eine Tabelle
aus und kennt keine Schranke. Kein Test und keine Verifikationssonde prüft das Zielband. Ein
Teil des Pakets ist deshalb eine **Schranke in der Sonde** (Schritt 5 in Abschnitt 5), damit
die nächste Regression rot wird statt still.

---

## 3. Problem 1 — der Stand

### 3.1 Was auf dem Bildschirm steht (TDM, live)

| Stelle | Element | Inhalt | Quelle |
|---|---|---|---|
| Scoreline über dem Canvas | `#score` | **Ausschaltungen** „4 : 3“ | `updateHud()` Z. 34124: Σ `u.st.ko` je Seite |
| darunter klein | `#klsuffix` | „**Punkte**“ | `updateHud()` Z. 34100, fest |
| Score-Bug im Canvas, Ziffer | `#bbugMitte b` | „4 : 3“, wörtliche Kopie von `#score` | `aktualisiereBbug()` Z. 13359 |
| Score-Bug, kleine Zeile | `#bbugMitte .ueberzahl` | „**Lebende 5 : 6**“, nur bei ungleicher Zahl | `aktualisiereBbug()` Z. 13410–13424 |
| Score-Bug, je Seite | `.pip.an / .wartet` | 5 bzw. 6 Pips, Respawn-Wartende mit Punkt | `aktualisiereBbug()` Z. 13340 |
| Teamname in der Scoreline | `#aliveL/#aliveR` | „5 im Kampf“ | `updateHud()` Z. 34111 |
| Kaderleiste Mitte | `#kmitte` | „**Lebende 5 : 6**“ | `renderKader()` Z. 44344 |
| Wertungstabelle | Spalte „**KO**“ | Summe = Ausschaltungen | `WERTUNG_CHASSIS.kampf` Z. 32812 |
| Endstand-Banner | `#esieger` | „… SIEGER — 11 : 14 · **Ausschaltungen**“ | `renderEndstand()` Z. 44601 |
| Schluss-Tickerzeile | `#feed` | „… gewinnt **11:14** Ausschaltungen“ | `finish()` Z. 42569 |

### 3.2 Messung über ein ganzes Spiel (357 Live-Proben, 0,5 s Abstand)

| Prüfung | Verstöße |
|---|---:|
| Bug-Ziffer ≠ `#score` | 0 |
| Σ KO-Spalte ≠ `#score` | 0 |
| `#kmitte` ≠ „Lebende“ + `#aliveL/#aliveR` | 0 |
| Pips ≠ `#aliveL/#aliveR` | 0 |
| Endstand-Banner ≠ letzte Scoreline | 0 |
| **zwei „a : b“ mit verschiedener Zahl zugleich im Bild** (`#score` gegen `#kmitte`) | **356** |
| … davon **gegenläufig** (Scoreline: links führt, Kaderleiste: rechts in Überzahl, oder umgekehrt) | **24 (6,7 %)** |
| Überzahl-Zeile im Bug sichtbar | 196 (55 %) |
| mindestens ein Kämpfer wartet auf Respawn | 231 (65 %), bis zu 5 gleichzeitig |

Beispiel aus Probe 3630 (Sendezeit 1:00): Scoreline und Bug „**4 : 3**“, im Bug klein
darunter „**Lebende 5 : 6**“, in der Kaderleiste „**Lebende 5 : 6**“.

**Lesart.** Der Fix `636f065f` vom 30.09. hat gehalten: Jede Größe ist an jeder Stelle dieselbe
Zahl. Die Erinnerung, verschiedene Zahlen für denselben Stand, trifft heute nicht mehr zu. Es
bleibt aber, was der Audit als eigentliches Problem formuliert hat: „nie zwei unbeschriftete
‚a : b' verschiedener Bedeutung“. Das Etikett „Lebende“ steht in 10-px-Schrift. Gelesen wird die
Zahl, und die Zahl steht zweimal im selben Format da und widerspricht sich in jeder fünfzehnten
Sekunde in der Richtung. Bei TDM kommt hinzu, dass „Lebende“ unter Respawn eine Momentaufnahme
ist (65 % der Zeit wartet jemand). Das ist ein Zustand, kein Stand.

**Benennung.** Dieselbe Größe heißt in der Scoreline „Punkte“, im Endstand und im Ticker
„Ausschaltungen“ und in der Tabelle „KO“. „Punkte“ ist dabei falsch. In der Saisonwertung
bekommt ein Team 2/1/0 Punkte (`battle-mode-arena-team-points.ts`), nicht 11.

**Übrige Chassis zum Vergleich.** Dort zeigt `#kmitte` dieselbe Zahl wie `#score`: Feldspiel
`fsPunkte`, Bahn `bahnTeamstand()`, Bühnen-Duell `buehneDuellStandText()`, Wettessen
`wettessenAnzeigeSumme()`. Wo sie abweicht, trägt sie ein Präfix (Heben „KG“, Breaking „PKT“).
Der Kampf ist das einzige Chassis, dessen Kaderleisten-Mitte eine **andere** Größe ohne Präfix
im selben Format zeigt.

### 3.3 Nebenbefund, nicht Teil dieses Pakets

Bei Battlefield steht am Ende im Banner „41 : 0 · Kontrollpunkte“, in der Scoreline
„4 : 0“ mit dem Wort „Punkte“, in der Kaderleiste „Lebende 4 : 0“, und das alles in einem Bild.
Das Banner ist korrekt, weil Battlefield über die Kontrollpunkte entschieden wird. Die
Darstellung gehört aber in dieselbe Familie. S1 und S2 unten verbessern Battlefield mit
(„Ausschaltungen“ statt „Punkte“), den Banner-Widerspruch lösen sie nicht. Er kommt als eigener
Punkt auf die Liste.

---

## 4. Das Paket

Ziel nach dem Paket: **Jedes „a : b“ im TDM-Bild bedeutet Ausschaltungen und trägt überall
dieselbe Zahl. Die Lebenden erscheinen nur noch als Pips, als „5 im Kampf“ oder als
„5 v 6“, nie mehr im Stand-Format. Der sichtbare Ticker bleibt unter 30 Zeilen je Minute.**

| # | Eingriff | Funktion / Stelle | Klasse | Wirkung | Risiko |
|---|---|---|---|---|---|
| **T1** | `kind="grosserTreffer"` nur bei `big`, `stufe:"routine"` greift wieder | `nahschlag()` Z. 31110, Projektil-Treffer Z. 31785 | A | TDM 349 → 23,5, Battlefield 144 → 8,9 je min (gemessen) | keins. HIGHLIGHTS/Callout identisch, s. 2.3 |
| **S1** | `#klsuffix` im Kampf „Ausschaltungen“ statt „Punkte“ | `updateHud()` Z. 34100 | A | ein Wort für eine Größe: Scoreline = Endstand = Ticker | Breite der Unterzeile prüfen (Uhr · Phase · Wort) |
| **S2** | `#kmitte` im Kampf zeigt den Stand wie `#score` (Ausschaltungen), nicht mehr die Lebenden | `renderKader()` Z. 44340–44344 | A | Kaderleiste = Scoreline wie in allen anderen Chassis. Gegenläufige Proben 24 → 0 | Battlefield/Mini-DM teilen den Zweig, für alle drei richtig (s. u.) |
| **S3** | Überzahl im Bug als „5 v 6“ statt „Lebende 5 : 6“, der Doppelpunkt bleibt dem Stand vorbehalten | `aktualisiereBbug()` Z. 13422 | A | kein zweites „a : b“ mehr im Bug | keins |
| S4 *(optional)* | Schluss-Tickerzeile „11 : 14“ statt „11:14“, Schreibweise wie Scoreline/Banner | `finish()` Z. 42569 | A | Kosmetik | keins |

**Bewusst nicht im Paket:**

* Den Täter in die Ausschaltungs-Zeile schreiben („Draco schaltet Rhyx'Tal aus — 4 : 3“) und den
  laufenden Stand mitführen, Audit 3.4. Das wäre die schönste Ticker-Zeile im Kampf. Der Text
  wurde aber am 01.10. (Punkt 11) ausdrücklich unangetastet gelassen, und Höhepunkte und Szene
  des Spiels lesen ihn. Das ist eine eigene kleine Runde mit eigener Sichtprüfung, kein Fix.
* Die Bug-Ziffer als wörtliche Kopie der Scoreline abschaffen (Audit 3.1, „genau einen
  Score-Bug“). Das ist eine Layout-Frage für alle 20 Disziplinen, nicht nur für TDM.
* T2 und der Battlefield-Banner, s. 2.4 und 3.3.

**Zu S2 im Einzelnen.** Für TDM ist `#score` = Σ `st.ko` (Z. 34125). Für Battlefield/Mini-DM ist
`#score` = `(nR-live(1)) : (nL-live(0))` (Z. 34126). Dort ist das ohnehin die Ergänzung der
Lebenden, eine Information in zwei Schreibweisen. S2 nimmt **dieselbe Formel wie
`updateHud()`**. Am saubersten geht das über eine kleine gemeinsame Funktion
`kampfStandText()`, die `updateHud()` und `renderKader()` beide rufen. So kann die Kaderleiste
nie wieder von der Scoreline abweichen, dasselbe Prinzip wie `buehneDuellStandText()` beim
Bühnen-Duell (Review-Fund PR #1083). `renderKader()` läuft in `updateHud()` nach dem Setzen von
`#score`. Ein schlichtes `m.textContent=document.getElementById("score").textContent` ginge
auch, die gemeinsame Funktion ist aber robuster gegen spätere Umstellungen der Reihenfolge.

**Klassifizierung.** Alle vier Eingriffe sind **Klasse A** im Sinne des Klassenschemas
(`tennis-nachtkonzept-03-10.md` Abschnitt „Klassenschema“, `f1-broadcast-audit-runde-2-30-09.md`
Abschnitt 4): reine Anzeige, kein `rr()`, kein neues Simulationsfeld, `wert()` und Rezept
unangetastet, rho bit-identisch. Abnahme ist eine Sichtprüfung. **Eine Freigabe durch Chris ist
nicht nötig.** Nichts davon greift in Sende- oder Wandzeit ein (keine Klasse T): Die
Ticker-Drossel zählt Sendezeit, verzögert aber nichts, und der Callout-Zeitpunkt bleibt
unverändert. Die Eignungsmatrix und die Pp-Budgets werden nicht berührt.

---

## 5. Schritt für Schritt

Ein Branch `tdm-broadcast-paket-07-10`, je Schritt ein Commit, damit sich T1 notfalls einzeln
zurücknehmen lässt.

**Schritt 0 — Nulllinie sichern (vor jeder Änderung).**

```sh
node scripts/miss-alle-disziplinen.mjs 24 tdm battlefield mini-dm > /tmp/vorher.txt
node scripts/miss-ticker-dichte.mjs tdm,battlefield --zeilen /tmp/ticker-vorher.json
```

TDM ist in der Vergangenheit bei `n≥12` an Cgroup-OOM gescheitert
(`stand-aller-disziplinen.md`, Nachtrag zu Hockey/Breaking/TDM). `6db278bc` hat `24 tdm`
erfolgreich gefahren. Falls es wieder abbricht, auf `12` bzw. `6` herunter, **vorher und nachher
mit demselben n**. Für die Bit-Identität kommt es auf das Diff an, nicht auf die Größe der
Stichprobe.

**Schritt 1 — T1, Ticker.** In `nahschlag()` und im Projektil-Treffer jeweils:

```js
const gross=kampfGrossDrosseln(grosserTreffer(hpVorher,tg.hp,d,tg.max,crit),false);
feed(u.side, …unveränderter Text…, gross,undefined,
  gross?"grosserTreffer":undefined,undefined,undefined,"routine");
```

Dazu ein Kommentar im Stil des Tennis-Kommentars Z. 19766–19771, mit Verweis auf dieses
Dokument und auf `0fd081b3d`. Im Kopfkommentar von `feed()` den Satz „automatisch fuer … jede
Zeile mit Momentart `kind`“ um den Hinweis ergänzen, dass `kind` deshalb **nur bei `big`**
übergeben werden darf. Der nächste Merge soll die Falle sehen.

**Schritt 2 — S1, Wort.** `updateHud()` Z. 34100: `"Punkte"` → `"Ausschaltungen"`. Bei 1300 px
und 375 px Breite prüfen, ob die Unterzeile „2:58 · läuft · Ausschaltungen“ umbricht.
Gegebenenfalls auf „Ausschalt.“ kürzen oder im Kampf die Phase ausblenden, solange sie „läuft“
heißt.

**Schritt 3 — S2, Kaderleiste.** `kampfStandText()` neben `kampfSieger()` (Z. 31386) anlegen,
mit denselben zwei Zweigen wie Z. 34124–34126. `updateHud()` und den Kampf-Zweig von
`renderKader()` darauf umstellen. Den Kommentar „LEBENDE, jetzt explizit beschriftet …“
(Z. 44340–44343) ersetzen und begründen: alle Chassis zeigen dort den Stand.

**Schritt 4 — S3, Überzahl.** `aktualisiereBbug()` Z. 13422:
`ueb.textContent=nL+" v "+nR;`. Die Farbe über `.ueberzahl.l/.r` bleibt. Kommentar mit Verweis
auf Audit-Punkt 3 („Überzahl im Bug in Seitenreihenfolge (‚5 v 6')“), der damit endlich so
umgesetzt ist, wie er formuliert war.

**Schritt 5 — Sonden.**

* `scripts/miss-ticker-dichte.mjs` bekommt einen optionalen Schalter `--schranke <n>`: Exit-Code
  1, wenn eine Disziplin über n Zeilen je Minute liegt. Ohne Schalter ist das Verhalten wie
  bisher. Das ist die Schranke, deren Fehlen in 2.5 die Regression möglich gemacht hat.
* Neue Sonde **`scripts/verify-tdm-broadcast-paket-07-10.mjs`**, Bauart wie
  `verify-broadcast-paket-a-06-10.mjs` (eigener HTTP-Server über `public/`, `sondenLauf()`,
  Produktionsmodus, Einlauf ausgeblendet wie in Abschnitt 1). Sie prüft TDM und Battlefield
  und kann bestehen oder durchfallen:
  - (a) zu **keinem** Probezeitpunkt zwei Ziffernpaare „a : b“ mit verschiedenen Zahlen in
    `#score`, `#bbugMitte`, `#kmitte`
  - (b) `#score` = Bug-Ziffer = Σ KO-Spalte (TDM) zu jedem Probezeitpunkt
  - (c) `.ueberzahl` enthält, falls sichtbar, kein „:“ und passt zu den Pips
  - (d) `#klsuffix` = „Ausschaltungen“, Endstand-Banner enthält „Ausschaltungen“ (TDM)
  - (e) Endstand-Zahl = letzte Scoreline = Zahl in der Schluss-Tickerzeile
  - (f) sichtbarer Ticker ≤ 30 Zeilen je Minute Sendezeit, Protokoll-Zeilenzahl gleich der
    Vorher-Messung (nichts geht verloren)
  - (g) keine `pageerror`
  - dazu drei Screenshots des ganzen `#p2 .frame` (Mitte mit Überzahl, Mitte gleichauf,
    Endstand) nach `tmp-ux-audit/tdm-broadcast-paket-07-10/`

**Schritt 6 — Abnahme.**

```sh
node --check public/mockups/battle-mode.engine.js
node scripts/miss-alle-disziplinen.mjs 24 tdm battlefield mini-dm > /tmp/nachher.txt
diff /tmp/vorher.txt /tmp/nachher.txt
node scripts/miss-ticker-dichte.mjs tdm,battlefield --schranke 30
node scripts/verify-tdm-broadcast-paket-07-10.mjs
node scripts/verify-standkonsistenz-30-09.mjs tdm
```

Erwartung: Das Diff ist **leer**. Der Ticker liegt bei TDM um 23,5, bei Battlefield um 8,9, die
Protokoll-Zahlen bei 1455 und 303 wie vorher. Alle Prüfungen der neuen Sonde bestehen. Dazu
die vorhandenen Arena-Tests (`npx vitest run tests/arena-*.test.ts`) als Rauchtest, falls einer
Kampf-DOM-Text liest. Gefunden wurde keiner: `kmitte`, `klsuffix` und „Lebende“ kommen nur in
den beiden Sichtprüf-Sonden vom 30.09. vor, die nichts fest prüfen.

Eine Pp-Messung (`messe-arena-einfluss.mjs tdm`) ist für Klasse A nicht nötig. Weil
`miss-alle-disziplinen.mjs` und `messe-arena-einfluss.mjs` denselben stummen Pfad nehmen
(`M.lauf()` mit `stumm=true`, Kommentar Z. 15870), ist sie durch das leere Diff mit abgedeckt. Wer sie trotzdem dokumentieren will, fährt sie vorher und nachher und
hängt das (leere) Diff an.

**Schritt 7 — Commit-Text** im Stil der Pakete A/C: Problem, Ursache mit Fundstelle, die Fixes
T1/S1–S3, Validierung mit Zahlen vorher und nachher, Klasse A, und der Verweis auf dieses
Dokument. Zusätzlich in `f1-broadcast-audit-runde-2-30-09.md` unter Punkt 8 einen Ein-Satz-
Nachtrag „Regression durch `0fd081b3d`, behoben durch …“, damit die Zahl 23 dort nicht weiter
als gültig dasteht.

---

## 6. Aufwand und Reihenfolge

| Schritt | Aufwand |
|---|---|
| T1 | klein, zwei Aufrufstellen plus Kommentare |
| S1–S3 | klein, eine neue Hilfsfunktion, drei Textstellen |
| Sonde plus Schranke | mittel, der größte Posten. Die Wegwerf-Sonde dieses Plans ist die Vorlage |
| Abnahme | `miss-alle-disziplinen` für drei Arena-Disziplinen dauert, OOM-Risiko s. Schritt 0 |

Reihenfolge wie in Abschnitt 5. T1 zuerst, weil es den größten sichtbaren Gewinn bringt und für
sich allein abnehmbar ist.

---

## Quellen im Repo

`docs/design/f1-broadcast-audit-runde-2-30-09.md` (Punkte 3, 8, 17; Tabellen 6.1, 6.3),
Commits `6db278bc` (Punkt 8), `0fd081b3d` (C3, Regression), `636f065f` (Punkt 3),
`17a87ae9`/`86fde7fb` (Pakete A/C, Stilvorlage), `docs/design/tennis-nachtkonzept-03-10.md`
(Klassenschema, T-N1), `docs/design/stand-aller-disziplinen.md` (TDM rho je Spiel 0,306–0,326,
Pp-Abweichung 51,4, beides von diesem Paket unberührt), `scripts/miss-ticker-dichte.mjs`,
`scripts/verify-standkonsistenz-30-09.mjs`, `scripts/verify-broadcast-paket-a-06-10.mjs`.
