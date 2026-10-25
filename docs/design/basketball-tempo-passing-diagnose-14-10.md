# Basketball: „zu wenig Tempowechsel/Passspiel, Spieler ballen sich zusammen" — Diagnose (14.10.)

**Auftrag:** offener Projektpunkt „Basketball: zu wenig Tempowechsel/Passspiel, Spieler ballen
sich zusammen" — vermutlich Chris' Eindruck aus der Battle Arena. Kein Datum am Auftrag selbst,
deshalb als erstes geprüft: ist das aktueller Eindruck vom heutigen Stand, oder könnte er vor den
einschlägigen Runden (25.08./26.08./30.08./26.09./K3) liegen? Nicht abschließend zu klären ohne
Chris zu fragen — s. Abschnitt 5.

**Ergebnis vorweg:** ein kleiner, geprüft risikoloser Sichtfix ist umgesetzt (Abschnitt 4). Für
die beiden härteren Teile der Beschwerde (Tempowechsel, Passspiel) ist **keine** risikoarme
Codeänderung gefunden worden — jede naheliegende Stellschraube wurde in früheren Runden bereits
gebaut, gemessen und in mehreren Fällen ausdrücklich wegen Rho-/Pp-Schaden verworfen (Abschnitt 3).
Basketballs rho liegt aktuell bei 0,790–0,795/Spiel — **knapp unter** der 0,80-Schranke, nicht
sicher darüber. Eine weitere Änderung an genau diesen Stellschrauben ohne einen neuen,
unausprobierten Mechanismus wäre ein Blindschuss auf eine bereits knappe Zahl. Dieses Dokument
legt den Befund offen, statt ihn wegzudrücken (CLAUDE.md-Linie: Football-Pp-Problem,
Battlefield-TMP/AUS-Blocker — ehrlich offen lassen statt forcieren).

## 1. Methodik

Keine Vermutung, drei unabhängige Messungen gegen den unveränderten `origin/main`-Stand:

1. **rho/Pp-Baseline** — `scripts/miss-alle-disziplinen.mjs 24/48 basketball`,
   `scripts/messe-arena-einfluss.mjs basketball`. **Abweichung vom Standardprotokoll (zwei
   unabhängige Saatströme, n=48):** zwei Läufe mit `n=48` stürzten in dieser geteilten Umgebung
   nach 10–30 Minuten mit `Target page, context or browser has been closed` ab (Browser-Crash,
   kein Timeout — vermutlich dieselbe Ressourcenknappheit, die andere Runden in dieser Session
   schon getroffen hat, s. z. B. `basketball-k3.md`s Umgebungshinweis). Ein `n=24`-Lauf (ein
   Saatstrom) lief durch (1452s) und lieferte eine Zahl in derselben Größenordnung wie die
   historische Referenz (Abschnitt 2) — ausreichend, um die Frage „ist das noch ein Problem"
   ehrlich zu beantworten, auch ohne den vollen Zwei-Strom-Nachweis, der für eine **neue oder
   geänderte Mechanik** verbindlich wäre. Diese Runde ändert keine Mechanik (nur eine
   beweisbar simulationsentkoppelte Zeichen-Konstante, Abschnitt 4) — der Pp-Wert dient hier
   ausschließlich der ehrlichen Einordnung, nicht der Abnahme einer Änderung.
2. **Clumping** — `window.__arena.diagAbstaende(saat, 360, "basketball")`, das bestehende
   Anti-Stacking-Messwerkzeug aus der 30.08.-Runde (paarweiser Mindestabstand aller zwölf
   Figuren, je Tick, getrennt nach Simulations- und Zeichenposition).
3. **Pass-/Tempo-Diagnose** — ein temporärer (nach der Messung wieder entfernter, nie committeter)
   Zähler in `passeAb()`/`naechsterAngriff()`, über `window.__DIAG_PASS`, 5 Saaten
   (`window.__arena.spieleBasketball(saat)`), read-only, kein `rr()`-Eingriff, keine Verschiebung
   der Zufallsfolge (nur ein Zähler-Inkrement, kein Zustand, der irgendwo gelesen wird).

