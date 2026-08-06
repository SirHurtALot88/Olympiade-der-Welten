/**
 * GEMELDET: „Was zur hölle ist passiert mit meinem save am season ende, dass ich plötzlich 3 neue
 * spieler habe? Wieso wird für mich gepickt und gedraftet???"
 *
 * BEFUND, mit Zeile:
 *
 *   `lib/ai/preseason-batch-pick-rebuild-service.ts` — `candidateTeamIds` nahm ALLE Teams, wenn
 *   keine Liste uebergeben wurde, und der Filter darunter fragte nur nach Kaderluecke
 *   (`roster < optTarget`) und Kassenlage. NIE nach dem Kontrollmodus. Das Team des Spielers stand
 *   unter Opt-Ziel, landete also in `batchTeamIds` und wurde gedraftet.
 *
 *   `lib/ai/ai-transfer-window-session-service.ts` — der Aufrufer reichte ausdruecklich alle Teams
 *   weiter („Feed all teams into batch"). Zwei Pfade derselben Datei (Kredite, Vorab-Abloesung)
 *   filtern den Kontrollmodus von Hand nach; die Kaufpfade nicht.
 *
 *   `lib/ai/ai-picks-run-service.ts` — `chooseTeams` ermittelte den Kontrollmodus und las ihn dann
 *   im Setup-Fall nicht mehr (`if (teamScope === "all" && allowSetupAllTeams) return true`).
 *
 * Drei Schichten, die alle in dieselbe Richtung versagt haben. Dieser Test haelt die unterste
 * fest: der Batch darf ein menschlich gesteuertes Team nicht einmal ANFASSEN.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const runAiPicksExecutePreview = vi.fn();
const runChunkedRedraftTopup = vi.fn();

vi.mock("@/lib/ai/ai-picks-run-service", () => ({
  runAiPicksExecutePreview: (...args: unknown[]) => runAiPicksExecutePreview(...args),
}));
vi.mock("@/lib/ai/chunked-redraft-topup-service", () => ({
  CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN: "topup-token",
  runChunkedRedraftTopup: (...args: unknown[]) => runChunkedRedraftTopup(...args),
}));

/** Kader klar unter Opt-Ziel, damit der Bedarfsfilter JEDES Team durchlassen wuerde. */
function createSave(humanTeamId: string) {
  const teamIds = ["A-A", "B-B", humanTeamId];
  return {
    saveId: "save-preseason-batch",
    gameState: {
      season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["md-1"] },
      gamePhase: "season_end_management",
      teams: teamIds.map((teamId) => ({
        teamId,
        shortCode: teamId,
        name: `Team ${teamId}`,
        cash: 200,
        budget: 400,
        identityId: teamId,
        humanControlled: teamId === humanTeamId,
        rosterLimit: 14,
      })),
      teamIdentities: teamIds.map((teamId) => ({ teamId, identityId: teamId })),
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: {},
        // Der Spieler steuert sein Team manuell — genau der Zustand aus der Meldung.
        teamControlSettings: { [humanTeamId]: { controlMode: "manual" } },
      },
      matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
      // Jedes Team hat 2 Spieler — weit unter Opt, der Bedarfsfilter sagt also bei allen "ja".
      rosters: teamIds.flatMap((teamId) => [
        { id: `${teamId}-r1`, teamId, playerId: `${teamId}-p1` },
        { id: `${teamId}-r2`, teamId, playerId: `${teamId}-p2` },
      ]),
      players: teamIds.flatMap((teamId) => [
        { id: `${teamId}-p1`, name: `${teamId} Eins`, marketValue: 10 },
        { id: `${teamId}-p2`, name: `${teamId} Zwei`, marketValue: 10 },
      ]),
      disciplines: [],
      contracts: [],
      transferListings: [],
      transferHistory: [],
      logs: [],
    },
  };
}

describe("Preseason-Kauf-Batch: das Team des Spielers bleibt unangetastet", () => {
  beforeEach(() => {
    runAiPicksExecutePreview.mockReset();
    runChunkedRedraftTopup.mockReset();
    runAiPicksExecutePreview.mockResolvedValue({ teams: [], warnings: [], blockingReasons: [], globalExecution: { appliedPickCount: 0 } });
    runChunkedRedraftTopup.mockReturnValue({ picks: [], appliedPicks: 0, warnings: [], blockingReasons: [] });
  });

  it("nimmt ein manuell gesteuertes Team NICHT in den Batch auf", async () => {
    const { runPreseasonBatchPickRebuild } = await import("@/lib/ai/preseason-batch-pick-rebuild-service");
    const save = createSave("S-C");

    const result = await runPreseasonBatchPickRebuild({
      saveId: save.saveId,
      seasonId: "season-2",
      // Kein `teamIds` — genau der Aufruf, der in der Meldung gelaufen ist: „alle Teams rein,
      // der Batch entscheidet". Ohne den Fix entscheidet er sich auch fuer das Team des Spielers.
      persistence: { getSaveById: () => save } as never,
    });

    expect(result.batchTeamIds, "das manuelle Team gehoert nicht in den Batch").not.toContain("S-C");
    expect(result.batchTeamIds).toEqual(["A-A", "B-B"]);
    // 20 s statt der Standard-5: der erste `import()` zieht den kompletten Abhaengigkeitsbaum des
    // Dienstes nach, die beiden folgenden Tests laufen dann aus dem Modul-Cache in Millisekunden.
  }, 20_000);

  it("reicht das manuelle Team auch dann nicht durch, wenn der Aufrufer es ausdruecklich nennt", async () => {
    // Der Weg aus `ai-transfer-window-session-service`: dort wird die volle Team-Liste uebergeben.
    // Eine namentliche Nennung ist KEINE Freigabe — der Kader gehoert dem Spieler.
    const { runPreseasonBatchPickRebuild } = await import("@/lib/ai/preseason-batch-pick-rebuild-service");
    const save = createSave("S-C");

    const result = await runPreseasonBatchPickRebuild({
      saveId: save.saveId,
      seasonId: "season-2",
      teamIds: ["A-A", "B-B", "S-C"],
      persistence: { getSaveById: () => save } as never,
    });

    expect(result.batchTeamIds).not.toContain("S-C");
  });

  it("laesst die KI-Teams weiterhin arbeiten — der Schutz ist kein Stillstand", async () => {
    const { runPreseasonBatchPickRebuild } = await import("@/lib/ai/preseason-batch-pick-rebuild-service");
    const save = createSave("S-C");

    const result = await runPreseasonBatchPickRebuild({
      saveId: save.saveId,
      seasonId: "season-2",
      persistence: { getSaveById: () => save } as never,
    });

    expect(result.batchTeamIds.length, "sonst prueft der Test nur, dass gar nichts passiert").toBeGreaterThan(0);
    // Und der Lauf geht auch wirklich los, statt am leeren Batch abzubrechen.
    expect(runAiPicksExecutePreview).toHaveBeenCalledTimes(1);
    const params = runAiPicksExecutePreview.mock.calls[0][0] as { teamIds: string[]; includeManualTeams?: boolean };
    expect(params.teamIds).not.toContain("S-C");
    // Der Batch ist ein Wartungslauf: er darf den Control-Mode-Schutz nicht aufheben.
    expect(params.includeManualTeams ?? false, "der Batch darf kein manuelles Team freischalten").toBe(false);
  });
});
