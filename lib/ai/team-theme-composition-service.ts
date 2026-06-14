import type { GameState, Player, RosterEntry, Team, TeamStrategyProfile } from "@/lib/data/olyDataTypes";

export type TeamThemeStrictness = "hard" | "strong" | "medium" | "soft";
export type TeamThemeStatus = "green_above_target" | "yellow_above_minimum" | "red_below_minimum" | "accepted_exception";

export type TeamThemeCompositionTarget = {
  teamId: string;
  primaryThemeTags: string[];
  secondaryThemeTags: string[];
  softPreferredTags: string[];
  allowedOutsiderTags: string[];
  avoidTags: string[];
  targetShare: number;
  minimumShare: number;
  strictness: TeamThemeStrictness;
  exceptionPolicy: "only_if_major_upgrade" | "normal_quality_fit_allowed" | "phase_a_minimum_relaxed" | "audit_required";
  qualityOverrideThreshold: number;
  notes: string;
};

export type PlayerThemeTagRow = {
  playerId: string;
  playerName: string;
  race: string;
  className: string;
  subclasses: string;
  traits: string;
  alignment: string;
  playerThemeTags: string[];
  sources: string[];
};

export type TeamThemeCompositionScore = {
  teamId: string;
  playerId: string;
  playerThemeTags: string[];
  directPrimaryThemeMatch: number;
  secondaryThemeMatch: number;
  softPreferredMatch: number;
  currentRosterBelowMinimumBonus: number;
  currentRosterBelowTargetBonus: number;
  outsiderPenalty: number;
  avoidTagPenalty: number;
  qualityOverrideBonus: number;
  scarcityAdjustment: number;
  themeCompositionScore: number;
  themeTier: "core_theme" | "secondary_theme" | "soft_theme" | "outsider_exception" | "outsider" | "avoid";
  exceptionAllowed: boolean;
  reason: string;
};

export type TeamThemeCompositionAuditRow = {
  teamId: string;
  teamName: string;
  rosterCount: number;
  primaryThemeCount: number;
  primaryThemeShare: number;
  secondaryThemeCount: number;
  combinedThemeShare: number;
  targetShare: number;
  minimumShare: number;
  status: TeamThemeStatus;
  outsiderCount: number;
  outsiderReasons: string;
  bestThemePick: string;
  worstThemeMiss: string;
  missedThematicCandidates: string;
};

