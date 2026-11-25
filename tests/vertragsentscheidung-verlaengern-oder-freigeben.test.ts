/**
 * VERLÄNGERN ODER FREIGEBEN (Chris 19.11.): „du kannst gar nicht einfach das aussitzen, sondern du musst entweder verlängern oder
 * ihn freigeben. Wenn du ihn freigibst, dann wird er zu seinem aktuellen Ablösesatz verkauft […]. Und wenn du ihn verlängerst,
 * dann bleibt er halt noch länger da."
 *
 * Geprüft am echten Vertragsweg (Alterung → offene Entscheidung → Freigeben/Verlängern), an der Delegation, am Nachholen eines
 * Altstands mitten in der Saison und an der Verdrahtung im Saisonfinale. Die Sperre des Saisonwechsels selbst steht in
 * tests/preseason-workflow-service.test.ts („Saisonwechsel: auslaufende Verträge …“).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  applyContractRenewalAction,
  applySeasonEndContractTick,
  previewContractRenewalAction,
  previewSeasonEndContracts,
} from "@/lib/contracts/contract-renewal-service";
import {
  istVertragsentscheidungNachzuholen,
  offeneVertragsentscheidungen,
  vertragsentscheidungSperrgruende,
  darfVertragsentscheidungTrotzPhase,
} from "@/lib/contracts/vertragsentscheidung";
import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

const MENSCH = "H-U";
const KI = "K-I";

function team(teamId: string, humanControlled: boolean): Team {
  return { teamId, shortCode: teamId, name: teamId, budget: 100, cash: 100, identityId: teamId, humanControlled, rosterLimit: 12, logoPath: null };
}

function spieler(id: string): Player {
  return {
    id,
    name: `Spieler ${id}`,
    rating: 70,
    marketValue: 40,
    salaryDemand: 7,
    displayMarketValue: 40,
    displaySalary: 7,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "f",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: { climb: 70, chess: 65 },
    disciplineTierCounts: { above20: 2, above40: 2, above60: 2, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  } as Player;
}

function vertrag(teamId: string, playerId: string, partial: Partial<RosterEntry> = {}): RosterEntry {
  return {
    id: `roster:${teamId}:${playerId}`,
    teamId,
    playerId,
    contractLength: 1,
    salary: 7,
    upkeep: 7,
    purchasePrice: 30,
    currentValue: 40,
    joinedSeasonId: "season-1",
    ...partial,
  };
}

function stand(input: {
  phase?: GameState["gamePhase"];
  seasonId?: string;
  rosters: RosterEntry[];
  menschDelegiert?: boolean;
}): GameState {
  const teams = [team(MENSCH, true), team(KI, false)];
  const seasonId = input.seasonId ?? "season-1";
  return {
    gamePhase: input.phase ?? "season_end_management",
    season: { id: seasonId, name: seasonId === "season-1" ? "Season 1" : "Season 2", year: 2026, currentMatchday: 10, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId,
      schedule: [],
      standings: Object.fromEntries(teams.map((t) => [t.teamId, { points: 0 }])),
      teamControlSettings: Object.fromEntries(
        teams.map((t) => [
          t.teamId,
          {
            teamId: t.teamId,
            controlMode: t.humanControlled ? "manual" : "ai",
            ownerId: t.humanControlled ? "user_local" : "ai",
            ...(t.humanControlled && input.menschDelegiert ? { delegation: { stufe: "voll_ki", bereiche: {} } } : {}),
            aiLineupPreviewEnabled: !t.humanControlled,
            aiLineupAutoApplyEnabled: false,
            aiTransferPreviewEnabled: !t.humanControlled,
            aiTransferAutoApplyEnabled: false,
            aiSellPreviewEnabled: !t.humanControlled,
            aiSellAutoApplyEnabled: false,
          },
        ]),
      ),
    },
    matchdayState: { matchdayId: "matchday-1", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams,
    teamIdentities: [],
    players: input.rosters.map((entry) => spieler(entry.playerId)),
    disciplines: [],
    rosters: input.rosters,
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerProgressionEvents: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 2,
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

function alsSave(gameState: GameState): PersistedSaveGame {
  return { saveId: "vertrag-test", name: "Vertragstest", status: "active", createdAt: "", updatedAt: "", gameState };
}

function ablage() {
  return { saveSingleplayerState: vi.fn() } as unknown as PersistenceService;
}

/** Fährt die Alterung („Verträge öffnen“) und gibt den geschriebenen Stand zurück. */
function nachDerAlterung(gameState: GameState): GameState {
  const save = alsSave(gameState);
  const persistence = ablage();
  const ergebnis = applySeasonEndContractTick(save, previewSeasonEndContracts(save).confirmToken, persistence);
  expect(ergebnis.applied).toBe(true);
  return vi.mocked(persistence.saveSingleplayerState).mock.calls[0]![1] as GameState;
}

