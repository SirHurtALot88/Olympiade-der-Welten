# Remake-Gefälle-Audit: wo eine Disziplin sichtbar älter aussieht als ihre Nachbarn (17.11.)

Anlass, Chris am 17.11., wörtlich: „wichtig ist dass wir die designs wirklich von pixel lab verwenden und
nicht einfach die alten hässlichen 1:1 übertragen und kopieren sondern REDESIGN als REMAKE/2D HD, verstehst
du? das ist GANZ WICHTIG, sonst sieht so was wie time trial moderner aus und spurt bleibt hässlich, das geht
nicht“.

**Dieses Dokument ist ein Audit mit Reihenfolge-Vorschlag.** Kein Code geändert, nichts bestellt, nichts
committet. Die Bilder sind am 17.11. aus dem Stand `origin/main` (`250bc494`) entstanden, mit
`scripts/screenshot-kulisse.mjs` (Mini-DM: `scripts/screenshot-mdffa-buehne.mjs`), verkleinert auf 900 px
Breite und abgelegt unter `docs/design/remake-gefaelle-17-11/`. Die Arena-Seite (`battle-mode.html`) wird
dabei vom Skript selbst aus `public/` serviert; ein `npm run dev` lief nicht.

Der Herkunfts-Audit `pixellab-nur-neue-assets-audit-17-11.md` fragt: **woher** kommt ein Bild? Dieses
Dokument fragt: **wie wirkt** es neben den Nachbarn? Die beiden Antworten decken sich nicht. Staffel ist
laut Herkunfts-Audit „sauber“ und gehört optisch trotzdem zu den ältesten Arenen.

## 0. Kurzfassung

- **Größtes Gefälle: Spurt klassisch und Hatz (Note 1) gegen Zeitfahren (4) und die neue HYROX-Arena (5).**
  Drei Formate derselben Disziplin liegen vier Stufen auseinander. Sobald HYROX und Hatz ihre eigenen
  Areale haben, steht der klassische Spurt als Einziger auf der blauen Zwölf-Bahnen-Fläche.
- **Der klassische Spurt hat heute kein Budget.** Das HYROX-Konzept (Entscheid 1) und das Hatz-Konzept
  (Risiko R6) lassen ihn ausdrücklich auf `kurs.jpg`. Das widerspricht Chris' Satz von heute.
- **Top 5 Gefälle:** 1. Spurt klassisch/Hatz, 2. Staffel, 3. Climbing, 4. Speed-Schach, 5. Takeshi.
  Dahinter: Sandarena von TDM und Mini-DM, Gewichtheben, Zeitfahren-Angleichung.
- **Budget:** Aus den genannten Zahlen bleiben **70 Gen.** unverplant, die Reserve von 150 ist damit um
  **80 Gen. nicht gedeckt**. Mit dem Hatz-Deckel aus dem Hatz-Konzept (112 statt 150) sind es 108 frei und
  42 Fehlbetrag. Ob das stimmt, hängt an einer Frage: sind die 435 bestellten Gen. im Guthaben ~1040 schon
  abgebucht? Dann wären **393 Gen.** über der Reserve frei (Abschnitt 4.1).
- **Empfehlung:** gestaffelt freigeben. Zuerst Spurt klassisch (56 Gen. Kern), dann Staffel (56), dann
  Zeitfahren-Angleichung (26) und die Schachuhr (13). Dazu acht Schritte für 0 Gen. aus bereits bezahlten
  Bildern (Abschnitt 4.4).

## 1. Maßstab

Referenz für Note 5 sind vier Arenen:

