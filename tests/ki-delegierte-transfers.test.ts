import { describe, expect, it } from "vitest";

import { ermittleDelegierteTransferTeamIds, getTransferControlSettings, istTransferAnKiDelegiert } from "@/lib/ai/ki-delegierte-transfers";
import type { GameState } from "@/lib/data/olyDataTypes";

function stand(seasonId = "season-2"): GameState {
  const e = (teamId: string, controlMode: string, ownerId: string, delegation?: unknown) => ({
    teamId,
    controlMode,
    ownerId,
    ownerSlot: ownerId === "ai" ? null : `slot-${ownerId}`,
    humanControlled: controlMode === "manual",
    ...(delegation ? { delegation } : {}),
  });
  return {
    season: { id: seasonId },
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

describe("Review 22.11. Befund 10 / Runde 2: Voll-KI-Menschenteams im Kauffenster, ohne den Spielstand-Modus zu aendern", () => {
  it("nur manuelle Teams mit transfers=ki, unabhaengig vom Ausloeser; Saison 1 nie", () => {
    expect(ermittleDelegierteTransferTeamIds(stand())).toEqual(["B"]);
    expect(ermittleDelegierteTransferTeamIds(stand("season-1"))).toEqual([]);
  });

  it("die Lesesicht hebt den Modus nur im Speicher: Spielstand, Besitzer und humanControlled bleiben unveraendert", () => {
    const gs = stand();
    const vorher = JSON.stringify(gs);
    expect(getTransferControlSettings(gs, "B")?.controlMode).toBe("ai");
    expect(getTransferControlSettings(gs, "B")?.aiTransferPreviewEnabled).toBe(true);
    expect(getTransferControlSettings(gs, "A")?.controlMode).toBe("manual");
    expect(getTransferControlSettings(gs, "C")?.controlMode).toBe("manual");
    expect(getTransferControlSettings(gs, "D")?.controlMode).toBe("ai");
    expect(JSON.stringify(gs)).toBe(vorher);
    const b = gs.seasonState.teamControlSettings!.B!;
    expect(b.ownerId).toBe("franky");
    expect(b.controlMode).toBe("manual");
    expect(istTransferAnKiDelegiert(gs, "B")).toBe(true);
    expect(istTransferAnKiDelegiert(gs, "C")).toBe(false);
  });
});
