# Ingame-Qualitäts-Review: läuft es sauber, tragen Assets und Bewegung? (10.11.)

Anlass, Chris wörtlich: „läuft alles sauber? hast du es ingame reviewt? sind die assets gut?
bewegen sich die spieler realistisch? kommt das auch ohne custom animationen gut rüber etc".

Dieses Dokument ist **keine** Priorisierung (die steht in
`docs/design/alle-diszis-top-niveau-fahrplan-09-11.md`) und **kein** Kulissen-Audit (das steht in
`docs/design/kulissen-qualitaets-audit-08-11.md`). Es ist eine handwerkliche Sichtprüfung der
**Figuren im laufenden Spiel**: Fehler beim Laden und Zeichnen, Asset-Qualität aus der Nähe,
Bewegungsrealismus und vor allem die Frage, wie das Spiel dort aussieht, wo es für die Situation
**keine eigene Animation** gibt. Kein Code geändert, nichts bei PixelLab bestellt, die Matrix nicht
angefasst.

---

## 0. Kurzfassung

| Frage | Antwort |
|---|---|
| Läuft es technisch sauber? | **Ja, im engen Sinn.** 13 Läufe in 11 Disziplinen/Formaten: null Seitenfehler, null Konsolenfehler, null 404, jede PixelLab-Figur rechtzeitig geladen, kein Baukasten-Platzhalter gesehen. **Nein, im weiten Sinn:** in 8 von 11 Disziplinen liegen Figuren, Namen oder Tafeln sichtbar übereinander, und zwei Kameras zeigen zeitweise niemanden. |
| Sind die Assets gut? | **Die Figuren selbst ja.** Aus der Nähe (3- bis 4-fach vergrößert) sauber, gut lesbar, keine Matsch-Kanten, Größen stimmig. Die Schwächen sitzen bei den **Requisiten** (Hantel, Degen, Schachuhr) und bei den in Hintergrundbilder **eingebackenen Statisten** (HYROX-Kampfrichter). |
| Bewegen sich die Spieler realistisch? | **Nur dort, wo Gehen und Kämpfen die Sache selbst sind** (TDM, Battlefield-Duell, Basketball, die Laufstrecken von Spurt/HYROX). Überall sonst bewegt sich die Figur als **starres Standbild**, das verschoben, gekippt oder mit einem gezeichneten Strich ergänzt wird. |
| Trägt der generische Rückfall ohne eigene Animation? | **Bei den neutralen Zuständen ja, bei den Aktionen nein.** Die Grundpose (Stehen) trägt fast überall unauffällig. Wo die Disziplin aber eine *Handlung* zeigen muss, springt der Motor auf eine der vier Kampf-Animationen, und das fällt deutlich auf: Feuerzauber an der HYROX-Hürde, Hammerschlag beim Schachzug, Todesanimation beim Rutscher in der Kletterwand, Hantel schwebt über einem Heber mit hängenden Armen. |

**Der eine Satz, den man Chris zeigen sollte:** Jede der 360 PixelLab-Figuren hat genau vier
Bewegungsarten (Gehen, Angriff, Treffer, Tod). Kein einziges Disziplin-Verb (heben, klettern,
gleiten, fechten, ziehen, schieben) existiert als Animation, mit der einzigen Ausnahme von drei
HYROX-Posen für Cassandra auf dem HYROX-Zweig. Alles, was nicht Gehen oder Kämpfen ist, wird
deshalb entweder aus dem Standbild gebaut (trägt mal mehr, mal weniger) oder aus einer
Kampf-Animation geliehen (trägt nicht).

---

## 1. Wie geprüft wurde

**Echtes Spiel, nicht Code.** Für jede Disziplin lief die echte Battle Arena
(`/mockups/battle-mode.html`, derselbe Motor, den `FoundationBattleArenaHost.tsx` lädt) in
Playwright/Chromium über einen lokalen HTTP-Server, wie in `scripts/screenshot-kulisse.mjs`.
Abweichend davon blieb das **Figuren-Warten an** (`FIGUREN_WARTE_MS`, so wie es ein Zuschauer
erlebt), nur der Countdown und der Endstand-Nachlauf waren aus.

