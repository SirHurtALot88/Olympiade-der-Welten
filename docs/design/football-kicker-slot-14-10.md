# Football: Kicker/Punter-Slot gebaut (Schritt 2 von 4, 14.10.)

Baurunde für Schritt 2 aus `docs/design/football-kickoff-slot-plan-14-10.md` (Abschnitt 2.3,
Reihenfolge-Tabelle: Kicker/Punter-Slot vor QB-Slot, QB-Slot vor Kickoff-Return). Schritt 1
(Klasse-A visual slice) ist gemergt (PR #1224). Schritt 3 (QB-Slot) und Schritt 4 (Kickoff-
Return) sind **nicht** Teil dieser Runde.

## Was gebaut wurde

### 1. Slot-Rolle: Ausgleichsslot umbenannt, nicht neu angelegt

`lib/lineups/matchday-slot-roles.ts:247-264` (football, Index 5 von 6): die letzte Rolle
("lockerleader" / "Locker Leader") wurde zu `"kickerpunter"` / "Kicker/Punter" umbenannt.

**Warum Umbenennen statt eines neuen, siebten Slot-Index:** Football hat `jeSeite:6`
(`battle-mode.engine.js:7084`), und `buildGeneratedSlotRoles` schneidet die Themenliste mit
`slice(0, slotCount)` ab (`matchday-slot-roles.ts:649`) — ein Index 6 würde bei sechs
Feldspielern nie gezogen. Von den sechs vorhandenen Themen war die letzte Rolle die einzig
risikofreie Wahl: sie ist der **Ausgleichsslot** (`buildSlotWeightProfiles`, Zeile 591-598) —
ihr Profil ist nicht frei wählbar, sondern das negative Summendelta aller anderen fünf Rollen,
und besteht bereits aus genau health/stamina. Das sind GENAU die zwei Attribute, aus denen sich
AUSDAUER zusammensetzt (`stamina:67,will:33`, s. unten) — die Umbenennung ändert daher keine
einzige Zahl im generierten Profil (nachgeprüft: `npx tsx scripts/generiere-arena-daten.ts`
vor/nach der Umbenennung liefert für diesen Slot byte-identische `profil`-Werte, nur `id`/
`label`/`text` ändern sich). Keine `buildGoaltenderDelta`-artige Sonderbehandlung nötig.

`resolveSlotRoleShortId()` und `buildGeneratedSlotRoles` brauchten keine Codeänderung — beide
lesen `roleId` generisch aus der Themenliste, ebenso `arena-aufstellung-adapter.ts`
(`resolveSlotRoleShortId`-Aufruf, keine Hardcodierung von Rollennamen).

`scripts/generiere-arena-daten.ts --schreiben` wurde ausgeführt, weil sich `id`/`label`/`text`
im generierten `SLOTS_JE_DISC.football`-Block ändern (`battle-mode.engine.js:6136`). Der Lauf
hätte nebenbei auch ältere, nicht mit diesem PR zusammenhängende Umlaut-Drift in 19 anderen
Disziplinen korrigiert (reine Text-Transliteration, keine Zahlenänderung) — das wurde bewusst
NICHT mitgenommen (zu breiter Diff für diesen Schritt); statt des vollen Laufs wurde nur die
eine geänderte Zeile von Hand nachgezogen, mit den vom Generator bestätigten, unveränderten
`profil`-Werten.

### 2. Motor-Wirkung: `KICKER_SLOTS`/`bestimmeKicker()`, `resolveFieldgoal`/`resolvePunt`

`public/mockups/battle-mode.engine.js:10287-10334` (vor der Umbenennung
Zeile 10287-10303). Nach Hockeys Torwart-Vorbild (`TORWART_SLOTS`/`bestimmeTorwaerter()`,
Zeile 9806/9839-9847), aber mit einem bewussten Unterschied:

```js
const KICKER_SLOTS=new Set(["kickerpunter","kicker","punter","specialteams"]);
function bestimmeKicker(team){
  if(!team)return null;
  return team.find(u=>u.slotGesetzt&&u.slotId&&KICKER_SLOTS.has(u.slotId))||null;
}
const FG_AUSDAUER_KORREKTUR=0.0008;   // (AUSDAUER-50)*0,0008 -> ±4 Pp bei AUSDAUER 0/100
const PUNT_AUSDAUER_KORREKTUR=0.1;    // (AUSDAUER-50)*0,1    -> ±5 Yards bei AUSDAUER 0/100
function resolveFieldgoal(spot,kicker){
  const kickDistanz=spot+17;
  let chance;
  if(kickDistanz<30)chance=0.97;
  else if(kickDistanz<40)chance=0.93;
  else if(kickDistanz<50)chance=0.769;
  else chance=0.717;
  if(kicker)chance=Math.max(0.05,Math.min(0.99,chance+(kicker.AUSDAUER-50)*FG_AUSDAUER_KORREKTUR));
  return {typ:"fg",erfolg:rr()<chance,distanz:kickDistanz};
}
function resolvePunt(spot,netto,punter){
  const yards=punter?netto+(punter.AUSDAUER-50)*PUNT_AUSDAUER_KORREKTUR:netto;
  return {typ:"punt",spot,yards};
}
function loeseFootballZug(spielTyp,fb){
  const off=FSTEAM[fb.side], def=FSTEAM[1-fb.side];
  if(spielTyp==="fg")return resolveFieldgoal(fb.spot,bestimmeKicker(off));
  if(spielTyp==="punt")return resolvePunt(fb.spot,fb.puntNetto,bestimmeKicker(off));
  if(spielTyp==="lauf")return resolveLauf(off,def);
  return resolvePass(off,def,fb.down,fb.toGo,spielTyp);
}
```