| Referenz | Bild | Was sie ausmacht |
|---|---|---|
| HYROX-Arena Variante B | `remake-gefaelle-17-11/referenz-hyrox-b-kraft.jpg` (aus `origin/claude/hyrox-optik-b-17-11`) | ein ganzes gemaltes Areal (Festungshof), Mauer mit Fackeln als Rückwand, Geräte als eigene Sprites, feste Totale, HUD in Pixelschrift |
| I-Spy | `i-spy-aztec.jpg` | texturierter Boden, Wand mit Toren, Bewuchs im Vordergrund, Möbel als Sprites |
| TDM Lavaboden | `tdm-lava.jpg` | Boden mit eigenem Licht (Glut), kein leerer Fleck im Bild |
| Zeitfahren-Seitenansicht | `zeitfahren-kueste.jpg` | mehrere Tiefenebenen (Himmel, Ferne, Hügel, Straße), Streckenprofil als HUD |

Fünf Kriterien, je Disziplin geprüft:

1. **Areal:** Hat die Disziplin einen eigenen Ort, oder nur eine Spielfläche mit Randstreifen?
2. **Tiefe und Licht:** Gibt es Hintergrund, Mittelgrund, Vordergrund und eine Lichtquelle?
3. **Requisiten:** Sind die Geräte eigene Sprites im PixelLab-Look?
4. **Altmaterial:** Ist LPC, prozedural Gemaltes oder eine 1:1-Übertragung im Bild?
5. **HUD:** Passt die Schrift und Rahmung zum Rest?

Noten: **5** = Referenzniveau, **4** = modern mit kleinen Lücken, **3** = ordentlich, aber flach,
**2** = sichtbar alt, **1** = ältester Stand.

## 2. Bewertung je Disziplin

Alle Bilder liegen in `docs/design/remake-gefaelle-17-11/`. „PL“ = PixelLab, „proz.“ = prozedural gemalt.

### 2.1 Bahn-Familie

| Disziplin / Format | Bild | Note | Befund |
|---|---|---:|---|
| Spurt klassisch | `spurt-klassisch.jpg` | **1** | Gesättigt blaue Fläche mit zwölf weißen Linien füllt 85 % des Bilds. Tribüne ist ein 30 px hoher Streifen am oberen Rand. Aufblasbarer gelb-schwarzer Bogen, bunte Sponsorenbande, moderne Sporthalle statt Dark Fantasy. Kein Ort, keine Tiefe, kein Licht. |
| Spurt Hatz | `spurt-hatz.jpg` | **1** | Dieselbe Bahn. Sieben Hindernisreihen ohne Funktion, Fegearm als roter Rahmen mit Systemschrift „FEGEARM“, Beschriftungen von Hindernissen überdeckt. |
| Spurt HYROX (Stand `main`) | `spurt-hyrox-halle.jpg` | **2** | Flacher Asphalt, blaues Laufband, Nahkamera mit wechselndem Maßstab. Wird durch Variante B ersetzt (dann 5). |
| Staffel | `staffel.jpg` | **2** | Rotes Oval auf Streifenrasen, Tribüne als dünner Streifen oben und unten. Herkunft PL, aber Draufsicht ohne Ort, ohne Requisit, ohne Licht. Moderne Leichtathletik-Optik. |
| Takeshi's Castle | `takeshi.jpg` | **2,5** | Eigenes Areal mit Route, Torii, See. Aber Kachel-Optik: grelles Grün, dieselben zwei Baum-Sprites dutzendfach, LPC-Steine, drei Textzeilen über dem Feld. Eine Karte. |
| Climbing Halle | `climbing-wand.jpg` | **2** | Graue Fläche, Griffe als bunte Punkte, Volumen als graue Dreiecke, Scheinwerferkegel als helle Streifen. |
| Climbing Fels, Eis | `climbing-fels.jpg`, `climbing-eis.jpg` | **1,5** | Proz. Wandtextur mit senkrechten Schlieren, einfarbiger Himmel. „Nur Skins“, wie Chris sagt. |
| Zeitfahren (11 Karten) | `zeitfahren-kueste.jpg`, `zeitfahren-standard.jpg` | **4** | Seitenansicht mit Tiefenebenen und Streckenprofil. Lücken: Schilder, Pfosten, Startpodest als Primitive; heller Comic-Ton statt des dunkleren 2D-HD-Tons der Referenzen; Karte „standard“ wirkt leer. |

