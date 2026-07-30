import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * IST DAS SPONSORGELD DIESER SAISON WIRKLICH GEFLOSSEN?
 *
 * Zwei Dinge sahen bisher gleich aus und sind es nicht:
 *
 *   „Der Schritt wurde ausgeloest"  → ein Eintrag in `cashPrizeApplyLogs`
 *   „Das Geld liegt auf dem Konto"  → ein `season_end`-Eintrag in `sponsorPayoutLogs`
 *
 * Solange `writeLocalCashPrizeApply` ausschliesslich Tabellen-Spalten und das Audit-Log
 * schrieb, konnte das erste ohne das zweite eintreten — genau das ist passiert: die
 * Oberflaeche meldete „Ist gebucht — das Geld steht auf dem Konto", waehrend das Cash
 * aller 32 Teams unveraendert blieb. Wer danach fragte, ob der Schritt erledigt sei,
 * fragte nach dem Audit-Log und bekam „ja".
 *
 * Seit die Buchung wirklich stattfindet (`applySponsorSettlement` im Saisonende-Zweig),
 * ist der Zahlungs-Log die einzige ehrliche Antwort auf „ist das erledigt?". Diese
 * Funktion ist deshalb die gemeinsame Quelle fuer Oberflaeche UND Doppelbuchungs-Schutz —
 * getrennte Antworten waren der Fehler.
 *
 * `applySponsorSettlement` fuehrt seine eigene Idempotenz je Team (`hasSeasonEndPayoutLog`),
 * und `season-completion-service` ueberspringt bei vorhandenem `season_end`-Eintrag. Diese
 * Funktion ergaenzt das nur um die Frage auf Saison-Ebene.
 */
export function hasSeasonEndSponsorPayout(gameState: GameState, seasonId: string): boolean {
  return (gameState.seasonState.sponsorPayoutLogs ?? []).some(
    (log) => log.seasonId === seasonId && log.phase === "season_end",
  );
}

/**
 * Wurde der Saisonende-Schritt schon einmal ANGESTOSSEN? Das ist bewusst etwas anderes
 * als die Frage oben und beantwortet nur, ob ein Audit-Log existiert.
 */
export function hasCashPrizeApplyLog(gameState: GameState, seasonId: string): boolean {
  return (gameState.seasonState.cashPrizeApplyLogs ?? []).some((log) => log.seasonId === seasonId);
}

/**
 * Der Zustand, den die Oberflaeche zeigen soll.
 *
 * `pending_payout` ist der Fall aus dem gemeldeten Spielstand: der Schritt lief, aber vor
 * dem Fix — es floss kein Geld. Der Knopf muss dort wieder anfassbar sein, sonst bleibt
 * der Spieler mit einem „erledigt" stehen, das nie stattgefunden hat.
 */
export type SeasonEndPayoutStatus = "open" | "pending_payout" | "paid";

export function getSeasonEndPayoutStatus(gameState: GameState, seasonId: string): SeasonEndPayoutStatus {
  if (hasSeasonEndSponsorPayout(gameState, seasonId)) {
    return "paid";
  }
  return hasCashPrizeApplyLog(gameState, seasonId) ? "pending_payout" : "open";
}
