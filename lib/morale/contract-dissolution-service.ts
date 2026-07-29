// =====================================================================================
// Vertragsaufloesung auf Spielerwunsch
// =====================================================================================
//
// Ein Spieler, dem es im Team nicht mehr passt (`contractIntent === "considering_exit"`,
// also Moral unter 34), bietet zum Saisonende an, seinen Vertrag aufzuloesen.
//
// Nimmt der Manager an:
//   • Der Spieler geht sofort.
//   • Das Team kassiert den VOLLEN Verkaufspreis (Marktwert x Verkaufsfaktor).
//   • Ein offener Rest-Buyout entfaellt — der Spieler verzichtet darauf.
//   Der Preis: man kann sich den Zeitpunkt nicht aussuchen. Es gilt der Faktor, der
//   gerade anliegt, auch wenn der Spieler eine schwache Saison hatte.
//
// Lehnt der Manager ab:
//   • Der Spieler erfuellt seinen Vertrag weiter.
//   • Seine Moral leidet zusaetzlich — die Ablehnung ist nicht folgenlos.
//   • Naechste Saison darf er erneut fragen, sofern es ihm dann immer noch nicht passt.
//
// Bewusst als eigener Dienst und als reine GameState-Transformation: der Verkaufspfad in
// `transfermarkt-local-service.ts` ist ueber 3000 Zeilen und traegt Transferfenster,
// Wiederkauf-Sperren, Board-Reaktionen und Scouting-Sichten mit sich — nichts davon gilt
// hier. Die PREISRECHNUNG wird von dort uebernommen (`buildTransfermarktSaleFactorBreakdown`),
// damit Angebot und regulaerer Verkauf nicht auseinanderlaufen.

import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";

/** Moral-Schwelle, ab der ein Spieler ueber einen Wechsel nachdenkt (siehe getContractIntent). */
export const DISSOLUTION_MORALE_THRESHOLD = 34;

/** Moral-Abzug, wenn der Manager die Aufloesung ablehnt. */
export const DISSOLUTION_DECLINE_MORALE_PENALTY = 6;

export type ContractDissolutionOffer = {
  playerId: string;
  playerName: string;
  teamId: string;
  /** Moral zum Zeitpunkt des Angebots — die Begruendung des Spielers. */
  morale: number;
  /** Was das Team bei Annahme bekommt: Marktwert x Verkaufsfaktor, brutto. */
  salePrice: number;
  /** Rest-Buyout, der bei Annahme entfaellt (0, wenn der Vertrag ohnehin auslaeuft). */
  waivedBuyout: number;
  /** Restlaufzeit in Saisons — je laenger, desto mehr verzichtet der Spieler. */
  remainingContractLength: number;
  /** Hat der Spieler in einer frueheren Saison schon einmal gefragt? */
  previouslyDeclined: boolean;
};

export type ContractDissolutionRecord = {
  saveId: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  decision: "accepted" | "declined";
  salePrice: number;
  waivedBuyout: number;
  decidedAt: string;
};

type OfferInput = {
  gameState: GameState;
  teamId: string;
  seasonId: string;
  saveId: string;
  /** Moral je Spieler. Wird hier NICHT neu abgeleitet — sonst driftet sie von der Anzeige weg. */
  moraleByPlayerId: Record<string, number>;
};

