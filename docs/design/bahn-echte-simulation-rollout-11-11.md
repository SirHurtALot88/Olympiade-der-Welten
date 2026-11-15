# Keine Demos mehr: echte Simulation auf der Bahn — Befund, Pilot Climbing, Fahrplan (11.11.)

Chris am 11.11., nach einem Blick in die Arena eines Climbing-Spieltags, wörtlich: „ja dann bitte
anpassen, KEINE DEMOS mehr! das soll nicht einfach abgespult werden! das muss sauber simuliert sein
durch unsere engine und das in JEDER disziplin".

## 0. Kurzfassung

- **Die Demo lief nicht in der Battle Arena, sondern im alten Bühnen-Pfad.** Der Kasten „Pixel-Arena"
  (`DisciplinePixelScene`) spielte auf Klick eine selbstlaufende Demo-Seite (`public/szenen/…`) mit
  festen Demo-Figuren ab; schon sein Standbild trug diese Figuren eingebrannt. Er erschien nur dort,
  wo die alte Bühne läuft: Manager-Saves, Zufallsmodus — und **im Admin-Testmodus auch in
  Battle-Saves**.
- **Genau das hat Chris gesehen.** Sein aktiver Save (`new-game-1793476611202-0dwpok`) ist ein
  Battle-Save, Spieltag 1 = **Climbing + Battlefield**, Climbing ist dort motor-gewertet. Der
  Testmodus (`?dev` oder localStorage `oly-stage-dev`, bleibt im Browser stehen) schaltete aber die
  echte Battle Arena ab (`battleModusArena = echt && !devMode && battleSave`) und zeigte stattdessen
  Bühne + Demo.
