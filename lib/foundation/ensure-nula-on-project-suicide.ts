import type { GameState, RosterEntry, Team, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";

/** Sonderregel/Easter-Egg: Nula ist das Maskottchen von Project Suicide. */
const NULA_PLAYER_ID = "player-2311-nula";
const NULA_TEAM_ID = "P-S";

/**
 * Quellen-/Phasenmarken der Sonderregel-Buchungen. Eigene `phase` (NICHT `manual_transfer_window`),
 * damit die Fensterzuordnung (`transfer-window-zuordnung.ts`) den Eintrag nicht in die Folgesaison
 * schiebt — der Kauf gehört zu der Saison, in der er stattfindet.
 */
const NULA_TRANSFER_PHASE = "mascot_rule";
export const NULA_BUY_TRANSFER_SOURCE = "nula_mascot_rule_buy";
export const NULA_SELL_TRANSFER_SOURCE = "nula_mascot_rule_sell";
/**
 * Maximale Vertragslänge. Verlängerungen clampen im contract-renewal-service auf [1,5]; das Maskottchen
 * bekommt immer die 5, damit es nie aus dem Vertrag läuft und P-S nie verlässt.
 */
const NULA_MAX_CONTRACT_LENGTH = 5;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function adjustTeamCash(teams: Team[], teamId: string, delta: number): Team[] {
  if (delta === 0) return teams;
  return teams.map((team) => (team.teamId === teamId ? { ...team, cash: round2(team.cash + delta) } : team));
}

/**
 * Sonderregel: Die Spielerin "Nula" (player-2311-nula) gehört IMMER zu Project Suicide (P-S) — mit
 * maximaler Vertragslänge. Aber sie startet NICHT einfach gratis im Team: P-S muss sie ganz normal
 * KAUFEN und BEZAHLEN. Reiner, persistenzfreier `(gameState) => gameState`-Transform, idempotent:
 * läuft beim Laden jedes Saves (materializePersistedSave) und direkt nach dem Neuspiel-Draft.
 *
 * Fälle:
 *  - Nula schon bei P-S mit Maximalvertrag  ⇒ No-op (unveränderte Referenz).
 *  - Nula schon bei P-S, Vertrag < Maximum  ⇒ reine Vertragsverlängerung auf 5 (KEINE erneute Zahlung).
 *  - Nula bei einem anderen Team            ⇒ Transfer zu P-S: das abgebende Team wird mit dem Preis
 *                                             gutgeschrieben (Verkauf), P-S zahlt den Preis (Kauf),
 *                                             neuer Maximalvertrag.
 *  - Nula ist Free Agent                    ⇒ P-S kauft sie (Cash −Preis), neuer Maximalvertrag.
 * No-op, wenn P-S oder Nula im Save fehlen.
 *
 * Preis = Marktwert (fallback currentValue am Eintrag / 0). Der Kauf ist bilanzneutral konsistent mit
 * dem normalen Transfermarkt: bei einem Team-zu-Team-Transfer wechselt der Preis den Besitzer, beim
 * Free-Agent-Kauf verlässt er wie üblich das System. gameState.contracts wird nicht angefasst (der
 * Live-Signing-Pfad nutzt es nicht — die Vertragsdaten leben am RosterEntry).
 *
 * ENTSCHEIDUNG DES EIGENTÜMERS: „nula ist Sonderregel dennoch muessen auch die teams ihren markt
 * schliessen". Die Sonderregel bleibt — aber sie BUCHT. Jede Cash-Bewegung hier schreibt an
 * DERSELBEN Stelle ihren `transferHistory`-Eintrag (P-S: `buy`, abgebendes Team: `sell`), damit es
 * nicht zwei Stellen gibt: eine, die zahlt, und eine, die Buch führt. Vorher fehlte die Buchung
 * komplett — am Live-Abbild war P-S deshalb das einzige Team, dessen Kasse über zwei Saisons um
 * genau den Nula-Preis (−4,63 C) nicht aufging. Die IDs sind deterministisch (siehe
 * `buildNulaTransferHistory`), damit der Transform idempotent bleibt: er läuft bei JEDEM Laden
 * (`materializePersistedSave`) und darf die Historie nie ein zweites Mal beschreiben.
 *
 * Bewusst NICHT über executeLocalTransfermarktBuy: der Kauf-Helper ist persistenz-/kontextbehaftet und
 * würde an genau den Randfällen scheitern, die hier funktionieren müssen (Nula bereits im Besitz eines
 * anderen Teams ⇒ kein Free Agent ⇒ canBuy=false; P-S-Roster voll ⇒ canBuy=false). Der reine Transform
 * bildet die Zahlung selbst ab und läuft an beiden Aufrufstellen identisch.
 */
export function ensureNulaOnProjectSuicide(gameState: GameState): GameState {
  const team = gameState.teams.find((entry) => entry.teamId === NULA_TEAM_ID);
  if (!team) return gameState;
  const nula = gameState.players.find((player) => player.id === NULA_PLAYER_ID);
  if (!nula) return gameState;

  const existing = gameState.rosters.find((entry) => entry.playerId === NULA_PLAYER_ID);
  const alreadyCorrect =
    existing?.teamId === NULA_TEAM_ID && (existing.contractLength ?? 0) >= NULA_MAX_CONTRACT_LENGTH;
  if (alreadyCorrect) return gameState;

  // Fall: schon bei P-S, aber Vertrag zu kurz → reine Verlängerung, keine (erneute) Zahlung.
  if (existing && existing.teamId === NULA_TEAM_ID) {
    const rosters = gameState.rosters.map((entry) =>
      entry.playerId === NULA_PLAYER_ID
        ? { ...entry, contractLength: NULA_MAX_CONTRACT_LENGTH, contractStatus: "active" as const }
        : entry,
    );
    return { ...gameState, rosters };
  }

  // Fall: Free Agent oder bei einem anderen Team → P-S kauft sie und bezahlt.
  const price = round2(Math.max(0, nula.marketValue ?? existing?.currentValue ?? 0));
  const sellerTeamId = existing?.teamId ?? null;

  // P-S zahlt den Preis; ein evtl. abgebendes Team erhält ihn (Team-zu-Team-Transfer bleibt bilanzneutral).
  let teams = adjustTeamCash(gameState.teams, NULA_TEAM_ID, -price);
  if (sellerTeamId && sellerTeamId !== NULA_TEAM_ID) {
    teams = adjustTeamCash(teams, sellerTeamId, price);
  }

  const nextEntry: RosterEntry = {
    id: existing?.id ?? `roster-${NULA_PLAYER_ID}-project-suicide`,
    teamId: NULA_TEAM_ID,
    playerId: NULA_PLAYER_ID,
    contractLength: NULA_MAX_CONTRACT_LENGTH,
    contractStatus: "active",
    salary: Math.max(0, nula.salaryDemand),
    upkeep: existing?.upkeep ?? 0,
    purchasePrice: price,
    currentValue: price,
    roleTag: existing?.roleTag ?? "bench",
    joinedSeasonId: existing?.joinedSeasonId ?? gameState.season.id,
  };

  // Jeden vorhandenen Nula-Eintrag entfernen (löst sie vom bisherigen Team) und den bezahlten P-S-Eintrag anhängen.
  const rosters = gameState.rosters.filter((entry) => entry.playerId !== NULA_PLAYER_ID);
  rosters.push(nextEntry);

  return {
    ...gameState,
    teams,
    rosters,
    transferHistory: buildNulaTransferHistory({ gameState, nula, price, sellerTeamId }),
  };
}

/**
 * Die Buchung zum Kauf oben — an derselben Stelle, an der das Geld fließt.
 *
 * Kein Preis (0) ⇒ keine Cash-Bewegung ⇒ auch keine Buchung; ein Null-Fee-`buy` wäre für das
 * Finanz-Audit sonst ein `zero_fee_buy`-Verstoß.
 *
 * Die ID trägt die laufende Nummer des Kaufs INNERHALB der Saison (`…:<n>:buy`). Damit gilt beides:
 * wird derselbe gespeicherte Stand mehrfach materialisiert, entsteht immer dieselbe ID und der
 * Eintrag wird genau einmal geschrieben — verlässt Nula P-S aber wirklich und die Regel kauft sie in
 * derselben Saison erneut, ist die Nummer eine andere und der zweite Kauf wird auch wirklich
 * gebucht, statt still unter einer schon vergebenen ID zu verschwinden.
 */
function buildNulaTransferHistory(input: {
  gameState: GameState;
  nula: GameState["players"][number];
  price: number;
  sellerTeamId: string | null;
}): TransferHistoryEntry[] {
  const { gameState, nula, price, sellerTeamId } = input;
  const history = gameState.transferHistory ?? [];
  if (price <= 0) return history;

  const seasonId = gameState.season.id;
  const seasonLabel = getCanonicalSeasonLabel({ seasonId, seasonName: gameState.season.name });
  const happenedAt = new Date().toISOString();
  const lfd = history.filter((entry) => entry.seasonId === seasonId && entry.source === NULA_BUY_TRANSFER_SOURCE).length;
  const common = {
    playerId: NULA_PLAYER_ID,
    playerName: nula.name,
    seasonId,
    seasonLabel,
    matchdayId: gameState.matchdayState?.matchdayId ?? null,
    phase: NULA_TRANSFER_PHASE,
    fee: price,
    marketValue: price,
    salary: Math.max(0, nula.salaryDemand),
    happenedAt,
  } as const;

  const entries: TransferHistoryEntry[] = [
    {
      ...common,
      id: `nula-mascot-rule:${seasonId}:${lfd}:buy`,
      source: NULA_BUY_TRANSFER_SOURCE,
      transferType: "buy",
      // `fromTeamId: null` wie im regulären Kaufpfad (executeLocalTransfermarktBuy). Trüge der
      // Kauf-Eintrag das abgebende Team, zählten Auswertungen, die „Verkäufe" als
      // `fromTeamId === teamId` lesen (z. B. league-achievements-extended.ts), ihn ein zweites Mal
      // als Verkauf — die Abgeber-Seite steht vollständig im Verkaufs-Eintrag unten.
      fromTeamId: null,
      toTeamId: NULA_TEAM_ID,
      netCashImpact: -price,
      remainingContractLength: NULA_MAX_CONTRACT_LENGTH,
    },
  ];
  // Team-zu-Team: das abgebende Team bekommt den Preis gutgeschrieben — also braucht es auch
  // die Gegenbuchung, sonst schlösse dessen Kasse nicht mehr auf.
  if (sellerTeamId && sellerTeamId !== NULA_TEAM_ID) {
    entries.push({
      ...common,
      id: `nula-mascot-rule:${seasonId}:${lfd}:sell`,
      source: NULA_SELL_TRANSFER_SOURCE,
      transferType: "sell",
      fromTeamId: sellerTeamId,
      toTeamId: null,
      buyoutCost: 0,
      netCashImpact: price,
      remainingContractLength: 0,
    });
  }

  const known = new Set(history.map((entry) => entry.id));
  const fresh = entries.filter((entry) => !known.has(entry.id));
  return fresh.length > 0 ? [...fresh, ...history] : history;
}
