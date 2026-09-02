# Review PR #736 „Die Aufstellung erreicht endlich die Arena" (Fable, Overseer Phase 2)

Geprüft: `origin/claude/aufstellung-erreicht-arena` (`94ce94ac`, Basis `origin/main`
`fff35048`, fünf Dateien, +221/−6). Der Branch wurde in einen eigenen Worktree ausgecheckt und
dort gemessen; jede Zahl unten trägt einen Lauf, dessen Quelle-Zeile auf
`…/scratchpad/pr736/public/mockups/battle-mode.html` zeigt. Für die Adapter-Prüfung diente der
echte Spielstand-Export `data/online-saves/fresh-season-1-1785859604037.json.gz` (2984 Spieler,
32 Teams, 64 Aufstellungsentwürfe mit 480 Einträgen).

---

## Urteil

**Nicht mergen.** Das Rohr ist an der richtigen Stelle angesetzt und der Motor-Teil ist sauber
— aber **in Produktion transportiert es nichts**: `activePlayerId` ist im echten Spielstand die
Kader-Eintrags-Id (`season-loop-roster-7`), keine Spieler-Id, und der Adapter sucht sie in einer
Karte über `player.id`. Gemessen am echten Export: **0 von 480 Einträgen** kommen an. Die
„mit Aufstellung"-Messung des Autors kann nur mit einem handgebauten Entwurf ohne
`activePlayerId` entstanden sein. Dazu ein zweiter Bruch, den der Autor selbst als
wahrscheinlichste Stelle benannt hat und den ich bestätige: ein unvollständiger Entwurf tritt
mit zu wenigen Spielern an (3 gegen 6, gemessen). Und ein dritter, den er nicht benannt hat:
die Auswahl „wer antritt" gilt **nur für die Heimseite** — `gegner=OPP.slice(0,n)` liest `place`
nicht.

Alles drei ist mit wenigen Zeilen zu beheben; die Bauform des PRs bleibt richtig.

---

## Was ich selbst gemessen habe, was ich nur gelesen habe

**Gemessen:**

| Prüfung | Lauf | Ergebnis |
|---|---|---|
| Basketball ohne Aufstellung, PR-HTML | `miss-feldspiel-rangtreue.mjs basketball 12 6 <pr736-html>` | rho 0,847 / 0,818 · Pkt 84,9 · Ballw. 100,2 · FGA 82,1 · Usage 32,7 % — **zeichengleich** mit meinem `main`-Lauf gleicher Größe (0,847 / 0,818 / 84,9 / 100,2 / 82,1 / 32,7). Bit-Identität bestätigt, n=12 |
| Adapter gegen echten Spielstand | `tsx`-Sonde mit `buildArenaAufstellung` über alle 64 Entwürfe | **64 Entwürfe leer, 0 von 480 Einträgen angekommen**; mit `activePlayerId=null` kommen alle 9 Einträge des Beispiel-Entwurfs an |
| Was `activePlayerId` ist | dieselbe Sonde | `season-loop-roster-7` ist `rosters[].id`, verweist auf `playerId player-0006-pooka` = `entry.playerId`. **480 von 480** Einträgen tragen einen `activePlayerId`; kein Spieler steht in einem Entwurf in mehr als einem Eintrag |
| Kennungs-Umrechnung | `tsx`-Sonde: `resolveSlotRoleShortId(d, null, i)` gegen `SLOTS_JE_DISC[d][i].id` für alle 20 Disziplinen und i = 0..5 | **20 von 20 stimmen Index für Index**; dazu `resolveSlotRolesForDiscipline(d, null, 6)` mit abgeschnittenem Präfix gleich. Vier Disziplinen haben im Motor nur 4 Slots (mini-dm, battlefield, spurt, speed-schach), die Themenliste 6 |
| Unvollständiger Entwurf | Playwright-Sonde gegen PR-HTML, Standardkader, `aufstellung` mit 3 Basketball-Einträgen | Heim tritt mit **3** Spielern an (`Draco, Johanna, Gram`), Gast mit 6; Endstand 29:60; kein Seitenfehler |
| Gastseite | dieselbe Sonde, 6 Heim- und 2 Gast-Einträge | Gast-Aufstellung ändert **nicht**, wer antritt (dieselben sechs wie ohne), nur ihre Slot-Aufschläge |
| Unbekannte Slot-Id (`goaltender`, `nix`) | dieselbe Sonde | kein Seitenfehler; Spieler tritt an, Aufschlag still 0 |
| Doppelte Namen im echten Spielstand | Node über den Export | **0** Doppel unter 2984 Spielern; 7 Spieler tragen das Generator-Muster (`Elara`, `Orion` …), keiner davon in einem Kader |
| Namensgenerator | `buildGeneratedName`, `player-generator-service.ts:519-524` | 20 Präfixe × 14 Suffixe = **280 Kombinationen**, keine Eindeutigkeitsprüfung; `buildFreeAgentPlayerId` (`commit-draft-to-free-agent.ts:66-80`) entdoppelt nur die **Id**, nicht den Namen |
| Tests | `vitest run tests/arena-headless-runner.test.ts tests/battle-mode-arena-team-points.test.ts` im PR-Worktree | 2 Dateien, **16 Tests grün**, 98,8 s. Kein Test deckt die Aufstellung ab (der PR bringt keinen mit) |

