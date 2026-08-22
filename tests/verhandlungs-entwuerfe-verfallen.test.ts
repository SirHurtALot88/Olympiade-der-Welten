/**
 * WANN EIN VERHANDLUNGS-ENTWURF STIRBT.
 *
 * Ein `contractNegotiationDraft` ist EINE Verhandlung: Season, Team, Spieler — so ist auch seine
 * `draftId` gebaut. Geschrieben wurde er bisher nur, entfernt nie. An Chris' Spielstand lagen
 * neun Stück herum, in zwei Sorten:
 *
 *   VERBRAUCHT — die Verhandlung endete mit einer Unterschrift. King Arlen ist der Beleg: sein
 *     Vertrag ist exakt der Entwurfsplan ohne die erste Rate.
 *
 *         Entwurf  LZ 4   2,17 | 2,79 | 3,41 | 4,03
 *         Vertrag  LZ 3          2,79 | 3,41 | 4,03
 *
 *   ABGEBROCHEN — fünf Kaufgespräche für Spieler, die in keinem Kader stehen. Nie bestätigt.
 *
 * Ein liegengebliebener Entwurf ist nicht bloß Zierrat: `affrontRetreat` liest sein altes Angebot,
 * der Trotz-Aufschlag wird aus ihm fortgeschrieben, und die Verträge-Tabelle zeigt ihn als
 * Vorschauzeile. Eine abgeschlossene Verhandlung redet damit in die nächste hinein.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { entferneEntwurfNachUnterschrift } from "@/lib/contracts/verhandlungs-entwuerfe";
import type { ContractNegotiationDraft, GameState } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";

function entwurf(teil: Partial<ContractNegotiationDraft>): ContractNegotiationDraft {
  return {
    draftId: `contract-draft:season-1:${teil.teamId}:${teil.playerId}`,
    saveId: "test",
    seasonId: "season-1",
    teamId: "T-1",
    playerId: "p-1",
    playerName: "Wer",
    contractLength: 2,
    contractShape: "balanced",
    expectedSalary: 2,
    offeredSalary: 2,
    yearlySalarySchedule: [],
    totalSalary: 4,
    roundingAdjustment: null,
    buyoutCost: null,
    bracket: null,
    teamFit: null,
    acceptanceScore: null,
    acceptChance: null,
    counterChance: null,
    rejectChance: null,
    reasons: [],
    warnings: [],
    blockingReasons: [],
    status: "accepted_pending_confirm",
    ...teil,
  } as ContractNegotiationDraft;
}

function mitEntwuerfen(entwuerfe: ContractNegotiationDraft[]): GameState {
  const gameState = structuredClone(createSingleplayerGameState());
  gameState.seasonState.contractNegotiationDrafts = entwuerfe;
  return gameState;
}

describe("Nach der Unterschrift ist der Entwurf weg", () => {
  it("der Entwurf des unterschreibenden Spielers verschwindet", () => {
    const gameState = mitEntwuerfen([entwurf({ teamId: "T-1", playerId: "p-1" })]);

    const nachher = entferneEntwurfNachUnterschrift(gameState, { teamId: "T-1", playerId: "p-1" });

    expect(nachher.seasonState.contractNegotiationDrafts).toEqual([]);
  });

  it("Entwürfe anderer Spieler und anderer Teams bleiben stehen", () => {
    // Sonst räumte eine Unterschrift die laufenden Gespräche des Managers mit weg.
    const gameState = mitEntwuerfen([
      entwurf({ teamId: "T-1", playerId: "p-1" }),
      entwurf({ teamId: "T-1", playerId: "p-2" }),
      entwurf({ teamId: "T-2", playerId: "p-1" }),
    ]);

    const nachher = entferneEntwurfNachUnterschrift(gameState, { teamId: "T-1", playerId: "p-1" });

    expect(
      (nachher.seasonState.contractNegotiationDrafts ?? []).map((e) => `${e.teamId}/${e.playerId}`),
    ).toEqual(["T-1/p-2", "T-2/p-1"]);
  });

  it("`rejected_bad_experience` überlebt — das ist Groll, kein Verhandlungsgedächtnis", () => {
    const gameState = mitEntwuerfen([
      entwurf({ teamId: "T-1", playerId: "p-1", status: "rejected_bad_experience" }),
    ]);

    const nachher = entferneEntwurfNachUnterschrift(gameState, { teamId: "T-1", playerId: "p-1" });

    expect(nachher.seasonState.contractNegotiationDrafts).toHaveLength(1);
  });

  it("ohne passenden Entwurf bleibt derselbe Spielstand stehen", () => {
    const gameState = mitEntwuerfen([entwurf({ teamId: "T-2", playerId: "p-9" })]);
    // Identität, nicht nur Gleichheit: ohne Änderung darf kein neues Objekt entstehen.
    expect(entferneEntwurfNachUnterschrift(gameState, { teamId: "T-1", playerId: "p-1" })).toBe(gameState);
  });
});

describe("Der Unterschriftspfad ruft das auch wirklich auf", () => {
  const kauf = readFileSync(join(process.cwd(), "lib/market/transfermarkt-local-service.ts"), "utf8");
  const verlaengerung = readFileSync(join(process.cwd(), "lib/contracts/contract-renewal-service.ts"), "utf8");
  const saisonwechsel = readFileSync(join(process.cwd(), "lib/season/preseason-workflow-service.ts"), "utf8");

  it("der Transferkauf räumt den Entwurf weg", () => {
    expect(kauf).toContain("entferneEntwurfNachUnterschrift(");
  });

  it("die Verlängerung räumt den Entwurf weg", () => {
    expect(verlaengerung).toContain("entferneEntwurfNachUnterschrift(gameState, {");
  });

  it("der Saisonwechsel leert die Entwürfe der alten Saison", () => {
    // Die abgebrochenen Gespräche kommen hier weg — kein Unterschriftspfad wird sie je anfassen.
    expect(saisonwechsel).toContain("contractNegotiationDrafts: [],");
  });
});
