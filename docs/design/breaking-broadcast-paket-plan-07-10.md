# Breaking-Broadcast-Paket — Plan (07.10.)

**Nachtrag (07.10., Umsetzung): T1, B1 und S1–S3 sind gebaut, gemessen und committet** (Branch
`breaking-broadcast-paket-07-10`). B2 (kürzere Aufgabe-Banner) blieb wie geplant aussen vor --
22-25 % Banner-Anteil liegt knapp über dem Zielband, aber das ist für Breaking laut Plan
(Abschnitt 2.3) ehrlich so. Gemessen nach dem Bau: Ticker 169,7 → 29,1/min (Vorhersage 29,2-29,6
traf), `miss-alle-disziplinen.mjs 24 breaking` bit-identisch (rho 0,801/0,944, Diff leer); neue
Sonde `scripts/verify-breaking-broadcast-paket-07-10.mjs` komplett grün (einzelner Standardkader-
Lauf statt der fünf Diagnose-Aufstellungen -- seit S2 ist `#kmitte` strukturell, nicht nur
gemessen, dieselbe Quelle wie `#score`, s. Begründung in der Sonde selbst); `verify-tdm-
broadcast-paket-07-10.mjs` als Rauchtest weiterhin grün (feed()/updateHud* werden geteilt).
Screenshot bestätigt visuell: "Verbliebene" statt "Punkte", "4/6 AUSGESCHIEDEN" statt
"N aufgetreten", Endstand-Banner = Scoreline ohne PKT-Zweitzahl.

