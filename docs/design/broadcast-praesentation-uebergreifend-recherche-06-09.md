# Broadcast-Präsentation über alle Disziplinen — Recherche (06.09.)

**Reine Recherche/Konzept, keine Umsetzung.** Stand: `origin/main` `101505e8` (nach PR #827).
Cross-cutting über die gesamte Arena-UI (`public/mockups/battle-mode.engine.js`, alle vier
Chassis), nicht eine einzelne Disziplin. Baut auf zwei heute offenen Recherchen desselben Tages
auf und wiederholt sie nicht: PR #829 (`docs/design/staffel-oval-broadcast-hud-recherche-06-09.md`,
Broadcast-HUD für EINE Bahn-Disziplin) und PR #828
(`docs/design/takeshi-animationen-hilfe-behinderung-recherche-06-09.md`, `EFFEKTE`/`zeichneEffekte`
für EINE Bahn-Disziplin sichtbar machen). Beide sind noch nicht gemergt (`mergeable_state: blocked`,
Stand dieser Recherche) — ihr Inhalt ist über den PR-Branch gelesen, nicht über `main`.

Chris' Auftrag wörtlich (06.09.): „ich weiß nicht ob es kurze kommentare geben kann zu dem was
man sieht aber man sollte highlights zeigen und du könntest die felder vllt sogar größer machen
wenn du mehr damit arbeitest teils sachen in den screen zu integrieren weißt du wie die zeiten
beim laufen zb den score im hockey etc, dass das mehr wirkt wie ne live übertragung oder so".

---

## 0. Die Antwort in acht Sätzen

1. **Das Ziel „wirkt wie eine Live-Übertragung" ist kein Motorproblem — es ist ein
   Kompositionsproblem.** Score, Uhr, Rangfolge werden heute bereits live berechnet und
   angezeigt; sie sitzen aber als eigene HTML-Leiste (`.scoreline`/`.hpbars`) OBERHALB der
   Leinwand, nicht ALS Teil des Spielfeldbilds. Ein echter TV-Bug klebt auf dem Kamerabild;
   unsere Anzeige steht daneben. Das ist der eigentliche Unterschied, den Chris beschreibt —
   nicht fehlende Daten, sondern fehlende Komposition.
2. **Die Infrastruktur für genau diese Komposition existiert bereits, unbenutzt während des
   laufenden Spiels.** `.arenaraum{position:relative}` trägt schon zwei absolut positionierte
   Overlay-Ebenen über der Leinwand — `.einlauf` (vor dem Anpfiff) und `.endstand` (danach),
   beide `inset:0`. Ein Broadcast-HUD ist keine neue Technik, sondern derselbe Mechanismus,
   nur nicht `inset:0` (Vollbild-Modal), sondern ein kleiner Eckbereich, und nicht nur vor/nach,
   sondern WÄHREND des Spiels sichtbar.
3. **„Felder größer machen" ist beim jetzigen Stand nicht die Stellschraube.** Die Leinwand
   skaliert bereits fluid (`canvas{width:100%;height:auto}`, `.wrap{max-width:none}` im
   eingebetteten Spielmodus) — es gibt keine harte Pixelgrenze, die künstlich Platz wegnimmt.
   Was tatsächlich knapp ist, ist die INTERNE Höhenaufteilung der 1240×470-Leinwand bei den fünf
   Bahn-Disziplinen: 80 % der Höhe ist Lauffläche, nur 14 % oben / 6 % unten bleiben für Text.
   Für ein permanentes HUD-Element reicht das eng, aber knapper Innenraum wird durch einen
   halbtransparenten Bug ÜBER dem Bild gelöst (wie im echten TV), nicht durch eine größere
   Leinwand — Abschnitt 2 rechnet das durch.
4. **Highlights lassen sich mit fast keinem neuen Code zeigen, weil das Signal schon da ist.**
   `feed(seite, text, big)` — der Ticker — trägt seit Längerem ein `big`-Flag, das heute schon an
   zwölf Stellen über alle vier Chassis gesetzt wird: Touchdown, Field Goal, Sack, Interception,
   Tor (Hockey/Basketball), K.o. (Kampf), Zieleinlauf. Das ist exakt die Ereignisliste, nach der
   Chris fragt — sie muss nicht erfunden, nur SICHTBAR gemacht werden (heute nur eine Zeile im
   Ticker, optisch nicht von den anderen 139 Zeilen im Feed unterschieden).
5. **Kurze Kommentare/Captions sind machbar — als Templates aus genau demselben Signal, nicht
   als neue Text-KI.** Jeder `feed()`-Aufruf wird aus bereits strukturierten Daten gebaut (Spieler,
   Ereignistyp, Zahl), bevor er zu einem String verschmilzt — ein Caption-Generator hängt an
   denselben rund fünfzig Aufrufstellen, nicht an das schon fertige Textformat. Empfehlung:
   dieselbe Stelle wie beim `big`-Flag, ein zusätzliches optionales Textfeld `caption`, keine
   Sprachmodell-Anbindung.
6. **Kein Baustein dieser Runde berührt `wert()`, `stepSim`/`stepSpurt`/`stepBuehne`/`stepFeldspiel`
   oder eine Zufallszahl.** Alle drei Bausteine (HUD-Overlay, Highlight-Hervorhebung,
   Caption-Text) sind reine Leser vorhandener, längst berechneter Zustände — dieselbe Garantie,
   die PR #829 Abschnitt 5 für die Staffel schon einzeln nachgewiesen hat, hier verallgemeinert
   auf alle zwanzig Disziplinen und alle vier Chassis.
7. **Plumbing-Kosten statt rho-Risiko gibt es an genau einer Stelle:** die Bühne (Gewichtheben,
   Speed-Schach, Wettessen) setzt das `big`-Flag an KEINER Stelle — ein klarer, kleiner
   Nachtrag (Abschnitt 4.4), kein Entwurfsproblem.
