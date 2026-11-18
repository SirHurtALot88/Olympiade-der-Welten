/**
 * EIN GEMEINSAMES TRANSFERFENSTER + „DAS FENSTER VOR SAISON N GEHOERT ZU SAISON N" (Chris 18.11.,
 * „ok dann mach das so!"). Doku: `docs/design/transferfenster-gemeinsam-18-11.md`.
 *
 * Drei Bloecke:
 *  1. Phasenpolitik: im Fenster (neue Saison vor Spieltag 1) sind Kaufen UND Verkaufen offen, am Saisonende nur
 *     noch Verlaengern, in der Saison nichts. Schalter `OLY_TRANSFERFENSTER_GEMEINSAM=0` stellt den alten Ablauf her.
 *  2. Buchung: der Draft ist Kaderaufbau, nicht `transferNet`; das Fenster S1→S2 zaehlt zu S2.
 *  3. Altstand-Umrechnung: archivierte Saisonen werden in der Anzeige nach derselben Regel gelesen, ohne dass sich
 *     das Archiv aendert.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GameState, SeasonSnapshotRecord, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { berechneVorstandBudgetStand } from "@/lib/finance/vorstand-budgetfreigabe";
import { buildKontoauszuege } from "@/lib/finance/kontoauszug";
import { zeugnisGeldzeile } from "@/lib/foundation/season-recap-service";
import {
  getTransferWindowStatus,
  isTransferBuyPhaseOpen,
  isTransferMarketPhaseOpen,
  isTransferSellPhaseOpen,
} from "@/lib/market/transfer-window-policy";
import { istTransferfensterGemeinsam } from "@/lib/market/transferfenster-gemeinsam";
import { leseSaisonSchnappschuesse, projiziereSaisonHistorie } from "@/lib/persistence/foundation-season-history-projection";
import { getNextRoomFlowStepId } from "@/lib/room/room-flow-controller";
import {
  berechneTransferbuchungFuerTeam,
  rechneTransferbilanzImDatensatzUm,
} from "@/lib/season/transferbilanz-buchung";
import { buildStandingsTransferBalanceForTeam } from "@/lib/season/transfer-standings-balance";

const SCHALTER = "OLY_TRANSFERFENSTER_GEMEINSAM";

function phasenStand(input: {
  gamePhase: GameState["gamePhase"];
  currentMatchday?: number;
  matchdayStatus?: string;
  seasonId?: string;
}): GameState {
  const seasonId = input.seasonId ?? "season-2";
  return {
    gamePhase: input.gamePhase,
    season: { id: seasonId, currentMatchday: input.currentMatchday ?? 1, matchdayIds: [`${seasonId}-matchday-1`] },
    matchdayState: { matchdayId: `${seasonId}-matchday-${input.currentMatchday ?? 1}`, status: input.matchdayStatus ?? "open" },
    seasonState: { matchdayResults: [] },
  } as unknown as GameState;
}

describe("Phasenpolitik — ein gemeinsames Transferfenster", () => {
  const vorher = process.env[SCHALTER];
  afterEach(() => {
    if (vorher === undefined) delete process.env[SCHALTER];
    else process.env[SCHALTER] = vorher;
  });

  it("ist im Standard AN", () => {
    delete process.env[SCHALTER];
    expect(istTransferfensterGemeinsam()).toBe(true);
  });

  it("oeffnet Kaufen UND Verkaufen in der neuen Saison vor Spieltag 1", () => {
    delete process.env[SCHALTER];
    const fenster = phasenStand({ gamePhase: "season_active", currentMatchday: 1 });
    expect(isTransferBuyPhaseOpen(fenster)).toBe(true);
    expect(isTransferSellPhaseOpen(fenster)).toBe(true);
    expect(evaluateGamePhaseAction(fenster, "buy_players").allowed).toBe(true);
    expect(evaluateGamePhaseAction(fenster, "sell_players").allowed).toBe(true);
    const status = getTransferWindowStatus(fenster);
    expect(status).toMatchObject({ open: true, canBuy: true, canSell: true, gemeinsamesFenster: true });
    expect(status.label).toBe("Transferfenster offen");
  });

  it("verkauft am Saisonende nicht mehr, verlaengert aber weiter", () => {
    delete process.env[SCHALTER];
    for (const gamePhase of ["season_end_management", "transfer_sell_phase"] as const) {
      const saisonende = phasenStand({ gamePhase, currentMatchday: 10 });
      expect(evaluateGamePhaseAction(saisonende, "sell_players").allowed).toBe(false);
      expect(evaluateGamePhaseAction(saisonende, "buy_players").allowed).toBe(false);
      expect(evaluateGamePhaseAction(saisonende, "renew_contract").allowed).toBe(true);
      // Die Saisonende-Kette haelt hier weiter an (Verlaengern ist offen).
      expect(isTransferMarketPhaseOpen(saisonende)).toBe(true);
      expect(getTransferWindowStatus(saisonende).label).toBe("Vertragsphase");
    }
  });

  it("haelt waehrend der Saison alles zu", () => {
    delete process.env[SCHALTER];
    const saison = phasenStand({ gamePhase: "season_active", currentMatchday: 5 });
    expect(evaluateGamePhaseAction(saison, "buy_players").allowed).toBe(false);
    expect(evaluateGamePhaseAction(saison, "sell_players").allowed).toBe(false);
    const nachSpieltag1 = phasenStand({ gamePhase: "season_active", currentMatchday: 1, matchdayStatus: "resolved" });
    expect(evaluateGamePhaseAction(nachSpieltag1, "sell_players").allowed).toBe(false);
  });

  it("stellt mit OLY_TRANSFERFENSTER_GEMEINSAM=0 den alten Ablauf her", () => {
    process.env[SCHALTER] = "0";
    const fenster = phasenStand({ gamePhase: "season_active", currentMatchday: 1 });
    expect(isTransferBuyPhaseOpen(fenster)).toBe(true);
    expect(isTransferSellPhaseOpen(fenster)).toBe(false);
    const saisonende = phasenStand({ gamePhase: "season_end_management", currentMatchday: 10 });
    expect(isTransferSellPhaseOpen(saisonende)).toBe(true);
  });

  it("fuehrt den Raum nach dem Saisonwechsel zu den Verkaeufen (Schalter aus: ins Training)", () => {
    delete process.env[SCHALTER];
    expect(getNextRoomFlowStepId("season_transition", { seasonHasAdvanced: true })).toBe("sell_players");
    process.env[SCHALTER] = "0";
    expect(getNextRoomFlowStepId("season_transition", { seasonHasAdvanced: true })).toBe("training");
  });
});

function eintrag(partial: Partial<TransferHistoryEntry> & Pick<TransferHistoryEntry, "transferType" | "seasonId">): TransferHistoryEntry {
  return {
    id: partial.id ?? `t-${Math.random().toString(36).slice(2)}`,
    playerId: partial.playerId ?? "p",
    seasonLabel: partial.seasonLabel ?? partial.seasonId,
    matchdayId: partial.matchdayId ?? "matchday-1",
    phase: partial.phase ?? "manual_transfer_window",
    fromTeamId: partial.fromTeamId ?? null,
    toTeamId: partial.toTeamId ?? null,
    fee: partial.fee ?? 0,
    salary: partial.salary ?? 1,
    marketValue: partial.marketValue ?? 1,
    remainingContractLength: partial.remainingContractLength ?? 2,
    happenedAt: partial.happenedAt ?? "2026-11-18T00:00:00.000Z",
    source: partial.source,
    transferType: partial.transferType,
    seasonId: partial.seasonId,
  };
}

/** Ein Altstand im alten Ablauf: Draft in S1, Verkaeufe am S1-Ende (Spieltag 10), Kaeufe zu Beginn von S2. */
function altstandHistorie(): TransferHistoryEntry[] {
  return [
    eintrag({ transferType: "buy", seasonId: "season-1", toTeamId: "A", fee: 200, source: "ai_roster_fill", matchdayId: "matchday-1" }),
    eintrag({ transferType: "buy", seasonId: "season-1", toTeamId: "A", fee: 50, source: "manual_transfermarkt_buy", matchdayId: "matchday-1" }),
    eintrag({ transferType: "contract_exit", seasonId: "season-1", fromTeamId: "A", fee: 9, phase: "contract_renewal", matchdayId: "matchday-10" }),
    eintrag({ transferType: "sell", seasonId: "season-1", fromTeamId: "A", fee: 40, source: "ai_organic_squad_sell", matchdayId: "matchday-10" }),
    eintrag({ transferType: "buy", seasonId: "season-2", toTeamId: "A", fee: 25, source: "ai_preseason_market_buy", matchdayId: "season-2-matchday-1" }),
  ];
}

