# Format-Varianten je Disziplin: echtes anderes Gameplay, gleiche Matrix — Brainstorm (08.11.)

**Konzeptpapier, kein Code, keine Messung.** Antwort auf Teil 3 der Vision
`docs/design/oberflaechen-effekte-und-rempler-vision-08-11.md` (Branch
`claude/vision-oberflaechen-tackling-0811`). Chris, sinngemäß: Für möglichst viele der zwanzig
Disziplinen prüfen, ob es ein **zweites, spielerisch anderes Format** gibt, das trotzdem dieselbe
Eignungsmatrix bedient — so wie Gewichtheben neben dem Hantel-Duell schon das Sandsack-Rennen hat.
Sein eigenes Beispiel: Tauziehen, und zwar **alle vorhandenen Spieler gegeneinander, ggf. über
mehrere Runden**, nicht 1v1 und nicht Team gegen Team.

Zwei Sätze von Chris, an denen jede Idee hier gemessen ist:

- „Es geht nicht darum, Skins zu bauen, sondern Gameplay-Changes mit dem zu verbinden, was ich
  sehe." — Jede Idee muss sich **anders spielen**: anderer Ablauf, andere Siegbedingung, andere
  Teilnehmerstruktur oder anderes Tempo. Eine andere Kulisse für denselben Ablauf ist Teil 1 der
  Vision und hier ausdrücklich nicht gemeint.
- „Die Olympiade ist ja ein brutaler Sport … Das sind Gladiatoren." — Stilreferenz sind
  Takeshi's Castle, Wipeout-artige Shows, ein Hai-Becken neben einer Football-Disziplin.

Die drei Schranken aus `CLAUDE.md` gelten unverändert: `official-discipline-weights.ts` bleibt
byte-identisch; ein Format bedient **nur** Attribute, die die Disziplin heute schon gewichtet; nach
jeder ernsthaften Umsetzung gilt rho > 0,80 je Einzelspiel (Ziel 0,85) und Pp-Abweichung ≤ 25 auf
zwei Saatströmen. Machbarkeit, Aufwand und ein visueller Prototyp der stärksten Kandidaten sind
Sache des parallelen Opus-Agenten; dieses Papier liefert die inhaltliche Grundlage dafür.

---

## 0. Kurzfassung

1. **Was ein „Format-Wechsel bei gleicher Matrix" im Code heute schon bedeutet** (Abschnitt 1,
   gelesen am Sandsack-Rennen): Das Format liest **dieselben fünf Sub-Skills** aus
   `BUEHNE_ART.gewichtheben.rezept` wie die Hantel — es erfindet keinen neuen Kanal, sondern gibt
   denselben Kanälen eine andere Bedeutung (LAST ist dort Traglast statt Hebelast, ANSAGE ist
   Doppeln statt Eröffnungshöhe). Und es hat eine Lehre hinterlassen, die jedes neue Format
   einhalten muss: **jeder Spieler muss in jedem Spiel an aussagekräftiger Last gemessen werden.**
   Die Paket-1-Pläne, in denen fünf von sechs nichts trugen, fielen bei rho durch, weil
   Nicht-Träger keinen Spielerwert haben (`gewichtheben-sandsack-finale-wegc-format-05-10.md` 2.2).
2. **Tauziehen als „Die Grube" (Abschnitt 2):** zwölf Zieher rund um eine Grube, zwölf Seile an
   einem Eisenring, die Schwachen werden über die Kante gezogen. Vier Runden (12 → 8 → 5 → 3 → 1),
   dazwischen Erholung. Alle gegen alle, wie Chris es will. Die Matrix verlangt dabei etwas, das
   der Intuition widerspricht: **Tauziehen darf kein Ausdauer-Format werden.** stamina wiegt in
   Gewichtheben 2, charisma 23. Die Grube ist deshalb ein Kraft-/Nerven-/Einschüchterungs-Format
   mit Erholung als Nebenkanal, kein Zermürbungs-Marathon.
3. **Zwanzig Disziplinen geprüft (Abschnitt 3):** klares Potenzial bei 14, bedingt bei 3, keines
   bei 3 (Eiskunstlauf wie von Chris vermutet, Time-Trial, Staffel nur mit Vorbehalt). Auffällig:
   Die stärksten Kandidaten sind fast alle **Alle-gegen-alle-** oder **Ausscheidungsformate**.
   Das ist kein Zufall. Das Spiel hat mit dem Mini-DM-FFA und dem Battlefield-Pod schon zwei
   gewertete Formate, in denen die Rangfolge **eines einzigen Spiels** aus einer Ausscheidungs-
   bzw. Rangreihenfolge entsteht — genau die Form, die die Einzelspiel-Rangtreue am besten trägt.
4. **Fünf vertieft (Abschnitt 4):** Football „Die Hai-Gasse", Hockey „Der Durchbruch",
   Spurt „Die Hatz", Breaking „Die zwölf Pfähle", Basketball „Knockout". Zwei davon (Football,
   Hockey) sind Disziplinen, die heute an der Pp-Schranke scheitern; dort kann ein einfacheres
   zweites Format der Weg zur Wertung sein — so wie der Battlefield-Pod das Echtzeit-Duell
   abgelöst hat.
5. **Matrix-Treue (Abschnitt 5):** Für jede vertiefte Idee steht, welcher Matrix-Posten durch
   welchen Kanal bedient wird und welche Null-Attribute das Format **nicht** anfassen darf. Die
   gefährlichsten Fallen: stamina in Gewichtheben (2) und Spurt (4), intelligence/charisma in
   Hockey (0/0), speed/dexterity in Football-Override (14/4, aber die Matrix sagt 0/0).
6. **Formatwahl (Abschnitt 6):** drei plausible Wege, kein Vorschlag zur Entscheidung — mit dem
   Hinweis, dass Chris' „zwei Hockeyspiele je Saison" fast von selbst „ein Spiel je Format" nahelegt.

---

## 1. Der Präzedenzfall, im Code gelesen: was „zweites Format" heute bedeutet

Alles in `public/mockups/battle-mode.engine.js`, Stand Arbeitsbaum 08.11. (Commit `a4d7dd3ad`).

**Die Weiche.** `bauBuehne()` (~20348ff.) fragt `BUEHNE_FLAGS.gewichthebenSandsack` ab, bevor es
die Hantel baut: bei 0 `baueHebenDuelle()` plus das additive Finale, bei 1 `baueSandsackWegC()`,
bei 2..10 Messvarianten. Das Flag ist heute **nur über `window.__arena.buehneFlags()` oder
`window.__olyBuehneFlags` setzbar, die echte App setzt es nie** (Kommentar ~19475). Das zweite
Gewichtheben-Format ist also gebaut, gemessen (rho 0,882 / Pp 15,0|17,0, n=24) und abgeschaltet;
Stufe 3 (Bühnenbild, HUD, Boxscore, Kaderbildschirm) fehlt. Das ist wichtig für Abschnitt 6: Eine
Formatwahl im Spiel gibt es noch nirgends — nicht einmal für den Präzedenzfall.

**Dieselben Sub-Skills, andere Bedeutung.** Weg C liest `LAST`, `TECHNIK`, `NERVEN`, `ANSAGE`,
`ERHOLUNG` aus genau dem Rezept, gegen das die Hantel kalibriert ist (`:18312ff.`). Keine neue
Besetzung, kein Override. Die Bedeutung wechselt mit dem Format:

| Sub-Skill (Attribute) | Hantel-Duell | Sandsack-Rennen (Weg C) |
|---|---|---|
| LAST (power 60, health 25, det 15) | Hebe-Obergrenze, Reißen/Stoßen | Traglast, Ermüdung über die relative Last |
| TECHNIK (speed, dexterity, det) | Gelingen des Versuchs | Leertempo, seltener rutschen |
| NERVEN (charisma, will, det, health) | Erfolgskurve an der Grenzlast | Biss an der Grenzlast, Pausenschwelle |
| ANSAGE (charisma 53, …) | Eröffnungshöhe, kühner Versuch | Wagnis-Flex, Doppeln (zwei Säcke auf einmal) |
| ERHOLUNG (stamina 40, health 35, will 25) | Stoßen-Maximum nach dem Reißen | Pausenlänge, Rast des Wartenden |