**Nur gelesen:** die Aufstellungs-Oberfläche in der App; die Zahlen des Autors (rho 0,836 /
0,804, Pkt 87,3, Dracos Eignung 40,92 → 50,72 — plausibel, nicht reproduziert, weil sein
Testentwurf nicht im PR liegt); ob das Mockup im Standalone-Betrieb weiter die Beispiel-Tafel
zeigt.

---

## Befunde, nach Schwere

### 1. `activePlayerId` ist eine Kader-Eintrags-Id — der Adapter verwirft jeden Eintrag (blockierend)

`arena-aufstellung-adapter.ts:61-64`:

```ts
const spielerId = eintrag.activePlayerId ?? eintrag.playerId;
const name = nameVon.get(spielerId);   // nameVon: player.id -> name
if (!name) continue;
```

Im echten Spielstand ist `activePlayerId` `"season-loop-roster-7"` und `nameVon` ist über
`player.id` gebaut (`:56`). Ergebnis gemessen: 0 von 480. Die Semantik im Rest des Codes ist
eindeutig: `legacy-lineup-lab.ts:97` setzt `activePlayerId: activePlayer.id` mit
`activePlayer` = `LegacyActivePlayerRef` (Kaderzeile) und `playerId: activePlayer.playerId`;
`ai-legacy-lineup-engine.ts:587` ebenso; `ai-transfer-window-session-service.ts:329`
`activePlayerId: entry.id` (Roster-Eintrag). **`activePlayerId` ist nicht „der eingewechselte
Spieler", sondern die Zeile im Kader, über die derselbe Spieler steht** — im Export ist
`rosters.find(r => r.id === activePlayerId).playerId === entry.playerId` in allen geprüften
Fällen.

Reparatur (Adapter, drei Zeilen):

```ts
const rosterZuSpieler = new Map(gameState.rosters.map((r) => [r.id, r.playerId]));
const spielerId = (eintrag.activePlayerId && rosterZuSpieler.get(eintrag.activePlayerId)) ?? eintrag.playerId;
```

Und der Kommentar „`activePlayerId` gewinnt: er trägt den tatsächlich eingewechselten Spieler"
(`:58-60`) muss weg — er beschreibt eine Semantik, die es nicht gibt.

**Auflage:** ein Test, der einen echten `LineupDraft` mit `activePlayerId` als Roster-Id durch
`buildArenaAufstellung` schickt und neun Namen erwartet. Ohne diesen Test wäre der Fehler beim
nächsten Umbau wieder da.

### 2. Unvollständiger Entwurf → Unterzahl (schwer, vom Autor benannt, bestätigt)

`engine.js:4011` (unverändert): `const mine=(gesetzt.length?gesetzt:ersatz).slice(0,n);`.
Sobald **ein** Spieler gesetzt ist, ist `ersatz` aus dem Spiel. Gemessen: drei gesetzte
Basketball-Spieler → Heim spielt 3 gegen 6, 29:60. In Produktion ist das nicht exotisch: die
Arena-Ansicht (`FoundationBattleArenaHost.tsx`) liest den Spieltag im Status `planning` — genau
dann ist der Entwurf typischerweise halb fertig. Für die Bühne (`:6994`), den Kampf (`:8481`)
und die Bahn (`:10796`) gilt derselbe Ausdruck; das Rohr füttert **alle vier** Motoren, nicht
nur das Feldspiel.

Richtige Regel: gesetzte Spieler zuerst, dann mit den besten Ungesetzten nach Disziplinwert
auffüllen:

```js
const mine=[...gesetzt, ...ersatz.filter(p=>!gesetzt.includes(p))].slice(0,n);
```

Dasselbe an den drei anderen Stellen. Bit-Identität ohne Aufstellung bleibt (`gesetzt` leer →
`ersatz`), und mit voller Aufstellung ändert sich nichts.

