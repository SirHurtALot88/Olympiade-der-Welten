/**
 * Nachverhandeln über den ECHTEN Schreib-/Lesepfad (verhandlung-rework.md Abschnitt 9.3,
 * Nachtrag 10.11.).
 *
 * GEMELDET (Chris, 10.11.): „wenn ich im transfermarkt nachverhandle, und dem spieler entgegen
 * komme beharren alle immer auf ihrer forderung, sie verhandlne gar nicht richtig".
 *
 * `tests/verhandlung-trotz-erwiderung.test.ts` prüft die Erwiderung an der reinen Vorschau-Funktion
 * mit handgefüttertem `lastCounterSalary` — und war grün, während das Spiel niemanden entgegenkommen
 * ließ. Die Lücke lag zwischen den Schichten: der Verhandeln-Klick schreibt den Draft über
 * `/api/singleplayer-state`, die nächste Vorschau liest ihn über den Markt-Service. Dieser Test
 * fährt genau diesen Weg: Vorschau (Service) → Verhandeln (Route, echter Draft-Bau) → höheres
 * Angebot → Vorschau (Service), mit einem Persistenz-Double, das den Spielstand wirklich hält.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";
import type { TransfermarktBuyPreview } from "@/lib/market/transfermarkt-buy-service";
import { withNormalizedTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { withNormalizedTeamGeneralManagers } from "@/lib/foundation/team-general-managers";
import { withNormalizedTeamIdentityOverrides } from "@/lib/foundation/team-identity-settings";
import { withNormalizedTeamStrategyProfiles } from "@/lib/foundation/team-strategy-profiles";

const store = {
  saves: new Map<string, { saveId: string; name: string; gameState: GameState }>(),
};

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById: (saveId: string) => store.saves.get(saveId) ?? null,
    getActiveSave: () => [...store.saves.values()][0] ?? null,
    bootstrapSingleplayerSave: () => ({ save: [...store.saves.values()][0] ?? null, createdFromSeed: false }),
    listSaves: () => [],
    saveSingleplayerState: (saveId: string, gameState: GameState) => {
      const previous = store.saves.get(saveId);
      // Wie die echte Persistenz: jede Speicherung zählt die Version hoch (Cache-Schlüssel!).
      const next = {
        saveId,
        name: previous?.name ?? saveId,
        gameState: { ...gameState, saveVersion: (previous?.gameState.saveVersion ?? 0) + 1 },
      };
      store.saves.set(saveId, next);
      return next;
    },
  }),
}));

const TEAM_ID = "A-A";
const SEASON_ID = "season-1";

function createTeam(): Team {
  return {
    teamId: TEAM_ID,
    shortCode: TEAM_ID,
    name: "Armageddon Aftermath",
    budget: 400,
    cash: 400,
    identityId: TEAM_ID,
    humanControlled: true,
    rosterLimit: 14,
    logoPath: null,
  };
}

function createPlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    rating: 50,
    marketValue: 20,
    salaryDemand: 10,
    displayMarketValue: 20,
    displaySalary: 10,
    pps: null,
    ovr: null,
    className: "Berserker",
    race: "Human",
    alignment: "N",
    gender: "f",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: { pow: 10, spe: 10, men: 10, soc: 10 },
    preferredDisciplineIds: [],
    disciplineRatings: { d1: 10, d2: 10 },
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
    ...partial,
  } as Player;
}

/** Saison 1, Spieltag 1 offen: das Kauffenster (`isEarlySeasonTransferSetup`). */
function createGameState(players: Player[]): GameState {
  return {
    season: { id: SEASON_ID, name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    gamePhase: "season_active",
    saveVersion: 1,
    seasonState: {
      seasonId: SEASON_ID,
      schedule: [],
      standings: { [TEAM_ID]: { points: 0 } },
      contractNegotiationDrafts: [],
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [createTeam()],
    teamIdentities: [],
    players,
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 1,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  } as unknown as GameState;
}

let POST: typeof import("@/app/api/singleplayer-state/route").POST;
let previewLocalTransfermarktBuy: typeof import("@/lib/market/transfermarkt-local-service").previewLocalTransfermarktBuy;

beforeAll(async () => {
  ({ POST } = await import("@/app/api/singleplayer-state/route"));
  ({ previewLocalTransfermarktBuy } = await import("@/lib/market/transfermarkt-local-service"));
}, 60_000);

let saveCounter = 0;
let saveId = "";

beforeEach(() => {
  // Eigene saveId je Test: die Markt-Caches hängen an saveId + Inhaltssignatur.
  saveCounter += 1;
  saveId = `save-nachverhandeln-${saveCounter}`;
  store.saves.clear();
  store.saves.set(saveId, {
    saveId,
    name: saveId,
    // Schon so normalisiert, wie die Route jeden Spielstand schreibt (GM, Strategieprofil …) —
    // sonst verschöbe erst der Verhandeln-Schreibzugriff die Forderung, und der Test mäße die
    // Fixture statt der Erwiderung.
    gameState: withNormalizedTeamStrategyProfiles(
      withNormalizedTeamControlSettings(
        withNormalizedTeamGeneralManagers(
          withNormalizedTeamIdentityOverrides(createGameState([createPlayer("fa-normal", { name: "Umbros" })])),
        ),
      ),
    ),
  });
});

function vorschau(offeredSalary?: number): TransfermarktBuyPreview {
  return previewLocalTransfermarktBuy({
    saveId,
    seasonId: SEASON_ID,
    teamId: TEAM_ID,
    playerId: "fa-normal",
    ...(offeredSalary != null ? { offeredSalary } : {}),
  });
}

/** Der Verhandeln-Klick, so wie `negotiateBuy()` ihn an den Server schickt. */
async function verhandeln(summary: TransfermarktBuyPreview, status: "countered" | "accepted_pending_confirm") {
  const response = await POST(
    new Request("http://localhost/api/singleplayer-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "contract-negotiation-outcome",
        saveId,
        teamId: TEAM_ID,
        activeManagerTeamId: TEAM_ID,
        summary,
        status,
        extraWarnings: [],
      }),
    }),
  );
  expect(response.status).toBe(200);
}

