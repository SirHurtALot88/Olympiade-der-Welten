/**
 * DER GEMEINSAME SCHWANZ DER SAISONENDE-BUCHUNG — Kredite, Vorstandsziele, Zahlungsunfähigkeit.
 *
 * ACHTUNG BEIM LESEN DER HISTORIE UNTEN: der dritte Schritt hiess frueher „Insolvenz-Backstop" und
 * NAHM einen Notkredit auf. Er tut das nicht mehr — er stellt nur noch fest, wer im Minus steht
 * (siehe Schritt 3 unten und `collectNegativeCashTeams`). Der Ausgleich per Notkredit lebt weiter,
 * aber am Ende des KAUFFENSTERS, nicht hier.
 *
 * WARUM ES DIESE DATEI GIBT. Es gab zwei Wege, eine Saison abzurechnen:
 *
 *   A) `runLocalSeasonCompletion` (Cockpit, „Saison abschliessen") — vollständig.
 *   B) `writeLocalCashPrizeApply` (Knopf „Sponsoren buchen" / „Jetzt nachbuchen") — bucht Sponsor,
 *      Apron und Gebäude, und hörte danach auf.
 *
 * Weg B fehlten drei Schritte, die auf dem Konto landen: die KREDITRATEN, die
 * VORSTANDSZIEL-Prämien/-Strafen und — der folgenreichste — der INSOLVENZ-BACKSTOP. Genau dieser
 * Weg war es, den Chris benutzt hat, als er meldete: „ich habe jetzt das Cash gebucht und so viele
 * Teams hatten ne positive GuV und jetzt haben so viele Teams negatives Cash????" Der Spielstand
 * zeigte 12 Teams im Minus, 0 Kredite, 0 Notkredit-Logs und genau einen `cashPrizeApplyLog` — der
 * Backstop war nie gelaufen, weil dieser Pfad ihn nicht kannte.
 *
 * Hier steht der Schwanz jetzt EINMAL, und beide Wege rufen ihn auf. Reihenfolge wie in A, weil sie
 * begründet ist: Kredite vor Gebäuden (die Rate ist fällig, bevor Unterhalt bezahlt wird), Ziele
 * danach, und die Zahlungsunfähigkeits-Feststellung ganz zuletzt — sie soll den Stand melden, mit
 * dem das Team wirklich in die Pause geht, und das kann sie nur, wenn alle anderen Cash-Bewegungen
 * schon gebucht sind.
 *
 * IDEMPOTENZ: jeder Teilschritt prüft sein eigenes Log (`loanApplyLogs`, `objectiveRewardApplyLogs`)
 * und überspringt sich, wenn er in dieser Saison schon lief. Wer zuerst kommt, bucht — egal über
 * welchen der beiden Wege.
 */

import { applyTeamSeasonObjectiveRewards } from "@/lib/board/team-season-objectives-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import { applyLoanSettlement, collectNegativeCashTeams } from "@/lib/finance/loan-service";
import { zieheSaisonstandGuvNach } from "@/lib/finance/season-guv-nachbuchung";

export type SeasonEndTailResult = {
  gameState: GameState;
  loanSettlementApplied: boolean;
  objectiveRewardsApplied: boolean;
  /** Teams, deren eingefrorene GuV-Zeile auf den gebuchten Stand gezogen wurde. */
  standingsGuvRefreshedTeams: string[];
  /** Teams, die die Saison im Minus beenden. NUR festgestellt — der Ausgleich ist ihre Aufgabe. */
  negativeCashTeams: Array<{ teamId: string; shortfall: number }>;
  warnings: string[];
};

export type SeasonEndTailInput = {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  /** `false` = nur prüfen, nichts buchen. */
  execute: boolean;
};

function hasLoanSettlementLog(gameState: GameState, seasonId: string): boolean {
  return (gameState.seasonState.loanApplyLogs ?? []).some((log) => log.seasonId === seasonId && log.kind !== "early_payoff");
}

