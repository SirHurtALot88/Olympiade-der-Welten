import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const ARENA = readFileSync(join(REPO_ROOT, "app/foundation/discipline-stage/DisciplineStageArena.tsx"), "utf8");
const PANEL = readFileSync(
  join(REPO_ROOT, "app/foundation/discipline-stage/DisciplineStageMatchdayPanel.tsx"),
  "utf8",
);
const LEDGER = readFileSync(join(REPO_ROOT, "lib/foundation/season-points-ledger.ts"), "utf8");

/**
 * In der Spieltags-Wertung der Arena klappt eine Team-Zeile die beteiligten Spieler mit
 * ihren PPs auf. Deren Summe ergab die BASIS-PP des Teams, nicht den Gesamtwert — der
 * Mutator-Bonus fehlte. Der Chip-Tooltip behauptete aber "davon ◆ X Mutator", also dass
 * der Bonus bereits enthalten sei. Zahl und Beschriftung widersprachen sich, und die
 * Summe ging nicht auf: 1,4 + 1,3 + 1,1 gegen einen Gesamtwert von 4,0.
 *
 * Ursache: die Resolve-Engine führt `pointsAwarded` (verteilter Basis-Anteil) und
 * `mutatorPpsBonus` als GETRENNTE Felder; die Panel-Zeile las nur das erste.
 */
describe("Arena-Spieltagswertung: Spieler-PP enthält den Mutator-Bonus", () => {
  it("addiert den Mutator-Bonus auf die Basis-PP des Spielers", () => {
    expect(ARENA).toContain("const basePp = e.pointsAwarded ?? null;");
    expect(ARENA).toContain("const mutatorPp = e.mutatorPpsBonus ?? null;");
    expect(ARENA).toContain("Number(((basePp ?? 0) + (mutatorPp ?? 0)).toFixed(4))");
    // Der alte, base-only Ausdruck darf nicht zurückkommen.
    expect(ARENA).not.toContain("pp: e.pointsAwarded ?? null,");
  });

  it("liefert null, solange weder Basis noch Bonus vorliegen", () => {
    // Kein 0 für "noch nicht aufgedeckt" — die Zelle soll leer bleiben, nicht 0,0 zeigen.
    expect(ARENA).toContain("basePp == null && mutatorPp == null");
  });

  it("folgt damit derselben Definition wie der Saison-Ledger", () => {
    // Kanonisch: points = basePoints + mutatorPpsBonus. Die Arena darf davon nicht abweichen,
    // sonst zeigt dieselbe Kennzahl je nach Ansicht zwei verschiedene Zahlen.
    expect(LEDGER).toContain("points: roundValue(derivedPoints + mutatorPpsBonus, 4),");
  });

  it("behält die Beschriftung, die jetzt wieder stimmt", () => {
    // "davon" ist erst korrekt, seit der Bonus in der PP-Zahl steckt.
    expect(PANEL).toContain("· davon ◆ ${entry.mutatorPp.toFixed(1)} Mutator");
  });
});
