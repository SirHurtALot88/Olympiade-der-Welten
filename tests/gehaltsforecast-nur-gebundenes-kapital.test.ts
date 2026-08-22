/**
 * GEMELDET VON CHRIS: „im team reiter die gehaltsforecast grafik stimmt nicht, da ist ne preview
 * drin für Season 4 mit 5,1 und ich hab dann gar keinen spieler der 4 jahre drin hat. Da sollte
 * eigentlich 1 wert stehen und zwar der vom gebundenen kapital was wirklich real weg geht in der
 * jeweiligen saison."
 *
 * Der Chart zeichnete zwei Balken je Saison: das gebundene Kapital und daneben die Summe
 * INKLUSIVE der Verhandlungs-Entwürfe. Ein Entwurf wird beim Unterschreiben aber nie gelöscht —
 * er bleibt für immer im Spielstand. An Chris' Stand lagen neun davon, alle auf
 * `accepted_pending_confirm`, darunter Spieler mit längst laufendem Vertrag:
 *
 *     gebunden        12,52 | 7,87 | 5,19 | 0,00 | 0
 *     mit Entwürfen   42,59 | 20,56 | 18,50 | 5,13 | 0
 *
 * Die 5,13 in Saison 4 waren Lulu (1,10) und King Arlen (4,03) aus alten Entwürfen — Geld, das
 * niemand schuldet, in einer Saison, in der real nichts abfließt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SEASON_END_CONTRACT_TICK_STEP_ID } from "@/lib/contracts/saisonende-alterung-marke";
import type { ContractNegotiationDraft } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildTeamContractSeasonTable } from "@/lib/market/contract-negotiation-preview";

const panel = readFileSync(join(process.cwd(), "app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx"), "utf8");

/** Ein Spielstand in Saison 1, bei dem die Vertragsalterung bereits gelaufen ist. */
function saisonendeNachDerAlterung() {
  const gameState = structuredClone(createSingleplayerGameState());
  gameState.gamePhase = "season_end_management";
  gameState.seasonState.preSeasonWorkflowLogs = [
    ...(gameState.seasonState.preSeasonWorkflowLogs ?? []),
    {
      logId: "season-end-contract-tick__test",
      saveId: "test",
      fromSeasonId: gameState.season.id,
      toSeasonId: gameState.season.id,
      stepId: SEASON_END_CONTRACT_TICK_STEP_ID,
      status: "applied",
      createdAt: new Date(0).toISOString(),
    } as NonNullable<typeof gameState.seasonState.preSeasonWorkflowLogs>[number],
  ];
  return gameState;
}

/** Ein Entwurf, der über die gebundenen Laufzeiten hinausreicht — genau Chris' Saison-4-Fall. */
function entwurfUeberVierSaisons(teamId: string, playerId: string): ContractNegotiationDraft {
  return {
    draftId: `draft-${playerId}`,
    saveId: "test",
    seasonId: "season-1",
    teamId,
    playerId,
    playerName: "Entwurf",
    contractLength: 4,
    contractShape: "balanced",
    expectedSalary: 4,
    offeredSalary: 4,
    yearlySalarySchedule: [1, 1, 1, 4.03].map((salary, index) => ({
      yearIndex: index,
      seasonOffset: index,
      label: `Season ${index + 1}`,
      salary,
    })),
    totalSalary: 7.03,
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
  } satisfies ContractNegotiationDraft;
}

describe("Gehaltsforecast: das gebundene Kapital kennt keine Entwürfe", () => {
  it("ein Entwurf über vier Saisons hebt `totalsCommitted` nicht an", () => {
    const gameState = structuredClone(createSingleplayerGameState());
    const teamId = gameState.teams[0].teamId;
    const spieler = gameState.rosters.find((row) => row.teamId === teamId)!.playerId;

    const ohne = buildTeamContractSeasonTable({ gameState, teamId, seasonLabelBase: "Season 1" });
    gameState.seasonState.contractNegotiationDrafts = [entwurfUeberVierSaisons(teamId, spieler)];
    const mit = buildTeamContractSeasonTable({ gameState, teamId, seasonLabelBase: "Season 1" });

    expect(mit.totalsCommitted.map((entry) => entry.salary)).toEqual(
      ohne.totalsCommitted.map((entry) => entry.salary),
    );
  });

  it("`totalsWithPreview` zählt ihn weiterhin mit — die beiden Größen bleiben unterscheidbar", () => {
    // Der Entwurf verschwindet nicht aus den Daten; er gehört nur nicht in den Forecast.
    const gameState = structuredClone(createSingleplayerGameState());
    const teamId = gameState.teams[0].teamId;
    const spieler = gameState.rosters.find((row) => row.teamId === teamId)!.playerId;
    gameState.seasonState.contractNegotiationDrafts = [entwurfUeberVierSaisons(teamId, spieler)];

    const tabelle = buildTeamContractSeasonTable({ gameState, teamId, seasonLabelBase: "Season 1" });
    const gebundenS4 = tabelle.totalsCommitted[3]?.salary ?? 0;
    const mitEntwurfS4 = tabelle.totalsWithPreview[3]?.salary ?? 0;

    expect(mitEntwurfS4 - gebundenS4).toBeCloseTo(4.03, 2);
  });
});