function hasObjectiveRewardLog(gameState: GameState, seasonId: string): boolean {
  return (gameState.seasonState.objectiveRewardApplyLogs ?? []).some((log) => log.seasonId === seasonId);
}

/**
 * Bucht Kredite → Vorstandsziele → Insolvenz-Backstop auf den übergebenen Zustand und gibt den
 * neuen Zustand zurück. Persistiert NICHTS — das bleibt beim Aufrufer, der seine eigene
 * Save-/Transaktionsführung hat.
 */
export function applySeasonEndTail(input: SeasonEndTailInput): SeasonEndTailResult {
  const warnings: string[] = [];
  let gameState = input.gameState;

  // 1) Kreditraten (Zins + Tilgung).
  let loanSettlementApplied = false;
  if (input.execute && !hasLoanSettlementLog(gameState, input.seasonId)) {
    const result = applyLoanSettlement(gameState, { execute: true, seasonId: input.seasonId });
    if (result.applied) {
      gameState = result.gameState;
      loanSettlementApplied = true;
    }
    // `LoanSettlementPreview` traegt keine Warnungen — der Schritt meldet nur, ob er gebucht hat.
  }

  // 2) Vorstandsziele (Prämien und Strafen).
  let objectiveRewardsApplied = false;
  if (input.execute && !hasObjectiveRewardLog(gameState, input.seasonId)) {
    const result = applyTeamSeasonObjectiveRewards(gameState, {
      saveId: input.saveId,
      seasonId: input.seasonId,
      execute: true,
    });
    if (result.applied) {
      gameState = result.gameState;
      objectiveRewardsApplied = true;
    }
    warnings.push(...(result.warnings ?? []));
  }

  // 3) Zahlungsunfähigkeit wird FESTGESTELLT, nicht ausgeglichen. Früher nahm hier jedes Team mit
  // negativem Cash ungefragt einen Notkredit über den Fehlbetrag auf (Cash danach 0) — auf dem
  // gespielten Stand standen dadurch 9 von 32 Teams auf exakt 0,0 und keines im Minus. Chris:
  // „teams können auch ins negative gehen und müssen das dann mit verkäufen und krediten wieder
  // auffüllen! es darf nicht einfach geld erschummelt und auf 0 gesetzt werden."
  const negativeCash = collectNegativeCashTeams(gameState);
  warnings.push(...negativeCash.warnings);

  /**
   * 4) DIE GuV IM SAISONSTAND AUF DEN GEBUCHTEN STAND ZIEHEN.
   *
   * Muss ganz zum Schluss stehen und tut es nur deshalb: `standings[team].guvPosten` entsteht in
   * `writeLocalCashPrizeApply`, also VOR Sponsor, Apron und diesem Schwanz hier. Alles, was danach
   * gebucht wird, fehlte der gespeicherten Zeile dauerhaft — der Apron stand dort sogar als „noch
   * nicht gebucht" und damit gar nicht in der Summe. Siehe `season-guv-nachbuchung.ts` für die
   * Messung.
   *
   * OHNE `execute`-Sperre und ohne eigenes Idempotenz-Log: der Schritt bucht nichts, er leitet nur
   * ab. Er muss auch dann laufen, wenn die Schritte 1 und 2 sich übersprungen haben — dann hat sie
   * der andere Weg gebucht und die Zeile ist trotzdem alt.
   */
  const nachbuchung = input.execute ? zieheSaisonstandGuvNach(gameState) : null;
  if (nachbuchung != null) {
    gameState = nachbuchung.gameState;
  }

  return {
    gameState,
    loanSettlementApplied,
    objectiveRewardsApplied,
    standingsGuvRefreshedTeams: nachbuchung?.geaenderteTeams ?? [],
    negativeCashTeams: negativeCash.teams,
    warnings: Array.from(new Set(warnings)),
  };
}
