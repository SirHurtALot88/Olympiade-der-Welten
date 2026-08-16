import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { readFoundationOrchestratorSource, readFoundationSurfaceSource } from "./foundation-orchestrator-source";

describe("foundation panel split ui contract", () => {
  it("routes heavy views through lazy foundation panels", async () => {
    const foundationText = await readFoundationOrchestratorSource(
      process.cwd(),
    );
    const foundationSurfaceText = await readFoundationSurfaceSource(
      process.cwd(),
    );
    const pageClientText = await fs.readFile(
      path.join(process.cwd(), "app/foundation/FoundationPageClient.tsx"),
      "utf8",
    );

    expect(foundationSurfaceText).toContain("FoundationShellRouterHomeV2");
    expect(foundationSurfaceText).toContain("FoundationShellRouterSeasonV2");
    // Der Router-Baustein für die Einsatzliste hatte keinen Aufrufer mehr (nachgezählt: 0 Stellen
    // außer der eigenen, seither entfernten Definition und einer toten Import-Zeile) und wurde
    // entfernt. Die zugesicherte EIGENSCHAFT — lazy geladenes Panel, das nur bei aktivem Tab montiert
    // ist — bleibt bestehen, jetzt über die Ternary direkt in FoundationShellRouterBody.tsx: das Panel
    // wird per `dynamic()` ohne SSR nachgeladen und nur gerendert, wenn "lineup"/"lineupV2" aktiv ist;
    // sonst liefert die Ternary `null` — dieselbe An-/Abmontier-Semantik wie das Unmount-Gate der
    // übrigen Router-Bausteine.
    expect(foundationSurfaceText).toMatch(/const FoundationLineupPanel = dynamic\(/);
    expect(foundationSurfaceText).toMatch(
      /activeView === "lineup" \|\| activeView === "lineupV2" \? \(\s*<FoundationLineupPanel/,
    );
    expect(foundationSurfaceText).toContain("FoundationShellRouterMarketV2");
    expect(pageClientText).not.toContain("FoundationMatchdayArenaPanel");
    expect(foundationSurfaceText).toContain("FoundationShellRouterTeams");
    expect(foundationText).toContain("shouldBuildHomeV2Overview");
    expect(foundationText).toContain("shouldBuildPlayerRatings");
    const bodyText = await fs.readFile(
      path.join(process.cwd(), "app/foundation/FoundationShellRouterBody.tsx"),
      "utf8",
    );
    expect(bodyText).not.toContain("<MatchdayArenaV2Client");
    expect(bodyText).not.toContain("<TransfermarktV2Client");
  });
});
