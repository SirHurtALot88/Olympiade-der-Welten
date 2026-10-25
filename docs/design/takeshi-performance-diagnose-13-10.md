# Takeshi's Castle: Performance-Diagnose (Task #9, 13.10.)

## Kurzfassung

Chris' Meldung ohne weitere Angabe: „Performance von Takeshi läuft nicht so gut."
Abzugleichen mit dem bekannten Breaking-„sondenLauf()"-Performance-Cliff (Task #36,
`docs/design/breaking-performance-einbruch-befund-01-10.md`).

**Takeshi teilt den Breaking-Fehler NICHT.** Mit genau derselben Methodik wie dort (Abschnitt
1.1: ein einziger `sondenLauf()`-Burst in EINEM `page.evaluate()`; Abschnitt 1.2: viele kleine
Playwright-Rundreisen, eine je Chunk) zeigt Takeshi weder im synchronen Burst noch im
Rundreisen-Modus eine Eskalation. Breaking zeigte im selben Rundreisen-Test (nachgestellt,
25-Tick-Chunks) einen Anstieg von 3,0 auf 120,2 ms/Tick binnen 325 Ticks — Takeshi blieb im
identischen Testaufbau durchgehend zwischen 1,2 und 7,7 ms/Tick, ohne Trend nach oben.

**Takeshi hat eine eigene, andere, viel kleinere Ursache:** sein Zeichenpfad
(`bodenTakeshiRoute()`, `public/mockups/battle-mode.engine.js:36309`) berechnete bei JEDEM
`draw()`-Aufruf — also bei jedem gezeichneten Frame, nicht nur bei jedem Simulations-Tick —
die Waldplatzierung (130 Kandidatenpunkte, je bis zu zwei Abstandsmessungen `nahe()` über die
gesamte Routen-Stützpunkttabelle) komplett neu, obwohl das Ergebnis zwischen zwei Frames nie
wechselt. CPU-Profil (Abschnitt 3) weist `nahe()` als teuersten Einzelposten im Takeshi-Draw
aus. Die Routen-Tabelle selbst (`routeTabelle()`) wird dagegen schon lange gecacht — der
Wald darüber nicht. Behoben (Abschnitt 5): derselbe Cache-Mechanismus wie für `routeCache`,
mit identischem Ergebnis (pixelidentisch, rho bit-identisch).

## 1. Fundstelle: Takeshi hat keine eigene `bau*`-Funktion

Anders als in CLAUDE.md für die anderen vier Chassis beschrieben (`bauFeldspiel`,
`bauBuehne`, `bauSpurt`, `baueEinheit`) hat Takeshi's Castle **keine eigene Bau-/Rezept-
Funktion**. Die Disziplin läuft über dasselbe Bahn-Chassis wie Spurt, Zeitfahren, Climbing
und Staffel: `stepSpurt()` (`battle-mode.engine.js:40540`, Zeile je nach Patch-Stand leicht
verschoben) mit einem Takeshi-exklusiven Zweig (`nervenKosten`, `u.raus`) für Ausscheiden
durch Nervenverlust. Eigenständig ist nur:

- die **Rendering-Funktion** `bodenTakeshiRoute()` (Zeile 36309) — eine gewundene Route durch
  Gelände statt der geraden Bahn der anderen Bahn-Disziplinen,