**Mehrere Zeitpunkte und Bildfolgen.** Je Disziplin 3–5 Zeitpunkte über das Spiel verteilt (2 s
bis 5:30), an jedem Zeitpunkt **sechs Bilder im Abstand von 120 ms**, damit Bewegung und
Posenwechsel sichtbar werden, nicht nur ein Standbild. Die Bilder wurden in voller Auflösung
(1240×470 über `toDataURL`) und als 3- bis 4-fache Ausschnitte (Nearest Neighbour) angesehen.

**Zählung, welche Figurenbilder wirklich gezeichnet werden.** Die Sonde hängt sich an
`CanvasRenderingContext2D.drawImage` der Leinwand `#cv` und zählt je Figur, aus welcher Datei
gezeichnet wird: Grundpose (`south/east/west/north.png`) oder Animationsstreifen
(`walk-*`, `angriff-*`, `treffer-*`, `tod-*`, bei Cassandra auf dem HYROX-Zweig zusätzlich
`hyroxTechnik/-Kletter/-Kraft`). Damit ist für jeden Zeitpunkt belegt, **welche Pose der Motor
für die Situation wählt**, nicht nur, wie sie aussieht. Außerdem mitgeschnitten: `pageerror`,
Konsolenfehler, jede HTTP-Antwort ≥ 400, `window.__arena.figurenStand()` beim Anpfiff und am Ende.

