import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { buildPlayerAttributesAuditReport, parseCsvHeader } from "@/scripts/audit-player-attributes-source";

const sampleCsvHeader =
  "Name,Marktwert,Gehalt,Pow,Spe,Men,Soc,>20,>40,>60,>80,Bild,Bracket,";

const sampleSchema = `
model PlayerAttribute {
  id String @id
  pow Float
  spe Float
  men Float
  soc Float
}
`;

const samplePlayers = [
  {
    id: "player-1",
    name: "Umbros",
    coreStats: {
      pow: 78.51,
      spe: 59.61,
      men: 63.64,
      soc: 59.54,
    },
  },
];

describe("player attributes source audit", () => {
  it("parses the player sheet header correctly", () => {
    expect(parseCsvHeader(sampleCsvHeader)).toContain("Pow");
    expect(parseCsvHeader(sampleCsvHeader)).toContain("Spe");
    expect(parseCsvHeader(sampleCsvHeader)).not.toContain("Hea");
  });

  it("detects real attributes and proxy-only fields", () => {
    const report = buildPlayerAttributesAuditReport({
      sourcePlayers: samplePlayers,
      sourceHeaders: parseCsvHeader(sampleCsvHeader),
      schemaText: sampleSchema,
    });

    const power = report.attributes.find((attribute) => attribute.key === "power");
    const speed = report.attributes.find((attribute) => attribute.key === "speed");
    const health = report.attributes.find((attribute) => attribute.key === "health");
    const torment = report.attributes.find((attribute) => attribute.key === "torment");

    expect(power?.sourceExists).toBe(true);
    expect(power?.dbExists).toBe(true);
    expect(speed?.sourceExists).toBe(true);
    expect(speed?.dbExists).toBe(true);
    expect(health?.sourceExists).toBe(false);
    expect(health?.proxyOnly).toBe(true);
    expect(health?.proxyFrom).toEqual(["pow"]);
    expect(torment?.sourceExists).toBe(false);
    expect(torment?.proxyOnly).toBe(true);
    expect(report.recommendation).toBe("partial_import_possible");
  });

  it("documents the current transfermarkt proxy path", async () => {
    const [sheetStatsText, contractText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/market/transfermarkt-sheet-stats.ts",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/market/transfermarkt-column-contract.ts",
        "utf8",
      ),
    ]);

    expect(sheetStatsText).toContain("buildProxyRatings");
    expect(sheetStatsText).toContain("healthRating: getTransfermarktTierFromPoints(pow)");
    expect(sheetStatsText).toContain("staminaRating: getTransfermarktTierFromPoints(spe)");
    expect(sheetStatsText).toContain("intelligenceRating: getTransfermarktTierFromPoints(men)");
    expect(sheetStatsText).toContain("charismaRating: getTransfermarktTierFromPoints(soc)");
    expect(contractText).toContain('label: "Hea"');
    expect(contractText).toContain('label: "Tor"');
  });

  it("stays read-only without write operations", async () => {
    const scriptText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/scripts/audit-player-attributes-source.ts",
      "utf8",
    );

    expect(scriptText).not.toContain("createMany");
    expect(scriptText).not.toContain("update(");
    expect(scriptText).not.toContain("upsert(");
    expect(scriptText).not.toContain("deleteMany");
  });
});
