# Fechten: Movement + Assets (16.09.)

Auftrag: Fechten (Platz 10, `docs/pm-briefings/opus-plan-zehn-disziplinen-alle-kategorien-09-10.md`)
stand laut `docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md` bei **Movement
35 %, Assets 55 %** — die beiden schwächsten Achsen aller zwanzig Disziplinen. Seit dem
Chassis-Umzug (03.09., `docs/design/tennis-fechten-buehne-umsetzung.md`) lief Fechten rein optisch
über den generischen Bühnen-Duell-Zweig: kein eigenes Bühnenbild, keine eigene Bewegungslogik,
keine Waffen-Requisite in der Hand der Fechter — genau wie Speed-Schach/I-Spy/Tennis vor ihrer
jeweils eigenen Politur. Der Motor war bereits vorbereitet: `BUEHNE_ART.fechten` trug seit PR 0.3
das deskriptive Flag `fechten:true`, und `buehnenBewegung()` den typeof-gewachten Aufruf
`if(art.fechten && typeof stepFechten==="function")` — ohne dass `stepFechten()` je existierte
(„Ziel 10"). Diese PR liefert genau das, plus eigenes Bühnenbild und Requisite.

**Ausdrücklich NICHT angefasst:** `BUEHNE_ART.fechten.rezept`, `wert()`, die Erfolgskurve in
`bauBuehne()`/`setz()`, `rundenN`, `failAbzug`. Reine Präsentation — s. Rangtreue-Nachweis unten.

## Vorher

- Bühnenbild: der generische Zwei-Reihen-Zweig in `zeichneBuehne()` (Heim oben, Gast unten,
  Spalte = Brett) — dieselbe Fläche wie bei Wettessen/Showcase/I-Spy, ohne jeden
  Fechten-spezifischen Bezug.
- Bewegung: keine. `buehnenBewegung()` verließ die Fechten-Zeile sofort wieder (`typeof
  stepFechten==="function"` war `false`), Fechter standen fest auf ihrem Rasterplatz.
- Requisite: kein `DISZIPLIN_PROP`-Eintrag. Die einzige Waffen-Anzeige war die globale
  Kosmetik-Überschreibung `DISZIPLIN_WAFFE.fechten="schwert"`, die ausschließlich während der
  kurzen `ani==="slash"`-Animation greift (0,5→0,2 s Ausfallfenster) und nur bei `!feldspiel` —
  in der stehenden Grundstellung (`u.lunge===0`, die meiste Zeit jedes Gefechts) trug ein
  Fechter deshalb **gar nichts** in der Hand.

## Nachher

**1. `stepFechten(dt, art)`** — eigene Bewegungs-/Animationsfunktion, angeschlossen über die
bereits vorbereitete Weiche in `buehnenBewegung()`. Zustandsmaschine pro Teilnehmer
(`u.vizFechtPhase`: `"engarde"` → `"ausfall"` → `"erholung"` → zurück zu `"engarde"`, oder
`"parade"` als eigener Zweig), nach demselben Aufbau wie `stepSchach()`/`stepCypher()`:

- Erkennung „frisch enthüllt" über `u.vizFechtAktuell` (Vergleich mit `u.aktuell`, wie
  `vizSchachHalb` bei `stepSchach()`), da Fechten — anders als Speed-Schach mit seinem
  Fokus-Brett — **alle Bretter gleichzeitig** zeigt, wie Tennis.
- Treffer (`r.ereignis===art.erfolgWort`): Klingenkontakt-Timer `u.vizFunkeT` auf **beiden**
  Beteiligten gesetzt → `zeichneFechten()` zeichnet einen Funken am Berührungspunkt.
- Fehlschlag: der **Gegner** bekommt `vizFechtPhase="parade"` — ein kurzes Ausweichen/Parieren,
  während der Angreifer unverändert seinen Ausfallschritt zu Ende bringt.
