# Time-Trial: „Die Jagd auf den Hot Seat" — Nachtkonzept für die ereignisarme Bahn-Disziplin (03.10.)

**Konsultation, kein Code geändert, kein Verhaltens-PR.** Dieser PR trägt ausschließlich diese
Datei. `engine.js` meint `public/mockups/battle-mode.engine.js` auf `origin/main` `eda92a77`
(Motor identisch mit `68563962`, auf dem gemessen wurde — dazwischen kamen nur Doku-PRs).
Alle Messungen liefen auf einer **Kopie** des Motors in einem Scratch-Verzeichnis außerhalb des
Repos (Anhang A), gegen die echte Kaderfamilie `data/generated/kaderfamilie-live-save.json`
(fünf Paarungen), mit der offiziellen `disziplinProbe` bzw. `einflussVon` des Motors.

Chris' Auftrag, wörtlich (02.10.): „wie viele disziplinen haben wir die recht langwilig aussehen
oder wo nicht so viel passiert wenn man zuschaut? […] beim gewichtheben könnte man als manager den
leuten ja zb auch vorgeben wer versucht zu pushen und risiko zu gehen und wer hält sich lieber
etwas zurück etc. […] mehr risiko führt dazu dass jemand sich evtl übertrifft oder unter dem druck
oder gewicht einbricht." Und am 03.10. abends: „bei den anderen event poors bitte heute über die
nacht auch konzepte ausarbeiten […] denk gern um die ecke, hol infos aus dem internet und probier
dich aus."

Befund der Konsultation (`manager-risiko-interaktivitaet-konzept-02-10.md`, Zeile 35): „bis 23,5 s
stehendes Bild, bis 17 s Stille. Einzelstart, lange fährt nur einer." Höchster rho-Puffer der
neun (0,929).

---

## 0. Ergebnis vorab

1. **Das Zeitfahren ist heute meistens schon nach dem ersten Zieleinlauf entschieden.**
   Nachgemessen (120 Rennen, kaderfest): Der Hot Seat wechselt im Median **null Mal**. Der zuletzt
   gestartete Fahrer holt ihn in **0 %** der Rennen. Der Grund: Die Startfolge folgt der
   Slot-Reihenfolge (`(idx·2+seite)·0,8 s`, `engine.js:36957`), und die starken Fahrer stehen auf
   den vorderen Slots. Wer als Erster im Ziel ist, hat meistens schon die Bestzeit. Danach
   verlieren alle anderen nur noch — elf Mal hintereinander. **Die Langeweile ist kein Mangel an
   Anzeigen** (Zwischenzeit-Tafel, Hot Seat, Geisterfahrer, „Zeit für den Teamsieg" und
   Alternativ-Rechner sind seit dem 28.09./01.10. gebaut). **Sie ist ein Reihenfolgeproblem.**
2. **„Der Favorit fährt zuletzt"** (Fable 2.1, hier erstmals gemessen) dreht genau das um, wie
   jedes echte Zeitfahren:
   - Hot-Seat-Wechsel 0 → **4** (Median). Die letzte Entscheidung fällt bei **94 %** der Sendung
     statt am Anfang.
   - Die Solo-Strecke am Schluss sinkt von 6,5 auf **2,2 s** (P90 12,6 → 5,4 s).
   - Die längste Strecke ohne Ereignis sinkt von 9,4 auf **5,1 s**.
   - **rho bleibt analytisch unberührt**, weil gewertet wird nach eigener Laufzeit, ohne
     Interaktion und ohne `rr()` im Rennen.
   - **Aber:** Die Sendung wird im Median 95 → 81 s kürzer, und die Entscheidung wandert ans
     Ende. Das ist **Wandzeit/Spielablauf, also Klasse T**. Es wird nicht gebaut, Chris
     entscheidet.
3. **Kern meines eigenen Konzepts: die Live-Ampel.** Grün/rot gegen den Hot Seat an jedem
   Messpunkt, wie im Ski alpin (FIS) und mit dem „Virtual Runner" (Swiss Timing). Der Ticker
   meldet nur **Kipppunkte**, also den Moment, in dem ein Fahrer von rot auf grün springt oder
   zurück — nicht jede Zwischenzeit. Das ist Klasse A und baut auf `bahnGeistPosition()`/
   `bahnBesteZeit()` auf.
   - **Gemessen trägt sie nur zusammen mit der umgekehrten Startfolge:** heute 1 Kipppunkt je
     Rennen (alle fahren rot hinter dem frühen Favoriten), mit „Favorit zuletzt" **11**.
   - Die Ampel ist deshalb das, was die neue Reihenfolge erzählbar macht. Ohne die Reihenfolge
     ist sie fast stumm.
4. **Der Manager-Hebel (Rennplan je Fahrer statt Slot-Ableitung) ist rho-sicher, aber
   Pp-blockiert.**
   - **rho:** Jede Planbelegung liegt bei 0,92–0,94. Selbst eine bösartige Belegung (die Starken
     bekommen den schlechtesten Plan, die Schwachen den besten) hält 0,911. Die heutige
     Slot-Ableitung (0,923) ist sogar schlechter als jeder einheitliche Plan (0,938–0,940).
   - **Pp:** Die Pp-Abweichung steht heute schon bei **22,1 / 24,1** (zwei Saatströme), und jede
     Hebel-Variante landet bei **25,6–30,7**.
   - Ursache ist Stamina mit 24 % statt der Matrix-15 %: Der seit TT-P1 bindende Puste-Haushalt
     liest STEHEN/ROBUST, und jede Planlogik verschärft das.
   - **Vorbedingung ist deshalb eine Pp-Runde, die Stamina absenkt, nicht „Ins Rote gehen".**
5. **„Ins Rote gehen" (Fable 1.2) rettet Negativ-Split nicht.** Gemessen in vier Dosierungen:
   Negativ-Split ist danach in höchstens 2 % der Fälle der beste Plan, vorher 0 %. Was dagegen
   wirkt, ist ein **Schlussgang**: Negativ-Split darf auf den letzten 15 % über 1,0 fahren, mit
   kubischen Kosten wie jede andere Mehrleistung. Damit ist er in 18–19 % der Fälle der beste
   Plan, bei mittlerer Reserve sogar 25 %. Die Pläne rücken zusammen (bester → zweitbester
   0,42 → 0,13–0,18 Sim-s): Erst damit ist die Wahl eine echte Entscheidung.
6. **Verworfen nach Messung:**
   - die „Duell-Waage" (Teamzeit als Summe der sechs Slot-Duelle): Nur 3 % der Duelle sind knapp,
     und nur in 22 % der Rennen wechselt die Führung der Waage überhaupt;
   - der Paarstart wie im Eisschnelllauf: widerspricht Chris' „jeder spieler einzeln" (22.09.)
     und bringt gemessen weniger als die reine Umkehr.

**Empfehlung in einem Satz:** Chris fragen, ob die Startfolge umgekehrt werden darf (T). Wenn ja,
die Live-Ampel als Klasse A dazu bauen. Den Plan-Hebel erst nach einer Stamina-Pp-Runde und mit
Schlussgang statt „Ins Rote".

