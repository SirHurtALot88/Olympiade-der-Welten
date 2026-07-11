import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("foundation training compact UI contract", () => {
  it("shows AI training recommendation and inbox quick actions are wired", () => {
    const foundationSource =
      readFileSync(join(root, "app/foundation/FoundationPageClient.tsx"), "utf8") +
      readFileSync(join(root, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"), "utf8");
    const trainingCrossTabSource = readFileSync(
      join(root, "lib/foundation/tabs/use-foundation-cross-tab-training.ts"),
      "utf8",
    );
    const trainingShared = readFileSync(join(root, "app/foundation/training-facilities-v2/training-view-shared.tsx"), "utf8");
    const officeSource = readFileSync(join(root, "app/foundation/home-v2/ManagerOfficeClient.tsx"), "utf8");

    expect(foundationSource).toContain("useFoundationCrossTabTraining");
    expect(trainingCrossTabSource).toContain("buildTeamPlayerTrainingLoadPlanMap");
    expect(trainingCrossTabSource).toContain("recommendedTrainingMode");
    const inboxHostSource = readFileSync(join(root, "app/foundation/inbox-v2/FoundationInboxV2Host.tsx"), "utf8");
    const inboxDerivationsSource = readFileSync(
      join(root, "lib/foundation/tabs/use-inbox-v2-derivations.ts"),
      "utf8",
    );
    expect(inboxHostSource).toContain("applyInboxQuickAction");
    expect(inboxDerivationsSource).toContain("mapInboxQuickActionsToChoices");
    expect(foundationSource).toContain("seasonReadinessChecklist");
    expect(trainingShared).toContain('data-testid="training-ai-recommendation"');
    expect(officeSource).toContain('data-testid="foundation-season-readiness-checklist"');
    expect(readFileSync(join(root, "app/foundation/inbox-v2/InboxV2Client.tsx"), "utf8")).toContain(
      'data-testid="inbox-v2-quick-actions"',
    );
  });
});
