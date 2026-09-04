import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * GEMELDET VON CHRIS (04.09.): „man muss das spiel mit leertaste pausieren koennen ohne dass der
 * season flow weitergeht!" — waehrend eines laufenden Kampfs auf der Battle-Arena-Ansicht loeste
 * Leertaste `triggerGlobalNext()` aus und navigierte weg (View wechselte zu `seasonV2`), weil
 * `battleArena` im globalen Leertaste-Handler (use-foundation-shell-router-body-scope.tsx) NICHT
 * in der Ausnahmeliste `activeViewHandlesOwnSpace` stand — anders als `matchdayArena`, das schon
 * lange korrekt blockiert. Der Kampf-Entwurf selbst (public/mockups/battle-mode.engine.js) haengt
 * keinen eigenen globalen Leertaste-Handler ein, der das haette abfangen koennen: JEDER
 * Leertaste-Druck auf dieser Ansicht fiel deshalb ungebremst durch.
 *
 * Nachgemessen per Playwright gegen den echten Dev-Server (Save mit echten Teams, `?view=battleArena`):
 * vor dem Fix wechselte `activeView` nach einem einzelnen Leertaste-Druck von `battleArena` auf
 * `seasonV2`; nach dem Fix bleibt sie unveraendert.
 *
 * Diese Zusicherung prueft nur die WIRKUNG (Ausnahmeliste enthaelt `battleArena`), nicht das
 * Interne der Komponente — dieselbe Grenze wie bei den anderen Vertraegen ueber diese Datei
 * (siehe `game-inbox-ui-contract.test.ts`), weil die Datei kein isoliert testbares Modul ist.
 */
describe("Leertaste auf der Battle Arena loest keinen Season-Flow-Sprung aus", () => {
  it("zaehlt battleArena zu den Ansichten, die ihre eigene Leertaste selbst behandeln", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
      "utf8",
    );
    const match = source.match(/const activeViewHandlesOwnSpace =\s*([^;]+);/);
    expect(match, "activeViewHandlesOwnSpace-Zuweisung nicht gefunden").not.toBeNull();
    const expression = match![1];
    // Dieselbe Ausnahme wie fuer die echte, gewertete Arena (`matchdayArena`) muss auch fuer den
    // Battle-Arena-Entwurf gelten — sonst bleibt genau diese eine Ansicht die Luecke.
    expect(expression).toContain('activeView === "matchdayArena"');
    expect(expression).toContain('activeView === "battleArena"');
  });
});
