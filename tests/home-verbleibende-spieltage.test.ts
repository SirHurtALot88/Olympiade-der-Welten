/**
 * Durchklick-Test-Befund G3 · Home: „verbleibend 3 Spieltage" vor Spieltag 1
 * einer Zehn-Spieltage-Saison.
 *
 * Ursache: HomeV2NewLook rechnete auf `scheduleItems` — dem 4-Elemente-FENSTER
 * des Spieltag-Steppers (use-home-v2-overview-derivations slice(current,
 * current+4)) — statt auf dem echten Spielplan, und zählte den aktuellen,
 * ungespielten Spieltag als gespielt (`isPast || isCurrent`) → 4−1=3.
 *
 * Fix: Saisonlänge kommt als `seasonMatchdayTotal` (gameState.season.
 * matchdayIds.length) herein, „gespielt" sind die GEWERTETEN Spieltage
 * (Feld-Rennen-Ledger — dieselbe Quelle wie der Form-Strip).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const HOME = readFileSync(join(process.cwd(), "app/foundation/home-v2/HomeV2NewLook.tsx"), "utf8");
const TYPES = readFileSync(join(process.cwd(), "app/foundation/home-v2/home-v2-types.ts"), "utf8");
const ROUTER = readFileSync(join(process.cwd(), "app/foundation/FoundationShellRouterBody.tsx"), "utf8");

describe("G3: Verbleibende Spieltage rechnen auf dem echten Spielplan", () => {
  it("die Saisonlänge ist ein eigener Prop und kommt aus season.matchdayIds", () => {
    expect(TYPES).toContain("seasonMatchdayTotal?: number | null");
    expect(ROUTER).toContain("seasonMatchdayTotal: gameState.season.matchdayIds.length");
  });

  it("der Stepper-Fenster-Bug ist raus: kein isPast || isCurrent mehr als „gespielt“", () => {
    expect(HOME).not.toContain("item.isPast || item.isCurrent");
    expect(HOME).not.toContain("scheduleItems.length - playedMatchdayCount");
  });

  it("gespielt = gewertete Spieltage, verbleibend = Spielplan − gespielt", () => {
    expect(HOME).toContain("fieldRacePlayedMatchdays ?? scheduleItems.filter((item) => item.isPast).length");
    expect(HOME).toContain("Math.max(0, seasonMatchdayTotal - playedMatchdayCount)");
  });

  it("bei 0 wird erklärt, nicht versteckt: Ø-Punkte-Chip erklärt den Strich", () => {
    expect(HOME).toContain("füllt sich ab Spieltag 1");
  });
});
