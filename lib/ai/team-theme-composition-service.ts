import type { GameState, Player, RosterEntry, Team, TeamStrategyProfile } from "@/lib/data/olyDataTypes";

// Gender-/Quota-Logik (z.B. D-P): Nicht-humanoide Kreaturen (Tiere, Drachen, ...) zaehlen
// NICHT in das Frauen-Limit hinein und sind unabhaengig vom Geschlecht erlaubt.
// Humanoide (Mensch, Zwerg, Ork, Elf, Daemon, ...) zaehlen in das Limit; maennliche
// Humanoide draengen den Frauenanteil. Klassifikation primaer ueber die Rasse.
export const NON_HUMANOID_GENDER_QUOTA_RACES = new Set([
  "animal",
  "dragon",
  "lizard",
  "aqua",
  "fish",
  "plant",
]);

export function isHumanoidForGenderQuota(player: Pick<Player, "race">): boolean {
  const race = String(player.race ?? "").trim().toLowerCase();
  if (!race) return true;
  return !NON_HUMANOID_GENDER_QUOTA_RACES.has(race);
}

export function isFemaleGenderPlayer(player: Pick<Player, "gender">): boolean {
  const gender = String(player.gender ?? "").trim().toLowerCase();
  return gender === "f" || gender === "w" || gender === "female" || gender === "weiblich" || gender === "frau";
}

/** V-D women-only: female humanoids + male/neutral animals only. */
export function isVdWomenOnlyEligiblePlayer(player: Pick<Player, "race" | "gender">): boolean {
  if (String(player.race ?? "").trim().toLowerCase() === "animal") return true;
  return isFemaleGenderPlayer(player);
}

export function getHardFocusIdentityBlockReason(
  teamCode: string,
  player: Pick<Player, "race" | "gender">,
): string | null {
  const code = String(teamCode ?? "").trim().toUpperCase();
  if (code === "V-D" && !isVdWomenOnlyEligiblePlayer(player)) {
    return "hard_focus_v-d_requires_female_or_pet";
  }
  return null;
}

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
  // Wenn gesetzt, wird der primaryShare nur ueber humanoide Spieler berechnet
  // (nicht-humanoide Kreaturen wie Tiere/Drachen sind aus Zaehler UND Nenner ausgenommen).
  genderQuotaHumanoidScoped?: boolean;
  // Wenn gesetzt, wird der primaryShare als Rassen-Mindestquote berechnet: Anteil der Spieler,
  // deren Rasse in `races` liegt, am Gesamtkader (unabhaengig von Theme-Tags). Fuer Teams wie
  // H-R, die mindestens X% einer konkreten Rasse (z.B. Demon) im Kader halten sollen.
  raceQuotaScoped?: { races: string[] };
};

export type IdentityQuotaRole = "counts" | "exempt" | "violates" | "none";

function normalizeRaceToken(race: string | null | undefined): string {
  return String(race ?? "").trim().toLowerCase();
}

export function isQuotaScopedTarget(
  target: Pick<TeamThemeCompositionTarget, "raceQuotaScoped" | "genderQuotaHumanoidScoped">,
): boolean {
  return Boolean((target.raceQuotaScoped && target.raceQuotaScoped.races.length > 0) || target.genderQuotaHumanoidScoped);
}

// Klassifiziert einen Spieler relativ zur Identitaets-Mindestquote des Teams:
// - "counts": zaehlt in den Quoten-Zaehler (z.B. Demon-Rasse bei H-R, Frau bei D-P/V-D)
// - "violates": zaehlt in den Nenner, erfuellt die Quote aber nicht (draengt den Anteil)
// - "exempt": ausgenommen (z.B. Tiere/Pets bei Gender-Quote) – weder Zaehler noch Nenner
// - "none": Team hat keine quoten-basierte Identitaet
export function classifyIdentityQuotaRole(
  player: Pick<Player, "race" | "gender">,
  target: Pick<TeamThemeCompositionTarget, "raceQuotaScoped" | "genderQuotaHumanoidScoped">,
): IdentityQuotaRole {
  if (target.raceQuotaScoped && target.raceQuotaScoped.races.length > 0) {
    const wanted = target.raceQuotaScoped.races.map((entry) => entry.toLowerCase());
    return wanted.includes(normalizeRaceToken(player.race)) ? "counts" : "violates";
  }
  if (target.genderQuotaHumanoidScoped) {
    if (!isHumanoidForGenderQuota(player)) return "exempt";
    return isFemaleGenderPlayer(player) ? "counts" : "violates";
  }
  return "none";
}

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
  // Quoten-Identitaet: Rolle des Kandidaten relativ zur Mindestquote und ein starker,
  // NICHT geclampter rawScore-Delta fuer die Markt-Bewertung (positiv = zieht zur Quote hoch,
  // negativ = draengt die Quote, exempt/none = 0). Niemals als Hard-Block gedacht.
  identityQuotaRole: IdentityQuotaRole;
  identityFloorAdjustment: number;
};

