/**
 * DER KASSENSTURZ AM SCHLUSS DES GEMEINSAMEN TRANSFERFENSTERS (Chris 18.11., „ok dann mach das so!").
 *
 * Reihenfolge, verbindlich: Minus → zuerst die Ruecklage, dann ein Kredit, ein Notverkauf nur als letztes
 * Mittel. Ein Notkauf oder ein Auffuellen auf das Kader-Minimum gibt es hier NICHT (Chris: „niemals").
 *
 *   1. Ruecklage: die Ruecklage nach Finanzwert (`lib/finance/ki-ruecklage.ts`) ist kein eigenes Konto, sie
 *      liegt IN der Kasse. Ein Team, dessen Kasse am Fensterschluss noch >= 0 ist, hat sein Fenster aus der
 *      Ruecklage getragen — es passiert nichts. Steht die Kasse im Minus, ist die Ruecklage aufgebraucht.
 *   2. Kredit: zuerst der regulaere Liquiditaetskredit (`resolveAiLoanDecision`, Grund
 *      `liquidity_negative_cash`, guenstigstes Angebot von Bank oder Team, mit Kapazitaets- und
 *      Schuldendienstpruefung). Reicht das nicht oder sagt die Pruefung nein, der Notkredit der Bank ueber
 *      exakt den Fehlbetrag (`applyInsolvencyBackstop`, wie bisher am Ende des Kauffensters).
 *   3. Notverkauf: nur, wenn auch der Notkredit scheitert. Verkauft wird das hoechste Gehalt je Marktwert
 *      zuerst, nie unter 8 Spieler, bis die Kasse wieder >= 0 ist (Finanzkonzept V2, Abschnitt 6).
 *
 * Nur KI-Teams werden aktiv behandelt (Kredit, Notverkauf). Der Notkredit-Backstop laeuft wie bisher fuer
 * alle Teams: ein menschliches Team bekommt keinen Spieler verkauft, aber auch kein Minus in die Saison.
 */
import { resolveAiLoanDecision } from "@/lib/ai/ai-loan-decision-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import { applyInsolvencyBackstop, buildLoanOffers, originateLoan } from "@/lib/finance/loan-service";
import { executeLocalTransfermarktSell } from "@/lib/market/transfermarkt-local-service";
import type { PersistenceService } from "@/lib/persistence/types";

/** Unter diese Kadergroesse verkauft der Notverkauf nie (Pflichtkader, Chris 18.11.). */
export const KASSENSTURZ_NOTVERKAUF_KADER_MIN = 8;

export type KiKassensturzErgebnis = {
  /** Teams, die mit Minus ins Fensterende kamen (vor jedem Ausgleich). */
  imMinus: Array<{ teamId: string; fehlbetrag: number }>;
  kredite: Array<{ teamId: string; betrag: number }>;
  notkredite: Array<{ teamId: string; betrag: number }>;
  notverkaeufe: Array<{ teamId: string; playerId: string; erloes: number }>;
  /** Teams, die trotz allem im Minus bleiben (sollte leer sein). */
  nochImMinus: Array<{ teamId: string; fehlbetrag: number }>;
  warnings: string[];
};

function kasse(gameState: GameState, teamId: string): number {
  return gameState.teams.find((team) => team.teamId === teamId)?.cash ?? 0;
}

function r2(wert: number): number {
  return Math.round(wert * 100) / 100;
}

