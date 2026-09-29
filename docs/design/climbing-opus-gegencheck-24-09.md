# Climbing — Opus-Gegencheck: Wie echtes Wettkampfklettern? (24.09.)

**Anlass.** Chris hat die offenen Fragen des Fable-Konzepts vom 22.09.
(`docs/design/climbing-neukonzept-22-09.md`, Abschnitt 8) delegiert. Wörtlich: „Entscheidung kann
Opus machen für climbing, Hauptsache es ist wie echtes klettern“. Dieses Papier entscheidet alle
elf Fragen. Maßstab ist der Realismus im Wettkampfklettern, innerhalb der festen Leitplanken aus
`CLAUDE.md`:

- Die Matrix bleibt gesperrt.
- rho über 0,80 in **einem** Spiel.
- Pp-Abweichung höchstens 25.
- Kein Attribut außerhalb der Matrix.
- Kein Zug wird durch fremde Hand vernichtet.

Es prüft außerdem die **Empfehlungen** des Konzepts selbst, nicht nur die Fragen. An sechs Stellen
widerspricht es ihnen oder korrigiert sie, zwei davon mit Messung.

**Stand.** `origin/main` = `68ad8c48`. Seit dem Konzept sind zwei Climbing-Commits gemergt: der
Fortschrittsbalken (`81d950f4`, der Rebase-Hinweis in Konzept 0.5/PR 1 ist damit erledigt) und die
Ticker-Zeitskala (`7d84baaf`, reine Anzeige). Die Basislinie ist unverändert: kaderfest **0,834**
(Spannweite 0,209), Saison 0,860 (`data/generated/rangtreue-basislinie.json:47-54`), hier
reproduziert. Die Messungen liefen in einem eigenen Worktree über die Fünfer-Familie aus
`data/generated/kaderfamilie-live-save.json`, mit temporären Diagnosefeldern und einem
Zeitlimit-Haken in `engine.js`. **Nichts davon ist committet**, dieses Dokument ist die einzige
Datei, die bleibt. Den Mess-Patch beschreibt Abschnitt 2.4. `engine.js` meint
`public/mockups/battle-mode.engine.js`.

---

## 0. Fazit vorweg

