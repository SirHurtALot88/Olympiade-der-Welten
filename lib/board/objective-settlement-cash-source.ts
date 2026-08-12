/**
 * DIE EINE QUELLE FÜR „WAS HABEN DIE VORSTANDSZIELE GEKOSTET ODER GEBRACHT".
 *
 * DAS PROBLEM, DAS SIE LÖST. Mehrere Vorstandsziele werten gegen den LEBENDEN Kontostand:
 * `finance-rebuild-cash-buffer` misst den Liga-Rang von `cash`, `finance-salary-ratio` misst
 * `salary/(cash+salary)`, V1-`finance-cash-positive` liest `cash` direkt. Die Saisonende-Kette bucht
 * aber Sponsor und Gebäude VOR den Zielen (`season-completion-service.ts`, dann
 * `season-end-tail-settlement.ts`). Jede dieser Buchungen verschiebt die Liga-Cash-Ränge, ein
 * Zielstatus kippt von `failed` auf `completed` — und damit ändert sich die GuV-Zeile
 * „Vorstandsziele" allein dadurch, WANN man sie anschaut.
 *
 * Am Live-Abbild vom 12.08.2026 im Spielstand `1hf25q` (Saison 2, bereits abgerechnet) gemessen:
 * für 5 von 32 Teams wich die angezeigte Zeile vom Buchungsbeleg ab, bis zu 4,0 C je Team. Der
 * Spieler sah also eine GuV, die nicht zu der Kontobewegung passte, die tatsächlich stattgefunden
 * hat.
 *
 * DIE LÖSUNG IST NICHT EINE ZWEITE RECHNUNG, SONDERN DER BELEG. Die Buchung protokolliert ihre
 * Wahrheit längst: `applyTeamSeasonObjectiveRewards` schreibt
 * `objectiveRewardApplyLogs[].payload.cashDeltaByTeamId` — genau die Aufteilung, aus der `team.cash`
 * fortgeschrieben wurde. Sobald dieser Beleg existiert, ist er die Quelle. Nur solange er fehlt (die
 * Saison läuft noch), zeigt die Zeile die Hochrechnung — dann aber als solche gekennzeichnet.
 * Dasselbe Muster wie `apronGebucht` in `season-guv-resolver.ts`.
 *
 * BEWUSST EINE EIGENE DATEI und nicht in `team-season-objectives-service.ts`: dort wird parallel die
 * Ziel-Vergabe repariert (Paket 2), und die beiden Änderungen sollen sich nicht ins Gehege kommen.
 */
import { buildTeamSeasonObjectiveSettlement } from "@/lib/board/team-season-objectives-service";
import type { GameState } from "@/lib/data/olyDataTypes";

export type ObjectiveSettlementCashSource = {
  /** Cash-Wirkung je Team. Teams ohne Eintrag hatten keine — 0, nicht „unbekannt". */
  byTeamId: Map<string, number>;
  /** `true` = die Ziele dieser Saison sind gebucht (ein Apply-Log liegt vor). */
  gebucht: boolean;
  /** Woher die Zahlen stammen: der Buchungsbeleg oder die Live-Hochrechnung. */
  quelle: "beleg" | "projektion";
  /** Auffälligkeiten für Audit und Hover — leer im Normalfall. */
  warnungen: string[];
};

function roundCash(value: number) {
  return Math.round(value * 10) / 10;
}

/**
 * Die Cash-Wirkung der Vorstandsziele der AKTUELLEN Saison.
 *
 * Reihenfolge: Beleg zuerst, Projektion nur ohne Beleg.
 */
export function getObjectiveCashByTeam(gameState: GameState): ObjectiveSettlementCashSource {
  const seasonId = gameState.season.id;
  const applyLog = (gameState.seasonState.objectiveRewardApplyLogs ?? []).find((log) => log.seasonId === seasonId) ?? null;
  const warnungen: string[] = [];

  if (applyLog) {
    const gebuchteVerteilung = applyLog.payload?.cashDeltaByTeamId;
    // Auf VORHANDENSEIN des Feldes prüfen, nicht auf Inhalt: eine LEERE Map ist eine gültige
    // Antwort („kein Team hat etwas bekommen") und kein fehlender Beleg. Ein `??` hätte hier nie
    // gegriffen, weil `{}` nicht nullish ist — und ein Test auf `Object.keys().length > 0` würde
    // eine ehrliche Null-Buchung fälschlich zur Hochrechnung zurückstufen.
    if (gebuchteVerteilung !== undefined && gebuchteVerteilung !== null) {
      const byTeamId = new Map<string, number>();
      for (const [teamId, cashDelta] of Object.entries(gebuchteVerteilung)) {
        if (!Number.isFinite(cashDelta)) {
          warnungen.push(`objective_cash_log_wert_ungueltig:${teamId}`);
          continue;
        }
        byTeamId.set(teamId, roundCash(cashDelta));
      }
      return { byTeamId, gebucht: true, quelle: "beleg", warnungen };
    }
    // Älterer Spielstand: gebucht, aber ohne Aufteilung im Beleg. Dann bleibt nur die Projektion —
    // und die Warnung, dass die Zeile nachgerechnet und nicht abgelesen ist.
    warnungen.push("objective_cash_log_ohne_aufteilung");
  }

  const byTeamId = new Map<string, number>();
  try {
    const settlement = buildTeamSeasonObjectiveSettlement(gameState);
    for (const [teamId, summary] of Object.entries(settlement.byTeamId)) {
      if (!summary) continue;
      byTeamId.set(teamId, roundCash(summary.cashDelta));
    }
  } catch {
    // „Nicht kaputt bauen": ein Fehler in der Ziel-Projektion darf die GuV nicht kippen. Dann steht
    // die Zeile auf 0 — wie bisher —, aber die Warnung sagt, dass das keine gemessene Null ist.
    warnungen.push("objective_cash_projektion_fehlgeschlagen");
    return { byTeamId: new Map(), gebucht: applyLog != null, quelle: "projektion", warnungen };
  }

  return { byTeamId, gebucht: applyLog != null, quelle: "projektion", warnungen };
}
