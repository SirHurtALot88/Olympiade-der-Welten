# A0.2 — Deterministischer Sonden-Modus für Screenshots (19.09.)

Umsetzung von `docs/pm-briefings/opus-synthese-echtzeit-vs-rundenbasiert-19-09.md` Abschnitt
5.0, Punkt A0.2. Reine Präsentationsschicht: `wert()`, `rr()`, jede Ergebnis-/Rang-Logik und
die im Spiel tatsächlich verwendete Zeitkopplung (`loop()`, `acc+=dt*speed`, `ZEIT_DEHNUNG`)
bleiben byte-identisch — nachgewiesen durch `node scripts/miss-alle-disziplinen.mjs 24`
(alle 20 Disziplinen, Baseline-Diff 0 Zeilen, s. Verifikation unten).

## 1. Das Problem, nachgemessen

Zwei Playwright-Screenshot-Läufe DESSELBEN unveränderten Codes unterscheiden sich, weil die
Präsentationsschicht an mehreren Stellen echte Wanduhr-Zeit statt Simulationszeit liest.
Vollständige Bestandsaufnahme (vor dieser Änderung):

**Die Haupt-Loop koppelt an echte Zeit:**

```js
function loop(ts){
  if(!last)last=ts;
  let dt=Math.min(.05,(ts-last)/1000);last=ts;   // dt aus performance.now()-Differenz (ts kommt aus requestAnimationFrame)
  if(running){
    acc+=dt*speed;
    const zf=zeitFaktor();
    while(acc>=1/60){stepSim((1/60)/zf);acc-=1/60;}   // wie viele Ticks bis zur Wartezeit laufen, streut
    floats.forEach(f=>{f.y-=42/60;f.life-=1.1/60;});   // Schwebetexte je BILD, nicht je TICK
    ...
  }
  draw();
  requestAnimationFrame(loop);
}
```

Ein bestehendes QA-Skript (`scripts/screenshot-disziplin.mjs`) startet den Kampf und wartet
eine feste Wanduhr-Zeit (`waitForTimeout`), bevor es screenshottet — wie viele Sechzigstel-
Ticks bis dahin liefen, hängt von Bildwiederholrate und Prozesslast ab und streut um ±1–2
Ticks (s. Kommentar bei `ZEIT_DEHNUNG` im Motor, an der Staffel-Hochrechnung nachgemessen).

**Drei Stellen lesen `performance.now()`/`Date.now()` direkt** (vollständige Liste, per
`grep -n "performance\.now()\|Date\.now()"` verifiziert):

