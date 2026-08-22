/**
 * SAISON-SPOTLIGHT (`5hcq2p`) — die vier Entwurfsentscheidungen, festgenagelt.
 *
 * Chris' Wunsch, woertlich: „es müsste irgendwie noch mehr eigene team highlights geben wenn man
 * in die neue season kommt, dass man irgendwo sehen kann wie sich das trainnig entwickelt hat,
 * dass man sieht ob spieler ihre klasse gewechselt haben, welche spieler sich in stats und in MW
 * verbessert haben usw - da müsste man mal so ein spotlight designen"
 *
 * Der Entwurf stammt von Fable und wurde von Chris so freigegeben. Die Faelle hier halten fest,
 * was daran ABSICHT ist — vor allem die zwei Stellen, an denen der Block bewusst WENIGER zeigt,
 * als technisch moeglich waere:
 *
 *   - Verkaufte Spieler fallen heraus, auch wenn sie den groessten Zuwachs hatten.
 *   - Ohne Vorsaison erscheint der Block gar nicht, statt mit leeren Kacheln dazustehen.
 *
 * Die Zahlen der Fixtures sind die echten aus `swnjlk` (Team V-W, Saison 1 -> 2), damit der Test
 * gegen einen gemessenen Stand prueft und nicht gegen eine Wunschvorstellung.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildSaisonSpotlight, SPOTLIGHT_MAX_ROWS } from "@/lib/foundation/saison-spotlight";

type Ereignis = {
  playerId: string;
  net: number;
  klasseVor: string;
  klasseNach: string;
  modus: "leicht" | "mittel" | "hart";
  teamId?: string;
};

function ereignis(eingabe: Ereignis) {
  return {
    eventId: `evt-${eingabe.playerId}`,
    seasonId: "season-1",
    teamId: eingabe.teamId ?? "V-W",
    playerId: eingabe.playerId,
    xpSpent: 0,
    timestamp: "2026-08-21T14:09:28.000Z",
    source: "organic_season_progression" as const,
    upgrades: [
      { playerId: eingabe.playerId, attribute: "power", fromValue: 2, toValue: 3.2, cost: 0, source: "organic_season_progression" as const },
      { playerId: eingabe.playerId, attribute: "torment", fromValue: 11, toValue: 11.4, cost: 0, source: "organic_season_progression" as const },
    ],
    organicMeta: {
      trainingClass: "Bard",
      trainingMode: eingabe.modus,
      classBefore: eingabe.klasseVor,
      classAfter: eingabe.klasseNach,
      netSetpoints: eingabe.net,
      trainingSetpoints: eingabe.net,
      performanceSetpoints: 0,
    },
  };
}

function leistung(playerId: string, playerName: string, von: number, nach: number, einsaetze: number) {
  return {
    playerId,
    playerName,
    teamId: "V-W",
    teamCode: "V-W",
    teamName: "Vigilante Wranglers",
    seasonId: "season-1",
    appearances: einsaetze,
    totalContribution: null,
    averageContribution: null,
    averageFinalScore: null,
    purchasePrice: von,
    marketValue: nach,
  };
}

/**
 * Der echte Zuschnitt aus `swnjlk`: neun Spieler wurden Saison 1 trainiert, vier davon stehen
 * jetzt noch im Kader. Der GROESSTE Zuwachs der Saison (XR-KAROT-01, +5,0, Tank -> Berserker)
 * gehoert zu einem verkauften Spieler — er ist hier absichtlich dabei, damit der Test beweist,
 * dass er NICHT auftaucht.
 */
