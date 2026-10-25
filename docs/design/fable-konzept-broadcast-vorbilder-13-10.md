# Broadcast-Vorbilder: Tour de France, Formel 1, Football, Basketball — Konzept (Fable + Opus, 13.10.)

**Reine Konzeptrunde. Kein Code geändert, nichts gemessen, kein Verhaltens-PR.** Auftrag, wörtlich
(Chris, 13.10., nachdem das Fable-Konzept zur großen Feedback-Runde gemergt war,
`docs/design/fable-konzept-chris-feedback-13-10.md`, PR #1175):

> „sobald das konzept steht fang an meine wünsche umzusetzen. Besonders optisch kann man noch
> einiges raus holen, schau dir an wie zb Zeitfahren bei der Tour de France gebroadcastet wird.
> Oder formel 1 rennen. oder football oder basketball etc. da kannst du dir einige scheiben von
> abschneiden, such das mal und bespreche das mit fable/opus und setzt das auch noch mal besser
> auf"

---

## 0. Kurzfassung

1. **Drei von vier Vorbildern sind für dieses Projekt schon ein zweites Mal erforscht worden —
   nur nicht unter diesem Namen.** `f1-broadcast-audit-runde-2-30-09.md` ist wörtlich ein
   F1-Broadcast-Audit (Timing-Konsistenz, ein Stand statt drei, Banner-Dosierung). Für Zeitfahren
   existieren bereits zwei Tour-de-France-Recherchen: `zeitfahren-recherche-06-09.md` (Rezept,
   Gelände statt Hindernisse, Checkpoints) und `time-trial-nachtkonzept-03-10.md` (Hot Seat, Live-
   Ampel — explizit nach dem Vorbild van der Poel/Pogačar). Dieses Papier wiederholt das nicht,
   sondern **bündelt es erstmals unter der Fragestellung, die Chris heute stellt**, füllt die
   Lücke (Formel-1-Timing-Tower als *Muster*, nicht nur als Audit-Maßstab; Football/Basketball-
   Score-Bug) und schließt die Lücke, die alle drei bisherigen Papiere offen lassen: **welche der
   beiden Bühnen des Projekts bekommt das zuerst?**
2. **Die wichtigste neue Erkenntnis dieser Runde: die Vorbilder treffen auf zwei verschiedene
   Baustellen, und nur eine davon ist in einem echten Spielstand sichtbar.** Das Battle-Arena-
   Motor (`public/mockups/battle-mode.engine.js`) ist der Entwurfsreiter, den die bisherigen
   Recherchen untersucht haben — **aber laut Audit vom 13.10. läuft KEINER der sieben echten
   Spielstände im Battle Mode** (`docs/design/gesamtstand-audit-13-10.md`, Abschnitt (a): „ALLE
   sieben echten Spielstaende laufen im Manager Mode — strukturell, nicht durch Chris' Wahl"). Was
   Chris an seinem Spielstand sieht, ist die **Spieltags-Bühne**
   (`app/foundation/discipline-stage/arena/disciplines/*.tsx`), eine zweite, einfachere
   Visualisierung mit eigenen Dateien je Disziplin — und die hat von den drei genannten Papieren
   noch **keine einzige** Verbesserung bekommen. Abschnitt 1 begründet das im Detail.
3. **Vier übertragbare Muster, konkret benannt** (Abschnitt 2): Höhenprofil + Zwischenzeiten-
   Diff (Tour de France), permanenter Timing-Tower mit Lücken statt Platzzahl (Formel 1),
   konsistenter Score-Bug mit genau einer Wahrheit (Football), On-Court-Graphics statt Bug-
   Blick weg vom Spielfeld (Basketball).
4. **Der ausgearbeitete Vorschlag für Zeitfahren** (Abschnitt 3) hat zwei Teile, weil er auf
   beide Bühnen zielt: **ZF1** (Klasse A, baubar ohne Chris' Freigabe außer der Bauabnahme) baut
   auf der Spieltags-Bühne ein echtes Höhenprofil-Band mit Live-Positionsmarker und verwandelt die
   heutige Seitentabelle in ein Overlay über der Strecke. **ZF2** (Klasse B/W, braucht Chris' Ja
   UND die rho/Pp-Pflichtprüfung) ist die Umsetzung der bereits gemessenen Motor-Rezeptur aus
   `zeitfahren-recherche-06-09.md` — Gelände statt Sturzrisiko, Einzelstart, Checkpoints mit Diff
   zur Bestzeit — **mit einer wichtigen Korrektur**: der heutige Pp-Stand (22,8, „nah an der
   Schranke", `stand-aller-disziplinen.md`) bedeutet, dass ZF2 nicht nur rho, sondern auch Pp neu
   prüfen muss, bevor es gebaut wird.
5. **Was NICHT neu erfunden wird:** Hot Seat, Live-Ampel (J1/J2), Startfolge-Frage (E5) — alles
   schon im Nachtkonzept vom 03.10. ausgearbeitet, inklusive des Tour-de-France-Zitats, das es
   trägt. Dieses Papier übernimmt es unverändert und ordnet es nur in die Pakete-Sequenz ein.
6. **Was an der Simulation hängt, bleibt an der Simulation hängen.** Kein Baustein in Abschnitt 2
   oder 3 ersetzt die rho>0,80/Pp≤25-Pflichtprüfung aus CLAUDE.md — im Gegenteil, Abschnitt 4
   markiert für jeden Baustein einzeln, ob er sie überhaupt berührt.

---

## 1. Welche Bühne zuerst? — dieselbe Frage wie Q0, mit einer schärferen Antwort

`fable-konzept-chris-feedback-13-10.md` Abschnitt 2 (Q0) hat bereits festgehalten, dass das Projekt
zwei Oberflächen hat und Chris' eigene Screenshots vom 13.10. die Battle-Arena beschreiben (das
Wort „Bein", der Tempo-Knopf `#spd`). Für **dieses** Papier ist die Antwort schärfer, weil Chris
heute nicht über eine konkrete Disziplin spricht, sondern darüber, wie die Sendung **grundsätzlich
besser aussehen soll** — und die Sendung, die er an seinem eigenen Spielstand sieht, ist die
Spieltags-Bühne.

| | Battle-Arena-Motor (Entwurf) | Spieltags-Bühne (live) |
|---|---|---|
| Code | `public/mockups/battle-mode.engine.js`, `FoundationBattleArenaHost.tsx` | `app/foundation/discipline-stage/arena/disciplines/*.tsx`, gerendert über `DisciplineStageNativeArena.tsx` (4879 Zeilen) |
| In echten Saves? | **Nein** — keiner der sieben Live-Spielstände nutzt Battle Mode (`gesamtstand-audit-13-10.md` (a)) | **Ja — alle sieben**, strukturell |
| Bisherige Broadcast-Recherche | `f1-broadcast-audit-runde-2-30-09.md` (Timing-Konsistenz), `fable-ideen-broadcast-praesentation-30-09.md` (HUD-Overlay-Infrastruktur), `zeitfahren-recherche-06-09.md` + `time-trial-nachtkonzept-03-10.md` (Zeitfahren-Rezept und Hot Seat) | **keine** |
| Zeitfahren-Darstellung heute | zwölf Läufer auf parallelen Spuren, Hindernis-Sturzrisiko statt Gelände (Abschnitt 1.2 dort), kein Einzelstart | `PelotonField` (`peloton.tsx`): Punkt-zu-Punkt-Straße, Start­rampe, Zielbogen, Windschatten-Optik — **schon deutlich näher an einem echten Zeitfahren**, aber ohne Höhenprofil und mit der Wertung in einer separaten Seitenspalte |
| Wertungsanzeige während des Rennens | `#kmitte`/Bug über dem Canvas, teils widersprüchlich (F1-Audit 3.1) | rechte Seitenspalte, exakt so hoch wie das Feld (`DisciplineStageNativeArena.tsx:3605–3629`, „Staffel-Ladder … die Tabelle rechts in JEDER Disziplin exakt so hoch ist wie die Arena links") — gilt für **alle** Disziplinen außer Gewichtheben (`animField = prim !== "barbell"`, Zeile 3425) |

**Folgerung für dieses Papier:** Wenn „besser aufsetzen" heißen soll, dass Chris selbst etwas davon
sieht, **muss die Arbeit zuerst an der Spieltags-Bühne ansetzen**, nicht am Motor. Das ist keine
Abwertung der vorhandenen Motor-Recherchen — sie bleiben richtig und wertvoll, sobald E1 („Soll ein
Spielstand auf Battle Mode umgestellt werden?", `fable-konzept-chris-feedback-13-10.md` Abschnitt 9)
mit Ja beantwortet ist. Aber bis dahin bauen sie an einem Entwurfsreiter. Deshalb ist der
ausgearbeitete Zeitfahren-Vorschlag in Abschnitt 3 **zweigeteilt**: ZF1 für die Bühne, die Chris
jetzt schon anschaut, ZF2 für den Motor, sobald E1 geklärt ist.

**Nebenbefund, der die Seitenspalte als generelles Muster entlarvt (nicht nur bei Zeitfahren):**
Die rechte Ergebnisspalte (`trackLadder`, oben zitiert) ist keine Zeitfahren-Besonderheit, sondern
die Standard-Darstellung für **neunzehn von zwanzig** Disziplinen auf der Spieltags-Bühne. Chris'
Satz „du könntest die Felder vllt sogar größer machen wenn du mehr damit arbeitest teils sachen in
den screen zu integrieren" (zitiert in `broadcast-praesentation-uebergreifend-recherche-06-09.md`,
dort allerdings für den Motor untersucht) trifft auf der Spieltags-Bühne auf genau dasselbe Problem,
das dieses Papier für Zeitfahren konkret löst — Abschnitt 5 hält das als offenen Querschnittspunkt
fest, ohne ihn hier zu einem eigenen Bauauftrag zu machen.

---

## 2. Die vier Vorbilder — was sich übertragen lässt

Fokus: nur, was sich auf unsere Simulation als **Präsentationsmuster** übertragen lässt, nicht eine
Sport-Enzyklopädie.

### 2.1 Tour de France — Einzelzeitfahren (ITT)

| # | Muster | Beleg |
|---|---|---|
| TDF-1 | **Höhenprofil-Leiste** am unteren Bildrand mit Live-Positionsmarker, der dem aktuellen Fahrer folgt — macht „hier kommt der Berg" sichtbar, bevor er das Tempo drückt | SMT (Grafik-Dienstleister für NBCs Tour-Übertragung) liefert „full-screen, data-rich graphics with race stage profiles showing the layout of the current stage and rider progression" ([SMT](https://smt.com/smt-delivers-new-features-for-time-trial-stages-for-nbc-sports-tour-de-france/)) |
| TDF-2 | **Zwischenzeiten-Diff zur Bestzeit**, nicht zu einem beliebigen Gegner — SMT ergänzte für Zeitfahren-Etappen explizit „the time each rider must finish to take the yellow jersey" und einen Zwei-Fahrer-Vergleich ([SMT](https://smt.com/smt-supplies-real-time-speed-gradient-graphics-for-nbcs-tour-de-france-coverage/)) | — |
| TDF-3 | **Startreihenfolge: Langsamste zuerst, Favoriten zuletzt** — bei großen Rundfahrten startet das Feld in umgekehrter Reihenfolge, damit der Hot Seat (der Stuhl des aktuellen Bestzeithalters) im Lauf des Tages tatsächlich bedrängt wird | bereits im Projekt belegt: `time-trial-nachtkonzept-03-10.md` Abschnitt 2 Zitat „one of the defining images of the stage" |
| TDF-4 | **Eine Kamera je Fahrer statt eines Massenstart-Felds** — Helikopter-/Streckenkamera folgt genau einem Fahrer, nicht zwölf gleichzeitig | Kritikpunkt eines Fachblogs an schlecht gemachten Zeitfahren-Übertragungen, die stattdessen nur „a time for some of the riders on the road" zeigen, statt die Lage auf der Strecke — exakt das Gegenbild zu TDF-4 ([inrng.com, zitiert in der Suche](https://inrng.com/?p=16083)) |

**Schon im Projekt verankert:** TDF-2/TDF-3 sind `zeitfahren-recherche-06-09.md` Abschnitt 4.4 bzw.
`time-trial-nachtkonzept-03-10.md` Baustein J1 — beide für den Motor ausgearbeitet, keins davon
gebaut. TDF-1 (Höhenprofil) ist der Teil, der laut Commit-Historie **einmal existierte und wieder
entfernt wurde** — Abschnitt 3.1 unten.

### 2.2 Formel 1

| # | Muster | Beleg |
|---|---|---|
| F1-1 | **Permanenter Timing-Tower**: Position, Lücke zum Vordermann/zur Spitze (nicht nur der eigene Rang), letzte Rundenzeit, Reifen — dauerhaft im Bild, nicht nur auf Nachfrage | Live-Timing „exposes lap, sector, and tyre data, plus gaps and speed traps" ([sportsvideo.org](https://www.sportsvideo.org/?p=317875)) |
| F1-2 | **Farbkodierte Positionswechsel**: wer einen Platz gewinnt, wird grün markiert, wer verliert, rot | Analyse des Timing-Walls: „if two drivers switch positions, the driver who gained the place is highlighted in green, and the one who lost out is shown in red" |
| F1-3 | **Strategie-Grafiken aus denselben Live-Daten, die ohnehin vorliegen** — ein „Strategy Insight"-Overlay, das Boxenstopp-Entscheidungen aus Timing + Telemetrie erklärt, kein neuer Wurf, nur neue Lesart vorhandener Zahlen | [formula1.com](https://www.formula1.com/en/latest/article/explaining-the-new-tyre-performance-graphics-seen-on-tv) |
| F1-4 | **Ghost-Car-Vergleich**: eine Runde gegen eine andere gelegt, zeigt, wo Zeit gewonnen/verloren wird | F1 TV „Ghost Car feature places one driver's lap against another" |

**Schon im Projekt verankert:** F1-1/F1-2 sind praktisch die Gegenprobe zu `f1-broadcast-audit-
runde-2-30-09.md` Priorität 1, Punkt 3 („Ein Stand je Bildschirm") — das Audit hat exakt
dieselbe Lücke (widersprüchliche Stände statt eines permanenten, konsistenten Turms) schon für den
Motor gefunden und priorisiert, nur ohne den F1-Namen zu nennen. F1-3/F1-4 sind neu für dieses
Papier und am ehesten auf Mehrkampf-Disziplinen mit laufender Rangliste übertragbar (Spurt,
Staffel, Takeshi) — s. Abschnitt 5.

### 2.3 Football (NFL-Stil)

| # | Muster | Beleg |
|---|---|---|
| NFL-1 | **Score-Bug mit genau einer Wahrheit**: Stand, Spieluhr, Quarter, Down & Distance, Ballbesitz-Pfeil — eine feste Position, ein Satz Zahlen | „Fox Box" (1994) etablierte „the game clock, score, and other information consistently in one corner of the screen" ([sportsvideo.org](https://www.sportsvideo.org/2026/06/09/designing-the-modern-scorebug-how-broadcast-graphics-teams-are-rethinking-the-most-important-element-on-screen/)) |
| NFL-2 | **Ballbesitz-Pfeil als eigenes, kleines Element**, getrennt von Down & Distance, aber in derselben Leiste | — |
| NFL-3 | **Vorsicht vor Verwechslungsgefahr beim Redesign**: ESPN musste 2018 die Down-Anzeige mitten in der Saison zurückbauen, weil Zuschauer den neuen gelben Indikator für eine Strafflagge hielten | „A new yellow down indicator was confused for penalty flags … prompted a mid-game redesign" |

**Schon im Projekt verankert:** NFL-1 ist exakt `f1-broadcast-audit-runde-2-30-09.md` Priorität 1,
Punkt 1 — „Football: angezeigter Stand ≠ Ergebnis" (Scoreline 9:6 gegen Ticker „10:7") — und Q6 aus
`fable-konzept-chris-feedback-13-10.md` (Anspiel-Szene). NFL-3 ist eine Warnung, die für **jeden**
Score-Bug-Umbau in diesem Projekt gilt, nicht nur Football.

### 2.4 Basketball (NBA-Stil)

| # | Muster | Beleg |
|---|---|---|
| NBA-1 | **On-Court-Graphics statt Blick weg vom Spiel**: TNT hat 2019 einen Shot-Clock direkt auf dem Parkett (am Freiwurf-Kreis) eingeblendet, Begründung ausdrücklich „would let viewers watch the ball and action instead of glancing at the corner bug" | [Yahoo Sports / awfulannouncing](https://au.sports.yahoo.com/nba-tnt-on-court-shot-clock-graphic-los-angeles-lakers-clippers-season-opener-reaction-twitter-033505214.html) |
| NBA-2 | **Der Bug bleibt trotzdem — als Rückfallebene**: TNT behielt die klassische Uhr im Bug zusätzlich; ein Kritiker merkte an, dass zwei Orte für dieselbe Information verwirren. Lehre: **ein** Ort, nicht zwei konkurrierende | — |
| NBA-3 | **Rot aufleuchtender Shot-Clock beim Herunterzählen** als Spannungssignal | „praised a team's red shot-clock background for drawing attention when the clock is winding down" | 

**Schon im Projekt verankert:** NBA-2 ist fast wortgleich eine Lehre, die `DisciplineStageArena.tsx`
Zeile 1238 schon selbst zieht („zwei konkurrierende Overlays wären Lärm") — das Projekt hat diese
Regel also bereits für sich entdeckt, nur noch nicht auf die Seitenspalten-vs-Overlay-Frage
angewendet. NBA-1 ist das stärkste Argument FÜR genau das, was Chris für Zeitfahren wörtlich
verlangt: Information auf das Spielfeld selbst legen, nicht danebenstellen.

---

## 3. Der ausgearbeitete Vorschlag: Zeitfahren

### 3.1 ZF1 — Spieltags-Bühne: Höhenprofil-Band + Overlay statt Seitenspalte (Klasse A)

**Ausgangslage.** `PelotonField` (`app/foundation/discipline-stage/arena/disciplines/peloton.tsx`)
zeichnet heute eine Punkt-zu-Punkt-Straße mit Startrampe, Windschatten-Optik und kariertem
Zielbogen — visuell schon näher an einem Zeitfahren als der Motor (Abschnitt 1). **Ein
Streckenprofil gab es schon einmal:** Commit `acfd9c39` („Time Trial: Feld entstauchen +
Streckenprofil-Strip entfernt", 20.07.) hat einen unteren Grasstreifen mit einer Sinuskurven-Fläche
und einem mitlaufenden Fortschritts-Punkt entfernt, ausdrücklich weil er „ohne echten Nutzen" war —
er war rein dekorativ (eine zufällige Sinuskurve, `Math.sin(i*(0.7+h01("pw")*0.5)+1.7)`, ohne jeden
Bezug zu echten Streckendaten) und nahm Platz weg, der dem Feld fehlte (das Peloton stapelte sich
auf der Mittellinie). Diese Entfernung war zum damaligen Zeitpunkt richtig — aber sie hat das
Problem nicht gelöst, nur verschoben: **es gibt heute kein Höhenprofil, weil das alte keinen Nutzen
hatte, nicht weil ein Höhenprofil grundsätzlich keinen Nutzen hätte.**

**Der Unterschied zum alten Strip:** ein neues Höhenprofil liest **echten Streckenzustand**, nicht
eine Zufallskurve, und liegt **über** der Fahrbahn statt als dritter Streifen darunter.

1. **Geländezonen als Daten, nicht als Dekoration.** Pro Spiel ein deterministisch aus der
   Matchday-ID gezogenes Profil (3–4 Zonen „steigung"/„abfahrt"/„flach", wie der Gelände-Hook, der
   für den Motor schon entworfen wurde, `zeitfahren-recherche-06-09.md` Abschnitt 3.1) — auf der
   Spieltags-Bühne **rein informativ**, weil hier `score` bereits die Wahrheit ist (`PelotonField`
   Kommentar Zeile 7: „x = kumulierte Punkte (Score = Wahrheit)"). Das Profil erzählt also eine
   Geschichte zu einem Ergebnis, das längst feststeht — bit-identisch, Klasse A, weil nichts
   gelesen wird, was nicht schon da ist (nur die Matchday-ID als Seed).
2. **Das Band liegt ÜBER der Straße, nicht darunter.** Ein schmaler, halbtransparenter Streifen
   direkt unter dem Horizont (dort, wo heute `roadArt`s Himmel-Verlauf ohnehin leer ist,
   `peloton.tsx` Zeilen 162–171), mit einer Höhenlinie und eingefärbten Zonen — das ist exakt das
   NBA-1-Muster: Information AUF dem Bild, nicht daneben.
3. **Live-Positionsmarker je Fahrer**, nicht nur ein einzelner „Führender"-Punkt wie beim alten
   Strip — jeder Token bekommt einen kleinen Schatten auf dem Höhenprofil, der seiner x-Position
   exakt folgt (dieselbe `tp(t, t.animScore)`-Projektion, die das Hauptfeld schon nutzt, nur auf die
   Profil-y-Achse gemappt statt auf `roadC`). Das macht sichtbar, wer gerade den Berg hochfährt,
   während das Hauptbild nur „weiter vorne/hinten" zeigt.
4. **Wertung als Overlay statt Seitenspalte.** Die heutige `trackLadder`-Spalte rechts (gleiche
   Höhe wie das Feld, `DisciplineStageNativeArena.tsx:3605–3629`) wandert für Zeitfahren in ein
   kompaktes, halbtransparentes Overlay in der oberen linken Ecke der Straße — fünf bis sechs
   sichtbare Zeilen (Rang · Code · Rückstand zur Spitze), ausklappbar auf die volle Liste, exakt
   das Muster aus Q5 (`fable-konzept-chris-feedback-13-10.md` Abschnitt 3.5), nur auf die
   Spieltags-Bühne übertragen statt auf den Motor. Die ausführliche `DisciplineStageResultTable`
   (Slot-für-Slot-Aufschlüsselung, „Fable End-Screen B") bleibt unverändert als Nachlese unter dem
   Feld bzw. im Drawer — sie ersetzt nichts, sie kommt nur nicht mehr zusätzlich als Live-Spalte.
5. **Sequenzielles Antreten als Kamerafokus, nicht als neue Startlogik.** Die Spieltags-Bühne
   berechnet (wie der Motor) alle Teilnehmer gleichzeitig — das ist ihre Architektur und bleibt es
   (`score`-Reveal in festen Runden, dieselbe Infrastruktur wie jede andere Disziplin). „Einzeln
   sehen" wird hier durch **Kamerafokus** gelöst, nicht durch echte Einzelstarts: ein Klick auf
   einen Fahrer (die Hover/Klick-Infrastruktur existiert bereits, `onOpenHover`/`onOpenTeam`,
   `peloton.tsx` Zeilen 414–419) zoomt die Kamera eng auf ihn und sein Stück Höhenprofil — dieselbe
   Idee wie TDF-4, nur ohne eine zweite Zeitachse einzuführen.

**Warum das Klasse A ist, mit einer Einschränkung:** Punkte 1–4 lesen ausschließlich vorhandenen
oder aus einer festen ID abgeleiteten Zustand, schreiben nichts in `score`/`displayScore`/`rank` —
dieselbe Garantie, die jeder A-Baustein in diesem Projekt braucht. Die **Einschränkung**: Punkt 5
(Kamerafokus) ist eine reine UI-Interaktion ohne Simulationsbezug, aber er verändert, **was der
Zuschauer zuerst sieht** — eine Sichtprüfung mit mehreren Kaderpaarungen sollte vor dem Merge
bestätigen, dass der Fokus-Modus niemanden „verschwinden" lässt, während er fokussiert ist (die
rAF-Schleife läuft für alle zwölf Fahrer unverändert weiter, auch wenn nur einer gezeichnet im Fokus
steht).

**Aufwand:** mittel — ein neues Profil-Band (SVG-Pfad wie beim alten Strip, aber zonenbasiert statt
Sinuskurve), eine Umwidmung der Seitenspalte zu einem Overlay (CSS/Positionierung, kein neuer
Datenpfad), ein Fokus-Modus (Kamera-State + Zoom-Transform, die `kameraUpdate`-Idee aus dem Motor
übertragen auf die SVG-Viewbox der Spieltags-Bühne). **Betrifft rho/Pp nicht.**

### 3.2 ZF2 — Battle-Arena-Motor: das bereits gemessene Rezept bauen (Klasse B/W)

Für den Motor ist die Recherche fertig — `zeitfahren-recherche-06-09.md` hat das Rezept (K5:
Gelände statt Hindernis-Sturzrisiko, ENDTEMPO für Anstiege, WENDIGKEIT für Kurven/Abfahrten),
die Präsentation (Einzelstart über das bereits generische `u.startT`, Kamera-Fokus, Zwischenzeiten-
Panel mit Diff zur Bestzeit an zwei Checkpoints) und die Tour-de-France-Dramaturgie (Hot Seat +
Live-Ampel, `time-trial-nachtkonzept-03-10.md`) bereits ausgearbeitet und kaderfest gemessen. Dieses
Papier fügt dem **eine Korrektur** hinzu, die beide Vorrecherchen noch nicht hatten, weil sie vor
der jüngsten Pp-Komplettmessung lagen:

**Der heutige Pp-Stand ist knapper als beim Rezept-Vergleich angenommen.** `stand-aller-
disziplinen.md` nennt für Time-Trial aktuell **rho 0,923 (komfortabel) und Pp 22,8 („bestanden, nah
an der Schranke")** — also schon im Ist-Zustand wenig Luft zur 25er-Pp-Schranke aus CLAUDE.md. Die
K5-Messung aus `zeitfahren-recherche-06-09.md` hat nur rho gemessen, nicht Pp (`messe-arena-
einfluss.mjs` wird dort nicht erwähnt). **Das heißt: Vor dem Bau von ZF2 gehört eine Pp-Messung des
K5-Rezepts auf die Liste, die beide Vorrecherchen noch nicht abgeschlossen haben** — es wäre
möglich, dass ein Rezept, das Dexterity/Awareness einen neuen, realistischen Kanal gibt (wie K5 es
tut), die Pp-Abweichung sogar verbessert, weil heute tote Sub-Skills (WENDIGKEIT, TECHNIK) wieder
zu tragen anfangen. Das ist aber eine Vermutung, keine Messung, und genau die Art Annahme, die
CLAUDE.md verbindlich zur Pflichtprüfung macht.

**Reihenfolge, wenn Chris E1 (Battle Mode) und E5 (Startfolge umkehren) zustimmt:**

1. K5-Rezept isoliert bauen, rho **und** Pp in zwei Saatstämmen messen (Ergänzung zur bestehenden
   Recherche).
2. Fällt die Pp-Prüfung durch oder bleibt rho ohne Puffer (die 06.09.-Recherche warnt selbst: „der
   Puffer ist kleiner als das Rauschen selbst"), bleibt das Gelände vorerst **nur Bild** — als
   stetige Tempo-Anzeige im Ticker wie im Ist-Zustand, ohne den zugrundeliegenden Rezept-Austausch.
   Das wäre dieselbe Abbruchregel, die das Projekt für Climbing (K3) und Feldspiel (K5 in
   `fable-konzept-chris-feedback-13-10.md`) schon kennt.
3. Besteht beides, folgen Einzelstart (Umbenennung `fertig` → eigene Laufzeit, Abschnitt 4.2 der
   06.09.-Recherche), Checkpoints, Hot Seat + Live-Ampel in der dort schon festgelegten Reihenfolge.

**Warum dieses Papier die ausführliche Mechanik nicht noch einmal herleitet:** Sie steht bereits in
zwei Dokumenten mit Code-Skizzen, Kandidaten-Vergleich und offenen Fragen an Chris. Eine dritte
Version würde nur das Risiko erhöhen, dass eine Zahl beim Abschreiben abweicht. Dieses Papier
verweist darauf und ergänzt nur den Pp-Prüfpunkt, der fehlte.

---

## 4. Klassifizierung — was reine Präsentation ist und was die Mechanik berührt

| Baustein | Bühne | Klasse | Berührt rho/Pp? |
|---|---|---|---|
| ZF1.1–1.4 (Höhenprofil, Positionsmarker, Overlay-Wertung) | Spieltags-Bühne | **A** | Nein — reine Leser von `score`/Matchday-ID |
| ZF1.5 (Kamerafokus) | Spieltags-Bühne | **A** (UI) | Nein, aber Sichtprüfung vor Merge |
| ZF2 Schritt 1 (K5-Rezept + Pp-Nachmessung) | Battle-Arena-Motor | **B** | **Ja — Pflichtprüfung, noch offen** |
| ZF2 Schritt 3 (Einzelstart, Wertung auf eigene Laufzeit) | Battle-Arena-Motor | **W** (Wertungscode angefasst, Ergebnis analytisch unverändert) | Isolationsnachweis Pflicht, kein neuer rho-Effekt erwartet |
| ZF2 Hot Seat / Live-Ampel (J1/J2) | Battle-Arena-Motor | **T** (J1) / **A** (J2) | J1 verändert die Startfolge (Sendezeit/Dramaturgie), kein `rr()`; J2 liest nur |
| F1-1/NFL-1 (ein konsistenter Stand/Bug) | Battle-Arena-Motor | **A** | Nein — bereits in `f1-broadcast-audit-runde-2-30-09.md` Priorität 1 als A eingestuft |
| NBA-1-Übertragung (On-Field-Graphics statt Seitenspalte, generalisiert über 19 Disziplinen) | Spieltags-Bühne | **A** | Nein, aber Aufwand pro Disziplin unterschiedlich (offene Frage, Abschnitt 6) |

**Lesart:** Jeder Baustein in dieser Tabelle, der mit A markiert ist, braucht keine rho/Pp-Abnahme,
weil er nachweislich nur vorhandenen Zustand liest. Jeder B/W/T-Baustein bleibt an die
Pflichtprüfung aus CLAUDE.md gebunden — dieses Papier hebt sie an keiner Stelle auf, es sagt nur,
WELCHE Bausteine überhaupt in ihre Nähe kommen (und das sind, bis auf Pp-Nachmessung, exakt die,
die schon vor diesem Papier als B/W/T bekannt waren).

---

## 5. Pakete-Sequenz

Reiht sich in die siebenteilige Sequenz aus `fable-konzept-chris-feedback-13-10.md` Abschnitt 8
ein, statt eine zweite zu erfinden. Neue/konkretisierte Einträge **fett**.

| Paket | Zusatz aus diesem Papier | Aufwand | Voraussetzung |
|---:|---|---|---|
| 1 (Kleinkram) | — (unverändert) | — | — |
| 2 (Sendungsrahmen) | — (unverändert, Matchup-Folge betrifft Zeitfahren nicht — Zeitfahren hat keine 1v1-Duelle) | — | — |
| 4 (Bild-Pakete ohne Mechanik) | **ZF1 (Höhenprofil + Overlay + Kamerafokus auf der Spieltags-Bühne)** statt/ergänzend zu den bisher dort stehenden 5a/5b-Punkten — ZF1 ersetzt 5b vollständig (Höhenprofil, nur ohne das Fahrrad-Asset) und liefert einen Teil von 5a (Kamerafokus) ohne echten Einzelstart | mittel, 2–3 Tage | — |
| 5 (Konzeptrunden) | **Pp-Nachmessung des K5-Rezepts** (Ergänzung zu K5/K8 — kein neuer Punkt, sondern eine fehlende Spalte in einer bestehenden Messung) | klein, ein Messlauf | E1 |
| 6 (Mechanik-/Wertungsrunden) | **ZF2** (Gelände-Rezept, Einzelstart, Checkpoints, Hot Seat/Live-Ampel) — unverändert aus den beiden Vorrecherchen, nur hinter die Pp-Nachmessung gestellt | mehrere Tage | E1, E5, Pp-Nachmessung bestanden |
| — (neu, unabhängig) | **F1-1/NFL-1-Konsistenzfixes** (ein Stand je Bildschirm) | bereits in `f1-broadcast-audit-runde-2-30-09.md` Priorität 1 vollständig spezifiziert — dieses Papier empfiehlt, sie unabhängig von Zeitfahren sofort als eigenes kleines Paket zu ziehen, weil sie den größten Konsistenzgewinn für den geringsten Aufwand liefern | 1–2 Tage | — |

**Warum ZF1 vor ZF2:** ZF1 ist Klasse A und zeigt Chris sofort etwas an seinem eigenen Spielstand
(Abschnitt 1) — ZF2 braucht erst E1 (Battle Mode) und dann noch eine offene Messung. Umgekehrt
gebaut, würde Wochen Arbeit in eine Bühne fließen, die laut Audit vom 13.10. kein einziger
Spielstand zeigt.

---

## 6. Offene Entscheidungsfragen für Chris

| # | Frage | Warum offen |
|---|---|---|
| **BV1** | Soll ZF1 (Höhenprofil + Overlay-Wertung) auch für die anderen vier Bahn-Disziplinen der Spieltags-Bühne (Spurt, Staffel, Climbing, Takeshi) gebaut werden, oder zunächst nur für Zeitfahren, weil es Chris' genanntes Beispiel ist? Die `trackLadder`-Seitenspalte betrifft wie in Abschnitt 1 gezeigt alle neunzehn animierten Disziplinen, nicht nur Zeitfahren — eine Entscheidung hier spart später Diskussion. |
| **BV2** | Bleibt die Fahrrad-Asset-Arbeit aus 5b (`zeitfahren-movement-assets-16-09.md`) ein eigener Programmpunkt, oder wird sie zurückgestellt, bis ZF1 zeigt, ob das Höhenprofil allein schon den gewünschten Effekt liefert? |
| **BV3** | Für ZF2: Wenn die Pp-Nachmessung des K5-Rezepts durchfällt (Abschnitt 3.2) — reicht dann „Gelände nur als Bild, Mechanik bleibt" (wie bei Climbing/K3 vorgemacht), oder soll eine zweite Rezept-Runde versucht werden? |
| **BV4** | Sollen die F1-1/NFL-1-Konsistenzfixes aus `f1-broadcast-audit-runde-2-30-09.md` Priorität 1 als eigenständiges, von Zeitfahren unabhängiges Paket sofort gezogen werden (Empfehlung dieses Papiers, Abschnitt 5), oder warten sie auf E1 wie der Rest der Motor-Arbeit? |
| **BV5** | Chris nennt Football/Basketball explizit als Vorbild — beide laufen heute auf der Spieltags-Bühne als generische Score-Felder ohne eigenen Score-Bug (`football.tsx`, `court.tsx` haben keine Down&Distance-/Shot-Clock-Anzeige, nur dekorative Touchdown-/Korb-Effekte). Soll ein NFL-/NBA-Score-Bug für diese beiden eine eigene Konzeptrunde bekommen (vergleichbar zu diesem Zeitfahren-Papier), oder bleibt der Fokus vorerst auf Zeitfahren, wie es Chris' Satz als Beispiel nennt? |

---

## Quellen

Im Repo (gelesen): `docs/design/fable-konzept-chris-feedback-13-10.md` (Q0, Q5, 4.2, E1/E5/E6/E7);
`docs/design/gesamtstand-audit-13-10.md` ((a), (b) Time-Trial-Zeile); `docs/design/stand-aller-
disziplinen.md` (Time-Trial rho/Pp); `docs/design/zeitfahren-recherche-06-09.md` (vollständig);
`docs/design/time-trial-nachtkonzept-03-10.md` (J1/J2, Hot Seat); `docs/design/time-trial-
broadcast-paket-plan-07-10.md`; `docs/design/f1-broadcast-audit-runde-2-30-09.md` (vollständig);
`docs/design/fable-ideen-broadcast-praesentation-30-09.md` (Overlay-Infrastruktur, Klassenschema);
`docs/design/broadcast-praesentation-uebergreifend-recherche-06-09.md`.

Code (gelesen): `app/foundation/discipline-stage/arena/disciplines/peloton.tsx` (vollständig);
`app/foundation/discipline-stage/arena/disciplines/registry.ts`; `app/foundation/discipline-stage/
arena/DisciplineStageNativeArena.tsx` (Zeilen 3425, 3605–3629, 4719–4873, 1238); `app/foundation/
discipline-stage/arena/DisciplineStageResultTable.tsx`; `app/foundation/discipline-stage/arena/
disciplines/football.tsx`, `court.tsx` (kein Score-Bug-Äquivalent); Commit `acfd9c39` („Time Trial:
Feld entstauchen + Streckenprofil-Strip entfernt", 20.07.).

Web-Recherche (13.10., Quellen wie im Text verlinkt): SMT (NBC-Tour-de-France-Grafiken),
sportsvideo.org (F1-Timing-Wall, moderne Score-Bugs), formula1.com (Strategy-Insight/Tyre-
Performance), awfulannouncing.com (NFL-/NBA-Score-Bug-Historie und -Kritik), Yahoo Sports/TNT
(On-Court-Shot-Clock).
