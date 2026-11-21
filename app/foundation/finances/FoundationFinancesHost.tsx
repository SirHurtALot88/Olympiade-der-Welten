"use client";

import { useMemo } from "react";

import FinanzenModern, { type VorstandAktionFn } from "@/app/foundation/finances/FinanzenModern";
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildSalaryFactorOutlook } from "@/lib/foundation/finances/salary-factor-outlook";
import { useFinancesViewModel } from "@/lib/foundation/finances/use-finances-view-model";
import { useFinancesLeagueTable } from "@/lib/foundation/finances/use-finances-league-table";

export type FoundationFinancesHostProps = {
  gameState: GameState;
  /** Active manager's own team id — fog of war: never another team's id. */
  teamId: string | null;
  /**
   * Aktiver Save — Seed-Anteil des Season-Ökonomie-Fensters (Salary Factor). Ohne die echte
   * saveId würde der Fallback-Roll in `getSeasonEconomyFactorWindow` andere Werte würfeln als
   * Season-Briefing und KI-Engine; deshalb wird sie hier explizit durchgereicht.
   */
  saveId: string;
  /** Öffnet das Teamprofil aus der Liga-Tabelle heraus (Klick auf einen Team-Namen). */
  onOpenTeam?: (teamId: string) => void;
  /** Schreibweg der Vorstand-Entscheidungen (Umschichten, Rücklage anzapfen, „Alles auf eine Karte“). */
  onVorstandAktion?: VorstandAktionFn;
  /** Sprung ins Office (Vorstandsgespräch). */
  onOpenOffice?: () => void;
  /** Darf der aktive Manager dieses Team verwalten? Sonst ist die Seite nur lesbar. */
  kannVerwalten?: boolean;
};

/**
 * Host/view split mirrors `FoundationCreditsHost` — read-only view. Einzige
 * Ausnahme von "keine Callbacks": der Sprung ins Teamprofil aus der
 * Liga-Tabelle, der nichts verändert, sondern nur navigiert.
 */
export default function FoundationFinancesHost({ gameState, teamId, saveId, onOpenTeam, onVorstandAktion, onOpenOffice, kannVerwalten }: FoundationFinancesHostProps) {
  const model = useFinancesViewModel(gameState, teamId);
  // Liga-weite Finanzübersicht (#Finanzen-Liga-Tabelle) — bewusst getrennt
  // vom Fog-of-War-gesperrten `model` oben, siehe `use-finances-league-table.ts`.
  const leagueTable = useFinancesLeagueTable(gameState);
  // Salary Factor + Richtung (aktuell → nächste Season) aus dem kanonischen Season-Ökonomie-
  // Fenster — dieselbe Quelle wie Season-Briefing und KI (siehe salary-factor-outlook.ts).
  const salaryFactorOutlook = useMemo(
    () =>
      buildSalaryFactorOutlook({
        saveId,
        seasonId: gameState.season.id,
        seasonState: gameState.seasonState,
      }),
    [saveId, gameState.season.id, gameState.seasonState],
  );

  return (
    <FinanzenModern
      gameState={gameState}
      teamId={teamId}
      finanzen={model}
      leagueTable={leagueTable}
      salaryFactorOutlook={salaryFactorOutlook}
      onOpenTeam={onOpenTeam}
      onVorstandAktion={onVorstandAktion}
      onOpenOffice={onOpenOffice}
      kannVerwalten={kannVerwalten}
    />
  );
}