**Der bewusste Unterschied zu Hockey:** `bestimmeTorwaerter()` fällt ohne explizite
Manager-Zuweisung auf den besten PARADE-Wert im Kader zurück (ein Torwart ist strukturell
Pflicht, sobald das Team ≥3 Spieler hat). Ein Kicker/Punter ist das nicht — Field Goal/Punt
liefen bis heute komplett ohne Spielerbezug, und der Auftrag verlangt ausdrücklich, dass der
No-Slot-Fall "bit-identisch zum alten Verhalten" bleibt. `bestimmeKicker()` hat deshalb KEINEN
automatischen Rückfall: ohne `u.slotGesetzt && KICKER_SLOTS.has(u.slotId)` liefert sie `null`,
und `resolveFieldgoal`/`resolvePunt` rechnen dann exakt wie vor diesem PR (kein
Korrekturterm). Nachgewiesen per isoliertem Funktionstest (s. Verifikation unten).

Primärweg bleibt in beiden Formeln das Bestehende (Distanzstufe bzw. feste Netto-Distanz 40),
AUSDAUER liefert nur einen kleinen, additiven Korrekturterm (±4 Pp Field-Goal-Chance, ±5 Yards
Punt-Netto bei AUSDAUER 0 bzw. 100) — innerhalb der im Plandokument (Abschnitt 3.3) genannten
Bandbreite "±3-5 Prozentpunkte"/"realistische Bandbreite 35-45 Yards".

## Verifikation