## 2. Baseline

| Größe | Wert | Schranke |
|---|---:|---|
| rho je Spiel (Median, n=24, Kader-Familie live-save) | **0,795** (Spannw. 0,085) | > 0,80 |
| rho je Spiel (Median, n=48) | **0,790** (Spannw. 0,072) | > 0,80 |
| rho Saison (Median, n=48) | 0,909 (Spannw. 0,126) | — |
| Pp-Abweichung (`messe-arena-einfluss.mjs basketball 24`, ein Saatstrom, s. Methodik-Hinweis) | **33,7 Pp** | ≤ 25 |

Basketball gilt laut `docs/design/messgrundlage-kaderfest.md` als **kaderrobust** (Kaderwechsel
bei unveränderter Mechanik bewegt rho nur um 0,10 bei n=24, einer der beiden niedrigsten Werte
aller zwanzig Disziplinen, neben Speed-Schach) — die 0,79er-Zahl ist also ein echtes Signal, kein
Kaderrauschen, und die eingecheckte Basislinie (`data/generated/rangtreue-basislinie.json`:
spielMedian 0,78) bestätigt dieselbe Größenordnung unabhängig.

Zum Vergleich die letzte bekannte Pp-Zahl vor den seitherigen Runden (K3, Rollen-Positionierung):
`docs/design/battle-mode-nba2k-modell-plan.md` maß am 01.09. **32,1 → 36,5 Pp** für eine
chassis-weite Änderung — bereits damals über der (erst am 21.09. zur Pflichtprüfung erklärten)
25-Pp-Schranke. Die frische Messung dieser Runde (33,7 Pp) liegt **in derselben Größenordnung**,
über sechs Wochen und mehrere Mechanik-Runden (K3, Rollen-Positionierung) hinweg praktisch
unverändert — ein stabiler, vorbestehender Zustand, keine neue Verschlechterung. Größte Einzel-
Differenzen: `awareness` −7,9 Pp (Matrix 14 %, Mechanik liest nur 6,1 %), `torment` +7,0 Pp
(Matrix 6 %, Mechanik liest 13 %), `speed` +6,5 Pp (Matrix 10 %, Mechanik liest 16,5 % — am
ehesten über `LAUFTEMPO`s dokumentiert gewolltes Sichtbarkeits-Gewicht erklärbar, s.
`bewegeSpielerLive`s eigener "SPEED-SICHTBARKEIT"-Kommentar). `health`/`determination`/`will`
liegen bei 0 %, aber die Matrix selbst gewichtet sie mit 0 — kein "totes Attribut", sondern
korrekt wiedergegebene Null. Football liegt aktuell bei 61,7–71,3 Pp (PR #1232) und wird dort
ausdrücklich als „vorbestehendes, separat verfolgtes Rezeptproblem" behandelt, nicht in der
jeweiligen Runde gelöst — dieselbe Einordnung gilt hier: ein vorbestehender Zustand, den diese
Runde weder verursacht noch (ohne einen viel größeren Rezept-Umbau) beheben kann oder soll.

## 3. Die drei Beschwerde-Achsen, einzeln geprüft

### 3.1 „Spieler ballen sich zusammen"

**Nicht unbearbeitet.** Vier dedizierte Runden liegen bereits dahinter:

- **25.08. (Fable-Spacing-Fix):** `SLOTS`-Radien von unter dem Dreier-Radius auf 60–150px
  angehoben, dazu ein generischer `SEP_RADIUS`/`SEP_STAERKE`-Abstoßungsterm in
  `bewegeSpielerLive` (`battle-mode.engine.js:13056-13096`).
- **26.08. (Seiten-Balance-Fix):** ein Vorzeichenfehler in `seitlich` ließ drei der sechs Slots
  auf derselben Feldseite liegen — ein sichtbares Dreieck aus drei Spielern auf 56–78px
  Kantenlänge, während die andere Seite leer blieb. Behoben, mit Chris' eigenen Screenshots als
  Beleg (`battle-mode.engine.js:8907-8920`).
- **30.08. (Anti-Stacking-Messung + Zeichen-Versatz-Schicht):** eine rein kosmetische, von der
  Simulation komplett entkoppelte Schicht (`zeichenVersatzSchritt`, `:14950-14980`) drückt
  Sprites beim ZEICHNEN auseinander, ohne `u.x/u.y` (und damit keine Wurf-/Steal-Wahrscheinlichkeit)
  zu berühren — **mit Chris' ausdrücklicher Zustimmung bewusst unvollständig** gelassen ("einer
  steht dahinter"-Fall erlaubt, `:14918-14920`).
- **26.09. (Rollen-Positionierung):** `BASKETBALL_ROLLE_SLOT` bildet die sechs Management-Rollen
  auf die sechs Court-Plätze ab, sodass eine gesetzte Aufstellung auch sichtbar auf dem Feld
  steht (`:9075-9097`).

**Nachgemessen (`diagAbstaende`, origin/main, 360s, 3 Saaten):**

| | Simulationsposition | Zeichenposition (was Chris sieht) |
|---|---:|---:|
| mittlerer Mindestabstand | 14,8px | 28,0px |
| Anteil Frames mit Mindestabstand < 18px (= echte Körperüberlappung, Sprite ~28px breit) | — | **2,8 %** |
| Anteil Frames mit Mindestabstand < 30px (= Sprites berühren sich gerade) | — | 85,8 % |

Der Simulations-Mindestabstand wird fast vollständig von legitimer Mann-Deckung getragen: die
Separation schließt genau das eine Paar (eigener Decker ↔ gedeckter Spieler) ausdrücklich aus,
weil `deckerAbstand` eine echte Spielgröße ist (`bedraengnisGate`, `kickOutChance`,
`STEAL_REICHWEITE` lesen sie) — sie auseinanderzudrücken wäre keine Optik-, sondern eine
Balance-Änderung (Kommentar `:13064-13067`). Die **gezeichnete** echte Überlappung (< 18px) ist
mit 2,8 % der Bilder bereits selten; was häufig ist (< 30px, 85,8 %), ist meist "Sprites stehen
dicht nebeneinander", nicht "liegen übereinander".

**Befund:** die Mechanik dahinter ist nicht unbearbeitet, aber der kosmetische
Zeichen-Versatz-Puffer war seit dem 30.08. nicht mehr nachjustiert worden. Kleiner, geprüft
risikoloser Fix in Abschnitt 4.

### 3.2 „zu wenig Passspiel"

**Nachgemessen (5 Saaten, vollständige Spiele, Ereignisprotokoll + Pass-Zähler):**

| Saat | Possessions | Pass-Versuche | Passes/Possession | Feldwürfe | Würfe/Possession |
|---:|---:|---:|---:|---:|---:|
| 1337 | 72 | 154 | 2,14 | 76 | 1,06 |
| 9256 | 73 | 174 | 2,38 | 73 | 1,00 |
| 17175 | 73 | 158 | 2,16 | 74 | 1,01 |
| 25094 | 75 | 176 | 2,35 | 77 | 1,03 |
| 33013 | 75 | 183 | 2,44 | 76 | 1,01 |

Rund 2,1–2,4 Pässe je Ballbesitz, bevor der Abschluss fällt — nicht null, aber auch kein
NBA-typisches Ballbewegungsspiel mit vier, fünf Pässen.

`passChance` (pro Entscheidung 0,20–0,75, Mittel 0,35 bei AUFBAU=50) ist **bewusst** um
AUFBAU=50 zentriert, nicht einfach angehoben — die „Playmaker-Runde" (Kommentar
`entscheideBallaktion:11810-11847`) hat genau durchgemessen, dass ein höherer MITTELWERT (statt
nur eine breitere Spanne) den gesamten gemessenen negativen Intelligence-Einfluss
(−3,3 % Pp-Beitrag bei Koeffizient 0,0030) verursacht hat — korrigiert durch Re-Zentrierung, nicht
durch einen kleineren Koeffizienten. Eine erneute Anhebung des MITTELS (mehr Passing im
Durchschnitt, nicht nur eine größere Spielmacher-Spanne) ist exakt der Hebel, der diesen Bug
wieder öffnet.