describe("Welche Entscheidungen offen sind", () => {
  it("Mensch: der auslaufende Vertrag ist vor und nach der Alterung offen; KI-Teams und laufende Verträge nicht", () => {
    const vorher = stand({
      phase: "season_review",
      rosters: [vertrag(MENSCH, "m1"), vertrag(MENSCH, "m2", { contractLength: 3 }), vertrag(KI, "k1")],
    });
    expect(offeneVertragsentscheidungen(vorher).map((e) => e.playerId)).toEqual(["m1"]);
    expect(vertragsentscheidungSperrgruende(vorher)).toEqual([`vertragsentscheidung_offen:${MENSCH}:1`]);

    const nachher = nachDerAlterung({ ...vorher, gamePhase: "season_end_management" });
    expect(nachher.rosters.find((e) => e.playerId === "m1")?.contractStatus).toBe("renewal_pending");
    expect(offeneVertragsentscheidungen(nachher).map((e) => e.playerId)).toEqual(["m1"]);
  });

  it("delegiert der Mensch „Käufe, Verkäufe und Verträge“, entscheidet die KI beim Altern — es bleibt nichts offen", () => {
    const vorher = stand({ rosters: [vertrag(MENSCH, "m1")], menschDelegiert: true });
    const zeile = previewSeasonEndContracts(alsSave(vorher)).rows.find((row) => row.playerId === "m1");
    expect(zeile?.controlMode).toBe("ai");
    expect(zeile?.recommendedAction).not.toBe("manual_decision");
    expect(offeneVertragsentscheidungen(vorher)).toEqual([]);

    const nachher = nachDerAlterung(vorher);
    const eintrag = nachher.rosters.find((e) => e.playerId === "m1");
    // Verlängert oder freigegeben — nie stehengelassen.
    if (eintrag) expect(eintrag.contractStatus).not.toBe("renewal_pending");
    expect(offeneVertragsentscheidungen(nachher)).toEqual([]);
  });

  it("ohne Delegation bleibt es die Entscheidung des Menschen (`manual_decision`)", () => {
    const zeile = previewSeasonEndContracts(alsSave(stand({ rosters: [vertrag(MENSCH, "m1")] }))).rows.find(
      (row) => row.playerId === "m1",
    );
    expect(zeile?.controlMode).toBe("manual");
    expect(zeile?.recommendedAction).toBe("manual_decision");
  });
});

describe("Freigeben und Verlängern lösen die Entscheidung", () => {
  it("Freigeben verkauft zum aktuellen Verkaufspreis: Erlös gebucht, Spieler weg, nichts mehr offen", () => {
    const gs = nachDerAlterung(stand({ rosters: [vertrag(MENSCH, "m1")] }));
    const save = alsSave(gs);
    const persistence = ablage();
    const vorschau = previewContractRenewalAction({ save, teamId: MENSCH, playerId: "m1", action: "release" });
    const ergebnis = applyContractRenewalAction({
      save,
      teamId: MENSCH,
      playerId: "m1",
      action: "release",
      confirmToken: vorschau.confirmToken,
      persistence,
      source: "manual_player_release",
    });
    expect(ergebnis.applied).toBe(true);
    const danach = vi.mocked(persistence.saveSingleplayerState).mock.calls[0]![1] as GameState;
    const ereignis = danach.seasonState.contractEvents?.at(-1);
    expect(ereignis?.eventType).toBe("player_released");
    // Erlös = Marktwert × Verkaufsfaktor, auf das Konto gebucht (wie im Verkaufs-Popup).
    expect(ereignis?.exitValue).toBeGreaterThan(0);
    expect(ereignis?.exitValue).toBeLessThanOrEqual(40);
    const kasseVorher = gs.teams.find((t) => t.teamId === MENSCH)!.cash;
    expect(danach.teams.find((t) => t.teamId === MENSCH)!.cash).toBeCloseTo(kasseVorher + ereignis!.exitValue!, 2);
    expect(danach.rosters.some((e) => e.playerId === "m1")).toBe(false);
    expect(offeneVertragsentscheidungen(danach)).toEqual([]);
  });

  it("Verlängern (Gehaltsverhandlung) schreibt einen neuen Vertrag über die Saison hinaus — nichts mehr offen", () => {
    const gs = nachDerAlterung(stand({ rosters: [vertrag(MENSCH, "m1")] }));
    const save = alsSave(gs);
    const persistence = ablage();
    const vorschau = previewContractRenewalAction({ save, teamId: MENSCH, playerId: "m1", action: "renew", contractLength: 2, offeredSalary: 8 });
    const ergebnis = applyContractRenewalAction({
      save,
      teamId: MENSCH,
      playerId: "m1",
      action: "renew",
      contractLength: 2,
      offeredSalary: 8,
      confirmToken: vorschau.confirmToken,
      persistence,
      source: "manual_contract_renewal",
    });
    expect(ergebnis.applied).toBe(true);
    const danach = vi.mocked(persistence.saveSingleplayerState).mock.calls[0]![1] as GameState;
    expect(danach.rosters.find((e) => e.playerId === "m1")?.contractLength).toBe(2);
    expect(offeneVertragsentscheidungen(danach)).toEqual([]);
    expect(vertragsentscheidungSperrgruende(danach)).toEqual([]);
  });
});

