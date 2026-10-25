# Time-Trial: sequenzieller Start (gebaut) + PP nach Zeit statt Platz (Diagnose, nicht gebaut) — 15.10.

Zwei offene Projekt-Punkte aus `docs/design/chris-feedback-breite-runde-13-10.md` Abschnitt
„Time-Trial" (Punkt 4 und 5a — Punkt 5b/Höhenprofil und Punkt 6/Overlay sind bereits durch PR
#1179, „ZF1", erledigt, s. dort). **Punkt 5a (sequenzieller Start) ist in diesem PR gebaut, Klasse
A, read-only auf `score`/`rank`. Punkt 4 (PP nach Zeit statt Platz) bleibt unverändert auf
`main` — empirisch geprüft, aber bewusst nicht gebaut, s. Abschnitt 2.** Beide Prototypen zur PP-
Frage liefen isoliert in `/tmp/claude-0/time-trial-pp`, nie auf `main`.

---

## 0. Ausgangslage — was auf `main` schon da war, bevor dieser PR etwas änderte

**Der gestaffelte Einzelstart existiert im Simulations-Motor bereits seit dem 07.09.** (K5,
`docs/design/zeitfahren-recherche-06-09.md`): `BAHN_ART["time-trial"].startAbstand:0.8` lässt
jeden Läufer mit `u.startT = (idx*2+seite)*startAbstand` einzeln von einer Rampe starten, mit
eigenem Warte-/Fahren-Zustand, Start-Ton je Fahrer, einer auf die eigene Fahrzeit korrigierten
Wertung (`bahnZeit(u) = u.fertig - u.startT`, s. Kommentar dort) und einer auf den gestaffelten
Start zugeschnittenen Hochrechnung für den Zwischenstand (`bahnHochrechnung`). **Das betrifft aber
ausschließlich `public/mockups/battle-mode.engine.js`** — den Headless-Motor, der die Simulation
rechnet und misst (`bahnLauf`, `disziplinProbe`, `einflussVon`, `spieleBahn`). Dieser Motor hat
keine eigene Grafik, die der Spieler je sieht; die Canvas-Visualisierung in
`battle-mode.html`/`.engine.js` ist ein internes Werkzeug (s. ZF1-PR-Text: „nicht auf dem
Battle-Arena-Motor, den laut Audit kein einziger echter Spielstand zeigt").

**Was Chris tatsächlich sieht, ist `peloton.tsx`** (die Spieltags-Bühne, `prim: "peloton"`,
`DisciplineStageNativeArena.tsx`) — eine komplett eigene, rein clientseitige Visualisierung, die
nur `t.score`/`t.displayScore`/`t.animScore`/`t.rank` liest (s. Datei-Kopfkommentar „x = kumulierte
Punkte, Score = Wahrheit"). Sie hat mit `battle-mode.engine.js` keine gemeinsame Laufzeit und wusste
bisher nichts von `startT`/`startAbstand`: `displayScore` beginnt für alle Fahrer gleichzeitig bei 0
und rampt gemeinsam hoch (ein `queue`-Feld gab nur eine kleine **Positions**-Staffelung am
Startgitter, keine **zeitliche**). Deshalb sah Chris am 13.10. — fünf Wochen nach K5 — exakt das,
was er beschrieb: alle Fahrer wirken wie ein Massenstart. **Der K5-Mechanismus hat die sichtbare
Beschwerde nie erreicht, weil er in einer anderen Komponente lebt, die die Spielbühne nie
aufruft.** Das war mit ein Grund, hier noch einmal nachzusehen, statt die Aufgabe für erledigt zu
halten.

**Die Team-Wertung ist seit dem 22.09. bereits zeitsummenbasiert**, nicht mehr rangpunktbasiert
(`BAHN_ART["time-trial"].wertung:"zeit"`, Kommentar dort: Chris wörtlich „da werden wie bei tour de
france oder so die zeiten aller im team addiert und das team hat dann gewonnen"). Das beantwortet
aber eine ANDERE Frage als Punkt 4: `bahnTeamstand()`s `wertung:"zeit"`-Zweig bestimmt nur, welche
**Seite das Duell gewinnt** (Sieg/Unentschieden/Niederlage in der Liga-Tabelle) — nicht, wie viele
**individuelle PP** ein einzelner Spieler für seine Leistung bekommt. Die zweite Baustelle, am alten
`docs/design/time-trial-einzelzeitfahren-wertung-plan-05-09.md` schon erkennbar
(„Teamwertung ≠ Einzelwertung sind zwei Groessen"), bestand am 13.10. unverändert fort — s.
Abschnitt 2.

---

## 1. Gebaut: ZF2 — sequenzieller Start, Klasse A

### 1.1 Was Chris wollte

„im Time Trial sollen die Spieler NACHEINANDER antreten wie beim Zeitfahren" — eine rein visuelle
Forderung an die Spieltags-Bühne. Das Höhenprofil (derselbe Satz, zweiter Teil) ist durch ZF1
bereits erledigt.

### 1.2 Diagnose: presentation-only, keine Simulationsänderung nötig

`peloton.tsx` animiert jeden Fahrer-Token über `tp(t, t.animScore)` — eine reine Projektion von
Score auf eine x-Position entlang der Straße (`x = X0 + fortschritt*(X1-X0)`). `animScore` rampt für
ALLE Fahrer gemeinsam vom letzten Rundenstand auf den neuen hoch (Host-Benchmark-Sync,
„simultanes 5s-Gleiten"). Es gibt keine einzelnen Startzeiten in den Daten, die diese Komponente
erreichen — und es müssen auch keine eingeführt werden: ein zeitlich gestaffelter Start ist ein
reines **Wann wird wer gezeichnet**-Problem, keine Änderung an **wo im Rennen er tatsächlich steht**
(`score`/`rank`/`displayScore` bleiben exakt das, was der Host vorgibt). Damit ist das derselbe
Fall wie ZF1.5 (Kamerafokus): eine zusätzliche, rein clientseitige Zeitachse für die Zeichnung, die
mit der Spielwahrheit nie interagiert.

### 1.3 Umsetzung (`app/foundation/discipline-stage/arena/disciplines/peloton.tsx`)

Jeder Fahrer-Token bekommt beim ersten Mounten (nur falls er zu diesem Zeitpunkt noch sichtbar an
der Startrampe steht, s. unten) eine `holdDelayMs` nach seinem `laneIdx` (derselben dichten,
deterministischen Lauf-Reihenfolge, die das bestehende `queue`-Feld — die kleine
Start-**Positions**-Staffelung am Gitter — schon nutzt): `laneIdx * 360ms`. Bis die rAF-eigene Uhr
(`nowT`, läuft unabhängig von `Date.now()`/Score) diese Schwelle erreicht, bleibt die GEZEICHNETE
x-Position (`dx`) bei `X0`, unabhängig davon, wie weit `t.animScore`/`st.x` (die „Wahrheit")
tatsächlich schon ist. Danach blendet `releaseEase` (500ms linear) weich zur wahren Position auf —
kein Teleport. Bei bis zu zwölf Fahrern (`BAHN_ART["time-trial"].jeSeite` 6 je Seite) ergibt das
eine Gesamt-Spreizung von gut vier Sekunden, bis der letzte losfährt.

**Geschützte Fälle:**
- `reducedMotion`: `releaseEase` startet sofort bei 1 — kein Halt, keine Animation, exakt wie der
  bestehende `reduce`-Zweig für jedes andere Feld dieser Komponente.
- **Seitenaufruf mitten im Rennen** (Reload, später Einstieg): nur Fahrer, deren `tgt.x` beim
  Mounten noch innerhalb der ersten 3 % der Strecke liegt (`onRamp`), bekommen überhaupt eine
  Verzögerung — wer die Seite öffnet, wenn das Rennen schon läuft, sieht sofort die echte Position,
  statt künstlich zurückgehalten zu werden.
- Pause/Hover (`frozen`): die Freigabe-Uhr läuft nicht mit, solange das Feld eingefroren ist — exakt
  dieselbe Klammer, die auch `st.x`/`draft`/`y` während einer Pause anhält.

**Klasse-A-Garantie, explizit geprüft wie bei ZF1:** `score`/`displayScore`/`rank`/`t.animScore`
werden an keiner Stelle gelesen VERÄNDERT — die neuen Felder (`holdDelayMs`, `releaseEase`) steuern
ausschließlich die lokale Zeichenvariable `dx` (Token-Transform UND Profil-Positionsmarker, die
beide ohnehin von `dx` abhängen). Kein `rr()`, keine neue Zufallsquelle, die das Ergebnis
beeinflusst — die Start-Reihenfolge kommt aus `t.laneIdx`, einem bereits vorhandenen, deterministischen
Feld.

### 1.4 Sichtprüfung

`/dev-arena` (bestehender Harness, derselbe, den ZF1 für seine Fokus-Prüfung nutzte), Primitive
„Time Trial", Playwright/Chromium, vier Screenshots nach dem ▶-Klick (t≈0,25 s / 1,15 s / 2,65 s /
5,65 s):

- **t≈0,25 s:** fast alle Fahrer noch als Pulk an der Startrampe, nur die ersten zwei Plätze lösen
  sich sichtbar.
- **t≈1,15 s:** ein dritter Fahrer hat sich klar vom Pulk gelöst und liegt sichtbar vor dem Rest —
  die anderen stehen weiter an der Rampe.
- **t≈2,65 s:** zwei Fahrer sind draußen, deutlich getrennt von der Rampen-Gruppe und voneinander.
- **t≈5,65 s:** fast das gesamte Feld ist draußen (Stagger-Ende bei knapp 4,3 s für zwölf Fahrer),
  normales Renn-Bild.

Nacheinander, nicht gleichzeitig — genau Chris' Beschwerde behoben. `tsc --noEmit` und
`eslint app/foundation/discipline-stage/arena/disciplines/peloton.tsx` zeigen keine neuen Fehler
(ESLint: dieselben acht vorbestehenden `react-hooks/refs`-Warnungen wie auf `main`, keine davon in
den geänderten Zeilen). `tests/time-trial-terrain-profile.test.ts` (ZF1, unberührte Datei) bleibt
grün.

---

## 2. Diagnose: PP nach Zeit statt Platz — gemessen, NICHT gebaut

### 2.1 Der Befund: zwei verschiedene Wertungen, nur eine ist zeitbasiert

Produktionspfad für Time-Trial (`time-trial` steht seit dem 10.09. in
`ARENA_RESOLVED_DISCIPLINE_IDS`, `lib/battle/arena-resolved-disciplines.ts`):

```
spieleBahn() → bahnTeamstand() → boxscore.wert = bahnRangliste().punkte
  → computeIndividualBoxscorePpsFromFixtureResults() → ppsAusArenaImpact()
```

`bahnRangliste().punkte` ist **Rangpunkte**: Platz 1 bekommt N Punkte (N = Feldgröße), der Letzte 1
— unabhängig davon, ob der Vorsprung 0,08 s oder 12 s betrug. Das ist dieselbe Größe, die seit dem
05.09.-Plan für die SEITENWERTUNG galt, bevor die 22.09.-Änderung die Seite auf Zeitsumme umstellte
(`wertung:"zeit"`) — **die Rangpunkte für den EINZELNEN Läufer blieben dabei unverändert
Rangpunkte**, s. Kommentar an `bahnTeamstand()`: „die PUNKTE JE LAEUFER bleiben unangetastet
`bahnRangliste().punkte` … Nur `seiten`, das TEAM-Ergebnis, wechselt." Das ist exakt Chris'
13.10.-Befund: „manche Spieler … zeitlich einen Vorsprung rausholen oder manche besonders langsam
sind" — die individuelle PP sieht davon nichts, nur den Rang.

`MOTOREN["time-trial"].wert()` (der Messwert für `rho`/`einflussVon`, NICHT der Produktionspfad)
ist ebenfalls rein rangbasiert (`-(Platz)`). Beide Kanäle — Mess-Sonde UND Produktion — stimmen
also heute überein: beide sind reine Rangfunktionen. Das heißt auch: **eine Änderung an der
Produktions-PP allein, ohne `M.wert()` mitzuziehen, würde die Mess-Sonde von dem entkoppeln, was
tatsächlich ausgezahlt wird** — eine Art Spiegelbild des TMP/AUS-Risikos (`docs/design/
tmp-aus-pp-chassis-diagnose-15-10.md`): dort drohte eine Änderung, die nur die Sonde schönt, ohne
real etwas zu bewirken; hier würde eine Änderung real etwas bewirken, ohne dass die Pflicht-Sonde es
noch sauber abbildet. Jeder Prototyp unten ändert deshalb konsequent `M.wert()` MIT.

### 2.2 Mathematischer Vorab-Befund: rho je Spiel kann sich gar nicht ändern

Innerhalb EINES Rennens ist jede monotone Umformung der Zielzeit-Reihenfolge (Rangpunkte,
Zeit-Minus, Margin-Punkte, …) exakt dieselbe Rangfolge — Spearmans rho hängt nur vom Rang ab, nicht
vom Maßstab. **rho je Spiel — die CLAUDE.md-Abnahmezahl — ist für JEDE Margin-basierte Neufassung
der Individual-PP mathematisch identisch zur heutigen Rangpunkte-Fassung**, solange es (praktisch
nie) keine exakten Zeitgleichstände gibt. Nachgemessen (Prototyp unten bestätigt es): 0,923/0,924 —
innerhalb der Kaderfamilien-Spannweite (0,064), nicht unterscheidbar von Null Bewegung. rho Saison
(mittelt über viele Rennen, dort GILT die Invarianz nicht zwingend, s. Jensen) blieb in jedem
geprüften Prototyp ebenfalls unverändert bis leicht verbessert (0,902 → 0,902…0,916). **Die
rho-Schranke ist für diese Änderungsklasse kein Risiko.**

### 2.3 Die eigentliche Gefahr: Pp-Abweichung, nicht rho

Drei Prototypen, je zwei unabhängige Saatstreme (`--saat-versatz=0` / `10000000`), gemessen mit
`node scripts/messe-arena-einfluss.mjs time-trial 48`. Basislinie (heutiges `main`, reine
Rangpunkte) zuerst:

| Fassung | Pp-Abweichung, Saatstrom 1 | Pp-Abweichung, Saatstrom 2 | rho je Spiel |
|---|---:|---:|---:|
| **Basislinie (main, Rangpunkte)** | 22,8 | 24,2 | 0,923 |
| A — linear nach Zeitabstand (Anker N…1 wie bisher, Zwischenschritte proportional zum Zeitabstand zum Feld) | 25,5 | 25,9 | 0,924 |
| B — wie A, aber Wurzel-gedämpft (`sqrt(Abstand)` statt linear — sollte große Ausreißer dämpfen) | 29,9 | — (nicht weiter verfolgt, schon schlechter als A) | — |
| C — 50/50-Mischung Rangpunkte/Margin-Punkte (A) | 24,3 | 25,3 | 0,923 |
| D — 25/75-Mischung (25 % Margin) | 23,5 | 24,6 | 0,923 |
| E — 15/85-Mischung (15 % Margin) | 23,4 | 24,7 | 0,923 |

**Die Schranke (≤25) ist knapper, als man bei einer rein ordnungstreuen Änderung erwarten würde —
und sie reißt bei der naheliegendsten Fassung (A, linear) auf beiden Saatströmen.** Grund,
aufgeschlüsselt nach Attribut (A, Saatstrom 1): Stamina springt von +9,1 Pp (Basislinie) auf +9,5,
Dexterity (das mit 25 am schwersten gewichtete Attribut der Matrix) von −4,8 auf −5,0. **Große
Zeitabstände entstehen überproportional durch Reserve-Einbrüche (STEHEN/Stamina), nicht durch die
volle, matrixgewichtete Fähigkeiten-Mischung** — ein knapper Vorsprung zwischen zwei starken Fahrern
(Dexterity/Speed-getrieben) bleibt klein, ein Einbruch (Stamina-getrieben) reißt die Lücke groß auf.
Eine margin-gewichtete PP belohnt deshalb genau den Kanal stärker, der laut Eignungsmatrix am
wenigsten zählen soll (Stamina: 15 von 100 Budget-Punkten), und drückt den am schwersten gewichteten
(Dexterity: 25) weiter unter sein Gewicht. **Die Wurzel-Dämpfung (B) macht es — kontraintuitiv —
schlechter, nicht besser**, weil sie gerade die KLEINEN, meist zufälligen Abstände im engen Feld
zusätzlich aufbläst (die Steigung von `sqrt(x)` ist bei `x→0` am steilsten) und damit Rauschen statt
Signal verstärkt.

Die gedämpften Mischungen (C/D/E) bleiben zwar unter 25 — aber mit sehr wenig Puffer (0,3–1,5 Pp auf
dem schwächeren Saatstrom), bei einer Basislinie, die selbst schon nur 0,8–2,2 Pp Puffer hat. **Der
begrenzende Faktor ist nicht die Margin-Idee selbst, sondern dass Time-Trials Rezept schon heute
nahe an der 25-Pp-Decke sitzt** (Stamina-Überschuss von knapp +9 Pp ist in JEDER gemessenen Fassung
— auch der Basislinie — der größte Einzelposten). Eine margin-sensitive PP, so klein ihr Anteil auch
gewählt wird, verbraucht einen Teil dieses ohnehin knappen Puffers, weil sie zwangsläufig den
Stamina-getriebenen Einbruch-Kanal stärker gewichtet als jeden anderen.

### 2.4 Warum hier nicht gebaut wird

1. **Kein sauberer, komfortabler Sicherheitsabstand gefunden.** Jede geprüfte Fassung, die
   überhaupt noch spürbar nach Zeit differenziert (A, C), reißt auf mindestens einem Saatstrom die
   25-Pp-Schranke oder bleibt nur hauchdünn darunter (D, E) — keine ist eine Fassung, die man ohne
   Bauchschmerzen „einfach so" verdrahtet.
2. **Zwei zusätzliche Baustellen, die eine echte Produktionsänderung braucht, nicht nur die
   Formel:** die PPS-Referenz (`data/generated/time-trial-pps-referenz.json`, `iMittel`/`iKrass`)
   ist gegen die HEUTIGE Rangpunkte-Verteilung gezogen (`scripts/ziehe-...-pps-referenz.ts`) — eine
   andere Verteilungsform (margin-basiert hat mehr Varianz am Rand, weniger in der Mitte) verlangt
   nach eigenem Ermessen eine neue Ziehung, nicht nur eine neue Formel in `bahnRangliste()`.
   Ebenso müsste `MOTOREN["time-trial"].wert()` dieselbe Formel übernehmen (s. 2.1), damit die
   CLAUDE.md-Pflichtsonde weiter das misst, was wirklich ausgezahlt wird.
3. **Das Projekt selbst hat diesen Punkt als Klasse B mit eigener Recherche-/Maßrunde markiert**
   (`docs/design/chris-feedback-breite-runde-13-10.md`, Punkt 4) — nicht „sofort umsetzen", sondern
   „festhalten als Todo". Eine naive Umsetzung in diesem Rahmen würde genau die Abkürzung nehmen,
   vor der CLAUDE.md warnt: eine Pp-Pflichtprüfung, die gerade noch so besteht, ist kein Ersatz für
   echten Puffer.

### 2.5 Empfehlung für die nächste Runde

- **Erst den Stamina-Überschuss im bestehenden Rangpunkte-Rezept angehen** (knapp +9 Pp auf JEDEM
  Saatstrom, unabhängig vom hier geprüften PP-Modell) — das schafft den Puffer, den eine
  margin-sensitive PP danach braucht, ohne über die Schranke zu laufen. Ansatzpunkt: dieselbe
  Budget-Methode wie bei Climbing (16.09.) — `einflussVon`/`messe-arena-einfluss.mjs` zeigen genau,
  welcher Subskill (ENDTEMPO/STEHEN tragen Stamina heute mehrfach) zu stark bindet.
- **Danach die Margin-Formel mit kleinem Anteil (Prototyp D/E, 15–25 % Margin, 75–85 % Rangpunkte)
  erneut messen** — sie ist fertig geprüft (dieser Abschnitt), braucht nur den frei gewordenen
  Puffer. Die Formel selbst (Anker N…1 wie heute, Zwischenschritte linear nach Zeitabstand zum
  Feld, s. Prototyp A/D/E oben) ist implementierungsreif, sobald Schritt 1 steht.
- **Dann** `bahnRangliste()`, `MOTOREN["time-trial"].wert()` UND die PPS-Referenz gemeinsam
  aktualisieren (nie nur eine der drei) und mit zwei Saatströmen final abnehmen.

---

## 3. CLAUDE.md-Abnahme dieses PRs

**ZF2 (Abschnitt 1) ist Klasse A — keine rho/Pp-Messung fällig,** exakt wie ZF1: kein `rr()`, kein
neuer Einfluss auf `score`/`rank`/`displayScore`, nur eine zusätzliche Zeichenvariable mit
deterministischem, bereits vorhandenem Feld (`laneIdx`) als Quelle. Geprüft: `tsc --noEmit` ohne
neue Fehler, `eslint` ohne neue Warnungen, bestehender Terrain-Test grün, Sichtprüfung per
Playwright/`/dev-arena` (Abschnitt 1.4).

**Die PP-Zeit-Frage (Abschnitt 2) bleibt unverändert auf `main`** — kein Code-Diff in
`public/mockups/battle-mode.engine.js`, `lib/resolve/battle-mode-arena-team-points.ts` oder
`data/generated/time-trial-pps-referenz.json`. Alle Prototyp-Messungen liefen isoliert, mit
Revert vor diesem Commit (`git checkout -- public/mockups/battle-mode.engine.js`).