export type TeamThemeCompositionRuntimeContext = {
  target: TeamThemeCompositionTarget | null;
  rosterShare: ReturnType<typeof calculateRosterShareUncached> | null;
  themedPoolCount: number | null;
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
    notes: "Last Ride: Undead ist Subclass/Theme-Tag (nicht Rasse). Lich/Ghost/Vampire zaehlen mit.",
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
    // Mindestquote auf die Rasse Demon: H-R soll dauerhaft >= 75% Daemonen im Kader haben
    // (mehr ist besser, nie hart blocken). Nicht-Daemonen (Devil/Fiend/Undead-Allies) bleiben als
    // Secondary/Outsider erlaubt, zaehlen aber nicht in die Demon-Quote.
    raceQuotaScoped: { races: ["demon"] },
    notes: "Hell Raisers: mindestens 75% Demon-Rasse (Ziel 90%), Rest infernale Verbuendete.",
  },
  "R-R": {
    teamId: "R-R",
    primaryThemeTags: ["Fish", "Aquatic"],
    secondaryThemeTags: ["Alien", "Mermaid", "Siren", "River", "Water"],
    softPreferredTags: ["Ocean", "Sea", "Coral", "Shark", "Leviathan", "Nature"],
    allowedOutsiderTags: ["Alien", "Aquatic", "Nature", "Plant", "Beast"],
    avoidTags: ["Machine", "Robot", "Construct"],
    targetShare: 0.7,
    minimumShare: 0.6,
    strictness: "strong",
    exceptionPolicy: "audit_required",
    qualityOverrideThreshold: 16,
    raceQuotaScoped: { races: ["fish", "aqua", "lizard"] },
    notes: "Riptide Rivers: mindestens 60% Fish/Aqua-Kern; Alien ist gewuenschter Secondary-Vibe, Value bleibt Strategie statt Monokultur.",
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
  "D-P": {
    teamId: "D-P",
    primaryThemeTags: ["Female"],
    secondaryThemeTags: ["Succubus", "Demon", "Dark", "Temptress", "SexyDemon"],
    softPreferredTags: ["Shadow", "Seduction", "Agile", "Charisma"],
    allowedOutsiderTags: ["Demon", "Dark", "Assassin", "Animal", "Beast", "Dragon"],
    avoidTags: ["Holy", "Angel", "Construct"],
    targetShare: 0.75,
    minimumShare: 0.65,
    strictness: "hard",
    exceptionPolicy: "only_if_major_upgrade",
    qualityOverrideThreshold: 24,
    genderQuotaHumanoidScoped: true,
    notes:
      "Death Peaches: weibliches Dark-Fantasy-Team. Frauenanteil unter Humanoiden mindestens 65% (Ziel 75%); nicht-humanoide Kreaturen (Tiere/Drachen) sind unabhaengig vom Geschlecht erlaubt und zaehlen nicht ins Limit.",
  },
  "S-C": {
    teamId: "S-C",
    primaryThemeTags: ["Crusader", "Paladin", "Brutal", "Torment", "Will", "Strength"],
    secondaryThemeTags: ["Dark", "Zealot", "Charisma", "Executioner"],
    softPreferredTags: ["Warrior", "Warlord", "Power"],
    allowedOutsiderTags: ["Human", "Demon", "Knight"],
    avoidTags: ["Pacifist", "Peace", "Healer"],
    targetShare: 0.75,
    minimumShare: 0.55,
    strictness: "strong",
    exceptionPolicy: "audit_required",
    qualityOverrideThreshold: 16,
    notes: "Stronghold Crusaders sind die brutale, boese Kreuzritter-Variante mit Willenskraft und Torment.",
  },
  "P-C": {
    teamId: "P-C",
    primaryThemeTags: ["Pirate", "Swashbuckler", "Wayfarer", "Corsair"],
    secondaryThemeTags: ["Raider", "Sea", "Trickster"],
    softPreferredTags: ["Undead", "Rogue", "Fast"],
    allowedOutsiderTags: ["Aquatic", "Undead", "Mercenary"],
    avoidTags: ["Royal", "Lawful", "Pacifist"],
    targetShare: 0.9,
    minimumShare: 0.75,
    strictness: "hard",
    exceptionPolicy: "only_if_major_upgrade",
    qualityOverrideThreshold: 22,
    notes: "Pirate Crew pickt eigentlich nur Pirate/Swashbuckler/Wayfarer-Vibes.",
  },
  "D-L": {
    teamId: "D-L",
    primaryThemeTags: ["Human"],
    secondaryThemeTags: ["Legionnaire", "Soldier", "Warlord", "Discipline"],
    softPreferredTags: ["Dark", "Order", "Strength"],
    allowedOutsiderTags: ["Human"],
    avoidTags: ["Elf", "Dwarf", "Orc", "Goblin", "Demon", "Undead", "Beast", "Construct", "Alien"],
    targetShare: 0.9,
    minimumShare: 0.75,
    strictness: "hard",
    exceptionPolicy: "only_if_major_upgrade",
    qualityOverrideThreshold: 22,
    notes: "Dire Legion ist als in-universe Human-only/anti-outsider Fraktion modelliert.",
  },
  "C-C": {
    teamId: "C-C",
    primaryThemeTags: ["Ambassador", "Manipulator", "Trader", "Profit"],
    secondaryThemeTags: ["Mercenary", "Contract", "Value", "Charisma"],
    softPreferredTags: ["Tactician", "Social", "ShortTerm"],
    allowedOutsiderTags: ["Human", "Elf", "Dwarf", "Mercenary"],
    avoidTags: ["DeadSalary", "LuxuryBench"],
    targetShare: 0.45,
    minimumShare: 0.25,
    strictness: "medium",
    exceptionPolicy: "normal_quality_fit_allowed",
    qualityOverrideThreshold: 10,
    notes: "Cash Creators: Ambassador/Manipulator plus MW-Gehalt-Ratio und kurze Weiterverkaufslogik.",
  },
  "P-S": {
    teamId: "P-S",
    primaryThemeTags: ["Melancholy", "NoQuit", "Outcast", "Mental"],
    secondaryThemeTags: ["Depression", "Resilience", "Will", "Determination"],
    softPreferredTags: ["Dark", "Underdog", "Loyal"],
    allowedOutsiderTags: ["Human", "Undead", "Demon"],
    avoidTags: ["Quitter", "Diva"],
    targetShare: 0.65,
    minimumShare: 0.45,
    strictness: "medium",
    exceptionPolicy: "audit_required",
    qualityOverrideThreshold: 12,
    notes: "Project Suicide: melancholisch/depressiv/outcast, aber niemals aufgeben.",
  },
  "R-L": {
    teamId: "R-L",
    primaryThemeTags: ["Lunatic", "Werewolf", "Animal", "Wild", "Plant"],
    secondaryThemeTags: ["Beast", "Chaos", "Fast", "Strength", "Monster"],
    softPreferredTags: ["Wolf", "Nature", "Berserker"],
    allowedOutsiderTags: ["Demon", "Orc", "Goblin"],
    avoidTags: ["Pacifist", "Lawful", "Machine"],
    targetShare: 0.75,
    minimumShare: 0.55,
    strictness: "strong",
    exceptionPolicy: "audit_required",
    qualityOverrideThreshold: 15,
    notes: "Raging Lunatics: crazy lunatic animals, werewolves/plants/wild/chaotic/fast/strong.",
  },
  "B-P": {
    teamId: "B-P",
    primaryThemeTags: ["Elite", "Star", "Efficient", "Allrounder"],
    secondaryThemeTags: ["Panther", "Assassin", "TwoWay", "Closer"],
    softPreferredTags: ["Value", "Agile", "Dark"],
    allowedOutsiderTags: ["Beast", "Human", "Elf"],
    avoidTags: ["LowCeiling", "RosterBloat"],
    targetShare: 0.35,
    minimumShare: 0.1,
    strictness: "medium",
    exceptionPolicy: "normal_quality_fit_allowed",
    qualityOverrideThreshold: 8,
    notes: "Black Panthers bleiben kleine Elite: lieber weniger, dafuer stark und effizient.",
  },
  "M-S": {
    teamId: "M-S",
    primaryThemeTags: ["Harmony", "Fun", "TeamChemistry", "Charisma", "Social", "Friendly", "Loyal", "Cooperative", "Good", "Neutral"],
    secondaryThemeTags: ["Entertainer", "Healer", "Protector"],
    softPreferredTags: ["Entertainer", "Good", "Neutral"],
    allowedOutsiderTags: ["Human", "Animal", "Elf", "Beast"],
    avoidTags: ["Toxic", "Diva", "Betrayer"],
    targetShare: 0.45,
    minimumShare: 0.2,
    strictness: "medium",
    exceptionPolicy: "normal_quality_fit_allowed",
    qualityOverrideThreshold: 10,
    notes: "Mortal Sin ist hier als Fun Squad/Harmonie-Team modelliert.",
  },
  "N-N": {
    teamId: "N-N",
    primaryThemeTags: ["Female"],
    secondaryThemeTags: ["Assassin", "Ninja", "Overseer", "Backstab", "Shadow"],
    softPreferredTags: ["Fast", "Rogue", "Stealth"],
    allowedOutsiderTags: ["Assassin", "Ninja", "Shadow"],
    avoidTags: ["Male", "Lawful", "Pacifist"],
    targetShare: 0.7,
    minimumShare: 0.6,
    strictness: "strong",
    exceptionPolicy: "audit_required",
    qualityOverrideThreshold: 18,
    notes: "Nunchuck Ninjas: Backstabbing bitches, W-Anteil mindestens 60%, Ninja/Assassin/Overseer sekundär.",
  },
  "U-A": {
    teamId: "U-A",
    primaryThemeTags: ["Agent", "Stealth", "Efficient", "Operative"],
    secondaryThemeTags: ["Fast", "Assassin", "Tactician", "Spy"],
    softPreferredTags: ["Neutral", "Rogue", "Quiet"],
    allowedOutsiderTags: ["Human", "Construct", "Alien"],
    avoidTags: ["Showboat", "Berserker", "Loud"],
    targetShare: 0.7,
    minimumShare: 0.5,
    strictness: "strong",
    exceptionPolicy: "audit_required",
    qualityOverrideThreshold: 13,
    notes: "Undercover Agents: neutral, leise, schnell, effizient.",
  },
  "V-W": {
    teamId: "V-W",
    primaryThemeTags: ["Vigilante", "Hero", "Masked", "Protector"],
    secondaryThemeTags: ["Night", "Guardian", "Bounty", "Good"],
    softPreferredTags: ["Human", "Elf", "Rogue"],
    allowedOutsiderTags: ["Human", "Elf", "Angel"],
    avoidTags: ["Villain", "Coward", "Demon"],
    targetShare: 0.65,
    minimumShare: 0.45,
    strictness: "medium",
    exceptionPolicy: "audit_required",
    qualityOverrideThreshold: 12,
    notes: "Vigilante Wranglers: maskierte Nacht-Helden, die andere schuetzen.",
  },
  "T-C": {
    teamId: "T-C",
    primaryThemeTags: ["Faith", "Peace", "Cleric", "Healer", "Church"],
    secondaryThemeTags: ["Angel", "Divine", "Guardian", "Social", "Mental"],
    softPreferredTags: ["Harmony", "Good", "Lawful", "Human"],
    allowedOutsiderTags: ["Human", "Angel", "Paladin", "Knight"],
    avoidTags: ["Demon", "Sadist", "Chaos"],
    targetShare: 0.7,
    minimumShare: 0.5,
    strictness: "strong",
    exceptionPolicy: "audit_required",
    qualityOverrideThreshold: 14,
    notes: "The Chantry: Frieden, Glaube, Clerics/Healer, Harmonie und Social.",
  },
  "T-G": {
    teamId: "T-G",
    primaryThemeTags: ["Tall", "Giant", "Colossus", "Titan"],
    secondaryThemeTags: ["Power", "Strength", "Tank"],
    softPreferredTags: ["Ogre", "Tauren", "Dragon"],
    allowedOutsiderTags: ["Orc", "Tauren", "Dragon"],
    avoidTags: ["Small", "Tiny", "Gnome"],
    targetShare: 0.9,
    minimumShare: 0.6,
    strictness: "hard",
    exceptionPolicy: "only_if_major_upgrade",
    qualityOverrideThreshold: 24,
    notes: "The Giants: mindestens 60% Kader mit Groesse >= 6 (Tall/Giant-Tags).",
  },
  "Z-H": {
    teamId: "Z-H",
    primaryThemeTags: ["Opportunist", "Risk", "Clutch", "Lizard"],
    secondaryThemeTags: ["HighVariance", "Pact", "Star", "Winner"],
    softPreferredTags: ["Demon", "Goblin", "Mercenary"],
    allowedOutsiderTags: ["Lizard", "Demon", "Mercenary"],
    avoidTags: ["SafeLowCeiling", "ComfortableLoser"],
    targetShare: 0.55,
    minimumShare: 0.35,
    strictness: "medium",
    exceptionPolicy: "normal_quality_fit_allowed",
    qualityOverrideThreshold: 8,
    notes: "Zero Heroes: opportunistisch, Lizard-Pakte, 110% Risiko fuer ganz oben.",
  },
  "M-M": {
    teamId: "M-M",
    primaryThemeTags: ["Champion", "Star", "Closer", "Berserker", "Assassin", "Rogue", "Mercenary"],
    secondaryThemeTags: ["Winner", "TwoWay", "Hero", "Warlord", "Duelist", "Hunter", "Agile"],
    softPreferredTags: ["Demon", "Elite", "Risk", "Strength", "Executioner", "Brutal"],
    allowedOutsiderTags: ["Star", "Elite", "Champion", "Berserker", "Assassin", "Rogue"],
    avoidTags: ["LowAmbition", "LowCeiling", "Bard", "Social", "Royal", "Noble", "Court", "Trader"],
    targetShare: 0.45,
    minimumShare: 0.25,
    strictness: "strong",
    exceptionPolicy: "audit_required",
    qualityOverrideThreshold: 8,
    notes: "Mayhem Mavericks: Premium-Picks muessen Power/Speed, Killer-Vibe und aggressive Identity tragen; Bard/Social/Royal nur als spaete Ausnahme.",
  },
  "N-W": {
    teamId: "N-W",
    primaryThemeTags: ["Nature", "Plant", "Animal", "Forest", "Guardian"],
    secondaryThemeTags: ["Neutral", "Good", "Protector", "Druid"],
    softPreferredTags: ["Beast", "Spirit", "Calm"],
    allowedOutsiderTags: ["Elf", "Animal", "Plant", "Beast"],
    avoidTags: ["Evil", "Demon", "Machine", "Pollution"],
    targetShare: 0.75,
    minimumShare: 0.55,
    strictness: "strong",
    exceptionPolicy: "audit_required",
    qualityOverrideThreshold: 15,
    notes: "Natures Wrath: Naturbewahrer, neutral/gut, Plants/Animals/Waldprotektoren.",
  },
  "V-D": {
    teamId: "V-D",
    primaryThemeTags: ["Female"],
    secondaryThemeTags: ["Amazon", "Huntress", "Elf", "Nature"],
    softPreferredTags: ["Pet", "Animal", "Beast", "Forest", "Agile", "Social"],
    allowedOutsiderTags: ["Animal", "Beast", "Pet"],
    avoidTags: ["Male", "Brute", "Machine"],
    targetShare: 1,
    minimumShare: 0.95,
    strictness: "hard",
    exceptionPolicy: "only_if_major_upgrade",
    qualityOverrideThreshold: 26,
    // Frauen-Quote unter Nicht-Tieren: Pets/Tiere sind ausgenommen (duerfen jedes Geschlecht haben),
    // alle anderen muessen Frauen sein -> faktisch 100% Frauen im humanoiden Anteil.
    genderQuotaHumanoidScoped: true,
    notes: "Vicious & Delicious: Amazonen-Team. Alle Nicht-Tiere muessen weiblich sein; Pets/Tiere sind unabhaengig vom Geschlecht erlaubt.",
  },
  "V-V": {
    teamId: "V-V",
    primaryThemeTags: ["Viking"],
    secondaryThemeTags: ["Raider", "Warrior", "Berserker", "North"],
    softPreferredTags: ["Human", "Dwarf", "Strength"],
    allowedOutsiderTags: ["Berserker", "Raider"],
    avoidTags: ["Court", "Pacifist"],
    targetShare: 0.5,
    minimumShare: 0.45,
    strictness: "hard",
    exceptionPolicy: "only_if_major_upgrade",
    qualityOverrideThreshold: 20,
    notes: "Vigorous Vikings: ~50% mit Viking-Tag (Viking ist ein seltener Pool-Tag; guenstige Vikings sind rar) — Kern viking, Bank-Fueller duerfen andere sein.",
  },
  "C-S": {
    teamId: "C-S",
    primaryThemeTags: ["Swordsman", "Knight", "Swashbuckler", "Duelist"],
    secondaryThemeTags: ["Agile", "Fair", "Codex", "Social"],
    softPreferredTags: ["Lawful", "Rogue", "Hero"],
    allowedOutsiderTags: ["Human", "Elf", "Dwarf"],
    avoidTags: ["Berserker", "Brute", "Dishonorable"],
    targetShare: 0.75,
    minimumShare: 0.55,
    strictness: "strong",
    exceptionPolicy: "audit_required",
    qualityOverrideThreshold: 14,
    notes: "Cold Steel: Schwertkaempfer, agile faire Duellanten statt rohe Powerhouses.",
  },
  "T-T": {
    teamId: "T-T",
    primaryThemeTags: ["Teacher", "Mentor", "Leader"],
    secondaryThemeTags: ["Student", "Prospect", "Potential", "Scholar"],
    softPreferredTags: ["Value", "Training", "Youth"],
    allowedOutsiderTags: ["Human", "Elf", "Gnome"],
    avoidTags: ["Diva", "LowGrowth"],
    targetShare: 0.25,
    minimumShare: 0.08,
    strictness: "soft",
    exceptionPolicy: "normal_quality_fit_allowed",
    qualityOverrideThreshold: 8,
    notes: "Terrible Teachers: 1-2 starke Teacher plus viele trainierbare guenstige Prospects.",
  },
};