- Anti-Freeze (M1): `u.vizFechtBounceT` läuft *immer*, unabhängig von Ausfall/Parade — ein
  minimaler, dauerhafter Grundstellungs-Wipper (`u.vizFechtBob`, phasenverschoben über `u.id`),
  damit kein wartender Fechter zum Standbild einfriert. Das ist die konkrete Vorkehrung gegen
  das in der Scorecard dokumentierte „eingefrorene Sprite-Animation"-Wiederholungsrisiko.
- Harter Vertrag wie bei `stepSchach()`/`stepCypher()`: nur neue `viz*`-Felder, niemals `rr()`,
  niemals `u.summe/u.runden/u.aktuell/u.vorteil/u.zweikampf/u.lunge/buehneAkt/buehneZeiger/done`.

**2. `zeichneFechten(art)`** — eigenes Bühnenbild, exklusiv auf `art.fechten` gegated (dasselbe
Muster wie Heben/Schach/Breaking/Tennis). Kompletter Layout-Bruch mit dem generischen
Zwei-Reihen-Zweig, näher an Tennis' Ballwechsel-Achse: **jedes Brett bekommt seine eigene
horizontale Fechtbahn** (Piste) statt der generischen Fläche — heller Streifen, weiße
Mittellinie, zwei gelbe gestrichelte En-garde-Linien (~15 % der Bahnlänge vom Zentrum, angelehnt
an die FIE-Proportion von 2 m auf 14 m), zwei rote Grenzlinien an den Bahnenden. Heim links, Gast
rechts — `blickAus()` liefert für `u.vx=u.vy=0` (der Ruhezustand jedes Bühnen-Teilnehmers) für
Seite 0 ohnehin „rechts" und für Seite 1 „links", die beiden stehen sich also automatisch
zugewandt gegenüber, ohne dass diese Funktion je `u.vx/u.vy` anfasst. Alle Bretter laufen
gleichzeitig (kein Spotlight wie bei Speed-Schach — bei neun Gängen unnötiger Zustand); ab mehr
als zwei Brettern schrumpfen die Figuren leicht (`ctx.scale` um den Fußpunkt, dieselbe Technik
wie bei den wartenden Eiskunstlauf-Paaren), damit sich sechs Bahnen nicht überlappen. Eigene
`posMap`, damit Schwebetexte (`+X`/„kommt zu spät") an der tatsächlichen, durch Ausfall/Parade
verschobenen Position auftauchen statt an einem festen Rasterplatz.

**3. Waffen-Requisite** — `FECHTEN_HAND` (= `SCHACH_HAND`, wiederverwendet wie schon bei
`TENNIS_HAND`/`STAFFEL_HAND`), `FECHTEN_PHASEN` (drei Phasen: `engarde`/`ausfall`/`parade`, je
mit Klingenwinkel und Reichweitenfaktor) und `zeichneDegen()` als neuer
`DISZIPLIN_PROP.fechten`-Eintrag, exakt nach dem Tennis/Speed-Schach-Muster (Ankerpunkt-Tabelle +
Zeichenfunktion, keine Kopie fremder Funktionen). Eigene Zeichnung: dünne helle Klinge, kurzer
dunkler Griff, Glocke (Parierteller) am Ankerpunkt — bewusst kein ovaler Rahmen wie beim
Tennisschläger, ein Degen ist keine Saitenfläche. `zeichneFechten()` ruft `zeichneSprite(...,
true)`, das schaltet den alten `!feldspiel`-Schwert-Overlay-Pfad ab und den neuen
`istFechten()`-Requisitenblock frei (neue Wächterfunktion `istFechten()`, dasselbe Muster wie
`istTennis()`/`istSchach()`).

**4. Ton** — `TON_KATALOG.fechten` existierte bereits vollständig (`klingen`, `treffer`, `halt`,
`lampe`, `publikum`), aber `sfx("fechten", …)` wurde bislang nirgends aufgerufen. `stepFechten()`
verdrahtet die zwei naheliegendsten Ereignisse ohne jeden Umbau: `klingen`+`treffer` bei einem
Treffer, `klingen`+`halt` bei einem Fehlschlag (Referee-„Halt!"). Kein Publikums-Loop ergänzt
(Fechten läuft weiter über den geteilten `bodenBuehne()`, wie Schach — kein eigener Boden nötig).

## Rangtreue — unverändert

```
node scripts/miss-alle-disziplinen.mjs 24 fechten
```
→ `fechten  buehne  12  rho je Spiel 0,826  Spannweite 0,203  rho Saison 0,888  Spannweite 0,161  bestanden`

Bit-identisch zum Stand vor dieser PR (`ef00a225`, Fechten-Rezeptkalibrierung, rho 0,826).

**Isolationsnachweis**, `node scripts/miss-alle-disziplinen.mjs 24` (alle zwanzig Disziplinen,
keine Filterung):

| Disziplin | rho je Spiel | Abnahme |
|---|---:|---|
| speed-schach | 0,908 | bestanden |
| staffel | 0,899 | bestanden |
| spurt | 0,894 | bestanden |
| showcase | 0,892 | bestanden |
| eiskunstlauf | 0,885 | bestanden |
| takeshis-castle | 0,879 | bestanden |
| breaking | 0,869 | bestanden |
| wettessen | 0,845 | bestanden |
| gewichtheben | 0,843 | bestanden |
| **fechten** | **0,826** | **bestanden** |
| time-trial | 0,825 | bestanden |
| tennis | 0,825 | bestanden |
| climbing | 0,782 | knapp |
| basketball | 0,769 | knapp |
| football | 0,722 | knapp |
| i-spy | 0,684 | durchgefallen |
| hockey (alle) | 0,669 | durchgefallen |
| hockey (nur Feldspieler) | 0,719 | knapp |
| mini-dm | 0,256 | durchgefallen |
| battlefield | 0,251 | durchgefallen |
| tdm | 0,165 | durchgefallen |

Jede Zeile deckt sich mit dem zuletzt bekannten Stand (s. Kommentare in `battle-mode.engine.js`
und `docs/design/stand-aller-disziplinen.md`) — keine einzige Disziplin hat sich bewegt, obwohl
diese PR ein neues `viz*`-Feld auf `u` schreibt und eine neue `buehnenBewegung()`-Funktion
einhängt. Das bestätigt strukturell, was der Vertrag verspricht: reine Präsentation, kein
Seiteneffekt auf `rr()` oder die Boxscore-Felder.

Zusätzlich:
- `node --check public/mockups/battle-mode.engine.js` → OK.
- `npx tsc --noEmit` → dieselben (vorbestehenden, unveränderten) Fehler in `tests/*.ts` wie auf
  `origin/main`; `public/mockups/*.js` ist nicht Teil von `tsconfig.json`s `include` und damit von
  dieser PR ohnehin nie berührt.
- `npx tsx scripts/pruefe-slot-invariante.ts` → Fechten-Zeile bei n=1..6 zwischen 0,000 und
  0,003 Pp, Maximum über alle 20 Disziplinen 0,005 Pp (mini-dm) — weit unter der 0,2-Pp-Schranke.
- `npx vitest run` (gezielt: `arena-headless-runner`, `spiele-bahn-invarianten`,
  `battle-arena-ein-modell-ueberall`, `battle-zielansage-kontrakt`,
  `battle-arena-endscreen-tooltip-wurzel`, `battle-arena-heal-attribution`,
  `battle-arena-rennplan-ansage`, `basketball-pps-referenz-drift`,
  `mini-dm-ffa-pod-headless-runner` — alle Tests, die `battle-mode.engine.js` headless laden) →
  9 Dateien, 59 Tests, alle grün.

## Visuelle Verifikation

Playwright (Chromium unter `/opt/pw-browsers`) gegen `public/mockups/battle-mode.html`, serviert
über `python3 -m http.server` mit `public/` als Root (damit sprite-/asset-relative Pfade
auflösen). Ablauf: Arena-Tab öffnen, `window.__arena.setDisc('fechten')`, `#play` klicken,
Screenshots des `#cv`-Canvas zu mehreren Zeitpunkten (0,1 s bis 8 s).

**Was zu sehen ist:**

- Sechs eigenständige, horizontale Fechtbahnen übereinander — schmaler heller Streifen,
  Mittellinie, gelbe En-garde-Striche, rote Grenzlinien an beiden Enden. Deutlich unterscheidbar
  von der generischen Fläche, die Wettessen/Showcase/I-Spy weiterhin zeigen.
- Beide Fechter je Bahn halten sichtbar einen dünnen Degen mit Glocke (Parierteller) in der
  Hand, Klinge zum Gegner gerichtet — nicht mehr die leere Hand der Vorher-Fassung. Ein enger
  Ausschnitt einer einzelnen Bahn bestätigt das: Klinge und Glocke sind bei Kader-typischer
  Sprite-Größe klar als Requisite erkennbar, nicht nur als Pixel-Rauschen.
- **Bewegung bestätigt, kein Freeze:** ein Vergleich zweier Frames 400 ms auseinander (Region
  einer einzelnen Bahn) zeigt 2,7 % veränderte Pixel-Kanäle — allein aus dem
  Grundstellungs-Wipper plus dem laufenden Gehzyklus, ohne dass in diesem Fenster zwingend ein
  Treffer/Fehlschlag enthüllt wurde. Bei einer frisch enthüllten Runde (t≈100 ms nach
  Spielstart) stehen beide Beteiligten sichtbar näher an der Mittellinie als 200 ms später
  (t≈300 ms, Rückkehr in die Grundstellung) — der Ausfallschritt-hin-und-zurück ist im
  Bildvergleich sichtbar, nicht nur im Code.
- **Klingenkontakt-Funke bei Treffer:** bei „Lava Golem — setzt den Treffer gegen Krag'Zul" (Feed
  0:01) zeigt der Screenshot exakt zu diesem Zeitpunkt einen hellgoldenen Blitz mittig auf der
  entsprechenden Bahn, plus eine grün schwebende „+X"-Punktzahl über dem Angreifer — beides an
  der tatsächlichen (durch den Ausfallschritt verschobenen) Position, nicht am alten,
  festen Rasterplatz.
- Die Kopfzeile je Bahn („Treffer a:b · Vorteil ±v · Gang j/9") aktualisiert sich sichtbar pro
  Bahn unabhängig — bestätigt über mehrere Zeitpunkte hinweg unterschiedliche Trefferstände je
  Brett.

**Nicht ideal, ehrlich benannt:** bei sechs gleichzeitig aktiven Bahnen ist die Fläche pro Bahn
knapp (~470 px Canvas-Höhe / 6 ≈ 78 px), die Figuren sind entsprechend klein skaliert
(`sk`-Faktor bis auf 0,65 bei sechs Brettern) — der Degen ist bei dieser Größe erkennbar, aber
kein Detail-Schmuckstück. Das generische Broadcast-Callout-Banner (DOM-Overlay, für alle
Disziplinen gemeinsam) kann bei einem „big"-Ereignis kurzzeitig die oberste Bahn überdecken —
vorbestehendes Verhalten, keine Regression dieser PR, aber sichtbar auf einzelnen Screenshots.

## Nicht Teil dieser PR

- Kein `bodenFechten()` — Fechten läuft weiterhin über den geteilten `bodenBuehne()`-Hintergrund
  (Podest, Scheinwerferkegel), genau wie Speed-Schach. Die Piste selbst (die eigentliche
  Fechtbahn-Optik) steht direkt in `zeichneFechten()`, wie das Schachbrett in `zeichneSchach()`.
- Kein Publikums-Loop (`tonLoopStart("fechten")`) — nur die zwei Einschuss-Töne verdrahtet, s.
  Punkt 4 oben.
- Kein Kampfrichter-/Lampen-Overlay wie bei Gewichtheben — der Klingenkontakt-Funke plus die
  Treffer-Kopfzeile transportieren „wer hat getroffen" bereits eindeutig.
