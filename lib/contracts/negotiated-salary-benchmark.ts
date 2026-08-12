/**
 * DER LADE-BACKFILL FUER DAS VERHANDLUNGS-BENCHMARK (`RosterEntry.negotiatedAnnualSalary`).
 *
 * Seit Chris' Entscheidung („ja!", `docs/APRON_UND_VERTRAGSFORMEN.md` Schritt 3) bemisst die Apron
 * das VERHANDELTE Jahresgehalt. Das Feld ist neu; Bestandsvertraege tragen es nicht. Dieser
 * Backfill schreibt es beim Laden EINMAL je Vertrag nach und macht damit zwei Zusagen wahr:
 *
 *  1. MIGRATION: kein Bestandsvertrag wird stillschweigend anders besteuert als ein neuer. Basis
 *     ist der Durchschnitt der gespeicherten Schedule — exakt fuer balanced und fuer frisch
 *     unterschriebene geformte Vertraege, beste Naeherung fuer einen mittendrin geformten (dessen
 *     Rest-Schedule ist um die bereits gezahlten Jahre gekuerzt). Die Zahl der Naeherungsfaelle
 *     zaehlt `countNegotiatedSalaryBenchmarkSources` und weist sie aus.
 *  2. BACKSTOP GEGEN DIE FEHLERKLASSE „FELD, DAS NIEMAND SCHREIBT": vergisst ein kuenftiger
 *     Unterschriftspfad das Feld, faellt der Vertrag hier auf. Und weil ein frisch
 *     unterschriebener Vertrag noch seine VOLLE Schedule traegt, ist der nachgetragene Wert dann
 *     exakt das verhandelte Jahresgehalt — der Backstop repariert, statt zu verschleiern.
 *
 * IDEMPOTENT: ein bereits gesetztes Feld wird NIE ueberschrieben. Das ist die ganze Pointe des
 * Felds — nach einem Saisonwechsel waere der Schedule-Durchschnitt eines geformten Vertrags
 * kleiner als das verhandelte Gehalt, und ein zweiter Durchlauf wuerde die Steuerbasis senken.
 */
import type { GameState, RosterEntry } from "@/lib/data/olyDataTypes";
import {
  resolveNegotiatedAnnualSalary,
  type NegotiatedAnnualSalarySource,
} from "@/lib/foundation/player-economy-contract";

export function withNegotiatedSalaryBenchmark(gameState: GameState): GameState {
  const rosters = gameState.rosters ?? [];
  let changed = false;
  const nextRosters = rosters.map((entry) => {
    if (typeof entry.negotiatedAnnualSalary === "number" && Number.isFinite(entry.negotiatedAnnualSalary)) {
      return entry;
    }
    const benchmark = resolveNegotiatedAnnualSalary(entry).value;
    if (benchmark == null) return entry;
    changed = true;
    return { ...entry, negotiatedAnnualSalary: benchmark } satisfies RosterEntry;
  });
  return changed ? { ...gameState, rosters: nextRosters } : gameState;
}

/** Woher die Benchmarks eines Spielstands stammen — die Migrations-Kennzahl fuer den Bericht. */
export function countNegotiatedSalaryBenchmarkSources(
  gameState: GameState,
): Record<NegotiatedAnnualSalarySource, number> & { geformtOhneFeld: number } {
  const counts = {
    persisted: 0,
    schedule_average: 0,
    stored_salary: 0,
    missing: 0,
    geformtOhneFeld: 0,
  };
  for (const entry of gameState.rosters ?? []) {
    const { source } = resolveNegotiatedAnnualSalary(entry);
    counts[source] += 1;
    const geformt = entry.contractShape === "front_loaded" || entry.contractShape === "back_loaded";
    if (source !== "persisted" && geformt) counts.geformtOhneFeld += 1;
  }
  return counts;
}
