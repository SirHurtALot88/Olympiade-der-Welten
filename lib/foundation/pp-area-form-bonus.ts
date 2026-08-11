import type { GameState } from "@/lib/data/olyDataTypes";
import { roundValue } from "@/lib/foundation/foundation-number-utils";
import { resolveSeasonDisciplineAreaTotal } from "@/lib/season/season-discipline-area-groups";

export type PpAreaKey = "total" | "pow" | "spe" | "men" | "soc";
export type PpAreaFormBonusTotals = Record<PpAreaKey, number>;

/**
 * Die WIRKUNG der Formkarten je PP-Bereich — ohne `total`, das ist immer die Summe der vier
 * Bereiche und wird beim Lesen gebildet. Bereiche ohne Wirkung fehlen absichtlich: an einem
 * Spieltag spielt ein Team zwei Disziplinen, also stehen hier nie mehr als zwei Zahlen.
 */
export type PpAreaFormBonusByArea = Partial<Record<Exclude<PpAreaKey, "total">, number>>;

export type PpAreaTotals = Record<Exclude<PpAreaKey, "total">, number | null> & { total: number | null };

export type PpAreaSeasonStandRowInput = {
  disciplineValues: Record<string, number | null | undefined>;
  ppsTotal: number;
  ppsPow: number;
  ppsSpe: number;
  ppsMen: number;
  ppsSoc: number;
};

export function createEmptyPpAreaFormBonusTotals(): PpAreaFormBonusTotals {
  return {
    total: 0,
    pow: 0,
    spe: 0,
    men: 0,
    soc: 0,
  };
}

function getPpAreaKeyForDisciplineCategory(category: string | null | undefined): Exclude<PpAreaKey, "total"> | null {
  if (category === "power") return "pow";
  if (category === "speed") return "spe";
  if (category === "mental") return "men";
  if (category === "social") return "soc";
  return null;
}

/**
 * Die Formkarten-WIRKUNG der laufenden Saison, aufgeschluesselt je SPIELTAG und Team.
 *
 * Rechnet ausschliesslich auf dem, was der uebergebene Spielstand selbst hergibt — auf dem
 * Server ist das die ganze Saison, im Browser nur der aktive Spieltag. Genau diese Grenze macht
 * die Aufschluesselung sichtbar: ein Spieltag, zu dem hier ein (moeglicherweise leerer) Eintrag
 * steht, ist GEDECKT; ein fehlender Spieltag ist UNBEKANNT und wird oben aus der mitgelieferten
 * Projektion ergaenzt. Ohne diese Unterscheidung liesse sich „keine Karte gelegt" nicht von
 * „Daten nicht da" trennen — und genau daran hat der Saisonstand ueberall 0 angezeigt.
 */
export function berechnePpAreaFormBonusJeSpieltag(
  gameState: Pick<GameState, "seasonState" | "disciplines">,
  seasonId: string,
): Map<string, Map<string, PpAreaFormBonusByArea>> {
  const selectedSnapshot =
    (gameState.seasonState.seasonSnapshots ?? []).find((snapshot) => snapshot.seasonId === seasonId) ?? null;
  const matchdayResults =
    selectedSnapshot?.matchdayResults ??
    (gameState.seasonState.matchdayResults ?? []).filter((result) => result.seasonId === seasonId);
  const gewertet = matchdayResults.filter((result) => result.status === "preview_applied");
  const matchdayIdByResultId = new Map(gewertet.map((result) => [result.id, result.matchdayId] as const));
  const disciplineResults = selectedSnapshot?.disciplineResults ?? gameState.seasonState.disciplineResults ?? [];
  const disciplineCategoryById = new Map(
    gameState.disciplines.map((discipline) => [discipline.id, discipline.category] as const),
  );

  const jeSpieltag = new Map<string, Map<string, PpAreaFormBonusByArea>>();
  /**
   * Ein Spieltag zaehlt erst dann als gedeckt, wenn wirklich Disziplin-Ergebnisse zu ihm
   * vorliegen — die `matchdayResults` fahren im kompakten Payload vollstaendig mit, die
   * `disciplineResults` nicht. Wuerde schon die blosse Kopfzeile als „gedeckt" gelten, wuerde
   * der Browser neun leere Spieltage ueber die Projektion legen und waere wieder bei 0.
   */
  const gedeckt = new Set<string>();
  for (const result of disciplineResults) {
    const matchdayId = matchdayIdByResultId.get(result.matchdayResultId);
    if (matchdayId != null) {
      gedeckt.add(matchdayId);
    }
  }
  for (const matchdayId of gedeckt) {
    jeSpieltag.set(matchdayId, new Map<string, PpAreaFormBonusByArea>());
  }

  for (const result of disciplineResults) {
    const matchdayId = matchdayIdByResultId.get(result.matchdayResultId);
    if (matchdayIdByResultId.size > 0 && matchdayId == null) {
      continue;
    }

    const formModifier = result.formModifier ?? null;
    if (formModifier == null || !Number.isFinite(formModifier) || Math.abs(formModifier) < 0.05) {
      continue;
    }

    const areaKey = getPpAreaKeyForDisciplineCategory(disciplineCategoryById.get(result.disciplineId));
    if (!areaKey) {
      continue;
    }

    // Ohne gewertete Spieltagskoepfe (Fixtures, Altstaende) bleibt der Ergebnis-Schluessel der
    // Eimer — dann faellt die Rechnung auf genau die Summe von frueher zurueck.
    const eimer = matchdayId ?? `result:${result.matchdayResultId}`;
    let jeTeam = jeSpieltag.get(eimer);
    if (!jeTeam) {
      jeTeam = new Map<string, PpAreaFormBonusByArea>();
      jeSpieltag.set(eimer, jeTeam);
    }
    const bereiche = jeTeam.get(result.teamId) ?? {};
    bereiche[areaKey] = roundValue((bereiche[areaKey] ?? 0) + formModifier, 4);
    jeTeam.set(result.teamId, bereiche);
  }

  return jeSpieltag;
}

