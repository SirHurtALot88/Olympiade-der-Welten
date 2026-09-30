# Fable-Ideen: Broadcast-Präsentation der Live-Arena (30.09.)

**Ideendokument, kein Audit, kein Code.** Der Auftrag: frische, umsetzbare Ideen dafür, wie sich
die Live-Arena (`public/mockups/battle-mode.engine.js` / `.css` / `.html`) beim ZUSCHAUEN noch mehr
wie eine moderne Sport- oder Esport-Übertragung anfühlt. Nicht Gameplay, nicht Wertung — nur das,
was man sieht und hört. Parallel läuft ein kritischer Qualitäts-Audit (Neuauflage des 27.09.);
dieses Papier kritisiert nicht, es schlägt vor. Wo ich beim Ansehen trotzdem über etwas gestolpert
bin, steht es in Abschnitt 6 als Randnotiz für den Audit, nicht als Idee.

Grundlage: `origin/main` `24a8e1e1` (Stand 29.09., nach Broadcast-Optik Phase 5), die drei
Broadcast-Papiere vom 06.09. und 22.09., die sechs Chassis-Recherchen vom 27.09. (liegen nur auf
den `broadcast-*-recherche-27-09`-Branches) und die Commit-Texte der Phasen 3–5. Angesehen per
Playwright (Chromium, echter HTTP-Server, 1300 px): TDM (Kampf), Hockey und Basketball (Feldspiel),
Fechten, Gewichtheben und Eiskunstlauf (Bühne), Staffel und Takeshi's Castle (Bahn) — jeweils
Einlauf, laufendes Spiel und Endstand.

**Klassen** (dieselbe Sprache wie die 27.09.-Papiere): **A** reine Anzeige/CSS/Ton, liest nur
vorhandenen Zustand, kein `rr()`, kein Schreiben in die Simulation; **A\*** wie A, braucht aber eine
kleine neue Anzeige-Buchhaltung (ein Merker, ein Ringpuffer) im Zeichen- oder HUD-Pfad; **T** greift
in die Wandzeit-Taktung (`loop()`/`speed`) ein, Simulation bleibt bit-identisch, braucht aber den
Determinismus-Beleg aus dem Feldspiel-Papier 1.3; **S** braucht neuen Simulations- oder
Spielstands-Zustand (Chris entscheidet); **W** berührt Wertung oder Regeln (Chris entscheidet, nicht
Gegenstand dieses Papiers). Die Abnahme für A/A\* ist immer dieselbe: `node scripts/miss-alle-
disziplinen.mjs 24 <disziplin>` vorher/nachher bit-identisch, dazu Sichtprüfung über
`scripts/screenshot-disziplin.mjs`.

---

## 0. Was schon existiert — damit nichts doppelt vorgeschlagen wird

Die Arena hat nach fünf Phasen ein erstaunlich vollständiges Broadcast-Grundgerüst. In einem Satz
je Ebene, mit den Funktionsnamen, an denen die Ideen unten andocken:

| Ebene | Was steht (Auswahl) | Wo |
|---|---|---|
| Persistente Grafik | Score-Bug mit Teamfarbe, Führungsblitz, Kontextzeile (Periode, Restzeit abwärts, Shot-Clock, PP-Uhr, SOG, Ballbesitz), Lebens-Pips + Überzahl, KP-Zeile, Lauf-Band | `aktualisiereBbug()`, `feldspielKontextZusatz()` |
| Disziplin-HUDs im Bild | Staffel-HUD mit Live-Delta und Bein-Zeile, Streckenband für vier Bahnen, Hot Seat + Geisterfahrer + Zwischenzeit-Tafel (Zeitfahren), Fallen-Schild + „Noch im Rennen" (Takeshi), FIE-Tafel + Trefferlampen + Bahnleiste (Fechten), Schachuhr-Zeitnot + Eval-Kurve + `??`, Hawk-Eye (Tennis), Zwischenstand-Tafel + L/C-Halo + Kiss & Cry (Eiskunstlauf), Versuchstafel + Bedarfszeile (Heben), Kettenleiste + HP-Balken + Qual-Skala (Breaking), Zug-Uhr + Split-Tafel + Split-Screen (I-Spy), Duell-Band + Balance-Ring (Climbing), Wendetafeln + Tempo + Schlussminute (Wettessen), X-Wand + Applaus-Meter + Jury-Stühle (Showcase) | je `zeichne*()` / `updateHud*()` |
| Momente | `feed(...,big,caption,kind,verzögerung)` → Callout-Banner + `HIGHLIGHTS[]`; spielweite Drossel im Kampf (`kampfGrossDrosseln`), Momentarten First Blood / Führungswechsel / Mehrfach / entscheidend; Torlicht + Bandenblitz, GEBROCHEN-Stempel, Goldener Buzzer, Zeitlupen-Wiederholung als Bild-im-Bild im Kiss & Cry, Sturzmarke, Anker-Einblendung, MXC-Captions | `callout()`, `feed()`, `CAPTION_*` |
| Rahmen | Einlauf (Wappen, Platz, Disziplin-Rang, Aufstellung mit Eignung + Anpassung), Viertelpause mit Buzzer (nur Basketball), Endstand im Nacht-Look mit Sieger-Verlauf, Boxscore, „Szene des Spiels", Höhepunkte-Chips | `renderEinlauf()`, `starteViertelpause()`, `renderEndstand*()` |
| Ton | Prozeduraler Katalog für 15 Disziplinen aus fünf Bausteinen, Publikums-Loops, Herzschlag (Breaking), Klatschrhythmus (Heben), Basketball mit echten Dateien | `TON_KATALOG`, `sfx()`, `tonLoopStart()` |
| Zeit | Zuschauzeit je Disziplin (`ZEIT_DEHNUNG`), Tempo-Taste 1×/2×/4×, `hud-in`-Einblendung, `prefers-reduced-motion` | `loop()`, `zeitFaktor()` |