| # | Frage | Entscheidung | Kern der Begründung |
|---|---|---|---|
| 1 | Störgriff G-1 zusätzlich zu Gegnerdruck G-2? | **G-2 ja, G-1 nein, auch nicht als Schalter.** G-2 wird zum **Duelldruck** gegen einen festen Gegner auf der gespiegelten Nachbarroute. | Im echten Klettern gibt es **keinen** Kontakt. IFSC §5.2 A verbietet ausdrücklich, in die Versuche anderer einzugreifen. Selbst die echten Formate mit zwei Kletterern nebeneinander (Speed, Rock-Master-Duell, Psicobloc) haben getrennte, identische Routen. Druck durch den Gegner neben einem ist dagegen real und in der Angstforschung am Klettern belegt. |
| 2 | Falls G-1: nur Balance oder direkt zur Zone werfen? | **Entfällt mit Frage 1.** Kommt G-1 doch (Chris' Veto, Abschnitt 6), dann **nur Balance**. Das ist keine Wahl, sondern die Projektregel. | Ein Sturz durch fremde Hand vernichtet einen Zug. Gemessener Beleg: Takeshis `tackleNerven`, Saison 0,937 → 0,902. |
| 3 | Abrutschen: zurück zur Zone (A-2) oder Hängenbleiben (A-1)? | **A-2, „ins Seil bis zur letzten Exe“**, mit drei Änderungen: **die Höchstmarke zählt** (IFSC §9.1), nach dem Sturz gilt Balance = min(Balance; 0,6) statt einer Rückstellung auf 0,6, und im Seil hängen ist keine Rast. A-1 bleibt nur als gemessener Rückfall. | A-2 ist die Seilphysik: man fällt etwa doppelt so weit, wie man über der letzten Exe war. Die mittlere Fallhöhe von A-2 (≈ 13 % der Wand) liegt im echten Bereich. Das „sich fangen“ aus A-1 gibt es schon als Nebenweg (Kraftzug/Umsetzen), IFSC-Fußnote 16 trennt genau diese beiden Fälle. |
| 4 | Wertung: Rang (W-a) oder IFSC-Punkte 25/10/−0,1 (W-b)? | **W-a, als echte Lead-Wertung:** Tops nach Kletterzeit, darunter nach **Höchstmarke**. **Kein W-b.** Anzeige in Lead-Notation („TOP 4:51“, „Griff 7+“). | 25/10/−0,1 ist die **Boulder**-Wertung. Auf einer Lead-Wand wäre sie ein Format-Mischmasch. Die Lead-Regel lautet „letzter kontrollierter Griff, Top mit Zeit“ (§9.1, §9.3), und das ist W-a. **Befund:** `wert()` ordnet Nicht-Angekommene heute gar nicht nach Höhe (2.3), das muss PR 2 nachziehen. |
| 5 | Zeitlimit oder keins? | **Ja, Zeitlimit, aber nicht 1,6 × Siegerzeit.** Es wird auf eine **Top-out-Quote von 40–55 %** geeicht, auf der heutigen Mechanik sind das ≈ 1,2 × Median-Siegerzeit. Angezeigt als Lead-Countdown. | **Gemessen:** Bei 1,6 × kämen heute **99,4 %** oben an. Dann entscheidet die Uhr, und das ist Speed, genau das Bild, das Chris nicht will. Bei 1,2 × toppen 44 %, und rho sinkt nur um 0,004 (0,834 → 0,830). |
| 6 | Lead- oder Boulder-Bild? | **Lead.** Seil, Sicherer am Wandfuß, Exen an den drei Henkeln. Im Spiel heißt es **„Exe“ statt „Zone“**. | „Zone“ ist ein Boulder-Wort. Ein Boulder-Sturz fällt bis 0, und das kostet genau die Verlässlichkeit, die der Deckel von A-2 schützt. Zwölf Kletterer mit zehn Griffen und Höhenwertung sind eine Lead-Wand, kein 4,5-m-Block. |
| 7 | Wie viele Griffarten? | **Fünf**, aber „Tritt/Volumen“ wird zu **„Sloper/Volumen“ (Aufleger)**. Sub-Skill und Verteilung bleiben (2/2/3/2/1). | Füße gehören zu jedem Zug und sind keine Griffart. Sloper sind die echte vierte Grundform neben Henkel, Leiste und Zange. Das Konzept spricht selbst vom „Sloper-Spezialisten“, führt aber keinen Sloper. |
| 8 | Drei Routen-Layouts? | **Ja**, aber **ein Layout je Spiel, für alle zwölf Routen gleich**. „Kante“ wird zu **„Dach“**, die Crux liegt in der oberen Hälfte. Die Layouts werden **in PR 2 gemessen**, nicht erst in PR 4. | Im Wettkampf klettern alle dieselbe Route, in Duellformaten auf identischen Parallelrouten. Eine neue Route je Spiel entspricht dem Onsight- bzw. Flash-Prinzip. Die Griffreihenfolge ändert Ergebnisse, also ist sie nicht rho-frei. |
| 9 | Produktivierung mitten in der Saison oder zum Saisonwechsel? *(Ops, kein Realismus-Kriterium)* | **Nicht auf den Saisonwechsel warten.** PR 1 sofort. **PR 2 und PR 5 im selben Deploy-Fenster** zwischen zwei Spieltagen. | Die Matrix und die Wertungsskala (N−i Rangpunkte) bleiben gleich, die Spielerwerte bleiben also gültig. Das einzige echte Ops-Risiko ist ein Fenster, in dem die neue Mechanik gegen die alte PPS-Referenz rechnet. |
| 10 | Reihenfolge im Projekt? *(Ops)* | **PR 0 und PR 1 jetzt.** PR 2 erst nach der laufenden I-Spy-Runde. Disziplinen **unter** der Schranke haben Vorrang vor Climbing. | Climbing besteht (0,834). PR 1 beantwortet Chris' „das ist ja n hindernislauf“ ohne Messrisiko. |
| 11 | Rasten als Plan-Entscheidung? | **Ja**, aber als **Pump-Schwelle je Plan** („rastet, wenn die Puste unter X fällt“) statt fester Booleans. Die Rennplan-Ansage „jetzt rasten / durchziehen“ ist der Zuruf des Coachs. Alles gehört in **PR 2**, nicht in PR 4. | Wo man ausschüttelt, ist **die** taktische Entscheidung im Lead (IFSC-Fußnote 22 definiert „shaking out“ sogar). In Flash-Runden darf der Coach laut IFSC §5.5 B während des Versuchs reden. Eine Rastregel ändert Ergebnisse und ist deshalb nicht rho-frei. |

### Das Kernbild in einem Satz

**Eine Lead-Route im Duell-Aufbau.** Heim und Gast klettern paarweise auf gespiegelten, identischen
Routen nebeneinander, so wie beim Rock-Master-Lead-Duell in Arco oder bei Psicobloc. Jeder hängt am
Seil und klinkt an drei Henkeln eine Exe. Wer stürzt, fällt ins Seil bis zur letzten Exe und
klettert nach. Es zählt der höchste kontrollierte Griff, bei Tops die Kletterzeit. Eine
Lead-Countdown-Uhr läuft mit. Der Gegner kann einen **nur über den Kopf** aus dem Gleichgewicht
bringen, indem er vorbeizieht, nie mit der Hand.

### Wo dieses Papier dem Konzept widerspricht oder es korrigiert

1. **G-1 kommt nicht als „gemessener Schalter“ in den Motor, sondern gar nicht** (3.1). Er ist das
   eine Element, das die Wand zurück zu Takeshi schiebt, also zum Hindernislauf mit Gerangel, über
   den Chris sich beschwert hat.
2. **Die Uhr darf nicht entscheiden.** Das Konzept will 60–80 % Top-out und 1,6 × Siegerzeit, und
   damit bliebe Climbing ein Rennen. Gemessen: 99,4 % Top-out (2.1). Neuer Korridor 40–55 %.
3. **`wert()` ist für W-a nicht „unverändert“ verwendbar** (Konzept 2.5). Heute setzt sie alle
   Nicht-Angekommenen gleich auf `99`. Mit Zeitlimit würde die Messung dann die Bahnreihenfolge
   messen statt der Höhe. Gemessen: 0,686 statt 0,830 bei demselben Limit (2.3).
4. **Die Höchstmarke zählt, nicht die aktuelle Position** (IFSC §9.1). Das ist realistischer und
   dämpft zugleich genau das Verlässlichkeitsrisiko, das das Konzept an A-2 selbst benennt (3.3).
5. **Der Pump ist die Hauptursache für Stürze** und gehört direkt in die Sturzchance. Das geht über
   `pusteHindernis`, ein Feld, das im Motor schon existiert. Bei Climbing ist es heute ungesetzt
   (`engine.js:28625-28634`). So trägt auch stamina (Matrix 26, das schwerste Gewicht) den Sturz,
   nicht nur Balance (3.3).
6. **Rasten und Layouts sind nicht rho-frei** und müssen aus PR 4 in die gemessene PR 2 wandern (5.).

Dazu zwei **Faktenkorrekturen** am Konzept:

- **Plus nach Sturz.** Konzept 1.1 sagt „kein ‚+‘ bei Sturz“. Nach den IFSC-Regeln 2025 ist es
  umgekehrt: Das „+“ gibt es genau für die Vorwärtsbewegung, aus der man stürzt (§9.1). Entfallen
  kann es nur bei einem Regelverstoß nach §8.2 (Exe falsch geklinkt oder ausgehängt, Last Safe
  Position überschritten).
- **Kein belegtes Chris-Zitat.** Die Formel „Neustart eines Abschnitts“ steht im Konzept als
  Chris' Wortlaut, ist im Repo aber nirgends als Chris-Zitat belegt. Belegt ist nur „man abrutschen
  kann“. An der Entscheidung ändert das nichts, A-2 folgt hier aus der Seilphysik (1.3).

---

## 1. Recherche: Wie echtes Wettkampfklettern abläuft

Primärquelle sind die **IFSC Competition Rules, Version 1.0, Januar 2025** (PDF, Link unten). Ich
habe sie im Volltext gelesen, nicht nur Zusammenfassungen. Die Paragraphen sind unten zitiert.

### 1.1 Lead nach IFSC-Regeln 2025

| Regel | Wortlaut / Inhalt | Was es für uns heißt |
|---|---|---|
| §6.1 | „A climber may make a single scoring attempt on a route“ | Echtes Lead hat **einen** Versuch. Wir weichen bewusst davon ab (1.3). |
| §6.3 | Kletterzeit laut Wettkampfordnung, „should not exceed 6 minutes“ | Ein Zeitlimit ist echt, eine Uhr ohne Limit nicht. |
| §8.1 | Der Versuch endet, wenn die Zeit abläuft oder der Kletterer stürzt, den Boden berührt, Griffe oder Flächen außerhalb der Route benutzt (D) … | Wer die Griffe einer **anderen** Route benutzt, ist raus. Geteilte „Kreuzungsgriffe“ (G-1) gibt es nicht. |
| §9.1 | Ergebnis = „last scoring hold Controlled“, mit „+“ für eine Vorwärtsbewegung | **Die Höchstmarke zählt**, nicht der Punkt, an dem man nach einem Sturz hängt. |
| §9.2 | kein „+“ nur bei Abbruch nach §8.2 | Korrektur am Konzept (s. oben). |
| §9.3 | Top, „and, when required …, the climbing time“ | Tops werden nach Zeit getrennt (bei Gleichstand laut gearjunkie zuerst über die Zeit, dann Countback). Das ist W-a. |
| §5.2 A | Wettkämpfer dürfen nicht „interfere in the preparation or attempts of other competitors“ | **Eingreifen ist ausdrücklich verboten.** |
| Technical Incident (E) | jede ungewöhnliche Lage, die einen Kletterer „in a situation different from their peers“ bringt | Wird ein Kletterer von außen gestört, bekommt er im echten Sport einen **neuen Versuch**. Die Störung wird annulliert, nicht gewertet. |
| §5.4 A / Fn. 12 | gemeinsame Besichtigung vor Onsight-Runden, Notizen und Skizzen erlaubt | Die Route liest man **vorher**. Dort entsteht der Rastplan (Frage 11). |
| §5.5 B | in **Flash**-Runden dürfen Betreuer „communicate … before, during and after their attempts“ | Ein Zuruf von unten während des Versuchs ist regelkonform, sobald die Route vorher gezeigt wurde. |
| Fn. 16 (Speed) | Sturz = „not able to recover by grabbing another hold or re-gaining their footing“ | Echter Unterschied zwischen **sich fangen** (A-1-Phänomen) und **stürzen** (A-2). |
| Fn. 22 | „shaking out: e.g. relaxing one arm while maintaining balance to manage fatigue“ | Rasten heißt Pump abbauen **und** dabei die Balance halten. Das ist genau die Kopplung, die Konzept 2.4 an der Zone baut. |

### 1.2 Wo echte Kletterer gleichzeitig nebeneinander klettern

Das Chassis verlangt, dass zwölf Kletterer gleichzeitig an einer Wand sind. Das gibt es im echten
Sport nur in einer Form: als **Duell auf identischen Parallelrouten**.

- **Speed:** zwei genormte Bahnen nebeneinander, K.-o.-Duelle, getrennte Bahnen.
- **Rock Master Arco, „Lead Duel“:** „Two athletes compete on two identical and parallel routes“,
  25 m Überhang, etwas über eine Minute. Die meisten Duelle entscheiden sich im steilsten Teil.
- **Psicobloc Masters** (Deep-Water-Solo, Park City 2011–2018): Kopf-an-Kopf auf identischen
  überhängenden Routen. Wer zuerst oben ist oder höher kommt, kommt weiter.

In **keinem** dieser Formate gibt es Kontakt, und in keinem teilen sich die Routen Griffe. Die
Wechselwirkung zwischen den beiden läuft über das Sehen und den Kopf: Man sieht den anderen
vorbeiziehen.

### 1.3 Warum Kletterer stürzen, und was „aus dem Gleichgewicht“ real bedeutet

- **Pump (Unterarm-Ermüdung) ist die Hauptursache für Stürze im Lead.** Die Beugemuskeln im
  Unterarm schließen nicht mehr, die Hand öffnet sich an Griffen, die vorher sicher waren (The
  Climbing Doctor, s. Quellen). Im Motor ist das `u.reserve`. Es fehlt heute nur die Kopplung an
  die Sturzchance.
- **Angst und Druck verändern die Bewegung messbar.** Pijpers, Oudejans und Bakker (2005) haben
  Kletterer an derselben Wand in hoher und niedriger Angst verglichen. Unter Angst stiegen die
  Kletterzeit und die Zahl der **tastenden Bewegungen**, die Griffe wurden **länger gehalten**, die
  Bewegungen waren langsamer. Dazu kamen höhere Muskelaktivierung, stärkere Ermüdung und mehr
  Laktat. „Aus dem Gleichgewicht gebracht werden“ ist im echten Klettern also ein Zustand des
  **Kopfes**, der sich über Zögern und schnelleren Pump in Fehlgriffe und Stürze übersetzt. Genau
  das modelliert G-2 mit Balance als Kopf-Ressource.
- **Die Seilphysik:** Ein Lead-Kletterer fällt mindestens doppelt so weit, wie er über der letzten
  Sicherung war (Wikipedia „Lead climbing“: 3 m darüber heißt 6 m Fall). Danach hängt er **unter**
  der Exe. Beim Rotpunkt- oder „Hangdog“-Klettern außerhalb des Wettkampfs klettert er von dort
  wieder hoch. Das ist A-2 wörtlich.
- **Die Größenordnung passt.** Zonen bei 0,26/0,53/0,80 und ein Sturz irgendwo im Abschnitt ergeben
  einen mittleren Höhenverlust von ≈ 0,13 der Wand. Auf 15 m sind das ≈ 2 m. Bei ≈ 1–1,5 m Abstand
  zwischen den Exen und dem Faktor 2 liegt ein echter Lead-Sturz bei 2–4 m. A-2 fällt also nicht zu
  weit.

### 1.4 Wertung im echten Lead

- **Weltcup-Lead:** Es zählt die Höhe, also der Griff mit „+“. Tops werden gleichgestellt und über
  die Zeit, dann über Countback getrennt (§9.1/9.3, gearjunkie).
- **Olympia Paris 2024, Boulder & Lead:** 100 Lead-Punkte je Kletterer. Die obersten 10 Griffe
  bringen je 4 Punkte, die nächsten 10 je 3, dann 2, dann 1, und ein „+“ bringt 0,1. Die Punkte
  steigen also **monoton mit der Höhe**. Sie geben dieselbe Reihenfolge wie „Höhe, darunter
  nichts“, das ist eine Anzeigeform und keine andere Wertung.
- **Boulder 2025:** Top 25, Zone 10, −0,1 je Fehlversuch (die Konzept-Quellen, hier nicht erneut
  geprüft). Das ist eine **Boulder**-Wertung für vier kurze Probleme mit vielen Versuchen.

---

## 2. Messungen

Alle Messungen: kaderfest, 24 Spiele je Paarung, fünf Paarungen (120 Rennen), Saatstamm 1337,
Motor `origin/main` `68ad8c48`.

### 2.1 Wie weit die Zielzeiten heute auseinanderliegen

| Größe | Wert |
|---|---:|
| Median-Siegerzeit | 10,08 Sim-s (Spanne 8,50–11,02) |
| Zeit ÷ Siegerzeit, alle Nicht-Sieger, Median | 1,247 |
| … 90-%-Punkt | 1,441 |
| Langsamster ÷ Sieger je Rennen, Median / Maximum | 1,449 / 1,675 |
| Stolperer je Kopf / Kraftzüge je Kopf | 1,32 / 2,88 |

Top-out-Quote bei einem **festen** Limit von k × Median-Siegerzeit (so ist das Limit im Konzept
definiert):

| k | 1,10 | 1,15 | 1,20 | 1,25 | 1,30 | 1,40 | **1,60 (Konzept)** |
|---|---:|---:|---:|---:|---:|---:|---:|
| Top-out | 19,2 % | 30,1 % | **44,0 %** | 57,8 % | 70,7 % | 88,2 % | **99,4 %** |

**Das Konzeptlimit wäre heute wirkungslos.** Mit A-2 werden die Zeiten zwar breiter, aber ein Faktor
1,6 ließe weiterhin die große Mehrheit toppen. Dann entscheidet die Uhr, und Climbing bleibt Speed.

### 2.2 Zeitlimit mit Höhenwertung, auf der heutigen Mechanik

`wert()` ordnet dabei Angekommene nach Zeit und darunter nach Höhe, so wie `bahnRangliste()`, s. 2.3:

| Limit | rho je Spiel | Spannweite | rho Saison | Top-out |
|---|---:|---:|---:|---:|
| ohne (heute) | **0,834** | 0,209 | 0,860 | 100 % |
| 1,6 × | 0,834 | 0,209 | 0,860 | 99,4 % |
| 1,3 × | 0,833 | 0,209 | 0,860 | 70,7 % |
| **1,2 ×** | **0,830** | 0,210 | 0,846 | **44,0 %** |
| 1,15 × | 0,822 | 0,211 | 0,839 | 30,1 % |
| 1,1 × | 0,807 | 0,217 | 0,825 | 19,2 % |

**Wie teuer das Lead-Bild ist:** Bei 1,2 × kostet es **0,004**, weit innerhalb der Spannweite von
0,209, also Rauschen. Erst unter ≈ 30 % Top-out wird es teuer. Deshalb der Korridor **40–55 %**:
Die Besten toppen, der Rest wird nach Höhe geordnet. Das ist das Bild eines Lead-Halbfinales, nicht
eines Speed-Laufs. Wie viele toppen, bleibt dabei zweitrangig. Nach PR 2 wird das Limit am Korridor
neu geeicht, nicht am Faktor.

### 2.3 Befund: `wert()` misst unter einem Zeitlimit die Bahnreihenfolge

Die Bahn-`wert()` (`MOTOREN[bd].wert`, letzter Zweig) sortiert
`(bahnZeit(a)??99)-(bahnZeit(b)??99)`. Alle Nicht-Angekommenen bekommen dieselbe `99`. Die stabile
Sortierung lässt sie dann in `LAEUFER`-Reihenfolge stehen, also nach Bahn. Heute fällt das nicht
auf, weil ohne Limit alle ankommen. **Mit** Limit und unveränderter `wert()`:

| Limit | rho je Spiel mit heutiger `wert()` | mit höhenbewusster `wert()` |
|---|---:|---:|
| 1,3 × | 0,767 | 0,833 |
| 1,2 × | **0,686** | **0,830** |
| 1,1 × | 0,564 | 0,807 |

`bahnRangliste()` (die Wertung im Spiel) ordnet schon nach `pos`. Nur die Messfunktion tut es
nicht. Konzept 2.5 („`wert()` und `disziplinProbe()` unverändert“) stimmt deshalb nicht. PR 2
**muss** `wert()` für Climbing auf dieselbe Ordnung wie `bahnRangliste()` bringen: Zeit, darunter
Höchstmarke, nur für Climbing und hinter einem Feld, damit die Geschwister bit-identisch bleiben.
Sonst liefert die Kalibrierrunde ein falsches Ergebnis, das nach Mechanikschaden aussieht und keiner
ist.

### 2.4 Wie gemessen wurde (nicht committet)

Im Worktree drei temporäre Änderungen an `engine.js`, danach per `git checkout` zurückgesetzt:

1. `disziplinProbe()` gibt bei der Bahn zusätzlich `fertig`, `pos`, `gestolpert`, `durchbruch`,
   `plan` und die Restreserve aus.
2. `MOTOREN[bd].lauf` stoppt bei `window.__zl[bd]` Sim-Sekunden statt bei 90.
3. `wert()` hat als Tie-Break `b.pos-a.pos`.

Die Treiber waren zwei kurze Playwright-Skripte nach dem Muster von `miss-alle-disziplinen.mjs`, die
`disziplinMessen()` und `disziplinProbe()` aus `scripts/lib/rangtreue-messung.mjs` benutzen. Die
Referenzzeile „ohne Limit“ reproduziert die Basislinie 0,834 / 0,209 / 0,860 ziffernidentisch.
PR 0 sollte daraus die `wandProbe()` machen, die das Konzept ohnehin vorsieht.

---

## 3. Die elf Fragen im Einzelnen

### 3.1 Frage 1: Störgriff G-1 zusätzlich zu G-2?

**Entscheidung: G-2 ja, als Duelldruck. G-1 nein, auch nicht als Schalter im Motor.**

**Warum G-1 nicht, bei Realismus als Hauptkriterium:**

1. **Kontakt gibt es im echten Klettern nicht.** Nicht im Lead, nicht im Boulder, nicht im Speed,
   und auch in den echten Duellformaten nicht (1.2). Die IFSC verbietet das Eingreifen ausdrücklich
   (§5.2 A). Wird jemand trotzdem gestört, bekommt er einen neuen Versuch (Technical Incident E). Der
   echte Sport annulliert eine Störung, statt sie zu werten.
2. **Geteilte Griffe widersprechen dem Aufbau einer Route.** Nach §8.1 D endet der Versuch, sobald
   man Griffe außerhalb der eigenen Route benutzt. Ein Griff „zwischen zwei Routen“, den beide
   benutzen, ist deshalb kein Kletterbild. Er ist Takeshis Castle an einer Wand.
3. **Genau das ist Chris' Beschwerde.** „Das ist ja n Hindernislauf“ heißt: Climbing sieht aus wie
   eine Bahn mit Hindernissen. Takeshi ist im selben Chassis die Disziplin mit Rempler, Gedränge und
   Kontakt. G-1 würde Climbing mechanisch wieder an Takeshi annähern, also genau weg von „echtem
   Klettern“.
4. **Er ist der teuerste Kanal für die Pp-Abnahme.** power (Matrix 8) säße dann in ANTRITT, TECHNIK,
   WUCHT, im Kraftzug-Nebenweg **und** im Störgriff (Konzept 6.5). Ohne G-1 fällt ein ganzes
   power-Risiko weg.

**Warum auch nicht als „gemessener Schalter“:** Takeshis Muster, gemessen Schädliches mit
„BEWUSST NICHT GESETZT“ im Motor zu lassen, ist richtig für Mechaniken, die zur Disziplin gehören.
G-1 gehört laut Recherche nicht zum Klettern. Er müsste auch für den Schalter erst gebaut, bebildert
und betextet werden (Boxscore-Spalten, Ticker, Wechselbelegung). Das ist ein Tag Arbeit für ein
Element, das ausgeschaltet bleiben soll. Der Rempler-Block bleibt ohnehin bei Takeshi im Motor.
Wollte Chris ihn später doch, ist er dort mit Konfiguration abrufbar.

**Was stattdessen Chris' „versuchen kann, andere aus dem Gleichgewicht zu bringen“ erfüllt:**
**Vorbeiziehen.** Im Duell setzt man den Gegner unter Druck, indem man schneller klettert als er. Das
ist Rock-Master- und Speed-Taktik. Der Plan „Angriff“ **ist** dieser Versuch: Er kostet eigenen
Pump (das tut er heute schon) und löst beim Gegner Druck aus, sobald man vor ihm ist. Neuer Code
dafür ist nicht nötig, nur die Erzählung:

- Ticker: „Draco zieht an Cassandra vorbei — sie wird unsicher.“
- Schweber beim Opfer: „wackelt“.

**G-2 präzisiert: Duelldruck statt „bester Nachbar“.**

- **Bahnbelegung:** abwechselnd H G H G (`wechselseitig`, wie im Konzept). Die Paare sind feste
  Duelle: Route 1/2, 3/4 usw., jeweils **Heim-Slot i gegen Gast-Slot i**, auf gespiegelten
  identischen Routen. So klettern auch Rock Master und Psicobloc. Die Aufstellung bekommt damit eine
  Bedeutung wie ein Brett im Mannschaftsschach.
- **Druckquelle** ist der **eigene Duellpartner**, nicht der bessere von zwei Nachbarn.
  Formel, Dämpfung durch GLEICHGEWICHT und `druckMax` wie Konzept 3.3.
- **Mess-Entscheidungsregel für PR 2:** Duell gegen `druckQuelle:"feld"`, kaderfest.
  - Liegt „Duell“ im Median innerhalb der halben Spannweite von „Feld“ und ist seine Spannweite
    nicht größer als 0,25, wird **Duell** gesetzt (realistischer).
  - Sonst wird **Feld** gesetzt. Das Bild entspricht dann dem Lead-Finale, in dem die Anzeigetafel
    und das Publikum Druck machen.
  - Beide Fassungen halten die Regel ein: kein `rr()`, kein Schreiben in fremde Felder.

**Regelcheck:** G-2 schreibt nur in `u.balance` des Betroffenen selbst, gedämpft durch dessen
eigenes Attribut. Der Sturz fällt aus dessen eigenem Wurf. Kein Zug wird durch fremde Hand
vernichtet.

### 3.2 Frage 2: Falls G-1, nur Balance oder direkt zur Zone?

**Entfällt.** Wenn Chris G-1 trotzdem will (Abschnitt 6), dann **nur Balance**. Das ist keine
Designfrage: Ein Störgriff, der direkt stürzen lässt, vernichtet einen Zug durch fremde Hand. Das
verbietet die Projektregel, und bei Takeshi ist es gemessen schädlich (`tackleNerven`, Saison
0,937 → 0,902).

### 3.3 Frage 3: Abrutschen, A-2 oder A-1?

**Entscheidung: A-2 „ins Seil bis zur letzten Exe“, mit drei Änderungen am Konzept.**

Warum A-2 realistisch ist, steht in 1.3: A-2 **ist** die Seilphysik, und die mittlere Fallhöhe
passt. A-1 („rutscht ab, fängt sich“) ist ebenfalls ein echtes Phänomen, aber kein Sturz, sondern
das Sich-Fangen aus IFSC-Fußnote 16. Das Konzept hat dafür schon zwei Wege, Kraftzug und Umsetzen.
Beide sind Kosten ohne Höhenverlust. Als drittes Modell wäre A-1 doppelt. Es bleibt nur das, was
das Konzept in 6.4 Schritt 6 ohnehin vorsieht: der gemessene Rückfall, falls A-2 die Schranke
reißt.

**Änderung 1: Die Höchstmarke zählt (IFSC §9.1).** Die Wertung liest `u.hoch = max(u.hoch, u.pos)`
statt `u.pos`.

- **Realistisch:** Im Lead zählt der höchste kontrollierte Griff, nicht wo man nach dem Sturz hängt.
- **Weniger Rauschen:** Wer 2 s vor Ablauf des Limits bei 0,78 stürzt, verliert nicht einen ganzen
  Abschnitt Wertung. Er verliert nur die Chance, noch höher zu kommen. Damit sinkt genau das
  Verlässlichkeitsrisiko, das Konzept 2.3 und 6.2 als „weichsten Punkt“ benennen.
- **Die Regel „kein Zug vernichtet“** gilt damit sogar für den eigenen Sturz: Einmal erreichte Höhe
  nimmt nichts mehr weg.
- **Der Sturz bleibt teuer.** Er kostet Fallzeit, das Nachklettern des Abschnitts und die Puste
  dafür.
- **Technisch:** ein Feld je Läufer. `bahnRangliste()` und `wert()` lesen hinter einem
  Climbing-Feld `u.hoch`, die Geschwister bleiben bit-identisch.

**Änderung 2: Nach dem Sturz gilt Balance = min(Balance; 0,6), und im Seil hängen ist keine Rast.**

- **Konzeptfassung:** Balance „auf 0,6 (an der Zone rastet er kurz)“. Für einen Kletterer mit
  Balance 0,3 **hebt** der Sturz die Balance. Das belohnt Stürze, und die treffen im Mittel die
  Schwächeren.
- **Realität:** Nach einem Sturz klettert man **zögerlicher**, das ist Sturzangst (Pijpers 2005,
  1.3). Deshalb wird die Balance auf höchstens 0,6 gedeckelt, nicht auf 0,6 gehoben.
- **Rast:** Das Hängen im Seil lädt keine Puste. Im Wettkampf ist der Versuch nach einem Sturz
  vorbei, eine Pause im Seil gibt es dort nicht. Wir lassen weiterklettern, aber ohne Geschenk.

**Änderung 3: Der Pump fließt direkt in die Sturzchance, über `pusteHindernis`.**

- **Heute:** Das Feld existiert im Motor (`engine.js:28625-28634`, Takeshi): `pusteAbzug =
  empf·(stufe/3)·(1−reserve/reserveMax)`. Es verschiebt nur Schwellen, nie die Zahl der Würfe.
  Laut Kommentar bekommt Climbing es „nie“, weil kein `hindernisTypen` gesetzt ist. Mit den
  Griffarten aus Konzept 2.1 greift es.
- **Realismus:** Pump ist **die** Sturzursache im Lead (1.3). Im Konzept wirkt der Pump auf den
  Sturz nur über den Umweg „Puste leer → Balance −0,03/s“, also erst bei leerer Reserve.
- **Pp:** stamina (Matrix 26) trägt dann auch den Sturz, nicht nur das Tempo. Die Stellschraube
  ist `empf` je Griffart: Zange und Sloper hoch, Henkel null.
- **Balance** bleibt dann das, was sie im echten Klettern ist: der **Kopf** (GLEICHGEWICHT =
  det/will/aw). Den Unterarm trägt der Pump.

Der Deckel „höchstens ein Abschnitt“ und die ROBUST-Dämpfung der Sturzkosten bleiben wie im
Konzept. Beides ist gut begründet.

### 3.4 Frage 4: Wertung W-a oder W-b?

**Entscheidung: W-a als echte Lead-Wertung. Kein W-b, auch nicht als spätere Option.**

- **W-a ist die IFSC-Lead-Regel.** Tops werden nach Kletterzeit getrennt (§9.3), alle anderen nach
  Höhe (§9.1), mit der Höchstmarke aus 3.3. Die Team-Rangpunkte (N−i, Summe) bleiben. Punkte nach
  Platzierung sind auch das Prinzip der Weltcup-Gesamtwertung.
- **W-b gehört zu einer anderen Disziplin.** 25/10/−0,1 wertet vier Boulder mit beliebig vielen
  Versuchen. An einer Lead-Wand mit einem Durchgang wäre „Zone 10“ ein Fremdkörper, und „−0,1 je
  Abrutscher“ zählt etwas, das es im Lead nicht gibt (dort beendet der Sturz den Versuch). Dazu
  kämen eine eigene `wert()`-Formel, eine eigene PPS-Referenz und eine eigene Messung, und das nur,
  um **weniger** echt zu werden.
- **Die Anzeige wird Lead-Notation.**
  - Boxscore-Spalte „Höhe“: „TOP 4:51“ für Tops, „Griff 7+“ darunter. Das „+“ steht, wenn der
    Kletterer über Griff 7 hinaus in einen Zug gegangen ist, also `u.hoch` > Griff 7.
  - Olympische Lead-Punkte (1–4 je Griff, +0,1) sind möglich, aber **nicht empfohlen**: Sie ordnen
    identisch zur Höhe und wären eine zweite Zahl für dieselbe Sache.
- **`wert()` nachziehen** (2.3), sonst ist die Kalibrierung falsch.

### 3.5 Frage 5: Zeitlimit?

**Entscheidung: Ja. Geeicht auf 40–55 % Top-out, auf der heutigen Mechanik ≈ 1,2 × Median-Siegerzeit
der Nulllinie. Nicht 1,6 ×.**

- **Realismus:** Ein Lead ohne Zeitlimit gibt es nicht (§6.3). Und im Lead entscheidet die **Höhe**.
  Die Zeit trennt nur Tops. Bei 99 % Top-out (Konzeptlimit, gemessen) wäre das umgekehrt.
- **rho:** Gemessen kostet 1,2 × auf der heutigen Mechanik 0,004 (2.2). Weil A-2 die Zeiten
  spreizt, liegt die Quote nach PR 2 bei gleichem Faktor niedriger. Deshalb wird am **Korridor**
  geeicht, nicht am Faktor. Fällt die Quote unter 30 %, wird es teuer (1,1 × = 0,807). Das ist die
  Untergrenze.
- **Darstellung:**
  - Eine Countdown-Uhr im HUD, wie beim Lead. Beim Ablauf ein Signal („Zeit!“) und der Ton
    `zeitlimit` aus Konzept 5.5.
  - Ob die Uhr wörtlich 6:00 zeigt, ist eine Frage der Zuschauzeit (`ZEIT_DEHNUNG.climbing`).
    Die Mechanik betrifft das nicht, das ist Chris' Geschmack.

### 3.6 Frage 6: Lead- oder Boulder-Bild?

**Entscheidung: Lead**, wie das Konzept, mit mehr Konsequenz im Bild:

- Seil und **Sicherer am Wandfuß**, je Route einer, als Primitive. Das Seil läuft vom Sicherer durch
  die bereits geklinkten Exen zum Kletterer. Eine geklinkte Exe wechselt die Farbe. So sieht man die
  Höhe am Seil, und der Sturz „ins Seil“ erzählt sich von selbst.
- **Das Wort „Zone“ verschwindet aus dem Spiel:** Ticker, HUD und Boxscore sagen „Exe“ bzw.
  „Henkel“. „Zone“ ist Boulder-Vokabular. Intern darf das Feld `zonen` heißen.
- Der Boulder fällt aus drei Gründen weg:
  - Der Sturz ginge bis 0, also genau das, was A-2 mit Deckel verhindert.
  - Ein 4,5-m-Block trägt weder zehn Griffe noch eine Höhenwertung.
  - Boulder-Wettkämpfe sind vier kurze Probleme nacheinander, keine gemeinsame Wand.

### 3.7 Frage 7: Wie viele Griffarten?

**Entscheidung: fünf.** Eine davon wird umbenannt, an Mechanik und Verteilung ändert sich nichts:

| Griffart | Sub-Skill | Anzahl | Änderung |
|---|---|---:|---|
| Henkel (mit Exe) | STEHEN | 3 | nur der Name „Zone“ fällt weg |
| Leiste (Crimp) | TECHNIK | 2 | — |
| **Sloper / Volumen** (Aufleger) | WENDIGKEIT | 2 | statt „Tritt/Volumen“ |
| Zange (Pinch) | WUCHT | 2 | — |
| Dyno | ANTRITT | 1 | — |

- **Warum Sloper statt Tritt:** Füße gehören zu **jedem** Zug und sind keine Griffart. Henkel,
  Leiste, Sloper und Zange sind die vier Grundformen, die jede Kletterhalle unterscheidet. Ein
  Sloper hält nur über Körperposition, Reibung und Fußarbeit. Das passt zu WENDIGKEIT (dex 45,
  speed 32, aw 23) besser als ein „Tritt“. Und das Konzept spricht selbst vom „Sloper-Spezialisten“
  (2.1), ohne einen Sloper zu führen.
- **Warum nicht weniger:** Fünf Arten sind die Spreizung, die „mehrere Wege zum Erfolg“ verlangt,
  also verschiedene Stars an verschiedenen Griffen. Die Budget-Verteilung aus Konzept 2.1 bleibt,
  die Pp-Messung in PR 2 entscheidet.
- **Randnotiz, kein Umbau:** Echte Leisten sind vor allem Fingerkraft. TECHNIK deckt das über
  power 23 nur halb ab. Der Ticker sollte an der Leiste deshalb Präzision **und** Fingerkraft
  erzählen („hält die Leiste auf zwei Fingerglieder“), aber das Rezept wird dafür nicht angefasst.
  Den Refit macht PR 2 ohnehin.
- **Ein Dyno** je Route entspricht modernen Wettkampfrouten: ein dynamischer Showzug, nicht mehr.

### 3.8 Frage 8: Drei Routen-Layouts?

**Entscheidung: Ja, mit drei Präzisierungen.**

1. **Ein Layout je Spiel, für alle zwölf Routen identisch.** Im Wettkampf klettern alle dieselbe
   Route, in Duellformaten auf identischen Parallelrouten (1.2). Zwölf verschiedene Routen
   nebeneinander wären unfair, und das wäre kein Kletterwettkampf. Eine **neue** Route je Spiel
   entspricht dem Prinzip, dass eine Route vor dem Wettkampf nicht geklettert wird.
2. **„Überhang“, „Platte“, „Dach“** statt „Kante“. Kanten sind an Wettkampfwänden selten. Dach und
   Überhang sind der Normalfall, ein Plattenstart kommt vor. Dieselbe Multimenge an Griffarten wie
   im Konzept, damit die Pp stabil bleibt, nur eine andere Reihenfolge. **Die Crux (Dyno, Zange)
   liegt in allen drei in der oberen Hälfte.** Echte Wettkampfrouten werden nach oben schwerer, und
   auch die Rock-Master-Duelle entscheiden sich im steilsten Teil.
3. **Gemessen in PR 2, nicht rho-frei in PR 4.** Die Reihenfolge der Griffe bestimmt, wer mit wie
   viel Pump an welchen Griff kommt. Das ist Mechanik. Abnahme: rho über alle drei Layouts gemittelt
   **und** je Layout über 0,80. Liegt ein Layout darunter, fliegt es raus.

### 3.9 Frage 9: Zeitpunkt der Produktivierung *(Ops-Frage, andere Kriterien als Realismus)*

**Entscheidung: nicht auf den Saisonwechsel warten. PR 1 sofort. PR 2 und PR 5 zusammen in einem
Deploy-Fenster zwischen zwei Spieltagen.**

- **Warum kein Warten:** Matrix, Eignung und die Wertungsskala (N−i Rangpunkte, W-a) bleiben gleich.
  Spielerwerte und Kaderentscheidungen der laufenden Saison bleiben gültig. Die neue Mechanik soll
  dieselben Spieler oben sehen, nur aus echteren Gründen. Die Schranke ist „nicht schlechter als
  0,834“ bzw. hart über 0,80.
- **Das echte Ops-Risiko ist ein anderes.** Konzept 8.9 sagt selbst: Nach dem Deploy von PR 2 rechnet
  der Server sofort neu, PR 5 (PPS-Referenz neu ziehen) käme aber erst danach. In diesem Fenster
  laufen neue Ergebnisse gegen eine alte Referenz. Deshalb werden PR 2 und PR 5 am selben Tag vor dem
  nächsten Spieltag gemergt, oder PR 5 wird in PR 2 gefaltet. `pruefe-pps-referenz-frische.ts`
  sollte das ohnehin anmahnen.
- **Realismus am Rand:** Die IFSC ändert Regeln nur zum Saisonbeginn. Wenn Chris saubere Saisons
  wichtiger sind als Tempo, ist Warten die konservative Wahl. Technisch nötig ist es nicht.

### 3.10 Frage 10: Reihenfolge im Projekt *(Ops-Frage)*

**PR 0 und PR 1 sofort.** Sie sind rho-frei und beantworten Chris' Satz sichtbar. Der
Fortschrittsbalken ist schon gemergt, der Rebase entfällt. **PR 2 danach, sobald die laufende
I-Spy-Runde abgeschlossen ist.** Beide fassen `engine.js` an, und Kalibrierrunden sollten sich nicht
gegenseitig die Basislinie verschieben. **Disziplinen unter der 0,80-Schranke haben Vorrang vor
Climbing-PR 2**, denn Climbing besteht bereits.

### 3.11 Frage 11: Rasten als Plan-Entscheidung?

**Entscheidung: Ja, als Pump-Schwelle je Plan. Die Rennplan-Ansage ist der Zuruf des Coachs. Das
gehört in PR 2.**

- **Realismus:** Wo man ausschüttelt und wo man durchzieht, ist die taktische Kernentscheidung im
  Lead. Das Rasten kostet Kletterzeit gegen die Uhr, dafür kommt Unterarm zurück. Die Regeln
  definieren „shaking out“ ausdrücklich (Fn. 22).
- **Wann die Entscheidung fällt:** Sie fällt **vor** dem Versuch, bei der Routenbesichtigung
  (§5.4 A, Notizen und Skizzen erlaubt), also über den Plan aus dem Slot. Der Zuruf während des
  Versuchs ist in Flash-Runden erlaubt (§5.5 B). Weil die Routen bei uns vorher sichtbar sind, ist
  unser Format Flash, und der Coach darf rufen.
- **Schwelle statt Boolean:**
  - Konzept 2.5 schlägt feste Booleans je Zone vor, etwa `[false,true,false]`.
  - Echte Kletterer rasten, **wenn sie gepumpt sind**, nicht an einer vorher festgelegten Exe.
  - Vorschlag: `rastUnter` je Plan, z. B. sparsam 0,80 / stetig 0,55 / angriff 0,30 der Reserve.
    An einer Henkel-Exe wird gerastet, wenn die Reserve darunter liegt.
  - Das kommt ohne `rr()` aus, ist deterministisch und stamina-nah. Es verhindert auch den
    Unsinn, dass jemand mit voller Puste an der ersten Exe pausiert.
- **Die Ansage** „jetzt rasten“ oder „durchziehen“ setzt diese Schwelle für den nächsten Henkel. Das
  passt in den bestehenden `planWechsel()`-Vertrag (drei Felder) als viertes Feld. Die Klemme für
  den Angriffspunkt (`battle-arena-rennplan-ansage.test.ts`) ist hier nicht nötig, weil ein Rast
  nur nach vorn wirkt.
- **Nicht rho-frei:** Die Rastregel ändert Rennverläufe. Sie muss in die Kalibrierung von PR 2.
  In PR 4 bleibt nur die Bedienseite der Ansage.

---

## 4. Die Konzept-Empfehlungen im Realismus-Test

| Konzept-Empfehlung | Urteil | Begründung |
|---|---|---|
| Hybrid „Lead-Rennen mit Sturzzonen“ statt reinem Lead | **trägt** | Reines Lead (ein Versuch) nimmt Schwachen die Ereignisse (Hockey-Lehre, `CLAUDE.md`). Das Weiterklettern nach dem Sturz ist echte Rotpunkt-Praxis, nur nicht Wettkampfregel. Das ist die eine bewusste Abweichung von IFSC, und sie ist begründet. |
| Vertikale Wand, Kamera nach oben (PR 1) | **trägt**, ergänzt | plus Sicherer, Seil durch geklinkte Exen, ein Layout für alle Routen (3.6, 3.8) |
| Griffarten mit eigenem Sub-Skill | **trägt**, eine Umbenennung | Sloper statt Tritt (3.7) |
| Zeitpreis je Griff (`huerdePreis`) | **trägt** | Griff lesen, umgreifen und klinken kostet echt Zeit |
| Drei Wege je Griff (Technik → Kraftzug → Umsetzen) | **trägt** | „Durchziehen“ und „Füße umsetzen, neu lesen“ sind die echten Auswege an einem Griff, der nicht passt. Das ist genau das Primär-/Nebenweg-Muster. |
| A-2 zurück zur Zone | **trägt**, drei Änderungen | Höchstmarke, Balance-Deckel statt Rückstellung, Pump in die Sturzchance (3.3) |
| Balance als dritte Ressource, GLEICHGEWICHT als 8. Sub-Skill | **trägt** | Balance = Kopf, gestützt durch die Angstforschung (1.3). Den Unterarm trägt der Pump (3.3). |
| Pump steigt mit der Höhe (`steigung`) | **trägt** | Wettkampfrouten werden nach oben schwerer |
| G-2 Gegnerdruck, `druckQuelle` Nachbar/Feld | **trägt**, präzisiert | Duellpartner auf gespiegelter Route statt „bester Nachbar“, Feld als Rückfall (3.1) |
| G-1 Störgriff als gemessener Schalter | **widersprochen** | kein Kletterbild, IFSC verbietet es, zieht zurück zu Takeshi (3.1) |
| Kein Flow-Bonus für den Führenden | **trägt** | |
| Zeitlimit 1,6 × Siegerzeit, Top-out 60–80 % | **widersprochen** | gemessen 99,4 % Top-out, dann entscheidet die Uhr wie beim Speed. Neu: 40–55 %, ≈ 1,2 × (3.5) |
| W-a mit „`wert()` unverändert“ | **korrigiert** | `wert()` ordnet nicht nach Höhe (2.3) |
| W-b als spätere Option | **widersprochen** | Boulder-Wertung auf einer Lead-Wand (3.4) |
| Rasten-Booleans je Plan in PR 4 | **korrigiert** | Pump-Schwelle, und das ist Mechanik für PR 2 (3.11) |
| Drei Layouts in PR 4, je Saat | **korrigiert** | ein Layout je Spiel für alle, gemessen in PR 2 (3.8) |
| Abbruchkriterium A-2 → A-1 → alte Mechanik unter neuer Wand | **trägt** | Das ist der richtige Rückfall für eine Live-Disziplin. |

**Leitplanken, geprüft an allen Antworten:**

- **Matrix:** unangetastet, kein Override.
- **Attribute:** nur die acht der Matrix. `pusteHindernis` liest die Reserve (stamina-Rezept),
  GLEICHGEWICHT bleibt det/will/aw.
- **Fremde Hand:** Es gibt keinen Kanal, in dem sie einen Zug vernichtet. G-1 entfällt ganz, G-2
  verschiebt nur die eigene Schwelle, und die Höchstmarke schützt sogar vor dem eigenen Sturz.
- **rho über 0,80 und Pp ≤ 25:** Das bleiben die Abnahmen von PR 2, unverändert aus Konzept 6.3/6.4.
  Keine Antwort hier ersetzt eine Messung.

---

## 5. Was das für den 6-PR-Bauplan bedeutet

| PR | Konzept | Nach diesem Gegencheck | Status |
|---|---|---|---|
| **0** Doku, Nulllinie, Sonde | `wandProbe()`, Nulllinie | **Unverändert**, plus: die beiden Messungen aus 2.1/2.2 als Nulllinie übernehmen (Zeitspreizung, Top-out je k). Die `wert()`-Lücke (2.3) wird als bekannter Befund festgehalten. | unverändert + 2 Tabellen |
| **1** Wand-Darstellung (rho-frei) | `istWand()`, `bodenWand()`, Kamera, `stepWand()` | **Kleine Ergänzungen:** Sicherer und Seil durch geklinkte Exen, UI-Wort „Exe“ statt „Zone“, Countdown-Anzeige vorbereitet, **ein** Layout für alle Routen. Der Rebase auf den Fortschrittsbalken entfällt (schon gemergt, `81d950f4`). | leicht geändert |
| **2** Mechanik + Rezept | Griffarten, Zonen, A-2, Balance, G-2, Zeitlimit, GLEICHGEWICHT | **Größer, ≈ +1 Tag:** zusätzlich `wert()` nach Zeit/Höchstmarke, `u.hoch`, `pusteHindernis` für Climbing, Balance-Deckel nach Sturz, keine Rast im Seil, Duellpaare + Druckquelle Duell/Feld (Entscheidungsregel 3.1), Rast-Schwellen je Plan (aus PR 4), drei Layouts gemessen (aus PR 4), Zeitlimit am Top-out-Korridor 40–55 % geeicht. Die Schalter-Matrix (Konzept 6.4 Schritt 5) wird zu: A-2 mit/ohne Höchstmarke × Druck Duell/Feld × `pusteHindernis` an/aus. | **geändert** |
| **3** Störgriff G-1 | `tackle:true` usw. | **Entfällt.** Nur wenn Chris ausdrücklich widerspricht (Abschnitt 6), wird er wie im Konzept gebaut, mit Balance-only als Pflicht. | **gestrichen** |
| **4** Boxscore, Endstand, Ton, Politur (rho-frei) | inkl. Layouts, Rast-Ansage, optional W-b | **Schlanker:** Boxscore in Lead-Notation (Höhe „TOP 4:51“ / „Griff 7+“, Exen, Stürze, Kraftzüge, Balance), Duell-Band (wer führt in welchem Paar), Ticker („zieht vorbei“, „fällt ins Seil bis zur zweiten Exe“, „schüttelt am Henkel aus“, „Zeit!“), Ton, Bedienseite der Rast-Ansage. **Ohne** Layouts und Rastlogik (jetzt PR 2), **ohne** W-b, ohne Stör-Spalten. | geändert |
| **5** Produktions-Nachzug | PPS-Referenz, Konstanten, Tests, Doku | **Inhalt unverändert.** **Deploy im selben Fenster wie PR 2** (3.9). Dazu `CLAUDE.md`-/Stand-Tabelle nachziehen. | Timing geändert |

**Aufwand:** fünf statt sechs PRs. PR 3 fällt weg (≈ −1 Tag), PR 2 wird größer (≈ +1 Tag).
Insgesamt bleibt es bei **7–9 Arbeitstagen**. Die Unsicherheit sitzt weiter in PR 2, jetzt mit
einem Hebel mehr gegen sie: Die Höchstmarke dämpft das A-2-Risiko.

**Korridor aus Konzept 6.6, angepasst:**

| Kennzahl | Konzept | Neu |
|---|---|---|
| Top-out-Quote | 60–80 % | **40–55 %** (Lead-Halbfinalbild, gemessen rho-billig) |
| Stürze je Kletterer | 0,6–1,2 | unverändert |
| Rasten je Kletterer | 1–3 | unverändert, jetzt aus der Pump-Schwelle |
| Störgriffe je Rennen | 3–6 | **entfällt** |
| Siegerzeit | Nulllinie ±15 % | Nulllinie **+0 bis +30 %** (Rast und Stürze verlängern bewusst) |
| Duell gewonnen vom Eignungsbesseren | — | **neu**, als Anzeige-Kennzahl, Vorbild Wettessen 1v1 (88,1 %) |
| Heim:Gast | 45:55 bis 55:45 | unverändert, der Bahn-Spiegeltest bleibt zu bauen |

---

## 6. Der eine Punkt, an dem Chris ein Veto haben sollte

Chris hat zweimal etwas gesagt, und die beiden Sätze ziehen an einer Stelle gegeneinander:

- **22.09.:** „wo man auch **versuchen kann** andere aus dem gleichgewicht zu bringen“
- **Delegation:** „Hauptsache es ist wie echtes klettern“

Im echten Klettern bringt man andere nicht mit der Hand aus dem Gleichgewicht, das ist verboten und
würde annulliert. Man bringt sie aus dem Gleichgewicht, **indem man an ihnen vorbeiklettert**. Dieses
Papier hat den zweiten Satz als Maßstab genommen und den ersten über den Duelldruck erfüllt: Der
Plan „Angriff“ ist der Versuch, am Gegner vorbeizuziehen, und der Ticker erzählt es.

Wenn Chris beim Zuschauen trotzdem den direkten Kontakt vermisst, reicht ein Satz, und PR 3 kommt
wie im Konzept zurück. Dann gilt „nur Balance, nie Sturz“, denn das ist Projektregel, keine Option.
Alles andere in diesem Papier ist entschieden.

---

## Quellen

**Primär (Volltext gelesen):**

- IFSC Competition Rules, Version 1.0, Januar 2025 (§5.2–5.5, §6.1–6.9, §8.1–8.5, §9.1–9.7, Glossar
  „Technical Incident“, Fußnoten 9, 12, 16, 22, 23, 30):
  [PDF](https://images.ifsc-climbing.org/ifsc/image/private/t_q_good/prd/w2ggglzziip6zpnpkir4.pdf)

**Formate, Wertung, Tie-Break:**

- [gearjunkie — IFSC World Cup Climbing Rules & Scoring Explained](https://gearjunkie.com/climbing/ifsc-climbing-explained)
  (Lead: 6 min, höchster kontrollierter Griff, Gleichstand über die Zeit, dann Countback)
- [Rock Master — Lead Duel](https://rockmaster.com/en/events/rock-master-lead-duel_86827),
  [Gripped — Ondra gewinnt das Rock-Master-Lead-Duell](https://gripped.com/indoor-climbing/adam-ondra-wins-legendary-rock-master-lead-duel-competition/)
  (identische Parallelrouten, 25 m Überhang, „most duels are decided“ im steilsten Teil)
- [Park City Magazine — Psicobloc Masters head to head](https://www.parkcitymag.com/news-and-profiles/2018/07/watch-elite-climbers-go-head-to-head-at-psicobloc-masters),
  [Rock Climbing Realms — How Psicobloc competitions work](https://rockclimbingrealms.com/psicobloc-competition-format-deep-water-solo/),
  [Wikipedia — Deep-water soloing](https://en.wikipedia.org/wiki/Deep-water_soloing)
- [UKC — Paris 2024 Sport Climbing Scoring Explainer](https://www.ukclimbing.com/articles/features/paris_2024_olympic_games_sport_climbing_qualification_and_scoring_explainer-15300),
  [Gripped — How is climbing scored at the Paris Olympics](https://gripped.com/indoor-climbing/how-is-climbing-scored-at-the-paris-olympics/)
  (Lead-Punkte 4/3/2/1 je Griffband, +0,1)
- Boulder-Wertung 2025 (25/10/−0,1): die Konzept-Quellen (olympics.com, JudgeMate,
  worldclimbing.com), hier nicht erneut geprüft.

**Sturz, Pump, Angst:**

- [Wikipedia — Lead climbing](https://en.wikipedia.org/wiki/Lead_climbing) (Fallstrecke mindestens
  doppelt so weit wie über der letzten Sicherung)
- [The Climbing Doctor — Physiology of forearm pump](https://theclimbingdoctor.com/physiology-of-forearm-pump-and-ways-to-delay-its-onset/)
  (Ermüdung als Hauptursache von Stürzen, Mechanismus des Griffverlusts)
- Pijpers, J. R., Oudejans, R. R. D., Bakker, F. C. (2005): *Anxiety-induced changes in movement
  behaviour during the execution of a complex whole-body task.* Quarterly Journal of Experimental
  Psychology A, [doi:10.1080/02724980343000945](https://doi.org/10.1080/02724980343000945)
  (längere Kletterzeit, mehr tastende Bewegungen, längeres Greifen, stärkere Ermüdung, mehr Laktat
  unter Angst). Dazu [Nieuwenhuys, Pijpers et al. (2008), The influence of anxiety on visual
  attention in climbing](https://pubmed.ncbi.nlm.nih.gov/18490789/).

**Code und Repo (`origin/main` `68ad8c48`):**

- `public/mockups/battle-mode.engine.js`: `bahnRangliste()` (`:24152`), `pusteHindernis` /
  `pusteAbzug` (`:28613-28634`), Würfe mit `pusteAbzug` (`:28693`, `:28702`), `ZEIT_DEHNUNG`
  (`:30427`), `MOTOREN[bd]` Bahn inkl. `lauf`/`wert` (`:32838 ff.`), `disziplinProbe()`
  (`:34548`)
- `data/generated/rangtreue-basislinie.json:47-54`, `data/generated/kaderfamilie-live-save.json`,
  `scripts/lib/rangtreue-messung.mjs`, `scripts/miss-alle-disziplinen.mjs`,
  `tests/battle-arena-rennplan-ansage.test.ts`
- `docs/design/climbing-neukonzept-22-09.md` (alle 921 Zeilen),
  `docs/design/wettessen-format-opus-gegencheck-23-09.md` (Form, Duell-Kennzahl 88,1 %)
- Git: `81d950f4` (Fortschrittsbalken, gemergt), `7d84baaf` (Ticker-Zeitskala), `c046c847`
  (Konzept)
