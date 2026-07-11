import type {
  GameState,
  Player,
  PlayerBaselineRecord,
  PlayerBaselineWriteGuardEvent,
  PlayerGeneratorAttributeName,
} from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";

export const PLAYER_BASELINE_VERSION = "player-baseline-v2";
const PLAYER_BASELINE_CHECKSUM_ALGORITHM = "sha256" as const;
const DEFAULT_BASELINE_SOURCE_FILE = "data/source/seed";

const ATTRIBUTE_KEYS: PlayerGeneratorAttributeName[] = [
  "power",
  "health",
  "stamina",
  "intelligence",
  "awareness",
  "determination",
  "speed",
  "dexterity",
  "charisma",
  "will",
  "spirit",
  "torment",
];

type SeasonZeroEconomyReference = NonNullable<PlayerBaselineRecord["seasonZeroEconomy"]>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const words: number[] = [];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  for (let index = 0; index < bytes.length; index += 1) {
    words[index >> 2] |= bytes[index]! << (24 - (index % 4) * 8);
  }
  words[bytes.length >> 2] |= 0x80 << (24 - (bytes.length % 4) * 8);
  words[(((bytes.length + 8) >> 6) << 4) + 15] = bytes.length * 8;
  const w = new Array<number>(64);
  for (let block = 0; block < words.length; block += 16) {
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let index = 0; index < 64; index += 1) {
      if (index < 16) {
        w[index] = words[block + index] | 0;
      } else {
        const s0 = rightRotate(w[index - 15]!, 7) ^ rightRotate(w[index - 15]!, 18) ^ (w[index - 15]! >>> 3);
        const s1 = rightRotate(w[index - 2]!, 17) ^ rightRotate(w[index - 2]!, 19) ^ (w[index - 2]! >>> 10);
        w[index] = (w[index - 16]! + s0 + w[index - 7]! + s1) | 0;
      }
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + k[index]! + w[index]!) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((value) => (value >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

function rightRotate(value: number, bits: number) {
  return (value >>> bits) | (value << (32 - bits));
}

function stableSortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableSortValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableSortValue(entry)]),
    );
  }
  return value;
}

function stableHash(value: unknown) {
  return sha256Hex(JSON.stringify(stableSortValue(value)));
}

function buildBaselineAttributes(player: Player) {
  return Object.fromEntries(
    ATTRIBUTE_KEYS.map((key) => [key, player.attributeSheetStats?.[key] ?? null]).filter(([, value]) => typeof value === "number"),
  ) as Partial<Record<PlayerGeneratorAttributeName, number>>;
}

function buildChecksumPayload(baseline: Pick<
  PlayerBaselineRecord,
  | "playerId"
  | "name"
  | "race"
  | "className"
  | "subclasses"
  | "traits"
  | "traitsPositive"
  | "traitsNegative"
  | "attributes"
  | "marketValue"
  | "salary"
  | "seasonZeroEconomy"
  | "bracket"
  | "disciplineRatings"
>) {
  return {
    playerId: baseline.playerId,
    name: baseline.name,
    race: baseline.race,
    className: baseline.className,
    subclasses: [...baseline.subclasses].sort(),
    traits: [...baseline.traits].sort(),
    traitsPositive: [...(baseline.traitsPositive ?? [])].sort(),
    traitsNegative: [...(baseline.traitsNegative ?? [])].sort(),
    attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, baseline.attributes[key] ?? null])),
    marketValue: baseline.marketValue ?? null,
    salary: baseline.salary ?? null,
    seasonZeroEconomy: baseline.seasonZeroEconomy ?? null,
    bracket: baseline.bracket ?? null,
    disciplineRatings: baseline.disciplineRatings ?? {},
  };
}

