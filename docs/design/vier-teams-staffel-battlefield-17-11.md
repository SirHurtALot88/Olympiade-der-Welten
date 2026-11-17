# Vier Teams in der Arena, Staffel mit ganzer Runde, Battlefield mit fünf Punkten (17.11.)

Chris am 17.11., wörtlich:

- „in takeshi laufen alle gleichzeitig los was ok ist, aber dort sind gerade auch nur 2 teams - das
  sollte doch auch auf 4 teams angepasst sein?“
- „staffel sollte auch 4 teams haben genau wie battlefield und hat bisher auch nur 2 teams in der
  battle arena“
- „bei staffel laufen die spieler auch immer nur eine halbe runde das ist falsch, sondern jeder läuft
  eine ganze runde! Und dort ist puste anscheinend irrelevant weil alle ihre runde ohne probleme
  schaffen was unrealistisch ist weil sie ja alle sprinten!“
- „battlefield hat auch 0 dynamik. die area wo die punkte sind muss größer werden … 5 Punkte zum
  Dominieren … punkte farblich markieren … pro sekunde ein punkt (wie Overwatch/Domination) … spieler
  pixelgenau mit Teamfarbe umrahmen … Teams können sich aufteilen“

Drei getrennte Blöcke, jeder für sich übernehmbar. Matrix unangetastet, keine PixelLab-Bestellung.

| Block | Inhalt | Wertung | Fingerabdruck |
|---|---|---|---|
| 1 | Takeshi/Staffel/Battlefield zeigen in der Battle Arena immer die gebuchte Vierergruppe | unverändert | `e80babacb68c` (unverändert) |
| 2 | Staffel: ganze Runde je Läufer, Puste wirkt, Einteilung zählt | **geändert (nur Staffel)** | `19d252320d10`, nur 4 Staffel-Einträge anders |
| 3 | Battlefield „Domination mit fünf Punkten“ als Format-Umschalter | Standard unverändert | wie Block 2 (Standard `orte3`) |

---

## 1. Vier Teams in der Battle Arena (Takeshi's Castle, Staffel, Battlefield)

### 1.1 Befund: kein Motorfehler, eine Host-Annahme

Der Motor kann das Vier-Team-Rennen seit 02.11. (`bahnPodAnzeigeKontext`, `bfPodAnzeigeKontext`).
Der Host (`FoundationBattleArenaHost.tsx`) suchte die Vierergruppe aber nur am **aktuellen** Spieltag
(`getPodForTeam(…, matchdayId)`). Am Live-Abbild vom 17.11. (Spielstand „Oly New Game Custom“,
Saison 1, Spieltag 1) steht:

| Spieltag | Disziplinen | Pods |
|---|---|---|
| 1 | Climbing + **Battlefield** | Battlefield 8 × 4 |
| 2 | **Takeshi's Castle** + Tennis | Takeshi 8 × 4 |
| 7 | Eiskunstlauf + **Staffel** | Staffel 8 × 4 |
| 17, 19, 20 | Battlefield, Takeshi, Staffel (zweites Vorkommen) | je 8 × 4 |

Heute steht nur Battlefield an — darum zeigte Battlefield vier Teams, Takeshi und Staffel fielen im
Entwurfsreiter auf das Zwei-Team-Duell zurück. Genau Chris' Beobachtung.

### 1.2 Lösung

- **`lib/foundation/battle-arena/arena-pod-vorschau.ts`** (neu): `findeArenaPodMitVorschau()` sucht den
  Pod des Bezugsteams heute; gibt es keinen, den des **nächsten** Spieltags, an dem die Disziplin als
  Pod gebucht wird (sonst den letzten davor). Zurück kommt auch dessen `matchdayId` — der Host leitet
  daraus Saat (`buildBahnPodMatchSeed`/`buildBattlefieldPodMatchSeed`), k und Aufstellung ab, mit
  denselben Funktionen wie der zählende Lauf. **Gezeigt wird damit die Gruppe, die an jenem Spieltag
  gebucht wird** (solange sich Aufstellung/Kader bis dahin nicht ändern), keine erfundene.
