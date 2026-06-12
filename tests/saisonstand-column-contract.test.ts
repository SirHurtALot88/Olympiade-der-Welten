import { describe, expect, it } from "vitest";

import contractJson from "@/references/retool-standings-economy/saisonstand-column-contract.json";
import {
  getSaisonstandCompactContractColumns,
  getSaisonstandExpertContractColumns,
  saisonstandFinanceColumns,
  saisonstandExpertPresetOrder,
} from "@/lib/foundation/saisonstand-column-contract";

const expectedDisciplineKeys = [
  "schach",
  "tdm",
  "gewichtheben",
  "eiskunst",
  "fechten",
  "spurt",
  "football",
  "showcase",
  "takeshi",
  "breaking",
  "hockey",
  "tennis",
  "battlefield",
  "mini_dm",
  "climbing",
  "basketball",
  "i_spy",
  "staffel",
  "wettessen",
  "time_trial",
];

describe("saisonstand column contract", () => {
  it("uses the exact extracted retool saisonstand source", () => {
    expect(contractJson.sourceAppExportPath).toContain("Olympiade%20der%20Welten%20Draftboard (7).json");
    expect(contractJson.sourceComponentId).toBe("saisonstandTable");
    expect(contractJson.sourcePage).toBe("Saisonstand");
    expect(contractJson.dataSourceExpression).toBe("{{ sortedSaisonstand.value }}");
    expect(contractJson.columns).toHaveLength(39);
  });

  it("preserves the exact retool column order", () => {
    expect(contractJson.columns.map((column) => column.retoolColumnName)).toEqual([
      "Platzierung",
      "Kürzel",
      "Cash FC",
      "Schach",
      "TDM",
      "Gehalt",
      "GuV",
      "Startplatz",
      "Sponsor Season",
      "Gewichtheben",
      "Eiskunst",
      "Cash Total",
      "Fechten",
      "Spurt",
      "Punkte",
      "Football",
      "Showcase",
      "Basis",
      "Takeshi",
      "Breaking",
      "Hockey",
      "Tennis",
      "Battlefield",
      "Mini DM",
      "Platz",
      "Bonuspunkte",
      "Climbing",
      "Sponsor Total",
      "Basketball",
      "Ø Vertragslänge",
      "Mannschaft",
      "I Spy",
      "Cash",
      "Staffel",
      "Wettessen",
      "Time Trial",
      "Form",
      "Rank Diff",
      "Transfers",
    ]);
  });

  it("keeps retool source mapping but fixes the visible klasse bug to team", () => {
    const teamColumn = contractJson.columns.find((column) => column.retoolColumnName === "Mannschaft");
    const shortCodeColumn = contractJson.columns.find((column) => column.retoolColumnName === "Kürzel");

    expect(teamColumn?.displayLabel).toBe("Team");
    expect(teamColumn?.normalizedKey).toBe("mannschaft");
    expect(teamColumn?.currentAppField).toBe("teamName");
    expect(teamColumn?.notes).toContain("Retool bug");
    expect(shortCodeColumn?.hiddenInRetool).toBe(true);
    expect(shortCodeColumn?.sourceStatus).toBe("intentionally_hidden");
  });

  it("maps season core plus the direct discipline sheet columns", () => {
    const mappedKeys = contractJson.columns
      .filter((column) => column.sourceStatus === "mapped" || column.sourceStatus === "mapped_with_transform")
      .map((column) => column.normalizedKey);

    expect(mappedKeys).toEqual([
      "platzierung",
      "cash_fc",
      "schach",
      "tdm",
      "gehalt",
      "guv",
      "startplatz",
      "sponsor_season",
      "gewichtheben",
      "eiskunst",
      "cash_total",
      "fechten",
      "spurt",
      "punkte",
      "football",
      "showcase",
      "basis",
      "takeshi",
      "breaking",
      "hockey",
      "tennis",
      "battlefield",
      "mini_dm",
      "platz",
      "climbing",
      "sponsor_total",
      "basketball",
      "vertragslange",
      "mannschaft",
      "i_spy",
      "cash",
      "staffel",
      "wettessen",
      "time_trial",
      "form",
      "rank_diff",
      "transfers",
    ]);
  });

  it("maps every retool discipline column directly to a season standings sheet value", () => {
    const disciplineEntries = contractJson.columns.filter((column) =>
      expectedDisciplineKeys.includes(column.normalizedKey),
    );

    expect(disciplineEntries).toHaveLength(expectedDisciplineKeys.length);
    expect(disciplineEntries.map((column) => column.normalizedKey)).toEqual(expectedDisciplineKeys);
    expect(disciplineEntries.every((column) => column.currentAppField === `disciplineValues.${column.normalizedKey}`)).toBe(true);
    expect(disciplineEntries.every((column) => column.sourceKind === "sheet_value")).toBe(true);
    expect(disciplineEntries.every((column) => column.sourceStatus === "mapped_with_transform")).toBe(true);
  });

  it("keeps compact mode on the verified season core without mw, pps, ovr or mvs", () => {
    expect(getSaisonstandCompactContractColumns().map((column) => column.normalizedKey)).toEqual([
      "platz",
      "mannschaft",
      "punkte",
      "tdm",
      "mini_dm",
      "gewichtheben",
      "hockey",
      "breaking",
      "staffel",
      "time_trial",
      "spurt",
      "climbing",
      "fechten",
      "schach",
      "takeshi",
      "tennis",
      "i_spy",
      "wettessen",
      "basketball",
      "football",
      "battlefield",
      "eiskunst",
      "showcase",
      "vertragslange",
    ]);

    const allKeys = contractJson.columns.map((column) => column.normalizedKey);
    expect(allKeys).not.toContain("mw");
    expect(allKeys).not.toContain("pps");
    expect(allKeys).not.toContain("ovr");
    expect(allKeys).not.toContain("mvs");
  });

  it("keeps expert mode aligned to the retool table except hidden columns", () => {
    const expertColumns = getSaisonstandExpertContractColumns();

    expect(expertColumns).toHaveLength(38);
    expect(expertColumns.some((column) => column.hiddenInRetool)).toBe(false);
    expect(expertColumns.map((column) => column.normalizedKey)).toEqual(saisonstandExpertPresetOrder);
    expect(expertColumns.map((column) => column.normalizedKey)).not.toContain("actions");
  });

  it("locks the expert preset into left core, middle diszis and right finance blocks", () => {
    expect(saisonstandExpertPresetOrder.slice(0, 4)).toEqual(["platz", "mannschaft", "punkte", "bonuspunkte"]);
    expect(saisonstandExpertPresetOrder.slice(-saisonstandFinanceColumns.length)).toEqual([...saisonstandFinanceColumns]);
  });

  it("pins season-specific display rules from the real retool widget", () => {
    const cashColumn = contractJson.columns.find((column) => column.normalizedKey === "cash");
    const contractColumn = contractJson.columns.find((column) => column.normalizedKey === "vertragslange");
    const transfersColumn = contractJson.columns.find((column) => column.normalizedKey === "transfers");
    const pointsColumn = contractJson.columns.find((column) => column.normalizedKey === "punkte");

    expect(cashColumn?.decimalPlaces).toBe(1);
    expect(cashColumn?.sourceStatus).toBe("mapped_with_transform");
    expect(cashColumn?.valueTransform).toBe("fixed_1");
    expect(contractColumn?.decimalPlaces).toBe(1);
    expect(transfersColumn?.sourceStatus).toBe("mapped_with_transform");
    expect(transfersColumn?.currentAppField).toBe("transfersSeasonValue");
    expect(pointsColumn?.sortRole).toBe("points_desc");
  });

  it("keeps every open finance column in an explicit mapped or blocked state", () => {
    const byKey = new Map(contractJson.columns.map((column) => [column.normalizedKey, column]));

    expect(byKey.get("cash_fc")?.sourceStatus).toBe("mapped_with_transform");
    expect(byKey.get("startplatz")?.sourceStatus).toBe("mapped_with_transform");
    expect(byKey.get("basis")?.sourceStatus).toBe("mapped_with_transform");
    expect(byKey.get("platzierung")?.sourceStatus).toBe("mapped_with_transform");
    expect(byKey.get("sponsor_total")?.sourceStatus).toBe("mapped_with_transform");
    expect(byKey.get("guv")?.sourceStatus).toBe("mapped_with_transform");
    expect(byKey.get("cash_total")?.sourceStatus).toBe("mapped_with_transform");
    expect(byKey.get("form")?.sourceStatus).toBe("mapped_with_transform");
    expect(byKey.get("rank_diff")?.sourceStatus).toBe("mapped_with_transform");
    expect(byKey.get("transfers")?.sourceStatus).toBe("mapped_with_transform");
    expect(byKey.get("sponsor_season")?.sourceStatus).toBe("mapped_with_transform");
    expect(byKey.get("sponsor_season")?.currentAppField).toBe("sponsorSeason");
    expect(byKey.get("bonuspunkte")?.sourceStatus).toBe("legacy_not_ported");
  });
});
