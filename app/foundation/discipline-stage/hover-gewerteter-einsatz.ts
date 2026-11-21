// =====================================================================================
// Team-Hover der Spieltagswertung: gewerteter Einsatz je Disziplin (21.11.)
// =====================================================================================
//
// GEMELDET (Chris, 19./20.11.): in der Spieltagswertung zeigte die Team-Karte beim Hover unter
// „Eingesetzt" bei fast allen Teams „noch offen", obwohl der Spieltag längst gewertet war.
//
// URSACHE: die Karte (`DisciplineStageHoverPreview`) nahm Werte nur aus `liveResultsByTeam` — den
// Slots, die die GERADE LAUFENDE Arena aufgedeckt hat. Die Arena zeigt aber nur eine Begegnung (ein
// Duell, eine Gruppe); für jedes andere Team war die Liste leer, und jede Zeile fiel auf „noch offen".
// Die gebuchten Werte standen dabei längst in derselben Resolve-Preview, aus der die Spieltagswertung
// ihre Spielerliste baut (`matchdayPanel.playersByTeam`).
//
// FIX: aufgedeckte Seiten (`d1Revealed`/`d2Revealed`, dieselbe Anti-Spoiler-Regel wie die Wertung
// selbst) liefern der Karte je Team ihren gewerteten Einsatz — Spieler mit Score und PP. Eine noch
// verdeckte Seite liefert nichts; dort bleibt die Live-Liste mit „noch offen" (kein Spoiler).

import type {
  MatchdayPanelDiscipline,
  MatchdayPanelPlayerRow,
} from "@/app/foundation/discipline-stage/DisciplineStageMatchdayPanel";

export type GewerteterEinsatzBlock = {
  seite: "d1" | "d2";
  disciplineId: string | null;
  titel: string;
  spieler: MatchdayPanelPlayerRow[];
};

export type GewerteterEinsatzEingabe = {
  playersByTeam: Map<string, { d1: MatchdayPanelPlayerRow[]; d2: MatchdayPanelPlayerRow[] }> | null | undefined;
  d1: MatchdayPanelDiscipline | null | undefined;
  d2: MatchdayPanelDiscipline | null | undefined;
  d1Revealed: boolean;
  d2Revealed: boolean;
};

/**
 * Je Team die aufgedeckten Disziplin-Seiten mit ihren eingesetzten Spielern (Reihenfolge D1, D2).
 * Teams ohne aufgedeckten Einsatz fehlen in der Map; eine Seite ohne Spieler entfällt.
 */
export function baueGewertetenEinsatz(eingabe: GewerteterEinsatzEingabe): Map<string, GewerteterEinsatzBlock[]> {
  const ergebnis = new Map<string, GewerteterEinsatzBlock[]>();
  if (!eingabe.playersByTeam) return ergebnis;
  const seiten = [
    { seite: "d1" as const, disziplin: eingabe.d1 ?? null, aufgedeckt: eingabe.d1Revealed, ersatz: "Disziplin 1" },
    { seite: "d2" as const, disziplin: eingabe.d2 ?? null, aufgedeckt: eingabe.d2Revealed, ersatz: "Disziplin 2" },
  ];
  for (const [teamId, jeSeite] of eingabe.playersByTeam) {
    const bloecke: GewerteterEinsatzBlock[] = [];
    for (const { seite, disziplin, aufgedeckt, ersatz } of seiten) {
      if (!aufgedeckt) continue;
      const spieler = jeSeite[seite] ?? [];
      if (spieler.length === 0) continue;
      bloecke.push({ seite, disciplineId: disziplin?.disciplineId ?? null, titel: disziplin?.displayName ?? ersatz, spieler });
    }
    if (bloecke.length > 0) ergebnis.set(teamId, bloecke);
  }
  return ergebnis;
}

/**
 * Soll die Karte zusätzlich die LIVE-Liste der laufenden Disziplin zeigen? Nur, wenn diese Disziplin
 * nicht schon als gewerteter Block dasteht — sonst stünden dieselben Spieler zweimal da, einmal mit
 * Wert und einmal mit „noch offen".
 */
export function zeigeLiveEinsatz(bloecke: readonly GewerteterEinsatzBlock[] | null | undefined, aktuelleDisziplinId: string | null | undefined): boolean {
  if (!bloecke || bloecke.length === 0) return true;
  if (!aktuelleDisziplinId) return false;
  return !bloecke.some((block) => block.disciplineId === aktuelleDisziplinId);
}
