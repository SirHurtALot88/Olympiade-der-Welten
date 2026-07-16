import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("sponsor offer ui contract", () => {
  it("renders challenge sponsor cards with axis chips and difficulty badges", async () => {
    const [foundationText, sponsorsText, cardText, cssText, presenterText] = await Promise.all([
      fs.readFile(path.join(process.cwd(), "app/foundation/prize-v2/FoundationPrizeFinanceHost.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/sponsors-v2/FoundationSponsorsPanel.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "components/foundation/sponsor/SponsorOfferCard.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/globals.css"), "utf8"),
      fs.readFile(path.join(process.cwd(), "lib/sponsor/sponsor-offer-presenter.ts"), "utf8"),
    ]);

    expect(foundationText).toContain("FoundationSponsorsPanel");
    expect(sponsorsText).toContain("SponsorOfferCard");
    expect(sponsorsText).toContain('data-testid="team-sponsor-choice"');
    expect(cardText).toContain("sponsor-challenge-panel");
    expect(cardText).toContain("sponsor-axis-chip");
    expect(cardText).toContain("sponsor-difficulty");
    expect(cardText).toContain("sponsor-rank-tier-list");
    expect(cardText).toContain("Challenge wählen");
    expect(cssText).toContain(".sponsor-axis-pow");
    expect(cssText).toContain(".sponsor-difficulty-hart");
    expect(cssText).toContain(".sponsor-rank-tier-row");
    expect(presenterText).toContain("buildSponsorOfferPresentation");
    expect(presenterText).toContain("buildSponsorRankTierRows");
  });
});
