import type {
  DisciplineCategory,
  GameState,
  LineupDraftModifiers,
  LineupDisciplineSide,
  Team,
  TeamIdentity,
  TeamPowerCategory,
  TeamPowerAttributeTag,
  TeamPowerConditionalTrigger,
  TeamPowerEffectType,
  TeamPowerRecord,
  TeamPowerTargetMode,
} from "@/lib/data/olyDataTypes";
import type { FacilityId } from "@/lib/facilities/facility-catalog";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { officialDisciplineWeightMatrix, type OfficialDisciplineWeightId } from "@/lib/player-generator/official-discipline-weights";

export type LegacyTeamPowerOption = {
  id: string;
  label: string;
  description: string;
  category: TeamPowerCategory;
  effectType: TeamPowerEffectType;
  targetMode: TeamPowerTargetMode;
  targetLimit: number;
  conditionalBonusPct: number;
  conditionalTrigger: TeamPowerConditionalTrigger | null;
  conditionalDescription: string | null;
  source: TeamPowerRecord["source"];
  sourceFacilityId: string | null;
  modifier: number;
  positiveAttributeTags: TeamPowerAttributeTag[];
  negativeAttributeTag: TeamPowerAttributeTag | null;
  chargesTotal: number;
  chargesUsed: number;
  chargesRemaining: number;
  selectedForSeason: boolean;
  isUsedUp: boolean;
  isPassive: boolean;
};

const TEAM_IDENTITY_CHARGES = [4, 3, 2] as const;
const TEAM_IDENTITY_BACKUP_CHARGES = [0, 0, 0] as const;
const FACILITY_POWER_CHARGES = 2;
// Per-matchday charge budget for a selected active power. Charges refresh every matchday (see
// buildTeamPowerUsageMap), and the lineup UI already limits selection to one power per discipline
// side, so 2 is enough to play a power on both sides in the same matchday without it reading as
// "used up". This replaces the old scarce season pool ([4,3,2] shared across ~20 matchdays).
const PER_MATCHDAY_ACTIVE_CHARGES = 2;

type AxisKey = "pow" | "spe" | "men" | "soc";

const AXIS_TO_CATEGORY: Record<AxisKey, Exclude<TeamPowerCategory, "flex">> = {
  pow: "power",
  spe: "speed",
  men: "mental",
  soc: "social",
};

const AXIS_LABELS: Record<AxisKey, string> = {
  pow: "Power",
  spe: "Speed",
  men: "Mental",
  soc: "Social",
};

const IDENTITY_POWER_LABELS: Record<AxisKey, string[]> = {
  pow: ["Power Surge", "Heavy Statement", "Red Zone Push", "Body Check", "Iron Tempo", "Last Rep"],
  spe: ["Tempo Surge", "Clean Lane", "Fast Break", "Split Second", "Overtake", "Final Burst"],
  men: ["Mind Game", "Read The Board", "Calculated Risk", "Cold Plan", "Pattern Lock", "Endgame Call"],
  soc: ["Crowd Command", "Rally Cry", "Spotlight Play", "Locker Spark", "Hype Wave", "Final Ovation"],
};

type TeamPowerArchetype = {
  effectType: TeamPowerEffectType;
  targetMode: TeamPowerTargetMode;
  targetLimit: number;
  labelPrefix: string;
  descriptionTone: string;
};

type TeamPowerOverride = Partial<Pick<
  TeamPowerRecord,
  | "label"
  | "description"
  | "category"
  | "effectType"
  | "targetMode"
  | "targetLimit"
  | "modifier"
  | "conditionalBonusPct"
  | "conditionalTrigger"
  | "conditionalDescription"
  | "positiveAttributeTags"
  | "negativeAttributeTag"
>>;

type TeamPowerDoctrine = "tactical" | "aggressive" | "supportive" | "balanced";

const TEAM_POWER_DOCTRINE_OVERRIDES: Record<string, TeamPowerDoctrine> = {
  "P-S": "aggressive",
  "U-A": "tactical",
  "S-C": "aggressive",
  "Z-H": "aggressive",
  "N-N": "aggressive",
  "T-C": "supportive",
  "R-C": "supportive",
};

