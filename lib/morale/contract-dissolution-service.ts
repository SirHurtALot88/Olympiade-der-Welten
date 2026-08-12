// =====================================================================================
// Vertragsaufloesung auf Spielerwunsch
// =====================================================================================
//
// Ein Spieler, dem es im Team nicht mehr passt (`contractIntent === "considering_exit"`,
// also Moral unter 34), bietet zum Saisonende an, seinen Vertrag aufzuloesen.
//
// Nimmt der Manager an:
//   • Der Spieler geht sofort.
//   • Das Team kassiert den Verkaufspreis (Marktwert x Verkaufsfaktor) …
//   • … zahlt aber den Teil des Rest-Buyouts, auf den der Spieler NICHT verzichtet.
//   Der Preis: man kann sich den Zeitpunkt nicht aussuchen. Es gilt der Faktor, der
//   gerade anliegt, auch wenn der Spieler eine schwache Saison hatte.
//
// Lehnt der Manager ab:
//   • Der Spieler erfuellt seinen Vertrag weiter.
//   • Seine Moral bricht deutlich ein — die Ablehnung ist teuer, nicht nur unangenehm.
//   • Naechste Saison darf er erneut fragen, sofern es ihm dann immer noch nicht passt.
//
// Bewusst als eigener Dienst und als reine GameState-Transformation: der Verkaufspfad in
// `transfermarkt-local-service.ts` ist ueber 3000 Zeilen und traegt Transferfenster,
// Wiederkauf-Sperren, Board-Reaktionen und Scouting-Sichten mit sich — nichts davon gilt
// hier. Die PREISRECHNUNG wird von dort uebernommen (`buildTransfermarktSaleFactorBreakdown`),
// damit Angebot und regulaerer Verkauf nicht auseinanderlaufen.

import type { GameState, Player, RosterEntry, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { assessPlayerMorale } from "@/lib/morale/player-morale-service";
import { derivePlayerNatureDemandSignals } from "@/lib/market/contract-negotiation-preview";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";

/** Moral-Schwelle, ab der ein Spieler ueber einen Wechsel nachdenkt (siehe getContractIntent). */
export const DISSOLUTION_MORALE_THRESHOLD = 34;

/**
 * Moral-Abzug, wenn der Manager die Aufloesung ablehnt.
 *
 * GEMELDET: „bekommt dann noch mal einen großen Moral Malus von -20 oder so — damit seine
 * leistung auch spürbar schlechter wird und man es nicht nutzt um zu wissen ja der spieler will
 * eh raus dann kann ich ihn nächste saison abgeben".
 *
 * Die frueheren 6 Punkte waren zu wenig, um die Entscheidung zu tragen: ablehnen kostete kaum
 * etwas, und wer wusste, dass der Spieler ohnehin weg will, konnte in Ruhe abwarten. Jetzt
 * bricht die Moral so weit ein, dass die Leistung in der Zwischensaison spuerbar leidet.
 */
export const DISSOLUTION_DECLINE_MORALE_PENALTY = 20;

export type ContractDissolutionOffer = {
  playerId: string;
  playerName: string;
  teamId: string;
  /** Moral zum Zeitpunkt des Angebots — die Begruendung des Spielers. */
  morale: number;
  /** Was das Team bei Annahme bekommt: Marktwert x Verkaufsfaktor, brutto. */
  salePrice: number;
  /** Offener Rest-Buyout VOR dem Verzicht (0, wenn der Vertrag ohnehin auslaeuft). */
  openBuyout: number;
  /** Anteil davon, auf den der Spieler verzichtet. */
  waivedBuyout: number;
  /** Was das Team trotz Aufloesung noch zahlt — `openBuyout` minus Verzicht. */
  payableBuyout: number;
  /** Der Verzichtsanteil selbst (0…1), damit die Anzeige „x %" nennen kann statt nur den Betrag. */
  waiverShare: number;
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

/**
 * Moral je Kaderspieler eines Teams — die Bruecke zu `buildContractDissolutionOffers`.
 *
 * Die Angebots-Funktion leitet die Moral bewusst NICHT selbst ab, damit ihr Wert nicht von dem
 * wegdriftet, was in der Oberflaeche steht. Diese Schleife stand deshalb frueher DREIMAL: in
 * `contract-dissolution-local-service` (Route), in `game-inbox-service` (Inbox) — und waere mit
 * der KI-Entscheidung ein viertes Mal entstanden. Sie gehoert hierher, neben die Funktion, die
 * ihr Ergebnis verlangt.
 */
export function buildTeamMoraleMap(gameState: GameState, teamId: string): Record<string, number> {
  const moraleByPlayerId: Record<string, number> = {};
  for (const rosterEntry of gameState.rosters ?? []) {
    if (rosterEntry.teamId !== teamId) continue;
    const assessment = assessPlayerMorale({ gameState, playerId: rosterEntry.playerId, teamId });
    if (assessment?.morale != null && Number.isFinite(assessment.morale)) {
      moraleByPlayerId[rosterEntry.playerId] = assessment.morale;
    }
  }
  return moraleByPlayerId;
}

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

    const zuvorAbgelehnt = log.some(
      (entry) => entry.playerId === player.id && entry.teamId === input.teamId && entry.decision === "declined",
    );
    const priced = priceDissolution(input.gameState, player, rosterEntry, {
      morale,
      previouslyDeclined: zuvorAbgelehnt,
    });
    if (priced == null) continue;

    offers.push({
      playerId: player.id,
      playerName: player.name,
      teamId: input.teamId,
      morale: Number(morale.toFixed(1)),
      salePrice: priced.salePrice,
      openBuyout: priced.openBuyout,
      waivedBuyout: priced.waivedBuyout,
      payableBuyout: priced.payableBuyout,
      waiverShare: priced.waiverShare,
      remainingContractLength: rosterEntry.contractLength ?? 0,
      previouslyDeclined: zuvorAbgelehnt,
    });
  }

  // Teuerster Abgang zuerst — das ist die Entscheidung, die am meisten weh tut.
  return offers.sort((left, right) => right.salePrice - left.salePrice || left.playerId.localeCompare(right.playerId));
}