- die **Wertungstabelle** (Zeile 38664, drei Zusatzspalten „Nerv"/„Ausw"/„Gedr"),
- 14 Fallen/Hindernisse statt 4–7 bei den übrigen Bahn-Disziplinen.

Für die Eignungsmatrix/Pp-Frage (gesperrt, s. CLAUDE.md) ist das NICHT Teil dieses Auftrags
und wird hier nicht angerührt — der Eintrag in der Feedback-Liste (Punkt 30/Abschnitt
„Formkarten-Kopplung") bestätigt Takeshi bereits als funktionierende Referenz
(`f=eigW/m`-Rescaling, 0,896 mit der richtigen Kopplungsart).

## 2. Messung: Reproduktion nach Breaking-Methodik

Sonde: `window.__arena.setDisc("takeshis-castle")`, danach EIN `page.evaluate()` mit interner
Schleife `sondenLauf(25)`, `performance.now()` innerhalb der Seite — exakt Abschnitt 1.1 des
Breaking-Befunds.

| Disziplin | ms/Tick erstes Zehntel | ms/Tick letztes Zehntel | Faktor |
|---|---:|---:|---:|
| takeshis-castle | 2,926 | 0,911 | 0,31 (schneller, nicht langsamer) |
| climbing | 0,971 | 1,018 | 1,05 |
| time-trial | 0,660 | 0,839 | 1,27 |
| spurt | 0,782 | 0,723 | 0,92 |

Kein Einbruch, keine Eskalation — Takeshi wird über die Zeit sogar günstiger (JIT-Warmlauf),
wie bei Breaking in Abschnitt 1.1 beobachtet.

**Rundreisen-Modus** (Abschnitt 1.2 nachgestellt, eine `evaluate()`-Rundreise je 25-Tick-
Chunk, Node-seitig gemessen, bis Tick 400):

| TickEnde | takeshis-castle (ms/Tick) | breaking (ms/Tick, zum Vergleich) |
|---:|---:|---:|
| 100 | 3,28 | 10,04 |
| 125 | 2,88 | 28,16 |
| 300 | 2,04 | 18,24 |
| 325 | 1,60 | **120,16** |
| 350 | 1,52 | 108,00 |
| 400 | 2,00 | 79,04 |

Breaking reproduziert hier erwartungsgemäß seinen bekannten Einbruch (Faktor ~40 im
gemeldeten Fenster). Takeshi bleibt im selben Testlauf, derselben Maschine, demselben
Rechner-Zustand durchgehend unter 8 ms/Tick, ohne Trend. **Der generische
requestAnimationFrame-Rückkopplungsmechanismus aus dem Breaking-Befund (Abschnitt 2 dort)
braucht eine hohe WebAudio-/Timer-Ereignisdichte, um sich selbst zu verstärken — Takeshi hat
diese Dichte nicht**, anders als Breakings Gauntlet (~600 `sfx()`-Aufrufe je Spiel).

## 3. Die tatsächliche Ursache: ungecachte Waldplatzierung je Frame

Takeshi ist trotzdem **konsistent teurer pro Frame** als die anderen Bahn-Disziplinen —
nicht eskalierend, aber durchgehend höher. Isolierter Frame-Kosten-Test (`sondenLauf(1)`
wiederholt, dominiert von `draw()` statt `stepSim()`, da `stepSim()` nachweislich billig ist,
s. CPU-Profil):

| Disziplin | ms/Frame (vor dem Fix) |
|---|---:|
| takeshis-castle | 3,65 (Median aus 3 Läufen: 3,82 / 3,32 / 3,81) |
| climbing | 1,91 |
| time-trial | 1,97 |
| spurt | 1,83 |

Takeshi ist durchgehend **rund doppelt so teuer je Frame** wie die übrigen Bahn-Disziplinen.
CPU-Profil (CDP `Profiler`, 500 Frames über `sondenLauf(1)`, Selbstzeit ohne Idle/GC, nur
Takeshi):

```
 309,7 ms  nahe                 @ battle-mode.engine.js:36414   (vorher)
 190,3 ms  renderWertungTabelle @ battle-mode.engine.js:34030   (gemeinsamer Bahn-Code)
 156,0 ms  zeichneSpurt         @ battle-mode.engine.js:42408   (gemeinsamer Bahn-Code)
 105,3 ms  bodenTakeshiRoute    @ battle-mode.engine.js:36309   (Selbstzeit, vorher)
  75,1 ms  renderKader          @ battle-mode.engine.js:45718   (gemeinsamer Code)
  63,2 ms  (anon, Fallen-Zeichnung) @ battle-mode.engine.js:36450
```

`nahe()` war der **teuerste Einzelposten** im gesamten Takeshi-Draw — teurer als
`bodenTakeshiRoute()` selbst. Zum Vergleich: climbings äquivalente Boden-Funktion
(`bodenWand`) kostete im selben Testlauf nur 66,6 ms gesamt — kein `nahe()`-Äquivalent, weil
climbing keine prozedurale Waldplatzierung entlang einer Kurve zeichnet.

**Fundstelle:** `bodenTakeshiRoute()`, Abschnitt „5. BAEUME" (vor dem Fix bei Zeile 36411 ff.):

```js
const nahe=(x,y)=>{ let m=1e9; for(let i=0;i<R.pts.length;i+=2){
  const d=Math.hypot(R.pts[i].x-x,R.pts[i].y-y); if(d<m)m=d;} return m; };
const wald_=[];
for(let i=0;i<130;i++){ const x=bodenSaat(i+700)*W, y=bodenSaat(i+760)*H;
  if(nahe(x,y)<breite*0.5+22||nahe(x,y-30)<breite*0.5+22)continue;
  /* … weitere Ausschlusstests … */
  wald_.push({x,y,i}); }
wald_.sort((a,b)=>a.y-b.y);
```

130 Kandidatenpunkte × bis zu zwei `nahe()`-Aufrufe × eine Schleife über `R.pts` (laut
Kommentar bei `routeXY()` „~265 Stützpunkte", mit Schrittweite 2 also ~132 Iterationen je
Aufruf) ergeben bis zu ~34.000 Abstandsberechnungen **je gezeichnetem Frame**. Das Ergebnis
hängt ausschließlich von `R` (`routeTabelle()`) und `breite` ab — beide sind für die gesamte
Dauer eines Rennens fest (`routeCache` wird nur in `reset()` neu gezogen, bei einem neuen
`setDisc()`/Rennen). Die Routen-Tabelle selbst wird deshalb schon seit Einführung gecacht
(`routeCache`, `routeTabelle()` Zeile 39087) — der Wald darüber wurde nie in dieses Caching
aufgenommen und lief stattdessen bei jedem einzelnen `draw()`-Aufruf (jedem Frame, nicht nur
jedem Simulations-Tick) komplett neu.

## 4. Nebenbefund, nicht behoben: generisch teure Bahn-HUD-Funktionen

`renderWertungTabelle()`, `renderKader()` und `zeichneSpurt()` sind gemeinsamer Code für
alle Bahn-Disziplinen (nicht Takeshi-spezifisch) und tragen einen erheblichen, aber über alle
Bahn-Disziplinen GLEICH verteilten Anteil der Frame-Kosten. Ihr absoluter Anteil bei Takeshi
ist etwas höher, weil Takeshi mit 14 Hindernissen (vs. 4–7 bei den anderen) und drei
Zusatzspalten („Nerv"/„Ausw"/„Gedr") mehr Boxscore-Zeilenarbeit je Tick erzeugt — das ist
inhaltlich begründet (mehr Fallen, eigene Nerven-/Rempel-Mechanik), keine Ineffizienz, und
wird hier **nicht** angefasst (gemeinsamer Code aller fünf Bahn-Disziplinen, dieselbe
Zurückhaltung wie beim `loop()`/`draw()`-Fund des Breaking-Befunds — eine Änderung dort
bräuchte eine breite Nachmessung über alle Bahn-Disziplinen, nicht nur Takeshi).

## 5. Fix: Waldcache, analog zu `routeCache`

Trivial und sicher, weil **reiner Darstellungs-Cache ohne jede Berührung von Simulation,
Boxscore oder Rangtreue**: `wald_` fließt ausschließlich ins Zeichnen der Baumkronen, nie in
`stepSim()`/`rr()`/`wert()`. Umgesetzt:

- `let waldCache=null;` neben `routeCache` deklariert (`battle-mode.engine.js`, nahe Zeile
  39086).
- In `reset()` wird `waldCache=null` zusammen mit `routeCache=null` zurückgesetzt (neues
  Rennen → neuer Wald, falls sich die Route ändert).
- `bahnAnzeigeSichern()`/`bahnAnzeigeZurueck()` (Sonden-/Rückspul-Zustand) führen `waldCache`
  jetzt mit, exakt wie `routeCache`.
- `bodenTakeshiRoute()`: `wald_` wird nur neu berechnet, wenn `waldCache` fehlt oder sich `R`
  (die Referenz auf die aktuelle `routeTabelle()`) oder `breite` geändert haben; sonst wird
  der gecachte Wert wiederverwendet.

### Verifikation

- **Pixelidentisch:** drei aufeinanderfolgende `setDisc("takeshis-castle")`+`sondenLauf(180)`-
  Läufe (jeweils frischer Cache-Aufbau nach `reset()`) ergeben denselben SHA-256-Hash des
  Canvas-Screenshots — UND derselbe Hash entsteht mit dem unveränderten Original-Code ohne
  Cache (`b7b2797e…`). Der Fix ändert das sichtbare Ergebnis nicht.
- **rho bit-identisch:** `node scripts/miss-alle-disziplinen.mjs 24 takeshis-castle` vor und
  nach dem Fix: `0,898 / Spannweite 0,062` (je Spiel), `0,986 / 0,021` (Saison) — identisch.
  Zusätzlich `staffel`, `spurt`, `climbing`, `time-trial` nach dem Fix mitgemessen: alle
  bestanden, keine Seitenfehler.
- **`npx tsc --noEmit -p tsconfig.check.json`:** keine Fehler (das Mockup-Engine-JS liegt
  ohnehin außerhalb des TS-Compile-Graphen; der Check bestätigt, dass nichts anderes berührt
  wurde).
- **Performance-Wirkung:** `nahe()` verschwindet vollständig aus dem CPU-Profil. Die
  mittlere Frame-Zeit sinkt von ~3,65 ms auf ~3,29 ms (3 Läufe je Seite, Browser-Rauschen
  deutlich größer als der Effekt selbst) — ein echter, aber **kleiner** Gewinn: `nahe()`
  allein war nur rund 10 % der Takeshi-Frame-Zeit, der Rest ist gemeinsamer Bahn-Code
  (Abschnitt 4).

## 6. Fazit

**Nicht derselbe Fehler wie Breaking.** Takeshi hat keinen Performance-Cliff, keine
Eskalation über Ticks oder Rundreisen, keine Rückkopplung mit der Render-Schleife. Die
gemeldete „läuft nicht so gut"-Wahrnehmung passt eher zu einer durchgehend höheren, aber
FLACHEN Grundlast (rund doppelt so teuer je Frame wie vergleichbare Bahn-Disziplinen) —
auch bei ~3,3 ms/Frame liegt Takeshi für sich allein noch weit unter dem 60-fps-Budget
(16,7 ms), der behobene Anteil (Waldcache) ist ein echter, aber kein dominanter Beitrag.

**Nächster Schritt, falls Chris' Eindruck bestehen bleibt:** die verbleibende, über alle
Bahn-Disziplinen gleich verteilte Last aus `renderWertungTabelle()`/`renderKader()`/
`zeichneSpurt()` (Abschnitt 4) wäre der nächste Kandidat — das ist aber kein Takeshi-
Spezifikum mehr, sondern eine generische Bahn-HUD-Frage, die eine breitere Nachmessung über
alle fünf Bahn-Disziplinen bräuchte (wie beim `loop()`/`draw()`-Fund des Breaking-Befunds
empfohlen), nicht einen Einzelfix an Takeshi. Ebenfalls denkbar, aber separat von diesem
Auftrag (und laut Auftrag ausdrücklich NICHT Teil davon): Punkt 10 im selben CLAUDE-Abschnitt
(„unübersichtlich bei vielen Teilnehmern") — eine offene Konzeptfrage, die subjektiv ähnlich
klingen kann wie ein Performance-Problem, aber eine andere Ursache (Lesbarkeit, nicht CPU-
Last) hätte.