**Schon vorgeschlagen, bewusst nicht gebaut** (27.09.-Papiere, überwiegend Klasse T/S) — die
wiederhole ich nicht, sie sind bekannt: Killfeed (K1), Live-Zeitlupe beim Dunk / beim Tor (B3, H3),
Wiederholung in der Viertelpause aus einem Bildpuffer (B5), Lower Third mit Porträt im Basketball
(B4), Telestrator (F3), das gemeinsame Bild-im-Bild-Zeitlupen-Bauteil für Heben / Breaking /
Climbing / Fechten (H5, B5-2, C6.3, F-B4), Geister-Replay (K5 Stufe 2), Klingenspur (F-B3),
Aufschlag-km/h (T-B3), Jury-Reaktionskacheln (S-B6), Kopf-an-Kopf-Kamera im Wettessen (W-B6),
Startvorstellung mit ruhigem Zoom (SP-3), Regie-Automat im Zeitfahren (TT-5), Glocke zum letzten
Bein (ST-6), „Sturz des Rennens" (G-3), Minimap (verworfen). Die Ideen unten sind daneben gedacht,
nicht darüber.

---

## 1. Wo es aus meiner Sicht schon richtig gut ist

Das gehört in ein Ideenpapier, weil es zeigt, welches Muster funktioniert — die Ideen unten
versuchen, genau dieses Muster auf die Stellen zu übertragen, wo es noch fehlt.

* **Eiskunstlauf ist die Referenz.** Zwischenstand-Tafel links, Wiederholung als Bild-im-Bild
  rechts oben, Startreihenfolge als Sprite-Leiste, Kiss & Cry mit Gesamtpunkten unten rechts,
  Kufenspur und Punkte-Schweber auf dem Eis. Das ist die ISU-Übertragung in 2D, und es ist die
  einzige Disziplin, in der die Leinwand ohne das Dashboard darunter vollständig lesbar ist.
* **Die Staffel liest sich wie ein Rennen.** Oval, Wartende an der Ziellinie, HUD mit Aktuell /
  Nächste / Eignung, das Live-Delta in der Mitte, Bein-Zeile, Führungsverlauf im Innenfeld. Das
  Delta „+0,4 s" in Teamfarbe ist exakt die F1-Battle-Grafik.
* **Fechten hat als einzige Disziplin eine Regie.** Fokus-Bahn groß, fünf Nebenbahnen klein, der
  Schnitt zur spannendsten Bahn, Bauchbinde „Krolach · Defender · 1 von 1 stark" beim Wechsel.
  Dieses Muster — eine Hauptkamera plus Nebenkameras plus automatischer Schnitt — ist das, was
  ich unten für den Kampf vorschlage.
* **Der Endstand ist eine Sendungs-Grafik geworden.** Sieger-Kasten im Teamfarbverlauf,
  Boxscore mit Teamfarben-Köpfen, Höhepunkte als Chips. Der 28.09.-Umbau auf den Nacht-Look war
  die richtige Entscheidung: der Bildschirm bleibt im „Fernseher".
* **Ton aus fünf Bausteinen.** Dass 15 Disziplinen ohne eine einzige Audiodatei einen eigenen
  Klang haben — Herzschlag, Klatschrhythmus, Kufenklick, Torsirene — ist für sich schon eine
  Broadcast-Leistung. Der Katalog ist außerdem die perfekte Andockstelle für Idee 26.
* **Die Highlight-Dosis stimmt, wo sie an einem Moment hängt.** Hockey (Tore), Kampf nach der
  Drossel (8 je Spiel), Takeshi mit verzögertem MXC-Callout: das ist die Runde-2-Regel 8 in
  Aktion.

---

## 2. Ideen, Gruppe A — Die Sendung als Ganzes: Vorspann, Übergänge, Abspann

Der größte Unterschied zwischen der Arena und einer echten Übertragung liegt heute nicht IM Spiel,
sondern DRUMHERUM: Ein Klick auf „Kampf starten" schneidet hart vom Einlauf ins laufende Bild, und
das Spielende schneidet hart in eine Tabelle. Eine Sendung hat Vorspann, Übergänge und Abspann —
das sind Klasse-A-Bauteile, weil nichts davon die Simulation berührt.

### A1 — Disziplin-Vignette vor dem Einlauf (3 s) · alle 20 · Klasse A · klein

Olympia-Übertragungen öffnen jede Sportart mit einem Ident: Piktogramm, Name, ein Satz Regel.
Vorschlag: eine Vollflächen-Karte im `.arenaraum` VOR dem Einlauf, 2,5–3 s, in der
Disziplin-Akzentfarbe (`--wakzent` gibt es seit dem 29.09. schon für alle 20), mit
`DISCS[disc].label` groß, einer Regelzeile („6 Duelle · Reißen und Stoßen · Sinclair entscheidet"
/ „3 Drittel à 4 Minuten · Überzahl zählt" / „6 Beine · Übergabe an der Ziellinie") und dem
Piktogramm, das die Wertungstabelle ohnehin schon kennt. Die Regelzeile ist eine Tabelle mit 20
Strings, nichts Berechnetes. Danach fährt die Karte per Wischer (A3) in den Einlauf. Warum: es
gibt heute keinen Moment, in dem die Sendung sagt, WAS jetzt kommt — der Einlauf beginnt sofort
mit Kadern. Und es löst nebenbei das Audit-Thema „20 Disziplinen sehen gleich aus" an der Stelle,
an der der Zuschauer ankommt.

