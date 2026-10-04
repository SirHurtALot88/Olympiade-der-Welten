# Spurt-Nachtkonzept (03.10.) — „Die Säule muss laufen"

**Reine Konzeptrunde, kein Code geändert, kein Verhaltens-PR.** Auftrag aus Chris' Nachtbestellung
vom 03.10. („bei den anderen event poors bitte heute über die nacht auch konzepte ausarbeiten …
denk gern um die ecke, hol infos aus dem internet und probier dich aus"), aufbauend auf seiner
Grundfrage vom 02.10. („wie man mit einfachen methoden das spiel etwas interaktiver gestalten kann
und das auch nen gewissen impact haben kann — mehr risiko führt dazu dass jemand sich evtl übertrifft
oder unter dem druck oder gewicht einbricht").

Spurt ist Nummer 7 der neun ereignisarmen Disziplinen aus
`docs/design/manager-risiko-interaktivitaet-konzept-02-10.md` (PR #1118): „bis 19 s Stille. Das
Feld klebt als Säule an einem Hindernis, der Rest leer." Der Hebel dort (Zeile 5 der Tabelle):
„Angreifen senkt die Schwelle für Durchbruch-per-Wucht statt Ausweichen (kostet Puste). Gehört zu
#29." Die Spezifikation zu #29 liegt seit PR #1136 vor
(`docs/design/bahn-paket3-zwei-waehrungen-spezifikation-03-10.md`, Spurt-Teil: Drei Parcours 3.1
bzw. Schleife-oder-Durchbruch 3.2), gebaut ist davon nichts.

**Bindender Rahmen (CLAUDE.md), für alles unten:** Die Eignungsmatrix
(`lib/player-generator/official-discipline-weights.ts`) bleibt unangetastet. rho je Einzelspiel
muss über 0,80 bleiben und hat Vorrang vor Pp. Pp-Abweichung ≤ 25 ist Pflichtprüfung. „Mehrere
Wege zum Erfolg" wird mitgedacht. **Alles, was Sendezeit oder Spielablauf verändert, ist Klasse T
und braucht Chris' ausdrückliche Zustimmung — es wird hier nur beschrieben, nie gebaut.**

`engine.js` meint `public/mockups/battle-mode.engine.js`, Stand `main` `68563962` (am Motor seither
unverändert, geprüft gegen `eda92a77`).

### Klassenschema (wie in den Geschwister-Nachtkonzepten vom 03.10.)

| Klasse | Bedeutung | Braucht |
|---|---|---|
| **A** | reine Anzeige: kein `rr()`, kein neues Sim-Feld, `wert()`/Rezept unangetastet, rho bit-identisch | Sichtprüfung |
| **A\*** | Anzeige mit eigener Buchhaltung (Zweitrechnung über bereits feststehende Werte), Ergebnis unverändert | Nachweis, dass die Zufallskette nicht berührt wird |
| **B** | echte Mechanik in `stepSpurt`/`tempoVon`/`BAHN_ART.spurt` | Chris' Zustimmung, Prototyp, kaderfeste Messung |
| **C** | Mechanik, die eine Design-Entscheidung von Chris voraussetzt (Regel des Sports im Spiel) | Chris' Entscheidung vor dem Bau |
| **T** | greift in Sendezeit/Wandzeit/Spielablauf ein | **nur Chris persönlich, ausdrücklich** |
| **M** | Manager-/Saisonzustand (Aufstellung, Anweisung, Haltung) | Chris' Zustimmung, Persistenz |

---

## 0. Kurzfassung

1. **Die Säule ist gemessen, nicht nur gesehen — und sie hat eine einzige Ursache im Code.** Jede
   Station ist ein **Vollstopp**: `tempoVon()` multipliziert mit `(u.huerde>0 ? 0 : 1)`. Bei
   Zeitdehnung 11,14 (`ZEIT_DEHNUNG.spurt`) wird aus 0,5–1,7 Sim-Sekunden Stopp ein 6–19 Sekunden
   langes Standbild. Mit echten Kadern (Kader-Familie aus dem live-save, 120 Rennen) steht jeder
   Läufer **39 % seiner Rennzeit**. In **21 %** der Rennzeit steht mindestens das halbe Feld an
   **einer** Station. Die längste Säule dauert im Schnitt **14 s Sendezeit**, höchstens 21 s. Das
   sind die 19 s aus dem Audit vom 30.09.
2. **Der zweite, wichtigere Befund: Der Positionskampf passiert im Stand.** 78 % aller Platzwechsel
   (37,5 von 48,4 je Rennen) fallen *zwischen* „kommt an der Station an" und „ist 3 % dahinter".
   Er findet unsichtbar in der stehenden Säule statt und wird erst beim Losrennen aufgedeckt.
   Ski-Cross-Kursbauer *wollen* eine Ballung, aber als Neustart mit Überholmanövern
   (FIS: „slow them down twice to bring the pack together. Then we almost start the race afresh").
   **Das Problem ist also nicht die Ballung, sondern dass sie steht und nichts zeigt.**
3. **Kernidee: S-N1 „Die Joker-Station" (Klasse B + M), nach dem Rallycross-Joker.** Jeder
   Läufer muss **genau einmal** statt einer Station eine sichtbare Umlaufschleife laufen
   (dieselbe Schleife, die Opus' SP-P2 ohnehin braucht). **Wo** er sie nimmt, entscheidet der
   Manager (sonst die KI: an der eigenen schwächsten Station). Die Reihenfolge auf der Bahn lügt,
   bis alle ihren Joker gefahren haben; das ist Spannung aus Rechnung, nicht aus Zufall.
   Am Wiedereinfädelpunkt entsteht der Positionskampf, den man sieht.
   Gemessen (Joker 8 % der Strecke): rho/Spiel **0,903** (Basis 0,880), Saison **0,972** (0,939),
   Pp **23,5 / 19,5** an zwei Saatstämmen (Basis 19,2 / 15,4). Das ist die beste rho-Zahl dieser
   Runde, Pp bleibt an beiden Stämmen unter der Schranke, aber Power verliert konstant 5 Punkte.
   **Die Wahl hat Gewicht:** Wer an seiner *stärksten* statt an der schwächsten Station jokert,
   fällt auf rho 0,871 und Saison 0,891 zurück. Das ist der „Impact", den Chris für eine
   Manager-Entscheidung verlangt.
4. **S-N2 „Die Station als Bewegung" (Klasse B, Präsentationsmechanik):** Kein Vollstopp mehr,
   sondern Kriechen über das Hindernis mit 25 % Tempo, Stopp entsprechend länger. Damit ist der
   Zeitpreis identisch. Die Säule verschwindet (0 % Stehzeit), Platzwechsel verteilen sich
   gleichmäßig (24 an, 27 zwischen den Stationen statt 38/11). Mit nachskalierter Puste-Gutschrift
   am Hindernis: rho 0,891, Pp 17,8, Restpuste 24 % statt 14 %. Ohne Nachskalierung bindet die
   Puste nicht mehr (32 % Rest).
5. **Empfohlenes Paket: Joker 8 % + Station als Bewegung.** rho/Spiel **0,907**, Saison 0,964,
   Pp **16,1 / 12,5** an zwei Saatstämmen (Basis 19,2 / 15,4), Säule **0 %**, Restpuste 18 %.
   Das ist die beste Zahl in allen drei Abnahmen zugleich. Der Power-Verlust des Jokers allein
   (−5) verschwindet dabei (−1,5 / −1,8).
6. **S-N3 „Haltung am Hindernis" (Klasse M + B), Chris' Risiko-Idee:** Angreifen heißt kürzerer
   Stopp, höheres Sturzrisiko, längerer Sturz. Absichern heißt das Gegenteil. Alle auf Angreifen:
   rho 0,890, Pp 20,4, längste Stille 19 s statt 24 s. **Die KI-Vorgabe darf nicht an TECHNIK
   hängen** (gemessen Pp 37,7, Dexterity +12,7), **und auch nicht an ROBUST** (rho 0,826, Pp 33,4,
   Health +8,6). Jede profilbasierte Regel verstärkt den Kanal, den sie liest. Die KI-Vorgabe muss
   deshalb situativ sein („Angreifen bei Rückstand", Muster 02.10. Befund B). Das ist nicht
   gemessen.
7. **S-N4 „Die letzte Hürde" (Klasse B, eine Datenzeile):** Leere Puste senkt das Gelingen an der
   Station (`pusteHindernis`, existiert im Motor, im Spurt ungesetzt). 400-m-Hürden-Physiologie.
   rho 0,878 (neutral), Pp 16,1 / 18,8 an zwei Saatstämmen (Basis 19,2 / 15,4, also **neutral**),
   mehr Stürze hinten, längste Stille 22 s statt 24 s.
8. **Gemessen und verworfen:** freier Umweg an jeder Station (wird an 79–81 von 84 Stationen
   genommen, Pp 46–47, rho 0,80–0,83) und versetzte Stationen je Bahn (Säule 19 % statt 21 %,
   wirkungslos).
9. **Klasse T, nur dokumentiert:** die Zeitdehnung während eines Stopps zu senken wäre der
   direkteste Hebel gegen das Standbild. Er ändert aber die Sendezeit, deshalb entscheidet das
   Chris. Kopf-an-Kopf-Läufe wie im UIPM-Obstacle ebenso.

---

## 1. Problemrahmen — was Spurt heute ist

### 1.1 Was der Code tut

- **Strecke:** sieben Stationen in festem Raster `hindernisse:[0.14,0.26,0.38,0.50,0.62,0.74,0.86]`
  (`engine.js` `BAHN_ART.spurt`), Typen T/Wd/W/W/Wd/W/T (Hürde, Balken, Palisade, Seil,
  Wassergraben, Mauer, Strohballen). Massenstart, 6 je Seite, 12 Bahnen.
- **Jede Station kostet einen Zeitpreis, und dieser Preis ist ein Stillstand:**
  `u.huerde = huerdePreis(1,45) × (WUCHT ? 1,4 : 1) × (1 − 0,8 × Skill/100)`, und in `tempoVon()`
  steht `*(u.huerde>0?0:1)`. Ein Läufer mit Skill 20 steht 1,22 s (an einer Kraftstation 1,70 s),
  einer mit Skill 80 steht 0,52 s (0,73 s). Danach würfelt TECHNIK, sonst WUCHT (Durchbruch), sonst
  Sturz (`stolper`, Tempo ×0,35).
- **Am Hindernis gibt es volle Puste-Gutschrift** (`ruhe=u.huerde>0?1:…`) und nur 40 % Verbrauch.
  Die Station ist also Zeitpreis und Atempause zugleich. Das wird für S-N1 und S-N2 wichtig.
- **Ticker:** Ein sauberer Sprung erzeugt keine Zeile (außer „seine Falle" bei klarer Stärke), ein
  Durchbruch nur eine Routinezeile (`feedRoutine`, im sichtbaren Ticker gedrosselt). Sichtbar
  bleiben Sturz, Einbruch, Rempler, Führungswechsel.
- **Zeitdehnung:** `ZEIT_DEHNUNG.spurt = 11,14`. Eine Sim-Sekunde ist elf Sekunden Sendung.

### 1.2 Gemessen: die Säule

Eigene Szenen-Sonde (Scratch, Abschnitt 4), echte Kader (fünf Paarungen aus
`data/generated/kaderfamilie-live-save.json`, je 24 Saaten, 120 Rennen), unveränderte Mechanik:

| Größe | Basis |
|---|---:|
| Renndauer (Sim / Sendung) | 19,9 s / ~221 s |
| Anteil der Läuferzeit im Stillstand | **39,1 %** |
| Rennzeit, in der ≥ halbes Feld an **einer** Station steht | **20,9 %** |
| längste Säule je Rennen, Mittel (Sendung) | 1,25 s (**~14 s**), max. 1,85 s (~21 s) |
| Platzwechsel **an** Stationen (Messpunkt 2 % davor bis 3 % dahinter) | **37,5** |
| Platzwechsel **zwischen** Stationen | 10,9 |
| Sieger ≠ Führender vor der letzten Station | 14 % |
| sichtbare Ereignisse je Rennen (Sturz, Einbruch, Fangen, Rempler, Führungswechsel) | 32,3 |
| längste Lücke zwischen zwei sichtbaren Ereignissen, Mittel (Sendung) | 2,13 s (**~24 s**), max. 3,57 s |
| Rest-Puste im Ziel | 14 % |

Die Messung trifft den Audit-Befund (19 s völlige Stille, „Feld als Säule") unabhängig davon:
längste Säule ~14–21 s, längste Ereignislücke ~24 s.

### 1.3 Was das heißt — zwei getrennte Probleme

1. **Das Bild steht.** Massenstart plus erste Station bei 14 % heißt: Das Feld kommt fast
   gleichzeitig an Station 1 an und friert dort ein, je nach Können 6–19 s Sendezeit lang. Danach
   zieht es sich auseinander, aber an jeder weiteren Station steht wieder ein Teil.
2. **Das, was entscheidet, sieht man nicht.** Wer an der Station 0,5 s statt 1,2 s steht, hat
   gewonnen. Gezeigt wird aber nur, dass alle stehen. Der Positionskampf passiert im Stand
   (78 % der Platzwechsel) und ist für den Zuschauer erst beim Losrennen zu sehen, als Sprung im
   Klassement.

Das erste Problem ist eines der Darstellung (und der Zeitdehnung). Das zweite ist eines der
Mechanik: Es gibt an der Station keine **sichtbare Entscheidung** und keinen **sichtbaren zweiten
Weg**. Beide Lücken schließen die Konzepte unten getrennt. So kann Chris einzeln zustimmen.

---

## 2. Recherche — was echte Hindernisrennen beim Zuschauen spannend macht

Netzsuche am 03./04.10. nachts. Zitate wörtlich (englisch), Einordnung dahinter. Wo ich eine
Seite selbst geöffnet habe, steht das Zitat aus der Seite. Wo ich nur den Auszug der Suchmaschine
kenne (Volltext nicht erreichbar oder nicht lesbar, z. B. das UIPM-Regel-PDF), steht „über die
Suchergebnisse" dabei.

### 2.1 110 m Hürden: das Hindernis kostet Zeit, aber niemand bleibt stehen

> „ten hurdles of 106.7 centimetres (42 in) in height are evenly spaced along a straight course"
> — „the first hurdle is placed after a run-up of 13.72 metres" — „The next nine hurdles are set
> at a distance of 9.14 metres" — „the home stretch from the last hurdle to the finish line is
> 14.02 metres" — „both men and women take 3 steps (meaning 4 foot strikes) between each hurdle"
> — „They are positioned so that they will fall over if bumped into by the runner. Fallen hurdles
> do not carry a fixed time penalty for the runners, but they have a significant pull-over weight
> which slows down the run."
> ([Wikipedia, 110 metres hurdles](https://en.wikipedia.org/wiki/110_metres_hurdles))

**Was sich überträgt:** Unser Raster (erste Station bei 14 %, dann alle 12 %, letzte bei 86 %,
14 % Auslauf) ist erstaunlich nah am echten Hürdensprint (12,5 % Anlauf, 8,3 % Abstand, 12,7 %
Auslauf). Das Raster ist also nicht das Problem. **Das Problem ist der Stillstand:** Im echten
Hürdenlauf kostet jede Hürde Zeit *in der Bewegung* („pull-over weight", Rhythmusbruch), bei uns
friert die Figur ein (`tempoVon()`: `u.huerde>0 ? 0`).

### 2.2 400 m Hürden: die Rennen entscheiden sich an den letzten Hürden, wenn der Rhythmus bricht

> „Most 400 hurdlers know how many steps they are going to take in between each hurdle." —
> „However, fatigue from the race will knock athletes off their stride pattern and force them to
> switch legs." — Warholm „switched from 13 to 15 steps in his final three hurdles" — die
> Disziplin verlangt „anaerobic endurance over the final 150 to 100 metres of the race as, at this
> point, lactate will accumulate in the body."
> ([Wikipedia, 400 metres hurdles](https://en.wikipedia.org/wiki/400_metres_hurdles))

Eine Studie zur Renneinteilung (Journal of Human Kinetics, über die Suchergebnisse, Volltext war
beim Abruf nicht erreichbar) fasst zusammen: „The number of steps between hurdles 8 and 9 predicted
78% of the overall stride pattern variations", schwächere Läufer wechseln stufenweise auf 16/17
Schritte ([JHK, Pacing Strategy in Men's 400 m Hurdles](https://jhk.termedia.pl/Pacing-Strategy-in-Men-s-400-m-Hurdles-Accounting-for-Temporal-and-Spatial-Characteristics,158610,0,2.html)).

**Was sich überträgt:** Das „cooked"-Bild — wer leer ist, trifft die letzte Hürde. Bei uns ist
die Puste seit SP-P1 knapp (Rest im Ziel 14 %), aber sie wirkt **nicht** auf das Gelingen an der
Station (`pusteHindernis` ist im Spurt ungesetzt, nur Takeshi/Climbing lesen es). Dazu die
berühmten Stürze an der letzten Hürde: Omar McLeod, WM 2019, „struck the penultimate hurdle and off
balance clattered into the last, crashing to the floor"
([Jamaica Observer](https://jamaicaobserver.com/2019/10/02/doha2019-usas-grant-holloway-takes-110-hurdles-as-mcleod-crashes-out)).

### 2.3 3000 m Hindernis: Wassergraben vor der Tribüne, das Feld zieht sich über die Runden

> „A 3000 metres steeplechase is defined in the rulebook as having 28 barriers and seven water
> jumps." — „the steeplechase was increasingly seen as a spectator sport, with route planning
> considering where the spectators will view the race"
> ([Wikipedia, Steeplechase (athletics)](https://en.wikipedia.org/wiki/Steeplechase_(athletics)))

Über die Suchergebnisse: der Wassergraben „is directly in front of the grandstand", dort passieren
„principal accidents", und die meisten Stürze in den Graben passieren „on the second pass"
([Butler Collegian](https://thebutlercollegian.com/?p=10202),
[MileSplit Fotostrecke](https://co.milesplit.com/articles/130155/photo-story-taking-the-plunge-at-great-southwest)).

**Was sich überträgt:** Ein Hindernis wird gezielt dort gestellt, wo man hinschaut, und wird mit
zunehmender Müdigkeit gefährlicher. Bei uns ist der Wassergraben Station 5 (62 %), mit eigener
Sturz-Caption — die einzige Station mit Bühne.

### 2.4 Ski Cross: Ballungen sind gewollt — aber als Neustart, nicht als Standbild

> „The course should have features which promote overtaking and yield a significant number of
> changes in position, known as rank shifts." — „The goal is to create as many rank shifts as
> possible and have a photo finish at the line" — „We have to slow them down twice to bring the
> pack together. Then we almost start the race afresh and this is where we create overtaking
> manoeuvres and rank shifts most of the time." — „After one weekend of racing they know exactly
> where to overtake and which is the fastest line … As a result, they take greater risks."
> ([FIS, The appliance of science to ski cross](https://fis-ski.com/inside-fis/news/2024-25/the-appliance-of-science-to-ski-cross))

**Das ist der wichtigste Fund dieser Recherche, und er dreht die Frage um.** Ein Kursbauer im
Ski Cross *will*, dass sich das Feld an einer Stelle ballt — weil es danach neu losgeht und dort
überholt wird. Das Problem unserer Säule ist nicht die Ballung. Es ist, dass die Ballung **steht**
und dass der Positionskampf, den sie auslöst, **im Stand** passiert: Gemessen (Abschnitt 1.2)
finden 78 % aller Platzwechsel innerhalb der Station statt, unsichtbar, und werden erst beim
Losrennen aufgedeckt.

### 2.5 Rallycross: der Joker — eine Pflicht-Abkürzung, die die Reihenfolge verschleiert

> „In many series, like the FIA World Rallycross Championship, a joker lap must be completed at
> least once." — „This is done by driving an extended section of the circuit which can serve to
> separate or regroup the cars." — „It adds a tactical element to the racing as having a clearer
> track may allow for faster driving as an alternative to overtaking, or the re-join point adds
> risk of contact or an entertaining battle for position."
> ([Wikipedia, Rallycross](https://en.wikipedia.org/wiki/Rallycross))

**Was sich überträgt — die Kernidee dieses Papiers (Abschnitt 3.1):** Jeder muss genau einmal den
anderen Weg nehmen, und *wann* er das tut, ist seine Entscheidung. Die Reihenfolge auf der Strecke
lügt deshalb, solange nicht alle ihren Joker gefahren haben — das ist Spannung, die aus der
Rechnung kommt, nicht aus Zufall.

### 2.6 Spartan Race, Ninja Warrior, UIPM-Obstacle: der Nebenweg als Regel

- **Spartan (seit 2023):** „Instead of performing burpees as a penalty for a failed obstacle, a
  penalty loop constructed at every obstacle must be run if a racer cannot complete that particular
  obstacle. The standard penalty loop is 200 meters" (nach den Suchergebnissen zum
  [Spartan-Regelwerk 2023](https://shop.spartan.com/blogs/unbreakable-race-stories/2023-spartan-race-rulebook)).
  Elite-Läufer scheitern selten — die Schleife ist eine Strafe, keine Taktik. Opus' SP-P2 bildet
  genau das ab.
- **American Ninja Warrior, Mega Wall:** „The Mega Wall was next to the original 14'6" warped
  wall, and gave competitors the choice of which to climb. Competitors who chose the Mega Wall had
  only one attempt to reach the top" — wer scheitert, hat danach nur noch einen Versuch an der
  normalen Wand ([Wikipedia, ANW Staffel 10](https://en.wikipedia.org/wiki/American_Ninja_Warrior_season_10)).
  Das ist Chris' Risiko-Satz als Fernsehregel: zwei Wege nebeneinander, der höhere bringt mehr und
  kann alles kosten.
- **UIPM-Obstacle (Moderner Fünfkampf, ab 2025):** „Obstacle features athletes competing head to
  head over a 70m course featuring eight obstacles" (Suchergebnis-Auszug,
  [UIPM](https://www.uipmworld.org/node/195791); das Regel-PDF war beim Abruf nicht als Text
  lesbar). Der Weltverband hat für sein neues Hindernisformat **Kopf-an-Kopf-Läufe zu zweit**
  gewählt, nicht ein Massenstartfeld.

### 2.7 Fotofinish und Mehrkampf

- Paris 2024, 100 m: Lyles gewann mit 0,005 s Vorsprung; er „waited with his seven fellow runners
  for a call on the wildly tight race" ([NBC](https://www.nbcchicago.com/paris-2024-summer-olympics/see-noah-lyles-win-mens-100m-in-wild-photo-finish-by-just-005-of-a-second/)).
  Die Spannung liegt in der *angehaltenen* Sekunde nach der Linie — dieselbe Beobachtung wie
  Hawk-Eye im Tennis-Nachtkonzept.
- World Athletics/Sony 2026: Sprint-Entscheidungen werden als 3D-Grafik nachgebaut, „transforming
  split-second performances into dynamic visual storytelling"
  ([World Athletics](https://worldathletics.org/competitions/world-athletics-ultimate-championship/2026/news/press-releases/sony-broadcast-innovation-ultimate-championship)).
- Zehnkampf: zehn Teilwertungen werden über Punktetabellen vergleichbar gemacht und ergeben eine
  Gesamtgeschichte, die mit dem 1500-m-Lauf endet
  ([Wikipedia, Decathlon](https://en.wikipedia.org/wiki/Decathlon)). Für den Spurt heißt das: Die
  sieben Stationen sind sieben kleine Teilwertungen, und die Sendung erzählt sie heute nicht als
  solche (die Stationsstatistik SP-2 zählt nur sauber/durch/Sturz).

---

## 3. Die Konzepte

### 3.1 S-N1 — Die Joker-Station (Klasse B + M, Aufwand mittel) — **Kernidee**

**Was.** Jeder Läufer muss in jedem Rennen **genau einmal** statt einer Station eine
**Umlaufschleife** laufen: ein Bogen neben der Station, sichtbar als zweite Spur, Länge X % der
Strecke (gemessen: 8 % und 11 %). Auf der Schleife gibt es keinen Stopp, keinen Wurf und keinen
Sturz. Er läuft mit seinem normalen Tempo und zahlt dabei normalen Puste-Verbrauch, ohne die
Atempause, die die Station gewährt hätte.

- **Primärweg** bleibt die Station (natives Attribut: TECHNIK, WENDIGKEIT oder WUCHT je Typ).
- **Nebenweg** ist der Joker: Er liest Laufen (ANTRITT/ENDTEMPO, also Speed/Will/Determination)
  und zahlt in der **anderen Währung**, nämlich Puste statt Standzeit. Das ist Fable 1.1
  („Zwei Währungen") in der Form, die schon im Motor steckt, denn die Station *ist* heute die
  Atempause.
- **Wo** der Joker genommen wird, ist eine **Entscheidung**:
  - KI-Vorgabe (gemessen): an der Station mit dem teuersten eigenen Stopp; bei Gleichstand die
    späteste. Damit liegen die Joker überwiegend bei 62–86 % der Strecke, also im letzten
    Drittel.
  - Manager-Anweisung (Klasse M): „Joker an Station 3", „Joker an der Mauer" oder „Joker so spät
    wie möglich". Eine Zeile je Läufer in der Einsatzliste, sonst KI.

**Warum gerade das gegen die Säule hilft, obwohl es sie nicht wegräumt.** Der Joker löst Problem 2
(Abschnitt 1.3), nicht Problem 1. Er macht aus jeder Station, an der jemand jokert, eine
**Gabelung mit Wiedervereinigung**: Einer steht an der Wand, einer läuft außen herum, und am
Wiedereinfädelpunkt sieht man, wer vorn ist. Genau das ist der Moment, den Rallycross mit dem
Joker erzeugt („the re-join point adds risk of contact or an entertaining battle for position").
Dazu kommt die Klassement-Spannung: Wer seinen Joker noch vor sich hat, liegt *virtuell* weiter
hinten, als er läuft. Die Grafik kann „Platz 2 · Joker offen" zeigen (S-N5), und der Zuschauer
rechnet mit.

**Mehrere Wege zum Erfolg.** Der schnelle Läufer mit schwacher Kraftstation (Speed 18 ist die
höchste Einzelzahl der Spurt-Matrix, Opus 2b.2: „hat an den Stationen keinen Weg, seinen Vorteil
einzusetzen") bekommt einen Ort, an dem Speed an einer Station zählt. Der Turner verliert an
seiner schwächsten Station weniger. Der Zähe (STEHEN) kann den Joker spät nehmen, wenn andere
die Atempause der Station dringender brauchen. Damit hat jedes Profil eine eigene richtige
Antwort, und das ist die Prüffrage 2 aus dem Opus-Review (0.4).

**Abgrenzung zu den vorhandenen Specs.**
- *SP-P2 Strafschleife (Opus 26.09.):* die Schleife als Folge des Scheiterns. Der Joker benutzt
  **dieselbe Geometrie** (eine Schleifenspur je Station, ein Asset), aber als Pflicht und Wahl
  statt als Strafe. Beide vertragen sich: Die Schleife nach einem Scheitern kann die Joker-Spur
  sein, die dann nicht mehr als Joker zählt.
- *3.2 Schleife-oder-Durchbruch nach Puste (Fable 30.09.):* entscheidet je Station nach Zustand.
  Gemessen (Abschnitt 4.2, „freier Umweg"): **Ein Nebenweg ohne Kontingent wird fast überall
  genommen und tötet den Hindernis-Kanal** (Pp 46–47). Der Joker ist die Kontingent-Lösung:
  einmal, nicht siebenmal.
- *3.1 Drei Parcours:* unabhängig, beide lassen sich kombinieren. Beim Sprinterkurs würde der
  Joker besonders in der dichten Kette wirken.
- *02.10. „Durchbruch-per-Wucht statt Ausweichen":* ein Würfelschwellen-Hebel an der Station.
  S-N3 unten ist seine gemessene Verfeinerung. Der Joker ist ein anderer, deterministischer Hebel.

**rho/Pp (Abschnitt 4).** Bei Joker-Länge 8 % der Strecke:

- rho/Spiel 0,903 (Basis 0,880, Spannweite 0,143 gegen 0,154).
- Saison 0,972 gegen 0,939. Das ist der größte Validitätsgewinn dieser Runde.
- Pp 23,5 und 19,5 an zwei Saatstämmen.

Bei 11 % liegt rho bei 0,899 und Pp bei 25,1, also knapp über der Schranke. Der Joker sollte
deshalb eher kürzer als länger sein. Wo der Pp-Preis herkommt: Power verliert an beiden Stämmen
~5 Punkte (5 % gegen Matrix 10), weil die teuerste eigene Station wegen `wuchtPreisFaktor 1,4`
überdurchschnittlich oft eine Kraftstation ist. Der Joker überspringt also bevorzugt genau den
Ort, an dem Power zahlt. Abhilfe, falls nötig: Joker an Kraftstationen verbieten (Frage 3). Das
ist nicht gemessen.

**Warum rho steigt, nicht fällt:** Der Joker ersetzt für jeden Läufer den Stopp mit dem höchsten
Sturzrisiko (schwächster Typ) durch eine deterministische Laufstrecke. Das ist derselbe Effekt,
den Opus für SP-P2 vorhergesagt hat (weniger großer Einzelwurf), nur einmal je Läufer statt
bei jedem Scheitern. Die Gegenprobe zeigt es: Jokert jeder an seiner **stärksten** Station,
nimmt man ihm den billigsten Stopp weg und lässt den riskanten stehen. rho fällt dann auf 0,871,
Saison auf 0,891.

**Bau, grob.** `jokerLaenge` in `BAHN_ART.spurt` (ungesetzt wirkungslos). An der Station: Ist
`hIdx===u.jokerIdx`, wird statt Stopp/Wurf `u.umwegRest=jokerLaenge` gesetzt. In `stepSpurt`
fließt der Fortschritt zuerst in den Umweg, die Figur wird auf der Schleifenspur gezeichnet.
`u.jokerIdx` kommt aus der Anweisung oder der KI-Regel. Kein `rr()`, deterministisch. Der Scratch-
Prototyp dieser Runde ist rund 25 Zeilen lang.

**Für Chris:** (1) Pflicht-Joker einmal je Rennen, ja/nein? (2) Darf der Manager die Station
wählen (Klasse M, Einsatzliste), oder bleibt es KI? (3) Soll die Schleife an Kraftstationen
verboten sein (Pp-Schutz für Power, s. „rho/Pp“ oben; im Paket mit S-N2 nicht mehr nötig)?

### 3.2 S-N2 — Die Station als Bewegung (Klasse B, Aufwand klein–mittel) — **löst die Säule**

**Was.** Statt Vollstopp kriecht der Läufer mit Anteil k seines Tempos über das Hindernis, und die
Stoppdauer wird mit 1/(1−k) verlängert. Der Zeitverlust bleibt damit **rechnerisch identisch**
(gemessen mit k = 0,25). Im Bild steigt die Figur über die Wand, balanciert über den Balken und
hangelt am Seil. Sie steht nicht.

**Gemessen:** Stillstand 39 % → **0 %**, Säulenzeit 21 % → **0 %**. Die Platzwechsel verteilen
sich (an Stationen 23,8, zwischen Stationen 27,1, vorher 37,5/10,9). Das heißt, die Positionen
ändern sich sichtbar *in Bewegung*. rho 0,896 (Basis 0,880, innerhalb der Spannweite 0,15), Saison
0,964, Pp 20,0.

**Die Nebenwirkung, ehrlich:** Rest-Puste im Ziel steigt von 14 % auf **32 %**, Einbrüche fallen
von 3,5 auf 0,55 je Rennen. Grund: Die Station gewährt volle Puste-Gutschrift, solange
`u.huerde>0` ist, und das dauert jetzt 1/(1−k) länger. Damit ist die SP-P1-Bindung (Opus 26.09.,
PR #1035) halb aufgehoben. Die längste Ereignislücke wird sogar länger (~29 s statt ~24 s), weil
die Einbrüche als Ereignisse fehlen. **Deshalb wird die Gutschrift am Hindernis mit (1−k)
skaliert**, damit je Station dieselbe Puste zurückkommt wie heute. Gemessen: rho 0,891, Saison
0,965, Pp 17,8, Restpuste 24 % (ein Rest bleibt, weil der verminderte Verbrauch ×0,4 am Hindernis
jetzt ebenfalls länger läuft; eine zweite Stellschraube beim Bau). Einbrüche 1,2 je Rennen statt
3,5.

**Zusammen mit dem Joker (empfohlenes Paket):** rho/Spiel **0,907** (Spannweite 0,148), Saison
0,964 (Spannweite nur 0,072), Pp **16,1 / 12,5** an zwei Saatstämmen, Säule 0 %, Restpuste 18 %.
Der Power-Verlust, den der Joker allein bringt (−5), schrumpft auf −1,5 / −1,8. Eine
mechanische Erklärung dafür habe ich nicht geprüft, die Zahl ist gemessen, nicht hergeleitet.

**Was die Ereignislücke nicht zeigt:** Die Sonde zählt als „sichtbares Ereignis" nur, was einen
Tickereintrag auslöst (Sturz, Einbruch, Fangen, Rempler, Führungswechsel). Mit S-N2 werden die
Platzwechsel selbst zum Bildereignis (25 je Rennen zwischen den Stationen statt 11), ohne dass
der Ticker es merkt. Die längste Ticker-Lücke steigt deshalb auf ~28 s, obwohl das Bild nie mehr
steht. Das gehört zusammen mit S-N5 gelöst (Ticker für Stationsduell und saubere Station).

**Warum B und nicht A:** Die Figur bewegt sich in der Simulation tatsächlich weiter (`u.pos`), das
verschiebt Sog- und Rempler-Fenster. Eine reine Zeichen-Lösung (Klasse A: Figur animiert über das
Hindernis, `u.pos` bleibt stehen) wäre die billigere Alternative. Sie löst aber nur das
Standbild, nicht die Platzwechsel im Stand.

### 3.3 S-N3 — Haltung am Hindernis: Angreifen / Normal / Absichern (Klasse M + B, Aufwand klein)

**Was.** Chris' Risiko-Satz auf die Station übertragen, als die im 02.10.-Dokument vorgeschlagene
zweite Achse „Haltung" (neben der Intensität). Gemessene Parameter:

| Haltung | Stoppdauer | Gelingen TECHNIK | Sturzdauer |
|---|---:|---:|---:|
| Angreifen („volles Tempo in die Hürde") | ×0,80 | −15 Pp | ×1,3 |
| Normal | ×1 | ±0 | ×1 |
| Absichern („abbremsen, sauber setzen") | ×1,15 | +8 Pp | ×1 |

Das ist die Ninja-Warrior-Mega-Wall-Logik: Der höhere Weg bringt mehr und kann mehr kosten.

**Gemessen:**
- **Alle Angreifen** (Extremfall-Pflicht aus der 02.10.-Designregel 5): rho 0,890, Pp 20,4. Mehr
  sichtbare Ereignisse (40 statt 32, vor allem Stürze 21,6 statt 15,7), längste Lücke ~19 s statt
  ~24 s, Säulenzeit 16 % statt 21 %. Die Sendung wird dichter, ohne dass rho leidet.
- **KI-Vorgabe nach TECHNIK** (Angreifen ab 58, Absichern unter 42): rho 0,917, aber **Pp 37,7**
  (Dexterity 24,7 % gegen Matrix 12). Wer TECHNIK hat, bekommt zusätzlich den kürzeren Stopp, und
  das verstärkt denselben Kanal doppelt. **Verworfen in dieser Form.**
- **KI-Vorgabe nach ROBUST** (Gegenprobe: „wer Stürze wegsteckt, darf riskieren"): rho 0,826,
  Saison 0,879, **Pp 33,4** (Health +8,6, Determination −7,1). Auch verworfen.
- **Lehre aus beiden:** Eine KI-Regel, die die Haltung aus einem Sub-Skill ableitet, legt einen
  zweiten Kanal auf genau diesen Sub-Skill. Die Vorgabe muss **situativ** sein, nicht
  profilbasiert, zum Beispiel „Angreifen, wenn er an der Station hinter seinem direkten Gegner
  ankommt; Absichern, wenn er führt". Das ist die bedingte Anweisung aus Befund B des
  02.10.-Dokuments und sieht im Ticker so aus: „Anweisung greift: X geht volles Risiko an der
  Mauer". Nicht gemessen; das ist der erste Messauftrag, falls Chris S-N3 will.
- **Kombination Joker + letzte Hürde + Haltung-KI nach ROBUST:** rho 0,866, Pp 35,4. Getragen
  von der Haltungsregel, also kein eigenständiger Befund.

**Designregel 3 aus dem 02.10.-Dokument („Kein Knopf darf immer besser sein"):** Mit den gemessenen
Zahlen ist Angreifen noch zu billig, denn die Sendung wird dichter und die Rennen kürzer
(18,3 s statt 19,9 s). Vor dem Bau gehört eine Plan-Sonde dazu (Muster Opus-Review Anhang A): Je
Läufer und Haltung zeigen, welche besser gewesen wäre. Ziel wie bei TT-P1: Keine Haltung ist für
mehr als 60 % der Läufer richtig.

**Für Chris:** Soll die Haltung eine eigene Achse neben der Intensität werden (offene Frage 1 des
02.10.-Dokuments)? Wenn ja, ist Spurt nach Gewichtheben und den Bühnen ein guter dritter Kandidat,
weil der Prototyp bereits steht.

### 3.4 S-N4 — Die letzte Hürde (Klasse B, Aufwand klein, eine Datenzeile)

**Was.** `pusteHindernis` existiert im Motor (Takeshi liest es) und ist im Spurt ungesetzt.
Gesetzt auf 0,25 je Stationstyp heißt das: Wer leer ist, verliert an der Station bis zu ~8 Pp
Gelingen (bei Stufe 1 mal Leer-Anteil). Das ist das 400-m-Hürden-Bild aus der Recherche („fatigue
from the race will knock athletes off their stride pattern") und McLeods Sturz an der letzten
Hürde. Die Wirkung liegt automatisch hinten, weil die Puste erst dort knapp ist.

**Gemessen:** rho 0,878 (Basis 0,880), Saison 0,939, Pp 16,1 / 18,8 an zwei Saatstämmen (Basis
19,2 / 15,4). Im Mittel 17,5 gegen 17,3, also **neutral**. Der erste Stamm allein hätte eine
Verbesserung vorgetäuscht; genau dafür ist die Zwei-Stamm-Pflicht da. Stürze 18,1 statt 15,7,
längste Lücke ~22 s statt ~24 s.

**Für Chris:** kleinster und sicherster Schritt dieser Runde. Kein neuer Code, nur eine Zeile in
`BAHN_ART.spurt`. Er macht die letzten Stationen gefährlicher für die, die sich verausgabt haben.
Er löst die Säule nicht, gibt der Puste aber eine sichtbare Folge an der Station: Der Zuschauer
sieht, *warum* einer an der Mauer hängenbleibt.

### 3.5 S-N5 — Anzeigen, die die Station erzählen (Klasse A / A\*)

Reine Darstellung, auch ohne S-N1 bis S-N4 sinnvoll:

- **Stationsduell-Einblendung (A):** Kommen zwei Gegner (Heim/Gast) innerhalb von 0,03 Strecke an
  dieselbe Station, zeigt eine kleine Tafel beider Stopp-Restzeiten als Balken. Daraus wird
  „wer kommt zuerst los?". Damit wird der Positionskampf im Stand (78 % der Platzwechsel) sichtbar.
  Liest nur `u.huerde`.
- **Joker-Klassement (A\*, nur mit S-N1):** „Platz 2 · Joker offen (≈ +0,6 s)". Die Schätzung ist
  `jokerLaenge×strecke/u.v` minus seinem erwarteten Stopp an der Joker-Station, über bereits
  feststehende Werte.
- **Ticker für die saubere Station (A):** Heute erzeugt ein sauberer Sprung keine Zeile. Eine
  gedrosselte Zeile „X fliegt über die Palisade — schnellste Zeit an Station 3" (Stationsbestzeit
  aus `u.hindernisZeit`, die schon gebucht wird) füllt Stillen mit dem, was tatsächlich passiert.
- **Fotofinish-Lupe (A):** Der mittlere Abstand zwischen Platz 1 und 2 liegt bei 1,4 s. Bei
  Abständen unter 0,1 s (selten) gehört ein Standbild mit Ziellinie und „0,04 s" dazu (Paris 2024:
  0,005 s). Eine angehaltene Sekunde nach der Linie ist eine *Darstellungs*-Pause, keine
  Simulationspause, gehört aber wegen der Wandzeit vorsichtshalber zu den Fragen an Chris.

### 3.6 Gemessen und verworfen

- **Freier Umweg an jeder Station** (Gabelung ohne Kontingent, Entscheidung nach erwarteter Zeit):
  Bei Umweglänge 3 / 4,5 / 6 % wird er an 81 / 79 / — von 84 Stationen genommen. Die Hindernisse
  verschwinden praktisch, rho 0,803 / — / 0,826, Pp 47,3 / — / 46,0 (Power und Awareness auf
  ~0 %, Will +12,8). Einbrüche verdoppeln sich, denn ohne Station gibt es keine Atempause. Die
  zweite Währung wirkt also, aber der Hindernis-Kanal stirbt. Die Lehre daraus ist der Joker.
- **Versetzte Stationen je Bahn** (Diagonale statt Säule, 0,006 je Bahn): Säulenzeit 19 % statt
  21 %, rho 0,859, Pp 19. Das Feld wechselt ohnehin die Bahn, deshalb ist die Diagonale kaum zu
  sehen. Wirkungslos.

### 3.7 Nur zur Kenntnis — Klasse T, nicht gebaut, nicht empfohlen ohne Chris

- **Zeitdehnung an der Station senken.** Der direkteste Hebel gegen das Standbild: Solange mehr
  als die Hälfte des Feldes steht, läuft die Sendeuhr schneller (z. B. 11,14 → 5). Die Säule würde
  von ~14 s auf ~6 s Sendezeit schrumpfen. Das ändert die Wandzeit und ist deshalb ausdrücklich
  Chris' Entscheidung.
- **Kopf-an-Kopf-Läufe statt Massenstart** (UIPM-Obstacle: „head to head over a 70m course
  featuring eight obstacles"). Sechs Duelle Heim-Slot i gegen Gast-Slot i, nacheinander oder auf
  geteilten Bahnen. Ändert Spielablauf und Sendezeit grundlegend, deshalb nur als Denkanstoß.
- **Gestaffelter Start in zwei Wellen.** Entzerrt Station 1, ist aber ein Positionsvorteil nach
  Startnummer (Validitätsrisiko, Opus TT-P4-Begründung) und ändert den Ablauf.

---

## 4. Das Experiment — grobe Verträglichkeitsschätzung

### 4.1 Methode

Alles außerhalb des Repos, im Scratch-Verzeichnis dieser Sitzung:

- Kopie von `public/mockups/` und den Messskripten. Die Motor-Kopie bekommt Versuchsschalter, die
  nur `window.__SPURTEXP` lesen und nur bei `BA().spurt` wirken. Ohne Schalter ist die Kopie
  verhaltensgleich (Kontrolle: rho 0,880 vor und nach dem Patch, ziffernidentisch).
- **rho:** `miss-alle-disziplinen.mjs 24 spurt`, kaderfest (fünf Paarungen aus dem live-save,
  Median und Spannweite).
- **Pp:** `messe-arena-einfluss.mjs spurt 24` für jede Variante. Für Basis, Joker 8 % und die
  letzte Hürde zusätzlich am zweiten Saatstamm (`--saat-versatz=10000000`).
- **Szene:** eigene Sonde `spurtSzene(saat, kader)`. Ein Rennen headless mit 1/60-Ticks, dieselbe
  Kader-Familie, 24 Saaten je Paarung (120 Rennen). Gemessen werden Stillstand, Säule
  (≥ halbes Feld an einer Station), Platzwechsel an Messpunkten 2 % vor und 3 % hinter jeder
  Station, sichtbare Ereignisse aus Zustandsdifferenzen und die längste Lücke dazwischen.
  Sendezeit = Sim-Zeit × 11,14.

### 4.2 Ergebnisse

Szenen-Sonde: 120 Rennen je Variante (fünf Kaderpaarungen × 24 Saaten). rho kaderfest n = 24 je
Paarung, Median (Spannweite). Pp n = 24, Stamm 1 (/ Stamm 2, wo gefahren). Sendezeit = Sim × 11,14.

| Variante | rho/Spiel | rho Saison | Pp | Stillstand | Säulenzeit | längste Säule | Platzwechsel an / zwischen Stationen | Sieger ≠ Führender vor letzter Station | sichtbare Ereignisse | längste Ticker-Lücke | Restpuste |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **Basis** | 0,880 (0,154) | 0,939 | 19,2 / 15,4 | 39,1 % | 20,9 % | ~14 s | 37,5 / 10,9 | 14 % | 32,3 | ~24 s | 14 % |
| freier Umweg 3 % | 0,803 (0,143) | 0,811 | 47,3 | 0,2 % | 0 % | — | 17,4 / 14,6 | 8 % | 19,1 | ~39 s | 11 % |
| freier Umweg 4,5 % | n. g.¹ | n. g.¹ | n. g.¹ | 0,9 % | 0 % | — | 20,1 / 13,7 | 18 % | 27,9 | ~35 s | 9 % |
| freier Umweg 6 % | 0,826 (0,155) | 0,865 | 46,0 | n. g.¹ | | | | | | | |
| versetzte Stationen | 0,859 (0,165) | 0,939 | 19,0 | 40,3 % | 19,3 % | ~13 s | (73,9 / 54,9)² | 13 % | 31,4 | ~25 s | 16 % |
| S-N2 Kriechen k = 0,25 | 0,896 (0,147) | 0,964 | 20,0 | **0 %** | **0 %** | — | 23,8 / 27,1 | 9 % | 24,4 | ~29 s | 32 % |
| S-N2 Kriechen + Gutschrift skaliert | 0,891 (0,148) | 0,965 | 17,8 | **0 %** | **0 %** | — | 23,8 / 27,2 | 9 % | 25,4 | ~28 s | 24 % |
| S-N4 letzte Hürde | 0,878 (0,152) | 0,939 | 16,1 / 18,8 | 39,0 % | 20,9 % | ~14 s | 37,3 / 11,1 | 13 % | 35,0 | ~22 s | 14 % |
| S-N3 alle Angreifen | 0,890 (0,121) | 0,924 | 20,4 | 33,7 % | 16,2 % | ~11 s | 34,7 / 12,4 | 10 % | **40,0** | **~19 s** | 12 % |
| S-N3 KI nach TECHNIK | 0,917 (0,214) | 0,939 | **37,7** | 38,1 % | 12,0 % | ~11 s | 29,6 / 8,2 | 6 % | 36,4 | ~22 s | 13 % |
| S-N3 KI nach ROBUST | 0,826 (0,147) | 0,879 | **33,4** | 38,3 % | 15,5 % | ~13 s | 34,0 / 10,1 | 10 % | 34,6 | ~24 s | 13 % |
| S-N1 Joker 8 % (schwächste Station) | 0,903 (0,143) | **0,972** | 23,5 / 19,5 | 32,4 % | 18,3 % | ~14 s | 35,0 / 11,4 | 9 % | 33,4 | ~24 s | 11 % |
| S-N1 Joker 11 % | 0,899 (0,163) | 0,964 | 25,1 | 31,7 % | 17,6 % | ~14 s | 35,8 / 11,2 | 13 % | 35,5 | ~24 s | 10 % |
| Gegenprobe: Joker 8 % an der *stärksten* Station | 0,871 (0,147) | 0,891 | 18,4 | 35,2 % | 16,7 % | ~13 s | 39,8 / 11,0 | 10 % | 33,0 | ~24 s | 13 % |
| Joker 8 % + letzte Hürde + KI nach ROBUST | 0,866 (0,155) | 0,951 | 35,4 | 31,6 % | 14,5 % | ~13 s | 32,6 / 10,5 | 13 % | 38,2 | ~22 s | 10 % |
| **Paket: Joker 8 % + Kriechen (Gutschrift skaliert)** | **0,907 (0,148)** | 0,964 | **16,1 / 12,5** | **0 %** | **0 %** | — | 23,2 / 25,1 | **4 %** | 25,8 | ~28 s | 18 % |

¹ n. g. = nicht gemessen: Bei Umweg 4,5 % fehlen rho/Pp im Protokoll, bei 6 % brach die
Szenen-Sonde ab (Browser-Kontext geschlossen). Für die Lehre (Abschnitt 3.6) reichen die
Nachbarwerte.
² Artefakt: Bei versetzten Stationen liegen die Messpunkte je Bahn an anderer Stelle als die
Station, die Zahl misst deshalb nicht dasselbe wie in den anderen Zeilen.

Lesart: Die Spannweite der Basis über die fünf Kaderpaarungen beträgt 0,154. Jede rho-Bewegung
unter ~0,05 ist von Null nicht unterscheidbar (`messgrundlage-kaderfest.md`). Alle Varianten außer
dem freien Umweg bleiben klar über 0,80.

### 4.3 Was die Tabelle über die Mechanik sagt

1. **Die Säule hat genau eine Ursache, und S-N2 beseitigt sie ohne rho-Kosten.** Nur die Varianten
   ohne Vollstopp (Kriechen, freier Umweg) bringen Stillstand und Säule auf null. Alle anderen
   (Joker, Haltung, letzte Hürde, Versatz) verkürzen die Säule nur um wenige Prozentpunkte.
2. **Ein Nebenweg braucht ein Kontingent.** Frei wählbar wird er überall genommen (≈ 80 von 84
   Stationen), und der Hindernis-Kanal stirbt (Pp 46–47, Power/Awareness ~0 %). Einmal je
   Rennen (Joker) hebt er rho und vor allem die Saison-Validität (0,972). Die Mehrwege-Leitlinie
   funktioniert also. Der zweite Weg muss aber knapp sein, damit der erste der Primärweg bleibt.
3. **Wo gejokert wird, entscheidet über die Validität.** Schwächste Station: Saison 0,972. Stärkste
   Station: 0,891. Eine Manager-Entscheidung mit echtem, messbarem Einfluss, ohne Zufall. Ein
   schlecht beratener Manager verliert, und das ist gewollt.
4. **Profilbasierte KI-Haltungen verfälschen die Matrix.** Beide gemessenen Regeln (TECHNIK,
   ROBUST) reißen Pp über 30. Das gilt vermutlich für jede Disziplin, die eine Haltung aus einem
   Sub-Skill ableitet, und ist ein Hinweis für das Haltungs-Grundgerüst aller Disziplinen
   (02.10.-Dokument Zeile 0): **Die KI-Vorgabe muss am Rennzustand hängen, nicht am Profil.**
5. **Der Preis des Pakets: weniger späte Wendungen.** Mit Joker + Kriechen ist der Führende vor der
   letzten Station nur noch in 4 % der Rennen nicht der Sieger (Basis 14 %). Das Rennen wird
   gerechter und bildstärker, aber hinten weniger offen. S-N4 (letzte Hürde) wirkt genau dort
   und ist Pp-neutral. Das Dreierpaket ist der naheliegende nächste Messauftrag, in dieser Runde
   aber nicht gemessen.
6. **Kein Konzept verlängert die Rennzeit nennenswert** (alle 18–21 Sim-s gegen 19,9 s). Die
   Sendezeit bleibt also ungefähr gleich, und keines der B-Konzepte rutscht über die Hintertür in
   Klasse T.

---

## 5. Klassen, Risiken, Reihenfolge

| # | Konzept | Klasse | Aufwand | rho (Basis 0,880) | Pp (Basis 19,2) | größtes Risiko |
|---|---|---|---|---:|---:|---|
| S-N4 | Die letzte Hürde | B | klein (1 Zeile) | 0,878 | 16,1 / 18,8 | kaum; macht späte Stürze häufiger |
| S-N5 | Anzeigen (Stationsduell, Ticker, Fotofinish) | A / A\* | klein | bit-identisch | — | Fotofinish-Standbild berührt Wandzeit, s. Frage 6 |
| S-N1 | Joker-Station | B + M | mittel | 0,903 | 23,5 / 19,5 | allein Pp knapp (Power −5); im Paket mit S-N2 behoben |
| S-N3 | Haltung am Hindernis | M + B | klein (Prototyp steht) | 0,890 (alle an) | 20,4 (alle an) | KI-Regel darf TECHNIK nicht verstärken; Angreifen noch zu billig |
| S-N2 | Station als Bewegung | B | klein–mittel | 0,891 | 17,8 | Puste-Gutschrift muss mitskaliert werden (gemessen), Rest 24 % |
| **S-N1 + S-N2** | **Paket** | B + M | mittel | **0,907** | **16,1 / 12,5** | weniger späte Wendungen (4 % statt 14 %) |
| — | Zeitdehnung an Station, Duelle, Wellenstart | **T** | — | — | — | Sendezeit/Ablauf, nur Chris |

**Empfohlene Reihenfolge:**
1. **S-N5** (Klasse A, keine Zustimmung nötig außer der Sichtprüfung): Stationsduell-Tafel und
   Ticker für die saubere Station. Das macht sofort sichtbar, was heute im Stand passiert.
2. **S-N2** (Station als Bewegung, mit skalierter Gutschrift). Löst die Säule, rho/Pp neutral bis
   besser. Wenn Chris nur einem B-Konzept zustimmen will, dann diesem.
3. **S-N1** (Joker) auf S-N2 aufgesetzt, als Paket gemessen: die beste Zahl in allen drei
   Abnahmen und die Manager-Entscheidung mit Gewicht.
4. **S-N4** (letzte Hürde) als dritte Messung auf dem Paket, für die späten Wendungen.
5. **S-N3** (Haltung) erst mit dem Haltungs-Grundgerüst aller Disziplinen und mit einer
   situativen KI-Regel. In der gemessenen Form ist sie nicht abnahmefähig.

**Messpflicht beim Bau, je Schritt einzeln** („nie zwei Eingriffe in einer Messung", Fable 30.09.
Abschnitt 7): rho kaderfest n = 24 (bei knapper Marge 48), Pp an zwei Saatstämmen
(`--saat-versatz=10000000`), Isolationsnachweis über alle zwanzig, bei 2 je Seite Star in den
ersten zwei und Paartreue (≥ 15 Punkte) statt nacktem rho.

---

## 6. Offene Fragen und Entscheidungen für Chris

1. **Joker (S-N1):** Soll jeder Läufer einmal je Rennen die Schleife statt einer Station laufen
   müssen?
2. **Joker-Wahl:** Entscheidet der Manager, an welcher Station gejokert wird (eine Zeile je Läufer
   in der Einsatzliste), oder immer die KI (schwächste Station, so spät wie möglich)?
3. **Haltung (S-N3):** eigene Achse „Angreifen/Normal/Absichern" neben der Intensität — gilt die
   Antwort aus dem 02.10.-Dokument auch für Spurt?
4. **Die letzte Hürde (S-N4):** Darf leere Puste das Gelingen an der Station senken? Das ist der
   kleinste Schritt dieser Runde und verbessert Pp.
5. **Station als Bewegung (S-N2):** Soll die Figur über das Hindernis klettern statt einzufrieren
   (Zeitpreis gleich, Puste-Gutschrift mitskaliert)? Oder reicht eine reine Zeichen-Lösung
   (Klasse A), die nur das Standbild behebt und die Platzwechsel im Stand lässt?
6. **Klasse T:** Darf die Sendeuhr schneller laufen, solange das halbe Feld an einer Station steht?
   Und darf es nach einem knappen Zieleinlauf eine angehaltene Fotofinish-Sekunde geben?

---

## 7. Was dieses Papier nicht tut

- Kein Code in `engine.js`, `BAHN_ART.spurt`, `lib/` oder `scripts/` geändert. Die Prototypen
  liegen ausschließlich im Scratch-Verzeichnis dieser Sitzung.
- Keine Entscheidung zwischen den Konzepten getroffen. Keine Kalibrierung über die genannten
  Einzelwerte hinaus (z. B. Joker 8 %/11 %, Haltung ×0,80/−15 Pp).
- Nicht gemessen: das Dreierpaket S-N1 + S-N2 + S-N4; S-N3 mit situativer KI-Regel; der Joker
  mit Kraftstations-Verbot; alle Varianten bei 2 und 4 je Seite (nur 6 je Seite); Star/Paartreue; Isolationsnachweis über alle zwanzig (die Schalter wirken in der Kopie nur
  bei `BA().spurt`); die Plan-/Haltungs-Sonde („welche Haltung wäre richtig gewesen").
- Wandzeit-Wirkung nur hochgerechnet (Sim × 11,14), nicht im Browser bei Tempo 1× abgetastet.

---

## Quellen

Netz (abgerufen 03./04.10.2026):
- Wikipedia: [110 metres hurdles](https://en.wikipedia.org/wiki/110_metres_hurdles),
  [400 metres hurdles](https://en.wikipedia.org/wiki/400_metres_hurdles),
  [Steeplechase (athletics)](https://en.wikipedia.org/wiki/Steeplechase_(athletics)),
  [Rallycross](https://en.wikipedia.org/wiki/Rallycross),
  [American Ninja Warrior season 10](https://en.wikipedia.org/wiki/American_Ninja_Warrior_season_10),
  [Decathlon](https://en.wikipedia.org/wiki/Decathlon)
- FIS: [The appliance of science to ski cross](https://fis-ski.com/inside-fis/news/2024-25/the-appliance-of-science-to-ski-cross)
- Journal of Human Kinetics: [Pacing Strategy in Men's 400 m Hurdles](https://jhk.termedia.pl/Pacing-Strategy-in-Men-s-400-m-Hurdles-Accounting-for-Temporal-and-Spatial-Characteristics,158610,0,2.html) (über die Suchergebnisse, Volltext beim Abruf 503)
- Jamaica Observer: [Holloway takes 110 hurdles as McLeod crashes out (Doha 2019)](https://jamaicaobserver.com/2019/10/02/doha2019-usas-grant-holloway-takes-110-hurdles-as-mcleod-crashes-out)
- [Butler Collegian, Steeplechase](https://thebutlercollegian.com/?p=10202), [MileSplit, Taking the plunge](https://co.milesplit.com/articles/130155/photo-story-taking-the-plunge-at-great-southwest) (über die Suchergebnisse)
- Spartan: [2023 Spartan Race Rulebook](https://shop.spartan.com/blogs/unbreakable-race-stories/2023-spartan-race-rulebook) (über die Suchergebnisse)
- UIPM: [Obstacle](https://www.uipmworld.org/node/195791) (über die Suchergebnisse; Regel-PDF nicht als Text lesbar)
- NBC: [Lyles wins 100m by 0.005 s](https://www.nbcchicago.com/paris-2024-summer-olympics/see-noah-lyles-win-mens-100m-in-wild-photo-finish-by-just-005-of-a-second/)
- World Athletics: [Sony broadcast innovation, Ultimate Championship 2026](https://worldathletics.org/competitions/world-athletics-ultimate-championship/2026/news/press-releases/sony-broadcast-innovation-ultimate-championship)

Repo: `docs/design/manager-risiko-interaktivitaet-konzept-02-10.md` (PR #1118, Spurt-Zeile und
Designregeln 1–5), `docs/design/bahn-paket3-zwei-waehrungen-spezifikation-03-10.md` (PR #1136),
`docs/design/fable-ideen-bahn-30-09.md` (1.1 Zwei Währungen, 1.2 Ins Rote gehen, 3.1–3.5),
`docs/design/bahn-disziplinen-opus-konzeptreview-26-09.md` (0.1–0.4, 2a–2c, SP-P1–P3),
`docs/design/f1-broadcast-audit-runde-2-30-09.md` (3.5, 3.6, 6.1, 6.2),
`docs/design/spurt-modellierung-recherche-05-09.md`, `docs/design/spurt-offene-fragen-plus-optik-plan-05-09.md`,
`docs/design/messgrundlage-kaderfest.md`; `engine.js`: `BAHN_ART.spurt`, `tempoVon()`, `stepSpurt()`
(Hindernis-Block, Puste-Gutschrift, `pusteHindernis`), `ZEIT_DEHNUNG`, `bahnLauf()`, `feed()`/`feedRoutine()`.
