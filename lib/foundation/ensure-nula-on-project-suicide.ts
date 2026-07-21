import type { GameState, RosterEntry } from "@/lib/data/olyDataTypes";

/** Sonderregel/Easter-Egg: Nula ist das Maskottchen von Project Suicide. */
const NULA_PLAYER_ID = "player-2311-nula";
const NULA_TEAM_ID = "P-S";
/**
 * Maximale Vertragslänge. Verlängerungen clampen im contract-renewal-service auf [1,5]; das Maskottchen
 * bekommt immer die 5, damit es nie aus dem Vertrag läuft und P-S nie verlässt.
 */
const NULA_MAX_CONTRACT_LENGTH = 5;

/**
 * Sonderregel: Die Spielerin "Nula" (player-2311-nula) gehört IMMER zu Project Suicide (P-S) — mit
 * maximaler Vertragslänge. Reiner, persistenzfreier `(gameState) => gameState`-Transform, idempotent:
 * läuft beim Laden jedes Saves (materializePersistedSave) und direkt nach dem Neuspiel-Draft. Falls der
 * Draft Nula einem anderen Team zugeteilt hat (oder sie Free Agent ist), wird ihr bestehender Roster-
 * Eintrag entfernt und sie auf P-S gesetzt; ist sie schon bei P-S, wird nur ihr Vertrag auf Maximum
 * gehoben/gehalten. No-op, wenn P-S oder Nula im Save fehlen oder sie bereits korrekt mit Maximalvertrag
 * bei P-S steht (verhindert Doppel-Einträge — beide Aufrufstellen sind gefahrlos wiederholbar).
 *
 * Bewusst NICHT über executeLocalTransfermarktBuy: der Kauf-Helper ist seiteneffekt-/persistenzbehaftet
 * und würde an genau den Fällen scheitern, die hier überlebt werden müssen (Nula bereits im Besitz eines
 * anderen Teams ⇒ kein Free Agent ⇒ canBuy=false; P-S-Roster voll ⇒ canBuy=false). Der reine Transform
 * umgeht das und funktioniert an beiden Aufrufstellen identisch. gameState.contracts wird nicht angefasst
 * (der Live-Signing-Pfad nutzt es nicht — die Vertragsdaten leben am RosterEntry).
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

  const marketValue = nula.marketValue ?? existing?.currentValue ?? 0;
  const nextEntry: RosterEntry =
    existing && existing.teamId === NULA_TEAM_ID
      ? { ...existing, contractLength: NULA_MAX_CONTRACT_LENGTH, contractStatus: "active" }
      : {
          id: existing?.id ?? `roster-${NULA_PLAYER_ID}-project-suicide`,
          teamId: NULA_TEAM_ID,
          playerId: NULA_PLAYER_ID,
          contractLength: NULA_MAX_CONTRACT_LENGTH,
          contractStatus: "active",
          salary: existing?.salary ?? Math.max(0, nula.salaryDemand),
          upkeep: existing?.upkeep ?? 0,
          purchasePrice: existing?.purchasePrice ?? marketValue,
          currentValue: marketValue,
          roleTag: existing?.roleTag ?? "bench",
          joinedSeasonId: existing?.joinedSeasonId ?? gameState.season.id,
        };

  // Jeden vorhandenen Nula-Eintrag entfernen (löst sie von einem anderen Team) und den P-S-Eintrag anhängen.
  const rosters = gameState.rosters.filter((entry) => entry.playerId !== NULA_PLAYER_ID);
  rosters.push(nextEntry);
  return { ...gameState, rosters };
}
