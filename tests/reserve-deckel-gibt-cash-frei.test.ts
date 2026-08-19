/**
 * DIE KI-RESERVEN DUERFEN NICHT DEN GANZEN KONTOSTAND FRESSEN.
 *
 * GEMELDET VON CHRIS (`nl5eju`): „in Season 2 hat IMMERNOCH kein einziges team in gebäude
 * investiert - was mich zb bei T-T wundert wenn die so auf entwicklung von spielern setzen müsste
 * wenigstens mal 1 lvl in academy gehen".
 *
 * BEFUND: die KI WILL bauen — 95 von 108 Planzeilen lagen ueber der Bau-Schwelle, 86 davon standen
 * trotzdem auf `skip`. Es lag NICHT am Bau-Topf (Teams mit freiem Cash, aber 0 Baubudget: keine),
 * sondern eine Ebene tiefer: 28 von 32 Teams hatten null freies Cash, obwohl G-G 35,6 auf dem
 * Konto hatte, C-S 21,7, A-A 16,7.
 *
 * URSACHE: `salaryReserve` ist die VOLLE Gehalts-Runway — absolut, ohne Bezug zum Kontostand. Wo
 * die Runway groesser ist als das Konto, bleibt nach `max(0, …)` nichts uebrig. Die Reserve
 * schuetzt dort nichts (das Geld ist ohnehin nicht da) und verhindert nur jede Investition.
 *
 * CHRIS' ENTSCHEIDUNG (Weg 1 von drei): Reserven als Anteil des Kontostands deckeln.
 *
 * DER WERT IST GEMESSEN (`scripts/messe-reserve-deckel.ts`, Sweep ueber alle Live-Spielstaende):
 * 0,90 aendert nichts, von 0,75 auf 0,60 liegt der groesste Sprung, 0,50 bringt kaum mehr und
 * nimmt echten Schutz weg. Die Zahl der Teams, die nach dem Plan ins Minus geraten wuerden, blieb
 * ueber den gesamten Bereich konstant — der Deckel schafft keine neue Zahlungsunfaehigkeit.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { AI_RESERVE_SHARE_OF_CASH_CAP } from "@/lib/ai/ai-team-management-preview-service";

const QUELLE = readFileSync(join(process.cwd(), "lib/ai/ai-team-management-preview-service.ts"), "utf8");

describe("Der Reserve-Deckel", () => {
  it("steht auf dem gemessenen Wert", () => {
    expect(AI_RESERVE_SHARE_OF_CASH_CAP).toBe(0.6);
  });

  it("liegt in einem Bereich, in dem er ueberhaupt greift", () => {
    // Oberhalb von ~0,9 aendert der Deckel messbar NICHTS (Sweep: 0,90 identisch zu 1,00). Ein
    // Wert dort waere eine Zeile, die aussieht als taete sie etwas.
    expect(AI_RESERVE_SHARE_OF_CASH_CAP).toBeLessThan(0.9);
    // Und er darf den Schutz nicht ganz aushebeln.
    expect(AI_RESERVE_SHARE_OF_CASH_CAP).toBeGreaterThanOrEqual(0.5);
  });

  it("deckelt Gehalts- UND Cash-Reserve zusammen, nicht einzeln", () => {
    // Einzeln gedeckelt bliebe die Summe wieder groesser als der Kontostand — genau der Zustand,
    // der gemeldet wurde.
    expect(QUELLE).toContain("Math.min(\n    salaryReserve + cashReserve,");
  });

  it("das freie Cash rechnet gegen die GEDECKELTEN Reserven", () => {
    // Der Riegel gegen den Rueckfall: stuende hier wieder `- salaryReserve - … - cashReserve`,
    // waere der Deckel eine unbenutzte Variable.
    expect(QUELLE).toContain(
      "const rawFreeCash = Math.max(0, cash - gedeckelteReserven - maintenanceBudget - emergencyBudget);",
    );
    expect(QUELLE).not.toContain(
      "const rawFreeCash = Math.max(0, cash - salaryReserve - maintenanceBudget - emergencyBudget - cashReserve);",
    );
  });

  it("der Deckel senkt keine Reserve, die aus dem Kontostand gedeckt ist", () => {
    // `Math.min` greift nur, wenn die Reserve groesser ist als der erlaubte Anteil. Ein Team mit
    // viel Cash und kleiner Gehaltslast bleibt unveraendert — das ist die ganze Absicht.
    const cash = 100;
    const kleineReserve = 10;
    expect(Math.min(kleineReserve, cash * AI_RESERVE_SHARE_OF_CASH_CAP)).toBe(kleineReserve);
    const grosseReserve = 95;
    expect(Math.min(grosseReserve, cash * AI_RESERVE_SHARE_OF_CASH_CAP)).toBe(60);
  });

  it("ein negativer Kontostand erzeugt keinen negativen Deckel", () => {
    // Ohne `Math.max(0, cash)` waere die Obergrenze bei Minus-Cash negativ, und `Math.min` liesse
    // die Reserve auf einen negativen Wert fallen — freies Cash aus dem Nichts.
    expect(QUELLE).toContain("Math.max(0, cash) * AI_RESERVE_SHARE_OF_CASH_CAP");
  });
});
