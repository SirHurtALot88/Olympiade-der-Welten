/**
 * GEMELDET: „S1 steht hier noch nicht welchen rank sie hatten, und da könnte man gut noch die
 * punkte ergänzen" — zur Saison-Verlauf-Karte im Teamprofil, die fuer Saison 1 nur „—" zeigte.
 *
 * BEFUND: es fehlten keine Daten. Der Saison-1-Schnappschuss im Spielstand ist vollstaendig, alle
 * 32 Teams mit Rang und Punkten (am Live-Spielstand nachgesehen: S-C Rang 19, 86.3 Punkte). Nur
 * kommt er nie im Browser an — `compactFoundationInitialGameState` streicht `seasonSnapshots` aus
 * der Anfangsladung. Ohne Schnappschuesse baut die Historie fuer jede vergangene Saison eine
 * Platzhalterzeile mit `rank: null`, und genau die zeigt die Karte als „—".
 *
 * DAS STREICHEN BLEIBT RICHTIG. Ein Schnappschuss schleppt Spielerleistungen, Spieltags- und
 * Disziplinergebnisse mit; das sind pro Saison Megabytes, die keine Ansicht am Stueck braucht.
 * Deshalb faehrt statt der vollen Schnappschuesse diese Projektion mit: pro Saison und Team die
 * gut zehn Zahlen, aus denen die Historienzeile besteht.
 *
 * WARUM EIN EIGENES FELD UND NICHT `seasonSnapshots` SELBST:
 *
 * Der Schutz des Archivs (`preserveAppendOnlyArchive`) vergleicht nur die ANZAHL der Eintraege —
 * eingehend gewinnt, sobald es mindestens so viele sind wie gespeichert. Eine schlanke Fassung
 * unter demselben Namen haette exakt dieselbe Anzahl, kaeme also durch und wuerde beim naechsten
 * Speichern die vollen Schnappschuesse dauerhaft durch die Kurzfassung ersetzen. Der Verlust
 * waere endgueltig und stillschweigend. Die Projektion liegt darum in einem eigenen Feld, das
 * nirgends zurueckgeschrieben wird: sie ist reine Anzeigefracht, keine Quelle.
 */
import type { GameState, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";

import { resolveSeasonSnapshotTeamRecords } from "@/lib/season/season-snapshot-helpers";

/** Eine Team-Zeile einer abgeschlossenen Saison — genau die Felder der Historienzeile. */
export type FoundationSeasonHistoryTeamEntry = {
  teamId: string;
  rank: number | null;
  points: number | null;
  disciplinePoints: number | null;
  disciplinePointsByArea: { pow: number | null; spe: number | null; men: number | null; soc: number | null };
  cashEnd: number | null;
  salaryEnd: number | null;
  marketValueEnd: number | null;
  guv: number | null;
};

export type FoundationSeasonHistoryEntry = {
  seasonId: string;
  seasonName: string | null;
  status: string | null;
  teams: FoundationSeasonHistoryTeamEntry[];
  /** Nur Top-Zu- und -Abgang je Team; die Historienzeile zeigt nicht mehr. */
  transfers: Array<{
    type: string;
    playerId: string | null;
    playerName: string | null;
    fromTeamId: string | null;
    toTeamId: string | null;
    amount: number | null;
  }>;
};

function zahlOderNull(wert: unknown): number | null {
  return typeof wert === "number" && Number.isFinite(wert) ? wert : null;
}

function projiziereTeam(record: {
  teamId: string;
  rank?: number | null;
  points?: number | null;
  disciplinePoints?: number | null;
  disciplinePointsByArea?: { pow?: number | null; spe?: number | null; men?: number | null; soc?: number | null };
  cashEnd?: number | null;
  cashTotal?: number | null;
  salaryTotalEnd?: number | null;
  salaryEnd?: number | null;
  marketValueSeasonEnd?: number | null;
  marketValueTotalEnd?: number | null;
  marketValueEnd?: number | null;
  guv?: number | null;
}): FoundationSeasonHistoryTeamEntry {
  const bereich = record.disciplinePointsByArea ?? {};
  return {
    teamId: record.teamId,
    rank: zahlOderNull(record.rank),
    points: zahlOderNull(record.points),
    disciplinePoints: zahlOderNull(record.disciplinePoints),
    disciplinePointsByArea: {
      pow: zahlOderNull(bereich.pow),
      spe: zahlOderNull(bereich.spe),
      men: zahlOderNull(bereich.men),
      soc: zahlOderNull(bereich.soc),
    },
    cashEnd: zahlOderNull(record.cashEnd) ?? zahlOderNull(record.cashTotal),
    salaryEnd: zahlOderNull(record.salaryTotalEnd) ?? zahlOderNull(record.salaryEnd),
    // Reihenfolge wie in `all-time-table.ts`: Saisonend-Marktwert NACH Trainings-Apply zuerst.
    marketValueEnd:
      zahlOderNull(record.marketValueSeasonEnd) ??
      zahlOderNull(record.marketValueTotalEnd) ??
      zahlOderNull(record.marketValueEnd),
    guv: zahlOderNull(record.guv),
  };
}

export function projiziereSaisonHistorie(
  snapshots: readonly SeasonSnapshotRecord[] | undefined,
): FoundationSeasonHistoryEntry[] {
  return (snapshots ?? []).map((snapshot) => ({
    seasonId: snapshot.seasonId,
    seasonName: snapshot.seasonName ?? null,
    status: snapshot.status ?? null,
    teams: resolveSeasonSnapshotTeamRecords(snapshot).map((record) => projiziereTeam(record as never)),
    transfers: (snapshot.transferSnapshots ?? []).map((entry) => ({
      type: String(entry.type),
      playerId: entry.playerId ?? null,
      playerName: entry.playerName ?? null,
      fromTeamId: entry.fromTeamId ?? null,
      toTeamId: entry.toTeamId ?? null,
      amount: zahlOderNull(entry.amount),
    })),
  }));
}

/**
 * Die Projektion einer bereits geladenen Ansicht — nimmt die vollen Schnappschuesse, wenn sie da
 * sind (Server), sonst die mitgefahrene Kurzfassung (Browser). Damit muss keine Ansicht wissen,
 * auf welcher Seite sie laeuft.
 */
export function leseSaisonHistorie(gameState: GameState): FoundationSeasonHistoryEntry[] {
  const voll = gameState.seasonState.seasonSnapshots;
  if (voll != null && voll.length > 0) {
    return projiziereSaisonHistorie(voll);
  }
  return gameState.seasonState.foundationSeasonHistory ?? [];
}
