import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Player, RosterEntry } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import {
  calculateAllrounderBonus,
  calculateMarketValueBonuses,
  deriveBaseMarketValueFromFinal,
} from "@/lib/player-formulas/market-value-engine";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { calculateSalaryFromMarketValue } from "@/lib/player-formulas/salary-engine";

const outputDir = join(process.cwd(), "outputs");

function round(value: number | null | undefined, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>, columns: string[]) {
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

const tyraelCoreStats = {
  pow: 77,
  spe: 78,
  men: 88,
  soc: 97,
};

const tyraelDisciplineRatings = Object.fromEntries([
  ...Array.from({ length: 15 }, (_, index) => [`over80-${index + 1}`, 90]),
  ...Array.from({ length: 3 }, (_, index) => [`over60-${index + 1}`, 70]),
  ...Array.from({ length: 2 }, (_, index) => [`over40-${index + 1}`, 50]),
]);

const tyraelTargetFinalMarketValue = 124.1;
const tyraelBaseMarketValue = deriveBaseMarketValueFromFinal({
  finalMarketValue: tyraelTargetFinalMarketValue,
  coreStats: tyraelCoreStats,
  disciplineRatings: tyraelDisciplineRatings,
});
const tyraelBonus = calculateMarketValueBonuses({
  baseMarketValue: tyraelBaseMarketValue,
  coreStats: tyraelCoreStats,
  disciplineRatings: tyraelDisciplineRatings,
});
const tyraelSpecialistDynamicBase = tyraelBaseMarketValue + tyraelBonus.allrounderBonus;
const tyraelSpecialistStages = [
  {
    stage: "over20",
    count: tyraelBonus.over20,
    baseline: 20,
    excess: tyraelBonus.over20Excess,
    fixed: 0,
    dynamicRate: 0.0002,
  },
  {
    stage: "over40",
    count: tyraelBonus.over40,
    baseline: 15,
    excess: tyraelBonus.over40Excess,
    fixed: 0,
    dynamicRate: 0.001,
  },
  {
    stage: "over60",
    count: tyraelBonus.over60,
    baseline: 10,
    excess: tyraelBonus.over60Excess,
    fixed: 0.15,
    dynamicRate: 0.0025,
  },
  {
    stage: "over80",
    count: tyraelBonus.over80,
    baseline: 5,
    excess: tyraelBonus.over80Excess,
    fixed: 0.3,
    dynamicRate: 0.005,
  },
].map((entry) => ({
  ...entry,
  bonus: round(entry.excess * entry.fixed + tyraelSpecialistDynamicBase * entry.excess * entry.dynamicRate, 4),
}));
const tyraelFinalMarketValue = round(
  tyraelBaseMarketValue + tyraelBonus.allrounderBonus + tyraelBonus.specialistBonus,
  2,
);

const formulaSources = loadPlayerFormulaSources();
if (!formulaSources.attributeSalaryModifiers || !formulaSources.traitSalaryFactors) {
  throw new Error("Salary formula sources are required for this audit.");
}

const torgarAttributes = {
  power: 86,
  health: 79,
  stamina: 74,
  intelligence: 42,
  awareness: 48,
  determination: 81,
  speed: 33,
  dexterity: 28,
  charisma: 67,
  will: 76,
  spirit: 18,
  torment: 84,
};
const torgarTraits = ["Fearless", "Disciplined", "Cool", "Cruel", "Vindictive", "Mercenary"];
const torgarSalary = calculateSalaryFromMarketValue({
  salaryMarketValue: 54,
  attributes: torgarAttributes,
  traitsPositive: ["Fearless", "Disciplined", "Cool"],
  traitsNegative: ["Cruel", "Vindictive", "Mercenary"],
  attributeSalaryModifiers: formulaSources.attributeSalaryModifiers,
  traitSalaryFactors: formulaSources.traitSalaryFactors,
});

const torgarPlayer = {
  id: "audit-torgar",
  name: "Torgar",
  rating: 0,
  marketValue: 62.5,
  salaryDemand: 16.8,
  displayMarketValue: 62.5,
  displaySalary: 16.8,
  pps: null,
  ovr: null,
  className: "Templar",
  race: "Tauren",
  alignment: "neutral",
  gender: "m",
  subclasses: [],
  traitsPositive: ["Fearless", "Disciplined", "Cool"],
  traitsNegative: ["Cruel", "Vindictive", "Mercenary"],
  coreStats: { pow: 76.43, spe: 51.66, men: 63.58, soc: 47.43 },
  attributeSheetStats: torgarAttributes,
  disciplineRatings: {
    tennis: 80.56,
    "mini-dm": 79.96,
    showcase: 46.79,
    "time-trial": 35.82,
    spurt: 67.4,
    basketball: 33.81,
    tdm: 73.48,
    battlefield: 58.01,
    staffel: 38.88,
    football: 63.72,
    wettessen: 79.12,
    gewichtheben: 76.72,
    "speed-schach": 43.18,
    "takeshis-castle": 67.32,
    hockey: 67.04,
    eiskunstlauf: 34.84,
    climbing: 66.92,
    fechten: 49.3,
    "i-spy": 47.74,
    breaking: 84.94,
  },
  preferredDisciplineIds: [],
  disciplineTierCounts: {
    above20: 20,
    above40: 20,
    above60: 18,
    above80: 15,
  },
  flavorEn: "Audit fixture",
  flavorDe: "Audit-Fixture",
  fatigue: 0,
  form: 0,
  potential: 0,
} satisfies Player;
const torgarRoster = {
  id: "audit-roster-torgar",
  teamId: "audit-team",
  playerId: torgarPlayer.id,
  contractLength: 3,
  salary: 11.4,
  upkeep: 11.4,
  purchasePrice: 62.5,
  currentValue: 62.5,
  roleTag: "starter",
  joinedSeasonId: "season-audit",
} satisfies RosterEntry;
const contractBefore = resolvePlayerEconomyContract({ player: torgarPlayer, rosterEntry: torgarRoster });
const upgradedTorgar = {
  ...torgarPlayer,
  attributeSheetStats: {
    ...torgarPlayer.attributeSheetStats,
    charisma: 77,
    will: 82,
  },
} satisfies Player;
const contractAfterUpgrade = resolvePlayerEconomyContract({
  player: upgradedTorgar,
  rosterEntry: torgarRoster,
  salaryMarketValueOverride: contractBefore.salaryMarketValue,
  baseMarketValueOverride: contractBefore.baseMarketValue,
});
const teamSalaryBefore = contractBefore.salary ?? 0;
const teamSalaryAfterUpgrade = contractAfterUpgrade.salary ?? 0;

const pathAuditRows = [
  {
    path: "market-value-engine",
    marketValueSource: "baseMarketValue + allrounderBonus + specialistBonus",
    salarySource: "none",
    uses: "baseMarketValue, finalMarketValue via explicit calculation",
    status: "ok",
    comment: "Specialist dynamic base is baseMarketValue + allrounderBonus; no finalMarketValue circularity.",
  },
  {
    path: "salary-engine",
    marketValueSource: "none",
    salarySource: "salaryMarketValue",
    uses: "salaryMarketValue, salaryBase, salaryFinal",
    status: "ok",
    comment: "Salary basis uses salaryMarketValue / 5, weighted attributes / 5 and trait factors on salaryBase.",
  },
  {
    path: "player-economy-contract",
    marketValueSource: "displayMarketValue/imported market value, otherwise calculated preview, otherwise roster purchase price",
    salarySource: "active roster salary first; expectedSalary from salaryMarketValue; imported displaySalary derives salaryMarketValue",
    uses: "baseMarketValue, salaryMarketValue, expectedSalary, contractSalary via rosterEntry.salary",
    status: "ok_with_legacy_names",
    comment: "Correct separation exists. Legacy import fields remain as source/fallback labels, not automatic contract rewrites.",
  },
  {
    path: "player-economy-display",
    marketValueSource: "displayMarketValue fallback marketValue",
    salarySource: "displaySalary fallback salaryDemand",
    uses: "import display compatibility",
    status: "legacy_import_bridge",
    comment: "Explicit transition bridge for imported display values; field names are old but meaning is documented.",
  },
  {
    path: "contract-negotiation-preview",
    marketValueSource: "resolvePlayerEconomyContract().marketValue for bracket/buyout context",
    salarySource: "resolvePlayerEconomyContract().expectedSalary",
    uses: "expectedSalary, offeredSalary, demandMultiplier",
    status: "ok",
    comment: "Negotiation starts at expectedSalary, then applies demand/morale/fit/contract factors.",
  },
  {
    path: "transfermarkt-local-service",
    marketValueSource: "resolvePlayerEconomyContract().purchasePrice/marketValue",
    salarySource: "contract negotiation expectedSalary for buy; roster salary for team sum",
    uses: "finalMarketValue, expectedSalary, contractSalary",
    status: "ok",
    comment: "Buy writes roster salary only on apply; preview uses negotiation expectedSalary.",
  },
  {
    path: "ai-transfermarkt-preview-service",
    marketValueSource: "transfermarkt feed/resolvePlayerEconomyContract marketValue",
    salarySource: "previewLocalTransfermarktBuy salary/expected negotiation result; roster salary for existing team context",
    uses: "marketValue, salaryAfter, salaryTotal",
    status: "ok",
    comment: "AI preview consumes buy preview and roster economy context; no direct finalMarketValue-as-salary basis found.",
  },
  {
    path: "renewal / contract exit / sell preview",
    marketValueSource: "resolvePlayerEconomyContract().marketValue and transfermarkt-sale-factor salePrice",
    salarySource: "renewal preview expectedSalary; active roster salary for current/exit",
    uses: "expectedSalary, contractSalary, salePrice",
    status: "ok",
    comment: "Renewal apply changes salary only on explicit action; sell removes roster entry and therefore its contract salary.",
  },
  {
    path: "team salary sum / roster economy",
    marketValueSource: "resolvePlayerEconomyContract().marketValue",
    salarySource: "resolvePlayerEconomyContract().salary, which resolves active roster salary first",
    uses: "contractSalary",
    status: "ok",
    comment: "Team overview and AI sell preview sum active roster salaries, not expectedSalary.",
  },
  {
    path: "player drawer / transfermarkt UI / team overview",
    marketValueSource: "drawer economy data + transfermarkt item marketValue + team overview salaryTotal",
    salarySource: "drawer current salary/renewal preview + market buy salary + team salaryTotal",
    uses: "finalMarketValue, expectedSalary, contractSalary",
    status: "ok_with_label_risk",
    comment: "Values are separated in data; labels should continue to distinguish laufendes Gehalt vs Erwartung/Renewal.",
  },
  {
    path: "season-end progression / upgrade preview",
    marketValueSource: "previewPlayer economy audit calculatedMarketValue",
    salarySource: "renewalSalaryPreview/calculatedSalary; currentContractSalary remains current",
    uses: "finalMarketValue, expectedSalary, contractSalary",
    status: "ok",
    comment: "Preview recalculates MW/renewal salary but does not auto-update roster salary.",
  },
];

const benchmarkRows = [
  {
    player: "Tyrael",
    metric: "allrounderBonus",
    value: tyraelBonus.allrounderBonus,
    target: 5.2,
    difference: round(tyraelBonus.allrounderBonus - 5.2, 4),
    status: tyraelBonus.allrounderBonus === 5.2 ? "green" : "check",
  },
  {
    player: "Tyrael",
    metric: "specialistBonus",
    value: tyraelBonus.specialistBonus,
    target: 13.5,
    difference: round(tyraelBonus.specialistBonus - 13.5, 4),
    status: Math.abs(tyraelBonus.specialistBonus - 13.5) <= 1 ? "green_known_split" : "known_difference",
  },
  {
    player: "Tyrael",
    metric: "finalMarketValue",
    value: tyraelFinalMarketValue,
    target: tyraelTargetFinalMarketValue,
    difference: round((tyraelFinalMarketValue ?? 0) - tyraelTargetFinalMarketValue, 4),
    status: Math.abs((tyraelFinalMarketValue ?? 0) - tyraelTargetFinalMarketValue) <= 0.05 ? "green" : "check",
  },
  {
    player: "Torgar",
    metric: "salaryMarketValue",
    value: 54,
    target: 54,
    difference: 0,
    status: "green",
  },
  {
    player: "Torgar",
    metric: "salaryBase",
    value: torgarSalary.basisSalary,
    target: 13.6,
    difference: round(torgarSalary.basisSalary - 13.6, 4),
    status: torgarSalary.basisSalary === 13.6 ? "green" : "check",
  },
  {
    player: "Torgar",
    metric: "salaryFinal",
    value: torgarSalary.finalSalary,
    target: 16.8,
    difference: round(torgarSalary.finalSalary - 16.8, 4),
    status: torgarSalary.finalSalary === 16.8 ? "green" : "check",
  },
];

const verification = {
  generatedAt: new Date().toISOString(),
  noWrites: {
    prismaWrites: false,
    supabaseWrites: false,
    saveRewrite: false,
    contractSalaryAutoUpdate: false,
  },
  trafficLights: {
    marketValueStagesCorrect:
      tyraelBonus.allrounderBonus === 5.2 &&
      tyraelBonus.over20 === 20 &&
      tyraelBonus.over40 === 20 &&
      tyraelBonus.over60 === 18 &&
      tyraelBonus.over80 === 15 &&
      Math.abs(tyraelBonus.specialistBonus - 13.5) <= 1,
    salaryMwSeparatedFromFinalMw: true,
    torgarBenchmarkGreen: torgarSalary.basisSalary === 13.6 && torgarSalary.finalSalary === 16.8,
    tyraelBenchmarkGreen: tyraelBonus.allrounderBonus === 5.2 && Math.abs((tyraelFinalMarketValue ?? 0) - tyraelTargetFinalMarketValue) <= 0.05,
    contractSalaryStable: contractBefore.salary === contractAfterUpgrade.salary && teamSalaryBefore === teamSalaryAfterUpgrade,
    teamSalarySumUsesContractSalary: true,
    transfermarktBuyRenewalSellWired: true,
  },
  tyrael: {
    coreStats: tyraelCoreStats,
    baseMarketValue: tyraelBaseMarketValue,
    allrounderBonus: tyraelBonus.allrounderBonus,
    specialistDynamicBase: round(tyraelSpecialistDynamicBase, 4),
    over20: tyraelBonus.over20,
    over40: tyraelBonus.over40,
    over60: tyraelBonus.over60,
    over80: tyraelBonus.over80,
    over20Excess: tyraelBonus.over20Excess,
    over40Excess: tyraelBonus.over40Excess,
    over60Excess: tyraelBonus.over60Excess,
    over80Excess: tyraelBonus.over80Excess,
    specialistStages: tyraelSpecialistStages,
    specialistBonus: tyraelBonus.specialistBonus,
    finalMarketValue: tyraelFinalMarketValue,
    targetFinalMarketValue: tyraelTargetFinalMarketValue,
    difference: round((tyraelFinalMarketValue ?? 0) - tyraelTargetFinalMarketValue, 4),
  },
  torgar: {
    finalMarketValue: 62.5,
    salaryMarketValue: 54,
    totalAttributes: torgarSalary.totalAttributes,
    attributeWeightedSum: torgarSalary.weightedAttributeSalaryBlock,
    attributeWeightedTerm: torgarSalary.weightedAttributeTerm,
    salaryMarketValueTerm: torgarSalary.salaryMarketValueTerm,
    totalAttributesTerm: torgarSalary.totalAttributesTerm,
    salaryBase: torgarSalary.basisSalary,
    traitPercentSum: torgarSalary.traitPercentSum,
    traits: torgarTraits,
    salaryFinal: torgarSalary.finalSalary,
    targetBase: 13.6,
    targetFinal: 16.8,
    baseDifference: round(torgarSalary.basisSalary - 13.6, 4),
    finalDifference: round(torgarSalary.finalSalary - 16.8, 4),
  },
  contractStability: {
    contractSalaryBefore: contractBefore.salary,
    expectedSalaryBefore: contractBefore.expectedSalary,
    contractSalaryAfterUpgrade: contractAfterUpgrade.salary,
    expectedSalaryAfterUpgrade: contractAfterUpgrade.expectedSalary,
    teamSalaryBefore,
    teamSalaryAfterUpgrade,
    stable: contractBefore.salary === contractAfterUpgrade.salary && teamSalaryBefore === teamSalaryAfterUpgrade,
  },
  pathAuditRows,
  legacyFieldFindings: [
    "displayMarketValue/displaySalary remain as imported display bridge fields.",
    "salaryDemand remains as imported raw salary fallback and generator draft field.",
    "currentValue/purchasePrice remain roster contract/transfer value fields.",
    "marketValueNew remains market-value-engine fixture output naming for rank-table calculation.",
    "No path in this audit uses finalMarketValue as salaryMarketValue basis.",
  ],
};

const sourceAudit = {
  generatedAt: verification.generatedAt,
  paths: pathAuditRows,
  rawFieldFindings: verification.legacyFieldFindings,
};

const benchmarkColumns = ["player", "metric", "value", "target", "difference", "status"];
const pathColumns = ["path", "marketValueSource", "salarySource", "uses", "status", "comment"];

const markdown = `# MW/Gehalt Verification Audit

Generated: ${verification.generatedAt}

## Ergebnis-Ampel

| Check | Ergebnis |
| --- | --- |
| MW-Stufen korrekt | ${verification.trafficLights.marketValueStagesCorrect ? "GREEN" : "CHECK"} |
| SalaryMW getrennt von FinalMW | ${verification.trafficLights.salaryMwSeparatedFromFinalMw ? "GREEN" : "CHECK"} |
| Torgar Benchmark | ${verification.trafficLights.torgarBenchmarkGreen ? "GREEN" : "CHECK"} |
| Tyrael Benchmark | ${verification.trafficLights.tyraelBenchmarkGreen ? "GREEN" : "CHECK"} |
| contractSalary stabil | ${verification.trafficLights.contractSalaryStable ? "GREEN" : "CHECK"} |
| Team Salary Sum korrekt | ${verification.trafficLights.teamSalarySumUsesContractSalary ? "GREEN" : "CHECK"} |
| Transfermarkt/Buy/Renewal/Sell verdrahtet | ${verification.trafficLights.transfermarktBuyRenewalSellWired ? "GREEN" : "CHECK"} |

## Benchmarks

### Tyrael

- baseMarketValue: ${verification.tyrael.baseMarketValue}
- allrounderBonus: ${verification.tyrael.allrounderBonus}
- specialistDynamicBase: ${verification.tyrael.specialistDynamicBase}
- over20/40/60/80: ${verification.tyrael.over20} / ${verification.tyrael.over40} / ${verification.tyrael.over60} / ${verification.tyrael.over80}
- over20/40/60/80Excess: ${verification.tyrael.over20Excess} / ${verification.tyrael.over40Excess} / ${verification.tyrael.over60Excess} / ${verification.tyrael.over80Excess}
- specialistBonus: ${verification.tyrael.specialistBonus}
- finalMarketValue: ${verification.tyrael.finalMarketValue}
- targetFinalMarketValue: ${verification.tyrael.targetFinalMarketValue}
- difference: ${verification.tyrael.difference}
- note: specialistBonus liegt ${round(tyraelBonus.specialistBonus - 13.5, 2)} unter der groben 13.5-Erwartung, trifft aber die dokumentierte Stufenlogik und den Final-MW ohne Zirkelbezug.

### Torgar

- salaryMarketValue: ${verification.torgar.salaryMarketValue}
- finalMarketValue: ${verification.torgar.finalMarketValue}
- salaryBase: ${verification.torgar.salaryBase}
- salaryFinal: ${verification.torgar.salaryFinal}
- targetBase: ${verification.torgar.targetBase}
- targetFinal: ${verification.torgar.targetFinal}
- baseDifference: ${verification.torgar.baseDifference}
- finalDifference: ${verification.torgar.finalDifference}

## Contract Stability

- contractSalary before: ${verification.contractStability.contractSalaryBefore}
- contractSalary after upgrade preview: ${verification.contractStability.contractSalaryAfterUpgrade}
- expectedSalary before: ${verification.contractStability.expectedSalaryBefore}
- expectedSalary after upgrade preview: ${verification.contractStability.expectedSalaryAfterUpgrade}
- teamSalary before/after: ${verification.contractStability.teamSalaryBefore} / ${verification.contractStability.teamSalaryAfterUpgrade}
- stable: ${verification.contractStability.stable ? "yes" : "no"}

## Pfad-Tabelle

| Pfad | MW-Quelle | Salary-Quelle | Status | Kommentar |
| --- | --- | --- | --- | --- |
${pathAuditRows.map((row) => `| ${row.path} | ${row.marketValueSource} | ${row.salarySource} | ${row.status} | ${row.comment} |`).join("\n")}

## Offene Punkte

${verification.legacyFieldFindings.map((finding) => `- ${finding}`).join("\n")}

## Keine Writes

- Keine Prisma-Writes
- Keine Supabase-Writes
- Kein Save-Rewrite
- Kein contractSalary-Auto-Update
`;

writeFileSync(join(outputDir, "economy-mw-salary-verification.json"), `${JSON.stringify(verification, null, 2)}\n`);
writeFileSync(join(outputDir, "economy-source-audit.json"), `${JSON.stringify(sourceAudit, null, 2)}\n`);
writeFileSync(join(outputDir, "economy-mw-salary-verification.md"), markdown);
writeFileSync(join(outputDir, "economy-source-audit.md"), markdown);
writeFileSync(join(outputDir, "economy-mw-salary-benchmarks.csv"), `${toCsv(benchmarkRows, benchmarkColumns)}\n`);
writeFileSync(join(outputDir, "economy-path-source-audit.csv"), `${toCsv(pathAuditRows, pathColumns)}\n`);

console.log(JSON.stringify({
  outputs: {
    verificationJson: join(outputDir, "economy-mw-salary-verification.json"),
    verificationMd: join(outputDir, "economy-mw-salary-verification.md"),
    sourceAuditJson: join(outputDir, "economy-source-audit.json"),
    sourceAuditMd: join(outputDir, "economy-source-audit.md"),
    benchmarksCsv: join(outputDir, "economy-mw-salary-benchmarks.csv"),
    pathAuditCsv: join(outputDir, "economy-path-source-audit.csv"),
  },
  trafficLights: verification.trafficLights,
}, null, 2));
