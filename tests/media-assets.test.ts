import { describe, expect, it } from "vitest";

import { getPlayerPortraitBrowserUrl, getPlayerPortraitPathById } from "@/lib/data/mediaAssets";

describe("media assets portrait mapping", () => {
  it("exposes browser-safe api routes for mapped local portrait files", () => {
    expect(getPlayerPortraitPathById("player-0154-riley-le-rouge")).toContain("Riley Le Rogue.jpg");
    expect(getPlayerPortraitBrowserUrl("player-0154-riley-le-rouge")).toBe(
      "/api/media/player-portrait/player-0154-riley-le-rouge",
    );
  });

  it("keeps externally hosted portrait urls intact", () => {
    expect(
      getPlayerPortraitBrowserUrl("player-external", "https://img.example/player.png", null),
    ).toBe("https://img.example/player.png");
  });
});
