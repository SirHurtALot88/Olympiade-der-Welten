import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  buildLegacyLineupEntriesFromSelections,
  buildLegacyLineupLabPlayerOptions,
  buildLegacyLineupLabSlots,
  findDuplicateActivePlayerSelections,
} from "@/lib/lineups/legacy-lineup-lab";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";

const context: LegacyLineupLoadedContext = {
  saveId: "save-1",
  seasonId: "season-1",
  matchdayId: "matchday-1",
  teamId: "A-A",
  entries: [],
  disciplinePlayerCounts: {
    tdm: 2,
    fechten: 1,
  },
  activePlayers: [
    { id: "active-1", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-1" },
    { id: "active-2", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-2" },
    { id: "active-3", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-3" },
  ],
  disciplineScores: [],
  save: { id: "save-1", name: "Save 1", status: "active" },
  season: { id: "season-1", saveId: "save-1", name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
  matchday: { id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
  team: { id: "A-A", shortCode: "A-A", name: "Alpha" },
  teamSeasonState: { id: "tss-1", saveId: "save-1", seasonId: "season-1", teamId: "A-A", cash: 100, budget: 100, rosterLimit: 6, playerOpt: 6 },
  teamIdentity: { pow: 10, spe: 10, men: 10, soc: 10 },
  rosterPlayers: [
    { id: "player-1", name: "Player 1", coreStats: { pow: 1, spe: 1, men: 1, soc: 1 } },
    { id: "player-2", name: "Player 2", coreStats: { pow: 1, spe: 1, men: 1, soc: 1 } },
    { id: "player-3", name: "Player 3", coreStats: { pow: 1, spe: 1, men: 1, soc: 1 } },
  ],
  disciplines: [
    { id: "tdm", name: "TDM", category: "tactics" },
    { id: "fechten", name: "Fechten", category: "speed" },
  ],
  disciplineWeights: [],
  seasonDisciplineConfigs: [],
  existingDraft: null,
  contextMeta: {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: "A-A",
    d1DisciplineId: "tdm",
    d2DisciplineId: "fechten",
  },
};

describe("legacy lineup lab helpers", () => {
  it("builds slots from the loaded context", () => {
    const slots = buildLegacyLineupLabSlots(context);

    expect(slots).toHaveLength(3);
    expect(slots.map((slot) => slot.key)).toEqual([
      "tdm::d1::0",
      "tdm::d1::1",
      "fechten::d2::0",
    ]);
  });

  it("builds player options from active players and roster players", () => {
    const options = buildLegacyLineupLabPlayerOptions(context);

    expect(options).toHaveLength(3);
    expect(options[0]).toEqual({
      activePlayerId: "active-1",
      playerId: "player-1",
      name: "Player 1",
      disciplineScores: {
        tdm: null,
        fechten: null,
      },
      fatigueCount: null,
      injuryStatus: "healthy",
      injuryUntilMatchday: null,
      injuryRiskPercent: null,
      injuryRiskBand: null,
      injuryRiskLabel: null,
    });
  });

  it("builds entry payloads from selections", () => {
    const slots = buildLegacyLineupLabSlots(context);
    const options = buildLegacyLineupLabPlayerOptions(context);
    const entries = buildLegacyLineupEntriesFromSelections({
      slots,
      playerOptions: options,
      selections: {
        "tdm::d1::0": "active-1",
        "tdm::d1::1": "active-2",
        "fechten::d2::0": "active-3",
      },
    });

    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({
      disciplineId: "tdm",
      disciplineSide: "d1",
      slotIndex: 0,
      playerId: "player-1",
      activePlayerId: "active-1",
    });
  });

  it("detects duplicate active player selections", () => {
    const duplicates = findDuplicateActivePlayerSelections({
      "tdm::d1::0": "active-1",
      "tdm::d1::1": "active-2",
      "fechten::d2::0": "active-1",
    });

    expect(duplicates).toEqual(["active-1"]);
  });

  it("keeps ai preview adoption inside the local ui draft without auto-saving", async () => {
    const fileText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx",
      "utf8",
    );
    const slotRoleText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/lineups/matchday-slot-roles.ts",
      "utf8",
    );
    const dragDropText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/lineups/legacy-lineup-drag-drop.ts",
      "utf8",
    );

    expect(fileText).toContain("AI-Vorschlag geladen und in die Slots uebernommen. Noch nicht gespeichert.");
    expect(fileText).toContain("applyAiPreviewToUiDraft");
    expect(fileText).toContain("skipNextAutoPersistRef");
    expect(fileText).toContain("Erweiterte Technikoptionen");
    expect(fileText).toContain("Technikwechsel bleibt bewusst außerhalb des normalen Arbeitsflows.");
    expect(fileText).toContain("Vorschlag uebernehmen");
    expect(fileText).toContain("handleAdoptAiPreview");
    expect(fileText).toContain("buildDraftStateFromAiPreview");
    expect(fileText).toContain("onOpenPlayerDetails");
    expect(fileText).toContain("openPlayerDetails");
    expect(fileText).toContain("openPlayerDetailsForActivePlayer");
    expect(fileText).toContain('onDoubleClick={() => openPlayerDetails(player.id, player.activePlayerId)}');
    expect(fileText).toContain('onDoubleClick={() => openPlayerDetails(entry.playerId, entry.activePlayerId)}');
    expect(fileText).toContain('onDoubleClick={() => openPlayerDetailsForActivePlayer(selections[slot.key])}');
    expect(fileText).toContain('onDoubleClick={() => openPlayerDetailsForActivePlayer(captains[disciplineSide])}');
    expect(fileText).toContain("Details");
    expect(fileText).toContain('setSelections(nextDraft.selections);');
    expect(fileText).toContain('setCaptains(nextDraft.captains);');
    expect(fileText).toContain("AI-Vorschlag uebernommen – noch nicht gespeichert.");
    expect(fileText).toContain("Aktuelle Auswahl ersetzen?");
    expect(fileText).toContain("AI-Vorschlag lokal speichern");
    expect(fileText).toContain("handleSaveAiPreview");
    expect(fileText).toContain("AI-Vorschlag jetzt lokal speichern?");
    expect(fileText).toContain("Bestehende Einsatzliste wird ersetzt. AI-Vorschlag jetzt lokal speichern?");
    expect(fileText).toContain("AI-Vorschlag gespeichert.");
    expect(fileText).toContain("AI-Speichern nutzt denselben lokalen Save-Pfad wie ein manuell gespeichertes Lineup.");
    expect(fileText).toContain("Resolve Preview öffnen");
    expect(fileText).toContain("/api/lineups/legacy/ai-batch-preview");
    expect(fileText).toContain("/api/lineups/legacy/ai-batch-apply");
    expect(fileText).toContain("AI Vorschlag alle Teams");
    expect(fileText).toContain("handleAiPreviewAllTeams");
    expect(fileText).toContain("handleOpenAiBatchDetails");
    expect(fileText).toContain("handleAiBatchApply");
    expect(fileText).toContain("setIsPreviewPanelOpen(true);");
    expect(fileText).toContain("setIsAiPreviewPanelOpen(true);");
    expect(fileText).toContain("open={isPreviewPanelOpen}");
    expect(fileText).toContain("open={isAiPreviewPanelOpen}");
    expect(fileText).toContain("Batch DryRun");
    expect(fileText).toContain("AI-Teams lokal speichern");
    expect(fileText).toContain("AI Eligible:");
    expect(fileText).toContain("Manual uebersprungen:");
    expect(fileText).toContain("Passive uebersprungen:");
    expect(fileText).toContain("Disabled uebersprungen:");
    expect(fileText).toContain("Ready to Save:");
    expect(fileText).toContain("Nur Teams mit controlMode=ai und freigegebenem AI-Apply werden gespeichert.");
    expect(fileText).toContain("<th>Control</th>");
    expect(fileText).toContain("<th>AI Apply</th>");
    expect(fileText).toContain("Warning Teams einschließen");
    expect(fileText).toContain("Bestehende Lineups ueberschreiben");
    expect(fileText).toContain("Bitte zuerst Batch DryRun ausfuehren.");
    expect(fileText).toContain("Formkarten-Status:");
    expect(fileText).toContain("Mutator-Status:");
    expect(fileText).toContain("formatFormCardOptionLabel");
    expect(fileText).toContain("sortFormCardsForDiscipline");
    expect(fileText).toContain("legacy-lineup-form-card-chip");
    expect(fileText).toContain("Malus");
    expect(fileText).toContain("renderOptionLabel");
    expect(fileText).toContain("formatFatigueHint");
    expect(fileText).toContain("getFatigueHeatClass");
    expect(fileText).toContain("legacy-lineup-selection-meta");
    expect(fileText).toContain("legacy-lineup-side-draft-status");
    expect(fileText).toContain("legacy-lineup-main-flow");
    expect(fileText).toContain("legacy-lineup-discipline-board");
    expect(fileText).toContain("Teamdeck / Assignment");
    expect(fileText).toContain('setTeamdeckSortMode("top");');
    expect(fileText).toContain('teamdeckSortMode === "top" && leftSlotScore !== rightSlotScore');
    expect(fileText).toContain("leftBlocked !== rightBlocked");
    expect(fileText).toContain("resolveTeamDisciplineRank");
    expect(fileText).toContain("normalizeLineupDisciplineFieldName");
    expect(fileText.indexOf('className="legacy-lineup-draft-footer"')).toBeLessThan(
      fileText.indexOf('className="legacy-lineup-draft-roadmap"'),
    );
    expect(fileText).toContain("Matchday Room · Lineup Prep");
    expect(fileText).toContain("Matchday Preview");
    expect(fileText).toContain("D1 Projected Range");
    expect(fileText).toContain("D2 Projected Range");
    expect(fileText).toContain("Fatigue Cost gesamt");
    expect(fileText).toContain("Captain moeglich");
    expect(fileText).toContain("Aktiv in");
    expect(fileText).toContain("Verfuegbar");
    expect(fileText).toContain("Freier Slot");
    expect(fileText).toContain("Projected ");
    expect(fileText).toContain("Drag Preview");
    expect(fileText).toContain("Score Δ");
    expect(fileText).toContain("Slot-Regel");
    expect(dragDropText).toContain("player_injured_unavailable");
    expect(dragDropText).toContain("Captain nicht erlaubt");
    expect(dragDropText).toContain("bereits in anderer Diszi eingesetzt");
    expect(fileText).toContain("Einsatzstufe");
    expect(fileText).toContain("Schonen");
    expect(fileText).toContain("Push");
    expect(fileText).toContain("resolveSlotRolesForDiscipline");
    expect(slotRoleText).toContain("Frontliner");
    expect(slotRoleText).toContain("Duelist");
    expect(fileText).toContain("Ft {formatScore(slotPreview?.projected.additionalFatigue ?? 0)}");
    expect(fileText).toContain("Fatigue Info =");
    expect(fileText).toContain("Matchday Arena · Reveal View ·");
    expect(fileText).toContain("Top-Spieler ·");
    expect(fileText).toContain("Weiter: Resolve Detail behalten");
    expect(fileText).toContain("Done: Player Drawer per Klick/Doppelklick");
    expect(fileText).toContain("legacy-lineup-top-player-card");
    expect(fileText).toContain("legacy-lineup-result-team-card");
    expect(fileText).toContain("D1 / D2 Lineup-Zonen");
    expect(fileText).toContain("Expert Modus");
    expect(fileText).toContain("Expert Modus an");
    expect(fileText).toContain("legacy-lineup-expert-mode-v1");
    expect(fileText).toContain("formatWeightInfo");
    expect(fileText).toContain("legacy-lineup-focus-switch");
    expect(fileText).toContain("legacy-lineup-weight-band");
    expect(fileText).toContain("legacy-lineup-arena-slot");
    expect(fileText).toContain("legacy-lineup-slot-drag-callout");
    expect(fileText).toContain("legacy-lineup-slot-fit-pill");
    expect(fileText).toContain("getDragFitTierClass");
    expect(fileText).toContain("resolveLegacyLineupDragBlockReason");
    expect(fileText).toContain("handleDropOnSlot");
    expect(fileText).toContain("attributeRatings");
    expect(fileText).toContain("resolveAttributeGrade");
    expect(fileText).toContain("TOR");
    expect(fileText).toContain("legacy-lineup-table-preferences-v1");
    expect(fileText).toContain("LegacyLineupTableCustomization");
    expect(fileText).toContain("Retool Default");
    expect(fileText).toContain("Compact");
    expect(fileText).toContain("Finance");
    expect(fileText).toContain("Performance");
    expect(fileText).toContain("toggleLineupPlayerColumn");
    expect(fileText).toContain("moveLineupPlayerColumn");
    expect(fileText).toContain("stepLineupPlayerColumnWidth");
    expect(fileText).toContain("resetLineupPlayerColumnWidth");
    expect(fileText).toContain("LegacyLineupSortableHeader");
    expect(fileText).toContain("toggleLineupPlayerTableSort");
    expect(fileText).toContain("sortState");
    expect(fileText).toContain("compareLegacyLineupSortValues");
    expect(fileText.indexOf("Teamdeck / Assignment")).toBeLessThan(fileText.indexOf("legacy-lineup-discipline-board"));
    expect(fileText.indexOf("legacy-lineup-discipline-board")).toBeLessThan(
      fileText.indexOf("<summary>Expert Modus</summary>"),
    );
    expect(fileText).toContain("Batch gespeichert:");
    expect(fileText).toContain("Skipped Existing:");
    expect(fileText).toContain("Would Overwrite:");
    expect(fileText).toContain("Team öffnen");
    expect(fileText).toContain("Ready:");
    expect(fileText).toContain("Blocked:");
    expect(fileText).toContain('if (source === "prisma" || isReadOnly)');
    expect(fileText).toContain('await saveEntries(nextEntries, "AI-Vorschlag gespeichert.");');
    expect(fileText).toContain('Lineup speichern');
    expect(fileText).not.toContain('handleAdoptAiPreview() {\\n    await fetch("/api/lineups/legacy"');
    expect(fileText).not.toContain('fetch("/api/lineups/legacy/ai-apply"');
  });
});