- **Die Battle Arena zeigt die Bahn schon echt.** `zeichneSpurt()` zeichnet jeden Läufer aus
  `LAEUFER` (gebaut aus dem echten Kader) als PixelLab-Figur seines Namens an `laeuferXY(u)`, also
  am Motor-Fortschritt `u.pos`. Seit dem Anzeige-Treue-Fix A1 (#1372) tickt die Bahn-Physik beim
  Zuschauen mit demselben festen `1/60` wie die Buchung, nur die Zeichenhäufigkeit ist gedehnt.
  Offener Punkt 1 aus `battle-arena-spieltag-anbindung-02-11.md` („Climbing 1 von 12 anderer
  Sieger") ist damit erledigt: heute 8/8 Saaten gleiche Endrangfolge (`miss-sendedauer.mjs
  --nur-anzeige-treue climbing`).
- **Gebaut:** (1) Der Admin-Testmodus schaltet die echte Battle Arena nicht mehr ab
  (`waehleArenaFlaeche`). (2) Die Pixel-Arena spielt keine Demo-Seite und zeigt kein
  Demo-Standbild mehr, in **allen 20** Disziplinen. Sie zeigt nur noch die saubere Kulisse (dieselbe
  wie im Motor) und die echte eigene Aufstellung. (3) Zwei Lese-Sonden im Motor und ein Test, der für
  Climbing Figur für Figur und Tick für Tick „gezeigt = gebucht" nachweist.
- **Wertung unverändert:** Fingerabdruck `GESAMT 6cc68d248770` (69 Einträge) auf `main` und Branch.
- **Offen für Chris:** Manager-Saves werden über PPS gewertet, nicht über den Motor. Dort gibt es
  kein simuliertes Spiel, das man zeigen könnte (Abschnitt 5).

## 1. Der Befund

### 1.1 Wo die Demo lief

| Ort | Wann | Was gezeigt wurde | Woher die Wertung kam |
|---|---|---|---|
| Battle Arena (`FoundationBattleArenaHost`, Prop `spieltag`) | Battle-Save, Motor-Spiel gebucht | echter Motor, echte Figuren | dieselbe Saat/Aufstellung wie die Buchung |
| Hinweis „ohne Motor-Spiel" | Battle-Save, Brücke/Vorlauf | kein Spiel, nur die gebuchte Wertung | PPS-Brücke |
| Alte Bühne + **Pixel-Arena mit Demo** | Manager-Save, Zufallsmodus, **Admin-Testmodus** | Demo-Seite (Kiti, Wurzelbert, Arlen, Johanna …), darunter die Punkte-Bühne | Manager: PPS-Resolve; Battle im Testmodus: Arena-Vorlauf |

Die Demo-Seiten sind in `lib/foundation/discipline-scenes.ts` registriert und wurden von den
`scripts/baue-*-szene.py` / `baue-szenen-varianten*.py` gebaut — ausdrücklich ohne Kopplung an den
Spieltag. Der Motor nutzt sie seit 03.11. nur als Quelle für seine Kulissen
(`scripts/baue-arena-kulissen.py` → `battle-mode.kulissen.js`, ohne Demo-Figuren).

### 1.2 Was in der Battle Arena auf der Bahn passiert

- Läufer: `LAEUFER` aus `bauSpurt()` mit dem übergebenen Kader (`__olyArenaKader` bzw.
  `kaderSetzen`). Figur: `pixelFigurLaden(u.n)`, also die PixelLab-Figur des Spielers.
- Stelle: `laeuferXY(u)` mit Weiche Oval (Staffel), Wand (Climbing), Route (Takeshi), gerade Bahn
  (Spurt, Zeitfahren). An der Wand: Spalte `wandX(u.bahnZ)`, Höhe `camY(climbAnzeigeAnteil(u))`.
  `climbAnzeigeAnteil` ist `u.pos`, außer kurz nach einem Sturz (0,4 s Überblendung statt Teleport).
- Pose: `walk` beim Klettern/Laufen (Blick nach oben → Nord-Streifen, wo vorhanden), `treffer` bei
  `vizSturz` (Abrutschen), kein `tod` für einen Sturz (Opus-Review 10.11.).
- Takt: `anzeigeSechzigstel()` sammelt Anzeige-Sechzigstel in `bahnSimAcc` und ruft `stepSim(1/60)`,
  sobald `zeitFaktor()` davon voll sind. Die Buchung (`bahnLauf`, `spieleBahn`) ruft `stepSpurt(1/60)`.
  Gleiche Ticks, gleiche `rr()`-Folge, gleiches Rennen.

## 2. Was gebaut ist

| Datei | Änderung |
|---|---|
| `lib/foundation/battle-arena/arena-spieltag-ansicht.ts` | `waehleArenaFlaeche()`: Battle-Save + gebuchtes Motor-Spiel → **immer** Battle Arena, auch im Testmodus; ohne Motor-Spiel bleibt der Testmodus bei der Bühne. Nie beides zugleich, also keine zweite Buchung. |
| `app/foundation/discipline-stage/DisciplineStageArena.tsx` | nutzt `waehleArenaFlaeche()`; das Motor-Spiel wird in Battle-Saves auch im Testmodus gesucht. |
| `app/foundation/discipline-stage/DisciplinePixelScene.tsx` | kein iframe, kein „▶ Szene abspielen", kein Demo-Standbild. Saubere Kulisse + echte Aufstellung darauf. Kein Demo-Erklärsatz (`scene.note` beschreibt die Demo-Seiten). |
| `lib/foundation/discipline-scenes.ts` | neues Feld `kulisse` je Variante (`/sprites/kulissen/…`); `null` für die fünf Varianten ohne geschnittenen Hintergrund (Staffel „Stabwechsel", Takeshi ×3, Schach „Turniersaal"). `demo`/`poster` bleiben als Werkzeug-Quelle. |
| `public/mockups/battle-mode.engine.js` | zwei reine Lese-Sonden in `window.__arena`: `bahnFigurenProbe()` und `bahnSpurProbe(bd, saat)`. Kein `rr()`, kein Schreibzugriff. Der Motor-Dateihash ändert sich, offene Vorläufe rechnen nach dem Deploy einmal neu, mit denselben Ergebnissen. |
| `tests/bahn-climbing-gezeigt-gleich-gebucht.test.ts` | der Nachweis (Abschnitt 3). |
| `tests/discipline-scenes.test.ts`, `tests/arena-spieltag-ansicht.test.ts` | Kulisse je Variante vorhanden bzw. bewusst leer; Pixel-Arena ohne iframe/`.demo`/`.poster`; die vier Fälle von `waehleArenaFlaeche`. |

**Warum alle 20 auf einmal und nicht nur Climbing:** die Demo hing nicht an der Disziplin, sondern
an einem gemeinsamen Kasten. Ihn nur für Climbing abzuschalten hätte die Demo in 19 Disziplinen
stehen lassen. Pilotiert wird deshalb der **Nachweis**: der Test, dass das Gezeigte die Simulation
ist.

## 3. Der Pilot Climbing: gezeigt = gebucht, Figur für Figur

**Warum Climbing:** Chris hat es gesehen. Es war außerdem der Fall mit dem dokumentierten
Siegerwechsel (02.11.) und hat mit Sturz-Überblendung und scrollender Wand die meiste reine
Anzeige-Logik zwischen `u.pos` und Bild. Was an der Wand hält, hält auf der geraden Bahn erst recht.

`tests/bahn-climbing-gezeigt-gleich-gebucht.test.ts` (echtes Chromium, echter Kader aus
`kaderfamilie-live-save.json`, drei Saaten) prüft in jedem abgetasteten Bild der zuschaubaren
Wiedergabe (`sondenLauf`, derselbe Takt wie `loop()`):

1. dieselben Figuren: Läufer = Spieler des übergebenen Kaders, jede Figur als PixelLab-Figur angemeldet;
2. derselbe Zustand: `pos` jedes Läufers **bitgleich** zum gebuchten Lauf nach derselben Tickzahl;
3. dieselbe Stelle: eigene Routen-Spalte, gezeichnete Höhe = `pos` (außerhalb der Sturz-Überblendung),
   wer höher hängt, wird höher gezeichnet; Sturz-Überblendung < 25 % der Bilder.

Gemessen (Saat 1337): 76 Bilder × 12 Kletterer = **912 von 912** Positionen bitgleich.
Gegenprobe mit dem gebuchten Lauf einer anderen Saat: **700 von 912** abweichend. Der Test erkennt
also einen falschen Lauf.

## 4. Fahrplan für die übrigen Bahn-Formate

Schon gemessen, mit derselben Sonde, Saat 1337, echter Kader: bei allen fünf Bahn-Duellen ist
**jede** abgetastete Position bitgleich zur Buchung, und jede Figur ist angemeldet.

| Disziplin | Bilder × Läufer | bitgleich |
|---|---:|---:|
| climbing | 76 × 12 | 912 / 912 |
| time-trial | 138 × 12 | 1656 / 1656 |
| spurt (klassisch) | 352 × 10 | 3520 / 3520 |
| staffel | 299 × 12 | 3588 / 3588 |
| takeshis-castle | 85 × 12 | 1020 / 1020 |

Es fehlt also kein Umbau, nur die Absicherung.

| Welle | Disziplinen | Pfad | Arbeit | Risiko |
|---|---|---|---|---|
| 1 | time-trial, spurt klassisch, staffel, takeshis-castle (Duell) | Bahn, `bahnSpurProbe` | Test auf `it.each` erweitern. Teil 3 je Weiche anpassen: gerade Bahn `x` steigt mit `pos` (Ziel-Warteschlange `platz` und Hot Seat `y−34` ausnehmen); Oval über `ovalPunkt`; Takeshi-Route über `routeXY`, `raus` ausnehmen; Staffel nur den aktiven Läufer je Team. | gering, Zustand ist schon bitgleich |
| 2 | spurt: Hatz, HYROX-Stationen | Bahn, Ergebnis beim Bau | Das Ergebnis steht vor dem ersten Tick fest (`baueHatz()`/`hyroxFahrplan()`). Prüfen: Endrangfolge = Fahrplan, kein Läufer überholt gegen den Fahrplan. Die Sonde braucht einen Format-Schalter (heute Duell-klassisch). | gering |
| 3 | Bahn-Pod staffel/takeshis-castle (4 Teams), battlefield-Pod | Pod | `bahnSpurProbe` setzt den Pod über `vorher()` zurück; nötig ist eine Pod-Variante entlang `spieleBahnPod`. Battlefield-Pod spielt ein vorab entschiedenes Gefecht (`bfffaGefecht`) ab, also wie Welle 2 prüfen. | **Leistung:** bis 24 Figuren gleichzeitig. Anpfiff wartet auf alle Grundposen (`FIGUREN_WARTE_MS`); im Live-Browser Bildrate messen. |
| 4 | Bühne, Feldspiel, Kampf (übrige Motor-Disziplinen) | jeweils eigenes Chassis | Chris sagt „in JEDER disziplin". Dieselbe Sonden-Idee je Chassis (`U`, `FSTEAM`, Bühnen-Zustand). Kampf/Feldspiel haben seit dem B1-Nachtrag denselben festen Takt; Bühne war schon bitgleich. | mittel, eigene Sonde je Chassis |
| — | tdm, hockey, football | PPS-Duell-Brücke | Kein Motor-Spiel gebucht, die Arena zeigt ehrlich keins. Erst nach Motor-Anschluss (`formkarten-motor-p4-11-11.md` 1.5). | — |

**Querschnittsrisiko Takt/Bildrate.** Die Physik tickt fest, gezeichnet wird bei jedem Bild. Je
Sekunde Zuschauzeit kommen `60/zeitFaktor()` Ticks: Climbing und Zeitfahren 13,7, Takeshi 27,6,
Spurt 5,4, **Staffel 4,1**. Bei Staffel und Spurt springt eine Figur also nur gut viermal bzw. fünfmal
je Sekunde ein Stück weiter, der Laufzyklus dazwischen läuft weiter. Ob das im Browser als Ruckeln
auffällt, ist **nicht** nachgesehen. Wenn ja, hilft eine reine Anzeige-Interpolation zwischen dem
letzten und dem aktuellen Tick in `laeuferXY`. Sie darf nichts zurückschreiben, und der Test aus
Abschnitt 3 muss dann `pos` statt der gezeichneten Stelle vergleichen.

## 5. Offen für Chris

1. **Manager-Saves haben kein simuliertes Spiel.** Dort wertet der PPS-Resolve, nicht der Motor. Die
   Bühne zeigt diese Zahlen als Punkte-Animation. Seit heute steht darüber nur Kulisse plus
   Aufstellung, keine Demo mehr. Ein echtes Motor-Spiel gäbe es dort nur, wenn auch Manager-Saves
   über den Motor gewertet würden. Das wäre eine Wertungsänderung mit rho/Pp-Abnahme, keine
   Anzeigefrage. Alle Manager-Saves im Live-Abbild sind älter (bis 14.10.); der aktive Save ist
   Battle.
2. **Keine eigene Kletter-Pose.** Kletterer nutzen `walk` (Blick nach oben, Nord-Streifen wo
   vorhanden, sonst die Ost-Näherung) und `treffer` beim Abrutschen. Eine eigene „Klettern"-Animation
   wäre eine neue PixelLab-Animation für den ganzen Figuren-Bestand. Sie ist **nicht** bestellt, nur
   als Frage notiert (CLAUDE.md, Freigabe-Sperre). Diese Runde hat **keine** PixelLab-Assets
   erzeugt.
3. **Fünf Varianten ohne saubere Kulisse** (Staffel „Stabwechsel", Takeshi Burg/Eisfestung/Dschungel,
   Schach „Turniersaal"): dort zeigt die Pixel-Arena kein Bild statt des Demo-Standbilds. Takeshi
   zeichnet seine Route im Motor selbst. Die anderen beiden ließen sich mit
   `scripts/baue-arena-kulissen.py` nachschneiden.

## 6. Prüfungen dieser Runde

- `tests/bahn-climbing-gezeigt-gleich-gebucht.test.ts` (3 Saaten) grün; Gegenprobe s. Abschnitt 3.
- `tests/discipline-scenes.test.ts`, `tests/arena-spieltag-ansicht.test.ts`,
  `tests/discipline-scenes-schauplaetze-staffel2.test.ts`, `tests/arena-kulissen.test.ts`,
  `tests/arena-preview-booked-as-shown.test.ts` grün.
- Fingerabdruck `GESAMT 6cc68d248770` (69 Einträge) auf `main` und Branch, `diff` leer.
- `miss-sendedauer.mjs --nur-anzeige-treue --saaten=8 climbing`: 8/8 übereinstimmend.
- `tsc --noEmit`: keine Fehler in berührten Dateien. ESLint: 0 Fehler. Die 18 Warnungen in
  `DisciplineStageArena.tsx` stehen genauso auf `main`.
