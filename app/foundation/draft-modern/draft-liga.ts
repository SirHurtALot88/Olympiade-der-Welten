/**
 * LIGA-SICHT DES DRAFTS (19.11., Chris: „wie die ranks der eigenen spieler im vergleich zu anderen teams sind“).
 *
 * KEINE NEUE RECHNUNG: Kaderstärke je Disziplin und Liga-Rang kommen aus `lib/market/transfermarkt-kaderstaerke.ts`, derselben
 * Quelle wie Transfermarkt, Verhandlungstisch und Kader. Neu ist nur der Stand: `gameState.rosters` kennt fremde Picks erst nach
 * einem Neuladen, die Draft-Sicht kennt sie sofort — beide werden zusammengelegt, damit sich die Ränge nach JEDEM Pick bewegen.
 * Reine Funktionen (getestet in tests/draft-liga-sicht.test.ts), das Hook-Gewand steht in `DraftLiga.tsx`.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import type { LigaDraftAnsicht } from "@/lib/draft/liga-draft-ansicht";
import { baueLigaStaerken, rangGegenLiga, type LigaStaerken, type StaerkeSpieler } from "@/lib/market/transfermarkt-kaderstaerke";

export type DraftKaderZeile = { disziplinId: string; staerke: number; rang: number; ligaGroesse: number };
export type DraftSpielerRang = { playerId: string; beste: Array<{ disziplinId: string; wert: number; rang: number }> };

/** Kader je Team: gespeicherte Kader plus die Picks des Drafts, die der Spielstand noch nicht kennt. */
export function kaderMitPicks(
  rosters: ReadonlyArray<{ teamId: string; playerId: string }>,
  verlauf: ReadonlyArray<{ art: string; teamId: string; playerId?: string | null }>,
): Array<{ teamId: string; playerId: string }> {
  const bekannt = new Set(rosters.map((r) => r.playerId));
  const ergebnis = rosters.map((r) => ({ teamId: r.teamId, playerId: r.playerId }));
  for (const e of verlauf) {
    if (e.art !== "pick" || !e.playerId || bekannt.has(e.playerId)) continue;
    bekannt.add(e.playerId);
    ergebnis.push({ teamId: e.teamId, playerId: e.playerId });
  }
  return ergebnis;
}

export function baueDraftKaderSicht(input: {
  gameState: Pick<GameState, "players" | "rosters" | "teams">;
  ansicht: Pick<LigaDraftAnsicht, "verlauf">;
  teamId: string;
  disziplinIds: readonly string[];
}): { staerken: LigaStaerken; zeilen: DraftKaderZeile[] } {
  const spielerById = new Map(input.gameState.players.map((p) => [p.id, p]));
  const kader = kaderMitPicks(input.gameState.rosters, input.ansicht.verlauf);
  const spieler: StaerkeSpieler[] = kader.map((r) => ({ playerId: r.playerId, teamId: r.teamId, ratings: spielerById.get(r.playerId)?.disciplineRatings }));
  const teamIds = input.gameState.teams.map((t) => t.teamId);
  const staerken = baueLigaStaerken({ spieler, teamIds, disziplinIds: input.disziplinIds });
  const zeilen = input.disziplinIds.map((disziplinId) => {
    const staerke = staerken[input.teamId]?.[disziplinId] ?? 20;
    return { disziplinId, staerke, rang: rangGegenLiga(staerken, input.teamId, disziplinId, staerke), ligaGroesse: teamIds.length };
  });
  return { staerken, zeilen };
}

/** Rang eines Spielers unter ALLEN Spielern der Liga (Kader und freie) je Disziplin; die `anzahl` besten Disziplinen. */
export function baueSpielerRaenge(input: {
  players: ReadonlyArray<{ id: string; disciplineRatings?: Record<string, number | null | undefined> | null }>;
  playerIds: readonly string[];
  disziplinIds: readonly string[];
  anzahl?: number;
}): Map<string, DraftSpielerRang> {
  const sortiert: Record<string, number[]> = {};
  for (const d of input.disziplinIds) {
    sortiert[d] = input.players
      .map((p) => p.disciplineRatings?.[d])
      .filter((w): w is number => typeof w === "number" && Number.isFinite(w))
      .sort((a, b) => b - a);
  }
  const byId = new Map(input.players.map((p) => [p.id, p]));
  const ergebnis = new Map<string, DraftSpielerRang>();
  for (const id of input.playerIds) {
    const p = byId.get(id);
    if (!p) continue;
    const beste: DraftSpielerRang["beste"] = [];
    for (const d of input.disziplinIds) {
      const wert = p.disciplineRatings?.[d];
      if (typeof wert !== "number" || !Number.isFinite(wert)) continue;
      const liste = sortiert[d]!;
      // Binärsuche: Anzahl der Werte, die größer sind als `wert`.
      let lo = 0;
      let hi = liste.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (liste[mid]! > wert) lo = mid + 1;
        else hi = mid;
      }
      beste.push({ disziplinId: d, wert, rang: lo + 1 });
    }
    beste.sort((a, b) => a.rang - b.rang || b.wert - a.wert);
    ergebnis.set(id, { playerId: id, beste: beste.slice(0, input.anzahl ?? 3) });
  }
  return ergebnis;
}
