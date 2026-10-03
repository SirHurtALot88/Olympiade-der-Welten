# Gewichtheben, Physical-100-artig, zweiter Anlauf: „Das Sandsack-Rennen" — Fable-Präsentationskonzept (03.10.)

**Konzeptpapier, kein Code, keine Freigabe.** Zweite Runde zu Chris' Physical-100-Stichwort, nachdem
ihm die kleinere „Ladestrecke" (PR #1134, `gewichtheben-physical100-fable-konzept-03-10.md`)
vorgelegt wurde. Chris am 03.10., wörtlich:

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

Und sein Nachtrag: die echten Physical:100-Challenges dürfen Vorbild für die visuelle und
dramaturgische Seite sein.

**Arbeitsteilung.** Eine parallele Opus-Konsultation baut die Mechanik (Attribut-Zuordnung,
Tempo-/Erschöpfungs-/Rutsch-Formeln, Team-Taktik-Logik, rho/Pp, Klasse). Dieses Papier ist die
**Präsentation**: Bühnenbild, Figur und Requisite unter steigender Last, Sichtbarkeit der
Team-Taktik, Ticker, Ton, Asset-Liste. Wo ich eine mechanische Größe brauche (Tempo, Puste,
Rutsch-Moment), nenne ich sie als **Eingang**, den die Mechanik liefert — nicht als Formel.
Beide Papiere sind unabhängig geschrieben; wo sie sich zur Klasse äußern (Abschnitt 8), sollten
sie sich nicht widersprechen, aber Chris entscheidet, nicht ein Agent.

## 0. Ergebnis vorab

