import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

/**
 * Vertrag der Einsatzliste.
 *
 * Diese Datei prüfte früher `app/foundation/legacy-lineup-lab-v2/LegacyLineupFocusV2Board.tsx`
 * — eine Komponente, die seit dem "Neuen Look" nirgends mehr gerendert wurde
 * (`LegacyLineupLabClient` mountet ausschließlich `LineupNewLook` bzw.
 * `FormBoardPanel`). Die Assertions liefen deshalb dauerhaft rot gegen toten
 * Code und waren im Test selbst als "left red intentionally" vermerkt.
 *
 * Die Datei ist entfernt; ihr Props-Vertrag lebt in
 * `lib/lineups/legacy-lineup-board-props.ts` weiter. Dieser Test prüft jetzt
 * dieselben FÄHIGKEITEN an der Ansicht, die tatsächlich gerendert wird — die
 * Abdeckung wurde also verschoben, nicht abgeschwächt.
 */
describe("foundation lineup ui contract", () => {
  it("rendert die Einsatzliste mit Slots, Speichern, Kandidaten und Arena-CTA", async () => {
    const [lineupText, clientText, panelText, routingText] = await Promise.all([
      fs.readFile(path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LineupNewLook.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/legacy-lineup-lab/FoundationLineupPanel.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "lib/foundation/foundation-view-routing.ts"), "utf8"),
    ]);

    expect(lineupText).toContain('data-testid="lineup-new-look"');
    expect(lineupText).toContain('data-testid="nl-lineup-save"');
    expect(lineupText).toContain('data-testid="nl-lineup-optimize"');
    expect(lineupText).toContain("nl-lineup-candidate-tabs");
    expect(lineupText).toContain("onCandidateTabChange");
    expect(lineupText).toContain("Zur Arena");
    expect(lineupText).toContain("arenaReady");
    expect(lineupText).toContain("onNavigateArena");
    expect(lineupText).toContain("FoundationPlayerPortraitPreview");
    expect(lineupText).toContain("lineupFinishItems");
    expect(lineupText).toContain("disciplineTacticPreviewBySide");

    // Die drei Spieltag-Ressourcen stehen je Disziplin beieinander.
    expect(lineupText).toContain('data-testid={`nl-lineup-formcards-${disciplineSide}`}');
    expect(lineupText).toContain('data-testid={`nl-lineup-teampower-${disciplineSide}`}');
    expect(lineupText).toContain('data-testid={`nl-lineup-captain-${disciplineSide}`}');

    // Der Props-Vertrag kommt aus lib/, nicht mehr aus einer Client-Komponente.
    expect(lineupText).toContain('from "@/lib/lineups/legacy-lineup-board-props"');

    expect(clientText).toContain("candidateGroups={teamdeckCandidateGroups}");
    expect(clientText).toContain("nextOpenSlotKey");
    expect(clientText).toContain("Formkarten");
    expect(clientText).toContain("assignFormCardToCell");
    expect(clientText).toContain('event.code === "ArrowUp"');
    expect(clientText).toContain('event.code === "ArrowDown"');
    expect(clientText).toContain("lineup-v2-arena-handoff");
    expect(clientText).toContain("focusV2ArenaReady");
    expect(clientText).toContain("focusV2DisciplineTacticPreviewBySide");

    expect(panelText).toContain('"foundation-lineup-v2"');
    expect(panelText).toContain("Einsatzliste");
    expect(panelText).not.toContain("Einsatzliste v2");

    expect(routingText).toContain('return "lineup"');
    expect(routingText).toContain("lineup-v2");
  });

  it("hat die nicht gerenderte Focus-Board-Komponente wirklich entfernt", async () => {
    const deadBoard = path.join(
      process.cwd(),
      "app/foundation/legacy-lineup-lab-v2/LegacyLineupFocusV2Board.tsx",
    );
    await expect(fs.access(deadBoard)).rejects.toThrow();

    const clientText = await fs.readFile(
      path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
      "utf8",
    );
    // Auch der tote dynamic()-Import ist weg — der war der einzige Grund, warum
    // die Datei überhaupt noch in den Client-Bundle-Graph gezogen wurde.
    expect(clientText).not.toContain("legacy-lineup-lab-v2/LegacyLineupFocusV2Board");
    expect(clientText).not.toContain("const LegacyLineupFocusV2Board = dynamic(");
  });
});
