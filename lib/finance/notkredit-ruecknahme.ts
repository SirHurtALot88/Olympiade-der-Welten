/**
 * NIMMT DIE ZWANGS-NOTKREDITE DER SAISONABRECHNUNG ZURÜCK.
 *
 * GEMELDET VON CHRIS: „oh shit das buchen der saisonabrechnung hat das cash kaputt gemacht. viele
 * teams haben plötzlich 0 […] eigentlich kann es ja nicht sein dass die halbe liga plötzlich genau
 * 0 hat. bitte vollzieh das mal nach und lass uns das savegame fixen."
 *
 * BEFUND AM LIVE-ABBILD (Spielstand `new-game-1785823388048-1hf25q`, Saison 2, Spieltag 10): neun
 * von 32 Teams stehen auf exakt 0,0 Cash und keines im Minus. Jedes dieser neun trägt einen
 * Bank-Kredit über genau den Betrag, der ihm gefehlt hätte — zusammen 164,2 Mio, die niemand
 * beantragt hat. Verursacher war der Insolvenz-Ausgleich am Ende der Saisonabrechnung; er ist dort
 * inzwischen entfernt (siehe `collectNegativeCashTeams`), aber die bereits gebuchten Kredite bleiben
 * im Spielstand stehen, bis sie jemand zurücknimmt.
 *
 * WARUM DIE RÜCKNAHME EXAKT IST UND KEINE SCHÄTZUNG. `originateLoan` fasst bei `lenderType: "bank"`
 * genau drei Dinge an: das Cash des Nehmers (+principal), `seasonState.loans` (ein Eintrag) und
 * `seasonState.loanOriginationLogs` (ein Eintrag). Kein Gegenkonto, kein Vorstandswert, kein
 * Standings-Effekt. Wer diese drei Dinge rückgängig macht, stellt den Zustand von vorher her —
 * Zeichen für Zeichen.
 *
 * WIE EIN ZWANGS-NOTKREDIT ERKANNT WIRD. Alle fünf Merkmale müssen zutreffen, damit ein freiwillig
 * aufgenommener Kredit niemals mitgerissen wird:
 *   1. `lenderType === "bank"` — der Ausgleich lieh immer bei der Bank, nie bei einem Team.
 *   2. `termSeasons === INSOLVENCY_BACKSTOP_TERM_SEASONS` (4) — die feste Laufzeit des Ausgleichs.
 *      Ein Team, das freiwillig leiht, wählt seine Laufzeit aus dem Angebot.
 *   3. `seasonsRemaining === termSeasons` — es wurde noch keine einzige Rate gezahlt.
 *   4. `principalOutstanding === principalOriginal` — Restschuld unberührt, also auch keine
 *      kapitalisierten Zinsen.
 *   5. `status === "active"`.
 * Am Abbild trennt das sauber: der einzige andere Bank-Kredit (Zombie Horde, 36,0 aufgenommen,
 * 43,0 Restschuld, Laufzeit 2) fällt an Merkmal 2 UND 4 heraus — er ist regulär und bleibt stehen.
 *
 * WAS DANACH GILT: die betroffenen Teams stehen wieder im MINUS, und das ist der Punkt. Chris:
 * „teams können auch ins negative gehen und müssen das dann mit verkäufen und krediten wieder
 * auffüllen! es darf nicht einfach geld erschummelt und auf 0 gesetzt werden." Negatives Cash
 * blockiert Käufe, erzwingt Notverkäufe und setzt den Verkaufsdruck auf den Höchstwert — die
 * Teams arbeiten sich also selbst heraus.
 */

import type { GameState, LoanRecord } from "@/lib/data/olyDataTypes";
import { INSOLVENCY_BACKSTOP_TERM_SEASONS } from "@/lib/finance/loan-service";

function roundCash(value: number) {
  return Number(value.toFixed(2));
}

export type NotkreditRuecknahmeZeile = {
  teamId: string;
  loanId: string;
  principal: number;
  cashVorher: number;
  cashNachher: number;
};

export type NotkreditRuecknahmePlan = {
  seasonId: string;
  /** Die erkannten Zwangs-Notkredite, in der Reihenfolge, in der sie im Spielstand stehen. */
  zeilen: NotkreditRuecknahmeZeile[];
  /** Summe der zurückgenommenen Kreditbeträge. */
  summe: number;
  /** Bank-Kredite derselben Saison, die BEWUSST stehen bleiben — mit dem Grund. */
  behalten: Array<{ teamId: string; loanId: string; grund: string }>;
  /** `null`, wenn nichts zu tun ist. */
  gameStateRepariert: GameState | null;
};

