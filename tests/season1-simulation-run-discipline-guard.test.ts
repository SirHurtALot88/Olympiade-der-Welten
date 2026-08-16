import { describe, expect, it } from "vitest";

import { evaluateDisciplineRowGuard } from "@/scripts/season1-simulation-run";

// Der Fund, der diesen Test ausgeloest hat: im Trockenlauf meldete
// `season1-simulation-run.ts` je Spieltag `resolvedTeams: 32, blockers: [], disciplineRows: 0`
// -- ein Spieltag ohne eine einzige gewertete Zeile sah wie ein aufgeloester Spieltag aus.
// Die Ursache lag tiefer als der Trockenlauf: `LegacyMatchdayResultApplyService` meldet
// `ok: true, applied: true` allein danach, ob die Preview "ready" war, nicht danach, ob
// tatsaechlich Disziplin-Zeilen geschrieben wurden (siehe `buildBlockingReasons` in
// legacy-matchday-result-apply-service.ts). `evaluateDisciplineRowGuard` ist die
// nachtraeglich eingebaute Zusicherung im Skript: 0 geschriebene Zeilen sind ein Blocker,
// kein Erfolg -- unabhaengig davon, was der Service selbst behauptet.
describe("evaluateDisciplineRowGuard", () => {
  it("blockiert einen Spieltag ohne eine einzige geschriebene Disziplin-Zeile", () => {
    expect(evaluateDisciplineRowGuard("matchday-3", 0)).toBe("zero_discipline_rows:matchday-3");
  });

  it("laesst einen Spieltag mit tatsaechlich geschriebenen Zeilen durch", () => {
    expect(evaluateDisciplineRowGuard("matchday-3", 64)).toBeNull();
  });

  it("blockiert nur bei exakt 0 Zeilen, nicht bei kleinen Zahlen (kein Off-by-one)", () => {
    expect(evaluateDisciplineRowGuard("matchday-1", 1)).toBeNull();
  });
});
