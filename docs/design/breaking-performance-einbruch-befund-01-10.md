# Breaking: Performance-Einbruch in sondenLauf() — Befund (Task #36, 01.10.)

## Kurzfassung

Der gemeldete Einbruch nach ~250–400 Ticks **reproduziert nicht in der Simulation selbst**.
Eine einzelne, ununterbrochene `sondenLauf()`-Ausführung über ein komplettes Breaking-Spiel
(6275 Ticks bis `endstand`) läuft mit flachen ~0,7–1,4 ms/Tick durch, Faktor letztes zu erstem
Zehntel 0,79 (eher schneller, nicht langsamer). **GAUNTLET_\*/`gauntletRunde()`/`zeichneBreaking()`
haben kein O(n²)-Problem, kein unbegrenzt wachsendes Array, keine Ursache im Sinne der
Auftrags-Hypothese.**

Der Einbruch tritt stattdessen **ausschließlich dann auf, wenn `sondenLauf()` über viele
kleine, separate Playwright/CDP-Rundreisen aufgerufen wird** (ein `evaluate()`-Aufruf je
Chunk, so wie ein naheliegendes Tick-Grenzen-Zeitstempel-Logging es bauen würde, und so wie
mehrere bestehende Sonden-Skripte im Repo `sondenLauf()` bereits aufrufen, z. B.
`scripts/miss-ticker-dichte.mjs`). Ursache ist ein **Rückkopplungseffekt zwischen der
dauerhaft laufenden `requestAnimationFrame`-Render-Schleife (`loop()`) und den Lücken
zwischen den Rundreisen** — kein Fehler in Breakings Spiellogik. Breaking macht diesen
Effekt nur deshalb als erstes sichtbar, weil seine Gauntlet-Mechanik ungewöhnlich viele
Ton-/Ticker-Ereignisse pro Sekunde auslöst (bereits an anderer Stelle vermessen: ~600
`sfx()`-Aufrufe je Spiel, Commits `ea10d442`/`5fb1555b`).

**Kein Fix umgesetzt** — Begründung am Ende dieses Dokuments.

## 1. Reproduktion

### 1.1 Eine einzelne `sondenLauf()`-Ausführung (kein Einbruch)

Sonde: `window.__arena.setDisc("breaking")`, danach EIN `page.evaluate()`, das intern in
einer Schleife `sondenLauf(25)` aufruft und `performance.now()` **innerhalb der Seite**
zwischen den Aufrufen misst (keine Playwright-Rundreise, kein CDP-Call zwischen den
Chunks — alles läuft in einem einzigen synchronen Browser-Skript).

| Ticks gesamt | ms/Tick erstes Zehntel | ms/Tick letztes Zehntel | Faktor |
|---:|---:|---:|---:|
| 2000 | 1,833 | 1,120 | 0,61 |
| 7200 (volle Partie, endet bei 6275) | 1,134 | 0,893 | 0,79 |

Kein Audiofix nötig, kein Einbruch, keine Tendenz nach oben — im Gegenteil leicht
schneller (JIT-Warmlauf). Einzelne Ausreißer (z. B. Tick 4300: 4,79 ms/Tick, vermutlich ein
GC-Schlag oder ein teures Einzelereignis wie ein KO/eine Team-Feier) bleiben isolierte
Spitzen, keine anhaltende Verschlechterung.

### 1.2 Dieselben Ticks über viele kleine Playwright-Rundreisen (Einbruch reproduziert)

Identischer Zustand (`setDisc("breaking")`), aber jetzt **eine eigene `page.evaluate()`-
Rundreise je 25-Tick-Chunk** (das Muster, das ein Tick-Grenzen-Logger oder ein Sonden-Skript
wie `miss-ticker-dichte.mjs` naturgemäß verwendet):

| TickEnde | ms/Chunk (Node-seitig gemessen) | ms/Tick |
|---:|---:|---:|
| 100 | 88 | 3,52 |
| 200 | 174 | 6,96 |
| 300 | 7799 | 311,96 |

**Der Einbruch liegt exakt im gemeldeten Fenster (250–400 Ticks)** und ist binnen eines
einzigen weiteren Chunks (200→300) um den Faktor ~45 gewachsen. Reproduziert über mehrere
unabhängige Läufe, mit UND ohne vorherigen `Performance.getMetrics()`-Aufruf zwischen den
Chunks (also nicht durch die Messmethode selbst über CDP-Overhead verursacht).

**Das ist der entscheidende Unterschied zur Auftrags-Hypothese:** Dieselbe Tick-Zahl,
derselbe Spielzustand, dieselbe Engine-Version — der einzige Unterschied ist, OB die Ticks
in einem einzigen synchronen Aufruf oder über viele kleine Rundreisen gefahren werden. Eine
echte O(n²)-Schleife in der Simulation (z. B. ein wachsendes Array, das jeden Tick neu
durchsucht wird) würde in BEIDEN Varianten gleich einbrechen, weil sie an der Tick-Zahl
hängt, nicht an der Zahl der Playwright-Aufrufe. Hier hängt der Einbruch nachweisbar an der
Zahl der Rundreisen.

