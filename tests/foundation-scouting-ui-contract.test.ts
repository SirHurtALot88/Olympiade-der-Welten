import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
// ScoutingCenterV2Client.tsx is now a thin wrapper; the actual panel wiring
// lives in ScoutingCenterV2NewLook.tsx.
const scoutingPath = path.join(root, "app/foundation/scouting-center-v2/ScoutingCenterV2NewLook.tsx");
const scoutingQueuePath = path.join(root, "app/foundation/scouting-center-v2/ScoutingPriorityQueue.tsx");
const scoutingReportPath = path.join(root, "app/foundation/scouting-center-v2/ScoutingReportPanel.tsx");
const legacyLineupPath = path.join(root, "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx");
const globalsPath = path.join(root, "app/globals.css");

describe("foundation scouting and workflow portrait ui contract", () => {
  it("renders the scouting priority queue and report with portraits and scouting context stats", async () => {
    const [scoutingText, queueText, reportText, cssText] = await Promise.all([
      fs.readFile(scoutingPath, "utf8"),
      fs.readFile(scoutingQueuePath, "utf8"),
      fs.readFile(scoutingReportPath, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(scoutingText).toContain("ScoutingPriorityQueue");
    expect(scoutingText).toContain("ScoutingReportPanel");
    expect(queueText).toContain("getPlayerPortraitBrowserUrl");
    expect(queueText).toContain("isFocusTarget");
    expect(queueText).toContain("isFullyScouted");
    expect(reportText).toContain("getPlayerPortraitBrowserUrl");
    expect(reportText).toContain("caDisplay");
    expect(reportText).toContain("formatScoutedImpactDelta");
    expect(reportText).toContain("VeloPotentialStars");
    expect(reportText).toContain('data-testid="scouting-report-disciplines"');
    expect(cssText).toContain(".scouting-queue-row");
    expect(cssText).toContain(".scouting-report-panel");
    expect(cssText).toContain(".scouting-recommendations-section");
  });

  /**
   * DIE ZUSICHERUNG HIESS FRUEHER „compact lineup portrait cards" und suchte
   * `FoundationPlayerPortraitCard`, `density="compact"` und
   * `legacy-matchday-player-card` in LegacyLineupLabClient.tsx.
   *
   * Der Spielerpool sieht heute anders aus, und zwar mit Absicht: gerendert wird
   * `LineupNewLook.tsx`, und dort steht statt eines Karten-Rasters ein 22px-Avatar am
   * Namen (Portrait, sonst Initialen) plus eine Hover-Vorschau. Die Vorschau reicht
   * dieselbe geteilte Portraitkarte durch — `FoundationPlayerPortraitPreview` rendert
   * intern `FoundationPlayerPortraitCard`. Es ist also nicht die Karte verschwunden,
   * sondern das Raster; die Karte kommt jetzt beim Hovern.
   *
   * `legacy-matchday-player-card` gibt es nur noch als CSS-Regel ohne Benutzer —
   * vermerkt in docs/ROTE_TESTS_TRIAGE.md.
   *
   * Was hier bleibt, ist die Zusage, die dem Spieler etwas verspricht: im Pool ist ein
   * GESICHT zu sehen, mit Rueckfall auf Initialen, wenn kein Bild da ist, und die
   * Vorschau erfindet keine eigene Kartendarstellung, sondern nimmt die geteilte.
   */
  it("der Einsatzlisten-Pool zeigt Portraits mit Initialen-Rueckfall und teilt sich die Portraitkarte", async () => {
    const [poolText, previewText] = await Promise.all([
      fs.readFile(path.join(root, "app/foundation/legacy-lineup-lab/LineupNewLook.tsx"), "utf8"),
      fs.readFile(
        path.join(root, "components/foundation/player-portrait-card/FoundationPlayerPortraitPreview.tsx"),
        "utf8",
      ),
    ]);

    // Portrait am Spieler, Initialen als Rueckfall — ohne den Rueckfall bleibt bei
    // fehlendem Bild ein leerer Kreis stehen.
    expect(poolText).toContain("getPlayerPortraitInitials");
    expect(poolText).toContain("portraitUrl");
    // Die Hover-Vorschau ist die GETEILTE, keine zweite Bauart daneben.
    expect(poolText).toContain("FoundationPlayerPortraitPreview");
    expect(previewText).toContain("FoundationPlayerPortraitCard");
    expect(previewText).toContain("density");
  });

});
