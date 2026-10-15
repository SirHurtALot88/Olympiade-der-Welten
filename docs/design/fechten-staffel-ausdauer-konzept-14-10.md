# Fechten-Staffel vs. Peiniger-Gauntlet: Chris' Antwort auf E3 hat zwei Teile, nicht einen (14.10.)

**Konzeptpapier, kein Code geändert, nichts gemergt.** Grundlage: Frage E3 aus
`docs/design/fable-konzept-chris-feedback-13-10.md` Abschnitt 9 ("Fechten: Mannschaftsstand als
kumulierte Staffel (real olympisch) oder weiter 'Bahnen gewonnen'?"), heute von Chris beantwortet,
wörtlich:

> „wenn das olympisch so läuft dann in der staffel - oder ein spieler tritt an und wenn er den
> gegner besiegt bleibt er stehen, aber seine ausdauer sinkt natürlich und er wird dann mit der
> zeit schwächer damit ein 90er spieler nicht alle 5 gegner platt macht egal ob sie 20 oder 85
> haben"

**Nichts an `public/mockups/battle-mode.engine.js` wurde für dieses Papier geändert.** Alle Zahlen
unten kommen entweder aus einer frischen, unveränderten Messung des heutigen Motors oder aus
bereits vorhandenen, zitierten Quellen (Code-Kommentare, eine seit zwölf Tagen offene Draft-PR,
ein am selben Tag von einem anderen Agenten gemessener Befund).

---

## 0. Ergebnis vorab

1. **Chris' Satz zerfällt in zwei Antworten, die sich widersprechen, nicht in eine Antwort mit
   einer Ergänzung.** Der erste Teil ("wenn das olympisch so läuft, dann in der Staffel") wählt
   das reale olympische Mannschaftsfechten-Format. Der zweite Teil ("ein Spieler tritt an und
   bleibt stehen … damit er nicht alle 5 Gegner platt macht") beschreibt einen **Gauntlet**
   (King-of-the-Hill) — strukturell etwas anderes, nicht real-olympisch, und bereits einmal für
   genau diese Disziplin explizit verworfen (Abschnitt 3).
2. **Teil 1 ist bereits gebaut und gemessen** — und liegt seit dem 2.10. ungemerged als Draft in
   PR #1111. Das ist der größte Einzelbefund dieses Papiers: die Arbeit, die E3 freigibt, existiert
   schon, nur losgelöst von main (Abschnitt 2).
3. **Teil 2 passt auf keine der beiden Paarungsstrukturen** — weder die heutige (`BUEHNE_ART.fechten`,
   live) noch die in PR #1111 gebaute. In beiden trifft jeder der sechs Fechter über das ganze
   Spiel auf **genau einen** Gegner (Slot i gegen Slot i), nie auf fünf. Das Bild „ein 90er Spieler
   macht nicht alle 5 Gegner platt" beschreibt eine Struktur, die es im Fechten-Entwurf nirgends
   gibt — weder heute noch in der wartenden PR (Abschnitt 3).
4. **Empfehlung:** PR #1111 reaktivieren (Rebase auf aktuellen `main`, frische Messung, dann als
   echter Produktions-PR) — das setzt genau um, was Chris mit „dann in der Staffel" bestellt hat.
   **Keinen Gauntlet für Fechten bauen.** Nicht weil die Idee grundsätzlich schlecht wäre, sondern
   weil sie dem gerade gewählten Format widerspricht, für Fechten schon einmal mit Begründung
   verworfen wurde, und weil das einzige Gauntlet-Beispiel im Projekt (Breaking) **heute, am
   selben Tag**, von einem anderen Agenten bei einem Puffer gemessen wurde, der bei n=48 bereits
   durchfällt (Abschnitt 3.3).
5. Falls Chris nach dieser Klarstellung den Gauntlet trotzdem ausdrücklich will — **anstatt** der
   Staffel, nicht zusätzlich dazu —, ist das ein neuer, eigenständiger Chassis-Bau mit eigener
   Messrunde, grob skizziert in Abschnitt 6. Nicht Teil dieser Runde.

---

## 1. Was heute im Motor läuft (verifiziert, nicht vermutet)

`BUEHNE_ART.fechten` (`battle-mode.engine.js:16221`): `jeSeite:6, rundenN:9, duell:true,
fechten:true`. Daraus folgt eine feste Struktur, die der Rest dieses Papiers voraussetzt:

- **Paarung:** sechs parallele 1-gegen-1-Gefechte, Slot i gegen Slot i (`art.duell`-Paarungsblock,
  `:17485 ff.`) — jeder Fechter ficht **seine eigenen 9 Gänge gegen genau einen Gegner**, nie gegen
  mehrere.
- **Board-Entscheid:** `gefechtSieg`, der Trefferstand (F1, PR #1033, bereits live seit 26.09.) —
  bei Treffergleichstand entscheidet ein vorab gezogenes Prioritäts-Los (reale Degen-Zusatzminute).
- **Teamstand:** `duellBretterGewonnen()` — **gewonnene Bahnen** (0/1 je Board), **nicht**
  kumulierte Treffer. Das ist die Zahl, die E3 zur Debatte stellt.
- **Enthüllungsreihenfolge:** der generische Rhythmus „Durchgang 1 aller sechs Bahnen, dann
  Durchgang 2 …" (`:17868-17877`), **nicht** sequentiell pro Bahn.
- **Kein Ermüdungsmechanismus über mehrere Gegner hinweg.** Es gibt nur die generische,
  rundenweise `ermued`-Formel innerhalb EINES Gefechts (`:17223`/`:17393`,
  `1-max(0,60-u.AUSDAUER)*0,0035*(ri/(rundenN-1))`) — sie dämpft die Erfolgschance späterer eigener
  Gänge GEGEN DENSELBEN Gegner leicht, trägt aber nichts von Gefecht zu Gefecht weiter. Fechtens
  Matrix kennt zudem **kein eigenes `stamina`-Attribut** (torment 25, dexterity 20, speed 16,
  awareness 15, power 10, determination 6, health 4, intelligence 4) — der AUSDAUER-Rezeptkanal
  ist `speed:40,power:35,health:25` und trägt laut Code-Kommentar nur **1,9 % mechanisches
  Gewicht** ("kein toter Kanal wie Climbings ROBUST, nur schwach").

**Frisch gemessen für dieses Papier** (unveränderter Motor, live-save-Kaderfamilie):

```
node scripts/miss-alle-disziplinen.mjs 24 fechten
→ rho je Spiel (Median) 0,860   Spannweite 0,191   rho Saison 0,937   bestanden

node scripts/messe-arena-einfluss.mjs fechten 24
→ Pp 20,2

node scripts/messe-arena-einfluss.mjs fechten 24 --saat-versatz=10000000
→ Pp 21,2
```

Beide Pp-Ströme klar unter der 25er-Schranke, rho klar über 0,80 (sogar über dem aspirativen
0,85-Ziel bei der Saisonzahl, Spielzahl mit solidem Puffer von 0,06). Das ist der Ausgangspunkt,
gegen den jede Änderung unten gehalten werden muss.

---

## 2. Teil 1 von Chris' Satz ist bereits gebaut — und liegt seit zwölf Tagen fest

`docs/design/fable-ideen-buehne-duell-30-09.md` Abschnitt 3 (F-F1 „Die Fechtstaffel") beschreibt
exakt das, was Chris heute bestellt: sequentielle Enthüllung, **Teamstand = kumulierte Treffer**
statt gewonnener Bahnen, Aufstellung als taktische Entscheidung. Das wurde umgesetzt — **PR #1111**,
„Fable Bühne-Duell Paket 3: Fechten-Format (F-F1 Staffel + F-F2 Mensur)", Branch
`fable-buehne-duell-paket3-fechten-format-01-10`, erstellt 02.10., Status: **offen, Draft,
unverändert seit der Erstellung**.

Was die PR tut (Commit `445c6bc8`, PR-Beschreibung):

- **F-F1:** Enthüllung sequentiell (Gefecht 1 komplett, dann Gefecht 2, …) statt verschränkt;
  Teamstand in `spieleBuehneDuell()` wechselt **nur für `art.fechten`** von „Bahnen gewonnen" auf
  kumulierte Treffer (`BUEHNE_ART[bd].fechten?[treffer(0),treffer(1)]:[bretter(0),bretter(1)]`).
- **F-F2:** die Mensur (Variante A) — Chris' Tauzieh-Auftrag vom 22.09. wird von reiner Anzeige zur
  Regel: ein Zustand `mensur ∈ [-1,+1]` verschiebt sich je Gang um die Rundenpunkt-Differenz, bei
  Grenzüberschreitung fällt ein zusätzlicher Treffer — nur in `u.treffer`/`gefechtSieg`, nie in
  `u.summe`.

**Damals gemessen** (Basis PR #1109, 01.10.): rho 0,836 bit-identisch vor/nach (per Konstruktion,
`u.summe` bleibt unberührt), Pp 20,2/21,2 bit-identisch, Spiegelsymmetrie **verbessert** (1,0 % →
0,2 % Abweichung über 300 Läufe), Teamsieg-Verteilung realistischer verteilt (74:67:59-Unentschieden
bei reiner Bretterzählung → 140:130:30-Unentschieden bei kumulierten Treffern — weniger
Gleichstände, wie es ein Punktesummen-Format gegenüber einer 6-Bahnen-Zählung erwarten lässt).

**Was das für eine Reaktivierung bedeutet:**

- Die Branch-Basis ist `cd8b7052` (PR #1109). `main` steht heute bei `cff489b8` (PR #1208) — **147
  Commits dazwischen**. Das ist kein Konflikt-freier Merge-Klick, sondern braucht einen Rebase und
  eine frische Messung gegen den heutigen Stand (die Zahlen oben in Abschnitt 1, 0,860/0,191,
  20,2/21,2 Pp, sind die neue Baseline, nicht mehr 0,836).
- **Mögliche Überschneidung mit Q1 „Matchup-Folge"** (`fable-konzept-chris-feedback-13-10.md`
  Abschnitt 3.1, noch nicht gebaut — im Code nirgends ein Treffer für „Matchup-Folge" o.ä.): Q1
  plant denselben sequentiellen Reveal nochmal, aber generischer für mehrere Bühnen-Disziplinen
  (Schach/Fechten/Tennis/Showcase/Eiskunstlauf) zusammen mit einer Matchup-Karte. Wird Q1 zuerst
  gebaut, deckt es den F-F1-Reveal-Teil vermutlich ab und #1111 bräuchte beim Rebase nur noch den
  Teamstand-Teil (kumulierte Treffer) und F-F2. Das ist keine Entscheidung, die dieses Papier
  trifft — nur ein Abhängigkeits-Hinweis für die Reihenfolge der beiden Bauschritte.
- Der Teamstand-Teil (kumulierte Treffer statt Bahnen gewonnen) ist von Q1 **unabhängig** und
  direkt umsetzbar, sobald E3 beantwortet ist — und das ist jetzt der Fall.

---

## 3. Teil 2 von Chris' Satz: wieso er nicht zur Staffel passt

### 3.1 Strukturell gibt es "5 Gegner" nirgends

Sowohl die heutige Produktion als auch PR #1111 fixieren `jeSeite:6`: sechs Fechter je Team, Slot i
gegen Slot i, über das gesamte Spiel. **Ein einzelner Fechter sieht genau einen Gegner, nie fünf.**
Das Bild aus Chris' zweitem Satz — „ein Spieler tritt an, besiegt den Gegner, bleibt stehen, der
nächste kommt" — setzt eine andere Struktur voraus: **ein** Fechter pro Team tritt sequentiell gegen
mehrere/alle gegnerischen Fechter an, bis er verliert. Das ist ein **Gauntlet**
(King-of-the-Hill), keine Staffel. Beide Strukturen sind nicht gleichzeitig sinnvoll kombinierbar:
die Staffel beruht darauf, dass alle sechs Fechter gleichzeitig ihre eigenen, vollständigen neun
Gänge liefern; ein Gauntlet beruht darauf, dass die meisten Fechter vorzeitig ausscheiden und ihre
Gänge verlieren.

### 3.2 Für Fechten war der Gauntlet bereits eine bewusst verworfene Option

`fable-ideen-buehne-duell-30-09.md`, Abschnitt F-F1, eigener Zwischentitel „**Warum das kein
zweiter Gauntlet ist**" (Z. 241-245):

> „Breakings Gauntlet drückte rho zunächst auf 0,707, weil ein früh ausgeschiedener Kämpfer seine
> Ereignisse verlor (Gambler's Ruin). In der Staffel ficht jeder genau seine 9 Gänge, nichts wird
> abgeschnitten; geteilt ist nur der Stand, nicht die Zahl der Würfe."

Das ist keine beiläufige Bemerkung, sondern der zentrale Grund, warum F-F1 überhaupt als Staffel
entworfen wurde statt als Gauntlet — und exakt das Prinzip, das CLAUDE.md an anderer Stelle
allgemein festhält: weniger Ereignisse je Teilnehmer senken die Verlässlichkeit, und ein Gauntlet
entzieht dem Verlierer genau diese Ereignisse, strukturell, nicht zufällig.

### 3.3 Der lebende Präzedenzfall steht heute selbst auf der Kippe

Breaking ist das einzige Gauntlet-Chassis im Projekt (`baueGauntlet()`/`gauntletRunde()`/
`gauntletVerschnaufen()`, `battle-mode.engine.js:20075 ff.`). Es trägt bereits fast exakt das, was
Chris für Fechten beschreibt: ein Teilnehmer bleibt stehen, solange er gewinnt, sein HP (seine
„Ausdauer" im weiteren Sinn) sinkt mit jedem Austausch, ein `GAUNTLET_PEINIGER_DECKEL` begrenzt,
wie stark der Stärkere den Schwächeren dominiert, und `GAUNTLET_ERMUED_ANSCHLAEGE` lässt die
Erfolgschance über **eigene, aufeinanderfolgende** Gänge sinken — gelesen aus `AUSDAUER`, exakt der
Kanal, den Chris' Satz meint.

**Am selben Tag (14.10.), von einem anderen Agenten gemessen**
(`docs/design/breaking-phasen-peiniger-konzept-14-10.md`, Branch
`breaking-phasen-peiniger-konzept-14-10`, noch nicht auf `main`):

- Die bisher zitierte Breaking-Abnahmezahl (0,801 bei n=24) hält bei realistischerem
  Stichprobenumfang **nicht**: `node scripts/miss-alle-disziplinen.mjs 48 breaking` → **rho 0,795,
  durchgefallen** — am unveränderten Motor.
- Der Peiniger-Deckel (B2, „der gewinnende Spieler drängt den Verlierer") wurde bereits von ±20 %
  über ±10 % auf **±5 %** gesenkt, weil jede höhere Stufe die Schranke reißt (±20 % maß 0,784,
  ±10 % maß 0,792 — beide unter 0,80). **±5 % ist die einzige bisher geprüfte Einstellung, die
  überhaupt hält**, und sie hält knapp.
- Kaderfamilie-Spannweite bei Breaking: 0,25-0,33 — mehr als das Dreifache des Abstands zur
  0,80-Schranke selbst.

Fechten steht heute bei rho 0,860 mit Spannweite 0,191 (Abschnitt 1) — **ein spürbar dickerer
Puffer als Breaking**, und zwar genau deshalb, weil Fechten kein Gauntlet ist: jeder der sechs
Fechter liefert seine vollen neun Gänge, unabhängig vom Ausgang der anderen fünf Gefechte. Ein
Gauntlet-Umbau würde diesen strukturellen Vorteil aufgeben und Fechten denselben Reliabilitäts-
Mechanismus aussetzen, an dem Breaking heute selbst nur knapp (und bei n=48 nicht mehr) besteht.

### 3.4 Chris' eigentliche Sorge ist durch die Staffel bereits gegenstandslos — nicht gelöst, sondern nie gestellt

Der Kern von Chris' zweitem Satzteil ist eine **Dominanz-Sorge**: ein 90er-Spieler soll nicht
„alle 5 Gegner platt machen, egal ob sie 20 oder 85 haben". In der Staffel (Teil 1, bereits gebaut)
stellt sich diese Frage nicht, weil sie strukturell gar nicht entstehen kann — ein Fechter mit
Eignung 90 trifft auf genau einen Gegner, nicht auf fünf unterschiedlich starke. Seine Dominanz
bleibt auf sein eigenes Brett beschränkt; die anderen fünf Gefechte laufen unabhängig von seiner
Leistung. Die Sorge wird erst **durch den Gauntlet selbst erzeugt** — sie ist die Kehrseite genau
der Struktur, die Chris im zweiten Satzteil vorschlägt, nicht ein Problem, das diese Struktur löst.
Breakings `GAUNTLET_PEINIGER_DECKEL`-Geschichte (Abschnitt 3.3) zeigt das sehr konkret: ohne engen
Deckel dominiert exakt das, wovor Chris' Satz warnt.

---

## 4. Wo das Ausdauer-Bild im Fechten heute schon sitzt (Präzedenz, kein neuer Kanal)

Falls Chris das „wird mit der Zeit schwächer"-Gefühl **innerhalb** der Staffel stärker spürbar
haben will (nicht über mehrere Gegner, sondern über die eigenen neun Gänge gegen denselben
Gegner): der Hebel existiert bereits. Die generische `ermued`-Formel (`:17223`/`:17393`) liest
`u.AUSDAUER` und dämpft spätere eigene Gänge leicht. Fechtens Rezept speist AUSDAUER aus
`speed:40,power:35,health:25` — den einzigen matrixlizenzierten Attributen, die dem Bild
„körperliche Ausdauer" am nächsten kommen (Fechtens Matrix hat kein eigenes `stamina`-Attribut,
und die Matrix ist gesperrt, s. CLAUDE.md). Heute trägt dieser Kanal nur 1,9 % mechanisches
Gewicht — spürbar schwächer als etwa GRUNDLAGE (36,5 %) oder TECHNIK (21,8 %). Eine künftige,
**eigene, kleine** Kalibrierrunde könnte AUSDAUER stärker gewichten, um das „wird schwächer"-Gefühl
sichtbarer zu machen — das wäre eine gewöhnliche Rezept-Kalibrierung nach demselben Muster wie die
16.09.-Fechten-Kalibrierung (`docs/design/fechten-rezeptkalibrierung-16-09.md`), **keine**
Chassis-Änderung, kein Gauntlet, eigene rho/Pp-Messrunde nötig. Das ist hier nur als bestehender
Baustein genannt, nicht als Teil dieser Empfehlung ausgearbeitet.

---

## 5. Empfehlung

1. **PR #1111 reaktivieren:** Rebase auf aktuellen `main`, frische rho/Pp/Spiegelsymmetrie-Messung
   gegen die neue Baseline (Abschnitt 1), Klärung der Reihenfolge mit Q1 „Matchup-Folge"
   (Abschnitt 2), dann als regulärer Produktions-PR. Das ist exakt das, was Chris mit „wenn das
   olympisch so läuft dann in der Staffel" freigegeben hat.
2. **Keinen Gauntlet für Fechten bauen.** Nicht aus mangelndem Respekt vor der Idee, sondern weil
   sie (a) nicht das olympische Format ist, das Chris im selben Satz als Richtschnur nennt, (b) für
   Fechten bereits einmal mit dokumentierter Begründung verworfen wurde (Abschnitt 3.2), und (c)
   das einzige existierende Gauntlet-Beispiel im Projekt am selben Tag bei einem Puffer gemessen
   wurde, der bei realistischem Stichprobenumfang bereits durchfällt (Abschnitt 3.3).
3. **Falls Chris nach dieser Klarstellung den Gauntlet ausdrücklich will** — als Ersatz für die
   Staffel, nicht als Ergänzung —, ist das ein eigener, strukturell neuer Chassis-Bau. Skizze in
   Abschnitt 6, nicht Teil dieser Runde.

---

## 6. Falls Chris den Gauntlet trotzdem will: grobe Skizze, nicht gebaut

Ein Fechten-Gauntlet würde die Sechs-Fechter-Paarung aufgeben (nicht ergänzen) und müsste, analog
zu Breakings `baueGauntlet()`/`gauntletRunde()`/`gauntletVerschnaufen()`:

- einen HP-/Ausdauer-Pool je Fechter tragen, der über aufeinanderfolgende Gefechte hinweg sinkt
  (nicht pro Gang zurückgesetzt wie heute);
- eine Erfolgschance-Dämpfung nach eigenen, aufeinanderfolgenden Gängen einführen (das
  AUSDAUER-/`ermued`-Muster existiert schon, bräuchte aber eine Umstellung von „pro Gefecht
  zurückgesetzt" auf „über die ganze Kette gezählt", wie `GAUNTLET_ERMUED_ANSCHLAEGE` es für
  Breaking tut);
- einen eigenen Dominanz-Deckel bekommen (Breakings `GAUNTLET_PEINIGER_DECKEL`-Geschichte zeigt:
  ohne engen Deckel dominiert der Stärkere zu stark, mit zu engem Deckel verschwindet Torment/
  Dexterity wieder im Rauschen);
- **eigene** rho/Pp-Messung über mindestens zwei Saatströme **und** bei n=48 (nicht nur n=24)
  bestehen — Breakings heutiger Befund zeigt ausdrücklich, dass n=24 einen bereits durchgefallenen
  Puffer verdecken kann.

Erwartetes Risiko, gestützt auf den einzigen vorhandenen Vergleichsfall: derselbe
Gambler's-Ruin-Reliabilitätsverlust, den Breaking bereits zeigt (und an dem es heute selbst nur
knapp, bei n=24, besteht) — keine „kleine, sichere Ergänzung", sondern ein Umbau mit demselben
Risikoprofil wie Breakings eigener Gauntlet.

---

## 7. Quellen

- `docs/design/fable-konzept-chris-feedback-13-10.md` Abschnitt 9 (E3) und Abschnitt 3.1.8
- `docs/design/fable-ideen-buehne-duell-30-09.md` Abschnitt 3 (F-F1/F-F2), insb. „Warum das kein
  zweiter Gauntlet ist" (Z. 241-245)
- PR #1111, `SirHurtALot88/Olympiade-der-Welten`, Branch
  `fable-buehne-duell-paket3-fechten-format-01-10`, Draft, offen seit 02.10.
- `public/mockups/battle-mode.engine.js`: `BUEHNE_ART.fechten` (`:16171 ff.`),
  `art.duell`-Paarungsblock mit `gefechtSieg` (`:17485 ff.`), generische Reveal-Reihenfolge
  (`:17868-17877`), generische `ermued`-Formel (`:17223`/`:17393`), AUSDAUER-Rezeptkanal
  (`:16289`), Breaking-Gauntlet (`GAUNTLET_HP_MAX`/`_SCHADEN_*`/`_ERMUED_ANSCHLAEGE`/
  `_PEINIGER_DECKEL`/`_VERSCHNAUFEN`, `:20075-20124`, `gauntletRunde()` `:20183`)
- `docs/design/breaking-phasen-peiniger-konzept-14-10.md`, Branch
  `breaking-phasen-peiniger-konzept-14-10` (14.10., noch nicht auf `main`) — der heutige
  Breaking-Befund, der Abschnitt 3.3 trägt
- Frische Messung dieser Runde: `node scripts/miss-alle-disziplinen.mjs 24 fechten`,
  `node scripts/messe-arena-einfluss.mjs fechten 24 [--saat-versatz=10000000]`

**Eignungsmatrix:** unangetastet, kein Override nötig — dieses Papier ändert keine
Attributgewichte.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01UYLNtXkprKr1XK4c3X2xQq
