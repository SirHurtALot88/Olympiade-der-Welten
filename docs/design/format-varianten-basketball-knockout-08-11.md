# Format-Variante Basketball „Knockout“: Vorab-Sonde und Prototyp (08.11.)

Fortsetzung von Teil 3 aus Chris' Vision (Format-Varianten: gleiche Matrix, anderes Gameplay).
Die Vorarbeit liegt in zwei Papieren. `docs/design/format-varianten-brainstorm-08-11.md` ist Fables
Ideenrunde, Kandidat 4.5 ist „Knockout“. `docs/design/format-varianten-machbarkeit-08-11.md` ist der
Tauziehen-Prototyp (Draft-PR #1350, Branch `claude/format-varianten-prototyp-0811`, noch nicht auf
`main`). Dort steht in Abschnitt 8 die Empfehlung, zuerst zu messen und erst danach Bilder zu bauen.
Genau in dieser Reihenfolge ist dieses Papier entstanden.

**Nichts hier ist Produktionscode.** Sim, Sonde und Seite liegen neben dem Motor, die App lädt sie
nicht. `battle-mode.engine.js`, `battle-mode.rezepte.js` und die Matrix sind unberührt.

---

## 0. Ergebnis vorab

| Frage | Antwort |
|---|---|
| Welche Teilwerte hat Basketball? | **Zehn**, nicht neun: AUFBAU, ABSCHLUSS, TECHNIK, SCHUSS_NAH, SCHUSS_FERN, ZWEITCHANCE, ABWEHR, TEAMGEIST, AUSDAUER und **LAUFTEMPO** (speed 52, stamina 32, dexterity 16). Dazu kommt der Freiwurf-Kanal im Motor (spirit 48, intelligence 35, dexterity 17). Abschnitt 8 der Machbarkeit irrt hier, Fables Kanalliste stimmt (Abschnitt 1). |
| Trägt Fables Knockout mit einem Leben? | **Nein.** Die Sonde misst rho je Spiel **0,605 / 0,591**. Das hat zwei Ursachen, die sich getrennt messen lassen. Erstens die Reihenposition: Man wird immer vom selben Nachbarn gejagt, deshalb liegt die Validität nur bei 0,67–0,88. Zweitens gibt es zu wenig Daten: 4,5 Würfe je Werfer, der Erstausgeschiedene hat 1,2. Fables eigenes Risiko bestätigt sich (Abschnitt 3). |
| Gibt es eine Reparatur? | Ja: **drei Leben und eine Neuauslosung der Reihe nach jedem Umlauf**, als Spielerwert Platz plus Sekunden-Marge. Das ergibt rho **0,825 / 0,811**, auf einem frischen dritten Saatstrom **0,811**, die Validität liegt bei 0,90–0,97. Die Pp-Abweichung beträgt **20,9 / 21,1 / 22,7**. Das Bild bleibt Fables Bild: eine Reihe, ein Korb, „Knockout!“. |
| Was kostet die Reparatur? | Spielzeit und steile Wurfkurven. Die Spielzeit steigt im Median von ~1:35 auf **~5:10** (p10 4:14, p90 6:25), im Bereich des Live-Basketballs (4 × 90 s) und unter dem Hantel-Duell (7:11). Die Trefferkurven sind etwa **doppelt so steil** wie der Freiwurf im Live-Motor. Bei flacher Kurve kommen auch drei Leben nur auf ~0,6 (Abschnitt 3.2). |
| Pp im Detail | spirit liegt über der Matrix (28,5 statt 22), awareness darunter (7,7 statt 14). Jedes Basketball-Rezept enthält spirit, awareness fehlt im Freiwurf ganz. Kein Nullattribut trägt (health, will, determination je 0,0). |
| Prototyp | `public/mockups/basketball-knockout-prototyp.html`: echte PixelLab-Figuren in der PixelLab-Parketthalle der Basketball-Szene, zwei Bälle, Abpraller, Korbleger, Knockout-Einblendung, Leben-Punkte, spoilerfreier Boxscore und Ticker (Abschnitt 5). |
| Einschränkung | Die Konstanten sind an denselben fünf Paarungen kalibriert, auf denen die Sonde misst. Slot-, Trait- und Formkanäle fehlen. Die Zahlen sind deshalb **optimistisch**. Mit 0,81–0,83 ist der Abstand zur 0,80-Schranke klein, kleiner als beim Tauziehen (0,853 / 0,857). Die Pflichtabnahme im Motor kann das Format noch kippen. |

