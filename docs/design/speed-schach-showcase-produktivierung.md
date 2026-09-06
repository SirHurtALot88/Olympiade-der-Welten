# Speed-Schach und Showcase: Produktivierung — ins echte Spiel (Produktivierungswelle 1)

Chris' Auftrag (06.09., per Rueckfrage bestaetigt): die Produktivierung soll sofort passieren,
mitten in der laufenden Saison, nicht erst zum Saisonwechsel. Grundlage:
`docs/pm-briefings/pm-gesamtstand-2026-09-06.md`, Abschnitt 4 ("Der groesste Hebel") und Schritt 3
der Empfehlung. Vorlage: Hockeys Produktivierung (`hockey-produktivierung.md`, PR #780,
04.09.) — dieselbe Struktur, dieselbe Sorgfalt, hier fuer zwei Disziplinen gleichzeitig, weil
beide dasselbe fehlende Chassis-Muster teilen (Buehne, aber weder Heben noch bereits angebunden).

## Kurzfassung

- **Speed-Schach und Showcase sind die vierte und fuenfte Arena-aufgeloeste Disziplin**
  (`ARENA_RESOLVED_DISCIPLINE_IDS`), nach Basketball, Gewichtheben und Hockey.
- **Zwei NEUE Buehnen-Chassis-Dispatch-Funktionen** waren noetig, keine reine Konfiguration:
  `spieleBuehneDuell()` (fuer `art.duell`, Speed-Schach/I-Spy) und `spieleBuehneAuftritt()`
  (fuer jede Buehne ohne `.heben`/`.duell`, Showcase und fuenf weitere). Der Code-Kommentar
  ueber `ARENA_RESOLVED_DISCIPLINE_IDS` verspricht "reine Konfigurationsaenderung, falls kein
  neues Chassis noetig ist" — das trifft hier NICHT zu, anders als bei Hockey (das das
  bestehende Feldspiel-Chassis wiederverwenden konnte). Der Umfang bleibt trotzdem klein: beide
  neuen Funktionen sind duenne Varianten von `spieleBuehneHeben()`, keine neue Simulation.
- **Ein vorbestehender Motor-Fehler gefunden und behoben**: die `art.duell`-Brettpaarung in
  `bauBuehne()` (`public/mockups/battle-mode.engine.js`) zaehlte ueber die FESTE Motor-Konstante
  `art.jeSeite` (6), nicht ueber die tatsaechliche Teilnehmerzahl. Bei weniger als sechs
  gesetzten Spielern je Seite (jede gewuerfelte Feldgroesse < 6, oder echte Unterzahl) griff
  `mine[i]`/`gegner[i]` ins Leere und der Lauf brach mit `TypeError: Cannot read properties of
  undefined (reading 'n')` ab. `baueHebenDuelle()` (Gewichtheben) hat genau dieses Problem
  bereits mit einer lokalen `n=Math.min(mine.length,gegner.length)` geloest — die inline in
  `bauBuehne()` stehende Duell-Variante hatte diese Zeile nie bekommen, weil sie (anders als
  Heben) nie eine eigene Funktion war. Nie zuvor aufgefallen, weil Speed-Schach/I-Spy vor dieser
  Welle nie ausserhalb einer manuell voll besetzten Aufstellung durchsimuliert wurden — die
  Referenz-Ziehung dieser Welle war der erste Aufruf, der eine kleinere Feldgroesse durchspielt.
- **Staffel ist BEWUSST NICHT in dieser Welle**, obwohl das PM-Briefing es fuer dieselbe Welle
  vorschlug (rho 0,915, bestanden): `bahnTeamstand()` liefert fuer Staffel
  `{seiten:[...], gewertet:false}` — das Spiel selbst fuehrt dort noch keine Wertung, die
  Live-HUD-Meldung sagt woertlich "fuer diese Disziplin gibt es noch keine Wertung". Ein Arena-
  Team-Ergebnis darauf zu bauen waere keine Konfigurationsaenderung, sondern eine neue
  Wertungsmechanik fuer Staffel — das gehoert zu "Wertungstabelle Welle 2" (PM-Briefing Schritt
  4), nicht zur Produktivierung. S. Abschnitt 1 fuer die vollstaendige Herleitung.
- **Mid-Season-Risiko geprueft, nicht vermutet: entfaellt weiterhin.** Alle sieben Saves im
  aktuellen `live-save`-Abbild (gepruft 06.09.) haben `scenarioMeta.gameMode` nicht gesetzt —
  `isBattleModeSave()` faellt fuer jeden auf `"manager"` zurueck. Diese Aenderung (wie schon
  Basketball/Gewichtheben/Hockey vor ihr) wirkt sich auf KEINEN von Chris' aktuellen
  Spielstaenden aus, bis er einen neuen Save mit Battle-Mode-Wahl anlegt oder Battle Mode
  anderweitig scharf geschaltet wird. Das ist kein neuer Befund, sondern derselbe wie bei
  Gewichtheben/Hockey (s. `stand-aller-disziplinen.md`).