8. **Empfehlung in einem Satz:** zuerst das generische HUD-Overlay bauen und an der Staffel
   (PR #829, bereits designed) als erster Instanz erproben, danach das `big`-Flag/`feed()` in
   einen Callout verwandeln (mittlerer Aufwand, alle Chassis auf einmal), Captions als
   Textvariante desselben Callouts nachziehen — eine Canvas-Vergrößerung ist NICHT nötig, außer
   für die fünf Bahn-Disziplinen, wo eine kleine interne Höhenkorrektur (Abschnitt 2.3) den
   Bug-Bereich komfortabler macht.

---

## 1. Was die beiden heutigen Recherchen schon festgelegt haben — und was hier verallgemeinert wird

| Baustein | PR #829 (Staffel) | PR #828 (Takeshi) | Was diese Runde daraus zieht |
|---|---|---|---|
| Broadcast-HUD | Eignung aktuell/nächster Läufer + lebendes Zeit-Delta, HTML-Panel über der Bahn, `updateHudBahn()`-gated | nicht Thema | generisches Rahmenmuster: EIN Overlay-Container, disziplinspezifische Dateninhalte als Plugin (Abschnitt 3) |
| Sichtbare Ereignisse | nicht Thema (nur die Zeitrechnung) | Rempler/Ausweichen/Gedränge an `EFFEKTE`/`zeichneEffekte` anschließen, Hindernisse auf `u.fallen[...].aus` reagieren lassen | das sind BILD-Reaktionen an Ort und Stelle (am Läufer, an der Falle) — ergänzend, nicht identisch zu einem Callout/Ticker-Highlight, der zeit- und ortsunabhängig eingeblendet wird (Abschnitt 4 unten grenzt das ab) |
| Event-Quelle | `u.eig`, `u.pos`, `rennT` — alles bereits berechnete Zustände, nur lesend | `u.fallen[...].aus`, `u.kraft`, Tackle-/Gedränge-Block — ebenfalls bereits berechnete Zustände | dieselbe Disziplin dieser Runde: **nichts Neues rechnen, nur neu zeigen** |
| rho-Prüfung | Abschnitt 5 dort: alle drei Bausteine rein lesend, keine `wert()`-Berührung | Abschnitt „Kategorie Dekoration": kein `rr()`, kein Rückschreiben | dieselbe Prüfmethode auf 20 Disziplinen × 4 Chassis skaliert (Abschnitt 6) |

**Wichtig, um Doppelarbeit zu vermeiden:** PR #829 hat das Delta-HUD bereits FÜR die Staffel
fertig durchgerechnet (Formel, Code-Skizze, Layout-Vorschlag, Abschnitt 4 dort). Diese Runde
entwirft KEIN zweites, konkurrierendes Staffel-HUD — sie zieht aus dem dortigen Entwurf das
generische Skelett (Container, Positionierung, Update-Anschluss) heraus und zeigt, wie es für
Hockey, Basketball, TDM, Gewichtheben usw. wiederverwendbar wird, ohne dass jede Disziplin ihr
eigenes Overlay-System bekommt.

---

## 2. Ist der Bildschirm wirklich zu klein? — Canvas- und Layout-Befund

### 2.1 Die Leinwand ist heute schon fluid, nicht gedeckelt

`public/mockups/battle-mode.html:83`: `<canvas id="cv" width="1240" height="470">` — das ist die
INTERNE Koordinatenauflösung, mit der jede Zeichenfunktion rechnet (`W=cv.width,H=cv.height`,
`engine.js:12752`). Die tatsächliche Bildschirmgröße bestimmt allein die CSS-Regel
`canvas{display:block;width:100%;height:auto}` (`battle-mode.css:209`) — die Leinwand füllt
bereits die volle Breite ihres Containers und skaliert die Höhe im festen Seitenverhältnis
2,638:1 mit. Es gibt keine feste Pixelbreite, die künstlich beschneidet.

Der Container selbst ist im eingebetteten Spielmodus (`.im-spiel`, gesetzt von
`FoundationBattleArenaHost.tsx`) sogar ausdrücklich VON der Standalone-Maximalbreite befreit:
`.im-spiel .wrap{max-width:none}` (`battle-mode.css:29`) gegen `.wrap{max-width:1300px}`
(`:55`) im eigenständigen Entwurf. Im echten Spiel bekommt die Arena also so viel Breite, wie das
Foundation-Shell-Panel hergibt — mehr, nicht weniger, als der 1300-px-Entwurfsrahmen.

**Befund: „größer machen" im Sinne von „mehr Bildschirm-Pixel" ist heute kein Hebel, weil nichts
ihn begrenzt.** Eine CSS-Änderung würde nichts sichtbar vergrößern, was nicht schon die volle
verfügbare Breite nutzt.

### 2.2 Was tatsächlich knapp ist: die INTERNE Höhenaufteilung der Bahn-Leinwand

Die fünf Bahn-Disziplinen (Spurt, Staffel, Time-Trial, Climbing, Takeshi's Castle) zeichnen ihre
Lauffläche zwischen zwei festen Bruchteilen der internen Höhe:

```js
// engine.js:15222, :17037 — bahnY()
const oben=H*0.14, unten=H*0.94;   // bei H=470: 65,8 px oben, 28,2 px unten
```

| Bereich | Anteil an H=470 | Pixel | Heutige Nutzung |
|---|---:|---:|---|
| Kopfraum (oben) | 14 % | 65,8 px | Wind-/Ansage-Hinweise, bei Takeshi die Burgpunkte-Legende |
| Lauffläche | 80 % | 376,0 px | Bahnen, Läufer, Hindernisse |
| Fußraum (unten) | 6 % | 28,2 px | praktisch ungenutzt |

Ein permanentes HUD-Band mit zwei Zeilen (z. B. „AKTUELL Krolach Eig 61 / NÄCHSTE Gram Eig 54",
PR #829 Abschnitt 4.3) braucht bei 9–11 px Zeilenhöhe grob 24–30 px reinen Text plus Padding —
das passt in den 65,8-px-Kopfraum, konkurriert dort aber bereits mit der Wind-/Legende-Zeile, die
heute denselben Raum nutzt (`bodenSpurt():15206 ff.`, s. PR #829 Abschnitt 4.3: „Fläche, die
heute die Burgpunkte-Legende für Takeshi nutzt — für Staffel bislang ungenutzt"). Für Takeshi
konkret ist der Kopfraum also NICHT frei; für Staffel/Spurt/Time-Trial/Climbing ist er es.

Bei den anderen drei Chassis ist die Frage anders gelagert:

- **Kampf (TDM/Battlefield/Mini-DM):** `zeichneBoden()` nutzt die volle Fläche als freie
  Arena, kein fester Kopf-/Fußstreifen — hier ist räumlich am meisten frei, weil die Kampfzone
  nicht in feste Bänder unterteilt ist.
- **Feldspiel (Basketball/Hockey/Football):** eigenes Spielfeld-Rechteck mit Toren/Körben an
  den Enden, Kopf-/Fußraum je nach Sportart unterschiedlich groß, nicht einheitlich vermessen in
  dieser Runde (kein Auftrag, s. Abschnitt 9).
- **Bühne (Gewichtheben/Schach/Wettessen):** Podest mit Scheinwerferkegeln (`bodenBuehne()`,
  `:10990 ff.`), keine feste Randaufteilung — auch hier ist der Rand grundsätzlich frei
  verfügbar.

**Befund: Nur die Bahn-Familie hat eine wirklich knappe interne Kopf-/Fußzeile — und selbst
dort ist die Lösung nicht „mehr Höhe", sondern ein halbtransparenter Bug, der über die
Lauffläche gelegt wird, wie unten in Abschnitt 2.3 gezeigt.**

### 2.3 Der eigentliche Fund: die Overlay-Infrastruktur existiert schon, nur ungenutzt während des Spiels

```css
/* battle-mode.css:440-444 */
.arenaraum{position:relative}
.einlauf{position:absolute;inset:0;background:rgba(16,20,26,.94); ...}
.endstand{position:absolute;inset:0;background:var(--ground); ...}
```

`.arenaraum` — der Container, der `<canvas>` UND `.einlauf` UND `.endstand` umschließt
(`battle-mode.html:82–109`) — ist bereits `position:relative`, genau die Voraussetzung für eine
absolut positionierte Overlay-Ebene. `.einlauf` (Team-Wappen, Aufstellung vor dem Anpfiff) und
`.endstand` (Sieger, Tabellen nach Spielende) sind BEIDE bereits solche Ebenen — sie liegen
sichtbar ÜBER der Leinwand, ohne dass ein einziger Pixel Canvas-Höhe dafür geopfert werden musste.
Beide sind reine `<div>`s mit HTML-Inhalt, kein `ctx.fillText()`.

**Der einzige Unterschied zu einem Broadcast-HUD:** `.einlauf`/`.endstand` decken das GANZE
Spielfeld ab (`inset:0`) und sind nur VOR bzw. NACH dem Spiel sichtbar (`hidden`-Attribut,
umgeschaltet in `finish()`/`renderEndstand()`/Klick auf „Kampf starten"). Ein HUD-Overlay bräuchte
stattdessen:

- eine kleine Ecke statt der ganzen Fläche (`position:absolute; top:8px; left:8px` o. ä., statt
  `inset:0`),
- Sichtbarkeit WÄHREND des Spiels statt davor/danach,
- einen halbtransparenten statt blickdichten Hintergrund, damit die Lauffläche/das Spielfeld
  dahinter sichtbar bleibt — exakt wie ein echter TV-Sender seinen Score-Bug über das laufende
  Bild legt, nicht daneben.

Kein neuer CSS-Mechanismus, keine neue Stapel-Logik: `.einlauf`/`.endstand` stehen im HTML NACH
dem `<canvas>`-Element (`battle-mode.html:83–108`), ein neuer Bug-Container davor eingefügt und
danach im DOM belassen läge automatisch unter beiden Modalen (natürliche Stapelreihenfolge ohne
`z-index`, geprüft: keine der beiden Regeln setzt `z-index`) und über der Leinwand — richtig in
beiden Fällen, ohne eine einzige neue Zeile CSS-Kaskadenlogik.

### 2.4 Fazit Viewport-Frage

**„Größer machen" ist nicht die Antwort — die Leinwand ist bereits so groß wie ihr Container,
und der Container ist bereits so groß wie das Foundation-Panel es zulässt.** Was fehlt, ist nicht
Fläche, sondern Komposition: die heutige Score-/Uhr-Anzeige (`.scoreline`/`.hpbars`) sitzt als
separate HTML-Leiste OBERHALB von `.arenaraum`, nicht ALS Overlay INNERHALB davon — genau der in
Abschnitt 0 benannte Unterschied zwischen „Daten stehen daneben" und „Daten kleben auf dem Bild".
Die einzige Stelle, an der ein echter Platzmangel real ist (die 14-%/6-%-Bahn-Ränder bei
Takeshi, wo die Burgpunkte-Legende bereits sitzt), löst sich durch Transparenz und Kompaktheit,
nicht durch eine höhere Leinwand — s. Abschnitt 3.4 für die konkrete Empfehlung.

---

## 3. Das generische Broadcast-HUD — ein Muster, vier Chassis, eine Instanz schon entworfen

### 3.1 Das Rahmenkonzept: EIN Container, disziplinspezifischer Inhalt als Plugin

```html
<!-- neu, in battle-mode.html, NACH <canvas>, VOR .einlauf -->
<div class="broadcastbug" id="bbug" hidden></div>
```

```css
.broadcastbug{position:absolute;top:10px;left:10px;right:10px;
  display:flex;justify-content:space-between;gap:12px;pointer-events:none;
  font-family:"IBM Plex Mono",monospace}
.broadcastbug .seite{background:rgba(17,24,35,.72);border-radius:6px;padding:5px 10px;
  border:1px solid rgba(255,255,255,.12);color:#fff;font-size:11px;line-height:1.5}
.broadcastbug .seite.l{border-color:var(--home)} .broadcastbug .seite.r{border-color:var(--away)}
```

Ein einzelner Container, an dessen zwei Kind-Elementen (`.seite.l`/`.seite.r`, dieselbe
Links/Rechts-Konvention wie `.scoreline`/`.kaderleiste`/`.wsplit`) jede Disziplin ihre eigenen
Zeilen einhängt. Die Update-Funktion ist **keine neue**: jedes der vier Chassis hat bereits eine
zentrale HUD-Aktualisierungsfunktion, die pro Frame/Tick läuft —

| Chassis | vorhandene Update-Funktion | Zeile |
|---|---|---:|
| Kampf | `updateHud()` | `:14699` |
| Bahn | `updateHudBahn()` | `:14650` |
| Bühne | `updateHudBuehne()` | `:10941` |
| Feldspiel | `updateHudFeldspiel()` (Kommentar-Referenz in `updateHudBahn`, `:14662`) | — |

Der Bug wird an genau dieser Stelle gefüllt, disziplinspezifisch, dieselbe Gating-Konvention wie
heute schon für `.rennplanzeile`/`.fokuszeile` (`if(BA().staffel)`/`if(BA().takeshi)` usw.) —
**kein fünfter Update-Pfad, sondern eine zusätzliche Zeile in vier bestehenden Funktionen.**

### 3.2 Welche Datenslots je Chassis — konkret, nicht abstrakt

| Chassis/Disziplin | Slot 1 (immer) | Slot 2 (disziplinspezifisch) | Quelle (bereits berechnet) |
|---|---|---|---|
| Staffel | aktueller/nächster Läufer + Eignung | Zeit-Delta zum Führenden | PR #829 Abschnitt 4 — **fertig entworfen** |
| Spurt/Time-Trial/Climbing | Rang | Rückstand zum Führenden in Sekunden (dieselbe Verlaufspuffer-Methode wie PR #829, ohne die Staffel-spezifische Rundenlogik) | `u.pos`, `rennT`, analog PR #829 §4.2 |
| Takeshi's Castle | Burgpunkte laufend (`burgpunkte(u)`, bereits am Läufer eingeblendet, `:17114`) | Anzahl noch aktiver Läufer je Seite | `LAEUFER`, `u.fallen` |
| Hockey/Basketball | Score (heute in `.scoreline`, hier zusätzlich im Bug) | Uhr/Viertel-/Drittel-Stand | `fsPunkte`, `fsT` |
| Football | Score | Down/Distance (falls modelliert) oder Ballbesitz-Marker | dieselbe Feldspiel-Zustandsschicht |
| TDM/Battlefield/Mini-DM | lebende Einheiten je Seite | Sudden-Death-Restzeit (heute schon in `.hpbars .sd`, hier zusätzlich im Bug) | `live(side)`, `t` |
| Gewichtheben | aktueller Heber + angesagtes Gewicht | Versuch (1/2/3) + Übung (Reißen/Stoßen) | `u.aktuell`, `ansage[u.id]`, `BB().heben` |
| Speed-Schach | am Zug befindliches Team/Brett | Vorteil laufend (existiert bereits als Text, `:10931`) | `u.vorteil`, `u.brett` |

**Wichtig, damit dieser Vorschlag nicht als „neue Formel" missverstanden wird:** JEDE Zelle in
dieser Tabelle liest eine Variable, die im jeweiligen `updateHud*()` HEUTE SCHON gelesen wird, um
`.scoreline`/`.hpbars` zu befüllen, oder die am Läufer/Spieler bereits als Canvas-Text steht
(z. B. Burgpunkte). Der Bug verdoppelt eine Anzeige an einer sichtbareren Stelle, er berechnet
nichts neu.

### 3.3 Wo die Staffel als „erste Instanz" reinpasst

PR #829 Abschnitt 4.3 schlägt für die Staffel bereits exakt diese Bauform vor („HTML-Panel …
robuster … weil es nicht mit der Sprite-Positionierung im Gedränge konkurriert") und begründet
dieselbe Entscheidung, die Abschnitt 2.3 hier aus der vorhandenen `.einlauf`/`.endstand`-Struktur
ableitet. Der einzige Unterschied: PR #829 entwirft ein EIGENES, freistehendes Panel „über der
Bahn" (in der dort für Staffel bislang ungenutzten Kopfzeile); dieser Vorschlag hier verortet
dasselbe Panel im generischen `#bbug`-Container, damit die nächste Disziplin (Time-Trial,
Hockey, …) dieselbe Hülle bekommt, statt dass jede Disziplin ihr eigenes Overlay-`<div>` mit
eigenem CSS-Selektor erfindet. **Wer PR #829 zuerst umsetzt, baut damit automatisch den
generischen Container mit — die Staffel-Zellen aus PR #829 §4.1/4.2 sind die ersten beiden
Zeilen im `#bbug .seite`, nicht ein Sonderfall daneben.**

### 3.4 Die Takeshi-Ausnahme aus Abschnitt 2.2 — konkrete Lösung

Weil der Kopfraum bei Takeshi bereits die Burgpunkte-Legende trägt, bekommt der Bug dort
entweder (a) eine kombinierte Zeile („★-Legende + Burgpunkte laufend" in einer Reihe statt
zwei), oder (b) wandert probeweise in die rechte obere Ecke statt zentriert, während die Legende
links bleibt — beides eine Anordnungsfrage für die Umsetzung, kein Konzeptproblem. Keine der
beiden Optionen braucht mehr Canvas-Höhe.

### 3.5 Zusammenspiel mit dem bestehenden `.scoreline`/`.hpbars`-Header

**Der Bug ersetzt die DOM-Kopfzeile nicht — er ergänzt sie.** `.scoreline` bleibt die
verlässliche, barrierefreie, immer lesbare Quelle (Screenreader, kleine Bildschirme, wo der Bug
aus Platzgründen ausgeblendet werden könnte); der Bug ist die zusätzliche, ins Bild integrierte
Wiederholung derselben Zahl für den „fühlt sich an wie Fernsehen"-Effekt. Das ist dieselbe
Redundanz, die echte Sportübertragungen auch fahren (Bauchbinde im Bild UND eine separate
Statistik-Grafik/App daneben) — keine der beiden Anzeigen macht die andere überflüssig.

---

## 4. Highlights: das Signal existiert schon — `feed()`s `big`-Flag

### 4.1 Der Fund

```js
// engine.js:17412
function feed(side,txt,big){
  ...
  d.appendChild(el("span",(side===0?"h":"a")+(big?" big":""),txt));
  ...
}
```

`big` ist heute nur eine CSS-Klasse (`.feed .big{color:var(--ink);font-weight:500}`,
`battle-mode.css:542`) — optisch kaum unterscheidbar von den anderen 139 Zeilen im
scrollenden Ticker (`while(f.children.length>140)`, `:17429`). Aber die Aufrufstellen selbst
sind bereits die Ereignisliste, nach der der Auftrag fragt — **zwölf Stellen, über alle vier
Chassis hinweg, jede aus strukturierten Daten gebaut, bevor sie zum Text wird:**

| Zeile | Chassis | Ereignis |
|---:|---|---|
| `:6721` | Feldspiel (Football) | Touchdown |
| `:6746` | Feldspiel (Football) | Field Goal |
| `:6772` | Feldspiel (Football) | Sack |
| `:6787` | Feldspiel (Football) | Fumble Recovery |
| `:6807` | Feldspiel (Football) | Interception |
| `:7142` | Feldspiel (Basketball) | Viertelende + Spielstand |
| `:8453` | Feldspiel (Hockey) | Tor |
| `:8600` | Feldspiel | (weiteres großes Ereignis, disziplinabhängig) |
| `:13081` | Kampf | K.o. (Seite A trifft) |
| `:13513` | Kampf | K.o. (Seite B trifft) |
| `:17439` | Bahn | Zieleinlauf/Endstand |
| `:18297` | Kampf | Zielansage |

**Bühne (Gewichtheben, Speed-Schach, Wettessen) fehlt vollständig** — kein einziger
`feed(...,true)`-Aufruf in `stepBuehne()`. Das ist die in Abschnitt 0.7 benannte Lücke: ein
gültiger dritter Versuch, ein Matt, ein entscheidender Punktegewinn sind heute mechanisch bereits
Ereignisse (`r.gueltig&&r.versuch===3` ist sogar schon als `crit`-Bedingung für die Schwebetext-
Anzeige vorhanden, `:10912`), nur nie als `big` an `feed()` durchgereicht.

### 4.2 Warum das der richtige Ausgangspunkt ist — und nicht Auto-Erkennung

Die Aufgabenstellung nennt zu Recht, dass „welche Momente highlight-würdig sind" ein eigenes
Designproblem ist. Diese Runde umgeht es bewusst, statt es zu lösen: **jedes `big`-Ereignis ist
bereits eine explizite, von einem Entwickler getroffene Entscheidung** („das hier ist wichtig
genug für den fett gedruckten Ticker-Eintrag"), keine Heuristik, die im Nachhinein raten müsste,
was in einem Zahlenstrom auffällig ist. Das ist genau der Unterschied zwischen „vorhandenes
Signal nutzen" und „neue Erkennungslogik erfinden", den der Auftrag verlangt.

### 4.3 Wie es sichtbar wird — eine konkrete Wahl, keine Optionsliste

Drei Kandidaten, aus denen der Auftrag EINEN verlangt:

1. **Flash/Callout-Banner** (kurz eingeblendete Zeile über dem Spielfeld, 2–3 Sekunden,
   automatisch ausblendend) — **Empfehlung.**
2. **Highlight-Replay** (ein Sim-Ausschnitt wird pausiert und noch einmal gezeigt) — technisch
   aufwendig: die Engine simuliert vorwärts in Echtzeit-Ticks, ein „Zurückspulen" bräuchte
   entweder einen Zustands-Schnappschuss je Tick (Speicher, ungeprüfter Aufwand) oder eine zweite
   deterministische Vor-Simulation nur für den Replay-Ausschnitt (der Motor ist deterministisch
   bei gleicher Saat, `:70` „Simulation deterministisch — gleiche Aufstellung, gleicher Verlauf",
   das würde technisch gehen, ist aber ein Mehrfaches an Aufwand für denselben Informationsgehalt).
3. **Highlight-Reel nach dem Spiel** (Zusammenschnitt aller `big`-Momente im `.endstand`-Overlay)
   — sinnvoll als ZUSATZ, aber ersetzt nicht das Bedürfnis „ich will es SEHEN, während es
   passiert" — Chris' Formulierung („highlights zeigen", im Kontext von „live übertragung")
   deutet auf Live-Betonung, nicht auf einen nachträglichen Rückblick.

**Empfehlung: (1) Flash/Callout-Banner, mit (3) Highlight-Reel als kleiner, fast kostenloser
Zusatz.** Begründung: Ein Callout ist strukturell **dasselbe Overlay-Muster wie Abschnitt 3**
(ein `<div>` über `.arenaraum`, kurzzeitig eingeblendet statt dauerhaft) — es teilt sich die
Infrastruktur mit dem Broadcast-HUD, statt eine dritte zu erfinden. Ein Highlight-Reel ist,
sobald `big`-Ereignisse in einem Array statt nur im DOM-Ticker gesammelt werden (ein `HIGHLIGHTS=[]`
neben `EFFEKTE=[]`, dieselbe Push-Konvention), praktisch kostenlos im `.endstand`-Overlay als
zusätzliche Liste mitzuliefern — aber das Replay selbst bräuchte den unter (2) beschriebenen
Mehraufwand, wenn es eine echte Bild-Wiederholung statt einer Textzeile sein soll. Eine reine
**Text-Liste** „Höhepunkte dieses Spiels" im bestehenden `.endstand` ist dagegen trivial (dieselbe
`HIGHLIGHTS`-Sammlung, gerendert wie `etafelL`/`etafelR` heute schon Tabellen rendern) und sollte
in derselben PR wie der Callout mitkommen.

### 4.4 Konkreter Umsetzungsvorschlag (für eine spätere PR, nicht diese Runde)

```js
// an jeder der zwoelf Stellen zusaetzlich, sowie an den fehlenden Buehnen-Stellen:
feed(seite, text, true);              // unveraendert
callout({side:seite, txt:kurzform, dauer:2.6});   // NEU, aus demselben Aufruf
```

`callout()` ist eine zusätzliche, einzeilige Funktion neben `feed()`, die denselben Text (oder
eine noch kürzere Fassung davon) in den `#bbug`-Container aus Abschnitt 3 schreibt, mit einer
CSS-Transition zum Ausblenden — keine neue Zustandsmaschine, ein `setTimeout`/Kombination aus
Klassenname und `transition:opacity`. Die fehlenden Bühnen-Stellen (Abschnitt 4.1) bekommen in
derselben PR ihr erstes `feed(...,true)` — vier bis fünf neue Aufrufstellen (dritter gültiger
Versuch, Nullwertung, Matt/Sieg im Schach, entscheidender Punktegewinn im Wettessen), reine
Textzeilen, kein neuer Zustand.

---

## 5. Kurze Kommentare/Captions — Chris' offene Frage, konkret beantwortet

### 5.1 Ist es machbar? Ja — als Templates aus strukturierten Daten, nicht als generative KI

Jeder `feed()`-Aufruf im Motor entsteht aus VARIABLEN, die zum Zeitpunkt des Aufrufs bereits
vollständig bekannt sind — Spielername, Ereignistyp, Zahl. Ein Beispiel, unverändert aus dem
Motor zitiert:

```js
// engine.js:8453
feed(schuetze.side, schuetze.n+" trifft"+(a1?" nach Vorlage von "+a1.n:"")+" — TOR!", true);
```

Das ist bereits, was Chris beschreibt: `schuetze.n` (Spielername), `a1.n` (Vorlagengeber, optional),
„TOR!" (Ereigniswort) — nur schon zu einem festen Satz zusammengesetzt. Ein Caption-Generator
bräuchte an dieser Stelle **kein einziges neues Datenfeld**, nur eine zweite, alternative
Formulierung derselben drei Variablen, z. B. per Zufall aus einer kleinen Phrasenliste gewählt:

```js
const TOR_PHRASEN = [
  (s,a)=>`${s} verwandelt${a?` nach Vorlage von ${a}`:""} eiskalt!`,
  (s,a)=>`Da ist er drin — ${s} trifft${a?` nach Zuspiel von ${a}`:""}!`,
  (s)=>`${s} lässt dem Torwart keine Chance!`,
];
```

**Das ist exakt das „{Spieler} verwandelt einen riskanten Wurf!"-Muster, das der Auftrag
vorschlägt — und es ist heute schon zu über 90 % vorhanden, weil die Variablen längst existieren.**
Die einzige neue Arbeit ist das SCHREIBEN mehrerer Phrasen je Ereignistyp (redaktionelle Arbeit,
kein Technikproblem) und eine kleine Auswahlfunktion (Zufall oder Rotation, damit nicht bei jedem
Tor derselbe Satz erscheint).

### 5.2 Wo die Grenze der einfachen Lösung liegt — und warum sie hier ausreicht

Ein Templates-System KANN nicht:

- auf den bisherigen Spielverlauf Bezug nehmen („sein drittes Tor heute" — bräuchte einen
  Lauf-Zähler je Spieler UND Spiel, den es heute streckenweise schon gibt, z. B. `u.summe` in
  der Bühne oder `rennFertig`-Reihenfolge in der Bahn, aber nicht einheitlich für alle Chassis),
- echte sprachliche Varianz über Dutzende Spiele hinweg liefern, ohne dass sich Phrasen sichtbar
  wiederholen (bei 3–5 Phrasen je Ereignistyp und einem Spiel mit vielleicht 3–8 „big"-Momenten
  ist Wiederholung **innerhalb eines Spiels** unwahrscheinlich, aber über eine ganze Saison mit
  Hunderten Toren wird sie irgendwann auffallen — akzeptabel für den Start, kein Totschlagargument).

Für den Umfang, den Chris beschreibt („kurze Kommentare zu dem, was man sieht"), ist das
Templates-System die richtige ERSTE Ausbaustufe: es beantwortet „kann man das überhaupt bauen"
mit einem klaren Ja, ohne die Komplexität eines LLM-Aufrufs zur Laufzeit (Latenz, Kosten, ein
nicht-deterministischer Text in einer Engine, die sich ausdrücklich ihrer Determinismus rühmt,
`:70`) und ohne eine neue Dateninfrastruktur (Abschnitt 5.1 zeigt, dass die Daten schon da sind).

### 5.3 Empfohlener Startumfang

- **Nur an den bereits existierenden `big`-Stellen** (Abschnitt 4.1) — keine neue
  Ereigniserkennung, dieselbe Liste wie beim Callout.
- **3–4 Phrasen je Ereignistyp**, deterministisch aus der vorhandenen Renn-/Spiel-Saat gewählt
  (`rr()` existiert bereits als Zufallsquelle im Motor, s. Weightlifting-Beispiel oben) — bewahrt
  die Determinismus-Eigenschaft der Engine (dieselbe Saat → derselbe Spielverlauf → derselbe
  Kommentar), statt `Math.random()` zu benutzen, was bei einer erneuten Wiedergabe derselben
  Partie einen anderen Text zeigen würde.
- **Textquelle ist derselbe Callout-Container aus Abschnitt 4.4**, nicht eine neue UI-Fläche —
  die Caption IST der Kommentar zum Highlight, keine zusätzliche dritte Anzeige.
- **Explizit NICHT im Startumfang:** Bezug auf Spielverlauf/Serien-Zähler (5.2), keine
  KI-generierten Sätze, keine Sprachausgabe (Text-to-Speech wäre ein eigener, viel größerer
  Auftrag mit eigener Aufwandsschätzung).

---

## 6. Prüfung: bleibt `wert()`/rho unberührt?

| Baustein | Liest | Schreibt in Simulationszustand? | Neue Zufallszahl? | Risiko für rho |
|---|---|---|---|---|
| `#bbug`-Overlay (Abschnitt 3) | `u.eig`, `u.pos`, `fsPunkte`, `burgpunkte(u)`, `u.aktuell` — alles bereits berechnete Werte | nein | nein | **keins** |
| `big`-Flag-Callout (Abschnitt 4) | dieselben Variablen, die heute schon in `feed()`-Aufrufen stehen | nein | nein | **keins** |
| Caption-Templates (Abschnitt 5) | dieselben Variablen + eine Phrasenauswahl über die vorhandene `rr()` | nein (Auswahl einer Textvariante ist keine Spielzustandsänderung) | **ja, aber rein kosmetisch** — s. u. | **keins, sofern der `rr()`-Aufruf an einer Stelle sitzt, die `wert()` nicht mitliest** |

**Die einzige Zeile, die Vorsicht verdient:** die Phrasenauswahl in Abschnitt 5.3 zieht einen
zusätzlichen `rr()`-Wert. Das ist unproblematisch, SOFERN dieser Aufruf strikt NACH allen
wertungsrelevanten Würfen des jeweiligen Ereignisses passiert und sein Ergebnis nirgends
zurückgelesen wird außer von der Text-Auswahl selbst — dieselbe Bedingung, die PR #828 Abschnitt
1.3 für das optische `u.lungeVis`-Feld formuliert („Rho-Risiko: keins, sofern das Feld
ausschließlich in `zeichneSpurt` gelesen wird"). Eine Nachmessung mit
`scripts/miss-alle-disziplinen.mjs` VOR und NACH Einbau des Templates-Systems ist trotzdem
sinnvoll (CLAUDE.md: „nachmessen statt behaupten"), weil ein zusätzlicher `rr()`-Aufruf JEDEN
nachfolgenden Aufruf in der Sequenz um eine Position verschiebt, falls der Motor einen
gemeinsamen, fortlaufenden Zufallsstrom nutzt statt separater Generatoren je Zweck — das wäre ein
reiner Verifikations-Schritt, kein erwartetes Problem.

**Plumbing-Kosten (kein rho-Risiko, aber echter Aufwand):** keiner der drei Bausteine braucht
eine neue BERECHNUNG — aber das Highlight-Reel (Abschnitt 4.3, Kandidat 3) braucht eine neue
DATENSTRUKTUR (`HIGHLIGHTS=[]`, analog `EFFEKTE=[]`), die über die Dauer eines Spiels gesammelt
wird und beim `.endstand`-Aufbau gelesen wird. Das ist Plumbing (ein neues Array, ein `push()` an
denselben Stellen wie `feed(...,true)`), keine neue Wertung.

---

## 7. Priorisierung und Aufwand

| # | Baustein | Kategorie | Aufwand | `wert()` berührt? | Voraussetzung |
|---|---|---|---|---|---|
| 1 | `#bbug`-Container: HTML/CSS-Grundgerüst, gated per Chassis, erste Instanz = Staffel-Zellen aus PR #829 §4.1/4.2 | **Dekoration** | klein (Container + 4× eine Zeile in `updateHud*()`) | nein | PR #829 sollte zuerst landen — sonst wird die Staffel-Instanz doppelt entworfen |
| 2 | `#bbug`-Zellen für die übrigen Bahn-Disziplinen (Rang+Rückstand, Abschnitt 3.2 Zeile 2) | Dekoration | klein–mittel (eine Verlaufspuffer-Instanz je Disziplin analog PR #829 §4.2, ohne die Staffel-Rundenlogik) | nein | 1 |
| 3 | `#bbug`-Zellen für Feldspiel/Bühne/Kampf (Score/Uhr/Rest-Zeit im Bild dupliziert) | Dekoration | klein (reine Textduplikate aus `.scoreline`/`.hpbars`) | nein | 1 |
| 4 | Fehlende `feed(...,true)` in der Bühne nachtragen (Abschnitt 4.1) | Dekoration | trivial (4–5 Zeilen) | nein | keine |
| 5 | `callout()`: `big`-Ereignisse als 2–3-Sekunden-Banner im `#bbug`-Bereich | Dekoration, neue Anzeige-Logik | mittel (Timer/Fade, eine neue Funktion) | nein | 1, 4 |
| 6 | `HIGHLIGHTS=[]`-Sammlung + Textliste im `.endstand` | Dekoration, neues Array | klein–mittel | nein | 4 |
| 7 | Caption-Templates (Abschnitt 5) | Dekoration, ein zusätzlicher `rr()`-Aufruf | mittel (Phrasenlisten je Ereignistyp × Disziplin schreiben) | **nein, aber verifizieren** (Abschnitt 6) | 5 |
| 8 | Bild-Replay statt Text-Callout (Abschnitt 4.3, verworfener Kandidat 2) | **nicht empfohlen für den Start** | groß (Zustands-Schnappschuss oder Zweit-Simulation) | nein, aber deutlich mehr Fläche für Fehler | — |
| 9 | Canvas-interne Höhenkorrektur für Takeshi (Abschnitt 3.4) | Dekoration, Layout | klein | nein | 1 |

**Empfohlene Reihenfolge:** 1 → 4 → 3 → 2 → 5 → 6 → 7, mit 9 parallel zu 1 (unabhängig). 8 explizit
zurückgestellt — nicht verboten, aber der Aufwand steht in keinem Verhältnis zum
Informationsgewinn gegenüber einem guten Text-Callout, solange niemand nach einer echten
Bild-Wiederholung fragt.

**Gesamteinschätzung:** Der komplette Auftrag ist, wie bei PR #829 und PR #828, überwiegend
Anzeige- und Kompositionsarbeit auf einem bereits korrekt rechnenden Modell. Die größte Änderung
gegenüber dem Status quo ist konzeptionell (Daten aus einer separaten Kopfzeile INS Bild holen),
nicht rechnerisch.

---

## 8. Offene Fragen an Chris — mit Voreinstellung

1. **Reihenfolge PR #829 vs. dieser Vorschlag:** soll PR #829 (Staffel-HUD) zuerst umgesetzt
   werden und dieser Bug-Container ihn danach generalisieren, oder umgekehrt (Container zuerst,
   Staffel-Zellen als erste Instanz direkt hinein)? Voreinstellung: PR #829 zuerst, weil sie
   bereits vollständig entworfen ist — dieser Vorschlag baut ausdrücklich darauf auf.
2. **Callout-Dauer und -Frequenz:** 2,6 s Vorschlag (Abschnitt 4.4) — reicht das, oder soll es
   sich an der bereits vorhandenen `ANSAGE_NACHLEUCHTEN`-Konstante orientieren (dieselbe Art von
   Zeitfenster, die für Ansage-Marker schon existiert, `:17102`)? Voreinstellung: an
   `ANSAGE_NACHLEUCHTEN` orientieren, damit nicht zwei separate „wie lange bleibt etwas sichtbar"-
   Zahlen im selben Motor unabhängig gepflegt werden.
3. **Captions: eigene Textzeile im Callout, oder Ersatz für den bisherigen `feed()`-Text?**
   Voreinstellung: eigene, kürzere Textzeile NUR im Callout — der Ticker (`.feed`) bleibt
   sachlich/protokollarisch, wie er heute ist, weil er auch für die Wertungsnachvollziehbarkeit
   gelesen wird (s. `docs/BUGFIXING_AGENT.md`-Nutzung des Feeds bei Fehlersuche).
4. **Soll der `#bbug`-Container im eingebetteten Spielmodus (`.im-spiel`) automatisch aktiv sein,
   oder braucht es einen Umschalter „Broadcast-Modus an/aus"** (für Spieler, die die reine
   Zahlenansicht bevorzugen)? Voreinstellung: automatisch an, kein Schalter — dieselbe Prämisse
   wie bei den bereits gebauten HUD-Erweiterungen, die auch nicht optional sind.
5. **Highlight-Reel im `.endstand`:** gewünscht als Startumfang, oder erst später? Voreinstellung:
   in derselben PR wie der Callout, weil die Datensammlung (`HIGHLIGHTS=[]`) ohnehin für den
   Callout gebraucht wird — der Reel ist dann nur noch eine Render-Funktion.

---

## 9. Was diese Runde nicht geprüft hat

- Kein Prototyp-Diff, kein Screenshot — reine Recherche, wie beauftragt.
- Die exakte Pixel-Position des `#bbug`-Containers je Feldspiel-Disziplin (Basketball/Hockey/
  Football haben unterschiedliche Spielfeld-Seitenverhältnisse) ist nicht einzeln vermessen —
  Abschnitt 2.2 hat nur die Bahn-Familie (einheitliches `bahnY()`) und pauschal Kampf/Bühne
  geprüft.
- Die konkrete Phrasenliste für Captions (Abschnitt 5) ist nicht geschrieben — nur das Muster
  und ein Beispiel.
- Ob eine echte Bild-Wiederholung (Abschnitt 4.3, Kandidat 2) technisch über eine
  Zweit-Simulation robust umsetzbar wäre, ist nicht durchgerechnet — bewusst zurückgestellt, weil
  Kandidat 1 den Auftrag mit deutlich weniger Risiko erfüllt.
- Keine Messung mit `scripts/miss-alle-disziplinen.mjs` gefahren — keine Codeänderung, gegen die
  zu messen wäre; Abschnitt 6 begründet stattdessen aus dem Code, warum keine Messung nötig ist,
  und wo eine Verifikation vor der Umsetzung sinnvoll bleibt.

## Quellen im Repo

`public/mockups/battle-mode.html` (Struktur `.arenaraum`/`.einlauf`/`.endstand`, `:82–109`);
`public/mockups/battle-mode.css` (`.im-spiel`/`.wrap` `:28–29/55`, `canvas` `:209`, `.arenaraum`/
`.einlauf`/`.endstand` `:423–444`, `.feed`/`.big` `:505/542`); `public/mockups/battle-mode.engine.js`
(`bahnY()` `:15222/17037`, `updateHud()` `:14699`, `updateHudBahn()` `:14650`, `updateHudBuehne()`
`:10941`, `feed()` `:17412`, `EFFEKTE`/`effekt`/`zeichneEffekte` `:17193–17245`, `big`-Aufrufstellen
s. Tabelle Abschnitt 4.1, Gewichtheben-Rundenlog `:10888–10935`); `app/foundation/battle-arena/
FoundationBattleArenaHost.tsx` (native Einbettung, `.im-spiel`); `docs/design/
staffel-oval-broadcast-hud-recherche-06-09.md` (PR #829, Delta-HUD-Formel Abschnitt 4);
`docs/design/takeshi-animationen-hilfe-behinderung-recherche-06-09.md` (PR #828, `EFFEKTE`-Anschluss);
`docs/design/battle-mode-20-spieltage-recherche-06-09.md` (Struktur-/Rigor-Vorlage dieser Runde);
`CLAUDE.md` (Abnahme je Spiel, kaderfeste Messung, Server-/Spiegel-Hinweise nicht Gegenstand dieser
Runde).
