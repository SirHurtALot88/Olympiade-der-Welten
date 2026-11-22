# Takeshi's Castle: ruckelt, unübersichtlich, zu schnell vorbei (Welle 4, 22.11.)

Chris' Livebefund. Alles reine Anzeige: Wertungs-Fingerabdruck `GESAMT ea36f666cc71` (Stand origin/main 67afd95d8)
und alle Schutzsummen unverändert. Keine neuen Felder an Läufer-/Spielerobjekten, keine PixelLab-Bestellung.
Messsonde: `scripts/miss-takeshi-frametimes.mjs` (echte Arena, Vier-Team-Pod, Tempo 1x, Frametimes, Sendedauer,
Aufnahmen). Headless-Chromium ohne GPU auf einem Rechner, den mehrere Agenten teilen: absolute Frametimes
streuen von Lauf zu Lauf um ±15 %, belastbar sind nur die Op-Zahlen und die abwechselnd gemessene Mikrosonde.

## 1. Ruckeln

Befund (Vier-Team-Pod, 1920x1080): Takeshi lag im Mittel bei 26 ms je Bild, die Staffel im selben Pod bei 17 ms; dazu
Ausreißer-Bilder über 60 ms, gehäuft zwischen Sekunde 11 und 24 (dort scheiden Läufer aus). Drei Ursachen gefunden:

1. **Karte jedes Bild neu gezeichnet.** `bodenTakeshiRoute()` malte Wiese, Zonen, Route (160 Punkte je Abschnitt),
   Absperrbänder, Steine, Wald, Tor und Burg bei jedem Bild: 295 `lineTo`, 172 `beginPath`, 116 `fill` je Bild.
   Neu: einmal in eine Offscreen-Leinwand (Weltkoordinaten, Auflösung 2x bis 3x je nach Zoom und Pixeldichte),
   je Bild nur noch ein `drawImage`. Neu gebaut wird bei anderer Route/Breite/Zonenliste, neu geladenen Kulissenbildern
   oder wenn der Zoom mehr Auflösung braucht (nur aufwärts). Wellen auf dem See (zeitabhängig) laufen weiter je Bild.
   Fallen, Pfähle, Publikum, Bäume bleiben dynamisch gezeichnet (Reihenfolge unverändert). Fehlt Offscreen-Canvas
   (Node-Motor), zeichnet der alte Weg direkt. Canvas-Aufrufe je Bild: `lineTo` 295 -> 77, `beginPath` 172 -> 75,
   `fill` 116 -> 55.
2. **Ausgeschiedene grau gerechnet über `getImageData`.** `zeichneSpriteGrau` las je Ausgeschiedenem und Bild 61 000
   Pixel zurück und rechnete sie in JS um; bei 24 Läufern wuchs das mit jedem Ausscheiden (die Ausreißer ab Sekunde 11).
   Neu: ein einziges gefiltertes `drawImage` (`grayscale(1) brightness(0.8)`), kein Rücklesen.
3. Nebenbefund, nicht angefasst: Wertungstabelle und Kaderleiste bauen ihr DOM im laufenden Spiel 10x je Sekunde
   neu (schon gedrosselt); das Zeichnen von Text zwingt dabei einmal je Bild die Stil-Neuberechnung (`setzeFont` taucht
   im Profil oben auf, ist aber Stil/Layout-Zeit des HUD, nicht die Schrift). Eine Signatur-Prüfung vor dem Neubau
   wäre der nächste Hebel (gemeinsamer Code aller Bahn-Disziplinen, deshalb nicht ohne breite Nachmessung).

Messung (abwechselnd, 4 Runden x 200 Einzelbilder, Simulation + Zeichnen je `sondenLauf(1)`, Median / p90):
vorher 9,4 / 14,5 ms, nachher 7,8 / 12,0 ms (-17 %). Frametimes im Echtzeitlauf liegen im Rauschen
(vorher 25-31 ms Mittel, nachher 23-28 ms); Bilder über 60 ms: vorher 52 und 11 (zwei Läufe), nachher 22 und 11.
Die erwartete Wirkung auf echter GPU (weniger Draw-Calls, kein Rücklesen) ist damit plausibel, aber auf Chris'
Rechner nicht gemessen.

## 2. Unübersichtlich

Im Vier-Team-Pod (mehr als 12 Läufer) tragen nur noch **Hauptdarsteller** Name, Plan und Punkte: das eigene Team
(Seite 0, Heim), der Führende jedes Teams und alle im Ziel. Alle anderen bekommen eine kleine **Marke in Teamfarbe**
über dem Kopf (Ausgeschiedene gedimmt); das eigene Team zusätzlich einen **Bodenring** in Teamfarbe. Statt 24
dreizeiligen Etiketten stehen im Startpulk etwa 9. Das Duell (12 Läufer) bleibt unverändert. Der Rest (Streckenband,
Führungs-Banner, Falle-Lower-Third, "noch N im Rennen", Team-Kacheln) war schon da und bleibt.

Nicht gebaut (Vorschläge, würden Kamera/Regie anfassen): Hindernis-Kamera mit Zoom auf die Falle mit dem größten
Gedränge, Zeitlupe bei Stürzen (Ereignisse existieren bereits als Ticker-Zeilen), eigene Zeitlupen-Wiederholung des
Zielmoments. Die Dev-Seite zeigt die Leinwand klein (938 px breit); im Spiel ist sie bildschirmfüllend, die Marken
skalieren mit.

## 3. Zu schnell vorbei

Sendedauer im Vier-Team-Pod (Wandzeit Tempo 1x, Messsonde): **61,8 s -> 122-126 s** (die Läufe nach der Bremse liefen teils unter Last von tsc/vitest, deren Frametimes sind unbrauchbar); Duell 0:58 -> rund 1:56.
`ZEIT_DEHNUNG["takeshis-castle"]` (2,17) bleibt, weil sie in die Zeit-Spalten der Wertungstabelle eingeht: ein
Test mit 4,3 bewegte `spiele takeshis-castle` (1/7/42) im Fingerabdruck. Stattdessen neue, rein anzeigeseitige
`ANZEIGE_BREMSE` (Takeshi 2): `loop()` sammelt halb so viele Sechzigstel je Wandsekunde, die Ticks bleiben das feste
1/60 der Buchung (bahnSimAcc), Interpolation und Kamera laufen weich. HUD-Uhr zählt mit (2:02 am Ende). Quick-Sim
ungebremst. Bekannte Unschärfe: Zielzeiten in Tabelle und Ticker bleiben im alten Maßstab (ca. 1:02 für ein 2:02-Rennen),
weil sie durch `zeitFaktor()` laufen; sie jetzt mitzuziehen hieße, die Tabellenwerte (und den Fingerabdruck) zu ändern,
das ist ein Vorschlag für eine Wertungsrunde.

## Aufnahmen

`docs/design/takeshi-lesbarkeit-22-11/`: `vorher-*`/`nachher-*` je 1920x1080 und 2560x1440 (Start, Lauf, Ende).
Geprüft: Karte pixelgleich zum Vorher (Absperrbänder, See, Route), Ende-Bild mit "ENDSTAND", Burgpunkten und
Kaderleiste; keine Seitenfehler.
