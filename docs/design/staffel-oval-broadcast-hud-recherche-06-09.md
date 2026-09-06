# Staffel: Oval-Bahn, feste Übergabe an der Ziellinie, Broadcast-HUD — Recherche (06.09.)

Reine Recherche und Konzept — **keine Umsetzung**. Grundlage: `public/mockups/battle-mode.engine.js`
auf `main` (`101505e8`, Stand nach PR #827), `app/foundation/discipline-stage/arena/disciplines/track.tsx`,
`docs/design/staffel-modellierung-recherche-05-09.md`, `docs/design/endstand-punkte-staffel-takeshi-plan-06-09.md`.

Chris' Auftrag wörtlich (06.09.): „staffel findet in einem größeren oval statt! und die übergabe
ist IMMER an der ziel linie also nach einer gesamten runde. am besten läuft es so dass es auch
3 minuten oder so in summe dauert, und die übergabe kann ja fumblen etc wie wir gesagt hatten
manche sind schneller manche langsamer usw […] aber auf jeden fall OVAL und man sieht dann immer
nur die aktuellen spieler und die kommenden warten dann an der ziellinie — vllt könnte man dafür
wie in ner übertragung auch eingebettet die eignung der spieler haben die aktuell laufen und die
als nächstes kommen und dazu das delta was sie an zeit aktuell raus geholt haben — dynamisch wie
bei nem rennen üblich".

---

## 0. Die Antwort in fünf Sätzen

1. **Vier der fünf Forderungen sind reine Optik — die Zeitrechnung (`etappenZeit`,
   `wechselKonto`, `MOTOREN.staffel.wert()`) muss dafür KEINE einzige Zeile anfassen.** Der
   Trick: die Simulation kennt bereits eine „lokale" 0..1-Größe je Abschnitt
   (`laufAnteil(u)`, `engine.js:16436 ff.`), auf der Tempo, Kurve und Ermüdung schon rechnen. Ein
   Oval ist nur eine neue Zeichenfunktion, die dieselbe Zahl auf eine Ellipse statt auf eine
   Gerade legt — der Motor merkt den Unterschied nicht.
2. **Die Übergabe „immer an der Ziellinie nach einer ganzen Runde" ist HEUTE SCHON so, nur
   unsichtbar.** Jeder Abschnitt ist bereits 1/n der Rennstrecke (`beinVon=idx/n,
   beinBis=(idx+1)/n`), und die Übergabe passiert exakt am Ende jedes Abschnitts — nur liegt
   dieser Punkt heute an sechs VERSCHIEDENEN Stellen einer geraden, scrollenden Bahn statt an
   EINER Stelle eines Ovals. Die Runde existiert rechnerisch längst; sie wird nur linear statt
   kreisförmig gezeichnet.
3. **Der naheliegende Weg, „Runde" wörtlich zu nehmen — jeder Lauf bekommt seinen eigenen
   0..1-Bereich statt 1/n des Rennens —, ist eine Falle.** Er ändert `u.pos`-Semantik, auf der
   der generische Zielcheck aller fünf Bahnen (`if(u.pos>=1)`, `engine.js:17018`) UND der
   staffeleigene Wechselcheck (`u.beinBis<1 && u.pos>=u.beinBis`, `:16946`) beide hängen — ohne
   eine explizite „ist das der letzte Abschnitt"-Markierung würde jede Übergabe fälschlich als
   Zieleinlauf gewertet, und das Rennen würde ums Sechsfache länger, weil `u.v*dt/strecke`
   dieselbe Distanznormierung für jede „Runde" bräuchte wie heute für das GANZE Rennen. Empfehlung
   unten (Abschnitt 2.2): NICHT so bauen.
4. **Fumble/Übergabe-Varianz ist längst gebaut UND gemessen — nichts zu tun.** Stufenloser
   Zeitverlust aus dem TECHNIK-Schnitt beider Läufer (`WECHSEL_MAX/K/MIN`), echter Patzer mit
   9–11 % Grundchance (`WECHSEL_PATZER=0.11`, ROBUST senkt sie), beiden zur Hälfte im
   `wechselKonto` angeschrieben — exakt „manche sind schneller manche langsamer". Kaderfest
   0,915 / Spiel, die beste Rangtreue aller zwanzig Disziplinen (`stand-aller-disziplinen.md`
   Zeile 71).
5. **Die einzige offene Frage — das Broadcast-HUD mit lebendem Zeit-Delta — braucht eine neue,
   aber billige Mechanik: einen kleinen Fortschritt/Zeit-Verlaufspuffer je Seite und eine
   Interpolation, dieselbe Methode, mit der Radsport-Übertragungen den Zeitabstand zum
   Führenden in Echtzeit einblenden.** Konkreter Vorschlag mit Formel in Abschnitt 4. Auch das
   liest nur vorhandene Größen (`rennT`, `u.pos`, `u.eig`) und schreibt nichts in `wert()`.

---

## 1. Ausgangslage — was „Oval" heute überhaupt bedeutet, und was nicht

Es gibt im Repo **zwei völlig getrennte** Bahn-Visualisierungen, und Chris' Wunsch bezieht sich
klar auf die erste:

| | Live-Rennsimulation (`battle-mode.engine.js`, `bodenSpurt`/`zeichneSpurt`) | Saison-Fortschrittsgrafik (`track.tsx`, „PILOT") |
|---|---|---|
| Zweck | zeigt EIN Rennen Tick für Tick | zeigt den Punktestand-Trend einer Mannschaft über Spieltage, als Bewegung auf einer Kurve |
| Bahnform heute | **gerade Linie**, `bodenSpurt()` (`:15120 ff.`) zeichnet ein Rechteck von `H*0.14` bis `H*0.94`, die Kamera scrollt mit `camX()` (`:16058`) horizontal | **Oval** (`makeOval`/`ovalPath`, SVG-Ellipse), aber rein dekorativ — ein Team gleitet pro Spieltag ein Stück auf der Ellipse weiter, `Zielposition = displayScore/finalMax` |
| Was „Übergabe" bedeutet | ein Läufer wechselt bei `u.pos>=u.beinBis` — heute eine von SECHS Stellen entlang der Geraden | keine Übergabe-Semantik, reine Fortschrittsanimation |
| Bezug zur Wertung | 1:1 — jede Pixelposition kommt aus derselben `u.pos`, die auch `etappenZeit`/`wert()` speist | keiner — `finalMax`/`displayScore` sind Saison-Punktzahlen, nichts davon fließt zurück |

**Also: „ein größeres Oval" kann sich nur auf die Live-Simulation beziehen** — die
Saisongrafik ist bereits ein (kleines, dekoratives) Oval, aber ein anderes System für einen
anderen Bildschirm. „Größer" heißt vermutlich: ein Oval in der Größe des vollen
Renn-Canvas (in den Screenshots der letzten PRs 1240×470 px), nicht die kleine Ellipse der
Saisonkarte. Das Live-System ist heute **keine** Oval-Bahn — es ist eine gerade Sprintbahn mit
sechs unsichtbar aneinandergereihten Abschnitten. Genau das soll sich laut Auftrag ändern.

### 1.1 Was die Simulation heute wirklich rechnet (der Teil, der sich NICHT ändern soll)

Beim Aufstellen (`:16333 ff.`) bekommt jeder Läufer:

```js
L.bein=idx; L.beinVon=idx/n; L.beinBis=(idx+1)/n;
L.pos=L.beinVon; L.aktiv=(idx===0);
```

`n` ist die Kadergröße je Seite (2, 4, 5 oder 6 — der Saisonplan würfelt, nie 3, s.
`staffel-modellierung-recherche-05-09.md` Teil 3.8). `u.pos` läuft über das GANZE Rennen von 0
bis 1; ein einzelner Abschnitt ist nur 1/n dieses Bereichs.

Die eigentliche Physik interessiert das kaum, weil praktisch jede Rechnung nicht `u.pos`,
sondern die schon LOKALISIERTE Größe `laufAnteil(u)` liest:

```js
// engine.js:16436
const laufAnteil=(u)=>{
  if(!BA().staffel||u.beinVon==null)return u.pos;
  const laenge=(u.beinBis-u.beinVon)||1;
  return Math.max(0,Math.min(1,(u.pos-u.beinVon)/laenge));
};
```

`kurvenFaktor()`, die Ermüdung (`mued`) und der Angriffspunkt (`planT`) in `tempoVon()` lesen
alle `laufAnteil(u)`, nicht `u.pos` — das ist bereits „wie weit bin ich in MEINER Runde",
0 bis 1, exakt das, was eine Oval-Runde bräuchte. Der Kommentar an `:16410 ff.` erklärt, warum
das extra gebaut wurde: vorher lasen Ermüdung/Angriffspunkt die globale Rennposition, und der
Startläufer war dadurch nie ermüdet, der Schlussläufer immer — „ein Weltklasse-Schlussläufer sah
aus wie ein mittelmäßiger Startläufer". Der Fix von damals ist genau die Grundlage, die eine
Oval-Runde heute braucht.

**Der einzige Ort, der wirklich die GLOBALE 0..1-Skala braucht, ist die Übergabe- und
Zielerkennung selbst:**

```js
// engine.js:16946 — Uebergabe, nicht letzter Abschnitt
if(BA().staffel && u.beinBis<1 && u.pos>=u.beinBis){ … continue; }

// engine.js:17018 — Ziel, gemeinsamer Code fuer ALLE fuenf Bahnen
if(u.pos>=1){ u.pos=1; … }
```

Diese beiden Zeilen benutzen `u.beinBis<1` als impliziten Test „ist das der letzte Abschnitt?".
Das ist der Haken, der Abschnitt 2.2 unten begründet.

### 1.2 Kadergröße = Rundenzahl

Die Staffel hat `playerCount: 3` als Basis (`lib/data/dataAdapter.ts:63`), aber
`buildSeasonPlayerCount` verschiebt sie im echten Spielplan immer auf 2, 4, 5 oder 6 je Seite
(nie 3, `season-discipline-schedule.ts:64–75`). Jede Oval-Lösung muss deshalb **mit `n` Runden
rechnen, nicht mit sechs fest** — bei einer Zweier-Staffel sind das zwei Runden, bei einer Sechser
sechs. Der Code tut das an den meisten Stellen bereits dynamisch (`n=mine.length` beim
Aufstellen); die vorgeschlagene Zeichenfunktion unten übernimmt das 1:1.

---

## 2. Oval + „Übergabe immer an der Ziellinie" — cosmetic oder strukturell?

### 2.1 Was NICHT reicht: einfach eine Ellipse statt einer Geraden zeichnen

Würde man nur `camX(posFrac)` durch eine Ellipsen-Parametrisierung ersetzen und sonst nichts
anfassen, entstünde ein Oval, auf dem sich der Startläufer über 1/n der Ellipse bewegt, der
zweite Läufer über das NÄCHSTE 1/n-Stück usw. — sechs Läufer würden also sechs verschiedene
BÖGEN derselben Ellipse ablaufen, nicht sechs Mal denselben vollen Kreis. Die Übergabe läge
dann an sechs verschiedenen Punkten des Ovals, nicht an einer „Ziellinie". Das ist die
wörtliche 1:1-Übertragung der heutigen Geometrie auf eine gekrümmte Fläche — hübscher, aber
NICHT das, was Chris beschreibt.

### 2.2 Was buchstäblich, aber riskant wäre: jede Runde bekommt ihren eigenen 0..1-Bereich

Die naheliegende „richtige" Umsetzung: `beinVon=0, beinBis=1` für JEDEN Abschnitt, `u.pos`
startet bei jeder Übergabe wieder bei 0. Das hätte zwei konkrete Nebenwirkungen, die eine
Nachmessung erzwingen würden, keine reine Bildänderung:

- **Der Zielcheck feuert zu früh.** `u.beinBis<1` ist heute der einzige Test, der „letzter
  Abschnitt" von „Zwischenabschnitt" unterscheidet (`:16946`). Wenn JEDER Abschnitt `beinBis=1`
  führt, ist diese Bedingung für Abschnitte 1 bis n−1 plötzlich FALSCH, der Code fällt durch bis
  zur generischen Ziellinie aller fünf Bahnen (`:17018`) und markiert die Mannschaft nach der
  ERSTEN Runde als im Ziel. Der Fix wäre trivial (ein `u.bein===n-1`-Flag statt der
  `beinBis`-Krücke), aber es ist eine Änderung an geteiltem Code, der auch Time-Trial, Spurt und
  Climbing durchläuft — keine, die man ungetestet lässt.
- **Das Rennen würde ums Sechsfache länger.** `u.pos+=u.v*dt/strecke` (`:16597`) normiert die
  Geschwindigkeit auf die GANZE Renndistanz (`strecke=W-170`, konstant, unabhängig vom
  Abschnitt). Bislang deckt ein Abschnitt nur 1/n dieser Skala ab, braucht also nur 1/n der Zeit,
  die ein voller 0..1-Lauf bräuchte — genau das ergibt die heute gemessenen 11,6–14,8
  Sim-Sekunden für ein ganzes Rennen. Bekäme jeder Abschnitt seinen eigenen vollen 0..1-Bereich,
  bräuchte er dieselbe Zeit wie heute das GANZE Rennen — sechs Abschnitte würden das Sechsfache
  brauchen, ohne dass irgendjemand das so vorgeschlagen hätte.

Keiner der beiden Effekte berührt `wert()` unmittelbar (`etappenZeit` bleibt eine Zeitmessung,
keine Positionsmessung), aber beide sind genau die Art von Nebenwirkung, die CLAUDE.md verlangt
zu messen, bevor man sie behauptet — und beide sind vollständig vermeidbar (Abschnitt 2.3).

### 2.3 Empfehlung: die GLOBALE 0..1-Skala bleibt, nur die Zeichnung interpretiert sie neu

Der saubere Weg braucht **keine** Änderung an `u.pos`, `beinVon`, `beinBis`, dem Wechsel- oder
dem Zielcheck. Er fügt genau eine neue Funktion hinzu, die aus dem vorhandenen globalen
`posFrac` (0..1 über das ganze Rennen) einen Punkt auf einer Ellipse macht — und zwar so, dass
JEDES 1/n-Segment für sich auf einen VOLLEN Umlauf der Ellipse abgebildet wird:

```js
// Ersatz fuer camX() ausschliesslich fuer BA().staffel — Time-Trial/Spurt/Climbing
// bleiben bei camX(), unveraendert.
function ovalXY(posFrac, bahnZ){
  const n = STAFFEL_N();                       // Laeufer je Seite dieses Rennens
  const lokal = (posFrac*n) % 1;                // 0..1 = Fortschritt IN DIESER Runde —
                                                 // identisch zu laufAnteil(u), nur fuer
                                                 // Anzeige separat berechnet (Motor bleibt roh)
  const winkel = lokal*2*Math.PI - Math.PI/2;   // 0 = Ziellinie oben, im Uhrzeigersinn
  const rSpur = OVAL_RY + bahnZ*BAHN_ABSTAND;   // Bahn 0 innen, Bahn 1 aussen (bahnenFest:2)
  return { x: OVAL_CX + Math.cos(winkel)*OVAL_RX,
           y: OVAL_CY + Math.sin(winkel)*rSpur };
}
```

`lokal = (posFrac*n) % 1` ist rechnerisch **dieselbe Zahl** wie das vorhandene
`laufAnteil(u)` — beide sind `(u.pos-u.beinVon)/laenge` mit `laenge=1/n`, nur einmal aus dem
Renn-Fortschritt und einmal aus `u.pos` direkt hergeleitet; sie stimmen bit-genau überein, weil
`beinVon=idx/n`. Der Motor selbst (`stepSpurt`, `tempoVon`, `kurvenFaktor`, der Wechsel- und
der Zielcheck) bleibt **komplett unverändert** — nur `zeichneSpurt()` bekommt für `BA().staffel`
einen neuen Zweig, der `camX(u.pos)` durch `ovalXY(u.pos, u.bahnZ)` ersetzt. Damit:

- **Jede Runde ist ein voller Umlauf**, weil `lokal` bei jedem 1/n-Sprung wieder bei 0 beginnt
  und der Winkel damit wieder bei der Ziellinie startet.
- **Die Übergabe liegt immer an derselben Bildschirmstelle**, weil `u.pos` an jeder Übergabe
  exakt auf einem Vielfachen von 1/n steht (`u.beinBis`, s. `:16948`) — `lokal` ist dort exakt 0
  bzw. 1, also immer derselbe Winkel.
- **Wartende Läufer stehen automatisch an der Ziellinie, ohne eigenen Code:** ein wartender
  Läufer hat `u.pos===u.beinVon` (so gesetzt beim Aufstellen, `:16327`, und bei jeder Übergabe,
  `:16951`) — das ist exakt ein Vielfaches von 1/n, also `lokal=0`, also derselbe Punkt wie die
  Ziellinie, unabhängig davon, für welchen Abschnitt (2., 3., 4. …) er wartet. Das ist Chris'
  „die kommenden warten an der Ziellinie" wortwörtlich — für null zusätzliche Logik, es ist eine
  Konsequenz der Rechnung, keine gesonderte Fallunterscheidung.
- **`schnitt()` (die HP-Balken-Wiederverwendung für den „Streckenschnitt der Mannschaft",
  `:14641 ff.`) bleibt korrekt**, weil sie weiterhin die globale `u.pos` mittelt — mit der
  Oval-Lösung ändert sich diese Zahl nicht, nur ihre Zeichnung. (Der in 2.2 verworfene Weg hätte
  genau HIER eine zweite Reparatur gebraucht: sobald `u.pos` pro Runde zurückspringt, misst der
  Mittelwert nicht mehr den Team-Gesamtfortschritt.)

**Fazit Kernfrage:** Oval + „Runde" + „immer an der Ziellinie" ist mit dieser Lösung zu
**~95 % Optik** — eine neue Zeichenfunktion (~30–40 Zeilen, analog `camX`/`bahnY`), keine
Änderung an Wertung, Zeitrechnung oder am Wechselmodell. Die verbleibenden ~5 % sind
Bildschirmlayout: Bahn nimmt jetzt eine Fläche statt eines Streifens ein, also müssen HUD-Texte
über der Bahn (Wind-/Burgpunkte-Legende, Ansage-Blase) neu platziert werden — reine
Anordnung, keine Logik.

### 2.4 Größe und Lage des Ovals — konkreter Vorschlag

Canvas bleibt 1240×470 (wie in den Endstand-Screenshots). Vorschlag:

| Größe | Wert | Begründung |
|---|---:|---|
| Mittelpunkt | (620, 260) | zentriert, Platz für Kopfzeile/Legende oben (`oben=H*0.14` bleibt frei) |
| Große Halbachse (`OVAL_RX`) | 480 px | nutzt fast die volle Breite, Rand für die Baumreihe |
| Kleine Halbachse (`OVAL_RY`) | 140 px | Bahnbreite darunter (`BAHN_ABSTAND≈14`) für zwei feste Bahnen (`bahnenFest:2`) |
| Ziellinie | oben (Winkel −90°), mittig | liegt automatisch im Blickfeld der Kamera, dort wo heute die Kopfzeile mit Zeitstand sitzt |

Das ist deutlich größer als das kleine dekorative Oval der Saisongrafik (dort nur ein
Miniatur-Widget) — passt also zu „größeres Oval", falls Chris damit implizit den Kontrast zur
kleinen Season-Ellipse meinte.

---

## 3. „Nur aktuelle Läufer sichtbar, Wartende an der Ziellinie" — Rendering

Ergibt sich, wie in 2.3 gezeigt, GRATIS aus der Oval-Zeichnung: Wartende (`!u.aktiv`) liegen
automatisch am selben Punkt (der Ziellinie). Zwei kleine, rein kosmetische Ergänzungen machen
daraus ein sauberes Bild statt eines Stapels übereinanderliegender Sprites:

1. **Warteschlange auffächern:** an der Ziellinie stehen bis zu `n−1` Läufer je Seite (bei
   Kadergröße 6 also fünf Wartende). Ein kleiner senkrechter Versatz nach Beinnummer
   (`y_offset = (u.bein - aktiverBein - 1) * 14px`, geklemmt auf z. B. drei sichtbare Plätze plus
   „+2" bei mehr) reicht — dieselbe Idee wie die vorhandene Bahn-Auffächerung in `platz`
   (`:16113`: `camX(u.pos)+(platz>=0?12+platz*9:0)`).
2. **Wartende laufen nicht auf der Stelle.** `staffel-modellierung-recherche-05-09.md` Teil 4
   hat das bereits gefunden: Wartende werden mit `vx:4` gezeichnet (`:15363`,
   `vx:u.stolper>0?0:4`) statt `vx:0` — sie „joggen" sichtbar, obwohl sie stehen. Ein `idle`-Blatt
   existiert bereits (`k_idle`, `kw_idle`, `g_idle`); die Reparatur ist eine Bedingung
   (`!u.aktiv ? 0 : 4`), kein neues Asset. Das war schon vor diesem Auftrag ein Fund, gehört aber
   direkt in dieselbe PR, weil die Ziellinien-Gruppe sonst wie ein Lauftreff aussieht.
3. **Nur der aktive Läufer bewegt sich schnell/deutlich; die Wartenden sind klein/gedimmt** (z. B.
   `globalAlpha 0.85` oder ein Tick kleinere Sprite-Skalierung) — verstärkt „man sieht nur die
   Aktuellen", ohne die Wartenden unsichtbar zu machen (ihre Eignungszahlen fürs HUD, Abschnitt
   4, sollen ja sichtbar bleiben).
4. **Stab als Prop** (aus der 05-09-Recherche, noch nicht gebaut): ein 10×3-px-Rechteck in
   Teamfarbe an der Hand des aktiven Läufers, das beim Wechsel zum Nachfolger springt — 3 Zeilen
   Canvas, kein Download, macht auf einen Blick klar, wer gerade den Stab trägt.

Kein neues Sprite-Asset nötig (bestätigt aus der 05-09-Recherche, Abschnitt 4 dort).

---

## 4. Broadcast-HUD: Eignung aktuell/nächste + lebendes Zeit-Delta

Das ist die offene Design-Frage — konkreter Vorschlag statt Optionsliste.

### 4.1 Was ohne neue Mechanik direkt anzeigbar ist

`u.eig` ist eine beim Aufstellen fest berechnete Zahl (`:16305`), die sich während des Rennens
NIE ändert — perfekt für eine Anzeige, die während des Rennens live aktualisiert werden soll,
ohne dass sich der angezeigte Wert selbst bewegt. Aktiver und nächster Läufer je Seite sind mit
demselben Muster erreichbar, das der Wechsel-Code selbst schon benutzt (`:16947`):

```js
const aktiv    = s => LAEUFER.find(o=>o.seite===s && o.aktiv);
const naechste = s => { const a=aktiv(s); return a && LAEUFER.find(o=>o.seite===s && o.bein===a.bein+1); };
```

Ein HUD-Panel je Seite (zwei Boxen, wie eine echte Rennübertragung Bahn/Bahn nebeneinander
zeigt) mit vier Zeilen:

```
AKTUELL    Krolach        Eig 61
NÄCHSTE    Gram            Eig 54
```

Bei der letzten Runde ist „NÄCHSTE" leer — dann zeigt die Box stattdessen „Schlussläufer" oder
bleibt aus (kein Datenproblem, nur eine Textvariante).

### 4.2 Das Delta — die eigentliche Konstruktionsfrage

Chris will „das Delta was sie an Zeit aktuell raus geholt haben — dynamisch wie bei nem Rennen
üblich". Zwei Kandidaten, abgewogen:

**Kandidat A (verworfen): Rundendifferenz.** Nur an Übergaben aktualisieren
(„nach Runde 3: Team A führt um 0,4 s"), dazwischen eingefroren. Einfach zu bauen (eine
Subtraktion der beiden `etappenZeit`-Summen bei jeder abgeschlossenen Runde BEIDER Seiten), aber
das ist NICHT „dynamisch, wie bei einem Rennen üblich" — es steht sechsmal still und springt
fünfmal. Bei realen Übertragungen (Leichtathletik-Staffeln, Radsport) läuft die Uhr dazwischen
sichtbar weiter.

**Kandidat B (Empfehlung): Fortschritt-Zeit-Verlaufspuffer mit Interpolation — die Methode, mit
der echte Zeitfahren-/Etappenrennen-Übertragungen den Rückstand in Echtzeit einblenden.**

Idee: beide Seiten haben zu jedem Zeitpunkt einen GESAMT-Fortschritt (nicht Zeit, sondern
zurückgelegter Anteil der Gesamtstrecke) — das ist exakt das vorhandene `u.pos` des aktiven
Läufers (`0..1` über das ganze Rennen, unverändert von Abschnitt 2). Da beide Seiten an
derselben gemeinsamen Uhr (`rennT`) laufen, aber unterschiedlich schnell Fortschritt machen,
lässt sich für jede Seite ein Verlauf „bei welcher Rennzeit stand ich bei welchem
Fortschritt" aufzeichnen — und daraus live ablesen, wie viele Sekunden die zurückliegende Seite
bräuchte, um den Vorsprung der führenden Seite aufzuholen, wenn sie deren Fortschritts-Zeit-Kurve
nachliefe. Das ist dieselbe Rechnung wie der „Gap to leader"-Clock im Radsport oder die
Zwischenzeitvergleiche bei Schwimm-/Bahnstaffeln.

```js
// Zwei kleine Puffer, je Seite, waehrend der Staffel gefuellt (BA().staffel-gated,
// sonst ungenutzt). Push alle paar Ticks reicht (z.B. jeden 6. Frame, ~0,1 s Sim-Zeit
// bei 60fps) -- bei 12-15 Sim-Sekunden Renndauer maximal ~25-30 Eintraege je Seite,
// trivialer Speicher.
const fortschrittVerlauf = {0:[], 1:[]};   // {t: rennT, p: Gesamtfortschritt 0..1}

function gesamtfortschritt(seite){
  const a = LAEUFER.find(o=>o.seite===seite && o.aktiv);
  return a ? a.pos : (rennFertigSeiteFertig(seite) ? 1 : 0);
}

// jeden Tick (oder alle paar Ticks) in stepSpurt:
if(BA().staffel){
  for(const s of [0,1]){
    const p = gesamtfortschritt(s);
    const buf = fortschrittVerlauf[s];
    if(!buf.length || p > buf[buf.length-1].p) buf.push({t:rennT, p});
  }
}

// Live-Delta fuer die Anzeige, jeden Frame neu:
function zeitDelta(){
  const p0 = gesamtfortschritt(0), p1 = gesamtfortschritt(1);
  const [fuehrend, hinten, pF, pH] = p0>=p1 ? [0,1,p0,p1] : [1,0,p1,p0];
  const buf = fortschrittVerlauf[fuehrend];
  // Suche die Zeit, zu der die FUEHRENDE Seite beim Fortschritt der HINTEN liegenden war
  // (lineare Interpolation zwischen den beiden umschliessenden Punkten).
  let i = buf.findIndex(pt => pt.p >= pH);
  if(i <= 0) return {seite:fuehrend, delta:0};           // noch keine Vergleichsbasis
  const a = buf[i-1], b = buf[i];
  const frac = (pH - a.p) / ((b.p - a.p) || 1);
  const zeitFuehrendBeiPH = a.t + (b.t - a.t) * frac;
  return {seite:fuehrend, delta: rennT - zeitFuehrendBeiPH};   // Sim-Sekunden Rueckstand
}
```

Eigenschaften, die genau zu Chris' Formulierung passen:

- **Läuft dynamisch mit**, nicht nur an Übergaben — jeder Frame liefert eine aktuelle Zahl,
  weil `rennT` und `p0/p1` sich stetig bewegen.
- **Reduziert sich am Ziel exakt auf den Zieleinlauf-Abstand**, den das Endstand-Overlay aus
  PR #826/#827 schon zeigt (`bahnTeamstand()`, Kopfzeile „nach Zieleinlauf (12,2 s gegen 11,1
  s)") — beide Zahlen sind dieselbe Größe, einmal live geschätzt, einmal final exakt. Keine
  zwei Wahrheiten, nur zwei Zeitpunkte derselben Messung.
- **Kostet nichts an Motorzeit**, weil sowohl `rennT` als auch `u.pos` bereits Schritt für
  Schritt existieren — der Puffer ist eine reine Mitschrift, keine neue Simulation, keine neue
  Zufallsquelle, nichts, was `wert()` lesen könnte oder sollte.
- **Bei sehr frühem Rennstand (`i<=0`, beide Seiten noch im ersten Abschnitt, die führende Seite
  hat den Fortschritt der zurückliegenden noch nicht selbst durchlaufen) gibt es noch keine
  Vergleichsbasis** — dann zeigt das HUD „—" oder unterdrückt das Delta für die ersten
  Sekunden, genau wie reale Übertragungen erst nach der ersten Zwischenzeit einen Rückstand
  einblenden.

Der Preis gegenüber Kandidat A: ein kleiner Verlaufspuffer je Seite (zwei Arrays, Push-only,
bei ~15 Sim-Sekunden × 10 Samples/Sekunde ≈ 150 Einträge je Seite — trivial) und eine
Interpolationssuche pro Frame (linear über denselben kleinen Puffer, keine Optimierung nötig
bei dieser Größenordnung).

### 4.3 Layout-Vorschlag

Über der Bahn (in der Fläche, die heute die Burgpunkte-Legende für Takeshi nutzt,
`bodenSpurt():15206 ff.` — für Staffel bislang ungenutzt):

```
┌──────────────────────────── Armageddon Aftermath ────────────────────────────┐
│  AKTUELL   Krolach   Eig 61        ⏱ +0.6s          AKTUELL   Tidesprinter  Eig 58 │
│  NÄCHSTE   Gram       Eig 54                          NÄCHSTE   Draco        Eig 66 │
└──────────────────────────────────── Cold Steel ───────────────────────────────────┘
```

- Zwei symmetrische Boxen links/rechts der Mitte, Teamfarbe als Rahmen (dieselbe Farbcodierung
  wie die vorhandene `.scoreline`).
- Die Delta-Zahl in der Mitte, mit Vorzeichen und Seitenfarbe (`"+0.6s"` in der Farbe der
  FÜHRENDEN Seite — nicht „wer verliert wie viel", sondern „wer führt um wie viel", das ist die
  Konvention echter Übertragungen).
- Aktualisierung jeden Frame über `updateHudBahn()` (`:14600 ff.`), gated `if(BA().staffel)` —
  dieselbe Stelle, an der heute schon `stand`/`klsuffix`/`score` geschrieben werden, kein neuer
  Update-Pfad nötig.
- Reine DOM-Textknoten (wie `#score`/`#klsuffix`), keine neuen Canvas-Zeichenroutinen außer den
  zwei Eig-Zahlen, falls sie stattdessen ALS Sprite-Beischrift über den Köpfen der Läufer
  erscheinen sollen (Alternative: statt eines HTML-Panels die Eignungszahl direkt neben dem
  Kopf des aktiven/nächsten Läufers einblenden, wie heute schon Name und Plan über dem Kopf
  stehen, `zeichneSpurt()`) — beide Varianten sind mit denselben Daten machbar; die HTML-Panel-
  Variante ist die robustere erste Umsetzung, weil sie nicht mit der Sprite-Positionierung im
  Gedränge an der Ziellinie konkurriert.

---

## 5. Prüfung: bleibt `wert()`/rho unberührt?

| Änderung | berührt `etappenZeit`/`wechselKonto`? | berührt `u.pos`-Semantik? | Risiko für rho |
|---|---|---|---|
| Oval statt Gerade (Abschnitt 2.3, `ovalXY()`) | nein — reine Zeichenfunktion, liest `u.pos` nur lesend | nein — `u.pos` bleibt exakt die heutige globale 0..1-Größe | **keins** — kein Zeitpfad geändert |
| Warteschlangen-Auffächerung, idle-Fix, Stab-Prop (Abschnitt 3) | nein | nein | **keins** — reine Zeichnung |
| Broadcast-HUD, Eignung + Delta (Abschnitt 4) | nein — `zeitDelta()`/`fortschrittVerlauf` sind ein separater, nur lesender Beobachter | nein | **keins** |

Da keiner der drei Bausteine `stepSpurt`, `tempoVon`, `kurvenFaktor`, den Wechsel-Block oder
`MOTOREN.staffel.wert()` verändert, ist eine Nachmessung mit `miss-alle-disziplinen.mjs`
formal nicht nötig, um „rho unverändert" zu behaupten — sie ist trotzdem in Abschnitt 6, Schritt
1 als Abnahmekriterium vorgesehen, weil das Projekt grundsätzlich lieber misst als behauptet
(CLAUDE.md), und weil der Weg aus Abschnitt 2.2 zeigt, wie leicht eine scheinbar rein optische
Änderung an dieser Stelle doch etwas Rechnendes trifft. Erwartung: 0,915 / 0,089 / 0,951 / 0,093
bit-identisch zu `stand-aller-disziplinen.md` Zeile 71, bei allen vier gemessenen Kadergrößen
(2/4/5/6, Abschnitt 3.8 der 05-09-Recherche).

---

## 6. Die 3-Minuten-Vorgabe — bestehende Mechanik, ein Zahlendreher

### 6.1 Der Fund: es gibt schon einen geteilten Bahn-weiten Zeitdehnungs-Regler

Kein Branch/keine PR mit „Spurt-Tempo" existiert im Repo bisher (geprüft: `git branch -a`,
`git log --all`, GitHub-PR-Suche nach „spurt" — die jüngsten sind #792–#807, alle vor dem
06.09.-Auftrag; `claude/spurt-tempo-anpassung-06-09` existiert nicht). Es gibt aber bereits
GENAU die Mechanik, die eine solche PR bräuchte, und sie deckt schon alle fünf Bahn-Disziplinen
ab — `ZEIT_DEHNUNG`, `engine.js:17386 ff.`:

```js
const ZEIT_DEHNUNG={
  tdm:1.88, "mini-dm":2.86, fechten:1.62, battlefield:5.00,
  spurt:5.36, staffel:4.65, "time-trial":4.38, climbing:4.38, "takeshis-castle":2.17,
  basketball:2, hockey:2
};
const zeitFaktor=()=>ZEIT_DEHNUNG[disc]||1;
```

Das ist ein reiner **Anzeige-Zeitstreckfaktor**: `stepSim`/`stepSpurt` laufen intern immer mit
festem `dt=1/60`, unabhängig vom Faktor (`loop()`, `:17405 ff.`: `stepSim((1/60)/zf)` — der
Faktor verändert, WIE OFT dieser feste Tick pro echter Sekunde läuft, nicht seine Größe). Der
Kommentar über der Tabelle sagt es explizit: „eine reine dt-Streckung ändert an der INNEREN
Balance nichts, nur an der Erzählgeschwindigkeit" — das ist wortwörtlich dieselbe Garantie, die
Abschnitt 5 oben für Oval/HUD braucht, nur schon einmal für genau diesen Zweck geschrieben und
schon in Produktion.

Die Faktoren sind erkennbar so gewählt, dass **die gemessene Ist-Renndauer jeder Disziplin auf
ungefähr dieselbe Zuschauzeit gestreckt wird** — durchgerechnet mit der gemessenen Ist-Dauer der
Staffel (11,6–14,8 Sim-Sekunden, Median ≈ 13,2 s, aus `endstand-punkte-staffel-takeshi-plan-
06-09.md` Abschnitt 2.3):

    13,2 s (Ist) × 4,65 (Faktor) ≈ 61,4 s Zuschauzeit  ≈ 60 s

