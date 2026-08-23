import { describe, expect, it } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { buildPlayerDrawerDataFromGameState } from "@/lib/foundation/player-detail-drawer";
import { buildPlayerDisciplineRankOverride } from "@/lib/foundation/player-discipline-rank-service";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";

/**
 * GEMELDET (Chris, bug-2026-08-04T13-23-39-256Z-uzetn6, Spielerprofil ->
 * Top-Disziplinen): „...da fehlt jeweils auch der Rank das hatten wir früher
 * drin und ist super hilfreich! bitte hinzufügen" — PP-Zahlen stimmen, der
 * Saison- UND der All-Time-Rang fehlen.
 *
 * URSACHE. `buildDisciplineGlobalRankMaps` (player-detail-drawer.ts) rankt
 * über den Saison-Punkte-Ledger (braucht `matchdayResults`/`disciplineResults`
 * ALLER Spieltage) und die `seasonSnapshots` (All-Time). Der Foundation-Client
 * hält den kompakten Payload (`compactFoundationInitialGameState`), der beide
 * Quellen beschneidet bzw. entfernt — der Rang fällt dort still auf `null`.
 *
 * SEITHER: `matchdayResults` und `disciplineResults` fahren wieder vollständig
 * mit (Herleitung samt Messung in `compactFoundationInitialGameState`), also
 * rechnet der Browser den SAISON-Rang selbst richtig aus. Die `seasonSnapshots`
 * bleiben gestrichen — sie sind der Berg (3,5 MB am Live-Save) — und damit
 * bleibt der ALL-TIME-Rang ohne das Override leer. Genau deshalb existiert
 * `buildPlayerDisciplineRankOverride` weiterhin; er ist nicht wirkungslos
 * geworden wie die vier Spieltags-Projektionen.
 *
 * DER TEST FÄHRT DIE GEGENPROBE: derselbe Aufruf einmal auf dem vollen Save,
 * einmal auf `compactFoundationInitialGameState(...)`. Ohne das Override fehlt
 * der All-Time-Rang; mit dem serverseitig auf dem VOLLEN Save berechneten
 * `buildPlayerDisciplineRankOverride` stimmen beide Ränge wieder überein.
 */

