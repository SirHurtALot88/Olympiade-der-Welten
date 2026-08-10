import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

// FoundationPageClient.tsx is now a 25-line wrapper; this UI lives in
// FoundationCockpitPanel.tsx, with the transition/completion fetch calls in
// cockpit-handlers.ts, and the blocker-reason constant in
// use-foundation-cross-tab-season-briefing.ts.
const cockpitPanelPath = path.join(process.cwd(), "app/foundation/cockpit-v2/FoundationCockpitPanel.tsx");
const cockpitHandlersPath = path.join(process.cwd(), "lib/foundation/tabs/cockpit-handlers.ts");
const seasonBriefingPath = path.join(
  process.cwd(),
  "lib/foundation/tabs/use-foundation-cross-tab-season-briefing.ts",
);
const typesPath = path.join(process.cwd(), "lib/data/olyDataTypes.ts");

describe("season transition ui contract", () => {
  it("exposes game phases, close-season button and preview-first wizard", async () => {
    const [panelText, handlersText, seasonBriefingText, typeText] = await Promise.all([
      fs.readFile(cockpitPanelPath, "utf8"),
      fs.readFile(cockpitHandlersPath, "utf8"),
      fs.readFile(seasonBriefingPath, "utf8"),
      fs.readFile(typesPath, "utf8"),
    ]);
    const fileText = `${panelText}\n${handlersText}\n${seasonBriefingText}`;

    expect(typeText).toContain('export type GamePhase');
    expect(typeText).toContain('"season_active"');
    expect(typeText).toContain('"season_review"');
    expect(typeText).toContain('"season_rewards"');
    expect(typeText).toContain('"player_development"');
    // Beide Namen muessen im Typ stehen: `season_end_management` ist die Station des Saisonendes,
    // `preseason_management` nur noch der frische Aufbau, den Altstaende tragen. Sie zu einem Namen
    // zusammenzuziehen war genau der Fehler, den diese Trennung behebt.
    expect(typeText).toContain('"season_end_management"');
    expect(typeText).toContain('"preseason_management"');
    expect(typeText).toContain('"transfer_sell_phase"');
    expect(typeText).toContain('"transfer_buy_phase"');
    expect(typeText).toContain('"lineup_setup"');
    expect(typeText).toContain('"next_season_ready"');
    expect(typeText).toContain("seasonTransition?: SeasonTransitionState");

    expect(fileText).toContain("Saison abschließen");
    expect(fileText).toContain("last_matchday_not_completed");
    expect(fileText).toContain("Saisonabschluss & Review");
    expect(fileText).toContain("Assistent previewen");
    expect(fileText).toContain("Abschluss prüfen");
    expect(fileText).toContain("Der echte Write läuft atomar mit Recovery");
    expect(fileText).toContain("/api/season/transition");
    expect(fileText).toContain("/api/season/completion");
    expect(fileText).toContain("Transition currentStep");
    expect(fileText).toContain("AI Einsatz-Audit");
    expect(fileText).toContain("season-completion-board");
    expect(fileText).toContain("Weiter");
    expect(fileText).toContain("seasonReview");
    expect(fileText).toContain("objectiveSettlement");
    expect(fileText).toContain("season-review-objective-settlement");
    expect(fileText).toContain("Board-Ziele");
    expect(fileText).toContain('data-testid="season-review-preview"');
    expect(fileText).toContain("Weiter zu Finanzen");
  });
});
