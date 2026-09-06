# Football: Bewegung/Kollision/Yard-Zahlen — Chris' Fund vom 06.09., empirisch nachgeprüft

Stand 06.09.2026, Branch `claude/football-bewegung-kollision-fix-06-09`, abgezweigt von
`origin/main` (9036cef3). Auftragsgrundlage: Chris' Meldung, wörtlich: „football bewegt sich
nicht dynamisch, die yard linien und zahlen fehlen komplett die spielzüge sind 'ruckelig' der
ball wird geworfen, es wird nciht geblockt, keiner bewegt sich keiner veruscht zu tacklen usw —
da ist noch viel NFL arbeit notwendig schau dir das bitte im UI an und fixe das entsprechend
dass sich bewegt wird wie bei basketball auch mit kollisionsabfragen usw".

`engine.js` meint `public/mockups/battle-mode.engine.js`. Football bleibt Mockup —
`ARENA_RESOLVED_DISCIPLINE_IDS` (`lib/resolve/battle-mode-arena-team-points.ts`) enthält
weiterhin nur `basketball/gewichtheben/hockey/speed-schach/showcase`, kein `football` — der
CI-grüne Standardmaßstab gilt, keine Produktionscode-Sonderprüfung. Trotzdem mit derselben
Rangtreue-Sorgfalt gemessen wie eine Produktionsänderung, weil Bewegung/Kollision anders als
eine rein kosmetische Pacing-Änderung tatsächlich beeinflussen KÖNNTE, wer ein Spiel gewinnt.

---

## 0. Ergebnis vorab

