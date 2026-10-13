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

describe("CostSettings-Schema", () => {
  it("Spalten-Defaults der DB (Migration) stimmen mit DEFAULT_COST_SETTINGS ueberein", async () => {
    // Regression: Defaults in Schema/Migration und TypeScript duerfen nicht auseinanderlaufen
    // (Fixkosten 1140/840/360/50/1839, Einkaufs-Versand 50 %, Einschreiben 2,35/30/100).
    await db.prisma.costSettings.create({ data: {} });
    const loaded = await loadActiveCostSettings(db.prisma);
    expect(loaded).toEqual(DEFAULT_COST_SETTINGS);
  });

  it("speichert und laedt die neuen Felder (Anteil, Einschreiben, Lizenz, Sonstige)", async () => {
    const custom = {
      ...DEFAULT_COST_SETTINGS,
      buyShippingShareFactor: 0.4,
      registeredCostPerShipment: 2.5,
      registeredThreshold: 25,
      registeredStampsPerYear: 120,
      fixedYearlyPackagingLicense: 60,
      fixedYearlyOther: 2000,
    };
    await saveCostSettings(db.prisma, custom);
    expect(await loadActiveCostSettings(db.prisma)).toEqual(custom);
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