/** Derselbe Weg im gemeinsamen Fenster: Verkauf und Kauf beide in S2 vor Spieltag 1. */
function neueHistorie(): TransferHistoryEntry[] {
  return [
    eintrag({ transferType: "buy", seasonId: "season-1", toTeamId: "A", fee: 250, source: "ai_roster_fill", matchdayId: "matchday-1" }),
    eintrag({ transferType: "sell", seasonId: "season-2", fromTeamId: "A", fee: 40, source: "ai_organic_squad_sell", matchdayId: "season-2-matchday-1" }),
    eintrag({ transferType: "buy", seasonId: "season-2", toTeamId: "A", fee: 25, source: "ai_preseason_market_buy", matchdayId: "season-2-matchday-1" }),
  ];
}

describe("Buchung — das Fenster vor Saison N gehoert zu Saison N", () => {
  for (const [name, historie] of [
    ["alter Ablauf (Verkauf am S1-Ende)", altstandHistorie()],
    ["gemeinsames Fenster (Verkauf in S2)", neueHistorie()],
  ] as const) {
    it(`${name}: Draft ist Kaderaufbau, keine Transferbilanz in S1`, () => {
      const s1 = berechneTransferbuchungFuerTeam({ transferHistory: historie, seasonId: "season-1", teamId: "A", spieltageProSaison: 10 });
      expect(s1.transferNet).toBeNull();
      expect(s1.transfer).toBeNull();
      expect(s1.kaderaufbau?.kaeufe).toBe(250);
      expect(s1.kaderaufbauNet).toBe(-250);
    });

    it(`${name}: S2 = Erloese − Ablösen des Fensters S1→S2`, () => {
      const s2 = berechneTransferbuchungFuerTeam({ transferHistory: historie, seasonId: "season-2", teamId: "A", spieltageProSaison: 10 });
      expect(s2.kaderaufbau).toBeNull();
      expect(s2.transfer).toMatchObject({ kaeufe: 25, verkaeufe: 40, anzahlKaeufe: 1, anzahlVerkaeufe: 1 });
      expect(s2.transferNet).toBe(15);
    });
  }

  it("Saisonstand: S1 leer, S2 mit Verkauf und Kauf", () => {
    const gameState = { season: { id: "season-2", matchdayIds: Array.from({ length: 10 }, (_, i) => `m${i}`) }, teams: [{ teamId: "A" }], transferHistory: altstandHistorie() } as unknown as GameState;
    expect(buildStandingsTransferBalanceForTeam(gameState, "season-1", "A")).toMatchObject({ transferNet: null, kaderaufbauNet: -250, transferBuyCount: 0 });
    expect(buildStandingsTransferBalanceForTeam(gameState, "season-2", "A")).toMatchObject({ transferNet: 15, transferSellTotal: 40, transferBuyTotal: 25 });
  });

  it("Kontoauszug: Draft als eigene Buchungsart „kaderaufbau“", () => {
    const gameState = {
      season: { id: "season-2", matchdayIds: [] },
      teams: [{ teamId: "A" }],
      transferHistory: neueHistorie(),
      seasonState: {},
    } as unknown as GameState;
    const auszug = buildKontoauszuege(gameState).get("A")!;
    expect(auszug.jeArt.kaderaufbau).toBe(-250);
    expect(auszug.jeArt.transfer_kauf).toBe(-25);
    expect(auszug.jeArt.transfer_verkauf).toBe(40);
  });

  it("Saisonrueckblick: S1 „Kaderaufbau … · Transferbilanz —“, S2 mit Zahl", () => {
    const s1 = zeugnisGeldzeile("season-1", { teamId: "A", cashEnd: 12.3, transferNet: null, kaderaufbauNet: -250 } as never);
    expect(s1).toContain("Kaderaufbau -250 C");
    expect(s1).toContain("Transferbilanz —");
    const s2 = zeugnisGeldzeile("season-2", { teamId: "A", cashEnd: 12.3, transferNet: 15 } as never);
    expect(s2).toContain("Transferbilanz +15 C");
  });
});