`offenheitFuerPass`/`gewichtetesLosNach` (Zielwahl) ist ebenfalls bereits mehrfach kalibriert
(Opus-Review-Fund #5, EINGRIFF (c) des NBA2K-Modells) — kappa, Passlinien-Abschlag und
Decker-Gewichtung sind alle "durchgemessen", keine freien Zahlen.

### 3.3 „zu wenig Tempowechsel"

**Pace-Varianz existiert bereits, strukturell:**

- Possession-Länge (5 Saaten, Mittel 4,74–4,97s, SD 1,71–2,30s, Min ~0s, Max 9–11s) — spürbare
  Streuung, nicht ein starres Metronom.
- `startFastbreak()` feuert bei **jedem** Steal UND **jedem** Defensiv-Rebound
  (`battle-mode.engine.js:12650/12889/13789`). Bei einer auf die reale NBA-Quote kalibrierten
  Rebound-Verteilung (~74:26 defensiv:offensiv, `REB_BOXOUT`) und Rebounds als knapp einem
  Drittel aller Ereignisse (48–59 je Spiel) treffen überschlägig weit mehr als die Hälfte der
  ~73–75 Possessions eines Spiels auf ein 3-Sekunden-Fenster mit 1,3×-Tempo für Ballführer und
  die beiden schnellsten Mitspieler. „Zu wenig Tempowechsel" ist strukturell nicht richtig — die
  Frage ist eher, ob er **sichtbar genug telegrafiert** wird.
- Die Schussuhr selbst (8s) **bindet praktisch nie** (mittlere Possession 4,9s) — durchgemessen
  mehrfach (Kommentar `:7848-7858`): 8→6s und 8→5s bewegen FGA/Spiel um nichts Messbares; 8→3s
  „wirkt" nur, weil fast jeder Angriff in einen ERZWUNGENEN Wurf läuft (Shot-Selection wird
  übersprungen — mehr Volumen, schlechtere Auswahl, kein echter Gewinn).
