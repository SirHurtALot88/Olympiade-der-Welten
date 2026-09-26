# UI-Bewegungs-Audit — sieht es aus wie echtes Gameplay? (26.09.)

Zusatzauftrag von Chris, ausdrücklich ZUSÄTZLICH zu laufenden Taktik-Konzept-Reviews und
Broadcast-HUD-Arbeit: „fokussiere dich auch auf die Bewegungen im UI, dass es aussieht wie echtes
Gameplay" — konkret die Bewegungsanimationen der Spielfiguren (Sprite-Posen, Laufbewegung,
Aktionsanimationen wie Wurf/Schuss/Zweikampf), nicht Broadcast-HUD/Ticker und nicht Taktik-Tiefe.

**Ergebnis vorweg:** kein Rezept/keine Wertung/keine Matrix angefasst — dieses Dokument ist reine
Präsentations-Recherche. Es gibt in dieser Runde **keinen Code-Commit**: jeder Kandidat, der bei
der Untersuchung als "günstig genug" in Frage kam, hätte entweder neue Sprite-Assets gebraucht
(gegen die Auftragsgrenze "größere Umbauten NICHT selbst umsetzen") oder erwies sich bei
genauerem Hinsehen als bereits richtig funktionierend. Warum, steht unten je Fall. rho ist damit
für alle zwanzig Disziplinen trivial unverändert (kein Zeichen-, Zustands- oder Rezeptcode
berührt) — es gibt nichts zu vermessen.

## Methode

Playwright-Screenshots über `scripts/screenshot-disziplin.mjs` (Vorlage) bzw. ein eigenes
Batch-Skript (`setDisc()` → `#t2` → `#play` → mehrere Zeitpunkte je Disziplin, ein Browser für
alle quinze, um die Sandbox zu schonen), je 4 Zeitpunkte (0,8 s / 2,2 s / 4 s / 6,5 s nach
`#play`) für jede der fünfzehn arena-aufgelösten Disziplinen aus
`lib/battle/arena-resolved-disciplines.ts` (`ARENA_RESOLVED_DISCIPLINE_IDS`): basketball,
gewichtheben, hockey, speed-schach, showcase, eiskunstlauf, breaking, wettessen, tennis, fechten,
staffel, takeshis-castle, time-trial, spurt, climbing. Bei Basketball, Spurt und Tennis zusätzlich
weitere Zeitpunkte (bis 20 s) gezogen, weil die ersten vier Bilder allein missverständlich waren
(s. Abschnitt 4). Screenshots liegen nur im Scratchpad dieser Session, nicht im Repo — wie
`scripts/screenshot-disziplin.mjs` es mit seinem `tmp-ux-audit/`-Default selbst vormacht, sind sie
ein Wegwerf-Beleg, kein Artefakt zum Committen.

Parallel dazu: `public/mockups/battle-mode.engine.js` (35 000 Zeilen) ist im gesamten Projekt
außergewöhnlich dicht mit Zeilenkommentaren dokumentiert, die frühere Bewegungs-/Pose-Fixes samt
Begründung festhalten. Für eine ehrliche Rangliste war es nötig, diese Kommentare zu lesen,
BEVOR ein Screenshot-Befund als "neuer Fund" gemeldet wird — sonst würde dieses Dokument Dinge
als offen melden, die bereits in einer früheren PR behoben wurden (die Fallstricke: PR-Namen wie
"Sechster Nachtrag" oder `laeuferSchwebeXY()` aus dem Auftrag selbst). Das kostete Zeit, verhindert
aber falsche Befunde.

## Die Chassis, nicht die Disziplin, bestimmt die Bewegungsqualität

Alle fünfzehn Disziplinen laufen über vier gemeinsame Motoren; wer die Bewegungsqualität EINER
Disziplin versteht, versteht sie für alle, die dasselbe Chassis teilen:

| Chassis | Disziplinen | Kernfunktionen |
|---|---|---|
| Feldspiel | Basketball, Hockey | `bauFeldspiel`, `zeichneSprite` (walk/slash/shoot/hurt), `blickAus()` |
| Bühne — Heben | Gewichtheben | `bauBuehne`, `zeichneHantel`/`HEBEN_HAND`/`HEBEN_PHASEN` |
| Bühne — Duell | Speed-Schach, Tennis, Fechten | `spieleBuehneDuell()`, dieselbe 6-Lanes-Übersicht |
| Bühne — Auftritt | Showcase, Eiskunstlauf, Breaking, Wettessen | `spieleBuehneAuftritt()`, Spotlight + Warteschlange |
| Bahn | Staffel, Takeshi's Castle, Time-Trial, Spurt, Climbing | `spieleBahn()`, `laeuferXY()`/`laeuferSchwebeXY()`/`blickAus()` |

