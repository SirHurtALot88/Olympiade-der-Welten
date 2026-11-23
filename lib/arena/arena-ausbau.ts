/**
 * ARENA-AUSBAU VON HAND (22.11., docs/design/finanzen-posten-22-11.md h.1 bis h.4, i.1): der EINE Schreibweg fuer Mensch und KI.
 *
 * Steh und Sitz wachsen in 1.000er-Schritten, Logen in 100ern, mehrere Schritte und mehrere Bereiche auf einmal. Bezahlt wird sofort aus
 * dem Investitionstopf, HART gegen die Vorstands-Freigabe (`pruefeGebaeudeGegenVorstandFreigabe`), fuer Mensch und KI gleich. Die neuen
 * Plaetze zaehlen ab dem naechsten gebuchten Heimspiel; Rueckbau gibt es nicht. Die Server-Route (`/api/arena`) und der KI-Lauf rufen
 * genau diese Funktion; sie prueft Regel, Obergrenzen, Kasse und Vorstand und schreibt nichts, wenn eine Pruefung fehlschlaegt.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { randomUUID } from "@/lib/utils/random-id";
import { pruefeGebaeudeGegenVorstandFreigabe } from "@/lib/finance/vorstand-budgetfreigabe";
import { bauKosten, maxSchritte, mapBereiche, plaetzeNachSchritten, runde2, schritteGebaut } from "@/lib/arena/arena-modell";
import { arenaAktiv } from "@/lib/arena/arena-regel";
import { holeArenaStand, seasonIdVon } from "@/lib/arena/arena-stand";
import { ARENA_BEREICHE, type ArenaBereich } from "@/lib/arena/arena-typen";

export type ArenaAusbauErgebnis = { ok: boolean; reason: string | null; meldung: string; gameState: GameState; kosten: number };

export const BEREICH_NAME: Record<ArenaBereich, string> = { steh: "Stehplätze", sitz: "Sitzplätze", loge: "Logen" };

function fehler(gameState: GameState, reason: string, meldung: string): ArenaAusbauErgebnis {
  return { ok: false, reason, meldung, gameState, kosten: 0 };
}

/** Darf in dieser Phase ausgebaut werden? Nicht, solange die Saison abgerechnet wird; sonst jederzeit (die Plaetze gelten ab dem naechsten Heimspiel). */
export function ausbauErlaubt(gameState: GameState): boolean {
  const phase = gameState.gamePhase ?? "season_active";
  return phase !== "season_completed" && phase !== "season_review";
}

export function ausbauKosten(gameState: GameState, teamId: string, schritte: Partial<Record<ArenaBereich, number>>): number {
  const stand = holeArenaStand(gameState, teamId);
  return runde2(ARENA_BEREICHE.reduce((s, b) => s + bauKosten(b, schritteGebaut(b, stand.plaetze[b]), Math.max(0, Math.round(schritte[b] ?? 0))), 0));
}