- **Kaderfeste Messung bit-identisch**: `node scripts/miss-alle-disziplinen.mjs 24` vor und nach
  dieser Aenderung liefert fuer alle zwanzig Disziplinen dieselben Zahlen (s. Abschnitt 4) — die
  Aenderung ruehrt an der Resolve-Schicht, nicht an `MOTOREN[disc].wert()`.

---

## 1. Warum Staffel nicht dabei ist — die vollstaendige Herleitung

Das PM-Briefing (Abschnitt 4/6.3) nennt Staffel (0,915), Speed-Schach (0,889) und Showcase
(0,880) als "bestandene rho-Werte" fuer diese Welle und beschreibt jede weitere Disziplin als
"reine Konfigurationsaenderung". Vor jeder Aenderung wurde deshalb geprueft, ob das fuer alle
drei stimmt — es stimmt fuer keine der drei wortwoertlich (alle drei brauchen mindestens eine
neue Chassis-Funktion, s. Abschnitt 2), aber fuer Staffel gibt es einen zusaetzlichen, haerteren
Befund:

`public/mockups/battle-mode.engine.js`s `bahnTeamstand()` (Zeile ~14563) entscheidet den
Seitenstand je Bahn-Disziplin so:

```js
function bahnTeamstand(){
  if(BA().wertung==="rang"){
    const w=bahnRangliste();
    return {seiten:w.seiten, suffix:"Punkte nach Rang", punkte:w.punkte, gewertet:true};
  }
  const imZiel=(s)=>rennFertig.filter(x=>x.seite===s).length;
  return {seiten:[imZiel(0),imZiel(1)], suffix:"im Ziel", punkte:null, gewertet:false};
}
```

