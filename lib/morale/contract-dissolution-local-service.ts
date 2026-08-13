import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  acceptContractDissolution,
  buildContractDissolutionOffers,
  buildTeamMoraleMap,
  declineContractDissolution,
  type ContractDissolutionOffer,
} from "@/lib/morale/contract-dissolution-service";

export type ContractDissolutionDecision = "accepted" | "declined";

export type ContractDissolutionActionResult = {
  ok: boolean;
  error?: string;
  /** Offene Angebote NACH der Entscheidung — die Ansicht rendert direkt daraus weiter. */
  offers: ContractDissolutionOffer[];
  /** Was die Entscheidung bewirkt hat, fuer die Rueckmeldung an den Spieler. */
  applied?: {
    playerId: string;
    playerName: string;
    decision: ContractDissolutionDecision;
    salePrice: number;
    waivedBuyout: number;
    /** Der NICHT erlassene Rest — das ist die Zahl, die das Team wirklich zahlt. */
    payableBuyout: number;
  };
};

function buildOffers(gameState: GameState, saveId: string, seasonId: string, teamId: string) {
  return buildContractDissolutionOffers({
    gameState,
    teamId,
    seasonId,
    saveId,
    moraleByPlayerId: buildTeamMoraleMap(gameState, teamId),
  });
}

/** Nur lesen: welche Spieler dem Team gerade eine Aufloesung anbieten. */
export function listLocalContractDissolutionOffers(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
}): ContractDissolutionOffer[] {
  const save = createPersistenceService().getSaveById(input.saveId);
  if (!save) {
    return [];
  }
  return buildOffers(save.gameState, input.saveId, input.seasonId, input.teamId);
}

/**
 * Entscheidung anwenden und speichern.
 *
 * Das Angebot wird hier NEU gebaut statt vom Aufrufer entgegengenommen: sonst koennte ein
 * veralteter Preis aus der Ansicht gebucht werden, oder ein Angebot, das es in dieser Saison
 * gar nicht mehr gibt (weil bereits entschieden wurde). Der Server rechnet selbst.
 */
export function executeLocalContractDissolution(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  decision: ContractDissolutionDecision;
  decidedAt?: string;
}): ContractDissolutionActionResult {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(input.saveId);
  if (!save) {
    return { ok: false, error: "save_not_found", offers: [] };
  }

  const offers = buildOffers(save.gameState, input.saveId, input.seasonId, input.teamId);
  const offer = offers.find((entry) => entry.playerId === input.playerId) ?? null;
  if (!offer) {
    // Kein offenes Angebot: entweder schon entschieden, Moral gestiegen, oder der Spieler
    // ist nicht mehr im Kader. In allen Faellen darf nichts gebucht werden.
    return { ok: false, error: "offer_not_available", offers };
  }

  const decidedAt = input.decidedAt ?? new Date().toISOString();
  const decision = {
    gameState: save.gameState,
    offer,
    seasonId: input.seasonId,
    saveId: input.saveId,
    decidedAt,
  };
  const nextGameState =
    input.decision === "accepted" ? acceptContractDissolution(decision) : declineContractDissolution(decision);

  persistence.saveSingleplayerState(input.saveId, nextGameState);

  return {
    ok: true,
    offers: buildOffers(nextGameState, input.saveId, input.seasonId, input.teamId),
    applied: {
      playerId: offer.playerId,
      playerName: offer.playerName,
      decision: input.decision,
      salePrice: offer.salePrice,
      waivedBuyout: offer.waivedBuyout,
      payableBuyout: offer.payableBuyout,
    },
  };
}
