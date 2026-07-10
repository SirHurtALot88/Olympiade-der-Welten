import type { GameState, Player, RosterEntry, PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import type { AiManagementTrainingFocus } from "@/lib/ai/ai-team-management-preview-service";
import {
  CLASS_PROGRESSION_WEIGHTS,
  PROGRESSION_CLASS_ORDER,
  type ProgressionClassName,
  normalizeProgressionClassName,
} from "@/lib/training/class-progression-config";
import { deriveAttributeAffinityProfile } from "@/lib/training/attribute-affinity-service";

export type AiPlayerTrainingClassPlan = {
  playerId: string;
  playerName: string;
  trainingClass: ProgressionClassName;
  reasons: string[];
};

const FOCUS_CLASS_POOLS: Record<AiManagementTrainingFocus, ProgressionClassName[]> = {
  POW: ["Berserker", "Warlord", "Tank", "Badass"],
  SPE: ["Sprinter", "Rogue", "Charger"],
  MEN: ["Mage", "Overseer", "Tactician"],
  SOC: ["Bard", "Hero", "Templar", "Warlord"],
  BALANCED: ["Hero", "Templar", "Tactician"],
  RECOVERY: ["Hero", "Templar", "Tank"],
};

const CLASS_AXIS_HINTS: Record<ProgressionClassName, AiManagementTrainingFocus[]> = {
  Berserker: ["POW"],
  Warlord: ["POW", "SOC"],
  Tank: ["POW", "RECOVERY"],
  Sprinter: ["SPE"],
  Rogue: ["SPE"],
  Charger: ["SPE"],
  Mage: ["MEN"],
  Overseer: ["MEN"],
  Templar: ["SOC", "RECOVERY"],
  Bard: ["SOC"],
  Hero: ["SOC", "BALANCED", "RECOVERY"],
  Badass: ["POW"],
  Tactician: ["MEN", "BALANCED"],
};

function buildRosterRankMap(gameState: GameState, teamId: string, rosterEntries: RosterEntry[]) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const ranked = rosterEntries
    .map((entry) => {
      const player = playersById.get(entry.playerId);
      if (!player) return null;
      const score =
        (player.ovr ?? player.rating ?? 0) +
        Object.values(player.disciplineRatings ?? {}).reduce((sum, value) => sum + value, 0) / 20;
      return { playerId: entry.playerId, score };
    })
    .filter((entry): entry is { playerId: string; score: number } => Boolean(entry))
    .sort((left, right) => right.score - left.score);
  return new Map(ranked.map((entry, index) => [entry.playerId, index + 1] as const));
}

function scoreClassForFocus(className: ProgressionClassName, focus: AiManagementTrainingFocus) {
  const hints = CLASS_AXIS_HINTS[className] ?? [];
  if (hints.includes(focus)) return 3;
  if (focus === "BALANCED" || focus === "RECOVERY") return hints.includes("RECOVERY") || hints.includes("BALANCED") ? 2 : 1;
  return 0;
}

function resolvePlayerAge(player: Player) {
  const age = (player as Player & { age?: number | null }).age;
  return typeof age === "number" && Number.isFinite(age) ? age : null;
}

function stableAffinityHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function scoreClassForSignatureAttributes(
  className: ProgressionClassName,
  signatureAttributes: PlayerGeneratorAttributeName[],
) {
  const weights = CLASS_PROGRESSION_WEIGHTS[className];
  return signatureAttributes.reduce((sum, attribute) => sum + Math.max(0, weights[attribute] ?? 0), 0);
}

function shouldLeanIntoSignatureProfile(player: Player) {
  return stableAffinityHash(`${player.id}:signature-training`) % 100 < 38;
}