### 3. Die Gastseite liest `place` nicht (mittel, nicht benannt)

`engine.js:4012` (unverändert): `const gegner=OPP.slice(0,n);` — die ersten n nach
TDM-Sortierung des Adapters (`buildArenaTeam` sortiert nach `d.tdm`, `arena-kader-adapter.ts:157`),
ohne Disziplinwert und ohne `place`. Gemessen: zwei Gast-Einträge ändern die Aufstellung des
Gastes nicht. Das ist ein **Alt-Fehler** (die Gastseite spielte in jeder Disziplin ihre sechs
TDM-Besten), aber der PR macht ihn asymmetrisch: die Heimmannschaft bekommt ihre Aufstellung,
die Gastmannschaft nicht. Sobald PR 9 den Spieltag über die Arena auflöst, entscheidet die
Heim/Gast-Zuweisung des Fixtures, wessen Aufstellung gilt.

Reparatur: `gegner` denselben Weg wie `mine` gehen lassen — `inDisc` über `OPP` und die
Auffüllregel aus Befund 2. `inDisc` filtert heute nur `SQUAD` (`:7328`); eine Variante mit
Liste als Parameter ist eine Zeile.

### 4. Die zweite Wirkung ist zu viel für Schritt R — aber nicht, weil sie falsch ist (mittel)

Schritt R war in meiner Reihenfolge „nur Slot-Aufschläge", weil das die einzige Wirkung ist,
die sich gegen `main` bit-identisch abnehmen lässt. „Wer antritt" ist inhaltlich richtig (Chris
setzt sechs, sechs spielen) und steht seit jeher im Motor (`inDisc` für die Mockup-Tafel). Was
fehlt, ist die **Abnahme** dafür: eine Messung, die zeigt, dass mit voller Aufstellung die
gesetzten sechs antreten (Autor: ja, für Heim), dass Unterzahl nicht entsteht (Befund 2) und
dass beide Seiten gleich behandelt werden (Befund 3). Mit diesen zwei Reparaturen ist die
Wirkung akzeptabel — als eigener Abnahmepunkt im PR-Text, nicht als Nebensatz.

### 5. Kennungs-Umrechnung über den Index: trägt (klein, geprüft)

`resolveSlotRoleShortId` liest `DISCIPLINE_ROLE_THEMES[id][slotIndex]` ohne Kadergröße. Das
ist richtig, weil `buildGeneratedSlotRoles` `themes.slice(0, slotCount)` nimmt
(`matchday-slot-roles.ts:504`) — ein Präfix, keine Umsortierung; Index i ist Thema i für jede
Kadergröße. Für alle 20 Disziplinen gegen `SLOTS_JE_DISC` geprüft, Index für Index gleich.

Zwei Ränder, beide still: (a) in vier Disziplinen hat der Motor nur 4 Slots
(`slotZahl` in `generiere-arena-daten.ts`, `playerCount·2` gedeckelt), die Themenliste 6 —
ein Spieltag mit 5 oder 6 Spielern in `spurt` liefert `slotIndex 4/5` → `topspeed`/`photofinish`,
die `SLOTVON` nicht kennt → `slotAufschlag` 0 (`engine.js:2870`), kein Fehler, kein Hinweis;
(b) eine unbekannte Kennung (`goaltender` heute) genauso. Beides gemessen: kein Seitenfehler,
Aufschlag still 0. Ein `console.warn` an `slotFuer`, wenn `SLOTVON[slot]` fehlt, würde die
Torwart-Runde später vor genau dieser Stille bewahren.

Und ein Hinweis für Schritt G (Slot-Generator): sobald das Torwart-Thema an Index 2 sitzt,
verschiebt sich für Hockey **jede** Slot-Kennung ab Index 2 — gespeicherte `slotIndex`-Werte
alter Entwürfe zeigen dann auf andere Rollen. Die Umrechnung über den Index ist die richtige
Bauform, aber sie bindet die Entwürfe an die Themenreihenfolge.

### 6. Namensschlüssel (klein heute, real morgen)

`place` über Namen ist die vorhandene Bauform (`SPIELER_NACH_NAME`, Sprites, Formkarten — alles
im Motor hängt am Namen). Im echten Export: 0 Doppel unter 2984. Der Generator aber baut Namen
aus 20 × 14 = 280 Kombinationen **ohne** Eindeutigkeitsprüfung (`player-generator-service.ts:523`),
und `buildFreeAgentPlayerId` entdoppelt nur die Id. Ab ~20 generierten Free Agents in einem
Spielstand ist ein Doppel wahrscheinlicher als nicht (Geburtstagsschranke bei 280). Was dann
passiert: `aufstellung[name]` — Heim zuerst, Gast überschreibt (`buildArenaAufstellungBeide`,
Spread-Reihenfolge); der Heimspieler verliert seinen Slot, still. Merken tut man es nicht.