**Gefälle in der Familie:** Zeitfahren 4 und HYROX-B 5 gegen Spurt klassisch und Hatz 1, Climbing 1,5–2,
Staffel 2, Takeshi 2,5. Das ist die Familie mit dem größten Abstand, und sie ist die, die Chris nennt.

### 2.2 Feld-Familie

| Disziplin | Bild | Note | Befund |
|---|---|---:|---|
| Basketball Parkett | `basketball-parkett.jpg` | **3** | Parkett mit Tribünenrahmen, dunkel abgesetzt. Sauber, aber flache Draufsicht. |
| Basketball Street-Court | `basketball-streetcourt.jpg` | **3,5** | Neue PL-Kulisse (Welle A Batch 1): Zaun, Container, Bande. Spielfläche selbst einfarbig blau. |
| Hockey Eis / Bergsee | `hockey-eis.jpg`, `hockey-bergsee.jpg` | **3 / 3,5** | Eisfläche mit Bande; Bergsee mit verschneitem Rand. Tore und Strafbank Primitive. |
| Football Feld / Strand | `football-feld.jpg`, `football-strand.jpg` | **3 / 3,5** | Rasen mit Tribüne; Strand mit Hütten, Palmen, Schirmen. |
| Tennis Court / Riviera | `tennis-court.jpg`, `tennis-riviera.jpg` | **3,5 / 4** | Perspektivischer Platz, Tribüne bzw. Balustrade mit Häusern und Meer. Netz Primitiv. |

**Gefälle in der Familie:** klein (3 bis 4). Alle vier folgen demselben Muster „Spielfläche plus Rahmen“.
Kein Remake nötig, solange die Bahn-Familie offen ist. Die Originale (Parkett, Eis, Feld) liegen eine
halbe Stufe unter ihren neuen Varianten.

### 2.3 Bühnen-Familie

| Disziplin | Bild | Note | Befund |
|---|---|---:|---|
| I-Spy | `i-spy-aztec.jpg` | **5** | Referenz. |
| Breaking | `breaking.jpg` | **4** | Dunkle Arena, Lichtkegel, Publikum als Silhouetten. Werkzeugleiste unten kaum lesbar, Werkzeuge Primitive. |
| Showcase Bühne | `showcase-buehne.jpg` | **4** | Theater mit Mond-Prospekt, Vorhang, Rampenlicht. |
| Showcase Festival | `showcase-festival.jpg` | **2,5** | Proz.: Lautsprechertürme und Punktraster-Wand. In Batch 2. |
| Fechten Piste | `fechten-piste.jpg` | **3,5** | Dunkle Halle mit Rängen und Scheinwerfern. Untere Bildhälfte leer. |
| Fechten Schlosshof | `fechten-schlosshof.jpg` | **1,5** | Proz. Ziegelmauer füllt das Bild, zwei Türme, grauer Himmel. In Batch 2. |
| Eiskunstlauf Kür | `eiskunstlauf-kuer.jpg` | **3** | Eisfläche mit Publikumsrand und Bande. Tafeln überdecken ein Viertel der Fläche. |
| Wettessen Jahrmarkt | `wettessen-jahrmarkt.jpg` | **3** | PL-Original mit Riesenrad und Zelten. Flächiger, heller Stil ohne Schattierung, anders als die Referenzen. |
| Wettessen Nachtmarkt | `wettessen-nachtmarkt.jpg` | **2,5** | Proz. Nachtfassung desselben Bilds. In Batch 2. |
| Gewichtheben Lagerhalle | `gewichtheben-sandsack.jpg` | **2,5** | Halle als Streifen oben, darunter grauer Boden, Plattform als helles Rechteck, Zuschauer als Punkte. |
| Gewichtheben Hafen | `gewichtheben-hafen.jpg` | **2** | Proz. Skyline, sonst wie oben. In Batch 2. |
| Speed-Schach Park | `speed-schach-park.jpg` | **1,5** | Proz.: Klötzchen-Bänke, Brunnen aus Ellipsen, graue Fläche. Kein PL-Bild im Spiel. |
| Speed-Schach Zug | `speed-schach-zug.jpg` | **1,5** | Proz.: Zuschauer als farbige Rechtecke, Rautenteppich. In Batch 2. |