---

## 1. Das Basketball-Rezept: was wirklich zählt

**Matrix** (`lib/player-generator/official-discipline-weights.ts`, gesperrt): spirit 22,
intelligence 16, awareness 14, charisma 11, speed 10, dexterity 8, power 7, stamina 6, torment 6;
health, will und determination je 0.

**Rezept** (`public/mockups/battle-mode.rezepte.js`, `basketball:{…}`, Zeilen 194–426). Zur
Prüfung habe ich die Datei in Node geladen und `Object.keys(window.__ARENA_REZEPTE.basketball)`
gelesen. Das Ergebnis sind zehn Schlüssel:

| Teilwert | Zusammensetzung | im Knockout |
|---|---|---|
| ABSCHLUSS | spirit 22, dex 20, cha 16, power 14, aw 10, sta 10, int 8 | — (Auswahl-Logik im Live-Spiel) |
| TECHNIK | int 50, aw 22, spirit 16, dex 12 | **Sprungwurf nach langem Abpraller, Wurfwahl** |
| SCHUSS_NAH | power 34, spirit 30, sta 16, aw 12, dex 6, torm 2 | **Korbleger** |
| ZWEITCHANCE | int 24, spirit 23, aw 22, torm 20, speed 9, sta 2 | **Abpraller: wie schnell, wie nah am Korb** |
| TEAMGEIST | cha 56, spirit 44 | **Druck auf den Vordermann, Ruhe an der Linie** |
| LAUFTEMPO | speed 52, sta 32, dex 16 | **Sprint zum Abpraller, Weg zum Korbleger** |
| AUFBAU, SCHUSS_FERN, ABWEHR, AUSDAUER | — | nicht gelesen |
| Freiwurf-Kanal (`FREIWURF_KANAL`, `battle-mode.engine.js` ~Z. 14609, kein Sub-Skill) | spirit 48, int 35, dex 17 | **erster Wurf von der Linie** |

**Korrektur zur Machbarkeit, Abschnitt 8.** Dort steht: „Einen Teilwert `LAUFTEMPO` gibt es im
Basketball-Rezept nicht.“ Das stimmt nicht. LAUFTEMPO steht in Zeile 425 und wird im Live-Motor
gelesen (`tempoPx`, Rennen um lose Bälle). Der Kommentar „ohne LAUFTEMPO (disziplinübergreifend)“ in
Zeile 278 meint, dass die Kalibrierrunde #194 das Rezept nicht angefasst hat, weil Football es
zeichengleich teilt. Er sagt nicht, dass es fehlt. **Fables Zuordnung „speed → LAUFTEMPO
(Rebound-Sprint)“ ist also richtig.** Der Umweg über AUSDAUER oder ABWEHR ist unnötig. Er wäre auch
schlechter: AUSDAUER ist laut Rezeptkommentar im Live-Motor „mechanisch folgenlos“, und ABWEHR
führt torment.

**Hebelbedarf.** Mit einer nichtnegativen Ausgleichsrechnung über die Rezeptzeilen lässt sich
fragen, welche Mischung der Kanäle die Matrix ergibt. Ergebnis: ZWEITCHANCE ~29 %, TECHNIK ~20 %,
SCHUSS_NAH ~18 %, TEAMGEIST ~18 %, LAUFTEMPO ~14 %, Freiwurf ~0–3 %. Diese Mischung hätte eine
rechnerische Pp-Abweichung von 9,4. Daraus folgt der wichtigste Designbefund: **Ein Knockout, in
dem der Freiwurf entscheidet, reicht die Basketball-Matrix nicht durch.** Der Freiwurf-Kanal ist
fast nur spirit und intelligence. Die erste Kalibrierfassung mit flacher Kurve und Freiwurf-Basis
48 % ließ 71 % der Ballbesitze an der Linie enden und kam auf **Pp 53** (spirit 38 %,
awareness 5 %). Was die Matrix verlangt, ist der **Kampf um den Abpraller**, also Zweitchance,
Technik und Korbleger. Die Linie ist im Bild der Auftakt, mechanisch ist sie ein kleiner Hebel.
Die Freiwurf-Basis steht deshalb bei 35 %.

