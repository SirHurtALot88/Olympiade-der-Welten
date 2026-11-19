/**
 * Die EINE geordnete Liste der 20 Disziplinen (Matrix-IDs), gruppiert nach Achse POW, SPE, MEN, SOC. Maßgeblich ist
 * `RETOOL_DISCIPLINE_AXIS` (lib/ai/golden-master/discipline-recipes.ts); die Matrix nutzt andere Schreibweisen der IDs,
 * daher die Zuordnung hier. Draft-Brett, Transfermarkt und Alle Picks nehmen diese Reihenfolge.
 */
import type { OfficialDisciplineWeightId } from "@/lib/player-generator/official-discipline-weights";
import type { MarktAchse } from "@/lib/market/transfermarkt-sicht";

export const DISZIPLIN_NACH_ACHSE: Record<MarktAchse, readonly OfficialDisciplineWeightId[]> = {
  pow: ["tdm", "mini-dm", "gewichtheben", "hockey", "breaking"],
  spe: ["staffel", "time-trial", "spurt", "climbing", "fechten"],
  men: ["speed-schach", "takeshis-castle", "tennis", "i-spy", "wettessen"],
  soc: ["basketball", "football", "battlefield", "eiskunstlauf", "showcase"],
};

export const ACHSEN_REIHENFOLGE: readonly MarktAchse[] = ["pow", "spe", "men", "soc"];

export const DISZIPLINEN_GEORDNET: readonly OfficialDisciplineWeightId[] = ACHSEN_REIHENFOLGE.flatMap((a) => DISZIPLIN_NACH_ACHSE[a]);

/** Achsenfarbe wie in der Klassen-/Kartenfarbe (rot POW, grün SPE, blau MEN, gelb SOC). */
export const ACHSEN_FARBE_HEX: Record<MarktAchse, string> = { pow: "#ff7a6e", spe: "#5fd68a", men: "#6fb0ff", soc: "#f3cf5a" };

export function achseDerDisziplin(id: string): MarktAchse | null {
  return ACHSEN_REIHENFOLGE.find((a) => (DISZIPLIN_NACH_ACHSE[a] as readonly string[]).includes(id)) ?? null;
}