**Erst geschaut, dann Code gelesen** (Chris' ausdrücklicher Auftrag). Playwright-Screenshots
über 35s echte Spielzeit auf dem UNVERÄNDERTEN `origin/main`-Stand bestätigten VIER von Chris'
fünf Punkten wortwörtlich, einen davon dramatisch: zwischen t=5s und t=18s (13 Sekunden, mehrere
Snaps) bewegte sich buchstäblich **kein einziger der zwölf Feldspieler um auch nur einen
Pixel** — nur ein kleiner Ballpunkt driftete leicht. Yard-Zahlen fehlten tatsächlich komplett
(die Linien selbst standen, aber nie eine „10/20/30…"-Beschriftung). Beides jetzt behoben, mit
Vorher/Nachher-Bildern unten. Rangtreue (`node scripts/miss-alle-disziplinen.mjs`) bit-identisch
vor/nach dem Fix — die Änderung ist rein an der Zeichenschicht, berührt keine
Wahrscheinlichkeit/Yards-Formel.

| Chris' Punkt | Empirisch bestätigt? | Ursache |
|---|---|---|
| „bewegt sich nicht dynamisch" | Ja, wortwörtlich — 0px Bewegung über 13s | `stehtStill` hielt ALLE 12 Spieler für die GESAMTE Snap-Formation-Zug-Nachlauf-Dauer fest, nicht nur die 0,9s-Formationsphase |
| „yard linien und zahlen fehlen komplett" | Zahlen ja, Linien nein (standen schon, nur unauffällig) | Zahlen-Rendering war schlicht nie gebaut worden |
| „spielzüge sind ruckelig" | Ja, Folge von Punkt 1 | Formationswechsel zwischen weit auseinanderliegenden Line-of-Scrimmage-Positionen sprangen hart, kein Spieler bewegte sich dazwischen |
| „es wird nicht geblockt" | Ja | Keine Blocking-Logik/-Bewegung existierte, auch nicht ansatzweise |
| „keiner bewegt sich, keiner versucht zu tackeln" | Ja, wortwörtlich | Dieselbe `stehtStill`-Ursache — Verteidiger hatten während des gesamten Zugs kein eigenes Ziel |

## 1. Warum das eine Überraschung sein durfte, aber keine ist

`docs/design/football-live-migration.md` und `docs/design/football-zufriedenstellend.md`
(beide vom 03./04.09.) hatten Football bereits zweimal visuell im echten UI geprüft und
dokumentierten dabei ausdrücklich: „Football bleibt für die GESAMTE Snap-bis-Ergebnis-Dauer in
dieser Standphase (kein Dribbeln/Freilaufen zwischen Formation und Spielzug-Ausgang) — nur der
Ball bewegt sich" (engine.js-Kommentar, unverändert seit der Migrationsrunde). Das war **keine
übersehene Regression, sondern eine bewusste, dokumentierte Design-Entscheidung** — gegen einen
echten, damals gefundenen Klumpen-Bug: mit dem normalen Lauftempo erreichte niemand die neue
Formation, bevor der nächste Snap (alle 2,4-3,2s) schon wieder eine andere Line of Scrimmage
vorgab, weil diese von Snap zu Snap um hunderte Pixel wandern kann (anders als Basketballs
lokaler Freiwurf-Wiederanlauf).

Die Entscheidung hat aber mehr eingefroren, als der Klumpen-Bug erforderte: sie hat nicht nur
den einen problematischen **Sprint zwischen zwei Downs** verhindert, sondern **jede Bewegung
während der eigentlichen Spielzug-Ausführung selbst** mitgenommen — genau der Teil, in dem
Chris jetzt Blocken/Tackling/Dynamik vermisst. Die beiden früheren Berichte haben das nicht als
Mangel erkannt, weil ihre eigene Abnahme („Formationen klar zweigeteilt", „Ball fliegt sichtbar
weit") genau das prüfte, was funktionierte (Formationsaufstellung, Ballanimation) — nicht die
Spielerbewegung während des Zugs, die es schlicht nicht gab. Kein Widerspruch zu den früheren
Berichten, sondern eine Lücke, die erst mit Chris' neuem, spezifischeren Blick auffiel.

## 2. Vorher — empirisch, nicht vermutet

Playwright, `public/mockups/battle-mode.html`, `window.__arena.setDisc("football")`, Tab 2
(Arena), Play, Screenshots bei 1/3/5/8/12/18/25/35s auf dem unveränderten `origin/main`-Stand
(9036cef3):

- **t=5s bis t=18s (13 Sekunden, mehrere Snaps dazwischen): pixelgenau identische
  Spielerpositionen.** Nur ein kleiner Ballmarker bewegte sich minimal.
- **t=25s: ein Klumpen aus allen zwölf Figuren** dicht am linken Feldrand (Line of Scrimmage
  nahe der eigenen Torlinie) — bekannter, vorbestehender Formations-Kompressions-Effekt (s.
  Abschnitt 6, nicht Teil dieser Runde behoben).
- **Keine Yard-Zahlen** in keinem der acht Screenshots — nur die (schon vorhandenen) dünnen
  vertikalen Linien.

Bilder: `docs/design/football-bewegung-vorher-eingefroren.png` (t=8s),
`docs/design/football-yardzahlen-vorher.png` (t=5s).

## 3. Root Cause im Code

`bewegeSpielerLive()`, `stehtStill`-Zweig (engine.js, vor dem Fix):

```js
const stehtStill=fsLive.phase==="freiwurf"||fsLive.phase==="snap";
if(stehtStill){
  const p=fsLive.phase==="snap"?(fsLive.snap&&fsLive.snap.plaetze[u.id]):fsLive.freiwurf.plaetze[u.id];
  if(p){ zx=p.x; zy=p.y; }
}
```

`fsLive.phase==="snap"` bleibt für ALLE drei Snap-Teilphasen wahr (`stepSnapPhase`:
`"formation"` 0,9s → `"zug"` 0,8-1,6s je Spielzugtyp → `"nach"` 0,6s) — der Zweig setzt in
JEDER davon das Ziel jedes Spielers stur auf die beim Snap-Beginn gewürfelte Formationsposition
zurück, unabhängig vom tatsächlichen Spielzug-Fortschritt. Football läuft (anders als
Basketball/Hockey) nicht über `entscheideBallaktion` — es gibt für Football also **an keiner
Stelle im Motor** eine zweite Logik, die während „zug" ein bewegendes Ziel liefern könnte.
Yard-Zahlen: schlicht nie geschrieben — `bodenFeldspiel()`s Football-Zweig zeichnete Endzonen,
Yard-Linien und Mittellinie, aber nirgends eine Zahl (kein `ctx.fillText` im gesamten
Football-Rendering-Pfad).

## 4. Fix

**Yard-Zahlen** (`bodenFeldspiel()`): an jeder der neun Zehn-Yard-Linien die reale
NFL-Zählweise (10/20/30/40/50/40/30/20/10, aufsteigend zur Mittellinie), einmal nah an jeder
Seitenlinie — sechs Zeilen, kein Bezug zu Mechanik/Rangtreue.

**Bewegung** (`bewegeSpielerLive`, neue Funktionen `fkZugPosition`/`fkGegenpart`/
`fkEngageZiel`/`fkZugZielX`): die `"formation"`-Teilphase bleibt UNVERÄNDERT hart eingefroren
(verhindert weiter den Klumpen-Bug). Während `"zug"` und `"nach"` liefert `fkZugPosition` ein
echtes, sich veränderndes Ziel:

- **Ballführer/Receiver** (`erg.spieler` bei Lauf, `erg.receiver` bei Pass) laufen zum selben
  `sichtYards`/`zielSpot`-Fallback, den `animiereFootballZug()` schon für den Ball selbst nutzt
  (unverändert gelassen, s. `football-zufriedenstellend.md` Abschnitt 4) — Spieler und Ball
  kommen sichtbar am selben Punkt an.
- **Ein Verteidiger** (`erg.verteidiger` — der schon für die Erfolgsformel gezogene
  Gegenspieler aus `resolveLauf`/`resolvePass`, jetzt zusätzlich im Ergebnis-Objekt
  durchgereicht, rein additiv) läuft dem Ziel hinterher und erreicht es am Ende der
  Animation — der sichtbare Tackle-/Deckungsversuch, den Chris einfordert.
- **Bei einem Sack** läuft der Passer das kurze Rückweich-Stück mit, der Rusher schließt zu
  ihm auf.
- **Die übrigen acht Spieler** (an diesem einen Zug nicht direkt beteiligte Linemen/
  Receiver/Defensive Backs) bekommen eine kleine, gegenseitige „Engage"-Bewegung Richtung des
  nach Formationsindex gepaarten Gegenspielers — eine sichtbare Kollisions-/Blockade-Andeutung.

**Bewusst NICHT gebaut** (ehrlich benannt, kein „gelöst und fertig"): eine vollständige
Block-Assignment-KI, die tatsächlich einen Vorteil erspielt (z. B. eine Lücke öffnet, die
Sack-/Tackle-Wahrscheinlichkeit verändert), wäre ein eigenes, deutlich größeres Vorhaben — die
acht „Engage"-Spieler zeigen eine plausible Kollision, entscheiden aber nichts. Alle
Wahrscheinlichkeiten/Yards-Formeln (`resolveLauf`, `resolvePass`, `vollziehFootballErgebnis`)
sind unverändert; die neue Bewegung liest ausschließlich das bereits gewürfelte Ergebnis, ohne
es zu beeinflussen — „gewürfelt früh, angewendet spät", dasselbe Muster wie Basketballs
Freiwurf und wie `animiereFootballZug()` selbst.

**Dieselbe Bewegungs-Infrastruktur wie Basketball**, wie Chris ausdrücklich verlangt hat: kein
zweites System — `fkZugPosition` liefert nur ein Ziel (`zx`/`zy`), das anschließend über
denselben `tempoPx`-Schrittmechanismus (`bewegeSpielerLive`, „TEMPO statt Lerp") angelaufen
wird, den Basketball/Hockey für jede Spielerbewegung nutzen — inklusive derselben Separations-
/Kollisions-Abstoßung (`SEP_RADIUS_STAND`/`SEP_STAERKE_STAND`), die während der Standphase
bereits läuft.

## 5. Nachher — empirisch verifiziert

Dieselbe Playwright-Prozedur, derselbe Kader, auf dem gefixten Stand:

- **Quantitativ** (`fsSpielerPos()` vor/nach einem vollständigen Zug, automatisiert
  gemessen): bei einem `lauf`-Spielzug bewegte sich der am weitesten gelaufene Spieler 161,7px,
  im Mittel über alle zwölf 84,2px. Bei einem `kurz`-Passspielzug 178,6px / 80,5px im Mittel.
  Vorher: 0px über 13 volle Sekunden.
- **Visuell**: `docs/design/football-bewegung-nachher-lauf.png` (t=8s, identischer Zeitpunkt
  wie das Vorher-Bild) zeigt einen Läufer deutlich vom Formations-Klumpen abgesetzt weiter
  downfield, mit einem sichtbar nachrückenden Verteidiger — statt der eingefrorenen Formation
  im Vorher-Bild.
- **Yard-Zahlen**: `docs/design/football-yardzahlen-nachher.png` zeigt die Beschriftung
  10/20/30/40/50/40/30/20/10 klar lesbar oben und unten am Feld.

## 6. Rangtreue — bit-identisch vor/nach dem Fix

`node scripts/miss-alle-disziplinen.mjs 24 football basketball`, einmal auf dem unveränderten
`origin/main` (9036cef3), einmal auf dem gefixten Stand, jeweils frischer Worktree, derselbe
Kader (`live-save`-Kopie):

| Disziplin | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite |
|---|---:|---:|---:|---:|
| basketball (vorher = nachher) | 0,772 | 0,088 | 0,923 | 0,231 |
| football (vorher = nachher) | 0,516 | 0,172 | 0,811 | 0,168 |

**Bit-identisch** — erwartbar, weil kein Codepfad dieser Runde von `resolveLauf`/
`resolvePass`/`vollziehFootballErgebnis` gelesen wird (die neuen `verteidiger`-Felder sind
reine Zusatzangaben, kein bestehender Aufrufer liest sie um). Football bleibt mit 0,516 klar
unter der 0,80-Schranke — **unverändert, nicht Ziel dieser Runde** (die galt schon vor dieser
Änderung als „durchgefallen", s. `football-zufriedenstellend.md` Abschnitt 8, und diese Runde
war ausdrücklich eine Sicht-/Bewegungs-Abnahme, keine dritte Rezept-Kalibrierung). Die
absoluten Zahlen weichen von den älteren Berichten ab (dort 0,460/0,757), weil sich die
`live-save`-Kader-Stichprobe seit dem 04.09. mehrfach geändert hat — die Vorher/Nachher-Zahlen
dieser Runde sind aber auf demselben Kader gemessen und damit direkt vergleichbar.

`node scripts/miss-football-korridor.mjs 24` (nur zur Kontrolle, kein Zielwert dieser Runde):
Completion-Quote 62,0 %, Yards/Attempt 6,35, Sack-Quote 5,0 %, Fumbles verloren/Team 0,48 — alle
im selben Korridor wie vor dieser Runde, keine Abweichung durch die Bewegungsänderung.

## 7. Getestet

- `node --check public/mockups/battle-mode.engine.js`: bestanden.
- `npx eslint public/mockups/battle-mode.engine.js`: 0 Fehler, 45 Warnungen (alle
  vorbestehend, keine neue durch diese Änderung — vorher 46, eine unbenutzte Funktionsvariable
  in `fkGegenpart` entfernt).
- Gezielte Arena-Testdateien (`arena-headless-runner`, `basketball-pps-referenz-drift`,
  `battle-arena-ein-modell-ueberall`, `battle-arena-endscreen-tooltip-wurzel`,
  `battle-arena-heal-attribution`, `battle-arena-rennplan-ansage`,
  `battle-mode-arena-matchday-resolve-e2e`, `battle-mode-arena-team-points`,
  `battle-zielansage-kontrakt`, `leertaste-battle-arena-season-flow`), `--no-file-parallelism`:
  **10 Dateien, 116 Tests, alle bestanden**, 69s.
- `npm test` (volle Suite, isolierter Worktree): s. PR-Bericht für das Ergebnis.

## 8. Was als Nächstes offen bleibt (ausdrücklich NICHT Teil dieser Runde)

1. **Formations-Kompression nahe der eigenen Torlinie** (Abschnitt 2, t=25s-Bild,
   `docs/design/football-formationsklumpen-goalline-bekannt.png`): `fkClamp()` klemmt X/Y
   unabhängig an die Feldgrenzen — steht die Line of Scrimmage nah an einer Torlinie, klemmen
   mehrere unterschiedliche `tiefe`-Slots auf denselben X-Wert, und die Formation kollabiert
   sichtbar. Vorbestehend, durch diese Runde weder verursacht noch behoben — ein sauberer Fix
   müsste die Tiefen-Skala stauchen statt hart abzuschneiden, ein eigener kleiner Auftrag.
2. **Echte Block-Assignment-KI.** Diese Runde zeigt eine plausible Kollisions-ANDEUTUNG
   (`fkEngageZiel`), keine Mechanik, die eine Lücke öffnet oder eine Wahrscheinlichkeit
   verändert. Ein „echtes" Blocken (das z. B. die Sack-Chance senkt, wenn die Line gewinnt)
   wäre eine neue Sub-Skill-Verdrahtung (`PASSSCHUTZ` deckt das mechanisch teilweise schon ab,
   s. `resolvePass`) plus eine eigene Kalibrierungsrunde — bewusst nicht in dieser Runde
   begonnen, um die Rangtreue nicht anzufassen, ohne sie zu messen.
3. **Rangtreue-Schranke** (0,516 gegen 0,80 Ziel) bleibt offen — unverändert seit der letzten
   Kalibrierungsrunde, nicht Auftrag dieser Runde.