export function buildPpAreaFormBonusByTeamId(
  gameState: GameState,
  seasonId: string,
): Record<string, PpAreaFormBonusTotals> {
  const ausSpielstand = berechnePpAreaFormBonusJeSpieltag(gameState, seasonId);

  /**
   * VORRANG JE SPIELTAG, NICHT PER `??`. Die mitgelieferte Projektion
   * (`foundation-pp-area-form-bonus-projection`) ist auf dem VOLLEN Save gerechnet und deckt
   * die ganze laufende Saison; der Browser kennt davon nur den aktiven Spieltag. `??` waere
   * hier gleich doppelt falsch: eine leere Map ist nicht nullish (daran ist eine fruehere
   * Reparatur schon einmal gescheitert, siehe `leseSaisonSchnappschuesse`), und ein
   * Entweder-Oder waere zu grob — wer den naechsten Spieltag gerade gespielt hat, hat dessen
   * Disziplin-Ergebnisse lokal, die Projektion stammt aber vom Laden. Also gewinnt der
   * Spielstand fuer die Spieltage, die er selbst deckt, und die Projektion fuellt den Rest.
   */
  const zusammen = new Map<string, Map<string, PpAreaFormBonusByArea>>();
  const projektion = gameState.seasonState.foundationPpAreaFormBonus;
  if (projektion && projektion.seasonId === seasonId) {
    for (const eintrag of projektion.matchdays) {
      zusammen.set(
        eintrag.matchdayId,
        new Map(Object.entries(eintrag.bonusByTeamId).map(([teamId, bereiche]) => [teamId, { ...bereiche }] as const)),
      );
    }
  }
  for (const [matchdayId, jeTeam] of ausSpielstand) {
    zusammen.set(matchdayId, jeTeam);
  }

  const totalsByTeamId = new Map<string, PpAreaFormBonusTotals>();
  for (const jeTeam of zusammen.values()) {
    for (const [teamId, bereiche] of jeTeam) {
      const current = totalsByTeamId.get(teamId) ?? createEmptyPpAreaFormBonusTotals();
      for (const areaKey of ["pow", "spe", "men", "soc"] as const) {
        const wert = bereiche[areaKey];
        if (wert == null || !Number.isFinite(wert)) continue;
        current[areaKey] = roundValue(current[areaKey] + wert, 4);
      }
      totalsByTeamId.set(teamId, current);
    }
  }

  // `total` ist immer die Summe der vier Bereiche — erst am Ende gerundet, damit die
  // Spaltenwerte und ihre Summe nicht in der letzten Stelle auseinanderlaufen.
  for (const totals of totalsByTeamId.values()) {
    totals.total = roundValue(totals.pow + totals.spe + totals.men + totals.soc, 1);
    totals.pow = roundValue(totals.pow, 1);
    totals.spe = roundValue(totals.spe, 1);
    totals.men = roundValue(totals.men, 1);
    totals.soc = roundValue(totals.soc, 1);
  }

  return Object.fromEntries(totalsByTeamId.entries());
}

function formatLocalePoints(value: number, maximumFractionDigits: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

export function formatPpFormBonus(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || Math.abs(value) < 0.05) {
    return null;
  }

  const digits = Math.abs(value % 1) > 0.05 ? 1 : 0;
  return `${value > 0 ? "+" : ""}${formatLocalePoints(value, digits)}`;
}

export function formatPpFormBonusParen(value: number | null | undefined) {
  const formatted = formatPpFormBonus(value);
  return formatted ? `(${formatted})` : null;
}

export function resolvePpAreaTotalsFromSeasonRow(row: PpAreaSeasonStandRowInput): PpAreaTotals {
  const pow = resolveSeasonDisciplineAreaTotal(row.disciplineValues, "pow", row.ppsPow);
  const spe = resolveSeasonDisciplineAreaTotal(row.disciplineValues, "spe", row.ppsSpe);
  const men = resolveSeasonDisciplineAreaTotal(row.disciplineValues, "men", row.ppsMen);
  const soc = resolveSeasonDisciplineAreaTotal(row.disciplineValues, "soc", row.ppsSoc);

  const areaSum = Number(
    [pow, spe, men, soc]
      .map((value) => (value != null && Number.isFinite(value) ? value : 0))
      .reduce((sum, value) => sum + value, 0)
      .toFixed(1),
  );

  const total = areaSum > 0 ? areaSum : row.ppsTotal > 0 ? Number(row.ppsTotal.toFixed(1)) : areaSum;

  return { total, pow, spe, men, soc };
}
