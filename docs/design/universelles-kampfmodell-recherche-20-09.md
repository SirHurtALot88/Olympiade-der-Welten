# Ein Kampfmodell für alle zwanzig? — Echtzeit, Runden, Karten-Auto-Battler (Recherche, 20.09.)

**Reine Recherche und Konzeptarbeit. Keine Zeile Engine-Code wird angefasst.** Stand `origin/main`
`73e43a8b` (19.09., nach PR #970 — A0.1 und A0.2 sind gemergt). Zeilenangaben ohne Dateinamen
meinen `public/mockups/battle-mode.engine.js` in diesem Stand.

Baut auf zwei Dokumenten auf und wiederholt sie nicht:
`docs/design/echtzeit-vs-rundenbasiert-analyse-19-09.md` (Fable, Phase 1, Branch
`analyse/echtzeit-vs-rundenbasiert-19-09` — Bestandsaufnahme der zwei Zeitmodelle) und
`docs/pm-briefings/opus-synthese-echtzeit-vs-rundenbasiert-19-09.md` (Opus, Phase 2 — die
Empfehlung „Arena als Rundenpilot, Rest unverändert", mit dem TMP/AUS-Mechanismus als Begründung).

Chris hat die Frage jetzt bewusst ausgeweitet. Sinngemäß, in drei Teilen:

1. *Bekommen wir EIN System — Echtzeit-Auto-Battle ODER rundenbasiert — für ALLE Disziplinen?
   Oder müssen wir splitten?*
2. *Funktioniert rundenbasiert auch bei Football, Basketball und Co.?*
3. *Oder sollten wir es als rundenbasierten Auto-Battler aufziehen, wie in manchen Kartenspielen?*

Dazu die Randbedingung, die er am ersten Mockup festgemacht hat: **es muss visuell etwas
hergeben** — abstrakte HP-Balken ohne Karten und ohne Figuren reichen ihm nicht.

---

## 0. Der Kernbefund

> **Es gibt kein Zeitmodell, das für alle zwanzig Disziplinen richtig ist — und es gibt trotzdem
> EIN gemeinsames System. Es liegt nur eine Etage höher: nicht im Takt, sondern in der
> Präsentationsgrammatik.** Was universell sein kann und soll, ist, WIE ein Ereignis gezeigt wird
> (Kader-Karte, Fokus auf den Handelnden, Callout, Zwischenstand). Was nicht universell sein kann,
> ist, WANN Ereignisse entstehen — das entscheidet die Disziplin.

Die drei Fragen in je einem Satz:

| Frage | Antwort | Warum, in einem Satz |
|---|---|---|
| **Universell oder Split?** | **Split — aber ein bewusster, entlang der Chassis-Grenze, die es schon gibt.** Zwei Motorenfamilien (Ereignismotor: Bühne + künftig Arena; Flussmotor: Bahn + Feldspiel), EINE Präsentationsgrammatik darüber. | Die vier Chassis sind heute schon zwei Zeitmodelle (Phase 1, Abschnitt 1). Ein erzwungenes Universalmodell kostete in beide Richtungen: „alles Echtzeit" ist an Fechten gemessen gescheitert (0,153), „alles Runden" nähme der Bahn den Inhalt und dem Feldspiel den besseren Motor (Football 0,345 → 0,516 durch den Wechsel AUF live). |
| **Feldspiel rundenbasiert?** | **Nein für Basketball und Hockey. Football ist ein Sonderfall: es IST schon spielzugbasiert — seit der Live-Migration läuft es als Kette diskreter Downs (`starteSnap()`/`stepSnapPhase()`, `:8758-8820`).** Dort ist nichts umzubauen, sondern nur sichtbarer zu machen, was der Motor bereits tut. | Der Mechanismus, der in der Arena FÜR Runden spricht (unbepreister TMP/AUS-Kanal, Opus Abschnitt 3), **existiert im Feldspiel nicht**: Gelegenheit ist dort Possession, und die verteilt der Motor nach Rolle und Eignung. Das Feldspiel hat ein Verlässlichkeits-, kein Validitätsproblem (Saisonzahlen 0,92/0,83/0,81) — und Runden erzeugen keine Ereignisse, sie sortieren sie nur. |
| **Karten-Auto-Battler-Rahmen?** | **Ja als Präsentationsschicht für die drei Arena-Disziplinen (und ohne Umbau für die Bühne, die es der Sache nach schon ist). Nein als Mechanik für Bahn und Feldspiel.** Und: „Karte" heißt Identität (Portrait + Werte + Zustand), „Aktion" bleibt Sprite. | In TFT, Hearthstone Battlegrounds und Super Auto Pets ist die Karte die **Vorbereitungs- und Identitätsschicht**; der Kampf selbst wird mit Figuren gezeigt, **eine Aktion nach der anderen**. Genau das ist die Aufteilung, die zu unserem Bestand passt: 2 980 Portraits für die Karte, 480 Sprite-Blätter für die Aktion. |

Und die Klarstellung, die Chris' dritte Frage braucht: **A1 (Opus-Plan) und „Karten-Auto-Battler"
sind nicht dieselbe Entscheidung.** A1 ist eine **Mechanik** (jede Einheit handelt einmal je
Runde, Initiative nach Tempo). Der Karten-Auto-Battler ist eine **Präsentation** (Reihe von
Einheiten-Karten, der Handelnde springt vor, Schadenszahl, nächster). Man kann A1 ohne Karten
bauen (und bekäme genau das kritisierte HP-Balken-Mockup) und Karten ohne A1 (und hätte ein
Gewusel in hübschen Rahmen). Beides zusammen ist die Empfehlung — für die Arena, nur dort.

---

## 1. Zwei Achsen, nicht eine — sonst redet man aneinander vorbei

Phase 1 hat es schon getrennt (Abschnitt 2 dort), hier noch einmal, weil Chris' Frage 3 beide
Achsen in einem Satz mischt:

- **Achse A — Mechanik: Wo entsteht das Ergebnis, und in welchem Takt?** Vorab (Bühne),
  emergent im Tick (Bahn, Arena, Feldspiel) oder — künftig — in diskreten Runden (Arena-Pilot).
  Eine Änderung hier berührt `wert()`, `rr()`, die Rangtreue.
- **Achse B — Präsentation: Wie wird gezeigt, was entstanden ist?** Kontinuierlich interpoliert,
  als Clip je Ereignis, als Karte je Handelndem, als Ticker. Eine Änderung hier ist rho-neutral,
  sofern sie nur liest.

Chris' Kritik am Mockup („nur HP-Balken, keine Karten, keine Figuren") ist eine **Achse-B-Kritik**.
Sie sagt nichts gegen A1, sie sagt, dass A1 ohne Präsentation nichts zeigt, was man anschauen
möchte. Das ist richtig — und es ist derselbe Befund wie Chris' Satz vom 13.09. an der
Kachelleiste: *„die health bars sind ja hier quatsch"* (`:28514`). Ein Balken zeigt das **Maß**,
nicht das **Subjekt**. Was Chris jedes Mal vermisst, ist das Subjekt: wer handelt gerade, gegen
wen, mit welchem Ergebnis.

Die Frage „universell oder Split" muss deshalb für beide Achsen getrennt beantwortet werden:

| | Achse A (Mechanik/Takt) | Achse B (Präsentation) |
|---|---|---|
| Universell möglich? | **Nein** (Abschnitt 3) | **Ja** (Abschnitt 5) |
| Universell sinnvoll? | nein — kostet gemessene Disziplinen | ja — das ist, was „ein Spiel" ausmacht |
| Was heute schon universell ist | `MOTOREN`-Schnittstelle (`bau/lauf/wert`), Sonde, Rangtreue-Schranke | Einlauf, Kader-Kacheln, Ticker, Endstand, Broadcast-Rahmung (in Arbeit) |

---

## 2. Die vier Chassis einzeln

### 2.1 Bühne (9 Disziplinen) — ist bereits ein Rundenmotor; die Frage stellt sich nicht

`bauBuehne()` rechnet alle `rundenN` Durchgänge vorab, `stepBuehne()` enthüllt sie über
`buehneQueue` im Takt `rundenDauer` (Phase 1, Abschnitt 1.2). Eiskunstlauf sind 12 Läufer × 12
Durchgänge, Schach 120 Züge, Gewichtheben 72 Versuche. **Das ist ein Kampf-Log mit
Auto-Advance** — strukturell dasselbe, was Hearthstone Battlegrounds im Kampf tut (Abschnitt 4).

Was ein „Karten-Rahmen" hier hinzufügen könnte, ist nur Achse B — und die Bühne hat genau die
Regie-Bausteine, die das Vorbild ausmachen, **schon gemessen und abgenommen**:

- **Ein Subjekt im Bild**: `zeichneHeben()` zeigt nur das aktive Duell groß, die wartenden
  Paare klein am Rand (`stand-aller-disziplinen.md` Abschnitt 4). Speed-Schach hat das
  Fokus-Brett. Eiskunstlauf hat Spotlight und Startreihenfolge (13.09.).
- **Zug-für-Zug-Präsentation**: `stepHeben()` ist ein Clip-Automat (boden → antritt → zug →
  hoch/ablage), ausgelöst vom Enthüllungsmoment.
- **Zwischenstand als Beat**: Perioden-/Brett-Beats, Wertungstabelle.

Was Karten dort **nicht** bringen dürfen, ist der Rückbau der kontinuierlichen Zierde (Lissajous-
Fahrt der Eiskunstläufer, Cypher-Kreisen) — das war der Zustand vor dem 10.09., den Chris als
„nur Rumstehen" kritisiert hat. **Verdikt: keine Änderung an der Mechanik, keine an der Optik.
Die Bühne ist das Muster, an dem sich der Arena-Pilot orientieren soll, nicht umgekehrt.**

### 2.2 Bahn (5 Disziplinen) — Kontinuität ist der Inhalt; ein Rundenmodell wäre eine Ergebnistafel

`stepSpurt()` ist Tick-Physik (`u.pos+=u.v*dt`, Windschatten aus der momentanen Geometrie,
Kraftbudget als Integral, `rr()<p*dt`). Vier von fünf stehen über 0,80, Climbing seit 16.09. auch.
Chris hat für Spurt ausdrücklich bestellt, dass ein 100-m-Lauf drei Minuten dauert, „damit man
sich das auch in ruhe angucken kann und kleine unterschiede erkennt" — **kleine Unterschiede
zwischen nebeneinander laufenden Figuren sind das, was diskrete Zustände nicht zeigen können.**

Gibt es Präzedenzfälle für rundenbasierte Rennen? Ja, im **Brettspiel**: *Flamme Rouge* und
*Heat: Pedal to the Metal* fahren Radrennen mit Karten (Kartenwert = Felder, Windschatten als
Aufrückregel). Sie funktionieren, weil ein **Mensch** die Karte wählt — die Spannung liegt in der
Handkarten-Entscheidung, nicht im Bild. Als **Zuschau-Sim ohne Eingriff** bleibt davon eine
Tabelle mit Positionen, die sich alle paar Sekunden ändert. Das ist die Zwischenzeiten-Tafel des
Zeitfahrens (`time-trial-einzelzeitfahren-wertung-plan-05-09.md`) — die gibt es schon, als
**Ergänzung** zum Rennen, nicht als Ersatz.

**Verdikt: nein, auch nicht als Karten-Rahmen.** Was die Bahn von einem universellen System
bekommen soll, ist die Präsentationsgrammatik aus Abschnitt 5 (Kader-Karte mit Puste und Rang,
Callouts bei Überholen/Sturz/Zieleinlauf) — die läuft neben der Bahn, nicht statt ihrer.

### 2.3 Feldspiel (3 Disziplinen) — Chris' Kernfrage, deshalb ausführlich

#### 2.3.1 Was der Live-Motor heute ist — und wo er schon diskret ist

`stepFeldspielLive()` (`:11175`) ist eine echte Tick-Simulation: Positionen aus
`bewegeSpielerLive(dt)`, Ballaktionen aus `entscheideBallaktion()`, Steals, Rebounds,
Manndeckung, Fastbreak, Freiwürfe, Perioden. Der Zufall ist **ereignisbasiert** (86 `rr()`-Stellen,
gezogen wenn eine Entscheidung ansteht, nicht je Tick). Aber der Motor ist nicht gleichförmig
kontinuierlich — er hat je Disziplin eine andere „natürliche Körnung":

| Disziplin | Natürliche Einheit | Wie diskret ist der Motor heute schon? |
|---|---|---|
| **Football** | der **Down** | **Vollständig.** `starteSnap()` (`:8758`) wählt Spielzug + Offense-/Defense-Formation, setzt alle zwölf **direkt** an die Line of Scrimmage („nicht hinlaufen lassen"), dann `stepSnapPhase()`: `formation` 0,9 s Standbild → `zug` mit fester Dauer je Spielzugtyp (`FK_ZUG_DAUER`) und **vorab gelöstem** Ergebnis (`loeseFootballZug()` wird am Ende der Formationsphase gerufen, die Animation spielt es nur ab) → `nach` 0,6 s → nächster Snap. Das ist **Runde → Auflösung → Clip**, exakt das Bühnen-Muster mit Raumkoordinaten. |
| **Basketball** | die **Possession** (~3,75 s im Mittel, `:6363`) | **Halb.** Possession-Wechsel sind der Takt für Aufstellung und Slot-Vergabe (`naechsterAngriff`, `:7351`); Freiwurf ist eine Standphase (`fsLive.phase==="freiwurf"`, die Uhr hält). Aber **innerhalb** der Possession ist alles kontinuierlich: Dribbeln zur Wunschdistanz (`:10812` ff.), Passwege, Steal-Gelegenheit, Rebound-Kampf, Fastbreak über die Lücke. |
| **Hockey** | die **Shift**/der Angriff | **Kaum.** Bully und Strafen sind Standphasen, dazwischen fließt es: Bodychecks, Bandenzweikampf, Torwartbogen, Überzahl. Der Kommentar zur Zonenlogik nennt selbst „einen Fluss über mehrere Angriffe", kein Wiederanlauf je Aktion. |

Das ist der erste Befund, und er dreht Chris' Frage für Football um: **Football muss nicht
rundenbasiert werden — es ist es.** Was fehlt, ist nur, dass man es SIEHT: ein Down-Callout
(„2nd & 7 · Screen Pass · +9 Yards"), eine sichtbare Down-Karte statt einer Ticker-Zeile. Das ist
Achse B, rho-neutral, und es steht schon als Baustein im Broadcast-Konzept (Callout aus dem
`big`-Flag, `broadcast-praesentation-uebergreifend-recherche-06-09.md` Abschnitt 4).

#### 2.3.2 Warum der Arena-Grund für Runden im Feldspiel nicht greift

Opus' Empfehlung für die Arena hängt an einem benennbaren Mechanismus: Leistung ist dort
Durchsatz, Durchsatz kauft man in kontinuierlicher Zeit mit TMP/AUS, und TMP/AUS sind als
einzige Kampfwerte nicht auf die Eignung normiert (`:5183-5203`). Runden schließen den Kanal
durch Konstruktion, weil „einmal je Runde" die Zahl der Aktionen vom Tempo entkoppelt.

Im Feldspiel gibt es diesen Kanal nicht:

- **Die Gelegenheit ist die Possession, und die verteilt der Motor nach Rolle.** Ballführer-Auswahl
  quadratisch nach AUFBAU, Slot-Vergabe nach SCHUSS_NAH (`:7349` ff.), Passempfänger nach
  Rezept. Wer schneller läuft, bekommt nicht mehr Possessions — er kommt eher zum Fastbreak, und
  das ist bepreist (LAUFTEMPO steht im Rezept).
- **Die Zahlen sagen es:** Basketball 0,769 je Spiel bei **0,923 Saison**, Hockey (Feldspieler)
  0,719 bei 0,818, Football 0,516 bei 0,811. Nach der Zwei-Spalten-Regel aus CLAUDE.md ist das
  überall das Muster „Mechanik belohnt das Richtige, aber zu laut" — ein
  **Verlässlichkeitsproblem**, kein Validitätsproblem. Die Arena hat das andere Muster (TDM
  0,253 / 0,217: beide niedrig).
- **Runden erzeugen keine Ereignisse.** Verlässlichkeit hängt an der Ereigniszahl (Hockey: ein
  Torwart schwankt binomial um ±3,4 Tore, `stand-aller-disziplinen.md` 1a). Ein Rundenmodell
  sortiert dieselben Ereignisse in Kästchen; es macht nicht mehr daraus. CLAUDE.md warnt
  außerdem, dass mehr Ereignisse in Hockey ohnehin flach bleiben (0,719 → 0,723 bei doppelter
  Spielzeit).

Und es gibt die gemessene Gegenprobe: **Football lief bis zur Live-Migration Anfang September auf dem Vorab-Pfad**
(`fsZuege`, vorgerechnete Zugliste, Interpolation zwischen Formationsslots — das ist ein
Rundenmodell mit Raum) und stand dort bei **0,345 / 0,699**. Auf dem Live-Motor: **0,516 /
0,811**. Der Wechsel **weg** von Runden hat die Rangtreue gehoben. Dass der Live-Motor trotzdem
snap-diskret ist, zeigt: die Verbesserung kam nicht aus „kontinuierlich", sondern aus **echten
Mechaniken** (Downs, Line of Scrimmage, Formationen, kalibrierte NFL-Quoten) — die kann man in
beiden Takten bauen, aber man hat sie im Live-Motor gebaut, und dort liegen sie jetzt.

#### 2.3.3 Präzedenzfälle — was rundenbasierter Feldsport außerhalb dieses Repos ist

| Vorbild | Was es ist | Was es diskret macht | Übertragbar? |
|---|---|---|---|
| **Blood Bowl** (Games Workshop, Cyanide-Umsetzungen) | Rundenbasiertes Fantasy-Football-Taktikspiel, 8 Züge je Halbzeit, 16 gesamt | Jede Figur zieht/blockt einzeln mit Würfeln; **Turnover-Regel**: der erste misslungene Wurf beendet den Zug sofort; bei mehreren Block-Würfeln wählt der Stärkere das Ergebnis | **Als Taktikspiel ja, als Auto-Battler nein.** Die Spannung liegt in der **Reihenfolge der eigenen Aktionen unter Turnover-Risiko** — eine Entscheidung des Menschen. Ohne Menschen entscheidet eine KI, und Blood Bowl wurde 2019 gerade deshalb als KI-Benchmark vorgeschlagen, **weil Bots es schlecht spielen** (Justesen et al.). Ein Auto-Blood-Bowl braucht also erst eine gute Taktik-KI, sonst schaut man einer schlechten zu. |
| **Frozen Cortex** (Mode 7, 2015) | Simultan-rundenbasierter „Futuresport" mit Robotern | Beide Seiten planen gleichzeitig, dann **spielt die Runde kontinuierlich ab** | Zeigt, dass diskrete Planung und kontinuierliche Darstellung zusammengehen — das Muster von Footballs Snap-Phase. Auch hier: der Reiz ist die eigene Planung. |
| **Out of the Park Baseball** | Manager-Sim, Spiel kann Play-by-Play oder **Pitch-by-Pitch** angeschaut werden | Baseball ist **von Natur aus** diskret (Pitch → Ergebnis) | Der einzige Feldsport, bei dem „rundenbasiert" keine Abstraktion ist. Basketball und Hockey sind das Gegenteil: Fließsportarten. Football liegt dazwischen — und genau dort hat unser Motor die Grenze schon gezogen. |
| **Baseball Highlights: 2045** (Kartenspiel) | Zwei Spieler spielen je sechs Karten, das simuliert **die Highlights** eines Spiels — „ohne Outs oder Innings, ohne Play-by-Play" | Das Spiel wird auf seine Höhepunkte reduziert; das Feld verschwindet | Das ist nicht „rundenbasiertes Feldspiel", das ist **Highlights-Modus** — der FM-Ansatz (Key Highlights / Extended / Full), den Phase 1 als R4-Ernte beschreibt. Eine Präsentationsfrage, kein Motorwechsel. |
| **Blood Bowl: Team Manager** (Kartenspiel, FFG 2011) | Manager-Kartenspiel: Spielerkarten werden auf „Matchups/Highlights" gelegt, Star Power entscheidet | Ein Spiel ist eine Handvoll Duelle, kein Feld | Dasselbe: das Kartenspiel abstrahiert den Sport zu **Duellen je Slot** — was unsere Bühne für Gewichtheben und Fechten längst tut. Für Basketball wäre das der Rückbau zu „48 kontextlosen Duellen", den Football am 03.09. hinter sich gelassen hat. |

**Was ein Rundenmodell dem Feldspiel nähme und gäbe**, ehrlich in einer Tabelle:

| | verliert | gewinnt |
|---|---|---|
| Basketball | Passweg vor dem Steal, Lücke vor dem Fastbreak, Rebound-Kampf als Bild, Manndeckung als Bewegung; den einzigen Boxscore-Impact im echten Spielstand; die K3-Kalibrierung; 0,769 → unbekannt | einen klaren Beat je Possession (den Freiwurf-/Viertel-Beats gibt es schon) |
| Hockey | Fluss, Bodycheck im Lauf, Überzahl als Druck; Chris' abgenommene Rangtreue („rangtreuer als echtes Eishockey") | praktisch nichts — Hockey hat keine natürliche Rundeneinheit |
| Football | nichts — es ist schon Down-basiert | Sichtbarkeit: Down-Karte/Callout, Play-Clock im Bild (Achse B) |

**Verdikt Feldspiel: Basketball und Hockey nein. Football: keine Motoränderung — Präsentation
der Downs als Runden, rho-neutral.** Wer für Basketball trotzdem einen Rundenprototyp will,
sollte wissen, dass er den Vorab-Pfad zurückholt, der schlechter gemessen ist, und die einzige
produktive Boxscore-Disziplin neu kalibrieren muss — für einen Zuschauer-Gewinn, den die
vorhandenen Beats (Freiwurf, Viertelpause, Fokus-Doppeln) bereits liefern.

### 2.4 Arena (3 Disziplinen) — ja, und mit der Präsentation zusammen

Nichts Neues zur Mechanik; Opus' Abschnitt 3 steht. Die Kurzfassung für dieses Dokument:

- 0 von 3 bestanden (0,387 / 0,253 / 0,094), sechs dokumentierte Echtzeit-Anläufe, alle
  schlechter oder ununterscheidbar; die Engine selbst schreibt, der nächste Anlauf „müsste am
  Chassis ansetzen".
- Der Nahkampf ist **deterministisch** (2 `rr()`-Stellen, beide Fernkampf) — ein Rundenmotor
  zerstört keine gefittete Zufallsstruktur.
- Fechten ist die gemessene Blaupause: Arena 0,153 → Bühne 0,840.
- Kein Chassis ohne Subjekt: zwölf Figuren schlagen gleichzeitig, Regie hat nichts zu greifen.
  **Runden erzeugen das Subjekt durch Konstruktion.**

Was dieses Dokument dem A1-Plan hinzufügt, ist Abschnitt 5: **A1 braucht die Karten-Präsentation
im selben Schritt**, sonst wiederholt sich das HP-Balken-Mockup. Und ein Größenordnungs-Check
gegen die Vorbilder, ob das überhaupt anschaubar ist: 6 gegen 6, 10–15 Runden, 120–180 Aktionen
(Opus 5.2). Hearthstone Battlegrounds löst Kämpfe mit bis zu 7 gegen 7 Einheiten in
typischerweise 20–40 s auf, eine Aktion (Vorspringen, Treffer, Schadenszahl) ist dort deutlich
unter einer Sekunde. Bei 0,5 s je Aktion sind 150 Aktionen **75 s** — das ist Chris' ~60-s-Budget
der Bühne, mit Regie (Fokus auf das entscheidende Duell, K.o. als Beat) darunter. Es ist also
keine Eiskunstlauf-Größenordnung ohne Ausweg, sondern ein Standardfall des Genres.

---

## 3. Universell oder Split — die Kosten eines erzwungenen Universalsystems

Es gibt zwei Kandidaten für „ein System für alle", und beide sind im Repo schon gemessen
gescheitert oder würden Gemessenes zerstören:

### 3.1 „Alles Echtzeit-Auto-Battle" (Kandidat 1)

Das war der Stand bis zum 03.09. für Fechten und Tennis. Fechten auf dem Arena-Chassis: 0,153.
Tennis auf dem Feldspiel-Chassis: 0,505. Beide nach dem Chassiswechsel auf die (rundenbasierte)
Bühne über 0,80. **Der größte Sprung, den `stand-aller-disziplinen.md` je gesehen hat, kam aus
einem Split, nicht aus Vereinheitlichung.** Und die drei verbliebenen Arena-Disziplinen sind der
Rest genau dieses Kandidaten — 0 von 3.

### 3.2 „Alles rundenbasiert" (Kandidat 2)

| Chassis | Was ein Rundenzwang kostet | Belegt durch |
|---|---|---|
| Bühne (9) | nichts an der Mechanik (ist schon so) — aber „noch rundenbasierter" hieße Rückbau der Zierde, die Chris nach dem 10.09. abgenommen hat | Phase 1, 3.1; `opus-plan-feinschliff-vier-disziplinen-09-10.md` |
| Bahn (5) | das Genre: Windschatten, Überholen, Zieleinlauf; Chris' 3-Minuten-Bestellung; 5 von 5 über 0,80 (Climbing seit 16.09.), also fünf neue Basislinien mit Abwärtsrisiko | Abschnitt 2.2 |
| Feldspiel (3) | Basketball/Hockey: Raum als Inhalt; Basketballs Boxscore-Impact im echten Spielstand; Rückkehr zum schlechter gemessenen Vorab-Pfad (Football 0,345 → 0,516 in die andere Richtung) | Abschnitt 2.3 |
| Arena (3) | nichts — hier ist es die Empfehlung | Opus, Abschnitt 3 |

Rechnung: **13 bestandene Disziplinen neu kalibrieren** (8 Bühne + 5 Bahn), drei Feldspiel-Motoren
neu bauen, sechs seit 10.09. abgenommene Bewegungsmaschinen entwerten — für einen Gewinn, der
nur in der Arena nachweisbar ist. Das ist die Option mit dem schlechtesten Erwartungswert im
ganzen Feld.

### 3.3 Was dagegen wirklich universell ist — und schon existiert

Der Fehler in der Frage „ein System oder Split?" ist die Annahme, dass „ein System" ein
Zeitmodell sein müsste. Was das Spiel als **eines** erscheinen lässt, ist nicht der Takt, sondern:

1. **Die Motor-Schnittstelle.** `MOTOREN[disziplin].bau(saat)/lauf()/wert()` — alle vier Chassis,
   eine Sonde, eine Rangtreue-Schranke, ein Headless-Runner. Das ist bereits universell, und ein
   Arena-Rundenmotor wird ein weiterer Eintrag darin (Opus 5.1: „neuer Motor neben dem alten").
2. **Die Präsentationsgrammatik.** Einlauf mit Wappen und Aufschlüsselung (`renderEinlauf()`),
   Kader-Kacheln mit disziplinspezifischer Leiste (`renderKader()`, seit 13.09. „ehrlich
   beschriftet"), Ticker mit `big`-Ereignissen, Endstand — dazu das geplante Broadcast-HUD und
   der Callout. Das ist heute schon **eine** Grammatik über vier Takte, und sie ist das, was
   Abschnitt 5 zur Karten-Grammatik ausbaut.
3. **Das Ereignisprotokoll (R4) als Richtung.** Ein Motor, der sein Protokoll schreibt, kann
   beliebig getaktet abgespielt werden — Replay, Highlights, Schritt für Schritt. Die Bühne hat
   es (`u.runden[]` + `buehneQueue`), der Arena-Rundenmotor bringt es gratis mit, Football hat mit
   `fsLive.snap.ergebnis` schon eine Aktion je Down vorliegen. Das ist die Ebene, auf der
   „Full / Extended / Key Highlights" für alle zwanzig gleich funktioniert.

Die Analogie, die es für Chris greifbar macht: **eine Olympia-Übertragung hat ein Grafikpaket
für dreißig Sportarten** — Bauchbinde, Uhr, Zwischenstand, Callout, Wiederholung — und trotzdem
ist ein 100-m-Lauf etwas anderes als ein Fechtgefecht, und niemand würde den Lauf in Gefechte
zerlegen, damit beides „ein System" ist.

**Wo die Grenze verläuft, in einem Satz: Ereignismotor (Bühne, Arena neu) dort, wo die
Disziplin aus abzählbaren Versuchen, Zügen oder Schlägen besteht; Flussmotor (Bahn, Feldspiel)
dort, wo Raum und Gleichzeitigkeit der Inhalt sind. Football liegt auf der Grenze und hat sie im
Motor schon selbst gezogen (diskrete Downs, kontinuierlicher Clip je Down).**

---

## 4. Die Karten-Auto-Battler-Vorbilder — was sie rundenbasiert macht, was sie anschaubar macht

Chris' dritte Frage meint das Genre, nicht ein bestimmtes Spiel. Die genannten Titel sind
mechanisch sehr verschieden — das ist für die Übertragung wichtig, deshalb einzeln:

| Spiel | Rundenbasiert? | Auto-Battle? | Wie der Kampf gezeigt wird | Was davon übertragbar ist |
|---|---|---|---|---|
| **Teamfight Tactics** | **Halb.** Planungsphase (30 s: kaufen, aufstellen) ist die Runde; der **Kampf selbst ist Echtzeit** auf einem Hex-Brett, 8 Spieler, keine Eingriffe | ja | 3D-Champions kämpfen gleichzeitig; Lesbarkeit kommt aus **Aufstellung** (Front/Back), Fähigkeits-Callouts, Lebensbalken je Einheit, einer Rundenanzeige | Die Karte ist die **Shop-/Bank-Schicht** (Champion-Portrait, Kosten, Traits). Im Kampf sind es Figuren. → TFT ist das, was unsere Arena HEUTE ist (Echtzeit-Gewusel mit Aufstellung), und TFT hat das Lesbarkeitsproblem auch — es kompensiert mit Kamera, Farbe, geringer Einheitenzahl je Seite und dem Wissen des Spielers, was er aufgestellt hat. |
| **Hearthstone Battlegrounds** | **Ja, vollständig.** Rekrutierungsphase, dann Kampf: Diener greifen **von links nach rechts, einer nach dem anderen** an, zufälliges Ziel außer bei Spott; wer mehr Diener hat, beginnt | ja | Zwei Reihen von **Karten**; der Angreifer **springt vor**, trifft, Schadenszahlen, Tod als Karte, die zerfällt; Tempo einstellbar | **Das ist der nächste Verwandte von A1.** Eine Aktion je Einheit je Runde (hier: je Angriffszug), Reihenfolge durch Position (bei uns: Initiative), Subjekt durch Konstruktion. Und es beweist, dass 7-gegen-7 in unter 40 s lesbar ist. |
| **Super Auto Pets** | **Ja.** Kaufphase, dann Kampf: vorderstes Tier gegen vorderstes Tier, **beide schlagen gleichzeitig**, Reihe rückt nach | ja | Fünf Tier-Symbole je Seite mit zwei Zahlen (Angriff/Leben), „Bump"-Animation, Trigger-Effekte als kleine Pop-ups | Minimalste Form: **Identität + zwei Zahlen + ein Stoß**. Zeigt, dass ein Auto-Battler mit sehr wenig Animation trägt, wenn das Subjekt klar ist. |
| **Marvel Snap** | **Ja, sechs Runden**, beide Spieler legen **gleichzeitig**, dann Aufdecken (Ben Brode: „Backgammon + simultane Reveals + Orte + Clash-Royale-Kürze") | nein — jeder Zug ist eine Spielerentscheidung | Karten mit Kunst, Kosten, Power; drei Orte; die Aufdeck-Sequenz ist die Show | Übertragbar ist der **Aufdeck-Beat**: Ergebnis steht fest, wird aber inszeniert enthüllt — das ist `stepBuehne()`. Und der **Snap**: Einsatz verdoppeln als Spannungsmechanik — das entspricht Chris' Frage, wie man Spannung in ein Ergebnis bringt, das schon berechnet ist. |
| **Clash Royale** | **Nein.** Echtzeit, Elixier, 3–5 Minuten, Türme | nein | Karte → Einheit läuft los; danach Echtzeit-Gefecht | Genau der Fall „Karten als Beschwörungsschicht, Kampf Echtzeit" — für uns kein Vorbild, weil es das Arena-Problem (gleichzeitig, kein Subjekt) hat und mit Spieler-Eingriff kompensiert. |
| **Slay the Spire** | **Ja**, klassisch rundenbasiert | nein — Solo-Deckbuilder, jeder Zug eine Entscheidung | Karten in der Hand, Gegner als Sprites mit **Absichts-Symbol** („greift nächste Runde für 12 an") | Der **Intent-Indikator** ist das übertragbarste Detail des ganzen Genres: er macht die nächste Runde lesbar, bevor sie passiert. Für die Arena: „Bollwerk deckt · Schleicher geht hinten rum · Heiler zieht hoch" **als Ansage vor der Runde**. Und der Karten-Pool-Mechanismus ist die Blaupause für `roguelike-skill-pool-konzept-17-09.md`. |

Drei Dinge, die sich über alle Vorbilder halten:

1. **„Karte" ist überall die Identitäts- und Vorbereitungsschicht — nie die Kampfanimation.**
   Selbst in Hearthstone, wo die Karten auf dem Brett liegen, ist die Karte ein Rahmen um ein
   Portrait mit zwei Zahlen, und die Aktion ist eine Bewegung dieses Rahmens. Bei TFT und Snap sind
   die Kampf-Akteure Figuren bzw. inszenierte Aufdeckungen.
2. **Lesbarkeit kommt aus Sequenzialität, nicht aus Animationstiefe.** Super Auto Pets hat fast
   keine Animation und ist vollkommen lesbar; TFT hat aufwendige Animation und ist es ohne Kamera
   nicht. Was zählt, ist: *einer handelt, alle sehen hin* — Opus' „Subjekt".
3. **Spannung kommt aus Beats, die auf ein feststehendes Ergebnis gelegt werden** (Snap-Reveal,
   Battlegrounds-Angriffsreihe, Slay-the-Spire-Intent). Kein Vorbild braucht Echtzeit für Spannung.

Der Unterschied zwischen A1 und „Karten-Auto-Battler", noch einmal scharf:

| | A1 (Mechanik) | Karten-Rahmen (Präsentation) |
|---|---|---|
| Was es ändert | Verteilung der Gelegenheit: einmal je Einheit je Runde; Initiative aus TMP | Wie eine Aktion gezeigt wird: Karte des Handelnden vor, Ziel markiert, Ergebnis als Zahl/Zustand, Intent für die nächste Runde |
| Berührt `wert()`/`rr()`? | ja — neuer `MOTOREN`-Eintrag, eigene Basislinie | nein — liest das Rundenprotokoll |
| Messbar? | ja, rho kaderfest, n ≥ 96–150 | Sicht-QA, Sonden-Modus (A0.2) |
| Ohne das andere? | ergibt das kritisierte HP-Balken-Mockup | ergibt hübsch gerahmtes Gewusel |

---

## 5. Die visuelle Frage — Karte oder Sprite? Beides, an verschiedenen Stellen

### 5.1 Was im Bestand liegt

| Bestand | Umfang | Wofür er taugt |
|---|---|---|
| **Portraits** `public/portraits/` | rund 2 980 JPGs, per Spieler-ID oder Namens-Slug aufgelöst; in der App überall in Gebrauch (`player-portrait-stat-presets.ts`, Spieler-Drawer, Markt, Kader) | **Identität.** Ein Portrait ist auf einer 120-px-Karte sofort erkennbar; ein 64-px-Sprite ist es nicht. Und die App hat den Spieler schon so eingeführt — die Karte im Kampf wäre **dasselbe Bild wie im Kaderbildschirm**. |
| **Sprite-Baukasten** `public/sprites/baukasten/` | knapp 480 Dateien, LPC-Format 64×64, sechs Bewegungen (`walk/run/idle/hurt/shoot/slash`), 124 Rezepte, dazu Vollbild-/`reiherMech`-Figuren, Waffen- und Requisitenebenen (seit A0.1 auch auf den Sonderpfaden sichtbar) | **Aktion.** Ausholen, Treffen, Fallen, Laufen. Und: die anderen 17 Disziplinen zeigen den Spieler so — die Arena darf ihn nicht plötzlich anders zeigen. |
| **Kader-Kacheln** `renderKader()` | Sprite-Miniatur (`kaderFigur()`) + Name + disziplinspezifische Leiste (Puste / Punkte / Leben) + Zusatzzahl | Ist **schon eine halbe Karte** — nur ohne Portrait, ohne Rolle/Archetyp, ohne Zustand („betäubt", „geschildet") und ohne Fokus. |
| **Einlauf** `renderEinlauf()` | Wappen, Platz, Disziplin-Rang, Aufschlüsselung der Eignung je Spieler, Basketball-Skill-Karte zum Aufklappen | Ist **schon die Vorbereitungsschicht** des Genres (TFT-Bank, Battlegrounds-Rekrutierung) — nur ohne Portrait. |
| **Bühnen-Regie** `zeichneHeben()`, Fokus-Brett, Spotlight | aktives Duell groß, Rest klein | Ist **schon die Aktionsbühne** eines rundenbasierten Kampfes — gemessen abgenommen. |

Der Bestand sagt die Antwort fast selbst: **das Spiel hat beide Schichten bereits, es hat sie nur
in der Arena nie zusammengebracht.**

### 5.2 Drei Optionen, eine Empfehlung

| Option | Bild | Passt zum Rest? | Risiko |
|---|---|---|---|
| **(a) Reiner Karten-Stil** — zwei Reihen Portrait-Karten mit Stat-Overlay, Angreifer-Karte springt vor (Battlegrounds-Look), keine Sprites | Sammelkartenspiel | **Nein.** 17 Disziplinen zeigen denselben Spieler als Sprite auf Bahn, Feld, Bühne. Die Arena würde zum Fremdkörper — und Chris' bisheriger Wunsch war ausdrücklich Bewegung („nur Rumstehen" als Kritik). Außerdem entwertet es die Requisiten-/Waffen-Arbeit (A0.1, Fechten-Schwert, Hockeyschläger). | mittel: schneller zu bauen, aber ein zweites Bildsystem, das gepflegt werden muss |
| **(b) Reiner Sprite-Stil mit Rundentakt** — wie heute, nur schlägt einer nach dem anderen | Arena wie heute, entzerrt | Ja, aber **das Subjekt bleibt schwach**: ein 64-px-Sprite unter zwölf ist auch dann schwer zu identifizieren, wenn nur er sich bewegt (das war der Befund mit dem 1,5-px-Teamring). Keine Rolle, kein Zustand, kein Intent lesbar. | gering technisch, hoch für die Lesbarkeit — das ist das Mockup, das Chris nicht gereicht hat |
| **(c) Hybrid: Karte für Identität, Sprite für Aktion** — Kader-Kacheln werden **Karten** (Portrait, Name, Archetyp/Slot-Rolle, Kampfwerte, Zustand, Intent); die Aktion läuft auf einer **Duell-Bühne** wie bei `zeichneHeben()`: der Handelnde und sein Ziel groß in der Mitte, die übrigen Figuren klein in Formation; die Karte des Handelnden leuchtet, die des Ziels ebenfalls | Bühnen-Duell mit Kartenleiste | **Ja.** Es ist das Gewichtheben-Muster (Chris' abgenommene Bühne) plus die Kader-Kachel, die es schon gibt, plus das Portrait, das die App schon zeigt. Nichts davon ist ein neues Bildsystem. | mittel — Regie ist Arbeit (Kamera-Schnitt auf das Duell, Rückschnitt auf die Formation bei K.o./Rundenwechsel) |

**Empfehlung: (c).** Und zwar als **die** Präsentationsgrammatik, die dann auch den anderen drei
Chassis zugutekommt, ohne deren Takt zu berühren:

| Chassis | Karte (Identität) | Aktion (Sprite) | Was neu wäre |
|---|---|---|---|
| Arena (Runden) | Portrait-Karte je Kämpfer mit Werten, Zustand, **Intent für die nächste Runde** | Duell-Bühne, ein Schlag nach dem anderen, K.o. als Beat | Duell-Regie, Intent-Anzeige, Rundenzähler |
| Bühne | Kachel → Karte (Portrait statt Sprite-Mini, Punktestand bleibt) | unverändert (Heben, Kür, Cypher, Fechten…) | nur die Kachel |
| Bahn | Kachel → Karte (Portrait, Puste, Rang, Rückstand) | unverändert | nur die Kachel + Callouts |
| Feldspiel | Kachel → Karte (Portrait, Punkte, Rolle); **Football: Down-Karte als Rundenbeat** | unverändert | Kachel, Football-Down-Callout |

Damit wird die Karte zum Element, das Chris als „ein System" wiedererkennt — in allen zwanzig —
und der Takt bleibt, wo er hingehört.

### 5.3 Das Mockup, das Chris nicht gereicht hat — was es lehrt

Ein Mockup aus HP-Balken zeigt die **Messgröße** des Kampfes (Leben), nicht seine **Akteure**.
Chris' Reaktion ist dieselbe wie am 13.09. an den Kacheln, und sie ist richtig: Balken sind
Instrumente, keine Show. Das nächste Mockup muss vier Dinge zeigen, sonst ist es wieder keines:

1. **Wer** handelt (Portrait-Karte hervorgehoben, Name, Rolle).
2. **Gegen wen** (Ziel-Karte hervorgehoben, Linie oder Kamera-Schnitt).
3. **Was passiert** (Sprite-Aktion auf der Duell-Bühne, Ergebnis als Zahl + Zustandswechsel).
4. **Was als Nächstes kommt** (Intent auf den Karten, Rundenzähler, Initiative-Leiste).

Ein statischer HTML-Mockup mit echten Portraits aus `public/portraits/`, zwei Kartenreihen und
zwei Sprites in der Mitte (aus dem Baukasten, `slash`-Pose) reicht dafür — er braucht keinen
Motor. Das ist ein Nachmittag, kein Sprint, und er beantwortet Chris' Optik-Frage, bevor A1
gebaut wird.

---

## 6. Empfehlung

### 6.1 Die Antworten

**Frage 1 — universell oder Split?** Split auf Achse A, universell auf Achse B. Zwei
Motorenfamilien hinter einer Schnittstelle, eine Präsentationsgrammatik darüber. Die Grenze:
Ereignismotor für Disziplinen aus abzählbaren Versuchen/Zügen/Schlägen (Bühne heute, Arena
künftig), Flussmotor für Disziplinen, deren Inhalt Raum und Gleichzeitigkeit ist (Bahn,
Feldspiel). Football steht auf der Grenze und hat sie im Motor schon selbst gezogen.

**Frage 2 — Feldspiel rundenbasiert?** Basketball und Hockey: **nein**, weil der Grund, der in der
Arena für Runden spricht, dort nicht existiert (kein unbepreister Gelegenheitskanal, hohe
Saison-Validität, Defizit ist Verlässlichkeit — und Runden erzeugen keine Ereignisse), und weil
der gemessene Präzedenzfall in die andere Richtung zeigt (Football 0,345 → 0,516 durch den
Wechsel auf live). Football: **schon rundenbasiert** (Down = Runde, Snap-Phase = Auflösung +
Clip); die einzige sinnvolle Arbeit ist, das sichtbar zu machen — rho-neutral.

**Frage 3 — Karten-Auto-Battler?** Als **Präsentation** ja, für die Arena zwingend zusammen mit
A1, für alle anderen als Kachel-Aufwertung ohne Taktänderung. Als **Mechanik** nur, was A1 ohnehin
ist (Hearthstone-Battlegrounds-Muster: eine Aktion je Einheit je Runde). Und in der Form
**Hybrid** — Portrait-Karte für Identität und Zustand, Sprite für die Aktion — nicht als
Sammelkartenspiel-Optik, die 17 Disziplinen zum Fremdkörper machen würde.

### 6.2 Was sich am Plan ändert

Opus' Reihenfolge A0 → A1 → A2 → A3 bleibt. Zwei Ergänzungen:

| | Ergänzung | Warum |
|---|---|---|
| **A1-Vorstufe (neu, klein)** | **Statischer Optik-Mockup** der Hybrid-Karte + Duell-Bühne mit echten Portraits und Baukasten-Sprites, ohne Motor. Chris nimmt die Optik ab, bevor der Motor gebaut wird. | Vermeidet, dass A1 fertig ist und wieder an der Optik scheitert. Kostet einen Nachmittag. |
| **A1 (präzisiert)** | Der Mini-DM-Rundenmotor schreibt sein **Protokoll** (Runde, Handelnder, Ziel, Aktion, Ergebnis, Intent) und der Abspieler zeigt es im Hybrid-Stil. Messhürde unverändert (n ≥ 96–150, kaderfest). | Motor und Präsentation entstehen getrennt (R4-Naht), aber im selben Schritt sichtbar. |
| **Football-Down-Karte (neu, unabhängig, klein)** | Callout/Karte je Down aus `fsLive.snap` (Down & Distance, Spielzugtyp, Ergebnis), rho-neutral, bit-identisch nachmessbar. | Beantwortet Chris' Feldspiel-Frage praktisch: Football wird sichtbar rundenbasiert, ohne dass der Motor angefasst wird. |
| **Kachel → Karte (später, alle Chassis)** | Portrait statt Sprite-Mini in `renderKader()`, Rolle/Zustand dazu. | Das universelle Element, das alle zwanzig verbindet. Gehört in die Broadcast-Welle, nicht in A1. |

**Nicht tun:** Basketball- oder Hockey-Rundenprototyp; Bahn-Karten-Mechanik; reiner
Sammelkarten-Look für die Arena; irgendeine Änderung am Takt der 13 bestandenen Disziplinen.

### 6.3 Fragen an Chris

1. **Hybrid abgenommen?** Portrait-Karte für Identität, Sprite für die Aktion — oder willst du
   die Arena bewusst als reines Kartenspiel (Option a), auch wenn sie dann anders aussieht als
   die anderen 17?
2. **Intent zeigen?** Soll die Karte VOR der Runde ansagen, was der Kämpfer tun wird
   (Slay-the-Spire-Muster)? Das macht die Runde lesbar, nimmt aber Überraschung.
3. **Football-Down-Karte** — soll das vor oder nach dem Arena-Pilot laufen? Es ist unabhängig und
   klein.
4. **Kampfdauer** (Opus' Frage 2 bleibt offen): ~60–75 s für einen TDM wie bei der Bühne, oder
   länger mit Regie-Pausen?

---

## 7. Quellen

Im Repo: `docs/design/echtzeit-vs-rundenbasiert-analyse-19-09.md` (Phase 1, Branch
`analyse/echtzeit-vs-rundenbasiert-19-09`); `docs/pm-briefings/opus-synthese-echtzeit-vs-
rundenbasiert-19-09.md`; `docs/design/stand-aller-disziplinen.md` (Rangtreue-Tabelle, Fechten-/
Tennis-/Football-Chassiswechsel, Abschnitt 4 zu `zeichneHeben()`); `docs/design/
broadcast-praesentation-uebergreifend-recherche-06-09.md` (`big`-Flag, Callout, HUD);
`docs/design/roguelike-skill-pool-konzept-17-09.md`; `docs/design/
arena-mini-dm-tdm-battlefield-rollout-plan.md` (Option C, Auto-Battler-Familie);
`docs/design/battle-mode-gameplay-grundmodell.md` (FM-Dosierung, TFT, ZenGM);
`public/mockups/battle-mode.engine.js` — `starteSnap()`/`stepSnapPhase()` `:8758-8820`,
`stehtStill`-Standphasen `:10789-10810`, Possession-Wechsel `:7349-7352`, mittlere
Possession-Länge `:6363`, `renderKader()` `:28506`, `renderEinlauf()` `:27619`, `aufEignung()`-
Kommentar `:5183-5203`; `public/sprites/baukasten/README.md`; `public/portraits/README.md`.

Extern (Stand der Abfrage 20.09.2026):
[Blood Bowl — Regeln, Turnover, Block-Würfel (Blood Bowl Base)](https://bloodbowlbase.ru/bb2025/core_rules/the_game_of_blood_bowl/) ·
[Blood Bowl — Basic Mechanics Review (Frontline Gaming)](https://frontlinegaming.org/2018/12/03/blood-bowl-basic-mechanics-review/) ·
[Justesen et al., „Blood Bowl: A New Board Game Challenge and Competition for AI" (2019)](https://njustesen.github.io/njustesen/publications/justesen2019blood.pdf) ·
[Frozen Cortex (Steam)](https://store.steampowered.com/app/237350/Frozen_Cortex/) ·
[Out of the Park Baseball 26 (Steam)](https://store.steampowered.com/app/3116890/Out_of_the_Park_Baseball_26/) ·
[Baseball Highlights: 2045 (BoardGameGeek)](https://boardgamegeek.com/boardgame/151022/baseball-highlights-2045) ·
[Blood Bowl: Team Manager (BoardGameGeek)](https://boardgamegeek.com/boardgame/90137/blood-bowl-team-manager-the-card-game) ·
[Teamfight Tactics — League of Legends Wiki](https://wiki.leagueoflegends.com/en-us/Teamfight_Tactics_(game)) ·
[Hearthstone Battlegrounds — Guide (PCGamesN)](https://www.pcgamesn.com/hearthstone/battlegrounds-guide-how-to-play) ·
[Super Auto Pets — The Basics (Wiki)](https://superautopets.wiki.gg/wiki/The_Basics) ·
[Super Auto Pets mechanics (a327ex)](https://a327ex.com/posts/super_auto_pets_mechanics) ·
[Ben Brode über Marvel Snaps Rezept (mobilegamer.biz)](https://mobilegamer.biz/second-dinners-ben-brode-reveals-marvel-snaps-recipe-for-success-literally/) ·
[Marvel Snap (Wikipedia)](https://en.wikipedia.org/wiki/Marvel_Snap) ·
[Clash Royale (Wikipedia)](https://en.wikipedia.org/wiki/Clash_Royale) ·
[Auto battler (Wikipedia)](https://en.wikipedia.org/wiki/Auto_battler).

## 8. Was diese Recherche nicht getan hat

Keinen Prototyp, keinen Mockup, keine Messung — reine Konzeptarbeit, wie beauftragt. Slay the
Spire und Flamme Rouge/Heat sind aus Kenntnis der Spiele beschrieben, nicht aus einer frischen
Quelle; die übrigen Vorbilder sind oben belegt. Die Aussage zur Kampfdauer in Hearthstone
Battlegrounds (20–40 s bei 7 gegen 7) ist eine Größenordnung aus Spielbeobachtung, keine
gemessene Zahl. Das erste Mockup, das Chris kritisiert hat, liegt nicht im Repo — die Kritik ist
hier aus seiner Zusammenfassung übernommen.