const TEAM_POWER_SLOT_OVERRIDES: Record<string, Record<number, TeamPowerOverride>> = {
  "P-S": {
    0: {
      label: "Redline Protocol",
      description: "Project Suicide eskaliert, wenn ein Rivale in genau dieser Disziplin gefährlich ist.",
      category: "flex",
      effectType: "self_boost",
      targetMode: "self",
      targetLimit: 0,
      modifier: 6,
      conditionalBonusPct: 2,
      conditionalTrigger: "rival_top8_discipline",
      conditionalDescription: "+2%, wenn ein Rivale in dieser Disziplin Top 8 ist.",
      positiveAttributeTags: ["power", "torment"],
      negativeAttributeTag: "awareness",
    },
  },
  "T-G": {
    0: {
      label: "Formation Stabilized",
      description: "The Giants bleiben kompakt: weniger Chaos, mehr Health-/Power-Struktur.",
      category: "power",
      effectType: "support_boost",
      targetMode: "self",
      targetLimit: 0,
      modifier: 6,
      positiveAttributeTags: ["power", "health"],
      negativeAttributeTag: "speed",
    },
  },
};

const ATTRIBUTE_TAG_LABELS: Record<TeamPowerAttributeTag, string> = {
  power: "Power",
  health: "Health",
  determination: "Determination",
  stamina: "Stamina",
  speed: "Speed",
  dexterity: "Dexterity",
  awareness: "Awareness",
  intelligence: "Intelligence",
  will: "Will",
  charisma: "Charisma",
  spirit: "Spirit",
  torment: "Torment",
};

const AXIS_ATTRIBUTE_TAG_PACKS: Record<
  AxisKey,
  Array<{ positive: [TeamPowerAttributeTag, TeamPowerAttributeTag]; negative: TeamPowerAttributeTag }>
> = {
  pow: [
    { positive: ["power", "health"], negative: "speed" },
    { positive: ["power", "torment"], negative: "awareness" },
    { positive: ["health", "determination"], negative: "dexterity" },
    { positive: ["power", "determination"], negative: "intelligence" },
    { positive: ["health", "stamina"], negative: "charisma" },
    { positive: ["power", "will"], negative: "awareness" },
  ],
  spe: [
    { positive: ["speed", "dexterity"], negative: "health" },
    { positive: ["speed", "stamina"], negative: "torment" },
    { positive: ["dexterity", "awareness"], negative: "power" },
    { positive: ["speed", "awareness"], negative: "will" },
    { positive: ["stamina", "will"], negative: "torment" },
    { positive: ["dexterity", "intelligence"], negative: "health" },
  ],
  men: [
    { positive: ["intelligence", "awareness"], negative: "torment" },
    { positive: ["intelligence", "will"], negative: "power" },
    { positive: ["awareness", "determination"], negative: "speed" },
    { positive: ["will", "spirit"], negative: "health" },
    { positive: ["determination", "intelligence"], negative: "torment" },
    { positive: ["awareness", "spirit"], negative: "power" },
  ],
  soc: [
    { positive: ["charisma", "spirit"], negative: "torment" },
    { positive: ["charisma", "will"], negative: "stamina" },
    { positive: ["spirit", "determination"], negative: "power" },
    { positive: ["charisma", "awareness"], negative: "torment" },
    { positive: ["will", "spirit"], negative: "health" },
    { positive: ["charisma", "intelligence"], negative: "power" },
  ],
};