function spielstand(): GameState {
  const imKader = ["lulu", "arlen", "jorund", "xelara"];
  const verkauft = ["karot", "scorpion", "evie", "midorina", "patience"];
  return {
    season: { id: "season-2", name: "Saison 2", currentMatchday: 1, matchdayIds: ["md-1"] },
    matchdayState: { matchdayId: "md-1", status: "planning" },
    teams: [
      { teamId: "V-W", shortCode: "V-W", name: "Vigilante Wranglers" },
      { teamId: "P-C", shortCode: "P-C", name: "Pirate Crew" },
    ],
    players: [
      { id: "lulu", name: "Lulu", marketValue: 9.91 },
      { id: "arlen", name: "King Arlen Morgolor", marketValue: 22.25 },
      { id: "jorund", name: "Jorund", marketValue: 22.18 },
      { id: "xelara", name: "Xelara", marketValue: 25.5 },
      { id: "karot", name: "XR-KAROT-01", marketValue: 17.74 },
      { id: "scorpion", name: "Scorpion King", marketValue: 16.96 },
      { id: "evie", name: "Evie", marketValue: 26.71 },
      { id: "midorina", name: "Midorina", marketValue: 9.37 },
      { id: "patience", name: "Patience", marketValue: 9.8 },
      { id: "draco", name: "Draco", className: "Warlord", marketValue: 32.06 },
      { id: "krolach", name: "Krolach", className: "Templar", marketValue: 30.25 },
      { id: "broxingar", name: "Broxingar", marketValue: 40 },
    ],
    rosters: [...imKader, "draco", "krolach"].map((playerId) => ({ teamId: "V-W", playerId })),
    playerProgressionEvents: [
      ereignis({ playerId: "lulu", net: 1.6, klasseVor: "Tactician", klasseNach: "Bard", modus: "leicht" }),
      ereignis({ playerId: "arlen", net: 1.4, klasseVor: "Hero", klasseNach: "Hero", modus: "leicht" }),
      ereignis({ playerId: "jorund", net: 1.1, klasseVor: "Bard", klasseNach: "Bard", modus: "leicht" }),
      ereignis({ playerId: "xelara", net: 0.6, klasseVor: "Bard", klasseNach: "Bard", modus: "leicht" }),
      ereignis({ playerId: "karot", net: 5, klasseVor: "Tank", klasseNach: "Berserker", modus: "leicht" }),
      ...verkauft
        .slice(1)
        .map((playerId, index) =>
          ereignis({ playerId, net: 3.3 - index, klasseVor: "Tank", klasseNach: "Tank", modus: "leicht" }),
        ),
      ereignis({ playerId: "broxingar", net: 10.5, klasseVor: "Bard", klasseNach: "Bard", modus: "hart", teamId: "P-C" }),
    ],
    seasonState: {
      seasonId: "season-2",
      seasonSnapshots: [
        {
          seasonId: "season-1",
          seasonName: "Saison 1",
          teamSnapshots: [
            { teamId: "V-W", teamCode: "V-W", teamName: "Vigilante Wranglers", rank: 25, points: 79.3, startplatz: 30, rankDiff: 5 },
            { teamId: "P-C", teamCode: "P-C", teamName: "Pirate Crew", rank: 4, points: 120 },
          ],
          finalStandings: [
            { teamId: "V-W", teamCode: "V-W", teamName: "Vigilante Wranglers", rank: 25, points: 79.3 },
          ],
          playerPerformances: [
            leistung("lulu", "Lulu", 9.84, 9.91, 8),
            leistung("arlen", "King Arlen Morgolor", 22.02, 22.25, 9),
            leistung("jorund", "Jorund", 22.08, 22.18, 9),
            leistung("xelara", "Xelara", 25.26, 25.5, 8),
            leistung("karot", "XR-KAROT-01", 17.5, 17.74, 8),
          ],
        },
      ],
    },
  } as unknown as GameState;
}