- Die Viertellänge (`VIERTEL_DAUER_BASKETBALL=90`, `SPIELDAUER_BASKETBALL=360`) ist die **einzige**
  Stellschraube, die FGA/Possession-Zahl im Code nachweislich bewegt (120s→180s: FGA 29,1→43,7,
  rho 0,718→0,785) — und sie steht im Code ausdrücklich als „EINE Konstante, die Chris gehört"
  (Kommentar `:7866-7872`), keine stillschweigende Stellschraube für eine Agenten-Runde.

## 4. Umgesetzt: der Zeichen-Versatz-Puffer (geprüft risikolos)

`ZEICH_MIN_ABSTAND` 30→36, `ZEICH_MAX_VERSATZ` 24→28 (`battle-mode.engine.js:14921-14922`,
unverändert `ZEICH_NACHZIEHEN=0.3`, `ZEICH_HARTGRENZE=18`). Dieselbe, bereits bestehende,
**beweisbar simulationsentkoppelte** Mechanik aus der 30.08.-Runde — `_zvx`/`_zvy` werden
ausschließlich in `zeichneFeldspiel`/Float-Rendering und in den Diagnose-Werkzeugen selbst
gelesen (grep über die gesamte Datei bestätigt: kein Treffer in `entscheideBallaktion`, `wirf`,
`passeAb`, `bewegeSpielerLive`s Zielfindung oder irgendeiner anderen Entscheidungsfunktion).

**Wirkung (`diagAbstaende`, 3 Saaten, Zeichenposition):**

| | vorher (30/24) | nachher (36/28) |
|---|---:|---:|
| mittlerer Mindestabstand | 28,0px | **32,4px** |
| Anteil Frames < 18px (echte Überlappung) | 2,8 % | **2,2 %** (leicht besser) |
| Anteil Frames < 30px (Sprites berühren sich) | 85,8 % | **17,7 %** |

