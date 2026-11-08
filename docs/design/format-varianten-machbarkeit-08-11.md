# Format-Varianten je Disziplin: Machbarkeit, Matrix-Treue, Tauziehen-Prototyp (08.11.)

Der Auftrag ist Teil 3 von `docs/design/oberflaechen-effekte-und-rempler-vision-08-11.md`
(Branch `claude/vision-oberflaechen-tackling-0811`), wörtlich von Chris: Es geht um Format-Varianten
mit echt anderem Gameplay bei gleicher Eignungsmatrix, nicht um Skins. Fable hat die Ideenbreite
übernommen (`docs/design/format-varianten-brainstorm-08-11.md`, gleicher Branch). Dieses Papier ist
die technische Hälfte: wie der Präzedenzfall im Code gebaut ist, ob und wie Tauziehen die Matrix
durchreicht, wie es in die Spieltags-Architektur passt, wie es die Abnahme durchlaufen müsste. Dazu
kommt ein **spielbarer Prototyp**.

**Nichts hier ist Produktionscode.** Der Prototyp liegt neben dem Motor, die App lädt ihn nicht,
`battle-mode.engine.js` und die Matrix sind unberührt.

---

## 0. Ergebnis vorab

| Frage | Antwort |
|---|---|
| Wie wechselt Gewichtheben heute das Format? | Eine `if`-Weiche in `bauBuehne()` auf `BUEHNE_FLAGS.gewichthebenSandsack`. Die echte App setzt dieses Flag **nie**. Im Spiel läuft immer das Hantel-Duell. Eine Formatwahl gibt es noch nirgends (Abschnitt 1). |
| Bedient Tauziehen die Gewichtheben-Matrix? | Ja, wenn es **dieselben fünf Teilwerte** liest (LAST, TECHNIK, NERVEN, ANSAGE, ERHOLUNG) und **kein Ausdauerformat** wird. stamina wiegt 2, charisma 23. Ein Tauziehen, das auf Zähigkeit setzt, fällt bei Pp durch (Abschnitt 2). |
| „Alle gegen alle“: passt das in die Architektur? | Ja, und zwar **innerhalb der bestehenden Zwei-Team-Begegnung**: zwölf Zieher, kein neuer Spielplan, keine neue Buchung. Der Sandsack-Weg-C (zwölf Figuren gleichzeitig) ist das bauliche Vorbild. Ein Vier-Team-Pod ginge auch, ist aber viel teurer (Abschnitt 3). |
| Was sagt die Vorab-Sonde? | **Schweizer Runden** (fünf Runden, je sechs Eins-gegen-eins-Taue): rho je Spiel **0,853 / 0,857**, Pp **11,3 / 9,9** (n=48, zwei Saatströme). Die heutige Hantel liegt bei 0,865 / Pp 8,5–10,0. **Fables „Grube“ als gemeinsamer Ring**: rho **0,636 / 0,634**, Validität 0,53–0,80. Das liegt nicht am Rauschen, das Problem ist strukturell (Abschnitt 4). |
| Empfehlung | **Fables Bild mit Schweizer Mechanik**: zwölf Zieher rund um die Grube, je zwei Gegner auf gegenüberliegenden Speichen, sechs Seile kreuzen sich über dem Schacht. Mechanisch sind das sechs Eins-gegen-eins-Taue. So funktioniert der Prototyp in der Standardansicht. |
| Abnahme | Die Abnahme gilt **je Format**, nicht je Disziplin. Die Variante bekommt einen eigenen Schalterwert und läuft durch `miss-alle-disziplinen.mjs` und `messe-arena-einfluss.mjs`, mit `--flags=` und zwei Saatströmen. Bei ausgeschaltetem Schalter muss alles bit-identisch bleiben (Abschnitt 5). |
| Prototyp | `public/mockups/tauziehen-prototyp.html`: Stern- und Kaimauer-Ansicht, echte PixelLab-Figuren, Kulisse aus der PixelLab-Hafenszene, spoilerfreier Boxscore und Ticker. Was bis zur Produktion fehlt, steht in Abschnitt 7. |

---

## 1. Die Referenz-Implementierung: wie Gewichtheben heute das Format wechselt

Alles in `public/mockups/battle-mode.engine.js`, Stand `main` 462c38eff.

**Die Weiche** (`bauBuehne()`, ~Z. 20349):

