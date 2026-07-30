import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isDisciplinePointsSliceUsable,
  resolveDisciplinePointsLedgerView,
  resolvePlayerDisciplinePoints,
} from "@/lib/foundation/discipline-points-source";
import { buildSeasonStandingsTopPlayersByTeam } from "@/lib/foundation/season-standings-top-players";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * Im Saisonstand stand hinter jedem Disziplin-Kürzel der Aufklappung "(0)" —
 * auch bei Teams mit klar sichtbaren Disziplin-Punkten daneben. Zwei Ursachen
 * lagen übereinander, und nur beide zusammen erklären das Bild:
 *
 *  1. `teamTopPlayersByColumn` wurde ausschliesslich im `FoundationSeasonV2Host`
 *     gebaut — der wird NIRGENDS gerendert. Auf dem tatsächlich gerenderten Pfad
 *     (FoundationShellRouterBody → FoundationSeasonV2Panel) kam der Prop nie an.
 *     Weil er am Client optional ist, gab es dafür keinen Typfehler.
 *  2. Selbst richtig verdrahtet hätte der clientseitige Ledger nur den AKTIVEN
 *     Spieltag gekannt (kompakter Payload) — am echten Spielstand waren das 2
 *     von 20 Disziplinen.
 */
describe("Saisonstand: Teilnehmerzahl je Disziplin", () => {
  const ROSTERS = [
    { teamId: "T1", playerId: "p1" },
    { teamId: "T1", playerId: "p2" },
    { teamId: "T1", playerId: "p3" },
  ];
  const PLAYERS = [
    { id: "p1", name: "Anna" },
    { id: "p2", name: "Bert" },
    { id: "p3", name: "Cleo" },
  ];
  const gameState = { players: PLAYERS, rosters: ROSTERS } as never;

  /** Der beschnittene Client-Ledger: nur die Disziplin des aktiven Spieltags. */
  const compactLedger = {
    playerSummariesByPlayerId: new Map([["p1", { pointsByDiscipline: { tdm: 1.2 } }]]),
  };
  /** Der Server-Slice: die ganze Saison. */
  const slice = {
    payload: { ok: true },
    error: null,
    disciplinePointsByPlayerId: {
      p1: { tdm: 1.2, "mini-dm": 3.4, gewichtheben: 0 },
      p2: { "mini-dm": 2.1 },
      p3: { gewichtheben: 5 },
    },
  };

  function participantCounts(ledger: Parameters<typeof buildSeasonStandingsTopPlayersByTeam>[0]["seasonPointsLedger"]) {
    const columns = buildSeasonStandingsTopPlayersByTeam({
      gameState,
      playerRatingsById: null,
      seasonPointsLedger: ledger,
    }).get("T1");
    return Object.fromEntries(
      Object.entries(columns ?? {}).map(([key, entries]) => [key, entries?.length ?? 0]),
    );
  }

  it("belegt die Ursache: der kompakte Client-Ledger kennt nur einen Spieltag", () => {
    expect(participantCounts(compactLedger)).toEqual({ tdm: 1 });
  });

  it("liefert mit dem Server-Slice alle Disziplinen der Saison", () => {
    const counts = participantCounts(
      resolveDisciplinePointsLedgerView({ playerDirectorySlice: slice, seasonPointsLedger: compactLedger }),
    );
    expect(counts).toEqual({ tdm: 1, mini_dm: 2, gewichtheben: 1 });
  });

  it("zaehlt nur echte Teilnehmer — 0 PPs ist kein Einsatz", () => {
    // p1 hat `gewichtheben: 0`; dort steht nur p3 (5 PPs).
    const view = resolveDisciplinePointsLedgerView({
      playerDirectorySlice: slice,
      seasonPointsLedger: compactLedger,
    });
    const entries = buildSeasonStandingsTopPlayersByTeam({
      gameState,
      playerRatingsById: null,
      seasonPointsLedger: view,
    }).get("T1")?.gewichtheben;
    expect(entries?.map((entry) => entry.playerId)).toEqual(["p3"]);
  });
});

/**
 * Dieselbe Frage ("woher kommen die Disziplin-PPs?") stellt sich an drei
 * Stellen. Sie darf nur EINE Antwort haben, sonst driften die Oberflächen.
 */