const PLAYER_THEME_TAG_CACHE = new WeakMap<Player, PlayerThemeTagRow>();
const THEMED_POOL_COUNT_CACHE = new WeakMap<GameState, Map<string, number>>();
const ROSTER_SHARE_CACHE = new WeakMap<GameState, Map<string, ReturnType<typeof calculateRosterShareUncached>>>();

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
    ["gender", player.gender],
    ["alignment", player.alignment],
    ...player.subclasses.map((value, index) => [`subclass${index + 1}`, value] as const),
    ...player.traitsPositive.map((value, index) => [`traitPositive${index + 1}`, value] as const),
    ...player.traitsNegative.map((value, index) => [`traitNegative${index + 1}`, value] as const),
    ["name_soft", player.name],
  ] as const;
  const normalizedValues = values.map(([source, value]) => [source, normalizeToken(value)] as const);

  for (const [source, value] of normalizedValues) {
    if (!value) continue;
    if (source === "gender") {
      if (["w", "f", "female", "weiblich", "woman", "frau"].includes(value)) addTag(tags, sources, "Female", source);
      if (["m", "male", "maennlich", "mann", "man"].includes(value)) addTag(tags, sources, "Male", source);
    }
    if (valueContains(value, ["female", "woman", "women", "frau", "amazon", "huntress", "succubus", "temptress"])) addTag(tags, sources, "Female", source);
    if (valueContains(value, [" male ", " man ", "men ", "incubus"])) addTag(tags, sources, "Male", source);
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
    if (valueContains(value, ["succubus", "incubus"])) {
      addTag(tags, sources, "Succubus", source);
      addTag(tags, sources, "SexyDemon", source);
      addTag(tags, sources, "Temptress", source);
      addTag(tags, sources, "Seduction", source);
    }
    if (valueContains(value, ["prime evil", "primeevil"])) addTag(tags, sources, "PrimeEvil", source);

    if (value.includes("divine")) addTag(tags, sources, "Divine", source);
    if (valueContains(value, ["angel", "fallen angel"])) addTag(tags, sources, "Angel", source);
    if (valueContains(value, ["paladin", "saint", "god", "holy", "guardian", "templar"])) {
      addTag(tags, sources, value.includes("holy") ? "Holy" : "Paladin", source);
      addTag(tags, sources, "Divine", source);
    }

    if (valueContains(value, ["aqua", "aquatic", "fish", "mermaid", "siren", "river", "water", "ocean", "sea", "shark", "leviathan", "coral"])) {
      addTag(tags, sources, "Aquatic", source);
      if (valueContains(value, ["aqua", "aquatic", "fish", "mermaid", "siren", "shark", "leviathan"])) addTag(tags, sources, "Fish", source);
      if (value.includes("mermaid")) addTag(tags, sources, "Mermaid", source);
      if (value.includes("siren")) addTag(tags, sources, "Siren", source);
      if (value.includes("river")) addTag(tags, sources, "River", source);
      if (value.includes("water")) addTag(tags, sources, "Water", source);
      if (value.includes("ocean") || value.includes("sea")) addTag(tags, sources, "Ocean", source);
      if (value.includes("shark")) addTag(tags, sources, "Shark", source);
      if (value.includes("leviathan")) addTag(tags, sources, "Leviathan", source);
      if (value.includes("coral")) addTag(tags, sources, "Coral", source);
    }

    if (valueContains(value, ["animal", "beast", "wolf", "werewolf", "bear", "cat", "hound", "monster", "creature", "wild", "jungle", "pet"])) {
      addTag(tags, sources, "Beast", source);
      if (value.includes("animal")) addTag(tags, sources, "Animal", source);
      if (value.includes("pet")) addTag(tags, sources, "Pet", source);
      if (value.includes("wild")) addTag(tags, sources, "Wild", source);
      if (value.includes("werewolf") || value.includes("wolf")) addTag(tags, sources, "Werewolf", source);
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

    if (valueContains(value, ["alien", "extraterrestrial", "xeno", "cosmic"])) addTag(tags, sources, "Alien", source);
    if (valueContains(value, ["lizard", "reptile", "saurian"])) addTag(tags, sources, "Lizard", source);

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

    if (valueContains(value, ["pirate", "swashbuckler", "wayfarer", "corsair", "seadog", "raider"])) {
      if (value.includes("pirate")) addTag(tags, sources, "Pirate", source);
      if (value.includes("swashbuckler")) addTag(tags, sources, "Swashbuckler", source);
      if (value.includes("wayfarer")) addTag(tags, sources, "Wayfarer", source);
      if (value.includes("corsair")) addTag(tags, sources, "Corsair", source);
      if (value.includes("raider")) addTag(tags, sources, "Raider", source);
    }

    if (valueContains(value, ["ambassador", "diplomat", "manipulator", "trader", "merchant", "broker", "profit"])) {
      if (value.includes("ambassador") || value.includes("diplomat")) addTag(tags, sources, "Ambassador", source);
      if (value.includes("manipulator")) addTag(tags, sources, "Manipulator", source);
      if (value.includes("trader") || value.includes("merchant") || value.includes("broker")) addTag(tags, sources, "Trader", source);
      if (value.includes("profit")) addTag(tags, sources, "Profit", source);
    }

    if (valueContains(value, ["bard", "charmer", "charisma", "social", "entertainer", "performer", "musician", "showman", "showcase"])) {
      if (value.includes("bard")) {
        addTag(tags, sources, "Bard", source);
        addTag(tags, sources, "Social", source);
      }
      if (value.includes("charmer") || value.includes("charisma")) addTag(tags, sources, "Charisma", source);
      if (value.includes("social")) addTag(tags, sources, "Social", source);
      if (valueContains(value, ["entertainer", "performer", "musician", "showman", "showcase"])) addTag(tags, sources, "Showboat", source);
    }

    if (valueContains(value, ["melancholy", "melancholic", "depress", "sad", "outcast", "no quit", "unbreakable", "resilient"])) {
      if (value.includes("melanch")) addTag(tags, sources, "Melancholy", source);
      if (value.includes("depress")) addTag(tags, sources, "Depression", source);
      if (value.includes("outcast")) addTag(tags, sources, "Outcast", source);
      if (value.includes("no quit") || value.includes("unbreakable") || value.includes("resilient")) addTag(tags, sources, "NoQuit", source);
      addTag(tags, sources, "Resilience", source);
    }

    if (valueContains(value, ["ninja", "assassin", "overseer", "backstab", "shadow", "rogue", "stealth", "spy", "agent", "operative", "infiltrator"])) {
      if (value.includes("ninja")) addTag(tags, sources, "Ninja", source);
      if (value.includes("assassin")) addTag(tags, sources, "Assassin", source);
      if (value.includes("overseer")) addTag(tags, sources, "Overseer", source);
      if (value.includes("backstab")) addTag(tags, sources, "Backstab", source);
      if (value.includes("shadow")) addTag(tags, sources, "Shadow", source);
      if (value.includes("rogue")) addTag(tags, sources, "Rogue", source);
      if (value.includes("stealth")) addTag(tags, sources, "Stealth", source);
      if (value.includes("agent") || value.includes("operative") || value.includes("infiltrator") || value.includes("spy")) {
        addTag(tags, sources, "Agent", source);
        addTag(tags, sources, "Operative", source);
      }
    }

    if (valueContains(value, ["vigilante", "masked", "mask", "hero", "protector", "night", "guardian"])) {
      if (value.includes("vigilante")) addTag(tags, sources, "Vigilante", source);
      if (value.includes("masked") || value.includes("mask")) addTag(tags, sources, "Masked", source);
      if (value.includes("hero")) addTag(tags, sources, "Hero", source);
      if (value.includes("protector")) addTag(tags, sources, "Protector", source);
      if (value.includes("night")) addTag(tags, sources, "Night", source);
    }

    if (valueContains(value, ["faith", "peace", "cleric", "healer", "church", "priest", "choir", "pacifist"])) {
      if (value.includes("faith") || value.includes("priest")) addTag(tags, sources, "Faith", source);
      if (value.includes("peace") || value.includes("pacifist")) addTag(tags, sources, "Peace", source);
      if (value.includes("cleric")) addTag(tags, sources, "Cleric", source);
      if (value.includes("healer")) addTag(tags, sources, "Healer", source);
      if (value.includes("church") || value.includes("choir")) addTag(tags, sources, "Church", source);
    }

    if (valueContains(value, ["giant", "colossus", "titan", "tower", "large", "tall", "ogre", "tauren"])) {
      addTag(tags, sources, "Tall", source);
      if (value.includes("giant")) addTag(tags, sources, "Giant", source);
      if (value.includes("colossus")) addTag(tags, sources, "Colossus", source);
      if (value.includes("titan")) addTag(tags, sources, "Titan", source);
    }
    if (valueContains(value, ["small", "tiny", "gnome", "gnom"])) {
      addTag(tags, sources, "Small", source);
      if (value.includes("tiny")) addTag(tags, sources, "Tiny", source);
      if (value.includes("gnom")) addTag(tags, sources, "Gnome", source);
    }

    if (valueContains(value, ["viking", "northman", "raider", "berserker"])) {
      if (value.includes("viking") || value.includes("northman")) addTag(tags, sources, "Viking", source);
      if (value.includes("berserker")) addTag(tags, sources, "Berserker", source);
      if (value.includes("raider")) addTag(tags, sources, "Raider", source);
    }

    if (valueContains(value, ["sword", "swordsman", "duelist", "blade", "codex", "fair", "gladiator", "samurai"])) {
      if (value.includes("sword") || value.includes("blade") || value.includes("gladiator") || value.includes("samurai")) {
        addTag(tags, sources, "Swordsman", source);
      }
      if (value.includes("duelist")) addTag(tags, sources, "Duelist", source);
      if (value.includes("codex")) addTag(tags, sources, "Codex", source);
      if (value.includes("fair")) addTag(tags, sources, "Fair", source);
      addTag(tags, sources, "Agile", source);
    }
    if (valueContains(value, ["warrior", "fighter", "knight", "swashbuckler"]) && !value.includes("warlord")) {
      if (value.includes("knight") || value.includes("swashbuckler")) addTag(tags, sources, "Knight", source);
      if (value.includes("warrior") || value.includes("fighter")) addTag(tags, sources, "Swordsman", source);
      if (value.includes("swashbuckler")) addTag(tags, sources, "Swashbuckler", source);
    }
    if (valueContains(value, ["crusader", "templar", "inquisitor", "holy war"])) {
      addTag(tags, sources, "Crusader", source);
      if (value.includes("templar") || value.includes("holy war")) addTag(tags, sources, "Paladin", source);
    }
    if (valueContains(value, ["cleric", "healer", "monk", "peace", "faith", "church"])) {
      if (value.includes("cleric")) addTag(tags, sources, "Cleric", source);
      if (value.includes("healer")) addTag(tags, sources, "Healer", source);
      if (value.includes("monk")) addTag(tags, sources, "Monk", source);
      if (value.includes("peace") || value.includes("faith") || value.includes("church")) addTag(tags, sources, "Faith", source);
    }

    if (valueContains(value, ["teacher", "mentor", "student", "pupil", "prospect", "leader", "captain"])) {
      if (value.includes("teacher")) addTag(tags, sources, "Teacher", source);
      if (value.includes("mentor")) addTag(tags, sources, "Mentor", source);
      if (value.includes("student") || value.includes("pupil")) addTag(tags, sources, "Student", source);
      if (value.includes("prospect")) addTag(tags, sources, "Prospect", source);
      if (value.includes("leader") || value.includes("captain")) addTag(tags, sources, "Leader", source);
    }

    if (valueContains(value, ["champion", "star", "closer", "winner", "elite", "allround", "efficient", "two way", "two-way"])) {
      if (value.includes("champion")) addTag(tags, sources, "Champion", source);
      if (value.includes("star")) addTag(tags, sources, "Star", source);
      if (value.includes("closer")) addTag(tags, sources, "Closer", source);
      if (value.includes("winner")) addTag(tags, sources, "Winner", source);
      if (value.includes("elite")) addTag(tags, sources, "Elite", source);
      if (value.includes("allround")) addTag(tags, sources, "Allrounder", source);
      if (value.includes("efficient")) addTag(tags, sources, "Efficient", source);
      if (value.includes("two way") || value.includes("two-way")) addTag(tags, sources, "TwoWay", source);
    }

    if (valueContains(value, ["chaos", "lunatic", "crazy", "brutal", "torment", "will", "strength", "power", "executioner", "zealot"])) {
      if (value.includes("chaos") || value.includes("crazy")) addTag(tags, sources, "Chaos", source);
      if (value.includes("lunatic")) addTag(tags, sources, "Lunatic", source);
      if (value.includes("brutal")) addTag(tags, sources, "Brutal", source);
      if (value.includes("torment")) addTag(tags, sources, "Torment", source);
      if (value.includes("will")) addTag(tags, sources, "Will", source);
      if (value.includes("strength") || value.includes("power")) addTag(tags, sources, "Strength", source);
      if (value.includes("executioner")) addTag(tags, sources, "Executioner", source);
      if (value.includes("zealot")) addTag(tags, sources, "Zealot", source);
    }

    if (valueContains(value, ["plant", "druid", "nature", "forest", "calm", "neutral"])) addTag(tags, sources, value.includes("plant") ? "Plant" : "Nature", source);
    if (value.includes("forest")) addTag(tags, sources, "Forest", source);
    if (value.includes("calm")) addTag(tags, sources, "Calm", source);
    if (value.includes("neutral")) addTag(tags, sources, "Neutral", source);
    if (valueContains(value, ["good", "lawful"])) addTag(tags, sources, value.includes("lawful") ? "Lawful" : "Good", source);
    if (valueContains(value, ["evil", "villain", "sadist"])) addTag(tags, sources, value.includes("evil") ? "Evil" : "Villain", source);
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

  const stats = player.attributeSheetStats as Record<string, unknown> | undefined;
  const height = Number(stats?.height ?? stats?.size ?? stats?.bodySize);
  if (Number.isFinite(height)) {
    if (height >= 6) addTag(tags, sources, "Tall", "attributeSheetStats.height");
    if (height >= 8) addTag(tags, sources, "Giant", "attributeSheetStats.height");
    if (height >= 9) addTag(tags, sources, "Colossus", "attributeSheetStats.height");
    if (height >= 10) addTag(tags, sources, "Titan", "attributeSheetStats.height");
    if (height <= 3) addTag(tags, sources, "Small", "attributeSheetStats.height");
    if (height <= 2) addTag(tags, sources, "Tiny", "attributeSheetStats.height");
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

function getCachedPlayerThemeTags(player: Player) {
  const cached = PLAYER_THEME_TAG_CACHE.get(player);
  if (cached) return cached;
  const computed = derivePlayerThemeTags(player);
  PLAYER_THEME_TAG_CACHE.set(player, computed);
  return computed;
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

export const UNDEAD_IDENTITY_THEME_TAGS = [
  "Undead",
  "Vampire",
  "Skeleton",
  "Ghoul",
  "Lich",
  "Zombie",
  "Ghost",
  "Reaper",
] as const;

export function isUndeadIdentityThemePlayer(player: Player): boolean {
  const tags = new Set(getCachedPlayerThemeTags(player).playerThemeTags);
  return hasAny(tags, [...UNDEAD_IDENTITY_THEME_TAGS]);
}

function playerCountsForPrimaryThemeShare(player: Player, target: TeamThemeCompositionTarget): boolean {
  const tags = new Set(getCachedPlayerThemeTags(player).playerThemeTags);
  if (hasAny(tags, target.primaryThemeTags)) return true;
  if (target.teamId === "L-R" || target.teamId === "L-K") {
    return hasAny(tags, target.secondaryThemeTags);
  }
  return false;
}

function hasHardIdentityOverride(teamId: string, tags: Set<string>) {
  switch (teamId) {
    case "H-R":
      return hasAny(tags, ["Demon", "Hell", "Infernal", "Devil", "Fiend", "PrimeEvil", "Succubus", "Incubus", "SexyDemon"]);
    case "P-C":
      return hasAny(tags, ["Pirate", "Swashbuckler", "Wayfarer", "Corsair"]);
    case "D-P":
      return hasAny(tags, ["Female"]) && hasAny(tags, ["Demon", "Hell", "Infernal", "Succubus", "SexyDemon", "Dark", "Shadow", "Temptress"]);
    case "T-G":
      return hasAny(tags, ["Tall", "Giant", "Colossus", "Titan"]);
    case "V-D":
      return hasAny(tags, ["Female", "Pet", "Animal", "Beast"]);
    case "D-L":
      return hasAny(tags, ["Human"]);
    case "S-S":
      return hasAny(tags, ["Construct", "Robot", "Android", "Machine", "Augmented", "Cyborg", "Steel"]);
    case "L-K":
    case "L-R":
      return hasAny(tags, [...UNDEAD_IDENTITY_THEME_TAGS]);
    default:
      return false;
  }
}

function calculateRosterShareUncached(input: { gameState: GameState; teamId: string; target: TeamThemeCompositionTarget }) {
  const playerById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
  const rosterPlayers = input.gameState.rosters
    .filter((entry) => entry.teamId === input.teamId)
    .map((entry) => playerById.get(entry.playerId))
    .filter((player): player is Player => Boolean(player));
  const count = rosterPlayers.length;
  if (count === 0) {
    return { rosterPlayers, primaryCount: 0, secondaryCount: 0, combinedCount: 0, primaryShare: 0, combinedShare: 0 };
  }
  // Quoten-Identitaeten (H-R Demon-Rasse, D-P/V-D Frauen unter Nicht-Tieren) berechnen den
  // primaryShare ueber die Rollen-Klassifikation: "exempt"/"none" sind aus Zaehler UND Nenner
  // ausgenommen, "violates" zaehlt nur in den Nenner. combinedShare bleibt auf dem Gesamtkader.
  const quotaScoped = isQuotaScopedTarget(input.target);
  let primaryCount = 0;
  let primaryDenominator = 0;
  if (quotaScoped) {
    for (const player of rosterPlayers) {
      const role = classifyIdentityQuotaRole(player, input.target);
      if (role === "exempt" || role === "none") continue;
      primaryDenominator += 1;
      if (role === "counts") primaryCount += 1;
    }
  } else {
    primaryDenominator = rosterPlayers.length;
    for (const player of rosterPlayers) {
      if (playerCountsForPrimaryThemeShare(player, input.target)) primaryCount += 1;
    }
  }
  let secondaryCount = 0;
  for (const player of rosterPlayers) {
    const tags = new Set(getCachedPlayerThemeTags(player).playerThemeTags);
    if (hasAny(tags, input.target.secondaryThemeTags)) secondaryCount += 1;
  }
  const combinedCount = rosterPlayers.filter((player) => {
    const tags = new Set(getCachedPlayerThemeTags(player).playerThemeTags);
    return hasAny(tags, [...input.target.primaryThemeTags, ...input.target.secondaryThemeTags, ...input.target.softPreferredTags]);
  }).length;
  return {
    rosterPlayers,
    primaryCount,
    secondaryCount,
    combinedCount,
    primaryShare: primaryDenominator > 0 ? primaryCount / primaryDenominator : 1,
    combinedShare: combinedCount / count,
  };
}

function rosterShare(input: { gameState: GameState; teamId: string; target: TeamThemeCompositionTarget }) {
  let map = ROSTER_SHARE_CACHE.get(input.gameState);
  if (!map) {
    map = new Map();
    ROSTER_SHARE_CACHE.set(input.gameState, map);
  }
  const rosterSignature = input.gameState.rosters
    .filter((entry) => entry.teamId === input.teamId)
    .map((entry) => entry.playerId)
    .sort()
    .join("|");
  const cacheKey = `${input.teamId}:${rosterSignature}`;
  const cached = map.get(cacheKey);
  if (cached) return cached;
  const computed = calculateRosterShareUncached(input);
  map.set(cacheKey, computed);
  return computed;
}

function getThemedPoolCount(gameState: GameState, target: TeamThemeCompositionTarget) {
  let map = THEMED_POOL_COUNT_CACHE.get(gameState);
  if (!map) {
    map = new Map<string, number>();
    THEMED_POOL_COUNT_CACHE.set(gameState, map);
  }
  const cached = map.get(target.teamId);
  if (cached != null) return cached;
  const targetTags = [...target.primaryThemeTags, ...target.secondaryThemeTags];
  const count = gameState.players.filter((player) => {
    const playerTags = new Set(getCachedPlayerThemeTags(player).playerThemeTags);
    return hasAny(playerTags, targetTags);
  }).length;
  map.set(target.teamId, count);
  return count;
}

export function buildTeamThemeCompositionRuntimeContext(
  gameState: GameState,
  team: Pick<Team, "teamId" | "name"> | string,
): TeamThemeCompositionRuntimeContext {
  const target = getTeamThemeCompositionTarget(team);
  if (!target) {
    return { target: null, rosterShare: null, themedPoolCount: null };
  }
  const teamId = typeof team === "string" ? team : team.teamId;
  return {
    target,
    rosterShare: rosterShare({ gameState, teamId, target }),
    themedPoolCount: getThemedPoolCount(gameState, target),
  };
}

function getPlayerThemeQuality(player: Player) {
  const coreValues = Object.values(player.coreStats ?? {}).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const disciplineValues = Object.values(player.disciplineRatings ?? {}).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return Math.max(
    coreValues.length > 0 ? Math.max(...coreValues) : 0,
    disciplineValues.length > 0 ? Math.max(...disciplineValues) : 0,
  );
}

export function calculateThemeCompositionScore(input: {
  gameState: GameState;
  team: Pick<Team, "teamId" | "name">;
  player: Player;
  candidateQuality: number;
  candidateRoleFit?: number | null;
  currentTeamNeeds?: string[] | null;
  phase?: "phase_a_minimum" | "phase_b_core_optimum" | "phase_c_depth_luxury" | null;
  runtimeContext?: TeamThemeCompositionRuntimeContext | null;
}): TeamThemeCompositionScore {
  const target = input.runtimeContext?.target ?? getTeamThemeCompositionTarget(input.team);
  const tagRow = getCachedPlayerThemeTags(input.player);
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
      identityQuotaRole: "none",
      identityFloorAdjustment: 0,
    };
  }

  const share = input.runtimeContext?.rosterShare ?? rosterShare({ gameState: input.gameState, teamId: input.team.teamId, target });
  // Quoten-Identitaeten (H-R Demon-Rasse, D-P/V-D Frauen unter Nicht-Tieren) leiten den
  // Primary-Match aus der Rollen-Klassifikation ab, damit Floor-Metrik und Scoring konsistent sind.
  const quotaScoped = isQuotaScopedTarget(target);
  const quotaRole: IdentityQuotaRole = quotaScoped ? classifyIdentityQuotaRole(input.player, target) : "none";
  const quotaCounts = quotaRole === "counts";
  const quotaExempt = quotaRole === "exempt";
  const quotaViolates = quotaRole === "violates";
  const primaryMatch = quotaScoped ? quotaCounts : playerCountsForPrimaryThemeShare(input.player, target);
  const secondaryMatch = hasAny(tags, target.secondaryThemeTags);
  const softMatch = hasAny(tags, target.softPreferredTags);
  const allowedOutsider = hasAny(tags, target.allowedOutsiderTags);
  // Bei Quoten-Teams gilt: "counts" und "exempt" wirken wie ein Identity-Override (kein Avoid-/Miss-
  // Malus), "violates" nicht. Sonst weiter ueber die teamspezifische Tag-Heuristik.
  const hardIdentityOverride = quotaScoped ? quotaCounts || quotaExempt : hasHardIdentityOverride(input.team.teamId, tags);
  const avoidMatch = hasAny(tags, target.avoidTags) && !hardIdentityOverride;
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
  // Floor-Eligibilitaet: Bei Quoten-Teams strikt ueber die Rolle (exempt ist neutral, kein Miss),
  // sonst wie bisher ueber den Identity-Override.
  const recoveryEligible = quotaScoped ? quotaCounts : hardIdentityOverride;
  const missEligible = quotaScoped ? quotaViolates : !hardIdentityOverride;
  const hardQuotaRecoveryBonus = target.strictness === "hard" && belowMinimum && recoveryEligible ? 35 : 0;
  const hardQuotaMissPenalty = target.strictness === "hard" && belowMinimum && missEligible ? -80 : 0;
  // Starker, NICHT geclampter rawScore-Delta fuer die Markt-Bewertung: nur fuer Quoten-Teams.
  // Unter Minimum dominiert er (Quote-Kandidaten hoch, Verletzer runter, exempt neutral); zwischen
  // Minimum und Ziel bleibt ein milder Anreiz ("mehr ist besser"). Niemals ein Hard-Block.
  const enforceQuotaFloor = quotaScoped && (target.strictness === "hard" || target.strictness === "strong");
  const enforceTagFloor = !quotaScoped && (target.strictness === "hard" || target.strictness === "strong");
  const tagThemed = primaryMatch || secondaryMatch;
  const tagSoftThemed = softMatch;
  const tagMiss = !tagThemed && !tagSoftThemed && avoidMatch;
  const identityFloorAdjustment =
    !enforceQuotaFloor && !enforceTagFloor
      ? 0
      : belowMinimum
        ? quotaScoped
          ? quotaCounts
            ? 0.6
            : quotaViolates
              ? -0.9
              : 0
          : tagThemed
            ? 0.6
            : tagSoftThemed
              ? 0.25
              : tagMiss
                ? -0.9
                : -0.35
        : belowTarget && (quotaScoped ? quotaCounts : tagThemed)
          ? 0.1
          : 0;
  const roleFit = input.candidateRoleFit ?? 0;
  const qualityOverrideBonus =
    outsider && input.candidateQuality + roleFit >= target.qualityOverrideThreshold ? Math.min(18, (input.candidateQuality + roleFit - target.qualityOverrideThreshold) * 0.45) : 0;
  const themedPool = input.runtimeContext?.themedPoolCount ?? getThemedPoolCount(input.gameState, target);
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
      hardQuotaRecoveryBonus +
      hardQuotaMissPenalty +
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
      hardIdentityOverride ? "hard_identity_match" : null,
      hardQuotaMissPenalty < 0 ? "hard_quota_miss" : null,
      qualityOverrideBonus > 0 ? "quality_override" : null,
      quotaScoped ? `quota_${quotaRole}` : null,
    ]
      .filter(Boolean)
      .join("|"),
    identityQuotaRole: quotaRole,
    identityFloorAdjustment: Number(identityFloorAdjustment.toFixed(2)),
  };
}

