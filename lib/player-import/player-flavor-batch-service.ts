import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Player } from "@/lib/data/olyDataTypes";
import { loadImportedPlayerStats } from "@/lib/data/playerStatsAdapter";
import { upsertPlayerCatalogEntries } from "@/lib/persistence/save-repository";

export const PLAYER_FLAVOR_BATCH_VERSION = 1;

export type PlayerFlavorExportEntry = {
  id: string;
  name: string;
  className: string;
  race: string;
  alignment: string;
  gender: string;
  subclasses: string[];
  traitsPositive: string[];
  traitsNegative: string[];
  flavorDe: string;
  flavorEn: string;
  portraitPath: string | null;
  hasPortrait: boolean;
};

export type PlayerFlavorExportBatch = {
  version: typeof PLAYER_FLAVOR_BATCH_VERSION;
  exportedAt: string;
  count: number;
  filters: {
    missingOnly: boolean;
    limit: number | null;
    offset: number;
    ids: string[] | null;
    names: string[] | null;
  };
  styleGuidePath: string;
  entries: PlayerFlavorExportEntry[];
};

export type PlayerFlavorImportEntry = {
  id?: string;
  name?: string;
  flavorDe?: string;
  flavorEn?: string;
};

export type PlayerFlavorImportIssue = {
  index: number;
  id?: string;
  name?: string;
  code:
    | "missing_key"
    | "missing_flavor"
    | "not_found"
    | "ambiguous_name"
    | "empty_flavor"
    | "existing_flavor";
  message: string;
};

export type PlayerFlavorApplyResult = {
  updatedPlayers: Player[];
  updatedPlayerIds: string[];
  updated: number;
  unchanged: number;
  skipped: number;
  skippedExisting: number;
  notFound: number;
  issues: PlayerFlavorImportIssue[];
};

export type PlayerFlavorExportOptions = {
  players?: Player[];
  portraitMap?: Record<string, string>;
  missingOnly?: boolean;
  limit?: number | null;
  offset?: number;
  ids?: string[] | null;
  names?: string[] | null;
  styleGuidePath?: string;
};

export type PlayerFlavorImportOptions = {
  players?: Player[];
  allowEmpty?: boolean;
  /** When true (default), keep existing non-empty flavor text and skip the import row. */
  skipExistingFlavor?: boolean;
};

export type PlayerFlavorPersistResult = {
  statsPath: string;
  updatedPlayerIds: string[];
};

const DEFAULT_STATS_PATH = path.resolve(process.cwd(), "data/generated/oly-player-stats.json");
const DEFAULT_PORTRAIT_MAP_PATH = path.resolve(process.cwd(), "data/generated/player-portrait-map.json");
const DEFAULT_STYLE_GUIDE_PATH = path.resolve(process.cwd(), "references/world/olympiade-welt-lexikon.md");

function normalizeText(value: string | undefined | null) {
  return (value ?? "").trim();
}

function hasFlavorText(value: string | undefined | null) {
  return normalizeText(value).length > 0;
}

export function loadPortraitMapFromDisk(portraitMapPath = DEFAULT_PORTRAIT_MAP_PATH) {
  return JSON.parse(readFileSync(portraitMapPath, "utf8")) as Record<string, string>;
}

export function buildPlayerFlavorExportEntry(
  player: Player,
  portraitMap: Record<string, string> = {},
): PlayerFlavorExportEntry {
  const portraitPath = player.portraitPath ?? portraitMap[player.id] ?? null;
  return {
    id: player.id,
    name: player.name,
    className: player.className,
    race: player.race,
    alignment: player.alignment,
    gender: player.gender,
    subclasses: [...(player.subclasses ?? [])],
    traitsPositive: [...(player.traitsPositive ?? [])],
    traitsNegative: [...(player.traitsNegative ?? [])],
    flavorDe: player.flavorDe ?? "",
    flavorEn: player.flavorEn ?? "",
    portraitPath,
    hasPortrait: Boolean(portraitPath),
  };
}

