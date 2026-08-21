import type { ContractStatus, RosterEntry } from "@/lib/data/olyDataTypes";

/**
 * WANN EIN VERTRAG WAS IST — an einer Stelle, weil zwei Stellen zwei Wahrheiten waeren.
 *
 * Die Regel stand bisher nur in `contract-renewal-service.ts`. Der Dienst fuer die
 * Vertragsaufloesung braucht sie ebenfalls (er darf einem ohnehin auslaufenden Vertrag kein
 * Angebot mehr machen), duerfte sie dort aber nicht importieren: die Aufloesung haengt ueber
 * `ai-contract-dissolution-service` schon am Verlaengerungs-Dienst, ein Import zurueck waere ein
 * Kreis. Deshalb liegt die Regel hier, neutral, und beide lesen sie.
 *
 * DIE BEDEUTUNG VON `contractLength` — die Falle, aus der ein gemeldeter Fehler entstand:
 * die Zahl zaehlt die Saisons EINSCHLIESSLICH der gerade laufenden. Eine 1 heisst also nicht
 * „noch ein Jahr Luft", sondern „das hier ist sein letztes" — deshalb `expiring` und nicht
 * `active`. Am Saisonende ist genau das der Moment, in dem entschieden werden muss.
 */
export function normalizeContractLength(value: number | null | undefined): number {
  return Math.max(0, Math.round(typeof value === "number" && Number.isFinite(value) ? value : 0));
}

export function normalizeRosterContractStatus(
  entry: Pick<RosterEntry, "contractLength" | "contractStatus">,
): ContractStatus {
  if (
    entry.contractStatus === "released" ||
    entry.contractStatus === "out_of_contract" ||
    entry.contractStatus === "renewal_pending"
  ) {
    return entry.contractStatus;
  }
  if (entry.contractStatus === "free_agent") {
    return "out_of_contract";
  }

  const length = normalizeContractLength(entry.contractLength);
  if (length <= 0) return "out_of_contract";
  if (length === 1) return "expiring";
  return "active";
}

/**
 * Laeuft der Vertrag mit dieser Saison aus — ist die Entscheidung also JETZT faellig?
 *
 * Fasst die drei Zustaende zusammen, in denen kein Restvertrag mehr uebrig ist: die letzte
 * Saison laeuft (`expiring`), sie ist vorbei (`out_of_contract`), oder die Verlaengerung steht
 * ausdruecklich an (`renewal_pending`).
 */
export function istVertragAmAuslaufen(
  entry: Pick<RosterEntry, "contractLength" | "contractStatus">,
): boolean {
  const status = normalizeRosterContractStatus(entry);
  return status === "expiring" || status === "out_of_contract" || status === "renewal_pending";
}
