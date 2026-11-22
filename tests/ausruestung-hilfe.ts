/**
 * Gemeinsame Spielstand-Attrappe fuer die Ausruestungs-Tests (22.11., Phase 1a). Kein Test selbst.
 * Vier Teams: "T-H1" (Mensch, Chris = user_local), "T-H2" (Mensch, Ramona), "T-K1" und "T-K2" (KI). Zwei Spieltage, Battle-Modus.
 */
import type { DisciplineResultRecord, GameState, TeamControlSettings } from "@/lib/data/olyDataTypes";

export const IDS = ["s1-md-1", "s1-md-2", "s1-md-3", "s1-md-4"];

export function team(teamId: string, humanControlled: boolean) {
  return { teamId, shortCode: teamId, name: teamId, budget: 100, cash: 100, identityId: teamId, humanControlled, rosterLimit: 14 };
}

export function kontrolle(teamId: string, controlMode: "manual" | "ai", ownerId: string, delegation?: TeamControlSettings["delegation"]): TeamControlSettings {
  return {
    teamId,
    controlMode,
    ownerId,
    ownerSlot: ownerId,
    displayLabel: teamId,
    aiLineupPreviewEnabled: false,
    aiLineupAutoApplyEnabled: false,
    aiTransferPreviewEnabled: false,
    aiTransferAutoApplyEnabled: false,
    aiSellPreviewEnabled: false,
    aiSellAutoApplyEnabled: false,
    ...(delegation !== undefined ? { delegation } : {}),
  } as TeamControlSettings;
}

export function spielstand(opts: { gebucht?: string[]; gameMode?: string; ohneStempel?: boolean; ausruestung?: GameState["ausruestung"]; delegationRamona?: TeamControlSettings["delegation"] } = {}): GameState {
  const teams = [team("T-H1", true), team("T-H2", true), team("T-K1", false), team("T-K2", false)];
  return {
    scenarioMeta: { gameMode: opts.gameMode ?? "battle", scenarioType: "x", label: "x" },
    season: { id: "s1", name: "s1", year: 1, matchdayIds: IDS, currentMatchday: 1 },
    seasonState: {
      seasonId: "s1",
      // Wie nach dem Laden bzw. dem Festschreiben vor dem Buchen: eine neue Saison traegt den Besitz-Stempel ab Saisonbeginn.
      ...(opts.ohneStempel || (opts.gameMode ?? "battle") !== "battle"
        ? {}
        : { ausruestungRegel: { seasonId: "s1", wechsel: [{ ab: null, besitz: true, wirkung: "keine", schmiede: 0, effekte: "aus" }] } }),
      matchdayResults: (opts.gebucht ?? []).map((matchdayId) => ({ id: `mr-${matchdayId}`, saveId: "sv", seasonId: "s1", matchdayId, status: "complete" })),
      disciplineResults: [],
      teamControlSettings: {
        "T-H1": kontrolle("T-H1", "manual", "user_local"),
        "T-H2": kontrolle("T-H2", "manual", "ramona_local", opts.delegationRamona),
        "T-K1": kontrolle("T-K1", "ai", "ai"),
        "T-K2": kontrolle("T-K2", "ai", "ai"),
      },
    },
    teams,
    teamIdentities: teams.map((t, i) => ({ teamId: t.teamId, pow: 80 - i * 10, spe: 40 + i * 5, men: 50, soc: 30 + i * 12, ambition: 5, finances: 5, boardConfidence: 5, harmony: 5, manners: 5, popularity: 5, cooperation: 5, playerMin: 8, playerOpt: 12 })),
    players: [],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    matchdayState: {},
    logs: [],
    mappingReport: {},
    ...(opts.ausruestung !== undefined ? { ausruestung: opts.ausruestung } : {}),
  } as unknown as GameState;
}

/** Ein gebuchter Spieltag mit Ergebniszeilen: `punkte[teamId] = [d1, d2]`, `siege` = Teams mit Rang 1 je Seite. */
export function mitSpieltag(
  g: GameState,
  matchdayId: string,
  punkte: Record<string, [number, number]>,
  siege: { d1?: string[]; d2?: string[] } = {},
): GameState {
  const mrId = `mr-${matchdayId}`;
  const zeilen: DisciplineResultRecord[] = [];
  for (const [teamId, [p1, p2]] of Object.entries(punkte)) {
    for (const [seite, p] of [["d1", p1], ["d2", p2]] as const) {
      zeilen.push({
        id: `${mrId}-${teamId}-${seite}`,
        matchdayResultId: mrId,
        teamId,
        disciplineId: seite === "d1" ? "climbing" : "hockey",
        disciplineSide: seite,
        rank: (siege[seite] ?? []).includes(teamId) ? 1 : 2,
        baseScore: 0,
        totalScore: 0,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-11-22T00:00:00Z",
        teamPoints: p,
      } as unknown as DisciplineResultRecord);
    }
  }
  const ohne = (g.seasonState.matchdayResults ?? []).filter((r) => r.id !== mrId);
  return {
    ...g,
    seasonState: {
      ...g.seasonState,
      matchdayResults: [...ohne, { id: mrId, saveId: "sv", seasonId: "s1", matchdayId, status: "complete" } as never],
      disciplineResults: [...(g.seasonState.disciplineResults ?? []), ...zeilen],
    },
  };
}

export const REGEL_BESITZ = { besitz: true, wirkung: "keine", schmiede: 0, effekte: "aus" } as const;