describe("Saison-Spotlight", () => {
  it("zeigt die vier Kader-Spieler mit den gemessenen Zahlen aus swnjlk", () => {
    const modell = buildSaisonSpotlight({ gameState: spielstand(), teamId: "V-W" })!;
    expect(modell).not.toBeNull();
    expect(modell.rows.map((zeile) => [zeile.playerName, zeile.netSetpoints])).toEqual([
      ["Lulu", 1.6],
      ["King Arlen Morgolor", 1.4],
      ["Jorund", 1.1],
      ["Xelara", 0.6],
    ]);
    expect(modell.netSetpointsTotal).toBe(4.7);
    expect(modell.classChangeCount).toBe(1);
    // 0,07 + 0,23 + 0,10 + 0,24
    expect(modell.marketValueGain).toBe(0.64);
    expect(modell.rank).toBe(25);
    expect(modell.teamCount).toBe(2);
    expect(modell.startRank).toBe(30);
    expect(modell.rankDelta).toBe(5);
    expect(modell.seasonLabelFrom).toContain("1");
    expect(modell.seasonLabelTo).toContain("2");
  });

  it("laesst verkaufte Spieler heraus — auch den groessten Zuwachs der Saison", () => {
    const modell = buildSaisonSpotlight({ gameState: spielstand(), teamId: "V-W" })!;
    const namen = modell.rows.map((zeile) => zeile.playerName);
    // XR-KAROT-01 hatte +5,0 und einen Klassenwechsel — mehr als jeder Kader-Spieler.
    expect(namen).not.toContain("XR-KAROT-01");
    expect(modell.netSetpointsTotal).toBeLessThan(5);
    expect(modell.classChangeCount).toBe(1);
  });

  it("nennt den besten Trainierer der Liga, auch wenn er in einem fremden Team steht", () => {
    const modell = buildSaisonSpotlight({ gameState: spielstand(), teamId: "V-W" })!;
    expect(modell.leagueBestTrainer).toEqual({
      playerName: "Broxingar",
      teamName: "Pirate Crew",
      netSetpoints: 10.5,
    });
    // Vier Klassenwechsel im Fixture: Lulu, XR-KAROT-01 und die zwei Kader-losen ... nur die
    // echten zaehlen, nicht die gleichbleibenden.
    expect(modell.leagueClassChangeCount).toBe(2);
  });

  it("fuehrt Neuzugaenge getrennt, ohne ihnen ein Trainings-Delta anzudichten", () => {
    const modell = buildSaisonSpotlight({ gameState: spielstand(), teamId: "V-W" })!;
    expect(modell.newcomers.map((neu) => neu.playerName)).toEqual(["Draco", "Krolach"]);
    expect(modell.rows.some((zeile) => zeile.playerName === "Draco")).toBe(false);
  });

  it("beschriftet das beste Attribut mit dem groessten Zuwachs, nicht mit dem ersten", () => {
    const modell = buildSaisonSpotlight({ gameState: spielstand(), teamId: "V-W" })!;
    // power +1,2 schlaegt torment +0,4 — die Reihenfolge im Array ist dieselbe.
    expect(modell.rows[0]?.bestAttribute).toMatchObject({ attribute: "power", label: "STR", fromValue: 2, toValue: 3.2 });
  });

  it("erscheint gar nicht, wenn es keine abgeschlossene Vorsaison gibt", () => {
    const ohne = spielstand();
    (ohne.seasonState as unknown as { seasonSnapshots: unknown[] }).seasonSnapshots = [];
    expect(buildSaisonSpotlight({ gameState: ohne, teamId: "V-W" })).toBeNull();
  });

  it("erscheint gar nicht fuer ein Team ohne Kader", () => {
    expect(buildSaisonSpotlight({ gameState: spielstand(), teamId: "P-C" })).toBeNull();
  });

  it("kappt die Tabelle bei fuenf Zeilen und zaehlt den Rest, statt ihn zu verschweigen", () => {
    const viele = spielstand();
    // Alle neun trainierten Spieler in den Kader holen — so sieht `hwz8fk` aus (zwoelf Zeilen).
    (viele as unknown as { rosters: Array<{ teamId: string; playerId: string }> }).rosters = [
      "lulu", "arlen", "jorund", "xelara", "karot", "scorpion", "evie", "midorina", "patience",
    ].map((playerId) => ({ teamId: "V-W", playerId }));
    const modell = buildSaisonSpotlight({ gameState: viele, teamId: "V-W" })!;
    expect(modell.rows).toHaveLength(SPOTLIGHT_MAX_ROWS);
    expect(modell.moreRowCount).toBe(4);
    // Jetzt IST der Verkaufte im Kader — und steht ganz oben.
    expect(modell.rows[0]?.playerName).toBe("XR-KAROT-01");
    // Die Kachel summiert alle neun, nicht nur die fuenf gezeigten.
    expect(modell.netSetpointsTotal).toBeGreaterThan(
      modell.rows.reduce((summe, zeile) => summe + zeile.netSetpoints, 0),
    );
  });

  it("laesst den Marktwert-Zuwachs leer, wenn kein Spieler beide Enden traegt", () => {
    const ohneLeistung = spielstand();
    (
      (ohneLeistung.seasonState as unknown as { seasonSnapshots: Array<{ playerPerformances: unknown[] }> })
        .seasonSnapshots[0] as { playerPerformances: unknown[] }
    ).playerPerformances = [];
    const modell = buildSaisonSpotlight({ gameState: ohneLeistung, teamId: "V-W" })!;
    expect(modell.marketValueGain).toBeNull();
    // Die SP-Kachel bleibt trotzdem echt — sie haengt nicht am Snapshot.
    expect(modell.netSetpointsTotal).toBe(4.7);
    expect(modell.rows[0]?.appearances).toBeNull();
  });
});