**Gefälle in der Familie:** I-Spy 5, Breaking und Showcase 4 gegen Speed-Schach 1,5 und Gewichtheben 2–2,5.
Speed-Schach ist die einzige Disziplin, die im Spiel **gar kein** PixelLab-Bild zeigt.

### 2.4 Kampf-Familie

| Disziplin | Bild | Note | Befund |
|---|---|---:|---|
| TDM Lava | `tdm-lava.jpg` | **4,5** | Referenz für den Boden. Kein Rand, keine Requisiten. |
| TDM Sandarena | `tdm-basis.jpg` | **2,5** | Einfarbiger Sand, ein Mittelpunkt, schmale Mauer am Rand. Leer. |
| Mini-DM Sandarena | `mini-dm-basis.jpg` | **2,5** | Derselbe Sand. HUD in Systemschrift mit grauen Kästen, einziger klarer HUD-Stilbruch im ganzen Satz. |
| Battlefield Eroberung | `battlefield-eroberung.jpg` | **3** | Wiese mit Wegenetz und drei Steinsockeln. Flach, aber als Karte lesbar. |
| Battlefield Wüstenruine | `battlefield-wuestenruine.jpg` | **2** | Proz. Umfärbung derselben Karte mit Streifenmuster. In Batch 2. |

**Gefälle in der Familie:** innerhalb von TDM selbst, Lava 4,5 gegen Sand 2,5. Die Sandarena ist die
Grundkarte und damit die häufigste.

### 2.5 Rangliste des Gefälles

Abstand = Note der besten Nachbarin in der Familie minus eigene Note.

| Rang | Disziplin / Format | Note | Nachbarin | Abstand | heute im Budget? |
|---:|---|---:|---|---:|---|
| 1 | **Spurt klassisch** | 1 | HYROX-B 5, Zeitfahren 4 | 4 | **nein** |
| 1 | Spurt Hatz | 1 | HYROX-B 5 | 4 | ja (~150, Konzept-Deckel 112) |
| 2 | **Staffel** | 2 | HYROX-B 5, Zeitfahren 4 | 3 | **nein** |
| 3 | Climbing (3 Karten) | 1,5–2 | HYROX-B 5, Zeitfahren 4 | 3–3,5 | ja (~120) |
| 4 | **Speed-Schach** | 1,5 | I-Spy 5, Showcase 4 | 3,5 | teils (Batch 2: nur Kulissen) |
| 5 | Takeshi's Castle | 2,5 | HYROX-B 5 | 2,5 | ja (~150) |
| 6 | TDM/Mini-DM Sandarena | 2,5 | TDM Lava 4,5 | 2 | **nein** |
| 7 | Gewichtheben | 2–2,5 | Showcase 4 | 1,5–2 | teils (Batch 2: Hafen, Oase) |
| 8 | Zeitfahren (Requisiten, Ton) | 4 | HYROX-B 5 | 1 | **nein** |

Climbing steht mit dem größeren Abstand hinter Staffel, weil es schon ein Konzept und einen Topf hat. Die
Reihenfolge sortiert nach „Abstand und ungedeckt“.

## 3. Was Batch 2 abdeckt, und was nicht