function buildBaselineCorePayload(baseline: Pick<
  PlayerBaselineRecord,
  | "playerId"
  | "name"
  | "race"
  | "className"
  | "subclasses"
  | "traits"
  | "traitsPositive"
  | "traitsNegative"
  | "attributes"
  | "bracket"
  | "disciplineRatings"
>) {
  return {
    playerId: baseline.playerId,
    name: baseline.name,
    race: baseline.race,
    className: baseline.className,
    subclasses: [...baseline.subclasses].sort(),
    traits: [...baseline.traits].sort(),
    traitsPositive: [...(baseline.traitsPositive ?? [])].sort(),
    traitsNegative: [...(baseline.traitsNegative ?? [])].sort(),
    attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, baseline.attributes[key] ?? null])),
    bracket: baseline.bracket ?? null,
    disciplineRatings: baseline.disciplineRatings ?? {},
  };
}

function roundBaselineMoney(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

function normalizeLegacyBaselineMoney(value: number | null | undefined, kind: "marketValue" | "salary") {
  const numericValue = roundBaselineMoney(value);
  if (numericValue == null) {
    return null;
  }

  if (kind === "marketValue") {
    if (numericValue > 10_000) return roundBaselineMoney(numericValue / 1000);
    if (numericValue > 1000) return roundBaselineMoney(numericValue / 100);
    return numericValue;
  }

  if (numericValue > 1000) return roundBaselineMoney(numericValue / 1000);
  if (numericValue > 100) return roundBaselineMoney(numericValue / 100);
  return numericValue;
}

function createSeasonZeroEconomyReferenceFromPlayer(
  player: Player,
  options?: {
    computedAt?: string;
    source?: SeasonZeroEconomyReference["source"];
  },
): SeasonZeroEconomyReference {
  const storedMarketValue = roundBaselineMoney(player.marketValue);
  const displayMarketValue = roundBaselineMoney(player.displayMarketValue);
  const storedSalary = roundBaselineMoney(player.salaryDemand);
  const usesLegacyRawMarketValue = storedMarketValue != null && storedMarketValue > 1000 && displayMarketValue != null;
  const usesLegacyRawSalary = storedSalary != null && storedSalary > 1000;
  const seasonZeroPlayer = {
    ...player,
    marketValue: usesLegacyRawMarketValue ? displayMarketValue : player.marketValue,
    salaryDemand: usesLegacyRawSalary ? null : player.salaryDemand,
    displayMarketValue: null,
    displaySalary: null,
  };
  const economy = resolvePlayerEconomyContract({
    playerId: player.id,
    player: seasonZeroPlayer,
    rosterEntry: null,
  });

  return {
    source: options?.source ?? "season_0_computed",
    marketValue: roundBaselineMoney(economy.marketValue),
    salary: roundBaselineMoney(economy.expectedSalary ?? economy.salary),
    purchasePrice: roundBaselineMoney(economy.purchasePrice),
    salaryMarketValue: roundBaselineMoney(economy.salaryMarketValue),
    baseMarketValue: roundBaselineMoney(economy.baseMarketValue),
    salaryBase: roundBaselineMoney(economy.salaryBase),
    traitPercentSum: roundBaselineMoney(economy.traitPercentSum),
    marketValueSource: economy.marketValueSource,
    salarySource: economy.expectedSalary != null ? "season_0_expected_salary" : economy.salarySource,
    computedAt: options?.computedAt ?? new Date().toISOString(),
  };
}

function isEconomyReferenceMismatch(
  left: SeasonZeroEconomyReference | null | undefined,
  right: SeasonZeroEconomyReference | null | undefined,
) {
  if (!left || !right || left.marketValue == null || right.marketValue == null) {
    return false;
  }
  const ratio = Math.max(left.marketValue, right.marketValue) / Math.max(0.01, Math.min(left.marketValue, right.marketValue));
  return ratio >= 3 || Math.abs((left.salary ?? 0) - (right.salary ?? 0)) >= 50;
}

function normalizeSeasonZeroEconomyReference(
  baseline: PlayerBaselineRecord,
  options?: { computedAt?: string },
): SeasonZeroEconomyReference {
  const existing = baseline.seasonZeroEconomy;
  if (existing) {
    const isLegacyBackfill =
      existing.source !== "season_0_computed" &&
      (existing.marketValueSource.startsWith("baseline_") || existing.salarySource.startsWith("baseline_"));
    return {
      source: existing.source,
      marketValue: isLegacyBackfill
        ? normalizeLegacyBaselineMoney(existing.marketValue, "marketValue")
        : roundBaselineMoney(existing.marketValue),
      salary: isLegacyBackfill ? normalizeLegacyBaselineMoney(existing.salary, "salary") : roundBaselineMoney(existing.salary),
      purchasePrice: isLegacyBackfill
        ? normalizeLegacyBaselineMoney(existing.purchasePrice, "marketValue")
        : roundBaselineMoney(existing.purchasePrice),
      salaryMarketValue: isLegacyBackfill
        ? normalizeLegacyBaselineMoney(existing.salaryMarketValue, "marketValue")
        : roundBaselineMoney(existing.salaryMarketValue),
      baseMarketValue: roundBaselineMoney(existing.baseMarketValue),
      salaryBase: roundBaselineMoney(existing.salaryBase),
      traitPercentSum: roundBaselineMoney(existing.traitPercentSum),
      marketValueSource: existing.marketValueSource,
      salarySource: existing.salarySource,
      computedAt: existing.computedAt ?? baseline.createdAt ?? options?.computedAt ?? new Date().toISOString(),
    };
  }

  return {
    source: baseline.reconstructionWarning ? "season_0_reconstructed" : "season_0_backfilled",
    marketValue: normalizeLegacyBaselineMoney(baseline.marketValue, "marketValue"),
    salary: normalizeLegacyBaselineMoney(baseline.salary, "salary"),
    purchasePrice: normalizeLegacyBaselineMoney(baseline.marketValue, "marketValue"),
    salaryMarketValue: normalizeLegacyBaselineMoney(baseline.marketValue, "marketValue"),
    baseMarketValue: null,
    salaryBase: null,
    traitPercentSum: null,
    marketValueSource: "baseline_market_value_backfill",
    salarySource: "baseline_salary_backfill",
    computedAt: baseline.createdAt ?? options?.computedAt ?? new Date().toISOString(),
  };
}

export function getPlayerBaselineEconomyReference(
  baseline: PlayerBaselineRecord | null | undefined,
): SeasonZeroEconomyReference | null {
  return baseline ? normalizeSeasonZeroEconomyReference(baseline) : null;
}

function shouldReconstructLegacyEconomyReference(baseline: PlayerBaselineRecord, player: Player) {
  const economy = getPlayerBaselineEconomyReference(baseline);
  if (!economy || economy.source === "season_0_computed") {
    return false;
  }
  const currentEconomy = createSeasonZeroEconomyReferenceFromPlayer(player, {
    computedAt: baseline.createdAt,
    source: "season_0_reconstructed",
  });
  if (economy.marketValue == null || currentEconomy.marketValue == null) {
    return false;
  }
  const baselineLooksPlaceholder =
    Math.abs((economy.marketValue ?? 0) - 100) < 0.01 && Math.abs((economy.salary ?? 0) - 10) < 0.01;
  const marketValueRatio =
    Math.max(economy.marketValue, currentEconomy.marketValue) / Math.max(0.01, Math.min(economy.marketValue, currentEconomy.marketValue));
  return baselineLooksPlaceholder && marketValueRatio >= 3;
}

export function calculatePlayerBaselineChecksum(baseline: PlayerBaselineRecord) {
  return stableHash(buildChecksumPayload(baseline));
}

export function normalizePlayerBaselineRecord(
  baseline: PlayerBaselineRecord,
  options?: { createdAt?: string; importedAt?: string; sourceFile?: string | null },
): PlayerBaselineRecord {
  const normalizedTraitsPositive = baseline.traitsPositive ?? [];
  const normalizedTraitsNegative = baseline.traitsNegative ?? [];
  const normalizedTraits =
    baseline.traits.length > 0 ? baseline.traits : [...normalizedTraitsPositive, ...normalizedTraitsNegative];
  const sourceFile = baseline.sourceFile ?? options?.sourceFile ?? DEFAULT_BASELINE_SOURCE_FILE;
  const normalized: PlayerBaselineRecord = {
    ...baseline,
    traits: normalizedTraits,
    traitsPositive: normalizedTraitsPositive,
    traitsNegative: normalizedTraitsNegative,
    sourceFile,
    baselineVersion: PLAYER_BASELINE_VERSION,
    checksumAlgorithm: PLAYER_BASELINE_CHECKSUM_ALGORITHM,
    createdAt: baseline.createdAt ?? options?.createdAt ?? new Date().toISOString(),
    importedAt: baseline.importedAt ?? options?.importedAt ?? baseline.createdAt ?? options?.createdAt ?? new Date().toISOString(),
  };
  normalized.seasonZeroEconomy = normalizeSeasonZeroEconomyReference(normalized, { computedAt: normalized.createdAt });
  const checksum = calculatePlayerBaselineChecksum(normalized);
  return {
    ...normalized,
    checksum,
    sourceHash: normalized.sourceHash ?? stableHash({ sourceFile, checksum }),
  };
}

export function createPlayerBaselineFromPlayer(
  player: Player,
  options?: {
    source?: PlayerBaselineRecord["source"];
    createdAt?: string;
    importedAt?: string;
    sourceFile?: string | null;
    reconstructionWarning?: PlayerBaselineRecord["reconstructionWarning"];
  },
): PlayerBaselineRecord {
  const createdAt = options?.createdAt ?? new Date().toISOString();
  const seasonZeroEconomy = createSeasonZeroEconomyReferenceFromPlayer(player, {
    computedAt: createdAt,
    source: options?.reconstructionWarning ? "season_0_reconstructed" : "season_0_computed",
  });
  return normalizePlayerBaselineRecord({
    playerId: player.id,
    name: player.name,
    race: player.race,
    className: player.className,
    subclasses: [...player.subclasses],
    traits: [...player.traitsPositive, ...player.traitsNegative],
    traitsPositive: [...player.traitsPositive],
    traitsNegative: [...player.traitsNegative],
    attributes: buildBaselineAttributes(player),
    marketValue: seasonZeroEconomy.marketValue ?? player.marketValue ?? null,
    salary: seasonZeroEconomy.salary ?? player.salaryDemand ?? null,
    seasonZeroEconomy,
    bracket: player.bracketLabel ?? null,
    disciplineRatings: { ...(player.disciplineRatings ?? {}) },
    imageRef: player.portraitPath ?? player.portraitUrl ?? player.imageSource ?? null,
    source: options?.source ?? "seed",
    baselineVersion: PLAYER_BASELINE_VERSION,
    createdAt,
    importedAt: options?.importedAt ?? createdAt,
    sourceFile: options?.sourceFile ?? DEFAULT_BASELINE_SOURCE_FILE,
    ...(options?.reconstructionWarning ? { reconstructionWarning: options.reconstructionWarning } : {}),
  });
}

export function createPlayerBaselinesForPlayers(
  players: Player[],
  options?: {
    source?: PlayerBaselineRecord["source"];
    createdAt?: string;
    importedAt?: string;
    sourceFile?: string | null;
  },
) {
  return players.map((player) =>
    createPlayerBaselineFromPlayer(player, {
      source: options?.source ?? "seed",
      createdAt: options?.createdAt,
      importedAt: options?.importedAt,
      sourceFile: options?.sourceFile,
    }),
  );
}

function disciplineRatingsLookPlaceholder(ratings: Record<string, number>) {
  const values = Object.values(ratings).filter((value) => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) {
    return true;
  }
  const rounded = values.map((value) => value.toFixed(1));
  return new Set(rounded).size === 1;
}

export function baselineIdentityIsStale(existing: PlayerBaselineRecord, sourcePlayer: Player) {
  if (existing.className !== sourcePlayer.className) {
    return true;
  }
  if (existing.race !== sourcePlayer.race) {
    return true;
  }
  if (existing.name.trim() !== sourcePlayer.name.trim()) {
    return true;
  }
  if (disciplineRatingsLookPlaceholder(existing.disciplineRatings ?? {})) {
    const sourceRatings = sourcePlayer.disciplineRatings ?? {};
    if (Object.keys(sourceRatings).length > 0 && !disciplineRatingsLookPlaceholder(sourceRatings)) {
      return true;
    }
  }
  return false;
}

export function ensurePlayerBaselines(
  gameState: GameState,
  options?: {
    sourcePlayers?: Player[];
    createdAt?: string;
    /** When set, only recompute baselines for these players; others keep existing records. */
    playerIds?: Iterable<string>;
  },
) {
  const existingByPlayerId = new Map((gameState.playerBaselines ?? []).map((baseline) => [baseline.playerId, baseline]));
  const sourceByPlayerId = new Map((options?.sourcePlayers ?? []).map((player) => [player.id, player]));
  const scope = options?.playerIds ? new Set(options.playerIds) : null;
  const playersToProcess = scope ? gameState.players.filter((player) => scope.has(player.id)) : gameState.players;
  const warnings: string[] = [];
  const resolveBaseline = (player: Player) => {
    const existing = existingByPlayerId.get(player.id);
    const sourcePlayer = sourceByPlayerId.get(player.id);
    if (existing) {
      const normalizedExisting = normalizePlayerBaselineRecord(existing, { createdAt: options?.createdAt });
      if (sourcePlayer && baselineIdentityIsStale(normalizedExisting, sourcePlayer)) {
        warnings.push(`baseline_identity_refreshed:${player.id}`);
        return createPlayerBaselineFromPlayer(sourcePlayer, {
          source: normalizedExisting.source === "legacy" ? "import" : normalizedExisting.source,
          createdAt: normalizedExisting.createdAt,
          importedAt: new Date().toISOString(),
          sourceFile: normalizedExisting.sourceFile ?? DEFAULT_BASELINE_SOURCE_FILE,
        });
      }
      if (sourcePlayer) {
        const sourceAttributes = buildBaselineAttributes(sourcePlayer);
        const sourceEconomy = createSeasonZeroEconomyReferenceFromPlayer(sourcePlayer, {
          computedAt: normalizedExisting.createdAt,
          source: "season_0_computed",
        });
        const mergedAttributes = { ...normalizedExisting.attributes };
        let backfilled = false;
        for (const key of ATTRIBUTE_KEYS) {
          if (mergedAttributes[key] == null && typeof sourceAttributes[key] === "number") {
            mergedAttributes[key] = sourceAttributes[key];
            backfilled = true;
          }
        }
        const needsComputedEconomyReference =
          normalizedExisting.seasonZeroEconomy?.source !== "season_0_computed" ||
          isEconomyReferenceMismatch(normalizedExisting.seasonZeroEconomy, sourceEconomy);
        if (needsComputedEconomyReference) {
          backfilled = true;
          warnings.push(`baseline_economy_backfilled:${player.id}`);
        }
        if (backfilled) {
          if (Object.entries(mergedAttributes).some(([key, value]) => normalizedExisting.attributes[key as PlayerGeneratorAttributeName] !== value)) {
            warnings.push(`baseline_attribute_backfilled:${player.id}`);
          }
          return normalizePlayerBaselineRecord({
            ...normalizedExisting,
            attributes: mergedAttributes,
            seasonZeroEconomy: needsComputedEconomyReference ? sourceEconomy : normalizedExisting.seasonZeroEconomy,
            marketValue: needsComputedEconomyReference ? sourceEconomy.marketValue : normalizedExisting.marketValue,
            salary: needsComputedEconomyReference ? sourceEconomy.salary : normalizedExisting.salary,
          });
        }
      }
      if (shouldReconstructLegacyEconomyReference(normalizedExisting, player)) {
        const reconstructedEconomy = createSeasonZeroEconomyReferenceFromPlayer(player, {
          computedAt: normalizedExisting.createdAt,
          source: "season_0_reconstructed",
        });
        warnings.push(`baseline_economy_reconstructed_from_current:${player.id}`);
        return normalizePlayerBaselineRecord({
          ...normalizedExisting,
          marketValue: reconstructedEconomy.marketValue,
          salary: reconstructedEconomy.salary,
          seasonZeroEconomy: reconstructedEconomy,
        });
      }
      return normalizedExisting;
    }

    if (sourcePlayer) {
      return createPlayerBaselineFromPlayer(sourcePlayer, {
        source: "seed",
        createdAt: options?.createdAt,
        sourceFile: DEFAULT_BASELINE_SOURCE_FILE,
      });
    }

    warnings.push(`baseline_reconstructed_from_mutated_state:${player.id}`);
    return createPlayerBaselineFromPlayer(player, {
      source: "legacy",
      createdAt: options?.createdAt,
      reconstructionWarning: "baseline_reconstructed_from_mutated_state",
    });
  };

  const baselines: PlayerBaselineRecord[] = [];
  const processedIds = new Set<string>();
  for (const player of playersToProcess) {
    processedIds.add(player.id);
    baselines.push(resolveBaseline(player));
  }
  if (scope) {
    for (const [playerId, baseline] of existingByPlayerId) {
      if (!processedIds.has(playerId)) {
        baselines.push(baseline);
      }
    }
    baselines.sort((left, right) => left.playerId.localeCompare(right.playerId));
  }

  return {
    gameState: {
      ...gameState,
      playerBaselines: baselines,
    },
    warnings,
  };
}

export function guardPlayerBaselineWrite(input: {
  previous?: PlayerBaselineRecord[] | null;
  next?: PlayerBaselineRecord[] | null;
  attemptedSource: string;
  timestamp?: string;
}) {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const previousByPlayerId = new Map(
    (input.previous ?? []).map((baseline) => {
      const normalized = normalizePlayerBaselineRecord(baseline);
      return [normalized.playerId, normalized] as const;
    }),
  );
  const events: PlayerBaselineWriteGuardEvent[] = [];
  const guarded = (input.next ?? []).map((baseline) => {
    const normalizedNext = normalizePlayerBaselineRecord(baseline);
    const previous = previousByPlayerId.get(normalizedNext.playerId);
    if (!previous) {
      return normalizedNext;
    }

    const previousChecksum = previous.checksum ?? calculatePlayerBaselineChecksum(previous);
    const attemptedChecksum = normalizedNext.checksum ?? calculatePlayerBaselineChecksum(normalizedNext);
    if (previousChecksum === attemptedChecksum) {
      return {
        ...previous,
        baselineVersion: normalizedNext.baselineVersion || previous.baselineVersion,
        checksum: previousChecksum,
      };
    }

    const previousCoreHash = stableHash(buildBaselineCorePayload(previous));
    const nextCoreHash = stableHash(buildBaselineCorePayload(normalizedNext));
    const isEconomyReferenceMigration =
      previousCoreHash === nextCoreHash &&
      previous.seasonZeroEconomy?.source !== "season_0_computed" &&
      normalizedNext.seasonZeroEconomy != null;
    const isEconomyReferenceCorrection =
      previousCoreHash === nextCoreHash &&
      previous.seasonZeroEconomy != null &&
      normalizedNext.seasonZeroEconomy != null &&
      isEconomyReferenceMismatch(previous.seasonZeroEconomy, normalizedNext.seasonZeroEconomy);
    if (isEconomyReferenceMigration || isEconomyReferenceCorrection) {
      return normalizedNext;
    }

    events.push({
      eventId: `baseline-write-blocked-${normalizedNext.playerId}-${timestamp.replace(/\W+/g, "-")}`,
      playerId: normalizedNext.playerId,
      reason: "player_baseline_write_blocked",
      attemptedSource: input.attemptedSource,
      previousChecksum,
      attemptedChecksum,
      timestamp,
    });
    return previous;
  });

  for (const previous of previousByPlayerId.values()) {
    if (!guarded.some((baseline) => baseline.playerId === previous.playerId)) {
      guarded.push(previous);
    }
  }

  return {
    baselines: guarded,
    events,
  };
}

function applyBaselineToPlayer(player: Player, baseline: PlayerBaselineRecord): Player {
  const normalizedBaseline = normalizePlayerBaselineRecord(baseline);
  return {
    ...player,
    name: normalizedBaseline.name,
    race: normalizedBaseline.race,
    className: normalizedBaseline.className,
    subclasses: [...normalizedBaseline.subclasses],
    traitsPositive: [...(normalizedBaseline.traitsPositive ?? normalizedBaseline.traits)],
    traitsNegative: [...(normalizedBaseline.traitsNegative ?? [])],
    attributeSheetStats: {
      ...(player.attributeSheetStats ?? {}),
      ...normalizedBaseline.attributes,
    },
    marketValue: normalizedBaseline.marketValue ?? player.marketValue,
    salaryDemand: normalizedBaseline.salary ?? player.salaryDemand,
    bracketLabel: normalizedBaseline.bracket,
    disciplineRatings: { ...normalizedBaseline.disciplineRatings },
    previousDisciplineRatings: undefined,
    lastSeasonDisciplineValues: undefined,
    currentDisciplineValues: { ...normalizedBaseline.disciplineRatings },
    disciplineDelta: undefined,
    economyAfterUpgradePreview: null,
    currentXP: 0,
    spentXP: 0,
    lifetimeXP: null,
    trainingMode: null,
    fatigue: 0,
  };
}

export function resetSavePlayersToBaseline(gameState: GameState) {
  const baselineByPlayerId = new Map((gameState.playerBaselines ?? []).map((baseline) => [baseline.playerId, baseline]));
  const missingBaselinePlayerIds = gameState.players
    .filter((player) => !baselineByPlayerId.has(player.id))
    .map((player) => player.id);
  const blockers = missingBaselinePlayerIds.map((playerId) => `player_baseline_missing:${playerId}`);

  if (blockers.length > 0) {
    return {
      ok: false,
      gameState,
      resetPlayers: 0,
      warnings: [] as string[],
      blockers,
    };
  }

  return {
    ok: true,
    gameState: {
      ...gameState,
      players: gameState.players.map((player) => applyBaselineToPlayer(player, baselineByPlayerId.get(player.id)!)),
      playerProgressionEvents: [],
    },
    resetPlayers: gameState.players.length,
    warnings: [] as string[],
    blockers: [] as string[],
  };
}

export function createNewGameFromPlayerBaseline(input: {
  gameState: GameState;
}) {
  const reset = resetSavePlayersToBaseline(input.gameState);
  if (!reset.ok) {
    return reset;
  }

  return {
    ...reset,
    gameState: {
      ...reset.gameState,
      transferHistory: [],
      playerProgressionEvents: [],
    },
  };
}

export function buildPlayerBaselineAudit(gameState: GameState) {
  const baselineByPlayerId = new Map((gameState.playerBaselines ?? []).map((baseline) => {
    const normalized = normalizePlayerBaselineRecord(baseline);
    return [normalized.playerId, normalized] as const;
  }));
  const missing = gameState.players.filter((player) => !baselineByPlayerId.has(player.id));
  const deltaRows = gameState.players.flatMap((player) => {
    const baseline = baselineByPlayerId.get(player.id);
    if (!baseline) return [];
    return ATTRIBUTE_KEYS.map((attribute) => {
      const baselineValue = baseline.attributes[attribute] ?? null;
      const currentValue = player.attributeSheetStats?.[attribute] ?? null;
      const delta =
        typeof baselineValue === "number" && typeof currentValue === "number"
          ? currentValue - baselineValue
          : null;
      return {
        playerId: player.id,
        playerName: player.name,
        attribute,
        baselineValue,
        currentValue,
        delta,
      };
    }).filter((row) => row.delta != null && row.delta !== 0);
  });
  const reconstructed = (gameState.playerBaselines ?? []).filter((baseline) => baseline.reconstructionWarning);
  const normalizedBaselines = (gameState.playerBaselines ?? []).map((baseline) => normalizePlayerBaselineRecord(baseline));
  const versions = Array.from(new Set(normalizedBaselines.map((baseline) => baseline.baselineVersion)));
  const invalidChecksumRows = normalizedBaselines.filter(
    (baseline) => baseline.checksum !== calculatePlayerBaselineChecksum(baseline),
  );
  const checksumRows = normalizedBaselines.map((baseline) => ({
    playerId: baseline.playerId,
    playerName: baseline.name,
    baselineVersion: baseline.baselineVersion,
    source: baseline.source,
    sourceFile: baseline.sourceFile ?? null,
    sourceHash: baseline.sourceHash ?? null,
    checksum: baseline.checksum ?? null,
    checksumValid: baseline.checksum === calculatePlayerBaselineChecksum(baseline),
    importedAt: baseline.importedAt ?? null,
    createdAt: baseline.createdAt,
    reconstructionWarning: baseline.reconstructionWarning ?? null,
  }));
  const economyRows = gameState.players.map((player) => {
    const baseline = baselineByPlayerId.get(player.id) ?? null;
    const economy = getPlayerBaselineEconomyReference(baseline);
    const currentEconomy = resolvePlayerEconomyContract({
      playerId: player.id,
      player,
      rosterEntry: null,
    });
    const marketValueDelta =
      economy?.marketValue != null && currentEconomy.marketValue != null
        ? roundBaselineMoney(currentEconomy.marketValue - economy.marketValue)
        : null;
    const salaryDelta =
      economy?.salary != null && currentEconomy.expectedSalary != null
        ? roundBaselineMoney(currentEconomy.expectedSalary - economy.salary)
        : null;
    return {
      playerId: player.id,
      playerName: player.name,
      baselineMarketValue: economy?.marketValue ?? null,
      baselineSalary: economy?.salary ?? null,
      baselinePurchasePrice: economy?.purchasePrice ?? null,
      currentMarketValue: currentEconomy.marketValue,
      currentSalary: currentEconomy.expectedSalary ?? currentEconomy.salary,
      marketValueDelta,
      salaryDelta,
      source: economy?.source ?? null,
      marketValueSource: economy?.marketValueSource ?? null,
      salarySource: economy?.salarySource ?? null,
    };
  });
  const computedEconomyReferenceRows = economyRows.filter((row) => row.source === "season_0_computed");
  const nonComputedEconomyReferenceRows = economyRows.filter((row) => row.source !== "season_0_computed");

  return {
    summary: {
      playerCount: gameState.players.length,
      baselineCount: gameState.playerBaselines?.length ?? 0,
      missingBaselineCount: missing.length,
      deltaPlayerCount: new Set(deltaRows.map((row) => row.playerId)).size,
      deltaRowCount: deltaRows.length,
      reconstructedBaselineCount: reconstructed.length,
      baselineVersions: versions,
      invalidChecksumCount: invalidChecksumRows.length,
      seasonZeroEconomyReferenceCount: economyRows.filter((row) => row.source).length,
      computedSeasonZeroEconomyReferenceCount: computedEconomyReferenceRows.length,
      nonComputedSeasonZeroEconomyReferenceCount: nonComputedEconomyReferenceRows.length,
      missingComputedEconomyReferenceCount: nonComputedEconomyReferenceRows.length,
      writeGuardEventCount: gameState.baselineWriteGuardEvents?.length ?? 0,
    },
    missing,
    deltaRows,
    checksumRows,
    economyRows,
    reconstructed,
    writeGuardEvents: gameState.baselineWriteGuardEvents ?? [],
  };
}

export function clonePlayerBaselines(baselines: PlayerBaselineRecord[] | undefined) {
  return clone(baselines ?? []);
}
