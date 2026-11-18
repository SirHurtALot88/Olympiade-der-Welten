import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import {
  isMarketBuyTransferEntry,
  isSeasonOneDraftBuySource,
  SEASON_ONE_DRAFT_BUY_SOURCES,
} from "@/lib/season/transfer-season-policy";
import {
  berechneTransferbuchungFuerTeam,
  berechneTransferbuchungJeTeam,
  type TeamTransferBuchung,
} from "@/lib/season/transferbilanz-buchung";

/**
 * DIE EIGENEN TRANSFERS ZAEHLTEN NICHT MIT — gemeldet als `ls9jfg`:
 * „Transfer im Saisonstand und in der historie sind immernoch falsch berechnet, die Käufe aus S2
 *  müssen gegen die Verkäufe aus S1 gerechnet werden! so wären dann ein paar Teams positiv und ein
 *  paar negativ. Hier sind alle 0 oder schlechter weil nur die Käufe drin sind!"
 *
 * Die Rechenregel darunter war schon richtig (S2+ = Verkaeufe der Vorsaison minus Kaeufe der
 * laufenden). Falsch waren diese beiden Listen: sie kannten nur KI-Quellen. Was Chris SELBST tut —
 * `manual_transfermarkt_sell` und `manual_transfermarkt_buy` — fiel in beiden Richtungen heraus.
 *
 * NACHGEMESSEN an `swnjlk` (Saison 2):
 *
 *   S1-Verkaeufe   ai_preseason_market_sell    0 Eintraege        (die einzige gezaehlte Quelle!)
 *                  manual_transfermarkt_sell   5 Eintraege, 101,5  ← fielen heraus
 *   S2-Kaeufe      ai_preseason_market_buy    33 Eintraege, 774,9
 *                  manual_transfermarkt_buy    7 Eintraege, 145,3  ← fielen heraus
 *
 * Es gab also ueberhaupt keine gezaehlten Verkaeufe, waehrend die Kaeufe zaehlten — genau deshalb
 * standen alle 32 Teams bei „0 oder schlechter". Beide Listen werden symmetrisch ergaenzt; nur
 * eine Seite zu oeffnen haette die Schieflage bloss umgedreht.
 *
 * BEWUSST NICHT AUFGENOMMEN: `ai_roster_fill` (16 Kaeufe, 249,3 in derselben Saison). Das ist
 * laufende Kaderpflege beziehungsweise der organische Erst-Draft, keine Marktbewegung der
 * Vorsaison-Phase — und es war nicht gemeldet. Wenn diese Zeilen mitzaehlen sollen, ist das eine
 * eigene Entscheidung.
 */
export const SEASON_END_MARKET_SELL_SOURCES = [
  "ai_preseason_market_sell",
  "manual_transfermarkt_sell",
] as const;
export const PRESEASON_MARKET_BUY_SOURCES = [
  "preseason_roster_repair_buy",
  "ai_preseason_market_buy",
  "manual_transfermarkt_buy",
] as const;
export const DRAFT_BUY_SOURCES = SEASON_ONE_DRAFT_BUY_SOURCES;

export type StandingsTransferBalance = {
  transferCount: number;
  transferBuyCount: number;
  transferSellCount: number;
  transferBuyTotal: number;
  transferSellTotal: number;
  /** `null` in Saison 1: der Draft ist Kaderaufbau, keine Transferbilanz (Chris 18.11.). */
  transferNet: number | null;
  /** Nur Saison 1: Kaderaufbau aus dem Startbudget (Erloese − Ausgaben), sonst `null`. */
  kaderaufbauNet: number | null;
  kaderaufbauBuyTotal: number | null;
  kaderaufbauBuyCount: number | null;
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function parseSeasonNumber(seasonId: string): number {
  const match = seasonId.match(/season-(\d+)/i);
  return match ? Number(match[1]) : 1;
}

export function previousSeasonId(seasonId: string): string | null {
  const seasonNumber = parseSeasonNumber(seasonId);
  return seasonNumber <= 1 ? null : `season-${seasonNumber - 1}`;
}

export function isDraftBuySource(source: string | null | undefined): boolean {
  return isSeasonOneDraftBuySource(source);
}

export { isMarketBuyTransferEntry };

export function isSeasonEndMarketSell(entry: TransferHistoryEntry): boolean {
  return (
    entry.transferType === "sell" &&
    (SEASON_END_MARKET_SELL_SOURCES as readonly string[]).includes(entry.source ?? "")
  );
}

export function isPreseasonMarketBuy(entry: TransferHistoryEntry): boolean {
  return entry.transferType === "buy" && (PRESEASON_MARKET_BUY_SOURCES as readonly string[]).includes(entry.source ?? "");
}

/**
 * Saisonstand-Transferbilanz — seit 18.11. ueber die EINE Buchungsregel (`transferbilanz-buchung.ts`):
 * „das Fenster vor Saison N gehoert zu Saison N".
 * - S1: KEINE Transferbilanz (`null`, „—"). Draft und Startkader sind Kaderaufbau aus dem Startbudget; die
 *   Verkaeufe am S1-Ende (alter Ablauf) gehoeren zum Fenster von S2.
 * - S2+: Erloese − Ablösen aller Kaeufe/Verkaeufe des Fensters dieser Saison — egal welche Quelle. Im alten
 *   Ablauf sind das die Verkaeufe am Ende der Vorsaison plus die Kaeufe zu Beginn dieser; im gemeinsamen
 *   Fenster liegen beide in dieser Saison vor Spieltag 1.
 *
 * Die Quellenlisten oben bleiben fuer Altaufrufer stehen, zaehlen hier aber nicht mehr: sie liessen schon
 * einmal ganze Transferarten fallen (`ls9jfg`), und die Fensterzuordnung braucht sie nicht.
 */
export function buildStandingsTransferBalanceForTeam(
  gameState: GameState,
  seasonId: string,
  teamId: string,
): StandingsTransferBalance {
  return zuStandingsBilanz(
    berechneTransferbuchungFuerTeam({
      transferHistory: gameState.transferHistory,
      seasonId,
      teamId,
      spieltageProSaison: gameState.season?.matchdayIds?.length ?? null,
    }),
  );
}

function zuStandingsBilanz(buchung: TeamTransferBuchung): StandingsTransferBalance {
  const summe = buchung.transfer;
  return {
    transferCount: (summe?.anzahlKaeufe ?? 0) + (summe?.anzahlVerkaeufe ?? 0),
    transferBuyCount: summe?.anzahlKaeufe ?? 0,
    transferSellCount: summe?.anzahlVerkaeufe ?? 0,
    transferBuyTotal: roundValue(summe?.kaeufe ?? 0),
    transferSellTotal: roundValue(summe?.verkaeufe ?? 0),
    transferNet: buchung.transferNet == null ? null : roundValue(buchung.transferNet),
    kaderaufbauNet: buchung.kaderaufbauNet,
    kaderaufbauBuyTotal: buchung.kaderaufbau?.kaeufe ?? null,
    kaderaufbauBuyCount: buchung.kaderaufbau?.anzahlKaeufe ?? null,
  };
}

export function buildStandingsTransferBalanceByTeamId(gameState: GameState, seasonId: string) {
  const buchung = berechneTransferbuchungJeTeam({
    transferHistory: gameState.transferHistory,
    seasonId,
    teamIds: gameState.teams.map((team) => team.teamId),
    spieltageProSaison: gameState.season?.matchdayIds?.length ?? null,
  });
  return Object.fromEntries(
    gameState.teams.map((team) => [team.teamId, zuStandingsBilanz(buchung.get(team.teamId)!)] as const),
  );
}
