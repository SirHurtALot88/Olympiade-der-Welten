import type {
  GameState,
  Team,
  TeamBoardConfidenceRecord,
  TeamGeneralManagerArchetype,
  TeamGeneralManagerAssignment,
  TeamGeneralManagerProfile,
  TeamIdentity,
  TeamStrategyBias,
  TeamStrategyProfile,
  TransferHistoryEntry,
} from "@/lib/data/olyDataTypes";

export const GM_INFLUENCE_PCT = 30;
export const GM_WILDCARD_ASSIGNMENT_CHANCE_PCT = 7;
const GM_WILDCARD_MAX_SCORE_GAP = 75;
/** Score-Band um den Best-Fit, aus dem ein Seed-Salt einen GM wählen darf (Audit-Varianz). */
const GM_SEED_VARIATION_SCORE_GAP = 60;
const GM_SEED_VARIATION_POOL_SIZE = 6;
const GM_ARCHETYPE_DIVERSITY_THRESHOLD = 3;
const GM_ARCHETYPE_DIVERSITY_BASE_MALUS = 12;
const GM_ARCHETYPE_DIVERSITY_STEP_MALUS = 4;
const GM_ARCHETYPE_DIVERSITY_MAX_MALUS = 20;

/**
 * Optionales, prozessweites Seed-Salt für die GM-Zuweisung. Wird (z.B. von Audits) pro Lauf
 * gesetzt, damit frische Saves desselben Season-IDs unterschiedliche, aber fit-nahe GMs ziehen.
 * Greift nur bei Neuzuweisung (fresh saves); bestehende Zuweisungen bleiben unberührt.
 */
let gmAssignmentSeedSalt: string | null = null;
export function setGmAssignmentSeedSalt(salt: string | null | undefined) {
  gmAssignmentSeedSalt = salt && salt.trim().length > 0 ? salt.trim() : null;
}
export function getGmAssignmentSeedSalt() {
  return gmAssignmentSeedSalt;
}
export const GM_BOARD_REPLACEMENT_CONFIDENCE_THRESHOLD = 2.5;
export const GM_BOARD_REPLACEMENT_PRESSURE_THRESHOLD = 9;

type GmSeed = Omit<TeamGeneralManagerProfile, "gmId" | "name" | "description"> & {
  nameRoot: string;
  descriptionRoot: string;
};