export function buildTeamThemeCompositionAudit(gameState: GameState, options: { candidateMissLimit?: number } = {}): TeamThemeCompositionAuditRow[] {
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const rosteredPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  const candidateMissLimit = options.candidateMissLimit ?? gameState.players.length;
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
        candidateQuality: getPlayerThemeQuality(player),
        candidateRoleFit: 0,
      });
      if (score.themeCompositionScore > bestThemeScore) {
        bestThemeScore = score.themeCompositionScore;
        bestThemePick = `${player.name} (${score.themeTier})`;
      }
      if (score.themeTier === "outsider" || score.themeTier === "avoid") {
        outsiders.push(`${player.name}:${score.reason}`);
        const quality = getPlayerThemeQuality(player);
        if (quality > worstMissQuality) {
          worstMissQuality = quality;
          worstThemeMiss = `${player.name} (${score.themeTier})`;
        }
      }
    }
    const candidateMisses = gameState.players
      .filter((player) => !rosteredPlayerIds.has(player.id))
      .slice(0, candidateMissLimit)
      .map((player) => ({
        player,
        score: calculateThemeCompositionScore({ gameState, team, player, candidateQuality: getPlayerThemeQuality(player) }),
      }))
      .filter((entry) => entry.score.themeTier === "core_theme" || entry.score.themeTier === "secondary_theme")
      .sort((left, right) => getPlayerThemeQuality(right.player) - getPlayerThemeQuality(left.player))
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