- In der **Spieltags-Ansicht** (`spieltag` gesetzt) gilt weiter nur „heute“ (`nurHeute`).
- Die **Entwurfs-Vierergruppe** aus dem abgebrochenen Vorlauf (Heim, Gast, zwei weitere aus der Liste,
  ausdrücklich „nichts davon wird gebucht“) bleibt nur noch letzter Rückfall, wenn die ganze Saison
  keinen Pod kennt (kein Spielplan, Liga nicht durch 4 teilbar).
- Hinweistext nennt den Spieltag: „… gezeigt wird die gebuchte Vierergruppe von Spieltag 2 (Vorschau:
  die Disziplin steht heute nicht an) …“.
- **Motor, aus dem Vorlauf übernommen** (reine Anzeige): Vier-Team-Kopfleiste `#bahnPodLeiste` (ein
  Kästchen je Team mit Teamfarbe, Platz, Stand, „N im Ziel“, Streckenbalken, nach dem Ziel die
  Ligapunkte) statt der zwei DOM-Plätze, und je Anzeigefläche eine eigene Drossel-Uhr
  (`schnelldurchDomGedrosselt(flaeche)`) — vorher blieb die Kaderleisten-Mitte im Pod auf dem Stand vom
  Anpfiff stehen. CSS dazu in `public/mockups/battle-mode.css`.