Keine Auflage für diesen PR (Alt-Bauform), aber ein Satz im Kommentar von
`buildArenaAufstellungBeide` gehört korrigiert: „Namen sind über beide Kader eindeutig, weil
ein Spieler nur in einem Team steht" — das begründet Eindeutigkeit von Spielern, nicht von
Namen. Und ein `console.warn` bei Kollision kostet drei Zeilen.

### 7. `matchdayState.matchdayId` statt des aufgelösten Spieltags (klein, für PR 9 relevant)

Der Headless-Runner liest `gameState.matchdayState?.matchdayId`
(`arena-headless-runner.ts:182`), der Resolve-Pfad kennt aber seinen Spieltag explizit
(`runBattleModeArenaMatchday({matchdayId})`, `battle-mode-arena-team-points.ts:151`, von
`app/api/resolve/legacy-matchday-apply/route.ts:33` aus dem Request). Solange die Auflösung vor
dem Weiterschalten läuft (`matchday-progress-service.ts:318` setzt `matchdayState` erst danach),
sind beide gleich. Sauberer ist, `matchdayId` als Parameter durch `runArenaFixtures` zu reichen —
der Runner ist dann nicht auf einen Zustand angewiesen, der zufällig passt.

### 8. Reihenfolge im Mockup (bestätigt)

Das Einspielen hinter der Beispiel-Tafel (`engine.js:7287-7327`) ist korrekt und der Kommentar
dazu ehrlich. Nebenwirkung, die der Kommentar richtig benennt: ein produktiv gesetzter Spieler
verschwindet aus der TDM/Spurt-Beispiel-Tafel. Für die App ist das gewollt; für die
Standalone-Datei unerheblich (dort ist `echterKader` null).

---

## Zu Frage 5: verbaut R etwas für `formation[rolle].{angriff,abwehr}`?

Nein. Die Datenform aus meiner Recherche (6.2) braucht drei Dinge, und R liefert genau das
erste: die **Rollen-Id je Spieler** in `place[p.n].slot`, kurz und disziplinweise. Der Lookup
`formation[u.rolle]` kann direkt an `slotFuer(p,i)` andocken — `bauSpieler` müsste die Kennung
nur ins Spielerobjekt schreiben (`rolle: sl`), was heute nicht passiert (`:4040-4060`: `sl`
wird für den Aufschlag gelesen und verworfen). Das ist eine Zeile und gehört in den
Formation-PR, nicht in diesen.

Zwei Dinge, die R **nicht** vorwegnehmen darf und auch nicht tut: `u.slotIdx` bleibt die
Schusswert-Sortierung (richtig — die Familienregel kommt mit F), und die Rückfall-Kennung
`slotListe[i % length]` (`:4013`) bleibt reihum. Für F muss der Rückfall dann *sinnvoll* sein
(die besten sechs ohne Aufstellung sollten nicht reihum Center/Guard sein, sondern nach
Passung — `besterFuer` existiert schon, `:2883`). Das ist eine Änderung, die R nicht
verhindert, aber auch nicht vorbereitet.

Eine echte Weiche gibt es: Befund 2 und 3 verlangen, dass „wer antritt" für beide Seiten und
mit Auffüllung gebaut wird. Wird das **jetzt** repariert, kann F darauf aufsetzen; wird es
vertagt, muss F zuerst dieselben vier Stellen anfassen.

---

## Auflagen

1. Roster-Id → Spieler-Id im Adapter (Befund 1), Kommentar korrigieren, Test mit echtem
   Entwurf.
2. Auffüllregel an allen vier `mine=`-Stellen (Befund 2).
3. Gastseite über `place` (Befund 3), Spiegeltest danach (`miss-arena-feldspiel-spiegel.mjs`),
   Erwartung 0,0 %.
4. `console.warn` bei unbekannter Slot-Kennung in `slotFuer` (Befund 5) und bei Namenskollision
   in `buildArenaAufstellungBeide` (Befund 6).
5. PR-Text: die zweite Wirkung als eigener Abnahmepunkt mit Messung (Heim **und** Gast, voll
   **und** unvollständig).

Optional, nicht blockierend: `matchdayId` als Parameter durch den Runner (Befund 7).
