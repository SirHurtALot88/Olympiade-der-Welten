import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  describePlayerStarTier,
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

  it("nennt im Tooltip AUSSCHLIESSLICH den OVR-Rang, der die Stufe ausgelöst hat", () => {
    // Für den Rahmen zählt nur OVR — ein starker PPs-/MVS-Rang taucht im
    // Tooltip bewusst nicht mehr auf (siehe Modul-Kommentar).
    expect(describePlayerStarTier(2)).toBe("Diamant · Liga-Top-3 — OVR #2");
    expect(describePlayerStarTier(9)).toBe("Gold · Liga-Top-10 — OVR #9");
    expect(describePlayerStarTier(200)).toBeNull();
    expect(describePlayerStarTier(null)).toBeNull();
    expect(describePlayerStarTier(undefined)).toBeNull();
  });
});

describe("Star-Tier: Renderpfade", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("leitet das Tier in der gemeinsamen Portraitkarte AUSSCHLIESSLICH aus dem OVR-Rang ab (deckt alle Hover-Previews mit ab)", () => {
    const cardText = read("components/foundation/player-portrait-card/FoundationPlayerPortraitCard.tsx");
    // Die Karte leitet fehlende Raenge weiterhin aus den Liga-Heat-Pools ab (#232),
    // wertet davon aber nur noch den OVR-Rang aus — PPs/MVS entscheiden nicht mehr
    // ueber den Rahmen.
    expect(cardText).toContain("const starTier = getPlayerStarTier(effectiveOvrRank);");
    expect(cardText).toContain("resolveLeagueRankFromPool(playerOvr, resolvedHeatPools.ovr)");
    expect(cardText).toContain("getPlayerStarTierClassName(starTier)");
    expect(cardText).toContain('isHoloPlayerStarTier(starTier) ? "is-star-holo" : ""');
    expect(cardText).toContain("data-star-tier={starTier ?? undefined}");
    // Die alte "beste der drei Kennzahlen"-Funktion ist komplett weg, nicht nur
    // hier unbenutzt — sonst könnte sie versehentlich wieder aufgerufen werden.
    expect(cardText).not.toContain("getBestPlayerStarTier");

    // Die Preview rendert dieselbe Karte — daher kein zweiter Renderpfad nötig.
    const previewText = read("components/foundation/player-portrait-card/FoundationPlayerPortraitPreview.tsx");
    expect(previewText).toContain("FoundationPlayerPortraitCard");
  });

  it("getBestPlayerStarTier gibt es nicht mehr", () => {
    const tierLibText = read("lib/foundation/player-star-tier.ts");
    expect(tierLibText).not.toContain("getBestPlayerStarTier");
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

  it("nutzt in den Bestenlisten den mitgeführten OVR-Rang, NICHT den Listen-Rang der jeweiligen Kategorie", () => {
    const leadersText = read("app/foundation/league-leaders-v2/LeagueLeadersNewLook.tsx");
    // Gilt jetzt für JEDE Kategorie (auch PP Pow/Training), weil `entry.ovrRank`
    // immer der echte ligaweite OVR-Rang ist — unabhängig davon, wonach die
    // Liste selbst sortiert.
    expect(leadersText).toContain("function getLeaderStarTier(ovrRank: number | null | undefined) {");
    expect(leadersText).toContain("getLeaderStarTier(leader.ovrRank)");
    expect(leadersText).toContain("getLeaderStarTier(entry.ovrRank)");
  });

  it("rahmt die Top-Spieler-Strips des Saisonstands über deren OVR-Rang ein, NICHT über den PPs-Listen-Rang", () => {
    const standingsText = read("app/foundation/season-v2/SeasonStandingsNewLook.tsx");
    expect(standingsText).toContain("PlayerStarFrame tier={getPlayerStarTier(player.ovrRank)}");
  });

  it("laesst die Scouting-Portraits bewusst ohne Rahmen (Fog-of-War)", () => {
    const scoutText = read("app/foundation/scouting-center-v2/ScoutingCenterV2NewLook.tsx");
    // Ein Star-Rahmen an einem ungescouteten Spieler wuerde genau die
    // Einordnung verraten, die der Fog verdeckt — deshalb steht dort keiner.
    expect(scoutText).not.toContain("PlayerStarFrame");
    expect(scoutText).not.toContain("getPlayerStarTier");
  });

  it("deklariert die Tier-Farben auch auf :root, sonst bleiben Portale farblos", () => {
    const cssText = read("app/globals.css");
    // Die Hover-Portraitkarte rendert per createPortal an document.body und ist
    // damit KEIN Nachfahre von `.is-new-look`. Lagen die Farben nur dort, loeste
    // `var(--nl-diamond)` ins Leere auf, die `outline`-Deklaration wurde
    // ungueltig und es erschien ueberhaupt kein Rahmen.
    const rootBlock = cssText.match(/:root \{[^}]*--nl-diamond[^}]*\}/s);
    expect(rootBlock).not.toBeNull();
    expect(rootBlock?.[0]).toContain("--nl-gold");
    expect(rootBlock?.[0]).toContain("--nl-silver");
    expect(rootBlock?.[0]).toContain("--nl-bronze");
  });

  it("traegt den animierten Glanzring — mit Rueckfallebene ohne Masken-Support", () => {
    const cssText = read("app/globals.css");
    expect(cssText).toContain("@keyframes nlStarRimSweep");
    expect(cssText).toContain("mask-composite: exclude");
    // Ohne Masken wuerde der Verlauf die ganze Karte ueberdecken statt nur den Rand.
    expect(cssText).toContain("@supports not ((mask-composite: exclude) or (-webkit-mask-composite: xor))");
  });

  it("rahmt das Portrait in der tatsaechlich gerenderten Spielertabelle ein", () => {
    // Es gibt zwei Tabellen-Dateien; gerendert wird FoundationPlayersTableNewLook
    // (dynamisch aus FoundationShellRouterBody). Die andere zu bearbeiten aendert
    // sichtbar nichts.
    const tableText = read("app/foundation/players-table/FoundationPlayersTableNewLook.tsx");
    expect(tableText).toContain("<PlayerStarFrame");
    // Die Tabelle kennt den echten OVR-Rang und uebergibt die Stufe direkt, statt sie
    // aus dem Liga-Heat-Pool zu naehern (die Naeherung lieferte hier dauerhaft null).
    expect(tableText).toContain("tier={getPlayerStarTier(row.ovrRank)}");
  });

  it("bringt Tier-Farben und Holo-Regeln als Design-Tokens mit", () => {
    const cssText = read("app/globals.css");
    expect(cssText).toContain("--nl-diamond:");
    expect(cssText).toContain(".foundation-player-portrait-card.is-star-tier-diamond");
    expect(cssText).toContain(".foundation-player-portrait-card.is-star-holo::after");
    expect(cssText).toContain("@keyframes nlStarHoloSweep");
    // Bewegung ist Zierde, keine Information.
    expect(cssText).toContain("@media (prefers-reduced-motion: reduce)");
    // 24–32px-Thumbnails bekommen einen dünneren Ring, sonst frisst der
    // Standard-2px-Ring das kleine Portrait.
    expect(cssText).toContain(".is-new-look .nl-star-frame.is-size-sm");
  });
});
