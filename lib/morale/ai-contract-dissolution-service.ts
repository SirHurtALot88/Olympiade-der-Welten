// =====================================================================================
// Vertragsaufloesung: die Entscheidung der KI
// =====================================================================================
//
// WARUM ES DAS GIBT. `buildContractDissolutionOffers` war von Anfang an teamneutral — sie nimmt
// eine `teamId` entgegen und rechnet fuer jedes Team gleich. Gerufen wurde sie aber nur aus der
// Inbox des Managerteams (`game-inbox-service`) und aus der API-Route (`contract-dissolution-
// local-service`), also zweimal fuer den MENSCHEN. Fuer die 31 KI-Teams entschied niemand.
// Nachgemessen am Live-Abbild (Saison 2, Spieltag 10): der Aufloesungs-Log trug 2 Eintraege,
// beide vom Managerteam, kein einziger von einem KI-Team.
//
// GLEICHE LOGIK, KEIN ZWEITER REGELSATZ. Dieser Dienst rechnet KEINE Preise. Er ruft dieselbe
// `buildContractDissolutionOffers` wie der Mensch (also dieselbe Moralschwelle, denselben
// Verzichtsanteil, dieselbe Einmal-pro-Saison-Sperre, denselben Aufschlag nach einer Ablehnung)
// und wendet dieselben `acceptContractDissolution`/`declineContractDissolution` an (also dieselbe
// Buchung in die Transferhistorie und dieselbe Moral-Strafe). Neu ist hier ausschliesslich die
// ANTWORT auf das Angebot — beim Menschen ein Knopf, bei der KI diese Abwaegung.
//
// WO IM ABLAUF. Der Aufruf sitzt in `computeSeasonEndContractTick` (contract-renewal-service),
// also im Saisonende-Vertrags-Tick. Drei Gruende:
//
//   1. GLEICHES FENSTER WIE DER MENSCH. Der Mensch entscheidet in der Saisonende-Kette
//      (`SEASON_END_ROSTER_PHASES`); der Tick ist der Moment, in dem diese Kette abgeschlossen
//      wird. Die KI entscheidet damit am Ende desselben Fensters, nicht in einem eigenen.
//   2. VOR DER KAUFPHASE. Der Tick laeuft als erster Schritt von `buildNextSeasonGameState`;
//      das Kauffenster der neuen Saison oeffnet erst danach (`isEarlySeasonTransferSetup`,
//      transfer-window-policy). Ein Team, dessen Kader durch die Aufloesung duenn wird, kann
//      also anschliessend wieder einkaufen — deshalb ist die Mindestkadergroesse hier auch KEINE
//      Sperre (Chris: „Doch KI darf unter minimum aufloesen weil sie danach ja noch kaufen!"),
//      sondern nur ein Gewicht in der Abwaegung.
//   3. VOR DER VERTRAGSALTERUNG. Der Preis des Angebots rechnet mit `contractLength - 1` (das
//      laufende Vertragsjahr ist gespielt). Liefe die Aufloesung NACH dem Tick, waere der Vertrag
//      schon fortgeschrieben und der Buyout um ein Jahr zu klein.
//
// Ein eigener Sonderweg (eigene Route, eigener Cron) waere die vierte Stelle, an der jemand am
// Saisonende in den Kader schreibt. Der Tick ist bereits idempotent (`hasSeasonEndContractTick-
// Applied`) und laeuft in beiden echten Pfaden — Saisonuebergang und Sim-Apply.

import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { resolveContractExitRenewBias } from "@/lib/contracts/contract-exit-renew-bias";
import {
  acceptContractDissolution,
  applyDeclinePenalty,
  buildContractDissolutionOffers,
  buildTeamMoraleMap,
  declineContractDissolution,
  DISSOLUTION_MORALE_THRESHOLD,
  type ContractDissolutionOffer,
} from "@/lib/morale/contract-dissolution-service";

/**
 * Was die KI ueber den Spieler weiss, den sie ziehen lassen soll. Bewusst als schmale Struktur
 * und nicht als `ContractRenewalPreviewRow`: der Dienst soll auch dann entscheiden koennen, wenn
 * kein Vertrags-Vorschau-Lauf vorliegt (Tests, Sim). Fehlt die Zeile, faellt die Abwaegung auf
 * die Werte aus dem Kader zurueck — sie wird dadurch vorsichtiger, nicht falsch.
 */
export type AiDissolutionRenewalSignal = {
  /** Wuerde die Vertrags-Vorschau diesen auslaufenden Vertrag verlaengern (und koennte sie es)? */
  wouldRenew: boolean;
  /** Gehalt der Verlaengerung — das ist der Preis dafuer, ihn ueber das Saisonende hinaus zu halten. */
  renewalSalary: number | null;
  /** Laufzeit der Verlaengerung in Saisons. */
  renewalLength: number;
};