**Stände.** `main` (`972b970cb`) für Basketball, Fechten, Eiskunstlauf, Gewichtheben,
Speed-Schach, Breaking, TDM, Spurt klassisch, Battlefield (Duell und Vier-Team-Pod).
`claude/spurt-hyrox-routen-design-0911` (`14a18a72b`, HYROX-Hallenrunde) und
`claude/kulissen-qs-climbing-0811` (`ab9fbcadd`, Climbing „Rahmen statt Material") auf ihren
eigenen Zweigen. Standardkader und Standardsaat der Arena, der Pod mit den vier Teams aus
`data/generated/kaderfamilie-live-save.json` wie in `screenshot-kulisse.mjs --pod`.

Die Belegbilder liegen unter `docs/design/ingame-qualitaets-review-10-11/` (Nummern im Text).

---

## 2. Was es an Animationen überhaupt gibt

Nachgezählt in `data/generated/figuren-sprites.json` und auf der Platte unter
`public/sprites/figuren/`:

- **360 Figuren**, jede mit vier Grundposen (Süd/Ost/West/Nord).
- **Animationsarten:** `walk` 370, `angriff` 373, `tod` 366, `treffer` 360 (einige Figuren haben
  eine zweite Variante, z. B. `walk2`, `tod2`). Das sind **ausschließlich die vier Kampfarten**.
  `data/generated/figuren-sprites-animationsarten.json` bestätigt das: 1471 Einträge, nur diese
  vier Werte.
- Praktisch jede Figur hat alle vier: 356 von 360 mit `walk` unter diesem Namen (die übrigen
  sieben mit `walk2`), nur 5 ohne `angriff`, 4 ohne `tod`. Der Code-Kommentar an
  `zeichnePixelFigur()` („91 Figuren haben nur Grundposen") ist damit **veraltet**; die
  Ersatzbewegung aus der Grundpose (Wippen, Ausfallschritt, Umkippen) greift heute fast nie.
- **Disziplin-eigene Animationen: keine auf `main`.** Auf dem HYROX-Zweig drei Posen
  (`hyroxTechnik/-Kletter/-Kraft`, nur Ostrichtung) für **eine** Figur, Cassandra.

Die Zustandswahl in `zeichnePixelFigur()` ist für alle Disziplinen dieselbe:
liegend/`vizSturz` → `tod`, `u.lunge > 0` → `angriff`, HP gesunken → `treffer`, in Bewegung →
`walk`, sonst Grundpose. Eine Disziplin kann der Figur also nur über diese fünf Schalter sagen,
was sie tut. Wer „heben" oder „klettern" zeigen will, muss einen davon zweckentfremden oder die
Figur als Standbild verschieben/kippen.

---

## 3. Die Disziplinen im Einzelnen

Legende der Zählung: Anteil der sichtbaren Figuren je Zustand an einem Zeitpunkt.

### 3.1 HYROX-Hallenrunde (Zweig `claude/spurt-hyrox-routen-design-0911`) — frisch überarbeitet

**Technik:** sauber. Keine Fehler, alle Figuren geladen, Hallenbild und Bögen vorhanden.

**Gezählt:** Laufstrecke 10/10 `walk` (2 s, 80 s). An der Technik-Station (40 s): **7 von 10
`angriff`**, 1 `hyroxTechnik` (Cassandra), 1 `walk`, 1 gemischt. An der Kletter-Station (130 s):
2–3 `angriff`.

**Befunde:**

1. **Der Kampf-Rückfall an den Stationen ist der deutlichste Einzelbefund dieser Review**
   (Bild 01). Wer keine HYROX-Pose hat, bekommt an Hürde und Balken seine Angriffsanimation:
   Lulu sprüht gelbe Blitze, Gram schlägt mit Flammenwaffe, Jorund schwingt seinen Stab,
   Seraph-11 sticht. Der Code sagt das selbst (Kommentar an `HYROX_PIXEL_ART`: „faellt auf den
   bestehenden 'angriff'-Zweig zurueck ... eine Ausfallschritt-Pose statt der vorherigen
   liegenden 'tod'-Pose"). Das war eine Verbesserung gegenüber „liegt tot an der Station", aber
   als Bild liest es sich wie **ein Zauberduell an der Hürde**, nicht wie ein Sprung. Cassandra
   daneben mit ihrer eigenen Technik-Pose zeigt, wie es aussehen könnte.
2. **Die Kamera zeigt an 2 von 5 Zeitpunkten keinen einzigen Athleten** (15 s und 80 s,
   Bild 02): sie steht auf der leeren KRAFT-Station, während alle Läufer laut Fortschrittsleiste
   auf der Runde sind. Bei 2 s sitzt das Feld als Knäuel oben rechts am Bildrand, halb
   abgeschnitten, das rechte Fünftel der Leinwand ist schwarz.
3. **Eingebackene Statisten.** Die Kampfrichter im schwarz-gelben Trainingsanzug sind Teil des
   Hallenbildes `public/sprites/arena/hyrox_halle.jpg`, keine Figuren. Folge: alle identisch, alle
   in derselben Pose nach links, bewegen sich nie, und bei 2,7-facher Kamera sind sie **etwa
   doppelt so groß wie die Athleten** (Bild 02, Bild 03 rechts, und an der Kletterwand bei 130 s
   direkt nebeneinander). Im selben Bild ist auch eine Anzeigetafel „FINISH 1:02:37" fest
   eingebacken.
4. **Text übereinander:** Die Kopfzeile der Rangleiste („STRECKE", „TECHNIK · HÜRDE/BALKEN")
   liegt in jedem Bild **auf der ersten Zeile** („1. Tidesprint…" ist halb verdeckt). Über den
   Köpfen stapeln sich Taktik-Etikett und Name, bei drei eng beieinander laufenden Athleten
   (Seraph-11, Lulu, Jorund; Krag'Zul, Greenkraut, Gram) unlesbar (Bild 01).

**Urteil:** Die Laufstrecke trägt. Die Stationen, also genau das, was HYROX von einem Lauf
unterscheidet, tragen ohne eigene Posen nicht.

### 3.2 Climbing (Zweig `claude/kulissen-qs-climbing-0811`) — frisch überarbeitet

**Technik:** sauber. Keine Fehler, Wand, Griffe, Exen, Seile, Kreidebeutel gezeichnet.

**Gezählt:** durchgehend 10–11 von 12 Kletterern `walk`, bei Stürzen 1–2 `tod`.

**Befunde:**

1. **Klettern = Gehen auf der Stelle.** Die Kletterer stehen aufrecht vor der Wand und spielen
   ihren Gehzyklus, während sie nach oben verschoben werden. Arme greifen nie nach oben, Beine
   steigen nie an. Aus der Gesamtansicht (Bild 18) geht das als „Figuren an Seilen" noch durch,
   aus der Nähe ist es eine **auf Schienen gezogene Gehfigur**.
2. **Gemischte Blickrichtung an derselben Wand** (Bild 05): Ein Teil der Figuren zeigt den Rücken
   (Draco, Johanna, Seraph-11, Cassandra; richtig: man klettert zur Wand), ein Teil schaut den
   Zuschauer an (Lava Golem, Krag'Zul, Krolach, Ralazar). Das liegt an den Nord-Streifen der
   jeweiligen Figur und wirkt, als kletterten einige rückwärts.
3. **Ein Rutscher spielt die Todesanimation** (Bild 04): Gram liegt bei 15 s flach und quer in
   der Wand, das Endbild seiner `tod`-Animation, und das über mehrere Bildfolgen. Auslöser ist
   der Sturzzustand, den `zeichnePixelFigur()` (`u.down || u.vizSturz`) auf `tod` abbildet. Ein Sturz ins Seil wird so zur
   Leiche, die an der Wand klebt. Mit der neuen Freigabe vom 07.11. („Tod darf blutig/brutal
   sein") wird das schlimmer, nicht besser: jede Figur, deren Tod nachgebessert wird, stirbt dann
   auch beim Ausrutschen blutiger.
4. **Asset-Qualität:** die Figuren selbst sehr sauber, aber mit rund 45 px Höhe auf einer
   1240-px-Wand klein. Taktik-Etikett und Name sind gut lesbar.

**Urteil:** Kulisse deutlich besser als vor dem Rework. Die Bewegung trägt nicht: Gehen statt
Klettern und Tod statt Sturz sind die zwei auffälligsten Fehlbesetzungen nach HYROX.

### 3.3 Gewichtheben (main) — Bühne, älter

**Technik:** sauber. Kulisse Hafen gehört zu den schönsten Bildern im Spiel.

**Gezählt:** an allen vier Zeitpunkten **12 von 12 Grundpose**, kein einziges Animationsbild.

**Befund — das zweitstärkste Gegenbeispiel** (Bilder 06, 07): Der Heber steht in seiner
Grundpose, die Hantel wird als Requisit in der richtigen Phasenhöhe dazugezeichnet. In der
Überkopf-Phase **schwebt die Stange frei über dem Kopf**, während die Arme der Figur unten
bleiben: Greenkraut hockt mit den Händen vor der Brust, Draco steht mit hängenden Armen, über
beiden die Hantel. In der Zugphase kippt die Stange schräg vor dem Körper, die Figur bleibt
unverändert. Die Höhenlogik im Code (Körperspanne statt Griffpunkt, 13.09.) arbeitet richtig;
es fehlt schlicht eine Figur, die die Arme hebt. Das 13.09.-Problem „stemmt Luft" ist damit
umgekehrt da: **die Luft stemmt die Hantel**.

**Urteil:** Kulisse A, Bewegung C. Die Disziplin, die am meisten von einer einzigen eigenen Pose
(„Arme oben") profitieren würde.

### 3.4 Eiskunstlauf (main) — Bühne, älter

**Technik:** sauber.

**Gezählt:** 8–10 von 12 Grundpose; Elemente als `angriff`, Stürze als `tod`.

**Befunde** (Bild 09):

1. **Gekippte Standbilder statt Lauf.** Die Läufer gleiten als ungedrehte Grundpose übers Eis,
   Drehungen und Elemente entstehen, indem das ganze Bild um bis zu 45° gekippt wird. Im
   Paarlauf sieht das bei Greenkraut wie Umfallen aus. Eine weiße Kufenlinie unter den Füßen ist
   der einzige Hinweis aufs Eis.
2. **Die Waffe bleibt in der Hand.** Gram läuft seine Kür mit der Flammenaxt, weil sie Teil
   seiner Grundpose ist.
3. **Paare übereinander.** Im Duett stehen beide Figuren fast am selben Punkt und überdecken
   sich (Krag'Zul über Greenkraut). Die Punkte-Einblendungen („SSp +28", „3F +48") liegen auf dem
   Programmnamen („Morgentau, zart, ruhig"), Namen und Punkte hängen teils 60–80 px neben der
   Figur, zu der sie gehören.
4. **Maßstab:** zwei kleine Figuren auf einer leeren Eisfläche, die 80 % der Leinwand einnimmt.

**Urteil:** Der Rückfall ist hier nicht „falsch", er ist **leblos**: eine Kür, in der sich niemand
bewegt, nur gedreht wird. Deckt sich mit Audit-Note C.

### 3.5 Fechten (main) — Bühne, älter

**Technik:** sauber. Hauptbahn plus fünf Nebenbahnen unten, Anzeigetafel lesbar.

**Gezählt:** 10 von 12 Grundpose, die zwei Fechter zusätzlich gelegentlich `angriff`.

**Befunde** (Bild 10): Die Fechter stehen als Statuen, der Degen ist eine **dünne weiße Linie**
aus der Hand, die ihren Winkel ändert. Draco hält dabei weiter seine Axt aus der Grundpose, die
weiße Degenlinie kommt zusätzlich aus derselben Hand. Greenkraut ficht aus der Hocke. Ein
Ausfallschritt ist nur zu sehen, wenn `angriff` greift, und dann mit der eigenen Waffe der
Figur, nicht mit dem Degen. Die Nebenbahnen unten zeigen winzige Figuren (~20 px), die
nichts tun.

**Urteil:** lesbar, aber kein Fechten zu sehen. Unauffälliger als Gewichtheben, weil ein Strich
in der Hand weniger stört als eine schwebende Hantel.

### 3.6 Speed-Schach (main) — Bühne, älter

**Technik:** sauber. Park-Kulisse und Demonstrationsbrett sehr gut.

**Gezählt:** Grundpose, beim Zug kurz `angriff`.

**Befund** (Bild 08): **Ein Schachzug ist ein Hammerschlag.** Johanna holt beim Zug mit einem
Kriegshammer aus, weil das ihre Angriffsanimation ist. Die Schachuhr liegt als weißes Kästchen
an ihren Füßen. Die Figuren sind mit gut 30 px sehr klein neben dem großen Brett; man sieht das
nur im Ausschnitt, in der Gesamtansicht fällt es kaum auf.

**Urteil:** Grundpose trägt (Schachspieler stehen eben), der Angriffs-Rückfall nicht. Da er nur
Sekundenbruchteile dauert und die Figuren klein sind, ist es ein leiser, kein lauter Fehler.

### 3.7 Breaking (main) — Bühne, Folter-Zweikampf

**Technik:** sauber.

**Gezählt:** 10 von 12 Grundpose, Peiniger und Opfer zusätzlich `angriff`.

**Befund** (Bild 11): Hier passt `angriff` ausnahmsweise zur Sache (der Peiniger schlägt zu).
Aber **Peiniger und Opfer stehen auf demselben Punkt**: Draco und Krag'Zul verschmelzen zu einem
Klumpen, und die Etiketten darunter liegen ebenfalls übereinander: „PE ERTRÄGT" / „DrKrag'Zul"
und im nächsten Bild „ERTRÄGTNIGT" / „Dracoag'Zul". Die Trait-Einblendungen über dem Kopf
(„SURVIVOR · UNBROKEN") werden von der Figur verdeckt.

**Urteil:** Bewegung passend, Platzierung fehlerhaft. Einfach zu beheben (Versatz), sieht aber
aktuell aus wie ein Darstellungsfehler.

### 3.8 Basketball (main) — Feldspiel, älter

**Technik:** sauber. Parkett, Körbe, Ball, Schiedsrichter.

**Gezählt:** 9–10 von 12 `walk`, dazu `angriff` bei Würfen/Pässen. Das ist die Disziplin, in der
die Gehanimation am natürlichsten passt.

**Befunde** (Bilder 14, 15):

1. **Laufen sieht gut aus.** Die Gehzyklen sind flüssig, die Blickrichtung folgt der Bewegung, der
   Ball sitzt an der Hand. Positiv hervorzuheben.
2. **Pulkbildung.** Bei 30 s stehen 9 von 10 Spielern in einem Haufen um den Mittelkreis, bei 60 s
   alle zehn in einer senkrechten Perlenkette an der Dreierlinie, Körper und Namen übereinander,
   der Rest des Feldes leer. Das ist kein Grafik-, sondern ein Aufstellungsproblem, wirkt aber
   unrealistisch: Basketball wird breit gespielt.
3. **Stilbruch Schiedsrichter:** eine schlichte Figur in anderem Zeichenstil (glatzköpfig,
   gestreift, kein PixelLab-Detail) neben den detaillierten Spielern. Derselbe Bruch wie bei den
   HYROX-Kampfrichtern und den kleinen Sicherern unter der Kletterwand.

**Urteil:** Bewegung glaubwürdig im Einzelnen, unglaubwürdig in der Formation.

### 3.9 TDM (main) — Referenz, wo alle vier Animationen „zu Hause" sind

**Gezählt:** bei 25 s gemischt `angriff`, `treffer`, `walk`, kaum Grundpose.

**Befund** (Bild 16): So sollen die Figuren wirken, und so wirken sie auch: Ausholen, Getroffen-
Zucken, Laufen, alles mit eigener Animation. **Die Figuren und ihre Kampfanimationen sind das
stärkste Asset des Spiels.** Einschränkung: Die Kamera zoomt nicht; das Gefecht klebt bei 25 s am
rechten Rand, 70 % der Leinwand sind leerer Boden, und zwei Fähigkeits-Einblendungen
(„Paladin Slash (aufgeladen)") liegen geisterhaft übereinander.

### 3.10 Battlefield (main): Duell und Vier-Team-Pod

**Technik:** sauber. Im Pod waren alle 43 Figuren beim Anpfiff geladen, **keine kahlen
Platzhalter** (deckt sich mit dem A2-Befund im Fahrplan: das ist ein Netz-/Lastthema, lokal nicht
zu sehen).

**Gezählt:** Duell bei 30 s wie TDM gemischt. **Pod ab 15 s 12–15 von 16 Grundpose** und das bis
5:30.

**Befunde:**

1. **Pod = Stellungskrieg** (Bilder 12, 13): Ab etwa 0:30 stehen die vier Teams in **zwei
   senkrechten Linien** links und rechts der Mittelachse, rund 190 px auseinander, und bewegen
   sich kaum noch. Bei 0:45 und 1:30 haben alle vier Teams 0 Punkte, alle drei Flaggen neutral, und
   die Bilder sind bis auf zwei Gefallene identisch. Bei 4:00 hat ein Team 52 Punkte, die Linien
   stehen noch immer. Gekämpft wird fast nur über Fernkampf-Strahlen zwischen stehenden Figuren.
   Das passt zur Pacing-Klage im Fahrplan (Pod 7:12), hier ist die **Ursache sichtbar**: lange
   Phasen ohne Bewegung.
2. **Gefallene** liegen halbtransparent als Endbild der `tod`-Animation, das ist gut gelöst.
3. **Duell:** alle zwölf Kämpfer drängen sich in einer Säule auf dem Mittelweg, Namen und das
   Flaggen-Etikett („Nord — Armageddon Aftermath") werden überdeckt.

### 3.11 Spurt klassisch (main) — Kontrast zu HYROX

**Gezählt:** 8–10 von 10 `walk`, an Hindernissen kurz `angriff`.

**Befund** (Bild 17): Beim Start kleben alle zwölf Läufer am linken Bildrand, Taktik-Etiketten
werden bei x = 0 abgeschnitten („indschatten · Sog"), das Etikett „③ PALISADE" wird von der
Palisade überdeckt. Danach laufen die Figuren sauber; an den Hindernissen greift derselbe
`angriff`-Rückfall wie bei HYROX, fällt aber bei der Gesamtansicht weniger auf, weil die
Figuren klein sind.

---

## 4. Querschnitt: was durchgehend auffällt

### 4.1 Technisch sauber, aber Überdeckung überall

Kein einziger Lauf hatte einen Seitenfehler, einen Konsolenfehler oder eine fehlende Datei, und
`figurenStand()` meldete beim Anpfiff immer `alle: true`. Das ist der gute Teil.

Der schlechte Teil ist **Platzierung**: in HYROX, Climbing (Etiketten), Eiskunstlauf, Breaking,
Basketball, Battlefield (Duell und Pod), Spurt und TDM liegen Figuren, Namen oder Einblendungen
sichtbar übereinander. Einzeln ist jedes davon klein; zusammen ist es der häufigste sichtbare
Mangel dieser Review. Einen gemeinsamen Etiketten-Verdränger (Namen, die sich überlappen,
weichen aus oder werden zusammengefasst) gibt es nicht.

### 4.2 Assets: Figuren stark, Statisten und Requisiten schwach

- **Figuren:** aus der Nähe durchweg gut. Keine Matsch-Kanten, `imageSmoothingEnabled=false` sorgt
  für saubere Pixel, Größen über Menschen, Golems und Wesen hinweg stimmig. Das „aus der Ferne
  gut, aus der Nähe matschig" aus früheren Runden trifft auf die PixelLab-Figuren **nicht** zu.
- **Statisten:** Kampfrichter (HYROX), Schiedsrichter (Basketball), Sicherer (Climbing) sind in
  einem anderen, schlichteren Stil gezeichnet oder ins Hintergrundbild gebacken. Bei HYROX sind
  sie dadurch doppelt so groß wie die Athleten.
- **Requisiten:** Hantel, Degen und Schachuhr sind gezeichnete Formen an einem Rechenpunkt, nicht
  in einer Hand. Solange die Figur passend steht, geht das; sobald die Requisite eine Haltung
  verlangt (Hantel über Kopf), schwebt sie.

### 4.3 Bewegung: drei Klassen

| Klasse | Disziplinen | Wirkung |
|---|---|---|
| **Heimisch:** Gehen und Kämpfen sind die Sache selbst | TDM, Battlefield-Duell, Basketball, Laufstrecken von Spurt/HYROX/Staffel | glaubwürdig |
| **Standbild verschoben/gekippt** | Climbing, Eiskunstlauf, Fechten, Gewichtheben, Pod-Stellungskrieg | auf Schienen; lesbar, aber leblos |
| **Kampf-Animation zweckentfremdet** | HYROX-Stationen, Spurt-Hindernisse, Speed-Schach-Zug, Climbing-Sturz (`tod`), Eiskunstlauf-Sturz (`tod`) | falsche Pose, fällt auf |

### 4.4 Trägt der Rückfall ohne eigene Animation?

**Grundpose als Rückfall: ja, meistens.** Schachspieler, wartende Heber, Fechter in Grundstellung,
die Reihe am Bühnenrand: dort ist Stehen richtig, und die PixelLab-Grundposen sind gut genug,
dass es nicht auffällt.

**Kampf-Animation als Rückfall: nein.** Sie wird genau dann gezeigt, wenn die Disziplin ihren
Höhepunkt hat (die Station, der Zug, das Element), und sie bringt dann Waffen, Zauber und
Flammen ins Bild, die dort nichts zu suchen haben. Das ist der Teil, den ein Zuschauer bemerkt.

**Tod als Rückfall für einen Sturz: nein, und es wird schlimmer.** (`u.down || u.vizSturz` → `tod`,
gilt für jedes Chassis.) Seit Chris am 07.11. brutalere
Tode freigegeben hat, ist ein Rutscher in der Kletterwand oder ein Sturz auf dem Eis potenziell
ein blutiger Tod. Diese Abbildung (`vizSturz` → `tod`) sollte getrennt werden, bevor neue
Todesanimationen ankommen. Das kostet keine Bestellung: ein gekipptes Standbild oder das erste
Drittel des `treffer`-Streifens wäre neutraler.

---

## 5. Was daraus folgt (Vorschläge, keine Aufträge)

Ohne PixelLab, nur Code (nach Aufwand sortiert):

1. **Sturz ≠ Tod.** `zeichnePixelFigur()` bildet `u.down || u.vizSturz` auf `tod` ab. Betroffen
   sind gemessen Climbing (Abrutschen) und Eiskunstlauf, laut Code außerdem Showcase-Patzer
   (`vizSturz` aus `failWort`) und Hockey-Stürze (`traeger.down=true` für `HK_STURZ`). Dort einen
   neutralen Rückfall statt `tod`; in TDM/Battlefield bleibt `tod` richtig. Klein, und vor jeder
   Tod-Nachbesserung wichtig.
2. **Kampf-Rückfall an Nicht-Kampf-Handlungen ersetzen.** Für HYROX-Stationen, Spurt-Hindernisse
   und den Schachzug lieber die Ersatzbewegung aus der Grundpose (Wippen, Ducken, kurzer Hüpfer,
   die es in `zeichnePixelFigur()` schon gibt) als `angriff`. Unauffällig statt falsch.
3. **Überdeckung:** Versatz für Breaking (Peiniger/Opfer), Eiskunstlauf-Paare und HYROX-Rangleiste
   (Kopfzeile über Zeile 1). Mittelfristig ein gemeinsamer Etiketten-Verdränger.
4. **HYROX-Kamera:** nicht auf eine leere Station schalten, solange niemand dort ist.

Mit PixelLab (**nur nach Chris' Freigabe**, hier nichts bestellt): Die Rangfolge nach Wirkung je
Bestellung wäre (a) eine Überkopf-/Hebepose für Gewichtheben, weil dort die gesamte Disziplin an
einem Bild hängt, (b) die HYROX-Arbeitsposen für mehr als Cassandra, (c) eine Kletterpose. Alle
drei sind 360-fach-Bestellungen, wenn sie für jede Figur gelten sollen; eine Alternative wäre, die
Pose nur für die Figuren zu bestellen, die in der Disziplin tatsächlich antreten.

---

## 6. Gesamteinschätzung, ehrlich

- **Läuft es sauber?** Technisch ja: kein Fehler, kein fehlendes Bild, kein Platzhalter in 13
  Läufen. Darstellerisch nein: Überdeckungen in 8 von 11 Disziplinen und zwei Kamera-Aussetzer bei
  HYROX.
- **Sind die Assets gut?** Die Figuren sind sehr gut, auch aus der Nähe, und die Kulissen von
  Gewichtheben, Schach, TDM und Battlefield sind Spitzenklasse. Schwach sind die Statisten (anderer
  Stil, falsche Größe) und die Requisiten, die eine Haltung bräuchten.
- **Bewegen sich die Spieler realistisch?** In den Lauf- und Kampfdisziplinen ja. In den Bühnen,
  an der Kletterwand und an den HYROX-Stationen nicht: dort werden Standbilder verschoben oder
  gekippt.
- **Kommt es ohne eigene Animationen gut rüber?** Halb. Wo der Rückfall „Stehen" heißt, ja. Wo er
  „Angriff" oder „Tod" heißt, nein, und genau diese Momente sind die Höhepunkte der jeweiligen
  Disziplin. Die frisch überarbeiteten Disziplinen (HYROX, Climbing) haben deutlich bessere
  Kulissen als die älteren, aber **keine besseren Bewegungen**: die Kulisse ist gewachsen, die
  Figur nicht. Das ist der Qualitätsunterschied, den man heute am deutlichsten sieht.