### A2 — Einlauf als „Tale of the Tape" · alle 20 · Klasse A · klein

Der Einlauf zeigt zwei Listen und je Team Platz / Disziplin-Rang. Boxen und UFC zeigen davor
den direkten Vergleich, Zeile für Zeile, mit dem besseren Wert hervorgehoben. Zwischen den beiden
Aufstellungslisten ist im Einlauf Platz für ein schmales Vergleichsband:

    Disziplin-Rang    6  ◄──────►  20
    Ø Eignung        55,6 ◄────►  45,9
    Stärkster       Draco 66  ·  Krag'Zul 63
    Formkarten       ●●●○     ·    ●○○○
    Anpassung Slot   +9,8     ·    +2,3

Alle fünf Zeilen stehen in `renderEinlauf()` schon als Zahlen bereit (`aufschluesselungenJeSeite`,
`u.eig`, Formkarten je Spieler, `v.platzDiszi`). Der bessere Wert bekommt die Teamfarbe, der
andere bleibt grau — dieselbe „ein Farbcode"-Regel wie im Bug. Warum: Der Zuschauer soll vor dem
Anpfiff wissen, wer Favorit ist und WARUM — heute muss er das aus zwölf Einzelzeilen selbst
rechnen.

### A3 — Stinger-Wischer zwischen Sendungsteilen · alle 20 · Klasse A · klein

Das eine Grafikelement, an dem man jede Sportübertragung erkennt: der diagonale Wischer in
Teamfarben (oder Sender-Farbe) zwischen zwei Bildern. Heute schaltet `zeigeEinlauf(false)` das
Overlay hart aus, `renderEndstand()` hart ein. Vorschlag: ein `#stinger`-Div über der Leinwand
(dieselbe Overlay-Bauart wie `#bbug`), das in 450 ms von links nach rechts durchfährt — zwei
Keile in `--home` und `--away`, dazwischen 60 ms Schwarz, in denen das darunterliegende Overlay
umgeschaltet wird. Einsatzstellen: Vignette → Einlauf, Einlauf → Anpfiff, Spiel → Viertelpause →
Spiel, Spiel → Endstand, und im Fechten / Schach der Regie-Schnitt zur nächsten Bahn (heute ein
harter Wechsel des Fokus). Ton: ein kurzes `tonRauschen`-Swoosh (0,25 s, 2000 Hz), dieselben
Bausteine wie überall. `prefers-reduced-motion` deckt die Animation automatisch ab (globale Regel
am Ende der CSS-Datei).

### A4 — Anpfiff-Countdown mit Einlauf-Ausblende · alle 20 · Klasse A · klein

Nach „Kampf starten" nicht sofort `running=true`, sondern 3 s: Einlauf-Overlay fährt die beiden
Wappen nach außen, in der Mitte zählt „3 · 2 · 1" (dieselbe Typo wie `#vpCountdown`), beim Null
Pfiff / Startschuss / Gong aus dem Katalog der Disziplin, dann der Wischer aus A3, dann läuft
das Spiel. Das ist Wandzeit vor dem ersten `stepSim` — die Tick-Folge bleibt identisch. Warum:
Das Startsignal ist heute in fünf Bahnen und im Football ein Ton mitten im Bild, ohne dass das
Bild darauf vorbereitet wäre. Eine Sendung baut Spannung vor dem Start auf; die Viertelpause
macht es mit ihrem Countdown schon vor.

### A5 — Abspann: „Spieler des Spiels" mit Porträt · alle 20 · Klasse A · klein–mittel