describe("Disziplin-PPs: eine Quellenregel für alle Verbraucher", () => {
  const usable = { payload: { ok: true }, error: null, disciplinePointsByPlayerId: { p1: { tdm: 4 } } };
  const pending = { payload: null, error: null, disciplinePointsByPlayerId: {} };
  const failed = { payload: { ok: true }, error: "boom", disciplinePointsByPlayerId: { p1: { tdm: 4 } } };
  const ledger = { playerSummariesByPlayerId: new Map([["p1", { pointsByDiscipline: { tdm: 99 } }]]) };

  it("erkennt einen unterwegs befindlichen oder kaputten Slice als unbrauchbar", () => {
    expect(isDisciplinePointsSliceUsable(usable)).toBe(true);
    expect(isDisciplinePointsSliceUsable(pending)).toBe(false);
    expect(isDisciplinePointsSliceUsable(failed)).toBe(false);
    expect(isDisciplinePointsSliceUsable(null)).toBe(false);
  });

  it("nimmt den Slice, sobald er brauchbar ist — auch wenn der Ledger etwas anderes sagt", () => {
    expect(
      resolvePlayerDisciplinePoints({
        playerId: "p1",
        playerDirectorySlice: usable,
        ledgerPointsByDiscipline: { tdm: 99 },
      }),
    ).toEqual({ tdm: 4 });
    expect(
      resolveDisciplinePointsLedgerView({ playerDirectorySlice: usable, seasonPointsLedger: ledger })
        ?.playerSummariesByPlayerId.get("p1")?.pointsByDiscipline,
    ).toEqual({ tdm: 4 });
  });

  it("faellt ohne brauchbaren Slice auf den Ledger zurueck — beide Verbraucher gleich", () => {
    for (const slice of [pending, failed]) {
      expect(
        resolvePlayerDisciplinePoints({
          playerId: "p1",
          playerDirectorySlice: slice,
          ledgerPointsByDiscipline: { tdm: 99 },
        }),
      ).toEqual({ tdm: 99 });
      expect(
        resolveDisciplinePointsLedgerView({ playerDirectorySlice: slice, seasonPointsLedger: ledger }),
      ).toBe(ledger);
    }
  });

  it("erfindet nichts: fehlt der Spieler im brauchbaren Slice, bleibt es leer", () => {
    expect(
      resolvePlayerDisciplinePoints({
        playerId: "unbekannt",
        playerDirectorySlice: usable,
        ledgerPointsByDiscipline: { tdm: 99 },
      }),
    ).toBeNull();
  });

  it("haelt die Regel an EINER Stelle — der Teams-Tab ruft sie nur auf", () => {
    const roster = read("lib/foundation/tabs/use-foundation-cross-tab-teams-roster.ts");
    expect(roster).toContain("resolveRosterDisciplinePointsSource = resolvePlayerDisciplinePoints");
    expect(roster).not.toContain("input.playerDirectorySlice.disciplinePointsByPlayerId[");
  });
});

/**
 * Der Prop muss auf dem GERENDERTEN Pfad ankommen. Genau das war die Luecke:
 * gebaut wurde er nur im `FoundationSeasonV2Host`, und der wird nirgends
 * gerendert.
 */
describe("Saisonstand: die Teilnehmerlisten erreichen den gerenderten Pfad", () => {
  it("reicht teamTopPlayersByColumn vom Body ans Panel durch", () => {
    const body = read("app/foundation/FoundationShellRouterBody.tsx");
    expect(body).toContain("teamTopPlayersByColumn={seasonV2TeamTopPlayersByColumn}");
    expect(body).toContain("seasonV2TeamTopPlayersByColumn,");
  });

  it("baut sie im Scope aus dem Server-Slice, nicht aus dem Client-Ledger", () => {
    const scope = read("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
    expect(scope).toContain("const seasonV2TeamTopPlayersByColumn = useMemo(");
    expect(scope).toContain("seasonPointsLedger: resolveDisciplinePointsLedgerView({");
    // Der Slice muss im Saisonstand ueberhaupt geladen werden.
    expect(scope).toContain('shouldBuildTeamsView || activeView === "seasonV2"');
  });

  it("zeigt im Archiv gar keine Liste statt einer aus Live-Werten geratenen", () => {
    const scope = read("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
    const start = scope.indexOf("const seasonV2TeamTopPlayersByColumn = useMemo(");
    expect(scope.slice(start, start + 400)).toContain("isViewingArchivedSeason\n        ? null");
  });
});
