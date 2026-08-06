/**
 * GEMELDET: „nein das ist mein save und da wurden die schon wieder bei mir rein gepickt"
 *
 * Das „schon wieder" ist der Kern: derselbe Fehler stand ZWEIMAL im Code, und beim ersten Mal war
 * nur die Client-Haelfte behoben.
 *
 * BEFUND (aus dem Plan von Fable, jede Stelle nachgelesen):
 *
 *   1. `app/api/ai/preseason-background/route.ts`, `shouldRunSetupDraft` — prueft
 *      `season-1 && gamePhase === "preseason_management"` OHNE Spieltagsergebnis-Check. Weil
 *      `preseason_management` sowohl „frischer Aufbau" als auch „erste Station jedes Saisonendes"
 *      bedeutet, feuerte der komplette Setup-Draft am Saisonende ein zweites Mal.
 *
 *   2. `lib/ai/ai-market-plan-apply-service.ts` — der Engpass, durch den ALLE
 *      KI-Marktschreibvorgaenge laufen, hatte keinerlei Phasenpruefung. `applyBuySteps` ist per
 *      Default `true`, und kein Aufrufer (Cockpit, Preseason-Hintergrundlauf, Konvergenz) setzt es
 *      ausdruecklich. Der vorhandene Haken `isTransferActionAllowed(..., "season_end_market_buy")`
 *      gibt seit dem Wegfall der Saison-1-Sonderregel immer `true` zurueck und sperrt nichts mehr.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isSeasonEndPhase } from "@/lib/season/season-transition-chain";

const lies = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

describe("Am Saisonende wird weder gedraftet noch gekauft", () => {
  it("das Server-Gate fuer den Setup-Draft fragt nach Spieltagsergebnissen", () => {
    const text = lies("app/api/ai/preseason-background/route.ts");
    const start = text.indexOf("function shouldRunSetupDraft");
    expect(start, "shouldRunSetupDraft nicht gefunden — umbenannt?").toBeGreaterThan(-1);
    const block = text.slice(start, text.indexOf("\n}", start));
    // Ohne diese Bedingung ist der Setup-Draft am Saisonende von Saison 1 scharf.
    expect(block).toContain("matchdayResults");
  });

  it("der Markt-Apply sperrt Kaeufe, solange der Spielstand in der alten Saison steht", () => {
    const text = lies("lib/ai/ai-market-plan-apply-service.ts");
    expect(text, "keine Phasenpruefung im Markt-Apply").toContain("isSeasonEndPhase");
    // Die Sperre muss die tatsaechlich ausgefuehrten Kaufschritte betreffen, nicht nur eine
    // Warnung erzeugen.
    const sperre = text.indexOf("isSeasonEndPhase(preflightGameState.gamePhase)");
    expect(sperre).toBeGreaterThan(-1);
    const danach = text.slice(sperre, sperre + 600);
    expect(danach).toContain("applyBuySteps: false");
    expect(danach).toContain("const executeBuySteps");
  });

  it("die Sperre wird NACH dem Laden des Spielstands ausgewertet", () => {
    // Sonst stuende die Entscheidung fest, bevor die Phase ueberhaupt bekannt ist — der Fix waere
    // wirkungslos und wuerde es doch so aussehen lassen, als griffe er.
    const text = lies("lib/ai/ai-market-plan-apply-service.ts");
    const ladePunkt = text.indexOf("const preflightGameState = preflightSave.gameState");
    const kaufEntscheidung = text.indexOf("const executeBuySteps");
    expect(ladePunkt).toBeGreaterThan(-1);
    expect(kaufEntscheidung, "executeBuySteps wird vor dem Laden entschieden").toBeGreaterThan(ladePunkt);
  });

  it("und sie deckt jede Station der Saisonende-Kette ab, nicht nur eine Phase", () => {
    // `isSeasonEndPhase` leitet aus der Kette ab statt aufzuzaehlen — damit gilt die Sperre auch
    // fuer Stationen, die spaeter dazukommen.
    for (const phase of ["season_completed", "season_end_management", "transfer_sell_phase", "lineup_setup"] as const) {
      expect(isSeasonEndPhase(phase), `${phase} muss als Saisonende gelten`).toBe(true);
    }
    // Gegenrichtung: die laufende Saison ist kein Saisonende, dort darf gekauft werden.
    expect(isSeasonEndPhase("season_active")).toBe(false);
  });
});
