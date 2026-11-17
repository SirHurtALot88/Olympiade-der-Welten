# Offene Punkte: Entscheidungen (17.11.)

Chris am 17.11., wörtlich: „kläre noch die offenen punkte, rückfragen klärt opus“. Dieses Papier
entscheidet die offenen Rückfragen der Runden vom 17.11. stellvertretend. Bei Chris bleibt nur, was
Spielregeln auf Spielstandebene, neue Figuren oder Animationen oder Ausgaben über die freigegebenen
Budgets betrifft (Abschnitt 8, drei Ja/Nein-Fragen).

**Rahmen, gilt für jede Entscheidung unten** (CLAUDE.md):

- Die Matrix bleibt gesperrt.
- rho je Spiel: harte Mindestschranke 0,75, Ziel > 0,80, angestrebt 0,85.
- Pp ≤ 25 auf zwei Strömen, Ziel < 15, aber nie auf Kosten von rho.
- Keine neue Figur und keine neue Figuren-Animation ohne Freigabe. Requisiten, Kulissen und
  VFX-Effekte dürfen bestellt werden (VFX freigegeben am 17.11., „effekte -> ja“).
- Anzeige-Arbeit lässt den Wertungs-Fingerabdruck unverändert.

Wo etwas nicht belegt ist, steht **Annahme** davor.

Quellen:

- `strategie-pilot-hyrox-in-game-17-11.md`
- `hyrox-optik-konzept-17-11.md` und PR #1550 (`claude/hyrox-optik-b-17-11`)
- `pixellab-nur-neue-assets-audit-17-11.md`
- `pixellab-hud-effekte-schiri-plan-17-11.md` und PR #1551 (`claude/pixellab-effekte-h1-v2-17-11`)
- `kontakt-persoenlichkeit-16-11.md` mit Abschnitt 11 aus PR #1549 (`claude/kontakt-scharf-spurt-17-11`)
- `i-spy-schatzsuche-konzept-21-09.md`
- PR #1544 und PR #1545
- PixelLab-API, nur lesend abgefragt am 17.11. gegen 08:10 UTC: `GET /balance`, `/characters`,
  `/vfx/effects`, `/objects`

---

## 0. Merge-Reihenfolge und Fingerabdruck (gilt vor allem anderen)

**Frage:** PR #1549 schaltet den Kontakt im Spurt scharf. Damit bricht der Fingerabdruck bewusst von
`e80babacb68c` auf `7c9257b4435c`. Die drei Anzeige-PRs #1544, #1550 und #1551 prüfen aber gegen
`e80babacb68c`.

**Entscheidung:** Zuerst die Anzeige-PRs mergen, in der Reihenfolge #1544 (mit der Fegearm-Korrektur
aus 6.6), #1551, #1550. Jede wird vor dem Merge gegen `e80babacb68c` geprüft. **Danach #1549.** Im
selben PR werden nachgezogen:

- die Fingerabdruck-Zeile in CLAUDE.md, neu `GESAMT 7c9257b4435c (75 Einträge)`;
- der Kopf von `scripts/pruefe-wertung-fingerabdruck.mjs`;
- `data/generated/disziplin-abnahme.json` und `stand-aller-disziplinen.md`.

**Begründung:** Würde #1549 zuerst gemergt, müssten alle drei Anzeige-PRs neu gegen eine andere Zahl
geprüft werden. In dieser Reihenfolge prüft jede PR gegen die Zahl, mit der sie gebaut wurde. Der
Bruch in #1549 betrifft nachgewiesen nur `spurt 1` und `spurt 7` (Abschnitt 11.3).

**Wer und wann:** der nächste Merge-Agent in Runde 1. 0 Gen.

---

## 1. HYROX Optik B, PR #1550 (Punkt a)

### 1.1 Dark-Fantasy-Bögen für IN und FINISH

**Frage:** Die bestehenden `spurt_bogen_in` und `spurt_bogen_finish` sind moderne Event-Bögen.
Neu bestellen?

**Entscheidung:** Ja, zwei Bögen im Stil des Gladiatoren-Trainingshofs, zum Beispiel ein Holz- und
Eisentor mit Feuerschalen. Prompt-Familie und Saat 11 wie die Arena. Klassischer Spurt und Hatz
behalten die alten Bögen.

**Begründung:** Chris' Entscheid 3 lautet „näher an der Figurenwelt“. Ein moderner Aufblasbogen in
einer Dark-Fantasy-Arena ist genau der Stilbruch, den Prüfpunkt 4 und 5 des Zielbilds ausschließen.

**Wer und wann:** zusammen mit HYROX C1 (Runde 3), aus dem Topf HYROX C. Obergrenze **30 Gen.** für
beide Bögen, Ziel 2 × 13.

### 1.2 Belagskachel für die Laufrunde

**Frage:** Der Ring-Belag ist heute Canvas-Fläche. PixelLab-Kachel bestellen (~13 Gen.)?

**Entscheidung:** Ja, eine nahtlose Kachel 64×64. Die gelbe Roxzone-Linie, die Bahnlinien und die
Mattenränder bleiben Canvas.

**Begründung:** Nach Audit und Zielbild ist ein Boden ein Asset, kein Marker. Eine einfarbige
Canvas-Fläche ist „Material“ statt „Rahmen“, also ein Rest des alten Looks. Linien tragen
Spielinformation und bleiben Code.

