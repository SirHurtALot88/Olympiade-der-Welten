# Mini-DM im Spielplan verankern — Umsetzung (14.09.)

**PRODUKTIONSCODE, besondere Review-Sorgfalt.** Diese Runde setzt um, was die drei Vorgänger-Dokumente
recherchiert und Chris entschieden hat: `docs/design/mini-dm-4-team-ffa-recherche-06-09.md` (06.09.),
`docs/design/n-team-disziplinen-infrastruktur-audit-13-09.md` (13.09., PR #911) und
`docs/design/mini-dm-spielplan-anchoring-befund-14-09.md` (14.09., PR #927, Stop-und-Dokumentieren-Runde).
Chris hat danach sechs konkrete Fragen beantwortet (siehe unten) und diese Runde ausdrücklich
autorisiert.

## Chris' Entscheidungen, umgesetzt

1. **Liga-Größen bleiben Vielfache von 4.** `LEAGUE_SIZE` (16) und `TEAM_COUNT_TOTAL` (32) sind bereits
   fest verdrahtete Konstanten (`lib/season/league-split.ts`) — es gibt keine Liga-/Team-Größen-UI im
   Repo, die einen anderen Wert zuließe (`lib/game/league-setup-draft-service.ts` geht ebenfalls fest
   von 32 Teams aus). Die Invariante war also bereits erfüllt, nicht bloß angestrebt — dokumentiert
   und mit einem Test verankert (`tests/liga-split-fundament.test.ts`), keine Restbehandlung gebaut.
2. **Zweites Vorkommen würfelt neu.** `lib/season/mini-dm-pod-schedule.ts` zieht für jedes der zwei
   Saison-Vorkommen einen eigenen, `occurrenceInSeason`-abhängigen Seed — garantiert unterschiedliche
   Vierergruppen, nicht nur wahrscheinlich unterschiedliche (Test: `tests/mini-dm-pod-schedule.test.ts`,
   "(b)").
3. **Additiver Weg, kein `Fixture`-Umbau.** Siehe Abschnitt "Die Pod-Datenstruktur" unten.
4. **Der zweite Disziplin-Slot bleibt unberührt.** Die Pod-Bildung liest nur `discipline1`/
   `discipline2` des Mini-DM-Spieltags, um zu erkennen, dass Mini-DM läuft — sie ändert nichts an
   `Fixture`/`seasonState.schedule`, über das der ANDERE Disziplin-Slot desselben Spieltags weiterhin
   normal gepaart wird. Kein Code dafür nötig, weil die additive Pod-Struktur `Fixture` gar nicht
   anfasst.
5. **Kein Heim/Auswärts für Pods.** `use-foundation-cross-tab-discipline-ranks.ts` setzt für einen
   Mini-DM-Spieltag `opponentTeamId`/`opponentName`/`opponentLogo` bewusst auf `null` und liefert
   stattdessen `miniDmPod` (die eigene Vierergruppe). `FoundationDiszisNewLook.tsx` rendert dafür eine
   eigene Zeile ("4er-Pod: Team A · Team B · Team C · Team D") statt der Gegner-Zeile.
6. **Kaderrobustheit unverändert.** Nichts Neues gebaut — jedes der vier Pod-Teams läuft weiterhin
   durch seine eigene, bestehende Kader-/Aufstellungslogik. Der Pod koppelt nur Team-IDs, nie
   Lineup-Auflösung.

## Die Kadergröße: 1 statt 2–6

`lib/season/season-discipline-schedule.ts` erzwingt jetzt `playerCount: 1` für Mini-DM in JEDEM
Saison-Vorkommen — vorher lief Mini-DM (wie jede andere Disziplin) durch die kategorie-balancierte
`[2,3,4,5,6]`-Permutation der "power"-Kategorie (mini-dm, tdm, gewichtheben, hockey, breaking).

**Wie die vier anderen Power-Disziplinen unangetastet bleiben:** Der Shuffle/das Derangement laufen
weiterhin unverändert über alle fünf Kategorie-Mitglieder (Mini-DM eingeschlossen, mit einem für sie
bedeutungslosen Platzhalterwert) — NUR an der einen Stelle, an der ein Wert tatsächlich Teil eines
Spielplan-Slots wird (`buildSeededDisciplinePairs()`, `available`-Aufbau), wird Mini-DMs eigener
gezogener Wert verworfen und durch `1` ersetzt (`withMiniDmPlayerCountOverride`). tdm/gewichtheben/
hockey/breaking sehen dadurch in keinem Schritt (Shuffle, Derangement, Pairing) je den Wert `1` — ihre
vier Werte bleiben vier paarweise verschiedene Werte aus `{2..6}` (welche vier, hängt vom Seed ab; der
fünfte ging an Mini-DM). Das ist bewusst *kein* Herausnehmen aus der Fünfer-Gruppierung vor dem
Shuffle — das hätte die Kategorie auf vier Mitglieder verkleinert und den `ordered.length===5`-Zweig
für die verbleibenden vier gebrochen (Rückfall auf unabhängige Gleichverteilung statt Permutation, eine
echte Verhaltensänderung für tdm/gewichtheben/hockey/breaking, die diese Runde ausdrücklich vermeidet).

Getestet in `tests/season-discipline-schedule-battle-repeat.test.ts` (Tests (iii)/(iv), angepasst) und
`tests/singleplayer-state.test.ts`.

## Die Pod-Datenstruktur — Form und Begründung

**Neuer, additiver, NICHT persistierter Datensatz** in `lib/season/mini-dm-pod-schedule.ts`:

```ts
export type MiniDmPod = {
  id: string;
  seasonId: string;
  matchdayId: string;
  leagueTier: LeagueTier | null;      // null im Legacy-32er-Modus (ein Pool statt zwei Ligen)
  occurrenceInSeason: 1 | 2;
  teamIds: [string, string, string, string];
};
```

**Warum nicht persistiert:** `Fixture`/`RoundPairing` bleiben komplett unverändert (Chris'
Entscheidung 3) — es gibt also keine bestehende Zeile, an die ein Pod-Feld angehängt werden müsste,
und keinen Migrationsbedarf für einen einzigen bestehenden Spielstand. Ein `MiniDmPod` wird stattdessen
**rein aus bereits persistierten Fakten abgeleitet** (`leagueByTeamId`, Save-/Saison-Identität,
`occurrenceInSeason` aus dem Disziplin-Spielplan) — exakt das Muster, das `getSeasonDisciplineSchedule()`
selbst für einen unvollständigen `disciplineSchedule` fährt. `getMiniDmPodsForMatchday(gameState,
matchdayId)` ist der einzige Einstiegspunkt; er liefert `[]` für jeden Nicht-Mini-DM-Spieltag (die
weit überwiegende Mehrheit), unverändert für jeden bestehenden Spielstand.

**Bildung:** `buildCircleRounds()` (`season-fixture-schedule.ts`, jetzt exportiert, sonst **unverändert**
— dieselbe bereits korrekte, bereits getestete Paarungslogik, die auch die normalen 2er-Fixtures
erzeugt) läuft auf einer eigenen, pod-spezifisch geseedeten Team-Permutation je Liga *und* je
Saison-Vorkommen. Die erste Runde dieser Permutation (bei `LEAGUE_SIZE=16` acht Paare) wird paarweise
zu vier Pods verschmolzen (`{A-B}+{C-D} -> Pod{A,B,C,D}`) — genau der in der 06.09.-Recherche benannte
Mechanismus. Eine EIGENE Permutation statt der Runde, die `buildSeasonFixtureSchedule()` für denselben
Spieltag ohnehin zieht, aus zwei Gründen: (a) hält Mini-DMs Pod-Bildung vollständig unabhängig von der
normalen Fixture-Erzeugung, (b) macht "beim zweiten Vorkommen neu würfeln" beweisbar statt bloß
wahrscheinlich (die normale Fixture-Runde eines Spieltags kann bei 20 Battle-Mode-Spieltagen und nur 15
eindeutigen Runden — Audit Abschnitt 6a — theoretisch dieselbe Runde wie ein früherer Spieltag treffen).

**Bewusst keine Restbehandlung:** Liga-Größen sind Vielfache von 4 (Entscheidung 1), eine Liga zerfällt
also immer restlos. `buildMiniDmPodGroups()` lässt einen nicht durch 4 teilbaren Rest trotzdem
klaglos aus (kein Wurf, kein Sonderfall) — für den Fall, dass diese Invariante je verletzt wird, bricht
nichts, es entstehen nur weniger Pods.

## Das Engine-Wiring — was läuft, was (bewusst) nicht

Der 4-Team-FFA-Kampfmotor (`spieleMiniDmFfaEvent()`/`baueMiniDmFfaRunde()`,
`public/mockups/battle-mode.engine.js`, "vier Rollenrunden") war laut 13.09.-Audit bereits fertig,
gemessen und **nirgends im Produktionscode erreichbar** — nur über die Mess-Skript-Testschnittstelle
`window.__arena.miniDmFfaEvent()`. Diese Runde ändert **keine einzige Zeile** in
`battle-mode.engine.js` (der Motor war laut Audit bereits korrekt) und wiring stattdessen einen neuen,
echten Node/Playwright-Aufrufer dafür: `runMiniDmFfaPodFixtures()` in `lib/battle/arena-headless-runner.ts`,
additiv neben dem bestehenden `runArenaFixtures()`.

**Was er tut:** nimmt ein `MiniDmPod` (4 Team-IDs), baut die vier echten Kader über
`buildArenaTeam()` (denselben Adapter, den `runArenaFixtures()` für 2 Teams nutzt), startet EINEN
Chromium-Ladevorgang für die gesamte Seite (kein Neu-Einhängen je Pod nötig, weil
`spieleMiniDmFfaEvent()` Kader als explizite Funktionsargumente nimmt statt über
`window.__olyArenaKader`/SQUAD/OPP) und liefert einen typisierten Boxscore + die Chris-Punktetabelle
`[2,1,0,0]` je Team zurück. Getestet gegen echten Chromium in
`tests/mini-dm-ffa-pod-headless-runner.test.ts`: Determinismus, Batch-Mehrfachpods, sauberer
Browser-Shutdown (Delta-Messung wie bei `runArenaFixtures()`), und der Fall "ein Team hat keinen
Kader" liefert `null` statt zu werfen.

**Bewusst NICHT gebaut — und warum das kein "Umbau in letzter Sekunde ausgelassen" ist, sondern die
in der Aufgabe selbst gezogene Grenze:**

1. **Kein Aufruf aus der Live-Resolve-Pipeline heraus.** `runMiniDmFfaPodFixtures()` ist ein fertiger,
   getesteter, eigenständig aufrufbarer Baustein — genau wie `runArenaFixtures()` es laut eigenem
   Kopfkommentar bei seiner Einführung war ("NOCH NICHT AN DIE ECHTE RESOLVE-PIPELINE ANGEBUNDEN…
   dieser Service ist bewusst eigenständig aufrufbar und testbar"). Ein Aufruf aus
   `arena-matchday-resolve-service.ts`/`legacy-matchday-resolve-engine.ts` heraus würde bedeuten, in
   die Saisontabellen-Buchung einzugreifen — explizit ausgeklammert (`ARENA_RESOLVED_DISCIPLINE_IDS`
   bleibt unverändert, Mini-DMs `[2,1,0,0]`-Ligapunkte werden von KEINEM Aufrufer gebucht).
2. **Keine Umverdrahtung der Live-Client-Bühne** (`DisciplineStageNativeArena.tsx`/
   `FoundationBattleArenaHost.tsx`) auf den Pod-Runner. Die Bühne ist laut Audit bereits N-generisch
   (`NativeStageTeam[]`, `const N = Math.max(1, teams.length)`) und könnte einen 4-Team-Pod heute
   schon rendern — WELCHE Daten sie für einen Mini-DM-Spieltag genau bekommt (heute: der generische
   2-Team-Renn-Pfad, morgen möglich: dieser Pod-Runner), ist eine eigene, nicht triviale
   Prop-/State-Verdrahtung über mehrere Client-Komponenten, die eine eigene Sorgfaltsrunde verdient,
   keinen Seiteneffekt dieser PR.

**Fazit:** Der Motor lief vorher durch niemanden. Jetzt gibt es einen echten, getesteten,
produktionsreifen Aufrufer für ihn — der nächste, bewusst offen gelassene Schritt ist, ihn an EINE
konkrete Stelle (Live-Bühne oder Resolve-Vorschau) zu hängen, keine Deep-Ende-zu-Ende-Verdrahtung
über die ganze Pipeline in dieser einen Runde.

## Verifikation

- `npx tsc --noEmit`: keine neuen Fehler gegenüber `origin/main` (bestehende ~560-900 Fehler
  unverändert, keiner davon in einer der neun angefassten/neuen Dateien dieser PR).
- `npx vitest run`: 1027 von 1029 Testdateien grün beim ersten vollen Lauf; die zwei roten waren beide
  Chromium-Kontamination durch einen zeitgleich laufenden zweiten Vitest-Prozess dieser Session (nicht
  von dieser PR verursacht) plus ein von dieser PR selbst erwarteter, inzwischen angepasster
  Test (`singleplayer-state.test.ts`) — beide Dateien liefen danach in Isolation grün
  (`tests/spiele-bahn-invarianten.test.ts` 12/12, `tests/singleplayer-state.test.ts` 36/36+1 skip).
- Neue Tests: `tests/mini-dm-pod-schedule.test.ts` (14 Tests: Pod-Form, Determinismus, Reshuffle bei
  Vorkommen 2, Liga-Trennung, Legacy-32er-Pool, Rest-Verhalten), `tests/mini-dm-ffa-pod-headless-runner.test.ts`
  (6 Tests, echter Chromium: Simulation, Determinismus, Batch, unvollständiger Kader, sauberer
  Shutdown), Erweiterungen in `tests/season-discipline-schedule-battle-repeat.test.ts` und
  `tests/singleplayer-state.test.ts` (Mini-DM-Ausnahme von der 2–6-Ziehung, andere vier
  Power-Disziplinen unverändert geprüft), neuer Test in `tests/liga-split-fundament.test.ts`
  (Vielfache-von-4-Invariante).
- `public/mockups/battle-mode.engine.js` wurde NICHT angefasst — `node --check`,
  `scripts/pruefe-slot-invariante.ts` und `scripts/miss-alle-disziplinen.mjs` sind laut Auftrag nur
  bei einer Änderung dieser Datei vorgeschrieben und daher nicht Teil dieser Abnahme. Mini-DMs eigene
  Rangtreue bleibt unverändert (keine Formel/Chassis-Zeile geändert).
- `npx tsx scripts/pruefe-spiegel-frische.ts`: beide Spiegel frisch (< 1 h).