export function fuehreKiKassensturzAus(input: {
  saveId: string;
  seasonId: string;
  aiTeamIds: readonly string[];
  persistence: PersistenceService;
}): KiKassensturzErgebnis {
  const ergebnis: KiKassensturzErgebnis = {
    imMinus: [],
    kredite: [],
    notkredite: [],
    notverkaeufe: [],
    nochImMinus: [],
    warnings: [],
  };
  const lese = () => input.persistence.getSaveById(input.saveId);
  const start = lese();
  if (!start) {
    ergebnis.warnings.push("kassensturz_save_fehlt");
    return ergebnis;
  }
  const kiTeams = new Set(input.aiTeamIds);
  for (const team of start.gameState.teams) {
    if (team.cash < -0.01) ergebnis.imMinus.push({ teamId: team.teamId, fehlbetrag: r2(-team.cash) });
  }
  if (ergebnis.imMinus.length === 0) return ergebnis;

  // 2a) Regulaerer Liquiditaetskredit fuer KI-Teams im Minus.
  for (const { teamId } of ergebnis.imMinus) {
    if (!kiTeams.has(teamId)) continue;
    const aktuell = lese();
    if (!aktuell || kasse(aktuell.gameState, teamId) >= -0.01) continue;
    const entscheidung = resolveAiLoanDecision(aktuell.gameState, teamId);
    if (!entscheidung.shouldBorrow || entscheidung.loanAmount <= 0) {
      ergebnis.warnings.push(`kassensturz_kein_regulaerer_kredit:${teamId}:${entscheidung.reason ?? "?"}`);
      continue;
    }
    const angebote = buildLoanOffers(aktuell.gameState, teamId, entscheidung.loanAmount, entscheidung.termSeasons);
    const bestes = angebote[0] ?? null;
    const kredit = originateLoan(
      aktuell.gameState,
      {
        borrowerTeamId: teamId,
        principal: entscheidung.loanAmount,
        termSeasons: entscheidung.termSeasons,
        lenderType: bestes?.lenderType ?? "bank",
        lenderTeamId: bestes?.lenderTeamId ?? undefined,
      },
      { execute: true },
    );
    if (!kredit.ok) {
      ergebnis.warnings.push(`kassensturz_kredit_abgelehnt:${teamId}:${kredit.reason ?? "?"}`);
      continue;
    }
    input.persistence.saveSingleplayerState(input.saveId, kredit.gameState);
    ergebnis.kredite.push({ teamId, betrag: entscheidung.loanAmount });
  }

  // 2b) Notkredit ueber exakt den Fehlbetrag — fuer jedes Team, das noch im Minus steht.
  const vorBackstop = lese();
  if (vorBackstop) {
    const backstop = applyInsolvencyBackstop({ gameState: vorBackstop.gameState, saveId: input.saveId });
    if (backstop.emergencyLoans.length > 0) {
      input.persistence.saveSingleplayerState(input.saveId, backstop.gameState);
    }
    ergebnis.notkredite.push(...backstop.emergencyLoans.map((k) => ({ teamId: k.teamId, betrag: k.principal })));
    ergebnis.warnings.push(...backstop.warnings);
  }

  // 3) Notverkauf — nur, wo auch der Notkredit nicht half, und nur fuer KI-Teams.
  const nachKredit = lese();
  if (nachKredit) {
    for (const team of nachKredit.gameState.teams) {
      if (!kiTeams.has(team.teamId) || team.cash >= -0.01) continue;
      const kandidaten = nachKredit.gameState.rosters
        .filter((entry) => entry.teamId === team.teamId)
        .map((entry) => {
          const wert = entry.currentValue ?? entry.purchasePrice ?? 1;
          return { entry, schluessel: (entry.salary ?? 0) / Math.max(1, wert) };
        })
        .sort((a, b) => b.schluessel - a.schluessel);
      let kader = kandidaten.length;
      for (const { entry } of kandidaten) {
        const jetzt = lese();
        if (!jetzt || kasse(jetzt.gameState, team.teamId) >= -0.01) break;
        if (kader <= KASSENSTURZ_NOTVERKAUF_KADER_MIN) break;
        const verkauf = executeLocalTransfermarktSell({
          saveId: input.saveId,
          seasonId: input.seasonId,
          teamId: team.teamId,
          activePlayerId: entry.id,
          transferSource: "emergency_negative_cash_liquidation",
        });
        if (!verkauf.transferCreated) continue;
        kader -= 1;
        ergebnis.notverkaeufe.push({
          teamId: team.teamId,
          playerId: entry.playerId,
          erloes: r2(verkauf.netProceeds ?? verkauf.salePrice ?? 0),
        });
      }
    }
  }

  const ende = lese();
  if (ende) {
    for (const team of ende.gameState.teams) {
      if (team.cash < -0.01) ergebnis.nochImMinus.push({ teamId: team.teamId, fehlbetrag: r2(-team.cash) });
    }
  }
  return ergebnis;
}