/**
 * WIE VIEL DER SPIELER AUFGIBT — der Anteil am offenen Rest-Buyout.
 *
 * GEMELDET: „buyout soll nicht zu 100% weg fallen sondern nur anteilig je nachdem was der
 * spieler noch für forderungen stellt. sonst wäre das ja OP. so bekommt man ggf. positiven MW +
 * kein Buyout! dann macht man sogar noch gewinn beim verkauf."
 *
 * Stimmt: mit vollem Verzicht war die Annahme IMMER besser als ein regulaerer Verkauf, also gar
 * keine Entscheidung. Zwei Groessen bestimmen den Anteil jetzt:
 *
 * 1. MORAL — der Ausloeser des Angebots und das, was der Spieler „noch fordert". An der Schwelle
 *    (34) gibt er 30 % auf, bei Moral 0 sind es 60 %. Wer unbedingt weg will, laesst mehr liegen.
 *
 * 2. CHARAKTER — dasselbe Verhandlungswesen, das auch die Nachverhandlungs-Forderung treibt
 *    (`derivePlayerNatureDemandSignals`: Traits, Subklasse, Gesinnung). Es wirkt hier GEGEN den
 *    Verzicht: ein Mercenary/Egomaniac will sein Geld und sitzt den Vertrag notfalls ab, ein
 *    loyaler/bescheidener Spieler geht sauber und guenstig. Genau der Fall aus der Rueckfrage —
 *    „müsste es bei manchen Spielern nicht sogar anders laufen?"
 *
 * Und die zweite Anfrage nach einer Ablehnung laeuft deshalb je nach Wesen in verschiedene
 * Richtungen (`DISSOLUTION_SECOND_ASK_SHIFT`): der Bescheidene fragt zerknirscht und gibt mehr
 * auf, der Harte nimmt es persoenlich und gibt weniger. Sonst waere Ablehnen ein sicherer Weg,
 * den Verzicht hochzufarmen — „so soll das ja nicht sein".
 */

/** Verzicht an der Moral-Schwelle (34) — der guenstigste Fall fuer den Spieler. */
export const DISSOLUTION_WAIVER_AT_THRESHOLD = 0.3;
/** Zusaetzlicher Verzicht bei Moral 0 — zusammen also die Spanne 30…60 %. */
export const DISSOLUTION_WAIVER_MORALE_SPAN = 0.3;
/**
 * Wie stark das Verhandlungswesen den Verzicht dreht. Der Multiplikator aus
 * `derivePlayerNatureDemandSignals` liegt in [0,85; 1,18]; mal 2 ergibt das rund [0,64; 1,30] —
 * spuerbar, aber die Moral bleibt der Haupttreiber.
 */
