# Umsetzungsplan: Battle Mode als echter zweiter Spielmodus neben Manager Mode

Recherche-Stand: 2026-08-26, Repo `/home/user/Olympiade-der-Welten`, geprüft gegen `origin/main`
(Commit `a84c0c33`, „Liga-Split PR2+3+6+4+5" bereits gemerged). Alle Datei-/Funktionsangaben sind
gegen den echten Code geprüft, nicht vermutet. Erarbeitet auf Basis von Chris' bereits getroffener
Entscheidung „Echte Moduswahl, Arena entscheidet".

---

## 0. Wichtige Funde vorab (die Annahmen im Auftrag präzisieren oder ihnen widersprechen)

1. **Der Liga-Split-Bug ist real und lokalisiert.** `buildNewGameStateFromBaseline()`
   (`lib/game/new-game-setup-service.ts`, Z. 277–460) ruft `buildInitialLeagueAssignment()`
   und setzt `leagueByTeamId` **unbedingt**, für jedes neu angelegte Spiel — unabhängig vom
   gewählten Preset. `isLeagueSplitActive()` (`lib/season/league-split.ts`) ist bewusst als „der
   eine Schalter" gebaut: „gesetzt und nicht leer" heißt Split aktiv. Die Reparatur ist damit
   chirurgisch: **diese eine Zuweisung (plus den `buildSeasonFixtureSchedule()`-Aufruf direkt
   daneben) hinter `gameMode === "battle"` gaten** — der Rest der bereits gebauten Liga-Split-/
   Sponsor-/Facility-Infrastruktur bleibt komplett unangetastet, weil sie sich nie direkt nach
   `gameMode` erkundigt, sondern immer nur nach `isLeagueSplitActive()`. Das ist der zentrale
   Architektur-Hebel dieses Plans (Abschnitt 1).
2. **`tests/new-game-setup-service.test.ts` Z. 101–103 behauptet heute das Gegenteil vom
   Zielzustand**: „jedes neue Spiel bekommt `leagueByTeamId` mit 32 Einträgen". Dieser Test muss
   umgeschrieben werden (Default-Preset ohne `gameMode` → **kein** `leagueByTeamId`; `gameMode:
   "battle"` → wie bisher). Ohne diese Änderung bleibt der Bugfix von einem grünen, aber falschen
   Test blockiert.
3. **Es gibt heute keinen „Moduswahl"-Schritt im New-Game-Flow — nur ein Team-Auswahl-Raster.**
   Der komplette „Neues Spiel starten"-Wizard lebt in
   `app/foundation/team-settings/FoundationTeamSettingsNewLook.tsx`
   (`renderNewGameWizard()`, `data-testid="new-game-setup-wizard"`), mit State/Handlern in
   `lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx`. `NewGamePresetId` (`solo_1`,
   `solo_2`, `solo_4`, `online_4v4`, `custom`) wird laut explizitem Code-Kommentar seit dem
   „Single-Player-first"-Umbau **immer auf `"custom"` normalisiert** — das Preset-Feld ist nur
   noch ein Altlast-Passthrough für `/api/new-game`, keine echte UI-Auswahl mehr. Es gibt aktuell
   **keinen** Ort, an dem irgendetwas „Modus" im Sinne von Chris' Entscheidung ausgewählt wird.
   Der Battle-Mode-Umschalter braucht ein **neues** Bedienelement in genau diesem Wizard.
4. **Der Fixture-/Spielplan-Mechanismus existiert, ändert aber laut eigenem Datei-Kommentar
   „KEINE Punkte"** (`lib/season/season-fixture-schedule.ts`, Kopfkommentar). Das Scoring bleibt
   überall ein **Rennen**: `rankWithinLeagueScope()` in `lib/resolve/legacy-matchday-resolve-engine.ts`
   rankt alle Teams **einer Liga gemeinsam** je Disziplin/Seite (`rankDescendingSharedTies`), egal
   wer gegen wen laut Spielplan „antritt". Das ist eine wichtige Weiche für Battle Mode
   (Abschnitt 3, Kernfrage 3): Chris' offene Frage aus `liga-split-plan.md` Abschnitt 10.2 („soll
   die Paarung später auch Punkte geben?") wird durch Battle Mode für Basketball zum ersten Mal
   mit Ja beantwortet.
5. **Die Arena-Engine ist untrennbar an DOM/Canvas gekoppelt — kein Node-ohne-Browser-Pfad
   existiert oder ist ohne größeren Umbau erreichbar.** `public/mockups/battle-mode.engine.js`
   (9.781 Zeilen, eine IIFE) ruft **beim Modul-Laden, nicht erst beim Rendern**, `new Image()`
   (Z. 18, 70) und `document.createElement("canvas")` samt `getContext("2d",{willReadFrequently:
   true})` (u. a. Z. 124–131, für Sprite-Einfärbung per Pixel-Zugriff) auf. Ein reiner
   Node-Import würde an `document is not defined` scheitern, bevor überhaupt simuliert wird.
   Alle bisherigen automatisierten Läufe dieser Session (`scripts/miss-arena-serie.mjs`,
   `scripts/messe-arena-einfluss.mjs`) fahren deshalb **echten Chromium via Playwright**
   (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`), nicht Node pur.
6. **Der von Chris in der Aufgabenstellung vermutete Hook `spieleBasketball(seed)` existiert
   noch nicht.** `window.__arena` (engine.js Z. 9703–9781) exponiert `serie`/`serieVon` (TDM),
   `bahnSerie`/`spurtSerie` (Bahn), `boxscoreSerie`, `diagPositionen` (Basketball, aber nur
   Positions-Diagnose, kein Endergebnis) — **kein einziger Aufruf liefert für Feldspiel/Basketball
   ein sauberes „einmal simulieren, Endstand + Boxscore zurückgeben"**. Was **wohl** existiert und
   direkt wiederverwendbar ist: die interne `MOTOREN`-Registry (Z. ~9500–9546), in der sich jede
   Disziplin „selbst anmeldet" mit `sichern()/zurueck()` (State-Snapshot, verhindert Verschmutzung
   zwischen Läufen), `bau(saat)` (Aufbau mit Seed), `lauf()` (stille Simulation ohne Rendering:
   `while(!done&&g<120){ stepFeldspiel(1/60); g+=1/60; }`) und `wert()` (Boxscore-Formel:
   „Punkte zählen voll, Rebounds/Steals/Blocks etwas weniger, Ballverlust zieht ab"). **Phase 1
   braucht einen kleinen, additiven Patch an `engine.js`**, der genau diese drei MOTOREN-Aufrufe
   für `basketball` unter einem neuen, aufgeräumten `window.__arena`-Eintrag zusammenfasst (siehe
   Abschnitt 3, Kernfrage 3) — kein Rewrite, eine Handvoll Zeilen nach demselben Muster wie
   `namenVon()`/`feldspielSubskills()` direkt daneben.
7. **Performance-Realität, nachgemessen von früheren Sitzungen, nicht spekuliert**: Der
   Kopfkommentar von `scripts/messe-arena-einfluss.mjs` sagt wörtlich „Ein Rennen rechnet in
   Millisekunden, ein Teamfight in Sekunden" — bei TDM (playerCount 2, kleinster Feldspiel-nahe
   Fall) 150 Kämpfe in gut zwei Minuten, macht **grob 0,8 s reine Rechenzeit pro Kampf**, sobald
   die Seite/Browser bereits geladen ist. Der dominante Kostenblock aus früheren Playwright-Läufen
   ist der **Browser-Start + Seiten-Load**, nicht die Simulation selbst. Das ist die zentrale
   Grundlage für die Performance-Antwort in Abschnitt 3, Kernfrage 4.
8. **Es gibt bereits genau das Architekturmuster, das ein „mehrere Sekunden dauerndes
   Hintergrund-Resolve" braucht.** `lib/game/league-setup-draft-service.ts`
   (`kickoffLeagueSetupDraft()`) startet den ~40 s dauernden Whole-League-KI-Draft **detached**
   (`void (async () => {...})()`), setzt sofort `seasonState.leagueSetupStatus: "in_progress"`
   zurück an den Aufrufer, und die Foundation-Shell pollt bis `"ready"/"failed"`. Exakt dasselbe
   Muster (nicht neu erfinden) trägt den Battle-Mode-Matchday-Resolve über die Proxy-/Request-
   Timeout-Grenze (Abschnitt 3, Kernfrage 4).
9. **Das Ergebnisformat der bestehenden Resolve-Pipeline ist bereits so geschnitten, dass sich
   ein Arena-Ergebnis sauber „andocken" statt „ersetzen" lässt.** `TeamResolvePreview`
   (`lib/resolve/legacy-matchday-resolve-types.ts`) trägt pro Team exakt `d1Score/d1Points` und
   `d2Score/d2Points` (jeder Spieltag hat **genau zwei** Disziplinen,
   `getRequiredSeasonDisciplineMatchdayCount()`), `totalPoints = d1Points + d2Points` speist
   direkt `SeasonState.standings`. Ein Arena-Ergebnis muss also nur eine
   `DisciplineTeamResolvePreview` (Rang + `teamPoints`) für die Basketball-Seite liefern — **nicht**
   das gesamte Auswertungsformat neu erfinden.
10. **`getRankToPointsValue(playerCount, rank)`** (`lib/resolve/rank-to-points.ts`) erwartet als
    `playerCount` die **Disziplin-Feldgröße** (2–6, aus `references/sheets/rank-to-points.json`),
    nicht die Anzahl konkurrierender Teams — der `rank`-Parameter läuft 1..16 (Liga-Split aktiv)
    oder 1..32 (Legacy). Diese Funktion bleibt für Battle Mode **komplett unverändert**
    wiederverwendbar, wenn man aus dem Arena-Duell einen synthetischen Rang 1..16 ableitet (Details
    Abschnitt 3, Kernfrage 3) — keine neue Punkte-Ökonomie nötig, keine Neukalibrierung gegen die
    zweite (PPS-)Disziplin desselben Spieltags.
11. **Chris hat sich zum Punktemodell für Arena-Ergebnisse bereits einmal geäußert — an anderer
    Stelle, nicht final entschieden.** `docs/BATTLE_ARENA_UEBERGABE.md` Abschnitt F hält fest:
    „Tabellen-Punkte: Sieg = 2, Unentschieden = 1, Niederlage = 0 (Chris' Vorgabe) — Punkte-für/
    -gegen müssen aus den Matchergebnissen sinnvoll abgeleitet werden […] explizit **nicht** für
    die laufende Basketball-Polish-Runde gedacht […] als TODO für eine spätere, eigene
    Design-Runde." Das ist ein **echter, ungeklärter Konflikt** mit Fund 10 oben (Wiederverwendung
    der bestehenden Rang→Punkte-Tabelle) und gehört als offene Frage zu Chris (Abschnitt 5.1), nicht
    stillschweigend in eine Richtung entschieden.
12. **`app/foundation/battle-arena/FoundationBattleArenaHost.tsx` + `lib/foundation/battle-arena/
    arena-kader-adapter.ts` sind die fertige, wiederverwendbare Brücke echter Kaderdaten →
    Motor-Format** (`ArenaSpieler = {n,c,r,sub,tp,tn,d,a}`, 12 Attribute + Disziplin-Ratings 1:1
    durchgereicht, keine zweite Übersetzungstabelle). Der Host selbst bleibt reiner Zuschau-Modus
    (Zitat im Code, Z. 394: „Ausgang fließt nirgends in die Tabelle ein") — genau diese Aussage
    kippt mit diesem Plan für Battle Mode, aber **nur** für Battle-Mode-Saves; der Host als
    interaktives Vorschau-Werkzeug bleibt für Manager-Mode-Saves unverändert bestehen.
13. **Der bestehende Battle-Arena-Nav-Eintrag (`battleArena` in
    `lib/foundation/foundation-nav-config.ts`) ist heute global sichtbar, saveunabhängig** — kein
    Gate nach Modus. Das ist für den reinen Entwurfstab okay, wird aber in Abschnitt 6 (UI) als
    Punkt aufgegriffen, sobald es einen echten, spielwirksamen Battle-Mode-Spieltag gibt.

---

## 1. Die Architektur-Entscheidung und warum sie den Konflikt auflöst

**Entschieden ist (Chris' Vorgabe, hier nur konkretisiert):** Ein neues, permanentes Save-Merkmal
`gameMode: "manager" | "battle"`, gewählt einmalig beim Anlegen eines neuen Spiels, danach nie mehr
änderbar (kein Modus-Wechsel eines laufenden Saves — neue Idee, neuer Save). Manager Mode ist
**exakt der heutige Zustand minus dem Liga-Split-Bug** (32 Teams, ein Rangraum, PPS-Formel,
`leagueByTeamId` bleibt leer). Battle Mode ist **Liga-Split (schon gebaut) + echte Arena-Ergebnisse
für Basketball** statt der PPS-Formel für genau diese eine Disziplin.

**Warum das den scheinbaren Konflikt aus dem Auftrag auflöst** (Liga-Split ist heute überall aktiv,
soll aber „nur" für Battle Mode gelten): Der Liga-Split-Code fragt an **keiner** Stelle nach einem
Modus-Flag — er fragt ausschließlich `isLeagueSplitActive(gameState)`. Diese Funktion ist bereits so
gebaut, dass „gesetzt vs. nicht gesetzt" der einzige Schalter ist. **`gameMode` muss also nirgends
in die Liga-Split-/Sponsor-/Facility-Logik hineingetragen werden** — es genügt, an der **einen**
Stelle, an der `leagueByTeamId` heute unbedingt gesetzt wird
(`buildNewGameStateFromBaseline`), diese Zuweisung an `gameMode === "battle"` zu binden. Der
gesamte bereits gebaute Liga-Split-Stack (Fixtures, liga-lokales Scoring, Sponsor-/Gebäude-Rabatt,
Apron) wird dadurch automatisch und ohne eigene Änderung zum „Battle-Mode-Only"-Feature — er war
nämlich, ohne dass es beim Bauen so benannt wurde, schon immer genau dafür geeignet.

Der zweite Teil (echte Arena-Ergebnisse statt PPS-Formel) ist bewusst **nicht** als Ersatz der
gesamten Resolve-Pipeline geplant, sondern als **ein neuer Ergebnis-Lieferant für eine Disziplin**,
der in dasselbe, bereits vorhandene Format (`DisciplineTeamResolvePreview`, Fund 9) einspeist wie
heute `scoreLegacyLineupDisciplineSide()`. Damit bleiben Standings, Player-Progression, Highlights,
Sponsor-Settlement, Season-Review — alles, was heute von `TeamResolvePreview`/`standings` liest —
**unverändert**, unabhängig davon, ob der Score aus der PPS-Formel oder aus einem Arena-Kampf kam.

---

## 2. Datenmodell-Änderungen

### 2.1 `gameMode` lebt am Save (`GameState.scenarioMeta`), nicht an der Season

Anders als `leagueByTeamId` (ein **Saison**-Fakt, ändert sich bei Auf-/Abstieg) ist der Spielmodus
ein **Save**-Fakt: er wird bei Anlage entschieden und ändert sich nie wieder. Der natürliche,
bereits etablierte Ort dafür ist `ScenarioMeta` (`lib/data/olyDataTypes.ts` Z. 105 ff.), genau
parallel zu `scenarioType`/`saveMode`/`newGamePresetId`, die dieselbe Art von „bei Anlage fix"-Fakt
tragen:

```ts
export type GameMode = "manager" | "battle";

export type ScenarioMeta = {
  scenarioType: ScenarioType;
  // ... unverändert ...
  gameMode?: GameMode;   // fehlt bei jedem Save vor diesem Feature -> Fallback "manager"
};
```

Neue, kleine Datei `lib/season/game-mode.ts` (analog zu `league-split.ts`) als **einzige Quelle**
für das Fallback-Verhalten:

```ts
export function resolveGameMode(gameState: Pick<GameState, "scenarioMeta">): GameMode {
  return gameState.scenarioMeta?.gameMode === "battle" ? "battle" : "manager";
}
export function isBattleModeSave(gameState: Pick<GameState, "scenarioMeta">): boolean {
  return resolveGameMode(gameState) === "battle";
}
```

`undefined`/Alt-Saves → `"manager"` — bit-identisch zum heutigen Verhalten **vor** dem Liga-Split-
Bug, nicht zum heutigen (fehlerhaften) Ist-Zustand. Das ist zugleich die Migrationsregel für
Bestandssaves (Abschnitt 3, Kernfrage 5): kein Save vor diesem Feature setzt `gameMode`, jeder
bleibt automatisch Manager Mode.

### 2.2 `NewGameSetupInput` bekommt `gameMode`

```ts
// lib/game/new-game-setup-service.ts
export type NewGameSetupInput = {
  presetId: NewGamePresetId;
  gameMode?: GameMode;          // neu, default "manager"
  chrisTeamIds?: string[];
  frankyTeamIds?: string[];
  sandbox?: boolean;
  saveName?: string;
  confirmToken?: string | null;
  now?: string;
  saveId?: string;
};
```

In `buildNewGameStateFromBaseline()` wird der bisher **unbedingte** Block
(„LIGA-SPLIT AKTIVIERUNG FÜR NEUE SPIELE", Z. 337 ff.) auf `input.gameMode === "battle"` gegated:

```ts
const gameMode: GameMode = input.gameMode === "battle" ? "battle" : "manager";
const leagueByTeamId = gameMode === "battle" ? buildInitialLeagueAssignment(baseGameState.teams) : {};
// ... leagueTeamIds/leagueLocalRankByTeamId nur befüllen, wenn gameMode === "battle" ...
// Manager Mode: standings.rank/startplatz bleiben der GLOBALE Budget-Startrang (Z. 358-368 heute),
// exakt wie vor dem Liga-Split — kein zweiter Codepfad, nur ein leeres leagueByTeamId.
const seasonOneFixtureSchedule =
  gameMode === "battle"
    ? buildSeasonFixtureSchedule({ saveId, seasonId: "season-1", matchdayIds, leagueTeamIds })
    : buildSeasonFixtures(/* bestehender Dummy-Generator aus preseason-workflow-service.ts */);
```

`scenarioMeta.gameMode = gameMode` wird an derselben Stelle gesetzt wie `scenarioType`/`saveMode`.

### 2.3 API-Route und UI-Payload

`app/api/new-game/route.ts`: `NewGameRequestBody.gameMode?: GameMode`, `normalizeBody()` reicht es
durch (Default `"manager"`, **nicht** `undefined`, damit Preview und Create garantiert denselben
Wert sehen — derselbe Grund, aus dem `presetId` dort schon einen Default bekommt).

### 2.4 Battle-Mode-Basketball-Ergebnisse: neue, additive Felder statt neuer Typen

Kein neuer paralleler „Ergebnistyp" — Basketball-Arena-Resultate werden als ganz normale
`DisciplineTeamResolvePreview`/`DisciplineResolvePreview` erzeugt (Fund 9). Für Nachvollziehbarkeit
(„war das ein PPS- oder ein Arena-Ergebnis?", Debugging, spätere Story-Highlights) zwei neue,
optionale Felder direkt an `DisciplineTeamResolvePreview`:

```ts
export type DisciplineTeamResolvePreview = {
  // ... unverändert ...
  resolutionSource?: "pps" | "arena";       // neu, default "pps" bei fehlendem Feld
  arenaMatchSeed?: string | null;           // neu, nur bei resolutionSource === "arena"
};
```

Für Persistenz/Replay eines Arena-Spieltags (damit ein Season-Review später „zeig mir das Spiel
noch mal" anbieten könnte, auch wenn das explizit **nicht** Scope von Phase 1 ist): ein neues,
optionales Log-Array `seasonState.arenaMatchResultLogs: ArenaMatchResultLogRecord[]` nach demselben
Muster wie `matchdayAdvanceLogs`/`standingsApplyLogs` — Seed, beide Team-IDs, Endstand, Boxscore-
Kennzahlen je Spieler. Rein additiv, bricht nichts Bestehendes.

---

## 3. Kernfragen einzeln beantwortet

### 3.1 Wo/wie wählt man den Modus? Wie wird er persistiert?

**Ort:** Ein neuer, klar sichtbarer Umschalter **oben** in `renderNewGameWizard()`
(`app/foundation/team-settings/FoundationTeamSettingsNewLook.tsx`), noch vor dem Team-Ownership-
Raster — Chris' eigener Grundsatz aus demselben Wizard-Umbau war „genau ein Weg, keine zwei
Bedienelemente für dieselbe Sache" (Kommentar im UI-Contract-Test); der Modus ist aber eine
**andere** Entscheidung als die Team-Auswahl (betrifft Regeln, nicht Besitz) und verdient deshalb
ein **eigenes**, aber genauso striktes Ein-Element-Pattern: zwei große Kacheln „Manager Mode" /
„Battle Mode" mit je 1–2 Sätzen Erklärung, State in `use-foundation-shell-router-body-scope.tsx`
neben `newGamePresetId` (`newGameMode`, Default `"manager"`), `data-testid="new-game-mode-picker"`
für den UI-Contract-Test. Fließt beim Preview/Create-Aufruf als `gameMode` in den `/api/new-game`-
Payload (Abschnitt 2.3).

**Persistenz:** `GameState.scenarioMeta.gameMode` (Abschnitt 2.1) — dauerhaft, nie mehr änderbar
nach Anlage. Ein Versuch, den Modus eines laufenden Saves zu ändern, ist **nicht** vorgesehen (kein
UI dafür); sollte defensiv im Save-Settings-Bereich als „nicht änderbar" beschriftet werden, falls
`gameMode` dort überhaupt angezeigt wird.

### 3.2 Wie werden Nicht-Basketball-Disziplinen in Battle Mode behandelt?

Empfehlung für Phase 1: **Option (a) — Battle Mode beschränkt sich vorerst NUR auf Basketball.**
Alle anderen ~19 Disziplinen laufen in Battle Mode **exakt wie in Manager Mode** über die
bestehende PPS-Formel weiter, nur eben liga-lokal (16er-Rangraum statt 32er, das ist bereits
gebaut). Begründung:

- Nur Basketball hat überhaupt eine spielbare, gemessene, kalibrierte Arena-Engine
  (`FELDSPIEL_ART.basketball`, Fund 6). Football/Hockey/Tennis (dieselbe „Feldspiel"-Chassis) sind
  laut `docs/BATTLE_ARENA_UEBERGABE.md` nur Erst-Mockups, nicht kalibriert, nicht poliert — ihr
  reales Ergebnis in die Tabelle einzuspeisen würde unbalancierte, ungeprüfte Werte zu echten
  Saisonpunkten machen.
- Ein Spieltag hat laut Fund 9 **genau zwei** Disziplinen (`d1`/`d2`). Solange nicht jede Disziplin
  eine Arena hat, MUSS ohnehin ein Hybrid existieren (an Spieltagen ohne Basketball läuft Battle
  Mode zu 100 % wie Manager Mode) — Option (b) „Hybrid" ist also gar keine Alternative, sondern
  bereits die zwangsläufige Konsequenz aus Option (a), nur eben mit einer klaren Grenze (nur
  Basketball, nicht „jede Disziplin, für die zufällig mal jemand eine Engine testet").
- Ausblick (klar außerhalb dieses Plans, aber wert, es aufzuschreiben, damit es nicht verloren
  geht): sobald eine zweite Chassis-Disziplin (z. B. Football oder Hockey aus derselben
  „Feldspiel"-Familie) denselben Kalibrierungs-/Polish-Stand wie Basketball erreicht, ist der
  Erweiterungspfad in Abschnitt 4 (Punkt „Arena-Resultat-Adapter") bereits generisch genug, um sie
  mit einem neuen Eintrag in einer `ARENA_RESOLVED_DISCIPLINE_IDS`-Konstante hinzuzufügen — kein
  struktureller Umbau nötig, nur Kalibrierungsarbeit an der Engine selbst.

### 3.3 Wie wird aus einem Arena-Kampf ein offizielles Ergebnis?

Drei Teilprobleme, in der Reihenfolge, in der sie im Code auftreten:

**(a) Engine-seitig fehlt noch ein sauberer „Ein Spiel, ein Ergebnis"-Aufruf** (Fund 6). Additiver
Patch an `battle-mode.engine.js`, direkt neben `namenVon()`/`feldspielSubskills()` im
`window.__arena`-Objekt, nach exakt demselben Sichern/Zurücksetzen-Muster wie dort:

```js
spieleFeldspiel: (fd, saat) => {
  const M = MOTOREN[fd]; if (!M) return null;
  const g = M.sichern(); if (M.vorher) M.vorher();
  M.bau(saat);
  M.lauf();                         // stille Simulation, kein Rendering (Fund 6)
  const wert = M.wert();            // {spielerName: boxscoreWert}
  const namen = M.namen();
  const boxscore = namen.map(n => ({ name: n, wert: wert[n] ?? 0 }));
  M.zurueck(g);
  return { disziplin: fd, seiten: [...] /* Punktestand je Team-Seite aus fsPunkte, s.u. */, boxscore };
}
```

Für den **Punktestand** (nicht nur den Boxscore-Wert je Spieler) muss der Patch zusätzlich die
bereits vorhandene, aber nicht exponierte `fsPunkte`/Team-Zuordnung mitgeben — das ist eine kleine,
lokal begrenzte Ergänzung, kein Eingriff in die Simulationslogik selbst.

**(b) Roster-Zuführung headless statt interaktiv.** Wiederverwendung von
`lib/foundation/battle-arena/arena-kader-adapter.ts` (`buildArenaTeam`) **unverändert** — dieselbe
Übersetzung wie im interaktiven Host, nur diesmal serverseitig aufgerufen und via
`page.addInitScript()` (Playwright) als `window.__olyArenaKader` gesetzt, **bevor** die Seite
navigiert (der Adapter selbst braucht keine Änderung, Fund 12).

**(c) Duell → Rang → bestehende Punkteformel** (löst den in Fund 4/10/11 aufgezeigten Punkt). Jeder
Spieltag mit aktivem Basketball hat pro Liga **8 Fixtures** aus dem bereits gebauten Spielplan
(`getOpponentOf()`/`gameState.seasonState.schedule`, gefiltert auf `leagueTier` + `matchdayId`).
Empfehlung (Default-Vorschlag für Chris, siehe Offene Frage 5.1, **nicht** endgültig entschieden):

1. Für jedes der 8 Fixtures einer Liga: einmal `spieleFeldspiel("basketball", seed)` mit
   `seed = "${saveId}:${seasonId}:${matchdayId}:arena:${homeTeamId}:${awayTeamId}"` (deterministisch,
   reproduzierbar — dasselbe Prinzip wie überall sonst im Repo, Fund-Vorbild
   `season-fixture-schedule.ts`).
2. Aus den 8 Ergebnissen einer Liga entsteht eine **synthetische 1..16-Rangliste**: zuerst die 8
   Gewinner-Teams sortiert nach Punktdifferenz absteigend (Rang 1–8), danach die 8 Verlierer-Teams
   sortiert nach Punktdifferenz absteigend, also der knappste Verlierer zuerst (Rang 9–16). Ein
   Unentschieden (im Basketball-Modell praktisch ausgeschlossen, aber defensiv behandelt) teilt sich
   den Rang nach der bestehenden `rankDescendingSharedTies`-Regel.
3. Dieser synthetische Rang läuft durch **exakt dieselbe** `getRankToPointsValue(playerCount, rank)`
   wie jede andere Disziplin (Fund 10) — **keine neue Punkte-Ökonomie**, automatisch kommensurabel
   mit der zweiten (PPS-)Disziplin desselben Spieltags, ohne Neukalibrierung.
4. Das Ergebnis wird als ganz normale `DisciplineTeamResolvePreview` mit `resolutionSource:
   "arena"` (Abschnitt 2.4) in die bestehende `LegacyMatchdayResolvePreview` eingehängt — für den
   Rest der Pipeline (Standings-Apply, Sponsor-Settlement, Player-Progression) ist das Ergebnis
   ununterscheidbar von einem PPS-Ergebnis.

**Das ist bewusst ein Vorschlag, kein Fait accompli** — Chris' eigene, an anderer Stelle bereits
geäußerte Präferenz (Fund 11, „Sieg=2/Unentschieden=1/Niederlage=0") ist ein **strukturell
anderes** Modell (klassisches Liga-Punktesystem statt Rang→Punkte-Tabelle) und würde eine eigene,
neu zu kalibrierende Punkteskala neben der PPS-Disziplin desselben Spieltags brauchen. Beide Wege
sind machbar; der hier vorgeschlagene braucht keine neue Kalibrierung, der von Chris einmal
geäußerte ist näher an klassischen Sport-Ligen und leichter zu erklären. **Echte Chris-Entscheidung
nötig, siehe 5.1.**

### 3.4 Performance: praktikabel für einen normalen „Spieltag simulieren"-Klick?

**Nein, nicht headless-ohne-Browser in Phase 1 (Fund 5) — aber ja, praktikabel mit einem
wiederverwendeten, warmgehaltenen Playwright-Browser plus dem bereits etablierten
Hintergrundlauf-Muster (Fund 7, 8).** Konkret:

- **Neuer Singleton-Service** `lib/battle/arena-headless-runner.ts`: hält **einen** Playwright-
  `Browser` (und eine Seite mit bereits geladenem `battle-mode.html`) als modulweiten Singleton,
  lazy beim ersten Battle-Mode-Matchday-Resolve gestartet, danach über die Lebensdauer des
  Node-Prozesses warmgehalten (kein Neustart pro Request). Startkosten (Browser-Launch +
  Seiten-Load) fallen damit **einmal pro Serverprozess**, nicht einmal pro Spieltag an.
- **Ein `page.evaluate()`-Aufruf pro Liga statt 8 einzelne**: alle 8 Fixtures einer Liga in einer
  Schleife *innerhalb* des Browsers abarbeiten (`for (const fixture of fixtures) { ...
  window.__arena.spieleFeldspiel(...) ... }`), um IPC-Overhead zwischen Node und Chromium zu
  amortisieren. Macht laut Fund 7 (≈0,8 s reine Rechenzeit je Kampf, warmer Zustand) grob
  **6–8 s Rechenzeit für 8 Spiele einer Liga**, **12–16 s für beide Ligen** — nachzumessen, nicht
  final zu behaupten, aber in derselben Größenordnung wie der bereits akzeptierte, bestehende
  ~40-Sekunden-Whole-League-Draft (Fund 8).
- **Deshalb: derselbe Hintergrundlauf-/Polling-Vertrag wie `kickoffLeagueSetupDraft()`.** Der
  „Spieltag simulieren"-Klick setzt sofort einen Status (`seasonState.arenaMatchdayResolveStatus:
  "in_progress"`) und kehrt zurück; ein detachter Lauf arbeitet Basketball-Fixtures beider Ligen ab,
  schreibt Ergebnisse in die bestehende Resolve-Pipeline (Abschnitt 3.3c) und setzt am Ende
  `"ready"`/`"failed"`. Die UI zeigt exakt dasselbe Wartemuster, das für den Liga-Draft schon
  existiert (kein neues UX-Konzept nötig).
- **Ausblick, explizit außerhalb Phase 1**: sollte sich in der Praxis (echte Serverlast, Hetzner-
  CPU-Grenzen) zeigen, dass selbst der warme Playwright-Pfad zu langsam/ressourcenhungrig ist, ist
  der saubere nächste Schritt ein **Refactor der Engine in einen DOM-freien Simulationskern**
  (Rendering und Sprite-Vorverarbeitung erst bei tatsächlichem Zeichnen laden, nicht beim
  Modul-Import) plus `jsdom`/`node-canvas` oder ein reiner Node-Port der Physik-/Score-Formeln.
  Das ist ein eigenständiges, nicht triviales Projekt an einer 9.781-Zeilen-Datei, die laut
  `docs/BATTLE_ARENA_UEBERGABE.md` bereits mehrfach händisch feinjustiert wurde („Ein einzelner
  Kampf mit festem Startwert ist ein Wurf") — jede strukturelle Änderung an ihr riskiert, die
  bereits kalibrierte Balance zu verschieben. Nicht Teil dieses Plans.

### 3.5 Migrationsfragen

Keine Migration nötig (Chris' Vorgabe, hier nur bestätigt durch Code-Fakten): Jeder Save vor diesem
Feature hat kein `scenarioMeta.gameMode` → `resolveGameMode()` liefert `"manager"` (Abschnitt 2.1).
Das gilt auch für den Live-Save (Fund aus `liga-split-plan.md`: Migration bestehender Saves auf den
Liga-Split war schon dort explizit **nicht** Teil der PRs — Battle Mode ändert daran nichts, weil
`gameMode` genau dasselbe Fallback-Prinzip nutzt). Ein Battle-Mode-Save entsteht ausschließlich über
den neuen Wizard-Pfad ab PR 6 (Abschnitt 4) — sauberer Fork ab Spielerstellung, keine Rückwirkung
auf bestehende Manager-Mode-Saves.

### 3.6 Phasierung

Siehe Abschnitt 4 — 9 PRs, jede hält `main` deploybar.

---

## 4. Empfohlene Umsetzungsreihenfolge (9 PRs, jede hält `main` deploybar)

1. **Bugfix zuerst, unabhängig vom Rest**: `leagueByTeamId`/`buildSeasonFixtureSchedule()` in
   `buildNewGameStateFromBaseline()` hinter ein hartcodiertes `false` gaten (noch ohne `gameMode`-
   Feld) — stellt sofort das *beabsichtigte* Manager-Mode-Verhalten wieder her (kein Split für neue
   Spiele), inkl. Korrektur von `tests/new-game-setup-service.test.ts` Z. 101–122. Kleinster,
   dringendster PR, unabhängig deploybar, bevor überhaupt etwas Neues gebaut wird.
2. **`gameMode`-Datenmodell**: `ScenarioMeta.gameMode`, `lib/season/game-mode.ts`
   (`resolveGameMode`/`isBattleModeSave`), `NewGameSetupInput.gameMode`, API-Route-Passthrough.
   Noch nicht ans UI angebunden (Default überall `"manager"`) — reine Fundament-PR, unit-getestet.
3. **`buildNewGameStateFromBaseline()` verdrahten**: der in PR 1 hart auf `false` gegatete Block
   wird jetzt an `gameMode === "battle"` gebunden (löst PR 1 sauber ab). Ab hier kann man per API
   (noch ohne UI) einen echten Battle-Mode-Save mit Liga-Split erzeugen.
4. **UI: Moduswahl im New-Game-Wizard** (`FoundationTeamSettingsNewLook.tsx`,
   `use-foundation-shell-router-body-scope.tsx`, UI-Contract-Test-Erweiterung). Nach diesem PR kann
   Chris beide Modi tatsächlich über die App anlegen — **Battle Mode entspricht bis hier exakt dem
   heutigen Liga-Split-Stand**, noch ohne echte Arena-Ergebnisse (Basketball läuft noch PPS).
5. **Engine-Patch**: `spieleFeldspiel(fd, saat)` an `window.__arena` (Abschnitt 3.3a), plus
   Playwright-Messskript (`scripts/miss-arena-serie.mjs`-Nachbar) zur Abnahme: liefert
   deterministisch reproduzierbare Ergebnisse bei gleichem Seed, unterschiedliche bei
   unterschiedlichem Seed, keine Regression an bestehenden `window.__arena`-Aufrufen.
6. **Headless-Runner-Service** (`lib/battle/arena-headless-runner.ts`, Abschnitt 3.4): Singleton-
   Browser, Roster-Zuführung über `arena-kader-adapter.ts`, Batch-Aufruf über 8 Fixtures einer
   Liga. Noch nicht an die echte Resolve-Pipeline angebunden — eigenständig testbar (Skript oder
   Test, das Ergebnisse für ein bekanntes Fixture-Paar prüft).
7. **Arena-Resultat-Adapter in die Resolve-Pipeline** (Abschnitt 3.3c): synthetischer Rang aus
   8 Duellen, `getRankToPointsValue()`-Wiederverwendung, `resolutionSource: "arena"`-Feld,
   Einhängen in `buildLegacyMatchdayResolvePreview()` **nur wenn** `isBattleModeSave(gameState) &&
   disciplineId === "basketball"`. Hinter Feature-Flag/nur in Tests, noch nicht produktiv am
   „Spieltag simulieren"-Knopf.
8. **Aktivierung + Hintergrundlauf-UX**: Verdrahtung an `LegacyMatchdayResultApplyService`
   (`app/api/resolve/legacy-matchday-apply/route.ts`) + `seasonState.arenaMatchdayResolveStatus`
   nach dem `kickoffLeagueSetupDraft()`-Vorbild (Fund 8) + UI-Wartezustand. **Ab hier bestimmen
   echte Arena-Kämpfe echte Battle-Mode-Ergebnisse.**
9. **Nav-/UI-Politur + Season-Review-Sichtbarkeit**: `battleArena`-Tab ggf. sichtbar an
   `isBattleModeSave()` koppeln statt global; `arenaMatchResultLogs` (Abschnitt 2.4) im
   Season-Review/Spielplan-Tab anzeigbar machen („dieses Ergebnis kam aus einem echten Arena-
   Kampf, Seed X"). Rein additiv, kein Pipeline-Risiko mehr.

---

## 5. Offene Fragen — Chris-Entscheidung nötig

### 5.1 Punktemodell für Arena-Ergebnisse (die wichtigste offene Frage dieses Plans)
Zwei echte, unvereinbare Optionen, keine „technisch überlegene" ohne Produktentscheidung:
- **(A) Synthetischer Rang → bestehende `getRankToPointsValue()`-Tabelle** (Empfehlung dieses
  Plans, Abschnitt 3.3c): keine neue Punkte-Ökonomie, automatisch kommensurabel mit der zweiten
  Disziplin desselben Spieltags, aber „Rang" ist für ein 1-gegen-1-Duell ein Konstrukt, keine
  intuitive Sport-Metapher.
- **(B) Klassisches Sieg=2/Unentschieden=1/Niederlage=0** (Chris' eigene, früher geäußerte
  Präferenz, `docs/BATTLE_ARENA_UEBERGABE.md` Abschnitt F): intuitiv, aber eine **zweite,
  unabhängig zu kalibrierende Punkteskala** neben der PPS-Disziplin desselben Spieltags — wie viel
  „wert" ist ein Basketball-Sieg im Vergleich zu Rang 3 in Schach am selben Spieltag? Braucht echte
  Abstimmungsarbeit, nicht nur Code.

### 5.2 Wo endet Phase 1 wirklich — nur Basketball, für immer, oder als Blaupause?
Bestätigung erbeten: Abschnitt 3.2, Option (a) als *Phase-1-Grenze*, mit Football/Hockey/Tennis
als expliziter, unterschriebener Ausblick (nicht Teil dieses Plans) — richtig verstanden?

### 5.3 Was passiert mit einem Arena-Duell bei fehlender/unvollständiger Aufstellung?
Die PPS-Pipeline kennt `ResolvePreviewStatus` wie `"incomplete_lineups"`/`"missing_lineups"` als
regulären, abgefangenen Fall. Für ein Arena-Duell mit zu wenigen tauglichen Basketball-Spielern
(z. B. Verletzungen) braucht es dieselbe Sorte Fallback — automatischer Rückfall auf PPS-Formel für
diesen einen Spieltag/dieses eine Team, oder harte Blockade („Spieltag kann nicht simuliert
werden")? Nicht recherchierbar, reine Design-Entscheidung.

### 5.4 Server-Ressourcen für den warmen Playwright-Prozess
Der Hetzner-Server (`CLAUDE.md`) trägt heute die App-Instanz; ein dauerhaft offener Chromium-
Prozess samt geladener Arena-Seite ist zusätzlicher RAM-/CPU-Verbrauch **rund um die Uhr**, nicht
nur während eines Resolve-Laufs. Ist das auf der aktuellen Hetzner-Instanz akzeptabel, oder soll der
Browser stattdessen **on-demand** gestartet und nach jedem Matchday-Resolve wieder beendet werden
(einfacher, aber jeder Spieltag zahlt dann die vollen Start-/Ladekosten erneut)? Nur Chris/Betrieb
kann das gegen die reale Serverauslastung abwägen — hier nicht messbar.

### 5.5 Sichtbarkeit des `battleArena`-Tabs nach Aktivierung (PR 9)
Soll der Tab in Manager-Mode-Saves nach Fertigstellung ganz verschwinden (er ist dort weiterhin nur
Entwurf/Zuschau-Werkzeug ohne Wirkung), oder als „hier siehst du, wie es in Battle Mode aussehen
würde" bewusst als Werbe-/Vorschau-Fläche für den anderen Modus stehen bleiben?

---

## 6. Kern-Dateien für den Einstieg

- `lib/game/new-game-setup-service.ts` (Bugfix + `gameMode`-Verdrahtung, Abschnitt 2.2/4 PR 1+3)
- `lib/season/league-split.ts` (unverändert, aber der zentrale Hebel, der Battle Mode „umsonst" mitbekommt)
- `lib/season/game-mode.ts` (neu, Abschnitt 2.1)
- `app/foundation/team-settings/FoundationTeamSettingsNewLook.tsx` +
  `lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx` (Moduswahl-UI, Abschnitt 3.1/4 PR 4)
- `app/api/new-game/route.ts` (Payload-Passthrough, Abschnitt 2.3)
- `public/mockups/battle-mode.engine.js` (additiver `spieleFeldspiel()`-Patch, Abschnitt 3.3a/4 PR 5)
- `lib/foundation/battle-arena/arena-kader-adapter.ts` (Roster-Brücke, unverändert wiederverwendet, Fund 12)
- `lib/battle/arena-headless-runner.ts` (neu, Playwright-Singleton, Abschnitt 3.4/4 PR 6)
- `lib/resolve/legacy-matchday-resolve-engine.ts` + `lib/resolve/legacy-matchday-resolve-types.ts`
  (Arena-Resultat-Adapter, Abschnitt 3.3c/2.4/4 PR 7)
- `lib/game/league-setup-draft-service.ts` (Vorbild für den Hintergrundlauf-Vertrag, Fund 8/4 PR 8)
- `app/api/resolve/legacy-matchday-apply/route.ts` (Aktivierung, PR 8)
- `tests/new-game-setup-service.test.ts` (muss in PR 1 korrigiert werden, Fund 2)
