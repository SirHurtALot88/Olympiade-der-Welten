# Broadcast D7 „Finale in Echtzeit" und A4 „Anpfiff-Countdown" — Fable-Empfehlung an Chris (02.10.)

**Konzeptpapier, kein Code, keine Freigabe.** Task #48 im Backlog. Beide Ideen stammen aus
`docs/design/fable-ideen-broadcast-praesentation-30-09.md` (Abschnitt 2, A4; Abschnitt 5, D7),
wurden dort als „Klasse A, trivial/klein" eingestuft, im Bau (PR #1117, 02.10.) als **Klasse T**
erkannt und vollständig zurückgenommen (Commit `06666101`, per Grep bestätigt: keine Reste im
Code). Seither liegen sie bei Chris.

## 0. Was dieses Papier ist — und was es ausdrücklich nicht ist

Beide Punkte greifen in die vom Zuschauer erlebte **Wandzeit-/Spielfluss-Taktung** ein (D7 sperrt
das Tempo, A4 schiebt den ersten Simulationstick um Sekunden nach hinten). Das ist Klasse T, und für
Klasse T gilt die Projektregel ohne Ausnahme: **nur Chris selbst, persönlich und ausdrücklich, kann
das freigeben.** Kein Agent darf es bauen, und kein Agent darf es als „wahrscheinlich okay"
einstufen — auch nicht nach einer Fable- oder Opus-Konsultation, auch nicht diese hier. Genau diese
Selbsteinstufung war beim Fechten-Format (PR #1111) und bei D7 selbst (PR #1117, erster Commit)
schon zweimal falsch.

Deshalb, damit es nirgends missverstanden wird:

* Dieses Papier **empfiehlt**. Es entscheidet nichts, baut nichts, gibt nichts frei.
* Jede „Tendenz" unten ist ein **Vorschlag an Chris**, den er annehmen, ändern oder ablehnen kann.
* Auch die Schwellwerte, Dauern und Opt-out-Regeln sind Vorschläge mit Begründung, keine
  Voreinstellungen, die ein Build-Agent „einfach so" übernehmen dürfte.
* Umsetzung — falls überhaupt — erst nach Chris' explizitem Go, laut Task #48 frühestens ab
  03.10. abends, und dann als eigener Task mit genau dem Umfang, den Chris freigegeben hat.

Abschnitt 4 ist eine ausfüllbare Entscheidungsvorlage, damit Chris nicht das ganze Papier
beantworten muss.

---

## 1. Was heute im Code steht (nachgelesen, nicht vermutet)

Alles in `public/mockups/battle-mode.engine.js`, Stand `origin/main` nach PR #1128.

**Tempo.** `speed` (`:28229`) ist reiner Wandzeit-Zustand: `loop()` (`:40073`) rechnet
`acc+=dt*speed` und führt je 1/60 angesammelter Sekunde einen `stepSim`-Tick aus. Die Tick-Folge
ist bei 1×/2×/4× bit-identisch; headless-Sonden (`miss-alle-disziplinen.mjs` & Co.) rufen `loop()`
nie auf. Die Tempo-Taste `#spd` (`:42709`) schaltet 1× → 2× → 4× → 1×. `speed` wird in `reset()`
**nicht** zurückgesetzt (`:42452`) — wer 4× wählt, bleibt über alle Disziplinwechsel hinweg auf 4×,
bis zum Neuladen der Seite. Es gibt keinen gespeicherten Tempo-Wunsch (anders als `bkMuted`/
`bkVolume` in `localStorage`).

**Spiellängen der drei Feldspiele mit Periodenuhr** (`FELDSPIEL_ART[...].live`, `ZEIT_DEHNUNG`):

| Disziplin | Perioden × Sim-Sekunden | `ZEIT_DEHNUNG` | Zuschauzeit 1× | bei 2× | bei 4× |
|---|---|---:|---:|---:|---:|
| Basketball | 4 × 90 | 1 | 6:00 | 3:00 | 1:30 |
| Hockey | 3 × 80 | 2 | 8:00 | 4:00 | 2:00 |
| Football | 4 × 70 | 1 | 4:40 | 2:20 | 1:10 |

Nur dieses Chassis hat eine geprüfte Restzeit-Berechnung (`feldspielRestzeitAbwaerts()`,
`:12900`, inklusive Nachspielzeit „+0:07"). Kampf-, Bahn- und Bühnen-Uhren zählen aufwärts oder
kennen kein Spielende als Uhrzeit. Tennis gehört zum Bühnen-Duell und hat keine Periodenuhr.

**Anpfiff.** Der Play-Klick (`:42677`) macht heute `zeigeEinlauf(false); running=true;` — der
Einlauf wartet beliebig lange auf den Klick, danach läuft es im selben Frame. Der Audit Runde 2
(`f1-broadcast-audit-runde-2-30-09.md`, Abschnitt „Kein Anpfiff-Moment", Maßnahme 22) hat genau
das unabhängig vom Fable-Papier als Befund notiert und als Klasse T eingestuft, „bei Tempo ≥ 2×
übersprungen".

**Präzedenz für Wandzeit-Overlays.** Die Viertelpause (`starteViertelpause`, `:10118`) pausiert die
Simulation nur 1,0 Sim-Sekunde (rho-sensibel, nachgemessen), zeigt aber ein Overlay mit Countdown
für 2000 ms, zur Halbzeit 3600 ms Wandzeit (`vpSichtbarBis`, `:10195`). Das Projekt hat also schon
ein Overlay, dessen Dauer von der Simulation entkoppelt ist — nur verzögert es nichts, das Spiel
läuft hinter dem Overlay weiter. A4 wäre das Erste, das die Simulation tatsächlich warten lässt.
Der Endstand-Nachlauf (3,5 s, `team-publikum-feiermomente-konzept-30-09.md` 2.6, Kommentar
`:20537`) wurde aus demselben Grund nicht gebaut und wartet ebenfalls auf Chris.

**Mehrere Spiele parallel — geprüft: gibt es nicht.** `FoundationBattleArenaHost.tsx` hängt genau
eine Motor-Instanz ein und entfernt sie beim Team-Wechsel komplett (Kopfkommentar, Z. 39–42). Der
echte Spieltag wird headless für alle Paarungen auf einmal aufgelöst; der Arena-Reiter ist eine
freie Ansicht mit beliebigen Teams, in der nichts zählt (`fable-ideen-feldspiel-30-09.md` 2.1,
`manager-risiko-interaktivitaet-konzept-02-10.md` Befund B). Eine erzwungene Verlangsamung kann
deshalb kein zweites Spiel stören. Der Fall, der wirklich vorkommt, ist ein anderer: **Chris
klickt 20 Disziplinen nacheinander durch** (Fable-Papier Abschnitt 8, Frage 1) — und Agenten
treiben die Seite per Playwright.

**Tooling.** 32 Skripte unter `scripts/` klicken `#play` (48 Stellen), 15 davon klicken `#spd`
(42 Stellen, meist zweimal für 4×). `scripts/screenshot-disziplin.mjs` — das Sichtprüfungs-Werkzeug,
das das Fable-Papier selbst für jede Klasse-A-Abnahme vorschreibt — wartet nach `#play` standardmäßig
**3000 ms** und fotografiert dann. `screenshot-broadcast-hud.mjs` wartet 2500 bzw. 300 ms.

---

## 2. D7 — „Finale in Echtzeit"

### 2.1 Was es kostet und was nicht

D7 greift nur, wenn jemand bei 2× oder 4× zuschaut **und** das Spiel in der Schlussphase knapp
steht. Dann werden die letzten 30 Zuschau-Sekunden in Echtzeit statt im Zeitraffer gezeigt:

| Ausgangstempo | letzte 30 Zuschau-Sekunden dauern heute | mit D7 | Mehrkosten je knappem Spiel |
|---|---:|---:|---:|
| 1× | 30 s | 30 s | 0 s |
| 2× | 15 s | 30 s | +15 s |
| 4× | 7,5 s | 30 s | +22,5 s |

Kein Ergebnis ändert sich, keine Tick-Folge, keine Messung — das hat der zurückgenommene Bau in
PR #1117 bit-identisch belegt und ist durch die Bauart von `loop()` garantiert. Die ganze
Entscheidung ist: **sind bis zu 22,5 Sekunden je knappem Feldspiel-Finale die Verlangsamung wert,
die der Zuschauer nicht selbst gewählt hat?**

### 2.2 Gameplay-Bewertung

**Dafür.** Das Finale ist der eine Moment, für den man ein Spiel zu Ende schaut; das Projekt baut
seit fünf Broadcast-Phasen genau auf diesen Moment hin (Führungsblitz, Comeback-Tracker, Sender-
Sting „entscheidend", Letterbox-Idee B4, Spannungs-Puls D2). Wer bei 4× sitzt, sieht den Buzzer-
Beater als Zucken im Bild. Im Fernsehen gibt es keinen Zeitraffer für die Schlussminute, und in
jedem Sportspiel (NBA 2K, FIFA, NHL) wird das Simulationstempo in den letzten Sekunden eines engen
Spiels von selbst „schwer" — das ist ein etabliertes Mittel, kein Experiment.

**Dagegen.** Erstens überschreibt D7 eine **ausdrückliche Wahl des Zuschauers**. Wer 4× gewählt hat,
hatte einen Grund — Durchklicken, Nachsehen eines Details, Prüfen einer Änderung. Eine Oberfläche,
die sagt „ich weiß besser als du, wann du hinschauen willst", ist für einen Entwurf, den Chris
hauptsächlich zum Prüfen benutzt, erst einmal lästig. Zweitens zählt in der Arena heute nichts: es
ist eine Erkundungsansicht, kein Spieltag. Der emotionale Einsatz, der die Verlangsamung
rechtfertigt, entsteht erst, wenn der Manager dort sein **eigenes** Spiel sieht (Replay-Idee
„Spiel des Tages", Feldspiel-Papier 2.1 — noch nicht entschieden). Drittens hatte der
zurückgenommene Bau drei handwerkliche Schwächen, die ein Finale eher nervig als dramatisch gemacht
hätten (Abschnitt 5, Nebenbefund 2).

**Abwägung.** Die Idee ist richtig, die harte Form (Sperre, Klick wirkungslos) ist es nicht. Die
Form, die beides versöhnt, ist das **weiche Finale**: das Tempo fällt einmal von selbst auf 1×,
sagt das sichtbar, und **ein Klick holt das gewählte Tempo zurück**. Der Zuschauer, der es nicht
will, verliert einen Klick, nicht 22 Sekunden. Der Zuschauer, der es will, muss nichts tun.

### 2.3 Konkreter Vorschlag — drei Stufen, Chris wählt

**Stufe 0 — nur Hinweis, keine Verlangsamung.** Die Tempo-Taste blinkt in der Schlussphase und
zeigt „Tempo 4× · Finale — Klick für Echtzeit"; ein Klick springt direkt auf 1× (statt die
Reihe 4× → 1× zu durchlaufen, die ohnehin dort landet). Nichts verändert die Wandzeit von selbst;
nach der Klassen-Definition des Fable-Papiers wäre das Klasse A. Aber: dieselbe Definition hat D7
und A4 schon falsch eingestuft, deshalb soll auch Stufe 0 **nicht ohne Chris' Blick** gebaut werden
— er soll die Einstufung bestätigen, nicht ein Agent. Stufe 0 ist der Rückfall, wenn Chris D7 als
automatische Verlangsamung ablehnt, aber den Moment trotzdem markiert haben will. Sie kombiniert
sich gut mit B4 (Letterbox) und D2 (Spannungs-Puls), die denselben Auslöser lesen.

**Stufe 1 — weiches Finale, nur Feldspiel (Empfehlung).**

* **Auslöser (alle drei Bedingungen zugleich):**
  1. letzte Periode (`fsLive.viertel===L.perioden`), keine Pause;
  2. Restzeit ≤ 30 Zuschau-Sekunden, also `restRoh*zeitFaktor()<=30`, **einschließlich
     Nachspielzeit** (`restRoh<0`) — der zurückgenommene Bau hat die Nachspielzeit ausgeschlossen,
     genau die Phase, in der ein knappes Spiel entschieden wird;
  3. Abstand „eine Aktion gleicht aus": Basketball ≤ 3 (ein Dreier), Hockey ≤ 1 (ein Tor),
     Football ≤ 8 (Touchdown plus Zwei-Punkte-Versuch). Das sind die „one-possession game"-
     Definitionen aus NBA/NHL/NFL-Übertragungen, keine Erfindung — aber Chris kann sie setzen, wie
     er will (Vorlage in Abschnitt 4).
* **Hysterese:** einmal ausgelöst, bleibt das Finale bis `done`, auch wenn der Abstand kurz darauf
  über die Schwelle wächst. Sonst springt das Tempo bei 4 → 2 → 4 Punkten Differenz hin und her,
  was im zurückgenommenen Bau (Prüfung je Frame) passiert wäre.
* **Wirkung:** nur wenn `speed>1`. Der wirksame Multiplikator fällt auf 1; `speed` selbst bleibt
  der Wunschwert des Zuschauers (so war es auch im zurückgenommenen Bau — das ist richtig).
* **Anzeige:** Tempo-Taste „Tempo 1× · Finale (Klick: zurück auf 4×)", zusätzlich der vorhandene
  `hud-in`-Übergang; kein neuer Ton (D3 hat schon „entscheidend").
* **Opt-out je Spiel:** ein Klick auf `#spd` während des Finales hebt die Drosselung **für dieses
  Spiel** auf und stellt das Wunschtempo wieder her. Der Klick wird **nicht verschluckt** — das
  Verschlucken aus PR #1117 hätte sowohl den Zuschauer als auch jedes Skript, das `#spd` zweimal
  klickt, um einen Schritt verschoben.
* **Opt-out dauerhaft:** ein Schalter neben Ton/Lautstärke, „Finale in Echtzeit", gespeichert in
  `localStorage` wie `bkMuted`. Standard: **an** — das ist die eigentliche Frage an Chris; wer die
  Arena überwiegend zum Prüfen nutzt, wird es ausschalten und nie wieder sehen.
* **Sonden-Schalter:** ein ausdrücklicher Aus-Schalter für Skripte (z. B. `window.__arena.
  finaleEchtzeit(false)` oder derselbe `localStorage`-Schlüssel vor `#play`). Ausdrücklich **nicht**
  automatisch über `navigator.webdriver`: dann sähen Screenshots der Agenten etwas anderes als
  Chris, und genau diese Screenshots sind die Sichtabnahme.

**Stufe 2 — weitere Chassis, später und nur zusammen mit B4/D2.** Die übrigen Disziplinen haben
keine Restzeit, aber natürliche Entscheidungsphasen, die das Fable-Papier für B4 schon benannt hat:
Kampf Sudden Death (`t>KAMPF_SUDDEN_DEATH_T`), Wettessen letzte Minute (`letzteMinute`-Flag
existiert, `:23319`), Schach Zeitnot, Staffel letztes Bein bei kleinem Delta, Zeitfahren letzter
Fahrer mit Siegchance. Vorschlag: **ein** Prädikat „Entscheidungsphase" je Chassis, das B4
(Letterbox), D2 (Puls) und D7 (Tempo) gemeinsam lesen — und das erst gebaut wird, wenn eine dieser
drei Ideen ohnehin an der Reihe ist. Für diese Runde: nicht.

### 2.4 Tooling-Nebenwirkung, die vor dem Bau geklärt gehört

15 Skripte klicken `#spd` auf 4×, mehrere davon im Feldspiel (`probe-hockey-ton.mjs`,
`schiesse-basketball-vergleich.mjs`, `sonde-wertungstabelle.mjs`, `screenshot-broadcast-hud.mjs`).
Mit D7 dauert ein knappes Spiel dort bis zu 22,5 s länger; Skripte, die auf `window.__arena.vorbei()`
warten, merken nichts, Skripte mit fester Wartezeit bis zum Endstand könnten den Endstand verpassen.
Bedingung für den Bau: die 15 Skripte einmal durchsehen und den Sonden-Schalter von oben in die
betroffenen setzen. Das ist ein Nachmittag, kein Projekt — aber es gehört in denselben Task, nicht in
einen späteren.

### 2.5 Tendenz zu D7 (Vorschlag an Chris, keine Entscheidung)

**Empfehlen — nur in der weichen Form (Stufe 1) und nur mit den Bedingungen oben:** Feldspiel
allein, Hysterese, Nachspielzeit inklusive, Klick stellt das Wunschtempo wieder her, dauerhafter
Schalter, Sonden-Schalter, 15 Skripte geprüft. Die harte Form aus dem ersten Bau (Klick wirkungslos)
würde ich **nicht** empfehlen. Lehnt Chris jede automatische Verlangsamung ab, bleibt Stufe 0 als
Rückfall, die den Moment markiert, ohne die Uhr anzufassen.

Ehrlich dazu: der Gewinn wird erst richtig groß, wenn der Manager in der Arena sein **eigenes**
Spiel sieht (Replay 2.1). Solange die Arena eine Erkundungsansicht ist, ist D7 ein nettes Detail —
und ein Detail, das Chris beim Durchklicken eher stört als freut. Wenn er nur eine der beiden Ideen
dieses Papiers freigeben will, wäre A4 die mit dem breiteren Effekt (alle 20 Disziplinen, jedes
Spiel), D7 die mit dem tieferen (drei Disziplinen, nur knappe Spiele).

---

## 3. A4 — Anpfiff-Countdown

### 3.1 Was fehlt und warum es zwei Papiere unabhängig voneinander gefunden haben

Heute: Klick → Einlauf weg → es läuft, im selben Frame. In fünf Bahn-Disziplinen und im Football
ertönt das Startsignal mitten im Bild, ohne dass das Bild darauf vorbereitet wäre; die Scoreline
zeigt vor dem Klick schon „0:00 · läuft". Das Fable-Papier (A4) und der Audit Runde 2 (Maßnahme 22,
„Kein Anpfiff-Moment") haben das unabhängig voneinander als eine der deutlichsten Stellen genannt,
an denen die Arena keine Sendung ist. Der Befund ist also doppelt belegt; strittig ist nur der
Preis.

### 3.2 Die Tooling-Voraussetzung — gefunden und benannt

Der Build-Agent von PR #1117 hat sie in der PR-Beschreibung festgehalten: `scripts/screenshot-
disziplin.mjs` wartet nach `#play` standardmäßig **3000 ms** — exakt die vorgeschlagene Countdown-
Dauer. Mit A4 fotografierte das Skript standardmäßig den Countdown statt des laufenden Spiels: eine
stille Regression des Werkzeugs, mit dem jede Broadcast-Änderung abgenommen wird. Dazu kommen 31
weitere Skripte, die `#play` klicken und danach 300–4000 ms fest warten.

Die Reparatur, die **vor** A4 gehört (und die der PR-Agent selbst vorgeschlagen hat):

1. **Ein gemeinsamer Helfer** `warteAufAnpfiff(seite)`, der auf einen vom Motor ausgewiesenen
   Zustand wartet (z. B. `window.__arena`-Abfrage „läuft und erster Tick ist durch") statt auf eine
   feste Zeit — und die festen `waitForTimeout`-Werte in den 32 Skripten darauf umstellen, soweit
   sie den Spielstart meinen (nicht jede Wartezeit meint das; manche warten bewusst „bis Sekunde 9").
2. **Ein ausdrücklicher Aus-Schalter** für den Countdown (`window.__arena.anpfiffCountdown(false)`
   oder URL-Parameter vor `#play`), den Sonden setzen, die den Countdown nicht brauchen. Wieder
   **nicht** automatisch per `navigator.webdriver`: Screenshot-Skripte sollen den Countdown sehen
   können, wenn man ihn prüfen will.

Das ist der größere Teil der A4-Arbeit — der Countdown selbst ist ein Overlay mit drei Zahlen und
einem vorhandenen Ton aus `TON_KATALOG`. Aufwand für die Tooling-Runde: ein Tag, weil 32 Dateien
gelesen werden müssen; Aufwand für A4 selbst danach: klein. A3 (Stinger-Wischer) hängt direkt
daran und sollte im selben Task mitkommen — ohne A4 hat er keinen Einsatzpunkt.

### 3.3 Wie lang, und womit gefüllt

**Dauer: 2,5–3 Sekunden bei 1×, nicht länger.** Darunter liest man die drei Stufen nicht, darüber
wird es Wartezeit. Chris' eigene Voreinstellung aus dem Fable-Papier (Abschnitt 8, Frage 1, noch
unbeantwortet): **bei Tempo ≥ 2× überspringen**, und **ein Klick bricht ab**. Beides übernehme ich
als Vorschlag; „Klick" heißt konkret: zweiter Klick auf die Play-Taste während des Countdowns =
„Anpfiff jetzt". Außerdem: beim Fortsetzen nach „Pause" kein Countdown — nur beim ersten Start eines
Spiels (und nach `reset()`).

**Füllung: nicht „3 · 2 · 1", sondern das Startritual der Sportart.** Ein nummerischer Countdown ist
eine Videospiel-Konvention (Rocket League, Mario Kart), keine Sendungs-Konvention; die Olympiade
will nach Übertragung aussehen. Fast jede Disziplin bringt ihr eigenes Ritual mit, und das ist mit
derselben Technik (Overlay, drei Stufen, Ton am Ende) genauso billig — eine Tabelle mit drei
Strings je Chassis, ähnlich den Play-Tasten-Beschriftungen in `reset()`:

| Chassis | Stufen (je ~0,9 s) | Schlusston (vorhanden) | Dauer |
|---|---|---|---|
| Bahn: Spurt, Staffel, Takeshi | „Auf die Plätze" · „Fertig" · — | Startschuss | 2,5 s |
| Bahn: Zeitfahren, Climbing | „5 · 4 · 3 · 2 · 1" als Piepton-Countdown (Radsport/IFSC-Speed, dort echt) | Starttonfolge | 3 s |
| Fechten | „En garde" · „Prêts" · „Allez" | Fechten-Ton | 2,5 s |
| Kampf: TDM, Mini-DM, Battlefield | „Bereit" · — · „Kampf!" | Gong | 2 s |
| Feldspiel: Basketball, Hockey, Football | nur ein Schiedsrichter-Beat: Wappen fahren auseinander, Pfiff | Pfiff / Puckdrop-Ton | 1,5 s |
| Bühne-Duell: Schach, Tennis | „Uhren laufen" · — | Uhr-Klick | 1,5 s |
| Bühne-Auftritt: Eiskunstlauf, Showcase, Gewichtheben, Breaking, I-Spy | Ansage „Auf der Bühne: …" (Gewichtheben hat „Nächster: …" schon) | Applaus | 2 s |
| Wettessen | „3 · 2 · 1" — hier ist der Zahlencountdown das echte Ritual | Buzzer | 3 s |

Das ist derselbe Gedanke wie die Play-Tasten-Wörter „Anpfiff / Start / Auftakt / Kampf starten":
eine Sendung sagt nicht in jeder Sportart dasselbe. Wenn Chris das zu viel findet, ist das
generische „3 · 2 · 1" mit der Typo von `#vpCountdown` der schlichte Rückfall; die Tabelle kostet
gegenüber dem generischen Countdown eine Stunde, nicht einen Tag.

### 3.4 Wartezeit-Kosten, ehrlich gerechnet

| Nutzung | Mehrkosten durch A4 |
|---|---:|
| ein Spiel bei 1× ansehen | +1,5 bis +3 s, einmal |
| 20 Disziplinen bei 1× durchklicken | +30 bis +60 s je Durchgang |
| 20 Disziplinen bei 2×/4× durchklicken | 0 s (übersprungen) |
| Agent-Sonden mit Schalter | 0 s |
| Fortsetzen nach Pause | 0 s |

Mit Überspringen bei ≥ 2× und Abbruch per Klick ist der einzige Fall, der wirklich kostet, das
Durchklicken bei 1× — und das ist genau der Fall, in dem jemand die Sendung sehen will.

### 3.5 Tendenz zu A4 (Vorschlag an Chris, keine Entscheidung)

**Empfehlen — mit drei Bedingungen:** (1) Tooling zuerst, im selben Task (Helfer + Aus-Schalter +
Durchsicht der 32 Skripte), sonst bricht die Sichtabnahme stillschweigend; (2) 1,5–3 s je Chassis,
Überspringen bei ≥ 2×, zweiter Klick = sofort Anpfiff, kein Countdown nach Pause; (3) A3 im selben
Task. Als Füllung das Startritual der Sportart statt „3 · 2 · 1", wenn Chris die Tabelle mag.

Ehrlich dazu: der Broadcast-Gewinn von A4 ist real, aber kleiner als der von B1 (Regie-Kamera) oder
A5 (Spieler des Spiels), die beide ohne Wandzeit auskommen. Wenn Chris Wandzeit grundsätzlich nicht
anfassen will, verliert das Projekt mit „Nein zu A4" weniger als mit „Nein zu B1". Und: der
Endstand-Nachlauf (3,5 s nach dem Schlusspfiff, Feiermomente 2.6) ist dieselbe Art Entscheidung —
es wäre sinnvoll, **Countdown vor dem Spiel und Nachlauf nach dem Spiel in einem Zug** zu
entscheiden, damit der Sendungsrahmen aus einem Guss ist und nicht in zwei Tasks halb entsteht.

---

## 4. Entscheidungsvorlage für Chris

Nichts davon ist vorausgefüllt. Was leer bleibt, wird nicht gebaut.

**D7 — Finale in Echtzeit**

* [ ] Nein — keine automatische Verlangsamung. (Dann optional: [ ] Stufe 0 „nur Hinweis" prüfen.)
* [ ] Ja, weiches Finale (Stufe 1) mit:
  * Restzeit-Schwelle: ____ Zuschau-Sekunden (Vorschlag 30), Nachspielzeit inklusive [ ] ja [ ] nein
  * Abstand: Basketball ≤ ____ (Vorschlag 3) · Hockey ≤ ____ (1) · Football ≤ ____ (8)
  * Klick auf die Tempo-Taste stellt das Wunschtempo wieder her: [ ] ja [ ] nein
  * dauerhafter Schalter „Finale in Echtzeit", Standard: [ ] an [ ] aus
  * nur Feldspiel in dieser Runde: [ ] ja [ ] andere Chassis gleich mit (dann welche: ____)
* [ ] Ja, harte Form wie im ersten Bau (Klick wirkungslos) — nicht empfohlen, aber Chris' Wahl.

**A4 — Anpfiff-Countdown**

* [ ] Nein.
* [ ] Ja, mit:
  * Dauer bei 1×: ____ s (Vorschlag 1,5–3 je Chassis)
  * bei Tempo ≥ 2× überspringen: [ ] ja [ ] nein
  * zweiter Klick bricht ab: [ ] ja [ ] nein
  * Füllung: [ ] Startritual je Chassis (Tabelle 3.3) [ ] generisch „3 · 2 · 1"
  * A3 Stinger im selben Task: [ ] ja [ ] nein
  * Tooling-Runde (Helfer + Schalter + 32 Skripte) zuerst, im selben Task: [ ] ja
* [ ] Endstand-Nachlauf (3,5 s, Feiermomente 2.6) gleich mit entscheiden: [ ] ja [ ] nein [ ] später

Umsetzung — falls Ja — erst nach diesem ausgefüllten Go, frühestens ab 03.10. abends (Task #48),
als eigener Task mit genau diesem Umfang. Kein Agent leitet aus diesem Papier eine Freigabe ab.

---

## 5. Nebenbefunde (keine Entscheidungen, nur gefunden)

1. **Die Klasse-T-Regel steht nicht in `CLAUDE.md`.** PR #1117 und der Code-Kommentar bei
   `:40065` berufen sich auf „CLAUDE.md"; das Root-`CLAUDE.md` dieses Checkouts enthält aber keinen
   Absatz zu Klasse T oder Wandzeit. Die Regel lebt im Klassenschema des Fable-Papiers (Abschnitt
   0), in den Backlog-Tasks (#6, #13, #48) und in PR-Beschreibungen. Dass sie zweimal (PR #1111,
   #1117) erst im Review griff, spricht dafür, sie dorthin zu schreiben, wo jeder Agent sie vor dem
   Bau liest — ob und wie, ist Chris' Sache.
2. **Der zurückgenommene D7-Bau hatte drei Schwächen**, die wer auch immer nach einem Go baut,
   kennen sollte: (a) Prüfung je Frame ohne Hysterese → Tempo-Flattern bei wechselndem Abstand;
   (b) Nachspielzeit (`restRoh<0`) ausgeschlossen, obwohl sie das Finale ist; (c) Klick auf `#spd`
   verschluckt → verschiebt die 1×/2×/4×-Reihe für Zuschauer und für Skripte, die zweimal klicken.
3. **Vier Dinge warten unter derselben Überschrift auf Chris:** D7, A4 (+A3), der Endstand-
   Nachlauf (3,5 s) und D10 (Drittelpause Hockey, laut Task #6 ebenfalls T). Eine Entscheidung
   „Wandzeit im Sendungsrahmen: ja/nein, und wie viel" würde alle vier auf einmal lösen.
4. **Replay „Spiel des Tages" (Feldspiel-Papier 2.1) ist der Multiplikator für D7.** Solange in
   der Arena nichts zählt, ist ein Echtzeit-Finale Dekoration; sobald der Manager sein eigenes
   Spiel nachsieht, ist es der Moment, für den die Arena da ist. Falls Chris D7 heute ablehnt,
   lohnt die Frage nach dem Replay-Go erneut.

## Quellen im Repo

`public/mockups/battle-mode.engine.js` (`speed` `:28229`, `ZEIT_DEHNUNG` `:39990`, `loop()`
`:40073`, D7-Kommentar `:40065`, `#spd`-Handler `:42709`, Play-Handler `:42677`, `reset()`
`:42452`, `starteViertelpause` `:10118`/`vpSichtbarBis` `:10195`, `feldspielRestzeitAbwaerts`
`:12900`, `FELDSPIEL_ART[...].live` `:6305`/`:6356`/`:6768`, Endstand-Nachlauf-Kommentar `:20537`,
Wettessen `letzteMinute` `:23319`, Sudden Death `:31843`);
`app/foundation/battle-arena/FoundationBattleArenaHost.tsx` (Einzelinstanz, Z. 16–43);
`scripts/screenshot-disziplin.mjs` (`wartenMs` Default 3000, Z. 9/82/111),
`scripts/screenshot-broadcast-hud.mjs`; 32 Skripte mit `#play`, 15 mit `#spd` (Grep 02.10.);
`docs/design/fable-ideen-broadcast-praesentation-30-09.md` (A4, D7, B4, D2, Abschnitt 7/8);
`docs/design/f1-broadcast-audit-runde-2-30-09.md` (Maßnahme 22, Abschnitt 6.1);
`docs/design/team-publikum-feiermomente-konzept-30-09.md` (2.6 Endstand-Nachlauf);
`docs/design/fable-ideen-feldspiel-30-09.md` (2.1 Replay);
`docs/design/manager-risiko-interaktivitaet-konzept-02-10.md` (Befund B);
PR #1117 (Beschreibung, Commits `dfb93f6d` Bau und `06666101` Rücknahme); Backlog-Tasks #6, #13, #48.
