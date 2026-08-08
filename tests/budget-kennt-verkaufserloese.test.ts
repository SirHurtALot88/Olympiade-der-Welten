/**
 * GEMELDET: „warum blockieren überhaupt teams?"
 *
 * TEILBEFUND: `season1_draft_spend_budget` ergab 0 fuer Teams, die erst durch die Verkaeufe DESSELBEN
 * Plans zu Geld kommen. `buildCashStrategy` (ai-needs-picks-compare-service.ts) leitet `startingCash`
 * aus `team.cash` ab — dem Kontostand VOR den Verkaeufen. A-A stand dort mit 8.94 Mio, obwohl der
 * Plan im selben Zug fuer 118.23 Mio verkauft.
 *
 * Gemessen an Chris' Spielstand, direkt an der Engine:
 *
 *   zusaetzlichesCash=0        ->  Picks 1   season1_draft_spend_budget:0
 *   zusaetzlichesCash=118.23   ->  Picks 1   season1_draft_spend_budget:111
 *
 * WAS DAS NICHT LOEST, und das gehoert dazu: die Pick-Zahl bleibt bei 1. Das Budget war also ein
 * Symptom, nicht die Bremse — die sitzt woanders und ist noch nicht gefunden. Dieser Fix korrigiert
 * eine nachweislich falsche Rechnung, mehr nicht. Liga-weit gemessen aendert sich nichts
 * (55 Verkaeufe / 55 Kaeufe / 9 blockierte Teams, vorher wie nachher) — er schadet also auch nicht.
 *
 * DIESER TEST IST EINE VERKABELUNGS-PRUEFUNG, kein Verhaltensbeweis. Der Beweis ist die Messung
 * oben. Die Kette laeuft ueber drei Dienste und faellt sonst still auseinander, wenn jemand eine
 * Signatur anfasst.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const lies = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("Verkaufserloese erreichen das Ausgabebudget", () => {
  it("der Marktplan reicht den Erloes an die Pick-Engine weiter", () => {
    const quelle = lies("lib/ai/ai-market-plan-preview-service.ts");
    expect(quelle).toContain("zusaetzlichesCash: team.sellPlan.expectedSellValue");
  });

  it("der Unified-Planer nimmt ihn entgegen und gibt ihn weiter", () => {
    const quelle = lies("lib/ai/unified-pick-planner-service.ts");
    expect(quelle).toContain("zusaetzlichesCash?: number | null;");
    expect(quelle).toContain("zusaetzlichesCash: input.zusaetzlichesCash ?? null,");
  });

  it("der Compare-Dienst reicht ihn bis zur Cash-Strategie durch", () => {
    const quelle = lies("lib/ai/ai-needs-picks-compare-service.ts");
    // Parameter, Weitergabe an buildTeamEntry, und von dort an buildCashStrategy.
    expect(quelle).toContain("zusaetzlichesCash?: number | null;");
    expect(quelle).toContain("zusaetzlichesCash: params.zusaetzlichesCash ?? null,");
    expect(quelle).toContain("zusaetzlichesCash: input.zusaetzlichesCash ?? null,");
  });

  it("die Cash-Strategie rechnet ihn auf den Kontostand", () => {
    const quelle = lies("lib/ai/ai-needs-picks-compare-service.ts");
    expect(quelle).toContain("input.team.cash + zusaetzlichesCash");
  });

  it("ein fehlender oder unsinniger Wert aendert nichts", () => {
    // Ohne diesen Riegel wuerde ein `undefined` oder ein negativer Wert den Kontostand verfaelschen.
    const quelle = lies("lib/ai/ai-needs-picks-compare-service.ts");
    expect(quelle).toContain("Math.max(0, input.zusaetzlichesCash)");
    expect(quelle).toContain("Number.isFinite(input.zusaetzlichesCash)");
  });
});
