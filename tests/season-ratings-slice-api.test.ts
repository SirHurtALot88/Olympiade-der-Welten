import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";

const getSaveById = vi.fn();
const getActiveSave = vi.fn();
const bootstrapSingleplayerSave = vi.fn();

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById,
    getActiveSave,
    bootstrapSingleplayerSave,
  }),
}));

describe("season ratings slice api", () => {
  beforeEach(() => {
    getSaveById.mockReset();
    getActiveSave.mockReset();
    bootstrapSingleplayerSave.mockReset();
  });

  it(
    "returns compact ratings for a local save",
    async () => {
    const gameState = createSingleplayerGameState();
    getSaveById.mockReturnValue({
      saveId: "save-api-ratings",
      gameState,
    });

    const { GET } = await import("@/app/api/season/ratings-slice/route");
    const response = await GET(
      new Request("http://localhost/api/season/ratings-slice?saveId=save-api-ratings&source=sqlite"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.scope.saveId).toBe("save-api-ratings");
    expect(payload.count).toBeGreaterThan(0);
    expect(Object.keys(payload.ratingsByPlayerId).length).toBe(payload.count);
    },
    60_000,
  );
});