---

## 2. Die Mechanik

Datei: `public/mockups/basketball-knockout-prototyp.sim.js`.

**Teilnehmer.** Alle zwölf Spieler der Begegnung (6 + 6) stehen in einer Reihe. Das ist Lesart A
aus Abschnitt 3 der Machbarkeit, innerhalb der normalen Zwei-Team-Begegnung, ohne neuen Spielplan
und ohne neue Buchung. Teamkollegen knocken sich gegenseitig aus, das ist für den Spielerwert
gewollt.

**Regeln, wie auf dem Freiplatz.** Es gibt zwei Bälle. Der Vordermann wirft von der Linie. Trifft
er nicht, holt er den Abpraller und wirft weiter, bis der Ball drin ist. Der Hintermann darf werfen,
sobald der Vordermann geworfen hat. **Trifft der Hintermann zuerst, ist der Vordermann geknockt.**
Wer trifft, gibt den Ball nach vorn und stellt sich hinten an.

**Ein Ballbesitz** wird vorab gewürfelt, wie im Bühnen-Vertrag des Motors (kein Zufall in der
Bewegung). Er läuft so ab:
1. Ausholen und Wurf von der Linie. Die Trefferchance ergibt sich aus dem Freiwurf-Kanal, korrigiert
   um den Druck: (TEAMGEIST des Nächsten dahinter − eigener TEAMGEIST) × 0,0085.
2. Bei einem Fehlwurf folgt der Abpraller. Die Zeit bis zum gesicherten Ball sinkt mit ZWEITCHANCE
   und LAUFTEMPO. Ob der Abpraller kurz ist (Korbleger) oder lang, hängt an ZWEITCHANCE.
3. Bei langem Abpraller folgt die Wurfwahl: Sprungwurf (TECHNIK, schnell) oder zum Korb ziehen
   (SCHUSS_NAH, Weg abhängig von LAUFTEMPO). Gewählt wird das bessere Verhältnis von
   Trefferchance zu Zeit, das ist die „Shot Intelligence“ aus dem Rezeptkommentar.
4. So geht es weiter bis zum Treffer.

**Sieg.** Der Rang ist die Ausscheide-Reihenfolge, wer allein übrig bleibt, gewinnt. In der
reparierten Fassung (Abschnitt 3.3) kommen drei Leben dazu und eine Neuauslosung der Reihe nach
jedem Umlauf. Der Spielerwert ist **Platz + Sekunden-Marge aus allen Duellen** (je Duell auf ±4 s
gedeckelt). Mannschaft im Prototyp: Rangpunkte (13 − Platz, je Team summiert). Ob das so bleibt,
entscheidet Chris.

**Konstanten** (`K` in der Sim, Stand nach der Kalibrierung): Freiwurf 35 % bei 50, +1,12 Pp je
Punkt (Live-Motor 0,55 Pp); Korbleger 62 % bei 50, +2,4 Pp; Sprungwurf 42 % bei 50, +6,5 Pp;
Abpraller-Zeit 2,6 s, −0,15 s je ZWEITCHANCE-Punkt über 50, −0,08 s je LAUFTEMPO-Punkt. Im Schnitt
trifft jeder zweite Wurf (52 %).

---

## 3. Vorab-Sonde

`node scripts/miss-basketball-knockout-prototyp.mjs 48 [--saat-versatz=N] [--leben=N]
[--losen=fest|start|umlauf] [--wert=platz|marge|…] [--ohne-pp]`. Ohne Schalter misst sie die
empfohlene Fassung, Fables Original mit `--leben=1 --losen=fest --wert=platz`.

