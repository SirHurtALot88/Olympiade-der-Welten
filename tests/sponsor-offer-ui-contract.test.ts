import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("sponsor offer ui contract", () => {
  it("renders challenge sponsor cards with axis chips and difficulty badges", async () => {
    const [foundationText, cardText, cssText, presenterText] = await Promise.all([
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/components/foundation/sponsor/SponsorOfferCard.tsx", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/sponsor/sponsor-offer-presenter.ts", "utf8"),
    ]);

    expect(foundationText).toContain("SponsorOfferCard");
    expect(foundationText).toContain('data-testid="team-sponsor-choice"');
    expect(cardText).toContain("sponsor-challenge-panel");
    expect(cardText).toContain("sponsor-axis-chip");
    expect(cardText).toContain("sponsor-difficulty");
    expect(cardText).toContain("Challenge wählen");
    expect(cssText).toContain(".sponsor-axis-pow");
    expect(cssText).toContain(".sponsor-difficulty-hart");
    expect(presenterText).toContain("buildSponsorOfferPresentation");
  });
});