function buildTeamPowerArchetypesForDoctrine(doctrine: TeamPowerDoctrine): TeamPowerArchetype[] {
  if (doctrine === "tactical") {
    return [
      { effectType: "field_debuff", targetMode: "rank_band", targetLimit: 3, labelPrefix: "Planned", descriptionTone: "stört Teams im direkten Rank-Fenster" },
      { effectType: "self_boost", targetMode: "self", targetLimit: 0, labelPrefix: "Calculated", descriptionTone: "stärkt den eigenen Matchplan" },
      { effectType: "rivalry_debuff", targetMode: "single_rival", targetLimit: 1, labelPrefix: "Counter", descriptionTone: "setzt bevorzugt beim Rivalen an" },
      { effectType: "field_debuff", targetMode: "rank_band", targetLimit: 2, labelPrefix: "Pressure", descriptionTone: "drueckt die direkte Umgebung im Tableau" },
      { effectType: "support_boost", targetMode: "self", targetLimit: 0, labelPrefix: "Control", descriptionTone: "stabilisiert den eigenen Ablauf" },
      { effectType: "snipe_debuff", targetMode: "single_top", targetLimit: 1, labelPrefix: "Exploit", descriptionTone: "pickt den gefaehrlichsten sichtbaren Gegner" },
    ];
  }

  if (doctrine === "aggressive") {
    return [
      { effectType: "snipe_debuff", targetMode: "single_rival", targetLimit: 1, labelPrefix: "Warpath", descriptionTone: "geht hart auf einen Rivalen oder Top-Gegner" },
      { effectType: "self_boost", targetMode: "self", targetLimit: 0, labelPrefix: "Brutal", descriptionTone: "zwingt den eigenen Score nach oben" },
      { effectType: "snipe_debuff", targetMode: "single_top", targetLimit: 1, labelPrefix: "Crush", descriptionTone: "schlaegt auf den stärksten Gegner" },
      { effectType: "field_debuff", targetMode: "rank_band", targetLimit: 2, labelPrefix: "Shock", descriptionTone: "verursacht Kollateraldruck im direkten Umfeld" },
      { effectType: "self_boost", targetMode: "self", targetLimit: 0, labelPrefix: "Overrun", descriptionTone: "setzt auf rohe Eigenleistung" },
      { effectType: "rivalry_debuff", targetMode: "single_rival", targetLimit: 1, labelPrefix: "Vendetta", descriptionTone: "will einem Rivalen sichtbar wehtun" },
    ];
  }

  if (doctrine === "supportive") {
    return [
      { effectType: "support_boost", targetMode: "self", targetLimit: 0, labelPrefix: "Rally", descriptionTone: "hebt die eigene Teamstruktur" },
      { effectType: "self_boost", targetMode: "self", targetLimit: 0, labelPrefix: "Spotlight", descriptionTone: "verstärkt den eigenen Auftritt" },
      { effectType: "field_debuff", targetMode: "rank_band", targetLimit: 2, labelPrefix: "Distract", descriptionTone: "bringt Teams im Umfeld aus dem Rhythmus" },
      { effectType: "support_boost", targetMode: "self", targetLimit: 0, labelPrefix: "Harmony", descriptionTone: "federt Druck über Teamchemie ab" },
      { effectType: "rivalry_debuff", targetMode: "single_rival", targetLimit: 1, labelPrefix: "Needle", descriptionTone: "setzt einen Rivalen social unter Druck" },
      { effectType: "self_boost", targetMode: "self", targetLimit: 0, labelPrefix: "Encore", descriptionTone: "spielt den grossen Moment aus" },
    ];
  }

  return [
    { effectType: "self_boost", targetMode: "self", targetLimit: 0, labelPrefix: "Focused", descriptionTone: "stärkt den eigenen Kernplan" },
    { effectType: "field_debuff", targetMode: "rank_band", targetLimit: 2, labelPrefix: "Contest", descriptionTone: "stört direkte Score-Nachbarn" },
    { effectType: "support_boost", targetMode: "self", targetLimit: 0, labelPrefix: "Stabilize", descriptionTone: "haelt den eigenen Spieltag stabil" },
    { effectType: "snipe_debuff", targetMode: "single_top", targetLimit: 1, labelPrefix: "Check", descriptionTone: "nimmt einen Top-Gegner ins Visier" },
    { effectType: "self_boost", targetMode: "self", targetLimit: 0, labelPrefix: "Lean In", descriptionTone: "erhöht den eigenen Einsatz" },
    { effectType: "rivalry_debuff", targetMode: "single_rival", targetLimit: 1, labelPrefix: "Answer", descriptionTone: "antwortet auf Rivalitaetsdruck" },
  ];
}

function resolveTeamPowerArchetypes(teamId: string, identity: TeamIdentity | null): TeamPowerArchetype[] {
  const override = TEAM_POWER_DOCTRINE_OVERRIDES[teamId];
  if (override) {
    return buildTeamPowerArchetypesForDoctrine(override);
  }

  const ambition = identity?.ambition ?? 0;
  const cooperation = identity?.cooperation ?? 0;
  const harmony = identity?.harmony ?? 0;
  const manners = identity?.manners ?? 0;
  const popularity = identity?.popularity ?? 0;
  const mentalLean = identity ? identity.men >= Math.max(identity.pow, identity.spe, identity.soc) : false;
  const powerLean = identity ? identity.pow >= Math.max(identity.spe, identity.men, identity.soc) : false;
  const socialLean = identity ? identity.soc >= Math.max(identity.pow, identity.spe, identity.men) : false;
  const ruthless = ambition >= 14 || manners <= -6 || harmony <= -6;
  const tactical = mentalLean || (ambition >= 8 && cooperation >= 4);
  const supportive = socialLean || cooperation >= 8 || popularity >= 10;
  const aggressive = powerLean || ruthless;

  if (tactical) {
    return buildTeamPowerArchetypesForDoctrine("tactical");
  }

  if (aggressive) {
    return buildTeamPowerArchetypesForDoctrine("aggressive");
  }

  if (supportive) {
    return buildTeamPowerArchetypesForDoctrine("supportive");
  }

  return buildTeamPowerArchetypesForDoctrine("balanced");
}

