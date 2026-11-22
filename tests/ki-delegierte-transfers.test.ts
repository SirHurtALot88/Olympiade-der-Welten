import { describe, expect, it } from "vitest";

import { ermittleDelegierteTransferTeamIds, mitDelegiertenAlsKi } from "@/lib/ai/ki-delegierte-transfers";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistenceService } from "@/lib/persistence/types";

function stand(): GameState {
  const e = (teamId: string, controlMode: string, ownerId: string, delegation?: unknown) => ({ teamId, controlMode, ownerId, ...(delegation ? { delegation } : {}) });
  return {
    teams: ["A", "B", "C", "D"].map((teamId) => ({ teamId })),
    seasonState: {
      teamControlSettings: {
        A: e("A", "manual", "chris", { stufe: "voll_selbst" }),
        B: e("B", "manual", "franky", { stufe: "voll_ki" }),
        C: e("C", "manual", "ramona_local", { stufe: "halbautomatik" }),
        D: e("D", "ai", "ai"),
      },
    },
  } as unknown as GameState;
}

describe("Review 22.11. Befund 10: Voll-KI-Menschenteams nehmen am Kauffenster teil", () => {
  it("nur manuelle Teams mit transfers=ki: Voll KI ja, Voll selbst und Halbautomatik (Kaeufe selbst) nein, echte KI nicht doppelt", () => {
    expect(ermittleDelegierteTransferTeamIds(stand(), null)).toEqual(["B"]);
    expect(ermittleDelegierteTransferTeamIds(stand(), new Set(["A", "C"]))).toEqual([]);
  });

  it("der Modus gilt nur fuer die Dauer des Laufs und wird danach zurueckgesetzt, auch bei Fehler", async () => {
    let gs = stand();
    const persistence = {
      getSaveById: () => ({ saveId: "s", status: "active", gameState: gs }),
      saveSingleplayerState: (_id: string, next: GameState) => {
        gs = next;
        return { saveId: "s", gameState: gs };
      },
    } as unknown as PersistenceService;
    const waehrend = await mitDelegiertenAlsKi(persistence, "s", ["B"], async () => gs.seasonState.teamControlSettings!.B!.controlMode);
    expect(waehrend).toBe("ai");
    expect(gs.seasonState.teamControlSettings!.B!.controlMode).toBe("manual");
    expect(gs.seasonState.teamControlSettings!.B!.ownerId).toBe("franky");
    await expect(mitDelegiertenAlsKi(persistence, "s", ["B"], async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(gs.seasonState.teamControlSettings!.B!.controlMode).toBe("manual");
    expect(gs.seasonState.teamControlSettings!.A!.controlMode).toBe("manual");
  });
});