| Ort | Zeile (vorher) | Zweck | Im Canvas-Screenshot sichtbar? |
|---|---|---|---|
| `starteViertelpause()` | `vpSichtbarBis=performance.now()+...` | Setzt den Wanduhr-Zeitstempel, bis wann das Viertelpause-Overlay sichtbar bleibt | Nein — eigenes DOM-Overlay (`#viertelpause`), nicht Teil des Canvas |
| `updateHudFeldspiel()` | `const restMs=vpSichtbarBis-performance.now();` | Liest denselben Zeitstempel für die Restsekunden-Anzeige | Nein — DOM-Text |
| `sfx()` (Takeshi's-Castle-Drossel) | `const jetzt=(...performance.now():Date.now())/1000;` | Drosselt Ein-Schuss-Töne auf min. 0,12 s Abstand | Nein — reiner Audio-Seiteneffekt |
| `zeichneBoden()`/`bodenArena()` | `Math.floor(performance.now()/110)%9` | Wählt das Bild der Fackel-Animation (9 Bilder) | **Ja** — einzige der vier Stellen, die tatsächlich Canvas-Pixel verändert |

Zusätzlich: **Schwebetexte laufen je gezeichnetem Frame statt je Simulationstick**
(`floats.forEach(...)` steht in `loop()` außerhalb der `while(acc>=1/60)`-Schleife) — ihre
Position/Lebensdauer hängt von der Bildwiederholrate ab, nicht von der Tick-Zahl.

**Kamera-Interpolation (`kameraUpdate(dt)`, Bahn-Einzelkamera) war bereits unauffällig**: sie
bekommt `dt` aus `stepSim()`s festem Sub-Tick übergeben, nicht direkt aus der Wanduhr — ihr
Zustand hängt nur von der ANZAHL ausgeführter Ticks ab, nicht von der dafür gebrauchten realen
Zeit. Kein Fund hier, nur zur Vollständigkeit der Abschnitt-1-Bestandsaufnahme.

## 2. Der Fix: `sondenAktiv`/`jetztMs()` plus `window.__arena.sondenLauf(ticks)`

Additiv, in `public/mockups/battle-mode.engine.js`. Kein bestehender Codepfad wird entfernt
oder umgebaut — `loop()`, `ZEIT_DEHNUNG`, `stepSim()` bleiben wortgleich.

**Die Uhr-Umschaltung** (direkt bei der `U`/`running`/`t`-Deklaration):

```js
let sondenAktiv=false, sondenSimMs=0;
function jetztMs(){ return sondenAktiv?sondenSimMs:(typeof performance!=="undefined"?performance.now():Date.now()); }
```

Außerhalb eines Sonden-Laufs liefert `jetztMs()` exakt `performance.now()` — byte-identisches
Verhalten im echten Spiel. Alle vier Fundstellen wurden auf `jetztMs()` umgestellt (eine
Zeile pro Stelle, sonst unverändert):

- `vpSichtbarBis=jetztMs()+(...)`
- `const restMs=vpSichtbarBis-jetztMs();`
- `const jetzt=jetztMs()/1000;` (sfx-Drossel)
- `Math.floor(jetztMs()/110)%9` (Fackel-Frame)

**Schwebetexte** wurden in eine eigene Funktion `stepFloats()` ausgelagert (dieselbe Formel,
nur benannt), damit `loop()` sie weiterhin genau einmal je Frame aufruft (unverändert — das
ist bewusster Broadcast-Feel, keine Messgröße) und der Sonden-Modus sie stattdessen einmal
je TICK aufrufen kann.

**Der Sonden-Lauf selbst**, additiv an `window.__arena` gehängt:

```js
sondenLauf:(ticks)=>{
  const n=Math.max(0,Math.floor(Number(ticks)||0));
  sondenAktiv=true;
  const zf=zeitFaktor();
  for(let i=0;i<n;i++){
    sondenSimMs+=1000/60;
    stepSim((1/60)/zf);      // dieselbe Funktion, derselbe Tick, den auch loop() aufruft
    stepFloats();             // je TICK statt je Frame
    if(istFeldspiel(disc))updateHudFeldspiel();
    else if(istBuehne(disc))updateHudBuehne();
    else if(istBahn(disc))updateHudBahn();
  }
  draw();                      // GENAU EINMAL
  return {disc, ticks:n, zeitFaktor:zf, simMs:+sondenSimMs.toFixed(1)};
},
sondenAus:()=>{ sondenAktiv=false; },
```

`reset()` (aufgerufen von jedem `setDisc()`) setzt `sondenSimMs=0` an derselben Stelle, an
der es bereits `acc=0;last=0;` zurücksetzt — ein neuer Kampf beginnt die Sonden-Uhr immer bei
0, unabhängig davon, wie oft vorher schon sondiert wurde.

**Warum `sondenAktiv` nach dem Lauf absichtlich gesetzt bleibt** (kein `sondenAus()` im
`finally`): der Motor treibt unabhängig von `running` bei JEDEM `requestAnimationFrame` ein
`draw()` (`loop()` ruft `draw()` außerhalb des `if(running)`-Zweigs). Fällt zwischen dem
`sondenLauf()`-Aufruf und dem tatsächlichen Screenshot noch ein solcher Frame — Playwright
wartet auf das Screenshot-Versprechen, dazwischen kann der Browser einen weiteren rAF-Tick
einschieben —, würde er sonst mit echter `performance.now()` erneut zeichnen und den
Fackel-/Overlay-Stand wieder verwürfeln. `sondenAus()` kehrt zur echten Wanduhr zurück, falls
eine Seite danach interaktiv weiterlaufen soll.

## 3. Benutzung (Playwright, ohne UI-Klick)

```js
await page.evaluate((d) => window.__arena.setDisc(d), "tdm");   // baut frisch auf, Sonden-Uhr auf 0
await page.click("#t2");                                          // Arena-Reiter, macht die Leinwand sichtbar
// … Sprites laden lassen (siehe Abschnitt 5, SETTLE_MS) …
const info = await page.evaluate((n) => window.__arena.sondenLauf(n), 90); // 90 Ticks = 1,5 s Simulationszeit
const png = await (await page.$("#cv")).screenshot();
```

Mehrere `sondenLauf(k)`-Aufrufe hintereinander OHNE dazwischenliegendes `setDisc()`/`reset()`
summieren sich (die Sonden-Uhr läuft einfach durch) — praktisch für eine Serie von
Zwischenständen desselben Kampfs.

## 4. Vorher/Nachher-Beleg

Werkzeug: `scripts/pruefe-sonden-modus-determinismus.mjs`. Serviert `public/` über einen
kurzlebigen lokalen HTTP-Server (nicht `file://` — die Sprite-Pfade im Motor sind absolut,
`/sprites/arena/...`, und zeigten über `file://` auf die Dateisystemwurzel, wo sie nie
existieren; über HTTP lädt jedes Sprite wie im echten Betrieb).

**Rohwert-Beleg für den Wurzelfehler** (unabhängig von Rendering-Zufälligkeiten): dieselbe
Formel wie die Fackel-Animation, direkt ausgewertet, einmal sofort und einmal nach 650 ms
echtem Zeitversatz:

```
ROHWERT Fackel-Frame (Math.floor(performance.now()/110)%9): 8 -> 5 (nach 650ms echtem
Zeitversatz) -> unterschiedlich (Wurzelfehler bestätigt)
```

Mathematisch garantiert unterschiedlich für jeden Startzeitpunkt: 650 ms entsprechen 5–6
Fackel-Frames (110 ms je Bild), und weder 5 noch 6 ist ein Vielfaches von 9 — der Rohwert MUSS
sich unterscheiden, unabhängig von der zufälligen Startphase.

**Screenshot-Beleg, TDM (Arena-Chassis, einzige mit canvas-sichtbarer Wanduhr-Dekoration):**

| | 0 ms Versatz vs. 650 ms Versatz |
|---|---|
| VORHER (kein Sonden-Lauf, nur `setDisc` + warten) | **unterschiedlich** — 442 von 584 982 Pixeln, maxDelta 19 |
| NACHHER (`sondenLauf(90)`) | **identisch** — 0 von 584 982 Pixeln |

PNGs in `tmp-ux-audit/sonden-determinismus/tdm-{vorher,nachher}-{0,650}ms.png`.

**Sechs Disziplinen, alle vier Chassis**, `sondenLauf(90)` mit 0 ms vs. 650 ms Versatz davor:

| Disziplin | Chassis | Ergebnis |
|---|---|---|
| tdm | Arena | identisch (0 Px Diff) |
| mini-dm | Arena | praktisch identisch (s. Toleranz unten) |
| battlefield | Arena | praktisch identisch |
| basketball | Feldspiel | praktisch identisch |
| gewichtheben | Bühne | praktisch identisch |
| staffel | Bahn | identisch (0 Px Diff) |

Reproduzierbar über mehrere unabhängige Läufe (zweimal hintereinander ausgeführt, beide Male
alle sechs Fälle bestanden).

## 5. Bekannte Grenze: Chromium-eigenes Gradient-Dithering

Der Pixelvergleich ist bewusst **nicht** auf rohe PNG-Byte-Gleichheit gemünzt, sondern auf
eine kleine Toleranz (`PIXEL_MAX_DELTA=40` von maximal möglichen 1020, `PIXEL_MAX_ANTEIL=2%`
der Fläche). Grund, an Chromium selbst gemessen, nicht vermutet: manche Läufe zeigen einige
Dutzend bis wenige Tausend Pixel mit einer Abweichung von 1–2 Farbstufen in Gradient-/
Kopfzeilenflächen (z. B. Basketball-Kopfzeile, Arena-Bodenverlauf). Nachgewiesen, dass das
**nicht** an `sondenSimMs`/Tick-Zahl hängt:

- Beide verglichenen Läufe melden identische `sondenLauf()`-Rückgabewerte (`ticks`, `zeitFaktor`,
  `simMs`) — die SIMULATION ist bit-identisch.
- Zwei völlig frische Seiten mit **demselben** Zeitversatz (0 vs. 0) zeigen bei ausreichender
  Asset-Settle-Zeit `diffCount:0` — das Rauschen korreliert nicht mit dem hier geprüften
  Zeitversatz, es tritt unabhängig davon gelegentlich auf.
- Ein Sichtvergleich der betroffenen Bildausschnitte zeigt für das menschliche Auge
  ununterscheidbare Bilder (1-Stufen-Unterschiede in dunklen Verlaufsflächen).

Das ist eine Eigenschaft von Chromiums Compositor (Gradient-Dithering zur Bänderungs-
vermeidung), unabhängig vom Motor-Code, und durch keine Änderung an
`battle-mode.engine.js` behebbar. Eine ECHTE Regression (verschobenes Sprite, falscher
Frame, fehlendes Element) zeigt sich als große, zusammenhängende Fläche mit Delta nahe 255 —
davon ist die beobachtete Abweichung klar unterscheidbar (Faktor > 25 in der Größenordnung).

## 6. Verifikation

- `node --check public/mockups/battle-mode.engine.js` — grün.
- `npx tsc --noEmit`, Diff gegen `origin/main`-Baseline: **0 Zeilen**.
- `npx tsx scripts/pruefe-slot-invariante.ts` — maximale Abweichung 0,005 Pp (Schranke 0,2 Pp).
- `node scripts/miss-alle-disziplinen.mjs 24` (alle 20 Disziplinen): Ausgabe **byte-identisch**
  gegen eine Baseline-Messung desselben Kaders mit dem unveränderten `HEAD`-Stand der Datei
  (Diff 0 Zeilen) — dieser Task ändert ausschließlich Präsentations-/Zeitkopplungscode für
  einen neuen, standardmäßig inaktiven (`sondenAktiv=false`) Pfad; kein gemessener Aufruf
  (`disziplinMessen`/`MOTOREN[...].lauf()`) durchläuft `loop()`, `jetztMs()` oder
  `sondenLauf()`.
- `npm run ci:rangtreue-schranke` — grün (identische Begründung wie oben).
- `npx vitest run tests/arena-headless-runner.test.ts tests/mini-dm-ffa-pod-headless-runner.test.ts tests/spiele-bahn-invarianten.test.ts tests/battle-mode-arena-resolve-engine.test.ts` — grün.
- `node scripts/pruefe-sonden-modus-determinismus.mjs` — sechs Disziplinen über alle vier
  Chassis, zweimal unabhängig ausgeführt, beide Male vollständig bestanden.

## 7. Geänderte/neue Dateien

- `public/mockups/battle-mode.engine.js` — `sondenAktiv`/`sondenSimMs`/`jetztMs()`,
  `stepFloats()`-Auslagerung, `reset()`-Nullstellung, `window.__arena.sondenLauf`/`sondenAus`.
  Alle Änderungen additiv oder eine 1:1-Ersetzung von `performance.now()` durch `jetztMs()`.
- `scripts/pruefe-sonden-modus-determinismus.mjs` — neu, Vorher/Nachher-Beleg (s. oben).