**Reiner Plan, kein Code geändert.** Auftrag: die zwei Broadcast-Schwächen, die für Breaking im
Gedächtnis standen („rund 92 % Banner-Zeit, der höchste Wert aller 20 Disziplinen“ und „zwei
widersprüchliche gleichzeitige Score-Anzeigen“), **selbst nachmessen**, die Ursache im Code
finden und ein Paket im Stil des TDM-Broadcast-Pakets (`tdm-broadcast-paket-plan-07-10.md`,
PR #1157) entwerfen. Gemessen wurde auf `main` bei `ac863426`.

Zur Erinnerung, weil der Name in die Irre führt: **Breaking ist Folter, nicht Breakdance**
(CLAUDE.md, Chris 13.09.). Ein Gauntlet im Kachinuki-Format: Slot 1 gegen Slot 1, der Sieger
bleibt mit seinem HP-Stand im Ring, bis ein Team aufgebraucht ist. Gewertet werden die
**Verbliebenen**. Alle Wörter in diesem Plan („Verbliebene“, „ausgeschieden“, „GEBROCHEN“,
„GIBT AUF“) bleiben in diesem Vokabular.

Vorweg das Wichtigste, weil es den Auftrag verschiebt, genau wie beim TDM-Paket: **beide
Probleme wurden schon einmal angegangen**, am 30.09. (`fa7ea569` Banner, `636f065f` Stand).
Die 92 % sind **seitdem Geschichte**. Was heute noch stört, ist dreierlei: eine
**Ticker-Regression** (dieselbe wie bei TDM, aus demselben Merge), ein Banner-Anteil, der
weiter über dem Zielband liegt, und eine Stand-Darstellung, die der PKT-Präfix vom 30.09.
nur beschriftet, aber nicht aufgelöst hat. Dazu kommt ein Fund, der in keinem Audit stand:
Die Team-Unterzeile verrät bei manchen Aufstellungen **schon beim Anpfiff den Sieger**.

---

## 0. Kurzfassung

| | Audit 30.09. | Fix | heute gemessen (5 Aufstellungen) | nach diesem Paket (gemessen an einer Kopie, s. 1) |
|---|---|---|---|---|
| Banner-Anteil der Sendezeit | 92 % | `fa7ea569` → „18,2 %“ | **26,9–31,4 %** (Standard 29,4 %) | **22,0–24,9 %** (mit Option B2 rechnerisch 15,5–17,5 %) |
| Banner je Minute | 54 (195 Texte in 3:30) | → 3,8 | **7,3–8,6** | 6,3–7,0 |
| Ticker-Zeilen je Minute | 89 | `6db278bc` → 29 | **170,4** (Regression) | **29,2–29,6** |
| `#score` und `#kmitte` zeigen verschiedene Zahlenpaare „a : b“ | ja | `636f065f`: Präfix „PKT“ | **1048 von 1048 Proben** | 0 |
| … davon gegenläufig (Verbliebene: links vorn, PKT: rechts vorn, oder umgekehrt) | — | — | **12 Proben (1,1 %)**, dazu 1 von 5 Schlussbildern | 0 |
| Wort unter dem Stand (`#klsuffix`) | — | — | „Punkte“ (Endstand sagt „Verbliebene“) | „Verbliebene“ |
| Team-Unterzeile „N aufgetreten“ | — | — | falsche Zahl, **Spoiler beim Anpfiff** | „N ausgeschieden“, passt zum Stand |
| rho je Spiel / Saison, n=24 | — | — | 0,801 / 0,944 | **bit-identisch** (Diff leer, an der Kopie gemessen) |

* **Banner (Problem 1): die 92 % sind reproduziert, aber nicht mehr aktuell.** Mit derselben
  Sonde gegen den Stand **vor** `fa7ea569` kommen 93,4 % heraus (215 Banner). Seit `fa7ea569`
  sind es rund 28–31 %. Die damals gemeldeten 18,2 % waren zu günstig: gemessen an der Wanduhr
  in einem Headless-Browser, der Breaking nur mit gut einem Drittel der Sollgeschwindigkeit
  abspielt (s. 2.2). Der Rest über dem Band hat eine klare Ursache: **Jede Aufgabe ist ein
  Prioritäts-Banner** (10–11 je Spiel, alle 8–12 s eine), dazu 2–4 Stufenwechsel-Banner,
  die in **13 von 13 Fällen** nur 3–9 s vor dem Banner für die Aufgabe desselben Kämpfers
  laufen.
* **Ticker (Nebenbefund, aber der größte Hebel im Bild): eine Regression, dieselbe wie bei TDM.**
  `kind="angeschlagen"` steht im Gauntlet-Zweig **bedingungslos** (Merge `0fd081b3d`, C3,
  01.10. 17:12). Damit schlägt `kind` die Stufe `"routine"`, und alle 170 „hält stand“-Zeilen
  stehen im sichtbaren Ticker. Sieben Stunden vorher hatte `6db278bc` genau das auf 29 je
  Minute gebracht.
* **Stand (Problem 2): bestätigt, in schwächerer Form als erinnert.** Die Zahlen sind in sich
  stimmig (Bug = Scoreline, PKT = Summe der Pkt-Spalte, Endstand = Schluss-Tickerzeile). Aber
  zu **jedem** Zeitpunkt stehen zwei „a : b“ verschiedener Bedeutung im Bild: oben die
  Verbliebenen „4 : 4“ mit dem falschen Wort „Punkte“ darunter, in der Kaderleiste
  „PKT 6565 : 4616“, also die Folterpunkte, die über den Sieg gar nicht entscheiden. In einer von
  fünf Aufstellungen sagt das Schlussbild „SIEGER — 1 : 0“ und daneben „PKT 8189 : 8211“
  (Abschnitt 3.2). Dazu kommt die dritte Zahl „N aufgetreten“ in der Team-Unterzeile. Sie zählt
  Kämpfer, die nie in den Ring steigen, schon ab 0:00 als „aufgetreten“, und damit verrät sie,
  welches Team am Ende Leute übrig hat.
* **Paket: fünf kleine Eingriffe, alle Klasse A**, eine sechste Option (B2) ebenfalls Klasse A
  (Abschnitt 4). Wertung und Simulation werden nirgends berührt. Der Gauntlet ist in
  `baueGauntlet()` beim Bau komplett durchgerechnet, die Enthüllung ist rein kosmetisch.
  `miss-alle-disziplinen.mjs 12/24 breaking` ist an der gepatchten Kopie **bit-identisch**
  gemessen, nicht nur behauptet. Eine Freigabe durch Chris ist nicht nötig.

---

## 1. Wie gemessen wurde

* **Banner, deterministisch (Hauptzahl).** Eine Wegwerf-Sonde im Scratchpad, nicht im Repo
  (Abschnitt 5 Schritt 7 macht daraus die echte Sonde). `window.__arena.setDisc("breaking")`,
  Produktionsmodus (dunkel, `.im-spiel`), Einlauf von Hand ausgeblendet wie in der TDM-Sonde.
  Danach läuft **eine einzige** `page.evaluate()`-Schleife, die `sondenLauf(3)` aufruft und
  nach jedem Schritt `MutationObserver.takeRecords()` auf `#bbugcallout` liest. Jeder
  `callout()`-Aufruf (`textContent=""` und neu befüllen) wird so synchron mit seiner Sendezeit
  (Ticks/60) erfasst. Eine Schleife statt vieler Rundreisen ist Absicht: Viele kleine
  `evaluate()`-Rundreisen lösen bei Breaking den Einbruch aus, den
  `breaking-performance-einbruch-befund-01-10.md` beschreibt. Die Sichtbarkeit wird
  **modelliert**: `callout()` blendet `CALLOUT_DAUER_MS=2600` ein (danach 380 ms Ausblenden),
  ein neuer Aufruf ersetzt den alten. Das ist exakt das Bild bei Tempo 1× in einem Browser,
  der die 60 Bilder je Sekunde schafft. Abgetastet werden muss der DOM-Zustand dafür nicht,
  denn der Ausblende-Timer läuft auf der Wanduhr (`setTimeout`) und im Sondenlauf bewegt sich
  die Wanduhr kaum.
* **Banner, Echtzeit (Gegenprobe).** Ein Durchlauf über den Start-Knopf bei Tempo 1×, alle
  500 ms `#bbugcallout` abgetastet, so wie der Audit vom 30.09. gemessen hat.
* **Stand.** Dieselbe deterministische Sonde tastet alle 30 Ticks (0,5 s Sendezeit) ab:
  `#score`, `#klsuffix`, `#kmitte`, `#bbugMitte` (Ziffer), `#aliveL/#aliveR` samt
  Team-Unterzeile, die Summe der Pkt-Spalte in beiden Wertungstabellen, am Ende `#esieger` und
  die Schluss-Tickerzeile.
* **Fünf Aufstellungen statt einer.** Der Standardkader allein ist eine einzige Ziehung. Über
  `window.__arena.kaderSetzen()` laufen zusätzlich: Heim/Gast getauscht („tausch“) und drei
  Rotationen der Kaderreihenfolge („rot1“–„rot3“, Heim um k, Gast um k+1 verschoben). Die
  Slot-Reihenfolge im Gauntlet und damit der ganze Kettenverlauf ändern sich dabei.
* **Ticker.** Dieselbe Sonde zählt per MutationObserver neue Zeilen in `#feed` und
  `#protokoll`, wie `scripts/miss-ticker-dichte.mjs`. Die Repo-Sonde selbst liefert für `main`
  dieselbe Zahl (169,7 je Minute, 297 Zeilen in 1:45).
* **Fix-Vorhersage und Geschichte.** Dieselbe Sonde läuft gegen **Kopien** von
  `battle-mode.engine.js`, die der Testserver statt der Repo-Datei ausliefert: drei
  historische Stände (`fa7ea569^`, `fa7ea569`, `eb583702^`) und die gepatchte Kopie mit
  T1/B1/S1–S3. Das Repo bleibt unangetastet. Für die Wertung läuft
  `miss-alle-disziplinen.mjs` gegen eine Scratch-Wurzel, deren `public/mockups/` bis auf die
  gepatchte Engine aus Symlinks auf das Repo besteht. Per Gegenprobe ist bestätigt, dass dort
  wirklich die gepatchte Engine lädt (`#klsuffix` = „Verbliebene“ statt „Punkte“).

---

## 2. Problem 1 — das Banner

### 2.1 Messung: Geschichte und heute (Standardkader, Sendezeit bei Tempo 1×)

| Stand | Dauer 1× | Banner (`callout()`-Aufrufe) | verschiedene Texte | Banner-Anteil (2,6 s) | inkl. Ausblenden (2,98 s) |
|---|---:|---:|---:|---:|---:|
| vor `fa7ea569` (30.09. vormittags) | 1:51 | 215 | 204 | **93,4 %** | 93,7 % |
| `fa7ea569` (Banner-Dosis, Punkt 7) | 1:51 | 15 | 14 | **28,0 %** | 31,8 % |
| `main` heute | 1:45 | 14 | 13 | **29,4 %** | 33,0 % |

Über alle fünf Aufstellungen auf `main`:

| Aufstellung | Dauer | Banner | je min | davon Aufgabe | davon Stufenwechsel | Anteil |
|---|---:|---:|---:|---:|---:|---:|
| Standard | 1:45 | 13 | 7,5 | 9 (+1 vom Endstand überdeckt) | 3 | 29,4 % |
| tausch | 1:48 | 13 | 7,3 | 10 | 2 | 26,9 % |
| rot1 | 1:43 | 13 | 7,6 | 10 | 2 | 29,2 % |
| rot2 | 1:45 | 15 | 8,6 | 10 | 4 | 31,4 % |
| rot3 | 1:46 | 13 | 7,4 | 10 | 2 | 27,4 % |

(Hier ohne die doppelt gezählte Endzeile. Die letzte Aufgabe und das Endstand-Banner fallen in
denselben Tick, das Endstand-Banner ersetzt sie sofort.)

Zielband laut Audit Abschnitt 6.1: Banner 8–20 % der Sendezeit, 2–6 Banner je Minute.

**Echtzeit-Gegenprobe (Standardkader, `main`).** Das Spiel zeigt am Ende 1:44 auf der Uhr,
hat aber **270 s Wanduhr** gedauert. Der Headless-Browser schafft also nur rund 38 % der
Sollgeschwindigkeit. In dieser gestreckten Zeit war das Banner 14,5 % der Proben nicht
`hidden` und 11,9 % mit Deckkraft über 0,5 eingeblendet.

**Lesart.**

* Die **92 % des Audits sind mit der Sendezeit-Methode reproduziert** (93,4 %). `fa7ea569`
  hat sie wirklich beseitigt.
* Die **18,2 %, die `fa7ea569` gemeldet hat, waren zu günstig.** Sie wurden in Echtzeit im
  Headless-Browser gemessen, also in einer um den Faktor 2,5 bis 3 gestreckten Zeit. Die
  Banner-Dauer läuft auf der Wanduhr, die Ereignisse dagegen in Sendezeit, und so schrumpft der
  Anteil mit der Streckung. Daher kommen auch die „3:30“ in der Audit-Tabelle 6.1 für ein
  Spiel, das 1:45 Sendezeit lang ist. In einem Browser, der 60 Bilder je Sekunde schafft, war
  der wahre Wert seit dem 30.09. **rund 28–31 %**. Die Banner-Dosis hat Breaking also nie ins
  Band gebracht, sondern nur von „Dauerbanner“ auf „jede neunte Sekunde ein Banner“.
* Eine Regression gibt es beim Banner **nicht**. `main` misst dasselbe wie `fa7ea569`, die
  leichten Unterschiede kommen aus Paket 3 (`eb583702`, B4 Verschnaufen), das die Kette um
  sechs Sekunden verkürzt hat.

### 2.2 Ursache im Code

**Gauntlet-Zweig der Bühnen-Enthüllung, `battle-mode.engine.js` Z. 20047–20058:**

```js
feed(u.side, u.n+" — "+r.ereignis+…+" (Kampf "+r.bout+").",
  buehneBahnGrossDrosseln(stufenwechsel,false), undefined,
  "angeschlagen", undefined, undefined,
  r.ereignis===BB().erfolgWort?"routine":undefined);          // Z. 20047–20050
if(r.hpNach<=0){
  feed(u.side, u.n+" — "+wort+" — scheidet aus — Kampf "+r.bout+" geht an "+r.gegnerN+".",
    buehneBahnGrossDrosseln(true,true), undefined, "gebrochen"); // Z. 20057–20058
}
```

* **Aufgabe/Elimination** (Z. 20058): `buehneBahnGrossDrosseln(true,true)`. Das ist der
  Prioritäts-Bypass (Z. 30818–30824), der am 12-s-Cooldown vorbeigeht. Für den Kampf wurde er
  für Ereignisse gebaut, „die sich von Natur aus nur ein einziges Mal pro Spiel ereignen
  können“ (Kommentar Z. 30784–30788). Im Gauntlet endet aber **jeder** Kampf mit einer Aufgabe,
  also gibt es 10–11 je Spiel bei einer Spieldauer von 1:45. Der Median-Abstand liegt bei 8–12 s
  und der kürzeste bei 2,2 s, dann ersetzt das zweite Banner das erste, bevor es gelesen ist.
  Allein diese Banner füllen 10 × 2,6 s = 26 s von 105 s, also **~25 % der Sendezeit**.
* **Stufenwechsel** (Z. 20048, `gauntletStufenwechsel()` Z. 19378, Schwellen
  `GAUNTLET_STUFEN=[0.5,0.2]` Z. 19377): Ein Banner, wenn der Ertragende die 50- oder 20-%-HP-
  Marke unterschreitet, gedrosselt mit 12 s Cooldown. Gemessen in allen fünf Aufstellungen:

  | Aufstellung | Ertragender | HP beim Banner | Aufgabe desselben Kämpfers danach |
  |---|---|---:|---:|
  | Standard | Greenkraut / Seraph-11 / Ralazar | 180 / 75 / 70 | 6,6 s / 4,8 s / 3,0 s |
  | tausch | Greenkraut / Ralazar | 200 / 80 | 8,1 s / 5,5 s |
  | rot1 | Tidesprinter / Krag'Zul | 180 / 62 | 8,8 s / Spielende nach 4,8 s |
  | rot2 | Seraph-11 / Cassandra / Greenkraut / Gram | 195 / 65 / 64 / 71 | 8,0 / 4,0 / 3,3 / 4,4 s |
  | rot3 | Ralazar / Xelara | 195 / 60 | 8,0 s / 4,0 s |

  **13 von 13** Stufenwechsel-Bannern kündigen die Aufgabe desselben Kämpfers 3–9 s später an,
  die ohnehin ein Banner bekommt. Das ist kein eigener Moment, sondern derselbe Moment zweimal.
  Das Bild selbst zeigt die Eskalation längst: die gespiegelten HP-Balken (B2), die Vignette
  bei Bruchgefahr unter 30 % (B3) und der Herzschlag von 70 auf 150 BPM.
* **Banner-Dauer** (`callout()` Z. 42203, `CALLOUT_DAUER_MS=2600` Z. 42160): eine Konstante
  für alle 20 Disziplinen.

### 2.3 Was die Optionen bringen (gemessen bzw. aus den erfassten Bannerzeiten gerechnet)

| Aufstellung | `main` | **B1**: kein Stufenwechsel-Banner (gemessen an der Kopie) | B2: Aufgabe-Banner 1,8 s (gerechnet) | B1 + B2 (gerechnet) |
|---|---:|---:|---:|---:|
| Standard | 29,4 % | **22,0 %** | 22,9 % | 15,5 % |
| tausch | 26,9 % | **24,2 %** | 19,9 % | 16,8 % |
| rot1 | 29,2 % | **24,9 %** | 21,8 % | 17,5 % |
| rot2 | 31,4 % | **23,6 %** | 24,9 % | 17,2 % |
| rot3 | 27,4 % | **24,6 %** | 20,3 % | 17,0 % |

**Empfehlung:** B1 ins Paket. Es streicht einen doppelten Moment, nicht einen echten.
Damit sinkt der Anteil auf 22–25 %, sechs bis sieben Banner je Minute, **jedes davon eine
Aufgabe**. Das liegt knapp über dem Band, und das ist für Breaking ehrlich so: Die Disziplin
erzählt alle zehn Sekunden „einer bricht“, und genau dafür ist sie da („bis einer aufgibt“,
Chris 13.09.). B2 bringt Breaking rechnerisch ins Band, kostet aber Lesezeit bei einem Banner
mit Titel und Satz („GEBROCHEN“ / „Draco — scheidet aus — Kampf 2 geht an Krag'Zul.“). B2 ist
deshalb **optional** und nur nach einer Sichtprüfung der Lesbarkeit zu bauen (Abschnitt 4).

**Ausdrücklich verworfen:** Den Prioritäts-Bypass für Aufgaben abschalten, also Aufgaben durch
den 12-s-Cooldown laufen lassen. Bei einem Median-Abstand von 8–12 s würde das jede zweite
Aufgabe ohne Banner lassen, und zwar nach Zufall des Takts, nicht nach Wichtigkeit. Der
Hauptmoment der Disziplin darf nicht vom Cooldown abhängen.

---

## 3. Problem 2 — der Stand

### 3.1 Was auf dem Bildschirm steht (Breaking, live)

| Stelle | Element | Inhalt (Standard, Sendezeit 0:52) | Quelle |
|---|---|---|---|
| Scoreline über dem Canvas | `#score` | **Verbliebene** „4 : 4“ | `updateHudBuehne()` Z. 22248–22256, `!gauntletRausJetzt(u)` je Seite |
| darunter klein | `#klsuffix` | „0:52 · läuft · **Punkte**“ | `updateHudBuehne()` Z. 22220, fest „Punkte“ für jede Bühne |
| Team-Unterzeile | `#aliveL/#aliveR` + `em` | „V-W · **3 aufgetreten**“ / „**2 aufgetreten** · A-A“ | Z. 22209–22229: `fertig()` = `u.aktuell+1>=u.runden.length` |
| Score-Bug | `#bbugMitte b` | „4 : 4 · 0:52“, wörtliche Kopie von `#score` | `aktualisiereBbug()` |
| Canvas, mittig | — | „KAMPF 5“, „noch 4 : 4 im Ring“ | `zeichneBreaking()` Z. 28969–28980 (seit 30.09. „im Ring“ statt „im Rennen“) |
| Kaderleiste Mitte | `#kmitte` | „**PKT 6565 : 4616**“ | `renderKader()` Z. 44365–44367, Σ `x.summe` je Seite |
| Wertungstabelle | Spalte „Pkt“ je Kämpfer | Summe = PKT | `WERTUNG_*`, `u.summe` |
| Endstand-Banner | `#esieger` | „… SIEGER — 2 : 0 · **Verbliebene**“ | `renderEndstandBuehne()` Z. 45038, `buehneStand()`/`buehneEinheitLabel()` Z. 45002/45032 |
| Schluss-Tickerzeile | `#feed` | „… gewinnt 2 : 0.“ | Bühnen-Ende |

Was der Sieg ist: **die Verbliebenen** (`spieleBuehneGauntlet()` Z. 48049ff.: `seiten =
alive(0), alive(1)`, Chris 22.09.: „wer übrig bleibt, scored einen Punkt“). `u.summe`, die
Folterpunkte, ist die **Einzelwertung**, die `wert()` für die Rangtreue liest. Für den
Mannschaftssieg zählt sie nicht.

### 3.2 Messung über ganze Spiele (5 Aufstellungen, 1048 Live-Proben, 0,5 s Abstand)

| Prüfung | Verstöße |
|---|---:|
| Bug-Ziffer ≠ `#score` | 0 |
| Σ Pkt-Spalte ≠ PKT in `#kmitte` | 0 |
| Endstand-Banner ≠ letzte Scoreline ≠ Schluss-Tickerzeile | 0 |
| `#klsuffix` = „Punkte“, obwohl `#score` Verbliebene zählt | **1048 (100 %)** |
| **zwei „a : b“ mit verschiedener Zahl zugleich im Bild** (`#score` gegen `#kmitte`) | **1048 (100 %)** |
| … davon **gegenläufig** (Verbliebene: eine Seite vorn, PKT: die andere) | **12 (1,1 %)**: rot1 5, rot3 7 |
| Schlussbild gegenläufig (Sieger nach Verbliebenen hat weniger PKT) | **1 von 5** (rot3: „SIEGER — 1 : 0“, daneben „PKT 8189 : 8211“) |
| Team-Unterzeile ≠ 6 − Verbliebene | in fast allen Proben |

Beispiel aus rot1, Sendezeit 0:21: Scoreline und Bug „**6 : 5**“ (Heim hat einen mehr übrig),
Kaderleiste „**PKT 2048 : 2392**“ (Gast vorn).

**Lesart.** Der Fix `636f065f` vom 30.09. hat die Zahlen beschriftet, aufgelöst hat er sie
nicht. Das TDM-Paket hat für dieselbe Lage gerade entschieden: Ein kleines Präfix reicht nicht,
gelesen wird die Zahl (TDM-Plan 3.2). Bei Breaking ist es noch klarer, denn PKT ist eine
**vierstellige** Zahl und steht in der Kaderleiste gleich groß wie der Stand darüber (Bild
`main` Endstand: „2 : 0“ oben, „PKT 11967 : 8347“ unten). Wer hinschaut, sieht zwei Stände.
Und am Ende eines von fünf Spielen widersprechen sie sich im Sieger.

**Der dritte Stand: „N aufgetreten“.** `fertig(s)` zählt Kämpfer, deren gebaute Runden alle
enthüllt sind. Im Gauntlet ist das falsch, denn ein Kämpfer, der nie in den Ring steigt, hat
`runden.length===0` und gilt damit **ab Tick 0** als „aufgetreten“. Gemessen (Standard):

* Sendezeit 0:00: „V-W · **1 aufgetreten**“ gegen „**0 aufgetreten** · A-A“, bevor auch nur
  ein Zug gelaufen ist. Die 1 ist Gram, der in diesem Spiel nie kämpft, **weil sein Team vorher
  gewinnt**. Die Unterzeile verrät also beim Anpfiff, dass Heim am Ende Kämpfer übrig hat.
  Das ist derselbe Spoiler-Typ, den Gewichtheben am 30.09. hatte (Audit-Punkt 2, `80096ab6`).
  Er tritt immer dann auf, wenn das Siegerteam mit mindestens einem Kämpfer endet, der nie
  gekämpft hat.
* Sendezeit 0:52: Stand „4 : 4“, also 2 : 2 ausgeschieden, aber „3 aufgetreten“ / „2 aufgetreten“.
* Kurz vor Schluss „6 aufgetreten“ bei Stand 2 : 1.

### 3.3 Nebenbefunde, nicht Teil dieses Pakets

* **Wertungstabelle läuft über** (Audit-Punkt 20, offen): 15 Spalten, „ABFALL“, „LEIST“ und
  „EIG“ werden rechts abgeschnitten. Das ist eine eigene Layout-Runde (Spalten live
  reduzieren).
* **Die letzte Aufgabe bekommt nie ein sichtbares Banner.** Sie fällt in denselben Tick wie
  das Endstand-Banner, das sie sofort ersetzt. Der Endstand trägt den Moment ohnehin.
* **„noch 4 : 4 im Ring“ im Canvas** ist ein drittes „a : b“, aber dieselbe Größe wie die
  Scoreline, beschriftet und im Canvas klein. Es bleibt.

---

## 4. Das Paket

Ziel nach dem Paket: **Jedes „a : b“ im Breaking-Bild bedeutet Verbliebene und trägt
überall dieselbe Zahl, die Team-Unterzeile verrät nichts mehr, jedes Banner ist eine Aufgabe
oder der Endstand, und der sichtbare Ticker bleibt unter 30 Zeilen je Minute.**

| # | Eingriff | Funktion / Stelle | Klasse | Wirkung (gemessen an der Kopie, 5 Aufstellungen) | Risiko |
|---|---|---|---|---|---|
| **T1** | `kind="angeschlagen"` nur bei `big`. Damit greift `stufe:"routine"` für „hält stand“ wieder, „bricht ein“ läuft wieder übers Zeilenbudget | Gauntlet-Zweig Z. 20047–20050 | A | Ticker 170,4 → **29,2–29,6** je min, Protokoll unverändert (297/306/293/299/301 Zeilen) | keins, s. 4.1 |
| **B1** | Stufenwechsel nicht mehr `big`. Die Zeile bleibt im Protokoll bzw. Ticker, das Banner entfällt | dieselbe Aufrufstelle Z. 20048 | A | Banner 26,9–31,4 % → **22,0–24,9 %**, 7,3–8,6 → 6,3–7,0 je min, nur noch Aufgaben + Endstand | Stufenwechsel fehlt in `HIGHLIGHTS`, s. 4.1 |
| **S1** | `#klsuffix` im Gauntlet „Verbliebene“ statt „Punkte“ | `updateHudBuehne()` Z. 22220 | A | ein Wort für eine Größe: Scoreline = Endstand-Banner | Breite der Unterzeile prüfen |
| **S2** | `#kmitte` im Gauntlet zeigt den Stand wie `#score` (`buehneStand().text`), nicht mehr PKT | `renderKader()` Z. 44365–44367 | A | verschiedene „a : b“ 1048 → **0**, gegenläufige 12 → 0 | PKT-Teamsumme verschwindet, s. 4.1 |
| **S3** | Team-Unterzeile im Gauntlet „N ausgeschieden“ = `gauntletRausJetzt()` je Seite statt „N aufgetreten“ = `fertig()` | `updateHudBuehne()` Z. 22209–22229 | A | Anpfiff „0 / 0“ statt „1 / 0“, kein Spoiler mehr. Die Zahl ist immer 6 − Stand | keins |
| B2 *(optional)* | Aufgabe-Banner im Gauntlet 1,8 s statt 2,6 s, über einen optionalen Dauer-Parameter `callout(txt,caption,titel,dauerMs)` | `callout()` Z. 42203, Durchreichen über `feed()` | A | rechnerisch 15,5–17,5 %, im Band | Lesbarkeit, nur nach Sichtprüfung |

### 4.1 Warum das sicher reine Anzeige ist

* **Der Gauntlet ist beim Bau durchgerechnet.** `baueGauntlet()` (Z. 19281ff.) baut die ganze
  Kette mit allen `rr()`-Würfen, `u.summe` und `u.raus` vorab. Die Bühnen-Enthüllung
  (`stepBuehne()`, Z. 19493ff.) zeigt sie nur noch Zug für Zug. Keiner der Eingriffe berührt
  `baueGauntlet()`, `gauntletRunde()`, `wert()` oder ein Rundenfeld.
* **T1/B1** ändern nur Argumente eines `feed()`-Aufrufs. `feed()` kehrt im stummen Messpfad in
  der ersten Zeile zurück (`if(stumm)return;`, Z. 42479). `buehneBahnGrossDrosseln()` schreibt
  nur `letzterBuehneBahnGrossT`. Gelesen wird das allein von derselben Drossel, und für die
  Aufgaben, die mit Priorität laufen, spielt es keine Rolle. `kind` wird in `feed()` nur in
  der Ticker-Einstufung (Z. 42515) und innerhalb von `if(big){…}` gelesen. Bei T1 bleibt der
  `if(big)`-Zweig für jedes verbleibende Banner Zeichen für Zeichen gleich.
* **B1, was wegfällt:** Die Stufenwechsel-Zeile fehlt künftig in `HIGHLIGHTS` (Endstand-
  „Höhepunkte“, „Szene des Spiels“) und im Callout. Es bleiben die Aufgaben, also genau die
  Momente, die Audit-Punkt 7 als Kern nennt. `kuratiereHighlights()` bekommt dadurch weniger
  Einträge, aber keinen leeren Rückblick (10–11 Aufgaben je Spiel).
* **S1–S3** schreiben nur `textContent` von drei DOM-Elementen. `buehneStand()` ist eine
  gehobene Funktionsdeklaration im selben Modul-Scope, dieselbe Quelle, die schon
  `renderEndstandBuehne()` liest. An der Kopie lief der Aufruf aus `renderKader()` ohne
  `pageerror`. Die PKT-Teamsumme geht als Information nicht verloren: Die Pkt-Spalte je Kämpfer
  steht weiter in der Wertungstabelle und auf jeder Kaderkarte. Entschieden hat die Teamsumme
  nie etwas.
* **Belegt, nicht nur hergeleitet.** An der gepatchten Kopie (T1+B1+S1+S2+S3) gemessen:
  `miss-alle-disziplinen.mjs 12 breaking` und `… 24 breaking` liefern exakt dieselbe Ausgabe
  wie `main` (Diff leer). Bei n=24 ist das rho je Spiel 0,801 und rho Saison 0,944, Abnahme
  „bestanden“. Spieldauer und Protokoll-Zeilenzahl sind ebenfalls identisch.

**Klassifizierung.** Alle Eingriffe sind **Klasse A** im Sinne des Klassenschemas
(`tennis-nachtkonzept-03-10.md`, „Klassenschema“): reine Anzeige, kein `rr()`, kein neues
Simulationsfeld, `wert()` und Rezept unangetastet, rho bit-identisch. Abnahme ist eine
Sichtprüfung. **Eine Freigabe durch Chris ist nicht nötig.** Keine Klasse T: Nichts verzögert
oder verlängert die Sendung. Die Ticker-Drossel zählt Sendezeit, und die Banner-Dauer (B2) ist
eine Einblendzeit, keine Spielzeit. Eignungsmatrix und Pp-Budgets (Breaking 14,3 / 13,9 Pp,
bestanden) werden nicht berührt.

**Bewusst nicht im Paket:**

* **T2, die Regel in `feed()` selbst** („ausdrückliche `stufe` schlägt `kind`“, TDM-Plan 2.4).
  Für Breaking reicht sie nicht. Das TDM-Paket hat dafür 73,1 Zeilen je Minute gemessen, weil
  „bricht ein“ ohne `stufe` übergeben wird und über `kind` weiter als „ereignis“ durchrutscht.
  Die lokale Korrektur T1 bringt 29,3. T2 bleibt als eigenes Folgepaket „Ticker-Regression
  Bühne“ für Speed-Schach, Fechten und I-Spy auf der Liste. Nimmt es jemand später, passt es
  zu T1, denn beide zusammen ändern für Breaking nichts mehr.
* Den Prioritäts-Bypass für Aufgaben antasten (s. 2.3).
* Wertungstabellen-Überlauf und die überdeckte letzte Aufgabe (3.3).
* Eine Auswahl „nur besondere Aufgaben bekommen ein Banner“ (Serie, Aufholjagd vom letzten
  Slot). Das wäre redaktionell schöner, ist aber eine eigene Runde mit eigener Sichtprüfung,
  kein Fix.

---

## 5. Schritt für Schritt

Ein Branch `breaking-broadcast-paket-07-10`, je Schritt ein Commit, damit sich jeder Eingriff
notfalls einzeln zurücknehmen lässt.

**Schritt 0 — Nulllinie sichern (vor jeder Änderung).**

```sh
node scripts/miss-alle-disziplinen.mjs 24 breaking > /tmp/vorher.txt
node scripts/miss-ticker-dichte.mjs breaking --zeilen /tmp/ticker-vorher.json
```

Beides läuft in Sekunden (gemessen 9 s bzw. unter einer Minute). Breaking hatte das OOM-Problem
nur im Pp-Skript, und das ist seit PR #1092 behoben.

**Schritt 1 — T1, Ticker.** Im Gauntlet-Zweig (Z. 20047–20050):

```js
const angeschlagenBig=buehneBahnGrossDrosseln(stufenwechsel,false);
feed(u.side, …unveränderter Text…, angeschlagenBig, undefined,
  angeschlagenBig?"angeschlagen":undefined, undefined, undefined,
  r.ereignis===BB().erfolgWort?"routine":undefined);
```

Dazu ein Kommentar im Stil des TDM-T1-Kommentars mit Verweis auf dieses Dokument und auf
`0fd081b3d`. Der Kopfkommentar von `feed()` nennt die Falle seit dem TDM-Paket bereits
(Z. 42412–42418). Dort ergänzen: „dritter Fall: Breaking-Gauntlet, ebenfalls 07.10. behoben“.

**Schritt 2 — B1, Stufenwechsel ohne Banner.** Dieselbe Stelle:
`const angeschlagenBig=false;`, oder die Zeile aus Schritt 1 ganz durch `false` ersetzen und
`stufenwechsel`/`gauntletStufenwechsel()` stehen lassen, weil die Zeilenwahl sie weiter
dokumentiert. Den Kommentarblock Z. 20013–20027 („big ist jetzt nur noch … Aufgabe … oder
Stufenwechsel“) um die Begründung aus 2.2 ergänzen: 13 von 13 Stufenwechseln kündigen die
Aufgabe desselben Kämpfers 3–9 s vorher an. **Hinweis:** Wer B1 nicht will, nimmt nur
Schritt 1. Beide sind unabhängig voneinander abnehmbar.

**Schritt 3 — S1, Wort.** `updateHudBuehne()` Z. 22220:
`…textContent=BB().gauntlet?"Verbliebene":"Punkte";`. Sauberer, aber mit größerem Radius wäre
`buehneEinheitLabel(BB())` (dieselbe Funktion wie im Endstand-Banner). Damit stünde aber
zugleich bei Gewichtheben „Duelle“, bei Tennis „Plätze“, bei Fechten „Bahnen“ und bei
Speed-Schach „Bretter“, also vier weitere Disziplinen mit eigener Sichtprüfung. Für dieses
Paket nur der Gauntlet, die Verallgemeinerung als Ein-Satz-Hinweis für die nächste
Bühnen-Runde in den Kommentar. Die Unterzeile „1:44 · beendet · Verbliebene“ bei 1300 px und
375 px auf Umbruch prüfen.

**Schritt 4 — S2, Kaderleiste.** `renderKader()` Z. 44365–44367: den `BB().gauntlet`-Zweig auf
`buehneStand().text` umstellen. Den Kommentar Z. 44341–44354 (Punkt 3, „PKT-Präfix“) ersetzen
und begründen: Seit dem TDM-Paket zeigen alle Chassis dort den Stand, und das Präfix hat das
Bild nicht entwirrt (3.2, gegenläufiges Schlussbild in rot3).

**Schritt 5 — S3, Team-Unterzeile.** `updateHudBuehne()`:

```js
const auftrittsWort=… :BB().schatzsuche?"an den Fundorten"
  :BB().gauntlet?"ausgeschieden"
  :"aufgetreten";
…
const fertig=BB().gauntlet
  ?(s)=>TEILNEHMER.filter(u=>u.side===s&&gauntletRausJetzt(u)).length
  :(s)=>TEILNEHMER.filter(u=>u.side===s&&u.aktuell+1>=u.runden.length).length;
```

`gauntletRausJetzt()` ist bereits reveal-gegatet (Z. 19488), also kein Spoiler. Kommentar mit
dem Gram-Beispiel aus 3.2 und dem Verweis auf den Gewichtheben-Spoiler (`80096ab6`), damit der
nächste Leser sieht, warum die Zahl nicht „aufgetreten“ zählen darf.

**Schritt 6 — B2 (optional, nur nach Sichtprüfung).** `callout(txt,caption,titel,dauerMs)` mit
`dauerMs||CALLOUT_DAUER_MS`. `feed()` reicht den Wert nur für `kind==="gebrochen"` im Gauntlet
als 1800 durch. Am besten über eine kleine Tabelle `CALLOUT_DAUER_JE_KIND_GAUNTLET`, nicht über
einen neunten `feed()`-Parameter. Vorher drei Screenshots des Aufgabe-Banners bei 1,8 s
ansehen, und zwar zum Zeitpunkt 1,2 s nach dem Einblenden: Ist Titel plus Satz in der Zeit
lesbar? Wenn nein, bleibt B2 weg, und Breaking steht ehrlich bei 22–25 %.

**Schritt 7 — Sonde.** Neue Sonde **`scripts/verify-breaking-broadcast-paket-07-10.mjs`**,
Bauart wie `verify-tdm-broadcast-paket-07-10.mjs` (eigener HTTP-Server über `public/`,
`sondenLauf()`, Produktionsmodus, Einlauf ausgeblendet). Zwei Unterschiede zur TDM-Sonde, beide
aus den Messungen hier:

* **eine einzige `evaluate()`-Schleife** über das ganze Spiel (`sondenLauf(3)` plus
  `takeRecords()`), keine Rundreise je Chunk. Sonst läuft man in den Einbruch aus
  `breaking-performance-einbruch-befund-01-10.md`, und die Banner-Zeiten werden falsch.
* **fünf Aufstellungen** über `kaderSetzen()`: Standard, tausch, rot1, rot2, rot3, wie in
  Abschnitt 1. Eine einzige ist zu dünn, denn der gegenläufige Fall tritt nur in zwei von fünf
  auf.

Sie prüft und kann bestehen oder durchfallen:

- (a) zu **keinem** Probezeitpunkt zwei verschiedene Ziffernpaare „a : b“ in `#score`,
  `#bbugMitte b`, `#kmitte`. Kein „PKT“ mehr in `#kmitte`
- (b) `#klsuffix` endet auf „Verbliebene“, Endstand-Banner enthält „Verbliebene“, die Zahl im
  Endstand = letzte Scoreline = Zahl in der Schluss-Tickerzeile
- (c) Team-Unterzeile: Wort „ausgeschieden“, Zahl je Seite = 6 − Stand dieser Seite zu jedem
  Probezeitpunkt, bei Sendezeit ≤ 1 s beide 0
- (d) Banner: modellierter Anteil (2,6 s bzw. Option B2) ≤ 25 % (mit B2 ≤ 20 %), kein Banner
  mit Titel „ANGESCHLAGEN“ (B1), und jede Aufgabe-Zeile im `#feed` hat ein Banner (der
  Hauptmoment darf nicht verloren gehen; ausgenommen die letzte, s. 3.3)
- (e) sichtbarer Ticker ≤ 30 Zeilen je Minute Sendezeit, keine „hält stand“-Zeile im `#feed`,
  Protokoll-Zeilenzahl je Aufstellung gleich der Vorher-Messung (Standard 297)
- (f) keine `pageerror`
- dazu drei Screenshots des ganzen `#p2 .frame` (Anpfiff mit Unterzeile, Mitte mit Banner,
  Endstand) nach `tmp-ux-audit/breaking-broadcast-paket-07-10/`

**Schritt 8 — Abnahme.**

```sh
node --check public/mockups/battle-mode.engine.js
node scripts/miss-alle-disziplinen.mjs 24 breaking > /tmp/nachher.txt
diff /tmp/vorher.txt /tmp/nachher.txt
node scripts/miss-ticker-dichte.mjs breaking --schranke 30
node scripts/verify-breaking-broadcast-paket-07-10.mjs
node scripts/verify-tdm-broadcast-paket-07-10.mjs
```

Erwartung: Das Diff ist **leer** (an der Kopie bereits so gemessen, s. 4.1). Der Ticker liegt
bei 29,2–29,6, also knapp unter der Schranke. Das ist gewollt: Das Budget von 28 Zeilen je
Minute füllt sich mit „bricht ein“, dazu kommen die Ereignisse. Alle Prüfungen der neuen Sonde
bestehen. Die TDM-Sonde läuft als Rauchtest mit, weil `feed()` und `updateHud*()` geteilt sind.
Eine Pp-Messung (`messe-arena-einfluss.mjs breaking`) ist für Klasse A nicht nötig. Sie nimmt
denselben stummen Pfad wie `miss-alle-disziplinen.mjs` und ist durch das leere Diff mit
abgedeckt. Wer sie dokumentieren will, fährt sie vorher und nachher mit n=48 (rund 5 min je
Lauf) und hängt das leere Diff an.

**Schritt 9 — Commit-Text** im Stil des TDM-Pakets: Problem, Ursache mit Fundstelle, die Fixes
T1/B1/S1–S3 (gegebenenfalls B2), Validierung mit Zahlen vorher und nachher, Klasse A und der
Verweis auf dieses Dokument. Dazu in `f1-broadcast-audit-runde-2-30-09.md` zwei
Ein-Satz-Nachträge:

* Punkt 7: Die 18,2 % aus `fa7ea569` waren eine Wanduhr-Messung in gestreckter Zeit, der
  Sendezeit-Wert lag bei rund 28 %. Nach diesem Paket sind es 22–25 %.
* Punkt 8: Für Breaking war es dieselbe Regression durch `0fd081b3d`, behoben durch …

Damit stehen die alten Zahlen dort nicht weiter als gültig da.

---

## 6. Aufwand und Reihenfolge

| Schritt | Aufwand |
|---|---|
| T1, B1 | klein, eine Aufrufstelle plus Kommentare |
| S1–S3 | klein, drei Textstellen, keine neue Funktion (`buehneStand()` und `gauntletRausJetzt()` gibt es schon) |
| B2 | klein im Code, aber mit Sichtprüfung. Optional |
| Sonde | mittel, der größte Posten. Die Wegwerf-Sonde dieses Plans ist die Vorlage |
| Abnahme | schnell, `miss-alle-disziplinen 24 breaking` braucht unter 10 s |

Reihenfolge wie in Abschnitt 5. T1 zuerst, weil es den größten sichtbaren Gewinn bringt (der
Ticker schrumpft auf ein Sechstel) und für sich allein abnehmbar ist. S3 vor S1/S2, falls nur
Zeit für einen Stand-Eingriff bleibt, denn es ist der einzige mit einem Spoiler.

---

## Quellen im Repo

`docs/design/f1-broadcast-audit-runde-2-30-09.md` (Abschnitte 3.1, 3.4, Tabellen 6.1 und 6.3,
Punkte 3, 7, 8, 20), `docs/design/tdm-broadcast-paket-plan-07-10.md` (Stilvorlage, T1/T2,
Abschnitt 2.4 mit der Breaking-Zeile), `docs/design/breaking-performance-einbruch-befund-01-10.md`
(Rundreise-Einbruch, Grund für die Ein-Schleifen-Sonde), `docs/design/stand-aller-disziplinen.md`
(Breaking Pp 14,3 / 13,9, Fünfzehnter Nachtrag), `docs/design/tennis-nachtkonzept-03-10.md`
(Klassenschema). Commits: `fa7ea569` (Banner-Dosis, Punkt 7), `636f065f` (PKT-Präfix, Punkt 3),
`6db278bc` (Ticker, Punkt 8), `0fd081b3d` (C3, Regression), `eb583702` (Breaking Paket 3,
Gerätetext), `80096ab6` (Gewichtheben-Spoiler, gleiches Muster wie S3), `ac863426` (TDM-Paket,
PR #1157). Skripte: `scripts/miss-ticker-dichte.mjs`, `scripts/miss-alle-disziplinen.mjs`,
`scripts/verify-tdm-broadcast-paket-07-10.mjs`.