Methode wie beim Tauziehen: rho je Einzelspiel (Spearman zwischen Eignung und Spielerwert, Median
über 240 Spiele), Validität (Spielerwert über 48 Spiele je Paarung gemittelt), Star-Kennzahl und
Pp nach der Budget-Methode von `einflussVon()` (je Teilnehmer und Attribut +15, Gewinn im eigenen
Spielerwert, Anteile gegen die Matrix). Kader sind die fünf echten Paarungen aus
`data/generated/kaderfamilie-live-save.json` (je Seite die ersten sechs), Eignung ist
`d.basketball`.

### 3.1 Ergebnisse (Konstanten wie in der Sim, n = 48, Strom 0 / Strom 1)

| Fassung | Würfe je Spiel | Spielzeit (Median) | rho je Spiel | Validität je Paarung | Star Rang 1 / Top 2 | Pp |
|---|---:|---:|---:|---|---:|---:|
| **Fable: 1 Leben, feste Reihe** | 56 | 1:35 | **0,605 / 0,591** | 0,67–0,88 | 41 % / 65 % | 21,7 / 24,0 |
| 1 Leben, Neuauslosung je Umlauf | 57 | 1:35 | 0,559 / 0,566 | 0,85–0,97 | 23 % / 45 % | 18,6 / 22,1 |
| 2 Leben, Neuauslosung, Platz + Marge | 112 | 3:25 | 0,766 / 0,755 | — | 40 % / 70 % | 19,5 / 17,8 |
| 3 Leben, **feste** Reihe, Platz + Marge | 172 | 5:10 | 0,780 / 0,762 | — | 45 % / 82 % | 20,8 / 20,2 |
| 3 Leben, nur Start ausgelost | 173 | 5:10 | 0,804 / 0,797 | — | 40 % / 75 % | 16,7 / 16,7 |
| **3 Leben, Neuauslosung je Umlauf, Platz + Marge** | 173 | **5:10** | **0,825 / 0,811** (Strom 2: 0,811) | **0,90–0,97** | 31 % / 71 % · 40 % / 75 % | **20,9 / 21,1** (Strom 2: 22,7) |

Pp-Anteile der empfohlenen Fassung (Strom 0): spirit 28,5 (Matrix 22), intelligence 15,0 (16),
awareness 7,7 (14), charisma 11,8 (11), speed 10,3 (10), dexterity 7,1 (8), power 5,2 (7),
stamina 8,9 (6), torment 5,6 (6), health / will / determination 0,0.

### 3.2 Warum Fables Fassung nicht trägt

Nach der Zerlegung aus CLAUDE.md gilt rho(ein Spiel) = Validität × √Verlässlichkeit. Beide Faktoren
sind in Fables Fassung schwach, und zwar aus **verschiedenen** Gründen:

1. **Validität: Die Reihe ist ein Ring.** Wer trifft, stellt sich hinten an, die zyklische
   Reihenfolge bleibt also erhalten. Jeder Werfer wird deshalb das ganze Spiel lang vom
   **selben Nachbarn** gejagt. Bei fester Startreihe (Slot-Reihenfolge, Heim/Gast im Wechsel) ist
   dieser Nachbar in jedem Spiel derselbe. Das ist dasselbe Muster wie in Fables Tauziehen-Ring:
   Die Position zählt mehr als die Eignung. Über 48 Spiele gemittelt liegt die Validität einzelner
   Paarungen bei 0,67. Wird die Reihe ausgelost, steigt sie auf 0,85–0,97.
2. **Verlässlichkeit: zu wenig Würfe.** Mit einem Leben macht jeder Werfer im Schnitt **4,5 Würfe**,
   der Erstausgeschiedene **1,2**. Ein Wurf ist ein Münzwurf mit Schlagseite. Bei vier Würfen
   ordnet das Glück mehr als die Eignung. Auslosen allein hilft deshalb nicht: Die Validität steigt,
   rho bleibt bei 0,56.