const THEME_TARGETS: Record<string, TeamThemeCompositionTarget> = {
  "L-R": {
    teamId: "L-R",
    primaryThemeTags: ["Undead"],
    secondaryThemeTags: ["Reaper", "Ghost", "Lich", "Skeleton", "Vampire"],
    softPreferredTags: ["Death", "Dark", "Grave", "Spirit"],
    allowedOutsiderTags: ["Demon", "DarkNoble"],
    avoidTags: ["Divine", "Holy", "Angel"],
    targetShare: 0.9,
    minimumShare: 0.75,
    strictness: "hard",
    exceptionPolicy: "only_if_major_upgrade",
    qualityOverrideThreshold: 22,
    notes: "Last Ride muss visuell als Undead-/Reaper-Team erkennbar bleiben.",
  },
  "L-K": {
    teamId: "L-K",
    primaryThemeTags: ["Undead"],
    secondaryThemeTags: ["Vampire", "Ghoul", "Lich", "FallenKingdom", "DarkNoble"],
    softPreferredTags: ["Death", "Dark", "Royal", "Grave"],
    allowedOutsiderTags: ["Demon", "Royal"],
    avoidTags: ["Holy", "Angel"],
    targetShare: 0.9,
    minimumShare: 0.75,
    strictness: "hard",
    exceptionPolicy: "only_if_major_upgrade",
    qualityOverrideThreshold: 22,
    notes: "Lost Kingdom priorisiert Untote, dunklen Adel und verfallene Koenigreiche.",
  },
  "H-R": {
    teamId: "H-R",
    primaryThemeTags: ["Demon", "Hell", "Infernal"],
    secondaryThemeTags: ["Devil", "Fiend", "Succubus", "Incubus", "PrimeEvil"],
    softPreferredTags: ["Fire", "Chaos", "Dark"],
    allowedOutsiderTags: ["Undead", "Beast"],
    avoidTags: ["Divine", "Holy", "Angel"],
    targetShare: 0.9,
    minimumShare: 0.75,
    strictness: "hard",
    exceptionPolicy: "only_if_major_upgrade",
    qualityOverrideThreshold: 22,
    notes: "Hell Raisers sollen als Demon-/Infernal-Team lesbar sein.",
  },
  "R-R": {
    teamId: "R-R",
    primaryThemeTags: ["Aquatic", "Fish", "Mermaid", "Siren", "River", "Water"],
    secondaryThemeTags: ["Nature", "Beast", "Plant", "Druid"],
    softPreferredTags: ["Ocean", "Sea", "Coral", "Shark", "Leviathan"],
    allowedOutsiderTags: ["Nature", "Plant", "Beast"],
    avoidTags: ["Machine", "Robot", "Construct"],
    targetShare: 0.75,
    minimumShare: 0.55,
    strictness: "strong",
    exceptionPolicy: "audit_required",
    qualityOverrideThreshold: 16,
    notes: "Riptide Rivers: Alien nur, wenn es thematisch wasser-/flussnah wirkt.",
  },
  "G-G": {
    teamId: "G-G",
    primaryThemeTags: ["Divine", "Angel", "Paladin", "Holy"],
    secondaryThemeTags: ["Guardian", "Saint", "God", "Hero"],
    softPreferredTags: ["Good", "Lawful", "Royal"],
    allowedOutsiderTags: ["Human", "Elf", "Knight"],
    avoidTags: ["Demon", "Undead", "Infernal"],
    targetShare: 0.5,
    minimumShare: 0.25,
    strictness: "soft",
    exceptionPolicy: "normal_quality_fit_allowed",
    qualityOverrideThreshold: 8,
    notes: "Golden Gladiators duennen nicht alles aus, sollen aber Divine/Angel sichtbar halten.",
  },
  "B-B": {
    teamId: "B-B",
    primaryThemeTags: ["Beast", "Animal", "Wild", "Monster"],
    secondaryThemeTags: ["Demon", "Hellhound", "Infernal"],
    softPreferredTags: ["Jungle", "Creature", "Wolf", "Bear", "Cat"],
    allowedOutsiderTags: ["Demon", "Orc", "Goblin"],
    avoidTags: ["Royal", "Machine"],
    targetShare: 0.6,
    minimumShare: 0.5,
    strictness: "strong",
    exceptionPolicy: "audit_required",
    qualityOverrideThreshold: 14,
    notes: "Blazing Beasts erlaubt Demon-Beast-Hybride.",
  },
  "W-W": {
    teamId: "W-W",
    primaryThemeTags: ["Mage", "Arcane", "Wizard", "Mental"],
    secondaryThemeTags: ["Scholar", "Tactician", "Occult", "Void", "Mystic"],
    softPreferredTags: ["Construct", "Alien", "Knowledge", "Magic"],
    allowedOutsiderTags: ["Human", "Elf", "Divine"],
    avoidTags: ["Brute", "Beast", "Wild", "Berserker"],
    targetShare: 0.7,
    minimumShare: 0.5,
    strictness: "strong",
    exceptionPolicy: "audit_required",
    qualityOverrideThreshold: 14,
    notes: "Wicked Wizards sollen als Mental-/Mage-/Arcane-Team lesbar bleiben.",
  },
  "R-C": {
    teamId: "R-C",
    primaryThemeTags: ["Royal", "Noble", "Court", "Human", "Elf", "Dwarf", "Lord", "Knight"],
    secondaryThemeTags: ["Paladin", "Prince", "Princess", "King", "Queen"],
    softPreferredTags: ["Good", "Lawful", "Hero"],
    allowedOutsiderTags: ["Divine", "Angel"],
    avoidTags: ["Demon", "Goblin", "Undead"],
    targetShare: 0.7,
    minimumShare: 0.45,
    strictness: "strong",
    exceptionPolicy: "audit_required",
    qualityOverrideThreshold: 14,
    notes: "Royal Court darf breit sein, muss aber Hof-/Adelsfantasie tragen.",
  },
  "S-S": {
    teamId: "S-S",
    primaryThemeTags: ["Construct", "Robot", "Android", "Machine", "Steel", "Augmented"],
    secondaryThemeTags: ["Cyborg", "Engineer", "Tactician"],
    softPreferredTags: ["Metal", "Order"],
    allowedOutsiderTags: ["Human", "Tactician"],
    avoidTags: ["Plant", "Druid", "Wild"],
    targetShare: 0.8,
    minimumShare: 0.6,
    strictness: "hard",
    exceptionPolicy: "only_if_major_upgrade",
    qualityOverrideThreshold: 20,
    notes: "Silver Soldiers sollen technisch/konstruiert wirken.",
  },
  "W-L": {
    teamId: "W-L",
    primaryThemeTags: ["Mercenary", "Soldier", "Contract", "Legionnaire"],
    secondaryThemeTags: ["Bounty", "Warlord", "Warrior"],
    softPreferredTags: ["Veteran", "Discipline"],
    allowedOutsiderTags: ["Human", "Orc", "Dwarf"],
    avoidTags: ["Pacifist", "Holy"],
    targetShare: 0.7,
    minimumShare: 0.5,
    strictness: "strong",
    exceptionPolicy: "audit_required",
    qualityOverrideThreshold: 12,
    notes: "Wrecking Legionnaires leben von Soeldner-/Soldatenlogik.",
  },
};

