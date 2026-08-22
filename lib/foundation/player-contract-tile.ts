import { vertragLaeuftAus } from "@/lib/contracts/vertragslaufzeit";
import type { ContractYearSalary } from "@/lib/data/olyDataTypes";

/**
 * Anzeigemodell der VERTRAG-Kachel im Spielerprofil (`PlayerHeroNewLook`).
 *
 * Wichtig zur Semantik: `contractLength` ist die VERBLEIBENDE Laufzeit, nicht
 * die urspruenglich vereinbarte — der Saisonende-Tick zaehlt sie herunter
 * (`statusAfterSeasonTick`) und kuerzt die Gehaltsstaffel synchron mit
 * (`advanceRosterContractSchedule`, beide in contract-renewal-service). Deshalb
 * heisst die Kachel "noch N Saisons" und Index 0 der Staffel ist immer die
 * laufende Saison. Bei Restlaufzeit 1 gilt der Vertrag als auslaufend — dieselbe
 * Schwelle, die `normalizeRosterContractStatus` als "expiring" fuehrt.
 */
export type PlayerContractTileView = {
  /** Hauptwert der Kachel, z. B. "3 Saisons". `null` = kein laufender Vertrag. */
  valueLabel: string | null;
  /** Unterzeile: "läuft aus", "steigend", "fallend" oder "konstant". */
  subLabel: string | null;
  /** Auslaufend (Restlaufzeit 1) — die Kachel wird dann farblich betont. */
  isExpiring: boolean;
  /**
   * Gehaltsverlauf, nur gesetzt wenn mehr als eine Saison uebrig ist. Bei
   * Ein-Saison-Vertraegen (in der Liga die grosse Mehrheit) gibt es keinen
   * Verlauf zu zeigen, dann bleibt es allein bei der Kachel.
   */
  schedule: ContractYearSalary[];
};

function normalizeLength(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

/** Vergleicht erste und letzte Rate — das ist der real sichtbare Verlauf, unabhaengig von `contractShape`. */
function describeTrend(schedule: ContractYearSalary[]): string {
  if (schedule.length <= 1) {
    return "konstant";
  }
  const first = schedule[0]?.salary ?? 0;
  const last = schedule[schedule.length - 1]?.salary ?? 0;
  // Cent-Rauschen aus der gerundeten Staffel nicht als Trend verkaufen.
  const delta = last - first;
  if (Math.abs(delta) < 0.01) {
    return "konstant";
  }
  return delta > 0 ? "steigend" : "fallend";
}

export function buildPlayerContractTileView(input: {
  contractLength: number | null | undefined;
  yearlySalarySchedule?: ContractYearSalary[] | null;
}): PlayerContractTileView {
  const remaining = normalizeLength(input.contractLength);
  if (remaining <= 0) {
    return { valueLabel: null, subLabel: null, isExpiring: false, schedule: [] };
  }

  // Die Staffel kann laenger sein als die Restlaufzeit (Altstaende, importierte
  // Economy) — auf die verbleibenden Saisons zuschneiden, damit Kachel und
  // Verlauf nie widersprechen.
  const rawSchedule = input.yearlySalarySchedule ?? [];
  const schedule = rawSchedule.slice(0, remaining);
  // Auslaufend heisst 0 — bei 1 kommt noch eine ganze Saison. Siehe `vertragLaeuftAus`.
  const isExpiring = vertragLaeuftAus(remaining);

  return {
    valueLabel: `${remaining} ${remaining === 1 ? "Saison" : "Saisons"}`,
    subLabel: isExpiring ? "läuft aus" : describeTrend(schedule),
    isExpiring,
    // Ein einzelner Eintrag ist kein Verlauf — dann zeigt die GEHALT-Kachel bereits alles.
    schedule: schedule.length > 1 ? schedule : [],
  };
}