Welle A Batch 2 (325 Gen. bestellt) entspricht 13 Breitformaten. Vermutlich sind das die zwölf übrigen
prozeduralen Varianten aus dem Herkunfts-Audit: Battlefield Wüstenruine, Gewichtheben Hafen und Oase,
Speed-Schach Park und Zug, Showcase Festival und Zirkus, Wettessen Nachtmarkt und Bierzelt, Fechten
Schlosshof, Climbing Fels und Eis. **Die Bestellliste habe ich nicht gesehen.**

Zwei Punkte dazu:

- **Batch 2 ersetzt Bilder, es baut keine Areale neu.** Bei Lieferung jedes Bild gegen die fünf Kriterien
  aus Abschnitt 1 prüfen, nicht nur gegen „ist PixelLab“. Batch 1 zeigt, dass der Weg trägt: Tennis
  Riviera und Football Strand sind echte Orte geworden.
- **Climbing Fels und Eis** überschneiden sich mit dem Climbing-Konzept
  (`climbing-formate-optik-konzept-17-11.md` auf `origin/claude/konzepte-hatz-climbing-17-11`). Dort
  sollen die Wandbilder die Wandebene bleiben und die Tiefe drumherum neu entstehen. Die zwei Batch-2-Bilder
  zählen dann auf den Climbing-Topf an.

## 4. Budget

### 4.1 Rechnung aus den genannten Zahlen

| Posten | Gen. | Stand |
|---|---:|---|
| Guthaben | **1040** | |
| HYROX-Arena | −110 | bestellt |
| Welle A Batch 2 | −325 | bestellt |
| H1-Effekte | −30 | geplant |
| Takeshi-Arenen | −150 | geplant |
| Hatz | −150 | geplant |
| Climbing | −120 | geplant |
| Live-Stand | −40 | geplant (Obergrenze) |
| HYROX-Bögen/Belag | −45 | geplant |
| **Summe verplant** | **970** | |
| **unverplant** | **70** | |
| Reserve (Soll) | −150 | |
| **Fehlbetrag zur Reserve** | **−80** | |

**Lesart 1 (so gerechnet):** Alle acht Posten gehen noch vom Guthaben ab. Dann ist der Rahmen schon ohne
ein einziges neues Remake um 80 Gen. überzogen.

**Lesart 2:** Die 435 bestellten Gen. sind im Guthaben ~1040 schon abgebucht. Dann sind nur noch 535
offen, es bleiben 505, nach Reserve **355 frei**. Ein Indiz dafür, kein Beleg: der Herkunfts-Audit las am
17.11. einen Kontostand von 1677. Minus 435 und minus etwa 200 für Batch 1, Schiedsrichter und I-Spy
ergibt ungefähr 1040.

### 4.2 Korrektur aus den Konzepten

Das Hatz-Konzept (`hatz-optik-konzept-17-11.md`) setzt den Kern von Variante B auf 56 Gen. und die
Gesamtobergrenze auf **112 Gen.**, nicht 150. Das Climbing-Konzept plant 109 Gen. bei Deckel 120.

| | Lesart 1 | Lesart 2 |
|---|---:|---:|
| unverplant laut 4.1 | 70 | 505 |
| Hatz 150 → 112 | +38 | +38 |
| **unverplant** | **108** | **543** |
| nach Reserve 150 | **−42** | **+393** |

### 4.3 Was die ungedeckten Remakes kosten

Maßstab: Kulisse 792×300 = 28 Gen., eine Nachbestellung eingerechnet (56 je Areal); Requisit 13.

