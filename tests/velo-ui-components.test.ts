import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const veloUiPath = path.join(process.cwd(), "components/foundation/velo-ui");
const globalsPath = path.join(process.cwd(), "app/globals.css");
const foundationClientPath = path.join(process.cwd(), "app/foundation/FoundationPageClient.tsx");
const teamsDetailPanelPath =
  path.join(process.cwd(), "app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx");

describe("velo ui rollout contract", () => {
  it("exports shared velo components", async () => {
    const indexText = await fs.readFile(`${veloUiPath}/index.ts`, "utf8");
    expect(indexText).toContain("VeloStatOrbitChip");
    expect(indexText).toContain("VeloIntensityRail");
    expect(indexText).toContain("VeloImpactStrip");
    expect(indexText).toContain("VeloAttributeFocusTags");
  });

  it("wires css namespaces for velo rollout", async () => {
    const cssText = await fs.readFile(globalsPath, "utf8");
    expect(cssText).toContain(".velo-intensity-rail");
    expect(cssText).toContain(".velo-impact-strip");
    expect(cssText).toContain(".velo-scouting-disclosure");
    expect(cssText).toContain(".season-v2-team-card-grid");
  });

  it("wires classic teams v1 economy tiles into foundation", async () => {
    const fileText = await fs.readFile(teamsDetailPanelPath, "utf8");
    expect(fileText).toContain("teamEconomyTiles");
    expect(fileText).toContain("teams-v2-focus-card");
  });

  it("wires velo rollout across lineup, drawer and facilities", async () => {
    const [lineupText, drawerText, cssText] = await Promise.all([
      fs.readFile(path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/PlayerDetailDrawer.tsx"), "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    /**
     * HIER STANDEN DREI ABSICHTLICH ROTE ZUSICHERUNGEN auf `FoundationPlayerPortraitCard`,
     * `VeloImpactStrip` und `legacy-lineup-scoreboard-impact-strip` im LEGACY-Client, mit dem
     * Verdacht, das „Daten-Ansicht"-Scoreboard sei ersatzlos verschwunden.
     *
     * Nachgesehen (Audit): Der Verdacht trägt nicht. Das Scoreboard lag im alten Look, und der war
     * seit „'Neuer Look'-Toggle entfernen" (`ae590e4f`) hinter `if (newLook) return <LineupNewLook/>`
     * gar nicht mehr erreichbar; `32683df8` hat den toten Zweig dann physisch entfernt. Sein Inhalt
     * lebt weiter: Tagesrang, Saisonrang vorher→nachher, D1/D2, Form-, Captain- und Mutator-Beitrag
     * stehen heute in `DisciplineStageMatchdayPanel`, die Netto-Werte je Etappe in
     * `DisciplineStageResultTable`, die Gesamtsicht im „Daten"-Tab von `MatchdayResultNewLook`.
     *
     * Auch die Portrait-Karte ist nicht weg, sondern umgezogen: `LineupNewLook` zeigt Mini-Avatare
     * mit Hover-Vorschau (`FoundationPlayerPortraitPreview`), und die rendert die volle
     * `FoundationPlayerPortraitCard`. Der Test suchte sie nur in der falschen Datei.
     *
     * Geprüft wird deshalb jetzt die heutige Verdrahtung statt der alten Namen.
     */
    expect(lineupText).toContain("LineupNewLook");
    const lineupNewLookText = await fs.readFile(
      path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LineupNewLook.tsx"),
      "utf8",
    );
    expect(lineupNewLookText).toContain("FoundationPlayerPortraitPreview");
    expect(lineupNewLookText).toContain("NlPlayerAvatar");
    const portraitPreviewText = await fs.readFile(
      path.join(process.cwd(), "components/foundation/player-portrait-card/FoundationPlayerPortraitPreview.tsx"),
      "utf8",
    );
    // Die Hover-Vorschau MUSS die volle Karte rendern — sonst wäre die Portrait-Darstellung im
    // Lineup-Lab doch verloren, nur unauffälliger.
    expect(portraitPreviewText).toContain("FoundationPlayerPortraitCard");
    expect(drawerText).toContain("player-drawer-axis-chip");
    expect(drawerText).toContain("player-drawer-scouting-disclosure");
    expect(cssText).toContain(".player-drawer-axis-orbit");
  });

  it("keeps draft intensity preview data for form board while removing duplicate header strip", async () => {
    const lineupText = await fs.readFile(
      path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
      "utf8",
    );
    expect(lineupText).toContain("draftIntensityPreview");
    expect(lineupText).not.toContain("legacy-lineup-draft-intensity-preview");
    expect(lineupText).not.toMatch(/label: "Base"[\s\S]*legacy-lineup-draft-controls/);
  });
});