1. **Kernbild: zwei Bahnen, ein Hof, ein Silo je Seite.** Heim oben, Gast unten, beide laufen in
   dieselbe Richtung — links das Sandsack-Depot, rechts die Rampe zum Silo. Jeder abgelieferte
   Sack hebt den Füllstand im Silo der Seite: der Spielstand ist ein Rohr, das sich füllt, nicht
   eine Zahl. Das ist die Physical:100-Vorlage (S1 „Moving Sand": Säcke über den Steg und die
   Treppe in das große Rohr; S2: Farmer's Carry mit Sandsäcken zur Basis), übersetzt auf eine
   1240×470-Leinwand.
2. **Die steigende Last ist im Bild, nicht nur in der Zahl.** Säcke 1–6 werden größer, dunkler
   und wandern von der Schulter vor die Brust; die Figur neigt sich nach vorn, schwankt stärker,
   tritt kürzer. Dazu ein **Puste-Ring** über dem Kopf — die eine Größe, die der Zuschauer ohne
   Stats lesen soll. Rutscher und Verschnaufpause sind zwei klar unterscheidbare Pantomimen (3.3,
   3.4), beide ohne neue Sprite-Posen.
3. **Team-Taktik ist an drei Stellen sichtbar:** als Aufstellungsmoment vor dem Lauf (Figuren
   gehen an ihre Stationen), als Übergabe (der Sack liegt kurz am Boden zwischen zwei Läufern)
   und als Badge am Bahnanfang („Staffel 3" / „2+1" / „Alleingang"). Aus den Slots gelesen, vor
   dem Start — kein Spoiler (4).
4. **Keine neuen Sprite-Blätter nötig.** Alles — Säcke, Depot, Steg, Rampe, Silo, Ring, Schweiß,
   Sandwolke — sind Canvas-Formen in der Art, in der das Spiel ohnehin zeichnet. Die Figur bleibt
   auf dem `walk`-Blatt, Last und Erschöpfung kommen aus Transformationen (Neigung, Stauchung,
   distanzgetakteter Schritt), die `zeichneTeambank()`/`zeichneSpurt()` schon vormachen (6).
   Eine echte Trage-Pose wäre schöner, ist aber optional (6.3).
5. **Klasse-T-Verdacht, ausdrücklich.** Der Trick der Ladestrecke (im 6,2-s-Fenster eines
   Versuchs) funktioniert hier **nicht**: ein einziger lesbarer Sack-Transport über eine Bahn
   braucht rund 4 s, sechs Säcke mit Rückweg je Läufer 35–45 s. Ein Sandsack-Rennen ist entweder
   ein **neuer Akt** (zusätzliche Sendezeit, T) oder ein **neues Format** anstelle der Duelle
   (Sendezeit insgesamt kürzer als heute, aber ein Formatwechsel — erst recht Chris' Entscheidung).
   Abschnitt 8 rechnet beide Wege vor.

---

## 1. Was Physical:100 vormacht — und was davon auf 1240×470 übersetzbar ist

Kurz recherchiert (Quellen am Ende), kein Nachbau:

| Physical:100 | Was es dramaturgisch leistet | Übersetzung hier |
|---|---|---|
| **S1, Quest 3 „Moving Sand":** Fünferteams, über einen wackligen Holzsteg, Treppe hinunter, kleine Säcke mit Sand füllen, zurück über Treppe und Steg, in ein großes Rohr schütten; gewonnen hat, wer am meisten füllt. | Ein **Füllstand** als Spielstand; **Stationen** (Steg, Treppe, Füllplatz), an denen sich Teams sichtbar aufteilen; die Erschöpfung ist Teil des Bildes (Hände auf den Knien, Sand überall). | Silo je Seite mit Füllstand; drei Stationen Depot / Steg / Rampe; Aufteilung sichtbar an den Stationsgrenzen. |
| **S2, erstes Team-Quest:** Labyrinth, Sandsäcke im Farmer's Carry zu einer von drei Basen, das meiste Gewicht gewinnt die Basis. | Gewicht, nicht Stückzahl, als Währung; Tragen in der Hand, Säcke werden abgelegt und wieder aufgenommen. | Sackgewicht steigend (20…40 kg), Depot-Stapel zeigt, was noch kommt; Ablegen/Aufnehmen als Pantomime. |
| **Inszenierung allgemein:** dunkle Industriehalle, harte Spots, Säcke in schlichtem Sackleinen, Zeitlupe auf den Moment, in dem jemand den Sack fallen lässt oder sich auf den Sack setzt. | Der **Rutscher** und die **Pause** sind die Höhepunkte, nicht der Zieleinlauf. | Rutscher und Pause bekommen je eigene Pantomime, Ton und Ticker-Zeile (3.3/3.4); der Zieleinlauf bleibt ein einziger „big"-Moment. |

**Was nicht übersetzbar ist:** Gesichter, Muskeln, Zeitlupe. Die Figuren sind 64×64-LPC-Sprites.
Erschöpfung muss aus Haltung, Tempo, Requisite und einem Ring über dem Kopf kommen — und aus dem
Ticker. Das ist dieselbe Grenze, an der die Ladestrecke schon den Frische-Ring gewählt hat.

---

## 2. Bühnenbild: der Hof

### 2.1 Grundriss (W = 1240, H = 470)

Die Tribüne oben (`bodenHeben()`, 0…H·0,34) und die Hallendach-Lampen bleiben, ebenso die
Anzeigetafel oben rechts (x W−146, y 64, 132×98) — nur ihr Inhalt wechselt (4.3). Die
Plattform, die Kampfrichterlampen, Kreidekiste und Hantelständer sind **nicht** im Bild, solange
das Rennen läuft: der Hof ist ein eigener `bodenSandsack()`-Boden, der das Rennen trägt — kein
Umbau von `bodenHeben()`, sondern eine Schwester (so wie `bodenEis()` neben `bodenBuehne()` steht).

```
y=160   ─── Tribünenkante ───────────────────────────────────────────────────
y=175   [Reserve] DEPOT ▮▮▮ │ Bahn HEIM ───── Steg ═══════ ───── Rampe ╱ SILO ▌
y=250   ─── Fußlinie Heim ──┼───────── Stationsgrenze 1 ──┼── Stationsgrenze 2 ──
y=290   [Reserve] DEPOT ▮▮▮ │ Bahn GAST ───── Steg ═══════ ───── Rampe ╱ SILO ▌
y=365   ─── Fußlinie Gast ──┼──────────────────────────────┼──────────────────────
y=423   Warteschlangen-/Laufzeile (wie heute H·0,90)
        x=0,05   x=0,10        x=0,36          x=0,60      x=0,80   x=0,90
```

* **Zwei Bahnen, gleiche Richtung.** Die Ladestrecke ließ beide aufeinander zulaufen, weil es
  dort einen einzigen Treffpunkt gab (die Plattform). Ein Rennen über mehrere Trips liest sich nur
  in **parallelen Bahnen** in **derselben** Richtung — so, wie jede Staffel- und Schwimmübertragung
  gebaut ist: wer weiter rechts ist, führt. Fußlinien H·0,53 (Heim, ≈250) und H·0,78 (Gast, ≈365);
  die 115 px Abstand reichen für die größten Figuren (Golem Z≈1,7 → ≈108 px hoch), ohne dass
  Köpfe in die obere Bahn ragen.
* **Bahnmarkierung** in Teamfarbe (`css("--home")`/`css("--away")`, Alpha 0,35): ein 2-px-Streifen
  an der Fußlinie, dazu alle W·0,12 ein kleiner Kreidestrich quer — der Zuschauer sieht Schritte
  gegen eine Skala, nicht gegen Leere.
* **Boden:** dunkler Hallenboden wie heute (`#181c24`→`#0a0b0e`), auf den Bahnen eine
  **Sandstreu** (gestreute 1-px-Punkte `#8a7a55`, Alpha 0,25, deterministisch aus `cypherHash()`,
  dichter am Depot, dünner Richtung Silo). Das ist das „Physical:100-Hof"-Gefühl mit zwanzig Zeilen.
* **Scheinwerfer:** dieselben drei Kegel wie `bodenHeben()`, aber nicht auf die Mitte gebündelt,
  sondern auf **Depot, Steg und Silo** (x W·0,10 / 0,48 / 0,88) — die drei Stationen sind die drei
  Lichtinseln.

### 2.2 Die drei Stationen

Chris: „verschiedene Stationen". Wenn die Opus-Mechanik zwei oder drei Abschnitte definiert,
sind das die Bilder dafür. Jede Station hat ein eigenes **Bodenmaterial**, ein eigenes
**Requisit** und eine eigene **Lichtinsel** — so unterscheiden sie sich auch im Standbild.

| Station | Zone (x) | Boden | Requisit | Was dort passiert |
|---|---|---|---|---|
| **1 — Depot** | W·0,08 … 0,36 | Sand (dichte Streu, hellere Fläche `#3b3426`) | **Sandsack-Stapel**: die noch nicht getragenen Säcke, als Pyramide, 6 → 0. Daneben ein kleiner Sandhaufen (Halbellipse). | Bücken, Sack aufnehmen, loslaufen. Der Stapel schrumpft sichtbar — „noch drei". |
| **2 — Steg** | W·0,36 … 0,60 | **Holzplanken** über einer dunklen Grube: 10–12 Querbalken `#5c4a33`/`#4a3b29` im Wechsel, zwei Pfosten an jedem Ende, darunter Schwarz mit Alpha. | Der Steg **wippt**: steht eine Figur drauf, bekommen die Planken einen y-Versatz `sin(buehneT·6)·1,5` px — das „wacklige Brücke"-Zitat aus S1. | Hier rutscht am ehesten ein Sack (Mechanik-Eingang). |
| **3 — Rampe & Silo** | W·0,60 … 0,92 | Metallgitter: Hallenboden mit feinem Rautenmuster (`strokeStyle rgba(255,255,255,.05)`), ab W·0,80 eine **Rampe**, Polygon 25 px steigend. | **Silo**: Rohr 28×78 px mit Blechkante oben, in Teamfarbe füllend (2.3). | Hochgehen (y-Versatz entlang der Rampe), Sack kippen, Füllstand steigt, zurück. |

Bei nur **zwei Stationen** entfällt der Steg: Depot W·0,08…0,48, Rampe & Silo W·0,48…0,92. Die
Stationsgrenzen sind gemalte Linien quer über beide Bahnen (weiß, Alpha 0,35) mit einer kleinen
Nummernfahne „1 / 2 / 3" (9 px, nicht kleiner — Mikrotext-Schwelle aus Audit Punkt 24).

### 2.3 Das Silo — der Spielstand ohne Zahl

Je Seite am rechten Rand (x ≈ W·0,90, direkt über der jeweiligen Fußlinie): ein Rohr 28×78 px,
Rahmen `#3a3f4c`, Innenraum `#0c0d10`, Füllung in Teamfarbe von unten; Höhe = abgelieferte
Säcke / Gesamtzahl, aber **gewichtet** — ein 40-kg-Sack hebt den Pegel doppelt so weit wie ein
20-kg-Sack. So liest man „Gast hat drei Säcke, Heim zwei schwere" ohne Zahl. Darüber die Zahl
trotzdem, 9 px: „3/6". Beim Einfüllen: ein Sand-Rinnsal (5–8 Punkte, 0,3 s) vom Sackmund in die
Rohrmündung, der Pegel steigt in 0,4 s ans neue Niveau, die Blechkante blitzt kurz in Teamfarbe
(derselbe Alpha-0,5-Halo wie die Kampfrichterlampen).

### 2.4 Wartezone

Wer nicht läuft, steht nicht auf einer Bank am Rand (die Bänke aus `hebenBankRect()` liegen bei
y H·0,70 mitten in der Gast-Bahn), sondern **hinter dem Depot** in der eigenen Bahn (x W·0,02 …
0,07), Skala 0,8 wie `HEBEN_BANK_SKALA`, hinter einem gespannten Seil (zwei Pfosten, eine Linie).
Gezeichnet über `zeichneTeambank()` mit einem schmalen `rect` — die Feier-Hüpfer (`teamFeierHaltung()`)
funktionieren dort unverändert. Bei einer Staffel steht die Wartezone leer oder fast leer; beim
Alleingang stehen fünf Figuren hinter dem Seil — das ist bereits das erste Bild der Taktik (4).

---

## 3. Figur und Requisite unter steigender Last

### 3.1 Der Sack

Eine Form, sechs Stufen. Gezeichnet als abgerundetes Rechteck mit zwei Nahtlinien quer, Zipfel
oben (kleines Dreieck), leichter Schatten unten — Sackleinen, kein Logo. **Keine Zahl auf dem
Sack** (sie wäre unter 9 px); das Gewicht steht in der Laufzeile und auf der Anzeigetafel.

| Sack | Größe (B×H, px, bei Z = 1) | Farbe | Nähte | Trageort |
|---|---|---|---|---|
| 1 | 14×10 | `#c9a86a` | 1 | Schulter |
| 2 | 15×11 | `#bd9b5e` | 1 | Schulter |
| 3 | 17×12 | `#ab8a50` | 2 | Schulter |
| 4 | 19×14 | `#937444` | 2 | vor der Brust |
| 5 | 21×15 | `#7d6239` | 3 | vor der Brust |
| 6 | 24×17 | `#6a5230` | 3, dazu ein schwarzes Band | vor der Brust, Figur gebeugt |

Das ist dieselbe Idee wie `HEBEN_SCHEIBEN_STUFEN` (`:475`): Last → sichtbar mehr Requisite, rein
optisch, kein Motorwert. Die Reihenfolge 20→40 kg ist ein Vorschlag; die Mechanik setzt die
Gewichte, die Tabelle hängt nur an der **Nummer** des Sacks.

**Verankerung an der Figur, zwei Anker, beide vorhanden:**

* **Schulter (Säcke 1–3):** y = Scheitel + 0,22 · Körperhöhe, x = Figurmitte − 5·Z gegen die
  Laufrichtung (der Sack liegt hinten auf der Schulter, der Kopf verdeckt seine Vorderkante
  leicht — Zeichenreihenfolge: Sack **vor** dem Sprite, aber mit `globalCompositeOperation`
  normal; die Überdeckung durch den Kopf entsteht, indem der Sack 2 px tiefer als die
  Schulterlinie sitzt). Die Schulterlinie ist gemessen: Zelle 26,8 (`HEBEN_PHASEN`-Kommentar,
  Hantel-Recherche 13.09.), also Anteil (26,8−11,4)/50,9 ≈ 0,30 — ich nehme 0,22, damit der Sack
  **auf** der Schulter liegt, nicht in ihr.
* **Vor der Brust (Säcke 4–6):** exakt `HEBEN_PHASEN.zug.anteil` 0,326 — der Front-Rack-Anker,
  den die Ladestrecke schon für den Scheibenstapel nutzt. Beide Hände „unter" dem Sack; dass die
  Hände des `walk`-Blatts in den Passier-Bildern keine eigene Kontur haben
  (`sprite-handpunkte.md`, Spalten 0–2/7–8), ist hier egal: der Sack verdeckt genau diesen
  Bereich.

Beide Anker rechnen wie `zeichneHantel()` mit `koerperHoehe` statt fester Pixel — dann sitzen
sie auch an Golem/Kraken/Werwolf (andere Raster, s. `HEBEN_KOERPER_STD`-Kommentar).

### 3.2 Die Figur: Last und Erschöpfung ohne neue Pose

Vier Transformationen, alle in `zeichneSandsack()` um den Fußpunkt gelegt (dasselbe
`translate/scale/translate`-Muster wie `zeichneTeambank()` `:20773`), alle aus zwei Eingängen der
Mechanik: **`last`** (0…1, Sacknummer/6 oder Gewicht/Maximum) und **`puste`** (0…1, der
Erschöpfungsstand des Läufers — die Opus-Größe, wie immer sie heißt).

| Was | Wie | Wirkung über die Säcke |
|---|---|---|
| **Vorneigung** | `ctx.rotate(richtung · (0,03 + 0,12·last·(1,3−puste)))` um den Fußpunkt | Sack 1: 2°, Sack 6 mit leerer Puste: ~10°. Lesbar, nicht karikiert. |
| **Schwanken** | x-Versatz `sin(vizSchrittPhase·2π)·(0,5 + 3·last)` px, y-Versatz halb so groß | Sack 1 kaum, Sack 6 ein sichtbares Torkeln im Schrittrhythmus. |
| **Kürzerer Schritt** | Laufzyklus **distanzgetaktet**: `vizAniPhase = zurückgelegteStrecke / schrittLänge` (exakt das Spurt-Muster `vizAniPhase:u.vizSchritt`, `:38707`), `schrittLänge = 26 − 10·last` px | Langsamer gehen heißt automatisch langsamer treten — die Beine passen zum Tempo, das die Mechanik vorgibt, ohne dass die Animation wüsste, warum. |
| **Stauchung** | `scale(1, 1 − 0,06·last)` | Sack 6: 6 % kürzer, die „Knie geben nach". |

Dazu zwei Ebenen, die nur die Erschöpfung zeigen:

* **Puste-Ring** über dem Kopf (Scheitel − 10·Z): ein Kreisbogen r = 7, Breite 2,5, Füllung =
  `puste`, Farbe amber `#d6ac36` (voll) → grau `#5f6675` (halb) → `css("--crit")` unter 0,2. Weg,
  sobald der Läufer in der Wartezone steht. Das ist der Frische-Ring der Ladestrecke, nur dass er
  sich **während** des Laufs leert — und in der Pause wieder füllt (3.4). Kein „+", nur Füllstand
  (Nebenbefund 3 des Ladestrecke-Papiers).
* **Schweiß:** unter `puste < 0,4` je Sekunde 1–2 Tropfen (2-px-Punkte `#cfe3ff`, Alpha 0,7) am
  Kopf, fallen 12 px, verblassen. Dieselbe Konfetti-Arithmetik wie `teamFeierEffekte()`, nur
  nach unten und ohne Wurf.

**Was die Figur NICHT kann** (ehrlich): Hände auf den Knien, ein Gesicht, das sich verzieht,
ein Sack, der wirklich aus **Händen** rutscht. Die Hände des Blatts schwingen im Laufzyklus und
haben in fünf von neun Bildern keine eigene Kontur; eine Requisite kann nur an Schulter oder
Brust sitzen, nie überzeugend „in der Hand". Alles unten ist mit diesem Wissen gebaut.

### 3.3 Der Rutscher

Eingang: die Mechanik meldet „Sack n rutscht bei Strecke s". Pantomime, 1,3 s, vier Schritte:

1. **Lösen (0–0,25 s):** der Sack verlässt seinen Anker mit v_y = −40 px/s und
   v_x = Laufrichtung · 30 px/s, Gravitation 520 px/s² (dieselbe Zahl wie das Konfetti) — er
   kippt also erst leicht nach vorn-oben, dann fällt er. Die Figur läuft **einen** Schritt weiter
   (sie merkt es zu spät — das ist der Witz der echten Szene) und stoppt.
2. **Aufprall (0,25 s):** der Sack landet auf der Fußlinie, 0,15 s lang auf 130 % Breite / 60 %
   Höhe gestaucht, dann normal; **Sandwolke**: 6–8 Punkte `#8a7a55` vom Aufprallpunkt nach außen,
   0,3 s, verblassend. Ton `sack_fall` (5). Auf dem Steg bleibt der Sack auf den Planken liegen —
   **nicht** in die Grube (ein Sack, der verschwindet, bräuchte ein Ersatz-Depot und eine zweite
   Regel; nicht in dieser Runde).
3. **Umdrehen und Bücken (0,25–0,9 s):** `blickAus()`-Richtung kippt (die Figur schaut zum Sack),
   `scale(1, 0,86)` plus `translate(0, +4)` — das Bücken aus `zeichneTeambank()`-Mitteln. Der
   Puste-Ring bleibt, wo er ist (er hängt am Scheitel, der Scheitel geht mit nach unten — gut so).
4. **Aufnehmen (0,9–1,3 s):** Sack springt in 0,2 s zurück an den Anker (lineare Interpolation
   vom Boden), Figur richtet sich auf, Blick zurück in Laufrichtung, Ton `sack_auf`.

Verlorene Zeit: 1,3 s plus ein Schritt. Die Mechanik entscheidet, ob es mehr ist (Pause nach dem
Rutscher); das Bild liefert dafür nahtlos 3.4.

**Lesbarkeit:** der Rutscher ist der eine Moment, in dem im Bild etwas **liegt**, das sonst nie
liegt. Das reicht; kein Blitz, kein Banner. Ticker-Zeile einmal (4.2), nie `big`.

### 3.4 Die Verschnaufpause

Eingang: „Läufer u pausiert t_p Sekunden". Pantomime:

1. **Absetzen (0,3 s):** der Sack wandert vom Anker senkrecht auf die Fußlinie **neben** die
   Figur (x + 14·Z in Laufrichtung), ohne Fall, ohne Wolke — er wird abgestellt, nicht verloren.
   Ton: ein dumpfer, kurzer `sack_ab`.
2. **Stehen und Atmen (t_p − 0,6 s):** `walk`-Bild 0 (Standbild), **Atemheben** `scale(1, 1 ±
   0,03)` bei 1,6 Hz — die Brust hebt sich, mehr nicht. Der Puste-Ring **füllt sich sichtbar**
   (das ist die Belohnung der Pause; die Mechanik sagt, wie weit). Ton `keuchen` zweimal je
   Sekunde, leise. Bei `puste < 0,2` zusätzlich die Schweißtropfen.
3. **Aufnehmen (0,3 s):** Bücken wie 3.3 Schritt 3/4, Sack zurück an den Anker, weiter.

Der Unterschied zum Rutscher ist auf einen Blick da: beim Rutscher **fällt** etwas und die Figur
dreht sich um; bei der Pause **steht** etwas neben ihr und sie atmet. Zwei Pantomimen, zwei Töne,
zwei Ticker-Zeilen — nie dieselbe.

### 3.5 Aufnehmen am Depot, Abliefern am Silo

* **Depot:** Figur läuft bis zum Stapel, Bücken (0,3 s), der oberste Sack des Stapels springt an
  den Anker, Stapel wird um einen kleiner. Ton `sack_auf`. Bei Sack 5 und 6 dauert das Bücken
  0,5 s und die Figur richtet sich in **zwei** Stufen auf (`scale` 0,86 → 0,94 → 1) — der
  „schwere Hub".
* **Silo:** Figur geht die Rampe hoch (y-Versatz −25 px über die letzten W·0,10, die Fußlinie
  „knickt" dort nach oben, Schatten bleibt auf dem Bahnboden — der Höhenversatz wird dadurch
  lesbar wie bei den Hüpfern der Bank), kippt den Sack: 0,25 s Rotation des Sacks um 60° in die
  Rohrmündung, Sand-Rinnsal, Pegel steigt, Blechkante blitzt. Ton `sack_silo`. Dann **leer**
  zurück: ohne Sack, ohne Neigung, Schrittlänge 26 px, Schwanken 0 — der Rückweg ist sichtbar
  leichter, und genau dieser Kontrast erzählt, was die Last tut.

### 3.6 Zieleinlauf

Der letzte Sack der Seite kippt ins Silo: Pegel auf 100 %, Blechkante leuchtet 0,8 s, Rohr
bekommt einen Teamfarben-Halo, `teamFeierAusloesen(side,"gross",{x:silo,y:siloOben})` — Konfetti
aus dem Silo, die Wartezone hüpft (alles vorhanden). Der Verlierer bringt seinen laufenden Sack
noch ins Silo und bleibt dann stehen; die restlichen Säcke **bleiben sichtbar im Depot liegen** —
„mit zwei Säcken Vorsprung" steht dann im Bild, bevor es im Ticker steht. Ein `big`-Ticker, einer,
am Zieleinlauf (4.2).

---

## 4. Team-Taktik sichtbar machen

### 4.1 Drei Taktiken, drei Bilder

Chris: „manchmal teilen sich die spieler auf und manchmal machen einzelne spieler alle stationen
… als taktik vom team bestimmt (zb auch durch die slots)". Wie die Mechanik die Taktik aus den
Slots ableitet, ist Opus' Sache; das Bild braucht nur, **welche** Läufer **welche** Stationen
übernehmen. Drei Formen decken alles ab:

| Taktik | Bild während des Laufs | Wartezone |
|---|---|---|
| **Alleingang** | Eine Figur läuft alle Stationen, alle Trips. Puste-Ring leert sich über den ganzen Lauf — der Ring ist hier die Hauptgeschichte. | Fünf Figuren hinter dem Seil. |
| **Staffel 3** (eine Figur je Station) | Drei Figuren stehen je in ihrer Zone; der Sack wird an der Stationsgrenze **übergeben** (4.2). Jede Figur läuft nur ihren Abschnitt hin und zurück — drei kurze Pendel statt eines langen. | Drei Figuren hinter dem Seil. |
| **2+1** (eine Figur zwei Stationen, eine dritte eine) | Zwei Figuren, eine Übergabe. Die Zweistationen-Figur hat den längeren Pendel und den leereren Ring. | Vier Figuren hinter dem Seil. |

Bei zwei Stationen entsprechend Alleingang / Staffel 2.

### 4.2 Die Übergabe — das Bild, an dem man die Staffel erkennt

An der Stationsgrenze: der ankommende Läufer bückt sich (0,3 s), der Sack liegt **0,3 s auf
der Linie**, der nächste Läufer bückt sich, nimmt ihn, läuft. Zwei Bück-Pantomimen, ein Sack am
Boden, 0,9 s insgesamt — und jeder sieht: hier wird gewechselt. Der ankommende Läufer dreht um
und pendelt zurück zu seinem Stationsanfang (leer, schnell). Ton `uebergabe` (5), ein kurzer
Doppelklick wie bei der Staffel.

Beim Alleingang passiert an der Linie nichts — die Figur läuft durch. Das ist der ganze
Unterschied, und er ist in jedem Trip neu sichtbar.

### 4.3 Vorab-Anzeige: Aufstellungsmoment und Badge

**Ja, es braucht eine Vorab-Anzeige** — aus zwei Gründen: der Zuschauer soll die Taktik
erkennen, **bevor** der erste Sack unterwegs ist (sonst rätselt er zwei Trips lang, warum der
zweite Läufer an der Linie steht), und die Manager-Entscheidung (Slots) muss als Entscheidung
lesbar sein, nicht als Zufall.

1. **Aufstellungsmoment (1,5 s vor dem Start):** alle beteiligten Läufer gehen aus der Wartezone
   an ihre Stationen (Lauf-Interpolation wie I-Spys `gehen`-Phase, `:20190`), die Taktik-Badges
   (unten) blenden ein, die Anzeigetafel zeigt „SANDSACK-RENNEN · Lauf 1/…". Dann der Start
   (Ton `hupe`). Kein Spoiler: die Taktik ist eine Vor-Start-Entscheidung aus den Slots, so
   öffentlich wie heute die Ansage am Meldetisch.
2. **Badge am Bahnanfang** (x W·0,08, über der Fußlinie, 9 px, Teamfarbe): „Staffel 3" /
   „2+1" / „Alleingang", mit einem Mini-Piktogramm aus 1–3 Punkten, die durch Striche verbunden
   sind (●–●–● / ●●–● / ●). Bleibt den ganzen Lauf.
3. **Anzeigetafel oben rechts** (ersetzt REISSEN/STOSSEN während des Laufs): Zeile 1
   „SANDSACK-RENNEN", Zeile 2 „Lauf 2/3 · Sack 4/6", Zeile 3 (16 px) „30 kg" — das aktuelle
   Sackgewicht, groß, wie heute die angesagte Last. Zeile 4/5: „Heim: Staffel 3 / Gast: Alleingang".
4. **Laufzeile unten** (H·0,90, statt der Warteschlangenzeile): „Heim 3/6 · Gast 2/6 — Cassandra
   auf dem Steg, Gram am Depot" — der verbale Zwischenstand, lesbar auch, wenn man die Figuren
   nicht auseinanderhält.

### 4.4 Spoiler-Prüfung

Gezeigt werden Taktik (Vor-Start), Sackgewichte (Vor-Start), Füllstände (passiert). Rutscher und
Pausen kommen aus der Mechanik — **wenn Opus den Lauf wie `hebeUebung()` vorab rechnet**, muss die
Anzeige jedes Ereignis **an seinem Moment** enthüllen, nie früher. Das ist dieselbe Lampen-
Regel wie überall auf dieser Bühne (H1/H2.2, PR #1091): nichts am Puste-Ring, am Schwanken oder
am Ticker darf einen Rutscher ankündigen, der noch nicht passiert ist. Konkret: `puste` darf ein
gleitender Wert sein, der Rutsch-Moment selbst ist ein Schalter, der erst im Frame des Ereignisses
umlegt. Sichtabnahme wie bei PR #1091: Screenshot-Serie bei 1× über einen ganzen Lauf.

---

## 5. Ticker-Dramaturgie

Im Stil des Hauses (`hebenTickerAmUrteil()`, `:19682`): kurz, Vorname (`u.n.split(" ")[0]`),
Rolle in Klammern, wo sie trägt, `big` nur für den einen echten Höhepunkt. `feed(side, txt, big,
caption, kind)` mit vollständiger Signatur. Jede Zeile wird **am Moment** des Ereignisses
geschrieben (Rutscher: beim Aufprall; Pause: beim Absetzen; Silo: beim Kippen), nicht an einer
Enthüllung.

| Moment | Zeile | `big` | `kind` |
|---|---|---|---|
| Aufstellung | „Sandsack-Rennen, Lauf 1 von 3: sechs Säcke, 20 bis 40 kg. Heim teilt auf — Cassandra lädt, Brakk nimmt den Steg, Ilva die Rampe. Gast schickt Gram allein." | nein | `aufstellung` |
| Start | „Hupe — Cassandra und Gram am Depot." | nein | `start` |
| Zwischenstand (nach Sack 2 oder 3, einmal) | „Dritter Sack im Silo bei Gast — Gram zwei Schritte vor Cassandra." | nein | `zwischenstand` |
| Last wird spürbar (erster Sack vor der Brust) | „Sack 4 wiegt 30 kg — Cassandra wird langsam, Gram hält den Schritt." | nein | `last` |
| Rutscher | „Gram verliert Sack 5 auf dem Steg — rutscht ihm weg, Cassandra zieht vorbei." | nein | `rutscher` |
| Rutscher an der Rampe | „Brakk lässt den sechsten Sack auf der Rampe fallen — zwei Meter vor dem Silo." | nein | `rutscher` |
| Pause | „Cassandra muss durchatmen — Sack 6 steht neben ihr, Gram ist auf der Rampe." | nein | `pause` |
| Pause des Alleingängers | „Gram setzt ab, zum zweiten Mal — alle sechs Säcke allein, das kostet." | nein | `pause` |
| Übergabe (nur erste je Lauf, danach stumm) | „Übergabe an der Steglinie: Brakk übernimmt von Cassandra." | nein | `uebergabe` |
| Slot-Rolle sichtbar (Grip Anchor o. ä., wenn Opus eine Rolle einfärbt) | „Brakk (Grip Anchor) trägt Sack 6 über den Steg, ohne zu wackeln." | nein | `rolle` |
| Knapper Zieleinlauf | „Beide auf der Rampe — Gram kippt den sechsten Sack einen Schritt vor Ilva. Lauf an Gast." | **ja** | `laufsieg` |
| Klarer Zieleinlauf | „Ilva bringt den sechsten Sack ins Silo — Lauf an Heim, Gast hat noch zwei Säcke im Depot." | **ja** | `laufsieg` |
| Nach dem Lauf (Mehrwege-Satz, nur wenn zutreffend) | „Cassandra war bis Sack 3 vorn — ab 30 kg trug Gram besser." | nein | `nachlese` |

Banner-Dosis: eine `big`-Zeile je Lauf (Audit Punkt 7). Großbuchstaben nur im Wort „Hupe"? Nein —
auch nicht; kein Schrei, keine Caps. Der eine Höhepunkt trägt sich über `big`, nicht über
Lautstärke im Text.

**Schweber** (`schwebe()`): „+1" in Teamfarbe am Silo beim Einfüllen; „rutscht!" in `--crit` am
Rutscher; „Pause" grau beim Absetzen. Kein kg-Schweber je Sack — der steht auf der Tafel.

---

## 6. Ton

`TON_KATALOG.gewichtheben` bekommt acht Einträge, alle aus den **fünf** vorhandenen Primitiven
(`tonKlick`, `tonSchlag`, `tonMetall`, `tonRauschen`, `tonTon`/`tonDoppelton`) — kein sechster
Baustein (Katalog-Regel, s. Climbing-Kommentar `:32486`). Vorhanden und wiederverwendet:
`publikum` (Loop), `ausbruch`, `raunen`, `klatschen`.

| Ereignis | Synthese | Charakter |
|---|---|---|
| `hupe` (Start) | `tonTon(vol,220,0.6)` | tiefer Hallenton, anders als der 300-Hz-Ansage-Gong |
| `sack_auf` | `tonSchlag(vol,180,90,0.08)` + `tonRauschen(vol·0.5,350,0.12,false)` | dumpfer Hub plus Sackleinen-Rascheln |
| `sack_ab` (Pause) | `tonSchlag(vol·0.8,140,70,0.10)` | abgestellt, nicht gefallen — kürzer, ohne Rauschen |
| `schritt_last` | `tonSchlag(vol·0.35,120,60,0.05)` | ein Tritt; Auslöser an der Kante des distanzgetakteten Laufzyklus (Zählervergleich wie `climbing.griff`), also automatisch **langsamer**, je schwerer |
| `sack_fall` (Rutscher) | `tonSchlag(vol,200,50,0.2)` + `tonRauschen(vol·0.6,600,0.25,false)` | Aufprall plus Sandwolke — bewusst ohne `tonMetall`, damit es nicht wie `scheiben_fall` klingt |
| `keuchen` | `tonRauschen(vol·0.35,900,0.18,false)`, 2×/s während der Pause | atmen, leise |
| `uebergabe` | `tonKlick(vol,1600,0.04)` + `tonKlick(vol·0.7,2000,0.03)` | derselbe Doppelklick wie `staffel.uebergabe` — eine Übergabe klingt im ganzen Spiel gleich |
| `sack_silo` | `tonRauschen(vol,1200,0.3,false)` + `tonMetall(vol·0.5,400,0.15)` | Sand rinnt, Blech klingt |
| `laufsieg` | `tonDoppelton(vol,700,1050,0.32)` + `ausbruch` | der positive Reveal des Hauses (wie `staffel.ziel`, `time-trial.ziel`), Publikum dazu |

Das Publikum reagiert wie heute über `publikumDy` auf Phasen: Wippen beim Start (Klatschrhythmus
`klatschen` ×3, enger werdend), **Raunen + Absacken** beim Rutscher (dieselbe `hebenDroop`-
Mechanik), Sprung beim Laufsieg. Kein neuer Loop.

---

## 7. Asset-Liste für den Build-Agenten

### 7.1 Neu — alles Canvas-Formen, keine Bilddateien

| Element | Form | Wo |
|---|---|---|
| Sack (6 Stufen) | abgerundetes Rechteck, 1–3 Nahtlinien, Zipfel, Schatten; Tabelle 3.1 | `zeichneSack(ctx,x,y,s,stufe,richtung)` neben `zeichneHantel()` |
| Depot-Stapel | 6→0 Säcke als Pyramide (3/2/1), daneben Sandhaufen (Halbellipse `#3b3426`) | `bodenSandsack()` |
| Steg | 10–12 Planken im Wechsel, 4 Pfosten, Grube darunter (Schwarz, Alpha 0,6), Wipp-Versatz | `bodenSandsack()` |
| Rampe | Polygon, 25 px steigend über W·0,10, Gitterboden-Raute | `bodenSandsack()` |
| Silo | Rohr 28×78, Blechkante, Füllung Teamfarbe, Zahl „n/6" 9 px, Halo | `bodenSandsack()` (Rohr) + `zeichneSandsack()` (Füllung, Halo) |
| Bahnen, Kreidestriche, Stationsgrenzen, Nummernfahnen | Linien, Alpha 0,35; Fahnen 9 px | `bodenSandsack()` |
| Sandstreu | 1-px-Punkte aus `cypherHash()`, deterministisch | `bodenSandsack()` |
| Wartezone-Seil | 2 Pfosten, 1 Linie | `bodenSandsack()` |
| Puste-Ring | Kreisbogen r 7, Breite 2,5, drei Farben | `zeichneSandsack()` |
| Schweißtropfen, Sandwolke, Sand-Rinnsal | 2-px-Punkte, Konfetti-Arithmetik | `zeichneSandsack()` |
| Taktik-Badge | Text 9 px + Piktogramm (1–3 Punkte, Striche) | `zeichneSandsack()` |

### 7.2 Wiederverwendet, unverändert

* **Figur:** `zeichneSprite()` mit `walk`-Blatt, Laufrichtung über `vx`/`vy` → `blickAus()`,
  distanzgetakteter Zyklus über `vizAniPhase` (Spurt-Muster), Standbild = Bild 0.
* **Transformationen um den Fußpunkt:** `translate/scale/translate` aus `zeichneTeambank()`.
* **Front-Rack-Anker:** `HEBEN_PHASEN.zug.anteil`, `HEBEN_KOERPER_STD`, `koerperHoehe`-Logik aus
  `zeichneHantel()`.
* **Lauf-Interpolation:** I-Spys `gehen`-Phase (`vizX` von→ziel über Anteil), Aufstellung und
  Rückweg.
* **Wartezone:** `zeichneTeambank()` mit eigenem `rect`, `teamFeierHaltung()`-Hüpfer.
* **Feier:** `teamFeierAusloesen()` + `teamFeierEffekte()` mit Silo-Anker.
* **Publikum:** Tribüne, `publikumDy`-Reaktionen, Dachlampen, Scheinwerferkegel (nur andere
  x-Ziele).
* **Anzeigetafel:** Kasten, Goldstreifen, Schriftgrößen aus `bodenHeben()` — nur andere Texte.
* **Ticker/Schweber:** `feed()`/`schwebe()` mit `stumm`-Gating.
* **Ton:** fünf Primitive, `publikum`-Loop, `ausbruch`/`raunen`/`klatschen`.

### 7.3 Ehrlich: was die Mittel nicht hergeben

* **Keine Hände am Sack.** Schulter- oder Brustanker, s. 3.1. Wer einen Sack „in den Händen"
  will, braucht eine Trage-Pose als neues Sprite-Blatt (9 Bilder × 4 Richtungen, Methode
  `sprite-handpunkte.md`) — eine Sprite-Runde, schätzungsweise ein eigener Auftrag; **nicht
  Voraussetzung** für dieses Konzept.
* **Kein Gesicht, kein Hände-auf-die-Knie.** Erschöpfung = Neigung + Stauchung + Atemheben +
  Ring + Schweiß + Ticker. Das ist das Maximum der Formen; es reicht, wenn alle sechs zusammen
  kommen, nicht einzeln.
* **Kein Sack in der Grube.** Ein Sack, der vom Steg fällt, bleibt auf den Planken (3.3).
* **Vollbild-Kreaturen** (Golem/Kraken/Werwolf) bekommen Sack und Ring über `koerperHoehe`
  richtig platziert, aber keine Neigung/Stauchung-Feinheit — ihr Raster ist anders, das Bild
  bleibt grob. Wie bei der Jubelpose (Befund B2: „Vollbild-Kreaturen hüpfen nur").
* **Zwei Bahnen à ≈ 1000 px bei 1240 px Breite** heißt: bei Skala 1 sind die Figuren 64 px auf
  1000 px Strecke — klein. Die Lesbarkeit kommt aus Bahnmarkierung, Silo und Laufzeile, nicht aus
  der Figur. Wer die Figuren größer will, muss die Strecke kürzen (W·0,5), was den Lauf schneller,
  aber die Stationen enger macht — Abnahme per Screenshot, nicht per Papier.

---

## 8. Sendezeit und Klasse — ausdrücklicher T-Verdacht

**Die Ladestrecke konnte in ein vorhandenes Fenster.** Sie war ein Trip, 2,8 s, innerhalb der
6,2 s des ersten Stoßversuchs. Ein Sandsack-Rennen kann das **nicht**, und ich will das nicht
kleinreden:

| Größe | Rechnung | Ergebnis |
|---|---|---|
| Ein beladener Trip über eine Bahn von ≈ 1000 px | lesbares Lasttempo 180 px/s (Sack 1) … 120 px/s (Sack 6), plus Bücken/Kippen ≈ 0,8 s | 6,3 … 9,1 s |
| Rückweg leer | 300 px/s | ≈ 3,3 s |
| Sechs Säcke, ein Läufer (Alleingang) | Σ Trips + Rückwege + ~1 Pause + ~0,5 Rutscher | **≈ 60–70 s** |
| Sechs Säcke, Staffel 3 | Abschnitte parallel, aber jeder Sack muss alle drei durch; Engpass ist der langsamste Abschnitt + 2 Übergaben je Sack | **≈ 35–45 s** |
| Kürzere Bahn (W·0,5 ≈ 620 px) | alles × 0,62 | Alleingang ≈ 40 s, Staffel ≈ 25 s |

Heute: ein Duell = 12 Versuche × 6,2 s ≈ 74 s; sechs Duelle 7:11 gesamt. Ein Rennen ist also
**ein halbes bis ein ganzes Duell lang** — ganz gleich, wie man die Bahn zieht. Drei Wege:

| Weg | Was | Sendezeit | Klasse (meine Einschätzung) |
|---|---|---|---|
| **A — Rennen zusätzlich** (z. B. ein Mannschaftslauf nach den sechs Duellen, oder ein Lauf je zwei Duelle) | Duelle unverändert, Rennen als eigener Akt mit eigenem `buehneQueue`-Eintrag | **7:11 + 40 s bis + 3 min**, je nach Anzahl | **T** — mehr Zuschauzeit, die niemand gewählt hat. Nur Chris. |
| **B — Rennen ersetzt einen Teil der Duelle** (z. B. Duelle 5 und 6 werden ein Lauf) | Vier Duelle + ein Lauf | ≈ 6:00 | **T-nah** — kürzer, aber ein Formatwechsel; die Wertung (`u.summe`, rho, Pp) ist Opus' Thema, die Sendezeit Chris'. |
| **C — Rennen ist das neue Gewichtheben** | Drei Läufe à Staffel/Alleingang statt sechs Duelle | ≈ 2:30 – 4:00 | **Formatwechsel**, keine Anzeige-Klasse mehr — Chris, mit allem, was `ARENA_RESOLVED_DISCIPLINE_IDS`, Boxscore, Kaderbildschirm und die 32 Sonden-Skripte daran hängen haben. |

Kein Weg ist A\* oder A. **Wer dieses Konzept baut, baut Sendezeit oder Format — beides gehört
Chris.** Das Opus-Papier ordnet die Mechanik ein; sollte es zu einer anderen Zeitrechnung kommen,
gilt: die niedrigere Einschätzung baut niemand ohne Chris' Wort.

Ein ehrlicher Hinweis zur Dramaturgie: **kürzer als ≈ 25 s wird ein Rennen nicht gut.** Die
Geschichte, die Chris beschreibt (agil bei Sack 1–2, müde bei 5–6, Rutscher, Pause), braucht Zeit,
um sich zu entfalten — bei einem 10-s-Lauf gäbe es keine Schere mehr, nur ein Ergebnis. Die
Ladestrecke ist die 3-s-Fassung derselben Idee; dieses Papier ist die 40-s-Fassung. Beide
existieren zu Recht nebeneinander, und Chris kann die kleine behalten, die große dazu nehmen
oder die große statt der kleinen — nur nicht beide in demselben Fenster.

---

## 9. Was ich Chris fragen würde (kurz)

1. **Bahnlänge:** volle Breite (≈ 1000 px, 40–65 s je Lauf, Figuren klein) oder halbe Breite
   (≈ 620 px, 25–40 s, Figuren lesbarer, Stationen enger)?
2. **Stationen:** zwei (Depot / Rampe & Silo) oder drei (mit Steg)? Der Steg ist das beste
   Rutscher-Bild, kostet aber Strecke.
3. **Wo im Spiel:** A, B oder C aus Abschnitt 8 — das entscheidet alles andere.
4. **Trage-Pose:** reicht Schulter/Brust-Anker (sofort baubar) oder soll eine Sprite-Runde für
   eine echte Trage-Pose vorangehen (eigener Auftrag)?
5. **Verlierer-Ende:** laufender Sack noch ins Silo und dann Schluss (Vorschlag, zeigt den
   Vorsprung im Depot) oder beide Seiten bis zum letzten Sack?

Nichts davon ist vorausgefüllt; nichts davon leitet eine Freigabe ab.

---

## Quellen

Im Repo (Stand `origin/main` `83d02cf1`): `public/mockups/battle-mode.engine.js` —
`HEBEN_PHASEN` `:435`, `HEBEN_SCHEIBEN_STUFEN`/`zeichneHantel()` `:475–542`, `ANIBILDER`/`blickAus()`
`:2355–2362`, `zeichneSprite()` Posenwahl `:3958–3977` und `vizAniPhase` `:4002–4011`,
`BUEHNE_ART.gewichtheben` `:14409`, `buehnenBewegung()` `:18461`, `stepHeben()` `:19564`,
`hebenTickerAmUrteil()` `:19682`, `stepSchatzsuche()` Lauf-Interpolation `:20116–20202`,
`teamFeierHaltung()`/`zeichneTeambank()`/`teamFeierEffekte()` `:20722–20811`, `bodenHeben()`
`:21639–21914`, `zeichneHeben()` `:25503–25891`, `HEBEN_SPALTE`/`hebenBankRect()` `:25502/:25900`,
Ton-Primitive `:32278–32355`, `TON_KATALOG.gewichtheben` `:32376`, `zeichneSpurt()`
`vizAniPhase:u.vizSchritt` `:38707`, `feed()` `:39972`; `docs/design/gewichtheben-physical100-fable-
konzept-03-10.md` (Ladestrecke, Abschnitt 7 als Stilvorbild); `docs/design/sprite-handpunkte.md`
(Handpunkte, Trage-Pose-Methode); `docs/design/gewichtheben-hantel-recherche-13-09.md`
(Körperlandmarken); `docs/design/f1-broadcast-audit-runde-2-30-09.md` (Banner-Dosis, Mikrotext
9 px); CLAUDE.md (Abnahmen, Matrixsperre, Mehrwege).

Physical:100 (Netflix), kurz nachgelesen am 03.10.:
[Wikipedia, Physical: Asia / Quest-Beschreibungen](https://en.wikipedia.org/wiki/Physical:_Asia),
[whattowatch.com — Regeln](https://whattowatch.com/features/how-does-physical-100-work-the-rules-explained),
[Sportskeeda — Episoden 5/6, „Moving Sand"](https://www.sportskeeda.com/pop-culture/physical-100-episodes-5-6-recap-winning-teams-5-additional-survivors-third-quest),
[Dexerto — alle Quests Staffel 2](https://www.dexerto.com/tv-movies/physical-100-season-2-quests-games-explained-2599003/),
[Netflix Tudum — Staffel-2-Trailer/Set](https://about.netflix.com/news/physical-100-season-2-underground-trailer-sets-stage-for-extreme-competition).
