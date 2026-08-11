/**
 * DIE MELDUNGEN ZUR ABGESCHLOSSENEN SAISON MUESSEN AUCH IM BROWSER ENTSTEHEN.
 *
 * GEMELDET/NACHGEMESSEN am Live-Abbild (Save `new-game-1785823388048-1hf25q`, Saison 2,
 * Spieltag 10, eine archivierte Saison): der Server baute 261 Inbox-Karten, der Browser 224. Es
 * fehlten genau die Karten aus dem Saisonarchiv — eine `champion_news` und 36
 * `story:season_recap`.
 *
 * BEFUND, zweimal dieselbe Bauart:
 *
 *  1. `game-inbox-service` und `season-recap-service` lasen `seasonState.seasonSnapshots ?? []`
 *     DIREKT. Im Browser steht dort hinter dem Sentinel immer `[]` — nicht nullish, also griff
 *     `?? []` nicht, und beide Rechnungen liefen garantiert leer. Nachgeladen wird das volle
 *     Archiv nur in ausgewaehlten Ansichten (`use-season-archive-load`); die Inbox sitzt auf
 *     Home/Cockpit und gehoert nicht dazu.
 *  2. Die mitgefahrene Kurzfassung `foundationSeasonHistory` haette allein nicht gereicht: sie
 *     trug weder `archivedAt` (der Rueckblick steigt bei `!snapshot.archivedAt` aus, und `""` ist
 *     falsy) noch `startplatz`/`rankDiff`/`transferNet` (Zeugnis-Text und die Karte „Kletterer &
 *     Absturz").
 *
 * DIESER TEST PRUEFT WERTE — die Titel und Texte der Karten, nicht ihre Anzahl allein, und er
 * faehrt den echten Weg voll -> compact -> Sentinel.
 *
 * GEGENPROBE (ausgefuehrt): beide Lesestellen auf `seasonSnapshots ?? []` zurueckgesetzt -> beide
 * Faelle rot (Browser: keine Champion-Karte, kein Rueckblick). `archivedAt` aus der Projektion
 * genommen -> der Rueckblick wird rot. `startplatz`/`rankDiff`/`transferNet` herausgenommen ->
 * der Zeugnis-Text und die Kletterer-Karte werden rot.
 */
import { describe, expect, it } from "vitest";