**Was sich spielerisch ändert — und was das für neue Formate heißt.**

| | Hantel | Sandsack | Lehre |
|---|---|---|---|
| Teilnehmerstruktur | Slot i gegen Slot i, 1v1 | 2 gegen 2 je Lauf, Paare über den Slot | Die Slot-Paarung des Managers muss im neuen Format eine Bedeutung behalten (Weg C 2.3) |
| Ablauf | 72 enthüllte Versuche, Bild steht 95 % der Zeit | drei Läufe mit Bewegung, Pausen, Rutschern | Bewegung über die Fläche ist der sichtbare Unterschied |
| Siegbedingung | gewonnene Duelle, kg-Tiebreak | gewonnene Läufe (Medley-Regel), vorzeitiger Schluss | Ein vorzeitiger Schluss ist nur dann rangtreue-fest, wenn vorher jeder an schwerer Last gemessen wurde (6.2 dort: „ab Hof" rho 0,740, „ab Steg" 0,884) |
| Spielerwert | eigene Zweikampf-kg | Tragenote per Inversion gegen Referenzträger (`sandsackWegCNoteInvers`) | Wo ein Paar/Team sich ein Ergebnis teilt, braucht es einen **eigenen** Wert je Spieler aus eigenen Handlungen |
| Persönlichkeit | keine | Lastenplan Staffel/Stationen/Anker aus `sandsackPersoenlichkeit()` | Persönlichkeit wählt den Plan, Eignung entscheidet den Ausgang (dasselbe Prinzip wie der Bahn-Rempler) |
| Sendezeit | 7:11 | 3:04 | Ein Format darf auch kürzer sein |

Drei Dinge daraus sind für **jede** Idee unten verbindlich:

1. **Keine Nicht-Teilnehmer.** Wer in einem Spiel nichts tut, hat keinen Wert, und rho misst
   Nullen. Alle-gegen-alle-Formate erfüllen das von selbst; Formate mit Rollen (Wache/Stürmer,
   Henker/Opfer) müssen die Rollen **tauschen**, damit jeder beides tut.
2. **Jeder an aussagekräftiger Last.** Leichte Säcke trennen nicht (Weg C 6.1). Ein
   Ausscheidungsformat, das die Schwachen nach einer trivialen ersten Runde rauswirft, misst sie
   an nichts. Die frühen Runden müssen schon schwer sein.
3. **Eigener Spielerwert, nicht nur Team-/Rangergebnis.** Die Referenz-Inversion aus Weg C ist
   ein wiederverwendbares Muster: eigene Leistung gegen einen Referenzspieler, der genau dieselbe
   Aufgabe bekommt.

---

## 2. Gewichtheben, drittes Format: „Die Grube" (Tauziehen, alle gegen alle)

### 2.1 Vorab: was die Matrix erlaubt — und was nicht

Chris: „Ein Tauziehen spricht ja vielleicht andere körperliche Stärken an, ohne komplett von den
Basis-Stats des Gewichthebens oder dieser Matrix dann abzuweichen" — und in der Vision steht als
Beispiel „Tauziehen nutzt KRAFT/AUSDAUER wie Gewichtheben". Die Matrix für Gewichtheben:

| Attribut | power | charisma | health | determination | will | speed | dexterity | stamina | awareness/int/spirit/torment |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Gewicht | 28 | **23** | 16 | 12 | 7 | 6 | 6 | **2** | 0 |

