/**
 * SIEG / UNENTSCHIEDEN / NIEDERLAGE JE TEAM — Saisonstand-Auftrag Chris, 02.11.: „Alle sind 1v1
 * Duelle zwischen den teams das ist doch der punkt vom Modus." Der Battle Mode ist ein Liga-Format
 * aus Duellen; die Tabelle zeigte bisher nur die Punkte, nicht die Bilanz dahinter.
 *
 * KEINE NEUE RECHNUNG: abgelesen wird `teamPoints` der gebuchten Duell-Zeilen (2 = Sieg,
 * 1 = Unentschieden, 0 = Niederlage, `DUELL_TEAM_PUNKTE` in battle-mode-pps-duell.ts) — also genau
 * die Zahl, die auch in `standings[team].points` landet. Gezaehlt wird JE DISZIPLIN-DUELL (zwei je
 * Spieltag), denn jede Disziplin ist ein eigenes Duell mit eigenen 2/1/0 Punkten.
 *
 * VIERER-PODS (Mini-DM, Battlefield, Takeshi's Castle, Staffel) laufen NICHT in S/U/N: ein
 * Vier-Team-Rennen hat keinen Gegner und damit keinen Sieg im Duell-Sinn. Sie werden getrennt nach
 * Platz gezaehlt (`podPlaetze[0..3]` = Platz 1..4), damit die Anzeige sie ehrlich daneben stellen
 * kann, statt einen 2. Platz als „Unentschieden" auszugeben.
 *
 * Wie `summiereSaisonVerhaeltnis` bei jedem Lesen aus den gebuchten Zeilen neu summiert (idempotent
 * gegen `forceReplace`), und `null` statt einer leeren Map, wenn die Saison KEINE Duell- oder Pod-Zeile
 * traegt — jeder Manager-Save zeigt dann gar keine Bilanz-Spalte.
 */
import type { GameState } from "@/lib/data/olyDataTypes";

export type SaisonBilanz = {
  siege: number;
  unentschieden: number;
  niederlagen: number;
  /** Anzahl Platz 1, 2, 3, 4 in Vierer-Pods. */
  podPlaetze: [number, number, number, number];
};

function leereBilanz(): SaisonBilanz {
  return { siege: 0, unentschieden: 0, niederlagen: 0, podPlaetze: [0, 0, 0, 0] };
}

export function summiereSaisonBilanz(
  gameState: Pick<GameState, "seasonState">,
  seasonId: string,
): Map<string, SaisonBilanz> | null {
  const gewerteteIds = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((result) => result.seasonId === seasonId && result.status === "preview_applied")
      .map((result) => result.id),
  );
  if (gewerteteIds.size === 0) return null;

  const bilanz = new Map<string, SaisonBilanz>();
  let gefunden = false;
  for (const row of gameState.seasonState.disciplineResults ?? []) {
    if (!gewerteteIds.has(row.matchdayResultId)) continue;
    if (row.resolutionSource === "arena" || row.resolutionSource === "pps_duell") {
      if (typeof row.teamPoints !== "number") continue;
      const eintrag = bilanz.get(row.teamId) ?? leereBilanz();
      if (row.teamPoints >= 2) eintrag.siege += 1;
      else if (row.teamPoints >= 1) eintrag.unentschieden += 1;
      else eintrag.niederlagen += 1;
      bilanz.set(row.teamId, eintrag);
      gefunden = true;
      continue;
    }
    if (row.resolutionSource === "mini_dm_pod") {
      const platz = row.miniDmPod?.platz;
      if (platz !== 1 && platz !== 2 && platz !== 3 && platz !== 4) continue;
      const eintrag = bilanz.get(row.teamId) ?? leereBilanz();
      eintrag.podPlaetze[platz - 1] += 1;
      bilanz.set(row.teamId, eintrag);
      gefunden = true;
    }
  }
  return gefunden ? bilanz : null;
}

/** „9-2-5" (Siege-Unentschieden-Niederlagen). */
export function formatiereBilanz(bilanz: SaisonBilanz): string {
  return `${bilanz.siege}-${bilanz.unentschieden}-${bilanz.niederlagen}`;
}

/** Ausfuehrlicher Hover-Text inklusive der Vierer-Pod-Platzierungen. */
export function beschreibeBilanz(bilanz: SaisonBilanz): string {
  const duelle = bilanz.siege + bilanz.unentschieden + bilanz.niederlagen;
  const teile = [
    `${bilanz.siege} Siege · ${bilanz.unentschieden} Unentschieden · ${bilanz.niederlagen} Niederlagen in ${duelle} Duellen`,
  ];
  const pods = bilanz.podPlaetze.reduce((summe, anzahl) => summe + anzahl, 0);
  if (pods > 0) {
    teile.push(
      `Vierer-Pods (${pods}): ` +
        bilanz.podPlaetze.map((anzahl, index) => `${anzahl}× Platz ${index + 1}`).join(", "),
    );
  }
  return teile.join(" — ");
}