import type { GameState, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { withCompactSeasonArchiveSentinel } from "@/lib/foundation/apply-compact-season-archive-sentinel";
import { buildSeasonRecap } from "@/lib/foundation/season-recap-service";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";

const ARCHIVIERT_AM = "2026-08-08T06:05:19.451Z";

function mitAbgeschlossenerVorsaison(): GameState {
  const basis = createSingleplayerGameState();
  const teams = basis.teams.slice(0, 8);
  const snapshot = {
    snapshotId: "season-snapshot__season-0",
    seasonId: "season-0",
    seasonName: "Season 0",
    createdAt: ARCHIVIERT_AM,
    archivedAt: ARCHIVIERT_AM,
    source: "local",
    status: "completed",
    sourceStatus: "mapped",
    finalStandings: teams.map((team, index) => ({
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      rank: index + 1,
      points: 200 - index,
      cashEnd: 90 + index,
      cashTotal: 90 + index,
      marketValueTotalEnd: 500 - index,
      marketValueEnd: 500 - index,
      // Die drei Zahlen des Rueckblicks: Team 0 kommt von Platz 6 auf 1 (+5),
      // Team 1 faellt von Platz 1 auf 2 (−1).
      startplatz: index === 0 ? 6 : index === 1 ? 1 : index + 1,
      rankDiff: index === 0 ? 5 : index === 1 ? -1 : 0,
      transferNet: index === 0 ? -149.7 : 0,
    })),
    teamSnapshots: [],
    matchdayResults: [],
    disciplineResults: [],
    playerDisciplinePerformances: [],
    disciplineHighlights: [],
    playerPerformances: [],
    playerPerformanceSnapshots: [],
    transferSnapshots: [],
    warnings: [],
  } as unknown as SeasonSnapshotRecord;

  return {
    ...basis,
    // Der Rueckblick zeigt nur eine ABGESCHLOSSENE Saison, nie die laufende.
    season: { ...basis.season, id: "season-1" },
    seasonState: { ...basis.seasonState, seasonSnapshots: [snapshot] },
  };
}

/** Genau das, was im Browser ankommt: kompakter Payload plus Sentinel, ueber die Leitung serialisiert. */
function wieImBrowser(voll: GameState): GameState {
  return withCompactSeasonArchiveSentinel(
    JSON.parse(JSON.stringify(compactFoundationInitialGameState(voll))) as GameState,
  );
}

describe("Saisonarchiv im Postfach", () => {
  it("der Browser hat die vollen Schnappschuesse NICHT — nur die Kurzfassung", () => {
    const browser = wieImBrowser(mitAbgeschlossenerVorsaison());
    expect(browser.seasonState.seasonSnapshots).toEqual([]);
    const historie = browser.seasonState.foundationSeasonHistory ?? [];
    expect(historie).toHaveLength(1);
    // Genau die vier Felder, an denen die Karten unten haengen.
    expect(historie[0]?.archivedAt).toBe(ARCHIVIERT_AM);
    expect(historie[0]?.teams[0]).toMatchObject({ startplatz: 6, rankDiff: 5, transferNet: -149.7 });
  });

  it("der Saison-Rueckblick entsteht im Browser mit denselben Texten wie auf dem Server", () => {
    const voll = mitAbgeschlossenerVorsaison();
    const eigenes = new Set([voll.teams[0]!.teamId]);

    const server = buildSeasonRecap({ gameState: voll, eigeneTeamIds: eigenes });
    const browser = buildSeasonRecap({ gameState: wieImBrowser(voll), eigeneTeamIds: eigenes });

    // Ausgeschriebene Werte, nicht nur „beide gleich": ein Test, der nur Gleichheit prueft,
    // winkt „beide gleich leer" durch.
    expect(server?.seasonId).toBe("season-0");
    expect(server?.archivedAt).toBe(ARCHIVIERT_AM);
    const zeugnis = server?.entries.find((entry) => entry.slot === "zeugnis");
    expect(zeugnis?.title).toBe("Dein Saison-Zeugnis: Platz 1");
    expect(zeugnis?.description).toContain("Start als Nummer 6");
    expect(zeugnis?.description).toContain("5 Plätze gutgemacht");
    expect(zeugnis?.description).toContain("-149,7");
    // Die Liga-Karte, die AUSSCHLIESSLICH aus `rankDiff` entsteht.
    expect(server?.entries.map((entry) => entry.slot)).toContain("kletterer");

    expect(browser).toEqual(server);
  });

  it("die Champion-Karte entsteht im Browser", async () => {
    const { buildGameInboxItems } = await import("@/lib/foundation/game-inbox-service");
    const { buildGameFlowState } = await import("@/lib/foundation/game-flow-controller");
    const voll = mitAbgeschlossenerVorsaison();
    const teamId = voll.teams[0]!.teamId;

    const karten = (gameState: GameState) => {
      const gameFlowState = buildGameFlowState({
        gameState,
        activeTeamId: teamId,
        activeOwnerId: "user_local",
      } as never);
      return buildGameInboxItems({
        gameState,
        saveId: "save-1",
        activeTeamId: teamId,
        activeOwnerId: "user_local",
        hostMode: false,
        gameFlowState,
        now: "2026-08-11T20:00:00.000Z",
      } as never);
    };

    const champion = (gameState: GameState) =>
      karten(gameState).find((item) => item.source === "season_snapshots") ?? null;

    const serverKarte = champion(voll);
    expect(serverKarte?.title).toBe("Champion gekürt");
    expect(serverKarte?.description).toContain(voll.teams[0]!.name);
    // Datiert auf den Archivierungszeitpunkt, nicht auf „jetzt" — sonst schiebt sich die Karte
    // bei jedem Inbox-Aufbau nach oben.
    expect(serverKarte?.createdAt).toBe(ARCHIVIERT_AM);

    expect(champion(wieImBrowser(voll))).toEqual(serverKarte);
  });
});