export const DISSOLUTION_NATURE_WEIGHT = 2;
/** Verschiebung bei der zweiten Anfrage nach einer Ablehnung — Vorzeichen je nach Wesen. */
export const DISSOLUTION_SECOND_ASK_SHIFT = 0.1;
/** Ab hier gilt ein Spieler als harter Verhandler (Multiplikator ueber neutral). */
export const DISSOLUTION_HARD_NEGOTIATOR_THRESHOLD = 1.02;
/** Der Verzicht bleibt in diesen Grenzen — weder geschenkt noch wirkungslos. */
export const DISSOLUTION_WAIVER_MIN = 0.15;
export const DISSOLUTION_WAIVER_MAX = 0.75;

/** Marken der Aufloesungs-Buchung im Hauptbuch (`transferHistory`), siehe acceptContractDissolution. */
export const CONTRACT_DISSOLUTION_TRANSFER_SOURCE = "contract_dissolution_accepted";
export const CONTRACT_DISSOLUTION_TRANSFER_PHASE = "contract_dissolution";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/** Verzichtsanteil am offenen Rest-Buyout, 0…1. Getrennt gehalten, damit Tests ihn direkt messen. */
export function resolveDissolutionWaiverShare(input: {
  player: Player;
  morale: number;
  previouslyDeclined: boolean;
}): number {
  const morale = clamp(input.morale, 0, DISSOLUTION_MORALE_THRESHOLD);
  const grundVerzicht =
    DISSOLUTION_WAIVER_AT_THRESHOLD + DISSOLUTION_WAIVER_MORALE_SPAN * (1 - morale / DISSOLUTION_MORALE_THRESHOLD);

  const naturMultiplikator = derivePlayerNatureDemandSignals(input.player).salaryMultiplier;
  const charakterFaktor = 1 - (naturMultiplikator - 1) * DISSOLUTION_NATURE_WEIGHT;
  const istHartnaeckig = naturMultiplikator > DISSOLUTION_HARD_NEGOTIATOR_THRESHOLD;

  const zweiteAnfrage = input.previouslyDeclined
    ? istHartnaeckig
      ? -DISSOLUTION_SECOND_ASK_SHIFT
      : DISSOLUTION_SECOND_ASK_SHIFT
    : 0;

  return clamp(grundVerzicht * charakterFaktor + zweiteAnfrage, DISSOLUTION_WAIVER_MIN, DISSOLUTION_WAIVER_MAX);
}

/**
 * Preis der Aufloesung. Nutzt dieselbe Rechnung wie der regulaere Verkauf, damit das
 * Angebot nicht von der VK-Spalte in der Spielerliste abweicht.
 */
export function priceDissolution(
  gameState: GameState,
  player: Player,
  rosterEntry: RosterEntry,
  options?: { morale?: number; previouslyDeclined?: boolean },
): { salePrice: number; openBuyout: number; waivedBuyout: number; payableBuyout: number; waiverShare: number } | null {
  const economy = resolvePlayerEconomyContract({ player, rosterEntry });
  const breakdown = buildTransfermarktSaleFactorBreakdown(gameState, player, rosterEntry);
  const salePrice = breakdown.salePrice ?? economy.marketValue ?? null;
  if (salePrice == null || salePrice <= 0) return null;

  // Der offene Rest-Buyout wie beim regulaeren Verkauf: das laufende Vertragsjahr ist zum
  // Saisonende gespielt, uebrig bleiben die Folgejahre.
  const remaining = Math.max(0, (rosterEntry.contractLength ?? 0) - 1);
  const openBuyout = roundMoney(remaining * (rosterEntry.salary ?? 0));

  const waiverShare = resolveDissolutionWaiverShare({
    player,
    morale: options?.morale ?? DISSOLUTION_MORALE_THRESHOLD,
    previouslyDeclined: options?.previouslyDeclined ?? false,
  });
  const waivedBuyout = roundMoney(openBuyout * waiverShare);
  const payableBuyout = roundMoney(Math.max(0, openBuyout - waivedBuyout));

  return {
    salePrice: roundMoney(salePrice),
    openBuyout,
    waivedBuyout,
    payableBuyout,
    waiverShare: Number(waiverShare.toFixed(4)),
  };
}

type DecisionInput = {
  gameState: GameState;
  offer: ContractDissolutionOffer;
  seasonId: string;
  saveId: string;
  decidedAt: string;
};