function readDissolutionLog(gameState: GameState): ContractDissolutionRecord[] {
  return ((gameState.seasonState as { contractDissolutions?: ContractDissolutionRecord[] })
    .contractDissolutions ?? []) as ContractDissolutionRecord[];
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

/**
 * Wer bietet dem Team an, seinen Vertrag aufzuloesen?
 *
 * Bewusst NUR die Spieler unter der Schwelle: `refuses_extension` (Moral < 22) ist ein
 * noch haerterer Zustand, faellt aber unter dieselbe Regel — wer gehen will, darf fragen.
 */
export function buildContractDissolutionOffers(input: OfferInput): ContractDissolutionOffer[] {
  const playersById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
  const log = readDissolutionLog(input.gameState);
  const offers: ContractDissolutionOffer[] = [];

  for (const rosterEntry of input.gameState.rosters) {
    if (rosterEntry.teamId !== input.teamId) continue;
    const player = playersById.get(rosterEntry.playerId);
    if (!player) continue;

    const morale = input.moraleByPlayerId[player.id];
    if (morale == null || morale >= DISSOLUTION_MORALE_THRESHOLD) continue;

    // In derselben Saison wird nur einmal entschieden — sonst koennte man ein
    // abgelehntes Angebot beliebig oft neu aufrufen, bis der Preis passt.
    const decidedThisSeason = log.some(
      (entry) =>
        entry.playerId === player.id && entry.seasonId === input.seasonId && entry.teamId === input.teamId,
    );
    if (decidedThisSeason) continue;

    const priced = priceDissolution(input.gameState, player, rosterEntry);
    if (priced == null) continue;

    offers.push({
      playerId: player.id,
      playerName: player.name,
      teamId: input.teamId,
      morale: Number(morale.toFixed(1)),
      salePrice: priced.salePrice,
      waivedBuyout: priced.waivedBuyout,
      remainingContractLength: rosterEntry.contractLength ?? 0,
      previouslyDeclined: log.some(
        (entry) => entry.playerId === player.id && entry.teamId === input.teamId && entry.decision === "declined",
      ),
    });
  }

  // Teuerster Abgang zuerst — das ist die Entscheidung, die am meisten weh tut.
  return offers.sort((left, right) => right.salePrice - left.salePrice || left.playerId.localeCompare(right.playerId));
}

/**
 * Preis der Aufloesung. Nutzt dieselbe Rechnung wie der regulaere Verkauf, damit das
 * Angebot nicht von der VK-Spalte in der Spielerliste abweicht.
 */
export function priceDissolution(
  gameState: GameState,
  player: Player,
  rosterEntry: RosterEntry,
): { salePrice: number; waivedBuyout: number } | null {
  const economy = resolvePlayerEconomyContract({ player, rosterEntry });
  const breakdown = buildTransfermarktSaleFactorBreakdown(gameState, player, rosterEntry);
  const salePrice = breakdown.salePrice ?? economy.marketValue ?? null;
  if (salePrice == null || salePrice <= 0) return null;

  // Der Buyout entfaellt — hier nur ausgewiesen, damit der Spieler sieht, worauf der
  // Abgang verzichtet. Ein auslaufender Vertrag hat ohnehin keinen.
  const remaining = Math.max(0, (rosterEntry.contractLength ?? 0) - 1);
  const waivedBuyout = roundMoney(remaining * (rosterEntry.salary ?? 0));

  return { salePrice: roundMoney(salePrice), waivedBuyout };
}

type DecisionInput = {
  gameState: GameState;
  offer: ContractDissolutionOffer;
  seasonId: string;
  saveId: string;
  decidedAt: string;
};

/**
 * Annahme: Der Spieler geht, das Team kassiert den vollen Verkaufspreis, der Rest-Buyout
 * entfaellt. Reine Transformation — kein Transferfenster, keine Wiederkauf-Sperre.
 */
export function acceptContractDissolution(input: DecisionInput): GameState {
  const { gameState, offer } = input;

  const teams = gameState.teams.map((team) =>
    team.teamId === offer.teamId ? { ...team, cash: roundMoney((team.cash ?? 0) + offer.salePrice) } : team,
  );

  const rosters = gameState.rosters.filter(
    (entry) => !(entry.teamId === offer.teamId && entry.playerId === offer.playerId),
  );

  return {
    ...gameState,
    teams,
    rosters,
    seasonState: {
      ...gameState.seasonState,
      contractDissolutions: [
        ...readDissolutionLog(gameState),
        {
          saveId: input.saveId,
          seasonId: input.seasonId,
          teamId: offer.teamId,
          playerId: offer.playerId,
          decision: "accepted",
          salePrice: offer.salePrice,
          waivedBuyout: offer.waivedBuyout,
          decidedAt: input.decidedAt,
        },
      ],
    } as GameState["seasonState"],
  };
}

/**
 * Ablehnung: Der Spieler bleibt und erfuellt seinen Vertrag — aber es kostet Moral.
 * Naechste Saison darf er erneut fragen (der Log-Eintrag sperrt nur die laufende).
 */
export function declineContractDissolution(input: DecisionInput): GameState {
  const { gameState, offer } = input;

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      contractDissolutions: [
        ...readDissolutionLog(gameState),
        {
          saveId: input.saveId,
          seasonId: input.seasonId,
          teamId: offer.teamId,
          playerId: offer.playerId,
          decision: "declined",
          salePrice: offer.salePrice,
          waivedBuyout: offer.waivedBuyout,
          decidedAt: input.decidedAt,
        },
      ],
    } as GameState["seasonState"],
  };
}

/**
 * Moral-Abzug einer Ablehnung, anzuwenden auf den Moral-Rohwert des Spielers.
 * Getrennt gehalten, weil die Moral an vielen Stellen abgeleitet wird — der Abzug
 * gehoert dorthin, wo die Moral gebildet wird, nicht in eine zweite Rechnung.
 */
export function applyDeclinePenalty(morale: number): number {
  return Math.max(0, Number((morale - DISSOLUTION_DECLINE_MORALE_PENALTY).toFixed(1)));
}
