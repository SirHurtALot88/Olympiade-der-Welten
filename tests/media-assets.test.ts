import { describe, expect, it } from "vitest";

import {
  appendMediaImageVariant,
  getPlayerPortraitBrowserUrl,
  getPlayerPortraitMediaModel,
  getPlayerPortraitPathById,
  getTeamLogoBrowserUrl,
  getTeamLogoModel,
} from "@/lib/data/mediaAssets";
import { resolvePortraitVariantForDisplayPx } from "@/lib/media/mediaThumbnailConfig";

describe("media assets portrait mapping", () => {
  it("exposes browser-safe api routes for mapped local portrait files", () => {
    expect(getPlayerPortraitPathById("player-0154-riley-le-rouge")).toContain("Riley_Le_Rogue-bef87d06-48fe-4eca-b665-cb9db53399e5.png");
    expect(getPlayerPortraitBrowserUrl("player-0154-riley-le-rouge")).toBe(
      "/api/media/player-portrait/player-0154-riley-le-rouge",
    );
    expect(getPlayerPortraitPathById("player-2969-lakshmi-ekelemann")).toContain("Lakshmi Ekelmann.jpg");
    // public/portraits/ now carries a Dropbox-sourced file for toothkrix (see
    // public/portraits/README.md), and files there always outrank the legacy
    // absolute-path map above (lib/data/mediaAssets.ts, same rule as team
    // logos below). "peacock" is the one player the Dropbox import found no
    // matching image for, so it's the case that still exercises the legacy
    // API-route fallback.
    expect(getPlayerPortraitBrowserUrl("player-2968-toothkrix")).toBe("/portraits/toothkrix.jpg");
    expect(getPlayerPortraitBrowserUrl("player-2676-peacock")).toBe(
      "/api/media/player-portrait/player-2676-peacock",
    );
    expect(getPlayerPortraitPathById("player-2676-peacock")).toContain("Peacock.png");
  });

  it("keeps externally hosted portrait urls intact", () => {
    expect(
      getPlayerPortraitBrowserUrl("player-external", "https://img.example/player.png", null),
    ).toBe("https://img.example/player.png");
  });

  it("appends thumb and preview variant query params for api media routes", () => {
    // All 32 real team codes now have an indexed static logo file under
    // public/team-logos/ (see data/generated/team-logo-files.json, produced by
    // `npm run team-logos:index`), and getStaticTeamLogoUrl()'s file-based path
    // intentionally takes priority over the /api/media/team-logo route (see the
    // comment above getStaticTeamLogoUrl in lib/data/mediaAssets.ts). Use a
    // team id that has no indexed static file to keep exercising the
    // variant-query-param branch of getTeamLogoBrowserUrl.
    expect(getTeamLogoBrowserUrl("ZZ-NOFILE", "/Users/local/logo.png", { variant: "thumb" })).toBe(
      "/api/media/team-logo/ZZ-NOFILE?variant=thumb",
    );
    expect(
      getPlayerPortraitBrowserUrl("player-0154-riley-le-rouge", null, null, { variant: "thumb" }),
    ).toBe("/api/media/player-portrait/player-0154-riley-le-rouge?variant=thumb");
    expect(
      getPlayerPortraitBrowserUrl("player-0154-riley-le-rouge", null, null, { variant: "preview" }),
    ).toBe("/api/media/player-portrait/player-0154-riley-le-rouge?variant=preview");
  });

  it("does not append resized variants to external or static browser paths", () => {
    expect(appendMediaImageVariant("https://cdn.example/logo.png", "thumb")).toBe("https://cdn.example/logo.png");
    expect(appendMediaImageVariant("/assets/teams/h-r.png", "preview")).toBe("/assets/teams/h-r.png");
    expect(appendMediaImageVariant("/api/media/team-logo/H-R?variant=thumb", "preview")).toBe(
      "/api/media/team-logo/H-R?variant=preview",
    );
  });

  it("builds team logo models with optional thumb variant", () => {
    // Same static-file-priority reasoning as above: use a team id with no
    // indexed public/team-logos/ file so the /api/media variant-query-param
    // path is what gets exercised here.
    expect(
      getTeamLogoModel(
        {
          teamId: "ZZ-NOFILE",
          name: "Helsinki Rovers",
          logoPath: "/Users/local/logo.png",
        },
        { variant: "thumb" },
      ),
    ).toEqual({
      src: "/api/media/team-logo/ZZ-NOFILE?variant=thumb",
      initials: "HR",
    });
  });

  it("builds portrait media models with thumb and preview variants", () => {
    expect(
      getPlayerPortraitMediaModel({
        id: "player-0154-riley-le-rouge",
        name: "Riley Le Rogue",
        portraitUrl: null,
        portraitPath: null,
      }),
    ).toEqual({
      src: "/api/media/player-portrait/player-0154-riley-le-rouge",
      thumbSrc: "/api/media/player-portrait/player-0154-riley-le-rouge?variant=thumb",
      previewSrc: "/api/media/player-portrait/player-0154-riley-le-rouge?variant=preview",
      initials: "RL",
    });
  });

  it("maps display sizes to thumb or preview variants", () => {
    expect(resolvePortraitVariantForDisplayPx(42)).toBe("thumb");
    expect(resolvePortraitVariantForDisplayPx(56)).toBe("thumb");
    expect(resolvePortraitVariantForDisplayPx(160)).toBe("preview");
    expect(resolvePortraitVariantForDisplayPx(240)).toBe("preview");
  });
});
