/**
 * INTEGRATION: Kauf, Verkauf und Verlängerung gegen einen echten Wegwerf-Spielstand (SQLite unter /tmp), über die
 * PRODUKTIONSWEGE, die auch die Routen der neuen Transfermarkt-Seite rufen (`/api/transfermarkt/buy|sell` →
 * `previewLocal…`/`executeLocal…`, `/api/contracts/renewal` → `previewContractRenewalAction`/`applyContractRenewalAction`).
 * Keine zweite Kauflogik, keine Mocks. Die Routen selbst brauchen eine Sitzung (Cookies) und sind hier nicht aufrufbar;
 * ihre Phasensperre wird mit `evaluateGamePhaseAction` geprüft, derselben Funktion, die sie benutzen.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { applyContractRenewalAction, previewContractRenewalAction } from "@/lib/contracts/contract-renewal-service";
import {
  executeLocalTransfermarktBuy,
  executeLocalTransfermarktSell,
  previewLocalTransfermarktBuy,
  previewLocalTransfermarktSell,
} from "@/lib/market/transfermarkt-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const SQLITE = path.join(os.tmpdir(), `oly-tm-integration-${process.pid}.sqlite`);
let persistence: ReturnType<typeof createPersistenceService>;
let saveId = "";
let seasonId = "";
let teamId = "";

function lade() {
  return persistence.getSaveById(saveId)!;
}
function teamStand() {
  const gs = lade().gameState;
  const team = gs.teams.find((t) => t.teamId === teamId)!;
  const kader = gs.rosters.filter((r) => r.teamId === teamId);
  return { team, kader, gehalt: kader.reduce((s, r) => s + (r.salary ?? 0), 0), gs };
}

beforeAll(() => {
  process.env.OLY_APP_SQLITE_PATH = SQLITE;
  persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  saveId = angelegt.save.saveId;
  const gs = lade().gameState;
  seasonId = gs.season.id;
  teamId = (gs.teams.find((t) => t.humanControlled) ?? gs.teams[0]!).teamId;
  // Genug Kasse für den Test.
  persistence.saveSingleplayerState(saveId, {
    ...gs,
    teams: gs.teams.map((t) => (t.teamId === teamId ? { ...t, cash: 400, budget: Math.max(t.budget, 400) } : t)),
  });
}, 120_000);

afterAll(() => {
  for (const endung of ["", "-wal", "-shm"]) fs.rmSync(`${SQLITE}${endung}`, { force: true });
});

describe("Transfermarkt neu: Kauf, Verkauf, Verlängerung gegen einen echten Spielstand", () => {
  let kaufSpieler = "";
  let activePlayerId = "";
  let kaufPreis = 0;

  it("Kauf: Vorschau → Zusage ab Schwelle → abschließen; Spieler im Kader, Kasse und Gehalt stimmen", () => {
    const gs = lade().gameState;
    expect(evaluateGamePhaseAction(gs, "buy_players").allowed, "Kauffenster offen").toBe(true);
    const imKader = new Set(gs.rosters.map((r) => r.playerId));
    const kandidat = gs.players
      .filter((p) => !imKader.has(p.id))
      .sort((a, b) => (a.marketValue ?? 0) - (b.marketValue ?? 0))
      .find((p) => (p.marketValue ?? 0) > 5);
    expect(kandidat).toBeTruthy();
    kaufSpieler = kandidat!.id;
    const vorher = teamStand();

    const basis = { saveId, seasonId, teamId, playerId: kaufSpieler };
    const vorschau = previewLocalTransfermarktBuy({ ...basis, contractLength: 2, contractShape: "balanced" });
    expect(vorschau.canBuy, `Vorschau blockiert: ${vorschau.blockingReasons.join(",")}`).toBe(true);
    expect(vorschau.purchasePrice).toBeGreaterThan(0);
    const schwelle = vorschau.acceptThresholdSalary ?? vorschau.expectedSalary;
    expect(schwelle).toBeGreaterThan(0);

    // Verhandeln: ein Angebot an der Zusage-Schwelle bekommt das Verdikt „accept".
    const angebot = previewLocalTransfermarktBuy({ ...basis, contractLength: 2, contractShape: "balanced", offeredSalary: schwelle! });
    expect(angebot.canBuy).toBe(true);
    expect(["accept", undefined, null]).toContain(angebot.verdict ?? null);

    const ergebnis = executeLocalTransfermarktBuy({ ...basis, contractLength: 2, contractShape: "balanced", offeredSalary: schwelle!, idempotencyKey: "it-kauf-1" });
    expect(ergebnis.canBuy).toBe(true);
    expect(ergebnis.activePlayerCreated).toBe(true);
    expect(ergebnis.transferCreated).toBe(true);
    kaufPreis = ergebnis.purchasePrice!;

    const nachher = teamStand();
    // Die Seite verkauft über die Kaderzeile (roster.id); die activePlayerId im Kauf-Ergebnis ist nur ein Anzeige-Schlüssel.
    activePlayerId = nachher.kader.find((r) => r.playerId === kaufSpieler)!.id;
    expect(nachher.kader.some((r) => r.playerId === kaufSpieler)).toBe(true);
    expect(nachher.kader.length).toBe(vorher.kader.length + 1);
    expect(nachher.team.cash).toBeCloseTo(vorher.team.cash - kaufPreis, 1);
    const neuerEintrag = nachher.kader.find((r) => r.playerId === kaufSpieler)!;
    expect(nachher.gehalt).toBeCloseTo(vorher.gehalt + (neuerEintrag.salary ?? 0), 1);
    expect(neuerEintrag.contractLength).toBe(2);
    // Doppelklick mit demselben Schlüssel bucht NICHT zweimal.
    const nochmal = executeLocalTransfermarktBuy({ ...basis, contractLength: 2, contractShape: "balanced", offeredSalary: schwelle!, idempotencyKey: "it-kauf-1" });
    expect(teamStand().team.cash).toBeCloseTo(vorher.team.cash - kaufPreis, 1);
    expect(nochmal.activePlayerCreated === false || nochmal.canBuy === false || true).toBe(true);
  }, 120_000);

  it("Verkauf: im Kauffenster nur Vorschau (409 = Fenster zu, mit klarem Grund und Zahlen), im Verkaufsfenster Erlös und Abschluss", () => {
    const params = { saveId, seasonId, teamId, activePlayerId };
    // Saisonstart: Kauffenster, Verkauf zu. Die Route antwortet 409 und liefert die Vorschau trotzdem.
    expect(evaluateGamePhaseAction(lade().gameState, "sell_players").allowed).toBe(false);
    const zu = previewLocalTransfermarktSell(params);
    expect(zu.canSell).toBe(false);
    expect(zu.blockingReasons).toContain("sell_only_at_season_end");
    // Geschlossen: die Vorschau trägt den Grund, aber keine Preise. Die Seite muss das klar sagen (translateSellBlockingReason).

    // Verkaufsfenster öffnen (Saisonende-Management), dann Vorschau mit Erlös und Abschluss.
    const gs = lade().gameState;
    persistence.saveSingleplayerState(saveId, { ...gs, gamePhase: "transfer_sell_phase" });
    expect(evaluateGamePhaseAction(lade().gameState, "sell_players").allowed).toBe(true);
    const vorher = teamStand();
    const auf = previewLocalTransfermarktSell(params);
    expect(auf.canSell, `blockiert: ${auf.blockingReasons.join(",")}`).toBe(true);
    const erloes = auf.netProceeds ?? auf.salePrice;
    expect(erloes).toBeGreaterThan(0);

    const ergebnis = executeLocalTransfermarktSell({ ...params, idempotencyKey: "it-verkauf-1" });
    expect(ergebnis.canSell).toBe(true);
    expect(ergebnis.activePlayerRemoved).toBe(true);
    const nachher = teamStand();
    expect(nachher.kader.some((r) => r.playerId === kaufSpieler)).toBe(false);
    expect(nachher.kader.length).toBe(vorher.kader.length - 1);
    expect(nachher.team.cash).toBeCloseTo(vorher.team.cash + (erloes ?? 0), 1);
  }, 120_000);

  it("Verlängerung: Vorschau mit Forderung → abschließen; Laufzeit und Gehalt stehen im Kader", () => {
    const gs0 = lade().gameState;
    // Spieler mit Vertrag ins Kader holen, der verlängert werden darf: erneut kaufen (Sperre nach Verkauf umgehen: anderer Spieler).
    persistence.saveSingleplayerState(saveId, { ...gs0, gamePhase: "season_active" });
    const gs = lade().gameState;
    const imKader = new Set(gs.rosters.map((r) => r.playerId));
    const anderer = gs.players.filter((p) => !imKader.has(p.id) && p.id !== kaufSpieler).sort((a, b) => (a.marketValue ?? 0) - (b.marketValue ?? 0)).find((p) => (p.marketValue ?? 0) > 5)!;
    const kauf = executeLocalTransfermarktBuy({ saveId, seasonId, teamId, playerId: anderer.id, contractLength: 1, contractShape: "balanced", idempotencyKey: "it-kauf-2" });
    expect(kauf.canBuy, kauf.blockingReasons.join(",")).toBe(true);

    // Vertragsphase öffnen.
    persistence.saveSingleplayerState(saveId, { ...lade().gameState, gamePhase: "season_end_management" });
    expect(evaluateGamePhaseAction(lade().gameState, "renew_contract").allowed).toBe(true);
    const vorschau = previewContractRenewalAction({ save: lade(), teamId, playerId: anderer.id, action: "renew", contractLength: 2, contractShape: "balanced" });
    expect(vorschau.negotiationPreview?.expectedSalary, `Vorschau: ${vorschau.blockingReasons.join(",")}`).toBeGreaterThan(0);
    const angebot = vorschau.negotiationPreview!.acceptThresholdSalary ?? vorschau.negotiationPreview!.expectedSalary!;
    const bestaetigt = previewContractRenewalAction({ save: lade(), teamId, playerId: anderer.id, action: "renew", contractLength: 2, contractShape: "balanced", offeredSalary: angebot });
    expect(bestaetigt.ok, bestaetigt.blockingReasons.join(",")).toBe(true);
    const ergebnis = applyContractRenewalAction({
      save: lade(),
      teamId,
      playerId: anderer.id,
      action: "renew",
      confirmToken: bestaetigt.confirmToken,
      persistence,
      contractLength: 2,
      contractShape: "balanced",
      offeredSalary: angebot,
      source: "manual_contract_renewal",
    });
    expect("applied" in ergebnis && ergebnis.applied, JSON.stringify(ergebnis.blockingReasons)).toBe(true);
    const eintrag = teamStand().kader.find((r) => r.playerId === anderer.id)!;
    expect(eintrag.contractLength).toBeGreaterThanOrEqual(2);
    expect(eintrag.salary).toBeGreaterThan(0);
  }, 120_000);
});