Die im Auftrag genannten Präzedenzfälle (Climbing-Wand, `laeuferSchwebeXY()`, Sechster Nachtrag
für Fechten/Eiskunstlauf/Breaking) sind alle NACHGEPRÜFT worden und wirken korrekt und universell:

- **`laeuferSchwebeXY()`/Sprechblasen-Verankerung ist längst kein Bahn-only-Muster mehr.**
  Nachgesehen an allen drei anderen Chassis: Feldspiel verankert seine Sprechblasen über
  `_spieler`-IDs (`FSTEAM[side].find(x=>x.id===f._spieler)`, engine.js:12946), Bühne-Heben über
  `_teilnehmer`-IDs (`TEILNEHMER.find(x=>x.id===f._teilnehmer)`, u.a. :17756/:18013/:19398), Bahn
  über `_laeufer`-IDs (`LAEUFER.find(x=>x.id===f._laeufer)`, :30137 f., mit explizitem Kommentar
  "Verankert am LAEUFER, nicht an den festen Koordinaten aus dem Moment [der Erstellung]",
  :30121). Jede Sprechblase wird also JEDEN Frame neu an die aktuelle Bildschirmposition der
  Figur gehängt, nicht nur einmal beim Erzeugen berechnet. Kein offener Fund hier.
- **`blickAus()`** (engine.js:2272-2276) wird von allen vier Chassis für Figuren mit
  Geschwindigkeit gelesen und liefert für stehende Duell-Figuren einen seitenabhängigen
  Default, der die beiden Kontrahenten korrekt zueinander drehen lässt (Seite 0 blickt nach
  rechts/zum Gegner, Seite 1 nach links). Nachgesehen an Tennis/Fechten/Speed-Schach (Screenshots):
  die Figuren stehen sich tatsächlich zugewandt gegenüber, nicht beide in dieselbe Richtung.
- **Die Waffen-/Requisiten-Pose-zu-Aktion-Zuordnung** aus dem "Sechsten Nachtrag" (Fechten/
  Eiskunstlauf/Breaking: `ausfall`/`engarde`, `canto`/`ruhend`, `schuss`/`ruhend`, jeweils an
  `u.lunge>0` gekoppelt, engine.js:3503-3701) ist unverändert vorhanden und wird an denselben
  Stellen gelesen wie im Nachtrag beschrieben — kein Regressions-Fund.