function createPlayer(id: string, name: string): Player {
  return {
    id,
    name,
    rating: 70,
    marketValue: 30,
    salaryDemand: 8,
    displayMarketValue: 30,
    displaySalary: 8,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "f",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: { basketball: 43 },
    currentDisciplineValues: { basketball: 43 },
    disciplineTierCounts: { above20: 1, above40: 1, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  };
}

/**
 * Zwei Spieler, ein Kader je Team, eine gewertete Disziplin ("basketball" —
 * Saison- UND All-Time-Punkte unterscheiden sich bewusst in der Reihenfolge,
 * damit der Test nicht zufällig durch einen Kopier-Bug beide Ränge gleich
 * setzt) und eine zweite Disziplin ("archery"), in der KEINER der beiden
 * Spieler je Punkte gemacht hat (Test für "kein Rang" != "Rang unbekannt").
 *
 * Der aktive Spieltag (`matchdayState.matchdayId`) ist bewusst ein anderer als
 * der gewertete (`matchday-1`) — die Normallage aus der Meldung: der aktive
 * Spieltag ist noch in Planung, der kompakte Payload behält also GAR KEINEN
 * `matchdayResults`-Eintrag.
 */
function createGameState(player: Player, rival: Player): GameState {
  return {
    season: {
      id: "season-1",
      name: "Season 1",
      currentMatchday: 5,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"],
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      matchdayResults: [
        {
          id: "result-1",
          seasonId: "season-1",
          matchdayId: "matchday-1",
          status: "preview_applied",
        } as NonNullable<GameState["seasonState"]["matchdayResults"]>[number],
      ],
      disciplineResults: [
        {
          id: "discipline-result-low",
          matchdayResultId: "result-1",
          teamId: "team-1",
          disciplineId: "basketball",
          disciplineSide: "d1",
          rank: 20,
          baseScore: 100,
          totalScore: 100,
          readinessStatus: "ready",
          warnings: [],
          createdAt: "2026-06-06T10:00:00.000Z",
        } as NonNullable<GameState["seasonState"]["disciplineResults"]>[number],
        {
          id: "discipline-result-high",
          matchdayResultId: "result-1",
          teamId: "team-2",
          disciplineId: "basketball",
          disciplineSide: "d1",
          rank: 1,
          baseScore: 200,
          totalScore: 200,
          readinessStatus: "ready",
          warnings: [],
          createdAt: "2026-06-06T10:00:00.000Z",
        } as NonNullable<GameState["seasonState"]["disciplineResults"]>[number],
      ],
      playerDisciplinePerformances: [
        {
          id: "perf-player",
          matchdayResultId: "result-1",
          teamId: "team-1",
          playerId: player.id,
          activePlayerId: "roster-1",
          disciplineId: "basketball",
          disciplineSide: "d1",
          slotIndex: 0,
          baseValue: 43,
          finalPlayerScore: 43,
          scoreContribution: 0.9,
          rankInTeam: 1,
          rankInDiscipline: 60,
          isTop10: false,
          isMvpCandidate: false,
          storyWeight: 0.9,
          createdAt: "2026-06-06T10:00:00.000Z",
        },
        {
          id: "perf-rival",
          matchdayResultId: "result-1",
          teamId: "team-2",
          playerId: rival.id,
          activePlayerId: "roster-2",
          disciplineId: "basketball",
          disciplineSide: "d1",
          slotIndex: 0,
          baseValue: 44,
          finalPlayerScore: 44,
          scoreContribution: 0.1,
          rankInTeam: 1,
          rankInDiscipline: 1,
          isTop10: true,
          isMvpCandidate: true,
          storyWeight: 0.1,
          createdAt: "2026-06-06T10:00:00.000Z",
        },
      ] as NonNullable<GameState["seasonState"]["playerDisciplinePerformances"]>,
      // Vorsaison-Snapshot: player klar vor rival (50 vs. 5) — GEGENLÄUFIG zum
      // Saison-Rang oben (dort liegt rival vorn). Zeigt, dass Saison- und
      // All-Time-Rang zwei unabhängig berechnete Größen sind, nicht derselbe
      // Wert zweimal durchgereicht.
      seasonSnapshots: [
        {
          seasonId: "season-0",
          seasonName: "Season 0",
          archivedAt: "2025-06-06T10:00:00.000Z",
          finalStandings: [],
          playerPerformances: [
            {
              playerId: player.id,
              playerName: player.name,
              teamId: "team-1",
              teamCode: "T-1",
              teamName: "Team One",
              appearances: 4,
              totalContribution: 50,
              totalPoints: 50,
              averageContribution: 12.5,
              averageFinalScore: 44.4,
              powPoints: 0,
              spePoints: 0,
              menPoints: 0,
              socPoints: 50,
              ovr: 60,
              ovrRank: 5,
              pps: 50,
              ppsRank: 3,
              mvs: 40,
              mvsRank: 4,
              marketValue: 30,
              salary: 8,
              contractLength: 2,
              top10Count: 1,
              mvpCount: 0,
              bestDisciplineId: "basketball",
              bestDisciplineLabel: "Basketball",
              bestDisciplineScore: 50,
              disciplineBreakdown: [
                {
                  disciplineId: "basketball",
                  disciplineName: "Basketball",
                  appearances: 4,
                  totalContribution: 50,
                  averageContribution: 12.5,
                  averageFinalScore: 44.4,
                },
              ],
            },
            {
              playerId: rival.id,
              playerName: rival.name,
              teamId: "team-2",
              teamCode: "T-2",
              teamName: "Team Two",
              appearances: 4,
              totalContribution: 5,
              totalPoints: 5,
              averageContribution: 1.25,
              averageFinalScore: 20,
              powPoints: 0,
              spePoints: 0,
              menPoints: 0,
              socPoints: 5,
              ovr: 55,
              ovrRank: 8,
              pps: 5,
              ppsRank: 9,
              mvs: 20,
              mvsRank: 9,
              marketValue: 30,
              salary: 8,
              contractLength: 2,
              top10Count: 0,
              mvpCount: 0,
              bestDisciplineId: "basketball",
              bestDisciplineLabel: "Basketball",
              bestDisciplineScore: 5,
              disciplineBreakdown: [
                {
                  disciplineId: "basketball",
                  disciplineName: "Basketball",
                  appearances: 4,
                  totalContribution: 5,
                  averageContribution: 1.25,
                  averageFinalScore: 20,
                },
              ],
            },
          ],
          transferSnapshots: [],
        },
      ] as unknown as NonNullable<GameState["seasonState"]["seasonSnapshots"]>,
    } as unknown as GameState["seasonState"],
    matchdayState: {
      matchdayId: "md-5",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [
      { teamId: "team-1", id: "team-1", name: "Team One", shortCode: "T-1", cash: 100, budget: 100 } as unknown as GameState["teams"][number],
      { teamId: "team-2", id: "team-2", name: "Team Two", shortCode: "T-2", cash: 100, budget: 100 } as unknown as GameState["teams"][number],
    ],
    teamIdentities: [],
    players: [player, rival],
    disciplines: [
      { id: "basketball", name: "Basketball", category: "social", displayOrder: 1, playerCount: 6 } as GameState["disciplines"][number],
      // Keiner der beiden Spieler hat hier je Punkte gemacht -> "kein Rang".
      { id: "archery", name: "Archery", category: "power", displayOrder: 2, playerCount: 6 } as GameState["disciplines"][number],
    ],
    rosters: [
      { id: "roster-1", playerId: player.id, teamId: "team-1", salary: 8, contractLength: 2 } as GameState["rosters"][number],
      { id: "roster-2", playerId: rival.id, teamId: "team-2", salary: 8, contractLength: 2 } as GameState["rosters"][number],
    ],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-06T10:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 2,
      matchedRosterCount: 2,
      warnings: [],
    } as unknown as GameState["mappingReport"],
  } as unknown as GameState;
}

describe("player detail drawer discipline rank override (bug-2026-08-04T13-23-39-256Z-uzetn6)", () => {
  it("full save: season- and all-time rank are both present and NOT identical (two distinct rankings)", () => {
    const player = createPlayer("player-gronn", "Gronn");
    const rival = createPlayer("player-rival", "Rival");
    const fullGameState = createGameState(player, rival);

    const data = buildPlayerDrawerDataFromGameState({ gameState: fullGameState, playerId: player.id, source: "sqlite" });
    const basketball = data?.disciplineValues.find((entry) => entry.id === "basketball");

    // Saison: rival liegt vorn (mehr resolved rank-points aus disciplineResults) -> player Rang 2.
    expect(basketball?.seasonPointsRank).toBe(2);
    // All-Time: player liegt vorn (Vorsaison-Snapshot 50 vs. 5) -> player Rang 1.
    expect(basketball?.allTimePointsRank).toBe(1);
    expect(basketball?.seasonPointsRank).not.toBe(basketball?.allTimePointsRank);
  });

  it("compact payload WITHOUT override: the season rank comes out by itself, the all-time rank silently becomes the season rank", () => {
    const player = createPlayer("player-gronn", "Gronn");
    const rival = createPlayer("player-rival", "Rival");
    const fullGameState = createGameState(player, rival);
    const compactGameState = compactFoundationInitialGameState(fullGameState);

    /**
     * FRUEHER STAND HIER: `matchdayResults` toHaveLength(0) und BEIDE Ränge `null` — der
     * kompakte Payload hatte nichts mehr zu ranken, beide Felder blieben sichtbar leer.
     *
     * Die eine Hälfte gilt nicht mehr: die Spieltags-Quellen fahren vollständig mit, also
     * rankt der Saison-Ledger im Browser wieder und liefert dieselbe 2 wie der volle Save.
     *
     * BEFUND, DER FESTGEHALTEN GEHÖRT: die andere Hälfte ist dadurch von „leer" auf „falsch"
     * gekippt. `buildDisciplineGlobalRankMaps` mischt den laufenden Saison-Ledger in die
     * All-Time-Summen, sobald KEIN Schnappschuss der laufenden Saison da ist
     * (player-detail-drawer.ts, `if (!hasCurrentSeasonSnapshot)`). Die `seasonSnapshots`
     * bleiben gestrichen — der Berg, 3,5 MB am Live-Save —, also besteht die All-Time-Summe
     * im Browser NUR aus der laufenden Saison: der All-Time-Rang ist eine Kopie des
     * Saison-Rangs (2) statt der Wahrheit aus dem Vorsaison-Schnappschuss (1).
     *
     * Sichtbar wird das heute nirgends: die einzige Stelle, die `allTimePointsRank` rendert
     * (PlayerDetailDrawer.tsx, Spalte "allTimePps"), bekommt ihre Daten ausschließlich über
     * `buildHydratedPlayerDrawerData`, und der hängt das serverseitige Override immer an —
     * siehe den Fall darunter. Der Rang ohne Override ist damit eine latente Falle, kein
     * gemeldeter Fehler. Genau deshalb ist dieses Override NICHT wirkungslos geworden wie
     * die vier Spieltags-Projektionen, und genau deshalb steht die falsche Zahl hier
     * ausgeschrieben statt weggelassen: wer sie kleiner macht, merkt es.
     */
    expect(compactGameState.seasonState.matchdayResults ?? []).toHaveLength(1);
    expect(compactGameState.seasonState.seasonSnapshots).toBeUndefined();

    const data = buildPlayerDrawerDataFromGameState({ gameState: compactGameState, playerId: player.id, source: "sqlite" });
    const basketball = data?.disciplineValues.find((entry) => entry.id === "basketball");

    // Saison-Rang: aus eigener Kraft richtig, deckungsgleich mit dem vollen Save.
    expect(basketball?.seasonPointsRank).toBe(2);
    // All-Time-Rang: NICHT die Wahrheit (dort steht 1), sondern die Kopie des Saison-Rangs.
    expect(basketball?.allTimePointsRank).toBe(2);
    const voll = buildPlayerDrawerDataFromGameState({ gameState: fullGameState, playerId: player.id, source: "sqlite" });
    expect(voll?.disciplineValues.find((entry) => entry.id === "basketball")?.allTimePointsRank).toBe(1);
  });

  it("compact payload WITH the server-computed override: both ranks match the full-save result exactly", () => {
    const player = createPlayer("player-gronn", "Gronn");
    const rival = createPlayer("player-rival", "Rival");
    const fullGameState = createGameState(player, rival);
    const compactGameState = compactFoundationInitialGameState(fullGameState);

    const fullData = buildPlayerDrawerDataFromGameState({ gameState: fullGameState, playerId: player.id, source: "sqlite" });
    const fullBasketball = fullData?.disciplineValues.find((entry) => entry.id === "basketball");

    // Wie auf dem Server: das Override wird auf dem VOLLEN Save gerechnet (die
    // API-Route läädt `save.gameState` aus der Persistenz, nie den kompakten
    // Client-Payload).
    const override = buildPlayerDisciplineRankOverride({
      gameState: fullGameState,
      playerId: player.id,
      saveId: "save-discipline-rank-override",
    });

    const overriddenData = buildPlayerDrawerDataFromGameState({
      gameState: compactGameState,
      playerId: player.id,
      source: "sqlite",
      disciplineRankOverride: override,
    });
    const overriddenBasketball = overriddenData?.disciplineValues.find((entry) => entry.id === "basketball");

    expect(overriddenBasketball?.seasonPointsRank).toBe(fullBasketball?.seasonPointsRank);
    expect(overriddenBasketball?.allTimePointsRank).toBe(fullBasketball?.allTimePointsRank);
    expect(overriddenBasketball?.seasonPointsRank).toBe(2);
    expect(overriddenBasketball?.allTimePointsRank).toBe(1);
  });

  it('"kein Rang" bleibt "kein Rang": eine Disziplin ohne jede Punktzahl bekommt auch MIT Override keinen Rang (nicht 0, nicht geraten)', () => {
    const player = createPlayer("player-gronn", "Gronn");
    const rival = createPlayer("player-rival", "Rival");
    const fullGameState = createGameState(player, rival);
    const compactGameState = compactFoundationInitialGameState(fullGameState);

    const override = buildPlayerDisciplineRankOverride({
      gameState: fullGameState,
      playerId: player.id,
      saveId: "save-discipline-rank-override",
    });

    expect(override.seasonPointsRankByDisciplineId.archery).toBeUndefined();
    expect(override.allTimePointsRankByDisciplineId.archery).toBeUndefined();

    const overriddenData = buildPlayerDrawerDataFromGameState({
      gameState: compactGameState,
      playerId: player.id,
      source: "sqlite",
      disciplineRankOverride: override,
    });
    const archery = overriddenData?.disciplineValues.find((entry) => entry.id === "archery");

    expect(archery?.seasonPointsRank).toBeNull();
    expect(archery?.allTimePointsRank).toBeNull();
  });
});

/**
 * DIESELBE PAYLOAD-LUECKE, EINE SPALTE WEITER: NICHT NUR DER RANG FEHLT, DIE ZAHL AUCH.
 *
 * GEMELDET VON CHRIS (`l4835p`, „Team · Spieler", Spielstand `hwz8fk`): „in den Top Disziplinen
 * sieht man nur die aktuelle Season in die Punkte eingepreist! All Time fehlt komplett! bitte fixen"
 *
 * DIE ZAHLEN SIND LAENGST ARCHIVIERT — und das ist die Korrektur an meiner eigenen Triage-Notiz,
 * die behauptete, PP je Disziplin wuerden „nirgends gespeichert". `season-snapshot-service.ts`
 * schreibt je Spieler und Disziplin `totalContribution`, und dieses Feld traegt trotz seines Namens
 * bereits den PP-Wert aus dem Saison-Punkte-Ledger:
 *
 *   const normalizedPoints = seasonPointsLedger.pointEntriesByPerformanceId.get(entry.id)?.points
 *                            ?? entry.scoreContribution;
 *   breakdown.totalContribution += normalizedPoints;
 *
 * Am Abbild `hwz8fk` nachgerechnet: die Breakdown-Summe trifft `totalPoints` bei 339 von 339
 * Zeilen, groesste Abweichung 0,2 (Rundung), Einsatzzahlen bei allen exakt gleich. Ich hatte vom
 * FELDNAMEN auf den Inhalt geschlossen, statt die Zuweisung zu lesen.
 *
 * WEG IST DIE ZAHL NUR IM BROWSER. `foundation-season-history-projection.ts` faltet die Archiv-
 * Saisons fuer den Client zusammen und laesst `disciplineBreakdown` dabei AUSDRUECKLICH weg
 * (647 KiB gegen 88 KiB je Saison). Gemessen: der Ersatz-Schnappschuss traegt alle 339
 * Spielerzeilen, aber keine einzige Disziplin-Zeile. Madrots All-Time steht auf dem vollen Save
 * bei TDM 1,8 / Mini DM 1,3 / Wettessen 0,7 — im Browser bei nichts.
 *
 * Deshalb faehrt die Zahl jetzt denselben Weg wie ihr Rang: serverseitig auf dem vollen Save
 * gerechnet, nur fuer den angezeigten Spieler. Kein Schnappschuss wird umgeschrieben, und
 * bestehende Spielstaende zeigen die Werte sofort — Chris' Saison 1 eingeschlossen.
 */
describe("All-Time-PPs je Disziplin ueberleben den kompakten Payload (l4835p)", () => {
  function baue() {
    const player = createPlayer("player-gronn", "Gronn");
    const rival = createPlayer("player-rival", "Rival");
    const fullGameState = createGameState(player, rival);
    return {
      player,
      fullGameState,
      compactGameState: compactFoundationInitialGameState(fullGameState),
    };
  }

  it("der Server-Override traegt Archiv UND laufende Saison — nicht nur das Archiv", () => {
    const { player, fullGameState } = baue();
    const override = buildPlayerDisciplineRankOverride({
      gameState: fullGameState,
      playerId: player.id,
      saveId: "save-discipline-rank-override",
    });

    /**
     * 53,7 = 50 aus dem Vorsaison-Schnappschuss PLUS 3,7 aus der laufenden Saison. Letztere zaehlt
     * mit, solange fuer sie noch kein Schnappschuss existiert — genau die Regel, die auch die
     * Ansicht anwendet.
     *
     * Diese Zahl hat einen ersten Entwurf des Overrides widerlegt, der nur ueber die
     * Schnappschuesse summierte und deshalb bei 50 stehen blieb. Sie steht hier ausgeschrieben,
     * damit derselbe Fehler nicht unbemerkt zurueckkommt.
     */
    expect(override.allTimePointsByDisciplineId.basketball).toBe(53.7);
    expect(override.allTimeAppearancesByDisciplineId.basketball).toBe(5);

    const voll = buildPlayerDrawerDataFromGameState({ gameState: fullGameState, playerId: player.id, source: "sqlite" });
    const vollZeile = voll?.disciplineValues.find((entry) => entry.id === "basketball");
    expect(override.allTimePointsByDisciplineId.basketball).toBe(vollZeile?.allTimePoints);
    expect(override.allTimeAppearancesByDisciplineId.basketball).toBe(vollZeile?.allTimeAppearances);
  });

  it("ohne Override verliert der kompakte Payload die archivierten Punkte", () => {
    // Der gemeldete Zustand. Die `seasonSnapshots` sind gestrichen (der Berg), also besteht die
    // All-Time-Summe im Browser nur noch aus der laufenden Saison.
    const { player, fullGameState, compactGameState } = baue();
    const voll = buildPlayerDrawerDataFromGameState({ gameState: fullGameState, playerId: player.id, source: "sqlite" });
    const ohne = buildPlayerDrawerDataFromGameState({ gameState: compactGameState, playerId: player.id, source: "sqlite" });

    const vollWert = voll?.disciplineValues.find((entry) => entry.id === "basketball")?.allTimePoints ?? null;
    const ohneWert = ohne?.disciplineValues.find((entry) => entry.id === "basketball")?.allTimePoints ?? null;

    expect(vollWert).not.toBeNull();
    expect(ohneWert).not.toBe(vollWert);
    expect(vollWert ?? 0).toBeGreaterThan(ohneWert ?? 0);
  });

  it("MIT Override stimmt der kompakte Payload wieder mit dem vollen Save ueberein", () => {
    const { player, fullGameState, compactGameState } = baue();
    const override = buildPlayerDisciplineRankOverride({
      gameState: fullGameState,
      playerId: player.id,
      saveId: "save-discipline-rank-override",
    });

    const voll = buildPlayerDrawerDataFromGameState({ gameState: fullGameState, playerId: player.id, source: "sqlite" });
    const mit = buildPlayerDrawerDataFromGameState({
      gameState: compactGameState,
      playerId: player.id,
      source: "sqlite",
      disciplineRankOverride: override,
    });

    const vollZeile = voll?.disciplineValues.find((entry) => entry.id === "basketball");
    const mitZeile = mit?.disciplineValues.find((entry) => entry.id === "basketball");

    expect(mitZeile?.allTimePoints).toBe(vollZeile?.allTimePoints);
    expect(mitZeile?.allTimeAppearances).toBe(vollZeile?.allTimeAppearances);
  });

  it("keine Punkte bleibt keine Punkte — der Override erfindet keine 0", () => {
    // Dieselbe Regel wie beim Rang: eine fehlende Disziplin-ID heisst „nie gepunktet".
    const { player, fullGameState, compactGameState } = baue();
    const override = buildPlayerDisciplineRankOverride({
      gameState: fullGameState,
      playerId: player.id,
      saveId: "save-discipline-rank-override",
    });

    expect(override.allTimePointsByDisciplineId.archery).toBeUndefined();

    const mit = buildPlayerDrawerDataFromGameState({
      gameState: compactGameState,
      playerId: player.id,
      source: "sqlite",
      disciplineRankOverride: override,
    });
    const archery = mit?.disciplineValues.find((entry) => entry.id === "archery");
    expect(archery?.allTimePoints).toBeNull();
    expect(archery?.allTimeAppearances).toBeNull();
  });
});