export type AiDissolutionDecision = {
  teamId: string;
  playerId: string;
  playerName: string;
  decision: "accepted" | "declined";
  /** Kurzcode der Begruendung — landet im Log und in den Tests. */
  reason: AiDissolutionReason;
  /** Sofortige Kassenwirkung der Annahme: Verkaufserloes minus zahlbarer Rest-Buyout. */
  netCash: number;
  /** Gehalt, das die Annahme spart (Restlaufzeit x Gehalt). */
  savedSalary: number;
  /** Was die Annahme insgesamt einbringt: `netCash + savedSalary`. */
  exitGain: number;
  /** Was der Spieler dem Team noch wert ist, wenn es ihn behaelt. */
  keepWorth: number;
  moraleFactor: number;
  rosterFactor: number;
  qualityFactor: number;
  rosterBefore: number;
  rosterAfter: number;
  playerMin: number;
  cashBefore: number;
  morale: number;
};

export type AiDissolutionReason =
  /** Ablehnen: die Aufloesung KOSTET netto Geld, und die Kasse traegt das nicht. */
  | "cash_floor"
  /** Ablehnen: der Spieler ist dem Team mehr wert als Erloes plus gespartes Gehalt. */
  | "keep_worth_higher"
  /** Ablehnen: die Vertrags-Vorschau will ihn verlaengern — das Team wollte ihn behalten. */
  | "renewal_wanted"
  /** Annehmen: Erloes plus gespartes Gehalt schlagen seinen Restwert. */
  | "exit_gain_higher"
  /** Annehmen: der Vertrag endet an diesem Saisonende ohnehin und wird nicht verlaengert. */
  | "contract_ends_anyway";

/**
 * WIE VIEL EIN UNZUFRIEDENER SPIELER NOCH WERT IST.
 *
 * Der Marktwert misst, was er KANN. Was er dem Team noch BRINGT, ist weniger: er spielt die
 * Restlaufzeit mit gedrueckter Moral, und eine Ablehnung senkt sie um weitere
 * `DISSOLUTION_DECLINE_MORALE_PENALTY` Punkte — genau die Moral, mit der er nach einem „Nein"
 * auflaeuft. Deshalb rechnet der Faktor mit `applyDeclinePenalty(morale)` und nicht mit der Moral
 * VOR der Entscheidung: die Ablehnung ist der Zustand, den sie bewertet.
 *
 * Die Spanne ist bewusst schmal. Ein Spieler wird durch schlechte Laune nicht wertlos — er wird
 * unzuverlaessig. Bei Moral 0 nach der Ablehnung bleiben `MORALE_FLOOR`, an der Schwelle (34,
 * nach Abzug also 14) sind es rund 0,82.
 */
export const AI_DISSOLUTION_MORALE_FLOOR = 0.7;

/**
 * KADERGROESSE ALS GEWICHT, NICHT ALS SPERRE.
 *
 * Chris ausdruecklich: „Doch KI darf unter minimum aufloesen weil sie danach ja noch kaufen!"
 * Die Aufloesung liegt vor dem Kauffenster (siehe Kopf dieser Datei), also ist ein kurzzeitig zu
 * kleiner Kader kein Zustand, mit dem das Team in einen Spieltag geht. Trotzdem laesst ein duenn
 * besetztes Team einen brauchbaren Spieler nicht so leicht ziehen wie ein volles: je weiter der
 * Kader nach dem Abgang unter dem Soll (`playerOpt`) laege, desto mehr ist der Spieler wert.
 */
export const AI_DISSOLUTION_ROSTER_STEP = 0.09;
export const AI_DISSOLUTION_ROSTER_MIN = 0.72;
export const AI_DISSOLUTION_ROSTER_MAX = 1.45;

/**
 * QUALITAET, GEMESSEN AM EIGENEN KADER.
 *
 * Absolute OVR-Schwellen waeren eine zweite Meinung darueber, was „gut" heisst — die Liga hat
 * dafuer schon Rangzahlen. Hier zaehlt die Frage, die das Team wirklich stellt: ist er bei UNS
 * einer der Besseren? Der Anteil des eigenen Kaders, den er ueberragt, geht linear ein.
 */
export const AI_DISSOLUTION_QUALITY_MIN = 0.78;
export const AI_DISSOLUTION_QUALITY_MAX = 1.3;