Das ist der eine Befund, der dieses Format formt: **stamina wiegt 2, charisma 23.** Ein
Tauziehen, in dem der Zähere gewinnt, weil der andere nach dreißig Sekunden einbricht, belohnt
stamina weit über Matrix und fällt bei Pp durch — dieselbe Falle, die das Physical-100-Papier für
ein festes Bühnengewicht schon durchgerechnet hat (`gewichtheben-physical100-fable-konzept-03-10.md`
3.4/4: ein Ausdauer-Nebenweg bräuchte stamina auf 20+, „das ist keine Dosis, das ist eine andere
Disziplin"). Und ein Tauziehen, in dem Charisma nichts tut, lässt das zweitschwerste Attribut leer.

Die Grube ist deshalb so gebaut: **Kraft entscheidet den Zug, Nerven entscheiden die Kante,
Einschüchterung ist der Charisma-Kanal, Erholung ist der Grund für die Runden.** Ausdauer kommt
nur über ERHOLUNG (stamina 40 darin), so klein dosiert wie im Sandsack (dort stamina 0,3 % Einfluss
bei Matrix 2 — eher zu wenig als zu viel).

### 2.2 Teilnehmerstruktur

- **Zwölf Zieher, alle gleichzeitig, alle gegeneinander.** Je sechs Heim und Gast, im Wechsel um
  die Grube verteilt (Heim 1, Gast 1, Heim 2, Gast 2, …), damit der direkte Gegenzug immer ein
  Gegner ist, aber die Nachbarn Mannschaftskameraden. Die Slot-Reihenfolge des Managers bestimmt
  die Position am Ring: Slot 1 (Power Opener) steht Slot 1 des Gegners gegenüber — die
  Slot-Paarung der Hantel bleibt als **Gegenüber** lesbar (Lehre 1 aus Abschnitt 1).
- **Jeder zieht in jeder Runde, in der er noch dabei ist.** Es gibt keine Rolle ohne Seil.
- **Kleinere Kader** (die Saison schickt 2..6 je Seite): der Ring hat so viele Seile wie Zieher,
  die Rundenstaffel schrumpft mit (4 je Seite: 8 → 5 → 3 → 1; 2 je Seite: 4 → 2 → 1).

### 2.3 Die Bühne

Eine runde Grube in der Mitte (Kulisse entscheidet, was unten ist: Dornen, Säure, Haie,
glühende Kohlen — Teil 1 der Vision, nicht dieses Papier). Darüber hängt ein **Eisenring**, von dem
zwölf Seile sternförmig zu zwölf **Podesten** am Grubenrand laufen. Jeder Zieher steht auf seinem
Podest, Seil über die Schulter, Fersen an der Kante. Hinter jedem Podest ein kurzer Anlauf
(„Zugweg", 3 m), vor dem Podest die Kante. Wer den Ring zu sich holt, gewinnt Boden; wer Boden
verliert, rutscht Richtung Kante; **wer über die Kante geht, hängt am Seil über der Grube und
ist raus.**

### 2.4 Rundenablauf

**Runde = Zug.** Vier Züge je Spiel: 12 → 8 → 5 → 3 → 1. Je Zug fallen so viele, wie die Staffel
vorgibt (4, 3, 2, 2). Ein Zug dauert 20 Simulationssekunden oder endet früher, wenn die
vorgesehene Zahl über der Kante hängt. Dazwischen **Erholung** (6 s): Ring zurück in die Mitte,
die Übrigen werden neu um die Grube verteilt (Heim/Gast weiter im Wechsel, soweit die Zahlen es
hergeben), Puste-Ring füllt sich nach ERHOLUNG.

**Innerhalb eines Zugs, je Tick:**

```
zugkraft_i  = LAST_i · stand(TECHNIK_i) · (1 − ermuedung_i) · ruf_i
ring        bewegt sich in Richtung der Vektorsumme aller Zugkräfte
boden_i     = Abstand des Ziehers zur Kante; sinkt, wenn der Ring sich von ihm entfernt
ermuedung_i wächst mit (zugkraft_i / LAST_i)² — mit der RELATIVEN Last, wie sandsackGang()
```

- **Der Zug** ist LAST. Wer stärker ist, holt den Ring zu sich; die gegenüber verlieren Boden.
  Das ist power/health/determination, 60/25/15 — der Matrix-Kern.
- **Der Stand** ist TECHNIK: wie viel der Zugkraft überhaupt auf dem Seil ankommt. Ruckt der
  Ring (Vektorsumme springt, weil jemand gefallen ist), würfelt TECHNIK den **Rutscher**: der
  Zieher verliert sprunghaft Boden. Fester Wurf je Zieher und Zug aus eigenem Saatstrom (Falle 17
  des Handbuchs, wie `sandsackWuerfe()`), kein `rr()` im Bewegungspfad.
- **Die Kante** ist NERVEN: Wer unter 15 % Restboden fällt, bekommt einmal je Zug das
  **„Aufbäumen"** — ein Kraftstoß über NERVEN (charisma 35, will 35), der ihn ein Stück
  zurückholt oder, wenn NERVEN zu schwach ist, verpufft. Das ist der Moment, den die Kamera will:
  Fersen über dem Abgrund, Seil quietscht, hält er oder hält er nicht.
- **Der Ruf** ist ANSAGE (charisma 53): Jeder Zieher wählt vorab je Zug, deterministisch aus
  ANSAGE, **Vollzug** oder **Halten**. Vollzug: Zugkraft ×1,15, Ermüdung ×1,5. Halten: ×0,95,
  Ermüdung ×0,7. Dazu der **Grubenblick**: Übersteigt die ANSAGE eines Ziehers die NERVEN seines
  direkten Gegenübers, verliert der Gegenüber 5 % Zugkraft („lässt sich einschüchtern"). Das ist
  der Charisma-Kanal, der im Hantel-Duell die Eröffnungshöhe ist — Mut und Präsenz, nicht Muskel.
- **Die Erholung** ist ERHOLUNG: zwischen den Zügen füllt sich der Puste-Ring; wer schlecht
  erholt in Zug 2 geht, zieht mit Restermüdung. Das ist der Grund, warum Chris' „mehrere Runden"
  nicht nur Dramaturgie sind: **Erst durch die Runden bekommt ERHOLUNG überhaupt einen Kanal**,
  genau wie im Hantel-Duell über den Weg Reißen → Stoßen.

**Persönlichkeit (Anschluss an Teil 2 der Vision):** Der Vollzug/Halten-Wechsel ist
eignungsgebunden (ANSAGE). Wo die Persönlichkeit hineinspielt, ist die **Zielwahl des Rings**:
Ein Draufgänger zieht gegen den Stärksten gegenüber („will den Star in die Grube"), ein
Opportunist wählt den Schwächsten. Das ist der Bahn-Rempler-Grundsatz (Persönlichkeit wählt die
Gelegenheit, Eignung entscheidet den Ausgang, `rempler-persoenlichkeit-machbarkeit-08-11.md` 5.1) und
bleibt optional.

### 2.5 Sieger, Platzierung, Spielerwert

- **Platzierung je Spieler:** die Reihenfolge, in der die zwölf über die Kante gehen. Wer zuletzt
  steht, ist „Herr der Grube". Innerhalb eines Zugs ordnet der Restboden beim Fall, wer früher
  hängt, ist schlechter. Damit liefert **ein Spiel eine komplette Rangfolge aller zwölf** — die
  Form, die die Einzelspiel-Rangtreue am direktesten trägt.
- **Mannschaft:** Rangpunkte 12..1 je Spieler, Summe je Seite; Gleichstand: die Seite des
  letzten Stehenden. Das ist strukturell das Mini-DM-FFA-/Pod-Muster (2-1-0-0 aus einer
  Rangfolge), nur innerhalb eines Zwei-Team-Spiels.
- **Spielerwert (`wert()`):** nicht der nackte Rang, sondern die **Zugnote** nach dem Muster
  `sandsackWegCNoteInvers`: je Zug der eigene Bodengewinn gegen einen Referenzzieher (alle fünf
  Sub-Skills = v, frisch) an **derselben Gegenlast** (Summe der gegnerischen Zugkräfte am eigenen
  Sektor), invertiert nach v, gewichtet mit der Trennschärfe des Zugs. Der Rang geht als zweiter
  Term ein. Warum nicht nur der Rang: Ein früher Rausgeworfener hat nur einen Zug Daten; die Note
  aus diesem einen Zug sagt trotzdem, ob er „wie ein 40er" oder „wie ein 55er" zog.

### 2.6 Was sich anders spielt als Hantel und Sandsack

| | Hantel-Duell | Sandsack-Rennen | Die Grube |
|---|---|---|---|
| Struktur | 1v1 je Slot | 2v2 je Lauf | 12 gegen 12 gleichzeitig, alle gegen alle |
| Siegbedingung | mehr Duelle | mehr Läufe | zuletzt stehen; Rangpunkte |
| Tempo | Versuch, Lampe, Versuch | Gänge, Pausen, vorzeitiger Schluss | vier Züge mit Fall-Momenten, 2–2:30 min |
| Entscheidender Moment | dritter Versuch | 105-kg-Sack an der Kante | Fersen über der Grube, Aufbäumen |
| Interaktion | keine | Partner (Lastenplan) | direkter Gegenzug, Einschüchterung, Nachbarn |
| Manager-Hebel | Slot-Paarung, Haltung | Slot-Paare | Position am Ring (wer wem gegenübersteht) |

### 2.7 Risiken, ehrlich

1. **Ausdauer-Sog.** Jeder Zug-über-Zeit-Mechanismus belohnt Ermüdungsresistenz. Die Ermüdung
   muss über die relative Last (LAST) laufen, nicht über ERHOLUNG/stamina; ERHOLUNG nur zwischen
   den Zügen. Pp-Prüfung: stamina darf nicht über ~4 % kommen.
2. **Charisma-Übergewicht.** Wie im Sandsack (charisma +5 bis +8 Pp, weil ANSAGE zweimal wirkte)
   wirken hier Grubenblick **und** Vollzug über ANSAGE. Ein Hebel reicht wahrscheinlich; welcher,
   sagt die Messung.
3. **Frühe Runde zu leicht.** Mit zwölf Seilen am Ring hebt sich viel Zugkraft gegenseitig auf;
   Zug 1 könnte lange unentschieden stehen oder, umgekehrt, die Schwachen trivial kippen (Lehre 2).
   Deshalb fallen in Zug 1 vier, nicht einer: Die Schwachen werden an voller Gegenlast gemessen,
   bevor sie gehen.
4. **Kaderrauschen.** Enge Kader (Mortal Sin – Natures Wrath, rho 0,68 im Sandsack) werden auch
   hier eng sein. Nicht lösbar, nur zu messen.
5. **Paket-1-Erbe.** Es gibt bereits drei Gewichtheben-Fassungen im Motor (Hantel, Weg C, zehn
   Messvarianten). Eine vierte braucht dieselbe Flag-Disziplin (bit-identisch bei aus).

---

## 3. Alle zwanzig Disziplinen: Potenzial für ein zweites Format?

Format heute = was der Motor spielt. Matrix-Spalte = die drei bis vier schwersten Attribute
(`official-discipline-weights.ts`). „Idee" ist jeweils ein Vorschlag, keine Festlegung.

### 3.1 Klares Potenzial

**Gewichtheben** (power 28, charisma 23, health 16, det 12). Format heute: Hantel-Duell je Slot;
Sandsack-Rennen gebaut, aus. **Drittes Format: Die Grube** (Abschnitt 2).

**Football** (Spiel-Eignung per Override: power 22, health 18, speed 14, torment 12, det 10).
Format heute: Live-Motor mit Downs, Formationen, fünf Spielzügen; Pp 121 — außerhalb der
Wertung. **Idee: Die Hai-Gasse.** Eine 8 m breite Gasse, links und rechts das Becken. Ein Läufer
mit Blocker gegen zwei Tackler, Durchbruch bis zum Ende oder ins Wasser. Jeder läuft, jeder
blockt, jeder tackelt. Power/health/torment im Tackle, speed im Antritt, det beim Weiterschieben.
Brutaler als das Spielfeld, einfacher als elf gegen elf — Chris' eigenes Hai-Becken-Bild.
Vertieft in 4.1.

**Hockey** (power 18, health 18, speed 12, spirit 12, stamina 10, torment 10). Format heute:
Live-Feldspiel mit Torwart, Bodychecks, Strafen; rho 0,64, Pp 38,5/81,5. **Idee: Der
Durchbruch.** Kein Tor, kein Torwart: Ein Puckträger muss die ganze Eisfläche durch sechs
Verteidiger bringen, die ihn **checken dürfen, bis er liegt**. Bande ist eine Kante. Punkte für
Strecke und Durchbruch, Rollen tauschen nach jedem Lauf. Power/health im Check, speed/awareness
beim Läufer, spirit als Schlag-Kette der Verteidiger. Vertieft in 4.2.

**Spurt** (speed 18, det 15, torment 14, will 14, dex 12, power 10). Format heute: Hürdenlauf
mit Rempler, Windschatten, Rennplänen. **Idee: Die Hatz.** Rundkurs mit einem rotierenden
Fegearm (Wipeout-Sweeper) oder einem Stier; jede Runde wird der Letzte erwischt. Wer schiebt,
schiebt in den Arm. Kurze Wellen, keine Ausdauer (stamina 4!), Rempler (torment/power) und
Hürden (dex) entscheiden, wer hinten ist. Vertieft in 4.3.

**Breaking** (will 28, torment 22, health 18, power 10, det 10, stamina 8). Format heute:
Folter-Gauntlet 1v1 in der Kette, Sieger bleibt mit seinem HP-Stand. **Idee: Die zwölf
Pfähle.** Alle zwölf gleichzeitig am Marterpfahl, jede Runde ist einer Henker und wählt, wem er
zusetzt; wer bricht, ist raus; wer zuletzt steht, gewinnt. Aushalten (will/health) gleichzeitig,
Zufügen (torment/power) reihum. Vertieft in 4.4.

**Basketball** (spirit 22, int 16, awareness 14, charisma 11, speed 10). Format heute:
Live-Court, Zonen, Spielzüge. **Idee: Knockout.** Alle zwölf in einer Reihe an der Freiwurflinie,
ein Korb; trifft der Hintermann vor dir, bist du raus. Kein Team, kein Pass — Wurf (awareness,
int), Rebound-Sprint (speed), Druck (charisma, spirit). Der billigste Prototyp der ganzen Liste.
Vertieft in 4.5.

**Mini-DM** (Override: torment 21, health 18, power 14, stamina 14, will 12). Format heute:
Vier-Team-FFA-Pod, Rollenrunden. **Idee: Der Spießrutenlauf.** Jeder läuft einmal durch die Gasse
der elf anderen, die zuschlagen dürfen; gewertet wird, wie weit er kommt und wie hart er zuschlägt,
wenn er selbst in der Gasse steht. Aushalten (health/will/stamina) und Zufügen (torment/power)
in **einem** Format, beides bei jedem. Nah am Breaking-Vorschlag, deshalb nicht vertieft — eine
von beiden Disziplinen sollte es bekommen, nicht beide.

**Fechten** (torment 25, dex 20, speed 16, awareness 15, power 10). Format heute: Duell Slot
gegen Slot auf der Bühne. **Idee: Die Mêlée.** Alle zwölf gleichzeitig im Ring, ein Treffer ist
das Aus, zuletzt stehen gewinnt. Awareness (15) wird zum Rückenschutz, torment zum Angriffsdruck,
dex/speed zur Parade. Dieselbe Rangfolge-Logik wie die Grube, mit Klingen. Starke Idee, aber
Fechten hatte schon einmal einen Format-Fehlschlag in der Arena (rho 0,153 als Feldspiel) — die
Mêlée muss vorab gewürfelt sein wie die Bühne, nicht Echtzeit wie die Arena.

**Tennis** (int 22, awareness 20, spirit 18, dex 12, stamina 12). Format heute: Duell Slot gegen
Slot. **Idee: Rundlauf am Abgrund.** Alle zwölf laufen um ein Feld, jeder schlägt einen Ball und
läuft weiter, wer verfehlt, ist raus; die letzten zwei spielen aus. Awareness/int (Ball lesen),
dex (Schlag), stamina (Laufen) — stamina 12 trägt das Laufen gerade so. Brutal wird es durch die
Kulisse (Feld auf einem Turm, wer raus ist, geht über die Kante), nicht durch die Regel.

**Takeshi's Castle** (will 22, det 18, charisma 14, int 11). Format heute: Hindernisbahn mit
vierzehn Fallen auf drei Kursen, Rempler. **Idee: Der Sturm auf die Burg.** Asymmetrisch: Eine
Seite verteidigt (Wasserkanonen, Fallen auslösen, Rammböcke), die andere stürmt; Seitenwechsel
nach Halbzeit. Wachen brauchen charisma/torment (Einschüchtern, Zielen), Stürmer will/det. Das
Original hat genau dieses Finale („Showdown"). Teilnehmerstruktur und Siegbedingung (Burg
erreicht ja/nein, Zeit) sind neu, die Fallen-Mechanik bleibt.

**Wettessen** (will 26, health 22, stamina 22, det 16). Format heute: alle an der Tafel, Mauer
als Füllstand, Haltung. **Idee: Das Ekelroulette.** Statt Menge: jede Runde ein Gang, jeder
entscheidet essen oder passen; passen kostet, essen kann zum Kotzeimer führen (health), weiter
essen trotz Übelkeit ist will. Wer zweimal passt oder einmal bricht, ist raus. Siegbedingung
Überleben statt Teller, Entscheidungen statt Zähler. Gut, weil Wettessen heute „keine eigene
Mechanik" hat (`stand-aller-disziplinen.md` 5b).

**Speed-Schach** (int 28, awareness 21, det 14, will 14, speed 10). Format heute: Duell Brett
gegen Brett, die Uhr als dritter Spieler. **Idee: Der Blitz-Gauntlet.** Sieger bleibt am Brett
**mit seiner Restzeit** (kein Reset), wie Breaking mit HP. Billig, weil `gauntlet:true` existiert.
Brutaler Twist: Wessen Blättchen fällt, dessen Boden öffnet sich. Spielerisch anders (Kette,
Zeitverschleppung statt zwölf unabhängige Partien), aber am Rand des Skin-Verdachts — nur mit
der Restzeit-Regel ist es ein anderes Spiel.

**I-Spy** (int 18, torment 17, spirit 13, will 12). Format heute: Schatzsuche, zwölf Fundorte,
Tresore mit Logik/Verhör. **Idee: Das Verhör.** Einer sitzt, elf fragen; torment ist der Druck,
will das Standhalten, int die Logik des Widerspruchs. Jeder sitzt einmal. Siegbedingung:
Geständnis erzwungen ja/nein, Zeit bis dahin. Der Verhör-Kanal existiert schon (Tresore), das
Format kehrt nur die Perspektive um. Risiko: I-Spy hat auf Strom 2 nur 0,011 Puffer — zuletzt.

**Showcase** (charisma 27, spirit 16, det 14, power 11, int 10). Format heute: Auftritt, jeder für
sich. **Idee: Das Niederbrüllen.** Zwei gleichzeitig auf der Bühne, jeder darf unterbrechen; wer
die Menge hält, gewinnt den Durchgang. Charisma/spirit tragen, power (11) wird zur Lautstärke,
det zum Durchhalten gegen Zwischenrufe. Kleiner Twist, echte Interaktion. Mit Hai-Becken unter
der Bühne, wenn es sein muss.

### 3.2 Bedingt

**Climbing** (stamina 26, det 16, speed 12, dex 12, health 10). Format heute: sechs Paare auf
gespiegelten Routen, Griffe, Pump, Balance. **Idee: Die steigende Flut.** Alle zwölf an **einer**
Wand, von unten steigt Lava/Wasser; wer erwischt wird, ist raus; am Ende zählt Höhe und Überleben.
Stamina (Pump) ist hier endlich das schwerste Gewicht, das es laut Matrix sein soll. Bedingt, weil
Climbing rho-knapp ist (0,833) und die Wand-Geometrie für zwölf nebeneinander fehlt.

**TDM** (power 28, health 20, stamina 14, spirit 12, charisma 10). Format heute: Arena-Deathmatch,
rho 0,32 — die Mechanik belohnt das Falsche. **Idee: Die Brücke.** Sechs gegen sechs auf einem
Steg über der Grube, Schildwall gegen Schildwall; wer fällt, ist raus; wer den Steg hält, gewinnt.
Power/health im Schieben, stamina im Halten, spirit/charisma als Wall-Zusammenhalt. Bedingt, weil
TDM zuerst überhaupt eine funktionierende Mechanik braucht — ein Format-Wechsel könnte, wie beim
Battlefield-Pod, genau diese Reparatur sein. Das ist aber eine Mechanikrunde, kein Brainstorm.

**Battlefield** (charisma 20, int 16, spirit 16, torment 12). Format heute: Vier-Team-Pod, Gefecht
je Ort, gerade erst (02.11.) festgelegt und bestanden. **Idee: Die Belagerung.** Eine Seite hält
ein Fort, drei stürmen, Rollentausch. Bedingt, weil der Pod frisch ist und Chris ihn gerade
gewählt hat — nicht anfassen, bevor er gelaufen ist.

### 3.3 Kein Potenzial (oder: nicht hier)

**Eiskunstlauf** (charisma 28, dex 18, spirit 16, awareness 14, speed 10). Chris vermutet richtig.
Die Matrix hat **weder power noch health noch torment noch stamina** — jede „brutale" Variante
(Eis-Derby, Rempel-Kür, Marathon bis zum Umfallen) belohnt Attribute mit Gewicht 0. Was bleibt,
ist Darstellung (Kür/Kurzprogramm) und Teilnehmerstruktur (vier Aktive gleichzeitig, Rempler
vorab gewürfelt) — beides ist Teil 2 der Vision, kein zweites Format. Eiskunstlauf bleibt
Eiskunstlauf.

**Time-Trial** (dex 25, speed 22, int 18, stamina 15, awareness 12). Einzelstart gegen die Uhr
mit Streckenprofil. Ein Massenstart wäre Spurt, bewegliche Fallen wären Takeshi, eine
Verfolgung wäre Staffel. Die Varianten, die sich anders spielen, gehören alle zu einer anderen
Disziplin. Teil 1 (Gelände-Varianten) ist hier der richtige Hebel, nicht Teil 3.

**Staffel** (speed 24, stamina 16, spirit 16, awareness 12, charisma 10). Zwei Bahnen, Übergabe,
Zug an der Spitze; rho 0,937, Pp knapp an der Schranke (21,1/22,0). Die eine Idee mit Substanz
wäre die **Verfolgungsjagd** (Start an gegenüberliegenden Punkten eines Rings, wer den anderen
einholt, gewinnt sofort) — eine andere Siegbedingung, aber dieselben vier Läufer, dieselbe
Übergabe, dasselbe Tempo. Zu nah am Skin, und die Pp-Luft ist nicht da. Zurückgestellt.

---

## 4. Fünf Kandidaten vertieft

Je Kandidat: Teilnehmerstruktur, Ablauf, Sub-Skills (aus dem **bestehenden** Rezept der
Disziplin, keine neue Besetzung), Sieg-/Punktelogik, Grundidee fürs Bild. Aufwandsfragen gehören
Opus; hier steht nur, was der Prototyp zeigen soll.

### 4.1 Football: „Die Hai-Gasse"

**Warum dieser Kandidat.** Chris' eigenes Bild. Und Football ist mit Pp 121 die am weitesten von
der Wertung entfernte Disziplin — ein Live-Motor mit Downs und fünf Spielzügen ist schwer zu
kalibrieren, ein Drill mit drei Beteiligten ist es nicht. Das Vorbild ist der Oklahoma-Drill (zwei
Mann in einer schmalen Gasse, Ballträger gegen Tackler), der als brutalste Übung des Sports gilt.

**Teilnehmerstruktur.** Je Durchgang **drei gegen zwei**: Läufer + Blocker (Angriff) gegen zwei
Tackler. Sechs Durchgänge je Seite, zwölf je Spiel. Die Slots geben die Rollen: Slot 1/2 laufen,
3/4 blocken, 5/6 tackeln zuerst; danach rotiert die Zuteilung, bis **jeder einmal gelaufen, einmal
geblockt, zweimal getackelt hat**. Kein Nicht-Teilnehmer (Lehre 1).

**Ablauf je Durchgang (8–10 s).** Die Gasse ist 8 m breit und 30 m lang, links und rechts das
Hai-Becken. Snap: Läufer bekommt den Ball, Blocker vor ihm, zwei Tackler kommen entgegen. Drei
Phasen, vorab gewürfelt wie die Bühne:
1. **Kontakt** (Blocker gegen Tackler 1): `PASSSCHUTZ` gegen `LAUFKRAFT` des Tacklers — hält
   der Block, hat der Läufer einen freien Tackler weniger.
2. **Durchbruch** (Läufer gegen den freien Tackler): `LAUFKRAFT` + `BALLSICHERHEIT` gegen
   `LAUFKRAFT` + `PASSSCHUTZ` des Tacklers. Ausgang: Durchbruch, gestoppt (Yards), oder **ins
   Becken** — wenn der Tackle seitlich sitzt (`TEAMGEIST`-Kanal mit torment 30 als
   „Härte des Treffers").
3. **Nachsetzen**: Ein gestoppter Läufer mit hoher `BALLSICHERHEIT` (det 28) schiebt noch
   ein bis drei Yards.

**Sub-Skills (bestehendes Football-Rezept, engine.js ~9612):** LAUFKRAFT (power 41, health 33,
speed 26) ist der Kern auf beiden Seiten; PASSSCHUTZ (power, health, awareness) der Block;
BALLSICHERHEIT (power, health, det, will) das Weiterschieben; TEAMGEIST (health, torment, speed)
die Härte des Tackles; LAUFTEMPO (speed, stamina, dex) der Antritt. PASSGENAUIGKEIT und AUSDAUER
bleiben ungenutzt — das ist erlaubt, solange die Pp-Verteilung der **Attribute** stimmt, und sie
wird eher besser, weil der QB-Kanal mit seiner Eigenlogik wegfällt.

**Sieg und Punkte.** Je Durchgang: Durchbruch 3 Punkte, Yards anteilig (0–2), Becken −1 für den
Läufer und +2 für den Tackler, der ihn reingeschoben hat. Mannschaft: Summe über zwölf
Durchgänge. Spielerwert: eigene Punkte aus allen vier Rollen — jeder sammelt in jeder Rolle,
also trägt die Note alle Kanäle.

**Bild.** Draufsicht auf eine schmale Gasse zwischen zwei Wasserflächen mit Flossen; zwei
Startlinien; Zuschauerbrüstung oben. Ein Durchgang ist ein kurzer, lesbarer Zusammenstoß, dann
Splash oder Durchbruch. Die vorhandenen `angriff`/`treffer`-Animationen reichen; der Sturz ins
Wasser ist eine Spritzer-Partikel, keine neue Sprite-Art.

**Matrix-Treue.** Football misst gegen die Spiel-Eignung (Override): power 22, health 18,
speed 14, torment 12, det 10, awareness 8, stamina 6, dex 4, spirit 3, will 3. Der Drill liest
genau diese Reihenfolge: power/health in jedem Kontakt, speed im Antritt und beim Läufer, torment
in der Tackle-Härte, det im Nachsetzen, awareness im Block. **Nicht anfassen:** intelligence,
charisma (im Override 0) — also keine „Finte", keine „Ansage". Spirit/will liegen bei 3; ein
Teamgeist-Kanal darf höchstens am Rand mitspielen.

### 4.2 Hockey: „Der Durchbruch"

**Warum dieser Kandidat.** Chris: „bei Hockey könnte es auch irgendwie mal einen Twist geben."
Hockey verfehlt rho (0,64) und Pp (38,5/81,5), und die Diagnose dazu lautet, dass die sehr
niedrige Torzahl die Einzelspiel-Messung instabil macht (`stand-aller-disziplinen.md`, Nachtrag
27). Ein Format **ohne Tor** umgeht genau das: Es erzeugt je Lauf ein gestuftes Ergebnis statt
eines seltenen Binärereignisses.

**Teilnehmerstruktur.** Ein Puckträger gegen **sechs** Verteidiger auf der ganzen Eisfläche,
die restlichen fünf Angreifer warten an der Bande und dürfen als **Blocker** eingreifen (je Lauf
zwei, rotierend). Zwölf Läufe, je Spieler **ein Lauf als Träger**, fünfmal Verteidiger, zweimal
Blocker. Die Slot-Reihenfolge bestimmt die Reihenfolge der Läufe.

**Ablauf je Lauf (10–15 s).** Der Träger startet an seiner Grundlinie und muss die gegnerische
Grundlinie erreichen. Die Verteidiger dürfen ihn checken, bis er liegt; ein Bodycheck, der an
der Bande sitzt, ist ein **Bandencheck** (gibt es schon: 38 % der Checks). Drei Zonen (eigene,
Mitte, gegnerische), je Zone ein Wertungsschritt — ein Zonenmodell wurde für Hockey schon zweimal
gebaut und nicht committed (`stand-aller-disziplinen.md` 5b); hier ist es keine Mechanik im
Feldspiel, sondern nur die Wertungslinie des Laufs.
Der Lauf endet mit Durchbruch, mit Liegen (Zone der Stelle zählt) oder mit Puckverlust durch
Stockcheck (halbe Zone). Die Blocker stellen sich den Verteidigern in den Weg — der Check gegen
einen Blocker nimmt dem Träger einen Verfolger.

**Sub-Skills (bestehendes Hockey-Rezept).** Der Bodycheck rechnet heute ABWEHR gegen die
wirksame AUSDAUER des Trägers (`versucheSteal()`, `hockey-ausdauer-checks-konzept-13-09.md`);
diese Rechnung bleibt wörtlich. Dazu: LAUFTEMPO/AUFBAU (stamina 57, speed 23) für die Strecke,
ABSCHLUSS (power 82) für den Durchbruch an der Grundlinie, ZWEITCHANCE (health 62, power 23,
torment 15) für das Aufstehen nach einem Check, der nicht ganz saß. Die Puste (Chris' Wort vom
13.09.) wird zum zentralen Vorrat: Ein Träger, der die ganze Fläche durchläuft, ist am Ende leer,
und die Verteidiger, die ihn fünfmal gejagt haben, auch.

**Sieg und Punkte.** Je Lauf 0–3 Punkte für den Träger (Zone bei Ende, Durchbruch 3),
Verteidiger bekommen den Check, der den Lauf beendet (1), Bandencheck (1,5). Mannschaft: Summe.
Spielerwert: eigene Punkte aus Träger-, Verteidiger- und Blocker-Rolle. Die
Feldspieler-/Torwart-Trennung der Messung entfällt, weil es keinen Torwart gibt — der Torwart-Slot
wird zum siebten Feldspieler oder bleibt draußen (Frage an Chris).

**Bild.** Dieselbe Eisfläche, kein Tor, an der Bande die wartende Reihe. Kamera folgt dem
Träger. Checks, Taumeln, Liegen sind alle vorhanden (`down`, `taumeltBis`). Neu wäre nur die
Zonen-Markierung als Wertungslinie und ein HUD „Lauf 7/12 · Zone 2".

**Matrix-Treue.** Hockey-Matrix: power 18, health 18, speed 12, spirit 12, stamina 10, torment
10, awareness 8, det 4, dex 4, will 4; **intelligence 0, charisma 0**. Der Durchbruch liest
power/health/torment im Check, speed/stamina in der Strecke, awareness beim Ausweichen, spirit als
Blocker-Einsatz (für den Nebenmann). Keine Finte, keine Ansage, keine Taktikkarte — die stünden
auf Null-Attributen. Das Problem der heutigen Messung (stamina +11 auf Strom 0, awareness +29 auf
Strom 1) ist im Durchbruch **eher kleiner**, weil die Streckenbewertung zwölf gestufte Ereignisse
je Spiel liefert statt ein, zwei Tore — aber das ist eine Erwartung, keine Zahl.

### 4.3 Spurt: „Die Hatz"

**Warum dieser Kandidat.** Das Wipeout-Bild in Reinform (Fegearm, Sweeper), und Spurt hat mit
dem Bahn-Rempler schon die einzige persönlichkeitsgesteuerte Kontaktmechanik, die die Abnahme
besteht (Spurt 0,910 / Pp 19,4|14,9). Die Hatz macht den Rempler vom Nebenereignis zur
Siegbedingung.

**Teilnehmerstruktur.** Alle zwölf gleichzeitig auf einem **Rundkurs** (Bahn-Chassis kann
Bahnen und Hindernisse, die Rundung ist Zeichenfrage). In der Mitte ein Fegearm, der eine Runde
pro „Welle" dreht, oder ein Stier/Panzertier (PixelLab-Figur), das die Nachhut jagt.

**Ablauf.** Fünf Wellen zu je ~12 Simulationssekunden. Je Welle: zwei Hürden, ein
Rempel-Fenster, am Ende der Welle erwischt der Arm die **letzten zwei** (12 → 10 → 8 → 6 → 4
→ 2, die letzte Welle ist der Sprint der zwei auf Platz 1). Zwischen den Wellen 3 s Neuordnung
(alle setzen auf einer Linie neu an — damit keine Welle Ausdauer belohnt, stamina 4). Wer in der
Welle hinten liegt, kann durch einen sitzenden Rempler **einen anderen nach hinten schieben**:
Die Hatz ist das Format, in dem man nicht der Schnellste sein muss, nur nicht der Letzte.

**Sub-Skills (bestehendes Spurt-Rezept, engine.js ~44805ff.).** ANTRITT (speed, power, det)
in jeder Welle neu — der wichtigste Kanal, weil jede Welle ein Neustart ist. TECHNIK/WENDIGKEIT
(dex, awareness) an den Hürden. WUCHT (torment 55, power 42) im Rempler, ROBUST (health, torment,
will, dex) im Wegstecken, STEHEN (torment, health, dex, will) beim Aufstehen nach dem Stolpern.
ENDTEMPO (speed, will, det, stamina 12) nur in der letzten Welle. `willTackeln` aus der
Persönlichkeit bleibt die Häufigkeitsneigung.

**Sieg und Punkte.** Rang = Ausscheidereihenfolge (wie die Grube: eine komplette Rangfolge aus
einem Spiel). Mannschaft: Rangpunkte 12..1 summiert. Spielerwert: Rang plus die Wellen-Note
(eigene Wellenzeit gegen Referenzläufer, Inversion) über alle Wellen, in denen man lief. Das
Bahn-Chassis hat mit `bahnRangliste()` und der Margin-Formel (Time-Trial, 15.10.) schon die
Mischung aus Rang und Abstand.

**Bild.** Ovaler Kurs um ein Zentrum; der Arm als rotierender Balken; wer erwischt wird, fliegt
(die `tod`-Animation ist hier **richtig**, weil er raus ist — mit Chris' Vorgabe „charakterpassend,
darf brutal sein"). Hürden wie heute, Rempler mit `lungeVis` wie bei Takeshi.

**Matrix-Treue.** Spurt: speed 18, det 15, torment 14, will 14, dex 12, power 10, awareness 7,
health 6, **stamina 4**; intelligence/charisma/spirit 0. Der Neustart je Welle ist keine
Dramaturgie-Entscheidung, sondern die stamina-Bremse. torment/will (28 zusammen) tragen Rempler
und Wegstecken, det den Antritt, dex die Hürden. **Nicht anfassen:** keine Taktikwahl aus
intelligence, keine Publikumswirkung.

### 4.4 Breaking: „Die zwölf Pfähle"

**Warum dieser Kandidat.** Breaking ist Folter, nicht Breakdance (CLAUDE.md), und das heutige
Gauntlet ist sequentiell: einer leidet, einer fügt zu, der Rest wartet. Die Pfähle machen daraus
ein **simultanes** Ausdauerspiel aller zwölf — und Breaking steht mit rho 0,801 genau auf der
Schranke; ein Format mit zwölf parallelen Messreihen statt einer Kette kann die Verlässlichkeit
heben, ohne das Rezept anzufassen.

**Teilnehmerstruktur.** Zwölf Pfähle im Kreis, alle zwölf gefesselt, alle gleichzeitig unter
Dauerlast (Hitze, Kälte, Wasser — Kulisse). Jede Runde löst sich **einer** als Henker (reihum,
Heim/Gast im Wechsel, Slot-Reihenfolge) und darf **einem** Gegner eine Extradosis zusetzen; danach
zurück an den eigenen Pfahl. Jeder ist einmal Henker je Umlauf. Wer bricht (HP 0), ist raus,
und sein Pfahl bleibt leer.

**Ablauf.** Umläufe zu zwölf Zügen (später weniger), Dauerlast tickt bei allen gleichzeitig; der
Henker-Zug ist ein Stoß gegen einen Gewählten. Das Ziel wählt der Henker — **Persönlichkeit wählt
(Draufgänger: den Stärksten; Opportunist: den Angeschlagensten), Eignung entscheidet** (Stoß
über TECHNIK/SPITZENMOMENT gegen die NERVEN/GRUNDLAGE des Opfers, wörtlich die heutige
`gauntletRunde()`-Prüfung). Spiel endet, wenn nur noch Pfähle einer Seite besetzt sind oder nach
vier Umläufen (dann HP-Stand).

**Sub-Skills (bestehendes Breaking-Rezept, engine.js ~18555ff.).** GRUNDLAGE (will, torment,
health, stamina) als Dauerlast-Resistenz; NERVEN (will 50, health 50) gegen den Stoß;
AUSDAUER (stamina 65, det 35) über die Umläufe — vorsichtig, stamina ist 8; SPITZENMOMENT
(power, will) und TECHNIK (torment 59, det 41) als Stoß des Henkers; PUBLIKUM (will, torment) als
Präsenz, die den Henker abschreckt (wer breit steht, wird seltener gewählt — Zielwahl-Gewicht,
nicht Schaden). WAGNIS (power, dex) für den „Doppelstoß" (zwei Opfer, halbe Dosis).

**Sieg und Punkte.** Rang = Bruchreihenfolge, letzter Stehender „Unbrechbar". Mannschaft:
Rangpunkte, bei Spielende nach vier Umläufen zusätzlich Rest-HP. Spielerwert: eigene Punkte wie
heute (`u.summe` bleibt „Summe der eigenen Punkte": ausgehaltene Ticks + sitzende Stöße) — die
Wertformel von MOTOREN.breaking ändert sich nicht, nur was sie zählt.

**Bild.** Die bestehende lila Druck-Arena (`zeichneBreaking`, vier Ring-Zonen) mit zwölf Pfählen
auf dem Ring; der Henker geht sichtbar von seinem Pfahl zum Opfer (die Gang-Interpolation aus
`buehnenBewegung()`). HP-Zonen GEBROCHEN/SCHMERZGRENZE/STONE FACE/MIND FORTRESS sind schon da,
nur jetzt bei zwölf gleichzeitig.

**Matrix-Treue.** Breaking: will 28, torment 22, health 18, power 10, det 10, stamina 8, dex 2,
int 2; **charisma 0, speed 0, awareness 0, spirit 0**. Aushalten (will/health) ist die Dauerlast,
Zufügen (torment/power) der Stoß, det das Durchhalten. Die Dauerlast muss über GRUNDLAGE/NERVEN
(will/health) laufen, nicht über AUSDAUER (stamina) — sonst derselbe Sog wie in der Grube. Keine
Zielwahl aus awareness, kein Publikum aus charisma.

### 4.5 Basketball: „Knockout"

**Warum dieser Kandidat.** Das einzige Format der Liste, das man an einem Nachmittag
prototypen kann: ein Korb, eine Reihe, zwölf Figuren. Und es ist das Gegenteil des
Live-Motors — kein Pass, keine Zone, kein Team. Ob ein Freiwurf-Ausscheiden die Basketball-Matrix
(spirit 22, int 16, awareness 14) trägt, ist die offene Frage; das Format ist billig genug, um
sie durch Messung statt Diskussion zu beantworten.

**Teilnehmerstruktur.** Alle zwölf in einer Reihe, Heim/Gast im Wechsel, Slot-Reihenfolge. Zwei
Bälle. Der Erste wirft von der Freiwurflinie; trifft er nicht, holt er den Rebound und wirft von
dort weiter; der Zweite startet, sobald der Erste geworfen hat. **Trifft der Zweite, bevor der
Erste trifft, ist der Erste raus.** Der Getroffene reiht sich hinten an.

**Ablauf.** Läuft, bis einer übrig ist; typisch 25–40 Würfe. Jeder Wurf ist ein vorab gewürfeltes
Ereignis (Bühnen-Vertrag, kein `rr()` in der Bewegung): Trefferchance aus ABSCHLUSS (spirit,
dex, charisma, power, awareness) für den Freiwurf, TECHNIK (int 50, awareness 22) für den
Nachwurf von der Rebound-Position, ZWEITCHANCE (torment, int, spirit, awareness) für den Rebound
selbst, LAUFTEMPO (speed, stamina, dex) für die Zeit bis zum Nachwurf — und das Tempo ist die
Siegbedingung, weil der Hintermann wirft. TEAMGEIST (charisma 56, spirit 44) als Druck-Kanal:
Steht der Hintermann mit hohem TEAMGEIST im Nacken, sinkt die Trefferchance des Vordermanns
leicht (dasselbe Muster wie der Grubenblick).

**Sieg und Punkte.** Rang = Ausscheidereihenfolge. Mannschaft: Rangpunkte. Spielerwert: Rang
plus Wurfnote (Treffer je Versuch gegen Referenz). Weil jeder mindestens einmal wirft, bevor er
raus sein kann, gibt es keinen Nicht-Teilnehmer; weil die Schwachen früh gehen, haben sie wenig
Daten — die Wurfnote aus zwei, drei Würfen ist dünn. Das ist das messbare Risiko.

**Bild.** Halbfeld mit einem Korb (vorhandener Court), die Reihe an der Freiwurflinie, Figuren
mit `shoot`-Pose. Rausgeworfene gehen an die Bande — oder, Chris' Ton, durch eine Falltür unter
der Freiwurflinie.

**Matrix-Treue.** Basketball: spirit 22, int 16, awareness 14, charisma 11, speed 10, dex 8,
power 7, stamina 6, torment 6; **health 0, will 0, det 0**. Spirit/charisma/awareness/int sind
alle im Wurf und im Druck, speed/stamina im Rebound-Sprint, torment im Rebound-Kampf. Es gibt
keinen Kanal für Nervenstärke über will/det — gut so, die stehen auf Null; der „Druck" muss aus
TEAMGEIST (charisma/spirit) kommen, nicht aus einem neuen Nerven-Sub-Skill.

---

## 5. Matrix-Treue auf einen Blick

Für jede vertiefte Idee: welcher Kanal welchen Matrix-Posten trägt, und welche Null-Attribute das
Format **nicht** berühren darf. Zahlen sind Matrixgewichte (Football: Override).

| Format | Schwerste Posten → Kanal | Mittlere Posten → Kanal | Null-Attribute, Finger weg |
|---|---|---|---|
| **Grube** (Gewichtheben) | power 28, health 16 → LAST im Zug · charisma 23 → ANSAGE (Vollzug, Grubenblick) + NERVEN (Aufbäumen) | det 12 → LAST/TECHNIK/NERVEN · will 7 → NERVEN/ERHOLUNG · speed/dex 6 → TECHNIK (Stand, Rutscher) · **stamina 2 → nur ERHOLUNG, klein** | awareness, intelligence, spirit, torment: keine Zielwahl-Intelligenz, kein Teamgeist-Bonus, keine Schmerz-Mechanik |
| **Hai-Gasse** (Football) | power 22, health 18 → LAUFKRAFT/PASSSCHUTZ in jedem Kontakt · speed 14 → Antritt/LAUFTEMPO | torment 12 → TEAMGEIST als Tackle-Härte · det 10 → BALLSICHERHEIT (Nachsetzen) · awareness 8 → PASSSCHUTZ (Block) · stamina 6, dex 4, spirit 3, will 3 → nur Randanteile | intelligence, charisma: keine Finte, keine Ansage; PASSGENAUIGKEIT ungenutzt |
| **Durchbruch** (Hockey) | power 18, health 18 → Check (ABWEHR gegen AUSDAUER, ZWEITCHANCE) · speed 12, spirit 12 → Strecke, Blocker-Einsatz | stamina 10 → Puste über zwölf Läufe · torment 10 → Check-Härte · awareness 8 → Ausweichen · det/dex/will 4 → Rand | intelligence, charisma: keine Taktikkarte, kein Spielzug-Lesen |
| **Hatz** (Spurt) | speed 18 → ANTRITT je Welle · det 15 → ANTRITT/ENDTEMPO · torment 14, will 14 → WUCHT/ROBUST/STEHEN | dex 12 → TECHNIK/WENDIGKEIT (Hürden) · power 10 → ANTRITT/WUCHT · awareness 7 → WENDIGKEIT · health 6 → ROBUST · **stamina 4 → Neustart je Welle als Bremse** | intelligence, charisma, spirit: keine Rennpläne aus Klugheit, keine Zuschauer |
| **Zwölf Pfähle** (Breaking) | will 28 → GRUNDLAGE/NERVEN/PUBLIKUM (Aushalten, Präsenz) · torment 22 → TECHNIK (Stoß) + GRUNDLAGE | health 18 → NERVEN/GRUNDLAGE · power 10 → SPITZENMOMENT/WAGNIS · det 10 → TECHNIK/AUSDAUER · **stamina 8 → AUSDAUER klein, Dauerlast über will/health** | charisma, speed, awareness, spirit: keine Zielwahl aus Übersicht, kein Publikumskanal über charisma |
| **Knockout** (Basketball) | spirit 22 → ABSCHLUSS/TEAMGEIST (Wurf, Druck) · int 16 → TECHNIK (Nachwurf) · awareness 14 → ABSCHLUSS/ZWEITCHANCE | charisma 11 → TEAMGEIST-Druck · speed 10 → LAUFTEMPO (Rebound-Sprint) · dex 8 → ABSCHLUSS · power 7, torment 6 → ZWEITCHANCE · stamina 6 → LAUFTEMPO | health, will, determination: kein „Nervenstärke"-Kanal, kein Durchhalten |

Keine der sechs Ideen braucht ein Attribut, das ihre Disziplin heute nicht gewichtet, und keine
braucht einen neuen Sub-Skill — jede liest das bestehende Rezept, nur mit anderer Bedeutung, wie
Weg C es vorgemacht hat. Was jede braucht, ist die **Pp-Pflichtprüfung** (zwei Saatströme, n=48)
als eigene Messung je Format, weil ein Format eine eigene Mechanik ist und die Matrix auf eigene
Weise durchreicht oder eben nicht. Die Abnahme der Disziplin gilt **je Format**, nicht je
Disziplin.

---

## 6. Wie künftig zwischen Formaten gewählt wird — drei Optionen, keine Entscheidung

Heute gibt es keine Formatwahl, nicht einmal für den Präzedenzfall (Abschnitt 1): Weg C hängt an
einem Messflag. Jede der drei Optionen unten braucht dasselbe Fundament — ein Feld `format` je
Disziplin, das `bauBuehne()`/`bauSpurt()`/`bauFeldspiel()` statt des Flags lesen, und das der
Spielplan **vor** dem Spieltag kennt, damit Picker, Kaderbildschirm und Manager-Modus (PPS-Pfad)
dasselbe Format meinen. Der Kulissen-Hash (`kulisseWaehlen()`, aus Disziplin, Saat, Heim, Gast,
Spieltag) ist genau so ein Vorbild.

**Option A — fest je Spieltag im Saisonkalender.** Chris' „wir haben pro season dann nur 2x
Hockey" legt es nahe: erstes Hockey der Saison ist das Feldspiel, zweites der Durchbruch; erstes
Gewichtheben die Hantel, zweites die Grube. Jeder Manager weiß es beim Saisonstart, kauft und
stellt danach auf. Vorteil: planbar, kein Zufall, jede Saison zeigt jedes Format genau einmal.
Nachteil: Bei Disziplinen mit einem Spiel je Saison bleibt nur eines; die Reihenfolge muss
irgendwo stehen (Kalender-Daten in `lib/`).

**Option B — deterministischer Hash wie die Kulissen.** Dieselbe Funktion, die heute die Kulisse
wählt, wählt das Format. Vorteil: null Verwaltung, fügt sich in die laufende
Kulissen-Integration, und Format und Kulisse können gekoppelt sein (die Grube bekommt die
Hai-Kulisse, nicht die Turnhalle). Nachteil: Zufall entscheidet, welches Format wann kommt; eine
Saison kann zweimal die Hantel zeigen. Und für die Abnahme muss jedes Format einzeln gemessen
werden, der Hash mischt sie nur im Betrieb.

**Option C — Chris legt es fest (Liga-Einstellung), optional später Heimrecht.** Ein Schalter je
Disziplin in der Liga-Konfiguration (Standard: das heutige Format), den Chris im Admin stellt;
später könnte das **Heimteam** sein Format wählen — ein echter Manager-Hebel („wir spielen Hockey
als Durchbruch, weil unsere Verteidiger checken können"), der die Aufstellung mit dem Format
verbindet. Vorteil: Kontrolle beim Start, strategische Tiefe später. Nachteil: Die KI-Teams
müssten auch wählen, und eine Wahl ist ein weiterer Faktor in der Rangtreue (ein Team wählt das
Format, in dem seine Spieler stärker sind — das ist gewollt, aber messbar).

Eine Mischung ist denkbar (A als Standard, C als Übersteuerung). Was in allen drei gleich bleibt:
**Die Eignungszahl im Kaderbildschirm bleibt die Matrix-Zahl**, egal welches Format läuft — das
ist der Sinn der Matrix-Sperre. Ein Format darf keine zweite Eignung erzeugen; es darf nur anders
zeigen, wie dieselbe Eignung auf der Fläche ankommt.

---

## 7. Was ich nicht geprüft habe

- Keine Messung, kein Code. Alle Zahlen stammen aus `disziplin-abnahme.json`, dem Weg-C-Papier
  und den Rezeptblöcken in `battle-mode.engine.js`.
- Ob das Bahn-Chassis einen Rundkurs darstellen kann (Hatz) oder ob die Bahn linear bleiben
  muss und der Kurs nur so gezeichnet wird — Zeichenfrage, Opus.
- Ob `gauntlet:true` sich ohne Umbau auf zwölf gleichzeitige HP-Stände (Pfähle) ausweiten lässt
  oder einen eigenen Bauer braucht wie `baueSchatzsuche()`.
- Wie die Liga-Buchung (`arenaTeamPointsForFixtureMitTiebreak()`, PPS-Referenzen) mit einem
  Format umgeht, das Rangpunkte statt Seitenpunkte liefert — der Mini-DM-FFA- und Pod-Pfad sind
  der Präzedenzfall, nicht gelesen.
- Die Sendezeit-Fenster je Format (Weg C hatte ein Ziel von 2:30–4:00; für die Grube schätze ich
  2–2:30, für Knockout 1:30–2:30, für die Hai-Gasse ~2:30, beides ungemessen).
- Ob Chris das Hai-Becken wörtlich meinte oder als Stilgrenze. Dieses Papier nimmt es wörtlich.

## Quellen im Repo

`CLAUDE.md` (Abnahme je Spiel, Matrixsperre, Mehrwege-Leitlinie, Breaking = Folter);
`docs/design/oberflaechen-effekte-und-rempler-vision-08-11.md` Teil 3 (Auftrag);
`docs/design/gewichtheben-sandsack-finale-wegc-format-05-10.md` (Präzedenzfall, Lehren 2.2/6.1/6.2);
`docs/design/gewichtheben-physical100-fable-konzept-03-10.md` 3.4/4 (Ausdauer-Nebenweg rechnerisch
tot); `docs/design/rempler-persoenlichkeit-machbarkeit-08-11.md` (Persönlichkeit wählt, Eignung
entscheidet); `docs/design/battlefield-pod-ffa-02-11.md` und `docs/design/mini-dm-ffa-aufstellung-
mutatoren-20-10.md` (Rangfolge aus einem Spiel als gewertetes Format);
`docs/design/stand-aller-disziplinen.md` 5b und Nachträge 27–29; `data/generated/disziplin-abnahme.json`;
`lib/player-generator/official-discipline-weights.ts`; `lib/player-generator/spiel-eignung-overrides.ts`
(Football, Mini-DM); `public/mockups/battle-mode.engine.js`: `BUEHNE_FLAGS` ~19478, `bauBuehne()`
Weiche ~20358, Weg-C-Block ~21514ff., Rezepte `BUEHNE_ART` ~18214ff., `BAHN_ART` ~44675ff.,
`ARENA_ART`/Feldspiel ~8764ff., Football-Rezept ~9612, `gauntlet:true` ~18459;
`public/mockups/battle-mode.rezepte.js` (Basketball, Hockey).
