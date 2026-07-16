import fs from "node:fs";
import path from "node:path";

import type { GameState, Player, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import {
  calculateThemeCompositionScore,
  derivePlayerThemeTags,
  getTeamThemeCompositionTarget,
} from "@/lib/ai/team-theme-composition-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const OUTPUT_DIR = path.join(process.env.OLY_EXPORT_DIR ?? "outputs", "team-identity-quota-audit");

type Level = "GREEN" | "YELLOW" | "RED";

type QuotaRule = {
  column: string;
  label: string;
  target: number;
  minimum?: number;
  isMatch: (player: Player, tags: Set<string>) => boolean;
  hard?: boolean;
};

const SPECIAL_QUOTAS: Record<string, QuotaRule[]> = {
  "H-R": [
    {
      column: "hellDemonShare",
      label: "Demon/Hell",
      target: 0.75,
      isMatch: (_player, tags) =>
        hasAny(tags, ["Demon", "Hell", "Infernal", "Devil", "Fiend", "PrimeEvil", "Succubus", "Incubus", "SexyDemon"]),
      hard: true,
    },
  ],
  "L-K": [
    {
      column: "undeadShare",
      label: "Undead/Vampire/Skeleton/Ghoul",
      target: 0.75,
      isMatch: (_player, tags) => hasAny(tags, ["Undead", "Vampire", "Skeleton", "Ghoul", "Lich", "Zombie", "Ghost"]),
      hard: true,
    },
  ],
  "P-C": [
    {
      column: "pirateShare",
      label: "Pirate/Swashbuckler/Wayfarer",
      target: 0.75,
      isMatch: (_player, tags) => hasAny(tags, ["Pirate", "Swashbuckler", "Wayfarer", "Corsair"]),
      hard: true,
    },
  ],
  "V-D": [
    {
      column: "femalePetShare",
      label: "Female/Pet",
      target: 1,
      minimum: 1,
      isMatch: (player, tags) => isFemale(player, tags) || isPet(player, tags),
      hard: true,
    },
  ],
  "D-P": [
    {
      column: "femaleShare",
      label: "Female",
      target: 0.8,
      isMatch: (player, tags) => isFemale(player, tags),
      hard: true,
    },
    {
      column: "demonDarkShare",
      label: "Demon/Dark",
      target: 0.6,
      minimum: 0.45,
      isMatch: (_player, tags) => hasAny(tags, ["Demon", "Hell", "Infernal", "Succubus", "SexyDemon", "Dark", "Shadow", "Temptress"]),
      hard: false,
    },
  ],
  "T-G": [
    {
      column: "height6Share",
      label: "Height>=6",
      target: 1,
      minimum: 1,
      isMatch: (player, tags) => getHeight(player) >= 6 || hasAny(tags, ["Tall", "Giant", "Colossus", "Titan"]),
      hard: true,
    },
  ],
  "D-L": [
    {
      column: "humanShare",
      label: "Human",
      target: 0.75,
      isMatch: (player, tags) => normalized(player.race) === "human" || tags.has("Human"),
      hard: true,
    },
  ],
  "S-S": [
    {
      column: "constructShare",
      label: "Construct/Bot/Augmented",
      target: 0.6,
      isMatch: (_player, tags) => hasAny(tags, ["Construct", "Robot", "Android", "Machine", "Augmented", "Cyborg", "Steel"]),
      hard: true,
    },
  ],
  "R-R": [
    {
      column: "aquaNatureAlienShare",
      label: "Aqua/Nature/Alien",
      target: 0.6,
      isMatch: (_player, tags) => hasAny(tags, ["Fish", "Aquatic", "Alien", "Nature", "Plant", "River", "Water", "Ocean", "Sea"]),
      hard: false,
    },
  ],
  "W-W": [
    {
      column: "mentalMageArcaneShare",
      label: "Mental/Mage/Arcane/Will/Torment",
      target: 0.5,
      isMatch: (_player, tags) => hasAny(tags, ["Mental", "Mage", "Arcane", "Wizard", "Scholar", "Occult", "Void", "Mystic", "Will", "Torment"]),
      hard: false,
    },
  ],
};

const CSV_COLUMNS = [
  "saveId",
  "saveName",
  "teamId",
  "teamName",
  "status",
  "rosterCount",
  "cashEnd",
  "playerOpt",
  "playerOptGap",
  "avgIdentityFit",
  "avgThemeFit",
  "primaryThemeShare",
  "secondaryThemeShare",
  "combinedThemeShare",
  "forbiddenShare",
  "femaleShare",
  "maleShare",
  "height6Share",
  "hellDemonShare",
  "undeadShare",
  "pirateShare",
  "femalePetShare",
  "demonDarkShare",
  "humanShare",
  "constructShare",
  "aquaNatureAlienShare",
  "mentalMageArcaneShare",
  "hardRuleViolations",
  "yellowGuidance",
  "redFlags",
  "rosterPlayers",
];

function normalized(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function hasAny(tags: Set<string>, candidates: string[]) {
  return candidates.some((tag) => tags.has(tag));
}

function hasHardIdentityOverride(teamId: string, player: Player, tags: Set<string>) {
  switch (teamId) {
    case "H-R":
      return hasAny(tags, ["Demon", "Hell", "Infernal", "Devil", "Fiend", "PrimeEvil", "Succubus", "Incubus", "SexyDemon"]);
    case "P-C":
      return hasAny(tags, ["Pirate", "Swashbuckler", "Wayfarer", "Corsair"]);
    case "D-P":
      return isFemale(player, tags) && hasAny(tags, ["Demon", "Hell", "Infernal", "Succubus", "SexyDemon", "Dark", "Shadow", "Temptress"]);
    case "T-G":
      return getHeight(player) >= 6 || hasAny(tags, ["Tall", "Giant", "Colossus", "Titan"]);
    case "V-D":
      return isFemale(player, tags) || isPet(player, tags);
    case "D-L":
      return normalized(player.race) === "human" || tags.has("Human");
    case "S-S":
      return hasAny(tags, ["Construct", "Robot", "Android", "Machine", "Augmented", "Cyborg", "Steel"]);
    case "L-K":
      return hasAny(tags, ["Undead", "Vampire", "Skeleton", "Ghoul", "Lich", "Zombie", "Ghost"]);
    default:
      return false;
  }
}

function round(value: number | null | undefined, digits = 3) {
  return value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

function csvCell(value: unknown) {
  const normalizedValue =
    value == null
      ? ""
      : Array.isArray(value)
        ? value.join(" | ")
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  return `"${normalizedValue.replaceAll('"', '""')}"`;
}

function toCsv(rows: Array<Record<string, unknown>>, columns = CSV_COLUMNS) {
  return `${[
    columns.map(csvCell).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column] ?? "")).join(",")),
  ].join("\n")}\n`;
}

function getHeight(player: Player) {
  const stats = player.attributeSheetStats as Record<string, unknown> | undefined;
  const value = Number(stats?.height ?? stats?.size ?? stats?.bodySize);
  return Number.isFinite(value) ? value : 0;
}

function isFemale(player: Player, tags: Set<string>) {
  const gender = normalized(player.gender);
  return gender === "w" || gender === "f" || gender === "female" || gender === "weiblich" || tags.has("Female");
}

function isMale(player: Player, tags: Set<string>) {
  const gender = normalized(player.gender);
  return gender === "m" || gender === "male" || gender === "maennlich" || tags.has("Male");
}

function isPet(player: Player, tags: Set<string>) {
  return normalized(player.race) === "animal" || tags.has("Animal") || tags.has("Pet") || tags.has("Beast");
}

function share(count: number, total: number) {
  return total > 0 ? count / total : 0;
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function identityFit(player: Player, identity: TeamIdentity | null) {
  if (!identity) return 50;
  const weights = {
    pow: Math.max(0, Number(identity.pow) || 0),
    spe: Math.max(0, Number(identity.spe) || 0),
    men: Math.max(0, Number(identity.men) || 0),
    soc: Math.max(0, Number(identity.soc) || 0),
  };
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  const weighted =
    player.coreStats.pow * weights.pow +
    player.coreStats.spe * weights.spe +
    player.coreStats.men * weights.men +
    player.coreStats.soc * weights.soc;
  return weighted / total;
}

function buildRosterPlayers(gameState: GameState, teamId: string) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => playerById.get(entry.playerId))
    .filter((player): player is Player => Boolean(player));
}

function classifyStatus(redFlags: string[], yellowGuidance: string[]): Level {
  if (redFlags.length > 0) return "RED";
  if (yellowGuidance.length > 0) return "YELLOW";
  return "GREEN";
}

function auditTeam(input: { saveId: string; saveName: string; gameState: GameState; team: Team }) {
  const { gameState, team } = input;
  const target = getTeamThemeCompositionTarget(team);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
  const rosterPlayers = buildRosterPlayers(gameState, team.teamId);
  const rosterCount = rosterPlayers.length;
  const playerOpt = identity?.playerOpt ?? team.rosterOptTarget ?? team.rosterLimit ?? 0;
  const playerOptGap = Math.max(0, playerOpt - rosterCount);
  const tagRows = rosterPlayers.map((player) => ({ player, row: derivePlayerThemeTags(player) }));
  const tagSets = tagRows.map(({ row }) => new Set(row.playerThemeTags));
  const primaryTags = target?.primaryThemeTags ?? [];
  const secondaryTags = target?.secondaryThemeTags ?? [];
  const softTags = target?.softPreferredTags ?? [];
  const forbiddenTags = target?.avoidTags ?? [];
  const primaryCount = tagSets.filter((tags) => hasAny(tags, primaryTags)).length;
  const secondaryCount = tagSets.filter((tags) => hasAny(tags, secondaryTags)).length;
  const combinedCount = tagSets.filter((tags) => hasAny(tags, [...primaryTags, ...secondaryTags, ...softTags])).length;
  const forbiddenCount = tagSets.filter((tags, index) => {
    if (!hasAny(tags, forbiddenTags)) return false;
    return !hasHardIdentityOverride(team.teamId, tagRows[index].player, tags);
  }).length;
  const quotaValues: Record<string, number> = {};
  const hardRuleViolations: string[] = [];
  const yellowGuidance: string[] = [];
  const redFlags: string[] = [];

  quotaValues.femaleShare = share(tagSets.filter((tags, index) => isFemale(tagRows[index].player, tags)).length, rosterCount);
  quotaValues.maleShare = share(tagSets.filter((tags, index) => isMale(tagRows[index].player, tags)).length, rosterCount);
  quotaValues.height6Share = share(tagSets.filter((tags, index) => getHeight(tagRows[index].player) >= 6 || hasAny(tags, ["Tall", "Giant", "Colossus", "Titan"])).length, rosterCount);

  for (const rule of SPECIAL_QUOTAS[team.teamId] ?? []) {
    const count = tagSets.filter((tags, index) => rule.isMatch(tagRows[index].player, tags)).length;
    const value = share(count, rosterCount);
    quotaValues[rule.column] = value;
    const minimum = rule.minimum ?? rule.target;
    if (value + 0.0001 < minimum) {
      const issue = `${rule.label} ${round(value * 100, 1)}% < ${round(minimum * 100, 1)}%`;
      if (rule.hard) {
        hardRuleViolations.push(issue);
        redFlags.push(issue);
      } else {
        yellowGuidance.push(issue);
      }
    } else if (value + 0.0001 < rule.target) {
      yellowGuidance.push(`${rule.label} ${round(value * 100, 1)}% unter Ziel ${round(rule.target * 100, 1)}%`);
    }
  }

  const primaryThemeShare = share(primaryCount, rosterCount);
  const secondaryThemeShare = share(secondaryCount, rosterCount);
  const combinedThemeShare = share(combinedCount, rosterCount);
  const forbiddenShare = share(forbiddenCount, rosterCount);

  if (target && primaryThemeShare + 0.0001 < target.minimumShare && !(SPECIAL_QUOTAS[team.teamId] ?? []).some((rule) => rule.hard)) {
    yellowGuidance.push(`Primary Theme ${round(primaryThemeShare * 100, 1)}% < Minimum ${round(target.minimumShare * 100, 1)}%`);
  }
  if (forbiddenShare > 0) {
    const issue = `Forbidden/Avoid ${round(forbiddenShare * 100, 1)}%`;
    yellowGuidance.push(issue);
  }
  if (team.teamId === "M-M" && Number(team.cash) < 5) {
    yellowGuidance.push("M-M niedrige Cash-Reserve ist bewusst YELLOW, nicht RED, solange Star/Kader tragen.");
  }
  if (team.teamId === "B-P" && rosterCount >= 7 && playerOptGap > 0) {
    yellowGuidance.push("B-P darf als kleine Elite unter Optimum bleiben, wenn Qualitaet/Flexibilitaet passt.");
  }

  const avgIdentityFit = average(rosterPlayers.map((player) => identityFit(player, identity)));
  const avgThemeFit = average(
    rosterPlayers.map((player) => {
      const score = calculateThemeCompositionScore({
        gameState,
        team,
        player,
        candidateQuality: identityFit(player, identity),
      });
      return Math.max(0, Math.min(100, 50 + score.themeCompositionScore));
    }),
  );

  const status = classifyStatus(redFlags, yellowGuidance);
  return {
    saveId: input.saveId,
    saveName: input.saveName,
    teamId: team.teamId,
    teamName: team.name,
    status,
    rosterCount,
    cashEnd: round(team.cash, 2),
    playerOpt,
    playerOptGap,
    avgIdentityFit: round(avgIdentityFit, 2),
    avgThemeFit: round(avgThemeFit, 2),
    primaryThemeShare: round(primaryThemeShare, 3),
    secondaryThemeShare: round(secondaryThemeShare, 3),
    combinedThemeShare: round(combinedThemeShare, 3),
    forbiddenShare: round(forbiddenShare, 3),
    femaleShare: round(quotaValues.femaleShare, 3),
    maleShare: round(quotaValues.maleShare, 3),
    height6Share: round(quotaValues.height6Share, 3),
    hellDemonShare: round(quotaValues.hellDemonShare, 3),
    undeadShare: round(quotaValues.undeadShare, 3),
    pirateShare: round(quotaValues.pirateShare, 3),
    femalePetShare: round(quotaValues.femalePetShare, 3),
    demonDarkShare: round(quotaValues.demonDarkShare, 3),
    humanShare: round(quotaValues.humanShare, 3),
    constructShare: round(quotaValues.constructShare, 3),
    aquaNatureAlienShare: round(quotaValues.aquaNatureAlienShare, 3),
    mentalMageArcaneShare: round(quotaValues.mentalMageArcaneShare, 3),
    hardRuleViolations,
    yellowGuidance,
    redFlags,
    rosterPlayers: rosterPlayers.map((player, index) => `${player.name}[${tagRows[index].row.playerThemeTags.join("/")}]`),
  };
}

function buildSummary(rows: Array<Record<string, unknown>>) {
  const red = rows.filter((row) => row.status === "RED");
  const yellow = rows.filter((row) => row.status === "YELLOW");
  const green = rows.filter((row) => row.status === "GREEN");
  const lines = [
    "# Team Identity Quota Summary",
    "",
    `- Teams: ${rows.length}`,
    `- GREEN: ${green.length}`,
    `- YELLOW: ${yellow.length}`,
    `- RED: ${red.length}`,
    "",
    "## RED",
    ...(red.length
      ? red.map((row) => `- ${row.teamId} ${row.teamName}: ${Array.isArray(row.redFlags) ? row.redFlags.join("; ") : row.redFlags}`)
      : ["- Keine"]),
    "",
    "## YELLOW",
    ...(yellow.length
      ? yellow.map((row) => `- ${row.teamId} ${row.teamName}: ${Array.isArray(row.yellowGuidance) ? row.yellowGuidance.join("; ") : row.yellowGuidance}`)
      : ["- Keine"]),
    "",
    "## Spezialquoten",
    ...rows
      .filter((row) => SPECIAL_QUOTAS[String(row.teamId)])
      .map((row) => {
        const parts = SPECIAL_QUOTAS[String(row.teamId)].map((rule) => `${rule.label} ${round(Number(row[rule.column]) * 100, 1)}%`).join(", ");
        return `- ${row.teamId}: ${parts}`;
      }),
  ];
  return `${lines.join("\n")}\n`;
}

function buildAll32Review(rows: Array<Record<string, unknown>>) {
  return `${[
    "# Team All-32 Review",
    "",
    ...rows.map((row) => {
      const guidance = Array.isArray(row.yellowGuidance) && row.yellowGuidance.length ? ` YELLOW: ${row.yellowGuidance.join("; ")}` : "";
      const red = Array.isArray(row.redFlags) && row.redFlags.length ? ` RED: ${row.redFlags.join("; ")}` : "";
      return `- ${row.status} ${row.teamId} ${row.teamName}: roster ${row.rosterCount}, cash ${row.cashEnd}, optGap ${row.playerOptGap}, identity ${row.avgIdentityFit}, theme ${row.avgThemeFit}.${red}${guidance}`;
    }),
  ].join("\n")}\n`;
}

function main() {
  const saveIdArg = process.argv.includes("--save-id") ? process.argv[process.argv.indexOf("--save-id") + 1] : "active";
  const persistence = createPersistenceService();
  const save = saveIdArg === "active" ? persistence.getActiveSave() : persistence.getSaveById(saveIdArg);
  if (!save) throw new Error(`Save not found: ${saveIdArg}`);

  const rows = save.gameState.teams
    .slice()
    .sort((left, right) => left.shortCode.localeCompare(right.shortCode, "de"))
    .map((team) => auditTeam({ saveId: save.saveId, saveName: save.name, gameState: save.gameState, team }));

  const hardRows = rows.filter((row) => row.hardRuleViolations.length > 0);
  const yellowRows = rows.filter((row) => row.yellowGuidance.length > 0);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, "team-identity-quota-audit.csv"), toCsv(rows), "utf8");
  fs.writeFileSync(path.join(OUTPUT_DIR, "team-hard-rule-violations.csv"), toCsv(hardRows), "utf8");
  fs.writeFileSync(path.join(OUTPUT_DIR, "team-yellow-guidance.csv"), toCsv(yellowRows), "utf8");
  fs.writeFileSync(path.join(OUTPUT_DIR, "team-identity-quota-summary.md"), buildSummary(rows), "utf8");
  fs.writeFileSync(path.join(OUTPUT_DIR, "team-all-32-review.md"), buildAll32Review(rows), "utf8");
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "fresh-pick-audit-v2-summary.md"),
    [
      "# Fresh Pick Audit V2 Summary",
      "",
      `- Save: ${save.name} (${save.saveId})`,
      `- Roster Count: ${save.gameState.rosters.length}`,
      `- Status: ${hardRows.length > 0 ? "RED" : yellowRows.length > 0 ? "YELLOW" : "GREEN"}`,
      `- RED Teams: ${hardRows.length ? hardRows.map((row) => row.teamId).join(", ") : "keine"}`,
      `- YELLOW Teams: ${yellowRows.length ? yellowRows.map((row) => row.teamId).join(", ") : "keine"}`,
      "",
      "Kein Seasonlauf. Kein Full-Churn. Audit basiert auf aktivem Fresh-Pick-Save und expliziten Team-Quoten.",
    ].join("\n"),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        saveId: save.saveId,
        outputDir: OUTPUT_DIR,
        teams: rows.length,
        green: rows.filter((row) => row.status === "GREEN").length,
        yellow: rows.filter((row) => row.status === "YELLOW").length,
        red: rows.filter((row) => row.status === "RED").length,
        redTeams: hardRows.map((row) => row.teamId),
        yellowTeams: yellowRows.map((row) => row.teamId),
      },
      null,
      2,
    ),
  );
}

main();
