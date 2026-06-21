import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { enforceRollingSaveRetention } from "@/lib/persistence/save-repository";
import { getDatabase, resetDatabaseForTests } from "@/lib/persistence/sqlite";

beforeEach(() => {
  resetDatabaseForTests();
});

afterEach(() => {
  resetDatabaseForTests();
});

function insertSave(input: {
  saveId: string;
  index: number;
  status?: "active" | "archived" | "template";
  mode: "singleplayer" | "multiplayer";
  saveCategory?: "manual" | "autosave" | "pre-deploy" | "pre-season" | "post-season" | "emergency" | "recovery";
}) {
  const database = getDatabase();
  const timestamp = new Date(Date.UTC(2026, 0, 1, 0, input.index)).toISOString();
  database
    .prepare(
      `INSERT INTO saves (save_id, name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(input.saveId, input.saveId, input.status ?? "archived", timestamp, timestamp);

  const scenarioMeta =
    input.mode === "multiplayer"
      ? {
          scenarioType: "manager_multiplayer_test",
          label: "Multiplayer",
          createdAt: timestamp,
          roomCode: `ROOM-${input.index}`,
          roomParticipants: [
            {
              participantId: "p1",
              userId: "u1",
              displayName: "Chris",
              role: "host",
              connectionStatus: "online",
              controlledTeamIds: ["M-M"],
              readyState: "not_ready",
              lastSeenAt: timestamp,
            },
          ],
        }
      : {
          scenarioType: "new_game",
          label: "Singleplayer",
          createdAt: timestamp,
        };
  if (input.saveCategory) {
    Object.assign(scenarioMeta, { saveCategory: input.saveCategory });
  }

  database
    .prepare("INSERT INTO game_metadata (save_id, payload_json) VALUES (?, ?)")
    .run(input.saveId, JSON.stringify({ scenarioMeta }));
}

function listRemainingSaveIds() {
  return (getDatabase().prepare("SELECT save_id FROM saves ORDER BY save_id ASC").all() as Array<{ save_id: string }>).map(
    (row) => row.save_id,
  );
}

describe("rolling save retention", () => {
  it("keeps five saves per game mode instead of five saves globally", () => {
    for (let index = 0; index < 7; index += 1) {
      insertSave({
        saveId: `single-${index}`,
        index,
        status: index === 0 ? "active" : "archived",
        mode: "singleplayer",
      });
      insertSave({
        saveId: `multi-${index}`,
        index,
        status: index === 0 ? "active" : "archived",
        mode: "multiplayer",
      });
    }

    enforceRollingSaveRetention(getDatabase());

    const remainingSaveIds = listRemainingSaveIds();
    expect(remainingSaveIds.filter((saveId) => saveId.startsWith("single-"))).toEqual([
      "single-0",
      "single-3",
      "single-4",
      "single-5",
      "single-6",
    ]);
    expect(remainingSaveIds.filter((saveId) => saveId.startsWith("multi-"))).toEqual([
      "multi-0",
      "multi-3",
      "multi-4",
      "multi-5",
      "multi-6",
    ]);
  });

  it("does not count template saves against the rolling limit", () => {
    for (let index = 0; index < 6; index += 1) {
      insertSave({ saveId: `single-${index}`, index, mode: "singleplayer" });
    }
    insertSave({ saveId: "template-base", index: 0, status: "template", mode: "singleplayer" });

    enforceRollingSaveRetention(getDatabase());

    expect(listRemainingSaveIds()).toContain("template-base");
    expect(listRemainingSaveIds().filter((saveId) => saveId.startsWith("single-"))).toHaveLength(5);
  });

  it("never deletes manual saves while rotating autosaves", () => {
    for (let index = 0; index < 7; index += 1) {
      insertSave({
        saveId: `manual-${index}`,
        index,
        mode: "singleplayer",
        saveCategory: "manual",
      });
      insertSave({
        saveId: `autosave-${index}`,
        index,
        mode: "singleplayer",
        saveCategory: "autosave",
      });
    }

    enforceRollingSaveRetention(getDatabase());

    const remainingSaveIds = listRemainingSaveIds();
    expect(remainingSaveIds.filter((saveId) => saveId.startsWith("manual-"))).toEqual([
      "manual-0",
      "manual-1",
      "manual-2",
      "manual-3",
      "manual-4",
      "manual-5",
      "manual-6",
    ]);
    expect(remainingSaveIds.filter((saveId) => saveId.startsWith("autosave-"))).toEqual([
      "autosave-2",
      "autosave-3",
      "autosave-4",
      "autosave-5",
      "autosave-6",
    ]);
  });

  it("rotates autosaves and pre-deploy saves independently per category", () => {
    for (let index = 0; index < 7; index += 1) {
      insertSave({
        saveId: `autosave-${index}`,
        index,
        mode: "singleplayer",
        saveCategory: "autosave",
      });
      insertSave({
        saveId: `pre-deploy-${index}`,
        index,
        mode: "singleplayer",
        saveCategory: "pre-deploy",
      });
    }

    enforceRollingSaveRetention(getDatabase());

    const remainingSaveIds = listRemainingSaveIds();
    expect(remainingSaveIds.filter((saveId) => saveId.startsWith("autosave-"))).toEqual([
      "autosave-2",
      "autosave-3",
      "autosave-4",
      "autosave-5",
      "autosave-6",
    ]);
    expect(remainingSaveIds.filter((saveId) => saveId.startsWith("pre-deploy-"))).toEqual([
      "pre-deploy-2",
      "pre-deploy-3",
      "pre-deploy-4",
      "pre-deploy-5",
      "pre-deploy-6",
    ]);
  });
});
