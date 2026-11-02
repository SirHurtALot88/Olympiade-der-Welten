/**
 * SIEG / UNENTSCHIEDEN / NIEDERLAGE JE TEAM — Saisonstand-Auftrag Chris, 02.11.: „Alle sind 1v1
 * Duelle zwischen den teams das ist doch der punkt vom Modus." Der Battle Mode ist ein Liga-Format
 * aus Duellen; die Tabelle zeigte bisher nur die Punkte, nicht die Bilanz dahinter.
 *
 * KEINE NEUE RECHNUNG: abgelesen wird `teamPoints` der gebuchten Zeilen (2 = Sieg, 1 = Unentschieden,
 * 0 = Niederlage) — also genau die Zahl, die auch in `standings[team].points` landet. Gezaehlt wird
 * JE DISZIPLIN-EINSATZ (zwei je Spieltag), denn jede Disziplin hat ihre eigenen 2/1/0(-0) Punkte.
 *
 * VIERER-PODS ZAEHLEN SEIT DEM 02.11. MIT (zweite Praezisierung von Chris, selber Tag, nachdem die
 * erste Fassung Pods bewusst ausgeklammert hatte: „auch die Vierer Disziplinen sollen da reinzählen,
 * weil es gibt ja dort einen Sieger. Das ist der mit den 2 Punkten, unentschieden kriegt der mit
 * 1 Punkt und die anderen beiden Teams kriegen halt eine Niederlage. [...] jeder Einsatz soll ja
 * auch ein Ergebnis haben."). Ein Vierer-Pod (Mini-DM, Battlefield, Takeshi's Castle, Staffel) bucht
 * bereits 2/1/0/0 nach Platz (`teamPoints` auf der Disziplin-Zeile, dieselbe Zahl wie bei einem
 * Duell) — dieselbe Zuordnung wie bei Duellen (>=2 Sieg, >=1 Unentschieden, sonst Niederlage) gilt
 * deshalb unveraendert auch hier. `podPlaetze[0..3]` (Platz 1..4) bleibt zusaetzlich erhalten, weil
 * die genaue Platzierung (2. vs. 3. vs. 4. Platz sind beides „Niederlage") fuer den Hover weiterhin
 * eine ehrliche Zusatzinfo ist.
 *
 * Wie `summiereSaisonVerhaeltnis` bei jedem Lesen aus den gebuchten Zeilen neu summiert (idempotent
 * gegen `forceReplace`), und `null` statt einer leeren Map, wenn die Saison KEINE gewertete Zeile
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
    const istGewertet =
      row.resolutionSource === "arena" || row.resolutionSource === "pps_duell" || row.resolutionSource === "mini_dm_pod";
    if (!istGewertet || typeof row.teamPoints !== "number") continue;

    const eintrag = bilanz.get(row.teamId) ?? leereBilanz();
    if (row.teamPoints >= 2) eintrag.siege += 1;
    else if (row.teamPoints >= 1) eintrag.unentschieden += 1;
    else eintrag.niederlagen += 1;

    if (row.resolutionSource === "mini_dm_pod") {
      const platz = row.miniDmPod?.platz;
      if (platz === 1 || platz === 2 || platz === 3 || platz === 4) {
        eintrag.podPlaetze[platz - 1] += 1;
      }
    }

    bilanz.set(row.teamId, eintrag);
    gefunden = true;
  }
  return gefunden ? bilanz : null;
}

/** „9-2-5" (Siege-Unentschieden-Niederlagen). */
export function formatiereBilanz(bilanz: SaisonBilanz): string {
  return `${bilanz.siege}-${bilanz.unentschieden}-${bilanz.niederlagen}`;
}

/** Ausfuehrlicher Hover-Text inklusive der Vierer-Pod-Platzierungen (die in S-U-N mitzaehlen). */
export function beschreibeBilanz(bilanz: SaisonBilanz): string {
  const einsaetze = bilanz.siege + bilanz.unentschieden + bilanz.niederlagen;
  const teile = [
    `${bilanz.siege} Siege · ${bilanz.unentschieden} Unentschieden · ${bilanz.niederlagen} Niederlagen in ${einsaetze} Einsätzen`,
  ];
  const pods = bilanz.podPlaetze.reduce((summe, anzahl) => summe + anzahl, 0);
  if (pods > 0) {
    teile.push(
      `davon ${pods} Vierer-Pods: ` +
        bilanz.podPlaetze.map((anzahl, index) => `${anzahl}× Platz ${index + 1}`).join(", "),
    );
  }
  return teile.join(" — ");
}