| Remake | Kern | mit Ausbau | Inhalt |
|---|---:|---:|---|
| Spurt klassisch | **56** | 82 | Kulisse + 1 Nachbestellung; Ausbau: Startblock-Reihe, Zieltafel. Hindernisse sind schon PL, Bögen kommen aus dem Topf „HYROX-Bögen/Belag“. |
| Staffel | **56** | 82 | Kulisse + 1 Nachbestellung; Ausbau: Wechselzonen-Pfosten, Stabständer. |
| Zeitfahren-Angleichung | **26** | 52 | Warnschild und Leitpfosten als ein Reihen-Auftrag, Startpodest. Zielbogen aus dem Bögen-Topf. Ausbau: Zwischenzeit-Tor, zweites Schild. |
| Speed-Schach | **13** | 13 | Schachuhr. Kulisse 0 Gen. über das vorhandene PL-Original `turniersaal`. |
| TDM/Mini-DM Sandarena | **28** | 56 | Eine neue Grundarena für beide. Einrichtung 0 Gen. (Abschnitt 4.4). |
| **Summe** | **179** | 285 | |

### 4.4 Wiederverwendung: acht Schritte für 0 Gen.

Aus den 25 bezahlten, ungenutzten Bildern (Herkunfts-Audit, Abschnitt 0):

| Bild | Einsatz | hebt |
|---|---|---|
| `falle_fegearm` | Hatz-Fegearm statt rotem Rahmen | Hatz |
| `spurt_outdoor_strand` | Zweitkarte oder Stilprobe für Spurt klassisch; vor Einbau ansehen | Spurt klassisch |
| `takeshi_fort_segment`, `takeshi_rammbock`, `takeshi_wasserkanone`, `bruecke_wackel_*` (2) | Bausteine der zweiten Takeshi-Arena | Takeshi, spart ~25 Gen. im Topf |
| `boden_schlamm` | Takeshi-Schlammgrube statt LPC-Erde | Takeshi |
| `grube_*` (3), `kaefig_*` (4) | Einrichtung der Sandarena | TDM Sand, Mini-DM |
| `eiskunst_spotlight`, `eis_kufenspuren`, `eiskunst_tannen_bergkette` | Licht und Hintergrund | Eiskunstlauf 3 → 3,5 |
| `breaking_pfahl`, `wettessen_teller_*` (3), `wettessen_kotzeimer` | Requisiten | Breaking, Wettessen |
| `turniersaal` (PL-Original, nicht eingebunden) | Speed-Schach-Kulisse | Speed-Schach 1,5 → ~3 |

Dazu ein Teilen über Disziplinen: Die Bögen aus dem Topf „HYROX-Bögen/Belag“ (45 Gen.) dienen als Start
und Ziel auch für Spurt klassisch, Staffel und Zeitfahren. Das spart drei Einzelaufträge (39 Gen.).

`stier` und `hai` sind figurennah und bleiben liegen, bis Chris sie freigibt.

### 4.5 Empfohlene Reihenfolge

**Wenn Lesart 2 gilt (393 frei):** alle fünf Remakes aus 4.3 im Ausbau (285 Gen.), Rest 108 zusätzlich
zur Reserve.

**Wenn Lesart 1 gilt (108 unverplant, Reserve ungedeckt):** Reserve und neue Remakes schließen sich aus,
solange die Töpfe bleiben, wie sie sind. Vorschlag in vier Stufen:

| Stufe | Schritt | Gen. | frei danach |
|---|---|---:|---:|
| 0 | Start: unverplant nach Hatz-Korrektur | | 108 |
| 0 | Die acht 0-Gen.-Schritte aus 4.4 | 0 | 108 |
| 1 | Töpfe kürzen: Takeshi 150 → 125 (zweite Arena aus bezahlten Bausteinen), Climbing 120 → 109 (Konzeptplan), Live-Stand 40 → 30 | +46 | 154 |
| 1 | **Spurt klassisch**, Kern | −56 | 98 |
| 2 | Kassensturz nach Lieferung von HYROX-Arena und Batch 2: wie viele Nachbestellungen fielen an? | | |
| 3 | **Staffel**, Kern | −56 | 42 |
| 3 | Zeitfahren-Angleichung, Kern | −26 | 16 |
| 3 | Schachuhr | −13 | 3 |
| 4 | TDM/Mini-DM-Grundarena, Ausbau-Posten | | nur aus Rückflüssen |