---

## 1. Problemrahmen: was heute im Code steht

| Baustein | Stand | Stelle |
|---|---|---|
| Einzelstart, 0,8 s Abstand, im Wechsel Heim/Gast | gebaut (K5, 13.09.) | `bauSpurt`, `engine.js:36957` |
| Startreihenfolge | **nach Slot-Index** (`idx`), die starken Fahrer auf den vorderen Slots | `slotFuer(p,idx)` |
| Streckenprofil: 3 Kurven (TECHNIK), 2 Steigungen (ENDTEMPO + WUCHT-Nebenweg), 2 Abfahrten (WENDIGKEIT), GESPÜR streckenweit | gebaut, stetig, ohne Wurf | `gelaende`, `gelaendeFaktor()` |
| Puste-Haushalt bindet (kubischer Verbrauch, Einbruch ×0,50, Fangen bei 30 %) | gebaut (TT-P1, PR #1035) | `zehrExponent:3`, `leerTempoBasis:0.50` |
| Tagesform ±1,5 % — **der einzige Zufall**, im Rennen fällt kein `rr()` | gebaut | `formTag` |
| Zwischenzeiten bei 40 % / 76 %, Diff zur Bestzeit im Feld | gebaut | `zwischenzeiten:[0.40,0.76]`, `bahnBesteZeit()` |
| Hot Seat, Geisterfahrer, „Zeit für den Teamsieg", Kamera-Fokus mit Automatik | gebaut (Broadcast 28.09.) | `bahnHotSeat()`, `bahnGeistPosition()`, `bahnZeitFuerSieg()`, `zeitfahrenFokus*` |
| Alternativ-Rechner („mit Gleichmaß wärst du 0,4 s schneller") | gebaut (01.10.) | `bahnAlternativZeilen()` |
| Pläne Gleichmaß/Negativ-Split/Attacke | **aus dem Slot abgeleitet** (`planJeSlot`); live umstellbar nur in der Arena-Ansicht | `planJeSlot`, `planWechsel()` |
| Teamwertung | Zeitsumme (Chris 22.09.), Punkte je Fahrer weiter Rangpunkte | `wertung:"zeit"` |

**Was die Messung über die heutige Dramaturgie sagt** (Abschnitt 5.3, Spalte „heute"): Der Hot
Seat wechselt im Median null Mal, und der Letzte holt ihn nie. Die Ampel-Information der
Zwischenzeit-Tafel ist damit fast immer dieselbe — „+x hinter Bestzeit". Ein Zuschauer sieht nach
dem ersten Zieleinlauf, wer gewinnt, und dann noch 80 Sekunden lang Bestätigung. Genau das ist das
„stehende Bild" des Audits: Nicht die Pixel stehen, die **Geschichte** steht.

Zur 23,5-s-Zahl des Audits, ehrlich eingeordnet: Meine längste Solo-Strecke am Schluss liegt bei
maximal 17,3 s in echter Zeit (Sim × `ZEIT_DEHNUNG` 4,38). Die 23,5 s des Audits enthalten
vermutlich Einlauf/Endstand-Übergang. Die Zuordnung ist **Hypothese**, nicht gemessen.

Nebenbefund zur Plan-Dominanz: Das Fable-Papier vom 30.09. zitiert nach TT-P1 „Attacke 50 % /
Gleichmaß 50 %" (Plan-Sonde am Standardkader). Kaderfest gemessen (live-save-Familie, jeder Fahrer
auf jedem Plan) ist es **Attacke 85 % / Gleichmaß 15 % / Negativ-Split 0 %**. Nur bei kleiner
Reserve (unteres Drittel) ist Gleichmaß in 29 % der Fälle richtig. Die Pläne sind also nach wie
vor fast eine Scheinentscheidung.

---

## 2. Recherche: was ein Zeitfahren beim Zuschauen spannend macht

### 2.1 Der Bestzeithalter wartet — und der Beste kommt zuletzt

- **Startfolge rückwärts.** Bei großen Rundfahrten starten die Fahrer in umgekehrter Reihenfolge
  der Gesamtwertung: „As usual, the riders will start in reverse order of the general
  classification." — der Letzte des Tages ist der Gesamtführende
  ([BikeRadar, Tour 2026 Etappe 16](https://www.bikeradar.com/news/2026-tour-de-france-stage-16-time-trial-start-times)).
  Der Grund steht in derselben Berichterstattung: Die entscheidende Aktion fällt in die letzte
  Viertelstunde
  ([Cyclingnews, Startzeiten Tour Etappe 13](https://www.cyclingnews.com/news/tour-de-france-stage-13-time-trial-start-times/),
  zusammengefasst über die Suche, die Seite selbst lieferte keinen Volltext).
- **Der Hot Seat** ist der Stuhl, auf dem der aktuelle Bestzeithalter vor der Kamera wartet. Die
  Kamera schneidet immer wieder zu ihm zurück; bei der Tour de Suisse 2026 wurde das Bild von Van
  der Poel auf dem Hot Seat „one of the defining images of the stage"
  ([Domestique Cycling](https://www.domestiquecycling.com/en/news/philippe-gilbert-backs-mathieu-van-der-poels-tour-de-suisse-fine-he-had-plenty-of-time-to-put-a-jersey-on/)).
  Rouleur beschreibt ihn als „exposed, awkward, discomfiting and vulnerable". Die meisten sitzen
  dort nicht lange, weil die besseren Fahrer zuletzt starten
  ([Rouleur, „What it's like being in the time-trial hot seat"](https://rouleur.cc/blogs/the-rouleur-journal/what-it-s-like-being-in-the-time-trial-hot-seat),
  Seite zeitweise mit 429, Zitate aus der Suchzusammenfassung).
- **Übertragbar:** Unser Hot Seat ist gebaut (`bahnHotSeat()`), aber er wird nie bedrängt — weil
  bei uns der Favorit oft zuerst fährt. Der Hot Seat braucht die umgekehrte Reihenfolge, um
  überhaupt eine Funktion zu haben.

### 2.2 Zwischenzeiten als Kipppunkte

- **Evans gegen Schleck, Grenoble 2011.** Evans lag vor dem Zeitfahren 57 s hinter Andy Schleck.
  An der ersten Zwischenzeit hatte er 36 s davon aufgeholt, an der zweiten war der Rückstand weg
  — Evans war 1:32 schneller, am Ende 2:31
  ([AP über Washington Times](https://www.washingtontimes.com/news/2011/jul/23/cadel-evans-set-become-1st-aussie-win-tour/),
  [Cycling Weekly](https://www.cyclingweekly.com/news/racing/tour-de-france/evans-blows-schleck-away-in-final-tt-and-takes-yellow-to-paris-49929)).
  Das ist der Moment, in dem das „virtuelle Gelbe Trikot" auf den Zwischenzeiten den Besitzer
  wechselt.
- **Pogačar gegen Roglič, La Planche 2020.** Roglič hatte 57 s Vorsprung. Beide kamen nahezu
  zeitgleich an den Fuß des Schlussanstiegs, „it all came down to the final six kilometers".
  Pogačar nahm ihm 1:56 ab und das Gelbe Trikot
  ([AP, 19.09.2020](https://www.news4jax.com/sports/2020/09/19/pogacar-crushes-roglic-to-take-grip-on-tour-de-france-title/)).
- **Vingegaard gegen Pogačar, Combloux 2023:** Der Abstand wuchs an jeder Zwischenzeit,
  16 s → 31 s → 1:05 → 1:38
  ([Tour-Magazin](https://www.tour-magazin.de/en/professional-cycling/latest-news/stage-16-time-trial-duel-between-vingegaard-and-pogacar/),
  [bikeraceinfo](https://bikeraceinfo.com/tdf/2023-TDF-Daily/tdf2023-Daily-stage-16.html)).
  Auch ohne Kipppunkt erzählen die Zwischenzeiten eine **Bewegung**, nicht nur einen Stand.
- **Fernsehgrafik dazu.** SMT lieferte NBC für die Zeitfahren „predicted finish times", „the time
  each rider must finish to take the yellow jersey" und „a comparison of two riders to determine
  who is fastest on specific sections of the course"
  ([SMT](https://smt.com/smt-delivers-new-features-for-time-trial-stages-for-nbc-sports-tour-de-france/)).
  Laut Suchzusammenfassung erschien die Grafik „virtuelles Gelbes Trikot" erstmals 2011 in
  Grenoble ([SMT](https://smt.com/smt-delivers-new-features-for-time-trial-stages-for-nbc-sports-tour-de-france-2)).
  Der Hinweis auf 2011 stand nicht im abgerufenen Artikeltext, nur in der Suchzusammenfassung.
- **Übertragbar:** Das Ereignis, das eine Zwischenzeit erzählenswert macht, ist der
  **Vorzeichenwechsel** (wer ist virtuell vorn?), nicht die Zahl selbst. „Zeit für den Teamsieg"
  haben wir schon — das Pendant zu „time to take the yellow jersey".

### 2.3 Grün/rot und die virtuelle Linie: Ski alpin, Schwimmen

- **Ski alpin:** Die Zwischenzeiten zeigen die Differenz zum aktuell Führenden, „marked in green
  (athlete ahead of the leading time) or red (athlete behind the leading time)". Die Laufzeit
  springt an jedem Messpunkt um, damit die Zuschauer „continuously discover if the athlete on track
  is in the lead or needs to close the gap"
  ([FIS Broadcaster Manual Alpin 21/22](https://assets.fis-ski.com/image/upload/v1657790589/fis-prod/assets/FIS_Broadcaster_Manual_AL_2122.pdf),
  über die Suchzusammenfassung).
- **Virtual Runner (Swiss Timing):** „A graphic representation of the leading athlete's position
  compared to that of the current competitor", „particularly well received in swimming and alpine
  skiing events"
  ([Swiss Timing](https://www.swisstiming.com/services/broadcast-solutions/virtual-runner)).
  Unser Geisterfahrer (`bahnGeistPosition()`) ist genau das.
- **Übertragbar:** grün/rot ist eine **binäre Zustandsanzeige**, und ihr Wechsel ist ein
  Ereignis. Wir haben den Geist schon — was fehlt, ist die Farbe und das Melden des Wechsels.

### 2.4 Einzelsport mit Direktvergleich: Eisschnelllauf

- „In the classical distances, skaters compete in pairs against the clock." Gepaart und gesetzt
  wird über eine gewichtete Auslosung: „The pairs from the group featuring the highest-ranked
  skaters start last in the competition"
  ([ISU, Speed Skating Rules Explained](https://isu-skating.com/news/speed-skating-rules-explained/)).
- **Übertragbar und gemessen:** Das Paar-Prinzip haben wir faktisch schon — Heim-Slot i und
  Gast-Slot i starten direkt hintereinander. Als Erzählform („sechs Duelle") trägt es aber nicht
  (Abschnitt 5.3: Duelle sind fast nie knapp). Die zweite Hälfte der ISU-Regel trägt dagegen sehr
  wohl: **Die Besten starten zuletzt.**

### 2.5 Pacing: über die Schwelle gehen und einbrechen

- „Most amateur riders' time trial failures aren't due to ‚lack of strength' but poor pacing:
  going out too hard and burning through too much W′ early on, then fading in the second half."
  Ein positiver Split kann „more than 1 minute slower than even pacing" sein
  ([ctyeh.com, Pacing-Guide](https://ctyeh.com/articles/6371?lang=en),
  [Cycling West](https://www.cyclingwest.com/fitness/coaching/pace-yourself/)).
- W′ (W prime) ist das endliche „Akku"-Konto oberhalb der kritischen Leistung. Das W′bal-Modell
  sagt den Zeitpunkt der Erschöpfung voraus und wird für Echtzeit-Taktik genutzt
  ([Rowe & King, W′-Guide](https://roweandking.com/w′-w-prime-or-functional-reserve-capacity-a-concise-guide/),
  [Sports Medicine 2017, CP-Konzept](https://link.springer.com/article/10.1007/s40279-017-0688-0)).
  Unsere Puste **ist** W′bal — seit TT-P1 bindet sie wirklich.
- Live-Leistungsdaten im TV gibt es seit 2016 (Velon, Tour de Suisse): „speed, power, cadence,
  heart rate and gradient" einzelner Fahrer
  ([Velon](https://www.velon.cc/velon-rider-data-system),
  [Infront](https://www.infront.sport/news/sports-technology/realtime-rider-data-shown-live-on-tv-and-made-available-through-a-new-mobile-app-at-the-tour-de-suisse)).
- **Übertragbar:** Der Einbruch ist nur dann Drama, wenn er eine **gewählte** Wette war. Das ist
  der Plan-Hebel — und er braucht einen Plan, der sich hinten auszahlt (Abschnitt 3.4).

### 2.6 Was davon unserem Zeitfahren fehlt

| Reales Element | Bei uns | Lücke |
|---|---|---|
| Bester startet zuletzt | Bester startet oft zuerst | **Reihenfolge** (T) |
| Hot Seat wird bedrängt | Hot Seat steht | folgt aus der Reihenfolge |
| Grün/rot-Kipppunkte | Diff-Tafel an 2 Punkten, fast immer „+" | Farbe + Ereignis (A) |
| virtueller Läufer | Geisterfahrer gebaut | nur Anbindung an die Ampel |
| Pacing als gewählte Wette | Plan aus dem Slot, Negativ-Split tot | Manager-Hebel + Schlussgang (B), Pp-Vorbedingung |
| Funk vom Teamwagen | — | Wenn-dann-Regel an ZZ1 (B, Stufe 2) |

---

## 3. Das Konzept: „Die Jagd auf den Hot Seat"

### 3.1 Leitidee

Ein Zeitfahren ist keine Bewegung über eine Strecke, sondern eine **Folge von Herausforderungen
an einen Wartenden**. Jeder neue Fahrer greift den Hot Seat an. Die Zwischenzeiten sagen live, ob
der Angriff hält (grün) oder bricht (rot). Und der Manager hat vorher entschieden, wie sein Fahrer
angreift. Drei Bausteine, nach Klasse getrennt, dazu ein vierter als Option.

### 3.2 Baustein J1 — Der Favorit fährt zuletzt (Klasse T, nur mit Chris' Zustimmung)

**Was.** Die Startfolge wird nach angezeigter Eignung **aufsteigend** sortiert: Der Schwächste
rollt als Erster von der Rampe, der Beste als Letzter. Der Startabstand bleibt 0,8 s.
Seitenwechsel wird aufgegeben, weil die Sortierung über beide Teams läuft. Varianten für Chris
in Abschnitt 7.

**Was sich messbar ändert** (6 je Seite, 120 Rennen, Tabelle 5.3):

| | heute | Favorit zuletzt |
|---|---:|---:|
| Hot-Seat-Wechsel je Rennen (Median / P90) | 0 / 1 | **4 / 6** |
| Zeitpunkt der letzten Hot-Seat-Übernahme (Anteil der Sendung, Median) | — (keine) | **94 %** |
| Solo-Strecke am Schluss (echte s, Median / P90) | 6,5 / 12,6 | **2,2 / 5,4** |
| längste Strecke ohne Ereignis (echte s, Median / P90) | 9,4 / 13,5 | **5,1 / 7,2** |
| Sendungsdauer Rennen (echte s, Median) | 94,8 | **81,2** |
| letzter Starter holt den Hot Seat | 0 % | 15 % |

Bei 4 je Seite: Hot-Seat-Wechsel 0 → 2, Solo-Strecke 3,5 → 1,8 s. Bei 2 je Seite bleibt es bei
Median 0 (P90 1 → 2) — vier Fahrer tragen keine Hot-Seat-Dramaturgie, egal in welcher
Reihenfolge.

**rho/Pp.** Analytisch neutral. Gewertet wird `bahnZeit()` (eigene Laufzeit). Kein Fahrer
beeinflusst einen anderen (`schatten:false`, `tackle:false`), und die Tagesform `formTag` wird in
`setz()` in fester Reihenfolge gezogen, unabhängig von `startT`. Es bleibt nur die
Tick-Quantisierung am Startgatter, beim letzten Startfolge-Umbau gemessen 0,828 → 0,825, weit
innerhalb der Kaderspannweite (`engine.js:36942`). Pp: `einflussVon` liest dieselben Rangpunkte —
ebenso neutral.

**Warum Klasse T, ehrlich.** Die Sendung wird kürzer, und die Entscheidung wandert vom Anfang ans
Ende. Das ist genau die „vom Zuschauer erlebte Wandzeit-/Spielfluss-Taktung", die
`broadcast-d7-a4-fable-empfehlung-02-10.md` als T definiert. Dass die Änderung die Simulation nicht
berührt, macht sie nicht zu A — bei D7/A4 und beim Fechten-Format war genau diese Selbsteinstufung
schon zweimal falsch. **Deshalb nicht gebaut.**

### 3.3 Baustein J2 — Die Live-Ampel mit Kipppunkten (Klasse A)

**Was.**
1. **Ampel am Fokus-Fahrer.** Die Zeit im Fokus-Panel färbt sich grün, wenn er an seinem letzten
   Messpunkt schneller war als der Hot-Seat-Halter (Geist, `bahnGeistPosition()`) bzw. als die
   Bestzeit im Feld an diesem Punkt (`bahnBesteZeit()`). Rot, wenn er langsamer war.
2. **Messpunkte verdichten.** Zusätzlich zu ZZ1/ZZ2 stille Messpunkte alle 10 % (reine
   Erfassung wie `u.zz`, kein `rr()`). Sie erscheinen nicht als Tafel, sondern nur als Farbwechsel.
3. **Ticker nur bei Kipppunkten.** „Krolach fährt grün — bei 60 % schneller als der Hot Seat",
   „Johanna kippt auf rot — der Berg kostet". Keine Zeile je Messpunkt (Audit-Zielband: ≤ 30
   Zeilen/min).
4. **Regie folgt dem Bestzeitkurs** (optional, A): Die Kamera-Automatik (`bahnFokusAuto`)
   springt auf den Fahrer, der gerade innerhalb von 3 % des Hot Seats liegt, statt stur nach
   Startnummer. Gemessen gibt es mit J1 im Median **36** solche Kandidaten je Rennen (heute: 1) —
   also braucht die Regie eine Mindestverweildauer (Vorschlag 4 s).

**Gemessen:**

| | heute | mit J1 |
|---|---:|---:|
| Kipppunkte grün/rot je Rennen (Median / P90) | 1 / 4 | **11 / 16** |
| längste Strecke ohne Ereignis inkl. Kipppunkte (echte s, Median) | 9,4 | **4,5** |

**Lesart:** Die Ampel ohne J1 ist fast stumm. Alle fahren rot hinter einem früh gesetzten
Favoriten, und der Ticker hätte im Median genau einen Kipppunkt zu melden. **J2 ist die Erzählung
zu J1, nicht ihr Ersatz.** Das ist der wichtigste „um die Ecke"-Befund dieser Nacht: Wer die
Zwischenzeiten zum Kern machen will, muss zuerst dafür sorgen, dass es etwas zu vergleichen gibt.

**rho/Pp.** Bit-identisch — reine Anzeige auf vorhandenen Feldern (`u.zz`, `bahnZeit`). Die
zusätzlichen Messpunkte schreiben nur `u.zz[ci]` (Erfassungsschleife `engine.js:37436`, ohne
Rückwirkung). Achtung, Nebenwirkung: Wer `BA().zwischenzeiten` verlängert, verlängert auch die
Spalten im Endstand (`engine.js:35947`) und die Zwischenzeit-Töne (`engine.js:38806`). Die
stillen Messpunkte deshalb als **eigenes** Feld führen, nicht in `zwischenzeiten`.

### 3.4 Baustein J3 — Rennplan in Managerhand, mit Schlussgang (Klasse B, mit Pp-Vorbedingung)

**Was.** Chris' Risikoidee, auf das Zeitfahren übersetzt. Der Manager wählt je Fahrer den Plan
(heute aus dem Slot abgeleitet):

- **Gleichmaß — „absichern":** 0,93 bis 75 %, kommt sicher an.
- **Negativ-Split mit Schlussgang — „hinten raus":** verhalten bis zur Hälfte, ab 85 % **über
  1,0**, solange die Puste nicht leer ist. Die Mehrleistung kostet kubisch wie jede andere.
- **Attacke — „alles oder nichts":** von Beginn an 1,0, bricht ein, wenn die Reserve nicht reicht.

Eine KI-Vorgabe deterministisch aus dem Kader (Muster `berechneFokusAuto`), die Chris
überschreiben kann. Ticker: „Lulu fährt Attacke — Puste bei 20 % an ZZ2" → „Lulu bricht ein".

**Was die Messung zeigt (Abschnitt 5.1/5.2):**

- **rho ist kein Problem.** Jede Planbelegung — Slot, einheitlich, perfekt (Orakel), schlechtest
  möglich, zufällig, bösartig — liegt zwischen 0,911 und 0,942. Die heutige Slot-Ableitung ist mit
  0,923 sogar schlechter als jeder einheitliche Plan (0,938–0,940): Sie verteilt rund einen Rang
  nach Slot statt nach Können (Opus-Hypothese vom 26.09., hiermit bestätigt).
- **Die Wahl entscheidet zwischen Nachbarn, nicht zwischen Stärke und Schwäche.** Bester gegen
  schlechtesten Plan bewegt einen Fahrer im Mittel um 0,68 Ränge (≥ 1 Rang in 48 %, ≥ 2 in 15 %).
  Paare mit ≥ 15 Eignungspunkten Abstand bleiben zu 98,8 % richtig geordnet, der Star steht in 82 %
  auf Rang 1 und in 96 % in den ersten zwei. Genau so soll Risiko wirken (Konsultation
  02.10., Designregel 2).
- **„Ins Rote gehen" (Fable 1.2) belebt Negativ-Split nicht.** Vier Dosierungen (Schlusszone 8/15 %,
  Tiefe 15–60 % der Reserve × STEHEN): Negativ-Split ist in 0–2 % der beste Plan. Der Rahmen
  schützt vor allem die Attackierer vor dem Einbruch (leer im Ziel 32 % → 5 %) und verschiebt
  Fahrer mit kleiner Reserve von Attacke zu Gleichmaß.
  - Der Grund ist strukturell: Kein Plan fährt je schneller als 1,0. Wer vorn spart, kann das
    Gesparte hinten nicht ausgeben.
- **Der Schlussgang belebt ihn.** Mit einem Kick von +8–10 % ab 85 % (Negativ-Split dazu 0,92–0,93
  bis 45–50 %) ist er in **18–19 %** der beste Plan, bei mittlerer Reserve in 24–27 %. Der Abstand
  bester → zweitbester Plan schrumpft von 0,42 auf **0,13–0,18 Sim-s**. Erst jetzt sind die drei
  Pläne echte Alternativen.
  - Attacke bleibt mit 65–69 % Mehrheit. Das Opus-Ziel „kein Plan über 60 %" ist noch nicht
    erreicht und wäre Kalibrierarbeit (z. B. Attacke-Verbrauch), keine neue Mechanik.
- **Pp ist das eigentliche Problem.** Die Pp-Abweichung steht heute bei **22,1 / 24,1**: Der
  zweite Saatstrom liegt einen Punkt unter der Schranke, die Stand-Doku führt 22,8. Jede
  Hebel-Variante überschreitet sie:

  | Variante (n = 24, Standardkader, Ströme 0 / 10 000 000) | Pp |
  |---|---:|
  | heute (Slot-Pläne) | 22,1 / 24,1 |
  | alle Attacke | 27,2 / — |
  | KI nach Reserve (unteres Drittel Gleichmaß, sonst Attacke) | 30,7 / 29,9 |
  | KI nach Reserve-Dritteln G/N/A + Schlussgang | 29,6 / 28,5 |
  | KI nach ANTRITT + Schlussgang skaliert mit ANTRITT | 27,9 / 27,5 |
  | alle Negativ-Split + ANTRITT-Schlussgang | 25,6 / 26,0 |
  | Slot-Pläne + ANTRITT-Schlussgang | 25,6 / 26,6 |

  Die Detailtabelle sagt warum. Stamina liest heute **23,8–25 %** bei Matrixgewicht 15, Dexterity
  19,5–20,5 % bei 25, Speed 18–21 % bei 22. Der seit TT-P1 bindende Haushalt liest STEHEN/ROBUST
  (stamina-lastig) über `KRAFT_VON` und `pusteRegen`. Jede Planlogik, die die Reserve wichtiger
  macht, gibt Stamina noch mehr Gewicht. Den Schlussgang über ANTRITT (Speed/Power/Dexterity)
  zu bezahlen, hilft etwa 2–4 Pp, reicht aber nicht.

**Vorbedingung P0, statt „Ins Rote": eine Stamina-Pp-Runde.** Ziel ≤ 18 Pp in beiden Strömen,
damit J3 ein Budget von ~5 Pp hat. Hebel nach dem Muster des Elften Nachtrags (dort 68,7 → 17,8,
Matrix unangetastet):

- Stamina-Anteile in STEHEN/ROBUST zugunsten von Dexterity senken;
- `pusteRegen` nicht mehr mit STEHEN skalieren, sondern mit einem Dexterity/Awareness-Mix
  („Rhythmus") — ein Nebenweg in der anderen Währung, Fable 1.1;
- prüfen, ob TT-P1 (`kraftSpanne` 1,0) die Ursache des Anstiegs von 17,8 auf 22–24 ist.

Das ist eine eigene Rezeptrunde (Klasse B), keine Erfindung dieser Nacht. Der Elfte Nachtrag hat
den Restausschlag Stamina (+6,7 bis +7,4) schon benannt und „nicht behoben, weil die Schranke
bereits erreicht ist".

### 3.5 Baustein J4 — Funkregel an ZZ1 (Klasse B, Stufe 2, Option)

**Was.** Eine vorab gesetzte Wenn-dann-Anweisung je Fahrer, ausgelöst an der ersten
Zwischenzeit, umgesetzt über `planWechsel()` (dieselbe Funktion wie die Live-Ansage, kein
zweiter Pfad):

- „Wenn rot: Attacke."
- „Wenn grün mit mehr als 1 s: halten (Gleichmaß)."

Sichtbar im Ticker: „Funk greift: Krolach rot an ZZ1 — geht auf Attacke". Das ist Befund B der
Konsultation (bedingte Anweisung statt Live-Eingriff), und es macht die Ampel aus J2 zum
**Auslöser einer Manager-Entscheidung** statt zu einer bloßen Anzeige. Erst damit gehört der
Zwischenzeit dem Manager.

**rho, geschätzt, nicht gemessen.** Eine Funkregel verteilt Pläne je Fahrer nach Lage. Sie
liegt damit innerhalb der Hülle, die ich gemessen habe — Orakel 0,936, bösartig 0,911, alles
dazwischen. Das ist eine **Schranke, kein Messwert**.

**Ehrliches Problem.** Mit J1 kennen späte Starter mehr Referenzzeiten, und späte Starter sind
die Starken. Ein Informationsvorteil nach Startnummer wäre ein Positionsbonus, den Opus (TT-P4)
ausdrücklich verworfen hat. Mildern ließe sich das, indem die Regel gegen die **eigene** Sollzeit
vergleicht (Hochrechnung bei ZZ1 gegen die Zielzeit der KI-Vorgabe), nicht gegen den Hot Seat.
Das ist zu entscheiden, bevor man misst.

### 3.6 Mehrere Wege zum Erfolg

- Der Plan-Hebel ist die Leitlinie auf Taktikebene: Derselbe Fahrer kann über Gleichmaß
  (Primärweg für kleine Reserve), Schlussgang (mittlere Reserve, starker Antritt) oder Attacke
  (große Reserve) zum besten Ergebnis kommen. Welcher Weg richtig ist, hängt am Profil — gemessen
  sichtbar in den Reserve-Dritteln (Abschnitt 5.2).
- **Klar gesagt:** Der Schlussgang-Nebenweg, der über ANTRITT bezahlt, ist ein Mischanteil
  (I-Spy-Muster A). Eine echte „andere Währung" (Fable 1.1) wäre er erst, wenn er Puste statt Zeit
  kostet — das tut er über den kubischen Verbrauch zwar, aber nicht mit einem eigenen
  Attributkanal.

---

## 4. Optionen mit Aufwand und Risiko

| Option | Inhalt | Klasse | Aufwand | rho-Risiko | Pp-Risiko | Wirkung aufs Zuschauen |
|---|---|---|---|---|---|---|
| **O1** | J1 allein | T | klein (Sortierung in `bauSpurt`, Isolationsnachweis) | keins (analytisch) | keins | groß: Hot Seat lebt, Ende dicht |
| **O2** | J1 + J2 | T + A | klein + mittel | keins | keins | **größte**: Kipppunkte 1 → 11 je Rennen |
| O3 | J2 allein | A | mittel | keins | keins | klein (1 Kipppunkt je Rennen) |
| O4 | P0 + J3 | B | mittel + mittel | klein (0,91–0,94 gemessen) | **hoch**, nur mit P0 | mittel: Manager-Entscheidung, Einbrüche als gewählte Wette |
| O5 | O2 + P0 + J3 + J4 | T + A + B | groß | klein | hoch | voll |

**Empfehlung: O2 vorschlagen** (Chris' Zustimmung zu J1 nötig), **P0 als nächste Rezeptrunde**
einplanen, J3/J4 danach. J2 ohne J1 lohnt sich kaum.

### 4.1 Bewusst nicht vorgeschlagen

- **Größere Startabstände für die letzten Starter** (real 2 statt 1 Minute). Das verlängert die
  Sendung und ist Klasse T in die andere Richtung. Mit J1 nicht nötig: Die Solo-Strecke sinkt
  ohnehin auf 2,2 s.
- **Paarstart wie im Eisschnelllauf.** Widerspricht „ich hätte gedacht dass jeder spieler einzeln
  startet" (Chris, 22.09.). Gemessen bringt eine paarweise aufsteigende Folge weniger als die
  reine Umkehr: Hot-Seat-Wechsel 2 statt 4, Solo-Strecke 8,0 statt 2,2 s.
- **Duell-Waage** (Teamzeit als laufende Summe der sechs Slot-Duelle). Nur 3 % der Duelle sind
  knapp (< 0,2 Sim-s). Die Waage wechselt in 22 % der Rennen überhaupt die Seite, und das letzte
  Duell kippt den Teamstand in 4 %. Die gewollte Spreizung des Feldes (Faktor ~2, rho-Schutz)
  macht Direktduelle einseitig.
- **Wind/Wetter, das sich während der Startfolge ändert.** Positionsbonus nach Startnummer, mit J1
  sogar systematisch an die Eignung gekoppelt (Fable 2.5).
- **„Ins Rote gehen" als Vorbedingung des Plan-Hebels.** Gemessen wirkungslos für Negativ-Split
  (Abschnitt 3.4). Als eigenes Feature („Attackierer brechen seltener ein") denkbar, aber dann mit
  dem Stamina-Pp-Risiko eines zweiten STEHEN-Kanals.

---

## 5. Offline-Diagnose (Scratch, kein Repo-Code)

Alle Zahlen: Kopie von `engine.js` (`68563962`, Motor identisch zu `eda92a77`), `disziplinProbe`
mit Kaderfamilie live-save (5 Paarungen), n = 24 Spiele je Paarung, 6 je Seite, wenn nicht anders
angegeben. rho je Spiel = Median der fünf Paarungsmittel, Spw = Spannweite. Pp über `einflussVon`
(n = 24, Standardkader, wie `scripts/messe-arena-einfluss.mjs`). Echte Sekunden =
Sim-Sekunden × `ZEIT_DEHNUNG["time-trial"]` 4,38.

**Kalibrierung:** Die Kopie misst ohne Planeingriff rho/Spiel **0,923** (Spw 0,067). Die
Stand-Doku führt 0,929 (Spw 0,072): gleiche Größenordnung, Abweichung innerhalb der Spannweite.
Pp ohne Eingriff **22,1** (Stand-Doku 22,8).

### 5.1 rho je Planbelegung

| Belegung | heute (kein Kick) | mit Schlussgang k4 | mit ANTRITT-Schlussgang k5 |
|---|---:|---:|---:|
| Slot-Pläne (heute) | 0,923 (Spw 0,067) | 0,929 (0,038) | 0,929 (0,036) |
| alle Gleichmaß | 0,940 (0,027) | 0,940 | 0,940 |
| alle Negativ-Split | 0,940 (0,027) | 0,938 | 0,941 |
| alle Attacke | 0,938 (0,028) | 0,938 | 0,938 |
| Orakel: jeder seinen besten Plan | 0,936 (0,031) | 0,936 | 0,936 |
| Orakel: jeder seinen schlechtesten | 0,940 (0,027) | 0,940 | 0,940 |
| Zufallsplan je Fahrer (30 Ziehungen) | 0,929 (0,925–0,935) | 0,931 | 0,931 |
| bösartig (obere Hälfte schlechtester, untere bester Plan) | **0,911** (0,103) | 0,919 (0,079) | — |

Kleinere Kader: 4 je Seite Slot 0,930 (Spw 0,122), bösartig 0,901, Star Top 2 98 %. 2 je Seite
0,950, Star Top 2 100 %.

### 5.2 Welcher Plan gewinnt (Anteil „bester Plan" je Fahrer und Rennen)

| Variante | Gleichmaß | Negativ | Attacke | bester → zweitbester (Sim-s, Median) |
|---|---:|---:|---:|---:|
| heute | 15 % | **0 %** | 85 % | 0,42 |
| Ins Rote 8 % / 15 % | 21 % | 0 % | 79 % | 0,40 |
| Ins Rote 8 % / 30 % | 33 % | 1 % | 66 % | 0,42 |
| Ins Rote 15 % / 30 % | 23 % | 0 % | 77 % | 0,37 |
| Ins Rote 15 % / 60 % | 31 % | 1 % | 69 % | 0,45 |
| Schlussgang k1 (+6 % ab 80 %, Plan sonst unverändert) | 12 % | 4 % | 84 % | 0,40 |
| Schlussgang k2 (+8 % ab 80 %, 0,92 bis 50 %) | 13 % | **18 %** | 69 % | 0,18 |
| k2 + Ins Rote 8 % / 30 % | 24 % | 11 % | 65 % | 0,18 |
| Schlussgang k4 (+10 % ab 85 %, 0,93 bis 45 %) | 14 % | **19 %** | 67 % | 0,13 |
| Schlussgang k5 (+14 % × ANTRITT/100 ab 85 %, 0,93 bis 45 %) | 13 % | **18 %** | 69 % | — |

Nach Reserve-Dritteln (heute): unten Gleichmaß 29 % / Attacke 71 %, Mitte und oben Attacke 92 %.
Mit k4: Mitte Negativ 27 %, unten Gleichmaß 28 % — die Planfrage wird zur Profilfrage.

### 5.3 Dramaturgie je Startfolge (Slot-Pläne, echte Sekunden)

| Kennzahl (Median, P90 in Klammern) | heute | Favorit zuletzt | Paare aufsteigend |
|---|---:|---:|---:|
| Rennen bis letzter Zieleinlauf | 94,8 (108,6) | 81,2 (86,1) | 92,5 (100,6) |
| Solo-Strecke am Schluss | 6,5 (12,6) | 2,2 (5,4) | 8,0 (18,5) |
| Hot-Seat-Wechsel | 0 (1) | 4 (6) | 2 (4) |
| letzte Hot-Seat-Übernahme, Anteil der Sendung | 0 (0,65) | 0,94 (1,00) | 0,82 (0,92) |
| längste Strecke ohne Ereignis (Start, ZZ1/ZZ2, Ziel) | 9,4 (13,5) | 5,1 (7,2) | 8,4 (18,5) |
| … mit grün/rot-Kipppunkten | 9,4 (13,5) | 4,5 (6,5) | 8,4 (18,5) |
| Kipppunkte je Rennen (Messpunkte alle 5 %) | 1 (4) | 11 (16) | 4 (8) |
| letzter Starter holt den Hot Seat | 0 % | 15 % | 1 % |

„Ereignis" = Start, Durchfahrt an ZZ1/ZZ2, Zieleinlauf. „Kipppunkt" = ein Fahrer wechselt an einem
Messpunkt zwischen schneller/langsamer als die Bestzeit im Feld an genau diesem Punkt. ZZ2 wurde
im 5-%-Raster mit 75 % statt 76 % genähert.

Duell-Waage (heutige Paare Heim-Slot i gegen Gast-Slot i): Führungswechsel im Duell im Mittel
0,30 je Duell, knapp (< 0,2 Sim-s) 3 %, Waage wechselt die Seite in 22 % der Rennen, letztes Duell
kippt 4 %.

### 5.4 Pp

Siehe Tabelle in Abschnitt 3.4. Baseline-Detail (Strom 0), gemessener Anteil gegen Matrix:

- Stamina 23,8 (15)
- Speed 20,5 (22)
- Dexterity 20,5 (25)
- Intelligence 19,1 (18)
- Awareness 13,2 (12)
- Power 2,3 (5)
- Torment 0,7 (3)

---

## 6. Klasse-Einordnung (ehrlich, von Chris zu bestätigen)

| Baustein | Klasse | Begründung |
|---|---|---|
| J1 Startfolge nach Eignung aufsteigend | **T** | ändert Wandzeit (Sendung ~14 s kürzer) und **wann** die Entscheidung fällt — Spielablauf. Simulation/rho unberührt, trotzdem T (Präzedenz D7/A4, Fechten-Format). **Nicht bauen ohne Chris' ausdrückliches Go.** |
| J2 Live-Ampel, stille Messpunkte, Kipppunkt-Ticker | A | reine Anzeige auf `u.zz`/`bahnZeit`, kein `rr()`, keine Dauer- oder Taktänderung. Stille Messpunkte als eigenes Feld, damit Endstand-Spalten und ZZ-Töne unverändert bleiben. |
| J2-Regie (Kamera auf Bestzeitkurs) | A | Kamera-Automatik, keine Zeitänderung. Mindestverweildauer nötig. |
| P0 Stamina-Pp-Runde | B | Rezept-/Haushaltskalibrierung wie der Elfte Nachtrag, Matrix unangetastet. |
| J3 Plan in Managerhand + Schlussgang | B | neue Mechanik in `tempoVon`/Verbrauch (Schlussgang) und Übergabe Plan je Fahrer aus der Einsatzliste. Fasst das Grundgerüst „Haltung" aus der Konsultation 02.10. an (Zeile 0). |
| J4 Funkregel an ZZ1 | B | bedingter `planWechsel()` in der Simulation, Informationsfrage offen. |

Kein Baustein greift an der Eignungsmatrix (`official-discipline-weights.ts`) — gesperrt und
unberührt.

---

## 7. Offene Fragen an Chris

1. **Startfolge (J1, Klasse T):** Darf im Zeitfahren der Schwächste zuerst und der Beste zuletzt
   starten, wie im echten Zeitfahren? Die Sendung wird dabei ~14 s kürzer, und die Entscheidung
   fällt am Ende. Varianten:
   - (a) alle zwölf nach Eignung aufsteigend;
   - (b) Heim/Gast weiter im Wechsel, innerhalb der Seite aufsteigend;
   - (c) nur die letzten vier Starter nach Eignung, der Rest wie heute.

   Gemessen ist (a). (b) und (c) wären vor dem Bau nachzumessen.
2. **Ampel (J2, Klasse A):** Soll sie nur zusammen mit J1 kommen? Meine Empfehlung: ja — ohne J1
   meldet sie im Median einen einzigen Kipppunkt je Rennen.
3. **Pp-Vorrunde (P0):** Einverstanden, dass vor jedem Plan-Hebel zuerst Stamina im Zeitfahren
   abgesenkt wird (heute 24 % statt 15 %, Pp 22,1/24,1 — der zweite Strom kratzt an der Schranke)?
4. **Schlussgang statt „Ins Rote":** Die Konsultation vom 02.10. nennt „Ins Rote gehen" als
   Vorbedingung. Gemessen belebt es Negativ-Split nicht, ein Schlussgang über 1,0 schon. Darf
   Negativ-Split auf den letzten Metern schneller als 100 % fahren (dafür teurer)?
5. **Plan als Manager-Entscheidung (J3):** Soll der Rennplan je Fahrer in die Einsatzliste, als
   „Haltung" Absichern/Normal/Angreifen = Gleichmaß/Negativ-Split/Attacke? Das ist dieselbe Frage
   wie Haltung gegen Intensität in der Konsultation vom 02.10. (Empfehlung 1 dort).
6. **Funk (J4):** Gewünscht? Wenn ja: gegen den Hot Seat vergleichen (spannender, gibt aber späten
   Startern einen Informationsvorteil) oder gegen die eigene Sollzeit (fair, weniger dramatisch)?

---

## 8. Prüfweg, falls Chris Ja sagt

1. **J1:** Sortierung in `bauSpurt` hinter `art.zeitfahren`, `formTag`-Ziehung unverändert in
   `setz()`-Reihenfolge. Isolationsnachweis `node scripts/miss-alle-disziplinen.mjs 24` (alle
   zwanzig, nur Time-Trial darf sich bewegen, Erwartung: innerhalb Tick-Quantisierung).
   Sichtprüfung Hot Seat/Geist/Teamsieg-Ansage.
2. **J2:** eigenes Feld für stille Messpunkte, Ampel im Fokus-Panel, Kipppunkt-Zeilen im Ticker.
   Nachweis bit-identisch (`miss-alle-disziplinen.mjs 24 time-trial` vorher/nachher gleich),
   Ticker-Dichte gegen das Audit-Zielband messen.
3. **P0:** `node scripts/messe-arena-einfluss.mjs time-trial 24` in zwei Strömen
   (`--saat-versatz=10000000`), Ziel ≤ 18. Danach rho kaderfest n = 24/48.
4. **J3:** Schlussgang-Feld nur in `BAHN_ART["time-trial"]` (ungesetzt wirkungslos). Plan-Sonde
   mit Kaderfamilie (Dominanz ≤ 60 % als Ziel), rho kaderfest bei 6/4/2 je Seite, bösartige
   Belegung als Extremfall. Pp zwei Ströme mit KI-Vorgabe **und** mit „alle Attacke"
   (Designregel 5 der Konsultation).
5. **J4:** erst nach J3. Regelauslösung im Ticker sichtbar, Informationsfrage (Frage 6) vorher
   entschieden.

---

## Anhang A — Scratch-Sonde (nicht Teil dieses PRs)

Die Sonde lief auf einer **Kopie** von `public/mockups/battle-mode.{html,css,rezepte.js,engine.js}`
in einem Scratch-Verzeichnis, geladen per Playwright mit dem Chromium unter `/opt/pw-browsers`
(wie `scripts/miss-alle-disziplinen.mjs`). In der Kopie standen fünf Haken. Jeder ist ohne
gesetztes `window.__tt*` wirkungslos (bit-identisch, Kalibrierung oben):

```js
// bauSpurt, nach KRAFT_VON: Protokoll + feinere Messpunkte + Plan je Fahrer
if(window.__ttZZ)art.zwischenzeiten=window.__ttZZ; if(window.__ttLog)window.__ttLog.push(L);
if(window.__ttPlanKI&&art.zeitfahren){const pk=window.__ttPlanKI(L,sl); if(pk&&P[pk])Object.assign(L,{plan:pk,...P[pk]});}
// tempoVon und Verbrauch: planT/ueber ueber __ttPlanT(u) — Schlussgang fuer Negativ-Split
//   ab K.ab2 und nicht leer: 1 + (K.kSkill ? K.k*u[K.kSkill]/100 : K.k), sonst wie heute
// stepSpurt: Ins Rote — in der Schlusszone darf u.reserve bis -tiefe*STEHEN/100*reserveMax
//   fallen, `leer` greift erst dort
// bahnLauf: Ansagen auch fuer seite 1 (fuer Plan-Sonden beider Teams)
```

Vorgehen:
- **Je Plan p** lief `disziplinProbe` einmal mit allen Fahrern auf p. Weil kein Fahrer einen
  anderen beeinflusst und Pläne kein `rr()` verbrauchen (Formkarten- und Tagesform-Ziehung sind
  identisch), ist die Zeit jedes Fahrers unter jedem Plan **exakt**. Daraus entstanden alle
  Szenarien in 5.1/5.2 sowie die Startfolgen in 5.3 (Zielzeit = neue Startzeit + eigene Laufzeit,
  ohne Tick-Quantisierung).
- **Pp** über `einflussVon` mit gesetztem `__ttPlanKI`/`__ttKick`.

Nicht gemessen: J4 (nur Schranke über Orakel/bösartig), die Startfolge-Varianten (b)/(c), der
Effekt der Ampel auf die Pixel-Standbild-Quote des Audits.

## Quellen

- [BikeRadar: 2026 Tour de France stage 16 time trial start times](https://www.bikeradar.com/news/2026-tour-de-france-stage-16-time-trial-start-times)
- [Cyclingnews: Tour de France stage 13 time trial start times](https://www.cyclingnews.com/news/tour-de-france-stage-13-time-trial-start-times/)
- [Rouleur: What it's like being in the time-trial hot seat](https://rouleur.cc/blogs/the-rouleur-journal/what-it-s-like-being-in-the-time-trial-hot-seat)
- [Domestique Cycling: Van der Poel hot seat, Tour de Suisse](https://www.domestiquecycling.com/en/news/philippe-gilbert-backs-mathieu-van-der-poels-tour-de-suisse-fine-he-had-plenty-of-time-to-put-a-jersey-on/)
- [SMT: new features for time trial stages, NBC Tour de France](https://smt.com/smt-delivers-new-features-for-time-trial-stages-for-nbc-sports-tour-de-france/) und [Teil 2](https://smt.com/smt-delivers-new-features-for-time-trial-stages-for-nbc-sports-tour-de-france-2)
- [AP/Washington Times: Evans set to become 1st Aussie to win Tour (2011)](https://www.washingtontimes.com/news/2011/jul/23/cadel-evans-set-become-1st-aussie-win-tour/)
- [Cycling Weekly: Evans blows Schleck away in final TT](https://www.cyclingweekly.com/news/racing/tour-de-france/evans-blows-schleck-away-in-final-tt-and-takes-yellow-to-paris-49929)
- [AP/News4Jax: Pogacar crushes Roglic (2020)](https://www.news4jax.com/sports/2020/09/19/pogacar-crushes-roglic-to-take-grip-on-tour-de-france-title/)
- [Tour-Magazin: Stage 16 time trial duel Vingegaard/Pogacar](https://www.tour-magazin.de/en/professional-cycling/latest-news/stage-16-time-trial-duel-between-vingegaard-and-pogacar/), [bikeraceinfo 2023 Etappe 16](https://bikeraceinfo.com/tdf/2023-TDF-Daily/tdf2023-Daily-stage-16.html)
- [FIS Broadcaster Manual Alpine 21/22](https://assets.fis-ski.com/image/upload/v1657790589/fis-prod/assets/FIS_Broadcaster_Manual_AL_2122.pdf)
- [Swiss Timing: Virtual Runner](https://www.swisstiming.com/services/broadcast-solutions/virtual-runner)
- [ISU: Speed skating rules explained](https://isu-skating.com/news/speed-skating-rules-explained/)
- [Cycling West: Pace Yourself!](https://www.cyclingwest.com/fitness/coaching/pace-yourself/), [ctyeh.com: TT pacing](https://ctyeh.com/articles/6371?lang=en)
- [Rowe & King: W′ guide](https://roweandking.com/w′-w-prime-or-functional-reserve-capacity-a-concise-guide/), [Sports Medicine 2017: Critical Power](https://link.springer.com/article/10.1007/s40279-017-0688-0)
- [Velon: rider data system](https://www.velon.cc/velon-rider-data-system), [Infront: Realtime rider data Tour de Suisse](https://www.infront.sport/news/sports-technology/realtime-rider-data-shown-live-on-tv-and-made-available-through-a-new-mobile-app-at-the-tour-de-suisse)
- Projektintern: `manager-risiko-interaktivitaet-konzept-02-10.md`, `fable-ideen-bahn-30-09.md`,
  `bahn-disziplinen-opus-konzeptreview-26-09.md`, `zeitfahren-recherche-06-09.md`,
  `bahn-paket3-zwei-waehrungen-spezifikation-03-10.md`, `f1-broadcast-audit-runde-2-30-09.md`,
  `broadcast-d7-a4-fable-empfehlung-02-10.md`, `stand-aller-disziplinen.md` (Elfter Nachtrag).