export function bauArenaAus(
  gameState: GameState,
  teamId: string,
  schritte: Partial<Record<ArenaBereich, number>>,
  optionen?: { von?: "mensch" | "ki"; jetzt?: string },
): ArenaAusbauErgebnis {
  if (!arenaAktiv(gameState)) return fehler(gameState, "arena_regel_aus", "In dieser Saison gilt noch das alte Gebäude „Arena Upgrade“.");
  if (!ausbauErlaubt(gameState)) return fehler(gameState, "phase_gesperrt", "Während der Saisonabrechnung wird nicht gebaut.");
  const team = gameState.teams.find((t) => t.teamId === teamId);
  if (!team) return fehler(gameState, "team_unbekannt", "Team nicht gefunden.");
  const stand = holeArenaStand(gameState, teamId);
  const wunsch = mapBereiche((b) => {
    const roh = Number(schritte[b] ?? 0);
    return Number.isFinite(roh) ? Math.round(roh) : NaN;
  });
  if (ARENA_BEREICHE.some((b) => Number.isNaN(wunsch[b]) || wunsch[b] < 0)) return fehler(gameState, "ungueltig", "Die Schritte müssen ganze Zahlen ab 0 sein.");
  if (ARENA_BEREICHE.every((b) => wunsch[b] === 0)) return fehler(gameState, "nichts_zu_bauen", "Es ist kein Schritt gewählt.");
  for (const b of ARENA_BEREICHE) {
    if (schritteGebaut(b, stand.plaetze[b]) + wunsch[b] > maxSchritte(b)) {
      return fehler(gameState, "obergrenze", `${BEREICH_NAME[b]}: die Obergrenze ist erreicht.`);
    }
  }
  const kosten = ausbauKosten(gameState, teamId, wunsch);
  if (kosten > team.cash + 1e-9) return fehler(gameState, "kasse", "Dafür reicht die Kasse nicht.");
  const vorstand = pruefeGebaeudeGegenVorstandFreigabe(gameState, teamId, kosten);
  if (!vorstand.ok) {
    return fehler(
      gameState,
      vorstand.reason ?? "vorstand",
      vorstand.reason === "vorstand_gebaeude_sparauflage"
        ? "Der Vorstand gibt in der Sparauflage keine Gebäude frei."
        : "Der Vorstand gibt dafür nicht genug aus dem Investitionstopf frei.",
    );
  }
  const seasonId = seasonIdVon(gameState);
  const index = gameState.season?.currentMatchday ?? 0;
  const zeit = optionen?.jetzt ?? new Date().toISOString();
  const zeilen = ARENA_BEREICHE.filter((b) => wunsch[b] > 0).map((b) => ({
    seasonId,
    matchdayIndex: Math.max(0, index - 1),
    bereich: b,
    schritte: wunsch[b],
    kosten: bauKosten(b, schritteGebaut(b, stand.plaetze[b]), wunsch[b]),
    von: optionen?.von ?? "mensch",
    zeit,
  }));
  const neuerStand = {
    ...stand,
    plaetze: plaetzeNachSchritten(stand.plaetze, wunsch),
    ausbau: [...stand.ausbau, ...zeilen],
    ausbauSaison: mapBereiche((b) => stand.ausbauSaison[b] + wunsch[b]),
  };
  const next: GameState = {
    ...gameState,
    teams: gameState.teams.map((t) => (t.teamId === teamId ? { ...t, cash: Math.round((t.cash - kosten) * 10) / 10 } : t)),
    seasonState: {
      ...gameState.seasonState,
      arena: { ...(gameState.seasonState.arena ?? {}), [teamId]: neuerStand },
      // Der Investitionstopf des Vorstands liest die Gebaeude-Ausgaben der Saison aus den Gebaeude-Ereignissen (`berechneVorstandBudgetStand`):
      // ohne diese Zeile wuerde der Ausbau die Freigabe nicht verbrauchen.
      facilityEvents: [
        {
          eventId: `arena-event-${randomUUID()}`,
          seasonId,
          teamId,
          facilityId: "arena_upgrade",
          previousLevel: ARENA_BEREICHE.reduce((sum, b) => sum + schritteGebaut(b, stand.plaetze[b]), 0),
          nextLevel: ARENA_BEREICHE.reduce((sum, b) => sum + schritteGebaut(b, neuerStand.plaetze[b]), 0),
          cost: kosten,
          timestamp: zeit,
          source: "manual_facility_upgrade" as const,
        },
        ...(gameState.seasonState.facilityEvents ?? []),
      ],
    },
  };
  const teile = ARENA_BEREICHE.filter((b) => wunsch[b] > 0).map((b) => `${wunsch[b]} × ${BEREICH_NAME[b]}`);
  return { ok: true, reason: null, meldung: `Gebaut: ${teile.join(", ")} für ${kosten.toFixed(1).replace(".", ",")} C. Die neuen Plätze zählen ab dem nächsten Heimspiel.`, gameState: next, kosten };
}
