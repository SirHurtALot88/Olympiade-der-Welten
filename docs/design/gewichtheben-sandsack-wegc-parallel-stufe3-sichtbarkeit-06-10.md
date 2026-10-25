# Gewichtheben Sandsack Weg C parallel — Stufe 3: Sichtbarkeit der freien Stationswahl (06.10.)

**Status: erste ehrliche Fassung, im echten Spiel sichtbar und spielbar, weiter hinter dem
Schalter `BUEHNE_FLAGS.gewichthebenSandsack`, standardmäßig AUS.** Mit Flag 10 zeigt ein
echtes Gewichtheben-Spiel (Arena-Tab, „Kampf starten") jetzt die Sandsack-Schicht: zwölf Träger
gleichzeitig an drei Stationen, mit HUD, Ticker, Boxscore und Endstand. Flag 0 (sechs
Hantel-Duelle) und Flag 1…9 bleiben bit-identisch (Abschnitt 6). **Fertig poliert ist es nicht**
(Abschnitt 7).

Grundlage, in dieser Reihenfolge:

* `gewichtheben-sandsack-wegc-parallel-stationen-05-10.md` (Struktur: 6 gegen 6, drei Stationen,
  35/80/115 kg, 24/16/8 m, 150 s),
* `gewichtheben-sandsack-wegc-parallel-entscheidungen-05-10.md` (normal/durch/direkt, Rampenfuß),
* `gewichtheben-sandsack-wegc-freie-stationswahl-05-10.md` (Flag 10, Stand der Mechanik),
* `gewichtheben-sandsack-trage-pose-05-10.md` (Stufe 1: sechs Posen, Jutesack, kein Schild),
* Stilvorbild: `gewichtheben-sandsack-wegc-stufe3-sichtbarkeit-05-10.md` im Worktree
  `agent-afb966ede66427129` (Sichtbarkeit der älteren 2-gegen-2-Läufe). Von dort übernommen ist
  das **Muster** (Szene nur im Live-Pfad, Weichen in `stepBuehne`/`buehnenBewegung`/
  `zeichneBuehne`/HUD, spoilerfreie Tabelle, QA-Sonde zum Vorspulen), nicht der Code: Jener
  Zweig ist nicht in diesem Branch, und seine Struktur (drei Läufe nacheinander) ist abgelöst.

Die **Mechanik ist nicht verändert**. Flag 10 liefert dieselben Zahlen wie vorher (Hash
identisch, Abschnitt 6): rho 0,849, schwächste Paarung 0,825, Pp 11,3 / 10,0.

---

## 0. Ergebnis vorab

| Punkt aus dem Auftrag | Stand |
|---|---|
| 1. Bühnenbild, drei Stationen parallel, bis zu zwölf Figuren | **gebaut**: drei Reihen (eine je Station), Teams gespiegelt, Silos in der Mitte, Kamera-Fokus-Reihe |
| 2. Trage-Pose und Jutesack aus Stufe 1, feste Stufen je Station | **gebaut**: Station 1 Stufe 1/2, Station 2 Stufe 3/4, Station 3 Stufe 5/6 (obere Stufe nach relativer Last) |
| 3. Entscheidungen sichtbar | **gebaut**: Durchpowern = Vorlage + Tempostriche, Direkt = Hand-zu-Hand-Geste (einander zugewandt, Sack im Bogen, Ring), Ablage = abstellen + Atemwölkchen; Rutscher und Zwangspause mit den Stufe-1-Pantomimen |
| 4. Stationswechsel sichtbar | **gebaut**: Figur geht diagonal zum neuen Stapel, gestrichelter Weg mit Pfeil, Etikett „→ STATION k", jede Wechselzeile im Ticker |
| 5. HUD | **gebaut**: Schichtuhr (Restzeit), Arbeitswert je Team laufend (Bug, Leiste, Leinwand), Silo-kg am Turm, Belegung je Station (Punkte, hohl = unterwegs) |
| 6. Boxscore/Endstand | **gebaut**: Station(en) als Pfad, Säcke, Abl/Dur/Dir-Anteile, Pausen, Rutscher, Wechsel, Beitrag (AW), Note; Endstand-Overlay „… SIEGER — a : b · ARBEITSWERT" |
| 7. Wertung | Arbeitswert angezeigt, **im Code, in der Szene und in der Tabelle als vorläufig markiert** (Chris' Bestätigung offen) |
| Film = Mechanik | **60 von 60 Spielern** (5 Paarungen) gleiche Säcke, Pausen, Rutscher, Wechsel und Entscheidungen; Beiträge summieren sich auf den Arbeitswert (Differenz ≤ 1e-12) |
| Sendezeit | **fest 2:42** (3 s Auftakt + 3,5 s Aufstellung + 150 s Schicht + 5 s Ende), jedes Spiel im Fenster 2:30–4:00 |
| Isolation Flag aus | Flag 0…10, SHA-256 der drei Mess-Einstiege: **identisch** zum Basisstand `f21ac8a3`; alle 20 Disziplinen (`miss-alle-disziplinen.mjs 4`): **identisch** |

---

## 1. Die Darstellung von zwölf gleichzeitigen Trägern

**Das Problem:** Die Leinwand ist 1240 × 470 Pixel, oben liegt die HTML-Spielstandleiste
darüber (etwa 18 % der Höhe, Paket-2-Fund). Zwölf Figuren von je ~50 px, dazu Säcke,
Puste-Ringe und Namen, alle gleich groß nebeneinander, wären ein Gewimmel.

**Die Lösung: drei Reihen, gespiegelt, Fokus-Reihe.**

* **Eine Reihe je Station**, untereinander: oben Station 1 (Depot, 35 kg, 24 m), Mitte Station 2
  (Steg, 80 kg, 16 m), unten Station 3 (Rampe & Silo, 115 kg, 8 m). Jede Station ist damit eine
  eigene Bildzone.
* **Die Geometrie bleibt die der Mechanik.** Jede Reihe ist dieselbe gerade Bahn in Metern
  (Stapel bei 0 / 8 / 16 m, Silo bei 24 m). Der Stapel von Station 2 steht deshalb genau
  unter der Ablage von Station 1, der Stapel von Station 3 genau unter der Ablage von Station 2,
  der Rampenfuß bei 22 m vor einer kleinen Rampe. Wer die Reihen übereinander liest, sieht
  Chris' Bild: „Die leichten Säcke müssen vom Start bis zur Endstation, die schweren von
  Station 3 nur bis zur Endstation."
* **Die Teams sind gespiegelt.** Heim läuft nach rechts, Gast nach links, beide Silos stehen als
  Türme in der Mitte und reichen über alle drei Reihen (ein Einlauf je Reihe). Jede Reihe trägt
  so je Team zwei bis drei Figuren, auf eigenen Spuren mit leichtem Höhenversatz.
* **Kamera-Fokus:** Eine Reihe ist die Fokus-Reihe. Sie ist größer (Figuren ×1,14 statt ×0,84,
  mehr Höhe), heller und hat einen Spot. Die anderen beiden bleiben sichtbar. Der Wechsel
  dauert 0,6 s. Die **Regie** ist vorab aus dem Film geplant, also eine reine Funktion der
  Szenenzeit (Vorspulen und Abspielen liefern dasselbe Bild):
  * Fokus mindestens 3 s halten;
  * dann auf die Reihe mit dem wichtigsten Ereignis der nächsten 2 s schneiden: Rutscher (4) >
    Zwangspause, Stationswechsel (3) > Direktübergabe (2); ein gleich wichtiges Ereignis in der
    eigenen Reihe hält den Fokus;
  * ohne Ereignis nach 9 s zur nächsten Reihe (Rundgang).

  Gemessen: 24 bis 28 Schnitte je Schicht, also etwa alle 6 s. Unter dem Titel steht
  „Kamera: Station 2 (Direktübergabe)".
* **Etiketten über dem Kopf** (RUTSCHER, PAUSE, → STATION k, DIREKT, DURCH!, ABLAGE + RAST): in
  der Fokus-Reihe alle, sonst nur die wichtigen (Rutscher, Pause, Wechsel, Direkt). Sie stehen,
  solange das Ereignis dauert, mindestens 1,4 s.

**Verworfen** (nicht gebaut, nur erwogen): ein Lupen-Einsatz (Bild-im-Bild) für das
Fokus-Ereignis. Bei 470 px Höhe hätte er Teile der Bahn verdeckt; die wachsende Fokus-Reihe
erreicht dasselbe ohne Verdeckung.

## 2. 1:1 statt Heuristik: der Film

Bisher protokollierte Flag 10 nur Teilstrecken (`legs`), Zeitsegmente (`seg`) und Wechsel,
keine Orte und keine Abschnittsarten. Neu zeichnet `sandsackFreiLauf()` im **Hauptlauf** jeden
Abschnitt jedes Trägers auf (`Z.film`):

| Abschnitt | Ort | Last |
|---|---|---|
| `pause` (Zwangspause) | wo er steht | ja/nein |
| `auf` (Aufheben am Stapel oder vom Boden an der Ablage) | Stapel / Ablage | ja |
| `trag` (beladene Teilstrecke, mit Rutscher und dessen Zeitverlust) | von → bis | ja |
| `wucht` (am Silo) | Silo | ja |
| `geh` (leer zurück, auch der abgebrochene Rückweg bei der Direktübergabe) | von → bis | nein |
| `ablegen`, `rast` | Ablage | ja / nein |
| `wartet` (auf eine Direktübergabe) | Ablage | nein |
| `uebergabe` (Hand zu Hand, 0,3 s; Geber und Nehmer) | Treffpunkt | ja |
| `wechsel` (Fußweg zwischen zwei Stapeln) | Stapel → Stapel | nein |

Dazu je Abschnitt die Erschöpfung E am Ende (für den Puste-Ring), je Entscheidung an der Ablage
die Wahl (normal/durch/direkt/erzwungen) und je abgelegtem Sack, wann er an der Ablage liegt.
Ein Sack behält über Ablage und Direktübergabe dieselbe Objekt-Identität. Daraus wird der
**Beitrag** je Spieler berechnet (Abschnitt 4).

**Warum die Mechanik dabei nicht wackelt:** Der Film wird nur bei `protokoll=true` angelegt,
also nur im Hauptlauf von `baueSandsackParallelFrei()`. KI-Vorschau und Kontext-Inversion (die
Hunderte kleiner Simulationen fahren) haben keinen Film. `rec()` schreibt ausschließlich in
`Z.film`. Die einzige Umstellung im Rechenweg ist die Rutscher-Zeit (`rutZeit` erst
ausrechnen, dann addieren), das ist dieselbe Gleitkomma-Rechnung. Der Film liegt in einem
eigenen Global `SANDSACK_PAR_FILM`, **nicht** in `SANDSACK_WEGC`, das die Messskripte ausgeben
und hashen. Nachweis in Abschnitt 6.

**Was rekonstruiert ist:** Nur der Ort des Rutschers innerhalb einer Teilstrecke. Er liegt bei
45 % des Wegs, wie in den 2-gegen-2-Läufen. Beginn, Ende und Zeitverlust stehen im Film. Läuft
die Teilstrecke über die Schlusshupe, rutscht der Sack spätestens 0,5 s vor der Hupe. Die
Mechanik zählt diesen Rutscher (gewürfelt beim Losgehen), also soll er auch zu sehen sein.
Ohne diese Regel zeigte eine Paarung einen Rutscher weniger als die Mechanik.

## 3. Was im Bild passiert

**Zeitplan eines Spiels** (fest, unabhängig vom Spielverlauf):

| Abschnitt | Dauer | Inhalt |
|---|---:|---|
| Auftakt | 3,0 s | Tafel: Format, Stationen, Entscheidungen, „Arbeitswert (vorläufig)" |
| Startaufstellung | 3,5 s | Tafel mit der Aufstellung nach LAST; die Figuren gehen an ihre Stapel |
| Schicht | 150 s | 1:1 (`zeitFaktor()` liefert für die Szene 1, sonst würde die Dehnung 4 der Hantel die Schicht auf 10 Minuten strecken) |
| Schicht-Ende | 5,0 s | Hupe, Tafel „SCHICHTENDE — X GEWINNT", Arbeitswert, Silo-kg, Säcke, Teamfeier |

**Je Träger** spielt die Szene den Film ab:

* **Tragen** mit der Stufe-1-Pose (`zeichneSandsackTragePose()`, unverändert), Jutesack, kein
  Schild. Die Stufe hängt an der Station: Station 1 Stufe 1 (gedoppelt 2), Station 2 Stufe 3
  oder 4 (ab 75 % der Traglast K), Station 3 Stufe 5 oder 6 (ab 95 % von K). Ein Kraftpaket
  trägt den 115-kg-Sack also sichtbar leichter als ein Aushelfer an seiner Grenze. Gedoppelte
  Säcke bekommen ein „×2".
* **Ablegen + Rast:** Pause-Pose bis 15 % (der Sack sinkt auf den Boden), danach steht er
  aufrecht und atmet (Wölkchen). Der Sack liegt an der Ablage, bis der Partner ihn aufhebt.
* **Durchpowern:** 0,9 s lang nach der Entscheidung Vorlage (Rumpf 0,1 rad nach vorn) und drei
  Tempostriche hinter der Figur. „DURCH!" in der Fokus-Reihe.
* **Direktübergabe:** Geber und Nehmer stehen einen halben Schritt vor und hinter dem
  Treffpunkt, einander zugewandt, bis der Sack die Hand gewechselt hat. Der Sack wandert im
  Bogen vom einen zum anderen, am Boden pulsiert 1,2 s ein grüner Ring, „DIREKT". Der Versatz
  blendet über 0,4 s ein und aus, damit nichts springt.
* **Rutscher / Zwangspause:** die Stufe-1-Pantomimen (Bücken nach dem gefallenen Sack mit
  Sandwolke; vornübergebeugt mit der Hand auf dem Knie), Etikett, Ticker, Ton.
* **Stationswechsel:** Die Figur geht vom alten zum neuen Stapel, im Bild diagonal von Reihe zu
  Reihe. Ein gestrichelter Weg mit Pfeil liegt in Teamfarbe darunter, darüber steht „→ STATION k".
  In der Belegungsanzeige ist sie ein hohler Punkt an der Zielstation.
* **Puste-Ring** aus der echten Erschöpfung (E am Ende jedes Abschnitts, linear dazwischen).
* **Silo:** Füllstand = abgelieferte Silo-kg im Bild, Beschriftung „SILO · 2140 kg".

**Ticker** (jede Zeile am Moment, an dem sie im Bild passiert): Format, Aufstellung je Team,
Hupe, **jeder Stationswechsel** („Johanna wechselt von Station 1 zu Station 2."), jeder
Rutscher, jede Zwangspause, Zwischenstand alle 30 s, Schlusshupe mit Sieger. Direktübergaben und
Durchpowern sind zu häufig für den Ticker (rund 120 Entscheidungen je Schicht). Deshalb
erscheint die erste Direktübergabe je Team immer, danach nur Übergaben und Durchpowern in der
Fokus-Reihe, mit mindestens 6 s Abstand. Töne: Hupe, `sack_fall`, `keuchen`, `uebergabe`,
`laufsieg`, Publikums-Loop (alle aus Paket 2).

## 4. HUD, Boxscore, Endstand

* **Scorebug/`#score`:** Arbeitswert a : b, wächst mit jedem abgelieferten Sack. Uhr = Restzeit
  der Schicht. Unterzeile „Alle gleichzeitig an drei Stationen, 150-s-Schicht — Arbeitswert
  (vorläufig)", Suffix „Arbeitswert", „6 an den Stationen".
* **Teambalken:** Arbeitswert im Bild gegen einen festen Maßstab (1300). So verrät die Länge
  keinen Endstand.
* **Leinwand unten:** Schichtuhr mit Fortschrittsbalken (rot in den letzten 10 s), Arbeitswert
  je Team, **Belegung** je Station (S1 ●● S2 ●● S3 ●●, hohl = unterwegs dorthin), der Hinweis
  „Wertung: Arbeitswert — vorläufig, Silo-kg oder Arbeitswert ist noch offen".
* **Kaderleiste:** je Spieler „S2→3 · 238" (Stationspfad · Beitrag), Balken = Beitrag, Maßstab =
  bisher gezeigtes Maximum. Mittelzeile „AW a : b".
* **Einlauf:** „STATION 3 · POWER OPENER" (Startstation vor dem Slot).
* **Plantext:** „Sandsack-Schicht, 6 gegen 6, drei Stationen."
* **Boxscore** (`WERTUNG_SANDSACK_PAR`, live und im Endstand-Overlay):

  | Spalte | Bedeutung |
  |---|---|
  | St | Startstation und jeder Wechsel („2→3") |
  | Säcke | getragene Säcke, anteilig nach Metern (Ablage/Übergabe teilt einen Sack), wie `u.lastSaecke` |
  | Abl% / Dur% / Dir% | Anteile seiner Entscheidungen an der Ablage (Dur% schließt erzwungenes Durchpowern ein) |
  | Pau / Rut / Wch | Zwangspausen, Rutscher, Stationswechsel |
  | **AW** | **Beitrag zum Arbeitswert:** jeder bis zur Hupe abgelieferte Sack verteilt seinen Arbeitswert nach getragenen Metern auf alle, die ihn getragen haben. Die Summe je Team ist genau der Arbeitswert der Mannschaftswertung. Spalte für „Spieler des Spiels" |
  | Note | Tragenote (Spielerwert/10), erst nach der Schlusshupe |
  | Eig | Eignung |

  Spoilerfrei: Alles wächst mit dem Bild, die Note kommt erst am Ende. Nach `done` stehen
  genau die Werte der Mechanik (`u.lastSaecke`, `u.lastPausen`, `u.lastRutscher`, `u.parEntsch`,
  `u.parFrei.wechsel`, `u.tragenote`).
* **Endstand:** `buehneStand()`/`buehneSieger()`/`buehneEinheitLabel()` lesen den Arbeitswert;
  nach `done` gilt der Sieger der Mechanik (Arbeitswert, dann Silo-kg, dann Los), auch wenn die
  gerundeten Zahlen gleich aussehen. Overlay „VIGILANTE WRANGLERS SIEGER — 1289 : 985 ·
  ARBEITSWERT".

**Wertung:** Angezeigt wird der Arbeitswert, weil Flag 10 so wertet (`freiWertung 1`). Ob die
Mannschaft nach Silo-kg oder Arbeitswert gewinnt, hat **Chris noch nicht bestätigt**
(Freie-Stationswahl-Doku, Abschnitte 3 und 10.1). Das steht im Kopfkommentar des Szenenblocks,
an `updateHudBuehne()` und `buehneStand()`, auf der Leinwand, auf der Auftakt- und der Ende-Tafel
und in der Fußzeile der Tabelle. Schaltet man `freiWertung` auf 0, zeigt die Szene trotzdem den
Arbeitswert an; der Sieger käme dann aus der Mechanik (Silo-kg). Diese Umstellung ist **nicht**
eingebaut. Sie wäre eine Zeile, sobald Chris entschieden hat.

## 5. Verdrahtung: Live-Pfad und Messpfad sind getrennt

| Stelle | Änderung | bei Flag ≠ 10 / im Messlauf |
|---|---|---|
| `sandsackFreiLauf()` | `rec()` in `Z.film`, nur wenn `Z.film` gesetzt | Flag ≠ 10 erreicht die Funktion nie; Vorschau/Inversion ohne Film |
| `sandsackFreiSchicht()` | `Z.film` nur bei `protokoll` | — |
| `baueSandsackParallelFrei()` | setzt `SANDSACK_PAR_FILM` | nur Flag 10 |
| `bauBuehne()` | setzt `SANDSACK_PAR_FILM`/`_SZENE` zurück | immer null |
| `build()` (Live) | nach `bauBuehne()`: `if(SANDSACK_PAR_FILM)sandsackParSzeneBauen()` | Film null → nichts |
| `MOTOREN[bd].bau()` (Messung) | **unverändert**, baut nie eine Szene | — |
| `MOTOREN[bd].sichern()/zurueck()` | `SANDSACK_PAR_FILM`/`_SZENE` mitgesichert | immer null |
| `stepBuehne()` | `done` erst, wenn die Szene fertig ist | Szene null → wie vorher |
| `buehnenBewegung()`/`zeichneBuehne()` | Szene → `stepSandsackParSzene()`/`zeichneSandsackParBuehne()` | nicht erreicht |
| `zeitFaktor()` | 1 bei laufender Szene | wie vorher |
| HUD, Tabelle, Stand, Kaderleiste, Einlauf, Plantext | Weiche auf `SANDSACK_PAR_SZENE` bzw. Flag 10 | nicht erreicht |

Die Szene ist reine Anzeige (Klasse A). Sie ruft kein `rr()` auf und schreibt nur viz-Felder
(`vizAniPhase` aus dem zurückgelegten Weg, `vizPuste`).

**QA-Sonde:** `window.__arena.sandsackParSzene(sekunden)` spult das live gebaute Spiel über
`stepBuehne()` vor. Sie liefert Zeitplan, Fokus, Höhepunkte und die letzten Figurenorte, am Ende
dazu den Abgleich Film gegen Mechanik je Spieler.

## 6. Validierung

**Isolation, Flag aus** (gegen den Basisstand `f21ac8a3`, `git archive` in eine Kopie):

| Prüfung | Ergebnis |
|---|---|
| `scripts/pruefe-sandsack-wegc-isolation.mjs` (neu): SHA-256 je Flag über `spieleBuehneHeben`, `spieleSandsackFinale`, `spieleSandsackWegC`, 5 Paarungen × 4 Saaten, Flags 0…10 | **alle elf identisch**, Gesamt `dec53a1fd5af06e6` = `dec53a1fd5af06e6` (Flag 0 `0eb31561c09194e7`, Flag 10 `c29664ad0cc4ec0c`) |
| `miss-alle-disziplinen.mjs 4`, alle 20 Disziplinen | Ausgabe **byte-identisch** (`diff` leer) |

Damit gelten die Flag-10-Abnahmen der Vorgänger-Runde unverändert (rho 0,849 / schwächste
0,825, Pp 11,3 / 10,0). Die Szene ändert die Mechanik nicht.

**Nebenbefund (vorbestehend, nicht behoben):** Der Hash von Flag 9 hängt davon ab, was im
selben Seitenleben vorher gelaufen ist. Mit `--flags=9,10` ergibt sich ein anderer Flag-9-Hash
als im Lauf 0…10. Das gilt im Basisstand genauso, der Wert ist dort derselbe (`2cff3223…`).
Vermutlich hält ein Cache (`sandsackKetteRefCache`, gekeyt über `JSON.stringify(KO)`) oder ein
Teilnehmer-Feld Zustand über Spiele hinweg. Vergleiche deshalb immer mit derselben Flag-Liste.

**Film gegen Mechanik** (`screenshot-sandsack-wegc-parallel.mjs --nur-abgleich --paarung=k`,
k = 0…4, je ein Live-Spiel bis zum Ende gespult):

| Paarung | Sieger | Arbeitswert | Rutscher / Pausen / Wechsel / Direkt im Film | Kamera-Schnitte | Film = Mechanik |
|---:|---:|---|---|---:|---|
| 0 | Heim | 1327 : 972 | 8 / 2 / 5 / 24 | 24 | 12/12 |
| 1 | Heim | 1217 : 1010 | 6 / 4 / 4 / 14 | 28 | 12/12 |
| 2 | Gast | 1100 : 1160 | 14 / 1 / 3 / 13 | 24 | 12/12 |
| 3 | Gast | 660 : 792 | 12 / 12 / 2 / 11 | 24 | 12/12 |
| 4 | Gast | 689 : 957 | 8 / 6 / 3 / 16 | 25 | 12/12 |

Je Spieler verglichen: Säcke (anteilig, auf 0,01), Pausen, Rutscher, Wechsel und alle vier
Entscheidungsarten. Die Summe der Beiträge weicht je Team höchstens um 1e-12 vom Arbeitswert der
Wertung ab. Seitenfehler: keine.

**Sendezeit:** fest 161,5 s = **2:42**, in jedem Spiel gleich (die Schicht ist zeitbegrenzt).
Die Vorgänger-Doku hatte 2:47 geschätzt.

## 7. Sichtproben

Erzeugt mit `node scripts/screenshot-sandsack-wegc-parallel.mjs docs/design`: echte Seite,
Flag über `window.__olyBuehneFlags` vor dem Laden, Disziplinwahl per Klick, „Kampf starten",
danach angehalten und über die QA-Sonde gespult. Gezeigt wird der Standardkader der Seite
(Vigilante Wranglers gegen Armageddon Aftermath, 1289 : 985).

| Datei (`docs/design/gewichtheben-sandsack-wegc-parallel-stufe3-…-06-10.png`) | Inhalt |
|---|---|
| `einlauf` | Einlauf vor dem Anpfiff: „STATION 3 · POWER OPENER" … für beide Seiten |
| `auftakt` | Auftakt-Tafel, die Figuren warten am Rand |
| `startaufstellung` | Tafel mit der Startaufstellung; die Figuren gehen an ihre Stapel |
| `schicht` | laufende Schicht, alle drei Stationen, Fokus auf Station 2 |
| `hud` | ganze Arena mitten in der Schicht: Bug „Arbeitswert", Unterzeile, Kaderleiste „S2→3 · …" |
| `durchpowern` | Station 3: Draco powert mit 115 kg durch (Vorlage, Tempostriche) |
| `direkt` | Station 2: Gram gibt Krolach den Sack direkt in die Hand |
| `wechsel` | Johanna wechselt von Station 1 zu Station 2 (Diagonalweg, „→ STATION 2", hohler Belegungspunkt) |
| `rutscher` | Station 2: Ralazar rutscht der 80-kg-Sack weg |
| `pause` | Station 2: Tidesprinter muss verschnaufen |
| `endstand`, `endstand-overlay` | Endstand-Overlay mit Boxscore, Kaderleiste |
| `lupe-durchpowern`, `lupe-direkt`, `lupe-wechsel`, `lupe-rutscher`, `lupe-pause` | dieselben Momente mit 2,5-facher Pixeldichte, Ausschnitt um die Figur |

## 8. Was an Politur fehlt (ehrlich)

1. **Kleine Figuren.** Auf der 1240-px-Leinwand sind die Figuren in Nebenreihen ~42 px hoch, in
   der Fokus-Reihe ~57 px. In Originalgröße liest man Tragen, Rutscher und Pause; die Feinheiten
   der Pose (Hand am Sack, Kreuzstich) sieht man erst in der Lupe. Namen überlappen, wenn zwei
   Träger dicht beieinander gehen.
2. **Direktübergabe ist kurz.** Die Mechanik gibt ihr 0,3 s. Die Geste (einander zugewandt, Sack
   im Bogen) dauert genau so lange; nur Ring und Etikett stehen 1,2 s. Eine längere Geste würde
   den Film verfälschen. Bei Tempo 2× oder 4× ist sie kaum zu sehen.
3. **Vollbild-Kreaturen** (z. B. Tidesprinter, Krag'Zul) bekommen wie in Stufe 1 nur die
   Ganzkörper-Fassung der Pose: Sie neigen sich, aber Arme greifen nicht.
4. **Rast und Wuchten haben keine eigene Pose.** Rast ist aufrechtes Stehen mit Atemwölkchen.
   Am Silo hebt sich die Figur kurz, der Sack verschwindet, der Turm füllt sich. Ein
   „Sack fliegt in den Silo"-Bogen fehlt.
5. **Stapel leeren sich nicht.** Die Schicht ist zeitbegrenzt, der Stapel ist unbegrenzt; das ist
   richtig, sieht aber statisch aus.
6. **Der Stationswechsel ist im Bild diagonal.** In der Mechanik geht man 8 m auf derselben Bahn
   zum nächsten Stapel. Die Reihen sind eine Darstellungshilfe, keine eigenen Hallen.
7. **Die Regie ist eine erste Regel**, nicht abgestimmt (3 s halten, 2 s Vorschau, 9 s Rundgang,
   Prioritäten 4/3/2). 24 bis 28 Schnitte je Schicht. Ob das zu unruhig ist, sollte Chris im
   echten Ablauf ansehen.
8. **Der Ticker ist ausgedünnt** (Abschnitt 3): Nicht jede der rund 120 Entscheidungen steht dort.
   Die vollständigen Zahlen hat der Boxscore.
9. **Nicht geprüft:** Kader mit weniger als sechs je Seite (die Saison würfelt 2–6). Die Szene
   rechnet mit beliebig vielen Trägern je Station, gesehen ist es nicht. Tempo 2×/4× ist nur
   rechnerisch abgedeckt (dieselbe Schrittfunktion).
10. **Kaderbildschirm (Aufstellung)** zeigt für Flag 10 keine Stationsmarke je Slot. Die
    Startstation hängt an der LAST-Reihenfolge der Aufgestellten. Einlauf und Plantext sagen es.
11. **Flag 8/9 haben keine Szene.** Sie laufen durch `sandsackKetteSchicht()` ohne Film. Flag 10
    mit `freiModus 1` rechnet dieselben Zahlen wie Flag 9 und hätte damit eine Szene, ist aber
    nur ein Messhebel.
12. **Liga/Produktion:** wie bei den 2-gegen-2-Läufen nicht verdrahtet. Der Headless-Runner setzt
    `__olyBuehneFlags` nie, die Saison spielt weiter die Hantel. Ein Umstieg bräuchte Chris'
    Entscheidung zum Format **und** zur Wertung, eine neue PPS-Referenz und die Durchleitung der
    Boxscore-Felder.
13. **Merge mit der 2-gegen-2-Stufe 3** (`agent-afb966ede66427129`): Beide Zweige setzen Weichen
    an denselben Stellen (`build()`, `stepBuehne()`, `buehnenBewegung()`, `zeichneBuehne()`,
    `updateHudBuehne()`, `buehneStand()`, `WERTUNG_CHASSIS.buehne`, `zeitFaktor()`,
    `sichern()`). Die Konflikte sind mechanisch: beide Weichen nebeneinander, die Parallel-
    Weiche zuerst. Sie sind aber von Hand aufzulösen.

## 9. Befehle und Dateien

```
node scripts/screenshot-sandsack-wegc-parallel.mjs docs/design
node scripts/screenshot-sandsack-wegc-parallel.mjs /tmp/x --nur-abgleich --paarung=0
node scripts/pruefe-sandsack-wegc-isolation.mjs [--flags=0,1,...,10] [--seite=pfad/battle-mode.html]
node scripts/miss-alle-disziplinen.mjs 4
```

* `public/mockups/battle-mode.engine.js`:
  * Film in `sandsackFreiLauf()` (`rec`, `warteEnde`, Abschluss offener Abschnitte),
    `Z.film` in `sandsackFreiSchicht()`, `SANDSACK_PAR_FILM` in `baueSandsackParallelFrei()`;
  * Block „SANDSACK WEG C PARALLEL — STUFE 3" vor `baueHebenDuelle()`: Geometrie, Stufen,
    Höhepunkte, Regie, Szene, Ticker, Stand, Sichtbarkeit je Spieler, Zeichnen,
    `WERTUNG_SANDSACK_PAR`;
  * Globals `SANDSACK_PAR_FILM`/`SANDSACK_PAR_SZENE` (+ Reset, `sichern`/`zurueck`);
  * Weichen in `build()`, `stepBuehne()`, `buehnenBewegung()`, `zeichneBuehne()`, `zeitFaktor()`,
    `updateHudBuehne()`, `buehneStand()`/`buehneSieger()`/`buehneEinheitLabel()`,
    `WERTUNG_CHASSIS.buehne`, Kaderleiste, KG-Mittelzeile, Einlauf, Plantext;
  * QA-Sonde `window.__arena.sandsackParSzene()`.
* `scripts/screenshot-sandsack-wegc-parallel.mjs` (neu), `scripts/pruefe-sandsack-wegc-isolation.mjs` (neu).
* Dieses Dokument und die PNGs aus Abschnitt 7.