function geld(value: number) {
  return Number(value.toFixed(2));
}

describe("Nachverhandeln: Vorschau → Verhandeln (Route) → höheres Angebot → Vorschau", () => {
  it("er kommt entgegen, wenn ihr nachlegt — über den gespeicherten Draft, nicht über handgefütterte Werte", async () => {
    const forderung = vorschau().expectedSalary!;
    expect(forderung).toBeGreaterThan(0);

    const runde1 = vorschau(geld(forderung * 0.9));
    expect(runde1.verdict).toBe("counter_money");
    expect(runde1.concededFromLastCounter ?? false).toBe(false);
    const erstesWort = runde1.counterSalary!;

    await verhandeln(runde1, "countered");

    // Der Draft steht wirklich im Spielstand — mit seinem letzten Wort.
    const draft = store.saves.get(saveId)!.gameState.seasonState.contractNegotiationDrafts?.[0];
    expect(draft?.status).toBe("countered");
    expect(draft?.lastCounterSalary).toBe(erstesWort);
    expect(draft?.offeredSalary).toBe(geld(forderung * 0.9));

    // Entgegenkommen: ein echter Schritt (deutlich über 1 % der Forderung), aber unter seinem Wort.
    const nachgelegt = geld(forderung * 0.9 + (erstesWort - forderung * 0.9) * 0.4);
    const runde2 = vorschau(nachgelegt);
    expect(runde2.concededFromLastCounter).toBe(true);
    if (runde2.verdict === "counter_money") {
      expect(runde2.counterSalary!).toBeLessThan(erstesWort);
    } else {
      // Bagatelle-Zusage nach dem Entgegenkommen ist ebenfalls ein Nachgeben.
      expect(runde2.verdict).toBe("accept");
    }
  });

  it("ohne gespeicherten Draft gibt es nichts zu erwidern — genau das sah die Vorschau, die vor dem Speichern fragte", async () => {
    // Das ist der Live-Befund: der Klick schrieb per `void fetch`, das Speichern brauchte am vollen
    // Spielstand Sekunden, und die Vorschau zum nachgelegten Angebot kam schneller. Sie rechnete
    // gedächtnislos — kein Entgegenkommen. Der Client wartet deshalb auf den Schreibzugriff.
    const forderung = vorschau().expectedSalary!;
    const runde1 = vorschau(geld(forderung * 0.9));
    expect(runde1.verdict).toBe("counter_money");
    const nachgelegt = geld(forderung * 0.9 + (runde1.counterSalary! - forderung * 0.9) * 0.4);

    const zuFrueh = vorschau(nachgelegt);
    expect(zuFrueh.concededFromLastCounter ?? false).toBe(false);

    await verhandeln(runde1, "countered");
    const danach = vorschau(nachgelegt);
    expect(danach.concededFromLastCounter).toBe(true);
  });

  it("ein Angebot in Höhe des Grundgehalts bekommt seine eigene Vorschau, nicht die des Forderungs-Angebots", () => {
    // Der Vorschau-Cache schlüsselte „kein Angebot" als `salary` (Grundgehalt). Wer genau das
    // Grundgehalt tippte, bekam die Vorschau mit der FORDERUNG als Angebot zurück — und der
    // Verhandeln-Klick schrieb sie als eigenes Angebot in den Draft — jedes spätere Nachlegen galt
    // dann als Rückzieher. Am Spielstand gefunden bei Nekara: 0,9 x Forderung = Grundgehalt.
    const ohne = vorschau();
    const grundgehalt = ohne.salary!;
    expect(grundgehalt).not.toBe(ohne.expectedSalary);
    const getippt = vorschau(grundgehalt);
    expect(getippt.offeredSalary).toBe(grundgehalt);
  });
});

describe("Der Client fragt die Vorschau erst nach dem Speichern des Verhandeln-Klicks", () => {
  const quelle = readFileSync(join(process.cwd(), "app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx"), "utf8");

  it("merkt sich den laufenden Schreibzugriff und wartet in der Vorschau darauf", () => {
    expect(quelle).toContain("negotiationWriteRef.current = write;");
    const vorschauFetch = quelle.indexOf('const response = await fetch("/api/transfermarkt/buy", {');
    const warten = quelle.lastIndexOf("await pendingWrite", vorschauFetch);
    expect(warten).toBeGreaterThan(0);
    expect(vorschauFetch - warten).toBeLessThan(600);
  });

  it("holt nach einem Gegenangebot die Vorschau neu, sobald der Draft gespeichert ist", () => {
    const start = quelle.indexOf('if (verdict === "counter_money") {');
    const block = quelle.slice(start, start + 800);
    expect(block).toContain('persistNegotiationOutcome(buyPreview, "countered").then(');
    expect(block).toContain("setBuyPreviewRefreshNonce");
  });
});