function pickSignatureAlignedClass(input: {
  player: Player;
  focus: AiManagementTrainingFocus;
}): { trainingClass: ProgressionClassName; reasons: string[] } | null {
  if (!shouldLeanIntoSignatureProfile(input.player)) {
    return null;
  }
  const affinity = deriveAttributeAffinityProfile(input.player);
  const focusPool = FOCUS_CLASS_POOLS[input.focus];
  const ranked = PROGRESSION_CLASS_ORDER.map((className) => ({
    className,
    score:
      scoreClassForSignatureAttributes(className, affinity.signatureAttributes) +
      (focusPool.includes(className) ? 0.35 : 0) +
      (normalizeProgressionClassName(input.player.className) === className ? 0.25 : 0),
  }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
  const picked = ranked[0]?.className ?? null;
  if (!picked || scoreClassForSignatureAttributes(picked, affinity.signatureAttributes) <= 0) {
    return null;
  }
  return {
    trainingClass: picked,
    reasons: [
      `Signature-Fokus (${affinity.signatureAttributes.join(", ")}) → ${picked}`,
    ],
  };
}

function pickClassFromPool(input: {
  player: Player;
  focus: AiManagementTrainingFocus;
  rosterRank: number;
  gmPowBias: number;
  gmSpeBias: number;
  gmMenBias: number;
  gmSocBias: number;
}): { trainingClass: ProgressionClassName; reasons: string[] } {
  const natural = normalizeProgressionClassName(input.player.className);
  const reasons: string[] = [];
  const age = resolvePlayerAge(input.player);
  const isProspect = (age != null && age <= 22) || (input.player.potential ?? 0) >= 72;
  const isVeteran = age != null && age >= 30;
  const isStarter = input.rosterRank <= 4;

  const signatureAligned = pickSignatureAlignedClass({
    player: input.player,
    focus: input.focus,
  });
  if (signatureAligned) {
    return signatureAligned;
  }

  if (input.focus === "RECOVERY" || input.focus === "BALANCED") {
    if (natural && FOCUS_CLASS_POOLS[input.focus].includes(natural)) {
      reasons.push(`Recovery/Balanced → natürliche Klasse ${natural}`);
      return { trainingClass: natural, reasons };
    }
    const fallback = input.focus === "RECOVERY" ? "Hero" : "Tactician";
    reasons.push(`${input.focus} → ${fallback}`);
    return { trainingClass: fallback, reasons };
  }

  const pool = FOCUS_CLASS_POOLS[input.focus];
  const gmBoost =
    input.focus === "POW"
      ? input.gmPowBias
      : input.focus === "SPE"
        ? input.gmSpeBias
        : input.focus === "MEN"
          ? input.gmMenBias
          : input.gmSocBias;

  if (isStarter && natural && !isProspect) {
    const naturalFocusMatch = scoreClassForFocus(natural, input.focus) >= 2;
    if (naturalFocusMatch || gmBoost < 0.15) {
      reasons.push(`Starter behält ${natural}`);
      return { trainingClass: natural, reasons };
    }
    reasons.push(`Starter weicht zu Team-Fokus ${input.focus}`);
  }

  if (isVeteran && natural) {
    const veteranClass = natural === "Hero" || natural === "Tactician" ? natural : "Hero";
    reasons.push(`Veteran → ${veteranClass}`);
    return { trainingClass: veteranClass, reasons };
  }

  const ranked = pool
    .map((className) => ({
      className,
      score: scoreClassForFocus(className, input.focus) + (natural === className ? 2 : 0) + gmBoost,
    }))
    .sort((left, right) => right.score - left.score);
  const picked = ranked[0]?.className ?? pool[0] ?? "Hero";
  reasons.push(
    isProspect
      ? `Prospect entlang ${input.focus} → ${picked}`
      : `Team-Fokus ${input.focus}${gmBoost >= 0.15 ? " + GM-Bias" : ""} → ${picked}`,
  );
  return { trainingClass: picked, reasons };
}

export function buildTeamPlayerTrainingClassPlans(input: {
  gameState: GameState;
  teamId: string;
  trainingFocus: AiManagementTrainingFocus;
}): AiPlayerTrainingClassPlan[] {
  const rosterEntries = input.gameState.rosters.filter((entry) => entry.teamId === input.teamId);
  const playersById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
  const rosterRankByPlayerId = buildRosterRankMap(input.gameState, input.teamId, rosterEntries);
  const gm = getTeamGeneralManager(input.gameState, input.teamId);
  const gmPowBias = (gm?.profile.pow ?? 5) / 10;
  const gmSpeBias = (gm?.profile.spe ?? 5) / 10;
  const gmMenBias = (gm?.profile.men ?? 5) / 10;
  const gmSocBias = (gm?.profile.soc ?? 5) / 10;

  return rosterEntries
    .map((entry) => {
      const player = playersById.get(entry.playerId);
      if (!player) return null;
      const rosterRank = rosterRankByPlayerId.get(player.id) ?? rosterEntries.length;
      const resolved = pickClassFromPool({
        player,
        focus: input.trainingFocus,
        rosterRank,
        gmPowBias,
        gmSpeBias,
        gmMenBias,
        gmSocBias,
      });
      if (!PROGRESSION_CLASS_ORDER.includes(resolved.trainingClass)) {
        return null;
      }
      return {
        playerId: player.id,
        playerName: player.name,
        trainingClass: resolved.trainingClass,
        reasons: resolved.reasons,
      } satisfies AiPlayerTrainingClassPlan;
    })
    .filter((entry): entry is AiPlayerTrainingClassPlan => Boolean(entry));
}