Spurt (11,2 s Ist × 5,36 ≈ 60 s), Time-Trial/Climbing (13,7 s × 4,38 ≈ 60 s) — alle drei landen
bei ungefähr **60 Sekunden**. Das ist die uniforme Zielgröße, die heute für die drei
zeitbasierten Bahnen gilt (Takeshi mit Stopps liegt bei ≈27,6 s Ist × 2,17 ≈ 60 s ebenfalls;
TDM/Mini-DM/Fechten/Battlefield/Basketball/Hockey folgen keiner festen Zielsekunde, sondern
eigenen Gründen, s. die Kommentare an derselben Stelle).

### 6.2 Empfehlung: EINE Zahl ändern, kein neuer Mechanismus

Chris will „3 Minuten oder so" — 180 Sekunden statt der impliziten 60. Da der Rechenweg linear
ist, reicht eine einzige Konstante:

    ZEIT_DEHNUNG.staffel = 180 / 13,2 ≈ 13,6   (statt 4,65)

Exakter Wert sollte auf der tatsächlich gemessenen Ist-Dauer NACH Umsetzung von Abschnitt 2–4
beruhen (die ändert an der Ist-Dauer nichts, s. Abschnitt 5, aber „nachmessen statt schätzen"
ist die Regel des Projekts) — mit derselben Sonde wie in
`endstand-punkte-staffel-takeshi-plan-06-09.md` Anhang A (`bahnLauf("staffel")`, 24 Saaten,
Median/Spannweite der Renndauer ablesen, `180` durch den Median teilen).

