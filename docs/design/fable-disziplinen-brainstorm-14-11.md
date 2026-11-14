# Fable-Brainstorm: alle 20 Disziplinen, 14.11.

Chris wollte eine große Brainstorming-Runde mit mir über **alle zwanzig** Disziplinen auf einmal —
nicht die übliche Vertiefung einer einzelnen. Dieses Dokument ist reines Konzept: kein Code, keine
Motor- oder Matrixänderung, keine Messung. Jede Idee unten ist ein **Vorschlag**, keine Festlegung,
und trägt am Ende der zugehörigen Zeile in der großen Liste (Abschnitt 3) eine Einschätzung zu
Umfang, ob sie rho/Pp berührt (also eine Pflichtabnahme nach CLAUDE.md bräuchte) und ob sie eine
PixelLab-Charakter-/Animations-Freigabe von Chris bräuchte oder als freies Requisit zählt.

**Was ich gelesen habe, bevor ich neu erfunden habe** — damit hier nichts doppelt gedacht wird:
`docs/design/kulissen-qualitaets-audit-08-11.md` (Sicht-Audit aller 20, PixelLab-Rohszenen gegen
Motor-Bild), die gemergten Kulissen-Batches 12–14 (#1359 Showcase/Breaking, #1362 Takeshi, #1363
Climbing — alle drei "Rahmen statt Material"), #1398 ("KEINE DEMOS mehr", Battle Arena zeigt jetzt
in jeder Disziplin den echten Kader), den heutigen Arena-Darstellungs-Review #1439 (Branch
`claude/arena-review-anzeige-1411`: Pixel-Figuren animieren jetzt auch in Feldspiel/Bühne/Bahn statt
in der Standpose einzufrieren, Duell-Kopfzeilen ohne Nullsumme, Mini-DM-FFA ohne Initialen-Ovale),
`docs/design/format-varianten-brainstorm-08-11.md` (zweites Format bei gleicher Matrix, alle 20
geprüft, fünf vertieft, zwei davon — Gewichtheben "Die Grube" #1350, Basketball "Knockout" #1352 —
bereits als Prototyp gebaut), `docs/design/oberflaechen-effekte-und-rempler-vision-08-11.md` (Chris'
Vision Teil 1+2: Untergrund-Effekte wirken aufs Ergebnis, Rempler/Tackling projektweit,
persönlichkeitsgesteuert — Teil 1 als `oberflaechen-effekte-konzept-08-11.md`/PR #1354 Tennis-Pilot
schon in Arbeit), `docs/design/i-spy-schatzsuche-konzept-21-09.md` (Chris' Schatzsuche-Idee, seit
dem 27.10. als "organisch" mit Tresoren gewertet, rho 0,817) und `docs/design/stand-aller-disziplinen.md`
plus das aktuelle `data/generated/disziplin-abnahme.json` für den Ist-Stand jeder Zahl. Wo eine Idee
schon an anderer Stelle vertieft wurde, verlinke ich dorthin statt sie zu wiederholen — meine
eigene Zugabe liegt bei den **wiederverwendbaren Arenen-Requisiten** (Abschnitt 2, Chris' expliziter
Wunsch für heute), bei Atmosphäre/Ton und bei den Disziplinen, die der Format-Brainstorm bewusst
ausgelassen oder nur gestreift hat.

**Leitlinie für alle zwanzig, nicht neu, aber hier konsequent angewendet:** mehrere Wege zum
Erfolg (Primärweg volle Belohnung, Nebenweg über ein anderes Attribut langsamer/schlechter gestellt)
statt einer starren Erfolgsformel, wo eine Disziplin ohnehin an der Reihe ist.

---

## 0. Der Rahmen: wo jede Disziplin heute steht

