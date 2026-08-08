/**
 * GEMELDET: „warum blockieren überhaupt teams?"
 *
 * URSACHE, mit Zeile: `overlayUnifiedCompareBuyPlans` in ai-market-plan-preview-service.ts ersetzte
 * den Kaufplan durch die Picks der Unified-Engine, reichte `status`, `projectedState` und
 * `blockingReasons` aber unveraendert aus dem LEGACY-Plan durch (`...team` plus
 * `[...team.blockingReasons]`). Die Meldung beschrieb danach einen Plan, den es nicht mehr gab.
 *
 * Am Spielstand gemessen, vorher/nachher:
 *   N-N stand auf `blocked` mit „roster_after_market_plan_below_player_min" — der tatsaechlich
 *   ausgefuehrte Plan bringt den Kader aber von 3 auf 8, also GENAU auf das Minimum. Nach der
 *   Neubewertung ist N-N nicht mehr blockiert.
 *
 * Das war zugleich eine Messfalle: wer diese Felder abliest, sah den alten Stand. Mehrere
 * Aenderungen am echten Plan sahen deshalb „wirkungslos" aus, weil sie in der abgelesenen Zahl gar
 * nicht auftauchen konnten.
 *
 * Die Blocker-Regel steht jetzt EINMAL in `berechneBlockingReasons` und wird von beiden Aufrufern
 * benutzt — vorher lag sie inline in `buildTeamEntry` und war damit fuer das Overlay unerreichbar.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const QUELLE = readFileSync(
  join(process.cwd(), "lib/ai/ai-market-plan-preview-service.ts"),
  "utf8",
);
const OVERLAY = QUELLE.slice(QUELLE.indexOf("const neuerBuyPlan"), QUELLE.indexOf("return overlayed;"));

describe("Unified-Overlay: die Meldung passt zum tatsaechlichen Plan", () => {
  it("die Blocker-Regel steht an einer Stelle, nicht zweimal", () => {
    expect(QUELLE).toContain("function berechneBlockingReasons(");
    // Genau zwei Aufrufer: buildTeamEntry und das Overlay.
    expect(QUELLE.match(/berechneBlockingReasons\(\{/g)?.length).toBe(2);
  });

  it("das Overlay rechnet projectedState neu", () => {
    expect(OVERLAY).toContain("const neuerProjectedState = buildProjectedState({");
    expect(OVERLAY).toContain("buyPlan: neuerBuyPlan,");
    expect(OVERLAY).toContain("projectedState: neuerProjectedState,");
  });

  it("das Overlay bewertet die Blocker neu, statt die alten durchzureichen", () => {
    expect(OVERLAY).toContain("berechneBlockingReasons({");
    expect(OVERLAY).toContain("buyCount: unifiedBuys.length,");
    // Positiv formuliert, weil der alte Pfad im erklaerenden Kommentar woertlich zitiert wird —
    // eine Nicht-Enthalten-Zusicherung wuerde ueber die eigene Doku stolpern.
    expect(OVERLAY).toContain("blockingReasons: neueBlocker,");
    expect(OVERLAY).not.toContain("blockingReasons: unique([...team.blockingReasons");
  });

  it("auch der Status wird neu bestimmt", () => {
    expect(OVERLAY).toContain("status: getTeamStatus({");
    expect(OVERLAY).toContain("buyCandidates: unifiedBuys,");
  });

  it("die Blocker der Engine bleiben erhalten", () => {
    // `planned.blockingReasons` kommt aus der Pick-Engine und beschreibt den NEUEN Plan — der Teil
    // war nie falsch und darf nicht verlorengehen.
    expect(OVERLAY).toContain("...planned.blockingReasons,");
  });
});
