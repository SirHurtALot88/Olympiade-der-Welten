import type {
  GameState,
  Player,
  PlayerBaselineRecord,
  PlayerGeneratorAttributeName,
} from "@/lib/data/olyDataTypes";

export const PLAYER_BASELINE_VERSION = "player-baseline-v1";

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

function clone<T>(value: T): T {
  return structuredClone(value);
}

function buildBaselineAttributes(player: Player) {
  return Object.fromEntries(
    ATTRIBUTE_KEYS.map((key) => [key, player.attributeSheetStats?.[key] ?? null]).filter(([, value]) => typeof value === "number"),
  ) as Partial<Record<PlayerGeneratorAttributeName, number>>;
}

export function createPlayerBaselineFromPlayer(
  player: Player,
  options?: {
    source?: PlayerBaselineRecord["source"];
    createdAt?: string;
    reconstructionWarning?: PlayerBaselineRecord["reconstructionWarning"];
  },
): PlayerBaselineRecord {
  return {
    playerId: player.id,
    name: player.name,
    race: player.race,
    className: player.className,
    subclasses: [...player.subclasses],
    traits: [...player.traitsPositive, ...player.traitsNegative],
    traitsPositive: [...player.traitsPositive],
    traitsNegative: [...player.traitsNegative],
    attributes: buildBaselineAttributes(player),
    marketValue: player.marketValue ?? null,
    salary: player.salaryDemand ?? null,
    bracket: player.bracketLabel ?? null,
    disciplineRatings: { ...(player.disciplineRatings ?? {}) },
    imageRef: player.portraitPath ?? player.portraitUrl ?? player.imageSource ?? null,
    source: options?.source ?? "seed",
    baselineVersion: PLAYER_BASELINE_VERSION,
    createdAt: options?.createdAt ?? new Date().toISOString(),
    ...(options?.reconstructionWarning ? { reconstructionWarning: options.reconstructionWarning } : {}),
  };
}

export function createPlayerBaselinesForPlayers(
  players: Player[],
  options?: {
    source?: PlayerBaselineRecord["source"];
    createdAt?: string;
  },
) {
  return players.map((player) =>
    createPlayerBaselineFromPlayer(player, {
      source: options?.source ?? "seed",
      createdAt: options?.createdAt,
    }),
  );
}

export function ensurePlayerBaselines(
  gameState: GameState,
  options?: {
    sourcePlayers?: Player[];
    createdAt?: string;
  },
) {
  const existingByPlayerId = new Map((gameState.playerBaselines ?? []).map((baseline) => [baseline.playerId, baseline]));
  const sourceByPlayerId = new Map((options?.sourcePlayers ?? []).map((player) => [player.id, player]));
  const warnings: string[] = [];
  const baselines = gameState.players.map((player) => {
    const existing = existingByPlayerId.get(player.id);
    const sourcePlayer = sourceByPlayerId.get(player.id);
    if (existing) {
      if (sourcePlayer) {
        const sourceAttributes = buildBaselineAttributes(sourcePlayer);
        const mergedAttributes = { ...existing.attributes };
        let backfilled = false;
        for (const key of ATTRIBUTE_KEYS) {
          if (mergedAttributes[key] == null && typeof sourceAttributes[key] === "number") {
            mergedAttributes[key] = sourceAttributes[key];
            backfilled = true;
          }
        }
        if (backfilled) {
          warnings.push(`baseline_attribute_backfilled:${player.id}`);
          return {
            ...existing,
            attributes: mergedAttributes,
            baselineVersion: existing.baselineVersion || PLAYER_BASELINE_VERSION,
          };
        }
      }
      return existing;
    }

    if (sourcePlayer) {
      return createPlayerBaselineFromPlayer(sourcePlayer, {
        source: "seed",
        createdAt: options?.createdAt,
      });
    }

    warnings.push(`baseline_reconstructed_from_mutated_state:${player.id}`);
    return createPlayerBaselineFromPlayer(player, {
      source: "legacy",
      createdAt: options?.createdAt,
      reconstructionWarning: "baseline_reconstructed_from_mutated_state",
    });
  });

  return {
    gameState: {
      ...gameState,
      playerBaselines: baselines,
    },
    warnings,
  };
}

function applyBaselineToPlayer(player: Player, baseline: PlayerBaselineRecord): Player {
  return {
    ...player,
    name: baseline.name,
    race: baseline.race,
    className: baseline.className,
    subclasses: [...baseline.subclasses],
    traitsPositive: [...(baseline.traitsPositive ?? baseline.traits)],
    traitsNegative: [...(baseline.traitsNegative ?? [])],
    attributeSheetStats: {
      ...(player.attributeSheetStats ?? {}),
      ...baseline.attributes,
    },
    marketValue: baseline.marketValue ?? player.marketValue,
    salaryDemand: baseline.salary ?? player.salaryDemand,
    bracketLabel: baseline.bracket,
    disciplineRatings: { ...baseline.disciplineRatings },
    previousDisciplineRatings: undefined,
    lastSeasonDisciplineValues: undefined,
    currentDisciplineValues: undefined,
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
  const baselineByPlayerId = new Map((gameState.playerBaselines ?? []).map((baseline) => [baseline.playerId, baseline]));
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
  const versions = Array.from(new Set((gameState.playerBaselines ?? []).map((baseline) => baseline.baselineVersion)));

  return {
    summary: {
      playerCount: gameState.players.length,
      baselineCount: gameState.playerBaselines?.length ?? 0,
      missingBaselineCount: missing.length,
      deltaPlayerCount: new Set(deltaRows.map((row) => row.playerId)).size,
      deltaRowCount: deltaRows.length,
      reconstructedBaselineCount: reconstructed.length,
      baselineVersions: versions,
    },
    missing,
    deltaRows,
    reconstructed,
  };
}

export function clonePlayerBaselines(baselines: PlayerBaselineRecord[] | undefined) {
  return clone(baselines ?? []);
}