**Warum das reicht und nichts an rho ändert:** dieselbe Garantie wie in Abschnitt 5 — der
Zeitdehnungsfaktor sitzt NACH `stepSpurt`, nicht davor; er ändert real vergangene Sekunden auf
dem Zuschauerbildschirm, nicht die interne Physik, aus der `etappenZeit` und `wert()` entstehen.
Die Uhr-Anzeige selbst liest bereits `rennT*zeitFaktor()` (`updateHudBahn():14604`) — auch das
ist heute schon so gebaut, nur mit dem falschen Zielwert für die Staffel.

**Falls die separate Spurt-Pacing-Arbeit später eine allgemeinere Lösung baut** (z. B. eine
gemeinsame `ZIEL_SEKUNDEN`-Konstante statt neun einzeln von Hand gepflegter Zahlen, sodass
`ZEIT_DEHNUNG[disc] = ZIEL_SEKUNDEN/gemesseneIstDauer[disc]` gerechnet statt hartkodiert wird),
sollte die Staffel denselben Mechanismus mitziehen, statt ihre eigene Zahl parallel zu pflegen —
das ist aber eine Empfehlung an die Struktur, keine Voraussetzung: eine einzelne geänderte
Konstante reicht für diesen Auftrag vollständig aus, unabhängig davon, ob/wann die
Spurt-Pacing-Arbeit landet.

