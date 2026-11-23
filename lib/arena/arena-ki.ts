/**
 * KI-LAUF DES ARENA-AUSBAUS (22.11.): schreibt, was `bewerteKiArena` (arena-ki-bewertung.ts) empfiehlt, ueber denselben Weg wie der Mensch (`bauArenaAus`).
 * Nur Server (Persistenz).
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { isBereichDelegiert } from "@/lib/foundation/team-delegation";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";
import { arenaAktiv } from "@/lib/arena/arena-regel";
import { bauArenaAus, ausbauErlaubt } from "@/lib/arena/arena-ausbau";
import { bewerteKiArena } from "@/lib/arena/arena-ki-bewertung";
import type { ArenaBereich } from "@/lib/arena/arena-typen";

export * from "@/lib/arena/arena-ki-bewertung";

export type KiArenaBauErgebnis = { teamsGeprueft: number; gebaut: Array<{ teamId: string; schritte: Partial<Record<ArenaBereich, number>>; kosten: number }>; vomVorstandGesperrt: string[] };

/** Beim Spieltagsabschluss: jedes KI-Team (und jedes Menschen-Team mit delegiertem Gebaeude-Bereich) prueft den Ausbau und baut, was sich lohnt. */
export function bauKiArenaBeiSpieltagsabschluss(input: { saveId: string; persistence?: PersistenceService }): KiArenaBauErgebnis {
  const persistence = input.persistence ?? createPersistenceService();
  const ergebnis: KiArenaBauErgebnis = { teamsGeprueft: 0, gebaut: [], vomVorstandGesperrt: [] };
  const save = persistence.getSaveById(input.saveId);
  if (!save) return ergebnis;
  let gs = save.gameState;
  if (!arenaAktiv(gs) || !ausbauErlaubt(gs)) return ergebnis;
  const kontrolle = buildTeamControlSettingsMap(gs.teams, gs.seasonState.teamControlSettings);
  let geaendert = false;
  for (const team of gs.teams) {
    const e = kontrolle[team.teamId];
    const modus = e?.controlMode ?? "manual";
    if (modus !== "ai" && !(modus === "manual" && isBereichDelegiert(e, "gebaeude"))) continue;
    ergebnis.teamsGeprueft += 1;
    const bewertung = bewerteKiArena(gs, team.teamId);
    if (!bewertung || Object.keys(bewertung.schritte).length === 0) continue;
    const r = bauArenaAus(gs, team.teamId, bewertung.schritte, { von: "ki" });
    if (!r.ok) {
      if ((r.reason ?? "").startsWith("vorstand")) ergebnis.vomVorstandGesperrt.push(team.teamId);
      continue;
    }
    gs = r.gameState;
    geaendert = true;
    ergebnis.gebaut.push({ teamId: team.teamId, schritte: bewertung.schritte, kosten: r.kosten });
  }
  if (geaendert) persistence.saveSingleplayerState(input.saveId, gs);
  return ergebnis;
}
