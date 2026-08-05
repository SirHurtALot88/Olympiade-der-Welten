import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * IST DAS LAUFENDE VERTRAGSJAHR NOCH OFFEN? — die eine Frage, an der der Buyout haengt.
 *
 * GEMELDET: „da schau, das passt nicht" — in der Kader-Uebersicht stand fuer denselben Spieler
 * ein anderer Buyout (0,0 Mio) als im Verkaufsdialog, der dann 8,8 Mio abbuchte. Dazu: „im VK
 * Modal steht auch n Faktor von 1,21 was dem angezeigten widerspricht — geringerer Basiswert und
 * Buyout kosten — obwohl der Vertrag auslaeuft — das darf nicht sein."
 *
 * Der Grund war kein Rechenfehler, sondern zwei Konventionen nebeneinander: die beiden
 * Uebersichten (`buildTeamContractSeasonTable`, `buildExpectedSellValueByPlayerId`) rechneten mit
 * `seasonsElapsed: 1` („Saisonende-Sicht"), Vorschau, Ausfuehrung und KI mit dem Default 0
 * („volle Restlaufzeit"). Beide Seiten begruendeten ihre Wahl ausfuehrlich, und beide schrieben
 * ausdruecklich hin, dass die jeweils andere unberuehrt bleibt — genau so entstehen zwei
 * Antworten auf eine Frage.
 *
 * Die Frage laesst sich am Spielstand entscheiden, statt sie je Aufrufer zu setzen: das laufende
 * Vertragsjahr ist genau dann verbraucht, wenn das Gehalt DIESER Saison bereits gebucht wurde.
 * Das ist ein Fakt im State — `sponsorPayoutLogs` mit `componentId: "salary_deduct"`, geschrieben
 * vom einzigen Gehaltsabzug des Spiels (`applySponsorSettlement` mit `deductSalary`, genutzt von
 * Saisonabschluss und Cash-Prize-Apply).
 *
 * Damit stimmt die Zahl an JEDEM Verkaufsfenster statt an einem:
 *  - Fruehes Fenster vor MD1 oder direkt nach dem letzten Spieltag: noch kein Abzug → das
 *    laufende Jahr ist noch zu zahlen und gehoert in die Abloese (0).
 *  - `transfer_sell_phase` / `preseason_management` in der Saisonende-Kette: der Abzug haengt am
 *    ersten Schritt der Kette (`season_check`) und ist dort laengst gelaufen → das Jahr ist
 *    bezahlt, ein auslaufender Vertrag hat keinen Buyout mehr (1).
 *
 * Ohne GameState/Team (Fixtures, reine Rechen-Vorschauen) bleibt es beim bisherigen Default 0.
 *
 * EIGENES MODUL, weil `transfermarkt-sell-proceeds` und `contract-negotiation-preview` beide
 * darauf zugreifen, letzteres aber schon von ersterem importiert wird — ein Rueckimport waere ein
 * Zyklus.
 */
export function resolveElapsedContractSeasonsForBuyout(input: {
  gameState?: GameState | null;
  teamId?: string | null;
}): 0 | 1 {
  const gameState = input.gameState ?? null;
  if (!gameState || !input.teamId) {
    return 0;
  }
  return teamsWithSettledSeasonSalary(gameState).has(input.teamId) ? 1 : 0;
}

/** Pro GameState einmal ausgewertet — die Kaderliste fragt das fuer ~330 Zeilen. */
const settledSalaryTeamsByGameState = new WeakMap<GameState, Set<string>>();

function teamsWithSettledSeasonSalary(gameState: GameState): Set<string> {
  const cached = settledSalaryTeamsByGameState.get(gameState);
  if (cached) {
    return cached;
  }
  const teams = new Set(
    (gameState.seasonState.sponsorPayoutLogs ?? [])
      .filter((log) => log.seasonId === gameState.season.id && log.componentId === "salary_deduct")
      .map((log) => log.teamId),
  );
  settledSalaryTeamsByGameState.set(gameState, teams);
  return teams;
}