describe("Altstand: Entscheidung in der laufenden Saison nachholen", () => {
  it("ein in Saison 1 ausgelaufener Vertrag ist in Saison 2 offen und als nachzuholen markiert", () => {
    const altstand = stand({
      phase: "season_active",
      seasonId: "season-2",
      rosters: [
        vertrag(MENSCH, "m1", { contractLength: 0, contractEndSeasonNumber: 1, contractStatus: "renewal_pending" }),
        vertrag(MENSCH, "m2", { contractLength: 2, contractEndSeasonNumber: 3 }),
      ],
    });
    expect(istVertragsentscheidungNachzuholen(altstand.rosters[0]!, altstand)).toBe(true);
    expect(istVertragsentscheidungNachzuholen(altstand.rosters[1]!, altstand)).toBe(false);
    expect(offeneVertragsentscheidungen(altstand)).toEqual([
      expect.objectContaining({ playerId: "m1", nachzuholen: true }),
    ]);
  });

  it("Spielbarkeit 23.11.: eine offene Saisonende-Entscheidung bleibt in jeder Saisonende-Phase buchbar (keine Sackgasse bei next_season_ready)", () => {
    for (const phase of ["season_end_management", "transfer_buy_phase", "lineup_setup", "next_season_ready"] as const) {
      const g = stand({ phase, rosters: [vertrag(MENSCH, "m1", { contractLength: 0, contractEndSeasonNumber: 1, contractStatus: "renewal_pending" })] });
      expect(offeneVertragsentscheidungen(g)).toHaveLength(1);
      expect(darfVertragsentscheidungTrotzPhase(g.rosters[0]!, g)).toBe(true);
    }
    // Kein Freibrief: mitten in der Saison und ohne offene Entscheidung bleibt der Riegel.
    const laufend = stand({ phase: "season_active", rosters: [vertrag(MENSCH, "m2", { contractLength: 2, contractEndSeasonNumber: 3 })] });
    expect(darfVertragsentscheidungTrotzPhase(laufend.rosters[0]!, laufend)).toBe(false);
    const entschieden = stand({ phase: "next_season_ready", rosters: [vertrag(MENSCH, "m3", { contractLength: 3, contractEndSeasonNumber: 3, contractStatus: "active" })] });
    expect(darfVertragsentscheidungTrotzPhase(entschieden.rosters[0]!, entschieden)).toBe(false);
  });

  it("die Vertragsroute lässt das Nachholen auch außerhalb des Saisonende-Fensters zu", () => {
    const route = readFileSync(join(process.cwd(), "app/api/contracts/renewal/route.ts"), "utf8");
    expect(route).toContain("darfVertragsentscheidungTrotzPhase(eintrag, save.gameState)");
    expect(route).toContain("vertragsentscheidung_nachgeholt");
  });
});

describe("Saisonfinale: die Pflichtliste ist verdrahtet", () => {
  const PANEL = readFileSync(join(process.cwd(), "app/foundation/season-v2/FoundationSeasonFinalePanel.tsx"), "utf8");
  const BODY = readFileSync(join(process.cwd(), "app/foundation/FoundationShellRouterBody.tsx"), "utf8");

  it("liest dieselbe Quelle wie die Sperre und zeigt je Spieler Verlängern/Freigeben", () => {
    expect(PANEL).toContain("offeneVertragsentscheidungen(gameState, activeTeamId)");
    expect(PANEL).toContain('data-testid="season-finale-vertragsentscheidungen"');
    expect(PANEL).toContain('data-testid="season-finale-verlaengern"');
    expect(PANEL).toContain('data-testid="season-finale-freigeben"');
  });

  it("„Neue Saison starten“ ist gesperrt, solange eine Entscheidung offen ist", () => {
    expect(PANEL).toContain('state: readOnly || entscheidungen.length > 0 ? "blocked"');
    expect(PANEL).toContain("vertragsentscheidung_offen:");
  });

  it("Verlängern öffnet die Gehaltsverhandlung, Freigeben läuft über den Vertragsweg „release“", () => {
    expect(BODY).toMatch(/const vertragVerlaengern = [\s\S]*?props\.openContractRenewalNegotiation\(/);
    expect(BODY).toMatch(/const vertragFreigeben = [\s\S]*?runContractRenewalAction\(\{[\s\S]*?action: "release"/);
    expect(BODY).toContain("onRenewPlayer={vertragVerlaengern}");
    expect(BODY).toContain("onReleasePlayer={vertragFreigeben}");
  });

  it("Altstände: die Startseite zeigt die nachzuholenden Entscheidungen mit denselben Knöpfen", () => {
    const KARTE = readFileSync(join(process.cwd(), "app/foundation/season-v2/VertragsentscheidungNachholen.tsx"), "utf8");
    expect(KARTE).toContain("offeneVertragsentscheidungen(gameState, activeTeamId)");
    expect(KARTE).toContain(".filter((eintrag) => eintrag.nachzuholen)");
    expect(BODY).toContain('activeView === "homeV2" && !isSeasonEndPhase(gameState.gamePhase) ? (');
    expect(BODY).toContain("<VertragsentscheidungNachholen");
  });
});