---

## 7. Aufwand und Priorisierung

| # | Baustein | Art | Umfang | Berührt `wert()`? | Abnahme |
|---|---|---|---|---|---|
| 1 | `ovalXY()` + Kamera-Umschaltung für `BA().staffel` (Abschnitt 2.3–2.4) | **kosmetisch** | ~40 Zeilen, eine neue Funktion, ein Zweig in `zeichneSpurt()` | nein | Sichtprüfung; `miss-alle-disziplinen.mjs 24 staffel` bit-identisch zu 0,915 (Abschnitt 5) |
| 2 | Wartende: `idle` statt `vx:4`, Auffächerung an der Ziellinie, Stab-Prop (Abschnitt 3) | **kosmetisch** | ~20–30 Zeilen Canvas | nein | Sichtprüfung |
| 3 | Broadcast-HUD: Eignung aktuell/nächste (Abschnitt 4.1) | **kosmetisch, neue Anzeige-Lesestellen** | ~15 Zeilen (zwei Lookups + DOM-Text) | nein | Sichtprüfung, Werte gegen `LAEUFER` gegengelesen |
| 4 | Broadcast-HUD: Zeit-Delta mit Verlaufspuffer (Abschnitt 4.2) | **neue, aber rein beobachtende Mechanik** | ~30 Zeilen (Puffer + Interpolation) | nein (nur lesend) | Sichtprüfung über ein ganzes Rennen: Delta bewegt sich stetig, springt nicht an Übergaben, konvergiert am Ziel exakt zum Zieleinlauf-Abstand aus `bahnTeamstand()` |
| 5 | `ZEIT_DEHNUNG.staffel` auf ≈13,6 (Abschnitt 6) | **eine Konstante** | 1 Zeile | nein | Uhr zeigt ≈3:00 bei Renn­ende; `miss-alle-disziplinen.mjs 24 staffel` weiterhin 0,915 (Kontrollmessung, s. Abschnitt 5) |

