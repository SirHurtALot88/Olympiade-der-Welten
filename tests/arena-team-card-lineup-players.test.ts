import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildTeamLineupSections,
  resolveLineupEntryPlayerId,
  buildRosterEntryPlayerIndex,
} from "@/lib/foundation/discipline-stage/discipline-stage-team-lineup";

const REPO_ROOT = process.cwd();
const DRAWER = readFileSync(join(REPO_ROOT, "app/foundation/discipline-stage/DisciplineStageDrawer.tsx"), "utf8");

/**
 * Gemeldet: „Auf der Team-Karte werden die Spieler bei ‚in dieser Disziplin' nicht
 * angezeigt — da ist keiner mehr drin."
 *
 * Nachgestellt am gemeldeten Stand (Save `new-game-1785476771457-e4yvyl`, Saison 1,
 * Spieltag 1, Team L-K, Disziplin Battlefield): der Spieltags-Entwurf war vollständig
 * eingereicht — 3 Slots in d1, 6 in d2 — und die Karte zeigte trotzdem niemanden.
 *
 * Ursache ist keine Wertung, sondern eine Id-Verwechslung: In JEDEM der 284 Einträge
 * dieses Stands ist `activePlayerId` die Id des KADER-EINTRAGS (`roster-…`), während
 * `playerId` den Spieler benennt (`player-…`). Die Karte suchte `activePlayerId` in
 * `gameState.players` — dort steht nie eine Kader-Id, also fiel jede Spielerkarte weg.
 *
 * Die Daten unten sind 1:1 aus diesem Stand übernommen (Ids gekürzt).
 */
describe("Arena-Team-Karte: In dieser Disziplin zeigt die Aufgestellten", () => {
  const rosters = [
    { id: "roster-63459e71", teamId: "L-K", playerId: "player-1024-black" },
    { id: "roster-71676fad", teamId: "L-K", playerId: "player-1070-namora" },
    { id: "roster-a409c7f7", teamId: "L-K", playerId: "player-1584-lord-amaranth" },
    { id: "roster-0bc9ea45", teamId: "L-K", playerId: "player-2737-xil-vera" },
    { id: "roster-74eafae1", teamId: "L-K", playerId: "player-2706-viktor-frankenstein" },
    { id: "roster-99999999", teamId: "L-K", playerId: "player-0001-ersatzmann" },
    { id: "roster-11111111", teamId: "M-S", playerId: "player-2123-king-aethar" },
  ];

  const entries = [
    { disciplineId: "battlefield", disciplineSide: "d1" as const, slotIndex: 2, playerId: "player-1584-lord-amaranth", activePlayerId: "roster-a409c7f7" },
    { disciplineId: "battlefield", disciplineSide: "d1" as const, slotIndex: 0, playerId: "player-1024-black", activePlayerId: "roster-63459e71" },
    { disciplineId: "battlefield", disciplineSide: "d1" as const, slotIndex: 1, playerId: "player-1070-namora", activePlayerId: "roster-71676fad" },
    { disciplineId: "time-trial", disciplineSide: "d2" as const, slotIndex: 0, playerId: "player-2737-xil-vera", activePlayerId: "roster-0bc9ea45" },
    { disciplineId: "time-trial", disciplineSide: "d2" as const, slotIndex: 1, playerId: "player-2706-viktor-frankenstein", activePlayerId: "roster-74eafae1" },
  ];

  // Der Katalog kennt nur `player-…` — genau wie `gameState.players`.
  const katalogSpielerIds = new Set(rosters.map((r) => r.playerId));

  it("liefert für die gezeigte Disziplin Spieler-Ids, die der Katalog kennt", () => {
    const sections = buildTeamLineupSections({ entries, rosters, teamId: "L-K", currentSide: "d1" });

    expect(sections.currentSide).toHaveLength(3);
    for (const slot of sections.currentSide) {
      expect(katalogSpielerIds.has(slot.playerId)).toBe(true);
      expect(slot.playerId.startsWith("roster-")).toBe(false);
    }
    expect(sections.currentSide.map((s) => s.playerId)).toEqual([
      "player-1024-black",
      "player-1070-namora",
      "player-1584-lord-amaranth",
    ]);
  });

  it("sortiert nach Slot, nicht nach Reihenfolge im Entwurf", () => {
    const sections = buildTeamLineupSections({ entries, rosters, teamId: "L-K", currentSide: "d1" });
    expect(sections.currentSide.map((s) => s.slotIndex)).toEqual([0, 1, 2]);
  });

  it("führt die andere Spieltags-Disziplin genauso auf", () => {
    const sections = buildTeamLineupSections({ entries, rosters, teamId: "L-K", currentSide: "d1" });
    expect(sections.otherSide.map((s) => s.playerId)).toEqual([
      "player-2737-xil-vera",
      "player-2706-viktor-frankenstein",
    ]);
  });

  it("setzt die Aufgestellten nicht zugleich auf die Ersatzbank", () => {
    const sections = buildTeamLineupSections({ entries, rosters, teamId: "L-K", currentSide: "d1" });
    // Nur der eine Spieler, der in keinem Slot steht — und keiner aus einem fremden Kader.
    expect(sections.benchPlayerIds).toEqual(["player-0001-ersatzmann"]);
  });

  it("zeigt Aufgestellte auch dann, wenn noch keine Wertung vorliegt", () => {
    // `fieldedPlayerIds` (Arena-Payload) ist die Wertungs-/Vorschau-Seite. Sie darf
    // darüber entscheiden, was in der Wertspalte steht — nie darüber, WER dasteht.
    const ohneWertung = buildTeamLineupSections({ entries, rosters, teamId: "L-K", currentSide: "d1", fieldedPlayerIds: [] });
    expect(ohneWertung.currentSide).toHaveLength(3);
  });

  it("trägt die Besetzung aus dem Arena-Payload, wenn gar kein Entwurf vorliegt", () => {
    // Test-/Vorschau-Modus und abgeschlossene Disziplin: der Entwurf ist leer.
    const sections = buildTeamLineupSections({
      entries: [],
      rosters,
      teamId: "L-K",
      currentSide: "d1",
      fieldedPlayerIds: ["player-1024-black", "player-1070-namora"],
    });
    expect(sections.benchPlayerIds).not.toContain("player-1024-black");
    expect(sections.deployedPlayerIds).toContain("player-1070-namora");
  });

  it("nimmt eine `activePlayerId`, die schon eine Spieler-Id ist, unverändert an", () => {
    // Ältere Stände / Testdaten ohne Kader-Eintrag hinter der Id.
    const index = buildRosterEntryPlayerIndex(rosters);
    expect(
      resolveLineupEntryPlayerId(
        { disciplineSide: "d1", slotIndex: 0, playerId: "player-4711-solo", activePlayerId: null },
        index,
      ),
    ).toBe("player-4711-solo");
  });

  it("sucht in der Karte keine Kader-Eintrags-Id mehr als Spieler-Id", () => {
    // Die Verwechslung stand an drei Stellen derselben Datei — sie darf an keiner zurückkommen.
    expect(DRAWER).not.toContain("activePlayerId ?? e.playerId");
    expect(DRAWER).toContain("buildTeamLineupSections({");
  });
});
