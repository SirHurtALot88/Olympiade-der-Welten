# Gewichtheben: „Das Sandsack-Finale“ — Opus-Konzept an Chris (03.10.)

**Konzeptpapier, kein Code, keine Freigabe.** Chris am 03.10., nachdem ihm „Die Ladestrecke“
(PR #1134, `gewichtheben-physical100-fable-konzept-03-10.md`) vorgelegt wurde, wörtlich:

> „ne ich meine gar nicht dass sie ihr gewicht tragen müssen, sondern zb sandsäcke und wer
> schneller trägt gewinnt, da kann man dann auch die anderen attribute besser argumentieren warum
> die mit rein laufen. und zb werden die säcke dann auch immer schwerer so dass manche spieler
> anfangs agiler sind im tragen aber wenn man 5 oder 6 säcke tragen muss über die strecke dann
> schnell zurück und neue holen dass es dann sehr anstrengend wird, leute können die säcke aus der
> hand rutschen, sie müssen evtl kurz pause machen etc je nachdem wie stark sie in der diszi sind
> laut ihren attributen das müsste dann wieder mit einfließen. bekommst du sowas hin? inklusive
> assets usw? wäre dann quasi ein stärke-basiertes 'rennen', spieler könnten hier sogar als team
> antreten, dass es verschiedene stationen gibt und manchmal teilen sich die spieler auf und
> manchmal machen einzelne spieler alle stationen — das bleibt offen und kann als taktik vom team
> bestimmt werden (zb auch durch die slots) und kann variieren."

Nachtrag von Chris während der Bearbeitung: echte *Physical: 100*-Aufgaben dürfen als
Inspirationsquelle dienen, nicht als Vorlage zum Nachbau (Abschnitt 1.3).

Nichts in diesem Papier ist gebaut oder am Motor gemessen. Die Zahlen in Abschnitt 6 kommen aus
einem **Offline-Modell** des Rennens, gerechnet in einem Scratch-Skript außerhalb des Repos auf dem
echten live-save-Kader (`data/generated/kaderfamilie-live-save.json`, fünf Paarungen, zehn Teams,
60 Heber). Das Modell ist ein Baumuster und keine Simulation des Motors. Es zeigt Größenordnungen,
die Wahl zwischen verschiedenen Formeln und deren Fallen, aber keine Nachkommastellen.

---

## 0. Ergebnis vorab

1. **Das ist keine Anzeige mehr, sondern ein zweites Wettkampfelement:** ein **Mannschafts-Finale
   nach den sechs Hantel-Duellen**. Beide Teams tragen auf zwei parallelen Bahnen 15 Sandsäcke über
   drei Stationen (Hof → Rampe → Ladekante, 15 → 105 kg, immer schwerer). Wer zuerst alle Säcke
   abgeliefert hat, gewinnt. Bei Zeitlimit zählt das abgelieferte Gewicht, nach der Medley-Regel
   aus dem Strongman. Erschöpfung, Pausen und Rutscher hängen an den Attributen; die Rutscher sind
   gewürfelt, mit festem Verbrauch nach Falle 17.
2. **Team-Taktik über einen „Lastenplan“ mit drei Formen:** *Anker* (einer trägt alles),
   *Stationen* (drei Spezialisten, je einer pro Station) und *Staffel* (drei Paare, die sich
   abwechseln). In **Stufe 1** wählt eine deterministische Trainer-Automatik für jedes Team den
   schnellsten Plan, für KI und Mensch gleich. Im echten Kader wählen die zehn Teams
   4× Stationen, 3× Staffel und 3× Anker; die Taktik hängt also am Kader. In **Stufe 2** kann der
   Manager den Plan selbst setzen, und die Zuteilung läuft dann über die Slots. Der Unterschied
   zwischen guter und schlechter Zuteilung liegt im echten Kader bei 0 bis 12 % Rennzeit, die
   Entscheidung hat also echtes Gewicht.
3. **Attribute: alle fünf bestehenden Sub-Skills, kein neuer, kein Override.** LAST trägt
   (Tempo unter Last, Ermüdung über die *relative* Last). TECHNIK ist die Agilität (leer zurück,
   aufnehmen, seltener rutschen). ERHOLUNG regelt Pausenlänge und das Erholen in Ruhe. NERVEN
   bestimmen die Pausenschwelle und den „Biss“ an der Grenzlast. ANSAGE ist der Mut zum
   **Doppeln**, also zwei Säcke auf einmal zu nehmen. Jedes der acht Matrix-Attribute bekommt
   damit einen sichtbaren Moment im Rennen. Die gesperrte Matrix bleibt byte-identisch.
4. **Die wichtigste Zahl des Papiers:** Ein „naives“ Trage-Rennen (Kraft plus Agilität plus
   Ausdauer) liest **charisma mit 3 % statt 23 % und speed mit 19,5 % statt 6 %**. Im Modell sind
   das **57,6 Pp Abweichung**, mehr als das Doppelte der Schranke. Mit dem ANSAGE-Hebel (Doppeln
   plus Wagnis-Flex, nach dem Muster von `HEBEN_WAGNIS_ANSAGE_FLEX`) und dem NERVEN-Biss sinkt der
   Wert auf **13,3 Pp**. Ein Sandsack-Rennen trifft die Gewichtheben-Matrix also nur, wenn es
   ausdrücklich auch ein **Mut-Rennen** ist. Das ist die Bauvorgabe Nummer 1.
5. **rho und Pp der Hantel bleiben bit-identisch, wenn das Finale so gebaut wird:** Es läuft nach
   `baueHebenDuelle()`, schreibt nichts in `u.summe` und zieht aus einem eigenen Saatstrom. Das
   Finale verändert nur `seiten` (das Team-Ergebnis), nie `wert`. Das Rennen selbst braucht eine
   **eigene Pp-Abnahme auf Teamebene** (neue Sonde, n ≥ 144 wie bei der Staffel), weil sein
   Teampunkt Teil der Disziplin ist.
6. **Klasse: T, W und M zugleich, und es gibt keine A\*-Variante.** Ein Rennen über 15 Säcke
   braucht bei 1× rund 75 bis 85 Zuschausekunden. Die Sendung wüchse damit von 7:11 auf etwa
   **8:30**. Dazu kommen ein Tabellenpunkt (W) und eine neue Mechanik (M). Die Ladestrecke konnte
   sich ins vorhandene 6,2-s-Fenster schmiegen, das Finale kann es nicht. **Chris muss die
   Einstufung selbst bestätigen** (Abschnitt 8). Dieses Papier gibt nichts frei.
7. **Ladestrecke und Finale vertragen sich, die Ladestrecke ist sogar die Bauvorstufe.** Sie baut
   Trage-Pose, Gang-Interpolation und Frische-Ring, und genau diese Teile braucht das Finale auch.
   Ob beide in der Sendung bleiben oder die Ladestrecke danach wegfällt, entscheidet Chris
   (Abschnitt 9.4).

Abschnitt 10 ist die ausfüllbare Entscheidungsvorlage.

---

## 1. Ausgangslage

### 1.1 Was heute im Code steht (Stand `origin/main` `83d02cf1`)

Alles in `public/mockups/battle-mode.engine.js`:

* **Ablauf:** `baueHebenDuelle()` (`:16397`) paart sechs Duelle über den Slot (Index =
  `HEBEN_ROLLEN`-Rolle, `:16164`). `hebeUebung()` (`:16489`) rechnet Reißen und Stoßen vorab,
  danach enthüllt `buehneQueue` 72 Versuche zu je 6,2 Zuschausekunden. Gemessene Sendung: **7:11**,
  das Bild steht 95 % der Zeit still (Audit Runde 2).
* **Wertung, zwei Ebenen** (`gewichtheben-plan.md` Teil 1): Der **Spielerwert** `u.summe` sind die
  eigenen Zweikampf-kg; ihn liest die rho- und Pp-Abnahme. Das **Team-Ergebnis** ist
  `seiten = gewonnene Duelle` (`spieleBuehneHeben()`, `:44674`). Bei 3:3 entscheidet heute die
  unsichtbare Gesamt-kg-Summe (`arenaTeamPointsForFixtureMitTiebreak()`,
  `lib/resolve/battle-mode-arena-team-points.ts:1022`). Der Plan nennt für die Duellzählung
  **3:3 in 29 % der Spiele**. Das ist eine Planungsmessung, die eine Bau-Runde nachzählen muss.
* **Rezept** (`:14506`): LAST {power 60, health 25, determination 15}, TECHNIK {dexterity 45,
  speed 70, determination 20, power 5}, NERVEN {charisma 35, will 35, determination 20,
  health 10}, ANSAGE {charisma 53, power 8, will 13, dexterity 9, health 10, speed 7},
  ERHOLUNG {stamina 40, health 35, will 25}.
* **Matrix (gesperrt):** power 28, charisma 23, health 16, determination 12, will 7, speed 6,
  dexterity 6, stamina 2.
* **Abnahme heute:** rho je Spiel 0,865 (Spannweite 0,143, Saison 0,944), Pp 9,6 (Mittel über
  fünf Ströme bei n=48). Damit ist Gewichtheben die am saubersten kalibrierte Disziplin des
  Projekts.

### 1.2 Was die Ladestrecke dazu schon gemessen hat, und warum das hier kein Widerspruch ist

Das Ladestrecken-Papier hat ein Sandsack-Rennen ausdrücklich verworfen (Abschnitt 2.2/3.4/8.2:
„gemessen tot“). Gemessen war dort allerdings etwas anderes: **ein** Sack, **ein** Gang, **je
Duell**, mit Tempo aus 0,85·LAST + 0,15·ERHOLUNG. Da entscheidet LAST in 30 von 30 Paarungen, und
das Rennen ist schon an der Ansage abzulesen. Dieser Befund stimmt, und er gilt hier weiter: Ein
einzelner schwerer Sack ist ein LAST-Rennen.

Chris beschreibt aber etwas, das in diesem Befund nicht vorkam: **viele Gänge mit steigender
Last, Ermüdung über die Gänge, Pausen, Rutscher und eine Mannschaft, die sich die Arbeit
einteilt.** Genau diese drei Zutaten brechen die LAST-Dominanz auf (Abschnitt 6): Die Agilen
liegen auf den leichten Säcken vorn, die Starken auf den schweren, die Zähen beim Durchhalten, und
die Mannschaftstiefe entscheidet über die Taktik. Die Ladestrecke hat das richtige Urteil über das
falsche Format gefällt.

### 1.3 Physical: 100 als Inspiration (recherchiert, nicht nachgebaut)

Drei Aufgaben der Netflix-Show tragen Details, die für eine glaubwürdige Mechanik etwas hergeben:

| Show-Aufgabe | Was sie zeigt | Was dieses Konzept daraus nimmt |
|---|---|---|
| **„Moving Sand“** (Staffel 1, Mannschafts-Quest): Fünferteams tragen Sandsäcke über eine Brücke in einen Kasten; nach 12 Minuten gewinnt, wer am meisten Sand im Kasten hat; auf der Brücke dürfen keine Säcke übergeben werden. | Ein **festes Zeitfenster** macht das Format sendbar, und **gewichtsbasiert werten** belohnt Durchhalten. Außerdem gewann laut Rezensionen ausgerechnet das unterschätzte Team. | **Medley-Regel mit Zeitlimit** (4.4), Wertung nach abgeliefertem Gewicht, falls niemand fertig wird. **Keine Übergabe auf der Strecke**: Gewechselt wird nur an der Wechsellinie. |
| **Minen-Quest 3** (Staffel 2 „Underground“): Teams bewegen Loren voller 40-kg-Säcke. Runden wechseln zwischen Zweierteam und Einzelstarter; eine Runde verlangt 1,2 Tonnen von einer einzelnen Person. | Der Strategiefehler, an dem eine Mannschaft scheiterte, war die **Ladeentscheidung**: 15 Säcke pro Fuhre statt alle 30 auf einmal. Dazu kommt der Wechsel zwischen Solo und Duo, und ein Teilnehmer, der eine Runde **allein** übernahm, nachdem er im Duo enttäuscht hatte. | **Doppeln** als ANSAGE-Entscheidung (4.3), **Anker gegen Staffel** als Mannschaftstaktik (5). |
| **Farmer's-Carry-„Capture the Flag“** (Staffel 2, erste Mannschafts-Quest): Sandsäcke im Labyrinth zu Basen tragen; die Basis gehört dem, der dort das meiste Gewicht abgeliefert hat. | Gewicht als Wertungseinheit, **mehrere Ziele**, und die Frage, welches Ziel sich lohnt. | **Mehrere Stationen** mit eigener Charakteristik (4.1). |

Quellen: What to Watch, Rekap Staffel 2 Folge 6 („Into the mines“) und „How does Physical: 100
work?“; Sportskeeda zu Staffel 1 Folge 4; dmtalkies, Rekap Staffel 2 Folgen 5–7; Flicks-Rezension
zu Staffel 2. Die Einzelheiten der Taktik in „Moving Sand“ (wie genau das unterschätzte Team
gewann) ließen sich aus den Quellen nicht belegen und werden hier deshalb nicht behauptet.

---

## 2. Wo das Rennen im Spielablauf sitzt

### 2.1 Gewählt: nach dem sechsten Duell, als Mannschafts-Finale

Ablauf einer Gewichtheben-Sendung mit Finale:

1. Sechs Hantel-Duelle wie heute: 72 Versuche, 7:11, bit-identisch.
2. **Tafel „Lastenplan“** (~5 s): Beide Teams zeigen ihren Plan, etwa „Cold Steel: Staffel —
   Gram & Iris an der Ladekante“ oder „Raging Lunatics: Anker — Brakka trägt alles“. Gezeigt
   werden **keine** erwarteten Zeiten, weil das den Ausgang verraten würde.
3. **Das Rennen** (bei 1× höchstens ~75 s, gedeckelt durch das Zeitlimit, 4.4): Zwei Bahnen,
   Heim oben und Gast unten, Station für Station.
4. **Zieleinlauf und Endstand** (~4 s): Das Finale zählt als siebter Mannschaftspunkt (W2,
   Abschnitt 3), die Tafel springt etwa von 3:3 auf 4:3.

### 2.2 Warum genau dort, und nicht anderswo

| Platz | Bewertung |
|---|---|
| **Vor den Duellen, als „Auftakt-Quest“** | Ein Punkt stünde von Anfang an auf der Tafel, und das Rennen wäre immer offen. **Aber:** Wer 15 Säcke getragen hat, hebt danach frisch. Das wäre erzählerisch gelogen, und eine echte Ermüdung schriebe in `u.summe` (rho-Hebel) und zählte ERHOLUNG doppelt (das Pp-Problem aus Ladestrecke 2d). Außerdem müsste G1 (`hebenTeamLage()`, `:16358`) den Rennpunkt mitlesen, und damit würde die Hantel-Mechanik angefasst. **Nicht empfohlen.** |
| **Zwischen Reißen und Stoßen aller Duelle** | Liegt an derselben Stelle wie die Ladestrecke, aber für ein Mannschaftsrennen zerreißt es die Duell-für-Duell-Erzählung, die Chris gefällt, und hat dasselbe Ermüdungsproblem. **Nein.** |
| **Parallel im Hintergrund während der Duelle (ε)** | Kostet keine Sendezeit, weil das Rennen auf einer Nebenbahn läuft, während vorne gehoben wird. **Aber:** Ein Rennen, das über sieben Minuten verteilt ist, ist kein Rennen mehr. Der Blick des Zuschauers wird geteilt, und die Träger heben zwischendurch „frisch“. Das wäre die einzige Variante ohne T, ist dramaturgisch aber die schwächste. Sie steht nur der Vollständigkeit halber da. |
| **Nur als Stechen bei 3:3 (W1)** | Wäre die kleinste Wertungsänderung (Abschnitt 3), lief aber nur in rund einem Drittel der Spiele. Bei zwei Gewichtheben-Spielen je Saison sähe Chris es dann manche Saison gar nicht. Das widerspricht „potenziell zentral“. Als Rückfall taugt es, als Empfehlung nicht. |
| **Nach den Duellen (gewählt)** | Am Ende ist niemand mehr zu ermüden: Die Hantel ist fertig gerechnet, das Finale liest nur noch die Sub-Skills der Teilnehmer. Es entsteht ein eigener Sendungsbogen mit sechs Einzelduellen, dann der Mannschaftsmoment, und das entspricht der Dramaturgie jeder Mannschaftsübertragung. Die Hantel-Wertung bleibt per Bauart unberührt (7.1). |

---

## 3. Wertung: Was das Finale zählt

| Variante | Was zählt | Wirkung auf die Tabelle | Klasse |
|---|---|---|---|
| **W0 — Schau** | Kein Punkt, nur Boxscore und Ticker | keine | T (Sendezeit), M |
| **W1 — Stechen** | Läuft nur bei 3:3 und ersetzt die unsichtbare Gesamt-kg-Entscheidung | ändert das Ergebnis nur dort, wo Rennsieger ≠ kg-Sieger | T (bedingt), W, M |
| **W2 — siebter Punkt (Empfehlung)** | Läuft **immer** und zählt einen Mannschaftspunkt, die Tafel geht dann bis 7 | **In der Tabelle exakt so wirksam wie W1:** Aus 4:2 wird 5:2 oder 4:3, der Sieger bleibt gleich; nur 3:3 kippt, dann aber sichtbar. Das kg-Stechen bleibt bloß Notnagel (gleiche Zeit *und* gleiche kg). | T, W, M |
| **W3 — Finale zählt doppelt** | Zwei Punkte, angelehnt an das Physical-100-Prinzip „die letzte Quest wiegt mehr“ | Aus 4:2 kann 4:4 werden, dann entscheidet die kg-Summe; das Rennen kann also auch einen Duell-Vorsprung kippen | T, W (deutlich), M |

**Warum W2:** Das Finale läuft in jedem Spiel, wird also gesehen, verschiebt die Tabelle aber
**nicht stärker** als ein Stechen. Es ersetzt eine unsichtbare Zahl (die Gesamt-kg bei 3:3) durch
einen sichtbaren Wettkampf, der dieselbe Richtung hat. Im Modell stimmt der Rennfavorit in 4 von 5
Paarungen mit dem kg-Favoriten überein. Die fünfte Paarung (Mortal Sin gegen Natures Wrath, kg-Summe
11 % auseinander) ist im Rennen ein Münzwurf mit 36,5 zu 63,5 (6.2). Das ist die Stelle, an der
Mannschaftstiefe gegen Spitzenkraft gewinnt. Genau dafür ist der Nebenweg da.

**Anschlussstellen, wenn W2 gewählt wird:** `spieleBuehneHeben()` gibt `seiten` mit dem
Finalpunkt zurück. `boxscore[].wert` und `gesamtKg` bleiben unverändert. Jede Anzeige, die „Duelle
x:y von 6“ annimmt, muss nachgezogen werden: HUD (`updateHudBuehne()`, Zweig `BB().heben`),
Spielbericht, Endstand-Banner. **Sie muss in der Bau-Runde per Grep auf `seiten`/`duellGewonnen`
gesucht werden. Dieses Papier hat sie nicht vollständig erfasst.**

---

## 4. Die Mechanik

Alle Formeln sind **Startwerte für die Kalibrierung per Sonde**, keine Vorgaben. Es sind die Werte,
mit denen das Offline-Modell aus Abschnitt 6 gerechnet hat. Sub-Skills werden wie heute über
`mische()` (`:5602`) gebildet und stehen nach `baueHebenDuelle()` bereits auf jedem Teilnehmer.

### 4.1 Drei Stationen, 15 Säcke, immer schwerer

| Station | Säcke (kg) | Strecke | Besonderheit | Wen sie bevorzugt |
|---|---|---|---|---|
| **A — Der Hof** | 15 · 20 · 25 · 30 · 35 · 40 | 24 m eben | weit, leicht; **Doppeln erlaubt** | Agile (TECHNIK), Mutige (ANSAGE) |
| **B — Die Rampe** | 30 · 40 · 50 · 60 · 70 | 16 m, davon die Rampe hinauf (Steigfaktor 1,3) | mittel, bergauf; Doppeln erlaubt, aber selten möglich | Ausgewogene; Rutscher am häufigsten (Grip unter Ermüdung) |
| **C — Die Ladekante** | 60 · 75 · 90 · 105 | 8 m, dann **auf 1,2 m Kante wuchten** | kurz, schwer; kein Doppeln | Kraft (LAST), Biss (NERVEN) |

Die Stationen laufen **nacheinander**. Station B beginnt erst, wenn der letzte Sack von A
abgeliefert ist. So entsteht der Bogen, den Chris beschreibt: Anfangs sind die Agilen vorn, später
wird es schwer, und am Ende wuchten die Starken. Innerhalb jeder Station steigt das Gewicht.

**Gewichte und Kapazität:** sichere Traglast `K = 30 + 1,2·LAST` kg (bei LAST 20/50/90:
54/90/138 kg). Der schwerste Sack (105 kg) liegt damit für die meisten Heber **über** K. Das ist
gewollt, denn an der Ladekante soll man die Grenze sehen. Die Sackgewichte sind Bühnen-kg und
nicht Sinclair-normiert. Sie sollen lesbar sein, nicht realistisch skaliert.

### 4.2 Ein Gang: aufnehmen, tragen, ablegen, zurück

```
r      = kg / K                                   // relative Last
Kf     = K · (1 + 0,012·(ANSAGE − 50))            // Wagnis-Flex: Selbstvertrauen dehnt den Maßstab
rf     = kg / Kf
vLeer  = 3,6 + 0,6·TECHNIK/100                    // m/s leer; Agilität bewusst nur ein kleiner Hebel
biss   = rf > 0,7 ? 1 + 0,25·(NERVEN − 50)/50 : 1 // die Bank trägt durch die Grenzlast
vLast  = vLeer · max(0,18; 1 − 0,85·rf^1,6) · (1 − 0,35·E/100) · biss
t      = (0,5 + 0,6·r)                            // aufnehmen
       + d·steig / vLast                          // tragen
       + (Kante ? 0,6 + 1,5·max(0; r − 0,5) : 0)  // auf die Ladekante wuchten
       + d / (vLeer·(1 − 0,25·E/100))             // leer zurück
```

**Warum `Kf` mit ANSAGE:** Das ist exakt das Muster von `HEBEN_WAGNIS_ANSAGE_FLEX` (`:16216`).
Wer sich etwas zutraut, behandelt eine Last nahe an der eigenen Grenze nicht wie ein Wagnis. Ohne
diesen Hebel liest charisma im Rennen 3 % statt 23 % (Abschnitt 6.4). Das ist keine Kosmetik,
sondern die tragende Säule der Pp-Abnahme.

### 4.3 Doppeln: zwei Säcke auf einmal (die ANSAGE-Entscheidung)

An Station A und B, vor jedem Gang, deterministisch:

```
doppelt = nächster Sack existiert  &&  (kg₁ + kg₂) / Kf ≤ 0,40 + 0,005·(ANSAGE − 50)
```

Doppeln spart einen ganzen Gang, also Hin- und Rückweg. Dafür steigt `r`, und damit sinkt das
Tempo, die Ermüdung und das Rutschrisiko nehmen zu. Das ist die Ladeentscheidung der Minen-Quest
aus Physical: 100 („alle auf einmal oder in Fuhren?“). Im Bild ist es die Szene, in der sich
jemand zwei Säcke auf die Schultern lädt, im Ticker heißt es „Iris doppelt: 25 + 30 kg!“. Im Modell
doppelt ein Team 0- bis 4-mal je Rennen.

### 4.4 Zeitlimit und Medley-Regel

Das Rennen hat ein **Zeitlimit** von 190 Simulationssekunden, das bei 1× **höchstens ~70
Zuschausekunden** entspricht (Zeitraffer 0,37, siehe 8.1). Es gilt die echte Strongman-Medley-Regel:

* Liefern **beide** alle 15 Säcke ab, gewinnt die kürzere Zeit.
* Liefert **einer** alle ab, gewinnt er.
* Liefert **keiner** alle ab, gewinnt das **höhere abgelieferte Gewicht**, bei Gleichstand die
  Zahl der Säcke und danach die Zeit des letzten Sacks.

Das Limit hat zwei Aufgaben. Erstens **deckelt es die Sendezeit** auf eine feste Obergrenze, die
Chris einmal setzt und die nicht vom langsamsten Team abhängt; das kommt aus Physical: 100
„Moving Sand“ mit seinen 12 Minuten. Zweitens hat das Ende ein eigenes Drama, nämlich den
Wettlauf gegen die Uhr am letzten, schwersten Sack. Im Modell würden 7 von 10 Teams unter dem Limit
fertig. Kalibrierziel ist „rund zwei Drittel“.

### 4.5 Erschöpfung, die man sieht

Jeder Träger hat einen Erschöpfungswert `E` (0..100, Start 0):

```
nach jedem Lastgang:   E += 60 · r² · (d·steig/20) · (1,35 − 0,7·ERHOLUNG/100)
auf dem Rückweg:       E −= 2 · ERHOLUNG/100 · d/20
während andere tragen: E −= (2 + 4·ERHOLUNG/100) je Sekunde        // Staffel-Partner erholt sich
```

**Der Kern:** Die Ermüdung wächst mit **r²**, also mit der *relativen* Last. Wer stark ist, ermüdet
an demselben Sack langsamer. Das ist physiologisch richtig (die relative Intensität bestimmt die
Ermüdung), und es heißt, dass die Erschöpfungsgeschichte hauptsächlich über **LAST** erzählt wird
(power, health, determination) und ERHOLUNG nur moduliert. Genau so passt sie in die Matrix, in der
stamina nur 2 zählt (Abschnitt 6.4). Den Agilen holt die Ermüdung an der Rampe ein, den Kraftprotz
nicht.

### 4.6 Pause

Vor jedem Lastgang, deterministisch:

```
Schwelle S = 50 + 0,35·(NERVEN − 50)          // wer Nerven hat, beißt länger durch
wenn E ≥ S:  Pause, bis E auf S − 25 gefallen ist, Rate (3 + 5·ERHOLUNG/100) je Sekunde
```

Die Pause ist **deterministisch**: Wer leer ist, *muss* stehen bleiben, das ist keine Glückssache.
Ihre Länge erzählt die ERHOLUNG, ihr Zeitpunkt die NERVEN. Im Bild: Hände auf den Knien, ein Ticker
„Brakka muss verschnaufen — 4 Säcke noch“. Im Modell kommt es zu etwa **einer Pause je Rennen**
(beide Teams zusammen), fast immer beim Anker oder bei einem Stations-Spezialisten an der
Ladekante.

### 4.7 Der Rutscher, das gewürfelte Element

Chris will ausdrücklich „können aus der Hand rutschen“, also eine Überraschung. Ein
deterministischer Rutscher wie bei der Ladestrecke („Frische < 0,93 und drittes Reißen ungültig“)
wäre nach dem dritten Mal vorhersehbar. Hier wird deshalb **gewürfelt**:

```
p = 0,02 + 0,35·max(0; rf − 0,6) + 0,15·(E/100)² − 0,04·(TECHNIK − 50)/50     // auf [0,005; 0,45]
Rutscher:  t += (0,8 + 0,8·r) · (1,3 − 0,6·NERVEN/100);   E += 4
```

Das Risiko kommt also aus drei Quellen: aus der Grenzlast (LAST und ANSAGE über `rf`), aus der
Ermüdung (ERHOLUNG) und aus dem Griff (TECHNIK). Wie viel ein Rutscher kostet, bestimmen die
NERVEN, denn manche greifen sofort nach und andere fummeln. Im Modell gibt es **1,3 Rutscher je
Rennen** (beide Teams zusammen).

**Handbuch-Falle 17, wörtlich ernst genommen:** Weil das Doppeln die Zahl der Gänge verändert,
darf **nicht** „ein Wurf je Gang“ gezogen werden. Sonst verschiebt eine höhere ANSAGE die
Zufallsfolge zwischen Basis- und Hebungslauf von `einflussVon`, und die Pp-Messung misst ein
Artefakt. Vorgabe deshalb: **15 Würfe je Team beim Rennstart, einer je Sack-Index**. Ein Gang nutzt
den Wurf seines ersten Sacks, nicht genutzte Würfe verfallen. Und: **eigener Saatstrom** für das
Finale, abgeleitet aus der Spielsaat und unabhängig vom Haupt-`rr()`. Dann kann das Finale später
nachkalibriert werden, ohne die Hantel-Folge auch nur um einen Wurf zu verschieben (7.1).

### 4.8 Wechsel

Ein Trägerwechsel (Staffel, Stationswechsel) kostet **0,3 s** fürs Abklatschen an der
Wechsellinie. Wie bei „Moving Sand“ gibt es **keine Übergabe auf der Strecke**: Wer einen Sack
aufnimmt, bringt ihn auch ins Ziel.

---

## 5. Team-Taktik: Anker, Stationen oder Staffel

### 5.1 Die drei Pläne

| Plan | Wer trägt | Stärke | Schwäche |
|---|---|---|---|
| **Anker** | Einer trägt alle 15 Säcke, die fünf anderen feuern an | Der Beste trägt jeden Sack, und es gibt keinen Wechsel | Die Ermüdung sammelt sich über drei Stationen an, Pausen und Rutscher häufen sich hinten. Das ist der Moment, in dem „sehr anstrengend“ sichtbar wird. |
| **Stationen** | Drei Spezialisten, je einer pro Station | Der Agile nimmt den Hof, der Kraftprotz die Ladekante, und jeder kommt frisch an | Jeder trägt seine Station allein, die Ermüdung steigt innerhalb der Station. Drei der sechs müssen gut sein. |
| **Staffel** | Drei Paare, je eins pro Station, die sich Sack für Sack abwechseln | Jeder trägt nur jeden zweiten Sack, der Partner erholt sich in der Zwischenzeit | Sechs müssen tragen, auch der Schwächste. Dazu kommen Wechselzeiten. |

**Spieltheorie im echten Kader (Modell, 10 Teams):**

* **Anker gewinnt, wenn einer weit über allen anderen steht.** Das sind Armageddon Aftermath,
  Natures Wrath und Raging Lunatics. Ihr Anker ist so stark, dass auch er mit Pause schneller ist
  als jedes Paar.
* **Stationen gewinnen, wenn es zwei, drei starke, aber verschiedene Typen gibt.** Das sind
  Vigilante, Dire Legion, Golden Gladiators und Silver Soldiers.
* **Staffel gewinnt, wenn der Kader in der Tiefe ausgeglichen ist.** Das sind Cold Steel, Mortal
  Sin und Pirate Crew. Bei Mortal Sin brauchen drei Spezialisten 15 % länger als die Staffel, ein
  Anker 24 % länger.
* Oft liegen die Pläne eng beieinander, bei Cold Steel etwa Staffel 147,7 gegen Stationen 148,1.
  Gerade dort ist die Wahl eine echte Entscheidung und kein Automatismus.

Damit ist die Mehrwege-Leitlinie auch auf **Mannschaftsebene** erfüllt: Ein Team ohne Superstar,
aber mit sechs soliden Trägern, hat einen eigenen Weg zum Finalpunkt (Abschnitt 6.3).

### 5.2 Wie das Team wählt: Stufe 1 Automatik, Stufe 2 Manager

**Stufe 1 — Trainer-Automatik (empfohlen als erster Bau):** Für jedes Team wird jeder mögliche Plan
mit dem **Erwartungswert** des Rennens durchgerechnet. Das ist dieselbe Formel ohne Würfel, mit dem
erwarteten Rutschverlust `p·Verlust`. Gewählt wird der schnellste Plan. Es gibt 6 Anker-, 120
Stationen- und 720 Staffel-Belegungen, also 846 Rechnungen à 15 Gänge, unter 2 ms. Für KI und
Mensch gilt dieselbe Regel nach dem Muster `berechneFokusAuto`. Vorteil: **keine neue Oberfläche,
keine Änderung an der Übergabe `{d, slot}`**, und die Taktik variiert trotzdem von Kader zu Kader,
wie Chris es will.

**Stufe 2 — der Manager setzt den Plan, die Slots verteilen die Arbeit:** Neues Feld
„Lastenplan“ in der Einsatzliste: [Automatik · Anker · Stationen · Staffel]. Die Zuteilung folgt
den Slots. Das ist Chris' „zb auch durch die slots“:

| Slot (`HEBEN_ROLLEN`) | Staffel-Station | Stationen-Plan | Anker-Plan |
|---|---|---|---|
| Technical Lift (dexterity/speed) | A Hof, Startläufer | **A Hof** | — |
| Pressure Lift (charisma, „geht aggressiv“) | A Hof | — | — |
| Grip Anchor („hält, wenn es eng wird“) | B Rampe, Startläufer | **B Rampe** | **Standard-Anker** (änderbar) |
| Final Attempt | B Rampe | — | — |
| Power Opener (maximale power) | C Ladekante, Startläufer | **C Ladekante** | — |
| Safe Lift (health/determination) | C Ladekante | — | — |

Die Zuordnung ist thematisch gewählt, weil die Slot-Texte die Geschichten schon erzählen. Sie hat
aber **echten Preis**: Im Modell verliert die beste slotfeste Belegung gegenüber der Automatik
**0 bis 12 % Rennzeit** (Proxy: Slots nach Eignung besetzt; im Spiel setzt der Manager die Slots
selbst). Ein Anker auf dem falschen Slot kann die Rennzeit mehr als verdoppeln. Deshalb gehört zu Stufe 2 eine
**Einschätzung im Aufstellungsbildschirm**: „Automatik schätzt: Staffel 148 · Stationen 148 · Anker
173“. Sie stammt aus derselben Erwartungswert-Funktion. Der Manager entscheidet dann informiert und
nicht blind. Eine Anzeige in der Arena gibt es nicht, weil das ein Spoiler wäre.

**Abhängigkeit für Stufe 2:** Die Übergabe Motor ↔ Aufstellung trägt heute nur `{d, slot}`
(`arena-kader-adapter.ts`; Befund A im Papier vom 02.10.). Ein Mannschaftsfeld „Lastenplan“
braucht dasselbe Grundgerüst wie der Haltungs-Pilot (Zeile 0 dort). **Beide sollten zusammen gebaut
werden, nicht zweimal.**

---

## 6. Offline-Diagnose: Was das Modell sagt

Gerechnet auf zehn echten Teams (fünf Paarungen, je Top-6 nach `d.gewichtheben`, wie in der
Ladestrecken-Diagnose 3.4). Die Sub-Skills kommen aus `mische()` **ohne** Slot-, Form- und
Trait-Zuschläge. Pläne sind deterministisch gewählt, Zufallsläufe mit 200 Saaten je Paarung. Das
Skript liegt außerhalb des Repos und wird nicht committet.

### 6.1 Rennverlauf

| Größe | Wert | Ziel für die Kalibrierung |
|---|---|---|
| Rennzeit, deterministisch, bester Plan | 130 bis 229 Sim-s, Median ~187 | Zeitlimit 190 → rund 2/3 fertig |
| Rutscher je Rennen (beide Teams) | 1,27 | 0,8–2 |
| Pausen je Rennen (beide Teams) | 1,01 | 0,5–2 |
| Doppel-Gänge je Team | 0–4 | ≥ 1 im Mittel |
| Planwahl der 10 Teams | Stationen 4 · Staffel 3 · Anker 3 | kein Plan > 60 % |

### 6.2 Wer gewinnt?

| Paarung | Pläne | Zwischenstand nach A / B / C (Sim-s) | Favorit gewinnt (200 Saaten) |
|---|---|---|---|
| Vigilante – Armageddon | Stationen – Anker | 45/98/130 – 68/138/186 | 100 % |
| Cold Steel – Dire Legion | Staffel – Stationen | 59/112/148 – 61/128/163 | 100 % |
| Golden Gladiators – Silver Soldiers | Stationen – Stationen | 60/121/152 – 70/137/172 | 100 % |
| Mortal Sin – Natures Wrath | Staffel – Anker | 78/150/207 – 81/154/206 | **36,5 %**, Führungswechsel an der Ladekante |
| Pirate Crew – Raging Lunatics | Staffel – Anker | 88/165/229 – 68/131/170 | 100 % |

**Ehrlich gelesen:** Zwischen klar verschieden starken Mannschaften ist das Rennen so vorhersehbar
wie das Heben selbst. Der Rang zwischen Rennzeit und Σ Eignung liegt über die zehn Teams bei
**Spearman 0,915**. Das ist **Validität**, kein Fehler, denn Chris' Satz „wer mit 80 reingeht, muss
oben stehen“ gilt auch hier. Die Spannung im Rennen kommt aus drei Quellen:

* aus der **engen Paarung** (hier 1 von 5): Der Anker der Gegenseite muss an der Ladekante pausieren,
  und die Staffel zieht vorbei;
* aus den **Einzelmomenten** (Rutscher, Pause, Doppeln, das Zeitlimit am letzten Sack);
* aus dem **Kreuzen der Typen innerhalb eines Rennens** (6.3).

Ständige Führungswechsel gibt es nicht, und ein Konzept, das sie verspricht, wäre unehrlich.

**Golden Gladiators gegen Silver Soldiers** zeigt, was das Finale über die Hantel hinaus erzählt:
Die Summe der Tagesmaxima ist praktisch gleich (2209 zu 2206 kg), im Rennen liegen die Gladiators
aber 13 % vorn. Das Finale entscheidet dort also nach etwas anderem als nach Rohkraft, nämlich nach
Zusammensetzung und Taktik. Genau das ist die „Argumentierbarkeit“, die Chris will.

### 6.3 „Anfangs agiler, später erschöpft“: gibt es das wirklich?

* **Kreuzung leicht/schwer:** In **33,5 %** aller 1770 Heber-Paare im Feld ist der Schnellere auf
  einem 20-kg-Sack im Hof der Langsamere an der 90-kg-Ladekante. In einem Drittel aller Paarungen
  passiert also genau das, was Chris beschreibt.
* **Validität des Einzelträgers:** Die Solozeit über alle 15 Säcke korreliert mit
  `d.gewichtheben` bei **Spearman 0,952** (60 Heber). Der Gewichtheber mit Eignung 80 ist auch der
  beste Sandsackträger. Das Finale stellt die Matrix nicht auf den Kopf, es gibt ihr nur mehr Bild.
* **Mehrere Wege, konkret:**

| Weg | Wer | Wo er gewinnt | Wie stark gestellt |
|---|---|---|---|
| **Primär: Kraft** (LAST) | power-/health-Heber | Ladekante, Rampe; ermüdet am langsamsten | volle Belohnung, entscheidet die meisten Rennen |
| **Neben: Agilität** (TECHNIK) | speed/dexterity | Hof; Zwischenstand nach A | kleiner Hebel (vLeer ±7 %), wird an der Rampe eingeholt |
| **Neben: Mut** (ANSAGE) | charisma | Doppeln spart ganze Gänge; Wagnis-Flex an der Grenzlast | groß in der Wirkung, mit Rutschrisiko |
| **Neben: Biss** (NERVEN/ERHOLUNG) | will, determination, stamina | spätere und kürzere Pausen, schneller nachgegriffen | sichtbar vor allem beim Anker |
| **Mannschaft: Tiefe** (Staffel) | Teams ohne Superstar | gegen einen ermüdenden Anker | Mortal Sin gegen Natures Wrath |

### 6.4 Pp: Warum ein naives Trage-Rennen die Matrix verfehlt

Budget-Methode (wie `einflussVon`) im Modell: je Spieler und Attribut +10 Punkte, Gewinn an
Rennzeit, normiert. Gemessen im deterministischen Erwartungswert, mit neu gewähltem Plan nach jeder
Hebung:

| Attribut | Matrix | **naiv** (Kraft + Agilität + Ausdauer, ohne ANSAGE-Hebel) | **empfohlen** (Abschnitt 4) |
|---|---:|---:|---:|
| power | 28 | 36,0 | 33,5 |
| charisma | 23 | **3,0** | 22,5 |
| health | 16 | 13,7 | 15,6 |
| determination | 12 | 13,7 | 7,7 |
| will | 7 | 1,0 | 7,1 |
| speed | 6 | **19,5** | 6,8 |
| dexterity | 6 | 11,7 | 6,2 |
| stamina | 2 | 1,5 | 0,5 |
| **Pp-Abweichung des Rennens** | | **57,6** | **13,3** |

Daraus folgen drei Bauvorgaben:

1. **Charisma braucht einen echten Rennhebel.** Ohne ANSAGE (Doppeln plus Wagnis-Flex) und
   NERVEN-Biss fehlen 20 Pp allein bei charisma. Thematisch ist das gedeckt: Die Matrix-Begründung
   für Gewichtheben ist schon heute „das Publikum trägt den Lifter durch die letzten Kilo“
   (Kommentar `:14413`).
2. **Agilität muss ein kleiner Hebel bleiben.** Mit `vLeer = 3,2 + 2,4·TECHNIK` liest speed 19,5 %.
   Das ist exakt der Befund vom 01.10. (speed +5 bis +6 Pp über Matrix), nur dreimal so groß. Mit
   `3,6 + 0,6·TECHNIK` sind es 6,8 %.
3. **Ausdauer wird erzählt, aber nicht gewichtet.** stamina steht in der Matrix bei 2. Ein Rennen,
   in dem Ausdauer entscheidet, verfehlt die Matrix zwangsläufig. Die Erschöpfung läuft deshalb über
   die relative Last (r², also LAST), und stamina wirkt nur über ERHOLUNG auf Pausenlänge und Ruhe.
   Im Bild ist sie sichtbar (Erschöpfungsring, Pause), im Ergebnis bleibt sie so klein, wie die
   Matrix es will.

Die 13,3 Pp sind eine Modellzahl ohne Rauschen, ohne Slot/Form/Trait und mit n=10 Teams. In echten
Motor-Messungen lagen Pp-Zahlen bisher **über** den Modellzahlen. Das Ziel bleibt ≤ 25 in zwei
Saatstämmen, gemessen mit einer echten Sonde (7.2).

---

## 7. rho und Pp: Einschätzung und Prüfweg

### 7.1 Die Hantel: bit-identisch per Bauart

Drei Bauregeln, die zusammen die Bit-Identität garantieren:

1. Das Finale wird **nach** `baueHebenDuelle()` gerechnet (eigene Funktion, Arbeitstitel
   `baueSandsackFinale(art, paar, saat)`) und liest nur `u.LAST/TECHNIK/NERVEN/ANSAGE/ERHOLUNG`.
2. Es schreibt **nie** in `u.summe`, `u.zweikampf`, `u.runden`, `u.maxStossen`, `u.duellGewonnen`,
   `ansage[]` oder `buehneQueue`. Ergebnisse liegen auf eigenen Feldern (`u.lastKg`,
   `u.lastRutscher`, `u.lastPausen`, Team-Objekt `LASTEN`).
3. **Eigener Saatstrom.** Kein Wurf aus dem Haupt-`rr()`, auch nicht hinter allen Hantel-Würfen.
   Dann bleibt auch jede Folge nach dem Finale unverschoben.

Damit sind `wert` und `gesamtKg` bit-identisch, **rho (0,865/0,143/0,944) und Pp (8,5/10,0/11,4/
10,1/7,9) müssen zeichengleich bleiben**. Das Protokoll ist dasselbe wie in Ladestrecke 5.1 und bei
G2/G3:

```sh
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben
node scripts/messe-arena-einfluss.mjs gewichtheben 48
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48
node scripts/messe-arena-einfluss.mjs gewichtheben 48 --saat-versatz=20000000
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48 30000000
node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs gewichtheben 48 40000000
node scripts/miss-gewichtheben-korridor.mjs 200
```

Dazu ein Boxscore-Vergleich über `spieleBuehneHeben("gewichtheben", saat)` für 50 Saaten:
`wert` und `gesamtKg` müssen byte-gleich sein, nur `seiten` darf sich ändern (W2: +1 für den
Finalsieger) und die neuen Anhänge kommen dazu.

### 7.2 Das Rennen selbst: eine neue Pflichtsonde

Die bestehende Pp-Messung ist für das Finale **blind**, weil sie `wert` liest und das Finale
`wert` nicht anfasst. Ein Teampunkt, der zur Disziplin zählt, muss aber dieselbe Matrix
durchreichen (CLAUDE.md, „die müssen am Ende auch so rauskommen“). Wer das übersieht, baut einen
Kanal, durch den beliebige Attribute Tabellenpunkte holen, ohne dass eine Messung anschlägt.
Deshalb braucht es ein neues Skript, Arbeitstitel `scripts/miss-sandsack-finale.mjs`:

| Prüfung | Ziel | Bemerkung |
|---|---|---|
| **Pp des Rennens** (Budget-Methode auf die Rennzeit, je Spieler und Attribut +10) | **≤ 25**, zwei Saatstämme | **n ≥ 144**: Sechs teilen sich ein Ergebnis, wie bei der Staffel (Kommentar `messe-arena-einfluss.mjs`: dort wurde es erst ab ~120 Läufen stabil) |
| Team-Validität: Spearman Rennzeit ↔ Σ Eignung | ≥ 0,80 | Modell 0,915 |
| Favorit gewinnt (klare Paarungen) / enge Rennen (< 3 %) | ~85–100 % / ≥ 15 % | Modell: 4 × 100 %, 1 × eng |
| Rutscher / Pausen je Rennen | 0,8–2 / 0,5–2 | Modell 1,27 / 1,01 |
| Planverteilung über die Kaderfamilie | kein Plan > 60 % | Modell 40/30/30 |
| Kreuzungsquote leicht/schwer | 25–40 % | Modell 33,5 % |
| Fertig unter dem Zeitlimit | ~60–75 % der Teams | Modell 7 von 10 |
| **Tabellenwirkung W2** | Anteil der Spiele mit anderem Tabellenergebnis als heute | Nur bei 3:3 möglich. Nachzählen, wie oft 3:3 heute vorkommt (Plan: 29 %) und wie oft dort Rennsieger ≠ kg-Sieger |

### 7.3 Was die Diagnose nicht kann

Das Modell kennt keine Slot-, Form- und Trait-Zuschläge, keinen Motor-Takt und nur zehn Teams.
Zeiten, Quoten und vor allem die 13,3 Pp sind Größenordnungen. Die Kalibrierung läuft in der Sonde
aus 7.2 am Motor, nicht in diesem Papier.

---

## 8. Klasse-Einordnung: ausdrücklich, und von Chris zu bestätigen

### 8.1 Woher die Sekunden kommen

| Variante | Sendezeit bei 1× | Was sich am Takt ändert | Klasse (Einschätzung) |
|---|---|---|---|
| **γ — Finale angehängt (Empfehlung)** | 7:11 + ~5 s Tafel + ≤ 70 s Rennen + ~4 s Ziel ≈ **8:30** | Hantel unverändert; neuer, eigener Sendungsteil | **T** (mehr Zuschauzeit, die der Zuschauer nicht gewählt hat) **+ W** (Tabellenpunkt) **+ M** (neue Mechanik) |
| **γ-kurz — zwei Stationen (Hof + Ladekante, 10 Säcke)** | ≈ **8:10** | wie γ | **T + W + M** |
| **δ — Finale, dafür Versuche 1 und 2 gestrafft** | ≈ 7:15 (Versuch 1/2 von 6,2 auf 4,6 s: −77 s) | **Chris' 6,2 s je Versuch** („4 bis 8 s“, 06.09.) werden für 48 von 72 Versuchen angefasst | **T** (Takt-Eingriff) **+ W + M** |
| **W1-Stechen — nur bei 3:3** | 7:11 in ~2/3 der Spiele, ~8:30 im Rest | wie γ, aber bedingt | **T** (bedingt) **+ W + M** |
| **ε — parallel im Hintergrund** | 7:11 | Bild während der Duelle geteilt, kein Zeitzuschlag | **A\*/M**, mit W, falls es zählt; dramaturgisch schwach (2.2) |

**Es gibt keine Variante, in der das Finale „nur Anzeige“ wäre.** Die Ladestrecke konnte sich ins
Fenster des ersten Stoßversuchs schmiegen, weil sie ein vorhandenes Zahlenfeld (`maxStossen`)
bebilderte. Das Finale ist ein eigener Wettkampf mit eigener Zeit und eigenem Punkt.

**Zeitraffer im Finale:** Der Zuschauer sieht das Rennen mit Faktor ~0,37 gegenüber der
Simulationszeit (`LASTEN_ZEITRAFFER`, Anzeige-Konstante). Ein Gang dauert dann im Bild 3 bis 6 s,
lesbar und nicht hektisch. Bei 2×/4× läuft das Finale wie alles andere schneller. Das ist kein
eigener Eingriff, aber es gehört zur selben Entscheidung.

### 8.2 Warum das T ist, und warum nicht ein Agent das entscheidet

* Die Gesamtsendezeit wächst um ~20 %. Das ist der Kern der T-Definition im Broadcast-Papier vom
  02.10. (Zuschauzeit, die der Zuschauer nicht gewählt hat).
* Variante δ fasst den Versuchstakt an, den Chris persönlich gesetzt hat.
* **Dieselbe Selbsteinstufung („nur ein neues Bild“, „nur Umverteilung“) lag beim Fechten-Format
  (PR #1111) und bei D7 (PR #1117) zweimal daneben.** Dieses Papier stuft deshalb nach oben ein und
  nicht nach unten. Und es bittet ausdrücklich darum, dass Chris die Einstufung selbst bestätigt
  oder korrigiert: **Wenn Chris eine der Varianten anders einstuft, gilt seine Einstufung.**
* Werkzeug-Nebenwirkung, die zu T gehört: Sonden und Screenshot-Skripte, die auf das Ende einer
  Gewichtheben-Sendung warten, warten bei γ ~80 s länger. Skripte mit `window.__arena.vorbei()`
  merken das nicht, Skripte mit fester Wartezeit schon. Bedingung für den Bau ist ein Sonden-
  Schalter `window.__arena.sandsackFinale(false)` nach dem Muster des Broadcast-Papiers 2.3,
  **nicht** automatisch über `navigator.webdriver`, sowie eine Durchsicht der Skripte, die
  Gewichtheben bis zum Ende abspielen (u. a. `scripts/screenshot-gewichtheben.mjs`).

### 8.3 Wertungsklasse

W2 ändert **Tabellenpunkte**, und zwar nur bei 3:3 (7.2, letzte Zeile). Das ist nach dem Schema
des 30.09.-Papiers eine echte Wertungsänderung (W) und braucht Chris' Ja unabhängig von T. W3
(Finale zählt doppelt) ist eine deutlich größere W-Änderung, weil auch ein 4:2 kippen kann.

---

## 9. Bild, Ton, Assets: „Bekommst du sowas hin?“ — ja, und so

Die Bauregel aus `neue-disziplin-assets.md` Abschnitt 1 gilt: **prozedural, wo Geometrie an der
Mechanik hängt; beschafft, wo ein fertiges Motiv die Silhouette trifft.** Für das Finale ist fast
alles prozedural, weil Säcke, Rampe und Kante Maße aus der Formel tragen (Sackgröße ~ kg,
Rampensteigung, Kantenhöhe).

### 9.1 Szene

* **Szenenwechsel nach dem sechsten Duell:** Die Bühne fährt ab, und es folgt der „Hof hinter der
  Halle“. Zwei Bahnen, Heim oben, Gast unten, gespiegelt. Jede Bahn hat **drei Felder
  nebeneinander** (A Hof, B Rampe, C Ladekante). Das aktive Feld ist hell, die anderen gedimmt.
  Die Kamera fährt mit dem aktiven Feld, und zwar mit dem des **führenden** Teams, sobald die Teams
  in verschiedenen Stationen sind; das andere Team bleibt in einer Bildleiste sichtbar.
* **Hof (A):** Sandboden, Sackhaufen links, Palette rechts, Start-/Wechsellinie als Kreidestrich.
* **Rampe (B):** Holzrampe mit Querleisten (Polygon), Podest oben. Beim Hinaufgehen wird der
  y-Versatz interpoliert, sonst nichts.
* **Ladekante (C):** Lkw-Ladefläche oder Laderampe in 1,2 m Höhe (Rechteck mit Kante). Die
  Wuchtbewegung ist die Ablage-Phase der Hantel (`ablage`), nur nach vorne oben.
* **Medley-Tafel** oben: je Team 15 Sacksymbole, die sich beim Abliefern füllen, dazu die Uhr mit
  Zeitlimit. Bei Zeitnot (letzte 10 s) wird die Uhr rot und das abgelieferte Gewicht steht daneben.
  Das ist die einzige Zahl, die dann zählt.
* **Teambank** am Rand jeder Bahn: Die Nicht-Träger stehen dort und klatschen, das ist die
  vorhandene Wippe aus `zeichneHeben()`. Beim Anker-Plan stehen dort fünf, und das Bild erzählt die
  Taktik ohne Text.

### 9.2 Requisiten und Figur

* **Sandsack, prozedural:** Jute-Rechteck mit abgerundeten Ecken, Abbindung an einer Seite, kg als
  Schablonenaufdruck. Die Größe skaliert mit √kg (15 kg klein, 105 kg breit). Die Farbe dunkelt mit
  dem Gewicht nach. Zwei Säcke beim Doppeln liegen übereinander.
* **Trage-Pose:** Bis ~50 kg ein **Bärengriff** vor der Brust. Das ist der Griffpunkt der
  `zug`-Phase (Front-Rack, `HEBEN_PHASEN.zug`), dieselbe Lösung wie bei der Ladestrecke
  (Nebenbefund 10.2 dort). Ab ~50 kg ein **Schultersack**: derselbe Griffpunkt, Sack seitlich höher
  gezeichnet. Eine eigene Sprite-Pose wäre schöner, ist aber eine Sprite-Runde nach der
  `sprite-handpunkte.md`-Methode und kein Motorthema. Kein Blocker.
* **Erschöpfungsring** über dem Kopf: Das ist der Frische-Ring der Ladestrecke, hier mit `E`
  gefüllt (leer = frisch). Ab `E > 60` geht die Figur langsamer und gebeugt (y-Versatz, kürzere
  Schrittweite).
* **Pause:** Hände-auf-Knien-Pose, kleine Atemwölkchen als Partikel.
* **Rutscher:** Der Sack fällt einen Schritt vor der Figur, es gibt eine Staubwolke (Partikel wie
  beim Hantelabwurf), danach Bücken und neu greifen. Die Dauer kommt aus 4.7.
* **Doppeln:** Zwei Säcke auf den Schultern, Ticker-Zeile.

### 9.3 Ticker, Banner, Ton

* **Ticker** (Rang „routine“, nie „big“ — Banner-Dosis, Audit Punkt 7): „Iris doppelt: 25 + 30
  kg“, „Brakka muss verschnaufen — noch 4 Säcke“, „Gram verliert den 60er an der Rampe!“, „Cold
  Steel an der Ladekante — 9 s vor Dire Legion“.
* **Banner** nur für drei Momente: **Führungswechsel**, **letzter Sack**, **Zeitlimit** (wenn es
  über die Wertung entscheidet).
* **Ton** (`TON_KATALOG.gewichtheben`, prozedural): Schritte im Gang-Takt, ein dumpfer
  Sack-Aufprall beim Abliefern (tiefer je kg), ein Staub-„Pff“ beim Rutscher, Klatschen beim
  Wechsel, Uhr-Ticken in den letzten 10 s und der vorhandene Applaus beim Zieleinlauf.
* **Boxscore** je Träger, additiv wie `kuehneVersuche` und **nie Teil von `wert`**: `lastKg`
  (abgeliefertes Gewicht), `lastSaecke`, `lastRutscher`, `lastPausen`, `lastDoppelt`. Im Endstand
  ein Chip „Anker — 15 Säcke, 945 kg“ oder „Doppelte dreimal“.

### 9.4 Verhältnis zur Ladestrecke

| | Ladestrecke (PR #1134) | Sandsack-Finale (dieses Papier) |
|---|---|---|
| Ebene | Duell (6× je Spiel, ~2,8 s) | Mannschaft (1× je Spiel, ~70 s) |
| Wertung | keine (Ticker/Badge) | Teampunkt (W2) |
| Klasse | A\* (zu bestätigen) | T + W + M (zu bestätigen) |
| Assets | Trage-Pose, Gang, Frische-Ring, Scheibenständer | dieselben drei plus Säcke, Rampe, Kante, Tafel |

**Empfehlung:** Die **Ladestrecke zuerst** bauen, falls Chris sie will. Sie ist bit-identisch und
billig und baut die drei Bausteine, auf denen das Finale steht. Danach das Finale. Ob danach beide
in der Sendung bleiben (sechsmal kurz die eigenen Scheiben tragen, am Ende das große Sackrennen)
oder die Ladestrecke dann als doppeltes Motiv wegfällt, ist **Geschmack und Chris' Entscheidung**.
Mechanisch stören sie sich nicht: Die Ladestrecke liest `maxStossen`, das Finale die Sub-Skills.

---

## 10. Entscheidungsvorlage für Chris

Nichts ist vorausgefüllt. Was leer bleibt, wird nicht gebaut.

**Grundsatz**

* [ ] Nein, kein Sandsack-Finale.
* [ ] Ja, als Mannschafts-Finale **nach** den sechs Duellen (Empfehlung).
* [ ] Ja, aber an anderer Stelle: [ ] vor den Duellen [ ] parallel im Hintergrund (ε)

**Wertung**

* [ ] W0 — nur Schau, kein Punkt
* [ ] W1 — nur als Stechen bei 3:3
* [ ] W2 — immer, als siebter Mannschaftspunkt (Empfehlung)
* [ ] W3 — Finale zählt doppelt

**Sendezeit und Klasse — bitte selbst bestätigen**

* [ ] γ: Finale angehängt, ≈ 8:30 statt 7:11. **Ich bestätige: das ist T, und ich gebe die
  Sendezeit frei.**
* [ ] γ-kurz: nur zwei Stationen (Hof + Ladekante), ≈ 8:10 — T, freigegeben.
* [ ] δ: Versuche 1/2 der Hantel straffen (6,2 → 4,6 s), Gesamt ≈ 7:15 — T, Takt-Eingriff,
  freigegeben.
* Zeitlimit des Rennens bei 1×: ____ s (Vorschlag 70)
* Meine Einstufung, falls abweichend: ____

**Mechanik**

* Stationen: [ ] drei (Hof, Rampe, Ladekante) [ ] zwei [ ] andere: ____
* Säcke je Station / Gewichte: [ ] wie 4.1 [ ] ändern: ____
* Rutscher: [ ] gewürfelt, fester Verbrauch (Empfehlung) [ ] deterministisch
* Doppeln (zwei Säcke, ANSAGE-Mut): [ ] ja (nötig für die Matrix, 6.4) [ ] nein — dann Pp-Risiko
* Medley-Regel (Zeitlimit, sonst abgeliefertes Gewicht): [ ] ja [ ] nein, reines Zeitrennen

**Taktik**

* [ ] Stufe 1: Trainer-Automatik wählt den Plan, für alle Teams gleich (Empfehlung als erster Bau)
* [ ] Stufe 2: Manager-Feld „Lastenplan“, Zuteilung über die Slots nach Tabelle 5.2,
  zusammen mit dem Haltungs-Grundgerüst
* Slot → Station-Tabelle: [ ] wie 5.2 [ ] ändern: ____
* Standard-Anker: [ ] Grip Anchor [ ] Power Opener [ ] immer Automatik

**Attribute**

* [ ] Keine neuen Sub-Skills, kein Override, Rezept unverändert (Empfehlung).
* [ ] Ich will, dass Ausdauer im Rennen **mehr** zählt als die Matrix (stamina 2) erlaubt. Dann
  ist ein Override in `spiel-eignung-overrides.ts` nötig, und der gälte für **die ganze Disziplin**:
  Kaderbildschirm und KI-Einkauf würden Heber dann auch nach Ausdauer bewerten, **obwohl die Hantel
  (sechs von sieben Punkten, 100 % des Spielerwerts) stamina gar nicht liest**. Die Hantel-Pp würde
  dadurch schlechter. Nicht empfohlen.

**Ladestrecke**

* [ ] beide bauen, Ladestrecke zuerst [ ] nur das Finale (Ladestrecke nur als technische Vorstufe)
  [ ] nur die Ladestrecke

Umsetzung — falls Ja — als eigene Tasks in dieser Reihenfolge: (1) Pflichtsonde
`miss-sandsack-finale.mjs` und Formeln headless, Abnahme 7.1 + 7.2, noch ohne Bild; (2) Szene,
Requisiten, Ticker, Ton; (3) erst dann `seiten` in die Arena-Wertung; (4) Stufe 2 mit dem
Haltungs-Grundgerüst. Produktionscode-Sorgfalt, weil Gewichtheben live ist
(`ARENA_RESOLVED_DISCIPLINE_IDS`). **Kein Agent leitet aus diesem Papier eine Freigabe ab.**

---

## 11. Nebenbefunde (gefunden, nicht entschieden)

1. **Die bestehende Pp-Abnahme ist für Teampunkte blind.** `einflussVon` misst `wert`, also den
   Spielerwert. Jede Disziplin, die einen Teampunkt außerhalb der Spielerwerte vergibt, kann diesen
   Punkt über beliebige Attribute verteilen, ohne dass eine Messung anschlägt. Heute gilt das schon
   für den Gesamt-kg-Tiebreak, der aber nur Spielerwerte summiert und deshalb harmlos ist. Mit dem
   Finale wäre es zum ersten Mal ein **eigener** Mechanikkanal. Vorschlag: Das Handbuch
   (`neue-disziplin-handbuch.md` Abschnitt 2) bekommt eine Zeile „Teampunkt-Kanäle brauchen eine
   eigene Budget-Abnahme“.
2. **Die 3:3-Quote von 29 % stammt aus der Planungsphase** (`gewichtheben-plan.md` Teil 3).
   Seither haben G1 (Entscheidungsduell sichert), Maßnahme B und die Kalibrierung vom 01.10. den
   Duellverlauf verändert. Wie oft heute 3:3 vorkommt, also wie oft der kg-Tiebreak überhaupt
   greift, ist unbekannt. Die Zahl ist für W1/W2 entscheidend und gehört in Schritt (1) der
   Umsetzung.
3. **Das Ladestrecken-Papier nennt das Sandsack-Rennen „gemessen tot“** (2.2, 8.2). Das stimmt für
   das dort gemessene Format (ein Sack, Duell-Ebene) und sollte dort mit einem Verweis auf dieses
   Papier versehen werden. Sonst liest ein künftiger Agent die Verwerfung als Urteil über Chris'
   jetzige Idee.
4. **Die Slot-Texte erzählen schon Trage-Geschichten.** „Grip Anchor — hält, wenn es eng wird“,
   „Power Opener — setzt die Basis über maximale Power“ (`:5377–5382`). Die Slot-Tabelle 5.2 braucht
   deshalb keinen neuen Text, nur eine Zeile im Tooltip: „Im Finale: Ladekante, Startläufer“.
5. **Die Klasse-T-Regel steht weiterhin nicht in `CLAUDE.md`.** Das ist Nebenbefund 1 im
   Broadcast-Papier und 10.4 in der Ladestrecke, beide unverändert. Dieses Papier hat sie aus
   diesen beiden Papieren rekonstruiert.

## Quellen

**Im Repo:** `public/mockups/battle-mode.engine.js` (Stand `83d02cf1`): `BUEHNE_ART.gewichtheben`
`:14409–14513` (Rezept `:14506`), Slot-Profile `:5376–5383`, `mische()` `:5602`, `HEBEN_ROLLEN`
`:16164`, `HEBEN_ERHOLUNG_K` `:16203`, `HEBEN_WAGNIS_ANSAGE_FLEX` `:16216`, `hebenTeamLage()`
`:16358`, `baueHebenDuelle()` `:16397`, `hebeUebung()` `:16489`, `spieleBuehneHeben()`-Rückgabe
`:44660–44678`; `lib/resolve/battle-mode-arena-team-points.ts:999–1032`;
`lib/player-generator/official-discipline-weights.ts` (Spalte gewichtheben);
`lib/player-generator/spiel-eignung-overrides.ts` (Kopfkommentar);
`data/generated/kaderfamilie-live-save.json`; `scripts/messe-arena-einfluss.mjs` (Kopfkommentar,
Staffel-n); `docs/design/gewichtheben-physical100-fable-konzept-03-10.md`;
`docs/design/manager-risiko-interaktivitaet-konzept-02-10.md`;
`docs/design/fable-ideen-heben-breaking-climbing-30-09.md`;
`docs/design/gewichtheben-kalibrierung-ansage-kanal-01-10.md`;
`docs/design/gewichtheben-pp-regression-befund-01-10.md`; `docs/design/gewichtheben-plan.md`
(Teil 1/3, 3:3-Quote); `docs/design/broadcast-d7-a4-fable-empfehlung-02-10.md` (Stilvorbild,
T-Umgang); `docs/design/neue-disziplin-handbuch.md` (Falle 17, Abschnitt 2);
`docs/design/neue-disziplin-assets.md` (Abschnitt 1); CLAUDE.md.

**Physical: 100 (Recherche 03.10.):**
[What to Watch — Season 2 Episode 6 recap: Into the mines](https://whattowatch.com/features/physical-100-season-2-episode-6-recap-into-the-mines) ·
[What to Watch — How does Physical: 100 work?](https://whattowatch.com/features/how-does-physical-100-work-the-rules-explained) ·
[Sportskeeda — first team quest, Season 1 Episode 4](https://sportskeeda.com/pop-culture/how-contestants-divided-first-team-quest-physical-100-episode-4-details-explored) ·
[dmtalkies — Season 2 Episodes 5–7 recap](https://dmtalkies.com/physical-100-season-2-episodes-5-6-7-recap-review-2024-netflix/) ·
[Flicks — Physical: 100 returns underground](https://www.flicks.co.uk/reviews/physical-100-returns-taking-its-addictive-competition-formula-underground/) ·
[envimedia — The underdogs rise to the top](https://envimedia.co/the-underdogs-rise-to-the-top-in-physical-100/)