Quelle für rho/Pp: `data/generated/disziplin-abnahme.json` (aktuellster Stand, überschreibt ältere
Nachträge in `stand-aller-disziplinen.md`, wo die beiden auseinanderlaufen — z. B. TDM, seit der
`tdmGefecht()`-Verdrahtung #1387 zwischen dem 02.11.- und dem heutigen Stand). Visuelle Note aus dem
08.11.-Audit, **vor** den Batches 12–14 — bei Showcase/Breaking/Takeshi/Climbing also der Stand VOR
der Reparatur, die diese Runde selbst schon gebracht hat.

| Disziplin | Chassis | rho je Spiel | Pp | Pflichtabnahme | Visuelle Note (Audit, vor Batch 12–14) |
|---|---|---:|---:|---|---|
| TDM | Arena | 0,813 | 16,8/14,2 | bestanden (seit #1387) | A/B+ (Lava, Frost top; Basis ok) |
| Mini-DM (FFA, Pod) | Arena | <0,80 je Event, Star/Paar-Ausnahme | 8,7/9,0 | Freigabe statt rho-Bestehen (Chris 24.10.) | A- (Grube/Sägewerk/Strom-Käfig) |
| Battlefield | Arena (Pod) | 0,86–0,92 (Pod, 02.11.) | 4,8–20,2 | bestanden als Pod | A- |
| Gewichtheben | Bühne | 0,865 | 8,5/10,0 | bestanden, Puffer groß | A (Hafen/Oase/Lagerhalle) |
| Climbing | Bahn | 0,833 | 12,0/9,5 | bestanden, knapp bei rho | **C vor Batch 14** → jetzt gerade repariert |
| Staffel | Bahn | 0,937 | 21,1/22,0 | bestanden, Pp-Puffer klein | B+ |
| Time-Trial | Bahn | 0,917 | 12,0/11,6 | bestanden | A- (Chris' eigene Messlatte) |
| Spurt | Bahn | 0,938 | 18,5/15,4 | bestanden | **C** — Chris' Kritik trifft zu |
| Tennis | Bühne | 0,813 | 6,9/4,4 | bestanden, größter Pp-Puffer im Feld | A- |
| Hockey | Feldspiel | 0,64 | 38,5/81,5 | rho per Star/Paar-Ausnahme, **Pp fällt deutlich durch** | B+ (Eis/Bergsee) |
| Showcase | Bühne | 0,835 | 11,1/12,7 | bestanden | **C** (Bühne/Festival) → jetzt gerade repariert |
| Speed-Schach | Bühne | 0,91 | 12,1/11,0 | bestanden | A |
| Takeshi's Castle | Bahn | 0,898 | 18,9/17,7 | bestanden | **C** — größte Lücke im Audit → jetzt gerade repariert |
| Breaking | Bühne | 0,801 | 14,3/13,9 | bestanden, knapp bei rho | **C+** → jetzt gerade repariert |
| Wettessen | Bühne | 0,91 | 8,7/10,0 | bestanden | A+ — die Referenz des Projekts |
| Basketball | Feldspiel | 0,832 | 15,6/16,7 | bestanden | B+ |
| Football | Feldspiel | 0,807 | **121,0/120,1** | rho bestanden, **Pp fällt massiv durch** | B+ |
| Eiskunstlauf | Bühne | 0,866 | 18,8/19,8 | bestanden | **C** — zweitflachstes Bild |
| Fechten | Bühne | 0,86 | 20,1/20,7 | bestanden, Pp-Puffer klein | B- (untere Hälfte leer) |
| I-Spy | Bühne | 0,817 | 14,6/15,0 | bestanden, knapp (nur 0,011 Puffer auf einem Strom) | A- |

**Was das für diese Runde heißt:** Hockey und Football sind die beiden Disziplinen, bei denen die
Mechanik selbst (nicht die Kulisse) noch eine offene Pflichtbaustelle ist — jede Idee dort unten ist
entsprechend als **Zusatz für eine spätere, eigene Mechanikrunde** markiert, nicht als Sofort-Bau.
I-Spy, Breaking, Climbing und Fechten haben wenig Puffer — Ideen dort sollten zuerst als reine
Anzeige (Klasse A) kommen, bevor jemand an ihrem Rezept dreht. Showcase, Breaking, Takeshi und
Climbing sind die vier Kulissen, die im Audit am schwächsten abschnitten — die Batches 12–14 haben
das laut PR-Text bereits behoben; was hier an visuellen Ideen steht, ist entsprechend die **nächste**
Politur-Schicht oben drauf, nicht die Grundreparatur selbst.

---

## 1. Die zwanzig Disziplinen

### TDM (Arena-Deathmatch)

**Ist-Stand.** 6 gegen 6, Respawn seit dem 26.09., seit `tdmGefecht()` (#1387) ein eigener
Wertungspfad statt des alten Echtzeit-Pfads — das war die Mechanikreparatur, die TDM von 0,32 auf
0,81 gehoben hat. Matrix: power 28, health 20, stamina 14, spirit 12, charisma 10 — kein speed.
Kulisse (Lava/Frost/Basis) ist laut Audit bereits A/B+, keine Dringlichkeit.

- **[A, klein] Sudden-Death-Ton.** TDM hat noch keinen eigenen `TON_KATALOG`-Eintrag (anders als
  fast jede Bühne/Bahn) — ein Herzschlag-artiges Signal ab `KAMPF_SUDDEN_DEATH_T` (wie Breakings
  `herzschlag`) wäre aus den bestehenden Primitiven (`tonSchlag`, `tonRauschen`) gebaut.
- **[M, groß, braucht eigene Mechanikrunde] "Die Brücke"** (`format-varianten-brainstorm-08-11.md`
  Abschnitt 3.2): Schildwall gegen Schildwall auf einem Steg über der Grube — bedingt eingestuft,
  weil TDM gerade erst eine funktionierende Mechanik bekommen hat und nicht sofort wieder angefasst
  werden sollte. Für eine spätere Runde vorgemerkt, nicht für diese.
- **[A, mittel] Rollen-Nebenweg.** TDM hat sechs Rollen (Vanguard, Skirmisher, Shotcaller, Hold
  Line, Rally Point, Breaker) — ein Spieler mit hohem charisma/spirit, aber wenig power, könnte als
  Shotcaller über die Zielansage-Kaskade mehr Einfluss nehmen als heute, ohne dass die Matrix
  (charisma 10, spirit 12) angefasst wird. Primär-/Nebenweg-Leitlinie, nicht neu erfunden.

### Mini-DM (Vier-Team-FFA)

**Ist-Stand.** Scharfgeschalteter Pfad ist der Vier-Team-FFA-Pod (ein Kämpfer je Team, vier
Rollenrunden, Elimination), Chris' eigene Sonderregel. rhoJeEvent liegt unter 0,80, aber Chris hat
am 24.10. explizit über die Star-/Paartreue freigegeben (Star 76–81 %, erste zwei 93–95 %). Drei
Kulissen-Varianten (Grube/Sägewerk/Strom-Käfig) sind bereits die **physische Grundlage** für Chris'
heutigen eigenen Vorschlag (Abschnitt 2) — die Grube ist im Motor schon eine benannte Kulisse, aber
rein optisch, kein Gefahrenbereich mit Wirkung.

- **[M, groß — Chris' eigener Vorschlag heute, s. Abschnitt 2] Die Grube wird scharf.** Spieler
  können einander in die zentrale Grube/den Strom-Käfig schubsen statt nur zu kämpfen — ein echter
  dritter Ausgang (Treffer, Niederlage, Rausgeschubst) neben dem heutigen reinen HP-Kampf.
- **[A, klein] Drei Varianten, drei Geräusche.** Sägewerk könnte ein Sägeblatt-Surren als
  Raumgeräusch bekommen, Strom-Käfig ein Knistern/Summen — beide aus `tonRauschen` baubar, analog
  zu Gewichthebens `publikum`-Loop. Macht die drei Kulissen akustisch unterscheidbar, nicht nur an
  der Textur.
- **[A, mittel] Eliminations-Ticker.** Die vier Rollenrunden laufen schon deterministisch — ein
  Ticker-Satz je Ausscheiden ("CR fliegt aus der Sägewerk-Runde") würde das FFA lesbarer machen,
  ähnlich dem Highlight-Cooldown der Arena-Broadcast-Optik.

### Battlefield (Vier-Team-Pod)

**Ist-Stand.** Seit dem 02.11. ein Gefecht je Ort (Nord/Mitte/Süd) mit vier Teams gleichzeitig,
bestanden (rho 0,86–0,92). Das alte Zwei-Team-Echtzeit-Duell (0,399) ist außerhalb der Wertung.
Kulisse (Eroberung/Wüstenruine) ist A-, Landmarken (Turm, Altar, Brückenkopf) tragen das Bild.

- **[bedingt, M, groß] "Die Belagerung"** (Format-Brainstorm 3.2): eine Seite hält ein Fort, drei
  stürmen. Explizit zurückgestellt, weil der Pod gerade erst gewählt wurde — hier nur verzeichnet,
  nicht vorgeschlagen für jetzt.
- **[A, klein] Kontrollpunkt-Licht.** Die drei Orte könnten je nach Besitzer eine Teamfarben-Fahne/
  einen Lichtkegel zeigen (Audit nennt "kein Licht" als einzige Schwäche) — reine Politur, bedient
  die `kpTick`-Logik, die es schon gibt.
- **[A, mittel] Wüstenruine als vierte Variante.** Zwei Kulissen heute (Eroberung/Wüstenruine);
  eine dritte (z. B. Hafenanlage mit Kran als Landmarke, passend zu Chris' "Varianten müssen
  inhaltlich unterschiedlich sein") würde die Rotation auflockern, ohne die Pod-Mechanik zu rühren.

### Gewichtheben

**Ist-Stand.** Die stärkste Kulisse im Projekt (Hafen/Oase/Lagerhalle, A), rho 0,865 mit großem
Puffer. Drittes Format "Die Grube" (Tauziehen) ist als Prototyp bereits gebaut (#1350, Branch
`claude/format-varianten-prototyp-0811`) — rho im Vorab 0,853/0,857 mit echten Motor-Kadern, Pp
11,3/9,9. Ich wiederhole die Ausarbeitung nicht, sie steht in
`docs/design/format-varianten-machbarkeit-08-11.md`.

- **[M, in Arbeit] Die Grube produktionsreif machen.** Der Prototyp ist Schweizer-Runden-Format,
  noch kein Motor-Builder — das ist reine Umsetzungsarbeit, keine neue Idee von mir.
  **Wiederverwendungs-Hinweis:** die Requisiten der Grube (Zugring, Markierungslinie, Absturzkante)
  sind in Abschnitt 2 als Basis für Mini-DMs Schubs-Falle vorgeschlagen — eine Grube, zwei Formate.
- **[A, klein] Ansage-Echo.** Showcase hat schon `klatschen`/`kreide` für die Meldetisch-Korrektur
  (Ton); Gewichtheben könnte beim Doppeln (ANSAGE-Kanal, Sandsack-Rennen) ein zweites, höheres
  `klatschen` bekommen — Publikum reagiert auf den kühnen Zusatzversuch.

### Climbing

**Ist-Stand.** War laut Audit **gleichauf mit Takeshi die schwächste Kulisse** (reine Materialtextur,
kein Oben/Unten) — Batch 14 (#1363) hat das bereits mit drei Höhenzonen (Boden/Wand/Top-out,
scrollend mit `camY()`) und routenfarbigen Griffen behoben, laut PR-Text ohne die Geometrie
anzufassen. rho 0,833 ist solide, aber der knappste Puffer unter den "bestanden"-Bahnen.

- **[A, klein] Kreidespuren und Schweißglanz.** Der Audit nennt das als offenen Politur-Punkt für
  die Griffe — kleine Zusatzdetails auf dem bereits reparierten Wand-Körper.
- **[bedingt, M, groß] "Die steigende Flut"** (Format-Brainstorm 3.2): zwölf an einer Wand, von
  unten steigt Lava/Wasser. Bedingt, weil die Wand-Geometrie für zwölf nebeneinander fehlt und
  Climbing rho-knapp ist — für später vorgemerkt.
- **[A, mittel] Nebenweg Sicherer-Kommunikation.** Climbings Matrix hat `awareness 8` ohne
  erkennbaren eigenen Kanal (laut Format-Doku "keine Zielwahl-Intelligenz"); ein Sicherer-Zuruf-Fund,
  der dem Kletterer eine bessere Route zeigt (kleiner awareness-Nebenweg neben dem
  stamina/dexterity-Primärweg), wäre ein Primär-/Nebenweg-Kandidat, ohne die Matrix zu rühren.

### Staffel

**Ist-Stand.** Solides B+, Stadion-Oval mit Tartan, rho 0,937 (bester Wert im Feld), aber Pp mit
21,1/22,0 am nächsten an der 25er-Schranke von allen bestandenen Disziplinen — **jede Rezeptänderung
hier zuerst gegen Pp prüfen.**

- **[A, klein] Politur aus dem Audit:** Bahnnummern, Licht/Tageszeit je Variante (Vorbild Hockey
  Bergsee), zweite Tribünenseite unten. Alle drei stehen schon in Abschnitt 4.8 des Audits als
  "Politur, kein Rework" — ich übernehme sie, ohne sie neu zu erfinden.
- **[zurückgestellt laut Format-Doku] "Die Verfolgungsjagd"** — eigene Siegbedingung (Einholen statt
  Zeit), aber zu nah am Skin und ohne Pp-Luft. Nicht vorgeschlagen.
- **[A, klein] Übergabe-Ton.** Ein `tonKlick`-Paar beim Stabwechsel (wie I-Spys Schloss-Klicks),
  damit die Übergabe auch hörbar ein eigenes Ereignis ist, nicht nur ein Positionssprung.

### Time-Trial

**Ist-Stand.** Chris' eigene Messlatte (A-): Kopfstreifen mit Horizont/Himmel je Karte (Alpen,
Vulkan-Abendrot, Küste, Weinberge), Geländefaktor wirkt bereits real auf Tempo/Ausdauer
(`gelaendeFaktor`/`gelaendeZehrFaktor`) — das ist exakt das Vorbild für Chris' Oberflächen-Effekte-
Vision Teil 1, nur bereits gebaut.

- **[A, mittel] Echtes Parallax.** Der Audit nennt es selbst als nächsten Schritt: fern/mitte-Ebene
  mit halbem `camX`-Versatz statt eines fest stehenden Kopfstreifens. Würde Time-Trial von A- auf A
  heben, ohne die Bahn-Geometrie zu berühren.
- **[kein Potenzial laut Format-Doku] Zweites Format.** Massenstart wäre Spurt, bewegliche Fallen
  wären Takeshi — Time-Trial bleibt Einzelstart gegen die Uhr, der richtige Hebel ist Teil 1
  (weitere Gelände-Varianten), nicht Teil 3.

### Spurt

**Ist-Stand.** **Chris' Kritik trifft zu** — 80 % einfarbiges Band, Szene (HYROX-Halle mit Geräten,
Bögen, Tribüne) zu 0 % genutzt, Vorher-Bild hatte mehr Charakter. Noch nicht von Batch 12–14
angefasst (Rang 3 im Audit, nach Takeshi und Climbing). rho/Pp sind gut (0,938/18,5), das Problem ist
rein visuell.

- **[A, groß, nächster Schritt laut Audit-Reihenfolge] Kopfstreifen mit Tiefe.** Hallendach mit
  Trägern (fern), Tribüne mit Anzeigetafel (mitte), Gerätezeile als Silhouetten (vorne) — plus
  IN-/FINISH-Bögen an Start/Ziel, Stationsumfeld im Belag (Pfütze, verbrannter Boden, Mattenstreifen),
  Lichtkegel je Station. Alles in Abschnitt 4.3 des Audits bereits ausgearbeitet, hier nur
  referenziert, nicht wiederholt.
- **[A, mittel] Zweite Outdoor-Variante**, ebenfalls aus dem Audit: Stadionvorplatz oder Strand bei
  Abendlicht, damit Spurt wie Time-Trial je Begegnung wechselt statt einer einzigen Kulisse.
- **[M, mittel, bereits vertieft] "Die Hatz"** (Format-Doku 4.3): Rundkurs mit Fegearm/Stier statt
  Ausdauer-Rennen — passend zur Matrix (stamina nur 4). Nicht hier wiederholt, nur verzeichnet.

### Tennis

**Ist-Stand.** A-, größter Pp-Puffer im ganzen Feld (6,9/4,4), Pilot-Disziplin für Chris'
Oberflächen-Effekte (PR #1354: `OW` additiv auf jeden Bühnen-Sub-Skill, Deckel ±5, Matrix
unangetastet). Drei Kulissen (Court/Riviera/Dach) bereits mit unterschiedlichem Untergrund-Charakter.

- **[in Arbeit, Fundament existiert] Oberflächen-Effekt auf die anderen beiden Varianten ausrollen**
  — Riviera (Sand, mehr Rutschen/Ausdauer?) und Dach (Rasen, mehr Tempo?) bekommen eigene `OW`-Profile
  wie Court schon eins hat. Reine Fortführung des Piloten, keine neue Mechanik.
- **[A, klein] Tribünen-Wiederholung** mischen (Audit-Politur: mindestens drei verschiedene Blöcke
  statt eines im Takt) — gilt genauso für Basketball/Football/Hockey/Staffel, s. Abschnitt 3.
- **[zurückgestellt laut Format-Doku] "Rundlauf am Abgrund"** — brutal durch die Kulisse (Turm,
  Absturz), nicht durch die Regel. Interessant, aber mit dem größten Pp-Puffer im Feld ist Tennis
  die am wenigsten dringende Baustelle für eine neue Mechanik.

### Hockey

**Ist-Stand.** Die Mechanik-Pflichtbaustelle Nummer eins: rho nur über Chris' Star-/Paar-Ausnahme
freigegeben (0,64 roh, Star Rang 1 58 %, erste zwei 78 %), **Pp 38,5/81,5 fällt klar durch** — und
mit 43 Pp Spannweite zwischen den beiden Strömen die instabilste Messung im ganzen Feld (vermutlich
wegen der extrem niedrigen Torzahl je Spiel, `stand-aller-disziplinen.md` 27.10.-Nachtrag). Kulisse
ist B+ (Eis/Bergsee), kein Handlungsbedarf dort.

- **[M, groß, eigene Mechanikrunde nötig, nicht Teil dieses Brainstorms] "Der Durchbruch"**
  (Format-Doku 4.2): kein Tor, kein Torwart, ein Puckträger gegen sechs Checker über die ganze
  Fläche. Explizit als möglicher Weg genannt, weil ein einfacheres zweites Format — wie beim
  Battlefield-Pod — der Weg zur Pp-Wertung sein könnte, wo das Live-Feldspiel-Rezept selbst scheitert.
  Ich vertiefe das nicht neu, verweise nur auf die bestehende Ausarbeitung.
- **[A, klein] Check-Ton.** Hockey hat schon `falle`/`sturz`/`platsch`/`tor` im TON_KATALOG — ein
  separater, härterer `tonSchlag` für einen erfolgreichen Bodycheck (anders als der normale
  Zweikampf) würde die Puste-Leiste (die laut CLAUDE.md nur sichtbar, nie ausgangsrelevant ist)
  hörbar machen, ohne rho anzufassen.
- **[Hinweis, kein Vorschlag] Torwart-Wertformel.** PARADE/GSAA-Korrelation ist mit 0,39 schwach
  (eigener, bereits getrackter Befund, s. `stand-aller-disziplinen.md` 1a) — gehört in eine
  Mechanikrunde, nicht in dieses visuelle/konzeptuelle Brainstorming.

### Showcase

**Ist-Stand.** War **C** (Bühne, Festival) — schwarzer Bühnenraum, Künstler im Lichtfleck im
Nichts — Batch 12 (#1359) hat das mit gemaltem Mondnacht-Prospekt, Holzboden und Lichtkegeln bereits
behoben (laut PR-Text). rho 0,835 ist solide.

- **[A, klein, nächste Schicht nach Batch 12] Ränge in voller Breite.** Der Audit nennt das als noch
  offenen Punkt auch nach der Beleuchtungskorrektur — die Theaterszene hat drei Ränge, die laut
  Konzept weiter auf zwei Randstreifen beschnitten sein könnten, falls Batch 12 nur die Beleuchtung,
  nicht den Zuschnitt geändert hat. Vor Ort prüfen, ob das noch offen ist.
- **[M, mittel, Format-Doku 3.1] "Das Niederbrüllen"**: zwei gleichzeitig auf der Bühne, wer die
  Menge hält, gewinnt den Durchgang — echte Interaktion statt Einzel-Auftritt. Nicht vertieft,
  nur verzeichnet.
- **[A, klein] Reaktions-Ton.** Showcase hat schon `ausbruch`/`raunen` (von Gewichtheben
  mitgenutzt?) zu prüfen, ob Showcase einen eigenen Jubel/Buh-Ton für die Punktzahl-Enthüllung hat —
  falls nicht, derselbe Baustein wie bei Gewichtheben, nur andere Tonhöhe.

### Speed-Schach

**Ist-Stand.** A, eines der stärksten Bilder (Park/Zug), rho 0,91. "Die Uhr wird der dritte Spieler"
(Stufe 1+2) ist bereits gebaut, aber hinter einem Flag aus (Nachtrag 04.10.) — ungeklärt, ob das
noch aktuell ist oder seither entschieden wurde.

- **[Prüfpunkt, kein neuer Vorschlag] Flag-Stand nachsehen.** Falls die Uhr-Mechanik seit dem 04.10.
  immer noch hinter dem Flag liegt, wäre die reine Entscheidung ("scharfschalten ja/nein") der
  günstigste Hebel hier — keine neue Idee, nur eine offene Altlast, die bei dieser Runde aufgefallen
  ist.
- **[M, mittel, Format-Doku 3.1] "Der Blitz-Gauntlet"**: Sieger bleibt am Brett mit seiner Restzeit
  statt Reset, `gauntlet:true` existiert schon. Doku selbst warnt: "am Rand des Skin-Verdachts" — nur
  mit der Restzeit-Regel ein echtes anderes Spiel. Nicht vertieft, nur verzeichnet.

### Takeshi's Castle

**Ist-Stand.** War **Rang 1 des Audits**, die größte Lücke zwischen PixelLab-Rohszene (Kirschblüte,
Torii, Bergkette, Wasserbecken mit Wackelbrücke) und Motor-Bild (Kachelrasen mit sichtbarem Raster,
Perspektivbruch bei den Fallen-Requisiten). Batch 13 (#1362) hat laut PR-Text bereits eine
durchgängige, reichere Kulisse gebaut — Details in `docs/design/arena-kulissen-im-motor-03-11.md`.
rho 0,898 mit gutem Puffer.

- **[A, groß, Chris' expliziter Wunsch heute, s. Abschnitt 2] Mehrere Arena-Varianten mit
  unterschiedlichen Fallen, als Fundament für Mini-DM/I-Spy-Wiederverwendung.** Takeshi hat drei
  Kurse (laut #1362-PR-Text "nur drei Reihenfolgen derselben Fallentypen, keine Kulissen-Wahl") —
  eine echte Kulissen-Wahl mit unterschiedlichem Fallen-Set je Variante (Burg/Dschungel/Eisfestung)
  wäre der Ausbau, der Chris' heutige Idee am direktesten bedient.
- **[M, groß, Format-Doku 3.1] "Der Sturm auf die Burg"**: asymmetrisch, eine Seite verteidigt
  (Wasserkanonen, Fallen auslösen), die andere stürmt — das Original hat genau dieses Finale.
  Nicht vertieft, nur verzeichnet.
- **[A, mittel] Perspektiv-Entscheidung für die Fallen**, laut Audit 4.1 noch offen: entweder alle
  Fallen-Requisiten als Draufsicht neu bestellen (Türrahmen, Zylinder, Rundturm von oben — jeweils
  **neue PixelLab-Requisiten**, frei bestellbar, keine Charaktere) oder konsequent 3/4-Sicht für die
  ganze Karte. Mischen geht laut Audit nicht — eine Entscheidung, keine Umsetzung in diesem Papier.

### Breaking

**Ist-Stand.** Breaking ist **Folter, nicht Breakdance** — wer hier recherchiert, recherchiert
Slap-Fighting/Kendo-Kachinuki/K.o.-Teamformate, nicht Tanzbattles (CLAUDE.md, zweimal nötig
gewesen). War **C+** im Audit (starke Rohszene, aber violetter Schleier im Motor) — Batch 12 (#1359)
hat das laut PR-Text als billigen Lichtfix bereits behoben. rho 0,801 ist der knappste
"bestanden"-Wert im ganzen Feld — **hier zuerst messen, bevor irgendetwas am Rezept gedreht wird.**

- **[A, klein, Prüfpunkt] Verlust nach Batch 12 nachsehen.** Mit nur 0,001 Puffer über der
  0,80-Schranke lohnt eine frische Messung nach jeder visuellen Änderung hier besonders — auch
  wenn der Audit selbst sagt "Simulation unberührt", ist Breaking die Disziplin, bei der ich das
  am ehesten noch einmal bestätigt sehen möchte.
- **[M, mittel, Format-Doku 3.1, torturethematisch konsistent] "Die zwölf Pfähle"**: alle zwölf
  gleichzeitig am Marterpfahl, reihum ist einer Henker. Passt zu Chris' Folter-Leitlinie besser als
  das heutige 1v1-Gauntlet es tut — nicht vertieft, nur verzeichnet, und ausdrücklich **kein**
  Breakdance-Bild (Pfähle, Henker, Aushalten — Folter-Register bleibt gewahrt).
- **[A, klein] Fackel-Ton.** Ein leises Knistern-Loop (wie Mini-DMs vorgeschlagenes Sägewerk-Surren)
  für die jetzt wieder sichtbaren Fackeln der Rundbühne.

### Wettessen

**Ist-Stand.** A+, "die Referenz des Projekts" laut Audit — Riesenrad, Zelte, Publikum, Fackeln,
Nachtvariante mit Lichterketten. rho 0,91. "Die Mauer, die Haltung" (K1+K2) ist bereits gebaut, aber
hinter Flag aus (Nachtrag 04.10., wie Speed-Schach) — selber Prüfpunkt wie dort.

- **[Prüfpunkt, kein neuer Vorschlag] Flag-Stand nachsehen**, dieselbe Logik wie bei Speed-Schach.
- **[M, mittel, Format-Doku 3.1] "Das Ekelroulette"**: Gang für Gang essen oder passen statt Menge
  zählen, Siegbedingung Überleben statt Teller — besonders interessant, weil Wettessen laut
  `stand-aller-disziplinen.md` 5b "keine eigene Mechanik" hat. Nicht vertieft, nur verzeichnet.
- **[A, klein] Nichts Dringendes visuell.** Wettessen ist die Messlatte, nicht die Baustelle — wenn
  überhaupt, ein viertes Setting (z. B. Festbankett/Rathaussaal) für mehr Rotation, aber keine
  Priorität gegenüber den vier Kulissen, die wirklich schwach waren.

### Basketball

**Ist-Stand.** B+, solides Parkett/Streetcourt, rho 0,832, Pp 15,6/16,7. "Knockout" (Format-Doku
4.5) ist bereits als Prototyp mit echten Motor-Kadern gebaut (#1352): 8 von 8 Läufen über beiden
Schranken, rho 0,818–0,846, Pp 17,7–21,5 — der billigste Prototyp der ganzen Format-Liste laut
eigener Einschätzung dort.

- **[M, in Arbeit] Knockout produktionsreif machen** — braucht laut PR-Text noch einen Builder im
  Motor und eine zweite, unabhängige Kaderstichprobe. Reine Fortführung, keine neue Idee von mir.
- **[A, klein] Tribünen-Wiederholung mischen**, wie bei Tennis/Football/Hockey/Staffel — derselbe
  Griff (a) aus Audit-Abschnitt 4.8, hier nur für Basketball vermerkt.
- **[A, klein] Fehlender Ton.** Basketball hat **keinen** `TON_KATALOG`-Eintrag (Prüfung des
  Quelltexts, Abschnitt 0 oben) — Dribbel-Klick, Netz-Swish, Buzzer am Viertelende wären aus den
  Primitiven (`tonKlick`, `tonRauschen`, `tonBuzzer`) baubar und fehlen schlicht, anders als bei
  fast jeder anderen Bühne/Bahn.

### Football

**Ist-Stand.** B+ visuell (Feld/Strand), rho 0,807 bestanden, aber **Pp 121,0/120,1 ist der
mit Abstand größte Fehlbetrag aller zwanzig Disziplinen** — fünfmal über der Schranke. Football hat
einen eigenen `spielEignung`-Override (Matrix selbst unangetastet), der laut
`stand-aller-disziplinen.md` die Einzelspielzahl gehoben hat, aber die Budget-Treue offenbar nicht.

- **[M, groß, eigene Mechanikrunde, nicht Teil dieses Brainstorms] "Die Hai-Gasse"** (Format-Doku
  4.1): 8 m breite Gasse neben dem Hai-Becken, ein Läufer mit Blocker gegen zwei Tackler. Explizit
  als möglicher zweiter, Pp-freundlicherer Weg genannt — Football ist nach Hockey die Disziplin mit
  dem größten Mechanik-Nachholbedarf, nicht die mit dem größten Kulissen-Nachholbedarf.
- **[A, klein] Strand bleibt die stärkere Variante** laut Audit — kein Rework nötig, nur ggf. die
  Tribünen-Wiederholung des Feld-Settings mischen (derselbe Politur-Griff wie oben).
- **[Hinweis] Jede neue Football-Idee zuerst gegen Pp denken.** Mit 121 Pp ist jede zusätzliche
  Mechanik-Idee hier zweitrangig, bis die Grundursache gefunden ist — das ist explizit eine
  Pflichtaufgabe für eine Mechanik-, nicht für eine Konzeptrunde.

### Eiskunstlauf

**Ist-Stand.** War **C**, das flachste Bild aller Bühnen (90 % graue Eisfläche, Rohszene fast
ungenutzt) — noch nicht von Batch 12–14 angefasst (Rang 4 im Audit). rho 0,866 mit gutem Puffer,
Mechanik ist also nicht das Problem. Chris' Rempler-Vision Teil 2 nennt Eiskunstlauf explizit als
Kandidat für "vier Aktive gleichzeitig statt zwei" (beide Duos sichtbar).

- **[A, groß, nächster Schritt nach Climbing/Takeshi laut Audit-Reihenfolge] Waldsee und Kür
  bespielen.** Tannen/Bergkette auf voller Tribünenstreifenhöhe statt als Linie, Spotlights auf die
  Läufer, Eis mit Spiegelung und Kufenspuren statt grauer Fläche — alles in Audit 4.4 bereits
  ausgearbeitet, hier nur referenziert.
- **[kein Potenzial laut Format-Doku] Kein zweites Format.** Die Matrix hat weder power noch health
  noch stamina — jede "brutale" Variante würde Attribute mit Gewicht 0 belohnen. Eiskunstlauf bleibt
  Eiskunstlauf, der richtige Hebel ist Darstellung/Teilnehmerstruktur (Teil 2 der Vision), nicht ein
  neues Format.
- **[M, in Arbeit an anderer Stelle] Vier-Aktive-Struktur** aus der Rempler-Vision — gehört zur
  laufenden Opus-/Fable-Recherche zu Teil 2, hier nur verzeichnet, nicht neu entworfen.

### Fechten

**Ist-Stand.** B- im Audit (obere Hälfte gut, untere 45 % leer — Szene endet knapp unter der
Motor-Bahn). rho 0,86 mit solidem Puffer, aber Pp 20,1/20,7 mit wenig Luft zur 25er-Schranke.

- **[A, mittel, Audit 4.7] Zuschnitt verschieben.** Hofmauer mit Tor/Burggraben beim Schlosshof,
  vordere Tribünenreihen als Silhouette in der Halle — damit unter der Bahn Inhalt liegt statt
  45 % Leerfläche. Bereits ausgearbeitet, hier nur referenziert.
- **[zurückgestellt, Format-Doku 3.1] "Die Mêlée"**: alle zwölf im Ring, ein Treffer ist das Aus.
  Starke Idee laut Doku selbst, aber Fechten hatte schon einen Format-Fehlschlag in der Arena
  (rho 0,153 als Feldspiel) — müsste vorab gewürfelt sein wie die Bühne, nicht Echtzeit. Nicht
  vertieft, nur verzeichnet.
- **[Hinweis] Pp-Puffer im Blick behalten.** Mit 20,1/20,7 ist Fechten keine Disziplin, an deren
  Rezept man nebenbei dreht — jede Mêlée-Umsetzung bräuchte eine frische Pp-Messung, keine Annahme.

### I-Spy

**Ist-Stand.** Chris' eigenes Schatzsuche-Konzept vom 21.09. ist inzwischen **größtenteils
umgesetzt** — seit dem 27.10. "organisch" mit 32 Ticks und Tresoren (rho 0,817, Saison 0,888), der
Verhör-/Logik-Kanal existiert bereits. A- visuell (Aztec/Horror/Lost Place/Ruinengarten). **Knappster
Puffer im ganzen Feld auf einem der beiden Ströme (0,011).**

- **[M, mittel, Format-Doku 3.1] "Das Verhör"**: Perspektive umkehren — einer sitzt, elf fragen,
  torment ist der Druck. Der Verhör-Kanal existiert laut Doku schon über die Tresore, das Format
  würde nur die Rollen tauschen. Mit Risikohinweis aus der Doku selbst übernommen: wegen des engen
  Puffers zuletzt angehen, nicht zuerst.
- **[A, groß — Chris' expliziter Wunsch heute, s. Abschnitt 2] Wiederverwendbare Truhen/Fallen mit
  Takeshi/Mini-DM teilen.** I-Spys Tresore und Takeshis Fallen-Typen sind bereits laut
  Konzeptdokument (21.09., Abschnitt 0.3) als verwandte Muster erkannt — ein gemeinsamer
  Requisiten-Baukasten (Abschnitt 2) würde das für beide Seiten günstiger machen, als zwei getrennte
  Bestellungen.
- **[A, klein] Lupenzeichen-Konsistenz.** Chris' eigenes Bild ("Lupenzeichen über ihnen, während sie
  das Asset untersuchen", Escape-Room-Stil) — prüfen, ob die heutige `spybar.tsx`
  (Nachtsicht-Spionage-Radar-Thema laut Konzeptdokument 0.1) noch zu diesem Bild passt oder ein
  eigenes, zum Escape-Room passenderes HUD verdient hätte. Reine Anzeige-Frage, kein Mechanik-Risiko.

---

## 2. Wiederverwendbare Arenen-Requisiten und Fallen (Chris' expliziter Wunsch)

Drei Formate brauchen strukturell dasselbe: **einen festen Ort in einer Arena, an dem etwas
Gefährliches oder Interessantes passiert, wenn ein Spieler dort hinkommt oder hingeschubst wird.**
Takeshi hat das schon (`hindernisse[]`, `hindernisTypen[]`, `fallenStufe` 1–3 Sterne, `fallenBild`),
I-Spy hat die verwandte Variante "etwas durchsuchen, nicht ausweichen" (Tresore, Sterne-Stufen laut
eigenem Konzeptdokument), und Mini-DM hat mit der Grube/dem Strom-Käfig bereits den **Ort**, aber
noch nicht die **Wirkung** — die drei Kulissen-Varianten sind heute reine Optik.

**Grundidee, projektweit:** ein kleiner Satz generischer Fallen-/Requisiten-Typen, jeweils als
freies PixelLab-Requisit (kein Charakter, keine neue Animation — s. CLAUDE.md-Freigabe-Regel)
bestellt, der in mehreren Formaten eine jeweils passende, aber unterschiedliche Rolle bekommt:

| Requisit | Takeshi (ausweichen) | Mini-DM (schubsen) | I-Spy (durchsuchen) |
|---|---|---|---|
| **Die Grube** (Fallgrube/Schacht mit Absturzkante) | bereits vorhanden (`fallenBild`, Sterne-Stufe) | **Chris' heutiger Vorschlag**: Gegner hineinschubsen = sofortiges Aus, analog zum K.o.-Anteil der Arena | ungeeignet (nichts zu finden) |
| **Der Käfig/Strom-Kreis** (abgegrenzte Gefahrenzone, kein Abgrund) | als "Elektrozaun"-Hindernis denkbar | bereits als Kulisse "Strom-Käfig" vorhanden, Wirkung fehlt noch | ungeeignet |
| **Die Truhe/der Schrank** (durchsuchbares Möbel, verschließbar) | als Beute-Station denkbar (Sterne-Stufe = Belohnung statt Gefahr) | ungeeignet | bereits Kern der Mechanik (Tresore) |
| **Das Walzen-/Pendel-Hindernis** (bewegliches, zeitgetaktetes Objekt) | bereits vorhanden (Walze laut Audit 4.1) | als rotierender "Fegearm" denkbar (vgl. Spurts "Die Hatz", Format-Doku 4.3 — dort als Bahn-Hindernis, hier als Arena-Requisit wiederverwendbar) | ungeeignet |
| **Die Wackelbrücke** (instabiler Übergang über eine Gefahrenzone) | in der Takeshi-Rohszene bereits vorhanden, laut Audit 0 % im Motor genutzt | als Fluchtweg aus der Mitte zur Grube denkbar (wer sie nicht hält, fällt) | ungeeignet |

**Warum das günstiger ist als drei getrennte Bestellungen:** Jedes Requisit ist ein einzelnes,
freies PixelLab-Sprite (Kiste/Grube/Walze/Brücke — "Schatztruhe oder Kiste oder solche Dinge", exakt
Chris' eigenes Beispiel für frei bestellbare Assets). Es bekommt **keine neue Animation und keinen
neuen Charakter** — die Spieler-Figuren, die hineingeschubst werden oder die Falle auslösen, nutzen
weiterhin die bestehenden PixelLab-Streifen (Sturz-/Treffer-Pose, wie PR #1439 es für die
Pixel-Arena bereits korrekt verdrahtet hat). Ein einziger, breiter werdender Requisiten-Satz
(Grube/Käfig/Truhe/Pendel/Brücke) deckt damit drei Formate statt eines.

**Mechanisch, nicht nur optisch — konkreter Vorschlag für Mini-DM (Chris' heutiger Punkt):**

- Ein Spieler in der Mitte einer Runde kann (abhängig von Eignung/Persönlichkeit, nicht Zufall,
  analog zur Rempler-Vision Teil 2) versuchen, den Gegner statt zu treffen in die Grube/den
  Strom-Käfig zu drängen — power/torment als Primärweg (Matrix: torment 21, power 14 für Mini-DM),
  ein Nebenweg über dexterity/stamina für "ausweichen, bevor man selbst gedrängt wird".
- Jede der drei bestehenden Kulissen-Varianten bekommt dadurch einen **inhaltlich eigenen**
  Gefahrentyp statt nur anderer Beleuchtung — genau Chris' eigene Vorgabe aus der Oberflächen-Vision
  ("nicht, dass es einfach nur verschiedene dunkle Areale sind"): Grube = Fallschaden/Aus, Sägewerk
  = Sägeblatt als Umgebungsgefahr am Rand, Strom-Käfig = Betäubung statt Aus.
- **Das ist eine echte Mechanikänderung** (Klasse M) und bräuchte vor jeder Umsetzung eine frische
  rho-/Pp-Messung auf Mini-DMs ohnehin schon knapper Zahlengrundlage — nicht in dieser Runde zu
  entscheiden, nur als Konzept mit Umfangsschätzung in der großen Liste unten.

**Für I-Spy/Takeshi, dieselbe Logik ohne neue Mechanik (reine Wiederverwendung der Requisiten,
nicht der Wirkung):** eine einzelne Truhen-/Kisten-Asset-Familie (verschieden stark verziert für
Sterne-Stufen, wie Takeshis `fallenBild` es für Gefahren schon tut) ließe sich für beide Formate
in derselben Bestellung abdecken — I-Spy nutzt sie zum Durchsuchen, Takeshi könnte dieselbe Familie
für Beute-Stationen (nicht nur Gefahren) am Streckenrand verwenden, falls das Format das später will.

---

## 3. Die große Vorschlagsliste

Sortiert grob nach "schnell + risikoarm zuerst". **Umfang:** klein (≤1 Tag), mittel (2–4 Tage),
groß (>1 Woche bzw. eigene Mechanikrunde). **Pflichtabnahme:** ob rho>0,80/Pp≤25 nach einer
Umsetzung neu geprüft werden müsste. **PixelLab:** "Requisit" = frei bestellbar; "Freigabe nötig" =
neue Figur oder neue Animation, braucht Chris' Einzelfreigabe; "keine" = reiner Code/Ton/Zahl, kein
PixelLab-Bezug.

1. **Basketball bekommt einen `TON_KATALOG`-Eintrag** (Dribbel-Klick, Netz-Swish, Viertel-Buzzer aus
   bestehenden Primitiven). Klein. Keine Pflichtabnahme (reine Anzeige). PixelLab: keine.
2. **TDM/Mini-DM/Battlefield bekommen einen `TON_KATALOG`-Eintrag** (fehlen heute als einzige
   Arena-Disziplinen). Klein. Keine Pflichtabnahme. PixelLab: keine.
3. **Mini-DM: drei Kulissen-Varianten akustisch unterscheiden** (Sägeblatt-Surren, Strom-Knistern).
   Klein. Keine Pflichtabnahme. PixelLab: keine.
4. **Staffel-Politur aus dem Audit umsetzen** (Bahnnummern, Licht/Tageszeit je Variante, zweite
   Tribünenseite). Klein. Keine Pflichtabnahme (Audit: "Simulation unberührt"). PixelLab: Requisit
   (Bahnnummern-Sprites), falls nötig.
5. **Tribünen-Wiederholung mischen** bei Basketball, Football, Hockey, Tennis, Staffel (mind. drei
   verschiedene Publikumsblöcke statt eines im Takt — Audit 4.8). Klein je Disziplin. Keine
   Pflichtabnahme. PixelLab: Requisit (zusätzliche Publikums-Sprite-Varianten, keine neuen Figuren).
6. **Breaking: frische rho-Messung nach Batch 12** (0,801 ist der knappste "bestanden"-Wert im
   Feld). Klein (reine Messung, kein Bau). Pflichtabnahme: ja, genau darum geht es. PixelLab: keine.
7. **Hockey: separater Check-Ton** (härterer `tonSchlag` für erfolgreiche Bodychecks, getrennt vom
   normalen Zweikampf-Ton). Klein. Keine Pflichtabnahme (Puste ist laut CLAUDE.md nie
   ausgangsrelevant). PixelLab: keine.
8. **Gewichtheben: zweites Ansage-Echo** (höheres `klatschen` beim Doppeln im Sandsack-Rennen).
   Klein. Keine Pflichtabnahme. PixelLab: keine.
9. **Speed-Schach/Wettessen: Flag-Stand der bereits gebauten Mechaniken** ("Die Uhr als dritter
   Spieler", "Die Mauer, die Haltung") nachsehen und Chris zur Entscheidung vorlegen. Klein (reine
   Prüfung). Keine neue Pflichtabnahme nötig, falls unverändert scharfgeschaltet. PixelLab: keine.
10. **Staffel: Übergabe-Ton** (Klick-Paar beim Stabwechsel). Klein. Keine Pflichtabnahme. PixelLab:
    keine.
11. **Breaking: Fackel-Knistern-Loop** für die jetzt sichtbaren Fackeln (Batch 12). Klein. Keine
    Pflichtabnahme. PixelLab: keine.
12. **Showcase: Ränge-Zuschnitt prüfen** (ob nach Batch 12 noch auf zwei Randstreifen beschnitten).
    Klein (Prüfung, ggf. mittel für die Umsetzung). Keine Pflichtabnahme. PixelLab: keine (nutzt
    vorhandene Rohszene).
13. **Battlefield: Kontrollpunkt-Licht je Besitzer** (Teamfarben-Kegel auf Nord/Mitte/Süd). Klein.
    Keine Pflichtabnahme. PixelLab: keine (reine Zeichenlogik).
14. **I-Spy: `spybar.tsx`-Thema gegen Chris' Escape-Room-Bild prüfen** (Nachtsicht-Radar vs.
    Lupenzeichen-Stil). Klein–mittel (Prüfung plus ggf. Redesign). Keine Pflichtabnahme (reine
    Anzeige). PixelLab: keine (HTML/CSS-Oberfläche, kein Sprite).
15. **Climbing: Kreidespuren/Schweißglanz auf den Griffen** (Politur nach Batch 14). Klein. Keine
    Pflichtabnahme. PixelLab: keine (Zeichendetail auf vorhandenem Sprite).
16. **TDM: Sudden-Death-Herzschlag-Ton.** Klein. Keine Pflichtabnahme. PixelLab: keine.
17. **Mini-DM: Eliminations-Ticker-Sätze** für die FFA-Rollenrunden. Klein–mittel. Keine
    Pflichtabnahme (reine Textausgabe). PixelLab: keine.
18. **Battlefield: dritte Kulissen-Variante** (z. B. Hafenanlage mit Kran als Landmarke). Mittel.
    Keine Pflichtabnahme (reine Kulisse, Fallenpositionen/Zonen unberührt). PixelLab: Requisit
    (Landmarken-Sprites), evtl. neue Rohszene — prüfen, ob eine bestehende PixelLab-Szene (wie bei
    den anderen Battlefield-Varianten) wiederverwendbar ist, bevor eine neue bestellt wird.
19. **Time-Trial: echtes Parallax** (fern/mitte-Ebene mit halbem `camX`-Versatz statt festem
    Kopfstreifen). Mittel. Keine Pflichtabnahme (Audit: Bahn-Geometrie unberührt). PixelLab: keine
    (nutzt vorhandene Rohszenen-Ebenen neu).
20. **Spurt: zweite Outdoor-Variante** (Stadionvorplatz/Strand bei Abendlicht). Mittel. Keine
    Pflichtabnahme. PixelLab: Requisit (neue Kulissenbausteine aus bestehender oder neuer
    Rohszene), keine neuen Figuren.
21. **Fechten: Zuschnitt verschieben** (Hofmauer/Burggraben bzw. vordere Tribünenreihen unter die
    Motor-Bahn holen, Audit 4.7). Mittel. Keine Pflichtabnahme laut Audit-Prinzip, aber Fechtens
    enger Pp-Puffer (20,1/20,7) macht eine Kontrollmessung ratsam. PixelLab: keine (Kulissen-Zuschnitt).
22. **Tennis: Oberflächen-Effekt auf Riviera/Dach ausrollen** (wie Court schon hat). Mittel.
    **Pflichtabnahme ja** (jede neue `OW`-Zuordnung ist ein Eingriff in Eingangswerte, Konzept
    verlangt rho/Pp-Nachweis). PixelLab: keine.
23. **Spurt: Kopfstreifen mit Tiefe + Start-/Ziel-Bögen + Stationsumfeld** (Audit 4.3, größter noch
    offener visueller Rework im Feld). Groß. Keine Pflichtabnahme (Audit-Prinzip: Geometrie
    unberührt), aber als größter Einzel-Batch eine eigene Fingerabdruck-Prüfung wert. PixelLab:
    Requisit (Geräte-Silhouetten, Bögen, Bodenmerkmale aus der vorhandenen HYROX-Rohszene), keine
    neuen Figuren.
24. **Eiskunstlauf: Waldsee/Kür bespielen** (Audit 4.4 — Tannen/Bergkette in voller Höhe, Spotlights,
    Eis mit Spiegelung/Kufenspuren). Groß. Keine Pflichtabnahme. PixelLab: Requisit (Rohszenen-
    Elemente, Spiegelungs-/Texturdetail), keine neuen Figuren.
25. **Takeshi's Castle: echte Kulissen-Wahl mit unterschiedlichem Fallen-Set je Variante** (statt
    derselben Fallentypen in drei Reihenfolgen) — Chris' heutiger Kernwunsch für Wiederverwendung.
    Groß. **Pflichtabnahme ja**, falls Fallenstufen/-wirkung sich zwischen Varianten unterscheiden
    (reine Kulissenwahl ohne Wirkungsänderung bräuchte keine). PixelLab: Requisit (Fallen-Sprites je
    Variante aus der Rohszene), keine neuen Figuren — Perspektiv-Entscheidung (Draufsicht vs. 3/4)
    zuerst klären.
26. **I-Spy/Takeshi: gemeinsame Truhen-/Kisten-Asset-Familie** (Abschnitt 2) — eine Bestellung statt
    zwei, verschiedene Verzierungsstufen für Sterne-Stufen. Mittel. Keine Pflichtabnahme (reines
    Requisit, Takeshi nutzt sie optional als neue Beute-Station, nicht zwingend). PixelLab: Requisit,
    frei bestellbar.
27. **Mini-DM: Grube/Strom-Käfig bekommen echte Wirkung** (Schubsen in die Gefahrenzone als dritter
    Ausgang neben Treffer/Niederlage, Chris' eigener Vorschlag heute). Groß. **Pflichtabnahme ja**
    — Mini-DMs rhoJeEvent liegt ohnehin schon unter 0,80 (nur über Star-/Paartreue freigegeben),
    jede Mechanikänderung hier braucht eine frische Messung samt neuer Freigabe-Rücksprache mit
    Chris, nicht nur eine rho-Zahl. PixelLab: Requisit (Grube/Käfig-Wirkungsanimation ist eine
    **Zeichen**-Frage, keine neue Spieler-Animation — die Figur nutzt die vorhandene Sturz-Pose;
    falls eine eigene "wird hineingeschubst"-Bewegung gewünscht wird, wäre das eine neue Animation
    und bräuchte Freigabe).
28. **Takeshi: Walzen-/Pendel- und Wackelbrücken-Requisiten als projektweiter Fallen-Baukasten**
    (Abschnitt 2, Wiederverwendung in Spurts "Die Hatz"-Formatidee als Fegearm). Mittel–groß je
    nachdem, wie viele Formate gleichzeitig angeschlossen werden. Keine Pflichtabnahme für die reine
    Requisiten-Bestellung; die Format-Anbindung (Spurt) selbst bräuchte eine eigene Messung. PixelLab:
    Requisit, frei bestellbar.
29. **Climbing: "Die steigende Flut"** (Format-Doku 3.2, zwölf an einer Wand, steigende Gefahr von
    unten). Groß, bedingt. **Pflichtabnahme ja** (Climbing ist rho-knapp bei 0,833, jede neue
    Teilnehmerstruktur braucht eine frische Messung). PixelLab: Requisit (Lava-/Wasser-Anstieg als
    Zeichenelement), keine neuen Figuren, aber die Wand-Geometrie für zwölf nebeneinander fehlt laut
    Doku — technische Machbarkeit zuerst klären.
30. **Showcase: "Das Niederbrüllen"** (Format-Doku 3.1, zwei gleichzeitig, Publikum entscheidet).
    Mittel–groß. **Pflichtabnahme ja.** PixelLab: keine neue Figur nötig (zwei vorhandene Auftritts-
    Posen gleichzeitig), ggf. Freigabe nötig, falls eine eigene "Unterbrechen"-Geste gewünscht wird.
31. **Basketball: Knockout produktionsreif machen** (Prototyp #1352 existiert, Builder fehlt im
    Motor). Groß, aber größtenteils Umsetzung, nicht neue Idee. **Pflichtabnahme ja** (zweite,
    unabhängige Kaderstichprobe laut PR-Text noch offen). PixelLab: keine (nutzt vorhandene Figuren).
32. **Gewichtheben: "Die Grube" (Tauziehen) produktionsreif machen** (Prototyp #1350 existiert).
    Groß, Umsetzung. **Pflichtabnahme ja** (Motor-Builder und Pp-Messung mit echten Kadern laut
    PR-Text noch offen). PixelLab: keine (nutzt vorhandene Figuren); die Requisiten (Zugring,
    Absturzkante) sind bereits im Prototyp gebaut und für Mini-DMs Grube wiederverwendbar.
33. **Battlefield: "Die Belagerung"** (Format-Doku 3.2). Groß, bedingt — der Pod ist frisch und
    sollte laufen, bevor er angefasst wird. **Pflichtabnahme ja**, wenn überhaupt begonnen.
    PixelLab: keine neuen Figuren, Fort-Requisit frei bestellbar.
34. **Eiskunstlauf: Vier-Aktive-Struktur** aus der Rempler-Vision Teil 2 (beide Duos gleichzeitig
    sichtbar). Groß, Teil einer laufenden Opus-/Fable-Recherche, nicht isoliert zu entscheiden.
    **Pflichtabnahme ja.** PixelLab: nutzt vorhandene Figuren, aber mehr gleichzeitige Pixel-Figuren
    auf der Fläche — technische Prüfung (Performance, Überlappung) nötig, keine neue Animation.
35. **Climbing: Sicherer-Zuruf als awareness-Nebenweg.** Mittel. **Pflichtabnahme ja** (jeder neue
    Kanal, der ein Attribut in der Praxis nutzbar macht, verschiebt Pp). PixelLab: keine (reiner
    Text-/Zahlen-Kanal).
36. **TDM: Shotcaller-Nebenweg** (charisma/spirit über Zielansage-Kaskade). Mittel. **Pflichtabnahme
    ja.** PixelLab: keine.
37. **Hockey: "Der Durchbruch"** (Format-Doku 4.2) als möglicher zweiter, Pp-tauglicherer Weg.
    Groß, eigene Mechanikrunde. **Pflichtabnahme ja**, das ist der eigentliche Zweck des Formats.
    PixelLab: keine neuen Figuren, Bande/Kante-Requisit ggf. frei bestellbar.
38. **Football: "Die Hai-Gasse"** (Format-Doku 4.1) als möglicher zweiter, Pp-tauglicherer Weg.
    Groß, eigene Mechanikrunde — Football hat mit 121 Pp den größten Nachholbedarf im ganzen Feld.
    **Pflichtabnahme ja.** PixelLab: Hai-Becken-Requisit frei bestellbar, keine neuen Figuren.
39. **Fechten: "Die Mêlée"** (Format-Doku 3.1). Groß, mit eigenem Risikohinweis (früherer
    Format-Fehlschlag in der Arena). **Pflichtabnahme ja**, und besonders sorgfältig wegen des
    knappen Pp-Puffers. PixelLab: keine neuen Figuren.
40. **I-Spy: "Das Verhör"** (Format-Doku 3.1). Mittel–groß, aber laut Doku selbst zuletzt anzugehen
    wegen des 0,011-Puffers auf einem Strom. **Pflichtabnahme ja.** PixelLab: keine neuen Figuren
    (nutzt vorhandene Verhör-/Untersuchungs-Pose).
41. **Wettessen: "Das Ekelroulette"** (Format-Doku 3.1). Mittel–groß. **Pflichtabnahme ja.**
    PixelLab: keine neuen Figuren, Kotzeimer-Requisit frei bestellbar.
42. **Speed-Schach: "Der Blitz-Gauntlet"** (Format-Doku 3.1). Mittel, aber Doku warnt selbst "am
    Rand des Skin-Verdachts". **Pflichtabnahme ja**, falls umgesetzt. PixelLab: keine.
43. **Spurt: "Die Hatz"** (Format-Doku 4.3). Mittel–groß, bereits vertieft dort. **Pflichtabnahme
    ja.** PixelLab: Fegearm-/Stier-Requisit frei bestellbar (Wiederverwendung des Walzen-Bausteins
    aus Abschnitt 2 möglich), keine neuen Figuren.
44. **Breaking: "Die zwölf Pfähle"** (Format-Doku 3.1). Mittel–groß, torturethematisch konsistent
    mit CLAUDE.mds Folter-Leitlinie. **Pflichtabnahme ja** (Breaking ist rho-knapp bei 0,801, hier
    besonders sorgfältig messen). PixelLab: Pfahl-Requisit frei bestellbar, keine neuen Figuren für
    das Grundformat — ein eigener "Henker"-Auftritt wäre eine neue Animation und bräuchte Freigabe.
45. **Takeshi's Castle: "Der Sturm auf die Burg"** (Format-Doku 3.1). Groß. **Pflichtabnahme ja.**
    PixelLab: nutzt vorhandene Fallen-Requisiten, Rammbock/Wasserkanone ggf. neue Requisiten (frei
    bestellbar), keine neuen Figuren.
46. **Staffel: "Die Verfolgungsjagd"** (Format-Doku 3.3) — von der Format-Doku selbst bereits
    zurückgestellt (zu nah am Skin, kein Pp-Puffer). Nur zur Vollständigkeit gelistet, **nicht
    empfohlen**. Groß. Pflichtabnahme ja, falls doch versucht. PixelLab: keine.
47. **Time-Trial: kein zweites Format** — von der Format-Doku selbst ausgeschlossen (jede Variante
    gehört zu einer anderen Disziplin). Nur zur Vollständigkeit gelistet, **nicht empfohlen.**
48. **Eiskunstlauf: kein zweites Format** — von der Format-Doku selbst ausgeschlossen (Matrix ohne
    power/health/stamina). Nur zur Vollständigkeit gelistet, **nicht empfohlen.**

---

## 4. Was ich bewusst nicht vorgeschlagen habe

- **Keine neue PixelLab-Figur und keine neue Animation ohne Freigabe.** Jede Idee oben, die eine
  neue Bewegung bräuchte (Henker-Auftritt bei den zwölf Pfählen, eine eigene "wird
  hineingeschubst"-Pose für Mini-DM), ist als Vorschlag markiert, nicht als Bestellung — Chris
  entscheidet Umfang/Kosten zuerst, wie bei der Nord-Animation-Kampagne.
- **Keine Breakdance-Recherche für Breaking.** Alle Format- und Kulissenideen bleiben im
  Folter-/Survival-Register (Pfähle, Henker, Aushalten) statt im Tanz-Register.
- **Keine Änderung an `official-discipline-weights.ts`.** Jede Format- und Mechanikidee liest nur
  Attribute, die die jeweilige Disziplin schon gewichtet (teils per erlaubtem Override wie bei
  Football), nie die Matrix selbst.
- **Keine neue Mechanik für Hockey/Football, die die eigentliche Pp-Ursache ersetzt.** "Der
  Durchbruch" und "Die Hai-Gasse" sind als **zweiter Weg neben** dem heutigen Rezept gedacht, nicht
  als Entschuldigung, die Pp-Pflichtprüfung am Live-Feldspiel selbst aufzuschieben.
