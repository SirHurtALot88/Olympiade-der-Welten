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
  entry: Pick<RosterEntry, "contractLength" | "contractStatus" | "contractEndSeasonNumber">,
  /**
   * Die laufende Saison. Ohne sie bleibt es beim Countdown — mit ihr entscheidet die ENDSAISON.
   *
   * GEMELDET VON CHRIS: „xelara steht aktuell dann immernoch auf vertrag läuft aus", obwohl ihr
   * Vertrag bis Ende Saison 2 laeuft. Der Countdown wird am Ende einer Saison gesenkt, waehrend
   * diese noch die laufende ist; danach heisst eine 1 „noch eine volle Saison". Diese Funktion las
   * sie weiter als „letzte Saison" — bei Xelara und 128 weiteren Spielern der Liga.
   *
   * Optional, weil viele Aufrufer keinen Spielstand zur Hand haben. Sie bekommen weiter die alte
   * Antwort; falsch wird sie erst im Saisonende-Fenster, und dort wandern die Aufrufer nach.
   */
  aktuelleSaisonNummer?: number | null,
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

  const ende = entry.contractEndSeasonNumber;
  if (typeof ende === "number" && Number.isFinite(ende) && aktuelleSaisonNummer != null) {
    if (ende < aktuelleSaisonNummer) return "out_of_contract";
    if (ende === aktuelleSaisonNummer) return "expiring";
    return "active";
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
