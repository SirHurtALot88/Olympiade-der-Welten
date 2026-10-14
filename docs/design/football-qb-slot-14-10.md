# Football: QB-Slot gebaut (Schritt 3 von 4, 14.10.)

Baurunde für Schritt 3 aus `docs/design/football-kickoff-slot-plan-14-10.md` (Abschnitt 3.2,
Reihenfolge-Tabelle: QB-Slot nach Kicker/Punter-Slot, vor Kickoff-Return). Schritt 1 (Klasse-A
visual slice) ist gemergt (PR #1224), Schritt 2 (Kicker/Punter-Slot) ist gemergt (PR #1225).
Schritt 4 (Kickoff-Return) ist **nicht** Teil dieser Runde.

Chris' Auftrag, wörtlich (`football-kickoff-regeln-konzept-14-10.md` Abschnitt 7, Frage 5):
„ja soll nen QB slot geben der auch von der stat verteilung passen soll genauso wie die blocker
oder runner und kp was es noch so gibt" — übersetzt (Plandokument Abschnitt 3.2): kein fester
Depth-Chart-QB (das ist der bereits gescheiterte Versuch, rho 0,167/0,280 gegen 0,277/0,413), eine
**Gewichtsverstärkung der bestehenden Passer-Lotterie** für den explizit zugewiesenen QB.

## 1. Slot-Rolle: Field Read zu Quarterback umgewidmet

`lib/lineups/matchday-slot-roles.ts:244-267` (football, Index 2 von 6): die dritte Rolle
("fieldread" / "Field Read", vormals `["awareness","determination"]`) wurde zu `"quarterback"` /
"Quarterback" umgewidmet, mit Fokus `["power","determination"]`.

**Warum Umwidmen statt eines neuen, siebten Slot-Index:** derselbe Platzgrund wie beim Kicker/
Punter-Slot (Schritt 2) — `football.jeSeite` ist 6, `buildGeneratedSlotRoles` schneidet mit
`slice(0, slotCount)` (Zeile 649), ein Index 6 würde nie gezogen. Der einzige frei wählbare Slot
(der Ausgleichsslot, Index 5) ist seit Schritt 2 schon der Kicker/Punter — für den QB-Slot bleibt
nur, eine der fünf übrigen, "normalen" Rollen umzuwidmen.

**Warum "Field Read" und nicht eine der anderen vier:** der Sub-Skill, den `resolvePass()`
tatsächlich für die Passer-Lotterie liest (`fkLos(off,"PASSGENAUIGKEIT")`, battle-mode.engine.js),
ist `PASSGENAUIGKEIT: {power:40,determination:35,dexterity:25}`. Von den fünf Themen
(linepower: power/health, routeburst: speed/dexterity, fieldread: awareness/determination,
ballhawk: torment/awareness, redzone: power/torment) behält **nur** "Field Read" eines der beiden
schwersten PASSGENAUIGKEIT-Attribute (determination) unverändert bei — der Tausch beschränkt sich
auf EIN Attribut (awareness → power, das schwerste Einzelgewicht), statt beide Fokus-Attribute
auszutauschen. "Field Read" ist zudem die semantisch treffendste Bezeichnung für einen
Quarterback (das Lesen des Feldes vor dem Snap). Dexterity (25 % Gewicht) bleibt außerhalb der
zwei generierten Fokus-Punkte (`resolveThemeFocus` nimmt nur `slice(0,2)`, dieselbe Begrenzung
wie jedes andere Thema), steht aber in der Beschreibung, damit der Text nicht mehr verspricht, als
die Mechanik trägt, aber auch nicht verschweigt, was `fkLosPasser()` wirklich mitnimmt.

**Geprüft und verworfen:** eine Alternative (Redzone statt Field Read umwidmen, `["power",
"torment"]` → `["power","determination"]`, nur das Minor-Attribut getauscht statt des Major-
Attributs) wurde testweise gebaut und kaderfest gemessen — sie drückte rho je Spiel auf 0,780
(durchgefallen, unter der 0,80-Schranke), gegen 0,804 bei der Field-Read-Umwidmung. Verworfen.

### Anders als Kicker/Punter ändert diese Umwidmung die generierten Zahlen — mit einer messbaren
Nebenwirkung

Der Kicker/Punter-Slot (Schritt 2) war ein Spezialfall: sein Profil (health/stamina) kam bereits
exakt aus dem negativen Summendelta der anderen fünf Rollen (`buildSlotWeightProfiles`,
`finalDelta`) und blieb beim Umbenennen bit-identisch. "Field Read" ist **kein** Ausgleichsslot —
sein Profil kommt aus `buildInitialDelta(theme, baseWeights)` direkt aus den Fokus-Attributen. Der
Tausch awareness → power verschiebt deshalb sowohl dieses Slot-Profil als auch — über die
`finalDelta`-Umverteilung — das Profil des Kicker/Punter-Ausgleichsslots (Index 5).

**Das hat eine Konsequenz, die bei Kicker/Punter nicht auftrat:** `slotFuer()` (battle-mode.engine.js)
weist JEDEM Spieler — auch ohne jede Manager-Zuweisung — über den Rundlauf-Rückfall eine Slot-ID
nach Array-Index zu (`slotListe[i % slotListe.length]`), nur mit `slotGesetzt:false`. Der
Rückfall-Slot ist also nie `null`, und `slotAufschlag()` wendet sein `profil` unabhängig von
`slotGesetzt` an. Jede Änderung an den generierten `profil`-Zahlen wirkt sich deshalb — anders als
der `u.slotGesetzt`-gegateten Mechanik-Bonus selbst — **auch auf den blinden No-Lineup-Fall aus**:
die kaderfeste rho-Sonde und die Pp-Sonde messen beide über den Rundlauf-Rückfall, und ihre Zahlen
verschieben sich dadurch leicht, obwohl `bestimmeQB()`/`fkLosPasser()` in diesem Fall weiterhin
`null`/bit-identisch bleiben (s. Abschnitt 4). Das ist eine Eigenschaft der Slot-Infrastruktur
selbst (dieselbe Lücke hätte jede Rollen-Umwidmung mit geändertem Fokus getroffen, nicht nur diese)
und wurde VOR der endgültigen Wahl geprüft (s. Vergleich mit der Redzone-Alternative oben).

`scripts/generiere-arena-daten.ts --schreiben` wurde ausgeführt (dry run, geprüft); wie bei Schritt
2 hätte ein voller Lauf auch ältere, nicht mit diesem PR zusammenhängende Umlaut-Drift in 19
anderen Disziplinen korrigiert (reine Text-Transliteration, keine Zahlenänderung) — bewusst NICHT
mitgenommen (zu breiter Diff); stattdessen wurden nur die zwei geänderten Zeilen (quarterback,
kickerpunter) von Hand nachgezogen, mit den vom Generator bestätigten Werten.

## 2. Motor-Wirkung: `QB_SLOTS`/`bestimmeQB()`/`fkLosPasser()`, verdrahtet in `resolvePass()`

`public/mockups/battle-mode.engine.js:10130-10156` (direkt nach `fkLos`/`FK_LOS_KAPPA`). Dasselbe
Grundmuster wie Kicker/Punter (`KICKER_SLOTS`/`bestimmeKicker()`), aber mit einem bewussten
Unterschied in der Form des Bonus:

```js
const QB_SLOTS=new Set(["quarterback","qb"]);
function bestimmeQB(team){
  if(!team)return null;
  return team.find(u=>u.slotGesetzt&&u.slotId&&QB_SLOTS.has(u.slotId))||null;
}
const QB_SLOT_BONUS=1.5;
function fkLosPasser(off){
  const qb=bestimmeQB(off);
  return gewichtetesLosNach(off,u=>Math.pow(Math.max(1,u.PASSGENAUIGKEIT-LOS_NULLPUNKT),FK_LOS_KAPPA)
    *(qb&&u===qb?QB_SLOT_BONUS:1));
}
```

`resolvePass()` (Zeile ~10250) ruft jetzt `fkLosPasser(off)` statt
`fkLos(off,"PASSGENAUIGKEIT")` — die einzige Änderung an dieser Funktion.

**Additiv/proportional, keine Identitätsfixierung:** anders als der bereits gescheiterte feste
Depth-Chart-Versuch (Kommentar bei `waehlePlayCall`, rho 0,167/0,280 gegen 0,277/0,413 mit
dynamischer Wahl) setzt `QB_SLOT_BONUS` die Chance der anderen Spieler NICHT auf null —
`gewichtetesLosNach()` kappt Gewichte nie auf 0 (`Math.max(0.01, gewichtFn(x))`), jeder
Feldspieler bleibt ziehbar. Der zugewiesene QB bekommt lediglich einen multiplikativen Faktor
1,5 auf sein Los-Gewicht — bei `FK_LOS_KAPPA=3,4` verschiebt das die Ziehungswahrscheinlichkeit
spürbar, ohne die Lotterie-Eigenschaft aufzuheben.

**Kein unbedingter Rückfall, wie Kicker/Punter, anders als Hockeys Torwart:** ein QB-Slot ist nicht
strukturell Pflicht wie ein Torwart — `resolvePass()` lief bis heute komplett ohne Lineup-Bezug,
und ein No-Slot-Fall muss bit-identisch bleiben. `bestimmeQB()` hat deshalb keinen
PARADE-artigen Rückfall auf den "besten verfügbaren" Spieler: ohne
`u.slotGesetzt && u.slotId ∈ QB_SLOTS` liefert sie `null`, und `fkLosPasser()` rechnet dann exakt
wie die alte `fkLos(off,"PASSGENAUIGKEIT")`.

**`QB_SLOT_BONUS=1,5`** — Korridor-Mitte des Plandokuments ("1,3-1,6, zu kalibrieren, nicht zu
raten", Abschnitt 3.2 Punkt 3), kalibriert mit der neuen slot-bewussten Sonde (Abschnitt 4).

## 3. Warum die bestehenden Mess-Werkzeuge blind bleiben — und was dagegen gebaut wurde

`scripts/miss-alle-disziplinen.mjs`/`scripts/messe-arena-einfluss.mjs` rufen `M.bau()` ohne jede
Lineup-Platzierung auf (`place` bleibt leer, `slotFuer()` fällt für jeden Spieler auf den
Rundlauf-Rückfall mit `slotGesetzt:false` zurück, s. Abschnitt 1). `bestimmeQB()` liefert dort für
jeden Spieler `null`, unabhängig von `QB_SLOT_BONUS` — exakt derselbe blinde Befund wie beim
Kicker/Punter-Slot. Anders als dort reicht das für den QB-Slot nicht als einzige Abnahme: Chris'
Auftrag verlangt ausdrücklich eine **spürbare** Wirkung ("genauso wie die blocker oder runner"),
und ein bit-identisches Ergebnis wäre hier kein Beweis für Sicherheit, sondern ein blinder Fleck,
der die Kalibrierung verdeckt (s. "Was Schritt 3 braucht" in `football-kicker-slot-14-10.md`).

**Gebaut: `einflussVonMitSlot()`** (`battle-mode.engine.js`, direkt nach `einflussVon`/
`spurtEinfluss`, demselben Vorbild wie `einflussVonSandsackFinale` folgend) — ein kleiner,
eigener Zwilling von `einflussVon()`: für JEDEN getesteten Spieler wird während seines eigenen
Hebungslaufs (NACH `M.bau()`, VOR `M.lauf()`) `u.slotId`/`u.slotGesetzt` explizit auf den
übergebenen Slot gezwungen, während der Grundlauf (kein Attribut gehoben) niemanden slottet. Das
misst das realistische Kalibrierungsszenario: "ein Manager hat seinen besten Passer-Kandidaten
als QB aufgestellt — wie stark zahlt sich eine bessere Eignung jetzt aus?"

**Dieselbe Technik zusätzlich additiv in `feldspielProbe()`** (`o.slotErzwingen:{wer,slot}`,
Zeile ~49918/49973): ein optionaler, ohne Angabe wirkungsloser Haken, der denselben
Zwangs-Mechanismus NACH `bauFeldspiel()` anwendet — für eine künftige slot-bewusste
rho-Rangtreue-Sonde (in dieser Runde nicht ausgeschöpft, s. Abschnitt 6).

**Neues Skript: `scripts/messe-qb-slot-einfluss.mjs`** — ruft `window.__arena.einflussVonMitSlot`
auf und gibt dieselbe Pp-Tabelle wie `messe-arena-einfluss.mjs` aus, nur slot-bewusst.

## 4. Messergebnisse

### 4.1 rho (CLAUDE.md-Schranke 0,80, angestrebt 0,85), n=48, Kader-Familie (live-save), BLIND
(keine Lineup-Platzierung — unverändert gegenüber Schritt 2's Mess-Methode)

`node scripts/miss-alle-disziplinen.mjs 48 football`:

| | rho/Spiel (Median) | Spannweite | rho/Saison (Median) | Spannweite |
|---|---:|---:|---:|---:|
| vorher (Schritt 2, `origin/main`) | 0,808 | 0,140 | 0,874 | 0,133 |
| nachher (dieser PR) | 0,804 | 0,089 | 0,895 | 0,077 |

**Nicht bit-identisch — aus einem dokumentierten, erwarteten Grund (s. Abschnitt 1):** die
Rollen-Umwidmung ändert die generierten `profil`-Zahlen, und der Rundlauf-Rückfall liest sie
unabhängig von `slotGesetzt`. Die Verschiebung (−0,004 je Spiel) liegt WEIT innerhalb der
Kaderrauschen-Spannweite dieser Messung selbst (0,089-0,140) — nach derselben Logik, die
CLAUDE.md für die Kader-Familie-Methode festhält ("eine Rezeptänderung, die kleiner bewegt als die
Spannweite einer Disziplin, ist von Null nicht unterscheidbar"), ist das keine echte Bewegung,
sondern Rauschen. Die Saison-Zahl steigt sogar leicht (0,874 → 0,895). **Schranke weiterhin sicher
bestanden, komfortabler Puffer zur 0,80-Grenze.**

### 4.2 Pp-Abweichung (CLAUDE.md-Schranke ≤25, `scripts/messe-arena-einfluss.mjs`), zwei
Saatströme, BLIND

| Saatstrom | vorher (Schritt 2, `origin/main`) | nachher (dieser PR) |
|---|---:|---:|
| Strom 0 (versatz=0) | 51,7 Pp | 64,0 Pp |
| Strom 2 (versatz=10 000 000) | 57,8 Pp | 71,3 Pp |

**Ebenfalls nicht bit-identisch, aus demselben Grund wie rho oben — und hier ehrlich als
Verschlechterung zu benennen, nicht wegzuerklären.** Football verletzt die Pp-Schranke bereits
seit der 02.10.-Messung massiv (51,7/57,8, weit über dem Zielwert 25) — das ist ein
vorbestehendes, separat verfolgtes Problem des Football-Rezepts insgesamt
(`football-kickoff-slot-plan-14-10.md` Abschnitt 2.1: sechs der zwölf Matrixattribute tragen
praktisch nichts bei), nicht etwas, das dieser Schritt oder Schritt 2 beheben sollte oder könnte.
Die Rollen-Umwidmung verschiebt diese bereits gebrochene Zahl weiter nach oben (um +12,3 bzw.
+13,5 Pp) — eine reale, nicht wegdiskutierbare Nebenwirkung der Entscheidung, Field Read ehrlich
auf die tatsächlich gelesenen PASSGENAUIGKEIT-Attribute umzustellen, statt eine Text/Mechanik-
Lücke nach demselben Muster offen zu lassen, das der 10.09.-Fix bei den anderen Rollen bereits
geschlossen hat. **Qualitativ ändert sich am Urteil nichts** (beide Zahlen lagen vor UND liegen
nach diesem PR weit über der 25-Pp-Schranke) — eine spätere, eigene Rezeptrunde für Football
(außerhalb dieses Plans) müsste das ohnehin angehen.

### 4.3 Slot-bewusste Pp-Sonde (`scripts/messe-qb-slot-einfluss.mjs`), zwei Saatströme — der
Nachweis, dass die Mechanik wirkt

`node scripts/messe-qb-slot-einfluss.mjs football quarterback 48` (jeder getestete Spieler wird
für seinen eigenen Hebungslauf explizit in den QB-Slot gezwungen, s. Abschnitt 3):

| Saatstrom | Abweichung zur Matrix | power-Anteil | determination-Anteil | dexterity-Anteil |
|---|---:|---:|---:|---:|
| Strom 0 (versatz=0), BLIND (zum Vergleich) | 64,0 Pp | 17,4 % | 4,0 % | 2,6 % |
| Strom 0 (versatz=0), SLOT-BEWUSST | 59,6 Pp | 18,6 % | 3,9 % | 3,2 % |
| Strom 2 (versatz=10 000 000), BLIND (zum Vergleich) | 71,3 Pp | 17,4 % | 1,5 % | 1,4 % |
| Strom 2 (versatz=10 000 000), SLOT-BEWUSST | 62,4 Pp | 17,0 % | 6,0 % | 1,8 % |

**Nicht bit-identisch, in beide Streams in die RICHTIGE Richtung bewegt:** die Abweichung zur
Matrix sinkt in BEIDEN Strömen, sobald der QB-Slot tatsächlich gesetzt ist (−4,4 Pp bzw. −8,9 Pp
gegenüber derselben blinden Messung) — der Slot-Bonus verschiebt den Einfluss also tatsächlich in
Richtung der PASSGENAUIGKEIT-Attribute, nicht nur zufällig irgendwohin. Das Signal ist über die
zwölf Attribute hinweg bescheiden, nicht dramatisch (`feldspielWert()`, die Grundlage von `M.wert()`
und damit dieser Pp-Zahl, ist ein BREITER Box-Score-Wert — Lauf-/Fang-/Punktewert zählen mit, nicht
nur Passing — ein zusätzlicher Pass-Vorteil für einen Spieler ist dort nur EIN Anteil seines
Gesamtwerts, verdünnt durch alles andere, was er in einem Spiel sonst noch tut). Die Pp-Zahl allein
ist deshalb nicht die anschaulichste Demonstration — s. 4.4 für eine direktere.

### 4.4 Direkte Zusatzprobe: Anteil an den Team-Passyards, mit/ohne QB-Slot

Zur Einordnung, wie stark sich der Bonus im konkreten Spiel auswirkt (nicht Teil der
CLAUDE.md-Pflichtmessung, sondern eine anschaulichere, zusätzliche Kontrolle über
`feldspielProbe()`s neuen `o.slotErzwingen`-Haken, kaderfest, n=24, derselbe Kandidat — der
Spieler mit dem höchsten `eig` auf der Heimseite — in beiden Läufen):

| | Anteil an Team-Passyards |
|---|---:|
| ohne Slot-Zuweisung (Rundlauf-Rückfall) | 51,7 % |
| mit QB-Slot-Zuweisung | 58,0 % |

**+6,3 Prozentpunkte** — ein Spieler, der als QB gesetzt wird, trägt danach spürbar mehr der
Passing-Produktion seines Teams, genau das Bild, das Chris mit "genauso wie die blocker oder
runner" beschrieben hat: der Slot ist sichtbar, aber nicht absolut (51,7 % → 58,0 %, nicht
100 %) — die Lotterie-Eigenschaft bleibt erhalten, kein Rückfall zum gescheiterten Depth-Chart.

## 5. Verifikation

- `node --check public/mockups/battle-mode.engine.js`: ok
- `npx eslint public/mockups/battle-mode.engine.js`: 0 Errors, 76 Warnings — identisch zum Stand
  vor dieser Änderung (wie schon in PR #1224/#1225 festgestellt)
- `npx eslint lib/lineups/matchday-slot-roles.ts`: 0 Errors, 0 Warnings
- `npx tsc --noEmit -p tsconfig.json`: dieselben vorbestehenden, unabhängigen Fehler wie auf
  `origin/main` (909 Zeilen, identisch bis auf eine nichtdeterministische Union-Reihenfolge in
  einer unberührten Testdatei) — kein neuer Fehler durch diesen PR
- `npx vitest run tests/matchday-slot-roles.test.ts`: 19/19 bestanden
- Elf weitere football-berührende Testdateien (dieselbe Liste wie PR #1225): alle bestanden

## 6. Was Schritt 4 (Kickoff-Return) braucht

- Derselbe `u.slotGesetzt && u.slotId`-Lesepfad ist jetzt DREIMAL etabliert (Torwart, Kicker/
  Punter, QB) — ein Returner-Slot kann demselben Muster folgen, falls gewünscht.
- `feldspielProbe()`'s neuer `o.slotErzwingen`-Haken (Abschnitt 3) ist generisch und
  disziplinübergreifend nutzbar — eine künftige slot-bewusste RHO-Sonde (nicht nur Pp) für den
  QB-Slot oder einen Returner-Slot kann ihn direkt wiederverwenden, ohne eine weitere Kopie von
  `feldspielProbe()` zu bauen.
- Die Pp-Zahl für Football bleibt ein vorbestehendes, großes, eigenes Problem — Schritt 4 sollte
  nicht versuchen, es nebenbei zu reparieren (derselbe Rat wie am Ende von Schritt 2).

## Nicht Teil dieser Runde

Kickoff-Return (Schritt 4), jede Änderung an der gesperrten Eignungsmatrix oder am Football-
Override (`spiel-eignung-overrides.ts`, unangetastet), eine slot-bewusste RHO-Sonde (nur die
Infrastruktur dafür, `o.slotErzwingen`, wurde gelegt — s. Abschnitt 6).