const FACILITY_POWER_DEFINITIONS: Record<
  string,
  Array<{
    threshold: 2 | 4;
    label: string;
    description: string;
    category: TeamPowerCategory;
    effectType?: TeamPowerEffectType;
    targetMode?: TeamPowerTargetMode;
    targetLimit?: number;
    modifier: number;
  }>
> = {
  training_center: [
    { threshold: 2, label: "Prepared Drill", description: "Trainingszentrum: ein sauber vorbereiteter Matchday-Boost.", category: "flex", effectType: "self_boost", targetMode: "self", targetLimit: 0, modifier: 4 },
    { threshold: 4, label: "Peak Cycle", description: "Trainingszentrum: harte Vorbereitung für den wichtigen Spieltag.", category: "flex", effectType: "self_boost", targetMode: "self", targetLimit: 0, modifier: 6 },
  ],
  recovery_center: [
    { threshold: 2, label: "Fresh Legs", description: "Recovery Center: stabilisiert den Spieltag trotz Belastung.", category: "flex", effectType: "support_boost", targetMode: "self", targetLimit: 0, modifier: 3 },
    { threshold: 4, label: "Second Wind", description: "Recovery Center: gibt Reserven für eine späte Leistungswelle.", category: "flex", effectType: "support_boost", targetMode: "self", targetLimit: 0, modifier: 5 },
  ],
  scouting_office: [
    { threshold: 2, label: "Scouted Angle", description: "Scouting Office: ein kleiner Vorteil aus besserer Vorbereitung.", category: "flex", effectType: "field_debuff", targetMode: "rank_band", targetLimit: 2, modifier: 4 },
    { threshold: 4, label: "Exploit Matchup", description: "Scouting Office: klares Ausnutzen einer erkannten Lücke.", category: "flex", effectType: "field_debuff", targetMode: "rank_band", targetLimit: 3, modifier: 6 },
  ],
  analytics_room: [
    { threshold: 2, label: "Forecast Edge", description: "Analytics Room: bessere Prognosen werden in Punkte übersetzt.", category: "mental", effectType: "self_boost", targetMode: "self", targetLimit: 0, modifier: 4 },
    { threshold: 4, label: "Perfect Read", description: "Analytics Room: der Matchplan sitzt genau im richtigen Fenster.", category: "mental", effectType: "field_debuff", targetMode: "rank_band", targetLimit: 3, modifier: 6 },
  ],
  fan_shop: [
    { threshold: 2, label: "Merch Momentum", description: "Fan Shop: Popularitaet erzeugt einen kleinen Social-Schub.", category: "social", effectType: "support_boost", targetMode: "self", targetLimit: 0, modifier: 3 },
    { threshold: 4, label: "Fan Wave", description: "Fan Shop: die Fanbasis traegt einen Spieltag sichtbar mit.", category: "social", effectType: "support_boost", targetMode: "self", targetLimit: 0, modifier: 5 },
  ],
  arena_upgrade: [
    { threshold: 2, label: "Arena Noise", description: "Arena Upgrade: die Kulisse drueckt das Team nach vorne.", category: "social", effectType: "support_boost", targetMode: "self", targetLimit: 0, modifier: 4 },
    { threshold: 4, label: "Home Roar", description: "Arena Upgrade: grosser Arena-Moment für den Spieltag.", category: "social", effectType: "support_boost", targetMode: "self", targetLimit: 0, modifier: 6 },
  ],
  academy: [
    { threshold: 2, label: "Academy Pattern", description: "Academy: strukturierter Nachwuchs- und Technikvorteil.", category: "mental", effectType: "self_boost", targetMode: "self", targetLimit: 0, modifier: 3 },
    { threshold: 4, label: "Academy Call-Up", description: "Academy: die Entwicklungsschiene zahlt direkt ein.", category: "flex", effectType: "support_boost", targetMode: "self", targetLimit: 0, modifier: 5 },
  ],
  specialist_wing: [
    { threshold: 2, label: "Specialist Package", description: "Specialist Wing: ein fokussierter Spezialisten-Impuls.", category: "flex", effectType: "self_boost", targetMode: "self", targetLimit: 0, modifier: 4 },
    { threshold: 4, label: "Specialist Breakthrough", description: "Specialist Wing: der Spezialbereich liefert einen starken Matchday-Call.", category: "flex", effectType: "self_boost", targetMode: "self", targetLimit: 0, modifier: 6 },
  ],
};

const FACILITY_POWER_IDS = Object.keys(FACILITY_POWER_DEFINITIONS) as FacilityId[];

