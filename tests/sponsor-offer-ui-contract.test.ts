import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("sponsor offer ui contract", () => {
  it("renders challenge sponsor cards with axis chips and difficulty badges (new-look)", async () => {
    const [foundationText, sponsorsText, newLookText, cardText, cssText, presenterText] = await Promise.all([
      fs.readFile(path.join(process.cwd(), "app/foundation/prize-v2/FoundationPrizeFinanceHost.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/sponsors-v2/FoundationSponsorsPanel.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/sponsors-v2/FoundationSponsorsNewLook.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "components/foundation/sponsor/SponsorOfferCardNewLook.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/globals.css"), "utf8"),
      fs.readFile(path.join(process.cwd(), "lib/sponsor/sponsor-offer-presenter.ts"), "utf8"),
    ]);

    // Der Prize-/Finanz-Host bindet den Sponsoren-Panel-Einstieg ein; der Panel
    // delegiert auf den New-Look-Renderer (Flag-aus-Legacy ist retired).
    expect(foundationText).toContain("FoundationSponsorsPanel");
    expect(sponsorsText).toContain("FoundationSponsorsNewLook");
    expect(newLookText).toContain('data-testid="team-sponsor-choice"');

    // Challenge-Karte: Achsen-Chip + Schwierigkeit + Rang-Leiter + CTA.
    expect(cardText).toContain("sponsor-challenge-panel");
    expect(cardText).toContain("nl-sponsor-axis-chip");
    expect(cardText).toContain("nl-sponsor-difficulty");
    expect(cardText).toContain("sponsor-rank-tier-list");
    expect(cardText).toContain("Challenge wählen");

    // Punkt 2: Golden-Rahmen, garantierte Boden-Stufe, Staged-Bonusziel-Leiter.
    expect(cardText).toContain("is-golden");
    expect(cardText).toContain("includeFloorRung");
    expect(cardText).toContain("sponsor-stage-ladder");

    // CSS-Contract (New-Look-Selektoren).
    expect(cssText).toContain(".nl-sponsor-axis-chip.is-pow");
    expect(cssText).toContain(".nl-sponsor-difficulty.is-hart");
    expect(cssText).toContain(".nl-sponsor-rank-rung");
    expect(cssText).toContain(".nl-sponsor-offer.is-golden");
    expect(cssText).toContain(".nl-sponsor-stage-ladder");

    // Presenter-Exports, auf die die Karte baut.
    expect(presenterText).toContain("buildSponsorOfferPresentation");
    expect(presenterText).toContain("buildSponsorRankTierRows");
    expect(presenterText).toContain("SPONSOR_RANK_FLOOR_AT");
  });
});