describe("Verkaufserloese aus dem Fenster sind zu 100 % frei", () => {
  const vorher = process.env[SCHALTER];
  beforeEach(() => delete process.env[SCHALTER]);
  afterEach(() => {
    if (vorher === undefined) delete process.env[SCHALTER];
    else process.env[SCHALTER] = vorher;
  });

  function stand(): GameState {
    return {
      season: { id: "season-2" },
      teams: [{ teamId: "A", cash: 120 }],
      teamIdentities: [],
      rosters: [],
      seasonState: { boardConfidence: { A: { teamId: "A", value: 3 } } },
      transferHistory: [eintrag({ transferType: "sell", seasonId: "season-2", fromTeamId: "A", fee: 20, matchdayId: "season-2-matchday-1" })],
    } as unknown as GameState;
  }

  it("die Quote gilt nur fuer die Anfangskasse, nicht fuer die Erloese", () => {
    const st = berechneVorstandBudgetStand(stand(), "A");
    // Anfangskasse 100 (120 − 20 Erloes) × Quote + 20 voll.
    expect(st.anteil).toBeLessThan(1);
    expect(st.freigegebenGesamt).toBeCloseTo(100 * st.anteil + 20, 2);
  });

  it("Schalter aus: Quote auch auf die Erloese (alter Stand)", () => {
    process.env[SCHALTER] = "0";
    const st = berechneVorstandBudgetStand(stand(), "A");
    expect(st.freigegebenGesamt).toBeCloseTo(120 * st.anteil, 2);
  });
});

