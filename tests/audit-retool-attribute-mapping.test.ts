import path from "node:path";
import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { buildRetoolAttributeMappingAudit } from "@/scripts/audit-retool-attribute-mapping";
import { extractRetoolPlayerAttributes } from "@/scripts/extract-retool-player-attributes";

describe("audit retool attribute mapping", () => {
  const base = path.join(process.cwd(), "references/retool-player-attributes");

  it("marks blocked when only query metadata exists", () => {
    extractRetoolPlayerAttributes();
    if (fs.existsSync(`${base}/attribute-data.json`)) fs.rmSync(`${base}/attribute-data.json`);
    if (fs.existsSync(`${base}/attribute-data.csv`)) fs.rmSync(`${base}/attribute-data.csv`);

    const result = buildRetoolAttributeMappingAudit();
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toContain("Attribute data missing");
  });

  it("detects matching when fixture data is present", () => {
    extractRetoolPlayerAttributes();
    fs.writeFileSync(
      `${base}/attribute-data.json`,
      JSON.stringify([
        {
          name: "Umbros",
          power: 72,
          health: 60,
          stamina: 58,
          determination: 64,
          speed: 51,
          dexterity: 48,
          intelligence: 55,
          awareness: 53,
          will: 57,
          charisma: 44,
          spirit: 42,
          torment: 39,
          power_rating: "A",
          health_rating: "B",
          stamina_rating: "B",
          determination_rating: "C",
          speed_rating: "D",
          dexterity_rating: "E",
          intelligence_rating: "A",
          awareness_rating: "B",
          will_rating: "C",
          charisma_rating: "D",
          spirit_rating: "E",
          torment_rating: "F",
        },
      ]),
      "utf8",
    );

    const result = buildRetoolAttributeMappingAudit();
    expect(result.status).toBe("ok");
    expect(result.dataAvailable).toBe(true);
    expect(result.exactMatches).toBeGreaterThan(0);
    expect(result.matchRate).toBeGreaterThan(0);
    expect(result.invalidNumbers).toHaveLength(0);
    expect(result.invalidRatings).toHaveLength(0);

    fs.rmSync(`${base}/attribute-data.json`);
  });

  it("blocks when a required field is missing", () => {
    extractRetoolPlayerAttributes();
    fs.writeFileSync(
      `${base}/attribute-data.json`,
      JSON.stringify([
        {
          name: "Umbros",
          power: 72,
        },
      ]),
      "utf8",
    );

    const result = buildRetoolAttributeMappingAudit();
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toContain("Missing required attribute fields");

    fs.rmSync(`${base}/attribute-data.json`);
  });

  it("reports duplicate names and invalid ratings", () => {
    extractRetoolPlayerAttributes();
    fs.writeFileSync(
      `${base}/attribute-data.json`,
      JSON.stringify([
        {
          name: "Umbros",
          power: 72,
          health: 60,
          stamina: 58,
          determination: 64,
          speed: 51,
          dexterity: 48,
          intelligence: 55,
          awareness: 53,
          will: 57,
          charisma: 44,
          spirit: 42,
          torment: 39,
          power_rating: "A",
          health_rating: "B",
          stamina_rating: "B",
          determination_rating: "C",
          speed_rating: "D",
          dexterity_rating: "E",
          intelligence_rating: "A",
          awareness_rating: "B",
          will_rating: "C",
          charisma_rating: "D",
          spirit_rating: "E",
          torment_rating: "F",
        },
        {
          name: "Umbros",
          power: 72,
          health: 60,
          stamina: 58,
          determination: 64,
          speed: 51,
          dexterity: 48,
          intelligence: 55,
          awareness: 53,
          will: 57,
          charisma: 44,
          spirit: 42,
          torment: 39,
          power_rating: "BROKEN",
          health_rating: "B",
          stamina_rating: "B",
          determination_rating: "C",
          speed_rating: "D",
          dexterity_rating: "E",
          intelligence_rating: "A",
          awareness_rating: "B",
          will_rating: "C",
          charisma_rating: "D",
          spirit_rating: "E",
          torment_rating: "F",
        },
      ]),
      "utf8",
    );

    const result = buildRetoolAttributeMappingAudit();
    expect(result.status).toBe("ok");
    expect(result.duplicateNames).toContain("Umbros");
    expect(result.invalidRatings.some((entry) => entry.field === "power_rating")).toBe(true);

    fs.rmSync(`${base}/attribute-data.json`);
  });

  it("stays read-only without write operations to prisma", () => {
    const text = fs.readFileSync(
      path.join(process.cwd(), "scripts/audit-retool-attribute-mapping.ts"),
      "utf8",
    );

    expect(text).not.toContain("createMany");
    expect(text).not.toContain("update(");
    expect(text).not.toContain("upsert(");
    expect(text).not.toContain("deleteMany");
  });
});