/**
 * Aufschlag auf den Behalten-Wert, wenn der Abgang eine Abschreibung realisiert (Verkaufserloes
 * unter Kaufpreis). Dieselbe Ueberlegung wie beim Verlaengern gegen Ziehenlassen — der Wert kommt
 * aus `resolveContractExitRenewBias` (contract-renewal-service), nicht aus einer zweiten Formel.
 */
export const AI_DISSOLUTION_LOSS_RESISTANCE = 1.18;

/**
 * Was das Team beim Behalten eines AUSLAUFENDEN Vertrags noch in der Hand hat.
 *
 * Laeuft der Vertrag an diesem Saisonende aus und will die Vorschau ihn verlaengern, kostet das
 * Behalten `renewalSalary x renewalLength`. Der Restwert ist also der Marktwert MINUS diese
 * Kosten — und nie unter 0.
 */
function resolveKeepBasis(input: {
  marketValue: number;
  remainingYears: number;
  renewal: AiDissolutionRenewalSignal | null;
}): { keepBasis: number; contractEndsAnyway: boolean } {
  if (input.remainingYears >= 1) {
    // Der Spieler gehoert dem Team noch — sein voller Marktwert steht auf der Behalten-Seite.
    return { keepBasis: input.marketValue, contractEndsAnyway: false };
  }
  if (input.renewal == null) {
    // Ohne Vertrags-Vorschau ist NICHT bekannt, ob das Team ihn ohnehin ziehen laesst. Dann gilt
    // der vorsichtige Fall: er zaehlt als Spieler, den das Team noch hat. Die Gegenrichtung waere
    // die gefaehrliche — sie liesse eine fehlende Zeile wie ein „geht sowieso" aussehen und
    // machte die KI ausgerechnet dort williger, wo sie am wenigsten weiss.
    return { keepBasis: input.marketValue, contractEndsAnyway: false };
  }
  if (input.renewal.wouldRenew) {
    const kosten = (input.renewal.renewalSalary ?? 0) * Math.max(1, input.renewal.renewalLength);
    return { keepBasis: Math.max(0, input.marketValue - kosten), contractEndsAnyway: false };
  }
  // Der Vertrag endet an diesem Saisonende, und niemand verlaengert ihn. Ablehnen haelt den
  // Spieler KEINEN Tag laenger — er geht beim Vertrags-Tick mit demselben Erloes
  // (`buildContractExitValue` nutzt dieselbe `buildTransfermarktSaleFactorBreakdown` wie
  // `priceDissolution`). Behalten hat hier also keinen Wert, und die Ablehnung kostet nur Moral.
  return { keepBasis: 0, contractEndsAnyway: true };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

/**
 * DIE ABWAEGUNG.
 *
 * Zwei Zahlen in derselben Waehrung (Marktwert-Einheiten) stehen sich gegenueber:
 *
 *   ANNEHMEN  = Verkaufserloes − zahlbarer Rest-Buyout + gespartes Restgehalt
 *   BEHALTEN  = Restwert des Spielers x Moral x Kadergroesse x Qualitaet
 *
 * Davor steht genau eine harte Sperre, und sie betrifft nicht den Kader, sondern die Kasse:
 * eine Aufloesung KANN netto Geld kosten (langer teurer Vertrag, kleiner Verkaufserloes — dann
 * ist `payableBuyout > salePrice`). Ein Team, das dafuer ins Minus rutschen wuerde, lehnt ab; es
 * muss in der folgenden Kaufphase noch handlungsfaehig sein. Ein Team, das schon im Minus steht,
 * darf die Aufloesung trotzdem annehmen, solange sie Geld BRINGT — genau dann hilft sie ihm.
 */
export function decideAiContractDissolution(input: {
  offer: ContractDissolutionOffer;
  /** Marktwert des Spielers — dieselbe Groesse, aus der der Verkaufserloes gebildet wird. */
  marketValue: number;
  /** Gehalt des laufenden Vertrags. */
  salary: number;
  /** Restlaufzeit NACH dem laufenden Jahr, wie in `priceDissolution`. */
  remainingYears: number;
  /** Kaufpreis, fuer die Abschreibungs-Resistenz. */
  purchasePrice: number | null;
  /** Qualitaetsanteil im eigenen Kader, 0…1 (0 = schlechtester, 1 = bester). */
  qualityShareInTeam: number;
  ratingValue: number;
  rosterBefore: number;
  playerMin: number;
  playerOpt: number;
  cashBefore: number;
  renewal: AiDissolutionRenewalSignal | null;
}): AiDissolutionDecision {
  const { offer } = input;
  const netCash = round(offer.salePrice - (offer.payableBuyout ?? 0), 2);
  const savedSalary = round(Math.max(0, input.remainingYears) * (input.salary ?? 0), 2);
  const exitGain = round(netCash + savedSalary, 2);
  const rosterAfter = input.rosterBefore - 1;

  const basis = {
    teamId: offer.teamId,
    playerId: offer.playerId,
    playerName: offer.playerName,
    netCash,
    savedSalary,
    exitGain,
    rosterBefore: input.rosterBefore,
    rosterAfter,
    playerMin: input.playerMin,
    cashBefore: round(input.cashBefore, 2),
    morale: offer.morale,
  };

  // PLEITE-WACHE. Nur wenn die Aufloesung netto GELD KOSTET und die Kasse das nicht traegt.
  if (netCash < 0 && input.cashBefore + netCash < 0) {
    return {
      ...basis,
      decision: "declined",
      reason: "cash_floor",
      keepWorth: 0,
      moraleFactor: 0,
      rosterFactor: 0,
      qualityFactor: 0,
    };
  }

  // Moral NACH der Ablehnung — das ist der Zustand, mit dem er weiterspielen wuerde.
  const moraleAfterDecline = applyDeclinePenalty(offer.morale);
  const moraleFactor = round(
    AI_DISSOLUTION_MORALE_FLOOR +
      (1 - AI_DISSOLUTION_MORALE_FLOOR) * clamp(moraleAfterDecline / DISSOLUTION_MORALE_THRESHOLD, 0, 1),
  );

  const rosterFactor = round(
    clamp(
      1 + (input.playerOpt - rosterAfter) * AI_DISSOLUTION_ROSTER_STEP,
      AI_DISSOLUTION_ROSTER_MIN,
      AI_DISSOLUTION_ROSTER_MAX,
    ),
  );

  const qualityFactor = round(
    AI_DISSOLUTION_QUALITY_MIN +
      (AI_DISSOLUTION_QUALITY_MAX - AI_DISSOLUTION_QUALITY_MIN) * clamp(input.qualityShareInTeam, 0, 1),
  );

  const { keepBasis, contractEndsAnyway } = resolveKeepBasis({
    marketValue: input.marketValue,
    remainingYears: input.remainingYears,
    renewal: input.renewal,
  });

  // Abschreibungs-Resistenz aus dem Vertragsdienst — dieselbe Ueberlegung, die dort ueber
  // Verlaengern gegen Ziehenlassen entscheidet. Kein zweiter Rechenweg fuer denselben Gedanken.
  const exitBias = resolveContractExitRenewBias({
    exitProfitLoss: input.purchasePrice == null ? null : round(offer.salePrice - input.purchasePrice, 2),
    exitPurchasePrice: input.purchasePrice,
    exitValue: offer.salePrice,
    renewalSalary: input.renewal?.renewalSalary ?? null,
    currentSalary: input.salary ?? null,
    ratingValue: input.ratingValue,
    badValueContract: false,
  });
  const lossResistance = exitBias.shouldBiasRenew ? AI_DISSOLUTION_LOSS_RESISTANCE : 1;

  const keepWorth = round(keepBasis * moraleFactor * rosterFactor * qualityFactor * lossResistance, 2);
  const accept = exitGain > keepWorth;

  return {
    ...basis,
    decision: accept ? "accepted" : "declined",
    reason: accept
      ? contractEndsAnyway
        ? "contract_ends_anyway"
        : "exit_gain_higher"
      : input.renewal?.wouldRenew
        ? "renewal_wanted"
        : "keep_worth_higher",
    keepWorth,
    moraleFactor,
    rosterFactor,
    qualityFactor,
  };
}

/**
 * Qualitaetsanteil im eigenen Kader: der Anteil der Mitspieler, den dieser Spieler ueberragt.
 *
 * Gemessen am Marktwert des Kaders. Der Marktwert ist die einzige Groesse, die JEDER Spieler
 * traegt — OVR ist bei organisch erzeugten Spielern haeufig `null`, und ein Feld, das die Haelfte
 * der Liga nicht schreibt, taugt nicht als Rangquelle.
 */
export function resolveQualityShareInTeam(values: number[], value: number): number {
  const others = values.filter((entry) => Number.isFinite(entry));
  if (others.length <= 1) return 0.5;
  const schlechter = others.filter((entry) => entry < value).length;
  return schlechter / (others.length - 1);
}

export type AiContractDissolutionRunResult = {
  gameState: GameState;
  decisions: AiDissolutionDecision[];
  acceptedCount: number;
  declinedCount: number;
};

/**
 * Alle KI-Teams durch ihre offenen Aufloesungs-Angebote fahren und entscheiden.
 *
 * Reine GameState-Transformation, kein Persistieren — der Aufrufer (`computeSeasonEndContractTick`)
 * schreibt zusammen mit seinen eigenen Aenderungen genau einmal.
 *
 * Reihenfolge innerhalb eines Teams: `buildContractDissolutionOffers` sortiert nach Verkaufspreis
 * absteigend. Die Angebote werden NACHEINANDER entschieden und der GameState dazwischen
 * fortgeschrieben — sonst wuerde ein Team mit drei Angeboten dreimal denselben Kaderstand und
 * dieselbe Kasse sehen und koennte sich unbemerkt leer entscheiden.
 */
export function applyAiContractDissolutions(input: {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  decidedAt: string;
  /** Verlaengerungs-Signal je `teamId:playerId`, aus der Vertrags-Vorschau. Optional. */
  renewalSignals?: Map<string, AiDissolutionRenewalSignal>;
}): AiContractDissolutionRunResult {
  let gameState = input.gameState;
  const decisions: AiDissolutionDecision[] = [];
  const playersById = new Map(input.gameState.players.map((player) => [player.id, player] as const));

  for (const team of input.gameState.teams) {
    // Das Managerteam entscheidet selbst — ueber Inbox und Kader-Ansicht. Alles andere (KI wie
    // passiv gefuehrte Teams) bekommt hier eine Entscheidung, sonst bliebe die Aufloesung wieder
    // ein Sonderrecht des Menschen.
    const controlMode =
      getTeamControlSettings(gameState, team.teamId)?.controlMode ?? (team.humanControlled ? "manual" : "ai");
    if (controlMode === "manual") continue;

    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const targets = deriveRosterTargets(team, identity);

    // Angebote EINMAL je Team bauen — die Sperre „einmal pro Saison entscheiden" im Dienst sorgt
    // dafuer, dass ein bereits entschiedener Spieler beim naechsten Bau nicht wieder auftaucht.
    const offers = buildContractDissolutionOffers({
      gameState,
      teamId: team.teamId,
      seasonId: input.seasonId,
      saveId: input.saveId,
      moraleByPlayerId: buildTeamMoraleMap(gameState, team.teamId),
    });
    if (offers.length === 0) continue;

    for (const offer of offers) {
      const rosterEntries = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
      const rosterEntry = rosterEntries.find((entry) => entry.playerId === offer.playerId);
      if (!rosterEntry) continue;

      const marketValues = rosterEntries.map((entry) => resolveRosterMarketValue(playersById, entry));
      const marketValue = resolveRosterMarketValue(playersById, rosterEntry);
      const teamRow = gameState.teams.find((entry) => entry.teamId === team.teamId) ?? team;

      const decision = decideAiContractDissolution({
        offer,
        marketValue,
        salary: rosterEntry.salary ?? 0,
        remainingYears: Math.max(0, (rosterEntry.contractLength ?? 0) - 1),
        purchasePrice:
          typeof rosterEntry.purchasePrice === "number" && Number.isFinite(rosterEntry.purchasePrice)
            ? rosterEntry.purchasePrice
            : null,
        qualityShareInTeam: resolveQualityShareInTeam(marketValues, marketValue),
        ratingValue: marketValue,
        rosterBefore: rosterEntries.length,
        playerMin: targets.playerMin,
        playerOpt: targets.playerOpt,
        cashBefore: teamRow.cash ?? 0,
        renewal: input.renewalSignals?.get(`${team.teamId}:${offer.playerId}`) ?? null,
      });
      decisions.push(decision);

      const decisionInput = {
        gameState,
        offer,
        seasonId: input.seasonId,
        saveId: input.saveId,
        decidedAt: input.decidedAt,
      };
      gameState =
        decision.decision === "accepted"
          ? acceptContractDissolution(decisionInput)
          : declineContractDissolution(decisionInput);
    }
  }

  return {
    gameState,
    decisions,
    acceptedCount: decisions.filter((entry) => entry.decision === "accepted").length,
    declinedCount: decisions.filter((entry) => entry.decision === "declined").length,
  };
}

/**
 * Marktwert einer Kaderzeile — aus `resolvePlayerEconomyContract`, also aus derselben Quelle, aus
 * der `priceDissolution` den Verkaufserloes bildet. Eine eigene Fallback-Kette waere die zweite
 * Rechenstelle fuer dieselbe Zahl.
 */
function resolveRosterMarketValue(playersById: Map<string, Player>, entry: RosterEntry): number {
  const player = playersById.get(entry.playerId) ?? null;
  return resolvePlayerEconomyContract({ player, rosterEntry: entry }).marketValue ?? 0;
}