**Hier helfen mehr Ereignisse, anders als bei Hockey.** CLAUDE.md warnt, dass mehr Ereignisse
„fast nie“ helfen. Gemessen wurde das an Hockey, das schon die dreizehnfache NHL-Ereignisdichte
hat. Knockout ist der Gegenfall: Mit 4,5 Würfen je Spieler fehlen schlicht Ereignisse. Die Leben
liefern sie. Mit drei Leben macht jeder Werfer ~14 Würfe, der Erstausgeschiedene 4,4.

**Steile Kurven sind Pflicht.** Mit einer Wurfkurve so flach wie im Live-Freiwurf (erste
Kalibrierfassung) kam selbst die Fassung mit drei Leben nur auf 0,59–0,62, mit fünf Leben auf 0,71.
Ein Wettbewerb mit ~15 Würfen je Spieler braucht Trefferquoten, die zwischen schwachen und starken
Werfern weit auseinanderliegen. Erzählerisch passt das (Knockout ist ein Schaulaufen der
Werfer), bei extremen Spielern wird es aber deutlich (Abschnitt 3.4).

### 3.3 Die Reparatur

Die Reparatur folgt demselben Gedanken wie beim Tauziehen (Ring → Eins-gegen-eins-Seile): Das
Bild bleibt, die Struktur wird so geändert, dass jeder ausreichend Daten bekommt und kein fester
Nachbar das Ergebnis bestimmt.
- **Drei Leben** gegen die Datenarmut. Ein Knockout kostet ein Leben, erst beim dritten ist man
  raus. Im Bild sind das drei Punkte unter dem Namen.
- **Neuauslosung der Reihe nach jedem Umlauf** gegen den festen Nachbarn. Sie bringt +0,02 bis
  +0,05 gegenüber einer festen Reihe (0,780 → 0,825).
- **Platz + Sekunden-Marge** als Spielerwert. Bei drei Leben bringt die Marge nur wenig zusätzlich.
  Sie trennt aber die Werfer, die im Mittelfeld nach demselben Schema ausscheiden.

**Verworfene Alternativen, alle gemessen** (teils bei Zwischenkonstanten, deshalb nur als Richtung):
- **Mehrere Durchgänge** (3 × Knockout mit einem Leben, Summe der Plätze): 0,755, bei gleicher
  Wurfzahl schlechter als drei Leben. Wer im zweiten Durchgang früh rausfliegt, verliert die
  Daten ein zweites Mal.
- **„Ewiges Knockout“** (niemand scheidet aus, feste Zeit, Konto aus Knocks minus Geknockt):
  0,70–0,73 bei 240 s. Pro Wurf ist das nicht besser als die Leben, und das Ausscheiden als
  Spannungsbogen fehlt.
- **Wurfnote / Rauswürfe im Spielerwert** („mix“) und **eigene Ballbesitz-Zeit** („tempo“):
  höchstens +0,03. Die reine Zeitwertung ist schlechter, weil sie nur Ballbesitze zählt, die mit
  einem Treffer enden.

### 3.4 Offene Punkte der Mechanik

- **Druckterm.** Der Druck wird ungedeckelt als Differenz der TEAMGEIST-Werte gerechnet. Ein
  Werfer mit TEAMGEIST 96 wirft dadurch gegen einen Hintermann mit 50 fast ohne Fehlwurf. Im
  Beispiel des Prototyps traf King Arlen 18 von 18 und gewann ungeschlagen. Ein Deckel kostet rho:
  ±0,25 ergibt 0,811 / 0,797, ±0,15 ergibt 0,790 / 0,776. Ob das ungedeckelt bleibt, ist eine
  Designfrage. Laut Matrix ist charisma ein starkes Attribut, das Spiel zeigt es nur sehr
  deutlich.
- **spirit über, awareness unter der Matrix.** Das ist strukturell: Alle sechs gelesenen Kanäle
  enthalten spirit (16–48), awareness kommt nur in ZWEITCHANCE, TECHNIK und SCHUSS_NAH vor. Mehr
  Sprungwürfe würden awareness heben, kosten aber rho. Bei Pp ~21 ist das vertretbar.