export function exportPlayerFlavorBatch(options: PlayerFlavorExportOptions = {}): PlayerFlavorExportBatch {
  const players = options.players ?? loadImportedPlayerStats();
  const portraitMap = options.portraitMap ?? loadPortraitMapFromDisk();
  const missingOnly = options.missingOnly ?? false;
  const offset = Math.max(0, options.offset ?? 0);
  const limit = options.limit ?? null;
  const ids = options.ids?.filter(Boolean) ?? null;
  const names = options.names?.filter(Boolean) ?? null;
  const idSet = ids ? new Set(ids) : null;
  const nameSet = names ? new Set(names) : null;

  let filtered = players.filter((player) => {
    if (idSet && !idSet.has(player.id)) return false;
    if (nameSet && !nameSet.has(player.name)) return false;
    if (missingOnly && hasFlavorText(player.flavorDe)) return false;
    return true;
  });

  if (offset > 0) {
    filtered = filtered.slice(offset);
  }
  if (limit != null && limit >= 0) {
    filtered = filtered.slice(0, limit);
  }

  const entries = filtered.map((player) => buildPlayerFlavorExportEntry(player, portraitMap));

  return {
    version: PLAYER_FLAVOR_BATCH_VERSION,
    exportedAt: new Date().toISOString(),
    count: entries.length,
    filters: {
      missingOnly,
      limit,
      offset,
      ids,
      names,
    },
    styleGuidePath: options.styleGuidePath ?? DEFAULT_STYLE_GUIDE_PATH,
    entries,
  };
}

export function parsePlayerFlavorImportEntries(raw: unknown): PlayerFlavorImportEntry[] {
  if (Array.isArray(raw)) {
    return raw as PlayerFlavorImportEntry[];
  }
  if (raw && typeof raw === "object" && Array.isArray((raw as { entries?: unknown }).entries)) {
    return (raw as { entries: PlayerFlavorImportEntry[] }).entries;
  }
  throw new Error("Expected JSON array or { entries: [...] } for flavor import.");
}

export function parsePlayerFlavorImportFileContents(contents: string): PlayerFlavorImportEntry[] {
  const trimmed = contents.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as PlayerFlavorImportEntry[];
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { entries?: unknown }).entries)) {
      return (parsed as { entries: PlayerFlavorImportEntry[] }).entries;
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      ("id" in parsed || "name" in parsed) &&
      ("flavorDe" in parsed || "flavorEn" in parsed)
    ) {
      return [parsed as PlayerFlavorImportEntry];
    }
  } catch {
    // Fall through to JSONL parsing.
  }

  return trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line) as PlayerFlavorImportEntry;
      } catch {
        throw new Error(`Invalid JSONL on line ${index + 1}.`);
      }
    });
}

export function loadPlayerFlavorImportEntriesFromFile(filePath: string) {
  return parsePlayerFlavorImportFileContents(readFileSync(filePath, "utf8"));
}

function findPlayerForImportEntry(
  entry: PlayerFlavorImportEntry,
  playersById: Map<string, Player>,
  playersByName: Map<string, Player[]>,
): { player?: Player; issue?: Omit<PlayerFlavorImportIssue, "index"> } {
  const id = normalizeText(entry.id);
  const name = normalizeText(entry.name);

  if (id) {
    const player = playersById.get(id);
    if (!player) {
      return {
        issue: {
          id,
          name: name || undefined,
          code: "not_found",
          message: `No player found for id ${id}.`,
        },
      };
    }
    return { player };
  }

  if (name) {
    const matches = playersByName.get(name) ?? [];
    if (matches.length === 0) {
      return {
        issue: {
          name,
          code: "not_found",
          message: `No player found for name ${name}.`,
        },
      };
    }
    if (matches.length > 1) {
      return {
        issue: {
          name,
          code: "ambiguous_name",
          message: `Name ${name} matches ${matches.length} players; provide id.`,
        },
      };
    }
    return { player: matches[0] };
  }

  return {
    issue: {
      code: "missing_key",
      message: "Import entry requires id or name.",
    },
  };
}

