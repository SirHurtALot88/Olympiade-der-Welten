# Time-Trial-Broadcast-Paket — Plan (07.10.)

**Nachtrag nach Umsetzung:** F1 und T1 wie geplant umgesetzt, keine Abweichung. Gemessen an der
echten Engine (nicht nur an der Kopie): Time-Trial 1087 → 42 Ticker-Zeilen (557,4 → 21,5/min),
Protokoll unveraendert 83, rho bit-identisch (n=24 und n=12, Diffs leer), Spurt/Staffel/Takeshi/
Climbing bestehen weiterhin (n=12), `pruefe-bahn-alternativ-isolation.mjs` weiterhin "ISOLATION
NACHGEWIESEN". Neue Sonde `scripts/verify-time-trial-broadcast-paket-07-10.mjs`, alle Pruefungen
bestanden, TDM-/Breaking-Sonde liefen als Rauchtest sauber mit. PR folgt.

**Reiner Plan, kein Code geändert.** Auftrag: die Ticker-Flut beim Time-Trial (aus einer
früheren Session „rund 557 Zeilen je Minute, nach der Ziellinie laufen ~1000 Zeilen nach“,
Verdacht: `e0fb49da` „Alternativ-Rechner“ leert ein „schon gemeldet“-Flag)
**selbst nachmessen**, die Ursache im Code finden und ein Paket im Stil des TDM- und des
Breaking-Pakets (`tdm-broadcast-paket-plan-07-10.md`, PR #1157;
`breaking-broadcast-paket-plan-07-10.md`, PR #1158) entwerfen. Gemessen wurde auf `main` bei
`0916bee2`. Die Disziplin-ID ist `time-trial` (`official-discipline-weights.ts`), Chassis Bahn.

Vorweg das Wichtigste: **Die Zahl stimmt, und der Verdacht stimmt, aber nur zur Hälfte.**
`e0fb49da` ist der Auslöser, doch `bahnZzGemeldet` ist nur eines von rund 35 Anzeige-Globals,
die dabei verloren gehen. Den eigentlichen Schaden richtet `bahnEndeGemeldet` an: Weil dieses
Flag mit zurückgesetzt wird, wird aus einer einmaligen Nachmeldung eine **Endlosschleife je
Frame**. Darunter liegt eine **zweite, ältere Regression**, dieselbe `kind`-Falle aus Merge
`0fd081b3d` (C3, 01.10.), die schon TDM und Breaking getroffen hat. Sie allein hebt Time-Trial
über die 30er-Schranke. Und das Leck ist kein reines Time-Trial-Problem: Es trifft **alle vier
Bahn-Disziplinen mit Alternativ-Rechner** und friert die Seite nach dem Zieleinlauf auf
0,6–1,8 Bilder je Sekunde ein.

---

## 0. Kurzfassung

| | vor `0fd081b3d` (C3) | nach C3 / vor `e0fb49da` | `main` heute | nach F1 | nach F1 + T1 (dieses Paket) |
|---|---:|---:|---:|---:|---:|
| Ticker-Zeilen, ganzes Spiel (Sendezeit 1:57) | 40 | 62 | **1087** | 62 | **42** |
| Ticker-Zeilen je Minute | 20,5 | 31,8 | **557,4** | 31,8 | **21,5** |
| Protokoll-Zeilen | 83 | 83 | **1108** | 83 | 83 |
| Zeilen nach dem Endstand | 0 | 0 | **1025** (41 Zyklen à 25) | 0 | 0 |
| Echtzeit: neue Tickerzeilen in 5 s nach dem Endstand | — | — | **200** | 0 | 0 |
| Echtzeit: Bilder je Sekunde nach dem Endstand | — | — | **1,6** | 38,2 | 36,6 |
| rho je Spiel / Saison, n=24 | — | — | 0,923 / 0,902 | bit-identisch | **bit-identisch** |
| Pp-Abweichung, n=48, zwei Saatstämme | — | — | 21,5 / 24,2 | **identisch** (beide Stämme) | identisch (stummer Pfad, T1 dort wirkungslos) |

(Alle Zahlen sind gemessen, die Spalten „nach F1“ und „nach F1 + T1“ an gepatchten **Kopien** der
Engine, s. Abschnitt 1. Die historischen Spalten stammen aus Kopien von `0fd081b3d^`,
`0fd081b3d`, `e0fb49da^` und `e0fb49da`.)

* **Leck 1, die Flut (`e0fb49da`, 01.10. 22:51): bestätigt, aber anders als vermutet.**
  `renderEndstandBahn()` ruft seit dem Alternativ-Rechner `bahnLauf()` auf, beim Time-Trial
  12-mal. `bahnLauf()` baut über `bauSpurt()` jedes Mal ein neues Rennen. `bauSpurt()` setzt
  dabei rund 35 Anzeige-Globals zurück, `MOTOREN[bahn].sichern()/zurueck()` stellt davon
  **kein einziges** wieder her. Darunter ist `bahnZzGemeldet`. Deshalb meldet der nächste Frame
  alle 24 Zwischenzeiten erneut. Darunter ist aber auch **`bahnEndeGemeldet`**. Deshalb
  feuert der nächste Frame auch den Endstand-Zweig erneut, also die Siegerzeile,
  `renderEndstandBahn()` und 12 neue Zweitläufe, die die Flags wieder leeren. Das ergibt eine
  Schleife je Frame, **ohne Ende**: Bei der Bahn bleibt `running` nach `done` auf `true`.
* **Leck 2, die Grundlast (`0fd081b3d`, C3, 01.10. 17:12): die `kind`-Falle zum dritten Mal.**
  `kind="einbruch"` steht beim „bricht ein“ bedingungslos (Z. 39552). Der Kommentar direkt
  darüber sagt aber: „jeder andere Einbruch wäre wieder Protokoll“. Damit schlägt `kind` das
  Zeilenbudget, und alle 24 Einbrüche stehen im sichtbaren Ticker. Das ergibt 31,8 statt
  20,5 je Minute.
* **Paket: zwei Eingriffe, beide Klasse A.** F1 nimmt den Anzeige-Zustand der Bahn in
  `sichern()/zurueck()` mit auf. T1 übergibt `kind` nur beim Einbruch des Führenden, also nur
  dort, wo auch `big` gilt. Damit liegt Time-Trial bei **21,5 Zeilen je Minute** (Schranke 30).
  rho ist an der Kopie bit-identisch (n=24 und n=12, Diff leer), das Protokoll bleibt
  Zeile für Zeile gleich. Eine Freigabe durch Chris ist nicht nötig.

---

## 1. Wie gemessen wurde

* **Ticker, deterministisch (Hauptzahl).** `node scripts/miss-ticker-dichte.mjs time-trial
  --zeilen … --schranke 30`, unverändert aus dem Repo. Die Sonde fährt `sondenLauf(60)` in
  festen Sechzigstel-Schritten bis `#endstand` sichtbar wird und zählt per MutationObserver
  jede neue Zeile in `#feed` und `#protokoll`. Ergebnis `main`: **1087 Zeilen in 1:57, 557,4
  je Minute**, Exit 1.
* **Zeilen inspiziert.** Die JSON-Ausgabe von `--zeilen` wurde nach Zeitstempel und Text
  gruppiert (Abschnitt 2.1).
* **Echtzeit-Gegenprobe (Wegwerf-Sonde im Scratchpad).** Die Frage war, ob die Flut ein
  Artefakt von `sondenLauf()` ist, das `updateHudBahn()` bedingungslos aufruft, oder ob sie
  auch im echten `loop()` auftritt. Dazu: Vorlauf per `sondenLauf(6600)` bis kurz vor Schluss,
  dann `sondenAus()` und ein Klick auf `#play`, also echte Wanduhr und `requestAnimationFrame`.
  Gemessen wurden die neuen Zeilen und die Frames in den 5 s nach dem Endstand.
* **Fix-Vorhersage an Kopien.** Eine Scratch-Wurzel, deren `public/` bis auf
  `mockups/battle-mode.engine.js` aus Symlinks auf das Repo besteht, dazu Kopien der Skripte,
  `scripts/lib/` und ein Symlink auf `data/generated/kaderfamilie-live-save.json`. Ohne diesen
  Symlink fällt `miss-alle-disziplinen.mjs` stillschweigend auf synthetische Kader zurück und
  vergleicht Äpfel mit Birnen. Der erste Lauf tat genau das und lieferte deshalb ein falsches
  „Diff“. Varianten: F1, F1+T1, F1+T1+T2. Historische Stände: Engine **und** HTML aus
  `git show <commit>:…`.
* **Wertung.** `miss-alle-disziplinen.mjs 24 time-trial` und `… 12 time-trial` je auf `main`
  und an der Kopie, `diff` der kompletten Ausgabe. `messe-arena-einfluss.mjs time-trial 48`
  ohne und mit `--saat-versatz=10000000` auf `main` und an der F1-Kopie.
* **Kosten eines Alternativ-Rechner-Durchgangs.** `window.__arena.bahnLauf(d, saat)` fünfmal
  gemittelt, multipliziert mit der Zahl der Zweitläufe, die
  `pruefe-bahn-alternativ-isolation.mjs` je Disziplin ausweist.

---

## 2. Leck 1 — die Flut nach dem Zieleinlauf

### 2.1 Was im Ticker steht (`main`, Standardkader)

| Abschnitt | Zeilen | Inhalt |
|---|---:|---|
| 0:16 – 1:56, das Rennen | 62 | 24 × „X an ZZ1/ZZ2: …“, 24 × „bricht ein“, 12 × „im Ziel“, 1 × „fängt sich“, 1 × „… gewinnt 0:1 nach Zeitsumme“ |
| 1:56, **nach** dem Endstand | **1025** | 41 identische Zyklen à 25 Zeilen: alle 24 Zwischenzeiten-Zeilen (ZZ1 aller 12, dann ZZ2 aller 12), dann wieder „Armageddon Aftermath gewinnt 0:1 nach Zeitsumme“ |

Nur 80 verschiedene Texte stehen in 1087 Zeilen. Jede Zwischenzeit kommt 41- bis 42-mal vor.
Der Zeitstempel bleibt bei 1:56 stehen, weil `rennT` nach `done` nicht mehr wächst. Die 41
Zyklen sind genau die Ticks, die im letzten 60er-Schritt der Sonde nach dem Zieleinlauf noch
übrig waren: ein Zyklus je Tick. Die Sonde bricht erst danach ab. Im echten Spiel läuft die
Schleife weiter, solange die Seite offen ist.

Die Rangangaben in den Wiederholungen sind übrigens **andere** als im Rennen. Im Rennen
hieß es „Ralazar an ZZ1: 2. · +4,2 s“, in der Wiederholung „6. · +5,5 s“ bei Draco statt
„Bestzeit“. Der Grund: In der Nachmeldung kennen alle Fahrer schon alle Zwischenzeiten, der
Vergleich „vor dem Überfahren“ (Kommentar Z. 33797) ist damit hinfällig. Die Flut ist also
nicht nur zu viel, sie **widerspricht** auch dem, was der Zuschauer im Rennen gelesen hat.

### 2.2 Echtzeit: kein Sonden-Artefakt

| Disziplin (`main`) | neue Tickerzeilen in 5 s nach dem Endstand | Bilder je Sekunde danach | an der F1-Kopie |
|---|---:|---:|---|
| time-trial | **200** | **1,6** | 0 Zeilen, 38,2 fps |
| spurt | 4 | **0,8** | 0 Zeilen, 36,2 fps |
| staffel | 9 | **1,8** | 0 Zeilen, 18,2 fps |
| takeshis-castle | 3 | **0,6** | 0 Zeilen, 11,2 fps |

Kosten eines vollständigen Alternativ-Rechner-Durchgangs (headless, CPU-abhängig, Größenordnung):

| Disziplin | ein `bahnLauf()` | Zweitläufe je Durchgang | je Durchgang |
|---|---:|---:|---:|
| time-trial | 62 ms | 12 | **0,74 s** |
| spurt | 109 ms | 48 | **5,2 s** |
| staffel | 29 ms | 72 | **2,1 s** |
| takeshis-castle | 113 ms | 72 | **8,1 s** |

Auf `main` läuft dieser Durchgang **in jedem Frame**, solange der Endstand offen ist. Daher die
Bildraten unter 2. Bei Spurt, Staffel und Takeshi gibt es keine Zwischenzeiten-Zeilen, also
wiederholt sich dort nur die Siegerzeile, dafür langsamer. In der Ticker-Sonde sieht das so aus:
Spurt hat 31, Staffel 56 und Takeshi 13 identische Siegerzeilen im Protokoll, gemessen mit
derselben Sonde, `--zeilen`.

### 2.3 Ursache im Code

**Die Kette, Schritt für Schritt** (`public/mockups/battle-mode.engine.js`, Stand `0916bee2`):

1. `stepSpurt()` setzt bei der Bahn `done=true` (Z. 40463), ruft aber **nicht** `finish()` auf.
   `running` bleibt `true` (`finish()` setzt `running=false` nur im Kampf, Z. 42594).
   `loop()` (Z. 42804) ruft deshalb nach dem Zieleinlauf **jeden Frame** `updateHudBahn()`
   (Z. 42818), und `sondenLauf()` (Z. 48293) tut es ohnehin bedingungslos.
2. `updateHudBahn()` (Z. 33594) meldet jede Zwischenzeit einmal, abgesichert durch
   `bahnZzGemeldet` (Deklaration Z. 33316, Block Z. 33789–33814), und den Endstand einmal,
   abgesichert durch `bahnEndeGemeldet` (Deklaration Z. 33284, Zweig Z. 33917–33930). Der
   Endstand-Zweig ruft `renderEndstandBahn()` (Z. 33929).
3. `renderEndstandBahn()` (Z. 44925) ruft seit `e0fb49da` `renderAlternativRechner()`
   (Z. 45011) → `bahnAlternativZeilen()` (Z. 44819) → beim Time-Trial je Heimläufer und
   Alternativplan `bahnLauf(bd, bahnAktuelleSaat, …)` (Z. 44836), also 6 × 2 = 12 Zweitläufe.
4. `bahnLauf()` (Z. 46695) macht `M.sichern(); M.vorher(); M.bau(saat)`, rechnet stumm durch
   und macht `M.zurueck(gesichert)` (Z. 46753). `M.bau()` ist `bauSpurt()` (Z. 38463).
5. `bauSpurt()` setzt neben dem Rennzustand **den gesamten Anzeige-Zustand** der Bahn zurück
   (Z. 38464–38540): unter anderem `bahnEndeGemeldet=false` (Z. 38518),
   `bahnZzGemeldet=new Set()` (Z. 38523), `ttAmpelGemeldet`, `bahnHotSeatId`, `cam`/`camR`,
   `bahnFokus`/`bahnFokusAuto`/`bahnWahl`, `fortschrittVerlauf`, `bahnKursName`/
   `bahnFallenTypen` und die Staffel- und Spurt-Merker. Das ist richtig, **wenn ein neues
   echtes Rennen beginnt**: Kommentar Z. 38519–38521, „jede dieser Anzeigen darf beim
   nächsten Rennen nicht mehr vom vorigen wissen“.
6. `MOTOREN[bahn].sichern()` (Z. 46558) sichert aber nur
   `{disc, bahnDisc, LAEUFER, rennFertig, rennT, done}`. **Kein Anzeige-Global** kommt zurück.
   Nach `M.zurueck()` steht also das echte, beendete Rennen wieder da (LAEUFER mit allen
   `u.zz[]`, `done=true`), aber mit **leeren** Merkern.
7. Nächster Frame: Der Zwischenzeiten-Block findet 24 Paare, die „noch nicht gemeldet“ sind,
   und schreibt 24 Zeilen. Der Endstand-Zweig findet `done && !bahnEndeGemeldet` und schreibt
   die Siegerzeile, dann folgt `renderEndstandBahn()`, dann 12 Zweitläufe, dann zurück zu
   Schritt 5. **Die Schleife schließt sich.**

**Bewertung des Verdachts.** Commit und Flag sind richtig benannt, doch `bahnZzGemeldet`
allein hätte genau **eine** Nachmeldung von 24 Zeilen verursacht. Endlos wird sie erst
durch `bahnEndeGemeldet`. Ein Fix, der nur `bahnZzGemeldet` rettet, ließe die Schleife (und
die 1–2 fps) bestehen, nur ohne ZZ-Zeilen. Dass `bahnZzGemeldet` in `bau()` geleert wird,
ist für sich **kein** Fehler. Der Fehler ist, dass ein Mess-Zweitlauf aus dem **Anzeige-Pfad**
heraus `bau()` aufruft, während das Sichern/Zurücksetzen nur den Simulationszustand kennt.

**Warum die Isolationssonde es nicht gefunden hat.** `scripts/pruefe-bahn-alternativ-
isolation.mjs` meldet auf `main` „ISOLATION NACHGEWIESEN“ und hat damit recht für das, was sie
prüft: S1 (das beendete Rennen) und S2 (das nächste) sind bit-identisch, `seed` wirkt nicht
nach. Sie prüft aber nur **Simulationswerte**. Den Anzeige-Zustand und einen zweiten Durchlauf
durch `updateHudBahn()` nach dem Zweitlauf prüft sie nie. Der Kommentar in Z. 44765–44770
behauptet, `bahnLauf()` sichere „den kompletten Renn-Zustand“. Für die Wertung stimmt das,
für die Anzeige nicht.

**Weitere sichtbare Folgen desselben Lecks**, gelesen im Code, nicht einzeln gemessen. Bei
Time-Trial springen nach dem Zieleinlauf Kamera und Fokus auf den Start (`cam`, `camR`,
`bahnFokus`), eine Fokuswahl des Zuschauers geht verloren. Bei Takeshi kommen
`bahnKursName`/`bahnFallenTypen` aus der **letzten Probe-Saat** zurück (Kursname im HUD und
Fallentypen in der Zeichnung nach dem Endstand), bei der Staffel wird `fortschrittVerlauf`
geleert. F1 behebt das alles mit, weil es den ganzen Anzeige-Zustand zurückstellt und nicht
nur zwei Flags.

---

## 3. Leck 2 — die Grundlast (C3-Regression, dieselbe wie bei TDM und Breaking)

Nach F1 bleiben **62 Zeilen in 1:57 = 31,8 je Minute**, knapp über der Schranke. Dieselbe Zahl
liefert die Sonde für `0fd081b3d` und für `e0fb49da^`. Vor `0fd081b3d` waren es **40 Zeilen =
20,5 je Minute**.

`git blame` zeigt beide `kind`-Argumente der Bahn-Ticker als `0fd081b3d` (C3, 01.10. 17:12):

```js
// Z. 39551–39552, stepSpurt(), Einbruch -- gilt fuer jede Bahn mit Puste-Modell
feed(u.seite,u.n+" bricht ein — Puste leer bei "+Math.round(u.pos*100)+" % der Strecke.",
  bahnRangliste().reihe[0]?.id===u.id,undefined,"einbruch");

// Z. 33810–33812, updateHudBahn(), Zwischenzeit (TT-1)
feed(u.seite,u.n+" an ZZ"+(ci+1)+": "+…,
  neueBest,undefined,"bestzeit");
```

`feed()` stuft eine Zeile über `big||kind?"ereignis":stufe` ein (Z. 42542). Mit gesetztem
`kind` ist sie also **immer** ein Ereignis und umgeht das Zeilenbudget (28 je Minute,
`TICKER_ZEILEN_JE_MIN` Z. 42473, `tickerZeigt()` Z. 42475). Genau diese Falle steht seit dem
TDM-Paket im Kopfkommentar von `feed()`: „kind nur bei wirklichem Banner (big) übergeben, nie
bedingungslos“. Der Kommentar über der Einbruch-Zeile sagt dasselbe für diesen Fall: „big nur,
wenn der FÜHRENDE einbricht — jeder andere Einbruch wäre wieder Protokoll“.

Zusammensetzung nach F1 (62 Zeilen im Ticker / 83 im Protokoll):

| Art | Ticker | Protokoll | Stufe heute |
|---|---:|---:|---|
| Zwischenzeit „an ZZn“ | 24 | 24 | Ereignis (`kind="bestzeit"` bedingungslos) |
| „bricht ein“ | 24 | 24 | Ereignis (`kind="einbruch"` bedingungslos) |
| „im Ziel“ | 12 | 12 | Ereignis |
| „fängt sich wieder“ | 1 | 22 | normal, also budgetiert (das Budget arbeitet, aber die Ereignisse fressen es auf) |
| Siegerzeile | 1 | 1 | Ereignis |

### 3.1 Was die Varianten bringen (gemessen an Kopien, alle mit F1)

| Variante | Time-Trial Ticker | je min | Protokoll | Was fällt aus dem Ticker |
|---|---:|---:|---:|---|
| F1 allein | 62 | 31,8 | 83 | — |
| **F1 + T1**: `kind` beim Einbruch nur, wenn der Fahrer führt | **42** | **21,5** | 83 | 20 von 24 „bricht ein“ und zusätzlich 1 „fängt sich“ (werden budgetiert, statt durchzurutschen) |
| F1 + T1 + T2: zusätzlich `kind` bei der Zwischenzeit nur bei `neueBest` | 40 | 20,5 | 83 | **12 von 24 Zwischenzeiten** |

**Empfehlung: T1 ja, T2 nein.** T2 stellt zwar zeichengenau den Stand vor C3 her (40 Zeilen),
spart aber nur eine Zeile je Minute und zahlt dafür mit der **Hälfte der Zwischenzeiten**: Im
Budget-Wettbewerb gewinnen dann „bricht ein“-Zeilen gegen „Greenkraut an ZZ2: 3. · +16,1 s“.
Zwischenzeiten sind aber das Kernelement einer Zeitfahr-Übertragung. Dafür wurde TT-1 gebaut
(Abschnitt 2.3 des Nachtkonzepts). Mit T1 allein stehen alle 24 Zwischenzeiten und alle 12
Zieleinläufe im Ticker, und der Rest hält sich ans Budget.

**T1 wirkt auf alle Bahnen mit Puste-Modell** (die Zeile steht in `stepSpurt()`, nicht im
Time-Trial-Zweig). Gemessen an der Kopie F1+T1, verglichen mit `main` abzüglich der
Endlos-Siegerzeilen:

| Disziplin | `main` (Ticker / Protokoll) | F1 + T1 | Protokoll ohne Schleife |
|---|---|---|---|
| spurt | 79 / 86 (21,9/min) | 49 / 56 (**13,6/min**) | 56 = 86 − 30 Wiederholungen |
| staffel | 78 / 78 (23,5/min) | 23 / 23 (**6,9/min**) | 23 = 78 − 55 Wiederholungen |
| takeshis-castle | 48 / 162 (47,2/min) | 32 / 150 (**31,5/min**) | 150 = 162 − 12 Wiederholungen |
| climbing (kein Alternativ-Rechner) | 12 / 61 (15,3/min) | 12 / 61 (15,3/min) | unverändert |

Das Protokoll verliert in allen Fällen genau die Wiederholungen der Schleife und sonst nichts.
Takeshi bleibt mit 31,5 knapp über der Schranke. Das ist ein eigener Fall (114–118 Zeilen nur
im Protokoll, Massenzeilen an den Fallen) und gehört nicht in dieses Paket, s. Abschnitt 5.

---

## 4. Das Paket

Ziel nach dem Paket: **Nach dem Zieleinlauf schreibt der Ticker keine einzige Zeile mehr, die
Seite rechnet nach dem Endstand nicht mehr in jedem Frame 12 bis 72 Rennen nach, und der
sichtbare Ticker des Time-Trials liegt mit allen Zwischenzeiten unter 30 Zeilen je Minute.**

| # | Eingriff | Funktion / Stelle | Klasse | Wirkung (gemessen an der Kopie) | Risiko |
|---|---|---|---|---|---|
| **F1** | Anzeige-Zustand der Bahn in `MOTOREN[bahn].sichern()/zurueck()` mitnehmen: ein Paar `bahnAnzeigeSichern()`/`bahnAnzeigeZurueck(a)` über **genau die Globals, die `bauSpurt()` zurücksetzt**, außer `seed` | `MOTOREN[bd]` Z. 46556–46566, neue Helfer direkt darüber | A | Time-Trial 1087 → **62** Zeilen. Nach dem Endstand 0 neue Zeilen statt 1025 (Sonde) bzw. 200 je 5 s (Echtzeit). fps nach Endstand 1,6 → 38,2. Spurt, Staffel und Takeshi ebenfalls schleifenfrei | keins, s. 4.1 |
| **T1** | `kind="einbruch"` nur, wenn der Fahrer führt (dieselbe Bedingung wie `big`), sonst `undefined` | `stepSpurt()` Z. 39551–39552 | A | Time-Trial 62 → **42** Zeilen, **21,5/min**. Protokoll unverändert 83 | keins, s. 4.1 |
| T2 *(verworfen)* | `kind="bestzeit"` nur bei `neueBest` | `updateHudBahn()` Z. 33812 | A | 42 → 40, kostet 12 von 24 Zwischenzeiten im Ticker | inhaltlich falsch für ein Zeitfahren, s. 3.1 |

### 4.1 Warum das sicher reine Anzeige ist

* **F1 ändert nichts an dem, was gemessen wird.** Jeder Mess- und Wertungspfad
  (`disziplinProbe`, `window.__arena.spiele*`, `bahnLauf`, `messe-arena-einfluss`) liest
  `wert()` bzw. `bahnRangliste()` **vor** `M.zurueck()`. F1 ändert nur, was **nach** dem
  Zurücksetzen in Anzeige-Variablen steht. Das nächste `bau()` setzt sie ohnehin neu.
  `seed` bleibt bewusst draußen, wie bisher und mit derselben Begründung wie im Kommentar
  Z. 44775–44784.
* **Die Globals werden in `bauSpurt()` neu zugewiesen, nicht verändert** (`new Set()`,
  `{zoom:1,cx:0.5}`, `[]`, `null`). Ein Referenz-Schnappschuss reicht also. Der Zweitlauf
  schreibt nur in die **neuen** Objekte, die alten liegen unberührt im Schnappschuss. Beim
  Bau ist für jedes der 35 Globals zu prüfen, ob es irgendwo **in place** verändert wird, bevor
  `bauSpurt()` es neu zuweist. Bekannt ist ein Fall: `floats.length=0`, der aber schon heute in
  `zurueck()` steht und nicht zum Anzeige-Satz gehört. Wird ein weiteres gefunden, kommt eine
  flache Kopie in `bahnAnzeigeSichern()`.
* **Belegt, nicht nur hergeleitet.** An der Kopie mit F1 und an der Kopie mit F1+T1 gemessen:
  `miss-alle-disziplinen.mjs 24 time-trial` und `… 12 time-trial` liefern **exakt** dieselbe
  Ausgabe wie `main` (Diff leer). Bei n=24 sind das rho je Spiel 0,923 und rho Saison 0,902,
  bei n=12 0,914 / 0,895, Abnahme jeweils „bestanden“. `messe-arena-einfluss.mjs time-trial 48`
  ohne und mit `--saat-versatz=10000000` an der F1-Kopie: 21,5 / 24,2 Pp, beide
  Attributtabellen Zeichen für Zeichen wie `main`. Das Diff zeigt nur die Kopfzeilen
  (Dateipfad, Laufzeit in Sekunden). `pruefe-bahn-alternativ-isolation.mjs` meldet an der
  Kopie weiterhin „ISOLATION NACHGEWIESEN“ für alle vier Bahnen.
* **T1** ändert nur das fünfte Argument eines `feed()`-Aufrufs. `feed()` kehrt im stummen
  Messpfad in der ersten Zeile zurück (`if(stumm)return;`). `kind` wird außer in der
  Einstufung (Z. 42542) nur innerhalb von `if(big){…}` gelesen (HIGHLIGHTS, Titel, Sting), und
  `big` ist genau dann wahr, wenn T1 `kind` weiter übergibt. Der `if(big)`-Zweig bleibt damit
  Zeichen für Zeichen gleich. `bahnRangliste()` (Z. 33252) ist rein lesend (sortiert eine Kopie
  von LAEUFER). Beim Bau das Ergebnis **einmal** in eine Konstante ziehen, damit es nicht
  zweimal berechnet wird (s. Schritt 2).
* **Klassifizierung.** Beide Eingriffe sind **Klasse A** (`tennis-nachtkonzept-03-10.md`,
  Klassenschema): reine Anzeige, kein `rr()`, kein Simulationsfeld, `wert()` und Rezept
  unangetastet, rho bit-identisch. Keine Klasse T: Nichts verzögert oder verlängert die
  Sendung. Eignungsmatrix und Pp-Budget werden nicht berührt (CLAUDE.md: Matrix gesperrt,
  Pp ≤ 25, Time-Trial liegt bei 21,5 / 24,2). Eine Freigabe durch Chris ist nicht nötig.

**Bewusst nicht im Paket:**

* **`running=false` bei Bahn-Ende** (also `finish()` auch für die Bahn). Das würde die
  Schleife ebenfalls unterbrechen, aber nur im echten `loop()`, nicht in `sondenLauf()`. Es
  ändert außerdem, was nach dem Zieleinlauf gezeichnet und aktualisiert wird (HUD,
  Schwebetexte, Play-Knopf). Größerer Radius, und es heilt das Symptom statt der Ursache.
  Das Leck im Anzeige-Zustand bliebe für jeden künftigen Aufrufer von `bahnLauf()` bestehen.
* **Nur `bahnZzGemeldet`/`bahnEndeGemeldet` retten.** Das genügt für den Ticker, aber Kamera,
  Fokus, Takeshi-Kurs und Staffel-Verlauf blieben nach dem Endstand falsch (2.3, letzter
  Absatz). F1 kostet nicht mehr als diese zwei Zeilen und ist vollständig.
* **T2**, s. 3.1.

---

## 5. Nebenbefunde, nicht Teil dieses Pakets

* **Der einmalige Ruckler am Rennende bleibt.** Nach F1 läuft der Alternativ-Rechner genau
  einmal, aber synchron im selben Frame wie der Endstand: headless 0,74 s bei Time-Trial,
  2,1 s bei Staffel, 5,2 s bei Spurt und 8,1 s bei Takeshi (2.2). Beim Time-Trial ist das ein
  kurzes Stocken beim Zieleinlauf, bei Spurt und Takeshi ein spürbares Einfrieren. Lösung für
  ein Folgepaket: den Rechner per `setTimeout(…,0)` hinter das erste Zeichnen des Endstands
  legen und die Zeilen je Rennen zwischenspeichern, oder bei Spurt, Staffel und Takeshi die
  Zahl der Saaten senken. Das ist eine eigene Runde mit eigener Messung.
* **Takeshi's Castle liegt nach diesem Paket bei 31,5 Zeilen je Minute** (vorher 47,2), also
  knapp über der Schranke. Der Rest ist ein eigener Fall (118 Zeilen nur im Protokoll), kein
  Leck.
* **`pruefe-bahn-alternativ-isolation.mjs` sollte den Anzeige-Zustand mitprüfen.** Vorschlag
  für Schritt 4: Nach dem Alternativ-Durchgang einmal `sondenLauf(5)` fahren und prüfen, dass
  keine neue Zeile in `#feed`/`#protokoll` erscheint.
* **Rangangaben in einer verspäteten Zwischenzeit-Meldung** wären falsch (2.1, letzter Absatz).
  Nach F1 gibt es keine verspätete Meldung mehr. Wer die Zwischenzeiten-Meldung je umbaut,
  sollte das wissen.

---

## 6. Schritt für Schritt

Ein Branch `time-trial-broadcast-paket-07-10`, je Schritt ein Commit.

**Schritt 0 — Nulllinie sichern (vor jeder Änderung).**

```sh
node scripts/miss-alle-disziplinen.mjs 24 time-trial > /tmp/vorher-24.txt
node scripts/miss-alle-disziplinen.mjs 12 time-trial > /tmp/vorher-12.txt
node scripts/miss-ticker-dichte.mjs time-trial,spurt,staffel,takeshis-castle,climbing --zeilen /tmp/ticker-vorher.json
```

Dauer: unter 10 s je `miss-alle`-Lauf, rund 3 min für die Ticker-Sonde, weil Spurt und
Staffel wegen der Schleife langsam laufen. Erwartet: rho 0,923/0,902 (n=24) und
0,914/0,895 (n=12). Ticker: Time-Trial 557,4, Spurt 21,9, Staffel 23,5, Takeshi 47,2,
Climbing 15,3.

**Schritt 1 — F1, Anzeige-Zustand sichern.** Direkt über `for(const bd of
Object.keys(BAHN_ART)){ MOTOREN[bd]={…` (Z. 46556):

```js
// ANZEIGE-ZUSTAND DER BAHN (Time-Trial-Broadcast-Paket 07.10., docs/design/time-trial-
// broadcast-paket-plan-07-10.md Abschnitt 2.3): genau die Globals, die bauSpurt() neben
// dem Rennzustand zuruecksetzt -- ohne `seed` (s. Alternativ-Rechner-Kommentar).
// Seit e0fb49da ruft renderEndstandBahn() bahnLauf() auf; ohne diese Sicherung leerte
// jeder Zweitlauf bahnEndeGemeldet/bahnZzGemeldet & Co., und updateHudBahn() meldete im
// naechsten Frame alles neu -- inkl. Endstand -> renderEndstandBahn() -> neue Zweitlaeufe:
// Endlosschleife je Frame (Time-Trial 1025 Zeilen nach dem Zieleinlauf, 1,6 fps).
// WER IN bauSpurt() EIN NEUES ANZEIGE-GLOBAL ZURUECKSETZT, TRAEGT ES HIER EIN.
function bahnAnzeigeSichern(){ return {fortschrittVerlauf, letzterBuehneBahnGrossT, …}; }
function bahnAnzeigeZurueck(a){ if(!a)return; fortschrittVerlauf=a.fortschrittVerlauf; … }
```

Dann `sichern:()=>({…, done, anzeige:bahnAnzeigeSichern()})` und in `zurueck` am Ende
`bahnAnzeigeZurueck(a.anzeige);`. Die Liste, wie an der Kopie verwendet (35 Einträge, aus
`bauSpurt()` Z. 38464–38540 abgelesen):

`fortschrittVerlauf, letzterBuehneBahnGrossT, bahnFallenTypen, bahnKursName, bahnKursChaos,
bahnGedraengeGemeldet, bahnKoennenGemeldet, bahnEndeGemeldet, bahnFuehrenderId,
bahnFuehrenderSeit, staffelFuehrendeSeite, bahnHotSeatId, bahnZzGemeldet, ttAmpelGemeldet,
ttRegieSeit, bahnBauchbindeIdx, bahnBauchbindeNaechste, bahnFalleGemeldet, bahnFalleAnzeige,
staffelAktivVorher, staffelWechselAnzeige, staffelVerlauf, staffelBeinMarken,
staffelAnkerGezeigt, staffelBeinDuellGemeldet, spurtStationBest, spurtFotofinishGezeigt,
spurtStationStats, cam, camR, bahnWahl, bahnFokus, bahnFokusAuto, ttPanelSig, routeCache`

Beim Bau gegenprüfen: `bauSpurt()` von Anfang bis Ende nach Zuweisungen an Modul-Variablen
absuchen (auch in `spurtSaeuleSetzen()`, das `bauSpurt()` aufruft) und die Liste damit
abgleichen. Zusätzlich eine Wächterzeile in die neue Sonde (Schritt 4, Prüfung g), damit ein
künftig vergessenes Global auffällt. Den Kommentar beim Alternativ-Rechner (Z. 44765–44770,
„sichert den kompletten Renn-Zustand“) um einen Satz ergänzen: Seit diesem Paket gilt das
auch für den Anzeige-Zustand.

**Schritt 2 — T1, Einbruch.** `stepSpurt()` Z. 39551–39552:

```js
const fuehrt=bahnRangliste().reihe[0]?.id===u.id;
feed(u.seite,u.n+" bricht ein — Puste leer bei "+Math.round(u.pos*100)+" % der Strecke.",
  fuehrt,undefined,fuehrt?"einbruch":undefined);
```

Kommentar im Stil von TDM-T1 und Breaking-T1 mit Verweis auf dieses Dokument und auf
`0fd081b3d`. Im Kopfkommentar von `feed()` (Z. 42440ff., „FALLE (zweimal
hineingelaufen …)“) ergänzen: „vierter Fall: Bahn-Einbruch, 07.10. behoben; die
Zwischenzeit-Zeile (TT-1) übergibt `kind` bewusst weiter bedingungslos, s. Plan 3.1.“ So
liest der nächste Agent die ZZ-Stelle nicht als übersehenen fünften Fall.

**Schritt 3 — Zwischenmessung.**

```sh
node --check public/mockups/battle-mode.engine.js
node scripts/miss-ticker-dichte.mjs time-trial --schranke 30
```

Erwartet: **42 Zeilen, 21,5 je Minute**, Protokoll 83, Exit 0.

**Schritt 4 — Sonde.** Neue Sonde **`scripts/verify-time-trial-broadcast-paket-07-10.mjs`**,
Bauart wie `verify-breaking-broadcast-paket-07-10.mjs` (eigener HTTP-Server über `public/`,
`sondenLauf()`, Produktionsmodus, Einlauf ausgeblendet, eine `evaluate()`-Schleife). Sie prüft
und kann bestehen oder durchfallen:

- (a) **kein Nachlauf (Sonde):** Nach dem ersten sichtbaren `#endstand` noch **600 Ticks**
  (10 s Sendezeit) per `sondenLauf()` weiterfahren. Danach dürfen **0** neue Zeilen in `#feed`
  und `#protokoll` stehen. Für `time-trial`, `spurt`, `staffel` und `takeshis-castle`.
- (b) **kein Nachlauf (Echtzeit):** Time-Trial mit Vorlauf `sondenLauf(6600)`, dann
  `sondenAus()`, `#play`, Endstand abwarten, 3 s Wanduhr. Erwartet sind 0 neue Zeilen und
  mindestens 10 `requestAnimationFrame` je Sekunde (gemessen 38; `main` 1,6). Die
  Frame-Schranke ist absichtlich locker, damit die Prüfung auf langsamen CI-Rechnern nicht
  flackert.
- (c) **jede Zwischenzeit genau einmal:** Jedes Paar „Name an ZZn“ kommt im Protokoll genau
  einmal vor (24 Zeilen bei 12 Fahrern × 2 Zwischenzeiten). Die Siegerzeile kommt genau
  einmal vor.
- (d) **Ticker:** Time-Trial ≤ 30 Zeilen je Minute Sendezeit (erwartet 21,5), alle 24
  Zwischenzeiten und alle 12 „im Ziel“ stehen im `#feed`, „bricht ein“ steht nur dann im
  `#feed` mit Banner, wenn der Fahrer geführt hat. Protokoll-Zeilenzahl = 83 (Standardkader).
- (e) **Anzeige-Zustand nach dem Alternativ-Rechner unverändert:** Vor und nach dem Endstand
  `window.__arena.bahnWahl`-artige Lesezugriffe bzw. `#esieger`-Text, Kursname (Takeshi) und
  den Kamerafokus vergleichen. Wenn es keinen Lesezugriff gibt, reicht ein Screenshot-Vergleich
  des `#p2 .frame` 1 s und 5 s nach dem Endstand (dasselbe Bild).
- (f) keine `pageerror`
- (g) **Wächter für F1:** im Browser `bauSpurt.toString()` nach `/\b([a-zA-Z_]\w*)=(?!=)/`
  durchsuchen und jedes gefundene Modul-Global, das weder im Rennzustand von `sichern()` noch
  in `bahnAnzeigeSichern()` steht und nicht `seed` ist, als Fehler melden. Falls das zu
  zerbrechlich ist: die Liste als Konstante exportieren und gegen eine im Skript gepflegte
  Liste prüfen.
- dazu zwei Screenshots des ganzen `#p2 .frame` (Endstand + 1 s, Endstand + 5 s) nach
  `tmp-ux-audit/time-trial-broadcast-paket-07-10/`

**Schritt 5 — Abnahme.**

```sh
node --check public/mockups/battle-mode.engine.js
node scripts/miss-alle-disziplinen.mjs 24 time-trial > /tmp/nachher-24.txt
node scripts/miss-alle-disziplinen.mjs 12 time-trial > /tmp/nachher-12.txt
diff /tmp/vorher-24.txt /tmp/nachher-24.txt
diff /tmp/vorher-12.txt /tmp/nachher-12.txt
node scripts/miss-alle-disziplinen.mjs 12 spurt staffel takeshis-castle climbing
node scripts/miss-ticker-dichte.mjs time-trial --schranke 30
node scripts/miss-ticker-dichte.mjs spurt,staffel,climbing --schranke 30
node scripts/pruefe-bahn-alternativ-isolation.mjs
node scripts/verify-time-trial-broadcast-paket-07-10.mjs
node scripts/verify-tdm-broadcast-paket-07-10.mjs
node scripts/verify-breaking-broadcast-paket-07-10.mjs
npx vitest run tests/spiele-bahn-invarianten.test.ts tests/arena-headless-runner.test.ts tests/mini-dm-ffa-pod-headless-runner.test.ts
```

Erwartet:

* Beide Diffs sind **leer** (an der Kopie bereits so gemessen, 4.1).
* Die übrigen Bahnen bestehen bei n=12 wie vorher. Vorher und nachher fahren und vergleichen,
  denn F1 berührt `MOTOREN` aller Bahnen.
* Time-Trial 21,5 je Minute, Exit 0. Spurt 13,6, Staffel 6,9, Climbing 15,3, Exit 0.
  Takeshi ist bewusst **nicht** in der Schranken-Zeile (31,5, Nebenbefund 5).
* Die Isolationssonde meldet weiterhin „ISOLATION NACHGEWIESEN“.
* Die neue Sonde ist komplett grün. TDM- und Breaking-Sonde laufen als Rauchtest mit, weil
  `feed()` geteilt ist. Vitest ist grün, `spiele-bahn-invarianten` ist der wichtigste davon,
  weil er die Bahn-Motoren direkt nutzt.
* Pp: Für Klasse A nicht nötig, der stumme Pfad ist durch die leeren Diffs abgedeckt. Wer es
  dokumentieren will: `messe-arena-einfluss.mjs time-trial 48` mit und ohne
  `--saat-versatz=10000000`, Sollwert 21,5 / 24,2 Pp, je rund 3,5 min.

**Schritt 6 — Commit-Text** im Stil von TDM und Breaking: Problem (557 je Minute, 1025 Zeilen
nach dem Zieleinlauf, 1–2 fps auf allen vier Bahnen mit Alternativ-Rechner), Ursache mit
Fundstellen (Kette aus 2.3, `0fd081b3d` für T1), Fixes F1/T1, Validierung mit Zahlen vorher
und nachher, Klasse A, Verweis auf dieses Dokument. Dazu in
`f1-broadcast-audit-runde-2-30-09.md` bei Punkt 8 ein Ein-Satz-Nachtrag: Time-Trial war nach
dem 01.10. doppelt regrediert (C3 auf 31,8, `e0fb49da` auf 557), beides behoben durch dieses
Paket.

---

## 7. Aufwand und Reihenfolge

| Schritt | Aufwand |
|---|---|
| F1 | klein im Code (zwei Helfer, zwei Zeilen in `MOTOREN`), dazu sorgfältiger Abgleich der Liste mit `bauSpurt()` |
| T1 | klein, eine Aufrufstelle plus Kommentare |
| Sonde | mittel, der größte Posten. Die Wegwerf-Sonden dieses Plans (Echtzeit-Nachlauf, Zeilen-Gruppierung) sind die Vorlage |
| Abnahme | rund 10 min, davon die meiste Zeit Ticker-Sonde und Isolationssonde |

F1 zuerst. Es beseitigt 96 % der Zeilen und den Einbruch der Bildrate auf vier Disziplinen,
und es ist für sich allein abnehmbar. T1 danach. Es bringt Time-Trial unter die Schranke und
ist unabhängig von F1 rücknehmbar.

---

## Quellen im Repo

`docs/design/tdm-broadcast-paket-plan-07-10.md` und `docs/design/breaking-broadcast-paket-plan-
07-10.md` (Stilvorlage, T1-Muster, `kind`-Falle), `docs/design/f1-broadcast-audit-runde-2-30-09.md`
(Punkt 8, Zielband ≤ 30), `docs/design/fable-ideen-bahn-30-09.md` Abschnitt 1.3
(Alternativ-Rechner), `docs/design/time-trial-nachtkonzept-03-10.md` (J2-Ampel, TT-Bezüge),
`docs/design/tennis-nachtkonzept-03-10.md` (Klassenschema). Commits: `e0fb49da` (Alternativ-
Rechner, Merge #1109), `0fd081b3d` (C3, `kind`-Regression), `6003b0e74` (TT-1 Zwischenzeiten),
`15322d26` (Einbruch-Zeile), `ac863426` (TDM-Paket, PR #1157), `0916bee2` (Breaking-Paket,
PR #1158). Skripte: `scripts/miss-ticker-dichte.mjs`, `scripts/miss-alle-disziplinen.mjs`,
`scripts/messe-arena-einfluss.mjs`, `scripts/pruefe-bahn-alternativ-isolation.mjs`,
`scripts/verify-breaking-broadcast-paket-07-10.mjs`.
