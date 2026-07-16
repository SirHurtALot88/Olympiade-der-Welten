import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../pipeline/testDb";
import { loadActiveCostSettings, saveCostSettings } from "./queries";
import { DEFAULT_COST_SETTINGS } from "../pricing/costSettings";

let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
});
afterEach(async () => {
  await db.cleanup();
});

describe("loadActiveCostSettings", () => {
  it("faellt auf die Konzept-Defaults zurueck, wenn noch keine Version gespeichert ist", async () => {
    const settings = await loadActiveCostSettings(db.prisma);
    expect(settings).toEqual(DEFAULT_COST_SETTINGS);
  });
});

describe("saveCostSettings", () => {
  it("legt eine neue Version an, statt zu ueberschreiben (alte Version wird inaktiv)", async () => {
    const first = await saveCostSettings(db.prisma, { ...DEFAULT_COST_SETTINGS, ebayCommissionRate: 0.12 });
    expect(first.version).toBe(1);
    expect(first.active).toBe(true);

    const second = await saveCostSettings(db.prisma, { ...DEFAULT_COST_SETTINGS, ebayCommissionRate: 0.15 });
    expect(second.version).toBe(2);
    expect(second.active).toBe(true);

    const allVersions = await db.prisma.costSettings.findMany({ orderBy: { version: "asc" } });
    expect(allVersions).toHaveLength(2);
    expect(allVersions[0].active).toBe(false);
    expect(allVersions[1].active).toBe(true);

    const active = await loadActiveCostSettings(db.prisma);
    expect(active.ebayCommissionRate).toBeCloseTo(0.15);
  });
});
