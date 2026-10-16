# Battle Mode: Auto-Run an die Arena anbinden — Plan (16.10.)

**Status:** reiner Plan, KEIN Code. Vorlage für die Projektaufsicht, die den Umbau ausdrücklich erst
als Plan sehen will. Nichts hier ist umgesetzt; alle Codeblöcke sind Skizzen.

**Anlass:** Der volle Saison-Smoke `scripts/multi-season-smoke.ts --game-mode=battle` auf `main` (nach
#1265 und #1266) zeigte, dass alle 40 Disziplin-Slots einer Battle-Saison über die PPS-Duell-Brücke
liefen — auch die 26 Slots der 13 Disziplinen, die laut `ARENA_RESOLVED_DISCIPLINE_IDS` die Arena
entscheiden soll. Das widerspricht Chris' Kernwunsch „Battle Mode direkt an die Battle Arena
angebunden“. Dazu kommt E1: Im Produktions-Image fehlt Chromium.

---

## 0. Kurzfassung — was der Plan entscheidet, was er offenlässt

| # | Frage | Entscheidung im Plan |
|---|---|---|
| K1 | Wann läuft die Arena? | **Als Vorlauf am Snapshot**, nicht beim Buchen. Sobald das Feld eines Spieltags steht (derselbe Moment, in dem heute `ensureMatchdayResolveSnapshot` die „eine Rechnung“ ablegt), startet ein Hintergrundlauf. Er rechnet die Arena-Duelle und schreibt sie in den Snapshot. Die Bühne zeigt danach Arena-Zeilen, und die Buchung bucht genau diesen Snapshot. Im Buchungspfad startet kein Chromium mehr. |
| K1 | Laufen nachgelagerte Schritte vorläufig mit der Brücke und werden später korrigiert? | **Nein.** Gebucht wird erst, wenn der Vorlauf fertig **oder** sichtbar gescheitert ist. Fatigue und Training hängen nachweislich nicht am Ergebnis, Punkte und PPs aber an sechs Lesern. Eine Korrektur hieße, all diese Buchungen zurückzudrehen. |
| K1 | HTTP-Pfad vs. Skripte | Der HTTP-Pfad wartet nie auf Chromium. Fehlt der Vorlauf, stößt er ihn an und antwortet „läuft“, danach pollt die UI. Skripte (Smoke, Admin-Simulation) fahren den Vorlauf mit `arenaModus: "inline"` und warten auf ihn. |
| K1 | Koop-Doppelbuchung | Der Vorlauf wird im Prozess entdoppelt (eine Promise je Spieltag und Signatur) und über einen persistierten Status mit Zeitstempel abgesichert. Geschrieben wird nur, wenn die Signatur noch passt, und mit Wiederholung bei einem Koop-Konflikt. Die Buchung bleibt idempotent, weil sie nur den Snapshot liest. Global läuft höchstens ein Chromium gleichzeitig. |
| A | Sichtbare Ausfälle | Neues Feld `arenaAusfall` an `DisciplineTeamResolvePreview` und `DisciplineResultRecord`, dazu die Warnung `arena_ausgefallen:<grund>`. Außerdem prüft die Engine selbst: Eine gewertete Arena-Disziplin ohne Arena-Ergebnis und ohne erklärten Ausfall bekommt `arena_ausgefallen:nicht_ausgefuehrt`. **Dieser Check hätte den heutigen K1-Fehler sofort sichtbar gemacht.** |
| E1 | Chromium im Image | Full-Chromium in Playwright-Revision 1223 (Playwright 1.60) wird im Runner-Stage installiert, in einer eigenen, cachebaren Schicht vor dem App-COPY. **On demand bleibt** (wie heute umgesetzt). Neu: `shm_size`, `init: true` und ein per Umgebungsvariable konfigurierbarer Chromium-Pfad. Streng sequenziell, kein paralleler Browser. |
| D | Determinismus | Runner und Kickoff nutzen bereits denselben Seed-Bau. Zwei Lücken sind zu schließen: Der Zuschau-Host richtet Heim/Gast nach der UI-Wahl statt nach dem Fixture und vergibt auch Nicht-Fixture-Paaren eine Saat. Außerdem unterscheidet sich die Chromium-Revision lokal (1194) und in CI/Prod (1223). |
| V | Abnahme | Task #164 (CI-Invariantentest) wird VOR dem Umbau eingecheckt. Danach ein lokaler Battle-Smoke über eine volle Saison mit echtem Chromium: erwartet sind **832 Arena-Zeilen (26 Slots × 32 Teams) und 448 Brücken-Zeilen (14 × 32)**, null `pps`-Zeilen und null unmarkierte Brücken-Zeilen gewerteter Arena-Disziplinen. Dazu ein Live-Test mit Franky. |

**Offen und an Chris / die Aufsicht zu geben:** siehe Abschnitt 8. Die wichtigsten Punkte sind die
Wartezeit vor der Bühne (bis etwa 1 Minute auf dem CX23), automatische Wiederholung ja/nein und der
Plattenplatz.

---

## 1. Ist-Zustand (nachgelesen, nicht vermutet)

### 1.1 Die zwei Buchungswege und wer sie aufruft

| Weg | Einstieg (UI) | Route | Service | Arena? |
|---|---|---|---|---|
| **A: Auto-Run** | Bühne „Disziplin werten“ → `commitArenaDiscipline(side, shownPreview)` (`lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx:4677`, an die Bühne gereicht in `app/foundation/FoundationShellRouterBody.tsx:2690`); Cockpit „Matchday Auto-Run“ (`app/foundation/cockpit-v2/FoundationCockpitPanel.tsx:1195/1215`) | `app/api/season/matchday-auto-run/route.ts:97` | `runLocalMatchdayAutoRun` (`lib/season/matchday-auto-run-service.ts:509`) | **Nein, nie** |
| **B: Kickoff** | Nur Cockpit „2. Result lokal anwenden“ (`FoundationCockpitPanel.tsx:2324` → `runCockpitResultApply`, `lib/foundation/tabs/cockpit-matchday-handlers.ts:266`) | `app/api/resolve/legacy-matchday-apply/route.ts:76-106` | `kickoffArenaMatchdayApply` (`lib/season/arena-matchday-resolve-service.ts:314`) | Ja, im Hintergrund, mit Status `arenaMatchdayResolveStatus` |

Auch Skripte nehmen Weg A: `scripts/multi-season-smoke.ts`, `scripts/e2e-battle-pps-duell.ts`,
`lib/admin/season-simulation-runner.ts:1404` und `lib/debug/bootstrap-save-to-season-start.ts:162`.
Damit erklärt sich der Smoke-Befund vollständig: Kein einziger Spielfluss, den ein Spieler oder ein
Skript normalerweise nimmt, ruft die Arena.

### 1.2 Die „eine Rechnung“ des Spieltags (der Schlüssel zum Design)

- Sobald das Feld steht (alle Teams haben D1 und D2 aufgestellt), rechnet
  `ensureMatchdayResolveSnapshot` (`lib/foundation/matchday-resolve-snapshot.ts:467`) den Spieltag
  **einmal** und legt ihn im Save ab. Aufgerufen wird es aus beiden Lineup-Routen
  (`app/api/lineups/legacy/route.ts:204`, `app/api/lineups/legacy/batch/route.ts:208`).
- Die Bühne liest diesen Snapshot (`lib/foundation/matchday-arena-base-service.ts:244`,
  `zweck: "anzeigen"`) und spielt ihn ab.
- Der Auto-Run bucht genau ihn (`resolveMatchdayPreviewToBook`, `matchday-auto-run-service.ts:830`,
  plus `submittedPreview` über `decideResolvePreviewToBook`, `:959`). Das Prinzip heißt „Was du
  siehst, wird gebucht“ und ist im Code mehrfach mit gemessenen Abweichungen begründet
  (`matchday-resolve-snapshot.ts:255-283`).
- In einem Battle-Save enthält dieser Snapshot heute **ausschließlich** `pps_duell`-Zeilen, weil
  `buildLegacyMatchdayResolvePreviewPayload` (`lib/foundation/legacy-matchday-resolve-preview-service.ts:48`)
  keine Arena-Maps entgegennimmt.

**Folgerung:** Ein Arena-Lauf erst beim Buchen, so wie ihn der Kickoff heute macht, bricht dieses
Prinzip. Die Bühne zeigt dann Brücken-Ergebnisse, gebucht wird aber Arena. Der Kickoff tut genau
das: Er baut die Preview zur Buchungszeit live (`arena-matchday-resolve-service.ts:261`), und
`preloadedPreview` „sticht IMMER“ den Snapshot.

### 1.3 Weitere Befunde beim Nachlesen (gehören in den Umbau)

| ID | Befund | Fundstelle |
|---|---|---|
| F2 | **Arena-Ausfälle sind heute lautlos.** `runBattleModeArenaMatchday` fängt den Fehler je Liga und schreibt nur die Warnung `arena_matchday_league_failed:<tier>:<msg>` (`lib/resolve/battle-mode-arena-team-points.ts:1366-1373`). Diese Warnungen landen ausschließlich in `console.warn` (`arena-matchday-resolve-service.ts:228-230`), nicht in Preview oder Ledger. Die Buchung läuft weiter, die betroffene Liga fällt still auf die Brücke, und der Status wird trotzdem `"ready"`. | s. links |
| F3 | Der Kickoff bucht eine live gebaute Preview statt des Snapshots, den die Bühne gezeigt hat (s. 1.2). | `arena-matchday-resolve-service.ts:257-287` |
| F4 | `kickoffArenaMatchdayApply` prüft nicht, ob schon ein Lauf `in_progress` ist. Ein Doppelklick oder zwei Koop-Spieler erzeugen zwei Chromium-Läufe und zwei Apply-Versuche. | `arena-matchday-resolve-service.ts:332-354` |
| F5 | `seasonState.arenaMatchdayResolveStatus` ist ein einzelnes, saveweites Feld ohne Spieltag und ohne Zeitstempel. Startet der Container mitten im Lauf neu, bleibt es für immer `in_progress`, und der Poller lädt alle 5 s weiter. | `lib/data/olyDataTypes.ts:3436`, Poller `use-foundation-shell-router-body-scope.tsx:10077-10114` |
| F6 | Der Banner spricht von „Basketball-Duellen“, obwohl Basketball seit dem 16.10. gar nicht mehr arena-gewertet ist. | `app/foundation/FoundationShellRouterBody.tsx:910-934` |
| F7 | Der Chromium-Pfad ist fest auf Revision **1194** verdrahtet. Playwright 1.60 (Lockfile) erwartet aber **1223**. Lokal liegen beide, CI installiert 1223. Der Rückfall `channel: "chromium"` verlangt den vollen Chromium, nicht die Headless-Shell. | `lib/battle/arena-headless-runner.ts:64, 396-408`, `node_modules/playwright-core/browsers.json` |
| F8 | `playwright` ist nur transitiv als devDependency (`@playwright/test`) da. Im Laufzeit-Image ist es heute nur vorhanden, weil `npm ci` ohne `--omit=dev` läuft und der Runner das ganze `/app` kopiert. | `package.json` (devDependencies), `Dockerfile:15, 69` |
| F9 | Der Zuschau-Host baut die Saat aus der **UI-Wahl** Heim/Gast, nicht aus dem Fixture. Er prüft auch nicht, ob das Paar an diesem Spieltag überhaupt ein Fixture ist. Der Kommentar dort behauptet einen Rückfall auf Saat 1337 für Nicht-Fixture-Paare, den der Code nicht hat. | `app/foundation/battle-arena/FoundationBattleArenaHost.tsx:277-326` |
| F10 | Kein Deploy-Skript räumt alte Docker-Images weg (`prune` kommt nirgends vor). Jeder Auto-Deploy hinterlässt ein Image mehr. Chromium macht jedes Image um mehrere hundert MB größer. | `deploy/hetzner/*.sh` |
| F11 | Im Container läuft `npm` als PID 1 (`exec npm run start`), ohne Init-Prozess, der verwaiste Kindprozesse aufräumt. Abgestürzte Chromium-Kinder würden als Zombies stehen bleiben. Dazu kommt Dockers Standard-`/dev/shm` von 64 MB, an dem Chromium bekanntermaßen abstürzt. | `scripts/start-hosted.sh`, `deploy/hetzner/docker-compose.yml` |

### 1.4 Was am Ergebnis hängt — und was nicht

Nachgelesen, weil daran die Frage „vorläufig buchen und später korrigieren?“ hängt:

- **Unabhängig vom Ergebnis:** Fatigue- und Verletzungsbuchung. `lib/fatigue/fatigue-injury-service.ts`
  liest weder `teamPoints` noch `pointsAwarded` noch `resolutionSource`. Sie richtet sich nach
  Aufstellung und Intensität. Ebenso der Trainingsmodus: Er wird seit dem Umzug im Spieltagswechsel
  neu bewertet (`matchday-auto-run-service.ts:749-759`), nicht am Ergebnis.
- **Vom Ergebnis abhängig** (Team-Punkte bzw. Boxscore-PPs je Spieler): Tabelle
  (`lib/standings/standings-preview-engine.ts`), Punkte-Ledger (`lib/foundation/season-points-ledger.ts`),
  Spielerpunkte (`lib/foundation/player-points-total.ts`), MVP (`lib/season/matchday-mvp-scoring-service.ts`),
  organische Saisonprogression (`lib/training/organic-season-progression.ts`), KI-Verkaufsvorschau
  (`lib/ai/ai-transfermarkt-sell-preview-service.ts`) sowie Rekorde und Karrierestatistiken.

---

## 2. K1 — Auto-Run an die Arena anbinden

### 2.1 Grundsatz: Arena-Vorlauf am Snapshot statt Arena beim Buchen

```
Aufstellung gespeichert (Mensch oder KI-Batch)
  └─ ensureMatchdayResolveSnapshot()           heute: PPS/Brücken-Snapshot, synchron
       └─ NEU: kickoffArenaVorlauf(scope)       detached, nur Battle + gewertete Arena-Disziplin
             ├─ runBattleModeArenaMatchday(D1)  ~10–18 s je Disziplin (gemessen, 2.6)
             ├─ runBattleModeArenaMatchday(D2)  falls auch D2 arena-gewertet
             ├─ Preview NEU bauen mit arenaTeamPointsByDisciplineId
             │                     + arenaIndividualBoxscorePpsByDisciplineId
             │                     + arenaAusfallByDisciplineId (Abschnitt 3)
             └─ Snapshot ersetzen (nur wenn Signatur unverändert), Status "ready"
Bühne (arena-base) liest Snapshot      → zeigt Arena-Zeilen (oder markierte Brücke)
„Disziplin werten“ → Auto-Run          → bucht exakt diesen Snapshot, kein Chromium
```

Begründung: So bleibt „Was du siehst, wird gebucht“ für den Arena-Fall bestehen, der Buchungspfad
bleibt rein und idempotent, und die teure Chromium-Arbeit fällt in die Zeit zwischen „Aufstellung
gespeichert“ und „Bühne geöffnet“. Die Arena-Eingaben hängen nicht an Fatigue oder Form
(`lib/foundation/battle-arena/arena-kader-adapter.ts` liest weder das eine noch das andere), sondern
an Saat, Kader-Attributen, Aufstellung und Mutator-Wurf. Innerhalb eines Spieltags ändern sich die
nur durch eine Aufstellungs- oder Kaderänderung, und genau die verwirft schon heute die
Snapshot-Signatur.

### 2.2 Neue Bausteine (Skizze)

**Neue Datei `lib/season/arena-spieltag-vorlauf-service.ts`.** Sie übernimmt den Arena-Teil aus
`fuehreArenaMatchdayApplyAus()` (`arena-matchday-resolve-service.ts:161-300`). Dieser wird danach
NICHT mehr selbst buchen.

```ts
export type ArenaModus = "hintergrund" | "inline" | "aus";

export type ArenaVorlaufStatus = "in_progress" | "ready" | "failed";

/** Persistiert in seasonState, JE SPIELTAG statt des heutigen saveweiten Einzelfelds (F5). */
export type ArenaVorlaufRecord = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  /** buildMatchdayResolveSignature() beim Start — passt sie beim Schreiben nicht mehr, wird verworfen. */
  signature: string;
  status: ArenaVorlaufStatus;
  startedAt: string;
  finishedAt?: string | null;
  versuch: number;
  /** je arena-gewerteter Disziplin dieses Spieltags */
  disziplinen: Record<string, { status: "arena" | "ausgefallen"; ausfall?: ArenaAusfall | null; dauerMs?: number }>;
};

const laufendeVorlaeufe = new Map<string, Promise<ArenaVorlaufErgebnis>>(); // key: saveId|seasonId|matchdayId|signature
const chromiumSemaphor = erzeugeSemaphor(1); // global: hoechstens EIN Browser im Prozess (2.6)

export function kickoffArenaVorlauf(scope, opts?): { applicable: boolean; status: ArenaVorlaufStatus | null } { /* detached */ }
export async function stelleArenaVorlaufSicher(scope, opts: { modus: ArenaModus }): Promise<ArenaVorlaufErgebnis> { /* inline */ }
export function leseArenaVorlauf(gameState, scope): ArenaVorlaufRecord | null { /* inkl. Veraltet-Erkennung */ }
```

Anwendbar ist der Vorlauf genau dann, wenn `isBattleModeSave()` gilt und mindestens eine Seite (D1
oder D2) des Spieltags in `ARENA_RESOLVED_DISCIPLINE_IDS` steht. Das ist dieselbe Prüfung wie heute
`determineArenaDisciplineContexts()` (`arena-matchday-resolve-service.ts:100`). Manager Mode bleibt
damit byte-identisch.

**Erweiterung `buildLegacyMatchdayResolvePreviewPayload`** um ein optionales
`resolveOptions?: LegacyResolvePreviewOptions`, damit der Snapshot die Arena-Maps tragen kann
(`lib/lineups/legacy-lineup-types.ts:586, 632` existieren schon).

**Erweiterung `MatchdayResolveSnapshotRecord`** um `arenaVorlauf?: ArenaVorlaufRecord | null`. Dann
liest jeder, der den Snapshot liest, auch, ob Arena drin ist.

### 2.3 Auslösepunkte

1. **Lineup-Routen** (`app/api/lineups/legacy/route.ts:204`, `.../batch/route.ts:208`): direkt nach
   `ensureMatchdayResolveSnapshot()` ein `kickoffArenaVorlauf(scope)`. Wie dort üblich geschluckt:
   Ein Fehlschlag kippt das Speichern nicht.
2. **Arena-Base-Route** (`app/api/matchday/arena-base/route.ts` → `matchday-arena-base-service.ts:244`):
   Fehlt der Vorlauf (oder ist er veraltet), wird er angestoßen. Die Antwort trägt
   `arenaVorlauf: { status, disziplinen }`, damit die Bühne einen Wartezustand zeigen kann.
3. **Auto-Run** (Rückfall, falls 1 und 2 nicht gegriffen haben, z. B. Cockpit-Auto-Run oder Skripte),
   s. 2.4.
4. **Spieltagswechsel** (optional, Ausbaustufe): Der KI-Prewarm (`cockpit-matchday-handlers.ts:159`)
   legt für die KI-Teams schon Aufstellungen an. Ein Vorlauf lohnt sich aber erst, wenn auch der
   Mensch aufgestellt hat. Deshalb kein Auslöser hier.

### 2.4 Der Auto-Run selbst

Ein neuer Schritt `arena_vorlauf` zwischen `resolve_preview` und `result_apply`
(`MatchdayAutoRunStepKey`, `matchday-auto-run-service.ts:36`), dazu eine neue Option
`options.arenaModus`:

| Aufrufer | `arenaModus` | Verhalten, wenn Battle + Arena-Disziplin und kein fertiger Vorlauf |
|---|---|---|
| HTTP-Route `matchday-auto-run` | `"hintergrund"` (fest in der Route) | Vorlauf anstoßen (idempotent), Schritt `arena_vorlauf` mit `status: "blocked"`, `canContinue: false`, `blockingReasons: ["arena_vorlauf_laeuft"]`. Antwort `202` mit `arenaVorlauf.status = "in_progress"`. **Kein** `result_apply`. |
| Skripte (Smoke, Admin-Simulation, Bootstrap) | `"inline"` (Default des Service) | `await stelleArenaVorlaufSicher()`, danach normal weiter. |
| Tests ohne Chromium | `"aus"` oder `runArenaFixturesImpl`-Injektion | `"aus"` erzeugt **markierte** Brücke (`arena_ausgefallen:deaktiviert`), nie eine stille. |

Ist der Vorlauf `"ready"` oder `"failed"` (Letzteres mit markierter Brücke im Snapshot), gibt es
nichts zu warten: Der Auto-Run bucht den Snapshot wie heute. `previewToBook.source === "live"` (kein
gültiger Snapshot) darf in einem Battle-Save mit Arena-Disziplin **nicht** gebucht werden, solange
kein Vorlauf zu dieser Signatur fertig ist. Das ist die eine neue harte Regel im Auto-Run.

```ts
// matchday-auto-run-service.ts, nach resolve_preview, nur execute && battle && arena-Disziplin offen:
const vorlauf = arenaModus === "inline"
  ? await stelleArenaVorlaufSicher(scope, { modus: "inline", persistence })
  : kickoffArenaVorlauf(scope, { persistence });
if (vorlauf.status === "in_progress") {
  addStep(result, { key: "arena_vorlauf", status: "blocked", canContinue: false,
    blockingReasons: ["arena_vorlauf_laeuft"], metrics: { ... } , ... });
  return abschliessen(result);            // KEIN result_apply
}
// danach Snapshot NEU lesen (der Vorlauf hat ihn ersetzt) und wie bisher buchen
```

**UI dazu:** `commitArenaDiscipline` (`use-foundation-shell-router-body-scope.tsx:4677`) erkennt
`arena_vorlauf_laeuft` und wirft keinen `DisciplineCommitBlockedError`. Stattdessen setzt es den
Pollerzustand und wiederholt die Buchung, sobald der Status kippt. Im Normalfall tritt das gar nicht
auf, weil die Bühne „Disziplin werten“ erst freigibt, wenn `arenaVorlauf.status !== "in_progress"`.

### 2.5 Warten die nachgelagerten Schritte? — Ja, bewusst

Entscheidung: **`result_apply`, `standings_apply`, die Fatigue-Buchung (Teil von `result_apply`) und
das Training (Teil von `matchday_advance`) laufen erst, wenn der Vorlauf fertig oder sichtbar
gescheitert ist.** Keine vorläufige Brückenbuchung mit späterer Korrektur.

Begründung:
1. Fatigue und Training hängen nicht am Ergebnis (1.4). Für sie gewinnt eine vorläufige Buchung also
   nichts, sie verschiebt nur ihren Zeitpunkt.
2. Punkte und PPs hängen an sechs Lesern (1.4). Eine Korrektur müsste Tabelle, Ledger,
   Spielerpunkte, MVP und Progression zurückdrehen. Genau diese Klasse von „zweiter Rechnung“ hat das
   Projekt mehrfach teuer erwischt (`matchday-resolve-snapshot.ts:255-283`).
3. Die Bühne hätte bereits das Brücken-Ergebnis gezeigt. Eine spätere Arena-Korrektur hieße: Der
   Spieler sieht A, gebucht wird B.
4. Die Wartezeit liegt vor der Bühne, nicht in der Buchung, und beträgt gemessen 10–18 s je
   Disziplin (2.6).

### 2.6 Laufzeit — gemessen für diesen Plan

Gemessen am 16.10. in dieser Sitzung: frischer Battle-Save (`applyNewGameSetup`, Liga-Draft, alle
Teams KI), Spieltag 1 mit 16 Fixtures (8 je Liga), `runBattleModeArenaMatchday()` mit echtem
Playwright-Chromium (lokal Revision 1194), je Disziplin nacheinander. Umgebung: 4 Kerne, 16 GB.
Messskript: `scripts/messe-arena-spieltag.ts` (bei der Planung noch im Scratchpad, jetzt
eingecheckt, damit der Live-Test in Abschnitt 6.3 dasselbe Werkzeug nutzen kann). **Wichtig:** das
ist eine EINZELNE lokale Stichprobe auf 4 Kernen — die CX23-Zahlen unten (Faktor 1,5–2) sind eine
Hochrechnung, nicht gemessen. Vor dem Live-Test in 6.3 lohnt sich ein zweiter lokaler Lauf, um die
Streuung zwischen Disziplinen (10,2–17,8 s) von echter Server-Varianz zu trennen.

| Disziplin | ms (beide Ligen) | | Disziplin | ms |
|---|---:|---|---|---:|
| gewichtheben | 15 402 | | fechten | 12 795 |
| speed-schach | 11 056 | | staffel | 10 206 |
| showcase | 10 178 | | takeshis-castle | 11 158 |
| eiskunstlauf | 15 101 | | time-trial | 10 912 |
| breaking | 17 831 | | spurt | 11 783 |
| wettessen | 12 910 | | climbing | 12 739 |
| tennis | 13 299 | | **Median / Mittel** | **12,7 s / 12,7 s** |

Alle 13 lieferten 32 Overrides und keine Warnung. Ältere Repo-Zahlen passen dazu: „6–16+ s“
(Kommentar `arena-matchday-resolve-service.ts:25-29`), 7,4 s und 3,7 s im E2E-Test
(`docs/pm-briefings/opus-review-pr-867-produktivierungswelle-2-09-09.md:323`).

**Hochrechnung:**
- Spieltag mit einer Arena-Disziplin: ~13 s lokal. Mit zwei (WEG B, 32 Fixtures, vier Browserstarts):
  ~25–35 s lokal.
- CX23 (2 geteilte vCPU): Die Simulation ist ein einzelner JS-Thread je Browser, die Kernzahl zählt
  also kaum, die geteilte Leistung je Kern aber schon. **Schätzung Faktor 1,5–2 → 20–70 s je
  Spieltag.** Das ist eine Schätzung, live zu messen in Abschnitt 6.3.
- Saison: 26 Arena-Slots × 12,7 s ≈ **5,5 min Arena-Zeit lokal**, ~8–11 min auf dem CX23.
- Kleiner Gewinn, falls nötig: ein Browser je Vorlauf statt je Liga (heute
  `runBattleModeArenaMatchday` → `runArenaFixtures` je Tier, `battle-mode-arena-team-points.ts:1345`
  und `arena-headless-runner.ts:596`). Spart zwei bis drei Browserstarts je Spieltag. Nicht nötig für
  die Abnahme.

### 2.7 Koop: Doppelbuchung und Doppellauf verhindern

| Gefahr | Schutz |
|---|---|
| Zwei Spieler speichern fast gleichzeitig ihre Aufstellung → zwei Vorläufe | `laufendeVorlaeufe`-Map im Prozess (ein Container, ein Node-Prozess). Gleicher Schlüssel aus Spieltag und Signatur → dieselbe Promise. Der persistierte `ArenaVorlaufRecord` mit `status: "in_progress"` und `startedAt` deckt den Fall „Request kommt nach einem Neustart“ ab. |
| Aufstellung ändert sich während des 20–60-s-Laufs | Die Signatur wird beim Start festgehalten und vor dem Schreiben neu gerechnet. Weicht sie ab, wird das Ergebnis verworfen und ein neuer Vorlauf mit der neuen Signatur angestoßen. Die Saat ist deterministisch, also ist das nur verlorene Zeit, kein anderes Ergebnis für unveränderte Fixtures. |
| Der Hintergrundschreiber überschreibt den Stand des Mitspielers | Er schreibt nie den beim Start gelesenen Stand zurück. Er liest frisch, ersetzt **nur** `matchdayResolveSnapshots` und den Vorlauf-Record und schreibt. Bei `KoopSchreibkonfliktError` (`lib/persistence/koop-schreibkonflikt.ts`) wiederholt er bis zu drei Mal, nach dem Muster von `schreibeArenaMatchdayResolveStatus` (`arena-matchday-resolve-service.ts:139-159`). |
| Beide klicken „Disziplin werten“ | Wie heute: Der Auto-Run bucht den Snapshot. Die schon gebuchte Seite ist eingefroren (`frozenSides`), und ein zweites D1 bucht dieselben Zahlen. Neu ist nur, dass kein Chromium mehr im Buchungspfad steht, der zweite Klick also nichts Teures auslöst. |
| Kickoff-Doppelklick (F4) | Entfällt mit 2.8: Der Kickoff nutzt denselben entdoppelten Vorlauf. |
| Hängender Status nach Container-Neustart (F5) | `leseArenaVorlauf` wertet `in_progress` mit `startedAt` älter als 5 min als `failed` mit Grund `abgebrochen_neustart` und gibt einen Neustart frei. Der Poller hört dann auf. |
| Zwei verschiedene Saves gleichzeitig (Chris und Franky in getrennten Spielständen) | Globaler `chromiumSemaphor(1)`: Der zweite Vorlauf wartet, statt einen zweiten Browser zu starten (RAM, 4.3). |

Nach dem Schreiben meldet der Vorlauf `notifyRoomGameplayWrite` mit `affectedViews: ["arena",
"matchday"]`. Die Bühne des Mitspielers lädt dann neu, statt bis zum nächsten Poll veraltete
Brücken-Zeilen zu zeigen.

### 2.8 Was mit dem Kickoff-Pfad passiert

`kickoffArenaMatchdayApply` wird zu einem dünnen Mantel. Liegt ein fertiger Vorlauf vor, bucht er
synchron den Snapshot, wie der Auto-Run. Andernfalls stößt er den Vorlauf an und antwortet
`in_progress`. `fuehreArenaMatchdayApplyAus` baut keine eigene Live-Preview mehr (F3). So bleibt am
Ende **ein** Arena-Weg, nicht zwei. Das alte Feld `seasonState.arenaMatchdayResolveStatus` wird für
eine Übergangszeit aus dem neuen Record abgeleitet (Poller und Banner lesen weiter), danach entfernt.

---

## 3. Sichtbare Ausfälle (harte Auflage der Aufsicht)

### 3.1 Der Typ

In `lib/resolve/legacy-matchday-resolve-types.ts` (neben `DisciplineResolutionSource`, Zeile 92):

```ts
export type ArenaAusfallGrund =
  | "chromium_start"         // Launch scheitert: Binary fehlt, Abhaengigkeit fehlt (E1!)
  | "timeout"                // seitenTimeoutMs (20 s, arena-headless-runner.ts:65) oder Gesamt-Timeout
  | "absturz"                // Target/Page closed, Renderer crash, OOM
  | "liga_fehlgeschlagen"    // eine Liga warf, die andere lief (Teil-Ausfall)
  | "ergebnis_unvollstaendig"// arena_matchday_missing_result: Team ohne Duell-Ergebnis
  | "abgebrochen_neustart"   // in_progress aelter als 5 min
  | "deaktiviert"            // arenaModus "aus" (Tests/Notschalter)
  | "nicht_ausgefuehrt";     // Engine-Strukturpruefung: gewertet, aber nie versucht (die K1-Klasse)

export type ArenaAusfall = {
  grund: ArenaAusfallGrund;
  /** gekuerzte Fehlermeldung, max. 200 Zeichen, nur fuer Log/Tooltip */
  detail?: string | null;
  leagueTier?: string | null;
  zeitpunkt: string;
  versuch: number;
};
```

### 3.2 Wo die Markierung technisch sitzt

1. **`DisciplineTeamResolvePreview`** (`legacy-matchday-resolve-types.ts:94-209`): neues optionales
   Feld `arenaAusfall?: ArenaAusfall | null`. Dazu kommt in `warnings` der String
   `arena_ausgefallen:<grund>`. Das ist der Kanal, den Cockpit und Auto-Run-Schritte schon anzeigen.
   `resolutionSource` bleibt `"pps_duell"` und `pointSource` bleibt
   `"battle_mode_pps_duell_win_draw_loss"`. Damit bleiben `istDuellWertung`
   (`lib/resolve/battle-mode-pps-duell.ts:219`) und alle Tabellen-Invarianten unberührt: Die Brücke
   rechnet korrekt weiter, sie ist nur markiert.
2. **`LegacyMatchdayResolvePreview`** (`:240`): neues `arenaLaufByDisciplineId?: Record<string,
   { status: "arena" | "ausgefallen" | "nicht_gewertet"; ausfall?: ArenaAusfall | null }>` für Banner
   und Bühne. So muss niemand 32 Zeilen durchsuchen.
3. **`DisciplineResultRecord`** (`lib/data/olyDataTypes.ts:2566-2612`, das Ledger): dasselbe optionale
   `arenaAusfall` wird additiv persistiert, so wie `arenaMatchSeed` und `verhaeltnis`. Durchgereicht
   über `DisciplineResultWritePayload` (`lib/resolve/legacy-matchday-result-mapper.ts:74, 236`). Fehlt
   das Feld bei alten Zeilen, heißt das „kein Ausfall bekannt“.
4. **Engine-Strukturprüfung** in `legacy-matchday-resolve-engine.ts` (Block `:797-905`): Neue Option
   `arenaAusfallByDisciplineId` in `LegacyResolvePreviewOptions`. Dazu eine Regel, die nicht vom
   Aufrufer abhängt: Gilt `isBattleModeArenaEligible`, steht `disciplineId` in
   `ARENA_RESOLVED_DISCIPLINE_IDS` und liegt weder ein Arena-Override noch ein erklärter Ausfall vor,
   dann setzt die Engine `arenaAusfall = { grund: "nicht_ausgefuehrt" }`. Der Import ist erlaubt, denn
   `lib/battle/arena-resolved-disciplines.ts` hat absichtlich keine Fremd-Importe. **Diese eine Regel
   hätte den Smoke-Befund vom 16.10. als 832 rot markierte Zeilen gezeigt statt als stillen Erfolg.**
5. **Teil-Ausfall:** `runBattleModeArenaMatchday` liefert statt nur der Warn-Strings
   (`battle-mode-arena-team-points.ts:1369, 1385`) zusätzlich eine strukturierte
   `ausfaelleByTeamId: Map<string, ArenaAusfall>`. Fällt nur Liga 2 aus, sind nur deren 16 Teams
   markiert, Liga 1 bleibt Arena.

### 3.3 Wo der Spieler es sieht

| Ort | Anzeige |
|---|---|
| Shell-Banner (`FoundationShellRouterBody.tsx:910-934`) | Text nicht mehr disziplinfest (F6): „Arena-Duelle dieses Spieltags laufen …“ bei `in_progress`. Bei Ausfall: „Arena ausgefallen (<Disziplin>: <Grund>) — gewertet über PPS-Duell“ als Warnung, nicht als Fehler, denn der Spieltag ist spielbar. |
| Bühne (`app/foundation/discipline-stage/DisciplineStageArena.tsx`, Daten aus `discipline-stage-from-preview.ts`) | Wartezustand „Arena-Duelle werden ausgetragen …“, solange der Vorlauf läuft (2.3.2). Bei Ausfall ein Abzeichen je Disziplin: „PPS-Wertung — Arena ausgefallen: Timeout“. |
| Cockpit-Auto-Run-Schritte (`FoundationCockpitPanel.tsx:1246`) | Neuer Schritt `arena_vorlauf` mit Status `warning` und Metriken `dauerMs`, `grund`, `versuch`. |
| Spieltagsergebnis / Ledger-Ansichten | Aus `DisciplineResultRecord.arenaAusfall`: ein dezentes „PPS (Arena ausgefallen)“ statt der Arena-Quelle. |
| Server-Log | Ein Eintrag je Ausfall mit `saveId`, `matchdayId`, Disziplin, Grund und Detail (`console.error`, nicht `warn`). Chris findet ihn mit `docker compose logs oly-app`. |

### 3.4 Wiederholung

Vorschlag: genau **eine** automatische Wiederholung bei `absturz`/`timeout`/`chromium_start`, und
zwar nur für die betroffene Disziplin bzw. Liga. Danach gilt der Ausfall als endgültig für diese
Signatur. Zusätzlich ein Knopf „Arena erneut versuchen“ auf der Bühne, solange die Seite noch nicht
gebucht ist. Nach der Buchung wird nichts mehr umgeschrieben (2.5). → Chris bestätigen lassen
(Abschnitt 8).

---

## 4. E1 — Chromium ins Produktions-Image

### 4.1 Was das Dockerfile braucht (Skizze, runner-Stage `Dockerfile:35-101`)

```dockerfile
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV OLY_ARENA_CHROMIUM_EXECUTABLE=""
# ... bestehende ENV-Zeilen ...

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ tzdata git \
  && rm -rf /var/lib/apt/lists/* \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 oly

# EIGENE SCHICHT, VOR dem App-COPY: wird nur neu gebaut, wenn sich die Playwright-Version aendert,
# nicht bei jedem Push (sonst laedt jeder Auto-Deploy ~150 MB Chromium + apt-Pakete neu).
# Version MUSS der im package-lock.json entsprechen (CI-Waechter, s. 6.1).
RUN npx -y playwright@1.60.0 install --with-deps --no-shell chromium \
  && chmod -R a+rX /ms-playwright \
  && rm -rf /var/lib/apt/lists/* /root/.npm

COPY --from=builder --chown=oly:nodejs /app ./
# ... Rest unveraendert ...
```

Dazu im Code und in der Konfiguration:
- `arena-headless-runner.ts:64`: Der feste Pfad `/opt/pw-browsers/chromium-1194/...` wird durch
  `process.env.OLY_ARENA_CHROMIUM_EXECUTABLE || <Standard>` ersetzt. Ohne gesetzte Variable gilt der
  Playwright-Standard aus `PLAYWRIGHT_BROWSERS_PATH`, also Revision 1223 (F7).
- Launch-Argumente zusätzlich `--disable-dev-shm-usage` (F11, gegen Dockers 64-MB-`/dev/shm`).
- `package.json`: `playwright` als echte `dependency` (F8), gleiche Version wie `@playwright/test`.
- `deploy/hetzner/docker-compose.yml`, Dienst `oly-app`: `init: true` (räumt Zombie-Kindprozesse weg,
  F11) und `shm_size: "256m"` (doppelte Absicherung zu `--disable-dev-shm-usage`). **Kein**
  `mem_limit` im ersten Schritt, sonst tötet der OOM-Killer im Zweifel die App statt des Browsers.
  Erst messen (6.3), dann entscheiden.
- `deploy/hetzner/auto-deploy.sh`: nach erfolgreichem `up -d --build` ein `docker image prune -f`
  (F10). Entfernt nur verwaiste Images, nie das laufende.
- **Start-Selbsttest:** Eine Zeile im Healthcheck oder ein Einmal-Log beim Start, „Chromium
  startbar: ja/nein (Revision, Pfad)“. So zeigt sich ein kaputtes Image, bevor der erste Spieltag
  hängt. `/api/health` könnte das Feld `arenaChromium: "ok" | "fehlt"` tragen, damit es auch ohne SSH
  per HTTPS prüfbar ist.

### 4.2 Bildgröße (Schätzung mit gemessener Grundlage)

- Chromium Revision 1223, voller Browser, entpackt: **377 MB** (gemessen hier:
  `du -sh /opt/pw-browsers/chromium-1223`). Mit Headless-Shell zusätzlich 260 MB. Deshalb
  `--no-shell`, denn der Rückfall `channel: "chromium"` braucht nur den vollen Browser.
- System-Abhängigkeiten von `--with-deps` auf Bookworm (libnss3, libgbm1, libatk*, libcups2,
  libxkbcommon, libasound2, Pango/Cairo, mehrere Font-Pakete inklusive CJK/Emoji):
  **erfahrungsgemäß 200–350 MB**. Das ist eine Schätzung; die echte Zahl liefert `docker image ls`
  nach dem ersten Build.
- **Summe: +0,6 bis +0,75 GB je Image.** Mit F10 (kein Prune) multipliziert sich das mit der Zahl der
  liegengebliebenen Images. Auf einer 40-GB-Platte mit der bekannten Vorgeschichte („no space left on
  device“, CLAUDE.md, 01.09.) ist das der eigentliche Engpass, nicht der RAM.

### 4.3 On demand oder dauerhaft warm? — On demand bleibt

Heute umgesetzt und begründet ist **on demand**: Browser je Aufruf starten und im `finally` hart
schließen (`arena-headless-runner.ts:25-44, 596, 720-722`; Plan
`docs/design/battle-mode-spielmodus-plan.md` 5.4). Der Vorlauf ändert daran nichts, er verstärkt die
Begründung sogar: Er läuft im Hintergrund, niemand wartet synchron. Ob der Browser 1–2 s zum Starten
braucht, ist bei 10–18 s Laufzeit je Disziplin unerheblich. Ein warmer Browser würde dagegen rund um
die Uhr RAM auf einer 4-GB-Maschine belegen, die auch LEC und Caddy trägt.

**„Nur bei Bedarf installieren“** (Chromium erst zur Laufzeit herunterladen) ist **keine** Option.
Der Container hat zur Laufzeit keinen verlässlichen Schreibort außerhalb der Volumes, der erste
Spieltag hinge an einem Download, und die Playwright-Revision wäre nicht mehr im Image festgenagelt.
Installieren also immer im Image, starten nur bei Bedarf.

### 4.4 RAM und Parallelität

Gemessen in dieser Sitzung während `runBattleModeArenaMatchday` (ein Browser, eine Seite, 8 Fixtures
je Liga):

| Größe | Wert |
|---|---|
| Spitze **PSS** aller Chromium-Prozesse (echter Anteil, ohne Doppelzählung geteilter Seiten) | **519–571 MB** |
| Spitze Summe RSS (überzählt geteilte Bibliotheken) | 918–1 055 MB |
| Node-Prozess des Messskripts | 1,27–1,59 GB (enthält Draft und vollen Spielstand; die laufende App braucht das zusätzlich zum Browser, ihr eigener Wert ist live zu messen) |

Folgerung für den **CX23 (laut `deploy/hetzner/README.md`; 4 GB RAM, 2 vCPU, 40 GB laut
Hetzner-Datenblatt, mit 4 GB Swap aus `bootstrap.sh`)**:
- **Ein Browser gleichzeitig: ja** (~0,55 GB zusätzlich).
- **Zwei parallel: nein.** Mit App, LEC und Caddy wären 4 GB knapp, und Swap macht die Simulation
  unvorhersehbar langsam. Parallelität brächte auch kaum etwas, denn die Simulation ist ein
  JS-Thread je Browser, und zwei Browser teilen sich zwei geteilte vCPUs mit der App.
- **Sequenziell** ist deshalb Pflicht: Je Spieltag laufen D1 und D2 nacheinander (wie heute, WEG B),
  je Disziplin Liga 1 und Liga 2 nacheinander. Über Saves hinweg sorgt der globale Semaphor dafür,
  dass ein Vorlauf wartet, statt einen zweiten Browser zu starten. Bei 32 Fixtures je Spieltag (zwei
  Arena-Disziplinen × 16) bleibt es bei höchstens einem Browser zur Zeit.

### 4.5 Wonach Chris auf dem Server schauen soll (der Platten- und RAM-Check ist seine Aufgabe)

Vor dem Merge von PR E1, auf dem Server (`ssh root@135.181.102.2`), je Befehl eine Zeile:

```sh
df -h /
docker system df
docker image ls
du -sh /var/lib/docker
free -m
nproc
docker stats --no-stream
```

Worauf es ankommt:
- `df -h /`: Wie viel ist auf `/` frei? Für den ersten Build mit Chromium sollten **mindestens 5 GB
  frei** sein (neues Image, Build-Zwischenschichten, altes Image läuft noch).
- `docker system df` und `docker image ls`: Wie viele alte, ungenutzte Images liegen herum und wie
  groß sind sie? Das ist der Posten, den F10 künftig wegräumt. Einmalig von Hand:
  `docker image prune -f`.
- `free -m` und `docker stats --no-stream`: Was braucht `oly-app` im Leerlauf, was `lec-app`? Bleiben
  neben beiden **mindestens 1 GB frei**, passt ein Browser (~0,55 GB).
- `nproc`: Ist es noch die CX23 mit 2 vCPU, oder wurde die Maschine schon vergrößert? Das ändert die
  Laufzeitschätzung in 2.6.

Nach dem ersten Deploy mit Chromium:

```sh
docker compose -f deploy/hetzner/docker-compose.yml exec oly-app df -h /dev/shm
docker compose -f deploy/hetzner/docker-compose.yml logs --since 30m oly-app
```

Erwartet: `/dev/shm` bei 256M, und im Log die Startzeile „Chromium startbar: ja“.

---

## 5. Determinismus — Auto-Run, Kickoff und Zuschau-Host sehen dasselbe Spiel

### 5.1 Der Mechanismus heute

1. **Seed-String** `buildArenaMatchSeed()` (`lib/battle/arena-seed.ts:59-68`):
   `${saveId}:${seasonId}:${matchdayId}:arena:${disciplineId}:${homeTeamId}:${awayTeamId}`. Die
   `disciplineId` steckt seit WEG B darin, damit D1 und D2 desselben Paares verschiedene Spiele sind.
2. **Hash** `seedZuZahl()` (`arena-seed.ts:39-48`): FNV-1a, 32 Bit, `>>> 0`. Nötig, weil der
   Motor-PRNG ein LCG ist (`seed*1664525+1013904223`) und ein String-Seed dort zu `NaN → 0`
   kollabieren würde (`arena-headless-runner.ts:67-92`).
3. **Eine Quelle, drei Aufrufer:** `arena-seed.ts` ist bewusst die einzige Implementierung
   (Client-tauglich, ohne Playwright-Importe). Der Runner nutzt sie über
   `runBattleModeArenaMatchday` (`battle-mode-arena-team-points.ts:1353-1360`) und
   `bereiteFixturesVor` (`arena-headless-runner.ts:441`), der Host direkt
   (`FoundationBattleArenaHost.tsx:307-316`).
4. **Weitere Eingaben, die gleich sein müssen:** Kader über `buildArenaTeam` (gleicher Adapter,
   `arena-headless-runner.ts:427-428` und Host), Aufstellung über `buildArenaAufstellungBeide`
   (gleicher Adapter, `:432` und Host `:492`), Mutator-Wurf über
   `resolveMatchdayMutatorTraitsForDiscipline` bzw. `buildMatchdayMutatorTraitsBySide`. Das ist
   dieselbe Funktion (`lib/lineups/legacy-lineup-modifiers.ts:377, 408`). Dazu die Motor-Dateien
   `public/mockups/battle-mode.engine.js` und `battle-mode.rezepte.js` sowie die V8-/Chromium-Version.

**Auto-Run und Kickoff sind damit nach dem Umbau automatisch identisch**, weil es nur noch einen
Vorlauf gibt (2.8), der `runBattleModeArenaMatchday` aufruft. Die Saat hängt nur an IDs und nicht am
Zeitpunkt.

### 5.2 Die Lücken und wie sie geschlossen werden

| Lücke | Wirkung | Maßnahme |
|---|---|---|
| **Host-Orientierung (F9):** Der Host nimmt Heim/Gast aus der UI-Auswahl (`FoundationBattleArenaHost.tsx:115-127`). Wählt der Spieler das Fixture verkehrt herum, heißt der String `...:<away>:<home>`, die Saat ist eine andere und die Seiten sind vertauscht. | Der Zuschauer sieht ein anderes Spiel als das gewertete, ohne Hinweis. | Der Host sucht das Fixture über `findeSpieltagsFixtures()` (`battle-mode-pps-duell.ts:80`, bewusst ohne Fremd-Importe nutzbar). Er baut die Saat **in Fixture-Orientierung** und tauscht die Anzeige-Seiten, wenn nötig. Ist das Paar kein Fixture dieses Spieltags, gibt es keine Saat (Rückfall 1337, wie der Kommentar schon behauptet), dazu ein Hinweis „kein gewertetes Duell“. |
| **Chromium-Revision (F7):** Lokale Messungen und Abnahmen liefen auf 1194, CI und künftig Prod laufen auf 1223. | Wenn V8 zwischen den Revisionen Gleitkomma-Mathematik anders rundet (selten, aber ohne Messung nicht auszuschließen), unterscheiden sich lokale Abnahme und Live-Wertung. | **Goldentest:** Ein fester Battle-Fixture-Satz (2 Disziplinen je Chassis, feste Saaten) wird mit Revision 1223 gerechnet, und seine `seiten` und Boxscores werden eingecheckt. CI vergleicht bitgenau. Läuft lokal einmalig auch gegen 1194; bei Abweichung wird das Abnahme-Messwerkzeug auf 1223 umgestellt. |
| **Host zeigt den aktuellen Stand, gewertet wurde der Vorlauf-Stand** | Innerhalb eines Spieltags gleich (2.1). Nach dem Spieltagswechsel zeigt der Host aber schon den nächsten Spieltag. | Außer Scope dieses Plans. Für ein späteres Replay ist `arenaMatchSeed` je Zeile schon persistiert (`olyDataTypes.ts:2591`). Notiert, nicht gebaut. |
| **Eingabe-Fingerabdruck fehlt** | Man kann einer gebuchten Zeile nicht ansehen, ob Kader und Aufstellung beim Vorlauf dieselben waren, die der Host später zeigt. | Der Vorlauf speichert je Disziplin `arenaEingabeHash` (Hash über Seed, Kader-JSON, Aufstellung, Mutatoren und Hash der Motor-Dateien) im `ArenaVorlaufRecord`. Rein diagnostisch. |

### 5.3 Test

`tests/arena-seed-identitaet.test.ts` (neu, ohne Chromium): Für einen Fixture-Satz liefern
Runner-Eingabebau (`bereiteFixturesVor`) und Host-Saatberechnung (als reine Funktion herausgezogen)
denselben Zahlen-Seed, auch wenn die UI-Auswahl verkehrt herum ist. Für Nicht-Fixture-Paare liefert
der Host keine Saat.

---

## 6. Abnahmeplan

### 6.1 Vor dem Umbau (Voraussetzung)

- **Task #164 zuerst einchecken:** der schmale CI-Invariantentest für Battle-Saves. Er hält fest, was
  der Umbau nicht brechen darf: `teamPoints ∈ {0,1,2}`, Punktsumme je Fixture = 2,
  `verhaeltnis`-Summe je Fixture und je Liga = 0, ganzzahlige Tabellenpunkte, keine Zeile mit
  `resolutionSource: "pps"` in einem Battle-Save (die Prüfungen aus `scripts/e2e-battle-pps-duell.ts`,
  als Vitest). Er läuft heute grün, auf der Brücke, und muss nach jedem PR dieses Plans grün bleiben.
- Zusätzlich vor dem Umbau, in der Regel im selben Zug: ein CI-Wächter, dass die Playwright-Version im
  Dockerfile (`playwright@1.60.0`) der Version im `package-lock.json` entspricht.

### 6.2 Vor dem Merge (lokal und CI)

| # | Nachweis | Erwartung |
|---|---|---|
| 1 | **Voller Battle-Smoke mit echtem Chromium:** `scripts/multi-season-smoke.ts --game-mode=battle --seasons=1` (Auto-Run mit `arenaModus: "inline"`) | Saison mit 20 Spieltagen läuft durch. Auswertung über die gebuchten `DisciplineResultRecord`: **genau die 13 Disziplinen aus `ARENA_RESOLVED_DISCIPLINE_IDS` mit `resolutionSource: "arena"`**, also 26 Slots × 32 Teams = **832 Zeilen**. Die übrigen 7 (Basketball, Hockey, Football, I-Spy, Battlefield, TDM, Mini-DM) mit `"pps_duell"`: 14 × 32 = **448 Zeilen**. **0** Zeilen `"pps"`, **0** Zeilen mit `arenaAusfall`, jede Arena-Zeile mit `arenaMatchSeed` und `duellSeiten`. |
| 2 | Invarianten aus #164 auf dem Smoke-Save | alle grün, auch über die Arena-Zeilen (Arena-Fixtures summieren ebenfalls auf 2, Verhältnis auf 0) |
| 3 | **Ausfall-Probe** (Vitest mit `runArenaFixturesImpl`, das wirft bzw. nur Liga 1 liefert bzw. hängt) | Ganzer Ausfall: alle Zeilen der Disziplin `pps_duell` + `arenaAusfall.grund` passend, Warnung `arena_ausgefallen:<grund>`, Spieltag buchbar. Teil-Ausfall: nur 16 Teams markiert. Timeout: `grund: "timeout"`, kein Hänger. |
| 4 | **Strukturprüfung der Engine** (Vitest): Battle-Save, Arena-Disziplin, keine Arena-Maps, kein erklärter Ausfall | Jede Zeile trägt `arena_ausgefallen:nicht_ausgefuehrt`. Gegenprobe Manager-Save: byte-identisch zu vorher. |
| 5 | **Koop/Doppellauf** (Vitest, Chromium injiziert mit künstlicher Verzögerung) | Zwei `kickoffArenaVorlauf` mit gleicher Signatur → `runArenaFixturesImpl` genau einmal je Disziplin und Liga aufgerufen. Signaturwechsel während des Laufs → Ergebnis verworfen, neuer Lauf. Koop-Schreibkonflikt beim Schreiben → Wiederholung, am Ende genau ein Snapshot. Zwei D1-Buchungen → identische Zeilen. |
| 6 | **„Was du siehst, wird gebucht“** | Für einen Arena-Spieltag: Snapshot-Preview (Bühne) und gebuchte Zeilen sind Zeile für Zeile gleich (Team-Punkte, `duellSeiten`, PPs je Spieler). Gleiche Messart wie `matchday-resolve-snapshot.ts:264-272`. |
| 7 | **Determinismus** | Goldentest (5.2) grün. Saat-Identitätstest (5.3) grün. Zwei Vorläufe derselben Signatur liefern bitgleiche Ergebnisse. |
| 8 | **Image-Probe in CI** | `docker build` und danach im Container `node -e` mit `chromium.launch()` plus ein Mini-`runArenaFixtures` über 2 Fixtures, als User `oly`, mit Compose-Einstellungen (`shm_size`, `init`). Erwartet: läuft, Exit-Code 0, Bildgrößen-Delta im Log. |
| 9 | Laufzeit | Smoke-Log je Spieltag: `arena_vorlauf.dauerMs`. Erwartet etwa 13 s (eine Arena-Disziplin) bzw. 25–35 s (zwei) lokal, Abweichung > 2× → klären. |
| 10 | Manager Mode unverändert | Bestehender Manager-Smoke `scripts/multi-season-smoke.ts` (ohne `--game-mode`): gebuchte Zeilen byte-identisch zum Stand vor dem Umbau. |

### 6.3 Nach dem Merge, live auf dem Server mit Franky

Voraussetzungen: `pruefe-spiegel-frische.ts` grün, Chris hat 4.5 gemacht, Auto-Deploy ist durch. Die
Sidebar-Version zeigt den Merge-SHA, `/api/health` meldet 200 und `arenaChromium: "ok"`.

1. Als **Franky** (Testbenutzer, Passwort bei Chris) einen **neuen** Battle-Save anlegen. Nie den
   echten Spielstand von Chris oder Franky benutzen, weil der Test echte Daten schreibt.
2. Bis zu einem Spieltag spielen, dessen D1 oder D2 arena-gewertet ist, am besten einer mit beiden
   (WEG B). Die eigene Aufstellung speichern.
3. Banner bzw. Bühnen-Wartezustand beobachten: „Arena-Duelle werden ausgetragen …“. **Die Zeit bis
   „fertig“ stoppen.** Das ist die echte CX23-Zahl für 2.6. Chris lässt währenddessen auf dem Server
   `docker stats --no-stream` zwei, drei Mal laufen (RAM-Spitze von `oly-app`).
4. Bühne abspielen und beide Disziplinen werten. Erwartung: Die Arena-Disziplin zeigt keinen
   Ausfall-Hinweis, die Brücken-Disziplin zeigt die normale PPS-Duell-Darstellung.
5. **Nachweis der gebuchten Quelle**, ohne SSH: Nach dem nächsten `live-save`-Spiegel
   (`pruefe-spiegel-frische.ts`) das Abbild ziehen (CLAUDE.md „An die Spielstände kommen“) und für den
   Franky-Save die `disciplineResults` dieses Spieltags zählen. Erwartet: 32 × `"arena"` je
   arena-gewerteter Disziplin, mit `arenaMatchSeed`, und kein `arenaAusfall`.
6. **Determinismus-Stichprobe:** Im Zuschau-Host das eigene Fixture öffnen (auch einmal bewusst mit
   vertauschter Heim/Gast-Auswahl). Der gezeigte Endstand muss den gebuchten `duellSeiten` entsprechen.
7. Server-Log ohne `arena_ausgefallen` (Chris: `docker compose ... logs --since 1h oly-app`).
8. **Ausfall-Probe live:** nur mit Chris und nur, wenn er will. Zum Beispiel per
   Umgebungsvariable `OLY_ARENA_ERZWINGE_AUSFALL=timeout` für einen Neustart, oder sie wird bewusst
   nur lokal gefahren (6.2 #3). Kein Agent schaltet so etwas live.
9. **Aufräumen:** Den Franky-Testsave danach löschen oder Chris um Löschung bitten. Auf keinen Fall
   liegen lassen, damit er nicht in Auswertungen oder Spiegel-Prüfungen landet. Gleiches gilt für
   eventuell angelegte Kartenschmiede-Testabende (CLAUDE.md, nur `gespeichertVon: "Franky"`).

---

## 7. PR-Schnitt (Reihenfolge)

1. **PR 0 — Task #164** (CI-Invariantentest) und der Playwright-Versions-Wächter. Keine
   Verhaltensänderung.
2. **PR 1 — Sichtbarkeit zuerst (Abschnitt 3):** Typen, Engine-Strukturprüfung, Ledger-Feld,
   Banner/Bühne/Cockpit-Anzeige. Danach zeigt `main` den heutigen K1-Fehler offen
   (`nicht_ausgefuehrt` an allen 26 Arena-Slots). Das ist gewollt, ehrlich und ändert keine Punkte.
3. **PR 2 — E1 Image (Abschnitt 4):** Dockerfile, Compose (`init`, `shm_size`), konfigurierbarer
   Pfad, `playwright` als Dependency, `image prune`, Chromium-Selbsttest. Kann vor PR 3 live gehen,
   ändert aber noch nichts am Spielfluss. **Vorher macht Chris 4.5.**
4. **PR 3 — K1 Vorlauf (Abschnitt 2):** Vorlauf-Service, Auslöser, Auto-Run-Schritt, Kickoff als
   Mantel, Poller/Status je Spieltag, Koop-Schutz. Abnahme 6.2 vollständig.
5. **PR 4 — Determinismus-Feinschliff (Abschnitt 5):** Host-Orientierung, Goldentest,
   Eingabe-Fingerabdruck.
6. Live-Abnahme 6.3 nach PR 3 (und erneut nach PR 4 für Punkt 6).

PR 1 vor PR 3 hat einen eigenen Wert: Fällt PR 3 später aus irgendeinem Grund zurück (Image, RAM),
ist der Zustand wenigstens sichtbar statt still.

---

## 8. Offene Punkte für Chris / die Aufsicht

1. **Wartezeit vor der Bühne:** Auf dem CX23 schätzungsweise 20–70 s an Spieltagen mit zwei
   Arena-Disziplinen, nach der letzten gespeicherten Aufstellung. Ist das als „die Duelle werden
   ausgetragen“ akzeptabel? Die Alternative wäre, die Bühne sofort mit der Brücke spielen zu lassen
   und danach Arena zu buchen. Das bricht aber „Was du siehst, wird gebucht“ und wird hier
   ausdrücklich nicht empfohlen.
2. **Automatische Wiederholung** (3.4): eine Wiederholung, danach endgültig Brücke mit Markierung.
   Oder gar keine automatische und nur der Knopf?
3. **Ein Ausfall nach der Buchung** wird nie nachträglich auf Arena umgebucht (2.5). Bestätigen.
4. **Plattenplatz und RAM** (4.5): Chris' Messung entscheidet, ob PR 2 so geht oder ob vorher
   aufgeräumt bzw. die Maschine vergrößert werden muss.
5. **Mittelfristig** (unverändert aus `battle-mode-spielmodus-plan.md` 5.4): Der eigentliche Fix wäre,
   `battle-mode.engine.js` vom DOM zu entkoppeln und in Node (Worker-Thread) zu rechnen, ohne
   Chromium. Das gehört nicht in diesen Plan, macht aber E1, 4.4 und Teile von 5.2 überflüssig. Vor
   allem deshalb soll der Vorlauf-Service hinter einer Schnittstelle stehen
   (`runArenaFixturesImpl`), die später gegen einen Node-Motor tauschbar ist.

---

## 9. Auflagen der Projektaufsicht (16.10., nach Prüfung dieses Plans)

Der Plan ist freigegeben, Umsetzung kann beginnen — mit sechs Ergänzungen, die vor bzw. während des
jeweiligen PRs einzuarbeiten sind:

1. **Timeout aus der CX23-Messung ableiten, nicht raten.** `seitenTimeoutMs` (`arena-headless-runner.ts:65`,
   heute 20s) muss klären, ob er Seitenladen oder den ganzen `evaluate` über 8 Fixtures abdeckt. Liegt
   der Live-Lauf einer Liga nahe am Timeout, fällt live systematisch alles mit `grund: "timeout"` auf
   die Brücke — sichtbar, aber ein Totalausfall. Auflage: Timeout als Budget aus der 6.3-Messung
   ableiten, mindestens 3× Puffer auf den Median je Liga, per ENV konfigurierbar.
2. **`arenaEingabeHash` beim Buchen aktiv prüfen, nicht nur diagnostisch speichern.** Weicht der beim
   Buchen neu berechnete Hash vom Vorlauf-Hash ab, wird KEINE Arena gebucht, der Vorlauf läuft neu —
   sichtbar statt eine stille Divergenz. Vor dem Bau nachweisen, dass die Signatur wirklich alle
   Arena-Eingaben abdeckt: Formkarten (seit 15.10. gekoppelt), Mutator-Wurf, Teilaufstellungen, und ob
   der Vorlauf wie `fuehreArenaMatchdayApplyAus()` `attachMatchdayInjuryPerformanceToContexts()` vor
   dem Preview anhängt.
3. **`/api/health` darf nicht bei jedem Aufruf Chromium starten.** Der Selbsttest läuft einmal beim
   Start, das Ergebnis wird gecacht; `/api/health` liefert nur den Cache.
4. **Die App muss während des Vorlaufs reagieren.** Chromium teilt sich zwei vCPU mit App/LEC/Caddy.
   Im Live-Test (6.3) zusätzlich messen: Antwortzeit von `/api/health` o.ä. während ein Vorlauf läuft.
   Erwägen: Browser mit niedrigerer Priorität starten (`nice`-Wrapper als `executablePath`).
5. **Sandbox und Netz im E1-PR offenlegen.** Dokumentieren, ob Chromium als User `oly` mit oder ohne
   `--no-sandbox` läuft, und dass die Seite nur lokale Motor-Dateien lädt
   (`ARENA_NETZWERK_ABRIEGELUNG_ARGS`) — bewusste, dokumentierte Entscheidung, nicht implizit.
6. **Die Abnahmetabelle hängt an der Chromium-Revision.** `data/generated/disziplin-abnahme.json` ist
   mit Revision 1194 gemessen. Zeigt der Goldentest (5.2) Abweichungen zwischen 1194 und 1223, muss
   die Tabelle für Produktion neu gemessen werden, bevor PR 3 live geht.

**Reihenfolge/Freigaben:**
- **PR 0** (Invarianten-Vitest #164 + Chromium-Versionswächter) **und PR 1** (Sichtbarkeit:
  `arenaAusfall` + Engine-Check `nicht_ausgefuehrt`): **sofort freigegeben**, bauen. Für PR 1 die
  übliche Bit-Identität von Manager-Saves am Abbild nachweisen. Nach dem Merge zeigt main 832 Zeilen
  rot markiert (`nicht_ausgefuehrt`) — gewollt, vorher Chris ankündigen.
- **PR 2** (Image): bauen ja, **mergen erst nach Chris' Messung aus Abschnitt 4.5** (df -h/free -m).
  Unter 5GB frei oder unter 1GB RAM-Reserve → nicht mergen, erst aufräumen/vergrößern.
- **PR 3** (Vorlauf): bauen ja, **mergen erst nach Chris' Antwort zu Frage 1** (Wartezeit, Abschnitt 8)
  — das ist die einzige Frage, die das Design ändern könnte. Fragen 2+3 sind Einzeiler-Bestätigungen.
- **PR 4:** nach PR 3.
