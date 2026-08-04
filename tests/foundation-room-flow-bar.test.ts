import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const barPath = path.join(process.cwd(), "components/foundation/FoundationRoomFlowBar.tsx");
const shellBodyPath = path.join(process.cwd(), "app/foundation/FoundationShellRouterBody.tsx");
const liveSyncPath = path.join(process.cwd(), "lib/foundation/tabs/use-foundation-live-sync.ts");
const scopePath = path.join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");

describe("Foundation-Shell Room-Flow-Leiste", () => {
  it("rendert den vollen Room-Flow (Schritt, Handlungsknopf, Blocker, KI-Fortschritt) statt nur eines Tooltip-Chips", async () => {
    const barText = await fs.readFile(barPath, "utf8");

    expect(barText).toContain("data-testid=\"foundation-room-flow-bar\"");
    expect(barText).toContain("data-testid=\"foundation-room-flow-button\"");
    expect(barText).toContain("describeRoomFlowButton");
    expect(barText).toContain("getRoomFlowStep");
    // Handlungsknopf sendet ueber das typisierte `action`-Feld, nicht per Label-Vergleich.
    expect(barText).toContain("button.action");
    expect(barText).toContain("emitRoomFlowButtonAction");
    // canClick/status steuern disabled + Ton — keine eigene Ready-Logik nebenher.
    expect(barText).toContain("button.canClick");
    expect(barText).toContain("button.status");
    // Blocker: unerledigte Teilnehmer + KI-Fortschritt.
    expect(barText).toContain("completedParticipantIds");
    expect(barText).toContain("aiAutoCompletedTeamIds");
    // Kein zweites Socket-Abo: nur Emits (`.emit(`), kein Listener (`.on(`) in dieser Datei.
    expect(barText).not.toMatch(/\.on\(\s*["'](roomJoined|roomState|roomError)["']/);
  });

  it("ist in die Foundation-Shell eingehaengt und ersetzt die Flow-Details im Chip-Tooltip", async () => {
    const shellText = await fs.readFile(shellBodyPath, "utf8");

    expect(shellText).toContain("FoundationRoomFlowBar");
    expect(shellText).toContain("<FoundationRoomFlowBar roomContext={roomContext} roomLiveState={roomLiveState} />");
    // Der Tooltip zeigt keine Flow-Schritt-Details mehr — die stehen jetzt sichtbar in der
    // Leiste. Zwei Stellen mit derselben Wahrheit waeren nur eine Quelle fuer Drift gewesen.
    expect(shellText).not.toMatch(/Schritt: \$\{getRoomFlowStep/);
  });

  it("navigiert bei einem Room-Flow-Schrittwechsel automatisch in die passende View", async () => {
    const liveSyncText = await fs.readFile(liveSyncPath, "utf8");
    const scopeText = await fs.readFile(scopePath, "utf8");

    expect(liveSyncText).toContain("onRoomFlowStepChanged");
    expect(liveSyncText).toContain("mapRoomFlowViewToFoundationViewId");
    // Guard: nur bei echtem Schrittwechsel navigieren, nicht bei jedem State-Broadcast.
    expect(liveSyncText).toContain("lastRoomFlowStepRef");
    expect(liveSyncText).toContain("previousStep === roomFlowStep");

    expect(scopeText).toContain("onRoomFlowStepChanged");
    expect(scopeText).toContain("onHostStartedArena");
  });
});
