import { beforeEach, describe, expect, it, vi } from "vitest";

import { withPersistedSeasonDerivations } from "@/lib/foundation/materialize-season-derivations";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";

const getSaveById = vi.fn();
const getActiveSave = vi.fn();
const bootstrapSingleplayerSave = vi.fn();
const readSliceGameStateForSave = vi.fn();
const readPersistedSeasonDerivationsProjection = vi.fn();

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById,
    getActiveSave,
    bootstrapSingleplayerSave,
  }),
}));

vi.mock("@/lib/persistence/save-repository", () => ({
  readSliceGameStateForSave,
}));

vi.mock("@/lib/persistence/save-projection-read", () => ({
  readPersistedSeasonDerivationsProjection,
}));

describe("team overview slice api", () => {
  beforeEach(() => {
    getSaveById.mockReset();
    getActiveSave.mockReset();
    bootstrapSingleplayerSave.mockReset();
    readSliceGameStateForSave.mockReset();
    readPersistedSeasonDerivationsProjection.mockReset();
  });

  it(
    "returns projection rows with etag when persisted derivations match",
    async () => {
    const gameState = withPersistedSeasonDerivations(createSingleplayerGameState());
    const persisted = gameState.seasonState.persistedSeasonDerivations!;
    const contentSignature = persisted.contentSignature;

    readPersistedSeasonDerivationsProjection.mockReturnValue({
      saveId: "save-team-overview",
      seasonId: gameState.season.id,
      contentSignature,
      persistedSeasonDerivations: persisted,
      signatureMatches: true,
    });
    readSliceGameStateForSave.mockReturnValue(gameState);

    const { GET } = await import("@/app/api/season/team-overview-slice/route");
    const response = await GET(
      new Request(
        `http://localhost/api/season/team-overview-slice?saveId=save-team-overview&contentSignature=${encodeURIComponent(contentSignature)}`,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toContain("team-overview-slice");
    expect(Array.isArray(payload.rows)).toBe(true);
    expect(payload.rows.length).toBeGreaterThan(0);
    expect(payload.warnings).toContain("projection_read");
  },
  60_000,
  );
});