const archetypeSeeds: GmSeed[] = [
  {
    archetype: "bargain_hunter",
    title: "Bargain Hunter GM",
    nameRoot: "Bargain Hunter",
    descriptionRoot: "Verkauft ueberbezahlte Stars, jagt Marktwert/Gehalt-Ratio und laesst selten totes Geld liegen.",
    pow: 4,
    spe: 4,
    men: 5,
    soc: 7,
    ambition: 4,
    finances: 10,
    boardConfidence: 7,
    harmony: 6,
    manners: 7,
    popularity: 5,
    cooperation: 8,
    playerOptDelta: 0,
    preferredTraits: ["Diligent", "Mercenary", "Resourceful"],
    facilityPriorities: ["scouting_room", "contract_office", "academy"],
    marketDoctrine: "Value vor Glamour, lange Deals nur bei klarer Ersparnis.",
    lineupDoctrine: "Solide Einsaetze, wenig Push-Risiko bei teuren Assets.",
    bias: {
      cashPriority: 10,
      valuePriority: 10,
      wageSensitivity: 10,
      sellForProfitAggression: 9,
      shortContractPreference: 7,
      longContractPreference: 6,
      riskTolerance: 3,
      starPriority: 3,
    },
  },
  {
    archetype: "talent_builder",
    title: "Talent Builder GM",
    nameRoot: "Talent Builder",
    descriptionRoot: "Akzeptiert kurze Ergebnisdellen, wenn junge Spieler, Training und XP langfristig besser werden.",
    pow: 4,
    spe: 5,
    men: 8,
    soc: 3,
    ambition: 7,
    finances: 6,
    boardConfidence: 6,
    harmony: 8,
    manners: 7,
    popularity: 4,
    cooperation: 8,
    playerOptDelta: 1,
    preferredTraits: ["Diligent", "Motivated", "Healthy"],
    facilityPriorities: ["academy", "training_center", "recovery_center"],
    marketDoctrine: "Kauft entwickelbare Spieler mit gutem Fit statt fertiger Luxusloesungen.",
    lineupDoctrine: "Gibt Prospects echte Einsaetze, wenn der Saisonplan es erlaubt.",
    bias: {
      valuePriority: 8,
      rosterDepthPreference: 8,
      eliteSmallRosterPreference: 3,
      loyaltyBias: 7,
      harmonyStrictness: 8,
      riskTolerance: 5,
      starPriority: 4,
    },
  },
  {
    archetype: "star_chaser",
    title: "Star Chaser GM",
    nameRoot: "Star Chaser",
    descriptionRoot: "Will echte Difference Maker, akzeptiert hohe Gehaelter und jagt Titelhebel aggressiv.",
    pow: 7,
    spe: 6,
    men: 5,
    soc: 2,
    ambition: 10,
    finances: 3,
    boardConfidence: 5,
    harmony: 4,
    manners: 4,
    popularity: 9,
    cooperation: 4,
    playerOptDelta: -1,
    preferredTraits: ["Ambitious", "Fearless", "FanFavorite"],
    facilityPriorities: ["scouting_room", "performance_lab", "arena_ops"],
    marketDoctrine: "Topstars zuerst, Ratio erst danach.",
    lineupDoctrine: "Beste Spieler tragen die wichtigsten Disziplinen, Push ist erlaubt.",
    bias: {
      starPriority: 10,
      riskTolerance: 8,
      wageSensitivity: 2,
      cashPriority: 2,
      eliteSmallRosterPreference: 9,
      rosterDepthPreference: 3,
      longContractPreference: 7,
    },
  },
  {
    archetype: "depth_spammer",
    title: "Depth Spammer GM",
    nameRoot: "Depth Spammer",
    descriptionRoot: "Will Optionen, Rotation und Matchup-Abdeckung. Lieber zwoelf brauchbare Spieler als acht perfekte.",
    pow: 5,
    spe: 5,
    men: 5,
    soc: 5,
    ambition: 6,
    finances: 5,
    boardConfidence: 6,
    harmony: 7,
    manners: 5,
    popularity: 5,
    cooperation: 8,
    playerOptDelta: 2,
    preferredTraits: ["Flexible", "Loyal", "Healthy"],
    facilityPriorities: ["recovery_center", "academy", "scouting_room"],
    marketDoctrine: "Viele bezahlbare Rollen, wenige Alles-oder-nichts-Wetten.",
    lineupDoctrine: "Verteilt Last, nutzt Bank und schont Stars haeufiger.",
    bias: {
      rosterDepthPreference: 10,
      eliteSmallRosterPreference: 1,
      valuePriority: 7,
      riskTolerance: 4,
      loyaltyBias: 6,
      harmonyStrictness: 7,
    },
  },
  {
    archetype: "elite_curator",
    title: "Elite Curator GM",
    nameRoot: "Elite Curator",
    descriptionRoot: "Pflegt kleine Premium-Kader, verkauft Rollenspieler schnell und sucht perfekte Fits.",
    pow: 6,
    spe: 4,
    men: 7,
    soc: 3,
    ambition: 8,
    finances: 6,
    boardConfidence: 7,
    harmony: 6,
    manners: 7,
    popularity: 7,
    cooperation: 5,
    playerOptDelta: -2,
    preferredTraits: ["Disciplined", "Cool", "Fearless"],
    facilityPriorities: ["performance_lab", "recovery_center", "contract_office"],
    marketDoctrine: "Wenige Spieler, hoher Fit, keine mittelmaessige Bank.",
    lineupDoctrine: "Stars in Kernslots, klare Hierarchie.",
    bias: {
      starPriority: 8,
      valuePriority: 6,
      eliteSmallRosterPreference: 10,
      rosterDepthPreference: 2,
      wageSensitivity: 6,
      harmonyStrictness: 7,
      longContractPreference: 6,
    },
  },
  {
    archetype: "facility_architect",
    title: "Facility Architect GM",
    nameRoot: "Facility Architect",
    descriptionRoot: "Denkt strukturell: Gebaeude, Staff, Training und nachhaltige Infrastruktur vor Panikkaeufen.",
    pow: 3,
    spe: 3,
    men: 10,
    soc: 4,
    ambition: 6,
    finances: 8,
    boardConfidence: 9,
    harmony: 7,
    manners: 8,
    popularity: 4,
    cooperation: 9,
    playerOptDelta: 0,
    preferredTraits: ["Diligent", "Resourceful", "Caring"],
    facilityPriorities: ["academy", "recovery_center", "performance_lab"],
    marketDoctrine: "Kauft nur, wenn Infrastruktur und Cashflow nicht leiden.",
    lineupDoctrine: "Plant Belastung konservativ und nutzt Facility-Boni konsequent.",
    bias: {
      cashPriority: 8,
      valuePriority: 7,
      wageSensitivity: 8,
      longContractPreference: 6,
      riskTolerance: 3,
      harmonyStrictness: 8,
      rosterDepthPreference: 6,
    },
  },
  {
    archetype: "risk_gambler",
    title: "Risk Gambler GM",
    nameRoot: "Risk Gambler",
    descriptionRoot: "Hebelt Form, Push, Trades und Rivalitaeten. Kann genial wirken oder eine Saison anzuenden.",
    pow: 6,
    spe: 7,
    men: 3,
    soc: 4,
    ambition: 9,
    finances: 3,
    boardConfidence: 3,
    harmony: 3,
    manners: 2,
    popularity: 8,
    cooperation: 3,
    playerOptDelta: 0,
    preferredTraits: ["Ambitious", "Renegade", "Gambler"],
    facilityPriorities: ["arena_ops", "performance_lab", "scouting_room"],
    marketDoctrine: "Nimmt volatile Deals, wenn der Upside gross genug ist.",
    lineupDoctrine: "Push-freudig, high ceiling, wenig Angst vor roten Zonen.",
    bias: {
      riskTolerance: 10,
      starPriority: 8,
      cashPriority: 2,
      wageSensitivity: 3,
      sellForProfitAggression: 7,
      shortContractPreference: 8,
      harmonyStrictness: 2,
    },
  },
  {
    archetype: "culture_keeper",
    title: "Culture Keeper GM",
    nameRoot: "Culture Keeper",
    descriptionRoot: "Schuetzt Teamchemie, Zufriedenheit und langfristige Bindung staerker als reine Tabellenarithmetik.",
    pow: 2,
    spe: 3,
    men: 5,
    soc: 10,
    ambition: 5,
    finances: 6,
    boardConfidence: 8,
    harmony: 10,
    manners: 9,
    popularity: 7,
    cooperation: 10,
    playerOptDelta: 1,
    preferredTraits: ["Eloquent", "Loyal", "Motivated"],
    facilityPriorities: ["recovery_center", "academy", "contract_office"],
    marketDoctrine: "Meidet toxische Fits und bindet funktionierende Kerne.",
    lineupDoctrine: "Erfuellt Forderungen, rotiert fair und vermeidet unnoetige Konflikte.",
    bias: {
      loyaltyBias: 10,
      harmonyStrictness: 10,
      longContractPreference: 8,
      sellForProfitAggression: 2,
      riskTolerance: 3,
      rosterDepthPreference: 7,
      valuePriority: 6,
    },
  },
  {
    archetype: "rivalry_hawk",
    title: "Rivalry Hawk GM",
    nameRoot: "Rivalry Hawk",
    descriptionRoot: "Plant gegen Feindbilder, contestet Schwerpunktbereiche und priorisiert Statement-Siege.",
    pow: 7,
    spe: 5,
    men: 6,
    soc: 2,
    ambition: 8,
    finances: 4,
    boardConfidence: 5,
    harmony: 4,
    manners: 3,
    popularity: 8,
    cooperation: 4,
    playerOptDelta: 0,
    preferredTraits: ["Feisty", "FiredUp", "Fearless"],
    facilityPriorities: ["arena_ops", "performance_lab", "scouting_room"],
    marketDoctrine: "Kauft gezielt gegen Rivalen und direkte Ranking-Luecken.",
    lineupDoctrine: "Contestet Rivalenfenster, auch wenn Value-Picks knapper wirken.",
    bias: {
      starPriority: 7,
      riskTolerance: 8,
      sellForProfitAggression: 6,
      cashPriority: 4,
      rosterDepthPreference: 5,
      eliteSmallRosterPreference: 7,
      harmonyStrictness: 4,
    },
  },
  {
    archetype: "systems_tinkerer",
    title: "Systems Tinkerer GM",
    nameRoot: "Systems Tinkerer",
    descriptionRoot: "Mischt Daten, Rollen, Slot-Fit und Value. Sucht keine perfekte Wahrheit, sondern spielbare Vorteile.",
    pow: 5,
    spe: 5,
    men: 7,
    soc: 3,
    ambition: 7,
    finances: 7,
    boardConfidence: 6,
    harmony: 6,
    manners: 6,
    popularity: 5,
    cooperation: 7,
    playerOptDelta: 0,
    preferredTraits: ["Diligent", "Flexible", "Eloquent"],
    facilityPriorities: ["academy", "scouting_room", "performance_lab"],
    marketDoctrine: "Balanced, aber nicht langweilig: klare Edges werden aktiv genutzt.",
    lineupDoctrine: "Slot-Fit, Forderungen und Powers werden zusammen optimiert.",
    bias: {
      cashPriority: 7,
      valuePriority: 8,
      starPriority: 6,
      riskTolerance: 6,
      wageSensitivity: 7,
      sellForProfitAggression: 6,
      rosterDepthPreference: 6,
      eliteSmallRosterPreference: 5,
    },
  },
];