function normalizeToken(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function addTag(tags: Set<string>, sources: string[], tag: string, source: string) {
  tags.add(tag);
  sources.push(`${tag}:${source}`);
}

function valueContains(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

export function derivePlayerThemeTags(player: Player): PlayerThemeTagRow {
  const tags = new Set<string>();
  const sources: string[] = [];
  const values = [
    ["race", player.race],
    ["class", player.className],
    ["alignment", player.alignment],
    ...player.subclasses.map((value, index) => [`subclass${index + 1}`, value] as const),
    ...player.traitsPositive.map((value, index) => [`traitPositive${index + 1}`, value] as const),
    ...player.traitsNegative.map((value, index) => [`traitNegative${index + 1}`, value] as const),
    ["name_soft", player.name],
  ] as const;
  const normalizedValues = values.map(([source, value]) => [source, normalizeToken(value)] as const);

  for (const [source, value] of normalizedValues) {
    if (!value) continue;
    if (value.includes("undead")) addTag(tags, sources, "Undead", source);
    if (valueContains(value, ["vampire", "dhampir"])) addTag(tags, sources, "Vampire", source);
    if (valueContains(value, ["ghoul"])) addTag(tags, sources, "Ghoul", source);
    if (valueContains(value, ["lich"])) addTag(tags, sources, "Lich", source);
    if (valueContains(value, ["skeleton", "bone"])) addTag(tags, sources, "Skeleton", source);
    if (valueContains(value, ["zombie"])) addTag(tags, sources, "Zombie", source);
    if (valueContains(value, ["spirit", "ghost", "wraith", "apparition"])) addTag(tags, sources, "Ghost", source);
    if (valueContains(value, ["reaper", "death", "necro", "grave"])) {
      addTag(tags, sources, "Reaper", source);
      addTag(tags, sources, "Death", source);
    }

    if (value.includes("demon")) addTag(tags, sources, "Demon", source);
    if (valueContains(value, ["devil", "fiend"])) addTag(tags, sources, "Devil", source);
    if (valueContains(value, ["hell", "infernal", "hellhound"])) {
      addTag(tags, sources, "Hell", source);
      addTag(tags, sources, "Infernal", source);
    }
    if (valueContains(value, ["succubus", "incubus"])) addTag(tags, sources, "Succubus", source);
    if (valueContains(value, ["prime evil", "primeevil"])) addTag(tags, sources, "PrimeEvil", source);

    if (value.includes("divine")) addTag(tags, sources, "Divine", source);
    if (valueContains(value, ["angel", "fallen angel"])) addTag(tags, sources, "Angel", source);
    if (valueContains(value, ["paladin", "saint", "god", "holy", "guardian", "templar"])) {
      addTag(tags, sources, value.includes("holy") ? "Holy" : "Paladin", source);
      addTag(tags, sources, "Divine", source);
    }

    if (valueContains(value, ["aqua", "aquatic", "fish", "mermaid", "siren", "river", "water", "ocean", "sea", "shark", "leviathan", "coral"])) {
      addTag(tags, sources, "Aquatic", source);
      if (value.includes("fish")) addTag(tags, sources, "Fish", source);
      if (value.includes("mermaid")) addTag(tags, sources, "Mermaid", source);
      if (value.includes("siren")) addTag(tags, sources, "Siren", source);
      if (value.includes("river")) addTag(tags, sources, "River", source);
      if (value.includes("water")) addTag(tags, sources, "Water", source);
      if (value.includes("ocean") || value.includes("sea")) addTag(tags, sources, "Ocean", source);
      if (value.includes("shark")) addTag(tags, sources, "Shark", source);
      if (value.includes("leviathan")) addTag(tags, sources, "Leviathan", source);
      if (value.includes("coral")) addTag(tags, sources, "Coral", source);
    }

    if (valueContains(value, ["animal", "beast", "wolf", "bear", "cat", "hound", "monster", "creature", "wild", "jungle"])) {
      addTag(tags, sources, "Beast", source);
      if (value.includes("animal")) addTag(tags, sources, "Animal", source);
      if (value.includes("wild")) addTag(tags, sources, "Wild", source);
      if (value.includes("monster")) addTag(tags, sources, "Monster", source);
      if (value.includes("jungle")) addTag(tags, sources, "Jungle", source);
    }

    if (valueContains(value, ["construct", "robot", "android", "machine", "steel", "augmented", "cyborg", "engineer"])) {
      addTag(tags, sources, "Construct", source);
      if (value.includes("robot")) addTag(tags, sources, "Robot", source);
      if (value.includes("android")) addTag(tags, sources, "Android", source);
      if (value.includes("machine")) addTag(tags, sources, "Machine", source);
      if (value.includes("steel")) addTag(tags, sources, "Steel", source);
      if (value.includes("augmented")) addTag(tags, sources, "Augmented", source);
      if (value.includes("cyborg")) addTag(tags, sources, "Cyborg", source);
    }

    if (valueContains(value, ["human", "elf", "dwarf", "lord", "noble", "king", "queen", "knight", "court", "prince", "princess", "royal"])) {
      if (value.includes("human")) addTag(tags, sources, "Human", source);
      if (value.includes("elf")) addTag(tags, sources, "Elf", source);
      if (value.includes("dwarf")) addTag(tags, sources, "Dwarf", source);
      addTag(tags, sources, "Royal", source);
      if (value.includes("noble")) addTag(tags, sources, "Noble", source);
      if (value.includes("court")) addTag(tags, sources, "Court", source);
      if (value.includes("lord")) addTag(tags, sources, "Lord", source);
      if (value.includes("knight")) addTag(tags, sources, "Knight", source);
    }

    if (valueContains(value, ["mercenary", "soldier", "legionnaire", "bounty", "contractor", "warlord"])) {
      addTag(tags, sources, "Mercenary", source);
      if (value.includes("soldier")) addTag(tags, sources, "Soldier", source);
      if (value.includes("legionnaire")) addTag(tags, sources, "Legionnaire", source);
      if (value.includes("bounty")) addTag(tags, sources, "Bounty", source);
      if (value.includes("contract")) addTag(tags, sources, "Contract", source);
      if (value.includes("warlord")) addTag(tags, sources, "Warlord", source);
    }

    if (valueContains(value, ["plant", "druid", "nature", "forest"])) addTag(tags, sources, value.includes("plant") ? "Plant" : "Nature", source);
    if (valueContains(value, ["good", "lawful"])) addTag(tags, sources, value.includes("lawful") ? "Lawful" : "Good", source);
    if (valueContains(value, ["dark", "fallen"])) addTag(tags, sources, value.includes("fallen") ? "FallenKingdom" : "Dark", source);
    if (valueContains(value, ["mage", "wizard", "warlock", "sorcerer", "arcane", "magic", "mystic"])) {
      addTag(tags, sources, "Mage", source);
      if (value.includes("wizard")) addTag(tags, sources, "Wizard", source);
      if (value.includes("arcane")) addTag(tags, sources, "Arcane", source);
      if (value.includes("mystic")) addTag(tags, sources, "Mystic", source);
      if (value.includes("magic")) addTag(tags, sources, "Magic", source);
    }
    if (valueContains(value, ["mental", "mind", "psychic", "psion", "scholar", "sage", "occult", "void"])) {
      addTag(tags, sources, "Mental", source);
      if (value.includes("scholar") || value.includes("sage")) addTag(tags, sources, "Scholar", source);
      if (value.includes("psychic") || value.includes("psion")) addTag(tags, sources, "Mystic", source);
      if (value.includes("occult")) addTag(tags, sources, "Occult", source);
      if (value.includes("void")) addTag(tags, sources, "Void", source);
    }
  }

  return {
    playerId: player.id,
    playerName: player.name,
    race: player.race,
    className: player.className,
    subclasses: player.subclasses.join("|"),
    traits: [...player.traitsPositive, ...player.traitsNegative].join("|"),
    alignment: player.alignment,
    playerThemeTags: [...tags].sort(),
    sources,
  };
}

export function getTeamThemeCompositionTarget(team: Pick<Team, "teamId" | "name"> | string): TeamThemeCompositionTarget | null {
  const teamId = typeof team === "string" ? team : team.teamId;
  return THEME_TARGETS[teamId] ?? null;
}

export function listTeamThemeCompositionTargets() {
  return Object.values(THEME_TARGETS);
}

function hasAny(tags: Set<string>, candidates: string[]) {
  return candidates.some((tag) => tags.has(tag));
}

function rosterShare(input: { gameState: GameState; teamId: string; target: TeamThemeCompositionTarget }) {
  const playerById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
  const rosterPlayers = input.gameState.rosters
    .filter((entry) => entry.teamId === input.teamId)
    .map((entry) => playerById.get(entry.playerId))
    .filter((player): player is Player => Boolean(player));
  const count = rosterPlayers.length;
  if (count === 0) {
    return { rosterPlayers, primaryCount: 0, secondaryCount: 0, combinedCount: 0, primaryShare: 0, combinedShare: 0 };
  }
  let primaryCount = 0;
  let secondaryCount = 0;
  for (const player of rosterPlayers) {
    const tags = new Set(derivePlayerThemeTags(player).playerThemeTags);
    if (hasAny(tags, input.target.primaryThemeTags)) primaryCount += 1;
    if (hasAny(tags, input.target.secondaryThemeTags)) secondaryCount += 1;
  }
  const combinedCount = rosterPlayers.filter((player) => {
    const tags = new Set(derivePlayerThemeTags(player).playerThemeTags);
    return hasAny(tags, [...input.target.primaryThemeTags, ...input.target.secondaryThemeTags, ...input.target.softPreferredTags]);
  }).length;
  return {
    rosterPlayers,
    primaryCount,
    secondaryCount,
    combinedCount,
    primaryShare: primaryCount / count,
    combinedShare: combinedCount / count,
  };
}

export function calculateThemeCompositionScore(input: {
  gameState: GameState;
  team: Pick<Team, "teamId" | "name">;
  player: Player;
  candidateQuality: number;
  candidateRoleFit?: number | null;
  currentTeamNeeds?: string[] | null;
  phase?: "phase_a_minimum" | "phase_b_core_optimum" | "phase_c_depth_luxury" | null;
}): TeamThemeCompositionScore {
  const target = getTeamThemeCompositionTarget(input.team);
  const tagRow = derivePlayerThemeTags(input.player);
  const tags = new Set(tagRow.playerThemeTags);
  if (!target) {
    return {
      teamId: input.team.teamId,
      playerId: input.player.id,
      playerThemeTags: tagRow.playerThemeTags,
      directPrimaryThemeMatch: 0,
      secondaryThemeMatch: 0,
      softPreferredMatch: 0,
      currentRosterBelowMinimumBonus: 0,
      currentRosterBelowTargetBonus: 0,
      outsiderPenalty: 0,
      avoidTagPenalty: 0,
      qualityOverrideBonus: 0,
      scarcityAdjustment: 0,
      themeCompositionScore: 0,
      themeTier: "soft_theme",
      exceptionAllowed: true,
      reason: "no_theme_target",
    };
  }

  const share = rosterShare({ gameState: input.gameState, teamId: input.team.teamId, target });
  const primaryMatch = hasAny(tags, target.primaryThemeTags);
  const secondaryMatch = hasAny(tags, target.secondaryThemeTags);
  const softMatch = hasAny(tags, target.softPreferredTags);
  const allowedOutsider = hasAny(tags, target.allowedOutsiderTags);
  const avoidMatch = hasAny(tags, target.avoidTags);
  const belowMinimum = share.primaryShare < target.minimumShare;
  const belowTarget = share.primaryShare < target.targetShare;
  const strictnessWeight = target.strictness === "hard" ? 1.4 : target.strictness === "strong" ? 1.15 : target.strictness === "medium" ? 0.9 : 0.65;
  const phaseWeight = input.phase === "phase_a_minimum" ? 0.6 : input.phase === "phase_c_depth_luxury" ? 1.15 : 1;
  const directPrimaryThemeMatch = primaryMatch ? 24 * strictnessWeight * phaseWeight : 0;
  const secondaryThemeMatch = secondaryMatch ? 13 * strictnessWeight * phaseWeight : 0;
  const softPreferredMatch = softMatch ? 6 * phaseWeight : 0;
  const currentRosterBelowMinimumBonus = belowMinimum && (primaryMatch || secondaryMatch) ? 18 * strictnessWeight : 0;
  const currentRosterBelowTargetBonus = belowTarget && (primaryMatch || secondaryMatch || softMatch) ? 8 * strictnessWeight : 0;
  const outsider = !primaryMatch && !secondaryMatch && !softMatch;
  const outsiderPenalty = outsider && !allowedOutsider ? -18 * strictnessWeight * phaseWeight : outsider ? -7 * phaseWeight : 0;
  const avoidTagPenalty = avoidMatch ? -26 * strictnessWeight : 0;
  const roleFit = input.candidateRoleFit ?? 0;
  const qualityOverrideBonus =
    outsider && input.candidateQuality + roleFit >= target.qualityOverrideThreshold ? Math.min(18, (input.candidateQuality + roleFit - target.qualityOverrideThreshold) * 0.45) : 0;
  const themedPool = input.gameState.players.filter((player) => {
    const playerTags = new Set(derivePlayerThemeTags(player).playerThemeTags);
    return hasAny(playerTags, [...target.primaryThemeTags, ...target.secondaryThemeTags]);
  }).length;
  const scarcityAdjustment = themedPool < 12 && (primaryMatch || secondaryMatch) ? 4 : themedPool < 8 && outsider ? 5 : 0;
  const total = Number(
    (
      directPrimaryThemeMatch +
      secondaryThemeMatch +
      softPreferredMatch +
      currentRosterBelowMinimumBonus +
      currentRosterBelowTargetBonus +
      outsiderPenalty +
      avoidTagPenalty +
      qualityOverrideBonus +
      scarcityAdjustment
    ).toFixed(2),
  );
  const exceptionAllowed =
    !avoidMatch &&
    (primaryMatch ||
      secondaryMatch ||
      softMatch ||
      allowedOutsider ||
      target.exceptionPolicy === "normal_quality_fit_allowed" ||
      input.phase === "phase_a_minimum" ||
      qualityOverrideBonus >= 6);
  const themeTier = avoidMatch
    ? "avoid"
    : primaryMatch
      ? "core_theme"
      : secondaryMatch
        ? "secondary_theme"
        : softMatch
          ? "soft_theme"
          : exceptionAllowed
            ? "outsider_exception"
            : "outsider";
  return {
    teamId: input.team.teamId,
    playerId: input.player.id,
    playerThemeTags: tagRow.playerThemeTags,
    directPrimaryThemeMatch: Number(directPrimaryThemeMatch.toFixed(2)),
    secondaryThemeMatch: Number(secondaryThemeMatch.toFixed(2)),
    softPreferredMatch: Number(softPreferredMatch.toFixed(2)),
    currentRosterBelowMinimumBonus: Number(currentRosterBelowMinimumBonus.toFixed(2)),
    currentRosterBelowTargetBonus: Number(currentRosterBelowTargetBonus.toFixed(2)),
    outsiderPenalty: Number(outsiderPenalty.toFixed(2)),
    avoidTagPenalty: Number(avoidTagPenalty.toFixed(2)),
    qualityOverrideBonus: Number(qualityOverrideBonus.toFixed(2)),
    scarcityAdjustment: Number(scarcityAdjustment.toFixed(2)),
    themeCompositionScore: total,
    themeTier,
    exceptionAllowed,
    reason: [
      primaryMatch ? "primary_match" : null,
      secondaryMatch ? "secondary_match" : null,
      softMatch ? "soft_match" : null,
      belowMinimum ? "roster_below_minimum" : belowTarget ? "roster_below_target" : "target_reached",
      outsider ? "outsider" : null,
      avoidMatch ? "avoid_tag" : null,
      qualityOverrideBonus > 0 ? "quality_override" : null,
    ]
      .filter(Boolean)
      .join("|"),
  };
}

export function buildTeamThemeCompositionAudit(gameState: GameState): TeamThemeCompositionAuditRow[] {
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  return gameState.teams.flatMap((team) => {
    const target = getTeamThemeCompositionTarget(team);
    if (!target) return [];
    const share = rosterShare({ gameState, teamId: team.teamId, target });
    const rosterEntries = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const outsiders: string[] = [];
    let bestThemePick = "";
    let bestThemeScore = -Infinity;
    let worstThemeMiss = "";
    let worstMissQuality = -Infinity;
    for (const rosterEntry of rosterEntries) {
      const player = playerById.get(rosterEntry.playerId);
      if (!player) continue;
      const score = calculateThemeCompositionScore({
        gameState,
        team,
        player,
        candidateQuality: player.ovr ?? player.rating ?? 0,
        candidateRoleFit: 0,
      });
      if (score.themeCompositionScore > bestThemeScore) {
        bestThemeScore = score.themeCompositionScore;
        bestThemePick = `${player.name} (${score.themeTier})`;
      }
      if (score.themeTier === "outsider" || score.themeTier === "avoid") {
        outsiders.push(`${player.name}:${score.reason}`);
        const quality = player.ovr ?? player.rating ?? 0;
        if (quality > worstMissQuality) {
          worstMissQuality = quality;
          worstThemeMiss = `${player.name} (${score.themeTier})`;
        }
      }
    }
    const candidateMisses = gameState.players
      .filter((player) => !gameState.rosters.some((entry) => entry.playerId === player.id))
      .map((player) => ({
        player,
        score: calculateThemeCompositionScore({ gameState, team, player, candidateQuality: player.ovr ?? player.rating ?? 0 }),
      }))
      .filter((entry) => entry.score.themeTier === "core_theme" || entry.score.themeTier === "secondary_theme")
      .sort((left, right) => (right.player.ovr ?? right.player.rating ?? 0) - (left.player.ovr ?? left.player.rating ?? 0))
      .slice(0, 5)
      .map((entry) => `${entry.player.name}:${entry.score.themeTier}`)
      .join("|");
    const status: TeamThemeStatus =
      share.primaryShare >= target.targetShare
        ? "green_above_target"
        : share.primaryShare >= target.minimumShare
          ? "yellow_above_minimum"
          : outsiders.length > 0 && share.combinedShare >= target.minimumShare
            ? "accepted_exception"
            : "red_below_minimum";
    return [
      {
        teamId: team.teamId,
        teamName: team.name,
        rosterCount: share.rosterPlayers.length,
        primaryThemeCount: share.primaryCount,
        primaryThemeShare: Number(share.primaryShare.toFixed(3)),
        secondaryThemeCount: share.secondaryCount,
        combinedThemeShare: Number(share.combinedShare.toFixed(3)),
        targetShare: target.targetShare,
        minimumShare: target.minimumShare,
        status,
        outsiderCount: outsiders.length,
        outsiderReasons: outsiders.join("|"),
        bestThemePick,
        worstThemeMiss,
        missedThematicCandidates: candidateMisses,
      },
    ];
  });
}

export function buildPlayerThemeTagRows(players: Player[]): PlayerThemeTagRow[] {
  return players.map(derivePlayerThemeTags);
}

export function resolveThemeTargetsForProfiles(profiles: Record<string, TeamStrategyProfile>) {
  return Object.fromEntries(Object.keys(profiles).map((teamId) => [teamId, getTeamThemeCompositionTarget(teamId)]));
}