function normalizeCategory(category: DisciplineCategory | string | null | undefined): TeamPowerCategory {
  if (category === "power" || category === "speed" || category === "mental" || category === "social") {
    return category;
  }
  return "flex";
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function resolveAttributeTagPack(axis: AxisKey, seed: string, index: number) {
  const packs = AXIS_ATTRIBUTE_TAG_PACKS[axis] ?? AXIS_ATTRIBUTE_TAG_PACKS.pow;
  return packs[(hashString(`${seed}:${index}`) + index) % packs.length] ?? packs[0];
}

function formatAttributeTags(positiveTags: TeamPowerAttributeTag[], negativeTag: TeamPowerAttributeTag | null | undefined) {
  const positiveLabel = positiveTags.map((tag) => ATTRIBUTE_TAG_LABELS[tag] ?? tag).join("/");
  return negativeTag ? `${positiveLabel}, Reibung: ${ATTRIBUTE_TAG_LABELS[negativeTag] ?? negativeTag}` : positiveLabel;
}

function getDisciplineWeight(disciplineId: string | null | undefined, attribute: TeamPowerAttributeTag) {
  if (!disciplineId) return 0;
  return officialDisciplineWeightMatrix[disciplineId as OfficialDisciplineWeightId]?.[attribute] ?? 0;
}

function calculateAttributeFitPct(input: {
  disciplineId?: string | null;
  positiveAttributeTags: TeamPowerAttributeTag[];
  negativeAttributeTag?: TeamPowerAttributeTag | null;
}) {
  if (!input.disciplineId || input.positiveAttributeTags.length === 0) return 0;
  const positiveWeights = input.positiveAttributeTags.map((tag) => getDisciplineWeight(input.disciplineId, tag));
  const positiveAverage = positiveWeights.reduce((sum, weight) => sum + weight, 0) / input.positiveAttributeTags.length;
  const negativeWeight = input.negativeAttributeTag ? getDisciplineWeight(input.disciplineId, input.negativeAttributeTag) : 0;
  const fitScore = positiveAverage - negativeWeight * 0.35;

  if (fitScore >= 18) return 2;
  if (fitScore >= 12) return 1.2;
  if (fitScore >= 7) return 0.6;
  if (positiveAverage <= 1 && negativeWeight >= 10) return -0.8;
  if (positiveAverage <= 3) return -0.4;
  return 0;
}

function getTeamIdentity(gameState: GameState, teamId: string): TeamIdentity | null {
  return gameState.teamIdentities.find((identity) => identity.teamId === teamId) ?? null;
}

function getAxisRows(identity: TeamIdentity | null) {
  const rows = ([
    { axis: "pow", value: identity?.pow ?? 0 },
    { axis: "spe", value: identity?.spe ?? 0 },
    { axis: "men", value: identity?.men ?? 0 },
    { axis: "soc", value: identity?.soc ?? 0 },
  ] satisfies Array<{ axis: AxisKey; value: number }>).sort((left, right) => {
    if (right.value !== left.value) return right.value - left.value;
    return left.axis.localeCompare(right.axis);
  });

  return rows;
}

function buildTeamIdentityPowers(gameState: GameState, saveId: string, seasonId: string, team: Team): TeamPowerRecord[] {
  const identity = getTeamIdentity(gameState, team.teamId);
  const sortedAxes = getAxisRows(identity);
  const archetypes = resolveTeamPowerArchetypes(team.teamId, identity);
  const axisSequence = [
    sortedAxes[0]?.axis ?? "pow",
    sortedAxes[1]?.axis ?? "spe",
    sortedAxes[0]?.axis ?? "pow",
    sortedAxes[2]?.axis ?? "men",
    sortedAxes[1]?.axis ?? "spe",
    sortedAxes[3]?.axis ?? "soc",
  ];
  const createdAt = `${seasonId}:${team.teamId}:team-powers`;

  return axisSequence.map((axis, index) => {
    const selectedForSeason = index < TEAM_IDENTITY_CHARGES.length;
    const chargesTotal = selectedForSeason
      ? PER_MATCHDAY_ACTIVE_CHARGES
      : TEAM_IDENTITY_BACKUP_CHARGES[index - TEAM_IDENTITY_CHARGES.length] ?? 0;
    const modifier = index === 0 ? 8 : index === 1 ? 6 : index === 2 ? 5 : 4;
    const archetype = archetypes[index] ?? archetypes[0];
    const baseLabel = IDENTITY_POWER_LABELS[axis][index] ?? `${AXIS_LABELS[axis]} Call`;
    const override = TEAM_POWER_SLOT_OVERRIDES[team.teamId]?.[index] ?? null;
    const attributePack = resolveAttributeTagPack(axis, `${seasonId}:${team.teamId}:${archetype.labelPrefix}`, index);
    const positiveAttributeTags = override?.positiveAttributeTags ?? [...attributePack.positive];
    const negativeAttributeTag = override?.negativeAttributeTag ?? attributePack.negative;
    const label = override?.label ?? `${archetype.labelPrefix} ${baseLabel}`;
    const description = override?.description ?? `${team.shortCode}: ${AXIS_LABELS[axis]}-basierte Team-Power; ${archetype.descriptionTone}.`;
    // Exactly one identity power (the team's strongest/first axis power) is always-on: no charge cost,
    // no manual selection needed, applies to both discipline sides every matchday. Keep it a small,
    // clean additive self_boost so it stacks safely with any manually selected power.
    const isPassive = index === 0;
    return {
      id: `teampower:${seasonId}:${team.teamId}:identity:${index + 1}`,
      saveId,
      seasonId,
      teamId: team.teamId,
      label: isPassive ? `Identität: ${label}` : label,
      description: isPassive
        ? `${description} Immer aktiv, kein Charge-Verbrauch.`
        : description,
      category: override?.category ?? AXIS_TO_CATEGORY[axis],
      effectType: isPassive ? "self_boost" : override?.effectType ?? archetype.effectType,
      targetMode: isPassive ? "self" : override?.targetMode ?? archetype.targetMode,
      targetLimit: isPassive ? 0 : override?.targetLimit ?? archetype.targetLimit,
      conditionalBonusPct: override?.conditionalBonusPct,
      conditionalTrigger: override?.conditionalTrigger,
      conditionalDescription: override?.conditionalDescription,
      source: "team_identity",
      sourceRank: index + 1,
      modifier: isPassive ? Math.min(override?.modifier ?? modifier, 3) : override?.modifier ?? modifier,
      positiveAttributeTags,
      negativeAttributeTag,
      chargesTotal,
      selectedForSeason: isPassive ? true : selectedForSeason,
      isPassive,
      createdAt,
    } satisfies TeamPowerRecord;
  });
}

function buildFacilityPowers(gameState: GameState, saveId: string, seasonId: string, team: Team): TeamPowerRecord[] {
  const facilities = getTeamFacilityState(gameState, team.teamId);
  const createdAt = `${seasonId}:${team.teamId}:facility-powers`;
  return FACILITY_POWER_IDS.flatMap((facilityId) => {
    const definitions = FACILITY_POWER_DEFINITIONS[facilityId] ?? [];
    const level = getFacilityLevel(facilities, facilityId);
    return definitions
      .filter((definition) => level >= definition.threshold)
      .map((definition) => ({
        id: `teampower:${seasonId}:${team.teamId}:facility:${facilityId}:${definition.threshold}`,
        saveId,
        seasonId,
        teamId: team.teamId,
        label: definition.label,
        description: definition.description,
        category: definition.category,
        effectType: definition.effectType ?? "self_boost",
        targetMode: definition.targetMode ?? "self",
        targetLimit: definition.targetLimit ?? 0,
        source: "facility" as const,
        sourceFacilityId: facilityId,
        modifier: definition.modifier,
        positiveAttributeTags:
          definition.category === "mental"
            ? ["intelligence", "awareness"]
            : definition.category === "social"
              ? ["charisma", "spirit"]
              : definition.category === "power"
                ? ["power", "health"]
                : definition.category === "speed"
                  ? ["speed", "dexterity"]
                  : ["determination", "will"],
        negativeAttributeTag:
          definition.effectType === "field_debuff" ? "charisma" : definition.category === "social" ? "torment" : "awareness",
        chargesTotal: FACILITY_POWER_CHARGES,
        selectedForSeason: true,
        createdAt,
      } satisfies TeamPowerRecord));
  });
}

export function buildGeneratedTeamPowersForTeam(
  gameState: GameState,
  saveId: string,
  seasonId: string,
  teamId: string,
): TeamPowerRecord[] {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  if (!team) {
    return [];
  }
  return [
    ...buildTeamIdentityPowers(gameState, saveId, seasonId, team),
    ...buildFacilityPowers(gameState, saveId, seasonId, team),
  ];
}

export function buildGeneratedTeamPowersForSeason(
  gameState: GameState,
  saveId: string,
  seasonId: string,
): TeamPowerRecord[] {
  return [...gameState.teams]
    .sort((left, right) => left.teamId.localeCompare(right.teamId))
    .flatMap((team) => buildGeneratedTeamPowersForTeam(gameState, saveId, seasonId, team.teamId));
}

export function ensureLocalTeamPowersForSeason(gameState: GameState, saveId: string, seasonId: string): GameState {
  const existing = gameState.seasonState.teamPowers ?? [];
  const generated = buildGeneratedTeamPowersForSeason(gameState, saveId, seasonId);
  const generatedIds = new Set(generated.map((power) => power.id));
  const existingCurrentSeason = existing.filter((power) => power.seasonId === seasonId);
  const existingById = new Map(existingCurrentSeason.map((power) => [power.id, power] as const));
  const mergedCurrentSeason = generated.map((power) => ({
    ...power,
    selectedForSeason: existingById.get(power.id)?.selectedForSeason ?? power.selectedForSeason,
  }));
  const unchanged = existing.filter((power) => power.seasonId !== seasonId || !generatedIds.has(power.id));

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      teamPowers: [...unchanged.filter((power) => power.seasonId !== seasonId), ...mergedCurrentSeason],
    },
  };
}

