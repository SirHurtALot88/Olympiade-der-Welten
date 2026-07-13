import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const foundationClientPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx";
const typesPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/data/olyDataTypes.ts";

describe("season transition ui contract", () => {
  it("exposes game phases, close-season button and preview-first wizard", async () => {
    const [fileText, typeText] = await Promise.all([
      fs.readFile(foundationClientPath, "utf8"),
      fs.readFile(typesPath, "utf8"),
    ]);

    expect(typeText).toContain('export type GamePhase');
    expect(typeText).toContain('"season_active"');
    expect(typeText).toContain('"season_review"');
    expect(typeText).toContain('"season_rewards"');
    expect(typeText).toContain('"player_development"');
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
