# Broadcast-Optik für Arena (TDM, Mini-DM, Battlefield) und I-Spy — Esport- und Escape-Room-Vorbilder (27.09.)

**Reine Recherche und Konzept. Kein Code, keine Konstante, kein Rezept, keine Matrix angefasst.**
Stand: `origin/main` `ebb3b99a` (27.09.). `engine.js` meint `public/mockups/battle-mode.engine.js`,
Zeilen nach diesem Stand.

Schließt eine Lücke, die zwei Vorgänger bewusst offen gelassen haben:

* `docs/design/broadcast-praesentation-runde-2-22-09.md` („Runde 2") behandelt den Kampf nur in
  zwei Zeilen (Highlight-Schwelle, „Arenarand in Farbe der Seite mit mehr Restleben") und I-Spy
  nur als einen von fünf Bühnen-Auftritten.
* `docs/design/ui-bewegungs-audit-26-09.md` deckt die drei Kampf-Disziplinen und I-Spy
  ausdrücklich nicht ab.

Diese Runde behandelt die vier Disziplinen als das, was sie der Form nach sind: **Esport bzw.
Spielshow, nicht klassischer Sport.** Die Vorbilder sind deshalb Counter-Strike, Valorant und
Overwatch für die Arena, The Crystal Maze, Legends of the Hidden Temple und Games Done Quick für
I-Spy.

---

## 0. Fazit vorweg

### 0.1 Leitplanke: nichts kaschieren

Die drei Arena-Disziplinen haben echte Strukturprobleme, gemessen und dokumentiert:

* **rho durchgefallen.** TDM 0,326, Mini-DM 0,427, Battlefield 0,403 je Spiel (Commit `ac38f6fb`,
  nach dem TDM-Respawn). Validität 0,27–0,52 gegen 0,92–0,96 bei Basketball und Hockey
  (`arena-minigames-opus-konzeptreview-26-09.md`, Abschnitt 2.1, Branch
  `arena-minigames-konzeptreview-26-09`).
* **Pp massiv verletzt.** Mini-DM 115, Battlefield 54, TDM 51,4 (`stand-aller-disziplinen.md`,
  Zwölfter Nachtrag).
* **Vermutetes Speicherleck** im Team-Kampf-Loop (Cgroup-OOM bei ~13,6 GB, ebenda).

**Nichts in diesem Dokument repariert davon etwas, und nichts darf so gebaut werden, dass es
davon ablenkt.** Das heißt konkret:

1. **Keine Bewertungsgrafik auf dem rollenblinden Maßstab.** Kein „MVP", kein „Spieler des Spiels",
   keine Sterne und keine Rangliste im Bild, die aus `beitragVon()` (`engine.js:24528`) kommen.
   Genau dieser Maßstab ist laut Konzeptreview ein Teil des Problems. Eine Broadcast-Grafik, die
   ihn groß ins Bild hebt, würde ein falsches Urteil schöner aussehen lassen.
2. **Die Spalte „Leist" bleibt sichtbar.** Sie ist heute die ehrlichste Anzeige der Arena: Sie
   zeigt, wo jemand unter seiner Eignung bleibt (`leistungVon`, `:24553`). Ein Broadcast-Umbau
   darf sie nicht aus dem Blick schieben.
3. **Grafiken zeigen Ereignisse, keine Urteile.** Killfeed, Überzahl-Anzeige und Respawn-Uhr
   berichten, *was* passiert ist. Sie machen die eignungsfremden Kanäle (erster Ausfall,
   Heiler-Handicap, „Ecken-Lotterie") eher sichtbarer als unsichtbarer. Das ist erwünscht.
4. **Kein neuer Zustand im Messpfad.** Alles, was mitschreibt (Killfeed-Liste, Replay-Puffer,
   Zähler), hängt an `feed()`/`draw()` oder prüft `stumm` (`:23048`). Die Sonden
   (`serieVon`, `disziplinProbe`, `einflussVon`) laufen stumm (`stepSimStumm`, `:23922`), und
   genau dort ist das OOM aufgetreten. Eine Anzeige, die im stummen Pfad Listen füllt, würde
   das Leck-Problem verschlimmern und die Diagnose verwischen.
5. **Keine Anzeige setzt Gewicht auf Mechanik, die nichts entscheidet.** Die Battlefield-
   Domination entscheidet 0 von 120 Spielen. Eine große Kontrollpunkt-Grafik würde eine
   Bedeutung vortäuschen, die der Punkt nicht hat. Deshalb bleibt sie klein, bis P3 des
   Konzeptreviews (Tickets, Respawn) entschieden ist.

### 0.2 Drei Klassen von Eingriff

| Klasse | Heißt | Abnahme |
|---|---|---|
| **A — nur Anzeige** | liest vorhandenen Zustand, schreibt nur in Canvas/DOM oder in `viz*`-Felder | `miss-alle-disziplinen.mjs 24 <d>` bit-identisch |
| **S — Anzeige mit Sim-Haken** | eine Zeile im Sim-Code (`schalteAus`, `nahschlag`, `stepSim`), die nur einen Wert für die Anzeige *weiterreicht*. Kein `rr()`, kein Wert fließt zurück | wie A, dazu Code-Review, dass der Haken im stummen Pfad nichts sammelt |
| **W — berührt die Wertung** | ändert `wert()`, `beitragVon`, einen Sieger oder einen Würfel | **keiner der Vorschläge hier.** Was in diese Klasse gehört (Rollen-Wertung, Trades zählen, Tickets), steht im Konzeptreview als P1–P3 |

### 0.3 Die Vorschläge auf einen Blick

**Arena (TDM, Mini-DM, Battlefield):**

| # | Vorschlag | Prio | Klasse | Aufwand | Vorbild |
|---|---|---|---|---|---|
| K0 | **Anzeige-Korrekturen nach dem TDM-Respawn** (Score, Endstand-Sieger, Uhr) | **P0** | A | klein | — (Fehler) |
| K1 | **Killfeed** oben rechts: wer, womit, wen, mit Beihilfe | **P1** | S (Label-Weitergabe) | klein–mittel | CS2, Valorant |
| K2 | **Kopfleiste mit Lebens-Pips und Überzahl** („4 gegen 3") | **P1** | A | klein | CS-Scorebar |
| K3 | **Highlight-Dosis für TDM mit Respawn** (First Blood, Mehrfach-K.o., Ace, Wende) | **P1** | A | klein | Overwatch-Medaillen, CS-Multikill |
| K4 | **Spectator-Karten je Kämpfer** (HP, Ressourcen, seltene Fähigkeit, Respawn-Uhr) | **P2** | A | mittel | Overwatch League HUD |
| K5 | **„Szene des Spiels"** nach Ereignisart, erst als Text, später als Geister-Replay | **P2** (Text) / P3 (Replay) | A | klein / mittel | Overwatch Play of the Game |
| K6 | Kontrollpunkt klein in den Score-Bug (nur Battlefield) | P3 | A | klein | Overwatch-Capture-Bar |
| — | Minimap | **nicht empfohlen** | — | — | CS-Radar |

**I-Spy:**

| # | Vorschlag | Prio | Klasse | Aufwand | Vorbild |
|---|---|---|---|---|---|
| I0 | **Ehrlichkeitsfund:** ein gemeinsamer Raum im Bild, zwei getrennte Räume in der Mechanik | **P0** (Befund) | — | — | — |
| I1 | **Split-Screen: zwei Räume nebeneinander** mit derselben Karte | **P1** | A | mittel | GDQ-Race-Layout, Crystal Maze |
| I2 | **Zug-Uhr als Countdown** mit „letzter Zug"-Alarm | **P1** | A | klein | Crystal-Maze-Zonenuhren |
| I3 | **Split-Tafel:** Punkte je Zug, Delta zum Gegner, Gold-Split | **P1** | A | klein–mittel | LiveSplit/GDQ |
| I4 | **Heiß/kalt als Fundstufe**, nicht als erfundene Nähe | **P2** | A | klein | Crystal Maze, Legends |
| I5 | **Führung im Bild:** Trennlinie als Tauzieh-Balken, Raumrahmen in Führungsfarbe | **P2** | A | klein | Runde 2, Muster 5.2 (c) |
| I6 | Highlight-Dosis: Tresor, Führungswechsel, entscheidender letzter Zug | P3 | A | trivial | — |

**Empfohlene Reihenfolge:** K0 → K2 → K1 → K3 → I2 → I1 → I3 → K4 → I4/I5 → K5 → Rest.
Begründung in Abschnitt 5.

---

## 1. Was heute im Bild ist

### 1.1 Arena

Die drei Disziplinen teilen einen Motor und eine Zeichenfunktion (`draw()`, `:31425`, Kampf-Zweig
ab `:31430`). Zu sehen ist:

| Element | Wo | Code |
|---|---|---|
| Boden, Kontrollpunkt (nur Battlefield) | Leinwand | `zeichneBoden()` `:25875`, `zeichneKontrollpunkt()` `:25961` |
| **Ziellinien:** dünn in Teamfarbe, wenn das Ziel in Reichweite ist; bei Zielansage gestrichelt in Fokusfarbe | Leinwand | `:31450–31466` |
| Teamring und Schatten unter jeder Figur, Sprite, Lebensbalken 30 px, darunter Mana- und Ausdauerbalken je 2 px | am Kämpfer | `:31488–31511` |
| Name in Teamfarbe, darunter der Befehl oder „HEILER" | am Kämpfer | `:31526–31530` |
| Zielansage: gestrichelter Ring, wippender Pfeil, Zähler „▼ n" (wie viele folgen) | am Ziel | `:31542–31560` |
| Geschosse, Effekte, Schwebezahlen (Schaden rot, Heilung grün, Skillname) | Leinwand | `:31562–31588` |
| Kopfzeile: Teamnamen, „n im Kampf", Score, Uhr, Phase („läuft"/„Sudden Death"), Team-Lebensbalken | DOM über der Leinwand | `updateHud()` `:25255` |
| Score-Bug `#bbug`, Callout `#bbugcallout` | Overlay | `aktualisiereBbug()` `:12368`, `callout()` `:31606` |
| Ticker, Kaderkacheln, Wertungstabelle (Schd/Heil/Verh/Tank/KO/Leist/Eig) | DOM unter der Leinwand | `feed()` `:31662`, `WERTUNG_CHASSIS.kampf` `:24601` |
| Endstand mit Höhepunkte-Liste | Overlay nach Spielende | `renderEndstand()` `:33290`, `renderHighlights()` `:33272` |

**Was fehlt, gemessen an einem Esport-Spectator-HUD:**

1. **Kein Killfeed.** Ausschaltungen stehen im Ticker unter dem Bild, zwischen allen anderen
   Treffern (Runde 2 zählte 661 Tickerzeilen in einem TDM-Spiel). Wer wen erledigt hat, liest man
   nicht ab, man sucht es.
2. **Keine Zählung „wer lebt noch" im Bild.** Die Zahl steht klein in der Kopfzeile („4 im
   Kampf"). Die CS-Konvention, lebende Spieler als Pips je Team oben zu zeigen, fehlt. Dabei ist
   die Überzahl in diesem Format *der* entscheidende Hebel (Lanchester, Konzeptreview 2.6).
3. **Keine Fähigkeitsanzeige.** Seltene Fähigkeiten mit echter Abklingzeit (Barrage, Dash,
   Segen, `:23016 ff.`) sind unsichtbar, bis sie feuern.
4. **Keine Respawn-Anzeige** in TDM, außer einer Tickerzeile „fällt — zurück in 5 s". Eine
   gefallene Figur wird mit 28 % Deckkraft weiter gezeichnet, ohne Uhr.
5. **Kein Moment-Rückblick.** Die Höhepunkte-Liste ist Text im Endstand (bewusst, Runde 1,
   Abschnitt 4.3).

### 1.2 Drei Anzeige-Fehler seit dem TDM-Respawn (K0, Befund)

Beim Lesen gefunden, nicht per Screenshot bestätigt. Zu verifizieren, bevor gebaut wird.

1. **Der Score in der Kopfzeile zählt für TDM die gerade Liegenden, nicht die Ausschaltungen.**
   `updateHud()` rechnet `(nR-live(1).length)+" : "+(nL-live(0).length)` (`:25287`). Das war
   richtig, solange niemand zurückkam. Seit `ac38f6fb` respawnt TDM nach 5 s: Der Score **sinkt**,
   sobald jemand zurückkommt. `finish()` (`:31718–31724`) und der Ergebnis-Export (`:33682`)
   zählen dagegen korrekt `u.st.ko` je Seite. Der Score-Bug kopiert die falsche Zahl
   (`aktualisiereBbug` liest `#score`).
2. **Das Endstand-Overlay kann für TDM einen anderen Sieger nennen als der Ticker.**
   `renderEndstand()` bestimmt den Sieger über `live(0).length>live(1).length` (`:33296`). Bei
   TDM mit Respawn ist das eine Momentaufnahme. Der Kommentar in `finish()` sagt das selbst:
   „aktuell lebend am Spielende reiner Zufall".
3. **Die Kampfuhr hat keinen Minutenumbruch.** `updateHud()` schreibt
   `"0:"+String(Math.floor(t*zeitFaktor()))` (`:25258`). TDM läuft seit dem Respawn immer bis
   `t>95`: 95 × 1,88 (`ZEIT_DEHNUNG.tdm`, `:31805`) ≈ 178 s, angezeigt als „0:178". Bei
   Battlefield (Faktor 5,00) sind bis „0:475" möglich, wenn ein Kampf zäh wird. Der Ticker hat
   denselben Fehler schon einmal gehabt und ist korrigiert (`feed()`, `:31672–31676`).

Alle drei gehören in Klasse A. Sie ändern keinen Sieger in der Wertung, nur die Anzeige, die heute
der Wertung widerspricht. **Das ist die Voraussetzung für jede weitere Broadcast-Arbeit an TDM:**
Ein Killfeed neben einem Score, der rückwärts läuft, verwirrt mehr, als er erklärt.

### 1.3 I-Spy

Die Zeichenfunktion ist `bodenSchatzsuche()` (`:17902`) für den Raum und `zeichneSchatzsuche()`
(`:18680`) für die Figuren. Zu sehen ist:

| Element | Code |
|---|---|
| Dunkler Dielenboden, Bücherregale oben und unten, vier warme Lampenkegel | `:17909–17942` |
| Zwölf Fundorte als Möbel (Truhe, Aktenschrank, Schreibtisch mit Tagebuch, Verhörfigur mit „?", Tür), darüber 1–3 Sterne | `:17944–17959`, Möbel `:17837–17892` |
| Heim startet am linken Rand, Gast am rechten; alle laufen im selben Raum zu den Fundorten | `ispyHeimatXY()` `:17294` |
| Phasen je Zug: gehen, suchen (Lupe blinkt über dem Kopf), Ergebnis (Bogen bei Erfolg, Riss und „+15%" am gescheiterten Tresor), Jubel-Sprung oder Kopfschütteln | `stepSchatzsuche()` `:17300`, `zeichneSchatzsuche()` `:18680–18756` |
| Reaktion: gestrichelte gelbe Linie zum Ziel und „!" über dem Kopf | `:18695–18704` |
| Unter jeder Figur: Name, „n Pkt", „k/8" in grauer 8-px-Schrift | `:18764–18768` |
| Vier gedrehte Kartenvarianten, rein visuell | `ISPY_LAYOUT_VARIANTEN` `:15295` |
| Kopfzeile „8 Durchgänge — Punkte laufend enthüllt", Score = Punktesumme je Seite | `updateHudBuehne()` `:17487` |

**Was fehlt, gemessen an einer Spielshow oder einem Speedrun-Rennen:**

1. **Kein Zeitdruck im Bild.** Die Uhr läuft oben, aber „wie viele Züge noch" steht nur als
   graues „5/8" unter jeder Figur. Crystal Maze hat in jeder Zone eine große Uhr im Raum.
2. **Kein Vergleich der beiden Teams im Bild.** Wer vorn liegt, steht im Score als Summe. Wie sich
   der Vorsprung entwickelt, sieht man nicht.
3. **Kein Fortschritt des Falls.** Die Sterne über den Möbeln zeigen die *Startstufe* aus
   `art.fundorte` (`:17958`), nicht den Zustand im Spiel. Nach dem Nachfüllen trägt eine Truhe
   mechanisch längst eine andere Stufe (`t.stufeAktuell`, `:15601`), und geöffnete Truhen sehen
   aus wie ungeöffnete.

### 1.4 I0 — Ehrlichkeitsfund: ein Raum im Bild, zwei Räume in der Mechanik

`baueSchatzsuche()` baut **zwei getrennte Räume**, `mineRaum` und `gegnerRaum` (`:15621–15622`).
Das ist Absicht und gemessen begründet: Ein geteilter Pool maß rho 0,53 (Konzeptreview, 26.09.,
Abschnitt 4 Leitplanken). Gezeichnet wird aber **ein** Raum, und beide Teams laufen darin zu
denselben zwölf Möbeln. Der Kommentar bei den Kartenvarianten beschreibt das selbst
(`:15285–15294`).

Folgen für den Zuschauer:

* Zwei Figuren verschiedener Teams können gleichzeitig an **derselben** Truhe knien, und beide
  „öffnen" sie. Das Bild behauptet eine Konkurrenz um dieselbe Truhe, die es mechanisch nicht
  gibt.
* Die Reaktionslinie („eilt herbei") zeigt auf ein Möbelstück, an dem der Gegner gerade gejubelt
  hat. Das sieht aus wie „er läuft zum Fund des Gegners". Gemeint ist die *eigene* Truhe derselben
  Rätselart im *eigenen* Raum.
* Das Konzeptreview nennt die Reaktion schon mechanisch „Theater", weil der Fund drüben nichts über
  den eigenen Raum verrät (Abschnitt 1.1). Das Bild verstärkt diesen Eindruck, statt ihn zu
  klären.

Das ist kein Fehler im Sinne eines falschen Werts. Es ist eine **Anzeige, die eine andere Mechanik
erzählt als die, die läuft.** Der Split-Screen (I1) behebt genau das und ist deshalb hier der
wichtigste Vorschlag.

---

## 2. Die Vorbilder und ihre Regeln

Recherchiert per Websuche (Quellen am Ende), ergänzt um das, was jeder kennt, der diese Formate
gesehen hat.

### 2.1 Esport-Shooter (Arena)

| Vorbild | Element | Was es leistet | Regel |
|---|---|---|---|
| **Counter-Strike** | **Killfeed** oben rechts: „Angreifer [Waffensymbol] [Kopfschuss] Opfer", Teamfarben, verblasst nach wenigen Sekunden; moderne Fassungen markieren Sonderfälle (durch die Wand, durch Rauch, blind) | In einer Runde mit zehn Spielern ist nach zwei Sekunden klar, wer fehlt und warum | **Ereignis-Log im Bild, nicht im Ticker.** Kurz, symbolisch, selbstverlöschend. |
| **Counter-Strike** | **Scorebar oben:** Rundenstand, Uhr, je Team fünf Spieler-Pips, gefallene grau | „4 gegen 2" steht im Bild, bevor jemand es sagt | **Überzahl ist die wichtigste Zahl** im Eliminationsformat. |
| **Counter-Strike / Valorant** | **Spielerleisten** links/rechts: Name, HP-Balken, Waffe, Rüstung, Geld, Kills je Runde; bei Valorant Fähigkeitsladungen und Ult-Punkte | Der Kommentator kann über jeden sprechen, ohne das Bild zu wechseln | **Zustand jedes Akteurs dauerhaft sichtbar, klein, am Rand.** |
| **Overwatch League** | Spectator-HUD mit Porträt, Name, **Leben, Abklingzeiten, Ult-Ladung** je Spieler; Teamfarbe überall; dickere Umrisse und Symbole über Helden, die gerade eine Fähigkeit nutzen | Laut Blizzard das Hauptproblem des Zuschauens: „wer gehört zu welchem Team" schnell zu sehen | **Teamfarbe als Grundcode** (dieselbe Regel wie Runde 2, Regel 2), Ressourcen und Fähigkeiten sichtbar, **bevor** sie feuern. |
| **Overwatch** | **Play of the Game:** am Ende 5 s Intro und 12 s Szene aus Sicht eines Spielers. Kategorien: High Score (viel Punktwert in kurzer Folge), Shutdown, Sharpshooter, **Lifesaver** (Teamkameraden gerettet). Nicht an den Sieg und nicht an den MVP gebunden | Ein Spiel bekommt einen erinnerbaren Moment | **Nach Ereignisart ausgewählt, nicht nach Gesamtleistung.** Genau das macht es für uns tauglich (Leitplanke 0.1, Punkt 1). |
| **CS / Valorant** | Multikill-Kennung (2K/3K/4K/Ace), „Clutch 1 gegen 3", **First Blood** | Seltene Momente werden benannt | **Wenige, benannte Momentarten.** Deckt sich mit Runde 2, Regel 8. |
| **CS-Radar** | Minimap mit allen Spielerpunkten | Übersicht in einer Karte, die größer ist als das Bild | Sinnvoll **nur**, wenn die Kamera nicht alles zeigt. |

### 2.2 Spielshows und Speedruns (I-Spy)

| Vorbild | Element | Was es leistet | Regel |
|---|---|---|---|
| **The Crystal Maze** | Jede Zone hat ihre **eigene, große Uhr im Raum** (Aztekisch: Wasseruhr; Futuristisch: Digitaluhr; Mittelalter: Sanduhr; Industrie: große Stoppuhr). Spiele dauern 2–3 Minuten. Wer die Zeit überzieht, wird **eingeschlossen** („Lock-in"). Jeder Kristall = 5 s im Finale | Zeitdruck ist eine Bühne, kein Zahlenfeld | **Die Uhr gehört in den Raum und hat eine Folge.** |
| **The Crystal Maze** | Blick von außen durch die Scheibe **und** von innen; Team ruft Hinweise | Man sieht den Kandidaten *und* das Rätsel | **Zwei Blickwinkel auf einen Raum.** |
| **Legends of the Hidden Temple** | Tempellauf: **3-Minuten-Limit**, Tempelwächter, Amulett-Hälften als „Leben". Auf dem Bildschirm ein Tempelplan, auf dem man sieht, in welchem Raum das Kind gerade ist | Der Zuschauer sieht Fortschritt als Weg durch Räume | **Fortschritt als Ort, nicht als Prozentzahl.** |
| **Games Done Quick / Speedrun-Rennen** | **Race-Layout:** zwei (oder vier) Spiele nebeneinander, je ein Timer; **Splits** mit Delta zur Vergleichszeit (grün vorn, rot hinten, Gold für den besten Abschnitt) | Zwei Läufer in zwei getrennten Spielen werden als **ein** Rennen lesbar | **Getrennte Welten, gemeinsame Uhr, Delta je Abschnitt.** Genau die I-Spy-Mechanik: zwei Räume, dieselben acht Züge. |

### 2.3 Übersetzt in Regeln für den 2D-Motor

1. **Überzahl und Leben als Pips** (Arena). Die eine Zahl, die das Eliminationsformat entscheidet.
2. **Killfeed statt Ticker** für Ausschaltungen. Ticker bleibt das Protokoll.
3. **Zustand vor dem Ereignis zeigen:** Abklingzeit, Respawn-Uhr, Zugrest.
4. **Momente nach Art, nicht nach Gesamtwert** (Play of the Game, nicht MVP).
5. **Zwei getrennte Welten zeigt man getrennt** (Race-Layout) und vergleicht sie über Delta je
   Abschnitt (Split).
6. **Die Uhr steht im Raum**, nicht nur in der Kopfzeile.
7. **Nichts erfinden:** Eine heiß/kalt-Anzeige zeigt nur eine Nähe, die die Mechanik kennt.

---

## 3. Arena — Vorschläge im Einzelnen

### K0 — Anzeige-Korrekturen nach dem TDM-Respawn (P0, Klasse A, klein)

Siehe 1.2. Konkret:

* `updateHud()`: für `disc==="tdm"` den Score aus `Σ u.st.ko` je Seite, wie `finish()` und
  `:33682`. Die Zahl „n im Kampf" (`aliveL/aliveR`) bleibt, sie ist für TDM weiter richtig (wer
  gerade steht).
* `renderEndstand()`: für TDM derselbe Sieger wie `finish()`. Am saubersten über eine gemeinsame
  Funktion `kampfSieger()` neben `dominationSieger()`, damit Ticker, Overlay und Export nicht
  wieder auseinanderlaufen.
* Uhr: dieselbe `m:ss`-Umrechnung wie im Ticker (`:31676`).

Abnahme: `miss-alle-disziplinen.mjs 24 tdm mini-dm battlefield` bit-identisch (wird nur gelesen);
Sichtprüfung, dass der Score in TDM nie fällt.

### K1 — Killfeed (P1, Klasse S, klein–mittel)

**Was:** ein DOM-Overlay `#killfeed` oben rechts im `.arenaraum` (Bauart wie `#bahnHud`:
absolut, `pointer-events:none`, `[hidden]` außerhalb des Kampfs). Höchstens fünf Zeilen, jede
blendet nach 5 s aus.

Eine Zeile:

```
[Teamfarbe] Draco  ⚔ Trennschlag  ✚2  →  Greenkraut [Teamfarbe]
```

* **Symbol für die Art:** Nahkampf ⚔, Geschoss ➶, Fähigkeit mit Namen (das `label` aus
  `nahschlag`). Reine Textglyphen, kein Asset (dieselbe Regel wie `ispySterne`).
* **Beihilfe „✚n":** Zahl der anderen Beteiligten mit Schadensanteil. `verteileKo()` (`:24536`)
  kennt die Anteile im Moment der Ausschaltung schon. Das ist wichtig für die Ehrlichkeit: Die
  **Wertung** rechnet mit dem Anteil (`koAnteil`), nicht mit dem letzten Schlag. Ein Killfeed, der
  nur den letzten Schlag zeigt, würde eine andere Logik erzählen als die, die zählt.
* **TDM:** in der Opferzeile ein kleiner Respawn-Zähler („↻ 5"), der herunterläuft.
* **Mini-DM als 4-Team-FFA** (Chris' Format, `baueMiniDmFfaRunde`): vier Teamfarben statt
  `--home/--away`. Der Killfeed muss N Seiten kennen. Dieselbe Regel wie `gegner()`/`eigene()`
  (`:23192`): nicht „die andere Seite" annehmen.
* Sonderfall **Heiler rettet** (Lifesaver-Muster): eine Zeile in Grün „✚ Cleric hält Draco am
  Leben", wenn eine Heilung ein Ziel unter 20 % Leben um mindestens 30 % seines Maximums anhebt.
  Nur Anzeige. Ob Heilung in der Wertung besser zählen soll, ist P1 des Konzeptreviews, nicht
  diese Anzeige.

**Warum Klasse S:** `schalteAus(tg,von)` (`:22972`) ist die eine Stelle, an der jede Ausschaltung
vorbeikommt. Sie kennt aber das Label des Schlags nicht. Dafür bekommt sie einen dritten,
optionalen Parameter (nur ein String), den `nahschlag()` und der Geschosstreffer durchreichen. Die
Killfeed-Zeile selbst wird **in `feed()`** oder hinter einer `stumm`-Prüfung erzeugt, damit die
Sonden nichts sammeln.

**Aufwand:** ~60 Zeilen JS, ~20 Zeilen CSS.

### K2 — Kopfleiste mit Lebens-Pips und Überzahl (P1, Klasse A, klein)

**Was:** der Score-Bug bekommt je Seite eine Reihe Pips, einen je Kämpfer. Voll in Teamfarbe =
lebt, grau = liegt, grau mit Uhrsymbol = wartet auf Respawn (TDM). Dazu in der Mitte, wenn die
Zahl ungleich ist, eine Überzahl-Kennung **„4 : 3"** in der Farbe der Seite mit mehr Lebenden.

* Das ist die CS-Scorebar.
* Es ist auch die ehrlichste Darstellung der Diagnose aus dem Konzeptreview: Im Eliminationsformat
  entscheidet der erste Ausfall, und Überzahl wirkt quadratisch. Heute sieht man sie nur, wenn man
  die Figuren zählt.
* Daten: `live(s)`, `U`, `u.downBis`. Alles vorhanden.
* Kontextzeile (Runde 2, Vorschlag 3): „Sudden Death" ab `t>50`, denn ab da wächst der Schaden
  (`sd`, `:24006`). Das ist eine echte Regel mit Folge und gehört ins Bild.

**Aufwand:** ~40 Zeilen an `aktualisiereBbug()`, ~15 Zeilen CSS.

### K3 — Highlight-Dosis für TDM mit Respawn (P1, Klasse A, klein)

**Befund:** `schalteAus()` meldet **jede** Ausschaltung als `big` (`:22977`, `:22979`). Das war bei
Einmal-Eliminierung vertretbar (höchstens elf je Spiel, meist weniger; Runde 2 maß 14 big je
Spiel). Seit TDM über volle 95 Simulationssekunden mit Respawn läuft, gibt es deutlich mehr
Ausschaltungen, und jede löst ein Callout-Banner aus. Dazu kommt der Treffer-mit-Label-Zweig
(`crit||!!label`, `:23003`), den Runde 2 schon als „· 4 Schaden als Höhepunkt" kritisiert hat.
**Nicht gemessen in dieser Runde**; die Richtung folgt aus dem Code. Vor dem Bau mit Runde 2s
`tmp/zaehle-highlights.mjs`-Verfahren zählen.

**Vorschlag:** `big` nur noch für benannte Momentarten (CS/Valorant/Overwatch):

| Moment | Bedingung (aus vorhandenem Zustand) |
|---|---|
| **First Blood** | erste Ausschaltung des Spiels |
| **Doppel-/Dreifach-K.o.** | derselbe `von` schaltet innerhalb von 4 s zwei bzw. drei aus |
| **Ace / Auslöschung** | Mini-DM, Battlefield: die letzte lebende Figur einer Seite fällt |
| **Clutch** | Mini-DM, Battlefield: eine Seite gewinnt mit nur noch einem Lebenden, der vorher in Unterzahl stand |
| **Wende** | TDM: das Vorzeichen von `Σ ko(Heim) − Σ ko(Gast)` kippt (dieselbe Führungswechsel-Logik wie Runde 2, Vorschlag 3) |
| **Lifesaver** | wie in K1 |
| Endergebnis | wie bisher |

Alle anderen Ausschaltungen bleiben Tickerzeile **und** Killfeed-Zeile, aber ohne Callout. Die
Label-Treffer verlieren `big` ganz. Ziel wie in Runde 2, Frage 1: 4–10 Höhepunkte je Spiel.

Nebenbei: `reviveUnit()` schreibt „ist zurück im Kampf" in den Ticker (`:22965`). Bei TDM ist das
bald jede zweite Zeile. Diese Information trägt der Killfeed (↻) und die Pip-Leiste besser;
die Tickerzeile kann entfallen.

### K4 — Spectator-Karten je Kämpfer (P2, Klasse A, mittel)

**Was:** das Overwatch-League-Muster als schmale Spalte je Seite links und rechts am Rand der
Leinwand (oder als Umbau der vorhandenen Kaderkacheln unter dem Bild; das ist Chris'
Geschmacksfrage, Abschnitt 6, Frage 2). Je Kämpfer eine Karte:

* Name in Teamfarbe, darunter Rolle bzw. Befehl (wie heute an der Figur).
* HP-Balken, Mana- und Ausdauerbalken (heute 2 px unter der Figur, kaum lesbar).
* **Seltene Fähigkeit mit Abklingring:** ein kleiner Kreis, der sich füllt, bis Barrage/Dash/Segen
  wieder bereit ist. Das ist die Ult-Ladung aus Overwatch. Daten: die echten Abklingzeiten der
  Skills (`:23016 ff.`), gelesen, nicht geschrieben.
* K / T / B (Ausschaltungen, Tode, Beihilfe) klein, aus `u.st`.
* Status: tot (grau), Respawn-Uhr (TDM), „raus" (Mini-DM, Battlefield).

**Was die Karte ausdrücklich nicht zeigt:** den Beitrag nach `beitragVon` als Balken oder Rang.
Die Spalte „Leist" in der Tabelle darunter bleibt die Stelle, an der der Beitrag gegen die Eignung
steht. Eine Karte, die „Beitrag 1340" groß zeigt, würde dem rollenblinden Maßstab eine Bühne geben
(Leitplanke 0.1, Punkt 1).

**Aufwand:** mittel, ~150 Zeilen, ein Overlay, zwei Spalten, Aktualisierung je Frame aus `U`.

### K5 — „Szene des Spiels" (P2 als Text, P3 als Replay)

**Stufe 1, P2, klein:** Am Ende wird **ein** Moment aus K3 als „Szene des Spiels" ausgewählt und
im Endstand über der Höhepunkte-Liste hervorgehoben. Auswahl nach Art, fest geordnet: Clutch >
Dreifach-K.o. > Lifesaver > Wende > Doppel-K.o. > First Blood. Bei Gleichstand der frühere. Das ist
das Overwatch-Prinzip: **nicht an Sieg oder Gesamtwert gebunden.** So kann auch ein Heiler die
Szene des Spiels bekommen, was in der heutigen Wertung kaum vorkommt.

**Stufe 2, P3, mittel:** ein **Geister-Replay** der letzten ~6 s vor dem Moment.

* Während des interaktiven Spiels (nie im stummen Pfad) speichert `draw()` je Frame ein kleines
  Tupel je Kämpfer: `x`, `y`, `hp/max`, `down`, `side`. Das ist ein **Ringpuffer fester Größe**
  (6 s × 60 Bilder × 12 Kämpfer ≈ 4 300 Einträge), keine wachsende Liste.
* Nach Spielende zeichnet der Endstand die Szene mit denselben Sprites in Zeitlupe nach, der
  Held mit Fokusring.
* Warum Ringpuffer und `draw()`: Leitplanke 0.1, Punkt 4. Ein Replay, das im Sim-Pfad
  mitschreibt, ist genau die Art Anzeige, die das vermutete Leck verschlimmern kann.
* Runde 1 hat ein Bild-Replay als unverhältnismäßig verworfen (Abschnitt 4.3). Der Ringpuffer
  über Positionen ist deutlich billiger als der dort bedachte Bildmitschnitt. Trotzdem erst nach
  K0–K4 und nach der Leck-Diagnose.

### K6 — Kontrollpunkt klein in den Score-Bug (P3, nur Battlefield)

Kontrollpunkt-Stand als kleine Zeile im Score-Bug: Besitzer als Farbpunkt, Punkte „42/150",
Eroberungsring als Mini-Kreis (dieselben Daten wie `zeichneKontrollpunkt()`). Bewusst **klein**:
Die Domination entscheidet heute kein Spiel (Leitplanke 0.1, Punkt 5). Groß wird sie erst, wenn
Chris Frage 2 des Konzeptreviews (Tickets, Respawn) beantwortet hat und der Punkt Spiele
entscheidet.

### Nicht empfohlen: Minimap

Die Kampf-Leinwand zeigt das ganze Feld auf einmal, ohne Kamerafahrt. Eine Minimap würde
dasselbe Bild noch einmal kleiner zeigen. Die Aufgabe des CS-Radars (wo sind meine Leute,
wo ist das Ziel) übernehmen hier schon die Teamringe, die Ziellinien und die Zielansage. Wird
Battlefield später größer als eine Leinwand (Rollout-Plan, eigenes Bodenbild), wird die Frage neu
gestellt.

---

## 4. I-Spy — Vorschläge im Einzelnen

Allgemeine Regel für alle I-Spy-Vorschläge: `baueSchatzsuche()` rechnet alle acht Züge **vorab**
(`:15636–15647`), gezeigt wird nur enthüllt. Jede Anzeige liest ausschließlich
`u.runden[0..u.aktuell]`, nie das fertige Endergebnis (dieselbe Spoiler-Regel wie
`WERTUNG_CHASSIS`, `:24595 ff.`, und `zeichneEisStand`).

Der Stand der I-Spy-Mechanik ist dabei fest: P1 „Spur statt Los" ist im Prototyp gescheitert
(`i-spy-p1-prototyp-befund-26-09.md`), der Ist-Kern bleibt (0,756 / 0,909). Die Bild-Vorschläge
aus dem Konzeptreview, PR 5 („Spurbalken über der Figur"), hingen an P1 und fallen damit weg.
Die folgenden Vorschläge setzen auf den **heutigen** Kern und bleiben gültig, falls später P2
(Spielpläne) oder P3 („Ein Fall, zwei Räume") kommen. Für P3 sind sie sogar die natürliche Bühne.

### I1 — Split-Screen: zwei Räume nebeneinander (P1, Klasse A, mittel)

**Was:** die Leinwand wird geteilt. Links der Raum von Heim, rechts der Raum von Gast, jeder mit
denselben zwölf Fundorten, **in derselben Kartenvariante** (`ISPY_VISUELLES_LAYOUT`, einmal je
Spiel). In der Mitte ein schmaler Trennsteg (siehe I5).

* **Das ist das GDQ-Race-Layout:** zwei getrennte Spiele, ein Rennen. Es ist auch schlicht die
  Wahrheit der Mechanik (I0).
* **Dieselbe Karte in beiden Räumen** ist fair (keiner hat den besseren Raum) und bereitet P3 vor:
  Wenn beide Teams denselben Fall lösen, zeigt ein Jubel an Fundort 7 links, dass Fundort 7 rechts
  interessant ist. Man sieht es sofort, weil die Möbel an derselben Stelle stehen.
* **Truhenzustand je Raum** (der zweite Gewinn): Weil jede Hälfte nur einem Team gehört, kann
  sie ihre Möbel so zeichnen, wie sie für dieses Team stehen. Abgeleitet aus bereits enthüllten
  Zügen der Seite: ein Erfolg an Fundort *i* öffnet den Deckel, bis ein späterer enthüllter Zug
  dort eine neue Stufe zeigt (`r.stufe`); ein Fehlschlag hinterlässt den Riss. Die Sterne zeigen
  die zuletzt gesehene Stufe statt der Startstufe. Kein neuer Mechanik-Zustand: Es wird
  nur rückwärts aus `u.runden` gelesen.
* **Umrechnung:** `ispyFundortXY()` (`:17808`) bekommt eine Seite als Parameter und bildet
  `f.x ∈ [0,1]` auf die halbe Breite ab (`W·0,04 + f.x·W·0,42` bzw. `W·0,54 + …`).
  `ispyHeimatXY()` stellt die Wartenden an den **Außenrand** der jeweiligen Hälfte.
  `stepSchatzsuche()` liest die neue Koordinate beim Laufziel mit (`:17318–17320`). Das bleiben
  `viz*`-Felder unter dem harten Vertrag der Funktion (`:17262–17268`).
* **Reaktionslinie:** zeigt jetzt auf die eigene Truhe im eigenen Raum. Dazu kurz ein Blitz vom
  Jubel drüben über den Trennsteg: „Jubel gehört" wird eine Linie von einer Hälfte zur anderen,
  also die Information, die tatsächlich fließt.

**Risiko und Grenze:** Die Hälften sind halb so breit. Sechs Figuren plus zwölf Möbel werden eng.
Gegenmittel: Sprites in I-Spy um ~15 % kleiner zeichnen (`zeichneSprite(ctx,u,x,y,feldspiel)`, `:3036`, hat
keinen Skalierungsparameter; also per `ctx.translate`/`ctx.scale` um den Zeichenpunkt) und die
Namensschrift nur beim gerade Handelnden voll, bei den übrigen
gedimmt. Vor dem Bau per Screenshot bei sechs gegen sechs prüfen. Bei zwei gegen zwei (Kader klein)
bleiben ohnehin nur die aktiven Blöcke (`ispyAktiveFundorte`).

**Aufwand:** mittel, ~120 Zeilen in `bodenSchatzsuche()`/`zeichneSchatzsuche()`/`ispyFundortXY()`/
`ispyHeimatXY()`. Abnahme: `miss-alle-disziplinen.mjs 24 i-spy` bit-identisch (0,756/0,909),
`miss-arena-buehne-spiegel.mjs` unverändert.

### I2 — Zug-Uhr als Countdown im Raum (P1, Klasse A, klein)

**Was:** die Crystal-Maze-Zonenuhr. Über dem Trennsteg (oder bei geteiltem Bild in jeder Hälfte
oben) eine große Uhr: **„Zug 6 / 8"** und ein Balken, der innerhalb des Zugs abläuft
(`buehneT`, `art.rundenDauer`). Im letzten Zug wird sie rot und pulsiert, dazu der vorhandene
Alarmton (`sfx("i-spy","alarm")`, Ton-Katalog existiert). Nach dem letzten Zug „fällt" die Tür
(Lock-in-Bild, rein dekorativ): Wer jetzt noch an einer angebrochenen Truhe steht, bekommt den
Kopfschüttel-Zustand.

Thematisch passend: Sanduhr als Glyphe, kein Asset. Die graue „k/8"-Zeile unter jeder Figur
(`:18768`) kann dann entfallen, sie wiederholt nur den Takt.

**Aufwand:** ~40 Zeilen. Rein lesend.

### I3 — Split-Tafel mit Delta je Zug (P1, Klasse A, klein–mittel)

**Was:** der Speedrun-Split. Eine schmale Tafel am unteren Rand (über den Regalen) mit acht Feldern,
eins je Zug. Nach jedem enthüllten Zug trägt das Feld die Team-Punkte dieses Zugs und das Delta
zum Gegner im selben Zug:

```
Zug   1    2    3    4    5    6    7    8
Heim  +42  +18  +71  ·
Δ     +6   −14  +31  ·        gesamt +23
```

* Farben wie LiveSplit: grün vorn, rot hinten, **Gold** für den besten Zug eines Teams im Spiel.
* Daten: `Σ r.punkte` je Seite je `aktuell`. Die Summen stehen schon im Score, nur nicht je Zug.
* Warum das mehr ist als der Score: Es zeigt, **wann** ein Team seinen Tresor geholt hat. Bei
  I-Spy entscheidet der Zugang zur Stufe über die Punkte (Konzeptreview 0.2): Ein Zug mit Tresor
  springt sichtbar heraus. Das ist die Mechanik, im Bild erzählt.

**Aufwand:** ~70 Zeilen DOM-Overlay oder Canvas. Rein lesend.

### I4 — Heiß/kalt als Fundstufe, nicht als erfundene Nähe (P2, Klasse A, klein)

Der naheliegende Escape-Room-Einfall wäre ein „du bist nah dran"-Signal. **Die Mechanik kennt
aber keine Nähe zur Lösung.** Es gibt keine verborgene Truhe, der man sich nähert; es gibt je
Zug einen Spürwurf, der entscheidet, welche Stufen man überhaupt sieht, und einen Knackwurf. Eine
heiß/kalt-Anzeige, die eine Annäherung vorspielt, würde eine Mechanik erzählen, die nicht
existiert. Das ist derselbe Fehler wie I0, nur neu gebaut.

Was ehrlich geht und dieselbe Wirkung hat:

* **Farbe der Fundstufe am Fundort, im Moment des Suchens.** Die Lupe über dem Kopf
  (`:18710–18719`) leuchtet kalt (blau) bei einer Notiz, warm (orange) bei einer Akte, heiß (rot,
  mit Glühen) bei einem Tresor. Gelesen aus `r.stufe` des gerade enthüllten Zugs. Das zeigt, was
  der Spürsinn gefunden hat, und der Spürsinn ist der stärkste Eignungsträger der Disziplin
  (SPÜRSINN, r = 0,650, Konzeptreview 3.4). Heiß heißt: Diese Figur hat den Tresor gesehen.
* **Angebrochene Truhen glühen nach.** Jeder enthüllte Fehlschlag gibt +15 % Fortschritt
  (`ISPY_FORTSCHRITT_SCHRITT`); die Truhe im eigenen Raum (I1) bekommt eine Glut, die mit der
  Zahl der enthüllten Fehlschläge an diesem Fundort wächst, gedeckelt wie die Mechanik
  (`ISPY_FORTSCHRITT_DECKEL`). Das ist „heiß" im Wortsinn und stimmt mit dem Motor überein.

### I5 — Führung im Bild (P2, Klasse A, klein)

Runde 2, Abschnitt 5.3, hat I-Spy schon für den Vorsprungsbalken vorgesehen; Eiskunstlauf hat das
Muster seit `d047dead` (Bandenlicht + Vorsprungsbalken). Mit dem Split-Screen wird es natürlich:

* Der **Trennsteg** zwischen den Räumen ist der Tauzieh-Balken. Er verschiebt sich zur Seite des
  Führenden, Länge aus `Σ summe(Heim) − Σ summe(Gast)` relativ zur bisher enthüllten Gesamtsumme.
* Der **Rahmen** des führenden Raums leuchtet dezent in Teamfarbe, beim Führungswechsel kurz voll.
  Dieselbe Funktion, die Eiskunstlauf schon hat (`kuerEisFuehrung()`), gelesen aus derselben
  Summe, die der Score zeigt.

### I6 — Highlight-Dosis (P3, trivial)

`big` bleibt für den geknackten Tresor (heute schon so). Dazu der Führungswechsel (aus I5) und der
letzte Zug, wenn er den Führenden noch ändert. Kein `big` für Notizen und Akten. Erwartung:
im Rahmen der heutigen 7 je Spiel (Runde 2 gemessen), also schon gut dosiert.

---

## 5. Priorisierung

| Reihe | Vorschlag | Warum an dieser Stelle |
|---|---|---|
| 1 | **K0** Anzeige-Korrekturen TDM | Heute widerspricht die Anzeige der Wertung (Score sinkt, Endstand-Sieger kann abweichen, Uhr „0:178"). Jede weitere Grafik baute darauf auf. |
| 2 | **K2** Pips und Überzahl | kleinster Aufwand, zeigt die Größe, die das Format entscheidet |
| 3 | **K1** Killfeed | das Esport-Element schlechthin; macht den Ticker für Ausschaltungen überflüssig |
| 4 | **K3** Highlight-Dosis TDM | nötig, sobald Killfeed und Respawn Callouts vervielfachen; Ziel 4–10 je Spiel |
| 5 | **I2** Zug-Uhr | klein, sofort sichtbarer Zeitdruck |
| 6 | **I1** Split-Screen | der größte I-Spy-Gewinn und die Korrektur von I0; mittlerer Aufwand |
| 7 | **I3** Split-Tafel | baut auf I1, macht das Rennen zweier Räume lesbar |
| 8 | **K4** Spectator-Karten | mittlerer Aufwand, braucht Chris' Entscheidung zum Ort |
| 9 | **I4/I5** heiß/kalt als Stufe, Führung am Trennsteg | klein, erst sinnvoll nach I1 |
| 10 | **K5** Szene des Spiels (Text), später Replay | Text klein; Replay erst nach der Leck-Diagnose |
| 11 | **K6**, **I6** | nachrangig |

**Was davon vor der Mechanik-Reparatur gebaut werden sollte:** K0 immer (Fehler). K1–K3 und alle
I-Vorschläge schaden der Reparatur nicht, weil sie nur Ereignisse zeigen und im Messpfad nichts
tun. Sie ersetzen sie auch nicht. **K4 und K5 würde ich erst nach P1/P2 des Arena-Konzeptreviews
bauen:** Die Karten und die Szene des Spiels werden erst dann aussagekräftig, wenn Heiler, Anker und
Kommandeur einen Job haben, den man anzeigen kann. Vorher zeigen sie sehr schön ein System, das
das Falsche belohnt.

---

## 6. Offene Fragen an Chris, mit Voreinstellung

1. **Killfeed oben rechts (CS-Konvention) oder oben links?** Voreinstellung: rechts, weil links
   künftig der Timing-Tower aus Runde 2 sitzt.
2. **Spectator-Karten (K4) am Rand der Leinwand oder als Umbau der Kaderkacheln darunter?**
   Voreinstellung: Umbau der Kacheln. Die Leinwand bleibt frei für das Geschehen, und bei sechs
   gegen sechs wären zwei Randspalten auf der Leinwand zu eng.
3. **I-Spy als Split-Screen (I1)?** Das Bild ändert sich deutlich: zwei kleinere Räume statt eines
   großen. Voreinstellung: ja, weil es die Mechanik zeigt, die wirklich läuft, und P3 („ein Fall,
   zwei Räume") vorbereitet.
4. **Szene des Spiels (K5) auch für Verlierer?** Voreinstellung: ja, wie bei Overwatch.

---

## 7. Abnahme, wenn gebaut wird

* **rho:** `node scripts/miss-alle-disziplinen.mjs 24 tdm mini-dm battlefield i-spy` vorher und
  nachher, alle vier Zahlen je Disziplin bit-identisch. Für Klasse S zusätzlich ein Diff-Review,
  dass der neue Parameter nirgends in eine Rechnung fließt.
* **Pp:** unverändert, weil keine Mechanik berührt ist; `messe-arena-einfluss.mjs` braucht keinen
  neuen Lauf. Die bekannte Verletzung (Mini-DM 115, Battlefield 54, TDM 51,4) bleibt bestehen und
  wird hier ausdrücklich nicht als „behoben" oder „weniger schlimm" gemeldet.
* **Speicher:** die neuen Anzeigen dürfen keine wachsenden Listen haben. Prüfung:
  (a) `grep` auf jede neue Liste, ob sie gedeckelt ist (Killfeed ≤ 5, Ringpuffer fest);
  (b) im Browser zehn TDM-Spiele hintereinander mit `performance.memory.usedJSHeapSize` vor und
  nach, gegen denselben Lauf ohne die Anzeigen. Das vermutete Leck im Sim-Loop ist damit nicht
  diagnostiziert. Es ist nur sichergestellt, dass die Anzeigen nichts dazulegen.
* **Sicht:** `scripts/screenshot-disziplin.mjs` für die vier Disziplinen, mehrere Saaten, jeweils
  in der Mitte und kurz vor Ende (für TDM: Score steigt nur, Uhr zeigt Minuten).

---

## 8. Grenzen dieser Runde

* **Keine Screenshots.** Der Befund in 1.1–1.4 stammt aus dem Code, nicht aus der
  Sichtprüfung. Die Platte der Umgebung war voll (Worktree nur als Sparse-Checkout möglich), ein
  Playwright-Lauf war nicht drin. Die drei Anzeige-Fehler in 1.2 und der Raum-Befund I0 sind vor
  dem Bau im Bild zu bestätigen.
* **Keine Zählung** der Highlights nach dem TDM-Respawn (K3). Die Richtung folgt aus dem Code,
  die Zahl fehlt.
* **Vorbilder** über Websuche und Allgemeinwissen, keine Primärquelle zu Broadcast-Handbüchern.
  Wo eine Aussage an einer Wiki-Quelle hängt, steht sie unten.

---

## Quellen

**Im Repo gelesen:**

* `CLAUDE.md` (Abnahme, Matrix-Sperre, Mehrwege-Leitlinie)
* `docs/design/broadcast-praesentation-runde-2-22-09.md` (Runde 2)
* `docs/design/ui-bewegungs-audit-26-09.md` (Branch `ui-bewegungs-audit-26-09`)
* `docs/design/arena-minigames-opus-konzeptreview-26-09.md` (Branch
  `arena-minigames-konzeptreview-26-09`)
* `docs/design/i-spy-opus-konzeptreview-26-09.md`, `docs/design/i-spy-p1-prototyp-befund-26-09.md`
* `docs/design/stand-aller-disziplinen.md` (Zwölfter Nachtrag: Pp, OOM)
* Commit-Texte `ac38f6fb` (TDM-Respawn), `15322d26` (Cast-Reset), `d047dead` (Broadcast Runde 2
  umgesetzt)
* `public/mockups/battle-mode.engine.js`: `draw()` `:31425`, `feed()` `:31662`, `finish()`
  `:31692`, `updateHud()` `:25255`, `aktualisiereBbug()` `:12368`, `reviveUnit()`/`schalteAus()`
  `:22952`/`:22972`, `nahschlag()` `:22985`, `kpTick()`/`dominationSieger()` `:23221`/`:23243`,
  `zeichneKontrollpunkt()` `:25961`, `beitragVon`/`verteileKo`/`leistungVon` `:24528–24559`,
  `WERTUNG_CHASSIS.kampf` `:24601`, `renderEndstand()` `:33290`, `ZEIT_DEHNUNG` `:31804`;
  I-Spy: `baueSchatzsuche()` `:15611`, `ISPY_LAYOUT_VARIANTEN` `:15295`, `ispyTickerZeile()`
  `:15669`, `stepSchatzsuche()` `:17300`, `ispyFundortXY()` `:17808`, Möbel `:17837–17892`,
  `bodenSchatzsuche()` `:17902`, `zeichneSchatzsuche()` `:18680`, `updateHudBuehne()` `:17487`

**Web:**

* [Mitchel Huffa, Glance Value: The HUD](https://medium.com/@corruptdropbear/glance-value-the-hud-dc0d6f32b4ea)
* [Chris Bam Harrison, Overwatch League's UI is an eSports game changer](https://blog.prototypr.io/how-overwatch-leagues-ui-is-an-esports-game-changer-9db218c0d466?gi=9a8ce2f39f90)
* [over.gg, Developer Update announces new spectator changes](https://www.over.gg/6293/developer-update-announces-new-spectator-changes)
* [Overwatch Wiki, Play of the Game](https://overwatch.fandom.com/wiki/Play_of_the_Game)
* [Dot Esports, How does Overwatch decide Play of the Game?](https://dotesports.com/overwatch/news/how-does-overwatch-decide-play-of-the-game)
* [Counter-Strike Wiki, Kill Feed](https://counterstrike.fandom.com/wiki/Kill_Feed)
* [LHM Ultra HUD, CS2 HUD & Broadcast Overlay](https://lhm.gg/features/ultra-hud/cs2)
* [GitHub, Custom CS2 HUD for Observers and Commentators](https://github.com/JohnTimmermann/Custom-CS2-HUD)
* [LiveSplit](https://github.com/livesplit/livesplit)
* [OBS Speedrun Layout with Multiple Split Timers](https://salivity.github.io/obs-studio/article/obs-speedrun-layout-with-multiple-split-timers)
* [Wikipedia, The Crystal Maze](https://en.wikipedia.org/wiki/The_Crystal_Maze)
* [UKGameshows, The Crystal Maze](https://www.ukgameshows.com/ukgs/The_Crystal_Maze)
* [Game Shows Wiki, The Crystal Maze](https://gameshows.fandom.com/wiki/The_Crystal_Maze)
* [Legends of the Hidden Temple Wiki, Temple Run](https://legends.fandom.com/wiki/Temple_Run)
* [Paramount Wiki, Legends of the Hidden Temple](https://paramount.fandom.com/wiki/Legends_of_the_Hidden_Temple)
