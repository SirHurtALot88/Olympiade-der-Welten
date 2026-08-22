import type { GameState } from "@/lib/data/olyDataTypes";
import { endSaisonNummer } from "@/lib/contracts/vertragslaufzeit";
import { hasSeasonEndContractTickApplied } from "@/lib/contracts/saisonende-alterung-marke";
import { getCurrentSeasonNumber } from "@/lib/foundation/season-history-clamp";

/**
 * DER EINMALIGE NACHTRAG: jeder Bestandsvertrag bekommt seine Endsaison ins Feld geschrieben.
 *
 * ENTSCHIEDEN VON CHRIS: „Endsaison speichern" statt weiter herunterzuzählen.
 *
 * Seit dem Umbau ist `contractEndSeasonNumber` die Wahrheit und `contractLength` nur noch ein
 * abgeleiteter Countdown. Geschrieben wird das Feld allerdings erst bei einer NEUEN Unterschrift.
 * Wer heute einen laufenden Vertrag hat, trägt es nicht — an Chris' Spielstand sind das 268 von
 * 269 Verträgen. Für die wird die Endsaison bei jedem Lesen neu aus dem Countdown abgeleitet.
 *
 * Solange die Alterung läuft, stimmen beide überein. Nimmt man sie weg — und genau das ist das
 * Ziel —, bliebe der Countdown stehen, und mit ihm die abgeleitete Endsaison: kein Vertrag der
 * Liga würde je wieder auslaufen. Der Nachtrag ist deshalb die VORAUSSETZUNG dafür, die Alterung
 * ersatzlos zu streichen, und nicht bloß Aufräumen.
 *
 * WARUM BEIM LADEN UND NICHT ALS SKRIPT. Ein Skript müsste jemand ausführen, für jeden Spielstand
 * einzeln, und ein übersehener Stand fiele erst auf, wenn seine Verträge nicht mehr enden. Beim
 * Laden trifft es jeden Spielstand von selbst, genau einmal, und die nächste Speicherung schreibt
 * es fest.
 *
 * WARUM DAS AUCH SPÄT NOCH RICHTIG RECHNET. `endSaisonNummer` kennt den Versatz des
 * Saisonende-Fensters: läuft der Nachtrag mitten in der Saison, zählt die laufende mit; läuft er
 * nach der Alterung, ist die erste offene Saison die kommende. Beide Wege führen auf dieselbe
 * Endsaison, der Zeitpunkt des Nachtrags ist also gleichgültig.
 *
 * An Chris' Spielstand nachgerechnet (Saison 1, Alterung gelaufen, 269 Verträge):
 *
 *     Laufzeit   1 -> 129    Endsaison 2 -> 129
 *                2 ->  62              3 ->  62
 *                3 ->  67              4 ->  67
 *                4 ->  10              5 ->  10
 *                5 ->   1              6 ->   1
 *
 * IDEMPOTENT: ein bereits gesetztes Feld wird nie überschrieben. Eine von Hand oder durch eine
 * Unterschrift gesetzte Endsaison schlägt den Countdown — das ist der ganze Punkt der Umstellung,
 * und ein Nachtrag, der sie zurückrechnet, würde ihn aufheben.
 */
export function trageEndsaisonNach(gameState: GameState): GameState {
  const rosters = gameState.rosters;
  if (!Array.isArray(rosters) || rosters.length === 0) {
    return gameState;
  }
  if (getCurrentSeasonNumber(gameState) == null) {
    // Ohne Saisonnummer gäbe es nichts, worauf sich eine Endsaison beziehen könnte.
    return gameState;
  }

  const alterungBereitsGelaufen = hasSeasonEndContractTickApplied(gameState);
  let geaendert = false;
  const naechsteRosters = rosters.map((entry) => {
    if (typeof entry.contractEndSeasonNumber === "number" && Number.isFinite(entry.contractEndSeasonNumber)) {
      return entry;
    }
    const ende = endSaisonNummer(entry, gameState, { alterungBereitsGelaufen });
    if (ende == null) {
      return entry;
    }
    geaendert = true;
    return { ...entry, contractEndSeasonNumber: ende };
  });

  if (!geaendert) {
    return gameState;
  }
  return { ...gameState, rosters: naechsteRosters };
}
