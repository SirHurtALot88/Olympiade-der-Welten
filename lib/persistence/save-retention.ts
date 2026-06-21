import type Database from "better-sqlite3";

import type { SaveStatus } from "@/lib/persistence/types";

export type SaveRetentionBucket = "singleplayer" | "multiplayer";
export type SaveRetentionCategory =
  | "manual"
  | "autosave"
  | "pre-deploy"
  | "pre-season"
  | "post-season"
  | "emergency"
  | "recovery"
  | "legacy";

type MetadataPayload = {
  saveCategory?: unknown;
  scenarioMeta?: {
    saveCategory?: unknown;
    roomId?: unknown;
    roomCode?: unknown;
    roomParticipants?: unknown[];
    scenarioType?: unknown;
  } | null;
} | null;

type SaveRetentionRow = {
  save_id: string;
  status: SaveStatus;
  metadata_json: string | null;
};

const ROLLING_SAVE_LIMIT = 5;
const ROTATING_CATEGORIES = new Set<SaveRetentionCategory>([
  "autosave",
  "pre-deploy",
  "pre-season",
  "post-season",
  "legacy",
]);
const PROTECTED_CATEGORIES = new Set<SaveRetentionCategory>(["manual", "emergency", "recovery"]);
const SAVE_RETENTION_CATEGORIES: SaveRetentionCategory[] = [
  "manual",
  "autosave",
  "pre-deploy",
  "pre-season",
  "post-season",
  "emergency",
  "recovery",
  "legacy",
];

export function normalizeSaveRetentionCategory(value: unknown): SaveRetentionCategory {
  return SAVE_RETENTION_CATEGORIES.includes(value as SaveRetentionCategory)
    ? (value as SaveRetentionCategory)
    : "legacy";
}

export function parseSaveRetentionMetadata(value: string | null): MetadataPayload {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as MetadataPayload;
  } catch {
    return null;
  }
}

export function resolveSaveRetentionCategory(metadata: MetadataPayload): SaveRetentionCategory {
  return normalizeSaveRetentionCategory(metadata?.scenarioMeta?.saveCategory ?? metadata?.saveCategory);
}

export function resolveSaveRetentionBucket(metadata: MetadataPayload): SaveRetentionBucket {
  const meta = metadata?.scenarioMeta;
  const hasRoomContext = Boolean(
    meta?.roomId ||
      meta?.roomCode ||
      (Array.isArray(meta?.roomParticipants) && meta.roomParticipants.length > 0) ||
      meta?.scenarioType === "manager_multiplayer_test",
  );
  return hasRoomContext ? "multiplayer" : "singleplayer";
}

export function isProtectedSaveRetentionCategory(category: SaveRetentionCategory) {
  return PROTECTED_CATEGORIES.has(category);
}

export function enforceRollingSaveRetention(
  database: Database.Database,
  protectedSaveIds: string[] = [],
) {
  const rows = database
    .prepare(
      `SELECT saves.save_id, saves.status, game_metadata.payload_json AS metadata_json
       FROM saves
       LEFT JOIN game_metadata ON game_metadata.save_id = saves.save_id
       WHERE saves.status != 'template'
       ORDER BY saves.updated_at DESC, saves.created_at DESC, saves.save_id DESC`,
    )
    .all() as SaveRetentionRow[];

  const protectedSaveIdSet = new Set(protectedSaveIds);
  const rowsByRetentionKey = new Map<string, SaveRetentionRow[]>();

  for (const row of rows) {
    const metadata = parseSaveRetentionMetadata(row.metadata_json);
    const category = resolveSaveRetentionCategory(metadata);
    if (isProtectedSaveRetentionCategory(category)) {
      continue;
    }
    if (!ROTATING_CATEGORIES.has(category)) {
      continue;
    }

    const bucket = resolveSaveRetentionBucket(metadata);
    const retentionKey = `${bucket}:${category}`;
    rowsByRetentionKey.set(retentionKey, [...(rowsByRetentionKey.get(retentionKey) ?? []), row]);
  }

  const deleteStatement = database.prepare("DELETE FROM saves WHERE save_id = ?");

  for (const retentionRows of rowsByRetentionKey.values()) {
    if (retentionRows.length <= ROLLING_SAVE_LIMIT) {
      continue;
    }

    const keepIds = new Set<string>();

    for (const row of retentionRows) {
      if (protectedSaveIdSet.has(row.save_id) || row.status === "active") {
        keepIds.add(row.save_id);
      }
    }

    for (const row of retentionRows) {
      if (keepIds.size >= ROLLING_SAVE_LIMIT) {
        break;
      }
      keepIds.add(row.save_id);
    }

    for (const row of retentionRows) {
      if (!keepIds.has(row.save_id)) {
        deleteStatement.run(row.save_id);
      }
    }
  }
}