**Wer und wann:** mit HYROX C1 (Runde 3), Topf HYROX C, **15 Gen.**

### 1.3 Maßstab-Streckung 1,57

**Frage:** Die Arena 792×300 wird auf 1240×470 gezogen. Das ist kein ganzzahliger Faktor.

**Entscheidung:** **Bleibt so.** 1,57 ist der festgelegte Kulissen-Standard des Zielbilds (5.1). I-Spy
und Welle A Batch 1 laufen schon darauf. Ganzzahlig müssen nur zwei Dinge sein:

- der Kamera-Zoom (Variante C: 2×, Figuren und Kulisse gemeinsam);
- die Requisiten, die in Leinwandpixeln bestellt und 1:1 gezeichnet werden.

**Begründung:** Eine ganzzahlige Lösung wäre etwa 620×235 mal 2. Sie hieße, alle 11 bisher gebauten
Breitformate neu zu bestellen (~300 Gen.), und das für einen Unterschied, den bei 1,57 kaum jemand
sieht.

**Wer:** niemand, 0 Gen.

### 1.4 Gerätekapazität und Stau

**Frage:** Die Optik zeigt 4, 3 und 4 Bahnen je Insel, die Sim kennt aber keine Kapazität.

**Entscheidung:** Bis zu X3 (Abschnitt 5) bleibt die Anzeige ehrlich:

- Die Läufer werden auf die Bahnen verteilt. Sind mehr da als Bahnen, wird geteilt.
- Das Inselschild zeigt keine „wartet“-Zahl.
- Wartefelder, Pylonen und die Stau-Anzeige kommen erst mit X3 und X4, als HYROX C2.

**Begründung:** Gezeigt = gebucht. Ein „2 warten“ ohne Mechanik würde lügen.

### 1.5 Variante C

**Entscheidung:** C wird in zwei PRs geteilt. Gesamtobergrenze **70 Gen.**, innerhalb der von Chris
freigegebenen 40–90.

| Teil | Inhalt | Wann | Gen. |
|---|---|---|---:|
| **C1** | Ganzzahliger Regieschnitt 2× (`HYROX_REGIE_AN` wird zum echten Schnitt ohne stufenlosen Zoom), Läuferwahl per Klick (Muster Zeitfahren Rework 2), Inset mit der Totalen. Dazu die Bögen (1.1) und die Kachel (1.2) | Runde 3, nach dem Merge von #1550 | ≤ 45 |
| **C2** | Wartefelder, Stau-Anzeige, Pylonen und Kreideeimer (2 × 13), 2 VFX lite (Schweiß, Aufprall-Staub, je 1) | mit X3 und X4 (Runde 4–5) | ≤ 25 |

Das Nahbild je Insel (+75–84 Gen.) entfällt.

**Begründung:** C1 braucht keine Mechanik und behebt den letzten Diagnosepunkt (Nähe bei Duellen).
C2 hängt am Stau. Ohne ihn wäre C2 Dekoration ohne Bedeutung.

---

## 2. Schiri und Effekte H1, PR #1551 (Punkt b)

### 2.1 Fouls im Football

**Frage:** Football hat im Motor keine Fouls. Eine Sim-Regel bauen, oder bleibt die Geste an
Touchdown und Field Goal?

**Entscheidung:** **Die Geste bleibt vorerst an Touchdown und Field Goal.** Fouls entstehen erst mit
**Kontakt-Schritt 2 Football** (Abschnitt 3.1). Dort ist „Foul aus DI, 15 Yards“ schon geplant und
geht durch die volle Abnahme (rho, Pp, Kriterien A–V). Ab dann pfeift der Schiri auch Fouls. Eine
eigene Foul-Regel nur für den Schiri wird nicht gebaut.

**Begründung:** Eine Regel nur fürs Bild wäre eine neue Wertungsmechanik ohne Abnahme. Im
Kontakt-Strang entsteht sie ohnehin, gemessen und aus der Persönlichkeit begründet. Die heutige
Geste entspricht dem realen Torsignal und lügt nicht.

**Wer und wann:** der Agent für Kontakt Football (Runde 3). 0 Gen.

### 2.2 Bodenstaub und Eisstaub kaum sichtbar

**Entscheidung:** Zuerst die Anzeige reparieren, ohne Neubestellung:

- ganzzahlig 2× zeichnen;
- volle Deckkraft;
- über der Bodenebene und unter den Figuren zeichnen.

Erst wenn eine Sichtprüfung (Screenshot) danach immer noch nichts zeigt, die `pro`-Fassung bestellen
(2 × 6 Gen.). Das geht aus dem Topf H2.

**Begründung:** `lite` hat bei Funken und Spritzern getragen. Das Problem ist wahrscheinlich Größe
oder Ebene, nicht das Bild. **Annahme**, nicht geprüft.

**Wer und wann:** ein Folge-Commit auf #1551 oder eine kleine Anzeige-PR in Runde 2. 0 Gen., höchstens
12.

### 2.3 Pfeil-Projektil E6 und Stern-Icon U1

**Entscheidung:** Beide werden bestellt, aber im Topf H2, nicht vorgezogen.

- **U1 zuerst**, 13 Gen. Der Stern ist dauernd sichtbar in I-Spy und Takeshi und auch im DOM nutzbar.
- **E6 danach**, 13 Gen. Neutral bestellen und den Schaft zur Laufzeit tönen.

**Wer:** Runde 5, Topf H2.

