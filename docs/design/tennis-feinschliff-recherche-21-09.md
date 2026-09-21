# Tennis-Feinschliff — Recherche für den nächsten Bauauftrag (21.09.)

**Reine Recherche, kein Code geändert.** Auftrag: herausfinden, welche der K/A/M-Teilkriterien
(Methode aus `docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md` Abschnitt 0,
Zeile 909-954) für Tennis noch offen sind, mit konkreten Codebelegen statt Vermutung, und für jedes
offene Kriterium einen kleinen, rho-sicheren Umsetzungsvorschlag vorzubereiten.

**Ausgangslage (Zeile 1018 der großen Tabelle):** Tennis — Konzept 75 %, Assets 70 %, Gameplay
90 %, Movement 50 %, Gesamt 71 %, rho 0,825 (kaderfest, `BUEHNE_ART.tennis`,
`public/mockups/battle-mode.engine.js:12852-12941`). rho ist bereits gut — **diese Runde ist
ausdrücklich reine Präsentation, `wert()`/die Eignungsformel/das Rezept werden nicht angefasst.**

---

## 1. Konzept (75 % = K1 + K3 + K4 erfüllt, K2 offen)

| # | Kriterium | Status | Beleg |
|---|---|---|---|
| K1 | Eigenes, aus der eigenen MATRIX abgeleitetes Rezept | **erfüllt** | `BUEHNE_ART.tennis.rezept` (`engine.js:12933-12941`) ist eine eigens gegen `BASIS_JE_DISC.tennis` (`engine.js:4862`) nachgezogene Kalibrierung („TENNIS-EIGENE KALIBRIERUNG", `engine.js:12879-12932`), rho 0,786→0,825, drei benannte Attribut-Korrekturen mit Begründung |
| K2 | Eigene Mechanik über das Chassis hinaus | **offen** | `BUEHNE_ART.tennis` trägt `duell:true` — dieselbe, geteilte Speed-Schach-Mechanik, nicht ein eigener Ballwechsel-Rechner. Explizit gegengeprüft im Tracking-Dokument, **zweimal**: Zeile 1806-1807 („Die Mechanik selbst ist aber Speed-Schachs `duell:true`, kein eigener Ballwechsel-Rechner") und Zeile 28-31 (**„Tennis-Präzedenz": „K2 trotz eigenem Zeichenzweig unbewegt, weil ‚die Mechanik selbst' unverändert bleibt"**) |
| K3 | Eigenes Fable-/Design-Dokument | **erfüllt (geteilt, aber mit eigenem Abschnitt)** | `docs/design/tennis-fechten-rollout-plan.md` (Abschnitt A.3/A.5, tennis-spezifisch) + `docs/design/tennis-fechten-buehne-umsetzung.md` — dasselbe Doppel-Dokument, das Fechten zum selben Zeitpunkt K3 einbrachte (Fechtens Zeile nennt explizit nur K4 als offen, also müssen K1-K3 dort erfüllt sein, exakt dieselben Dokumente) |
| K4 | Rezept nachweislich kalibriert, Designfragen entschieden | **erfüllt** | Die 07.09.-Kalibrierungsrunde ist eine „NACHGEZOGEN"-Runde im Sinn der Definition (drei benannte Attribut-Fehlstellen behoben, dokumentiert mit Vorher/Nachher-rho), klärt die Schranke (0,825 > 0,80, Puffer 0,025 über dem Kaderrauschen 0,21, `engine.js:12921-12924`) |

**Fazit Konzept:** Das einzige offene Kriterium ist **K2**, und es ist **strukturell nicht durch
Präsentationsarbeit schließbar** — das ist keine Vermutung, sondern am Wettessen-Präzedenzfall im
Tracking-Dokument exakt an Tennis festgemacht (Zeile 30: „genau die Tennis-Präzedenz"). Eine eigene
`stepTennis()`-Zustandsmaschine (s. Abschnitt 3) hilft M2, bewegt K2 aber nicht — das wäre erst der
Fall, wenn die Punktevergabe selbst über einen eigenen, interaktiven Ballwechsel-Rechner liefe statt
über das geteilte `duell:true`. Das ist echte Mechanik-/Balance-Arbeit und gehört **nicht** in diese
Runde.

---

## 2. Assets (70 % — A2/A3 erfüllt, A4 offen, A1 vermutlich schon erfüllt)

| # | Kriterium | Status | Beleg |
|---|---|---|---|
| A1 (30) | Eigene, nicht-generische Feld-Datei im produktiven Renderer | **im Code bereits erfüllt, in der Tabelle nicht sauber nachvollziehbar** | `app/foundation/discipline-stage/arena/disciplines/tennis.tsx` (424 Z.) ist ein eigenständiges, bespoke „Grand-Slam-Court"-Rework (Kopfkommentar: „BESPOKE · REWORK"), seit Commit `a7ce4bac` „Tennis: komplettes Rework auf waagerechte Grand-Slam-Bahn" — nicht die generische Buehnen-Zwei-Reihen-Darstellung. Die Arithmetik der Tabelle (70 % Assets bei A2+A3 laut Text beide „erfüllt" = 50, A4=0) geht nur mit A1≈20/30 auf, was der Beleglage widerspricht. **Kein Bau-Task**, nur eine mögliche Bucharbeitskorrektur im Tracking-Dokument |
| A2 (25) | Eigene Szene im Mockup-Motor | **erfüllt** | `zeichneTennis()` (`engine.js:15606-15680`), exklusiv auf `art.tennis` gegated (`engine.js:15474`: `if(art.tennis){ zeichneTennis(art); return; }`) — eigener Zweig statt des geteilten Duell-Zweigs |
| A3 (25) | Disziplinrichtige Requisite | **erfüllt** | `DISZIPLIN_PROP.tennis` (`engine.js:2972`) mit `TENNIS_HAND`/`TENNIS_PHASEN`/`zeichneSchlaeger` (`engine.js:2628-2643`) — Schläger statt vorher `null`/Zufallswaffe |
| A4 (20) | Ton, Musik, Kulisse | **offen, vollständig** | `TON_KATALOG` (`engine.js:21974 ff.`) hat **keinen** `tennis`-Eintrag (gegengeprüft: der Schlüssel fehlt komplett, nicht nur ohne Aufrufstellen wie bei Football/Time-Trial/Spurt/Fechten vor deren Fix). Kein `sfx("tennis",…)`-Aufruf im ganzen Motor (grep leer) |

**Fazit Assets:** Die einzige klar offene, bau-relevante Lücke ist **A4 (Ton)** — vollständige
Leere, kein Katalogeintrag, kein Aufrufer.

### Vorschlag A4
Muster: `TON_KATALOG.fechten` (`engine.js:22067-22073`):
```js
tennis:{
  aufschlag: {synth:(vol)=>tonKlick(vol,2600,0.05)},
  ass:       {synth:(vol)=>{ tonDoppelton(vol,700,1050,0.28); }},
  netz:      {synth:(vol)=>tonBuzzer(vol,0.2)},
  publikum:  {loop:true, synth:(vol)=>tonRauschen(vol,500,0,true)}
},
```
Aufrufstellen direkt in der bereits vorhandenen Enthüllungs-Erkennung von `zeichneTennis()`
(`engine.js:15647-15665`, wo `treffer=!!r&&r.ereignis===art.erfolgWort` schon berechnet wird):
`sfx("tennis","ass")` bei `treffer`, `sfx("tennis","netz")` beim Fehlschlag, `sfx("tennis",
"aufschlag")` beim frischen `schlaeger`-Fund. Publikums-Loop nach dem Schach-/Eiskunstlauf-/
Showcase-Muster (`tennisPublikumAn`-Flag + `tonLoopStart("tennis")`, z. B. `engine.js:15120`/
`15393`/`15165` als Vorlage) beim Betreten von `zeichneTennis()`. `sfx()` ist beweisbar
seiteneffektfrei für Spielzustand (`engine.js:22172-22192`: try/catch, liest nur `TON_KATALOG`,
schreibt nur `Audio`/Synth-Ausgabe) — **kein rho-Risiko**.

---

## 3. Movement (dokumentiert 50 % — M1/M4 erfüllt, M2 offen, **M3 vermutlich bereits erfüllt**)

| # | Kriterium | Status laut Tabelle | Tatsächlicher Codebefund |
|---|---|---|---|
| M1 (35) | Eigene Zeichenfunktion im Mockup-Motor | erfüllt | `zeichneTennis()`, s. oben |
| M2 (25) | Eigene Bewegungs-/Schrittlogik (`step*`) | **offen** | Kein `stepTennis()` im gesamten Motor (grep leer). Der Ballfortschritt in `zeichneTennis()` liest `u.lunge` direkt inline (`engine.js:15655`: `const u01=Math.min(1,Math.max(0,1-schlaeger.lunge/0.5))`) — keine eigene Zustandsmaschine, nur eine Ableitung aus einem generischen Feld |
| M3 (25) | Sichtbare Animation in der PRODUKTIVEN React-Bühne | **als offen geführt (50 % = 35+15), Codebefund widerspricht dem** | `tennis.tsx` hat eine **eigene FX-Schicht** oberhalb des geteilten `useTokenGlide`/`GhostLayer`/`TokenChrome`-Bausatzes: `fireShot()`/`ace()`/`netRoller()` mit eigenen SVG-Elementen und eigenen CSS-Keyframes (`tfxBall`/`tfxPoof`/`tfxPop`, `tennis.tsx:294-301`), ein eigener `rallyRef`-Ballwechsel per Ping-Pong zwischen Führer/Verfolger (`tennis.tsx:234-258`) — **genau der Maßstab, den das Tracking-Dokument selbst für volle M3-Punktzahl nennt** (Fechtens `lamps.tsx`: „eigene Touché-FX-Schicht: Ausfall-Lunge, Treffer-Melder, kreuzende Klingen mit Klirr-Funke", Zeile 456-458, 766-770 — strukturell identisch zu Tennis' Ass/Netzroller-FX) |
| M4 (15) | Disziplineigene Posen/FX an den Sprites | erfüllt | Ausholpose bei `u.lunge>0` über `TENNIS_PHASEN` (`engine.js:2633-2643`) |

**Wichtigster Befund dieser Recherche:** Die Tabelle führt Movement mit 50 % (= M1+M4, 35+15),
was M2=0 **und** M3=0 voraussetzt. Der Code zeigt aber, dass `tennis.tsx` bereits seit Commit
`a7ce4bac` („Tennis: komplettes Rework auf waagerechte Grand-Slam-Bahn", vor dem 09.09.-Basisstand
dieses Tracking-Dokuments) eine bespoke FX-Schicht trägt, die nach der im selben Dokument für
Fechten verwendeten Elle **voll** zählen müsste. Das Dokument hat die Tennis-Zeile nie explizit
gegen die produktive Datei geprüft (anders als bei Fechten/Climbing/Spurt/Time-Trial, wo jeweils
ausdrücklich vermerkt ist „A1 und M3 waren schon VOR PR … voll erfüllt und sind von ihr nicht
berührt — ausdrücklich gegen die PRODUKTIVE Datei geprüft"). Für Tennis fehlt dieser Satz komplett
— es sieht nach einer schlicht nie durchgeführten Prüfung aus, nicht nach einem bewussten Befund.

**Empfehlung:** Vor dem Bau-PR einmal kurz mit den bestehenden Maßstäben gegenprüfen (fünf Minuten,
kein Code) und die Tabelle ggf. korrigieren (Movement 50→75, M3 25 statt 0, Gesamt entsprechend
höher). Das ist **keine Bauaufgabe** — der Code existiert schon.

**Damit bleibt als tatsächlich zu bauendes Movement-Kriterium nur M2.**

### Vorschlag M2
Vorbild `stepFechten()` (`engine.js:14896-14954`) — **derselbe „harte Vertrag"**, wörtlich aus dem
Kommentar dort (`engine.js:14868-14873`): niemals `rr()`, niemals `u.summe`/`u.runden`/
`u.aktuell`/`u.vorteil`/`u.zweikampf`/`u.lunge`/`buehneAkt`/`buehneZeiger`/`done` anfassen — nur
neue, rein präsentationale `viz*`-Felder.

Skizze `stepTennis(dt,art)`:
- Zustände auf `u.vizSchlagPhase`: `"bereit"` (Default) → `"ausholen"` (kurz nach frischer
  Enthüllung, erkannt wie bei `stepFechten()` über einen `u.vizSchlagAktuell`-Vergleich gegen
  `u.aktuell`) → `"treffer"`/`"fehlschlag"` (abhängig von `r.ereignis===art.erfolgWort`, exakt das
  Feld, das `zeichneTennis()` heute schon liest) → `"erholen"` → zurück zu `"bereit"`.
- `u.vizSchlagT` als Phasenuhr (Vorbild `u.vizFechtT`).
- `zeichneTennis()` liest künftig `u.vizSchlagPhase`/`u.vizSchlagT` statt `u.lunge` direkt zu
  interpolieren — der Ballflug selbst (`fireShot`-Äquivalent im Mockup) kann unverändert bleiben,
  nur seine Quelle wandert von einer inline-Ableitung in eine echte Zustandsmaschine.
- Ergänzend ein kleiner „Anti-Freeze"-Wipper wie `u.vizFechtBounceT`, falls wartende Spieler sonst
  einfrieren (an derselben Stelle wie bei Fechten begründet, `engine.js:14889-14893`).

Das erfüllt M2 exakt nach Definition („eigene Bewegungs-/Schrittlogik, `step*`-Sonderfälle,
Zustandsmaschine") und ändert an `wert()`/Rezept nichts — dieselbe strukturelle Garantie, die
`zeichneTennis()` für A2/A3 schon dokumentiert (`engine.js:15599-15605`: „kein neuer
`buehnenBewegung()`-Zweig, kein neues Feld auf `u`, `rr()` wird nirgends aufgerufen").

---

## 4. Umsetzungsschnitt — eine PR oder aufteilen?

**Ein PR ist machbar und sinnvoll für M2 + A4 zusammen.** Beide sind klein (stepTennis() nach
exaktem Fechten-Vorbild ~60-100 Zeilen, TON_KATALOG.tennis + drei Aufrufstellen ~20 Zeilen), beide
sind beweisbar rho-neutral (siehe Abschnitt 5), und die Ton-Aufrufstellen passen inhaltlich genau an
die Phasenübergänge, die `stepTennis()` ohnehin einführt (Aufschlag-Ton bei „bereit→ausholen",
Ass/Netz-Ton bei „treffer"/„fehlschlag") — getrennt bauen hieße, dieselbe Stelle zweimal anzufassen.
Genau dieses Muster (eigene Zustandsmaschine + Ton in einem Rutsch) hat PR #945/#946 bei Fechten
schon so gemacht.

**K2 gehört NICHT in diesen PR.** Es ist keine Präsentationsarbeit, sondern verlangt einen
eigenen, interaktiven Ballwechsel-Rechner statt des geteilten `duell:true` — echte Mechanik-/
Balance-Änderung mit Pflicht zur Neumessung (`node scripts/miss-alle-disziplinen.mjs 24 tennis`)
vor jedem Merge, weil der bestehende Puffer (0,025 über dem Kaderrauschen 0,21) dünn ist. Das
gehört in eine eigene, klar als Mechanik-Runde deklarierte PR, wenn Chris das priorisiert.

**Die M3-Frage braucht gar keinen Code** — nur eine Prüfung/Korrektur des Tracking-Dokuments, kann
parallel oder vor dem Bau-PR passieren, ohne ihn zu blockieren.

**Erwarteter Effekt des einen PRs (M2+A4):** Assets 70→90 (A4 voll), Movement 50→75 (M2 voll,
sofern M3 in der Tabelle weiterhin bei 0 gefuehrt wird) bzw. →100 (falls die M3-Korrektur vorher
oder gleichzeitig passiert). Konzept/Gameplay bleiben unangetastet (75/90). Gesamt stiege von 71 %
auf rund 84-89 %, je nach M3-Behandlung.

---

## 5. rho-Sicherheit — explizite Bestätigung

**Keine der vorgeschlagenen Änderungen (TON_KATALOG.tennis + sfx-Aufrufe, stepTennis()) berührt
`wert()`, `BUEHNE_ART.tennis.rezept` oder eines der mechanikrelevanten Felder
(`u.summe`/`u.runden`/`u.aktuell`/`u.vorteil`/`u.zweikampf`/`u.lunge`/`buehneAkt`/`buehneZeiger`/
`done`/`rr()`).** Beleg:

1. `sfx()` selbst ist strukturell seiteneffektfrei für Spielzustand: es liest nur `TON_KATALOG`
   und schreibt nur `Audio`/Web-Audio-Ausgabe, komplett try/catch-umschlossen (`engine.js:22172-
   22192`). Das ist dieselbe Funktion, die bei Fechten/Hockey/Speed-Schach/Eiskunstlauf/Staffel/
   Gewichtheben/Breaking/Takeshi bereits produktiv läuft, ohne je eine rho-Zahl bewegt zu haben.
2. `stepTennis()` nach dem `stepFechten()`-Vorbild folgt demselben, im Code wörtlich benannten
   „harten Vertrag" (`engine.js:14868-14873`), der ausdrücklich verbietet, irgendeines der
   mechanikrelevanten Felder anzufassen — nur neue `viz*`-Felder. Genau dieses Muster hat bei
   Fechten, Schach, Wettessen und Showcase nachweislich **bit-identisches** rho durch die
   entsprechenden PRs gebracht (jeweils explizit vermerkt: „rho bit-identisch").
3. Einziges Risiko im gesamten Bericht ist **K2**, und das ist ausdrücklich **kein Teil dieses
   Vorschlags** — es würde die Mechanik selbst ändern und ist bewusst ausgeklammert (Abschnitt 4).

**Ergebnis: Für den hier vorgeschlagenen Umfang (A4 + M2) ist die rho-Sicherheit bestätigt, nicht
nur behauptet — sie folgt strukturell aus denselben Verträgen, die für alle bereits gebauten
Geschwister-Disziplinen (Fechten, Speed-Schach, Wettessen, Showcase) schon nachgewiesen sind.**
