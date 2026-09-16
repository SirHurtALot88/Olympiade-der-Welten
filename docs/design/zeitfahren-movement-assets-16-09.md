# Time-Trial: Höhenprofil + Körperhaltung (16.09.)

Auftrag: Time-Trial (Platz 8, `docs/pm-briefings/opus-plan-zehn-disziplinen-alle-kategorien-09-10.md`
Abschnitt 9.2) stand laut `docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md`
(Zeile 10) bei **Konzept 95 % / Assets 50 % / Gameplay 92 % / Movement 65 %**. rho ist mit 0,825
(kaderfest, Spannweite 0,082) längst über der Schranke — anders als bei Fechten am selben Tag ist
hier **keine Rezeptkalibrierung nötig**, nur Präsentation.

Kern-Befund aus dem Opus-Plan, wörtlich: „im Mockup ist das Streckenprofil **UNSICHTBAR** —
`gelaende` wirkt in `gelaendeFaktor()` und erscheint nur als HUD-Balken, nicht auf der Bahn. **Man
sieht keinen Berg.**" Nachgeprüft im Code: `BAHN_ART["time-trial"].gelaende` (sieben Höhenzonen —
drei Kurven, zwei Steigungen, zwei Abfahrten) wirkt seit K5 ausschließlich in `tempoVon()` (über
`gelaendeFaktor(u)`) und in `zehrFaktor()` (über `gelaendeZehrFaktor(pos)`) — beide rein
PHYSIKALISCH, keine der beiden zeichnet je etwas. `stepZeitfahren()` existiert bereits seit PR #908
und hat Movement von 50 auf 65 gehoben (Schrittfrequenz aus dem Tempo statt der eingefrorenen
Weltuhr) — dieser Auftrag ergänzt das fehlende Höhenprofil-Bild und eine sichtbare
Bewegungsanpassung daran, ohne `stepZeitfahren()` neu zu bauen.

**Ausdrücklich NICHT angefasst:** `gelaendeFaktor()`/`gelaendeZehrFaktor()` selbst (nur gelesen,
keine Zeile der Formel geändert), `wert()`, `tempoVon()`, `bahnZeit()`, die Rennlogik. Reine
Präsentation — s. Rangtreue-Nachweis unten.

## Vorher

- **Boden:** Time-Trial lief über denselben `bodenSpurt()`-Zweig wie Spurt/Staffel/Climbing/
  Takeshi — Asphaltbahn, Zaun, Baumreihe, Bahnlinien, aber **kein einziges Pixel**, das die sieben
  `gelaende`-Zonen zeigt. Die einzige Anzeige der Steigung war der HUD-Balken im Fokus-Panel.
- **Bewegung:** `stepZeitfahren()` liest `gelaendeFaktor(u)` bereits indirekt — der Wert fließt in
  `u.v` und damit in die Schrittfrequenz (`vizSchritt`) ein, ein Fahrer am Berg tritt also schon
  sichtbar langsamer. Eine **eigene** Reaktion am Fahrer (Körperhaltung) gab es nicht — Steigung
  und Abfahrt sahen an der Figur selbst identisch aus.

## Nachher

**1. `bodenZeitfahren()`** — neue Funktion, exklusiv über dieselbe Weiche wie
`bodenSpurtOval()`/`bodenTakeshiRoute()` angeschlossen (`if(BA().zeitfahren)return
bodenZeitfahren();`, direkt in `bodenSpurt()`). Der bisherige Funktionskörper von `bodenSpurt()`
zog dafür unverändert eine Ebene tiefer in eine neue Funktion `bodenSpurtGerade()` — für
Spurt/Staffel/Climbing/Takeshi (deren Weichen alle `false` bleiben) bit-identisch zum Vorherstand,
nur der Aufrufpfad ist einen Schritt länger. `bodenZeitfahren()` ruft `bodenSpurtGerade()` zuerst
auf (derselbe Hintergrund wie bisher) und setzt danach zwei neue Schichten obendrauf:

