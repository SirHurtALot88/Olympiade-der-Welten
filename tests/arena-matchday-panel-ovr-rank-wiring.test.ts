import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getPlayerStarTier } from "@/lib/foundation/player-star-tier";

const ARENA = readFileSync(
  join(process.cwd(), "app/foundation/discipline-stage/DisciplineStageArena.tsx"),
  "utf8",
);

/**
 * Die Spieler-Chips der Spieltags-Wertung brauchen den ligaweiten OVR-Rang, sonst
 * kann das Panel keine Stufe ableiten. Diese Suite haelt die zwei Zusagen fest, die
 * man beim Durchreichen leicht falsch macht.
 */
describe("Arena: OVR-Rang für die Spieltags-Wertung", () => {
  it("nimmt den Rang aus der ligaweiten Rating-Map, nicht aus einer eigenen Rechnung", () => {
    // `ratingByPlayerId` gibt es in der Bühne längst (Hover-Vorschau, Top-Spieler).
    expect(ARENA).toContain("ovrRank: ratingByPlayerId.get(e.playerId)?.ovrRank ?? null,");
    // Und die Zeile muss neu berechnet werden, wenn sich die Map ändert.
    expect(ARENA).toContain("}, [preview, gameState, matchdayId, briefingItems, standingsItems, ratingByPlayerId]);");
  });

  it("baut die Rating-Map OHNE playerIds-Filter", () => {
    // Mit `{ playerIds: … }` schrumpft der Normalisierungs- UND Rang-Pool auf die
    // uebergebenen Spieler: aus "Top 50 der Liga" wuerde "Top 50 der Eingesetzten",
    // und jeder zweite Chip truege einen Rahmen.
    expect(ARENA).toContain("return buildPlayerRatingContractMap(gameState);");
    expect(ARENA).not.toMatch(/buildPlayerRatingContractMap\(gameState,[^)]*playerIds/);
  });

  it("hält die Bühne von einer zweiten Schwellen-Tabelle frei", () => {
    // Die Bühne reicht den RANG durch; welche Stufe daraus wird, entscheidet
    // ausschliesslich `lib/foundation/player-star-tier.ts`.
    expect(ARENA).not.toContain("is-star-tier-");
    expect(getPlayerStarTier(50)).toBe("bronze");
    expect(getPlayerStarTier(51)).toBeNull();
  });

  it("macht aus 'kein Disziplin-Ergebnis' keine erfundene 0", () => {
    // `?? 0` liess `d1Points` nie null werden. Folge: die Spieltags-Wertung zeigte in
    // der Disziplin-Zeile eine 0, die niemand berechnet hatte, und die Aufdeck-Regel
    // `teamResults.some((row) => row.d1Points != null)` konnte gar nicht mehr greifen.
    expect(ARENA).toContain("const d1Points = d1 ? d1PointsByTeam.get(r.teamId) ?? null : null;");
    expect(ARENA).toContain("const d2Points = d2 ? d2PointsByTeam.get(r.teamId) ?? null : null;");
    // Die Spieltags-Summe bleibt eine Zahl — dort ist "unbekannt" als 0 richtig,
    // weil sie ueber beide Disziplinen aufaddiert.
    expect(ARENA).toContain("totalPoints: (d1Points ?? 0) + (d2Points ?? 0),");
  });
});