function istZwangsNotkredit(loan: LoanRecord, seasonId: string): boolean {
  return (
    loan.originatedSeasonId === seasonId &&
    loan.lenderType === "bank" &&
    loan.status === "active" &&
    loan.termSeasons === INSOLVENCY_BACKSTOP_TERM_SEASONS &&
    loan.seasonsRemaining === loan.termSeasons &&
    Math.abs(loan.principalOutstanding - loan.principalOriginal) < 0.005
  );
}

/** Warum ein Bank-Kredit derselben Saison NICHT als Zwangs-Notkredit gilt — für den Bericht. */
function behaltGrund(loan: LoanRecord): string {
  if (loan.status !== "active") return `Status ${loan.status}`;
  if (loan.termSeasons !== INSOLVENCY_BACKSTOP_TERM_SEASONS) return `Laufzeit ${loan.termSeasons} statt ${INSOLVENCY_BACKSTOP_TERM_SEASONS}`;
  if (loan.seasonsRemaining !== loan.termSeasons) return `bereits ${loan.termSeasons - loan.seasonsRemaining} Rate(n) gezahlt`;
  return `Restschuld ${loan.principalOutstanding} weicht von Aufnahme ${loan.principalOriginal} ab`;
}

/**
 * Rechnet die Rücknahme durch, ohne irgendetwas zu schreiben. Der Aufrufer entscheidet, ob er
 * `gameStateRepariert` persistiert.
 */
export function planeNotkreditRuecknahme(gameState: GameState, seasonId = gameState.season.id): NotkreditRuecknahmePlan {
  const loans = gameState.seasonState.loans ?? [];
  const zurueckzunehmen = loans.filter((loan) => istZwangsNotkredit(loan, seasonId));
  const behalten = loans
    .filter((loan) => loan.lenderType === "bank" && loan.originatedSeasonId === seasonId && !istZwangsNotkredit(loan, seasonId))
    .map((loan) => ({ teamId: loan.borrowerTeamId, loanId: loan.loanId, grund: behaltGrund(loan) }));

  if (zurueckzunehmen.length === 0) {
    return { seasonId, zeilen: [], summe: 0, behalten, gameStateRepariert: null };
  }

  // Ein Team kann mehrere erwischt haben (theoretisch — am Abbild ist es je genau einer). Deshalb
  // wird pro Team aufsummiert und NICHT je Kredit einzeln auf dem Team gerechnet.
  const abzugProTeam = new Map<string, number>();
  for (const loan of zurueckzunehmen) {
    abzugProTeam.set(loan.borrowerTeamId, (abzugProTeam.get(loan.borrowerTeamId) ?? 0) + loan.principalOriginal);
  }

  const cashVorherProTeam = new Map(gameState.teams.map((team) => [team.teamId, team.cash]));
  const zeilen: NotkreditRuecknahmeZeile[] = zurueckzunehmen.map((loan) => {
    const vorher = cashVorherProTeam.get(loan.borrowerTeamId) ?? 0;
    return {
      teamId: loan.borrowerTeamId,
      loanId: loan.loanId,
      principal: loan.principalOriginal,
      cashVorher: vorher,
      cashNachher: roundCash(vorher - (abzugProTeam.get(loan.borrowerTeamId) ?? 0)),
    };
  });

  const entfernteIds = new Set(zurueckzunehmen.map((loan) => loan.loanId));
  const gameStateRepariert: GameState = {
    ...gameState,
    teams: gameState.teams.map((team) => {
      const abzug = abzugProTeam.get(team.teamId);
      if (!abzug) return team;
      return { ...team, cash: roundCash(team.cash - abzug) };
    }),
    seasonState: {
      ...gameState.seasonState,
      loans: loans.filter((loan) => !entfernteIds.has(loan.loanId)),
      loanOriginationLogs: (gameState.seasonState.loanOriginationLogs ?? []).filter((log) => !entfernteIds.has(log.loanId)),
    },
  };

  return {
    seasonId,
    zeilen,
    summe: roundCash(zurueckzunehmen.reduce((sum, loan) => sum + loan.principalOriginal, 0)),
    behalten,
    gameStateRepariert,
  };
}