describe("Altstand-Umrechnung — Anzeige nachtraeglich, Archiv unveraendert", () => {
  function schnappschuss(seasonId: string, transferNet: number, transferBuyTotal: number): SeasonSnapshotRecord {
    return {
      snapshotId: `snap-${seasonId}`,
      seasonId,
      seasonName: seasonId,
      archivedAt: "2026-11-01T00:00:00.000Z",
      status: "completed",
      finalStandings: [
        { teamId: "A", teamCode: "A", teamName: "A", rank: 1, transferNet, transferBuyTotal, transferSellTotal: 40, transferBuyCount: 2, transferSellCount: 1, transferCount: 3 },
      ],
    } as unknown as SeasonSnapshotRecord;
  }

  function altSpielstand(): GameState {
    return {
      season: { id: "season-3", matchdayIds: Array.from({ length: 10 }, (_, i) => `m${i}`) },
      teams: [{ teamId: "A", shortCode: "A", name: "A" }],
      transferHistory: altstandHistorie(),
      seasonState: {
        // Altwerte nach der alten Rechnung: S1 = 40 − 250 = −210, S2 = −25 (nur der Kauf).
        seasonSnapshots: [schnappschuss("season-1", -210, 250), schnappschuss("season-2", -25, 25)],
      },
    } as unknown as GameState;
  }

  it("rechnet S1 auf Kaderaufbau und S2 auf das Fenster S1→S2 um", () => {
    const gameState = altSpielstand();
    const archivVorher = JSON.stringify(gameState.seasonState.seasonSnapshots);
    const [s1, s2] = leseSaisonSchnappschuesse(gameState);
    expect(s1!.finalStandings[0]).toMatchObject({ transferNet: null, kaderaufbauNet: -250, kaderaufbauBuyTotal: 250 });
    expect(s2!.finalStandings[0]).toMatchObject({ transferNet: 15, transferSellTotal: 40, transferBuyTotal: 25 });
    // Am gespeicherten Archiv aendert sich nichts.
    expect(JSON.stringify(gameState.seasonState.seasonSnapshots)).toBe(archivVorher);
  });

  it("ist idempotent: die Kurzfassung des Servers wird im Browser nicht doppelt umgerechnet", () => {
    const gameState = altSpielstand();
    const kurz = projiziereSaisonHistorie(gameState.seasonState.seasonSnapshots, {
      transferHistory: gameState.transferHistory,
      spieltageProSaison: 10,
    });
    expect(kurz[0]!.teams[0]).toMatchObject({ transferNet: null, kaderaufbauNet: -250 });
    const browser = {
      ...gameState,
      seasonState: { seasonSnapshots: [], foundationSeasonHistory: kurz },
    } as unknown as GameState;
    const [s1, s2] = leseSaisonSchnappschuesse(browser);
    expect(s1!.finalStandings[0]).toMatchObject({ transferNet: null, kaderaufbauNet: -250 });
    expect(s2!.finalStandings[0]).toMatchObject({ transferNet: 15 });
  });

  it("liest S1 ohne Historie als Kaderaufbau (alter Kauf-Saldo), S2 bleibt beim Archivwert", () => {
    const ohne = rechneTransferbilanzImDatensatzUm({ teamId: "A", transferNet: -210, transferBuyTotal: 250, transferBuyCount: 2 }, "season-1", null);
    expect(ohne).toMatchObject({ transferNet: null, kaderaufbauNet: -250, kaderaufbauBuyTotal: 250 });
    expect(rechneTransferbilanzImDatensatzUm(ohne, "season-1", null)).toEqual(ohne);
    expect(rechneTransferbilanzImDatensatzUm({ teamId: "A", transferNet: -25 }, "season-2", null)).toEqual({ teamId: "A", transferNet: -25 });
  });
});