const variantNames = [
  "Ada Vale",
  "Noah Crest",
  "Mara Voss",
  "Ivo Kade",
  "Nia Solen",
  "Bren Vale",
  "Tessa Rune",
  "Jaro Finch",
  "Kira Morrow",
  "Oren Slate",
] as const;

type GmVariantTilt = {
  label: string;
  pow: number;
  spe: number;
  men: number;
  soc: number;
  ambition: number;
  finances: number;
  boardConfidence: number;
  bias: Partial<Record<keyof TeamStrategyBias, number>>;
};

const variantTilt: readonly GmVariantTilt[] = [
  { label: "Prime", pow: 0, spe: 0, men: 0, soc: 0, ambition: 0, finances: 0, boardConfidence: 0, bias: {} },
  {
    label: "Wild",
    pow: 1,
    spe: 1,
    men: -1,
    soc: -1,
    ambition: 1,
    finances: -1,
    boardConfidence: -1,
    bias: { riskTolerance: 2, starPriority: 1, sellForProfitAggression: 1, shortContractPreference: 1, cashPriority: -1, wageSensitivity: -1, harmonyStrictness: -1 },
  },
  {
    label: "Patient",
    pow: -1,
    spe: 0,
    men: 1,
    soc: 1,
    ambition: -1,
    finances: 1,
    boardConfidence: 1,
    bias: { cashPriority: 1, wageSensitivity: 1, longContractPreference: 1, loyaltyBias: 1, harmonyStrictness: 1, riskTolerance: -1, sellForProfitAggression: -1 },
  },
  {
    label: "Clinical",
    pow: 0,
    spe: -1,
    men: 2,
    soc: -1,
    ambition: 0,
    finances: 1,
    boardConfidence: 1,
    bias: { valuePriority: 1, wageSensitivity: 1, eliteSmallRosterPreference: 1, harmonyStrictness: 1, riskTolerance: -1, rosterDepthPreference: -1 },
  },
  {
    label: "Popular",
    pow: -1,
    spe: 0,
    men: -1,
    soc: 2,
    ambition: 0,
    finances: 0,
    boardConfidence: 0,
    bias: { loyaltyBias: 1, harmonyStrictness: 1, starPriority: 1, longContractPreference: 1, cashPriority: -1, wageSensitivity: -1 },
  },
  {
    label: "Hardline",
    pow: 2,
    spe: 0,
    men: 0,
    soc: -2,
    ambition: 1,
    finances: 0,
    boardConfidence: -1,
    bias: { starPriority: 1, sellForProfitAggression: 2, riskTolerance: 1, cashPriority: 1, harmonyStrictness: -2, loyaltyBias: -1, rosterDepthPreference: -1 },
  },
  {
    label: "Agile",
    pow: -1,
    spe: 2,
    men: 0,
    soc: -1,
    ambition: 0,
    finances: 0,
    boardConfidence: 0,
    bias: { shortContractPreference: 1, riskTolerance: 1, rosterDepthPreference: 1, sellForProfitAggression: 1, longContractPreference: -1 },
  },
  {
    label: "Builder",
    pow: 0,
    spe: -1,
    men: 1,
    soc: 0,
    ambition: 0,
    finances: 1,
    boardConfidence: 1,
    bias: { valuePriority: 1, cashPriority: 1, rosterDepthPreference: 1, longContractPreference: 1, harmonyStrictness: 1, starPriority: -1 },
  },
  {
    label: "Showcase",
    pow: 0,
    spe: 1,
    men: -1,
    soc: 1,
    ambition: 1,
    finances: -1,
    boardConfidence: 0,
    bias: { starPriority: 2, riskTolerance: 1, sellForProfitAggression: 1, loyaltyBias: 1, cashPriority: -1, wageSensitivity: -1 },
  },
  {
    label: "Lean",
    pow: 0,
    spe: 0,
    men: 1,
    soc: -1,
    ambition: -1,
    finances: 2,
    boardConfidence: 1,
    bias: { cashPriority: 2, wageSensitivity: 2, valuePriority: 1, shortContractPreference: 1, rosterDepthPreference: -1, longContractPreference: -1 },
  },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number(value.toFixed(2))));
}