function getSelectedPowerIds(modifiers: LineupDraftModifiers | null | undefined) {
  return [modifiers?.d1?.teamPowerId, modifiers?.d2?.teamPowerId].filter((value): value is string => Boolean(value));
}

function buildTeamPowerUsageMap(
  gameState: GameState,
  seasonId: string,
  excludeLineupId?: string | null,
  matchdayId?: string | null,
) {
  const usage = new Map<string, string[]>();
  for (const draft of gameState.seasonState.lineupDrafts ?? []) {
    if (draft.seasonId !== seasonId || (excludeLineupId && draft.lineupId === excludeLineupId)) {
      continue;
    }
    // Charges refresh every matchday: only count power usage from drafts of the same matchday,
    // so a team's active powers are available again on the next matchday instead of draining a
    // shared season pool.
    if (matchdayId && draft.matchdayId !== matchdayId) {
      continue;
    }
    for (const powerId of getSelectedPowerIds(draft.modifiers)) {
      const existing = usage.get(powerId) ?? [];
      existing.push(draft.lineupId);
      usage.set(powerId, existing);
    }
  }
  return usage;
}

export function getTeamPowerOptions(input: {
  gameState: GameState;
  seasonId: string;
  teamId: string;
  lineupId?: string | null;
}): LegacyTeamPowerOption[] {
  const currentDraft = input.lineupId
    ? (input.gameState.seasonState.lineupDrafts ?? []).find((draft) => draft.lineupId === input.lineupId)
    : null;
  const activeMatchdayId = currentDraft?.matchdayId ?? input.gameState.matchdayState?.matchdayId ?? null;
  const usage = buildTeamPowerUsageMap(input.gameState, input.seasonId, input.lineupId ?? null, activeMatchdayId);
  const powers = (input.gameState.seasonState.teamPowers ?? []).filter(
    (power) => power.seasonId === input.seasonId && power.teamId === input.teamId && power.selectedForSeason,
  );
  return powers.map((power) => {
    const chargesUsed = usage.get(power.id)?.length ?? 0;
    const chargesRemaining = Math.max(power.chargesTotal - chargesUsed, 0);
    return {
      id: power.id,
      label: power.label,
      description: power.description,
      category: power.category,
      effectType: power.effectType ?? "self_boost",
      targetMode: power.targetMode ?? "self",
      targetLimit: power.targetLimit ?? 0,
      conditionalBonusPct: power.conditionalBonusPct ?? 0,
      conditionalTrigger: power.conditionalTrigger ?? null,
      conditionalDescription: power.conditionalDescription ?? null,
      source: power.source,
      sourceFacilityId: power.sourceFacilityId ?? null,
      modifier: power.modifier,
      positiveAttributeTags: power.positiveAttributeTags ?? [],
      negativeAttributeTag: power.negativeAttributeTag ?? null,
      chargesTotal: power.chargesTotal,
      chargesUsed,
      chargesRemaining,
      selectedForSeason: power.selectedForSeason,
      isUsedUp: chargesRemaining <= 0,
      isPassive: power.isPassive ?? false,
    };
  });
}