- `node --check public/mockups/battle-mode.engine.js`: ok
- `npx eslint public/mockups/battle-mode.engine.js`: 0 Errors, 76 Warnings — **identisch** zum
  Stand vor dieser Änderung (wie schon in PR #1224 festgestellt)
- `npx eslint lib/lineups/matchday-slot-roles.ts`: 0 Errors, 0 Warnings
- `npx tsc --noEmit -p tsconfig.json`: dieselben vorbestehenden, unabhängigen Fehler wie auf
  `origin/main` (transfermarkt-/season-ratings-/wishlist-Tests, keiner davon berührt
  `matchday-slot-roles.ts` oder `battle-mode.engine.js`) — **kein neuer Fehler** durch diesen PR
- `npx vitest run tests/matchday-slot-roles.test.ts`: 19/19 bestanden
- Elf weitere football-berührende Testdateien (`battle-mode-arena-resolve-engine`,
  `battle-mode-arena-matchday-resolve-e2e`, `arena-matchday-weg-b-beide-disziplinen`,
  `matchday-lineup-readiness`, `legacy-lineup`, `pp-area-form-bonus`,
  `player-generator-service`, `organic-squad-utility`,
  `season-discipline-schedule-battle-repeat`, `retool-ai2-pick-engine`,
  `transfermarkt-scouting` u.a. — volle Liste im PR): alle bestanden
- **Isolierter Funktionstest** (node, `resolveFieldgoal`/`resolvePunt`/`bestimmeKicker` aus dem
  Diff extrahiert, `rr()` fest auf 0,5 gestellt):
  - Kein Kicker (`kicker=null`): `resolveFieldgoal(30,null)` und `resolvePunt(60,40,null)`
    liefern bit-identisch zur alten Signatur (keine Distanz-/Yards-Änderung).
  - AUSDAUER 100 (`FG_AUSDAUER_KORREKTUR`): Field-Goal-Chance +0,04 (vier Prozentpunkte);
    AUSDAUER 0: −0,04. Punt-Yards bei AUSDAUER 100/0: 40±5.
  - `bestimmeKicker()`: findet nur `u.slotGesetzt===true && KICKER_SLOTS.has(u.slotId)`; ein
    Spieler mit demselben `slotId`, aber `slotGesetzt:false` (Rundlauf-Rückfall), wird
    korrekt ÜBERSPRUNGEN — `null` kommt zurück, kein stiller Fallback auf irgendwen.

### rho (CLAUDE.md-Schranke 0,80, angestrebt 0,85), n=48, Kader-Familie (live-save)

`node scripts/miss-alle-disziplinen.mjs 48 football`:

| | rho/Spiel (Median) | Spannweite | rho/Saison (Median) | Spannweite |
|---|---:|---:|---:|---:|
| vorher (`origin/main`) | 0,808 | 0,140 | 0,874 | 0,133 |
| nachher (dieser PR) | 0,808 | 0,140 | 0,874 | 0,133 |

**Bit-identisch.** Erwartet und bestätigt: die Kader-Familie-Fixture weist in `bauFeldspiel()`
keine echte Manager-Aufstellung zu (`place[]` bleibt leer), `slotFuer()` fällt für jeden
Spieler auf den Rundlauf-Rückfall zurück (`slotGesetzt:false`) — `bestimmeKicker()` liefert für
jeden Spieler `null`, und die Mechanik verhält sich exakt wie vor diesem PR. Kein Hockey-artiger
unbedingter Rückfall (s. oben) heißt: diese Messung kann die neue Mechanik grundsätzlich nicht
auslösen, weder verbessern noch verschlechtern — das ist der Beweis für "No-Slot-Fall bricht
nicht", nicht eine fehlende Wirkung des Codes.

### Pp-Abweichung (CLAUDE.md-Schranke ≤25, `scripts/messe-arena-einfluss.mjs`), zwei Saatströme

| Saatstrom | vorher (`origin/main`) | nachher (dieser PR) |
|---|---:|---:|
| Strom 0 (versatz=0) | 51,7 Pp | 51,7 Pp |
| Strom 2 (versatz=10 000 000) | 57,8 Pp | 57,8 Pp |

**Bit-identisch, aus demselben Grund wie rho.** `einflussVon()` (die Pp-Messfunktion) ruft
`M.bau()` ohne jede Lineup-Platzierung auf — derselbe Mechanismus wie bei der rho-Sonde. Die
AUSDAUER-Spalte bleibt bei 0 % Anteil / −6,0 Pp Differenz, identisch zu vorher. **Das ist eine
ehrliche, nicht geschönte Beobachtung, kein unbemerkter Fehlschlag:** die Pp-Verbesserung, die
`football-kickoff-slot-plan-14-10.md` Abschnitt 3.3 für diesen Schritt erwartet hatte ("der
einzige der drei Vorschläge, der die Pp-Abweichung MIT HOHER WAHRSCHEINLICHKEIT tatsächlich
senkt"), setzt voraus, dass IRGENDEINE Messung den neuen Slot tatsächlich belegt — und keines
der bestehenden Werkzeuge (`miss-alle-disziplinen.mjs`, `messe-arena-einfluss.mjs`) tut das für
einen Slot ohne Hockey-artigen unbedingten Rückfall. Beide Pflichtschranken (rho > 0,80,
Pp ≤ 25) sind damit sicher erfüllt, aber unverändert gegenüber `origin/main` — **keine
Regression, aber auch noch keine gemessene Verbesserung.**

## Was Schritt 3 (QB-Slot) braucht, um darauf aufzubauen

- **Derselbe Grundbaustein ist wiederverwendbar:** ein `fkLos`-Gewichtsbonus für einen
  explizit zugewiesenen Slot-Spieler (Plan Abschnitt 3.2, Punkt 3) kann denselben
  `u.slotGesetzt && u.slotId`-Lesepfad nutzen wie `bestimmeKicker()` hier — keine neue
  Dateninfrastruktur nötig, nur eine zweite `KICKER_SLOTS`-artige Konstante (z. B.
  `QB_SLOTS`) und eine zweite `bestimmeX()`-Funktion.
- **Dieselbe Mess-Lücke gilt dort genauso:** ohne eine Messung, die explizit `place[]`/
  `slotGesetzt` für den Probanden setzt, wird auch ein QB-Slot-Bonus in
  `miss-alle-disziplinen.mjs`/`messe-arena-einfluss.mjs` unsichtbar bleiben — unabhängig davon,
  wie stark der Bonus kalibriert ist. Wer Schritt 3 baut, sollte VOR der Kalibrierungsrunde
  klären, ob eine dedizierte Mess-Variante (ähnlich `einflussVonSandsackFinale`, ein kleiner,
  eigener Zwilling von `einflussVon`, der für den Probanden einen Slot erzwingt) gebraucht
  wird, um den QB-Slot-Bonus überhaupt zu kalibrieren — sonst ist jede Messung dort genauso
  blind wie hier.
- **AUSDAUER hat jetzt einen ersten echten Kanal, aber nur bei expliziter Zuweisung.** Sobald
  das Lineup-UI (`lib/lineups/`) Managern erlaubt, den "Kicker/Punter"-Slot tatsächlich zu
  setzen, greift die hier gebaute Korrektur in echten Spielen — das ist unabhängig von Schritt
  3 und nicht Teil dieses PRs (UI-Anbindung wurde nicht geprüft, s. offene Risiken des
  Plandokuments Abschnitt 5, Punkt 5).

## Nicht Teil dieser Runde

QB-Slot (Schritt 3), Kickoff-Return (Schritt 4), jede Änderung an `fkLos`/der Passer-/
Receiver-Lotterie, jede Änderung an der gesperrten Eignungsmatrix oder am Football-Override
(`spiel-eignung-overrides.ts`, unangetastet).
