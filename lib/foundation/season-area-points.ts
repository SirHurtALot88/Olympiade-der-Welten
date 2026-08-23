import { roundValue } from "@/lib/foundation/foundation-number-utils";
import { saisonstandDisciplineColumns } from "@/lib/foundation/saisonstand-column-contract";
import {
  SEASON_DISCIPLINE_AREA_GROUPS,
  resolveSeasonDisciplineAreaTotal,
} from "@/lib/season/season-discipline-area-groups";
import { normalizeLineupDisciplineFieldName } from "@/lib/lineups/team-discipline-ranks";

/**
 * DIE BEREICHSPUNKTE EINES TEAMS (POW/SPE/MEN/SOC) — an EINER Stelle gerechnet.
 *
 * ANLASS (Chris): „die PP Ansicht zeigt nicht unsere PPs der Spieler! … Bitte hier die PPs aus den
 * Bereichen hinterlegen wie sie auch im Saisonstand zu finden sind!"
 *
 * Das RANG-Popover im Teamprofil zeigte unter der Ueberschrift „PPs" die Summe der
 * DISZIPLIN-STAERKEN der besten sechs Spieler — Papierform statt Ertrag. An seinem Spielstand
 * (season-2, Spieltag 9) gemessen: C-S stand mit „6.395 PPs" da, geholt hatte das Team 112.
 *
 * WARUM DIESES MODUL UND NICHT EINE ZWEITE RECHNUNG IM POPOVER: die Anzeige ist NICHT einfach
 * `ledger.pointsByArea`. Der Saisonstand loest in drei Stufen auf, und die Stufen weichen
 * voneinander ab — die Disziplin-Summe laesst `bonuspunkte` bewusst weg, `pointsByArea` nicht.
 * Wer das im Popover nachbaut, baut die naechste Abweichung. Beide Ansichten rufen deshalb
 * `buildTeamSeasonAreaPoints` auf; die Funktionen darunter lagen vorher privat in
 * `team-management-overview.ts` und sind unveraendert hierher gezogen.
 */

const visibleSeasonPointsDisciplineKeys = saisonstandDisciplineColumns.filter(
  (columnKey) => columnKey !== "bonuspunkte",
);

export function derivePpsByAreaFromDisciplineValues(
  disciplineValues: Record<string, number | null> | null | undefined,
) {
  const totals = {
    total: 0,
    pow: 0,
    spe: 0,
    men: 0,
    soc: 0,
  };

  if (!disciplineValues) {
    return totals;
  }

  for (const disciplineKey of visibleSeasonPointsDisciplineKeys) {
    const value = disciplineValues[disciplineKey];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      continue;
    }

    totals.total += value;
  }

  for (const group of SEASON_DISCIPLINE_AREA_GROUPS) {
    const areaTotal = group.keys.reduce((sum, key) => {
      const value = disciplineValues[key];
      return sum + (typeof value === "number" && Number.isFinite(value) ? value : 0);
    }, 0);
    totals[group.id] = roundValue(areaTotal, 1);
  }

  return {
    total: roundValue(totals.total, 1),
    pow: totals.pow,
    spe: totals.spe,
    men: totals.men,
    soc: totals.soc,
  };
}

/**
 * WELCHER ZEITPUNKT GILT FÜR DIE ACHSPUNKTE — und zwar derselbe wie für die Disziplin-Spalten
 * daneben.
 *
 * BEFUND: Diese Funktion las `preferStandingDisciplineValues` nie. Sie nahm den Live-Ledger-Wert,
 * sobald er `> 0` war. Die Disziplin-Spalten derselben Zeile beachten das Flag aber sehr wohl
 * (`mergeSeasonDisciplineValues` bekommt `ledgerValues: null`, wenn es gesetzt ist). Beim Blick
 * auf eine ARCHIVIERTE Saison standen deshalb Snapshot-Disziplinwerte neben den PPs der
 * LAUFENDEN Saison — zwei Zeitpunkte in einer Zeile, gemessen am Live-Spielstand: Snapshot 11/12
 * gegen laufende 4,2/3,8.
 *
 * Das ist dieselbe Fehlerklasse, die den Saison-Snapshot-Umbau ausgelöst hat („in der teams
 * tabelle sind MW und Cash auch noch zum falschen zeitpunkt") — nur an einer anderen Lesestelle.
 *
 * Mit gesetztem Flag gilt jetzt ausschliesslich der Snapshot-Stand. Der Rückfall auf den
 * abgeleiteten Disziplinwert bleibt derselbe Ausdruck; er ist unter dem Flag ohnehin schon
 * rein aus `standing.disciplineValues` gebildet.
 */
export function resolveDisplayAreaPoints(
  ledgerValue: number,
  disciplineFallback: number,
  preferStandingValues: boolean,
) {
  if (preferStandingValues) {
    return disciplineFallback;
  }
  if (ledgerValue > 0) {
    return ledgerValue;
  }
  return disciplineFallback;
}

