import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { Player } from "@/lib/data/olyDataTypes";
import {
  applyPlayerFlavorImport,
  exportPlayerFlavorBatch,
  parsePlayerFlavorImportFileContents,
  persistPlayerFlavorImport,
} from "@/lib/player-import/player-flavor-batch-service";

function makePlayer(overrides: Partial<Player> & Pick<Player, "id" | "name">): Player {
  return {
    id: overrides.id,
    name: overrides.name,
    rating: overrides.rating ?? 42.5,
    marketValue: overrides.marketValue ?? 20,
    salaryDemand: overrides.salaryDemand ?? 8,
    className: overrides.className ?? "Hero",
    race: overrides.race ?? "Human",
    alignment: overrides.alignment ?? "N-G",
    gender: overrides.gender ?? "m",
    subclasses: overrides.subclasses ?? [],
    traitsPositive: overrides.traitsPositive ?? [],
    traitsNegative: overrides.traitsNegative ?? [],
    coreStats: overrides.coreStats ?? { pow: 40, spe: 40, men: 40, soc: 40 },
    disciplineRatings: overrides.disciplineRatings ?? { tennis: 10 },
    preferredDisciplineIds: overrides.preferredDisciplineIds ?? [],
    disciplineTierCounts: overrides.disciplineTierCounts ?? { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: overrides.flavorEn ?? "",
    flavorDe: overrides.flavorDe ?? "",
    fatigue: 0,
    form: 0,
    potential: overrides.potential ?? 50,
    age: null,
    nationality: null,
    displayMarketValue: overrides.displayMarketValue ?? overrides.marketValue ?? 20,
    displaySalary: overrides.displaySalary ?? overrides.salaryDemand ?? 8,
    cost: overrides.cost ?? 0,
    upkeepBase: overrides.upkeepBase ?? 0,
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
  };
}

describe("player-flavor-batch-service", () => {
  it("exports only missing flavor entries when requested", () => {
    const players = [
      makePlayer({ id: "player-a", name: "Alpha", flavorDe: "Schon da." }),
      makePlayer({ id: "player-b", name: "Beta", flavorDe: "" }),
    ];
    const batch = exportPlayerFlavorBatch({
      players,
      portraitMap: { "player-b": "/tmp/beta.jpg" },
      missingOnly: true,
    });

    expect(batch.count).toBe(1);
    expect(batch.entries[0]?.id).toBe("player-b");
    expect(batch.entries[0]?.hasPortrait).toBe(true);
    expect(batch.entries[0]?.flavorDe).toBe("");
  });

  it("imports flavor text without changing economy stats", () => {
    const players = [
      makePlayer({
        id: "player-b",
        name: "Beta",
        rating: 55.12,
        marketValue: 33.44,
        salaryDemand: 9.87,
      }),
    ];
    const result = applyPlayerFlavorImport(
      [{ id: "player-b", flavorDe: "Neue Bio aus dem Batch-Import." }],
      { players },
    );

    expect(result.updated).toBe(1);
    expect(result.updatedPlayers[0]?.flavorDe).toContain("Batch-Import");
    expect(result.updatedPlayers[0]?.rating).toBe(55.12);
    expect(result.updatedPlayers[0]?.marketValue).toBe(33.44);
    expect(result.updatedPlayers[0]?.salaryDemand).toBe(9.87);
  });

  it("skips players that already have flavorDe by default", () => {
    const players = [
      makePlayer({
        id: "player-a",
        name: "Alpha",
        flavorDe: "Bestehende hand-crafted Bio.",
      }),
    ];
    const result = applyPlayerFlavorImport(
      [{ id: "player-a", flavorDe: "Neuer Text aus dem Batch." }],
      { players },
    );

    expect(result.updated).toBe(0);
    expect(result.skippedExisting).toBe(1);
    expect(result.updatedPlayers[0]?.flavorDe).toBe("Bestehende hand-crafted Bio.");
  });

  it("can overwrite existing flavor text when explicitly enabled", () => {
    const players = [makePlayer({ id: "player-a", name: "Alpha", flavorDe: "Alt." })];
    const result = applyPlayerFlavorImport(
      [{ id: "player-a", flavorDe: "Neu." }],
      { players, skipExistingFlavor: false },
    );

    expect(result.updated).toBe(1);
    expect(result.updatedPlayers[0]?.flavorDe).toBe("Neu.");
  });

  it("parses wrapped and jsonl import files", () => {
    const wrapped = parsePlayerFlavorImportFileContents(
      JSON.stringify({ entries: [{ id: "player-a", flavorDe: "A" }] }),
    );
    const jsonl = parsePlayerFlavorImportFileContents('{"id":"player-a","flavorDe":"A"}\n');
    expect(wrapped).toEqual([{ id: "player-a", flavorDe: "A" }]);
    expect(jsonl).toEqual([{ id: "player-a", flavorDe: "A" }]);
  });

  it("persists only flavor changes to stats json", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "flavor-batch-"));
    const statsPath = path.join(dir, "players.json");
    const players = [
      makePlayer({ id: "player-a", name: "Alpha", rating: 10.1 }),
      makePlayer({ id: "player-b", name: "Beta", rating: 20.2 }),
    ];
    writeFileSync(statsPath, `${JSON.stringify(players, null, 2)}\n`, "utf8");

    const result = applyPlayerFlavorImport([{ id: "player-b", flavorDe: "Beta bio." }], { players });
    persistPlayerFlavorImport(result, { statsPath });

    const persisted = JSON.parse(readFileSync(statsPath, "utf8")) as Player[];
    expect(persisted[0]?.flavorDe).toBe("");
    expect(persisted[0]?.rating).toBe(10.1);
    expect(persisted[1]?.flavorDe).toBe("Beta bio.");
    expect(persisted[1]?.rating).toBe(20.2);
  });
});