Nach Stufe 1 liegen 98 Gen. frei, das ist die tatsächliche Reserve. Stufe 3 erst freigeben, wenn die
Töpfe Hatz, Takeshi und Climbing unter ihrem Deckel abgeschlossen haben. Der Hatz-Topf allein hat 56 Gen.
Abstand zwischen Kern und Deckel.

**Was hinten herunterfällt, wenn nichts zurückfließt:** die neue Sand-Grundarena (bleibt bei der
0-Gen.-Einrichtung), der Ausbau von Zeitfahren und alle Posten der Wellen B und C aus dem Herkunfts-Audit
(Gewichtheben-Plattform, Wettessen-Tafel, Hockey-Tore).

## 5. Remake-Skizzen für die obersten fünf

Für alle gilt: reine Anzeige. Der Wertungs-Fingerabdruck `GESAMT e80babacb68c (75 Eintraege)` muss vor
und nach dem Umbau gleich sein.

### 5.1 Spurt klassisch: „Die Rennbahn im Burggraben“

Nicht die blaue Bahn mit neuer Textur, sondern ein trockengelegter Burggraben: links und rechts hohe
Mauern mit Zuschauern auf den Wehrgängen, die Laufbahn als gestampfter Lehm mit Kreidelinien dazwischen.
Feste Totale wie HYROX-B, die Mauer als Rückwand mit Fackeln und Bannern in Teamfarbe, im Vordergrund
Zinnen als dunkle Silhouette. Die sieben vorhandenen PL-Hindernisse bleiben und stehen als Sprites auf
der Bahn; Start und Ziel sind Holztore aus dem Bögen-Topf statt aufblasbarer Bögen.

Offene Bauentscheidung: Zwölf Bahnen in voller Länge passen nicht in eine Totale. Entweder die Bahn in
zwei Zügen (hin und zurück, U-Form wie Hatz), oder eine Folgekamera über ein breites Bild wie beim
Zeitfahren.

### 5.2 Staffel: „Die Runde um den Turnierplatz“

Nicht das rote Oval auf Rasen, sondern ein Rundweg um einen Turnierplatz: innen der Platz mit Zelten,
Waffenständern und einem Herold-Podest, außen eine Holztribüne mit Baldachin als Rückwand. Die vier
Wechselzonen sind eigene Orte am Weg (Torbogen, Brücke, Fahnenreihe, Brunnen), damit man sieht, wo
übergeben wird. Licht von den Fackeln an den Wechselzonen, lange Schatten zur Bildmitte.

Der Weg bleibt ein Oval mit denselben Maßen wie heute, damit die Anzeige-Geometrie stehen bleibt.

### 5.3 Climbing: „Die Wand steht in einer Landschaft“

Folgt dem Climbing-Konzept, Variante B: Die Wand ist nicht mehr das ganze Bild, sondern die mittlere von
fünf Ebenen (Himmel, Fernpanorama, seitliche Felsflanken, Wand, Vordergrund-Silhouetten), jede mit
eigenem Parallaxfaktor zur Folgekamera. Griffe und Volumen werden Sprites statt Farbpunkte. Jede der
drei Karten bekommt ein eigenes Panorama und eigenes Licht (Halle: Fackelschein von unten; Fels:
Abendsonne von der Seite; Eis: kaltes Gegenlicht), nicht dieselbe Wand in drei Farben.

### 5.4 Speed-Schach: „Der Turniersaal“

Nicht Park und Zug neu gemalt, sondern zuerst das vorhandene PL-Original `turniersaal` einbinden (0 Gen.):
hoher Saal, Bretter auf Tischen, Zuschauer auf einer Galerie. Das Hauptbrett steht auf einem Podest im
Lichtkegel, die fünf Nebenbretter als kleine Tische im Halbdunkel dahinter statt als Reihe am unteren
Bildrand. Die Schachuhr wird ein Sprite neben dem Brett (13 Gen.). Park und Zug aus Batch 2 kommen als
Varianten dazu, wenn sie die Kriterien aus Abschnitt 1 erfüllen.

