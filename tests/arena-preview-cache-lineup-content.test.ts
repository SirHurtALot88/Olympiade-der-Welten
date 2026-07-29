import { describe, expect, it } from "vitest";

import { buildSaveContentSignature } from "@/lib/persistence/save-content-signature";
import { buildMatchdayResolveSignature } from "@/lib/foundation/matchday-resolve-snapshot";
import { readArenaPreviewCache, writeArenaPreviewCache, invalidateArenaPreviewCache } from "@/lib/foundation/arena-preview-cache";

// Der Arena-Cache haengt an der Save-Content-Signatur. Die kennt von den Aufstellungen
// aber nur die ANZAHL (`lineupDraftCount`) — nicht ihren Inhalt. Aendert sich eine
// Aufstellung, ohne dass ein Draft dazukommt oder wegfaellt (Umstellen der eigenen
// Elf, Ueberschreiben durch den AI-Batch), bleibt die alte Vorschau stehen: die Arena
// zeigt dann etwas anderes, als tatsaechlich aufgestellt ist.

const scope = { saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-1" };

function signatureInput(lineupDraftCount: number) {
  return {
    seasonId: scope.seasonId,
    matchdayId: scope.matchdayId,
    saveVersion: 7,
    lineupDraftCount,
    transferHistoryCount: 0,
    matchdayResults: [],
    standingsApplyLogs: [],
    seasonSnapshots: [],
    disciplineResults: [],
  };
}

function gameStateWithLineup(playerIds: string[]) {
  return {
    seasonState: {
      lineupDrafts: [
        {
          teamId: "C-C",
          seasonId: scope.seasonId,
          matchdayId: scope.matchdayId,
          status: "saved",
          entries: playerIds.map((playerId, slotIndex) => ({
            playerId,
            slotIndex,
            disciplineId: "hockey",
            disciplineSide: "d1",
          })),
          modifiers: null,
        },
      ],
      playerAvailabilityState: {},
    },
  } as never;
}

describe("Save-Content-Signatur und Aufstellungs-Inhalt", () => {
  it("bleibt gleich, obwohl eine andere Elf aufgestellt ist", () => {
    // Genau die Luecke: gleiche Anzahl Drafts, komplett andere Aufstellung.
    const before = buildSaveContentSignature(signatureInput(32));
    const after = buildSaveContentSignature(signatureInput(32));
    expect(after).toBe(before);
  });

  it("die Matchday-Resolve-Signatur sieht den Unterschied dagegen sehr wohl", () => {
    const before = buildMatchdayResolveSignature(gameStateWithLineup(["p1", "p2", "p3"]), scope);
    const after = buildMatchdayResolveSignature(gameStateWithLineup(["p1", "p2", "p9"]), scope);
    expect(after).not.toBe(before);
  });
});

describe("Arena-Vorschau-Cache", () => {
  it("darf eine geaenderte Aufstellung nicht aus dem Cache beantworten", () => {
    invalidateArenaPreviewCache();
    const cacheKey = `${scope.saveId}:${scope.seasonId}:${scope.matchdayId}`;

    const oldLineup = gameStateWithLineup(["p1", "p2", "p3"]);
    const newLineup = gameStateWithLineup(["p1", "p2", "p9"]);

    // Vorschau zur alten Aufstellung ablegen — mit der Signatur, die der Arena-Dienst
    // benutzen MUSS, damit der Cache Inhaltsaenderungen ueberhaupt bemerken kann.
    writeArenaPreviewCache(cacheKey, buildMatchdayResolveSignature(oldLineup, scope), { marker: "alte-aufstellung" });

    expect(readArenaPreviewCache(cacheKey, buildMatchdayResolveSignature(oldLineup, scope))).toEqual({
      marker: "alte-aufstellung",
    });
    // Nach dem Umstellen darf nichts mehr aus dem Cache kommen → es wird neu gerechnet.
    expect(readArenaPreviewCache(cacheKey, buildMatchdayResolveSignature(newLineup, scope))).toBeNull();
  });
});

describe("Arena-Dienst benutzt die inhaltsbewusste Signatur", () => {
  it("keyt Resolve- und Standings-Cache nicht mehr allein an der Save-Content-Signatur", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await fs.readFile(
      path.join(process.cwd(), "lib/foundation/matchday-arena-base-service.ts"),
      "utf8",
    );

    expect(source).toContain("buildMatchdayResolveSignature(");
    // Die reine Save-Signatur reicht nicht: sie zaehlt Drafts nur.
    expect(source).not.toContain("const cacheSignature = contentSignature ??");
  });
});
