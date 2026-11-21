import type { GameState } from "@/lib/data/olyDataTypes";
import { berechneDisziRang } from "@/lib/lineups/einsatzliste-diszi-rang";
import { teamfarbeInGruppe } from "@/lib/foundation/battle-arena/arena-regie";

/**
 * VORRAUM DER SPIELTAGS-ARENA (18.11., Mockup `arena-spieltag-modern-18-11.html`, Screens 1 und 2) --
 * reine Logik fuer das Ladebild und die Vorstellung (Duell und Vierergruppe), kein React.
 *
 * KEIN SPOILER: vor dem Anpfiff steht beim Gegner nur die Kaderstaerke ueber die BESTEN 6 der Disziplin
 * (CLAUDE.md: Kaderstaerke ueberall ueber die besten 6) -- nie die Eignung der Einsatzplaetze, nie die
 * Formkarte. Die Zahl ist gerundet, Marken nur grob.
 */
export type VorraumTeam = {
  teamId: string;
  name: string;
  kuerzel: string;
  rang: number | null;
  /**
   * Rang in DIESER Disziplin (21.11.): Liga-Rang des Teams (Rang 1 = bester; Saisonwertung, vor der
   * ersten Wertung die Kaderstaerke), klein dahinter der Rang unter allen. `null` ohne Daten.
   */
  diszRang: { liga: number | null; ligaName: string | null; gesamt: number; gesamtVon: number; quelle: "kader" | "saison" } | null;
  punkte: number | null;
  /** Mittel der besten 6 in dieser Disziplin, gerundet; `null`, wenn nicht ableitbar. */
  kaderStaerke: number | null;
  /** Grobe Marke 1..5 aus der Kaderstaerke (Liga-relativ), `null` ohne Wert. */
  marke: number | null;
  eigen: boolean;
  farbe: string;
};

export function mittelBeste6(werte: ReadonlyArray<number | null | undefined>): number | null {
  const zahlen = werte.filter((wert): wert is number => typeof wert === "number" && Number.isFinite(wert)).sort((a, b) => b - a);
  if (zahlen.length === 0) return null;
  const beste = zahlen.slice(0, 6);
  return beste.reduce((summe, wert) => summe + wert, 0) / beste.length;
}

/** Grobe Marke 1..5: Position der Kaderstaerke zwischen schwaechstem und staerkstem Team der Gruppe. */
export function groberMarke(wert: number | null, alle: ReadonlyArray<number | null>): number | null {
  if (wert == null) return null;
  const zahlen = alle.filter((x): x is number => x != null);
  const min = Math.min(...zahlen);
  const max = Math.max(...zahlen);
  if (!(max > min)) return 3;
  return 1 + Math.round(((wert - min) / (max - min)) * 4);
}

function diszRangVon(gameState: GameState, teamId: string, disciplineId: string): VorraumTeam["diszRang"] {
  try {
    const r = berechneDisziRang(gameState, teamId, disciplineId);
    return r ? { liga: r.liga, ligaName: r.ligaName, gesamt: r.gesamt, gesamtVon: r.gesamtVon, quelle: r.quelle } : null;
  } catch {
    return null;
  }
}

/**
 * Die Teams des Vorraums in Anzeige-Reihenfolge: das eigene zuerst, danach die uebrigen in
 * Gruppen-Reihenfolge der Buchung. Reine Anzeige-Ordnung -- die Seiten im Motor bleiben unberuehrt.
 */
export function baueVorraumTeams(input: {
  gameState: GameState;
  teamIds: readonly string[];
  ownTeamId: string | null | undefined;
  disciplineId: string;
}): VorraumTeam[] {
  const { gameState, teamIds, ownTeamId, disciplineId } = input;
  const geordnet = [...teamIds.filter((id) => id === ownTeamId), ...teamIds.filter((id) => id !== ownTeamId)];
  const farben = teamfarbeInGruppe(geordnet, ownTeamId);
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const standings = (gameState.seasonState?.standings ?? {}) as Record<string, { rank?: number | null; points?: number | null } | undefined>;
  const staerken = geordnet.map((teamId) => {
    const werte = gameState.rosters
      .filter((eintrag) => eintrag.teamId === teamId)
      .map((eintrag) => {
        const spieler = playerById.get(eintrag.playerId);
        return spieler?.currentDisciplineValues?.[disciplineId] ?? spieler?.disciplineRatings?.[disciplineId] ?? null;
      });
    return mittelBeste6(werte);
  });
  return geordnet.map((teamId, index) => {
    const team = gameState.teams.find((eintrag) => eintrag.teamId === teamId);
    const eintrag = standings[teamId];
    const staerke = staerken[index];
    return {
      teamId,
      name: team?.name ?? teamId,
      kuerzel: team?.shortCode ?? teamId.slice(0, 3).toUpperCase(),
      rang: typeof eintrag?.rank === "number" ? eintrag.rank : null,
      diszRang: diszRangVon(gameState, teamId, disciplineId),
      punkte: typeof eintrag?.points === "number" ? eintrag.points : null,
      kaderStaerke: staerke == null ? null : Math.round(staerke),
      marke: groberMarke(staerke, staerken),
      eigen: teamId === ownTeamId,
      farbe: farben[teamId],
    };
  });
}

/** Punkteschema je Spielart (Mockup Abschnitt 2): Duell 2/1/0, Vierergruppe 2-1-0-0. */
export function punkteSchema(art: "duell" | "pod"): Array<{ label: string; punkte: number }> {
  return art === "pod"
    ? [
        { label: "Platz 1", punkte: 2 },
        { label: "Platz 2", punkte: 1 },
        { label: "Platz 3", punkte: 0 },
        { label: "Platz 4", punkte: 0 },
      ]
    : [
        { label: "Sieg", punkte: 2 },
        { label: "Remis", punkte: 1 },
        { label: "Niederlage", punkte: 0 },
      ];
}

export type LadeSchritt = { label: string; status: "fertig" | "laeuft" | "offen" };

/** Die vier Schritte des Ladebilds aus den echten Zustaenden des Hosts (nichts davon ist Deko). */
export function baueLadeSchritte(input: { kaderGeladen: boolean; aufstellungDa: boolean; motorBereit: boolean }): LadeSchritt[] {
  const { kaderGeladen, aufstellungDa, motorBereit } = input;
  const reihe: Array<[string, boolean]> = [
    ["Kader", kaderGeladen],
    ["Aufstellung", kaderGeladen && aufstellungDa],
    ["Saat der Wertung", kaderGeladen && aufstellungDa],
    ["Arena wird aufgebaut", motorBereit],
  ];
  let laeuftSchonGesetzt = false;
  return reihe.map(([label, fertig]) => {
    if (fertig) return { label, status: "fertig" as const };
    if (!laeuftSchonGesetzt) {
      laeuftSchonGesetzt = true;
      return { label, status: "laeuft" as const };
    }
    return { label, status: "offen" as const };
  });
}