function clampManagement(value: number) {
  return clamp(value, 1, 10);
}

function clampAxis(value: number) {
  return clamp(value, 0, 20);
}

function clampPlayerOpt(value: number) {
  return Math.max(8, Math.min(14, Math.round(value)));
}

function clampBiasValue(value: number) {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function resolveGmInfluencePct(identity: TeamIdentity | null | undefined, isReplacement: boolean) {
  const boardConfidence = identity?.boardConfidence ?? 5;
  const base = Math.max(20, Math.min(50, Math.round(20 + boardConfidence * 3)));
  return isReplacement ? Math.min(50, base + 3) : base;
}

function blend(base: number, target: number, influencePct = GM_INFLUENCE_PCT) {
  const weight = influencePct / 100;
  return clamp(base * (1 - weight) + target * weight, 0, 20);
}

function blendManagement(base: number, target: number, influencePct = GM_INFLUENCE_PCT) {
  const weight = influencePct / 100;
  return clampManagement(base * (1 - weight) + target * weight);
}

function blendBias(base: number, target: number, influencePct = GM_INFLUENCE_PCT) {
  const weight = influencePct / 100;
  return Math.max(1, Math.min(10, Math.round(base * (1 - weight) + target * weight)));
}

export function getAxisSharePercentages(profile: Pick<TeamGeneralManagerProfile, "pow" | "spe" | "men" | "soc">) {
  const axisSum = Math.max(1, profile.pow + profile.spe + profile.men + profile.soc);
  return {
    pow: Math.round((profile.pow / axisSum) * 100),
    spe: Math.round((profile.spe / axisSum) * 100),
    men: Math.round((profile.men / axisSum) * 100),
    soc: Math.round((profile.soc / axisSum) * 100),
  };
}

function buildProfile(seed: GmSeed, variantIndex: number): TeamGeneralManagerProfile {
  const tilt = variantTilt[variantIndex];
  const name =
    seed.archetype === "systems_tinkerer" && variantIndex === 0
      ? "Chris Falk"
      : seed.archetype === "risk_gambler" && variantIndex === 1
        ? "Frankie"
        : `${variantNames[variantIndex]} ${seed.nameRoot}`;
  const gmId = `gm-${slug(seed.archetype)}-${String(variantIndex + 1).padStart(2, "0")}`;
  return {
    ...seed,
    gmId,
    name,
    title: variantIndex === 0 ? seed.title : `${tilt.label} ${seed.title}`,
    description: `${seed.descriptionRoot} Profil: ${tilt.label}.`,
    pow: clampAxis(seed.pow + tilt.pow),
    spe: clampAxis(seed.spe + tilt.spe),
    men: clampAxis(seed.men + tilt.men),
    soc: clampAxis(seed.soc + tilt.soc),
    ambition: clampManagement(seed.ambition + tilt.ambition),
    finances: clampManagement(seed.finances + tilt.finances),
    boardConfidence: clampManagement(seed.boardConfidence + tilt.boardConfidence),
    harmony: clampManagement(seed.harmony + (tilt.soc > 0 ? 0.5 : 0)),
    manners: clampManagement(seed.manners + (tilt.men > 0 ? 0.5 : 0)),
    popularity: clampManagement(seed.popularity + (tilt.soc > 0 ? 0.5 : 0)),
    cooperation: clampManagement(seed.cooperation + (tilt.men > 0 ? 0.5 : 0)),
    bias: Object.fromEntries(
      Object.entries(seed.bias).map(([key, value]) => [
        key,
        typeof value === "number"
          ? clampBiasValue(value + (tilt.bias[key as keyof TeamStrategyBias] ?? 0))
          : value,
      ]),
    ) as Partial<TeamStrategyBias>,
  };
}

export const TEAM_GENERAL_MANAGER_PROFILES: TeamGeneralManagerProfile[] = archetypeSeeds.flatMap((seed) =>
  variantTilt.map((_, variantIndex) => buildProfile(seed, variantIndex)),
);

const profileById = new Map(TEAM_GENERAL_MANAGER_PROFILES.map((profile) => [profile.gmId, profile] as const));

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function chooseProfileForTeam(team: Team, seasonId: string, index: number) {
  if (team.humanControlled && index === 0) {
    return profileById.get("gm-systems-tinkerer-01") ?? TEAM_GENERAL_MANAGER_PROFILES[0];
  }
  if (team.humanControlled && index === 1) {
    return profileById.get("gm-risk-gambler-02") ?? TEAM_GENERAL_MANAGER_PROFILES[1];
  }
  const profileIndex = hashString(`${seasonId}:${team.teamId}:${team.shortCode}`) % TEAM_GENERAL_MANAGER_PROFILES.length;
  return TEAM_GENERAL_MANAGER_PROFILES[profileIndex];
}

function getArchetypeDiversityMalus(
  archetype: TeamGeneralManagerArchetype,
  assignedArchetypeCounts?: Map<TeamGeneralManagerArchetype, number> | null,
) {
  const count = assignedArchetypeCounts?.get(archetype) ?? 0;
  if (count < GM_ARCHETYPE_DIVERSITY_THRESHOLD) {
    return 0;
  }
  const overflow = count - GM_ARCHETYPE_DIVERSITY_THRESHOLD + 1;
  return Math.min(
    GM_ARCHETYPE_DIVERSITY_MAX_MALUS,
    GM_ARCHETYPE_DIVERSITY_BASE_MALUS + (overflow - 1) * GM_ARCHETYPE_DIVERSITY_STEP_MALUS,
  );
}

function scoreGeneralManagerFit(
  team: Team,
  identity: TeamIdentity | null,
  profile: TeamGeneralManagerProfile,
  seasonId: string,
  assignedArchetypeCounts?: Map<TeamGeneralManagerArchetype, number> | null,
) {
  const fallbackIdentity: TeamIdentity = identity ?? {
    teamId: team.teamId,
    pow: 5,
    spe: 5,
    men: 5,
    soc: 5,
    ambition: 5,
    finances: 5,
    boardConfidence: 5,
    harmony: 5,
    manners: 5,
    popularity: 5,
    cooperation: 5,
    playerMin: team.rosterMinTarget ?? 10,
    playerOpt: team.rosterOptTarget ?? team.rosterLimit ?? 12,
  };
  const axisFit =
    80 -
    Math.abs(fallbackIdentity.pow - profile.pow) -
    Math.abs(fallbackIdentity.spe - profile.spe) -
    Math.abs(fallbackIdentity.men - profile.men) -
    Math.abs(fallbackIdentity.soc - profile.soc);
  const managementFit =
    70 -
    Math.abs(fallbackIdentity.ambition - profile.ambition) * 2 -
    Math.abs(fallbackIdentity.finances - profile.finances) * 2 -
    Math.abs(fallbackIdentity.boardConfidence - profile.boardConfidence) * 1.5 -
    Math.abs(fallbackIdentity.harmony - profile.harmony) * 1.5 -
    Math.abs(fallbackIdentity.cooperation - profile.cooperation);
  const desiredRoster = fallbackIdentity.playerOpt;
  const rosterFit =
    desiredRoster >= 13 && profile.playerOptDelta > 0
      ? 8
      : desiredRoster <= 10 && profile.playerOptDelta < 0
        ? 8
        : Math.abs(profile.playerOptDelta) <= 1
          ? 3
          : 0;
  const financeBonus =
    fallbackIdentity.finances >= 8 && ["bargain_hunter", "facility_architect"].includes(profile.archetype)
      ? 10
      : fallbackIdentity.finances <= 4 && ["star_chaser", "risk_gambler"].includes(profile.archetype)
        ? 5
        : 0;
  const ambitionBonus =
    fallbackIdentity.ambition >= 8 && ["star_chaser", "risk_gambler", "rivalry_hawk"].includes(profile.archetype)
      ? 8
      : fallbackIdentity.ambition <= 4 && ["talent_builder", "facility_architect", "culture_keeper"].includes(profile.archetype)
        ? 5
        : 0;
  const harmonyBonus =
    fallbackIdentity.harmony >= 8 && ["culture_keeper", "talent_builder", "depth_spammer"].includes(profile.archetype)
      ? 8
      : fallbackIdentity.harmony <= 4 && ["risk_gambler", "star_chaser", "rivalry_hawk"].includes(profile.archetype)
        ? 5
        : 0;
  const teamSeedTieBreaker = (hashString(`${seasonId}:${team.teamId}:${profile.gmId}`) % 1000) / 1000;
  const diversityMalus = getArchetypeDiversityMalus(profile.archetype, assignedArchetypeCounts);

  return (
    axisFit * 3 +
    managementFit * 2 +
    rosterFit +
    financeBonus +
    ambitionBonus +
    harmonyBonus +
    teamSeedTieBreaker -
    diversityMalus
  );
}

type PickedGeneralManager = {
  profile: TeamGeneralManagerProfile;
  source: TeamGeneralManagerAssignment["source"];
};

function getBoardReplacementReason(board: TeamBoardConfidenceRecord | null | undefined): TeamGeneralManagerAssignment["dismissalReason"] {
  if (!board) return null;
  const confidence = Number(board.value ?? 5);
  const pressure = Number(board.pressure ?? 0);
  if (confidence >= 6.5 && pressure <= 4) return null;
  if (confidence <= GM_BOARD_REPLACEMENT_CONFIDENCE_THRESHOLD - 0.5) return "low_board_confidence";
  if (pressure >= GM_BOARD_REPLACEMENT_PRESSURE_THRESHOLD + 0.5) return "high_board_pressure";
  if (confidence <= GM_BOARD_REPLACEMENT_CONFIDENCE_THRESHOLD && pressure >= GM_BOARD_REPLACEMENT_PRESSURE_THRESHOLD - 0.5) {
    return pressure >= GM_BOARD_REPLACEMENT_PRESSURE_THRESHOLD ? "high_board_pressure" : "low_board_confidence";
  }
  return null;
}

// Returns a probability (0–1) that the board will replace the GM this season rollover.
// Hard floor: confidence <= 2.0 or pressure >= 9.5 → always fires (p=1).
// Safe zone: confidence >= 6.5 and pressure <= 4 → never fires (p=0).
// Between those zones: gradual curve modified by team identity traits.
export function getBoardReplacementProbability(
  board: TeamBoardConfidenceRecord | null | undefined,
  identity: TeamIdentity | null | undefined,
): number {
  if (!board) return 0;
  const confidence = Number(board.value ?? 5);
  const pressure = Number(board.pressure ?? 0);

  // Always safe
  if (confidence >= 6.5 && pressure <= 4) return 0;
  // Hard floor — always fire
  if (confidence <= 2.0 || pressure >= 9.5) return 1.0;

  // Gradual curves for the zone between safe and hard floor
  const confidenceProb = confidence <= 4.5 ? Math.max(0, Math.min(0.9, (4.5 - confidence) / 2.5)) : 0;
  const pressureProb = pressure >= 7.0 ? Math.max(0, Math.min(0.9, (pressure - 7.0) / 2.5)) : 0;
  let prob = Math.max(confidenceProb, pressureProb);

  // Identity modifiers — team personality shapes board patience
  const ambition = identity?.ambition ?? 5;
  const harmony = identity?.harmony ?? 5;
  const boardSeed = identity?.boardConfidence ?? 5;

  if (ambition >= 8) prob += 0.15;       // impatient board, fires sooner
  else if (ambition <= 3) prob -= 0.10;  // gives trainer more time
  if (harmony >= 8) prob -= 0.15;        // loyal culture, waits longer
  else if (harmony <= 3) prob += 0.10;   // volatile board
  if (boardSeed <= 4) prob += 0.10;      // structurally unstable board relationship

  return Math.max(0, Math.min(1, prob));
}

export function applyTransferBalanceRiskToReplacementProbability(
  baseProbability: number,
  input: { sellCount: number; buyCount: number; netTransferCash: number; isHotSeat: boolean },
) {
  const atRisk =
    input.isHotSeat &&
    input.sellCount >= 2 &&
    input.buyCount === 0 &&
    input.netTransferCash > 0;

  if (!atRisk) {
    return baseProbability;
  }

  return Math.max(baseProbability, Math.min(1, baseProbability + 0.2));
}

function getTeamSeasonTransferStats(transferHistory: TransferHistoryEntry[] | null | undefined, seasonId: string, teamId: string) {
  const transfers = (transferHistory ?? []).filter((entry) => entry.seasonId === seasonId);
  const buys = transfers.filter((entry) => entry.transferType === "buy" && entry.toTeamId === teamId);
  const sells = transfers.filter((entry) => entry.transferType === "sell" && entry.fromTeamId === teamId);
  const buyFees = buys.reduce((sum, entry) => sum + (entry.fee ?? 0), 0);
  const sellProceeds = sells.reduce((sum, entry) => sum + (entry.fee ?? 0), 0);
  return {
    buyCount: buys.length,
    sellCount: sells.length,
    netTransferCash: sellProceeds - buyFees,
  };
}

function pickBestUnusedGeneralManager(input: {
  team: Team;
  teamIndex: number;
  seasonId: string;
  identity: TeamIdentity | null;
  usedGmIds: Set<string>;
  excludedArchetypes?: Iterable<TeamGeneralManagerArchetype>;
  assignedArchetypeCounts?: Map<TeamGeneralManagerArchetype, number> | null;
  seedSalt?: string | null;
}): PickedGeneralManager {
  if (input.team.humanControlled) {
    const preferred =
      input.teamIndex === 0
        ? profileById.get("gm-systems-tinkerer-01")
        : input.teamIndex === 1
          ? profileById.get("gm-risk-gambler-02")
          : null;
    if (preferred && !input.usedGmIds.has(preferred.gmId)) {
      return { profile: preferred, source: "human_slot" };
    }
  }

  const excludedArchetypeSet = new Set(input.excludedArchetypes ?? []);
  const availableProfiles = TEAM_GENERAL_MANAGER_PROFILES.filter((profile) => !input.usedGmIds.has(profile.gmId));
  const candidates =
    excludedArchetypeSet.size > 0
      ? availableProfiles.filter((profile) => !excludedArchetypeSet.has(profile.archetype))
      : availableProfiles;
  const candidatePool = candidates.length > 0 ? candidates : availableProfiles;
  const scoredCandidates = candidatePool
    .map((profile) => ({
      profile,
      score: scoreGeneralManagerFit(
        input.team,
        input.identity,
        profile,
        input.seasonId,
        input.assignedArchetypeCounts,
      ),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.profile.gmId.localeCompare(right.profile.gmId);
    });
  const best = scoredCandidates[0];
  if (!best) {
    return { profile: chooseProfileForTeam(input.team, input.seasonId, input.teamIndex), source: "auto_generated" };
  }

  // Seed-Salt (Audit-Varianz): wähle fit-nah aus dem Top-Band, damit verschiedene Läufe
  // unterschiedliche – aber weiterhin sinnvolle – GMs zuweisen.
  const seedSalt = input.seedSalt && input.seedSalt.trim().length > 0 ? input.seedSalt.trim() : null;
  if (seedSalt) {
    const variationPool = scoredCandidates
      .filter((candidate) => candidate.score >= best.score - GM_SEED_VARIATION_SCORE_GAP)
      .slice(0, GM_SEED_VARIATION_POOL_SIZE);
    if (variationPool.length > 0) {
      const chosen =
        variationPool[hashString(`${seedSalt}:${input.seasonId}:${input.team.teamId}:gm-seed-variation`) % variationPool.length];
      if (chosen) {
        return { profile: chosen.profile, source: "auto_generated" };
      }
    }
  }

  const wildcardRoll = hashString(`${input.seasonId}:${input.team.teamId}:${input.team.shortCode}:gm-wildcard-v8`) % 100;
  if (wildcardRoll < GM_WILDCARD_ASSIGNMENT_CHANCE_PCT) {
    const wildcardPool = scoredCandidates.filter(
      (candidate, index) =>
        index > 0 &&
        candidate.profile.archetype !== best.profile.archetype &&
        candidate.score >= best.score - GM_WILDCARD_MAX_SCORE_GAP,
    );
    const wildcard = wildcardPool[hashString(`${input.seasonId}:${input.team.teamId}:gm-wildcard-pick-v1`) % Math.max(wildcardPool.length, 1)];
    if (wildcard) {
      return { profile: wildcard.profile, source: "auto_wildcard" };
    }
  }

  return { profile: best.profile, source: "auto_generated" };
}

function stripGeneralManagerSourceNote(sourceNote: string | null | undefined) {
  const base = (sourceNote ?? "team_identity").replace(/\s*\+\s*gm:gm-[a-z0-9-]+/gi, "").trim();
  return base.length ? base : "team_identity";
}

export function getTeamGeneralManagerProfile(gmId: string | null | undefined) {
  return gmId ? profileById.get(gmId) ?? null : null;
}

export function buildTeamGeneralManagerAssignments(
  teams: Team[],
  seasonId: string,
  existing?: Record<string, TeamGeneralManagerAssignment> | null,
  teamIdentities?: TeamIdentity[] | null,
  boardConfidenceByTeamId?: Record<string, TeamBoardConfidenceRecord> | null,
  transferHistory?: TransferHistoryEntry[] | null,
  seedSalt?: string | null,
) {
  const effectiveSeedSalt =
    seedSalt && seedSalt.trim().length > 0 ? seedSalt.trim() : gmAssignmentSeedSalt;
  const identityByTeamId = new Map((teamIdentities ?? []).map((identity) => [identity.teamId, identity] as const));
  const usedGmIds = new Set<string>();
  const assignedArchetypeCounts = new Map<TeamGeneralManagerArchetype, number>();
  const assignments: Record<string, TeamGeneralManagerAssignment> = {};

  teams.forEach((team) => {
    const current = existing?.[team.teamId] ?? null;
    const currentProfile = getTeamGeneralManagerProfile(current?.gmId);
    const identity = identityByTeamId.get(team.teamId) ?? null;
    const shouldEvaluateReplacement = Boolean(current?.assignedSeasonId && current.assignedSeasonId !== seasonId);
    let boardReplacementProbability = shouldEvaluateReplacement
      ? getBoardReplacementProbability(boardConfidenceByTeamId?.[team.teamId], identity)
      : 0;
    if (transferHistory && shouldEvaluateReplacement) {
      const statsSeasonId = current?.assignedSeasonId ?? seasonId;
      const stats = getTeamSeasonTransferStats(transferHistory, statsSeasonId, team.teamId);
      boardReplacementProbability = applyTransferBalanceRiskToReplacementProbability(boardReplacementProbability, {
        ...stats,
        isHotSeat: boardReplacementProbability >= 0.55,
      });
    }
    const hotSeatRoll = (hashString(`${seasonId}:${team.teamId}:gm-hotseat-v2`) % 1000) / 1000;
    const isFired = boardReplacementProbability > 0 && hotSeatRoll < boardReplacementProbability && !team.humanControlled;
    if (!current || !currentProfile || usedGmIds.has(currentProfile.gmId)) {
      return;
    }
    if (isFired) {
      usedGmIds.add(currentProfile.gmId);
      return;
    }

    usedGmIds.add(currentProfile.gmId);
    assignedArchetypeCounts.set(
      currentProfile.archetype,
      (assignedArchetypeCounts.get(currentProfile.archetype) ?? 0) + 1,
    );
    assignments[team.teamId] = {
      teamId: team.teamId,
      gmId: currentProfile.gmId,
      assignedSeasonId: seasonId,
      influencePct: current.influencePct ?? resolveGmInfluencePct(identity, false),
      source: current.source ?? (team.humanControlled ? "human_slot" : "auto_generated"),
    };
  });

  teams.forEach((team, index) => {
    if (assignments[team.teamId]) {
      return;
    }

    const current = existing?.[team.teamId] ?? null;
    const currentProfile = getTeamGeneralManagerProfile(current?.gmId);
    const identity = identityByTeamId.get(team.teamId) ?? null;
    const shouldEvaluateReplacement = Boolean(current?.assignedSeasonId && current.assignedSeasonId !== seasonId);
    let boardReplacementProbability = shouldEvaluateReplacement
      ? getBoardReplacementProbability(boardConfidenceByTeamId?.[team.teamId], identity)
      : 0;
    if (transferHistory && shouldEvaluateReplacement) {
      const statsSeasonId = current?.assignedSeasonId ?? seasonId;
      const stats = getTeamSeasonTransferStats(transferHistory, statsSeasonId, team.teamId);
      boardReplacementProbability = applyTransferBalanceRiskToReplacementProbability(boardReplacementProbability, {
        ...stats,
        isHotSeat: boardReplacementProbability >= 0.55,
      });
    }
    const hotSeatRoll = (hashString(`${seasonId}:${team.teamId}:gm-hotseat-v2`) % 1000) / 1000;
    const isFired = boardReplacementProbability > 0 && hotSeatRoll < boardReplacementProbability && !team.humanControlled;
    // Determine dismissal reason only if the team is actually being replaced
    const boardReplacementReason = isFired
      ? getBoardReplacementReason(boardConfidenceByTeamId?.[team.teamId])
      : null;
    const picked = pickBestUnusedGeneralManager({
      team,
      teamIndex: index,
      seasonId,
      identity,
      usedGmIds,
      excludedArchetypes:
        isFired && currentProfile ? [currentProfile.archetype] : undefined,
      assignedArchetypeCounts,
      seedSalt: effectiveSeedSalt,
    });
    const profile = picked.profile;
    usedGmIds.add(profile.gmId);
    assignedArchetypeCounts.set(profile.archetype, (assignedArchetypeCounts.get(profile.archetype) ?? 0) + 1);
    assignments[team.teamId] = {
      teamId: team.teamId,
      gmId: profile.gmId,
      assignedSeasonId: seasonId,
      influencePct: resolveGmInfluencePct(identity, isFired),
      source: isFired && currentProfile ? "board_replacement" : (existing?.[team.teamId]?.source ?? picked.source),
      previousGmId: isFired && currentProfile ? currentProfile.gmId : undefined,
      dismissalReason: boardReplacementReason ?? undefined,
    };
  });

  return assignments;
}

export function getTeamGeneralManager(gameState: GameState, teamId: string) {
  const assignment = gameState.seasonState.teamGeneralManagers?.[teamId] ?? null;
  const profile = getTeamGeneralManagerProfile(assignment?.gmId);
  return assignment && profile ? { assignment, profile } : null;
}

export function applyGeneralManagerIdentityEffect(
  identity: TeamIdentity,
  profile: TeamGeneralManagerProfile | null,
  influencePct = GM_INFLUENCE_PCT,
): TeamIdentity {
  if (!profile) {
    return identity;
  }
  if (identity.sourceNote?.includes(`gm:${profile.gmId}`)) {
    return identity;
  }

  const playerOpt = clampPlayerOpt(identity.playerOpt + profile.playerOptDelta);
  return {
    ...identity,
    pow: blend(identity.pow, profile.pow, influencePct),
    spe: blend(identity.spe, profile.spe, influencePct),
    men: blend(identity.men, profile.men, influencePct),
    soc: blend(identity.soc, profile.soc, influencePct),
    ambition: blendManagement(identity.ambition, profile.ambition, influencePct),
    finances: blendManagement(identity.finances, profile.finances, influencePct),
    boardConfidence: blendManagement(identity.boardConfidence, profile.boardConfidence, influencePct),
    harmony: blendManagement(identity.harmony, profile.harmony, influencePct),
    manners: blendManagement(identity.manners, profile.manners, influencePct),
    popularity: blendManagement(identity.popularity, profile.popularity, influencePct),
    cooperation: blendManagement(identity.cooperation, profile.cooperation, influencePct),
    playerOpt,
    playerMin: Math.min(identity.playerMin, playerOpt),
    sourceNote: `${stripGeneralManagerSourceNote(identity.sourceNote)} + gm:${profile.gmId}`,
  };
}

export function applyGeneralManagerStrategyProfileEffect(
  profile: TeamStrategyProfile,
  gmProfile: TeamGeneralManagerProfile | null,
  influencePct = GM_INFLUENCE_PCT,
): TeamStrategyProfile {
  if (!gmProfile || profile.strategyVersion?.includes("+gm-v2")) {
    return profile;
  }

  const gmAxisShares = getAxisSharePercentages(gmProfile);
  const bias: TeamStrategyBias = { ...profile.bias };
  for (const [key, value] of Object.entries(gmProfile.bias) as Array<[keyof TeamStrategyBias, number | undefined]>) {
    if (typeof value === "number" && Number.isFinite(value)) {
      bias[key] = blendBias(profile.bias[key], value, influencePct);
    }
  }

  return {
    ...profile,
    strategyVersion: `${(profile.strategyVersion ?? "v1-local").replace(/\+gm-v\d+/g, "")}+gm-v2`,
    strategySummary: `${profile.strategySummary} GM: ${gmProfile.title}.`,
    transferStyleNote: `${profile.transferStyleNote ?? profile.buyStyle} GM: ${gmProfile.marketDoctrine}`,
    lineupStyleNote: `${profile.lineupStyleNote ?? profile.rosterStyle} GM: ${gmProfile.lineupDoctrine}`,
    rosterOptTarget:
      profile.rosterOptTarget != null ? clampPlayerOpt(profile.rosterOptTarget + gmProfile.playerOptDelta) : profile.rosterOptTarget,
    powBias: profile.powBias != null ? Math.round(profile.powBias * (1 - influencePct / 100) + gmAxisShares.pow * (influencePct / 100)) : gmAxisShares.pow,
    speBias: profile.speBias != null ? Math.round(profile.speBias * (1 - influencePct / 100) + gmAxisShares.spe * (influencePct / 100)) : gmAxisShares.spe,
    menBias: profile.menBias != null ? Math.round(profile.menBias * (1 - influencePct / 100) + gmAxisShares.men * (influencePct / 100)) : gmAxisShares.men,
    socBias: profile.socBias != null ? Math.round(profile.socBias * (1 - influencePct / 100) + gmAxisShares.soc * (influencePct / 100)) : gmAxisShares.soc,
    preferredTraits: Array.from(new Set([...(profile.preferredTraits ?? []), ...gmProfile.preferredTraits])).slice(0, 8),
    notes: [profile.notes, `GM ${gmProfile.name}: ${gmProfile.description}`].filter(Boolean).join(" "),
    bias,
  };
}

export function resolveGmAssignmentSeedSalt(
  gameState: GameState,
  options?: { saveId?: string | null },
): string {
  if (options?.saveId && options.saveId.trim().length > 0) {
    return options.saveId.trim();
  }
  if (gameState.scenarioMeta?.sourceSaveId?.trim()) {
    return gameState.scenarioMeta.sourceSaveId.trim();
  }
  if (gmAssignmentSeedSalt) {
    return gmAssignmentSeedSalt;
  }
  if (gameState.scenarioMeta?.createdAt?.trim()) {
    return `${gameState.season.id}:${gameState.scenarioMeta.createdAt.trim()}`;
  }
  return gameState.season.id;
}

export function withNormalizedTeamGeneralManagers(
  gameState: GameState,
  options?: { saveId?: string | null },
): GameState {
  const assignments = buildTeamGeneralManagerAssignments(
    gameState.teams,
    gameState.season.id,
    gameState.seasonState.teamGeneralManagers,
    gameState.teamIdentities,
    gameState.seasonState.boardConfidence,
    gameState.transferHistory,
    resolveGmAssignmentSeedSalt(gameState, options),
  );

  return {
    ...gameState,
    teamIdentities: gameState.teamIdentities.map((identity) => {
      const assignment = assignments[identity.teamId] ?? null;
      const profile = getTeamGeneralManagerProfile(assignment?.gmId);
      return applyGeneralManagerIdentityEffect(identity, profile, assignment?.influencePct ?? GM_INFLUENCE_PCT);
    }),
    seasonState: {
      ...gameState.seasonState,
      teamGeneralManagers: assignments,
    },
  };
}