- **Kalibriert auf den Messdaten.** Wie beim Tauziehen sind die Zahlen optimistisch. Der frische
  dritte Saatstrom hält (0,811 / 22,7), andere Kader hat die Sonde aber nicht gesehen.

---

## 4. Einordnung neben dem Tauziehen

| | Tauziehen (Gewichtheben) | Knockout (Basketball) |
|---|---|---|
| Fables Original | Ring: 0,636 (strukturell, Validität bis 0,53) | 1 Leben: 0,605 (Validität bis 0,67 **und** zu wenig Würfe) |
| Reparatur | Schweizer Runden, Eins-gegen-eins-Seile | Drei Leben, Neuauslosung je Umlauf |
| rho repariert | 0,853 / 0,857 | 0,825 / 0,811 / 0,811 |
| Pp repariert | 11,3 / 9,9 | 20,9 / 21,1 / 22,7 |
| Sendezeit | ~1:35 | ~5:10 |
| Abstand zur Schranke | komfortabel | knapp |

Knockout ist billiger zu bauen als das Tauziehen (keine Seilphysik, ein Korb), aber mechanisch der
schwächere Kandidat. Mit drei Leben hält das Format die Schranke im Vorab-Modell, wenn auch knapp.
Ob es im Motor mit Slot-, Form- und Trait-Rauschen bei über 0,80 bleibt, zeigt erst die
Pflichtabnahme. **Meine Empfehlung:** Den Motor-Builder erst bauen, wenn Chris das Format mit drei
Leben und ~5 Minuten will. Vorher lohnt ein billiger Zwischenschritt: dieselbe Sonde mit den echten
Slot-Aufschlägen und Formkarten. Liegt sie dann unter 0,78, ist Knockout als **folgenloses
Zusatzspektakel** besser aufgehoben, zum Beispiel als Halbzeit- oder Finalshow wie das
Sandsack-Finale, das heute „bewusst folgenlos für `seiten`“ ist. Als Wertungsformat taugt es dann
nicht.

---

## 5. Der Prototyp

Öffnen: `public/mockups/basketball-knockout-prototyp.html` (im Next-Dev-Server unter
`/mockups/basketball-knockout-prototyp.html` oder mit `python3 -m http.server` aus `public/`). Mit
`?t=SEKUNDEN&halt=1` springt die Seite für die Sicht-QA vor, `?p=0..4` wählt die Paarung,
`?saat=N` die Saat.

| Datei | Inhalt |
|---|---|
| `public/mockups/basketball-knockout-prototyp.sim.js` | Mechanik (Abschnitt 2), Rezepte zeichengleich aus `battle-mode.rezepte.js` und `FREIWURF_KANAL`, eigene Saat (mulberry32), Film nur für die Anzeige (zieht keine Zufallszahl) |
| `public/mockups/basketball-knockout-prototyp.html` | Halle (Canvas 1920 × 852, Szenen-Skala 2), Reihe zur Mittellinie, Wurf von der Linie, Ballflug, Abpraller, Korbleger und Sprungwurf, Netz, „KNOCKOUT!“-Einblendung, Leben-Punkte, Ausgeschiedene an der Seitenlinie, Anzeigetafel (verbleibende je Team), spoilerfreier Boxscore, Ticker, Endstand mit den drei Besten und Rangpunkten |
| `public/mockups/basketball-knockout-prototyp/halle.png` | Kulisse aus der PixelLab-Parkettszene (`public/szenen/basketball/parkett.html`): Welt, beide Korb-Ebenen samt Spiegelung, Trainer wegretuschiert, Box-Score-Leiste abgeschnitten |
| `scripts/baue-kulisse-knockout-prototyp.py` | baut die Kulisse, nur aus Pixeln der Szene, ohne API, als eigene Datei neben der laufenden Kulissen-Integration |
| `public/mockups/basketball-knockout-prototyp/kader.json` | die fünf echten Paarungen (je sechs, Attribute und Basketball-Eignung) |
| `scripts/miss-basketball-knockout-prototyp.mjs` | Vorab-Sonde (Abschnitt 3) |