Der „fast immer berühren sich die nächsten zwei Sprites"-Zustand sinkt von 85,8 % auf 17,7 % der
Bilder — eine deutliche, aber nicht übertriebene Verschiebung (eine aggressivere Fassung, 42/34,
wurde ebenfalls gemessen und auf 7–9 % getestet, aber verworfen: die Lücke zwischen dem weichen
Zielversatz und der harten 18px-Notbremse wächst dabei auf bis zu 16px, mehr als doppelt so viel
wie im bestehenden 30/24-Stand — höheres Risiko eines sichtbaren Sprungs in dichten Situationen,
für wenig Zusatznutzen gegenüber 36/28). `ZEICH_HARTGRENZE=18` unverändert, damit die echte
Überlappungsgrenze (das, was Chris' „einer steht dahinter"-Zugeständnis eigentlich meinte)
unangetastet bleibt.

**rho bit-identisch** (0,795/0,085/0,881/0,140 bei n=24, davor und danach — zweimal reproduziert),
wie es die Konstruktion erwarten lässt. Keine neue Pp-Messung nötig: ohne jede Simulationswirkung
gibt es nichts, was eine Pp-Bewegung auslösen könnte (dieselbe Logik wie beim Ball-Pose-Fix,
`basketball-positionierung-ballpose-26-09.md`).

**Sichtprüfung über die echte gerenderte Arena (`scripts/schiesse-basketball-vergleich.mjs`)
versucht, nicht gelungen:** das Skript braucht einen eigenständigen Dateibaum je Stand
(Vorher/Nachher-HTML+Engine nebeneinander); unter `file://` lösen die im Markup fest verdrahteten,
root-absoluten Asset-Pfade (`/sprites/...`, `/portraits/...`) nicht relativ zur jeweiligen Kopie
auf, egal ob Original oder Kopie — dasselbe Verhalten zeigt auch der unveränderte
Original-Checkout unter `file://`. Zusätzlich blieb die Spieluhr in diesem Testaufbau bei 0:00
hängen (Ursache nicht abschließend geklärt, vermutlich eine Nebenwirkung desselben
Asset-Problems auf die Start-Sequenz). Ehrlich berichtet statt stillschweigend übersprungen: die
Verifikation dieser Änderung stützt sich deshalb ausschließlich auf `diagAbstaende` (dieselbe
Positionsrechnung, die auch `zeichneFeldspiel` verwendet, nur ohne Bildausgabe) und die
Code-Isolation (grep), nicht auf ein tatsächlich betrachtetes Bild. `diagAbstaende` ist dasselbe
Werkzeug, mit dem die 30.08.-Runde ihren eigenen Befund belegt hat — kein neu erfundenes.

## 5. Was NICHT umgesetzt wurde, und warum

Für Tempowechsel und Passspiel wurde **kein** Code geändert. Grund: jede naheliegende
Stellschraube ist bereits gebaut, gemessen, und in mehreren Fällen ausdrücklich wegen Rho-/
Pp-Schaden verworfen worden — ein erneuter Versuch an genau diesen Stellen wäre kein neuer
Befund, sondern ein Blindschuss auf eine bereits knappe 0,79er-Zahl:

1. **Slot-Tausch-Frequenz lockern** (öfter als alle 2,4s): bereits gebaut gewesen (29,4×/Spiel),
   gemessen und verworfen — zerwürfelte die ZWEITCHANCE-basierte Slot-Vergabe binnen Sekunden
   (Opus-Review-Fund #8, `:9224-9234`).
2. **Zonen-Anker für Slot-0-Verteidiger** ("eine Johanna eher den Weg zum Korb deckt"): gebaut,
   bei DREI Stärken gemessen, bei allen rho(6v6) ~0,72 (Ziel ≥0,740), rho(4v4) selbst bei
   schwächster Stärke 0,743 (Ziel ≥0,754) — strukturell, nicht kalibrierbar (Kommentar
   `:13344-13362`).
3. **`passChance`-Mittel anheben** (mehr Pässe im Schnitt, nicht nur eine größere Spielmacher-
   Spanne): exakt der Hebel, der zuvor den negativen Intelligence-Pp-Beitrag verursacht hatte
   (Abschnitt 3.2) — eine Wiederholung ohne einen anderen Mechanismus würde denselben Fehler
   erwarten lassen.
4. **Schussuhr kürzen:** mehrfach durchgemessen, bewegt FGA/Spiel nicht (8→6/5s) oder nur über
   erzwungene, schlechter ausgewählte Würfe (8→3s) — kein echter Gewinn (Abschnitt 3.3).
5. **SEP_RADIUS/SEP_STAERKE generisch anheben** (mehr Platz zwischen NICHT gematchten Spielern):
   ungetestet, aber mit klarem Risikopfad — der generische Abstoßungsterm wirkt auch auf
   Hilfsverteidiger-Zielpositionen (`HILFE_RADIUS`-Block, `:13259-13301`), eine Änderung dort
   könnte Doppel-Timing verschieben, ohne dass das in dieser Runde gemessen wurde.

Keine dieser fünf wurde in dieser Runde versucht — nicht aus Zeitmangel, sondern weil jede
entweder bereits mit dokumentiertem Negativbefund vorliegt (1, 2, 3, 4) oder einen echten,
bisher unvermessenen Rho-Pfad berührt (5), den ein einzelner PLATZHALTER-Dreh ohne Messung nicht
verantworten kann, solange rho bei 0,79 „knapp" steht statt sicher über 0,80.

## 6. Optionen für eine künftige Runde (keine Entscheidung dieses Dokuments)

| Option | Aufwand | Risiko | Erwarteter Gewinn |
|---|---|---|---|
| **A — bereits umgesetzt:** Zeichen-Versatz-Puffer nachjustieren | klein | **keins** (beweisbar simulationsentkoppelt) | sichtbar engere Formationen, aber nur Optik — ändert nichts an Pass-/Tempo-Gefühl |
| **B — "Give-and-Go"-Schneiden:** nach einem erfolgreichen Pass läuft der Passgeber kurz zum offenen Raum statt sofort in seinen Slot zurück (analog zum bestehenden Screen-/Roll-Muster, `u.screent`/`u.rollBis`) | mittel | mittel — neues Bewegungsziel berührt reale Positionen, braucht volle rho+Pp-Messung (2 Saatströme) vor jedem Merge | mehr sichtbare Bewegung/Ballfluss, direkteste Antwort auf "Passspiel" |
| **C — generische Separation anheben** (Abschnitt 5, Punkt 5) | klein (Zahlendreh) | mittel-hoch — unvermessene Wirkung auf Hilfsverteidigung | mehr Raum zwischen nicht gematchten Spielern |
| **D — Viertellänge erneut anheben** | trivial (eine Konstante) | bekannt (rho 0,785→0,718 bei 180→120s Rückrichtung; umgekehrte Richtung käme mit einem eigenen Preis) | mehr Possessions/Pässe/FGA insgesamt, aber **Chris' eigene Entscheidung**, keine stillschweigende |
| **E — Rho zuerst sichern**, bevor an B/C/D gerührt wird: die 0,79-Zahl selbst ist "knapp" — eine Validitätsrunde (im Sinne von CLAUDE.mds "Verlässlichkeit vs. Validität") könnte vor jeder Tempo-/Pass-Änderung lohnender sein | — | — | reduziert das Risiko für alle anderen Optionen |

**Offene Frage an Chris:** ist die Beschwerde aktuell (nach 25.08./26.08./30.08./26.09./K3), oder
könnte sie älter sein? Und: wäre Option B (Give-and-Go) das Richtige, oder zielt „Tempowechsel"
eher auf Option D (Viertellänge, explizit Chris' eigene Entscheidungsgröße laut Code-Kommentar)?

## 7. Geänderte Dateien

- `public/mockups/battle-mode.engine.js` — `ZEICH_MIN_ABSTAND`/`ZEICH_MAX_VERSATZ` (zwei Zeilen,
  `:14921-14922`). Keine weitere Zeile geändert.
- `docs/design/basketball-tempo-passing-diagnose-14-10.md` — dieser Bericht.

Keine Änderung an `lib/player-generator/official-discipline-weights.ts` (die Eignungsmatrix bleibt
unangetastet) oder an `lib/player-generator/spiel-eignung-overrides.ts`.