Nur Time-Trial, Spurt und Climbing tragen `wertung:"rang"` (PR #807, "Rang-Punkte fuer
Time-Trial/Spurt/Climbing"). Staffel und Takeshi's Castle fallen in den zweiten Zweig:
`gewertet:false`, und der Seitenstand ist nur die Zahl der bereits im Ziel angekommenen Laeufer
— kein Wertungsbegriff, ein Nebenprodukt der Zieleinlauf-Reihenfolge. Die Live-HUD zeigt das
Chris explizit an (`updateHudBahn()`):

```js
feed(0, stand.gewertet
  ? (pL>pR?VEREIN[0].name+" gewinnt " : ... )+pL+":"+pR+" "+stand.suffix
  : "Rennen beendet — "+pL+":"+pR+" "+stand.suffix
    +" (fuer diese Disziplin gibt es noch keine Wertung)", true);
```

Ein Arena-Team-Sieg/-Niederlage/-Unentschieden fuer Staffel zu bauen hiesse also, eine
Wertungsmechanik zu ERFINDEN, die im Spiel selbst noch nicht existiert — genau die Art
Design-Entscheidung, die laut PM-Briefing-Methodik (Abschnitt 6, Schritt 3 heisst dort
ausdruecklich "Konfigurationsaenderung", nicht "neue Mechanik") NICHT in diese Welle gehoert.
Das PM-Briefing selbst benennt das zugrundeliegende Problem bereits als offenen, separaten
Punkt: "Staffel und Takeshi haben KEINE Punkte-je-Laeufer-Wertung (Overlay zeigt dort '–')" unter
"Wertungstabelle Welle 2" (Abschnitt 2a/Schritt 4) — also derselbe Befund, nur nicht bis zu
dieser Konsequenz zu Ende gedacht. Sobald Staffel eine echte Wertung bekommt (Wertungstabelle
Welle 2 oder eine eigene Runde), ist die Arena-Anbindung ein eigener, dann aber tatsaechlich
kleiner Nachtrag zu dieser Welle.

**Speed-Schach und Showcase haben dieses Problem nicht**: Speed-Schachs `art.duell`-Zweig fuehrt
mit `u.vorteil` (Brettvorteil, `WERTUNG_DUELL()`) eine echte, immer berechnete Wertung; Showcases
"Auftritt"-Zweig fuehrt mit `u.summe` (Auftrittspunkte, `WERTUNG_AUFTRITT()`) ebenfalls eine
echte, immer berechnete Wertung, die `updateHudBuehne()`s eigener Nicht-Heben-Nicht-Duell-Zweig
schon heute live als Seitenstand anzeigt (`summe(s)=TEILNEHMER.filter(u=>u.side===s).reduce((a,u)
=>a+u.summe,0)`). Beide sind deshalb Teil dieser Welle.

---

## 2. Umsetzung

### 2a. Zwei neue Buehnen-Chassis-Funktionen, keine reine Konfiguration

`window.__arena.spieleBuehneHeben()` (Gewichtheben-Produktivierung) prueft `BUEHNE_ART[bd].heben`
und liest den Seitenstand ueber `duellGewonnen`. Dieses Muster deckt weder Speed-Schach
(`art.duell`, Sieg ueber `u.vorteil>0`, Remis moeglich) noch Showcase (kein Zweikampf, Seiten-
stand ist eine Summe) ab — deshalb zwei neue, aber strukturell fast identische Funktionen direkt
neben `spieleBuehneHeben()`:

```js
spieleBuehneDuell:(bd,saat)=>{
  if(typeof BUEHNE_ART==="undefined"||!BUEHNE_ART[bd]||!BUEHNE_ART[bd].duell)return null;
  const M=MOTOREN[bd]; if(!M)return null;
  const g=M.sichern(); if(M.vorher)M.vorher();
  M.bau(saat); M.lauf();
  const wert=M.wert(), namen=M.namen();
  const boxscore=namen.map(n=>({name:n,wert:wert[n]??0}));
  const bretter=(s)=>TEILNEHMER.filter(u=>u.side===s&&u.vorteil>0).length;
  const seiten=[bretter(0),bretter(1)];
  M.zurueck(g);
  return {disziplin:bd, seiten, boxscore};
},
spieleBuehneAuftritt:(bd,saat)=>{
  if(typeof BUEHNE_ART==="undefined"||!BUEHNE_ART[bd]||BUEHNE_ART[bd].heben||BUEHNE_ART[bd].duell)return null;
  const M=MOTOREN[bd]; if(!M)return null;
  const g=M.sichern(); if(M.vorher)M.vorher();
  M.bau(saat); M.lauf();
  const wert=M.wert(), namen=M.namen();
  const boxscore=namen.map(n=>({name:n,wert:wert[n]??0}));
  const summe=(s)=>TEILNEHMER.filter(u=>u.side===s).reduce((a,u)=>a+(u.summe||0),0);
  const seiten=[summe(0),summe(1)];
  M.zurueck(g);
  return {disziplin:bd, seiten, boxscore};
},
```

Beide sind GENERISCH ueber die `art`-Flags, nicht auf die Disziplins-ID hardcodiert: I-Spy
(`duell:true`) und die vier weiteren Auftritt-Buehnen (Eiskunstlauf, Breaking, Wettessen, Tennis,
Fechten) laufen hier automatisch mit, sobald sie in `ARENA_RESOLVED_DISCIPLINE_IDS` UND der
passenden Chassis-Menge (`ARENA_BUEHNE_DUELL_DISCIPLINE_IDS`/`ARENA_BUEHNE_AUFTRITT_
DISCIPLINE_IDS`, s. 2c) stehen — keine weitere Kopie dieser Funktionen fuer eine kuenftige Welle.

Kein `gesamtKg`: ein Duell-Gleichstand bei Speed-Schach (z.B. 3:3 der sechs Bretter) ist ein
ECHTES, plausibles Unentschieden (Remis sind Teil des Spiels) — anders als bei Heben, wo Chris
ausdruecklich moeglichst wenige Unentschieden wollte (Plan 3.5, Gesamt-kg-Tiebreak). Ohne
`gesamtKg` faellt `arenaTeamPointsForFixtureMitTiebreak()` unveraendert auf
`arenaTeamPointsForFixture()` zurueck.

### 2b. Der gefundene Motor-Fehler: Duell-Paarung zaehlte falsch

`bauBuehne()` baut `mine`/`gegner` aus der tatsaechlich GESETZTEN Aufstellung (`gesetzt`, aus
`place[]`) oder, falls leer, aus einer Ersatzliste — beide koennen KUERZER sein als
`art.jeSeite` (die feste Motor-Konstante, 6 fuer Speed-Schach). Die `art.duell`-Paarung direkt in
`bauBuehne()` iterierte trotzdem `for(let i=0;i<n;i++)` mit der AEUSSEREN `n` (=`art.jeSeite`),
nicht mit der tatsaechlichen Laenge von `mine`/`gegner`:

```js
// VORHER (Fehler):
if(art.duell){
  for(let i=0;i<n;i++){                       // n = art.jeSeite, IMMER 6
    const a=TEILNEHMER.find(x=>x.side===0&&x.n===mine[i].n);   // mine[i] undefined bei < 6 gesetzten Spielern
    ...
```

`baueHebenDuelle()` (Gewichtheben, dieselbe Datei, ~90 Zeilen weiter unten) hat exakt dasselbe
Problem bereits geloest — mit einer LOKALEN Neudefinition:

```js
function baueHebenDuelle(art,mine,gegner){
  const n=Math.min(mine.length,gegner.length);   // <- diese Zeile fehlte der Duell-Variante
  ...
```

Die Duell-Variante steht (anders als Heben) INLINE in `bauBuehne()` statt in einer eigenen
Funktion und hatte diese Zeile nie bekommen. Nachgemessen beim ersten Testlauf der neuen
PPS-Referenz-Ziehung mit `--feldgroesse=2`:

```
TypeError: Cannot read properties of undefined (reading 'n')
    at battle-mode.engine.js:10586 (bauBuehne, art.duell-Zweig)
```

Nie zuvor aufgefallen, weil `istArena("speed-schach")` seit jeher `false` war (Speed-Schach lief
nie durch die Arena-Fixture-Pipeline) und die interaktive Buehne im Mockup/Artefakt immer eine
volle Aufstellung zeigt (6 gesetzte Spieler oder eine volle Ersatzliste aus einem grossen Kader)
— der Pfad mit `gesetzt.length < art.jeSeite` UND einer kleinen Gesamt-Kaderliste trat vorher nie
auf. Behoben mit derselben lokalen `n=Math.min(mine.length,gegner.length)`-Zeile wie bei Heben
(als eigene Variable `duellBretter`, um die aeussere `n` fuer alles andere in `bauBuehne()`
unangetastet zu lassen).

### 2b-2. Zweiter gefundener Fehler: fehlende Slot-Definitionen fuer zwei Speed-Schach-Rollen

Nach dem Fix aus 2b lieferte die erste echte Referenz-Ziehung (`--feldgroesse=5`/`6`) einen
zweiten, unabhaengigen Absturz: `window.__arena` wurde nie bereit, weil die Seite selbst schon
beim Laden mit `TypeError: Cannot read properties of undefined (reading 'label')` abstuerzte —
NOCH VOR jedem Aufruf von `spieleBuehneDuell()`. Stack: `aufschluesselung()` (Zeile ~16671, die
Werte-Aufschluesselung fuer den Einlauf-Bildschirm) → `renderEinlauf()` → `reset()`, alle Teil
des normalen Seiten-Starts, unabhaengig von der spaeter simulierten Disziplin.

Ursache: `lib/lineups/matchday-slot-roles.ts` (TypeScript-Seite) fuehrt fuer `"speed-schach"`
**sechs** Rollen (`openingprep`, `patternread`, `clockpressure`, `calculation`, `endgame`,
`gambit`) — passend zu `jeSeite:6`. `SLOTS_JE_DISC["speed-schach"]` im Mockup-Motor
(`public/mockups/battle-mode.engine.js`) fuehrt aber nur **vier** davon (`endgame`/`gambit`
fehlen komplett). Diese Luecke ist EIGENSTAENDIG und AELTER als diese Aenderung — sie betraf
nie etwas, weil vor dieser Welle nie eine echte Aufstellung fuer Speed-Schach durch die
Arena-Bruecke lief. Zwei Auspraegungen:

- `slotAufschlag()` (der tatsaechliche In-Simulation-Bonus) behandelt eine fehlende
  `SLOTVON[slotId]` bereits defensiv (`if(!s2)return 0`) — ein auf "endgame"/"gambit" gesetzter
  Spieler bekommt seit jeher STILL keinen Slot-Bonus (0 statt eines echten Werts), aber es
  stuerzt nichts ab. Das ist eine eigene, kleine Balance-Luecke (zwei von sechs Rollen ohne
  Slot-Fit-Bonus), NICHT Gegenstand dieser Aenderung — sie betrifft gleichermassen den
  bestehenden Legacy-PPS-Pfad und ist unabhaengig von der Arena-Produktivierung. Empfehlung:
  eigener, kleiner Nachtrag (zwei fehlende Eintraege in `SLOTS_JE_DISC["speed-schach"]"
  ergaenzen, mit Profilen analog zu den vier bestehenden) — braucht eine bewusste
  Ballance-Entscheidung, kein Teil dieser PR.
- `aufschluesselung()` (nur die Werte-Anzeige im Einlauf-Bildschirm) hatte die GLEICHE
  Absicherung nicht und stuerzte deshalb hart ab — obwohl drei andere Stellen in derselben Datei
  (Zeilen ~12052, ~12055, ~16916) genau diesen Fall bereits mit `SLOTVON[x]?SLOTVON[x].label:x`
  abfangen. Behoben mit demselben, bereits etablierten Muster (kein neuer Ansatz).

```js
// VORHER (Fehler):
if(sl)teile.push(["Slot",slotAufschlag(p,sl,dId),
  "Passung zum Profil von "+SLOTVON[sl].label+" (+"+SLOTVON[sl].gross+" +"+SLOTVON[sl].klein+")."]);
// NACHHER:
if(sl){
  const slotDef=SLOTVON[sl];
  teile.push(["Slot",slotAufschlag(p,sl,dId),
    "Passung zum Profil von "+(slotDef?slotDef.label:sl)+" (+"+(slotDef?slotDef.gross:"?")+" +"+(slotDef?slotDef.klein:"?")+")."]);
}
```

### 2c. `arena-headless-runner.ts`: zwei neue Chassis-Mengen

Analog zu `ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS`:

```ts
export const ARENA_BUEHNE_DUELL_DISCIPLINE_IDS: ReadonlySet<string> = new Set(["speed-schach"]);
export const ARENA_BUEHNE_AUFTRITT_DISCIPLINE_IDS: ReadonlySet<string> = new Set(["showcase"]);
```

`runArenaFixtures()`s Chassis-Weiche kennt jetzt vier statt zwei Werte
(`"feldspiel" | "buehneHeben" | "buehneDuell" | "buehneAuftritt"`), inklusive der bereits
bestehenden "Review-Fund PR #776"-Absicherung (die Fehlermeldung nennt die tatsaechlich
aufgerufene Browser-Funktion).

### 2d. `battle-mode-arena-team-points.ts`: zwei neue PPS-Referenzen

`ARENA_RESOLVED_DISCIPLINE_IDS` traegt jetzt `"speed-schach"` und `"showcase"`;
`ARENA_IMPACT_KONFIG_JE_DISZIPLIN` je einen neuen Eintrag mit eigenen `SPEED_SCHACH_*`/
`SHOWCASE_*`-Konstanten (MAX 5,5 / Anteil-Mitte 0,25 — unveraendert von Basketballs Entscheidung
uebernommen, aus demselben Grund wie bei Gewichtheben/Hockey: Chris' Rahmen "max 5-6" und die
04.09.-Kurvenform-Messung gelten disziplinuebergreifend) und dem jeweiligen Katalog-
Standardwert (`Discipline.playerCount` in `lib/data/dataAdapter.ts`: Speed-Schach **2**,
Showcase **5** — beide NICHT 6, nachgesehen statt kopiert, wie schon bei Hockey mit 5).

Die schon bestehende "Querpruefung" (Review-Fund PR #776) wurde von einer einzelnen Menge
(nur Buehnen-Heben) auf eine Liste aller drei Buehnen-Chassis-Mengen erweitert — wirft weiterhin
sofort beim Modul-Laden, wenn eine Chassis-Menge und `ARENA_RESOLVED_DISCIPLINE_IDS`
auseinanderlaufen.

### 2e. Zwei neue PPS-Referenz-Skripte

`scripts/ziehe-speed-schach-pps-referenz.ts` und `scripts/ziehe-showcase-pps-referenz.ts`, beide
wortnahe Analoga zu `scripts/ziehe-gewichtheben-pps-referenz.ts` (identischer Mechanismus:
`buildArenaTeam()` fuer echte Kader, synthetische `LineupDraft`-Aufstellung mit den `n` besten
Spielern nach Eignung, `runArenaFixtures()` gegen den neuen Chassis-Einstiegspunkt, 60 Fixtures
je Feldgroesse ueber 2..6 gegen das echte `live-save`-Abbild). Ergebnis:
`data/generated/speed-schach-pps-referenz.json` / `data/generated/showcase-pps-referenz.json`.

**Kein Torwart-aehnliches Rollenproblem**: anders als Hockey hat weder Speed-Schach noch Showcase
eine Rolle mit strukturell anderer Wertverteilung — eine einzige Referenz je Feldgroesse genuegt
fuer beide.

---

## 3. Mid-Season-Risiko: geprueft, nicht vermutet

Wie bei Gewichtheben/Hockey: `isBattleModeSave(gameState)` (`lib/season/game-mode.ts`) ist der
EINE Schalter, der entscheidet, ob die Arena-Pipeline fuer einen Save ueberhaupt jemals aufgerufen
wird (`kickoffArenaMatchdayApply()` bricht sofort ab, wenn er `false` liefert) —
`ARENA_RESOLVED_DISCIPLINE_IDS`-Mitgliedschaft ist fuer einen Nicht-Battle-Mode-Save vollkommen
wirkungslos. Alle sieben Saves im aktuellen `live-save`-Abbild (frisch gezogen 06.09., 12:47 Uhr,
`git fetch origin live-save`):

| Save-ID | `scenarioMeta.gameMode` | `isBattleModeSave()` |
|---|---|---|
| new-game-1784747079649-n90y4m | (nicht gesetzt) | false |
| new-game-1785412846578-h0z7cl | (nicht gesetzt) | false |
| new-game-1785823388048-1hf25q | (nicht gesetzt) | false |
| new-game-1786465783606-0kalpx | (nicht gesetzt) | false |
| new-game-1786626914058-hwz8fk | (nicht gesetzt) | false |
| save-1786699040510-89rv3s | (nicht gesetzt) | false |
| new-game-1787123325719-swnjlk | (nicht gesetzt) | false |

**Diese Aenderung (wie die drei vor ihr) hat damit auf KEINEN von Chris' aktuellen Spielstaenden
eine sichtbare Wirkung** — `gameMode` wird bei Save-Anlage entschieden und aendert sich nie
wieder (Kommentar in `lib/season/game-mode.ts`). Das ist keine neue Einschraenkung dieser Welle,
sondern derselbe, bereits bei Gewichtheben und Hockey dokumentierte Befund
(`stand-aller-disziplinen.md`: "noch nicht gemergt/im echten Spielstand, kein aktiver Save nutzt
Battle Mode"). Chris' Auftrag, "sofort, mitten in der laufenden Saison" zu produktivieren, macht
den Code fuer den Moment bereit, in dem ein Save Battle Mode nutzt (ein neuer Save mit dieser
Wahl, oder eine kuenftige Umschaltung) — es aendert nichts an einem bereits laufenden
Manager-Mode-Save wie allen sieben oben.

### 3a. Reale Spieler-PPs, exemplarisch (Produktions-Kader, synthetischer Battle-Mode-Kontext)

Weil kein realer Save die Arena-Pipeline aktuell durchlaeuft, zeigt dieser Abschnitt die neuen
PPs an ECHTEN Spielern aus dem `live-save`-Abbild — mit `buildArenaTeam()` echte Kader zweier
realer Teams (B-B/C-C) geladen, die sechs besten Spieler je Team nach Eignung in die
Disziplin-Slots gesetzt, `scenarioMeta.gameMode` NUR IN-MEMORY (nicht in der Datei) auf
`"battle"` gesetzt, dann durch `runArenaFixtures()` +
`computeIndividualBoxscorePpsFromFixtureResults()` gejagt — derselbe Pfad, den ein echter
Battle-Mode-Spieltag nehmen wuerde:

**Speed-Schach, B-B gegen C-C (n=6):** Seitenstand 5:1 Bretter, B-B gewinnt (Team-Punkte 2:0).

| Spieler | Seite | roher Brettwert | PPs (neu) |
|---|---|---:|---:|
| Tsubaki Cleaning | heim | 886 | 2,67 |
| Arachna | heim | 841 | 2,36 |
| Mavra | heim | 763 | 1,88 |
| Babuschinka | gast | 758 | 1,85 |
| Xerathis | gast | 709 | 1,59 |
| Leviathan | heim | 566 | 0,94 |
| Butterfly | heim | 500 | 0,70 |
| Roddox Harthelm | gast | 490 | 0,67 |
| Enforcer | gast | 490 | 0,67 |
| Byrd | heim | 469 | 0,61 |
| Ironhoof | gast | 339 | 0,29 |
| Omniclops | gast | 252 | 0,14 |

**Showcase, dieselben zwei Teams (n=6):** Seitenstand 1609:1646 Punkte, C-C gewinnt knapp
(Team-Punkte 0:2).

| Spieler | Seite | roher Auftrittswert | PPs (neu) |
|---|---|---:|---:|
| Xerathis | gast | 479 | 3,62 |
| Babuschinka | gast | 341 | 1,67 |
| Butterfly | heim | 310 | 1,34 |
| Mavra | heim | 296 | 1,21 |
| Tsubaki Cleaning | heim | 278 | 1,04 |
| Leviathan | heim | 270 | 0,98 |
| Byrd | heim | 255 | 0,86 |
| Enforcer | gast | 253 | 0,84 |
| Roddox Harthelm | gast | 242 | 0,76 |
| Ironhoof | gast | 201 | 0,50 |
| Arachna | heim | 200 | 0,49 |
| Omniclops | gast | 130 | 0,18 |

**Einordnung, keine auffaelligen Spruenge:** in beiden Beispielen ordnet die neue PPs-Kurve die
Spieler in derselben Reihenfolge wie ihr roher Boxscore-Wert (per Konstruktion — die Kurve ist
monoton in `impact`) — es gibt keinen Fall, in dem ein schwacher Rohwert einen hohen PPs-Wert
bekommt oder umgekehrt. Der interessante Unterschied zum ALTEN PPS-Rangpfad ist strukturell, nicht
an diesen zwoelf Werten sichtbar: die neuen PPs haengen NUR vom eigenen Rohwert gegen eine feste
Referenz ab, nicht vom Rang des eigenen TEAMS in der Liga an diesem Spieltag — Xerathis bekommt in
Showcase die volle Naehe zum Deckel (3,62 von 5,5 MAX), OBWOHL ihr Team (gast) hauchduenn verliert
(1609 gegen 1646), waehrend der alte Rangpfad ihrem Team fuer einen Ligarang-basierten Verlustplatz
einen kleineren Punktetopf gegeben und ihn dann anteilig auf alle Gast-Spieler verteilt haette —
unabhaengig davon, wie gut Xerathis individuell war. Das ist die von Chris ausdruecklich gewuenschte
Eigenschaft des Boxscore-an-PPs-Modells (s. Kopfkommentar `battle-mode-arena-team-points.ts`:
"nicht in jedem Team-Duell soll automatisch ein Spieler des Gewinnerteams am besten dastehen"),
keine neue Beobachtung dieser Welle — aber an echten Namen sichtbar zu machen war Teil des
Auftrags (Schritt 3).

---

## 4. Kaderfeste Messung unveraendert

`node scripts/miss-alle-disziplinen.mjs 24 speed-schach showcase staffel basketball gewichtheben
hockey` NACH dieser Aenderung, verglichen mit dem PM-Briefing (06.09., an `6da7f9f5` gemessen —
demselben Stand, an dem diese Welle begonnen hat):

| Disziplin | rho je Spiel (PM-Briefing, vorher) | rho je Spiel (dieser Stand, nachher) |
|---|---:|---:|
| Staffel | 0,915 | 0,915 |
| Speed-Schach | 0,889 | 0,889 |
| Gewichtheben | 0,887 | 0,887 |
| Showcase | 0,880 | 0,880 |
| Basketball | 0,772 | 0,772 |
| Hockey (alle 12) | 0,669 | 0,669 |

**Ziffernidentisch**, wie erwartet: diese Aenderung ruehrt ausschliesslich an der Produktions-
Resolve-Schicht (`lib/resolve/`, `lib/battle/arena-headless-runner.ts`) und den NEUEN, additiven
Browser-Einstiegspunkten — `MOTOREN[disc].wert()`, das Rezept und der `istArena/istBuehne`-Motor-
Zustand selbst sind unveraendert. Die beiden Motor-Fixes (Abschnitt 2b/2b-2) aendern
Simulationsverhalten ausschliesslich fuer Pfade, die die kaderfeste Messung (immer sechs
Feldspieler je Seite, immer eine volle Aufstellung) nie erreicht: den `art.duell`-Zweig bei
WENIGER als sechs gesetzten Spielern und die Werte-Anzeige fuer auf "endgame"/"gambit" gesetzte
Spieler.

---

## 5. Regressionsnachweis

`npm test` (vollstaendige Suite, nicht nur battle-mode/arena-Testdateien): **1025 Testdateien
bestanden, 2 uebersprungen (1027 gesamt); 8111 Einzeltests bestanden, 23 uebersprungen
(umgebungsbedingt — Chromium-Verfuegbarkeit u. AE., unveraendert zu vorher)**. Kein bestehender
Test veraendert oder rot geworden.

Gezielt vorher (schneller, isoliert) geprueft:

- `tests/battle-mode-arena-team-points.test.ts`: **71/71 Tests gruen** (64 vor dieser Aenderung,
  `ARENA_RESOLVED_DISCIPLINE_IDS.has("speed-schach"/"showcase")` noch `false`, unveraendert
  bestanden), plus 7 neue Tests: `ppsAusSpeedSchachImpact`/`ppsAusShowcaseImpact`,
  `resolveSpeedSchachPpsReferenz`/`resolveShowcasePpsReferenz`, die erweiterte Querpruefung ueber
  alle drei Buehnen-Chassis-Mengen, `computeIndividualBoxscorePpsFromFixtureResults` mit
  `disciplineId="speed-schach"/"showcase"`, sowie ein expliziter Regressionstest, dass Staffel
  NICHT in `ARENA_RESOLVED_DISCIPLINE_IDS` steht.
- `tests/arena-headless-runner.test.ts` (echter Chromium-Lauf): **9/9 Tests gruen** (7 vor
  dieser Aenderung, unveraendert bestanden), plus 2 neue Tests fuer die beiden neuen Chassis
  (`spieleBuehneDuell`/`spieleBuehneAuftritt`).
- `tests/legacy-matchday-resolve.test.ts`, `tests/battle-mode-arena-matchday-resolve-e2e.test.ts`,
  `tests/legacy-matchday-apply-api.test.ts`, `tests/legacy-matchday-preview-api.test.ts`,
  `tests/legacy-matchday-readiness.test.ts`, `tests/legacy-matchday-result-apply-service.test.ts`,
  `tests/legacy-matchday-result-mapper.test.ts`: unveraendert bestanden (keine dieser Dateien
  nutzt Speed-Schach/Showcase als Beispieldisziplin, s. Recherche in Abschnitt 0 unten).
- `tests/gewichtheben-kg-folgt-dem-score.test.ts`, `tests/basketball-pps-referenz-drift.test.ts`,
  `tests/arena-matchday-panel-ovr-rank-wiring.test.ts`: unveraendert bestanden (Isolations-
  nachweis: Gewichtheben/Basketball unberuehrt).
- `node scripts/miss-alle-disziplinen.mjs 24 <betroffene Disziplinen>`: ziffernidentisch zum
  PM-Briefing-Stand, s. Abschnitt 4.

### 5a. Bestehende Tests fuer den alten PPS-Rangpfad — laufen unveraendert weiter

Durchsucht (`grep` nach `"speed-schach"`/`"showcase"` in `tests/`): keine der Legacy-Resolve-
/Arena-Matchday-Testdateien (`legacy-matchday-resolve.test.ts`,
`battle-mode-arena-matchday-resolve-e2e.test.ts` u.a.) verwendet Speed-Schach oder Showcase als
Beispieldisziplin fuer ihre "das laeuft ueber den alten Pfad"-Faelle — sie nutzen `"mini-dm"`/
`"fechten"`/`"basketball"`. Kein Test musste deshalb umgeschrieben werden (anders als bei Hockey
war hier keine Kollision zu vermeiden). Alle anderen Testdateien, die Speed-Schach/Showcase
erwaehnen (`player-generator-service.test.ts`, `season-discipline-area-groups.test.ts` u.v.a.),
behandeln sie als Teil einer generischen 20-Disziplinen-Iteration (Katalogmetadaten, Kaderbau,
Spielplan) — unberuehrt von der Resolve-Weiche.

---

## 6. Geaenderte/neue Dateien

- `public/mockups/battle-mode.engine.js` — zwei neue `window.__arena`-Einstiegspunkte
  (`spieleBuehneDuell`, `spieleBuehneAuftritt`), additiv neben `spieleBuehneHeben`; ein
  Bugfix in der bestehenden `art.duell`-Brettpaarung (Unterzahl-sicher, s. Abschnitt 2b).
- `lib/battle/arena-headless-runner.ts` — `ARENA_BUEHNE_DUELL_DISCIPLINE_IDS`,
  `ARENA_BUEHNE_AUFTRITT_DISCIPLINE_IDS`, `chassis`-Typ um zwei Werte erweitert.
- `lib/resolve/battle-mode-arena-team-points.ts` — `ARENA_RESOLVED_DISCIPLINE_IDS` erweitert;
  `SPEED_SCHACH_*`/`SHOWCASE_*`-Konstanten, `ppsAusSpeedSchachImpact()`/`ppsAusShowcaseImpact()`,
  `resolveSpeedSchachPpsReferenz()`/`resolveShowcasePpsReferenz()`, zwei neue
  `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`-Eintraege; Querpruefungs-Schleife auf alle drei
  Buehnen-Chassis-Mengen erweitert.
- `data/generated/speed-schach-pps-referenz.json`, `data/generated/showcase-pps-referenz.json`
  — neu, gezogen gegen das echte `live-save`-Abbild.
- `scripts/ziehe-speed-schach-pps-referenz.ts`, `scripts/ziehe-showcase-pps-referenz.ts` — neu,
  Analoga zu `scripts/ziehe-gewichtheben-pps-referenz.ts`.
- `tests/battle-mode-arena-team-points.test.ts`, `tests/arena-headless-runner.test.ts` — neue
  Tests, s. Abschnitt 5.
- `docs/design/stand-aller-disziplinen.md`, `docs/design/speed-schach-showcase-produktivierung.md`
  (dieser Bericht) — Dokumentation.

Kein bestehender Test veraendert ausser der `ARENA_RESOLVED_DISCIPLINE_IDS`-Mengen-Pruefung
selbst (dieselbe Erweiterung, die schon bei Hockey die Basketball/Gewichtheben-Assertion um zwei
Zeilen ergaenzt hat).

---

## 7. Offene Punkte fuer Chris

1. **Staffel folgt, sobald es eine echte Punkte-je-Laeufer-Wertung hat** (Abschnitt 1) — kein
   neuer Auftrag, sondern derselbe wie "Wertungstabelle Welle 2" im PM-Briefing.
2. **I-Spy** (ebenfalls `duell:true`) und die vier weiteren Auftritt-Buehnen (Eiskunstlauf,
   Breaking, Wettessen, Tennis, Fechten) sind technisch durch dieselben zwei neuen
   Chassis-Funktionen abgedeckt — nur ihre eigene PPS-Referenz fehlt noch. Naechste, kleine
   Welle, kein neuer Chassis-Bau mehr.
3. Dieselbe offene Frage wie bei Gewichtheben/Hockey: ob Buehnen-Visualisierungen spaeter auf
   literale Arena-Werte umgestellt werden sollen — unveraendert offen, keine neue Dringlichkeit
   durch diese Aenderung.

PRODUKTIONSCODE — besondere Review-Sorgfalt angefordert, kein automatischer Merge.