```js
if(art.heben&&BUEHNE_FLAGS.gewichthebenSandsack>=6){ baueSandsackParallel(art,mine,gegner,saat); return; }
if(art.heben&&BUEHNE_FLAGS.gewichthebenSandsack>=2){ baueSandsack6v6(art,mine,gegner,saat); return; }
if(art.heben&&BUEHNE_FLAGS.gewichthebenSandsack>=1){ baueSandsackWegC(art,mine,gegner,saat); return; }
if(art.heben){ baueHebenDuelle(art,mine,gegner); baueSandsackFinale(art,mine,gegner,saat); return; }
```

- `BUEHNE_FLAGS={gewichthebenSandsack:0, speedSchachUhr:2, wettessenMauer:2}` (~Z. 19469). Gesetzt
  wird das Flag nur über `window.__arena.buehneFlags({...})` (die Messskripte mit `--flags=`) oder
  `window.__olyBuehneFlags` vor dem Laden. Laut Kommentar setzt die echte App beides nie.
- **Wer welches Format sieht, entscheidet heute also niemand.** Im Spiel läuft immer Wert 0, also
  sechs Hantel-Duelle plus das additive Sandsack-Finale. Dieses Finale ist bis zur Kalibrierung
  „bewusst folgenlos für `seiten`“ (TODO Task #60). Flag 10 (zwölf Träger an drei Stationen) ist
  im echten Spiel sichtbar und spielbar, aber nur hinter dem Schalter.
- **Gemeinsamer Vertrag aller Formate:** `setz()` mischt für jeden Teilnehmer die fünf Teilwerte
  aus `BUEHNE_ART.gewichtheben.rezept`, und zwar *bevor* die Weiche entscheidet. Jedes Format
  liest nur diese Felder und schreibt seine eigenen dazu (`u.summe` ist das, was
  `MOTOREN[...].wert()` und damit die Rangtreue liest). Der Sandsack hält sich ausdrücklich daran:
  „liest NUR u.LAST/u.TECHNIK/u.NERVEN/u.ANSAGE/u.ERHOLUNG“ (Kopfkommentar `SANDSACK_STATIONEN`).
  **Genau das macht ein zweites Format matrixtreu, ohne die Matrix anzufassen.**
- **Isolation:** Für jede Stufe gibt es eine SHA-Prüfung, dass Flag 0 bit-identisch bleibt
  (`scripts/pruefe-sandsack-wegc-isolation.mjs`, `miss-alle-disziplinen.mjs 4` über alle zwanzig).
- **Das nächste Vorbild für eine echte Wahl** ist `kulisseWaehlen()` (~Z. 42420): ein String-Hash
  aus Disziplin, Saat, Heim, Gast und Spieltag, ohne `rr()` und ohne Einfluss auf die Wertung.

**Folge für Teil 3:** Was Chris als „das Muster“ beschreibt, ist technisch ein Messschalter, keine
Formatwahl. Eine Formatwahl im Spiel muss erst gebaut werden, für das Sandsack-Rennen genauso wie
für jedes neue Format (Abschnitt 6).

---

## 2. Matrix-Treue: Tauziehen bei Gewichtheben

Matrix (`official-discipline-weights.ts`, gesperrt): **power 28, charisma 23, health 16,
determination 12, will 7, speed 6, dexterity 6, stamina 2**, Rest 0.

**Korrektur zur Vision.** Dort steht „Tauziehen nutzt KRAFT/AUSDAUER wie Gewichtheben“. Ausdauer
(stamina) wiegt aber nur **2**, charisma dagegen **23**. Ein Tauziehen, in dem der Zähere gewinnt,
reicht die Matrix nicht durch. Fable kommt unabhängig zum selben Befund (Brainstorm 2.1). Das
Format muss deshalb **kurz und explosiv** sein: Zug, Ruck, Kante. Dazu braucht es einen echten
Charisma-Kanal.

**Kanalbelegung im Prototyp.** Rezept unverändert, nur die Bedeutung ist neu:

| Teilwert (Rezept, unverändert) | Hantel-Duell | Tauziehen |
|---|---|---|
| LAST (power 60, health 25, det 15) | Tagesmaximum kg | Grundzug am Seil |
| ANSAGE (charisma 53, will 13, health 10, dex 9, power 8, speed 7) | Eröffnungshöhe, kühner Versuch | „Hau-Ruck“-Takt mit Publikum (Wirkungsgrad 0,4–1,6) und Starrblick vor dem Anpfiff (Startvorsprung) |
| NERVEN (charisma 35, will 35, det 20, health 10) | Erfolg an der Grenzlast | Gegenhalt an der Kante: ab 55 % verlorenem Boden bis +150 % Zug |
| TECHNIK (speed 70, dex 45, det 20, power 5) | Gelingen des Versuchs | Ruck: ob er sitzt (Timing, Griff) oder Meter kostet |
| ERHOLUNG (stamina 40, health 35, will 25) | Stoßen nach dem Reißen | Ermüdung zwischen den Runden abbauen, bewusst klein |

**Rechnerischer Hebelbedarf.** Damit die Matrix herauskommt, müssen die Hebel ungefähr so viel
tragen: LAST ~42 %, ANSAGE ~32 %, NERVEN ~10 %, TECHNIK ~10 %, ERHOLUNG ~5 %. Das ergibt sich,
wenn man die Rezeptanteile zurückrechnet. ANSAGE muss also ein **großer** Hebel sein, fast so groß
wie die Kraft. Das ist keine Geschmacksfrage, die Matrix verlangt es. Erzählerisch passt es
trotzdem: Wer den Takt angibt und das Publikum hinter sich hat, zieht auf den Schlag.

**Gemessen** (Vorab-Sonde, Abschnitt 4): power 30,4 / charisma 19,9 / health 18,2 / det 10,4 /
will 7,4 / dex 5,7 / speed 5,4 / stamina 2,6, also **Pp 11,3**. Kein Nullattribut trägt.

---

## 3. „Alle gegen alle“ in der bestehenden Architektur

Heute ist Gewichtheben eine Bühnen-Disziplin in der normalen Zwei-Team-Begegnung (`BUEHNE_ART`,
`jeSeite:6`, Hantel Slot gegen Slot). Für Chris' „alle vorhandenen Spieler gegeneinander“ gibt es
drei technische Lesarten:

| | A: alle zwölf der Begegnung | B: Vier-Team-Pod (24 Zieher) | C: ganze Liga |
|---|---|---|---|
| Wer zieht gegen wen | die 6+6 einer Begegnung, jeder gegen jeden (Schweizer Runden) | vier Teams, wie Mini-DM-FFA, Battlefield, Takeshi, Staffel | — |
| Spielplan | unverändert | Gewichtheben müsste in `VIERER_POD_DISCIPLINE_IDS`; der Kraft-Bereich ist mit Mini-DM schon besetzt (Freigabe 01.11.: ein 4-Team-Format je Kernbereich) | neu |
| Buchung | unverändert: Seitenpunkte aus einer Zwei-Team-Begegnung | Pod-Buchung 2-1-0-0 und Referenzen (`bahn-pod-resolve.ts`-Muster) | neu |
| Motor | ein neuer Builder hinter der Bühnen-Weiche, zwölf Figuren gleichzeitig wie Sandsack Flag 10 | N-Seiten-Bühne gibt es nicht; nur das Bahn-Chassis kann heute N Seiten | — |
| Aufwand | **klein bis mittel** | groß | nicht sinnvoll |

**Empfehlung: A.** Das deckt Chris' Satz vollständig ab, denn alle Spieler der Begegnung ziehen
gegeneinander, Teamkollegen eingeschlossen. Es verändert weder Spielplan noch Liga-Buchung.
Teamkollegen-Duelle sind für die Mannschaftswertung neutral (ein Sieg geht an dasselbe Team). Für
den Spielerwert zählen sie voll, das macht die Einzelrangfolge sogar schärfer.

**Passung im Motor (Variante A):** ein Zweig `if(art.heben&&FORMAT==="tauziehen"){ baueTauziehen(...); return; }`
direkt neben den Sandsack-Zweigen. Dazu gehören ein eigenes `buehneQueue`/eine eigene Szene (Muster
`SANDSACK_PAR_FILM`/`SANDSACK_PAR_SZENE`: Film nur im Live-Pfad, nie in `MOTOREN[bd].bau()`) und
ein eigener `WERTUNG_*`-Boxscore (Muster `WERTUNG_SANDSACK_PAR`). Die drei Lehren aus Fables
Weg-C-Lektüre (keine Nicht-Teilnehmer, jeder an aussagekräftiger Last, eigener Spielerwert) erfüllt
das Schweizer Format von selbst: Jeder zieht in jeder Runde, und ab Runde 2 zieht jeder gegen
jemanden mit gleicher Siegzahl.

---

## 4. Vorab-Sonde: Schweizer Runden gegen Fables Ring

`node scripts/miss-tauziehen-prototyp.mjs 48 [--saat-versatz=10000000] [--format=schweizer|grube]`

Die Sonde nutzt dieselben Kennzahlen wie die Pflichtabnahme: rho je Einzelspiel (Spearman Eignung
gegen Spielerwert) und die Validität (über 48 Spiele gemittelt). Pp folgt der Budget-Methode von
`einflussVon()`: je Teilnehmer und Attribut +15, Gewinn im eigenen Spielerwert, Anteile gegen die
Matrix. Kader sind die fünf echten Paarungen aus `data/generated/kaderfamilie-live-save.json`
(je Seite die ersten sechs), Eignung ist `d.gewichtheben`.

### 4.1 Ergebnisse

| Format | rho je Spiel (Strom 0 / 1) | Validität je Paarung | Star Rang 1 / Top 2 | Pp (Strom 0 / 1) |
|---|---:|---|---:|---:|
| **Schweizer Runden** (5 Runden × 6 Taue, Großes Tau) | **0,853 / 0,857** | 0,79–0,96 | 68 % / 95 % | **11,3 / 9,9** |
| **Grube, gemeinsamer Ring** (Fable 2.4: 12→8→5→3→1) | 0,636 / 0,634 | 0,53–0,80 | 70 % / 73 % | 12,0 / 14,2 |
| zum Vergleich: Hantel-Duell heute (`disziplin-abnahme.json`) | 0,865 | — | — | 8,5 / 10,0 |

Die Schweizer Zahlen gelten für die Konstanten im Prototyp. Sie stammen aus einer kurzen
Kalibrierung an genau diesen fünf Paarungen und sind deshalb **optimistisch**.

Zwei Zwischenstände zeigen, wie die Matrix-Treue reagiert. Mit der ersten Fassung (Kraft
überproportional, `lastExp` 1,35, enger ANSAGE-Takt 0,8–1,2) kam power auf 46 % und charisma auf
7 %, Pp 49,8. Erst der breite Takt-Hebel brachte charisma auf ~20 %. Das bestätigt Abschnitt 2:
Ohne großen ANSAGE-Kanal reicht ein Tauziehen die Gewichtheben-Matrix nicht durch.

### 4.2 Warum der gemeinsame Ring nicht trägt (und mehr Feintuning nicht hilft)

Fables Ring ist ein einziger Kraftvektor. Alle zwölf Seile hängen an *einem* Ring, der Ring folgt
der Vektorsumme. **Boden verliert, wer der Nettokraft gegenüber steht, nicht wer am schwächsten
ist.** Ein starker Zieher zwischen zwei Schwachen geht über die Kante, wenn gegenüber drei Starke
stehen. Ein Schwacher in einer starken Gruppe übersteht den Zug.

Die Messung zeigt das eindeutig:
- Ohne jedes Rauschen (`rauschen 0,03`, `formRauschen 0,01`) bleibt rho bei **0,636**. Ohne
  Rutscher und Aufbäumen ebenso. Mit doppelter Zugzeit fällt es auf 0,609.
- Die **Validität** liegt bei einzelnen Paarungen um **0,53**, also auch über 48 Spiele gemittelt.
  Die Position am Ring ist durch Slot-Reihenfolge und Heim/Gast-Wechsel in jedem Spiel gleich, und
  diese Position entscheidet mehr als die Eignung. Nach CLAUDE.md heißt das: Beide Spalten sind
  niedrig, die Mechanik belohnt das Falsche. Mit mehr Ereignissen lässt sich das nicht beheben.
- Dazu kommt die Ausscheidungsstruktur: Wer in Zug 1 fällt, hat nur ~20 s Daten (Fables Risiko 3).

**Die Lösung behält Fables Bild:** Zwölf Zieher stehen rund um die Grube, aber jedes Seil verbindet
**zwei gegenüberliegende Zieher**. Die sechs Seile kreuzen sich über dem Schacht. Das sieht aus wie
der Stern am Eisenring, mechanisch sind es sechs Eins-gegen-eins-Taue. Der Verlierer wird über die
Kante in die Grube gezogen, die Runden paaren nach Schweizer System neu. Fables Kanäle (Zug, Stand,
Kante, Ruf, Erholung) gelten unverändert. Fables Vollzug/Halten-Wahl und den Grubenblick enthält
die Ring-Variante der Sonde (`spieleGrube()`). In die Schweizer Fassung sind sie noch nicht
übernommen. Dort trägt der Takt den Charisma-Kanal, und die Sonde besteht ohne sie. Ob man sie
zusätzlich will, ist eine Designfrage. Fables eigenes Risiko 2 (Charisma-Übergewicht bei zwei
ANSAGE-Hebeln) spricht eher dagegen.

---

## 5. Governance: wie eine Format-Variante durch die Abnahme geht

Die Abnahme gilt **je Format**, nicht je Disziplin (Fable 5 sagt dasselbe). Eine Variante ist eine
eigene Mechanik und reicht die Matrix auf eigene Weise durch.

1. **Eigener Schalterwert, bit-identisch bei aus.** Am saubersten ist ein neues Feld, etwa
   `BUEHNE_FLAGS.gewichthebenFormat` (0 Hantel, 1 Sandsack, 2 Tauziehen), statt eines elften Werts
   auf `gewichthebenSandsack`. Isolation wie bei Weg C: SHA der drei Mess-Einstiege bei Flag 0,
   dazu `node scripts/miss-alle-disziplinen.mjs 4` über alle zwanzig, beides unverändert
   (Vorlage `scripts/pruefe-sandsack-wegc-isolation.mjs`).
2. **rho über die echte Sonde:** `node scripts/miss-alle-disziplinen.mjs 24 gewichtheben
   --flags=gewichthebenFormat=2`. Gemessen wird kaderfest über die Kaderfamilie, mit Slot-Aufschlag,
   Formkarten und Mutatoren. Ziel > 0,80, angestrebt 0,85. Zusätzlich gehören die
   Star-/Paartreue-Kennzahlen dazu (Star auf Rang 1 / Top 2).
3. **Pp über die Budget-Methode:** `node scripts/messe-arena-einfluss.mjs gewichtheben 48
   --flags=...` und dasselbe mit `--saat-versatz=10000000`. Ziel ≤ 25 in **beiden** Strömen.
4. **Eintrag in `data/generated/disziplin-abnahme.json`** als eigene Zeile oder als Unterobjekt
   `formate.tauziehen`, damit `pruefe-rangtreue-schranke.mjs` das Format überwacht. Die Schranke
   kennt heute nur eine Zahl je Disziplin. Sobald ein Format in der App wählbar ist, muss sie jedes
   Format einzeln prüfen, sonst kann ein schwaches Format hinter dem Median eines starken
   verschwinden.
5. **Mit Kulisse oder Oberflächen-Effekt (Teil 1) gemeinsam messen**, sobald beide existieren. Ein
   Oberflächenkanal verschiebt die Eingänge, das Format die Mechanik. Die Abnahme gilt für die
   Kombination, die tatsächlich gespielt wird.

Die Vorab-Sonde des Prototyps ersetzt **keinen** dieser Schritte. Sie kennt weder Slot- noch
Trait- noch Formkanäle und wurde an den Daten kalibriert, auf denen sie misst.

---

## 6. Formatwahl: technische Grundlage (Ergänzung zu Fable 6)

Fable nennt drei Optionen (fest je Spieltag, Hash wie die Kulissen, Chris/Heimrecht). Technisch
gilt für alle drei:

- Die Wahl muss **vor dem Spieltag außerhalb des Motors** feststehen, als Funktion in `lib/`
  (etwa neben `lib/season/season-discipline-schedule.ts`). Kaderbildschirm, Picker,
  Manager-Modus/PPS-Pfad (`lib/resolve/...`) und Headless-Runner müssen dasselbe Format meinen. Ein
  rein motorinterner Hash wie `kulisseWaehlen()` reicht dafür nicht: Die Kulisse ist folgenlos,
  das Format nicht.
- Der Motor bekommt das Format wie die Kulisse als Parameter beim Reset. Die Weiche in
  `bauBuehne()` liest dann diesen Parameter statt `BUEHNE_FLAGS`. Die Messskripte setzen ihn
  weiter über `--flags=`.
- Der PPS-Pfad (Liga ohne Arena-Lauf) braucht je Format eine Referenz, sonst bucht er für ein
  Tauziehen-Spiel Hantel-Erwartungswerte (Muster: `resolveBahnPodSpielerPpReferenz`).

---

## 7. Der Prototyp

Öffnen: `public/mockups/tauziehen-prototyp.html` (lokal im Next-Dev-Server unter
`/mockups/tauziehen-prototyp.html` oder mit `python3 -m http.server` aus `public/`). Mit
`?t=SEKUNDEN&halt=1` springt die Seite für Sicht-QA in der Sendezeit vor, `?ansicht=kai` schaltet
auf die Reihen-Ansicht, `?p=0..4` wählt die Paarung.

| Datei | Inhalt |
|---|---|
| `public/mockups/tauziehen-prototyp.sim.js` | Mechanik: Schweizer Format (`spiele()`) und Fables Ring (`spieleGrube()`), Rezept 1:1 aus dem Motor, eigene Saat (mulberry32) |
| `public/mockups/tauziehen-prototyp.html` | Bühne (Canvas 1240×470 wie der Motor), HUD auf den Anzeigetafeln der Kulisse, Boxscore (spoilerfrei, wächst je Runde), Ticker, Tempo, Paarung, neue Saat |
| `public/mockups/tauziehen-prototyp/hafengrube.png`, `hafenkante.png` | Kulissen aus der PixelLab-Hafenszene der Sandsack-Runde (`public/szenen/gewichtheben/hafen.html`): Tafeln geleert, Bahnen und Silo entfernt, Pflaster aus der Szene gekachelt, Schacht bzw. Becken in Pixeloptik |
| `scripts/baue-kulisse-tauziehen-prototyp.py` | baut beide Kulissen. Gleiches Verfahren wie `baue-kulisse-buehnen.py` (nur Pixel der Szene, ohne API), aber als eigene Datei, damit die laufende Kulissen-Integration unberührt bleibt |
| `public/mockups/tauziehen-prototyp/kader.json` | die fünf echten Paarungen (je sechs, Attribute + Gewichtheben-Eignung) |
| `scripts/miss-tauziehen-prototyp.mjs` | Vorab-Sonde (Abschnitt 4) |

**Ablauf auf dem Bildschirm** (~1:35 Sendezeit bei 1×, Hantel heute 7:11, Sandsack 2:42–3:04):
Intro → Runde 1 (Slot gegen Slot) → Runde 2–5 (Schweizer System, auch Teamduelle) → Großes Tau
(6 gegen 6, +2) → Endstand mit den drei besten Ziehern. Im Bild sieht man das Zurücklehnen ins
Seil, den „RUCK!“, das Rutschen zur Kante (Gehanimation), den Fall in den Schacht mit Platschring
und den Jubel des Siegers (Angriffsanimation). Die Seilmarkierung wandert mit dem Stand.

Bilder: `format-varianten-tauziehen-grube-runde1-08-11.png`, `…-grube-runde3-08-11.png`,
`…-kai-08-11.png`, `…-seite-08-11.png` (Endstand mit Boxscore).

### Was bis zur Produktion fehlt

1. **Motor-Builder** `baueTauziehen()` hinter einem eigenen Schalter (Abschnitt 5.1). Er muss
   `u.summe` als Spielerwert setzen, `MOTOREN.gewichtheben.wert()` muss ihn lesen, und das Ganze
   braucht die Isolationsprüfung.
2. **Pflichtabnahme** mit den echten Sonden (Abschnitt 5.2–5.4). Der Prototyp misst ohne
   Slot-/Trait-/Form-Kanäle und mit Konstanten, die auf den Messdaten kalibriert sind.
3. **Eigener Spielerwert gegen Referenz** nach `sandsackWegCNoteInvers`. Fables Lehre 3 ist im
   Prototyp nur durch `10×Siege + 3×Marge` angenähert.
4. **Slot-Bedeutung:** Im Prototyp zählt nur Runde 1 Slot gegen Slot. Sollen die Gewichtheben-Slots
   (Power Opener usw.) im Tauziehen noch etwas bedeuten, braucht es eine Entscheidung (z. B. Slot =
   Startplatz am Schacht oder Rolle im Großen Tau).
5. **Kleinere Kader** (2..6 je Seite): Schweizer Runden funktionieren ab 4 Ziehern. Rundenzahl
   und Großes Tau müssen mitwachsen und für jede Kadergröße gemessen werden.
6. **Großes Tau in der Wertung:** Im Prototyp gibt es +2 für die Mannschaft und null für den
   Spielerwert. Ob und wie es zählt, entscheidet Chris.
7. **Darstellung:** Fall-/Platsch-Animation (heute gedrehtes, ausgeblendetes Standbild),
   Seilphysik, Namensschilder bei engen Speichen. Dazu eine eigene „Zieh“-Pose als
   PixelLab-Animation: Heute ist es das gekippte Standbild.
8. **Formatwahl, Kaderbildschirm, Picker, PPS-Referenz** (Abschnitt 6).

---

## 8. Weitere Kandidaten, kurz (geringere Tiefe)

**Basketball „Knockout“** (Fable 4.5, laut Fable der günstigste zweite Prototyp):
- **Machbar und billig:** keine Feldspiel-Physik, nur eine vorab gewürfelte Wurfliste je Spieler.
  Bauen lässt es sich als eigener Builder nach dem Muster `baueSchatzsuche()`/`baueGauntlet()`
  oder, wie hier, zuerst als Mockup mit Vorab-Sonde.
- **Korrektur zur Kanalliste:** Einen Teilwert `LAUFTEMPO` gibt es im Basketball-Rezept nicht
  (`battle-mode.rezepte.js`: AUFBAU, ABSCHLUSS, TECHNIK, SCHUSS_NAH, SCHUSS_FERN, ZWEITCHANCE,
  ABWEHR, TEAMGEIST, AUSDAUER). Der Rebound-Sprint müsste über AUSDAUER (stamina 48, speed 12)
  oder ABWEHR (speed 24) laufen. Für die Matrix (speed 10, stamina 6) ist das unproblematisch.
- **Hauptrisiko** ist dasselbe wie beim Ring in Abschnitt 4.2: ein reines Ausscheiden. Wer früh
  rausfliegt, hat zwei, drei Würfe Daten, und die Reihenfolge in der Schlange entscheidet mit.
  Vor jeder Bilddarstellung sollte deshalb dieselbe Vorab-Sonde laufen. Erst danach lohnt sich
  der Bildteil. Eine mögliche Entschärfung: mehrere Knockout-Durchgänge mit gemischter Reihenfolge
  und dem Spielerwert als Summe über die Durchgänge.

**Football „Die Hai-Gasse“, Hockey „Der Durchbruch“** (Fable 4.1/4.2): Beide Disziplinen
scheitern heute an Pp (laut `disziplin-abnahme.json` Football 121,0/120,1 gegen die Matrix, Hockey 38,5/81,5). Ein einfacheres, ereignisbasiertes Format
mit Rollentausch ist technisch ein Bühnen- oder Bahn-Builder statt Feldspiel-Echtzeit und damit
leichter kalibrierbar. So hat der Battlefield-Pod das Echtzeit-Duell abgelöst. Nicht vertieft:
Beide brauchen zuerst Chris' Grundsatzentscheidung, ob ein zweites Format dort das Live-Feldspiel
ergänzen oder ersetzen soll.

---

## Quellen im Repo

- `public/mockups/battle-mode.engine.js`: `bauBuehne()` (~20098/20349), `BUEHNE_FLAGS` (~19469),
  `BUEHNE_ART.gewichtheben` (~18206), `baueHebenDuelle()` (~24909), `SANDSACK_STATIONEN` (~21161),
  `kulisseWaehlen()` (~42420), `einflussVon()` (~58262), `mische()` (~8338)
- `docs/design/gewichtheben-sandsack-wegc-parallel-stufe3-sichtbarkeit-06-10.md`,
  `docs/design/bahn-pod-vier-teams-01-11.md`, `lib/resolve/mini-dm-ffa-matchday.ts`,
  `lib/resolve/bahn-pod-matchday.ts`
- `data/generated/disziplin-abnahme.json`, `data/generated/kaderfamilie-live-save.json`
- Fable: `docs/design/format-varianten-brainstorm-08-11.md` (Branch `claude/vision-oberflaechen-tackling-0811`)