export function applyPlayerFlavorImport(
  entries: PlayerFlavorImportEntry[],
  options: PlayerFlavorImportOptions = {},
): PlayerFlavorApplyResult {
  const sourcePlayers = options.players ?? loadImportedPlayerStats();
  const playersById = new Map(sourcePlayers.map((player) => [player.id, player]));
  const playersByName = new Map<string, Player[]>();
  for (const player of sourcePlayers) {
    const bucket = playersByName.get(player.name) ?? [];
    bucket.push(player);
    playersByName.set(player.name, bucket);
  }

  const updatedById = new Map<string, Player>();
  const issues: PlayerFlavorImportIssue[] = [];
  let unchanged = 0;
  let skipped = 0;
  let skippedExisting = 0;
  const skipExistingFlavor = options.skipExistingFlavor ?? true;

  entries.forEach((entry, index) => {
    const lookup = findPlayerForImportEntry(entry, playersById, playersByName);
    if (lookup.issue) {
      issues.push({ ...lookup.issue, index });
      skipped += 1;
      return;
    }

    const player = lookup.player!;
    const nextFlavorDe = entry.flavorDe !== undefined ? normalizeText(entry.flavorDe) : undefined;
    const nextFlavorEn = entry.flavorEn !== undefined ? normalizeText(entry.flavorEn) : undefined;

    if (nextFlavorDe === undefined && nextFlavorEn === undefined) {
      issues.push({
        index,
        id: player.id,
        name: player.name,
        code: "missing_flavor",
        message: "Import entry must include flavorDe and/or flavorEn.",
      });
      skipped += 1;
      return;
    }

    if (!options.allowEmpty) {
      if (nextFlavorDe !== undefined && !hasFlavorText(nextFlavorDe)) {
        issues.push({
          index,
          id: player.id,
          name: player.name,
          code: "empty_flavor",
          message: "flavorDe is empty; pass allowEmpty to clear.",
        });
        skipped += 1;
        return;
      }
    }

    const currentFlavorDe = normalizeText(player.flavorDe);
    const currentFlavorEn = normalizeText(player.flavorEn);

    if (skipExistingFlavor) {
      if (nextFlavorDe !== undefined && hasFlavorText(currentFlavorDe)) {
        issues.push({
          index,
          id: player.id,
          name: player.name,
          code: "existing_flavor",
          message: `Skipped ${player.name}: flavorDe already set.`,
        });
        skippedExisting += 1;
        skipped += 1;
        return;
      }
      if (nextFlavorEn !== undefined && hasFlavorText(currentFlavorEn)) {
        issues.push({
          index,
          id: player.id,
          name: player.name,
          code: "existing_flavor",
          message: `Skipped ${player.name}: flavorEn already set.`,
        });
        skippedExisting += 1;
        skipped += 1;
        return;
      }
    }

    const resolvedFlavorDe = nextFlavorDe !== undefined ? nextFlavorDe : currentFlavorDe;
    const resolvedFlavorEn = nextFlavorEn !== undefined ? nextFlavorEn : currentFlavorEn;

    if (resolvedFlavorDe === currentFlavorDe && resolvedFlavorEn === currentFlavorEn) {
      unchanged += 1;
      return;
    }

    updatedById.set(player.id, {
      ...player,
      flavorDe: resolvedFlavorDe,
      flavorEn: resolvedFlavorEn,
    });
  });

  const updatedPlayers = sourcePlayers.map((player) => updatedById.get(player.id) ?? player);

  return {
    updatedPlayers,
    updatedPlayerIds: [...updatedById.keys()],
    updated: updatedById.size,
    unchanged,
    skipped,
    skippedExisting,
    notFound: issues.filter((issue) => issue.code === "not_found").length,
    issues,
  };
}

export function persistPlayerFlavorImport(
  result: PlayerFlavorApplyResult,
  options: { statsPath?: string } = {},
): PlayerFlavorPersistResult {
  const statsPath = options.statsPath ?? DEFAULT_STATS_PATH;
  writeFileSync(statsPath, `${JSON.stringify(result.updatedPlayers, null, 2)}\n`, "utf8");

  const changedPlayers = result.updatedPlayers.filter((player) => result.updatedPlayerIds.includes(player.id));
  if (changedPlayers.length > 0) {
    upsertPlayerCatalogEntries(changedPlayers);
  }

  return {
    statsPath,
    updatedPlayerIds: [...result.updatedPlayerIds],
  };
}

export function importPlayerFlavorBatchFromFile(
  filePath: string,
  options: PlayerFlavorImportOptions & { statsPath?: string } = {},
) {
  const entries = loadPlayerFlavorImportEntriesFromFile(filePath);
  const players = options.players ?? loadImportedPlayerStats();
  const result = applyPlayerFlavorImport(entries, { ...options, players });
  const persistResult = persistPlayerFlavorImport(result, { statsPath: options.statsPath });
  return { ...result, ...persistResult };
}