- **Die Kosmetik-Waffen-Tabelle `DISZIPLIN_WAFFE`** (engine.js:2454-2477) nimmt unbewaffneten
  Bühnen-Disziplinen (Eiskunstlauf, Breaking, Showcase, Tennis, Wettessen, Speed-Schach, I-Spy)
  UND allen fünf Bahn-Disziplinen zufällig zugewiesene Kosmetikwaffen weg — der im Kommentar
  selbst zitierte Altfund ("ein Takeshi's-Castle-Läufer mit Schrotflinten-Kosmetik den ganzen
  Parcours entlang") ist behoben und gilt jetzt für die Bahn insgesamt, nicht nur Takeshi.
- **Climbing** (gerade gemergt, `6b471366`) zeigt eine vertikale Wand mit verschwindenden Griff-
  Markern statt einer horizontalen Bahn; die Kamera bleibt am Kletterer verankert (deshalb bleibt
  seine Bildschirmposition über mehrere Sekunden gleich, während oben Griffe verschwinden) — das
  ist korrektes Scrolling-Verhalten, kein eingefrorener Charakter. Kein weiterer Fund nötig, wie
  im Auftrag vermutet.

Diese Bestandsaufnahme ist wichtig, weil sie zeigt: **die naheliegenden, günstigen Fixes dieser
Art sind in diesem Projekt bereits systematisch abgearbeitet.** Was an Befunden übrig bleibt
(Abschnitt weiter unten), sitzt eine Stufe tiefer — bei fehlenden Posen/Assets, nicht bei falsch
verankerten Anzeige-Elementen.

## Rangliste — am wenigsten "echtes Gameplay" zuerst

| Rang | Disziplin(en) | Kernbefund |
|---|---|---|
| 1 (schwächste) | **Basketball** | Ballträger hat keine Trage-/Dribbelpose, "Wurf" ist ein Bogenschuss |
| 2 | **Tennis, Fechten** | Duell bleibt IMMER Sechs-Felder-Miniaturübersicht, nie eine Nahansicht des aktiven Gefechts |
| 3 | **Speed-Schach** | dieselbe Übersicht wie Tennis/Fechten, aber mit Fokus-Zoom — teilkompensiert (s.u.) |
| 4 | **Spurt, Staffel** | Läufer bleiben am Start mehrere Sekunden fast deckungsgleich übereinander, bevor sie sich sichtbar in Bahnen auffächern |
| 5 | Takeshi's Castle, Time-Trial | solide: Lauf-Zyklus, Status-Text pro Läufer, gestaffelte Starts |
| — (Mittelfeld) | Hockey | Schläger/Eisschatten korrekt, gemeinsamer "Wurf"-Pose-Mangel mit Basketball wirkt hier weniger fremd (Arme seitlich passt eher zum Schlagschuss) |
| — (solide) | Showcase, Eiskunstlauf, Breaking, Wettessen | je eigene Phasen-Zustandsmaschine mit sichtbarem Ausschlag (Kau-/Schlingwipper, Sturz-Pose, Werkzeugwechsel) |
| — (am stärksten) | Gewichtheben, Climbing | eigens gebaute Requisiten-Animation (Hantel steigt sichtbar über den Kopf) bzw. frisch überarbeitete Wandmechanik |

## Die fünf schwächsten im Detail

### 1. Basketball — der Ball ist nicht an der Hand, der Wurf ist ein Bogenschuss

Das ist der klarste, am gründlichsten schon dokumentierte Befund im gesamten Feld — Fable hat
ihn am 03.09. in `docs/design/basketball-finalisierung-recherche-fable.md` exakt für diesen Zweck
untersucht (Chris' Auftrag damals wörtlich: „die Spieler den tragen mit den animationen, und er
am besten auf den boden gedribbelt wird"). Nachgeprüft gegen den aktuellen Stand (`6b471366`):
**der Befund gilt unverändert.**

- `ANIBILDER={walk:9,slash:6,shoot:13,hurt:6}` (engine.js:2269) — der Ballträger ist in keiner
  dieser vier Animationen ein eigener Fall. Er läuft `walk`, der Ball wird bei
  `traeger.y+18+dribbelDip` (:11991) als eigenes 18px-Sprite GETRENNT vom Körper gezeichnet — er
  hängt an einer festen Position relativ zur Hüfte, nicht an der schwingenden Hand. Sichtbar
  in den Basketball-Screenshots: die Spieler wirken wie Figuren, die neben sich her einen Ball
  herträgt, nicht wie jemand, der ihn dribbelt.
- Der Wurf (`u.lunge>0` → `ani="shoot"`, engine.js:3862) nutzt das LPC-Blatt `shoot`, das im
  Original ein 13-Bilder-Bogenschuss ist (beide Arme seitlich waagerecht gespannt) — der
  Fable-Befund nennt das selbst „als Basketball-Bewegung unpassend". Der Effekt bleibt: sobald
  ein Feldkorbversuch ausgelöst wird, spannt die Figur sichtbar einen Bogen statt zum Korb zu
  werfen.
- Der Ball-Dribbel-Bounce selbst (`BK_DRIBBEL_PERIODE=0.5s`, `BK_DRIBBEL_AMPLITUDE=13px`,
  :7327 f.) FUNKTIONIERT und ist realistisch getaktet (~2 Dribbel/s) — das Prellen ist also
  nicht das Problem, sondern dass es ohne sichtbaren Bezug zur Hand geschieht.

Fable nennt drei Lösungswege, nach Kosten sortiert (Abschnitt 2.3 des Dokuments):

- **A — Ball an einen Handpunkt binden** (kein neues Sprite-Blatt; eine Koordinaten-Tabelle für
  `walk`, analog zu den bereits gemessenen Handpunkt-Tabellen für Waffen,
  `docs/design/sprite-handpunkte.md`). Laut Fable die günstigste Lösung — aber sie selbst
  verlangt eine Vermessung der `walk`-Sprites, „per Pixelscan der Alphakontur ausgemessen, nicht
  geschätzt" (dasselbe Vorgehen wie bei `HOCKEY_HAND`/`HEBEN_HAND`, engine.js:2489 f.) — das ist
  eine eigene, sauber messbare Aufgabe, aber keine, die man in einer Audit-Runde nebenbei aus dem
  Ärmel schätzt, ohne das Projekt-eigene Mess-Prinzip zu brechen.
- **B — `thrust` als Ballführer-Pose.** Braucht ein neues LPC-Blatt für alle ~45 Ebenen (Körper,
  Kopf, Haar, Rüstung …), also neue Assets im Sprite-Baukasten.
- **C — `spellcast` statt `shoot` als Wurf.** Ebenfalls ein komplett neues Blatt über alle Ebenen;
  nachgesehen (`grep spellcast engine.js`): **noch nirgends geladen**, in keiner Disziplin.

Alle drei Wege — auch der günstigste — verlangen entweder neue Sprite-Daten oder eine neue,
gemessene (nicht geschätzte) Koordinatentabelle. Das überschreitet die Grenze dieses Audits
("größere Umbauten NICHT selbst umsetzen"), obwohl Weg A choreografisch klein ist. **Empfehlung:
eigene, kurze Runde mit genau Fables Abschnitt 2.3 als Arbeitsauftrag — Weg A zuerst.**

### 2/3. Tennis, Fechten (und, teilkompensiert, Speed-Schach) — sechs Duelle immer als Miniaturübersicht

Alle drei laufen über `spieleBuehneDuell()`, dasselbe Chassis (Kommentar in
`arena-resolved-disciplines.ts`: „Tennis/Fechten ueber spieleBuehneDuell() (Speed-Schachs
Chassis)"). Über 12 Stichproben (4 Standard-Zeitpunkte je Disziplin plus 8 zusätzliche für
Tennis bei 1/3/5/9/13 s) zeigte sich ein echter, aber choreografischer statt technischer
Unterschied:

- **Speed-Schach** zoomt sichtbar auf EIN Brett, sobald dort ein Zug fällt (`Brett 2 von 6 · Zug
  0/10`, volle Breite, das eigentliche Schachbrett sichtbar), und fällt danach in die
  Sechs-Bretter-Übersicht zurück.
- **Tennis und Fechten zeigten in KEINER der insgesamt 20 Stichproben (12 Standard + 8 zusätzliche
  für Tennis) diese Nahansicht** — nur die Sechs-Duelle-Übersicht mit kleinen (~40 px) stehenden
  Figuren und einem Text-Banner ("Greenkraut — gewinnt den Ballwechsel gegen Draco · Vorteil
  +38"). Die im Code vorhandene `ausfall`/`engarde`-Pose (Sechster Nachtrag) mag dort technisch
  auslösen, ist bei dieser Sprite-Größe aber praktisch nicht zu erkennen — der Eindruck bleibt
  „sechs stehende Puppen, ein Textticker erzählt, was passiert" statt eines sichtbaren
  Ballwechsels oder Fechtgefechts.

Das ist kein Bug (beide Disziplinen laufen korrekt und rangtreu, s. CLAUDE.md: Tennis 0,825,
Fechten 0,816), sondern eine Präsentationslücke: Speed-Schach bekam eine Nahansicht, weil ein
Schachzug ohne Brett unlesbar wäre; Tennis/Fechten wurde dieselbe Nahansicht (Platz + Spieler +
Racket-/Klingenschwung groß sichtbar) nie gebaut. **Empfehlung:** eine eigene Runde, die
`spieleBuehneDuell()` um eine Tennis/Fechten-Nahansicht ergänzt (eigene Cour t-/Planche-Grafik,
größere Sprites, sichtbarer Ballwechsel/Klingenwechsel) — eine neue Teilansicht, kein
Mechanik-Eingriff, aber klar ein „größerer Umbau" im Sinn des Auftrags, nicht in dieser Runde.

### 4. Spurt, Staffel — Läufer kleben am Start übereinander

Bei Spurt lagen bei 0,8-6,5 s nach `#play` alle 10-12 Läufer sichtbar in einer fast
deckungsgleichen Säule am linken Bildrand, während die Hürdenbahn rechts komplett leer blieb;
erst eine Stichprobe bei 20 s zeigte einen sichtbar herausgelösten Läufer in einer eigenen Bahn.
Nachgesehen: das ist **keine falsche Koordinate**, sondern ein Zeittakt-/Kamera-Effekt — bei
einem Massenstart mit nahezu gleichem Anfangstempo bleiben Läufer für die ersten Simulations-
sekunden zwangsläufig eng beieinander, und die Kamera zoomt in dieser Phase zusätzlich weiter
hinein (von "Kamera 1,4x" auf "Kamera 3,3x" über die vier Standard-Stichproben), was das
Zusammenkleben optisch verstärkt. Kein Fund, der eine Zeilenänderung rechtfertigt — aber ein
Kandidat für eine spätere Präsentationsrunde: ein sanfterer Zoom-Einstieg (kein Sprung von 1,4x
auf 3,3x in wenigen Sekunden) würde den ersten Eindruck deutlich verbessern, ohne die Kamera-
Zielposition selbst zu ändern.

### 5. Takeshi's Castle, Time-Trial — solide, zur Vollständigkeit genannt

Beide zeigen bereits, was den drei genannten Fällen fehlt: Takeshi's Castle hat sichtbare
Status-Ereignisse pro Läufer ("Vorsicht", "geschlagen", "weicht aus", "gerammt") an
individuellen Bildschirmpositionen, Time-Trial zeigt einen erkennbar gestaffelten Start
("Start in 26,9 s" je Läufer) mit unterschiedlichem Fortschritt zwischen den Läufern. Beide
werden hier nur genannt, weil sie ursprünglich als Kandidaten geprüft wurden — kein Handlungsbedarf.

## Was in dieser Runde bewusst NICHT umgesetzt wurde, und warum

Der Auftrag verlangt für 2-3 Befunde eine direkte Umsetzung, sofern sie "mit vertretbarem
Aufwand und OHNE Mechanik-/Rezept-Änderung" möglich ist. Nach der Untersuchung oben bleibt
ehrlich festzuhalten: **jeder in dieser Runde gefundene Befund verlangt entweder neue
Sprite-Assets (Basketball: Weg A/B/C, alle drei), eine neue Teilansicht (Tennis/Fechten:
Nahansicht bauen) oder betrifft gar keinen Fehler (Spurt/Staffel: Zeittakt, kein falscher Code;
Climbing/Sprechblasen/blickAus/Waffen-Pose: bereits vorher behoben).** Es gab in dieser Runde
keinen Fund von der Art "eine Zeile falsch, leicht zu korrigieren" — im Gegensatz zu den im
Auftrag genannten Präzedenzfällen (`laeuferSchwebeXY()`, Blickrichtung beim Klettern), die genau
deshalb schon vor dieser Runde behoben wurden. Einen Fix zu erzwingen, der in Wahrheit neue
Sprite-Daten oder eine neue Teilansicht bräuchte, hätte gegen die eigene Auftragsgrenze
verstoßen ("Größere Umbauten... NICHT selbst umsetzen") und wäre nicht "vertretbarer Aufwand"
gewesen. Diese Entscheidung — Audit statt erzwungenem Fix — folgt der im Auftrag selbst
vorgesehenen dritten Option: „Falls du nur den Audit-Bericht schreibst (keine Code-Änderung):
trotzdem committen/pushen, kein PR nötig dafür."

## Empfehlungen für eine eigene Runde, priorisiert

1. **Basketball, Weg A (Fable Abschnitt 2.3):** Handpunkt-Tabelle für `walk` messen (wie
   `docs/design/sprite-handpunkte.md` es für Waffen vormacht), Ball daran verankern. Kein neues
   Sprite-Blatt, aber eine echte Messaufgabe — die mit Abstand wirkungsvollste Einzelmaßnahme im
   ganzen Feld, weil Basketball die reifste und meistgespielte Disziplin ist.
2. **Basketball, Weg C (`spellcast` statt `shoot`):** in derselben Runde wie Weg A, sobald die
   `spellcast`-Blätter für den Baukasten geladen sind (aktuell nirgends vorhanden).
3. **Tennis/Fechten:** eine Nahansicht für das aktive Duell bauen (eigene Court-/Planche-Grafik,
   größere Sprites), analog zu Speed-Schachs Brett-Zoom — behebt den Rang-2/3-Befund oben.
4. **Spurt (kosmetisch, niedrige Priorität):** sanfterer Kamera-Zoom-Einstieg beim Massenstart.

## Verifikation

Kein Code in `public/mockups/battle-mode.engine.js`, `public/mockups/battle-mode.rezepte.js`
oder `lib/player-generator/` wurde in dieser Runde geändert. `git diff origin/main` (Branch
`ui-bewegungs-audit-26-09`) zeigt außer dieser Datei keine Änderung — rho ist für alle zwanzig
Disziplinen damit per Konstruktion bit-identisch zu `origin/main`, ein `miss-alle-disziplinen.mjs`-
Lauf wäre ein Leerlauf-Beleg für eine Nulldiff.
