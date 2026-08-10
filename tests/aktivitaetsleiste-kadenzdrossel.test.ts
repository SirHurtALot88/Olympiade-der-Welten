/**
 * GEMELDET VON CHRIS (mit Screenshot aus Season 1, Spieltag 10): „oben die reihe ist auch noch
 * zu sehen wollten wir die nicht fixen? also mit dem status dass das spiel angeblich hängt etc"
 *
 * Die Aktivitätsleiste zeigte dauerhaft „Preseason-Markt blockiert · Teilweise blockiert ·
 * 22/30 Teams · 124 blockiert". Aufgeklappt waren alle 124 Gründe derselbe:
 * `ai_training_change_cadence_throttled`, je Team viermal (set_training_focus,
 * set_training_intensity, set_player_training_modes, set_player_training_classes) — bei 31
 * KI-Teams exakt 124.
 *
 * BEFUND: Das ist keine Störung, sondern der Anti-Cheese-Riegel aus `ai-manager-apply-service.ts`
 * (`AI_TRAINING_MIDSEASON_CADENCE_MATCHDAYS = 3`). Die KI darf ihre Trainingseinstellungen nur an
 * jedem dritten aufgelösten Spieltag ändern, sonst würde sie jeden Spieltag umstellen und die
 * Entwicklungsbalance der Liga zerfahren. An den Spieltagen dazwischen weist die Drossel die
 * Trainings-Aktionen planmäßig ab. Die Leiste meldete also roten Alarm dafür, dass eine
 * Schutzregel funktioniert — und verdeckte damit den Blick auf echte Störungen.
 *
 * Diese Datei hält beide Richtungen fest: die Drossel allein löst nichts aus, ein echter Blocker
 * dagegen schon. Ohne den zweiten Teil wäre der Fix ein Deckel über allem.
 */
import { describe, expect, it } from "vitest";

import { buildFoundationActivities } from "@/lib/foundation/foundation-activity-registry";

const IDLE = {
  isSaveBusy: false,
  aiPreseasonBusy: false,
  aiLineupEnsureBusy: false,
  aiLineupEnsure: null,
  adminSimulationBusy: false,
  adminSimulationRun: null,
  seasonTransitionBusy: false,
  preSeasonWorkflowBusy: false,
  seasonStartResetBusy: false,
  newGameBusy: false,
  rosterFillBusy: false,
  adminBalancingBusy: false,
  cockpitBusyKey: null,
  aiTeamsCount: 30,
} as const;

/** Chris' Lage: Lauf steht auf 22/30, alle Blocker sind die Kadenzdrossel. */
function throttleOnlyRun(overrides: Record<string, unknown> = {}) {
  const teamCodes = ["A-A", "B-B", "C-C", "D-L"];
  const actions = [
    "set_training_focus",
    "set_training_intensity",
    "set_player_training_modes",
    "set_player_training_classes",
  ];
  return {
    status: "completed" as const,
    mode: "season_market" as const,
    aiTeamsTotal: 30,
    aiTeamsCompleted: 22,
    transferBuysApplied: 4,
    transferSellsApplied: 47,
    managerActionsApplied: 325,
    blockingReasons: teamCodes.flatMap((code) =>
      actions.map((action) => `${code} · ${action} · ai_training_change_cadence_throttled`),
    ),
    ...overrides,
  };
}

function blockedActivity(run: ReturnType<typeof throttleOnlyRun>) {
  return buildFoundationActivities({ ...IDLE, aiPreseasonRun: run }).find(
    (activity) => activity.id === "ai-preseason-blocked",
  );
}

describe("Aktivitätsleiste · Trainings-Kadenzdrossel", () => {
  it("zeigt kein Blockiert-Banner, wenn ALLE Gründe die Drossel sind", () => {
    // Genau Chris' Screenshot: 22/30 Teams, nur gedrosselte Trainings-Aktionen.
    expect(blockedActivity(throttleOnlyRun())).toBeUndefined();
  });

  it("zeigt das Banner weiterhin, sobald ein echter Blocker dabei ist", () => {
    const run = throttleOnlyRun({
      blockingReasons: [
        "A-A · set_training_focus · ai_training_change_cadence_throttled",
        "cash_strategy_missing:B-B",
      ],
    });
    const activity = blockedActivity(run);

    expect(activity).toBeDefined();
    // Die Drossel steht nicht in der Gründe-Liste — sie erklärt nichts über die Störung.
    expect(activity?.reasons).toEqual(["cash_strategy_missing:B-B"]);
  });

  it("zählt nur echte Blocker in der Statistikzeile", () => {
    const run = throttleOnlyRun({
      blockingReasons: [
        "A-A · set_training_focus · ai_training_change_cadence_throttled",
        "A-A · set_training_intensity · ai_training_change_cadence_throttled",
        "transfer_window_buy_apply_missing",
      ],
    });
    const blockedStat = blockedActivity(run)?.stats?.find((stat) => stat.label === "blockiert");

    // 3 Gründe, davon 2 gedrosselt → die Leiste nennt 1, nicht 3.
    expect(blockedStat?.value).toBe("1");
  });

  it("lässt einen echt abgebrochenen Lauf unangetastet", () => {
    // status "failed" zeigt das Banner unabhängig von den Gründen — daran ändert der
    // Drossel-Filter nichts, sonst verschwände ein abgestürzter Lauf spurlos.
    const activity = blockedActivity(throttleOnlyRun({ status: "failed" }));

    expect(activity).toBeDefined();
    expect(activity?.currentLabel).toBe("Abgebrochen");
  });
});