### 2.4 Restfragen aus dem Plan, Abschnitt 6

| Frage | Entscheidung |
|---|---|
| Stufe der VFX | Standard ist `lite` (1 Gen.). `pro` (6 Gen.) nur, wenn `lite` im Bild nachweislich dünn oder klumpig ist, wie bei Feuerwerk, Konfetti und Funken |
| Teamfarben | Einfärben zur Laufzeit (Offscreen-Canvas, `source-atop`, Cache je Farbe) ist erlaubt. Effekte mit variabler Länge (Strahl E5, Welle E3 ab r > 60) bleiben Code |
| U8 HYROX-Stationsicons (91 Gen.) | **Nein.** Die HYROX-Arena zeigt die echten Geräte schon als Requisiten, und die Zeitleiste hat Marken in Gruppenfarbe |
| U9 DOM-HUD-Rahmen (~45 Gen.) | **Nein, vorerst.** Der Preis ist nicht dokumentiert, es betrifft den ganzen Broadcast-Look, und das Budget reicht nicht (Abschnitt 4) |
| PixelLab-MCP `vfx_workbench` | **Nein.** Der Rest der VFX kostet mit `lite` ~5 Gen. Eine neue Werkzeuganbindung lohnt dafür nicht |
| Schiri-Umfang | Erledigt, S-empf. ist gebaut (Pfiff S/O/N, Walk S/O/N; `animation_count` 6 laut API). **Keine weitere Animation**, das bleibt kein Muster für andere Figuren |

---

## 3. Kontakt, PR #1549 (Punkt c)

### 3.1 Reihenfolge der weiteren Disziplinen

**Entscheidung:** Die Reihenfolge aus 11.4 wird übernommen, mit einer Änderung bei HYROX. Je
Disziplin eine PR, Abnahme vorher und nachher nach 11.1. Der Fingerabdruck-Diff darf nur die
eigene Disziplin zeigen.

| Rang | Disziplin | Bemerkung |
|---|---|---|
| 1 | **Takeshi** | gleicher Codepfad, größter Messgewinn. Der Mini-Stun kostet keine Nerven |
| 2 | **Football** | Tackle-Stil aus HÄ, KB im Tackler-Los, Foul aus DI (Abschnitt 2.1) |
| 3 | **HYROX = Strategie-Pilot X3** | **Kontakt an den Stationen (Stau, Drängeln), nicht auf den Laufstücken** (Abschnitt 5, Frage 2). Das ersetzt die Zeile „HYROX nur auf Laufstücken“ aus 11.4 |
| 4 | **Hatz** | Sperre in den letzten Metern jeder Welle, höchstens ein Sturz je Welle |
| 5 | Battlefield-Pod | Verdrängen vom Punkt ersetzt einen Angriff |
| 6 | Basketball | zuerst nur Statistik (wer ausboxt) |
| — | Hockey | erst wenn die Hockey-Abnahme (6.5) wieder Puffer hat |
| — | TDM, I-Spy | nur Bild |
| — | Climbing | nur Bild, wegen rho 0,801 |
| — | Eiskunstlauf | nach „vier Aktive anzeigen“ |

**Begründung:** Die Reihenfolge folgt Aufwand gegen Puffer. Zum Wechsel bei HYROX: An der Station
drängelt man im echten HYROX, auf den Läufen kaum. Der Stau liefert zugleich den Gegnerbezug, den
der Knopf-Test des Strategie-Piloten braucht. So entsteht nur **eine** HYROX-Kontaktmechanik, nicht
zwei.

### 3.2 pMin je Typ

**Entscheidung:** **Nicht verändern.** Die Haltungsstufen bleiben wie gebaut. Kriterium N besteht
geclustert (jeder Typ innerhalb von etwa 1 SE, eps² 0,028).

Nachgesteuert wird nur nach einer festen Regel: In einer Folge-Disziplin hat ein Typ geclustert
|t| > 2 im **Platz**. Dann wird `pMin` genau dieses Typs um eine Haltungsstufe verschoben, als
Kandidaten zuerst Beschützer und Schleicher (11.2). Ab Takeshi wird N je Disziplin mit derselben
Sonde gemessen. Die Sonde wandert als Skript ins Repo (`scripts/miss-kontakt-neutralitaet.mjs`).

**Begründung:** Die ungeclusterten Ausreißer (Beschützer −0,20 Plätze) sind Folgen der
Kostenlogik und kommen im Platz nicht messbar an. Ein Eingriff ohne Befund wäre Überanpassung.

### 3.3 Pp der Spurt-Mischung 22,0

**Entscheidung:** **Angenommen**, besteht (≤ 25), kommt aber auf die Beobachtungsliste mit
Auslöser.

- Jede PR, die klassischen Spurt, Hatz oder HYROX berührt (auch X2 und X3), misst die Mischung mit
  `--pp=48` auf beiden Strömen nach.
- Steigt ein Strom über **23,5**, wird die PR schwächer gebaut, bevor sie gemergt wird.
- Nach Pp optimiert wird nicht, solange rho der Mischung ≥ 0,843 bleibt.

**Begründung:** Es bleiben 3 Punkte Puffer. HYROX ist ein Drittel der Mischung, und HYROX-Pp (20,2/20,5)
ist alt. Deshalb ist X0 Pflicht.

### 3.4 Abschnitt 9 des Kontakt-Konzepts (stand noch als Frage an Chris)