describe("Der Chart zeichnet genau einen Balken je Saison", () => {
  it("die Geometrie bekommt nur das gebundene Kapital", () => {
    expect(panel).toContain(
      "const chart = buildContractForecastChartGeometry(\n                            selectedTeamContractTable.totalsCommitted,\n                          );",
    );
    expect(panel).toContain("function buildContractForecastChartGeometry(totalsCommitted) {");
  });

  it("es gibt keinen zweiten Balken und keine Preview-Beschriftung mehr", () => {
    expect(panel).not.toContain("is-preview\"");
    expect(panel).not.toContain("hasPreviewDelta");
    expect(panel).not.toContain("bar.previewValue");
  });
});

/**
 * DER ZWEITE HALBE FEHLER IM SELBEN CHART.
 *
 * `yearlySalarySchedule` traegt die NOCH OFFENEN Raten. Die Alterung laeuft am Ende einer Saison,
 * waehrend diese noch die laufende ist — danach gehoert die erste offene Rate zur KOMMENDEN
 * Saison. Der Chart klebte sie trotzdem auf die laufende. Damit bekam jede Rate das Etikett der
 * Vorsaison, und die letzte Vertragssaison fiel hinten heraus.
 *
 * An Chris' Spielstand stand fuer Saison 4 eine Null, obwohl Lulu und King Arlen dort zusammen
 * noch 5,19 kosten:
 *
 *     vorher    Season 1 12,52 | Season 2 7,87 | Season 3 5,19 | Season 4 0,00
 *     nachher   Season 2 12,52 | Season 3 7,87 | Season 4 5,19 | Season 5 0,00
 *
 * Saison 1 ist in diesem Fenster gespielt und bezahlt — sie taucht gar nicht mehr auf.
 */
describe("Die Saisonspalten treffen die Saison, in der das Geld abfliesst", () => {
  it("nach der Alterung beginnt der Forecast mit der KOMMENDEN Saison", () => {
    const gameState = saisonendeNachDerAlterung();
    const teamId = gameState.teams[0].teamId;
    const tabelle = buildTeamContractSeasonTable({ gameState, teamId, seasonLabelBase: "Season 1" });
    expect(tabelle.seasonLabels[0]).toBe("Season 2");
  });

  it("mitten in der Saison beginnt er weiterhin mit der laufenden", () => {
    const gameState = structuredClone(createSingleplayerGameState());
    const teamId = gameState.teams[0].teamId;
    const tabelle = buildTeamContractSeasonTable({ gameState, teamId, seasonLabelBase: "Season 1" });
    expect(tabelle.seasonLabels[0]).toBe("Season 1");
  });

  it("die letzte Vertragssaison faellt nicht mehr hinten heraus", () => {
    const gameState = saisonendeNachDerAlterung();
    const teamId = gameState.teams[0].teamId;
    // Ein Kaderspieler mit drei offenen Raten deckt nach der Alterung die Saisons 2, 3 und 4.
    const eintrag = gameState.rosters.find((row) => row.teamId === teamId)!;
    eintrag.yearlySalarySchedule = [2, 2, 4.03].map((salary, index) => ({
      yearIndex: index,
      seasonOffset: index,
      label: `Season ${index + 2}`,
      salary,
    }));

    const tabelle = buildTeamContractSeasonTable({ gameState, teamId, seasonLabelBase: "Season 1" });
    const saison4 = tabelle.totalsCommitted.find((eintragT) => eintragT.label === "Season 4");
    expect(saison4).toBeDefined();
    expect(saison4!.salary).toBeGreaterThanOrEqual(4.03);
  });
});