/**
 * Always-on team bonus: exactly one generated identity power per team is marked isPassive.
 * It needs no charge, is never consumed, and applies to both discipline sides every matchday.
 * Scales with the same category-fit multiplier used for manually selected powers and is capped
 * at +3 to keep it a small, additive baseline rather than a replacement for active power choices.
 */
export function calculatePassiveTeamPowerBonus(
  teamPowers: LegacyTeamPowerOption[],
  disciplineCategory: DisciplineCategory | string | null | undefined,
): number {
  const passivePower = teamPowers.find((power) => power.isPassive);
  if (!passivePower) {
    return 0;
  }
  const normalizedCategory = normalizeCategory(disciplineCategory);
  const categoryMultiplier =
    passivePower.category === "flex" || passivePower.category === normalizedCategory ? 1 : 0.6;
  const bonus = Number((passivePower.modifier * categoryMultiplier).toFixed(1));
  return Math.min(bonus, 3);
}

export function calculateTeamPowerModifierForSide(input: {
  modifiers: LineupDraftModifiers | undefined | null;
  disciplineSide: LineupDisciplineSide;
  disciplineId?: string | null;
  disciplineCategory?: DisciplineCategory | string | null;
  teamPowers: LegacyTeamPowerOption[];
  conditionalBonusPct?: number | null;
  teamCaptainPowerModifierPct?: number | null;
}): {
  teamPowerSelected: number;
  teamPowerModifier: number;
  teamPowerImpact: number;
  teamPowerBasePct: number;
  teamPowerConditionalPct: number;
  teamPowerAttributeFitPct: number;
  teamPowerLabel: string | null;
  warnings: string[];
} {
  const powerId = input.modifiers?.[input.disciplineSide]?.teamPowerId ?? null;
  const warnings: string[] = [];
  if (!powerId) {
    return { teamPowerSelected: 0, teamPowerModifier: 0, teamPowerImpact: 0, teamPowerBasePct: 0, teamPowerConditionalPct: 0, teamPowerAttributeFitPct: 0, teamPowerLabel: null, warnings };
  }

  const power = input.teamPowers.find((entry) => entry.id === powerId) ?? null;
  if (!power) {
    warnings.push(`Team-Power für ${input.disciplineSide.toUpperCase()} konnte nicht geladen werden.`);
    return { teamPowerSelected: 0, teamPowerModifier: 0, teamPowerImpact: 0, teamPowerBasePct: 0, teamPowerConditionalPct: 0, teamPowerAttributeFitPct: 0, teamPowerLabel: null, warnings };
  }
  if (power.isPassive) {
    // The passive identity power is always applied automatically (see calculatePassiveTeamPowerBonus);
    // treat an explicit selection of it as no active power so it is never counted twice.
    return { teamPowerSelected: 0, teamPowerModifier: 0, teamPowerImpact: 0, teamPowerBasePct: 0, teamPowerConditionalPct: 0, teamPowerAttributeFitPct: 0, teamPowerLabel: null, warnings };
  }
  if (power.isUsedUp) {
    warnings.push(`${power.label} hat keine Einsätze mehr frei.`);
    return { teamPowerSelected: 1, teamPowerModifier: 0, teamPowerImpact: 0, teamPowerBasePct: 0, teamPowerConditionalPct: 0, teamPowerAttributeFitPct: 0, teamPowerLabel: power.label, warnings };
  }

  const disciplineCategory = normalizeCategory(input.disciplineCategory);
  const categoryMultiplier = power.category === "flex" || power.category === disciplineCategory ? 1 : 0.6;
  const basePct = Number((power.modifier * categoryMultiplier).toFixed(1));
  const conditionalPct = Number(((input.conditionalBonusPct ?? 0) * categoryMultiplier).toFixed(1));
  const attributeFitPct = Number((calculateAttributeFitPct({
    disciplineId: input.disciplineId,
    positiveAttributeTags: power.positiveAttributeTags,
    negativeAttributeTag: power.negativeAttributeTag,
  }) * categoryMultiplier).toFixed(1));
  const captainPowerPct = Number((Math.max(0, Math.min(8, input.teamCaptainPowerModifierPct ?? 0)) * 0.25).toFixed(1));
  const effectiveImpact = Number((basePct + conditionalPct + attributeFitPct + captainPowerPct).toFixed(1));
  const isSelfEffect = power.effectType === "self_boost" || power.effectType === "support_boost";
  const teamPowerModifier = isSelfEffect ? effectiveImpact : 0;
  const effectLabel =
    power.effectType === "snipe_debuff"
      ? "Snipe"
      : power.effectType === "field_debuff"
        ? "Field"
        : power.effectType === "rivalry_debuff"
          ? "Rivalry"
          : "Boost";
  return {
    teamPowerSelected: 1,
    teamPowerModifier,
    teamPowerImpact: effectiveImpact,
    teamPowerBasePct: basePct,
    teamPowerConditionalPct: conditionalPct,
    teamPowerAttributeFitPct: attributeFitPct,
    teamPowerLabel: `${power.label}${isSelfEffect ? "" : ` (${effectLabel})`}${attributeFitPct ? ` (${attributeFitPct > 0 ? "+" : ""}${attributeFitPct}% ${formatAttributeTags(power.positiveAttributeTags, power.negativeAttributeTag)})` : ""}${captainPowerPct ? ` (+${captainPowerPct}% Captain)` : ""}${power.category === "flex" || power.category === disciplineCategory ? "" : " (Off-Fit)"}`,
    warnings,
  };
}