| Frage | Entscheidung |
|---|---|
| Persönlichkeit nur als Stil? | **Ja.** Kriterium N ist Pflicht je Disziplin. Folgt aus der Matrix-Hälfte der CLAUDE.md („ein Spieler mit 80 …“) |
| Wie weh tut ein Fehlschlag? | 0,3 s plus Puste, wie gebaut. Kleiner wird es nur bei gerissener Schranke |
| Climbing | Nur Bild |
| Fouls im Rennen | Ja, als Stufe 3, gebaut (0,21 je Rennen) |
| Neue Pose „Niedergehen und Aufstehen“ | **Nein.** Der Behelf bleibt (gekippte Treffer-Pose). Neue Animationen sind gesperrt. Ein Vorschlag mit Kostenschätzung kommt erst, wenn Chris das Bild bemängelt |

---

## 4. PixelLab-Budget (Punkt d)

### 4.1 Befund

Der Kontostand wurde am 17.11. um 08:09 UTC gelesen: **1041,7 Gen.** (Tier 3, Abo aktiv, USD 0).
Er stand bei der zweiten Abfrage still. Die API bietet **keine** Abrechnungs- oder Jobliste für
`generate-image-v2`. Lesbar sind nur Figuren, Objekte und VFX samt Zeitstempel.

