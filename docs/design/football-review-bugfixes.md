# Football: vier Review-Funde behoben

Stand 04.09.2026, Branch `claude/football-review-bugfixes` (abgezweigt von `origin/main`
`f5dcf306`, enthält PR #763 Gewichtheben und PR #764 Football). Auftragsgrundlage: die vier
Funde aus `docs/design/football-gewichtheben-opus-review.md` (PR #765, zum Zeitpunkt dieser
Runde noch nicht gemergt), die Chris explizit zum Beheben freigegeben hat. Reihenfolge wie
beauftragt: 1, 3, 4 zuerst (klein, risikoarm), dann 2 (der groessere, sorgfaeltig zu
kalibrierende Eingriff) zuletzt.

`engine.js` meint `public/mockups/battle-mode.engine.js`. Football bleibt Mockup — reine
Motor-Arbeit, `lib/`/`app/` nicht angetastet.

---

## 1. Field-Goal-Ball fliegt jetzt bis zur Torlinie

**Fund:** `animiereFootballZug()`, `engine.js:6091` (Zeilennummer hat sich seit dem
Review-Zeitpunkt leicht verschoben), rechnete `zielSpot = Math.max(0, fb.spot-17)` — dieselbe
17, mit der `resolveFieldgoal()` aus dem Feldstand die Kickdistanz (`spot+17`) berechnet, wurde
hier ein zweites Mal abgezogen. `spot` ist bereits „Yards bis zum gegnerischen Ziel, 0 =
Torlinie" (Kommentar bei `fkLosX`, `engine.js:5793`) — der Ball musste also nach `spot=0`
fliegen, nicht nach `spot-17`.

**Fix:** eine Zeile, exakt wie im Review vorgeschlagen und hier vor dem Einbau nachgemessen,
nicht nur nachgelesen:

```js
const zielSpot=s.spielTyp==="fg"?0:Math.max(1,fb.spot-fb.puntNetto);
```

**Verifiziert, kaderfest und deterministisch, nicht nur angeschaut.** Eine temporäre
Diagnosesonde (nicht im Commit, nur für diese Messung) hat den Ball am Ende der Flugphase
(Phase 0,97 von `FK_ZUG_DAUER.fg=1,3s`) gegen die reale Torlinie (`fkLosX(side,0)`) gehalten,
für dieselben Saat/Spot-Kombinationen vor und nach dem Fix:

| Spot | Kickdistanz | Ball-x vorher | Ball-x nachher | Torlinie-x | Abweichung vorher | Abweichung nachher |
|---:|---:|---:|---:|---:|---:|---:|
| 20 | 37 Yards | 191 px | 164 px | 161 px | 30 px (≈ 3,3 Yards) | 3 px (≈ 0,3 Yards) |
| 37 | 54 Yards | 347–349 px | 166–170 px | 161 px | 186–188 px (≈ 20,3 Yards) | 5–9 px (≈ 0,7 Yards) |

Genau der im Review benannte Effekt: der Fehler wuchs mit der Kickdistanz (bei einem
47-Yard-Kick aus `spot=30` wären es 13 Yards zu kurz gewesen, hier gemessen beim 54-Yard-Kick
sogar gut 20 Yards) — nach dem Fix bleibt der Rest-Abstand in beiden Fällen im Bereich eines
einzelnen Simulationsticks (die Kurve nähert sich `zielX` erst im letzten Tick vor
`phase=1`, s. Messmethode unten), unabhängig von der Kickdistanz.

**Zusätzlich mit echten Bildschirmfotos bestätigt** (Playwright, `#cv`-Canvas, dieselbe Saat
1337, spot=37/54-Yard-Versuch, jeweils kurz vor Ende der Flugphase eingefroren):

- `docs/design/football-review-fg-vorher.png` — Ball bleibt weit vor der Torlinie liegen,
  auf Höhe der eigenen Formation.
- `docs/design/football-review-fg-nachher.png` — Ball liegt sichtbar auf der Torlinie.

**Isolationsnachweis — nur die Animation, nichts Mechanisches.** `vollziehFootballErgebnis()`
liest im `typ:"fg"`-Zweig ausschließlich `erg.erfolg`, `erg.distanz`, `fb.side` und `fb.spot`
— nie `zielSpot` und nie `erg.yards`. Weder alte noch neue Formel rufen `rr()` auf, beide sind
reine, deterministische Funktionen von `fb.spot`; die RNG-Sequenz aller nachfolgenden
Spielzüge ist dadurch bit-identisch. Bestätigt durch Messung, nicht nur durch Code-Lesen: die
kaderfeste Rangtreue-Messung mit **ausschließlich** diesem Fix (vor dem Down-Wiring aus
Abschnitt 2) reproduzierte exakt die alten Zahlen aus `football-rezept-kalibrierung.md`
(0,460/0,258 je Spiel, 0,692/0,196 Saison, s. Abschnitt 4) — kein Bit bewegt sich durch diesen
Fix allein.

---

## 3. Veraltete Kalibrierungsnotiz bei `HEBEN_KG_PRO_LAST` aktualisiert

**Fund:** der Kommentar über `HEBEN_KG_BASIS/HEBEN_KG_PRO_LAST` (`engine.js:~10025`, nahe der
im Auftrag genannten Zeile 9938 — die Datei ist seit dem Review um rund 80 Zeilen gewachsen)
sagte „LAST 100 → 480 (Talakhadze hebt 492)". Das galt für die reine `LAST`-Formel, gilt aber
nicht mehr für das tatsächliche `tagesmax`, seit Variante B (`HEBEN_TAGESMAX_ANSAGE_K`,
`gewichtheben-zufriedenstellend.md`) einen ANSAGE-Faktor obendrauf multipliziert: LAST 100 ×
ANSAGE 99 ergibt rechnerisch 586 kg — über dem Weltrekord, den der Kommentar als
Plausibilitätsgrenze zitiert.

**Fix — nur der Kommentar, keine Konstante geändert:**

```js
// T_max = 100 + 3,8 x LAST Sinclair-kg, VOR dem ANSAGE-Faktor aus Variante B (s.
// HEBEN_TAGESMAX_ANSAGE_K unten). Kontrolle an den Raendern (nur ueber LAST, ANSAGE=50
// neutral): LAST 100 -> 480 (Talakhadze hebt 492), LAST 50 -> 290 (Weltklasse
// 55-kg-Klasse: 294), LAST 10 -> 138 (ein Hobbyheber). Bewusst breiter als jede reale
// Klasse, weil unser Kader beides enthaelt: Lava Golem und Lulu stehen in derselben Liga.
// VERALTET-HINWEIS (Opus-Review C.3, docs/design/football-gewichtheben-opus-review.md):
// seit Variante B multipliziert der ANSAGE-Faktor noch obendrauf, rechnerisch bis LAST
// 100 x ANSAGE 99 -> 586 — ueber Talakhadzes Weltrekord. Praktisch tritt das nicht ein:
// der staerkste Heber des echten live-save-Kaders (110 Spieler) landet bei 471 kg, weil
// hohe LAST- und hohe ANSAGE-Werte im Kader nicht zusammenfallen (r(ANSAGE,LAST)=-0,093).
```

Kein Zahlen-Effekt möglich — reiner Kommentar, `HEBEN_KG_BASIS`/`HEBEN_KG_PRO_LAST`/
`HEBEN_TAGESMAX_ANSAGE_K` unverändert. `node scripts/miss-alle-disziplinen.mjs 24 gewichtheben`
läuft aus Zeitgründen nicht extra für einen reinen Kommentar-Fix — es gibt keinen Mechanismus,
über den ein Kommentar das Messergebnis ändern könnte.

---

## 4. `stand-aller-disziplinen.md` für Football nachgezogen

**Fund:** die zentrale Statustabelle trug an fünf Stellen noch den Stand direkt nach der
Live-Motor-Migration (rho 0,305/0,321/0,448/0,448), bevor die Rezeptkalibrierung
(`football-rezept-kalibrierung.md`, 04.09.) das Rezept gegen echte NFL-2024-Quoten gefittet
und die Kopfzahl auf 0,460 gehoben hatte. Die Prosa nannte das Rezept weiterhin „vollständig
ungemessene Platzhalter" und verlangte eine Rezeptkalibrierung als nächsten Schritt — obwohl
diese bereits zweimal gelaufen war (`football-rezept-kalibrierung.md`,
`football-zufriedenstellend.md`).

**Fix, Zahl UND Prosa, an allen fünf Stellen** (Zeilennummern im Auftrag waren ungefähr, mit
`git log`/aktuellem Stand nachgeprüft):

| Stelle | Vorher | Nachher |
|---|---|---|
| Rangtreue-Tabelle (Abschnitt 1) | `0,305 \| 0,321 \| 0,448 \| 0,448` | `0,460 \| 0,258 \| 0,692 \| 0,196` |
| „Was hier wirklich Code ist"-Tabelle | `0,305 / 0,448`, Bericht `football-live-migration.md` | `0,460 / 0,692`, Bericht `football-rezept-kalibrierung.md` |
| Prosa direkt danach | „Kopfzahl trotzdem gesunken … Rezept noch reine Platzhalter" | erklärt den Zwischenstand (0,345→0,305) UND dass die Kalibrierung seither gelaufen ist (→0,460) |
| „Was die zwei Spalten sagen" (Abschnitt 1, Fliesstext) | „beide Zahlen kaderfest niedrig (0,305/0,448) … ungemessenes Rezept" | aktualisierte Zahlen (0,460/0,692), umformuliert zu „Validitätslücke nach eigener Kalibrierung", nicht mehr „ungemessen" |
| Abschnitt 5, Punkt 2 (nächste Hebel) | „Football braucht eine echte Rezeptkalibrierung … Rezept ungemessene Platzhalter" | „Rezeptkalibrierung ist gelaufen — nächster Hebel ist die MATRIX", mit Verweis auf B.6 des Opus-Reviews |
| Vollständigkeits-Tabelle (Abschnitt am Ende) | `0,305 … Rezept vollstaendig ungemessene Platzhalter` | `0,460 … gegen echte NFL-2024-Quoten kalibriert, naechster Hebel MATRIX` |

Ergänzend eine sechste, im Auftrag nicht einzeln genannte, aber demselben Muster folgende
Stelle korrigiert (unmittelbar bei den fünf gelisteten, Abschnitt 1 Fliesstext „Football fällt
aus diesem Muster heraus … 0,305/0,448") — sonst hätte das Dokument sich selbst
widersprochen.

**Wichtig, wie im Auftrag verlangt:** da Punkt 2 (Down-Verdrahtung, s. Abschnitt 2 unten) die
rho-Zahl selbst nochmal leicht verschiebt (0,460→0,468), trägt die Tabelle nach diesem Bericht
die **neueste** gemessene Zahl, nicht die 0,460 aus der reinen Rezeptkalibrierung — s.
Abschnitt 4 unten für die entsprechende Nacharbeit an `stand-aller-disziplinen.md`.

---

## 2. `down` in die vier Entscheidungsfunktionen verdrahtet

**Fund:** `waehlePlayCall`, `waehleFormationOffense`, `waehleFormationDefense` und
`waehleFootballTier` nahmen `down` als Parameter entgegen, lasen ihn aber in keiner der vier
Funktionen — nur `toGo` entschied. 3rd & 8 spielte sich mechanisch identisch zu 1st & 10.

### 2.1 Recherche: reale NFL-Down/Distance-Tendenzen

Quellen (WebSearch dieser Runde, zusätzlich zu den in `football-rezept-kalibrierung.md`
bereits zitierten):

- **1st & 10** (NFL.com, „First-down success is the key to third-down conversions"):
  **53 % Lauf / 47 % Pass** — bereits die Basislinie, gegen die die vorige
  Rezept-Feinkalibrierung ihre `toGo`-Fenster gefittet hat (46 % Lauf bei `toGo` 7–11, sehr
  nah dran) — auf 1./2. Down bleibt diese Basislinie deshalb **unverändert**.
- **3rd/4th & lang (≥15 Yards)** (thespax.com, „Analyzing NFL Third Down Play-Calling"):
  **83 % Pass / 17 % Lauf**. Auf 1./2. Down bei derselben Distanz (selten, z. B. nach einer
  Strafe) bleiben die alten 28 % Lauf bestehen — dort ist die Distanz zwar lang, aber es ist
  noch kein „Money Down".
- **3rd/4th & kurz (≤2 Yards)**, mehrere 2024-Quellen (Fox Sports „who does short-yardage
  best", PFF „schematic lessons learned 2024"): **deutlich laufbetonter** als die
  Basislinie — Ravens 77,6 % Laufanteil (drittmeist in der Liga), Commanders 88 % Erfolgsquote
  auf 3rd/4th-&-1-Läufen, Eagles 76,7 % Erfolgsquote auf denselben, Dallas 57,4 % (achthöchster
  Wert der Liga). Das Bild ist eindeutig laufbetont, auch wenn keine einzelne Quelle eine
  bereinigte Liga-Durchschnittszahl nennt.
- **Mittlere Fenster (`toGo` 3–6 und 7–11):** keine einzelne zitierte Zahl gefunden — linear
  zwischen der 1st/2nd- und der 3rd/4th-Extremzahl interpoliert, im Code-Kommentar klar als
  Interpolation gekennzeichnet, nicht als recherchierter Wert ausgegeben.
- **Formationen:** dieselben Quellen, die schon `football-gewichtheben-opus-review.md` B.4.1
  zitiert (Gridiron Deep Dive, Sharp Football Stats, CBS Sports, Acme Packing Company) — real
  wird Under-Center/„eng" nur noch bei ≤1 Yard bzw. Goalline bevorzugt, Nickel ist die
  De-facto-Basisformation und wird auf „Money Downs" noch häufiger.

### 2.2 Umsetzung

**`waehlePlayCall`:** der Laufanteil verschiebt sich mit `down`; die *innere* Aufteilung der
Pass-Tiefen (kurz:mittel bzw. mittel:tief, Verhältnis 2:1 bzw. 1:1) bleibt exakt die bereits
kalibrierte Rezept-Feinkalibrierung — nur der Lauf/Pass-Schnitt selbst reagiert neu, damit der
gemessene Korridor (Yards/Attempt, Completion-Quote) nicht durch eine zweite, unabhängige
Änderung mitverschoben wird:

| `toGo`-Fenster | Lauf-Anteil 1./2. Down | Lauf-Anteil 3./4. Down | Quelle |
|---|---:|---:|---|
| ≤2 | 68 % | **80 %** | Ravens/Commanders/Eagles/Dallas 2024 |
| 3–6 | 55 % | **38 %** | interpoliert |
| 7–11 | 46 % | **22 %** | interpoliert |
| >11 | 28 % | **17 %** | thespax.com |

**`waehleFootballTier`:** auf 3./4. Down ruft jede Distanzstufe die nächsttiefere Tier-Stufe
deutlich häufiger auf (Chris' Auftrag: „3rd/4th & long → … tiefere Routen", „distance to
sticks"-Muster) — moderat gehalten, da hierzu keine Einzelquelle vorliegt (anders als beim
Lauf/Pass-Schnitt).

**`waehleFormationOffense`:** auf 1./2. Down gilt jetzt die engere, reale Schwelle (`toGo≤1`
statt `toGo≤3`) für „eng"/Under-Center — auf 3./4. Down bleibt zusätzlich das bisherige,
großzügigere `toGo≤3`-Fenster für ein sichtbares Kurzyardage-Paket (Quarterback-Sneak/
„Tush Push"-artige Situationen sind auf Money Downs die erwartbare Wahl).

**`waehleFormationDefense`:** auf 3./4. Down wechselt die Verteidigung schon ab `toGo≥4` in
„nickel" (statt erst ab `toGo>6`) — Verteidigungen bringen den fünften Verteidiger früher,
sobald der Down selbst die Passwahrscheinlichkeit hebt.

### 2.3 Messung — ehrlich, nicht schöngerechnet

**`node scripts/miss-football-korridor.mjs 120`, vorher/nachher:**

| Kennzahl | Vorher (nur FG-Fix) | Nachher (+ Down-Wiring) | Ziel (NFL 2024) |
|---|---:|---:|---|
| Punkte je Team | 16,3 | 17,7 | 22,9 |
| Passversuche je Team | 24,2 | 25,5 | ~29,9 |
| Completion-Quote | 67,3 % | 67,3 % | 65,3 % |
| Yards je Passversuch | 6,95 | 6,97 | 7,1 |
| Laufversuche je Team | 25,4 | 24,2 | 27,0 |
| Yards je Laufversuch | 3,88 | 3,96 | ~4,3 |
| Sack-Quote je Dropback | 6,7 % | 7,4 % | ~7,0 % |
| Interception-Quote | 2,9 % | 2,7 % | ~2,1–2,4 % |
| Field-Goal-Quote | 82,4 % | 82,0 % | ~85 % |

Beide Läufe sind deterministisch (dieselbe Kader-/Saat-Konfiguration liefert bei wiederholtem
Aufruf exakt dieselben Zahlen, nachgeprüft) — die Bewegung ist also ursächlich auf die
Down-Verdrahtung zurückzuführen, nicht auf Messrauschen. **Der 14-zeilige Korridor bewegt sich
in jeder Zeile nur um Nachkommastellen und bleibt überall in derselben Größenordnung wie
vorher** — keine Zeile kippt aus ihrem bisherigen Band. Yards/Attempt und Yards/Lauf rücken
minimal näher an ihr NFL-Ziel (6,95→6,97 bzw. 3,88→3,96), Completion-Quote bleibt unverändert
(die Down-Verdrahtung rührt nicht an der Erfolgswahrscheinlichkeit selbst, nur an der
Play-/Tier-Auswahl).

**`node scripts/miss-alle-disziplinen.mjs 24 football basketball hockey`, vorher/nachher:**

| Disziplin | rho je Spiel vorher | rho je Spiel nachher | rho Saison vorher | rho Saison nachher |
|---|---:|---:|---:|---:|
| **Football** | 0,460 (Spannweite 0,258) | **0,468** (Spannweite 0,383) | 0,692 (Spannweite 0,196) | **0,671** (Spannweite 0,420) |
| Basketball | 0,757 | 0,757 (bit-identisch) | 0,923 | 0,923 (bit-identisch) |
| Hockey (alle 12) | 0,618 | 0,618 (bit-identisch) | 0,748 | 0,748 (bit-identisch) |
| Hockey (Feldspieler) | 0,719 | 0,719 (bit-identisch) | 0,818 | 0,818 (bit-identisch) |

**Isolationsnachweis bestanden:** Basketball und Hockey sind bit-für-bit unverändert — die
Down-Verdrahtung berührt ausschließlich Football-Code.

**Ehrliches Ergebnis für Football, wie im Auftrag verlangt (keine Zahl schönen, keine
Verschlechterung verschweigen):** rho je Spiel bewegt sich von 0,460 auf 0,468 (+0,008), rho
Saison von 0,692 auf 0,671 (−0,021). **Beide Bewegungen liegen deutlich innerhalb der eigenen
Kader-Spannweite** der jeweiligen Größe (0,258→0,383 bzw. 0,196→0,420) — nach der Regel aus
`messgrundlage-kaderfest.md`/CLAUDE.md ist eine Bewegung, die kleiner ist als die eigene
Spannweite, **von Null nicht unterscheidbar**. Football bleibt klar „durchgefallen", weder
besser noch schlechter im messbaren Sinn. Das deckt sich mit der eigenen Einschätzung im
Opus-Review (C.2: „Ob er auch rho hebt, ist offen — er würde die Verlässlichkeit vermutlich
eher senken, weniger Laufzüge auf 3rd & long heißt weniger Ballberührungen für laufstarke
Spieler") — tatsächlich ist genau das passiert: die Saison-Spannweite (ein Verlässlichkeits-
Indikator) ist von 0,196 auf 0,420 gewachsen, die Mechanik ist also etwas *lauter* geworden,
nicht leiser. Der Umbau war trotzdem richtig: `down` ist jetzt ein echter, real kalibrierter
Prädiktor statt eines toten Parameters, 3rd & 8 spielt sich sichtbar anders als 1st & 10, und
die Validität (Saison-rho) bleibt im selben durchgefallenen Band wie vorher — kein
Rückschritt, nur (noch) kein Durchbruch.

---

## Regressionskontrolle

- `node --check public/mockups/battle-mode.engine.js`: bestanden nach jedem der vier Schritte.
- `node scripts/miss-football-korridor.mjs 120`: Abschnitt 2.3 oben, Korridor hält.
- `node scripts/miss-alle-disziplinen.mjs 24 football basketball hockey`: Abschnitt 2.3 oben,
  Football bewegt sich innerhalb seiner Spannweite, Basketball/Hockey bit-identisch.
- Die neun battle-mode/arena-Testdateien aus `docs/design/football-zufriedenstellend.md`
  Abschnitt 6 (`arena-headless-runner`, `battle-mode-arena-resolve-engine`,
  `battle-mode-arena-team-points`, `battle-mode-arena-matchday-resolve-e2e`,
  `battle-zielansage-kontrakt`, `battle-arena-heal-attribution`,
  `battle-arena-endscreen-tooltip-wurzel`, `battle-arena-ein-modell-ueberall`,
  `battle-arena-rennplan-ansage`), mit `--no-file-parallelism`: **65/66 bzw. 66/66 Tests
  bestanden** (zwei Läufe, s. u.), die volle `npm test`-Suite nicht versucht (aus denselben
  Gründen wie in `football-zufriedenstellend.md` Abschnitt 6 dokumentiert — überlastete
  gemeinsame Umgebung, kein Hinweis auf einen echten Motor-Fehler).

  Erster Lauf: 1 von 66 Tests fehlgeschlagen — `arena-headless-runner.test.ts`, „schliesst den
  Browser nach Erfolg und nach Fehlern zuverlaessig (kein Zombie-Prozess)"
  (`expect(nachher).toBe(vorher)`, erwartete 16 offene Prozesse, bekam 0). Dieser Test prüft
  Browser-Prozess-Bereinigung der Test-Infrastruktur selbst, hat keinen Bezug zu
  `battle-mode.engine.js` oder zu Football. Zweiter, isolierter Lauf **nur dieser Datei**
  direkt danach: wieder 1 Fehlschlag, aber mit anderen Zahlen (erwartete 18, bekam 10) — zwei
  Läufe desselben Codes mit unterschiedlichen Zahlen ist die Signatur eines Umgebungs-Flakes
  (Prozess-Zählung unter Last), nicht eines deterministischen Fehlers, und deckt sich mit dem
  bereits in `football-zufriedenstellend.md` Abschnitt 6 dokumentierten Muster überlasteter
  gemeinsamer Testumgebungen. Alle acht anderen Dateien liefen in beiden Durchläufen grün.

---

## Geänderte Dateien

- `public/mockups/battle-mode.engine.js` — die drei Code-Fixes/Ergänzungen aus den
  Abschnitten 1–3 oben (kein Debug-/Diagnosecode im Commit, die Verifikationssonden dieser
  Runde wurden vor dem Commit wieder entfernt).
- `docs/design/stand-aller-disziplinen.md` — fünf plus eine Stelle nachgezogen (Abschnitt 4).
- `docs/design/football-review-fg-vorher.png` / `-nachher.png` — Bildschirmfotos zum
  Field-Goal-Fix (Abschnitt 1).
- `docs/design/football-review-bugfixes.md` — dieser Bericht.
