# Bahn-Disziplinen — Fable-Ideen: Time-Trial, Spurt, Staffel, Takeshi's Castle (30.09.)

Chris will für die Bahn-Gruppe einen frischen, zweiten Blick neben Opus: offenes Brainstorming,
keine Umsetzung. Dieses Dokument ist deshalb **reines Konzept** — kein Code, keine
Produktionsdatei geändert. Stand `main` `42358ca6` (29.09.). `engine.js` meint
`public/mockups/battle-mode.engine.js`. Jede Zahl, die ich nenne, stammt aus einem gelesenen
Dokument, einer PR-Beschreibung oder einem Motor-Kommentar und trägt ihre Quelle; **keine Zahl
hier ist neu gemessen.** Wo ich eine Größe vorschlage, steht „Vorschlag" daneben.

Gelesen, damit ich nicht wiederhole: `bahn-disziplinen-opus-konzeptreview-26-09.md` (die
Konzeptrunde zu genau dieser Gruppe, samt Plan-Sonde), `bahn-disziplinen-recherche-fable.md`
(Sport- und Codeformeln), `zeitfahren-recherche-06-09.md`, `spurt-modellierung-recherche-05-09.md`,
`spurt-offene-fragen-plus-optik-plan-05-09.md`, `staffel-modellierung-recherche-05-09.md`,
`staffel-offene-fragen-plus-takeshis-castle-05-09.md`, `takeshi-chaos-tackle-plan-06-09.md`,
`takeshi-hindernis-vs-strecke-recherche-13-09.md`, `climbing-neukonzept-22-09.md`,
`i-spy-schatzsuche-konzept-21-09.md` (das Mehrwege-Muster), `stand-aller-disziplinen.md`, dazu
die Kommentarblöcke an `BAHN_ART` (`engine.js:30887–31910`), die PR-Beschreibung der
Haushalt-Runde (#1035) und die Commit-Bodies der beiden Bahn-Broadcast-Runden (28.09.).

## Kurzfassung

- **Seit dem Opus-Review vom 26.09. ist mehr passiert, als das Review selbst noch wusste.** Die
  Haushalt-Runde (TT-P1/SP-P1, PR #1035, 26.09.) ist umgesetzt: Attacke gewinnt im Zeitfahren
  nicht mehr 100 %, sondern 50 % (Gleichmaß die anderen 50 %), „Von vorn" im Spurt nicht mehr
  84 %, sondern 41,7 %. Zwei Broadcast-Runden (28.09.) haben sechzehn Klasse-A-Anzeigen auf
  die Bahn gebracht (Zwischenzeit-Tafel, Hot Seat, Geisterfahrer, Streckenband, Stationsstatistik,
  Bein-Zeile, Führungsverlauf, Fallen-Schilder, Nerven-Leiste, MXC-Captions, …). **Wer heute Ideen
  für die Bahn sucht, sucht also nicht mehr nach Anzeige und nicht mehr nach dem Haushalt,
  sondern nach dem, was der bindende Haushalt jetzt erst möglich macht.**
- **Die stärkste Idee dieses Dokuments ist deshalb ein Prinzip, kein Feature: „Zwei Währungen"
  (1.1).** Seit die Puste bindet, gibt es auf der Bahn zwei Dinge, die ein Läufer ausgeben kann —
  Zeit und Puste. Jeder Nebenweg, den die Mehrwege-Leitlinie verlangt, sollte ab jetzt in der
  **anderen** Währung bezahlen als der Primärweg. Das ist der Unterschied zwischen einem
  Nebenweg, der bloß „schlechter" ist (I-Spy-Muster A: weniger Punkte), und einem, der eine
  **Abwägung** ist. Konkret daraus: Kurven-Risiko im Zeitfahren (2.2), Schleife-oder-Durchbruch
  nach Puste im Spurt (3.2), Überziehen im Zielsprint (1.2).
- **Zweitstärkste Idee: „Ins Rote gehen" (1.2)** — ein Überziehungsrahmen der Puste auf den
  letzten Metern, dessen Tiefe an Schmerztoleranz hängt (Spurt: Torment 14, in STEHEN). Er ist
  deterministisch, macht Negativ-Split im Zeitfahren erstmals zu einem gewinnbaren Plan (heute,
  nach TT-P1, immer noch 0 %) und gibt den Slots „Photo Finish", „Finish Kick" und „Split Control"
  den Inhalt, den ihre Texte versprechen.
- **Drittstärkste Idee: der Alternativ-Rechner (1.3, Klasse A*).** Die Plan-Sonde aus Anhang A des
  Opus-Reviews ist als Werkzeug für Chris wertvoller als als Messinstrument: Nach dem Rennen
  „Mit Gleichmaß wäre er 0,4 s schneller gewesen" anzeigen. Das ist die einzige Anzeige, die die
  Taktik-Ebene für den Spieler **lernbar** macht, statt sie nur zu behaupten. Im Zeitfahren fällt
  während des Rennens kein `rr()` — dort ist die Zahl exakt.
- **Je Disziplin:** Time-Trial hat noch den größten Spielraum (2.1 „Der Favorit fährt zuletzt",
  2.2 Kurven-Risiko, 2.4 Streckenlänge als Profil-Achse). Spurt bekommt mit **Parcours-Varianten**
  (3.1) das, was Takeshi längst hat, und Speed damit endlich seine Gerade. **Staffel: mir ist
  nichts Neues eingefallen, das besser wäre als ST-P1/ST-P2 von Opus** — dort ist der richtige
  nächste Schritt Umsetzung und die Pp-Nachmessung bei n = 144, nicht noch ein Konzept; meine
  Beiträge sind Ergänzungen (4.1 Eingespielte Paare als Manager-Ebene, 4.2 Wechselgewinn als
  Zahl, 4.3 der Hinweis auf 2–6 je Seite). **Takeshi: erst messen, dann reden** (5.1) — Pp 36,4
  ohne Detailtabelle ist die offene Position, und 5.3 ist ein Ein-Zeilen-Kandidat dafür, der
  schon im Motor liegt (`fallenDurchbruch`, ungesetzt, für rho gemessen, für Pp nie).
- **Was ich bewusst nicht vorschlage** steht je Disziplin am Ende des Abschnitts, mit Grund —
  meist rho (Positionsvorteil, fremde Hand, Team-Effekt auf Einzelwertung), einmal weil Chris es
  entschieden hat (Staffel-DNF, Takeshi-Garde).

---

## 0. Rückblick: was steht, was entschieden ist, was seit dem 26.09. gelandet ist

### 0.1 Der Stand in Zahlen

| | Time-Trial | Spurt | Staffel | Takeshi's Castle |
|---|---:|---:|---:|---:|
| rho je Spiel (kaderfest, 26.09.-Nachtrag) | 0,929 | 0,906 | 0,899 | 0,874 |
| Pp-Abweichung (Stand-Doku, 26.09.) | 22,8 (nah an 25) | 11,4 | 60,4 (VERLETZT, n=24, strukturell unsicher) | 36,4 (VERLETZT, Detailtabelle fehlt) |
| Plan-Dominanz nach #1035 | Attacke 50 % / Gleichmaß 50 % / **Negativ-Split 0 %** | Von vorn 41,7 % | Pläne wirkungslos (alle `tempo:1.00`) | ausgeglichen 35/35/30 |
| Rest-Puste im Ziel | bindet seit TT-P1 | bindet seit SP-P1 | 88 % (bindet nicht, bewusst) | 24–31 % |
| Mehrwege-Urteil (Opus 26.09.) | teilweise | nur am Hindernis | ein Weg | erfüllt |

Quellen: `stand-aller-disziplinen.md` (Pp-Tabelle Teil 2), PR #1035 (Plan-Dominanz), Opus-Review
0.3 (Rest-Puste Staffel/Takeshi).

### 0.2 Was seit dem Review gelandet ist (und was ich deshalb nicht mehr vorschlage)

- **Haushalt (TT-P1/SP-P1), PR #1035, 26.09.:** `zehrExponent:3`, `leerTempoBasis:0.50`,
  `kraftBasis` 290 → 170 (TT) und `kraftSpanne` 1.0, `pusteFangen` 0,30 (TT) / 0,16 (Spurt),
  `huerdePreis` 1,00 → 1,45 und STEHEN-Rezept im Spurt auf Torment/Health/Dexterity. Beides nur
  in den zwei Bahnen gesetzt, Staffel/Takeshi bit-identisch.
- **Broadcast-Optik Bahn, Prio 1 + 2, 28.09.** (`6003b0e7`, `94aa6440`/`71d2867f`): Hot Seat,
  Zwischenzeit-Tafel, Geisterfahrer, „Zeit für den Teamsieg", Streckenband für alle vier,
  Stationsnamen + Stationsstatistik (Spurt), Stand nach jedem Wechsel + Bein-Zeile +
  Führungsverlauf + Anker-Einblendung (Staffel), Fallen-Schilder + „Noch im Rennen" + Nerven-Leiste
  + MXC-Captions (Takeshi). Das zugehörige Dokument `broadcast-optik-bahn-27-09.md` liegt auf
  dem Branch `broadcast-bahn-recherche-27-09`, nicht auf `main` — ich kenne es nur über die
  Commit-Bodies.
- **Bewusst nicht gebaut, weil Klasse B/S/W** (aus demselben Commit-Body, wartet auf Chris):
  Strafaufgabe bei Sturz, Zeitlimit/Buzzer, Ein-Fehlversuch-Ausscheiden, Final Showdown,
  fliegende Übergabe/Wechselmarke, Streckenprofil-Vorschau, Pacing-Grafik.
- **Mutator-Trait-Konzept, 29.09. (`42358ca6`):** Faktor `F = 1 + m·h` am Simulationseingang je
  Chassis, noch nicht umgesetzt, drei Fragen an Chris offen. Für die Bahn heißt das: Jede Idee
  hier muss mit einem multiplikativen Eingangsfaktor auf `tempoVon()` verträglich sein. Alle
  unten sind es (keine greift an der Eignung selbst).

### 0.3 Offen aus dem Opus-Review (mein Bezugsrahmen)

TT-P2 Wellenfahrer, TT-P3 Streckenprofile, TT-P4 Funk · SP-P2 Strafschleife, SP-P3
Reaktionszeit · ST-P1 Wechselmarke, ST-P2 Beine mit Charakter, ST-P3 Anker unter Druck (oder
WUCHT → Q) · TC-P1 Wahl-Fallen, TC-P2 Zeitlimit, TC-P3 Show-Down-Bild. Dazu fünf Fragen an
Chris (Review 6.2), keine beantwortet.

### 0.4 Entschieden, nicht mehr zu diskutieren

- Matrix gesperrt, für alle zwanzig (CLAUDE.md, 21.09.). Alles hier greift an Kanälen.
- rho > 0,80 in **einem** Spiel, real „nicht schlechter als heute"; Pp ≤ 25 in zwei Saatstämmen.
- Kein Totalausfall durch Einzelwurf: kein Fehlstart-DQ, kein Staffel-DNF, kein Ausscheiden durch
  fremde Hand (`tackleNerven` gemessen schädlich, Saison 0,937 → 0,902).
- Takeshi: Rempler nur gegen die gegnerische Seite (Chris 06.09.), keine Garde als Gegner.
- Spurt ist ein Hindernissprint (Fable 05.09., Opus 26.09.), keine Leichtathletik-Bahn.
- Staffel: keine variablen Beinlängen (K5 gestrichen), kein Konstanz-Stat, KI-Reihenfolge bleibt.
- Zeitfahren: Einzelstart 0,8 s, Teamwertung Zeitsumme (Chris 22.09.).
- Bit-Identität per Konvention: jedes neue Feld in `BAHN_ART` ist ungesetzt wirkungslos.
- Kadergrößen: die Saisonlogik würfelt heute **gleichverteilt 2–6 je Seite**
  (`buildSeasonPlayerCount`, `lib/season/season-discipline-schedule.ts:117`; innerhalb einer
  Kategorie mit fünf Disziplinen als ausgeglichene Ziehung 2/3/4/5/6, `:166 ff.`). Die ältere
  Regel „die Basiszahl wird nie gespielt" (`staffel-offene-fragen…` 1.5, 05.09.) gilt nicht mehr.
  Jede Mechanik muss bei **zwei bis sechs** je Seite bestehen — bei zwei je Seite über Star in
  Top 2 und Paartreue statt über nacktes rho (`spurt-offene-fragen…` Frage 5).

### 0.5 Wie ich Ideen klassifiziere

- **Klasse A** — reine Anzeige: kein `rr()`, kein neues Sim-Feld, `wert()`/`tempoVon()`/Rezept
  unangetastet, rho bit-identisch. Braucht keine Zustimmung, nur eine Sichtprüfung.
- **Klasse A\*** — Anzeige mit eigener Buchhaltung (Zähler, Zweitsimulation), Ergebnis
  unverändert. Braucht den Nachweis, dass die Zufallskette des Rennens nicht berührt wird.
- **Klasse B** — echte Mechanik: greift in `stepSpurt`/`tempoVon`/Wechselformel/Plan ein.
  Braucht Chris' Zustimmung, Prototyp, kaderfeste rho- und Pp-Messung, Isolationsnachweis.
- **Klasse S** — Saison-/Manager-Zustand außerhalb des Rennens (Spielstand, Aufstellung).
  Braucht Chris' Zustimmung und Persistenz; rho-Wirkung indirekt.

Aufwand: **klein** = Konfiguration oder wenige Zeilen plus Messung (Stunden), **mittel** =
ein Prototyp mit Vorher/Nachher an drei Kadergrößen (1–2 Tage), **groß** = mehrere PRs mit
neuem Sim-Zustand oder neuem Maß (mehrere Tage).

---

## 1. Drei Ideen, die alle vier Bahnen betreffen

### 1.1 „Zwei Währungen": jeder Nebenweg zahlt in der anderen Münze (Prinzip, Klasse B je Anwendung)

**Was.** Vor #1035 gab es auf der Bahn eine Währung: Zeit. Puste war da, band aber nicht
(Spurt 41–48 % Rest, Time-Trial 14–17 %), also war „Puste sparen" kein Preis. Seit dem 26.09. ist
sie in Time-Trial und Spurt eine zweite, echte Währung: Wer sie ausgibt, bricht ein, und der
Einbruch ist hart (×0,50) und langsam abzuschütteln (Fangen bei 30 % / 16 %).

Das I-Spy-Muster kennt zwei Arten, einen Nebenweg schlechter zu stellen: weniger Punkte (A) oder
langsamer/schwerer (B). Für die Bahn schlage ich eine dritte, bahneigene Regel vor: **Primärweg
und Nebenweg derselben Aufgabe zahlen in verschiedenen Währungen.** Der Primärweg (natives
Attribut) ist billig in beiden; der Nebenweg ist so schnell wie der Primärweg, kostet aber Puste
— oder er ist puste-neutral und kostet Zeit. Dann ist die Wahl keine Frage „welcher Weg ist
besser?", sondern „was habe ich gerade übrig?", und **die richtige Antwort hängt am Zustand des
Läufers in diesem Rennen**, nicht nur an seinem Profil. Das ist genau die Entscheidung, die
Opus' Prüffrage 2 („hängt die richtige Antwort vom Profil ab?") noch einen Schritt weiterführt.

**Warum jetzt und nicht früher.** Vor der Haushalt-Runde wäre ein Puste-Preis ein Nullpreis
gewesen. Die Runde hat also nicht nur die Plan-Dominanz repariert, sie hat einen Designraum
geöffnet, den bisher niemand betreten hat.

**Was bereits so gebaut ist, ohne so genannt zu werden:** Der WUCHT-Durchbruch am Hindernis
(Spurt, Takeshi) kostet `wuchtKraft` — er ist schon ein Nebenweg in der anderen Währung. Der
Berg-Nebenweg im Zeitfahren (`bergNebenSkill:"WUCHT"`, Anteil 0,40) ist es dagegen **nicht**:
Er ist ein Mischanteil im selben Tempofaktor, also Muster A. Beide Beobachtungen sagen: Das
Prinzip ist mit dem Motor verträglich, und es gibt Stellen, wo es fehlt.

**Anwendungen in diesem Dokument:** 1.2 (Überziehen), 2.2 (Kurven-Risiko), 2.3 (Abfahrt als
Erholung), 3.2 (Schleife oder Durchbruch nach Puste).

**rho/Pp.** Ein Preis in Puste statt Zeit verschiebt Gewicht von den Zeitkanälen auf STEHEN/
ROBUST. In Time-Trial ist Stamina der bekannteste Überzeichner (+9,8 Pp nach dem vierten
Kalibrierschritt, `engine.js:31163`), also muss jede Puste-Anwendung dort klein dosiert sein;
im Spurt hat STEHEN seit #1035 Torment/Health/Dexterity und ist damit gerade der Kanal, der
Torment (Matrix 14, lange bei 0 %) trägt — dort **hilft** ein Puste-Preis der Pp-Zahl eher.

**Aufwand:** null als Prinzip; je Anwendung s. dort.

### 1.2 „Ins Rote gehen": Überziehungsrahmen am Schluss (Klasse B, mittel)

**Was.** Auf den letzten X % der Strecke (Vorschlag: 10 % im Spurt, 8 % im Zeitfahren) darf ein
Läufer die Puste **unter null** fahren, ohne dass der `leer`-Einbruch greift — bis zu einer
Tiefe `rot = rotBasis · STEHEN/100` (Vorschlag: `rotBasis` so, dass STEHEN 80 rund vier
Sekunden Volltempo mehr erlaubt als STEHEN 20). Wer die Tiefe ausschöpft, kommt „leer" ins Ziel —
was im Ziel nichts mehr kostet. Wer den Rahmen **vor** der Schlusszone braucht, bekommt ihn
nicht: dort gilt der Einbruch wie heute. Deterministisch, kein `rr()`.

**Warum das zu diesen Disziplinen passt.** Real ist das die Physiologie des Endspurts: In den
letzten Sekunden gibt es keinen Grund mehr zu sparen, weil nichts nachkommt; wer „über die
Schwelle" geht, zahlt mit dem Einbruch **nach** der Linie. Im Spurt sagt die Matrix mit Torment 14
und Will 14 genau das („Photo Finish: Braucht Nerven und Torment für den letzten Meter"); im
Zeitfahren ist es der Finish Kick.

**Was es taktisch löst.** Nach TT-P1 gewinnt Negativ-Split immer noch **nie** (PR #1035:
Attacke/Gleichmaß je 50 %). Der Plan spart in der ersten Hälfte (`tempo:0.88`) und fährt danach
1,0 — aber „alles" ist heute nicht mehr als Gleichmaß auch kann, denn über null geht niemand.
Mit einem Überziehungsrahmen bekommt „zweite Hälfte alles" erstmals eine Auszahlung, die
Gleichmaß nicht hat: Der Sparer kommt mit Rest an die Schlusszone **und** darf dort ins Rote.
Damit wird der beste Plan zur Profilfrage — großer Rahmen (STEHEN) → Negativ-Split, kleiner
Rahmen → Gleichmaß, viel Reserve → Attacke — was die Plan-Sonde messen kann. Im Spurt bekommt
„Schlusssprint" (`kick`, spart bis 62 %) dieselbe Auszahlung, und die Slots Topspeed/Photo Finish
hören auf, Etiketten zu sein.

**Welches Attribut.** Die Tiefe liest STEHEN. Spurt: Torment 36 / Health 30 / Dexterity 20 /
Will 14 — Schmerztoleranz, passend. Time-Trial: Stamina 34 / Intelligence 26 / Awareness 32 —
„Durchhalten", weniger griffig, aber Torment steht in der TT-Matrix bei 3, also wäre ein
Torment-Rahmen dort Erfindung. Deshalb im Zeitfahren **kleiner** dosiert und bewusst nur als
Zünglein zwischen Nachbarn.

**rho/Pp, ehrlich.** Der Rahmen ist ein zweiter STEHEN-Kanal. Im Spurt wünschenswert (Torment
lange untergewichtet), im Zeitfahren ein Stamina-Risiko (s. 1.1). Beides ist eine Messung, kein
Argument. Verlässlichkeit: kein neuer Wurf, also kein Rauschen; Validität: eher Gewinn, weil
Negativ-Split heute Rauschen nach Slot erzeugt (Split Control / Finish Kick verlieren strukturell,
Opus 1b.1) und dieses Rauschen verschwindet, wenn der Plan für seine Fahrer richtig wird.

**Aufwand:** mittel. Ein Feld `rotZone`/`rotBasis` in `BAHN_ART` (ungesetzt = heute), eine
Bedingung im `leer`-Zweig von `tempoVon()`, Plan-Sonde vorher/nachher, Pp an zwei Saatstämmen.
Staffel bleibt außen vor (Puste bindet dort nicht, 88 % Rest), Takeshi ebenfalls (Nerven sind
dort die Schlussressource, nicht die Puste).

**Für Chris:** Klasse B. Frage: „Darf ein Läufer im Zielsprint über seine Reserve gehen und dafür
leer ins Ziel kommen?" — ja/nein, und ob im Zeitfahren überhaupt.

### 1.3 Der Alternativ-Rechner: „Was hätte der andere Plan gebracht?" (Klasse A\*, klein bis mittel)

**Was.** Opus' Plan-Sonde (Review Anhang A) fährt ein Rennen mit `__arena.bahnLauf(d, saat,
ansagen)` erneut, mit **einem** Läufer auf einem anderen Plan. Dieselbe Rechnung, nach dem
Rennen headless für die sechs Heimläufer und die zwei Alternativpläne ausgeführt, liefert eine
Endstand-Zeile je Läufer: „Attacke: 13,6 s · mit Gleichmaß 14,1 · mit Negativ-Split 14,3." Bahn-
Rennen sind kurz (10–22 Sim-Sekunden), zwölf Zweitläufe je Rennen sind billig.

**Warum.** Das Review hat als Kernproblem benannt, dass Chris „nach Rolle aufstellt und dafür
bestraft wird, ohne es sehen zu können" (Opus, Kurzfassung). Jede Mechanik, die Pläne echt macht
(TT-P1, 1.2, TT-P2), ist für den Spieler nur so viel wert, wie er den Unterschied **sieht**.
Zwischenzeit-Tafel und Hot Seat zeigen, was war; der Alternativ-Rechner zeigt, was gewesen
wäre. Das ist die Broadcast-Idee „Pacing-Grafik" (Klasse W im Bahn-Broadcast-Commit, zurückgestellt)
in ihrer ehrlichsten Form: keine Kurve, eine Zahl.

**Grenze, ehrlich.** Im Zeitfahren fällt während des Rennens kein `rr()` — dort ist die Zahl
exakt (Review Anhang A). In Spurt, Staffel und Takeshi verschiebt ein Planwechsel die
Zufallsfolge; dort ist die Einzelzahl Würfelrauschen. Deshalb: **Zeitfahren zeigt die Zahl,
die drei anderen zeigen eine Tendenz** („Gleichmaß hätte in 3 von 3 Saaten gewonnen"), gerechnet
über drei Saaten, oder gar nichts. Lieber nichts als eine falsche Zahl.

**rho.** Bit-identisch, wenn die Zweitläufe in einem eigenen Zustand laufen (die Sonde tut das
schon). Klasse A\*, weil es Rechenzeit und einen zweiten Simulationslauf braucht.

**Aufwand:** klein (Zeitfahren allein), mittel (alle vier mit Saaten-Tendenz). Gehört als Zeile
ins Endstand-Overlay der Bahn, nicht in den Ticker.

---

## 2. Time-Trial

Die Bahn mit dem meisten Spielraum, weil TT-P1 den Haushalt repariert hat, die Pläne aber noch
zu zweit sind (Negativ-Split tot) und das Gelände nur einen echten Nebenweg hat (Berg).

### 2.1 „Der Favorit fährt zuletzt" — Startreihenfolge nach Eignung, aufsteigend (Klasse A, klein)

**Was.** Heute startet Läufer `idx` zur Zeit `(idx·2 + seite)·0,8 s` (`engine.js:28223`,
Seiten im Wechsel, `idx` aus der Kader-/Slotreihenfolge). Vorschlag: Die Startfolge wird nach
Eignung **aufsteigend** sortiert, Seiten weiter im Wechsel — der Schwächste rollt als Erster von
der Rampe, der Beste als Letzter, mit allen Referenzzeiten auf der Tafel.

**Warum zu dieser Disziplin.** Jedes echte Zeitfahren startet so (Gesamtwertung umgekehrt), und
der Grund ist Dramaturgie: Der Hot Seat wird von hinten aufgerollt, der Bestzeithalter sitzt
immer länger, und die letzten drei Starter sind die, auf die alle warten. Das Hot-Seat-Podest
(TT-2), der Geisterfahrer (TT-3) und die Zwischenzeit-Tafel (TT-1) sind seit dem 28.09. gebaut —
sie erzählen heute die falsche Reihenfolge, weil der Beste oft als Erster fährt und der Rest
nur noch verliert.

**rho.** Neutral im Ergebnis: `bahnZeit()` zählt eigene Laufzeit, kein Läufer beeinflusst den
anderen (`schatten:false`, `tackle:false`). **Aber nicht zwingend bit-identisch:** `formTag`
(Tagesform ±1,5 %) wird in `bauSpurt` gezogen; hängt die Ziehreihenfolge an `idx`, ändert die
Umsortierung die Zuordnung der Tagesform zu den Läufern. Erwartungswert gleich, Einzelrennen
nicht. Prüfen, ob die Ziehung an den Läufer (Name/Saat) oder an den Index gebunden ist; im
zweiten Fall vor der Sortierung ziehen.

**Aufwand:** klein. Eine Sortierung in `bauSpurt` für `art.zeitfahren`, Sichtprüfung des Hot
Seat. Zuschauzeit unverändert (Rampe bleibt 11 × 0,8 s).

### 2.2 Kurven-Risiko: „späte Bremse" als Nebenweg, bezahlt in Puste (Klasse B, mittel)

**Was.** Die Kurvenzone liest heute TECHNIK („Linie": Intelligence 40 / Dexterity 34 / Awareness
26) und sonst nichts — ein Weg. Vorschlag nach 1.1: In der Kurve zählt das Bessere aus zwei Wegen.
Primärweg TECHNIK wie heute (Kurvenverlust `kurveKosten` × (1 − Linie), kostet nur Zeit).
Nebenweg WUCHT („Risiko": Torment 40 / Dexterity 32 / Awareness 28): Der Fahrer bremst spät und
nimmt die Kurve mit höherem Tempo — sein Zeitverlust sinkt um einen Anteil, den WUCHT bestimmt,
dafür zehrt die Kurvenzone Puste (Vorschlag: `kurveNebenZehr` als Faktor auf `zehr`, wie
`bergZehr` es für den Berg schon tut). Wer WUCHT hat und Reserve, gewinnt in der Kurve; wer
WUCHT hat und leer ist, bekommt den Nebenweg nicht (Tor über Restpuste). Kein Sturz, kein
`rr()` — die Kurve bleibt stetig, wie K5 sie gemacht hat.

**Warum zu dieser Disziplin.** Zignoli 2021 (Fable-Recherche 3.2): In der Kurve ist die Leistung
null, und der Verlust kommt auf der Geraden nicht zurück — **außer** man trägt mehr Tempo
hinein, und das kostet nach der Kurve Beschleunigungsarbeit. Das ist real die Abwägung des
Technikers gegen den Draufgänger. Und der Slot „Risk Segment" (Dexterity/Torment, „Nimmt
Risiko") beschreibt genau diesen Fahrer; heute bekommt er nur den Plan „Attacke".

**Welches Attribut.** Torment steht in der TT-Matrix bei 3 — WUCHT ist trotzdem der richtige
Kanal, weil er zu 60 % aus Dexterity/Awareness besteht (Matrix 25 + 12, beides in der letzten
Pp-Runde noch die größten Löcher, `engine.js:31173`). Der Nebenweg zahlt also **auf die richtigen
Attribute** ein, nicht auf Torment.

**rho/Pp.** Verlässlichkeit unverändert (kein Wurf). Pp: Gewicht wandert von TECHNIK (Intelligence
40) zu WUCHT (Dexterity/Awareness) — Intelligence lag zuletzt bei +2,2 Pp, also ist etwas Abgabe
verkraftbar; Dexterity/Awareness gewinnen. Die Puste-Kosten erhöhen STEHEN-Gewicht: klein
dosieren (s. 1.1). Drei Kurvenzonen à 13 % — genug Strecke, dass der Kanal trägt, nicht so viel,
dass er alles ist.

**Aufwand:** mittel. Ein Zweig in `gelaendeFaktor()` (der Nebenweg-Mechanismus existiert für den
Berg schon, `bergNebenSkill`), ein Zehr-Faktor, Plan-Sonde, Pp in zwei Saatstämmen.

### 2.3 Die Abfahrt als Erholung (Klasse B, klein — nur zusammen mit 2.2)

**Was.** Heute gibt die Abfahrt einen Tempobonus aus WENDIGKEIT („Umsetzen", `abfahrtBonus:0.08`).
Vorschlag: Auf der Abfahrt regeneriert die Puste (Faktor auf `pusteRegen`, Vorschlag ×3), und
zwar **umso mehr, je weniger** der Fahrer den Bonus ausschöpft — wer die Abfahrt „laufen lässt",
erholt sich; wer sie fährt, holt Zeit. Die Aufteilung könnte der Plan bestimmen (Gleichmaß
erholt, Attacke fährt), nicht ein Wurf.

**Warum.** Real ist die Abfahrt die einzige Stelle im Zeitfahren, an der die Leistung unter der
Schwelle liegt (Swain 1997: bergab weniger Leistung ist optimal). Sie ist die natürliche
„Pause", die Chris am 13.09. für die Puste gewünscht hat („man lädt in Pausen etwas auf") — und
die es im Zeitfahren mangels Hindernis-Stopp nicht gibt. Zusammen mit 2.2 ergibt das eine
**Puste-Landschaft**: Berg und Kurve kosten (je nach Weg), Abfahrt gibt zurück — und der
Wellenfahrer (TT-P2) hat damit einen Grund, warum er bergab 0,90 fährt.

**rho/Pp.** Zwei Abfahrten à 6 % — klein. Pp: STEHEN-Gewicht steigt leicht (Erholung skaliert
mit STEHEN); deshalb nur als Paket mit 2.2 messen, das in die Gegenrichtung zieht.

**Aufwand:** klein als Konfiguration, wenn 2.2 den Zonen-Puste-Mechanismus schon gebaut hat.

### 2.4 Prolog und Königsetappe: Streckenlänge als vierte Profil-Achse (Ergänzung zu TT-P3, Klasse B, klein)

**Was.** TT-P3 (Opus) schlägt drei benannte Profile vor (flach/wellig/bergig), gewählt je Saat
wie Takeshis `kurse`. Ich schlage eine zweite Achse vor: die **Länge**. Ein „Prolog" (Vorschlag:
Streckenfaktor 0,6, Zeit ~8 s) und eine „Königsetappe" (Faktor 1,4, ~20 s) neben der heutigen
Normstrecke. Kurz heißt: ANTRITT (erste 3,2 s, Speed 40 / Power 28) wiegt schwer, Puste kaum.
Lang heißt: ENDTEMPO/STEHEN und die Puste-Landschaft entscheiden, Antritt ist Nebensache.

**Warum.** Das ist die einzige Profil-Achse, die den **Sprinter** vom **Rouleur** trennt, ohne
neues Gelände: Ein Fahrer mit Speed 80 und Stamina 40 ist auf dem Prolog Favorit und auf der
Königsetappe Mittelfeld. Real: Prolog (Tour, 6–8 km) gegen 40-km-Zeitfahren — verschiedene
Sieger. Für Chris eine Aufstellungsfrage, sobald das Profil vorab sichtbar ist (Review-Frage 3).

**rho/Pp.** Länge verschiebt die Attributanteile massiv; die Pp-Abnahme muss über alle Profile
gemittelt bestehen (Opus' eigene Warnung zu TT-P3 gilt hier doppelt). Verlässlichkeit: kurz =
weniger Ereignisse, aber im Zeitfahren fällt ohnehin kein Wurf — CLAUDE.md sagt, mehr Ereignisse
helfen hier fast nie, also schadet weniger auch kaum. Zuschauzeit: `ZEIT_DEHNUNG.time-trial` =
4,38; eine Königsetappe braucht eine kleinere Dehnung, sonst dauert sie real 90 s.

**Aufwand:** klein, wenn TT-P3 den Profil-Mechanismus baut (`gelaende` je Profil); die Länge ist
dann ein Faktor auf die Streckeneinheit plus Dehnung.

### 2.5 Bewusst nicht vorgeschlagen

- **Wetter/Wind, das sich während der Startfolge ändert** (real der Grund, warum die
  Startreihenfolge zählt). Das ist ein Positionsvorteil nach Startnummer, nicht nach Können —
  Opus hat den Informationsvorteil aus demselben Grund verworfen (TT-P4, „bewusst nicht"), und
  2.1 macht die Startnummer noch enger an die Eignung gekoppelt, also wäre der Fehler
  systematisch.
- **Mannschaftszeitfahren** (Sog innerhalb des Teams, Teamzeit = vierter Fahrer). Sportlich
  reizvoll, aber die Staffel hat gemessen, was situativer Sog mit der Validität macht
  (0,762 → 0,601), und die TT-Matrix hat kein Spirit/Charisma, das den Zug im Team tragen könnte.
  Wenn überhaupt, als Spieltags-Variante mit eigener Abnahme, nicht als Standard.
- **Setup-Wahl (Aero- gegen Bergrad) je Fahrer.** Wäre eine echte Chris-Entscheidung, aber ein
  flacher Multiplikator ohne Attribut dahinter; die Frage „welches Profil?" beantwortet TT-P3
  mit denselben Mitteln besser.

---

## 3. Spurt

Der Stationskern ist gut (Opus), der Haushalt bindet, Pp 11,4 ist die beste Zahl der Gruppe.
Was fehlt, ist das, was Takeshi längst hat: **Varianten** — und ein Kanal für Speed an einem Ort,
der nicht das Hindernis ist.

### 3.1 Drei Parcours: Sprinterkurs, Ninja-Kurs, Ausdauerkurs (Klasse B, mittel)

**Was.** Heute stehen die sieben Stationen bei 0,14 / 0,26 / … / 0,86 — alle zwölf Prozent eine.
Vorschlag: `kurse[]` in `BAHN_ART.spurt`, nach dem Takeshi-Muster (per Saat gewählt, dieselben
sieben Stationen, andere **Positionen** und Reihenfolge; `hindernisBilder`/`hindernisNamen`
folgen dem Index mit). Drei Vorschläge:

| Kurs | Stationen bei | Charakter | Wer profitiert |
|---|---|---|---|
| **Sprinterkurs** | 0,30 · 0,38 · 0,46 · 0,54 · 0,62 · 0,70 · 0,78 | 30 % freie Gerade vorn, dann dichte Kette, 22 % Auslauf | ANTRITT (Speed/Power), ENDTEMPO — der Läufer |
| **Ninja-Kurs** | 0,08 · 0,16 · 0,30 · 0,44 · 0,58 · 0,72 · 0,86 | Erste Station nach 8 %, Antritt zählt kaum, Hindernisse tragen | TECHNIK/WENDIGKEIT/WUCHT — der Turner |
| **Ausdauerkurs** | wie heute, drei Kraftstationen ans Ende (0,62 · 0,74 · 0,86) | die Wände kommen, wenn die Puste weg ist | STEHEN, Puste-Haushalt — der Zähe |

**Warum zu dieser Disziplin.** Speed 18 ist die höchste Einzelzahl der Spurt-Matrix, und Opus
hat notiert, dass Speed „an den Stationen keinen Weg hat, seinen Vorteil einzusetzen" (2b.2).
SP-P2 (Strafschleife) gibt Speed einen Weg **an** der Station. Der Sprinterkurs gibt ihm einen
Weg **zwischen** den Stationen: 30 % Gerade, auf der nichts als ANTRITT und ENDTEMPO zählen. Der
Ninja-Kurs ist das Gegenteil, und der Ausdauerkurs macht aus dem seit #1035 bindenden Haushalt
eine Streckenfrage. Real sind Hindernisläufe genau so verschieden: ein Spartan Sprint hat
Cluster und lange Laufstücke, ein Ninja-Kurs beginnt mit Quad Steps nach zwei Metern.

**Und die Aufstellung wird eine Frage.** Der Kurs wird mit dem Spieltag angekündigt (dieselbe
Entscheidung wie Review-Frage 3 für TT-P3): „Sprinterkurs" — Chris stellt Block Start und Top
Speed auf, „Ninja-Kurs" — Lane Control und Drive Phase. Heute gibt es keinen Grund, die Spurt-
Aufstellung je Spieltag zu ändern.

**rho/Pp.** Takeshis Kurse bewegten rho nur innerhalb der Kader-Spannweite (Basis 0,886, S3
0,876, Spannweite 0,073, `engine.js:31820`) — aber Takeshi ändert nur die Reihenfolge, nicht die
Positionen. Der Sprinterkurs verschiebt real Gewicht zu Speed; Pp muss **gemittelt über die drei
Kurse** ≤ 25 bleiben, und kein Einzelkurs darf so weit kippen, dass ein Spieltag die Matrix
verrät (Vorschlag als Korridor: je Kurs ≤ 35, gemittelt ≤ 25). ANTRITT ist auf 3,2 s ab Start
fest — beim Ninja-Kurs kommt die erste Station bei 8 % noch **in** der Antrittsphase; das ist
gewollt (der Turner braucht keinen Antritt), aber zu messen. Bei zwei je Seite (vier Läufer,
die kleinste Größe, die der Saisonplan würfelt) muss jede Variante die Star/Paartreue-Abnahme
aus `spurt-offene-fragen…` Frage 5 halten.

**Aufwand:** mittel. Konfiguration plus der Kurs-Mechanismus aus Takeshi (`bahnFallenTypen`,
`bahnKursName`, `engine.js:32858`), verallgemeinert auf Positionen; Pp je Kurs und gemittelt;
Schilder/Streckenband folgen automatisch, weil sie am Index hängen.

### 3.2 Schleife oder Durchbruch: die Wahl hängt an der Puste (Ergänzung zu SP-P2, Klasse B, klein)

**Was.** SP-P2 (Opus) setzt ans Ende der Kette die Strafschleife statt des Sturzes und erlaubt
plan-abhängig das bewusste Auslassen. Ich schlage vor, das Auslassen nicht am Plan, sondern am
**Zustand** zu entscheiden — nach 1.1: Der Durchbruch (WUCHT) kostet Puste (`wuchtKraft`, heute
schon), die Schleife kostet Zeit, aber keine Puste. Ein Läufer, dessen Restpuste unter einer
Schwelle liegt (Vorschlag: unter dem Fangen-Wert 0,16 plus Durchbruchskosten), geht direkt in
die Schleife, ohne den Versuch; einer mit Reserve versucht Technik, dann Wucht. Deterministisch.

**Warum.** Real ist das die Spartan-Entscheidung an der Rig: müde Arme → gleich die Burpees.
Und es macht STEHEN (seit #1035 Torment/Health) an der Station sichtbar, ohne dass STEHEN dort
einen eigenen Wurf bekommt. Der Ticker kann es sagen: „X spart sich das Seil — die Puste ist
weg."

**rho/Pp.** Reduziert den teuren Sturz-Wurf bei Leeren (Opus' Verlässlichkeitsargument für die
Schleife gilt verstärkt); Pp: Torment/Health gewinnen leicht, was seit #1035 (Torment lange 0 %)
in die richtige Richtung zeigt. Zu messen.

**Aufwand:** klein, wenn SP-P2 gebaut ist: eine Bedingung vor dem Technik-Wurf.

### 3.3 Freie Bahn vor der Station (Klasse B, klein, Kann)

**Was.** Opus: Am Hindernis bringt der Vordermann „eher Stau als Sog". Takeshi hat `gedraenge`
(Pulk kostet Stopp, `lesen` findet die Lücke). Für den Spurt mit seinen Bahnwechseln eine
leichtere Fassung: Kommen zwei Läufer innerhalb von 0,03 Strecke an derselben Station **auf
derselben Bahn** an, kostet der Hintere 0,10 s Stau (Vorschlag) — es sei denn, er hat vorher
per WENDIGKEIT (Dexterity 46 / Awareness 34) die Bahn gewechselt. Der bestehende
Bahnwechsel-Wunsch (`sucht`, `quer`) bekommt damit einen zweiten Auslöser: nicht Sog suchen,
sondern Stau vermeiden.

**Warum.** „Lane Control: Bleibt sauber über Dexterity und Awareness" ist der einzige Spurt-Slot,
dessen Text heute mechanisch nichts bedeutet (der Plan „Windschatten" dahinter ist seit #1035
weiter selten richtig). Awareness (Matrix 7) hat außer TECHNIK/WENDIGKEIT keinen eigenen Ort.

**rho.** Ein situativer Effekt (wer vorn ist, hat freie Bahn) — die Sorte, die Validität kostet.
Deshalb klein (0,10 s) und über Können vermeidbar. Kann; nur mit Vorher/Nachher.

### 3.4 Slot-Texte nach der Identitätsentscheidung (Klasse A, klein)

Sobald Chris Review-Frage 1 beantwortet hat (Hindernissprint bleibt — meine Empfehlung wie die
von Opus), gehören die sechs Slot-Texte in `lib/lineups/matchday-slot-roles.ts:153–160` auf den
Parcours: „Block Start" → „Anlauf", „Top Speed" → „Gerade", „Lane Control" → „Balance/Linie",
„Drive Phase" → „Wand", „Photo Finish" → „Letzte Meter". Die Attribute je Slot bleiben (sie
passen), nur die Wörter. Reine Anzeige, kein Motor.

### 3.5 Bewusst nicht vorgeschlagen

- **Räuberleiter / Teamhilfe an der Wand** (Tough Mudder, Spartan Team). Real und schön, aber der
  Helfer verliert Zeit für einen Teamkollegen — die Einzelwertung liest dann Opfer als Schwäche.
  Fremde Hand, auch wohlmeinende, ist das Muster, das die Staffel Validität gekostet hat.
- **Fehlstart-Disqualifikation.** Entschieden (kein Totalausfall durch Einzelwurf). SP-P3
  (Reaktionszeit ohne DQ) reicht.

---

## 4. Staffel

**Ehrlich vorweg: Hier ist mir nichts Neues eingefallen, das besser wäre als das, was schon auf
dem Tisch liegt.** ST-P1 (Wechselmarke mit fliegendem Gewinn, K4) und ST-P2 (Beine mit
Charakter, mit dem Maß „gegen den Gegner auf demselben Bein") sind die sporttypischen
Entscheidungen, und sie sind seit dem 05.09. dreimal konzipiert und nie gebaut. Der richtige
nächste Schritt ist **Umsetzung plus die Pp-Nachmessung bei n = 144** (die 60,4 ist strukturell
unsicher, Stand-Doku Teil 2), nicht ein viertes Konzept. Was ich beitragen kann, sind drei
Ergänzungen.

### 4.1 Eingespielte Paare: Vertrauen als Saisonzustand (Klasse S, mittel)

**Was.** Jedes Geber/Nehmer-Paar, das in einem Spiel zusammen gewechselt hat, bekommt im
Spielstand einen Zähler. Ab drei gemeinsamen Wechseln gilt das Paar als „eingespielt" (Vorschlag:
drei Stufen, bis zu +0,10 auf `Q` der Wechselformel, also innerhalb des K4-Rahmens, und eine
etwas engere Streuung). Ein Kaderwechsel oder eine neue Reihenfolge setzt den Zähler des
betroffenen Paares zurück.

**Warum zu dieser Disziplin.** Die Staffel ist die einzige Bahn, in der zwei Spieler **gemeinsam**
eine Leistung erbringen — und real trainieren Staffeln ihre Wechsel jahrelang; die Nationalstaffel
mit vier Einzelstars verliert gegen die eingespielte (die 21 % DNF-Quote in Finals, Zarębska
2021, ist genau das). Kein anderes Element des Spiels belohnt heute **Kontinuität in der
Aufstellung**. Das ist eine Manager-Entscheidung („behalte ich das Paar, obwohl der Neue schneller
ist?"), also die Ebene, auf der Chris das Spiel spielt.

**rho.** Der Bonus ist symmetrisch (beide Läufer des Paares, je zur Hälfte wie das Wechselkonto)
und klein; er verschiebt ein Paar gegen andere, nicht die beiden gegeneinander. Validität kostet
das nur, wenn der Bonus nicht mit dem Können korreliert — und weil gute Wechsler öfter
zusammenbleiben (die KI stellt nach TECHNIK auf), tut er das vermutlich. **Innerhalb eines
Spiels** ist er eine Konstante wie die Formkarte. Zu messen wie jede Mechanik; wenn er rho kostet,
ist er kleiner zu machen, nicht wegzulassen.

**Aufwand:** mittel. Persistenz im Spielstand (neues Feld je Team), Übergabe an den Motor wie die
Formkarten, Anzeige im Aufstellungsdialog („eingespielt seit 3 Spielen"). Setzt ST-P1 voraus,
sonst gibt es kein `Q`, auf das der Bonus wirken kann.

### 4.2 Der Wechselgewinn als Zahl (Klasse A, klein)

**Was.** Zarębskas Teammaß — Summe der Einzelbestzeiten minus Staffelzeit — als Endstand-Zeile:
„Durch Wechsel gewonnen: −0,31 s (Bein 2→3: −0,12, Bein 4→5: +0,08 verpatzt)". Heute existiert das
Wechselkonto intern (`WECHSEL_*`, Verlust hälftig auf Geber und Nehmer); es wird nur nie als
Summe gezeigt.

**Warum.** Sobald ST-P1 die Marke zur Entscheidung macht (Sicher/Normal/Scharf je Paar), braucht
Chris die Rückmeldung, ob „Scharf" sich gelohnt hat — je Paar, in Sekunden. ST-2 (Stand nach jedem
Wechsel) zeigt die Zeit, nicht den Gewinn gegen die Alternative. 4.2 ist für die Staffel, was 1.3
für die Pläne ist.

**Aufwand:** klein, aus vorhandenen Feldern.

### 4.3 Hinweis zu ST-P2: Beinprofile müssen für zwei bis sechs je Seite definiert sein

Die Staffel läuft mit zwei bis sechs je Seite (0.4). „Bein 1 aus dem Block, Kurve/Gerade im
Wechsel, Bein 6 Anker" ist für sechs gedacht. Vorschlag für die Regel, damit ST-P2 nicht an
der Zweier- oder Dreierstaffel scheitert: **erstes Bein immer Block, letztes immer Anker,
dazwischen Kurve und Gerade abwechselnd, beginnend mit Kurve** — bei zwei je Seite also Block +
Anker ohne Kurvenbein, bei drei Block + Kurve + Anker. Das Maß „gegen den Gegner auf demselben Bein" ist bei allen Größen definiert, weil
beide Seiten gleich viele Beine haben. Keine Idee, nur ein Stolperstein, der sonst in der
Umsetzungsrunde auftaucht.

### 4.4 Bewusst nicht vorgeschlagen

- **Anfeuerung der Wartenden als Tempo** (Spirit/Charisma der fünf anderen wirken auf den
  Laufenden). Thematisch die schönste Lesart von Spirit 16 — mechanisch ein Team-Mittel, das
  alle sechs einer Seite gleich verschiebt und die Einzelwertung damit nach den Attributen der
  **anderen** ordnet. Das ist das Sog-Problem in Reinform. Opus' sichere Variante (WUCHT in `Q`)
  ist der richtige Kanal.
- **Bahnlos (innen/außen, real 0,27 s).** Positionsbonus.
- **Team-DNF.** Entschieden.

---

## 5. Takeshi's Castle

Opus: „taktisch reichste der vier, braucht keinen Umbau." Dem stimme ich zu — mit einer
Einschränkung, die das Review noch nicht kannte: **Pp 36,4, verletzt, ohne Detailtabelle**
(Stand-Doku Teil 2, „Kopfzahl vor Timeout gerettet"). Eine Disziplin, die die Matrix nicht
durchreicht, ist nach CLAUDE.md nicht fertig, egal wie rund sie sich anfühlt.

### 5.1 Erst messen: die Pp-Detailtabelle (kein Konzept, eine Pflicht)

`messe-arena-einfluss.mjs takeshis-castle 24` mit Detailtabelle, zwei Saatstämme. Meine
Vermutung, **nur** als Hypothese für die Lesart der Tabelle: Charisma (Matrix 14) sitzt in
WENDIGKEIT (40), WUCHT (38) und ROBUST (18) — drei von sieben Sub-Skills, davon zwei, die an
jeder Falle und im Gedränge lesen — und ist deshalb vermutlich überzeichnet; Intelligence (11)
sitzt nur in TECHNIK (36), das seit `fallenKoennen:0.75` an vier von vierzehn Fallen den
Hauptwurf trägt, und ist vermutlich unterzeichnet. Wenn das stimmt, ist 5.3 ein Kandidat.

### 5.2 „Wer liest, sieht": Wahl-Fallen ohne Beobachtungsvorteil (Variante zu TC-P1, Klasse B, mittel)

**Was.** TC-P1 (Opus) macht zwei Fallen zur Wahl (Knock Knock: eine von vier Türen ist Papier;
Skipping Stones: nur manche Steine tragen) und lässt den, der nach einem anderen ankommt, dessen
Fehlversuch ausschließen (Awareness-Wurf). Opus benennt das Risiko selbst: Der
Beobachtungsvorteil hängt an der Lage (wer hinten ist, lernt). Meine Variante lässt die
Beobachtung weg und macht die Wahl zur **eigenen** Aufgabe mit zwei Wegen:

- **Primärweg TECHNIK („Falle lesen", Intelligence 36 / Awareness 30):** Trefferchance auf die
  Papiertür `p = basis + TECHNIK·k`. Jede falsche Tür kostet einen **stetigen** Preis (Vorschlag
  0,30 s) und den nächsten Versuch, höchstens drei; kein Sturz, keine Nerven.
- **Nebenweg WUCHT („Durchbrettern"):** Der Bulle liest nicht, er nimmt die erste Tür — Massivholz
  oder nicht. Gelingt der Wucht-Wurf, ist er durch (schneller als jeder Leser, aber es kostet
  `wuchtKraft` Puste — 1.1); misslingt er, prallt er ab: Sturz mit Nervenkosten wie heute.

Wer vorn ist, rät nicht schlechter als wer hinten ist. Der Gegenpol zu „Kopf voran" entsteht
trotzdem: Der Vorsichtige liest (drei Versuche, planbar), der Wilde brettert (schnell oder
Sturz). Dasselbe für die Steine mit WENDIGKEIT als Primär- und STEHEN als Nebenweg
(„Durchwaten": langsam, sicher, kein Sturz).

**Warum zu dieser Disziplin.** Es ist das Sendungs-typischste Element, das fehlt (Opus 4b.1), und
Chris' „Outsmarten" (06.09.) ist heute nur im Gedränge und beim Ausweichen — nicht an der Falle,
wo es in der Sendung stattfindet. Und es ist das I-Spy-Muster wörtlich: eine Aufgabe, ein
nativer Weg, ein schlechter gestellter Nebenweg, monotone Politik.

**rho/Pp.** Ohne Beobachtung fällt der lageabhängige Vorteil weg — der Hauptgrund für Opus'
„mittleres" Risiko. Der stetige Türpreis ist der `huerdePreis`-Gedanke (gemessen der Hebel von
0,697 auf 0,878). Pp: TECHNIK (Intelligence) bekommt zwei Fallen mehr als Hauptleser, WUCHT
(Charisma) bleibt Nebenweg — passt zur Hypothese aus 5.1, ist aber zu messen.

**Aufwand:** mittel. Ein Fallenzweig mit Versuchszähler, zwei Fallen im `kurse[]`-Muster markiert,
Bild und Ticker („zweite Tür — Massivholz", „dritte Tür — Papier!"), kaderfest bei zwei bis
sechs je Seite.

### 5.3 Typisierter Nebenweg statt Universal-Wucht: `fallenDurchbruch` für Pp nachmessen (Klasse B, klein)

**Was.** Der Durchbruch-Wurf liest an allen vierzehn Fallen reine WUCHT. `fallenDurchbruch`
(Anteil des Typ-Skills im Durchbruch-Wurf, Gegenstück zu `fallenKoennen`) liegt **ungesetzt im
Motor** (`engine.js:31789`, `:33849`) und wurde für rho gemessen (0,874 gegen 0,883 — „kein Gewinn,
deshalb nicht gesetzt"). **Für Pp wurde es nie gemessen**, und Pp ist heute die verletzte Zahl.
Ein Nebenweg, der an der Seilwand ROBUST liest statt WUCHT und an den Steinen STEHEN, nimmt
Charisma (in WUCHT 38) Gewicht und gibt es Will/Health — genau die Richtung, die 5.1 vermutet.

**Warum das der billigste Kandidat der ganzen Gruppe ist.** Eine Konfigurationszeile, kein Code,
kein neuer Wurf, rho gemessen neutral. Wenn Pp damit unter 25 fällt, ist Takeshi fertig, ohne
dass 5.2 gebraucht wird. Wenn nicht, weiß man es nach einer Stunde.

### 5.4 Der Cut: Zwei-Stufen-Format als Kursvariante (Klasse B, mittel, Kann)

**Was.** Ein vierter Kurs neben Nordhof/Sumpfpfad/Die Mauern: „Die Vorburg". Nach Falle 7 (Hälfte)
gibt es einen Cut — nur die oberen zwei Drittel nach Burgpunkten (Vorschlag) laufen die zweite
Hälfte, der Rest wird an der Stelle gewertet wie Ausgeschiedene heute (nach Strecke, dann
Punkten). Die zweite Hälfte hat dann weniger Gedränge und mehr Sterne je Falle.

**Warum.** Das ist die Struktur der Sendung (jedes Spiel scheidet aus, der Showdown ist klein)
und von Sasuke (Stages). Chris wollte „verschiedene Varianten" (06.09.); die Kurse liefern heute
nur andere Reihenfolgen. Ein Cut ist eine andere **Form**.

**rho.** Der Cut ordnet nach Punkten, nicht nach Wurf — er ist eine Rangfolge, die schon da ist,
also eher rho-neutral bis -hebend (der Rest der Gecutteten steht fest). Verlässlichkeit: die
Gecutteten haben weniger Ereignisse; nach CLAUDE.md wiegt das wenig. Bei zwei je Seite (vier
Läufer) ist ein Cut Unsinn — Kurs nur ab fünf je Seite ziehen.

**Aufwand:** mittel (ein Cut-Zustand, Streckenband/„Noch im Rennen" folgen).

### 5.5 Störenfried: ein vierter Plan, der auf den Gegner zielt (Klasse B, klein, Kann)

**Was.** Die drei Pläne regeln heute nur eigenes Risiko (`tempo`, `ab`). Ein vierter, „Störer":
`tempo:0.95`, `tackleRate ×1,6` (Vorschlag), sucht im Gedränge die Nähe zur gegnerischen Seite.
Er holt weniger Burgpunkte, kostet dem Gegner aber Zeit und Stürze. Passt zum Slot „Gate Crash"
(Will/Determination, `charger`) oder „Chaos Dodge".

**Warum.** Takeshi ist die einzige Bahn, auf der Gegner wirken dürfen — und die einzige, deren
Pläne das nicht nutzen. Teamtaktik: ein Störer, fünf Sammler.

**rho.** Rempler sind gemessen ein Kanal, der mit der Eignung korreliert (0,85/0,88), kein
Rauschen; ein Plan, der mehr rempelt, verschiebt die Dosis. Opus' Grenze „über ~20 Rempler je
Rennen kippt es" (Chaos-Plan 3.3) muss halten. Plan-Sonde: kein Plan über 60 %.

### 5.6 Show-Down als Burgsturm (TC-P3, Klasse A — Zustimmung, ein Zusatz)

Dem Opus-Vorschlag füge ich nur hinzu: Das Tor zählt die Finisher je Seite (steht schon in TC-P3)
und **der Endstand nennt den „Burgherrn"** — den Läufer mit den meisten Burgpunkten, unabhängig
vom Einlauf. Heute erzählt die Wertung zwei Geschichten (Burgpunkte, Zielbonus), der Endstand
eine. Reine Anzeige.

### 5.7 Bewusst nicht vorgeschlagen

- **Die Garde als Gegner** (Longest Yard, Sumo). Entschieden (06.09.).
- **Drei Versuche je Falle** (Warped Wall). Eine `rr()`-Kaskade — mehr Rauschen an der Stelle, die
  `fallenKoennen` gerade beruhigt hat.
- **Nervenstrafe durch Rempler.** Gemessen schädlich, entschieden.
- **Zeitlimit (TC-P2).** Nicht dagegen, aber nicht meins: Solange die Pläne ausgeglichen sind
  (35/35/30), ist das Limit ein Countdown fürs Bild. Wenn 5.2 „Vorsichtig" an zwei Fallen stärkt,
  könnte das Limit nötig werden, um es wieder auszugleichen — dann in derselben Messung.

---

## 6. „Mehrere Wege zum Erfolg" — was dieses Dokument je Disziplin ergänzt

| Disziplin | Heute (Opus 26.09.) | Opus-Vorschlag | Ergänzung hier | Währung des Nebenwegs |
|---|---|---|---|---|
| Time-Trial | Berg: ENDTEMPO + WUCHT-Anteil; Kurve, Abfahrt je ein Weg | Pacing nach Profil (TT-P1/P2), Profile (TT-P3) | Kurve: TECHNIK **oder** WUCHT (2.2); Abfahrt: fahren oder erholen (2.3); Schluss: Rahmen aus STEHEN (1.2) | **Puste** statt Zeit |
| Spurt | Station: TECHNIK → WUCHT → Sturz | Schleife statt Sturz (SP-P2) | Schleife oder Durchbruch nach Puste (3.2); Gerade als Ort für Speed (3.1); Rahmen aus STEHEN/Torment (1.2) | Puste gegen Zeit |
| Staffel | ein Weg + Wechselqualität | Wechselmarke (ST-P1), Beinprofile (ST-P2) | Eingespielte Paare (4.1, Manager-Ebene) | — |
| Takeshi | erfüllt | Wahl-Fallen mit Beobachtung (TC-P1) | Wahl-Fallen als Lesen-oder-Brettern (5.2); typisierter Durchbruch (5.3) | Puste (Wucht) gegen Versuche (Zeit) |

## 7. Priorität und Aufwand über alle vier

| Rang | Idee | Disziplin | Klasse | Aufwand | Warum zuerst |
|---:|---|---|---|---|---|
| 1 | 5.3 `fallenDurchbruch` für Pp nachmessen | Takeshi | B (Konfig) | klein | Pp 36,4 ist die einzige verletzte Abnahme der Gruppe; eine Zeile, liegt schon im Motor |
| 2 | 1.3 Alternativ-Rechner (Zeitfahren zuerst) | alle | A\* | klein–mittel | Macht jede Plan-Mechanik für Chris sichtbar; im Zeitfahren exakt |
| 3 | 1.2 Ins Rote gehen | Spurt, dann TT | B | mittel | Rettet Negativ-Split (nach TT-P1 immer noch 0 %), gibt Torment im Spurt seinen Ort |
| 4 | 2.1 Der Favorit fährt zuletzt | Time-Trial | A | klein | Hot Seat und Geisterfahrer erzählen heute die falsche Reihenfolge |
| 5 | 3.1 Drei Parcours | Spurt | B | mittel | Speed bekommt seine Gerade; Aufstellung wird je Spieltag eine Frage |
| 6 | 2.2 + 2.3 Kurven-Risiko und Abfahrt als Erholung | Time-Trial | B | mittel | Die Puste-Landschaft, die TT-P2 (Wellenfahrer) einen Grund gibt |
| 7 | 5.2 Wer liest, sieht | Takeshi | B | mittel | TC-P1 ohne Lagevorteil; nur wenn 5.3 die Pp nicht allein löst |
| 8 | 4.2 Wechselgewinn als Zahl · 4.1 Eingespielte Paare | Staffel | A · S | klein · mittel | beide erst nach ST-P1 |
| 9 | 2.4 Länge als Profil-Achse · 3.2 Schleife nach Puste | TT · Spurt | B | klein | Ergänzungen zu TT-P3 / SP-P2, mit denen zusammen messen |
| — | 3.3, 5.4, 5.5 | | B | klein–mittel | Kann; nur mit Plan-Sonde und Vorher/Nachher |

Reihenfolge-Regel wie immer im Projekt: nie zwei Eingriffe in einer Messung; jede Klasse-B-Idee
mit Prototyp, Plan-Sonde (kein Plan über 60 %, bester Plan hängt am STEHEN-Terzil), rho
kaderfest bei allen vorkommenden Kadergrößen, Pp in zwei Saatstämmen, Isolationsnachweis der
anderen vier Bahnen.

## 8. Fragen an Chris, die aus diesem Dokument neu dazukommen

Zu den fünf aus dem Opus-Review (6.2) drei weitere:

1. **Überziehen im Zielsprint (1.2):** Darf ein Läufer auf den letzten Metern über die Reserve
   gehen und leer ins Ziel kommen — und soll das auch im Zeitfahren gelten, wo die Matrix
   Torment nur mit 3 führt?
2. **Kurs-Ankündigung vor der Aufstellung (3.1, TT-P3):** Sollen Spurt-Parcours und Zeitfahr-
   Profil vor dem Spieltag sichtbar sein? Nur dann sind sie eine Aufstellungsfrage; sonst sind
   sie nur Abwechslung.
3. **Eingespielte Paare (4.1):** Soll die Staffel Kontinuität in der Aufstellung belohnen — ein
   Manager-Element, das kein anderes Spiel-Element heute hat?

## 9. Was ich nicht geprüft habe

- **Nichts gemessen.** Alle rho-/Pp-Aussagen sind Erwartungen aus dem gelesenen Material, keine
  Sonden. Wo ich „vermutlich" schreibe, meine ich es.
- `broadcast-optik-bahn-27-09.md` selbst (liegt auf einem Branch, nicht auf `main`); ich kenne
  nur die Commit-Bodies der Umsetzung. Möglich, dass 1.3 oder 4.2 dort als Prio 3 schon skizziert
  sind — dann sind sie hier eine Bestätigung, keine Erfindung.
- Ob `formTag` im Zeitfahren an `idx` oder an den Läufer gebunden ist (relevant für 2.1).
- Den aktuellen Zustand des Spurt-Sogs nach #1035 (ob `SCHATTEN_TEMPO`/`SCHATTEN_SPAREN` je Bahn
  überschreibbar wurden, wie SP-P1 vorschlug) — 3.3 hängt daran.
- Ob der Mutator-Faktor `F` (29.09.) vor oder nach `tempoVon()` ansetzt; für 1.2 ist das die Frage,
  ob der Überziehungsrahmen mitskaliert.

## Quellen

- Projektintern: `bahn-disziplinen-opus-konzeptreview-26-09.md` (Plan-Sonde, Befunde,
  TT/SP/ST/TC-Vorschläge), `bahn-disziplinen-recherche-fable.md` (Ward-Smith & Radford 2002,
  Zignoli 2021, Zarębska 2021, Sasuke-Quoten), `zeitfahren-recherche-06-09.md`,
  `spurt-offene-fragen-plus-optik-plan-05-09.md` (Paket B, Frage 5 Abnahme bei zwei je Seite),
  `staffel-offene-fragen-plus-takeshis-castle-05-09.md` (Entscheidungen, `playerCount`-Befund),
  `takeshi-chaos-tackle-plan-06-09.md`, `takeshi-hindernis-vs-strecke-recherche-13-09.md`,
  `i-spy-schatzsuche-konzept-21-09.md` (Primärweg/Nebenweg, Muster A/B),
  `stand-aller-disziplinen.md` (Pp-Tabelle 26.09.), PR #1035 (Haushalt-Runde, Plan-Dominanz
  nachher), Commits `6003b0e7`/`94aa6440`/`71d2867f` (Broadcast-Optik Bahn), `42358ca6`
  (Mutator-Konzept), `engine.js` `BAHN_ART`-Blöcke `:30887–31910`, `bahnRangliste()` `:28108`,
  Startfolge `:28223`, `fallenDurchbruch` `:31789`/`:33849`.
- Sport: Swain 1997, Atkinson et al. 2007 (Leistungsvariation bergauf/bergab, aus dem
  Opus-Review); Zignoli 2021 (Kurve: Leistung null); Zarębska 2021 (Staffel-DNF 21 %, Teammaß
  Einzelbestzeiten minus Staffelzeit); Spartan-Regelwerk 2023 (Strafschleife); Keshi Heads
  (Knock Knock, Skipping Stones, Ultimate Showdown) — alle über die Vorgängerdokumente, nicht neu
  abgerufen.
