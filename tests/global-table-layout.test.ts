import { describe, expect, it } from "vitest";

import {
  GLOBAL_TABLE_LAYOUT_VERSION,
  GLOBAL_TABLE_REGISTRY,
  clampTableColumnWidth,
  getDefaultGlobalTableWidths,
  normalizeGlobalTablePreferenceEntry,
  reorderGlobalTableColumns,
} from "@/lib/ui/global-table-layout";

describe("global table layout helpers", () => {
  it("registers the important foundation tables with stable storage keys", () => {
    expect(GLOBAL_TABLE_REGISTRY["season-standings"].storageKey).toBe("seasonTable");
    expect(GLOBAL_TABLE_REGISTRY["season-standings-v2"].storageKey).toBe("seasonStandingsV2Table");
    expect(GLOBAL_TABLE_REGISTRY["season-standings-v2-top-players"].storageKey).toBe("seasonStandingsV2TopPlayersTable");
    expect(GLOBAL_TABLE_REGISTRY["prize-money"].storageKey).toBe("prizePreviewTable");
    expect(GLOBAL_TABLE_REGISTRY["transfer-market"].storageKey).toBe("transferMarketTable");
    expect(GLOBAL_TABLE_REGISTRY["transfer-history"].storageKey).toBe("transferHistoryTable");
    expect(GLOBAL_TABLE_REGISTRY.teams.storageKey).toBe("teamsView");
    expect(GLOBAL_TABLE_REGISTRY.players.storageKey).toBe("playersTable");
    expect(GLOBAL_TABLE_REGISTRY.ranks.storageKey).toBe("disciplineRanksTable");
    expect(GLOBAL_TABLE_REGISTRY.disciplines.storageKey).toBe("disciplineConfigTable");
    expect(GLOBAL_TABLE_REGISTRY["lineup-expert"].storageKey).toBe("selectedRosterTable");
    expect(GLOBAL_TABLE_REGISTRY["balance-team"].storageKey).toBe("multiSeasonTeamBalanceTable");
    expect(GLOBAL_TABLE_REGISTRY["balance-economy"].storageKey).toBe("multiSeasonEconomyTable");
    expect(GLOBAL_TABLE_REGISTRY["balance-player"].storageKey).toBe("multiSeasonPlayerProgressionTable");
    expect(GLOBAL_TABLE_REGISTRY["balance-gameplay"].storageKey).toBe("multiSeasonGameplayTable");
  });

  it("documents the global table baseline: connected tables keep resizable persisted widths", () => {
    const connectedEntries = Object.values(GLOBAL_TABLE_REGISTRY).filter((entry) => entry.status === "connected");

    expect(connectedEntries.length).toBeGreaterThan(0);
    expect(connectedEntries.every((entry) => entry.requiresResizableColumns)).toBe(true);
    expect(connectedEntries.every((entry) => entry.requiresPersistentWidths)).toBe(true);
  });

  it("clamps widths so resized columns stay usable", () => {
    const column = { minWidth: 80, maxWidth: 160 };

    expect(clampTableColumnWidth(column, 40)).toBe(80);
    expect(clampTableColumnWidth(column, 120)).toBe(120);
    expect(clampTableColumnWidth(column, 260)).toBe(160);
  });

  it("builds default widths from column config", () => {
    expect(
      getDefaultGlobalTableWidths([
        { id: "team", defaultWidth: 220, minWidth: 160, maxWidth: 260 },
        { id: "cash", defaultWidth: 500, minWidth: 90, maxWidth: 180 },
      ]),
    ).toEqual({ team: 220, cash: 180 });
  });

  it("keeps old layout entries compatible with the versioned state", () => {
    const normalized = normalizeGlobalTablePreferenceEntry({
      widths: { team: 240 },
      hiddenColumnIds: ["warnings"],
    });

    expect(normalized.version).toBe(GLOBAL_TABLE_LAYOUT_VERSION);
    expect(normalized.widths.team).toBe(240);
    expect(normalized.hiddenColumnIds).toEqual(["warnings"]);
    expect(normalized.columnOrder).toEqual([]);
  });

  it("reorders columns without changing data values", () => {
    expect(reorderGlobalTableColumns(["team", "cash", "rank"], "rank", "team")).toEqual(["rank", "team", "cash"]);
    expect(reorderGlobalTableColumns(["team", "cash", "rank"], "missing", "team")).toEqual(["team", "cash", "rank"]);
  });
});