export function mergeSeasonDisciplineValues(input: {
  standingValues?: Record<string, number | null> | null;
  ledgerValues?: Record<string, number> | null;
}) {
  const merged = Object.fromEntries(
    saisonstandDisciplineColumns
      .filter((columnKey) => columnKey !== "bonuspunkte")
      .map((columnKey) => [columnKey, null] as const),
  ) as Record<string, number | null>;

  for (const [key, value] of Object.entries(input.standingValues ?? {})) {
    merged[key] = typeof value === "number" && Number.isFinite(value) ? roundValue(value, 1) : null;
  }

  for (const [disciplineId, value] of Object.entries(input.ledgerValues ?? {})) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      continue;
    }

    const normalizedKey = normalizeLineupDisciplineFieldName(disciplineId);
    if (!normalizedKey || !(normalizedKey in merged)) {
      continue;
    }

    merged[normalizedKey] = roundValue(value, 1);
  }

  return merged;
}

export type TeamSeasonAreaPoints = {
  /** Die Disziplin-Spalten der Zeile — dieselbe Merge-Basis wie im Saisonstand. */
  disciplineValues: Record<string, number | null>;
  /**
   * ZWEI STUFEN, BEWUSST BEIDE HERAUSGEGEBEN.
   *
   * `displayTotal`/`displayPow`… sind die Achspunkte VOR der Disziplin-Aufloesung — genau das, was
   * eine Saisonstand-Zeile als `ppsTotal`/`ppsPow` speichert und weiterreicht (Sponsoren, Board,
   * Praemien lesen diese Felder).
   *
   * `total`/`pow`… sind dieselben Werte NACH `resolveSeasonDisciplineAreaTotal` — das, was am
   * Bildschirm steht. Die Tabelle loeste bisher erst in der Ansicht auf
   * (`use-season-v2-panel-model`), das RANG-Popover gar nicht. Wer nur eine der beiden Stufen
   * herausgibt, zwingt den naechsten Aufrufer wieder zum Nachbauen.
   */
  displayTotal: number;
  displayPow: number;
  displaySpe: number;
  displayMen: number;
  displaySoc: number;
  total: number;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
};

/**
 * Die vier Bereichswerte einer Saisonstand-Zeile, fertig zum Anzeigen.
 *
 * `hasCurrentPps` bildet die Regel „vor dem ersten gewerteten Spieltag gibt es keine Wertung" ab:
 * ohne einen einzigen aus Spielern abgeleiteten Punkt bleibt die Gesamtsumme 0, statt eine
 * Scheingenauigkeit zu behaupten.
 */
export function buildTeamSeasonAreaPoints(input: {
  standingDisciplineValues?: Record<string, number | null> | null;
  ledgerPointsByDiscipline?: Record<string, number> | null;
  ledgerPointsByArea?: { power: number; speed: number; mental: number; social: number } | null;
  ledgerTotalPoints?: number | null;
  hasCurrentPps: boolean;
  preferStandingDisciplineValues?: boolean;
}): TeamSeasonAreaPoints {
  const preferStandingValues = input.preferStandingDisciplineValues ?? false;
  const disciplineValues = mergeSeasonDisciplineValues({
    standingValues: input.standingDisciplineValues,
    ledgerValues: preferStandingValues ? null : input.ledgerPointsByDiscipline ?? null,
  });
  const fallbackByArea = derivePpsByAreaFromDisciplineValues(disciplineValues);

  const ledgerPow = roundValue(input.ledgerPointsByArea?.power ?? 0, 1);
  const ledgerSpe = roundValue(input.ledgerPointsByArea?.speed ?? 0, 1);
  const ledgerMen = roundValue(input.ledgerPointsByArea?.mental ?? 0, 1);
  const ledgerSoc = roundValue(input.ledgerPointsByArea?.social ?? 0, 1);
  const ledgerTotal = input.hasCurrentPps ? roundValue(input.ledgerTotalPoints ?? 0, 1) : 0;

  const displayPow = resolveDisplayAreaPoints(ledgerPow, fallbackByArea.pow, preferStandingValues);
  const displaySpe = resolveDisplayAreaPoints(ledgerSpe, fallbackByArea.spe, preferStandingValues);
  const displayMen = resolveDisplayAreaPoints(ledgerMen, fallbackByArea.men, preferStandingValues);
  const displaySoc = resolveDisplayAreaPoints(ledgerSoc, fallbackByArea.soc, preferStandingValues);

  const displayTotal = resolveDisplayAreaPoints(ledgerTotal, fallbackByArea.total, preferStandingValues);

  return {
    disciplineValues,
    displayTotal,
    displayPow,
    displaySpe,
    displayMen,
    displaySoc,
    total: displayTotal,
    pow: resolveSeasonDisciplineAreaTotal(disciplineValues, "pow", displayPow),
    spe: resolveSeasonDisciplineAreaTotal(disciplineValues, "spe", displaySpe),
    men: resolveSeasonDisciplineAreaTotal(disciplineValues, "men", displayMen),
    soc: resolveSeasonDisciplineAreaTotal(disciplineValues, "soc", displaySoc),
  };
}
