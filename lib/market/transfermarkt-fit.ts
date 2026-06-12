import { getTeamRaceFit, getTeamSubclassFitSum } from "@/lib/market/team-fit-matrix";

type TokenizedPlayer = {
  race: string | null | undefined;
  alignment: string | null | undefined;
  subclasses: string[];
  traitsPositive: string[];
  traitsNegative: string[];
};

export type TransfermarktFitBreakdown = {
  fitRace: number;
  fitSubclasses: number;
  fitTraits: number;
  fitAlignment: number;
  teamFit: number | null;
};

export const NEGATIVE_MERCENARY_FIT_MALUS = 1.5;
export const MERCENARY_NEGATIVE_FIT_PENALTY = -NEGATIVE_MERCENARY_FIT_MALUS;
export const MERCENARY_NEGATIVE_FIT_PENALTY_REASON = "negative_fit_mercenary_penalty";

export function normalizeTransfermarktToken(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return String(value)
    .replace(/[\s-]/g, "_")
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "")
    .replace(/__+/g, "_");
}

export function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
}

export function getTransfermarktBracket(marketValue: number | null | undefined) {
  const value = Number(marketValue) || 0;
  const bracketValue = value > 1000 ? value / 1000 : value;
  const starts = [0, 12.5, 17.5, 22.5, 30, 37.5, 45, 55, 70];

  if (bracketValue < starts[1]) return 1;
  if (bracketValue < starts[2]) return 2;
  if (bracketValue < starts[3]) return 3;
  if (bracketValue < starts[4]) return 4;
  if (bracketValue < starts[5]) return 5;
  if (bracketValue < starts[6]) return 6;
  if (bracketValue < starts[7]) return 7;
  if (bracketValue < starts[8]) return 8;
  return 9;
}

export function hasMercenaryTrait(input: Pick<TokenizedPlayer, "traitsPositive" | "traitsNegative">) {
  return [...input.traitsPositive, ...input.traitsNegative].some(
    (trait) => normalizeTransfermarktToken(trait) === "mercenary",
  );
}

export function isNegativeMercenaryFitMalusExemptTeam(input: {
  teamId?: string | null;
  teamName?: string | null;
}) {
  const teamId = normalizeTransfermarktToken(input.teamId);
  const teamName = normalizeTransfermarktToken(input.teamName);
  return teamId === "w_l" || teamName === "wrecking_legionnaires";
}

export function getNegativeMercenaryFitMalus(input: {
  teamId?: string | null;
  teamName?: string | null;
  isMercenary: boolean;
  teamFit: number | null | undefined;
}) {
  if (!input.isMercenary || input.teamFit == null || input.teamFit >= 0) {
    return 0;
  }

  return isNegativeMercenaryFitMalusExemptTeam(input) ? 0 : NEGATIVE_MERCENARY_FIT_MALUS;
}

export function getMercenaryNegativeFitPenalty(input: {
  teamId?: string | null;
  teamName?: string | null;
  isMercenary: boolean;
  teamFit: number | null | undefined;
}) {
  const malus = getNegativeMercenaryFitMalus(input);
  return malus > 0 ? -malus : 0;
}

export function applyMercenaryNegativeFitPenaltyToFinalPickScore(input: {
  finalPickScoreBeforePenalty: number;
  mercenaryNegativeFitPenalty: number;
}) {
  return Number((input.finalPickScoreBeforePenalty + input.mercenaryNegativeFitPenalty).toFixed(1));
}

function buildTokenCounts(players: TokenizedPlayer[]) {
  const races = new Map<string, number>();
  const alignments = new Map<string, number>();
  const subclasses = new Map<string, number>();
  const traits = new Map<string, number>();

  for (const player of players) {
    const race = normalizeTransfermarktToken(player.race);
    if (race) {
      races.set(race, (races.get(race) ?? 0) + 1);
    }

    const alignment = normalizeTransfermarktToken(player.alignment);
    if (alignment) {
      alignments.set(alignment, (alignments.get(alignment) ?? 0) + 1);
    }

    for (const subclass of player.subclasses.map(normalizeTransfermarktToken).filter(Boolean)) {
      subclasses.set(subclass, (subclasses.get(subclass) ?? 0) + 1);
    }

    for (const trait of [...player.traitsPositive, ...player.traitsNegative].map(normalizeTransfermarktToken).filter(Boolean)) {
      traits.set(trait, (traits.get(trait) ?? 0) + 1);
    }
  }

  return { races, alignments, subclasses, traits };
}

function scorePresenceToken(token: string, counts: Map<string, number>, mismatchPenalty: number) {
  if (!token) {
    return 0;
  }

  const matches = counts.get(token) ?? 0;
  return matches > 0 ? matches : mismatchPenalty;
}

function scorePresenceArray(tokens: string[], counts: Map<string, number>, mismatchPenalty: number) {
  return tokens.reduce((sum, token) => sum + scorePresenceToken(token, counts, mismatchPenalty), 0);
}

export function calculateTransfermarktFit(
  player: TokenizedPlayer,
  rosterPlayers: TokenizedPlayer[],
  options?: {
    teamId?: string | null;
  },
): TransfermarktFitBreakdown {
  if (!rosterPlayers.length && !options?.teamId) {
    return {
      fitRace: 0,
      fitSubclasses: 0,
      fitTraits: 0,
      fitAlignment: 0,
      teamFit: 0,
    };
  }

  const tokenCounts = buildTokenCounts(rosterPlayers);
  const raceKey = normalizeTransfermarktToken(player.race);
  const alignmentKey = normalizeTransfermarktToken(player.alignment);
  const subclassKeys = player.subclasses.map(normalizeTransfermarktToken).filter(Boolean);
  const traitKeys = [...player.traitsPositive, ...player.traitsNegative].map(normalizeTransfermarktToken).filter(Boolean);

  const matrixRaceFit = getTeamRaceFit({ teamId: options?.teamId, race: player.race });
  const matrixSubclassFit = getTeamSubclassFitSum({ teamId: options?.teamId, subclasses: player.subclasses });
  const hasRosterContext = rosterPlayers.length > 0;

  const fitRace = matrixRaceFit ?? scorePresenceToken(raceKey, tokenCounts.races, -2);
  const fitAlignment = hasRosterContext ? scorePresenceToken(alignmentKey, tokenCounts.alignments, -1) : 0;
  const fitSubclasses = matrixSubclassFit ?? scorePresenceArray(subclassKeys, tokenCounts.subclasses, -1);
  const fitTraits = hasRosterContext ? scorePresenceArray(traitKeys, tokenCounts.traits, -1) : 0;

  const teamFit =
    matrixRaceFit != null || matrixSubclassFit != null
      ? fitRace + fitSubclasses + fitAlignment * 2 + fitTraits * 0.8
      : fitRace * 3 + fitAlignment * 2 + fitSubclasses * 1 + fitTraits * 0.8;

  return {
    fitRace,
    fitSubclasses,
    fitTraits,
    fitAlignment,
    teamFit: Number(teamFit.toFixed(2)),
  };
}