export type DraftThemePickPhase =
  | "minimum_skeleton"
  | "early_core"
  | "identity_core"
  | "identity_reserve"
  | "specialist_fill"
  | "late_core_investment"
  | "star_investment";

export function mapDraftPickPhaseToThemePhase(
  pickPhase: DraftThemePickPhase,
): "phase_a_minimum" | "phase_b_core_optimum" | "phase_c_depth_luxury" {
  if (pickPhase === "minimum_skeleton") return "phase_a_minimum";
  if (pickPhase === "identity_reserve" || pickPhase === "identity_core" || pickPhase === "early_core") {
    return "phase_b_core_optimum";
  }
  return "phase_c_depth_luxury";
}

export function computeDraftThemePickScoreContribution(input: {
  themeScore: TeamThemeCompositionScore;
  strictness: TeamThemeStrictness | null | undefined;
  pickPhase: DraftThemePickPhase;
}): number {
  const phase = mapDraftPickPhaseToThemePhase(input.pickPhase);
  const phaseMultiplier = phase === "phase_a_minimum" ? 0.1 : phase === "phase_b_core_optimum" ? 0.16 : 0.11;
  const strictnessMultiplier =
    input.strictness === "hard" ? 1.25 : input.strictness === "strong" ? 1.1 : input.strictness === "medium" ? 0.9 : 0.75;
  const composition = input.themeScore.themeCompositionScore * phaseMultiplier * strictnessMultiplier;
  const floor = input.themeScore.identityFloorAdjustment * 28;
  const reserveBoost =
    input.pickPhase === "identity_reserve" &&
    (input.themeScore.themeTier === "core_theme" || input.themeScore.themeTier === "secondary_theme")
      ? 6
      : 0;
  const identityReserveAvoidPenalty =
    input.pickPhase === "identity_reserve" && input.themeScore.themeTier === "avoid" ? -20 : 0;
  const strictEarlyThemeLane =
    (input.strictness === "hard" || input.strictness === "strong") &&
    (phase === "phase_a_minimum" || phase === "phase_b_core_optimum");
  const strictEarlyCoreBoost =
    strictEarlyThemeLane &&
    (input.themeScore.themeTier === "core_theme" || input.themeScore.themeTier === "secondary_theme")
      ? 8
      : 0;
  const strictEarlyAvoidPenalty =
    strictEarlyThemeLane && input.themeScore.themeTier === "avoid" ? -14 : 0;
  return Number(
    (
      composition +
      floor +
      reserveBoost +
      identityReserveAvoidPenalty +
      strictEarlyCoreBoost +
      strictEarlyAvoidPenalty
    ).toFixed(2),
  );
}

export function teamNeedsThemeReserve(context: TeamThemeCompositionRuntimeContext | null | undefined) {
  const target = context?.target ?? null;
  const share = context?.rosterShare ?? null;
  if (!target || !share) return false;
  if (target.strictness !== "hard" && target.strictness !== "strong") return false;
  const currentShare = share.primaryShare;
  const projectedNonThemeShare =
    share.rosterPlayers.length > 0
      ? share.primaryCount / Math.max(1, share.rosterPlayers.length + 1)
      : 0;
  return (
    currentShare + 0.001 < target.minimumShare || projectedNonThemeShare + 0.001 < target.minimumShare
  );
}

export function buildPlayerThemeTagRows(players: Player[]): PlayerThemeTagRow[] {
  return players.map(derivePlayerThemeTags);
}

export function resolveThemeTargetsForProfiles(profiles: Record<string, TeamStrategyProfile>) {
  return Object.fromEntries(Object.keys(profiles).map((teamId) => [teamId, getTeamThemeCompositionTarget(teamId)]));
}