## 2. Ursache: Rückkopplung zwischen Rundreise-Lücken und der dauerhaften Render-Schleife

`battle-mode.engine.js:38994` (`loop()`):

```js
function loop(ts){
  if(!last)last=ts;
  let dt=Math.min(.05,(ts-last)/1000);last=ts;
  if(running){
    acc+=dt*speed;
    ...
  }
  draw();
  requestAnimationFrame(loop);
}
```

`loop()` wird **einmal beim Laden der Seite gestartet und läuft seitdem auf JEDEM echten
Browser-Frame weiter, unabhängig von `running`** — das `draw()` am Ende und das erneute
`requestAnimationFrame(loop)` stehen AUSSERHALB des `if(running)`-Blocks. Das ist
dokumentiertes, beabsichtigtes Verhalten (s. Kommentar in
`scripts/pruefe-sonden-modus-determinismus.mjs`: "die kontinuierlich laufende
requestAnimationFrame-Schleife (loop(), IMMER aktiv, auch ohne 'Kampf starten')") — kein
Bug für sich.

`sondenLauf(ticks)` ruft `draw()` dagegen **genau einmal pro Aufruf** auf (s. Kommentar dort:
"sondenLauf(ticks) ... ruft stepSim() GENAU ticks-mal ... und danach GENAU EINMAL draw()").
Zwischen zwei `page.evaluate()`-Rundreisen bekommt Chromiums Haupt-Thread aber die
Kontrolle zurück — und in dieser Lücke feuert die ganz normale `requestAnimationFrame`-Kette
**zusätzlich, unkontrolliert** weiter und zeichnet die (für Breaking vergleichsweise teure,
s. CPU-Profil unten) Cypher-Szene erneut, ohne dass `sondenLauf()` davon weiß.

Das allein wäre nur doppelte, verschwendete Arbeit — aber es entsteht eine
**Rückkopplungsschleife**: Breakings Gauntlet löst pro Spiel sehr viele `sfx()`-Aufrufe aus
(Herzschlag/Hieb/Freeze aus `stepCypher()`, bereits an anderer Stelle vermessen auf ~600 je
Spiel, s. Commits `ea10d442`/`5fb1555b` zu `scripts/messe-arena-einfluss.mjs`). Jeder
`sfx()`-Aufruf baut in Headless-Chromium echte WebAudio-Knoten auf, und jeder `feed()`-Aufruf
mit `big`-Flag legt einen `setTimeout()` für den Callout an (`battle-mode.engine.js:38786`).
Innerhalb eines synchronen `sondenLauf()`-Chunks kann **keiner** dieser Knoten/Timer abgebaut
werden oder feuern — das räumt Chromium nachweislich erst in einer Haupt-Thread-Aufgabe NACH
dem laufenden Skript auf (exakt der bereits dokumentierte Mechanismus der beiden Commits
oben). Diese Aufräumarbeit UND die zusätzlichen `draw()`-Aufrufe aus der frei laufenden
`requestAnimationFrame`-Kette konkurrieren in der Rundreisen-Lücke um denselben Haupt-Thread:

1. Ein Chunk mit vielen `sfx()`/`feed()`-Ereignissen hinterlässt Aufräum-Rückstand.
2. In der Lücke bis zur nächsten Rundreise muss Chromium diesen Rückstand abarbeiten UND
   feuert nebenbei weitere `requestAnimationFrame`-`draw()`-Aufrufe — das verlängert die
   Lücke (mehr reale Zeit vergeht, bevor die nächste Rundreise überhaupt starten kann).
3. Eine längere Lücke lässt NOCH MEHR `requestAnimationFrame`-Frames dazwischenfunken, die
   wiederum mehr Zeit kosten — eine selbstverstärkende Schleife, kein linearer, sondern ein
   exponentiell anmutender Anstieg, genau wie gemessen (88 → 174 → 7799 ms je Chunk).

### 2.1 Direkter Beleg: `requestAnimationFrame` stilllegen beseitigt den Einbruch

Identischer Rundreisen-Test wie 1.2, aber `window.requestAnimationFrame` wird VOR dem Laden
der Seite durch ein No-Op ersetzt (`loop()` läuft dadurch nie an):

| TickEnde | ms/Chunk | ms/Tick |
|---:|---:|---:|
| 100 | 57 | 2,28 |
| 300 | 132 | 5,28 |
| 600 | 177 | 7,08 |
| 900 | 40 | 1,60 |
| 1500 | 154 | 6,16 |
| 2000 | 55 | 2,20 |

Faktor letztes zu erstem Zehntel: **1,11** (Rauschen) statt zuvor ~90 (bei 300 von 2000
Ticks bereits 311,96 ms/Tick statt hier durchgehend 1,6–7,9 ms/Tick). Die verbleibende,
moderate und NICHT eskalierende Schwankung (bis ~8 ms/Tick, gelegentlich wieder auf <2 ms
zurückfallend) passt zum separat bekannten, kleineren WebAudio-/Timer-Rückstand (Abschnitt
2) — ohne die Rückkopplung über `requestAnimationFrame` bleibt er begrenzt, statt
außer Kontrolle zu geraten.

### 2.2 CPU-Profil (CDP `Profiler`, Ticks 200–500, Rundreisen-Modus)

Größte Selbstzeit-Verbraucher (ohne Idle/GC):

```
 106,0 ms   renderWertungTabelle @ battle-mode.engine.js:29937
  39,9 ms   zeichneBreaking      @ battle-mode.engine.js:25475
  38,8 ms   el                   @ battle-mode.engine.js:26348
  35,7 ms   updateHudBuehne      @ battle-mode.engine.js:19748
  32,1 ms   appendChild
  27,0 ms   drawImage
  24,6 ms   createElement
  22,3 ms   fillText
```

`renderWertungTabelle()` leert ihre Tabelle bei jedem Aufruf vollständig
(`tbL.textContent=""`) und baut sie aus einer FESTEN Teilnehmerzahl (12) neu auf — kein
unbegrenzt wachsendes DOM, aber ein teurer, kompletter DOM-Rebuild, der bei jedem
`updateHudBuehne()`-Aufruf (also bei jedem gezeichneten Tick/Frame, egal ob von
`sondenLauf()` oder von der frei laufenden `requestAnimationFrame`-Kette ausgelöst)
wiederholt wird. Das Profil bestätigt, DASS die zusätzlichen, von `loop()` ausgelösten
Render-Durchläufe echte, teure Arbeit sind (HUD-Rebuild + Canvas-Zeichnen) — es ist die
Häufung dieser an sich schon teuren, aber bei korrekter (einmaliger) Taktung harmlosen
Arbeit, die den Einbruch verursacht.

## 3. `#protokoll` — ein echtes, aber separates Detail (kein Treiber des Einbruchs)

Bei der Suche nach einem klassischen "wachsendes Array, das jeden Tick neu durchsucht wird"
fiel `feed()` auf (`battle-mode.engine.js:38723`): der sichtbare Ticker `#feed` deckelt sich
selbst auf 140 Zeilen (`while(f.children.length>140)f.removeChild(f.firstChild);`), aber das
VOLLSTÄNDIGE Protokoll `#protokoll` wird **nie** begrenzt — jede `feed()`-Zeile hängt sich
dort unbegrenzt an, und jeder Aufruf liest zur Scroll-Entscheidung `p.scrollHeight`/
`p.scrollTop`/`p.clientHeight` (Layout-Reflow). Das ist über ein sehr langes Spiel hinweg
real wachsende Arbeit — aber bei Breakings Ereignisrate (grobe Schätzung: ~1 `feed()`-Zug
alle `rundenDauer`=0,35 s ≈ 21 Ticks, also ~14 Zeilen bis Tick 300) viel zu klein, um einen
75- bis 300-fachen Einbruch binnen 100 Ticks zu erklären. Abschnitt 1.1 (eine einzelne
`sondenLauf()`-Ausführung über die GANZE Partie, also mit dem vollen, unbegrenzten
`#protokoll`-Wachstum über alle ~300+ Ereignisse) bleibt trotzdem durchgehend flach — das
schließt `#protokoll` als Haupttreiber aus. Es bleibt dennoch ein echter, unabhängiger
Verbesserungskandidat (z. B. dieselbe 140er-Deckelung wie beim sichtbaren Ticker auch für
`#protokoll`), nur eben nicht die Ursache dieses Tickets.

## 4. Nur Breaking, oder generisch? (Auftragspunkt 4)

Derselbe Rundreisen-Test (Chunk 25, kein Audiofix, `requestAnimationFrame` NICHT gestubbt)
gegen **Eiskunstlauf** (dieselbe Bühne-Chassis, dieselbe `loop()`/`draw()`-Kopplung):

| TickEnde | ms/Chunk | ms/Tick |
|---:|---:|---:|
| 100 | 37 | 1,48 |
| 300 | 35 | 1,40 |
| 700 | 31 | 1,24 |
| 1200 | 56 | 2,24 |
| 1500 | 42 | 1,68 |

Faktor letztes zu erstem Zehntel: **0,59** — kein Einbruch, über 1500 Ticks komplett flach.

**Antwort:** Der Rückkopplungs-MECHANISMUS (Abschnitt 2) ist generisch — `loop()` läuft für
jede Disziplin gleich. Aber er läuft nur dann außer Kontrolle, wenn genug WebAudio-/Timer-
Rückstand pro Zeiteinheit entsteht, um die erste Verzögerung "anzustoßen". Breakings
Gauntlet erzeugt genau diese hohe Ereignisdichte (Herzschlag/Hieb/Freeze-Töne, s. o.),
Eiskunstlaufs Auftritts-Mechanik offenbar nicht in vergleichbarem Maß. Das erklärt zugleich,
warum frühere Messläufe für Breaking (nicht aber für die meisten anderen Disziplinen)
bereits unabhängig als besonders speicher-/zeitintensiv aufgefallen sind (s. Commits
`ea10d442`/`5fb1555b`, dort an `messe-arena-einfluss.mjs` statt an `sondenLauf()` behoben).

## 5. Kein Fix umgesetzt — Begründung

Ein lokal begrenzter Kandidat wäre, `loop()` dazu zu bringen, das redundante `draw()`
auszulassen, solange `sondenAktiv` gesetzt ist (ohne die `requestAnimationFrame`-Kette
selbst zu unterbrechen, damit `sondenAus()` + anschließendes interaktives Weiterspielen
funktionsfähig bleibt):

```js
if(!sondenAktiv) draw();
requestAnimationFrame(loop);
```

Das wird hier **bewusst nicht umgesetzt**, aus denselben Gründen, die der Auftrag für einen
unklaren/mehrdeutigen Fix nennt:

- **Gemeinsamer Code, alle zwanzig Disziplinen.** `loop()`/`draw()` sind kein
  Breaking-spezifischer Pfad, sondern DIE Render-Schleife der gesamten Arena — eine Änderung
  hier wirkt auf jede Sonden-Nutzung jeder Disziplin, nicht nur auf Breaking.
- **Widerspruch zu einer bereits bestehenden, bewussten Design-Entscheidung.** Der
  Kommentar bei `sondenLauf()`/`sondenAus()` (und das eigens dafür gebaute
  `scripts/pruefe-sonden-modus-determinismus.mjs`) geht ausdrücklich davon aus, dass
  zwischen einem Sonden-Aufruf und einem Screenshot noch ein "streunender"
  `requestAnimationFrame`-Redraw dazwischenfunken KANN, und sichert stattdessen über
  `sondenAktiv`+`jetztMs()` ab, dass dieser Redraw pixelidentisch bleibt — die bestehende
  Lösung TOLERIERT den Extra-Redraw, statt ihn zu unterdrücken. Ein Fix, der genau diesen
  Redraw unterdrückt, kann mit dieser Absicherung kollidieren, ohne dass hier abschließend
  geprüft wurde, ob/wo das tatsächlich so ist.
- **Nicht ohne breite Nachmessung vertretbar.** `draw()` ist zwar nach Durchsicht eine reine
  Rendering-Funktion (kein erkennbarer Aufruf von `rr()`/Zustandsänderung), aber das wurde
  hier nicht für alle Codepfade aller zwanzig Disziplinen lückenlos verifiziert — genau die
  Art Prüfung, die der Auftrag für einen tatsächlich umgesetzten Fix verlangt
  (bit-identische rho/Pp-Messung vorher/nachher, mehrere Disziplinen, nicht nur Breaking).

**Empfehlung für eine spätere Runde, falls gewünscht:** den obigen Patch an EINER Stelle
umsetzen, danach `scripts/miss-alle-disziplinen.mjs 24` (alle zwanzig) UND
`scripts/pruefe-sonden-modus-determinismus.mjs` gegenmessen (rho/Pp bzw. Pixelgleichheit
müssen unverändert bleiben), und zusätzlich **die Sonden-Skripte selbst** (z. B.
`scripts/miss-ticker-dichte.mjs`, `scripts/verify-*-01-10.mjs`) daraufhin prüfen, ob sie
`sondenLauf()` eher in wenigen großen statt vielen kleinen Rundreisen aufrufen sollten —
das allein (ohne jede Motor-Änderung) hätte denselben Effekt wie Abschnitt 1.1 zeigt.

## 6. Für zukünftige Performance-Sonden dieser Art

Wer künftig ein Tick-Grenzen-Zeitstempel-Logging für `sondenLauf()` baut: **einen einzigen,
großen `sondenLauf(N)`-Aufruf je `page.evaluate()` verwenden** (Zeitstempel innerhalb der
Seite selbst sammeln und am Ende als Array zurückgeben, wie in Abschnitt 1.1), nicht viele
kleine `evaluate()`-Rundreisen. Andernfalls misst man nicht die Simulation, sondern die
hier beschriebene Playwright/`requestAnimationFrame`-Rückkopplung — und hält sie
fälschlich für einen Breaking-Mechanik-Bug.
