import type { GameState, RosterEntry, Team } from "@/lib/data/olyDataTypes";

/** Sonderregel/Easter-Egg: Nula ist das Maskottchen von Project Suicide. */
const NULA_PLAYER_ID = "player-2311-nula";
const NULA_TEAM_ID = "P-S";
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
  return { ...gameState, teams, rosters };
}