Der Endstand hat Sieger, Boxscore, Szene, Höhepunkte — aber keinen Menschen. NBA, Overwatch
League, jede Übertragung endet mit dem Gesicht des besten Akteurs. Der Kandidat steht in jedem
Chassis schon sortiert an erster Stelle: `impactVon()` im Kampf, `wertungVon(disc).sortierung`
auf der Bühne, `bahnRangliste().reihe[0]` bzw. die Punkte-Sortierung von `bahnTeamstand()` auf
der Bahn, Punkte/Tore im Feldspiel. Karte zwischen Sieger-Kasten und Boxscore: `portraet(p)`
groß (existiert mit Kürzel-Rückfall), Name, Slot-Rolle, drei Zahlen aus derselben Zeile der
Wertungstabelle, und die eine Zeile, die die Olympiade von jedem anderen Spiel unterscheidet:
**„Eignung 66 → Leistung 165 %"** — die Spalte „Leist" gibt es in jeder Wertungstabelle. Dazu
ein zweiter, kleinerer Kasten für die andere Seite („Bester der Verlierer"), damit auch das
eigene Team bei einer Niederlage jemanden bekommt, auf den es stolz sein kann. Kein Beitrags-
Ranking über den Kader hinweg (Leitplanke 0.1 aus dem Arena-Papier bleibt), nur der eine Beste.

### A6 — Abspann: „Wie es lief" — Spielverlaufskurve · Feldspiel, Kampf, Bühne, Wettessen · Klasse A\* · klein–mittel

ESPN zeigt nach jedem Spiel den Game Flow: die Führung über die Spielzeit als Fläche, oben Heim,
unten Gast. Ehrlich benannt („Führung im Verlauf", nicht „Siegwahrscheinlichkeit"), aus einer
Zeitreihe, die der HUD-Pfad je Sekunde Zuschauzeit anhängt: `fsBisher().team` im Feldspiel,
Ausschaltungs-Summe je Seite im Kampf, `Σ summe` je Seite auf der Bühne, Wendetafel-Stand im
Wettessen. Die Staffel hat diese Kurve als Führungsverlauf im Ovalinnenfeld schon während des
Rennens (ST-4) — das Endstand-Panel würde sie für alle Chassis nachliefern. Ein kleiner Canvas
im Endstand (`.eszene`-Karte daneben), Führungswechsel als Punkte auf der Linie, die Zeitstempel
der Höhepunkte-Chips als Marker darunter — dann hängen Chips und Kurve zusammen. Warum: Der
Boxscore sagt, WER, die Kurve sagt, WANN es kippte. Ein 8:16 liest sich anders, wenn man sieht,
dass es bis 2:00 ein 5:5 war.

### A7 — Abspann: „Als Nächstes" · alle 20 · Klasse A\* (Host-Meta) · klein

Jeder Spieltag hat je Team-Paar zwei Disziplinen (`disciplineSchedule.discipline1/2`, der Host
kennt sie schon für die Saat-Karte). Nach dem Endstand von D1 ein Fuß-Banner „Als Nächstes:
HOCKEY · Platz 4 gegen Platz 17 in Hockey" mit Piktogramm und Akzentfarbe, dazu die Stinger-
Andeutung. Der Motor bekommt dafür ein weiteres Feld in `meta` (`naechsteDisziplin`), der Host
liest es aus dem Spielplan. Reine Anzeige. Warum: Es ist das „Coming up next" — der Spieltag
wird als Sendung mit zwei Teilen erlebbar, nicht als zwei getrennte Fenster.

### A8 — Abspann: Tabellen-Auswirkung · alle 20 · Klasse S · mittel

„V-W klettert von Platz 9 auf 8" — die Zeile, die jede Liga-Übertragung nach dem Abpfiff zeigt.
Der Host hat `standings` für alle Teams, aber die Punkte dieses Spiels werden erst beim
Spieltags-Abschluss verrechnet, und der Motor hier ist nicht die zählende Simulation. Eine
ehrliche Fassung bräuchte die Punktvergabe-Formel des Spieltags im Host (Klasse S, Chris'
Entscheidung, ob eine Vorschau „falls dieses Ergebnis zählt" erlaubt ist). Nur benannt, nicht
empfohlen für die nächste Runde.

---

## 3. Ideen, Gruppe B — Kamera und Bildregie

### B1 — Regie-Kamera im Kampf · TDM, Battlefield (Mini-DM zeigt keine Live-Grafik) · Klasse A · mittel

Der Kampf ist die einzige Chassis-Familie **ohne jede Kamera**: `draw()` zeichnet die volle
1240×470-Arena statisch. Im TDM-Screenshot bei 0:20 stehen alle zwölf Figuren in einem Klumpen
am rechten Rand, die linke Hälfte des Bildes ist leerer Sand, die Figuren sind 40 px hoch, und
die Schadenszahlen darüber laufen aus dem Bild. Kein Sender würde die Totale halten.

Vorschlag: eine gedämpfte Kamera nach dem Muster von `kameraUpdate()` (Bahn), aber für die Arena:
Ziel ist die Bounding-Box aller lebenden Figuren plus Polster, Zoom geklemmt auf 1,0–1,6,
Mittelpunkt und Zoom nähern sich exponentiell (Zeitkonstante ~0,8 s, damit die Kamera „schwenkt"
statt springt), und der Ring bleibt als Anker sichtbar (nie über 1,6, sonst verliert man die
Arena). Umsetzung in `draw()` als `ctx.translate/scale` VOR `zeichneBoden()`, Rücksetzen danach —
der Score-Bug ist HTML und bleibt unberührt. Das eine Stück Arbeit, das mehr als Zeichnen ist:
die Klick-Zielansage auf der Leinwand (`verdrahteZielansage`) muss die Mausposition durch die
inverse Transformation schicken — eine Hilfsfunktion, ein Aufruf. Kein `rr()`, kein Lesen in
`stepSim`. Warum ganz oben in dieser Gruppe: Es ist der einzige Vorschlag, der die Figuren
größer macht, ohne die Leinwand zu ändern — und genau das war im Runde-1-Papier die
Antwort auf „Felder größer machen".

### B2 — „Cut to": Nahaufnahme für 0,5 s beim Big-Moment · alle Canvas-Chassis · Klasse A · klein

Fernsehen zeigt ein Tor nicht in der Totalen. Beim Aufruf von `callout()` (also genau bei einem
`big`-Ereignis) kennt der Aufrufer die Figur — Torschütze, K.o.-Opfer, Zieleinläufer, Stürzender.
Vorschlag: `feed()` bekommt in seinem optionalen Objekt (das `kind` trägt) ein `fokusId`, und
`draw()` zieht für 500 ms Wandzeit die Kamera auf diese Figur (Zoom 2,0, dann in 400 ms zurück),
mit einer leichten Vignette (ein radialer Verlauf über das ganze Bild, `zeichneBreaking` hat die
Routine). Für die Bahn und Climbing greift das in `cam`, im Kampf in B1, im Feldspiel als
einmaliger Zoom auf den Korb / das Tor (das Feld muss danach wieder ganz im Bild sein — 0,9 s
Gesamtdauer). Dosis: höchstens ein Cut je 12 s, dieselbe Drossel wie `kampfGrossDrosseln`.
Zeitlupe (Klasse T) bleibt außen vor — der Cut ist der Klasse-A-Ersatz dafür, weil er die
Tick-Folge nicht anfasst.

### B3 — Tote-Zeit-Kamera: langsamer Schwenk in Pausen · Basketball (Viertelpause), Eiskunstlauf (Kiss & Cry), Heben (Aufruf), Bühnen-Duell (Bahnwechsel) · Klasse A · klein

Während eines Overlays oder einer Wartephase steht das Bild darunter heute still. Ein
Ken-Burns-Schwenk (Zoom 1,0 → 1,08 über 6 s, Mittelpunkt wandert langsam zur Tribüne / zum
Publikum, das in Heben und Basketball gezeichnet wird) kostet zwei Zeilen im `draw()`-Pfad und
lässt eine Pause wie eine Pause aussehen — mit dem Publikum, das der Ton schon spielt.

### B4 — Letterbox in der Entscheidungsphase · Kampf (Sudden Death), Feldspiel (letzte 30 s bei ≤ 3 Punkten / 1 Tor), Schach (Zeitnot), Wettessen (letzte Minute), Zeitfahren (letzter Fahrer mit Chance) · Klasse A · trivial

Zwei schwarze Balken (`::before`/`::after` auf `.arenaraum`, je 6 % Höhe, 300 ms einfahrend)
plus ein Hauch Entsättigung des Bildes (`filter:saturate(.85)` auf dem Canvas) — kein Text,
kein Ton, nur das filmische Signal „jetzt wird es ernst". Die Bedingungen sind alle Lesungen
von Uhr und Stand, die `updateHud*()` ohnehin hat. Das Wettessen hat sein „LETZTE MINUTE"-Band,
das kann so bleiben; die Balken sind die chassis-übergreifende Version desselben Gedankens.

---

## 4. Ideen, Gruppe C — Grafikpaket: ein Sender, nicht zwanzig

Die Disziplinen haben ihre HUDs in fünf Runden einzeln bekommen. Sie sind gut, aber sie sind
zwanzig Handschriften. Ein Sender hat EIN Grafikpaket: dieselbe Bauchbinde, dieselbe Art, einen
Namen einzublenden, derselbe Score-Bug. Drei Ideen, die vereinheitlichen statt hinzuzufügen.

### C1 — Bauchbinden-Baukasten (`#bauchbinde`) · alle 20 · Klasse A · mittel (einmal), danach trivial je Anlass

Heute gibt es Bauchbinden in vier Handschriften: Fechten (`battleBauchbinde`, HTML), Takeshi
(Fallen-Schild, Canvas), Staffel (HUD-Zeile Aktuell/Nächste), Heben („Nächster: Name, X kg" auf
der Anzeigetafel). Vorschlag: ein HTML-Element unten links über der Leinwand mit vier Slots —
Porträt (`portraet()`), Kicker (klein, uppercase, Teamfarbe), Titel (Name), Untertitel (Rolle /
Statline) und optional eine große Zahl rechts. Slide-in von links, 3 s, ein Anlass je 12 s. Alle
bestehenden Bauchbinden wandern hinein; neu dazu kommen die Anlässe, die heute keine haben:

| Chassis | Anlass (alles vorhandener Zustand) | Kicker · Titel · Untertitel · Zahl |
|---|---|---|
| Feldspiel | Torschütze / Korbschütze beim `big`-Korb | TOR · Cassandra · 2. Tor heute, Vorlage Krag'Zul · 2 |
| Kampf | Zielansage gesetzt; Mehrfachausschaltung | ANSAGE · Greenkraut · Heiler, 3 Ausschaltungen kassiert · — |
| Bahn | Zieleinlauf Platz 1–3; Übergabe (Staffel) | ZIEL · Draco · Platz 1, Bestzeit des Tages · 31,2 s |
| Heben | Aufruf zum Versuch | 3. VERSUCH · Lava Golem · Stoßen, braucht 12 kg · 148 kg |
| Bühne-Auftritt | Auftrittsbeginn | JETZT · Gram & Lava · Startnummer 3, Vorjahres-Platz — · — |
| I-Spy | Tresor-Fund | TRESOR · Johanna · Spürsinn, Zug 6 · 60 |

Die Kicker-Wörter sind gleichzeitig die Highlight-Titel aus C3. Warum: Konsistenz IST der
Broadcast-Eindruck — die einzelnen Bauchbinden sind heute gut, aber ein Zuschauer, der von Fechten
zu Hockey wechselt, sieht zwei Sender.

### C2 — Wappen im Bug, im Endstand, in der Pause · alle 20 · Klasse A · trivial

Der Score-Bug zeigt Teamnamen als Text; jeder TV-Bug zeigt das Logo. `wappen(v)` existiert (mit
Monogramm-Rückfall), die Dateien liegen unter `/team-logos/`. 16 px vor dem Namen in
`.bbug .seite`, 28 px im Sieger-Kasten des Endstands, 40 px in der Viertelpause. Dazu die
Score-Ziffer beim Wechsel mit einem kurzen Roll (alte Ziffer nach oben raus, neue von unten rein,
200 ms, reines CSS auf einem `<b>`-Wechsel) — NHL/NBA-Bugs tun genau das, und man MERKT einen
Treffer dann auch am Bug, nicht nur am Callout.

### C3 — Highlight-Titel statt Protokollzeile · alle 20 · Klasse A · klein

Ein `big`-Ereignis speichert heute den Ticker-Text („Johanna trifft Greenkraut · 9") und zeigt
ihn als Callout, als Chip im Endstand und als „Szene des Spiels". Das ist Play-by-Play, kein
Titel. Vorschlag: `feed()`s `kind` (heute nur im Kampf) wird für alle Chassis gesetzt und auf eine
Titel-Tabelle abgebildet — FIRST BLOOD, FÜHRUNGSWECHSEL, GROSSER TREFFER, TOR, DREIER, DUNK,
ZIELEINLAUF, ÜBERGABE VERPATZT, STURZ, GEBROCHEN, TRESOR, KIPP-ZUG, GOLDENER BUZZER, BESTZEIT. Das
Callout zeigt den Titel groß (Barlow Condensed, wie `.esieger`) und den bisherigen Satz als
Caption darunter; die Chips im Endstand bekommen den Titel als Kicker vor dem Zeitstempel; die
„Szene des Spiels" liest sich dann nicht mehr als „Rhyx'Tal fällt — zurück in 9 s", sondern als
„MEHRFACHAUSSCHALTUNG — Tidesprinter schaltet Rhyx'Tal und Draco in 8 s aus". Kein neuer
Erkennungspfad: `kind` ist genau das dritte Argument, das die 27.09.-Papiere je Disziplin schon
benennen. Aufwand: eine Tabelle, ~30 `feed()`-Aufrufe bekommen ein Wort.

### C4 — „Was jetzt zählt"-Zeile im Bug · Bühnen-Duell, Kampf, Feldspiel, Bahn · Klasse A · klein

Tennis-Übertragungen blenden „BREAKBALL" / „MATCHBALL" ein, Heben hat schon „braucht X kg", das
Zeitfahren „Zeit für den Teamsieg". Dieselbe Zeile für den Rest, alles Lesungen: Fechten „ein
Treffer bis zum Bahnsieg" (`u.treffer` gegen Ziel), Schach „Brett 3 entscheidet das Duell"
(offene Bretter gegen Stand), Mini-DM / Battlefield „nächste Ausschaltung entscheidet", Basketball
„Dreier gleicht aus" (Differenz ≤ 3 in den letzten 30 s), Hockey „Torwart-raus-Fenster" (H4 hat
die Kennung, hier der Satz), Staffel „Anker braucht +1,2 s" (aus `staffelZeitDelta`). Wichtig: nur
Zustände, die aus dem enthüllten Stand folgen — keine Wahrscheinlichkeit, kein Blick in vorab
berechnete Runden (Spoiler-Regel der Bühne).

---

## 5. Ideen, Gruppe D — Drama, Spannung, Ton, Kommentar

### D1 — Comeback-Tracker · Feldspiel, Kampf, Bühne (Summen), Wettessen · Klasse A\* · klein

Übernimmt eine Seite die Führung, die vorher um mindestens X zurücklag (Basketball 8, Hockey 2,
Kampf 3 Ausschaltungen, Bühne 15 % der Summe), zeigt das Callout „COMEBACK — von −8 auf +1" und
der Bug blitzt doppelt. Braucht einen Merker „größter Rückstand je Seite" im HUD-Pfad (A\*).
Es ist die NBA-„biggest comeback"-Grafik und die Esport-„Throw"-Erzählung in einem — der Moment,
für den man ein Spiel zu Ende schaut.

### D2 — Spannungs-Puls: Herzschlag für alle · alle 20 · Klasse A · klein

Breaking hat den Herzschlag aus dem HP-Stand (`gauntletHerzschlagBpm`). Dieselbe Idee
generalisiert als „Spannung" = Nähe des Stands × Restzeit: in den letzten 20 % der Spielzeit bei
Gleichstand oder Ein-Punkt-Abstand pulsiert der Rand des Score-Bugs (`box-shadow`, 70–120 BPM)
und der `publikum`-Loop hebt sein Gain um 30 % (eine `gain.gain.linearRamp`-Zeile in
`tonLoopStart`s Knoten). Kein neuer Ton, kein neues Bild — nur ein Maß, das zwei vorhandene Dinge
lauter macht. In der Bahn: Abstand des Führenden zum Zweiten am letzten Split.

### D3 — Sender-Stings: ein Jingle je Momentart · alle 20 · Klasse A · klein

`TON_KATALOG` ist je Disziplin sortiert; ein Sender hat aber EIN Geräusch für „Tor", das man in
jeder Sportart wiedererkennt. Vorschlag: ein zwanzigster Katalog-Eintrag `broadcast` mit fünf
Stings aus den vorhandenen Bausteinen — `fuehrungswechsel` (aufsteigender Doppelton + Metall),
`erstesEreignis` (kurzer heller Klick-Lauf), `entscheidend` (tiefer Gong + Rauschen), `rekord`
(Doppelton eine Terz höher), `schluss` (Sirene aus `tonBuzzer` + `tonTon`) — abgefeuert in
`feed()`, wenn `kind` gesetzt ist, ZUSÄTZLICH zum Disziplin-Ton. Warum: Wer bei Schach den
Führungswechsel-Sting hört, weiß, dass er derselbe ist wie bei Hockey — das ist die Klangmarke
des Senders.

### D4 — Farbkommentar aus dem Boxscore („zweite Stimme") · alle 20 · Klasse A · klein–mittel

Runde 1 hat Captions mit Bezug auf den Spielverlauf bewusst ausgeschlossen („bräuchte einen
Laufzähler je Spieler"). Diese Zähler gibt es inzwischen in jedem Chassis — es sind die Spalten
der Wertungstabelle (`WERTUNG_CHASSIS`, `u.st.*`, `TEILNEHMER[].summe`, `bahnRangliste`).
Vorschlag: eine zweite Caption-Ebene, die nach dem Play-by-Play einen Kontext-Satz aus Templates
baut, ausgelöst nur bei `big`: „— sein drittes Tor heute", „— zweitschnellste Etappe des Tages",
„— erst 12 % seiner Eignung gezeigt, jetzt 165 %", „— Greenkraut hat heute noch niemanden
geheilt". Auswahl über den vorhandenen Rundlauf (`waehleCaption`), kein `rr()`. Optional als
zweite Zeile im Callout in anderer Farbe, damit Play-by-Play (weiß) und Color (Teamfarbe)
unterscheidbar sind — zwei Stimmen, wie in jeder Sendung.

### D5 — Sprachausgabe der Captions per Web Speech API · alle 20 · Klasse A · klein, experimentell

Runde 1 hat Text-to-Speech als „eigenen, viel größeren Auftrag" eingestuft. Mit
`window.speechSynthesis` sind es ~15 Zeilen ohne Asset, ohne Netz: nur `big`-Captions,
deutsche Stimme falls vorhanden, Lautstärke am vorhandenen Regler, Schalter neben „Ton". Es ist
deterministisch (derselbe Text), berührt nichts und ist abschaltbar. Ob es gut KLINGT, hängt an
den Systemstimmen — deshalb Experiment, nicht Versprechen. Wenn es funktioniert, ist es der
größte Einzelschritt zu „das ist eine Übertragung", den es für so wenig Code gibt.

### D6 — Statistik-Einblender in ruhigen Phasen · alle 20 · Klasse A · klein

NBA-Sendungen füllen tote Sekunden mit Stat-Kacheln. Vorschlag: alle ~45 s Wandzeit ohne
`big`-Ereignis erscheint für 4 s eine kleine Kachel unten rechts (Bauchbinden-Baukasten C1,
anderer Slot) mit EINER Zahl aus der Wertungstabelle, die gerade etwas erzählt: „SOG 12:4",
„Krolach: 3 Ausschaltungen, 0 Tode", „Schnellste Übergabe: 0,3 s", „Draco: 5 von 5 Elementen
sauber". Die Auswahl ist eine Liste von Templates mit einer Relevanz-Bedingung (z. B. SOG nur bei
Differenz ≥ 5), Rundlauf statt Zufall. Warum: Es füllt genau die Phasen, in denen heute nur der
Ticker scrollt, und es nutzt Zahlen, die die Wertungstabelle längst berechnet.

### D7 — „Letzte Minute in Echtzeit" · alle mit Uhr · Klasse A (nur `speed`) · trivial

Wer mit Tempo 2× oder 4× zuschaut, sieht das Spielende im Zeitraffer. Keine Übertragung spult
das Finale vor. Vorschlag: in den letzten 30 s Zuschauzeit (bzw. im letzten Bein / beim letzten
Fahrer / im letzten Duell) fällt `speed` automatisch auf 1× zurück, wenn der Stand knapp ist,
mit der Tempo-Taste als Anzeige („Tempo 1× · Finale"). `speed` ist reiner UI-Zustand außerhalb
der Simulation. Zwei Zeilen in `loop()`. Es ist die kleinste Idee in diesem Papier und
vielleicht die, die man am meisten spürt.

### D8 — Konfetti in Teamfarbe im Endstand · alle 20 · Klasse A · trivial

Showcase hat Konfetti (`cypherHash`, kein `rr()`). Im Endstand über dem Sieger-Kasten 2 s in
`--home`/`--away`, nur beim Sieg, nicht beim Unentschieden. CSS-Partikel reichen (30 Divs mit
`@keyframes`), kein Canvas.

### D9 — Saison- und Karriere-Bestmarken als Tags (PB / SB) · Bahn, Heben, Bühne-Auftritt · Klasse S · mittel

Leichtathletik zeigt PB / SB / WL neben jeder Zeit; Heben zeigt den Landesrekord. Der Motor
kennt nur dieses Spiel — für „Saisonbestzeit" bräuchte der Spielstand je Spieler und Disziplin
einen Bestwert, den die zählende Simulation fortschreibt und der Host mitliefert. Klasse S,
Chris' Entscheidung. Erwähnt, weil es die eine Broadcast-Zeile ist, die aus einem Rennen eine
Saison macht — und weil der Hot Seat (Tagesbestzeit) zeigt, wie gut das Muster im Bild schon
funktioniert.

### D10 — Drittelpause im Hockey mit Drittelbilanz · Hockey · Klasse A · klein

Basketball hat die Viertelpause mit Buzzer und Countdown, Hockey hat nur die Sirene. Dieselbe
`.viertelpause`-Fläche für die Drittelpause, aber mit Inhalt: Stand, SOG je Drittel, Torschützen,
das eine Highlight des Drittels als Chip. Nichts wird pausiert, was nicht heute schon pausiert —
nur die Fläche bekommt, was eine Pausen-Grafik im Fernsehen trägt.

---

## 6. Randnotizen für den Audit (keine Ideen, beim Ansehen gefunden)

Drei Dinge, die mir im Playwright-Durchlauf auffielen; sie gehören in den Audit, nicht hierher,
und stehen deshalb nur als Stichworte:

1. **Staffel, 0:12:** Das Callout-Banner („Vigilante Wranglers übernimmt die Führung.") liegt
   über dem Delta-Feld des `#bahnHud` — `positioniereCallout()` kennt `#bbug` und die I-Spy-Uhr
   als Bezugskanten, aber nicht das Bahn-HUD.
2. **TDM-Endstand:** Höhepunkte-Chips wie „Johanna trifft Greenkraut · 9" und die Szene des
   Spiels „Rhyx'Tal fällt — zurück in 9 s" (Etikett „Mehrfachausschaltung") tragen den Ticker-
   Wortlaut, nicht den Moment — genau das, was C3 beheben würde.
3. **Eiskunstlauf, 0:12:** Die Wiederholungs-Box oben rechts überdeckt die Startreihenfolge-
   Leiste teilweise.

---

## 7. Reihenfolge, wenn man es bauen wollte

| Reihe | Ideen | Warum zuerst |
|---|---|---|
| 1 | **C3 Highlight-Titel + D3 Sender-Stings + D7 Finale in Echtzeit** | drei kleine Klasse-A-Stücke, jedes an `feed()`/`loop()`, alle 20 Disziplinen auf einmal |
| 2 | **A3 Stinger + A4 Countdown + C2 Wappen** | der Sendungs-Rahmen; reines CSS/HTML, macht jede weitere Grafik als Teil EINER Sendung lesbar |
| 3 | **B1 Regie-Kamera Kampf, dann B2 Cut-to** | der einzige Vorschlag mit „mittel"; größter Bildgewinn, danach ist B2 für alle Chassis ein Aufruf |
| 4 | **A5 Spieler des Spiels + A6 Verlaufskurve + A1 Vignette + A2 Tale of the Tape** | Vorspann und Abspann; Klasse A/A\* |
| 5 | **C1 Bauchbinden-Baukasten** (zieht Fechten/Takeshi/Staffel/Heben um) | Konsolidierung, lohnt erst, wenn die Kicker-Wörter aus C3 stehen |
| 6 | **D1, D2, D4, D6, D10, B3, B4, D8** | Politur, je ein Nachmittag |
| 7 | **D5 Sprachausgabe** als Experiment mit Schalter; **A7** sobald der Host das Meta-Feld liefert | offen |
| — | **A8, D9** | Klasse S, nur mit Chris' Entscheidung |

Kein Vorschlag in Reihe 1–6 berührt `wert()`, `stepSim`/`stepSpurt`/`stepBuehne`/`stepFeldspiel`
oder einen `rr()`-Aufruf. Abnahme wie in jeder Broadcast-Runde: `miss-alle-disziplinen.mjs`
bit-identisch, Screenshot-Beleg, Highlight-Zählung mit `zaehle-kampf-highlights.mjs` im Zielband
4–10 (Runde 2, Abschnitt 9).

---

## 8. Offene Fragen an Chris — mit Voreinstellung

1. **Countdown und Vignette kosten je 3 s Wandzeit vor jedem Spiel.** Beim Durchklicken von 20
   Disziplinen sind das zwei Minuten. Voreinstellung: beide bei Tempo ≥ 2× überspringen, und
   ein Klick auf die Karte bricht sie ab.
2. **Regie-Kamera im Kampf: Zoom-Deckel 1,6 oder 2,0?** Voreinstellung 1,6 — der Ring bleibt
   immer im Bild, und die Zielansage per Klick bleibt treffsicher.
3. **Sprachausgabe (D5) überhaupt ausprobieren?** Voreinstellung: ja, als Schalter, Standard aus.
4. **Spieler des Spiels auch für die Verliererseite?** Voreinstellung: ja, kleiner — das eigene
   Team verliert die Hälfte seiner Spiele, und die Sendung sollte auch dann jemanden feiern.
5. **Sender-Stings zusätzlich zum Disziplin-Ton oder statt dessen?** Voreinstellung: zusätzlich,
   30 % leiser — der Disziplin-Ton sagt WAS, der Sting sagt WIE WICHTIG.

## Quellen im Repo

`public/mockups/battle-mode.engine.js` (`aktualisiereBbug` `:12590`, `callout`/`feed`
`:35956`/`:36055`, `renderEinlauf` `:36568`, `renderEndstand*` `:37858 ff.`, `TON_KATALOG` `:29052`,
`kameraUpdate` `:32681`, `draw` `:35646`, `loop`/`ZEIT_DEHNUNG` `:36227 ff.`),
`public/mockups/battle-mode.css` (`.bbug`, `.bbugcallout`, `.einlauf`, `.endstand`,
`.viertelpause`, `hudIn`), `public/mockups/battle-mode.html`,
`app/foundation/battle-arena/FoundationBattleArenaHost.tsx` (`meta`, `seedByDisciplineId`),
`docs/design/broadcast-praesentation-uebergreifend-recherche-06-09.md`,
`docs/design/broadcast-praesentation-runde-2-22-09.md`,
`docs/design/staffel-oval-broadcast-hud-recherche-06-09.md`, die sechs
`docs/design/broadcast-optik-*-27-09.md` auf den `broadcast-*-recherche-27-09`-Branches,
Commits `6003b0e7` … `24a8e1e1` (Phasen 3–5).