/**
 * Annahme: Der Spieler geht, das Team kassiert den Verkaufspreis und zahlt den NICHT erlassenen
 * Teil des Rest-Buyouts. Reine Transformation — kein Transferfenster, keine Wiederkauf-Sperre.
 *
 * Der `payableBuyout` ist der Kern der Meldung: vorher floss der Verkaufspreis ungekuerzt aufs
 * Konto, egal wie lang und teuer der Vertrag noch lief. Annehmen war damit nie falsch. Aeltere
 * Angebote ohne das Feld (im Zustand gespeicherte Zeilen) verhalten sich unveraendert.
 *
 * DIE BUCHUNG GEHOERT HIERHER. Die Aufloesung bewegte Cash (`salePrice − payableBuyout`), schrieb
 * aber nur ihren eigenen Log (`contractDissolutions`) — und der ist kein Hauptbuch: keine
 * Finanz-Abstimmung liest ihn. Am Live-Abbild war das die einzige Luecke bei Stronghold Crusaders:
 * zwei angenommene Aufloesungen ueber 30,15 C Verkaufserloes minus 5,51 C Rest-Buyout ⇒ +24,64 C,
 * die in keiner Historie standen. Jetzt entsteht der `transferHistory`-Eintrag an DERSELBEN Stelle
 * wie die Zahlung, mit `netCashImpact` = tatsaechliche Kassenwirkung.
 *
 * Bewusst `contract_exit` und nicht `sell`: die Aufloesung ist ein beendeter Vertrag, kein
 * Marktverkauf. Ein `sell` wuerde zusaetzlich die Wiederkauf-Sperre der Saison ausloesen
 * (`transfer-sold-cooldown.ts` wertet nur `transferType === "sell"`), was hier niemand entschieden
 * hat. Eigene `phase`, damit die Fensterzuordnung den Eintrag bei seiner Saison laesst.
 */
export function acceptContractDissolution(input: DecisionInput): GameState {
  const { gameState, offer } = input;

  const kassenwirkung = roundMoney(offer.salePrice - (offer.payableBuyout ?? 0));
  const teams = gameState.teams.map((team) =>
    team.teamId === offer.teamId ? { ...team, cash: roundMoney((team.cash ?? 0) + kassenwirkung) } : team,
  );

  const rosterEntry = gameState.rosters.find(
    (entry) => entry.teamId === offer.teamId && entry.playerId === offer.playerId,
  );
  const rosters = gameState.rosters.filter(
    (entry) => !(entry.teamId === offer.teamId && entry.playerId === offer.playerId),
  );

  const buchung: TransferHistoryEntry = {
    id: `contract-dissolution:${input.seasonId}:${offer.teamId}:${offer.playerId}`,
    playerId: offer.playerId,
    playerName: offer.playerName,
    seasonId: input.seasonId,
    seasonLabel: getCanonicalSeasonLabel({ seasonId: input.seasonId, seasonName: gameState.season?.name }),
    matchdayId: gameState.matchdayState?.matchdayId ?? null,
    phase: CONTRACT_DISSOLUTION_TRANSFER_PHASE,
    source: CONTRACT_DISSOLUTION_TRANSFER_SOURCE,
    transferType: "contract_exit",
    fromTeamId: offer.teamId,
    toTeamId: null,
    fee: offer.salePrice,
    buyoutCost: offer.payableBuyout ?? 0,
    netCashImpact: kassenwirkung,
    salary: roundMoney(rosterEntry?.salary ?? 0),
    marketValue: offer.salePrice,
    remainingContractLength: 0,
    happenedAt: input.decidedAt,
  };
  const history = gameState.transferHistory ?? [];
  const transferHistory = history.some((entry) => entry.id === buchung.id) ? history : [buchung, ...history];

  return {
    ...gameState,
    teams,
    rosters,
    transferHistory,
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

  // Der Abzug landet auf der GESPEICHERTEN Moral (`playerMoraleState`) — das ist die
  // Groesse, aus der `assessPlayerMorale` den angezeigten Wert und damit auch
  // `contractIntent` ableitet. Ohne diesen Schritt waere eine Ablehnung folgenlos: der
  // Spieler bliebe, ohne dass es ihn etwas kostet, und genau das ist der Kern der Regel.
  // Hat der Spieler noch keine gespeicherte Zeile, gibt es nichts zu senken — dann bleibt
  // es beim Log-Eintrag, statt eine Moral-Zeile aus dem Nichts zu erfinden.
  const playerMoraleState = (gameState.playerMoraleState ?? []).map((entry) =>
    entry.playerId === offer.playerId && entry.teamId === offer.teamId
      ? { ...entry, morale: applyDeclinePenalty(entry.morale) }
      : entry,
  );

  return {
    ...gameState,
    playerMoraleState,
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
