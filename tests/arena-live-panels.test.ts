import { describe, expect, it } from "vitest";

import {
  buildArenaFixturesPanel,
  buildArenaStandingsPanel,
  type ArenaStandingsPanelPreviewItem,
} from "@/lib/foundation/battle-arena/arena-live-panels";
import type { SpieltagsUebersicht } from "@/lib/foundation/season-matchday-fixtures-overview";
import type { TeamRelationshipKind } from "@/lib/foundation/team-relationship";

/**
 * LIVE-PANELS FUER DIE BATTLE ARENA — reiner Builder-Test, analog zu
 * `tests/arena-host-spielquelle-hinweis.test.ts` / `tests/arena-seed-identitaet.test.ts`.
 * S. Dateikommentar in `lib/foundation/battle-arena/arena-live-panels.ts` für den
 * Machbarkeits-Befund (Batch-Buchung, kein "Partie laeuft/pausiert"-Zwischenzustand).
 */

function uebersicht(overrides: Partial<SpieltagsUebersicht> = {}): SpieltagsUebersicht {
  return {
    matchdayId: "md1",
    matchdayIndex: 3,
    miniDmPods: [],
    paarungen: [],
    ...overrides,
  } as SpieltagsUebersicht;
}

describe("buildArenaStandingsPanel", () => {
  const teams = [
    { teamId: "a", name: "Team A", shortCode: "AAA" },
    { teamId: "b", name: "Team B", shortCode: "BBB" },
    { teamId: "c", name: "Team C", shortCode: "CCC" },
  ];

  it("zeigt den zuletzt gebuchten Stand ohne Preview unveraendert, sortiert nach Rang", () => {
    const panel = buildArenaStandingsPanel({
      teams,
      standings: {
        a: { points: 42, rank: 2, verhaeltnis: 3.5 },
        b: { points: 50, rank: 1, verhaeltnis: 7.1 },
        c: { points: 10, rank: 3, verhaeltnis: -10.6 },
      },
      currentMatchdayNumber: 4,
      ownTeamId: "a",
      preview: null,
    });

    expect(panel.isProvisional).toBe(false);
    expect(panel.rows.map((row) => row.teamId)).toEqual(["b", "a", "c"]);
    expect(panel.rows[1]).toMatchObject({ teamId: "a", isOwnTeam: true, points: 42, sp: 4, diff: 3.5, isProvisionalRow: false });
    expect(panel.hinweisText).toMatch(/Aktueller Saisonstand/);
  });

  it("markiert eine Zeile nur als vorlaeufig, wenn die Preview eine unvollstaendige Buchung meldet", () => {
    const previewItems: ArenaStandingsPanelPreviewItem[] = [
      { teamId: "a", projectedRank: 1, projectedPoints: 60, resultStatus: "incomplete_result" },
      { teamId: "b", projectedRank: 2, projectedPoints: 50, resultStatus: "ready" },
      { teamId: "c", projectedRank: 3, projectedPoints: 10, resultStatus: "ready" },
    ];

    const panel = buildArenaStandingsPanel({
      teams,
      standings: {
        a: { points: 42, rank: 2, verhaeltnis: 3.5 },
        b: { points: 50, rank: 1, verhaeltnis: 7.1 },
        c: { points: 10, rank: 3, verhaeltnis: -10.6 },
      },
      currentMatchdayNumber: 4,
      ownTeamId: "a",
      preview: { matchdayResultFound: true, items: previewItems },
    });

    expect(panel.isProvisional).toBe(true);
    expect(panel.hinweisText).toMatch(/Vorläufig/);
    const rowA = panel.rows.find((row) => row.teamId === "a");
    expect(rowA).toMatchObject({ points: 60, rank: 1, isProvisionalRow: true });
  });

  it("faellt auf den gebuchten Stand zurueck, wenn die Preview fuer ein Team keine Projektion liefert", () => {
    const previewItems: ArenaStandingsPanelPreviewItem[] = [
      { teamId: "a", projectedRank: null, projectedPoints: null, resultStatus: "incomplete_result" },
      { teamId: "b", projectedRank: 2, projectedPoints: 50, resultStatus: "ready" },
    ];

    const panel = buildArenaStandingsPanel({
      teams: teams.slice(0, 2),
      standings: {
        a: { points: 42, rank: 2, verhaeltnis: null },
        b: { points: 50, rank: 1, verhaeltnis: null },
      },
      currentMatchdayNumber: 4,
      ownTeamId: null,
      preview: { matchdayResultFound: true, items: previewItems },
    });

    const rowA = panel.rows.find((row) => row.teamId === "a");
    expect(rowA).toMatchObject({ points: 42, rank: 2, isProvisionalRow: false });
  });

  it("ohne Standing-Eintrag bleibt das Team mit null-Werten statt zu verschwinden", () => {
    const panel = buildArenaStandingsPanel({
      teams: [{ teamId: "z", name: "Ghost", shortCode: "GHO" }],
      standings: {},
      currentMatchdayNumber: null,
      ownTeamId: null,
      preview: null,
    });
    expect(panel.rows).toEqual([
      {
        teamId: "z",
        teamName: "Ghost",
        teamCode: "GHO",
        rank: null,
        sp: null,
        diff: null,
        points: null,
        isOwnTeam: false,
        isProvisionalRow: false,
      },
    ]);
  });
});