- **Terrain-Tönung auf der Fahrbahn selbst**, Zone für Zone: ein transluzentes Farbband über die
  volle Bahnhöhe, Steigung rot-braun mit ansteigenden Schrägschraffuren, Abfahrt blau mit
  abfallenden Schrägschraffuren, Kurve gelb mit Kreuzschraffur — plus eine dritte, formbasierte
  Kodierung (▲/▼/„S"-Glyphe je Zonenmitte), damit die Aussage auch ohne Farbunterscheidung
  ankommt.
- **Höhensilhouette über der Bahn**: ein echter Hügel, der bei jeder Steigung über die Baumreihe
  wächst und in der jeweils folgenden Abfahrt wieder auf die Grundlinie fällt. Die aktuelle
  Streckenführung setzt jede Abfahrt exakt an das Ende der zugehörigen Steigung
  (`{von:0.22,bis:0.34,art:"steigung"},{von:0.34,bis:0.40,art:"abfahrt"}` — und dasselbe Muster ein
  zweites Mal bei 0,58–0,76), das Paar ergibt zusammen einen geschlossenen Hügel. Kurve-Zonen
  ändern die Höhe nicht (Kurve ist technisch, keine Elevation — dieselbe Unterscheidung, die
  `gelaendeFaktor()` selbst trifft: `kurveSkill:"WENDIGKEIT"` statt `bergSkill:"ENDTEMPO"`). Die
  Sprunghöhe je Zone ist eine rein visuelle Konstante (`ZF_HUEGEL_PX=34`), unabhängig von der
  `staerke`-Formel in `gelaendeAn()` (die für die Physik gebraucht wird, symmetrisch um die
  Zonenmitte) — die Kontur braucht eine monotone Rampe, keinen Buckel je Zone.

Beide Schichten lesen `BA().gelaende` und rufen `gelaendeAn(pos)` nur zur Positionsbestimmung auf
(dieselbe Funktion, die `gelaendeFaktor()` intern benutzt) — keine der drei bestehenden
Gelände-Funktionen wird verändert.

**2. `u.vizNeigung`** — neues, rein präsentationales Feld in `stepZeitfahren()` (vierter Block,
nach Rampe/Schrittphase/Erschöpfung): liest `gelaendeAn(u.pos)` und setzt daraus einen weich
nachgezogenen Wert -1..1 (positiv während einer Steigung, negativ während einer Abfahrt, 0 sonst —
Kurve, Rampe, Ziel). `gelaendeFaktor()` selbst wird an keiner Stelle gelesen oder verändert; die
Positionsabfrage ist identisch zu der, die `gelaendeFaktor()` intern macht.

**3. Körperhaltung in `zeichneSpurt()`** — reiner Lesezugriff auf `u.vizNeigung`, gegated auf
`BA().zeitfahren` (für jede andere Bahn bleibt `zfTilt`/`zfHaltung` bei 0/1, bit-identisch): bei
Steigung eine leichte Vorlehnung (Rotation um den Fußpunkt, bis zu 9°) plus ein leicht geduckter
Rumpf; bei Abfahrt kein Lehnwinkel, dafür minimal gestreckter/aufrechter als in der Ebene. Beide
Ausprägungen sind bewusst klein — der Auftrag nennt „leicht", nicht eine neue Silhouette. Die
Tempo-Body-Language (schnellerer/langsamerer Schrittzyklus am Berg) bestand bereits über
`vizSchritt`/`u.v`, hier kommt nur der Lehnwinkel dazu.

## Rangtreue — unverändert

```
node scripts/miss-alle-disziplinen.mjs 24 time-trial
```
→ `time-trial  bahn  12  rho je Spiel 0,825  Spannweite 0,082  rho Saison 0,825  Spannweite 0,056
bestanden`

Bit-identisch zum Vorherstand (0,825, s. `docs/design/gesamtstand-fertigstellungsgrad-alle-
disziplinen-09-10.md`).

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
| fechten | 0,826 | bestanden |
| **time-trial** | **0,825** | **bestanden** |
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

Jede Zeile ist bit-identisch zum zuletzt bekannten Stand (Fechten-PR #946, s.
`docs/design/fechten-movement-assets-16-09.md`) — **insbesondere die anderen vier
Bahn-Disziplinen** (Spurt, Staffel, Takeshi's Castle, Climbing), die weiterhin `bodenSpurt()` teilen
und über die neue `bodenSpurtGerade()`-Ebene laufen, haben sich nicht um eine Nachkommastelle
bewegt. Das bestätigt strukturell, was der Vertrag verspricht: die Ausgliederung von
`bodenSpurtGerade()` und die beiden neuen `viz*`-Felder sind reine Präsentation, kein Seiteneffekt
auf `rr()` oder die Boxscore-Felder.

Zusätzlich:
- `node --check public/mockups/battle-mode.engine.js` → OK.
- `npx tsc --noEmit` → dieselben (vorbestehenden, unveränderten) Fehler in `tests/*.ts` wie auf
  `origin/main`; `public/mockups/*.js` ist nicht Teil von `tsconfig.json`s `include` und damit von
  dieser PR ohnehin nie berührt.
- `npx tsx scripts/pruefe-slot-invariante.ts` → Time-Trial-Zeile bei n=1..6 zwischen 0,000 und
  0,003 Pp, Maximum über alle 20 Disziplinen 0,005 Pp (mini-dm) — weit unter der 0,2-Pp-Schranke.
- `npx vitest run` (gezielt, jede Datei einzeln ausgeführt: `arena-headless-runner`,
  `spiele-bahn-invarianten`, `battle-arena-ein-modell-ueberall`, `battle-zielansage-kontrakt`,
  `battle-arena-endscreen-tooltip-wurzel`, `battle-arena-heal-attribution`,
  `battle-arena-rennplan-ansage`, `basketball-pps-referenz-drift`,
  `mini-dm-ffa-pod-headless-runner`) → 9 Dateien, 59 Tests, alle grün. **Hinweis:** beim ersten
  gemeinsamen Lauf aller neun Dateien in einem Prozess schlugen drei der Browser-Zombie-Prozess-
  Zählungen (`arena-headless-runner`/`mini-dm-ffa-pod-headless-runner`) fehl — Ursache ist
  Prozesszahl-Interferenz zwischen parallel laufenden Headless-Chromium-Instanzen mehrerer
  Testdateien, nicht diese Änderung: derselbe Fehler trat identisch auf einem `git stash` (Code vor
  dieser PR) auf und verschwand vollständig, sobald jede Datei einzeln lief.

## Visuelle Verifikation

Playwright (Chromium unter `/opt/pw-browsers`) gegen `public/mockups/battle-mode.html`, serviert
über `python3 -m http.server` mit `public/` als Root. Ablauf: Arena-Tab (`#t2`) öffnen,
`window.__arena.setDisc('time-trial')`, `#play` klicken, Screenshots des `#cv`-Canvas zu mehreren
Zeitpunkten (0,3 s bis 5 s), zusätzlich gezielt gewartet (per `window.__arena.bahnPlaene()`
gepollt), bis ein Fahrer in der Steigungszone UND einer in der Abfahrtszone steht.

**Was zu sehen ist:**

- **Das Höhenprofil ist sichtbar unterschiedlich zwischen Steigung und Abfahrt.** Auf der Bahn:
  ein braunes Band mit ansteigenden Schrägschraffuren und einer ▲-Glyphe für die Steigungszone,
  direkt gefolgt von einem blauen Band mit abfallenden Schrägschraffuren und einer ▼-Glyphe für die
  Abfahrt — plus gelbe Kreuzschraffur-Bänder mit „S"-Glyphe für die drei Kurvenzonen. Über der Bahn:
  ein echter dreieckiger Hügel, der genau an der Grenze zwischen Steigungs- und Abfahrtszone
  seinen Scheitel hat und sichtbar über die Baumreihe/den Zaun hinauswächst — „man sieht keinen
  Berg" ist behoben, man sieht buchstäblich einen Berg. Ein Zoom-Ausschnitt (Steigung/Abfahrt-Grenze
  bei rennT≈3 s) bestätigt: der Hügel ist als geschlossene Silhouette lesbar, nicht nur als
  Farbfleck.
- **Die anderen vier Bahn-Disziplinen sehen unverändert aus.** `setDisc('spurt')` zeigt weiterhin
  die Erdbahn mit Hürden/Wassergraben, kein Farbband, kein Hügel. `setDisc('staffel')` zeigt
  weiterhin das Stadion-Oval. `setDisc('takeshis-castle')` zeigt weiterhin die Fallen-Route.
  `setDisc('climbing')` zeigt weiterhin die dunkle Kletterwand mit Griff-Punkten. Keines der vier
  Bilder trägt auch nur eine Spur der neuen Terrain-Tönung oder Silhouette — die Weiche in
  `bodenSpurt()` greift nachweislich nur bei `BA().zeitfahren`.
- **Körperhaltung sichtbar, wenn auch subtil bei Sprite-Größe.** Ein Vergleichsausschnitt mit einem
  Fahrer in der Steigungszone neben einem zweiten unmittelbar in der Abfahrtszone zeigt den
  Fahrer am Berg spürbar nach vorn geneigt (Kopf/Oberkörper Richtung Fahrtrichtung verschoben),
  während der Fahrer in der Abfahrt aufrechter steht — der Unterschied ist bei der kleinen
  Standard-Sprite-Größe (32 px) ein Detail, kein dominanter Effekt, aber im direkten
  Nebeneinander-Vergleich eindeutig zu sehen.
- **Keine eingefrorene Animation.** Zwei Frames eine Sekunde auseinander (t=4 s/t=5 s) zeigen 34 %
  veränderte Pixel — Fahrer bewegen sich sichtbar entlang der Bahn, die Kamera folgt, keine
  Standbild-Artefakte. `vizSchritt` (Schrittfrequenz aus dem Tempo) war bereits vor dieser PR
  repariert (PR #908) und blieb unangetastet.

**Nicht ideal, ehrlich benannt:** der Lehnwinkel ist bei 32-px-Sprites ein feines Detail, kein
Blickfang wie ein Requisiten-Objekt — er trägt vor allem im direkten Vergleich zweier Fahrer, nicht
beim beiläufigen Zuschauen eines einzelnen Rennens. Die Startrampen-Markierung („eine kleine,
disziplin-eigene Requisite, die die Höhenzone anzeigt", Punkt 3 des Auftrags) wurde **nicht**
gebaut — niedrige Priorität laut Auftrag, und die Terrain-Tönung/Glyphen an der tatsächlichen
Zonengrenze transportieren dieselbe Information bereits direkt auf der Bahn, eine zusätzliche
Rampen-Markierung hätte nichts Neues gezeigt.

## Nicht Teil dieser PR

- `gelaendeFaktor()`/`gelaendeZehrFaktor()`/`gelaendeAn()` selbst — nur gelesen, keine Zeile
  verändert.
- Kein neuer Ton — `TON_KATALOG["time-trial"]` (`start`, `zwischenzeit`, `bergauf`, `ziel`,
  `publikum`) bestand schon vollständig und war nicht Teil des Auftrags (Assets/Movement, nicht
  Ton).
- Keine Requisite (s. „Nicht ideal" oben) — bewusst ausgelassen, niedrige Priorität.