Bilder: `format-varianten-knockout-abpraller-08-11.png` (zwei Bälle, Korbleger),
`…-knock-08-11.png` (Knockout-Einblendung), `…-mitte-08-11.png` (zwei Ausgeschiedene an der
Seitenlinie), `…-seite-08-11.png` (Endstand mit Boxscore und Ticker).

### Was bis zur Produktion fehlt

1. **Eine Wurf-Pose.** Die PixelLab-Figuren haben `walk`, `angriff`, `treffer` und `tod`, aber
   keinen Wurf. Im Prototyp wirft jeder mit seiner Angriffsanimation (Tidesprinter wirft mit dem
   Dreizack-Zauber). Gebraucht wird eine eigene „Wurf“-Animation je Figur. Das entspricht der
   fehlenden „Zieh“-Pose beim Tauziehen.
2. **Motor-Builder** hinter eigenem Schalter, etwa `FELDSPIEL_FLAGS.basketballFormat`. Knockout ist
   eine Feldspiel-Disziplin, der Builder gehört deshalb an die `bauFeldspiel()`-Weiche, nicht an
   die Bühne. Er setzt den Spielerwert, den `MOTOREN.basketball.wert()` liest. Dazu kommt die
   Isolationsprüfung (Schalter aus = bit-identisch).
3. **Pflichtabnahme** mit `miss-alle-disziplinen.mjs` und `messe-arena-einfluss.mjs`, zwei
   Saatströme, mit Slot-, Trait- und Formkanälen. Ein eigener Eintrag in `disziplin-abnahme.json`
   je Format (Machbarkeit, Abschnitt 5).
4. **Slot-Bedeutung.** Die Basketball-Slots spielen im Knockout keine Rolle, die Reihe wird
   ausgelost. Eine mögliche Bedeutung wäre der Startplatz in der Reihe. Das kostet aber genau die
   Validität, die die Auslosung zurückgeholt hat (feste Reihe 0,780). Das braucht Chris'
   Entscheidung.
5. **Kleinere Kader** (2–6 je Seite). Bei weniger Werfern gibt es weniger Duelle. Die Zahl der
   Leben muss mitwachsen und je Kadergröße gemessen werden.
6. **Mannschaftswertung.** Im Prototyp gelten Rangpunkte (13 − Platz). Teaminterne Knocks sind
   dafür neutral.
7. **Druckterm** deckeln oder nicht (Abschnitt 3.4).
8. **Formatwahl, Kaderbildschirm, Picker, PPS-Referenz** wie in Abschnitt 6 der Machbarkeit.

**Nebenbefund für PR #1350.** Die Animationsblätter der PixelLab-Figuren haben quadratische Zellen
von 104 px, das Standbild hat `c` = 80. Der Tauziehen-Prototyp schneidet die Animationen mit `c`
zu und zeigt deshalb verrutschte Ausschnitte. Der Knockout-Prototyp nimmt die Blatthöhe als
Zellbreite (`zeichneFigur`).

---

## Quellen im Repo

- `lib/player-generator/official-discipline-weights.ts` (Matrix, Basketball-Spalte)
- `public/mockups/battle-mode.rezepte.js` Z. 194–426 (Basketball-Rezept, LAUFTEMPO Z. 425)
- `public/mockups/battle-mode.engine.js`: `FREIWURF_KANAL` / `freiwurfChance()` ~Z. 14609,
  `ftWert` in `bauFeldspiel()` ~Z. 10990, `mische()` ~Z. 8338
- `public/szenen/basketball/parkett.html` (Kulissenquelle), `public/mockups/battle-mode.figuren.js`
- `data/generated/kaderfamilie-live-save.json`
- `docs/design/format-varianten-machbarkeit-08-11.md`, `scripts/miss-tauziehen-prototyp.mjs`
  (Branch `claude/format-varianten-prototyp-0811`), `docs/design/format-varianten-brainstorm-08-11.md`
