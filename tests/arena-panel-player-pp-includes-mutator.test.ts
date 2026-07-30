import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveAwardedPlayerPoints } from "@/lib/foundation/player-points-total";

const REPO_ROOT = process.cwd();
const ARENA = readFileSync(join(REPO_ROOT, "app/foundation/discipline-stage/DisciplineStageArena.tsx"), "utf8");
const PANEL = readFileSync(
  join(REPO_ROOT, "app/foundation/discipline-stage/DisciplineStageMatchdayPanel.tsx"),
  "utf8",
);
const LEDGER = readFileSync(join(REPO_ROOT, "lib/foundation/season-points-ledger.ts"), "utf8");

/**
 * In der Spieltags-Wertung ergab die Summe der Spieler-PPs die BASIS-PP des Teams statt des
 * Gesamtwerts — der Mutator-Bonus fehlte, obwohl der Chip-Tooltip "davon ◆ X Mutator"
 * behauptete, er sei enthalten. Ursache: die Resolve-Engine fuehrt `pointsAwarded`
 * (verteilter Basis-Anteil) und `mutatorPpsBonus` als GETRENNTE Felder.
 *
 * Die Addition liegt inzwischen in `resolveAwardedPlayerPoints` — diese Suite prueft
 * deshalb das Verhalten des Helfers und dass die Buehne ihn benutzt, statt eine
 * Schreibweise festzuschreiben.
 */
describe("Arena-Spieltagswertung: Spieler-PP enthält den Mutator-Bonus", () => {
  it("addiert den Mutator-Bonus auf die Basis-PP", () => {
    expect(resolveAwardedPlayerPoints({ pointsAwarded: 3.7, mutatorPpsBonus: 0.3 })).toBe(4);
  });

  it("liefert null, solange weder Basis noch Bonus vorliegen", () => {
    // Kein 0 fuer "noch nicht aufgedeckt" — sonst bricht der Spoiler-Schutz der Buehne.
    expect(resolveAwardedPlayerPoints({ pointsAwarded: null, mutatorPpsBonus: null })).toBeNull();
    // Nur ein Bonus ohne Basis ist trotzdem eine Gutschrift.
    expect(resolveAwardedPlayerPoints({ pointsAwarded: null, mutatorPpsBonus: 0.3 })).toBe(0.3);
  });

  it("rundet wie der Ledger, damit nichts auseinanderlaeuft", () => {
    expect(resolveAwardedPlayerPoints({ pointsAwarded: 0.1, mutatorPpsBonus: 0.2 })).toBe(0.3);
  });

  it("wird von der Buehne benutzt, statt `pointsAwarded` allein zu lesen", () => {
    expect(ARENA).toContain("resolveAwardedPlayerPoints({ pointsAwarded: basePp, mutatorPpsBonus: mutatorPp })");
    expect(ARENA).not.toContain("pp: e.pointsAwarded ?? null,");
  });

  it("folgt damit derselben Definition wie der Saison-Ledger", () => {
    // Bühne UND Ledger rechnen über denselben Helfer — nicht über zwei Formeln, die
    // zufällig übereinstimmen. Genau das war die Drift-Gefahr.
    expect(LEDGER).toContain("resolveAwardedPlayerPoints({ pointsAwarded: derivedPoints, mutatorPpsBonus })");
  });

  it("behält die Beschriftung, die dadurch wieder stimmt", () => {
    expect(PANEL).toContain("· davon ◆ ${entry.mutatorPp.toFixed(1)} Mutator");
  });
});