describe("buildArenaFixturesPanel", () => {
  const teamsById = new Map([
    ["home1", { name: "Heimteam", shortCode: "HEI" }],
    ["away1", { name: "Gastteam", shortCode: "GAS" }],
    ["home2", { name: "Drittes Team", shortCode: "DRI" }],
    ["away2", { name: "Viertes Team", shortCode: "VIE" }],
  ]);

  it("liefert null, wenn keine Uebersicht vorliegt", () => {
    expect(
      buildArenaFixturesPanel({ uebersicht: null, teamsById, heimTeamId: "home1", gastTeamId: "away1" }),
    ).toBeNull();
  });

  it("markiert das eigene Duell unabhaengig von der Heim/Gast-Orientierung und zieht es nach vorn", () => {
    const panel = buildArenaFixturesPanel({
      uebersicht: uebersicht({
        paarungen: [
          {
            fixtureId: "f-other",
            matchdayId: "md1",
            leagueTier: null,
            teilnehmer: [],
            homeTeamId: "home2",
            awayTeamId: "away2",
            gespielt: false,
            disziplinen: [],
            istRueckspiel: false,
            hinspielMatchdayId: null,
            hinspielMatchdayLabel: null,
          },
          {
            fixtureId: "f-own",
            matchdayId: "md1",
            leagueTier: null,
            teilnehmer: [],
            homeTeamId: "away1",
            awayTeamId: "home1",
            gespielt: true,
            disziplinen: [
              {
                disciplineId: "basketball",
                disciplineName: "Basketball",
                disciplineSide: "d1",
                gespielt: true,
                punkteHeim: 2,
                punkteGast: 0,
                seiten: null,
                verhaeltnisHeim: null,
                verhaeltnisGast: null,
                ergebnisNormiert: null,
                resolutionSource: "arena",
                arenaAusfall: null,
                occurrenceInSeason: null,
                miniDmPodIdHeim: null,
                miniDmPodIdGast: null,
              },
              {
                disciplineId: "hockey",
                disciplineName: "Hockey",
                disciplineSide: "d2",
                gespielt: false,
                punkteHeim: null,
                punkteGast: null,
                seiten: null,
                verhaeltnisHeim: null,
                verhaeltnisGast: null,
                ergebnisNormiert: null,
                resolutionSource: null,
                arenaAusfall: null,
                occurrenceInSeason: null,
                miniDmPodIdHeim: null,
                miniDmPodIdGast: null,
              },
            ],
            istRueckspiel: false,
            hinspielMatchdayId: null,
            hinspielMatchdayLabel: null,
          },
        ],
      }),
      teamsById,
      // UI-Auswahl in UMGEKEHRTER Orientierung zum Fixture ("home1" ist hier Gast) --
      // `isOwnMatch` muss trotzdem greifen (vgl. `resolveArenaHostSeeds`' Orientierungs-Unabhaengigkeit).
      heimTeamId: "home1",
      gastTeamId: "away1",
    });

    expect(panel).not.toBeNull();
    expect(panel!.matchdayLabel).toBe("Spieltag 4");
    expect(panel!.rows[0]).toMatchObject({ fixtureId: "f-own", isOwnMatch: true });
    expect(panel!.rows[0].resultLabel).toBe("Basketball 2:0 · Hockey ausstehend");
    expect(panel!.rows[1]).toMatchObject({ fixtureId: "f-other", isOwnMatch: false, gespielt: false, resultLabel: null });
  });

  it("markiert ein Rivalen-Spiel, auch wenn es nicht das eigene Duell ist", () => {
    const relationshipByTeamId: ReadonlyMap<string, TeamRelationshipKind> = new Map([
      ["home2", "rival"],
    ]);
    const panel = buildArenaFixturesPanel({
      uebersicht: uebersicht({
        paarungen: [
          {
            fixtureId: "f-own",
            matchdayId: "md1",
            leagueTier: null,
            teilnehmer: [],
            homeTeamId: "home1",
            awayTeamId: "away1",
            gespielt: false,
            disziplinen: [],
            istRueckspiel: false,
            hinspielMatchdayId: null,
            hinspielMatchdayLabel: null,
          },
          {
            fixtureId: "f-rival",
            matchdayId: "md1",
            leagueTier: null,
            teilnehmer: [],
            homeTeamId: "home2",
            awayTeamId: "away2",
            gespielt: false,
            disziplinen: [],
            istRueckspiel: false,
            hinspielMatchdayId: null,
            hinspielMatchdayLabel: null,
          },
        ],
      }),
      teamsById,
      heimTeamId: "home1",
      gastTeamId: "away1",
      relationshipByTeamId,
    });

    expect(panel!.rows[0].fixtureId).toBe("f-own");
    expect(panel!.rows[1]).toMatchObject({ fixtureId: "f-rival", isRivalMatch: true });
  });
});