| Zeitraum | Abbuchung | Belegt | Ungeklärt |
|---|---:|---|---:|
| 1677 → 1506 | 171 | Welle A Batch 1: 6 × 25 = 150; Schiri-Basis 10 + Pfiff S/O 2; Hieb-Bogen pro 8 + lite 1. Zusammen **171**, geht auf. Die I-Spy-Tür (10, #1541) lag also vermutlich vor der Audit-Messung (**Annahme**) | 0 |
| 1506 → 1041,7 | 464 | HYROX B 110 (gemeldet); Schiri Pfiff N plus Walk ~4; VFX laut API-Liste 10 weitere Effekte: 3 × pro (18) + 7 × lite (7) = 25. Zusammen **~139** | **~325** — **nachträglich geklärt (Koordinator, 17.11.):** Welle A Batch 2 meldete danach 13 Aufträge à 25 = **325 Gen.** (Job-Abrechnung `usage.generations`); 1506 − 110 − 29 − 325 = 1042 ≈ gemessene 1041,7. Es gibt keinen Hinweis auf Doppelabrechnung; die Bestellregeln unten bleiben trotzdem gültig (kein Wiederholen von POSTs) |

Was die API zeigt:

- Seit dem 16.11. gibt es genau **eine** neue Figur, den Schiri (`animation_count` 6), und keine
  weiteren Figuren.
- Es gibt **keine** neuen Objekte.
- Es gibt 12 VFX-Effekte.

Es wurde also keine verbotene Figur bestellt. Die Lücke liegt bei `generate-image-v2` (Kulissen und
Requisiten).

### 4.2 Mögliche Ursachen

**Wahrscheinlichste Ursache, im Code gefunden:** `scripts/lib/pixellab_api.py` `api()` wiederholt
**jeden** Aufruf bis zu dreimal, auch ein POST:

- bei `URLError` und `TimeoutError` (Zeitlimit 180 s);
- bei HTTP 5xx.

Hat PixelLab einen Auftrag angenommen und die Antwort kommt zu spät, wird er ein zweites Mal
bestellt und **doppelt abgerechnet**. Bei Breitformaten (25 Gen., lange Laufzeit) ist das am
wahrscheinlichsten.

Weitere mögliche Ursachen:

- Ein paralleler Bestell-Agent, etwa ein schon gestarteter Batch 2 (**Annahme**). Der Fall von
  ~1117 auf 1041,7 nach dem letzten Bericht spricht dafür.
- Verworfene Versuche, die in den Berichten fehlen.

**Ergebnis:** Die Lücke lässt sich mit der API nicht weiter aufklären. Belegt ist nur, dass weder
Figuren noch Objekte die Lücke erklären.

### 4.3 Bestellregeln, ab sofort

1. **Ein Besteller zur Zeit.** Nur ein Agent bestellt gleichzeitig. Er schreibt das in seine PR,
   und andere Agenten bestellen in der Zeit nicht.
2. **Jeder Auftrag wird gebucht.** Vorher und nachher wird der Kontostand gelesen. In
   `auswahl.json` bzw. `pixellab-vfx/roh/` stehen dann die Felder `gen_vorher`, `gen_nachher`,
   `quoted` und `datum`. Die PR meldet die Summe aus den Kontoständen, nicht die angesetzten Kosten.
3. **Kein Wiederholen eines POST.** Gilt bei Zeitüberschreitung, Netzfehler und 5xx. Stattdessen
   wird der Kontostand gelesen. Ist er gefallen, wird der Auftrag als ausgeführt behandelt und über
   die Job-ID abgeholt. 429 darf wiederholt werden. Die Codeänderung (0 Gen.) gehört in Runde 1.
4. **Reserve 150 Gen.** Sie wird nicht angetastet. Fällt der Kontostand auf 150, stoppen alle
   Bestellungen (Nachkauf: Frage 3 in Abschnitt 8).
5. **Obergrenze je Topf.** Sie gilt einschließlich Fehlversuchen. Wer sie erreicht, hört auf und
   meldet, statt zu überziehen.
6. **Zuerst den Bestand prüfen.** Vor jedem Auftrag `data/generated/pixellab-requisiten/roh/`
   und die Liste in 6.3 durchsehen.

### 4.4 Töpfe für die Restwellen

Planungsbasis 1040 Gen., minus 150 Reserve: **890 Gen. verfügbar.** Der Basisweg aller Wellen
(Audit plus Plan, rund 1090–1580) passt nicht hinein. Deshalb wird gekürzt:

- vier zweite Kulissen-Varianten vorerst aus der Rotation (A0, 0 Gen., erfüllt „nur PixelLab“);
- U5, U8 und U9 entfallen;
- Welle C nur im Kern.

| # | Topf | Inhalt | Obergrenze |
|---|---|---|---:|
| 1 | **A Batch 2** | 7 Breitformate à ≤ 28: Wettessen nachtmarkt, Gewichtheben hafen, Fechten schlosshof, Showcase festival, Battlefield wuestenruine, Speed-Schach park (Schach hat sonst keine nutzbare PixelLab-Kulisse, `turniersaal` hat eingebrannte Partien) und die **Nachbestellung Football strand** („very thin strip at the very top edge only“). **A0** (aus `battle-mode.kulissen.js` nehmen) für Wettessen bierzelt, Gewichtheben oase, Schach zug und den Showcase-Zirkusrahmen | **200** |
| 1b | **A Climbing** | zuerst **eine** senkrecht nahtlose Probe (fels). Nur wenn sie trägt, folgt eis. Trägt sie nicht, gehen fels und eis auf A0, und Climbing behält `wand` | **60** |
| 2 | **B** | in Audit-Reihenfolge: Zeitfahren 52, Wettessen 52 plus **leerer Teller 24×16** (13, deckt alle fünf Gerichte), Gewichtheben 65, Climbing 39, Breaking 26, Showcase 39, Hockey Tor und Strafbank 26 (die Strafbank nur einmal, U7 entfällt), Takeshi-Trittsteine 13, Tennis-Netz 13. **Hinter die Obergrenze** und erst nach einer Abo-Auffüllung: Fahnenmast, Schachuhr, Kiss-and-Cry | **340** |
| 3 | **C Kern** | Puck 13, Kampfrichterlampen 13, Spurt-Kopf- und Fußstreifen 25 (klassischer Spurt bleibt bei `kurs.jpg`, weil Chris' Entscheid 1 ihn nicht umziehen lässt). **Keine** Zuschauerreihe (figurennah), keine Handgeräte, keine Rückfall-Kacheln | **55** |
| 4 | **HYROX C** | C1: Bögen 30, Kachel 15. C2: 2 Requisiten 26, 2 VFX lite (Abschnitt 1.5) | **70** |
| 5 | **H2** | U1 Stern 13, E6 Pfeil 13, U2 ✓/✗ 26, U3 13, U4 13, U6 13; VFX E2, E3, E4, E12, E13 als `lite` (5). Wenn nötig Staub `pro` (12, Abschnitt 2.2). U5, U8 und U9 entfallen | **100** |
| | **Summe** | | **825** (65 unter dem Verfügbaren) |

Die Reihenfolge der Töpfe ist 1 → 1b → 2 → 3 → 4 → 5. Ausnahme: HYROX C1 darf vor Topf 3 laufen,
weil die PR dafür früher fertig ist. Die Obergrenze ändert sich dadurch nicht.

**Annahme:** Wann das Abo auffüllt, ist nicht ermittelt. Die API nennt `total: 18387` ohne Datum.
Kommt eine Auffüllung, rücken die Posten hinter der Obergrenze und die A0-Varianten nach. Sonst wird
nichts nachgekauft.

---

## 5. Strategie-Pilot HYROX (Punkt e)

### 5.1 Die fünf offenen Fragen des Konzepts (Abschnitt 5)

| # | Frage | Entscheidung | Begründung |
|---|---|---|---|
| 1 | Eine neue Mechanik bauen? | **Ja.** Zuerst die Einteilung (X2) als kleinster spielbarer Pilot, dann der Stau (X3) | Ohne Mechanik bleibt jeder Knopf tot. Chris will ausdrücklich Taktik im Rennen |
| 2 | Kontakt an den Stationen statt auf den Läufen? | **Ja** (auch Abschnitt 3.1). Laufstücke bleiben kontaktfrei | So ist es im echten HYROX. Es ist der einzige Gegnerbezug, und es gibt nur eine Mechanik statt zwei |
| 3 | Wie genau ist die Erklärung? | Mechanik-Zahlen, Verhaltenszahlen und ▲/▼ je Läufer. **Keine Sekunden-Projektion, kein Rang** | Bei HYROX ist die Zeit das Ergebnis. Eine Sekunden-Summe machte die Wahl zum Rechenknopf |
| 4 | Echte Wahl beim Zuschauen? | Zuerst Zuruf-Plan und Live-Chips in der Battle Arena (X1–X5). **X6 erst nach Chris' Ja** (Abschnitt 8, Frage 2) und nach Prüfung (a) und (b) aus 3.2 | Ob ein live gewählter Ast gebucht wird, ist eine Spielregel auf Spielstandebene: Wer zuschaut, kann eingreifen |
| 5 | Folgen Persönlichkeiten unterschiedlich? | **Ja**, deterministisch: wild ×1,25, ausgewogen ×1,0, vorsichtig ×0,8, defensiv ×0,7. `Renegade`, `Feisty` und `Diva` setzen Ruhe-Zurufe nur zur Hälfte um, `FiredUp` setzt Druck-Zurufe zu 150 % um, alles geklemmt auf 5…95 | Das ist genau „wirkt auf die Persönlichkeit“. Die Einteilung ist für ein Median-Profil zeitneutral, der Faktor verstärkt Gewinn **und** Preis. Gesichert über Kriterium N (5.3) |

Weitere Festlegungen:

- **Menü:** wie im Konzept. Vor dem Rennen zwei Schalter mit je drei Stufen (Renneinteilung,
  Umgang). Im Rennen zwei Zuruf-Fenster (nach Runde 1 und nach Runde 2) mit je **einem** Zuruf aus
  fünf. Die Intensität bleibt die Kraft-Reihe vor dem Rennen. Keine Option heißt „Push“.
- **Abbruchregel:** Reißt die dritte Stufe ein Kriterium, sind zwei Stufen erlaubt (Freigabe
  17.11.). Fällt X3 durch, geht X2 allein in Produktion.
- **Format in der App bekannt machen:** Der Hash `kulisseHash("spurt-format|"+saat)` wird **nach TS
  portiert**. Ein Paritätstest hält ihn mit dem Motor gleich. Die Rückmeldung aus dem Vorlauf wird
  nicht genutzt. Grund: Die Einsatzliste muss die Wahl vor dem Vorlauf zeigen.
- **KI-Teams:** Bis zur Abnahme bekommen sie keinen Plan. Danach eine feste Regel aus Kaderprofil
  (Laufanteil, STEHEN, WUCHT) und Lage, ohne Wurf.
- **Wettessen-Pilot:** bleibt im Code, wird nicht freigeschaltet. Der Katalog bekommt in X1 das Feld
  `freigegeben`, für Wettessen steht es auf aus.

### 5.2 Bau-Reihenfolge

| Schritt | Inhalt | Runde | Voraussetzung |
|---|---|---|---|
| **X0** | HYROX nachmessen: rho n=48 und Pp 192 auf zwei Strömen, `OLY_FORM_MODUS=echt`, dazu die Spurt-Mischung `--pp=48`. Ergebnis nach `disziplin-abnahme.json` | 1 | keine |
| **X1** | Gerüst: Katalog `spurt`/HYROX, TS-Port des Format-Hashs, WeakMap, Messschalter `--strategie` und `--zuruf`, Zuruf-Plan in Umschlag und Hash, Feld `freigegeben` | 2 | X0, und #1550 gemergt (gleiche Motor-Region) |
| **X2** | Einteilung A1 mit Persönlichkeitsfaktor; Zurufe „Jetzt laufen!“ und „Kräfte für die Station“ | 3 | X1 |
| **X3** | Stau und Drängeln = Kontakt 1b HYROX. Eigene Flagge, eigene Abnahme, eigener Fingerabdruck-Bruch beim Scharfschalten | 4 | X2 bestanden; Kontakt Takeshi und Football gemergt (Muster bestätigt) |
| **X4** | Umgang A2 und die drei Kontakt-Zurufe; Live-Chips in der Battle Arena; dazu HYROX C2 | 5 | X3 |
| **X5** | Einsatzliste: zwei Reihen, Zuruf-Plan, Wirkungskasten, Bilanz im Endstand | 5 | X4. #1358 (Einsatzlisten-Revamp) vorher gemergt oder rebased |
| **X6** | echte Wahl beim Zuschauen | später | Chris' Ja (Abschnitt 8, Frage 2) und Prüfung (a) und (b) |

### 5.3 Messkriterien (Abnahme je Schritt)

| Prüfung | Kriterium |
|---|---|
| Fingerabdruck | X1, und X2 bis X5 bei fehlendem Feld bzw. Flagge aus: identisch mit der dann gültigen Zahl (nach #1549 `7c9257b4435c`), HYROX 1/7/42 unverändert. X3 beim Scharfschalten: Bruch **nur** in den HYROX-Zeilen, neue Zahl in CLAUDE.md und im Skriptkopf |
| rho je Spiel, je Option und je Zuruf | **≥ 0,75 hart**, Ziel > 0,80. Regressionswächter: ≥ Ist(X0) − 0,03, gepaart gegen neutral in ≥ 4 von 5 Kadern |
| Spurt-Mischung | rho ≥ 0,843; Pp ≤ 25 auf beiden Strömen, mit Auslöser 23,5 (3.3) |
| Pp je Option, einzeln | ≤ 25 auf beiden Strömen, Ziel < 15, nie auf Kosten von rho |
| Star und Paartreue | Star auf Rang 1 höchstens 5 Pp schlechter; Paare ≥ 15 Punkte höchstens 1 Pp schlechter |
| Knopf-Test | jede Option in ≥ 20 % der Lagen die beste, keine in > 60 %. Die beste Wahl hängt stärker an Profil und Gegnerwahl als an `eig` |
| Kriterium N | je Haltung gleiche Platzierung bei gleicher Eignung, geclustert jeder Typ ≤ 1 SE (Schwelle für Eingriff: \|t\| > 2) |
| Verhalten | Zähler ≥ 0,5 SD in die versprochene Richtung |
| Stau/Kontakt (X3) | Kontaktanteil an der Streuung < 15 %; Kontaktsaldo korreliert ≥ 0 mit Eignung; Spiegel Heim:Gast nahe 50:50 |

---

## 6. Sonstiges (Punkt f)

### 6.1 Football-Kulissenstrang

**Annahme:** Gemeint ist die Reihenfolge der Football-Optikarbeiten.

**Entscheidung:** Drei Schritte, nacheinander.

1. Nachbestellung strand in Topf A Batch 2 (Abschnitt 6.5).
2. Fouls und Schiri-Pfiff mit Kontakt Football (2.1).
3. Sonst nichts: Laut Audit hat Football außer strand kein Nicht-PixelLab-Teil im Normalbetrieb.

Das Rohbild `football_becken` (bezahlt) wird nicht verwendet. Es gibt kein Feld-Element dafür.

### 6.2 Climbing-Kulisse, nahtlos?

**Entscheidung:** Ja, sie muss senkrecht nahtlos sein, weil die Wand scrollt. Deshalb eine Probe vor
der Serie (Topf 1b, Obergrenze 60). Scheitert die Probe, gehen fels und eis auf A0.

### 6.3 Die 25 ungenutzten, bezahlten Bilder

| Bild | Entscheidung |
|---|---|
| `falle_fegearm`, `wettessen_teller_normal`, `breaking_pfahl`, `boden_schlamm` | eingebaut über #1544 |
| `grube_*` (3), `kaefig_*` (4), `bruecke_wackel_*` (2) | für die Mini-DM-Bausteine (`arenen-mechaniken-konzept-konsolidiert-15-11.md`), sobald diese gebaut werden. Bis dahin liegen lassen |
| `eiskunst_spotlight`, `eis_kufenspuren`, `eiskunst_tannen_bergkette` | in Welle B Eiskunstlauf verdrahten (0 Gen.), noch vor dem Kiss-and-Cry |
| `takeshi_fort_segment`, `takeshi_rammbock`, `takeshi_wasserkanone` | mit Kontakt Takeshi bzw. Welle B Takeshi prüfen und verdrahten, wo eine Falle passt (0 Gen.) |
| `wettessen_kotzeimer`, Ekel-Teller | für Wettessen-Ekel-Mechanik reservieren, nicht jetzt |
| `spurt_outdoor_strand` | nicht verwenden. Spurt klassisch bleibt bei `kurs.jpg` |
| `football_becken` | nicht verwenden |
| `stier`, `hai` | **nicht verwenden**. Figurennah, CLAUDE.md „im Zweifel nachfragen“, und es gibt keinen Bedarf |

### 6.4 Reihenfolge von Welle B und C

Siehe Abschnitt 4.4, Töpfe 2 und 3. B läuft in Audit-Reihenfolge, nach Spielminuten. C kommt nur
im Kern und erst nach B.

### 6.5 Nachbestellung Football strand (25 Gen.)

**Entscheidung:** **Ja**, im Topf A Batch 2, höchstens ein Versuch.

**Begründung:** Die Hütten ragen ~40 px ins Feld. Das widerspricht „Rahmen statt Material“ und der
Geometrieregel R2.

### 6.6 PR #1544: Fegearm-Länge bei wenigen Bahnen

**Befund:** Kopf und Fuß werden fest mit Z=2 gezeichnet, also (18+41)·2 = 118 px. Ist die Bahn-Spanne
`L` kleiner, ragt der Arm über die letzte Bahn hinaus.

**Entscheidung:**

- `Z = L >= 2·(KOPF+FUSS+MUSTER) ? 2 : 1`. Die Stufe bleibt ganzzahlig.
- Bei `L < KOPF+FUSS` wird auf `[y0, y1]` beschnitten (`ctx.clip`).
- Das Teilstück im Muster wird auf ganze Quellpixel gerundet.
- Folge-Commit auf #1544 **vor** dem Merge, 0 Gen. Fingerabdruck bleibt `e80babacb68c`.

### 6.7 PR #1544: Teller-Skalierung

**Befund:** 32×20 wird auf 24×15 gezeichnet, also mit Faktor 0,75. Das ist nicht ganzzahlig, und
das Bild gilt nur für Pfannkuchen.

**Entscheidung:** #1544 wird so gemergt (Übergang). In Welle B wird ein **leerer Teller 24×16**
bestellt (13 Gen., Topf 2) und 1:1 gezeichnet. Er ersetzt Pfannkuchen-Bild und Ellipsen für alle
fünf Gerichte.

### 6.8 Hockey-Rangtreue-Abnahme (ABNAHME_OFFEN)

**Befund:** rho je Spiel 0,700, also unter 0,75. Nur Feldspieler: 0,784. Saison 0,888. Pp 13,9/21,8
(gepoolt).

**Entscheidung, vorbehaltlich Frage 1 in Abschnitt 8:** Hockey bleibt auf `ABNAHME_OFFEN`. Die
Ersatzabnahme bekommt **feste Zahlen statt Prosa**. Sie werden in `pruefe-rangtreue-schranke.mjs`
und `disziplin-abnahme.json` eingetragen, und der Wächter wird rot, wenn eine davon reißt.

- rho je Spiel nur Feldspieler ≥ 0,75
- Star auf Rang 1 ≥ 55 % und in den ersten zwei ≥ 75 % (kaderfest)
- Star auf dem letzten Rang 0 %
- Paartreue ≥ 15 Punkte ≥ 97 %
- Pp-Pools ≤ 25

Arbeitsauftrag bleibt die Validität. Kandidat ist der deterministische Wechselplan H3 aus
`hockey-opus-review-nhl.md`, ohne neuen `rr()`. Den Hockey-Kontakt gibt es erst danach.

**Begründung:** CLAUDE.md nennt Star und Paartreue ausdrücklich als die ehrlichere Abnahme. Eine
Ausnahme ohne Zahlen ist aber ein stilles Loch im Wächter.

**Wer und wann:** Mess-Agent in Runde 2, 0 Gen., nur Skript und Daten.

### 6.9 I-Spy (Konzept 21.09.)

Die meisten Fragen aus Abschnitt 8 sind durch die Umsetzung beantwortet, nachgelesen im Motor:

- Mehrwege-Tresore mit Variante A „weniger Punkte“: `ISPY_NEBENWEG_PUNKTFAKTOR = 0.65`;
- Paarung fest je Fundort;
- Tür als Bild statt Sperre: `bild:"tuer"`;
- Punktwerte 10/25/45.

**Entscheidungen zum Rest:**

- **Akten bekommen keine Mehrwege**, solange I-Spy unter dem Ziel 0,80 liegt (heute 0,776 bei
  Spannweite 0,199).
- Variante B (Chance-Abzug) wird nicht zusätzlich gebaut.
- Kontakt (Schubsen) gibt es nur als Bild.
- Der nächste I-Spy-Auftrag ist die Validität (Ziel > 0,80), nicht neue Optik.

---

## 7. Priorisierte Umsetzungsliste für die nächsten Agentenrunden

Runden in Reihenfolge. In jeder Runde gibt es höchstens **einen** Agenten, der bei PixelLab bestellt
(4.3), und Motor-PRs werden einzeln gemergt.

| Runde | Auftrag | Gen. |
|---|---|---:|
| **1** | (a) Fegearm-Fix auf #1544, dann die Merges #1544 → #1551 → #1550 (je gegen `e80babacb68c`) → #1549 mit neuer Fingerabdruck-Zeile in CLAUDE.md, Skriptkopf und Abnahmedaten (Abschnitt 0, 6.6) | 0 |
| 1 | (b) `pixellab_api.py`: kein Wiederholen eines POST; Kosten-Log `gen_vorher`/`gen_nachher` (4.3) | 0 |
| 1 | (c) HYROX X0 und die Spurt-Mischung nachmessen (5.2) | 0 |
| **2** | (a) Bestell-Agent: Topf A Batch 2 mit der Nachbestellung Football strand, A0 für die vier zweiten Varianten (≤ 200) | ≤ 200 |
| 2 | (b) Kontakt Takeshi, mit N-Sonde als Skript (3.1, 3.2) | 0 |
| 2 | (c) HYROX X1 | 0 |
| 2 | (d) Hockey-Ersatzabnahme mit Zahlen (6.8); Bodenstaub und Eisstaub sichtbar machen (2.2) | 0 |
| **3** | (a) Bestell-Agent: Climbing-Probe (≤ 60), danach Topf B (≤ 340) | ≤ 400 |
| 3 | (b) HYROX X2; HYROX C1 (Regie, Bögen, Kachel; ≤ 45) | ≤ 45 |
| 3 | (c) Kontakt Football mit Fouls und Schiri-Pfiff (2.1) | 0 |
| **4** | HYROX X3 (Stau = Kontakt 1b), eigener Fingerabdruck-Bruch | 0 |
| **5** | (a) HYROX X4, X5 und C2 (≤ 25) | ≤ 25 |
| 5 | (b) Bestell-Agent: Topf C Kern (≤ 55), dann H2 (≤ 100) | ≤ 155 |
| 5 | (c) Kontakt Hatz | 0 |
| später | HYROX X6 (nach Chris' Ja); Battlefield-Pod; I-Spy-Validität; A0-Varianten und Posten hinter der Obergrenze nach einer Abo-Auffüllung | — |

---

## 8. Bleibt bei Chris (drei Fragen, je Ja/Nein)

1. **Hockey:** Soll Hockey weiter **unter** der Mindestschranke 0,75 (rho 0,700 je Spiel) als
   abgenommen gelten, wenn die festen Ersatzzahlen aus 6.8 halten (Star auf Rang 1 ≥ 55 %,
   Paartreue ≥ 97 %, Feldspieler-rho ≥ 0,75)?
   **Empfehlung: Ja.** Das ist der dokumentierte Weg aus CLAUDE.md. Die Alternative wäre, Hockey
   aus der Wertung zu nehmen, bis die Validität steigt.
2. **HYROX live eingreifen (X6):** Darf ein Zuruf, den du **während des Zuschauens** wählst, das
   gebuchte Ergebnis ändern? Wer zuschaut, kann dann besser reagieren als jemand, der nur den
   vorab gesetzten Zuruf-Plan hat.
   **Empfehlung: Ja**, aber erst nach X1–X5 und nur, wenn die Buchung technisch nach dem Zuschauen
   liegen kann.
3. **PixelLab-Nachkauf:** Sollen Generationen nachgekauft werden, falls das Guthaben vor der
   nächsten Abo-Auffüllung auf die Reserve von 150 Gen. fällt?
   **Empfehlung: Nein.** Dann stoppen die Bestellungen. Die gestrichenen Posten (A0-Varianten,
   Fahnenmast, Schachuhr, Kiss-and-Cry, U5) warten auf die Auffüllung.