- Namensschilder im Bahn-Pod: die Überlappung ist seit 16.11. (#1498) behoben; die Staffel-Wartezone
  ist in Block 2 neu gelegt (eine Zone, Block je Team).

Test: `tests/arena-pod-vorschau.test.ts` (heute / Vorschau / Rückblick / nurHeute / null-Fälle; der
Vorschau-Pod ist `toEqual` dem, den `getPodForTeam` für jenen Spieltag liefert).

Bilder: `vier-teams-17-11/takeshi-vier-teams.png`, `vier-teams-17-11/staffel-vier-teams.png`.

Fingerabdruck nach Block 1: **`GESAMT e80babacb68c (75 Einträge)`**, identisch mit main.

---

## 2. Staffel: jeder läuft eine ganze Runde, Puste wirkt

### 2.1 Befund

- **Halbe Runde:** `OVAL_BEINE_JE_RUNDE = 2` legte zwei Beine auf eine Runde (Übergabe an Ziellinie
  und Gegengerade). Dazu kam die Rundenzahl aus `BA().jeSeite` (immer 6) statt aus der echten Beinzahl
  — bei k = 4 (Liga, Pod) waren die Beine **0,75 Runden** lang, die Wartenden standen über drei
  Kurvenpunkte verteilt.
- **Puste irrelevant**, gemessen (`scripts/miss-bahn-puste.mjs 24 staffel`): Rest im Ziel **87,2 %**,
  **0,0 %** Einbrüche. Der Vorrat (`kraftBasis 230`) war für ein halbes Bein ausgelegt, und die drei
  Rennpläne liefen seit K2 alle mit Tempo 1,00 — „volles Tempo“ kostete nichts.

### 2.2 Mechanik (`BAHN_ART.staffel.rundePuste`, nur Staffel)

| Stellschraube | vorher | nachher | Wirkung |
|---|---|---|---|
| Anzeige | 2 Beine je Runde, Runden aus `jeSeite` | **1 Bein = 1 Runde**, Runden aus `u.beineGesamt` | Übergabe immer an der Ziellinie |
| `kraftBasis` | 230 | **60** (Spanne 2,4) | Vorrat hängt am Stehvermögen statt am Sockel |
| `kraftMix` (STEHEN-Anteil am Vorrat) | 0,7 | **0,45** (Rest ROBUST) | s. 2.4, Pod-Pp |
| `zehrKoeff` / `zehrExponent` | 1,9 / quadratisch | **4 / hoch 5** | 5 % weniger Tempo spart ~15 % Puste je Meter (anaerob) |
| `zehrFaktor` | — | **2,0** | Volllast leert den mittleren Läufer kurz vor der Linie |
| Fade (`fadeAb`, `fadeMin`) | — | **unter 35 % Rest stetig langsamer bis 0,72** | das „Sterben“ auf der Zielgeraden |
| `leerTempoBasis` | 0,74 | **0,86** | Restabschlag im Zustand „eingebrochen“ |
| Pläne | alle Tempo 1,00 | Angehen 1,00 ab 0 · Halten 0,95 bis 55 % · Schlussmann 0,96 bis 50 % | Einteilung ist eine Entscheidung |
| Planwahl | nach Slot | **nach eigener Puste** (`planNachPuste`, Schwelle 0,72) | kein Slot-Bias (K2 bleibt eingehalten) |
| `doppelMuedBoden` | 0,60 | **0,52** (nur Doppelläufer ab Bein 2) | s. 2.5 |

**Pacing ist gemessen eine echte Entscheidung** (`scripts/miss-staffel-runde-puste.mjs 24 --vergleich`,
jeder Läufer einmal Volllast, einmal eingeteilt, gleiche Saaten): bei quadratischen Kosten war „Halten“
für **keinen** Läufer schneller. Mit den neuen Kosten lohnt die Einteilung ab einer Selbsteinschätzung
(Volllast-Bedarf / Vorrat) von ~0,72 für die Mehrheit — darunter ist Volllast besser. Daher die
Schwelle. Die Rennplan-Ansage kann das im Rennen umwerfen.

Puste-Haushalt nachher (24 Rennen, 288 Läufer): tiefster Stand Median **5,6 %** (vorher 87 %),
**95,5 %** laufen in den Fade, **32 %** fahren den Tank ganz leer (Angehen 13 %, Halten 59 %), Renndauer
14,2 s statt 13,1 s.

### 2.3 Abnahme Duell (kaderfest, `miss-alle-disziplinen.mjs 24 staffel`, `messe-arena-einfluss.mjs staffel 96`)

| | vorher (main) | nachher |
|---|---:|---:|
| rho je Spiel (Median, Spannweite) | 0,924 (0,083) | **0,957 (0,019)** |
| rho Saison | 0,965 | 0,986 |
| Pp Strom 0 / 10 000 000 | 22,0 / 21,6 | **13,2 / 14,0** |

Pp-Profil nachher (Strom 0): Speed 26,5 (24), Stamina 17,3 (16), Spirit 16,3 (16), Awareness 11,0 (12),
Will 8,4 (8), Dexterity 7,5 (8), Determination 5,7 (4), Charisma 4,9 (10), Health 2,4 (2). Die Puste
reicht Stamina/Will/Spirit jetzt so durch, wie die Matrix es sagt. Charisma bleibt wie vorher zu leicht
(Restbaustelle, nicht durch diese Runde verursacht).

### 2.4 Abnahme Pod (`miss-bahn-pod-abnahme.mjs staffel 6 --je-seite=k --pp=48`, 210 Gruppen, zwei Ströme)

| | vorher k = 4 | nachher k = 2 | k = 4 | k = 6 |
|---|---:|---:|---:|---:|
| rho je Rennen (Median) | 0,926 / 0,930 | 0,926 / 0,925 | **0,921 / 0,922** | 0,954 / 0,951 |
| Gruppen < 0,80 | 2 · 2 | 0 · 0 | 1 · 1 | 0 · 0 |
| Pp (n = 48) | 16,7 / 15,1 | | **19,7 / 21,1** | |

Erster Anlauf mit dem alten Vorratsmix (0,7 STEHEN) fiel im Pod auf **27,5 / 26,8 Pp** durch (Stamina,
Will, Determination zu schwer, Dexterity/Awareness zu leicht — das Pod-Rezept legt Dex/Awareness in
ROBUST). Budget-Methode: der Vorrat liest jetzt 45 % STEHEN / 55 % ROBUST (`kraftMix`) — Pod 19,7 / 21,1,
Duell dabei sogar von 14,9/15,9 auf 13,2/14,0. Matrix unangetastet.

### 2.5 Unterbesetzte Staffel bleibt ein Nachteil

`tests/staffel-unterbesetzt-doppellauf.test.ts` wurde rot: mit bindender Puste ist der schwächste
frische Läufer so langsam, dass „der Beste läuft doppelt“ wieder öfter gewann (33 statt < 30 von 60).
Chris' Regel („wer doppelt läuft, behält seine Erschöpfung“) gilt jetzt härter: der Ermüdungsboden des
Doppelläufers ab seinem zweiten Bein liegt bei 0,52 statt 0,60. Test wieder grün (3/3). Voll besetzte
Staffeln erreichen die Zeile nie.

### 2.6 Fingerabdruck

```
alt  GESAMT e80babacb68c (75 Eintraege)
neu  GESAMT 19d252320d10 (75 Eintraege)
```

Geändert sind **genau vier Einträge**, alle Staffel: `spiele staffel 1/7/42` und `spieleBahnPod staffel`.
Alle anderen 71 Einträge sind byte-gleich. `tests/bahn-pod-vier-teams.test.ts` hält die neuen
Staffel-Hashes (Duell `ffcb5fa8568a8601`, Pod `7533f61ed6de70c0`), mit Herkunft im Kommentar.

---

## 3. Battlefield: Domination mit fünf Punkten (Format-Umschalter)

### 3.1 Warum ein Umschalter

Das gebuchte Battlefield (Gefecht je Ort, drei Orte, 02.11.) ist abgenommen und hängt an Referenzen
(`data/generated/battlefield-pod-referenz.json`). Fünf Punkte mit Respawn sind eine andere Wertung.
Deshalb: **`BATTLEFIELD_POD_FORMAT`** in `lib/battle/arena-resolved-disciplines.ts`, Standard
**`"orte3"`** (bit-identisch, Fingerabdruck unverändert), Alternative **`"domination5"`**. Eine Konstante
für Buchung **und** Anzeige: der Liga-Runner reicht sie als `optionen.format`
(`arena-headless-runner.ts`, `arena-node-runner.ts`), der Host als `echterKader.battlefieldPod.format`,
der Eingabe-Hash (`arena-eingabe-hash.ts`) nimmt sie auf — im Standard fehlt das Feld überall,
Eingaben und Hashes bleiben Zeichen für Zeichen die alten.

### 3.2 Mechanik (`bfd5Gefecht()`, eigene Funktion neben `bfffaGefecht()`)

- **Fünf Orte:** Nord (zwischen den oberen Ecken), West, Mitte, Ost, Süd. Jedes Team hat zwei
  Nachbarorte, die Mitte und zwei ferne — jede Ecke hat dieselbe Geometrie.
- **1 Punkt je Sekunde je gehaltenem Ort** (Takt 2 s, 45 Takte = 90 s), Schluss bei 160.
- **Respawn** statt Ausscheiden: nach 3 Takten (6 s) an der eigenen Ecke, dann zurück ins Spiel laufen.
- **Aufteilen und Wandern:** jedes Team plant jeden Takt neu. Wer nicht gebunden ist (Kampf, Erobern,
  Abwehr, einziger Halter), geht zum lohnendsten Ort: fremde vor bedrohten eigenen vor neutralen, minus
  Weg, eigene Kämpfe verstärken bis Gleichstand, nicht stapeln, aussichtslose meiden, Orte des
  Führenden lohnen mehr (FFA-Druck auf den Ersten).
- **Kampf, Eroberung, alle neun Matrix-Kanäle** wie im Gefecht je Ort (`bfffaKaempfer`, Schlagwechsel
  je Ort, `kpTick`-Regel), auf 2-s-Takte umgerechnet; die Wucht ist erhöht (`schaden 2,2`, 1v1 fällt
  nach ~12 s), die Kampfrichterwertung je Schaden ist auf das alte Maß zurückgerechnet.
- **Anzeige:** große Zonen (Ellipse 128 × 59 px), gefüllt und umrandet in der Farbe des Besitzers,
  neutral gestrichelt, Eroberungsbogen in der Angreiferfarbe, Name „West · Cold Steel“; Kämpfer stehen
  im Viertel ihres Teams am Ort; **pixelgenaue Teamfarben-Kontur** um jede Figur (Silhouette per
  `source-in` eingefärbt, achtfach versetzt unter die Figur); K.o. mit „in 6 s zurück an der Ecke“,
  Respawn mit „zurück im Spiel“.

Sonde (`scripts/probe-battlefield-domination5.mjs 12`, k = 4): im Mittel **8,3 Besitzwechsel**,
37,5 K.o., 35 Respawns, 2,6 Ortswechsel je Kämpfer, jedes Team gleichzeitig an **2,2 Orten**,
Spieldauer 67 s (meist durch das Punktelimit).

### 3.3 Abnahme (`miss-battlefield-pod-ffa-abnahme.mjs 4 --gruppen=30 --format=domination5`, zwei Ströme)

| k | rho je Kampf (Median) | Gruppen < 0,80 | bestes Team 1. | Pp (n = 48) |
|---|---|---|---|---|
| 2 | 0,866 / 0,878 | 6 · 5 von 30 | 67 / 70 % | 10,6 / 10,9 |
| 3 | 0,893 / 0,885 | 1 · 4 | 68 / 73 % | 12,1 / 7,2 |
| 4 | **0,911 / 0,909** | 0 · 0 | 73 / 75 % | **8,0 / 9,4** |
| 5 | 0,927 / 0,926 | 0 · 0 | 72 / 71 % | 8,7 / 7,3 |
| 6 | 0,941 / 0,935 | 0 · 0 | 71 / 68 % | 7,3 / 5,6 |

Zum Vergleich das abgenommene Gefecht je Ort (02.11.): 0,873/0,861 … 0,922/0,923, Pp 4,8–20,2. Beide
Pflichtkriterien bestanden, Pp überall unter dem Optimum 15.

**Gezeigt = gebucht** im neuen Format: `tests/battlefield-domination5.test.ts` (Replay endet exakt im
gebuchten Endstand: Platz, Punkte, Stehende, Ligapunkte; Standard `orte3` mit und ohne Option
byte-gleich; fünf Orte, 2 Punkte je Takt und Ort, Respawn, Aufteilen, Besitzwechsel).

Bilder: `vier-teams-17-11/battlefield-domination5.png` (fünf Punkte, Kampfzeit 34 s),
`vier-teams-17-11/battlefield-orte3-standard.png` (Standardformat zum Vergleich).

### 3.4 Empfehlung

Chris soll das Format einmal ansehen; danach `BATTLEFIELD_POD_FORMAT = "domination5"`. **Vor dem
Umschalten** (gleicher PR): `scripts/ziehe-battlefield-pod-referenz.mjs` neu ziehen (Spieler-PP-
Perzentile hängen an der Verteilung der Kampfrichterwertung) und `data/generated/disziplin-abnahme.json`
(„battlefield“) mit der Tabelle oben nachführen; der Fingerabdruck bleibt davon unberührt, weil er das
Standardformat misst.

---

## 4. Offen / bewusst nicht in dieser Runde

- Vor dem Anpfiff zeigt das Intro-Overlay im Pod weiter nur Heim und Gast („6 gegen 6“).
- Die Wertungstabelle rechts heißt im Bahn-Pod weiter „Eigenes Team / Gegner“ (links Teams 0/2,
  rechts 1/3).
- Mini-DM nutzt die Vorschau-Suche noch nicht (gleiches Muster, keine Meldung von Chris).
- Staffel-Charisma bleibt im Duell bei ~5 % statt 10 (vorher ebenso).

## 5. Werkzeuge

| Skript | Zweck |
|---|---|
| `scripts/miss-staffel-runde-puste.mjs [rennen] [json] [--vergleich]` | Puste-Haushalt der Staffel, Pacing-Vergleich |
| `scripts/probe-battlefield-domination5.mjs [laeufe] [--d5=json]` | Dynamik des Fünf-Punkte-Formats |
| `scripts/miss-battlefield-pod-ffa-abnahme.mjs … --format=domination5` | rho/Pp im neuen Format |
| `scripts/screenshot-battlefield-pod.mjs <orte3\|domination5> <png> [ms] [--vorspulen=s]` | Bild Battlefield-Pod |
| `scripts/screenshot-bahn-pod-teams.mjs`, `scripts/probe-bahn-pod-hud.mjs` | Bild/Sonde Bahn-Pod (aus dem Vorlauf) |
