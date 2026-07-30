/**
 * GEMELDET AUS DEM SPIEL: "Du bist bei Spieltag 7 blockiert" — kein Weg, den Spieltag aus dem
 * normalen Spielverlauf abzuschliessen; der "Weiter"-Knopf landete im Cockpit.
 *
 * Die urspruengliche Diagnose lautete, #224 habe den Abschluss-Knopf entfernt und den Ersatz nie
 * verdrahtet. Das war nicht die Ursache: der Ersatz IST verdrahtet
 * (DisciplineStageNativeArena.onEnded -> commitFinishedDiscipline -> onCommitDiscipline ->
 * commitArenaDiscipline), und der "Spieltag abschliessen"-Knopf existiert im Spieltagsergebnis.
 *
 * Die Ursache war ein Gate: `advance_to_next_matchday` steht auf "ready", wenn ein Ergebnis
 * vorliegt — und auf "warning", sobald das Board `board_objectives_failed` meldet, also die
 * Saisonziele gerissen sind. Beide Verbraucher fragten auf `status === "ready"` ab. Ein Team mit
 * gerissenen Saisonzielen bekam damit weder den Knopf im Spieltagsergebnis noch ein funktionierendes
 * globales "Weiter" — und ein gerissenes Saisonziel ist eine MITTEILUNG, kein Hindernis: gewertet
 * ist der Spieltag in beiden Faellen identisch.
 *
 * `resolveGameFlowActionStep` selbst hat "warning" ueber `isReadyLike` immer als handlungsfaehig
 * behandelt — nur die Verbraucher taten es nicht. Genau diese Luecke pruefen die Tests hier.
 */
import { describe, expect, it } from "vitest";

import type { GameFlowStep } from "@/lib/foundation/game-flow-controller";
import {
  canAdvanceMatchdayFromStep,
  resolveGameFlowActionStep,
} from "@/lib/foundation/resolve-game-flow-action-step";

const step = (partial: Partial<GameFlowStep>): GameFlowStep =>
  ({
    stepId: "advance_to_next_matchday",
    label: "Zum naechsten Spieltag",
    cta: "Weiter",
    status: "ready",
    targetView: "cockpit",
    teamId: "C-C",
    blockers: [],
    warnings: [],
    optional: false,
    ...partial,
  }) as GameFlowStep;

describe("Spieltagswechsel — das Gate laesst niemanden mehr haengen", () => {
  it("bei ready darf gewechselt werden", () => {
    expect(canAdvanceMatchdayFromStep(step({ status: "ready" }))).toBe(true);
  });

  /** DER GEMELDETE FALL: Saisonziele gerissen -> "warning". Vorher hier `false`. */
  it("bei warning (Saisonziele gerissen) darf ebenfalls gewechselt werden", () => {
    expect(
      canAdvanceMatchdayFromStep(step({ status: "warning", warnings: ["board_objectives_failed"] })),
    ).toBe(true);
  });

  it("ohne Ergebnis (blocked) darf NICHT gewechselt werden", () => {
    expect(canAdvanceMatchdayFromStep(step({ status: "blocked", blockers: ["missing_results"] }))).toBe(false);
  });

  it("ein anderer Schritt loest den Wechsel nicht aus, auch nicht auf ready", () => {
    expect(canAdvanceMatchdayFromStep(step({ stepId: "review_matchday_results", status: "ready" }))).toBe(false);
  });

  /**
   * Die Klammer um beide Seiten: der Resolver macht den Schritt bei "warning" zum Aktionsschritt.
   * Wenn das Gate ihn dann ablehnt, zeigt die Oberflaeche einen Aktionsschritt an, den niemand
   * ausloesen kann — exakt die gemeldete Blockade.
   */
  it("was der Resolver zum Aktionsschritt macht, muss das Gate auch zulassen", () => {
    for (const status of ["ready", "warning"] as const) {
      const advance = step({ status });
      const resolved = resolveGameFlowActionStep([advance], advance, new Set());
      expect(resolved.stepId, `status=${status}`).toBe("advance_to_next_matchday");
      expect(canAdvanceMatchdayFromStep(resolved), `status=${status} ist Aktionsschritt, aber gesperrt`).toBe(true);
    }
  });
});
