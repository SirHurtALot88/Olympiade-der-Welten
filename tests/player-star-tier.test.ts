import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  describePlayerStarTier,
  getBestPlayerStarTier,
  getPlayerStarTier,
  getPlayerStarTierClassName,
  getPlayerStarTierLabel,
  isHoloPlayerStarTier,
  PLAYER_STAR_TIERS,
} from "@/lib/foundation/player-star-tier";

describe("Star-Tier: Schwellen", () => {
  it("bildet Top 3 / 10 / 25 / 50 auf Diamant / Gold / Silber / Bronze ab", () => {
    expect(getPlayerStarTier(1)).toBe("diamond");
    expect(getPlayerStarTier(3)).toBe("diamond");
    expect(getPlayerStarTier(4)).toBe("gold");
    expect(getPlayerStarTier(10)).toBe("gold");
    expect(getPlayerStarTier(11)).toBe("silver");
    expect(getPlayerStarTier(25)).toBe("silver");
    expect(getPlayerStarTier(26)).toBe("bronze");
    expect(getPlayerStarTier(50)).toBe("bronze");
  });

  it("vergibt außerhalb der Top 50 und ohne Rang keine Stufe", () => {
    // Kein Fallback auf Bronze — sonst trüge jeder rangloser Spieler einen Rahmen.
    expect(getPlayerStarTier(51)).toBeNull();
    expect(getPlayerStarTier(400)).toBeNull();
    expect(getPlayerStarTier(null)).toBeNull();
    expect(getPlayerStarTier(undefined)).toBeNull();
    expect(getPlayerStarTier(0)).toBeNull();
    expect(getPlayerStarTier(-1)).toBeNull();
    expect(getPlayerStarTier(Number.NaN)).toBeNull();
  });

  it("hält Schwellen und Reihenfolge in einer einzigen Quelle", () => {
    const maxRanks = PLAYER_STAR_TIERS.map((entry) => entry.maxRank);
    expect(maxRanks).toEqual([3, 10, 25, 50]);
    // Aufsteigend sortiert — die Auswertung nimmt den ersten Treffer.
    expect([...maxRanks].sort((left, right) => left - right)).toEqual(maxRanks);
  });
});

describe("Star-Tier: bester Rang fürs Portrait", () => {
  it("nimmt den besten der drei Ränge", () => {
    // Nur in MVS top, sonst mittelmäßig → das Portrait zeigt trotzdem Diamant.
    expect(getBestPlayerStarTier(120, 340, 2)).toBe("diamond");
    expect(getBestPlayerStarTier(12, 40, 60)).toBe("silver");
    expect(getBestPlayerStarTier(80, 90, 100)).toBeNull();
  });

  it("ignoriert fehlende und unplausible Ränge statt sie als 'gut' zu werten", () => {
    expect(getBestPlayerStarTier(null, undefined, 8)).toBe("gold");
    expect(getBestPlayerStarTier(null, undefined, null)).toBeNull();
    expect(getBestPlayerStarTier(0, -5, 30)).toBe("bronze");
  });
});

describe("Star-Tier: Holo und Beschriftung", () => {
  it("gibt den Holo-Schimmer nur der Top 10", () => {
    expect(isHoloPlayerStarTier("diamond")).toBe(true);
    expect(isHoloPlayerStarTier("gold")).toBe(true);
    expect(isHoloPlayerStarTier("silver")).toBe(false);
    expect(isHoloPlayerStarTier("bronze")).toBe(false);
    expect(isHoloPlayerStarTier(null)).toBe(false);
  });

  it("liefert Klassennamen und Labels, ohne Stufe leer/null", () => {
    expect(getPlayerStarTierClassName("gold")).toBe("is-star-tier-gold");
    expect(getPlayerStarTierClassName(null)).toBe("");
    expect(getPlayerStarTierLabel("diamond")).toBe("Diamant · Liga-Top-3");
    expect(getPlayerStarTierLabel(null)).toBeNull();
  });

  it("nennt im Tooltip die Kennzahl, die die Stufe ausgelöst hat", () => {
    expect(describePlayerStarTier({ ovrRank: 40, ppsRank: 2, mvsRank: 90 })).toBe(
      "Diamant · Liga-Top-3 — PPs #2",
    );
    expect(describePlayerStarTier({ ovrRank: 9 })).toBe("Gold · Liga-Top-10 — OVR #9");
    expect(describePlayerStarTier({ ovrRank: 200, ppsRank: 300 })).toBeNull();
    expect(describePlayerStarTier({})).toBeNull();
  });
});

describe("Star-Tier: Renderpfade", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("leitet das Tier in der gemeinsamen Portraitkarte ab (deckt alle Hover-Previews mit ab)", () => {
    const cardText = read("components/foundation/player-portrait-card/FoundationPlayerPortraitCard.tsx");
    expect(cardText).toContain("getBestPlayerStarTier(ovrRank, ppsRank, mvsRank)");
    expect(cardText).toContain("getPlayerStarTierClassName(starTier)");
    expect(cardText).toContain('isHoloPlayerStarTier(starTier) ? "is-star-holo" : ""');
    expect(cardText).toContain("data-star-tier={starTier ?? undefined}");

    // Die Preview rendert dieselbe Karte — daher kein zweiter Renderpfad nötig.
    const previewText = read("components/foundation/player-portrait-card/FoundationPlayerPortraitPreview.tsx");
    expect(previewText).toContain("FoundationPlayerPortraitCard");
  });

  it("gibt jeder Kennzahl-Kachel ihre eigene Stufe", () => {
    const presetText = read("lib/foundation/player-portrait-stat-presets.ts");
    expect(presetText).toContain('starTierStatExtra("OVR", input.ovrRank)');
    expect(presetText).toContain('starTierStatExtra("PPs", input.ppsRank)');
    expect(presetText).toContain('starTierStatExtra("MVS", input.mvsRank)');
    // Das Heat-Band bleibt daneben bestehen — beide Aussagen sind gewollt.
    expect(presetText).toContain("heatClass: getPoolHeatClass(input.playerOvr, input.leagueHeatPools.ovr)");
  });

  it("markiert die Rang-Chips der Spielertabelle", () => {
    const tableText = read("app/foundation/players-table/FoundationPlayersTableNewLook.tsx");
    expect(tableText).toContain("const starTier = getPlayerStarTier(rank);");
    expect(tableText).toContain("getPlayerStarTierClassName(starTier)");
  });

  it("legt den Star-Ring der Arena-Marke ZUSÄTZLICH zum bestehenden Ring an", () => {
    const markText = read("app/foundation/discipline-stage/arena/PlayerMark.tsx");
    expect(markText).toContain("export function markStarTierColor");
    expect(markText).toContain("arena-mark-star-ring");
    // Die bestehende Ring-Prioritätskette bleibt unverändert — sonst müsste man
    // sich zwischen "eigener Spieler" und "Star" entscheiden.
    expect(markText).toContain('if (opts.injury) return "var(--nl-risk)";');
    expect(markText).toContain("const ring = markRingColor({ injury, spotlight, isOwn, relation });");
  });

  it("bringt Tier-Farben und Holo-Regeln als Design-Tokens mit", () => {
    const cssText = read("app/globals.css");
    expect(cssText).toContain("--nl-diamond:");
    expect(cssText).toContain(".foundation-player-portrait-card.is-star-tier-diamond");
    expect(cssText).toContain(".foundation-player-portrait-card.is-star-holo::after");
    expect(cssText).toContain("@keyframes nlStarHoloSweep");
    // Bewegung ist Zierde, keine Information.
    expect(cssText).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
