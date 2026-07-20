import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("contract offer ui contract", () => {
  it("uses dedicated offer screen without live team-fit percent in transfer UI", async () => {
    const [offerText, transferText] = await Promise.all([
      fs.readFile(
        path.join(process.cwd(), "app/foundation/contract-offer/ContractOfferClient.tsx"),
        "utf8",
      ),
      fs.readFile(
        path.join(process.cwd(), "app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx"),
        "utf8",
      ),
    ]);

    expect(offerText).toContain('data-testid="contract-offer-screen"');
    expect(offerText).toContain("Angebot senden");
    expect(offerText).toContain("Auto-Angebot");
    expect(transferText).toContain("ContractOfferClient");
    expect(transferText).toContain("Verhandeln");
    expect(transferText).not.toMatch(/<span>Fit<\/span>\s*<strong>\{formatPercent\(buyPreview\?\.teamFit\)/);
  });
});
