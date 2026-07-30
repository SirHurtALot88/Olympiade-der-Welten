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
  it("null/undefined sperrt (der Schritt kann fehlen)", () => {
    expect(canAdvanceMatchdayFromStep(null)).toBe(false);
    expect(canAdvanceMatchdayFromStep(undefined)).toBe(false);
  });

  /**
   * DIE ZWEITE, EIGENTLICHE URSACHE. `isReadyLike` fasst ready, warning UND blocked als "steht noch
   * offen" zusammen. Fuer die Reihenfolge war das zu grob: JEDER Nicht-Advance-Schritt aus dieser
   * Menge gewann, auch ein blockierter. Nach einem Spieltag ist aber regelmaessig etwas blockiert,
   * das erst der naechste Spieltag freigibt — "Zum naechsten Spieltag" wurde damit nie zum
   * Aktionsschritt, und der Knopf daran erschien nie.
   */
  it("ein BLOCKIERTER anderer Schritt verdraengt den Wechsel nicht mehr", () => {
    const advance = step({ status: "ready" });
    const blockedOther = step({ stepId: "set_lineup", status: "blocked", blockers: ["missing_lineup"] });
    const resolved = resolveGameFlowActionStep([blockedOther, advance], blockedOther, new Set());
    expect(resolved.stepId).toBe("advance_to_next_matchday");
    expect(canAdvanceMatchdayFromStep(resolved)).toBe(true);
  });

  it("ein HANDLUNGSFAEHIGER anderer Schritt geht weiterhin vor (unveraenderte Absicht)", () => {
    const advance = step({ status: "ready" });
    const readyOther = step({ stepId: "open_season_standings", status: "ready" });
    expect(resolveGameFlowActionStep([advance, readyOther], advance, new Set()).stepId).toBe("open_season_standings");
  });

  /**
   * Und der Knopf selbst haengt nicht mehr am Aktionsschritt: er soll erscheinen, wenn der Wechsel
   * MOEGLICH ist, nicht wenn der Flow-Coach ihn gerade empfiehlt. Deshalb wird er ueber den
   * Wechsel-Schritt gegatet (matchdayAdvanceStep), nicht ueber gameFlowActionStep.
   */
  it("der Wechsel bleibt moeglich, auch wenn der Coach etwas anderes empfiehlt", () => {
    const advance = step({ status: "ready" });
    const readyOther = step({ stepId: "open_season_standings", status: "ready" });
    const actionStep = resolveGameFlowActionStep([advance, readyOther], advance, new Set());
    // Der Coach empfiehlt den Saisonstand …
    expect(canAdvanceMatchdayFromStep(actionStep)).toBe(false);
    // … der Knopf richtet sich aber nach dem Wechsel-Schritt selbst.
    expect(canAdvanceMatchdayFromStep(advance)).toBe(true);
  });

  it("was der Resolver zum Aktionsschritt macht, muss das Gate auch zulassen", () => {
    for (const status of ["ready", "warning"] as const) {
      const advance = step({ status });
      const resolved = resolveGameFlowActionStep([advance], advance, new Set());
      expect(resolved.stepId, `status=${status}`).toBe("advance_to_next_matchday");
      expect(canAdvanceMatchdayFromStep(resolved), `status=${status} ist Aktionsschritt, aber gesperrt`).toBe(true);
    }
  });
});