Reihenfolge-Empfehlung: 1–2 zuerst (die Oval-Bahn ist die sichtbare Grundlage, auf der 3–4 erst
Sinn ergeben), dann 5 (eine Zeile, jederzeit nachziehbar, unabhängig von 1–4), dann 3–4 zusammen
(das HUD braucht die neue Bahnform nicht zwingend, wirkt aber erst im Oval wie eine
„Übertragung" statt wie ein aufgesetztes Panel auf einer geraden Bahn).

Gesamtaufwand: **gering bis mittel**, keine Motoränderung, kein neues Asset, keine
Wertungsänderung — der ganze Auftrag ist eine Zeichen- und Anzeigeerweiterung auf einem bereits
korrekt rechnenden Modell.

---

## 8. Offene Fragen an Chris — mit Voreinstellung

1. **Zielsekunde 180 exakt, oder „ungefähr 3 Minuten" mit Toleranz?** Voreinstellung: 180 s als
   Zielwert für die Konstante, keine zusätzliche Rundenlogik — die tatsächliche Zuschauzeit
   schwankt ohnehin mit der Ist-Dauer (11,6–14,8 s Spannweite), landet also real zwischen etwa
   2:40 und 3:25.
2. **HTML-Panel oder Sprite-Beischrift fürs Eignungs-HUD** (Abschnitt 4.3)? Voreinstellung:
   HTML-Panel, weil es nicht mit der Ziellinien-Warteschlange um denselben Bildraum konkurriert.
3. **Delta in Sekunden oder in einer anderen Einheit** (z. B. „Meter Vorsprung", wie manche
   TV-Grafiken es zusätzlich zeigen)? Voreinstellung: nur Sekunden — Meter bräuchten eine
   erfundene Streckenlänge, die die Disziplin nirgends führt, und wären eine zweite, unbelegte
   Zahl neben der echten Zeitmessung.
4. **Sollen Rundennummer/Bein-Badges („Bein 3 von 6") permanent im Bild stehen**, oder reicht die
   Ziellinien-Warteschlange selbst als Reihenfolge-Information? Voreinstellung: ein kleines
   Badge (aus der 05-09-Recherche bereits als „eine sinnvolle Ergänzung" vorgeschlagen, nie
   gebaut) — billig und macht die Rundenzahl bei kleineren Kadern (2er-Staffel: nur 2 Runden)
   sofort lesbar.

---

## 9. Was diese Runde nicht geprüft hat

- Kein Prototyp-Diff wurde gebaut oder gemessen — der Auftrag ist ausdrücklich Recherche; die
  Analyse in Abschnitt 2.2/2.3 beruht auf Code-Lesen (`u.pos`/`beinVon`/`beinBis`-Fluss, die
  beiden `continue`/Zielcheck-Stellen), nicht auf einer Testmessung. Vor der Umsetzung sollte
  Schritt 1 aus Abschnitt 7 trotzdem mit `miss-alle-disziplinen.mjs 24 staffel` UND den
  Kadergrößen 2/4/5/6 gegengelesen werden, wie in Abschnitt 5 begründet.
- Die konkrete Canvas-Bild-Anmutung (Bahnfarbe, Zaun/Tribünen-Perspektive auf einem Oval statt
  einer Geraden) ist nicht durchgezeichnet — nur die Koordinatenmathematik (`ovalXY`) und die
  Flächenmaße (Abschnitt 2.4).
- Ob die Zwei-Bahnen-Regel (`bahnenFest:2`) für ein Oval unverändert Sinn ergibt (auf einer
  echten Rundbahn laufen Staffeln oft in mehr als zwei Spuren) wurde nicht hinterfragt — Chris'
  Auftrag nennt nur die Form (Oval) und den Übergabepunkt, nicht die Bahnzahl; dieser Punkt bleibt
  unangetastet.
- Die Sprite-Zeichenreihenfolge bei überlappenden Wartenden an der Ziellinie (z-Index bei fünf
  gestapelten Läufern) ist nicht ausgearbeitet — die Auffächerung in Abschnitt 3.1 ist ein
  Vorschlag, keine Pixel-Spezifikation.

## Quellen im Repo

`public/mockups/battle-mode.engine.js` (`bodenSpurt` `:15120 ff.`, `camX`/Kamera `:16036 ff.`,
`laufAnteil`/`kurvenFaktor` `:16408 ff.`, Aufstellen `:16296 ff.`, Wechsel-/Zielblock
`:16946–17035`, `ZEIT_DEHNUNG`/`loop()` `:17386 ff.`, `zeichneSpurt` `:16962 ff.`,
`updateHudBahn` `:14600 ff.`, `BAHN_ART.staffel` `:15636 ff.`);
`app/foundation/discipline-stage/arena/disciplines/track.tsx` (Saison-Oval, PILOT);
`lib/season/season-discipline-schedule.ts`, `lib/data/dataAdapter.ts` (Kadergröße);
`docs/design/staffel-modellierung-recherche-05-09.md` (K1–K6, Kadergrößen-Nachtrag 3.8, Assets
Abschnitt 4); `docs/design/endstand-punkte-staffel-takeshi-plan-06-09.md` (Etappenwertung,
Zieleinlauf-Kopfzeile, gemessene Rennzeiten 2.3); `docs/design/stand-aller-disziplinen.md`
(Zeile 71, aktueller rho-Stand); `CLAUDE.md` (Abnahme je Spiel, kaderfeste Messung).