### 5.5 Takeshi's Castle: „Zwei Burgen statt einer Wiese“

Nicht die Kachelroute mit neuen Kacheln, sondern je Arena ein gemaltes Gesamtbild, auf dem der Weg schon
liegt: Arena 1 als Burghang (Aufstieg vom Tor zum Bergfried, Hindernisse auf Terrassen), Arena 2 als
Wassergraben-Parcours aus den bezahlten Bausteinen (Fort-Segment, Rammbock, Wasserkanone, Wackelbrücken,
Schlamm). Bäume und Felsen sind Teil des Bilds statt gestempelter Sprites, das nimmt die Wiederholung
heraus. Die drei Textzeilen über dem Feld wandern in eine Leiste am Bildrand.

### Dahinter, ohne Skizze

- **TDM/Mini-DM Sandarena:** Gruben und Käfige einbauen (0 Gen.), Mini-DM-HUD auf die Pixelschrift der
  anderen Arenen umstellen (0 Gen.).
- **Zeitfahren:** Schilder, Pfosten und Podest als Sprites; die Karte „standard“ braucht einen
  Hintergrund wie „Küste“.

## 6. Risiken

- **R1 – Budget-Lesart ungeklärt.** Der Unterschied zwischen Lesart 1 und 2 beträgt 435 Gen.
- **R2 – Batch 2 als Nachbau.** Wenn die 13 Bilder nur die prozeduralen Vorlagen nachmalen, bleibt das
  Gefälle bei Speed-Schach, Gewichtheben und Fechten Schlosshof bestehen, obwohl das Geld ausgegeben ist.
- **R3 – Geometrie.** Spurt klassisch und Staffel brauchen eine Kulisse, auf der der Motor die Bahn selbst
  zeichnet (Muster „Rahmen statt Material“). Sonst laufen Bild und Läufer auseinander.
- **R4 – Stil.** Die Referenzen sind dunkel und warm beleuchtet. Zeitfahren und Wettessen Jahrmarkt sind
  hell und flächig. Neue Bestellungen brauchen dieselbe Prompt-Familie wie HYROX-B, sonst entsteht ein
  neues Gefälle im Ton.
- **R5 – Bewertung ist Augenmaß.** Die Noten stammen aus je einem Standbild, bei Takeshi und Zeitfahren
  aus einer von mehreren Kamerastellungen. Mini-DM Sägewerk und Strom-Käfig, TDM Frost, Climbing-Karten in
  Bewegung, die Sandsack-Schicht im Gewichtheben und neun der elf Zeitfahr-Karten habe ich nicht angesehen.

## 7. Offene Fragen an Chris

1. **Sind die 435 bestellten Gen. (HYROX-Arena, Batch 2) im Guthaben ~1040 schon abgebucht?**
   Ja: 393 Gen. frei, alle fünf Remakes aus 4.3 gehen sofort. Nein: Stufenplan aus 4.5.
   Empfehlung: Kontostand einmal lesen (`GET /v2/balance`), bis dahin nach Lesart 1 planen.
2. **Darf der klassische Spurt ein eigenes neues Areal bekommen, obwohl das HYROX-Konzept ihn auf der
   alten Bahn lässt?** Empfehlung: **Ja.** Er ist nach dem Umzug von HYROX und Hatz das älteste Bild im
   Spiel und der Fall, den du selbst nennst.
3. **Falls Lesart 1 gilt: Reserve vorübergehend auf ~100 senken, damit Spurt klassisch sofort starten
   kann?** Empfehlung: **Ja**, bis zum Kassensturz nach Lieferung von HYROX-Arena und Batch 2.
